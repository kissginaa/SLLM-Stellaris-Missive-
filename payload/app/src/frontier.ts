// 국경·전선과 외교 사정(다음 업데이트, 2026-10-26 사용자 「AI 가 전선을 이해해?」 → 「그래」, 「스텔라리스 AI 가 인식하는 정보는 우리도」 → 「전부다」). 순수 규칙. 앱: src/features/frontier-app.ts.
// 스텔라리스 게임 AI 가 판단에 쓰는 것 가운데 앱의 AI 에게 없던 것을 대화·회의 전에 게임에서 읽어 영어 줄로 넣는다:
//   국경(맞닿은 성계)·점령, 영유권 주장, 공동의 적(같은 전쟁·같은 경쟁자), 전쟁 명분, 신뢰, 첩보 수준, 종속 관계, 사절, 은하 공동체 지위.
// 트리거 이름은 바닐라 게임 폴더(4.5.2) 사용처 또는 4.5.1 script_docs 덤프(OldEnt)로 확인: is_neighbor_of, every_system_within_border, any_neighbor_system,
//   space_owner, controller, has_claim(<system>), has_casus_belli = { target }, trust = { who value }, intel = { who value }, is_rival, has_overlord,
//   is_improving_relations_with, is_harming_relations_with, is_galactic_community_member, is_part_of_galactic_council, is_galactic_custodian, is_galactic_emperor.
// 콘솔 effect 만 쓰므로 모드 추가 없음. 게임 수치를 바꾸지 않고 AI 호출도 늘지 않는다.
export const FRONT = { maxNames: 5, maxRows: 400 } as const;
export type FrontSide = 'us' | 'them' | 'lost' | 'taken' | 'xclaim' | 'pclaim' | 'foewar' | 'foerival' | 'kin';
const SIDES: FrontSide[] = ['us', 'them', 'lost', 'taken', 'xclaim', 'pclaim', 'foewar', 'foerival', 'kin'];
/**
 * 플레이어(우리) 기준. us = 상대와 맞닿은 우리 성계, them = 우리와 맞닿은 상대 성계, lost = 상대가 점령한 우리 성계, taken = 우리가 점령한 상대 성계,
 * xclaim = 상대가 영유권을 주장한 우리 성계, pclaim = 우리가 주장한 상대 성계, foewar = 둘 다 전쟁 중인 나라, foerival = 둘 다 경쟁자로 둔 나라.
 * trust·intel = 상대 → 우리 구간(0 없음 1 낮음 2 보통 3 높음 4 매우 높음), cbX/cbP = 상대/우리가 전쟁 명분 보유, sub 1 상대가 우리 종주국 2 우리가 상대 종주국,
 * envX/envP = 상대/우리 사절(1 관계 개선 2 관계 악화), gcX/gcP = 은하 공동체(비트: 1 회원 2 평의회 4 수호자 8 은하 황제).
 */
export interface Frontier {
  idx: number; neighbor: boolean; us: string[]; them: string[]; lost: string[]; taken: string[];
  xclaim: string[]; pclaim: string[]; foewar: string[]; foerival: string[];
  /** 그레이트 칸의 후계국(2026-10-26): khX/khP = 상대/우리 0 아님 1 디아도코이(분열 후계국) 2 새 칸국 3 민주 칸국 4 그 밖의 후계 기원, kin = 상대 말고 다른 후계국 이름 */
  khX: number; khP: number; kin: string[];
  trust: number; intel: number; cbX: boolean; cbP: boolean; sub: 0 | 1 | 2; envX: 0 | 1 | 2; envP: 0 | 1 | 2; gcX: number; gcP: number;
}

const okSid = (sid: string) => /^\d+$/.test(sid);
const player = (sid: string, body: string) => `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;
const X = 'event_target:sllm_fr_x', P = 'event_target:sllm_fr_p';
const flag = (v: string, cond: string, val = 1) => `if = { limit = { ${cond} } set_variable = { which = ${v} value = ${val} } }`;
function bandOf(v: string, mk: (n: number) => string): string {
  return `set_variable = { which = ${v} value = 0 } if = { limit = { ${X} = { ${mk(90)} } } set_variable = { which = ${v} value = 4 } } else_if = { limit = { ${X} = { ${mk(60)} } } set_variable = { which = ${v} value = 3 } } else_if = { limit = { ${X} = { ${mk(30)} } } set_variable = { which = ${v} value = 2 } } else_if = { limit = { ${X} = { ${mk(10)} } } set_variable = { which = ${v} value = 1 } }`;
}
const khanOf = (v: string, who: string) => `set_variable = { which = ${v} value = 0 } ${who} = { if = { limit = { has_origin = origin_khan_successor } prev = { set_variable = { which = ${v} value = 4 } } if = { limit = { has_country_flag = diadochi } prev = { set_variable = { which = ${v} value = 1 } } } else_if = { limit = { has_country_flag = new_khanate_flag } prev = { set_variable = { which = ${v} value = 2 } } } else_if = { limit = { has_country_flag = democratic_khanate_flag } prev = { set_variable = { which = ${v} value = 3 } } } } }`;
const gcBits = (v: string, who: string) => `set_variable = { which = ${v} value = 0 } ${who} = { if = { limit = { is_galactic_community_member = yes } prev = { change_variable = { which = ${v} value = 1 } } } if = { limit = { is_part_of_galactic_council = yes } prev = { change_variable = { which = ${v} value = 2 } } } if = { limit = { is_galactic_custodian = yes } prev = { change_variable = { which = ${v} value = 4 } } } if = { limit = { is_galactic_emperor = yes } prev = { change_variable = { which = ${v} value = 8 } } } }`;

/** 한 제국과의 국경·전선·외교 사정. 콘솔 한 줄이 너무 길지 않게(게임에서 확인된 가장 긴 명령 ≈ 4,100자) 두 줄로 나눈다:
 *  [0] 그레이트 칸 후계국 표식 변수 + 다른 후계국 이름, [1] 성계 이름(국경·점령·영유권) SLLM:FRSYS + 신뢰·첩보 구간 변수, [2] 공동의 적 이름 + 끝 줄 SLLM:FR_END. 같은 req, 앞에서부터 보낸다. */
export function frontierCommands(req: number, sid: string, idx: number): [string, string, string] {
  if (!Number.isSafeInteger(req) || req < 1 || !okSid(sid) || !Number.isSafeInteger(idx) || idx < 1) throw new Error('INVALID_FRONTIER');
  const row = (side: FrontSide) => `log = "SLLM:FRSYS/;/req=${req}/;/side=${side}/;/name=\\[This.GetName]"`;
  const owner = (who: string) => `exists = space_owner space_owner = { is_same_value = ${who} }`;
  const ctrl = (who: string) => `exists = controller controller = { is_same_value = ${who} }`;
  const setup = 'save_event_target_as = sllm_fr_p set_variable = { which = sllm_fr_nb value = 0 } set_variable = { which = sllm_fr_ok value = 0 }'
    + ` random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } } save_event_target_as = sllm_fr_x prev = { set_variable = { which = sllm_fr_ok value = 1 } } if = { limit = { is_neighbor_of = prev } prev = { set_variable = { which = sllm_fr_nb value = 1 } } } }`;
  const geo = [
    setup, 'if = { limit = { check_variable = { which = sllm_fr_ok value = 1 } }',
    // 국경·점령·영유권(바닐라: 국가 범위 has_claim = <성계>)
    ` every_system_within_border = { limit = { any_neighbor_system = { ${owner(X)} } } ${row('us')} }`,
    ` every_system_within_border = { limit = { ${ctrl(X)} } ${row('lost')} }`,
    ` every_system_within_border = { limit = { ${X} = { has_claim = prev } } ${row('xclaim')} }`,
    ` ${X} = { every_system_within_border = { limit = { any_neighbor_system = { ${owner(P)} } } ${row('them')} } every_system_within_border = { limit = { ${ctrl(P)} } ${row('taken')} } every_system_within_border = { limit = { ${P} = { has_claim = prev } } ${row('pclaim')} } }`,
    // 신뢰·첩보(상대 → 우리, 구간). 변수는 플레이어 나라에 남아 두 번째 명령의 끝 줄이 읽는다
    ` ${bandOf('sllm_fr_tr', (n) => `trust = { who = ${P} value >= ${n} }`)}`,
    ` ${bandOf('sllm_fr_in', (n) => `intel = { who = ${P} value >= ${n} }`)}`,
    '}',
  ].join(' ');
  const dip = [
    setup, 'if = { limit = { check_variable = { which = sllm_fr_ok value = 1 } }',
    // 공동의 적: 둘 다 전쟁 중인 나라 · 둘 다 경쟁자로 둔 나라
    ` every_country = { limit = { is_at_war_with = ${X} is_at_war_with = ${P} } ${row('foewar')} }`,
    ` every_country = { limit = { ${X} = { is_rival = prev } ${P} = { is_rival = prev } } ${row('foerival')} }`,
    // 전쟁 명분·종속·사절
    ` set_variable = { which = sllm_fr_cbx value = 0 } ${flag('sllm_fr_cbx', `${X} = { has_casus_belli = { target = ${P} } }`)} set_variable = { which = sllm_fr_cbp value = 0 } ${flag('sllm_fr_cbp', `has_casus_belli = { target = ${X} }`)}`,
    ` set_variable = { which = sllm_fr_sub value = 0 } ${flag('sllm_fr_sub', `has_overlord = ${X}`, 1)} ${flag('sllm_fr_sub', `${X} = { has_overlord = ${P} }`, 2)}`,
    ` set_variable = { which = sllm_fr_ex value = 0 } ${flag('sllm_fr_ex', `${X} = { is_improving_relations_with = ${P} }`, 1)} ${flag('sllm_fr_ex', `${X} = { is_harming_relations_with = ${P} }`, 2)}`,
    ` set_variable = { which = sllm_fr_ep value = 0 } ${flag('sllm_fr_ep', `is_improving_relations_with = ${X}`, 1)} ${flag('sllm_fr_ep', `is_harming_relations_with = ${X}`, 2)}`,
    // 은하 공동체 지위
    ` ${gcBits('sllm_fr_gx', X)} ${gcBits('sllm_fr_gp', 'this')}`,
    '}',
    `log = "SLLM:FR_END/;/req=${req}/;/sid=${sid}/;/idx=${idx}/;/found=\\[This.sllm_fr_ok]/;/nb=\\[This.sllm_fr_nb]/;/tr=\\[This.sllm_fr_tr]/;/in=\\[This.sllm_fr_in]/;/cbx=\\[This.sllm_fr_cbx]/;/cbp=\\[This.sllm_fr_cbp]/;/sub=\\[This.sllm_fr_sub]/;/ex=\\[This.sllm_fr_ex]/;/ep=\\[This.sllm_fr_ep]/;/gx=\\[This.sllm_fr_gx]/;/gp=\\[This.sllm_fr_gp]/;/kx=\\[This.sllm_fr_kx]/;/kp=\\[This.sllm_fr_kp]"`,
  ].join(' ');
  const khan = [setup, 'if = { limit = { check_variable = { which = sllm_fr_ok value = 1 } }',
    // 그레이트 칸의 후계국(바닐라 marauder_scripted_effects: origin_khan_successor + 국가 표식 diadochi / new_khanate_flag / democratic_khanate_flag)
    ` ${khanOf('sllm_fr_kx', X)} ${khanOf('sllm_fr_kp', 'this')}`,
    ` if = { limit = { OR = { check_variable = { which = sllm_fr_kx value > 0 } check_variable = { which = sllm_fr_kp value > 0 } } } every_country = { limit = { has_origin = origin_khan_successor NOT = { is_same_value = ${X} } NOT = { is_same_value = ${P} } } ${row('kin')} } }`,
    '}',
  ].join(' ');
  return [player(sid, khan), player(sid, geo), player(sid, dip)];
}
/** 두 줄을 이어 붙인 글(검사용). */
export const frontierCommand = (req: number, sid: string, idx: number): string => frontierCommands(req, sid, idx).join('\n');
const bandNum = (v: unknown, hi: number): number => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= hi ? n : -1; };
const tri = (v: unknown): 0 | 1 | 2 => (v === '1' ? 1 : v === '2' ? 2 : 0);
/** 회신 줄들 → 정보. 상대가 없으면 null. 같은 이름은 한 번만. 숫자가 이상하면 -1(모름). */
export function parseFrontier(idx: number, end: Record<string, string>, rows: Array<Record<string, string>>): Frontier | null {
  if (end.found !== '1') return null;
  const f: Frontier = { idx, neighbor: end.nb === '1', us: [], them: [], lost: [], taken: [], xclaim: [], pclaim: [], foewar: [], foerival: [], khX: bandNum(end.kx, 4), khP: bandNum(end.kp, 4), kin: [],
    trust: bandNum(end.tr, 4), intel: bandNum(end.in, 4), cbX: end.cbx === '1', cbP: end.cbp === '1', sub: tri(end.sub), envX: tri(end.ex), envP: tri(end.ep), gcX: bandNum(end.gx, 15), gcP: bandNum(end.gp, 15) };
  for (const r of rows.slice(0, FRONT.maxRows)) {
    const side = r.side as FrontSide, name = String(r.name ?? '').replace(/[\r\n"]/g, ' ').trim().slice(0, 40);
    if (!name || !SIDES.includes(side) || f[side].includes(name)) continue;
    f[side].push(name);
  }
  if (f.us.length || f.them.length) f.neighbor = true; // 항로로 맞닿은 성계가 있으면 이웃
  return f;
}
const list = (a: string[]) => a.slice(0, FRONT.maxNames).join(', ') + (a.length > FRONT.maxNames ? ` (+${a.length - FRONT.maxNames} more)` : '');
const TRUST = ['none', 'low', 'moderate', 'high', 'very high'];
const INTEL = ['almost nothing: you know little beyond their name and appearance, so do not cite their economy, fleets or internal affairs', 'little: only rough outlines of their affairs', 'a moderate amount', 'a lot', 'nearly everything'];
function gcText(bits: number): string {
  if (bits < 0) return '';
  if (bits & 8) return 'the Galactic Emperor';
  if (bits & 4) return 'the Galactic Custodian';
  if (bits & 2) return 'a member of the Galactic Council';
  if (bits & 1) return 'a member of the Galactic Community';
  return 'outside the Galactic Community';
}
const KHAN_SELF: Record<number, string> = {
  1: 'Your empire is one of the Diadochi: when the Great Khan died, the horde he had built was carved into rival successor states, and yours is one of them. Your rulers were the Khan\'s generals; your people remember the conquests and still claim lands held by the other successors. You are militarist and distrustful of outsiders, and you see yourself as a rightful heir to the Khan.',
  2: 'Your empire is the New Khanate: the Great Khan\'s own horde, turned into a settled empire after the Khan\'s death and carrying on his legacy and vision.',
  3: 'Your empire is a successor of the Great Khan\'s horde that broke away from the Khan\'s ways after his death, choosing equality and openness to other peoples over conquest.',
  4: 'Your empire was born from the Great Khan\'s horde after the Khan\'s death.',
};
const KHAN_THEM: Record<number, string> = {
  1: 'They are one of the Diadochi, the rival successor states carved from the Great Khan\'s horde after his death.',
  2: 'They are the New Khanate, the Great Khan\'s own horde turned into a settled empire after his death.',
  3: 'They are a successor of the Great Khan\'s horde that turned to equality and openness after his death.',
  4: 'They were born from the Great Khan\'s horde after the Khan\'s death.',
};
/** 그레이트 칸 후계국 줄(없으면 빈 글). */
export function khanLine(f: Frontier): string {
  const parts: string[] = [];
  if (KHAN_SELF[f.khX]) parts.push(KHAN_SELF[f.khX]);
  if (KHAN_THEM[f.khP]) parts.push(KHAN_THEM[f.khP]);
  if (!parts.length) return '';
  if (f.kin.length) parts.push(`Other successor states of the Great Khan: ${list(f.kin)}.`);
  return '[Khan\'s legacy] ' + parts.join(' ') + ' (The Great Khan is dead; how he died is not recorded, so do not invent it.)';
}
/** AI(상대 제국 쪽) 시점의 영어 줄. you = AI 제국, they = 플레이어 제국. */
export function frontierLines(f: Frontier | null | undefined, o: { atWar?: boolean } = {}): string[] {
  if (!f) return [];
  const out: string[] = [];
  if (!f.neighbor) out.push('[Geography] Your empire does not share a border with theirs; there are other systems between you. Do not speak of a shared border or frontline with them.');
  else out.push('[Geography] Your empire shares a border with theirs (connected by hyperlanes).' + (f.them.length ? ` Your border systems facing them: ${list(f.them)}.` : '') + (f.us.length ? ` Their border systems facing you: ${list(f.us)}.` : ''));
  if (f.taken.length) out.push(`[Front] They currently occupy these systems of yours: ${list(f.taken)}.`);
  if (f.lost.length) out.push(`[Front] You currently occupy these systems of theirs: ${list(f.lost)}.`);
  if (o.atWar && !f.taken.length && !f.lost.length) out.push('[Front] Neither side currently occupies the other\'s systems.');
  if (f.xclaim.length) out.push(`[Claims] You have laid claim to these systems of theirs: ${list(f.xclaim)}.`);
  if (f.pclaim.length) out.push(`[Claims] They have laid claim to these systems of yours: ${list(f.pclaim)}.`);
  if (f.cbX) out.push('[Casus belli] You hold a valid casus belli against them.');
  if (f.cbP) out.push('[Casus belli] They hold a valid casus belli against you.');
  if (f.foewar.length) out.push(`[Common enemy] You and they are both at war with: ${list(f.foewar)}.`);
  if (f.foerival.length) out.push(`[Common rival] You and they both regard as a rival: ${list(f.foerival)}.`);
  { const k = khanLine(f); if (k) out.push(k); }
  if (f.trust >= 0) out.push(`[Trust] Your trust in them: ${TRUST[f.trust]}.`);
  if (f.intel >= 0) out.push(`[Intel] How much you know about them: ${INTEL[f.intel]}.`);
  if (f.sub === 1) out.push('[Subjects] You are their overlord; they are your subject.');
  if (f.sub === 2) out.push('[Subjects] They are your overlord; you are their subject.');
  if (f.envX === 1) out.push('[Envoys] You have an envoy working to improve relations with them.');
  if (f.envX === 2) out.push('[Envoys] You have an envoy working to harm relations with them.');
  if (f.envP === 1) out.push('[Envoys] They have sent an envoy to improve relations with you.');
  if (f.envP === 2) out.push('[Envoys] They have sent an envoy to harm relations with you (you know it).');
  const gx = gcText(f.gcX), gp = gcText(f.gcP);
  if (gx && gp && (f.gcX > 0 || f.gcP > 0)) out.push(`[Galactic Community] You are ${gx}; they are ${gp}.`);
  out.push('Use only these facts and system names when talking about borders, claims, fronts or alliances; do not invent others.');
  return out;
}
/** 회의 과제 대상 목록용 짧은 표시(영어). */
export const frontierTag = (f: Frontier | null | undefined): string => (!f ? '' : (f.neighbor ? ' (borders the host)' : ' (no border with the host)') + (f.pclaim.length || f.xclaim.length ? ' (claims disputed)' : ''));

/**
 * 우리(플레이어) 쪽 시점의 영어 사실 목록(2026-10-26 「다른 기능에도」): 대사관 전문·첩보 보고·대사와 대화·전쟁 선언문.
 * secret = false(대사관이 공개적으로 아는 것): 국경·점령·영유권·공동의 적·종속·사절·은하 공동체. secret = true(첩보부): 여기에 그들의 전쟁 명분·우리에 대한 신뢰·우리에 대한 첩보 수준을 더한다.
 * 우리가 그들에게 가진 명분(cbP)은 우리 일이라 둘 다에 넣는다.
 */
export function frontierFactsUs(f: Frontier | null | undefined, o: { secret?: boolean } = {}): string[] {
  if (!f) return [];
  const out: string[] = [];
  out.push(f.neighbor ? 'Our empires share a border.' + (f.us.length ? ` Our border systems facing them: ${list(f.us)}.` : '') + (f.them.length ? ` Their border systems facing us: ${list(f.them)}.` : '') : 'Our empires do not share a border.');
  if (f.lost.length) out.push(`They occupy these systems of ours: ${list(f.lost)}.`);
  if (f.taken.length) out.push(`We occupy these systems of theirs: ${list(f.taken)}.`);
  if (f.xclaim.length) out.push(`They claim these systems of ours: ${list(f.xclaim)}.`);
  if (f.pclaim.length) out.push(`We claim these systems of theirs: ${list(f.pclaim)}.`);
  if (f.cbP) out.push('We hold a valid casus belli against them.');
  if (f.foewar.length) out.push(`We and they are both at war with: ${list(f.foewar)}.`);
  if (f.foerival.length) out.push(`We and they share a rival: ${list(f.foerival)}.`);
  if (f.sub === 1) out.push('They are our overlord.');
  if (f.sub === 2) out.push('They are our subject.');
  if (f.envX === 1) out.push('They have an envoy improving relations with us.');
  if (f.envX === 2) out.push('They have an envoy working against us.');
  if (f.envP === 1) out.push('Our envoy is improving relations with them.');
  if (f.envP === 2) out.push('Our envoy is working to harm relations with them.');
  const gx = gcText(f.gcX); if (gx && f.gcX > 0) out.push(`They are ${gx}.`);
  if (KHAN_THEM[f.khX]) out.push(KHAN_THEM[f.khX]);
  if (o.secret) {
    if (f.cbX) out.push('They hold a valid casus belli against us.');
    if (f.trust >= 0) out.push(`Their trust in us: ${TRUST[f.trust]}.`);
    if (f.intel >= 0) out.push(`How much they know about us: ${['almost nothing', 'little', 'a moderate amount', 'a lot', 'nearly everything'][f.intel]}.`);
  }
  return out;
}
/** 다른 나라가 우리와 어떤 사이인지 짧게(규탄 성명 화자용, 영어). 모르면 빈 글. */
export function frontierBrief(f: Frontier | null | undefined): string {
  if (!f) return '';
  const p: string[] = [];
  if (f.neighbor) p.push('borders the player');
  if (f.lost.length || f.taken.length) p.push('has occupied or lost systems to the player');
  if (f.xclaim.length || f.pclaim.length) p.push('has disputed claims with the player');
  if (f.foewar.length) p.push(`fights alongside the player against ${list(f.foewar)}`);
  if (f.sub === 1) p.push('is the player\'s overlord'); else if (f.sub === 2) p.push('is the player\'s subject');
  return p.join('; ');
}

/** 신문·라디오용 전선 한 줄(우리 시점, 영어, 2026-10-26). 우리와 전쟁 중인 나라 하나. */
export function frontNewsLine(enemy: string, f: Frontier | null | undefined): string {
  if (!f) return '';
  const e = String(enemy || 'the enemy').replace(/[\r\n]/g, ' ').slice(0, 80), p: string[] = [];
  if (f.lost.length) p.push(`${e} holds these systems of ours: ${list(f.lost)}`);
  if (f.taken.length) p.push(`we hold these systems of theirs: ${list(f.taken)}`);
  if (!p.length) p.push('no systems have changed hands yet');
  return `War front with ${e} (${f.neighbor ? 'a neighbouring empire' : 'not a neighbour'}): ${p.join('; ')}.`;
}
