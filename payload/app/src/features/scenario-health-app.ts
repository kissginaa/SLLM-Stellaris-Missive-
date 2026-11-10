// 귀족 건강(시나리오 「회랑의 삼파전」, 앱 쪽, 2026-11-08). 규칙: src/scenario-health.ts
// 연례(scenario-domains-app 의 연례 판단 안에서 healthOnYear): 지병·회복·소문, 병사·독사는 영구 사망(killNoble).
// 화면: 제국 세력도 신상 파일의 「건강(소문)」 칸 — 바깥에 보이는 소문만(진짜 값은 2단계 내부자 매수에서).
// 저장: userData/sllm_scenario_health.json(세이브별, 최근 12개, 작업 스레드로 씀). 게임에는 아무것도 보내지 않는다(죽을 때만 sllm_cr_noble_die).
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { bgWriteJson } from '../app/bg-worker';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { CR_NOBLES } from '../scenario-nobles-data';
import { hash01 } from '../scenario-nobles';
import { newHealthSave, fixHealthSave, healthYear, newsLine, RUMOR_NAME, OBS_NAME, obsOf, initRec, type HealthSave } from '../scenario-health';
import { favFood, JOBS, JOB_NAME, type Job } from '../scenario-intel';

const KEEP = 12;
const NOBLE_BY_ID = new Map(CR_NOBLES.map((n) => [n.id, n] as [number, (typeof CR_NOBLES)[number]]));
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_health.json');
let all: Record<string, HealthSave> | null = null;
function saves(): Record<string, HealthSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixHealthSave(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_health', error: (e as Error).message }); }
  return all;
}
function save(): void {
  const s = saves(), keys = Object.keys(s); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete s[k];
  bgWriteJson(file(), { saves: s }, (e) => { if (e) logDiagnostic('warn', 'scenario_health.save_failed', { error: e }); });
}
const stateOf = (sid: string): HealthSave => (saves()[sid] ??= newHealthSave());

/** 연례(같은 해 한 번). alive: 지금 살아 있는 귀족 번호 · known: 플레이어가 아는 귀족(소문 줄은 아는 귀족만).
 *  돌려줌: 연말 보고서에 붙일 줄 · 죽을 귀족(부르는 쪽이 killNoble). */
export function healthOnYear(sid: string, year: number, alive: number[], known: Set<number>): { lines: Array<{ ko: string; en: string }>; deaths: Array<{ id: number; why: 'illness' | 'poison' }> } {
  try {
    const s = stateOf(sid);
    const ids = alive.map((id) => ({ id, calc: NOBLE_BY_ID.get(id)?.tr[4] ?? 0 }));
    const r = healthYear(s, ids, year, (k) => hash01(`${sid}|hp|${k}`));
    save();
    const lines = r.news.filter((x) => known.has(x.id)).map((x) => { const n = NOBLE_BY_ID.get(x.id)!; return newsLine(x, [n.ko, n.en]); });
    if (r.news.length || r.deaths.length) logDiagnostic('info', 'scenario_health.year', { sid, year, news: r.news.length, deaths: r.deaths.map((d) => `${d.id}:${d.why}`).join(',') });
    return { lines, deaths: r.deaths };
  } catch (e) { logDiagnostic('warn', 'scenario_health.year_failed', { error: (e as Error).message }); return { lines: [], deaths: [] }; }
}
// 내부자(회랑 정보국의 매수)는 정보국이 알려 준다(가져오기 고리를 만들지 않으려고 등록 방식, 2026-11-08 2단계)
let insOf: ((sid: string, id: number) => Partial<Record<Job, string>> | null) | null = null;
let dblOf: ((sid: string, id: number) => Job[]) | null = null;
/** dbl: 몰래 돌아선 내부자(이중 첩자) — 그 내부자의 건강 보고는 거짓(「건재」)이 된다. 우리는 구별하지 못한다. */
export function setInsiderSource(fn: (sid: string, id: number) => Partial<Record<Job, string>> | null, dbl?: (sid: string, id: number) => Job[]): void { insOf = fn; dblOf = dbl ?? null; }
/** 접견 장소(리무진·식당·저택)가 쓰는 내부자 조회. */
export const insidersOf = (sid: string, id: number): Partial<Record<Job, string>> | null => insOf?.(sid, id) ?? null;
/** 세력도용: 귀족 번호 → 우리가 아는 건강.
 *  lvl 0 소문(건재·건강설·위독설) · 1 관찰(운전수 매수 — 다섯 구간) · 2 진료 기록(주치의 매수 — 수치·지병·쌓인 독).
 *  warn: 나빠 보이면 · ins: 매수한 내부자 이름 · food: 요리사가 알려 준 좋아하는 음식. 아직 기록이 없으면 건재. */
export function healthRumors(sid: string): Record<string, { lvl: number; b: number; name: string; warn: boolean; ins?: string[]; food?: string }> {
  const s = saves()[sid], out: Record<string, { lvl: number; b: number; name: string; warn: boolean; ins?: string[]; food?: string }> = {};
  for (const n of CR_NOBLES) {
    const r = s?.hp[n.id], ins = insOf?.(sid, n.id) ?? null, rb = r?.rb ?? 0;
    const extra = { ...(ins && JOBS.some((j) => ins[j]) ? { ins: JOBS.filter((j) => ins[j]).map((j) => L(...JOB_NAME[j])) } : {}), ...(ins?.cook ? { food: L(...favFood(n)) } : {}) };
    const lie = dblOf?.(sid, n.id) ?? [];
    if (ins?.doctor && r && lie.includes('doctor')) { out[n.id] = { lvl: 2, b: rb, name: String(Math.max(r.v, 82)), warn: false, ...extra }; continue; } // 돌아선 주치의의 거짓 진료 기록
    if (ins?.doctor && r) { out[n.id] = { lvl: 2, b: rb, name: `${r.v}${r.ill ? L(' · 지병', ' · illness') : ''}${r.tox ? L(` · 독 ${r.tox}단계`, ` · poison ${r.tox}`) : ''}`, warn: r.v < 60 || !!r.ill || !!r.tox, ...extra }; continue; }
    if ((ins?.driver && !lie.includes('driver') || ins?.butler && !lie.includes('butler')) && r) { const o = obsOf(r.v); out[n.id] = { lvl: 1, b: rb, name: L(...OBS_NAME[o]), warn: o >= 2, ...extra }; continue; }
    if ((ins?.driver || ins?.butler) && r) { out[n.id] = { lvl: 1, b: rb, name: L(...OBS_NAME[0]), warn: false, ...extra }; continue; } // 돌아선 운전수·집사: 늘 건재하다고 보고
    out[n.id] = { lvl: 0, b: rb, name: L(...RUMOR_NAME[rb]), warn: rb > 0, ...extra };
  }
  return out;
}
/** 전속 기자 매수(2026-11-08): 건강설을 퍼뜨린다 — 소문이 한 단계 나빠 보인다(헛소문, 다음 해 소문을 다시 정할 때까지). */
export function plantRumor(sid: string, id: number): void {
  const s = stateOf(sid), r = (s.hp[id] ??= initRec(hash01(`${sid}|hp|i${id}`)));
  if (r.rb < 2) { r.rb = (r.rb + 1) as 1 | 2; r.fake = 1; save(); }
}
/** 중독·사고(2026-11-08 3단계): 건강을 깎는다(tox 면 독 단계 +1). 돌려줌: 남은 건강(0 이면 부르는 쪽이 영구 사망 처리). */
export function harmNoble(sid: string, id: number, dv: number, tox = false): number {
  const s = stateOf(sid), r = (s.hp[id] ??= initRec(hash01(`${sid}|hp|i${id}`)));
  r.v = Math.max(0, Math.min(100, Math.round(r.v - dv))); if (tox) r.tox = Math.min(10, (r.tox ?? 0) + 1);
  save(); return r.v;
}
/** 다른 기능(2단계 의사 매수·중독)이 쓸 진짜 기록. */
export function healthRecord(sid: string, id: number): { v: number; ill: boolean; tox: number } | null { const r = saves()[sid]?.hp[id]; return r ? { v: r.v, ill: !!r.ill, tox: r.tox ?? 0 } : null; }
/** 개발자 도구(2026-11-08): 건강 상태 보기 · 한 귀족 크게 다치게 하기. */
export function healthDevState(sid: string): string[] {
  const s = stateOf(sid);
  return CR_NOBLES.map((n) => { const r = s.hp[n.id]; return r ? `${L(n.ko, n.en)}: ${r.v}${r.ill ? L(' 지병', ' ill') : ''}${r.tox ? L(` 독${r.tox}`, ` tox${r.tox}`) : ''} · ${L('소문', 'rumor')} ${L(...RUMOR_NAME[r.rb])}${r.fake ? L('(헛소문)', '(false)') : ''}` : ''; }).filter(Boolean);
}
export function healthDevYearReset(sid: string): void { stateOf(sid).y = -1; save(); }
export const scnHealthTest = { reset: () => { all = {}; }, stateOf };
