// 세이브 읽기 작업 스레드(2026-10-27 최적화). flags.ts 가 세이브가 바뀔 때마다 새로 띄우고, 읽고 나면 끝난다.
// 후반 세이브는 압축을 풀고 훑는 데 1~2초·수백 MB 가 들어 본 스레드에서 하면 앱이 그동안 멈췄다.
// 따로 띄웠다가 끝내면 그 메모리도 통째로 운영체제에 돌아간다. electron 없이 savereader 만 쓴다.
import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import { readSaveFlags, readZipEntry } from './savereader';
import { extractSave } from './savegame/extract';
import { loadLoc } from './savegame/loc';

try {
  const wd = (workerData ?? {}) as { file?: unknown; gameDir?: unknown; lang?: unknown }, file = String(wd.file ?? '');
  const data = readSaveFlags(file);
  // 세이브 요약(2026-11-03): 지도자·행성 등을 게임에 묻지 않고 여기서 읽는다. 이름은 게임 문구 파일로 푼다. 실패해도 깃발 정보는 그대로 보낸다.
  if (data && typeof wd.gameDir === 'string' && wd.gameDir) {
    try { const gs = readZipEntry(fs.readFileSync(file), 'gamestate'); if (gs) data.snap = extractSave(gs, loadLoc([wd.gameDir], typeof wd.lang === 'string' && /^[a-z_]+$/.test(wd.lang) ? wd.lang : 'english')); }
    catch (e) { data.snapError = String((e as Error)?.message || e); }
  }
  parentPort?.postMessage({ ok: true, data });
} catch (e) {
  parentPort?.postMessage({ ok: false, error: String((e as Error)?.message || e) });
}
