// 통치자 개인 금고(앱 쪽, 2026-10-30). 규칙: src/vault.ts. 화면은 침실(금고가 있는 곳)에서 붙인다 — 여기는 시스템만.
// 저장: sllm_vault.json { saves: { [세이브]: VaultSave } }. 게임 회신 SLLM:VAULT 는 log-router SLOT.VAULT 에서 받는다.
// 다른 기능(백화점·펫샵·카지노·스포츠토토)은 vaultBalance / spendFromVault / earnToVault 만 쓴다.
import { registerSecFacts } from './secretary-live';
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { type VaultSave, emptyVault, sanitizeVault, vaultCommand, applyVaultResult, vaultSpend, vaultEarn, fadeSuspicion, graftWeight, VAULT } from '../vault';

let data: { saves: Record<string, VaultSave> } | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_vault.json');
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); const saves: Record<string, VaultSave> = {}; for (const [k, v] of Object.entries(j?.saves ?? {})) saves[k] = sanitizeVault(v); data = { saves }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'vault', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'vault', error: e }); } }
const vaultOf = (sid: string): VaultSave => (all().saves[sid] ??= emptyVault());
let busy = false;

/** 화면용 상태(부패 낌새 수치는 보여 주지 않음 — 낌새는 궁정 쪽에서 드러난다). */
export function vaultView() {
  const sid = ctx.curSaveId; if (!sid) return { sid: '', balance: 0, log: [], pending: null, busy };
  const v = vaultOf(sid);
  return { sid, balance: v.bal, pending: v.pending ? { dir: v.pending.dir, amount: v.pending.amt } : null, busy, log: v.log.slice(-30).reverse() };
}
function push(): void { const s = vaultView(); for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('vaultUpdate', s); }

export const vaultBalance = (sid: string): number => vaultOf(sid).bal;
/** 금고에서 쓰기(백화점·펫샵·카지노 판돈·토토). 모자라면 false — 부르는 쪽이 안내. */
export function spendFromVault(sid: string, amount: number, what: string): boolean { const ok = vaultSpend(vaultOf(sid), Math.round(amount), what, ctx.gameDate || ''); if (ok) { save(); push(); } return ok; }
/** 금고로 들어오기(카지노·토토 당첨). */
export function earnToVault(sid: string, amount: number, what: string): boolean { const ok = vaultEarn(vaultOf(sid), Math.round(amount), what, ctx.gameDate || ''); if (ok) { save(); push(); } return ok; }
/** 궁정 「부패」 음모 후보 가중치(court-app plotWorld 가 읽는다). */
export const vaultGraftWeight = (sid: string): number => graftWeight(vaultOf(sid).susp);
/** 파파라치 기사(2026-10-31): 씀씀이·암시장 기사가 나면 부패 낌새 +n(상한 안). 화면에는 보이지 않고 궁정 쪽에서 드러남. */
export function vaultSuspicionUp(sid: string, n: number): void { const v = vaultOf(sid); if (!(n > 0) || v.susp >= VAULT.suspicionMax) return; v.susp = Math.min(VAULT.suspicionMax, v.susp + Math.round(n)); v.suspAt = ctx.gameDate || v.suspAt; save(); }

/** 넣기(in)·빼기(out). 보내기 전에 기록(같은 cid 로 다시 보내면 게임이 중복을 막음). 응답이 없으면 대기로 남겨 다시 누를 수 있다. */
async function move(dir: unknown, amount: unknown) {
  const sid = ctx.curSaveId; if (!sid || !/^\d+$/.test(sid)) return { ok: false, error: L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.'), state: vaultView() };
  if (!ctx.gameRunning || !link.sessionReady) return { ok: false, error: L('게임이 켜져 있어야 금고를 쓸 수 있습니다.', 'The game must be running to use the vault.'), state: vaultView() };
  if (busy) return { ok: false, error: L('처리 중입니다.', 'Already in progress.'), state: vaultView() };
  const v = vaultOf(sid), d: 'in' | 'out' = dir === 'out' ? 'out' : 'in', amt = Math.round(Number(amount));
  // 대기 중인 같은 요청이 있으면 그것을 다시 보낸다(번호 그대로 → 두 번 반영되지 않음)
  const p = v.pending ?? (() => {
    if (!Number.isSafeInteger(amt) || amt < 1 || amt > VAULT.maxAmount) return null;
    if (d === 'out' && amt > v.bal) return null;
    return { cid: randomUUID().replace(/-/g, ''), dir: d, amt, since: ctx.gameDate || '' };
  })();
  if (!p) return { ok: false, error: d === 'out' && amt > v.bal ? L('금고에 그만큼 들어 있지 않습니다.', 'The vault does not hold that much.') : L('금액을 확인해 주세요.', 'Check the amount.'), state: vaultView() };
  v.pending = p; save(); busy = true; push();
  try {
    const req = ++link.reqCounter;
    const r = await terminalRequest(vaultCommand(req, sid, p.cid, p.dir, p.amt), 'VAULT', req);
    if (r.kv.cid !== p.cid || r.kv.sid !== sid) throw new Error('mismatch');
    const st = String(r.kv.status ?? '');
    if (st === 'short') { v.pending = null; save(); return { ok: false, error: L('국고의 에너지 크레딧이 모자랍니다.', 'Not enough energy credits in the treasury.'), state: vaultView() }; }
    const res = applyVaultResult(v, p, st, r.kv.def === '1', ctx.gameDate || '', Math.random); save();
    if (!res.moved) return { ok: false, error: L('게임 적용을 확인하지 못했습니다.', 'Could not confirm in game.'), state: vaultView() };
    if (res.suspicion) logDiagnostic('info', 'vault.suspicion', { level: v.susp }); // 화면에는 알리지 않음(몰래 쌓임)
    logDiagnostic('info', 'vault.move', { dir: p.dir, amount: p.amt });
    return { ok: true, state: vaultView() };
  } catch (e) {
    logDiagnostic('warn', 'vault.move_failed', { error: String((e as Error)?.message || e) });
    return { ok: false, error: L('게임에서 응답을 받지 못했습니다. 다시 누르면 같은 요청을 다시 보냅니다(두 번 반영되지 않습니다).', 'No response from the game. Press again to resend the same request (it will not be applied twice).'), state: vaultView() };
  } finally { busy = false; push(); }
}

export function registerVault(router: LogRouter): void {
  registerSecFacts({ id: 'Personal vault', kw: ['금고', '비자금', '개인 돈', '잔고', 'vault', 'private funds', 'balance', '부패', 'graft'], facts: (sid) => { const v = vaultOf(sid); return [`Personal vault balance: ${v.bal} energy credits.`, `Graft suspicion: ${v.susp}/${VAULT.suspicionMax}.`, ...(v.log.length ? ['Recent vault entries: ' + v.log.slice(-6).reverse().map((e) => `${e.d} ${e.k} ${e.amt}${e.what ? ` (${e.what})` : ''}`).join('; ')] : [])]; } }); // 비서가 아는 기록(2026-10-31)
  router.on(SLOT.VAULT, 'vault:reply', (m: SllmMessage) => { if (m.kind === 'VAULT') terminalReplies.get('VAULT:' + m.kv.req)?.(m); });
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId) return; if (fadeSuspicion(vaultOf(snap.sid), snap.date)) save(); });
  ipcMain.handle('vaultState', () => vaultView());
  ipcMain.handle('vaultDeposit', (_e, amount: unknown) => move('in', amount));
  ipcMain.handle('vaultWithdraw', (_e, amount: unknown) => move('out', amount));
  ipcMain.handle('vaultRetry', () => { const sid = ctx.curSaveId; const p = sid ? vaultOf(sid).pending : null; return p ? move(p.dir, p.amt) : { ok: false, error: L('다시 보낼 요청이 없습니다.', 'Nothing to resend.'), state: vaultView() }; });
}
