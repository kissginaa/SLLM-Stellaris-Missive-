// 작전지휘실 은하 지도(앱 쪽, 2026-11-05). 규칙: src/galaxy.ts, 읽기 스레드: src/galaxy-worker.ts, 화면: ui/fleet-galaxy.js.
// 1단계: 지금 게임의 최근 세이브(깃발 공급자가 고른 것과 같은 파일 — 세이브 번호가 맞을 때만)를 작업 스레드에서 읽어 지도 자료를 만든다.
// 이름: 게임·모드 지역화(성계·함대 이름 키만 골라 한 번 읽어 둠), 제국 이름은 연락처(단말기) 이름 우선. 색: flags/colors.txt 의 map 색.
// 주인 표시(안개): 항로를 아는 성계, 우리 땅, 연락한 제국 땅만. 나머지 성계는 주인 없이 별만.
// 세이브는 읽기만 한다. 같은 파일·같은 수정 시각이면 다시 읽지 않는다(열 때마다 압축을 풀지 않게).
// 2단계(2026-11-05 사용자 「일단 2단계 가자」): 함대 명령(우리 군 함대를 고르고 성계를 눌러 이동·수도 귀환·정지)과 장관·제독 작전 회의(LLM, 작전안을 지도에 표시하고 승인하면 명령).
//   게임 보고·명령: tester-mod/common/scripted_effects/sllm_warroom.txt, 규칙: src/warroom.ts, 로그 자리 WARROOM(198). 세이브 지도와 게임은 성계 번호(sllm_sys)로 맞춘다.
// 창: 작전지휘실(ui/warroom.html)은 게임이 있는 모니터를 작업 표시줄까지 덮는 전체화면(2026-11-05 사용자: 웅장하게). Esc·「나가기」로 닫는다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { selectedLanguage } from './settings-ui';
import { readZipEntry } from '../savereader';
import { usage } from '../usage-meter';
import { coverScreen } from '../app/cover-screen';
import { parseGalaxy, prettyName, type GalaxyMap } from '../galaxy';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf } from './people-app';
import { personaPeek, personaNote } from './persona-app';
import { cabMembersFrom } from '../cabinet-meeting';
import { classKey } from '../speciesClass';
import { autoOfficeStyle } from '../office-style';
import { playerGestalt } from './gestalt-app';
import { relName, opName, allyChance, allyFleets, parseAllyReply, type FoAlly } from '../fleetorder';
import { monthsBetween } from '../letters';
import { safeKey } from '../music';
import { type WrAuto, WrAutoCollector, autoRadio, allyRefuseText, XF, xfCreateCommand, xfEndCommand, xfMessages, xfFallback, parseXf, xfEvText, type WrAlly } from '../warroom';
import { type WrReport, type WrAct, allyLid, type WrBrief, type WrSpeaker, type WrLine, type WrPlan, type WrMark, WR, WrCollector, reportCommand, orderCommand, snMap, modeText, actText, councilMessages, parseCouncil, councilFallback, type WrOpinionCtx, opinionMessages, parseOpinion, opinionFallback, SB_EN, SHIP_EN, proposeMessages, PROPOSE_LV, doctrineOf, doctrineByKey, docCommand, DOC_FX } from '../warroom';

let cache: { file: string; mtime: number; map: GalaxyMap } | null = null;
let reading: Promise<GalaxyMap | null> | null = null;

function readInWorker(file: string): Promise<GalaxyMap | null> {
  const script = path.join(__dirname, '..', 'galaxy-worker.js');
  if (process.env.SLLM_SAVE_SYNC || !fs.existsSync(script)) { // 자체 검사·개발 실행
    const gs = readZipEntry(fs.readFileSync(file), 'gamestate'); return Promise.resolve(gs ? parseGalaxy(gs.toString('utf8')) : null);
  }
  return new Promise((resolve, reject) => {
    let done = false; const w = new Worker(script, { workerData: { file } });
    const fin = (fn: () => void) => { if (done) return; done = true; clearTimeout(t); fn(); };
    const t = setTimeout(() => fin(() => { void w.terminate(); reject(new Error('galaxy read timed out')); }), 90000);
    w.once('message', (m: { ok?: boolean; data?: GalaxyMap; error?: string }) => fin(() => (m?.ok ? resolve(m.data ?? null) : reject(new Error(m?.error || 'galaxy worker failed')))));
    w.once('error', (e) => fin(() => reject(e)));
    w.once('exit', (code) => fin(() => reject(new Error('galaxy worker exited ' + code))));
  });
}

// ---- 이름·색 ----
// 성계·함대 이름 키는 아무 모양이나 될 수 있어(Gamma_Delphini 등) 지도에 실제로 나온 키만 모아, 게임·모드 지역화 파일을 한 파일씩 쉬어 가며 훑는다(앱이 멈추지 않게).
// 한 번 찾은 키는 기억해 두고(언어·모드 목록이 바뀌면 버림), 새 세이브에서 처음 보는 키만 다시 찾는다.
let names: { rev: number; lang: string; map: Record<string, string>; tried: Set<string> } | null = null;
const tick = () => new Promise<void>((r) => setImmediate(r));
async function nameDict(keys: Set<string>): Promise<Record<string, string>> {
  const res = ctx.modCompatibility.resources; res.refresh();
  const lang = selectedLanguage() === 'ko' ? 'ko' : 'en'; // i18n-data: 게임 지역화 파일 고르기(한국어판 이름이 있으면 한국어)
  if (!names || names.rev !== res.revision || names.lang !== lang) names = { rev: res.revision, lang, map: {}, tried: new Set() };
  const want = new Set([...keys].filter((k) => k && !names!.tried.has(k))); if (!want.size) return names.map;
  const en: Record<string, string> = {}, ko: Record<string, string> = {};
  try {
    const files = res.files('localisation', '.yml').filter((f) => { const b = path.basename(f.relative).toLowerCase(); return b.endsWith('l_english.yml') || (lang === 'ko' && b.endsWith('l_korean.yml')); });
    for (const f of files) {
      try {
        const t = res.read(f).toString('utf8'); const ko1 = /l_korean\.yml$/i.test(f.relative);
        for (const m of t.matchAll(/^[ \t]+([A-Za-z0-9_.\-']+):\d*[ \t]+"(.*)"[ \t]*(?:#.*)?$/gm)) if (want.has(m[1])) (ko1 ? ko : en)[m[1]] = m[2].replace(/\\"/g, '"');
      } catch { /* 건너뜀 */ }
      await tick();
    }
  } catch (e) { logDiagnostic('warn', 'galaxy.names_failed', { error: e }); }
  for (const k of want) names.tried.add(k);
  Object.assign(names.map, en, lang === 'ko' ? ko : {}); // i18n-data: 게임 지역화(한국어판 이름이 있으면 한국어)
  return names.map;
}
/** 지도에 나오는 이름 키들(번호 함대는 fmt 키). */
function mapKeys(g: GalaxyMap): Set<string> {
  const out = new Set<string>();
  for (const s of g.systems) if (s.name) out.add(s.name);
  for (const f of g.fleets) { if (f.name.startsWith('SEQ|')) out.add(f.name.split('|')[1]); else if (f.name) out.add(f.name); }
  for (const c of g.countries) if (c.name) out.add(c.name);
  return out;
}
let colors: { rev: number; map: Record<string, string> } | null = null;
function colorTable(): Record<string, string> {
  const res = ctx.modCompatibility.resources; res.refresh();
  if (colors && colors.rev === res.revision) return colors.map;
  const out: Record<string, string> = {};
  try {
    for (const f of res.files('flags', '.txt')) {
      const t = res.read(f).toString('utf8'), re = /^\s*([a-z0-9_]+)\s*=\s*\{[^\n]*?\bmap\s*=\s*rgb\s*\{\s*(\d+)\s+(\d+)\s+(\d+)\s*\}/gm; let m: RegExpExecArray | null;
      while ((m = re.exec(t))) out[m[1]] = '#' + [m[2], m[3], m[4]].map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { logDiagnostic('warn', 'galaxy.colors_failed', { error: e }); }
  colors = { rev: res.revision, map: out };
  return out;
}

/** 작전지휘실 배경 그림 종류(2026-11-05 사용자: 성향별 10종) — 집무실 자동 규칙과 같다(광신 가치관 먼저, 기계·군체는 따로). 모르면 군국주의 방. */
function warroomStyle(): string {
  let e: string[] | null = null; try { e = ctx.playerIdx >= 0 ? ctx.flagProv.ethicsFor(ctx.playerIdx) : null; } catch { e = null; }
  const k = autoOfficeStyle(e, playerGestalt());
  return k === 'gestalt' ? 'hive' : k === 'standard' ? 'militarist' : k;
}
/** 화면에 줄 모양(이름 풀이·안개 거름까지). */
async function viewOf(g: GalaxyMap, file: string) {
  const loc = await nameDict(mapKeys(g)), col = colorTable();
  const contacts = new Map<number, string>(); if (ctx.terminal.sid === ctx.curSaveId) for (const c of ctx.terminal.items) contacts.set(c.idx, c.name);
  const countries: Record<string, { name: string; color: string; me: boolean; idx: number | null; contact: boolean }> = {};
  for (const c of g.countries) {
    if (!c.me && /sector|livespace|faction|global_event|dummy|_type$/.test(c.type)) continue; // 모드가 만든 가짜 나라(경제 구역 등)는 지도에 안 그림
    const contact = c.me || (c.idx !== null && contacts.has(c.idx));
    const nm = c.me ? (ctx.playerName || prettyName(c.name, loc)) : (c.idx !== null && contacts.get(c.idx)) || prettyName(c.name, loc) || L('알 수 없는 세력', 'Unknown power');
    countries[String(c.id)] = { name: nm, color: col[c.color] || '#8a9aa6', me: c.me, idx: c.idx, contact };
  }
  const showOwner = (sysKnown: boolean, owner: number) => owner >= 0 && !!countries[String(owner)] && (sysKnown || countries[String(owner)].contact);
  return {
    ok: true, file: path.basename(file), sid: ctx.curSaveId || '', date: g.date, player: g.player, style: warroomStyle(), cls: classKey(ctx.profiles.get(ctx.playerIdx)?.cls) ?? 'human', // 둘러선 인물 초상화 = 플레이어 종족 계열(함대 사령부와 같음)
    systems: g.systems.map((s) => ({ id: s.id, x: s.x, y: s.y, ...(s.sn ? { q: s.sn } : {}), n: s.named ? prettyName(s.name, loc) || L('이름 없는 성계', 'Unnamed system') : '', o: showOwner(s.known, s.owner) ? s.owner : -1, hl: s.hl, c: s.col, k: s.known ? 1 : 0, cap: s.cap !== undefined && showOwner(s.known, s.cap) ? s.cap : undefined, ...(s.sb && showOwner(s.known, s.owner) ? { sb: s.sb } : {}) })),
    countries,
    fleets: g.fleets.filter((f) => f.owner === g.player || countries[String(f.owner)]).map((f) => ({ id: f.id, o: f.owner, s: f.sys, to: f.to, n: prettyName(f.name, loc) || (f.cls === 'military' ? L(`함대 #${f.id}`, `Fleet #${f.id}`) : f.cls === 'science_ship' ? L('과학선', 'Science ship') : f.cls === 'constructor' ? L('건설선', 'Construction ship') : f.cls === 'colonizer' ? L('식민선', 'Colony ship') : L('함선', 'Ship')), p: f.power, sh: f.ships, ...(f.big ? { bg: f.big } : {}), ...(f.doc && doctrineByKey(f.doc) ? { dc: f.doc, dcn: L(doctrineByKey(f.doc)!.ko, doctrineByKey(f.doc)!.en) + ' (' + L(...DOC_FX[f.doc]) + ')' } : {}), /* 적 AI 는 성향대로 움직이지 않음 → 화면에 특성 효과만(LLM 에는 안 줌) */ cl: f.cls, mv: f.moving ? 1 : 0 })),
  };
}

export async function galaxyMap(force = false): Promise<Record<string, unknown>> {
  const sid = ctx.curSaveId || '';
  if (!sid) return { ok: false, error: L('게임을 불러온 뒤에 열 수 있습니다.', 'Load a game first.') };
  const d = ctx.flagProv.diagnostics();
  if (!d.file) return { ok: false, error: L('세이브 파일을 찾지 못했습니다. 게임에서 한 번 저장(또는 자동 저장)한 뒤 다시 열어 주세요.', 'No save file found. Save once in game (or wait for an autosave), then reopen.') };
  if (!d.matches) return { ok: false, error: L('지금 게임의 세이브가 아직 없습니다. 자동 저장이 한 번 된 뒤 다시 열어 주세요.', 'There is no save of the current game yet. Reopen after the next autosave.') };
  // 2026-11-09: 깃발 공급자는 이제 바뀜 신호 때만 새 세이브를 읽으므로(flags.ts) 들고 있는 파일이 최신이 아닐 수 있다.
  // 지도는 같은 게임 폴더(세이브 번호가 맞는 파일과 같은 폴더)의 가장 최근 세이브를 읽는다 — 열 때만, 같은 파일·시각이면 다시 읽지 않는다.
  const newest = ctx.flagProv.latestSave(), file = newest && path.dirname(newest) === path.dirname(d.file) ? newest : d.file;
  let mt = 0; try { mt = fs.statSync(file).mtimeMs; } catch { return { ok: false, error: L('세이브 파일을 읽을 수 없습니다.', 'Cannot read the save file.') }; }
  if (!force && cache && cache.file === file && cache.mtime === mt) return keepView(await viewOf(cache.map, file));
  if (!reading) { const t0 = Date.now(); reading = readInWorker(file).then((g) => { usage.noteSaveRead('galaxy', Date.now() - t0, !!g); return g; }, (e) => { usage.noteSaveRead('galaxy', 0, false); throw e; }).finally(() => { reading = null; }); }
  try {
    const map = await reading; if (!map) return { ok: false, error: L('세이브에서 은하 정보를 읽지 못했습니다.', 'Could not read the galaxy from the save.') };
    cache = { file, mtime: mt, map };
    logDiagnostic('info', 'galaxy.read', { systems: map.systems.length, fleets: map.fleets.length, date: map.date });
    return keepView(await viewOf(map, file));
  } catch (e) { logDiagnostic('warn', 'galaxy.read_failed', { error: e }); return { ok: false, error: L('세이브를 읽다가 문제가 생겼습니다. 잠시 뒤 다시 열어 주세요.', 'Something went wrong reading the save. Try again shortly.') }; }
}

/** 시나리오 은하 지도(src/features/scenario-map-app.ts, 2026-11-06)용: 안개 없는 세이브 지도 + 성계·제국 이름 사전 + 지도 색. 세이브 읽기·캐시는 작전지휘실과 같이 쓴다. */
export async function galaxyRaw(force = false): Promise<{ ok: true; map: GalaxyMap; loc: Record<string, string>; colors: Record<string, string> } | { ok: false; error: string }> {
  const v = await galaxyMap(force);
  if (!v.ok || !cache) return { ok: false, error: String(v.error ?? L('세이브에서 은하 정보를 읽지 못했습니다.', 'Could not read the galaxy from the save.')) };
  const keys = new Set<string>();
  for (const s of cache.map.systems) if (s.rn ?? s.name) keys.add(s.rn ?? s.name);
  for (const c of cache.map.countries) if (c.name) keys.add(c.name);
  return { ok: true, map: cache.map, loc: await nameDict(keys), colors: colorTable() };
}

let room: BrowserWindow | null = null;
export function openWarRoom(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('게임을 불러온 뒤에 열 수 있습니다.', 'Load a game first.') };
  if (room && !room.isDestroyed()) { room.show(); room.focus(); return { ok: true }; }
  const w = new BrowserWindow({ width: 1280, height: 800, frame: false, show: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: true, skipTaskbar: true, backgroundColor: '#010407', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  room = w; w.setMenuBarVisibility(false);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'warroom.html'));
  w.once('ready-to-show', () => { coverScreen(w, true, ctx.gameDip); w.show(); w.focus(); });
  w.on('closed', () => { if (room === w) room = null; });
  return { ok: true };
}
export function closeWarRoom(): void { if (room && !room.isDestroyed()) room.close(); }

// ---- 2단계: 함대 명령·작전 회의 ----
type View = Awaited<ReturnType<typeof viewOf>>;
let lastView: { sid: string; v: View } | null = null;
function keepView(v: View): View { lastView = { sid: ctx.curSaveId || '', v }; return v; }
const viewNow = (): View | null => (lastView && lastView.sid === ctx.curSaveId ? lastView.v : null);
const collector = new WrCollector();
let live: { sid: string; at: number; rep: WrReport; sn: Map<number, number> } | null = null;
let council: { sid: string; seed: number; lines: WrLine[]; plans: WrPlan[]; cand: Map<string, number> } | null = null;
let busy = false;

function needGame(): string | null {
  if (!ctx.curSaveId) return L('게임을 불러온 뒤에 할 수 있습니다.', 'Load a game first.');
  if (!ctx.gameRunning) return L('게임이 켜져 있어야 명령을 내릴 수 있습니다.', 'The game must be running to give orders.');
  return null;
}
/** 지금 게임의 우리 군 함대(보고 1번). 세이브 지도가 먼저 있어야 성계 번호를 지도 위치로 바꾼다. */
async function readLive(): Promise<NonNullable<typeof live>> {
  if (!viewNow()) await galaxyMap(false); // 새로 붙은 성계 번호를 이름으로 맞추려면 지도가 먼저
  const sid = ctx.curSaveId || '', req = ++link.reqCounter;
  await terminalRequest(reportCommand(req, sid), 'WREND', req);
  const rep = collector.take(req) ?? { war: false, date: '', fleets: [], fresh: [], enemies: [], allies: [] };
  const v = viewNow(), prev = live && live.sid === sid ? live.sn : undefined;
  const sn = v ? snMap(v.systems as Array<{ id: number; n: string; q?: number }>, rep.fresh, prev) : new Map(prev ?? []);
  live = { sid, at: Date.now(), rep, sn };
  return live;
}
/** 화면에 줄 함대 목록: s = 세이브 지도의 성계 id(모르면 -1). */
/** 동맹 나라 이름: 연락처(단말기) 이름 → 게임 이름 */
function allyName(idx: number, l: NonNullable<typeof live>): string {
  if (ctx.terminal.sid === ctx.curSaveId) { const c = ctx.terminal.items.find((x) => x.idx === idx); if (c?.name) return c.name; }
  return l.rep.allies.find((a) => a.idx === idx)?.name || L('동맹', 'Ally');
}
function liveView(l: NonNullable<typeof live>) {
  const v0 = viewNow(), st = v0 ? strategic(v0, l) : null;
  return { ok: true, ...(st ? { strat: [...st].filter(([, z]) => z.tags.length).map(([id, z]) => ({ s: id, t: z.tags, e: z.toEnemy })) } : {}), war: l.rep.war, date: l.rep.date, enemies: l.rep.enemies.map((e) => e.name), eidx: l.rep.enemies.map((e) => e.idx).filter((x) => x >= 0), // 화면: 적 함대 기물(세이브 나라의 sllm_idx 와 맞춤)
    allies: allyOrder(l).map((a) => ({ idx: a.idx, name: allyName(a.idx, l), rel: a.rel, relText: L(...relName(a.rel)) + (a.cw ? L(' · 같은 전쟁', ' · same war') : ''), n: a.n, xf: a.xf, ln: a.ln, cw: a.cw })), autos: autoView(l),
    fleets: l.rep.fleets.map((f) => ({ fid: f.fid, ...(f.aidx ? { aidx: f.aidx, ally: allyName(f.aidx, l), ...(f.xf ? { xf: 1 } : {}) } : {}), s: f.sn ? l.sn.get(f.sn) ?? -1 : -1, n: f.fleet || L(`함대 #${f.fid}`, `Fleet #${f.fid}`), adm: f.adm, lid: f.lid, p: f.pow, ...(f.big ? { bg: f.big } : {}), mode: f.mode, modeText: modeText(f.mode), idle: f.idle, fight: f.fight, at: f.at })) };
}
const snOf = (sysId: number): number => { if (!live) return 0; for (const [n, id] of live.sn) if (id === sysId) return n; const v = viewNow(); const q = v?.systems.find((s) => s.id === sysId) as { q?: number } | undefined; return q?.q ?? 0; };
async function sendOrder(fid: number, act: WrAct, sysId: number): Promise<{ ok: boolean; error?: string }> {
  const sid = ctx.curSaveId || '', sn = act === 'move' ? snOf(sysId) : 0;
  let cmd: string; try { cmd = orderCommand(++link.reqCounter, sid, fid, act, sn); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const req = link.reqCounter, m = await terminalRequest(cmd, 'WRSET', req), st = String(m.kv.status || '');
  if (st === 'applied') return { ok: true };
  if (st === 'ally_repair' || st === 'ally_refuse') { // 빌려 온 동맹 함대가 요청을 거절(그들의 판단)
    const f = live?.rep.fleets.find((x) => x.fid === fid), ally = f && live ? allyName(f.aidx, live) : L('동맹', 'Ally');
    return { ok: false, ally: true, error: allyRefuseText(st, f?.fleet || L('동맹 함대', 'allied fleet'), ally) } as { ok: boolean; error?: string };
  }
  return { ok: false, error: st === 'no_fleet' ? L('그 함대를 찾지 못했습니다(해체·합류했을 수 있음). 「새로 읽기」를 눌러 주세요.', 'That fleet was not found (it may have been disbanded or merged). Press Reload.') : st === 'no_target' ? L('목적지 성계를 게임에서 찾지 못했습니다.', 'The game could not find the destination system.') : L('게임이 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm. Check that the mod is up to date.') };
}

/** 회의에 보여 줄 지도 요약 + 대상 후보(이름 → 성계 id). */
/** 전략 표지(2026-11-05 사용자: 적과 이어진 하이퍼레인이 많은 곳 = 요충지 같은 틀). 우리·적 성계만.
 *  chokepoint: 이 성계를 막으면 적이 (아는 항로로) 우리 수도에 닿지 못함 · contested: 적 성계와 이어진 항로 2개 이상 · junction: 항로 4개 이상 · invasion_route: 적에서 우리 수도까지 가장 짧은 길 위 · fortified: 우주항 이상 기지 */
type Strat = { tags: string[]; toEnemy: number; enemyNear: number };
function strategic(v: View, l: NonNullable<typeof live>): Map<number, Strat> {
  const out = new Map<number, Strat>(), me = v.player, sysById = new Map(v.systems.map((s) => [s.id, s])), adj = new Map<number, number[]>();
  for (const s of v.systems) for (const t of s.hl) { (adj.get(s.id) ?? adj.set(s.id, []).get(s.id)!).push(t); (adj.get(t) ?? adj.set(t, []).get(t)!).push(s.id); }
  const enemyIdx = new Set(l.rep.enemies.map((e) => e.idx).filter((x) => x >= 0)), enemyName = new Set(l.rep.enemies.map((e) => e.name.toLowerCase()));
  const isEnemy = (o: number) => { const c = v.countries[String(o)]; return o >= 0 && !!c && !c.me && ((c.idx !== null && enemyIdx.has(c.idx)) || enemyName.has(c.name.toLowerCase())); };
  const enemySys = v.systems.filter((s) => isEnemy(s.o)).map((s) => s.id); if (!enemySys.length) return out;
  const ep = new Map<number, number>(); for (const f of v.fleets) if (f.cl === 'military' && isEnemy(f.o)) ep.set(f.s, (ep.get(f.s) ?? 0) + f.p);
  const cap = v.systems.find((s) => s.cap === me);
  const reach = (block: number): { ok: boolean; prev: Map<number, number> } => { // 적 성계들에서 수도까지(block 은 못 지나감)
    const prev = new Map<number, number>(enemySys.map((x) => [x, -1])), q = [...enemySys];
    for (let i = 0; i < q.length; i++) { if (q[i] === cap?.id) return { ok: true, prev }; for (const t of adj.get(q[i]) ?? []) if (t !== block && !prev.has(t)) { prev.set(t, q[i]); q.push(t); } }
    return { ok: prev.has(cap?.id ?? -1), prev };
  };
  const path = new Set<number>();
  if (cap) { const r = reach(-1); if (r.ok) for (let c = cap.id; c !== -1 && c !== undefined; c = r.prev.get(c) ?? -1) path.add(c); }
  let chokeChecks = 0;
  for (const s of v.systems) {
    const mine = s.o === me, foe = isEnemy(s.o); if (!mine && !foe) continue;
    const nb = adj.get(s.id) ?? [], toEnemy = nb.filter((t) => { const o = sysById.get(t)?.o ?? -1; return mine ? isEnemy(o) : o === me; }).length;
    const enemyNear = (ep.get(s.id) ?? 0) + nb.reduce((a, t) => a + (ep.get(t) ?? 0), 0), tags: string[] = [];
    if (toEnemy >= 2) tags.push('contested');
    if (nb.length >= 4) tags.push('junction');
    if (mine && path.has(s.id)) tags.push('invasion_route');
    if ((s.sb ?? 0) >= 2) tags.push('fortified');
    if (mine && cap && s.id !== cap.id && (toEnemy >= 1 || path.has(s.id)) && chokeChecks < 40) { chokeChecks++; if (path.size && !reach(s.id).ok) tags.push('chokepoint'); }
    if (tags.length || toEnemy || enemyNear) out.set(s.id, { tags, toEnemy, enemyNear });
  }
  return out;
}
function brief(v: View, l: NonNullable<typeof live>): { b: WrBrief; cand: Map<string, number> } {
  const me = v.player, sysById = new Map(v.systems.map((s) => [s.id, s])), adj = new Map<number, Set<number>>();
  const link2 = (a: number, b: number) => { (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b); };
  for (const s of v.systems) for (const t of s.hl) { link2(s.id, t); link2(t, s.id); }
  // 우리 땅에서 몇 칸(아는 항로로)
  const dist = new Map<number, number>(), qu: number[] = [];
  for (const s of v.systems) if (s.o === me) { dist.set(s.id, 0); qu.push(s.id); }
  for (let i = 0; i < qu.length; i++) { const d = dist.get(qu[i])!; if (d >= 8) continue; for (const t of adj.get(qu[i]) ?? []) if (!dist.has(t)) { dist.set(t, d + 1); qu.push(t); } }
  const enemyIdx = new Set(l.rep.enemies.map((e) => e.idx).filter((x) => x >= 0)), enemyName = new Set(l.rep.enemies.map((e) => e.name.toLowerCase()));
  const cName = (o: number) => (v.countries[String(o)] || { name: '' }).name;
  const isEnemy = (o: number) => { const c = v.countries[String(o)]; return !!c && !c.me && ((c.idx !== null && enemyIdx.has(c.idx)) || enemyName.has(c.name.toLowerCase())); };
  const nm = (id: number) => sysById.get(id)?.n || '';
  const threats: WrBrief['threats'] = [];
  for (const f of v.fleets) {
    if (f.o === me || f.cl !== 'military' || threats.length >= 12) continue;
    const d = dist.get(f.s); if (d === undefined || d > 2) continue;
    let near = ''; for (const t of adj.get(f.s) ?? []) if (sysById.get(t)?.o === me) { near = nm(t); break; }
    threats.push({ owner: cName(f.o) || L('알 수 없는 세력', 'Unknown power'), power: f.p, at: nm(f.s), near: d === 0 ? nm(f.s) : near, hostile: isEnemy(f.o) });
  }
  const threatAt = new Set(v.fleets.filter((f) => f.o !== me && f.cl === 'military' && (dist.get(f.s) ?? 9) <= 1).flatMap((f) => [f.s, ...(adj.get(f.s) ?? [])]));
  const cands: Array<WrBrief['cands'][number] & { id: number; pri: number }> = [];
  for (const s of v.systems) {
    if (!s.n) continue; const d = dist.get(s.id); if (d === undefined) continue;
    let kind = '', pri = 9;
    if (s.o === me) {
      const border = [...(adj.get(s.id) ?? [])].some((t) => { const o = sysById.get(t)?.o ?? -1; return o >= 0 && o !== me; });
      if (s.cap === me) { kind = 'our capital'; pri = 2; } else if (threatAt.has(s.id)) { kind = 'threatened border'; pri = 0; } else if (border) { kind = 'our border'; pri = 3; } else continue;
    } else if (s.o >= 0 && isEnemy(s.o)) { kind = s.c > 0 ? 'enemy colony' : 'enemy system'; pri = s.c > 0 ? 1 : 4; }
    else if (s.o < 0 && d <= 2 && s.k) { kind = 'unclaimed'; pri = 6; }
    else continue;
    cands.push({ name: s.n, owner: s.o >= 0 ? cName(s.o) : '', kind, jumps: d, id: s.id, pri });
  }
  { const st0 = strategic(v, l); for (const c of cands) { const t = st0.get(c.id)?.tags ?? []; if (t.includes('chokepoint') || t.includes('contested')) c.pri = Math.min(c.pri, 1); } } // 요충지는 후보에서 빠지지 않게
  cands.sort((a, b) => a.pri - b.pri || a.jumps - b.jumps);
  const seen = new Set<string>(), pickC = cands.filter((c) => { const k = c.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, WR.cands);
  const cap = v.systems.find((s) => s.cap === me);
  const b: WrBrief = { empire: ctx.playerName || 'our empire', date: ctx.gameDate || l.rep.date || '', war: l.rep.war, enemies: l.rep.enemies.map((e) => e.name),
    fleets: l.rep.fleets.slice(0, WR.fleets).map((f) => ({ fid: f.fid, name: f.fleet, admiral: f.adm, lid: f.lid, power: f.pow, at: f.at || nm(l.sn.get(f.sn) ?? -1), ...(f.aidx ? { on_loan_from: allyName(f.aidx, l) } : {}), status: f.fight ? 'in combat' : f.mode === 2 ? 'returning for repairs' : f.mode === 3 ? 'automated operation' : f.idle ? 'idle' : 'moving' })),
    allies: l.rep.allies.map((a) => ({ empire: allyName(a.idx, l), relation: relName(a.rel)[1], fleets_lent_to_us: a.n })),
    threats, cands: pickC.map(({ name, owner, kind, jumps }) => ({ name, owner, kind, jumps })), ourSystems: v.systems.filter((s) => s.o === me).length, capital: cap?.n || '' };
  // 후보끼리 항로로 이웃한 것(방어선·협공이 지도에서 이어지게)
  const pickId = new Map(pickC.map((c) => [c.id, c.name]));
  const st = strategic(v, l);
  for (const c of b.cands) {
    const id = pickC.find((x) => x.name === c.name)?.id; if (id === undefined) continue; const nb = [...(adj.get(id) ?? [])].map((t) => pickId.get(t)).filter((x): x is string => !!x).slice(0, 4); if (nb.length) c.next_to = nb;
    const z = st.get(id); if (z) { if (z.tags.length) c.tags = z.tags; if (z.toEnemy) c.lanes_to_enemy = z.toEnemy; if (z.enemyNear) c.enemy_power_nearby = z.enemyNear; }
  }
  return { b, cand: new Map(pickC.map((c) => [c.name, c.id])) };
}
/** 명령에 대한 지휘관 의견(2026-11-05 사용자)에 줄 상황: 함대·목표 성계·그곳과 2칸 안의 적(세이브 때 마지막으로 본 것)·근처 우리 함대. */
function opinionCtx(v: View, l: NonNullable<typeof live>, sid: string, fid: number, act: WrAct, sys: number): { c: WrOpinionCtx; lid: number; name: string; title: string; aidx: number } | null {
  const f = l.rep.fleets.find((x) => x.fid === fid); if (!f) return null;
  const me = v.player, sysById = new Map(v.systems.map((s) => [s.id, s])), adj = new Map<number, number[]>();
  for (const s of v.systems) for (const t of s.hl) { (adj.get(s.id) ?? adj.set(s.id, []).get(s.id)!).push(t); (adj.get(t) ?? adj.set(t, []).get(t)!).push(s.id); }
  const bfs = (from: number, max: number): Map<number, number> => { const d = new Map([[from, 0]]), q = [from]; for (let i = 0; i < q.length; i++) { const k = d.get(q[i])!; if (k >= max) continue; for (const t of adj.get(q[i]) ?? []) if (!d.has(t)) { d.set(t, k + 1); q.push(t); } } return d; };
  const enemyIdx = new Set(l.rep.enemies.map((e) => e.idx).filter((x) => x >= 0)), enemyName = new Set(l.rep.enemies.map((e) => e.name.toLowerCase()));
  const cName = (o: number) => (v.countries[String(o)] || { name: '' }).name || L('알 수 없는 세력', 'Unknown power');
  const isEnemy = (o: number) => { const c = v.countries[String(o)]; return !!c && !c.me && ((c.idx !== null && enemyIdx.has(c.idx)) || enemyName.has(c.name.toLowerCase())); };
  const from = f.sn ? l.sn.get(f.sn) ?? -1 : -1;
  const tgt = act === 'move' ? sysById.get(sys) : act === 'home' ? v.systems.find((s) => s.cap === me) : undefined;
  const jumps = tgt && from >= 0 ? bfs(from, 40).get(tgt.id) ?? null : null;
  const near = tgt ? bfs(tgt.id, 2) : new Map<number, number>(), nm = (id: number) => sysById.get(id)?.n || '?';
  const mil = v.fleets.filter((x) => x.cl === 'military' && x.o !== me && isEnemy(x.o));
  const pr = peopleOf(sid).find((x) => x.lid === f.lid), p = f.lid > 0 ? personaPeek(sid, 'p:' + f.lid) : null;
  const foreign = f.aidx ? allyName(f.aidx, l) : '';
  const name = (foreign ? f.adm : pr?.name || f.adm) || L('함대 참모', 'Fleet staff officer'), title = foreign ? L(`${foreign} 함대 지휘관`, `${foreign} fleet commander`) : f.adm || pr ? L('제독', 'Admiral') : L('함대 참모', 'Fleet staff officer');
  const c: WrOpinionCtx = {
    empire: ctx.playerName || 'our empire', date: ctx.gameDate || l.rep.date || '', war: l.rep.war, seenAt: v.date || '',
    speaker: { name, title, doctrine: (() => { const d = doctrineOf(f.aidx ? 7919 * f.aidx : f.lid > 0 ? f.lid : 1, pr?.traits ?? [], f.aidx ? ctx.profiles.get(f.aidx)?.personality ?? '' : ''); return `${d.en} (${d.style}): ${d.desc}`; })(), ...(p?.persona ? { persona: p.persona } : {}), ...(typeof p?.trust === 'number' ? { trust: p.trust } : {}), ...(foreign ? { foreign } : {}) },
    fleet: { name: f.fleet, power: f.pow, flagship: SHIP_EN[f.big] || 'unknown', at: f.at || nm(from), status: f.fight ? 'in combat' : f.idle ? 'idle' : 'moving', ...(foreign ? { on_loan_from: foreign } : {}) },
    order: { act, target: tgt?.n || '', jumps },
    ...(tgt ? { target: { name: tgt.n || '?', owner: tgt.o >= 0 ? cName(tgt.o) : '', relation: tgt.o === me ? 'ours' as const : tgt.o < 0 ? 'unclaimed' as const : isEnemy(tgt.o) ? 'enemy' as const : 'other' as const, colonies: tgt.c || 0, starbase: SB_EN[tgt.sb ?? 0] || 'none', sbLevel: tgt.sb ?? 0 } } : {}),
    enemyAtTarget: tgt ? mil.filter((x) => x.s === tgt.id).slice(0, 8).map((x) => ({ owner: cName(x.o), power: x.p, flagship: SHIP_EN[x.bg ?? 0] || 'unknown' })) : [],
    enemyNearby: tgt ? mil.filter((x) => x.s !== tgt.id && near.has(x.s)).slice(0, 8).map((x) => ({ owner: cName(x.o), power: x.p, at: nm(x.s) })) : [],
    oursNearby: tgt ? l.rep.fleets.filter((x) => x.fid !== fid && x.sn && near.has(l.sn.get(x.sn) ?? -1)).slice(0, 6).map((x) => ({ name: x.fleet, power: x.pow, at: x.at })) : [],
  };
  return { c, lid: f.lid > 0 ? f.lid : f.aidx ? allyLid(f.aidx) : 0, name, title, aidx: f.aidx };
}
/** 회의에서 말할 사람: 장관 2명 + 제독(통치자가 「발언 요청」한 제독 먼저, 나머지는 전력 순) — 모두 합쳐 WR.speakers 명까지.
 *  max 를 크게 주면 탁자를 둘러선 사람 전원(후반에 제독이 많아져도 화면이 알아서 줄여 세운다, 2026-11-05 사용자). */
/** 동맹 순서(2026-11-05): 발언 요청 → 원정군·함대를 보낸 나라 → 같은 편 전쟁 → 연방 → 방위 조약 */
function allyOrder(l: NonNullable<typeof live>, want: Set<number> = new Set()): WrAlly[] {
  return [...l.rep.allies].sort((x, y) => Number(want.has(allyLid(y.idx))) - Number(want.has(allyLid(x.idx))) || Number(y.n + y.xf > 0) - Number(x.n + x.xf > 0) || Number(y.cw) - Number(x.cw) || y.rel - x.rel || x.idx - y.idx);
}
/** 회의에서 말할 사람 — 작전지휘실이라 전쟁 담당만(2026-11-05 사용자): 국방 분야 장관(최대 2) + 제독(발언 요청 먼저, 그다음 전력 순) + 동맹 군사 연락관.
 *  max = 장관·제독을 합친 수, allyMax = 동맹 연락관 수. 크게 주면 탁자를 둘러선 사람 전원(화면이 알아서 줄여 세운다). */
function speakers(sid: string, l: NonNullable<typeof live>, want: number[] = [], max: number = WR.speakers, allyMax: number = WR.allies): WrSpeaker[] {
  const out: WrSpeaker[] = [], people = peopleOf(sid), wanted = new Set(want);
  for (const m of cabMembersFrom(people).filter((x) => x.domain === 'defense').slice(0, 2)) {
    const p = personaPeek(sid, 'p:' + m.lid), mlv = people.find((x) => x.lid === m.lid)?.lv; out.push({ lid: m.lid, name: m.name, role: 'minister', title: L(m.title[0], m.title[1]), ...(mlv ? { lv: mlv } : {}), ...(p?.persona ? { persona: p.persona } : {}), ...(typeof p?.trust === 'number' ? { trust: p.trust } : {}) });
  }
  for (const f of [...l.rep.fleets].filter((x) => x.lid > 0).sort((a, b) => Number(wanted.has(b.lid)) - Number(wanted.has(a.lid)) || b.pow - a.pow)) {
    if (out.length >= max || out.some((o) => o.lid === f.lid)) continue;
    const pr = people.find((x) => x.lid === f.lid), p = personaPeek(sid, 'p:' + f.lid);
    out.push({ lid: f.lid, name: pr?.name || f.adm || L('제독', 'Admiral'), role: 'admiral', title: L('제독', 'Admiral'), fleet: f.fleet, ...(pr?.lv ? { lv: pr.lv } : {}), ...(p?.persona ? { persona: p.persona } : {}), ...(typeof p?.trust === 'number' ? { trust: p.trust } : {}) });
  }
  // 동맹: 그 나라 통치자가 아니라 군사 연락관이 홀로그램으로 참석(작전 회의는 군인들의 자리)
  for (const a of allyOrder(l, wanted).slice(0, allyMax)) {
    const emp = allyName(a.idx, l);
    out.push({ lid: allyLid(a.idx), name: L(`${emp} 연락 장교`, `${emp} liaison officer`), role: 'ally', title: L(`${emp} 군사 연락관`, `Military liaison of ${emp}`), empire: emp, aidx: a.idx });
  }
  if (!out.some((o) => o.role !== 'ally')) out.unshift({ lid: 0, name: L('작전 참모', 'Operations staff'), role: 'minister', title: L('참모', 'Staff officer') });
  // 인물마다 전쟁 성향(특성 → 성향, 다른 나라 연락관은 그 나라 AI 성격으로 쏠림, 없으면 번호로 고정)
  for (const s of out) { const pr = s.lid > 0 ? people.find((x) => x.lid === s.lid) : undefined; s.doc = doctrineOf(s.aidx ? 7919 * s.aidx : s.lid > 0 ? s.lid : 1, pr?.traits ?? [], s.aidx ? ctx.profiles.get(s.aidx)?.personality ?? '' : '').key; }
  return out;
}
// 빌려 온 동맹 함대의 독자 행동: 알림(지휘관 무전) + 연대기 + 작전지휘실의 동맹 칸에 최근 기록(세이브별 20개, 앱 메모리)
const autos = new WrAutoCollector(); let autoT: ReturnType<typeof setTimeout> | undefined;
const autoLog = new Map<string, WrAuto[]>();
function onAuto(a: WrAuto): void {
  const sid = ctx.curSaveId || ''; if (!sid) return;
  const ally = (ctx.terminal.sid === sid && ctx.terminal.items.find((x) => x.idx === a.aidx)?.name) || live?.rep.allies.find((x) => x.idx === a.aidx)?.name || L('동맹', 'Ally');
  const list = autoLog.get(sid) ?? []; list.push(a); autoLog.set(sid, list.slice(-20));
  const t = autoRadio(a, ally); ctx.notify({ kind: 'fleet', title: t.title, body: t.body });
  if (a.ev === 'attack') chronNoteWorld(L(`${a.date || ctx.gameDate} ${ally}에서 빌려 온 ${a.fleet}이(가) 스스로 ${a.sys}의 적을 향해 진격했다.`, `${a.date || ctx.gameDate} ${a.fleet}, on loan from ${ally}, advanced on the enemy at ${a.sys} on its own initiative.`));
}
// ---- 연합 원정군(AI 가 꺼진 세력, sllm_warroom_xf.txt) ----
// 거절한 나라는 2년 동안 다시 청할 수 없다(세이브별, 앱 데이터 sllm_warroom.json). 매달 사건(WRXF)은 알림·연대기·동맹 칸 기록.
interface XfStore { saves: Record<string, { cool: Record<string, string> }> }
let xfStore: XfStore | null = null;
const xfFile = () => path.join(app.getPath('userData'), 'sllm_warroom.json');
function xfSaves(): XfStore { if (xfStore) return xfStore; try { const v = JSON.parse(fs.readFileSync(xfFile(), 'utf8')); const out: XfStore = { saves: {} }; for (const [k, e] of Object.entries((v && v.saves) || {}).slice(0, 300)) { const c = (e as { cool?: Record<string, unknown> })?.cool || {}; out.saves[safeKey(k)] = { cool: Object.fromEntries(Object.entries(c).filter(([, d]) => typeof d === 'string').slice(-40)) as Record<string, string> }; } xfStore = out; } catch { xfStore = { saves: {} }; } return xfStore; }
function xfSave(): void { try { fs.writeFileSync(xfFile(), JSON.stringify(xfSaves())); } catch (e) { logDiagnostic('warn', 'warroom.save_failed', { error: e }); } }
const xfCool = (sid: string) => { const st = xfSaves(); const k = safeKey(sid); if (!st.saves[k]) st.saves[k] = { cool: {} }; return st.saves[k].cool; };
const xffLines = new Map<string, Array<{ fleet: string; adm: string }>>();
const xfLog = new Map<string, Array<{ idx: number; date: string; text: string }>>();
function onXf(m: SllmMessage): void {
  const e = parseXf(m), sid = ctx.curSaveId || ''; if (!e || !sid) return;
  const ally = (ctx.terminal.sid === sid && ctx.terminal.items.find((x) => x.idx === e.idx)?.name) || live?.rep.allies.find((x) => x.idx === e.idx)?.name || L('동맹', 'Ally');
  const t = xfEvText(e, ally); ctx.notify({ kind: 'fleet', title: t.title, body: t.body });
  const list = xfLog.get(sid) ?? []; list.push({ idx: e.idx, date: e.date || ctx.gameDate || '', text: t.body }); xfLog.set(sid, list.slice(-20));
  if (e.ev === 3 || e.ev === 6 || e.ev === 7) chronNoteWorld(`${e.date || ctx.gameDate} ${t.body}`);
}
const toFoAlly = (a: WrAlly, name: string): FoAlly => ({ idx: a.idx, name, op: a.op, tr: a.tr, rel: a.rel, cw: a.cw, n: a.ln, pow: a.pow, lend: a.ls || a.xf > 0 });
const autoView = (l: NonNullable<typeof live>) => [...(autoLog.get(l.sid) ?? []).map((a) => ({ aidx: a.aidx, date: a.date, ally: allyName(a.aidx, l), text: autoRadio(a, allyName(a.aidx, l)).body })), ...(xfLog.get(l.sid) ?? []).map((x) => ({ aidx: x.idx, date: x.date, ally: allyName(x.idx, l), text: x.text }))].sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
/** 작전 탁자를 둘러선 사람들(화면용) */
const crewOf = (sp: WrSpeaker[], l: NonNullable<typeof live>) => sp.map((s) => ({ lid: s.lid, name: s.name, title: s.title, role: s.role, fleet: s.fleet || '', ...(doctrineByKey(s.doc) ? { doc: { key: s.doc, style: doctrineByKey(s.doc)!.style, name: L(doctrineByKey(s.doc)!.ko, doctrineByKey(s.doc)!.en), fx: s.lid > 0 && !s.aidx ? L(...DOC_FX[s.doc!]) : '' } } : {}), pow: s.role === 'admiral' ? l.rep.fleets.find((f) => f.lid === s.lid)?.pow ?? 0 : 0,
  ...(s.aidx ? { aidx: s.aidx, cls: classKey(ctx.profiles.get(s.aidx)?.cls) ?? 'human', pk: [`save:${ctx.curSaveId}:country:${s.aidx}`, ...(ctx.profiles.get(s.aidx)?.species ? [`save:${ctx.curSaveId}:species:${ctx.profiles.get(s.aidx)!.species}`] : [])] } : {}) })); // 동맹 통치자 초상: 외교 창과 같은 그림 키
const CREW_MAX = 30;
/** 우리 지도자(작전지휘실에 서는 장관·제독)에게 성향 특성을 게임에 붙인다(2026-11-05 사용자: 성향마다 소폭 효과). 이번 실행에서 한 번만, 이미 붙어 있으면 건너뜀. */
const docSent = new Map<string, string>(); // sid:lid → 성향 키
async function syncDoctrines(sid: string, l: NonNullable<typeof live>): Promise<void> {
  const people = peopleOf(sid), list: Array<{ lid: number; key: string }> = [];
  for (const s of speakers(sid, l, [], CREW_MAX, 0)) {
    if (s.lid <= 0 || s.aidx || !s.doc) continue;
    const pr = people.find((x) => x.lid === s.lid), k = sid + ':' + s.lid;
    if (pr?.traits?.includes('sllm_doc_' + s.doc) || docSent.get(k) === s.doc) continue;
    list.push({ lid: s.lid, key: s.doc }); docSent.set(k, s.doc);
  }
  if (!list.length) return;
  for (let i = 0; i < list.length; i += 6) { // 콘솔 한 줄이 너무 길지 않게 6명씩
    const part = list.slice(i, i + 6);
    try { const req = ++link.reqCounter; await terminalRequest(docCommand(req, sid, part), 'WRSET', req); }
    catch (err) { for (const x of part) docSent.delete(sid + ':' + x.lid); logDiagnostic('warn', 'warroom.doctrine_sync_failed', { error: err }); return; }
  }
}

const councilView = () => (council && council.sid === ctx.curSaveId ? { lines: council.lines.slice(-20), plans: council.plans.map((p) => ({ ...p, sys: p.act === 'move' ? council!.cand.get(p.target) ?? -1 : -1, actText: actText(p.act), ...(p.moves ? { moves: p.moves.map((m) => ({ ...m, sys: council!.cand.get(m.target) ?? -1 })) } : {}), ...(p.line ? { lineSys: p.line.map((n) => council!.cand.get(n) ?? -1).filter((x) => x >= 0) } : {}) })) } : { lines: [], plans: [] });

export function registerGalaxy(router: LogRouter): void {
  router.on(SLOT.WARROOM, 'warroom', (m: SllmMessage) => {
    if (!m.kind.startsWith('WR')) return;
    const rq = String(Math.round(Number(String(m.kv.req ?? '').replace(/,/g, '')) || 0));
    if (m.kind === 'WREND') { terminalReplies.get('WREND:' + rq)?.(m); return; }
    if (m.kind === 'WRSET') { terminalReplies.get('WRSET:' + rq)?.(m); return; }
    if (m.kind === 'WRXFF') { const list = xffLines.get(rq) ?? []; list.push({ fleet: String(m.kv.fleet ?? '').slice(0, 80), adm: String(m.kv.adm ?? '').slice(0, 80) }); xffLines.set(rq, list.slice(0, 5)); return; }
    if (m.kind === 'WRXF') { onXf(m); return; }
    if (m.kind === 'WRAUTO' || m.kind === 'WRAUTOS') { const done = autos.feed(m); if (done) onAuto(done); if (m.kind === 'WRAUTO') { clearTimeout(autoT); autoT = setTimeout(() => { const c = autos.flush(); if (c) onAuto(c); }, 4000); } return; }
    collector.feed(m);
  });
  ipcMain.handle('warroomLive', async () => {
    const e = needGame(); if (e) return { ok: false, error: e };
    try { const l = await readLive(); void syncDoctrines(ctx.curSaveId || '', l); /* 성향 특성(기다리지 않음) */ return { ...liveView(l), crew: crewOf(speakers(ctx.curSaveId || '', l, [], CREW_MAX, 12), l), council: councilView() }; }
    catch (err) { logDiagnostic('warn', 'warroom.live_failed', { error: err }); return { ok: false, error: (err as Error).message }; }
  });
  ipcMain.handle('warroomOrder', async (_e, fidIn: unknown, actIn: unknown, sysIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    const fid = Number(fidIn), act = String(actIn) as WrAct, sys = Number(sysIn);
    if (!['move', 'home', 'hold'].includes(act) || !Number.isSafeInteger(fid)) return { ok: false, error: L('명령이 올바르지 않습니다.', 'Invalid order.') };
    try { const r = await sendOrder(fid, act, sys); if (!r.ok) return r; return liveView(await readLive()); }
    catch (err) { return { ok: false, error: (err as Error).message }; }
  });
  // 명령에 대한 지휘관 의견: 화면이 명령을 보낸 뒤 따로 부른다(명령은 기다리지 않음). 회의 기록에도 남는다.
  ipcMain.handle('warroomOpinion', async (_e, fidIn: unknown, actIn: unknown, sysIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    const fid = Number(fidIn), act = String(actIn) as WrAct, sys = Number(sysIn), sid = ctx.curSaveId || '';
    if (!['move', 'home'].includes(act) || !Number.isSafeInteger(fid)) return { ok: false };
    const v = viewNow(), l = live && live.sid === sid ? live : null; if (!v || !l) return { ok: false };
    const o = opinionCtx(v, l, sid, fid, act, sys); if (!o) return { ok: false };
    let raw: string | null = null;
    try { raw = await ctx.ai.chat(opinionMessages(o.c), { purpose: 'warroom.opinion', json: true, maxTokens: 300 }); }
    catch (err) { logDiagnostic('warn', 'warroom.opinion_ai_failed', { error: err }); }
    const r = parseOpinion(raw) ?? opinionFallback(o.c);
    if (council && council.sid === sid) { council.lines.push({ lid: o.lid, name: o.name, title: o.title, say: r.say }); council.lines = council.lines.slice(-30); }
    return { ok: true, fid, lid: o.lid, name: o.name, title: o.title, stance: r.stance, say: r.say, aidx: o.aidx };
  });
  // 작전 건의: 장관·유능한 제독(레벨 PROPOSE_LV 이상)이 스스로 들고 오는 작전(게임 달마다 한 번, force = 바로). 회의 기록·작전안에 붙는다.
  const proposedAt = new Map<string, string>();
  ipcMain.handle('warroomPropose', async (_e, forceIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    const sid = ctx.curSaveId || '', month = (ctx.gameDate || '').slice(0, 7), force = forceIn === true;
    if (busy) return { ok: true, proposed: 0, council: councilView() };
    if (!force && month && proposedAt.get(sid) === month) return { ok: true, proposed: 0, council: councilView() };
    busy = true;
    try {
      if (!viewNow()) await galaxyMap(false);
      const v = viewNow(); if (!v) return { ok: false, error: L('은하 지도를 먼저 불러와 주세요.', 'Load the galaxy map first.') };
      const l = live && live.sid === sid && Date.now() - live.at < 15000 ? live : await readLive();
      if (!l.rep.fleets.length) return { ok: true, proposed: 0, council: councilView() };
      const all = speakers(sid, l, [], CREW_MAX, 0);
      const pro = [...all.filter((x) => x.role === 'minister' && x.lid > 0), ...all.filter((x) => x.role === 'admiral' && (x.lv ?? 0) >= PROPOSE_LV).sort((a, b) => (b.lv ?? 0) - (a.lv ?? 0)).slice(0, 3)];
      proposedAt.set(sid, month);
      if (!pro.length) return { ok: true, proposed: 0, none: true, council: councilView() };
      const { b, cand } = brief(v, l);
      if (!council || council.sid !== sid) council = { sid, seed: 0, lines: [], plans: [], cand: new Map() };
      const seed = 'p' + (++council.seed);
      let raw: string | null = null;
      try { raw = await ctx.ai.chat(proposeMessages(b, pro), { purpose: 'warroom.propose', json: true, maxTokens: 1400 }); }
      catch (err) { logDiagnostic('warn', 'warroom.propose_ai_failed', { error: err }); }
      const r = parseCouncil(raw, b, pro, seed); // LLM 이 없으면 건의도 없음(억지로 만들지 않는다)
      if (!r || !r.plans.length) return { ok: true, proposed: 0, council: councilView() };
      for (const [k, id] of cand) council.cand.set(k, id);
      council.lines.push(...r.lines); council.lines = council.lines.slice(-30);
      council.plans = [...council.plans.filter((x) => !x.done), ...r.plans.map((x) => ({ ...x, prop: true }))].slice(-5);
      return { ok: true, proposed: r.plans.length, lines: r.lines, ids: r.plans.map((x) => x.id), crew: crewOf(speakers(sid, l, [], CREW_MAX, 12), l), council: councilView() };
    } catch (err) { logDiagnostic('warn', 'warroom.propose_failed', { error: err }); return { ok: false, error: (err as Error).message }; }
    finally { busy = false; }
  });
  ipcMain.handle('warroomCouncil', async (_e, askIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    if (busy) return { ok: false, error: L('회의가 진행 중입니다.', 'The council is already in session.') };
    // askIn: 글자(방침) 또는 { ask, want: 발언 요청한 제독 lid[] }
    const ao = askIn && typeof askIn === 'object' ? askIn as { ask?: unknown; want?: unknown; marks?: unknown } : { ask: askIn };
    // 통치자가 지도에 그은 선(전선·방어선·화살표) → 지나는 성계 이름
    const marks: WrMark[] = (Array.isArray(ao.marks) ? ao.marks : []).slice(0, 8).map((x) => { const o = (x && typeof x === 'object' ? x : {}) as { kind?: unknown; systems?: unknown }; const k = String(o.kind); return { kind: (k === 'front' || k === 'defense' ? k : 'arrow') as WrMark['kind'], systems: (Array.isArray(o.systems) ? o.systems : []).map((n) => String(n).replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean).slice(0, 8) }; }).filter((m) => m.systems.length >= 1);
    const want = (Array.isArray(ao.want) ? ao.want : []).map(Number).filter((n) => Number.isSafeInteger(n) && n !== 0).slice(0, 4); // 제독 lid(양수)·동맹 연락관(음수)
    const sid = ctx.curSaveId || '', ask = String(ao.ask ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
    busy = true;
    try {
      if (!viewNow()) await galaxyMap(false);
      const v = viewNow(); if (!v) return { ok: false, error: L('은하 지도를 먼저 불러와 주세요.', 'Load the galaxy map first.') };
      const l = live && live.sid === sid && Date.now() - live.at < 15000 ? live : await readLive();
      if (!l.rep.fleets.length) return { ok: false, error: L('지휘할 군 함대가 없습니다.', 'There are no warfleets to command.') };
      const { b, cand } = brief(v, l), sp = speakers(sid, l, want, WR.speakers + Math.max(0, want.filter((n) => n > 0).length - 1), WR.allies + Math.max(0, want.filter((n) => n < 0).length - 1));
      if (!council || council.sid !== sid) council = { sid, seed: 0, lines: [], plans: [], cand: new Map() };
      const seed = 'c' + (++council.seed);
      let raw: string | null = null;
      try { raw = await ctx.ai.chat(councilMessages(b, sp, ask, council.lines, marks), { purpose: 'warroom.council', json: true, maxTokens: 1600 }); }
      catch (err) { logDiagnostic('warn', 'warroom.council_ai_failed', { error: err }); }
      const r = parseCouncil(raw, b, sp, seed) ?? councilFallback(b, sp, seed);
      if (ask) council.lines.push({ lid: -1, name: ctx.playerName || L('통치자', 'Ruler'), title: L('통치자', 'Ruler'), say: ask });
      council.lines.push(...r.lines); council.lines = council.lines.slice(-30);
      council.plans = r.plans; council.cand = cand;
      return { ...liveView(l), crew: crewOf(speakers(sid, l, want, CREW_MAX, 12), l), council: councilView() };
    } catch (err) { logDiagnostic('warn', 'warroom.council_failed', { error: err }); return { ok: false, error: (err as Error).message }; }
    finally { busy = false; }
  });
  // 연합 원정군 요청: 수락 판정(합동 작전과 같은 주사위) → 그 나라 통치자의 답신(LLM 1번) → 수락이면 게임이 세력을 만들고 함대를 옮긴다.
  let xfBusy = false;
  ipcMain.handle('warroomXfAsk', async (_e, idxIn: unknown, askIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    if (xfBusy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.') };
    const sid = ctx.curSaveId || '', idx = Number(idxIn), ask = String(askIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    xfBusy = true;
    try {
      const l = await readLive(), a = l.rep.allies.find((x) => x.idx === idx), name = allyName(idx, l);
      if (!a) return { ok: false, error: L('그 나라는 지금 합동 작전 상대가 아닙니다.', 'That empire is not a joint-operation partner right now.') };
      if (a.xf > 0) return { ok: false, error: L('이미 그 나라의 연합 원정군이 와 있습니다.', 'Their expeditionary force is already with us.') };
      if (a.ls || a.n > 0) return { ok: false, error: L('함대 사령부 합동 작전으로 이미 그 나라 함대를 빌려 오고 있습니다.', 'We already borrow their fleets through Fleet Command.') };
      const cool = xfCool(sid), cd = cool[String(idx)];
      if (cd && monthsBetween(cd, ctx.gameDate || '') < XF.coolMonths) return { ok: false, error: L(`${cd}에 거절당했습니다. 2년 뒤에 다시 청할 수 있습니다.`, `They refused on ${cd}. You can ask again after two years.`) };
      const fa = toFoAlly(a, name), p = allyChance(fa), n = allyFleets(fa), accepted = fa.n > 0 && Math.random() < p;
      let reply = ''; try { reply = parseAllyReply(await ctx.ai.chat(xfMessages({ empire: ctx.playerName || 'our empire', date: ctx.gameDate || '', ally: fa, accepted, n, ask, rel: relName(fa.rel)[1], op: opName(fa.op)[1] }), { purpose: 'warroom.xf', json: true, maxTokens: 700 })); } catch (err) { logDiagnostic('warn', 'warroom.xf_reply_failed', { error: err }); }
      if (!reply) reply = xfFallback(accepted, n, name);
      if (!accepted) { cool[String(idx)] = ctx.gameDate || ''; xfSave(); return { ok: true, accepted: false, reply, chance: Math.round(p * 100) }; }
      const req = ++link.reqCounter, m = await terminalRequest(xfCreateCommand(req, sid, idx, n), 'WRSET', req), st = String(m.kv.status || '');
      const got = xffLines.get(String(req)) ?? []; xffLines.delete(String(req));
      if (st !== 'applied') return { ok: false, reply, error: st === 'no_fleet' ? L('수락했지만 지금 보낼 수 있는 함대가 없다고 합니다(전투 중·수리 중).', 'They agreed, but have no fleet free right now (in combat or repairing).') : st === 'already' ? L('이미 원정군이 와 있습니다.', 'A force is already here.') : L('게임이 확인해 주지 않았습니다. 모드가 최신인지 확인해 주세요.', 'The game did not confirm. Check that the mod is up to date.') };
      const names = got.map((g) => g.adm ? `${g.fleet}(${g.adm})` : g.fleet).join(', ');
      chronNoteWorld(L(`${ctx.gameDate} ${name}이(가) ${XF.years}년 계약으로 연합 원정군(함대 ${got.length || n}개)을 보내왔다${names ? ` — ${names}` : ''}.`, `${ctx.gameDate} ${name} sent an expeditionary force of ${got.length || n} fleet(s) on a ${XF.years}-year contract${names ? ` — ${names}` : ''}.`), true);
      return { ...liveView(await readLive()), ok: true, accepted: true, reply, chance: Math.round(p * 100), joined: names };
    } catch (err) { return { ok: false, error: (err as Error).message }; }
    finally { xfBusy = false; }
  });
  ipcMain.handle('warroomXfEnd', async (_e, idxIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    try {
      const req = ++link.reqCounter, m = await terminalRequest(xfEndCommand(req, ctx.curSaveId || '', Number(idxIn)), 'WRSET', req);
      if (String(m.kv.status) !== 'applied') return { ok: false, error: L('돌려보낼 원정군이 없습니다.', 'There is no force to send back.') };
      return liveView(await readLive());
    } catch (err) { return { ok: false, error: (err as Error).message }; }
  });
  ipcMain.handle('warroomPlan', async (_e, idIn: unknown) => {
    const e = needGame(); if (e) return { ok: false, error: e };
    const sid = ctx.curSaveId || '', p = council && council.sid === sid ? council.plans.find((x) => x.id === String(idIn)) : undefined;
    if (!p) return { ok: false, error: L('이 작전안을 찾지 못했습니다.', 'This plan was not found.') };
    if (p.done) return { ok: true, council: councilView() };
    const sys = p.act === 'move' ? council!.cand.get(p.target) ?? -1 : -1;
    if (p.act === 'move' && sys < 0) return { ok: false, error: L('목적지 성계를 지도에서 찾지 못했습니다.', 'The destination is not on the map.') };
    // 갈래마다 그 목적지로(여러 갈래 작전), 아니면 모든 함대를 한 목적지로
    const legs = p.moves && p.moves.length ? p.moves.map((m) => ({ fleets: m.fleets, sys: council!.cand.get(m.target) ?? -1 })).filter((m) => m.sys >= 0) : [{ fleets: p.fleets, sys }];
    let ok = 0; const errs: string[] = [];
    for (const lg of legs) for (const fid of lg.fleets) { try { const r = await sendOrder(fid, p.act, lg.sys); if (r.ok) ok++; else if (r.error) errs.push(r.error); } catch (err) { errs.push((err as Error).message); } }
    p.done = ok > 0; p.result = ok > 0 ? L(`함대 ${ok}개에 명령을 내렸습니다.`, `Orders sent to ${ok} fleet(s).`) + (errs.length ? ' ' + errs[0] : '') : errs[0] || L('명령을 내리지 못했습니다.', 'No orders were sent.');
    if (ok > 0) {
      const names = p.fleets.map((f) => live?.rep.fleets.find((x) => x.fid === f)?.fleet).filter(Boolean).join(', ');
      chronNoteWorld(L(`${ctx.gameDate} 작전지휘실 회의에서 ${p.code ? `「${p.code}」 작전(${p.title})` : `「${p.title}」 작전`}이 승인되었다(${names}${p.act === 'move' ? ' → ' + p.target : ' · ' + actText(p.act)}).`, `${ctx.gameDate} The war council approved Operation ${p.code ? `${p.code} (${p.title})` : `"${p.title}"`} (${names}${p.act === 'move' ? ' → ' + p.target : ' · ' + actText(p.act)}).`));
      if (p.by > 0) personaNote(sid, 'p:' + p.by, L(`${ctx.gameDate} 작전 회의에서 낸 「${p.code || p.title}」 작전안이 채택되었다.`, `${ctx.gameDate} My proposal, Operation ${p.code || p.title}, was adopted at the war council.`), 2);
    }
    let lv: Record<string, unknown> = {}; try { lv = liveView(await readLive()); } catch { /* 다음 새로 읽기 때 */ }
    return { ...lv, ok: ok > 0, error: ok > 0 ? undefined : p.result, council: councilView() };
  });
  ipcMain.handle('galaxyMap', async (_e, force: unknown) => galaxyMap(force === true));
  ipcMain.handle('warroomOpen', async () => openWarRoom());
  ipcMain.handle('warroomClose', async () => { closeWarRoom(); return { ok: true }; });
}
