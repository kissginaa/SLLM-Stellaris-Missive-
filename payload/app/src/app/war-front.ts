// 우리 전쟁의 전선 한 줄(신문·라디오용, 2026-10-26) — 공급자 칸.
// frontier-app 이 gamestate-app 을 가져오므로, 라디오·신문(media·radio-app)이 frontier-app 을 직접 가져오면 기능 모듈끼리 가져오기 고리가 생긴다
// (A-00b 검사: … mail-app > radio-app > frontier-app > gamestate-app > … ). 그래서 frontier-app 이 등록하고 라디오·신문은 이 칸으로만 부른다.
let source: () => Promise<string[]> = async () => [];
/** frontier-app 의 registerFrontier 가 한 번 등록한다. */
export function setWarFrontSource(fn: () => Promise<string[]>): void { source = fn; }
/** 우리가 지금 하는 전쟁마다(최대 3) 상대와의 전선 한 줄. 등록 전이면 빈 목록. */
export function warFrontInfo(): Promise<string[]> { return source(); }
