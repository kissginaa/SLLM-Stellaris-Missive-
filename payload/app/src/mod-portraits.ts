// 모드 초상화 자동 불러오기(2026-10-26, docs/MOD_PORTRAIT_IMPORT_DESIGN_KO.md). electron 없이 쓰는 부분(자체 검사 가능).
// 1) 런처 dlc_load.json 의 켜진 모드(로드 순서) + 그 밖에 설치된 모드 → 모드 폴더 목록. 구독 폴더는 읽기만 한다.
// 2) 게임 + 모드 폴더를 겹쳐(뒤에 로드된 모드가 앞을 덮음) 초상화 정의·포트레이트 그룹·옷/머리 선택자·엔티티·pdxmesh 를 모은다.
// 3) 초상화 키 → 그리기 계획(mesh 파일, 조각마다 텍스처) → portrait-render 로 그려 PNG.
// 바닐라 셰이더는 그대로, Gigastructures 블록 고양이(GigaBlokkat*)는 흉내 코드, 모르는 셰이더는 몸 텍스처로 근사(status = approx).
import * as fs from 'fs';
import * as path from 'path';
import { parsePdx, type PdxEntry, type PdxValue } from './lore';
import { decodeDds, encodePng } from './flagrender';
import { parsePdxBinary, meshParts, renderParts, gigaBlokkatPixel, type MeshPart, type RgbaImage } from './portrait-render';

export interface ModRoot { id: string; name: string; root: string; enabled: boolean }
export const MOD_ROLES = ['ruler', 'governor', 'admiral', 'general', 'scientist'] as const;
export type ModRole = (typeof MOD_ROLES)[number];

// ── 1. 모드 폴더 ──
const str = (s: string, key: string): string => { const m = new RegExp('^\\s*' + key + '\\s*=\\s*"([^"]*)"', 'm').exec(s); return m ? m[1] : ''; };
/** .mod 기술 파일 → 모드 폴더(path=, 상대 경로면 사용자 폴더 기준). 압축(archive=)만 있거나 폴더가 없으면 null. */
export function modRootFromDescriptor(text: string, userDir: string, file: string): ModRoot | null {
  const p = str(text, 'path'); if (!p) return null;
  const root = path.isAbsolute(p) ? p : path.resolve(userDir, p);
  const id = str(text, 'remote_file_id') || path.basename(file, '.mod');
  return { id, name: str(text, 'name') || id, root, enabled: false };
}
/** 켜진 모드(로드 순서대로) 뒤에 꺼진 모드. 연결 모드(sllm_missive)는 초상화가 없어 빼지 않아도 되지만 빠르게 건너뜀. */
export function listModRoots(userDir: string, exists: (p: string) => boolean = fs.existsSync): ModRoot[] {
  const modDir = path.join(userDir, 'mod');
  let enabled: string[] = [];
  try { const j = JSON.parse(fs.readFileSync(path.join(userDir, 'dlc_load.json'), 'utf8')); if (Array.isArray(j?.enabled_mods)) enabled = j.enabled_mods.filter((x: unknown) => typeof x === 'string'); } catch { /* 런처를 쓴 적 없음 */ }
  let all: string[] = [];
  try { all = fs.readdirSync(modDir).filter((f) => /\.mod$/i.test(f)).map((f) => 'mod/' + f); } catch { /* mod 폴더 없음 */ }
  const order = [...enabled, ...all.filter((f) => !enabled.includes(f))];
  const out: ModRoot[] = [], seen = new Set<string>();
  for (const rel of order) {
    let r: ModRoot | null = null;
    try { r = modRootFromDescriptor(fs.readFileSync(path.join(userDir, rel), 'utf8'), userDir, rel); } catch { continue; }
    if (!r || seen.has(r.root) || !exists(r.root) || /sllm_missive/i.test(r.root)) continue;
    seen.add(r.root); r.enabled = enabled.includes(rel); out.push(r);
  }
  return out;
}

// ── 2. 정의 모으기 ──
export interface PortraitDef { key: string; entity: string; clothes: string; attachment: string; textures: string[]; texturefile: string; root: number }
export interface MeshSetting { name: string; index: number; diffuse: string; normal: string; specular: string; shader: string }
export interface MeshDef { name: string; file: string; dir: string; settings: MeshSetting[] }
export interface EntityDef { name: string; pdxmesh: string; clone: string }
export interface PortraitIndexData {
  portraits: Record<string, PortraitDef>; groups: Record<string, string[]>; groupDefault: Record<string, string>;
  selectors: Record<string, PdxEntry[]>; entities: Record<string, EntityDef>; meshes: Record<string, MeshDef>;
}
const val = (e: PdxValue | undefined): string => (typeof e === 'string' ? e : '');
const blk = (e: PdxValue | undefined): PdxEntry[] => (Array.isArray(e) ? e : []);
// 키는 대소문자를 가리지 않는다(게임과 같음). 2026-11-08 테스터 신고: Voyage to Eternity 초상화가 `textureFile` 로 적혀 있어 10개가 전부 실패했다.
const lc = (k: string): string => (typeof k === 'string' ? k.toLowerCase() : '');
const get = (e: PdxEntry[], k: string) => { const kk = k.toLowerCase(); return e.find((x) => lc(x[0]) === kk)?.[1]; };
function listFiles(dir: string, exts: RegExp, depth = 6): string[] {
  const out: string[] = [];
  const walk = (d: string, n: number) => {
    let ents: fs.Dirent[]; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory()) { if (n > 0) walk(p, n - 1); } else if (exts.test(e.name)) out.push(p); }
  };
  walk(dir, depth); return out;
}
const readText = (f: string): string => { try { const b = fs.readFileSync(f); return b.length > 4_000_000 ? '' : b.toString('utf8'); } catch { return ''; } };

/** roots = [게임, 모드(로드 순서)…]. 뒤의 것이 앞의 같은 이름 정의를 덮는다(게임 규칙과 같음). */
export function buildPortraitIndex(roots: string[]): PortraitIndexData {
  const ix: PortraitIndexData = { portraits: {}, groups: {}, groupDefault: {}, selectors: {}, entities: {}, meshes: {} };
  roots.forEach((root, ri) => {
    for (const f of listFiles(path.join(root, 'gfx', 'portraits', 'portraits'), /\.txt$/i, 2)) {
      let top: PdxEntry[]; try { top = parsePdx(readText(f)); } catch { continue; }
      for (const [k, v] of top) {
        if (lc(k) === 'portraits') for (const [key, body] of blk(v)) {
          const b = blk(body); if (!key || !b.length) continue;
          const tex = blk(get(b, 'character_textures')).map(([a, bb]) => a || val(bb)).filter((s) => /\.dds$/i.test(s));
          ix.portraits[key] = { key, entity: val(get(b, 'entity')), clothes: val(get(b, 'clothes_selector')), attachment: val(get(b, 'attachment_selector')), textures: tex, texturefile: val(get(b, 'texturefile')), root: ri };
        }
        if (lc(k) === 'portrait_groups') for (const [g, body] of blk(v)) {
          const b = blk(body); if (!g) continue;
          const mem = new Set<string>(); const d = val(get(b, 'default')); if (d) { ix.groupDefault[g] = d; mem.add(d); }
          const collect = (e: PdxEntry[]) => { for (const [kk, vv] of e) { if (lc(kk) === 'portraits') for (const [p] of blk(vv)) { if (p) mem.add(p); } else if (Array.isArray(vv)) collect(vv); } };
          collect(b); ix.groups[g] = [...mem];
        }
      }
    }
    for (const f of listFiles(path.join(root, 'gfx', 'portraits', 'asset_selectors'), /\.txt$/i, 2)) {
      let top: PdxEntry[]; try { top = parsePdx(readText(f)); } catch { continue; }
      for (const [k, v] of top) if (k && Array.isArray(v)) ix.selectors[k] = v;
    }
    for (const f of listFiles(path.join(root, 'gfx', 'models', 'portraits'), /\.(asset|gfx)$/i, 6)) {
      let top: PdxEntry[]; try { top = parsePdx(readText(f)); } catch { continue; }
      const dir = path.dirname(f);
      const take = (e: PdxEntry[]) => {
        for (const [k, v] of e) {
          if (lc(k) === 'objecttypes') take(blk(v));
          else if (lc(k) === 'entity') { const b = blk(v), n = val(get(b, 'name')); if (n) ix.entities[n] = { name: n, pdxmesh: val(get(b, 'pdxmesh')), clone: val(get(b, 'clone')) }; }
          else if (lc(k) === 'pdxmesh') {
            const b = blk(v), n = val(get(b, 'name')); if (!n) continue;
            const settings = b.filter((x) => lc(x[0]) === 'meshsettings').map(([, s]) => { const sb = blk(s); return { name: val(get(sb, 'name')), index: Number(val(get(sb, 'index')) || 0), diffuse: val(get(sb, 'texture_diffuse')), normal: val(get(sb, 'texture_normal')), specular: val(get(sb, 'texture_specular')), shader: val(get(sb, 'shader')) }; });
            ix.meshes[n] = { name: n, file: val(get(b, 'file')), dir, settings };
          }
        }
      };
      take(top);
    }
  });
  return ix;
}

// ── 3. 그리기 계획 ──
const condText = (v: PdxValue): string => (Array.isArray(v) ? v.map(([k, x]) => k + ' = ' + condText(x)).join(' ') : String(v));
/** 옷·머리 선택자에서 역할에 맞는 텍스처 경로. "no_texture"·없음 = ''. */
export function selectorTexture(sel: PdxEntry[] | undefined, role: ModRole | 'default'): string {
  if (!sel) return '';
  const def = val(get(sel, 'default')), sp = val(get(blk(get(sel, 'species')), 'default'));
  const ruler = blk(get(sel, 'ruler')), leader = blk(get(sel, 'leader'));
  const inLeader = (re: RegExp, not?: RegExp) => leader.find(([k, v]) => /\.dds$/i.test(k) && re.test(condText(v)) && !(not && not.test(condText(v))))?.[0] ?? '';
  if (role === 'ruler') return val(get(ruler, 'default')) || sp || def;
  if (role === 'scientist') return inLeader(/scientist/) || def;
  if (role === 'general') return inLeader(/general_uniform = yes|leader_class = general/) || inLeader(/commander/) || def;
  if (role === 'admiral') return inLeader(/commander/, /general_uniform = yes/) || inLeader(/admiral/) || def;
  if (role === 'governor') return inLeader(/official|governor/) || def;
  return sp || def;
}
export type PartKind = 'body' | 'clothes' | 'hair' | 'giga_blokkat' | 'unknown';
export function partKind(shader: string): PartKind {
  if (/^GigaBlokkat/i.test(shader)) return 'giga_blokkat';
  if (/^PdxMeshPortrait/i.test(shader)) return /Clothes/i.test(shader) ? 'clothes' : /Hair|Attachment/i.test(shader) ? 'hair' : 'body';
  return 'unknown';
}
export interface PartPlan { name: string; kind: PartKind; diffuse: string; normal: string; specular: string; shader: string }
export interface RenderPlan { key: string; root: number; meshFile: string; texturefile: string; parts: PartPlan[]; roles: Record<string, { clothes: string; hair: string }>; status: 'ok' | 'approx' }

export class PortraitResolver {
  constructor(public roots: string[], public ix: PortraitIndexData) {}
  /** 게임 상대 경로(gfx/…)를 뒤에서부터(마지막 모드가 우선) 찾는다. */
  file(rel: string): string | null {
    if (!rel) return null;
    const r = rel.replace(/\\/g, '/').replace(/^\/+/, '');
    for (let i = this.roots.length - 1; i >= 0; i--) { const p = path.join(this.roots[i], r); if (fs.existsSync(p)) return p; }
    return null;
  }
  /** 텍스처 이름 → 실제 파일. 경로가 있으면 겹친 폴더에서, 이름만 있으면 .gfx 폴더 → mesh 폴더 순. */
  tex(name: string, ...dirs: string[]): string {
    if (!name || /^no(normal|spec)?\.dds$/i.test(name) || /\.psd$/i.test(name)) return '';
    if (/[\\/]/.test(name)) return this.file(name) ?? '';
    for (const d of dirs) { const p = path.join(d, name); if (fs.existsSync(p)) return p; }
    return '';
  }
  /** 그룹 이름이면 기본 초상화로 바꾼다. */
  memberKeys(key: string): string[] { return this.ix.portraits[key] ? [key] : (this.ix.groups[key] ?? []).filter((k) => this.ix.portraits[k]); }
  entityMesh(name: string, depth = 0): MeshDef | null {
    const e = this.ix.entities[name]; if (!e || depth > 5) return null;
    const m = e.pdxmesh ? this.ix.meshes[e.pdxmesh] : null;
    return m ?? (e.clone ? this.entityMesh(e.clone, depth + 1) : null);
  }
  plan(key: string): RenderPlan | { key: string; error: string } {
    const d = this.ix.portraits[key]; if (!d) return { key, error: 'no_definition' };
    const roles: RenderPlan['roles'] = {};
    const clothesSel = d.clothes && d.clothes !== 'no_texture' ? this.ix.selectors[d.clothes] : undefined;
    const hairSel = d.attachment && d.attachment !== 'no_texture' ? this.ix.selectors[d.attachment] : undefined;
    for (const r of MOD_ROLES) roles[r] = { clothes: this.tex(selectorTexture(clothesSel, r)), hair: this.tex(selectorTexture(hairSel, r)) };
    // 역할 텍스처 파일이 없으면(모드가 빠뜨림) 기본 → 통치자 → 아무거나 순으로 대신 입힌다(옷이 통째로 사라지지 않게).
    const fallback = (k: 'clothes' | 'hair') => this.tex(selectorTexture(k === 'clothes' ? clothesSel : hairSel, 'default')) || MOD_ROLES.map((r) => roles[r][k]).find(Boolean) || '';
    for (const r of MOD_ROLES) for (const k of ['clothes', 'hair'] as const) if (!roles[r][k]) roles[r][k] = fallback(k);
    if (d.texturefile) { const tf = this.file(d.texturefile); return tf ? { key, root: d.root, meshFile: '', texturefile: tf, parts: [], roles, status: 'ok' } : { key, error: 'texturefile_missing' }; }
    const m = this.entityMesh(d.entity); if (!m) return { key, error: 'no_entity:' + d.entity };
    const meshFile = this.file(m.file); if (!meshFile) return { key, error: 'mesh_missing:' + m.file };
    let parts: MeshPart[]; try { parts = meshParts(parsePdxBinary(new Uint8Array(fs.readFileSync(meshFile)))); } catch (e) { return { key, error: 'mesh_parse' }; }
    const body = d.textures.length ? this.tex(d.textures[0]) : '';
    let status: RenderPlan['status'] = 'ok';
    const pp: PartPlan[] = parts.map((p) => {
      const ms = m.settings.find((s) => s.name === p.name) ?? m.settings.find((s) => !s.name);
      const shader = ms?.shader || p.shader, kind = partKind(shader);
      if (kind === 'unknown') status = 'approx';
      const own = this.tex(ms?.diffuse || p.diff, m.dir, path.dirname(meshFile));
      return { name: p.name, kind, shader, diffuse: kind === 'body' || kind === 'giga_blokkat' || kind === 'unknown' ? body || own : own,
        normal: this.tex(ms?.normal ?? '', m.dir, path.dirname(meshFile)), specular: this.tex(ms?.specular ?? '', m.dir, path.dirname(meshFile)) };
    });
    return { key, root: d.root, meshFile, texturefile: '', parts: pp, roles, status };
  }
}

// ── 4. 그리기 ──
export interface RenderedRole { role: ModRole; png: Buffer }
export class TextureCache {
  private m = new Map<string, RgbaImage | null>();
  get(f: string): RgbaImage | null {
    if (!f) return null;
    if (!this.m.has(f)) { let img: RgbaImage | null = null; try { img = decodeDds(fs.readFileSync(f)); } catch { img = null; } this.m.set(f, img); if (this.m.size > 80) this.m.delete(this.m.keys().next().value as string); }
    return this.m.get(f) ?? null;
  }
}
/** 투명한 여백을 뺀 영역(알파 > 8). 다 투명하거나 다 불투명하면 그림 전체. */
export function opaqueBox(img: RgbaImage): { x: number; y: number; w: number; h: number } {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? { x: 0, y: 0, w: img.w, h: img.h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** 2D 그림(texturefile) → 240x270 액자에 맞춰 아래 정렬. 투명한 여백은 먼저 잘라낸다
 *  (2026-11-08: Voyage to Eternity 초상화는 1280x380 한 장 가운데에 인물이 있어, 자르지 않으면 인물이 아주 작게 나왔다). */
function fit2d(img: RgbaImage, W = 240, H = 270): RgbaImage {
  const b = opaqueBox(img);
  const s = Math.min(W / b.w, H / b.h), w = Math.max(1, Math.round(b.w * s)), h = Math.max(1, Math.round(b.h * s)), ox = Math.floor((W - w) / 2), oy = H - h;
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = b.x + Math.min(b.w - 1, Math.floor(x / s)), sy = b.y + Math.min(b.h - 1, Math.floor(y / s)), si = (sy * img.w + sx) * 4, di = ((y + oy) * W + x + ox) * 4; for (let c = 0; c < 4; c++) px[di + c] = img.px[si + c]; }
  return { w: W, h: H, px };
}
/** 계획대로 역할마다 그린다. 옷·머리 텍스처가 같은 역할은 한 번만 그리고 같은 그림을 쓴다. */
export function renderPlan(plan: RenderPlan, tc: TextureCache): { roles: Partial<Record<ModRole, Buffer>>; empty: boolean } {
  const out: Partial<Record<ModRole, Buffer>> = {};
  if (plan.texturefile) { const t = tc.get(plan.texturefile); if (!t) return { roles: out, empty: true }; const png = encodePng(fit2d(t)); for (const r of MOD_ROLES) out[r] = png; return { roles: out, empty: false }; }
  const parts = meshParts(parsePdxBinary(new Uint8Array(fs.readFileSync(plan.meshFile))));
  const byName = new Map(plan.parts.map((p) => [p.name, p]));
  const giga = plan.parts.some((p) => p.kind === 'giga_blokkat');
  const is3d = parts.some((p) => p.max[2] - p.min[2] > 0.05);
  const done = new Map<string, Buffer>();
  let anyPixels = false;
  for (const role of MOD_ROLES) {
    const rr = plan.roles[role], sig = rr.clothes + '|' + rr.hair;
    if (done.has(sig)) { out[role] = done.get(sig)!; continue; }
    const img = renderParts(parts, {
      w: 240, h: 270, zFront: -1, ...(is3d ? { yaw: -35, pitch: -12 } : {}), light: giga ? false : undefined,
      skip: (p) => { const pl = byName.get(p.name); return !!pl && pl.kind === 'hair' && !rr.hair && !pl.diffuse; },
      pixel: (p) => {
        const pl = byName.get(p.name); if (!pl || pl.kind !== 'giga_blokkat') return null;
        const pat = tc.get(pl.normal), mask = tc.get(pl.specular), col = tc.get(pl.diffuse);
        return pat && mask && col ? gigaBlokkatPixel(pat, mask, col, 0, 0, /Vertical/i.test(pl.shader)) : null;
      },
      textureFor: (p) => {
        const pl = byName.get(p.name); if (!pl) return null;
        if (pl.kind === 'clothes') return tc.get(rr.clothes || pl.diffuse);
        if (pl.kind === 'hair') return tc.get(rr.hair || pl.diffuse);
        return tc.get(pl.diffuse);
      },
    });
    for (let i = 3; i < img.px.length; i += 4) if (img.px[i]) { anyPixels = true; break; }
    const png = encodePng(img); done.set(sig, png); out[role] = png;
  }
  return { roles: out, empty: !anyPixels };
}

// ── 5. 라이브러리 파일(portraitlib 형식) ──
export const modFileBase = (key: string): string => ('mod_' + key.replace(/[^A-Za-z0-9_]/g, '_')).slice(0, 70);
export interface ModLibItem { id: string; cls: string; species: string; defaultRole: string; roles: Record<string, string>; portraits: string[]; status: 'ok' | 'approx'; mod: string }
/** 그린 결과를 out 폴더에 쓰고 library.json 항목을 돌려준다(같은 그림은 파일 하나). */
export function writeRendered(out: string, key: string, modName: string, r: { roles: Partial<Record<ModRole, Buffer>> }, status: 'ok' | 'approx'): ModLibItem | null {
  const base = modFileBase(key), roles: Record<string, string> = {}, written = new Map<Buffer, string>();
  for (const role of MOD_ROLES) {
    const png = r.roles[role]; if (!png) continue;
    let f = written.get(png);
    if (!f) { f = `${base}__${role}.png`; fs.writeFileSync(path.join(out, f), png); written.set(png, f); }
    roles[role] = f;
  }
  if (!Object.keys(roles).length) return null;
  return { id: base, cls: 'mod', species: modName.slice(0, 40), defaultRole: roles.ruler ? 'ruler' : Object.keys(roles)[0], roles, portraits: [key], status, mod: modName.slice(0, 60) };
}
