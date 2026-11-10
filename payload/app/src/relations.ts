// 공통 기반(01·07·23·29·31·33): 인물·관계·갈등·사건 장부의 자료형과 순수 규칙. 2026-10-23 Claude 사전 설계.
// 전자(electron)·파일·AI 를 가져오지 않는다. 앱에 붙일 때는 features/*-app.ts 가 저장·IPC·AI 호출을 맡는다.
//
// 인물 키(pid) — 앱의 기존 식별자를 그대로 쓴다. 이름으로 합치지 않는다(01).
//   'p:<lid>'   모드가 준 지도자 번호(sllm_lid, 함대 사령부·연락처와 같은 번호). 은퇴한 뒤에도 같은 키.
//   'sec'       비서(통치자마다 마음이 따로라 관계 레코드는 통치자 pid 와 짝).
//   'ruler:<이름>'  아직 번호를 못 받은 통치자 자리표시(secretary-app 의 isPlaceholder 와 같은 규칙) — 관계 장부에는 넣지 않는다.
//   'f:<idx>:<이름>' 다른 제국 인물(07). idx = 그 제국의 sllm_idx. 이름이 바뀌면 aliases 로 잇는다.
// 세이브(sid) 마다 장부를 따로 둔다(앱의 다른 저장 파일과 같은 규칙).

export type Pid = string;
export const isPlaceholderPid = (p: Pid): boolean => !p || p.startsWith('ruler:');
export const leaderPid = (lid: number): Pid => `p:${lid}`;
export const foreignPid = (idx: number, name: string): Pid => `f:${idx}:${String(name).replace(/\s+/g, ' ').trim()}`;
/** 두 인물의 쌍 키(순서 무관). */
export const pairKey = (a: Pid, b: Pid): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** 근거 출처(01): 게임이 확인한 사실 / 앱에서 끝난 상호작용 / 플레이어가 정함 / 생성된 RP. */
export type Provenance = 'game' | 'app' | 'player' | 'rp';
/** 공개 범위(01): 모두 / 플레이어만 / 당사자만 / 비공개. */
export type Visibility = 'public' | 'player' | 'parties' | 'hidden';

/** 친분 단계(29): 반복 교류로 한 칸씩만 오른다. */
export const FRIEND_STAGES = ['stranger', 'acquainted', 'friendly', 'close'] as const;
export type FriendStage = typeof FRIEND_STAGES[number];
/** 경쟁 단계(29): 마찰이 쌓이면 오르고 화해하면 내린다. */
export const RIVAL_STAGES = ['none', 'tense', 'rival'] as const;
export type RivalStage = typeof RIVAL_STAGES[number];
/** 연애 단계(23·39·40): interest(상호 관심) → dating → engaged → married; ended 는 이별·이혼·사별 뒤. */
export const ROMANCE_STAGES = ['none', 'interest', 'dating', 'engaged', 'married', 'ended'] as const;
export type RomanceStage = typeof ROMANCE_STAGES[number];

/** 두 사람의 관계 레코드(쌍마다 하나). 방향이 있는 값(신뢰·호감)은 from→to 로 따로 둔다(01). */
export interface PairRelation {
  key: string; a: Pid; b: Pid;
  friend: FriendStage; rival: RivalStage; romance: RomanceStage;
  /** 좋은 교류 누적(39: 세 번 이상이면 연애 관심 후보). 같은 사건은 한 번만 센다 → goodEvents 로 중복 방지. */
  goodCount: number; goodEvents: string[];
  /** 연애 관심이 생긴 사교회 ID(39: 그 행사에서는 교제 판정을 하지 않는다). */
  interestEventId?: string;
  /** 교제 시작·약혼·혼인 게임 날짜(40). */
  datingSince?: string; engagedOn?: string; marriedOn?: string; endedOn?: string;
  /** 결별 제안 대기(41): 제안일·숙려 종료일·원인 갈등. 원인이 모두 해결되면 철회. */
  breakup?: { proposedOn: string; until: string; causes: string[] };
  /** NPC 커플의 관계 호감도(40: 90 이상이 약혼 조건). 저장 구조는 집컴 확인 — 없으면 undefined(미확인, 약혼 판정 안 함). */
  affection?: number;
  /** 방향 값. 키 = from pid. 수치 범위는 앱의 기존 신뢰(0~100)와 맞춘다. */
  trust: Record<Pid, number>;
  visibility: Visibility; revision: number;
  /** 근거 사건 ID 들. */
  evidence: string[];
}

export function newPair(a: Pid, b: Pid): PairRelation {
  return { key: pairKey(a, b), a: a < b ? a : b, b: a < b ? b : a, friend: 'stranger', rival: 'none', romance: 'none', goodCount: 0, goodEvents: [], trust: {}, visibility: 'hidden', revision: 0, evidence: [] };
}
export function getPair(ledger: RelationLedger, a: Pid, b: Pid): PairRelation {
  const k = pairKey(a, b); let r = ledger.pairs[k]; if (!r) { r = newPair(a, b); ledger.pairs[k] = r; } return r;
}
/** 한 단계만 올리기/내리기(29: 한 번에 친구·연인이 되지 않는다). */
export function stepStage<T extends readonly string[]>(stages: T, cur: T[number], dir: 1 | -1): T[number] {
  const i = stages.indexOf(cur); const j = Math.max(0, Math.min(stages.length - 1, i + dir)); return stages[j];
}

/** 갈등(32·34·35·36). 사연(story)은 요청 때만 AI 가 채운다(34). */
export type ConflictKind = 'friction' | 'policy' | 'credit';
export interface Conflict {
  id: string; sid: string; kind: ConflictKind;
  /** 당사자. policy(36)는 결정자(통치자)에 대한 불만이면 b = 통치자 pid. */
  a: Pid; b: Pid;
  createdOn: string; createdEventId?: string;
  /** 최소 원인 분류(34): friction = 'rude' | 'disagreement' …, policy = 요청 ID 두 개, credit = 기여 사건·인정 사건. */
  cause: Record<string, string>;
  resolved?: { on: string; how: 'natural' | 'mediation' | 'request' | 'recognition' | 'alt_support' | 'explanation'; eventId?: string };
  story?: { text: string; lang: string; on: string };
  visibility: Visibility;
  /** 행사별 자연 화해 판정을 했는지(32: 갈등마다 행사당 한 번). */
  reconcileTried: string[];
}
export const isOpenConflict = (c: Conflict): boolean => !c.resolved;

/** 인간관계 불만 특성(32): 지도자당 하나, 원인 갈등이 모두 해결되면 해제. 게임 적용 상태는 따로. */
export interface Discontent {
  pid: Pid; since: string; causes: string[];
  game: 'pending' | 'applied' | 'unknown' | 'unsupported' | 'clear_pending' | 'cleared';
  reqId?: string;
}

export interface RelationLedger {
  sid: string;
  pairs: Record<string, PairRelation>;
  conflicts: Record<string, Conflict>;
  discontent: Record<Pid, Discontent>;
  /** 연도별 불만 판정을 마친 인물(32: 지도자별 연간 한 번). 키 = `${year}` → pid[] */
  discontentJudged: Record<string, Pid[]>;
  /** 플레이어가 아는 관계·갈등 ID(33: 아는 것만 표시). */
  playerKnows: { pairs: string[]; conflicts: string[] };
}
export const emptyLedger = (sid: string): RelationLedger => ({ sid, pairs: {}, conflicts: {}, discontent: {}, discontentJudged: {}, playerKnows: { pairs: [], conflicts: [] } });

/** 플레이어에게 보여도 되는가(33): 공개이거나 플레이어가 알게 된 것만. 숨긴 관계는 빈 칸·아이콘으로도 드러내지 않는다. */
export function pairVisibleToPlayer(ledger: RelationLedger, r: PairRelation, rulerPid: Pid): boolean {
  if (r.a === rulerPid || r.b === rulerPid) return true; // 통치자 본인이 당사자
  return r.visibility === 'public' || r.visibility === 'player' || ledger.playerKnows.pairs.includes(r.key);
}
export function conflictVisibleToPlayer(ledger: RelationLedger, c: Conflict, rulerPid: Pid): boolean {
  if (c.a === rulerPid || c.b === rulerPid) return true;
  return c.visibility === 'public' || c.visibility === 'player' || ledger.playerKnows.conflicts.includes(c.id);
}
/** 어떤 인물이 아는 관계만 대화에 넣는다(01·31): 당사자이거나 공개된 것. */
export function pairKnownBy(r: PairRelation, who: Pid): boolean { return r.a === who || r.b === who || r.visibility === 'public'; }

/** 두 사람 사이 미해결 갈등(39·40: 있으면 교제·약혼 보류). */
export function openConflictsBetween(ledger: RelationLedger, a: Pid, b: Pid): Conflict[] {
  const k = pairKey(a, b);
  return Object.values(ledger.conflicts).filter((c) => isOpenConflict(c) && pairKey(c.a, c.b) === k);
}
/** 미해결 갈등 색인(최적화): 한 번 훑어 쌍별·인물별로 묶는다. 연간 판정처럼 쌍을 많이 도는 곳에서 쌍마다 전체 갈등을 다시 훑지 않게.
 *  해결된 갈등은 기록으로 계속 쌓이므로 캠페인이 길수록 차이가 커진다. 판정 도중 갈등이 해결되면 색인을 다시 만들 것. */
export function openConflictIndex(ledger: RelationLedger): { byPair: Map<string, Conflict[]>; byPerson: Map<Pid, Conflict[]> } {
  const byPair = new Map<string, Conflict[]>(), byPerson = new Map<Pid, Conflict[]>();
  const add = <K>(m: Map<K, Conflict[]>, k: K, c: Conflict) => { const a = m.get(k); if (a) a.push(c); else m.set(k, [c]); };
  for (const c of Object.values(ledger.conflicts)) if (!c.resolved) { add(byPair, pairKey(c.a, c.b), c); add(byPerson, c.a, c); if (c.b !== c.a) add(byPerson, c.b, c); }
  return { byPair, byPerson };
}
export function openConflictsOf(ledger: RelationLedger, p: Pid): Conflict[] {
  return Object.values(ledger.conflicts).filter((c) => isOpenConflict(c) && (c.a === p || c.b === p));
}

/** 갈등 해결(32): 원인이 된 갈등을 해결 상태로 두고, 그 갈등을 원인으로 가진 불만 특성의 원인이 모두 해결됐으면 해제 대기로. 같은 갈등을 두 번 해결하지 않는다. */
export function resolveConflict(ledger: RelationLedger, id: string, on: string, how: NonNullable<Conflict['resolved']>['how'], eventId?: string): { changed: boolean; discontentCleared: Pid[] } {
  const c = ledger.conflicts[id]; if (!c || c.resolved) return { changed: false, discontentCleared: [] };
  c.resolved = { on, how, ...(eventId ? { eventId } : {}) };
  const cleared: Pid[] = [];
  for (const d of Object.values(ledger.discontent)) {
    if (!d.causes.includes(id) || d.game === 'cleared' || d.game === 'clear_pending') continue;
    if (d.causes.every((cid) => !!ledger.conflicts[cid]?.resolved)) { d.game = 'clear_pending'; cleared.push(d.pid); }
  }
  return { changed: true, discontentCleared: cleared };
}
