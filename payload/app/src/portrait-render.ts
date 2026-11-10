// 초상화 렌더러(2026-10-26): 게임의 PDX .mesh(초상화 모델)를 읽어 텍스처를 입혀 한 장으로 그린다. 순수 로직(electron·node 없이).
// 스텔라리스 초상화는 평평한 카드(조각) 여러 장을 z 깊이별로 겹친 2.5D 모델이다 → 정사영(앞에서 본 모습)으로 그리면 게임 초상화와 같은 모습.
// 뼈대(스켈레톤)는 쓰지 않는다: 정점은 이미 기본 자세(바인드 포즈) 위치에 있다. 애니메이션 없음(한 장).
// 쓰는 곳: 모드 초상화 불러오기(docs/MOD_PORTRAIT_IMPORT_DESIGN_KO.md), 바닐라 포트레이트 라이브러리 다시 만들기.

export interface RgbaImage { w: number; h: number; px: Uint8Array } // flagrender 의 Img 와 같은 모양
export interface PdxNode { name: string; props: Record<string, number[] | string[]>; kids: PdxNode[] }
export interface MeshPart {
  name: string; shader: string; diff: string;
  pos: Float32Array; uv: Float32Array; tri: Uint32Array; nrm?: Float32Array;
  /** 회전 전 원래 정점(모드 셰이더가 모델 좌표를 쓸 때). */
  src?: Float32Array;
  min: [number, number, number]; max: [number, number, number];
}

/** PDX 이진 자산(.mesh·.anim 공통, '@@b@' 로 시작) → 나무 구조. 틀리면 예외. */
export function parsePdxBinary(b: Uint8Array): PdxNode {
  if (b.length < 4 || b[0] !== 0x40 || b[1] !== 0x40 || b[2] !== 0x62 || b[3] !== 0x40) throw new Error('not a PDX binary asset');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const latin = (s: number, e: number) => { let r = ''; for (let i = s; i < e; i++) r += String.fromCharCode(b[i]); return r.replace(/\0+$/, ''); };
  const root: PdxNode = { name: 'root', props: {}, kids: [] };
  const stack: Array<[number, PdxNode]> = [[0, root]];
  let p = 4;
  while (p < b.length) {
    const c = b[p];
    if (c === 0x21) { // '!' 속성
      p++; const ln = b[p++]; const name = latin(p, p + ln); p += ln;
      const t = b[p++]; const n = dv.getInt32(p, true); p += 4;
      if (n < 0 || n > 50_000_000) throw new Error('bad property size');
      let v: number[] | string[];
      if (t === 0x69) { v = new Array(n); for (let i = 0; i < n; i++, p += 4) v[i] = dv.getInt32(p, true); }      // 'i'
      else if (t === 0x66) { v = new Array(n); for (let i = 0; i < n; i++, p += 4) v[i] = dv.getFloat32(p, true); } // 'f'
      else if (t === 0x73) { v = []; for (let i = 0; i < n; i++) { const l = dv.getInt32(p, true); p += 4; (v as string[]).push(latin(p, p + l)); p += l; } } // 's'
      else throw new Error('bad property type at ' + p);
      stack[stack.length - 1][1].props[name] = v;
    } else if (c === 0x5b) { // '[' 묶음(깊이 = '[' 개수)
      let d = 0; while (b[p] === 0x5b) { d++; p++; }
      let e = p; while (e < b.length && b[e] !== 0) e++;
      const node: PdxNode = { name: latin(p, e), props: {}, kids: [] }; p = e + 1;
      while (stack[stack.length - 1][0] >= d) stack.pop();
      stack[stack.length - 1][1].kids.push(node); stack.push([d, node]);
    } else throw new Error('bad token at ' + p);
  }
  return root;
}

/** .mesh 나무 → 그릴 조각 목록(파일 순서 그대로). 스켈레톤·충돌 상자 등은 건너뜀. */
export function meshParts(root: PdxNode): MeshPart[] {
  const out: MeshPart[] = [];
  const walk = (n: PdxNode, shape: string) => {
    for (const k of n.kids) {
      if (k.name === 'mesh') {
        const pr = k.props, mat = k.kids.find((x) => x.name === 'material')?.props ?? {};
        const pos = pr.p as number[] | undefined, uv = pr.u0 as number[] | undefined, tri = pr.tri as number[] | undefined;
        if (!pos || !uv || !tri || pos.length % 3 || uv.length * 3 !== pos.length * 2) continue;
        let min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]); }
        const n = pr.n as number[] | undefined;
        out.push({ name: shape, shader: String((mat.shader as string[] | undefined)?.[0] ?? ''), diff: String((mat.diff as string[] | undefined)?.[0] ?? ''),
          pos: Float32Array.from(pos), uv: Float32Array.from(uv), tri: Uint32Array.from(tri), nrm: n && n.length === pos.length ? Float32Array.from(n) : undefined, min, max });
      } else if (k.name !== 'skeleton' && k.name !== 'locator') walk(k, k.name);
    }
  };
  walk(root, '');
  return out;
}

export interface RenderOptions {
  w: number; h: number;
  /** 조각 이름 → 텍스처(없으면 그 조각의 diff 이름으로 textures 에서 찾음). */
  textureFor: (part: MeshPart) => RgbaImage | null;
  /** 그릴 영역(모델 좌표). 없으면 모든 조각의 상자에 맞춤(아래 정렬). */
  frame?: { x0: number; y0: number; x1: number; y1: number };
  /** 앞쪽 = z 가 큰 쪽이면 1, 작은 쪽이면 -1. */
  zFront?: 1 | -1;
  /** 자동 액자 여백 비율(기본 0.05 = 바닐라 라이브러리와 같음). frame 을 주면 무시. */
  pad?: number;
  /** 'cards' = 평평한 카드를 깊이순으로 겹침(바닐라 대부분), '3d' = 픽셀 깊이 검사 + 조명(입체 모델, 예: Gigastructures 블록 고양이). 없으면 자동(두께가 있는 조각이 있으면 3d). */
  mode?: 'cards' | '3d';
  /** 입체 모델 회전(도): yaw = 세로축, pitch = 가로축. 모델 가운데 기준. 카드형에는 쓰지 않음. */
  yaw?: number; pitch?: number;
  /** 입체 모드 조명(기본 켜짐). 조명 없는 셰이더(예: Gigastructures 블록 고양이)는 끔. */
  light?: boolean;
  /** 모드 전용 셰이더 흉내: 이 조각의 픽셀 색을 직접 계산(u,v = UV0, mx,my,mz = 원래 모델 좌표). null 이면 textureFor 로. 결과는 0~255 RGBA. */
  pixel?: (part: MeshPart) => ((u: number, v: number, mx: number, my: number, mz: number) => [number, number, number, number] | null) | null;
  /** 이 조각은 그리지 않음(예: 그림자·숨김 조각). */
  skip?: (part: MeshPart) => boolean;
}

/** 정사영으로 그림: 조각마다 삼각형을 텍스처 입혀 채우고, 알파로 겹친다. 같은 깊이는 파일 순서. */
export function renderParts(parts: MeshPart[], o: RenderOptions): RgbaImage {
  const W = o.w, H = o.h, px = new Uint8Array(W * H * 4), zf = o.zFront ?? 1;
  let vis = parts.filter((p) => !(o.skip?.(p)));
  if (o.yaw || o.pitch) vis = rotateParts(vis, o.yaw ?? 0, o.pitch ?? 0);
  let f = o.frame;
  if (!f) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of vis) { x0 = Math.min(x0, p.min[0]); y0 = Math.min(y0, p.min[1]); x1 = Math.max(x1, p.max[0]); y1 = Math.max(y1, p.max[1]); }
    // 액자 비율에 맞추고 아래를 붙인다(흉상).
    const s = Math.max((x1 - x0) / W, (y1 - y0) / H), cx = (x0 + x1) / 2;
    f = { x0: cx - (s * W) / 2, x1: cx + (s * W) / 2, y0, y1: y0 + s * H };
    // 바닐라 라이브러리(2026-10-17)와 같은 여백: 가운데를 기준으로 95% 크기(위·아래·옆 약 2.5%).
    const pad = o.pad ?? 0.05, k = 1 / (1 - pad), mx = (f.x0 + f.x1) / 2, my = (f.y0 + f.y1) / 2;
    f = { x0: mx - (mx - f.x0) * k, x1: mx + (f.x1 - mx) * k, y0: my - (my - f.y0) * k, y1: my + (f.y1 - my) * k };
  }
  const sx = W / (f.x1 - f.x0), sy = H / (f.y1 - f.y0);
  const is3d = o.mode ? o.mode === '3d' : vis.some((p) => p.max[2] - p.min[2] > 0.05);
  // 입체: 깊이 d = -zFront·z (작을수록 앞). 조명은 앞·왼쪽 위에서.
  const zb = is3d ? new Float32Array(W * H).fill(Infinity) : null;
  const L = (() => { const v = [-0.45, 0.6, zf * 1.0], l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l); })();
  // 깊이 순서: 뒤 → 앞. 조각 전체의 평균 z 로 정렬(조각들이 평평한 카드라 충분).
  const order = vis.map((p, i) => ({ p, i, z: ((p.min[2] + p.max[2]) / 2) * zf })).sort((a, b) => a.z - b.z || a.i - b.i);
  for (const { p } of order) {
    const fn = o.pixel?.(p) ?? null;
    const tex = fn ? null : o.textureFor(p); if (!tex && !fn) continue;
    const { pos, uv, tri } = p, src = p.src ?? p.pos;
    for (let t = 0; t + 2 < tri.length; t += 3) {
      const ia = tri[t], ib = tri[t + 1], ic = tri[t + 2];
      const ax = (pos[ia * 3] - f.x0) * sx, ay = (f.y1 - pos[ia * 3 + 1]) * sy;
      const bx = (pos[ib * 3] - f.x0) * sx, by = (f.y1 - pos[ib * 3 + 1]) * sy;
      const cx = (pos[ic * 3] - f.x0) * sx, cy = (f.y1 - pos[ic * 3 + 1]) * sy;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      const ua = uv[ia * 2], va = uv[ia * 2 + 1], ub = uv[ib * 2], vb = uv[ib * 2 + 1], uc = uv[ic * 2], vc = uv[ic * 2 + 1];
      const da = -zf * pos[ia * 3 + 2], db = -zf * pos[ib * 3 + 2], dc = -zf * pos[ic * 3 + 2];
      let shade = 1;
      if (zb && o.light !== false) { // 면 조명(정점 법선 평균, 없으면 면 법선)
        const nr = p.nrm;
        let nx: number, ny: number, nz: number;
        if (nr) { nx = nr[ia * 3] + nr[ib * 3] + nr[ic * 3]; ny = nr[ia * 3 + 1] + nr[ib * 3 + 1] + nr[ic * 3 + 1]; nz = nr[ia * 3 + 2] + nr[ib * 3 + 2] + nr[ic * 3 + 2]; }
        else { const ux = pos[ib * 3] - pos[ia * 3], uy = pos[ib * 3 + 1] - pos[ia * 3 + 1], uz = pos[ib * 3 + 2] - pos[ia * 3 + 2], vx = pos[ic * 3] - pos[ia * 3], vy = pos[ic * 3 + 1] - pos[ia * 3 + 1], vz = pos[ic * 3 + 2] - pos[ia * 3 + 2]; nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx; }
        const nl = Math.hypot(nx, ny, nz) || 1;
        shade = 0.5 + 0.6 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / nl);
      }
      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
          const pxx = x + 0.5;
          const w0 = ((bx - pxx) * (cy - py) - (by - py) * (cx - pxx)) / area;
          const w1 = ((cx - pxx) * (ay - py) - (cy - py) * (ax - pxx)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const u = w0 * ua + w1 * ub + w2 * uc, v = w0 * va + w1 * vb + w2 * vc;
          if (fn) {
            const zi = y * W + x, d = w0 * da + w1 * db + w2 * dc;
            if (zb && d > zb[zi] + 1e-4) continue;
            const m = (k: number) => w0 * src[ia * 3 + k] + w1 * src[ib * 3 + k] + w2 * src[ic * 3 + k];
            const c = fn(u, v, m(0), m(1), m(2)); if (!c) continue;
            if (putOver(px, zi * 4, c[0] * shade, c[1] * shade, c[2] * shade, c[3], !!zb) && zb) zb[zi] = d;
            continue;
          }
          if (zb) { const d = w0 * da + w1 * db + w2 * dc, zi = y * W + x; if (d > zb[zi] + 1e-4) continue; if (sampleOver(px, zi * 4, tex!, u, v, shade, true)) zb[zi] = d; }
          else sampleOver(px, (y * W + x) * 4, tex!, u, v);
        }
      }
    }
  }
  return { w: W, h: H, px };
}

/** 쌍선형 표본 + 알파 덮어 그리기(source-over). uv 는 감싸기(wrap). */
function sampleOver(dst: Uint8Array, di: number, t: RgbaImage, u: number, v: number, shade = 1, opaque = false): boolean {
  const fu = (u - Math.floor(u)) * t.w - 0.5, fv = (v - Math.floor(v)) * t.h - 0.5;
  const x0 = Math.floor(fu), y0 = Math.floor(fv), ax = fu - x0, ay = fv - y0;
  let r = 0, g = 0, b = 0, a = 0;
  for (let k = 0; k < 4; k++) {
    const xx = ((x0 + (k & 1)) % t.w + t.w) % t.w, yy = ((y0 + (k >> 1)) % t.h + t.h) % t.h;
    const wgt = ((k & 1) ? ax : 1 - ax) * ((k >> 1) ? ay : 1 - ay), si = (yy * t.w + xx) * 4, sa = t.px[si + 3] * wgt;
    r += t.px[si] * sa; g += t.px[si + 1] * sa; b += t.px[si + 2] * sa; a += sa;
  }
  if (a <= 0.5 || (opaque && a < 127)) return false;
  r = Math.min(255, (r / a) * shade); g = Math.min(255, (g / a) * shade); b = Math.min(255, (b / a) * shade);
  if (opaque) { dst[di] = Math.round(r); dst[di + 1] = Math.round(g); dst[di + 2] = Math.round(b); dst[di + 3] = 255; return true; }
  const sa = a / 255, da = dst[di + 3] / 255, oa = sa + da * (1 - sa);
  dst[di] = Math.round((r * sa + dst[di] * da * (1 - sa)) / oa);
  dst[di + 1] = Math.round((g * sa + dst[di + 1] * da * (1 - sa)) / oa);
  dst[di + 2] = Math.round((b * sa + dst[di + 2] * da * (1 - sa)) / oa);
  dst[di + 3] = Math.round(oa * 255);
  return true;
}

/** 모델 전체를 가운데 기준으로 돌린 사본(정점·법선·상자). */
export function rotateParts(parts: MeshPart[], yawDeg: number, pitchDeg: number): MeshPart[] {
  let c = [0, 0, 0], n = 0;
  for (const p of parts) for (let i = 0; i < p.pos.length; i += 3) { c[0] += p.pos[i]; c[1] += p.pos[i + 1]; c[2] += p.pos[i + 2]; n++; }
  c = c.map((v) => v / (n || 1));
  const cy = Math.cos((yawDeg * Math.PI) / 180), sy = Math.sin((yawDeg * Math.PI) / 180), cp = Math.cos((pitchDeg * Math.PI) / 180), sp = Math.sin((pitchDeg * Math.PI) / 180);
  const rot = (x: number, y: number, z: number): [number, number, number] => { const x1 = x * cy + z * sy, z1 = -x * sy + z * cy; return [x1, y * cp - z1 * sp, y * sp + z1 * cp]; };
  return parts.map((p) => {
    const pos = new Float32Array(p.pos.length), nrm = p.nrm ? new Float32Array(p.nrm.length) : undefined;
    const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.pos.length; i += 3) {
      const r = rot(p.pos[i] - c[0], p.pos[i + 1] - c[1], p.pos[i + 2] - c[2]);
      for (let a = 0; a < 3; a++) { pos[i + a] = r[a] + c[a]; min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]); }
      if (nrm && p.nrm) { const q = rot(p.nrm[i], p.nrm[i + 1], p.nrm[i + 2]); nrm[i] = q[0]; nrm[i + 1] = q[1]; nrm[i + 2] = q[2]; }
    }
    return { ...p, pos, nrm, min, max, src: p.src ?? p.pos };
  });
}

/** 한 픽셀 덮어 그리기(0~255). opaque 면 알파 절반 미만은 버리고 덮어씀. */
function putOver(dst: Uint8Array, di: number, r: number, g: number, b: number, a: number, opaque: boolean): boolean {
  if (a <= 0.5 || (opaque && a < 127)) return false;
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  if (opaque) { dst[di] = Math.round(r); dst[di + 1] = Math.round(g); dst[di + 2] = Math.round(b); dst[di + 3] = 255; return true; }
  const sa = a / 255, da = dst[di + 3] / 255, oa = sa + da * (1 - sa);
  dst[di] = Math.round((r * sa + dst[di] * da * (1 - sa)) / oa); dst[di + 1] = Math.round((g * sa + dst[di + 1] * da * (1 - sa)) / oa); dst[di + 2] = Math.round((b * sa + dst[di + 2] * da * (1 - sa)) / oa);
  dst[di + 3] = Math.round(oa * 255);
  return true;
}
/** 텍스처 쌍선형 표본(감싸기). 0~255 RGBA. */
export function sampleRgba(t: RgbaImage, u: number, v: number, clampV = false): [number, number, number, number] {
  const fu = (u - Math.floor(u)) * t.w - 0.5, fv = (clampV ? Math.min(1, Math.max(0, v)) : v - Math.floor(v)) * t.h - 0.5;
  const x0 = Math.floor(fu), y0 = Math.floor(fv), ax = fu - x0, ay = fv - y0, out = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const xx = ((x0 + (k & 1)) % t.w + t.w) % t.w, yy = clampV ? Math.min(t.h - 1, Math.max(0, y0 + (k >> 1))) : ((y0 + (k >> 1)) % t.h + t.h) % t.h;
    const w = ((k & 1) ? ax : 1 - ax) * ((k >> 1) ? ay : 1 - ay), si = (yy * t.w + xx) * 4;
    for (let c = 0; c < 4; c++) out[c] += t.px[si + c] * w;
  }
  return out as [number, number, number, number];
}
/** Gigastructures 「GigaBlokkat」 셰이더(giga_shaders.fxh) 흉내: 무늬(normal 칸)·마스크(specular 칸)를 UV0 로, 색은 색상표(diffuse 칸) 그라데이션. 조명 없음. 시간 = 0. */
export function gigaBlokkatPixel(pattern: RgbaImage, mask: RgbaImage, colours: RgbaImage, outerScale = 0, innerScale = 0, vertical = false, time = 0) {
  return (u: number, v: number, mx: number, my: number): [number, number, number, number] | null => {
    const d = sampleRgba(pattern, u, v), m = sampleRgba(mask, u, v);
    const mr = m[0] / 255, mg = m[1] / 255, mb = m[2] / 255, pr = d[0] / 255, pg = d[1] / 255;
    const limit = 0.2;
    const go = Math.min(limit, Math.max(-limit, vertical ? (7 - my) * 0.05 - limit * 0.4 : mx * limit * 0.5));
    const og = sampleRgba(colours, time + mb * outerScale, 0.25 + go, true), ig = sampleRgba(colours, time + 0.5 + mx * 0.01 + my * 0.02 + mb * innerScale, 0.75 + go, true);
    const rec = [0, 1, 2].map((c) => { const o = Math.max((og[c] / 255) * pr, pg), i = Math.max((ig[c] / 255) * pr, pg); return o + (i - o) * mg; });
    return [0, 1, 2].map((c) => (d[c] / 255 + (rec[c] - d[c] / 255) * mr) * 255).concat([d[3]]) as [number, number, number, number];
  };
}
