// 통치자의 아이(2026-10-27): 배우자 1:1 통신(persona-app)이 아이 기능(children-app)을 직접 가져오지 않게 하는 다리. children-app 가 registerChildren 에서 꽂는다.
export interface ChildrenHooks {
  /** 이 인물이 지금 통치자의 배우자인가(비서 제외). 배우자 대화에만 「intimate」 칸을 묻는다. */
  isSpouse(sid: string, key: string): boolean;
  /** 배우자 대화에서 친밀함이 묘사됨 → 그해 확률이 오른다(배우자마다 해마다 한 번). */
  intimate(sid: string, key: string): void;
  /** 1:1 통신 프롬프트용 가족 한 줄(영어, 없으면 ''). 2026-10-27 가족관계 */
  familyLine?(sid: string, key: string): string;
}
let hooks: ChildrenHooks | null = null;
export function setChildrenHooks(h: ChildrenHooks): void { hooks = h; }
export const isRulerSpouse = (sid: string, key: string): boolean => { try { return !!hooks?.isSpouse(sid, key); } catch { return false; } };
export const noteIntimate = (sid: string, key: string): void => { try { hooks?.intimate(sid, key); } catch { /* 기능이 없으면 그냥 넘어간다 */ } };
export const familyPromptLine = (sid: string, key: string): string => { try { return hooks?.familyLine?.(sid, key) ?? ''; } catch { return ''; } };
