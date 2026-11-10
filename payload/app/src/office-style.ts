// 집무실 종류(2026-10-19 사용자 결정): 제국 가치관(권위주의·외계인 친화·외계인 혐오 등)에 따라 집무실 배경이 달라진다.
// 배경 그림은 GPT(ChatGPT)가 그린다(docs/GPT_SECRETARY_TODO_KO.md) → ui/assets/rooms/office-<키>.png. 없으면 기본 집무실(office-ai-v1.png).
// 기본은 「자동」(세이브에서 읽은 우리 제국 가치관), 집무실의 「집무실 꾸미기」 단추로 직접 고를 수 있다(세이브마다 기억).
export const OFFICE_STYLES: Array<[string, string, string]> = [
  ['standard', '기본 집무실', 'Standard office'],
  ['authoritarian', '권위주의 · 제국풍', 'Authoritarian · Imperial'],
  ['egalitarian', '평등주의 · 공화정풍', 'Egalitarian · Republican'],
  ['xenophile', '외계인 친화', 'Xenophile'],
  ['xenophobe', '외계인 혐오', 'Xenophobe'],
  ['militarist', '군국주의', 'Militarist'],
  ['pacifist', '평화주의', 'Pacifist'],
  ['spiritualist', '유심론', 'Spiritualist'],
  ['materialist', '물질주의', 'Materialist'],
  ['gestalt', '군체 의식 · 공명', 'Hive mind · Resonance'], // 키는 예전 그대로(gestalt) — 그림 office-gestalt.png 가 군체풍이라 군체 집무실로 쓴다(알파 11)
  ['machine', '기계 지성 · 연산 코어', 'Machine intelligence · Processing core'], // 알파 11: 그림(office-machine.png)이 없으면 군체 집무실 그림으로 보인다
];
export const isOfficeStyle = (k: unknown): k is string => typeof k === 'string' && OFFICE_STYLES.some(([x]) => x === k);
/** 색 테마 자동(알파 11): 집무실 자동과 같은 규칙 — 기계 → machine, 군체(또는 종류 모를 단일 의식) → hive, 그 밖에는 주 가치관 테마, 모르면 기본형. */
export function autoTheme(ethics: string[] | null | undefined, gest: string = ''): string {
  const k = autoOfficeStyle(ethics, gest);
  return k === 'gestalt' ? 'hive' : k === 'standard' ? 'stellaris' : k;
}
/** 자동으로 고를 때 같은 단계에서의 우선순위(눈에 띄는 것부터). */
const ORDER = ['xenophobe', 'xenophile', 'authoritarian', 'egalitarian', 'militarist', 'pacifist', 'spiritualist', 'materialist'];
/** 세이브의 가치관(ethic_fanatic_xenophobe, ethic_authoritarian, ethic_gestalt_consciousness …) → 집무실 종류. 모르면 standard. 광신 가치관이 먼저. */
export function autoOfficeStyle(ethics: string[] | null | undefined, gest: string = ''): string {
  const e = (ethics ?? []).map((x) => String(x || '').toLowerCase());
  if (gest === 'machine') return 'machine'; // 기계 지성(알파 11)
  if (gest === 'hive' || e.some((x) => x.includes('gestalt'))) return 'gestalt';
  const fan = ORDER.find((k) => e.includes('ethic_fanatic_' + k)); if (fan) return fan;
  return ORDER.find((k) => e.includes('ethic_' + k)) ?? 'standard';
}
