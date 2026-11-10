// 정책 화면(policy-app)이 시민 정치(civic-app)를 직접 가져오면 기능 가져오기 순환이 생겨서(policy-app → civic-app → gamestate-app → faction-app → policy-app),
// civic-app 이 registerCivic 에서 여기에 함수를 꽂는다(2026-11-03 국민투표). 꽂기 전에는 국민투표가 없는 것처럼 동작한다.
import type { CivicRegime, Referendum } from '../civic';
export const civicHooks = {
  info: (): { regime: CivicRegime; ready: boolean; until: string } => ({ regime: 'none', ready: false, until: '' }),
  record: (_r: Referendum): void => {},
  effect: async (_kind: 'mandate' | 'defied', _title: string): Promise<void> => {},
  mood: (): number | null => null,
  /** 신문 프롬프트 한 줄: 그 신문사의 최근 여론조사(없으면 빈 글). media.ts 가 쓴다. */
  pollLine: (_paper: number, _date: string): string => '',
};
