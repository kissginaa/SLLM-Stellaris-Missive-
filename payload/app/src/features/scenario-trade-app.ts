// 회랑 무역로(시나리오 전용, 앱 쪽, 2026-11-06). 규칙: src/scenario-trade.ts · 화면: ui/office-trade.js · 게임: 시나리오 모드 sllm_cr_trade_effects.txt
// 회랑 자리(seat p)를 맡은 플레이어만 쓴다. 관세·단속을 바꾸면 게임에 한 줄(sllm_cr_tr_set)을 보내고, 두 나라의 반응(서신·긴장)을 붙인다.
// 게임 줄: SLLM:SCNTRADE(ev=toll 관세 · arrive 도착) · SLLM:SCNTRSET(정책 적용 확인) — scenario-map-app 의 로그 자리(SCNMAP)에서 넘겨받는다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link, enqueue, sendConsole } from '../app/game-link';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { tensionShift } from './tension-app';
import { chronNoteWorld } from './chronicle-app';
import { receiveLetter } from './mail-app';
import { TOLL, TR, type TSide, type TradeSave, type LetterKind, newTradeSave, fixTradeSave, restLeft, reactions, setCommand, fineCommand, parseTrade, recordToll } from '../scenario-trade';

const KEEP = 12;
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_trade.json');
let all: Record<string, TradeSave> | null = null;
function books(): Record<string, TradeSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixTradeSave(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_trade', error: (e as Error).message }); }
  return all;
}
let dirty: ReturnType<typeof setTimeout> | null = null;
function save(now = false): void {
  const write = () => { try { const b = books(), keys = Object.keys(b); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete b[k]; const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: b })); fs.renameSync(t, file()); } catch (e) { logDiagnostic('warn', 'scenario_trade.save_failed', { error: (e as Error).message }); } };
  if (now) { if (dirty) { clearTimeout(dirty); dirty = null; } write(); return; }
  if (dirty) return; dirty = setTimeout(() => { dirty = null; write(); }, 1500);
}
const bookOf = (sid: string): TradeSave => (books()[sid] ??= newTradeSave());
const sideName = (x: TSide): string => { const n = scenarioNow()?.names?.[x]; return n || (x === 'a' ? L('은하 얼라이언스', 'Galactic Alliance') : L('인류 제국', 'Human Empire')); };
const lvName = (n: number): string => n === 0 ? L('낮음', 'Low') : n === 1 ? L('보통', 'Normal') : n === 2 ? L('높음', 'High') : n === 3 ? L('징벌', 'Punitive') : L('통항 금지', 'Banned');
/** 회랑 자리를 맡은 시나리오 판인가. */
function mine(): string | null { const s = scenarioNow(), sid = ctx.curSaveId; return s && sid && s.id === 'corridor' && s.seat === 'p' ? sid : null; }
const ready = () => !!(ctx.gameRunning && link.sessionReady);

/** scenario-map-app 의 로그 자리에서 받는 줄(SCNTRADE·SCNTRSET). */
export function tradeOnLine(m: SllmMessage): void {
  if (m.kind !== 'SCNTRADE' && m.kind !== 'SCNTRSET') return;
  const sid = mine(); if (!sid) return;
  if (m.kind === 'SCNTRSET') { logDiagnostic('info', 'scenario_trade.applied', { kv: m.kv }); return; }
  const p = parseTrade(m.kv as Record<string, unknown>); if (p.ev !== 'toll' || !p.side) return;
  const sv = bookOf(sid), r = recordToll(sv, sid, { side: p.side, date: p.date, sys: p.sys, id: p.id }); if (!r.added) return;
  save();
  if (r.caught) {
    void enqueue(() => sendConsole(fineCommand(TR.fine))).catch((e) => logDiagnostic('warn', 'scenario_trade.fine_failed', { error: (e as Error).message }));
    const who = sideName(p.side);
    ctx.notify({ kind: 'office', title: L('회랑 단속: 밀수 적발', 'Corridor crackdown: smuggling found'), body: L(`${p.sys}에서 ${who} 상선의 숨긴 화물을 찾아 벌금 ${TR.fine}을 물렸습니다.`, `At ${p.sys}, inspectors found hidden cargo on a ${who} freighter and fined it ${TR.fine}.`), action: L('회랑 무역로', 'Corridor Trade Route') });
  }
}

/** 그 나라가 보내는 서신(문구는 L(한, 영) 그대로 — 언어 팩이 모을 수 있게). */
function letterText(kind: LetterKind, side: TSide): string {
  const us = ctx.playerName || L('회랑', 'the Corridor');
  if (kind === 'raise') return L(`${us}이(가) 우리 상선에 매기는 관세를 올렸다는 보고를 받았소. 우리 상인들은 이를 공정한 처사로 여기지 않소. 다시 생각해 주기를 바라오.`, `We are told that ${us} has raised the tariffs on our merchant ships. Our traders do not consider this fair. We ask that you reconsider.`);
  if (kind === 'punish') return L(`징벌 관세라니, ${us}은(는) 우리를 적으로 대하기로 한 것이오? 이 조치가 계속된다면 우리도 그에 맞게 대할 수밖에 없소.`, `Punitive tariffs? Has ${us} decided to treat us as an enemy? If this continues, we will have no choice but to respond in kind.`);
  if (kind === 'ban') return side === 'a' ? L('우리 상선의 회랑 통항을 막은 것은 사실상 적대 행위요. 얼라이언스는 이 일을 잊지 않을 것이오.', 'Closing the Corridor to our merchant ships is an act of hostility in all but name. The Alliance will not forget this.')
    : L('우리 상선의 회랑 통항을 막은 것은 사실상 적대 행위요. 제국은 이 일을 잊지 않을 것이오.', 'Closing the Corridor to our merchant ships is an act of hostility in all but name. The Empire will not forget this.');
  if (kind === 'lift') return L('회랑이 우리 상선에 다시 문을 열었다는 소식을 들었소. 늦었지만 현명한 결정이오.', 'We hear the Corridor has reopened to our merchant ships. A late decision, but a wise one.');
  return L('관세를 내려 준 데 감사하오. 우리 상인들이 반길 것이오.', 'Thank you for lowering the tariffs. Our traders will welcome it.');
}

function view(): Record<string, unknown> {
  const sid = mine(); if (!sid) return { ok: true, on: false };
  const sv = bookOf(sid), today = ctx.gameDate || '', y = (/^(\d+)/.exec(today) || [])[1] || '';
  const row = sv.years[y], prevRow = sv.years[String(Number(y) - 1)];
  const sum = (r?: typeof row) => (r ? { a: r.a, b: r.b, caught: r.caught, fines: r.fines, total: r.a.e + r.b.e + r.fines } : null);
  return {
    ok: true, on: true, year: Number(y) || null, live: ready(),
    sides: (['a', 'b'] as TSide[]).map((x) => ({ side: x, name: sideName(x), lv: sv.lv[x], lvName: lvName(sv.lv[x]), toll: TOLL[sv.lv[x]], rest: restLeft(sv, x, today) })),
    crack: sv.crack, crackRest: restLeft(sv, 'crack', today), crackCost: TR.crackCost, fine: TR.fine,
    levels: [0, 1, 2, 3, 4].map((n) => ({ n, name: lvName(n), toll: TOLL[n] })),
    thisYear: sum(row), lastYear: sum(prevRow),
    log: sv.log.slice(-15).reverse().map((l) => ({ d: l.d, name: sideName(l.side), sys: l.sys, toll: l.toll, caught: !!l.caught })),
  };
}

async function setPolicy(req: unknown): Promise<Record<string, unknown>> {
  const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리를 맡은 시나리오 판에서만 쓸 수 있습니다.', 'Only available when playing the Corridor seat in this scenario.') };
  if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 정책을 바꿀 수 있습니다.', 'The game must be running to change the policy.') };
  const r = (req && typeof req === 'object' ? req : {}) as { side?: unknown; lv?: unknown; crack?: unknown };
  const sv = bookOf(sid), today = ctx.gameDate || '', old = { ...sv.lv }, next = { ...sv.lv }; let crack = sv.crack, key: TSide | 'crack';
  if (r.side === 'a' || r.side === 'b') { const n = Number(r.lv); if (!Number.isInteger(n) || n < 0 || n > 4) return { ok: false, error: L('알 수 없는 관세 단계입니다.', 'Unknown tariff level.') }; key = r.side; if (n === sv.lv[key]) return { ok: true, ...view() }; next[key] = n; }
  else if (typeof r.crack === 'boolean') { key = 'crack'; if (r.crack === sv.crack) return { ok: true, ...view() }; crack = r.crack; }
  else return { ok: false, error: L('바꿀 것을 고르세요.', 'Choose what to change.') };
  const left = restLeft(sv, key, today); if (left > 0) return { ok: false, error: L(`이 정책은 약 ${Math.ceil(left / 30)}달 뒤에 다시 바꿀 수 있습니다.`, `This policy can be changed again in about ${Math.ceil(left / 30)} month(s).`) };
  try { await enqueue(() => sendConsole(setCommand(next.a, next.b, crack))); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
  sv.lv = next; sv.crack = crack; sv.changed[key] = today; save(true);
  // 반응: 그 나라의 서신 · 긴장(편들기) · 연대기
  const branch = ctx.govMem().currentBranch(sid), scn = scenarioNow();
  if (key !== 'crack') {
    const re = reactions(old, next, key), name = sideName(key), idx = scn?.idx?.[key] ?? 0;
    if (re.letter && idx) { receiveLetter(sid, branch, { idx, name, date: today, text: letterText(re.letter, key), proposal: null, expires: today.replace(/^(\d+)/, (yy) => String(Number(yy) + 1)), read: false, sourceId: `scntrade:${today}:${key}:${next[key]}` }); }
    if (re.tension) void tensionShift(re.tension, re.tension > 0 ? ['회랑이 한쪽 상선을 차별했다', 'The Corridor discriminated against one side\'s shipping'] : ['회랑이 관세를 다시 고르게 했다', 'The Corridor evened out its tariffs']).catch(() => undefined);
    try { chronNoteWorld(L(`회랑이 ${name} 상선의 관세를 「${lvName(old[key])}」에서 「${lvName(next[key])}」(으)로 바꿨다.`, `The Corridor changed tariffs on ${name} shipping from "${lvName(old[key])}" to "${lvName(next[key])}".`), true); } catch { /* 연대기는 덤 */ }
  } else {
    try { chronNoteWorld(crack ? L('회랑이 무역로 집중 단속을 시작했다.', 'The Corridor began a crackdown on its trade route.') : L('회랑이 무역로 집중 단속을 풀었다.', 'The Corridor ended its trade route crackdown.'), true); } catch { /* 연대기는 덤 */ }
  }
  logDiagnostic('info', 'scenario_trade.set', { key, lv: next, crack });
  return { ok: true, ...view() };
}

export function registerScenarioTrade(): void {
  ipcMain.handle('scnTrade', async () => { try { return view(); } catch (e) { logDiagnostic('warn', 'scenario_trade.view_failed', { error: String(e) }); return { ok: false, on: false }; } });
  ipcMain.handle('scnTradeSet', async (_e, req: unknown) => { try { return await setPolicy(req); } catch (e) { logDiagnostic('warn', 'scenario_trade.set_failed', { error: String(e) }); return { ok: false, error: String((e as Error).message || e) }; } });
}
export const scnTradeTest = { reset: () => { all = {}; }, tradeOnLine };
