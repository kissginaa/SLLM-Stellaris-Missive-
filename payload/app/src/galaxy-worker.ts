// 작전지휘실 은하 지도 — 세이브 읽기 작업 스레드(2026-11-05). savereader-worker 와 같은 방식: 압축을 풀고 훑는 동안 앱이 멈추지 않게, 끝나면 메모리째 돌려준다.
import * as fs from 'fs';
import { parentPort, workerData } from 'worker_threads';
import { readZipEntry } from './savereader';
import { parseGalaxy } from './galaxy';

try {
  const file = String((workerData as { file?: unknown })?.file ?? '');
  const gs = readZipEntry(fs.readFileSync(file), 'gamestate');
  parentPort?.postMessage(gs ? { ok: true, data: parseGalaxy(gs.toString('utf8')) } : { ok: false, error: 'NO_GAMESTATE' });
} catch (e) {
  parentPort?.postMessage({ ok: false, error: String((e as Error)?.message || e) });
}
