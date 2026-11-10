// 게임 상황 수집(2026-10-16 초석). 모드가 남기는 원시 로그(SPEECHWAR/SPEECHCTX, STATE_BEGIN..STATE_END, ORIGIN, SPYOP)를
// 앱이 쓰는 값으로 바꾼다. 밸런스 수치는 모두 여기 TUNE 에 모아 두어, 게임에서 보고 앱만 고쳐 조정할 수 있게 한다.
// 순수 로직만 둔다(Electron·파일 접근 없음). 게임 효과를 바꾸지 않는다.
import type { SllmMessage } from './protocol';
import type { SpeechCtx } from './speech';
import { L } from './i18n-pick'; // 연대기 문장은 인터페이스 언어로(2026-10-19)

/** 밸런스 값(게임에서 직접 보고 조정 예정 — 사용자 결정 2026-10-16). */
export const TUNE = {
  speech: {
    /** 영유권 주장 성계 수 → 0 없음 / 1 보통 / 2 많음 */
    claims: { some: 1, many: 5 },
    /** 행성당 월 산출(에너지1·광물1·식량0.5·합금2·소비재1.5 가중) → 0 낮음 / 1 보통 / 2 높음 */
    income: { weights: { energy: 1, minerals: 1, food: 0.5, alloys: 2, consumer_goods: 1.5 }, mid: 40, high: 100 },
    /** 행성당 월 연구(물리+사회+공학) → 0 낮음 / 1 보통 / 2 높음 */
    research: { mid: 25, high: 60 },
    /** 전황: (상대 피로도 - 우리 피로도) 평균 → -2..2 */
    tide: { small: 0.1, large: 0.3 },
  },
  war: {
    /** 피로도 차이가 이 이상이면 승리/패배 예상, 아니면 현상 유지 */
    outlookMargin: 0.15,
    /** 이 피로도 이상이면 강제 항복(현상 유지 수용) 위험 */
    collapse: 0.9,
  },
  faction: {
    /** 승인도 → 반발 / 중립 / 지지 */
    unrest: 0.4, content: 0.7,
    /** 지지율이 이 이상이면 '주요 파벌' */
    major: 0.25,
  },
} as const;

const num = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v.trim().replace(/%$/, ''));
  return Number.isFinite(n) ? n : undefined;
};
/** 피로도·지지율 같은 0..1 값. 게임이 0..100 으로 보내도 0..1 로 맞춘다. */
const frac = (v: string | undefined): number | undefined => { const n = num(v); if (n === undefined) return undefined; const f = n > 1 ? n / 100 : n; return Math.max(0, Math.min(1, f)); };
const tier = (v: number, mid: number, high: number) => (v >= high ? 2 : v >= mid ? 1 : 0);

// ---- 연설 상황 ----
export interface CtxWar { name: string; side: 'att' | 'def'; ax: number; dx: number }
/** SPEECHWAR(전쟁마다) + SPEECHCTX(원시값) → SpeechCtx(단계값). 원시값이 없고 단계값만 있으면 그대로 쓴다(이전 형식). */
export function ctxFromRaw(kv: Record<string, string>, wars: CtxWar[]): SpeechCtx {
  const c: SpeechCtx = {};
  // 예전 단계값 형식이 직접 오면 그대로 받는다.
  for (const k of ['role', 'tide', 'exhaustion', 'claims', 'income', 'research', 'unexplored'] as const) { const v = num(kv[k]); if (v !== undefined) c[k] = v; }
  const war = num(kv.war); if (war !== undefined) c.war = war ? 1 : 0;
  if (c.war === 1 && wars.length) {
    if (c.role === undefined) c.role = wars.some((w) => w.side === 'def') ? 1 : 2; // 방어전이 하나라도 있으면 방어 명분(해방전 구분은 후속)
    const own = wars.map((w) => (w.side === 'att' ? w.ax : w.dx)), foe = wars.map((w) => (w.side === 'att' ? w.dx : w.ax));
    if (c.exhaustion === undefined) c.exhaustion = Math.round(Math.max(...own) * 100);
    if (c.tide === undefined) {
      const d = foe.reduce((s, v, i) => s + v - own[i], 0) / wars.length, t = TUNE.speech.tide;
      c.tide = d >= t.large ? 2 : d >= t.small ? 1 : d <= -t.large ? -2 : d <= -t.small ? -1 : 0;
    }
  } else if (c.war === 1 && c.exhaustion === undefined) {
    const ex = Math.max(frac(kv.offex) ?? 0, frac(kv.defex) ?? 0); if (kv.offex !== undefined || kv.defex !== undefined) c.exhaustion = Math.round(ex * 100);
  }
  const claimsn = num(kv.claimsn); if (c.claims === undefined && claimsn !== undefined) c.claims = tier(claimsn, TUNE.speech.claims.some, TUNE.speech.claims.many);
  const pl = Math.max(1, num(kv.pl) ?? 1);
  const w = TUNE.speech.income.weights, inc = [['ie', w.energy], ['im', w.minerals], ['if', w.food], ['ia', w.alloys], ['ic', w.consumer_goods]] as const;
  if (c.income === undefined && inc.some(([k]) => num(kv[k]) !== undefined)) c.income = tier(inc.reduce((s, [k, wt]) => s + (num(kv[k]) ?? 0) * wt, 0) / pl, TUNE.speech.income.mid, TUNE.speech.income.high);
  if (c.research === undefined && ['rp', 'rs', 're'].some((k) => num(kv[k]) !== undefined)) c.research = tier(((num(kv.rp) ?? 0) + (num(kv.rs) ?? 0) + (num(kv.re) ?? 0)) / pl, TUNE.speech.research.mid, TUNE.speech.research.high);
  const sys = num(kv.sys), unsv = num(kv.unsv); if (c.unexplored === undefined && sys && unsv !== undefined) c.unexplored = Math.round(Math.max(0, Math.min(1, unsv / sys)) * 100);
  return c;
}
/** SPEECHWAR 줄을 모았다가 같은 n 의 SPEECHCTX 가 오면 상황을 만든다. */
export class SpeechCtxCollector {
  private n = ''; private wars: CtxWar[] = [];
  feed(m: SllmMessage): SpeechCtx | null {
    if (m.kind === 'SPEECHWAR') {
      const n = m.kv.n ?? ''; if (n !== this.n) { this.n = n; this.wars = []; }
      const ax = frac(m.kv.ax), dx = frac(m.kv.dx), side = m.kv.side;
      if ((side === 'att' || side === 'def') && ax !== undefined && dx !== undefined) this.wars.push({ name: m.kv.name ?? '', side, ax, dx });
      return null;
    }
    if (m.kind !== 'SPEECHCTX') return null;
    const wars = (m.kv.n ?? '') === this.n ? this.wars : [];
    this.n = ''; this.wars = [];
    return ctxFromRaw(m.kv, wars);
  }
}

// ---- 월간 상황(전쟁·파벌·첩보망·종속) ----
export interface StateWar { name: string; side: 'att' | 'def'; ax: number; dx: number; total: boolean; attacker?: string; defender?: string }
export const FACTION_ETHICS = ['', 'militarist', 'pacifist', 'authoritarian', 'egalitarian', 'xenophile', 'xenophobe', 'materialist', 'spiritualist'] as const;
export type FactionEthic = (typeof FACTION_ETHICS)[number];
export interface StateFaction { fid?: number; name: string; ethic: FactionEthic; support: number; approval: number }
export interface StateSpyNet { target: string; power: number; /** 그 첩보망의 자산(asset_ 뺀 이름, 2026-10-20). 옛 모드면 없음 */ assets?: string[] }
export interface StateSnapshot { sid: string; n: string; date: string; wars: StateWar[]; factions: StateFaction[]; spynets: StateSpyNet[]; subject: { overlord: string; loyalty: number } | null;
  /** 우리 종속국(종속국 통신 채널, 2026-10-17). 없으면 빈 배열 */ vassals?: Array<{ idx: number; name: string; loyalty: number }>;
  /** 평의회 의제 칸이 비었는지(내정·파벌 회의 알림). 모르면 undefined */ agendaFree?: boolean; gestalt?: boolean; /** 고를 수 있는 평의회 의제 비트(faction-meeting AGENDAS avail). 옛 모드면 없음 */ agendaAvail?: number; /** 제국 가치관 비트(faction-meeting ETHIC_BITS, 512 = 유랑). 모르면 undefined */ empireEth?: number;
  /** 플레이어 제국 외계인 성향(파벌 대표 종족): 1 보통·2 광적, 0 없음 */ xenophile?: number; xenophobe?: number;
  /** 통치 체제(2026-10-23): 1 민주 2 과두 3 독재 4 제정 5 기업 0 그 밖. 옛 모드면 없음 */ authority?: number;
  /** 동맹(방위 조약·연방)이 방어 전쟁 중인데 우리가 안 끼었나(외교 거래, 2026-10-27). 옛 모드면 없음 → 앱은 매달 직접 묻는다 */ allyWar?: boolean;
  /** 엔클레이브·캐러밴(알파 11, 2026-10-25): 세계의 축제 중·축제 소동 수정자, 캐러밴 선단 국경 진입 비트(1·2·4, 540일). 옛 모드면 없음 */ enclave?: { fest: boolean; outrage: boolean; cara: number };
  /** 민심 재료(알파 10): 행성 안정도 합·수, 불안 행성 수, 전쟁 피로도 합(0..1 들의 합). 옛 모드면 없음 */ mood?: { sum: number; cnt: number; low: number; ox: number; dx: number } }
export interface OriginRecord { kind: 'rebels' | 'released'; country: string; from: string; by?: string; planet?: string; date: string }
export interface SpyOpRecord { phase: 'finished' | 'cancelled'; op: string; owner: string; target: string; date: string; /** 작전 종류(모드가 아는 것만: smear = 비방 공작, 2026-10-20) */ type?: string }

/** 2026-11-09(회랑 방식): 모드가 바뀌지 않아 안 보낸 묶음(STATE_END kp 비트). 앱은 지난 상황의 값을 이어 쓴다. */
export const STATE_KEEP = { council: 1, enclave: 2, factions: 4, vassals: 8, mood: 16 } as const;
/** 안 보낸 묶음을 지난 상황(같은 세이브)에서 채운다. 지난 상황이 없으면 false(그 달은 쓰지 않고 모드에 전부 보내 달라고 한다). */
export function carryKept(c: StateSnapshot, prev: StateSnapshot | null, kp: number): boolean {
  if (!kp) return true;
  if (!prev || prev.sid !== c.sid) return false;
  if (kp & STATE_KEEP.council) { c.agendaFree = prev.agendaFree; c.gestalt = prev.gestalt; c.empireEth = prev.empireEth; c.agendaAvail = prev.agendaAvail; c.authority = prev.authority; c.allyWar = prev.allyWar; c.xenophile = prev.xenophile; c.xenophobe = prev.xenophobe; }
  if (kp & STATE_KEEP.enclave) c.enclave = prev.enclave ? { ...prev.enclave } : undefined;
  if (kp & STATE_KEEP.factions) c.factions = prev.factions.map((f) => ({ ...f }));
  if (kp & STATE_KEEP.vassals) c.vassals = (prev.vassals ?? []).map((v) => ({ ...v }));
  if (kp & STATE_KEEP.mood) c.mood = prev.mood ? { ...prev.mood } : undefined;
  return true;
}

/** STATE_BEGIN 부터 STATE_END 까지 모아 하나의 상황으로 만든다. 끝이 오지 않은 묶음은 버린다. */
export class StateCollector {
  private cur: StateSnapshot | null = null;
  last: StateSnapshot | null = null;
  /** 안 보낸 묶음을 채울 지난 상황이 없었다(앱을 새로 켰음 등) — 부르는 쪽이 모드에 「다음 달은 전부」를 청하고 지운다(2026-11-09). */
  needFull = false;
  /** 완성된 상황이 생기면 돌려준다. */
  feed(m: SllmMessage): StateSnapshot | null {
    const k = m.kind, kv = m.kv;
    if (k === 'STATE_BEGIN') { this.cur = { sid: kv.sid ?? '', n: kv.n ?? '', date: kv.date ?? '', wars: [], factions: [], spynets: [], subject: null, vassals: [] }; return null; }
    const c = this.cur; if (!c) return null;
    const same = kv.n === undefined || kv.n === c.n;
    if (k === 'WAR' && same) {
      const ax = frac(kv.ax), dx = frac(kv.dx);
      if ((kv.side === 'att' || kv.side === 'def') && ax !== undefined && dx !== undefined) c.wars.push({ name: kv.name ?? '', side: kv.side, ax, dx, total: kv.total === '1' });
    } else if (k === 'WARSIDE' && same) {
      const w = [...c.wars].reverse().find((x) => x.name === (kv.war ?? '')); if (w) { if (kv.role === 'att') w.attacker = kv.name ?? ''; else if (kv.role === 'def') w.defender = kv.name ?? ''; }
    } else if (k === 'FACTION' && same) {
      const e = num(kv.eth) ?? 0, s = frac(kv.sup), a = frac(kv.app);
      const fid = num(kv.fid);
      if (s !== undefined && a !== undefined) c.factions.push({ ...(fid !== undefined && Number.isSafeInteger(fid) && fid > 0 ? { fid } : {}), name: kv.name ?? '', ethic: FACTION_ETHICS[e] ?? '', support: s, approval: a });
    } else if (k === 'SPYNET' && same) {
      const p = num(kv.pow); if (kv.target && p !== undefined) c.spynets.push({ target: kv.target, power: p, ...(kv.as === '1' ? { assets: [] } : {}) });
    } else if (k === 'SPYASSET' && same) { // 첩보 자산 한 줄(협력자, 2026-10-20 알파 9): 바로 앞 같은 대상 첩보망에 붙인다
      const net = [...c.spynets].reverse().find((x) => x.target === (kv.target ?? '')); const a = String(kv.a ?? '');
      if (net?.assets && /^[a-z_]{2,40}$/.test(a) && net.assets.length < 40 && !net.assets.includes(a)) net.assets.push(a);
    } else if (k === 'COUNCILAG' && same) {
      if (kv.free === '0' || kv.free === '1') c.agendaFree = kv.free === '1';
      if (kv.gest === '0' || kv.gest === '1') c.gestalt = kv.gest === '1';
      { const e = num(kv.eth); if (e !== undefined && Number.isSafeInteger(e) && e >= 0 && e < 1024) c.empireEth = e; }
      { const v = num(kv.agv); if (v !== undefined && Number.isSafeInteger(v) && v >= 0 && v < 1 << 20) c.agendaAvail = v; } // 지금 고를 수 있는 평의회 의제(faction-meeting AGENDAS avail 비트, 2026-10-19)
      { const au = num(kv.auth); if (au !== undefined && Number.isSafeInteger(au) && au >= 0 && au <= 5) c.authority = au; }
      if (kv.al === '0' || kv.al === '1') c.allyWar = kv.al === '1'; // 외교 거래: 동맹 방어 전쟁(2026-10-27) // 통치 체제(행성총독회의, 2026-10-23)
      for (const [key, prop] of [['xph', 'xenophile'], ['xpb', 'xenophobe']] as const) { const v = num(kv[key]); if (v !== undefined && v >= 0 && v <= 2) c[prop] = v; }
    } else if (k === 'VASSAL' && same) {
      const idx = num(kv.idx), loy = num(kv.loyalty);
      if (idx !== undefined && Number.isSafeInteger(idx) && idx > 0 && loy !== undefined) (c.vassals ??= []).push({ idx, name: kv.name ?? '', loyalty: loy });
    } else if (k === 'MOOD' && same) {
      const sum = num(kv.sum), cnt = num(kv.cnt), low = num(kv.low);
      if (sum !== undefined && cnt !== undefined && cnt >= 0 && low !== undefined) c.mood = { sum, cnt, low, ox: num(kv.ox) ?? 0, dx: num(kv.dx) ?? 0 };
    } else if (k === 'ENCLAVE' && same) {
      const ca = num(kv.cara); if (kv.fest === '0' || kv.fest === '1') c.enclave = { fest: kv.fest === '1', outrage: kv.outrage === '1', cara: ca !== undefined && Number.isSafeInteger(ca) && ca >= 0 && ca <= 7 ? ca : 0 };
    } else if (k === 'SUBJECT' && same) {
      c.subject = { overlord: kv.overlord ?? '', loyalty: num(kv.loyalty) ?? 0 };
    } else if (k === 'STATE_END') {
      this.cur = null;
      if ((kv.n ?? '') !== c.n) return null;
      const kp = num(kv.kp) ?? 0;
      if (!carryKept(c, this.last, Number.isSafeInteger(kp) && kp > 0 ? kp : 0)) { this.needFull = true; return null; }
      this.last = c; return c;
    }
    return null;
  }
}
export function originFrom(m: SllmMessage): OriginRecord | null {
  if (m.kind !== 'ORIGIN' || (m.kv.kind !== 'rebels' && m.kv.kind !== 'released') || !m.kv.country || !m.kv.from) return null;
  return { kind: m.kv.kind, country: m.kv.country, from: m.kv.from, by: m.kv.by || undefined, planet: m.kv.planet || undefined, date: m.kv.date ?? '' };
}
export function spyOpFrom(m: SllmMessage): SpyOpRecord | null {
  if (m.kind !== 'SPYOP' || (m.kv.phase !== 'finished' && m.kv.phase !== 'cancelled') || !m.kv.owner || !m.kv.target) return null;
  return { phase: m.kv.phase, op: m.kv.op ?? '', owner: m.kv.owner, target: m.kv.target, date: m.kv.date ?? '', ...(m.kv.type ? { type: m.kv.type } : {}) };
}

// ---- 값 대입: 각 기능이 쓸 판정 ----
export type WarOutlook = 'win' | 'stalemate' | 'lose';
/** 평화 중재·연설: 피로도 차이로 본 전쟁 전망(우리 편 기준). */
export function warOutlook(w: StateWar): { outlook: WarOutlook; own: number; foe: number; collapse: boolean } {
  const own = w.side === 'att' ? w.ax : w.dx, foe = w.side === 'att' ? w.dx : w.ax, d = foe - own;
  return { outlook: d >= TUNE.war.outlookMargin ? 'win' : d <= -TUNE.war.outlookMargin ? 'lose' : 'stalemate', own, foe, collapse: own >= TUNE.war.collapse };
}
/** 평화 중재: 한 교전 진영이 중재(백지평화)를 받아들일 성향 0..100. 지칠수록, 밀릴수록 높다. */
export function peaceWillingness(ownEx: number, foeEx: number): number {
  return Math.round(Math.max(0, Math.min(100, 20 + ownEx * 60 + (ownEx - foeEx) * 40)));
}
export type FactionMood = 'unrest' | 'neutral' | 'content';
/** 내정·파벌 회의: 파벌 태도와 대표 요구(가치관별 기본 요구 — 실제 정책 연결 전 초안). */
export const FACTION_DEMANDS: Record<FactionEthic, string> = {
  '': '현재 정책 유지와 안정',
  militarist: '군비 증강과 적극적인 확장',
  pacifist: '군축과 전쟁 회피',
  authoritarian: '질서 유지와 강한 중앙 권력',
  egalitarian: '시민 권리 확대와 정치 참여',
  xenophile: '외계 문명과의 교류와 이민 개방',
  xenophobe: '외계인 제한과 순혈 보호',
  materialist: '연구 투자와 기술 발전',
  spiritualist: '신앙 보호와 전통 존중',
};
export function factionStance(f: StateFaction): { mood: FactionMood; major: boolean; demand: string } {
  const t = TUNE.faction;
  return { mood: f.approval < t.unrest ? 'unrest' : f.approval >= t.content ? 'content' : 'neutral', major: f.support >= t.major, demand: FACTION_DEMANDS[f.ethic] };
}
/** 첩보: 끝난 작전에서 플레이어 관련 사건 후보(발각 판별은 후속). */
export function spyCandidate(op: SpyOpRecord, player: string): { role: 'ours' | 'against-us'; opponent: string } | null {
  if (op.owner === player && op.target !== player) return { role: 'ours', opponent: op.target };
  if (op.target === player && op.owner !== player) return { role: 'against-us', opponent: op.owner };
  return null;
}
/** 반란 출신: 연대기·대화용 한 줄. */
export function originText(o: OriginRecord): string {
  return o.kind === 'rebels'
    ? L(`${o.country}은(는) ${o.from}에 맞선 반란으로 ${o.planet ? o.planet + '을(를) 장악하며 ' : ''}독립했다.`, `${o.country} won independence by rebelling against ${o.from}${o.planet ? ', seizing ' + o.planet : ''}.`)
    : L(`${o.country}은(는) ${o.by ? o.by + '의 평화 협상으로 ' : ''}${o.from}에서 풀려나 독립했다.`, `${o.country} was released from ${o.from} and became independent${o.by ? ' through peace talks by ' + o.by : ''}.`);
}
