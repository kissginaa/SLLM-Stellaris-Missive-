// 포트레이트 라이브러리(앱 쪽): 앱 폴더 portrait-library 의 미리 그려 둔 초상화를 읽어 화면에 알려 준다.
// - 대화 상대: 세이브에서 읽은 통치자의 초상화·성별로 맞는 그림을 자동으로 고른다(사용자가 올린 그림이 있으면 그것이 먼저).
// - 의회 의원: 종족 계열별로 성별이 섞인 여러 얼굴을 쓰되, 외계인 혐오 제국은 통치자 종족 모델 하나만 쓴다(ui/delegate-pick.js).
// - 설정 > 초상화: 라이브러리에서 골라 계열·의원 칸에 적용(평소 사용자 그림과 같은 방식으로 저장).
// - 모드 초상화(2026-10-26): 바닐라 라이브러리에 없는 초상화 키는 켜진 모드(·설치된 모드)의 모델·텍스처로 앱이 직접 그려
//   앱 데이터 portrait_library_mods/ 에 두 번째 라이브러리로 저장하고, 위의 모든 곳에서 바닐라 그림과 똑같이 쓴다(mod-portraits.ts).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { settings, saveSettings } from '../app/settings';
import { resolveEnvironment } from '../environment-paths';
import { loadLibrary, extractPak, libraryFile, pickRulerItem, type LibFile, type LibItem } from '../portraitlib';
import { Worker } from 'worker_threads';
import { listModRoots, type ModLibItem } from '../mod-portraits';
import { runModPortraitJob, type ModPortraitJob, type ModPortraitResult } from '../mod-portraits-job';
import { logDiagnostic } from '../diagnostics';
import { applyImageFile, imageState } from './images';

/** 라이브러리는 앱과 함께 설치되는 portrait-library.pak(앱 폴더)에 들어 있고, 처음 쓸 때 앱 데이터 폴더(portrait_library)에 풀린다.
 * 창작마당 모드 폴더를 거치지 않으므로 모드를 다시 올리지 않아도 된다. 낱개 파일이 든 앱 폴더/portrait-library 가 있으면 그것을, SLLM_PORTRAIT_LIB 가 있으면 그 폴더를 먼저 쓴다. */
export function libDir(): string {
  if (process.env.SLLM_PORTRAIT_LIB) return process.env.SLLM_PORTRAIT_LIB;
  const loose = path.join(app.getAppPath(), 'portrait-library');
  if (fs.existsSync(path.join(loose, 'library.json'))) return loose;
  const out = path.join(app.getPath('userData'), 'portrait_library');
  extractPak(path.join(app.getAppPath(), 'portrait-library.pak'), out);
  return out;
}
/** 모드 초상화(앱이 그린 것) 폴더. */
export function modLibDir(): string { const d = path.join(app.getPath('userData'), 'portrait_library_mods'); try { fs.mkdirSync(d, { recursive: true }); } catch { /* 만들 수 없으면 그리기만 실패 */ } return d; }

let baseCache: { dir: string; mtime: number; lib: LibFile } | null = null;
let modCache: { mtime: number; lib: LibFile } | null = null;
const mtimeOf = (f: string) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
function baseLibrary(): LibFile {
  const d = libDir(), m = mtimeOf(path.join(d, 'library.json'));
  if (!baseCache || baseCache.dir !== d || baseCache.mtime !== m) baseCache = { dir: d, mtime: m, lib: loadLibrary(d) };
  return baseCache.lib;
}
function modLibrary(): LibFile {
  const d = modLibDir(), m = mtimeOf(path.join(d, 'library.json'));
  if (!modCache || modCache.mtime !== m) modCache = { mtime: m, lib: loadLibrary(d, true) };
  return modCache.lib;
}
/** 바닐라 + 모드 초상화를 합친 라이브러리(같은 그룹 이름은 구성원을 합침). */
export function library(): LibFile {
  const b = baseLibrary(), m = modLibrary();
  if (!m.items.length) return b;
  const groups: Record<string, string[]> = { ...b.groups };
  for (const [g, ms] of Object.entries(m.groups)) groups[g] = [...new Set([...(groups[g] ?? []), ...ms])];
  const ids = new Set(b.items.map((x) => x.id));
  return { version: b.version, items: [...b.items, ...m.items.filter((x) => !ids.has(x.id))], groups };
}
const isModItem = (id: unknown) => typeof id === 'string' && modLibrary().items.some((x) => x.id === id);
/** 항목 id·역할 → 그림 파일(모드 그림이면 모드 폴더에서). */
function itemFile(id: unknown, role: unknown): string | null {
  return isModItem(id) ? libraryFile(modLibrary(), modLibDir(), id, role) : libraryFile(baseLibrary(), libDir(), id, role);
}

/** 이 제국 통치자에게 맞는 라이브러리 항목. 같은 세이브·제국이면 늘 같은 항목(시드 고정). 못 찾으면 null(그 초상화 키는 모드 그리기 대기열로). */
export function rulerLibraryItem(idx: number): LibItem | null {
  const r = ctx.flagProv.rulerFor(idx);
  if (!r) return null;
  const it = pickRulerItem(library(), r.portrait, r.gender, ctx.curSaveId + '|' + idx);
  if (!it && r.portrait) queueModPortrait(r.portrait);
  return it;
}
/** 초상화 키(종족 초상화·그룹)·성별에 맞는 라이브러리 그림 주소(역할 옷, 예 governor). 같은 시드면 늘 같은 그림. 없으면 undefined(그 키는 모드 그리기 대기열로).
 * 시나리오 은하 지도의 섹터 총독(src/features/scenario-map-app.ts, 2026-11-06). */
export function libraryPortraitUrl(portrait: string, gender: 'f' | 'm' | '', seed: string, role: string): string | undefined {
  const it = pickRulerItem(library(), portrait, gender, seed);
  if (!it) { if (portrait) queueModPortrait(portrait); return undefined; }
  const f = itemFile(it.id, role);
  return f ? pathToFileURL(f).href : undefined;
}
/** 대화 상대 화면에 쓸 자동 초상화(통치자 옷). 없으면 undefined. */
export function autoPortraitUrl(idx: number): string | undefined {
  const it = rulerLibraryItem(idx); if (!it) return undefined;
  const f = itemFile(it.id, 'ruler');
  return f ? pathToFileURL(f).href : undefined;
}
/** 이 제국이 외계인 혐오(일반·광신) 가치관을 가졌는가. 모드가 실시간으로 알려 준 값을 먼저, 없으면 세이브 값. */
export function isXenophobe(idx: number): boolean {
  const ids = ctx.modCompatibility.liveFor(ctx.curSaveId, idx)?.ids ?? ctx.flagProv.ethicsFor(idx);
  return !!ids?.some((i) => /xenophob/i.test(String(i)));
}

// ── 모드 초상화 그리기(백그라운드, 초상화 하나마다 쉬어 가며 — 앱이 멈추지 않게) ──
export interface ModPortraitState { running: boolean; done: number; total: number; drawn: number; failed: number; approx: number; items: number; mods: number; lastError: string; failedKeys: string[] }
const st: ModPortraitState = { running: false, done: 0, total: 0, drawn: 0, failed: 0, approx: 0, items: 0, mods: 0, lastError: '', failedKeys: [] };
const pending = new Set<string>(), tried = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const yieldNow = () => new Promise<void>((res) => setImmediate(res));
/** 게임 + 모드 겹침 순서: 꺼진 모드(가장 약함) → 켜진 모드(로드 순서, 뒤가 우선). */
function jobRoots(): { roots: string[]; modNames: string[] } | null {
  const env = resolveEnvironment(settings);
  if (!env.game) { st.lastError = 'game_dir'; return null; }
  const mods = listModRoots(env.userDir);
  const order = [...mods.filter((m) => !m.enabled), ...mods.filter((m) => m.enabled)];
  st.mods = mods.length;
  return { roots: [env.game, ...order.map((m) => m.root)], modNames: order.map((m) => m.name) };
}
/** 작업 스레드 파일(컴파일된 dist 에만). 없거나 SLLM_PORTRAIT_SYNC 면 null → 본 스레드에서(쉬어 가며) 그린다. */
function portraitWorkerScript(): string | null {
  if (process.env.SLLM_PORTRAIT_SYNC) return null;
  const p = path.join(__dirname, '..', 'mod-portraits-worker.js');
  try { return fs.existsSync(p) ? p : null; } catch { return null; }
}
/** 그리기 작업 하나(2026-10-27): 작업 스레드에서. 진행 상황은 st 에. 10분 넘으면 끊는다. */
function runJob(job: ModPortraitJob): Promise<ModPortraitResult> {
  const prog = (d: number, t: number) => { st.done = d; st.total = t; };
  const script = portraitWorkerScript();
  if (!script) return runModPortraitJob(job, prog, yieldNow);
  return new Promise((resolve, reject) => {
    let done = false;
    const w = new Worker(script, { workerData: job });
    const finish = (fn: () => void) => { if (done) return; done = true; clearTimeout(t); fn(); };
    const t = setTimeout(() => finish(() => { void w.terminate(); reject(new Error('portrait job timed out')); }), 600000);
    w.on('message', (m: { t: string; done?: number; total?: number; result?: ModPortraitResult; error?: string }) => {
      if (m?.t === 'p') prog(m.done ?? 0, m.total ?? 0);
      else if (m?.t === 'r' && m.result) finish(() => resolve(m.result!));
      else if (m?.t === 'e') finish(() => reject(new Error(m.error || 'portrait worker failed')));
    });
    w.once('error', (e) => finish(() => reject(e)));
    w.once('exit', (code) => finish(() => reject(new Error('portrait worker exited ' + code))));
  });
}
interface ModLibFile { items: ModLibItem[]; groups: Record<string, string[]>; meta: Record<string, { status: string; error?: string; at: number }> }
function loadModLib(): ModLibFile {
  try { const j = JSON.parse(fs.readFileSync(path.join(modLibDir(), 'library.json'), 'utf8')); return { items: Array.isArray(j.items) ? j.items : [], groups: j.groups && typeof j.groups === 'object' ? j.groups : {}, meta: j.meta && typeof j.meta === 'object' ? j.meta : {} }; } catch { return { items: [], groups: {}, meta: {} }; }
}
function saveModLib(l: ModLibFile): void {
  const f = path.join(modLibDir(), 'library.json'), tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, items: l.items, groups: l.groups, meta: l.meta }));
  fs.renameSync(tmp, f);
}
/** 초상화 키(또는 그룹)를 그려 모드 라이브러리에 넣는다. 바닐라 라이브러리에 이미 있는 키는 건너뜀. redraw = 이미 그린(또는 실패한) 것도 다시. */
export async function drawModPortraits(keys: string[], redraw = false): Promise<ModPortraitState> {
  if (st.running) return { ...st };
  Object.assign(st, { running: true, done: 0, total: 0, drawn: 0, failed: 0, approx: 0, lastError: '', failedKeys: [] });
  try {
    const jr = jobRoots(); if (!jr) return { ...st };
    const lib0 = loadModLib();
    // 무거운 일(모드 훑기·그리기)은 작업 스레드에서(2026-10-27). 여기서는 목록만 합친다.
    const res = await runJob({ ...jr, keys, baseKeys: [...new Set(baseLibrary().items.flatMap((x) => x.portraits))], seen: Object.keys(lib0.meta), redraw, outDir: modLibDir() });
    const lib = loadModLib(); // 그리는 동안 바뀌었을 수 있으니 다시 읽고 합친다
    for (const [k, ms] of Object.entries(res.groups)) lib.groups[k] = [...new Set([...(lib.groups[k] ?? []), ...ms])];
    st.total = res.total;
    for (const o of res.results) {
      if (o.item) { const item = o.item; lib.items = lib.items.filter((x) => x.id !== item.id); lib.items.push(item); lib.meta[o.key] = { status: item.status, at: Date.now() }; st.drawn++; if (item.status === 'approx') st.approx++; }
      else { lib.meta[o.key] = { status: 'failed', error: o.error ?? 'failed', at: Date.now() }; st.failed++; st.failedKeys.push(o.key); }
    }
    st.done = res.total;
    if (st.total || Object.keys(lib.groups).length) { saveModLib(lib); modCache = null; }
    st.items = lib.items.length;
    // 실패 이유도 남긴다(2026-11-08: 키 이름만 있어 원인을 몰랐다). 이유는 library.json meta 에도 그대로 있다.
    logDiagnostic('info', 'portrait.mods', { total: st.total, drawn: st.drawn, failed: st.failed, approx: st.approx, mods: st.mods, failedKeys: st.failedKeys.slice(0, 20),
      reasons: res.results.filter((o) => !o.item).slice(0, 20).map((o) => `${o.key}: ${o.error ?? 'failed'}`.slice(0, 200)) });
  } catch (e) { st.lastError = String((e as Error)?.message ?? e).slice(0, 120); logDiagnostic('warn', 'portrait.mods_error', { error: st.lastError }); }
  finally { st.running = false; }
  if (st.drawn) ctx.toUi('portraitLibraryChanged', { drawn: st.drawn });
  return { ...st };
}
/** 라이브러리에 없는 초상화 키를 대기열에 넣고 잠시 뒤 한꺼번에 그린다(같은 실행에서 키마다 한 번만 시도). */
export function queueModPortrait(key: string): void {
  if (!key || tried.has(key) || settings.modPortraits === false) return;
  tried.add(key); pending.add(key);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; const ks = [...pending]; pending.clear(); void drawModPortraits(ks); }, 4000);
}
/** 지금 세이브의 모든 제국 통치자·종족 초상화 키(라이브러리에 없는 것만 그리기 대상이 됨). */
function saveKeys(): string[] {
  const out = new Set<string>();
  for (let i = 0; i <= 400; i++) {
    const r = ctx.flagProv.rulerFor(i); if (r?.portrait) out.add(r.portrait);
    const p = ctx.flagProv.portraitInfoFor(i);
    if (p?.founder?.portrait) out.add(p.founder.portrait);
    for (const m of p?.mix ?? []) if (m.portrait) out.add(m.portrait);
  }
  return [...out];
}

export function registerPortraitLib(): void {
  ipcMain.handle('getPortraitLibrary', async () => {
    const lib = library(), d = libDir(), md = modLibDir();
    const meta = new Map(loadModLib().items.map((it) => [it.id, it]));
    return { available: lib.items.length > 0, folder: d, modFolder: md, items: lib.items.map((it) => {
      const mm = meta.get(it.id), dir = isModItem(it.id) ? md : d;
      return { id: it.id, cls: it.cls, defaultRole: it.defaultRole, count: it.portraits.length, portraits: it.portraits, mod: mm?.mod ?? '', approx: mm?.status === 'approx', roles: Object.fromEntries(Object.entries(it.roles).map(([r, f]) => [r, pathToFileURL(path.join(dir, f)).href])) };
    }) };
  });
  ipcMain.handle('applyLibraryPortrait', async (_e, target: { kind: 'portrait'; key: string; label?: string }, id: unknown, role: unknown) => {
    const f = itemFile(id, role);
    if (!f) return { ...imageState(), note: '라이브러리 그림을 찾지 못했습니다.' };
    return applyImageFile(f, target);
  });
  ipcMain.handle('getModPortraitState', async () => ({ ...st, enabled: settings.modPortraits !== false }));
  /** 설정 단추: 지금 세이브의 초상화 중 라이브러리에 없는 것을 모드에서 찾아 그림. redraw = 이미 그린 것도 다시. */
  ipcMain.handle('drawModPortraits', async (_e, redraw: unknown) => drawModPortraits(saveKeys(), redraw === true));
  ipcMain.handle('setModPortraitsAuto', async (_e, on: unknown) => { settings.modPortraits = on !== false; saveSettings(); return { enabled: settings.modPortraits !== false }; });
}
