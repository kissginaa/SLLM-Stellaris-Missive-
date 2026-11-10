// 이탈 노드 자료 보관(알파 11, 2026-10-25). 가져오기 고리를 피하려고 따로 둔다: gestalt-report-app 이 채우고, gc-app(관리 유닛 회의 안건·약속 판정)이 읽는다.
// 단일 의식 제국만 모드가 DEVIANT 줄을 보낸다(이탈 30 이상 행성만). 한 번이라도 받은 세이브에서 목록에 없는 행성 = 이탈 30 미만.
import type { DeviantPlanet } from '../gestalt-report';

const last = new Map<string, { date: string; list: DeviantPlanet[] }>();
export function setDeviant(sid: string, date: string, list: DeviantPlanet[]): void { last.set(sid, { date, list }); }
export function deviantOf(sid: string): { date: string; list: DeviantPlanet[] } | null { return last.get(sid) ?? null; }
/** 그 행성의 이탈(모르면 undefined, 검사했는데 목록에 없으면 0). */
export function deviancyOf(sid: string, planet: string): number | undefined { const d = last.get(sid); if (!d) return undefined; return d.list.find((p) => p.name === planet)?.dev ?? 0; }
