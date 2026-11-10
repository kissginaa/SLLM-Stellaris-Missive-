// 모드 초상화·초상화 렌더러 자체 검사(2026-10-26). selftest.ts 에서 runModPortraitChecks() 로 부른다.
// 임시 폴더에 작은 "게임"과 "모드"(초상화 정의·선택자·엔티티·pdxmesh·.mesh 이진·DDS)를 만들어 전 과정을 확인한다.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parsePdxBinary, meshParts, renderParts, rotateParts, gigaBlokkatPixel, sampleRgba, type RgbaImage } from './portrait-render';
import { modRootFromDescriptor, listModRoots, buildPortraitIndex, PortraitResolver, selectorTexture, partKind, renderPlan, writeRendered, TextureCache, modFileBase } from './mod-portraits';
import { parsePdx } from './lore';
import { parseLibrary } from './portraitlib';
import { Worker } from 'worker_threads';
import { runModPortraitJob, type ModPortraitJob, type ModPortraitResult } from './mod-portraits-job';

/** PDX 이진 자산 쓰기(시험용): 묶음 = [이름, 깊이, 속성들]. */
function pdxBinary(nodes: Array<{ name: string; depth: number; props?: any }>): Buffer {
  const out: Buffer[] = [Buffer.from('@@b@', 'latin1')];
  const prop = (k: string, v: number[] | string[] | { f: number[] }) => {
    const head = Buffer.concat([Buffer.from('!', 'latin1'), Buffer.from([k.length]), Buffer.from(k, 'latin1')]);
    if (!Array.isArray(v)) { const b = Buffer.alloc(5 + 4 * v.f.length); b.write('f', 0, 'latin1'); b.writeInt32LE(v.f.length, 1); v.f.forEach((x, i) => b.writeFloatLE(x, 5 + 4 * i)); return Buffer.concat([head, b]); }
    if (typeof v[0] === 'string') { const parts = [Buffer.from('s', 'latin1'), Buffer.alloc(4)]; parts[1].writeInt32LE(v.length, 0); for (const s of v as string[]) { const l = Buffer.alloc(4); l.writeInt32LE(s.length + 1, 0); parts.push(l, Buffer.from(s + '\0', 'latin1')); } return Buffer.concat([head, ...parts]); }
    const b = Buffer.alloc(5 + 4 * v.length); b.write('i', 0, 'latin1'); b.writeInt32LE(v.length, 1); (v as number[]).forEach((x, i) => b.writeInt32LE(x, 5 + 4 * i)); return Buffer.concat([head, b]);
  };
  for (const n of nodes) { out.push(Buffer.from('['.repeat(n.depth) + n.name + '\0', 'latin1')); for (const [k, v] of Object.entries(n.props ?? {})) out.push(prop(k, v as any)); }
  return Buffer.concat(out);
}
/** 평평한 사각 카드 하나(x0..x1, y0..y1, 깊이 z). */
function card(name: string, x0: number, y0: number, x1: number, y1: number, z: number, shader: string, diff: string) {
  return [
    { name, depth: 2 },
    { name: 'mesh', depth: 3, props: { p: { f: [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z] }, u0: { f: [0, 1, 1, 1, 1, 0, 0, 0] }, tri: [0, 1, 2, 0, 2, 3] } },
    { name: 'material', depth: 4, props: { shader: [shader], diff: [diff] } },
  ];
}
/** 한 색으로 채운 32비트 비압축 DDS. */
function solidDds(w: number, h: number, rgba: [number, number, number, number]): Buffer {
  const b = Buffer.alloc(128 + w * h * 4); b.write('DDS ', 0, 'latin1'); b.writeUInt32LE(124, 4); b.writeUInt32LE(h, 12); b.writeUInt32LE(w, 16);
  b.writeUInt32LE(32, 76); b.writeUInt32LE(0x41, 80); b.writeUInt32LE(32, 88); b.writeUInt32LE(0x00ff0000, 92); b.writeUInt32LE(0x0000ff00, 96); b.writeUInt32LE(0x000000ff, 100); b.writeUInt32LE(0xff000000, 104);
  for (let i = 0; i < w * h; i++) { b[128 + i * 4] = rgba[2]; b[129 + i * 4] = rgba[1]; b[130 + i * 4] = rgba[0]; b[131 + i * 4] = rgba[3]; }
  return b;
}
const put = (f: string, data: string | Buffer) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

export function runModPortraitChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'mod-portraits: ' + name); if (!ok) process.exitCode = 1; };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sllm-modpor-'));
  try {
    // ── 렌더러 기본 ──
    const bin = pdxBinary([{ name: 'object', depth: 1 }, ...card('backShape', -1, 0, 1, 2, 0.5, 'PdxMeshPortrait', 'a.dds'), ...card('frontShape', -0.5, 0, 0.5, 1, -0.5, 'PdxMeshPortraitClothes', 'b.dds')]);
    const root = parsePdxBinary(new Uint8Array(bin));
    const parts = meshParts(root);
    check(parts.length === 2 && parts[0].name === 'backShape' && parts[1].shader === 'PdxMeshPortraitClothes' && parts[0].tri.length === 6, 'parse PDX binary mesh parts');
    check((() => { try { parsePdxBinary(new Uint8Array(Buffer.from('nope'))); return false; } catch { return true; } })(), 'reject non-PDX file');
    const red: RgbaImage = { w: 2, h: 2, px: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]) };
    const blue: RgbaImage = { w: 2, h: 2, px: new Uint8Array([0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255]) };
    const img = renderParts(parts, { w: 40, h: 45, zFront: -1, textureFor: (p) => (p.name === 'backShape' ? red : blue) });
    const at = (x: number, y: number) => Array.from(img.px.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4));
    check(at(20, 40)[2] === 255 && at(20, 40)[0] === 0, 'front card (smaller z) drawn over back card');
    check(at(5, 15)[0] === 255 && at(5, 15)[2] === 0, 'back card visible where front card is absent');
    check(at(0, 0)[3] === 0 || at(39, 0)[3] === 0, 'transparent outside model');
    const flip = renderParts(parts, { w: 40, h: 45, zFront: 1, textureFor: (p) => (p.name === 'backShape' ? red : blue) });
    check(flip.px[(40 * 40 + 20) * 4] === 255, 'zFront flips draw order');
    const rot = rotateParts(parts, 90, 0);
    check(Math.abs(rot[0].max[2] - rot[0].min[2]) > 1 && !!rot[0].src, 'rotate around vertical axis keeps source coords');
    const pat: RgbaImage = { w: 1, h: 1, px: new Uint8Array([255, 0, 0, 255]) }, mask: RgbaImage = { w: 1, h: 1, px: new Uint8Array([255, 0, 0, 255]) }, col: RgbaImage = { w: 4, h: 1, px: new Uint8Array([0, 200, 0, 255, 0, 200, 0, 255, 0, 200, 0, 255, 0, 200, 0, 255]) };
    const gp = gigaBlokkatPixel(pat, mask, col)(0.5, 0.5, 0, 0)!;
    check(gp[1] > 150 && gp[0] < 10 && gp[3] === 255, 'Gigastructures blokkat shader takes colour from gradient');
    check(sampleRgba(red, 0.3, 0.3)[0] === 255, 'bilinear sample');

    // ── 모드 폴더 ──
    const user = path.join(tmp, 'user'), game = path.join(tmp, 'game'), modA = path.join(tmp, 'ws', '111'), modB = path.join(tmp, 'ws', '222');
    put(path.join(user, 'mod', 'ugc_111.mod'), `name="Mod A"\npath="${modA.replace(/\\/g, '/')}"\nremote_file_id="111"\n`);
    put(path.join(user, 'mod', 'ugc_222.mod'), `name="Mod B"\npath="${modB.replace(/\\/g, '/')}"\nremote_file_id="222"\n`);
    put(path.join(user, 'mod', 'local.mod'), `name="Zip only"\narchive="x.zip"\n`);
    put(path.join(user, 'dlc_load.json'), JSON.stringify({ enabled_mods: ['mod/ugc_222.mod'], disabled_dlcs: [] }));
    fs.mkdirSync(modA, { recursive: true }); fs.mkdirSync(modB, { recursive: true });
    const roots = listModRoots(user);
    check(roots.length === 2 && roots[0].id === '222' && roots[0].enabled && !roots[1].enabled, 'enabled mods first, then other installed, archive-only skipped');
    check(modRootFromDescriptor('name="X"\npath="rel/dir"\n', user, 'mod/x.mod')?.root === path.resolve(user, 'rel/dir'), 'relative mod path resolved against user dir');

    // ── 게임(바닐라 메시) + 모드 A(바닐라 메시를 빌려 텍스처만) + 모드 B(자체 메시·선택자) ──
    put(path.join(game, 'gfx/models/portraits/human/human_test.mesh'), pdxBinary([{ name: 'object', depth: 1 }, ...card('bodyShape', -1, 0, 1, 2, 0, 'PdxMeshPortrait', 'body.dds'), ...card('hairShape', -1, 1.5, 1, 2.2, -0.2, 'PdxMeshPortraitHair', 'hair.dds'), ...card('outfitShape', -1, 0, 1, 1, -0.4, 'PdxMeshPortraitClothes', 'cloth.dds')]));
    put(path.join(game, 'gfx/models/portraits/human/body.dds'), solidDds(4, 4, [200, 150, 120, 255]));
    put(path.join(game, 'gfx/models/portraits/human/hair.dds'), solidDds(4, 4, [40, 30, 20, 255]));
    put(path.join(game, 'gfx/models/portraits/human/cloth.dds'), solidDds(4, 4, [10, 10, 90, 255]));
    put(path.join(game, 'gfx/models/portraits/human/_human.gfx'), 'objectTypes = { pdxmesh = { name = "human_test_mesh" file = "gfx/models/portraits/human/human_test.mesh" } }');
    put(path.join(game, 'gfx/models/portraits/human/_human.asset'), 'entity = { name = "human_test_entity" pdxmesh = "human_test_mesh" }');
    put(path.join(game, 'gfx/portraits/portraits/00_test.txt'), 'portraits = { human_test = { entity = "human_test_entity" clothes_selector = "no_texture" attachment_selector = "no_texture" } }\nportrait_groups = { human_grp = { default = human_test } }');
    // 모드 A: 바닐라 메시 + 자기 텍스처(meshsettings) — ACOT 방식
    put(path.join(modA, 'gfx/models/portraits/acot/acot.gfx'), 'objectTypes = { pdxmesh = { name = "acot_mesh" file = "gfx/models/portraits/human/human_test.mesh" meshsettings = { name = "bodyShape" index = 0 texture_diffuse = "acot_body.dds" shader = "PdxMeshPortrait" } } }');
    put(path.join(modA, 'gfx/models/portraits/acot/acot.asset'), '@s = 0.8\nentity = { name = "acot_entity" pdxmesh = "acot_mesh" scale = @s }');
    put(path.join(modA, 'gfx/models/portraits/acot/acot_body.dds'), solidDds(4, 4, [0, 255, 0, 255]));
    put(path.join(modA, 'gfx/models/portraits/acot/acot_ruler.dds'), solidDds(4, 4, [255, 255, 0, 255]));
    put(path.join(modA, 'gfx/models/portraits/acot/acot_sci.dds'), solidDds(4, 4, [255, 0, 255, 255]));
    put(path.join(modA, 'gfx/portraits/asset_selectors/acot_clothes.txt'), 'acot_clothes = { default = "gfx/models/portraits/acot/acot_ruler.dds" ruler = { default = "gfx/models/portraits/acot/acot_ruler.dds" } leader = { "gfx/models/portraits/acot/acot_sci.dds" = { leader_class = scientist } } }');
    put(path.join(modA, 'gfx/portraits/portraits/acot.txt'), 'portraits = { acot_male = { entity = "acot_entity" clothes_selector = "acot_clothes" attachment_selector = "no_texture" } }');
    // 모드 B: 정의가 이름만 있고 엔티티가 없음 → 실패 기록 / 같은 키를 덮어씀
    put(path.join(modB, 'gfx/portraits/portraits/b.txt'), 'portraits = { broken_key = { entity = "missing_entity" } }');
    const order = [game, roots[1].root, roots[0].root]; // 꺼진 모드(A) → 켜진 모드(B)
    const ix = buildPortraitIndex(order);
    check(!!ix.portraits.human_test && !!ix.portraits.acot_male && ix.groups.human_grp?.includes('human_test'), 'index collects portraits and groups from game and mods');
    check(ix.meshes.acot_mesh?.settings[0]?.diffuse === 'acot_body.dds' && ix.entities.acot_entity?.pdxmesh === 'acot_mesh', 'index reads pdxmesh meshsettings and entities');
    const rv = new PortraitResolver(order, ix);
    check(rv.memberKeys('human_grp')[0] === 'human_test' && rv.memberKeys('nothing').length === 0, 'group resolves to members');
    const sel = parsePdx(fs.readFileSync(path.join(modA, 'gfx/portraits/asset_selectors/acot_clothes.txt'), 'utf8'))[0][1] as any;
    check(selectorTexture(sel, 'ruler').endsWith('acot_ruler.dds') && selectorTexture(sel, 'scientist').endsWith('acot_sci.dds') && selectorTexture(sel, 'admiral').endsWith('acot_ruler.dds'), 'selector picks texture per role');
    check(partKind('PdxMeshPortraitClothes') === 'clothes' && partKind('PdxMeshPortraitHair') === 'hair' && partKind('GigaBlokkatAnimateUV') === 'giga_blokkat' && partKind('Weird') === 'unknown', 'shader kinds');
    const plan = rv.plan('acot_male');
    check(!('error' in plan) && plan.meshFile.endsWith('human_test.mesh') && plan.parts.find((p) => p.name === 'bodyShape')!.diffuse.endsWith('acot_body.dds'), 'mod borrows vanilla mesh, body texture from meshsettings next to .gfx');
    check(!('error' in plan) && plan.roles.scientist.clothes.endsWith('acot_sci.dds') && plan.roles.ruler.clothes.endsWith('acot_ruler.dds'), 'plan has per-role clothes');
    fs.renameSync(path.join(modA, 'gfx/models/portraits/acot/acot_sci.dds'), path.join(modA, 'gfx/models/portraits/acot/acot_sci.bak'));
    const plan2 = rv.plan('acot_male');
    check(!('error' in plan2) && plan2.roles.scientist.clothes.endsWith('acot_ruler.dds'), 'missing role texture falls back to default outfit');
    fs.renameSync(path.join(modA, 'gfx/models/portraits/acot/acot_sci.bak'), path.join(modA, 'gfx/models/portraits/acot/acot_sci.dds'));
    const bad = rv.plan('broken_key');
    check('error' in bad && /no_entity/.test(bad.error), 'missing entity reported, not thrown');
    const tc = new TextureCache();
    const r = renderPlan(plan as any, tc);
    check(!r.empty && !!r.roles.ruler && pngSize(r.roles.ruler!)[0] === 240 && pngSize(r.roles.ruler!)[1] === 270, 'render 240x270 PNG');
    check(r.roles.ruler !== r.roles.scientist && r.roles.admiral === r.roles.ruler, 'same outfit shares one picture, different outfit drawn separately');
    const out = path.join(tmp, 'out'); fs.mkdirSync(out);
    const item = writeRendered(out, 'acot_male', 'Mod A', r, 'ok')!;
    check(item.id === 'mod_acot_male' && item.defaultRole === 'ruler' && item.portraits[0] === 'acot_male' && fs.existsSync(path.join(out, item.roles.ruler)), 'write rendered files + library item');
    const lib = parseLibrary({ items: [item] }, true);
    check(lib.items.length === 1 && lib.items[0].roles.scientist?.endsWith('.png'), 'mod library accepts png pictures');
    check(parseLibrary({ items: [item] }).items.length === 0, 'vanilla library still WebP only');
    check(modFileBase('a/b c..d') === 'mod_a_b_c__d' && /^[A-Za-z0-9_]+$/.test(modFileBase('../../evil')), 'file names stay inside folder');
    const vplan = rv.plan('human_test');
    const vr = !('error' in vplan) ? renderPlan(vplan, tc) : null;
    check(!!vr && !vr.empty, 'vanilla-only portrait (no selectors) renders');
    // ── 그리기 작업(2026-10-27): 본 스레드(쉬어 가며)와 작업 스레드가 같은 결과 ──
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sllm-modpor-job-')); fs.cpSync(tmp, tmp2, { recursive: true });
    void portraitJobChecks(check, tmp2, order.map((d) => tmp2 + d.slice(tmp.length)));
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 임시 폴더 */ } }
}
async function portraitJobChecks(check: (ok: boolean, name: string) => void, tmp: string, roots: string[]): Promise<void> {
  try {
    const job = (out: string): ModPortraitJob => { fs.mkdirSync(out, { recursive: true }); return { roots, modNames: ['Mod A', 'Mod B'], keys: ['acot_male', 'human_grp', 'broken_key'], baseKeys: [], seen: [], redraw: false, outDir: out }; };
    const prog: number[] = [];
    const a = await runModPortraitJob(job(path.join(tmp, 'o1')), (d) => prog.push(d), () => new Promise((res) => setImmediate(res)));
    const ok = (x: ModPortraitResult) => x.total === 3 && x.results.some((o) => o.key === 'acot_male' && o.item?.id === 'mod_acot_male') && x.results.some((o) => o.key === 'broken_key' && !!o.error) && x.groups.human_grp?.[0] === 'human_test';
    check(ok(a) && prog[prog.length - 1] === 3 && fs.existsSync(path.join(tmp, 'o1', a.results.find((o) => o.item)!.item!.roles.ruler)), 'portrait job (main thread): draws, records failures, groups, progress');
    const skip = await runModPortraitJob({ ...job(path.join(tmp, 'o2')), seen: ['acot_male', 'human_test', 'broken_key'] });
    check(skip.total === 0, 'portrait job skips keys already drawn unless redraw');
    const script = path.join(__dirname, 'mod-portraits-worker.js'); // 컴파일된 dist 에서 돌릴 때만
    if (fs.existsSync(script)) {
      const b = await new Promise<ModPortraitResult | null>((res) => { const w = new Worker(script, { workerData: job(path.join(tmp, 'o3')) }); w.on('message', (m) => { if (m?.t === 'r') res(m.result); else if (m?.t === 'e') res(null); }); w.once('error', () => res(null)); });
      check(!!b && ok(b) && JSON.stringify(b.results.map((o) => [o.key, o.item?.id ?? o.error])) === JSON.stringify(a.results.map((o) => [o.key, o.item?.id ?? o.error])), 'portrait job in a worker thread gives the same result');
    }
  } catch (e) { check(false, 'portrait job threw: ' + String((e as Error)?.message ?? e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 임시 폴더 */ } }
}
if (require.main === module) runModPortraitChecks();
