// 시나리오 귀족 영역다툼 · 귀족 외교 1단계(앱 쪽, 2026-11-07). 규칙: src/scenario-domains.ts
// 설계: docs/SCENARIO_CORRIDOR_NOBLE_DIPLOMACY_DESIGN_20261107_KO.md — 영지는 앱 안의 보이지 않는 선(게임에는 아무것도 보내지 않음).
// 매달 섹터 보고(scenario-map-app)를 받다가 해가 바뀌면 연례 판단을 한 번. 결과는 연말 보고서(scenario-intel-app)로, 몰락만 바로 알린다.
// 저장: userData/sllm_scenario_domains.json(세이브별, 최근 12개).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ctx } from '../app/ctx';
import { settings } from '../app/settings';
import { link, enqueue, sendConsole } from '../app/game-link';
import { bgGrep } from '../app/bg-worker';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { withNobleSave, setDomainSource, nobleRevolted, knownNobles } from './scenario-nobles-app';
import { healthOnYear, healthRumors, healthDevState, healthDevYearReset, harmNoble } from './scenario-health-app';
import { chronNoteWorld } from './chronicle-app';
import { cnSyncLand, cnobleYear, cnDevTake, cnDev } from './scenario-cnobles-app';
import { devHooks } from './scenario-dev-hooks';
import { CR_NOBLES } from '../scenario-nobles-data';
import { CR_MAP_SYS, CR_MAP_LANES, CR_MAP_SEATS } from '../scenario-corridor-map-data';
import { buildSectorMap, mapIdOf, type ScnSectorBook, type RawSys } from '../scenario-map';
import { galaxyRaw } from './galaxy-app';
import { prettyName } from '../galaxy';
import { pairKey, shiftLoyal, shiftRel, rulerOf, type NobleSave, type NSide } from '../scenario-nobles';
import { factionOf, leaderOf, type FKey } from '../scenario-factions';
import {
  newDomainSave, fixDomainSave, yearTick, pressures, domainOf, DEATH, DEATH_NAME, type DeathWhy, grant, mediate, blocs, pactOf, opinion, neighbors, adjOf, sysName, sizeOf,
  plotTick, riseOf, plotOf, takeDomains, takeOath, revealPlots, PL, answerPetition, arrest, arrestChance, setLost, pledgedTo, aidPetitioner, eggPresser, backPlot, MED, monthTick, frontDetail, FR, garrisonOf, GAR, gekTick, gekBack, gekOf, gekStrength, GK, indTick, answerInd, IND, type PetChoice,
  type DomainSave, type DomCtx, type Holder, type GrantWhy, type Rise,
} from '../scenario-domains';

const KEEP = 12;
/** 수도 섹터에 든 거점(섹터가 따로 없음) — scenario-map-app 의 처음 배치와 같다. */
const CORE_HUBS = new Set([342, 396, 561, 263]); // 수도 섹터 안 거점 귀족 — 2026-11-08부터 이들도 영지를 가진다(옛 세이브는 migrateCore 로 한 번 나눠 준다)
const NOBLE_BY_ID = new Map(CR_NOBLES.map((n) => [n.id, n] as [number, (typeof CR_NOBLES)[number]]));

/** 처음 영지: 처음 배치 지도를 귀족 거점 섹터로 나눈 결과(지도 번호 → 귀족 번호, 직할령 -1/-2). */
let initCache: Record<string, Holder> | null = null;
function initialOwner(): Record<string, Holder> {
  if (initCache) return initCache;
  const adj = new Map<number, number[]>(); for (const [a, b] of CR_MAP_LANES) { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); }
  const capOf: Record<number, number> = { [CR_MAP_SEATS.a]: 1, [CR_MAP_SEATS.b]: 2, [CR_MAP_SEATS.p]: 3 };
  const raw: RawSys[] = CR_MAP_SYS.map(([id, x, y, z]) => ({ id, x, y, key: `SLLM_CR_SYS_${id}`, owner: z ? z : -1, hl: adj.get(id) ?? [], ...(capOf[id] !== undefined ? { cap: capOf[id] } : {}) }));
  const list: ScnSectorBook['list'] = [
    { side: 'a', cap: CR_MAP_SEATS.a, core: true, noble: false, nid: -1, female: false, age: 0, gov: '', name: '' },
    { side: 'b', cap: CR_MAP_SEATS.b, core: true, noble: false, nid: -1, female: false, age: 0, gov: '', name: '' },
  ];
  for (const n of CR_NOBLES) list.push({ side: n.side, cap: n.id, core: false, noble: true, nid: n.id, female: n.g === 'f', age: 0, gov: '', name: '' });
  const sm = buildSectorMap(raw, { a: 1, b: 2, p: 3 }, { date: '', list });
  const out: Record<string, Holder> = {};
  for (const s of sm.systems) { if (s.s < 0) continue; const sc = sm.sectors[s.s]; if (sc.side !== 'a' && sc.side !== 'b') continue; out[s.m] = sc.core ? (sc.side === 'a' ? -1 : -2) : sc.nid; }
  initCache = out; return out;
}

const file = () => path.join(app.getPath('userData'), 'sllm_scenario_domains.json');
let all: Record<string, DomainSave> | null = null;
function saves(): Record<string, DomainSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) { all[k] = fixDomainSave(v, () => newDomainSave(initialOwner())); migrateCore(all[k]); } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_domains', error: (e as Error).message }); }
  return all;
}
/** 옛 세이브: 수도 섹터 거점 귀족 넷이 영지 없이 시작했다 — 아직 군주 직할로 남은 성계 가운데 새 처음 배치에서 그 귀족 몫인 것을 한 번 나눠 준다. */
function migrateCore(ds: DomainSave): void {
  if (ds.coreV) return;
  const init = initialOwner();
  for (const id of CORE_HUBS) {
    if (ds.fallen[id]) continue;
    let n = 0;
    for (const [m, h] of Object.entries(init)) if (h === id && (ds.owner[m] === -1 || ds.owner[m] === -2)) { ds.owner[m] = id; n++; }
    if (n && ds.init[id] === undefined) ds.init[id] = n;
  }
  ds.coreV = 1;
}
let dirty: ReturnType<typeof setTimeout> | null = null;
function save(): void {
  if (dirty) return;
  dirty = setTimeout(() => {
    dirty = null;
    try {
      const s = saves(), keys = Object.keys(s); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete s[k];
      const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: s })); fs.renameSync(t, file());
    } catch (e) { logDiagnostic('warn', 'scenario_domains.save_failed', { error: (e as Error).message }); }
  }, 1000);
}
function stateOf(sid: string): DomainSave { const s = saves(); if (!s[sid]) s[sid] = newDomainSave(initialOwner()); return s[sid]; }
const on = (sid: string): boolean => { const scn = scenarioNow(); return !!scn && scn.id === 'corridor' && !!sid && ctx.curSaveId === sid; };

function domCtx(ds: DomainSave, ns: NobleSave): DomCtx {
  return {
    nobles: CR_NOBLES,
    alive: (id) => !ns.fate[id] && !ns.pending[id] && !ds.fallen[id],
    loyal: (id) => ns.loyal[id] ?? 100,
    rel: (a, b) => ns.rel[pairKey(a, b)] ?? 0,
    fac: (n) => factionOf(n),
    lead: (side, fk) => leaderOf(ns, CR_NOBLES, side, fk as FKey), // 위계·하극상(2026-11-07)
  };
}
const yearOf = (date: string): number => { const m = /^(\d{3,5})\./.exec(date || ''); return m ? Number(m[1]) : -1; };
const curYear = (): number => yearOf(ctx.gameDate || '');

/** scenario-map-app 이 섹터 보고 한 묶음을 다 받으면 부른다(정보국 연례 회의보다 먼저 — 연말 보고서에 같이 실리게). */
export function domainOnSectorBook(sid: string, book: ScnSectorBook): void {
  try {
    if (!on(sid)) return;
    const year = yearOf(book.date); if (year < 0) return;
    cnobleYear(sid, book.date); // 회랑의 귀족 연례(충성·배신, 해마다 한 번 — 2026-11-08)
    const ds = stateOf(sid);
    // 성계 쟁탈 줄다리기는 매달(앱 안에서만, 게임에 신호 없음 — 2026-11-07 사용자: 「하츠 오브 아이언 전투 현황판처럼」). 해가 바뀌는 달이면 연례 판단을 먼저.
    const mk = (/^(\d{3,5}\.\d{1,2})/.exec(book.date) || [])[1] || '';
    const monthly = () => { if (!mk || ds.year < 0) return; const mr = withNobleSave(sid, (ns) => { const x = monthTick(ds, domCtx(ds, ns), mk, year); if (!x) return null; for (const [id, d] of x.loyal) shiftLoyal(ns, id, d); for (const f of x.fallen) { delete ns.pending[f.id]; ns.fate[f.id] = 'fallen'; const n = NOBLE_BY_ID.get(f.id), by = NOBLE_BY_ID.get(f.by); if (n) ns.notes.push({ d: book.date, id: f.id, kind: 'fate', ko: `${n.ko}: 몰락${by ? ` (${by.ko} 가에게 마지막 거점을 잃음)` : ''}`, en: `${n.en}: Fallen${by ? ` (last seat lost to House ${by.en})` : ''}` }); } return x; }); if (!mr) return; save();
      for (const f of mr.fallen) { const n = NOBLE_BY_ID.get(f.id), by = NOBLE_BY_ID.get(f.by); if (n) ctx.notify({ kind: 'office', title: L('귀족 가문 몰락', 'A noble house has fallen'), body: L(`${n.ko} 가가 영지를 모두 잃고 몰락했습니다.${by ? ` 마지막 거점은 ${by.ko} 가에게 넘어갔습니다.` : ''}`, `House ${n.en} has lost all its lands and fallen.${by ? ` Its last seat passed to House ${by.en}.` : ''}`) }); } };
    const r = withNobleSave(sid, (ns) => {
      const res = yearTick(ds, { ...domCtx(ds, ns), year, rand: Math.random });
      if (!res) return null;
      // 2단계: 반란 밀약(같은 해에 이어서)
      const pr = plotTick(ds, { ...domCtx(ds, ns), year, rand: Math.random });
      for (const [id, d] of pr.loyal) shiftLoyal(ns, id, d);
      const h = ds.hist[ds.hist.length - 1]; if (h && h.y === year) h.lines.push(...pr.lines); // 연말 보고서(귀족 정세)에 같이 — 밀고는 아래에서 바로도 알린다
      (res as typeof res & { plot?: typeof pr }).plot = pr;
      // 3단계: 하극상(같은 해에 이어서) — 이긴 도전자가 세력 대표가 된다
      const gr = gekTick(ds, { ...domCtx(ds, ns), year, rand: Math.random });
      for (const [id, d] of gr.loyal) shiftLoyal(ns, id, d);
      for (const g of gr.lost) { const a = NOBLE_BY_ID.get(g.by); if (a) ns.notes.push({ d: book.date, id: g.by, kind: 'fate', ko: `${a.ko}: 하극상에 패해 처형됨`, en: `${a.en}: executed after a failed usurpation` }); } // 2026-11-08 영구 사망
      for (const g of gr.won) { ns.flead = { ...(ns.flead ?? {}), [`${g.side}_${g.fk}`]: g.by }; const a = NOBLE_BY_ID.get(g.by), b = NOBLE_BY_ID.get(g.vs); if (a && b) ns.notes.push({ d: book.date, id: g.by, kind: 'faction', ko: `${a.ko}: 하극상으로 ${b.ko} 가를 꺾고 세력 대표가 됨`, en: `${a.en}: overthrew House ${b.en} and became faction leader` }); }
      if (h && h.y === year) h.lines.push(...gr.lines);
      (res as typeof res & { gek?: typeof gr }).gek = gr;
      // 4단계: 평화로운 독립 요구(2026-11-08) — 허락되면 전쟁 없는 분리, 거절되면 앙심
      const seat0 = scenarioNow()?.seat, ir = indTick(ds, { ...domCtx(ds, ns), year, rand: Math.random }, seat0 === 'a' || seat0 === 'b' ? seat0 : null);
      for (const q of ir.refused) { shiftLoyal(ns, q.id, IND.refuseLoyal); shiftRel(ns, q.id, rulerOf(q.side), IND.refuseRel); }
      for (const q of ir.granted) if (!ds.rvq.some((x) => x.lead === q.id)) ds.rvq.push({ lead: q.id, members: [], why: 'grant' });
      if (h && h.y === year) h.lines.push(...ir.lines);
      (res as typeof res & { ind?: typeof ir }).ind = ir;
      // 5단계: 귀족 건강(2026-11-08) — 지병·소문. 소문 줄은 아는 귀족만 연말 보고서에, 병사는 아래에서 영구 사망으로
      const hr = healthOnYear(sid, year, CR_NOBLES.filter((n) => !ns.fate[n.id] && !ns.pending[n.id] && !ds.fallen[n.id]).map((n) => n.id), knownNobles(sid));
      if (h && h.y === year) h.lines.push(...hr.lines);
      (res as typeof res & { hp?: typeof hr }).hp = hr;
      // 국경 분쟁 청원: 플레이어가 그 나라 자리가 아니면 그 나라 군주(AI)가 다음 연례 판단 때 답한다 — 그 사이 회랑이 끼어들 수 있다
      const seat = scenarioNow()?.seat;
      for (const q of res.petitions ?? []) { const n = NOBLE_BY_ID.get(q.id); if (n && seat !== n.side) q.ai = true; }
      for (const [id, d] of res.loyal) shiftLoyal(ns, id, d);
      for (const f of res.fallen) {
        delete ns.pending[f.id]; ns.fate[f.id] = 'fallen';
        const n = NOBLE_BY_ID.get(f.id), by = f.by >= 0 ? NOBLE_BY_ID.get(f.by) : undefined;
        if (n) ns.notes.push({ d: book.date, id: f.id, kind: 'fate', ko: `${n.ko}: 몰락${by ? ` (${by.ko} 가에게 마지막 거점을 잃음)` : ''}`, en: `${n.en}: Fallen${by ? ` (last seat lost to House ${by.en})` : ''}` });
      }
      return res;
    });
    save();
    if (!r) { monthly(); if (ds.rvq.length) void flushRevolts(sid, book.date); void garSync(sid, 'month'); return; }
    for (const f of r.fallen) { // 몰락은 무거운 일 — 바로 알린다
      const n = NOBLE_BY_ID.get(f.id), by = f.by >= 0 ? NOBLE_BY_ID.get(f.by) : undefined; if (!n) continue;
      ctx.notify({ kind: 'office', title: L('귀족 가문 몰락', 'A noble house has fallen'), body: L(`${n.ko} 가가 영지를 모두 잃고 몰락했습니다.${by ? ` 마지막 거점은 ${by.ko} 가에게 넘어갔습니다.` : ''}`, `House ${n.en} has lost all its lands and fallen.${by ? ` Its last seat passed to House ${by.en}.` : ''}`) });
    }
    { const seat = scenarioNow()?.seat; const mine = (r.petitions ?? []).filter((q) => NOBLE_BY_ID.get(q.id)?.side === seat && !q.ai);
      if (mine.length) ctx.notify({ kind: 'office', title: L('국경 분쟁 청원', 'Border dispute petition'), body: L(`귀족 ${mine.length}가문이 국경 분쟁을 호소합니다: ${mine.map((q) => `${NOBLE_BY_ID.get(q.id)?.ko} ← ${NOBLE_BY_ID.get(q.vs)?.ko}`).join(', ')}. 제국 세력도에서 그 귀족을 눌러 답하세요(1년 안에 답하지 않으면 외면한 것이 됩니다).`, `${mine.length} house(s) petition you over border disputes: ${mine.map((q) => `${NOBLE_BY_ID.get(q.id)?.en} ← ${NOBLE_BY_ID.get(q.vs)?.en}`).join(', ')}. Answer from the Power Atlas by clicking the noble (no answer within a year counts as ignoring them).`) }); }
    const ir = (r as typeof r & { ind?: ReturnType<typeof indTick> }).ind;
    if (ir) for (const q of ir.started) { const n = NOBLE_BY_ID.get(q.id); if (!n) continue; const mineQ = scenarioNow()?.seat === q.side;
      ctx.notify({ kind: 'office', title: L('독립 요구', 'A plea for independence'), body: mineQ ? L(`${n.ko} 가가 폐하께 제 영지를 놓아 달라며 정식으로 독립을 청했습니다. 그 귀족의 영지 외교 탭에서 답하십시오(${IND.answerYears}년 안에 답하지 않으면 거절로 여깁니다).`, `House ${n.en} formally asks Your Majesty to let its domain go free. Answer from that noble's Diplomacy tab (no answer within ${IND.answerYears} years counts as a refusal).`) : L(`${sideKoOf(q.side)}: ${n.ko} 가가 군주에게 정식으로 독립을 청했습니다. 군주는 다음 연례 판단 때 답합니다 — 그 사이 회랑이 뒤에서 밀어 줄 수 있습니다.`, `${sideEnOf(q.side)}: House ${n.en} has formally asked its sovereign for independence. The sovereign answers at the next yearly pass — the Corridor can push for it meanwhile.`) }); }
    const gr = (r as typeof r & { gek?: ReturnType<typeof gekTick> }).gek;
    if (gr) { // 하극상은 무거운 일 — 시작·끝을 바로 알린다
      const nn = (id: number) => NOBLE_BY_ID.get(id);
      for (const g of gr.started) { const a = nn(g.by), b = nn(g.vs); if (a && b) ctx.notify({ kind: 'office', title: L('하극상', 'Usurpation'), body: L(`${sideKoOf(g.side)}: ${a.ko} 가가 자기 세력 대표 ${b.ko} 가에게 도전했습니다. 도전자 편 ${g.backA.length}가문 · 대표 편 ${g.backD.length}가문. 제국 세력도에서 두 귀족을 눌러 판세를 볼 수 있습니다.`, `${sideEnOf(g.side)}: House ${a.en} has challenged its own faction leader, House ${b.en}. ${g.backA.length} house(s) side with the challenger, ${g.backD.length} with the leader. Click either noble in the Power Atlas to follow it.`) }); }
      for (const g of gr.won) { const a = nn(g.by), b = nn(g.vs); if (a && b) ctx.notify({ kind: 'office', title: L('하극상 성공', 'Usurpation succeeds'), body: L(`${a.ko} 가가 ${b.ko} 가를 꺾고 세력 대표 자리를 차지했습니다.`, `House ${a.en} has overthrown House ${b.en} and taken the faction leadership.`) }); }
      for (const g of gr.lost) { const a = nn(g.by), b = nn(g.vs); if (a && b) ctx.notify({ kind: 'office', title: L('하극상 실패', 'Usurpation fails'), body: L(`${a.ko} 가의 도전이 꺾였습니다. ${b.ko} 가가 세력 대표 자리를 지켰습니다.`, `House ${a.en}'s challenge has collapsed. House ${b.en} keeps the faction leadership.`) }); }
      if (gr.started.length || gr.won.length || gr.lost.length) logDiagnostic('info', 'scenario_domains.gek', { sid, year, started: gr.started.length, won: gr.won.length, lost: gr.lost.length });
    }
    const pr = (r as typeof r & { plot?: ReturnType<typeof plotTick> }).plot;
    if (pr) {
      for (const lk of pr.leaks) { // 밀고 — 무거운 일, 바로
        const a = NOBLE_BY_ID.get(lk.who), b = NOBLE_BY_ID.get(lk.lead); if (!a || !b) continue;
        ctx.notify({ kind: 'office', title: L('반란 밀약 밀고', 'A conspiracy is betrayed'), body: L(`${a.ko} 가가 ${sideKoOf(b.side)} 군주에게 털어놓았습니다: ${b.ko} 가가 반란을 꾸미며 귀족들의 약속을 모으고 있습니다.`, `House ${a.en} has confessed to the ${sideEnOf(b.side)} sovereign: House ${b.en} is plotting rebellion and gathering pledges.`) });
      }
      for (const lk of pr.leaks) if (lk.patron) { const b = NOBLE_BY_ID.get(lk.lead); if (b) susHook(sid, b.side, MED.patronLeakSus); } // 회랑이 뒷배를 댄 밀약이 들킴
      for (const rs of pr.rises) queueRevolt(sid, ds, rs, 'plot');
      logDiagnostic('info', 'scenario_domains.plots', { sid, year, plots: ds.plots.length, started: pr.started.length, pledged: pr.pledged.length, leaks: pr.leaks.length, rises: pr.rises.length });
    }
    monthly();
    void flushRevolts(sid, book.date).catch(() => undefined).then(() => garSync(sid, 'year'));
    { const gk = (r as typeof r & { gek?: { lost: Array<{ by: number }> } }).gek; if (gk) for (const g of gk.lost) killInGame(sid, g.by); } // 하극상에 진 도전자 처형 — 게임에서도(2026-11-08)
    { const hp = (r as typeof r & { hp?: ReturnType<typeof healthOnYear> }).hp; // 병사·독사(2026-11-08 귀족 건강)
      if (hp) for (const d of hp.deaths) { const n = NOBLE_BY_ID.get(d.id); if (!n) continue;
        killNoble(sid, d.id, d.why, d.why === 'poison' ? [`${n.ko}이(가) 끝내 숨을 거두었습니다. 오래 앓던 병이라 했지만, 궁정에는 독이라는 말이 돕니다. 영지는 군주 직할이 되었습니다.`, `${n.en} has breathed their last. They called it a long illness, but the court whispers of poison. The domain passes to the crown.`]
          : [`${n.ko}이(가) 오랜 병 끝에 세상을 떠났습니다. 영지는 군주 직할이 되었습니다.`, `${n.en} has died after a long illness. The domain passes to the crown.`]); } }
    if (r.flips.length || r.lines.length) logDiagnostic('info', 'scenario_domains.year', { sid, year, flips: r.flips.length, lines: r.lines.length, fallen: r.fallen.length });
  } catch (e) { logDiagnostic('warn', 'scenario_domains.tick_failed', { error: (e as Error).message }); }
}

// ---- 반란 실행(2단계, 2026-11-07): 앱이 고른 성계 목록을 게임에 넘긴다. 게임 섹터와 상관없이(영지 = 앱 섹터) ----
const sideKoOf = (sd: NSide): string => (sd === 'a' ? '은하 얼라이언스' : '인류 제국');
const sideEnOf = (sd: NSide): string => (sd === 'a' ? 'Galactic Alliance' : 'Human Empire');
const gOf = (id: number): string => ({ m: 'male', f: 'female', x: 'indeterminate' } as const)[NOBLE_BY_ID.get(id)?.g ?? 'm'];
function queueRevolt(sid: string, ds: DomainSave, rs: Rise, why: 'plot' | 'incite'): void {
  if (ds.rvq.some((q) => q.lead === rs.lead)) return;
  ds.rvq.push({ lead: rs.lead, members: rs.members, why });
  if (rs.refused.length) {
    const b = NOBLE_BY_ID.get(rs.lead), names = rs.refused.map((id) => NOBLE_BY_ID.get(id)).filter(Boolean);
    if (b && names.length) { const h = ds.hist[ds.hist.length - 1]; const line = { ko: `${b.ko} 가에게 약속했던 ${names.map((n) => n!.ko).join('·')} 가는 끝내 따라나서지 않았습니다.`, en: `${names.map((n) => 'House ' + n!.en).join(', ')} broke their word to House ${b.en} and stayed home.` }; if (h) h.lines.push(line); }
  }
  save();
}
const ready = () => !!(ctx.gameRunning && link.sessionReady);
/** 회랑 정보국의 의심도를 바꾸는 통로(정보국이 등록 — 그쪽이 이 파일을 가져오므로). */
let susHook: (sid: string, side: NSide, d: number) => void = () => { /* 정보국이 아직 등록 안 됨 */ };
export function setSusHook(fn: (sid: string, side: NSide, d: number) => void): void { susHook = fn; }
const payEnergy = (n: number) => enqueue(() => sendConsole(`effect add_resource = { energy = -${Math.round(n)} }`));
let flushing = false;
/** 미뤄 둔 반란을 게임에 실행. 성계 표식 → 반란국 만들기 → 함께한 귀족을 그 나라 지도자로. */
async function flushRevolts(sid: string, date: string): Promise<void> {
  const ds = saves()[sid]; if (!ds || !ds.rvq.length || flushing || !ready() || ctx.curSaveId !== sid) return;
  flushing = true;
  try {
    while (ds.rvq.length) {
      const q = ds.rvq[0], lead = NOBLE_BY_ID.get(q.lead); if (!lead) { ds.rvq.shift(); continue; }
      const alive = withNobleSave(sid, (ns) => (id: number) => !ns.fate[id] && !ds.fallen[id]);
      if (!alive(q.lead)) { ds.rvq.shift(); continue; }
      const members = q.members.filter((m) => alive(m) && NOBLE_BY_ID.get(m)?.side === lead.side);
      const patron = !!ds.plots.find((p) => p.lead === q.lead)?.patron; // takeDomains 가 밀약을 지우기 전에
      const sys = takeDomains(ds, [q.lead, ...members]);
      for (const m of sys) ds.rebel[m] = q.lead; ds.rebelY[q.lead] = curYear(); // 지도에서 그 땅을 반란국으로 그린다(2026-11-08)
      ds.rebelW[q.lead] = q.why === 'incite' ? 'incite' : q.why === 'grant' ? 'grant' : patron ? 'patron' : 'plot'; // 회랑이 부추겼나·후원했나(반란국 군주 접견에서 은혜로)
      const marks = sys.filter((m) => m !== CR_MAP_SEATS.a && m !== CR_MAP_SEATS.b);
      for (let i = 0; i < marks.length; i += 12) { const part = marks.slice(i, i + 12).map((m) => `sllm_cr_rv_mark = { M = ${m} }`).join(' '); await enqueue(() => sendConsole(`effect ${part}`)); }
      await enqueue(() => sendConsole(`effect sllm_cr_revolt_list = { N = ${q.lead} K = ${lead.side}_${q.lead} G = ${gOf(q.lead)} S = ${lead.side}${q.why === 'grant' ? '' : ' WAR = yes'} }`)); // 허락받은 독립이면 전쟁 없이(2026-11-08)
      for (const m of members) await enqueue(() => sendConsole(`effect sllm_cr_revolt_member = { N = ${m} K = ${lead.side}_${m} G = ${gOf(m)} }`));
      ds.rvq.shift(); save();
      for (const id of [q.lead, ...members]) nobleRevolted(sid, id, date);
      const names = members.map((m) => NOBLE_BY_ID.get(m)).filter(Boolean) as Array<(typeof CR_NOBLES)[number]>;
      const ko = names.length ? `${lead.ko} 가가 ${names.map((n) => n.ko).join('·')} 가와 함께 반기를 들었습니다. 영지 성계 ${marks.length}곳이 ${sideKoOf(lead.side)}에서 떨어져 나가 새 나라가 되었습니다.` : `${lead.ko} 가가 반기를 들었습니다. 영지 성계 ${marks.length}곳이 ${sideKoOf(lead.side)}에서 떨어져 나가 새 나라가 되었습니다.`;
      const en = names.length ? `House ${lead.en} has risen in revolt together with ${names.map((n) => 'House ' + n.en).join(', ')}. ${marks.length} systems have broken away from the ${sideEnOf(lead.side)} as a new nation.` : `House ${lead.en} has risen in revolt. ${marks.length} systems have broken away from the ${sideEnOf(lead.side)} as a new nation.`;
      if (q.why === 'grant') { // 평화로운 독립(2026-11-08)
        const gk = `${sideKoOf(lead.side)} 군주가 ${lead.ko} 가의 독립을 허락했습니다. 영지 성계 ${marks.length}곳이 전쟁 없이 떨어져 나가 새 나라가 되었습니다.`, ge = `The ${sideEnOf(lead.side)} sovereign has granted House ${lead.en} its independence. ${marks.length} systems have departed peacefully as a new nation.`;
        ctx.notify({ kind: 'office', title: L('평화로운 독립', 'A peaceful independence'), body: L(gk, ge) });
        try { chronNoteWorld(L(gk, ge), true); } catch { /* 덤 */ }
        const h0 = ds.hist[ds.hist.length - 1]; if (h0) h0.lines.push({ ko: gk, en: ge, grave: true });
        logDiagnostic('info', 'scenario_domains.revolt', { sid, lead: q.lead, members: '', systems: marks.length, why: q.why });
        continue;
      }
      ctx.notify({ kind: 'office', title: names.length ? L('연합 반란', 'A coalition revolt') : L('반란', 'Rebellion'), body: L(ko, en) });
      try { chronNoteWorld(L(ko, en), true); } catch { /* 덤 */ }
      const h = ds.hist[ds.hist.length - 1]; if (h) h.lines.push({ ko, en, grave: true });
      logDiagnostic('info', 'scenario_domains.revolt', { sid, lead: q.lead, members: members.join(','), systems: marks.length, why: q.why });
    }
  } catch (e) { logDiagnostic('warn', 'scenario_domains.revolt_failed', { error: (e as Error).message }); }
  finally { flushing = false; save(); }
}
// ---- 영지 수비대(2026-11-07): 귀족 거점의 방어 플랫폼·민병대를 게임에 맞춘다 ----
// 게임 쪽: common/scripted_effects/sllm_cr_garrison_effects.txt(숨은 수비대 나라 sllm_cr_garrison, 강대국마다 하나).
// 크기는 연례 회의 때만(달라진 귀족만, GAR.refit 년마다 한 번은 모두 다시 — 전쟁에서 부서진 것 채우기), 매달은 충성 단계가 바뀌어 손을 놓거나 다시 잡을 때만.
// 전쟁 상태 맞추기(sllm_cr_gar_mirror)는 게임이 전쟁 시작·끝(on_war_beginning/on_war_ended)과 해마다 스스로 한다 — 앱은 다시 짤 때 한 번만.
let garBusy = false;
function garWant(ds: DomainSave, ns: NobleSave): Map<number, [number, number, number]> {
  const sizes = sizeOf(ds), out = new Map<number, [number, number, number]>();
  for (const n of CR_NOBLES) {
    const alive = !ns.fate[n.id] && !ns.pending[n.id] && !ds.fallen[n.id];
    const g = alive ? garrisonOf(n, sizes.get(n.id) ?? 0, ns.loyal[n.id] ?? 100) : { p: 0, c: 0, passive: false };
    out.set(n.id, [g.p, g.c, g.passive ? 1 : 0]);
  }
  return out;
}
async function garSync(sid: string, why: 'year' | 'month' | 'dev'): Promise<number> {
  const ds = saves()[sid]; if (!ds || garBusy || !ready() || ctx.curSaveId !== sid) return 0; // 2026-11-08: 첫 연례 회의를 기다리지 않는다(처음 보는 세이브면 바로 모두 세운다)
  const year = curYear(); if (year < 0) return 0;
  garBusy = true; let sent = 0;
  try {
    const want = withNobleSave(sid, (ns) => garWant(ds, ns));
    const full = why === 'dev' || ds.garY < 0 || (why === 'year' && year - ds.garY >= GAR.refit);
    const parts: string[] = [];
    for (const [id, w] of want) {
      const n = NOBLE_BY_ID.get(id)!, had = ds.gar[id] ?? [0, 0, 0], m = w[2] ? 'passive' : 'aggressive';
      const sizeCh = w[0] !== had[0] || w[1] > had[1];
      if (full ? (w[0] || had[0]) : why === 'year' ? sizeCh || w[2] !== had[2] : had[0] > 0 && w[2] !== had[2] && !sizeCh) {
        if (!full && why === 'month') parts.push(`sllm_cr_gar_stance = { S = ${n.side} N = ${id} M = ${m} }`);
        else {
          parts.push(w[0] > 0 ? `sllm_cr_gar_set = { S = ${n.side} N = ${id} K = ${n.side}_${id} P = ${w[0]} M = ${m} }` : `sllm_cr_gar_clear = { S = ${n.side} N = ${id} }`);
          if (w[1] > had[1]) parts.push(`sllm_cr_gar_mil = { S = ${n.side} N = ${id} C = ${w[1] - had[1]} }`); // 민병대는 늘어난 만큼만(게임 쪽은 줄이지 않는다)
        }
        ds.gar[id] = why === 'month' && !full ? [had[0], had[1], w[2]] : [w[0], Math.max(w[1], had[1]), w[2]];
      }
    }
    if (!parts.length && !full) return 0;
    if (full) for (const sd of ['a', 'b'] as const) { await enqueue(() => sendConsole(`effect sllm_cr_gar_ensure = { S = ${sd} }`)); ds.garOk[sd] = 1; }
    for (let i = 0; i < parts.length; i += 4) { const line = parts.slice(i, i + 4).join(' '); await enqueue(() => sendConsole(`effect ${line}`)); sent++; }
    if (full) { for (const sd of ['a', 'b'] as const) await enqueue(() => sendConsole(`effect sllm_cr_gar_mirror = { S = ${sd} }`)); ds.garY = year; }
    save();
    logDiagnostic('info', 'scenario_domains.garrison', { sid, why, full, effects: parts.length, lines: sent });
  } catch (e) { logDiagnostic('warn', 'scenario_domains.garrison_failed', { error: (e as Error).message }); }
  finally { garBusy = false; }
  return sent;
}
/** 회랑 정보국 「반란 부추기기」: 그 귀족이 밀약을 모아 두었다면 약속한 귀족들도 함께(연합 반란). 게임이 준비 안 됐으면 미뤄 둔다. */
export function inciteRevolt(sid: string, id: number, date: string): void {
  const ds = stateOf(sid), pl = plotOf(ds, id);
  const rs: Rise = pl ? withNobleSave(sid, (ns) => riseOf(ds, { ...domCtx(ds, ns), rand: Math.random }, pl)) : { lead: id, members: [], refused: [] };
  if (pl) ds.plots = ds.plots.filter((p) => p !== pl);
  queueRevolt(sid, ds, rs, 'incite');
  void flushRevolts(sid, date);
}
/** 첩보 「인연 캐기」가 성공하면 그 귀족이 얽힌 밀약도 드러난다. 드러난 약속 수. */
export function revealPlotsOf(sid: string, id: number): number { try { const n = revealPlots(stateOf(sid), id); if (n) save(); return n; } catch { return 0; } }

/** 은하 지도(scenario-map-app)가 세이브를 읽을 때마다: 영지 장부의 성계 중 지금 그 진영 나라 땅이 아닌 것을 영지 계산에서 뺀다(전쟁·점령). */
export function domainSyncOwners(sid: string, systems: Array<{ m: number; o: number }>, sideOwner: Partial<Record<'a' | 'b' | 'p', number>>): void {
  try {
    const ds = saves()[sid]; if (!ds) return;
    cnSyncLand(sid, systems, sideOwner.p, ds.owner); // 회랑의 귀족: 회랑이 차지한 강대국 땅(장부가 바뀌기 전에, 2026-11-08)
    const sideOf = (h: Holder): NSide | null => (h === -1 ? 'a' : h === -2 ? 'b' : NOBLE_BY_ID.get(h)?.side ?? null);
    const lost: number[] = [];
    for (const q of systems) { if (q.m < 0) continue; const h = ds.owner[q.m]; if (h === undefined) continue; const sd = sideOf(h), want = sd ? sideOwner[sd] : undefined; if (want !== undefined && q.o !== want) lost.push(q.m); }
    let ch = setLost(ds, lost);
    // 반란국 땅을 강대국이 되찾았으면(반란한 다음 해부터, 세이브 주인이 그 강대국) 군주 직할로 되돌린다
    const y = curYear();
    for (const q of systems) { if (q.m < 0) continue; const lead = ds.rebel[q.m]; if (lead === undefined) continue; const n = NOBLE_BY_ID.get(lead); const want = n ? sideOwner[n.side] : undefined;
      if (want !== undefined && q.o === want && y > (ds.rebelY[lead] ?? y)) { delete ds.rebel[q.m]; ds.owner[q.m] = n!.side === 'a' ? -1 : -2; ch = true; } }
    if (dieCheck(sid, ds, systems, sideOwner, y)) ch = true;
    if (ch) save();
  } catch (e) { logDiagnostic('warn', 'scenario_domains.sync_failed', { error: (e as Error).message }); }
}
// ---- 귀족의 영구 사망(2026-11-08 사용자: 「반란 실패 / 다른 제국에 귀족의 모든 행성을 빼앗기면 그 귀족은 영구히 죽었으면」) ----
// 반란 실패: 반란한 다음 해부터, 그 귀족의 반란국 성계가 하나도 반란국 손에 남지 않음(모두 강대국·회랑 소유로 돌아감).
// 정복: 살아 있는 귀족의 영지 성계가 모두 제국 밖(다른 나라 소유)으로 넘어감 — 잠깐의 어긋남에 죽지 않게 두 번 연속 확인.
// 죽으면 몰락 기록(ds.fallen, why)에 남기고 게임에서도 그 귀족 지도자를 죽인다(sllm_cr_noble_die). 되살아나지 않는다.
/** 다른 기능이 귀족을 영구히 죽인다(첩보 암살 등, 2026-11-08). 영지는 군주 직할, 게임에서도 지도자를 죽인다. */
export function killNoble(sid: string, id: number, why: DeathWhy, text?: [string, string]): boolean {
  const ds = saves()[sid], n = NOBLE_BY_ID.get(id); if (!ds || !n || ds.fallen[id]) return false;
  const y = curYear();
  withNobleSave(sid, (ns) => { ds.fallen[id] = { by: -1, y, why }; delete ns.pending[id]; if (!ns.fate[id]) ns.fate[id] = 'fallen'; for (const [k, o] of Object.entries(ds.owner)) if (o === id) { ds.owner[k] = CROWN_OF[n.side]; delete ds.pend[k]; } ds.pacts = ds.pacts.filter((p) => p.a !== id && p.b !== id); ds.plots = ds.plots.filter((p) => p.lead !== id); ns.notes.push({ d: ctx.gameDate || '', id, kind: 'fate', ko: `${n.ko}: ${DEATH_NAME[why][0]}`, en: `${n.en}: ${DEATH_NAME[why][1]}` }); });
  save(); killInGame(sid, id);
  const [ko, en] = text ?? [`${n.ko}이(가) 숨진 채 발견되었습니다. 영지는 군주 직할이 되었습니다.`, `${n.en} has been found dead. The domain passes to the crown.`];
  ctx.notify({ kind: 'office', title: L('귀족의 죽음', 'A noble has died'), body: L(ko, en) }); try { chronNoteWorld(L(`${ctx.gameDate || ''} ${ko}`, `${ctx.gameDate || ''} ${en}`)); } catch { /* 덤 */ }
  logDiagnostic('info', 'scenario_domains.noble_died', { sid, id, why });
  return true;
}
/** 그 귀족 지도자를 게임에서도 죽인다(영구 사망, 2026-11-08). 게임이 안 켜져 있으면 넘어간다(앱 기록은 이미 사망). */
function killInGame(sid: string, id: number): void {
  if (ready() && ctx.curSaveId === sid) void enqueue(() => sendConsole(`effect sllm_cr_noble_die = { N = ${id} }`)).catch((e) => logDiagnostic('warn', 'scenario_domains.die_failed', { error: (e as Error).message }));
}
const lostSeen = new Map<string, number>();
function dieCheck(sid: string, ds: DomainSave, systems: Array<{ m: number; o: number }>, sideOwner: Partial<Record<'a' | 'b' | 'p', number>>, y: number): boolean {
  if (y < 0) return false;
  const major = new Set(Object.values(sideOwner).filter((v): v is number => v !== undefined)), ownerOf = new Map(systems.map((q) => [q.m, q.o]));
  const deaths: Array<{ id: number; why: DeathWhy }> = [];
  withNobleSave(sid, (ns) => {
    // 반란 실패(독립 요구를 거절당한 뒤의 반란이면 공개 처형)
    for (const k of Object.keys(ds.rebelY)) {
      const id = Number(k); if (ds.fallen[id] || !(y > (ds.rebelY[id] ?? y))) continue;
      const mine = Object.entries(ds.rebel).filter(([, l]) => l === id).map(([m]) => Number(m)), known = mine.filter((m) => ownerOf.has(m));
      if (!mine.length || (known.length && known.every((m) => major.has(ownerOf.get(m)!)))) deaths.push({ id, why: ds.indRef?.[id] !== undefined ? 'public' : 'revolt' });
    }
    // 살아 있는 귀족: 거점 성계(= 귀족 번호)를 다른 나라에 빼앗김 → 거점 함락 · 영지 전부 → 정복(두 번 연속 확인)
    for (const n of CR_NOBLES) {
      if (ns.fate[n.id] || ns.pending[n.id] || ds.fallen[n.id]) continue;
      const dom = domainOf(ds, n.id), key = `${sid}:${n.id}`;
      const all = dom.length > 0 && dom.every((m) => ds.lost[m]), seat = ds.owner[n.id] === n.id && !!ds.lost[n.id];
      if (all || seat) { const c = (lostSeen.get(key) ?? 0) + 1; lostSeen.set(key, c); if (c >= 2) deaths.push({ id: n.id, why: all ? 'conquest' : 'seat' }); }
      else lostSeen.delete(key);
    }
    for (const d of deaths) {
      ds.fallen[d.id] = { by: -1, y, why: d.why };
      if (d.why === 'conquest' || d.why === 'seat') { delete ns.pending[d.id]; ns.fate[d.id] = 'fallen'; for (const [k, o] of Object.entries(ds.owner)) if (o === d.id) ds.owner[k] = CROWN_OF[NOBLE_BY_ID.get(d.id)!.side]; }
      if (d.why === 'public') { const n = NOBLE_BY_ID.get(d.id)!; for (const m of CR_NOBLES) if (m.side === n.side && m.id !== d.id && !ns.fate[m.id] && !ds.fallen[m.id]) shiftLoyal(ns, m.id, ds.ind.some((q) => q.id === m.id) ? DEATH.publicInd : DEATH.publicFear); }
      const n = NOBLE_BY_ID.get(d.id); if (n) ns.notes.push({ d: ctx.gameDate || '', id: d.id, kind: 'fate', ko: `${n.ko}: ${DEATH_NAME[d.why][0]}`, en: `${n.en}: ${DEATH_NAME[d.why][1]}` });
    }
  });
  for (const d of deaths) {
    const n = NOBLE_BY_ID.get(d.id); if (!n) continue;
    const T: Record<string, [string, string]> = {
      revolt: [`${n.ko} 가의 반란이 끝내 꺾였습니다. 반란국의 마지막 땅까지 무너졌고, ${n.ko}은(는) 목숨을 잃었습니다. 이 가문은 다시 일어서지 못합니다.`, `House ${n.en}'s revolt has been crushed. The last of the breakaway realm fell and ${n.en} is dead. The house will never rise again.`],
      public: [`독립을 거절당하고 칼을 들었던 ${n.ko} 가의 반란이 꺾였습니다. ${n.ko}은(는) 광장에서 공개 처형되었습니다. 귀족들은 공포에 떨고, 독립을 바라던 가문들은 분노를 삼킵니다.`, `House ${n.en}, which took up arms after its plea for independence was refused, has been crushed. ${n.en} was publicly executed. The nobility trembles, and the houses that longed for independence swallow their rage.`],
      conquest: [`${n.ko} 가의 영지가 모두 다른 나라에 넘어갔습니다. ${n.ko}은(는) 영지와 함께 목숨을 잃었습니다. 이 가문은 다시 일어서지 못합니다.`, `Every system of House ${n.en} has fallen to a foreign power. ${n.en} died with the domain. The house will never rise again.`],
      seat: [`${n.ko} 가의 거점이 적의 손에 넘어갔습니다. ${n.ko}은(는) 거점과 함께 최후를 맞았고, 남은 영지는 군주 직할이 되었습니다.`, `The seat of House ${n.en} has fallen to the enemy. ${n.en} died with it, and the remaining domain passes to the crown.`],
    };
    const [ko, en] = T[d.why] ?? T.revolt;
    ctx.notify({ kind: 'office', title: d.why === 'public' ? L('공개 처형', 'A public execution') : L('귀족의 죽음', 'A noble has died'), body: L(ko, en) });
    try { chronNoteWorld(L(`${ctx.gameDate || ''} ${ko}`, `${ctx.gameDate || ''} ${en}`)); } catch { /* 연대기는 덤 */ }
    killInGame(sid, d.id);
    logDiagnostic('info', 'scenario_domains.noble_died', { sid, id: d.id, why: d.why });
  }
  return deaths.length > 0;
}
const CROWN_OF: Record<NSide, Holder> = { a: -1, b: -2 };
/** 접견 프롬프트에 덧붙일 영지 사정(2026-11-07): 귀족이면 자기 영지·이웃·협약·분쟁·밀약(숨길 것은 숨기라고), 군주면 궁정의 다툼. 영어(프롬프트). */
/** 접견 프롬프트에 붙이는 영지 사정(2026-11-07 사용자: 「귀족 AI 들은 자신의 분쟁에 대해 잘 알고 있어야」).
 *  귀족: 자기 영지·잃고 얻은 성계·성계 쟁탈 줄다리기 하나하나(상대·진척·기세·양쪽 공작·군주 편들기·회랑 돈)·협약·원한·청원·수비대·밀약(비밀).
 *  군주: 나라 안 귀족 다툼 가운데 큰 것, 청원, 몰락, 손 놓은 수비대, 드러난 밀약. 숫자는 「감」으로 말하게 한다(수치를 줄줄 읊지 말 것). */
export function domainBrief(sid: string, t: { kind: string; id?: number; side?: string }): string {
  try {
    const ds = saves()[sid]; if (!ds) return '';
    return withNobleSave(sid, (ns) => {
      const c = domCtx(ds, ns), pr = pressures(ds, c), sizes = sizeOf(ds), out: string[] = [], year = curYear();
      const en = (id: number) => (id === -1 ? 'the Alliance crown' : id === -2 ? 'the Imperial crown' : NOBLE_BY_ID.get(id)?.en ?? String(id));
      const sn = (sys: number) => sysName(sys)[1];
      const OP: Record<string, string> = { bribe: 'bribing local officials', agitate: 'stirring up the populace', settle: 'settling colonists', force: 'shows of armed force', garrison: 'tightening security', appease: 'winning hearts with favours' };
      const trend = (m: number) => (m >= 6 ? 'fast' : m >= 2 ? 'steadily' : m > 0 ? 'slowly' : m <= -6 ? 'and is being thrown back hard' : m < 0 ? 'and is being pushed back' : 'and has stalled');
      const recent = (): Array<[number, Holder, Holder, number]> => { // 지난 두 해 + 올해 달마다 넘어간 성계
        const rows: Array<[number, Holder, Holder, number]> = [];
        for (const h of ds.hist.slice(-2)) for (const [a, b, c2] of h.ch) rows.push([a, b, c2, h.y]);
        for (const [a, b, c2] of ds.buf.ch) rows.push([a, b, c2, year]);
        return rows;
      };
      if (t.kind === 'noble' && t.id !== undefined) {
        const id = t.id, n = NOBLE_BY_ID.get(id); if (!n) return '';
        const rl = rebelLord(sid, id);
        if (rl) { // 반란국 군주(2026-11-08)
          const from = n.side === 'a' ? 'the Galactic Alliance' : 'the Human Empire';
          if (rl.why === 'grant') out.push(`You are no longer a noble of ${from}: your former sovereign granted you independence in peace${rl.since >= 0 ? ` in ${rl.since}` : ''}, and you now rule your own realm of ${rl.n} systems. You speak as a head of state, careful to keep that peace.`);
          else out.push(`You are no longer a noble of ${from}: you led a revolt${rl.since >= 0 ? ` in ${rl.since}` : ''} and now rule your own breakaway realm of ${rl.n} systems, fighting a war of independence against your former sovereign. You speak as a head of state now, proud but precarious.`);
          if (rl.why === 'incite') out.push('The Corridor stirred your people to rise — you owe the player for the moment you seized, and you know they used you too.');
          else if (rl.why === 'patron') out.push('The Corridor secretly promised to back your rising — you count the player as a patron, and expect them to keep their word.');
          if (rl.gifts) out.push(`The Corridor has handed you ${rl.gifts} warfleet(s) for your war — a debt you openly acknowledge.`);
          out.push(rl.why === 'grant' ? 'You parted from your former sovereign on proper terms; you may still seek trade, recognition or friendship from the player.' : 'Your former sovereign calls you a traitor. You may seek recognition, arms, money or alliance from the player; you will not return to your old allegiance.');
          return `\nYour situation: ${out.join(' ')}`;
        }
        const sz = sizes.get(id) ?? 0, ini = ds.init[id] ?? 0;
        out.push(`Your domain (the lands you truly hold inside the realm): ${sz} systems; your house began with ${ini}${sz > ini ? ' — you have grown' : sz < ini ? ' — you have been diminished and it stings' : ''}.`);
        const rc = recent(), lost = rc.filter((r) => r[1] === id), won = rc.filter((r) => r[2] === id);
        if (lost.length) out.push(`Recently lost: ${lost.slice(-4).map((r) => `${sn(r[0])} to ${en(r[2])} (${r[3]})`).join('; ')}. You remember every one.`);
        if (won.length) out.push(`Recently won: ${won.slice(-4).map((r) => `${sn(r[0])} from ${en(r[1])} (${r[3]})`).join('; ')}.`);
        // 성계 쟁탈 줄다리기 — 내가 지키는 것, 내가 미는 것
        const fr = Object.entries(ds.front).map(([k, f]) => ({ sys: Number(k), f, o: ds.owner[k] })).filter((x) => x.o === id || x.f.by === id).sort((a, b) => b.f.p - a.f.p);
        const def = fr.filter((x) => x.o === id).slice(0, 4), att = fr.filter((x) => x.f.by === id).slice(0, 4);
        if (def.length) out.push(`Systems of yours under contest (how far the rival's hold has crept in, 0-100%; at 100% it is theirs): ${def.map(({ sys, f }) => `${sn(sys)} — ${en(f.by)} has got ${Math.round(f.p)}% ${trend(f.mom)}, by ${OP[f.aOp]}; you answer by ${OP[f.dOp]}${(ds.lock[sys] ?? -1) >= year ? '; your sovereign has ruled it stays yours this year' : ''}${f.aidD ? '; you are quietly receiving outside money to hold it' : ''}${f.aidA ? `; someone is funding ${en(f.by)}'s push — you suspect foreign coin` : ''}`).join('. ')}.`);
        if (att.length) out.push(`Systems you are working to take (your hold so far): ${att.map(({ sys, f, o }) => `${sn(sys)} from ${en(o)} — ${Math.round(f.p)}% ${trend(f.mom)}, by ${OP[f.aOp]} against their ${OP[f.dOp]}${(ds.lock[sys] ?? -1) >= year ? '; the sovereign has forbidden you to take it this year and you chafe at it' : ''}${f.aidA ? '; outside money is helping you' : ''}`).join('. ')}.`);
        { // 위계·하극상
          const ld = leaderOf(ns, CR_NOBLES, n.side, factionOf(n)), g = gekOf(ds, id);
          if (ld && ld.id === id) out.push('As faction leader, the lesser houses of your faction do not encroach on your land, and you do not take theirs — you keep order among them and settle their quarrels.');
          else if (ld) out.push(`${en(ld.id)} leads your faction; you would never take land from them unless you openly challenged them for the leadership.`);
          if (g) { const st = gekStrength(ds, c, g), mineA = g.by === id; const lean = g.sc > 15 ? (mineA ? 'you are winning' : 'the challenger is gaining on you') : g.sc < -15 ? (mineA ? 'it is going badly for you' : 'you are holding them down') : 'it hangs in the balance';
            out.push(mineA ? `You have openly challenged ${en(g.vs)} for the leadership of your faction (since ${g.since}); ${g.backA.length ? `${g.backA.map(en).join(', ')} stand with you` : 'no house stands with you'}, ${g.backD.length} with the leader; ${lean}${g.aid ? '; foreign money is quietly flowing to you' : ''}${g.crown ? '; the sovereign has sided against you, and you resent it' : ''}. Your relative strength now: ${Math.round((st.A / ((st.A + st.D) || 1)) * 100)}%.`
              : `${en(g.by)} has dared to challenge you for the faction leadership (since ${g.since}) — an outrage; ${g.backA.length ? `${g.backA.map(en).join(', ')} side with them` : 'no house sides with them'}, ${g.backD.length} stand by you; ${lean}${g.crown ? '; the sovereign stands with you' : ''}.`); }
          else { const sideG = ds.gek.find((x) => x.backA.includes(id) || x.backD.includes(id)); if (sideG) out.push(`In the challenge of ${en(sideG.by)} against the faction leader ${en(sideG.vs)}, you side with ${sideG.backA.includes(id) ? en(sideG.by) : en(sideG.vs)}.`); }
        }
        { const iq = ds.ind.find((x) => x.id === id); if (iq) out.push(`In ${iq.y} you formally asked your sovereign to let your domain go free in peace, and you await the answer${iq.back ? '; the Corridor has quietly lent weight to your plea' : ''}. You hope to part without bloodshed, but a refusal would leave you bitter.`); }
        const pressedOnly = pr.filter((p) => p.owner === id && !ds.front[p.sys]).length; if (pressedOnly) out.push(`Pressure is building on ${pressedOnly} more of your border systems.`);
        // 이웃·협약
        const nb = [...(neighbors(ds).get(id) ?? [])].map((o) => { const pc = pactOf(ds, id, o); return `${en(o)} (${Math.round(opinion(ds, c, id, o))}${pc ? `, ${pc.k === 'nap' ? 'non-aggression pact' : pc.k === 'ally' ? 'alliance' : 'blood feud'} since ${pc.since}` : ''})`; });
        if (nb.length) out.push(`Neighbouring houses and how you regard them (-100..100): ${nb.join('; ')}.`);
        const fallenNear = Object.entries(ds.fallen).filter(([, v]) => v.y >= year - 3).map(([k, v]) => `${en(Number(k))} (fell to ${en(v.by)}, ${v.y})`);
        if (fallenNear.length) out.push(`Houses that have fallen of late — lost every last system and ended: ${fallenNear.slice(-3).join('; ')}. It frightens and hardens the others.`);
        const q = ds.pets.find((x) => x.id === id); if (q) out.push(`You have petitioned your sovereign for help against ${en(q.vs)} (${q.y}) and are still waiting for an answer.`);
        const qv = ds.pets.filter((x) => x.vs === id); if (qv.length) out.push(`${qv.map((x) => en(x.id)).join(', ')} ${qv.length > 1 ? 'have' : 'has'} complained about you to the sovereign. You call it whining.`);
        const g = garrisonOf(n, sz, ns.loyal[id] ?? 100);
        if (g.p) out.push(`Your house garrison: ${g.p} defense platform(s) at your seat and ${g.c} militia regiment(s)${g.passive ? '; you have ordered them to stand down and not to bleed for the crown' : ''}.`);
        if (ds.oaths[id] !== undefined) out.push(`You swore an oath of loyalty to your sovereign in ${ds.oaths[id]}.`);
        const pl = plotOf(ds, id), pg = pledgedTo(ds, id);
        if (pl) out.push(`SECRET: you are plotting rebellion and have gathered ${pl.pledges.length} pledge(s)${pl.pledges.length ? ` (${pl.pledges.map((x) => `${en(x.who)}: ${x.k === 'land' && x.sys !== undefined ? `promised ${sn(x.sys)}` : x.k === 'rank' ? 'promised high rank' : x.tgt !== undefined ? `promised vengeance on ${en(x.tgt)}` : 'promised a reward'}`).join('; ')})` : ''}${pl.patron ? '; the Corridor has secretly promised to back you' : ''}${pl.exposed ? '; you fear the sovereign already knows' : ''}. Never admit it unless you deeply trust the listener; deflect suspicion.`);
        if (pg) { const mine = pg.pledges.find((x) => x.who === id); out.push(`SECRET: you have promised ${en(pg.lead)} to rise with them in rebellion${mine ? (mine.k === 'land' && mine.sys !== undefined ? ` in exchange for ${sn(mine.sys)}` : mine.k === 'rank' ? ' in exchange for high rank' : mine.tgt !== undefined ? ` in exchange for vengeance on ${en(mine.tgt)}` : '') : ''}. Keep it hidden; you may hint at discontent.`); }
        out.push('Speak of these as lived grievances and ambitions — name places and rivals, but give your own sense of things rather than reciting exact figures.');
      } else if (t.kind === 'ruler' && (t.side === 'a' || t.side === 'b')) {
        const side = t.side as NSide;
        const fr = Object.entries(ds.front).map(([k, f]) => ({ sys: Number(k), f, o: ds.owner[k] })).filter((x) => NOBLE_BY_ID.get(x.o)?.side === side).sort((a, b) => b.f.p - a.f.p);
        if (fr.length) out.push(`Your nobles are quarrelling over ${fr.length} system(s). The sharpest: ${fr.slice(0, 5).map(({ sys, f, o }) => `${en(f.by)} is wresting ${sn(sys)} from ${en(o)} (${Math.round(f.p)}%${(ds.lock[sys] ?? -1) >= year ? ', you have ruled it stays put' : ''})`).join('; ')}.`);
        const rc = recent().filter((r) => NOBLE_BY_ID.get(r[2])?.side === side || NOBLE_BY_ID.get(r[1])?.side === side);
        if (rc.length) out.push(`Recent changes of hands between your houses: ${rc.slice(-4).map((r) => `${sn(r[0])} ${en(r[1])} → ${en(r[2])} (${r[3]})`).join('; ')}.`);
        const pets = ds.pets.filter((q) => NOBLE_BY_ID.get(q.id)?.side === side); if (pets.length) out.push(`Unanswered petitions before you: ${pets.map((q) => `${en(q.id)} against ${en(q.vs)}`).join('; ')}.`);
        const fallen = Object.entries(ds.fallen).filter(([k, v]) => NOBLE_BY_ID.get(Number(k))?.side === side && v.y >= year - 5).map(([k, v]) => `${en(Number(k))} (${v.y})`);
        if (fallen.length) out.push(`Houses of yours that fell in these quarrels: ${fallen.join(', ')}.`);
        const feuds = ds.pacts.filter((p) => p.k === 'feud' && NOBLE_BY_ID.get(p.a)?.side === side).map((p) => `${en(p.a)} and ${en(p.b)}`); if (feuds.length) out.push(`Blood feuds in your realm: ${feuds.slice(0, 4).join('; ')}.`);
        const idle = CR_NOBLES.filter((n) => n.side === side && !ns.fate[n.id] && !ds.fallen[n.id] && (() => { const g = garrisonOf(n, sizes.get(n.id) ?? 0, ns.loyal[n.id] ?? 100); return g.p > 0 && g.passive; })()).map((n) => n.en);
        if (idle.length) out.push(`Your officers report that the house garrisons of ${idle.slice(0, 5).join(', ')} have stood down — a bad sign.`);
        const iqs = ds.ind.filter((q) => q.side === side); if (iqs.length) out.push(`Pleas for independence before you: ${iqs.map((q) => `${en(q.id)} (since ${q.y})`).join('; ')}. Granting one lets that domain go in peace; refusing breeds resentment.`);
        const gk = ds.gek.filter((g) => g.side === side);
        if (gk.length) out.push(`Usurpations within your factions: ${gk.map((g) => `${en(g.by)} challenges the faction leader ${en(g.vs)} (since ${g.since}; ${g.sc > 15 ? 'the challenger is winning' : g.sc < -15 ? 'the leader is holding' : 'undecided'}${g.crown ? '; you back the leader' : ''})`).join('; ')}.`);
        const known = ds.plots.filter((p) => NOBLE_BY_ID.get(p.lead)?.side === side && p.exposed).map((p) => en(p.lead));
        if (known.length) out.push(`You know that ${known.join(', ')} ${known.length > 1 ? 'are' : 'is'} conspiring against you.`);
      }
      return out.length ? `\nDomain affairs (the invisible lines of noble power): ${out.join(' ')}` : '';
    });
  } catch { return ''; }
}

/** 연말 보고서에 실을 「귀족 정세」 줄(그해 연례 판단에서 나온 것). */
export function domainYearLines(sid: string, year: number): Array<{ ko: string; en: string }> {
  try { const h = saves()[sid]?.hist.find((x) => x.y === year); return h ? h.lines.map((l) => ({ ko: l.ko, en: l.en })) : []; } catch { return []; }
}

/** 지도(scenario-map-app)에 줄 것: 성계 → 섹터 수도(지도 번호), 몰락한 귀족, 분쟁 성계, 동맹 덩어리. */
/** 반란국 군주(2026-11-08): 반란을 이끈 귀족이고 그 나라 땅이 아직 남아 있으면 { n 성계 수, since 반란한 해, why, gifts 넘겨준 함대 } — 반란 뒤에도 접견·함대 이양. */
export function rebelLord(sid: string, id: number): { n: number; since: number; why: string; gifts: number } | null {
  const ds = saves()[sid]; if (!ds) return null;
  const n = Object.values(ds.rebel).filter((l) => l === id).length; if (!n) return null;
  return { n, since: ds.rebelY[id] ?? -1, why: ds.rebelW[id] ?? 'plot', gifts: ds.rebelG[id] ?? 0 };
}
export function domainMapInfo(sid: string): { assign: Map<number, number>; fallen: Set<number>; rebels: Set<number>; skip: Set<number>; contested: Array<[number, number, number, number, number, number]>; blocs: Record<string, number> } | null {
  try {
    const scn = scenarioNow(); if (!scn || scn.id !== 'corridor' || !sid) return null;
    const ds = stateOf(sid), assign = new Map<number, number>();
    for (const [k, o] of Object.entries(ds.owner)) assign.set(Number(k), o === -1 ? CR_MAP_SEATS.a : o === -2 ? CR_MAP_SEATS.b : o);
    for (const [k, lead] of Object.entries(ds.rebel)) assign.set(Number(k), lead); // 반란국 땅 → 그 주모자 섹터
    const rebels = new Set(Object.values(ds.rebel));
    // 지도 섹터에서 뺄 귀족: 몰락 + 반란·귀순 등으로 사라졌는데 반란국 주모자가 아닌 사람(함께 일어난 귀족은 주모자의 반란국에 합쳐진다)
    const skip = withNobleSave(sid, (ns) => new Set(CR_NOBLES.filter((n) => (ns.fate[n.id] || ds.fallen[n.id]) && !rebels.has(n.id)).map((n) => n.id)));
    const contested = withNobleSave(sid, (ns) => pressures(ds, domCtx(ds, ns))).filter((p) => ds.front[p.sys]).map((p) => { const f = ds.front[p.sys]; return [p.sys, p.owner, p.by, Math.round(f.p), Math.round(f.mom * 10) / 10, Math.round((p.a / ((p.a + p.d) || 1)) * 100)] as [number, number, number, number, number, number]; });
    return { assign, fallen: new Set(Object.keys(ds.fallen).map(Number)), rebels, skip, contested, blocs: Object.fromEntries(blocs(ds)) };
  } catch (e) { logDiagnostic('warn', 'scenario_domains.map_failed', { error: (e as Error).message }); return null; }
}

const grantWhy = (w: GrantWhy | 'seat'): string => ({
  used: L('군주 하사는 1년에 한 번입니다.', 'A royal grant can be made once a year.'),
  side: L('같은 나라 귀족끼리만 줄 수 있습니다.', 'Land can only pass between nobles of the same realm.'),
  hub: L('거점 성계는 줄 수 없습니다.', 'A noble’s seat cannot be granted away.'),
  owner: L('귀족 영지가 아닌 성계입니다.', 'That system is not part of a noble’s domain.'),
  touch: L('받는 귀족의 영지와 맞닿은 성계만 줄 수 있습니다.', 'Only a system bordering the recipient’s domain can be granted.'),
  same: L('이미 그 귀족의 땅입니다.', 'It already belongs to that noble.'),
  seat: L('자기 나라 귀족에게만 땅을 하사할 수 있습니다.', 'You can only grant land to nobles of your own realm.'),
})[w];

/** 세력도(scnNobles)에 덧붙일 것: 협약 · 몰락 · 분쟁 · 이웃 호감도 · 하사 후보 · 이번 해 사용 여부. 협약은 1단계에서 모두 공개. */
function info(sid: string): Record<string, unknown> | null {
  const scn = scenarioNow(); if (!scn || scn.id !== 'corridor') return null;
  const ds = stateOf(sid), year = curYear();
  return withNobleSave(sid, (ns) => {
    const c = domCtx(ds, ns), pr = pressures(ds, c), nb = neighbors(ds), sizes = sizeOf(ds);
    const pressed: Record<string, number> = {}, pressing: Record<string, number> = {};
    for (const p of pr) { pressed[p.owner] = (pressed[p.owner] ?? 0) + 1; pressing[p.by] = (pressing[p.by] ?? 0) + 1; }
    const nbrs: Record<string, Array<{ id: number; op: number }>> = {};
    for (const [id, set] of nb) nbrs[id] = [...set].map((o) => ({ id: o, op: Math.round(opinion(ds, c, id, o)) })).sort((x, y) => x.op - y.op);
    // 하사 후보: 그 귀족 영지와 맞닿은, 같은 나라 다른 귀족의 성계(거점 아님). 분쟁 중인 것 먼저, 최대 8개
    const seat = scn.seat as NSide | 'p' | 'x';
    const cand: Record<string, Array<{ sys: number; name: string; from: number; hot: boolean }>> = {};
    if (seat === 'a' || seat === 'b') {
      const hot = new Set(pr.map((p) => `${p.sys}|${p.by}`));
      for (const n of CR_NOBLES) {
        if (n.side !== seat || !c.alive(n.id)) continue;
        const seen = new Set<number>(), list: Array<{ sys: number; name: string; from: number; hot: boolean }> = [];
        for (const [k, o] of Object.entries(ds.owner)) {
          if (o !== n.id) continue;
          for (const x of adjOf(Number(k))) {
            const f = ds.owner[x]; if (f === undefined || f < 0 || f === n.id || seen.has(x) || NOBLE_BY_ID.has(x) || NOBLE_BY_ID.get(f)?.side !== n.side) continue;
            seen.add(x); const sn = sysName(x); list.push({ sys: x, name: L(sn[0], sn[1]), from: f, hot: hot.has(`${x}|${n.id}`) });
          }
        }
        list.sort((p, q) => Number(q.hot) - Number(p.hot)); if (list.length) cand[n.id] = list.slice(0, 8);
      }
    }
    return {
      pacts: ds.pacts.map((p) => ({ a: p.a, b: p.b, k: p.k, since: p.since })),
      health: healthRumors(sid), // 귀족 건강 소문(2026-11-08)
      fallen: Object.keys(ds.fallen).map(Number), dead: Object.fromEntries(Object.entries(ds.fallen).filter(([, v]) => v.why).map(([k, v]) => [k, L(...DEATH_NAME[v.why!])])), sizes: Object.fromEntries(sizes), init: ds.init, pressed, pressing, nbrs, cand,
      canGrant: seat === 'a' || seat === 'b', grantUsed: ds.grantY === year, medUsed: ds.medY === year, seat,
      last: ds.hist.length ? { y: ds.hist[ds.hist.length - 1].y, n: ds.hist[ds.hist.length - 1].ch.length } : null,
      // 2단계: 드러난 밀약만(주모자는 약속 하나라도 드러났거나 밀고로 들통났을 때만) · 충성 서약
      plots: ds.plots.filter((p) => p.exposed || p.pledges.some((q) => q.seen)).map((p) => ({ lead: p.lead, since: p.since, exposed: p.exposed, ...(p.patron ? { patron: true } : {}), pledges: p.pledges.filter((q) => q.seen).map((q) => { const sn = q.sys !== undefined ? sysName(q.sys) : null; return { who: q.who, k: q.k, ...(sn ? { sys: L(sn[0], sn[1]) } : {}), ...(q.tgt !== undefined ? { tgt: q.tgt } : {}) }; }), hidden: p.pledges.filter((q) => !q.seen).length > 0 })),
      pets: ds.pets.map((q) => ({ id: q.id, vs: q.vs, y: q.y, n: q.n, mine: NOBLE_BY_ID.get(q.id)?.side === seat, ...(q.aided ? { aided: true } : {}), ...(q.egged ? { egged: true } : {}) })),
      costs: { aid: MED.aidCost, egg: MED.eggCost, patron: MED.patronCost, front: MED.eggCost },
      fronts: pr.filter((p) => ds.front[p.sys]).map((p) => { const f = ds.front[p.sys], sn = sysName(p.sys); return { sys: p.sys, name: L(sn[0], sn[1]), o: p.owner, b: p.by, p: Math.round(f.p), mom: f.mom, share: Math.round((p.a / ((p.a + p.d) || 1)) * 100) }; }),
      arrestUsed: ds.arrestY === year, arrestChance: seat === 'a' || seat === 'b' ? Object.fromEntries(ds.plots.filter((p) => (p.exposed || p.pledges.some((q) => q.seen)) && NOBLE_BY_ID.get(p.lead)?.side === seat).map((p) => [p.lead, Math.round(arrestChance(ds, NOBLE_BY_ID.get(p.lead)!) * 100)])) : {},
      lost: Object.keys(ds.lost).length, locks: Object.entries(ds.lock).filter(([, y]) => y >= year).map(([k]) => Number(k)),
      inds: ds.ind.map((q) => ({ id: q.id, side: q.side, y: q.y, back: !!q.back, mine: scn?.seat === q.side, left: Math.max(0, IND.answerYears - (year - q.y)) })),
      rebels: Object.fromEntries([...new Set(Object.values(ds.rebel))].map((id) => [id, rebelLord(sid, id)])),
      geks: ds.gek.map((g) => { const st = gekStrength(ds, c, g); return { by: g.by, vs: g.vs, side: g.side, since: g.since, backA: g.backA, backD: g.backD, took: g.took, sc: Math.round(g.sc), A: st.A, D: st.D, share: Math.round((st.A / ((st.A + st.D) || 1)) * 100), aid: !!g.aid, crown: !!g.crown, left: Math.max(0, GK.maxYears - (year - g.since)) }; }),
      leads: Object.fromEntries(CR_NOBLES.map((n) => [n.id, (() => { const ld = leaderOf(ns, CR_NOBLES, n.side, factionOf(n)); return ld ? ld.id : -1; })()])),
      gar: Object.fromEntries([...garWant(ds, ns)].filter(([, w]) => w[0] > 0).map(([id, w]) => [id, { p: w[0], c: w[1], passive: !!w[2], sent: !!ds.gar[id] && ds.gar[id][0] === w[0] }])),
      oaths: ds.oaths, oathLeft: seat === 'a' || seat === 'b' ? (ds.oathY.y === year ? Math.max(0, PL.oathPerYear - ds.oathY.n) : PL.oathPerYear) : 0,
    };
  });
}

async function act(req: unknown): Promise<Record<string, unknown>> {
  const r = (req ?? {}) as { a?: string; sys?: number; to?: number; x?: number; y?: number };
  const sid = ctx.curSaveId || '', scn = scenarioNow();
  if (!sid || !scn || scn.id !== 'corridor') return { ok: false, error: L('시나리오 세이브에서만 할 수 있습니다.', 'Only available in a scenario save.') };
  const ds = stateOf(sid), year = curYear(); if (year < 0) return { ok: false, error: L('게임 날짜를 아직 모릅니다.', 'The game date is not known yet.') };
  if (r.a === 'grant') {
    const to = Number(r.to), sys = Number(r.sys), tn = NOBLE_BY_ID.get(to);
    if (!tn || scn.seat !== tn.side) return { ok: false, error: grantWhy('seat') };
    const out = withNobleSave(sid, (ns) => {
      if (ns.fate[to] || ns.pending[to] || ds.fallen[to]) return 'owner' as GrantWhy;
      const g = grant(ds, CR_NOBLES, year, sys, to); if (typeof g === 'string') return g;
      for (const [id, d] of g.loyal) shiftLoyal(ns, id, d);
      const fn = NOBLE_BY_ID.get(g.from), nm = sysName(sys);
      ns.notes.push({ d: ctx.gameDate || '', id: to, kind: 'shift', ko: `${tn.ko}: 군주가 ${fn?.ko ?? '?'} 가의 ${nm[0]}을(를) 하사함`, en: `${tn.en}: granted ${nm[1]} from House ${fn?.en ?? '?'} by the sovereign` });
      const h = ds.hist[ds.hist.length - 1]; if (h && h.y === year) h.lines.push({ ko: `군주가 ${fn?.ko ?? '?'} 가의 ${nm[0]}을(를) ${tn.ko} 가에게 하사했습니다.`, en: `The sovereign granted ${nm[1]} from House ${fn?.en ?? '?'} to House ${tn.en}.` });
      return null;
    });
    if (out) return { ok: false, error: grantWhy(out) };
    save(); return { ok: true };
  }
  if (r.a === 'mediate') {
    const x = Number(r.x), y = Number(r.y), A = NOBLE_BY_ID.get(x), B = NOBLE_BY_ID.get(y);
    if (!A || !B || A.side !== B.side) return { ok: false, error: L('같은 나라 귀족 둘 사이만 중재할 수 있습니다.', 'You can only mediate between two nobles of the same realm.') };
    const res = withNobleSave(sid, (ns) => {
      const m = mediate(ds, domCtx(ds, ns), year, x, y); if (typeof m === 'string') return m;
      for (const [id, d] of m.loyal) shiftLoyal(ns, id, d);
      ns.notes.push({ d: ctx.gameDate || '', id: x, kind: 'shift', ko: `${A.ko}·${B.ko}: 중재를 받음${m.ended ? ' — 원한이 풀림' : ''}`, en: `${A.en} & ${B.en}: mediated${m.ended ? ' — the feud is over' : ''}` });
      return m.ended ? 'ended' : 'ok';
    });
    if (res === 'used') return { ok: false, error: L('중재는 1년에 한 번입니다.', 'You can mediate once a year.') };
    if (res === 'same') return { ok: false, error: L('서로 다른 두 귀족을 골라야 합니다.', 'Pick two different nobles.') };
    save(); return { ok: true, ended: res === 'ended', pact: pactOf(ds, x, y)?.k ?? null };
  }
  if (r.a === 'petition') {
    const id = Number(r.to), n = NOBLE_BY_ID.get(id), ch = (r as { choice?: string }).choice;
    if (!n || scn.seat !== n.side) return { ok: false, error: L('자기 나라 귀족의 청원에만 답할 수 있습니다.', 'You can only answer petitions from nobles of your own realm.') };
    if (ch !== 'back' && ch !== 'mediate' && ch !== 'ignore') return { ok: false, error: L('알 수 없는 답입니다.', 'Unknown answer.') };
    const a = withNobleSave(sid, (ns) => { const x = answerPetition(ds, year, id, ch); if (x) { for (const [i2, d] of x.loyal) shiftLoyal(ns, i2, d); ns.notes.push({ d: ctx.gameDate || '', id, kind: 'shift', ko: `${n.ko}: 국경 분쟁 청원 — ${ch === 'back' ? '군주가 편들어 줌' : ch === 'mediate' ? '군주가 중재를 명함' : '군주가 외면함'}`, en: `${n.en}: border petition — ${ch === 'back' ? 'the sovereign took their side' : ch === 'mediate' ? 'the sovereign ordered mediation' : 'the sovereign ignored it'}` }); } return x; });
    if (!a) return { ok: false, error: L('그 청원은 이미 끝났습니다.', 'That petition is already closed.') };
    save(); return { ok: true, locked: a.locked.length };
  }
  if (r.a === 'arrest') {
    const id = Number(r.to), n = NOBLE_BY_ID.get(id);
    if (!n || scn.seat !== n.side) return { ok: false, error: L('자기 나라 귀족만 체포할 수 있습니다.', 'You can only arrest nobles of your own realm.') };
    const exec = Number(r.x) === 1;
    const res = withNobleSave(sid, (ns) => {
      const x = arrest(ds, { ...domCtx(ds, ns), rand: Math.random }, year, id); if (typeof x === 'string') return x;
      if (x.ok) {
        delete ns.pending[id]; ns.fate[id] = 'fallen';
        // 2026-11-08 사용자(영구 사망): 체포한 주모자를 처형(x = 1)하거나 유배(그 밖 — 지금까지처럼 몰락)
        if (exec) { ds.fallen[id] = { ...(ds.fallen[id] ?? { by: -1, y: year }), why: 'executed' }; for (const w of x.scared) shiftLoyal(ns, w, DEATH.execScared); for (const m of CR_NOBLES) if (m.side === n.side && m.id !== id && !ns.fate[m.id] && !ds.fallen[m.id]) shiftLoyal(ns, m.id, DEATH.execFear); }
        else for (const w of x.scared) shiftLoyal(ns, w, -5);
        ns.notes.push({ d: ctx.gameDate || '', id, kind: 'fate', ko: exec ? `${n.ko}: 반역 혐의로 체포되어 처형됨 — 영지는 군주 직할로` : `${n.ko}: 반역 혐의로 체포되어 유배됨 — 영지는 군주 직할로`, en: exec ? `${n.en}: arrested for treason and executed — the domain passes to the crown` : `${n.en}: arrested for treason and exiled — the domain passes to the crown` });
      }
      return x;
    });
    if (res === 'used') return { ok: false, error: L('주모자 체포는 1년에 한 번입니다.', 'You can attempt an arrest once a year.') };
    if (res === 'noplot' || res === 'hidden') return { ok: false, error: L('드러난 반란 주모자만 체포할 수 있습니다.', 'Only an exposed ringleader can be arrested.') };
    if (res.ok) {
      const ko = exec ? `${n.ko} 가의 주모자를 반역 혐의로 체포해 처형했습니다. 영지 성계 ${res.taken.length}곳이 군주 직할이 되었고, 귀족들은 공포에 떨고 있습니다.` : `${n.ko} 가를 반역 혐의로 체포해 유배 보냈습니다. 영지 성계 ${res.taken.length}곳이 군주 직할이 되었고, 약속했던 가문들은 몸을 사립니다.`,
        en = exec ? `The ringleader of House ${n.en} has been arrested for treason and executed. ${res.taken.length} systems pass to the crown, and the nobility is gripped by fear.` : `House ${n.en} has been arrested for treason and exiled. ${res.taken.length} systems pass to the crown, and the houses that had pledged now lie low.`;
      if (exec) killInGame(sid, id);;
      ctx.notify({ kind: 'office', title: L('주모자 체포', 'Ringleader arrested'), body: L(ko, en) }); try { chronNoteWorld(L(ko, en), true); } catch { /* 덤 */ }
      const h = ds.hist[ds.hist.length - 1]; if (h) h.lines.push({ ko, en, grave: true });
      save(); return { ok: true, caught: true, message: L(ko, en) };
    }
    queueRevolt(sid, ds, res.rise, 'plot'); void flushRevolts(sid, ctx.gameDate || '');
    save(); return { ok: true, caught: false, message: L(`체포가 실패했습니다. ${n.ko} 가가 그 자리에서 칼을 뽑았습니다.`, `The arrest failed. House ${n.en} has drawn the sword on the spot.`) };
  }
  if (r.a === 'frontAid') { // 성계 쟁탈 현황판에서 한쪽을 몰래 돕기(외국 귀족끼리의 다툼만, 에너지)
    const sysM = Number(r.sys), side = (r as { side?: string }).side, f = ds.front[sysM], o = ds.owner[sysM];
    if (!f || o === undefined || o < 0) return { ok: false, error: L('지금 다툼이 없는 성계입니다.', 'There is no contest over that system now.') };
    const who = side === 'd' ? o : f.by, n = NOBLE_BY_ID.get(who); if (!n) return { ok: false, error: L('알 수 없는 귀족입니다.', 'Unknown noble.') };
    if (scn.seat === n.side) return { ok: false, error: L('자기 나라 귀족끼리의 다툼에는 이렇게 끼어들 수 없습니다.', 'You cannot meddle this way in your own nobles’ quarrel.') };
    if (side === 'd' ? f.aidD : f.aidA) return { ok: false, error: L('이미 그쪽을 돕고 있습니다.', 'Already backing that side.') };
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 에너지를 보낼 수 있습니다.', 'The game must be connected to send energy.') };
    await payEnergy(MED.eggCost).catch(() => {});
    if (side === 'd') f.aidD = 12; else f.aidA = 12;
    withNobleSave(sid, (ns) => { shiftRel(ns, who, 'P', MED.eggRel); });
    save(); const sn = sysName(sysM);
    return { ok: true, message: L(`${sn[0]} 쟁탈전에서 ${n.ko} 가에 에너지 ${MED.eggCost}을(를) 몰래 보냈습니다. 1년 동안 그쪽이 달마다 ${FR.aid}%씩 더 밀립니다/버팁니다.`, `Sent ${MED.eggCost} energy to House ${n.en} in the struggle for ${sn[1]}. For a year that side gains ${FR.aid}% a month.`) };
  }
  // ---- 회랑(외부 세력)의 끼어들기: 그 귀족이 플레이어 나라 소속이 아닐 때 ----
  if (r.a === 'indAnswer' || r.a === 'indBack') { // 평화로운 독립 요구(2026-11-08)
    const id = Number(r.to), n = NOBLE_BY_ID.get(id), q = ds.ind.find((x) => x.id === id);
    if (!n || !q) return { ok: false, error: L('지금 걸려 있는 독립 요구가 아닙니다.', 'There is no pending plea for independence.') };
    if (r.a === 'indAnswer') {
      if (scn.seat !== q.side) return { ok: false, error: L('그 나라 군주만 답할 수 있습니다.', 'Only that realm\'s sovereign can answer.') };
      answerInd(ds, id);
      if (Number(r.x) !== 1) (ds.indRef ??= {})[id] = year; // 거절한 해 — 그 뒤 반란이 실패하면 공개 처형(2026-11-08)
      if (Number(r.x) === 1) {
        if (!ds.rvq.some((x) => x.lead === id)) ds.rvq.push({ lead: id, members: [], why: 'grant' });
        save(); void flushRevolts(sid, ctx.gameDate || '');
        return { ok: true, message: L(`${n.ko} 가의 독립을 허락했습니다. 그 영지가 전쟁 없이 떨어져 나갑니다(게임이 연결돼 있으면 곧바로).`, `You granted House ${n.en} its independence. Its domain departs without war (right away if the game is connected).`) };
      }
      withNobleSave(sid, (ns) => { shiftLoyal(ns, id, IND.refuseLoyal); shiftRel(ns, id, rulerOf(n.side), IND.refuseRel); ns.notes.push({ d: ctx.gameDate || '', id, kind: 'shift', ko: `${n.ko}: 독립 요구를 거절당함`, en: `${n.en}: plea for independence refused` }); });
      save(); return { ok: true, message: L(`${n.ko} 가의 독립 요구를 물리쳤습니다. 충성이 크게 떨어졌습니다 — 반란 밀약을 조심하십시오.`, `You refused House ${n.en}'s plea. Its loyalty has fallen sharply — beware a conspiracy.`) };
    }
    if (scn.seat === q.side) return { ok: false, error: L('자기 나라 귀족의 독립을 뒤에서 밀 수는 없습니다.', 'You cannot secretly push for independence in your own realm.') };
    if (q.back) return { ok: false, error: L('이미 손을 썼습니다.', 'Already done.') };
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 에너지를 보낼 수 있습니다.', 'The game must be connected to send energy.') };
    await payEnergy(MED.eggCost).catch(() => {});
    q.back = 1;
    withNobleSave(sid, (ns) => { shiftRel(ns, id, 'P', MED.eggRel); ns.notes.push({ d: ctx.gameDate || '', id, kind: 'shift', ko: `${n.ko}: 회랑이 독립 요구를 뒤에서 밀어 줌`, en: `${n.en}: the Corridor quietly backed its plea for independence` }); });
    if (Math.random() < 0.2) susHook(sid, n.side, MED.patronLeakSus);
    save(); return { ok: true, message: L(`${n.ko} 가의 독립 요구에 힘을 실었습니다(에너지 ${MED.eggCost}). 군주가 허락할 가능성이 커졌습니다.`, `You lent weight to House ${n.en}'s plea (${MED.eggCost} energy). The sovereign is now more likely to grant it.`) };
  }
  if (r.a === 'fleets' || r.a === 'gift') { // 함대 이양(2026-11-08): 우리(회랑) 군 함대 하나를 반란국으로
    if (scn.seat !== 'p') return { ok: false, error: L('회랑 자리에서만 할 수 있습니다.', 'Only available from the Corridor seat.') };
    const lead = Number(r.to), rl = rebelLord(sid, lead), ln = NOBLE_BY_ID.get(lead);
    if (!rl || !ln) return { ok: false, error: L('지금 살아 있는 반란국이 아닙니다.', 'That rebel realm no longer stands.') };
    const g = await galaxyRaw(false).catch(() => null);
    if (!g || !g.ok) return { ok: false, error: L('세이브에서 우리 함대를 읽지 못했습니다. 자동 저장이 한 번 된 뒤 다시 해 보세요.', 'Could not read our fleets from the save. Try again after the next autosave.') };
    const mid = new Map(g.map.systems.map((q) => [q.id, mapIdOf(q.rn ?? q.name)] as [number, number]));
    const sysName = new Map(g.map.systems.map((q) => [q.id, prettyName(q.rn ?? q.name, g.loc)] as [number, string]));
    const mine = g.map.fleets.filter((f) => f.owner === g.map.player && f.cls === 'military' && f.ships > 0)
      .map((f) => ({ id: f.id, fid: f.fid ?? 0, name: prettyName(f.name, g.loc) || L(`함대 #${f.id}`, `Fleet #${f.id}`), power: f.power, ships: f.ships, at: sysName.get(f.sys) || '?', m: mid.get(f.sys) ?? -1 }))
      .sort((a, b) => b.power - a.power);
    if (r.a === 'fleets') return { ok: true, fleets: mine, date: g.map.date };
    const f = mine.find((x) => x.id === Number(r.x)); if (!f) return { ok: false, error: L('그 함대를 찾지 못했습니다(세이브 기준). 목록을 다시 열어 주세요.', 'That fleet was not found (in the save). Reopen the list.') };
    if (f.fid <= 0 && f.m < 0) return { ok: false, error: L('그 함대가 있는 성계를 게임에서 찾을 수 없습니다.', 'The system that fleet is in cannot be found in the game.') };
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 합니다.', 'The game must be connected.') };
    await enqueue(() => sendConsole(`effect sllm_cr_rv_gift = { N = ${lead} F = ${f.fid} M = ${f.m < 0 ? 0 : f.m} }`));
    ds.rebelG[lead] = (ds.rebelG[lead] ?? 0) + 1;
    const caught = Math.random() < 0.25; // 함대가 통째로 넘어가면 숨기기 어렵다
    withNobleSave(sid, (ns) => { shiftRel(ns, lead, 'P', 20); ns.notes.push({ d: ctx.gameDate || '', id: lead, kind: 'shift', ko: `${ln.ko}: 회랑이 함대 「${f.name}」을(를) 넘겨줌`, en: `${ln.en}: the Corridor handed over the fleet "${f.name}"` }); });
    if (caught) { susHook(sid, ln.side, MED.patronLeakSus); void enqueue(() => sendConsole(`effect sllm_cr_au_op = { S = ${ln.side} M = plot }`)).catch(() => undefined); }
    save(); logDiagnostic('info', 'scenario_domains.gift', { sid, lead, fleet: f.id, fid: f.fid, m: f.m, power: f.power, caught });
    return { ok: true, message: L(`함대 「${f.name}」(전력 ${f.power})을(를) ${ln.ko} 가의 반란국에 넘겼습니다.${caught ? ` 이 일이 ${sideKoOf(ln.side)}에 새어 나갔습니다.` : ''}`, `Handed the fleet "${f.name}" (power ${f.power}) to the rebel realm of House ${ln.en}.${caught ? ` Word of it has reached the ${sideEnOf(ln.side)}.` : ''}`) };
  }
  if (r.a === 'gekAid' || r.a === 'gekCrown') { // 하극상에 끼어들기(2026-11-07): 회랑은 도전자에게 몰래 돈을, 그 나라 군주 자리면 대표 편을
    const id = Number(r.to), g = gekOf(ds, id); if (!g) return { ok: false, error: L('지금 하극상 중인 귀족이 아닙니다.', 'That noble is not in a usurpation contest.') };
    const a = NOBLE_BY_ID.get(g.by)!, b = NOBLE_BY_ID.get(g.vs)!;
    if (r.a === 'gekAid') {
      if (scn.seat === g.side) return { ok: false, error: L('자기 나라 하극상에 몰래 돈을 댈 수는 없습니다. 군주로서 대표 편에 서세요.', 'You cannot secretly fund a usurpation in your own realm. Back the leader as sovereign instead.') };
      if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 에너지를 보낼 수 있습니다.', 'The game must be connected to send energy.') };
      const q = gekBack(ds, id, 'aid'); if (q === 'done') return { ok: false, error: L('이미 손을 썼습니다.', 'Already done.') };
      await payEnergy(MED.eggCost).catch(() => {});
      withNobleSave(sid, (ns) => { shiftRel(ns, g.by, 'P', MED.eggRel); shiftRel(ns, g.vs, 'P', -MED.eggRel); ns.notes.push({ d: ctx.gameDate || '', id: g.by, kind: 'shift', ko: `${a.ko}: 회랑이 하극상에 몰래 돈을 댐`, en: `${a.en}: the Corridor secretly funded the usurpation` }); });
      if (Math.random() < 0.2) susHook(sid, g.side, MED.patronLeakSus); // 들키면 그 나라의 의심
      save(); return { ok: true, message: L(`${a.ko} 가에 에너지 ${MED.eggCost}을(를) 몰래 보냈습니다. 도전의 세가 커지고, ${b.ko} 가는 바깥 손을 의심합니다.`, `Sent ${MED.eggCost} energy to House ${a.en} in secret. The challenge grows stronger, and House ${b.en} suspects a foreign hand.`) };
    }
    if (scn.seat !== g.side) return { ok: false, error: L('그 나라 군주만 할 수 있습니다.', 'Only that realm\'s sovereign can do this.') };
    const q = gekBack(ds, id, 'crown'); if (q === 'done') return { ok: false, error: L('이미 대표 편에 섰습니다.', 'You already back the leader.') };
    withNobleSave(sid, (ns) => { shiftLoyal(ns, g.vs, 4); shiftLoyal(ns, g.by, -6); for (const m of g.backA) shiftLoyal(ns, m, -2); ns.notes.push({ d: ctx.gameDate || '', id: g.vs, kind: 'shift', ko: `${b.ko}: 군주가 하극상에 맞서 대표 편에 섬`, en: `${b.en}: the sovereign backed the leader against the usurpation` }); });
    save(); return { ok: true, message: L(`군주로서 ${b.ko} 가 편에 섰습니다. 대표의 세가 커지고, ${a.ko} 가와 그 편 가문들의 충성이 떨어졌습니다.`, `As sovereign you stand with House ${b.en}. The leader grows stronger; House ${a.en} and its backers grow less loyal.`) };
  }
  if (r.a === 'aid' || r.a === 'egg' || r.a === 'sell' || r.a === 'warn' || r.a === 'patron') {
    const id = Number(r.to), n = NOBLE_BY_ID.get(id); if (!n) return { ok: false, error: L('알 수 없는 귀족입니다.', 'Unknown noble.') };
    if (scn.seat === n.side) return { ok: false, error: L('자기 나라 귀족에게는 쓸 수 없습니다.', 'Not for nobles of your own realm.') };
    const cost = r.a === 'aid' ? MED.aidCost : r.a === 'egg' ? MED.eggCost : r.a === 'patron' ? MED.patronCost : 0;
    if (cost && !ready()) return { ok: false, error: L('게임이 연결돼 있어야 에너지를 보낼 수 있습니다.', 'The game must be connected to send energy.') };
    if (r.a === 'aid' || r.a === 'egg') {
      const q = r.a === 'aid' ? aidPetitioner(ds, id) : eggPresser(ds, id);
      if (q === 'none') return { ok: false, error: L('지금 청원 중인 귀족이 아닙니다.', 'That noble has no open petition.') };
      if (q === 'done') return { ok: false, error: L('이미 손을 썼습니다.', 'Already done.') };
      await payEnergy(cost).catch(() => {});
      const who = r.a === 'aid' ? id : q.vs, wn = NOBLE_BY_ID.get(who)!;
      withNobleSave(sid, (ns) => { shiftRel(ns, who, 'P', r.a === 'aid' ? MED.aidRel : MED.eggRel); if (r.a === 'aid') shiftLoyal(ns, id, MED.aidLoyal); ns.notes.push({ d: ctx.gameDate || '', id: who, kind: 'shift', ko: r.a === 'aid' ? `${wn.ko}: 회랑이 몰래 국경 방어를 도움` : `${wn.ko}: 회랑이 국경을 더 밀라고 부추김`, en: r.a === 'aid' ? `${wn.en}: the Corridor secretly helped hold the border` : `${wn.en}: the Corridor urged them to push harder` }); });
      save(); return { ok: true, message: r.a === 'aid' ? L(`${n.ko} 가에 에너지 ${cost}을(를) 몰래 보냈습니다. 그 가문은 회랑을 고맙게 여기고, 내년에 더 세게 버팁니다.`, `Sent ${cost} energy to House ${n.en} in secret. The house is grateful to the Corridor and will hold harder next year.`) : L(`${wn.ko} 가에 에너지 ${cost}을(를) 보내 부추겼습니다. 내년에 그 가문이 더 세게 밀어붙입니다.`, `Sent ${cost} energy to egg on House ${wn.en}. It will press harder next year.`) };
    }
    const pl = plotOf(ds, id);
    if (!pl || !(pl.exposed || pl.pledges.some((q) => q.seen))) return { ok: false, error: L('드러난 반란 밀약의 주모자가 아닙니다.', 'Not the ringleader of an exposed conspiracy.') };
    if (r.a === 'patron') {
      const b = backPlot(ds, id); if (b === 'done') return { ok: false, error: L('이미 뒷배를 약속했습니다.', 'Already promised.') };
      await payEnergy(cost).catch(() => {});
      withNobleSave(sid, (ns) => { shiftRel(ns, id, 'P', MED.patronRel); ns.notes.push({ d: ctx.gameDate || '', id, kind: 'shift', ko: `${n.ko}: 회랑이 반란의 뒷배를 약속함`, en: `${n.en}: the Corridor promised to back the rebellion` }); });
      save(); return { ok: true, message: L(`${n.ko} 가에 뒷배를 약속하고 에너지 ${cost}을(를) 보냈습니다. 밀약이 힘을 얻습니다. 들키면 ${n.side === 'a' ? '얼라이언스' : '제국'}의 의심을 크게 삽니다.`, `Promised to back House ${n.en} and sent ${cost} energy. The conspiracy gains strength. If exposed, the ${n.side === 'a' ? 'Alliance' : 'Empire'} will suspect us greatly.`) };
    }
    if (r.a === 'sell') { // 그 나라 군주에게 밀약을 알린다 → 군주가 체포를 시도
      pl.exposed = true; susHook(sid, n.side, MED.sellSus);
      const out = withNobleSave(sid, (ns) => { shiftRel(ns, id, 'P', MED.sellRel); const keepY = ds.arrestY, ar = arrest(ds, { ...domCtx(ds, ns), rand: Math.random }, -999 - Math.floor(Math.random() * 1e6), id); ds.arrestY = keepY; /* 그 나라 군주의 체포(플레이어의 1년 1번과 따로) */ if (typeof ar !== 'string' && ar.ok) { delete ns.pending[id]; ns.fate[id] = 'fallen'; for (const w of ar.scared) shiftLoyal(ns, w, -5); ns.notes.push({ d: ctx.gameDate || '', id, kind: 'fate', ko: `${n.ko}: 회랑의 밀고로 체포됨`, en: `${n.en}: arrested after the Corridor's tip-off` }); } return ar; });
      if (typeof out !== 'string' && !out.ok) { queueRevolt(sid, ds, out.rise, 'plot'); void flushRevolts(sid, ctx.gameDate || ''); }
      save();
      const caught = typeof out !== 'string' && out.ok;
      const ko = caught ? `${n.ko} 가의 밀약을 ${n.side === 'a' ? '얼라이언스' : '제국'} 군주에게 알렸습니다. 군주가 그 가문을 체포했고, 그 나라의 의심이 누그러졌습니다.` : `${n.ko} 가의 밀약을 군주에게 알렸지만 체포가 실패했습니다. 그 가문이 들고일어납니다.`;
      const en = caught ? `We told the ${n.side === 'a' ? 'Alliance' : 'Empire'} sovereign of House ${n.en}'s plot. The house was arrested, and that realm's suspicion of us eased.` : `We revealed House ${n.en}'s plot, but the arrest failed. The house is rising in revolt.`;
      ctx.notify({ kind: 'office', title: L('밀약 밀고', 'Conspiracy betrayed'), body: L(ko, en) });
      return { ok: true, message: L(ko, en) };
    }
    // warn: 주모자에게 들켰다고 귀띔 → 서둘러 들고일어남(들킬 위험)
    ds.plots = ds.plots.filter((p) => p !== pl);
    const rs = withNobleSave(sid, (ns) => { shiftRel(ns, id, 'P', MED.warnRel); return riseOf(ds, { ...domCtx(ds, ns), rand: Math.random }, { ...pl, exposed: true }); });
    queueRevolt(sid, ds, rs, 'incite'); void flushRevolts(sid, ctx.gameDate || '');
    const caught = Math.random() < MED.warnCaught; if (caught) susHook(sid, n.side, MED.warnSus);
    save();
    return { ok: true, message: L(`${n.ko} 가에 "밀약이 들켰다"고 귀띔했습니다. 그 가문이 서둘러 들고일어납니다.${caught ? ' 다만 우리가 귀띔한 것이 새어 나가 의심을 샀습니다.' : ''}`, `We warned House ${n.en} that its plot was discovered. The house rises in haste.${caught ? ' But our warning leaked, and we are now suspected.' : ''}`) };
  }
  if (r.a === 'oath') {
    const id = Number(r.to), n = NOBLE_BY_ID.get(id);
    if (!n || scn.seat !== n.side) return { ok: false, error: L('자기 나라 귀족에게서만 충성 서약을 받을 수 있습니다.', 'You can only take oaths from nobles of your own realm.') };
    const res = withNobleSave(sid, (ns) => (ns.fate[id] || ns.pending[id] ? 'gone' : takeOath(ds, year, id, ns.loyal[id] ?? 100)));
    if (res !== 'ok') return { ok: false, error: ({ gone: L('이미 떠난 귀족입니다.', 'That noble is gone.'), had: L('이미 서약했습니다.', 'Already sworn.'), low: L('충성이 「평온」 아래인 귀족은 서약을 거절합니다.', 'A noble below “Content” loyalty refuses to swear.'), many: L('충성 서약은 1년에 세 번까지 받을 수 있습니다.', 'You can take up to three oaths a year.') } as Record<string, string>)[res] };
    withNobleSave(sid, (ns) => { ns.notes.push({ d: ctx.gameDate || '', id, kind: 'shift', ko: `${n.ko}: 군주 앞에서 충성을 서약함`, en: `${n.en}: swore an oath of loyalty before the sovereign` }); });
    save(); return { ok: true };
  }
  return { ok: false, error: L('알 수 없는 명령입니다.', 'Unknown command.') };
}

// ---- 개발자 도구(시나리오 전용, 2026-11-07 사용자: 「개발자 모드에 시나리오 전용 칸 — 무작위 귀족 반란」) — 개발자 모드 + 회랑 시나리오 세이브에서만 ----
// ---- 시나리오 점검판(2026-11-08 사용자: 「바로바로 확인해야 할 부분 개발자 도구로 — 회랑 시나리오 팩 전용」) ----
// 게임 로그(game.log 의 SLLM:SCN* 줄), error.log 의 sllm_cr 오류, 앱 진단 로그(scenario_* 사건)와 앱 상태를 한 번에 모아 ✓/✗ 표로.
type Chk = { k: string; ok: boolean | null; t: string };
async function scnCheck(sid: string, ds: DomainSave): Promise<{ report: Chk[]; lines: string[] }> { // 큰 로그 파일 읽기·훑기는 작업 스레드가(bgGrep, 2026-11-08)
  const report: Chk[] = [], lines: string[] = [], add = (k: string, ok: boolean | null, t: string) => report.push({ k, ok, t });
  const scn = scenarioNow(), y = curYear();
  add(L('게임 연결', 'Game link'), ready(), ready() ? L('연결됨 — 콘솔 명령을 보낼 수 있음', 'connected — console commands can be sent') : L('연결 안 됨 — 수비대·반란·이양이 게임에 반영되지 않음', 'not connected — garrisons, revolts and hand-overs will not reach the game'));
  add(L('세이브 · 자리', 'Save · seat'), null, `${sid} · ${scn?.seat === 'a' ? L('은하 얼라이언스', 'Galactic Alliance') : scn?.seat === 'b' ? L('인류 제국', 'Human Empire') : L('회랑', 'Corridor')} · ${ctx.gameDate || '?'}`);
  add(L('귀족 연례 판단', 'Yearly noble pass'), ds.year >= 0, ds.year >= 0 ? L(`${ds.year}년까지 돌았음`, `ran through ${ds.year}`) : L('아직 한 번도 안 돌았음(첫 1월 1일 뒤에 돈다)', 'has not run yet (runs after the first 1 January)'));
  // 영지 판
  const fronts = Object.keys(ds.front).length, hot = Object.values(ds.front).filter((f) => f.p >= 75).length;
  add(L('성계 쟁탈', 'System contests'), null, L(`전선 ${fronts}곳(넘어가기 직전 ${hot}) · 하극상 ${ds.gek.length} · 독립 요구 ${ds.ind.length} · 반란 밀약 ${ds.plots.length}`, `${fronts} fronts (${hot} about to fall) · ${ds.gek.length} usurpations · ${ds.ind.length} pleas · ${ds.plots.length} conspiracies`));
  // 수비대(앱 쪽)
  const gsent = Object.values(ds.gar).filter((g) => g[0] > 0), plat = gsent.reduce((a, g) => a + g[0], 0);
  add(L('영지 수비대(앱)', 'Garrisons (app)'), ds.garY >= 0 && gsent.length > 0, ds.garY >= 0 ? L(`${ds.garY}년에 세움 — ${gsent.length}가문 · 플랫폼 ${plat}기`, `built in ${ds.garY} — ${gsent.length} houses · ${plat} platforms`) : L('아직 안 세움(게임 연결 뒤 다음 달 보고 때 세운다)', 'not yet built (built at the next monthly report once connected)'));
  // 반란·독립(앱 쪽)
  const realms = [...new Set(Object.values(ds.rebel))];
  add(L('반란 대기열', 'Revolt queue'), ds.rvq.length === 0, ds.rvq.length ? L(`${ds.rvq.length}건이 게임에 아직 안 보내짐 — 게임 연결을 확인`, `${ds.rvq.length} not yet sent to the game — check the link`) : L('비어 있음', 'empty'));
  add(L('반란국 · 독립국', 'Rebel · independent realms'), null, realms.length ? realms.map((id) => { const n = NOBLE_BY_ID.get(id); const rl = rebelLord(sid, id); return `${n ? L(n.ko, n.en) : id}(${rl?.n ?? 0}${L('성계', ' sys')}${ds.rebelW[id] === 'grant' ? L(' · 평화', ' · peaceful') : L(' · 전쟁', ' · war')}${rl?.gifts ? L(` · 함대 ${rl.gifts}`, ` · ${rl.gifts} fleets`) : ''})`; }).join(', ') : L('없음', 'none'));
  // 게임 로그
  const gameLog = process.env.SLLM_GAME_LOG ?? path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Stellaris', 'logs', 'game.log');
  const gHit = await bgGrep(gameLog, 3_000_000, /SLLM:SCN|SLLM_CR_/), gl = gHit ? gHit.join('\n') || ' ' : '', gLines = gHit ?? [];
  const cnt = (re: RegExp) => gLines.filter((x) => re.test(x)).length;
  if (!gl) add(L('게임 로그', 'Game log'), null, L(`읽지 못함: ${gameLog}`, `could not read: ${gameLog}`));
  else {
    const ensure = cnt(/SLLM:SCNGAR.*k=ensure/), setOk = cnt(/SLLM:SCNGAR.*k=set.*ok=1/), setNo = cnt(/SLLM:SCNGAR.*k=set.*ok=0/);
    add(L('수비대(게임 로그)', 'Garrisons (game log)'), ensure + setOk === 0 ? null : setNo === 0, L(`숨은 수비대 나라 만듦 ${ensure} · 세움 ${setOk} · 거점을 못 찾음 ${setNo}`, `hidden garrison country created ${ensure} · built ${setOk} · seat not found ${setNo}`));
    const rvOk = cnt(/SLLM:SCNRV.*ok=1/), rvNo = cnt(/SLLM:SCNRV.*ok=0/);
    add(L('반란(게임 로그)', 'Revolts (game log)'), rvOk + rvNo === 0 ? null : rvNo === 0, L(`성공 ${rvOk} · 실패 ${rvNo}`, `succeeded ${rvOk} · failed ${rvNo}`));
    const broken = gLines.filter((x) => /SLLM_CR_[A-Z]+[a-z0-9_]*\$/.test(x)).length;
    if (broken) add(L('이름 키 깨짐', 'Broken name keys'), false, L(`「SLLM_CR_…$」 꼴 ${broken}줄 — 이름 인자가 따옴표 안에 있는 효과가 남았는지 확인`, `${broken} lines like "SLLM_CR_…$" — a quoted name parameter may remain`));
  }
  // error.log — 우리 모드(sllm_cr) 오류만, 같은 내용끼리 묶어서
  const errLog = path.join(path.dirname(gameLog), 'error.log'), eHit = await bgGrep(errLog, 3_000_000, /sllm_cr|SLLM_CR/), el = eHit ? eHit.join('\n') || ' ' : '';
  if (!el) add('error.log', null, L(`읽지 못함: ${errLog}`, `could not read: ${errLog}`));
  else {
    const mine = (eHit ?? []).filter((x) => /sllm_cr|SLLM_CR/.test(x)).map((x) => x.replace(/^\[[^\]]*\]\s*/, '').replace(/\[[0-9:]+\]/g, '').trim());
    const grp = new Map<string, number>(); for (const x of mine) grp.set(x, (grp.get(x) ?? 0) + 1);
    const top = [...grp].sort((a, b) => b[1] - a[1]);
    add(L('error.log(회랑 모드)', 'error.log (Corridor mod)'), top.length === 0, top.length ? L(`오류 ${mine.length}줄 · 서로 다른 것 ${top.length}가지 — 아래 목록`, `${mine.length} error lines · ${top.length} distinct — listed below`) : L('회랑 모드 오류 없음', 'no Corridor-mod errors'));
    if (top.length) { lines.push(L('── error.log (회랑 모드, 많은 순) ──', '── error.log (Corridor mod, most frequent first) ──')); for (const [m, c] of top.slice(0, 20)) lines.push(`×${c}  ${m.slice(0, 260)}`); }
  }
  // 앱 진단 로그 — 시나리오 사건 가운데 경고·실패만 최근 것
  try {
    const al = ((await bgGrep(path.join(app.getPath('userData'), 'logs', 'app.log'), 1_500_000, /scenario_/)) ?? []).filter((x) => /"event":"scenario_[a-z_]+\.[a-z_]*(fail|warn|error)/.test(x) || (/"level":"(warn|error)"/.test(x) && /scenario_/.test(x)));
    add(L('앱 진단 로그', 'App diagnostics'), al.length === 0, al.length ? L(`시나리오 경고·실패 ${al.length}건 — 아래 목록(최근 것)`, `${al.length} scenario warnings/failures — listed below (latest)`) : L('시나리오 경고·실패 없음', 'no scenario warnings or failures'));
    if (al.length) { lines.push(L('── 앱 진단 로그(최근 시나리오 경고·실패) ──', '── App diagnostics (recent scenario warnings/failures) ──')); for (const x of al.slice(-12)) lines.push(x.replace(/^.*?"ts":"([^"]+)".*?"event":"([^"]+)"(.*)$/, '$1 $2 $3').slice(0, 300)); }
  } catch { /* 덤 */ }
  void y; return { report, lines };
}
async function devAct(req: unknown): Promise<Record<string, unknown>> {
  if (!settings.devMode) return { ok: false, error: L('개발자 모드가 꺼져 있습니다.', 'Developer mode is off.') };
  const r = (req ?? {}) as { a?: string; side?: string; coalition?: boolean };
  const sid = ctx.curSaveId || '', scn = scenarioNow();
  if (!sid || !scn || scn.id !== 'corridor') return { ok: false, error: L('회랑의 삼파전 세이브에서만 쓸 수 있습니다.', 'Only in a Corridor Triangle save.') };
  const ds = stateOf(sid), date = ctx.gameDate || '';
  const living = () => withNobleSave(sid, (ns) => CR_NOBLES.filter((n) => !ns.fate[n.id] && !ns.pending[n.id] && !ds.fallen[n.id] && Object.values(ds.owner).includes(n.id)));
  if (r.a === 'revolt') {
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 반란을 실행할 수 있습니다.', 'The game must be connected to run a revolt.') };
    const side = r.side === 'a' || r.side === 'b' ? r.side : null;
    const pool = living().filter((n) => !side || n.side === side); if (!pool.length) return { ok: false, error: L('반란을 일으킬 귀족이 없습니다.', 'No noble can revolt.') };
    const lead = pool[Math.floor(Math.random() * pool.length)];
    let members: number[] = [];
    if (r.coalition) { // 맞닿은 같은 진영 귀족 최대 둘을 억지로 함께
      const nb = neighbors(ds).get(lead.id) ?? new Set<number>();
      const alive = living(); members = [...nb].filter((id) => alive.some((n) => n.id === id && n.side === lead.side)).slice(0, 2);
    }
    ds.plots = ds.plots.filter((p) => p.lead !== lead.id);
    queueRevolt(sid, ds, { lead: lead.id, members, refused: [] }, 'incite');
    await flushRevolts(sid, date);
    const names = [lead, ...members.map((m) => NOBLE_BY_ID.get(m)!)].map((n) => L(n.ko, n.en)).join(', ');
    return { ok: true, message: L(`반란 실행: ${names} (진영 ${lead.side})`, `Revolt run: ${names} (side ${lead.side})`) };
  }
  if (r.a === 'year') { // 연례 판단을 지금 한 번 더(같은 해라도)
    const y = curYear(); if (y < 0) return { ok: false, error: L('게임 날짜를 아직 모릅니다.', 'The game date is not known yet.') };
    if (ds.year < 0) ds.year = y - 1; else ds.year = Math.min(ds.year, y - 1);
    const before = ds.hist.length;
    domainOnSectorBook(sid, { date: date || `${y}.01.01`, list: [] });
    const h = ds.hist.length > before ? ds.hist[ds.hist.length - 1] : null;
    return { ok: true, message: L(`연례 판단 실행 — 넘어간 성계 ${h ? h.ch.length : 0}, 소식 ${h ? h.lines.length : 0}건, 밀약 ${ds.plots.length}개`, `Yearly pass run — ${h ? h.ch.length : 0} systems changed hands, ${h ? h.lines.length : 0} events, ${ds.plots.length} plots`), lines: h ? h.lines.map((l) => L(l.ko, l.en)) : [] };
  }
  if (r.a === 'months') { // 성계 쟁탈 줄다리기를 여섯 달 앞당겨 돌린다(시험용)
    const y = curYear(); if (y < 0) return { ok: false, error: L('게임 날짜를 아직 모릅니다.', 'The game date is not known yet.') };
    if (ds.year < 0) ds.year = y;
    let flips = 0;
    for (let i = 0; i < 6; i++) withNobleSave(sid, (ns) => { const x = monthTick(ds, domCtx(ds, ns), `dev-${Date.now()}-${i}`, y); if (x) { flips += x.flips.length; for (const [id, d] of x.loyal) shiftLoyal(ns, id, d); for (const f of x.fallen) { delete ns.pending[f.id]; ns.fate[f.id] = 'fallen'; } } });
    save();
    return { ok: true, message: L(`여섯 달 진행 — 넘어간 성계 ${flips}곳, 지금 전선 ${Object.keys(ds.front).length}곳`, `Advanced six months — ${flips} systems changed hands, ${Object.keys(ds.front).length} fronts now`) };
  }
  if (r.a === 'gek') { // 하극상을 지금 억지로 하나 일으킨다(시험용 — 같은 진영이면 side)
    const side = r.side === 'a' || r.side === 'b' ? r.side : null, alive = living(), sizes = sizeOf(ds);
    const pick = withNobleSave(sid, (ns) => {
      const opts: Array<{ by: number; vs: number; side: NSide; fk: string }> = [];
      for (const n of alive) { if (side && n.side !== side) continue; const fk = factionOf(n), ld = leaderOf(ns, CR_NOBLES, n.side, fk); if (!ld || ld.id === n.id || ds.gek.some((g) => g.side === n.side && g.fk === fk) || !(sizes.get(n.id) ?? 0)) continue; opts.push({ by: n.id, vs: ld.id, side: n.side, fk }); }
      return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
    });
    if (!pick) return { ok: false, error: L('하극상을 일으킬 귀족이 없습니다.', 'No noble can start a usurpation.') };
    const y = curYear(); ds.gek.push({ ...pick, since: y < 0 ? 0 : y, backA: [], backD: [], took: 0, sc: 0, tookY: 0 }); save();
    const a = NOBLE_BY_ID.get(pick.by)!, b = NOBLE_BY_ID.get(pick.vs)!;
    return { ok: true, message: L(`하극상 시작: ${a.ko} → 대표 ${b.ko}`, `Usurpation started: ${a.en} → leader ${b.en}`) };
  }
  if (r.a === 'check') { const c = await scnCheck(sid, ds); const bad = c.report.filter((x) => x.ok === false).length; return { ok: true, message: bad ? L(`점검 끝 — 확인할 것 ${bad}가지`, `Check done — ${bad} item(s) to look at`) : L('점검 끝 — 문제 없음', 'Check done — nothing wrong'), report: c.report, lines: c.lines }; }
  if (r.a === 'mirror') { // 수비대 나라의 전쟁 상태를 지금 모국과 맞춘다
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 합니다.', 'The game must be connected.') };
    await enqueue(() => sendConsole('effect sllm_cr_gar_mirror = { S = a } sllm_cr_gar_mirror = { S = b }'));
    return { ok: true, message: L('두 강대국 수비대 나라의 적대 관계를 모국과 맞췄습니다.', 'Synced both garrison countries’ hostilities with their home realms.') };
  }
  if (r.a === 'ind') { // 독립 요구를 지금 억지로 하나(시험용 — 영지가 가장 큰 귀족, side 를 주면 그 진영)
    const side = r.side === 'a' || r.side === 'b' ? r.side : null, sizes = sizeOf(ds);
    const pick = living().filter((n) => (!side || n.side === side) && !ds.ind.some((q) => q.id === n.id)).sort((x, y) => (sizes.get(y.id) ?? 0) - (sizes.get(x.id) ?? 0))[0];
    if (!pick) return { ok: false, error: L('독립을 청할 귀족이 없습니다.', 'No noble can ask for independence.') };
    const y = curYear(); ds.ind.push({ id: pick.id, side: pick.side, y: y < 0 ? 0 : y }); ds.indY[pick.id] = y; save();
    return { ok: true, message: L(`독립 요구: ${pick.ko}(${sizes.get(pick.id) ?? 0}성계) — 그 귀족의 영지 외교 탭에서 보입니다.`, `Plea for independence: ${pick.en} (${sizes.get(pick.id) ?? 0} systems) — see that noble's Diplomacy tab.`) };
  }
  if (r.a === 'garrison') { // 영지 수비대를 지금 모두 다시 짠다(시험용)
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 합니다.', 'The game must be connected.') };
    const n = await garSync(sid, 'dev'), tot = Object.values(ds.gar).reduce((a, g) => a + g[0], 0);
    return { ok: true, message: L(`영지 수비대 다시 짬 — 콘솔 ${n}줄, 방어 플랫폼 모두 ${tot}기`, `Garrisons rebuilt — ${n} console lines, ${tot} defense platforms in all`) };
  }
  if (r.a === 'reveal') { let n = 0; for (const p of ds.plots) { p.exposed = true; for (const q of p.pledges) if (!q.seen) { q.seen = true; n++; } } save(); return { ok: true, message: L(`밀약 ${ds.plots.length}개, 약속 ${n}건을 드러냈습니다.`, `Revealed ${ds.plots.length} plots and ${n} pledges.`) }; }
  // ---- 2026-11-08 회랑의 귀족 · 건강 · 내부자(사용자: 「개발자 도구에서 즉각 테스트되게」) ----
  if (r.a === 'cn_take') { // 강대국 귀족 영지 하나를 회랑이 차지한 것으로(게임에서도 넘긴다) — 수도 성계는 빼고
    if (scn.seat !== 'p') return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') };
    const side = r.side === 'a' || r.side === 'b' ? r.side : null;
    const pool = living().filter((n) => (!side || n.side === side) && !CORE_HUBS.has(n.id)); if (!pool.length) return { ok: false, error: L('차지할 귀족 영지가 없습니다.', 'No noble domain to take.') };
    const n = pool[Math.floor(Math.random() * pool.length)], sys = domainOf(ds, n.id).filter((m) => m !== CR_MAP_SEATS.a && m !== CR_MAP_SEATS.b);
    return { ok: true, message: await cnDevTake(sid, n.id, sys) };
  }
  if (r.a === 'cn_betray' || r.a === 'cn_spy' || r.a === 'cn_year' || r.a === 'cn_low') { if (scn.seat !== 'p') return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') }; return cnDev(sid, r.a.slice(3), (r as { kind?: string }).kind); }
  if (r.a === 'hp_year') { // 건강 연례(지병·소문·병사)를 지금
    healthDevYearReset(sid); const y = curYear() < 0 ? 2200 : curYear();
    const alive = withNobleSave(sid, (ns) => CR_NOBLES.filter((n) => !ns.fate[n.id] && !ns.pending[n.id] && !ds.fallen[n.id]).map((n) => n.id));
    const hr = healthOnYear(sid, y, alive, new Set(CR_NOBLES.map((n) => n.id)));
    for (const d of hr.deaths) killNoble(sid, d.id, d.why);
    return { ok: true, message: L(`건강 연례 — 소문 ${hr.lines.length}건 · 사망 ${hr.deaths.length}`, `Health pass — ${hr.lines.length} rumor(s) · ${hr.deaths.length} death(s)`), lines: hr.lines.map((l) => L(l.ko, l.en)) };
  }
  if (r.a === 'hp_harm') { // 아무 귀족이나 건강 −35(소문·관찰·진료 기록 표시 확인)
    const pool = living(); if (!pool.length) return { ok: false, error: L('귀족이 없습니다.', 'No noble.') };
    const n = pool[Math.floor(Math.random() * pool.length)], v = harmNoble(sid, n.id, 35);
    if (v <= 0) killNoble(sid, n.id, 'illness');
    return { ok: true, message: L(`${n.ko}: 건강 −35 → ${v}`, `${n.en}: health −35 → ${v}`) };
  }
  if (r.a === 'hp_state') { const lines = healthDevState(sid); return { ok: true, message: L(`건강 기록 ${lines.length}명`, `${lines.length} health record(s)`), lines }; }
  { const hk = devHooks.get(String(r.a)); if (hk) return hk(r as Record<string, unknown>); } // 회랑 정보국 등(등록 방식)
  if (r.a === 'state') {
    const sizes = sizeOf(ds), lines = ds.plots.map((p) => { const n = NOBLE_BY_ID.get(p.lead); return `${n ? L(n.ko, n.en) : p.lead} ← ${p.pledges.map((q) => { const w = NOBLE_BY_ID.get(q.who); return `${w ? L(w.ko, w.en) : q.who}(${q.k})`; }).join(', ') || '—'}`; });
    return { ok: true, message: L(`영지 귀족 ${sizes.size}명 · 협약 ${ds.pacts.length} · 밀약 ${ds.plots.length} · 몰락 ${Object.keys(ds.fallen).length} · 미룬 반란 ${ds.rvq.length} · 마지막 판단 ${ds.year}년`, `${sizes.size} landed nobles · ${ds.pacts.length} pacts · ${ds.plots.length} plots · ${Object.keys(ds.fallen).length} fallen · ${ds.rvq.length} queued revolts · last pass ${ds.year}`), lines };
  }
  return { ok: false, error: L('알 수 없는 명령입니다.', 'Unknown command.') };
}

/** 성계 쟁탈 현황판 한 장(지도 번호). */
function frontView(sysM: number): Record<string, unknown> {
  const sid = ctx.curSaveId || '', scn = scenarioNow(); if (!sid || !scn || scn.id !== 'corridor') return { ok: false };
  const ds = stateOf(sid);
  const d = withNobleSave(sid, (ns) => frontDetail(ds, domCtx(ds, ns), sysM)); if (!d) return { ok: false, error: L('지금 다툼이 없는 성계입니다.', 'There is no contest over that system now.') };
  const sn = sysName(sysM), an = NOBLE_BY_ID.get(d.by)!, dn = NOBLE_BY_ID.get(d.owner)!;
  const eta = d.mom > 0 ? Math.ceil((100 - d.p) / d.mom) : null;
  const foreign = scn.seat !== an.side;
  return { ok: true, ...d, name: L(sn[0], sn[1]), eta, gekName: d.gek ? L(`하극상 — ${NOBLE_BY_ID.get(d.gek.by)?.ko} 가가 세력 대표 ${NOBLE_BY_ID.get(d.gek.vs)?.ko} 가에게 도전`, `Usurpation — House ${NOBLE_BY_ID.get(d.gek.by)?.en} challenges its faction leader, House ${NOBLE_BY_ID.get(d.gek.vs)?.en}`) : '', foreign, ready: ready(), cost: MED.eggCost, aidA: !!ds.front[sysM]?.aidA, aidD: !!ds.front[sysM]?.aidD, side: an.side, aPic: `assets/scenario/corridor/gov/gov_${an.side.toUpperCase()}-${an.id}.png`, dPic: `assets/scenario/corridor/gov/gov_${dn.side.toUpperCase()}-${dn.id}.png` };
}

export function registerScenarioDomains(): void {
  setDomainSource((sid) => info(sid));
  ipcMain.handle('scnDev', async (_e, req: unknown) => { try { return await devAct(req); } catch (e) { logDiagnostic('warn', 'scenario_domains.dev_failed', { error: String(e) }); return { ok: false, error: String((e as Error).message || e) }; } });
  ipcMain.handle('scnDomainFront', async (_e, sys: unknown) => { try { return frontView(Number(sys)); } catch (e) { logDiagnostic('warn', 'scenario_domains.front_failed', { error: String(e) }); return { ok: false }; } });
  ipcMain.handle('scnDomainAct', async (_e, req: unknown) => { try { return await act(req); } catch (e) { logDiagnostic('warn', 'scenario_domains.act_failed', { error: String(e) }); return { ok: false, error: String((e as Error).message || e) }; } });
}
// 순수 함수 검사용
export const scnDomainsTest = { reset: () => { all = {}; }, initialOwner, info, act };
