// 작전지휘실 은하 지도(2026-11-05 사용자: 함대 사령부 → 작전지휘실을 누르면 우리 식 은하 지도, 거기서 명령·장관/제독 회의). 순수 규칙 — 앱: src/features/galaxy-app.ts,
// 세이브 읽기 작업 스레드: src/galaxy-worker.ts, 화면: ui/fleet-galaxy.js(함대 사령부 창 위에 겹쳐 띄움).
// 1단계(이 파일): 자동 저장 세이브의 gamestate 에서 성계 좌표·하이퍼레인·주인(우주기지)·식민지·함대·제국 색을 읽는다. 세이브는 읽기만 한다(고치지 않음).
// 전장의 안개(실제 세이브로 확인, 2026-11-05): terra_incognita·visited_objects 는 거의 모든 성계를 담아 쓸모가 없고, 플레이어 나라의 hyperlane_systems(항로를 아는 성계)가
//   게임 지도에서 항로가 그려지는 범위다. 별(점)은 모두 그리고, 항로는 아는 성계에서만, 이름은 아는 성계와 그 이웃까지. 주인 표시는 앱이 연락처로 거른다(galaxy-app).
// 함대: 우리 함대는 전부, 남의 함대는 sensor_range_fleets 안이면서 항로를 아는 성계에 있는 군함만.
import { sectionLines } from './savereader';

export interface GSys { id: number; x: number; y: number; name: string; owner: number; hl: number[]; col: number; /** 항로를 아는 성계 */ known: boolean; /** 이름이 보이는 성계(아는 성계 + 이웃) */ named: boolean; cap?: number; /** 모드가 별에 붙인 성계 번호(sllm_sys, sllm_systems.txt) — 작전지휘실 명령이 이 번호로 성계를 고른다 */ sn?: number; /** 업그레이드된 항성기지 등급(2 우주항 · 3 항성 요새 · 4 성채 요새 · 5 성채, starbase_ship_sizes.dds 칸). 전초기지는 없음 */ sb?: number; /** 안개를 걸기 전 이름 키·항로(시나리오 은하 지도 src/features/scenario-map-app.ts 용, 2026-11-06) */ rn?: string; rhl?: number[] }
export interface GCountry { id: number; idx: number | null; name: string; color: string; type: string; me: boolean }
export interface GFleet { id: number; owner: number; sys: number; to: number; name: string; power: number; ships: number; cls: string; moving: boolean; /** 모드 함대 번호(sllm_fo_fid, 자동 작전·작전지휘실 공용) */ fid?: number; /** 가장 큰 배의 아이콘 칸(ship_sizes.dds, 모드 sllm_wr_big 과 같은 번호) */ big?: number; /** 지휘관의 전쟁 성향(모드 sllm_doc_* 특성 키 꼬리, 예 fortress) */ doc?: string }
export interface GalaxyMap { date: string; player: number; systems: GSys[]; countries: GCountry[]; fleets: GFleet[] }

/** 최상위 구역 줄 → 깊이 1 항목들({번호, 시작, 끝(닫는 줄)}). 세이브는 탭 들여쓰기가 일정하다. */
function entries(lines: string[]): Array<{ id: number; s: number; e: number }> {
  const out: Array<{ id: number; s: number; e: number }> = [];
  for (let i = 1; i < lines.length; i++) {
    const m = /^\t(\d+)=\r?$/.exec(lines[i]); if (!m) continue;
    let j = i + 1; while (j < lines.length && !/^\t\}\r?$/.test(lines[j])) j++;
    out.push({ id: Number(m[1]), s: i, e: j }); i = j;
  }
  return out;
}
/** 항목 안 깊이 d(탭 수)의 key=값(한 줄). */
function val(lines: string[], s: number, e: number, d: number, key: string): string | null {
  const pre = '\t'.repeat(d) + key + '=';
  for (let i = s; i < e; i++) if (lines[i].startsWith(pre) && lines[i][pre.length] !== undefined && lines[i].length > pre.length) { const v = lines[i].slice(pre.length).replace(/\r$/, '').trim(); if (v) return v.replace(/^"|"$/g, ''); }
  return null;
}
/** 항목 안 깊이 d 의 key={ … } 블록 범위. */
function block(lines: string[], s: number, e: number, d: number, key: string): [number, number] | null {
  const head = '\t'.repeat(d) + key + '=', close = '\t'.repeat(d) + '}';
  for (let i = s; i < e; i++) {
    if (lines[i].replace(/\r$/, '') !== head) continue;
    let j = i + 1; while (j < e && lines[j].replace(/\r$/, '') !== close) j++;
    return [i + 1, j];
  }
  return null;
}
const nums = (lines: string[], r: [number, number] | null): number[] => {
  if (!r) return [];
  const out: number[] = [];
  for (let i = r[0]; i < r[1]; i++) for (const t of lines[i].split(/\s+/)) if (/^-?\d+$/.test(t)) out.push(Number(t));
  return out;
};
/** name={ key="…" variables={…} } → 표시용 키. PREFIX_NAME_FORMAT·%ADJECTIVE% 같은 틀이면 변수 중 NAME(없으면 마지막 값) 키를 쓴다. */
function nameKey(lines: string[], s: number, e: number, d: number): string {
  const r = block(lines, s, e, d, 'name'); if (!r) return '';
  const keys: string[] = [];
  for (let i = r[0]; i < r[1]; i++) { const m = /key="([^"]*)"/.exec(lines[i]); if (m) keys.push(m[1]); }
  const first = keys[0] || '';
  if (first === '%SEQ%') { const fi = keys.indexOf('fmt', 1), ni = keys.indexOf('num', 1); return `SEQ|${fi > 0 ? keys[fi + 1] ?? '' : ''}|${ni > 0 ? keys[ni + 1] ?? '' : ''}`; } // 「제1함대」 같은 번호 이름
  if (/FORMAT|^%.*%$/.test(first)) {
    const ni = keys.indexOf('NAME', 1); if (ni > 0 && keys[ni + 1]) return keys[ni + 1];
    const vals = keys.slice(1).filter((k, i, a) => !/^[A-Z0-9_]{1,12}$/.test(k) || (i > 0 && /^[A-Z0-9_]{1,12}$/.test(a[i - 1])));
    return vals.filter((k) => !/^PRESCRIPTED_|^%/.test(k)).pop() || first;
  }
  return first;
}

/** 배 크기 → 함대 아이콘 칸(gfx/interface/icons/ship_sizes.dds) · 크기 순위. 모드 sllm_warroom.txt 의 sllm_wr_big 과 같은 번호(2026-11-05 사용자: 타이탄이 있으면 타이탄 아이콘). */
const SIZE_ICON: Array<[RegExp, number, number]> = [
  [/^juggernaut$/, 13, 90], [/^(colossus|massive_ship_fallen_empire|cosmo_crisis_titan)$/, 7, 80], [/titan$/, 6, 70],
  [/mauler_stage_3$|_fallen_mauler$|crisis_mauler$/, 17, 63], [/mauler_stage_2$/, 16, 62], [/mauler_stage_1$/, 15, 61], [/^paladin_ship$/, 28, 55],
  [/battleship|^large_ship_|^queen_swarm$|battlecruiser$/, 5, 50],
  [/harbinger_stage_3$|_fallen_harbinger$|crisis_harbinger$/, 23, 43], [/harbinger_stage_2$/, 22, 42], [/harbinger_stage_1$/, 21, 41],
  [/cruiser$|enforcer$/, 4, 40],
  [/weaver_stage_3$|large_fallen_weaver$|crisis_weaver$/, 20, 33], [/weaver_stage_2$/, 19, 32], [/weaver_stage_1$|small_fallen_weaver$/, 18, 31],
  [/destroyer$|^small_ship_/, 3, 30], [/^frigate$/, 14, 20],
  [/stinger_stage_3$|_fallen_stinger$|crisis_stinger$/, 26, 13], [/stinger_stage_2$/, 25, 12], [/stinger_stage_1$/, 24, 11],
  [/corvette$/, 2, 10],
];
const sizeIcon = (size: string): [number, number] => { for (const [re, fr, rk] of SIZE_ICON) if (re.test(size)) return [fr, rk]; return [0, 0]; };

export function parseGalaxy(gs: string): GalaxyMap {
  const date = /^date="([^"]+)"/m.exec(gs)?.[1] ?? '';
  // 플레이어 나라 번호
  const pl = /^player=\r?\n\{[\s\S]*?country=(\d+)/m.exec(gs); const player = pl ? Number(pl[1]) : 0;

  // 제국: 이름·색·sllm_idx·종류·함대 목록·알려진 성계
  const cl = sectionLines(gs, 'country'), countries: GCountry[] = [], fleetOwner = new Map<number, number>();
  let known = new Set<number>(); let knownAll = false; let sensed = new Set<number>();
  for (const it of entries(cl)) {
    const fl = block(cl, it.s, it.e, 2, 'flag'); let color = '';
    if (fl) { const cb = block(cl, fl[0], fl[1], 3, 'colors'); if (cb) { const m = /"([a-z0-9_]+)"/.exec(cl.slice(cb[0], cb[1]).join(' ')); if (m) color = m[1]; } }
    const vars = block(cl, it.s, it.e, 2, 'variables'); let idx: number | null = null;
    if (vars) for (let i = vars[0]; i < vars[1]; i++) { const m = /^\t\t\tsllm_idx=(-?\d+)/.exec(cl[i]); if (m) { idx = Number(m[1]); break; } }
    const type = val(cl, it.s, it.e, 2, 'type') ?? '';
    countries.push({ id: it.id, idx, name: nameKey(cl, it.s, it.e, 2), color, type, me: it.id === player });
    const fm = block(cl, it.s, it.e, 2, 'fleets_manager');
    if (fm) for (let i = fm[0]; i < fm[1]; i++) { const m = /^\t+fleet=(\d+)/.exec(cl[i]); if (m) fleetOwner.set(Number(m[1]), it.id); }
    if (it.id === player) {
      const hs = block(cl, it.s, it.e, 2, 'hyperlane_systems');
      if (hs) known = new Set(nums(cl, hs)); else knownAll = true; // 기록이 없으면 다 보이게
      sensed = new Set(nums(cl, block(cl, it.s, it.e, 2, 'sensor_range_fleets')));
    }
  }

  // 함대: 위치(movement_manager.coordinate.origin), 목적지, 이름, 전력, 배 수, 종류
  // 지도자 → 전쟁 성향 특성(모드가 모든 제국 지휘관에게 붙임, 2026-11-05): traits="sllm_doc_X"
  // 지휘관은 location={ type=ship id=배 } 로 함대의 배에 탄다 → 아래 배 구역에서 그 배의 함대를 찾는다
  const docShip = new Map<number, string>();
  { const ll = sectionLines(gs, 'leaders'); for (const it of entries(ll)) {
    let doc = '', ship = -1;
    for (let i = it.s; i < it.e; i++) {
      const m = /^\t\ttraits="sllm_doc_([a-z_]+)"/.exec(ll[i]); if (m) doc = m[1];
      if (/^\t\tlocation=\r?$/.test(ll[i]) && /type=ship/.test(ll[i + 2] ?? '')) { const k = /^\t\t\tid=(\d+)/.exec(ll[i + 4] ?? '') ?? /^\t\t\tid=(\d+)/.exec(ll[i + 3] ?? ''); if (k) ship = Number(k[1]); }
    }
    if (doc && ship >= 0) docShip.set(ship, doc);
  } }
  const fll = sectionLines(gs, 'fleet'), fleets: GFleet[] = [];
  const stationFleet = new Set<number>(), shipOfFleet = new Map<number, number>(); // 배 → fleets 칸
  for (const it of entries(fll)) {
    const cls = val(fll, it.s, it.e, 2, 'ship_class') ?? '';
    const owner = fleetOwner.get(it.id); if (owner === undefined) continue;
    const mm = block(fll, it.s, it.e, 2, 'movement_manager');
    let sys = -1, to = -1, moving = false;
    if (mm) {
      const co = block(fll, mm[0], mm[1], 3, 'coordinate'); const o = co ? val(fll, co[0], co[1], 4, 'origin') : null; if (o) sys = Number(o);
      const tc = block(fll, mm[0], mm[1], 3, 'target_coordinate'); const t = tc ? val(fll, tc[0], tc[1], 4, 'origin') : null; if (t) to = Number(t);
      moving = (val(fll, mm[0], mm[1], 3, 'state') ?? '').startsWith('moving');
    }
    if (sys < 0 || sys >= 4294967295) { const cb = block(fll, it.s, it.e, 2, 'combat'); const co = cb ? block(fll, cb[0], cb[1], 3, 'coordinate') : null; const o = co ? val(fll, co[0], co[1], 4, 'origin') : null; if (o) sys = Number(o); }
    if (to >= 4294967295) to = -1;
    if (cls === 'shipclass_starbase' || /station|outpost|platform/.test(cls)) { stationFleet.add(it.id); continue; } // 정거장·채굴·연구 기지는 지도에 함대로 안 그림
    const shipIds = nums(fll, block(fll, it.s, it.e, 2, 'ships')), ships = shipIds.length;
    if (cls === 'shipclass_military') for (const sh of shipIds) shipOfFleet.set(sh, fleets.length); // 가장 큰 배 찾기(아래 배 구역)
    let fid: number | undefined; const fv = block(fll, it.s, it.e, 2, 'variables');
    if (fv) for (let i = fv[0]; i < fv[1]; i++) { const m = /^\t\t\tsllm_fo_fid=(\d+)/.exec(fll[i]); if (m) { fid = Number(m[1]); break; } }
    fleets.push({ ...(fid ? { fid } : {}), id: it.id, owner, sys, to, name: nameKey(fll, it.s, it.e, 2), power: Math.round(Number(val(fll, it.s, it.e, 2, 'military_power') ?? 0) || 0), ships, cls: cls.replace(/^shipclass_/, ''), moving });
  }

  // 우주기지 → 정거장 배 → 함대 → 주인
  const sbl = sectionLines(gs, 'starbase_mgr'), stationOf = new Map<number, number>(), sbLevel = new Map<number, number>();
  { const r = block(sbl, 1, sbl.length, 1, 'starbases'); if (r) { for (let i = r[0]; i < r[1]; i++) { const m = /^\t\t(\d+)=\r?$/.exec(sbl[i]); if (!m) continue; let j = i + 1; while (j < r[1] && !/^\t\t\}\r?$/.test(sbl[j])) { const s = /^\t\t\tstation=(\d+)/.exec(sbl[j]); if (s) stationOf.set(Number(m[1]), Number(s[1])); const lv = /^\t\t\tlevel="starbase_level_([a-z_0-9]+)"/.exec(sbl[j]); if (lv) { const k = lv[1]; const n = k === 'starport' ? 2 : k === 'starhold' ? 3 : k === 'starfortress' ? 4 : k === 'citadel' || k.startsWith('deep_space_citadel') ? 5 : 0; if (n) sbLevel.set(Number(m[1]), n); } j++; } i = j; } } }
  const need = new Set(stationOf.values()), shipFleet = new Map<number, number>();
  // 배 설계 → 크기(growth_stages 의 첫 ship_size)
  const designSize = new Map<number, string>();
  if (shipOfFleet.size) { const dl = sectionLines(gs, 'ship_design'); for (const it of entries(dl)) for (let i = it.s; i < it.e; i++) { const m = /^\t\t\t\tship_size="([^"]+)"/.exec(dl[i]); if (m) { designSize.set(it.id, m[1]); break; } } }
  const bigRank = new Map<number, number>(); // fleets 칸 → 지금까지 가장 큰 배 순위
  { const sl = sectionLines(gs, 'ships'); for (const it of entries(sl)) {
    if (need.has(it.id)) { const f = val(sl, it.s, Math.min(it.e, it.s + 12), 2, 'fleet'); if (f) shipFleet.set(it.id, Number(f)); }
    const dc = docShip.get(it.id); if (dc) { const f = Number(val(sl, it.s, Math.min(it.e, it.s + 12), 2, 'fleet') ?? -1), fl = fleets.find((x) => x.id === f); if (fl) fl.doc = dc; } // 지휘관이 탄 배 → 그 함대
    const fi = shipOfFleet.get(it.id); if (fi === undefined) continue;
    for (let i = it.s; i < it.e; i++) { const m = /^\t\t\tdesign=(\d+)/.exec(sl[i]); if (!m) continue; const [fr, rk] = sizeIcon(designSize.get(Number(m[1])) ?? ''); if (fr && rk > (bigRank.get(fi) ?? 0)) { bigRank.set(fi, rk); fleets[fi].big = fr; } break; }
  } }
  const sbOwner = (sb: number): number => { const st = stationOf.get(sb); if (st === undefined) return -1; const f = shipFleet.get(st); if (f === undefined) return -1; return fleetOwner.get(f) ?? -1; };

  // 성계
  const gl = sectionLines(gs, 'galactic_object'), systems: GSys[] = [], planetSys = new Map<number, number>();
  for (const it of entries(gl)) {
    const co = block(gl, it.s, it.e, 2, 'coordinate'); if (!co) continue;
    const x = Number(val(gl, co[0], co[1], 3, 'x') ?? NaN), y = Number(val(gl, co[0], co[1], 3, 'y') ?? NaN); if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const hl: number[] = []; const hb = block(gl, it.s, it.e, 2, 'hyperlane');
    if (hb) for (let i = hb[0]; i < hb[1]; i++) { const m = /^\t\t\t\tto=(\d+)/.exec(gl[i]); if (m) hl.push(Number(m[1])); }
    for (let i = it.s; i < it.e; i++) { const m = /^\t\tplanet=(\d+)/.exec(gl[i]); if (m) planetSys.set(Number(m[1]), it.id); }
    let owner = -1, sbl2 = 0; for (const sb of nums(gl, block(gl, it.s, it.e, 2, 'starbases'))) { const o = sbOwner(sb); if (o >= 0) { owner = o; sbl2 = sbLevel.get(sb) ?? 0; break; } }
    const col = nums(gl, block(gl, it.s, it.e, 2, 'colonies')).length;
    systems.push({ id: it.id, x, y, name: nameKey(gl, it.s, it.e, 2), owner, hl, col, known: knownAll || known.has(it.id), named: false, ...(sbl2 ? { sb: sbl2 } : {}) });
  }
  const byId = new Map(systems.map((q) => [q.id, q] as [number, GSys])), byIdOf = (id: number) => byId.get(id);
  // 성계 번호(2단계 명령용): 별(행성)의 variables.sllm_sys → 그 행성 coordinate.origin(성계). 번호가 붙은 별만 이 둘을 가진다.
  { const pl = sectionLines(gs, 'planets'); let head = '', origin = -1, sn = 0;
    for (const ln of pl) {
      if (ln.length < 3 || ln.charCodeAt(0) !== 9 || ln.charCodeAt(1) !== 9) continue;
      if (ln.charCodeAt(2) !== 9) { if (/^\t\t\}/.test(ln)) { if (sn > 0 && origin >= 0) { const q = byIdOf(origin); if (q && q.sn === undefined) q.sn = sn; } origin = -1; sn = 0; } continue; }
      if (ln.charCodeAt(3) !== 9) { const t = ln.replace(/\r$/, ''); if (t.endsWith('=')) head = t; continue; } // 「\t\t\t{」 줄은 머리가 아님
      if (ln.charCodeAt(4) === 9) continue;
      if (head === '\t\t\tcoordinate=' && ln.startsWith('\t\t\t\torigin=')) origin = Number(ln.slice(11)) || -1;
      else if (head === '\t\t\tvariables=' && ln.startsWith('\t\t\t\tsllm_sys=')) sn = Math.round(Number(ln.slice(13))) || 0;
    } }
  // 수도 성계: 제국 capital(행성 번호)의 성계가 그 제국 땅일 때만, 아니면 starting_system(고향 성계)
  for (const it of entries(cl)) {
    const cap = val(cl, it.s, it.e, 2, 'capital'), st = val(cl, it.s, it.e, 2, 'starting_system');
    let sid = cap !== null ? planetSys.get(Number(cap)) : undefined; if (sid !== undefined && byId.get(sid)?.owner !== it.id) sid = undefined;
    if (sid === undefined && st !== null && byId.get(Number(st))?.owner === it.id) sid = Number(st);
    const q = sid === undefined ? undefined : byId.get(sid); if (q && q.cap === undefined) q.cap = it.id;
  }

  // 안개 전 원본(시나리오 은하 지도는 정치 지도라 안개 없이 그린다, 2026-11-06). 작전지휘실 화면(viewOf)은 그대로 안개 낀 값만 쓴다.
  for (const s of systems) { s.rn = s.name; s.rhl = s.hl; }
  // 안개: 아는 성계와 그 이웃만 이름, 항로는 아는 성계에서만(양쪽 중 하나라도 알면 그 항로는 보인다).
  for (const s of systems) if (s.known) { s.named = true; for (const t of s.hl) { const q = byId.get(t); if (q) q.named = true; } }
  for (const s of systems) if (s.owner === player) s.named = true;
  for (const f of fleets) if (f.owner === player) { const q = byId.get(f.sys); if (q) q.named = true; }
  for (const s of systems) { if (!s.known) s.hl = []; if (!s.named) { s.name = ''; s.col = 0; } }
  // sensor_range_fleets 는 생각보다 넓어(시작 직후에도 수백 개) 아는 성계 안에 있는 것만 — 게임 지도에서 보이는 정도
  const fleetsOut = fleets.filter((f) => f.owner === player || (f.cls === 'military' && (knownAll || (sensed.has(f.id) && !!byId.get(f.sys)?.known))));
  return { date, player, systems, countries, fleets: fleetsOut };
}

/** 지역화 키 → 글자. 없으면 키를 사람이 읽을 만하게(NAME_Sol → Sol, HUMAN2_FLEET_StrikeForceBasilisk → Strike Force Basilisk). */
export function prettyName(key: string, loc: Record<string, string>): string {
  if (!key) return '';
  if (key.startsWith('SEQ|')) { // 번호 함대: fmt 지역화($ORD$·$NUM$ 등)가 있으면 그것, 없으면 「Fleet 3」
    const [, fmt, num] = key.split('|'); const n = Number(num) || 0, t = fmt ? loc[fmt] : '';
    const ord = n % 100 >= 11 && n % 100 <= 13 ? n + 'th' : n + (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
    if (t) return t.replace(/\$ORD\$/g, ord).replace(/\$NUM\$|\$num\$|\$C\$/g, String(n)).replace(/§./g, '').replace(/\$[^$]*\$/g, String(n)).trim();
    return '#' + n;
  }
  const v = loc[key]; if (v) return v.replace(/§./g, '').replace(/\$[^$]*\$/g, '').trim() || key;
  if (/^NAME_/.test(key)) return key.slice(5).replace(/_/g, ' ');
  const m = /_(?:FLEET|SHIP)_(.+)$/.exec(key); if (m) return m[1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  if (/^[A-Z0-9_]+$/.test(key) || /^%.*%$/.test(key)) return '';
  return key.replace(/_/g, ' ');
}
