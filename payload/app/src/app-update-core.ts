// 창작마당 모드로 받는 앱 업데이트(2026-10-18 사용자 요청: 설치기를 매번 다시 받지 않게).
// 모드 폴더의 sllm_app_update/ 에 앱 파일 + manifest.json + manifest.sig(Ed25519) 가 들어 있다.
// 묶음은 개발 PC 의 tools/make-app-update.js 가 만든다(설치기_만들기.bat 마지막 단계). electron 에 의존하지 않는 순수 모듈.
import { createHash, verify as cryptoVerify } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { compareVersions } from './version-check';

export const UPDATE_DIR = 'sllm_app_update';
export const PUBLIC_KEY_FILE = 'update-public-key.pem';
/** 묶음에 들어갈 수 있는 앱 최상위 항목(tools/make-app-update.js 의 TOP 과 같아야 함). 공개 키·설치 기록·runtime 은 절대 바꾸지 않는다. */
export const UPDATE_TOP = ['dist', 'ui', 'native', 'example', 'package.json', 'start_app.bat', 'portrait-library.pak',
  'README_KO.md', 'ALPHA_SETUP_KO.md', 'ALPHA_SETUP_EN.md', 'RELEASE_NOTES_KO.md', 'RELEASE_NOTES_EN.md'];
/** 예전 위치의 DLL. 이 파일이 바뀌면 설치기로만 업데이트한다(예전 앱도 같은 규칙). 2026-11-04부터 이 파일은 고정하고 새 DLL 은 native/bridge/ 로만 배포한다 —
 *  앱 업데이트로 받은 새 DLL 은 게임이 꺼져 있을 때 앱이 게임 폴더에 넣는다(src/game-dll.ts). */
export const DLL_FILE = 'native/command-bridge.dll';

export type ManifestFile = { path: string; size: number; sha256: string };
export type Manifest = { format: 1; app: 'sllm'; version: string; created: string; files: ManifestFile[] };

export function sha256File(file: string): string { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

/** 묶음 안 경로가 안전한지: 상대 경로, '/' 구분, .. 없음, 허용한 최상위만. */
export function safeUpdatePath(p: string): boolean {
  if (typeof p !== 'string' || !p || p.length > 260 || /[\\:\0]/.test(p) || p.startsWith('/')) return false;
  const parts = p.split('/');
  if (parts.some((x) => !x || x === '.' || x === '..')) return false;
  return UPDATE_TOP.includes(parts[0]) && (parts.length > 1 || !['dist', 'ui', 'native', 'example'].includes(parts[0]));
}

/** manifest.json 원문과 서명(base64)을 공개 키로 확인하고 내용을 읽는다. 틀리면 null. */
export function readSignedManifest(manifestRaw: Buffer, sigB64: string, publicKeyPem: string): Manifest | null {
  try {
    const sig = Buffer.from(String(sigB64).trim(), 'base64');
    if (!sig.length || !cryptoVerify(null, manifestRaw, publicKeyPem, sig)) return null;
    const m = JSON.parse(manifestRaw.toString('utf8')) as Manifest;
    if (m.format !== 1 || m.app !== 'sllm' || typeof m.version !== 'string' || !Array.isArray(m.files)) return null;
    if (!m.files.every((f) => f && safeUpdatePath(f.path) && /^[0-9a-f]{64}$/.test(f.sha256) && Number.isInteger(f.size) && f.size >= 0)) return null;
    return m;
  } catch { return null; }
}

export type UpdateCheck =
  | { kind: 'none'; reason: string }
  | { kind: 'available'; version: string; bundleDir: string; manifest: Manifest; changed: ManifestFile[] }
  | { kind: 'needs_installer'; version: string; bundleDir: string };

/** 후보 모드 폴더들에서 지금 앱보다 새 버전 묶음을 찾는다(가장 높은 버전). 스팀이 받는 중이라 파일이 덜 맞으면 'none'. */
export function checkForUpdate(appDir: string, appVersion: string, modDirs: string[], publicKeyPem: string): UpdateCheck {
  let best: { m: Manifest; dir: string } | null = null, reason = 'no bundle';
  for (const mod of [...new Set(modDirs.filter(Boolean))]) {
    const dir = path.join(mod, UPDATE_DIR);
    let raw: Buffer, sig: string;
    try { raw = fs.readFileSync(path.join(dir, 'manifest.json')); sig = fs.readFileSync(path.join(dir, 'manifest.sig'), 'utf8'); } catch { continue; }
    const m = readSignedManifest(raw, sig, publicKeyPem);
    if (!m) { reason = 'bad signature'; continue; }
    if ((compareVersions(m.version, appVersion) ?? 0) <= 0) { if (reason !== 'bad signature') reason = 'not newer'; continue; }
    if (!best || (compareVersions(m.version, best.m.version) ?? 0) > 0) best = { m, dir };
  }
  if (!best) return { kind: 'none', reason };
  const { m, dir } = best;
  for (const f of m.files) { // 묶음이 온전한지(스팀 다운로드가 덜 끝났거나 바뀐 파일)
    const src = path.join(dir, ...f.path.split('/'));
    try { if (fs.statSync(src).size !== f.size || sha256File(src) !== f.sha256) return { kind: 'none', reason: 'incomplete ' + f.path }; }
    catch { return { kind: 'none', reason: 'missing ' + f.path }; }
  }
  const changed = m.files.filter((f) => { const dst = path.join(appDir, ...f.path.split('/')); try { return sha256File(dst) !== f.sha256; } catch { return true; } });
  if (changed.some((f) => f.path === DLL_FILE)) return { kind: 'needs_installer', version: m.version, bundleDir: dir };
  return { kind: 'available', version: m.version, bundleDir: dir, manifest: m, changed };
}

/** 바뀐 파일만 교체한다. 기존 파일은 backupDir 에 두고, 하나라도 실패하면 모두 되돌린 뒤 오류를 던진다. */
export function applyUpdate(appDir: string, bundleDir: string, changed: ManifestFile[], backupDir: string): void {
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.mkdirSync(backupDir, { recursive: true });
  const done: Array<{ dst: string; bak: string | null }> = [];
  try {
    for (const f of changed) {
      if (!safeUpdatePath(f.path)) throw new Error('bad path ' + f.path);
      const parts = f.path.split('/'), src = path.join(bundleDir, ...parts), dst = path.join(appDir, ...parts), tmp = dst + '.sllm-new';
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, tmp);
      if (sha256File(tmp) !== f.sha256) { fs.rmSync(tmp, { force: true }); throw new Error('hash mismatch ' + f.path); }
      let bak: string | null = null;
      if (fs.existsSync(dst)) { bak = path.join(backupDir, ...parts); fs.mkdirSync(path.dirname(bak), { recursive: true }); fs.copyFileSync(dst, bak); }
      done.push({ dst, bak });
      fs.renameSync(tmp, dst);
    }
  } catch (e) {
    for (const d of done.reverse()) { try { if (d.bak) fs.copyFileSync(d.bak, d.dst); else fs.rmSync(d.dst, { force: true }); } catch { /* 되돌리기 실패는 아래 오류로 알린다 */ } }
    for (const f of changed) { try { fs.rmSync(path.join(appDir, ...f.path.split('/')) + '.sllm-new', { force: true }); } catch { /* 없음 */ } }
    throw e;
  }
}

// ---- 첫 설치(2026-10-21 사용자 결정 A안): 설치기에는 runtime·DLL·이 도우미만 넣고, 앱 파일은 처음 켤 때 창작마당 묶음에서 채운다. ----
/** 처음 채우기가 끝났는지: 전체 앱의 시작 파일이 있으면 끝난 것(설치기는 덮어쓰기 설치 때 이 파일을 지워 다시 채우게 한다). */
export const FULL_APP_MARKER = 'dist/main.js';
export type InstallCheck =
  | { kind: 'ready'; version: string; bundleDir: string; changed: ManifestFile[] }
  | { kind: 'missing' }                                 // 구독본·업로드 원본 어디에도 묶음이 없음
  | { kind: 'downloading'; detail: string }             // 서명은 맞는데 파일이 덜 받아졌거나 달라짐(스팀이 받는 중)
  | { kind: 'bad_signature' }                           // 서명이 맞는 묶음이 하나도 없음
  | { kind: 'needs_installer'; version: string };       // 묶음의 게임 연결 DLL 이 설치기와 다름 → 그 버전 설치기 필요

/** 처음 채울 묶음 찾기: 서명이 맞는 것 중 가장 높은 버전. 업데이트와 달리 같은 버전도 받는다.
 *  2026-11-08 사용자: 설치기는 창작마당 버전과 상관없이 설치돼야 한다(개발판 번호가 창작마당보다 훨씬 높아도 막지 않음) → 설치기 버전보다 낮다는 이유로 거르지 않는다.
 *  낮은 버전을 받으면 앱 파일이 그 버전으로 채워지고, 나중에 창작마당이 올라가면 앱 안 업데이트로 따라간다. */
export function findInstallBundle(appDir: string, modDirs: string[], publicKeyPem: string): InstallCheck {
  let best: { m: Manifest; dir: string } | null = null, sawBad = false;
  for (const mod of [...new Set(modDirs.filter(Boolean))]) {
    const dir = path.join(mod, UPDATE_DIR);
    let raw: Buffer, sig: string;
    try { raw = fs.readFileSync(path.join(dir, 'manifest.json')); sig = fs.readFileSync(path.join(dir, 'manifest.sig'), 'utf8'); } catch { continue; }
    const m = readSignedManifest(raw, sig, publicKeyPem);
    if (!m) { sawBad = true; continue; }
    if (!m.files.some((f) => f.path === FULL_APP_MARKER)) { sawBad = true; continue; }
    if (!best || (compareVersions(m.version, best.m.version) ?? 0) > 0) best = { m, dir };
  }
  if (!best) return sawBad ? { kind: 'bad_signature' } : { kind: 'missing' };
  const { m, dir } = best;
  for (const f of m.files) {
    const src = path.join(dir, ...f.path.split('/'));
    try { if (fs.statSync(src).size !== f.size || sha256File(src) !== f.sha256) return { kind: 'downloading', detail: f.path }; }
    catch { return { kind: 'downloading', detail: f.path }; }
  }
  const changed = m.files.filter((f) => { const dst = path.join(appDir, ...f.path.split('/')); try { return sha256File(dst) !== f.sha256; } catch { return true; } });
  // 첫 설치에서도 DLL 은 설치기가 게임 폴더에 넣은 것과 같아야 한다(앱 안에서 DLL 을 바꾸지 않는 규칙).
  if (changed.some((f) => f.path === DLL_FILE)) return { kind: 'needs_installer', version: m.version };
  return { kind: 'ready', version: m.version, bundleDir: dir, changed };
}
