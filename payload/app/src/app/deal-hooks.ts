// 외교 거래 연결 칸(2026-10-26). deals-app 이 chat 을 가져오므로, chat·embassy-app 이 deals-app 을 직접 가져오면 기능 모듈끼리 가져오기 고리가 생긴다
// (A-00b 검사). 그래서 deals-app 이 registerDeals 에서 등록하고, chat·embassy-app 은 이 칸으로만 부른다. 등록 전에는 아무 일도 하지 않는다.
type Owed = (tid: number) => boolean;
type Refused = (tid: number, name: string) => Promise<void>;
type Secret = (tid: number, name: string, shown: Array<{ key: string; rumor?: boolean }>) => void;
const h: { owed: Owed; refused: Refused; secret: Secret } = { owed: () => false, refused: async () => {}, secret: () => {} };
export function setDealHooks(x: { owed: Owed; refused: Refused; secret: Secret }): void { Object.assign(h, x); }
/** 상대가 우리에 대한 갈고리를 쥐고 있나(우리가 약속을 어김). */
export const dealOwed: Owed = (tid) => h.owed(tid);
/** 빚을 쥔 상대의 요구(take_energy)를 우리가 거절했을 때. */
export const onOwedDemandRefused: Refused = (tid, name) => h.refused(tid, name);
/** 첩보 보고서가 확인된 비밀을 찾았을 때 → 그 제국에 갈고리. */
export const noteSecretHook: Secret = (tid, name, shown) => h.secret(tid, name, shown);
