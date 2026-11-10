// 은하 위기 특집 방송(2026-10-17): 종말 위기가 은하에 있는 동안 신문은 "위기 특별판", 라디오는 "긴급 특별 방송"으로 바뀐다.
// 순수 로직만 둔다. 모드가 매달 CRISIS(kind)… → CRISIS_END 를 남기고, 앱은 묶음마다 지금 있는 위기 목록을 새로 정한다.
import { L } from './i18n-pick';

export const CRISIS_KINDS: Record<string, { ko: string; en: string }> = {
  prethoryn: { ko: '프레소린 스컬지', en: 'Prethoryn Scourge' },
  unbidden: { ko: '언비든', en: 'The Unbidden' },
  contingency: { ko: '컨틴전시', en: 'The Contingency' },
  cetana: { ko: '세타나', en: 'Cetana' },
  khan: { ko: '그레이트 칸', en: 'The Great Khan' },
  wih: { ko: '하늘의 전쟁', en: 'The War in Heaven' }, // 각성한 몰락제국 둘의 전쟁(알파 11, 게임 전역 깃발 war_in_heaven_ongoing). 종말 위기는 아니라 문구·적대 위기 판정이 따로
};
/** 영어 지시문에 넣을 위기 묘사: 종말 위기와 하늘의 전쟁을 나눈다(알파 11). */
export function crisisPhrase(kinds: string[]): string {
  const end = kinds.filter((k) => k !== 'wih'), w = kinds.includes('wih');
  const a = end.length ? `the end-times crisis ${end.map((k) => `"${crisisName(k, 'en')}"`).join(', ')}` : '';
  const b = w ? 'the War in Heaven, a war between awakened Fallen Empires that shakes the whole galaxy' : '';
  return [a, b].filter(Boolean).join(' and ');
}
export const crisisName = (k: string, lang: 'ko' | 'en' = 'ko'): string => CRISIS_KINDS[k]?.[lang] ?? k;

export interface CrisisSave { /** 세타나와 전쟁이 시작됨(알파 11) — 그 전의 세타나는 모두에게 중립 */ cetanaWar?: boolean; active: string[]; since: Record<string, string>; ended: Record<string, string>; issues: number[]; /** 가로챈 신호를 마지막으로 낸 해(위기별, 알파 11) */ signal?: Record<string, number>; labels?: Record<string, { ko: string; en: string }> } // issues: 위기 특별판 호 번호(이 호만 특별판 지면), labels: 호마다 위기 이름
export const emptyCrisis = (): CrisisSave => ({ active: [], since: {}, ended: {}, issues: [] });

/** 한 달 묶음을 모은다: CRISIS 줄은 쌓고, CRISIS_END 에서 묶음을 돌려준다. */
export class CrisisCollector {
  private cur = new Set<string>();
  private war = false;
  feed(kind: string, kv: Record<string, string>): { kinds: string[]; date: string; cetanaWar?: true } | null {
    if (kind === 'CRISIS') { const k = String(kv.kind ?? '').trim(); if (CRISIS_KINDS[k]) this.cur.add(k); if (k === 'cetana' && kv.war === '1') this.war = true; return null; }
    if (kind === 'CRISIS_END') { const kinds = [...this.cur].sort(), war = this.war; this.cur.clear(); this.war = false; return { kinds, date: String(kv.date ?? '').trim(), ...(war ? { cetanaWar: true as const } : {}) }; }
    return null;
  }
}

/** 은하를 실제로 적대하는 위기가 있는가(감정 기억용). 세타나는 전쟁이 시작된 뒤에만(사용자 2026-10-25: 그 전에는 모두 중립). */
export const hostileCrisis = (s: Pick<CrisisSave, 'active' | 'cetanaWar'>): boolean => s.active.some((k) => k !== 'wih' && (k !== 'cetana' || s.cetanaWar === true)); // 하늘의 전쟁은 은하를 적대하는 위기가 아니다(알파 11)

/** 이번 달 목록을 반영한다. 새로 생긴 위기·끝난 위기를 돌려준다. */
export function applyCrisis(s: CrisisSave, kinds: string[], date: string): { began: string[]; ended: string[] } {
  const now = new Set(kinds.filter((k) => CRISIS_KINDS[k]));
  const began = [...now].filter((k) => !s.active.includes(k)), ended = s.active.filter((k) => !now.has(k));
  for (const k of began) { s.since[k] = date; delete s.ended[k]; }
  for (const k of ended) s.ended[k] = date;
  s.active = [...now].sort();
  return { began, ended };
}

export const crisisNames = (kinds: string[], lang: 'ko' | 'en' = 'ko'): string => kinds.map((k) => crisisName(k, lang)).join(lang === 'en' ? ', ' : '·');

/** 연대기(세계 소식) 한 줄 */
export const crisisBeginText = (k: string): string => k === 'wih' ? L('각성한 몰락제국들이 서로 전쟁을 선포했다 — 「하늘의 전쟁」이 시작되어 은하의 모든 제국이 편을 고르라는 압박을 받는다', 'The awakened Fallen Empires have declared war on one another — the War in Heaven has begun, and every empire in the galaxy is pressed to choose a side') : L(`은하 위기 "${crisisName(k)}"이(가) 나타났다 — 은하 전역이 비상 체제에 들어갔다`, `Galactic crisis "${crisisName(k, 'en')}" has appeared — the whole galaxy is on emergency footing`); // 기록 당시 인터페이스 언어(2026-10-19)
export const crisisEndText = (k: string): string => k === 'wih' ? L('「하늘의 전쟁」이 끝났다 — 고대 제국들의 싸움이 멎었다', 'The War in Heaven is over — the ancient empires have ceased their struggle') : L(`은하 위기 "${crisisName(k)}"의 세력이 은하에서 사라졌다`, `The forces of galactic crisis "${crisisName(k, 'en')}" have vanished from the galaxy`);

/** 라디오: 위기 동안 대본 작가에게 덧붙이는 지시(사실은 여전히 사건 목록만). */
export function crisisRadioDirective(s: CrisisSave): string | null {
  if (!s.active.length) return null;
  const list = s.active.map((k) => `"${crisisName(k, 'en')}" (since ${s.since[k] || 'unknown date'})`).join(', ');
  return [
    `[EMERGENCY SPECIAL BROADCAST] The galaxy is now facing ${crisisPhrase(s.active)} (${list}). This episode airs as an "emergency special broadcast" instead of regular programming.`,
    'The first line must announce the special programming (like "This is an emergency special broadcast"), and the last line must end by urging listeners to stay calm and follow general safety advice (e.g. listen for evacuation announcements).',
    'Tone: urgent disaster-broadcast style that does not stoke panic. No jokes or light chatter.',
    'Apart from the crisis forces\' names and start dates, do not invent damage figures, battle results or fallen planets that are not in the event list. Say "this has not been confirmed" for anything unknown.',
  ].join('\n');
}
/** 라디오: 새 사건이 없는 달에도 위기 동안에는 가상 일상 코너 대신 위기 특보를 낸다. */
export function crisisFacts(s: CrisisSave, today: string): string[] {
  return s.active.map((k) => `Galactic crisis "${crisisName(k, 'en')}" ongoing (first confirmed ${s.since[k] || 'on an unknown date'}${today ? `, today ${today}` : ''})`);
}
/** 외교 대화(알파 11): 위기가 진행 중이면 일반 제국·세력의 말에 은하 상황을 깔아 준다(추가 LLM 호출 없음). 위기 세력 자신에게는 쓰지 않는다. */
// 세타나(사용자 2026-10-25): 위기는 맞지만 제국들은 그 과업에 동참할 수도 맞설 수도 있다. 세타나와 전쟁 중이 아닌 동안 다른 제국은 세타나를 중립적으로 말한다.
//   전쟁이 시작되면(awakened_synth_queen, 바닐라에서 모든 제국에 적대) 다른 위기와 같은 줄에 넣는다.
export function crisisTalkLine(s: CrisisSave): string {
  if (!s.active.length) return '';
  const hostile = s.active.filter((k) => k !== 'wih' && (k !== 'cetana' || s.cetanaWar === true));
  const at = (k: string) => `"${crisisName(k, 'en')}" (since ${s.since[k] || 'an unknown date'})`;
  const out: string[] = [];
  if (hostile.length) out.push(`[Galactic situation] The galaxy is facing the end-times crisis ${hostile.map(at).join(', ')}. It weighs on everyone: survival, alliances against it and who is or is not doing their part may colour your words. Do not invent battles, losses or numbers about it.`);
  if (s.active.includes('cetana') && s.cetanaWar !== true) out.push(`[Cetana] A vast nanite intelligence called Cetana has appeared in the galaxy (since ${s.since.cetana || 'an unknown date'}). Your empire is not at war with her. If she comes up, speak of her neutrally: watchful, curious or undecided, neither as an enemy to be destroyed nor as a saviour. Empires may choose to cooperate with her work or to resist it, and you do not judge the ruler's choice. Do not invent events about her.`);
  if (s.active.includes('wih')) out.push(`[War in Heaven] Two awakened Fallen Empires are waging the War in Heaven (since ${s.since.wih || 'an unknown date'}). Every younger empire is pressed to pick a side or to stand with the Non-Aligned League; it colours every relationship in the galaxy. Do not invent battles or outcomes.`);
  return out.join('\n');
}
/** 신문: 위기 동안 내는 호에 덧붙이는 지시. */
export function crisisNewsDirective(s: CrisisSave): string | null {
  if (!s.active.length) return null;
  return [
    `[CRISIS SPECIAL EDITION] The galaxy is now facing ${crisisPhrase(s.active)}. This issue is a "crisis special edition".`,
    'Lead the headline and first article with the crisis, but do not invent damage, victories or fallen planets not in the fact list. Report other news in the context of a galaxy in crisis. Leave out light entertainment and gossip.',
  ].join('\n');
}
/** 위기 특별판 호만 표시한다(정기호·일반 호외는 위기 중이라도 평소 지면). 최근 200개만 남긴다. */
export function markCrisisIssue(s: CrisisSave, id: number, label: { ko: string; en: string }): void {
  if (!Number.isFinite(id) || s.issues.includes(id)) return;
  s.issues.push(id); (s.labels ??= {})[String(id)] = label;
  while (s.issues.length > 200) { const old = s.issues.shift()!; delete s.labels[String(old)]; }
}
/** 위기가 새로 나타났을 때 특별판에 실을 한 문장(여러 위기가 한꺼번에 나타나면 함께). */
export function crisisSpecialFact(kinds: string[], date: string): string { return kinds.length === 1 && kinds[0] === 'wih' ? `${date ? date + ' ' : ''}The War in Heaven began: two awakened Fallen Empires went to war with each other, and every younger empire is pressed to choose a side.` : `${date ? date + ' ' : ''}Galactic crisis ${kinds.map((k) => `"${crisisName(k, 'en')}"`).join(', ')} appeared. The whole galaxy went on emergency footing.`; } // AI 신문 프롬프트용 사실(영어)
