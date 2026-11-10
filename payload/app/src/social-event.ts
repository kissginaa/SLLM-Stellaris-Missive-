// 사교회(29·37·38·39·40) + 인간관계 불만 연간 판정(32) 의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 슈뢰딩거의 토큰(30): 여기에는 AI 호출이 없다. 초대·교류·화해·불만·연애 판정은 모두 앱의 난수와 저장된 상태로 끝내고,
// 플레이어가 모임에 합류해 실제로 말을 걸 때만 features 쪽에서 그 장면의 AI 를 부른다.
// 사용자 확정 수치: 식량 20 / 기본 2월 / 은퇴자 수락 50% / 교류 60·30·10(부족 50·40·10) / 연애 관심 3회 뒤 20% / 교제 50% /
//   자연 화해 30% / 불만 연간 20% / 약혼 연간 20%(교제 2년·호감 90·갈등 없음). 모두 「초기 조정 가능 값」이라 상수로 모아 둔다.
import { dayNo, addYears, addMonths, cmpDate } from './gamedate';
import { L } from './i18n-pick';
import { type Pid, type RelationLedger, type PairRelation, type Conflict, getPair, pairKey, stepStage, FRIEND_STAGES, RIVAL_STAGES, openConflictsBetween, openConflictIndex, resolveConflict, isPlaceholderPid } from './relations';

export type Rng = () => number; // [0,1)

export const SOCIAL = {
  foodCost: 20, defaultMonth: 2,
  acceptRetired: 0.5, acceptActive: 1,
  exchange: { good: 60, none: 30, friction: 10 }, shortageShift: 10, // 친분 → 변화 없음 으로 10%포인트
  romanceInterestAfterGood: 3, romanceInterest: 0.2, dating: 0.5,
  naturalReconcile: 0.3, discontentYearly: 0.2,
  engagementYearly: 0.2, engagementMinYears: 2, /** 2026-10-24 사용자 확정: NPC 쌍은 호감 수치 없이 확률만. 통치자가 만남을 주선한 쌍은 주선 1회당 +10%p(최대 +30%p). */ engagementArrangedBonus: 0.1, engagementArrangedMax: 0.3,
  /** NPC 커플 결별(41): 둘 사이 갈등이 2년 이상 미해결이면 연 20% 제안 → 3개월 숙려. */
  breakupYearly: 0.2, breakupConflictYears: 2, breakupCoolingMonths: 3,
  /** 행사당 배경 주요 만남 상한(29: 전수 조합 금지. 수치 미정 → 초기값 8). */
  maxBackgroundPairs: 8,
} as const;

/** 참석 후보 한 사람. retired = 연락 가능한 은퇴자(50% 판정). secretary 는 아예 넣지 않는다(29 비서 불참). */
export interface Attendee { pid: Pid; name: string; retired?: boolean; /** 연애 자격(23): 성인·연애 의사 확인. 미확인이면 false. */ romanceOk?: boolean; /** 현재 배우자·연인 pid(있으면 새 교제 판정 제외). */ partner?: Pid }

export type ExchangeResult = 'good' | 'none' | 'friction';
export interface Exchange { id: string; a: Pid; b: Pid; result: ExchangeResult; /** 플레이어가 참여한 대화인가(합류 장면). */ withRuler?: boolean; /** 플레이어가 직접 소개한 만남. */ introduced?: boolean }

export interface SocialSeason {
  sid: string; year: number; month: number; eventId: string; date: string;
  /** 이 행사 당시 통치자 pid(38: 불참 판정·연애 제외에 쓴다). */
  rulerPid: Pid;
  stage: 'planned' | 'open' | 'closed';
  /** 행사 품질(38): 식량 20이 모자라면 poor. 취소하지 않는다. */
  quality: 'normal' | 'poor';
  paid: 'pending' | 'applied' | 'short' | 'unknown';
  /** 통치자 참석 여부(38). 불참이면 통치자 관련 관계는 이 행사로 바뀌지 않는다. */
  rulerAttends: boolean | null;
  invites: Record<Pid, 'accepted' | 'declined'>;
  exchanges: Exchange[];
  /** 종료 처리 단계(37) 완료 표시 — 재진입·로드로 다시 돌리지 않는다. */
  judged: { reconcile: boolean; clear: boolean; discontent: boolean; romance: boolean; engagement: boolean; breakup: boolean };
  /** 플레이어에게 보여 준 결과 줄(공개 가능한 것만). */
  summary: string[];
}

export const socialEventId = (sid: string, year: number): string => `social:${sid}:${year}`;
export function newSeason(sid: string, year: number, month: number, date: string, rulerPid: Pid): SocialSeason {
  return { sid, year, month, eventId: socialEventId(sid, year), date, rulerPid, stage: 'planned', quality: 'normal', paid: 'pending', rulerAttends: null, invites: {}, exchanges: [], judged: { reconcile: false, clear: false, discontent: false, romance: false, engagement: false, breakup: false }, summary: [] };
}

/** 올해 행사가 열릴 달인가(연도별 한 번). 이미 닫힌 행사가 있으면 아니다(38: 완료 뒤 월 변경은 다음 해). */
export function socialDue(date: string, settingMonth: number, closedYears: number[]): { year: number } | null {
  const m = /^(\d+)\.(\d+)\./.exec(date); if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < settingMonth || closedYears.includes(y)) return null;
  return { year: y };
}
/** 개최 월 바꾸기(29): 1~12, 국가기념일과 같은 달 금지. 올해 이미 열렸으면 다음 해부터. */
export function canSetSocialMonth(month: number, takenMonths: number[]): { ok: boolean; reason?: string } {
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, reason: L('1~12월 중에서 고르세요.', 'Pick a month from 1 to 12.') };
  if (takenMonths.includes(month)) return { ok: false, reason: L('그 달에는 이미 국가기념일이 있습니다.', 'A national holiday already uses that month.') };
  return { ok: true };
}

/** 초대 판정(29): 은퇴자 50%, 그 외 100%. 행사·인물별로 한 번만(이미 있으면 그대로). */
export function inviteOutcome(season: SocialSeason, who: Attendee, rng: Rng): 'accepted' | 'declined' {
  const had = season.invites[who.pid]; if (had) return had;
  const r = who.retired ? (rng() < SOCIAL.acceptRetired ? 'accepted' : 'declined') : 'accepted';
  season.invites[who.pid] = r; return r;
}
export const attendees = (season: SocialSeason, pool: Attendee[]): Attendee[] => pool.filter((p) => season.invites[p.pid] === 'accepted' && !isPlaceholderPid(p.pid));

/** 교류 확률표(29·38). bias = 성향·관계 보정(퍼센트포인트, 공식 미정이라 0 기본). 품질 보정은 한 번만, 친분이 10% 미만이면 그만큼만 옮긴다. */
export function exchangeTable(quality: 'normal' | 'poor', bias = 0): { good: number; none: number; friction: number } {
  const friction = SOCIAL.exchange.friction;
  let good = Math.max(0, Math.min(100 - friction, SOCIAL.exchange.good + bias));
  let none = 100 - friction - good;
  if (quality === 'poor') { const mv = Math.min(SOCIAL.shortageShift, good); good -= mv; none += mv; }
  return { good, none, friction };
}
export function rollExchange(quality: 'normal' | 'poor', rng: Rng, bias = 0): ExchangeResult {
  const t = exchangeTable(quality, bias), x = rng() * 100;
  return x < t.good ? 'good' : x < t.good + t.none ? 'none' : 'friction';
}

/** 배경 만남 고르기(29·38): 전수 조합 대신 상한까지 서로 다른 쌍. 이미 관계가 있는 쌍을 먼저, 나머지는 무작위. 통치자 불참이면 통치자는 제외. */
export function pickBackgroundPairs(ledger: RelationLedger, people: Attendee[], rulerPid: Pid, rulerAttends: boolean, rng: Rng, max: number = SOCIAL.maxBackgroundPairs): [Pid, Pid][] {
  const ids = people.map((p) => p.pid).filter((p) => rulerAttends || p !== rulerPid);
  const all: [Pid, Pid][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) all.push([ids[i], ids[j]]);
  const known = all.filter(([a, b]) => !!ledger.pairs[pairKey(a, b)]), fresh = all.filter(([a, b]) => !ledger.pairs[pairKey(a, b)]);
  const shuffle = (xs: [Pid, Pid][]) => { for (let i = xs.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [xs[i], xs[k]] = [xs[k], xs[i]]; } return xs; };
  return [...shuffle(known), ...shuffle(fresh)].slice(0, Math.max(0, max));
}

/** 교류 한 건 반영(29): 친분 한 칸 / 변화 없음 / 마찰(경쟁 한 칸 + 최소 원인 갈등 생성, 34). 같은 교류 ID 는 한 번만. */
export function applyExchange(ledger: RelationLedger, season: SocialSeason, ex: Exchange): { conflict?: Conflict } {
  if (season.exchanges.some((e) => e.id === ex.id)) return {};
  season.exchanges.push(ex);
  const r = getPair(ledger, ex.a, ex.b); r.revision++;
  if (ex.result === 'good') {
    if (!r.goodEvents.includes(ex.id)) { r.goodEvents.push(ex.id); r.goodCount++; }
    r.friend = stepStage(FRIEND_STAGES, r.friend, 1); if (r.rival !== 'none') r.rival = stepStage(RIVAL_STAGES, r.rival, -1);
    return {};
  }
  if (ex.result === 'friction') {
    r.rival = stepStage(RIVAL_STAGES, r.rival, 1);
    const c: Conflict = { id: `cf:${ex.id}`, sid: ledger.sid, kind: 'friction', a: ex.a, b: ex.b, createdOn: season.date, createdEventId: season.eventId, cause: { kind: 'disagreement' }, visibility: ex.withRuler ? 'player' : 'parties', reconcileTried: [] };
    if (!ledger.conflicts[c.id]) ledger.conflicts[c.id] = c;
    return { conflict: c };
  }
  return {};
}
// 좋은 교류가 경쟁 단계를 한 칸 내리는 것은 설계 제안(29: 경쟁도 화해 가능). 갈등 해결은 별도(naturalReconcile).

/** 연애 관심 판정(39): 이전 좋은 교류가 3회 이상이고 이번 교류가 좋았을 때 20%. 자격·배우자·갈등·비서·타국 검사는 호출 쪽(eligibleForRomance). 행사당 쌍마다 한 번. */
export function romanceInterestCheck(ledger: RelationLedger, season: SocialSeason, ex: Exchange, a: Attendee, b: Attendee, rng: Rng): boolean {
  if (ex.result !== 'good') return false;
  const r = getPair(ledger, a.pid, b.pid);
  if (r.romance !== 'none' || !eligibleForRomance(a, b)) return false;
  if (r.goodCount - 1 < SOCIAL.romanceInterestAfterGood) return false; // 이번 교류를 빼고 세 번
  if (openConflictsBetween(ledger, a.pid, b.pid).length) return false;
  if (r.evidence.includes(`ri:${season.eventId}`)) return false; // 행사당 한 번
  r.evidence.push(`ri:${season.eventId}`);
  if (rng() >= SOCIAL.romanceInterest) return false;
  r.romance = 'interest'; r.interestEventId = season.eventId; r.revision++;
  return true;
}
export function eligibleForRomance(a: Attendee, b: Attendee): boolean {
  if (a.pid === 'sec' || b.pid === 'sec') return false; // 29: 비서 제외
  if (a.pid.startsWith('f:') || b.pid.startsWith('f:')) return false; // 23: 타국 보류
  return !!a.romanceOk && !!b.romanceOk && !a.partner && !b.partner;
}
/** 교제 전환(39): 상호 관심 뒤 「다음」 행사에서 좋은 교류 시 50%. 같은 행사·같은 쌍 한 번. 갈등 중이면 보류. */
export function datingCheck(ledger: RelationLedger, season: SocialSeason, ex: Exchange, a: Attendee, b: Attendee, rng: Rng): boolean {
  if (ex.result !== 'good') return false;
  const r = getPair(ledger, a.pid, b.pid);
  if (r.romance !== 'interest' || r.interestEventId === season.eventId || !eligibleForRomance(a, b)) return false;
  if (openConflictsBetween(ledger, a.pid, b.pid).length) return false;
  if (r.evidence.includes(`dt:${season.eventId}`)) return false;
  r.evidence.push(`dt:${season.eventId}`);
  if (rng() >= SOCIAL.dating) return false;
  r.romance = 'dating'; r.datingSince = season.date; r.revision++;
  return true;
}

/** 자연 화해(32·37): 당사자가 이 행사에서 실제로 대화했을 때만, 갈등마다 행사당 한 번, 30%. 오늘 생긴 갈등은 제외. */
export function naturalReconcile(ledger: RelationLedger, season: SocialSeason, rng: Rng): Conflict[] {
  if (season.judged.reconcile) return [];
  const talked = new Set(season.exchanges.map((e) => pairKey(e.a, e.b)));
  const done: Conflict[] = [];
  for (const c of Object.values(ledger.conflicts)) {
    if (c.resolved || c.createdEventId === season.eventId || !talked.has(pairKey(c.a, c.b)) || c.reconcileTried.includes(season.eventId)) continue;
    if (!season.rulerAttends && (c.a === season.rulerPid || c.b === season.rulerPid)) continue; // 38: 불참한 통치자의 갈등은 이 행사로 바뀌지 않는다
    c.reconcileTried.push(season.eventId);
    if (rng() < SOCIAL.naturalReconcile) { resolveConflict(ledger, c.id, season.date, 'natural', season.eventId); done.push(c); }
  }
  season.judged.reconcile = true; return done;
}

/** 연간 불만 판정(32·37): 미해결 갈등이 남은 지도자 중 특성이 없고 올해 판정 안 한 사람만 20%. 원인 = 지금 남은 갈등 ID 들. */
export function discontentYearly(ledger: RelationLedger, season: SocialSeason, leaders: Pid[], rng: Rng): Pid[] {
  if (season.judged.discontent) return [];
  const y = String(season.year); const judged = (ledger.discontentJudged[y] ??= []); const granted: Pid[] = [];
  for (const k of Object.keys(ledger.discontentJudged)) if (Number(k) < season.year - 1) delete ledger.discontentJudged[k]; // 지난해 이전 기록은 판정에 안 쓰므로 정리
  const idx = openConflictIndex(ledger);
  for (const p of leaders) {
    if (p === season.rulerPid) continue; // 통치자 본인에게는 불만 특성을 붙이지 않는다(32: 통치자 효과 미정)
    if (judged.includes(p) || p === 'sec' || p.startsWith('f:')) continue;
    const d = ledger.discontent[p]; if (d && d.game !== 'cleared') continue;
    const open = idx.byPerson.get(p) ?? []; if (!open.length) continue;
    judged.push(p);
    if (rng() < SOCIAL.discontentYearly) { ledger.discontent[p] = { pid: p, since: season.date, causes: open.map((c) => c.id), game: 'pending' }; granted.push(p); }
  }
  season.judged.discontent = true; return granted;
}

/** 약혼 판정(40): 교제 2년 이상·호감 90 이상·둘 사이 갈등 없음 → 연간 20%. 커플당 연 1회. 성공 시 1년 뒤 비공식 예식 예약(비용 없음). */
/** 약혼 확률(40 + 2026-10-24 사용자 확정): 기본 20% + 통치자가 주선한 만남(ar:연도 근거) 1회당 10%p, 최대 +30%p. */
export function engagementChance(r: PairRelation): number {
  const arranged = r.evidence.filter((e) => e.startsWith('ar:')).length;
  return Math.min(1, SOCIAL.engagementYearly + Math.min(SOCIAL.engagementArrangedMax, arranged * SOCIAL.engagementArrangedBonus));
}
export function engagementYearly(ledger: RelationLedger, season: SocialSeason, rng: Rng): PairRelation[] {
  if (season.judged.engagement) return [];
  const out: PairRelation[] = [];
  const oc = openConflictIndex(ledger).byPair; // 최적화: 쌍마다 전체 갈등을 훑지 않는다
  for (const r of Object.values(ledger.pairs)) {
    if (r.romance !== 'dating' || !r.datingSince || r.evidence.includes(`eg:${season.year}`)) continue;
    if (r.a === season.rulerPid || r.b === season.rulerPid) continue; // 통치자 본인의 결혼은 wedding.ts(청혼 흐름)
    const years = ((dayNo(season.date) ?? 0) - (dayNo(r.datingSince) ?? 0)) / 360;
    if (years < SOCIAL.engagementMinYears) continue; // 사용자 확정(2026-10-24): 교제 2년·갈등 없음·연 20% 확률만(호감 수치 조건 없음)
    if (oc.get(r.key)?.length) continue;
    r.evidence.push(`eg:${season.year}`);
    if (rng() < engagementChance(r)) { r.romance = 'engaged'; r.engagedOn = season.date; r.revision++; out.push(r); }
  }
  season.judged.engagement = true; return out;
}
/** 결별 제안(41): 교제·약혼·혼인 중인 NPC 커플 중, 둘 사이 갈등이 2년 이상 미해결인 커플만 연 1회 20%. 제안이 이미 대기 중이면 재판정 없음. 통치자 본인 커플은 제외. */
export function breakupYearly(ledger: RelationLedger, season: SocialSeason, rng: Rng): PairRelation[] {
  if (season.judged.breakup) return [];
  const out: PairRelation[] = [];
  const oc = openConflictIndex(ledger).byPair; // 최적화: 쌍마다 전체 갈등을 훑지 않는다
  for (const r of Object.values(ledger.pairs)) {
    if (!['dating', 'engaged', 'married'].includes(r.romance) || r.breakup || r.evidence.includes(`bk:${season.year}`)) continue;
    if (r.a === season.rulerPid || r.b === season.rulerPid) continue;
    const longOpen = (oc.get(r.key) ?? []).filter((c) => ((dayNo(season.date) ?? 0) - (dayNo(c.createdOn) ?? 0)) / 360 >= SOCIAL.breakupConflictYears);
    if (!longOpen.length) continue; // 짧은 갈등 여러 개를 합산하지 않는다
    r.evidence.push(`bk:${season.year}`);
    if (rng() < SOCIAL.breakupYearly) { r.breakup = { proposedOn: season.date, until: addMonths(season.date, SOCIAL.breakupCoolingMonths), causes: longOpen.map((c) => c.id) }; r.revision++; out.push(r); }
  }
  season.judged.breakup = true; return out;
}
/** 숙려 진행(41): 원인 갈등이 모두 해결되면 철회, 기한이 지나도 미해결이면 결별·이혼 확정(28: 이력 보존). 날짜 갱신 때마다 호출해도 한 번만 처리. */
export function breakupTick(ledger: RelationLedger, r: PairRelation, today: string): 'withdrawn' | 'ended' | 'pending' | 'none' {
  if (!r.breakup) return 'none';
  if (r.breakup.causes.every((id) => !!ledger.conflicts[id]?.resolved)) { delete r.breakup; r.revision++; return 'withdrawn'; }
  if (cmpDate(today, r.breakup.until) < 0) return 'pending';
  if (r.romance === 'ended') { delete r.breakup; return 'none'; } // 다른 경로로 이미 끝남
  r.romance = 'ended'; r.endedOn = today; delete r.breakup; r.revision++; return 'ended';
}
/** NPC 커플 예식일(40): 약혼 + 게임 1년. */
export const npcWeddingDate = (r: PairRelation): string | null => (r.engagedOn ? addYears(r.engagedOn, 1) : null);
export const npcWeddingDue = (r: PairRelation, today: string): boolean => { const d = npcWeddingDate(r); return !!d && r.romance === 'engaged' && cmpDate(today, d) >= 0; };

/** 종료(37): 1 교류 확정(이미 applyExchange 로 반영) → 2 자연 화해 → 3 원인 모두 해결된 불만 해제(resolveConflict 가 clear_pending 으로) → 4 새 불만 20% → 5 공개 가능한 요약. */
export function finishSeason(ledger: RelationLedger, season: SocialSeason, leaders: Pid[], names: Record<Pid, string>, rng: Rng): string[] {
  if (season.stage === 'closed') return season.summary;
  const reconciled = naturalReconcile(ledger, season, rng);
  season.judged.clear = true; // 3 은 resolveConflict 안에서 처리된다
  const granted = discontentYearly(ledger, season, leaders, rng);
  const engaged = engagementYearly(ledger, season, rng);
  const nm = (p: Pid) => names[p] ?? p;
  const lines: string[] = [];
  for (const e of season.exchanges) {
    const r = ledger.pairs[pairKey(e.a, e.b)]; if (!r) continue;
    const vis = r.visibility === 'public' || r.visibility === 'player' || e.withRuler || e.introduced || e.a === season.rulerPid || e.b === season.rulerPid;
    if (!vis) continue;
    if (e.result === 'good') lines.push(L(`${nm(e.a)}와(과) ${nm(e.b)}이(가) 가까워진 듯합니다.`, `${nm(e.a)} and ${nm(e.b)} seem to have grown closer.`));
    else if (e.result === 'friction') lines.push(L(`${nm(e.a)}와(과) ${nm(e.b)} 사이에 마찰이 있었습니다.`, `There was friction between ${nm(e.a)} and ${nm(e.b)}.`));
  }
  for (const c of reconciled) if (c.visibility !== 'hidden' && c.visibility !== 'parties') lines.push(L(`${nm(c.a)}와(과) ${nm(c.b)}이(가) 지난 앙금을 풀었습니다.`, `${nm(c.a)} and ${nm(c.b)} have settled their old grievance.`));
  for (const p of granted) lines.push(L(`${nm(p)}이(가) 인간관계로 마음이 무거워 보입니다.`, `${nm(p)} seems weighed down by personal conflicts.`));
  void engaged; // 40: 약혼은 당사자가 알릴 때(초대장)까지 비공개 — 요약에 넣지 않는다
  season.summary = lines; season.stage = 'closed';
  return lines;
}

/** 월 누락·앱 종료 자동 마무리(38): 플레이어 장면 없이 배경 교류만 판정하고 종료. 이미 확정된 교류는 보존. */
export function autoFinish(ledger: RelationLedger, season: SocialSeason, people: Attendee[], leaders: Pid[], names: Record<Pid, string>, rng: Rng): string[] {
  if (season.stage === 'closed') return season.summary;
  if (season.rulerAttends === null) season.rulerAttends = false;
  const have = new Set(season.exchanges.map((e) => pairKey(e.a, e.b)));
  const pairs = pickBackgroundPairs(ledger, people, season.rulerPid, false, rng).filter(([a, b]) => !have.has(pairKey(a, b)));
  const byPid = new Map(people.map((p) => [p.pid, p]));
  for (const [a, b] of pairs) {
    const ex: Exchange = { id: `${season.eventId}:bg:${pairKey(a, b)}`, a, b, result: rollExchange(season.quality, rng) };
    applyExchange(ledger, season, ex);
    const A = byPid.get(a), B = byPid.get(b);
    if (A && B && !datingCheck(ledger, season, ex, A, B, rng)) romanceInterestCheck(ledger, season, ex, A, B, rng);
  }
  return finishSeason(ledger, season, leaders, names, rng);
}

/** 식량 20 납부 명령(29·38): 모자라면 short 로 기록하고 행사는 「불만족」으로 연다. 같은 행사(eventId)는 한 번만 차감. */
export function socialCostCommand(req: number, sid: string, year: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(year)) throw new Error('사교회 비용 인자가 올바르지 않습니다.');
  const mark = `sllm_soc_paid_${year}`, log = (s: string) => `log = "SLLM:SOCIALPAY/;/req=${req}/;/sid=${sid}/;/year=${year}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { resource_stockpile_compare = { resource = food value < ${SOCIAL.foodCost} } } set_variable = { which = ${mark} value = 2 } ${log('short')} } else = { add_resource = { food = -${SOCIAL.foodCost} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}
