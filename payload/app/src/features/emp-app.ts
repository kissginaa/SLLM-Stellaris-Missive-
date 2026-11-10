// 비상대권(2026-11-05) — 앱 쪽. 규칙: src/emergency-powers.ts · 화면: ui/office-emergency.js(집무실 「비상대권」)
// 슈뢰딩거 방식: 화면을 열 때만 게임에 상태를 묻는다. 게임이 먼저 알리는 것은 전쟁이 끝남(peace)·쥔 것으로 굳음(hold_auto)·해마다 반발(backlash)뿐 — 알림 카드로.
import { ipcMain } from 'electron';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { EMP_LEVELS, EMP_RULES, EMP_WHY, EMP_WHY_N, empCommand, empLine, parseEmp, type EmpAct } from '../emergency-powers';

const isKo = (): boolean => L('ko', 'en') === 'ko';
/** 게임이 먼저 알린 마지막 말(화면에 한 번 띄움) */
let lastNote = '';
function view(st: ReturnType<typeof parseEmp>, say = '') {
  const ko = isKo();
  return { ok: true, state: st, say: say || lastNote, levels: EMP_LEVELS.map((x) => ({ lv: x.lv, name: ko ? x.ko : x.en, fx: x.fx[ko ? 0 : 1] })),
    rules: { cooldownDays: EMP_RULES.cooldownDays, peaceAsk: EMP_RULES.peaceAsk, peaceLock: EMP_RULES.peaceLock, grip: EMP_RULES.grip[ko ? 0 : 1], ret: EMP_RULES.ret[ko ? 0 : 1] } };
}
async function ask(act: EmpAct) {
  const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 할 수 있습니다.', 'Load a save first.'));
  if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  const req = ++link.reqCounter; return terminalRequest(empCommand(req, sid, act), 'EMP', req);
}
export function registerEmp(router: LogRouter): void {
  router.on(SLOT.EMP, 'emp', (m: SllmMessage) => {
    if (m.kind !== 'EMP') return;
    if (m.kv.req) { terminalReplies.get('EMP:' + m.kv.req)?.(m); return; }
    const ev = m.kv.ev; if (ev !== 'peace' && ev !== 'hold_auto' && ev !== 'backlash') return;
    const ko = isKo(); lastNote = empLine(ev, ko, 0, ctx.gameDate || '');
    ctx.notify({ kind: 'office', title: ev === 'peace' ? L('전쟁이 끝났습니다 — 비상대권', 'The war is over — emergency powers') : L('비상대권', 'Emergency powers'), body: lastNote, action: L('열기', 'Open') });
  });
  ipcMain.handle('empState', async () => {
    try { const m = await ask('state'); const st = parseEmp(m.kv); if (!st) throw new Error(L('게임 응답을 읽지 못했습니다.', 'Could not read the game reply.')); return view(st); }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('empSet', async (_e, a: unknown) => {
    try {
      const act = String(a) as EmpAct; if (!['up', 'down', 'release', 'hold'].includes(act)) throw new Error('INVALID_EMP');
      const m = await ask(act), st = parseEmp(m.kv); if (!st) throw new Error(L('게임 응답을 읽지 못했습니다.', 'Could not read the game reply.'));
      const ko = isKo();
      if (Number(m.kv.ok) !== 1) { const w = EMP_WHY[EMP_WHY_N[Number(m.kv.why)] || ''] ?? EMP_WHY.none; /* ok·why 는 변수로 찍혀 숫자 */ return { ...view(st, ''), ok: false, error: w[ko ? 0 : 1] }; }
      lastNote = '';
      const kind = act === 'up' ? 'up' : act === 'hold' ? 'hold' : act === 'down' && st.lv > 0 ? 'down' : !st.war ? 'releaseAfter' : 'release';
      return view(st, empLine(kind, ko, st.lv, ctx.gameDate || ''));
    } catch (e) { logDiagnostic('warn', 'emp.set_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
}
