// 작업 스레드 검사(2026-10-27 최적화): 그림 변환(깃발·문양·행성 그림·직업 아이콘)은 작업 스레드에서도 본 스레드와 같은 결과.
// 스텔라리스는 거의 한 코어로 돌아가므로 앱의 무거운 계산은 본 스레드 밖에서 한다. selftest.ts 에서 runThreadChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { runImageOp, type ImageOp, type ImageResult } from './image-ops';
import { composeFlag, decodeDds, encodePng, shrink } from './flagrender';
import { iconMask } from './leader-icons';

function solidDds(w: number, h: number, rgba: [number, number, number, number]): Buffer {
  const b = Buffer.alloc(128 + w * h * 4); b.write('DDS ', 0, 'latin1'); b.writeUInt32LE(124, 4); b.writeUInt32LE(h, 12); b.writeUInt32LE(w, 16);
  b.writeUInt32LE(32, 76); b.writeUInt32LE(0x41, 80); b.writeUInt32LE(32, 88); b.writeUInt32LE(0x00ff0000, 92); b.writeUInt32LE(0x0000ff00, 96); b.writeUInt32LE(0x000000ff, 100); b.writeUInt32LE(0xff000000, 104);
  for (let i = 0; i < w * h; i++) { b[128 + i * 4] = rgba[2]; b[129 + i * 4] = rgba[1]; b[130 + i * 4] = rgba[0]; b[131 + i * 4] = rgba[3]; }
  return b;
}

export function runThreadChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'threads: ' + name); if (!ok) process.exitCode = 1; };
  const bg = solidDds(8, 8, [10, 20, 200, 255]), ic = solidDds(8, 8, [250, 250, 250, 128]);
  const spec = { iconCat: 'pictograms', iconFile: 'x.dds', bgCat: 'backgrounds', bgFile: 'b.dds', colors: ['red', 'blue', 'null', 'null'] };
  const colors: Record<string, [number, number, number]> = { red: [200, 0, 0], blue: [0, 0, 200] };
  const png = (b: Buffer) => 'data:image/png;base64,' + encodePng(b as never).toString('base64');
  // 예전(본 스레드) 계산과 똑같은가
  const old = composeFlag(spec, '', colors, { size: 96, load: (c, f) => decodeDds(c + '/' + f === 'backgrounds/b.dds' ? bg : ic) });
  const jobs: Array<[ImageOp, string | null]> = [
    [{ op: 'flag', spec, colors, bg: new Uint8Array(bg), ic: new Uint8Array(ic), size: 96 }, old ? 'data:image/png;base64,' + encodePng(old).toString('base64') : null],
    [{ op: 'planet', bytes: new Uint8Array(bg), maxW: 4 }, 'data:image/png;base64,' + encodePng(shrink(decodeDds(bg)!, 4)).toString('base64')],
    [{ op: 'mask', bytes: new Uint8Array(ic) }, 'data:image/png;base64,' + encodePng(iconMask(decodeDds(ic)!)).toString('base64')],
  ];
  check(jobs.every(([j, want]) => runImageOp(j).url === want) && !!old, 'image ops match the old main-thread results (flag, planet, mask)');
  const em = runImageOp({ op: 'emblem', bytes: new Uint8Array(ic) }).url;
  check(!!em && em.startsWith('data:image/png;base64,'), 'emblem op makes a PNG');
  const bad = runImageOp({ op: 'flag', spec, colors, bg: new Uint8Array(Buffer.from('nope')), ic: new Uint8Array(ic), size: 96 });
  check(!!bad.bad?.includes('bg'), 'corrupted layer is reported, not thrown');
  // 소스 규칙
  const rd = (f: string) => { for (const d of [__dirname, path.join(__dirname, '..', 'src')]) { try { return fs.readFileSync(path.join(d, f), 'utf8'); } catch { /* 다음 */ } } return ''; };
  const fl = rd('flags.ts'), pa = rd('planetart.ts'), li = rd('leader-icons.ts'), gv = rd(path.join('features', 'gov.ts')), oa = rd(path.join('features', 'office-app.ts')), pl = rd(path.join('features', 'portrait-lib-app.ts')), pool = rd('image-pool.ts');
  check(/imageThreaded\(\)\) \{ this\.makeImage\(key, \{ op: 'emblem'/.test(fl) && (fl.match(/op: 'flag'/g) ?? []).length === 2 && /this\.notifySoon\(\)/.test(fl), 'flags/emblems are made in the worker and redraw when ready');
  check(/planetPicUrlAsync\(ctx\.flagProv\.game\(\)/.test(gv) && /export async function planetPicUrlAsync/.test(pa), 'governor planet art uses the worker');
  check(/roleIconMasksSoon\(ctx\.flagProv\.game\(\), \(\) => push\(\)\)/.test(oa) && /export function roleIconMasksSoon/.test(li), 'office role icons use the worker');
  check(/new Worker\(script, \{ workerData: job \}\)/.test(pl) && !/renderPlan\(/.test(pl), 'mod portraits draw in a worker (nothing heavy left in the app thread)');
  check(/w\.unref\(\)/.test(pool) && /20000/.test(pool), 'image worker does not keep the app alive and stops when idle');
  // 컴파일된 dist 에서 돌릴 때: 실제 작업 스레드로 같은 결과
  const script = path.join(__dirname, 'image-worker.js');
  if (fs.existsSync(script)) {
    const w = new Worker(script); let n = 0; const got: Array<ImageResult | null> = [];
    w.on('message', (m: { id: number; r: ImageResult }) => { got[m.id] = m.r; if (++n === jobs.length) { void w.terminate(); check(jobs.every(([, want], i) => got[i]?.url === want), 'image worker thread gives the same pictures'); } });
    jobs.forEach(([job], id) => w.postMessage({ id, job }));
  }
}
