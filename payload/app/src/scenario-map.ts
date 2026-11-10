// 시나리오 은하 지도(2026-11-06 사용자: 「작전지휘실 전체 지도 기능으로 시나리오 팩 전용 "은하 지도" — 섹터 구역마다 총독 초상화, 어느 구역 누구 총독」) — 순수 규칙.
// 앱: src/features/scenario-map-app.ts · 화면: ui/scenario-map.html(+ ui/scenario-map.js) · 게임: scenario-mods/sllm_scenario_corridor 의 sllm_cr_sector_report(매달).
// 게임 줄(세 자리 나라의 섹터마다, 앞뒤로 BEG·END):
//   SCNSECBEG sc sid date
//   SCNSEC    sc sid side=a|b|p cap=(수도 성계의 지도 번호, 모르면 -1) core=1|0 nob=1|0(귀족 총독) nid=(귀족 번호 = 그 귀족 거점의 지도 번호, 아니면 -1 · 2026-11-06 · 앱은 줄에 없으면 -2) gf=1|0(여성) age date gov=(총독 이름, 없으면 빈칸) name=(섹터 이름)
//   SCNSECEND sc sid n date
// 지도: 세이브 성계(작전지휘실과 같은 읽기, 안개 없이) 위에 섹터를 칠한다. 섹터 수도 = 지도 번호(성계 이름 키 SLLM_CR_SYS_<번호>), 수도 섹터 = 그 나라 수도 성계.
// 섹터 구역 = 그 나라 땅 성계를 항로로 가장 가까운 섹터 수도에 붙인 것(게임의 실제 섹터 경계와 거의 같고, 전쟁으로 땅이 바뀌면 다음 세이브에서 따라간다).
import type { Side } from './scenario';

export interface ScnSector { side: Side; cap: number; core: boolean; noble: boolean; nid: number; female: boolean; age: number; gov: string; name: string; rebel?: boolean; own?: number } // own(2026-11-08): 이 섹터의 주인 나라를 직접 정한다(회랑의 괴뢰국). rebel: 반란으로 떨어져 나간 귀족 영지(2026-11-08 — 앱이 그 땅을 반란국 섹터로 그린다)
export interface ScnSectorBook { date: string; list: ScnSector[] }

const clean = (v: unknown) => String(v ?? '').replace(/^\\+/, '').trim();
const num = (v: unknown, d = 0) => { const n = Number(clean(v).replace(/,/g, '')); return Number.isFinite(n) ? n : d; };
const SEC_MAX = 400;

/** BEG·SCNSEC·END 줄을 모아 한 번의 보고(세이브 번호별)로 묶는다. END 가 오면 완성된 보고를 돌려준다. */
export class SectorCollector {
  private open = new Map<string, ScnSectorBook>();
  /** sid 는 부른 쪽이 정리해서 넘긴다. 완성되면 {sid, book}. */
  feed(kind: string, sid: string, kv: Record<string, string>): { sid: string; book: ScnSectorBook } | null {
    if (clean(kv.sc) !== 'corridor' || !sid) return null;
    if (kind === 'SCNSECBEG') { this.open.set(sid, { date: clean(kv.date), list: [] }); return null; }
    const b = this.open.get(sid); if (!b) return null; // 시작 줄을 못 본 보고(앱이 중간에 켜짐)는 버리고 다음 달을 기다린다
    if (kind === 'SCNSEC') {
      const side = clean(kv.side); if (side !== 'a' && side !== 'b' && side !== 'p') return null;
      if (b.list.length < SEC_MAX) b.list.push({ side, cap: Math.round(num(kv.cap, -1)), core: num(kv.core) >= 1, noble: num(kv.nob) >= 1, nid: clean(kv.nid) === '' ? -2 : Math.round(num(kv.nid, -1)), female: num(kv.gf) >= 1, age: Math.max(0, Math.round(num(kv.age))), gov: clean(kv.gov).slice(0, 80), name: clean(kv.name).slice(0, 80) });
      return null;
    }
    if (kind === 'SCNSECEND') { this.open.delete(sid); if (!b.date) b.date = clean(kv.date); return { sid, book: b }; }
    return null;
  }
}

export function fixBook(o: unknown): ScnSectorBook | null {
  const b = o as Partial<ScnSectorBook> | null; if (!b || typeof b !== 'object' || !Array.isArray(b.list)) return null;
  const list: ScnSector[] = [];
  for (const x of b.list.slice(0, SEC_MAX)) {
    if (!x || (x.side !== 'a' && x.side !== 'b' && x.side !== 'p')) continue;
    list.push({ side: x.side, cap: Number.isInteger(x.cap) ? x.cap : -1, core: !!x.core, noble: !!x.noble, nid: Number.isInteger(x.nid) ? x.nid : -2, female: !!x.female, age: Math.max(0, Math.round(Number(x.age) || 0)), gov: String(x.gov ?? '').slice(0, 80), name: String(x.name ?? '').slice(0, 80) });
  }
  return { date: String(b.date ?? ''), list };
}

// ---- 지도 만들기 ----
export interface RawSys { id: number; x: number; y: number; key: string; owner: number; hl: number[]; cap?: number }
export interface MapSys { id: number; x: number; y: number; key: string; o: number; s: number; m: number }
export interface MapSector extends ScnSector { i: number; owner: number; sys: number; size: number }
export interface SectorMap { systems: MapSys[]; lanes: Array<[number, number]>; sectors: MapSector[]; missing: number }

/** 성계 이름 키 → 지도 번호(SLLM_CR_SYS_12 → 12). 좌석 성계(솔·데네브·플레이어 수도)는 이름 키가 없어 -1. */
/** 귀족 총독 고유 초상화(ui/assets/scenario/corridor/gov/gov_<A|B>-<번호>.png, 2026-11-06)의 번호. 첫 귀족(nob)만 — 옛 보고(nid 없음 = -2)는 섹터 수도 번호로. 아니면 -1. */
export function noblePicId(sc: Pick<ScnSector, 'side' | 'noble' | 'nid' | 'cap' | 'core'>): number {
  if (!sc.noble || (sc.side !== 'a' && sc.side !== 'b')) return -1;
  if (sc.nid >= 0) return sc.nid;
  return sc.nid === -2 && !sc.core ? sc.cap : -1; // -2 = nid 를 모르는 옛 보고 · -1 = 표에 없는 무작위 귀족
}
/** 자기 거점 섹터에 제 귀족이 앉아 있지 않은 거점(지도 번호) 목록. isHub(자리, 번호) = 그 번호가 귀족 거점인가(앱에 그림이 있는가).
 *  수도 섹터·플레이어 자리·옛 보고(nid -2)는 뺀다. 2026-11-06: 게임 쪽 매달 검사를 앱으로 옮김(어긋날 때만 게임에 「되돌려 앉혀라」를 보낸다). */
export function nobleMisplaced(book: ScnSectorBook | null, isHub: (side: 'a' | 'b', id: number) => boolean): number[] {
  const out: number[] = [];
  for (const sc of book?.list ?? []) {
    if ((sc.side !== 'a' && sc.side !== 'b') || sc.core || sc.cap < 0 || sc.nid === -2 || !isHub(sc.side, sc.cap)) continue;
    if (!sc.noble || sc.nid !== sc.cap) out.push(sc.cap);
  }
  return out.sort((a, b) => a - b);
}
export function mapIdOf(key: string): number { const m = /^SLLM_CR_SYS_(\d+)$/.exec(key || ''); return m ? Number(m[1]) : -1; }

/** sideOwner: 자리(a·b·p) → 세이브 나라 번호. 섹터 수도를 찾고, 나라마다 땅 성계를 항로로 가장 가까운 섹터 수도에 붙인다. */
/** assign(선택, 2026-11-07 귀족 영역다툼): 지도 번호 → 그 성계가 속할 섹터의 수도 지도 번호. 주인 나라가 같을 때만 따르고, 나머지 성계는 예전처럼 너비 우선으로 나눈다. */
export function buildSectorMap(raw: RawSys[], sideOwner: Partial<Record<Side, number>>, book: ScnSectorBook | null, assign?: Map<number, number>): SectorMap {
  const byId = new Map(raw.map((s) => [s.id, s] as [number, RawSys]));
  const byMid = new Map<number, number>(); for (const s of raw) { const m = mapIdOf(s.key); if (m >= 0) byMid.set(m, s.id); }
  const capOf = new Map<number, number>(); for (const s of raw) if (s.cap !== undefined && !capOf.has(s.cap)) capOf.set(s.cap, s.id); // 나라 → 수도 성계
  const sectors: MapSector[] = []; let missing = 0;
  for (const sc of book?.list ?? []) {
    const owner = sc.own ?? sideOwner[sc.side]; if (owner === undefined || owner < 0) { missing++; continue; }
    let sys = sc.core ? capOf.get(owner) : byMid.get(sc.cap);
    if (sys === undefined && sc.cap >= 0) sys = byMid.get(sc.cap);
    if (sys === undefined && sc.core) sys = capOf.get(owner);
    if (sys === undefined) { missing++; continue; }
    if (sectors.some((x) => x.sys === sys)) continue; // 같은 수도가 두 번(보고가 겹침)
    sectors.push({ ...sc, i: sectors.length, owner, sys, size: 0 });
  }
  // 나라별 다중 출발 너비 우선 탐색(그 나라 땅 안에서만). 닿지 않는 땅(떨어진 영토)은 가장 가까운 섹터 수도(직선 거리)로.
  const sec = new Map<number, number>();
  const owners = new Set(sectors.map((x) => x.owner));
  const pre = new Map<number, number>(); // 미리 정해진 성계(영역다툼 결과) → 섹터
  if (assign && assign.size) {
    const byCap = new Map<number, MapSector>(); for (const x of sectors) { const m = mapIdOf(byId.get(x.sys)?.key ?? ''); if (m >= 0) byCap.set(m, x); }
    for (const s of raw) { const m = mapIdOf(s.key); const cap = m >= 0 ? assign.get(m) : undefined; const x = cap !== undefined ? byCap.get(cap) : undefined; if (x && (x.owner === s.owner || x.rebel)) pre.set(s.id, x.i); } // 반란국 땅은 세이브 주인이 바뀌어도(반란국) 그 섹터로
  }
  for (const ow of owners) {
    const q: number[] = [];
    for (const x of sectors) if (x.owner === ow && byId.get(x.sys)?.owner === ow && !sec.has(x.sys)) { sec.set(x.sys, x.i); q.push(x.sys); }
    for (const [sid, i] of pre) if (sectors[i].owner === ow && !sec.has(sid)) { sec.set(sid, i); q.push(sid); }
    for (let h = 0; h < q.length; h++) {
      const cur = byId.get(q[h]); if (!cur) continue;
      for (const n of cur.hl) { const ns = byId.get(n); if (!ns || ns.owner !== ow || sec.has(n)) continue; sec.set(n, sec.get(q[h])!); q.push(n); }
    }
    const caps = sectors.filter((x) => x.owner === ow);
    for (const s of raw) {
      if (s.owner !== ow || sec.has(s.id) || !caps.length) continue;
      let best = caps[0], bd = Infinity;
      for (const c of caps) { const cs = byId.get(c.sys); if (!cs) continue; const d = (cs.x - s.x) ** 2 + (cs.y - s.y) ** 2; if (d < bd) { bd = d; best = c; } }
      sec.set(s.id, best.i);
    }
  }
  const systems: MapSys[] = raw.map((s) => ({ id: s.id, x: s.x, y: s.y, key: s.key, o: s.owner, s: sec.get(s.id) ?? -1, m: mapIdOf(s.key) }));
  for (const s of systems) if (s.s >= 0) sectors[s.s].size++;
  const lanes: Array<[number, number]> = []; const seen = new Set<string>();
  for (const s of raw) for (const t of s.hl) { if (!byId.has(t)) continue; const a = Math.min(s.id, t), b = Math.max(s.id, t), k = a + ',' + b; if (seen.has(k)) continue; seen.add(k); lanes.push([a, b]); }
  return { systems, lanes, sectors, missing };
}
