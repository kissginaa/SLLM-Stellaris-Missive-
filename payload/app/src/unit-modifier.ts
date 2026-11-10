// 단위 수정자 × 배수(알파 11, 2026-10-25, DTP 기법 채용 — 사용자 결정 「1·2번 전체 적용」).
// 수정자 하나를 「1 단위」(+1%, +1/월 등)로 정의하고, 붙일 때 배수로 크기를 정한다. 게임 원본(overlord_effects.txt)처럼 배수는 변수로 넘긴다.
// 같은 수정자는 하나만 유지(지우고 다시 붙임). 기간 -1 = 영구.
export const MOD_MULT_VAR = 'sllm_mod_mult';
export function unitModifierEffect(modifier: string, mult: number, days: number): string {
  if (!/^sllm_[a-z0-9_]{1,60}$/.test(modifier)) throw new Error('INVALID_MODIFIER');
  if (!Number.isFinite(mult) || mult === 0 || Math.abs(mult) > 100000) throw new Error('INVALID_MULT');
  if (!Number.isSafeInteger(days) || (days < 1 && days !== -1) || days > 36000) throw new Error('INVALID_DAYS');
  const m = Math.round(mult * 1000) / 1000;
  return `remove_modifier = ${modifier} set_variable = { which = ${MOD_MULT_VAR} value = ${m} } add_modifier = { modifier = ${modifier} days = ${days} multiplier = ${MOD_MULT_VAR} } clear_variable = ${MOD_MULT_VAR}`;
}
