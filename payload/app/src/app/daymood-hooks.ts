// 동적 일상 분위기(2026-10-28 알파 10)의 칸: features/daymood-app.ts 가 등록 때 채운다.
// 비서·라디오·아기방·궁정·행성 기념일은 daymood-app 을 직접 가져오지 않고 이 칸으로만 부른다(가져오기 고리 방지). 등록 전에는 아무 일도 하지 않는다.
export type DayFlash = 'joy' | 'grief' | 'stir';
export const dayMoodLink = {
  /** 비서의 아침 인사(게임 달이 바뀐 뒤 처음 부를 때 한 번, 아니면 '') */
  greet: (_sid: string): string => '',
  /** 라디오 짧은 꼭지 하나(없으면 null) */
  segment: (): { label: string; kind: string; lines: Array<{ who: 'announcer' | 'reporter'; text: string }>; caller?: string } | null => null,
  /** 사건으로 잠깐 바뀌는 분위기: 경사 2개월 · 애도 3개월 · 술렁임 2개월 */
  event: (_kind: DayFlash, _why: string): void => {},
};
export const dayMoodEvent = (kind: DayFlash, why: string): void => { try { dayMoodLink.event(kind, why); } catch { /* 기능 없음 */ } };
