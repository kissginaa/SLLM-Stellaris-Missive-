// 그림 변환 작업(2026-10-27 최적화): 게임 DDS 를 풀고 합치고 PNG 로 만드는 CPU 일. 작업 스레드(image-worker.ts)와 스레드가 없을 때의 본 스레드가 함께 쓴다.
// 파일 읽기는 앱(본 스레드)이 해서 바이트로 넘긴다 — 여기서는 계산만. electron 없이 돈다.
import { composeFlag, decodeDds, encodePng, shrink, type Img } from './flagrender';
import { iconMask } from './leader-icons';
import type { FlagSpec } from './savereader';

export type ImageOp =
  | { op: 'flag'; spec: FlagSpec; colors: Record<string, [number, number, number]>; bg: Uint8Array | null; ic: Uint8Array | null; size: number }
  | { op: 'emblem'; bytes: Uint8Array }
  | { op: 'planet'; bytes: Uint8Array; maxW: number }
  | { op: 'mask'; bytes: Uint8Array };
export interface ImageResult { url: string | null; /** 깃발: 풀지 못한 층(진단용) */ bad?: Array<'bg' | 'ic'> }

const png = (img: Img) => 'data:image/png;base64,' + encodePng(img).toString('base64');
const dds = (b: Uint8Array | null): Img | null => { if (!b) return null; try { return decodeDds(Buffer.from(b.buffer, b.byteOffset, b.byteLength)); } catch { return null; } };

export function runImageOp(j: ImageOp): ImageResult {
  if (j.op === 'flag') {
    const bad: Array<'bg' | 'ic'> = [], bgImg = dds(j.bg), icImg = dds(j.ic);
    if (j.bg && !bgImg) bad.push('bg'); if (j.ic && !icImg) bad.push('ic');
    const bgKey = (j.spec.bgCat || 'backgrounds') + '/' + j.spec.bgFile, icKey = j.spec.iconCat + '/' + j.spec.iconFile;
    const img = composeFlag(j.spec, '', j.colors, { size: j.size, load: (cat, file) => { const k = cat + '/' + file; return k === bgKey ? bgImg : k === icKey ? icImg : null; } });
    return { url: img ? png(img) : null, ...(bad.length ? { bad } : {}) };
  }
  const img = dds(j.bytes); if (!img) return { url: null };
  if (j.op === 'emblem') { const px = new Uint8Array(img.px); for (let i = 0; i < px.length; i += 4) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; } return { url: png({ w: img.w, h: img.h, px }) }; } // 원래 알파만 남긴다(색은 CSS)
  if (j.op === 'planet') return { url: png(shrink(img, j.maxW)) };
  return { url: png(iconMask(img)) };
}
