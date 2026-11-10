// 시나리오 은하 지도(앱 쪽, 2026-11-06 사용자: 「본 앱에는 있지만 시나리오 팩 전용 기능 — 섹터 구역마다 총독 초상화, 어느 구역 누구 총독」).
// 규칙: src/scenario-map.ts · 화면: ui/scenario-map.html · 여는 곳: 집무실 대사관 보고의 「대립 긴장도」 칸(ui/office-tension.js) — 시나리오 세이브에서만.
// 로그 자리 SCNMAP(188): SCNSECBEG·SCNSEC·SCNSECEND(시나리오 모드 sllm_cr_sector_report — 2026-11-08부터 열두 달에 한 번·불러올 때) + SCNTICK(나머지 달, 날짜만). 줄마다 sid = SLLM 세이브 번호(0 이면 무시).
// 지도: 작전지휘실과 같은 세이브 읽기(galaxyRaw — 안개 없는 정치 지도). 섹터 보고는 세이브별로 sllm_scenario_sectors.json 에 둔다(앱을 다시 켜도 지도가 바로 나오게).
// 총독 초상화: 거점 귀족(파라곤형, 2026-11-06)이면 시나리오 전용 그림(ui/assets/scenario/corridor/gov/gov_<A|B>-<귀족 번호>.png — 게임 안 초상화와 같은 그림).
// 그 밖의 총독은 그 나라 통치자 종족 초상화 + 총독 성별로 포트레이트 라이브러리에서 고른 그림(총독 옷). 같은 총독이면 늘 같은 얼굴.
// 2026-11-07 사용자: 「정해진 성계만 하니 세이브를 기다릴 이유가 없다」 · 「귀족은 게임에 없으니 앱에만 — 반란 때 그 나라 수장으로 등장」
//   → 처음 배치(src/scenario-corridor-map-data.ts)로 바로 그린다. 세이브·섹터 보고가 있으면 바뀐 것만 덮는다.
//   → 섹터와 귀족은 게임 총독이 아니라 거점으로 잇는다(섹터 수도 = 귀족 거점이면 그 귀족). 귀족 총독 되돌려 앉히기(sllm_cr_noble_keep)는 껐다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { coverScreen } from '../app/cover-screen';
import { prettyName } from '../galaxy';
import { galaxyRaw } from './galaxy-app';
import { scenarioNow } from './scenario-app';
import { libraryPortraitUrl, autoPortraitUrl } from './portrait-lib-app';
import { SCN_TITLE, SIDE_ROLE, type Side } from '../scenario';
import { pathToFileURL } from 'url';
import { SectorCollector, fixBook, buildSectorMap, mapIdOf, type ScnSectorBook, type RawSys } from '../scenario-map';
import { CR_MAP_SYS, CR_MAP_LANES, CR_MAP_SEATS } from '../scenario-corridor-map-data';
import { CR_NOBLES } from '../scenario-nobles-data';
import { nobleOnSectorBook, registerScenarioNobles } from './scenario-nobles-app';
import { registerScenarioLocks } from './scenario-locks-app';
import { registerScenarioGames } from './scenario-games-app';
import { registerScenarioTrade, tradeOnLine } from './scenario-trade-app';
import { registerScenarioAudience } from './scenario-audience-app';
import { registerScenarioIntel, intelOnSectorBook, intelOnFleetLine } from './scenario-intel-app';
import { registerScenarioDomains, domainOnSectorBook, domainMapInfo, domainSyncOwners } from './scenario-domains-app';
import { registerScenarioCnobles, cnMapGroups, cnPuppets, cnRealmWords } from './scenario-cnobles-app';
import { CR_HUBS, CR_HUB_BY_ID } from '../scenario-corridor-sectors';
import { OwnCollector, fixOwnBook, newOwnBook, dateNum, ownColor, type OwnBook } from '../scenario-owners';
import { link, enqueue, sendConsole } from '../app/game-link';
import type { GalaxyMap, GSys, GCountry } from '../galaxy';

const KEEP = 12;
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_sectors.json');
let all: Record<string, ScnSectorBook> | null = null;
const books = (): Record<string, ScnSectorBook> => {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) { const b = fixBook(v); if (b && cleanSaveId(k)) all[k] = b; } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_sectors', error: (e as Error).message }); }
  return all;
};
let dirty: ReturnType<typeof setTimeout> | null = null;
const save = () => {
  if (dirty) return;
  dirty = setTimeout(() => {
    dirty = null;
    try {
      const b = books(), keys = Object.keys(b); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete b[k];
      const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: b })); fs.renameSync(t, file());
    } catch (e) { logDiagnostic('warn', 'scenario_map.save_failed', { error: (e as Error).message }); }
  }, 1000);
};

// ---- 성계 주인 장부(2026-11-08 사용자: 「세이브를 읽는 데 자원이 계속 든다」 → 로그로) ----
// 모드가 매달 「주인이 바뀐 성계」만 찍고, 불러온 직후 한 번 전체를 찍는다(src/scenario-owners.ts). 장부가 다 갖춰지면 지도는 세이브를 읽지 않는다.
const ownFile = () => path.join(app.getPath('userData'), 'sllm_scenario_owners.json');
let ownAll: Record<string, OwnBook> | null = null;
const ownBooks = (): Record<string, OwnBook> => {
  if (ownAll) return ownAll; ownAll = {};
  try { const j = JSON.parse(fs.readFileSync(ownFile(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) { const b = fixOwnBook(v); if (b && cleanSaveId(k)) ownAll[k] = b; } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_owners', error: (e as Error).message }); }
  return ownAll;
};
let ownDirty: ReturnType<typeof setTimeout> | null = null;
const ownSave = () => {
  if (ownDirty) return;
  ownDirty = setTimeout(() => {
    ownDirty = null;
    try { const b = ownBooks(), keys = Object.keys(b); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete b[k];
      const t = ownFile() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: b })); fs.renameSync(t, ownFile()); }
    catch (e) { logDiagnostic('warn', 'scenario_map.own_save_failed', { error: (e as Error).message }); }
  }, 1500);
};
const ownCol = new OwnCollector();
/** 장부가 아직 없을 때만(모드 갱신 전 세이브·앱을 늦게 켬) 그 세이브의 전체 주인 보고를 한 번 청한다. 불러올 때의 보고는 모드가 스스로 한다(sllm_cr.23). */
const ownAsked = new Set<string>();
function ownHello(): void {
  const sid = ctx.curSaveId; if (!sid || ownAsked.has(sid) || ownBooks()[sid]?.full || !ctx.gameRunning || !link.sessionReady) return; // 불러올 때는 모드가 스스로 보고한다(sllm_cr.23) — 장부가 없을 때만 묻는다
  const s = scenarioNow(); if (!s || s.id !== 'corridor') return;
  ownAsked.add(sid);
  void enqueue(() => sendConsole('effect sllm_cr_own_hello = yes')).catch((e) => { ownAsked.delete(sid); logDiagnostic('warn', 'scenario_map.own_hello_failed', { error: (e as Error).message }); });
}

const nobleCache = new Map<string, string | null>();
/** 수도 섹터 그림 = 그 나라 군주 초상(2026-11-07 사용자: 「수도부터 총독이 안 읽힘」 — 수도 섹터는 군주가 직접 다스린다). */
function rulerPic(side: string): string | undefined {
  if (side !== 'a' && side !== 'b') return undefined;
  const k = `ruler-${side}`; let u = nobleCache.get(k);
  if (u === undefined) { const f = path.join(__dirname, '..', '..', 'ui', 'assets', 'scenario', 'corridor', 'ruler', `ruler_${side}.png`); u = fs.existsSync(f) ? pathToFileURL(f).href : null; nobleCache.set(k, u); }
  return u ?? undefined;
}
/** 거점 귀족 그림(앱에 같이 들어 있는 것). 없으면 undefined. */
function noblePic(side: string, id: number): string | undefined {
  const k = `${side}-${id}`; let u = nobleCache.get(k);
  if (u === undefined) {
    const f = path.join(__dirname, '..', '..', 'ui', 'assets', 'scenario', 'corridor', 'gov', `gov_${side.toUpperCase()}-${id}.png`);
    u = fs.existsSync(f) ? pathToFileURL(f).href : null; nobleCache.set(k, u);
  }
  return u ?? undefined;
}

const col = new SectorCollector();
function onLine(m: SllmMessage): void {
  if (m.kind === 'SCNTRADE' || m.kind === 'SCNTRSET') { tradeOnLine(m); return; } // 회랑 무역로 줄도 이 자리에서(2026-11-06)
  if (m.kind === 'SCNOC' || m.kind === 'SCNOWN' || m.kind === 'SCNOWNBEG' || m.kind === 'SCNOWNEND') {
    const sid = cleanSaveId(String(m.kv.sid ?? '').replace(/^\\+/, '').replace(/,/g, '').replace(/\.0+$/, '')); if (!sid || sid === '0') return;
    const all = ownBooks(); const b = all[sid] ?? (all[sid] = newOwnBook());
    if (ownCol.feed(m.kind, sid, m.kv as Record<string, string>, b)) { ownSave(); if (m.kind === 'SCNOWNEND') logDiagnostic('info', 'scenario_map.own_full', { sid, systems: Object.keys(b.sys).length, countries: Object.keys(b.cc).length }); }
    return;
  }
  if (m.kind === 'SCNFLTBEG' || m.kind === 'SCNFLT' || m.kind === 'SCNFLTEND') { intelOnFleetLine(m.kind, m.kv as Record<string, string>); return; } // 회랑 정보국 함대 동향(2026-11-08)
  if (m.kind === 'SCNTICK') { // 섹터 전체 보고가 없는 달(2026-11-08 — 모드는 열두 달에 한 번만 전체를 보낸다): 마지막 섹터 표에 날짜만 바꿔 달 계산을 돌린다
    const sid = cleanSaveId(String(m.kv.sid ?? '').replace(/^\\+/, '').replace(/,/g, '').replace(/\.0+$/, ''));
    const date = String(m.kv.date ?? '').replace(/^\\+/, '').trim();
    if (String(m.kv.sc ?? '').replace(/^\\+/, '').trim() !== 'corridor' || !sid || sid === '0' || !date) return;
    const last = books()[sid]; if (!last) return; // 전체 보고가 아직 없으면 기다린다(시작·불러오기·앱 문의 때 온다)
    monthBook(sid, { ...last, date });
    return;
  }
  if (m.kind !== 'SCNSECBEG' && m.kind !== 'SCNSEC' && m.kind !== 'SCNSECEND') return;
  const sid = cleanSaveId(String(m.kv.sid ?? '').replace(/^\\+/, '').replace(/,/g, '').replace(/\.0+$/, ''));
  if (!sid || sid === '0') return;
  const r = col.feed(m.kind, sid, m.kv as Record<string, string>); if (!r) return;
  monthBook(r.sid, r.book);
}
/** 한 달치 섹터 표(전체 보고 또는 SCNTICK)로 달 계산을 돌린다. */
function monthBook(sid: string, book: ScnSectorBook): void {
  const b = books(); delete b[sid]; b[sid] = book; save(); // 지우고 넣어 최근 것이 뒤로(오래된 세이브부터 버림)
  nobleOnSectorBook(sid, book); // 귀족 충성도 분기 계산(2026-11-06)
  domainOnSectorBook(sid, book); // 귀족 영역다툼 연례 판단(2026-11-07) — 정보국 연례 회의보다 먼저(연말 보고서에 같이 실리게)
  intelOnSectorBook(sid, book); // 회랑 정보국 한 달 계산(2026-11-07)
  ownerPeek(sid, book.date);
}
/** 회랑 자리 판: 석 달에 한 번 세이브의 땅 주인을 스스로 읽는다(지도 창을 안 열어도 정복지 처분·귀족 사망이 맞게, 2026-11-08 회랑의 귀족).
 *  세이브 읽기는 작전지휘실과 같은 작업 스레드(galaxy-worker)가 하고, 세이브 파일이 그대로면 캐시를 쓴다. */
const peekAt = new Map<string, string>();
function ownerPeek(sid: string, date: string): void {
  const s = scenarioNow(); if (!s || s.id !== 'corridor' || s.seat !== 'p' || ctx.curSaveId !== sid) return;
  const m = /^(\d{3,5})\.(\d{1,2})/.exec(date || ''); if (!m) return;
  const q = `${m[1]}.${Math.floor((Number(m[2]) - 1) / 3)}`; if (peekAt.get(sid) === q) return; peekAt.set(sid, q);
  void view(false).catch((e) => logDiagnostic('warn', 'scenario_map.peek_failed', { error: String(e) }));
}

// ---- 처음 배치(2026-11-07) ----
const NOBLE_BY_ID = new Map(CR_NOBLES.map((n) => [n.id, n] as [number, (typeof CR_NOBLES)[number]]));
/** 섹터 보고가 아직 없을 때 쓰는 처음 섹터 표: 두 강국 수도 섹터 + 귀족 거점 섹터(거점 = 귀족 번호). 수도 섹터에 든 거점(isCore)은 뺀다. */
// 수도 섹터 안 거점 귀족 넷(342·396·561·263)도 2026-11-08부터 제 영지·섹터를 가진다(사용자: 「비어 있는 성계들이 있다니까?」 — 지도에 카드 없는 빈 덩어리로 보였음).
function staticBook(date: string, skip?: Set<number>, rebels?: Set<number>): ScnSectorBook {
  const list: ScnSectorBook['list'] = [
    { side: 'a', cap: CR_MAP_SEATS.a, core: true, noble: false, nid: -1, female: false, age: 0, gov: '', name: '' },
    { side: 'b', cap: CR_MAP_SEATS.b, core: true, noble: false, nid: -1, female: false, age: 0, gov: '', name: '' },
  ];
  for (const n of CR_NOBLES) if (!skip?.has(n.id)) list.push({ side: n.side, cap: n.id, core: false, noble: true, nid: n.id, female: n.g === 'f', age: 0, gov: '', name: '', ...(rebels?.has(n.id) ? { rebel: true } : {}) }); // 몰락·사라진 귀족은 빼고, 반란 주모자는 반란국 섹터로(2026-11-08)
  return { date, list };
}
/** 처음 배치의 성계(세이브 없이). 나라 번호는 1 얼라이언스 · 2 제국 · 3 회랑. */
function staticRaw(): RawSys[] {
  const adj = new Map<number, number[]>(); for (const [a, b] of CR_MAP_LANES) { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); }
  const capOf: Record<number, number> = { [CR_MAP_SEATS.a]: 1, [CR_MAP_SEATS.b]: 2, [CR_MAP_SEATS.p]: 3 };
  return CR_MAP_SYS.map(([id, x, y, z]) => ({ id, x, y, key: `SLLM_CR_SYS_${id}`, owner: z ? z : -1, hl: adj.get(id) ?? [], ...(capOf[id] !== undefined ? { cap: capOf[id] } : {}) }));
}
const staticName = (id: number): string => { const r = CR_MAP_SYS.find((q) => q[0] === id); return r ? L(r[4], r[5]) : ''; };

/** 화면에 줄 지도. 시나리오 세이브가 아니면 on: false. */
async function view(force: boolean): Promise<Record<string, unknown>> {
  const s = scenarioNow(); if (!s) return { ok: true, on: false };
  const sid = ctx.curSaveId || '', book = books()[sid] ?? null;
  const own = ownBooks()[sid];
  // 땅 주인 장부가 다 갖춰졌으면 세이브를 읽지 않는다(2026-11-08). 아니면 세이브를 읽고, 장부에 더 새 줄이 있으면 그것으로 덮는다.
  const g = own?.full ? liveGalaxy(s, own) : await galaxyRaw(force).catch(() => ({ ok: false as const, error: '' }));
  if (!g.ok) return staticView(s, sid, book);   // 세이브를 아직 못 읽었으면 처음 배치로(2026-11-07)
  const { loc, colors } = g; let map = g.map;
  // 자리 → 세이브 나라: SLLM 제국 번호(시나리오 줄) → 미리 만든 제국 이름 키 → 플레이어 자리
  const sideOwner: Partial<Record<Side, number>> = {};
  for (const sd of ['a', 'b', 'p'] as Side[]) {
    const idx = s.idx[sd]; let c = idx ? map.countries.find((x) => x.idx === idx) : undefined;
    if (!c && sd !== 'p') c = map.countries.find((x) => x.name === (sd === 'a' ? 'SLLM_CR_A_NAME' : 'SLLM_CR_B_NAME'));
    if (!c && sd === s.seat) c = map.countries.find((x) => x.me);
    if (c) sideOwner[sd] = c.id;
  }
  if (own?.full) for (const [k, c] of Object.entries(own.cc)) { const sd = (['', 'a', 'b', 'p'] as const)[c.sd]; if (sd && map.countries.some((x) => x.id === Number(k))) sideOwner[sd] = Number(k); }
  else if (own) map = overlayOwners(map, own, sideOwner, colors, loc);
  const raw: RawSys[] = map.systems.map((q) => ({ id: q.id, x: q.x, y: q.y, key: q.rn ?? q.name, owner: q.owner, hl: q.rhl ?? q.hl, ...(q.cap !== undefined ? { cap: q.cap } : {}) }));
  // 섹터 표는 늘 처음 배치(귀족 거점 59 + 수도 둘)로 — 게임은 「섹터 수도끼리 5칸」 규칙 때문에 거점 섹터를 다 만들지 못한다(2026-11-07 error.log). 땅 주인만 세이브를 따른다.
  domainSyncOwners(sid, raw.map((q) => ({ m: mapIdOf(q.key), o: q.owner })), sideOwner); // 게임에서 잃은 성계는 영지 계산에서 뺀다(2026-11-07)
  const dm = domainMapInfo(sid); // 귀족 영역다툼으로 바뀐 영지(2026-11-07)
  // 회랑 땅과 정복지(2026-11-08 사용자: 「점령하고 나서 우리 귀족의 영역도, 내 땅인 것도 안 뜬다」): 회랑 수도 섹터 + 정복지 무리마다 섹터(앉힌 귀족이 있으면 그 귀족)
  const bk = staticBook(book?.date || map.date || ctx.gameDate || '', dm?.skip, dm?.rebels), asg = new Map<number, number>(dm?.assign ?? []);
  const cnCap = new Map<number, ReturnType<typeof cnMapGroups>[number]>(), pOwn = sideOwner.p;
  const hubCap = new Set<number>();
  const pupCap = new Map<number, ReturnType<typeof cnPuppets>[number]>(), pupOwn = new Map<number, ReturnType<typeof cnPuppets>[number]>();
  const extra: ScnSectorBook['list'] = [];
  if (pOwn !== undefined) {
    extra.push({ side: 'p', cap: CR_MAP_SEATS.p, core: true, noble: false, nid: -1, female: false, age: 0, gov: '', name: '' });
    const ownM = new Set(raw.filter((q) => q.owner === pOwn).map((q) => mapIdOf(q.key)).filter((m) => m >= 0));
    if (s.seat === 'p') for (const g of cnMapGroups(sid)) {
      const mine = g.sys.filter((m) => ownM.has(m)); if (!mine.length) continue;
      const cap = mine.includes(g.key) ? g.key : mine[0]; cnCap.set(cap, g);
      extra.push({ side: 'p', cap, core: false, noble: g.st === 'noble' && g.lord !== undefined, nid: -3, female: false, age: 0, gov: g.lord ?? '', name: '' });
      for (const m of mine) asg.set(m, cap);
    }
    // 회랑 섹터(2026-11-08 사용자: 「섹터별 핵심 성계만 인식 — 미리 정해 놓은 행성을 차지했을 때만」): 빈 거점 14곳 중 회랑이 거점 행성을 가진 곳만 따로 섹터로.
    // 그 섹터에 드는 회랑 성계만 붙는다(나머지 회랑 땅은 지금처럼 수도 섹터). 거점 행성 주인은 땅 주인 로그의 w(장부가 없으면 아무 섹터도 안 생긴다).
    { const pc = own ? Number(Object.entries(own.cc).find(([, c]) => c.sd === 3)?.[0] ?? -1) : -1;
      if (own && pc > 0 && s.seat === 'p') for (const hb of CR_HUBS) {
        if ((own.sys[String(hb.id)]?.[2] ?? -1) !== pc) continue;
        const mine = hb.sys.filter((m) => ownM.has(m) && !asg.has(m)); if (!mine.length) continue;
        const cap = mine.includes(hb.id) ? hb.id : mine[0]; hubCap.add(cap);
        extra.push({ side: 'p', cap, core: false, noble: false, nid: -5, female: false, age: 0, gov: '', name: '' });
        for (const m of mine) asg.set(m, cap);
      }
      if (hubCap.size) for (const m of ownM) if (!asg.has(m)) asg.set(m, CR_MAP_SEATS.p); } // 나머지 회랑 땅은 수도 섹터로 못 박는다(회랑 섹터가 이웃 성계까지 번지지 않게)
    // 회랑의 괴뢰국(2026-11-08 사용자: 「속국이 1년이 지나도 빈 영지로 나온다」): 떼어 준 성계를 지금 쥔 나라(회랑도 강대국도 아닌)를 그 속국으로 본다
    if (s.seat === 'p') { const sideIds = new Set(Object.values(sideOwner).filter((v): v is number => v !== undefined));
      for (const p of cnPuppets(sid)) {
        const want = new Set(p.sys), cnt = new Map<number, number>();
        for (const q of raw) { const m = mapIdOf(q.key); if (m >= 0 && want.has(m) && q.owner >= 0 && !sideIds.has(q.owner)) cnt.set(q.owner, (cnt.get(q.owner) ?? 0) + 1); }
        let own = -1, best = 0; for (const [o, n] of cnt) if (n > best) { best = n; own = o; }
        if (own < 0 || pupOwn.has(own)) continue;
        const held = raw.filter((q) => q.owner === own).map((q) => mapIdOf(q.key)).filter((m) => m >= 0);
        const cap = held.includes(p.key) ? p.key : (held.find((m) => want.has(m)) ?? held[0]); if (cap === undefined) continue;
        pupCap.set(cap, p); pupOwn.set(own, p);
        extra.push({ side: 'p', cap, core: false, noble: p.prev, nid: -4, female: false, age: 0, gov: '', name: '', own });
        for (const m of held) asg.set(m, cap);
      }
    }
  }
  bk.list.splice(2, 0, ...extra); // 귀족 거점보다 앞에 — 빼앗은 거점은 정복지 섹터가 차지한다
  const sm = buildSectorMap(raw, sideOwner, bk, asg);
  const countries: Record<string, { name: string; color: string; side: Side | ''; me: boolean }> = {};
  const sideOf = new Map<number, Side>(); for (const [sd, id] of Object.entries(sideOwner)) if (id !== undefined) sideOf.set(id, sd as Side);
  for (const c of map.countries) {
    if (!c.me && /sector|livespace|faction|global_event|dummy|_type$/.test(c.type)) continue;
    const sd = sideOf.get(c.id) ?? '';
    const pp = pupOwn.get(c.id); // 회랑의 괴뢰국은 옛 땅 이름으로
    const nm = (pp ? L(`${pp.name[0]} 괴뢰국`, `Puppet state of the ${pp.name[1]}`) : '') || (sd && s.names[sd]) || (c.me ? ctx.playerName : '') || prettyName(c.name, loc) || L('알 수 없는 세력', 'Unknown power');
    countries[String(c.id)] = { name: nm, color: colors[c.color] || '#8a9aa6', side: sd, me: c.me };
  }
  const idxOf = (sd: Side): number => { const id = sideOwner[sd]; const c = id === undefined ? undefined : map.countries.find((x) => x.id === id); return s.idx[sd] ?? c?.idx ?? -1; };
  const sectors = sm.sectors.map((x) => {
    let pic: string | undefined;
    const nb = nobleOfSector(x);
    if (nb >= 0) pic = noblePic(x.side, nb);
    if (!pic && x.core) pic = rulerPic(x.side);
    if (!pic && x.gov) { try { const idx = idxOf(x.side), r = idx >= 0 ? ctx.flagProv.rulerFor(idx) : null; pic = libraryPortraitUrl(r?.portrait || 'human', x.female ? 'f' : 'm', `${sid}|gov|${x.side}|${x.gov}`, 'governor'); } catch { pic = undefined; } }
    const sys = map.systems.find((q) => q.id === x.sys);
    const nob = nb >= 0 ? NOBLE_BY_ID.get(nb) : undefined; // 귀족은 앱에만 있다 — 섹터에는 그 거점 귀족 이름을 보인다
    const rb = !!x.rebel && !!nob; // 반란국(2026-11-08): 이름 「○○ 반란국」, 총독 줄엔 그 귀족
    if (x.side === 'p') { // 회랑 땅(2026-11-08)
      if (x.core) { const idx = idxOf('p'); let rp: string | undefined; try { rp = idx >= 0 ? autoPortraitUrl(idx) : undefined; } catch { rp = undefined; }
        return { i: x.i, side: 'p', owner: x.owner, sys: x.sys, nid: -1, name: s.names.p || ctx.playerName || L('회랑', 'Corridor'), gov: L('군주 직할', 'Ruled by the sovereign'), noble: false, age: 0, female: false, core: true, size: x.size, ...(rp ? { pic: rp } : {}) }; }
      const hb = x.nid === -5 && hubCap.has(x.cap) ? CR_HUB_BY_ID.get(x.cap) : undefined;
      if (hb) return { i: x.i, side: 'p', owner: x.owner, sys: x.sys, nid: -5, cn: true, hub: true, cst: 'hub', name: L(`${hb.ko} 섹터`, `${hb.en} Sector`), gov: `${cnRealmWords(sid).rule} · ${L(`${hb.pk} 행성`, `${hb.pe} world`)}`, role: hb.role === 't' ? L('통과 섹터', 'TRANSIT SECTOR') : L('변경 섹터', 'FRONTIER SECTOR'), noble: false, age: 0, female: false, core: false, size: x.size };
      const pu = x.nid === -4 ? pupCap.get(x.cap) : undefined;
      if (pu) { const pn = pu.prev ? NOBLE_BY_ID.get(pu.key) : undefined; let pp: string | undefined = pn ? noblePic(pn.side, pn.id) : undefined;
        if (!pp) { const c = map.countries.find((q) => q.id === x.owner); try { pp = c && c.idx != null ? autoPortraitUrl(c.idx) : undefined; } catch { pp = undefined; } }
        return { i: x.i, side: 'p', owner: x.owner, sys: x.sys, nid: -4, cn: true, pup: true, cst: 'puppet', name: L(`${pu.name[0]} 괴뢰국`, `Puppet state of the ${pu.name[1]}`), gov: pn ? L(`괴뢰 군주 ${pn.ko}`, `Puppet ruler ${pn.en}`) : cnRealmWords(sid).subject, noble: !!pn, age: 0, female: pn ? pn.g === 'f' : false, core: false, size: x.size, ...(pp ? { pic: pp } : {}) }; }
      const g = cnCap.get(x.cap);
      if (g) { let cp: string | undefined; if (g.lid !== undefined) { try { const idx = idxOf('p'), r = idx >= 0 ? ctx.flagProv.rulerFor(idx) : null; cp = libraryPortraitUrl(r?.portrait || 'human', '', `${sid}|cn|${g.lid}`, 'governor'); } catch { cp = undefined; } }
        return { i: x.i, side: 'p', owner: x.owner, sys: x.sys, nid: -3, cn: true, cst: g.st, ...(g.lid !== undefined ? { lid: g.lid } : {}), name: L(g.name[0], g.name[1]), gov: g.lord ?? (g.st === 'pending' ? L('처분 대기', 'Awaiting decision') : L('직할령', 'Direct rule')), noble: g.lid !== undefined, age: 0, female: false, core: false, size: x.size, ...(cp ? { pic: cp } : {}) }; }
    }
    return { i: x.i, side: x.side, owner: x.owner, sys: x.sys, nid: x.nid, ...(nb >= 0 ? { nb } : {}), ...(rb ? { rebel: true } : {}), name: rb ? L(`${nob!.ko} 가의 반란국`, `Rebel realm of House ${nob!.en}`) : x.name || prettyName(sys?.rn ?? '', loc) || staticName(x.cap), gov: nob ? (rb ? L(`반란 군주 ${nob.ko}`, `Rebel lord ${nob.en}`) : L(nob.ko, nob.en)) : x.gov, noble: !!nob || x.noble, age: x.age, female: nob ? nob.g === 'f' : x.female, core: x.core, size: x.size, ...(pic ? { pic } : {}) };
  });
  const t = SCN_TITLE[s.id] || ['시나리오', 'Scenario'];
  return {
    ok: true, on: true, title: t, date: book?.date || map.date, seat: s.seat, seatRole: s.seat && s.seat !== 'x' ? SIDE_ROLE[s.seat] : null,
    systems: sm.systems.map((q) => ({ id: q.id, x: q.x, y: q.y, n: prettyName(q.key, loc), o: q.o, s: q.s, m: q.m })), // m: 지도 번호(첩보 지도의 함대 표시, 2026-11-08)
    lanes: sm.lanes, countries, sectors, missing: sm.missing, report: !!book, realm: cnRealmWords(sid), ...(dm ? { dom: domOut(dm, sm.systems) } : {}),
  };
}
/** 분쟁 성계(지도 번호)를 화면 성계 번호로. [성계, 주인 귀족, 미는 귀족, 넘어가기 직전 1/0] */
function domOut(dm: NonNullable<ReturnType<typeof domainMapInfo>>, systems: Array<{ id: number; m: number }>): Record<string, unknown> {
  const byM = new Map<number, number>(); for (const q of systems) if (q.m >= 0) byM.set(q.m, q.id);
  return { contested: dm.contested.map(([m, o, b, p, mom, share]) => [byM.get(m) ?? -1, o, b, p, mom, share, m]).filter((x) => x[0] >= 0), blocs: dm.blocs, fallen: [...dm.fallen] }; // [성계, 주인, 도전자, 장악 진척도%, 달마다 변화, 도전자 몫%, 지도 번호]
}
/** 섹터 → 귀족 번호: 섹터 수도가 그 나라 귀족의 거점이면 그 귀족(게임 총독과 상관없이). 수도 섹터·거점 아님은 -1. */
function nobleOfSector(x: { side: Side; core: boolean; cap: number; nid: number }): number {
  if (x.core || (x.side !== 'a' && x.side !== 'b')) return -1;
  if (x.nid >= 0 && NOBLE_BY_ID.get(x.nid)?.side === x.side) return x.nid;
  return NOBLE_BY_ID.get(x.cap)?.side === x.side ? x.cap : -1;
}
/** 장부만으로 만든 은하(세이브 없이): 성계 자리·항로는 처음 배치, 주인은 장부. 나라 번호 = 장부의 나라 번호. */
function liveGalaxy(s: NonNullable<ReturnType<typeof scenarioNow>>, own: OwnBook): { ok: true; map: GalaxyMap; loc: Record<string, string>; colors: Record<string, string> } {
  const loc: Record<string, string> = {}, colors: Record<string, string> = {};
  const adj = new Map<number, number[]>(); for (const [a, b] of CR_MAP_LANES) { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); }
  const seatSd: Record<string, number> = { a: 1, b: 2, p: 3 }, mySd = seatSd[s.seat ?? ''] ?? -1;
  const countries: GCountry[] = []; let player = -1;
  for (const [k, c] of Object.entries(own.cc)) {
    const id = Number(k), side = (['', 'a', 'b', 'p'] as const)[c.sd] || '', key = `SLLM_OWN_C_${id}`, ck = `own_${id}`;
    loc[key] = (side && s.names?.[side]) || c.name || L('알 수 없는 세력', 'Unknown power'); colors[ck] = ownColor(id, c.sd);
    const me = c.sd === mySd; if (me) player = id;
    countries.push({ id, idx: c.ix > 0 ? c.ix : side ? (s.idx[side] ?? null) : null, name: key, color: ck, type: 'default', me });
  }
  const capOf = new Map<number, number>(); for (const c of countries) { const sd = own.cc[String(c.id)]?.sd; const seat = sd === 1 ? CR_MAP_SEATS.a : sd === 2 ? CR_MAP_SEATS.b : sd === 3 ? CR_MAP_SEATS.p : -1; if (seat >= 0) capOf.set(seat, c.id); }
  const systems: GSys[] = CR_MAP_SYS.map(([id, x, y, , ko, en]) => {
    const key = `SLLM_CR_SYS_${id}`; loc[key] = L(ko, en);
    const o = own.sys[String(id)]?.[0] ?? 0, owner = o > 0 && own.cc[String(o)] ? o : -1, hl = adj.get(id) ?? [];
    return { id, x, y, name: key, rn: key, owner, hl, rhl: hl, col: 0, known: true, named: true, ...(capOf.get(id) === owner && owner > 0 ? { cap: owner } : {}) };
  });
  return { ok: true, map: { date: own.date, player, systems, countries, fleets: [] }, loc, colors };
}
/** 세이브 지도에 장부의 더 새 주인을 덮는다(장부가 아직 다 갖춰지지 않았을 때). 세이브에 없는 나라(새로 생긴 괴뢰국 등)는 장부 번호로 새로 넣는다. */
function overlayOwners(map: GalaxyMap, own: OwnBook, sideOwner: Partial<Record<Side, number>>, colors: Record<string, string>, loc: Record<string, string>): GalaxyMap {
  const sd = dateNum(map.date); const newer = Object.entries(own.sys).filter(([, [, d]]) => dateNum(d) > sd); if (!newer.length) return map;
  const countries = [...map.countries], idOf = new Map<number, number>();
  const resolve = (c: number): number => {
    if (c <= 0) return -1; const hit = idOf.get(c); if (hit !== undefined) return hit;
    const x = own.cc[String(c)]; let id: number | undefined;
    if (x) { const side = (['', 'a', 'b', 'p'] as const)[x.sd]; if (side) id = sideOwner[side]; if (id === undefined && x.ix > 0) id = countries.find((q) => q.idx === x.ix)?.id; }
    if (id === undefined) { id = 900000 + c; const key = `SLLM_OWN_C_${c}`, ck = `own_${c}`; loc[key] = x?.name || L('알 수 없는 세력', 'Unknown power'); colors[ck] = ownColor(c, x?.sd ?? 0); countries.push({ id, idx: x && x.ix > 0 ? x.ix : null, name: key, color: ck, type: 'default', me: false }); }
    idOf.set(c, id); return id;
  };
  const byM = new Map<number, number>(); newer.forEach(([m, [c]]) => byM.set(Number(m), c));
  const systems = map.systems.map((q) => { const m = mapIdOf(q.rn ?? q.name); if (m < 0 || !byM.has(m)) return q; return { ...q, owner: resolve(byM.get(m)!) }; });
  return { ...map, systems, countries };
}
/** 세이브 없이 처음 배치로 그린 지도(섹터 보고가 있으면 섹터 표만 그것으로). */
function staticView(s: NonNullable<ReturnType<typeof scenarioNow>>, sid: string, book: ScnSectorBook | null): Record<string, unknown> {
  const date = book?.date || ctx.gameDate || '';
  const sideOwner: Partial<Record<Side, number>> = { a: 1, b: 2, p: 3 };
  const dm = domainMapInfo(sid);
  const bk = staticBook(date, dm?.skip, dm?.rebels); bk.list.splice(2, 0, { side: 'p', cap: CR_MAP_SEATS.p, core: true, noble: false, nid: -1, female: false, age: 0, gov: '', name: '' }); // 회랑 땅도(2026-11-08)
  const sm = buildSectorMap(staticRaw(), sideOwner, bk, dm?.assign);
  const countries: Record<string, { name: string; color: string; side: Side | ''; me: boolean }> = {
    1: { name: s.names?.a || L('은하 얼라이언스', 'Galactic Alliance'), color: '#3f6fe0', side: 'a', me: s.seat === 'a' },
    2: { name: s.names?.b || L('인류 제국', 'Human Empire'), color: '#d83a3a', side: 'b', me: s.seat === 'b' },
    3: { name: s.names?.p || ctx.playerName || L('회랑', 'Corridor'), color: '#d9a640', side: 'p', me: s.seat === 'p' },
  };
  const sectors = sm.sectors.map((x) => {
    const nb = nobleOfSector(x), nob = nb >= 0 ? NOBLE_BY_ID.get(nb) : undefined, pic = nb >= 0 ? noblePic(x.side, nb) : x.core ? rulerPic(x.side) : undefined;
    const rb = !!x.rebel && !!nob;
    return { i: x.i, side: x.side, owner: x.owner, sys: x.sys, nid: x.nid, ...(nb >= 0 ? { nb } : {}), ...(rb ? { rebel: true } : {}), name: rb ? L(`${nob!.ko} 가의 반란국`, `Rebel realm of House ${nob!.en}`) : x.name || staticName(x.cap) || staticName(x.sys), gov: nob ? (rb ? L(`반란 군주 ${nob.ko}`, `Rebel lord ${nob.en}`) : L(nob.ko, nob.en)) : x.core ? L('군주 직할', 'Ruled by the sovereign') : '', noble: !!nob, age: 0, female: nob ? nob.g === 'f' : false, core: x.core, size: x.size, ...(pic ? { pic } : {}) };
  });
  const t = SCN_TITLE[s.id] || ['시나리오', 'Scenario'];
  return {
    ok: true, on: true, title: t, date, seat: s.seat, seatRole: s.seat && s.seat !== 'x' ? SIDE_ROLE[s.seat] : null,
    systems: sm.systems.map((q) => ({ id: q.id, x: q.x, y: q.y, n: staticName(q.id), o: q.o, s: q.s, m: q.m })),
    lanes: sm.lanes, countries, sectors, missing: sm.missing, report: !!book, static: true, realm: cnRealmWords(sid), ...(dm ? { dom: domOut(dm, sm.systems) } : {}),
  };
}

let win: BrowserWindow | null = null;
let winMode = ''; // '' 은하 지도 · 'intel' 첩보 지도(회랑 정보국, 2026-11-07)
function openMap(mode = ''): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('게임을 불러온 뒤에 열 수 있습니다.', 'Load a game first.') };
  if (!scenarioNow()) return { ok: false, error: L('시나리오 세이브에서만 열 수 있습니다.', 'Only available in a scenario save.') };
  if (win && !win.isDestroyed()) { if (winMode === mode) { win.show(); win.focus(); return { ok: true }; } win.close(); win = null; }
  const w = new BrowserWindow({ width: 1280, height: 800, frame: false, show: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: true, skipTaskbar: true, backgroundColor: '#03060a', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setMenuBarVisibility(false);
  winMode = mode; void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'scenario-map.html'), mode ? { query: { mode } } : undefined);
  w.once('ready-to-show', () => { coverScreen(w, true, ctx.gameDip); w.show(); w.focus(); });
  w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

export function registerScenarioMap(router: LogRouter): void {
  router.on(SLOT.SCNMAP, 'scenario-map', onLine);
  setInterval(() => { try { ownHello(); } catch { /* 다음에 */ } }, 10000); // 앱을 켰을 때 이미 불러온 판도(세이브마다 앱 실행 동안 한 번)
  registerScenarioNobles();
  registerScenarioLocks(router); // 시나리오 잠금(2026-11-06) · 잠긴 기능의 로그 줄은 그 기능에 보내지 않는다(2026-11-08)
  registerScenarioGames(); // 화합 대회 초청(2026-11-06)
  registerScenarioTrade(); // 회랑 무역로(2026-11-06)
  registerScenarioAudience(); // 접견실: 1:1 비밀회담·밀사·고발(2026-11-06)
  registerScenarioIntel(); // 회랑 정보국: 공작원·정보망·정찰 작전(2026-11-07)
  registerScenarioDomains(); // 귀족 영역다툼·귀족 외교(2026-11-07)
  registerScenarioCnobles(); // 회랑의 귀족: 정복지 처분·우리 귀족(2026-11-08)
  ipcMain.handle('scnMap', async (_e, force: unknown) => { try { return await view(force === true); } catch (e) { logDiagnostic('warn', 'scenario_map.view_failed', { error: e }); return { ok: false, on: true, error: L('은하 지도를 만들지 못했습니다.', 'Could not build the galaxy map.') }; } });
  ipcMain.handle('scnMapOpen', async () => openMap());
  ipcMain.handle('scnIntelOpen', async () => { if (!scenarioNow()) return { ok: false, error: L('시나리오 세이브에서만 열 수 있습니다.', 'Only available in a scenario save.') }; return openMap('intel'); }); // 첩보 지도(회랑 정보국)
  ipcMain.handle('scnMapClose', async () => { if (win && !win.isDestroyed()) win.close(); return { ok: true }; });
}
// 순수 함수 검사용
export const scnMapTest = { onLine, books: () => books(), reset: () => { all = {}; }, staticView, staticBook, ownBooks: () => ownBooks(), ownReset: () => { ownAll = {}; }, liveGalaxy };
