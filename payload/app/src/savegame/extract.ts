// 세이브 → SLLM 요약(2026-11-03, 세이브 읽기 1단계). 게임에 묻지 않고 자동 저장에서 읽는 정보.
// 1단계 범위: 날짜·플레이어·세이브 번호(sllm_save_id), 제국 목록, 우리 지도자, 우리 행성(총독·방침 표식 포함).
// 4.5 세이브는 행성(planets.planet)과 식민지(colony)가 나뉜다: 수치(안정도·주민·지정)는 colony, 표식·변수는 행성(carrier).
import { indexTop, parseRange, isObj, str, num, list, type CwObject, type CwValue } from './cw';
import { resolveName, type LocTable } from './loc';

export interface SaveCountry { id: string; name: string; adj: string; type: string; human: boolean; ethics: string[]; gov: string; authority: string; civics: string[]; personality: string; capital: string; mil: number | null; eco: number | null; tech: number | null; size: number | null; idx: number | null; /** 고른 정책 선택지(2026-11-05 정책으로 보는 호감, src/policy-view.ts) */ pol?: string[] }
export interface SaveLeader { id: string; name: string; cls: string; level: number | null; traits: string[]; gender: string; age: number | null; species: string; ruler: boolean }
export interface SavePlanet { id: string; name: string; cls: string; clsName: string; des: number; capital: boolean; size: number | null; designation: string; pops: number | null; stability: number | null; crime: number | null; freeAmenities: number | null; freeHousing: number | null; governor: string; governorName: string; idx: number | null; gpol: number; gvet: boolean }
export interface SaveSnap { v: 1; date: string; version: string; saveName: string; player: { id: string; name: string; sid: string }; countries: SaveCountry[]; leaders: SaveLeader[]; planets: SavePlanet[]; ms: number }

/** 총독 방침 표식 순서(앱 src/govpolicy.ts GOV_POLICIES 의 n 과 같아야 함). */
export const GPOL_FLAGS = ['research', 'foundry', 'factory', 'mining', 'generator', 'farming', 'urban', 'fortress', 'unity', 'trade']; // 9·10 = 준비만 한 방침(GOV_POLICIES_NEXT)
/** 행성 지정 → 번호(연결 모드 sllm_probe_planets.txt 와 같은 묶음: 1 수도 2 광업 3 농업 4 에너지 5 연구 6 산업 7 교역 8 행정·신앙 9 요새 10 휴양 11 형벌·노예 12 도시 0 그 밖). */
export function desOf(d: string): number {
  if (d.startsWith('col_capital')) return 1;
  const t: Array<[RegExp, number]> = [[/mining/, 2], [/farming/, 3], [/generator|energy/, 4], [/research/, 5], [/industrial|foundry|factory|forge/, 6], [/trade/, 7], [/bureau/, 8], [/fortress/, 9], [/resort|pleasure/, 10], [/penal|slave/, 11], [/city|hive$|nexus|ecu_mix|col_hiv/, 12]];
  for (const [re, n] of t) if (re.test(d)) return n; return 0;
}
const KEEP_TYPES = new Set(['default', 'fallen_empire', 'awakened_fallen_empire']);
const strs = (v: unknown): string[] => list(v).map((x) => str(x)).filter(Boolean);
const keys = (v: unknown): string[] => (isObj(v) ? Object.keys(v) : []);

export function extractSave(gs: Buffer, loc: LocTable): SaveSnap {
  const t0 = Date.now(), idx = indexTop(gs), blk = (k: string): CwValue | null => { const r = idx.get(k); return r ? parseRange(gs, r[0], r[1]) : null; }, top = (k: string) => { const r = idx.get(k); return r ? gs.toString('utf8', r[0], r[1]).replace(/^"|"$/g, '') : ''; };
  const player = list(blk('player'))[0] as CwObject | undefined, pid = str(player?.country) || '0';
  const countries = (blk('country') as CwObject) ?? {}, me = (isObj(countries[pid]) ? countries[pid] : {}) as CwObject;
  const sid = str(isObj(me.variables) ? (me.variables as CwObject).sllm_save_id : '');
  const outC: SaveCountry[] = [];
  for (const [id, c] of Object.entries(countries)) {
    if (!isObj(c)) continue; const type = str(c.type) || 'default'; if (!KEEP_TYPES.has(type)) continue;
    const g = isObj(c.government) ? c.government : {}, vars = isObj(c.variables) ? c.variables : {};
    outC.push({ id, name: resolveName(c.name, loc), adj: resolveName(c.adjective, loc), type, human: id === pid, ethics: strs(isObj(c.ethos) ? ((c.ethos as CwObject).ethic ?? (c.ethos as CwObject).ethics) : undefined), gov: str(g.type), authority: str(g.authority), civics: strs(g.civics), personality: str(c.personality), capital: str(c.capital),
      mil: num(c.military_power), eco: num(c.economy_power), tech: num(c.tech_power), size: num(c.empire_size), idx: num((vars as CwObject).sllm_idx),
      pol: list(c.active_policies).flatMap((x) => (Array.isArray(x) ? x : [x])).map((p) => (isObj(p) ? str(p.selected) : '')).filter(Boolean) });
  }
  const ruler = str(me.ruler), leaders = (blk('leaders') as CwObject) ?? {}, outL: SaveLeader[] = [], names = new Map<string, string>();
  for (const [id, l] of Object.entries(leaders)) {
    if (!isObj(l) || str(l.country) !== pid) continue; const name = resolveName(l.name, loc); names.set(id, name);
    outL.push({ id, name, cls: str(l.class), level: num(l.level), traits: strs(l.traits), gender: str(l.gender), age: num(l.age), species: str(l.species), ruler: id === ruler });
  }
  const pb = blk('planets'), planets = isObj(pb) ? ((pb.planet as CwObject) ?? {}) : {}, colonies = (blk('colony') as CwObject) ?? {}, outP: SavePlanet[] = [];
  for (const [id, p] of Object.entries(planets)) {
    if (!isObj(p) || str(p.owner) !== pid) continue;
    const col = (isObj(colonies[str(p.colony)]) ? colonies[str(p.colony)] : p) as CwObject, flags = keys(p.flags), vars = (isObj(p.variables) ? p.variables : {}) as CwObject;
    const tm = isObj(p.timed_modifier) ? (p.timed_modifier as CwObject).items : undefined, mods = list(tm).flatMap((x) => (Array.isArray(x) ? x : [x])).map((m) => (isObj(m) ? str(m.modifier) : '')).filter(Boolean); // timed_modifier = { items = { { modifier = … days = … } … } }
    const gp = GPOL_FLAGS.findIndex((f) => flags.includes('sllm_gov_' + f)), gov = str(col.governor);
    const dsg = str(col.final_designation);
    outP.push({ id, name: resolveName(p.name, loc), cls: str(p.planet_class), clsName: resolveName(str(p.planet_class), loc), des: desOf(dsg), capital: dsg.startsWith('col_capital'), size: num(p.planet_size), designation: str(col.final_designation), pops: num(col.num_sapient_pops), stability: num(col.stability), crime: num(col.crime),
      freeAmenities: num(col.free_amenities), freeHousing: num(col.free_housing), governor: gov === '4294967295' ? '' : gov, governorName: names.get(gov) ?? '', idx: num(vars.sllm_pl_idx), gpol: gp < 0 ? 0 : gp + 1, gvet: mods.includes('sllm_gov_veteran') });
  }
  return { v: 1, date: top('date'), version: top('version'), saveName: top('name'), player: { id: pid, name: outC.find((c) => c.id === pid)?.name ?? '', sid }, countries: outC, leaders: outL, planets: outP, ms: Date.now() - t0 };
}
