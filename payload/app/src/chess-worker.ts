// 체스 AI 작업자 스레드(2026-10-30). 수 읽기가 0.1~1초 걸려서 앱 본체(메인 프로세스)를 멈추지 않도록 따로 돈다.
import { parentPort } from 'worker_threads';
import { chooseMove, type Pos, type Style } from './chess';

parentPort?.on('message', (msg: { id: number; pos: Pos; style: Style }) => {
  try { parentPort?.postMessage({ id: msg.id, move: chooseMove(msg.pos, msg.style) }); }
  catch (e) { parentPort?.postMessage({ id: msg.id, error: String((e as Error)?.message || e) }); }
});
