// A-00b 2번: 설정(앱 폴더의 sllm_settings.json)과 개인 API 키. 2026-10-15 main.ts 234~385줄에서 옮김(동작 변경 없음).
// 바뀐 점 두 가지: settings 객체를 통째로 바꿔 끼우지 않고 내용만 채운다(Object.assign, 다른 모듈이 같은 객체를 보게),
// Player2 ID 적용·깃발 경로 설정은 main.ts loadSettings()에 남겼다.
import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { registerDiagnosticSecret, logDiagnostic } from '../diagnostics';
import { readJsonObject, writeJsonAtomic, cleanKeyMap } from '../key-file';
import { LanguagePreference, languagePreference, normalizeAiLanguage } from '../language';
import { MediaPrefs, sanitizeMedia } from '../media-custom';
import { radioStation } from '../radio';
import { AiConn, PRESETS, Provider, normalizeBase } from '../aiclient';
import { clampSpeechTurns } from '../speech';
import { PAPERS } from '../galnews';
import { sanitizeImageMap, isImageKey, isSafeStoredName, clampOpacity, ImageScope } from '../images';
import { sanitizeHotkey, clampFade } from '../overlayPrefs';
import { ThemeName, CustomColors, sanitizeTheme, sanitizeCustom } from '../theme';
import { AddonPrefs, sanitizeAddonPrefs } from '../addons';
import { layoutScale, Frac, DockMode, LauncherCorner } from '../gameWindow';
import { ctx } from './ctx';

// ---- 설정(앱 폴더의 sllm_settings.json). 실험 기능은 기본으로 꺼 둔다.
/** 의회 발언권 횟수: 0 이면 자동(참석 제국 수), 아니면 1~200. */
export const clampTurns = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(100, n) : 20; };
export const COUNCIL_MAX_SPEAKERS = 8; // 한 번의 발언에 답하는 최대 제국 수(ui/council.html MAX_SPEAKERS 와 같게)
/** 찬반 팀당 발언 수 1~4(양쪽 합쳐 한 번에 답하는 최대 8개국을 넘지 않게). 이상하면 2. */
export const clampTeamTurns = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(4, n) : 2; };
export const clampSlots = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(40, n) : 0; }; // 발언권 추첨 횟수. 같은 나라가 여러 번 뽑힐 수 있어 답하는 나라 수(8)보다 크게 둔다
export type DevCouncilVote = 'normal' | 'for' | 'against';
export const devVoteMode = (v: unknown): DevCouncilVote => v === 'for' || v === 'against' ? v : 'normal';
export const devVotePercent = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.max(80, Math.min(100, Math.round(n))) : 85; };
export interface Settings {
  devCouncilVote: DevCouncilVote;
  devCouncilPercent: number;
  devCouncilNoAi: boolean;
  aiLanguage: string;
  player2ClientId: string;
  language: LanguagePreference;
  userDir: string | null;
  modDir: string | null;
  setupDone: boolean;
  mediaPrefs: MediaPrefs;
  /** 의회 발언권(2026-10-29): teams = 찬성 2·반대 2 고정(팀 안은 가중치 비율, 기본) · weighted = 의석 비율 추첨 · equal = 한 번씩 */ councilMode: 'teams' | 'weighted' | 'equal';
  /** 2 이상이면 찬반 팀 기본값으로 한 번 옮긴 뒤 */ councilModeV?: number;
  /** 찬반 팀 방식에서 한 발언에 답하는 팀당 제국 수(1~4, 기본 2 — 플레이어가 정함, 2026-10-29) */ councilTeamTurns: number;
  councilSlots: number;
  councilTurns: number;
  speechTurns: number;
  radioStation: string;
  devMode: boolean;
  mailEnabled: boolean;
  /** 감정 기억: 원한·야망이 아주 강한 AI 가 실제로 선전포고(알파 11, 기본 꺼짐) */
  emotionWar?: boolean;
  /** 아이 수 제한 풀기(배우자마다 2명·모두 8명 상한을 없앰, 기본 꺼짐) */
  childLimitOff?: boolean;
  /** 국정감사(12년마다 의회 질의, 하드코어 — 2026-11-03, 기본 꺼짐) */
  auditOn?: boolean;
  /** 불신임(지지율이 석 달 기준 아래면 의회가 불신임안, 하드코어 — 2026-11-03, 기본 꺼짐) */
  noconfOn?: boolean;
  /** 게임을 켜면 SLLM 도 자동으로 켜기(Windows 시작 프로그램에 작은 감시기 등록, 기본 꺼짐 — 2026-10-30) */
  gameWatcher?: boolean;
  /** 가족 사건 알림(민간인 자녀의 삶): 모두 / 큰 사건만 / 끄기(신문에만) — 2026-10-28 */
  familyNotify?: 'all' | 'big' | 'off';
  keepOnTop: boolean;
  autoHide: boolean;
  dock: DockMode;
  dockPos: Frac | null;
  uiScale: number;
  autoScale: boolean;
  theme: ThemeName;
  custom: CustomColors;
  bgImage: string | null;
  bgOpacity: number;
  images: Record<string, string>;
  imageLabels: Record<string, string>;
  /** 애드온 순서(위쪽 우선)와 꺼 둔 것 */
  addons: AddonPrefs;
  imageScope: ImageScope;
  fx: boolean;
  launcherCorner: LauncherCorner;
  launcherPos: Frac | null;
  notify: boolean;
  autoOpenOnTalk: boolean;
  hotkey: string;
  fadeEnabled: boolean;
  fadeOpacity: number;
  saveDir: string | null;
  gameDir: string | null;
  /** 모드 초상화 자동 그리기(2026-10-26). 없으면 켜짐. */
  modPortraits?: boolean;
  pauseGate: boolean;
  aiEveryMin: number;
  gossipOn: boolean;
  extraOn: boolean; // 호외(큰 사건 속보) 내기
  extraMax: number; // 한 해에 낼 호외 수 상한(1~12)
  papersOn: boolean[];
  newsSubPicked: boolean; // 신문 구독(2026-11-10): 집무실 홈페이지에서 처음 구독할 신문사를 골랐는지
  aiMode: 'player2' | 'custom';
  aiActive: string;
  aiConns: AiConn[];
  forceOverlay: boolean;
  radioDockPos: Frac | null;
  dockLock: boolean;
  freePos: { x: number; y: number } | null;
}
export const settings: Settings = {
  devCouncilVote: 'normal',
  devCouncilPercent: 85,
  devCouncilNoAi: false,
  aiLanguage: '',
  player2ClientId: '',
  language: 'auto',
  userDir: null,
  modDir: null,
  setupDone: false,
  mediaPrefs: sanitizeMedia(null),
  councilMode: 'teams',
  councilModeV: 2,
  councilTeamTurns: 2,
  councilSlots: 0,
  councilTurns: 20,
  speechTurns: 20,
  radioStation: 'stn',
  devMode: false,
  mailEnabled: false,
  emotionWar: false,
  childLimitOff: false,
  auditOn: false,
  noconfOn: false,
  gameWatcher: false,
  familyNotify: 'all',
  keepOnTop: true,
  autoHide: true,
  dock: 'right',
  dockPos: null,
  uiScale: 1,
  autoScale: true,
  theme: 'stellaris',
  custom: {},
  bgImage: null,
  bgOpacity: 0.3,
  images: {},
  imageLabels: {},
  addons: { order: [], disabled: [] },
  imageScope: 'country',
  fx: true,
  launcherCorner: 'br',
  launcherPos: null,
  notify: true,
  autoOpenOnTalk: true,
  hotkey: 'Alt+F8',
  fadeEnabled: true,
  fadeOpacity: 0.6,
  saveDir: null,
  gameDir: null,
  pauseGate: true,
  aiEveryMin: 10,
  gossipOn: true,
  extraOn: true,
  extraMax: 1,
  papersOn: [true, true, true],
  newsSubPicked: false,
  aiMode: 'player2',
  aiActive: '',
  aiConns: [],
  forceOverlay: false,
  radioDockPos: null,
  dockLock: true,
  freePos: null,
};
export function settingsPath(): string { return path.join(app.getPath('userData'), 'sllm_settings.json'); }
export function loadSettingsFile(): void { // 설정 파일 읽기 + 값 정리. Player2 ID 적용과 깃발 경로 설정은 main.ts loadSettings()에서
  { // F-33 A: 파일이 없으면 처음 실행. 깨졌으면 .bad 로 남기고 기본값(다음 저장이 깨진 파일을 덮어써도 원본은 남음). 일시적 읽기 오류면 이번 실행 동안 저장하지 않음
    const r = readJsonObject<Partial<Settings>>(settingsPath());
    if (!r.ok) { settingsReadOnly = r.error; logDiagnostic('error', 'storage.read_failed', { store: 'settings', error: r.error }); warnLater('설정 파일을 읽지 못해 기본 설정으로 시작합니다. 이번 실행 동안 설정은 저장되지 않습니다(기존 파일 보호). 이유: ' + r.error); }
    else { if (r.value) Object.assign(settings, r.value); if (r.recovered) { logDiagnostic('error', 'storage.corrupt', { store: 'settings', backup: r.recovered }); warnLater('설정 파일이 깨져 있어 기본 설정으로 시작합니다. 깨진 파일은 sllm_settings.json.bad 로 남겨 두었습니다.'); } }
  }
  settings.player2ClientId = typeof settings.player2ClientId === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(settings.player2ClientId) ? settings.player2ClientId : '';
  settings.language = languagePreference(settings.language);
  settings.aiLanguage = normalizeAiLanguage(settings.aiLanguage) ?? '';
  settings.theme = sanitizeTheme(settings.theme); settings.custom = sanitizeCustom(settings.custom);
  settings.images = sanitizeImageMap(settings.images);
  {
    const lb: Record<string, string> = {};
    if (settings.imageLabels && typeof settings.imageLabels === 'object')
      for (const [k, v] of Object.entries(settings.imageLabels)) if (isImageKey(k) && typeof v === 'string') lb[k] = v.slice(0, 60);
    settings.imageLabels = lb;
  }
  settings.addons = sanitizeAddonPrefs(settings.addons);
  settings.bgOpacity = clampOpacity(settings.bgOpacity);
  settings.imageScope = settings.imageScope === 'species' || settings.imageScope === 'class' ? settings.imageScope : 'country'; settings.fx = settings.fx !== false;
  if (!['tr', 'tl', 'br', 'bl'].includes(settings.launcherCorner)) settings.launcherCorner = 'br';
  const okFrac = (f: any): f is Frac => f && Number.isFinite(f.fx) && Number.isFinite(f.fy);
  settings.mediaPrefs = sanitizeMedia(settings.mediaPrefs);
  settings.devCouncilVote = settings.devMode === true ? devVoteMode(settings.devCouncilVote) : 'normal'; settings.devCouncilPercent = devVotePercent(settings.devCouncilPercent ?? 85); settings.devCouncilNoAi = settings.devMode === true && settings.devCouncilNoAi === true;
  settings.radioStation = radioStation(settings.radioStation).id;
  settings.devMode = settings.devMode === true;
  settings.councilSlots = clampSlots(settings.councilSlots);
  settings.councilTeamTurns = clampTeamTurns(settings.councilTeamTurns);
  settings.speechTurns = clampSpeechTurns(settings.speechTurns);
  settings.councilTurns = clampTurns(settings.councilTurns);
  if (!((settings.councilModeV ?? 0) >= 2)) { settings.councilMode = 'teams'; settings.councilModeV = 2; } // 2026-10-29: 기본을 찬반 2:2 로 한 번 옮긴다(이후 사용자가 고른 값은 그대로)
  settings.councilMode = settings.councilMode === 'equal' || settings.councilMode === 'weighted' ? settings.councilMode : 'teams';
  if (!okFrac(settings.dockPos)) settings.dockPos = null;
  settings.dockLock = settings.dockLock !== false; settings.forceOverlay = settings.forceOverlay === true || (settings as any).devOverlayPreview === true; delete (settings as any).devOverlayPreview;
  if (!settings.freePos || !Number.isFinite(settings.freePos.x) || !Number.isFinite(settings.freePos.y)) settings.freePos = null;
  if (!okFrac(settings.launcherPos)) settings.launcherPos = null;
  settings.uiScale = layoutScale(null, settings.uiScale, false); settings.autoScale = settings.autoScale !== false;
  settings.notify = settings.notify !== false; settings.autoOpenOnTalk = settings.autoOpenOnTalk !== false;
  settings.hotkey = sanitizeHotkey(settings.hotkey); settings.fadeEnabled = settings.fadeEnabled !== false; settings.fadeOpacity = clampFade(settings.fadeOpacity);
  delete (settings as any).dockOffset; delete (settings as any).launcherOffset; // 이전 버전의 픽셀 위치는 버린다
  if (!isSafeStoredName(settings.bgImage)) settings.bgImage = null;
  settings.saveDir = typeof settings.saveDir === 'string' && settings.saveDir ? settings.saveDir.slice(0, 500) : null; settings.gameDir = typeof settings.gameDir === 'string' && settings.gameDir ? settings.gameDir.slice(0, 500) : null;
  settings.userDir = typeof settings.userDir === 'string' && settings.userDir ? settings.userDir : null;
  settings.modDir = typeof settings.modDir === 'string' && settings.modDir ? settings.modDir : null;
  settings.setupDone = settings.setupDone === true;
  settings.pauseGate = settings.pauseGate !== false;
  settings.aiEveryMin = (typeof settings.aiEveryMin === 'number' && settings.aiEveryMin >= 1 && settings.aiEveryMin <= 30) ? Math.round(settings.aiEveryMin) : 10;
  settings.gossipOn = settings.gossipOn !== false;
  settings.extraOn = settings.extraOn !== false;
  settings.extraMax = (typeof settings.extraMax === 'number' && settings.extraMax >= 1 && settings.extraMax <= 12) ? Math.round(settings.extraMax) : 1;
  settings.papersOn = PAPERS.map((_, i) => !Array.isArray(settings.papersOn) || settings.papersOn[i] !== false);
  settings.newsSubPicked = settings.newsSubPicked === true;
  settings.aiMode = settings.aiMode === 'custom' ? 'custom' : 'player2';
  settings.aiConns = (Array.isArray(settings.aiConns) ? settings.aiConns : [])
    .filter((c) => c && typeof c.id === 'string' && c.id)
    .map((c) => ({
      id: String(c.id),
      name: String(c.name || '').slice(0, 40),
      provider: (c.provider in PRESETS ? c.provider : 'custom') as Provider,
      baseUrl: normalizeBase(c.baseUrl),
      model: String(c.model || '').slice(0, 120),
      saveKey: c.saveKey === true,
    }));
  if (!settings.aiConns.some((c) => c.id === settings.aiActive)) settings.aiActive = settings.aiConns[0]?.id ?? '';
  delete (settings as any).aiEverySec;
  for (const k of ['autoPause', 'speedGate', 'speedNormal', 'speedFast']) delete (settings as any)[k];
}
// ---- 개인 API 키: 저장을 고른 연결만 OS 암호화(safeStorage)로 디스크에 둔다. 설정 파일·로그에는 키를 쓰지 않는다.
export const memKeys = new Map<string, string>();
export function keysPath(): string { return path.join(app.getPath('userData'), 'sllm_keys.json'); }
/** 키 파일 읽기(F-33 A). 예전에는 어떤 오류든 빈 목록을 돌려줘서, 다음 저장이 다른 연결의 키를 모두 지웠다. 이제 일시적 읽기 오류면 null(쓰지 말 것). */
export function readKeyFile(): Record<string, string> | null {
  const r = readJsonObject<Record<string, unknown>>(keysPath());
  if (!r.ok) { lastKeyError = '키 파일을 읽지 못했습니다: ' + r.error; logDiagnostic('error', 'storage.read_failed', { store: 'keys', error: r.error }); return null; }
  if (r.recovered) { logDiagnostic('error', 'storage.corrupt', { store: 'keys', backup: r.recovered }); warnLater('API 키 파일이 깨져 있어 sllm_keys.json.bad 로 옮겨 두었습니다. 저장했던 키를 다시 입력해 주세요.'); try { fs.unlinkSync(keysPath()); } catch { /* 이미 없음 */ } }
  return cleanKeyMap(r.value);
}
/** 마지막 키 파일 오류(설정 화면 메시지용). */
export let lastKeyError = '';
function writeKeys(f: Record<string, string>): boolean {
  const err = writeJsonAtomic(keysPath(), f);
  if (err) { lastKeyError = '키 파일에 쓰지 못했습니다: ' + err; logDiagnostic('error', 'storage.write_failed', { store: 'keys', error: err }); return false; }
  return true;
}
const decryptWarned = new Set<string>();
export function getKey(id: string): string | null {
  if (memKeys.has(id)) {const key=memKeys.get(id)||null;registerDiagnosticSecret(key);return key;}
  const c = settings.aiConns.find((x) => x.id === id); if (!c || !c.saveKey) return null;
  const b = readKeyFile()?.[id];
  if (b && safeStorage.isEncryptionAvailable()) {
    try { const k = safeStorage.decryptString(Buffer.from(b, 'base64')); memKeys.set(id, k);registerDiagnosticSecret(k); return k; }
    catch (error) { logDiagnostic('warn', 'ai.key.decrypt_failed', { id, error }); if (!decryptWarned.has(id)) { decryptWarned.add(id); ctx.toUi('status', `저장된 API 키(${c.name || id})를 이 컴퓨터·계정에서 풀 수 없습니다. 키를 다시 입력해 주세요.`); } } // F-33 A: "키 없음"과 구분해 알림
  }
  return null;
}
export function putKey(id: string, key: string, persist: boolean): boolean {
  registerDiagnosticSecret(key);memKeys.set(id, key);
  lastKeyError = '';
  const f = readKeyFile(); if (!f) return false; // 키 파일을 못 읽었으면 덮어쓰지 않는다(다른 키 보호)
  if (persist && safeStorage.isEncryptionAvailable()) { f[id] = safeStorage.encryptString(key).toString('base64'); return writeKeys(f); }
  if (f[id]) { delete f[id]; if (!writeKeys(f)) return false; } // 저장 안 함으로 바꿨는데 디스크에 남으면 알린다
  return !persist;
}
/** 디스크에서 키를 지운다. 실패하면 false 와 상태 표시(화면에는 지워진 것처럼 보이지만 파일에 남는 일을 막음). */
export function dropKey(id: string): boolean {
  memKeys.delete(id); lastKeyError = '';
  const f = readKeyFile();
  const ok = !!f && (!f[id] || (delete f[id], writeKeys(f)));
  if (!ok) ctx.toUi('status', 'API 키를 키 파일에서 지우지 못했습니다. ' + lastKeyError);
  return ok;
}
export function activeCustom() {
  const c = settings.aiConns.find((x) => x.id === settings.aiActive); if (!c) return null;
  const key = getKey(c.id);
  if (PRESETS[c.provider].needsKey && !key) return null;
  return { conn: c, key };
}
/** 설정 파일을 못 읽은 이유. 있으면 이번 실행 동안 저장하지 않는다(F-33 A). */
let settingsReadOnly = '';
export function saveSettings() {
  if (settingsReadOnly) { ctx.toUi('status', '설정 파일을 읽지 못해 이번 실행 동안은 설정을 저장하지 않습니다(기존 파일 보호).'); return; }
  const err = writeJsonAtomic(settingsPath(), settings, true);
  if (err) { logDiagnostic('error', 'storage.write_failed', { store: 'settings', error: err }); ctx.toUi('status', '설정 저장 실패: ' + err); }
}
/** 앱 창이 뜨기 전에 생긴 경고를 잠시 뒤 상태 표시줄에 띄운다. */
function warnLater(msg: string): void { setTimeout(() => { try { ctx.toUi('status', msg); } catch { /* 창이 없으면 진단 기록만 남는다 */ } }, 4000); }
