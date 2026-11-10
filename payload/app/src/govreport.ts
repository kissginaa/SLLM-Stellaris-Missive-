// A-26 총독 홀로그램 보고(2026-10-15 사용자 승인): 해마다 문제가 있는 행성의 총독이 통치자 집무실로 통신을 요청한다.
// 여기는 순수 로직(어느 행성을 고를지, 보고 첫 요청 문장). 창·IPC는 features/govreport.ts.
import type { Planet, PlanetList } from './planets';
import { L } from './i18n-pick';

export interface ReportPick { index: number; score: number; reasons: string[] }
/** 문제 점수: 안정도 50 미만, 여가 부족, 주거 부족. 수치를 못 읽은 항목은 0. */
export function planetTrouble(p: Planet): { score: number; reasons: string[] } {
  const reasons: string[] = []; let score = 0;
  if (p.stability !== null && p.stability < 50) { score += (50 - p.stability) * 2; reasons.push(L(`안정도 ${Math.round(p.stability)}`, `Stability ${Math.round(p.stability)}`)); }
  if (p.amenities !== null && p.amenities < 0) { score += -p.amenities * 3; reasons.push(L(`여가 시설 ${Math.round(-p.amenities)} 부족`, `Amenities short by ${Math.round(-p.amenities)}`)); }
  // 실업(2026-11-05): 일자리가 모자라 실업자가 있으면 문제(빈 일자리가 있는데도 실업이면 종족·자격 문제 — 그래도 보고 거리)
  if (p.unemployed !== undefined && p.unemployed > 0) { score += p.pops && p.pops > 0 ? Math.min(60, Math.round(200 * p.unemployed / p.pops)) : 10; reasons.push(L(`실업 ${p.unemployed}`, `${p.unemployed} unemployed`)); }
  if (p.housing !== null && p.housing < 0) { score += -p.housing * 3; reasons.push(L(`주거 ${Math.round(-p.housing)} 부족`, `Housing short by ${Math.round(-p.housing)}`)); }
  return { score: Math.round(score), reasons };
}
export const REPORT_MIN_SCORE = 10;
/** 가장 문제가 큰 행성 하나(점수가 같으면 주민이 많은 쪽, 그다음 수도). 보고할 만한 곳이 없으면 null. */
export function pickReport(list: PlanetList | null): ReportPick | null {
  if (!list) return null;
  let best: ReportPick | null = null;
  list.planets.forEach((p, index) => {
    const t = planetTrouble(p); if (t.score < REPORT_MIN_SCORE) return;
    const better = !best || t.score > best.score || (t.score === best.score && ((p.pops ?? 0) > (list.planets[best.index].pops ?? 0) || (p.capital && !list.planets[best.index].capital)));
    if (better) best = { index, score: t.score, reasons: t.reasons };
  });
  return best;
}
/** 보고의 첫 요청(지도자가 보고를 받으려고 통신을 연 상황). govPrompt 의 "묻기 전에는 보고하지 말 것" 규칙과 맞도록 지도자가 묻는 형식이다. */
export function reportOpening(p: Planet, reasons: string[]): string {
  return `[Ruler's office · comms hologram] The governor asked to report, and the leader took the call. Leader: "Report." `
    + `First give a concise report on ${p.name}'s current problems (${reasons.join(', ') || 'general status'}), then suggest one or two likely causes and the orders or decisions you want from the leader. Keep the greeting short.`;
}
