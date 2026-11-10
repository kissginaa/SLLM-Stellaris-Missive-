// 예술가 극단 순회 공연(알파 11, 2026-10-25). 순수 규칙. 앱: src/features/collectibles-app.ts, 화면: ui/artist-tour.js(통신 단말기 예술가 극단 줄).
// 사용자 확정: 정기적으로 오지 않고 「우리가 부탁할 때만」 · 세계의 축제를 75% 깎은 판 · 기간만 1/2.
//   → 에너지 250 · 나라 수정자 sllm_artist_tour 900일(행복도 +4% · 인구 증가 +2.5%).
// 축제(enclave_artist_festival)나 순회 공연이 이미 붙어 있으면 게임이 거절(busy). 극단과 관계가 나쁘면(관계 점수 < -25) 앱이 먼저 거절.
export const TOUR_COST = 250;
export const TOUR_DAYS = 900;
export const TOUR_MIN_SCORE = -25;
export interface Tour { n: number; start: string; req?: number }
export interface TourBook { seq: number; tours: Tour[] }
export const emptyTours = (): TourBook => ({ seq: 0, tours: [] });

/** 회신 SLLM:ARTTOUR status=applied|duplicate|busy|short. 같은 의뢰 번호는 한 번만 차감. */
export function tourCommand(req: number, sid: string, n: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(n) || n < 1) throw new Error('INVALID_TOUR');
  const mark = `sllm_tour_${n}`, log = (s: string) => `log = "SLLM:ARTTOUR/;/req=${req}/;/sid=${sid}/;/n=${n}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { OR = { has_modifier = enclave_artist_festival has_modifier = sllm_artist_tour } } ${log('busy')} } else_if = { limit = { resource_stockpile_compare = { resource = energy value < ${TOUR_COST} } } ${log('short')} } else = { add_resource = { energy = -${TOUR_COST} } add_modifier = { modifier = sllm_artist_tour days = ${TOUR_DAYS} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}
export function sanitizeTours(v: unknown): TourBook {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, any>, b = emptyTours();
  b.seq = Number.isSafeInteger(o.seq) && o.seq >= 0 ? o.seq : 0;
  if (Array.isArray(o.tours)) for (const t of o.tours.slice(-50)) if (t && Number.isSafeInteger(t.n) && typeof t.start === 'string') { b.tours.push({ n: t.n, start: t.start.slice(0, 12) }); b.seq = Math.max(b.seq, t.n); }
  return b;
}
