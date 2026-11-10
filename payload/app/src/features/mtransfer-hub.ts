// 정기 송금(앱 쪽, 2026-11-09). 규칙: src/mtransfer.ts · 모드: sllm_mtransfer.txt
// 외교 거래(deals-app)·반란군 후원(rebels-app)이 같이 쓴다: 칸 적기·지우기 요청과, 모드가 남기는 MT 줄(못 냄·끊김·다 냄)을 기능별로 나눠 준다.
// 로그 자리 MTRANSFER: MTSET(적기·지우기 응답) · MT(매달 사건 — 잘 낸 달에는 줄이 없다).
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { mtSetCommand, mtUnsetCommand, parseMt, type MtSlot, type MtOwner, type MtEvent } from '../mtransfer';

const subs = new Map<number, (e: MtEvent) => void>();
let hooked = false;
function onLine(m: SllmMessage): void {
  if (m.kind === 'MTSET') { terminalReplies.get('MTSET:' + Math.round(Number(String(m.kv.req ?? '').replace(/^\\/, ''))))?.(m); return; }
  if (m.kind !== 'MT') return;
  const e = parseMt(m.kv); if (!e) return;
  try { subs.get(e.o)?.(e); } catch (err) { logDiagnostic('warn', 'mtransfer.handler_failed', { o: e.o, error: (err as Error).message }); }
}
/** 기능마다 한 번: MT 줄 받기. 로그 자리는 처음 부른 기능이 건다(같은 자리는 한 번만). */
export function mtSubscribe(router: LogRouter, o: MtOwner, fn: (e: MtEvent) => void): void {
  subs.set(o, fn);
  if (!hooked) { hooked = true; router.on(SLOT.MTRANSFER, 'mtransfer', onLine); }
}
/** 칸 적기. 결과: 'ok'(적음·이미 있음) · 'full'(상대 칸이 모자람 — 예전처럼 앱이 매달 보냄) · 'gone'(상대 없음) · 'missing'(check: 게임에 칸이 없음 — 끝난 것으로 본다) · 'fail'(응답 없음 — 다음 달 다시). */
export async function mtSet(s: MtSlot, keep: boolean, check = false): Promise<'ok' | 'full' | 'gone' | 'missing' | 'fail'> {
  const req = ++link.reqCounter;
  try {
    const m = await terminalRequest(mtSetCommand(req, s, keep, check), 'MTSET', req), st = Math.round(Number(String(m.kv.st ?? '').replace(/^\\/, '')));
    return st === 1 || st === 3 ? 'ok' : st === 2 ? 'full' : st === 4 ? 'missing' : st === 0 ? 'gone' : 'fail';
  } catch (e) { logDiagnostic('warn', 'mtransfer.set_failed', { o: s.o, g: s.g, error: (e as Error).message }); return 'fail'; }
}
/** 묶음 칸 지우기(실패해도 조용히 — 모드가 다 내면 스스로 지운다). */
export async function mtUnset(tid: number, g: number, o: MtOwner): Promise<void> {
  const req = ++link.reqCounter;
  try { await terminalRequest(mtUnsetCommand(req, tid, g, o), 'MTSET', req); } catch (e) { logDiagnostic('warn', 'mtransfer.unset_failed', { o, g, error: (e as Error).message }); }
}
