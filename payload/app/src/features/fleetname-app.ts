// 함대 명명 건(2026-11-04 사용자) — 앱 쪽. 규칙: src/fleetname.ts · 화면: ui/cabinet-fleetname.js(내각 회의실)
// 전투 기록(연결 모드 sllm_fleet_events.txt 의 BATTLE·BATTLESYS·BATTLEADM)을 함대 사령부와 따로 한 번 더 묶어 본다(fleet-app 을 고치지 않으려고 자기 자리·자기 묶개).
// 건의는 조용히 쌓아 두고(알림 없음), 다음 내각 회의 안건 목록에 「제독 건의」로 함께 보인다. 안건을 열 때만 LLM.
// 저장: sllm_fleetname.json { saves: { [세이브]: FleetNameBook } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { BattleCollector } from '../fleet';
import { emptyFleetNameBook, proposalFrom, addProposal, cleanFleetName, fleetNameCommand, fleetNameMessages, readFleetNames, type FleetNameBook } from '../fleetname';

const file = () => path.join(app.getPath('userData'), 'sllm_fleetname.json');
let all: Record<string, FleetNameBook> | null = null;
const books = (): Record<string, FleetNameBook> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const bookOf = (sid: string): FleetNameBook => { const b = (books()[sid] ??= emptyFleetNameBook()); b.pending ??= []; b.seen ??= []; b.last ??= ''; return b; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'fleetname.save_failed', { error: (e as Error).message }); } };
const collector = new BattleCollector();

export function fleetNameView() {
  const sid = ctx.curSaveId;
  return { ok: !!sid, running: !!(ctx.gameRunning && link.sessionReady), pending: sid ? bookOf(sid).pending.map((p) => ({ ...p, cands: p.cands ? p.cands.map((c) => ({ ...c })) : null })) : [] };
}

export function registerFleetName(router: LogRouter): void {
  router.on(SLOT.FLEETNAME, 'fleetname', (m: SllmMessage) => {
    if (m.kind === 'FLEETNAME') { terminalReplies.get('FLEETNAME:' + m.kv.req)?.(m); return; }
    if (m.kind !== 'BATTLE' && m.kind !== 'BATTLESYS' && m.kind !== 'BATTLEADM') return;
    const b = collector.feed(m), sid = ctx.curSaveId; if (!b || !sid) return;
    const book = bookOf(sid), p = proposalFrom(book, b); if (!p) return;
    addProposal(book, p); save(); logDiagnostic('info', 'fleetname.proposal', { lid: p.lid });
  });
  ipcMain.handle('fleetNameState', () => fleetNameView());
  /** 안건을 열 때: 아직 후보가 없으면 제독에게 묻는다(LLM). again = 다시 묻기. */
  ipcMain.handle('fleetNameAsk', async (_e, id: unknown, again?: unknown) => {
    try {
      const sid = ctx.curSaveId, p = sid ? bookOf(sid).pending.find((x) => x.id === id) : undefined; if (!sid || !p) throw new Error(L('안건을 다시 열어 주세요.', 'Reopen the item.'));
      if (p.cands && !again) return { ok: true, view: fleetNameView() };
      const ethics = (ctx.flagProv.ethicsFor(ctx.playerIdx) ?? []).map((e) => e.replace(/^ethic_/, '').replace(/_/g, ' '));
      const raw = String(await ctx.ai.chat(fleetNameMessages(p, { empire: ctx.playerName, ethics }), { maxTokens: 400, purpose: 'fleet-name', json: true }) ?? '');
      const got = readFleetNames(raw, p.fleet); if (!got) throw new Error(L('제독이 이름을 정리하지 못했습니다. 다시 물어봐 주세요.', 'The admiral could not settle on names. Ask again.'));
      p.cands = got; save(); return { ok: true, view: fleetNameView() };
    } catch (e) { logDiagnostic('warn', 'fleetname.ask_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
  /** 채택(name) 또는 기각(reject — 그냥 넘어감, 게임에 묻지 않음). */
  ipcMain.handle('fleetNamePick', async (_e, a: { id?: unknown; name?: unknown; reject?: unknown }) => {
    try {
      const sid = ctx.curSaveId, book = sid ? bookOf(sid) : null, p = book?.pending.find((x) => x.id === a?.id);
      if (!sid || !book || !p) throw new Error(L('안건을 다시 열어 주세요.', 'Reopen the item.'));
      if (a?.reject) { book.pending.splice(book.pending.indexOf(p), 1); save(); return { ok: true, view: fleetNameView() }; }
      const name = cleanFleetName(a?.name); if (!name) throw new Error(L('이름을 골라 주세요.', 'Pick a name.'));
      if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 함대 이름을 바꿀 수 있습니다.', 'The game must be running to rename the fleet.'));
      const req = ++link.reqCounter, m = await terminalRequest(fleetNameCommand(req, sid, p.lid, name), 'FLEETNAME', req);
      if (m.kv.status === 'no_target') { book.pending.splice(book.pending.indexOf(p), 1); save(); throw new Error(L(`${p.adm} 제독이 지금 함대를 지휘하고 있지 않아 안건을 거둡니다.`, `Admiral ${p.adm} no longer commands a fleet, so the item is withdrawn.`)); }
      if (m.kv.status !== 'applied') throw new Error(L('게임이 이름을 받지 못했습니다.', 'The game did not accept the name.'));
      book.pending.splice(book.pending.indexOf(p), 1); save();
      chronNoteWorld(L(`${ctx.playerName || '우리 제국'} 내각, ${p.adm} 제독의 건의로 ${p.sys ? p.sys + ' 전투에서 이긴 ' : ''}${p.fleet}에 「${name}」라는 이름을 붙이다.`, `The ${ctx.playerName || 'imperial'} cabinet names ${p.fleet}${p.sys ? ', victor at ' + p.sys + ',' : ''} "${name}" at Admiral ${p.adm}'s proposal.`));
      return { ok: true, name, view: fleetNameView() };
    } catch (e) { logDiagnostic('warn', 'fleetname.pick_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
}
