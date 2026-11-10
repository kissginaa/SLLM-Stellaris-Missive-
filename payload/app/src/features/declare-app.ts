// 전쟁 선언문(2026-10-20 알파 10): 전쟁 시작(EVT war_start) → 알림 → 선언문 창(직접 쓰기·AI 초안) → 저장 → (선택) 출정 의식.
// 규칙: src/declare.ts, 화면: ui/declare.html. 저장: 앱 데이터 sllm_wardecl.json(세이브별 목록 — 신문·라디오·상대 제국이 나중에 재료로 쓴다).
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { coverScreen } from '../app/cover-screen'; // 작업 표시줄까지 덮는 전체화면(2026-11-05)
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { pick } from './settings-ui';
import { gameState } from './gamestate-app';
import { chronNoteWorld } from './chronicle-app';
import { ceremonyOpen } from './ceremony-app';
import { condemnSetInfo, condemnAfterDeclaration } from './condemn-app';
import { debateOn } from './debate-app'; // 찬반 논평(2026-10-20 알파 10)
import { creedEthics, safeKey } from '../music';
import { parseWarInfo, describeWar, type WarInfo } from '../warinfo';
import { type Declaration, type WarSide, sanitizeDecl, cleanDeclText, warSide, declTitle, declMessages, parseDecl, DECL_KEEP } from '../declare';

import { link } from '../app/game-link';
import { terminal, terminalRequest, terminalReplies } from './terminal';
import { refreshFrontier, frontierFor } from './frontier-app'; // 국경·영유권(2026-10-26)
import { frontierFactsUs } from '../frontier';
import { declarationBuffCommand } from '../declaration-buff';
const L = pick;
let owner = '', windowOwner = '', issuing = false;
let presentation: { title: string; text: string; notice: string; session: string } | null = null;
const session = () => `${ctx.curSaveId}:${link.epoch}`;
function syncSession(): void {
  if (owner === session()) return;
  owner = session(); presentation = null; declare.pending = null; declare.info.clear(); declare.draft = null;
}
async function applyDeclarationBuff(side: WarSide): Promise<string> {
  const sid = ctx.curSaveId, epoch = link.epoch;
  try {
    const req = ++link.reqCounter;
    const r = await terminalRequest(declarationBuffCommand(req, sid, ctx.playerIdx, side), 'DECLBUFF', req);
    if (sid !== ctx.curSaveId || epoch !== link.epoch || r.kv.sid !== sid) return L('세이브가 바뀌어 버프 결과를 확인하지 못했습니다.', 'The save changed before the bonus could be confirmed.');
    if (r.kv.status === 'applied') return side === 'att' ? L('2년간 함선 무기 피해량 +5%, 함선 이동 속도 +10% 적용 확인.', 'Confirmed: +5% ship weapon damage and +10% ship speed for 2 years.') : L('2년간 함선 내구도·보호막·장갑 +10% 적용 확인.', 'Confirmed: +10% ship hull, shields and armor for 2 years.');
    if (r.kv.status === 'duplicate') return L('같은 선언문 버프가 이미 적용 중입니다. 기간과 효과는 중첩되지 않습니다.', 'This declaration bonus is already active. Its duration and effects do not stack.');
    if (r.kv.status === 'no_war') return L('해당 공격·방어 전쟁에 참여 중이 아니어서 버프를 적용하지 않았습니다.', 'No bonus applied: you are not on the corresponding side of an active war.');
    return L('버프 적용을 확인하지 못했습니다. 최신 연결 모드를 켜고 게임을 다시 시작해 주세요.', 'The bonus was not confirmed. Enable the latest connection mod and restart the game.');
  } catch (e) {
    logDiagnostic('warn', 'declare.buff_failed', { error: String(e) });
    return L('선언문은 저장했지만 버프 적용을 확인하지 못했습니다.', 'The declaration was saved, but the bonus could not be confirmed.');
  }
}
const file = () => path.join(app.getPath('userData'), 'sllm_wardecl.json');
let store: ReturnType<typeof sanitizeDecl> | null = null;
function all() { if (store) return store; try { store = sanitizeDecl(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'wardecl', error: e }); store = sanitizeDecl({}); } return store; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'wardecl', error: e }); } }
/** 이 세이브의 선언문 목록(신문·라디오·상대 제국이 재료로 쓸 때). 최근 것이 뒤. */
export function warDeclarations(sid = ctx.curSaveId): Declaration[] { return all().saves[safeKey(sid)] ?? []; }

/** 전쟁 시작 알림 대기: 선언문 창이 열릴 때 쓴다. */
export const declare = { pending: null as { war: string; date: string } | null, /** 전쟁 이름 → 모드가 보낸 전쟁 정보(명분·주도국·관계). 최근 20개 */ info: new Map<string, WarInfo>(), win: null as BrowserWindow | null, draft: null as { title: string; text: string; side: WarSide; enemy: string } | null, fullscreen: false };

export function registerDeclare(router: LogRouter): void {
  router.on(SLOT.DECLARE, 'declare:war', (m: SllmMessage) => {
    if (m.kind === 'DECLBUFF') { terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); return; }
    syncSession();
    if (m.kv.sid && m.kv.sid !== ctx.curSaveId) return;
    if (m.kind === 'WARINFO') { const w = parseWarInfo(m.kv); if (w) { declare.info.set(w.war, w); condemnSetInfo(w); if (declare.info.size > 20) declare.info.delete(declare.info.keys().next().value as string); if (declare.win && !declare.win.isDestroyed()) declare.win.webContents.send('declareInfo', L(describeWar(w, 'ko'), describeWar(w, 'en'))); } return; }
    if (m.kind !== 'EVT' || m.kv.kind !== 'war_start') return;
    const war = String(m.kv.war ?? '').slice(0, 120), date = String(m.kv.date ?? '').slice(0, 20);
    if (declare.pending && declare.pending.war === war) return; // 같은 전쟁 중복 신호
    declare.pending = { war, date };
    const side = warSide(gameState.last?.wars, war).side;
    ctx.notify({ kind: 'declare', title: side === 'def' ? L('전쟁이 터졌습니다 — 항전 선언문을 작성하시겠습니까?', 'War has come — write a declaration of resistance?') : L('전쟁이 시작되었습니다 — 전쟁 선언문을 작성하시겠습니까?', 'War has begun — write a declaration of war?'), body: war || L('전쟁', 'War'), action: L('선언문 쓰기', 'Write the declaration') });
    logDiagnostic('info', 'declare.war_start', { war, date, side });
  });
  ipcMain.handle('declareState', async () => {
    syncSession();
    const p = declare.pending, ws = warSide(gameState.last?.wars, p?.war ?? '');
    const wi = p ? declare.info.get(p.war) : undefined;
    return { war: p?.war ?? '', date: p?.date ?? ctx.gameDate ?? '', side: wi ? wi.side : ws.side, enemy: wi ? (wi.side === 'att' ? wi.defender : wi.attacker) || ws.enemy : ws.enemy, info: wi ? L(describeWar(wi, 'ko'), describeWar(wi, 'en')) : '', title: L(declTitle(wi?.side ?? ws.side, true), declTitle(wi?.side ?? ws.side, false)), empire: ctx.playerName || '', draft: declare.draft, flag: ctx.flagUrlFor(ctx.playerIdx) ?? '', recent: warDeclarations().slice(-5).map((d) => ({ date: d.date, war: d.war, title: d.title, lines: d.text.split('\n').length })) };
  });
  ipcMain.handle('declareDraft', async () => {
    const p = declare.pending, ws = warSide(gameState.last?.wars, p?.war ?? ''), snap = gameState.last;
    try {
      const wi = p ? declare.info.get(p.war) : undefined;
      const enemyName = wi ? (wi.side === 'att' ? wi.defender : wi.attacker) || ws.enemy : ws.enemy;
      const eIdx = terminal.sid === ctx.curSaveId ? terminal.items.find((c) => c.name === enemyName)?.idx ?? 0 : 0; // 적의 통신 번호(이름으로, 모르면 0)
      if (eIdx) await refreshFrontier([eIdx]).catch(() => {}); // 국경·영유권·점령(2026-10-26)
      const raw = await ctx.ai.chat(declMessages(ctx.playerName || 'the player empire', p?.war ?? '', enemyName, wi ? wi.side : ws.side, creedEthics(snap?.empireEth), !!snap?.gestalt, p?.date || ctx.gameDate || '', wi ? describeWar(wi, 'en') : '', eIdx ? frontierFactsUs(frontierFor(eIdx)) : []), { purpose: 'war-declaration', json: true, maxTokens: 1200 });
      const d = parseDecl(raw); if (!d) return { ok: false, error: L('AI 답에서 선언문을 읽지 못했습니다. 다시 시도해 주세요.', 'Could not read a declaration from the AI reply. Please try again.') };
      return { ok: true, title: d.title, text: d.text };
    } catch (e) { return { ok: false, error: L('AI 초안 실패: ', 'AI draft failed: ') + (e instanceof Error ? e.message : String(e)) }; }
  });
  /** 저장: 이 세이브의 선언문 목록에 더한다. */
  ipcMain.handle('declareSave', async (_e, titleIn: unknown, textIn: unknown) => {
    syncSession();
    if (issuing || !ctx.curSaveId || windowOwner !== session()) return { ok: false, error: L('진행 중인 요청 또는 변경된 세이브입니다. 창을 다시 열어 주세요.', 'A request is pending or the save changed. Reopen this window.') };
    const text = cleanDeclText(textIn); if (!text) return { ok: false, error: L('선언문 본문이 비어 있습니다.', 'The declaration is empty.') };
    const p = declare.pending, ws = warSide(gameState.last?.wars, p?.war ?? '');
    const wi = p ? declare.info.get(p.war) : undefined;
    const d: Declaration = { date: p?.date || ctx.gameDate || '', war: p?.war ?? '', enemy: wi ? (wi.side === 'att' ? wi.defender : wi.attacker) || ws.enemy : ws.enemy, side: wi ? wi.side : ws.side, goal: wi?.attGoal ?? '', title: (typeof titleIn === 'string' && titleIn.trim() ? titleIn : L(declTitle(ws.side, true), declTitle(ws.side, false))).slice(0, 80), text, audio: [], createdAt: Date.now() };
    const key = safeKey(ctx.curSaveId), list = (all().saves[key] ??= []); list.push(d); if (list.length > DECL_KEEP) list.splice(0, list.length - DECL_KEEP); save();
    chronNoteWorld(`${d.date} ${d.title}: ${text.split('\n')[0]}`, true);
    if (d.war) condemnAfterDeclaration(d.war, text); // 선언문 뒤 은하의 반응(규탄 성명)
    void debateOn(d.side === 'def' ? 'war_def' : 'war_att', `${d.title} — ${d.war}${d.enemy ? ' vs ' + d.enemy : ''}: ${text.split('\n')[0]}`, d.date); // 국내 찬반 논평
    declare.draft = null;
    issuing = true;
    const issuedSession = session();
    try {
      const exactWar = gameState.last?.sid === ctx.curSaveId ? gameState.last.wars?.find(w => w.name === p?.war) : undefined;
      const side = wi?.side ?? exactWar?.side ?? '';
      const notice = side ? await applyDeclarationBuff(side) : L('선언문을 저장했습니다. 전쟁 정보를 확인할 수 없어 버프는 적용하지 않았습니다.', 'Declaration saved. No bonus applied because the war information is unavailable.');
      presentation = issuedSession === session() ? { title: d.title, text: d.text, notice, session: issuedSession } : null;
      return { ok: true, index: list.length - 1, notice };
    } finally { issuing = false; }
  });
  ipcMain.handle('declareFullscreen', async (_e, on: unknown) => { setFullscreen(!!on); return true; });
  ipcMain.handle('declareCeremony', async () => {
    if (!presentation || presentation.session !== session()) return { ok: false, error: L('현재 세이브에서 선언문을 먼저 발표해 주세요.', 'Issue a declaration in the current save first.') };
    return ceremonyOpen(presentation);
  });
  ipcMain.handle('declareClose', async () => { closeDeclare(); return true; });
  ipcMain.handle('declareOpen', async () => { openDeclare(); return true; });
}
function setFullscreen(on: boolean): void {
  const w = declare.win; if (!w || w.isDestroyed()) return;
  if (on === declare.fullscreen) return; declare.fullscreen = on;
  if (on) { w.setResizable(true); coverScreen(w, true, ctx.gameDip); } // 작업 표시줄까지 덮는 진짜 전체화면(2026-11-05, app/cover-screen.ts)
  else { coverScreen(w, false); const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea; const sz = winSize(area); w.setBounds({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }); w.setAlwaysOnTop(true, 'screen-saver', 1); }
}
const winSize = (area: { width: number; height: number }) => ({ width: Math.min(1100, Math.round(area.width * 0.8)), height: Math.min(820, Math.round(area.height * 0.86)) });
export function openDeclare(): void {
  if (declare.win && !declare.win.isDestroyed()) { declare.win.show(); declare.win.focus(); return; }
  syncSession(); windowOwner = session();
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = winSize(area);
  const x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  declare.fullscreen = false;
  declare.win = new BrowserWindow({ ...sz, x, y, resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), backgroundThrottling: false } });
  declare.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void declare.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'declare.html'));
  declare.win.once('ready-to-show', () => { declare.win?.show(); });
  declare.win.on('closed', () => { declare.win = null; declare.fullscreen = false; });
}
export function closeDeclare(): void { if (declare.win && !declare.win.isDestroyed()) declare.win.close(); }
export const declareFileUrl = (f: string): string => pathToFileURL(f).href;
