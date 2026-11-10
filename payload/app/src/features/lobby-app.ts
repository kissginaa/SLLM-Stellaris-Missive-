// 로비(2026-11-03 사용자 결정 ⑦). 규칙·문장: src/lobby.ts. 화면: ui/office-lobby.js(집무실 「로비」). 단일 의식 제국에는 없다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import type { StateSnapshot } from '../gamestate';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { civicCommand } from '../civic';
import { terminalRequest } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { moodNudge } from './mood-app';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { civicRegimeNow } from './civic-app';
import { VAULT } from '../vault';
import { earnToVault, vaultSuspicionUp, vaultGraftWeight } from './vault-app';
import { type LobbySave, type LobbyRec, type Offer, type Answer, LOBBY, lobbyDue, makeOffer, offerExpired, offerText, exposeRoll, lobbyChron, lobbyCommand, lobbyFact } from '../lobby';

interface Store { saves: Record<string, LobbySave> }
const file = () => path.join(app.getPath('userData'), 'sllm_lobby.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const isOffer = (o: unknown): o is Offer => { const x = obj(o); return typeof x.id === 'string' && (x.kind === 'official' || x.kind === 'bribe') && typeof x.group === 'string' && Number.isFinite(x.amount); };
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e);
    saves[safeKey(sid)] = { recs: Array.isArray(x.recs) ? (x.recs as LobbyRec[]).filter(isOffer).slice(-LOBBY.keep) : [], ...(isOffer(x.offer) ? { offer: x.offer } : {}), ...(typeof x.last === 'string' ? { last: x.last } : {}), ...(typeof x.lastSeen === 'string' ? { lastSeen: x.lastSeen } : {}) };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'lobby', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'lobby', error: e }); } }, 1500); }
const entry = (sid: string): LobbySave => (all().saves[safeKey(sid)] ??= { recs: [] });
const cmpDate = (a: string, b: string) => { const p = (d: string) => (d.match(/\d+/g) ?? []).map(Number); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; } return 0; };

async function sendEffect(sid: string, energy: number, o: Offer): Promise<string> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return 'offline';
  try { const req = ++link.reqCounter, m = await terminalRequest(lobbyCommand(req, sid, energy, o.fav, o.spurn), 'CIVIC', req); return m.kv.status || 'unknown'; }
  catch (e) { logDiagnostic('warn', 'lobby.effect_failed', { error: (e as Error).message }); return 'failed'; }
}
async function scandal(sid: string, r: LobbyRec): Promise<void> {
  r.status = 'exposed'; save();
  moodNudge(LOBBY.scandal.mood, L('뇌물 스캔들', 'Bribery scandal'));
  try { vaultSuspicionUp(sid, 2); } catch { /* 금고 없음 */ }
  if (ctx.gameRunning && /^\d+$/.test(sid)) { try { const req = ++link.reqCounter; await terminalRequest(civicCommand(req, sid, 'lobby_scandal', [{ name: LOBBY.scandal.mod, days: LOBBY.scandal.days }]), 'CIVIC', req); } catch (e) { logDiagnostic('warn', 'lobby.scandal_failed', { error: (e as Error).message }); } }
  chronNoteWorld(lobbyChron(r, 'exposed'), true);
  ctx.notify({ kind: 'office', title: L('뇌물 스캔들', 'Bribery scandal'), body: L(`「${r.group}」에게서 받은 뒷돈이 드러났습니다. 2년 동안 모든 행성 안정도 −6, 민심이 떨어집니다.`, `The money you took from the ${r.group} has come to light. All planets −6 stability for 2 years, and approval drops.`) });
  push();
}

function onSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId || civicRegimeNow() === 'none') return;
  const sid = snap.sid, e = entry(sid), date = snap.date;
  if (e.lastSeen === date) return; e.lastSeen = date;
  // 몰래 받은 뒷돈이 드러날 때가 왔나
  for (const r of e.recs) if (r.kind === 'bribe' && r.answer === 'accepted' && r.exposed && r.status !== 'exposed' && r.exposeAt && cmpDate(date, r.exposeAt) >= 0) { void scandal(sid, r); break; }
  if (e.offer && offerExpired(e.offer, date)) { e.recs = [...e.recs, { ...e.offer, answer: 'expired' as Answer, answered: date }].slice(-LOBBY.keep); delete e.offer; save(); push(); return; }
  if (!lobbyDue(e, date, Math.random)) { save(); return; }
  const o = makeOffer((snap.factions ?? []).map((f) => ({ ...f, support: f.support * 100 })), null, date, Math.random); // 지지율 0~1 → %
  if (!o) { save(); return; }
  e.offer = o; e.last = date; save(); push();
  ctx.notify({ kind: 'office', title: o.kind === 'official' ? L('이익단체의 면담 요청', 'An interest group requests an audience') : L('수상한 밤손님', 'A suspicious night visitor'), body: L(`「${o.group}」이(가) 찾아왔습니다. 집무실 「로비」에서 답하세요(석 달 안).`, `The ${o.group} has come calling. Answer in the office's "Lobbying" within three months.`) });
}

export function lobbyView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', regime: civicRegimeNow() };
  const e = entry(sid);
  return { sid, regime: civicRegimeNow(), running: ctx.gameRunning, offer: e.offer ? { ...e.offer, text: offerText(e.offer) } : null,
    recs: e.recs.slice(-8).reverse().map((r) => ({ date: r.date, answered: r.answered, kind: r.kind, group: r.group, amount: r.amount, answer: r.answer, exposed: r.status === 'exposed' })) };
}
function push(): void { try { const v = lobbyView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('lobbyUpdate', v); } catch { /* 창 없음 */ } }

async function answer(aIn: unknown): Promise<string> {
  const sid = ctx.curSaveId || '', date = ctx.gameDate || '';
  if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const e = entry(sid), o = e.offer; if (!o) throw new Error(L('지금 찾아온 이익단체가 없습니다.', 'No interest group is waiting.'));
  const a = aIn === 'accept' ? 'accepted' : aIn === 'decline' ? 'declined' : aIn === 'report' && o.kind === 'bribe' ? 'reported' : null;
  if (!a) throw new Error(L('답을 골라 주세요.', 'Choose an answer.'));
  if (a === 'accepted' && !ctx.gameRunning) throw new Error(L('게임이 켜져 있어야 받을 수 있습니다.', 'The game must be running to accept.'));
  const r: LobbyRec = { ...o, answer: a, answered: date }; delete e.offer;
  let text = '';
  if (a === 'accepted' && o.kind === 'official') {
    r.status = await sendEffect(sid, o.amount, o);
    chronNoteWorld(lobbyChron(r, 'official'), true);
    text = L(`공식 후원을 받았습니다. 국고에 에너지 ${o.amount}이(가) 들어오고, 가까운 파벌은 2년 동안 정부를 더 지지합니다(반대 성향 파벌은 반감).`, `You accepted the official donation: ${o.amount} energy to the treasury. The friendly faction backs the government more for 2 years (the opposite faction resents it).`);
  } else if (a === 'accepted') {
    let susp = 0; try { susp = Math.max(0, Math.round((vaultGraftWeight(sid) - 1) / VAULT.graftPerSuspicion)); } catch { /* 금고 없음 */ }
    const ok = (() => { try { return earnToVault(sid, o.amount, L(`「${o.group}」`, `${o.group}`)); } catch { return false; } })();
    r.status = await sendEffect(sid, 0, o);
    Object.assign(r, exposeRoll(susp, date, Math.random));
    text = ok ? L(`뒷돈 에너지 ${o.amount}이(가) 개인 금고에 들어왔습니다. 가까운 파벌이 은밀히 정부를 돕습니다. 아무도 모르기를…`, `${o.amount} energy slipped into your private vault. The friendly faction quietly backs the government. Let's hope nobody finds out…`)
      : L('뒷돈을 받았지만 금고에 넣지 못했습니다.', 'You took the money but could not put it in the vault.');
  } else if (a === 'reported') {
    moodNudge(LOBBY.reportMood, L('뇌물 제안 고발', 'Bribe exposed'));
    r.status = await sendEffect(sid, 0, { ...o, ...(o.fav ? { spurn: [o.fav] } : {}), fav: undefined }); // 고발당한 단체 쪽 파벌이 반감
    chronNoteWorld(lobbyChron(r, 'reported'), true);
    text = L('뇌물 제안을 공개 고발했습니다. 국민이 박수를 보냅니다(민심 +2). 그 단체와 가까운 파벌은 불쾌해합니다.', 'You exposed the bribe in public. The people applaud (+2 approval); the faction close to that group is offended.');
  } else text = L('정중히 돌려보냈습니다.', 'You politely sent them away.');
  e.recs = [...e.recs, r].slice(-LOBBY.keep); save(); push();
  return text;
}

export function registerLobby(): void {
  onGameSnapshot(onSnapshot, 'lobby');
  registerSecFacts({ id: 'Lobbying', kw: ['로비', '이익단체', '뇌물', '뒷돈', '후원', 'lobby', 'bribe', 'donation'], facts: (sid) => (sid === ctx.curSaveId ? entry(sid).recs.slice(-3).filter((r) => r.kind === 'official' || r.answer !== 'accepted' || r.status === 'exposed').map(lobbyFact) : []) });
  ipcMain.handle('lobbyState', async () => lobbyView());
  ipcMain.handle('lobbyAnswer', async (_e, a: unknown) => { try { return { ok: true, text: await answer(a), state: lobbyView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: lobbyView() }; } });
}
