// 시나리오 개발자 도구의 덧붙는 단추들(2026-11-08): 기능 파일끼리 서로 가져오지 않도록, 각 기능이 여기에 등록하고 scenario-domains-app 의 scnDev 가 찾아 부른다.
export type DevHook = (req: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
export const devHooks = new Map<string, DevHook>();
export function addDevHook(name: string, fn: DevHook): void { devHooks.set(name, fn); }
