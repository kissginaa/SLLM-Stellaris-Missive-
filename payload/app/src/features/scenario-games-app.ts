// 시나리오 「화합 대회」 앱 쪽(2026-11-06). 규칙: src/scenario-games.ts · 경기·개최 준비: log-app.ts(scnHostGames) · 화면: ui/office-games.js
// 초청장을 보내면 받아들일 나라를 바로 정하고(같은 세이브·해면 같은 답), 한 나라라도 오면 비용을 내고 대회를 연다. 아무도 안 오면 비용 없이 1년 쉰다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { tensionNow, tensionShift } from './tension-app';
import { terminal } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { scnGamesBusy, scnHostGames, scnPayGame } from './log-app';
import { GAMES, type GamesKind, type GamesSave, type GSide, type InviteCtx, type InviteBlock, fixGamesSave, newGamesSave, guestSides, canInvite, acceptChance, chanceWord, decideGuests, tensionDelta, eventYear, recordInvite } from '../scenario-games';

const KEEP = 12;
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_games.json');
let all: Record<string, GamesSave> | null = null;
function books(): Record<string, GamesSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixGamesSave(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_games', error: (e as Error).message }); }
  return all;
}
function save(): void {
  try { const b = books(), keys = Object.keys(b); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete b[k]; const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: b })); fs.renameSync(t, file()); }
  catch (e) { logDiagnostic('warn', 'scenario_games.save_failed', { error: (e as Error).message }); }
}
const bookOf = (sid: string): GamesSave => (books()[sid] ??= newGamesSave());
const ymd = (d: string) => { const m = /^(\d+)\.(\d+)/.exec(d || ''); return m ? { y: Number(m[1]), m: Number(m[2]) } : null; };
const SIDE_NAME = (x: GSide): string => (x === 'a' ? L('은하 얼라이언스', 'Galactic Alliance') : x === 'b' ? L('인류 제국', 'Human Empire') : L('세렌 회랑', 'Seren Corridor'));
const kindName = (k: GamesKind): string => (k === 'oly' ? L('은하 올림픽', 'Galactic Olympics') : L('은하 월드 챔피언십', 'Galactic Worlds'));
const costText = (k: GamesKind): string => { const c = GAMES.cost[k]; return [c.influence ? L(`영향력 ${c.influence}`, `${c.influence} influence`) : '', c.energy ? L(`에너지 ${c.energy}`, `${c.energy} energy`) : ''].filter(Boolean).join(' · '); };
const chanceText = (p: number): string => { const w = chanceWord(p); return w === 'none' ? L('오지 않음', 'Will not come') : w === 'likely' ? L('올 듯함', 'Likely') : w === 'even' ? L('반반', 'Uncertain') : L('어려움', 'Unlikely'); };
const whyText = (why: InviteBlock, from?: number): string => why === 'busy' ? L('이미 준비 중인 대회가 있습니다. 한 번에 하나만 열 수 있습니다.', 'Another event is already being prepared. Only one at a time.')
  : why === 'unknown' ? L('초청할 나라를 아직 모릅니다.', 'We do not know whom to invite yet.')
  : why === 'tension' ? L('긴장이 너무 높습니다(일촉즉발 이상). 지금은 아무도 오지 않습니다.', 'Tension is too high (On the Brink or worse). Nobody would come now.')
  : why === 'rest' ? L(`${from}년부터 다시 열 수 있습니다.`, `Can be held again from ${from}.`)
  : L(`올해는 모두 거절했습니다. ${from}년에 다시 초청할 수 있습니다.`, `Everyone declined this year. Try again in ${from}.`);

/** 지금 상황(좌석·긴장·전쟁·이름). 시나리오가 아니면 null. */
function context(): { sid: string; c: InviteCtx; idx: Partial<Record<GSide, number>>; names: Partial<Record<GSide, string>>; m: number } | null {
  const s = scenarioNow(), sid = ctx.curSaveId; if (!s || !sid || s.id !== 'corridor') return null;
  const d = ymd(ctx.gameDate || ''); if (!d) return null;
  const tn = tensionNow(), idx: Partial<Record<GSide, number>> = { ...s.idx }, names: Partial<Record<GSide, string>> = { ...s.names };
  if (tn?.a && !idx.a) { idx.a = tn.a.idx; names.a ??= tn.a.name; } if (tn?.b && !idx.b) { idx.b = tn.b.idx; names.b ??= tn.b.name; }
  const known: Partial<Record<GSide, boolean>> = {}, warWithUs: Partial<Record<GSide, boolean>> = {};
  for (const x of ['a', 'b', 'p'] as GSide[]) { const i = idx[x]; if (!i) continue; known[x] = true; warWithUs[x] = !!terminal.items.find((t) => t.idx === i)?.em?.war; }
  const busy = !!scnGamesBusy(sid);
  return { sid, idx, names, m: d.m, c: { year: d.y, seat: s.seat, stage: tn?.st ?? 0, abWar: !!tn?.war, warWithUs, busy, known } };
}

function view(): Record<string, unknown> {
  const x = context(); if (!x) return { ok: true, on: false };
  const sv = bookOf(x.sid), busy = scnGamesBusy(x.sid);
  const guests = guestSides(x.c.seat).filter((g) => x.c.known[g]).map((g) => ({ side: g, name: x.names[g] || SIDE_NAME(g), chance: chanceText(acceptChance(g, x.c)), war: !!x.c.warWithUs[g] }));
  const kinds = (['oly', 'worlds'] as GamesKind[]).map((k) => { const ok = canInvite(sv, k, x.c); return { kind: k, name: kindName(k), cost: costText(k), when: eventYear(k, x.c.year, x.m), can: ok.ok, why: ok.ok ? '' : whyText(ok.why, ok.from), last: sv.held[k] ?? null }; });
  const log = sv.log.slice(-8).reverse().map((l) => ({ y: l.y, name: kindName(l.kind), came: l.came.map((g) => x.names[g] || SIDE_NAME(g)), refused: l.refused.map((g) => x.names[g] || SIDE_NAME(g)) }));
  return { ok: true, on: true, year: x.c.year, stage: x.c.stage, busy: busy ? { name: kindName(busy.ev), year: busy.year } : null, guests, kinds, log };
}

async function invite(kind: GamesKind): Promise<Record<string, unknown>> {
  const x = context(); if (!x) return { ok: false, error: L('이 시나리오에서만 쓸 수 있습니다.', 'Only available in this scenario.') };
  const sv = bookOf(x.sid), ok = canInvite(sv, kind, x.c); if (!ok.ok) return { ok: false, error: whyText(ok.why, ok.from) };
  const { came, refused } = decideGuests(x.sid, kind, x.c), nm = (g: GSide) => x.names[g] || SIDE_NAME(g), title = kindName(kind);
  if (!came.length) {
    recordInvite(sv, kind, x.c.year, came, refused, null); save();
    chronNoteWorld(L(`${title} 초청을 모든 나라가 거절했습니다(${refused.map(nm).join(', ')}).`, `Every nation declined our invitation to the ${title} (${refused.map(nm).join(', ')}).`), true);
    return { ok: true, came: [], refused: refused.map(nm), held: false, ...view() };
  }
  const year = eventYear(kind, x.c.year, x.m);
  try { await scnPayGame(x.sid, `scngames:${kind}:${year}`, GAMES.cost[kind]); } catch (e) { return { ok: false, error: (e as Error).message }; }
  scnHostGames(x.sid, kind, year, came.map((g) => ({ idx: x.idx[g]!, name: nm(g), weight: GAMES.weight[g] })));
  recordInvite(sv, kind, x.c.year, came, refused, year); save();
  const dt = tensionDelta(x.c.seat, came, refused);
  if (dt) void tensionShift(dt, dt < 0 ? ['화합 대회에 두 거대 세력이 함께 나온다', 'Both great powers will attend the unity games'] : ['거대 세력 하나가 화합 대회를 보이콧했다', 'A great power boycotted the unity games']).catch(() => undefined);
  ctx.notify({ kind: 'office', title: L(`${title} 개최 확정`, `${title}: confirmed`),
    body: L(`참가: ${came.map(nm).join(', ')}${refused.length ? ` · 불참: ${refused.map(nm).join(', ')}` : ''}. 우주 경기장에서 개최 준비를 하세요.`, `Attending: ${came.map(nm).join(', ')}${refused.length ? ` · Declined: ${refused.map(nm).join(', ')}` : ''}. Prepare the venue in the Space Stadium.`), action: L('확인', 'OK') });
  logDiagnostic('info', 'scenario_games.invite', { kind, year, came, refused, dt });
  return { ok: true, came: came.map(nm), refused: refused.map(nm), held: true, year, tension: dt, ...view() };
}

export function registerScenarioGames(): void {
  ipcMain.handle('scnGames', async () => { try { return view(); } catch (e) { logDiagnostic('warn', 'scenario_games.view_failed', { error: String(e) }); return { ok: false, on: false }; } });
  ipcMain.handle('scnGamesInvite', async (_e, kind: unknown) => {
    if (kind !== 'oly' && kind !== 'worlds') return { ok: false, error: L('알 수 없는 대회입니다.', 'Unknown event.') };
    try { return await invite(kind); } catch (e) { logDiagnostic('warn', 'scenario_games.invite_failed', { error: String(e) }); return { ok: false, error: String((e as Error).message || e) }; }
  });
}
export const scnGamesTest = { reset: () => { all = {}; } };
