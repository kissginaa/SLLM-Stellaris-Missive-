// 접견실(시나리오 전용, 순수 규칙, 2026-11-06 사용자): 전체 화면 1:1 비밀회담 — 귀족 또는 두 거대 세력의 군주.
// 밀사: 대화 중에 플레이어가 「밀사 왕래를 허락해 달라」고 꺼내면 귀족이 답한다. 판정은 앱이(말솜씨는 조금만 보탬).
// 고발(사용자: 「우리가 말로 전달하는 형식 — 다른 군주나 충성도 높은 귀족에게 말하면 고발이 자동으로」):
//   · 충성 높은 귀족(70 이상)에게 밀사를 청하면 → 군주에게 보고(우리 공작이 들통)
//   · 군주에게 밀사 이야기를 꺼내면 → 들통
//   · 군주나 충성 높은 귀족에게 「○○가 딴마음을 품었다」고 말하면 → ○○ 고발(사실이면 통로가 끊기고 그 귀족이 의심받음, 거짓이면 모함)
// LLM 은 대사와 함께 「플레이어가 무엇을 말했는가」 표식만 낸다(밀사 요청 · 지목한 귀족). 결과는 수치로 정한다.
// 앱: src/features/scenario-audience-app.ts · 화면: ui/audience.html · 게임 반응: 시나리오 모드 sllm_cr_au_op(호감 수정자)
import type { NobleRow, NobleSave, NSide, BondRow } from './scenario-nobles';
import { pairKey, rulerOf, bondVisible, loyalStage, LOYAL_STAGE, intimacyStage, TRAIT_NAME, BOND_NAME, BOND_PUBLIC, type BondKind } from './scenario-nobles';
import { factionBrief, courtBrief, factionOf, leaderOf } from './scenario-factions';

export type AuTarget = { kind: 'noble'; id: number } | { kind: 'ruler'; side: NSide };
export interface AuTurn { who: 'me' | 'them' | 'sys'; text: string; d: string }
export interface AuSave {
  v: 1;
  hist: Record<string, AuTurn[]>;      // 상대별 지난 대화(짧게)
  met: Record<string, string>;          // 상대별 마지막 회담 날짜
  ch: Record<string, string>;           // 열린 밀사 통로(귀족 번호 → 연 날짜)
  sus: Record<string, string>;          // 군주가 의심하는 귀족(귀족 번호 → 날짜)
  intro: Record<string, string>;        // 소개로 알게 된 귀족(귀족 번호 → 날짜, 2026-11-07)
  turns: number;                        // 지금 회담에서 오간 말 수
  now: string;                          // 지금 회담 상대(targetKey, 없으면 '')
  log: Array<{ d: string; ko: string; en: string }>;
  pact?: Record<string, string>;        // 귀족과 맺은 사사로운 서약(귀족 번호 → 날짜) — 서약한 귀족은 우리 이야기를 군주에게 고하지 않는다(2026-11-08)
  cnY?: Record<string, Record<string, number>>; // 회랑의 귀족 접견에서 한 해 한 번만 되는 일(지도자 번호 → 종류 → 해)
  love?: Record<string, LoveRec>;       // 플레이어 통치자와 귀족의 연애(귀족 번호 → 단계, 2026-11-08)
  given?: Record<string, string>;       // 이미 건넨 기밀 문서(문서 열쇠 → 날짜, 2026-11-08)
  heart?: Record<string, number>;       // 연애 호감(귀족 번호 → 0~100, 화면에 보이지 않음). 비서 호감과 같은 난이도(2026-11-08 사용자)
}
// ---- 연애(2026-11-08 사용자: 「귀족과 플레이어 통치자 사이의 연애 — 데이트 신청도 숨은 대화 카드에」) ----
// 숨은 카드라 화면에 단추는 없다. 대화에서 데이트를 청하거나 · 마음을 고백하거나 · 관계를 공개하자거나 · 청혼하면 LLM 이 알아채고 앱이 수치로 정한다.
// 단계: 1 설렘(데이트 상대) → 2 비밀 연인 → 3 공개 연인 → 4 혼약. 연인은 우리 이야기를 군주에게 고하지 않고, 귀순 문턱이 낮아진다.
// 대가: 공개하면 그 귀족은 자기 군주와 멀어지고(충성·군주 친밀 하락), 혼약 상대가 있던 귀족이면 그 배우자가 등을 돌린다. 비밀 데이트는 남의 눈(식당)에 들키기도 한다.
export type LoveSt = 1 | 2 | 3 | 4;
export interface LoveRec { st: LoveSt; d: string; n: number }   // n = 데이트 횟수
export const LOVE_NAME: Record<LoveSt, [string, string]> = { 1: ['설렘', 'Courting'], 2: ['비밀 연인', 'Secret lovers'], 3: ['공개 연인', 'Open lovers'], 4: ['혼약', 'Betrothed'] };
// 연애 호감(heart)은 정치 친밀도와 따로, 비서 호감과 같은 난이도(2026-11-08 사용자: 「비서와 같은 난이도로, 물론 안 보이게」):
//   한 마디에 −2~2 → ×2, 한 접견에서 ±8 까지(비서 STEP_CAP·TALK_CAP). 데이트 45 · 연인(고백·공개) 75 · 청혼 90(비서 AFF_FOND·CONFESS·PROPOSE).
export const LOVE = {
  dateHeart: 45, loverHeart: 75, publicHeart: 75, marryHeart: 90,          // 문턱(연애 호감)
  stepCap: 2, talkCap: 8, dateGain: 4,                                      // 한 마디 · 한 접견 한도 · 데이트를 함께하면 오르는 호감
  dateBonus: 6, loverBonus: 8, wedBonus: 10, coldRel: -3, wedRefuseRel: -6, noRel: -2,
  publicRulerRel: -15, publicLoyal: -8, marryLoyal: -12, spouseRel: -40,      // 공개 · 혼약의 대가
  gossip: 0.3, gossipRulerRel: -8,                                              // 식당 데이트가 소문이 날 확률 · 그때 군주와의 친밀
  defectLoyalBonus: 15,                                                         // 연인은 귀순 문턱(충성)이 그만큼 높다
};
export type LoveAct = 'date' | 'confess' | 'public' | 'marry';
export const AU = { nobleRest: 60, rulerRest: 180, /* 군주는 6개월에 한 번(2026-11-08 사용자) */ keepHist: 16, loyalReport: 70, acceptAt: 30, keepLog: 80, introMax: 2, introFriend: 10, introSecret: 40, introFaction: 0, introBonus: 10, introFacBonus: 5 };
/** 숨은 대화 카드(2026-11-08 사용자: 「접견 대화가 의미가 있었으면 — 소개해 달라면 소개해 주는 것처럼. 카드로 띄우지 말고 그냥 잠재적으로 있는 것」).
 *  화면에는 아무것도 없다. 플레이어가 대화에서 그 이야기를 꺼내면 LLM 이 알아채고, 결과는 앱이 수치로 정한다. */
export const AUX = {
  infoRel: 20, infoLoyal: 50,              // 정보 캐묻기: 우리와 친하거나(친밀 20) 군주에게 시큰둥하면(충성 50 아래) 털어놓는다
  gift: 200, giftRel: 8,                    // 선물: 에너지 200 → 친밀 +8(명예로운 귀족은 뇌물로 보고 거절, 친밀 −3)
  defectLoyal: 35, defectRel: 25,           // 귀순 권유: 충성 35 아래 · 친밀 25 이상이면 회랑으로 넘어오기로
  revoltLoyal: 25, revoltRel: 15,           // 반란 부추기기: 충성 25 아래 · 친밀 15 이상이면 칼을 뽑는다(수도 섹터 거점은 안 됨)
  pactRel: 30, pactBonus: 5,                // 사사로운 서약: 친밀 30 이상 → 우리 이야기를 군주에게 고하지 않음
  cnReward: 300, cnRewardLoyal: 6, cnOath: 4, cnTax: 400, cnTaxLoyal: -8, // 우리 귀족: 포상 · 충성 맹세 · 세금 더 걷기(한 해 한 번씩)
};
export const newAuSave = (): AuSave => ({ v: 1, hist: {}, met: {}, ch: {}, sus: {}, intro: {}, turns: 0, now: '', log: [] });
export function fixAuSave(o: unknown): AuSave {
  const s = (o && typeof o === 'object' ? o : {}) as Partial<AuSave>, out = newAuSave();
  const strMap = (x: unknown) => { const r: Record<string, string> = {}; if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (typeof v === 'string') r[k] = v.slice(0, 20); return r; };
  out.met = strMap(s.met); out.ch = strMap(s.ch); out.sus = strMap(s.sus); out.intro = strMap(s.intro);
  if (s.hist && typeof s.hist === 'object') for (const [k, v] of Object.entries(s.hist)) if (Array.isArray(v)) out.hist[k] = v.filter((t) => t && typeof t.text === 'string' && ['me', 'them', 'sys'].includes(t.who)).map((t) => ({ who: t.who, text: String(t.text).slice(0, 1200), d: String(t.d || '') })).slice(-AU.keepHist);
  out.turns = Math.max(0, Math.round(Number(s.turns) || 0)); out.now = typeof s.now === 'string' ? s.now.slice(0, 20) : '';
  if (Array.isArray(s.log)) out.log = s.log.filter((l) => l && typeof l.ko === 'string' && typeof l.en === 'string').slice(-AU.keepLog);
  const pact = strMap(s.pact); if (Object.keys(pact).length) out.pact = pact;
  const given = strMap(s.given); if (Object.keys(given).length) out.given = given;
  if (s.heart && typeof s.heart === 'object') for (const [k, v] of Object.entries(s.heart)) { const n = Number(v); if (Number.isInteger(Number(k)) && Number.isFinite(n)) (out.heart ??= {})[k] = Math.max(0, Math.min(100, Math.round(n))); }
  if (s.love && typeof s.love === 'object') for (const [k, v] of Object.entries(s.love)) { const st = Number((v as LoveRec)?.st); if (Number.isInteger(Number(k)) && st >= 1 && st <= 4) (out.love ??= {})[k] = { st: st as LoveSt, d: String((v as LoveRec).d ?? '').slice(0, 20), n: Math.max(0, Math.round(Number((v as LoveRec).n) || 0)) }; }
  if (s.cnY && typeof s.cnY === 'object') for (const [k, v] of Object.entries(s.cnY)) if (v && typeof v === 'object') { const m: Record<string, number> = {}; for (const [a, b] of Object.entries(v)) if (Number.isFinite(Number(b))) m[a] = Math.round(Number(b)); (out.cnY ??= {})[k] = m; }
  return out;
}
export const targetKey = (t: AuTarget): string => (t.kind === 'noble' ? `n${t.id}` : `r${t.side}`);
export function parseTarget(x: unknown): AuTarget | null {
  const o = (x && typeof x === 'object' ? x : {}) as { kind?: unknown; id?: unknown; side?: unknown };
  if (o.kind === 'noble' && Number.isInteger(Number(o.id))) return { kind: 'noble', id: Number(o.id) };
  if (o.kind === 'ruler' && (o.side === 'a' || o.side === 'b')) return { kind: 'ruler', side: o.side };
  return null;
}
export function dayOf(d: string): number { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : 0; }
/** 다시 만날 수 있기까지 남은 날(0 이면 지금 가능). 귀족 두 달 · 군주 여섯 달에 한 번. */
export function restLeft(sv: AuSave, t: AuTarget, today: string): number {
  const m = sv.met[targetKey(t)]; if (!m) return 0; const left = dayOf(m) + (t.kind === 'noble' ? AU.nobleRest : AU.rulerRest) - dayOf(today); return left > 0 ? left : 0;
}


// ---- 소개(2026-11-07 사용자: 「모르는 가문 인물을 소개로 알게 — 친한 사람끼리(관계도), 또는 가문 대표가」) ----
// 누가 소개해 줄 수 있나: 말하는 귀족과 서약·혼약·협약·비밀 회선으로 묶였거나 서로 우호(20) 이상인 사람, 또는 그 귀족이 세력 대표면 같은 세력 구성원.
// 기꺼이 해 주나: 플레이어에 대한 친밀도(말솜씨 warmth 가 조금 보탬)가 문턱을 넘어야 — 친구는 우호, 비밀 인연은 신뢰, 대표가 구성원을 소개할 때는 접촉이면 된다.
export type IntroVia = 'bond' | 'friend' | 'faction';
export interface IntroCand { id: number; via: IntroVia; bond?: BondKind; need: number }
export function introCands(ns: NobleSave, nobles: NobleRow[], bonds: BondRow[], known: Set<number>, speaker: number): IntroCand[] {
  const n = nobles.find((x) => x.id === speaker); if (!n) return [];
  const out = new Map<number, IntroCand>(), gone = (id: number) => !!ns.fate[id] || !!ns.pending[id];
  const put = (c: IntroCand) => { const o = out.get(c.id); if (!o || c.need < o.need) out.set(c.id, c); };
  const rival = new Set<number>();
  for (const [k, a, b] of bonds) {
    if (a !== speaker && b !== speaker) continue; const o = a === speaker ? b : a;
    if (k === 'rival') { rival.add(o); continue; }
    if (known.has(o) || gone(o)) continue;
    put({ id: o, via: 'bond', bond: k, need: BOND_PUBLIC[k] ? AU.introFriend : AU.introSecret });
  }
  for (const m of nobles) {
    if (m.id === speaker || known.has(m.id) || gone(m.id) || rival.has(m.id)) continue;
    if ((ns.rel[pairKey(speaker, m.id)] ?? 0) >= 20) put({ id: m.id, via: 'friend', need: AU.introFriend });
  }
  const ld = leaderOf(ns, nobles, n.side, factionOf(n));
  if (ld && ld.id === speaker) for (const m of nobles) {
    if (m.side !== n.side || factionOf(m) !== factionOf(n) || m.id === speaker || known.has(m.id) || gone(m.id) || rival.has(m.id)) continue;
    put({ id: m.id, via: 'faction', need: AU.introFaction });
  }
  return [...out.values()].sort((x, y) => x.need - y.need || x.id - y.id);
}
/** 지금 기꺼이 소개해 주는가(플레이어에 대한 친밀도 + 말솜씨). */
export const introWilling = (ns: NobleSave, speaker: number, c: IntroCand, warmth: number): boolean => (ns.rel[pairKey(speaker, 'P')] ?? 0) + warmth * 5 >= c.need;
function introBrief(ns: NobleSave, nobles: NobleRow[], speaker: number, cands: IntroCand[]): string {
  if (!cands.length) return ' There is no one the player has not met yet whom you could introduce.';
  const by = new Map(nobles.map((x) => [x.id, x] as [number, NobleRow]));
  const tag = (c: IntroCand) => (c.via === 'bond' ? `your ${BOND_NAME[c.bond as BondKind][1]} partner${BOND_PUBLIC[c.bond as BondKind] ? '' : ' (a secret tie)'}` : c.via === 'faction' ? 'a member of the faction you lead' : 'a friend of yours');
  const row = (c: IntroCand) => `#${c.id} ${by.get(c.id)?.en ?? '?'} (${tag(c)})`;
  const yes = cands.filter((c) => introWilling(ns, speaker, c, 0)), no = cands.filter((c) => !introWilling(ns, speaker, c, 0));
  return ' People the player has not met yet whom you know well enough to introduce:'
    + (yes.length ? ` you would introduce ${yes.map(row).join('; ')}` : '')
    + (yes.length && no.length ? ';' : '')
    + (no.length ? ` you do not yet trust the player enough to introduce ${no.map(row).join('; ')} (be evasive unless the player wins you over)` : '') + '.';
}

/** 이 귀족의 혼약 상대(살아 있는 혼약 인연, 없으면 null). extra: 회랑의 귀족과 맺은 혼인처럼 표 밖의 혼약이 있는 귀족 번호. */
export function spouseOf(ns: NobleSave, bonds: BondRow[], id: number): number | null {
  for (const [k, a, b] of bonds) if (k === 'union' && (a === id || b === id)) { const o = a === id ? b : a; if (!ns.fate[String(o)] && !ns.fate[o]) return o; }
  return null;
}
export const loveOf = (sv: AuSave, id: number): LoveRec | undefined => sv.love?.[String(id)];
export const heartOf = (sv: AuSave, id: number): number => sv.heart?.[String(id)] ?? 0;
/** 한 마디의 마음 움직임(−2~2)을 연애 호감에 반영. moved = 이번 접견에서 이미 움직인 양(±talkCap 까지). 새 moved 를 돌려준다. */
export function applyHeart(sv: AuSave, id: number, move: number, moved: number): number {
  let d = Math.max(-LOVE.stepCap, Math.min(LOVE.stepCap, Math.round(move) || 0)) * 2;
  if (moved + d > LOVE.talkCap) d = Math.max(0, LOVE.talkCap - moved); if (moved + d < -LOVE.talkCap) d = Math.min(0, -LOVE.talkCap - moved);
  if (d) (sv.heart ??= {})[String(id)] = Math.max(0, Math.min(100, heartOf(sv, id) + d));
  return moved + d;
}
const HEART_WORD = (v: number): string => (v >= 90 ? 'devoted — you are deeply in love with the player' : v >= 75 ? 'in love with the player' : v >= 45 ? 'fond of the player; your heart quickens around them' : v >= 20 ? 'warmly interested in the player as a person' : 'no romantic feeling for the player yet');
/** 플레이어가 이미 혼약한 귀족(한 사람뿐). */
export const wedTo = (sv: AuSave): number | null => { for (const [k, v] of Object.entries(sv.love ?? {})) if (v.st === 4) return Number(k); return null; };
function loveBrief(sv: AuSave, ns: NobleSave, n: NobleRow, bonds: BondRow[], nobles: NobleRow[], wedCn: boolean): string {
  const lv = loveOf(sv, n.id), ht = heartOf(sv, n.id), sp = spouseOf(ns, bonds, n.id), other = wedTo(sv);
  const spName = sp !== null ? nobles.find((x) => x.id === sp)?.en ?? 'someone' : '';
  const now = !lv ? 'none — the player has never courted you' : lv.st === 1 ? `courting — you have gone on ${lv.n} date(s) with the player` : lv.st === 2 ? 'secret lovers — no one else knows' : lv.st === 3 ? 'open lovers — the whole court knows' : 'betrothed to the player';
  const out = [`Your romantic relationship with the player: ${now}. Your heart: ${HEART_WORD(ht)} (never state it as a number).${sp !== null ? ` You are bound in a marriage pact (Union) with ${spName}.` : ''}${wedCn ? ' Your house is already tied by marriage to a Corridor noble.' : ''}`,
    'Romance — your real stance if the player raises it (match your line to it):'];
  out.push(sp !== null && n.tr[0] >= 1 ? '- Asked on a date: you refuse; you are bound to your spouse and honor forbids it.' : lv || ht >= LOVE.dateHeart ? `- Asked on a date: you accept${sp !== null ? ' (discreetly — you are married)' : ''}.` : '- Asked on a date: you decline politely; your heart is not there yet.');
  out.push(lv?.st && lv.st >= 2 ? '- Love confessed: you already are lovers.' : ht >= LOVE.loverHeart ? '- Love confessed / asked to be lovers: you return the feeling.' : '- Love confessed: it is too soon; you are flattered but not ready.');
  out.push(lv?.st === 2 ? (ht >= LOVE.publicHeart ? '- Asked to go public: you agree, knowing your sovereign will be displeased.' : '- Asked to go public: you are afraid of what your sovereign will say; not yet.') : '- Asked to go public: only meaningful once you are secret lovers.');
  out.push(lv?.st === 3 ? (ht >= LOVE.marryHeart && sp === null && (other === null || other === n.id) ? '- Proposed marriage: you say yes.' : '- Proposed marriage: you cannot accept now.') : lv?.st === 4 ? '- You are already betrothed to the player.' : '- Proposed marriage: far too soon.');
  return out.join('\n');
}

// ---- LLM 프롬프트 ----
const SIDE_DESC: Record<NSide, string> = {
  a: 'the Galactic Alliance — a liberal, idealistic interstellar republic of many species that sees itself as a beacon of liberty',
  b: 'the Human Empire — a stern, authoritarian human police state built on order, hierarchy and slave guilds',
};
export interface AuCtx { player: string; sideName: Record<NSide, string>; tension: string; nobles: NobleRow[]; bonds: BondRow[]; known: Set<number>; wedCn?: Set<number> }
function nobleBrief(ns: NobleSave, n: NobleRow, bonds: BondRow[], nobles: NobleRow[], sv: AuSave): string {
  const tr = n.tr.map((v, i) => (v ? `${TRAIT_NAME[i][v > 0 ? 0 : 1][1]}${Math.abs(v) === 2 ? ' (strongly)' : ''}` : '')).filter(Boolean).join(', ') || 'balanced';
  const by = new Map(nobles.map((x) => [x.id, x] as [number, NobleRow]));
  const ties = bonds.filter(([, a, b]) => a === n.id || b === n.id).map(([k, a, b]) => `${BOND_NAME[k][1]} with ${by.get(a === n.id ? b : a)?.en ?? '?'}`).join('; ') || 'none';
  const lv = ns.loyal[n.id] ?? 100;
  const ruler = intimacyStage(ns.rel[pairKey(n.id, rulerOf(n.side))] ?? 0)[1], me = intimacyStage(ns.rel[pairKey(n.id, 'P')] ?? 0)[1];
  const exr = !!ns.fate[String(n.id)]; // 반란국 군주(2026-11-08)
  return `${n.en} (${n.ko}), ${exr ? 'formerly' : ''} hereditary governor of a ${n.spec} hub sector of ${n.side === 'a' ? 'the Galactic Alliance' : 'the Human Empire'}${exr ? ', who rose in revolt and now rules a breakaway realm' : ''}. Personality: ${tr}. ${exr ? 'Loyalty to the former realm: none — they are at war with it.' : `True loyalty to own realm: ${LOYAL_STAGE[loyalStage(lv)][1]} (${lv}/100).`} Feeling toward own ruler: ${ruler}; toward the player: ${me}. Personal ties: ${ties}.${sv.ch[String(n.id)] ? ' A secret envoy channel with the player is already open.' : ''}${sv.sus[String(n.id)] ? ' Their ruler currently suspects them of disloyalty.' : ''}${factionBrief(ns, nobles, n)}`;
}
/** 밀사 제안을 받았을 때 이 인물이 실제로 어떻게 할지 — judge() 와 같은 기준을 미리 알려 대사가 판정과 맞게. */
function envoyStance(ns: NobleSave, sv: AuSave, t: AuTarget, nobles: NobleRow[]): string {
  if (t.kind === 'ruler') return 'If the player proposes secret envoys with your subjects or schemes against you, you treat it as an affront and say so.';
  if (sv.ch[String(t.id)]) return 'You already keep a secret envoy channel with the player; you may speak of it guardedly.';
  const n = nobles.find((x) => x.id === t.id); if (!n) return '';
  if (ns.fate[String(n.id)]) return 'You now rule your own breakaway realm. A standing channel with the Corridor is ordinary diplomacy for you, not treason; weigh it as a head of state would.';
  if ((ns.loyal[n.id] ?? 100) >= AU.loyalReport) return 'IMPORTANT — your true stance on secret contact: you are loyal to your ruler. If the player proposes secret envoys, hidden correspondence, a private channel or a plot against your ruler, you do NOT entertain it: refuse plainly (politely or coldly, as your character would) and make clear that your sovereign will hear of this. Never sound tempted, never say you will wait for their envoy, never accept contact details. You may still be courteous about ordinary matters.';
  return 'If the player proposes secret envoys, you are tempted but wary: do not give a definite yes or no — be guarded, curious or bargaining as your character would. The game decides whether a channel opens.';
}
/** 숨은 카드에 대한 이 귀족의 실제 태도 — 판정(judge)과 같은 기준을 미리 알려 대사가 결과와 맞게(2026-11-08). */
function hiddenStance(ns: NobleSave, sv: AuSave, id: number, nobles: NobleRow[]): string {
  const n = nobles.find((x) => x.id === id); if (!n) return '';
  const lv = ns.loyal[n.id] ?? 100, rel = ns.rel[pairKey(n.id, 'P')] ?? 0, rebel = !!ns.fate[String(n.id)];
  const out: string[] = ['Your real stance if the player raises these (match your line to it):'];
  out.push(rel >= AUX.infoRel || lv < AUX.infoLoyal || sv.ch[String(n.id)] ? '- Asked about another noble: you share what you know.' : '- Asked about another noble: you deflect; you do not gossip about peers to a foreigner.');
  out.push(n.tr[0] >= 1 ? '- Offered a gift or money: you take it as a bribe and refuse, offended.' : '- Offered a gift: you accept it graciously.');
  out.push(rebel ? '- Invited to join the Corridor or revolt: you already rule your own realm; talk as an equal.' : lv < AUX.defectLoyal && rel >= AUX.defectRel ? '- Invited to join the Corridor: you are ready to accept.' : lv >= AU.loyalReport && !sv.pact?.[String(n.id)] ? '- Invited to join the Corridor or revolt: you refuse coldly; your sovereign will hear of it.' : '- Invited to join the Corridor: you are not ready; refuse but keep the door ajar.');
  if (!rebel) out.push(lv < AUX.revoltLoyal && rel >= AUX.revoltRel ? '- Urged to revolt: you are ready to draw the sword.' : '- Urged to revolt: not now.');
  out.push(sv.pact?.[String(n.id)] ? '- You already keep a private pledge with the player.' : rel >= AUX.pactRel ? '- Proposed a private pledge: you agree.' : '- Proposed a private pledge: you do not trust them that far yet.');
  return out.join('\n');
}
/** 회담 한 번의 대사 요청. 답은 JSON 하나: say(대사) · asked_envoy · accused(지목한 귀족 번호) · warmth(-2~2). */
export function auMessages(c: AuCtx, ns: NobleSave, sv: AuSave, t: AuTarget, text: string): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const roster = c.nobles.map((n) => `#${n.id} ${n.en} / ${n.ko} (${n.side === 'a' ? 'Alliance' : 'Empire'})`).join('\n');
  const who = t.kind === 'noble'
    ? (() => { const n = c.nobles.find((x) => x.id === t.id); return n ? `You play this noble: ${nobleBrief(ns, n, c.bonds, c.nobles, sv)}${introBrief(ns, c.nobles, n.id, introCands(ns, c.nobles, c.bonds, c.known, n.id))}` : 'You play a noble.'; })()
    : `You play the sovereign of ${SIDE_DESC[t.side]} (empire name: ${c.sideName[t.side]}). You speak with full authority and expect your nobles' loyalty.${courtBrief(ns, c.nobles, t.side)}`;
  const sys = [
    'You write one character\'s lines in a private 1:1 meeting in the space strategy game "Stellaris" (scenario "The Corridor Triangle": two great powers, the Galactic Alliance and the Human Empire, separated by the small neutral Seren Corridor state, which the player rules).',
    who,
    `The player is the ruler of ${c.player} (the Corridor). Current rivalry between the great powers: ${c.tension || 'unknown'}.`,
    'Stay in character. Answer in 2–4 sentences of dialogue (the response language follows the language instruction below). No stage directions, no quotation marks. Do not invent game effects or promise things outside your power.',
    'A secret envoy channel means quietly exchanging envoys with the Corridor behind your ruler\'s back. You never agree to anything on the player\'s behalf; just react in character.',
    envoyStance(ns, sv, t, c.nobles), // 말과 판정이 어긋나지 않게(2026-11-08 사용자: 「긍정적으로 말했는데 왜 공작이 드러났다고?」)
    'Besides the line, report what the PLAYER said in their latest message:',
    '- asked_envoy: true only if the player asked to open or keep secret envoy contact / secret correspondence / a hidden channel with the person they are speaking to, or proposed a plot against that person\'s ruler.',
    '- accused: the roster numbers of nobles the player claimed are disloyal, conspiring, or in secret contact with a foreign power (empty if none). Use the roster below to map names.',
    '- asked_intro: true if the player asked you to introduce them to someone (a person, a member of your house or faction, a friend of yours) or to tell them who someone is.',
    '- introduce: roster numbers of people from your introduction list that you actually introduce or vouch for in THIS line (name them in the line). Only people from that list, and only if you are willing; empty otherwise. You may also offer an introduction yourself when it suits your character and the talk.',
    '- info_target / info_about: if the player asked you about ANOTHER noble\'s loyalty or hidden ties, that noble\'s roster number and "loyalty" or "ties"; otherwise null.',
    '- gift: true only if the player is giving you a gift, money or a bribe right now.',
    '- urged_defect: true if the player invited you to leave your realm and join the Corridor.',
    '- urged_revolt: true if the player urged you to rise in revolt against your ruler.',
    '- proposed_pact: true if the player proposed a private pledge between the two of you (mutual trust, not betraying each other, mutual aid).',
    t.kind === 'noble' ? hiddenStance(ns, sv, t.id, c.nobles) : '',
    t.kind === 'noble' ? '- heart: an integer −2..2 for how much the player\'s words this time moved your heart romantically (charm, tenderness, sincere admiration, courtship that suits your character are +; crude, condescending, cold or merely transactional words are −; ordinary politics is 0).' : '',
    t.kind === 'noble' ? '- romance: "date" if the player asked you out (a date, an evening together, a walk for two — romantically meant); "confess" if the player confessed love or asked you to become lovers; "public" if the player proposed making your relationship public; "marry" if the player proposed marriage or betrothal; otherwise null.' : '',
    (() => { if (t.kind !== 'noble') return ''; const n = c.nobles.find((x) => x.id === t.id); return n ? loveBrief(sv, ns, n, c.bonds, c.nobles, !!c.wedCn?.has(n.id)) : ''; })(),
    '- warmth: how much the player\'s words pleased you, integer −2..2 (insults, threats −2; flattery that fits your character, sincere respect +1..2).',
    'Reply with JSON only: {"say": "...", "asked_envoy": false, "accused": [], "asked_intro": false, "introduce": [], "info_target": null, "info_about": null, "gift": false, "urged_defect": false, "urged_revolt": false, "proposed_pact": false, "romance": null, "heart": 0, "warmth": 0}',
    'Roster of nobles:', roster,
  ].join('\n');
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: sys }];
  for (const h of (sv.hist[targetKey(t)] ?? []).slice(-AU.keepHist)) if (h.who !== 'sys') msgs.push({ role: h.who === 'me' ? 'user' : 'assistant', content: h.who === 'me' ? h.text : JSON.stringify({ say: h.text }) });
  msgs.push({ role: 'user', content: text });
  return msgs;
}
export interface AuReply { say: string; askedEnvoy: boolean; accused: number[]; warmth: number; askedIntro: boolean; introduce: number[]; infoT?: number; infoAbout?: 'loyalty' | 'ties'; gift?: boolean; defect?: boolean; revolt?: boolean; pact?: boolean; romance?: LoveAct; heart?: number }
export function parseAuReply(raw: string, ids: number[]): AuReply | null {
  const cleaned = String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let o: Record<string, unknown> | null = null;
  try { o = JSON.parse(cleaned); } catch { const m = /\{[\s\S]*\}/.exec(cleaned); if (m) { try { o = JSON.parse(m[0]); } catch { o = null; } } }
  if (!o || typeof o !== 'object') return null;
  const say = typeof o.say === 'string' ? o.say.replace(/\s+/g, ' ').trim().slice(0, 900) : '';
  if (!say) return null;
  const ok = new Set(ids), acc = Array.isArray(o.accused) ? [...new Set(o.accused.map((x) => Math.round(Number(x))).filter((x) => ok.has(x)))].slice(0, 4) : [];
  const intro = Array.isArray(o.introduce) ? [...new Set(o.introduce.map((x) => Math.round(Number(x))).filter((x) => ok.has(x)))].slice(0, 6) : [];
  const w = Math.round(Number(o.warmth)), it = Math.round(Number(o.info_target)), ia = o.info_about === 'loyalty' || o.info_about === 'ties' ? o.info_about : undefined;
  return { say, askedEnvoy: o.asked_envoy === true, accused: acc, warmth: Number.isFinite(w) ? Math.max(-2, Math.min(2, w)) : 0, askedIntro: o.asked_intro === true, introduce: intro,
    ...(ia && ok.has(it) ? { infoT: it, infoAbout: ia } : {}), ...(o.gift === true ? { gift: true } : {}), ...(o.urged_defect === true ? { defect: true } : {}), ...(o.urged_revolt === true ? { revolt: true } : {}), ...(o.proposed_pact === true ? { pact: true } : {}), ...(o.romance === 'date' || o.romance === 'confess' || o.romance === 'public' || o.romance === 'marry' ? { romance: o.romance } : {}), ...(Number.isFinite(Number(o.heart)) && Math.round(Number(o.heart)) ? { heart: Math.max(-2, Math.min(2, Math.round(Number(o.heart)))) } : {}) };
}

// ---- 결과 판정(수치로) ----
export type AuOutcome =
  | { k: 'envoy_open'; id: number }
  | { k: 'envoy_refused'; id: number }
  | { k: 'envoy_already'; id: number }
  | { k: 'reported'; side: NSide; by: number | 'ruler' }             // 우리 공작이 그 나라에 들통
  | { k: 'accuse_true'; id: number; to: number | 'ruler' }           // 고발이 사실: 통로 끊김, 귀족 의심받음
  | { k: 'accuse_false'; id: number; to: number | 'ruler'; caught: boolean } // 모함: 귀족 의심 + 들키면 우리 신뢰 하락
  | { k: 'rumor'; id: number; to: number }
  | { k: 'intro'; id: number; by: number; via: IntroVia; bond?: BondKind }      // 소개로 알게 됨
  | { k: 'intro_refused'; by: number }                                     // 소개할 사람은 있지만 아직 꺼린다
  | { k: 'intro_none'; by: number }
  | { k: 'info_loyal'; by: number; id: number } | { k: 'info_tie'; by: number; a: number; b: number } | { k: 'info_none'; by: number; id: number } | { k: 'info_refused'; by: number }
  | { k: 'gift_ok'; id: number } | { k: 'gift_refused'; id: number }
  | { k: 'defect_yes'; id: number } | { k: 'defect_no'; id: number } | { k: 'revolt_yes'; id: number } | { k: 'revolt_no'; id: number }
  | { k: 'pact_ok'; id: number } | { k: 'pact_no'; id: number } | { k: 'pact_already'; id: number }
  // 연애(2026-11-08)
  | { k: 'date_ok'; id: number; first: boolean } | { k: 'date_no'; id: number; wed: boolean }
  | { k: 'love_ok'; id: number } | { k: 'love_no'; id: number } | { k: 'love_public'; id: number; spouse?: number } | { k: 'public_no'; id: number }
  | { k: 'wed_ok'; id: number } | { k: 'wed_no'; id: number } | { k: 'love_already'; id: number; st: LoveSt } | { k: 'love_rumor'; id: number };                                       // 소개해 줄 사람이 없다                          // 충성 낮은 귀족에게 흘린 말 — 소문만
/** 지금 그 귀족이 우리와 통하는가(밀사 통로가 열렸거나, 우리 쪽 귀순이 정해짐). */
export const plotsWithUs = (sv: AuSave, ns: NobleSave, id: number): boolean => !!sv.ch[String(id)] || ns.pending[String(id)] === 'defect_p';
/** 밀사 요청에 대한 귀족의 속마음 점수(보이지 않음). AU.acceptAt 이상이면 허락. */
export function envoyScore(ns: NobleSave, n: NobleRow, warmth: number): number {
  const lv = ns.loyal[n.id] ?? 100, rel = ns.rel[pairKey(n.id, 'P')] ?? 0, ruler = ns.rel[pairKey(n.id, rulerOf(n.side))] ?? 0;
  return (70 - lv) + rel / 2 - ruler / 4 + warmth * 6 + (n.tr[4] > 0 ? 8 : 0) - Math.max(0, n.tr[0]) * 8;
}
export function judge(sv: AuSave, ns: NobleSave, nobles: NobleRow[], t: AuTarget, r: AuReply, bonds: BondRow[] = [], known: Set<number> = new Set()): AuOutcome[] {
  const out: AuOutcome[] = [], by = new Map(nobles.map((x) => [x.id, x] as [number, NobleRow]));
  const listener = t.kind === 'noble' ? by.get(t.id) : undefined;
  const side: NSide | undefined = t.kind === 'ruler' ? t.side : listener?.side;
  const rebelLord = !!listener && !!ns.fate[String(listener.id)]; // 반란국 군주(2026-11-08): 옛 군주에게 고하지 않는다
  const loyalListener = t.kind === 'ruler' || (!!listener && !rebelLord && (ns.loyal[listener.id] ?? 100) >= AU.loyalReport);
  if (r.askedEnvoy) {
    if (t.kind === 'ruler') out.push({ k: 'reported', side: t.side, by: 'ruler' });
    else if (listener) {
      if (sv.ch[String(listener.id)]) out.push({ k: 'envoy_already', id: listener.id });
      else if (!rebelLord && !sv.pact?.[String(listener.id)] && (loveOf(sv, listener.id)?.st ?? 0) < 2 && (ns.loyal[listener.id] ?? 100) >= AU.loyalReport) out.push({ k: 'reported', side: listener.side, by: listener.id }); // 서약한 귀족 · 연인은 고하지 않는다
      else out.push(envoyScore(ns, listener, r.warmth) >= AU.acceptAt ? { k: 'envoy_open', id: listener.id } : { k: 'envoy_refused', id: listener.id });
    }
  }
  if (listener && (r.askedIntro || r.introduce.length)) {
    const cands = introCands(ns, nobles, bonds, known, listener.id), cm = new Map(cands.map((c) => [c.id, c] as [number, IntroCand]));
    const willing = cands.filter((c) => introWilling(ns, listener.id, c, r.warmth));
    // AI 가 이름을 댄 사람 중 기꺼이 소개할 수 있는 사람 → 없고 플레이어가 청했으면 가장 가까운 한 명(이름을 안 대도 소개는 이루어진다)
    let pick = r.introduce.map((id) => cm.get(id)).filter((c): c is IntroCand => !!c && introWilling(ns, listener.id, c, r.warmth));
    if (!pick.length && r.askedIntro && willing.length) pick = [willing[0]];
    for (const c of pick.slice(0, AU.introMax)) out.push({ k: 'intro', id: c.id, by: listener.id, via: c.via, ...(c.bond ? { bond: c.bond } : {}) });
    if (!pick.length && r.askedIntro) out.push(cands.length ? { k: 'intro_refused', by: listener.id } : { k: 'intro_none', by: listener.id });
  }
  if (listener && t.kind === 'noble') { // 숨은 대화 카드(2026-11-08)
    const lid = listener.id, lv = ns.loyal[lid] ?? 100, rel = ns.rel[pairKey(lid, 'P')] ?? 0, lover = (loveOf(sv, lid)?.st ?? 0) >= 2, pacted = !!sv.pact?.[String(lid)] || lover; // 연인은 서약한 사이처럼 고하지 않는다
    const tellsRuler = !rebelLord && !pacted && lv >= AU.loyalReport;
    if (r.infoT !== undefined && r.infoT !== lid) {
      const tg = by.get(r.infoT);
      if (tg && (rel >= AUX.infoRel || lv < AUX.infoLoyal || sv.ch[String(lid)] || pacted)) {
        if (r.infoAbout === 'loyalty') out.push({ k: 'info_loyal', by: lid, id: tg.id });
        else { const hid = bonds.filter(([k, a, b]) => (a === tg.id || b === tg.id) && !bondVisible(ns, k, a, b)); out.push(hid.length ? { k: 'info_tie', by: lid, a: hid[0][1], b: hid[0][2] } : { k: 'info_none', by: lid, id: tg.id }); }
      } else if (tg) out.push({ k: 'info_refused', by: lid });
    }
    if (r.gift) out.push(listener.tr[0] >= 1 ? { k: 'gift_refused', id: lid } : { k: 'gift_ok', id: lid });
    if ((r.defect || r.revolt) && !rebelLord && tellsRuler && !r.askedEnvoy) out.push({ k: 'reported', side: listener.side, by: lid });
    else if (!rebelLord) {
      if (r.defect && !ns.pending[String(lid)]) out.push(lv < AUX.defectLoyal + (lover ? LOVE.defectLoyalBonus : 0) && rel >= AUX.defectRel ? { k: 'defect_yes', id: lid } : { k: 'defect_no', id: lid });
      else if (r.revolt && !ns.pending[String(lid)]) out.push(lv < AUX.revoltLoyal && rel >= AUX.revoltRel ? { k: 'revolt_yes', id: lid } : { k: 'revolt_no', id: lid });
    }
    if (r.pact) out.push(sv.pact?.[String(lid)] ? { k: 'pact_already', id: lid } : rel >= AUX.pactRel ? { k: 'pact_ok', id: lid } : { k: 'pact_no', id: lid });
    if (r.romance) out.push(loveJudge(sv, ns, listener, bonds, r.romance, r.warmth));
  }
  for (const id of r.accused) {
    const n = by.get(id); if (!n || !side || n.side !== side || (listener && listener.id === id)) continue; // 자기 나라 귀족만 군주에게 고할 수 있다
    const to: number | 'ruler' = t.kind === 'ruler' ? 'ruler' : listener!.id;
    if (!loyalListener) { out.push({ k: 'rumor', id, to: to as number }); continue; }
    if (plotsWithUs(sv, ns, id) || ns.pending[String(id)] === 'defect_other' || ns.pending[String(id)] === 'rebel' || (ns.loyal[id] ?? 100) < 25) out.push({ k: 'accuse_true', id, to });
    else out.push({ k: 'accuse_false', id, to, caught: n.tr[0] >= 1 }); // 명예로운 귀족은 누명을 벗는다 → 모함이 드러남
  }
  return out;
}
/** 연애 숨은 카드 판정(2026-11-08). 문턱은 loveBrief 가 LLM 에 미리 알려 준 것과 같다. */
export function loveJudge(sv: AuSave, ns: NobleSave, n: NobleRow, bonds: BondRow[], act: LoveAct, warmth: number): AuOutcome {
  const id = n.id, st = loveOf(sv, id)?.st ?? 0, ht = heartOf(sv, id), sp = spouseOf(ns, bonds, id), other = wedTo(sv); void warmth;
  if (act === 'date') { if (sp !== null && n.tr[0] >= 1) return { k: 'date_no', id, wed: true }; return st >= 1 || ht >= LOVE.dateHeart ? { k: 'date_ok', id, first: st === 0 } : { k: 'date_no', id, wed: false }; }
  if (act === 'confess') { if (st >= 2) return { k: 'love_already', id, st: st as LoveSt }; return ht >= LOVE.loverHeart ? { k: 'love_ok', id } : { k: 'love_no', id }; } // 비서처럼: 호감 75 면 데이트 없이도
  if (act === 'public') { if (st >= 3) return { k: 'love_already', id, st: st as LoveSt }; return st === 2 && ht >= LOVE.publicHeart ? { k: 'love_public', id, ...(sp !== null ? { spouse: sp } : {}) } : { k: 'public_no', id }; }
  if (st === 4) return { k: 'love_already', id, st: 4 };
  return st === 3 && ht >= LOVE.marryHeart && sp === null && (other === null || other === id) ? { k: 'wed_ok', id } : { k: 'wed_no', id };
}

/** 판정을 귀족 저장에 반영(친밀도·충성·의심). 게임 쪽 호감 변화는 앱이 따로 보낸다. */
export function applyOutcomes(sv: AuSave, out: AuOutcome[], date: string, rulerKey: (id: number) => 'A' | 'B', shiftRel: (x: number | 'A' | 'B' | 'P', y: number | 'A' | 'B' | 'P', d: number) => void, shiftLoyal: (id: number, d: number) => void): void {
  for (const o of out) {
    if (o.k === 'envoy_open') { sv.ch[String(o.id)] = date; shiftRel(o.id, 'P', 5); }
    else if (o.k === 'envoy_refused') shiftRel(o.id, 'P', -5);
    else if (o.k === 'reported' && typeof o.by === 'number') { shiftRel(o.by, 'P', -20); shiftRel(o.by, o.side === 'a' ? 'A' : 'B', 5); }
    else if (o.k === 'accuse_true') { delete sv.ch[String(o.id)]; sv.sus[String(o.id)] = date; shiftLoyal(o.id, -10); shiftRel(o.id, rulerKey(o.id), -30); shiftRel(o.id, 'P', -30); }
    else if (o.k === 'accuse_false') { sv.sus[String(o.id)] = date; shiftLoyal(o.id, -5); shiftRel(o.id, rulerKey(o.id), -15); shiftRel(o.id, 'P', -15); }
    else if (o.k === 'rumor') shiftRel(o.id, o.to, -5);
    else if (o.k === 'gift_ok') shiftRel(o.id, 'P', AUX.giftRel);
    else if (o.k === 'gift_refused') shiftRel(o.id, 'P', -3);
    else if (o.k === 'defect_no' || o.k === 'revolt_no' || o.k === 'pact_no') shiftRel(o.id, 'P', -2);
    else if (o.k === 'pact_ok') { (sv.pact ??= {})[String(o.id)] = date; shiftRel(o.id, 'P', AUX.pactBonus); }
    else if (o.k === 'intro') { sv.intro[String(o.id)] = date; shiftRel(o.id, 'P', o.via === 'faction' ? AU.introFacBonus : AU.introBonus); } // 아는 사람의 소개라 첫인상이 낫다
    else if (o.k === 'date_ok') { const L0 = ((sv.love ??= {})[String(o.id)] ??= { st: 1, d: date, n: 0 }); L0.n++; L0.d = date; shiftRel(o.id, 'P', LOVE.dateBonus); (sv.heart ??= {})[String(o.id)] = Math.min(100, heartOf(sv, o.id) + LOVE.dateGain); } // 함께 보낸 시간(비서 데이트처럼)
    else if (o.k === 'date_no') shiftRel(o.id, 'P', o.wed ? LOVE.wedRefuseRel : LOVE.coldRel);
    else if (o.k === 'love_ok') { (sv.love ??= {})[String(o.id)] = { st: 2, d: date, n: sv.love[String(o.id)]?.n ?? 0 }; shiftRel(o.id, 'P', LOVE.loverBonus); }
    else if (o.k === 'love_public') { sv.love![String(o.id)].st = 3; sv.love![String(o.id)].d = date; shiftRel(o.id, rulerKey(o.id), LOVE.publicRulerRel); shiftLoyal(o.id, LOVE.publicLoyal); if (o.spouse !== undefined) shiftRel(o.id, o.spouse, LOVE.spouseRel); }
    else if (o.k === 'wed_ok') { sv.love![String(o.id)].st = 4; sv.love![String(o.id)].d = date; shiftLoyal(o.id, LOVE.marryLoyal); shiftRel(o.id, 'P', LOVE.wedBonus); }
    else if (o.k === 'love_no' || o.k === 'public_no' || o.k === 'wed_no') shiftRel(o.id, 'P', LOVE.noRel);
    else if (o.k === 'love_rumor') shiftRel(o.id, rulerKey(o.id), LOVE.gossipRulerRel);
  }
}
