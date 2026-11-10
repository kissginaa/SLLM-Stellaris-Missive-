// 앱 화면의 색 테마. 테마 정의 자체는 화면(ui/index.html)에 있고, 여기서는 저장된 값을 검증한다.
// 사용자가 고른 색(custom)은 허용한 항목만, #rrggbb 형식만 받는다.
// stellaris = 기본형(지금 모양). A-22 가치관 테마 10종은 ui/theme.js 에 색과 연출이 있다.
export const ETHIC_THEMES = ['egalitarian', 'authoritarian', 'militarist', 'pacifist', 'materialist', 'spiritualist', 'xenophile', 'xenophobe', 'machine', 'hive'] as const;
/** A-22 2단계: 바닐라 홀로그램풍(스텔라리스 원래 UI 느낌을 CSS로만 흉내, 게임 그림은 쓰지 않음) */
export const EXTRA_THEMES = ['holo'] as const;
export const THEME_NAMES = ['stellaris', 'terminal', 'starfield', 'custom', ...ETHIC_THEMES, ...EXTRA_THEMES, 'auto'] as const; // auto: 우리 제국 가치관에 맞춤(알파 11, ui/theme.js 가 앱에 물어 고른다)
export type ThemeName = (typeof THEME_NAMES)[number];
export const CUSTOM_KEYS = ['bg', 'panel', 'text', 'hi', 'gold'] as const;
export type CustomColors = Partial<Record<(typeof CUSTOM_KEYS)[number], string>>;

export function sanitizeTheme(v: unknown): ThemeName {
  return (THEME_NAMES as readonly string[]).includes(v as string) ? (v as ThemeName) : 'stellaris';
}
export function sanitizeCustom(v: unknown): CustomColors {
  const out: CustomColors = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of CUSTOM_KEYS) {
    const c = (v as Record<string, unknown>)[k];
    if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) out[k] = c.toLowerCase();
  }
  return out;
}

/** 사용자 CSS 파일의 처음 내용(주석으로 쓸 수 있는 항목 안내). */
export const CUSTOM_CSS_TEMPLATE = `/* 내 CSS: 저장한 뒤 앱 설정의 "CSS 다시 불러오기"를 누르면 바로 적용됩니다. */
/* 아래 예시의 바깥 주석 표시를 지우면 켜집니다. 바꿀 수 있는 색 변수 목록입니다.
:root{
  --bg:#06141b; --panel:#0b2230; --text:#dcecf0; --dim:#7fa3ad;
  --hi:#5fd4e4; --hi-text:#04161d; --ai:#7fe3f0; --gold:#e8c872;
  --bad:#e0705f; --good:#6fd6a8; --linec:#5fd4e4;
}
body{ font-size:14px; }
*/
`;
