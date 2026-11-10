// 모드 초상화 그리기 작업 스레드(2026-10-27). 앱이 그리기 한 번마다 띄우고, 끝나면 사라진다(그동안 쓴 메모리도 돌아간다).
// 스텔라리스는 거의 한 코어로 돌아가므로 무거운 그리기는 본 스레드 밖에서 — 운영체제가 다른 코어에 나눠 준다.
import { parentPort, workerData } from 'worker_threads';
import { runModPortraitJob, type ModPortraitJob } from './mod-portraits-job';

runModPortraitJob(workerData as ModPortraitJob, (done, total) => parentPort?.postMessage({ t: 'p', done, total }))
  .then((result) => parentPort?.postMessage({ t: 'r', result }))
  .catch((e) => parentPort?.postMessage({ t: 'e', error: String((e as Error)?.message ?? e).slice(0, 120) }));
