// 한 달 사용량 기록(앱 쪽, 2026-11-09). 셈: src/usage-meter.ts. 월간 상황이 올 때 지난달 몫을 진단 기록 usage.month 로 남긴다.
// 줄 예: { month: '2231.04', console: 6, top: ['sllm_probe_state_scan:1', …], flagsReads: 0, flagsMs: 0, galaxyReads: 1, galaxyMs: 1840, failed: 0 }
// 「바뀔 때만」 작업(1·2순위, 세이브 다시 읽기)이 실제로 얼마나 줄였는지 진단 기록(설정 → 진단)에서 볼 수 있다.
import { logDiagnostic } from '../diagnostics';
import { usage } from '../usage-meter';
import { onGameSnapshot } from './gamestate-app';

let month = '';
export function registerUsage(): void {
  onGameSnapshot((snap) => {
    const m = /^\d+\.\d+/.exec(snap.date || '')?.[0] ?? ''; if (!m || m === month) return;
    const first = !month, r = usage.flush(month || m); month = m;
    if (r) logDiagnostic('info', 'usage.month', first ? { ...r, partial: true } : { ...r });
  });
}
