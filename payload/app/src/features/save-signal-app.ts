// 세이브 다시 읽기 신호(앱 쪽, 2026-11-09). 규칙: src/save-signal.ts · 읽기: src/flags.ts(FlagProvider.markStale). 로그 자리 SAVESIGNAL.
// 이미 오는 줄(LOADED · NEWS ruler · EVT first_contact)과 월간 상황(우리 정부 바뀜 · 12달)을 보고 「다음 자동 저장을 한 번 읽어라」만 표시한다.
import { ctx } from '../app/ctx';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { saveSignalOf, ourGovChanged, saveTooOld, type GovMark } from '../save-signal';
import { onGameSnapshot } from './gamestate-app';

let last: GovMark | null = null;

export function registerSaveSignals(router: LogRouter): void {
  router.on(SLOT.SAVESIGNAL, 'save-signal', (m: SllmMessage) => {
    const why = saveSignalOf(m); if (!why) return;
    if (why === 'loaded') last = null;
    ctx.flagProv.markStale(why);
  });
  onGameSnapshot((snap) => {
    if (!snap.sid) return;
    const cur: GovMark = { sid: snap.sid, empireEth: snap.empireEth, authority: snap.authority };
    if (ourGovChanged(last, cur)) ctx.flagProv.markStale('our_government');
    last = cur;
    if (saveTooOld(ctx.flagProv.heldDate(), snap.date)) ctx.flagProv.markStale('yearly', 0); // 0 = 들고 있는 것보다 새 세이브면 무엇이든
  });
}
