// 시민 정치(2026-11-03 사용자 결정): ① 여론조사(3개월마다, 신문사별) ③ 특별사면(국경일·행성 기념일 달, 1년에 1번). ② 국민투표는 정책 선포 단계(features/policy-app.ts)에서 열고 여기에는 기록만 둔다.
// 규칙: src/civic.ts. 화면: ui/office-civic.js(집무실 「여론조사」·「특별사면」). LLM 은 쓰지 않는다(틀 문장).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { settings } from '../app/settings';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import type { StateSnapshot } from '../gamestate';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { effectivePaper } from '../media-prefs';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { moodView, moodNudge } from './mood-app';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { playerGestalt } from './gestalt-app';
import { officialHolidayMonths } from './official-holidays-app';
import { holidaysView } from './holiday-app';
import { civicHooks } from './civic-hooks';
import { parlHooks } from './parl-hooks'; // 정당 지지율에 의회 진영을 붙인다(2026-11-03)
import { type Poll, type Amnesty, type AmnestyTier, type CivicRegime, type Referendum, civicRegime, pollDue, makePoll, pollParties, pollFact, pollPromptLine, ISSUE, POLL, REF, AMNESTY, AMNESTY_DAYS, AMNESTY_POL_UP, AMNESTY_POL_DOWN, isTier, amnestyUsed, referendumReady, civicCommand } from '../civic';

interface CivicSave { polls: Poll[]; amnesty: Amnesty[]; refs: Referendum[]; lastRef?: string }
interface CivicStore { saves: Record<string, CivicSave> }
const file = () => path.join(app.getPath('userData'), 'sllm_civic.json');
let store: CivicStore | null = null;
function sanitize(v: unknown): CivicStore {
  const o = (v && typeof v === 'object' ? v : {}) as { saves?: Record<string, unknown> }, saves: CivicStore['saves'] = {};
  for (const [sid, e] of Object.entries(o.saves && typeof o.saves === 'object' ? o.saves : {}).slice(0, 500)) {
    const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
    const arr = (k: string) => (Array.isArray(x[k]) ? (x[k] as unknown[]).filter((q) => q && typeof q === 'object') : []);
    saves[safeKey(sid)] = {
      polls: arr('polls').slice(-POLL.keep) as Poll[], amnesty: arr('amnesty').slice(-20) as Amnesty[], refs: arr('refs').slice(-20) as Referendum[],
      ...(typeof x.lastRef === 'string' ? { lastRef: x.lastRef.slice(0, 20) } : {}),
    };
  }
  return { saves };
}
function all(): CivicStore { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'civic', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'civic', error: e }); } }, 1500); }
const entry = (sid: string): CivicSave => (all().saves[safeKey(sid)] ??= { polls: [], amnesty: [], refs: [] });

/** 마지막 월간 상황의 정부 형태·파벌(국민투표·사면이 쓴다). */
let last: { sid: string; auth: number; factions: Array<{ fid?: number; ethic: string; name: string }> } | null = null;
export function civicRegimeNow(): CivicRegime { return civicRegime(last && last.sid === ctx.curSaveId ? last.auth : 0, playerGestalt() !== ''); }

function onSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId) return;
  last = { sid: snap.sid, auth: snap.authority ?? 0, factions: (snap.factions ?? []).map((f) => ({ ...(f.fid !== undefined ? { fid: f.fid } : {}), ethic: f.ethic, name: f.name })) };
  const e = entry(snap.sid); if (!pollDue(e.polls, snap.date)) return;
  setTimeout(() => { // 민심(mood-app)이 같은 상황으로 점수를 매긴 뒤에 잰다
    try {
      if (snap.sid !== ctx.curSaveId) return; const reg = civicRegimeNow(); if (reg === 'none') return;
      const v = moodView(); if (v.score === null) return;
      const parts = v.parts ?? { stability: null, approval: null, warPenalty: 0, unrestPenalty: 0, eventAdj: 0 };
      const real = parts.approval ?? v.score;
      const p = makePoll(snap.date, real, parts, reg === 'sham', Math.random);
      if (reg === 'free') { // 정당(파벌)별 지지율(2026-11-03): 관제 조사는 내지 않는다
        let bloc: ReturnType<typeof parlHooks.bloc> = null; try { bloc = parlHooks.bloc(); } catch { /* 의회 없음 */ }
        const parties = pollParties((snap.factions ?? []).map((f) => { const key = f.fid ? 'f' + f.fid : 'n:' + f.name; return { key, name: f.name, ethic: f.ethic, support: f.support, ...(bloc?.side[key] ? { side: bloc.side[key] } : {}) }; }), Math.random);
        if (parties.length) p.parties = parties;
      }
      if (!pollDue(e.polls, snap.date)) return; e.polls = [...e.polls, p].slice(-POLL.keep); save(); push();
    } catch (err) { logDiagnostic('warn', 'civic.poll_failed', { error: (err as Error).message }); }
  }, 0);
}

/** 사면할 수 있는 날인지: 이번 달에 국경일이나 행성 기념일이 있어야 한다. */
function occasionNow(sid: string): string | null {
  const m = Number(/^\d+\.(\d+)/.exec(ctx.gameDate || '')?.[1]); if (!m) return null;
  try { if (officialHolidayMonths(sid).includes(m)) return L('국경일', 'National holiday'); } catch { /* 국경일 기록 없음 */ }
  try { const hv = holidaysView() as { items?: Array<{ planet: string; title: string; month_: boolean; owned: boolean }> }; const h = (hv.items ?? []).find((x) => x.month_ && x.owned); if (h) return L(`「${h.planet}」 ${h.title}`, `"${h.planet}" ${h.title}`); } catch { /* 행성 기념일 없음 */ }
  return null;
}

export function civicView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', regime: 'free' as CivicRegime };
  const e = entry(sid), reg = civicRegimeNow(), today = ctx.gameDate || '';
  const names = [0, 1, 2].map((i) => effectivePaper(settings.mediaPrefs, i).name);
  const pv = (p: Poll) => ({ date: p.date, shown: p.shown, sham: p.sham, papers: p.papers.map((x) => ({ name: names[x.paper] ?? '', value: x.value })), good: p.good.map((k) => L(...(ISSUE[k] ?? [k, k]))), bad: p.bad.map((k) => L(...(ISSUE[k] ?? [k, k]))), parties: (p.parties ?? []).map((x) => ({ name: x.key === 'none' ? L('지지 정당 없음', 'No party') : x.name, v: x.v, side: x.side ?? '' })) });
  const occ = reg === 'none' ? null : occasionNow(sid), used = amnestyUsed(e.amnesty, today), rr = referendumReady(e.lastRef, today);
  return {
    sid, date: today, regime: reg,
    poll: e.polls.length ? pv(e.polls[e.polls.length - 1]) : null,
    history: e.polls.slice(-8).reverse().map((p) => ({ date: p.date, shown: p.shown })),
    amnesty: { occasion: occ, used, can: !!occ && !used && reg !== 'none' && ctx.gameRunning, tiers: (Object.keys(AMNESTY) as AmnestyTier[]).map((k) => ({ id: k, name: L(AMNESTY[k].ko, AMNESTY[k].en), stab: AMNESTY[k].stab, crime: AMNESTY[k].crime })), last: e.amnesty.slice(-3).reverse().map((a) => ({ date: a.date, name: L(AMNESTY[a.tier].ko, AMNESTY[a.tier].en), political: a.political, status: a.status })) },
    referendum: { ready: rr.ok, until: rr.until ?? '', last: e.refs.slice(-3).reverse() },
  };
}
function push(): void { try { const v = civicView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('civicUpdate', v); } catch { /* 창 없음 */ } }

/** 국민투표 쿨다운(policy-app 이 묻는다). */
export function referendumInfo(): { regime: CivicRegime; ready: boolean; until: string } {
  const sid = ctx.curSaveId || '', reg = civicRegimeNow(); if (!sid) return { regime: reg, ready: false, until: '' };
  const r = referendumReady(entry(sid).lastRef, ctx.gameDate || ''); return { regime: reg, ready: r.ok, until: r.until ?? '' };
}
/** 국민투표를 치렀다(결과와 상관없이 2년 쿨다운). 통과·부결은 연대기에 남긴다. */
export function recordReferendum(r: Referendum): void {
  const sid = ctx.curSaveId; if (!sid) return; const e = entry(sid); e.lastRef = r.date; e.refs = [...e.refs, r].slice(-20); save(); push();
  const pc = r.yes.toFixed(1) + '%';
  if (r.sham) chronNoteWorld(L(`${r.date} 「${r.title}」 국민투표가 찬성 ${pc}로 통과되었다. 외국 언론은 이를 두고 요식 투표라며 비꼬았다.`, `${r.date} The referendum on "${r.title}" passed with ${pc} in favour. Foreign newspapers mocked it as a rubber-stamp vote.`), true);
  else chronNoteWorld(L(`${r.date} 「${r.title}」 국민투표 결과 찬성 ${pc}로 ${r.passed ? '가결' : '부결'}되었다.`, `${r.date} The referendum on "${r.title}" was ${r.passed ? 'approved' : 'rejected'} with ${pc} in favour.`), true);
}
/** 국민투표 결과의 게임 효과(통과 = 위임 수정자, 부결 강행 = 거역 수정자) + 민심. */
export async function referendumEffect(kind: 'mandate' | 'defied', title: string): Promise<void> {
  const sid = ctx.curSaveId; if (!sid || !/^\d+$/.test(sid)) return;
  const mod = kind === 'mandate' ? { name: REF.mandateMod, days: REF.mandateDays } : { name: REF.defiedMod, days: REF.defiedDays };
  try { const req = ++link.reqCounter, m = await terminalRequest(civicCommand(req, sid, 'ref_' + kind, [mod]), 'CIVIC', req); if (m.kv.status === 'missing') logDiagnostic('warn', 'civic.modifier_missing', { mod: mod.name, hint: 'mod outdated' }); }
  catch (e) { logDiagnostic('warn', 'civic.ref_effect_failed', { error: (e as Error).message }); }
  moodNudge(kind === 'mandate' ? REF.moodPass : REF.moodDefy, kind === 'mandate' ? L(`국민투표 통과: ${title}`, `Referendum passed: ${title}`) : L(`국민투표 결과를 무시하고 강행: ${title}`, `Forced through against the referendum: ${title}`));
}

async function amnesty(tierIn: unknown, politicalIn: unknown): Promise<{ text: string }> {
  const sid = ctx.curSaveId || '', today = ctx.gameDate || '';
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 사면을 발표할 수 있습니다.', 'The game must be running to announce a pardon.'));
  if (!isTier(tierIn)) throw new Error(L('사면 범위를 골라 주세요.', 'Choose the scope of the pardon.'));
  const reg = civicRegimeNow(); if (reg === 'none') throw new Error(L('단일 의식 제국에는 사면할 시민이 없습니다.', 'A gestalt empire has no citizens to pardon.'));
  const e = entry(sid); if (amnestyUsed(e.amnesty, today)) throw new Error(L('특별사면은 1년에 한 번만 발표할 수 있습니다.', 'A special pardon can be announced only once a year.'));
  const occ = occasionNow(sid); if (!occ) throw new Error(L('특별사면은 국경일이나 행성 기념일이 든 달에만 발표할 수 있습니다.', 'A special pardon can only be announced in a month with a national holiday or planet holiday.'));
  const tier = tierIn, T = AMNESTY[tier], political = politicalIn === true;
  const facs = last && last.sid === sid ? last.factions : [];
  const up = political ? facs.filter((f) => f.fid !== undefined && f.ethic !== 'authoritarian').map((f) => f.fid!) : [];
  const down = political ? facs.filter((f) => f.fid !== undefined && f.ethic === 'authoritarian').map((f) => f.fid!) : [];
  const rec: Amnesty = { date: today, tier, political, occasion: occ, status: 'pending' }; e.amnesty = [...e.amnesty, rec].slice(-20); save(); // 요청 전에 기록 → 두 번 눌러도 한 번
  try {
    const req = ++link.reqCounter, m = await terminalRequest(civicCommand(req, sid, 'amnesty', [{ name: T.mod, days: AMNESTY_DAYS }], { up, down, upMod: AMNESTY_POL_UP, downMod: AMNESTY_POL_DOWN, days: AMNESTY_DAYS }), 'CIVIC', req);
    rec.status = m.kv.status === 'applied' ? 'applied' : m.kv.status === 'missing' ? 'missing' : 'unknown';
  } catch (err) { rec.status = 'failed'; save(); push(); throw err; }
  save(); push();
  if (rec.status === 'missing') logDiagnostic('warn', 'civic.modifier_missing', { mod: T.mod, hint: 'mod outdated' });
  chronNoteWorld(L(`${today} ${occ}을(를) 맞아 ${T.ko}을(를) 발표했다${political ? '(정치범 포함)' : ''}.`, `${today} Announced a ${T.en.toLowerCase()} for the ${occ}${political ? ' (including political prisoners)' : ''}.`), true);
  return { text: L(`${T.ko}을(를) 발표했습니다. 1년 동안 모든 행성 안정도 +${T.stab}, 범죄 +${T.crime}.${political ? ' 정치범도 풀려나 권위주의 파벌이 반발하고, 다른 파벌은 반깁니다.' : ''}${rec.status === 'missing' ? ' (게임 효과를 확인하지 못했습니다. 모드가 최신인지 확인해 주세요.)' : ''}`,
    `Announced a ${T.en.toLowerCase()}. For a year, all planets get +${T.stab} stability and +${T.crime} crime.${political ? ' Political prisoners are freed too: the authoritarian faction is angered, the others approve.' : ''}${rec.status === 'missing' ? ' (The game effect could not be confirmed. Check that the mod is up to date.)' : ''}`) };
}

export function registerCivic(router: LogRouter): void {
  Object.assign(civicHooks, { info: referendumInfo, record: recordReferendum, effect: referendumEffect, mood: () => moodView().score, pollLine: (paper: number, date: string) => { const sid = ctx.curSaveId; if (!sid) return ''; const e = entry(sid); return pollPromptLine(e.polls[e.polls.length - 1], paper, date); } }); // 정책 화면의 국민투표가 쓴다
  router.on(SLOT.CIVIC, 'civic', (m: SllmMessage) => { if (m.kind === 'CIVIC') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); });
  onGameSnapshot(onSnapshot, 'poll');
  registerSecFacts({ id: 'Approval polls', kw: ['여론', '여론조사', '지지율', '사면', '국민투표', 'poll', 'approval', 'pardon', 'amnesty', 'referendum'], facts: (sid) => {
    if (sid !== ctx.curSaveId) return []; const e = entry(sid), p = e.polls[e.polls.length - 1], out: string[] = [];
    if (p) out.push(pollFact(p));
    const a = e.amnesty[e.amnesty.length - 1]; if (a) out.push(`Last special pardon: ${a.date}, ${AMNESTY[a.tier].en}${a.political ? ' including political prisoners' : ''}.`);
    const r = e.refs[e.refs.length - 1]; if (r) out.push(`Last referendum: ${r.date} "${r.title}" — ${r.yes}% yes, ${r.passed ? 'passed' : 'rejected'}${r.sham ? ' (rubber-stamp vote)' : ''}.`);
    return out;
  } });
  ipcMain.handle('civicState', async () => civicView());
  ipcMain.handle('civicAmnesty', async (_e, tier: unknown, political: unknown) => { try { return { ok: true, ...(await amnesty(tier, political)), state: civicView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: civicView() }; } });
}
