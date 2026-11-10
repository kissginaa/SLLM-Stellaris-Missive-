// 의회(parliament-app) ↔ 정책 파벌 심사(policy-app) 연결(2026-11-03). policy-app 이 parliament-app 을 직접 가져오면
// 가져오기 순환(policy-app → parliament-app → gamestate-app → faction-app → policy-app)이 생겨서, parliament-app 이 registerParliament 에서 여기에 함수를 꽂는다.
// 꽂기 전이거나 자유 정부가 아니면 null(정책 심사는 예전처럼 가치관만 본다).
import type { ParlBloc } from '../policy-review';
// 필리버스터(2026-11-03): filibuster = 야당이 막기 시작(기록), outlasted = 기다린 끝에 통과(기록), rammed = 날치기 통과(민심·야당 관계 하락).
// bill = 정책 버프 조합 열쇠: 계류 중인 법안은 의회 저장에 남아서, 마법사를 닫았다 같은 법안을 다시 짜면 기다린 시간이 이어진다(pending).
export const parlHooks: { bloc: () => ParlBloc | null; pending: (bill: string) => string | null; filibuster: (by: string[], until: string, bill: string) => void; outlasted: (title: string, bill: string) => void; rammed: (title: string, bill: string) => void } = {
  bloc: () => null, pending: () => null, filibuster: () => {}, outlasted: () => {}, rammed: () => {},
};
