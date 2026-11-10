// 애드온 목록·켜기·순서 IPC(2026-10-16). 규칙과 읽기는 src/addons.ts.
import { app, ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AddonRegistry, sanitizeAddonPrefs, MOD_ADDON_DIR, ADDON_MANIFEST, LanguagePack, type MusicKind, type PlayTrack } from '../addons';
import type { ModResources } from '../mod-resources';
import { settings, saveSettings } from '../app/settings';
import { logDiagnostic } from '../diagnostics';
import { extractPairs } from '../i18n-pairs';

let registry: AddonRegistry | null = null;
export const addonsDir = () => path.join(app.getPath('userData'), 'addons');
export function initAddons(resources: ModResources): AddonRegistry {
  registry = new AddonRegistry(resources, addonsDir, () => path.join(app.getPath('userData'), 'addon_cache'), () => settings.addons);
  return registry;
}
/** 켜진 애드온의 그림(위쪽 우선). 사용자 그림은 imageState 가 그 위에 덮는다. */
export function addonImages(): Record<string, string> { try { return registry?.images() ?? {}; } catch { return {}; } }
/** 켜진 애드온의 국가·군가(종류마다 위쪽 팩 하나, 2026-10-20). 앱 화면에서만 쓴다. */
export function addonMusic(): Record<MusicKind, PlayTrack | null> { try { return registry?.music() ?? { anthem: null, march: null, creed: null }; } catch { return { anthem: null, march: null, creed: null }; } }
/** 켜진 애드온들이 주는 곡 목록(종류별, 애드온 순서). 복무신조 찾기에 쓴다. */
export function addonMusicList(kind: MusicKind): PlayTrack[] { try { return registry?.musicList(kind) ?? []; } catch { return []; } }
/** 호환 해석에 넣을 애드온 자료 */
export function addonCompat(): { sig: string; packs: Array<{ pack: unknown; source: string; base: string }> } {
  if (!registry) return { sig: '', packs: [] };
  try { return { sig: registry.signature(), packs: registry.compatPacks() }; } catch { return { sig: 'error', packs: [] }; }
}
/** 켜진 애드온의 언어 팩. 화면 문구마다 불리므로 3초 동안 기억한다(애드온을 바꾸면 바로 비움). */
let packCache: { at: number; list: LanguagePack[] } = { at: 0, list: [] };
export function addonLanguagePacks(): LanguagePack[] {
  const now = Date.now(); if (now - packCache.at < 3000) return packCache.list;
  let list: LanguagePack[] = []; try { list = registry?.languagePacks() ?? []; } catch { /* 애드온 읽기 실패 → 기본 언어만 */ }
  packCache = { at: now, list }; return list;
}
/** 애드온 목록·켜기가 바뀌면 부른다(화면 언어가 바뀌었을 수 있으니 모든 창에 알림). settings-ui 가 등록. */
const changed: Array<() => void> = [];
export function onAddonsChanged(fn: () => void): void { changed.push(fn); }
function fireChanged(): void { packCache.at = 0; for (const f of changed) { try { f(); } catch { /* 알림 실패는 무시 */ } } }
/** 언어 팩 뼈대: 앱의 한국어 원문 → 영어 번역 표와 패턴을 그대로 담은 애드온 폴더를 만든다(번역자가 값만 바꾸면 됨). */
export function writeLanguageTemplate(outDir: string): { files: number; strings: number; patterns: number } {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'i18n-catalog.js'), 'utf8');
  const [catalog, catPatterns] = new Function(src + ';return [SLLMCatalog, SLLMPatterns];')() as [Record<string, string>, Array<[string, string]>];
  // 카탈로그 밖의 한/영 쌍(L('한국어', 'English'))도 배포된 창·메인 코드에서 모은다(2026-10-18).
  const texts: string[] = [];
  const scan = (dir: string, depth = 0) => { let list: fs.Dirent[] = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of list) { const p = path.join(dir, d.name); if (d.isDirectory() && depth < 3 && d.name !== 'node_modules') scan(p, depth + 1); else if (/\.(html|js)$/.test(d.name) && !/i18n-catalog|selftest/.test(d.name)) { try { texts.push(fs.readFileSync(p, 'utf8')); } catch { /* 건너뜀 */ } } } };
  scan(path.join(__dirname, '..', '..', 'ui')); scan(path.join(__dirname, '..'));
  const pairs = extractPairs(texts), catalog2: Record<string, string> = { ...catalog };
  for (const [k, v] of Object.entries(pairs.strings)) if (!(k in catalog2)) catalog2[k] = v;
  const patterns = [...catPatterns, ...pairs.patterns.filter((p) => !catPatterns.some((c) => c[0] === p[0]))];
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = {
    version: 1, id: 'language_xx', name: 'Language pack (template)', author: '', addonVersion: '1',
    description: 'Copy this folder into the SLLM addons folder (or a Stellaris mod at sllm/addon/) and translate the values in strings.json.',
    language: { code: 'xx', name: 'My language', gameLanguage: 'l_simp_chinese', system: ['zh'], aiLanguage: 'Simplified Chinese', strings: 'strings.json', patterns: 'patterns.json' },
  };
  fs.writeFileSync(path.join(outDir, ADDON_MANIFEST), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'strings.json'), JSON.stringify(catalog2, null, 1) + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'patterns.json'), JSON.stringify(patterns, null, 1) + '\n', 'utf8');
  for (const n of ['LANGUAGE_PACK_KO.md', 'LANGUAGE_PACK_EN.md']) { try { fs.copyFileSync(path.join(__dirname, '..', '..', 'ui', n), path.join(outDir, n)); } catch { /* 안내 문서가 없으면 건너뜀 */ } }
  return { files: 5, strings: Object.keys(catalog2).length, patterns: patterns.length };
}
function view() {
  const list = registry?.list() ?? [];
  return {
    folder: addonsDir(), modPath: `${MOD_ADDON_DIR}/${ADDON_MANIFEST}`,
    items: list.map((a, i) => ({
      id: a.id, name: a.name, author: a.author, description: a.description, version: a.addonVersion, source: a.source, origin: a.origin, rank: i + 1,
      enabled: !settings.addons.disabled.includes(a.id) && !a.id.startsWith('invalid_'), invalid: a.id.startsWith('invalid_'),
      theme: a.theme, images: Object.keys(a.images).length,
      ethics: Object.keys((a.compatibility?.ethics as object) ?? {}).length, events: Object.keys((a.compatibility?.events as object) ?? {}).length,
      empires: Object.keys((a.compatibility?.empires as object) ?? {}).length, countryTypes: Object.keys((a.compatibility?.countryTypes as object) ?? {}).length,
      language: a.language ? { code: a.language.code, name: a.language.name, strings: Object.keys(a.language.strings).length } : null,
      warnings: a.warnings.slice(0, 12),
    })),
  };
}
/** 창작마당 감지(workshop-app)·서재(lore-app)용: 지금 읽힌 애드온 목록과 다시 읽기(2026-10-23). */
export const addonEntries = () => { try { return registry?.list() ?? []; } catch { return []; } };
export function reloadAddons(): void { registry?.invalidate(); registry?.refresh(true); fireChanged(); }
export function registerAddons(): void {
  ipcMain.handle('addonsList', async () => view());
  ipcMain.handle('addonsSet', async (_e, v: unknown) => {
    const next = sanitizeAddonPrefs(v);
    settings.addons = next; saveSettings();
    logDiagnostic('info', 'addons.set', { order: next.order.length, disabled: next.disabled.length });
    fireChanged(); return view();
  });
  ipcMain.handle('addonsReload', async () => { registry?.invalidate(); registry?.refresh(true); fireChanged(); return view(); });
  ipcMain.handle('addonsLanguageTemplate', async () => {
    const out = path.join(app.getPath('documents'), 'SLLM_language_pack_template');
    try { const r = writeLanguageTemplate(out); void shell.openPath(out); return { ok: true, folder: out, ...r }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('addonsOpenFolder', async () => {
    try { fs.mkdirSync(addonsDir(), { recursive: true }); } catch { /* 열기에서 알림 */ }
    const err = await shell.openPath(addonsDir()); return err || addonsDir();
  });
}
