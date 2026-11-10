// 정치(2026-10-28 사용자 확정 — 1028_집컴_옮기기/정치_월드박스참고_설계.md, 수치는 그날 제안안 그대로 승인) — 순수 규칙.
//  ① 음모 + 궁정 정치(월드박스·로마 2): 우리 현직 지도자(통치자 제외)가 가끔 음모를 꾸민다. 1년에 한 번 판정 8%(불안·시위·패전이면 오름, 최대 25%), 동시에 2건까지.
//     진행도 0→100(한 달 +3~6, 음모자 영향력이 높을수록 빠름). 진행도 30부터 「수상한 낌새」(용의자), 발견은 매달 3%(진행도 50 넘으면 6%).
//     발견 전 견제: 매수(에너지 300 → 진행도 -30) · 추문 폭로(영향력 50 → 음모자 영향력 -40, 진행도 -20).
//  ② 반대파 처리(트로피코): 들키면 회유 / 좌천 / 체포 / 추방. 좌천·체포·추방은 그 인물 쪽 파벌 매력도 -10%(1년).
//  ③ 망명(삼국·아틸라): 망명 음모가 이루어지거나 추방한 인물이 40% 확률로 적국 지도자가 된다(바닐라 패러건 이벤트의 leader set_owner 와 같은 방식).
//  ④ 가문: 통치자 가문 이름(기본 = 통치자의 성) + 가문 특성 16종 중 2개(이야기만). 자녀에게 특성마다 70%, 세대마다 20% 확률로 새 특성.
//  ⑤ 정략결혼(삼국·로마 2): 외교 거래판의 「혼인」 — 성인 자녀와 상대 통치 가문 인물. 혼인이 이어지는 동안 상대 호감 +40, 전쟁이 나면 사라지고 「곤란해진 자녀」.
// 진행은 확률 + 틀 문장(한/영, 언어 팩 호환), LLM 은 쓰지 않는다. 게임 명령은 비용·직책 해제·수감 특성·추방·망명·수정자·호감뿐.
import { wrapForPlayer } from './protocol';

const int = (n: unknown): n is number => Number.isSafeInteger(n);
const okReq = (r: number) => int(r) && r >= 1;
const okIdx = (i: number) => int(i) && i >= 1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ======================================================================================
// ① 음모
// ======================================================================================
export type PlotKind = 'secede' | 'power' | 'graft' | 'collude' | 'defect' | 'succession';
export const PLOT_KINDS: PlotKind[] = ['secede', 'power', 'graft', 'collude', 'defect', 'succession'];
export const PLOT = {
  yearChance: 0.08, maxChance: 0.25, boostLow: 0.05, boostProtest: 0.05, boostWar: 0.07,
  maxActive: 2, stepMin: 3, stepMax: 6, hintAt: 30, highAt: 50, doneAt: 100,
  discover: 0.03, discoverHigh: 0.06,
  bribe: { energy: 300, progress: -30 }, expose: { influence: 50, inf: -40, progress: -20 },
  appease: { energy: 500, influence: 50, relapse: 0.3, relapseYears: 5 },
  demote: { mood: -1 }, arrest: { mood: -3, protest: 0.3 }, exile: { mood: -5, protest: 0.5, defect: 0.4 },
  crackDays: 360, cells: 8,
  win: { secedeDays: 720, powerInfluence: 100, graftDays: 360, colludeDays: 720 },
  lowStability: 40,
} as const;
export type PlotEnd = 'appease' | 'demote' | 'arrest' | 'exile' | 'won' | 'gone';
export type EthKey = 'militarist' | 'pacifist' | 'authoritarian' | 'egalitarian' | 'xenophile' | 'xenophobe' | 'materialist' | 'spiritualist';
export const ETHS: EthKey[] = ['militarist', 'pacifist', 'authoritarian', 'egalitarian', 'xenophile', 'xenophobe', 'materialist', 'spiritualist'];
export const isEth = (x: unknown): x is EthKey => typeof x === 'string' && (ETHS as string[]).includes(x);
export interface PlotLog { date: string; ko: string; en: string }
export interface Plot {
  id: string; kind: PlotKind; pid: string; name: string; cls: string;
  /** 음모자 영향력(0~100, 궁정 정치) */ inf: number; prog: number; since: string;
  /** 「수상한 낌새」가 난 날(진행도 30) — 용의자가 보인다 */ hinted?: string;
  /** 발각된 날 — 진행이 멈추고 대응을 기다린다 */ found?: string;
  ended?: string; end?: PlotEnd;
  /** 이 인물 쪽 파벌(총독 지지 파벌, 모르면 지지가 가장 낮은 파벌) */ eth?: EthKey;
  /** 독립 모의: 그 행성(every_owned_colony 순서 k) */ planetK?: number; planet?: string;
  /** 망명 준비: 받아 줄 제국 */ tid?: number; target?: string;
  bribes?: number; exposes?: number; log: PlotLog[];
}
export interface Prisoner { pid: string; name: string; since: string; plotId: string; state: 'held' | 'freed' | 'executed'; until?: string }
export interface Relapse { pid: string; name: string; kind: PlotKind; at: string }

/** 올해 음모가 생길 확률(8%, 불안 +5·시위 +5·패전 +7, 최대 25%). */
export function plotYearChance(f: { lowStability: boolean; protest: boolean; warLosing: boolean }): number {
  return Math.min(PLOT.maxChance, PLOT.yearChance + (f.lowStability ? PLOT.boostLow : 0) + (f.protest ? PLOT.boostProtest : 0) + (f.warLosing ? PLOT.boostWar : 0));
}
/** 판정에 쓰는 인물(우리 현직 지도자). */
export interface PlotPerson { pid: string; name: string; cls: string; lv: number; council: boolean; asg: boolean; ruler: boolean; eth?: EthKey; heirChild?: boolean; rulerChild?: boolean }
export interface PlotWorld {
  persons: PlotPerson[];
  /** 총독이 있는 행성(안정도 오름차순으로 쓴다) */ planets: Array<{ k: number; name: string; stability?: number; governor?: string }>;
  /** 망명을 받아 줄 만한 제국(전쟁 중·경쟁국) */ foes: Array<{ idx: number; name: string }>;
  /** 세습 정부 */ hereditary: boolean;
  /** 파벌(지지 낮은 쪽이 음모 파벌이 되기 쉽다) */ factions: Array<{ eth: EthKey; support: number; approval: number }>;
  /** 지금 진행 중인 음모의 인물(같은 사람이 두 건을 꾸미지 않게) */ busy: string[];
  /** 가문 특성(야심 가문이면 영향력 +10) */ ambitious?: (pid: string) => boolean;
  /** 「부패」 음모 후보 가중치(통치자 개인 금고의 부패 낌새, 기본 1 — 2026-10-30) */ graftWeight?: number;
}
export interface PlotCand { kind: PlotKind; p: PlotPerson; planetK?: number; planet?: string; tid?: number; target?: string; w: number }
export function plotCandidates(w: PlotWorld): PlotCand[] {
  const out: PlotCand[] = [];
  const free = w.persons.filter((p) => !p.ruler && !w.busy.includes(p.pid));
  for (const p of free) {
    if (p.cls === 'official') {
      const pl = w.planets.filter((x) => x.governor === p.pid).sort((a, b) => (a.stability ?? 100) - (b.stability ?? 100))[0];
      if (pl && (pl.stability ?? 100) < 50) out.push({ kind: 'secede', p, planetK: pl.k, planet: pl.name, w: 1 });
    }
    if (p.cls === 'commander' && p.lv >= 2) out.push({ kind: 'power', p, w: 1 });
    if (p.council) out.push({ kind: 'graft', p, w: w.graftWeight ?? 1 });
    if (w.factions.length && (p.eth || p.council)) out.push({ kind: 'collude', p, w: 0.6 }); // 파벌을 지지하는 총독·평의회 인물만
    if (w.foes.length) { const f = w.foes[0]; out.push({ kind: 'defect', p, tid: f.idx, target: f.name, w: 0.3 }); }
    if (w.hereditary && p.rulerChild && !p.heirChild) out.push({ kind: 'succession', p, w: 2 });
  }
  return out;
}
export function pickPlot(c: PlotCand[], rand: () => number): PlotCand | null {
  const sum = c.reduce((n, x) => n + x.w, 0); if (sum <= 0) return null;
  let r = rand() * sum; for (const x of c) { r -= x.w; if (r < 0) return x; } return c[c.length - 1];
}
/** 음모자 영향력 시작값: 20 + 레벨×8 + 평의회 15 + 직책 10 (+ 야심 가문 10), 0~100. */
export const startInfluence = (p: PlotPerson, ambitious = false): number => clamp(20 + Math.max(0, p.lv) * 8 + (p.council ? 15 : 0) + (p.asg ? 10 : 0) + (ambitious ? 10 : 0), 0, 100);
/** 음모 쪽 파벌: 그 인물이 지지하는 파벌, 모르면 지지도가 가장 낮은 파벌. */
export function plotEthic(p: PlotPerson, factions: PlotWorld['factions']): EthKey | undefined {
  if (p.eth) return p.eth;
  const f = factions.slice().sort((a, b) => a.approval - b.approval || a.support - b.support)[0];
  return f?.eth;
}
export function newPlot(id: string, c: PlotCand, today: string, w: PlotWorld): Plot {
  const pl: Plot = { id, kind: c.kind, pid: c.p.pid, name: c.p.name, cls: c.p.cls, inf: startInfluence(c.p, !!w.ambitious?.(c.p.pid)), prog: 0, since: today, log: [] };
  const eth = plotEthic(c.p, w.factions); if (eth) pl.eth = eth;
  if (c.planetK) { pl.planetK = c.planetK; pl.planet = c.planet; }
  if (c.tid) { pl.tid = c.tid; pl.target = c.target; }
  return pl;
}
/** 한 달 걸음(순수, 진행 중·발각 전만). 한 달 +3~6(영향력이 높을수록 위쪽). */
export function plotStep(pl: Plot, rand: () => number): { pl: Plot; hint: boolean; found: boolean; won: boolean } {
  if (pl.ended || pl.found) return { pl, hint: false, found: false, won: false };
  const hi = PLOT.stepMin + Math.round(((PLOT.stepMax - PLOT.stepMin) * clamp(pl.inf, 0, 100)) / 100);
  const step = PLOT.stepMin + Math.floor(rand() * (hi - PLOT.stepMin + 1));
  const prog = clamp(pl.prog + step, 0, PLOT.doneAt);
  const hint = !pl.hinted && prog >= PLOT.hintAt;
  if (prog >= PLOT.doneAt) return { pl: { ...pl, prog }, hint, found: false, won: true };
  const found = rand() < (prog > PLOT.highAt ? PLOT.discoverHigh : PLOT.discover);
  return { pl: { ...pl, prog }, hint, found, won: false };
}
export type PlotAct = 'bribe' | 'expose' | 'appease' | 'demote' | 'arrest' | 'exile';
/** 그 대응을 지금 할 수 있는가(견제 = 낌새 뒤·발각 전, 처리 = 발각 뒤). */
export function canAct(pl: Plot, a: PlotAct): boolean {
  if (pl.ended) return false;
  if (a === 'bribe' || a === 'expose') return !!pl.hinted && !pl.found;
  return !!pl.found;
}
export const actCost = (a: PlotAct): { energy: number; influence: number } => (a === 'bribe' ? { energy: PLOT.bribe.energy, influence: 0 } : a === 'expose' ? { energy: 0, influence: PLOT.expose.influence } : a === 'appease' ? { energy: PLOT.appease.energy, influence: PLOT.appease.influence } : { energy: 0, influence: 0 });
/** 견제 반영(순수). */
export function applyCheck(pl: Plot, a: 'bribe' | 'expose'): Plot {
  if (a === 'bribe') return { ...pl, prog: clamp(pl.prog + PLOT.bribe.progress, 0, 100), bribes: (pl.bribes ?? 0) + 1 };
  return { ...pl, inf: clamp(pl.inf + PLOT.expose.inf, 0, 100), prog: clamp(pl.prog + PLOT.expose.progress, 0, 100), exposes: (pl.exposes ?? 0) + 1 };
}
/** 처리의 반동(민심·시위 원인 확률). 회유는 반동 없음. */
export const backlash = (a: PlotAct): { mood: number; protest: number; crack: boolean } =>
  a === 'demote' ? { mood: PLOT.demote.mood, protest: 0, crack: true } : a === 'arrest' ? { mood: PLOT.arrest.mood, protest: PLOT.arrest.protest, crack: true } : a === 'exile' ? { mood: PLOT.exile.mood, protest: PLOT.exile.protest, crack: true } : { mood: 0, protest: 0, crack: false };
/** 빈 감방 번호(1..8). 없으면 0. */
export function freeCell(prisoners: Array<Prisoner & { cell?: number }>): number {
  const used = new Set(prisoners.filter((p) => p.state === 'held').map((p) => p.cell ?? 0));
  for (let i = 1; i <= PLOT.cells; i++) if (!used.has(i)) return i; return 0;
}

// ---- 글
export const PLOT_NAME: Record<PlotKind, [string, string]> = {
  secede: ['독립 모의', 'Secession plot'], power: ['권력 노림', 'Power grab'], graft: ['부패', 'Graft'],
  collude: ['반대 파벌과 결탁', 'Collusion with a faction'], defect: ['적국 망명 준비', 'Plans to defect'], succession: ['후계 다툼', 'Succession struggle'],
};
export const ACT_NAME: Record<PlotAct, [string, string]> = {
  bribe: ['매수', 'Bribe'], expose: ['추문 폭로', 'Expose a scandal'], appease: ['회유', 'Appease'], demote: ['좌천', 'Demote'], arrest: ['체포', 'Arrest'], exile: ['추방', 'Exile'],
};
type Lf = (ko: string, en: string) => string;
/** 음모 한 줄 설명. */
export function plotText(pl: Plot, L: Lf): string {
  switch (pl.kind) {
    case 'secede': return L(`총독 ${pl.name}이(가) 「${pl.planet ?? '?'}」를 떼어 내 독립하려 한다`, `Governor ${pl.name} wants to break "${pl.planet ?? '?'}" away`);
    case 'power': return L(`${pl.name}이(가) 군을 등에 업고 권력을 노린다`, `${pl.name} is reaching for power with the military behind them`);
    case 'graft': return L(`${pl.name}이(가) 나랏돈을 빼돌린다`, `${pl.name} is siphoning state funds`);
    case 'collude': return L(`${pl.name}이(가) 반대 파벌과 손을 잡았다`, `${pl.name} has joined hands with an opposition faction`);
    case 'defect': return L(`${pl.name}이(가) ${pl.target ?? '적국'}(으)로 넘어갈 준비를 한다`, `${pl.name} is preparing to defect to ${pl.target ?? 'an enemy'}`);
    case 'succession': return L(`${pl.name}이(가) 후계 자리를 노리고 세력을 모은다`, `${pl.name} is gathering support to claim the succession`);
  }
}
/** 낌새 알림(비서의 귀띔). */
export const hintText = (pl: Plot, L: Lf): string => L(`비서의 귀띔: ${pl.name}의 움직임이 수상합니다. 「${PLOT_NAME[pl.kind][0]}」 소문이 돕니다(확인되지 않음).`, `A word from your secretary: ${pl.name} is acting suspiciously. There are rumors of a "${PLOT_NAME[pl.kind][1]}" (unconfirmed).`);
export const foundText = (pl: Plot, L: Lf): string => L(`음모가 드러났습니다 — ${plotText(pl, L)}. 집무실 「궁정」에서 처리를 정하세요.`, `A plot has been uncovered — ${plotText(pl, L)}. Decide what to do in the Office under "Court".`);
/** 음모가 이루어졌을 때 결과 설명. */
export function wonText(pl: Plot, L: Lf): string {
  switch (pl.kind) {
    case 'secede': return L(`「${pl.planet ?? '?'}」에서 독립 모의가 터졌다: 안정도 -15(2년)와 시위`, `The secession plot broke out on "${pl.planet ?? '?'}": stability -15 (2 years) and protests`);
    case 'power': return L(`${pl.name}이(가) 권력을 휘둘렀다: 영향력 -100, 신문 호외`, `${pl.name} seized a share of power: influence -100, a newspaper extra`);
    case 'graft': return L(`${pl.name}의 부패로 국고가 샜다: 에너지 -10%(1년)`, `Graft by ${pl.name} drained the treasury: energy -10% (1 year)`);
    case 'collude': return L(`${pl.name}과(와) 결탁한 파벌이 힘을 얻었다: 그 파벌 매력도 +15%(2년)`, `The faction ${pl.name} colluded with grew stronger: attraction +15% (2 years)`);
    case 'defect': return L(`${pl.name}이(가) ${pl.target ?? '적국'}(으)로 망명했다`, `${pl.name} defected to ${pl.target ?? 'an enemy'}`);
    case 'succession': return L(`${pl.name}의 후계 다툼이 궁정을 갈라놓았다: 영향력 -100, 민심 하락`, `${pl.name}'s succession struggle split the court: influence -100, lower public mood`);
  }
}
/** 대응 결과 줄(연대기). */
export function actText(pl: Plot, a: PlotAct, L: Lf, extra = ''): string {
  const n = pl.name;
  const t: Record<PlotAct, [string, string]> = {
    bribe: [`${n}에게 몰래 돈을 쥐여 주어 음모를 늦췄다`, `Slipped money to ${n} to slow the plot`],
    expose: [`${n}의 추문을 터뜨려 궁정에서의 입지를 깎았다`, `Leaked a scandal about ${n}, cutting their standing at court`],
    appease: [`${n}을(를) 달래고 자리를 보장해 음모를 거두게 했다`, `Appeased ${n} and guaranteed their position; the plot was dropped`],
    demote: [`${n}을(를) 직책에서 물러나게 했다`, `Removed ${n} from their post`],
    arrest: [`${n}을(를) 체포해 가두었다`, `Arrested and imprisoned ${n}`],
    exile: [`${n}을(를) 제국에서 추방했다`, `Exiled ${n} from the empire`],
  };
  return L(t[a][0] + extra, t[a][1] + extra);
}

// ---- 게임 명령(모드: tester-mod/common/scripted_effects/sllm_court.txt). 회신 SLLM:COURT op=… status=…
export type CourtMod = 'sllm_plot_graft' | 'sllm_plot_secede' | `sllm_plot_crack_${EthKey}` | `sllm_plot_collude_${EthKey}`;
const MOD_OK = (m: string): boolean => m === 'sllm_plot_graft' || m === 'sllm_plot_secede' || ETHS.some((e) => m === `sllm_plot_crack_${e}` || m === `sllm_plot_collude_${e}`);
/** 비용 치르기: 창고가 모자라면 short. */
export function courtPayCommand(req: number, energy: number, influence: number): string {
  if (!okReq(req) || !int(energy) || !int(influence) || energy < 0 || influence < 0 || energy > 1e6 || influence > 1e5) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_pay = { REQ = ${req} EN = ${energy} INF = ${influence} }`);
}
/** 영향력만 잃기(권력 노림·후계 다툼이 이루어짐). */
export function courtLoseCommand(req: number, influence: number): string {
  if (!okReq(req) || !int(influence) || influence < 1 || influence > 1e5) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_lose = { REQ = ${req} INF = ${influence} }`);
}
export type LeaderAct = 'unassign' | 'jail' | 'free' | 'exile';
/** 지도자(sllm_lid)에게: 직책 해제 · 수감(직책 해제 + 「수감됨」 특성) · 석방(특성 뗌) · 추방(exile_leader_as). */
export function courtLeaderCommand(req: number, lid: number, act: LeaderAct): string {
  if (!okReq(req) || !okIdx(lid) || !['unassign', 'jail', 'free', 'exile'].includes(act)) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_${act} = { REQ = ${req} LID = ${lid} }`);
}
/** 망명·혼인으로 보내기: 우리 지도자(sllm_lid)를 그 제국(sllm_idx = TID)의 지도자로. */
export function courtSendCommand(req: number, lid: number, tid: number): string {
  if (!okReq(req) || !okIdx(lid) || !okIdx(tid)) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_send = { REQ = ${req} LID = ${lid} TID = ${tid} }`);
}
/** 우리 나라 수정자(파벌 매력도 -10%·+15%, 에너지 -10%). */
export function courtModCommand(req: number, mod: CourtMod, days: number): string {
  if (!okReq(req) || !MOD_OK(mod) || !int(days) || days < 30 || days > 3600) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_mod = { REQ = ${req} MOD = ${mod} DAYS = ${days} }`);
}
/** 행성(every_owned_colony 순서 k)에 수정자(독립 모의: 안정도 -15). */
export function courtPlanetCommand(req: number, k: number, mod: CourtMod, days: number): string {
  if (!okReq(req) || !okIdx(k) || k > 2000 || !MOD_OK(mod) || !int(days) || days < 30 || days > 3600) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_planet = { REQ = ${req} K = ${k} MOD = ${mod} DAYS = ${days} }`);
}
/** 혼인 동맹 호감(+40): add = 붙이기, 아니면 떼기(전쟁). */
export function marryBondCommand(req: number, tid: number, add: boolean): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_COURT');
  return wrapForPlayer(`sllm_court_bond = { REQ = ${req} TID = ${tid} ADD = ${add ? 'yes' : 'no'} }`);
}

// ======================================================================================
// ② 가문
// ======================================================================================
export interface HouseTrait { key: string; ko: string; en: string; dko: string; den: string; prompt: string }
export const HOUSE_TRAITS: HouseTrait[] = [
  { key: 'scholarly', ko: '학자 가문', en: 'Scholarly', dko: '책과 연구를 대대로 아낀다', den: 'Generations devoted to books and research', prompt: 'a scholarly house that prizes learning' },
  { key: 'martial', ko: '무인 가문', en: 'Martial', dko: '전장에서 이름을 떨친 핏줄', den: 'A bloodline that made its name on the battlefield', prompt: 'a martial house proud of its warriors' },
  { key: 'mercantile', ko: '상인의 피', en: 'Mercantile', dko: '셈이 빠르고 거래에 밝다', den: 'Quick with numbers and shrewd in trade', prompt: 'a house with merchant blood, shrewd in bargains' },
  { key: 'pious', ko: '경건', en: 'Pious', dko: '신앙과 의례를 지킨다', den: 'Keepers of faith and ritual', prompt: 'a pious house that keeps its rites' },
  { key: 'ambitious', ko: '야심', en: 'Ambitious', dko: '더 높은 자리를 꿈꾼다', den: 'Always reaching higher', prompt: 'an ambitious house that always reaches higher' },
  { key: 'longlived', ko: '장수', en: 'Long-lived', dko: '오래 사는 이가 많다', den: 'Many live long lives', prompt: 'a long-lived house' },
  { key: 'artistic', ko: '예술', en: 'Artistic', dko: '음악과 그림을 사랑한다', den: 'Lovers of music and painting', prompt: 'an artistic house that loves music and painting' },
  { key: 'ruthless', ko: '냉혹', en: 'Ruthless', dko: '필요하면 정을 끊는다', den: 'Will cut ties when it must', prompt: 'a ruthless house that does what must be done' },
  { key: 'benevolent', ko: '자애', en: 'Benevolent', dko: '백성을 먼저 생각한다', den: 'Puts the people first', prompt: 'a benevolent house that puts the people first' },
  { key: 'secretive', ko: '비밀', en: 'Secretive', dko: '속내를 잘 드러내지 않는다', den: 'Rarely shows its hand', prompt: 'a secretive house that rarely shows its hand' },
  { key: 'wanderer', ko: '탐험', en: 'Wanderers', dko: '먼 별을 그리워한다', den: 'Always longing for distant stars', prompt: 'a house of wanderers who long for distant stars' },
  { key: 'eloquent', ko: '웅변', en: 'Eloquent', dko: '말로 사람을 움직인다', den: 'Moves people with words', prompt: 'an eloquent house that moves people with words' },
  { key: 'stubborn', ko: '고집', en: 'Stubborn', dko: '한번 정하면 꺾이지 않는다', den: 'Never bends once decided', prompt: 'a stubborn house that never bends' },
  { key: 'paranoid', ko: '의심', en: 'Wary', dko: '아무도 쉽게 믿지 않는다', den: 'Trusts no one easily', prompt: 'a wary house that trusts no one easily' },
  { key: 'charismatic', ko: '매력', en: 'Charismatic', dko: '사람을 끄는 힘이 있다', den: 'Draws people in', prompt: 'a charismatic house that draws people in' },
  { key: 'frugal', ko: '검소', en: 'Frugal', dko: '사치를 멀리한다', den: 'Shuns luxury', prompt: 'a frugal house that shuns luxury' },
];
export const HOUSE = { traits: 2, inherit: 0.7, newTrait: 0.2, maxTraits: 3, foreignTraits: 1 } as const;
export const traitOf = (k: string): HouseTrait | undefined => HOUSE_TRAITS.find((t) => t.key === k);
const pickN = (pool: string[], n: number, rand: () => number): string[] => { const p = pool.slice(), out: string[] = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(rand() * p.length) % p.length, 1)[0]); return out; };
export const houseTraitsNew = (rand: () => number, n: number = HOUSE.traits): string[] => pickN(HOUSE_TRAITS.map((t) => t.key), n, rand);
/** 자녀의 가문 특성: 부모 가문 특성마다 70%로 이어지고, 20% 확률로 새 특성 하나(최대 3). */
export function inheritTraits(parent: string[], rand: () => number): string[] {
  const out = parent.filter((k) => traitOf(k) && rand() < HOUSE.inherit);
  if (rand() < HOUSE.newTrait && out.length < HOUSE.maxTraits) { const pool = HOUSE_TRAITS.map((t) => t.key).filter((k) => !out.includes(k)); const k = pickN(pool, 1, rand)[0]; if (k) out.push(k); }
  return out.slice(0, HOUSE.maxTraits);
}
export interface HouseRuler { pid: string; name: string; from: string; to?: string }
export interface House { id: string; name: string; custom?: boolean; traits: string[]; since: string; rulers: HouseRuler[] }
export interface ForeignHouse { tid: number; name: string; traits: string[] }
/** 가문 이름 다듬기(사용자가 쓴 이름·성). */
export const houseNameText = (s: string): string => String(s ?? '').replace(/[\r\n\t<>{}[\]$§£#"\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
export const houseLabel = (h: { name: string }, L: Lf): string => L(`${h.name} 가문`, `House ${h.name}`);
/** 새 통치자가 이 가문 사람인가: 앞 통치자의 자녀(아기방 장부) 또는 성이 가문 이름과 같음. */
export function sameHouse(h: House, ruler: { pid: string; last: string }, childOf: (pid: string) => string | null): boolean {
  const par = childOf(ruler.pid);
  if (par && h.rulers.some((r) => r.pid === par)) return true;
  return !!ruler.last && !h.custom && houseNameText(ruler.last) === h.name;
}
/** AI 프롬프트(영어) — 우리 가문 사람. */
export function houseLine(h: House, traits: string[], role: 'ruler' | 'kin' | 'inlaw'): string {
  const ts = traits.map((k) => traitOf(k)?.prompt).filter(Boolean);
  const who = role === 'ruler' ? 'You head' : role === 'inlaw' ? 'You married into' : 'You belong to';
  return `[House] ${who} House ${h.name}${ts.length ? `, ${ts.join(' and ')}` : ''}. Its name and traits are part of who you are.`;
}

// ======================================================================================
// ③ 정략결혼
// ======================================================================================
export const MARRY = { opinion: 40, bonus: 10, rivalPenalty: -20, maxDowry: 100000 } as const;
export interface Marriage {
  id: string; cid: string; child: string; childGender: 'm' | 'f'; tid: number; empire: string; spouse: string; house: string; on: string;
  /** 지도자 자녀를 상대 제국으로 보냈는가(게임에서 상대 지도자가 됨) */ sent?: boolean; lid?: number;
  state: 'wed' | 'strained' | 'ended'; strainedOn?: string;
}
/** 혼인할 수 있는 자녀(살아 있는 성인, 이미 혼인하지 않음). */
export interface MarryKid { id: string; name: string; gender: 'm' | 'f'; leader: boolean; lid?: number; job?: string; married: boolean; dead: boolean; adult: boolean; heir?: boolean }
export const canMarry = (k: MarryKid): boolean => k.adult && !k.dead && !k.married;
/** 혼인 확률 덧셈(외교 거래 확률 위에): +10, 경쟁국이면 -20. */
export const marryBonus = (rival: boolean): number => MARRY.bonus + (rival ? MARRY.rivalPenalty : 0);
export function marryErrors(k: MarryKid | undefined, war: boolean, already: boolean): string[] {
  const e: string[] = [];
  if (!k) e.push('kid'); else if (!canMarry(k)) e.push('kid_busy');
  if (war) e.push('war');
  if (already) e.push('already');
  return e;
}
export function marryErrorText(code: string, L: Lf): string {
  return ({
    kid: L('혼인할 자녀를 고르세요.', 'Choose a child to marry.'),
    kid_busy: L('그 자녀는 지금 혼인할 수 없습니다(성인이 아니거나 이미 혼인함).', 'That child cannot marry now (not grown, or already married).'),
    war: L('전쟁 중인 제국과는 혼인할 수 없습니다.', 'No marriage with an empire we are at war with.'),
    already: L('이 제국과는 이미 혼인 동맹이 있습니다.', 'We already have a marriage bond with this empire.'),
  } as Record<string, string>)[code] ?? code;
}
export const marryText = (m: Marriage, L: Lf): string => L(`${m.child} ⚭ ${m.spouse}(${m.empire}, ${m.house} 가문)`, `${m.child} ⚭ ${m.spouse} (${m.empire}, House ${m.house})`);
/** 상대 제국 1:1 연대기 줄 · AI 가 기억할 줄. */
export const marryChron = (m: Marriage, us: string, L: Lf): string => L(`${us}의 ${m.child}와(과) 우리 통치 가문의 ${m.spouse}이(가) 혼인해 혼인 동맹을 맺었다`, `${m.child} of ${us} married ${m.spouse} of our ruling house, sealing a marriage bond`);
/** 전쟁으로 곤란해진 자녀(틀 문장). */
export const strainText = (m: Marriage, L: Lf): string => L(`${m.empire}과(와) 전쟁이 나자 ${m.empire}에 시집·장가간 ${m.child}의 처지가 곤란해졌다. 양쪽 궁정 모두 그를 의심의 눈으로 본다.`, `With war against ${m.empire}, ${m.child}, who married into that empire, is caught in between; both courts eye them with suspicion.`);
