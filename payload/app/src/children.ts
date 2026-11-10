// 통치자의 아이(육아, 2026-10-27 사용자 확정 — docs/CHILDREN_DESIGN_KO.md)의 순수 규칙.
// 앱: src/features/children-app.ts(저장·월간 판정·IPC), 화면: ui/nursery.js(개인실 → 아기방).
// 확정: 통치자 부부만 · 비서 배우자 아이 없음 · 해마다 3%(그해 배우자 대화에서 친밀함을 묘사하면 30%, 배우자마다 해마다 한 번) ·
//   배우자마다 2명 · 통치자 한 명당 모두 합쳐 8명(성인이 된 아이도 셈) · 게임 시간 18년 뒤 18세로 바로 우리 지도자(create_leader) ·
//   양육 사건 6번(아기 1·어린이 3·청소년 2) + 「부모를 잃음」 · 사건 답 기한 1년 · 청소년 대화 해마다 4번 · 세습 정부 「후계자로 세우기」(set_heir).
// 게임 효과는 성인식 전까지 없다. 수위 지시는 넣지 않는다(플레이어 책임).
import { gameText } from './game-text';
import { addMonths, addYears, cmpDate, dayNo } from './gamedate';
import { type Wish, type CivLife, WISHES, WISH_NAME, jobOf } from './children-civ';

export const CHILDREN = {
  baseChance: 0.03, intimateChance: 0.3,
  perSpouse: 2, total: 8,
  pregnancyMonths: 9, adultAge: 18,
  eventDeadlineYears: 1, teenTalksPerYear: 4,
  babyUntil: 3, childUntil: 12,
} as const;

export type Axis = 'official' | 'scientist' | 'commander';
export const AXES: Axis[] = ['official', 'scientist', 'commander'];
export type Stage = 'expecting' | 'baby' | 'child' | 'teen' | 'adult';
/** 성향 꼬리표 → 성인식 특성(세 직업 모두 가질 수 있는 바닐라 1레벨 특성, 4.x common/traits 00_generic_leader_traits.txt 확인). */
export type Tag = 'bold' | 'curious' | 'tough' | 'social' | 'stubborn' | 'gloomy' | 'lonely';
export const TAG_TRAIT: Record<Tag, string> = {
  bold: 'leader_trait_eager', curious: 'leader_trait_adaptable', tough: 'leader_trait_resilient', social: 'leader_trait_politician',
  stubborn: 'leader_trait_stubborn', gloomy: 'leader_trait_melancholic', lonely: 'leader_trait_reclusive',
};
/** 직업에 맞는 두 번째 특성(바닐라 1레벨, DLC 없이 쓰는 것만). */
export const CLASS_TRAITS: Record<Axis, string[]> = {
  commander: ['leader_trait_aggressive', 'leader_trait_cautious', 'leader_trait_unyielding', 'leader_trait_trickster', 'leader_trait_skirmisher', 'leader_trait_engineer'],
  official: ['leader_trait_bureaucrat', 'leader_trait_righteous', 'leader_trait_shipwright'],
  scientist: ['leader_trait_carefree', 'leader_trait_roamer', 'leader_trait_archaeologist', 'leader_trait_meticulous'],
};

export interface ChildChoice { ko: string; en: string; axis: Axis; pts: number; tag: Tag }
export interface ChildEventDef { id: string; age: number; titleKo: string; titleEn: string; ko: string; en: string; choices: ChildChoice[] }
/** 양육 사건(틀 문장). {child} 아이 이름, {parent} 배우자, {ruler} 통치자, {lost} 잃은 부모. */
export const CHILD_EVENTS: ChildEventDef[] = [
  { id: 'steps', age: 1, titleKo: '첫걸음', titleEn: 'First steps',
    ko: '{child}이(가) 처음으로 걸음을 뗐습니다. 비틀거리며 향한 곳은—', en: '{child} took their first steps today. Wobbling, they headed straight for—',
    choices: [
      { ko: '창가에 걸린 별 지도', en: 'The star chart by the window', axis: 'scientist', pts: 2, tag: 'curious' },
      { ko: '경비대장의 반짝이는 훈장', en: 'The guard captain’s shining medals', axis: 'commander', pts: 2, tag: 'bold' },
      { ko: '서류를 든 비서관의 품', en: 'The arms of a clerk carrying papers', axis: 'official', pts: 2, tag: 'social' },
    ] },
  { id: 'quarrel', age: 4, titleKo: '궁 안의 다툼', titleEn: 'A palace quarrel',
    ko: '{child}이(가) 궁정 아이들과 놀다 크게 다퉜습니다. {parent}이(가) 어떻게 하면 좋을지 묻습니다.', en: '{child} got into a big fight while playing with the palace children. {parent} asks what to do.',
    choices: [
      { ko: '스스로 화해하게 둔다', en: 'Let them make up on their own', axis: 'official', pts: 1, tag: 'social' },
      { ko: '지지 말라고 가르친다', en: 'Teach them never to back down', axis: 'commander', pts: 2, tag: 'stubborn' },
      { ko: '왜 다퉜는지 함께 따져 본다', en: 'Work out together why it happened', axis: 'scientist', pts: 1, tag: 'curious' },
    ] },
  { id: 'tutor', age: 7, titleKo: '가정교사', titleEn: 'A tutor',
    ko: '{child}에게 가정교사를 붙일 때가 되었습니다. 세 사람이 추천되었습니다.', en: 'It is time to find {child} a tutor. Three names have been put forward.',
    choices: [
      { ko: '퇴역한 노제독', en: 'A retired old admiral', axis: 'commander', pts: 2, tag: 'tough' },
      { ko: '늙은 천문학자', en: 'An aging astronomer', axis: 'scientist', pts: 2, tag: 'curious' },
      { ko: '원로 행정관', en: 'A senior administrator', axis: 'official', pts: 2, tag: 'social' },
    ] },
  { id: 'night', age: 10, titleKo: '몰래 나간 밤', titleEn: 'The night out',
    ko: '{child}이(가) 경호원 몰래 궁 밖에 나갔다가 새벽에야 돌아왔습니다.', en: '{child} slipped out past the guards and only came back at dawn.',
    choices: [
      { ko: '엄하게 벌한다', en: 'Punish them firmly', axis: 'official', pts: 1, tag: 'stubborn' },
      { ko: '밖에서 무엇을 봤는지 묻는다', en: 'Ask what they saw out there', axis: 'scientist', pts: 1, tag: 'curious' },
      { ko: '다음엔 경호원과 가라고 허락한다', en: 'Allow it next time, with a guard', axis: 'commander', pts: 1, tag: 'bold' },
    ] },
  { id: 'debut', age: 13, titleKo: '첫 공식 행사', titleEn: 'First public appearance',
    ko: '{child}이(가) 처음으로 국가 행사에 나섭니다. {ruler}의 아이로서 무엇을 맡길까요?', en: '{child} is to appear at a state event for the first time. As {ruler}’s child, what should they do?',
    choices: [
      { ko: '짧은 연설을 맡긴다', en: 'Give a short speech', axis: 'official', pts: 2, tag: 'social' },
      { ko: '함대 사열에 데려간다', en: 'Join the fleet review', axis: 'commander', pts: 2, tag: 'tough' },
      { ko: '원하지 않으면 쉬게 둔다', en: 'Let them sit it out if they wish', axis: 'scientist', pts: 1, tag: 'lonely' },
    ] },
  { id: 'path', age: 16, titleKo: '진로', titleEn: 'The path ahead',
    ko: '{child}이(가) 앞으로 어디서 배울지 정할 때입니다.', en: 'It is time for {child} to choose where to study next.',
    choices: [
      { ko: '사관학교', en: 'The military academy', axis: 'commander', pts: 2, tag: 'bold' },
      { ko: '학술원', en: 'The science academy', axis: 'scientist', pts: 2, tag: 'curious' },
      { ko: '국정 수습', en: 'An apprenticeship in government', axis: 'official', pts: 2, tag: 'social' },
    ] },
];
export const LOSS_EVENT: ChildEventDef = { id: 'loss', age: 0, titleKo: '부모를 잃다', titleEn: 'A parent lost',
  ko: '{lost}이(가) 세상을 떠났습니다. {child}은(는) 며칠째 말이 없습니다.', en: '{lost} has died. {child} has not spoken for days.',
  choices: [
    { ko: '곁에 오래 있어 준다', en: 'Stay by their side', axis: 'official', pts: 1, tag: 'social' },
    { ko: '할 일로 슬픔을 견디게 한다', en: 'Help them carry it through work', axis: 'commander', pts: 1, tag: 'tough' },
    { ko: '혼자 추스를 시간을 준다', en: 'Give them time alone', axis: 'scientist', pts: 1, tag: 'gloomy' },
  ] };
export const eventDef = (id: string): ChildEventDef | null => (id === 'loss' ? LOSS_EVENT : CHILD_EVENTS.find((e) => e.id === id) ?? null);

export interface ChildLog { date: string; ko: string; en: string }
export interface Child {
  id: string; name: string; gender: 'm' | 'f';
  ruler: string; rulerName: string; parent: string; parentName: string;
  conceived: string; due: string; born?: string;
  score: Record<Axis, number>; tags: Tag[];
  done: string[]; pending?: { id: string; offered: string; until: string } | null;
  lossFor?: string[]; lossQueue?: string[];
  talks?: { year: number; n: number };
  log: ChildLog[];
  /** 성인식: pending = 게임에 보낼 차례, applied = 지도자가 됨. */
  adult?: { state: 'pending' | 'applied' | 'failed'; on: string; cls?: Axis; traits?: string[]; side?: 'female' | 'male'; lid?: number; heir?: boolean; heirWanted?: boolean };
  /** 그림 계열(gameState 종족 계열, 성인식 전 아이 그림 고르기) */
  art?: string;
  /** 플레이어가 고른 공부(2026-10-27 사용자: 「어떤 공부를 시키겠습니까?」) — 있으면 성인식 직업이 이것. 없으면 양육 사건 점수로 자동. */
  study?: Axis;
  /** 성인이 된 뒤 세상을 떠난 날(가족의 죽음 반응, 2026-10-27) */
  dead?: string;
  // ---- 민간인 경로(2026-10-28): 희망 · 성인 갈림길 · 민간인 삶 · 별표 · 청소년 대화 수 · 서운함
  wish?: Wish;
  /** 성인 갈림길: 18세가 되어 플레이어의 결정을 기다림(지도자 / 민간인) */
  cross?: { on: string } | null;
  civ?: CivLife;
  star?: boolean;
  /** 아이와 나눈 대화 수(플레이어가 한 마디라도 한 대화) — 민간인 사건의 좋은 일 몫 보너스 */
  talkN?: number;
  /** 희망을 거스른 횟수(이야기 효과: 서운함) */
  upset?: number;
  /** 정략결혼(2026-10-28 정치): 배우자 표시 「이름 (제국)」. 민간인이면 civ.married 도 같이 */
  wed?: string;
  /** 부모(통치자)와의 정(2026-10-30 사용자: 자식에게 선물하면 관계가 조금 더 돈독해짐). 0~100, 없으면 BOND.start. */
  bond?: number;
  /** 선물 기록(같은 날 같은 물건은 반만) */
  gifts?: Array<{ id: string; on: string }>;
}
/** 부모와의 정: 선물로 오름. 대화 말투(따뜻함)와 서운함 풀기에 쓴다(게임 효과 없음). */
export const BOND = { start: 50, max: 100, warm: 75, cold: 30 } as const;
export const bondOf = (c: Child): number => Math.max(0, Math.min(BOND.max, Number.isFinite(c.bond) ? Number(c.bond) : BOND.start));
export const bondName = (n: number): [string, string] => (n >= 90 ? ['아주 각별함', 'Devoted'] : n >= BOND.warm ? ['돈독함', 'Close'] : n > BOND.cold ? ['보통', 'Ordinary'] : ['서먹함', 'Distant']);
/** 선물을 받은 아이: 정 +delta, 처음 「돈독함」에 닿으면 서운함 하나가 풀림. */
export function receiveGift(c: Child, giftId: string, delta: number, today: string, ko: string, en: string): { bond: number; eased: boolean } {
  const was = bondOf(c), now = Math.min(BOND.max, was + Math.max(0, delta)); c.bond = now;
  c.gifts = [...(c.gifts ?? []), { id: giftId, on: today }].slice(-60);
  c.log.push({ date: today, ko: `부모에게 ${ko}을(를) 선물받았다`, en: `Received ${en} as a gift from their parent` });
  let eased = false; if ((c.upset ?? 0) > 0 && was < BOND.warm && now >= BOND.warm) { c.upset = (c.upset ?? 1) - 1; eased = true; c.log.push({ date: today, ko: '선물을 받고 서운함이 조금 풀렸다', en: 'The gift eased some old hurt' }); }
  return { bond: now, eased };
}
const bondPrompt = (c: Child): string => { const b = bondOf(c); return b >= BOND.warm ? '[Your bond with your parent] You feel close to and loved by your parent; their recent gifts and attention warmed you.' : b <= BOND.cold ? '[Your bond with your parent] You feel a little distant from your parent.' : ''; };
/** 가족을 잃은 슬픔(2026-10-27 사용자 확정: NPC 사별 특성처럼) — 지도자에게 직업 효과 −10% 특성, GRIEF_YEARS 뒤 앱이 뗀다. */
export interface GriefMark { id: string; lid: number; cls: Axis; lost: string; kind: 'child' | 'parent'; on: string; until: string; state: 'pending' | 'applied' | 'done' }
export interface ChildrenBook { sid: string; children: Child[]; rolled: number; intimate: Record<string, number>; griefs: GriefMark[]; /** 민간인 삶 사건을 굴린 해(2026-10-28) */ civYear?: number }
export const emptyBook = (sid: string): ChildrenBook => ({ sid, children: [], rolled: 0, intimate: {}, griefs: [] });
/** 가족 특성(2026-10-27 사용자 확정): 성인이 된 통치자의 아이 = 「통치자의 자녀」(지도자 경험치 +15%), 가족을 잃으면 「가족을 잃은 슬픔」(직업 효과 −10%, 3년). 모드: common/traits/sllm_family_traits.txt */
export const RULER_CHILD_TRAIT = 'sllm_trait_ruler_child';
export const FAMILY_GRIEF_TRAIT: Record<Axis, string> = { commander: 'sllm_trait_family_grief_commander', official: 'sllm_trait_family_grief_official', scientist: 'sllm_trait_family_grief_scientist' };
export const GRIEF_YEARS = 3;

export const yearOf = (d: string): number => Number(/^(\d+)\./.exec(d || '')?.[1] ?? NaN);
export function ageOf(c: Child, today: string): number {
  if (!c.born) return -1; const a = dayNo(c.born), b = dayNo(today);
  return a === null || b === null ? 0 : Math.max(0, Math.floor((b - a) / 360));
}
export function stageOf(c: Child, today: string): Stage {
  if (c.adult) return 'adult'; if (!c.born) return 'expecting';
  const a = ageOf(c, today); return a < CHILDREN.babyUntil ? 'baby' : a < CHILDREN.childUntil ? 'child' : a < CHILDREN.adultAge ? 'teen' : 'adult';
}
/** 상한: 배우자마다 2명, 통치자 한 명당 모두 합쳐 8명(성인이 된 아이·임신 중인 아이 모두 셈). */
/** 설정 「아이 수 제한 풀기」(2026-10-27): 켜면 배우자마다 2명·모두 8명 상한을 두지 않는다. 앱이 설정에서 읽어 넣는다. */
export const childLimit = { off: false };
export function canHaveMore(b: ChildrenBook, ruler: string, spouse: string): boolean {
  if (childLimit.off) return true;
  const mine = b.children.filter((c) => c.ruler === ruler);
  return mine.length < CHILDREN.total && mine.filter((c) => c.parent === spouse).length < CHILDREN.perSpouse;
}
export const chanceFor = (b: ChildrenBook, spouse: string, year: number): number => (b.intimate[spouse] === year ? CHILDREN.intimateChance : CHILDREN.baseChance);

export interface Spouse { pid: string; name: string }
/** 해가 바뀐 첫 월간 상황에서: 지난해(year)의 판정. 생긴 아이(임신)를 돌려준다. 판정한 해의 묘사 표시는 지운다. */
export function rollYear(b: ChildrenBook, year: number, today: string, ruler: { pid: string; name: string }, spouses: Spouse[], rand: () => number, newId: () => string): Child[] {
  const out: Child[] = [];
  for (const s of spouses) {
    if (!canHaveMore(b, ruler.pid, s.pid)) continue;
    const p = chanceFor(b, s.pid, year);
    if (rand() < p) {
      const c: Child = { id: newId(), name: '', gender: rand() < 0.5 ? 'm' : 'f', ruler: ruler.pid, rulerName: ruler.name, parent: s.pid, parentName: s.name,
        conceived: today, due: addMonths(today, CHILDREN.pregnancyMonths), score: { official: 0, scientist: 0, commander: 0 }, tags: [], done: [], pending: null, log: [] };
      b.children.push(c); out.push(c);
    }
  }
  for (const k of Object.keys(b.intimate)) if (b.intimate[k] <= year) delete b.intimate[k];
  b.rolled = year + 1;
  return out;
}
/** 배우자 대화에서 친밀함이 묘사됨 → 그해 표시(같은 해 여러 번이어도 한 번). 바뀌었으면 true. */
export function markIntimate(b: ChildrenBook, spouse: string, year: number): boolean {
  if (!Number.isFinite(year) || b.intimate[spouse] === year) return false; b.intimate[spouse] = year; return true;
}
export const fill = (s: string, v: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

export type Tick = { kind: 'born' | 'event' | 'missed' | 'adult' | 'cross'; child: Child; event?: ChildEventDef };
/** 한 달 진행: 출산 → 놓친 사건 정리 → 부모 잃음 → 새 사건 → 성인식 차례. 바뀐 일 목록. alive: 지금 살아 있는 인물 pid. */
export function monthTick(b: ChildrenBook, today: string, alive: (pid: string) => boolean): Tick[] {
  const out: Tick[] = [];
  for (const c of b.children) {
    if (c.adult || c.civ || c.cross) continue;
    if (!c.born) { if (cmpDate(today, c.due) >= 0) { c.born = c.due; c.log.push({ date: c.due, ko: '태어났다', en: 'Was born' }); out.push({ kind: 'born', child: c }); } else continue; }
    if (c.pending && cmpDate(today, c.pending.until) >= 0) {
      const d = eventDef(c.pending.id); c.done.push(c.pending.id); c.pending = null;
      if (d) { c.log.push({ date: today, ko: `「${d.titleKo}」 — 부모가 바빴다`, en: `“${d.titleEn}” — the parents were too busy` }); out.push({ kind: 'missed', child: c, event: d }); }
    }
    for (const p of [c.ruler, c.parent]) if (!alive(p) && !(c.lossFor ?? []).includes(p)) { (c.lossFor ??= []).push(p); (c.lossQueue ??= []).push(p); }
    const age = ageOf(c, today);
    if (age >= CHILDREN.adultAge) {
      if (c.pending) { const d = eventDef(c.pending.id); c.done.push(c.pending.id); c.pending = null; if (d) c.log.push({ date: today, ko: `「${d.titleKo}」 — 답하지 못한 채 자랐다`, en: `“${d.titleEn}” — grew up before an answer` }); }
      c.lossQueue = [];
      c.cross = { on: today }; out.push({ kind: 'cross', child: c }); continue; // 갈림길(2026-10-28): 지도자 / 민간인은 플레이어가 정한다
    }
    if (c.pending) continue;
    let next: ChildEventDef | null = null;
    if (c.lossQueue?.length) next = LOSS_EVENT;
    else next = CHILD_EVENTS.find((e) => e.age <= age && !c.done.includes(e.id)) ?? null;
    if (next) { c.pending = { id: next.id, offered: today, until: addYears(today, CHILDREN.eventDeadlineYears) }; out.push({ kind: 'event', child: c, event: next }); }
  }
  return out;
}
/** 사건 답: 점수·꼬리표·기록. lostName: 「부모를 잃음」이면 잃은 부모 이름. */
export function answerEvent(c: Child, choice: number, today: string, lostName = ''): { ok: boolean; why?: string } {
  const p = c.pending; if (!p) return { ok: false, why: 'none' };
  const d = eventDef(p.id); const ch = d?.choices[choice]; if (!d || !ch) return { ok: false, why: 'choice' };
  c.score[ch.axis] += ch.pts; c.tags.push(ch.tag); c.pending = null;
  if (d.id === 'loss') c.lossQueue = (c.lossQueue ?? []).slice(1); else c.done.push(d.id);
  const t = d.id === 'loss' ? `${d.titleKo}(${lostName})` : d.titleKo, te = d.id === 'loss' ? `${d.titleEn} (${lostName})` : d.titleEn;
  c.log.push({ date: today, ko: `「${t}」 — ${ch.ko}`, en: `“${te}” — ${ch.en}` });
  return { ok: true };
}
/** 청소년 대화 횟수(게임 해마다 4번). 열 수 있으면 셈을 올리고 true. */
export function takeTalk(c: Child, today: string): boolean {
  const y = yearOf(today); if (!c.talks || c.talks.year !== y) c.talks = { year: y, n: 0 };
  if (c.talks.n >= CHILDREN.teenTalksPerYear) return false; c.talks.n++; return true;
}
/** 대화할 수 있는 나이(2026-10-27 사용자: 영유아는 말을 못 함, 어린이는 짧게라도, 청소년은 그대로). */
export const canTalk = (c: Child, today: string): boolean => { if (c.civ && !c.adult && !c.dead) return true; const st = stageOf(c, today); return st === 'child' || st === 'teen'; }; // 민간인 자녀도 아기방(궁 방문)에서 대화(2026-10-28)
export const talksLeft = (c: Child, today: string): number => { const y = yearOf(today); return CHILDREN.teenTalksPerYear - (c.talks && c.talks.year === y ? c.talks.n : 0); };

const hash = (s: string): number => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
/** 성인식 직업·특성 2개. 직업 = 플레이어가 고른 공부, 없으면 가장 높은 축(같으면 아이 ID 로 정한 순서). 특성 = 가장 많이 나온 꼬리표의 특성 + 직업 특성 하나. */
/** 종족을 따를 부모 ★(2026-10-27 사용자): 엄마 60% · 아빠 40%(아이 ID 로 정해 다시 계산해도 같다). */
export const MOTHER_SPECIES_CHANCE = 0.6;
export type SpeciesSide = 'female' | 'male';
export function adultPlan(c: Child): { cls: Axis; traits: string[]; side: SpeciesSide } {
  const h = hash(c.id); const best = Math.max(...AXES.map((a) => c.score[a]));
  const tied = AXES.filter((a) => c.score[a] === best); const cls = c.study && AXES.includes(c.study) ? c.study : tied[h % tied.length];
  const cnt = new Map<Tag, number>(); for (const t of c.tags) cnt.set(t, (cnt.get(t) ?? 0) + 1);
  let tag: Tag | null = null; for (const t of c.tags) if (!tag || (cnt.get(t) ?? 0) > (cnt.get(tag) ?? 0)) tag = t;
  const first = TAG_TRAIT[tag ?? (['bold', 'curious', 'tough', 'social'] as Tag[])[h % 4]];
  const pool = CLASS_TRAITS[cls]; const second = pool[(h >>> 8) % pool.length];
  const side: SpeciesSide = ((h >>> 16) % 100) < MOTHER_SPECIES_CHANCE * 100 ? 'female' : 'male';
  return { cls, traits: [first, second, RULER_CHILD_TRAIT], side };
}

const okSid = (sid: string) => /^\d{1,12}$/.test(sid);
const cleanMark = (id: string) => id.replace(/[^a-z0-9]/gi, '').slice(0, 24).toLowerCase();
/** 게임 이름 문자열: 따옴표·괄호·게임 서식 기호를 뺀다. */
export const gameNameText = (s: string): string => gameText(s, 60); // 특수 문장부호도 접는다(2026-10-29, game-text.ts)
/** 성인식 명령(콘솔 effect). 엄마(여성 부모 지도자, sllm_lid)의 종족으로 만들고(없으면 다른 부모 → 나라의 주 종족), 같은 아이는 한 번만.
 *  만든 지도자에게 바로 sllm_lid 를 준다(명단 이벤트와 같은 번호 sllm_lid_next). 회신 SLLM:CHILDADULT status=applied|duplicate lid=. */
export function childAdultCommand(req: number, sid: string, c: Child, parentLids: number[], plan: { cls: Axis; traits: string[]; side?: SpeciesSide }): string {
  if (!Number.isInteger(req) || req <= 0 || !okSid(sid) || !AXES.includes(plan.cls) || plan.traits.some((t) => !/^(leader_trait|sllm_trait)_[a-z_]+$/.test(t))) throw new Error('아이 성인식 명령 인자가 올바르지 않습니다.');
  const mark = `sllm_ch_${cleanMark(c.id)}`, name = gameNameText(c.name);
  const log = (s: string, extra = '') => `log = "SLLM:CHILDADULT/;/req=${req}/;/sid=${sid}/;/cid=${cleanMark(c.id)}/;/status=${s}${extra}"`;
  const lids = parentLids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 2);
  const leader = (species: string) => `create_leader = { class = ${plan.cls} species = ${species}${name ? ` name = "${name}"` : ''} gender = ${c.gender === 'f' ? 'female' : 'male'} skill = 1 set_age = 18 traits = { ${plan.traits.map((t) => `0 = ${t}`).join(' ')} } randomize_traits = no effect = { if = { limit = { root = { NOT = { is_variable_set = sllm_lid_next } } } root = { set_variable = { which = sllm_lid_next value = 1 } } } set_variable = { which = sllm_lid value = root.sllm_lid_next } root = { change_variable = { which = sllm_lid_next value = 1 } } ${log('applied', '/;/lid=\\[This.sllm_lid]')} } }`;
  // 종족 ★(2026-10-27 사용자): 엄마(여성 부모) 60% · 아빠(남성 부모) 40%. 그 성별 부모가 없으면(동성 부부·성별 없음) 배우자 → 통치자 순, 둘 다 없으면 나라의 주 종족.
  const findBy = (extra: string) => lids.map((l) => `if = { limit = { check_variable = { which = sllm_ch_sp value = 0 } } every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${l} } ${extra}} species = { save_event_target_as = sllm_ch_species } prev = { set_variable = { which = sllm_ch_sp value = 1 } } } }`).join(' ');
  const find = findBy(`gender = ${plan.side === 'male' ? 'male' : 'female'} `) + ' ' + findBy('');
  const make = `set_variable = { which = sllm_ch_sp value = 0 } ${find} if = { limit = { check_variable = { which = sllm_ch_sp value = 1 } } ${leader('event_target:sllm_ch_species')} } else = { ${leader('owner_main_species')} } clear_variable = sllm_ch_sp`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } ${make} } }`;
}
/** 후계자로 세우기(세습 정부): set_heir. 회신 SLLM:CHILDHEIR status=applied|no_target. */
export function childHeirCommand(req: number, sid: string, lid: number): string {
  if (!Number.isInteger(req) || req <= 0 || !okSid(sid) || !Number.isInteger(lid) || lid <= 0) throw new Error('후계자 명령 인자가 올바르지 않습니다.');
  const log = (s: string) => `log = "SLLM:CHILDHEIR/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_ch_found value = 0 } every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${lid} } } prev = { set_variable = { which = sllm_ch_found value = 1 } set_heir = prev } ${log('applied')} } if = { limit = { check_variable = { which = sllm_ch_found value = 0 } } ${log('no_target')} } clear_variable = sllm_ch_found }`;
}

/** 청소년 대화(LLM): 아이의 말투는 기록·점수·부모에서. JSON {"reply":"..."}. 수위 지시 없음. */
export function teenTalkMessages(c: Child, age: number, lines: { who: 'me' | 'them'; text: string }[], text: string, date: string, lang: 'ko' | 'en'): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const lean = AXES.slice().sort((a, b) => c.score[b] - c.score[a])[0];
  if (c.civ && !c.adult) { // 민간인으로 사는 성인 자녀(2026-10-28)
    const j = jobOf(c.civ.job);
    const sysC = [
      `You are ${c.name || 'the ruler’s child'}, a ${age}-year-old ${c.gender === 'f' ? 'woman' : 'man'}, grown child of the empire's ruler ${c.rulerName} and ${c.parentName}. Date ${date || 'unknown'}.`,
      `You chose to live as a private citizen, not a state leader. You work as a ${j?.en ?? 'civilian'}${c.civ.married ? ` and are married to ${c.civ.married}` : ''}.`,
      `You are visiting the palace and talking with your parent, the ruler (the player).`,
      c.wish ? `[Your childhood dream] ${WISH_NAME[c.wish].en}.` : '',
      c.upset ? 'You were once hurt that your parent did not let you follow the path you wanted; it can show if the subject comes up.' : '',
      bondPrompt(c),
      `[Your life so far] ${c.log.slice(-10).map((l) => `${l.date} ${l.en}`).join('; ') || 'nothing notable yet'}.`,
      'Speak only as this person, naturally. Do not invent game numbers or events. Reply in one to three sentences.',
      `Reply in ${lang === 'ko' ? 'Korean' : 'English'}.`,
      'Output only one JSON: {"reply":"..."}',
    ].filter(Boolean).join('\n');
    const mc: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: sysC }];
    for (const l of lines.slice(-14)) mc.push({ role: l.who === 'me' ? 'user' : 'assistant', content: l.text });
    mc.push({ role: 'user', content: text });
    return mc;
  }
  const sys = [
    `You are ${c.name || 'the ruler’s child'}, a ${age}-year-old ${c.gender === 'f' ? 'girl' : 'boy'}, child of the empire's ruler ${c.rulerName} and ${c.parentName}. Date ${date || 'unknown'}.`,
    age < 12 ? `You are a young child. Talk like a real ${age}-year-old: simple words, short and direct, curious or playful, sometimes changing the subject. Keep every reply to ONE short sentence (two at most).` : '',
    `You are talking with your parent, the ruler (the player), in the nursery of the palace.`,
    `[How you have grown] ${c.log.slice(-10).map((l) => `${l.date} ${l.en}`).join('; ') || 'nothing notable yet'}.`,
    `[Your leaning] you are drawn most to the path of a ${lean} (official = statecraft, scientist = research, commander = the military), but you are still young and unsure.`,
    c.wish ? `[What you dream of becoming] ${WISH_NAME[c.wish].en}. It shows in what you talk about, though a good talk with your parent could change your mind.` : '',
    c.upset ? 'You were once hurt that your parent did not let you follow the path you wanted.' : '',
    bondPrompt(c),
    age < 12 ? 'Speak only as this child. Do not invent game numbers or events.' : 'Speak only as this teenager, naturally for your age. Do not invent game numbers or events. Reply in one to three sentences.',
    `Reply in ${lang === 'ko' ? 'Korean' : 'English'}.`,
    'Output only one JSON: {"reply":"..."}',
  ].filter(Boolean).join('\n');
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: sys }];
  for (const l of lines.slice(-14)) msgs.push({ role: l.who === 'me' ? 'user' : 'assistant', content: l.text });
  msgs.push({ role: 'user', content: text });
  return msgs;
}
/** 대화 끝: 아이가 기억할 한 줄(대화는 성향에 반영하지 않는다 — 2026-10-27 사용자). */
export function teenSummaryMessages(c: Child, lines: { who: 'me' | 'them'; text: string }[], lang: 'ko' | 'en'): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: [
      `Below is a talk between ${c.name}, the ruler's child, and the ruler. Write in one sentence what ${c.name} will remember from it, in ${lang === 'ko' ? 'Korean' : 'English'}.`,
      `Also say what ${c.name} now dreams of becoming. Before the talk it was: ${c.wish ?? 'unknown'}. Keep it unless the talk clearly changed it. One of: ${WISHES.join(', ')}.`,
      'Output only one JSON: {"memory":"...","wish":"..."}',
    ].join('\n') },
    { role: 'user', content: lines.map((l) => (l.who === 'me' ? 'Ruler: ' : c.name + ': ') + l.text).join('\n').slice(-4000) },
  ];
}
export function applyLean(c: Child, lean: unknown): Axis | null { const a = String(lean ?? '') as Axis; if (!AXES.includes(a)) return null; c.score[a] += 1; return a; }
/** 성인식 뒤 그 지도자의 인물 전기(1:1 통신 말투의 재료). */
export function childBio(c: Child, lang: 'ko' | 'en'): string {
  const lines = c.log.slice(-12).map((l) => `${l.date} ${lang === 'ko' ? l.ko : l.en}`).join(' / ');
  return lang === 'ko' ? `통치자 ${c.rulerName}와(과) ${c.parentName}의 아이로 태어나 궁의 아기방에서 자랐다. 자라며 있었던 일: ${lines}`
    : `Born to the ruler ${c.rulerName} and ${c.parentName}, raised in the palace nursery. Growing up: ${lines}`;
}

/** 가족 슬픔 특성 붙이기·떼기(콘솔 effect, sllm_lid 로 대상). 같은 표식은 한 번만. 회신 SLLM:CHILDTRAIT status=applied|duplicate|no_target. */
export function familyTraitCommand(req: number, sid: string, lid: number, add: string[], remove: string[], mark: string): string {
  const okT = (t: string) => /^(leader_trait|sllm_trait)_[a-z_]+$/.test(t);
  if (!Number.isInteger(req) || req <= 0 || !okSid(sid) || !Number.isInteger(lid) || lid <= 0 || !/^[a-z0-9_]{1,40}$/.test(mark) || ![...add, ...remove].every(okT)) throw new Error('가족 특성 명령 인자가 올바르지 않습니다.');
  const mk = `sllm_cht_${mark}`;
  const log = (st: string) => `log = "SLLM:CHILDTRAIT/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/status=${st}"`;
  const act = [...remove.map((t) => `if = { limit = { has_trait = ${t} } remove_trait = ${t} }`), ...add.map((t) => `if = { limit = { NOT = { has_trait = ${t} } } add_trait = ${t} }`)].join(' ');
  const body = `if = { limit = { prev = { is_variable_set = ${mk} } } ${log('duplicate')} } else = { prev = { set_variable = { which = ${mk} value = 1 } } ${act} ${log('applied')} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_cht_found value = 0 } every_owned_leader = { limit = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${lid} } } prev = { set_variable = { which = sllm_cht_found value = 1 } } set_variable = { which = sllm_tr_m value = 12 } ${body} } if = { limit = { check_variable = { which = sllm_cht_found value = 0 } } ${log('no_target')} } clear_variable = sllm_cht_found }`;
}

// ---- 가족관계(2026-10-27 사용자 확정): 아이 장부에서 부모·자녀·형제(이복 포함)를 읽는다. 인물 카드 「가족」 칸·1:1 통신 프롬프트에 쓴다.
export interface FamilyPerson { name: string; pid?: string; stage?: Stage; age?: number; gone?: boolean; half?: boolean; civ?: string }
export interface Family { parents: FamilyPerson[]; children: FamilyPerson[]; siblings: FamilyPerson[] }
/** pid: 'p:<lid>'. nameOf/alive: 인물 장부에서. 아이(성인 지도자)의 pid 는 adult.lid. */
export function familyOf(b: ChildrenBook, pid: string, today: string, alive: (pid: string) => boolean): Family | null {
  const pidOf = (c: Child) => (c.adult?.lid ? `p:${c.adult.lid}` : '');
  const kid = (c: Child): FamilyPerson => ({ name: c.name || '?', ...(pidOf(c) ? { pid: pidOf(c) } : {}), stage: stageOf(c, today), age: ageOf(c, today), gone: !!c.dead, ...(c.civ && !c.adult ? { civ: jobOf(c.civ.job)?.en ?? 'civilian' } : {}) });
  const mine = b.children.filter((c) => c.born && (c.ruler === pid || c.parent === pid));
  const self = b.children.find((c) => pidOf(c) === pid && !!pid);
  const f: Family = { parents: [], children: mine.map(kid), siblings: [] };
  if (self) {
    f.parents = [{ name: self.rulerName, pid: self.ruler, gone: !alive(self.ruler) }, { name: self.parentName, pid: self.parent, gone: !alive(self.parent) }];
    f.siblings = b.children.filter((c) => c !== self && c.born && c.ruler === self.ruler).map((c) => ({ ...kid(c), half: c.parent !== self.parent }));
  }
  return f.parents.length || f.children.length ? f : null;
}
const stageEn: Record<Stage, string> = { expecting: 'unborn', baby: 'infant', child: 'child', teen: 'teenager', adult: 'adult' };
/** 1:1 통신 프롬프트 한 줄(영어). 없으면 ''. */
export function familyLine(f: Family | null): string {
  if (!f) return '';
  const who = (p: FamilyPerson) => `${p.name}${p.gone ? ' (deceased)' : p.stage && p.stage !== 'adult' ? ` (${p.age}, ${stageEn[p.stage]}, raised in the palace nursery)` : p.civ ? ` (grown, lives a civilian life as a ${p.civ})` : p.stage === 'adult' ? ' (grown, now one of the empire\'s leaders)' : ''}${p.half ? ' [half-sibling]' : ''}`;
  const parts: string[] = [];
  if (f.parents.length) parts.push(`You are the child of the ruler ${who(f.parents[0])} and ${who(f.parents[1])}, raised in the palace nursery.`);
  if (f.siblings.length) parts.push(`Your siblings: ${f.siblings.map(who).join(', ')}.`);
  if (f.children.length) parts.push(`Your children: ${f.children.map(who).join(', ')}.`);
  return `[Your family] ${parts.join(' ')} Speak of them as family when it comes up naturally.`;
}
