// 귀족 건강(시나리오 「회랑의 삼파전」, 2026-11-08) — 순수 규칙. 앱 쪽: src/features/scenario-health-app.ts
// 설계: docs/SCENARIO_CORRIDOR_INSIDERS_HEALTH_VENUES_DESIGN_20261108_KO.md 1장(1단계: 건강 + 소문 단계 + 병사).
// 귀족마다 건강 0~100(처음 70~100, 가문 체질). 해마다 회복(+2), 지병이 있으면 해마다 −5(해마다 12% 확률로 낫는다), 독이 쌓였으면 단계마다 −5. 0이면 영구 사망.
// 바깥에서는 「소문」만 보인다(사용자: 「독재자들 건강설처럼 외부와 내부가 건강이 알려지는 건 다르니까」):
//   건재 / 건강설 / 위독설 세 구간. 해마다 5% 는 한 구간 어긋난 헛소문, 계산적인 귀족은 아파도 45% 는 건재한 척한다(한번 숨기기 시작하면 해마다 75% 로 계속 숨긴다).
//   더 정확한 관찰(시종·운전수)·진료 기록(의사)은 2단계 내부자 매수에서 연다(viewBand).

export const HP = { min0: 70, max0: 100, regen: 2, illChance: 0.03, illCure: 0.12, illDrain: 5, toxDrain: 5, fakeChance: 0.05, hideChance: 0.45, hideKeep: 0.75 };
export interface HpRec { v: number; ill?: 1; tox?: number; rb: 0 | 1 | 2; fake?: 1 }
export interface HealthSave { v: 1; hp: Record<string, HpRec>; y: number }
export const newHealthSave = (): HealthSave => ({ v: 1, hp: {}, y: -1 });
export function fixHealthSave(o: unknown): HealthSave {
  const s = (o && typeof o === 'object' ? o : {}) as Partial<HealthSave>, out = newHealthSave();
  if (s.hp && typeof s.hp === 'object') for (const [k, x] of Object.entries(s.hp)) {
    const r = (x ?? {}) as Partial<HpRec>, v = Number(r.v); if (!Number.isFinite(v)) continue;
    const rb = Number(r.rb); out.hp[k] = { v: Math.max(0, Math.min(100, Math.round(v))), rb: (rb === 1 || rb === 2 ? rb : 0), ...(r.ill ? { ill: 1 as const } : {}), ...(Number(r.tox) > 0 ? { tox: Math.min(10, Math.round(Number(r.tox))) } : {}), ...(r.fake ? { fake: 1 as const } : {}) };
  }
  const y = Number(s.y); out.y = Number.isInteger(y) ? y : -1;
  return out;
}
/** 진짜 건강의 세 구간: 0 건재(60~) · 1 병약(30~59) · 2 위독(~29). */
export const bandOf = (v: number): 0 | 1 | 2 => (v >= 60 ? 0 : v >= 30 ? 1 : 2);
export const RUMOR_NAME: Array<[string, string]> = [['건재', 'Hale'], ['건강설', 'Rumored ill'], ['위독설', 'Rumored dying']];
/** 관찰(시종·운전수 매수)의 다섯 구간 — 2단계에서 쓴다. */
export const OBS_NAME: Array<[string, string]> = [['건재', 'Hale'], ['양호', 'Fair'], ['쇠약', 'Frail'], ['병중', 'Ailing'], ['위독', 'Dying']];
export const obsOf = (v: number): number => (v >= 80 ? 0 : v >= 60 ? 1 : v >= 40 ? 2 : v >= 20 ? 3 : 4);
export const initRec = (r: number): HpRec => ({ v: Math.round(HP.min0 + (HP.max0 - HP.min0) * r), rb: 0 });

export interface HealthNews { id: number; from: 0 | 1 | 2; to: 0 | 1 | 2 }
/** 연례: 지병·회복·독, 소문 다시 정하기, 사망. ids: 살아 있는 귀족과 계산적 성향(tr[4]). rnd(키) → 0~1. */
export function healthYear(s: HealthSave, ids: Array<{ id: number; calc: number }>, year: number, rnd: (k: string) => number): { deaths: Array<{ id: number; why: 'illness' | 'poison' }>; news: HealthNews[] } {
  const deaths: Array<{ id: number; why: 'illness' | 'poison' }> = [], news: HealthNews[] = [];
  if (s.y === year) return { deaths, news }; s.y = year;
  for (const { id, calc } of ids) {
    const k = String(id), r = (s.hp[k] ??= initRec(rnd(`i${id}`)));
    if (!r.ill && rnd(`o${id}:${year}`) < HP.illChance) r.ill = 1;
    else if (r.ill && rnd(`c${id}:${year}`) < HP.illCure) delete r.ill;
    r.v = Math.max(0, Math.min(100, r.v + (r.ill ? -HP.illDrain : HP.regen) - (r.tox ?? 0) * HP.toxDrain));
    if (r.v <= 0) { deaths.push({ id, why: (r.tox ?? 0) > 0 ? 'poison' : 'illness' }); continue; }
    const b = bandOf(r.v), prev = r.rb, hid = !!r.fake && prev === 0; let shown: 0 | 1 | 2 = b; delete r.fake;
    if (b > 0 && calc > 0 && rnd(`h${id}:${year}`) < (hid ? HP.hideKeep : HP.hideChance)) { shown = 0; r.fake = 1; } // 계산적인 귀족은 건재한 척
    else if (rnd(`f${id}:${year}`) < HP.fakeChance) { shown = (b === 0 ? 1 : b === 2 ? 1 : rnd(`d${id}:${year}`) < 0.5 ? 0 : 2) as 0 | 1 | 2; r.fake = 1; } // 헛소문
    r.rb = shown; if (shown !== prev) news.push({ id, from: prev, to: shown });
  }
  return { deaths, news };
}
/** 소문 한 줄(연말 보고서). name = [한, 영]. */
export function newsLine(n: HealthNews, name: [string, string]): { ko: string; en: string } {
  const [ko, en] = name;
  if (n.to === 2) return { ko: `${ko}의 위독설이 퍼졌습니다. 가문 사람들이 거점으로 모여든다는 소문입니다.`, en: `Rumors spread that ${en} is dying. Word is the family is gathering at the seat.` };
  if (n.to === 1) return n.from === 2 ? { ko: `${ko}이(가) 고비를 넘겼다는 말이 돕니다. 그래도 건강설은 가시지 않았습니다.`, en: `Word is that ${en} has passed the crisis, though talk of ill health lingers.` } : { ko: `${ko}이(가) 공개 행사에 잇따라 나타나지 않습니다. 건강설이 돕니다.`, en: `${en} keeps missing public appearances. Rumors of ill health are circulating.` };
  return { ko: `${ko}이(가) 공개 석상에 건재한 모습으로 나타났습니다. 건강설이 잦아듭니다.`, en: `${en} appeared in public looking hale. The rumors are dying down.` };
}
