// 단일 의식 제국의 「동기화 로그」(기계) / 「공명 보고」(군체)와 「이탈 노드 보고」(알파 11, 2026-10-25 사용자 결정 3단계).
// 비서가 없는 기계·군체 제국에서 비서 업무 보고 자리를 채운다. 미리 짠 틀 문장만(LLM 없음, 게임 효과 없음).
// 이탈(Deviancy) = 게임의 planet_crime(단일 의식 제국에서는 이탈로 보인다). 표시 기준 30 이상(사용자 확정 2026-10-25).
// 앱: src/features/gestalt-report-app.ts, 화면: ui/office-gestalt.js, 모드: sllm_probe_protest.txt(DEVIANT 줄).
import { L } from './i18n-pick';

export const DEVIANCY_ALERT = 30;
export type GestaltKind = 'machine' | 'hive' | 'gestalt';
export interface DeviantPlanet { name: string; dev: number; stab: number | null }
export interface ReportInput {
  kind: GestaltKind;
  date: string;
  deviant: DeviantPlanet[];
  planets: { name: string; facts: { stability?: number; amenities?: number; housing?: number } }[]; // 문제 있는 행성(점수 순, 최대 3)
  pledges: { planet: string; field: string; daysLeft: number | null }[];
  crises: string[]; // 표시 이름(화면 언어)
  wars: string[];
  hot: { name: string; key: 'grudge' | 'gratitude' | 'fear' | 'ambition' }[];
}
export interface ReportItem { tag: 'deviant' | 'planet' | 'pledge' | 'crisis' | 'war' | 'feeling' | 'none'; text: string }

const M = (k: GestaltKind) => k === 'machine';
export function reportTitle(k: GestaltKind): string { return M(k) ? L('동기화 로그', 'Synchronization log') : k === 'hive' ? L('공명 보고', 'Resonance report') : L('의식 보고', 'Consciousness report'); }
const FIELD: Record<string, [string, string]> = { housing: ['주거', 'housing'], amenities: ['편의', 'amenities'], order: ['질서', 'order'], development: ['개발', 'development'] };
const FEEL: Record<GestaltKind, Record<string, [string, string]>> = {
  machine: { grudge: ['위협 우선순위 상승', 'threat priority elevated'], gratitude: ['협력 가치 상승', 'cooperation value elevated'], fear: ['위험 평가 상승', 'risk assessment elevated'], ambition: ['확장 기회 포착', 'expansion opportunity detected'] },
  hive: { grudge: ['적대 본능이 깨어났다', 'hostile instinct stirs'], gratitude: ['공생 본능이 자란다', 'symbiotic instinct grows'], fear: ['경계 본능이 곤두섰다', 'wary instinct bristles'], ambition: ['포식 본능이 눈을 떴다', 'predatory instinct wakes'] },
  gestalt: { grudge: ['적대', 'hostility'], gratitude: ['호의', 'goodwill'], fear: ['경계', 'wariness'], ambition: ['야심', 'ambition'] },
};

export function buildReport(i: ReportInput): ReportItem[] {
  const out: ReportItem[] = [], m = M(i.kind), h = i.kind === 'hive';
  for (const d of [...i.deviant].sort((a, b) => b.dev - a.dev)) {
    const st = d.stab !== null ? L(` · 안정도 ${Math.round(d.stab)}`, ` · stability ${Math.round(d.stab)}`) : '';
    out.push({ tag: 'deviant', text: m ? L(`이탈 노드: 「${d.name}」 이탈도 ${Math.round(d.dev)}${st}. 권고: 질서 유지 지침 강화.`, `Deviant node: "${d.name}" deviancy ${Math.round(d.dev)}${st}. Recommendation: reinforce order directives.`)
      : h ? L(`공명이 흐트러진 곳: 「${d.name}」 이탈 ${Math.round(d.dev)}${st}. 드론들이 흩어지고 있다.`, `The resonance falters on "${d.name}": deviancy ${Math.round(d.dev)}${st}. The drones are drifting apart.`)
      : L(`이탈: 「${d.name}」 ${Math.round(d.dev)}${st}.`, `Deviancy on "${d.name}": ${Math.round(d.dev)}${st}.`) });
  }
  for (const p of i.planets.slice(0, 3)) {
    const f: string[] = [];
    if (p.facts.stability !== undefined) f.push(L(`안정도 ${Math.round(p.facts.stability)}`, `stability ${Math.round(p.facts.stability)}`));
    if (p.facts.amenities !== undefined) f.push(L(`편의 ${Math.round(p.facts.amenities)}`, `amenities ${Math.round(p.facts.amenities)}`));
    if (p.facts.housing !== undefined) f.push(L(`주거 ${Math.round(p.facts.housing)}`, `housing ${Math.round(p.facts.housing)}`));
    const fs = f.join(', ');
    out.push({ tag: 'planet', text: m ? L(`연산 보고: 행성 「${p.name}」 ${fs}.`, `Computation report: planet "${p.name}" ${fs}.`) : h ? L(`군체가 느낀다: 「${p.name}」 ${fs}.`, `The hive senses: "${p.name}" ${fs}.`) : L(`행성 「${p.name}」: ${fs}.`, `Planet "${p.name}": ${fs}.`) });
  }
  for (const p of i.pledges) {
    const fld = FIELD[p.field] ?? [p.field, p.field], left = p.daysLeft === null ? '' : p.daysLeft >= 0 ? L(` — ${p.daysLeft}일 남음`, ` — ${p.daysLeft} days left`) : L(' — 기한 지남', ' — overdue');
    out.push({ tag: 'pledge', text: m ? L(`약속 처리 대기: 「${p.planet}」 ${fld[0]}${left}.`, `Pending commitment: "${p.planet}" ${fld[1]}${left}.`) : h ? L(`군체가 기억하는 약속: 「${p.planet}」 ${fld[0]}${left}.`, `A promise the hive remembers: "${p.planet}" ${fld[1]}${left}.`) : L(`약속: 「${p.planet}」 ${fld[0]}${left}.`, `Promise: "${p.planet}" ${fld[1]}${left}.`) });
  }
  for (const c of i.crises) out.push({ tag: 'crisis', text: m ? L(`최우선 위협: 은하 위기 「${c}」 진행 중.`, `Top-priority threat: galactic crisis "${c}" ongoing.`) : h ? L(`은하 전체가 떨고 있다: 「${c}」.`, `The whole galaxy trembles: "${c}".`) : L(`은하 위기 「${c}」 진행 중.`, `Galactic crisis "${c}" ongoing.`) });
  for (const w of i.wars) out.push({ tag: 'war', text: m ? L(`교전 중: ${w}.`, `Engaged in conflict: ${w}.`) : h ? L(`군체가 싸우고 있다: ${w}.`, `The hive is at war: ${w}.`) : L(`전쟁 중: ${w}.`, `At war: ${w}.`) });
  for (const e of i.hot) { const f = FEEL[i.kind][e.key] ?? [e.key, e.key]; out.push({ tag: 'feeling', text: m ? L(`외부 지성 「${e.name}」: ${f[0]}.`, `External intelligence "${e.name}": ${f[1]}.`) : h ? L(`「${e.name}」을(를) 향해 ${f[0]}.`, `Toward "${e.name}", ${f[1]}.`) : L(`「${e.name}」: ${f[0]}.`, `"${e.name}": ${f[1]}.`) }); }
  if (!out.length) out.push({ tag: 'none', text: m ? L('모든 시스템 정상. 보고할 이상 없음.', 'All systems nominal. No anomalies to report.') : h ? L('군체는 고요하다. 모든 드론이 하나로 울린다.', 'The hive is calm. Every drone resonates as one.') : L('보고할 일이 없습니다.', 'Nothing to report.') });
  return out;
}

/** 월간 상황 묶음 안의 DEVIANT 줄을 모은다(STATE_BEGIN ~ STATE_END). 줄이 없던 달 = 이탈 노드 없음. */
export class DeviantCollector {
  private cur: { n: string; list: DeviantPlanet[] } | null = null;
  feed(m: { kind: string; kv: Record<string, string> }): { list: DeviantPlanet[] } | null {
    if (m.kind === 'STATE_BEGIN') { this.cur = { n: m.kv.n ?? '', list: [] }; return null; }
    const c = this.cur; if (!c) return null;
    if (m.kind === 'DEVIANT') {
      if ((m.kv.n ?? '') !== c.n) return null;
      const name = String(m.kv.name ?? '').trim(), dev = Number(m.kv.cr), st = Number(m.kv.st);
      if (name && !/[\[\]$]/.test(name) && Number.isFinite(dev) && c.list.length < 50) c.list.push({ name: name.slice(0, 80), dev, stab: m.kv.st !== undefined && Number.isFinite(st) ? st : null });
      return null;
    }
    if (m.kind === 'STATE_END') { this.cur = null; return { list: c.list }; }
    return null;
  }
}
