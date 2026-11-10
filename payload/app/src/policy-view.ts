// 정책으로 보는 호감(2026-11-05 사용자, Advanced Policies 「opinion_policy」 참고 — 묶음·수치는 우리식).
// AI 제국은 우리(플레이어) 내정 정책 가운데 가치관이 드러나는 것(숙청·난민·AI 권리·전쟁 철학·첫 접촉·종속 조건·원시 지성·인구 통제)을 자기 것과 견주어 호감을 더하고 뺀다.
// 게임 쪽: tester-mod/common/opinion_modifiers/sllm_policy_view.txt(이 표에서 만든 것과 같은 값 — 고칠 때 둘 다) · 대화 쪽: 아래 policyTalkLine 이 프롬프트에 한 줄.
// 노예제·궤도 폭격·간섭은 게임 원본이 이미 가치관으로 보므로 넣지 않는다.
export interface PolRule { root: string[]; from: string[]; add: number; en: string }
export interface PolCat { key: string; ko: string; en: string; rules: PolRule[] }
export const POLICY_VIEW: PolCat[] = [
  { key: 'purge', ko: '숙청에 대한 시각', en: 'Views on Purges', rules: [
    { root: ['purge_not_allowed'], from: ['purge_allowed'], add: -15, en: 'they allow purges, which you forbid and find abhorrent' },
    { root: ['purge_not_allowed'], from: ['purge_displacement_only'], add: -5, en: 'they forcibly displace populations, which you forbid' },
    { root: ['purge_allowed'], from: ['purge_allowed'], add: 5, en: 'they, like you, allow purges — a grim kinship' }] },
  { key: 'refugees', ko: '난민에 대한 시각', en: 'Views on Refugees', rules: [
    { root: ['refugees_allowed'], from: ['refugees_not_allowed'], add: -5, en: 'they turn refugees away, while you take them in' },
    { root: ['refugees_allowed'], from: ['refugees_allowed'], add: 5, en: 'they, like you, open their doors to refugees' }] },
  { key: 'ai', ko: 'AI 권리에 대한 시각', en: 'Views on AI Rights', rules: [
    { root: ['ai_full_rights'], from: ['ai_outlawed', 'ai_servitude'], add: -10, en: 'they deny artificial minds the rights you grant them' },
    { root: ['ai_outlawed'], from: ['ai_full_rights'], add: -5, en: 'they grant full rights to the artificial minds you outlaw' },
    { root: ['ai_full_rights'], from: ['ai_full_rights'], add: 5, en: 'they, like you, give artificial minds full rights' },
    { root: ['ai_outlawed'], from: ['ai_outlawed'], add: 5, en: 'they, like you, outlaw artificial intelligence' }] },
  { key: 'war', ko: '전쟁 철학에 대한 시각', en: 'Views on War Philosophy', rules: [
    { root: ['no_wars'], from: ['unrestricted_wars'], add: -10, en: 'their doctrine allows unrestricted wars, while you reject offensive war' },
    { root: ['liberation_wars'], from: ['unrestricted_wars'], add: -5, en: 'their doctrine allows unrestricted wars, while you fight only to liberate' },
    { root: ['no_wars'], from: ['no_wars'], add: 5, en: 'they, like you, renounce wars of aggression' },
    { root: ['liberation_wars'], from: ['liberation_wars'], add: 5, en: 'they, like you, fight only wars of liberation' },
    { root: ['unrestricted_wars'], from: ['unrestricted_wars'], add: 5, en: 'they, like you, wage war without restraint' }] },
  { key: 'contact', ko: '첫 접촉 방침에 대한 시각', en: 'Views on First Contact', rules: [
    { root: ['first_contact_proactive', 'first_contact_cautious'], from: ['first_contact_attack_allowed'], add: -10, en: 'they allow firing on newly met species, which you do not' },
    { root: ['first_contact_attack_allowed'], from: ['first_contact_attack_allowed'], add: 5, en: 'they, like you, shoot first at strangers' }] },
  { key: 'terms', ko: '종속 조건에 대한 시각', en: 'Views on Subjugation Terms', rules: [
    { root: ['benevolent_terms'], from: ['oppressive_terms'], add: -5, en: 'they impose oppressive terms on their subjects, while you are benevolent' },
    { root: ['benevolent_terms'], from: ['benevolent_terms'], add: 3, en: 'they, like you, treat subjects benevolently' },
    { root: ['oppressive_terms'], from: ['oppressive_terms'], add: 3, en: 'they, like you, keep their subjects on a short leash' }] },
  { key: 'presapient', ko: '원시 지성에 대한 시각', en: 'Views on Pre-sapients', rules: [
    { root: ['pre_sapients_protect'], from: ['pre_sapients_eat', 'pre_sapients_purge'], add: -10, en: 'they eat or exterminate pre-sapient creatures you protect' },
    { root: ['pre_sapients_protect'], from: ['pre_sapients_protect'], add: 3, en: 'they, like you, protect pre-sapient life' }] },
  { key: 'popcontrol', ko: '인구 통제에 대한 시각', en: 'Views on Population Controls', rules: [
    { root: ['population_controls_not_allowed'], from: ['population_controls_allowed'], add: -5, en: 'they control their people\'s births, which you forbid' }] },
];
/** 세이브의 정책 선택지 → 정책 표식(대부분 같은 이름, 몇 개만 다름) */
const OPTION_FLAG: Record<string, string> = { oppressive_corporate_terms: 'oppressive_terms', balanced_corporate_terms: 'balanced_terms', benevolent_corporate_terms: 'benevolent_terms', robot_pops_outlawed: 'robots_outlawed', robot_pops_allowed: 'robots_allowed' };
export const policyFlags = (selected: string[]): Set<string> => new Set(selected.map((s) => OPTION_FLAG[s] ?? s));
/** 정책 하나에서 맞는 규칙(규칙은 위에서부터 하나만 — 게임 opinion 의 modifier 들도 서로 겹치지 않게 짜 두었다) */
export function policyView(ai: string[], me: string[]): { cat: PolCat; rule: PolRule }[] {
  const a = policyFlags(ai), b = policyFlags(me), out: { cat: PolCat; rule: PolRule }[] = [];
  for (const cat of POLICY_VIEW) { const r = cat.rules.find((x) => x.root.some((f) => a.has(f)) && x.from.some((f) => b.has(f))); if (r) out.push({ cat, rule: r }); }
  return out;
}
/** 대화 프롬프트 한 줄(영어 지시문). 없으면 ''. */
export function policyTalkLine(ai: string[] | undefined, me: string[] | undefined, player: string): string {
  if (!ai?.length || !me?.length) return '';
  const v = policyView(ai, me); if (!v.length) return '';
  const pos = v.filter((x) => x.rule.add > 0).map((x) => x.rule.en), neg = v.filter((x) => x.rule.add < 0).map((x) => x.rule.en);
  const parts = [neg.length ? `you disapprove because ${neg.join('; ')}` : '', pos.length ? `you feel some affinity because ${pos.join('; ')}` : ''].filter(Boolean);
  return `How you see "${player}"'s domestic policies (already counted in your opinion of them): ${parts.join('; and ')}. Bring this up only when it fits — e.g. criticise or praise it in your own voice.`;
}
/** 게임 opinion_modifiers 파일 본문(생성 — tools 없이 이 함수로 만든다) */
export function policyOpinionFile(): string {
  // BOM 을 붙이지 않는다(2026-11-08 error.log: BOM 뒤에 바로 # 주석이 오면 첫 줄이 주석으로 안 읽혀 이 파일 전체가 깨졌다)
  const mod = (r: PolRule) => `\t\tmodifier = {\n\t\t\tadd = ${r.add}\n\t\t\t${r.root.length > 1 ? `OR = { ${r.root.map((f) => `has_policy_flag = ${f}`).join(' ')} }` : `has_policy_flag = ${r.root[0]}`}\n\t\t\tFROM = { ${r.from.length > 1 ? `OR = { ${r.from.map((f) => `has_policy_flag = ${f}`).join(' ')} }` : `has_policy_flag = ${r.from[0]}`} }\n\t\t}`;
  const head = '# 정책으로 보는 호감(2026-11-05) — 자동 생성: 앱 src/policy-view.ts policyOpinionFile(). 손으로 고치지 말 것(표를 고치고 다시 만든다).\n# ROOT = 호감을 갖는 쪽(AI 제국), FROM = 보는 대상(플레이어). 통신이 있어야 서로의 내정을 안다.\n';
  return head + POLICY_VIEW.map((c) => `\nsllm_pol_${c.key} = {\n\ttrigger = {\n\t\tis_ai = yes\n\t\tFROM = { is_ai = no }\n\t\thas_communications = FROM\n\t}\n\topinion = {\n\t\tbase = 0\n${c.rules.map(mod).join('\n')}\n\t}\n}`).join('\n') + '\n';
}
export function policyLoc(lang: 'english' | 'korean'): string {
  return '﻿l_' + lang + ':\n' + POLICY_VIEW.map((c) => ` sllm_pol_${c.key}:0 "${lang === 'korean' ? c.ko : c.en}"`).join('\n') + '\n';
}
