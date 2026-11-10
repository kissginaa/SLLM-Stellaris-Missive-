// 게임에 들어가는 글자 정리(2026-10-29, AiLive aic_plaintext/aic_utf8 참고 — 아이디어만).
// AI·플레이어 글에 섞인 둥근 따옴표·줄표·특수 공백·폭 없는 문자는 게임 글꼴에서 네모(□)로 깨지거나 명령을 망가뜨릴 수 있다.
// 문장부호(U+2000~U+206F)·NBSP·소프트 하이픈만 평범한 글자로 바꾸고, 글자(한글·악센트 등)는 건드리지 않는다.
// 자를 때는 바이트가 아니라 글자(코드 포인트) 단위로 자른다(서로게이트 쌍이 반쪽 나지 않게).
const MAP: Record<string, string> = {
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
  '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201b': "'", '\u2032': "'", '\u2039': "'", '\u203a': "'",
  '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u201f': '"', '\u2033': '"', '\u00ab': '"', '\u00bb': '"',
  '\u2026': '...', '\u2022': '*', '\u2027': '.', '\u00ad': '',
};
/** 문장부호 접기: 공백류 → 한 칸, 폭 없는·방향 문자 → 없음, 따옴표·줄표·줄임표 → 평범한 글자. */
export function plainPunct(s: string): string {
  return String(s ?? '')
    .replace(/[\u00a0\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/[\u00ab\u00ad\u00bb\u2010-\u2027\u2032\u2033\u2039\u203a\u2212]/g, (c) => MAP[c] ?? '')
    .replace(/[\u2030-\u205e]/g, '') // 그 밖의 일반 문장부호 블록은 버린다
    .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, ''); // 짝 잃은 서로게이트
}
/** 글자(코드 포인트) 단위로 자르기. */
export const cutChars = (s: string, max: number): string => { const a = Array.from(s); return a.length > max ? a.slice(0, max).join('') : s; };
/** 게임 명령의 "..." 안에 넣을 글: 문장부호 접기 + 명령을 깨는 글자 빼기 + 글자 단위 자르기. */
export function gameText(s: string, max = 60): string {
  return cutChars(plainPunct(s).replace(/["\\[\]{}$§£#\r\n\t]/g, '').replace(/\s+/g, ' ').trim(), max).trim();
}
