// 세이브의 이름은 대부분 문구 키(예: HUMAN2_CHR_Aarohi, %LEADER_2% + 변수)라서 게임·모드 문구 파일로 풀어야 사람이 읽는 이름이 된다.
// 게임 언어 폴더(예: localisation/korean)를 통째로 한 번 읽어 키 → 문구 표를 만든다(작업 스레드에서, 앱이 켜 있는 동안 한 번).
import * as fs from 'fs';
import * as path from 'path';

export type LocTable = Map<string, string>;
const LINE = /^\s*([A-Za-z0-9_.\-%:]+?):\d*\s*"(.*)"\s*(?:#.*)?$/;
export function parseYml(text: string, into: LocTable): void {
  for (const raw of text.split(/\r?\n/)) { const m = LINE.exec(raw); if (m && !into.has(m[1])) into.set(m[1], m[2].replace(/\\"/g, '"')); }
}
function walk(dir: string, out: string[], depth = 0): void {
  let ents: fs.Dirent[] = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory() && depth < 4) walk(p, out, depth + 1); else if (e.isFile() && e.name.endsWith('.yml')) out.push(p); }
}
/** dirs 는 우선순위 순(앞이 이김: 모드 → 게임). lang 예: 'korean', 'english'. 모자라면 fallback 언어로 채운다. */
export function loadLoc(dirs: string[], lang: string, fallback = 'english'): LocTable {
  const t: LocTable = new Map();
  for (const l of lang === fallback ? [lang] : [lang, fallback]) for (const d of dirs) {
    const files: string[] = []; walk(path.join(d, 'localisation', 'replace', l), files); walk(path.join(d, 'localisation', l), files);
    for (const f of files) { try { parseYml(fs.readFileSync(f, 'utf8'), t); } catch { /* 깨진 파일 무시 */ } }
  }
  return t;
}

/** 색·아이콘 표시(§Y …§!, £x£)를 걷어 낸다. */
const clean = (s: string): string => s.replace(/§[A-Za-z!]/g, '').replace(/£[^£]*£/g, '').replace(/\s+/g, ' ').trim();
/** 세이브 이름 값 → 글자. { key, variables: [{ key, value }] } 모양을 재귀로 푼다. */
export function resolveName(v: unknown, loc: LocTable, depth = 0): string {
  if (depth > 6 || v === null || v === undefined) return '';
  if (typeof v === 'string') return clean(loc.get(v) ?? v);
  if (Array.isArray(v)) return resolveName(v[0], loc, depth + 1);
  if (typeof v !== 'object') return '';
  const o = v as Record<string, unknown>; if (o.full_names) return resolveName(o.full_names, loc, depth + 1);
  const key = typeof o.key === 'string' ? o.key : '', vars = Array.isArray(o.variables) ? o.variables : o.variables ? [o.variables] : [];
  const val: Record<string, string> = {}; for (const x of vars as Array<Record<string, unknown>>) if (x && typeof x.key === 'string') val[x.key] = resolveName(x.value, loc, depth + 1);
  if (key === '%ADJECTIVE%' || key === '%ADJ%') { // 형용사 + 명사(게임 adj_format, 예: 「인간 연방」) — 형용사 문구에 $1$ 이 있으면 그 자리에
    const inner = vars.find((x) => x && (x as Record<string, unknown>).key === '1') as Record<string, unknown> | undefined;
    if (key === '%ADJ%' && inner) return resolveName(inner.value, loc, depth + 1);
    const adjRaw = (() => { const a = vars.find((x) => x && (x as Record<string, unknown>).key === 'adjective') as Record<string, unknown> | undefined; const av = a?.value as Record<string, unknown> | undefined; return av && typeof av.key === 'string' ? (loc.get(av.key) ?? av.key) : resolveName(a?.value, loc, depth + 1); })();
    const noun = val['1'] ?? ''; if (adjRaw.includes('$1$')) return clean(adjRaw.replace('$1$', noun));
    const fmt = loc.get('adj_format') ?? 'adj $1$'; return clean(fmt.replace('adj', adjRaw).replace('$1$', noun));
  }
  if (key === '%SEQ%') return clean((loc.get(val.fmt ?? '') ?? val.fmt ?? '').replace(/\$[A-Z_]*\$|\{[^}]*\}/, val.num ?? '') || [val.fmt, val.num].filter(Boolean).join(' '));
  if (key === '%ACRONYM%') return val.base ?? '';
  const m = /^%[A-Z_]+_(\d+)%$/.exec(key); // %LEADER_2% 같은 이름 틀 = 변수를 차례로 띄어 붙임(게임 TWO_NAMES_FORMAT)
  let tpl = m ? Array.from({ length: Number(m[1]) }, (_, k) => '$' + (k + 1) + '$').join(' ') : (loc.get(key) ?? key);
  tpl = tpl.replace(/\$([A-Za-z0-9_]+)\$/g, (all, k: string) => (k in val ? val[k] : loc.has(k) ? clean(loc.get(k)!) : all));
  return clean(tpl);
}

/** 게임 언어(내 문서 Stellaris/settings.txt 의 language="l_korean") → 문구 폴더 이름. 모르면 english. */
export function gameLanguage(userDir: string): string {
  try { const m = /^\s*language\s*=\s*"?l_([a-z_]+)"?/m.exec(fs.readFileSync(path.join(userDir, 'settings.txt'), 'utf8')); if (m) return m[1]; } catch { /* 없음 */ }
  return 'english';
}
