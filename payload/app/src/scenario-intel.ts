// 회랑 정보국(시나리오 「회랑의 삼파전」 전용 첩보, 순수 규칙, 2026-11-07 사용자: 「바닐라 첩보 말고 이 시나리오만의 첩보」).
// 설계: SLLM_Dev_20261016/docs/SCENARIO_CORRIDOR_ESPIONAGE_DESIGN_20261107_KO.md
//   1단계(공작원·정보 예산·귀족 정보망·정찰 작전) + 2단계(귀족 공작 6종 · 의심도 단계 · 최후통첩, 2026-11-07).
//   카드 방식(2026-11-07, docs/SCENARIO_CORRIDOR_ESPIONAGE_CARDS_DESIGN_20261107_KO.md): 작전은 손패의 카드로 건다. 손패·첩보력은 1년에 한 번 「연례 정보 회의」에서.
// 계산은 전부 앱에서(게임 부담 없음): 매달 섹터 보고가 올 때 한 번(정보망 자람·작전 경과). 게임에는 결과(예산 지출·호감·반란)만 보낸다.
// 영어 문구는 AI 프롬프트·기록용이 아니라 화면용 쌍(L 한/영)으로 앱이 고른다 — 여기 ko/en 쌍은 보고서 저장용(언어 팩: 기록은 기록 당시 언어 규칙과 같음).
import type { NobleRow, NSide } from './scenario-nobles';

import { D, newDuel, fixDuel, DCARDS, DCARD_KEYS, dPrice, type Duel, type DC, type DCard } from './scenario-duel';
export type OpKind = 'identify' | 'loyalty' | 'ties' | 'dirt' | 'sow' | 'bribe' | 'blackmail' | 'frame' | 'incite' | 'assassinate' | 'ins_cook' | 'ins_doctor' | 'ins_driver' | 'ins_mech' | 'ins_butler' | 'ins_secretary' | 'ins_guard' | 'ins_treasurer' | 'ins_lover' | 'ins_priest' | 'ins_journalist' | 'ins_clerk' | 'ins_paparazzo' | 'ins_expat' | 'ins_courier' | 'ins_cleaner' | 'ins_canteen' | 'ins_sleuth' | 'ins_streamer' | 'ins_installer' | 'poison' | 'accident' | 'warplan' | 'tipoff' | 'fakedoc' | 'fleets' | 'summit';
/** 내부자 매수(2026-11-08, docs/SCENARIO_CORRIDOR_INSIDERS_HEALTH_VENUES_DESIGN_20261108_KO.md 2장): 귀족 곁의 사람을 하나씩 산다(직업 11가지, 2026-11-08 사용자: 「제안한 직업들도 다 추가」). */
export type Job = 'cook' | 'doctor' | 'driver' | 'mech' | 'butler' | 'secretary' | 'guard' | 'treasurer' | 'lover' | 'priest' | 'journalist' | 'clerk' | 'paparazzo' | 'expat' | 'courier' | 'cleaner' | 'canteen' | 'sleuth' | 'streamer' | 'installer';
export const JOBS: Job[] = ['cook', 'doctor', 'driver', 'mech', 'butler', 'secretary', 'guard', 'treasurer', 'lover', 'priest', 'journalist', 'clerk', 'paparazzo', 'expat', 'courier', 'cleaner', 'canteen', 'sleuth', 'streamer', 'installer'];
export const JOB_OF: Partial<Record<OpKind, Job>> = { ins_cook: 'cook', ins_doctor: 'doctor', ins_driver: 'driver', ins_mech: 'mech', ins_butler: 'butler', ins_secretary: 'secretary', ins_guard: 'guard', ins_treasurer: 'treasurer', ins_lover: 'lover', ins_priest: 'priest', ins_journalist: 'journalist', ins_clerk: 'clerk', ins_paparazzo: 'paparazzo', ins_expat: 'expat', ins_courier: 'courier', ins_cleaner: 'cleaner', ins_canteen: 'canteen', ins_sleuth: 'sleuth', ins_streamer: 'streamer', ins_installer: 'installer' };
export const JOB_NAME: Record<Job, [string, string]> = { cook: ['요리사', 'Cook'], doctor: ['주치의', 'Physician'], driver: ['운전수', 'Chauffeur'], mech: ['정비사', 'Mechanic'], butler: ['집사', 'Butler'], secretary: ['비서', 'Secretary'], guard: ['경호대장', 'Guard captain'], treasurer: ['회계관', 'Treasurer'], lover: ['정부', 'Lover'], priest: ['고해신부', 'Confessor'], journalist: ['전속 기자', 'Court journalist'] , clerk: ['회사 직원', 'Company clerk'], paparazzo: ['길거리 파파라치', 'Street paparazzo'], expat: ['비자 거주자', 'Visa resident'], courier: ['배달원', 'Courier'], cleaner: ['청소부', 'Cleaner'], canteen: ['사내 식당 요리사', 'Canteen cook'], sleuth: ['인터넷 탐정', 'Internet sleuth'], streamer: ['음모론 스트리머', 'Conspiracy streamer'], installer: ['설치 기사', 'Installer'] };
/** 이중 첩자(2026-11-08): 붙잡힌 공작원 때문에 드러난 내부자는 절반은 쫓겨나고, 나머지 가운데 이만큼은 상대가 몰래 돌려세운다 */
export const DOUBLE = { turn: 0.4, risk: 30 };
const USES: Partial<Record<OpKind, Job[]>> = { poison: ['cook', 'doctor'], accident: ['driver', 'mech'], assassinate: ['guard'] };
/** 이 공작에 쓰는 내부자 가운데 돌아선 사람이 있나 */
export function turnedFor(sv: IntelSave, target: number, kind: OpKind): boolean { const d = sv.dbl?.[String(target)]; return !!d && !!USES[kind]?.some((j) => d.includes(j)); }
/** 정부(연인)(2026-11-08 사용자: 「약혼 관계가 없는 귀족일 때만 — 아니면 약혼 관계인데 연인이면 스캔들로 더 좋은 무기」):
 *  혼약이 없으면 그냥 연인(속마음·충성 흔들기). 혼약한 귀족이면 불륜 — 추문 약점 카드가 생기고 협박 성공 +AFFAIR.blackmail.
 *  불륜이 터지면(그 귀족 섹터에서 공작원이 붙잡히거나, 전속 기자로 터뜨리면) 배우자와 원수가 되고 군주의 눈 밖에 난다. */
/** 강화(+) 카드 효과(2026-11-08): 내부자 매수 성공 +10·발각 −8 · 암살 발각 −10 · 중독 피해 +5 · 사고 생존 확률 절반 */
export const PLUS = { insChance: 10, insRisk: 8, assnRisk: 10, poisonHurt: 5 };
/** 내부자 탐색(2026-11-08): 내부자 카드는 상점에서 팔지 않고 이 카드로만 나온다(+보상 3장에도 안 나옴).
 *  성공하면 직업 무작위 내부자 카드 한 장이 손패에 들어온다 — 비싼 직업(경호원·의사·연인)일수록 드물게. 강화(+)는 반드시 얻는다. */
/** 희귀도(2026-11-08 사용자: 「희귀한 카드들은 카드 모습 다르게」): c 일반 · u 고급 · r 희귀. 카드 테두리·보석 색이 달라진다. */
export type Rarity = 'c' | 'u' | 'r';
export const JOB_RAR: Record<Job, Rarity> = { clerk: 'c', paparazzo: 'c', expat: 'c', courier: 'c', cleaner: 'c', canteen: 'c', sleuth: 'c', streamer: 'c', installer: 'c', journalist: 'u', cook: 'u', driver: 'u', mech: 'u', butler: 'u', priest: 'u', secretary: 'r', treasurer: 'r', doctor: 'r', lover: 'r', guard: 'r' };
/** 탐색 성공 때 등급별 몫(%): 일반 50 · 고급 35 · 희귀 15 — 같은 등급 안에서는 고르게 */
export const SCOUT = { chance: 50, tier: { c: 50, u: 35, r: 15 } as Record<Rarity, number>, w: {} as Record<Job, number> };
for (const j of JOBS) SCOUT.w[j] = SCOUT.tier[JOB_RAR[j]] / JOBS.filter((x) => JOB_RAR[x] === JOB_RAR[j]).length;
/** 일반 내부자(2026-11-08 사용자: 「도움은 크게 안 되는 일반 등급 — 회사 직원·길거리 파파라치·비자 거주자 같은」) */
export const COMMON = { clerkNet: 8, papDirt: 10, expatNet: 3, courierRisk: 3, cleanerWeak: 0.3,
  // 엿들을 수 있는 사람들(2026-11-08 사용자: 「사내 직원식당 요리사 · 인터넷 탐정 · 음모론 스트리머 · 설치기사」)
  canteenTie: 0.35, sleuthLoyal: 0.4, streamerRel: -4, installerRecon: 10 };
export function scoutRoll(plus: boolean, rnd: () => number): CardKind | null {
  if (!plus && rnd() * 100 >= SCOUT.chance) return null;
  const js = Object.keys(SCOUT.w) as Job[], tot = js.reduce((a, j) => a + SCOUT.w[j], 0); let r = rnd() * tot;
  for (const j of js) { r -= SCOUT.w[j]; if (r <= 0) return ('ins_' + j) as CardKind; }
  return ('ins_' + js[js.length - 1]) as CardKind;
}
/** 적 공작 — 방첩 대전(2026-11-08, 슬레이 더 스파이어식 · scenario-duel.ts).
 *  1~3년마다 얼라이언스/제국 귀족 하나가 침투 임무 1~2개를 걸고 우리 보안망을 친다. 대전에서 공작선을 끊으면 승리(임무 무산),
 *  보안망이 무너지면 패배(임무 성공), 10턴을 버티면 무승부(상대 철수, 임무 무산). 이길 때마다 첩보부장 경험(4승부터 자동 대응). */
export type FoeKind = 'hunt' | 'purge' | 'jam' | 'smear' | 'subvert';
export const FOE_KINDS: FoeKind[] = ['hunt', 'purge', 'jam', 'smear', 'subvert'];
export interface FoeOp { k: FoeKind; tgt: number }
export interface Foe { id: number; side: NSide; by: number; start: string; due: number; seen: boolean; ops: FoeOp[]; duel: Duel; press: number }
export type FoeRes = 'win' | 'lose' | 'draw';
export interface FoeLast { d: string; side: NSide; by: number; seen: boolean; res: FoeRes; auto?: number; ops: FoeKind[]; ko: string; en: string; offer?: DCard[] }
export const FOE = {
  gapMin: 365, gapMax: 1095, days: 45,           // 1~3년마다 · 45일 안에 대전(안 하면 첩보부장이 대신)
  weight: { hunt: 3, purge: 3, jam: 2, smear: 1, subvert: 2 } as Record<FoeKind, number>,
  jamNet: 30, purgeN: 2, smearSus: 12, smearHostile: 10, subvertLoyal: -15,
  seeNet: 60, seeJobs: ['secretary', 'butler', 'lover', 'guard'] as Job[],
  icon: { hunt: '\u{1F3AF}', purge: '\u{1F9F9}', jam: '\u{1F4E1}', smear: '\u{1F4E2}', subvert: '\u{1F91D}' } as Record<FoeKind, string>,
};
export function foeSeenBy(sv: IntelSave, by: number): boolean {
  if ((sv.net[String(by)] ?? 0) >= FOE.seeNet) return true;
  const ins = sv.ins?.[String(by)]; return !!ins && FOE.seeJobs.some((j) => ins[j]);
}
/** 우리 방첩 대전 덱(없으면 시작 덱) */
export function duelDeck(sv: IntelSave): DC[] {
  if (!sv.dd || !sv.dd.length) { sv.dd = []; for (const [k, n] of D.start) for (let i = 0; i < n; i++) sv.dd.push({ id: sv.nextId++, k }); }
  return sv.dd;
}
export const shpOf = (sv: IntelSave): number => sv.shp ?? D.hpMax;
/** 매달 보안망 회복(대전 중에는 멈춤) */
export function shpRegen(sv: IntelSave): void { if (!sv.foe) sv.shp = Math.min(D.hpMax, shpOf(sv) + D.regen + (sv.budget >= 2 ? 1 : 0)); }
/** 적 공작 시작. tgtOf: 걸 수 있는 임무 → 표적(null 이면 못 검). press: 그 나라 의심+긴장(0~200). */
export function foeBuild(sv: IntelSave, side: NSide, by: number, today: string, tgtOf: Record<FoeKind, number | null>, press: number, rnd: () => number): Foe | null {
  const ks = (Object.keys(tgtOf) as FoeKind[]).filter((x) => tgtOf[x] !== null); if (!ks.length) return null;
  const n = Math.min(ks.length, 1 + (rnd() < 0.35 + press / 400 ? 1 : 0)), ops: FoeOp[] = [], pool = [...ks];
  for (let i = 0; i < n; i++) { const tot = pool.reduce((a, x) => a + FOE.weight[x], 0); let r = rnd() * tot, k = pool[pool.length - 1]; for (const x of pool) { r -= FOE.weight[x]; if (r <= 0) { k = x; break; } } pool.splice(pool.indexOf(k), 1); ops.push({ k, tgt: tgtOf[k]! }); }
  return { id: sv.nextId++, side, by, start: today, due: dayOf(today) + FOE.days, seen: foeSeenBy(sv, by), ops, press, duel: newDuel(duelDeck(sv), shpOf(sv), side, press, rnd) };
}
/** 첩보부장 기록 */
export const chiefOf = (sv: IntelSave): { w: number; l: number } => (sv.chief ??= { w: 0, l: 0 });
/** 다음 적 공작 날(1~3년 뒤) */
export const foeGap = (now: number, rnd: () => number): number => now + FOE.gapMin + Math.floor(rnd() * (FOE.gapMax - FOE.gapMin + 1));
export const AFFAIR = { blackmail: 15, spouse: -35, ruler: -15, loyal: -8 };
/** 경호대장을 사 두면 암살 성공률이 오른다 */
export const GUARD_EDGE = 20;
/** 고해신부가 있으면 해마다 그 귀족의 충성이 흔들린다 */
export const PRIEST_YEAR = -3;
export type AgentState = 'idle' | 'post' | 'op' | 'lost';
/** 능력치 [잠입, 설득, 위조] 1~5 */
export type IntelSkill = [number, number, number];
export interface Agent { id: number; ko: string; en: string; sk: IntelSkill; xp: number; at: number | null; st: AgentState; since: string }
/** with: 이간질 상대(-1 = 그 귀족의 군주, 아니면 다른 귀족 번호) */
export interface Op { id: number; kind: OpKind; target: number; agent: number; start: string; days: number; chance: number; risk: number; with?: number; esc?: true; plus?: true }
/** 두 강대국 정상회담(2026-11-08, 설계 3절 「정상회담 방해」): 긴장이 높을 때 가끔 예고되고, 열리면 긴장이 크게 풀린다. 회랑이 방해에 성공하면 깨지고 긴장이 오른다.
 *  at: 열리는 날(일 번호) · d: 예고한 날 · place: 회담 장소(중립 성계 지도 번호) · sab: 방해 성공 */
export interface Summit { at: number; d: string; place: number; sab: boolean }
export const SUM = { minSt: 2, chance: 0.12, cool: 720, lead: 90, calmTn: -20, breakTn: 12, places: [581, 582, 583, 600] };
export function summitOpen(sv: IntelSave, now: number): boolean { return !!sv.summit && !sv.summit.sab && sv.summit.at > now; }
/** 매달: 회담을 예고하거나(begin) 열 날이 되면 결과(held | broken)를 돌려준다. 긴장 단계 st, 전쟁 중이면 열지 않는다. */
export function summitTick(sv: IntelSave, now: number, today: string, st: number, war: boolean, rnd: () => number): { ev: 'begin' | 'held' | 'broken' | 'off'; s: Summit } | null {
  const s = sv.summit;
  if (s) {
    if (war && !s.sab) { sv.summit = undefined; sv.sumLast = now; return { ev: 'off', s }; } // 전쟁이 나면 회담은 없던 일
    if (now < s.at) return null;
    sv.summit = undefined; sv.sumLast = now; return { ev: s.sab ? 'broken' : 'held', s };
  }
  if (war || st < SUM.minSt || now - (sv.sumLast ?? -99999) < SUM.cool || rnd() >= SUM.chance) return null;
  const n = { at: now + SUM.lead, d: today, place: SUM.places[Math.floor(rnd() * SUM.places.length)] ?? SUM.places[0], sab: false };
  sv.summit = n; return { ev: 'begin', s: n };
}
/** 함대 동향 카드로 본 함대: m 성계 지도 번호(-1 모름) · p 전력 · n 이름. d = 본 날짜 */
export interface FleetSeen { d: string; list: Array<{ m: number; p: number; n: string }> }
export const FLEET_SEEN_DAYS = 180; // 지도에 반 년 동안 남긴다
export interface IntelReport { d: string; kind: OpKind | 'lost' | 'hire' | 'ult' | 'alert' | 'year' | 'forge'; target: number; ok: boolean; ko: string; en: string }
/** 약점 카드(약점 캐기로 얻고 협박에 쓴다) */
export type WeakKind = 'debt' | 'smuggle' | 'scandal' | 'cruelty' | 'letters';
export interface WeakCard { k: WeakKind; d: string }
/** 최후통첩(의심도 90): due = 답할 기한(게임 날 번호) */
export interface Ultimatum { d: string; due: number }
/** 전쟁 계획 입수(2026-11-08): 그 나라가 다른 강대국을 어떻게 보나(atk 공격 준비 · def 방어 · wait 관망) · 회랑과의 긴장 · 다음 적 공작이 이 나라에서 오나 */
export type Intent = 'atk' | 'def' | 'wait';
export interface WarPlan { d: string; until: number; intent: Intent; tn: number; hostile: number; foe: boolean }
/** 중앙 정보망(2026-11-08, 설계 3절): 귀족 정보망보다 훨씬 천천히. 수도 섹터에 잠입한 공작원이 키우고, 수도 섹터 귀족 정보망이 높으면 함께 빨라진다. */
export const CEN = { grow: 1, skill: 0.5, coreW: 0.02, decay: 1, plantCore: 5, planDays: 360, tipThanks: { sus: 10, hostile: 15 }, tipTn: { atk: 8, calm: -6 }, fakeTn: 12, fakePlus: 6 };
/** 첩보 상점(2026-11-08 사용자: 「합쳐야 상점 풀이 더 재밌지 않을까 — 원할 때 안 나오는 맛」): 공작 카드와 방첩 대전 카드를 한 풀에서
 *  무작위 6칸만 진열. 반년마다(1월·7월 섹터 보고) · 방첩 대전이 끝나면 새로 깔리고, 에너지를 내면 다시 깔 수 있다(낼수록 비싸짐). 한 칸은 가끔 할인. */
export interface ShopSlot { pool: 'op' | 'duel'; k: string; price: number; sale?: true; sold?: true }
export interface Shop { h: number; slots: ShopSlot[]; rr: number }
export const SHOP = { slots: 6, duelShare: 0.45, rarW: { c: 60, u: 30, r: 10 } as Record<Rarity, number>, saleChance: 0.5, saleCut: 0.3, reroll: 150, rerollStep: 100 };
/** 위조 문서(2026-11-08 사용자: 「위조계획 제조하는 것도 만들자」) — 누가(from) → 누구를(to) 한다.
 *  plan: 그 나라 정부(from 'a'|'b')가 상대 강대국에게 intent · tie: 귀족 from 과 귀족 to 의 숨은 인연(bk) · loy: 귀족 from 이 자기 군주를 배신하려 함.
 *  q: 솜씨(0~100). 건넬 때 들킬 확률은 forgeCatch(q). */
export type ForgeKind = 'plan' | 'tie' | 'loy';
export interface Forged { id: number; k: ForgeKind; from: number | NSide; to: number | NSide; intent?: Intent; bk?: 'back' | 'accord' | 'oath'; q: number; d: string }
export const FORGE = { cost: { plan: 450, tie: 300, loy: 300 } as Record<ForgeKind, number>, max: 3, base: 35, netW: 0.45, catchTop: 60, catchMin: 8, catchW: 0.6,
  sus: 20, hostile: 12, relP: -25, actorSees: 90 };
/** 위조 솜씨: 정부 문서는 그 나라 중앙 정보망, 귀족 문서는 그 귀족(들) 정보망이 높을수록 진짜 같다(서식·인장·필체). */
export function forgeQuality(sv: IntelSave, k: ForgeKind, from: number | NSide, to: number | NSide): number {
  const net = (x: number | NSide) => (typeof x === 'number' ? sv.net[String(x)] ?? 0 : sv.cnet?.[x] ?? 0);
  const n = k === 'plan' ? net(from) : k === 'tie' ? (net(from) + net(to)) / 2 : net(from);
  return Math.round(clamp(FORGE.base + n * FORGE.netW, 0, 100));
}
/** 건넨 위조 문서가 들킬 확률(%) */
export const forgeCatch = (q: number): number => Math.round(clamp(FORGE.catchTop - q * FORGE.catchW, FORGE.catchMin, FORGE.catchTop));

export interface IntelSave {
  v: 1;
  agents: Agent[];
  net: Record<string, number>;      // 귀족 번호 → 정보망 0~100
  budget: number;                   // 정보 예산 단계 0~3
  ops: Op[];
  reports: IntelReport[];
  sus: { a: number; b: number };    // 두 강대국의 의심도 0~100
  seen: Record<string, true>;       // 정찰로 정체를 알아낸 귀족
  nextId: number;
  month: string;                    // 마지막으로 계산한 달(YYYY.MM)
  names: number;                    // 다음 공작원 이름 자리
  // ---- 2단계(2026-11-07) ----
  cards: Record<string, WeakCard>;  // 귀족 번호 → 약점 카드
  hostile: { a: number; b: number }; // 회랑과 그 강대국 사이 긴장(적대) 0~100 — 최후통첩 거절·큰 발각에서 오른다
  alert: { a: number; b: number };  // 이미 알린 의심도 단계(0~3) — 단계가 오를 때 한 번만 알린다
  ult: { a?: Ultimatum; b?: Ultimatum };
  ultCool: { a: number; b: number }; // 이 날(게임 날 번호) 전에는 최후통첩을 다시 내지 않는다
  rv: number[];                     // 게임에 아직 못 보낸 반란(귀족 번호) — 게임이 켜지면 보낸다
  reck?: { a: number; b: number };  // 회랑 응징(선전포고 예고)을 다시 내지 않을 날(게임 날 번호) — 회랑과의 긴장 100 에서(2026-11-08)
  // ---- 카드(2026-11-07) ----
  deck: Card[]; hand: Card[]; disc: Card[];
  ip: number;                       // 첩보력
  meet: number;                     // 마지막 연례 회의 해(0 = 아직)
  rewards: number;                  // 쌓인 성공 보상(회의에서 카드 고르기)
  offer: CardKind[];                // 지금 고르는 보상 카드 3장(비었으면 없음)
  won?: Partial<Record<CardType, number>>; // 올해 성공한 작전 종류(보상 카드 뽑기에 무게, 연례 회의 때 비움, 2026-11-08)
  foe?: Foe;                        // 지금 벌어진 방첩 대전(2026-11-08)
  shp?: number;                     // 우리 보안망(대전 체력, 판이 끝나도 이어짐)
  dd?: DC[];                        // 방첩 대전 덱
  chief?: { w: number; l: number }; // 첩보부장 대전 기록(4승부터 자동 대응)
  foeNext?: number;                 // 다음 적 공작이 시작될 날(게임 날 번호)
  foeLast?: FoeLast;                // 마지막 적 공작 결과(화면에서 확인하면 지움)
  ins?: Record<string, Partial<Record<Job, string>>>; // 귀족 번호 → 매수한 내부자(직업 → 매수한 날, 2026-11-08)
  insV?: 1 | 2 | 3 | 4 | 5 | 6;                     // 1: 옛 세이브에 요리사·운전수 카드를 넣어 줌 · 2: 내부자 탐색 카드 한 장을 넣어 줌(2026-11-08)
  affair?: Record<string, number>;  // 혼약한 귀족 곁에 들인 정부(불륜) — 귀족 번호 → 그 배우자 귀족 번호. 협박이 쉬워지고, 터지면 추문(2026-11-08)
  cnet?: { a: number; b: number };  // 중앙 정보망(그 나라 정부, 0~100) — 2단계 저울질(2026-11-08)
  plan?: Partial<Record<NSide, WarPlan>>; // 전쟁 계획 입수로 알아낸 그 나라의 속내(유효 기한까지)
  foeSide?: NSide;                  // 전쟁 계획으로 미리 엿본 다음 적 공작의 나라(공작이 시작되면 지움)
  summit?: Summit;                  // 예고된 두 강대국 정상회담(2026-11-08)
  sumLast?: number;                 // 지난 정상회담 날(일 번호) — 다음 회담까지 쉬는 기간
  fleets?: Partial<Record<NSide, FleetSeen>>; // 함대 동향으로 본 그 나라 군 함대(2026-11-08)
  shop?: Shop;                      // 첩보 상점 진열(공작 카드 + 방첩 대전 카드 한 풀, 2026-11-08)
  dbl?: Record<string, Job[]>;      // 들킨 뒤 상대가 몰래 돌려세운 내부자(이중 첩자) — 우리는 모른다. 거짓 정보를 흘리고, 그 내부자를 쓰는 공작은 들키기 쉽다(2026-11-08)
  fakes?: Forged[];                 // 위조 문서 공방에서 만든 가짜 문서(접견에서 진짜처럼 건넨다, 2026-11-08)
}
export type CardKind = OpKind | 'plant' | 'scout' | 'sweep' | 'hide' | 'disinfo' | 'trap' | 'seal' | 'firewall' | 'redund' | 'quarantine' | 'forge' | 'lurk' | 'escape' | 'rush' | 'weak' | 'watch' | 'leak';
export type CardType = 'recon' | 'op' | 'grand' | 'support' | 'counter' | 'weak' | 'curse';
/** 카드 한 장. plus = 강화판, t = 약점 카드의 대상 귀족 */
export interface Card { id: number; k: CardKind; plus?: true; t?: number }

export const IN = {
  maxAgents: 6, startAgents: 3, hireCost: 300, keepReports: 60,
  budget: [0, 50, 150, 300],        // 매달 에너지
  budgetMult: [0.6, 1, 1.4, 1.8],   // 정보망 자라는 속도
  decay: 2,                         // 공작원이 없는 정보망은 매달 이만큼 줄어든다
  susDecay: 1,                      // 의심도는 매달 조금씩 가라앉는다
  hostileDecay: 1,                  // 적대도 매달 조금씩
  reckAt: 100, reckCool: 360 * 3, reckAfter: 60, // 회랑과의 긴장이 100 이면 그 강대국이 30일 예고 뒤 선전포고(이벤트) · 3년 동안 다시 안 함 · 긴장은 60 으로(2026-11-08)
  captureShare: 0.35,               // 발각됐을 때 공작원이 붙잡힐 몫
  susStage: [30, 60, 90],           // 경계 · 감찰 · 최후통첩
  ultDays: 30,                      // 최후통첩 답할 기한
  ultCool: 180,                     // 최후통첩 뒤 다시 낼 때까지
  ultPay: 2000,                     // 배상금(에너지)
  ultRefuse: 40,                    // 거절하면 그 강대국과의 긴장이 이만큼 오른다
  incite: 25,                       // 반란 부추기기: 충성도가 이보다 낮아야
} as const;

/** 작전표: 필요 정보망 · 걸리는 날 · 기본 성공률 · 기본 발각 위험 · 쓰는 능력치(0 잠입, 1 설득, 2 위조) · 발각 때 의심도(들킴/붙잡힘) · 미리 내는 에너지 */
export interface OpDef { need: number; days: number; base: number; risk: number; skill: 0 | 1 | 2; hit: [number, number]; cost?: number; card?: true; loyal?: true; central?: true }
export const OPS: Record<OpKind, OpDef> = {
  identify: { need: 10, days: 30, base: 55, risk: 6, skill: 0, hit: [6, 15] },
  loyalty: { need: 20, days: 45, base: 45, risk: 10, skill: 0, hit: [6, 15] },
  ties: { need: 35, days: 60, base: 35, risk: 16, skill: 1, hit: [6, 15] },
  // 2단계 공작
  bribe: { need: 30, days: 30, base: 60, risk: 12, skill: 1, hit: [8, 15], cost: 500 },
  sow: { need: 40, days: 45, base: 45, risk: 18, skill: 1, hit: [10, 18] },
  dirt: { need: 50, days: 60, base: 40, risk: 14, skill: 0, hit: [8, 15] },
  blackmail: { need: 50, days: 30, base: 70, risk: 20, skill: 1, hit: [12, 20], card: true },
  frame: { need: 60, days: 60, base: 35, risk: 25, skill: 2, hit: [20, 28] },
  incite: { need: 70, days: 90, base: 30, risk: 30, skill: 1, hit: [25, 35], loyal: true },
  // 2026-11-08 사용자(영구 사망): 암살 — 귀족을 영구히 제거. 정보망 80, 성공 낮고 발각 높음, 들키면 그 나라와의 긴장 크게
  assassinate: { need: 80, days: 90, base: 25, risk: 40, skill: 0, hit: [30, 45] },
  // 2026-11-08 내부자 매수: 설득으로 산다. 의사는 어렵고 비싸다
  ins_cook: { need: 30, days: 45, base: 55, risk: 10, skill: 1, hit: [6, 12], cost: 300 },
  ins_driver: { need: 30, days: 45, base: 55, risk: 10, skill: 1, hit: [6, 12], cost: 300 },
  ins_mech: { need: 40, days: 60, base: 45, risk: 14, skill: 1, hit: [8, 14], cost: 400 },
  ins_doctor: { need: 50, days: 60, base: 35, risk: 18, skill: 1, hit: [10, 16], cost: 800 },
  ins_butler: { need: 35, days: 45, base: 50, risk: 12, skill: 1, hit: [6, 12], cost: 400 },
  ins_secretary: { need: 45, days: 60, base: 45, risk: 15, skill: 1, hit: [8, 14], cost: 500 },
  ins_guard: { need: 60, days: 60, base: 30, risk: 22, skill: 1, hit: [12, 20], cost: 900 },
  ins_treasurer: { need: 45, days: 60, base: 45, risk: 15, skill: 1, hit: [8, 14], cost: 500 },
  ins_lover: { need: 50, days: 75, base: 35, risk: 16, skill: 1, hit: [10, 16], cost: 600 },
  ins_priest: { need: 40, days: 60, base: 45, risk: 12, skill: 1, hit: [8, 14], cost: 400 },
  ins_clerk: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 }, ins_paparazzo: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 },
  ins_expat: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 }, ins_courier: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 }, ins_cleaner: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 },
  ins_canteen: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 }, ins_sleuth: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 },
  ins_streamer: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 }, ins_installer: { need: 15, days: 30, base: 65, risk: 6, skill: 1, hit: [3, 6], cost: 100 },
  ins_journalist: { need: 25, days: 30, base: 60, risk: 8, skill: 1, hit: [5, 10], cost: 200 },
  // 2026-11-08 3단계: 중독(요리사 필요 · 건강을 깎고 독이 쌓임 · 잘 안 들킴) · 사고(운전수나 정비사 필요 · 즉사, 드물게 살아남아 크게 다침)
  // 2026-11-08 2단계 「두 강대국 저울질」: 수도 섹터에 잠입한 공작원이 그 나라 정부(중앙 정보망)를 노린다. need·성공은 중앙 정보망 기준
  warplan: { need: 25, days: 60, base: 45, risk: 14, skill: 0, hit: [10, 18], central: true },
  tipoff: { need: 40, days: 30, base: 55, risk: 18, skill: 1, hit: [12, 20], central: true },
  fakedoc: { need: 50, days: 60, base: 35, risk: 22, skill: 2, hit: [15, 25], central: true },
  fleets: { need: 20, days: 30, base: 55, risk: 12, skill: 0, hit: [8, 14], central: true },
  summit: { need: 35, days: 30, base: 45, risk: 20, skill: 2, hit: [14, 22], central: true }, // 정상회담 방해(2026-11-08): 예고된 두 강대국 정상회담을 깨뜨린다 // 함대 동향(2026-11-08): 그 나라 군 함대 위치·전력을 모드 로그로 한 번 받는다(세이브 안 읽음)
  poison: { need: 50, days: 30, base: 70, risk: 8, skill: 0, hit: [15, 25] },
  accident: { need: 60, days: 60, base: 30, risk: 30, skill: 2, hit: [20, 35] },
};
/** 중독 한 번: 건강을 이만큼 깎고 독 단계 +1(해마다 단계마다 −5 더) */
export const POISON = { hurt: [8, 15] as [number, number], doctorRisk: 6 };
/** 사고: 정비사가 있으면 성공 +20 · 운전수·정비사마다 발각 −10 · 성공해도 15% 는 살아남아 건강 −40 */
export const ACCIDENT = { mechEdge: 20, insRisk: 10, survive: 0.15, hurt: 40 };
export const OP_KINDS: OpKind[] = ['identify', 'loyalty', 'ties', 'bribe', 'sow', 'dirt', 'blackmail', 'frame', 'incite', 'assassinate', 'ins_cook', 'ins_doctor', 'ins_driver', 'ins_mech', 'ins_butler', 'ins_secretary', 'ins_guard', 'ins_treasurer', 'ins_lover', 'ins_priest', 'ins_journalist', 'ins_clerk', 'ins_paparazzo', 'ins_expat', 'ins_courier', 'ins_cleaner', 'ins_canteen', 'ins_sleuth', 'ins_streamer', 'ins_installer', 'poison', 'accident', 'warplan', 'tipoff', 'fakedoc', 'fleets', 'summit'];
/** 들키면 큰 사건이 되는 공작(그 나라와의 긴장도 오른다) */
export const OP_GRAVE: Partial<Record<OpKind, number>> = { frame: 10, incite: 15, blackmail: 5, assassinate: 25, poison: 15, accident: 20, tipoff: 6, fakedoc: 12, summit: 10 };

// ---- 카드 표(설계 4절) ----
export const CARD: Record<CardKind, { type: CardType; cost: number; price?: number }> = {
  identify: { type: 'recon', cost: 1, price: 300 }, loyalty: { type: 'recon', cost: 2, price: 300 }, ties: { type: 'recon', cost: 2, price: 300 }, plant: { type: 'recon', cost: 1, price: 300 }, scout: { type: 'recon', cost: 2, price: 500 },
  sweep: { type: 'counter', cost: 1, price: 400 }, hide: { type: 'counter', cost: 1, price: 400 }, disinfo: { type: 'counter', cost: 2, price: 700 }, trap: { type: 'counter', cost: 2, price: 800 }, seal: { type: 'counter', cost: 3, price: 1500 },
  firewall: { type: 'counter', cost: 1, price: 400 }, redund: { type: 'counter', cost: 2, price: 800 }, quarantine: { type: 'counter', cost: 3, price: 1500 },
  bribe: { type: 'op', cost: 2, price: 600 }, sow: { type: 'op', cost: 3, price: 600 }, dirt: { type: 'op', cost: 3, price: 600 },
  blackmail: { type: 'grand', cost: 2, price: 1200 }, frame: { type: 'grand', cost: 4, price: 1200 }, incite: { type: 'grand', cost: 5, price: 1200 }, assassinate: { type: 'grand', cost: 6, price: 1800 },
  ins_cook: { type: 'op', cost: 2, price: 600 }, ins_driver: { type: 'op', cost: 2, price: 600 }, ins_mech: { type: 'op', cost: 2, price: 600 }, ins_doctor: { type: 'op', cost: 3, price: 900 },
  ins_butler: { type: 'op', cost: 2, price: 600 }, ins_secretary: { type: 'op', cost: 2, price: 700 }, ins_guard: { type: 'op', cost: 3, price: 1000 }, ins_treasurer: { type: 'op', cost: 2, price: 700 }, ins_lover: { type: 'op', cost: 3, price: 900 }, ins_priest: { type: 'op', cost: 2, price: 600 }, ins_journalist: { type: 'op', cost: 1, price: 400 },
  ins_clerk: { type: 'op', cost: 1 }, ins_paparazzo: { type: 'op', cost: 1 }, ins_expat: { type: 'op', cost: 1 }, ins_courier: { type: 'op', cost: 1 }, ins_cleaner: { type: 'op', cost: 1 }, ins_canteen: { type: 'op', cost: 1 }, ins_sleuth: { type: 'op', cost: 1 }, ins_streamer: { type: 'op', cost: 1 }, ins_installer: { type: 'op', cost: 1 },
  poison: { type: 'grand', cost: 3, price: 1400 }, accident: { type: 'grand', cost: 5, price: 1600 },
  warplan: { type: 'recon', cost: 2, price: 700 }, tipoff: { type: 'op', cost: 3, price: 900 }, fakedoc: { type: 'grand', cost: 4, price: 1400 }, fleets: { type: 'recon', cost: 2, price: 600 }, summit: { type: 'grand', cost: 4, price: 1300 },
  forge: { type: 'support', cost: 1, price: 400 }, lurk: { type: 'support', cost: 1, price: 400 }, escape: { type: 'support', cost: 1, price: 400 }, rush: { type: 'support', cost: 1, price: 400 },
  weak: { type: 'weak', cost: 0 }, watch: { type: 'curse', cost: 1 }, leak: { type: 'curse', cost: 2 },
};
export const CK = {
  startDeck: [['identify', 2], ['loyalty', 2], ['ties', 1], ['plant', 3], ['bribe', 1], ['sow', 1], ['dirt', 1], ['forge', 1], ['scout', 2], ['warplan', 1]] as Array<[CardKind, number]>,
  draw: 8, handMax: 10, ipBase: 6, ipMax: 14, carry: 4, watchCut: 2, plantNet: 12, removeCost: 500,
  deckMin: 8, deckMax: 36, leakRisk: 5, forgeChance: 15, lurkRisk: 10, // 덱 상한 30 → 36(2026-11-08, 카드 14종 추가)
  upgradable: ['bribe', 'sow', 'forge', 'scout', 'poison', 'accident', 'assassinate', 'ins_cook', 'ins_doctor', 'ins_driver', 'ins_mech', 'ins_butler', 'ins_secretary', 'ins_guard', 'ins_treasurer', 'ins_lover', 'ins_priest', 'ins_journalist', 'ins_clerk', 'ins_paparazzo', 'ins_expat', 'ins_courier', 'ins_cleaner', 'ins_canteen', 'ins_sleuth', 'ins_streamer', 'ins_installer', 'fakedoc'] as CardKind[],
  buyable: ['identify', 'loyalty', 'ties', 'plant', 'scout', 'bribe', 'sow', 'dirt', 'blackmail', 'frame', 'incite', 'assassinate', 'poison', 'accident', 'forge', 'lurk', 'escape', 'rush', 'warplan', 'tipoff', 'fakedoc', 'fleets', 'summit'] as CardKind[],
};
export const isSupport = (k: CardKind): boolean => CARD[k].type === 'support';
export function cardRar(k: CardKind): Rarity {
  const j = JOB_OF[k as OpKind]; if (j) return JOB_RAR[j];
  if (k === 'assassinate' || k === 'poison' || k === 'accident' || k === 'seal' || k === 'quarantine' || k === 'fakedoc' || k === 'summit') return 'r';
  if (['warplan', 'tipoff', 'fleets', 'scout', 'bribe', 'sow', 'dirt', 'blackmail', 'frame', 'incite', 'disinfo', 'trap', 'redund'].includes(k)) return 'u';
  return 'c';
}
export const isOpCard = (k: CardKind): k is OpKind => (OP_KINDS as string[]).includes(k);

/** 공작원 이름(회랑 사람들 — 고정 표, 언어 팩 대상 아님) */
export const AGENT_NAMES: Array<[string, string]> = [
  ['리세 아마렌', 'Lise Amaren'], ['토르 벡슬리', 'Tor Bexley'], ['미라 산테', 'Mira Sante'], ['하윈 콜', 'Hawin Cole'],
  ['에다 퀼런', 'Eda Quillon'], ['조렌 바', 'Joren Varr'], ['니사 펠', 'Nisa Fell'], ['카스 드루몬', 'Cas Drummon'],
  ['오렐 시안', 'Orel Sian'], ['베스 할로', 'Bess Hallow'], ['티모 렌', 'Timo Wren'], ['살라 오닉스', 'Sala Onyx'],
  ['데인 마로우', 'Dane Marrow'], ['일카 베른', 'Ilka Vern'], ['파비안 루', 'Fabian Roux'], ['요나 케슬', 'Jona Kessel'],
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const monthKey = (d: string): string => { const m = /^(\d+)\.(\d+)/.exec(d || ''); return m ? `${m[1]}.${m[2].padStart(2, '0')}` : ''; };
export function dayOf(d: string): number { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : 0; }
/** 의심도 단계 0 평온 · 1 경계 · 2 감찰 · 3 최후통첩 */
export const susStage = (v: number): 0 | 1 | 2 | 3 => (v >= IN.susStage[2] ? 3 : v >= IN.susStage[1] ? 2 : v >= IN.susStage[0] ? 1 : 0);

/** 성격으로 약점 종류를 고른다(교활 → 밀거래, 관대 → 빚, 충동 → 추문, 잔혹 → 학대, 그 밖 → 내통 서신). */
export function weakFor(n: NobleRow): WeakKind {
  const [hon, mer, gen, , cal] = n.tr;
  if (hon <= -1) return 'smuggle';
  if (gen >= 1) return 'debt';
  if (cal <= -1) return 'scandal';
  if (mer <= -1) return 'cruelty';
  return 'letters';
}

/** 만찬 차림표 23가지(2026-11-08 사용자: 「메뉴를 정해 놓는 건 어떨까? 23종으로」) — 늘 같은 차림표에서 고른다. 고정 표(언어 팩 대상 아님).
 *  likes: 이 음식을 즐기는 종족 부류(귀족 그림 부류 cls). 귀족의 「좋아하는 음식」은 자기 부류가 즐기는 것 가운데 하나, 「싫어하는 음식」은 자기 부류와 상관없는 것 가운데 하나. */
/** cat: 메뉴판 칸(main 메인 · bowl 수프와 식사 · rare 별미 · sweet 디저트 · drink 음료) */
export type DishCat = 'main' | 'bowl' | 'rare' | 'sweet' | 'drink';
export const DISH_CATS: DishCat[] = ['main', 'bowl', 'rare', 'sweet', 'drink'];
export const MENU: Array<{ id: string; cat: DishCat; ko: string; en: string; likes: string[] }> = [
  { id: 'lamb', cat: 'main', ko: '숯불에 구운 양갈비', en: 'Charcoal-grilled lamb', likes: ['hum', 'mam', 'rep'] },
  { id: 'cheese_wine', cat: 'drink', ko: '숙성 치즈와 붉은 포도주', en: 'Aged cheese with red wine', likes: ['hum', 'mam'] },
  { id: 'trout', cat: 'main', ko: '버터에 졸인 민물 송어', en: 'Butter-braised river trout', likes: ['hum', 'aqua'] },
  { id: 'raw_meat', cat: 'main', ko: '얇게 저민 날고기 회', en: 'Thin-sliced raw meat', likes: ['rep', 'necro'] },
  { id: 'stone_eggs', cat: 'main', ko: '뜨거운 돌에 익힌 알', en: 'Eggs cooked on hot stone', likes: ['rep', 'avi'] },
  { id: 'smoked_eel', cat: 'main', ko: '훈제 늪 뱀장어', en: 'Smoked marsh eel', likes: ['rep', 'aqua'] },
  { id: 'shell_nuts', cat: 'rare', ko: '딱딱한 껍질 열매 구이', en: 'Roasted hard-shell nuts', likes: ['art', 'avi', 'mol'] },
  { id: 'grub_jelly', cat: 'sweet', ko: '꿀벌레 젤리', en: 'Honey-grub jelly', likes: ['art', 'mol'] },
  { id: 'moss_soup', cat: 'bowl', ko: '향신 이끼 수프', en: 'Spiced moss soup', likes: ['art', 'fun', 'plant'] },
  { id: 'root_tubers', cat: 'main', ko: '구운 뿌리줄기', en: 'Roasted root tubers', likes: ['mol', 'mam', 'plant'] },
  { id: 'grain_porridge', cat: 'bowl', ko: '발효 곡물 죽', en: 'Fermented grain porridge', likes: ['mol', 'hum'] },
  { id: 'dried_fruit', cat: 'sweet', ko: '말린 과일과 씨앗', en: 'Dried fruit and seeds', likes: ['avi', 'plant'] },
  { id: 'nectar_tea', cat: 'drink', ko: '꽃꿀 차', en: 'Nectar tea', likes: ['avi', 'art'] },
  { id: 'meat_noodles', cat: 'bowl', ko: '고기 육수 국수', en: 'Noodles in meat broth', likes: ['mam', 'hum'] },
  { id: 'berry_pie', cat: 'sweet', ko: '산딸기 파이', en: 'Wild berry pie', likes: ['mam', 'avi'] },
  { id: 'crystal_shards', cat: 'rare', ko: '광물 결정 조각', en: 'Mineral crystal shards', likes: ['lith'] },
  { id: 'volcanic_pebbles', cat: 'rare', ko: '달군 화산암 조각', en: 'Heated volcanic pebbles', likes: ['lith'] },
  { id: 'metal_candy', cat: 'sweet', ko: '금속염 사탕', en: 'Metal-salt candy', likes: ['lith', 'art'] },
  { id: 'spring_water', cat: 'drink', ko: '맑은 광천수와 영양 차', en: 'Spring water with nutrient tea', likes: ['plant', 'lith'] },
  { id: 'berry_wine', cat: 'drink', ko: '핏빛 열매주', en: 'Blood-red berry wine', likes: ['necro', 'hum'] },
  { id: 'marrow_jelly', cat: 'rare', ko: '차갑게 식힌 골수 젤리', en: 'Chilled marrow jelly', likes: ['necro', 'rep'] },
  { id: 'shellfish_kelp', cat: 'main', ko: '날조개와 해초', en: 'Raw shellfish and kelp', likes: ['aqua', 'fun'] },
  { id: 'spore_bread', cat: 'bowl', ko: '포자 빵과 균사 치즈', en: 'Spore bread with mycelium cheese', likes: ['fun', 'necro'] },
];
const clsOf = (n: NobleRow): string => (MENU.some((m) => m.likes.includes(n.cls)) ? n.cls : 'hum');
const favIdx = (n: NobleRow): number => { const c = clsOf(n), l = MENU.map((m, i) => (m.likes.includes(c) ? i : -1)).filter((i) => i >= 0); return l[Math.abs(n.id * 7 + 3) % l.length]; };
const hateIdx = (n: NobleRow): number => { const c = clsOf(n), l = MENU.map((m, i) => (m.likes.includes(c) ? -1 : i)).filter((i) => i >= 0); return l[Math.abs(n.id * 13 + 5) % l.length]; };
/** 좋아하는 음식(요리사 매수로 알아낸다 — 접견 대접에 쓴다). */
export function favFood(n: NobleRow): [string, string] { const m = MENU[favIdx(n)]; return [m.ko, m.en]; }
// 고른 음식: 가장 좋아하는 것 +8 · 자기 종족이 즐기는 것 +4 · 그 밖 +1 · 싫어하는 것 −4.
// 요리사가 없어도 그 귀족의 종족(초상)을 보고 맞는 음식을 고르면 웬만큼은 맞는다. 요리사를 사 뒀으면 차림표에 ★·✕ 가 표시된다.
export const DISH = { fav: 8, kin: 4, other: 1, hate: -4 };
/** 음식 그림(2026-11-08 GPT 의뢰): ui/assets/scenario/corridor/food/dish_<id>.png — 없으면 화면이 그림 없이 그린다. */
export const dishPic = (key: string): string => { const m = MENU[Number(key)]; return m ? `assets/scenario/corridor/food/dish_${m.id}.png` : ''; };
export function menuFor(n: NobleRow): Array<{ key: string; ko: string; en: string; fav: boolean; hate: boolean; pic: string; cat: DishCat; likes: string[] }> {
  const f = favIdx(n), x = hateIdx(n);
  return MENU.map((m, i) => ({ key: String(i), ko: m.ko, en: m.en, fav: i === f, hate: i === x, pic: dishPic(String(i)), cat: m.cat, likes: m.likes }));
}
/** 고른 음식의 반응: 친밀도 변화와 종류. */
export function dishScore(n: NobleRow, key: string): { d: number; kind: 'fav' | 'kin' | 'other' | 'hate' } | null {
  const i = Number(key), m = MENU[i]; if (!Number.isInteger(i) || !m) return null;
  if (i === favIdx(n)) return { d: DISH.fav, kind: 'fav' }; if (i === hateIdx(n)) return { d: DISH.hate, kind: 'hate' };
  return m.likes.includes(clsOf(n)) ? { d: DISH.kin, kind: 'kin' } : { d: DISH.other, kind: 'other' };
}

/** 새 공작원. rnd 는 0~1 난수 함수(시험에서 고정할 수 있게). */
export function makeAgent(sv: IntelSave, date: string, rnd: () => number): Agent {
  const [ko, en] = AGENT_NAMES[sv.names % AGENT_NAMES.length]; sv.names++;
  const roll = () => 1 + Math.floor(rnd() * 3); // 1~3 으로 시작, 경험으로 자란다
  const a: Agent = { id: sv.nextId++, ko, en, sk: [roll(), roll(), roll()], xp: 0, at: null, st: 'idle', since: date };
  return a;
}
export function newIntelSave(date: string, rnd: () => number = Math.random): IntelSave {
  const sv: IntelSave = { v: 1, agents: [], net: {}, budget: 1, ops: [], reports: [], sus: { a: 0, b: 0 }, seen: {}, nextId: 1, month: monthKey(date), names: 0,
    cards: {}, hostile: { a: 0, b: 0 }, alert: { a: 0, b: 0 }, ult: {}, ultCool: { a: 0, b: 0 }, rv: [], reck: { a: 0, b: 0 },
    deck: [], hand: [], disc: [], ip: 0, meet: 0, rewards: 0, offer: [], insV: 6 };
  for (let i = 0; i < IN.startAgents; i++) sv.agents.push(makeAgent(sv, date, rnd));
  startDeck(sv, rnd);
  return sv;
}
const WEAK: WeakKind[] = ['debt', 'smuggle', 'scandal', 'cruelty', 'letters'];
function fixCards(o: unknown): Card[] {
  if (!Array.isArray(o)) return [];
  return o.filter((c) => c && typeof c === 'object' && (c as Card).k in CARD && Number.isFinite(Number((c as Card).id))).slice(0, 60)
    .map((c: Card) => ({ id: Math.round(Number(c.id)), k: c.k, ...(c.plus ? { plus: true as const } : {}), ...(Number.isFinite(Number(c.t)) && c.t !== undefined ? { t: Math.round(Number(c.t)) } : {}) }));
}
export function fixIntelSave(o: unknown, date: string): IntelSave {
  const x = (o && typeof o === 'object' ? o : {}) as Partial<IntelSave>;
  if (!Array.isArray(x.agents)) return newIntelSave(date);
  const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? clamp(n, lo, hi) : d; };
  const sv: IntelSave = {
    v: 1,
    agents: x.agents.filter((a) => a && typeof a.ko === 'string').slice(0, 12).map((a) => ({
      id: Math.round(num(a.id, 1, 1e6, 1)), ko: String(a.ko).slice(0, 40), en: String(a.en || a.ko).slice(0, 40),
      sk: (Array.isArray(a.sk) ? a.sk : [1, 1, 1]).slice(0, 3).map((v) => Math.round(num(v, 1, 5, 1))) as IntelSkill, xp: Math.round(num(a.xp, 0, 1e4, 0)),
      at: a.at === null || a.at === undefined ? null : Math.round(num(a.at, -1, 1e6, -1)), st: (['idle', 'post', 'op', 'lost'] as AgentState[]).includes(a.st) ? a.st : 'idle', since: String(a.since || ''),
    })),
    net: {}, budget: Math.round(num(x.budget, 0, 3, 1)), ops: [], reports: [], sus: { a: num(x.sus?.a, 0, 100, 0), b: num(x.sus?.b, 0, 100, 0) },
    seen: {}, nextId: Math.round(num(x.nextId, 1, 1e6, 1)), month: typeof x.month === 'string' ? x.month : monthKey(date), names: Math.round(num(x.names, 0, 1e4, 0)),
    cards: {}, hostile: { a: num(x.hostile?.a, 0, 100, 0), b: num(x.hostile?.b, 0, 100, 0) }, alert: { a: Math.round(num(x.alert?.a, 0, 3, 0)), b: Math.round(num(x.alert?.b, 0, 3, 0)) },
    ult: {}, ultCool: { a: num(x.ultCool?.a, 0, 1e7, 0), b: num(x.ultCool?.b, 0, 1e7, 0) }, rv: Array.isArray(x.rv) ? x.rv.map(Number).filter((n) => Number.isInteger(n) && n >= 0).slice(0, 20) : [],
    deck: fixCards(x.deck), hand: fixCards(x.hand), disc: fixCards(x.disc), ip: num(x.ip, 0, 40, 0), meet: Math.round(num(x.meet, 0, 1e5, 0)), rewards: Math.round(num(x.rewards, 0, 20, 0)),
    offer: Array.isArray(x.offer) ? (x.offer as CardKind[]).filter((k) => k in CARD).slice(0, 3) : [],
    reck: { a: num(x.reck?.a, 0, 1e7, 0), b: num(x.reck?.b, 0, 1e7, 0) },
  };
  if (!sv.deck.length && !sv.hand.length && !sv.disc.length) startDeck(sv, Math.random);
  else {
    if (!x.insV) sv.disc.push({ id: sv.nextId++, k: 'ins_cook' }, { id: sv.nextId++, k: 'ins_driver' }); // 옛 세이브: 내부자 카드 두 장(2026-11-08)
    if ((x.insV ?? 0) < 2) sv.disc.push({ id: sv.nextId++, k: 'scout' });                               // 내부자 탐색 카드 한 장(2026-11-08)
  }
  if ((x.insV ?? 0) < 3 && (x.deck?.length || x.hand?.length || x.disc?.length)) sv.disc.push({ id: sv.nextId++, k: 'sweep' }, { id: sv.nextId++, k: 'hide' }); // 방첩 카드 두 장(2026-11-08)
  if ((x.insV ?? 0) < 4 && (x.deck?.length || x.hand?.length || x.disc?.length)) sv.disc.push({ id: sv.nextId++, k: 'sweep' }, { id: sv.nextId++, k: 'hide' }, { id: sv.nextId++, k: 'disinfo' }); // 카드 대결용 방첩 덱 채우기(아래에서 방첩 덱으로 옮김)
  if ((x.insV ?? 0) < 5 && (x.deck?.length || x.hand?.length || x.disc?.length)) sv.disc.push({ id: sv.nextId++, k: 'firewall' }, { id: sv.nextId++, k: 'firewall' }, { id: sv.nextId++, k: 'redund' }); // 순수 방어 카드(체력제, 2026-11-08)
  if ((x.insV ?? 0) < 6 && (x.deck?.length || x.hand?.length || x.disc?.length)) sv.disc.push({ id: sv.nextId++, k: 'warplan' }); // 저울질 카드 한 장(2026-11-08)
  sv.insV = 6;
  { const f = x.foe, du = f ? fixDuel(f.duel) : null; if (f && du && Array.isArray(f.ops) && (f.side === 'a' || f.side === 'b') && Number.isFinite(Number(f.due))) {
      const ops = (f.ops as FoeOp[]).filter((o) => o && FOE_KINDS.includes(o.k)).slice(0, 3).map((o) => ({ k: o.k, tgt: Math.round(num(o.tgt, -1, 1e6, -1)) }));
      if (ops.length) sv.foe = { id: Math.round(num(f.id, 0, 1e6, 0)), side: f.side, by: Math.round(num(f.by, -1, 1e6, -1)), start: String(f.start || ''), due: Number(f.due), seen: !!f.seen, ops, press: num(f.press, 0, 200, 0), duel: du };
    } }
  { const l = x.foeLast; if (l && typeof l.ko === 'string' && (l.res === 'win' || l.res === 'lose' || l.res === 'draw')) sv.foeLast = { d: String(l.d || ''), side: l.side === 'b' ? 'b' : 'a', by: Math.round(num(l.by, -1, 1e6, -1)), seen: !!l.seen, res: l.res, ...(Number.isFinite(Number(l.auto)) ? { auto: Number(l.auto) } : {}),
      ops: Array.isArray(l.ops) ? (l.ops as FoeKind[]).filter((k) => FOE_KINDS.includes(k)) : [], ko: l.ko.slice(0, 1500), en: String(l.en || l.ko).slice(0, 1500), ...(Array.isArray(l.offer) ? { offer: (l.offer as DCard[]).filter((k) => k in DCARDS).slice(0, 3) } : {}) }; }
  if (Number.isFinite(Number(x.shp))) sv.shp = num(x.shp, 0, D.hpMax, D.hpMax);
  if (Array.isArray(x.dd)) sv.dd = (x.dd as DC[]).filter((c) => c && c.k in DCARDS).slice(0, 60).map((c) => ({ id: Math.round(num(c.id, 0, 1e6, 0)), k: c.k, ...(c.plus ? { plus: true as const } : {}) }));
  if (x.chief && typeof x.chief === 'object') sv.chief = { w: Math.round(num(x.chief.w, 0, 999, 0)), l: Math.round(num(x.chief.l, 0, 999, 0)) };
  // 옛 방첩 카드(카드 대결 1·2판)는 대전 카드로 바뀌어 본 덱에서 뺀다(2026-11-08)
  for (const pile of ['deck', 'hand', 'disc'] as const) sv[pile] = sv[pile].filter((c) => CARD[c.k].type !== 'counter');
  if (x.net && typeof x.net === 'object') for (const [k, v] of Object.entries(x.net)) if (Number.isFinite(Number(v))) sv.net[k] = clamp(Number(v), 0, 100);
  if (x.seen && typeof x.seen === 'object') for (const [k, v] of Object.entries(x.seen)) if (v === true) sv.seen[k] = true;
  if (x.cnet && typeof x.cnet === 'object') sv.cnet = { a: num(x.cnet.a, 0, 100, 0), b: num(x.cnet.b, 0, 100, 0) };
  if (x.foeSide === 'a' || x.foeSide === 'b') sv.foeSide = x.foeSide;
  if (x.summit && typeof x.summit === 'object' && Number.isFinite(Number(x.summit.at))) sv.summit = { at: Math.round(Number(x.summit.at)), d: String(x.summit.d ?? '').slice(0, 16), place: Math.round(Number(x.summit.place)) || SUM.places[0], sab: !!x.summit.sab };
  if (Number.isFinite(Number(x.sumLast))) sv.sumLast = Math.round(Number(x.sumLast));
  for (const s of ['a', 'b'] as NSide[]) { const f = x.fleets?.[s]; if (f && Array.isArray(f.list)) (sv.fleets ??= {})[s] = { d: String(f.d || '').slice(0, 16), list: f.list.slice(0, 60).map((q) => ({ m: Math.round(Number(q?.m)), p: Math.max(0, Math.round(Number(q?.p) || 0)), n: String(q?.n ?? '').slice(0, 60) })).filter((q) => Number.isFinite(q.m)) }; }
  for (const s of ['a', 'b'] as NSide[]) { const p = x.plan?.[s]; if (p && ['atk', 'def', 'wait'].includes(p.intent) && Number.isFinite(Number(p.until))) (sv.plan ??= {})[s] = { d: String(p.d || ''), until: Number(p.until), intent: p.intent, tn: num(p.tn, 0, 100, 0), hostile: num(p.hostile, 0, 100, 0), foe: !!p.foe }; }
  { const sh = fixShop(x.shop); if (sh) sv.shop = sh; }
  if (x.affair && typeof x.affair === 'object') for (const [k, v] of Object.entries(x.affair)) if (Number.isFinite(Number(v))) (sv.affair ??= {})[k] = Math.round(Number(v));
  if (Array.isArray(x.fakes)) sv.fakes = x.fakes.filter((f: Forged) => f && ['plan', 'tie', 'loy'].includes(f.k) && (typeof f.from === 'number' || f.from === 'a' || f.from === 'b') && (typeof f.to === 'number' || f.to === 'a' || f.to === 'b')).slice(0, FORGE.max)
    .map((f: Forged) => ({ id: Math.round(num(f.id, 1, 1e6, 1)), k: f.k, from: f.from, to: f.to, ...(f.intent && ['atk', 'def', 'wait'].includes(f.intent) ? { intent: f.intent } : {}), ...(f.bk && ['back', 'accord', 'oath'].includes(f.bk) ? { bk: f.bk } : {}), q: num(f.q, 0, 100, 40), d: String(f.d || '').slice(0, 16) }));
  if (x.dbl && typeof x.dbl === 'object') for (const [k, v] of Object.entries(x.dbl)) if (Array.isArray(v)) { const l = v.filter((j) => JOBS.includes(j as Job)) as Job[]; if (l.length) (sv.dbl ??= {})[k] = l; }
  if (x.ins && typeof x.ins === 'object') for (const [k, v] of Object.entries(x.ins)) { if (!v || typeof v !== 'object') continue; const m: Partial<Record<Job, string>> = {}; for (const j of JOBS) { const d = (v as Record<string, unknown>)[j]; if (typeof d === 'string') m[j] = d.slice(0, 20); } if (Object.keys(m).length) (sv.ins ??= {})[k] = m; }
  if (x.cards && typeof x.cards === 'object') for (const [k, v] of Object.entries(x.cards)) if (v && WEAK.includes((v as WeakCard).k)) sv.cards[k] = { k: (v as WeakCard).k, d: String((v as WeakCard).d || '') };
  for (const s of ['a', 'b'] as NSide[]) { const u = x.ult?.[s]; if (u && typeof u.d === 'string' && Number.isFinite(Number(u.due))) sv.ult[s] = { d: u.d, due: Number(u.due) }; }
  if (Array.isArray(x.ops)) sv.ops = x.ops.filter((p) => p && OP_KINDS.includes(p.kind)).map((p) => ({ id: Math.round(num(p.id, 1, 1e6, 1)), kind: p.kind, target: Math.round(num(p.target, 0, 1e6, 0)), agent: Math.round(num(p.agent, 0, 1e6, 0)), start: String(p.start || ''), days: Math.round(num(p.days, 1, 720, 30)), chance: num(p.chance, 0, 100, 50), risk: num(p.risk, 0, 100, 10), ...(p.with !== undefined && Number.isFinite(Number(p.with)) ? { with: Math.round(Number(p.with)) } : {}) }));
  if (Array.isArray(x.reports)) sv.reports = x.reports.filter((r) => r && typeof r.ko === 'string' && typeof r.en === 'string').slice(-IN.keepReports) as IntelReport[];
  return sv;
}

/** 기술 보정(바닐라 암호 해독·암호화 — 읽지 못하면 0). 설계 5-1. */
export interface CodeEdge { atk: number; def: number }
/** 작전 성공률(5~95). */
export function opChance(sv: IntelSave, kind: OpKind, target: number, agent: Agent, edge: CodeEdge = { atk: 0, def: 0 }, side?: NSide): number {
  const o = OPS[kind], net = o.central && side ? cnetOf(sv, side) : sv.net[String(target)] ?? 0, ins = sv.ins?.[String(target)];
  const guard = kind === 'assassinate' && ins?.guard ? GUARD_EDGE : 0; // 경호대장 매수(2026-11-08)
  const mech = kind === 'accident' && ins?.mech ? ACCIDENT.mechEdge : 0;
  const affair = kind === 'blackmail' && sv.affair?.[String(target)] !== undefined ? AFFAIR.blackmail : 0; // 불륜은 가장 좋은 약점
  const pap = (kind === 'dirt' && ins?.paparazzo ? COMMON.papDirt : 0) // 길거리 파파라치: 약점 캐기 +10
    + ((kind === 'identify' || kind === 'loyalty' || kind === 'ties') && ins?.installer ? COMMON.installerRecon : 0); // 설치 기사(도청): 정찰 +10
  const netW = kind === 'assassinate' ? 0.4 : 0.15, base = kind === 'assassinate' ? 0 : o.base; // 암살: 정보력이 낮을수록 실패(2026-11-08 사용자) — 정보망 80 이면 32, 100 이면 40 + 능력
  return Math.round(clamp(base + net * netW + agent.sk[o.skill] * 8 + edge.atk * 0.5 + guard + mech + affair + pap, 5, 95));
}
/** 발각 위험(2~80). side = 대상 귀족의 나라. 경계(30)부터 그 나라 방첩이 강해진다. */
export function opRisk(sv: IntelSave, kind: OpKind, side: NSide, agent: Agent, edge: CodeEdge = { atk: 0, def: 0 }, target?: number): number {
  const o = OPS[kind], st = susStage(sv.sus[side]), net = target !== undefined ? sv.net[String(target)] ?? 0 : 100, ins = target !== undefined ? sv.ins?.[String(target)] : undefined;
  const adj = (kind === 'assassinate' ? Math.max(0, 100 - net) * 0.3 : 0) // 암살: 정보력이 낮을수록 발각(2026-11-08 사용자)
    - (kind === 'poison' && ins?.doctor ? POISON.doctorRisk : 0) - (kind === 'accident' ? ((ins?.driver ? 1 : 0) + (ins?.mech ? 1 : 0)) * ACCIDENT.insRisk : 0)
    + (target !== undefined && turnedFor(sv, target, kind) ? DOUBLE.risk : 0) // 이중 첩자가 낀 공작은 새어 나간다
    - (ins?.courier ? COMMON.courierRisk : 0); // 배달원: 이 귀족 상대 작전 발각 −3
  const leaks = (sv.hand || []).filter((c) => c.k === 'leak').length * CK.leakRisk;
  return Math.round(clamp(o.risk + adj + sv.sus[side] * 0.2 + (st >= 1 ? 5 : 0) + (st >= 2 ? 5 : 0) + leaks - edge.def * 0.5 - agent.sk[0] * 3, 2, 80));
}
export const cnetOf = (sv: IntelSave, side: NSide): number => sv.cnet?.[side] ?? 0;
/** 아직 유효한 전쟁 계획(없으면 null) */
export const planOf = (sv: IntelSave, side: NSide, now: number): WarPlan | null => { const p = sv.plan?.[side]; return p && (!now || p.until >= now) ? p : null; };
/** 매달 중앙 정보망: 그 나라 수도 섹터에 잠입한 공작원마다 +1(+잠입 능력 × 0.5) × 예산, 수도 섹터 귀족 정보망 평균 × 0.02 덤. 아무도 없으면 −1. */
export function centralTick(sv: IntelSave, nobles: NobleRow[], isCore: (id: number) => boolean): void {
  const cn = (sv.cnet ??= { a: 0, b: 0 }), mult = IN.budgetMult[clamp(sv.budget, 0, 3)];
  for (const side of ['a', 'b'] as NSide[]) {
    const core = nobles.filter((n) => n.side === side && isCore(n.id)), ids = new Set(core.map((n) => n.id));
    const posted = sv.agents.filter((a) => (a.st === 'post' || a.st === 'op') && a.at !== null && ids.has(a.at));
    const avg = core.length ? core.reduce((t, n) => t + (sv.net[String(n.id)] ?? 0), 0) / core.length : 0;
    const g = posted.reduce((t, a) => t + (CEN.grow + a.sk[0] * CEN.skill) * mult, 0) + (posted.length ? avg * CEN.coreW : 0);
    cn[side] = Math.round(clamp(posted.length ? cn[side] + g : cn[side] - CEN.decay, 0, 100) * 10) / 10;
  }
}
/** 전쟁 계획: 그 나라의 속내. tn = 두 강대국 사이 긴장(시나리오 공용, 모르면 0). foeW = 다음 적 공작이 그 나라에서 올 몫(0~1). */
export function readPlan(sv: IntelSave, side: NSide, today: string, tn: number, foeW: number, rnd: () => number): WarPlan {
  const r = rnd(), intent: Intent = tn >= 75 ? (r < 0.8 ? 'atk' : 'def') : tn >= 50 ? (r < 0.45 ? 'atk' : r < 0.8 ? 'def' : 'wait') : tn >= 25 ? (r < 0.15 ? 'atk' : r < 0.55 ? 'def' : 'wait') : (r < 0.3 ? 'def' : 'wait');
  if (sv.foeSide === undefined && !sv.foe) sv.foeSide = rnd() < foeW ? side : side === 'a' ? 'b' : 'a';
  const p: WarPlan = { d: today, until: dayOf(today) + CEN.planDays, intent, tn: Math.round(tn), hostile: Math.round(sv.hostile[side]), foe: sv.foeSide === side };
  (sv.plan ??= {})[side] = p; return p;
}
export type StartWhy = '' | 'agent' | 'busy' | 'net' | 'notcore' | 'cnet' | 'noplan' | 'nosummit' | 'dup' | 'place' | 'card' | 'have' | 'loyal' | 'core' | 'gone' | 'with' | 'hired' | 'nocook' | 'noride';
/** 작전을 걸 수 있나. 안 되면 이유 열쇠. info: 대상 귀족의 지금 충성도 · 수도 섹터 거점인가 · 이미 떨어져 나갔나. */
export function canStart(sv: IntelSave, kind: OpKind, target: number, agentId: number, info: { loyal?: number; core?: boolean; gone?: boolean; side?: NSide; now?: number } = {}): StartWhy {
  const a = sv.agents.find((x) => x.id === agentId); if (!a || a.st === 'lost') return 'agent';
  if (a.st === 'op') return 'busy';
  if (a.at !== target) return 'place';
  if (info.gone) return 'gone';
  if (OPS[kind].central) { // 저울질 작전: 그 나라 수도 섹터에서만, 중앙 정보망 기준(2026-11-08)
    if (!info.core || !info.side) return 'notcore';
    if (cnetOf(sv, info.side) < OPS[kind].need) return 'cnet';
    if (kind === 'tipoff' && !planOf(sv, info.side, info.now ?? 0)) return 'noplan';
    if (kind === 'summit' && !summitOpen(sv, info.now ?? 0)) return 'nosummit';
  } else if ((sv.net[String(target)] ?? 0) < OPS[kind].need) return 'net';
  if (sv.ops.some((p) => p.target === target && p.kind === kind)) return 'dup';
  if (kind === 'dirt' && sv.cards[String(target)]) return 'have';
  { const j = JOB_OF[kind]; if (j && sv.ins?.[String(target)]?.[j]) return 'hired'; }
  if (OPS[kind].card && !sv.cards[String(target)]) return 'card';
  if ((kind === 'incite' || kind === 'assassinate' || kind === 'accident') && info.core) return 'core';
  if (kind === 'poison' && !sv.ins?.[String(target)]?.cook) return 'nocook';
  if (kind === 'accident' && !sv.ins?.[String(target)]?.driver && !sv.ins?.[String(target)]?.mech) return 'noride';
  if (OPS[kind].loyal && !((info.loyal ?? 100) < IN.incite)) return 'loyal';
  return '';
}

export interface OpResult { op: Op; agent: Agent; ok: boolean; caught: boolean; detected: boolean }
export type IntelEvent = { kind: 'stage'; side: NSide; st: 1 | 2 | 3 } | { kind: 'ult'; side: NSide } | { kind: 'expire'; side: NSide };
export interface TickResult { results: OpResult[]; grew: Array<{ id: number; from: number; to: number }>; events: IntelEvent[] }
/** 한 달 계산: 정보망 자람·줄어듦, 의심도·긴장 가라앉음, 끝난 작전 판정, 의심도 단계·최후통첩. today = 게임 날짜. 같은 달은 한 번만(month 로 막음). */
export function monthTick(sv: IntelSave, today: string, nobles: NobleRow[], rnd: () => number = Math.random): TickResult | null {
  const mk = monthKey(today); if (!mk || mk === sv.month) return null; sv.month = mk;
  const out: TickResult = { results: [], grew: [], events: [] };
  const posted = new Map<number, Agent>(); for (const a of sv.agents) if ((a.st === 'post' || a.st === 'op') && a.at !== null) posted.set(a.at, a);
  const mult = IN.budgetMult[clamp(sv.budget, 0, 3)];
  const ids = new Set<number>([...nobles.map((n) => n.id)]);
  for (const id of ids) {
    const k = String(id), from = sv.net[k] ?? 0, a = posted.get(id);
    let to = from;
    if (a) to = clamp(from + (3 + a.sk[0] * 2) * mult, 0, 100);
    else if (from > 0) to = clamp(from - IN.decay, 0, 100);
    if (to !== from) { if (to > 0) sv.net[k] = Math.round(to * 10) / 10; else delete sv.net[k]; out.grew.push({ id, from, to }); }
  }
  for (const s of ['a', 'b'] as NSide[]) { if (!sv.ult[s]) sv.sus[s] = clamp(sv.sus[s] - IN.susDecay, 0, 100); sv.hostile[s] = clamp(sv.hostile[s] - IN.hostileDecay, 0, 100); }
  const by = new Map(nobles.map((n) => [n.id, n] as [number, NobleRow]));
  const now = dayOf(today), keep: Op[] = [];
  for (const op of sv.ops) {
    if (dayOf(op.start) + op.days > now) { keep.push(op); continue; }
    const a = sv.agents.find((x) => x.id === op.agent); if (!a) continue;
    const ok = rnd() * 100 < op.chance, detected = rnd() * 100 < op.risk, caught = detected && !op.esc && rnd() < IN.captureShare;
    if (detected) addCard(sv, 'leak');                         // 들키면 「누설」이 덱에 들어온다(카드 방식)
    if (ok && ['op', 'grand'].includes(CARD[op.kind].type)) { sv.rewards = Math.min(20, sv.rewards + 1); const ty = CARD[op.kind].type; (sv.won ??= {})[ty] = (sv.won[ty] ?? 0) + 1; }
    const side = by.get(op.target)?.side, hit = OPS[op.kind].hit;
    if (detected && side) {
      sv.sus[side] = clamp(sv.sus[side] + (caught ? hit[1] : hit[0]), 0, 100);
      const grave = OP_GRAVE[op.kind]; if (grave) sv.hostile[side] = clamp(sv.hostile[side] + grave, 0, 100);
    }
    if (caught) { a.st = 'lost'; a.at = null; }
    else { a.st = 'post'; a.xp += ok ? 2 : 1; const sk = OPS[op.kind].skill; if (a.xp >= (a.sk[sk] + 1) * 4 && a.sk[sk] < 5) { a.sk[sk]++; a.xp = 0; } }
    out.results.push({ op, agent: a, ok, caught, detected });
  }
  sv.ops = keep;
  // 의심도 단계(오를 때 한 번 알림)·최후통첩
  for (const s of ['a', 'b'] as NSide[]) {
    const st = susStage(sv.sus[s]);
    if (st > sv.alert[s]) { for (let k = sv.alert[s] + 1; k <= st; k++) if (k < 3) { out.events.push({ kind: 'stage', side: s, st: k as 1 | 2 }); addCard(sv, 'watch'); } sv.alert[s] = st; }
    else if (st < sv.alert[s]) sv.alert[s] = st;
    const u = sv.ult[s];
    if (u && now >= u.due) { delete sv.ult[s]; out.events.push({ kind: 'expire', side: s }); }
    else if (!u && st >= 3 && now >= sv.ultCool[s]) { sv.ult[s] = { d: today, due: now + IN.ultDays }; out.events.push({ kind: 'ult', side: s }); }
  }
  return out;
}

export type UltChoice = 'hand' | 'pay' | 'refuse';
export interface UltResult { choice: UltChoice; handed: Agent[] }
/** 최후통첩에 답한다(기한이 지나면 앱이 refuse 로 부른다). hand: 그 나라 섹터의 공작원(없으면 아무나 한 명)을 넘긴다 · pay: 배상금 · refuse: 그 나라와의 긴장이 크게 오른다. */
export function answerUlt(sv: IntelSave, side: NSide, choice: UltChoice, today: string, nobles: NobleRow[]): UltResult {
  const res: UltResult = { choice, handed: [] };
  delete sv.ult[side]; sv.ultCool[side] = dayOf(today) + IN.ultCool;
  if (choice === 'hand') {
    const sideIds = new Set(nobles.filter((n) => n.side === side).map((n) => n.id));
    let give = sv.agents.filter((a) => a.st !== 'lost' && a.at !== null && sideIds.has(a.at)).slice(0, 2);
    if (!give.length) give = sv.agents.filter((a) => a.st !== 'lost').slice(0, 1);
    for (const a of give) { a.st = 'lost'; a.at = null; sv.ops = sv.ops.filter((p) => p.agent !== a.id); }
    res.handed = give; sv.sus[side] = Math.min(sv.sus[side], 45);
  } else if (choice === 'pay') sv.sus[side] = Math.min(sv.sus[side], 55);
  else { sv.hostile[side] = clamp(sv.hostile[side] + IN.ultRefuse, 0, 100); sv.sus[side] = Math.min(sv.sus[side], 75); }
  sv.alert[side] = susStage(sv.sus[side]);
  return res;
}
export function pushReport(sv: IntelSave, r: IntelReport): void { sv.reports.push(r); if (sv.reports.length > IN.keepReports) sv.reports.splice(0, sv.reports.length - IN.keepReports); }
/** 정보망 수치에 따른 보고서 정확도 단계: 0 소문 · 1 대체로 확실 · 2 확실 */
export const accuracy = (net: number): 0 | 1 | 2 => (net >= 60 ? 2 : net >= 30 ? 1 : 0);

// ==================== 카드(2026-11-07) ====================
function shuffle<T>(a: T[], rnd: () => number): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** 새 카드를 버린 더미에 넣는다(다음에 섞일 때 덱으로). 덱 상한을 넘으면 넣지 않는다. */
export function addCard(sv: IntelSave, k: CardKind, extra: Partial<Card> = {}): Card | null {
  if (deckSize(sv) >= CK.deckMax && CARD[k].type !== 'curse' && CARD[k].type !== 'weak') return null;
  const c: Card = { id: sv.nextId++, k, ...extra }; (sv.disc ??= []).push(c); return c;
}
export const deckSize = (sv: IntelSave): number => (sv.deck?.length ?? 0) + (sv.hand?.length ?? 0) + (sv.disc?.length ?? 0);
export function startDeck(sv: IntelSave, rnd: () => number): void {
  sv.deck = []; sv.hand = []; sv.disc = [];
  for (const [k, n] of CK.startDeck) for (let i = 0; i < n; i++) sv.deck.push({ id: sv.nextId++, k });
  shuffle(sv.deck, rnd);
}
function drawOne(sv: IntelSave, rnd: () => number): Card | null {
  if (!sv.deck.length) { if (!sv.disc.length) return null; sv.deck = shuffle(sv.disc, rnd); sv.disc = []; }
  const c = sv.deck.pop()!; sv.hand.push(c); return c;
}
/** 첩보력 충전량(연례 회의) — 설계 2절 */
export function ipGain(sv: IntelSave): number {
  const active = sv.agents.filter((a) => a.st !== 'lost').length, watch = sv.hand.filter((c) => c.k === 'watch').length;
  return Math.max(0, CK.ipBase + clamp(sv.budget, 0, 3) * 2 + active - watch * CK.watchCut);
}
export interface Meeting { year: number; gain: number; drawn: Card[]; dropped: Card[] }
/** 연례 정보 회의: 새해(또는 첫 보고)면 첩보력 충전·뽑기. 같은 해에는 한 번만. */
export function meetingTick(sv: IntelSave, today: string, rnd: () => number = Math.random): Meeting | null {
  const m = /^(\d+)\./.exec(today || ''); if (!m) return null;
  const year = Number(m[1]); if (year <= sv.meet) return null;
  sv.meet = year;
  const gain = ipGain(sv);
  sv.ip = Math.min(CK.ipMax, Math.min(sv.ip, CK.carry) + gain);
  const drawn: Card[] = []; for (let i = 0; i < CK.draw; i++) { const c = drawOne(sv, rnd); if (!c) break; drawn.push(c); }
  const dropped: Card[] = []; while (sv.hand.length > CK.handMax) { const c = sv.hand.shift()!; sv.disc.push(c); dropped.push(c); }
  if (sv.rewards > 0 && !sv.offer.length) sv.offer = rollOffer(rnd, sv);
  sv.won = {}; // 보상 무게는 한 해 단위
  return { year, gain, drawn, dropped };
}
/** 보상 3장(2026-11-08): 올해 성공한 작전과 같은 종류가 더 잘 나오고(×2.5), 큰 공작(특수)은 드물게(×0.35 — 올해 큰 공작에 성공했으면 ×1). 같은 카드는 한 번만. */
export function rollOffer(rnd: () => number, sv?: IntelSave): CardKind[] {
  const won = sv?.won ?? {}, pool = [...CK.buyable], out: CardKind[] = [];
  const w = (k: CardKind) => { const t = CARD[k].type; return (won[t] ? 2.5 : 1) * (t === 'grand' && !won.grand ? 0.35 : 1); };
  while (out.length < 3 && pool.length) { const tot = pool.reduce((a, k) => a + w(k), 0); let r = rnd() * tot, i = 0; for (; i < pool.length - 1; i++) { r -= w(pool[i]); if (r <= 0) break; } out.push(pool[i]); pool.splice(i, 1); }
  return out;
}
/** 보상 고르기(i = 0~2) 또는 건너뛰기(i = -1). 보상이 남았으면 다음 3장을 바로 연다. */
export function takeOffer(sv: IntelSave, i: number, rnd: () => number = Math.random): CardKind | null {
  if (!sv.offer.length || sv.rewards <= 0) { sv.offer = []; return null; }
  const k = i >= 0 ? sv.offer[i] : undefined; if (k) addCard(sv, k);
  sv.rewards--; sv.offer = sv.rewards > 0 ? rollOffer(rnd, sv) : [];
  return k ?? null;
}
/** 카드 비용(약점 카드가 손에 있으면 그 귀족 협박 −1) */
export function cardCost(sv: IntelSave, c: Card, target?: number): number {
  let v = CARD[c.k].cost;
  if (c.k === 'blackmail' && target !== undefined && sv.hand.some((x) => x.k === 'weak' && x.t === target)) v = Math.max(0, v - 1);
  return v;
}
export type PlayWhy = StartWhy | 'nocard' | 'ip' | 'unplayable' | 'support' | 'nosector';
export interface PlayReq { card: number; agent?: number; support?: number; with?: number }
/** 카드를 낼 수 있나(공작 카드는 공작원이 있는 섹터에, 저주 카드는 그냥 내서 지움, 연줄 심기는 공작원 섹터 정보망). */
export function canPlay(sv: IntelSave, req: PlayReq, info: { loyal?: number; core?: boolean; gone?: boolean; side?: NSide; now?: number } = {}): PlayWhy {
  const c = sv.hand.find((x) => x.id === req.card); if (!c) return 'nocard';
  const def = CARD[c.k]; if (def.type === 'weak' || def.type === 'support' || def.type === 'counter') return 'unplayable'; // 방첩 카드는 적 공작에만(playCounter)
  const sup = req.support !== undefined ? sv.hand.find((x) => x.id === req.support) : undefined;
  if (req.support !== undefined && (!sup || !isSupport(sup.k) || !isOpCard(c.k))) return 'support';
  const a = req.agent !== undefined ? sv.agents.find((x) => x.id === req.agent) : undefined;
  let cost = cardCost(sv, c, a?.at ?? undefined) + (sup ? CARD[sup.k].cost : 0);
  if (def.type === 'curse') return sv.ip >= cost ? '' : 'ip';
  if (!a || a.at === null) return 'nosector';
  if (c.k === 'plant' || c.k === 'scout') return a.st === 'lost' ? 'agent' : info.gone ? 'gone' : sv.ip >= cost ? '' : 'ip';
  const why = canStart(sv, c.k as OpKind, a.at, a.id, info); if (why) return why;
  return sv.ip >= cost ? '' : 'ip';
}
/** 카드를 낸다(검사는 canPlay 로 먼저). 작전 카드면 작전을 만들어 돌려준다. 성공률·발각률은 부른 쪽이 보조 카드 보정 전 값을 준다. */
export function playCard(sv: IntelSave, req: PlayReq, today: string, base: { chance: number; risk: number; side?: NSide; core?: boolean } = { chance: 50, risk: 10 }, rnd: () => number = Math.random): { card: Card; op?: Op; planted?: number; scouted?: CardKind | null } {
  const c = sv.hand.find((x) => x.id === req.card)!; const sup = req.support !== undefined ? sv.hand.find((x) => x.id === req.support) : undefined;
  const a = req.agent !== undefined ? sv.agents.find((x) => x.id === req.agent) : undefined;
  sv.ip -= cardCost(sv, c, a?.at ?? undefined) + (sup ? CARD[sup.k].cost : 0);
  sv.hand = sv.hand.filter((x) => x.id !== c.id && x.id !== sup?.id);
  if (CARD[c.k].type === 'curse') return { card: c };                                   // 저주 카드는 내면 사라진다
  if (!JOB_OF[c.k as OpKind]) sv.disc.push(c); // 내부자 카드는 한 번 쓰면 사라진다(2026-11-08 — 덱이 막히지 않게)
  if (sup) sv.disc.push(sup);
  if (c.k === 'scout') { const k = scoutRoll(!!c.plus, rnd); if (k) sv.hand.push({ id: sv.nextId++, k }); return { card: c, scouted: k }; }
  if (c.k === 'plant' && a && a.at !== null) { const k = String(a.at); sv.net[k] = clamp((sv.net[k] ?? 0) + CK.plantNet, 0, 100); if (base.core && base.side) { const cn = (sv.cnet ??= { a: 0, b: 0 }); cn[base.side] = clamp(cn[base.side] + CEN.plantCore, 0, 100); } return { card: c, planted: a.at }; }
  const kind = c.k as OpKind, plus = !!c.plus;
  let chance = base.chance, risk = base.risk, days = OPS[kind].days, esc: true | undefined;
  if (sup?.k === 'forge') chance += CK.forgeChance + (sup.plus ? 10 : 0);
  if (sup?.k === 'lurk') risk -= CK.lurkRisk;
  if (sup?.k === 'escape') esc = true;
  if (sup?.k === 'rush') days = Math.ceil(days / 2);
  if (plus && JOB_OF[kind]) { chance += PLUS.insChance; risk -= PLUS.insRisk; } // 강화 카드(2026-11-08)
  if (plus && kind === 'assassinate') risk -= PLUS.assnRisk;
  const op: Op = { id: sv.nextId++, kind, target: a!.at!, agent: a!.id, start: today, days, chance: Math.round(clamp(chance, 5, 95)), risk: Math.round(clamp(risk, 2, 80)), ...(req.with !== undefined ? { with: req.with } : {}), ...(esc ? { esc } : {}), ...(plus ? { plus: true as const } : {}) };
  sv.ops.push(op); a!.st = 'op';
  return { card: c, op };
}
/** 상점: 카드 사기(에너지는 부른 쪽이 냄) · 지우기 · 강화(같은 카드 두 장 → +카드 한 장) */
export function buyCard(sv: IntelSave, k: CardKind): Card | null { return CK.buyable.includes(k) ? addCard(sv, k) : null; }
export function removeCard(sv: IntelSave, id: number): boolean {
  if (deckSize(sv) <= CK.deckMin) return false;
  for (const pile of [sv.deck, sv.hand, sv.disc]) { const i = pile.findIndex((c) => c.id === id); if (i >= 0) { if (pile[i].k === 'weak') return false; pile.splice(i, 1); return true; } }
  return false;
}
export function upgradeCard(sv: IntelSave, k: CardKind): Card | null {
  if (!CK.upgradable.includes(k)) return null;
  const all = [...sv.deck, ...sv.hand, ...sv.disc].filter((c) => c.k === k && !c.plus); if (all.length < 2) return null;
  const [x, y] = all; for (const pile of [sv.deck, sv.hand, sv.disc]) for (const id of [x.id, y.id]) { const i = pile.findIndex((c) => c.id === id); if (i >= 0) pile.splice(i, 1); }
  const c: Card = { id: sv.nextId++, k, plus: true }; sv.disc.push(c); return c;
}

/** 반년 번호(1~6월 = 짝, 7~12월 = 홀) */
export function halfOf(today: string): number { const m = /^(\d+)\.(\d+)/.exec(today || ''); return m ? Number(m[1]) * 2 + (Number(m[2]) >= 7 ? 1 : 0) : 0; }
/** 상점 진열을 새로 깐다. 같은 카드는 한 번만, 희귀할수록 드물게. */
export function rollShop(sv: IntelSave, h: number, rnd: () => number = Math.random, keepRr = false): Shop {
  const pick = <T extends string>(keys: T[], rar: (k: T) => Rarity, taken: Set<string>): T | null => {
    const pool = keys.filter((k) => !taken.has(k)); if (!pool.length) return null;
    const tot = pool.reduce((a, k) => a + SHOP.rarW[rar(k)], 0); let r = rnd() * tot;
    for (const k of pool) { r -= SHOP.rarW[rar(k)]; if (r <= 0) return k; } return pool[pool.length - 1];
  };
  const taken = new Set<string>(), slots: ShopSlot[] = [];
  for (let i = 0; i < SHOP.slots; i++) {
    const duel = rnd() < SHOP.duelShare;
    const k = duel ? pick(DCARD_KEYS as string[] as DCard[], (x) => DCARDS[x].rar as Rarity, taken) : pick(CK.buyable, cardRar, taken);
    if (!k) continue; taken.add(k);
    slots.push({ pool: duel ? 'duel' : 'op', k, price: duel ? dPrice(k as DCard) : CARD[k as CardKind].price ?? 0 });
  }
  if (slots.length && rnd() < SHOP.saleChance) { const x = slots[Math.floor(rnd() * slots.length)]; x.sale = true; x.price = Math.round(x.price * (1 - SHOP.saleCut) / 10) * 10; }
  sv.shop = { h, slots, rr: keepRr && sv.shop ? sv.shop.rr : 0 };
  return sv.shop;
}
export const rerollCost = (sv: IntelSave): number => SHOP.reroll + SHOP.rerollStep * (sv.shop?.rr ?? 0);
export function fixShop(o: unknown): Shop | undefined {
  const x = o as Shop; if (!x || !Array.isArray(x.slots)) return undefined;
  const slots = x.slots.filter((v) => v && (v.pool === 'op' ? (v.k in CARD && CK.buyable.includes(v.k as CardKind)) : v.pool === 'duel' && (DCARD_KEYS as string[]).includes(v.k))).slice(0, 12)
    .map((v) => ({ pool: v.pool, k: v.k, price: clamp(Math.round(Number(v.price) || 0), 0, 1e5), ...(v.sale ? { sale: true as const } : {}), ...(v.sold ? { sold: true as const } : {}) }));
  return { h: Math.round(Number(x.h) || 0), slots, rr: clamp(Math.round(Number(x.rr) || 0), 0, 99) };
}
