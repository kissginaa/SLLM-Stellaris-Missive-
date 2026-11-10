// 그림 변환 작업 스레드(2026-10-27). image-pool.ts 가 필요할 때 띄우고, 한동안 일이 없으면 끈다.
import { parentPort } from 'worker_threads';
import { runImageOp, type ImageOp } from './image-ops';

parentPort?.on('message', (m: { id: number; job: ImageOp }) => {
  let r; try { r = runImageOp(m.job); } catch { r = { url: null }; }
  parentPort?.postMessage({ id: m.id, r });
});
