// 성간 임시회의 과제 연결(다음 업데이트, 2026-10-26). 규칙·수치: src/isc-quest.ts. 회의: src/features/isc-app.ts(「회의 종료」에서 offerAtClose).
// 흐름: 회의 종료 → 주제에 가장 관련 깊은 참석 통치자가 과제 1개 제안(LLM 1회) → 플레이어 수락/거절 → 매달 게임에서 재서 판정 →
//   성공: 보상(퀘스트 효과 엔진) + 그 제국 호감 +15 / 실패: 불이익 + 호감 −15. 자원 건네기는 수락 즉시 건네고 바로 성공.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link, enqueue, sendBatch, sendConsole } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { chronNote } from './chronicle-app';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { cmpDate, addMonths } from '../gamedate';
import { opinionShiftEffects, type SllmMessage } from '../protocol';
import { questApplyCommand, freeQuestSlot } from '../quest-effects';
import type { IscMeeting, IscSeatRow } from '../interstellar-council';
import { relevanceOf } from '../interstellar-council';
import { frontierFor } from './frontier-app'; // 국경·전선(2026-10-26)
import { frontierTag } from '../frontier';
import { type IscQuest, type QuestMeasure, type Target, ISCQ, canOffer, activeQuests, pickGiver, questMessages, parseQuestReply, fillTargets, judge, goalText, fxText, planOf, dueOf, offerUntilOf, measureCommand, parseQuestMeasure, giftCommand, sanitizeQuests, goalValue, chainOf, logNum, monthsLeft, freeLogSlot, logBeginCommand, logUpdateCommand, watchCommand, parseWatch } from '../isc-quest';

const file = () => path.join(app.getPath('userData'), 'sllm_isc_quests.json');
let store: Record<string, IscQuest[]> | null = null;
function all(): Record<string, IscQuest[]> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, unknown>)) store[k] = sanitizeQuests(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'isc_quests', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'isc_quests', error: e }); } }
const quests = (sid: string): IscQuest[] => (all()[safeKey(sid)] ??= []);
const yearNow = (): number | undefined => { const y = parseInt(String(ctx.gameDate || ''), 10); return Number.isFinite(y) ? y : undefined; };
let pushUi: () => void = () => {};
/** 회의 창 갱신(isc-app 이 건다 — 서로 가져오지 않게). */
export function setQuestPush(fn: () => void): void { pushUi = fn; }

// ---- 게임 측정
const rowsOf = new Map<string, Array<Record<string, string>>>();
async function measure(idxs: number[]): Promise<QuestMeasure> {
  const sid = ctx.curSaveId, req = ++link.reqCounter, key = String(req); rowsOf.set(key, []);
  try {
    const end = await terminalRequest(measureCommand(req, sid, idxs), 'ISCQM', req);
    if (end.kv.sid !== sid || ctx.curSaveId !== sid) throw new Error(L('세이브가 바뀌었습니다.', 'The save changed.'));
    return parseQuestMeasure(end.kv, rowsOf.get(key) ?? []);
  } finally { rowsOf.delete(key); }
}

// ---- 화면
function qView(q: IscQuest, m?: QuestMeasure | null) {
  const y = yearNow();
  return { id: q.id, state: q.state, title: q.title, say: q.say, giver: q.giver, topic: q.topic, goal: goalText(q.goal), goalType: q.goal.type,
    reward: fxText(q.fx, 'reward', y), penalty: fxText(q.fx, 'penalty', y), offeredOn: q.offeredOn, offerUntil: q.offerUntil, acceptedOn: q.acceptedOn ?? '', due: q.due ?? '', endedOn: q.endedOn ?? '',
    now: m ? goalValue(q.goal, m) : (q.last ?? null), opSuccess: ISCQ.opSuccess, opFail: ISCQ.opFail };
}
export function questView() {
  const sid = ctx.curSaveId; if (!sid) return { offer: null, active: [], done: [], max: ISCQ.maxActive };
  const qs = quests(sid), today = ctx.gameDate || '';
  const offer = qs.filter((q) => q.state === 'offered' && (!today || cmpDate(today, q.offerUntil) < 0)).slice(-1)[0] ?? null;
  return { offer: offer ? qView(offer) : null, active: activeQuests(qs).map((q) => qView(q)), done: qs.filter((q) => ['success', 'failed'].includes(q.state)).slice(-5).reverse().map((q) => qView(q)), max: ISCQ.maxActive };
}

// ---- 회의 종료 → 제안
/** 회의가 끝났을 때 과제 1개를 제안한다. 화면에 보일 한 줄(없으면 빈 글). */
export async function offerAtClose(m: IscMeeting, rows: IscSeatRow[], host: { empire: string; ruler: string }): Promise<string> {
  const sid = ctx.curSaveId; if (!sid || m.sid !== sid) return '';
  if (!m.turns.some((t) => t.speakerIdx !== m.hostIdx && t.text)) return ''; // 통치자들이 아직 말하지 않은 회의
  const qs = quests(sid), can = canOffer(qs, m.id);
  if (!can.ok) return can.why === 'full' ? L(`진행 중인 회의 과제가 이미 ${ISCQ.maxActive}개라 새 과제는 나오지 않았습니다.`, `You already have ${ISCQ.maxActive} summit tasks under way, so no new task was set.`) : '';
  if (!ctx.gameRunning) return L('게임이 꺼져 있어 과제를 받지 못했습니다.', 'The game is not running, so no task was set.');
  const busy = activeQuests(qs).map((q) => q.giver.idx);
  const relevance = Object.fromEntries(Object.keys(m.seats).map((k) => { const r = rows.find((x) => x.idx === Number(k)); return [k, r ? relevanceOf(r, m.topicKind) : 0]; }));
  const turns: Record<string, number> = {}; for (const t of m.turns) turns[String(t.speakerIdx)] = (turns[String(t.speakerIdx)] ?? 0) + 1;
  const gi = pickGiver(Object.entries(m.seats).filter(([k]) => Number(k) !== m.hostIdx).map(([k, s]) => ({ idx: Number(k), present: s.status === 'present' })), relevance, turns, busy);
  if (gi === null) return L('과제를 낼 수 있는 참석 통치자가 없습니다(이미 과제를 준 나라뿐입니다).', 'No attending ruler can set a task (each already has one under way).');
  const seat = m.seats[String(gi)], row = rows.find((x) => x.idx === gi);
  const targets: Target[] = rows.filter((r) => r.idx !== m.hostIdx).map((r) => ({ idx: r.idx, name: r.empire, atWar: r.atWar, tag: frontierTag(frontierFor(r.idx)) })); // 아는 국경 표시(회의 중 읽은 나라만)
  if (!targets.some((t) => t.idx === gi)) targets.push({ idx: gi, name: seat?.empire || `#${gi}`, atWar: false });
  const who = (idx: number) => (idx === m.hostIdx ? `${host.ruler} (${host.empire})` : `${m.seats[String(idx)]?.name || 'a ruler'} (${m.seats[String(idx)]?.empire || ''})`);
  const recent = m.turns.slice(-12).filter((t) => t.text).map((t) => `${who(t.speakerIdx)}: ${t.text!.slice(0, 300)}`).join('\n');
  const p = ctx.profileWithEthics(ctx.profiles.get(gi), gi) as unknown as Record<string, unknown> | undefined;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : undefined);
  const msgs = questMessages({ ruler: seat?.name || row?.ruler || 'Ruler', title: seat?.title || row?.title, empire: seat?.empire || row?.empire || `#${gi}`, hostEmpire: host.empire, hostRuler: host.ruler, date: ctx.gameDate || '', topic: m.topic, recent, personality: str(p?.personality), ethics: str(p?.ethicsText), targets, giverIdx: gi, year: yearNow() });
  let raw = '';
  try { raw = String(await ctx.ai.chat(msgs, { maxTokens: 1800, json: true, purpose: 'interstellar-summit-quest' }) ?? ''); }
  catch (e) { logDiagnostic('warn', 'iscq.ai_failed', { error: (e as Error).message }); return L('과제를 정하는 중 AI 응답을 받지 못했습니다.', 'No AI reply while setting the task.'); }
  if (ctx.curSaveId !== sid) return '';
  const r = parseQuestReply(raw, { giverIdx: gi, hostIdx: m.hostIdx, targets, year: yearNow() });
  if (!r.ok) { logDiagnostic('info', 'iscq.parse_failed', { why: r.why }); return L('통치자가 낸 과제를 게임에서 쓸 수 없는 형태라 버렸습니다.', 'The task the ruler set could not be used in the game, so it was dropped.'); }
  let meas: QuestMeasure;
  try { meas = await measure([gi, ...(r.goal.target ? [r.goal.target] : [])]); } catch (e) { return (e as Error).message; }
  if (!fillTargets(r.goal, meas)) { logDiagnostic('info', 'iscq.target_failed', { type: r.goal.type }); return L('지금 상황에서는 맞출 수 없는 과제라 버렸습니다(대상이 없거나 이미 전쟁 중이거나 수치가 너무 작음).', 'The task could not be fitted to the current situation (missing target, already at war, or figures too small), so it was dropped.'); }
  const today = ctx.gameDate || '';
  for (const q of qs) if (q.state === 'offered') q.state = 'expired'; // 제안은 한 번에 하나
  const q: IscQuest = { id: randomUUID().replace(/-/g, ''), meetingId: m.id, topic: m.topic, giver: { idx: gi, empire: seat?.empire || row?.empire || `#${gi}`, ruler: seat?.name || row?.ruler || '' }, title: r.title, say: r.say, goal: r.goal, fx: r.fx, state: 'offered', offeredOn: today, offerUntil: offerUntilOf(today) };
  qs.push(q); all()[safeKey(sid)] = qs.slice(-40); save();
  logDiagnostic('info', 'iscq.offered', { type: q.goal.type, giver: gi, reward: r.fx.reward.length, penalty: r.fx.penalty.length, dropped: r.plan.dropped.length, clamped: r.plan.clamped.length });
  return L(`${q.giver.ruler || q.giver.empire}이(가) 과제를 내놓았습니다: 「${q.title}」`, `${q.giver.ruler || q.giver.empire} has set a task: “${q.title}”`);
}

// ---- 보상·불이익 적용
const slotBusy = (qs: IscQuest[], today: string) => qs.filter((q) => q.slot && q.slotUntil && cmpDate(today, q.slotUntil) < 0).map((q) => q.slot!);
async function applyFx(q: IscQuest, which: 'reward' | 'penalty'): Promise<string> {
  const sid = ctx.curSaveId, plan = planOf(q.fx, which, yearNow()), today = ctx.gameDate || '';
  if (!plan.effects.length && !plan.resources.length) return 'none';
  const slot = freeQuestSlot(slotBusy(quests(sid), today));
  if (!slot) { logDiagnostic('warn', 'iscq.no_slot', { id: q.id }); return 'no_slot'; }
  const req = ++link.reqCounter;
  try {
    const st = String((await terminalRequest(questApplyCommand(req, sid, q.id, slot, { kind: 'country' }, plan), 'QUESTAPPLY', req)).kv.status ?? '');
    if (st === 'applied' || st === 'duplicate') { q.slot = slot; q.applied = plan.effects.map((e) => ({ id: e.id, dir: e.dir })); const days = Math.max(0, ...plan.effects.map((e) => e.days)); q.slotUntil = days ? addMonths(today, Math.ceil(days / 30)) : today; }
    return st || 'uncertain';
  } catch (e) { logDiagnostic('warn', 'iscq.apply_failed', { error: (e as Error).message }); return 'timeout'; }
}
const shiftOpinion = (idx: number, step: number) => enqueue(() => sendBatch(1, (reqs) => opinionShiftEffects(reqs, idx, [step]))).catch((e) => { logDiagnostic('warn', 'iscq.opinion_failed', { error: String(e) }); return 'fail'; });
async function resolve(q: IscQuest, result: 'success' | 'failed'): Promise<void> {
  const today = ctx.gameDate || '';
  q.state = result; q.endedOn = today; save();
  closeLog(q);
  const st = await applyFx(q, result === 'success' ? 'reward' : 'penalty');
  save();
  void shiftOpinion(q.giver.idx, result === 'success' ? ISCQ.stepSuccess : ISCQ.stepFail);
  const name = q.giver.ruler || q.giver.empire, list = fxText(q.fx, result === 'success' ? 'reward' : 'penalty', yearNow());
  const fxLine = st === 'no_slot' ? L(' (퀘스트 효과 자리가 모두 차서 효과는 걸지 못했습니다)', ' (all quest effect slots are in use, so no effect was applied)') : list.length ? ' — ' + list.join(', ') : '';
  if (result === 'success') {
    ctx.notify({ kind: 'news', title: L('회의 과제 성공', 'Summit task complete'), body: L(`「${q.title}」을(를) 해냈습니다. ${name}의 호감 +${ISCQ.opSuccess}${fxLine}`, `“${q.title}” is done. ${name}: opinion +${ISCQ.opSuccess}${fxLine}`) });
    chronNote(q.giver.idx, L(`회의 과제 「${q.title}」을(를) 우리가 해내 약속한 보상을 주었다`, `We completed the summit task “${q.title}”, and they granted the promised reward`));
  } else {
    ctx.notify({ kind: 'news', title: L('회의 과제 실패', 'Summit task failed'), body: L(`「${q.title}」을(를) 이루지 못했습니다. ${name}의 호감 −${ISCQ.opFail}${fxLine}`, `“${q.title}” was not achieved. ${name}: opinion −${ISCQ.opFail}${fxLine}`) });
    chronNote(q.giver.idx, L(`회의 과제 「${q.title}」을(를) 우리가 이루지 못했다`, `We failed the summit task “${q.title}”`));
  }
  logDiagnostic('info', 'iscq.resolved', { result, type: q.goal.type, fx: st });
  pushUi();
}

// ---- 게임 상황 기록(Situation Log) — 바닐라 몰락한 제국 과제처럼(2026-10-26 사용자 요청)
const sendLog = (cmd: string, what: string) => { void enqueue(() => sendConsole(cmd)).catch((e) => logDiagnostic('warn', 'iscq.log_failed', { what, error: String(e) })); };
function openLog(q: IscQuest, today: string): void {
  if (!chainOf(q.goal) || !q.due) return;
  const slot = freeLogSlot(quests(ctx.curSaveId).filter((x) => x.id !== q.id)); if (!slot) return;
  try { sendLog(logBeginCommand(ctx.curSaveId, slot, q, today), 'begin'); q.log = slot; ensureWatch(ctx.curSaveId, q); } catch (e) { logDiagnostic('warn', 'iscq.log_failed', { what: 'begin', error: (e as Error).message }); }
}
function closeLog(q: IscQuest): void {
  const c = chainOf(q.goal); if (!q.log || !c) return;
  try { sendLog(logUpdateCommand(ctx.curSaveId, [], [{ slot: q.log, chain: c }]), 'end'); } catch { /* 칸 정보가 망가졌으면 건너뜀 */ }
}

// ---- 수락·거절
let acting = false;
export async function acceptQuest(id: unknown): Promise<{ ok: boolean; error?: string; notice?: string }> {
  const sid = ctx.curSaveId, today = ctx.gameDate || ''; if (!sid) return { ok: false, error: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') };
  const qs = quests(sid), q = qs.find((x) => x.id === id && x.state === 'offered');
  if (!q) return { ok: false, error: L('이미 처리했거나 없는 과제입니다.', 'This task was already handled or does not exist.') };
  if (today && cmpDate(today, q.offerUntil) >= 0) { q.state = 'expired'; save(); pushUi(); return { ok: false, error: L('제안 기한이 지났습니다.', 'The offer has expired.') }; }
  if (activeQuests(qs).length >= ISCQ.maxActive) return { ok: false, error: L(`진행 중인 회의 과제는 ${ISCQ.maxActive}개까지입니다.`, `At most ${ISCQ.maxActive} summit tasks at a time.`) };
  if (activeQuests(qs).some((x) => x.giver.idx === q.giver.idx)) return { ok: false, error: L('이 나라가 준 과제가 이미 진행 중입니다.', 'A task from this empire is already under way.') };
  if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 받을 수 있습니다.', 'The game must be running to accept.') };
  if (acting) return { ok: false, error: L('처리 중입니다.', 'Working on it.') };
  acting = true;
  try {
    if (q.goal.type === 'gift') {
      const req = ++link.reqCounter, m = await terminalRequest(giftCommand(req, sid, q.id, q.giver.idx, q.goal.res!, q.goal.steps!, yearNow()), 'ISCQGIFT', req);
      const st = String(m.kv.status ?? '');
      if (st === 'short') return { ok: false, error: L('창고에 그만큼이 없습니다. 차감된 것은 없습니다.', 'Not enough in the stockpile. Nothing was taken.') };
      if (st === 'no_target') return { ok: false, error: L('그 제국을 찾지 못했습니다. 차감된 것은 없습니다.', 'That empire was not found. Nothing was taken.') };
      if (st !== 'given' && st !== 'duplicate') return { ok: false, error: L('결과를 확인하지 못했습니다. 다시 눌러도 두 번 건네지 않습니다.', 'Result unknown. Pressing again never hands it over twice.') };
      q.state = 'active'; q.acceptedOn = today; q.due = today; q.last = Number(m.kv.amt) || null; save();
      chronNote(q.giver.idx, L(`회의 과제로 ${goalText(q.goal)} — 실제로 ${Math.round(Number(m.kv.amt) || 0)}을(를) 건넸다`, `For the summit task we handed over ${Math.round(Number(m.kv.amt) || 0)} (${goalText(q.goal)})`));
      await resolve(q, 'success');
      return { ok: true };
    }
    if (q.goal.type === 'peace' || q.goal.type === 'war') {
      const meas = await measure([q.goal.target!]);
      if (q.goal.type === 'peace' && meas.wars[String(q.goal.target)]) return { ok: false, error: L('이미 그 제국과 전쟁 중이라 받을 수 없습니다.', 'You are already at war with that empire, so this cannot be accepted.') };
    }
    q.state = 'active'; q.acceptedOn = today; q.due = dueOf(today, q.goal.months); openLog(q, today); save();
    chronNote(q.giver.idx, L(`성간 임시회의에서 과제 「${q.title}」을(를) 받았다: ${goalText(q.goal)} (기한 ${q.due})`, `Accepted the summit task “${q.title}”: ${goalText(q.goal)} (due ${q.due})`));
    logDiagnostic('info', 'iscq.accepted', { type: q.goal.type, due: q.due });
    return { ok: true, notice: q.log ? L(`과제를 받았습니다. 기한 ${q.due}. 게임의 상황 기록에도 떴습니다.`, `Task accepted. Due ${q.due}. It is also in the game's Situation Log.`) : L(`과제를 받았습니다. 기한 ${q.due}.`, `Task accepted. Due ${q.due}.`) };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  finally { acting = false; pushUi(); }
}
export function declineQuest(id: unknown): { ok: boolean } {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const q = quests(sid).find((x) => x.id === id && x.state === 'offered'); if (!q) return { ok: false };
  q.state = 'declined'; q.endedOn = ctx.gameDate || ''; save(); pushUi(); logDiagnostic('info', 'iscq.declined', { type: q.goal.type });
  return { ok: true };
}

// ---- 매달 판정(2026-11-09 회랑 방식 — 「매달 확인이 필요 없는 것은 바뀔 때만」)
// 상황 기록 칸이 있는 과제는 모드가 매달 직접 재고(sllm_iscq_watch.txt) 목표에 닿음·전쟁·대상 소멸 때만 ISCQW 줄을 남긴다.
// 앱은 그 줄을 받았을 때와 기한이 된 달에만 한 번 재서 판정한다. 칸이 없는 옛 과제만 예전처럼 매달 잰다.
let judging = '';
/** 이번 세션에 감시를 켠 과제(세이브 번호:과제). 세이브를 불러오면 비운다(불러온 세이브에 감시 표식이 없을 수 있음). */
const watched = new Set<string>();
/** 모드가 알린 칸(다음 판정에서 잰다). */
const signaled = new Set<number>();
const wkey = (sid: string, q: IscQuest) => sid + ':' + q.id;
/** 진행 중이고 칸이 있는 과제의 감시를 켠다(세션마다 한 번). 켰으면 true. */
function ensureWatch(sid: string, q: IscQuest): boolean {
  if (!q.log) return false; if (watched.has(wkey(sid, q))) return true;
  const c = chainOf(q.goal); if (!c) return false;
  try { sendLog(watchCommand(sid, q.log, c), 'watch'); watched.add(wkey(sid, q)); return true; } catch (e) { logDiagnostic('warn', 'iscq.log_failed', { what: 'watch', error: (e as Error).message }); return false; }
}
/** 고른 과제들을 한 번 재서 판정한다. */
async function judgeSome(sid: string, today: string, list: IscQuest[]): Promise<void> {
  const meas = await measure([...new Set(list.flatMap((q) => [q.giver.idx, ...(q.goal.target ? [q.goal.target] : [])]))]);
  if (ctx.curSaveId !== sid) return;
  for (const q of list) { if (q.state !== 'active') continue; const j = judge(q, meas, today); q.last = j.value; if (j.result) await resolve(q, j.result); }
  // 감시가 없는 칸(옛 모드에서 연 칸이 아직 감시를 못 켰을 때)만 상황 기록 숫자를 앱이 바꾼다
  const ticks = list.filter((q) => q.state === 'active' && q.log && q.due && !watched.has(wkey(sid, q))).map((q) => ({ slot: q.log!, now: logNum(q.goal, goalValue(q.goal, meas)), left: monthsLeft(today, q.due!) }));
  if (ticks.length) { try { sendLog(logUpdateCommand(sid, ticks, []), 'tick'); } catch (e) { logDiagnostic('warn', 'iscq.log_failed', { what: 'tick', error: (e as Error).message }); } }
  save(); pushUi();
}
async function monthly(sid: string, today: string): Promise<void> {
  if (sid !== ctx.curSaveId || !today || judging === sid + today) return;
  const qs = quests(sid); let changed = false;
  for (const q of qs) if (q.state === 'offered' && cmpDate(today, q.offerUntil) >= 0) { q.state = 'expired'; changed = true; }
  const act = activeQuests(qs).filter((q) => q.goal.type !== 'gift');
  if (changed) { save(); pushUi(); }
  if (!act.length || !ctx.gameRunning) return;
  judging = sid + today;
  try {
    const fresh = act.filter((q) => q.log && !watched.has(wkey(sid, q))); // 이번 세션에 처음 켜는 감시: 이번 달은 앱이 한 번 잰다(모드는 다음 달부터)
    const need = act.filter((q) => !q.log || fresh.includes(q) || signaled.has(q.log) || (q.due && cmpDate(today, q.due) >= 0));
    signaled.clear();
    if (need.length) await judgeSome(sid, today, need);
    for (const q of fresh) if (q.state === 'active') ensureWatch(sid, q);
  } catch (e) { logDiagnostic('warn', 'iscq.monthly_failed', { error: (e as Error).message }); judging = ''; }
}
/** 모드의 감시 줄(ISCQW): 그 칸의 과제를 곧 한 번 재서 판정한다(같은 달 줄 여러 개는 한 번에). */
let sigTimer: ReturnType<typeof setTimeout> | null = null, sigBusy = false;
function onWatch(kv: Record<string, unknown>): void {
  const w = parseWatch(kv), sid = ctx.curSaveId; if (!w || !sid || (w.sid && w.sid !== sid)) return;
  signaled.add(w.slot);
  if (sigTimer) clearTimeout(sigTimer);
  sigTimer = setTimeout(() => { sigTimer = null; void judgeSignaled(sid); }, 1500);
}
async function judgeSignaled(sid: string): Promise<void> {
  if (sigBusy || sid !== ctx.curSaveId || !ctx.gameRunning) return;
  const list = activeQuests(quests(sid)).filter((q) => q.goal.type !== 'gift' && q.log && signaled.has(q.log)); if (!list.length) return;
  sigBusy = true;
  try { for (const q of list) signaled.delete(q.log!); await judgeSome(sid, ctx.gameDate || '', list); }
  catch (e) { logDiagnostic('warn', 'iscq.signal_failed', { error: (e as Error).message }); }
  finally { sigBusy = false; }
}

export function registerIscQuests(router: LogRouter): void {
  router.on(SLOT.ISC_QUEST, 'isc-quest', (m: SllmMessage) => {
    if (m.kind === 'ISCQW') { onWatch(m.kv); return; } // 과제 감시(2026-11-09): 모드가 목표·전쟁·소멸 때만
    if (m.kind === 'LOADED') { watched.clear(); signaled.clear(); return; } // 불러온 세이브에는 감시 표식이 없을 수 있다 → 다음 달 다시 켠다
    if (m.kind === 'ISCQO') { const list = rowsOf.get(String(m.kv.req)); if (list && list.length < 20) list.push(m.kv); }
    else if (m.kind === 'ISCQM' || m.kind === 'ISCQGIFT' || m.kind === 'QUESTAPPLY') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
  onGameSnapshot((snap) => { if (snap.sid) void monthly(snap.sid, snap.date || ctx.gameDate || ''); }, 'isc');
}
