// 창작마당 애드온 자동 감지(사용자 요청 2026-10-23, 47 확장). 2026-10-23 Claude 사전 설계.
// 방식: SLLM 앱은 스팀 앱이 아니라 스팀 API 로 구독 목록을 받을 수 없다 → 애드온도 스텔라리스 창작마당(앱 281990) 항목으로 올리고,
//   앱이 구독 폴더 steamapps/workshop/content/281990/<항목번호>/ 를 **읽기만** 해서 `sllm_addon/pack.json` 이 있는 항목을 찾는다.
//   (규칙: 창작마당 구독 폴더는 절대 수정하지 않는다 — 여기 함수는 읽은 목록만 받는다.)
// 47 규칙 그대로: 발견 ≠ 설치 ≠ 활성. 설치하면 앱 애드온 보관소로 **복사**(스팀이 몰래 갱신해도 켜진 내용이 바뀌지 않게) →
//   스팀이 새 버전을 받으면 「업데이트 있음」 + 변경 비교 → 승인하면 다시 복사. 구독 해제(폴더 사라짐)는 자동 제거하지 않고 알린다.
// 다른 사람이 만든 파일이므로 validatePack(실행 파일·팩 밖 경로·크기) 을 반드시 거친다. LLM 호출 없음.
// 스텔라리스 런처에는 이 항목이 「모드」로 보이지만 게임 파일이 없어 켜도 게임에 영향이 없다(설명문에 안내).
import { L } from './i18n-pick';
import { validatePack, diffPack, MANIFEST_DRAFT, type PackManifest } from './addon-packs';

export const STELLARIS_APPID = '281990';
export const ADDON_DIR = 'sllm_addon';
export const ADDON_MANIFEST = `${ADDON_DIR}/${MANIFEST_DRAFT.file}`;

/** libraryfolders.vdf 에서 스텔라리스가 깔린 스팀 라이브러리 경로들(여러 드라이브 지원). */
export function parseLibraryFolders(vdf: string): string[] {
  const out: string[] = []; const text = String(vdf ?? '');
  const blocks = text.split(/"\d+"\s*\{/).slice(1);
  for (const b of blocks) {
    const p = /"path"\s*"((?:[^"\\]|\\.)*)"/.exec(b)?.[1]; if (!p) continue;
    const apps = /"apps"\s*\{([^}]*)\}/.exec(b)?.[1] ?? '';
    if (new RegExp(`"${STELLARIS_APPID}"`).test(apps)) out.push(p.replace(/\\\\/g, '\\'));
  }
  return [...new Set(out)];
}
export const workshopContentDir = (libraryRoot: string): string => `${libraryRoot.replace(/[\\/]+$/, '')}\\steamapps\\workshop\\content\\${STELLARIS_APPID}`;

/** 한 구독 항목을 읽은 결과(앱이 폴더를 읽어 넘겨준다). files 는 항목 폴더 기준 상대 경로. */
export interface ScannedItem { itemId: string; files: { path: string; bytes: number }[]; manifestText?: string; folderMtime?: number }
export type Inspect =
  | { kind: 'not_addon' }
  | { kind: 'zipped'; itemId: string }
  | { kind: 'invalid'; itemId: string; errors: string[] }
  | { kind: 'addon'; itemId: string; manifest: PackManifest; files: { path: string; bytes: number }[] };
/** 애드온인지 판별(마커 = sllm_addon/pack.json). 팩 파일은 sllm_addon/ 아래만 본다(그 밖의 모드 파일은 무시). */
export function inspectItem(it: ScannedItem): Inspect {
  if (!/^\d{1,20}$/.test(it.itemId)) return { kind: 'not_addon' };
  const norm = it.files.map((f) => ({ ...f, path: f.path.replace(/\\/g, '/') }));
  if (!norm.some((f) => f.path === ADDON_MANIFEST)) {
    // 옛 창작마당 항목은 zip 하나로 내려온다 → 압축 안에 마커가 있는지는 가져오기 단계에서 확인.
    return norm.length > 0 && norm.every((f) => /\.zip$/i.test(f.path) || /^descriptor\.mod$/i.test(f.path)) && norm.some((f) => /\.zip$/i.test(f.path)) ? { kind: 'zipped', itemId: it.itemId } : { kind: 'not_addon' };
  }
  let m: PackManifest;
  try { m = JSON.parse(String(it.manifestText ?? '').replace(/^﻿/, '')); } catch { return { kind: 'invalid', itemId: it.itemId, errors: [L('팩 정보 파일을 읽을 수 없습니다.', 'Cannot read the pack manifest.')] }; }
  const files = norm.filter((f) => f.path.startsWith(ADDON_DIR + '/') && f.path !== ADDON_MANIFEST).map((f) => ({ path: f.path.slice(ADDON_DIR.length + 1), bytes: f.bytes }));
  const errors = validatePack(m, files);
  return errors.length ? { kind: 'invalid', itemId: it.itemId, errors } : { kind: 'addon', itemId: it.itemId, manifest: m, files };
}

/** 창작마당 감지 장부: 항목번호 → 마지막으로 본 팩·버전·상태. */
export interface WsSeen { itemId: string; packId: string; version: string; name: string; author: string; status: 'found' | 'installed' | 'ignored' | 'gone' | 'invalid'; firstSeen: string; lastSeen: string; installedVersion?: string; ignoredVersion?: string; errors?: string[] }
export interface WorkshopIndex { items: Record<string, WsSeen>; lastScan?: string; folderMtimes: Record<string, number> }
export const emptyWsIndex = (): WorkshopIndex => ({ items: {}, folderMtimes: {} });

/** 다시 훑을 필요가 있는가: 처음이거나 폴더 수정 시각이 바뀐 항목만(앱 시작·독서실/애드온 화면 열 때). */
export function needsRescan(idx: WorkshopIndex, folders: { itemId: string; mtime: number }[]): string[] {
  return folders.filter((f) => idx.folderMtimes[f.itemId] !== f.mtime).map((f) => f.itemId);
}

export interface ScanResult { newFound: WsSeen[]; updates: { seen: WsSeen; newVersion: string; diff?: ReturnType<typeof diffPack> }[]; gone: WsSeen[]; invalid: WsSeen[]; zipped: string[]; idConflicts: { itemId: string; packId: string }[] }
/** 한 번의 훑기 결과를 장부에 반영(47 원칙: 알림만, 자동 설치·활성 없음).
 *  - 새 애드온 → found(알림).  - 설치된 것의 버전이 바뀜 → 업데이트 알림 + 변경 비교(설치본과).
 *  - 무시한 항목은 같은 버전이면 다시 알리지 않는다.  - 폴더가 사라짐(구독 해제) → gone 알림, 설치본은 그대로.
 *  - 다른 출처(직접 가져온 팩)와 팩 ID 가 겹치면 덮어쓰지 않고 충돌로 알린다. */
export function reconcile(idx: WorkshopIndex, scanned: Inspect[], presentItemIds: string[], installed: Record<string, { manifest: PackManifest; source: 'local' | 'workshop'; itemId?: string }>, today: string, mtimes: Record<string, number> = {}): ScanResult {
  const r: ScanResult = { newFound: [], updates: [], gone: [], invalid: [], zipped: [], idConflicts: [] };
  for (const s of scanned) {
    if (s.kind === 'not_addon') continue;
    if (s.kind === 'zipped') { r.zipped.push(s.itemId); continue; }
    const prev = idx.items[s.itemId];
    if (s.kind === 'invalid') {
      const w: WsSeen = { ...(prev ?? { itemId: s.itemId, packId: '?', version: '?', name: '?', author: '?', firstSeen: today }), status: 'invalid', lastSeen: today, errors: s.errors };
      idx.items[s.itemId] = w; r.invalid.push(w); continue;
    }
    const m = s.manifest; const inst = installed[m.id];
    if (inst && (inst.source !== 'workshop' || inst.itemId !== s.itemId)) r.idConflicts.push({ itemId: s.itemId, packId: m.id });
    if (!prev || prev.status === 'gone' || prev.status === 'invalid') {
      const w: WsSeen = { itemId: s.itemId, packId: m.id, version: m.version, name: m.name, author: m.author, status: prev?.installedVersion ? 'installed' : 'found', firstSeen: prev?.firstSeen ?? today, lastSeen: today, ...(prev?.installedVersion ? { installedVersion: prev.installedVersion } : {}) };
      idx.items[s.itemId] = w; if (w.status === 'found') r.newFound.push(w);
      else if (w.installedVersion !== m.version && inst?.source === 'workshop') r.updates.push({ seen: w, newVersion: m.version, diff: diffPack(inst.manifest, m) });
      continue;
    }
    const changed = prev.version !== m.version; prev.lastSeen = today; prev.name = m.name; prev.author = m.author; prev.version = m.version; delete prev.errors;
    if (prev.status === 'installed' && prev.installedVersion !== m.version && inst?.source === 'workshop' && inst.itemId === s.itemId) r.updates.push({ seen: prev, newVersion: m.version, diff: diffPack(inst.manifest, m) });
    if (prev.status === 'ignored' && changed && prev.ignoredVersion !== m.version) { prev.status = 'found'; r.newFound.push(prev); }
  }
  for (const w of Object.values(idx.items)) if (w.status !== 'gone' && !presentItemIds.includes(w.itemId)) { w.status = 'gone'; r.gone.push(w); }
  Object.assign(idx.folderMtimes, mtimes); for (const k of Object.keys(idx.folderMtimes)) if (!presentItemIds.includes(k)) delete idx.folderMtimes[k]; idx.lastScan = today;
  return r;
}
/** 사용자 선택. 설치는 앱 보관소로 복사한 뒤 호출(복사 자체는 앱 쪽 파일 작업). */
export function markInstalled(idx: WorkshopIndex, itemId: string, version: string): boolean { const w = idx.items[itemId]; if (!w || w.status === 'gone' || w.status === 'invalid') return false; w.status = 'installed'; w.installedVersion = version; return true; }
export function markIgnored(idx: WorkshopIndex, itemId: string): boolean { const w = idx.items[itemId]; if (!w || w.status !== 'found') return false; w.status = 'ignored'; w.ignoredVersion = w.version; return true; }

/** 알림 문구(정형, 한/영). */
export function scanNotice(r: ScanResult): string[] {
  const out: string[] = [];
  if (r.newFound.length) out.push(L(`창작마당에서 새 애드온 ${r.newFound.length}개를 찾았습니다. 검토 후 설치할 수 있습니다.`, `Found ${r.newFound.length} new add-on(s) from the Workshop. Review them before installing.`));
  if (r.updates.length) out.push(L(`설치한 애드온 ${r.updates.length}개에 업데이트가 있습니다. 바뀐 점을 확인한 뒤 적용하세요.`, `${r.updates.length} installed add-on(s) have updates. Check the changes before applying.`));
  if (r.gone.length) out.push(L(`구독이 해제된 애드온 ${r.gone.length}개가 있습니다. 설치본은 그대로 남아 있습니다.`, `${r.gone.length} add-on(s) were unsubscribed. Installed copies are kept.`));
  if (r.invalid.length) out.push(L(`형식이 맞지 않거나 허용되지 않는 파일이 든 항목 ${r.invalid.length}개는 건너뛰었습니다.`, `Skipped ${r.invalid.length} item(s) with an invalid format or disallowed files.`));
  if (r.idConflicts.length) out.push(L(`이미 있는 팩과 ID 가 같은 항목 ${r.idConflicts.length}개 — 덮어쓰지 않았습니다.`, `${r.idConflicts.length} item(s) share an ID with an existing pack — not overwritten.`));
  return out;
}

/** 내 팩을 창작마당에 올릴 폴더 구성(사용자가 런처로 업로드). descriptor.mod + sllm_addon/… */
export function workshopUploadPlan(m: PackManifest, gameVersion: string, files: { from: string; to: string }[]): { descriptor: string; layout: { from: string; to: string }[]; description: { ko: string; en: string } } {
  const esc = (s: string) => String(s).replace(/["\r\n]/g, ' ');
  const descriptor = `version="${esc(m.version)}"\ntags={\n\t"Utilities"\n}\nname="SLLM Add-on: ${esc(m.name)}"\nsupported_version="${esc(gameVersion)}"\n`;
  return {
    descriptor,
    layout: [{ from: '(pack.json)', to: ADDON_MANIFEST }, ...files.map((f) => ({ from: f.from, to: `${ADDON_DIR}/${f.to}` }))],
    description: {
      ko: `SteLLaris Missive(SLLM) 앱용 ${m.kind === 'appearance' ? '외형' : '세계관'} 애드온입니다. 구독하면 SLLM 앱이 자동으로 찾아 줍니다. 게임 파일이 없어 런처에서 켜도 게임에는 영향이 없습니다.`,
      en: `A${m.kind === 'appearance' ? 'n appearance' : ' lore'} add-on for the SteLLaris Missive (SLLM) app. Subscribe and the SLLM app will find it automatically. It contains no game files, so enabling it in the launcher does not affect the game.`,
    },
  };
}
