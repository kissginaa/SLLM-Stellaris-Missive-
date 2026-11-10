// A-00b 6번: 통신 단말기(앱 쪽) — 연락처 목록(CONTACT_*), 단말기 명령을 보내고 끝 줄(KIND:req)을 기다리는 terminalRequest,
// 상대 연결(dialTerminal: 게임에 대화 창을 열게 함), IPC 3개. 2026-10-15 main.ts에서 옮김(동작 변경 없음).
// HELLO·ETHIC_END 줄도 terminalReplies 로 응답을 받는다(그 처리는 main.ts 로그 자리에 남아 있음).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { TerminalContacts, contactCategory } from '../terminal-contacts';
import type { SllmMessage } from '../protocol';
import { enqueue, sendConsole, link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { pick } from './settings-ui';

export const terminal = new TerminalContacts();
// 「통신 단절」(2026-10-24 알파 11): 모드가 가끔 「민간 선단」처럼 통신하면 안 되는 것을 연락처로 보낸다 → 사용자가 목록에서 지운다.
// 세이브마다(나라 번호 sllm_idx 는 세이브마다 따로) 저장. 지우면 단말기뿐 아니라 만찬·편지·트로피 등 연락처를 쓰는 모든 기능에서 빠진다. 「복구」로 되살린다.
type CutBook = Record<string, Record<string, { name: string; on: string }>>;
let cutBook: CutBook | null = null;
const cutFile = () => path.join(app.getPath('userData'), 'sllm_contact_cut.json');
function cuts(): CutBook {
  if (cutBook) return cutBook;
  try { const v = JSON.parse(fs.readFileSync(cutFile(), 'utf8')); cutBook = v && typeof v === 'object' && !Array.isArray(v) ? v as CutBook : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'contact_cut', error: e }); cutBook = {}; }
  return cutBook;
}
function saveCuts(): void {
  try { const f = cutFile(), tmp = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(cuts()), 'utf8'); fs.renameSync(tmp, f); }
  catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'contact_cut', error: e }); }
}
terminal.isCut = (sid, idx) => !!cuts()[sid]?.[String(idx)];
export const terminalReplies = new Map<string, (m: SllmMessage) => void>();
export const terminalView = () => ({ sid: terminal.sid, date: terminal.date, items: terminal.items.filter(c=>contactAllowed(c.type)).map(c=>({ ...c, cat: contactCategory(c.type), talkOnly: !ctx.modCompatibility.policy(c.type).actions })), cut: terminal.cut.filter(c=>contactAllowed(c.type)).map(c=>({ idx: c.idx, name: c.name, type: c.type, gest: c.gest, sub: c.sub, cat: contactCategory(c.type) })) }); // talkOnly: 대화 전용(게임 행동 없음, 알파 8)
export async function terminalRequest(effect: string, end: string, req: number): Promise<SllmMessage> {
  const key = end + ':' + req;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectResponse!: (e: Error) => void;
  const response = new Promise<SllmMessage>((resolve, reject) => {
    terminalReplies.set(key, resolve);
    rejectResponse = reject;
  });
  // Observe a possible timeout even while another console command is still queued.
  void response.catch(() => {});
  try { await enqueue(async () => {
    timer = setTimeout(() => { logDiagnostic('warn','game.response.timeout',{req,end,timeoutMs:12000});terminalReplies.delete(key); rejectResponse(new Error(pick('게임 응답이 없습니다. 게임과 최신 SLLM 연결 모드를 확인해 주세요.', 'No response from the game. Check the game and the latest SLLM link mod.'))); }, 12000);
    await sendConsole(effect);
  }); return await response; }
  finally { if (timer) clearTimeout(timer); terminalReplies.delete(key); }
}
export function contactAllowed(type: string): boolean { return ctx.modCompatibility.policy(type).contact; }

export const dialTerminal = async (a: { sid?: unknown; idx?: unknown }) => {
  const idx = Number(a?.idx);
  if (!ctx.gameRunning) return { ok: false, error: pick('게임이 켜져 있어야 통신할 수 있습니다.', 'The game must be running to communicate.') };
  if (a?.sid !== ctx.curSaveId || terminal.sid !== ctx.curSaveId || !Number.isSafeInteger(idx) || !terminal.items.some(c => c.idx === idx && contactAllowed(c.type))) return { ok: false, error: pick('현재 세이브의 연락처를 다시 갱신해 주세요.', 'Please refresh the current save\'s contacts.') };
  if (ctx.pend || ctx.pending) return { ok: false, error: pick('진행 중인 통신과 제안을 마친 뒤 연결해 주세요.', 'Finish the ongoing call and proposals before connecting.') };
  const req = ++link.reqCounter;
  try {
    const m = await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_terminal_dial = { TID = ' + idx + ' REQ = ' + req + ' } }', 'DIAL_END', req);
    if (m.kv.sid !== ctx.curSaveId || Number(m.kv.ok) !== 1) return { ok: false, error: pick('상대와 통신할 수 없습니다. 연락처를 다시 갱신해 주세요.', 'Cannot reach them. Please refresh the contacts.') };
    if(a?.sid!==ctx.curSaveId)return {ok:false,error:pick('세이브가 바뀌었습니다.', 'The save changed.')};
    await ctx.refreshEthics(idx); if(a?.sid!==ctx.curSaveId)return {ok:false,error:pick('세이브가 바뀌었습니다.', 'The save changed.')};
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
};

export function registerTerminal(router: LogRouter): void {
  router.on(SLOT.TERMINAL, 'terminal:feed', (m: SllmMessage) => {
    const contactsDone = terminal.feed(m);
    if (contactsDone) ctx.toUi('contacts', terminalView());
    if ((m.kind === 'CONTACT_END' && contactsDone) || m.kind === 'DIAL_END') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
  ipcMain.handle('contactsList', async () => terminalView());
  ipcMain.handle('contactsRefresh', async () => {
    if (!ctx.gameRunning) return { ok: false, error: pick('게임이 켜져 있어야 목록을 갱신할 수 있습니다.', 'The game must be running to refresh the list.') };
    const req = ++link.reqCounter;
    try { await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req); return { ok: true, state: terminalView() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  // 통신 단절 / 복구(2026-10-24). 지금 세이브의 받은 목록에 있는 상대만 지울 수 있다.
  ipcMain.handle('contactCut', async (_e, a: { sid?: unknown; idx?: unknown }) => {
    const idx = Number(a?.idx), sid = String(a?.sid ?? '');
    if (sid !== ctx.curSaveId || terminal.sid !== sid || !Number.isSafeInteger(idx)) return { ok: false, error: pick('현재 세이브의 연락처를 다시 갱신해 주세요.', 'Please refresh the contacts for the current save.') };
    const c = terminal.all.find((x) => x.idx === idx); if (!c) return { ok: false, error: pick('목록에 없는 상대입니다.', 'That contact is not in the list.') };
    if (ctx.pend || ctx.pending) return { ok: false, error: pick('진행 중인 통신과 제안을 마친 뒤 해 주세요.', 'Finish the ongoing call and proposals first.') };
    (cuts()[sid] ??= {})[String(idx)] = { name: c.name.slice(0, 100), on: ctx.gameDate || '' }; saveCuts(); terminal.refilter();
    logDiagnostic('info', 'contacts.cut', { idx, type: c.type }); const v = terminalView(); ctx.toUi('contacts', v); return { ok: true, state: v };
  });
  ipcMain.handle('contactRestore', async (_e, a: { sid?: unknown; idx?: unknown }) => {
    const idx = Number(a?.idx), sid = String(a?.sid ?? '');
    if (sid !== ctx.curSaveId || !Number.isSafeInteger(idx) || !cuts()[sid]?.[String(idx)]) return { ok: false, error: pick('복구할 상대가 없습니다.', 'There is nothing to restore.') };
    delete cuts()[sid][String(idx)]; if (!Object.keys(cuts()[sid]).length) delete cuts()[sid]; saveCuts(); terminal.refilter();
    logDiagnostic('info', 'contacts.restore', { idx }); const v = terminalView(); ctx.toUi('contacts', v); return { ok: true, state: v };
  });
  ipcMain.handle('contactDial', async (_e, a: { sid?: unknown; idx?: unknown }) => {
    if (ctx.mailReplyBusy) return { ok: false, error: pick('편지 답장을 연결 중입니다.', 'Connecting the letter reply.') };
    return dialTerminal(a);
  });
}
