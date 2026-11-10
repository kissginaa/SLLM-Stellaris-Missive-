// 비상대권(2026-11-05 사용자, Advanced Policies 「Empire Readiness」 참고 — 이름·단계·수치는 우리식). 순수 규칙.
// 앱: src/features/emp-app.ts · 화면: ui/office-emergency.js(집무실 「비상대권」) · 연결 모드: common/scripted_effects/sllm_emp.txt · events/sllm_emp_events.txt
// 1 경계 → 2 전시 체제 → 3 총동원. 전쟁 중에만 올리고(한 번에 한 단계, 올린 뒤 180일), 내리기는 언제든.
// 전쟁 없이 석 달이 지나면 「내려놓을지 쥘지」. 아홉 달이 되도록 정하지 않으면 쥔 것으로 굳는다. 쥐고 있으면 해마다 평의회가 반발한다(틀 문장, LLM 없음).
export interface EmpLevel { lv: number; ko: string; en: string; fx: [string, string] }
export const EMP_LEVELS: EmpLevel[] = [
  { lv: 0, ko: '평시', en: 'Peacetime', fx: ['효과 없음', 'No effect'] },
  { lv: 1, ko: '경계', en: 'Alert', fx: ['조선 속도 +10% · 지상군 훈련 +20% · 안정도 −2', 'Shipyards +10% · army training +20% · stability −2'] },
  { lv: 2, ko: '전시 체제', en: 'War footing', fx: ['조선 속도 +20% · 지상군 훈련 +40% · 함선 연사 +5% · 안정도 −5 · 행복도 −5%', 'Shipyards +20% · army training +40% · fire rate +5% · stability −5 · happiness −5%'] },
  { lv: 3, ko: '총동원', en: 'Total mobilisation', fx: ['조선 속도 +30% · 지상군 훈련 +60% · 함선 연사 +10% · 지상군 피해 +20% · 안정도 −10 · 행복도 −10%', 'Shipyards +30% · army training +60% · fire rate +10% · army damage +20% · stability −10 · happiness −10%'] },
];
export const EMP_RULES = { cooldownDays: 180, peaceAsk: 3, peaceLock: 9, backlashMonths: 12, grip: ['권위주의 끌림 +25% · 안정도 −3', 'Authoritarian attraction +25% · stability −3'] as [string, string], ret: ['2년간 안정도 +3 · 행복도 +3%', 'Stability +3 and happiness +3% for two years'] as [string, string] } as const;

export type EmpAct = 'state' | 'up' | 'down' | 'release' | 'hold';
const wrap = (sid: string, body: string) => `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;
/** 상태 한 줄은 연결 모드 sllm_emp_report(common/scripted_effects/sllm_emp.txt)가 쓴다: lv(0~3) · war · st(none · ask 내려놓을지 물을 때 · hold 쥐고 있음) · cd(올리기 쉼) */
/** 안 된 까닭 → 번호(로그에는 번호로 찍힌다). 0 = 없음 */
export const EMP_WHY_N = ['', 'peace', 'cooldown', 'max', 'none', 'war', 'held'];
const stateLog = (req: number, ok: '0' | '1' | '2', why: string) => `sllm_emp_report = { REQ = ${req} OK = ${ok} WHY = ${Math.max(0, EMP_WHY_N.indexOf(why))} }`;
/** act 를 해 보고(조건이 안 되면 그대로) 상태를 돌려준다. ok=1/0 · why(안 된 까닭). */
export function empCommand(req: number, sid: string, act: EmpAct): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error('INVALID_EMP');
  const lvGt = (n: number) => `check_variable = { which = sllm_emp_lv value > ${n} }`;
  const tries: Record<Exclude<EmpAct, 'state'>, Array<[string, string]>> = { // [조건, 안 될 때 why] — 차례로 보고 처음 막힌 것이 why
    up: [['is_at_war = yes', 'peace'], ['NOT = { has_country_flag = sllm_emp_cd }', 'cooldown'], ['NOT = { check_variable = { which = sllm_emp_lv value >= 3 } }', 'max']],
    down: [[lvGt(0), 'none']], release: [[lvGt(0), 'none']],
    hold: [[lvGt(0), 'none'], ['is_at_war = no', 'war'], ['NOT = { has_country_flag = sllm_emp_hold }', 'held']],
  };
  const doIt: Record<Exclude<EmpAct, 'state'>, string> = { up: 'sllm_emp_up = yes', down: 'sllm_emp_down = yes', release: 'sllm_emp_end = yes', hold: 'sllm_emp_hold_on = yes' };
  if (act === 'state') return wrap(sid, stateLog(req, '2', ''));
  const t = tries[act];
  const why = t.map(([c, w], i) => `${i ? 'else_if' : 'if'} = { limit = { NOT = { ${c} } } set_country_flag = sllm_emp_why_${w} }`).join(' ');
  const out = t.map(([, w]) => `if = { limit = { has_country_flag = sllm_emp_why_${w} } remove_country_flag = sllm_emp_why_${w} ${stateLog(req, '0', w)} }`).join(' ');
  return wrap(sid, `${why} if = { limit = { ${t.map(([c]) => c).join(' ')} } ${doIt[act]} ${stateLog(req, '1', '')} } ${out}`);
}
export interface EmpState { lv: number; war: boolean; st: 'none' | 'ask' | 'hold'; cd: boolean }
export function parseEmp(kv: Record<string, string>): EmpState | null {
  const lv = Number(kv.lv); if (!Number.isInteger(lv) || lv < 0 || lv > 3) return null;
  const st = kv.st === 'ask' || kv.st === 'hold' ? kv.st : 'none';
  return { lv, war: kv.war === '1', st, cd: kv.cd === '1' };
}
export const EMP_WHY: Record<string, [string, string]> = {
  peace: ['비상대권은 전쟁 중에만 올릴 수 있습니다.', 'Emergency powers can only be raised in wartime.'],
  cooldown: ['올린 지 얼마 되지 않았습니다. 180일이 지나야 한 단계 더 올릴 수 있습니다.', 'You raised them recently. Wait 180 days before raising them again.'],
  max: ['이미 총동원입니다.', 'Already at total mobilisation.'],
  none: ['비상대권이 선포되어 있지 않습니다.', 'No emergency powers are in force.'],
  war: ['전쟁 중에는 「쥐고 있기」를 고를 수 없습니다. 전쟁 중이니 당연히 쥐고 있는 겁니다.', 'You cannot choose to hold on while at war — in wartime they are yours anyway.'],
  held: ['이미 쥐고 계십니다.', 'You are already holding on.'],
};
// ---- 평의회의 말(틀 문장). {lv} 단계 이름
const pick = <T>(a: T[], seed: string): T => { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return a[(h >>> 0) % a.length]; };
export const EMP_LINES: Record<'up' | 'down' | 'release' | 'releaseAfter' | 'hold' | 'peace' | 'hold_auto' | 'backlash', Array<[string, string]>> = {
  up: [['비상대권을 「{lv}」(으)로 올렸습니다. 국방 장관이 고개를 끄덕이고, 내무 장관은 말없이 받아 적습니다.', 'Emergency powers raised to "{lv}". The defence minister nods; the interior minister writes it down without a word.'],
    ['「{lv}」 선포. 조선소에 불이 켜지고, 거리의 표정이 굳어집니다.', '"{lv}" declared. The shipyards light up, and faces in the streets harden.']],
  down: [['비상대권을 「{lv}」(으)로 낮췄습니다. 평의회실의 공기가 조금 풀립니다.', 'Emergency powers lowered to "{lv}". The air in the council chamber loosens a little.']],
  release: [['비상대권을 모두 거두었습니다.', 'All emergency powers have been withdrawn.']],
  releaseAfter: [['전쟁이 끝났고, 약속대로 비상대권을 내려놓았습니다. 평의회가 오랜만에 박수를 칩니다. 주민들도 안도합니다.', 'The war is over and, as promised, the emergency powers are laid down. The council applauds for the first time in a long while, and the people breathe easier.'],
    ['권한을 돌려주셨습니다. 역사책에 남을 장면입니다 — 쥘 수 있었는데 내려놓은 통치자로.', 'You gave the powers back. History will remember it: a ruler who could have held on, and chose not to.']],
  hold: [['「조금만 더」라고 하셨습니다. 국방 장관은 안도하지만, 몇몇 평의원은 시선을 피합니다.', '"A little longer," you said. The defence minister is relieved, but several councilors look away.'],
    ['비상대권을 쥐고 계시기로 했습니다. 권위주의자들은 반기고, 나머지는 셈을 하기 시작합니다.', 'You will keep the emergency powers. The authoritarians rejoice; everyone else starts counting.']],
  peace: [['전쟁이 끝났습니다. 비상대권을 내려놓으시겠습니까, 아니면 조금 더 쥐고 계시겠습니까? 집무실 「비상대권」에서 정해 주십시오.', 'The war is over. Will you lay down the emergency powers, or hold on a little longer? Decide under "Emergency powers" in the office.']],
  hold_auto: [['결정을 미루시는 사이, 비상대권은 그대로 굳어 버렸습니다. 평의회에서는 「이제 평시가 아니라 이게 평시」라는 말이 나옵니다.', 'While you put off the decision, the emergency powers simply set in place. In the council, someone mutters that this is peacetime now.']],
  backlash: [['평의회에서 불만이 터졌습니다. 「전쟁은 끝났는데 언제까지 비상시국입니까?」', 'Discontent erupts in the council: "The war is over — how long is this emergency going to last?"'],
    ['내무 장관이 조용히 보고합니다. 비상대권을 거두라는 청원이 각 행성에서 올라오고 있다고.', 'The interior minister reports quietly: petitions to end the emergency powers are arriving from every world.'],
    ['한 평의원이 공개적으로 묻습니다. 「우리가 지키려던 게 이런 나라였습니까?」', 'A councilor asks openly: "Is this the realm we were fighting to protect?"']],
};
export function empLine(kind: keyof typeof EMP_LINES, ko: boolean, lv: number, seed = ''): string {
  const pair = pick(EMP_LINES[kind], kind + seed), L = EMP_LEVELS[Math.max(0, Math.min(3, lv))];
  return (ko ? pair[0] : pair[1]).replace(/\{lv\}/g, ko ? L.ko : L.en);
}
