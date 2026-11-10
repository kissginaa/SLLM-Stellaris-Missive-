// 그림 변환 작업 스레드 하나를 돌려쓴다(2026-10-27 최적화). 스텔라리스는 거의 한 코어로 돌아가므로 앱의 계산은 본 스레드 밖에서.
// 일이 없으면 20초 뒤 스레드를 끈다(메모리를 돌려준다). 스레드 파일이 없으면(자체 검사·개발 실행) 같은 계산을 바로 한다.
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { runImageOp, type ImageOp, type ImageResult } from './image-ops';

let worker: Worker | null = null, nextId = 1, idle: ReturnType<typeof setTimeout> | null = null;
const waiting = new Map<number, (r: ImageResult) => void>();
function script(): string | null {
  if (process.env.SLLM_IMAGE_SYNC) return null;
  const p = path.join(__dirname, 'image-worker.js');
  try { return fs.existsSync(p) ? p : null; } catch { return null; }
}
function drop(): void { const w = worker; worker = null; for (const res of waiting.values()) res({ url: null }); waiting.clear(); if (w) void w.terminate(); }
function get(s: string): Worker {
  if (worker) return worker;
  const w = new Worker(s);
  w.on('message', (m: { id: number; r: ImageResult }) => { const res = waiting.get(m.id); if (res) { waiting.delete(m.id); res(m.r); } armIdle(); });
  w.once('error', () => { if (worker === w) drop(); });
  w.once('exit', () => { if (worker === w) drop(); });
  w.unref(); // 앱 종료를 막지 않는다
  return (worker = w);
}
function armIdle(): void { if (idle) clearTimeout(idle); idle = setTimeout(() => { idle = null; if (!waiting.size) drop(); }, 20000); idle.unref?.(); }
/** 그림 하나를 변환한다. 실패하면 url = null. */
export function imageJob(job: ImageOp): Promise<ImageResult> {
  const s = script();
  if (!s) { try { return Promise.resolve(runImageOp(job)); } catch { return Promise.resolve({ url: null }); } }
  return new Promise((resolve) => { const id = nextId++; waiting.set(id, resolve); get(s).postMessage({ id, job }); });
}
/** 작업 스레드를 쓰는가(진단·자체 검사용). */
export const imageThreaded = (): boolean => !!script();
