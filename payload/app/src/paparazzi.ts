// 파파라치(2026-10-31 사용자 결정, 계획서 11번) — 순수 자료·규칙(electron 없이 selftest).
// 재료: 외출 전부(카지노 대박·탕진, 데이트, 백화점 큰 쇼핑·선물, 선술집 변장 들킴, 암시장 단속·구입, 랜드마크 연설·의식).
// 사진이 찍히면 플레이어가 고름: 매수(금고) · 무시(기사 나감) · 고소(이기면 기사 없음, 지면 기사 + 역풍). 한 달 안에 안 고르면 기사가 나감.
// 기사는 틀 문장(AI 없음). 효과: 민심(작게) · 부패 낌새(금고 의심 → 궁정 「부패」 음모 가중치) · 외교(통신 중인 AI 제국 호감 소폭, 모드 opinion modifier).

export type Pair = [string, string];
export type SnapKind = 'casinoWin' | 'casinoLoss' | 'date' | 'affair' | 'shopping' | 'gift' | 'tavern' | 'bmRaid' | 'bmBuy' | 'speechGood' | 'speechBad' | 'ritual';
export interface SnapRule { chance: number; tone: 'good' | 'bad' | 'mixed'; sev: 1 | 2 | 3; mood: number; susp: number; foreign: 'good' | 'bad' | null }
/** 사건별: 찍힐 확률 · 기사 결 · 심각도(매수값) · 민심 · 부패 낌새 · 외국 반응. 확률은 「진짜 드물게」(2026-10-31 사용자: 2~20%). */
export const SNAP: Record<SnapKind, SnapRule> = {
  casinoWin: { chance: 0.05, tone: 'mixed', sev: 1, mood: -1, susp: 0, foreign: null },
  casinoLoss: { chance: 0.06, tone: 'bad', sev: 2, mood: -2, susp: 1, foreign: 'bad' },
  date: { chance: 0.03, tone: 'good', sev: 1, mood: 1, susp: 0, foreign: null },
  affair: { chance: 0.06, tone: 'bad', sev: 2, mood: -1, susp: 0, foreign: null },
  shopping: { chance: 0.03, tone: 'bad', sev: 1, mood: -1, susp: 1, foreign: null },
  gift: { chance: 0.02, tone: 'good', sev: 1, mood: 1, susp: 0, foreign: null },
  tavern: { chance: 0.15, tone: 'mixed', sev: 1, mood: 1, susp: 0, foreign: null },
  bmRaid: { chance: 0.2, tone: 'bad', sev: 3, mood: -2, susp: 1, foreign: 'bad' },
  bmBuy: { chance: 0.03, tone: 'bad', sev: 2, mood: -1, susp: 1, foreign: null },
  speechGood: { chance: 0.08, tone: 'good', sev: 1, mood: 1, susp: 0, foreign: 'good' },
  speechBad: { chance: 0.08, tone: 'bad', sev: 1, mood: -1, susp: 0, foreign: null },
  ritual: { chance: 0.02, tone: 'good', sev: 1, mood: 1, susp: 0, foreign: null },
};
export const PAP = {
  /** 매수값 = 심각도 × 이만큼. */ bribe: 350,
  /** 고소: 소송비, 이길 확률, 지면 민심 추가(언론 탄압 역풍). */ suitFee: 200, suitWin: 0.5, suitBackfire: -1,
  /** 카지노 한 번 들렀을 때 이만큼 따거나 잃으면 사진감. 백화점 한 번에 이만큼 쓰면 사진감. */ casinoWin: 3000, casinoLoss: 2000, shopping: 1500,
  /** 안 고르고 두면 이만큼(일) 뒤 기사. */ waitDays: 30,
  /** 기사 보관 수. */ keep: 40,
} as const;
export const bribeOf = (k: SnapKind): number => SNAP[k].sev * PAP.bribe;
/** 고소는 나쁜 기사에만(좋은 기사를 고소할 이유가 없음). */
export const canSue = (k: SnapKind): boolean => SNAP[k].tone !== 'good';

/** 카지노 한 번 들른 결과 → 사진감(없으면 null). */
export function casinoKind(net: number): SnapKind | null { return net >= PAP.casinoWin ? 'casinoWin' : net <= -PAP.casinoLoss ? 'casinoLoss' : null; }
/** 연설 점수(−2~+3) → 기사감. */
export function speechKind(score: number): SnapKind | null { return score >= 2 ? 'speechGood' : score < 0 ? 'speechBad' : null; }

// ---- 틀 기사(AI 없음). {ruler} 통치자 · {who} 함께 있던 사람 · {amount} 금액 · {item} 물건 · {place} 장소
const PAPER: Pair = ['은하 가십', 'Galactic Gossip'];
export const paperName = PAPER;
const HEAD: Record<SnapKind, Pair[]> = {
  casinoWin: [['통치자, 카지노 정거장에서 {amount} 크레딧 대박!', 'Ruler hits a {amount}-credit jackpot at the casino station!'], ['「행운의 통치자」 — 카지노 판을 휩쓸다', '"Lucky Ruler" sweeps the casino tables']],
  casinoLoss: [['통치자, 하룻밤에 {amount} 크레딧 날려', 'Ruler loses {amount} credits in a single night'], ['카지노 정거장의 큰손 — 통치자의 씀씀이에 우려', 'High roller at the casino station — concern over the ruler\'s spending']],
  date: [['포착! 통치자와 {who}, 공원 산책', 'Spotted! The ruler and {who} strolling in the park'], ['다정한 한때 — 통치자 부부의 저녁 데이트', 'A tender moment — the ruler\'s evening date']],
  affair: [['통치자의 은밀한 만남? {who}와(과) 공원에서', 'The ruler\'s secret rendezvous? With {who} in the park'], ['궁 밖의 그림자 — 통치자 곁의 {who}는 누구?', 'Shadows outside the palace — who is {who} at the ruler\'s side?']],
  shopping: [['통치자, 백화점 귀빈층에서 {amount} 크레딧 쇼핑', 'Ruler spends {amount} credits on the department store VIP floors'], ['사치 논란 — 통치자의 쇼핑백이 늘어난다', 'Luxury row — the ruler\'s shopping bags pile up']],
  gift: [['통치자가 {who}에게 건넨 선물은 {item}', 'The ruler\'s gift to {who}: {item}'], ['로맨틱한 통치자 — {who}을(를) 위한 {item}', 'A romantic ruler — {item} for {who}']],
  tavern: [['변장한 통치자, 뒷골목 선술집에서 들통!', 'Disguised ruler unmasked in a back-alley tavern!'], ['서민 술집에 나타난 통치자 — 「민심을 직접 듣고 싶었다」', 'The ruler at a working-class bar — "I wanted to hear the people myself"']],
  bmRaid: [['단속 현장에서 달아난 후드 차림의 인물… 통치자였나?', 'A hooded figure fled the raid… was it the ruler?'], ['충격 — 암시장 단속 현장의 통치자', 'Shock — the ruler at a black market raid']],
  bmBuy: [['통치자가 암시장에서 산 물건은 {item}?', 'Did the ruler buy {item} on the black market?'], ['뒷골목 거래 의혹 — 통치자와 {item}', 'Back-alley dealings alleged — the ruler and {item}']],
  speechGood: [['{place}에서의 명연설 — 군중이 환호하다', 'A great speech at {place} — the crowd roars'], ['통치자의 말에 광장이 울었다', 'The plaza wept at the ruler\'s words']],
  speechBad: [['{place} 연설에 야유 — 통치자 당황', 'Boos at {place} — the ruler caught off guard'], ['싸늘한 광장 — 빗나간 통치자의 연설', 'A cold plaza — the ruler\'s speech misses the mark']],
  ritual: [['{place}의 의식에 함께한 통치자', 'The ruler joins the ceremony at {place}'], ['조용히 머리 숙인 통치자 — {place}에서', 'The ruler bows quietly at {place}']],
};
const BODY: Record<'good' | 'bad' | 'mixed', Pair> = {
  good: ['본지 사진기자가 포착한 장면이다. 시민들 사이에서는 「보기 좋다」는 반응이 많다.', 'Our photographer caught the moment. Many citizens say "it\'s nice to see."'],
  bad: ['본지 사진기자가 포착한 장면이다. 궁은 아직 공식 입장을 내지 않았다. 시민들의 시선은 곱지 않다.', 'Our photographer caught the moment. The palace has not commented. Citizens are not impressed.'],
  mixed: ['본지 사진기자가 포착한 장면이다. 「인간적이다」라는 반응과 「통치자답지 않다」는 반응이 엇갈린다.', 'Our photographer caught the moment. Some call it "human"; others say it is "unbecoming of a ruler."'],
};
export function article(k: SnapKind, v: Record<string, string | number>, pick: number): { head: Pair; body: Pair } {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_m, key) => String(v[key] ?? '')), hs = HEAD[k], h = hs[Math.abs(pick) % hs.length], b = BODY[SNAP[k].tone];
  return { head: [f(h[0]), f(h[1])], body: [f(b[0]), f(b[1])] };
}
/** 사진 설명(고르기 창, 기사 나가기 전). */
export function caption(k: SnapKind, v: Record<string, string | number>): Pair {
  const t: Record<SnapKind, Pair> = {
    casinoWin: ['카지노에서 {amount} 크레딧을 따는 모습', 'winning {amount} credits at the casino'], casinoLoss: ['카지노에서 {amount} 크레딧을 잃는 모습', 'losing {amount} credits at the casino'],
    date: ['{who}와(과) 공원에서 데이트하는 모습', 'on a park date with {who}'], affair: ['{who}와(과) 공원에서 단둘이 있는 모습', 'alone in the park with {who}'],
    shopping: ['백화점에서 {amount} 크레딧어치를 사는 모습', 'buying {amount} credits\' worth at the department store'], gift: ['{who}에게 {item}을(를) 선물하는 모습', 'giving {who} the {item}'],
    tavern: ['변장이 들켜 선술집에서 정체가 드러난 모습', 'unmasked in disguise at the tavern'], bmRaid: ['후드를 쓰고 암시장 단속을 피해 달아나는 모습', 'fleeing a black market raid in a hood'],
    bmBuy: ['암시장에서 {item}을(를) 사는 모습', 'buying {item} at the black market'], speechGood: ['{place}에서 환호 속에 연설하는 모습', 'speaking to cheers at {place}'],
    speechBad: ['{place}에서 야유 속에 연설하는 모습', 'speaking amid boos at {place}'], ritual: ['{place}의 의식에 참석한 모습', 'attending the ceremony at {place}'],
  };
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_m, key) => String(v[key] ?? '')); return [f(t[k][0]), f(t[k][1])];
}

/** 날짜 차이(일, 게임 날짜 yyyy.mm.dd, 한 달 30일). */
export function daysBetween(a: string, b: string): number {
  const p = (d: string) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : NaN; };
  return p(b) - p(a);
}

/** 외국 반응 게임 명령: 통신 중인 AI 제국 전부에 호감 수정자. 회신 SLLM:PAPOP. 같은 번호는 한 번만. */
export const PAP_OPINION = { good: 'sllm_pap_good', bad: 'sllm_pap_bad' } as const;
export function papOpinionCommand(req: number, sid: string, n: number, tone: 'good' | 'bad'): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(n) || n < 1 || (tone !== 'good' && tone !== 'bad')) throw new Error('INVALID_PAPOP');
  const mod = PAP_OPINION[tone], mark = `sllm_papop_${n}`, log = (s: string) => `log = "SLLM:PAPOP/;/req=${req}/;/sid=${sid}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } every_country = { limit = { is_ai = yes is_variable_set = sllm_idx has_communications = prev } add_opinion_modifier = { who = prev modifier = ${mod} } } ${log('applied')} } }`;
}
