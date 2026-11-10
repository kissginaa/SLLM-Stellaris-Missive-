// A-00b 6번: 외교 대화(앱 쪽) — AI 와의 대화(doChat), 수락 대기 제안(accept·reject), 대화 중 쌓인 호감(pend → flushMoods),
// 게임 안 키보드 창(KBP·KB → onGameInput, writeChatLoc), 대화 상대·성향 줄(TALK·PROFILE·OPSHIFT·END), 시험용 IPC(forcePeace·apply).
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 다른 모듈은 이 상태를 ctx.talk·ctx.pending 등으로 본다(서신 답장·단말기).
import { playerPeace } from './peace-app';
import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { settings } from '../app/settings';
import { parseReply, describe, moodText, moodDelta, netSteps, WAR_REASONS, locSafe } from '../action';
import { buildMessages, talkFrom, profileFrom, treatyLean, TalkContext } from '../prompt';
import type { ChatMessage } from '../player2';
import { decodeKeys, parseKeyList } from '../hangul';
import { transcriptText, SYSTEM_PREFIX } from '../transcript';
import { applyEffect, transferEffect, opinionShiftEffects, openKbEffect, diploEffect, SllmMessage } from '../protocol';
import { link, enqueue, sendConsole, sendAndWait, sendBatch } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { gameRename, recordRename } from './rename-ledger'; // 치욕의 조약: AI 의 개명 요구(2026-11-04)
import { noteTalkMood } from './emotions-app';
import { pactAllowed, makePact } from './crisis-pact-app'; // 공동 대응 협약(알파 11)
import { refreshFrontier, frontierFor } from './frontier-app'; // 국경·전선(2026-10-26)
import { frontierLines } from '../frontier';
import { MARAUDER_ACTIONS, isMarauderType, refreshMarauder, marauderActionBlock, marauderProposal, acceptMarauder } from './marauder-app'; // 약탈자 대응(2026-10-26)
import { dealOwed, onOwedDemandRefused } from '../app/deal-hooks'; // 외교 거래(2026-10-26) — deals-app 이 등록(가져오기 고리 방지)
import { noteMentions } from './systems-app'; // 대화에서 언급된 성계 지도 이름표(알파 11) // 감정 기억 4종(알파 11)
import { deferred, inboxStore, syncInbox } from './mail-app';
import { noteHeard, olderMemories } from './memory-app'; // ChatSyncAuto 참고(2026-10-28)
import { parseHeard } from '../memory-links';
import { extractJson, type Action } from '../action';
import { ctx, Pending } from '../app/ctx';
import { randomUUID } from 'crypto';
import { switchHistories } from '../chat-history';
import { L } from '../i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)
import { fallenState, fallenKind, answerChance, hangupChance, yearKey, fallenText } from '../fallen';
import { temperPush } from '../app/temper-hooks'; // 외교 노선(2026-11-04): 대화의 호감 변화 → 노선 압력
import { talkPush as talkPushOf } from '../temper';
import { policyTalkLine } from '../policy-view'; // 정책으로 보는 호감(2026-11-05)
import { infamyTalk } from '../app/infamy-hooks'; // 악명·전쟁범죄(2026-11-04): 대화 프롬프트 줄

interface PendingMood { idx: number; name: string; base: number; steps: number[] }
/** 대화 상태(main.ts의 let 변수들을 모았다) */
export const chat = {
  busy: false, session: randomUUID(),
  /** 지금 대화 중인 상대 */
  talk: null as TalkContext | null,
  history: [] as ChatMessage[],
  /** 상대별 대화 기록(2026-10-17): 다른 상대로 옮겨 가도 지우지 않고, 돌아오면 이어서 쓴다. 세이브가 바뀌면 비운다 */
  histories: new Map<number, ChatMessage[]>(),
  /** 플레이어가 수락해야 실행되는 제안(한 번에 하나) */
  pending: null as Pending | null,
  pendingSeq: 0,
  /** 마지막 AI 대사(게임 안 창에 띄울 문장) */
  lastSay: '',
  /** 대화 중 쌓인 호감 변화. 대화가 끝날 때(상대 전환·종료 버튼·앱 닫기) 한 번에 게임에 보낸다 */
  pend: null as PendingMood | null,
  /** 게임이 알려 준 새 의견 값 */
  lastShift: null as { idx: number; op: number } | null,
  /** 게임 안 키보드 창의 대화 상대 */
  kbTid: 0,
  /** 같은 입력을 두 번 처리하지 않도록 */
  lastKbN: -1,
  /** 입력 번호 → 조각(KBP p=1..8, 오래된 키부터) */
  kbParts: new Map<string, string[]>(),
};

function currentShift(): { idx: number; op: number } | null {
  return chat.lastShift;
}
// 일반 통신은 횟수 제한·호의 지급 없음(2026-10-17 사용자 결정: 10회·호의는 만찬 대화에만). 세이브·상대가 바뀌면 늦은 응답만 막는다.
export function resetConversation():void{chat.session=randomUUID();}
// 몰락한 제국(잠든 상태) 통신(2026-10-19): 그들이 응할 때만 연결, 주고받을 때마다 끊을 확률 +20%. 끊거나 거절한 해(게임 연도)에는 다시 응하지 않는다.
export const fallenCalls = new Map<string, number>(); // 'sid:idx' → 이번 통신에서 주고받은 횟수
export const fallenBlocked = new Map<string, string>(); // 'sid:idx' → 거절·끊음이 있었던 해('YYYY')
const fkey = (idx: number) => (ctx.curSaveId || '') + ':' + idx;
/** 새 통신이 연결될 때: 몰락한 제국이면 응할지 정한다. 돌려준 talk 의 ended 가 true 면 응하지 않음. */
export function fallenConnect<T extends TalkContext>(t: T, rnd: () => number = Math.random): T {
  if (fallenState(t.ctype) !== 'dormant') return t.ended ? { ...t, ended: false } : t;
  const k = fkey(t.idx), mon = yearKey(ctx.gameDate || '');
  if (mon && fallenBlocked.get(k) === mon) { ctx.toUi('event', fallenText.refusedYear(t.name)); return { ...t, ended: true }; }
  if (rnd() >= answerChance(t.score, fallenKind(t.ethicIds, t.profile?.personality), !!t.profile?.flags.war)) {
    if (mon) fallenBlocked.set(k, mon); fallenCalls.delete(k);
    ctx.toUi('event', fallenText.refused(t.name)); return { ...t, ended: true };
  }
  fallenCalls.set(k, 0); ctx.toUi('event', fallenText.accepted(t.name)); return { ...t, ended: false };
}
export function switchHistory(prev: number, next: number): void { chat.history = switchHistories(chat.histories, chat.history, prev, next); }
function pendDelta(): number { return chat.pend ? chat.pend.steps.reduce((a, s) => a + moodDelta(s), 0) : 0; }
export function flushMoods(): Promise<void> {
  const p = chat.pend;
  chat.pend = null;
  if (!p || !ctx.actionsAllowed(p.idx)) return Promise.resolve();
  const steps = netSteps(p.steps);
  { const dl = p.steps.reduce((a, s) => a + moodDelta(s), 0); if (dl) temperPush(p.idx, talkPushOf(dl), dl > 0 ? ['우리와의 대화에서 존중을 느낌', 'felt respected in talks with us'] : ['우리와의 대화에서 위협·모욕을 느낌', 'felt threatened or insulted in talks with us']); if (dl) chronNote(p.idx, L(`대화 끝에 서로의 호감이 ${dl > 0 ? '올랐다' : '떨어졌다'}(${dl > 0 ? '+' : ''}${dl})`, `By the end of the talk our mutual favor ${dl > 0 ? 'rose' : 'fell'} (${dl > 0 ? '+' : ''}${dl})`)); }
  if (!steps.length) { ctx.toUi('mood', L(`${p.name}: 쌓인 호감 변화가 서로 상쇄되어 적용할 것이 없습니다.`, `${p.name}: the accumulated favor changes cancelled out, so there is nothing to apply.`)); return Promise.resolve(); }
  return enqueue(async () => {
    chat.lastShift = null;
    const o = await sendBatch(steps.length, (reqs) => opinionShiftEffects(reqs, p.idx, steps));
    if (o === 'ok') {
      const ls = currentShift();
      ctx.toUi('mood', L(`${p.name}의 호감을 게임에 반영했습니다`, `Applied ${p.name}'s favor to the game`) + (ls && ls.idx === p.idx ? ` (${p.base} → ${ls.op})` : ''));
    } else {
      ctx.toUi('mood', L(`${p.name}의 호감 변화를 적용하지 못했습니다(${o}).`, `Could not apply ${p.name}'s favor change (${o}).`));
    }
  }).catch((e) => ctx.toUi('mood', L('호감 변화 전송 실패: ', 'Failed to send the favor change: ') + (e as Error).message));
}
const WR_EN: Record<string, string> = { humiliation: 'Humiliation', tribute: 'Demand tribute', revenge: 'Revenge' };
const MOOD_EN: Record<number, string> = { 1: 'rose a little', 2: 'rose a lot', 3: 'fell a little', 4: 'fell a lot' };
interface ChatResult { say: string; note: string | null; proposal: { id: number; text: string; confirm: boolean } | null; ended?: boolean }
export async function doChat(text: string): Promise<ChatResult> {
  if(chat.busy)throw new Error(L('상대의 답변을 기다려 주세요.', 'Please wait for their reply.'));
  if(typeof text!=='string'||!text.trim()||text.length>1600)throw new Error(L('발언을 1~1600자로 입력하세요.', 'Enter 1–1600 characters.'));
  ctx.needPaused();
  if (!chat.talk) throw new Error(L('외교 단말기의 연락처에서 통신할 제국을 선택하세요.', 'Choose an empire to contact from the diplomatic terminal\'s contacts.'));
  if (chat.talk.ended) throw new Error(fallenText.closed());
  const sid=ctx.curSaveId,epoch=link.epoch,idx=chat.talk.idx,session=chat.session;
  chat.busy=true;
  try {
  if (isMarauderType(chat.talk.ctype)) { await refreshMarauder(idx); if (chat.talk?.idx !== idx) throw new Error(L('통신 또는 세이브가 바뀌어 응답을 반영하지 않았습니다.', 'The channel or save changed, so the reply was not applied.')); } // 약탈자: 발언 전 습격 상태(2026-10-26)
  await refreshFrontier([idx]).catch(() => {}); if (chat.talk?.idx !== idx) throw new Error(L('통신 또는 세이브가 바뀌어 응답을 반영하지 않았습니다.', 'The channel or save changed, so the reply was not applied.')); // 국경·전선(2026-10-26)
  chat.talk=ctx.withLore(chat.talk);
  { const fl = frontierLines(frontierFor(idx), { atWar: !!chat.talk.profile?.flags.war }); chat.talk = fl.length ? { ...chat.talk, frontier: fl } : chat.talk; }
  { const il = infamyTalk(idx); if (il) chat.talk = { ...chat.talk, infamy: il }; } // 악명·전쟁범죄(2026-11-04)
  { const sn = ctx.flagProv.saveSnap(), me = sn && sn.player.sid === sid ? sn.countries.find((c) => c.human) : undefined, ai = me ? sn!.countries.find((c) => c.idx === idx) : undefined; /* 정책으로 보는 호감(2026-11-05): 자동 저장에서 읽은 두 나라 정책 */
    const pv = ai && me ? policyTalkLine(ai.pol, me.pol, chat.talk.player) : ''; chat.talk = pv ? { ...chat.talk, policyView: pv } : { ...chat.talk, policyView: undefined }; }
  { const om = olderMemories(idx, chat.talk.profile?.flags, text); chat.talk = om.length ? { ...chat.talk, olderMemories: om } : { ...chat.talk, olderMemories: undefined }; } // 관련 있는 오래된 기억(2026-10-28)
  const dormant = fallenState(chat.talk.ctype) === 'dormant', fk = fkey(idx), turn = (fallenCalls.get(fk) ?? 0) + 1;
  const final = dormant && Math.random() < hangupChance(turn); // 이번 답을 마지막으로 끊는지(미리 정해 AI 가 끊는 말을 하게)
  const messages=buildMessages(chat.talk, chat.history, text, Math.random, final);
  const raw = await ctx.ai.chat(messages, { maxTokens: 1800, conversationId: `diplomacy:${sid}:${idx}:${session}` });
  if(ctx.curSaveId!==sid||link.epoch!==epoch||chat.session!==session||chat.talk?.idx!==idx)throw new Error(L('통신 또는 세이브가 바뀌어 응답을 반영하지 않았습니다.', 'The channel or save changed, so the reply was not applied.'));
  chat.history.push({ role: 'user', content: text }, { role: 'assistant', content: raw });
  // (아래 parseReply 후 lastSay 를 갱신한다)
  const r = parseReply(raw);
  { // 약탈자(2026-10-26): 대화 전용이어도 위협·돌리기·용병 흥정만은 제안할 수 있다. 다른 상대는 이 행동을 쓸 수 없다.
    const mrd = isMarauderType(chat.talk.ctype), mAct = !!r.action && MARAUDER_ACTIONS.has(r.action.type);
    if (mrd ? !mAct : mAct) r.action = null;
    if(!ctx.actionsAllowed(chat.talk.idx)){ if(!(mrd && mAct)) r.action=null; r.mood=0; }
  }
  if (dormant) r.action = null; // 몰락한 제국: 일방적 통신, 게임 행동 없음
  chat.lastSay = r.say;
  try { const hd = parseHeard(extractJson(raw)); if (hd && !isMarauderType(chat.talk.ctype)) noteHeard({ idx, name: chat.talk.name }, hd); } catch { /* 꼬리표는 부가 기능 */ } // 들은 말이 퍼지기(2026-10-28)
  try { noteMentions(text + '\n' + (r.say || '')); } catch { /* 지도 이름표는 부가 기능 */ } // 대화에서 언급된 성계(알파 11)
  chat.pending = null;
  let proposal: { id: number; text: string; confirm: boolean } | null = null;
  let hint: string | null = null;
  if (r.action && r.action.type === 'defer') {
    const topic = r.action.topic ?? L('조약 제안', 'Treaty proposal');
    if (ctx.curSaveId && chat.talk.profile) {
      const lean = treatyLean(chat.talk);
      const item = deferred().add({ sid: ctx.curSaveId, idx: chat.talk.idx, name: chat.talk.name, topic, asked: ctx.gameDate, lean, op: chat.talk.score, profile: chat.talk.profile }, 1 + Math.floor(Math.random() * 3));
      if (item) { chronNote(chat.talk.idx, L(`"${topic}" 건은 의원들과 논의한 뒤 서신으로 답하겠다고 했다`, `Said they would discuss "${topic}" with their councilors and answer by letter`)); hint = L(`"${topic}" 건은 ${item.due} 무렵 서신으로 답이 옵니다.`, `A letter about "${topic}" will arrive around ${item.due}.`); }
      else hint = L(`"${topic}" 건은 이미 논의 중입니다.`, `"${topic}" is already under discussion.`);
    } else hint = L('세이브 정보를 몰라 서신 약속은 기록하지 못했습니다.', 'The save is unknown, so the letter promise was not recorded.');
    r.action = null;
  }
  if (r.action && r.action.type === 'declare_war' && (!chat.talk.profile || ['war', 'truce', 'fed', 'nap', 'def'].some((k) => chat.talk!.profile!.flags[k]))) {
    hint = L('이미 전쟁·휴전·조약 중이라 선전포고 제안은 무시했습니다.', 'Already at war, in a truce or bound by a treaty, so the war declaration was ignored.');
  } else if (r.action && r.action.type === 'declare_war') {
    // 선전포고는 AI 의 결정이다. 제안 없이 바로 게임에 보낸다.
    const t = chat.talk;
    const reasonKey = r.action.reason ?? 'humiliation';
    enqueue(async () => {
      const wr = WAR_REASONS[reasonKey] ?? WAR_REASONS.humiliation;
      const o = await sendAndWait((req) => diploEffect(req, t.idx, wr.kind));
      const text =
        o === 'ok' ? L(`${t.name}이(가) 당신에게 선전포고했습니다! (사유: ${wr.ko})`, `${t.name} has declared war on you! (Reason: ${WR_EN[reasonKey] ?? WR_EN.humiliation})`) :
        o === 'fail' ? L(`${t.name}의 선전포고가 게임에서 받아들여지지 않았습니다(휴전·조약·전쟁 명분 문제일 수 있습니다).`, `${t.name}'s war declaration was not accepted by the game (possibly a truce, treaty or casus belli issue).`) :
        o === 'timeout' ? L('선전포고 처리에 게임이 응답하지 않았습니다.', 'The game did not respond to the war declaration.') : L(`선전포고 요청이 거부되었습니다(${o}).`, `The war declaration request was refused (${o}).`);
      if (o === 'ok') chronNote(t.idx, L(`상대가 우리에게 선전포고했다(사유: ${wr.ko})`, `They declared war on us (reason: ${WR_EN[reasonKey] ?? WR_EN.humiliation})`));
      chat.history.push({ role: 'user', content: SYSTEM_PREFIX + text });
      ctx.toUi('event', text);
    }).catch((e) => ctx.toUi('event', L('선전포고 전송 실패: ', 'Failed to send the war declaration: ') + (e as Error).message));
  } else if (r.action && r.action.type === 'crisis_pact' && !pactAllowed(chat.talk.idx, { type: chat.talk.ctype, war: !!chat.talk.profile?.flags.war })) {
    hint = L('지금은 이 제국과 공동 대응 협약을 맺을 수 없어 제안을 무시했습니다(적대 위기가 없거나, 전쟁 중이거나, 이미 협약 중이거나, 협약이 3개입니다).', 'A joint crisis response pact is not possible with this empire right now (no hostile crisis, at war, already bound, or three pacts already), so the proposal was ignored.');
  } else if (r.action && (r.action.type === 'make_peace' || r.action.type === 'demand_rename') && !chat.talk.profile?.flags.war) {
    hint = L('전쟁 중이 아니라서 평화 제안은 무시했습니다.', 'Not at war, so the peace proposal was ignored.');
  } else if (r.action && MARAUDER_ACTIONS.has(r.action.type) && marauderActionBlock(r.action, chat.talk.idx)) {
    hint = marauderActionBlock(r.action, chat.talk.idx);
  } else if (r.action) {
    chat.pending = { id: ++chat.pendingSeq, action: r.action, tid: chat.talk.idx, aiName: chat.talk.name, epoch: link.epoch };
    proposal = { id: chat.pending.id, text: MARAUDER_ACTIONS.has(r.action.type) ? marauderProposal(r.action, chat.talk.name, chat.talk.idx) : describe(r.action, chat.talk.name), confirm: false };
  }
  if (r.mood > 0) {
    if (!chat.pend || chat.pend.idx !== chat.talk.idx) chat.pend = { idx: chat.talk.idx, name: chat.talk.name, base: chat.talk.score, steps: [] };
    chat.pend.steps.push(r.mood);
    try { noteTalkMood(chat.talk.idx, r.mood); } catch { /* 감정 기억은 부가 기능 */ } // 감정 기억(알파 11)
    chat.talk = { ...chat.talk, score: chat.pend.base + pendDelta() };
    ctx.toUi('talk', chat.talk);
    ctx.toUi('mood', L(`${chat.talk.name}의 호감이 ${moodText(r.mood)} (대화가 끝나면 게임에 반영됩니다)`, `${chat.talk.name}'s favor ${MOOD_EN[r.mood] ?? 'changed'} (applied to the game when the talk ends)`));
  }
  let ended = false;
  if (dormant) {
    fallenCalls.set(fk, turn);
    if (final) {
      ended = true; fallenCalls.delete(fk); { const mon = yearKey(ctx.gameDate || ''); if (mon) fallenBlocked.set(fk, mon); }
      chat.talk = { ...chat.talk, ended: true };
      chat.history.push({ role: 'user', content: SYSTEM_PREFIX + 'They closed the channel.' });
      hint = [hint, fallenText.hungUp(chat.talk.name)].filter(Boolean).join(' ');
      if (chat.pend) void flushMoods();
    }
  }
  return { say: r.say, note: [r.note, hint].filter(Boolean).join(' ') || null, proposal, ...(ended ? { ended } : {}) };
  }finally{chat.busy=false;}
}

// 게임 안 창(통신 창·키보드 창)에 띄울 글을 지역화 파일로 쓴다. 실패하면 오류 문장을 돌려준다.
function writeChatLoc(): string | null {
  if (app.isPackaged || /[\\/]workshop[\\/]content[\\/]/i.test(ctx.MOD_DIR)) return '배포판에서는 게임 내 키보드 시험 기능을 사용하지 않습니다. 외교 단말기를 이용하세요.';
  const bom = '\uFEFF';
  // 게임 안 창의 오른쪽 칸: 최근 대화 기록(가장 최근 말이 맨 아래). 기록이 없으면 마지막 대사나 안내문.
  const say = transcriptText(chat.history, chat.talk?.name ?? 'AI', chat.lastSay || '(통신이 연결되었습니다. 아래 키보드로 할 말을 입력하세요.)');
  const body = (lang: string, close: string) => `${bom}l_${lang}:\n SLLM_CHAT_TITLE:0 "(실험모드) ${locSafe(chat.talk?.name ?? '외교 통신')}"\n SLLM_CHAT_DESC:0 "${locSafe(say)}"\n SLLM_CHAT_CLOSE:0 "${close}"\n`;
  try {
    fs.writeFileSync(path.join(ctx.MOD_DIR, 'localisation', 'korean', 'sllm_probe_chat_l_korean.yml'), body('korean', '대화 종료'), 'utf8');
    fs.writeFileSync(path.join(ctx.MOD_DIR, 'localisation', 'english', 'sllm_probe_chat_l_english.yml'), body('english', 'End conversation'), 'utf8');
    return null;
  } catch (e) { return '지역화 파일을 쓰지 못했습니다: ' + (e as Error).message; }
}
function onKbPart(m: SllmMessage) {
  const n = m.kv.n ?? '', p = Number(m.kv.p);
  if (!(p >= 1 && p <= 16)) return;
  const parts = chat.kbParts.get(n) ?? [];
  parts[p - 1] = m.kv.c ?? '';
  chat.kbParts.set(n, parts);
}
// 게임 안 키보드로 받은 말을 AI 에게 보내고, 답을 게임 안 창에 다시 띄운다.
async function onGameInput(m: SllmMessage) {
  const n = Number(m.kv.n);
  if (Number.isFinite(n) && n === chat.lastKbN) return;
  chat.lastKbN = n;
  const parts = chat.kbParts.get(m.kv.n ?? '') ?? [];
  chat.kbParts.clear();
  const text = decodeKeys(parseKeyList(parts.filter((x) => x).join(',')));
  if (!text) { ctx.toUi('kbchat', { me: '', ai: '', note: L('빈 입력이라 보내지 않았습니다.', 'Empty input, so nothing was sent.') }); return; }
  ctx.toUi('kbchat', { me: text });
  try {
    const r = await doChat(text);
    ctx.toUi('kbchat', { ai: r.say, note: r.note, proposal: r.proposal });
  } catch (e) {
    chat.lastSay = L('(통신 오류: ', '(Comms error: ') + (e as Error).message + ')';
    ctx.toUi('kbchat', { note: L('오류: ', 'Error: ') + (e as Error).message });
  }
  if (writeChatLoc()) return;
  const tid = chat.kbTid || chat.talk?.idx || 0;
  try { // 게임 연결이 끊겼거나 세이브가 바뀌면 명령 큐가 거부한다. 처리 안 된 오류로 남기지 말고 화면에 알린다(2026-10-18).
    await enqueue(() => sendConsole('reload text'));
    await enqueue(() => sendConsole(openKbEffect(tid, false)));
  } catch (e) { ctx.toUi('kbchat', { note: L('게임 화면의 답장 갱신 실패: ', 'Failed to refresh the in-game reply: ') + (e as Error).message }); }
}

export function registerChat(router: LogRouter, noteSave: (sid: string) => void): void {
  router.on(SLOT.OPSHIFT, 'chat:opshift', (m: SllmMessage) => {
    if (m.kind === 'OPSHIFT') {
      const idx = Number(m.kv.idx), op = Number(m.kv.op);
      if (Number.isFinite(idx) && Number.isFinite(op)) {
        chat.lastShift = { idx, op };
        if (chat.talk && chat.talk.idx === idx) { chat.talk = { ...chat.talk, score: op }; ctx.toUi('talk', chat.talk); }
      }
    }
  });
  router.on(SLOT.KEYBOARD, 'chat:keyboard', (m: SllmMessage) => {
    if (m.kind === 'KBP') onKbPart(m);
    if (m.kind === 'KB') void onGameInput(m);
  });
  router.on(SLOT.END, 'chat:end', (m: SllmMessage) => {
    if (m.kind === 'END' && chat.pend) { void flushMoods(); ctx.toUi('event', L('게임 안 창에서 대화를 마쳤습니다.', 'The conversation ended in the in-game window.')); }
  });
  router.on(SLOT.TALK, 'chat:talk', (m: SllmMessage) => {
    const t = talkFrom(m);
    if (t) {
      if (t.sid) noteSave(t.sid);
      if (chat.pend && chat.pend.idx !== t.idx) void flushMoods(); // 이전 상대와의 대화가 끝났다
      if (!chat.talk || chat.talk.idx !== t.idx) { switchHistory(chat.talk?.idx ?? 0, t.idx); resetConversation(); } // 상대가 바뀌어도 이전 기록은 지우지 않고 상대별로 보관한다
      const known = ctx.profiles.get(t.idx);
      chronNote(t.idx, L('처음으로 통신이 연결되어 대화를 나눴다', 'First contact established; we talked for the first time'), true);
      chat.talk = fallenConnect(ctx.withLore({ ...t, score: chat.pend && chat.pend.idx === t.idx ? t.score + pendDelta() : t.score, ...(known ? { profile: known } : {}) }));
      ctx.toUi('talk', chat.talk);
      ctx.win?.webContents.send('pane', 'chat'); // 총독/설정 창이 열려 있었다면 닫고 대화 화면으로 돌아온다
      if (settings.autoOpenOnTalk && !ctx.appOpen) ctx.setAppOpen(true); // 게임에서 대화 버튼을 눌렀으니 연다
    }
  });
  router.on(SLOT.PROFILE, 'chat:profile', (m: SllmMessage) => {
    const pf = profileFrom(m);
    if (pf) ctx.profiles.set(pf.idx, ctx.profileWithEthics(pf.profile,pf.idx)!);
    if (pf && chat.talk && chat.talk.idx === pf.idx) {
      chat.talk = ctx.withLore({ ...chat.talk, profile: ctx.profileWithEthics(pf.profile,pf.idx)! });
      ctx.toUi('talk', chat.talk);
    }
  });
  ipcMain.handle('chat', async (_e, text: string) => doChat(text));
  /** 수락한 행동을 게임이 거부했을 때: 상대가 한두 문장으로 솔직히 말한다(새 제안 없이). 대화가 그대로일 때만. */
  const REFUSAL_RULE = 'The action you just agreed to was NOT carried out by the game. Tell the leader honestly, in character, in one or two sentences, that it did not go through. Use only the reason given; do not invent another. Do not propose a new action now (action must be null).';
/** AI 가 종전 조건으로 건 개명 요구를 수락: 우리 수도 행성·성계 이름을 바꾸고(원래 이름은 장부에), 종전을 시도한다. 신문 1면. */
async function acceptRenameDemand(a: Action, tid: number, aiName: string): Promise<{ outcome: string; text: string }> {
  const what = a.what === 'sys' ? 'sys' : 'cap', name = a.name || '', sid = ctx.curSaveId;
  const r = await gameRename({ kind: 'self' }, what, name);
  if (!r.ok || !sid) return { outcome: 'fail', text: L(`이름을 바꾸지 못했습니다(${r.status}).`, `Could not rename (${r.status}).`) };
  recordRename(sid, { tid, empire: aiName, what, old: r.old, name, by: 'demand' });
  const w = what === 'cap' ? L('수도 행성', 'capital world') : L('수도 성계', 'capital system');
  chronNote(tid, L(`우리의 요구대로 그들이 ${w} 「${r.old}」을(를) 「${name}」(으)로 바꾸었다`, `As we demanded, they renamed their ${w} "${r.old}" to "${name}"`));
  chronNoteWorld(L(`${ctx.gameDate} 치욕의 조약 — ${ctx.playerName}, ${aiName}의 요구로 ${w} 「${r.old}」을(를) 「${name}」(으)로 개명`, `${ctx.gameDate} A treaty of shame — ${ctx.playerName} renames its ${w} "${r.old}" to "${name}" at ${aiName}'s demand`), true);
  const pz = await playerPeace(tid, aiName);
  return { outcome: 'ok', text: L(`${w} 「${r.old}」이(가) 이제 「${name}」입니다. `, `Our ${w} "${r.old}" is now "${name}". `) + pz.text };
}
async function refusalLine(tid: number, type: string, why: string): Promise<string> {
  const talk = chat.talk; if (!talk || talk.idx !== tid || talk.ended || chat.busy) return '';
  const sid = ctx.curSaveId, epoch = link.epoch, session = chat.session; chat.busy = true;
  try {
    const raw = await ctx.ai.chat(buildMessages(talk, chat.history, SYSTEM_PREFIX + `${REFUSAL_RULE} (action: ${type}; game result: ${why})`, Math.random, false), { maxTokens: 900, conversationId: `diplomacy:${sid}:${tid}:${session}` });
    if (ctx.curSaveId !== sid || link.epoch !== epoch || chat.session !== session || chat.talk?.idx !== tid) return '';
    const say = parseReply(raw).say.trim(); if (!say) return '';
    chat.history.push({ role: 'assistant', content: raw }); chat.lastSay = say;
    return say;
  } finally { chat.busy = false; }
}
// 플레이어가 제안을 수락하면 게임에 보내고, 게임의 ACK 를 기다려 결과를 돌려준다.
  ipcMain.handle('accept', async (_e, id: number) => {
    if(chat.pending?.id === id && !ctx.actionsAllowed(chat.pending.tid) && !MARAUDER_ACTIONS.has(chat.pending.action.type)) return {outcome:'fail',text:L('이 국가 유형의 게임 행동은 호환 설정에서 비활성화되어 있습니다.', 'In-game actions for this empire type are disabled in the compatibility settings.')};
    if (!chat.pending || chat.pending.id !== id) throw new Error(L('이미 처리되었거나 만료된 제안입니다.', 'This proposal was already handled or has expired.'));
    if (chat.pending.epoch !== undefined && chat.pending.epoch !== link.epoch) { chat.pending = null; throw new Error(L('세이브를 다시 불러와 이 제안은 만료되었습니다.', 'The save was reloaded, so this proposal has expired.')); }
    const p = chat.pending;
    if (p.letterId && p.letterSid) { inboxStore().handleProposal(p.letterSid, p.letterId); syncInbox(); }
    chat.pending = null;
    const t = p.action.type;
    const amount = p.action.amount ?? 0;
    if (MARAUDER_ACTIONS.has(t)) { const r = await acceptMarauder(p.action, p.tid, p.aiName); chat.history.push({ role: 'user', content: SYSTEM_PREFIX + r.text }); return r; } // 약탈자 대응(2026-10-26)
    if (t === 'demand_rename') { const r = await acceptRenameDemand(p.action, p.tid, p.aiName); chat.history.push({ role: 'user', content: SYSTEM_PREFIX + r.text }); return r; } // 치욕의 조약(2026-11-04)
    if (t === 'crisis_pact') { const r = await makePact(p.tid, p.aiName); chat.history.push({ role: 'user', content: SYSTEM_PREFIX + r.text }); return r; } // 공동 대응 협약(알파 11)
    // 평화: 현상 유지 규칙으로 영유권 안 점령지를 넘기고 종전·휴전(2026-10-17, src/features/peace-app.ts). 다른 행동은 기존 경로.
    const peace = t === 'make_peace' ? await playerPeace(p.tid, p.aiName) : null;
    const o = peace ? peace.outcome : await enqueue(() =>
      sendAndWait((req) =>
        t === 'give_energy' || t === 'take_energy'
          ? transferEffect(req, p.tid, amount, t === 'give_energy' ? 1 : 2)
          : diploEffect(req, p.tid, t === 'open_borders' ? 1 : 3)
      )
    );
    const okText: Record<string, string> = {
      give_energy: L(`전달 완료: 에너지 ${amount}`, `Transferred: ${amount} energy`),
      take_energy: L(`전달 완료: 에너지 ${amount}`, `Transferred: ${amount} energy`),
      open_borders: L('국경 제한이 해제되었습니다(게임 설정 확인 필요).', 'Border restrictions lifted (check in game).'),
      make_peace: peace?.text || L('평화 처리를 마쳤습니다.', 'Peace processed.'),
      declare_war: L('선전포고가 이루어졌습니다(실험 기능).', 'War has been declared (experimental).'),
    };
    const text =
      o === 'ok' ? (okText[t] ?? L('완료', 'Done')) :
      peace ? peace.text :
      o === 'fail' ? (t === 'make_peace' ? L('실패: 둘만의 전쟁이 아니거나 전쟁 중이 아닙니다.', 'Failed: not a two-party war, or not at war.') : t === 'declare_war' ? L('실패: 선전포고를 하지 못했습니다(휴전·조약·전쟁 명분 문제일 수 있습니다).', 'Failed: could not declare war (possibly a truce, treaty or casus belli issue).') : L('실패: 에너지가 부족하거나 대상을 찾지 못했습니다.', 'Failed: not enough energy or the target was not found.')) :
      o === 'timeout' ? L('게임에서 응답이 없습니다. 연결 상태를 확인해 주세요.', 'No response from the game. Check the connection.') :
      L(`거부됨(${o}): 요청 번호 문제입니다.`, `Refused (${o}): request number problem.`);
    if (o === 'ok') { const ko: Record<string, string> = { give_energy: L(`상대가 에너지 ${amount}을(를) 건넸다`, `They handed over ${amount} energy`), take_energy: L(`상대의 요청으로 우리가 에너지 ${amount}을(를) 건넸다`, `At their request we handed over ${amount} energy`), open_borders: L('상대가 국경 제한을 풀었다', 'They lifted their border restrictions'), make_peace: L('상대와 평화 협정을 맺었다', 'We made peace with them') + (() => { const moved = (peace?.lines ?? []).filter((l) => l.includes('이전 확인') || l.includes('Transfer confirmed')); return moved.length ? ` (${moved.map((l) => l.split(':')[0]).join(', ')})` : ''; })() }; if (ko[t]) chronNote(p.tid, ko[t]); }
    else if (o === 'fail') { const kf: Record<string, string> = { give_energy: L('에너지를 건네려 했으나 처리되지 않았다', 'Tried to hand over energy but it did not go through'), take_energy: L('에너지를 요청했으나 처리되지 않았다', 'Asked for energy but it did not go through'), open_borders: L('국경 개방이 처리되지 않았다', 'Opening borders did not go through'), make_peace: L('평화 처리가 받아들여지지 않았다', 'The peace was not accepted') }; if (kf[t]) chronNote(p.tid, kf[t]); }
    chat.history.push({ role: 'user', content: SYSTEM_PREFIX + text });
    // 게임이 거부했으면 상대가 그 자리에서 솔직하게 말한다(2026-10-29, AiLive 참고 — 아이디어만). 실패할 때만 AI 한 번.
    const say = o === 'fail' || o === 'timeout' ? await refusalLine(p.tid, t, text).catch(() => '') : '';
    return { outcome: o, text, ...(say ? { say } : {}) };
  });
  // 대화 종료: 쌓인 호감 변화를 지금 게임에 보낸다.
  ipcMain.handle('finish', async () => {
    if(chat.busy)return L('상대의 답변을 기다린 뒤 종료해 주세요.', 'Wait for their reply before ending.');
    if (!chat.pend) return L('반영할 호감 변화가 없습니다.', 'There is no favor change to apply.');
    await flushMoods();
    return L('대화를 마쳤습니다.', 'The conversation has ended.');
  });
  ipcMain.handle('reject', async (_e, id: number) => {
    if (chat.pending?.id === id && chat.pending.letterId && chat.pending.letterSid) { inboxStore().handleProposal(chat.pending.letterSid, chat.pending.letterId); syncInbox(); }
    if (chat.pending && chat.pending.id === id) {
      if (chat.pending.action.type === 'take_energy' && dealOwed(chat.pending.tid)) void onOwedDemandRefused(chat.pending.tid, chat.pending.aiName).catch(() => {}); // 외교 거래: 빚을 쥔 상대의 요구 거절(2026-10-26)
      chat.history.push({ role: 'user', content: SYSTEM_PREFIX + 'The player declined the proposal.' });
      chat.pending = null;
    }
    return true;
  });
  // 시험용: AI 의 의사와 상관없이 평화 처리 효과만 시험한다(정식 기능이 아니다).
  ipcMain.handle('forcePeace', async (_e, tid: number) => {
    const r = await playerPeace(Number(tid), ctx.terminal.items.find((c) => c.idx === Number(tid))?.name || `제국 #${tid}`);
    return `${r.outcome}: ${r.text}`;
  });
  // 시험용: 플레이어에게 에너지 전송 효과를 콘솔로 보낸다(프로브 모드의 sllm_probe_apply).
  ipcMain.handle('apply', async (_e, tid: number, amt: number) => {
    link.reqCounter += 1;
    try {
      await sendConsole(applyEffect(link.reqCounter, tid, amt));
    } catch (e) {
      ctx.toUi('status', L('게임 요청 전송 실패: ', 'Failed to send the game request: ') + (e as Error).message);
      throw e;
    }
    return link.reqCounter;
  });
}
