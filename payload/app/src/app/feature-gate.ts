// 기능 문(2026-11-08 사용자: 「시나리오에서 아이콘을 지운 기능은 아예 동작도 안 해야」).
// 시나리오 잠금(src/features/scenario-locks-app.ts)이 문 판정 함수를 건다. 여기는 가져오기 순환이 없게 아무 기능도 가져오지 않는다.
// 문이 닫힌 기능은 로그 줄 처리(log-router), 월간 상황 처리(gamestate-app onGameSnapshot), 기능 자체 타이머가 모두 건너뛴다.
let gate: (key: string) => boolean = () => false;
let cache = { at: 0, keys: new Set<string>() };
let listKeys: () => string[] = () => [];
/** 잠긴 기능 목록을 돌려주는 함수를 건다(시나리오 잠금이 등록할 때 한 번). */
export function setFeatureGate(fn: () => string[]): void { listKeys = fn; cache = { at: 0, keys: new Set() }; gate = (k) => { const now = Date.now(); if (now - cache.at > 2000) { let ks: string[] = []; try { ks = listKeys(); } catch { /* 문 열어 둠 */ } cache = { at: now, keys: new Set(ks) }; } return cache.keys.has(k); }; }
/** 이 기능이 지금 꺼져 있나(시나리오에서 잠김). 잠금이 없으면 늘 false. */
export function featureOff(key: string | undefined): boolean { return !!key && gate(key); }

/** 로그 줄 처리 이름 → 잠금 열쇠. 응답만 받는 처리(…:apply, terminal:feed, relations 등 여러 기능 공용)는 넣지 않는다. */
export const ROUTE_LOCK: Record<string, string> = {
  'deals': 'deals', 'isc': 'isc', 'isc-quest': 'isc', 'protests': 'protest', 'policy': 'policy', 'temper': 'temper', 'alarm': 'schedule',
  'embassy': 'embassy', 'foreign-banquet': 'invite', 'vassal-admin': 'vassal', 'vassal-court': 'vassal', 'vassal-reign': 'vassal', 'preftl': 'preftl', 'emp': 'emergencyPowers',
  'govpol:build': 'govpolicy', 'govpol:quota': 'govpolicy', // 행성 맡기기(2026-11-08)
};
