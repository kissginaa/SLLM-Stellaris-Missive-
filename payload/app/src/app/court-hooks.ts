// 정치(음모·가문·정략결혼, 2026-10-28)의 칸. children-app·court-app·protests-app 이 서로 가져오지 않고 이 칸으로만 부른다(가져오기 고리 방지).
// 등록 전에는 아무 일도 하지 않는다.
export interface KidInfo {
  id: string; name: string; gender: 'm' | 'f'; ruler: string; rulerName: string; parent: string; parentName: string;
  born?: string; dead?: string; adultLid?: number; leader: boolean; civ: boolean; job?: string; heir?: boolean; married?: string; adult: boolean; stage: string;
}
export const courtLink = {
  // ---- children-app 이 채움
  /** 아기방 장부의 모든 아이(태어나지 않은 아이 포함) */
  kids: (_sid: string): KidInfo[] => [],
  /** 혼인을 아이 기록에 남김(민간인이면 기혼 표시) */
  markWed: (_sid: string, _cid: string, _text: { ko: string; en: string; spouse: string }): void => {},
  // ---- court-app 이 채움
  /** 아이가 태어남 → 가문 특성 물려받기 */
  onBirth: (_sid: string, _cid: string, _rulerPid: string): void => {},
  /** 1:1 통신 프롬프트용 가문 한 줄(영어, 없으면 '') */
  houseLine: (_sid: string, _key: string): string => '',
  /** 시위 원인(체포·추방의 반동, 독립 모의가 터짐) */
  causes: (): Array<{ id: string; eth: string; text: string; until: string; planetK?: number }> => [],
  /** 이 아이의 가문 특성 이름(화면) */
  kidTraits: (_sid: string, _cid: string): string[] => [],
};
