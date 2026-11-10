// A-00b 4번: 사용자 그림(배경·초상화)과 깃발 IPC(getImageState·pickImage·dropImage·clearImage·setImageOpts·openImagesFolder·flagFor).
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). imageState()는 다른 기능도 화면 갱신에 쓴다.
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { IMAGE_EXTS, MAX_IMAGE_BYTES, safeImageName, isSafeStoredName, isImageKey, clampOpacity } from '../images';
import { CLASS_KEYS, defaultPortraitName } from '../speciesClass';
import { settings, saveSettings } from '../app/settings';
import { ctx } from '../app/ctx';
import { addonImages } from './addons-app';
import { pick } from './settings-ui';
import { peopleOf } from './people-app';

export function imagesDir(): string { return path.join(app.getPath('userData'), 'sllm_images'); }
export function imageUrl(f: string): string { return pathToFileURL(path.join(imagesDir(), f)).href; }
export function imageState() {
  const ok = (f: string | null | undefined) => (f && isSafeStoredName(f) && fs.existsSync(path.join(imagesDir(), f)) ? f : null);
  // 켜진 애드온 그림을 먼저 깔고, 사용자가 설정에서 넣은 그림이 그 위를 덮는다(사용자 우선, 2026-10-16).
  const images: Record<string, string> = { ...addonImages() };
  const own: Record<string, string> = {};
  for (const [k, f] of Object.entries(settings.images)) if (ok(f)) { images[k] = imageUrl(f); own[k] = images[k]; }
  const bg = ok(settings.bgImage);
  // 모드 폴더(gfx/sllm_portraits)에 들어 있는 종족 계열별 기본 초상화
  const defaults: Record<string, string> = {};
  for (const k of CLASS_KEYS) {
    const n = k && defaultPortraitName(k);
    if (n) { const f = path.join(ctx.MOD_DIR, 'gfx', 'sllm_portraits', n); if (fs.existsSync(f)) defaults[k] = pathToFileURL(f).href; }
  }
  // 모드 폴더(gfx/sllm_planetbg)의 행성 종류별 배경 사진: pc<번호>.jpg
  const planetBgs: Record<number, string> = {};
  for (let n = 1; n <= 40; n++) { const f = path.join(ctx.MOD_DIR, 'gfx', 'sllm_planetbg', `pc${n}.jpg`); if (fs.existsSync(f)) planetBgs[n] = pathToFileURL(f).href; }
  // 지도자 개인 초상화(2026-10-24): 지금 세이브의 것만 인물 이름(name:<이름>)으로도 깐다 — 화면들은 인물 이름을 시드로 그림을 고르므로(ui/portrait-variants.js) 모든 장면에 그대로 쓰인다.
  const sid = ctx.curSaveId || '';
  if (sid) {
    const live = new Map(peopleOf(sid).map((p) => [String(p.lid), p.name] as const));
    for (const k of Object.keys(own)) {
      const m = /^person:(\d+):(?:(\d+)|n:(.+))$/.exec(k); if (!m || m[1] !== sid) continue;
      const name = m[3] ?? live.get(m[2]) ?? settings.imageLabels[k];
      if (name) images['name:' + name] = images[k];
    }
  }
  const labels: Record<string, string> = {};
  for (const k of Object.keys(images)) if (settings.imageLabels[k]) labels[k] = settings.imageLabels[k];
  return { bg: bg ? imageUrl(bg) : null, bgOpacity: settings.bgOpacity, images, own: Object.keys(own), labels, scope: settings.imageScope, defaults, planetBgs, save: ctx.curSaveId };
}

// 사용자가 고르는 그림(배경·초상화)
// 고른 그림 파일을 앱 폴더로 복사해 배경이나 초상화로 적용한다. 고르기와 끌어놓기가 함께 쓴다.
export const applyImageFile = (src: string, target: { kind: 'bg' } | { kind: 'portrait'; key: string; label?: string }) => {
  try {
    if (!target || (target.kind !== 'bg' && !(target.kind === 'portrait' && isImageKey(target.key)))) return { ...imageState(), note: pick('적용할 대상을 알 수 없습니다.', 'Unknown target to apply to.') };
    if (typeof src !== 'string' || !fs.existsSync(src) || !fs.statSync(src).isFile()) return { ...imageState(), note: pick('그림 파일을 찾지 못했습니다.', 'Image file not found.') };
    if (fs.statSync(src).size > MAX_IMAGE_BYTES) return { ...imageState(), note: pick('그림이 너무 큽니다(최대 8MB).', 'The image is too large (max 8 MB).') };
    const name = safeImageName(path.basename(src), Date.now());
    if (!name) return { ...imageState(), note: pick('png, jpg, webp, gif 그림만 쓸 수 있습니다.', 'Only png, jpg, webp and gif images can be used.') };
    fs.mkdirSync(imagesDir(), { recursive: true });
    fs.copyFileSync(src, path.join(imagesDir(), name));
    if (target.kind === 'bg') settings.bgImage = name; else { settings.images[target.key] = name; if (typeof target.label === 'string' && target.label.trim()) settings.imageLabels[target.key] = target.label.trim().slice(0, 60); }
    saveSettings();
    return { ...imageState(), note: null };
  } catch (e) { return { ...imageState(), note: pick('그림을 복사하지 못했습니다: ', 'Could not copy the image: ') + (e as Error).message }; }
};

export function registerImages(): void {
  ipcMain.handle('getImageState', async () => imageState());
  ipcMain.handle('pickImage', async (e, target: { kind: 'bg' } | { kind: 'portrait'; key: string }) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? ctx.win!; // 항상 위 창(총독 보고 등)에서 고를 때 대화 상자가 창 뒤로 숨지 않게
    const r = await dialog.showOpenDialog(parent, { title: '그림 고르기', properties: ['openFile'], filters: [{ name: '그림', extensions: IMAGE_EXTS.map((x) => x.slice(1)) }] });
    if (r.canceled || !r.filePaths[0]) return { ...imageState(), note: null };
    return applyImageFile(r.filePaths[0], target);
  });
  ipcMain.handle('dropImage', async (_e, target: { kind: 'bg' } | { kind: 'portrait'; key: string }, filePath: string) => applyImageFile(filePath, target));
  ipcMain.handle('clearImage', async (_e, target: { kind: 'bg' } | { kind: 'portrait'; key: string }) => {
    if (target && target.kind === 'bg') settings.bgImage = null; else if (target && target.kind === 'portrait' && isImageKey(target.key)) { delete settings.images[target.key]; delete settings.imageLabels[target.key]; }
    saveSettings();
    return imageState();
  });
  ipcMain.handle('setImageOpts', async (_e, o: { bgOpacity?: unknown; scope?: unknown }) => {
    if (o.bgOpacity !== undefined) settings.bgOpacity = clampOpacity(o.bgOpacity);
    if (o.scope === 'country' || o.scope === 'species' || o.scope === 'class') settings.imageScope = o.scope;
    saveSettings();
    return imageState();
  });
  // A-22 연출 슬롯 규격 견본(앱 폴더 example/backgrounds: 자리별 규격 그림 + README_KO.md)
  ipcMain.handle('openSceneExamples', async () => { const d = path.join(app.getAppPath(), 'example', 'backgrounds'); if (!fs.existsSync(d)) return '규격 견본 폴더(example/backgrounds)를 찾지 못했습니다.'; const e = await shell.openPath(d); return e || ''; });
  ipcMain.handle('openImagesFolder', async () => { fs.mkdirSync(imagesDir(), { recursive: true }); const e = await shell.openPath(imagesDir()); return e || '그림 폴더를 열었습니다.'; });
  ipcMain.handle('flagFor', async (_e, idx: unknown) => ctx.flagUrlFor(typeof idx === 'number' ? idx : Number(idx)));
}
