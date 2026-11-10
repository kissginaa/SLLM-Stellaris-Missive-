// 악명·전쟁범죄 연결 칸(2026-11-04). chat·captive-app 이 infamy-app 을 직접 가져오면 기능 모듈끼리 가져오기 고리가 생길 수 있어서(A-00b, temper-hooks 와 같은 방식),
// infamy-app 이 registerInfamy 에서 여기에 함수를 꽂고, 다른 기능은 이 칸으로만 부른다. 꽂기 전에는 아무 일도 하지 않는다.
type Talk = (idx: number) => string;
type Exec = (o: { name: string; fname: string; fidx: number; secret?: boolean }) => void;
const h: { talk: Talk; exec: Exec } = { talk: () => '', exec: () => {} };
export function setInfamyHooks(x: Partial<{ talk: Talk; exec: Exec }>): void { Object.assign(h, x); }
/** 외교 대화 프롬프트에 넣을 악명·전쟁범죄 줄(영어). 없으면 ''. */
export const infamyTalk: Talk = (idx) => { try { return h.talk(idx); } catch { return ''; } };
/** 포로 처형이 게임에 적용된 뒤: 방금 기록된 「포로 처형」 범죄에 이름을 붙인다. secret = 비밀 처형(게임 로그 없음 → 숨은 범죄로 새로 기록). */
export const infamyExec: Exec = (o) => { try { h.exec(o); } catch { /* 악명 기능 없음 */ } };
