// 통치자 자녀의 민간인 경로(2026-10-28 사용자 확정 — 1028_집컴_옮기기/육아_민간인경로_설계.md)의 순수 규칙.
// 앱: src/features/children-app.ts, 화면: ui/nursery.js. LLM 은 쓰지 않는다(틀 문장 + 단어 조합). 게임 효과 없음(이야기만).
// 직업 ★: 스텔라리스 4.x common/pop_jobs/02_specialist_jobs.txt 의 전문직(specialist) 계층에서 골랐다(노동자 계층·생산직 대부분 제외).
//   이름은 게임 현지화 그대로(english/korean megacorp_l_*.yml 의 job_<키>, 2026-10-28 집 PC 게임 폴더에서 확인).
import { dayNo } from './gamedate';

/** 아이의 희망(태어날 때 하나, 청소년기 대화로 바뀔 수 있음). */
export type Wish = 'politics' | 'arts' | 'science' | 'commerce' | 'care' | 'adventure';
export const WISHES: Wish[] = ['politics', 'arts', 'science', 'commerce', 'care', 'adventure'];
export const WISH_NAME: Record<Wish, { ko: string; en: string }> = {
  politics: { ko: '나랏일을 하는 사람', en: 'someone who serves the state' },
  arts: { ko: '예술가', en: 'an artist' },
  science: { ko: '학자', en: 'a scholar' },
  commerce: { ko: '장사꾼', en: 'a merchant' },
  care: { ko: '사람을 돌보는 사람', en: 'someone who cares for others' },
  adventure: { ko: '모험가', en: 'an adventurer' },
};

export type JobKey = 'physicist' | 'biologist' | 'engineer' | 'roboticist' | 'bureaucrat' | 'enforcer' | 'entertainer' | 'artisan' | 'culture_worker' | 'trader' | 'healthcare';
export interface JobDef {
  key: JobKey; ko: string; en: string; wish: Wish; lead: 'official' | 'scientist' | 'commander';
  /** 틀 문장 빈칸: 하는 일 · 일터 · 상 이름 · 결과물 */
  work: { ko: string; en: string }; org: { ko: string; en: string }; prize: { ko: string; en: string }; thing: { ko: string[]; en: string[] };
}
/** 게임 공식 명칭(한국어·영어 현지화 job_<키>) 그대로. */
export const JOBS: JobDef[] = [
  { key: 'physicist', ko: '물리학자', en: 'Physicist', wish: 'science', lead: 'scientist',
    work: { ko: '초공간 이론 연구', en: 'research into hyperspace theory' }, org: { ko: '행성 물리 연구소', en: 'the planetary physics institute' }, prize: { ko: '은하 물리학회 공로상', en: 'the Galactic Physics Society Medal' },
    thing: { ko: ['새 입자 붕괴 모형', '아광속 항법 보정식', '중력파 관측 기록'], en: ['a new particle-decay model', 'a sublight navigation correction', 'a gravitational-wave survey'] } },
  { key: 'biologist', ko: '생물학자', en: 'Biologist', wish: 'science', lead: 'scientist',
    work: { ko: '외계 생태 연구', en: 'xeno-ecology research' }, org: { ko: '행성 생명과학원', en: 'the planetary life-sciences academy' }, prize: { ko: '생명과학 우수 연구상', en: 'the Life Sciences Research Prize' },
    thing: { ko: ['새 미생물 계통도', '토착 식물의 내성 유전자', '해양 생태계 지도'], en: ['a new microbial family tree', 'a resilience gene in native flora', 'a map of an ocean ecosystem'] } },
  { key: 'engineer', ko: '공학자', en: 'Engineer', wish: 'science', lead: 'scientist',
    work: { ko: '궤도 구조물 설계', en: 'orbital structure design' }, org: { ko: '행성 공학 설계국', en: 'the planetary engineering bureau' }, prize: { ko: '제국 공학 기술상', en: 'the Imperial Engineering Award' },
    thing: { ko: ['새 궤도 엘리베이터 이음새', '경량 선체 합금 설계', '자동 수리 드론'], en: ['a new orbital-elevator joint', 'a lightweight hull-alloy design', 'a self-repair drone'] } },
  { key: 'roboticist', ko: '로봇 기술자', en: 'Roboticist', wish: 'science', lead: 'scientist',
    work: { ko: '로봇 조립 공정', en: 'robot assembly' }, org: { ko: '로봇 조립 공장', en: 'the robot assembly plant' }, prize: { ko: '로봇공학 혁신상', en: 'the Robotics Innovation Prize' },
    thing: { ko: ['더 섬세한 로봇 손', '조립 공정 자동화 장치', '구조용 소형 로봇'], en: ['a more delicate robot hand', 'an assembly-line automation rig', 'a small rescue robot'] } },
  { key: 'bureaucrat', ko: '관료', en: 'Bureaucrat', wish: 'politics', lead: 'official',
    work: { ko: '행정 업무', en: 'administrative work' }, org: { ko: '행성 행정청', en: 'the planetary administration' }, prize: { ko: '모범 공무원 표창', en: 'a Model Civil Servant commendation' },
    thing: { ko: ['서류 절차 간소화안', '행성 예산 개편안', '민원 처리 지침'], en: ['a plan to simplify paperwork', 'a planetary budget reform', 'new guidelines for public petitions'] } },
  { key: 'enforcer', ko: '집행관', en: 'Enforcer', wish: 'adventure', lead: 'commander',
    work: { ko: '치안 업무', en: 'keeping the peace' }, org: { ko: '행성 치안대', en: 'the planetary enforcement corps' }, prize: { ko: '치안 공로 훈장', en: 'the Public Order Medal' },
    thing: { ko: ['밀수 조직 단속', '항구 순찰 개편', '구조 작전'], en: ['a crackdown on a smuggling ring', 'a new spaceport patrol plan', 'a rescue operation'] } },
  { key: 'entertainer', ko: '연예인', en: 'Entertainer', wish: 'arts', lead: 'official',
    work: { ko: '무대 공연', en: 'stage performances' }, org: { ko: '행성 공연장', en: 'the planetary concert hall' }, prize: { ko: '은하 대중예술상', en: 'the Galactic Popular Arts Award' },
    thing: { ko: ['새 노래', '순회 공연', '홀로 드라마 주연'], en: ['a new song', 'a touring show', 'a lead role in a holo-drama'] } },
  { key: 'artisan', ko: '직공', en: 'Artisan', wish: 'arts', lead: 'official',
    work: { ko: '공방 일', en: 'workshop craft' }, org: { ko: '장인 공방', en: 'a crafts workshop' }, prize: { ko: '장인 공예 대상', en: 'the Master Craft Grand Prize' },
    thing: { ko: ['손으로 짠 직물', '유리 공예품', '정교한 시계'], en: ['a hand-woven textile', 'a piece of glasswork', 'an intricate clock'] } },
  { key: 'culture_worker', ko: '문화 노동자', en: 'Culture Worker', wish: 'arts', lead: 'official',
    work: { ko: '문화 기획', en: 'cultural programming' }, org: { ko: '행성 문화관', en: 'the planetary culture center' }, prize: { ko: '문화 진흥 공로상', en: 'the Cultural Promotion Award' },
    thing: { ko: ['전통 축제 복원', '지역 박물관 전시', '시민 합창단'], en: ['a revived traditional festival', 'a local museum exhibition', 'a citizens’ choir'] } },
  { key: 'trader', ko: '무역상', en: 'Trader', wish: 'commerce', lead: 'official',
    work: { ko: '성간 무역', en: 'interstellar trade' }, org: { ko: '작은 무역 회사', en: 'a small trading company' }, prize: { ko: '올해의 무역인상', en: 'the Trader of the Year award' },
    thing: { ko: ['새 교역로', '외계 향신료 수입', '항구 창고 사업'], en: ['a new trade route', 'an alien spice import line', 'a spaceport warehouse business'] } },
  { key: 'healthcare', ko: '의료 노동자', en: 'Medical Worker', wish: 'care', lead: 'official',
    work: { ko: '진료', en: 'medical care' }, org: { ko: '행성 종합병원', en: 'the planetary general hospital' }, prize: { ko: '의료 봉사상', en: 'the Medical Service Award' },
    thing: { ko: ['외곽 순회 진료', '응급실 개편', '전염병 예방 접종'], en: ['outreach clinics in the outskirts', 'an emergency-room overhaul', 'a vaccination drive'] } },
];
export const jobOf = (k: unknown): JobDef | null => JOBS.find((j) => j.key === k) ?? null;
export const jobsFor = (w: Wish): JobDef[] => JOBS.filter((j) => j.wish === w);

const hash = (s: string): number => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
/** 지도자 직업(부모) → 희망 쪽(태어날 때 35% 로 부모를 닮음). */
const FROM_CLASS: Record<string, Wish> = { official: 'politics', scientist: 'science', commander: 'adventure' };
export function birthWish(rand: () => number, parentClasses: string[]): Wish {
  const cls = parentClasses.filter((c) => FROM_CLASS[c]);
  if (cls.length && rand() < 0.35) return FROM_CLASS[cls[Math.floor(rand() * cls.length)]];
  return WISHES[Math.floor(rand() * WISHES.length)] ?? 'science';
}
/** 저장에 희망이 없던 아이(이전 판): ID 로 정해 늘 같다. */
export const wishFallback = (id: string): Wish => WISHES[hash(id + ':wish') % WISHES.length];
/** 희망에 맞는 기본 직업(아이 ID 로 정해 늘 같다). */
export function defaultJob(id: string, w: Wish): JobKey { const js = jobsFor(w); const all = js.length ? js : JOBS; return all[hash(id + ':job') % all.length].key; }

/** 희망과 길이 맞는가: 지도자(직업 축) 또는 민간인(직업). */
export function fitsWish(w: Wish, path: { leader?: 'official' | 'scientist' | 'commander'; job?: JobKey }): boolean {
  if (path.leader) return (w === 'politics' && path.leader === 'official') || (w === 'science' && path.leader === 'scientist') || (w === 'adventure' && path.leader === 'commander');
  const j = jobOf(path.job); return !!j && j.wish === w;
}
/** 희망이 원래 어느 길인가(갈림길 화면의 안내). */
export const wishPrefersLeader = (w: Wish): boolean => w === 'politics' || w === 'adventure';

// ---- 민간인 삶 사건
export type CivKind = 'promotion' | 'award' | 'business' | 'marriage' | 'discovery' | 'move' | 'hobby' | 'change' | 'setback' | 'gossip';
export const GOOD: CivKind[] = ['promotion', 'award', 'business', 'marriage', 'discovery'];
export const NORMAL: CivKind[] = ['move', 'hobby', 'change'];
export const BAD: CivKind[] = ['setback', 'gossip'];
/** 큰 사건(알림 「큰 사건만」·연간 상한에 셈): 결혼·수상 + 나쁜 일. */
export const isBig = (k: CivKind): boolean => k === 'marriage' || k === 'award' || BAD.includes(k);
export const isSmall = (k: CivKind): boolean => NORMAL.includes(k);
export const CIV = {
  /** 연간 상한: 4명 이하 1건 · 5~12명 2건 · 13명 이상 3건 */
  capFor: (n: number): number => (n <= 0 ? 0 : n <= 4 ? 1 : n <= 12 ? 2 : 3),
  /** 한 차례 발생 확률: 민간인 자녀 수에 따라 완만히(1명 15% · 3명 30% · 8명 이상 40%) */
  chanceFor: (n: number): number => [0, 0.15, 0.22, 0.3, 0.33, 0.35, 0.37, 0.39, 0.4][Math.max(0, Math.min(8, n))],
  starWeight: 3, starForceYears: 5,
  /** 작은 근황(이사·취미 등): 상한과 따로, 민간인마다 해마다 이 확률로 인터넷(트윙클) 글감이 생김 */
  smallChance: 0.3,
  /** 수명: 이 나이부터 해마다 죽을 확률(이야기만) */
  oldAge: 72, deathBase: 0.06, deathStep: 0.02,
};
/** 좋은 일 75 · 평범 20 · 나쁜 5. 청소년기 대화 5회마다 평범 몫 2%p 를 좋은 일로(최대 +10%p). */
export function kindRoll(rand: () => number, talks: number): 'good' | 'normal' | 'bad' {
  const shift = Math.min(10, Math.floor(Math.max(0, talks) / 5) * 2);
  const x = rand() * 100; return x < 75 + shift ? 'good' : x < 95 ? 'normal' : 'bad';
}
export interface CivCand { id: string; star: boolean; yearsQuiet: number }
/** 이번 차례에 사건을 맞을 자녀: 오래 조용했던 아이일수록, 별표는 3배. 별표가 5년 넘게 조용하면 무조건 그 아이. */
export function pickCiv(cands: CivCand[], rand: () => number): string | null {
  if (!cands.length) return null;
  const forced = cands.filter((c) => c.star && c.yearsQuiet >= CIV.starForceYears).sort((a, b) => b.yearsQuiet - a.yearsQuiet)[0];
  if (forced) return forced.id;
  const w = cands.map((c) => (c.yearsQuiet + 1) * (c.star ? CIV.starWeight : 1)); const sum = w.reduce((a, b) => a + b, 0);
  let x = rand() * sum; for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x < 0) return cands[i].id; }
  return cands[cands.length - 1].id;
}
export const yearsBetween = (a: string, b: string): number => { const x = dayNo(a), y = dayNo(b); return x === null || y === null ? 0 : Math.max(0, Math.floor((y - x) / 360)); };

/** 틀 문장(한/영). 빈칸: {name} 아이 · {job} 직업 · {work} 하는 일 · {org} 일터 · {prize} 상 · {thing} 결과물 · {planet} 행성 · {spouse} 배우자 · {hobby} 취미 */
export const CIV_TPL: Record<CivKind, { ko: string[]; en: string[] }> = {
  promotion: {
    ko: ['{name}이(가) {org}에서 팀장으로 승진했다.', '{planet}의 {org}에서 {name}에게 더 큰 일을 맡겼다. 동료들은 「당연한 일」이라고 입을 모았다.', '{job} {name}이(가) 그동안의 {work} 성과를 인정받아 한 직급 올라갔다.', '{name}이(가) {org}의 책임자로 뽑혔다. 첫 출근 날 꽃다발이 쏟아졌다고 한다.'],
    en: ['{name} was promoted to team lead at {org}.', '{org} on {planet} handed {name} a bigger role. Colleagues called it overdue.', '{job} {name} moved up a grade for their work in {work}.', '{name} was chosen to head {org}. Flowers reportedly piled up on the first day.'],
  },
  award: {
    ko: ['{name}이(가) {thing}(으)로 {prize}을(를) 받았다.', '{prize} 시상식에서 {name}의 이름이 불렸다. {planet}에서 축하가 이어졌다.', '{job} {name}이(가) {prize} 수상자로 발표되었다. 통치자 가문의 이름 대신 자기 이름으로 받은 상이라 더 뜻깊다는 평이다.'],
    en: ['{name} received {prize} for {thing}.', 'At the {prize} ceremony, {name}’s name was called. Congratulations poured in across {planet}.', '{job} {name} was announced as a winner of {prize} — earned under their own name, not the family’s, observers noted.'],
  },
  business: {
    ko: ['{name}이(가) {planet}에 차린 {thing} 일이 크게 잘되고 있다.', '{name}의 {thing}이(가) 입소문을 타며 {planet} 곳곳에서 찾는 사람이 늘었다.', '{job} {name}이(가) 맡은 {thing}이(가) 기대 이상의 성과를 냈다.'],
    en: ['The {thing} venture {name} started on {planet} is doing very well.', 'Word of {name}’s {thing} spread, and people all over {planet} are asking for it.', '{job} {name}’s {thing} turned out better than anyone expected.'],
  },
  marriage: {
    ko: ['{name}이(가) {planet}에서 {spouse}와(과) 조촐한 결혼식을 올렸다.', '{name}과(와) {spouse}의 결혼 소식이 전해졌다. 하객은 가까운 친구들뿐이었다고 한다.', '{job} {name}이(가) 오래 만나 온 {spouse}와(과) 부부가 되었다.'],
    en: ['{name} married {spouse} in a small ceremony on {planet}.', 'News came that {name} and {spouse} have married — only close friends attended.', '{job} {name} married {spouse}, their partner of many years.'],
  },
  discovery: {
    ko: ['{name}이(가) {work} 중에 {thing}을(를) 찾아냈다.', '{planet}의 {org}에서 {name}이(가) {thing}을(를) 처음 선보였다.', '{name}의 {thing}이(가) 같은 분야 사람들 사이에서 화제가 되었다.'],
    en: ['During {work}, {name} came up with {thing}.', 'At {org} on {planet}, {name} presented {thing} for the first time.', '{name}’s {thing} has become the talk of the field.'],
  },
  move: {
    ko: ['{planet}(으)로 이사했어요. 창밖 풍경이 아직 낯설지만 좋아요.', '이삿짐 정리 끝! {planet}에서의 첫 밤이에요.', '새 집이 {org} 바로 근처라 출근이 편해졌어요.'],
    en: ['Moved to {planet}. The view outside is still strange, but I like it.', 'Done unpacking! First night on {planet}.', 'The new place is right by {org}, so the commute is easy now.'],
  },
  hobby: {
    ko: ['요즘 {hobby}에 빠졌어요. 생각보다 어렵네요.', '퇴근하고 {hobby} 배우는 중. 선생님이 소질 있대요 😊', '주말마다 {hobby}. 일 생각이 하나도 안 나서 좋아요.'],
    en: ['Lately I’m into {hobby}. Harder than it looks.', 'Learning {hobby} after work. The teacher says I have a knack 😊', '{hobby} every weekend. I don’t think about work at all.'],
  },
  change: {
    ko: ['{org}에서 맡는 일이 조금 바뀌었어요. 요즘은 {thing} 쪽이에요.', '새 동료가 들어왔어요. {work}이(가) 한결 즐거워졌어요.', '오늘 {work} 하다가 작은 실수를 바로잡았어요. 뿌듯한 하루.'],
    en: ['My role at {org} shifted a bit. These days I work on {thing}.', 'A new colleague joined. {work} is a lot more fun now.', 'Caught and fixed a small mistake during {work} today. Good day.'],
  },
  setback: {
    ko: ['{name}이(가) 맡았던 {thing}이(가) 기대에 못 미쳐 미뤄졌다.', '{org}의 {thing} 일이 틀어지며 {name}이(가) 한동안 애를 먹었다.', '{job} {name}의 {thing}이(가) 심사에서 떨어졌다. 본인은 「다시 하면 된다」고 말했다.'],
    en: ['{name}’s {thing} fell short and has been shelved.', 'The {thing} at {org} went wrong, and {name} struggled for a while.', '{job} {name}’s {thing} failed review. “I’ll just do it again,” they said.'],
  },
  gossip: {
    ko: ['{name}이(가) {planet}의 술집에서 언성을 높였다는 구설이 돌았다.', '통치자의 자녀 {name}이(가) 줄을 서지 않았다는 목격담이 퍼져 잠시 입방아에 올랐다.', '{name}이(가) {org} 회의에 늦었다는 소문이 부풀려져 퍼졌다.'],
    en: ['Rumor has it {name} raised their voice at a bar on {planet}.', 'A story that the ruler’s child {name} skipped a queue made the rounds for a while.', 'A rumor that {name} was late to a meeting at {org} spread, exaggerated.'],
  },
};
export const HOBBIES = { ko: ['그림 그리기', '요리', '등산', '천체 관측', '수영', '악기 연주', '정원 가꾸기', '도자기 빚기'], en: ['painting', 'cooking', 'hiking', 'stargazing', 'swimming', 'playing an instrument', 'gardening', 'pottery'] };
const pickOf = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
export const fillCiv = (s: string, v: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
/** 사건 문장 한/영(같은 틀 번호·같은 단어). */
export function civText(kind: CivKind, job: JobDef, vars: { name: string; planet: string; spouse?: string }, r: () => number): { ko: string; en: string } {
  const t = CIV_TPL[kind]; const i = Math.floor(r() * t.ko.length) % t.ko.length; const ti = Math.floor(r() * job.thing.ko.length); const hi = Math.floor(r() * HOBBIES.ko.length);
  const v = (lang: 'ko' | 'en') => ({ name: vars.name, planet: vars.planet || (lang === 'ko' ? '수도' : 'the capital'), spouse: vars.spouse || '', job: job[lang], work: job.work[lang], org: job.org[lang], prize: job.prize[lang], thing: job.thing[lang][ti], hobby: HOBBIES[lang][hi] });
  return { ko: fillCiv(t.ko[i], v('ko')), en: fillCiv(t.en[Math.min(i, t.en.length - 1)], v('en')) };
}
/** 결혼할 차례인가(이미 결혼했으면 결혼 대신 다른 좋은 일). */
export function goodKind(r: () => number, married: boolean): CivKind { const pool = married ? GOOD.filter((k) => k !== 'marriage') : GOOD; return pickOf(r, pool); }
export const smallKind = (r: () => number): CivKind => pickOf(r, NORMAL);
export const badKind = (r: () => number): CivKind => pickOf(r, BAD);
/** 이 해에 늙어 세상을 떠나는가(이야기만). age: 나이(년) */
export const civDies = (age: number, r: () => number): boolean => age >= CIV.oldAge && r() < CIV.deathBase + CIV.deathStep * (age - CIV.oldAge);

/** 민간인 기록 */
export interface CivLife { job: JobKey; on: string; last?: string; married?: string; news?: { ko: string; en: string; date: string } | null; recalled?: boolean }
/** 가족 사건 알림 설정: 모두 / 큰 사건만 / 끄기(신문에만) */
export type FamilyNotify = 'all' | 'big' | 'off';
export const shouldNotify = (mode: FamilyNotify | undefined, kind: CivKind): boolean => (mode === 'off' ? false : mode === 'big' ? isBig(kind) : true);
/** 후계자로 불러들일 때 한 줄(세습 정부). */
export function heirReturnLine(name: string, gender: 'm' | 'f', job: JobDef | null): { ko: string; en: string } {
  const t = gender === 'f' ? { ko: '공주', en: 'Princess' } : { ko: '왕자', en: 'Prince' };
  const org = job ? job.org : { ko: '민간의 삶', en: 'civilian life' };
  return { ko: `${t.ko} ${name}께서 ${org.ko}을(를) 떠나 궁으로 돌아오셨습니다.`, en: `${t.en} ${name} has left ${org.en} and returned to the palace.` };
}
export const quietSince = (c: { last?: string; on: string }, today: string): number => yearsBetween(c.last || c.on, today);
