// 외교 노선 연결 칸(2026-11-04). chat·deals-app 이 temper-app 을 직접 가져오면 기능 모듈끼리 가져오기 고리가 생길 수 있어서(A-00b),
// temper-app 이 registerTemper 에서 여기에 함수를 꽂고, 다른 기능은 이 칸으로만 부른다. 꽂기 전에는 아무 일도 하지 않는다.
type Push = (idx: number, d: number, why: [string, string]) => void;
const h: { push: Push } = { push: () => {} };
export function setTemperHooks(x: { push: Push }): void { Object.assign(h, x); }
/** 그 AI 제국의 노선 압력을 움직인다(+ 온건 · − 강경). why = [한국어, 영어] 까닭. */
export const temperPush: Push = (idx, d, why) => { try { h.push(idx, d, why); } catch { /* 노선 기능 없음 */ } };
