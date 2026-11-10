// 스텔라리스 세이브(.sav = zip)에서 제국 깃발을 읽는다. 읽기 전용. 외부 라이브러리 없이 zlib 만 쓴다.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { environmentSaveRoots } from './environment-paths';

export interface FlagSpec {
  iconCat: string;
  iconFile: string;
  bgCat: string;
  bgFile: string;
  colors: string[]; // 최대 6개. 안 쓰는 칸은 'null'
}

/** 세이브의 나라별 국력 수치(게임의 제국 목록에서 보이는 것과 같은 종류). */
export interface CountryStats { military: number; economy: number; tech: number; rank: number; fleet: number; size: number; pops: number }

export interface SaveFlags {
  statsByIdx: Record<string, CountryStats>; // sllm_idx -> 국력
  statsById: Record<string, CountryStats>;
  byId: Record<string, FlagSpec>;  // 나라 번호(세이브 안) -> 깃발
  byIdx: Record<string, FlagSpec>; // 모드가 매긴 sllm_idx -> 깃발
  bioById: Record<string, string>;  // 나라 번호 -> 건국 종족의 전기(커스텀 제국만 있음)
  bioByIdx: Record<string, string>; // sllm_idx -> 전기
  ethicsByIdx?: Record<string, string[]>;
  typesByIdx?: Record<string, string>;
  portraitsByIdx?: Record<string, PortraitInfo>; // A-04·A-09
  rulerByIdx?: Record<string, RulerInfo>; // 통치자 초상화·성별(포트레이트 라이브러리 자동 선택)
  natureByIdx?: Record<string, EmpireNature>; // 정부 형태·국시·기원·건국 종족 특성(2026-11-03, AI가 우리 제국을 제대로 알게)
  /** 세이브 요약(지도자·행성 등, 2026-11-03 세이브 읽기 2단계 — 작업 스레드에서만 채움). */
  snap?: import('./savegame/extract').SaveSnap; snapError?: string;
  sid?: string;
  date: string;
}

/** zip 안에서 이름이 같은 파일 하나를 풀어 문자열로 돌려준다. 없으면 null. */
/** 세이브 gamestate 를 풀 때의 상한. V8 문자열 한도(약 512MB)를 넘기면 어차피 읽을 수 없다. */
const SAVE_ENTRY_MAX = 512 * 1024 * 1024;
export function readZipEntry(buf: Buffer, name: string): Buffer | null {
  // 경계 검사(2026-10-18): 게임이 자동 저장을 쓰는 도중이거나 손상된 파일이면 null(예외로 매번 다시 읽지 않게).
  if (buf.length < 22) return null;
  // 끝 중앙 디렉터리(EOCD) 찾기
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const fname = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (fname === name) {
      if (lho + 30 > buf.length) return null;
      const lnlen = buf.readUInt16LE(lho + 26);
      const lelen = buf.readUInt16LE(lho + 28);
      const start = lho + 30 + lnlen + lelen;
      if (start + csize > buf.length) return null;
      const data = buf.subarray(start, start + csize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data, { maxOutputLength: SAVE_ENTRY_MAX });
      return null;
    }
    p += 46 + nlen + elen + clen;
  }
  return null;
}

/** gamestate 문자열에서 country={ ... } 구역만 훑어 깃발을 모은다. */
function unescapePdx(v: string): string { return v.replace(/\\(.)/g, (_m, c: string) => (c === 'n' ? '\n' : c)); } // 한 번에 풀어야 '\\n'(역슬래시+n)이 줄바꿈으로 바뀌지 않는다(2026-10-18)

// 메모리(2026-10-27, 「앱을 켜자 메모리가 치솟는다」 제보): 예전에는 구역을 찾을 때마다 「그 구역부터 파일 끝까지」를 줄로 쪼갰다(한 번 읽을 때 7번).
// 후반 세이브(gamestate 수백 MB)면 줄 문자열 수천만 개가 생겨 RAM 이 GB 단위로 치솟았다. 이제 최상위 구역(name= … 0열의 }) 하나만 잘라서 쪼개고,
// readSaveFlags 안에서는 같은 구역을 한 번만 쪼개 함께 쓴다(끝나면 버림).
let secMemo: { src: string; map: Map<string, string[]> } | null = null;
/** 최상위 구역 줄들: [0] = 'name=' 머리 줄 … 닫는 0열 '}' 줄까지. 없으면 []. */
export function sectionLines(gs: string, name: string): string[] {
  if (secMemo && secMemo.src === gs) { const hit = secMemo.map.get(name); if (hit) return hit; }
  const start = gs.search(new RegExp('^' + name + '=\\r?$', 'm'));
  let lines: string[] = [];
  if (start >= 0) {
    const endRe = /\n\}\r?(?=\n|$)/g; endRe.lastIndex = start;
    const e = endRe.exec(gs);
    lines = gs.slice(start, e ? e.index + e[0].length : gs.length).split('\n');
  }
  if (secMemo && secMemo.src === gs) secMemo.map.set(name, lines);
  return lines;
}

/** species_db 구역에서 종족 번호 -> species_bio. 전기가 없는 종족은 빠진다. */
export function parseSpeciesBios(gamestate: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = sectionLines(gamestate, 'species_db');
  if (!lines.length) return out;
  let cur = '';
  for (let li = 1; li < lines.length; li++) {
    const raw = lines[li].replace(/\r$/, '');
    if (raw === '}') break;
    const m = /^\t(\d+)=$/.exec(raw);
    if (m) { cur = m[1]; continue; }
    if (!cur || !raw.startsWith('\t\tspecies_bio=')) continue;
    const q = /^\t\tspecies_bio="(.*)"\s*$/.exec(raw);
    if (q && q[1].trim()) out[cur] = unescapePdx(q[1]).trim();
  }
  return out;
}

export function parseFlags(gamestate: string): { byId: Record<string, FlagSpec>; byIdx: Record<string, FlagSpec>; bioById: Record<string, string>; bioByIdx: Record<string, string>; statsById: Record<string, CountryStats>; statsByIdx: Record<string, CountryStats> } {
  const statsById: Record<string, CountryStats> = {}, statsByIdx: Record<string, CountryStats> = {};
  let st: Partial<CountryStats> = {};
  const byId: Record<string, FlagSpec> = {};
  const byIdx: Record<string, FlagSpec> = {};
  const bioById: Record<string, string> = {};
  const bioByIdx: Record<string, string> = {};
  const bios = parseSpeciesBios(gamestate);
  let founder = '';
  const lines = sectionLines(gamestate, 'country');
  if (!lines.length) return { byId, byIdx, bioById, bioByIdx, statsById, statsByIdx };
  let curId = '';
  let flag: FlagSpec | null = null;
  let inFlag = false;
  let sect: '' | 'icon' | 'background' | 'colors' = '';
  let idx = '';
  const finish = () => {
    if (curId && flag && flag.iconFile) {
      byId[curId] = flag;
      if (idx) byIdx[idx] = flag;
    }
    if (curId && founder && bios[founder]) { bioById[curId] = bios[founder]; if (idx) bioByIdx[idx] = bios[founder]; }
    if (curId && st.military !== undefined) { const full: CountryStats = { military: st.military ?? 0, economy: st.economy ?? 0, tech: st.tech ?? 0, rank: st.rank ?? 0, fleet: st.fleet ?? 0, size: st.size ?? 0, pops: st.pops ?? 0 }; statsById[curId] = full; if (idx) statsByIdx[idx] = full; }
    flag = null; idx = ''; founder = ''; st = {};
  };
  for (let li = 1; li < lines.length; li++) {
    const raw = lines[li].replace(/\r$/, '');
    if (raw === '}') break; // country 구역 끝
    let m = /^\t(\d+)=$/.exec(raw);
    if (m) { finish(); curId = m[1]; inFlag = false; sect = ''; continue; }
    if (!curId) continue;
    const t = raw.trim();
    if (!inFlag) {
      if (raw === '\t\tflag=') { inFlag = true; flag = { iconCat: '', iconFile: '', bgCat: '', bgFile: '', colors: [] }; sect = ''; continue; }
      if (raw.startsWith('\t\t') && !raw.startsWith('\t\t\t')) {
        const sv = /^\t\t(military_power|economy_power|tech_power|victory_rank|fleet_size|empire_size|num_sapient_pops)=(-?[\d.]+)$/.exec(raw);
        if (sv) {
          const n = Number(sv[2]);
          const k = sv[1];
          if (k === 'military_power') st.military = n;
          else if (k === 'economy_power') st.economy = n;
          else if (k === 'tech_power') st.tech = n;
          else if (k === 'victory_rank') st.rank = n;
          else if (k === 'fleet_size') st.fleet = n;
          else if (k === 'empire_size') st.size = n;
          else st.pops = n;
        }
      }
      m = /^sllm_idx=(\d+)(?:\.0+)?$/.exec(t);
      if (m && raw.startsWith('\t\t\t')) idx = m[1];
      m = /^founder_species_ref=(\d+)$/.exec(raw.trim());
      if (m && raw.startsWith('\t\tfounder')) founder = m[1];
      continue;
    }
    if (!flag) continue;
    if (raw === '\t\t}') { inFlag = false; sect = ''; continue; }
    if (t === 'icon=') { sect = 'icon'; continue; }
    if (t === 'background=') { sect = 'background'; continue; }
    if (t === 'colors=') { sect = 'colors'; continue; }
    if (t === '{' || t === '}') continue;
    if (sect === 'colors') {
      const c = /^"([^"]*)"$/.exec(t);
      if (c) flag.colors.push(c[1]);
      continue;
    }
    const kv = /^(category|file)="([^"]*)"$/.exec(t);
    if (kv) {
      if (sect === 'icon') { if (kv[1] === 'category') flag.iconCat = kv[2]; else flag.iconFile = kv[2]; }
      else if (sect === 'background') { if (kv[1] === 'category') flag.bgCat = kv[2]; else flag.bgFile = kv[2]; }
    }
  }
  finish();
  return { byId, byIdx, bioById, bioByIdx, statsById, statsByIdx };
}

/** 제국의 정체(2026-11-03 테스터 요청: AI가 종족 특성·국시를 몰랐다). 게임 키 그대로(번역은 앱이 따로). */
export interface EmpireNature { authority?: string; civics: string[]; origin?: string; traits: string[] }
/** country 구역의 government(authority·civics·origin)와 founder_species_ref, species_db 의 traits 를 sllm_idx 별로 모은다. */
export function parseEmpireNature(gamestate: string): Record<string, EmpireNature> {
  const out: Record<string, EmpireNature> = {};
  const traitsOf: Record<string, string[]> = {};
  { const L = sectionLines(gamestate, 'species_db'); let cur = '', inT = false, depth = 0;
    for (let li = 1; li < L.length; li++) { const raw = L[li].replace(/\r$/, ''); if (raw === '}') break;
      const m = /^\t(\d+)=$/.exec(raw); if (m) { cur = m[1]; inT = false; continue; }
      if (!cur) continue;
      if (!inT && /^\t\ttraits\s*=/.test(raw)) { inT = true; depth = 0; }
      if (inT) {
        for (const t of raw.matchAll(/trait="([^"]+)"/g)) (traitsOf[cur] ??= []).includes(t[1]) || traitsOf[cur].push(t[1]);
        depth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        if (depth <= 0 && /\}/.test(raw)) inT = false;
      } } }
  const L = sectionLines(gamestate, 'country'); if (!L.length) return out;
  let idx = '', founder = '', gov = false, civ = false, cdepth = 0, n: EmpireNature = { civics: [], traits: [] };
  const finish = () => { if (idx) { const t = founder ? traitsOf[founder] ?? [] : []; if (n.authority || n.civics.length || n.origin || t.length) out[idx] = { ...n, traits: t }; } idx = ''; founder = ''; gov = false; civ = false; n = { civics: [], traits: [] }; };
  for (let li = 1; li < L.length; li++) { const raw = L[li].replace(/\r$/, ''); if (raw === '}') break;
    if (/^\t\d+=$/.test(raw)) { finish(); continue; }
    const id = /^\t{3,}sllm_idx=(\d+)(?:\.0+)?$/.exec(raw); if (id) { idx = id[1]; continue; }
    const f = /^\t\tfounder_species_ref=(\d+)$/.exec(raw); if (f) { founder = f[1]; continue; }
    if (/^\t\tgovernment\s*=/.test(raw)) { gov = true; continue; }
    if (!gov) continue;
    if (raw === '\t\t}') { gov = false; civ = false; continue; }
    if (civ) {
      for (const q of raw.matchAll(/"([A-Za-z0-9_.:-]+)"/g)) if (!n.civics.includes(q[1])) n.civics.push(q[1]);
      cdepth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length; if (cdepth <= 0 && /\}/.test(raw)) civ = false; continue;
    }
    if (/^\t\t\tcivics\s*=/.test(raw)) { civ = true; cdepth = 0; for (const q of raw.matchAll(/"([A-Za-z0-9_.:-]+)"/g)) if (!n.civics.includes(q[1])) n.civics.push(q[1]); cdepth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length; if (cdepth <= 0 && /\}/.test(raw)) civ = false; continue; }
    const a = /^\t\t\tauthority="([^"]+)"/.exec(raw); if (a) { n.authority = a[1]; continue; }
    const o = /^\t\t\torigin="([^"]+)"/.exec(raw); if (o) { n.origin = o[1]; continue; }
  }
  finish();
  return out;
}

export function readSaveFlags(savePath: string): SaveFlags | null {
  const buf = fs.readFileSync(savePath);
  const meta = readZipEntry(buf, 'meta')?.toString('utf8') ?? '';
  let text: string;
  { const gs = readZipEntry(buf, 'gamestate'); if (!gs) return null; text = gs.toString('utf8'); } // 압축 푼 버퍼는 문자열로 바꾼 뒤 바로 놓는다
  secMemo = { src: text, map: new Map() };
  try {
  const date = /^date="([^"]*)"/m.exec(meta)?.[1] ?? '';
  const metadata = parseSaveCountryMetadata(text);
  let portraitsByIdx: Record<string, PortraitInfo> | undefined;
  try { portraitsByIdx = parsePortraitInfo(text); } catch { /* 초상화 정보는 없어도 된다 */ }
  let rulerByIdx: Record<string, RulerInfo> | undefined;
  try { rulerByIdx = parseRulers(text); } catch { /* 통치자 정보는 없어도 된다 */ }
  let natureByIdx: Record<string, EmpireNature> | undefined;
  try { natureByIdx = parseEmpireNature(text); } catch { /* 국시·특성은 없어도 된다 */ }
  return { ...parseFlags(text), ...metadata, portraitsByIdx, rulerByIdx, natureByIdx, date };
  } finally { secMemo = null; } // 쪼갠 구역을 붙잡고 있지 않는다
}

/** 제국 통치자의 초상화 ID·성별(포트레이트 라이브러리가 같은 옷·성별의 그림을 고를 때 쓴다). */
export interface RulerInfo { portrait: string; gender: 'f' | 'm' | ''; leaderClass: string }
/** gamestate 에서 제국마다 통치자의 초상화·성별을 읽는다. 직접 만든 통치자는 design.portrait(정확한 ID), 아니면 지도자의 portrait, 그것도 없으면 종족 초상화. */
export function parseRulers(gamestate: string): Record<string, RulerInfo> {
  const out: Record<string, RulerInfo> = {};
  const sections = (name: string): string[] => sectionLines(gamestate, name);
  const speciesPortrait: Record<string, string> = {};
  { const L = sections('species_db'); let cur = '';
    for (let i = 1; i < L.length; i++) { const raw = L[i].replace(/\r$/, ''); if (raw === '}') break; const m = /^\t(\d+)=$/.exec(raw); if (m) { cur = m[1]; continue; } const q = /^\t\tportrait="([^"]*)"$/.exec(raw); if (cur && q) speciesPortrait[cur] = q[1]; } }
  const rulerOf: Record<string, string> = {}, founderOf: Record<string, string> = {}; // 제국 번호 -> 통치자/건국 종족
  const idxOf: Record<string, string> = {}; // 제국 번호 -> 모드 번호(sllm_idx)
  { const L = sections('country'); let cur = '';
    for (let i = 1; i < L.length; i++) { const raw = L[i].replace(/\r$/, ''); if (raw === '}') break; const m = /^\t(\d+)=$/.exec(raw); if (m) { cur = m[1]; continue; } if (!cur) continue;
      const r = /^\t\truler=(\d+)$/.exec(raw); if (r) { rulerOf[cur] = r[1]; continue; }
      const f = /^\t\tfounder_species_ref=(\d+)$/.exec(raw); if (f) { founderOf[cur] = f[1]; continue; }
      if (raw.startsWith('\t\t\t')) { const s = /^sllm_idx=(\d+)(?:\.0+)?$/.exec(raw.trim()); if (s) idxOf[cur] = s[1]; } } }
  const wanted = new Set(Object.values(rulerOf));
  const info: Record<string, { portrait: string; gender: string; cls: string; species: string; dPortrait: string; dGender: string }> = {};
  { const L = sections('leaders'); let cur = '', inDesign = false;
    for (let i = 1; i < L.length; i++) { const raw = L[i].replace(/\r$/, ''); if (raw === '}') break; const m = /^\t(\d+)=$/.exec(raw); if (m) { cur = wanted.has(m[1]) ? m[1] : ''; inDesign = false; if (cur) info[cur] = { portrait: '', gender: '', cls: '', species: '', dPortrait: '', dGender: '' }; continue; }
      if (!cur) continue;
      if (raw === '\t\tdesign=') { inDesign = true; continue; }
      if (inDesign) { if (raw === '\t\t}') { inDesign = false; continue; } const d = /^\t\t\t(portrait|gender)="?([^"]*)"?$/.exec(raw); if (d) { if (d[1] === 'portrait') info[cur].dPortrait = d[2]; else info[cur].dGender = d[2]; } continue; }
      const k = /^\t\t(portrait|gender|class|species)="?([^"]*)"?$/.exec(raw);
      if (k) { const v = k[2]; if (k[1] === 'portrait') info[cur].portrait = v; else if (k[1] === 'gender') info[cur].gender = v; else if (k[1] === 'class') info[cur].cls = v; else info[cur].species = v; } } }
  const g = (v: string): 'f' | 'm' | '' => (v === 'female' ? 'f' : v === 'male' ? 'm' : '');
  for (const [cid, rid] of Object.entries(rulerOf)) {
    const idx = idxOf[cid], r = info[rid];
    if (!idx || !r) continue;
    const portrait = r.dPortrait || r.portrait || speciesPortrait[r.species] || speciesPortrait[founderOf[cid]] || '';
    if (portrait) out[idx] = { portrait, gender: g(r.dGender || r.gender), leaderClass: r.cls };
  }
  return out;
}

/** 세이브가 있을 만한 폴더들(스팀 클라우드 + 문서 폴더). SLLM_SAVE_DIR 로 직접 지정할 수도 있다. */
export function saveRoots(): string[] { return environmentSaveRoots(); }

/** 폴더 하나(세이브 루트 또는 제국 폴더)에서 .sav 파일 경로들을 모은다. 한 단계 아래 폴더까지 본다. */
export function listSaves(root: string): string[] {
  const out: string[] = [];
  let ents: fs.Dirent[] = [];
  try { ents = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const fp = path.join(root, e.name);
    if (e.isFile() && e.name.toLowerCase().endsWith('.sav')) out.push(fp);
    else if (e.isDirectory()) {
      try { for (const f of fs.readdirSync(fp)) if (f.toLowerCase().endsWith('.sav')) out.push(path.join(fp, f)); } catch { /* 건너뜀 */ }
    }
  }
  return out;
}

/** 모든 폴더에서 가장 최근에 바뀐 .sav 하나를 찾는다. */
export function findLatestSave(roots: string[] = saveRoots()): string | null {
  let best = ''; let bestT = 0;
  for (const r of roots) {
    for (const fp of listSaves(r)) {
      try { const t = fs.statSync(fp).mtimeMs; if (t > bestT) { bestT = t; best = fp; } } catch { /* 건너뜀 */ }
    }
  }
  return best || null;
}

/** Save format uses a country-level ethos/ethics block; nested species/pop ethics are excluded. */
export function parseSaveCountryMetadata(text: string): { ethicsByIdx: Record<string,string[]>; typesByIdx: Record<string,string>; sid: string } {
  const ethicsByIdx: Record<string,string[]> = {}, typesByIdx: Record<string,string> = {};
  const sec=sectionLines(text,'country'); if(!sec.length)return {ethicsByIdx,typesByIdx,sid:''};
  let idx='',type='',ids:string[]=[],section=false,sid='';
  const finish=()=>{if(idx){ethicsByIdx[idx]=[...new Set(ids)];typesByIdx[idx]=type;}idx='';type='';ids=[];section=false;};
  for(let li=1;li<sec.length;li++) { const line=sec[li];
    const raw=line.replace(/\r$/,''); if(raw==='}')break;
    if(/^\t\d+=$/.test(raw)){finish();continue;}
    const id=/^\t{3,}sllm_idx=(\d+)(?:\.0+)?$/.exec(raw);if(id)idx=id[1];
    const save=/^\t{3,}sllm_save_id=(\d+)(?:\.0+)?$/.exec(raw);if(save)sid=save[1];
    const tp=/^\t\ttype="?([A-Za-z0-9_.-]+)"?$/.exec(raw);if(tp)type=tp[1];
    if(/^\t\t(?:ethos|ethics)\s*=/.test(raw))section=true;
    else if(/^\t\t[^\t{]/.test(raw))section=false;
    if(section){for(const match of raw.matchAll(/"([A-Za-z0-9_.-]+)"/g))if(!ids.includes(match[1]))ids.push(match[1]);}
  }
  finish();return {ethicsByIdx,typesByIdx,sid};
}

/** A-04·A-09: 제국별 초상화(건국 종족)와 종족 비율. 세이브의 species_db(portrait·class), country(founder_species_ref·owned_planets·sllm_idx),
 * pop_groups(key.species·planet·size)를 읽는다. 비율은 그 제국 행성에 사는 인구(size) 합으로 센다. */
export interface PortraitMix { portrait: string; cls: string; share: number; /** 종족 이름 표 키(세이브 species name_list, 인물 이름 짓기용). 없으면 빠짐 */ list?: string }
export interface PortraitInfo { founder: { portrait: string; cls: string; list?: string } | null; mix: PortraitMix[]; /** 이름 짓기용: 제국에 사는 모든 종족의 인구 비율(5% 미만·초상화 없는 종족 포함, 2026-10-20) */ pop?: Array<{ cls: string; share: number; list?: string }> }
export function parsePortraitInfo(gs: string): Record<string, PortraitInfo> {
  const out: Record<string, PortraitInfo> = {};
  let lines: string[] = [];
  /** 그 구역 줄로 바꾸고 머리 줄 위치(0)를 돌려준다. 없으면 -1. 아래 반복은 i += 2(머리·여는 괄호 다음)부터. */
  const sec = (name: string) => { lines = sectionLines(gs, name); return lines.length ? 0 : -1; };
  // 1. 종족
  const species: Record<string, { portrait: string; cls: string; list?: string }> = {};
  let i = sec('species_db');
  if (i >= 0) { let cur = ''; for (i += 2; i < lines.length; i++) { const l = lines[i].replace(/\r$/, ''); if (l === '}') break; let m = /^\t(\d+)=$/.exec(l); if (m) { cur = m[1]; species[cur] = { portrait: '', cls: '' }; continue; } if (!cur) continue; m = /^\t\t(portrait|class|name_list)="([^"]*)"$/.exec(l); if (m) { if (m[1] === 'name_list') { if (m[2]) species[cur].list = m[2]; } else species[cur][m[1] === 'portrait' ? 'portrait' : 'cls'] = m[2]; } } }
  // 2. 나라: sllm_idx, 건국 종족, 가진 행성
  const planetOwner = new Map<string, string>(), founderOf = new Map<string, string>();
  i = sec('country');
  if (i >= 0) {
    let cur = '', idx = '', founder = '', inOwned = false; const owned: string[] = [];
    const finish = () => { if (cur && idx) { if (founder) founderOf.set(idx, founder); for (const p of owned) planetOwner.set(p, idx); } idx = ''; founder = ''; owned.length = 0; inOwned = false; };
    for (i += 2; i < lines.length; i++) {
      const l = lines[i].replace(/\r$/, ''); if (l === '}') break;
      const m = /^\t(\d+)=$/.exec(l); if (m) { finish(); cur = m[1]; continue; }
      if (!cur) continue;
      if (l === '\t\towned_planets=') { inOwned = true; continue; }
      if (inOwned) { if (l === '\t\t}') inOwned = false; else if (l.startsWith('\t\t\t')) owned.push(...l.trim().split(/\s+/).filter((x) => /^\d+$/.test(x))); continue; }
      let mm = /^\t\tfounder_species_ref=(\d+)$/.exec(l); if (mm) { founder = mm[1]; continue; }
      mm = /^\t\t\tsllm_idx=(\d+)(?:\.0+)?$/.exec(l); if (mm) idx = mm[1];
    }
    finish();
  }
  // 3. 인구 묶음: 행성 → 나라, 종족별 size 합
  const sizes = new Map<string, Map<string, number>>();
  i = sec('pop_groups');
  if (i >= 0) {
    let sp = '', planet = '', size = 0, depth = 0;
    const finish = () => { const c = planetOwner.get(planet); if (c && sp && size > 0) { const m = sizes.get(c) ?? new Map<string, number>(); m.set(sp, (m.get(sp) ?? 0) + size); sizes.set(c, m); } sp = ''; planet = ''; size = 0; };
    for (i += 2; i < lines.length; i++) {
      const l = lines[i].replace(/\r$/, ''); if (l === '}') break;
      if (/^\t\d+=$/.test(l)) { finish(); depth = 1; continue; }
      if (!depth) continue;
      let m = /^\t\t\tspecies=(\d+)$/.exec(l); if (m) { sp = m[1]; continue; }
      m = /^\t\tplanet=(\d+)$/.exec(l); if (m) { planet = m[1]; continue; }
      m = /^\t\tsize=(\d+)$/.exec(l); if (m) size = Number(m[1]);
    }
    finish();
  }
  const idxs = new Set([...founderOf.keys(), ...sizes.keys()]);
  for (const idx of idxs) {
    const f = founderOf.get(idx), fs0 = f ? species[f] : undefined, m = sizes.get(idx);
    let mix: PortraitMix[] = [];
    if (m) { const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1; mix = [...m].map(([s, n]) => ({ portrait: species[s]?.portrait ?? '', cls: species[s]?.cls ?? '', share: n / tot, ...(species[s]?.list ? { list: species[s].list } : {}) })).filter((x) => x.portrait && x.share >= 0.05).sort((a, b) => b.share - a.share).slice(0, 4); const t2 = mix.reduce((a, b) => a + b.share, 0) || 1; mix = mix.map((x) => ({ ...x, share: Math.round((x.share / t2) * 1000) / 1000 })); }
    let pop: PortraitInfo['pop'];
    if (m) { const tot = [...m.values()].reduce((a, b) => a + b, 0) || 1; pop = [...m].map(([s, n]) => ({ cls: species[s]?.cls ?? '', share: Math.round((n / tot) * 10000) / 10000, ...(species[s]?.list ? { list: species[s].list } : {}) })).filter((x) => x.share > 0 && (x.cls || x.list)).sort((a, b) => b.share - a.share); }
    out[idx] = { founder: fs0 && fs0.portrait ? fs0 : null, mix, ...(pop && pop.length ? { pop } : {}) };
  }
  return out;
}
