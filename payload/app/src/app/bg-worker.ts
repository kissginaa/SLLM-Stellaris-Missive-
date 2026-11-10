// 뒷일 작업 스레드 — 앱 쪽(2026-11-08 사용자: 「작업 스레드를 채용할 수 있는 부분은 다」). 스레드 쪽: src/bg-worker-thread.ts.
// bgWriteJson: 큰 저장 파일을 작업 스레드가 쓴다(JSON 만들기·디스크 쓰기가 앱 화면을 멈추지 않게). 같은 파일은 마지막 것만 쓴다.
//   아직 다 못 쓴 것은 앱을 끌 때(before-quit) 이 스레드에서 바로 쓴다 — 기록을 잃지 않게.
// bgGrep: 큰 로그 파일 끝부분에서 원하는 줄만 작업 스레드가 골라 준다(개발자 점검판).
// 작업 스레드 파일이 없으면(자체 검사·개발 실행) 그 자리에서 바로 한다 — 동작은 같다.
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { logDiagnostic } from '../diagnostics';

let w: Worker | null = null, broken = false, seq = 0;
const waits = new Map<number, (m: { ok: boolean; error?: string; lines?: string[]; size?: number }) => void>();
const script = () => path.join(__dirname, '..', 'bg-worker-thread.js');
function worker(): Worker | null {
  if (w) return w; if (broken || process.env.SLLM_SAVE_SYNC || !fs.existsSync(script())) return null;
  try {
    const x = new Worker(script());
    x.on('message', (m: { id: number; ok: boolean; error?: string; lines?: string[]; size?: number }) => { const f = waits.get(m.id); if (f) { waits.delete(m.id); f(m); } });
    const dead = (why: string) => { if (w !== x) return; w = null; broken = true; logDiagnostic('warn', 'bgworker.down', { why }); for (const [id, f] of [...waits]) { waits.delete(id); f({ ok: false, error: 'WORKER_DOWN' }); } };
    x.on('error', (e) => dead(String((e as Error)?.message || e)));
    x.on('exit', (code) => dead('exit ' + code));
    x.unref(); // 앱 종료를 막지 않게
    w = x; return w;
  } catch (e) { broken = true; logDiagnostic('warn', 'bgworker.start_failed', { error: String((e as Error)?.message || e) }); return null; }
}
function syncWrite(file: string, data: unknown): void { const tmp = file + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(data), 'utf8'); fs.renameSync(tmp, file); }

// 파일마다: 지금 쓰는 중(busy)·그다음에 쓸 최신 데이터(next)
const files = new Map<string, { busy: boolean; next: unknown; has: boolean; flying?: unknown; onErr?: (e: string | null) => void }>();
let quitHooked = false;
function hookQuit(): void {
  if (quitHooked) return; quitHooked = true;
  try { const { app } = require('electron') as typeof import('electron'); app?.on?.('before-quit', () => { try { flushBgWrites(); } catch { /* 종료 중 */ } }); } catch { /* 자체 검사 */ }
}
function pump(file: string): void {
  const st = files.get(file); if (!st || st.busy || !st.has) return;
  const data = st.next; st.next = null; st.has = false;
  const x = worker();
  if (!x) { try { syncWrite(file, data); st.onErr?.(null); } catch (e) { st.onErr?.(String((e as Error)?.message || e)); logDiagnostic('error', 'storage.write_failed', { file, error: e }); } return; }
  st.busy = true; st.flying = data; const id = ++seq;
  waits.set(id, (m) => {
    st.busy = false; st.flying = undefined;
    if (!m.ok) { // 스레드가 못 썼으면 여기서 다시(데이터를 잃지 않게)
      if (!st.has) { try { syncWrite(file, data); st.onErr?.(null); } catch (e) { st.onErr?.(String((e as Error)?.message || e)); logDiagnostic('error', 'storage.write_failed', { file, error: e, worker: m.error }); } }
    } else st.onErr?.(null);
    pump(file);
  });
  try { x.postMessage({ id, kind: 'write', file, data }); } // 여기서 데이터가 복사되므로 뒤에 원본을 고쳐도 된다
  catch (e) { waits.delete(id); st.busy = false; try { syncWrite(file, data); } catch (e2) { logDiagnostic('error', 'storage.write_failed', { file, error: e2 }); } logDiagnostic('warn', 'bgworker.post_failed', { file, error: String((e as Error)?.message || e) }); }
}
/** 큰 JSON 저장 파일을 작업 스레드로 쓴다. onErr: 쓰기 결과(성공 null · 실패 이유). */
export function bgWriteJson(file: string, data: unknown, onErr?: (e: string | null) => void): void {
  hookQuit();
  const st = files.get(file) ?? { busy: false, next: null, has: false }; files.set(file, st);
  st.next = data; st.has = true; if (onErr) st.onErr = onErr;
  pump(file);
}
/** 아직 못 쓴 저장을 지금 이 스레드에서 쓴다(앱 종료 때). 쓰는 중인 것도 최신 데이터가 있으면 다시 쓴다. */
export function flushBgWrites(): void {
  // 스레드가 아직 쓰는 중이면 먼저 멈추고(뒤늦게 옛 데이터로 바꿔치기하지 않게) 쓰던 것도 여기서 다시 쓴다
  if (w && [...files.values()].some((st) => st.busy)) { const x = w; w = null; broken = true; try { void x.terminate(); } catch { /* 이미 멈춤 */ } }
  for (const [file, st] of files) if (st.has || st.busy) { const d = st.has ? st.next : st.flying; st.next = null; st.has = false; st.busy = false; st.flying = undefined; try { syncWrite(file, d); } catch (e) { logDiagnostic('error', 'storage.write_failed', { file, error: e }); } }
}
/** 로그 파일 끝 bytes 바이트에서 re 에 맞는 줄만. 못 읽으면 null. */
export function bgGrep(file: string, bytes: number, re: RegExp): Promise<string[] | null> {
  const x = worker();
  const inline = (): string[] | null => {
    try { const st = fs.statSync(file), fd = fs.openSync(file, 'r'); try { const n = Math.min(bytes, st.size), b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, st.size - n); return b.toString('utf8').split(/\r?\n/).filter((l) => re.test(l)); } finally { fs.closeSync(fd); } } catch { return null; }
  };
  if (!x) return Promise.resolve(inline());
  return new Promise((resolve) => {
    const id = ++seq; const t = setTimeout(() => { if (waits.delete(id)) resolve(inline()); }, 20000);
    waits.set(id, (m) => { clearTimeout(t); resolve(m.ok ? m.lines ?? [] : m.error === 'WORKER_DOWN' ? inline() : null); });
    try { x.postMessage({ id, kind: 'grep', file, bytes, re: re.source, flags: re.flags.replace('g', '') }); } catch { waits.delete(id); clearTimeout(t); resolve(inline()); }
  });
}
