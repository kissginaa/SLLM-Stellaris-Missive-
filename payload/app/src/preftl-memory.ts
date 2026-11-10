// 기억 제국(2026-11-03 사용자 결정 ⑤): 우리가 지켜본 원시문명이 정식 제국이 되면, 반란국처럼 「특별한 기억」을 지닌 제국으로 남긴다.
// 그동안의 관측·개입·하늘의 목소리 신앙·후일담을 그 제국의 연대기(chronNote, 연락처 번호별)에 한 번 적는다 → 외교 대화 프롬프트의 연대기로 들어가고,
// 오래되면 기억 장(memory-app chapters)으로 접혀 계속 남는다. 우리가 정복해 흡수했으면 세계 소식(우리 연대기)에 남긴다.
// 순수 로직. 앱: src/features/preftl-app.ts.
import { L } from './i18n-pick';
import { type Civ, type CivEvent, ACT_NAMES, ageEn, ageName } from './preftl';
import type { Faith, Aftermath } from './preftl-voice';

export type Fate = 'uplifted' | 'conquered' | 'lost';
const norm = (s: string | undefined) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
/** 연락처 이름과 원시문명 이름이 같은 나라인지(정식 제국이 되어도 이름은 대개 그대로). */
export const sameName = (a: string | undefined, b: string | undefined) => !!norm(a) && norm(a) === norm(b);

/** 그 제국이 기억하는 우리(대화에 쓰이는 연대기 한 줄, 화면 언어). 그들이 「목소리 = 우리」인 것을 아는지는 인지도로 정한다. */
export function memoryText(c: Civ, events: CivEvent[], f: Faith | undefined, after: Aftermath[], empire: string, date: string): string {
  const acts = [...new Set(events.filter((e) => e.kind === 'act' && e.a).map((e) => e.a as number))].filter((w) => w < 10).map((w) => ACT_NAMES[w]).filter(Boolean);
  const knew = c.lv >= 4, parts: string[] = [];
  parts.push(L(`별의 세계로 나오기 전, ${empire}은(는) 관측소에서 몰래 그들을 지켜보았다(처음 관측 ${c.first}, ${c.age >= 1 ? ageName(c.age) : '?'}까지).`,
    `Before they reached the stars, ${empire} secretly watched them from an observation post (first seen ${c.first}, up to the ${c.age >= 1 ? ageEn(c.age) : '?'}).`));
  if (acts.length) parts.push(L(`우리는 몰래 개입했다: ${acts.map((a) => a[0]).join(', ')}.`, `We secretly intervened: ${acts.map((a) => a[1]).join(', ')}.`));
  if (f && f.sessions) {
    const nm = f.name || L('하늘의 목소리', 'the Voice from the Sky');
    parts.push(knew
      ? L(`그들이 「${nm}」(이)라 부르며 섬기던 하늘의 목소리가 사실은 우리였다는 것을 그들은 안다(교신 ${f.sessions}번, 열성도 ${f.devotion}).`, `They know that the voice from the sky they worshipped as "${nm}" was really us (${f.sessions} conversation(s), devotion ${f.devotion}).`)
      : L(`그들은 「${nm}」(이)라는 하늘의 목소리를 섬겼다(교신 ${f.sessions}번, 열성도 ${f.devotion}). 그것이 우리였다는 것은 아직 모른다.`, `They worshipped a voice from the sky called "${nm}" (${f.sessions} conversation(s), devotion ${f.devotion}). They do not yet know it was us.`));
  }
  const last = after.slice(-2).map((a) => a.headline).filter(Boolean);
  if (last.length) parts.push(L(`그들의 역사에 남은 일: ${last.map((x) => `「${x}」`).join(', ')}.`, `Events in their history: ${last.map((x) => `"${x}"`).join(', ')}.`));
  void date; return parts.join(' '); // 날짜는 연대기가 붙인다
}
/** 우리가 정복해 흡수했을 때 우리 연대기(세계 소식) 한 줄. */
export function conquestText(c: Civ, f: Faith | undefined, date: string): string {
  return L(`${date} 우리가 지켜보던 원시문명 「${c.name}」이(가) 우리 제국에 흡수되었다.${f && f.sessions ? ` 그들은 하늘의 목소리 「${f.name || '하늘의 목소리'}」를 기억한다.` : ''}`,
    `${date} The pre-FTL "${c.name}" we had been watching was absorbed into our empire.${f && f.sessions ? ` They still remember the voice from the sky, "${f.name || 'the Voice'}".` : ''}`);
}
/** 비서가 알 수 있는 사실(영어). */
export function memoryFact(c: Civ, fate: Fate, f: Faith | undefined): string {
  const how = fate === 'uplifted' ? 'became a star empire' : fate === 'conquered' ? 'was absorbed into our empire' : 'disappeared (conquered or destroyed by someone)';
  return `Former pre-FTL ${c.name}${c.newName && c.newName !== c.name ? ` (now ${c.newName})` : ''} ${how}.${f && f.sessions ? ` They once worshipped our "voice from the sky"${f.name ? ` as "${f.name}"` : ''}.` : ''}`;
}
