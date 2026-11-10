// 행성 고유 기념일과 통치자 방문(12)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 행성 설립 완료 뒤 게임 시간 1년이 지나야 생성 / 평소 효과 없음 / 기념일 당일 「방문」해야 그 행성에만 효과 / 연도당 한 번.
// 게임 자료 근거:
//  - 행성은 PLANETS 묶음의 순서(k, every_owned_colony 순서)와 이름으로 다룬다(planets.ts·petition.ts). 행성 ID 지역화 명령은 없어서 이름+순서를 쓴다.
//  - 설립일: 4.5.1 트리거 colony_age(행성, 개월)를 PLANET 줄에 cage 로 보낸다(mod/patches/02). 오늘 − cage 개월 = 설립일. 이미 설립된 행성도 바로 안다.
//  - 행성 효과: planet-scope 수정자 add_modifier = { modifier = sllm_holiday_visit days = N } (sllm_petition_modifiers 와 같은 틀). 효과 종류·수치·기간은 미정 → 모드 파일에서 바꾼다.
import { dayNo, cmpDate, addMonths } from './gamedate';

export interface PlanetHoliday {
  sid: string; planet: string; title: string; desc: string; month: number; day: number;
  createdOn: string; foundedOn: string; source: string[]; lang: string;
  /** 연도별 방문 보상 기록(12: campaign+planet+year 한 번). */
  visits: Record<string, { on: string; ruler: string; req?: number; status: 'pending' | 'applied' | 'unknown' | 'no_target' }>;
}
/** 생성 자격(12): 설립일을 알고, 오늘이 설립일 + 360일 이상. */
export function holidayEligible(foundedOn: string | undefined, today: string): 'eligible' | 'too_young' | 'unknown_founding' {
  if (!foundedOn) return 'unknown_founding';
  const a = dayNo(foundedOn), b = dayNo(today); if (a === null || b === null) return 'unknown_founding';
  return b - a >= 360 ? 'eligible' : 'too_young';
}
/** 설립일 = 오늘 − colony_age 개월(12). cage 가 없거나 음수면 미확인. */
export function foundedFromColonyAge(today: string, cageMonths: number | undefined): string | undefined {
  if (cageMonths === undefined || !Number.isFinite(cageMonths) || cageMonths < 0) return undefined;
  const d = addMonths(today, -Math.round(cageMonths)); return d === today && cageMonths > 0 ? undefined : d;
}
/** 연례 날짜 배정(12): 한 번만 정해 저장. 설립일과 같게 하지 않아도 된다 → 설립 월·일을 기본으로 쓰되 1~12월·1~30일 범위. */
export function assignHolidayDate(foundedOn: string, rng: () => number): { month: number; day: number } {
  const m = /^\d+\.(\d+)\.(\d+)$/.exec(foundedOn);
  if (m) return { month: Math.max(1, Math.min(12, Number(m[1]))), day: Math.max(1, Math.min(30, Number(m[2]))) };
  return { month: 1 + Math.floor(rng() * 12), day: 1 + Math.floor(rng() * 30) };
}
/** AI 출력 검사(12): 제목 40자·설명 160자, 두 줄만. 날짜·효과는 받지 않는다. */
export function cleanHolidayText(j: { title?: unknown; desc?: unknown } | null): { title: string; desc: string } | null {
  const t = String(j?.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 40), d = String(j?.desc ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return t && d ? { title: t, desc: d } : null;
}
/** 오늘이 기념일?(게임 날짜 기준, 현실 날짜 아님) */
export function isHolidayToday(h: PlanetHoliday, today: string): boolean {
  const m = /^\d+\.(\d+)\.(\d+)$/.exec(today); return !!m && Number(m[1]) === h.month && Number(m[2]) === h.day;
}
/** 방문 가능 기간(사용자 확정 2026-10-23): 기념일이 든 달 안이면 아무 날이나. 정확한 날짜를 맞출 필요 없음. */
export function isHolidayMonth(h: PlanetHoliday, today: string): boolean {
  const m = /^\d+\.(\d+)\.\d+$/.exec(today); return !!m && Number(m[1]) === h.month;
}
export const holidayYear = (today: string): string => today.split('.')[0] ?? '';
/** 방문 가능?(12) 당일 + 올해 아직 방문 보상 없음 + 현재 소유. */
export function canVisit(h: PlanetHoliday, today: string, owned: boolean): { ok: boolean; why?: 'not_today' | 'already' | 'not_owned' } {
  if (!owned) return { ok: false, why: 'not_owned' };
  if (!isHolidayMonth(h, today)) return { ok: false, why: 'not_today' }; // 그 달 안이면 방문 가능(사용자 확정 2026-10-23)
  if (h.visits[holidayYear(today)]) return { ok: false, why: 'already' };
  return { ok: true };
}
/** 다가오는 기념일 정렬(총독실 일정 목록용). */
export function upcoming(hs: PlanetHoliday[], today: string): PlanetHoliday[] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(today); if (!m) return hs;
  const y = Number(m[1]);
  const next = (h: PlanetHoliday) => { const d = `${y}.${String(h.month).padStart(2, '0')}.${String(h.day).padStart(2, '0')}`; return cmpDate(d, today) >= 0 ? d : `${y + 1}.${String(h.month).padStart(2, '0')}.${String(h.day).padStart(2, '0')}`; };
  return [...hs].sort((a, b) => cmpDate(next(a), next(b)));
}
/** 방문 효과 명령(12): k = 행성 순서(1부터, petition.ts 와 같은 every_owned_colony 순서). 모디파이어·기간은 모드 파일 값. 같은 연도 표식으로 중복 방지. */
export function holidayVisitCommand(req: number, sid: string, k: number, year: number, modifier = 'sllm_holiday_visit', days = 360): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(k) || k < 1 || !Number.isSafeInteger(year) || !/^[a-z0-9_]+$/.test(modifier)) throw new Error('기념일 방문 인자가 올바르지 않습니다.');
  const log = (s: string) => `log = "SLLM:HOLIDAYVISIT/;/req=${req}/;/sid=${sid}/;/k=${k}/;/year=${year}/;/status=${s}"`;
  const mark = `sllm_hv_${year}`; // 행성 변수: 그 행성·그 해 한 번
  const loop = `set_variable = { which = sllm_pt_n value = 0 } set_variable = { which = sllm_pt_ok value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_pt_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_pt_n value = ${k} } } } if = { limit = { is_variable_set = ${mark} } prev = { set_variable = { which = sllm_pt_ok value = 2 } } } else = { set_variable = { which = ${mark} value = 1 } remove_modifier = ${modifier} add_modifier = { modifier = ${modifier} days = ${days} } prev = { set_variable = { which = sllm_pt_ok value = 1 } } } } }`;
  const done = `if = { limit = { check_variable = { which = sllm_pt_ok value = 1 } } ${log('applied')} } else_if = { limit = { check_variable = { which = sllm_pt_ok value = 2 } } ${log('duplicate')} } else = { ${log('no_target')} } clear_variable = sllm_pt_n clear_variable = sllm_pt_ok`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${loop} ${done} }`;
}
