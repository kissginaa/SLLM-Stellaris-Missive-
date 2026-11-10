// 종속국 통치권(2026-11-05)의 칸: features/vassal-reign-app.ts 가 등록 때 채운다.
// vassal-admin-app(성계 이양·기술 원조·동화)·vassal-app(개명 칙령)은 vassal-reign-app 을 직접 가져오지 않고 이 칸으로 부른다(가져오기 고리 방지).
export type MeddleHit = 'take' | 'tech' | 'rename' | 'assim' | 'shift' | 'align' | 'puppet' | 'proxy' | 'levy' | 'tithe' | 'force';
export const reignLink = {
  /** ③ 간섭 한 번(종속국 번호, 종류): 열기를 쌓고 반감 단계를 게임에 건다. */
  meddle: (_idx: number, _kind: MeddleHit): void => {},
  /** ④ 동화 정책 걸음 때 정책·종족 권리 한 걸음(종속국 번호, 이름). */
  align: async (_idx: number, _name: string): Promise<void> => {},
};
