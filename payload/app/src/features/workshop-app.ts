// 창작마당 애드온 자동 감지(사용자 요청 2026-10-23, 47 확장). 규칙: src/workshop-addons.ts(reconcile·markInstalled·markIgnored·scanNotice).
// 형식은 기존 SLLM 애드온과 같다: 창작마당 항목 안의 sllm/addon/addon.json(그림·테마·음악·언어·호환 + 세계관 책 lore). 새 형식을 따로 만들지 않는다.
// 구독 폴더(steamapps/workshop/content/281990/<번호>)는 **읽기만** 한다. 「설치」하면 앱 애드온 폴더(userData/addons/ws-<번호>)로 복사하고 꺼진 채로 둔다(47: 발견 ≠ 설치 ≠ 활성).
// 스팀이 새 버전을 받으면 「업데이트 있음」 → 승인하면 다시 복사(켜짐 상태 유지). 구독 해제는 알리기만 하고 설치본은 남긴다. 게임에서 모드로 켠 항목은 이미 앱이 읽으므로 따로 설치하지 않는다.
// 데이터 파일만 복사한다(그림·소리·json·txt·md). 실행 파일·스크립트·HTML 은 복사하지 않고 그 항목은 「허용되지 않는 파일」로 건너뛴다. LLM 호출 없음.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { settings, saveSettings } from '../app/settings';
import { steamLibraries } from '../environment-paths';
import { parseManifest, MOD_ADDON_DIR, ADDON_MANIFEST } from '../addons';
import { addonsDir, addonEntries, reloadAddons } from './addons-app';
import type { PackManifest } from '../addon-packs';
import { type WorkshopIndex, type Inspect, emptyWsIndex, reconcile, markInstalled, markIgnored, scanNotice, STELLARIS_APPID } from '../workshop-addons';

export const WS_LIMITS = { maxFiles: 500, maxFileBytes: 50 * 1024 * 1024, maxTotalBytes: 500 * 1024 * 1024, maxManifest: 512 * 1024 } as const;
const DATA_EXT = /\.(json|png|jpe?g|webp|mp3|ogg|oga|opus|wav|m4a|aac|flac|txt|md)$/i;
const BAD_EXT = /\.(exe|dll|bat|cmd|ps1|vbs|js|mjs|cjs|html?|svg|sh|py|jar|com|scr|msi|lnk)$/i;
const idxFile = () => path.join(app.getPath('userData'), 'workshop_addons.json');
let index: WorkshopIndex | null = null;
const loadIdx = (): WorkshopIndex => { if (index) return index; try { const j = JSON.parse(fs.readFileSync(idxFile(), 'utf8')); index = { ...emptyWsIndex(), ...j, items: j?.items ?? {}, folderMtimes: j?.folderMtimes ?? {} }; } catch { index = emptyWsIndex(); } return index!; };
const saveIdx = () => { try { const tmp = idxFile() + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(loadIdx()), 'utf8'); fs.renameSync(tmp, idxFile()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'workshop_addons', error: e }); } };

/** 애드온 폴더 안 파일 목록(상대 경로). 데이터 파일만 고르고, 허용되지 않는 파일이 있으면 bad 로 알린다. */
export function listAddonFiles(dir: string): { files: { rel: string; bytes: number }[]; bad: string[]; tooBig: boolean } {
  const files: { rel: string; bytes: number }[] = [], bad: string[] = []; let total = 0, tooBig = false;
  const walk = (d: string, rel: string, depth: number) => {
    if (depth > 6) return; let list: fs.Dirent[] = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const r = rel ? `${rel}/${e.name}` : e.name, p = path.join(d, e.name);
      if (e.isSymbolicLink()) { bad.push(r); continue; } // 바깥 경로로 이어질 수 있다
      if (e.isDirectory()) { walk(p, r, depth + 1); continue; }
      if (BAD_EXT.test(e.name)) { bad.push(r); continue; }
      if (!DATA_EXT.test(e.name)) continue;
      let size = 0; try { size = fs.statSync(p).size; } catch { continue; }
      if (size > WS_LIMITS.maxFileBytes) { tooBig = true; continue; }
      total += size; files.push({ rel: r, bytes: size });
    }
  };
  walk(dir, '', 0);
  if (files.length > WS_LIMITS.maxFiles || total > WS_LIMITS.maxTotalBytes) tooBig = true;
  return { files, bad, tooBig };
}
/** 기존 addon.json → 비교용 팩 정보(id·이름·버전·항목 = 그림 키·음악·세계관 책). */
export function packOf(raw: string): { pack: PackManifest | null; warnings: string[] } {
  const warnings: string[] = [], m = parseManifest(raw, warnings); if (!m) return { pack: null, warnings };
  let lore: Array<{ id?: unknown; title?: unknown }> = []; try { const j = JSON.parse(raw); lore = Array.isArray(j?.lore?.books) ? j.lore.books : []; } catch { /* 위에서 이미 걸렀다 */ }
  const items = [...Object.keys(m.images).map((k) => ({ id: `img:${k}`, type: 'room_bg' as const, title: k })), ...Object.entries(m.music ?? {}).filter(([, v]) => !!v).map(([k]) => ({ id: `music:${k}`, type: 'music' as const, title: k })), ...lore.filter((b) => typeof b?.id === 'string').map((b) => ({ id: `book:${String(b.id)}`, type: 'book' as const, title: String(b.title ?? b.id) }))];
  return { pack: { id: m.id, name: m.name, author: m.author || '?', version: m.addonVersion || '1', kind: lore.length && !Object.keys(m.images).length ? 'lore' : 'appearance', schema: 1, items }, warnings };
}
interface Found { itemId: string; dir: string; mtime: number }
function findItems(): Found[] {
  const out: Found[] = [], seen = new Set<string>();
  for (const lib of steamLibraries()) {
    const root = path.join(lib, 'steamapps', 'workshop', 'content', STELLARIS_APPID); let list: string[] = [];
    try { list = fs.readdirSync(root); } catch { continue; }
    for (const id of list) {
      if (!/^\d{1,20}$/.test(id) || seen.has(id)) continue;
      const dir = path.join(root, id, ...MOD_ADDON_DIR.split('/'));
      try { if (!fs.statSync(path.join(dir, ADDON_MANIFEST)).isFile()) continue; out.push({ itemId: id, dir, mtime: fs.statSync(path.join(root, id)).mtimeMs }); seen.add(id); } catch { /* 애드온 아님 */ }
    }
  }
  return out;
}
const installedDir = (itemId: string) => path.join(addonsDir(), `ws-${itemId}`);
const readManifest = (dir: string): string | null => { try { const f = path.join(dir, ADDON_MANIFEST); if (fs.statSync(f).size > WS_LIMITS.maxManifest) return null; return fs.readFileSync(f, 'utf8').replace(/^﻿/, ''); } catch { return null; } };

/** 한 번 훑기(앱 시작·애드온 화면 열 때). 알림만 — 자동 설치·활성 없음. */
export function scanWorkshop(today = new Date().toISOString().slice(0, 10)): ReturnType<typeof reconcile> & { inGame: string[] } {
  const idx = loadIdx(), found = findItems(), entries = addonEntries(), inGame: string[] = [];
  const installed: Record<string, { manifest: PackManifest; source: 'local' | 'workshop'; itemId?: string }> = {};
  for (const e of entries) { if (e.source !== 'user') continue; const ws = /^ws-(\d+)$/.exec(e.origin)?.[1]; const raw = readManifest(path.join(addonsDir(), e.origin)); const p = raw ? packOf(raw).pack : null; if (p) installed[p.id] = { manifest: p, source: ws ? 'workshop' : 'local', ...(ws ? { itemId: ws } : {}) }; }
  const scanned: Inspect[] = [];
  for (const f of found) {
    const raw = readManifest(f.dir); if (raw === null) { scanned.push({ kind: 'invalid', itemId: f.itemId, errors: [L('addon.json 이 너무 크거나 읽을 수 없습니다.', 'addon.json is too large or unreadable.')] }); continue; }
    const { pack, warnings } = packOf(raw); if (!pack) { scanned.push({ kind: 'invalid', itemId: f.itemId, errors: warnings.slice(0, 3) }); continue; }
    if (entries.some((e) => e.source === 'mod' && e.id === pack.id)) { inGame.push(f.itemId); continue; } // 게임에서 모드로 켜져 있어 이미 앱이 읽는 중
    const ls = listAddonFiles(f.dir);
    if (ls.bad.length || ls.tooBig) { scanned.push({ kind: 'invalid', itemId: f.itemId, errors: ls.bad.length ? [L(`허용되지 않는 파일: ${ls.bad.slice(0, 3).join(', ')}`, `Disallowed files: ${ls.bad.slice(0, 3).join(', ')}`)] : [L('파일이 너무 크거나 많습니다.', 'Too many or too large files.')] }); continue; }
    scanned.push({ kind: 'addon', itemId: f.itemId, manifest: pack, files: ls.files.map((x) => ({ path: x.rel, bytes: x.bytes })) });
  }
  const r = reconcile(idx, scanned, found.map((f) => f.itemId), installed, today, Object.fromEntries(found.map((f) => [f.itemId, f.mtime])));
  for (const id of inGame) delete idx.items[id];
  saveIdx();
  const notes = scanNotice(r); if (notes.length) ctx.notify({ kind: 'info', title: L('창작마당 애드온', 'Workshop add-ons'), body: notes.join(' '), action: L('설정', 'Settings') });
  logDiagnostic('info', 'workshop.scan', { found: found.length, newFound: r.newFound.length, updates: r.updates.length, gone: r.gone.length, invalid: r.invalid.length, inGame: inGame.length });
  return { ...r, inGame };
}
/** 설치·업데이트: 데이터 파일만 앱 애드온 폴더로 복사. 처음 설치면 꺼진 채로(47), 업데이트면 켜짐 상태를 그대로 둔다. */
export function installItem(itemId: string): { ok: boolean; error?: string } {
  const idx = loadIdx(), w = idx.items[itemId]; if (!w || w.status === 'gone' || w.status === 'invalid') return { ok: false, error: L('설치할 수 없는 항목입니다.', 'This item cannot be installed.') };
  const src = findItems().find((f) => f.itemId === itemId); if (!src) return { ok: false, error: L('구독 폴더를 찾을 수 없습니다.', 'The subscription folder was not found.') };
  const ls = listAddonFiles(src.dir); if (ls.bad.length || ls.tooBig) return { ok: false, error: L('허용되지 않는 파일이 있어 설치하지 않았습니다.', 'Not installed: it contains disallowed files.') };
  const dest = installedDir(itemId), tmp = dest + '.tmp-' + process.pid, firstTime = w.status !== 'installed';
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const f of ls.files) { const to = path.join(tmp, ...f.rel.split('/')); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(src.dir, ...f.rel.split('/')), to); }
    fs.rmSync(dest, { recursive: true, force: true }); fs.renameSync(tmp, dest); // 앱 데이터 폴더만 바꾼다(구독 폴더는 읽기만)
  } catch (e) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 무시 */ } return { ok: false, error: (e as Error).message }; }
  if (firstTime && !settings.addons.disabled.includes(w.packId)) { settings.addons = { ...settings.addons, disabled: [...settings.addons.disabled, w.packId] }; saveSettings(); }
  markInstalled(idx, itemId, w.version); saveIdx(); reloadAddons();
  logDiagnostic('info', 'workshop.install', { files: ls.files.length, update: !firstTime });
  return { ok: true };
}
export function workshopView() {
  const idx = loadIdx();
  return { lastScan: idx.lastScan ?? '', items: Object.values(idx.items).sort((a, b) => a.name.localeCompare(b.name)).map((w) => ({ itemId: w.itemId, packId: w.packId, name: w.name, author: w.author, version: w.version, installedVersion: w.installedVersion ?? '', status: w.status, update: w.status === 'installed' && !!w.installedVersion && w.installedVersion !== w.version, errors: w.errors ?? [] })) };
}
export function registerWorkshop(): void {
  setTimeout(() => { try { scanWorkshop(); } catch (e) { logDiagnostic('warn', 'workshop.scan_failed', { error: (e as Error).message }); } }, 15000); // 앱이 뜬 뒤 한 번(애드온 목록이 먼저 읽히게)
  ipcMain.handle('wsState', () => workshopView());
  ipcMain.handle('wsScan', () => { try { const r = scanWorkshop(); return { ok: true, inGame: r.inGame.length, state: workshopView() }; } catch (e) { return { ok: false, error: (e as Error).message, state: workshopView() }; } });
  ipcMain.handle('wsInstall', (_e, itemId: unknown) => { const r = installItem(String(itemId ?? '')); return { ...r, state: workshopView() }; });
  ipcMain.handle('wsIgnore', (_e, itemId: unknown) => { const ok = markIgnored(loadIdx(), String(itemId ?? '')); saveIdx(); return { ok, state: workshopView() }; });
}
