// 하츠 참고 외교(2026-10-28)의 칸: features/hoi-app.ts 가 등록 때 채운다. vassal-app·protests-app 은 hoi-app 을 직접 가져오지 않고 이 칸으로 부른다(가져오기 고리 방지).
export const hoiLink = {
  /** 종속국 자치도(없으면 null) */
  autonomy: (_idx: number): { v: number; stage: string; rightsPending: boolean; text: string } | null => null,
  /** 청원 승인 등으로 자치도 조정 */
  nudge: (_idx: number, _n: number): void => {},
  /** 종속국 채널에서 대화(달래기) */
  calm: (_idx: number): void => {},
  /** 진행 중인 외세 개입(시위 원인) */
  foreign: (): Array<{ id: string; eth: string; by: string; revealed: boolean; until: string }> => [],
};
