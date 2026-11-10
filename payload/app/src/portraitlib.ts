// 포트레이트 라이브러리: 앱 폴더 portrait-library 의 library.json 과 그림 파일(WebP)을 읽는다.
// 게임 파일을 읽어 미리 그려 둔 초상화이며, 앱은 목록을 보여 주고 고른 그림을 평소 사용자 그림과 같은 방식으로 적용한다.
import * as fs from 'fs';
import * as path from 'path';

export const LIB_ROLES = ['default', 'ruler', 'governor', 'admiral', 'general', 'scientist'] as const;
export interface LibItem { id: string; cls: string; species: string; defaultRole: string; roles: Record<string, string>; portraits: string[] }
export interface LibFile { version: number; items: LibItem[]; groups: Record<string, string[]> }

const FILE_RE = /^[A-Za-z0-9_]{1,80}\.webp$/;
/** 앱이 그린 모드 초상화 라이브러리(portrait_library_mods)는 PNG 도 받는다(2026-10-26). pak·바닐라 라이브러리는 그대로 WebP 만. */
const MOD_FILE_RE = /^[A-Za-z0-9_]{1,80}\.(webp|png)$/;
const ID_RE = /^[A-Za-z0-9_]{1,80}$/;
const CLS_RE = /^[a-z]{3,12}$/;
const ROLE_RE = /^[a-z]{3,12}$/;

/** library.json 내용을 검증해 안전한 항목만 남긴다(파일 이름이 폴더 밖을 가리키지 못하게). */
export function parseLibrary(raw: unknown, allowPng = false): LibFile {
  const fileOk = (f: string) => (allowPng ? MOD_FILE_RE : FILE_RE).test(f);
  const out: LibFile = { version: 1, items: [], groups: {} };
  const o = raw as { items?: unknown; groups?: unknown };
  if (!o || !Array.isArray(o.items)) return out;
  // 포트레이트 그룹: human 처럼 여러 초상화를 묶은 이름 -> 초상화 ID들(게임의 portrait_groups)
  if (o.groups && typeof o.groups === 'object') for (const [g, ms] of Object.entries(o.groups as Record<string, unknown>)) if (/^[A-Za-z0-9_.]{1,60}$/.test(g) && Array.isArray(ms)) out.groups[g] = (ms as unknown[]).filter((m): m is string => typeof m === 'string' && /^[A-Za-z0-9_.]{1,60}$/.test(m)).slice(0, 400);
  for (const it of o.items as Record<string, unknown>[]) {
    if (!it || typeof it.id !== 'string' || !ID_RE.test(it.id) || typeof it.cls !== 'string' || !CLS_RE.test(it.cls)) continue;
    const roles: Record<string, string> = {};
    if (it.roles && typeof it.roles === 'object') for (const [r, f] of Object.entries(it.roles as Record<string, unknown>)) if (ROLE_RE.test(r) && typeof f === 'string' && fileOk(f)) roles[r] = f;
    if (!Object.keys(roles).length) continue;
    const dr = typeof it.defaultRole === 'string' && roles[it.defaultRole] ? it.defaultRole : Object.keys(roles)[0];
    const ports = Array.isArray(it.portraits) ? (it.portraits as unknown[]).filter((p): p is string => typeof p === 'string' && p.length < 60).slice(0, 40) : [];
    out.items.push({ id: it.id, cls: it.cls, species: typeof it.species === 'string' ? it.species.slice(0, 40) : '', defaultRole: dr, roles, portraits: ports });
  }
  return out;
}

/** portrait-library.pak(SLPK1) 를 out 폴더에 푼다. 구조: "SLPK1\n" + 길이(uint32 LE) + JSON {v, files:[{n 이름, o 위치, l 길이}]} + 데이터.
 * 이름은 library.json 또는 안전한 .webp 만 허용(폴더 밖으로 못 나감). 이미 같은 pak 으로 풀었으면(.pak-stamp 같음) 다시 풀지 않는다. 풀었거나 이미 있으면 true. */
export function extractPak(pak: string, out: string): boolean {
  try {
    const st = fs.statSync(pak), stamp = `${st.size}:${Math.floor(st.mtimeMs)}`, sf = path.join(out, '.pak-stamp');
    try { if (fs.readFileSync(sf, 'utf8') === stamp && fs.existsSync(path.join(out, 'library.json'))) return true; } catch { /* 처음 풀기 */ }
    const buf = fs.readFileSync(pak);
    if (buf.length < 10 || buf.toString('latin1', 0, 6) !== 'SLPK1\n') return false;
    const hl = buf.readUInt32LE(6), base = 10 + hl;
    if (hl <= 0 || base > buf.length) return false;
    const head = JSON.parse(buf.toString('utf8', 10, base)) as { files?: { n: unknown; o: unknown; l: unknown }[] };
    if (!Array.isArray(head.files)) return false;
    fs.mkdirSync(out, { recursive: true });
    for (const f of head.files) {
      if (typeof f.n !== 'string' || !(f.n === 'library.json' || FILE_RE.test(f.n))) continue;
      if (!Number.isInteger(f.o) || !Number.isInteger(f.l) || (f.o as number) < 0 || (f.l as number) < 0 || base + (f.o as number) + (f.l as number) > buf.length) continue;
      fs.writeFileSync(path.join(out, f.n), buf.subarray(base + (f.o as number), base + (f.o as number) + (f.l as number)));
    }
    fs.writeFileSync(sf, stamp);
    return fs.existsSync(path.join(out, 'library.json'));
  } catch { return false; }
}

export function loadLibrary(dir: string, allowPng = false): LibFile {
  try { return parseLibrary(JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf8')), allowPng); } catch { return { version: 1, items: [], groups: {} }; }
}

/** 항목 id 와 역할로 실제 그림 파일 경로를 찾는다. 역할 그림이 없으면 기본 옷 그림. 없거나 이상하면 null. */
export function libraryFile(lib: LibFile, dir: string, id: unknown, role: unknown): string | null {
  if (typeof id !== 'string') return null;
  const it = lib.items.find((x) => x.id === id);
  if (!it) return null;
  const f = (typeof role === 'string' && it.roles[role]) || it.roles[it.defaultRole];
  if (!f || !MOD_FILE_RE.test(f)) return null; // 이름은 parseLibrary 가 이미 걸렀다(바닐라는 WebP 만)
  const p = path.join(dir, f);
  return fs.existsSync(p) ? p : null;
}

const FEM_RE = /(^|_)female(_|$)|_f(_|$)/, MAL_RE = /(^|_)male(_|$)|_m(_|$)/;
/** 라이브러리 항목 이름에서 성별을 짐작한다(female/male, _f/_m). 모르면 빈 문자열. ui/delegate-pick.js 의 genderOf 와 같아야 한다. */
export function itemGender(id: string): 'f' | 'm' | '' { return FEM_RE.test(id) ? 'f' : MAL_RE.test(id) ? 'm' : ''; }
const hashOf = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 통치자 초상화 ID(또는 그룹 이름)에 맞는 라이브러리 항목들. 성별을 알면 같은 성별을 우선한다. */
export function matchLibrary(lib: LibFile, portraitId: string, gender: 'f' | 'm' | ''): LibItem[] {
  if (!portraitId) return [];
  const ids = new Set<string>([portraitId, ...(lib.groups[portraitId] ?? [])]);
  const hit = lib.items.filter((it) => it.portraits.some((p) => ids.has(p)));
  if (gender) { const same = hit.filter((it) => itemGender(it.id) === gender); if (same.length) return same; }
  return hit;
}

/** 통치자에게 맞는 라이브러리 항목 하나(시드로 고정). 맞는 게 없으면 null. */
export function pickRulerItem(lib: LibFile, portraitId: string, gender: 'f' | 'm' | '', seed: string): LibItem | null {
  const m = matchLibrary(lib, portraitId, gender);
  return m.length ? m[hashOf(seed) % m.length] : null;
}
