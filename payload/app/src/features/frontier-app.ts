// 국경·전선 읽기(다음 업데이트, 2026-10-26). 규칙: src/frontier.ts. 외교 대화(chat.ts)·성간 임시회의(isc-app.ts) 전에 게임에서 읽어 둔다.
// 같은 게임 날짜에는 다시 읽지 않는다(대화 중에는 게임이 멈춰 있으므로 보통 통신 한 번에 한 번). 실패해도 대화는 그대로 진행.
import { ctx } from '../app/ctx';
import { link, enqueue, sendConsole } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import type { SllmMessage } from '../protocol';
import { type Frontier, FRONT, frontierCommands, parseFrontier, frontNewsLine } from '../frontier';
import { terminal } from './terminal';
import { gameState } from './gamestate-app';
import { setWarFrontSource } from '../app/war-front';

const cache = new Map<string, { date: string; f: Frontier | null }>();
const rowsOf = new Map<string, Array<Record<string, string>>>();
const key = (idx: number) => (ctx.curSaveId || '') + ':' + idx;

/** 지금 아는 국경 정보(없으면 undefined). */
export const frontierFor = (idx: number): Frontier | null | undefined => cache.get(key(idx))?.f;

/** 게임에서 읽는다(이미 오늘 읽었으면 건너뜀). 게임이 꺼져 있거나 실패하면 그대로 둔다. */
export async function refreshFrontier(idxs: number[]): Promise<void> {
  const sid = ctx.curSaveId, today = ctx.gameDate || '';
  if (!sid || !ctx.gameRunning) return;
  for (const idx of [...new Set(idxs)].filter((i) => Number.isSafeInteger(i) && i > 0 && i !== ctx.playerIdx).slice(0, 6)) {
    const c = cache.get(key(idx)); if (c && c.date === today && today) continue;
    const req = ++link.reqCounter, k = String(req); rowsOf.set(k, []);
    try {
      const cmds = frontierCommands(req, sid, idx), last = cmds.pop()!;
      for (const c of cmds) await enqueue(() => sendConsole(c)); // 앞 명령들 먼저(같은 req), 끝 줄은 마지막 명령
      const end = await terminalRequest(last, 'FR_END', req);
      if (end.kv.sid !== sid || ctx.curSaveId !== sid) return;
      cache.set(key(idx), { date: today, f: parseFrontier(idx, end.kv, rowsOf.get(k) ?? []) });
    } catch (e) { logDiagnostic('warn', 'frontier.read_failed', { idx, error: (e as Error).message }); return; }
    finally { rowsOf.delete(k); }
  }
}

/** 신문·라디오용(2026-10-26): 우리가 지금 하는 전쟁마다(최대 3) 상대와의 전선 한 줄. 상대를 통신 목록에서 이름으로 찾는다(못 찾으면 뺀다). */
export async function warFrontInfo(): Promise<string[]> {
  const sid = ctx.curSaveId, snap = gameState.last; if (!sid || !snap || snap.sid !== sid || !snap.wars?.length || terminal.sid !== sid) return [];
  const foes: Array<{ name: string; idx: number }> = [];
  for (const w of snap.wars) {
    const name = w.side === 'att' ? w.defender : w.attacker; if (!name || foes.some((x) => x.name === name)) continue;
    const c = terminal.items.find((x) => x.name === name); if (c) foes.push({ name, idx: c.idx });
    if (foes.length >= 3) break;
  }
  if (!foes.length) return [];
  await refreshFrontier(foes.map((x) => x.idx)).catch(() => {});
  return foes.map((x) => frontNewsLine(x.name, frontierFor(x.idx))).filter(Boolean);
}

export function registerFrontier(router: LogRouter): void {
  setWarFrontSource(warFrontInfo); // 신문·라디오가 이 칸으로 부른다(가져오기 고리 방지)
  router.on(SLOT.FRONTIER, 'frontier', (m: SllmMessage) => {
    if (m.kind === 'FRSYS') { const l = rowsOf.get(String(m.kv.req)); if (l && l.length < FRONT.maxRows) l.push(m.kv); }
    else if (m.kind === 'FR_END') terminalReplies.get('FR_END:' + m.kv.req)?.(m);
  });
}
