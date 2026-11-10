// 외교 거래 연결(다음 업데이트, 2026-10-26 — CK3·배너로드 참고). 규칙·수치: src/deals.ts, 화면: ui/deal-ui.js, 모드: sllm_deals.txt.
// 거래판을 열 때 게임에서 양쪽 창고·월수입·신뢰·국력·전쟁 피로를 한 번 읽고(SLLM:DEALX·DEALCTX), 확률은 앱이 계산·주사위로 정한다.
// AI 는 결과에 맞춰 말만 한다(평소 대화 한 번과 같은 호출). 매달 지급·불가침 약속은 앱이 지켜보고, 어기면 호감·신문·갈고리.
// 동맹(방위 조약·연방)이 방어 전쟁에 들어갔는데 우리가 없으면 참전 요청이 오고, 거절(또는 두 달 무응답)하면 그 제국 호감 -30 + 신문.
// 2026-11-09(회랑 방식): 매달 지급은 맺을 때 모드에 한 번 적고(정기 송금, src/mtransfer.ts) 모드가 매달 직접 보낸다 — 앱은 못 냄·끊김·다 냄 줄(MT)만 받는다.
//   동맹 방어 전쟁도 월간 상황 조사가 동맹 번호(STALLY)를 같이 보내 따로 묻지 않는다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link, sendAndWait } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { terminal, terminalRequest, terminalReplies, terminalView } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { playerPeace } from './peace-app';
import { chat } from './chat';
import { setDealHooks } from '../app/deal-hooks';
import { hoiHooks, aidProbe, aidViewFor, startAid, ctaAidPlan, ctaAidMod } from './hoi-app'; // 물자 지원(2026-10-28)
import { marryView, marryCheck, marryErrText, marryDone } from './court-app'; // 정략결혼(2026-10-28 정치)
import { marryBonus, MARRY } from '../court';
import { buildMessages } from '../prompt';
import { hoiOpinionCommand } from '../hoi';
import { parseReply } from '../action';
import { diploEffect, type SllmMessage } from '../protocol';
import { SYSTEM_PREFIX } from '../transcript';
import { renamesOf, gameRename, recordRename, markRestored } from './rename-ledger'; // 이름의 정치: 개명 요구·이름 반환(2026-11-04)
import { restorable, whatText } from '../rename';
import { vaTransfer } from './vassal-admin-app'; // 성계 할양(2026-11-04): 종속국 행정과 같은 게임 명령
import { stText } from '../vassal-admin';
import { addYears, addMonths, cmpDate } from '../gamedate';
import { temperPush } from '../app/temper-hooks'; // 외교 노선(2026-11-04): 거래 성사 → 온건 · 우리가 약속을 깸 → 강경
import { TEMPER } from '../temper';
import { mtSubscribe, mtSet, mtUnset } from './mtransfer-hub'; // 정기 송금(2026-11-09)
import { MT_OWNER, nextG, type MtEvent } from '../mtransfer';
import {
  type DealCtx, type DealItem, type Agreement, type DealRes, DEAL, DEAL_MODS, DEAL_RES, RES_NAME,
  parseDealCtx, sanitizeItems, validateDeal, dealErrorText, dealOdds, dealBalance, rollDeal, dealPromptText,
  ctxCommand, applyCommand, payCommand, opinionCommand, joinCommand, allyWarCommand, itemText,
  agreementFrom, monthStep, mtStep, napBreach, pruneNap, waiveBreach, pruneWaive, hookFromSecrets,
} from '../deals';

interface Hook { key: string; since: string }
interface CtaReq { tid: number; name: string; asked: string }
interface SaveEntry { agreements: Agreement[]; hooks: Record<string, Hook>; owed: number[]; asks: Record<string, number>; cta: CtaReq[]; ctaSeen: Record<string, string> }
const file = () => path.join(app.getPath('userData'), 'sllm_deals.json');
let store: Record<string, SaveEntry> | null = null;
const blank = (): SaveEntry => ({ agreements: [], hooks: {}, owed: [], asks: {}, cta: [], ctaSeen: {} });
function all(): Record<string, SaveEntry> {
  if (store) return store; store = {};
  try {
    const o = JSON.parse(fs.readFileSync(file(), 'utf8'));
    if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, any>)) {
      const e = blank();
      if (Array.isArray(v?.agreements)) e.agreements = v.agreements.filter((a: any) => a && typeof a.id === 'string' && Number.isSafeInteger(a.tid) && Array.isArray(a.monthly) && Array.isArray(a.nap)).slice(-50);
      if (v?.hooks && typeof v.hooks === 'object') for (const [t, h] of Object.entries(v.hooks as Record<string, any>)) if (h && typeof h.key === 'string') e.hooks[t] = { key: h.key, since: String(h.since ?? '') };
      if (Array.isArray(v?.owed)) e.owed = v.owed.filter((x: unknown) => Number.isSafeInteger(x)).slice(-50);
      if (v?.asks && typeof v.asks === 'object') for (const [t, n] of Object.entries(v.asks as Record<string, unknown>)) if (Number.isSafeInteger(n)) e.asks[t] = n as number;
      if (Array.isArray(v?.cta)) e.cta = v.cta.filter((c: any) => c && Number.isSafeInteger(c.tid) && typeof c.asked === 'string').slice(-20);
      if (v?.ctaSeen && typeof v.ctaSeen === 'object') e.ctaSeen = { ...v.ctaSeen };
      store[k] = e;
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'deals', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'deals', error: e }); } }
const entry = (sid: string): SaveEntry => (all()[safeKey(sid)] ??= blank());
const yearNow = (): number | undefined => { const y = parseInt(String(ctx.gameDate || ''), 10); return Number.isFinite(y) ? y : undefined; };
const monthKey = (d = ctx.gameDate || '') => d.slice(0, 7);
const nameOf = (idx: number): string => terminal.items.find((c) => c.idx === idx)?.name || L(`제국 #${idx}`, `Empire #${idx}`);
const resName = (r: DealRes) => L(RES_NAME[r][0], RES_NAME[r][1]);
const usName = () => ctx.playerName || L('우리', 'Us');

/** 상대가 우리에 대한 갈고리를 쥐고 있나(우리가 약속을 어김). */
/** 개발자 도구 「AI 제국 실제 상태」(2026-10-29): 그 제국과의 거래 약속. */
export const dealsFor = (tid: number): Agreement[] => (ctx.curSaveId ? entry(ctx.curSaveId).agreements.filter((a) => a.tid === tid) : []);
export const dealOwed = (tid: number): boolean => !!ctx.curSaveId && entry(ctx.curSaveId).owed.includes(tid);
/** 첩보 보고서가 확인된 비밀을 찾았을 때(embassy-app): 그 제국에 갈고리 1개(제국마다 최대 1개). */
export function noteSecretHook(tid: number, name: string, shown: Array<{ key: string; rumor?: boolean }>): void {
  const sid = ctx.curSaveId, key = hookFromSecrets(shown); if (!sid || !key || !Number.isSafeInteger(tid) || tid < 1) return;
  const e = entry(sid); if (e.hooks[String(tid)]) return;
  e.hooks[String(tid)] = { key, since: ctx.gameDate || '' }; save();
  chronNote(tid, L('첩보로 알아낸 비밀이 있어 거래에서 쓸 수 있는 약점(갈고리)을 쥐었다', 'Our spies uncovered a secret we can use as leverage (a hook) in a deal'));
  ctx.notify({ kind: 'info', title: L(`${name}의 약점을 쥐었습니다`, `We have leverage over ${name}`), body: L('집무실 「외교 거래」(또는 외교 단말기의 거래 제안)에서 「갈고리 쓰기」로 한 번 쓸 수 있습니다(수락 확률 +30%p).', 'Use it once in a deal from the office Diplomatic Deals app (or the terminal\'s deal proposal) (+30 percentage points to acceptance).') });
}
/** 상대가 갈고리를 쥔 채 요구(take_energy)했는데 우리가 거절함(chat.ts reject): 호감 -30 이 더해지고 갈고리는 사라진다. */
export async function onOwedDemandRefused(tid: number, name: string): Promise<void> {
  const sid = ctx.curSaveId; if (!sid || !dealOwed(tid)) return;
  const e = entry(sid); e.owed = e.owed.filter((x) => x !== tid); save();
  await sendOpinion(tid, DEAL_MODS.hookRefused);
  chronNote(tid, L('약속을 어긴 빚을 들어 요구했으나 우리가 거절했다', 'They called in the debt of our broken word and we refused'));
  ctx.toUi('event', L(`${name}이(가) 쥐고 있던 우리 약속 파기를 들먹였지만 거절했습니다. 호감이 더 떨어졌습니다(-30).`, `${name} called in our broken word and we refused. Their opinion fell further (-30).`));
}

// ---- 게임 읽기 ----
const dealX = new Map<string, Record<string, string>>(); // req → 상대 줄
const awRows = new Map<string, number[]>(); // req → 동맹 전쟁 제국 번호
async function readCtx(tid: number): Promise<DealCtx | null> {
  const req = ++link.reqCounter, k = String(req);
  try {
    const m = await terminalRequest(ctxCommand(req, tid), 'DEALCTX', req);
    if (m.kv.sid !== ctx.curSaveId) return null;
    return parseDealCtx(m.kv, dealX.get(k));
  } finally { dealX.delete(k); }
}
async function sendOpinion(tid: number, mod: string): Promise<boolean> {
  const req = ++link.reqCounter;
  try { const m = await terminalRequest(mod === ctaAidMod ? hoiOpinionCommand(req, tid, mod) : opinionCommand(req, tid, mod), 'DEAL', req); return m.kv.status === 'applied' || m.kv.status === 'duplicate'; }
  catch (e) { logDiagnostic('warn', 'deals.opinion_failed', { tid, mod, error: (e as Error).message }); return false; }
}

// ---- 거래판 ----
// talk: 외교 단말기에서 통신 중인 상대와 연 거래판(AI 가 결과에 맞춰 한마디). 집무실 「외교 거래」에서 목록으로 고르면 talk=false — AI 호출 없이 결과만(2026-10-26).
interface Open { tid: number; name: string; c: DealCtx; date: string; score: number; talk: boolean }
let open: Open | null = null;
const dealContacts = () => terminalView().items.filter((c) => c.type === 'default');
function canDeal(tid?: number): { tid: number; name: string; score: number; talk: boolean } | string {
  if (!ctx.curSaveId || !ctx.gameRunning) return L('게임이 켜져 있어야 합니다.', 'The game must be running.');
  if (tid === undefined) {
    const t = chat.talk;
    if (!t) return L('먼저 연락처에서 거래할 제국과 통신을 여세요.', 'Open a channel with an empire from the contacts first.');
    if (t.ctype && t.ctype !== 'default') return L('거래는 일반 제국과만 할 수 있습니다.', 'Deals are only possible with regular empires.');
    if (!ctx.actionsAllowed(t.idx)) return L('지금 이 제국과는 게임 행동을 할 수 없습니다.', 'Game actions are not possible with this empire right now.');
    return { tid: t.idx, name: t.name, score: t.score, talk: true };
  }
  const c = dealContacts().find((x) => x.idx === tid);
  if (!c) return L('그 제국과는 지금 통신이 없거나 일반 제국이 아닙니다. 연락처에서 채널을 다시 스캔해 주세요.', 'No channel with that empire right now, or it is not a regular empire. Rescan the channels in the contacts.');
  if (!ctx.actionsAllowed(tid)) return L('지금 이 제국과는 게임 행동을 할 수 없습니다.', 'Game actions are not possible with this empire right now.');
  const talk = chat.talk?.idx === tid;
  return { tid, name: c.name, score: talk && chat.talk ? chat.talk.score : c.score, talk };
}
/** 집무실 「외교 거래」 왼쪽 목록: 통신 중인 일반 제국 + 갈고리·빚·약속 표시. */
function dealList() {
  const sid = ctx.curSaveId, e = sid ? entry(sid) : blank();
  const items = dealContacts().map((c) => ({
    tid: c.idx, name: c.name, score: c.score, hook: !!e.hooks[String(c.idx)], owed: e.owed.includes(c.idx),
    deals: e.agreements.filter((a) => a.tid === c.idx && !a.done).length, war: !!c.em?.war, rival: !!c.em?.rival,
  }));
  return { ok: !!sid, running: !!ctx.gameRunning, items, cta: e.cta.map((c) => ({ tid: c.tid, name: c.name, asked: c.asked })) };
}
function view(o: Open | null, extra: Record<string, unknown> = {}) {
  const sid = ctx.curSaveId, e = sid ? entry(sid) : blank();
  const cta = e.cta.map((c) => ({ tid: c.tid, name: c.name, asked: c.asked }));
  if (!o) return { ok: false, cta, ...extra };
  const hook = e.hooks[String(o.tid)] ?? null;
  return {
    ok: true, tid: o.tid, name: o.name, us: usName(), score: o.talk && chat.talk?.idx === o.tid ? chat.talk.score : o.score, talk: o.talk, year: yearNow() ?? null,
    ctx: o.c, hook: hook ? hook.key : null, owed: e.owed.includes(o.tid), nag: e.asks[o.tid + ':' + monthKey()] ?? 0,
    res: DEAL_RES.map((r) => ({ key: r, name: resName(r), value: DEAL.value[r] })), limits: { incomeShare: DEAL.incomeShare, maxMonths: DEAL.maxMonths, maxItems: DEAL.maxItems, maxNapYears: DEAL.maxNapYears },
    agreements: e.agreements.filter((a) => a.tid === o.tid && !a.done).map((a) => ({ id: a.id, since: a.since, monthly: a.monthly.filter((m) => m.left > 0).map((m) => ({ text: L(`${m.payUs ? usName() : o.name} → 매달 ${resName(m.res)} ${m.amt} (남은 ${m.left}개월${m.miss ? `, 미납 ${m.miss}` : ''})`, `${m.payUs ? usName() : o.name} → ${m.amt} ${resName(m.res)} a month (${m.left} months left${m.miss ? `, ${m.miss} missed` : ''})`), payUs: m.payUs })), nap: a.nap.map((n) => L(`${n.by === 'us' ? usName() : o.name}의 불가침 약속 ~${n.until}`, `${n.by === 'us' ? usName() : o.name} promised not to attack until ${n.until}`)).concat(a.waive ? [L(`서로 영유권 포기 ~${a.waive.until}`, `Claims renounced by both until ${a.waive.until}`)] : []) })),
    aid: aidViewFor(o.tid, o.c.us.income), // 물자 지원(2026-10-28)
    marry: marryView(o.tid), // 정략결혼(2026-10-28)
    renames: sid ? restorable(renamesOf(sid), o.tid).map((r) => ({ id: r.id, what: r.what, old: r.old, name: r.name, date: r.date })) : [], // 돌려줄 수 있는 이름(2026-11-04)
    cta, ...extra,
  };
}
/** 「이름 반환」 항목을 장부와 맞춘다: 있으면 원래 이름을 장부 것으로 바꾸고, 없으면 까닭 코드. */
function checkRestore(items: DealItem[], tid: number): string[] {
  const sid = ctx.curSaveId, can = sid ? restorable(renamesOf(sid), tid) : [], err: string[] = [];
  for (const it of items) if (it.k === 'restore') { const r = can.find((x) => x.id === it.rid && x.what === it.what); if (r) it.name = r.old; else err.push('restore_none'); }
  return err;
}
function preview(items: DealItem[], useHook: boolean) {
  if (!open) return { errors: [L('거래판을 다시 여세요.', 'Reopen the deal board.')], p: 0, parts: null, balance: null };
  const e = ctx.curSaveId ? entry(ctx.curSaveId) : blank(), hook = useHook && !!e.hooks[String(open.tid)];
  const errors = [...validateDeal(items, open.c), ...checkRestore(items, open.tid)].map((c) => dealErrorText(c, L, resName));
  const score = open.talk && chat.talk?.idx === open.tid ? chat.talk.score : open.score;
  const o = dealOdds(items, open.c, { score, year: yearNow(), hook, nag: e.asks[open.tid + ':' + monthKey()] ?? 0 });
  return { errors, p: o.p, parts: o.parts, balance: dealBalance(items, yearNow()), lines: items.map((it) => itemText(it, L, usName(), open!.name)) };
}

async function propose(raw: unknown, useHook: boolean): Promise<Record<string, unknown>> {
  const sid = ctx.curSaveId, o = open, t = o?.talk ? chat.talk : null;
  if (!sid || !o || (o.talk && (!t || t.idx !== o.tid))) return { ok: false, error: L('통신 상대가 바뀌었습니다. 거래판을 다시 여세요.', 'The channel changed. Reopen the deal board.') };
  if (t && chat.busy) return { ok: false, error: L('상대의 답변을 기다려 주세요.', 'Please wait for their reply.') };
  const items = sanitizeItems(raw);
  const fresh = await readCtx(o.tid).catch(() => null); // 제안 직전에 다시 읽는다(창고가 바뀌었을 수 있음)
  if (!fresh || ctx.curSaveId !== sid) return { ok: false, error: L('게임에서 상대 정보를 읽지 못했습니다.', 'Could not read the empire from the game.') };
  open = { ...o, c: fresh };
  const errs = [...validateDeal(items, fresh), ...checkRestore(items, o.tid)];
  if (errs.length) return { ok: false, error: errs.map((c) => dealErrorText(c, L, resName)).join(' ') };
  const e = entry(sid), nagKey = o.tid + ':' + monthKey(), hook = useHook && !!e.hooks[String(o.tid)];
  const odds = dealOdds(items, fresh, { score: t ? t.score : o.score, year: yearNow(), hook, nag: e.asks[nagKey] ?? 0 });
  const accepted = rollDeal(odds.p);
  e.asks[nagKey] = (e.asks[nagKey] ?? 0) + 1;
  for (const k of Object.keys(e.asks)) if (!k.endsWith(':' + monthKey())) delete e.asks[k]; // 지난 달 기록은 버린다
  if (hook) delete e.hooks[String(o.tid)];
  save();
  logDiagnostic('info', 'deals.proposed', { tid: o.tid, p: odds.p, accepted, items: items.length, hook });
  // AI 의 한마디(결과는 이미 정해짐). 집무실 목록에서 연 거래판(통신 없음)은 AI 를 부르지 않는다.
  let say = '';
  if (t) { chat.busy = true;
  try {
    const text = SYSTEM_PREFIX + dealPromptText(items, accepted, odds.parts, hook);
    const raw2 = await ctx.ai.chat(buildMessages(t, chat.history, text), { maxTokens: 1200, conversationId: `diplomacy:${sid}:${o.tid}:${chat.session}` });
    if (ctx.curSaveId === sid && chat.talk?.idx === o.tid) { chat.history.push({ role: 'user', content: text }, { role: 'assistant', content: raw2 }); say = parseReply(raw2).say; chat.lastSay = say; }
  } catch (err) { logDiagnostic('warn', 'deals.ai_failed', { error: (err as Error).message }); }
  finally { chat.busy = false; } }
  const lines = items.map((it) => itemText(it, L, usName(), o.name)), summary = lines.join(', ');
  if (!accepted) {
    chronNote(o.tid, L(`우리의 거래 제안(${summary})을 거절했다`, `Refused our deal (${summary})`));
    if (items.some((it) => it.k === 'join_war') && fresh.ally) { // 동맹이 참전 요청을 거절 → 신문
      chronNoteWorld(L(`${ctx.gameDate} ${o.name}이(가) 동맹 ${usName()}의 참전 요청을 거절함`, `${ctx.gameDate} ${o.name} refused its ally ${usName()}'s call to arms`), true);
      chronNote(o.tid, L('동맹의 의무를 저버리고 우리의 참전 요청을 거절했다', 'Turned its back on our alliance and refused our call to arms'));
    }
    if (items.some((it) => it.k === 'rename')) chronNote(o.tid, L('우리의 개명 요구를 모욕으로 받아들이고 거절했다', 'Took our demand to rename their capital as an insult and refused'));
    if (items.some((it) => it.k === 'cede' && it.from === 'them')) chronNote(o.tid, L('우리 영토를 내놓으라는 요구를 단호히 거절했다', 'Flatly refused their demand that we hand over our territory'));
    return { ok: true, accepted: false, p: odds.p, say, results: [] };
  }
  // 적용
  const results: string[] = [];
  const once = items.some((it) => it.k === 'res' || it.k === 'rivalry' || it.k === 'join_war' || it.k === 'waive');
  if (once) {
    const req = ++link.reqCounter;
    let st = '';
    try { const m = await terminalRequest(applyCommand(req, o.tid, items), 'DEAL', req); st = m.kv.sid === sid ? String(m.kv.status ?? '') : 'save'; } catch (err) { st = 'timeout'; }
    if (st !== 'applied' && st !== 'duplicate') {
      const why: Record<string, string> = { short: L('우리 창고가 모자라', 'our stockpile fell short'), theirshort: L('상대 창고가 모자라', 'their stockpile fell short'), target: L('상대를 찾지 못해', 'the empire was not found'), timeout: L('게임이 응답하지 않아', 'the game did not respond'), save: L('세이브가 바뀌어', 'the save changed') };
      return { ok: true, accepted: true, p: odds.p, say, results: [L(`수락했지만 ${why[st] ?? '확인하지 못해'} 거래를 실행하지 못했습니다. 아무것도 옮기지 않았습니다.`, `They accepted, but ${why[st] ?? 'it could not be confirmed, so'} the deal could not be carried out. Nothing was moved.`)] };
    }
    results.push(L('자원·경쟁 해제·참전을 게임에 반영했습니다.', 'Resources, rivalry and the call to arms were applied in the game.'));
    if (items.some((it) => it.k === 'waive')) { // 영유권 포기(2026-11-05)
      results.push(L(`서로 건 영유권을 모두 지웠습니다. ${DEAL.waive.years}년 안에 어느 쪽이든 새로 걸면 약속을 어긴 것입니다(해마다 1월에 확인).`, `All claims on each other were dropped. Any new claim by either side within ${DEAL.waive.years} years breaks the deal (checked each January).`));
      chronNote(o.tid, L(`${usName()}와(과) 서로 영유권을 거두고 ${DEAL.waive.years}년간 새로 걸지 않기로 했다`, `Agreed with ${usName()} to drop all claims on each other for ${DEAL.waive.years} years`));
      chronNoteWorld(L(`${ctx.gameDate} ${usName()}·${o.name}, 서로 영유권 포기 조약`, `${ctx.gameDate} ${usName()} and ${o.name} renounce their claims on each other`), true);
    }
  }
  if (items.some((it) => it.k === 'borders')) {
    const r = await sendAndWait((req) => diploEffect(req, o.tid, 1)).catch(() => 'timeout');
    results.push(r === 'ok' ? L('상대가 국경을 열었습니다.', 'They opened their borders.') : L(`국경 개방을 확인하지 못했습니다(${r}).`, `Could not confirm the border opening (${r}).`));
  }
  if (items.some((it) => it.k === 'peace')) { const pz = await playerPeace(o.tid, o.name); results.push(pz.text); }
  // 이름의 정치(2026-11-04): 개명 요구 → 상대 수도 행성·성계 이름을 바꾸고 원래 이름을 장부에, 상대 호감 크게 하락 + 신문 / 이름 반환 → 원래 이름으로 되돌리고 호감 회복
  for (const it of items) {
    if (it.k === 'rename') {
      const r = await gameRename({ kind: 'foreign', tid: o.tid }, it.what, it.name);
      if (!r.ok) { results.push(L(`${whatText(it.what, L)} 이름을 바꾸지 못했습니다(${r.status}).`, `Could not rename the ${whatText(it.what, L)} (${r.status}).`)); continue; }
      recordRename(sid, { tid: o.tid, empire: o.name, what: it.what, old: r.old, name: it.name, by: 'deal' }); await sendOpinion(o.tid, DEAL_MODS.humiliated);
      results.push(L(`${o.name}의 ${whatText(it.what, L)} 「${r.old || '?'}」이(가) 이제 「${it.name}」입니다.`, `${o.name}'s ${whatText(it.what, L)} "${r.old || '?'}" is now "${it.name}".`));
      chronNote(o.tid, L(`굴욕 조항에 따라 우리 ${whatText(it.what, L)} 「${r.old}」의 이름을 그들이 정한 「${it.name}」(으)로 바꾸어야 했다. 이 치욕을 잊지 않는다`, `Under a humiliating clause we had to rename our ${whatText(it.what, L)} "${r.old}" to their choice, "${it.name}". We will not forget this shame`));
      chronNoteWorld(L(`${ctx.gameDate} ${o.name}, ${usName()}의 요구로 ${whatText(it.what, L)} 「${r.old}」을(를) 「${it.name}」(으)로 개명 — 굴욕 조약`, `${ctx.gameDate} ${o.name} renames its ${whatText(it.what, L)} "${r.old}" to "${it.name}" at ${usName()}'s demand — a humiliating treaty`), true);
    } else if (it.k === 'restore') {
      const r = await gameRename({ kind: 'foreign', tid: o.tid }, it.what, it.name);
      if (!r.ok) { results.push(L(`이름을 돌려주지 못했습니다(${r.status}).`, `Could not return the name (${r.status}).`)); continue; }
      markRestored(sid, it.rid); await sendOpinion(o.tid, DEAL_MODS.restored);
      results.push(L(`${o.name}의 ${whatText(it.what, L)}이(가) 원래 이름 「${it.name}」을(를) 되찾았습니다.`, `${o.name}'s ${whatText(it.what, L)} has its original name "${it.name}" back.`));
      chronNote(o.tid, L(`빼앗겼던 우리 ${whatText(it.what, L)}의 이름 「${it.name}」을(를) 되찾았다`, `We got back the name of our ${whatText(it.what, L)}, "${it.name}"`));
      chronNoteWorld(L(`${ctx.gameDate} ${usName()}, ${o.name}에게 ${whatText(it.what, L)} 이름 「${it.name}」을(를) 돌려줌`, `${ctx.gameDate} ${usName()} returns the name "${it.name}" to ${o.name}'s ${whatText(it.what, L)}`), true);
    }
  }
  // 성계 할양(2026-11-04): 성계 하나를 통째로 옮긴다(정거장·행성·거대 구조물). 수수료 없음. 그들이 내주면 원한(굴욕), 신문 1면.
  for (const it of items) {
    if (it.k !== 'cede') continue;
    const r = await vaTransfer(o.tid, it.n, it.from === 'them' ? 'take' : 'give', 0);
    if (r !== 9) { results.push(L(`「${it.name}」 성계를 옮기지 못했습니다: `, `Could not transfer the ${it.name} system: `) + stText(r, L)); continue; }
    if (it.from === 'them') {
      await sendOpinion(o.tid, DEAL_MODS.humiliated);
      results.push(L(`${o.name}이(가) 「${it.name}」 성계를 우리에게 넘겼습니다.`, `${o.name} ceded the ${it.name} system to us.`));
      chronNote(o.tid, L(`조약에 따라 우리 「${it.name}」 성계를 ${usName()}에게 내주어야 했다. 이 땅을 반드시 되찾겠다`, `Under the treaty we had to cede our ${it.name} system to ${usName()}. We will take it back one day`));
      chronNoteWorld(L(`${ctx.gameDate} ${o.name}, ${usName()}에게 「${it.name}」 성계 할양 — 굴욕 조약`, `${ctx.gameDate} ${o.name} cedes the ${it.name} system to ${usName()} — a humiliating treaty`), true);
    } else {
      results.push(L(`우리 「${it.name}」 성계를 ${o.name}에게 넘겼습니다.`, `We ceded our ${it.name} system to ${o.name}.`));
      chronNote(o.tid, L(`${usName()}이(가) 「${it.name}」 성계를 우리에게 넘겨주었다`, `${usName()} ceded the ${it.name} system to us`));
      chronNoteWorld(L(`${ctx.gameDate} ${usName()}, ${o.name}에게 「${it.name}」 성계를 넘겨줌`, `${ctx.gameDate} ${usName()} cedes the ${it.name} system to ${o.name}`), true);
    }
  }
  const ag = agreementFrom(randomUUID().replace(/-/g, '').slice(0, 12), o.tid, o.name, ctx.gameDate || '', items, addYears);
  if (ag) {
    ag.g = nextG(e.agreements.map((a) => a.g)); e.agreements.push(ag); save();
    if (ag.monthly.length) await mtRegister(ag, false); // 정기 송금(2026-11-09): 매달 지급은 게임이 직접
    results.push(ag.monthly.length ? L('매달 지급은 게임이 매달 직접 처리하고, 약속은 앱이 지켜봅니다.', 'The game now handles the monthly payments itself; the app keeps watch over the promises.') : L('약속은 앱이 지켜봅니다.', 'The app keeps watch over the promises.'));
  }
  chronNote(o.tid, L(`거래가 성사됐다: ${summary}`, `A deal was struck: ${summary}`));
  temperPush(o.tid, TEMPER.dealStruck, ['우리와 거래를 맺음', 'struck a deal with us']);
  if (items.some((it) => it.k === 'join_war')) chronNoteWorld(L(`${ctx.gameDate} ${o.name}이(가) ${usName()}의 편으로 참전함`, `${ctx.gameDate} ${o.name} joined the war on ${usName()}'s side`), true);
  if (items.some((it) => it.k === 'monthly' && it.from === 'them') && items.some((it) => it.k === 'peace')) chronNoteWorld(L(`${ctx.gameDate} ${o.name}이(가) 조공을 약속하고 ${usName()}와(과) 강화함`, `${ctx.gameDate} ${o.name} made peace with ${usName()} and pledged tribute`), true);
  if (items.some((it) => it.k === 'monthly' && it.from === 'us') && items.some((it) => it.k === 'peace')) chronNoteWorld(L(`${ctx.gameDate} ${usName()}이(가) 조공을 약속하고 ${o.name}와(과) 강화함`, `${ctx.gameDate} ${usName()} made peace with ${o.name} and pledged tribute`), true);
  return { ok: true, accepted: true, p: odds.p, say, results };
}

// ---- 약속 파기 ----
async function breach(ag: Agreement, by: 'us' | 'them', what: string): Promise<void> {
  const sid = ctx.curSaveId; if (!sid) return;
  ag.broken = by; ag.done = true;
  if (ag.g && ag.monthly.some((m) => m.left > 0 && !m.legacy)) void mtUnset(ag.tid, ag.g, MT_OWNER.deal); // 정기 송금 칸도 지운다(모드가 끊은 경우엔 이미 비어 있음)
  if (by === 'us') {
    const e = entry(sid); if (!e.owed.includes(ag.tid)) e.owed.push(ag.tid);
    await sendOpinion(ag.tid, DEAL_MODS.broken);
    temperPush(ag.tid, TEMPER.dealBroken, ['우리가 거래 약속을 어김', 'we broke our word on a deal']);
    chronNote(ag.tid, L(`우리가 거래의 약속을 어겼다(${what})`, `We broke our word on a deal (${what})`));
    chronNoteWorld(L(`${ctx.gameDate} ${usName()}이(가) ${ag.name}와(과)의 약속을 어김(${what})`, `${ctx.gameDate} ${usName()} broke its word to ${ag.name} (${what})`), true);
    ctx.notify({ kind: 'event', title: L(`${ag.name}와(과)의 약속을 어겼습니다`, `We broke our word to ${ag.name}`), body: L(`${what} — 상대 호감 -50, 신문에 실리고 상대가 이 일을 약점으로 쥡니다.`, `${what} — their opinion -50, it will be in the papers, and they hold it over us.`) });
  } else {
    chronNote(ag.tid, L(`상대가 거래의 약속을 어겼다(${what})`, `They broke their word on a deal (${what})`));
    chronNoteWorld(L(`${ctx.gameDate} ${ag.name}이(가) ${usName()}와(과)의 약속을 어김(${what})`, `${ctx.gameDate} ${ag.name} broke its word to ${usName()} (${what})`), true);
    ctx.notify({ kind: 'event', title: L(`${ag.name}이(가) 약속을 어겼습니다`, `${ag.name} broke its word`), body: what });
  }
  save();
}
/** 플레이어가 매달 지급을 직접 끊음 = 우리가 어김. */
async function cancel(id: string): Promise<Record<string, unknown>> {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const ag = entry(sid).agreements.find((a) => a.id === id && !a.done); if (!ag) return { ok: false, error: L('그 약속을 찾지 못했습니다.', 'That agreement was not found.') };
  const ours = ag.monthly.some((m) => m.payUs && m.left > 0) || ag.nap.some((n) => n.by === 'us');
  if (!ours) { ag.done = true; save(); if (ag.g) void mtUnset(ag.tid, ag.g, MT_OWNER.deal); return { ok: true }; } // 우리가 낼 것이 없으면 그냥 정리
  await breach(ag, 'us', L('매달 지급을 끊음', 'stopped the monthly payments'));
  return { ok: true };
}

// ---- 매달 ----
let lastMonth = '', monthBusy = false;
async function monthly(sid: string, date: string): Promise<void> {
  const mk = sid + ':' + monthKey(date);
  if (monthBusy || mk === lastMonth || sid !== ctx.curSaveId || !ctx.gameRunning) return;
  lastMonth = mk; monthBusy = true;
  try {
    const e = entry(sid);
    for (const ag of e.agreements.filter((a) => !a.done)) {
      // 매달 지급(2026-11-09): 모드가 정기 송금 칸으로 직접 보낸다. 이번 세션에 아직 안 적었으면 한 번 적는다(옛 거래·불러온 세이브 — 이미 있으면 그대로 둠).
      if (!ag.reg && ag.monthly.some((m) => m.left > 0 && !m.legacy)) await mtRegister(ag, true, !!ag.chk);
      Object.assign(ag, mtStep(ag, monthKey(date)));
      // 모드 칸이 모자란 지급(legacy)만 예전처럼 앱이 매달 보낸다
      if (ag.monthly.some((m) => m.legacy && m.left > 0)) {
        const results: Array<string | undefined> = [];
        for (const m of ag.monthly) {
          if (m.left <= 0 || !m.legacy) { results.push(undefined); continue; }
          const req = ++link.reqCounter;
          try { const r = await terminalRequest(payCommand(req, ag.tid, m.payUs, m.res, m.amt), 'DEAL', req); results.push(r.kv.sid === sid ? String(r.kv.status) : undefined); }
          catch { results.push(undefined); }
        }
        const step = monthStep(ag, results);
        Object.assign(ag, step.ag);
        if (step.breach) { await breach(ag, step.breach, L('두 달 연속 매달 지급을 내지 못함', 'missed the monthly payment two months running')); continue; }
      }
      if (ag.done) continue;
      // 불가침
      const w = (gameState.last?.sid === sid ? gameState.last.wars : []).find((x) => (x.side === 'att' ? x.defender : x.attacker) === ag.name);
      const by = napBreach(ag, w ? { weAttacked: w.side === 'att' } : null, date, cmpDate);
      if (by) { await breach(ag, by, L('불가침 약속을 깨고 전쟁을 시작함', 'broke the non-aggression promise and started a war')); continue; }
      Object.assign(ag, pruneNap(ag, date, cmpDate));
      // 영유권 포기(2026-11-05): 해마다 1월에만 게임에 묻는다(새로 건 영유권이 있나)
      if (ag.waive && date.slice(5, 7) === '01') {
        const c = await readCtx(ag.tid).catch(() => null);
        const wb = waiveBreach(ag, c, date, cmpDate);
        if (wb) { await breach(ag, wb, L('영유권 포기 약속을 깨고 다시 영유권을 걸었음', 'broke the promise to renounce claims and laid new claims')); continue; }
      }
      const pw = pruneWaive(ag, date, cmpDate); if (!pw.waive) delete ag.waive;
      if (ag.monthly.every((m) => m.left <= 0) && !ag.nap.length && !ag.waive) ag.done = true;
    }
    e.agreements = e.agreements.filter((a) => !a.done || cmpDate(date, addYears(a.since, 5)) < 0).slice(-50);
    // 참전 요청: 두 달 넘게 답하지 않은 것은 거절로 본다
    for (const c of [...e.cta]) if (cmpDate(date, addMonths(c.asked, DEAL.ctaAnswerMonths)) >= 0) await answerCta(c.tid, false, true);
    // 동맹의 방어 전쟁 — 매달 상황 조사가 「해당 없음(al=0)」이라 하면 묻지 않는다(2026-10-27 최적화). 옛 모드(al 없음)면 예전처럼 묻는다.
    const aw = gameState.last?.sid === sid ? gameState.last.allyWar : undefined;
    if (aw === false) { for (const t of Object.keys(e.ctaSeen)) delete e.ctaSeen[t]; save(); return; } // 동맹 방어 전쟁이 없음 = 다음 전쟁에 다시 요청할 수 있다
    // 2026-11-09: 월간 상황 조사가 동맹 번호를 같이 보낸다(STALLY) — 그 줄이 있으면 게임에 따로 묻지 않는다. 없으면(옛 모드) 예전처럼 묻는다.
    const rows = allyScan.sid === sid && allyScan.set.size ? allyScan.set : null;
    const req = rows ? 0 : ++link.reqCounter, k = String(req); if (!rows) awRows.set(k, []);
    try {
      const m = rows ? null : await terminalRequest(allyWarCommand(req), 'DEALAWEND', req);
      if (rows || m?.kv.sid === sid) {
        const now = new Set(rows ?? awRows.get(k) ?? []);
        for (const tid of now) {
          if (e.cta.some((c) => c.tid === tid) || e.ctaSeen[String(tid)]) continue; // 같은 전쟁 동안 한 번만
          const name = nameOf(tid); e.cta.push({ tid, name, asked: date }); e.ctaSeen[String(tid)] = date;
          ctx.notify({ kind: 'event', title: L(`${name}이(가) 참전을 요청합니다`, `${name} calls us to arms`), body: L('동맹이 방어 전쟁 중입니다. 집무실 「외교 거래」에서 답하세요(두 달 안에 답하지 않으면 거절로 봅니다).', 'Our ally is fighting a defensive war. Answer in the office Diplomatic Deals app (no answer within two months counts as a refusal).') });
        }
        for (const t of Object.keys(e.ctaSeen)) if (!now.has(Number(t))) delete e.ctaSeen[t]; // 전쟁이 끝나면 다음 전쟁에 다시 요청할 수 있다
      }
    } catch (err) { logDiagnostic('warn', 'deals.allywar_failed', { error: (err as Error).message }); }
    finally { if (!rows) awRows.delete(k); }
    save();
  } finally { monthBusy = false; }
}
/** 정기 송금 칸 적기(2026-11-09). keep = 이미 있으면 그대로(불러온 세이브의 남은 달을 믿음). 응답이 없으면 reg 를 세우지 않아 다음 달 다시.
 *  check = 세이브를 불러온 뒤 확인만: 게임에 칸이 없으면 다시 만들지 않고 그 지급은 끝난 것으로 본다(앱이 꺼져 있던 동안 모드가 끝냈거나 끊음 — 사용자 결정 2026-11-09 「게임을 믿고 끝냄」). */
async function mtRegister(ag: Agreement, keep: boolean, check = false): Promise<void> {
  const sid = ctx.curSaveId; if (!sid) return;
  if (!ag.g) ag.g = nextG(entry(sid).agreements.map((a) => a.g));
  let ok = true;
  for (const m of ag.monthly) {
    if (m.left <= 0 || m.legacy) continue;
    const r = await mtSet({ tid: ag.tid, res: m.res, payUs: m.payUs, amt: m.amt, left: Math.min(1200, m.left), g: ag.g, o: MT_OWNER.deal }, keep, check);
    if (r === 'full') m.legacy = true; else if (r === 'fail') ok = false;
    else if (r === 'missing') { logDiagnostic('info', 'deals.transfer_missing', { tid: ag.tid, g: ag.g, res: m.res, left: m.left }); m.left = 0; }
  }
  ag.reg = ok; if (ok) delete ag.chk;
  if (ok && check && ag.monthly.every((x) => x.left <= 0) && !ag.nap.length && !ag.waive) ag.done = true;
  save();
}
/** 모드의 정기 송금 사건(o = 외교 거래): 못 냄 → 장부에 표시 · 끊김(두 달 연속) → 낸 쪽이 약속을 어김 · 다 냄 → 끝. */
function onMt(ev: MtEvent): void {
  const sid = ctx.curSaveId; if (!sid || (ev.sid && ev.sid !== sid)) return;
  const ag = entry(sid).agreements.find((a) => a.g === ev.g && a.tid === ev.tid && !a.done); if (!ag) return;
  const m = ag.monthly.find((x) => x.res === ev.res && x.payUs === ev.payUs && !x.legacy && x.left > 0);
  if (ev.ev === 'end') { if (m) m.left = 0; if (ag.monthly.every((x) => x.left <= 0) && !ag.nap.length && !ag.waive) ag.done = true; save(); return; }
  if (ev.ev === 'short') { if (m) { m.miss = ev.miss; m.sm = monthKey(ev.date || ctx.gameDate || ''); save(); } return; }
  void breach(ag, ev.payUs ? 'us' : 'them', L('두 달 연속 매달 지급을 내지 못함', 'missed the monthly payment two months running'));
}
/** 이번 달 월간 상황 조사의 동맹 방어 전쟁 번호(STALLY, 2026-11-09). STATE_BEGIN 때 비운다. */
let allyScan: { sid: string; set: Set<number> } = { sid: '', set: new Set() };
async function answerCta(tid: number, accept: boolean, timedOut = false): Promise<Record<string, unknown>> {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const e = entry(sid), c = e.cta.find((x) => x.tid === tid); if (!c) return { ok: false, error: L('그 요청을 찾지 못했습니다.', 'That request was not found.') };
  e.cta = e.cta.filter((x) => x.tid !== tid); save();
  if (accept) {
    const req = ++link.reqCounter;
    let st = '';
    try { const m = await terminalRequest(joinCommand(req, tid), 'DEAL', req); st = String(m.kv.status ?? ''); } catch { st = 'timeout'; }
    if (st === 'applied' || st === 'duplicate') {
      chronNote(tid, L('동맹의 요청에 응해 그들의 전쟁에 참전했다', 'Answered our ally\'s call and joined their war'));
      chronNoteWorld(L(`${ctx.gameDate} ${usName()}이(가) 동맹 ${c.name}의 편으로 참전함`, `${ctx.gameDate} ${usName()} joined the war on its ally ${c.name}'s side`), true);
      return { ok: true, text: L(`${c.name}의 편으로 참전했습니다.`, `Joined the war on ${c.name}'s side.`) };
    }
    return { ok: false, error: L('참전하지 못했습니다(전쟁이 이미 끝났을 수 있습니다).', 'Could not join (the war may already be over).') };
  }
  await sendOpinion(tid, DEAL_MODS.ctaRefused);
  chronNote(tid, timedOut ? L('참전 요청에 끝내 답하지 않았다', 'Never answered their call to arms') : L('동맹의 참전 요청을 거절했다', 'Refused our ally\'s call to arms'));
  chronNoteWorld(L(`${ctx.gameDate} ${usName()}이(가) 동맹 ${c.name}의 참전 요청을 ${timedOut ? '외면함' : '거절함'}`, `${ctx.gameDate} ${usName()} ${timedOut ? 'ignored' : 'refused'} its ally ${c.name}'s call to arms`), true);
  if (timedOut) ctx.notify({ kind: 'event', title: L(`${c.name}의 참전 요청을 외면했습니다`, `We ignored ${c.name}'s call to arms`), body: L('두 달 동안 답하지 않아 거절로 처리했습니다(호감 -30, 신문 보도).', 'Two months without an answer counts as a refusal (opinion -30, in the papers).') });
  return { ok: true, text: L(`${c.name}의 참전 요청을 거절했습니다(호감 -30, 신문 보도).`, `Refused ${c.name}'s call to arms (opinion -30, in the papers).`) };
}

// ---- 정략결혼(2026-10-28 정치): 성인 자녀 + (원하면) 지참금 에너지. 확률 = 외교 거래 확률(지참금이 저울) + 10, 경쟁국이면 -20.
const dowryItems = (dowry: number): DealItem[] => (dowry > 0 ? [{ k: 'res', res: 'energy', amt: dowry, from: 'us' }] : []);
function marryOdds(o: Open, dowry: number): { p: number; errors: string[] } {
  const e = ctx.curSaveId ? entry(ctx.curSaveId) : blank(), items = dowryItems(dowry);
  const errors = items.length ? validateDeal(items, o.c).map((c) => dealErrorText(c, L, resName)) : [];
  const score = o.talk && chat.talk?.idx === o.tid ? chat.talk.score : o.score;
  const base = dealOdds(items, o.c, { score, year: yearNow(), nag: e.asks[o.tid + ':' + monthKey()] ?? 0 }).p;
  return { p: Math.max(DEAL.minP, Math.min(DEAL.maxP, base + marryBonus(o.c.rival))), errors };
}
async function proposeMarriage(cid: string, dowryIn: number, sendLeader: boolean): Promise<Record<string, unknown>> {
  const sid = ctx.curSaveId, o = open, t = o?.talk ? chat.talk : null;
  if (!sid || !o || (o.talk && (!t || t.idx !== o.tid))) return { ok: false, error: L('거래판을 다시 여세요.', 'Reopen the deal board.') };
  if (t && chat.busy) return { ok: false, error: L('상대의 답변을 기다려 주세요.', 'Please wait for their reply.') };
  const dowry = Math.max(0, Math.min(MARRY.maxDowry, Math.floor(Number(dowryIn) || 0)));
  const fresh = await readCtx(o.tid).catch(() => null);
  if (!fresh || ctx.curSaveId !== sid) return { ok: false, error: L('게임에서 상대 정보를 읽지 못했습니다.', 'Could not read the empire from the game.') };
  open = { ...o, c: fresh };
  const errs = marryCheck(o.tid, cid, fresh.war); if (errs.length) return { ok: false, error: marryErrText(errs) };
  const odds = marryOdds(open, dowry); if (odds.errors.length) return { ok: false, error: odds.errors.join(' ') };
  const accepted = rollDeal(odds.p);
  const e = entry(sid), nagKey = o.tid + ':' + monthKey(); e.asks[nagKey] = (e.asks[nagKey] ?? 0) + 1; save();
  const kid = (marryView(o.tid)?.kids ?? []).find((k) => k.id === cid);
  logDiagnostic('info', 'deals.marriage', { tid: o.tid, p: odds.p, accepted, dowry });
  let say = '';
  if (t) { chat.busy = true;
    try {
      const text = SYSTEM_PREFIX + `[Marriage proposal] The ruler you are talking to proposes a marriage between their ${kid?.gender === 'f' ? 'daughter' : 'son'} ${kid?.name ?? ''} and a member of your ruling house${dowry ? `, with a dowry of ${dowry} energy` : ''}. Your council has weighed it and the decision is final: you ${accepted ? 'ACCEPT' : 'REFUSE'} the match. Answer in character in at most two sentences, stating the decision clearly. Do not add new conditions. Use action type none and mood none.`;
      const raw2 = await ctx.ai.chat(buildMessages(t, chat.history, text), { maxTokens: 1200, conversationId: `diplomacy:${sid}:${o.tid}:${chat.session}` });
      if (ctx.curSaveId === sid && chat.talk?.idx === o.tid) { chat.history.push({ role: 'user', content: text }, { role: 'assistant', content: raw2 }); say = parseReply(raw2).say; chat.lastSay = say; }
    } catch (err) { logDiagnostic('warn', 'deals.ai_failed', { error: (err as Error).message }); }
    finally { chat.busy = false; } }
  if (!accepted) { chronNote(o.tid, L(`${usName()}의 혼인 제안(${kid?.name ?? ''})을 거절했다`, `Refused ${usName()}'s marriage proposal (${kid?.name ?? ''})`)); return { ok: true, accepted: false, p: odds.p, say, results: [] }; }
  const results: string[] = [];
  if (dowry) {
    const req = ++link.reqCounter; let st = '';
    try { const m = await terminalRequest(applyCommand(req, o.tid, dowryItems(dowry)), 'DEAL', req); st = m.kv.sid === sid ? String(m.kv.status ?? '') : 'save'; } catch { st = 'timeout'; }
    if (st !== 'applied' && st !== 'duplicate') return { ok: true, accepted: true, p: odds.p, say, results: [L('혼인은 받아들여졌지만 지참금을 보내지 못해 혼인을 미뤘습니다. 아무것도 옮기지 않았습니다.', 'The match was accepted, but the dowry could not be sent, so the wedding was put off. Nothing was moved.')] };
    results.push(L(`지참금 에너지 ${dowry}을(를) 보냈습니다.`, `Sent a dowry of ${dowry} energy.`));
  }
  results.push(...await marryDone(o.tid, o.name, cid, sendLeader));
  return { ok: true, accepted: true, p: odds.p, say, results };
}

export function registerDeals(router: LogRouter): void {
  setDealHooks({ owed: dealOwed, refused: onOwedDemandRefused, secret: noteSecretHook }); // chat·embassy-app 이 이 칸으로 부른다(가져오기 고리 방지)
  router.on(SLOT.DEALS, 'deals', (m: SllmMessage) => {
    if (m.kind === 'STATE_BEGIN') { allyScan = { sid: String(m.kv.sid ?? '').replace(/^\\/, ''), set: new Set() }; return; }
    if (m.kind === 'STALLY') { const i = Number(String(m.kv.idx ?? '').replace(/^\\/, '')); if (Number.isSafeInteger(i) && i > 0 && allyScan.set.size < 30) allyScan.set.add(i); return; }
    if (m.kind === 'LOADED') { const sid = String(m.kv.sid ?? '').replace(/^\\/, ''); if (sid) { let n = 0; for (const a of entry(sid).agreements) if (!a.done && a.reg) { a.reg = false; a.chk = true; n++; } if (n) save(); } return; } // 불러오면 정기 송금 칸을 다음 달 다시 확인
    if (m.kind === 'DEALX') dealX.set(String(m.kv.req), m.kv);
    else if (m.kind === 'DEALAW') { const l = awRows.get(String(m.kv.req)), i = Number(m.kv.idx); if (l && Number.isSafeInteger(i) && i > 0 && l.length < 30) l.push(i); }
    else if (m.kind === 'DEALCTX' || m.kind === 'DEAL' || m.kind === 'DEALAWEND') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
  onGameSnapshot((snap) => { if (snap.sid) void monthly(snap.sid, snap.date || ctx.gameDate || '').catch((e) => logDiagnostic('warn', 'deals.monthly_failed', { error: String(e) })); }, 'deals');
  mtSubscribe(router, MT_OWNER.deal, onMt); // 정기 송금 사건(2026-11-09)
  ipcMain.handle('dealList', async () => dealList());
  ipcMain.handle('dealOpen', async (_e, tid?: unknown) => {
    const who = canDeal(Number.isSafeInteger(tid) && (tid as number) > 0 ? tid as number : undefined);
    if (typeof who === 'string') { open = null; return view(null, { error: who }); }
    try { const c = await readCtx(who.tid); if (!c) { open = null; return view(null, { error: L('게임에서 상대 정보를 읽지 못했습니다.', 'Could not read the empire from the game.') }); } open = { ...who, c, date: ctx.gameDate || '' }; await aidProbe(who.tid).catch(() => {}); return view(open); }
    catch (e) { open = null; return view(null, { error: (e as Error).message }); }
  });
  ipcMain.handle('dealPreview', async (_e, items: unknown, useHook: boolean) => preview(sanitizeItems(items), !!useHook));
  ipcMain.handle('dealPropose', async (_e, items: unknown, useHook: boolean) => {
    try { const r = await propose(items, !!useHook); if (r.ok && r.say) ctx.toUi('kbchat', { ai: r.say as string }); return { ...r, view: view(open) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('dealCancel', async (_e, id: string) => { const r = await cancel(String(id)); return { ...r, view: view(open) }; });
  ipcMain.handle('dealCta', async (_e, tid: number, accept: boolean) => { const r = await answerCta(Number(tid), !!accept); return { ...r, view: view(open) }; });
  ipcMain.handle('dealMarryOdds', (_e, cid: unknown, dowry: unknown) => {
    if (!open) return { p: 0, errors: [L('거래판을 다시 여세요.', 'Reopen the deal board.')] };
    const errs = marryCheck(open.tid, String(cid ?? ''), open.c.war); const o = marryOdds(open, Math.max(0, Math.floor(Number(dowry) || 0)));
    return { p: o.p, errors: [...(errs.length ? [marryErrText(errs)] : []), ...o.errors] };
  });
  ipcMain.handle('dealMarry', async (_e, cid: unknown, dowry: unknown, sendLeader: unknown) => {
    try { const r = await proposeMarriage(String(cid ?? ''), Number(dowry) || 0, !!sendLeader); if (r.ok && r.say) ctx.toUi('kbchat', { ai: r.say as string }); return { ...r, view: view(open) }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  // 물자 지원(2026-10-28): 거래판의 「물자 지원」과, 참전 요청에 물자 지원으로 답하기(거절 감점 -30 → -10).
  hoiHooks.income = async (tid) => { const c = await readCtx(tid); return c ? c.us.income : null; };
  ipcMain.handle('dealAid', async (_e, res: unknown, amt: unknown, years: unknown) => {
    if (!open) return { ok: false, error: L('거래판을 다시 여세요.', 'Reopen the deal board.') };
    const r = await startAid(open.tid, String(res) as DealRes, Math.floor(Number(amt)), Math.floor(Number(years)));
    return { ...r, view: view(open) };
  });
  ipcMain.handle('dealCtaAid', async (_e, tidIn: unknown) => {
    const sid = ctx.curSaveId, tid = Number(tidIn); if (!sid) return { ok: false };
    const e = entry(sid), c = e.cta.find((x) => x.tid === tid); if (!c) return { ok: false, error: L('그 요청을 찾지 못했습니다.', 'That request was not found.') };
    const plan = await ctaAidPlan(tid); if (!plan) return { ok: false, error: L('게임에서 사정을 읽지 못했습니다.', 'Could not read the situation from the game.') };
    const r = await startAid(tid, plan.res, plan.amt, plan.years, 'cta'); if (!r.ok) return { ...r, view: view(open) };
    e.cta = e.cta.filter((x) => x.tid !== tid); save();
    await sendOpinion(tid, ctaAidMod);
    chronNote(tid, L('참전 요청에 참전 대신 물자 지원으로 답했다', 'Answered our call to arms with supplies instead of troops'));
    chronNoteWorld(L(`${ctx.gameDate} ${usName()}이(가) 동맹 ${c.name}의 참전 요청에 물자 지원으로 답함`, `${ctx.gameDate} ${usName()} answered its ally ${c.name}'s call to arms with supplies`), true);
    return { ok: true, text: L(`참전 대신 물자 지원으로 답했습니다: ${RES_NAME[plan.res][0]} 매달 ${plan.amt}, ${plan.years}년(호감 -10, 지원 +30).`, `Answered with supplies instead of troops: ${plan.amt} ${RES_NAME[plan.res][1]} a month for ${plan.years} years (opinion -10, aid +30).`), view: view(open) };
  });
}
