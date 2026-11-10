// 사용자가 고르는 그림(배경, 초상화). 파일은 앱 데이터 폴더의 sllm_images 안으로 복사해 두고, 설정에는 파일 이름만 적는다.
import * as path from 'path';

export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export type ImageScope = 'country' | 'species' | 'class';

/** 폴더 안에 둘 안전한 파일 이름. 확장자가 그림이 아니면 null. */
export function safeImageName(original: string, stamp: number): string | null {
  const ext = path.extname(original).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) return null;
  const base = path.basename(original, path.extname(original)).replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'image';
  return `${base}_${stamp.toString(36)}${ext}`;
}
/** 설정에 저장돼 있던 파일 이름이 우리 규칙을 지키는지(폴더 밖으로 나가는 이름 방지). */
export function isSafeStoredName(n: unknown): n is string {
  return typeof n === 'string' && n.length > 0 && n.length < 120 && n === path.basename(n) && IMAGE_EXTS.includes(path.extname(n).toLowerCase()) && !/[\\/:*?"<>|]/.test(n);
}
/** 설정에 쓸 수 있는 그림 키: country:이름, species:이름, class:계열(소문자 3~12자), save:세이브번호:country|species:이름(제국은 제국 번호),
 * scene:자리(A-22 연출 슬롯·창 배경, 소문자·밑줄 3~24자). */
export const SCENE_KEY = /^scene:[a-z][a-z_]{2,23}$/;
/** 플레이어 통치자 초상화(사용자가 넣는 자기 캐릭터) — 플레이어 통치자가 나오는 모든 장면에서 먼저 쓴다(2026-10-16). */
export const RULER_KEY = 'ruler:player';
/** 플레이어 통치자: 직접 넣은 그림 → 이 계열의 연설 지도자 그림 → 계열 초상화 → 없음(모드 기본 그림은 부르는 쪽에서). */
export const resolvePlayerRuler = (images: Record<string, string>, classKey: string): string | null => images[RULER_KEY] ?? resolveLeader(images, classKey);
/** 초상화 변형(2026-10-16): class:/delegate: 는 기본 + #2..#8 을 둘 수 있다. 인물(seed)마다 늘 같은 한 장(ui/portrait-variants.js 와 같은 규칙). 통치자·연설 지도자는 변형 없음. */
export const VARIANT_MAX = 8;
const vhash = (s: string) => { let h = 2166136261; for (const c of String(s ?? '')) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); } return h >>> 0; };
export function pickVariant(images: Record<string, string>, keys: string[], seed: string, def: string | null = null): string | null {
  for (let n = 0; n < keys.length; n++) {
    const key = keys[n], vars: string[] = [];
    for (let i = 2; i <= VARIANT_MAX; i++) if (images[`${key}#${i}`]) vars.push(images[`${key}#${i}`]);
    const base = images[key] ?? (n === keys.length - 1 && vars.length ? def : null);
    const pool = [base, ...vars].filter((x): x is string => !!x);
    if (pool.length) return pool[vhash(seed) % pool.length];
  }
  return def;
}
/** 지도자 개인 초상화(2026-10-24): 세이브마다 인물 한 명. person:<세이브>:<지도자 번호> 또는 번호를 모르는 인물(총독 등)은 person:<세이브>:n:<이름>.
 *  화면에는 imageState 가 이 세이브의 것을 name:<이름> 으로도 깔아 주고, ui/portrait-variants.js 가 인물 이름(시드)으로 먼저 찾는다. */
export const PERSON_KEY = /^person:\d{1,9}:(\d{1,12}|n:[^\r\n]{1,80})$/;
export const personImageKey = (sid: string, lid: number | null | undefined, name: string): string | null => {
  if (!/^\d{1,9}$/.test(String(sid ?? ''))) return null;
  if (Number.isSafeInteger(lid) && (lid as number) >= 0) return `person:${sid}:${lid}`;
  const n = String(name ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 80); return n ? `person:${sid}:n:${n}` : null;
};
export function isImageKey(k: unknown): k is string {
  return typeof k === 'string' && (SCENE_KEY.test(k) || PERSON_KEY.test(k) || /^(country|species):.{1,80}$/.test(k) || /^(class|delegate|leader):[a-z]{3,12}$/.test(k) || /^(class|delegate):[a-z]{3,12}#[2-8]$/.test(k) || k === RULER_KEY || /^save:\d{1,9}:(country|species):.{1,80}$/.test(k));
}
export function sanitizeImageMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, f] of Object.entries(v as Record<string, unknown>)) {
    if (isImageKey(k) && isSafeStoredName(f)) out[k] = f;
  }
  return out;
}
export function imageKey(scope: ImageScope, countryName: string, species: string, classKey = ''): string | null {
  const n = (scope === 'class' ? classKey : scope === 'species' ? species : countryName).trim().slice(0, 80);
  return n ? `${scope}:${n}` : null;
}
/** 초상화 찾기: 제국에 지정한 것 → 종족에 지정한 것 → 종족 계열에 지정한 것 → 없음(모드 기본 그림). */
export function resolvePortrait(images: Record<string, string>, countryName: string, species: string, classKey = ''): string | null {
  return images[`country:${countryName}`] ?? (species ? images[`species:${species}`] : undefined) ?? (classKey ? pickVariant(images, [`class:${classKey}`], countryName) : undefined) ?? null;
}
/** 연설 무대의 지도자 초상화: 이 계열에 올린 지도자 그림 → 계열 초상화에 올린 그림 → 없음(모드 기본 그림은 호출한 쪽에서 붙인다). */
export const resolveLeader = (images: Record<string, string>, classKey: string): string | null => (classKey ? images[`leader:${classKey}`] ?? images[`class:${classKey}`] ?? null : null);
/** 의회 의석에 쓰는 의원 초상화: 이 계열에 올린 의원 그림 → 계열 초상화에 올린 그림 → 없음(모드 기본 그림은 화면에서 붙인다). */
export function resolveDelegate(images: Record<string, string>, classKey: string, seed = ''): string | null {
  return pickVariant(images, [`delegate:${classKey}`, `class:${classKey}`], seed);
}
export function clampOpacity(v: unknown, fallback = 0.3): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/** 모드가 세이브에 새겨 둔 세이브 번호(숫자 1~9자리). 아니면 빈 문자열. */
export function cleanSaveId(v: unknown): string {
  const t = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  return /^\d{1,9}$/.test(t) ? t : '';
}
/** 이 세이브의 제국 그림 키. 제국 이름은 게임 중 자주 바뀌므로 제국 번호(idx)로 구분한다. 세이브 번호가 없으면 예전 방식(이름). */
export function countryImageKey(sid: string, idx: number, name: string): string | null {
  if (sid) return Number.isInteger(idx) && idx >= 0 ? `save:${sid}:country:${idx}` : null;
  const n = (name || '').trim().slice(0, 80);
  return n ? `country:${n}` : null;
}
export function speciesImageKey(sid: string, species: string): string | null {
  const n = (species || '').trim().slice(0, 80);
  if (!n) return null;
  return sid ? `save:${sid}:species:${n}` : `species:${n}`;
}
/** 대화 상대의 초상화 찾기(저장된 그림 파일 이름). 이 세이브의 제국 → 이 세이브의 종족 → 계열 → 없음. 세이브 번호가 없을 때만 예전 이름 키를 쓴다. */
export function findPortrait(images: Record<string, string>, sid: string, idx: number, name: string, species: string, classKey = ''): string | null {
  const c = countryImageKey(sid, idx, name), sp = speciesImageKey(sid, species);
  return (c ? images[c] : undefined) ?? (sp ? images[sp] : undefined) ?? (classKey ? pickVariant(images, [`class:${classKey}`], name || String(idx)) : undefined) ?? null;
}
