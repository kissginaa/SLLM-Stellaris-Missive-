// 레전드 오브 갤럭시 ↔ 나라 연동(2026-10-31, 계획서 12번 「LoG ↔ 나라 연동」 1~14, 11 불법 장비 개조만 뺌) — 순수 규칙(electron 없이 selftest).
// 앱: src/features/log-app.ts(월간·시즌·월즈·올림픽에서 부름). 게임에 닿는 것은 모드 수정자만(행성·나라 static modifier, 상대국 opinion modifier, 영향력):
//   tester-mod/common/static_modifiers/sllm_log_modifiers.txt · common/opinion_modifiers/sllm_log_opinion.txt
// 수치는 처음 조정값(해 보며 고침). 민심은 앱의 민심 보정(mood-app moodNudge), 효과는 리그 열기에 비례(같은 효과 반복으로 시시해지지 않게).

export type Pair = [string, string];

export const NAT = {
  heat: { start: 30, max: 100, decay: 0.6, decayRel: 0.025, sponsorMonthly: 0.25, leagueFinal: 4, sponsoredChamp: 10, worldsHeld: 8, worldsChamp: 20, worldsFinal: 10, olyMedal: 8, host: 15, invite: 3, investigate: -8, exposed: -30, transferAway: -10 },
  /** heat.sponsorMonthly: 후원 중이면 달마다 등급 × 이만큼 오름(후원이 열기를 지핌). 정신주의: 열기가 덜 오름. */
  spiritualistGain: 0.6,
  /** 월즈 우승 축제: 몇 달 민심 + (달마다) + 나라 수정자(행복도) 일수. */
  festival: { months: 3, days: 120 },
  /** 연고 행성: 상위 3팀 = 자랑(안정도·이주 끌림), 2시즌 연속 꼴찌 = 불만. 일수. */
  home: { top: 3, lastSeasons: 2, days: 360 },
  /** 라이벌: 월즈에서 이만큼 만나면. */
  rivalMeetings: 3,
  /** 월즈 유치. */
  host: { bidFee: 400, influence: 30, mood: 2, failMood: -1 },
  /** 기업 국가: 후원금 배율·상금 몫 배율·분기 브랜드 수입(열기 × 등급 × 이 값). */
  corp: { fee: 0.75, share: 1.4, brand: 0.5 },
  /** 승부 조작: 시즌마다(4라운드 뒤) 확률, 열기 70 넘으면 더. 덮으면 이 확률로 1~3년 안에 드러남. 조사하면 그 구단 다음 시즌 예산 −. */
  scandal: { chance: 0.04, hot: 0.02, reveal: 0.6, penalty: 800, investigateMood: -1, exposedMood: -4 },
  /** 스타 이적: 월즈 뒤 확률, 붙잡는 값. */
  transfer: { chance: 0.6, keepFee: 1500, minOvr: 78, mood: -1 },
} as const;

export const clampHeat = (n: number): number => Math.max(0, Math.min(NAT.heat.max, Math.round(n * 10) / 10));
/** 열기 → 민심 배율(0.4~1.2). */
export const heatFactor = (heat: number): number => 0.4 + (clampHeat(heat) / 100) * 0.8;
/** 민심 값에 배율: 부호는 그대로, 0이 아니면 최소 1. */
export function scaled(base: number, heat: number): number { if (!base) return 0; const v = Math.round(base * heatFactor(heat)); return v === 0 ? Math.sign(base) : v; }
export const heatGain = (heat: number, gain: number, spiritualist: boolean): number => clampHeat(heat + (gain > 0 && spiritualist ? gain * NAT.spiritualistGain : gain));
/** 달마다 식음: 기본 + 열기에 비례(뜨거울수록 빨리 식어 늘 100에 붙어 있지 않게, 2026-10-31 보강). */
export const heatDecay = (heat: number): number => clampHeat(heat - (NAT.heat.decay + clampHeat(heat) * NAT.heat.decayRel));

/** 경기 모양: 이긴 쪽 킬이 진 쪽의 1.4배 이상(+3)이면 공격적, 둘 다 적고 차이가 작으면 수비적. */
export function playStyle(kills: [number, number], winner: 0 | 1): 'aggressive' | 'defensive' | 'even' {
  const w = kills[winner], l = kills[1 - winner];
  if (w >= l * 1.4 + 3) return 'aggressive'; if (w + l <= 14 && w - l <= 3) return 'defensive'; return 'even';
}
/** 가치관 반응: 군국주의 = 공격적 승리에 +1, 평화주의 = 수비적 승리에 +1 · 공격적 승리는 반. */
export function ethicBonus(ethics: string[], style: 'aggressive' | 'defensive' | 'even', base: number): number {
  const has = (k: string) => ethics.some((e) => e === 'ethic_' + k || e === 'ethic_fanatic_' + k);
  let v = base; if (has('militarist') && style === 'aggressive') v += 1; if (has('pacifist')) { if (style === 'defensive') v += 1; else if (style === 'aggressive') v = Math.floor(v / 2); }
  return v;
}

/** 연고 행성 효과: 순위(0이 1위) → 자랑 행성, 연속 꼴찌 기록 → 불만 행성. 같은 행성에 둘 다면 자랑만. */
export function homeEffects(order: string[], lastStreak: Record<string, number>): { pride: string[]; gloom: string[] } {
  const pride = [...new Set(order.slice(0, NAT.home.top))];
  const gloom = [...new Set(Object.entries(lastStreak).filter(([, n]) => n >= NAT.home.lastSeasons).map(([p]) => p))].filter((p) => !pride.includes(p));
  return { pride, gloom };
}

/** 라이벌: 월즈 맞대결 횟수 누적 → 라이벌 나라(idx 목록). */
export const rivalsOf = (meet: Record<string, number>): number[] => Object.entries(meet).filter(([, n]) => n >= NAT.rivalMeetings).map(([k]) => Number(k));

// ---- 지도자 편지(틀 문장, AI 없음)
export type LetterTone = 'warm' | 'taunt';
export const toneOf = (em: { war?: boolean; rival?: boolean } | undefined, score: number): LetterTone => (em?.war || em?.rival || score < 0 ? 'taunt' : 'warm');
const LETTERS: Record<LetterTone, Record<'weWon' | 'weLost', Pair[]>> = {
  warm: {
    weWon: [['{them}의 지도자로서 {us}에 축하를 보냅니다. {team}의 경기는 우리 선수들에게도 큰 배움이었습니다. 다음 대회에서 다시 만나기를 고대합니다.', 'As leader of {them}, I congratulate {us}. {team} played a match our own players learned much from. We look forward to meeting again at the next championship.'],
            ['훌륭한 승리였습니다. {team}의 선수들에게 우리 국민도 박수를 보냈습니다. 두 나라의 우정처럼 좋은 경기가 이어지길 바랍니다.', 'A splendid victory. Our people applauded {team}\'s players too. May fine matches continue, like the friendship between our nations.']],
    weLost: [['좋은 경기에 감사드립니다. {team}은(는) 끝까지 당당했습니다. 이번 승리는 우리가 가져가지만, 존중은 그대로 {us}에 보냅니다.', 'Thank you for a fine match. {team} stood tall to the end. The victory is ours this time, but our respect goes to {us} all the same.'],
             ['{us}의 선수들이 보여 준 투지에 감탄했습니다. 다음 대회에서는 더 어려운 상대가 되겠지요. 그날을 기다리겠습니다.', 'We admired the fighting spirit of {us}\'s players. Next time you will be an even harder opponent. We await that day.']],
  },
  taunt: {
    weWon: [['운이 좋았다고 해 두지요. {team}의 승리는 이번 한 번뿐일 겁니다. {them}의 선수들은 벌써 다음 대회를 준비하고 있습니다.', 'Let us call it luck. {team}\'s win will be the only one. The players of {them} are already preparing for the next championship.'],
            ['축하는 하지 않겠습니다. 다음 경기장에서 {them}이(가) 갚아 줄 테니까요.', 'We will not congratulate you. {them} will settle the score in the next arena.']],
    weLost: [['{team}에게 경기장 바닥이 그렇게 반가웠습니까? {them}의 국민은 오늘 밤 축제입니다. 다음에도 기대하지요.', 'Did {team} enjoy the arena floor that much? {them} celebrates tonight. We look forward to the next time.'],
             ['결과는 보신 대로입니다. {us}은(는) 경기장에서도 우리를 넘지 못하는군요.', 'The result speaks for itself. Even in the arena, {us} cannot get past us.']],
  },
};
export function letterText(tone: LetterTone, weWon: boolean, v: { us: string; them: string; team: string }, pick: number): Pair {
  const list = LETTERS[tone][weWon ? 'weWon' : 'weLost'], t = list[Math.abs(pick) % list.length];
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k: 'us' | 'them' | 'team') => v[k] ?? '');
  return [f(t[0]), f(t[1])];
}

// ---- 신문 스포츠 1면(틀 기사, AI 없음)
export type SportsKind = 'worldsWin' | 'worldsLose' | 'rivalWin' | 'leagueChamp' | 'olyGold' | 'scandal' | 'transfer' | 'retire' | 'host';
const HEAD: Record<SportsKind, Pair> = {
  worldsWin: ['은하 정상에 서다! {team}, 월드 챔피언십 우승', 'On top of the galaxy! {team} win the World Championship'],
  worldsLose: ['한 걸음 모자랐다 — {team}, 월즈 결승에서 {them}에 패배', 'One step short — {team} fall to {them} in the Worlds final'],
  rivalWin: ['숙적을 꺾다! {team}, {them} 격파', 'Old rivals beaten! {team} defeat {them}'],
  leagueChamp: ['{season} 시즌 왕좌의 주인은 {team}', '{team} take the {season} league crown'],
  olyGold: ['금메달! 대표팀, 은하 올림픽 정상', 'Gold! Our national team top the Galactic Olympics'],
  scandal: ['승부 조작 의혹 — {team} 경기 조사', 'Match-fixing alleged — {team} games under investigation'],
  transfer: ['레전드 {player}, {them} 구단으로 떠난다', 'Legend {player} leaves for a club in {them}'],
  retire: ['레전드 {player} 은퇴 — 한 시대가 저물다', 'Legend {player} retires — an era ends'],
  host: ['{event} 유치 성공! 은하가 우리 경기장으로', 'We will host the {event}! The galaxy comes to our arena'],
};
const BODY: Record<SportsKind, Pair> = {
  worldsWin: ['{team}이(가) 결승에서 {them}을(를) 꺾고 은하 월드 챔피언십 우승컵을 들어 올렸다. 수도의 광장마다 밤새 환호가 이어졌다.', '{team} beat {them} in the final to lift the Galactic World Championship trophy. Cheers rang through every square of the capital all night.'],
  worldsLose: ['{team}은(는) 끝까지 맞섰지만 결승에서 {them}에 무릎을 꿇었다. 팬들은 아쉬움 속에서도 선수들에게 박수를 보냈다.', '{team} fought to the last but fell to {them} in the final. Disappointed fans still applauded the players.'],
  rivalWin: ['월즈에서 여러 번 맞붙어 온 {them}과(와)의 대결. {team}이(가) 이번에는 웃었다. 팬들은 「이 맛에 본다」고 입을 모았다.', 'Another Worlds clash with {them}, a familiar foe — and this time {team} came out on top. "This is why we watch," fans said.'],
  leagueChamp: ['{team}이(가) {season} 시즌 결승을 잡고 리그 정상에 올랐다. 연고 행성 {planet}에서는 우승 행진이 열렸다.', '{team} won the {season} final to top the league. A victory parade was held on their home world, {planet}.'],
  olyGold: ['국내 리그 정예로 꾸린 대표팀이 은하 올림픽 결승을 제패했다. 시상대 맨 위에 우리 깃발이 올랐다.', 'The national team, drawn from our league\'s best, won the Galactic Olympics final. Our flag rose to the top of the podium.'],
  scandal: ['{team}의 경기에서 수상한 베팅 흐름이 발견되었다. 리그 사무국은 사실관계를 확인하고 있다.', 'Suspicious betting patterns were found around {team}\'s matches. The league office is looking into the facts.'],
  transfer: ['국가대표 레전드 {player}이(가) {them}의 구단과 계약했다. 팬들은 아쉬움 속에 작별 인사를 건넸다.', 'National legend {player} signed with a club in {them}. Fans bade farewell with heavy hearts.'],
  retire: ['수많은 명경기를 남긴 레전드 {player}이(가) 은퇴를 발표했다. 경기장에는 그의 이름을 부르는 소리가 오래 남았다.', 'Legend {player}, who gave us countless great matches, announced retirement. The arena echoed with the name for a long time.'],
  host: ['은하 공동체 투표 끝에 {event} 개최지로 우리 제국이 뽑혔다. 경기장 확장 공사가 곧 시작된다.', 'After the Galactic Community vote, our empire was chosen to host the {event}. Arena expansion begins soon.'],
};
export function sportsArticle(kind: SportsKind, v: Record<string, string | number>): { head: Pair; body: Pair } {
  const f = (s: string) => s.replace(/\{(\w+)\}/g, (_m, k) => String(v[k] ?? ''));
  return { head: [f(HEAD[kind][0]), f(HEAD[kind][1])], body: [f(BODY[kind][0]), f(BODY[kind][1])] };
}

// ---- 게임 명령(모드 수정자만). 회신 SLLM:LOGNAT status=applied|duplicate. 같은 묶음 번호(n)는 한 번만.
export type NatOp = { t: 'planet'; k: number; mod: string; days: number } | { t: 'country'; mod: string; days: number } | { t: 'opinion'; idx: number; mod: string } | { t: 'influence'; n: number } | { t: 'energy'; n: number }; // energy: 개최 관광 수입(2026-10-31)
export const PLANET_MODS = ['sllm_log_home_pride', 'sllm_log_home_gloom'] as const;
export const COUNTRY_MODS = ['sllm_log_festival'] as const;
export const OPINION_MODS = ['sllm_log_rival_sting', 'sllm_log_rival_sting_2', 'sllm_log_host_thanks', 'sllm_log_transfer_goodwill', 'sllm_log_sportsmanship'] as const;
const okOp = (o: NatOp): boolean => {
  if (o.t === 'planet') return Number.isSafeInteger(o.k) && o.k >= 1 && o.k <= 2000 && (PLANET_MODS as readonly string[]).includes(o.mod) && Number.isSafeInteger(o.days) && o.days >= 1 && o.days <= 3600;
  if (o.t === 'country') return (COUNTRY_MODS as readonly string[]).includes(o.mod) && Number.isSafeInteger(o.days) && o.days >= 1 && o.days <= 3600;
  if (o.t === 'opinion') return Number.isSafeInteger(o.idx) && o.idx >= 0 && (OPINION_MODS as readonly string[]).includes(o.mod);
  if (o.t === 'energy') return Number.isSafeInteger(o.n) && o.n >= 1 && o.n <= 5000;
  return Number.isSafeInteger(o.n) && o.n >= 1 && o.n <= 500;
};
export function logNationCommand(req: number, sid: string, n: number, ops: NatOp[]): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(n) || n < 1 || !ops.length || ops.length > 24 || !ops.every(okOp)) throw new Error('INVALID_LOGNAT');
  const log = (s: string) => `log = "SLLM:LOGNAT/;/req=${req}/;/sid=${sid}/;/n=${n}/;/status=${s}"`, mark = `sllm_lognat_${n}`;
  const body = ops.map((o) => {
    if (o.t === 'planet') return `set_variable = { which = sllm_lg_n value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_lg_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_lg_n value = ${o.k} } } } remove_modifier = ${o.mod} add_modifier = { modifier = ${o.mod} days = ${o.days} } } } clear_variable = sllm_lg_n`;
    if (o.t === 'country') return `remove_modifier = ${o.mod} add_modifier = { modifier = ${o.mod} days = ${o.days} }`;
    if (o.t === 'opinion') return `every_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${o.idx} } } add_opinion_modifier = { who = prev modifier = ${o.mod} } }`;
    if (o.t === 'energy') return `add_resource = { energy = ${o.n} }`;
    return `add_resource = { influence = ${o.n} }`;
  }).join(' ');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { set_variable = { which = ${mark} value = 1 } ${body} ${log('applied')} } }`;
}
