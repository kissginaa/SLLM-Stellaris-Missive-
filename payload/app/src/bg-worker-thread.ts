// 뒷일 작업 스레드(2026-11-08 사용자: 「작업 스레드를 채용할 수 있는 부분은 다」). 앱 쪽: src/app/bg-worker.ts.
// 하는 일: ① 큰 저장 파일 쓰기(JSON 만들기 + 임시 파일 + 바꿔치기) ② 큰 로그 파일 끝부분에서 원하는 줄만 골라내기.
// 앱이 끝날 때까지 한 개만 띄워 두고 차례대로 처리한다(같은 파일 쓰기 순서가 뒤바뀌지 않게).
import * as fs from 'fs';
import * as path from 'path';
import { parentPort } from 'worker_threads';

type Job =
  | { id: number; kind: 'write'; file: string; data: unknown }
  | { id: number; kind: 'grep'; file: string; bytes: number; re: string; flags?: string };

function tail(file: string, bytes: number): string {
  const st = fs.statSync(file), fd = fs.openSync(file, 'r');
  try { const n = Math.min(bytes, st.size), b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, st.size - n); return b.toString('utf8'); } finally { fs.closeSync(fd); }
}

parentPort?.on('message', (j: Job) => {
  try {
    if (j.kind === 'write') {
      const tmp = j.file + '.' + process.pid + '.bg.tmp';
      fs.mkdirSync(path.dirname(j.file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(j.data), 'utf8'); fs.renameSync(tmp, j.file);
      parentPort?.postMessage({ id: j.id, ok: true });
    } else if (j.kind === 'grep') {
      let text = ''; try { text = tail(j.file, j.bytes); } catch (e) { parentPort?.postMessage({ id: j.id, ok: false, error: String((e as Error)?.message || e) }); return; }
      const re = new RegExp(j.re, j.flags || '');
      parentPort?.postMessage({ id: j.id, ok: true, lines: text.split(/\r?\n/).filter((x) => re.test(x)), size: text.length });
    } else parentPort?.postMessage({ id: (j as { id: number }).id, ok: false, error: 'UNKNOWN_JOB' });
  } catch (e) {
    parentPort?.postMessage({ id: j.id, ok: false, error: String((e as Error)?.message || e) });
  }
});
