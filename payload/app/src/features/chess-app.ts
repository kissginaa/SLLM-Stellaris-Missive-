// 지도자와 체스(앱 쪽, 2026-10-30 사용자 결정). 규칙·AI: src/chess.ts(작업자 스레드 src/chess-worker.ts), 화면: ui/chess.html.
// 결정 사항(1030_집컴_옮기기/00_새기능_계획.md)
//  - 「직접 만나는」 자리에서만: 사교회·지도자 만찬·타국 주최 만찬. 상대는 그 자리의 우리 지도자 또는 다른 제국 통치자.
//  - 대국 결과는 재미로만(신뢰·자원 변화 없음). 대국 중 나눈 말은 평소 대화와 똑같이 셈한다(우리 지도자: persona-app sayInPerson).
//  - 만담은 플레이어가 물을 때만 AI 한 번. 앱이 기보를 실시간으로 들고 있다가(판 상황을 사람 말로 풀어 넘김) 판이 끝나면 결과만 남긴다.
// 자리 연결: 각 장면 모듈이 registerChessScene(장면, 지금 그 자리에 있는 상대 목록)을 건다. 다른 제국 통치자의 말은 registerChessRulerTalker 로
//  그 장면의 기존 대화 규칙(관계·호감)을 쓰는 함수를 건다(연결 전에는 「아직 연결되지 않음」 안내).
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { personOf, personaNote, sayInPerson } from './persona-app';
import type { Talk } from '../persona';
import { type Pos, type Move, type Color, type Status, type ChessEvent, type Style, type PieceType, newGame, legalMoves, play, statusOf, san, inCheck, chooseMove, styleFor, boardStory, typeOf, colorOf, sqName, STATUS_EN } from '../chess';

export type ChessScene = 'social' | 'banquet' | 'fbanquet';
export const CHESS_SCENES: ChessScene[] = ['social', 'banquet', 'fbanquet'];
export type ChessOpp = { kind: 'leader'; key: string } | { kind: 'ruler'; idx: number; name: string; empire: string; lv?: number; traits?: string[] };
export interface ChessSeat { id: string; opp: ChessOpp; name: string; sub?: string }
export interface ChessResult { date: string; scene: ChessScene; opp: string; oppName: string; result: 'win' | 'loss' | 'draw'; how: Status | 'resign'; plies: number }
export type RulerTalker = (a: { sid: string; scene: ChessScene; opp: Extract<ChessOpp, { kind: 'ruler' }>; text: string; board: string; history: Talk['lines'] }) => Promise<{ reply: string; note?: string } | { error: string }>;

const sceneProviders = new Map<ChessScene, () => ChessSeat[]>();
let rulerTalker: RulerTalker | null = null;
/** 장면 모듈이 「지금 그 자리에 있는 상대」를 알려 준다(사교회·만찬 창이 열려 있을 때만 비어 있지 않게). */
export function registerChessScene(scene: ChessScene, seats: () => ChessSeat[]): void { sceneProviders.set(scene, seats); }
/** 다른 제국 통치자와 둘 때의 말: 그 장면의 기존 대화 규칙(관계·호감 변화 포함)을 쓰는 함수. */
export function registerChessRulerTalker(f: RulerTalker): void { rulerTalker = f; }
export const chessSeats = (scene: ChessScene): ChessSeat[] => { try { return (sceneProviders.get(scene)?.() ?? []).slice(0, 40); } catch { return []; } };

// ---- 결과 저장(결과만, 기보는 남기지 않음)
const MAX_RESULTS = 60;
let data: { saves: Record<string, { results: ChessResult[] }> } | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_chess.json');
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'chess', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'chess', error: e }); } }
export const chessResults = (sid: string): ChessResult[] => (all().saves[sid]?.results ?? []).slice();
/** 이 상대와의 전적(결과만). 인물 대화 프롬프트에 「지난번엔 제가 졌죠」 같은 말을 할 재료. */
export function chessRecordWith(sid: string, opp: string): { win: number; loss: number; draw: number } {
  const r = { win: 0, loss: 0, draw: 0 }; for (const x of chessResults(sid)) if (x.opp === opp) r[x.result]++; return r;
}

// ---- 진행 중 대국(한 번에 하나, 메모리에만)
interface Game {
  sid: string; scene: ChessScene; opp: ChessOpp; oppId: string; oppName: string; me: Color; // me = 상대(인물) 쪽 색
  pos: Pos | null; ev: ChessEvent[]; style: Style; talk: Talk; chat: Array<{ who: 'me' | 'them' | 'sys'; text: string }>;
  over: null | { result: ChessResult['result']; how: ChessResult['how'] }; thinking: boolean; asking: boolean; last: { from: number; to: number } | null; finalBoard: string[] | null;
}
let game: Game | null = null, win: BrowserWindow | null = null;
const oppIdOf = (o: ChessOpp): string => (o.kind === 'leader' ? o.key : `ruler:${o.idx}`);

const SCENE_EN: Record<ChessScene, string> = {
  social: 'You are sitting face to face with the empire\'s leader (the player) at a social gathering, playing chess across a small table.',
  banquet: 'You are sitting face to face with the empire\'s leader (the player) after a state dinner, playing chess across the table.',
  fbanquet: 'You are sitting face to face with the visiting leader (the player) at a banquet hosted by another empire, playing chess across the table.',
};
export const sceneName = (s: ChessScene): string => (s === 'social' ? L('사교회', 'Social gathering') : s === 'banquet' ? L('지도자 만찬', 'Leaders\' dinner') : L('타국 주최 만찬', 'Foreign banquet'));

function view() {
  const g = game; if (!g) return { active: false };
  const b = g.pos ? g.pos.b : g.finalBoard ?? [];
  const legal = g.pos && !g.over && g.pos.turn !== g.me && !g.thinking ? legalMoves(g.pos).map((m) => ({ from: m.from, to: m.to, promo: m.promo ?? '' })) : [];
  return {
    active: true, scene: g.scene, sceneName: sceneName(g.scene), oppName: g.oppName, player: g.me === 'w' ? 'b' : 'w', board: b, turn: g.pos?.turn ?? '', check: !!(g.pos && inCheck(g.pos)),
    legal, last: g.last, thinking: g.thinking, asking: g.asking, chat: g.chat.slice(-60), moves: g.ev.map((e) => e.san),
    over: g.over ? { result: g.over.result, text: resultText(g.over.result, g.over.how) } : null,
    record: chessRecordWith(g.sid, g.oppId), talkable: g.opp.kind === 'leader' || !!rulerTalker,
  };
}
function push(): void { if (win && !win.isDestroyed()) win.webContents.send('chessState', view()); }
function resultText(r: ChessResult['result'], how: ChessResult['how']): string {
  const HOW: Record<string, [string, string]> = { checkmate: ['외통수', 'checkmate'], resign: ['기권', 'resignation'], stalemate: ['스테일메이트', 'stalemate'], fifty: ['50수 규칙', 'fifty-move rule'], repetition: ['같은 수 세 번 반복', 'threefold repetition'], material: ['기물 부족', 'insufficient material'] };
  const h = HOW[how] ?? [how, how];
  return r === 'win' ? L(`승리 (${h[0]})`, `You won (${h[1]})`) : r === 'loss' ? L(`패배 (${h[0]})`, `You lost (${h[1]})`) : L(`무승부 (${h[0]})`, `Draw (${h[1]})`);
}
const sys = (text: string) => { game?.chat.push({ who: 'sys', text }); };

// ---- AI 작업자
let worker: Worker | null = null, wseq = 0;
const waiting = new Map<number, (m: Move | null) => void>();
function aiMove(pos: Pos, style: Style): Promise<Move | null> {
  try {
    if (!worker) {
      worker = new Worker(path.join(__dirname, '..', 'chess-worker.js'));
      worker.on('message', (r: { id: number; move?: Move | null; error?: string }) => { const f = waiting.get(r.id); waiting.delete(r.id); if (r.error) logDiagnostic('warn', 'chess.worker_error', { error: r.error }); f?.(r.move ?? null); });
      worker.on('error', (e) => { logDiagnostic('warn', 'chess.worker_failed', { error: String(e) }); for (const f of waiting.values()) f(null); waiting.clear(); worker = null; });
    }
    const id = ++wseq; return new Promise((res) => { waiting.set(id, res); worker!.postMessage({ id, pos, style }); });
  } catch (e) { logDiagnostic('warn', 'chess.worker_failed', { error: String(e) }); return Promise.resolve(chooseMove(pos, style)); } // 작업자를 못 띄우면 그냥 여기서
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function record(g: Game, before: Pos, m: Move, by: ChessEvent['by']): void {
  const s = san(before, m), after = play(before, m);
  g.ev.push({ ply: g.ev.length + 1, by, san: s, ...(m.capt ? { capt: typeOf(m.capt) } : {}), ...(m.promo ? { promo: m.promo } : {}), ...(inCheck(after) ? { check: true } : {}), ...(s.endsWith('#') ? { mate: true } : {}), ...(m.castle ? { castle: true } : {}) });
  g.pos = after; g.last = { from: m.from, to: m.to };
  if (s.endsWith('+')) sys(L('체크!', 'Check!'));
  const st = statusOf(after); if (st !== 'play') finish(g, st === 'checkmate' ? (after.turn === g.me ? 'win' : 'loss') : 'draw', st);
}
function finish(g: Game, result: ChessResult['result'], how: ChessResult['how']): void {
  if (g.over) return;
  g.over = { result, how };
  const r: ChessResult = { date: ctx.gameDate || '', scene: g.scene, opp: g.oppId, oppName: g.oppName, result, how, plies: g.ev.length };
  const s = (all().saves[g.sid] ??= { results: [] }); s.results.push(r); s.results = s.results.slice(-MAX_RESULTS); save();
  sys(resultText(result, how));
  // 결과만 기억에 남긴다(신뢰 변화 없음 — 재미로만).
  if (g.opp.kind === 'leader') { try { personaNote(g.sid, g.opp.key, L(`${sceneName(g.scene)}에서 지도자와 체스를 두었다 — ${result === 'win' ? '지도자가 이겼다' : result === 'loss' ? '내가 이겼다' : '비겼다'}`, `Played chess with the leader at a ${g.scene === 'social' ? 'social gathering' : 'dinner'} — ${result === 'win' ? 'the leader won' : result === 'loss' ? 'I won' : 'it was a draw'}`), 0); } catch { /* 기억 실패는 대국에 영향 없음 */ } }
  g.finalBoard = g.pos ? g.pos.b.slice() : null; g.pos = null; g.ev = []; // 기보는 여기서 사라진다(결과만 남김)
  logDiagnostic('info', 'chess.finished', { result, how, plies: r.plies, scene: g.scene });
}
async function themMove(g: Game): Promise<void> {
  if (!g.pos || g.over || g.pos.turn !== g.me) return;
  g.thinking = true; push();
  const t0 = Date.now(), before = g.pos, m = await aiMove(before, g.style);
  const wait = 500 + Math.floor(Math.random() * 700) - (Date.now() - t0); if (wait > 0) await sleep(wait); // 너무 빨리 두면 어색하다
  if (game !== g || g.pos !== before) return;
  g.thinking = false;
  if (!m) { finish(g, 'draw', 'stalemate'); push(); return; }
  record(g, before, m, 'them'); push();
}

function openWindow(): void {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1180, Math.round(area.width * 0.8)), height: Math.min(820, Math.round(area.height * 0.88)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 860, minHeight: 580, frame: false, show: false, backgroundColor: '#0b1014', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1);
  void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'chess.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (win === w) win = null; if (game && !game.over && game.pos) { game = null; } }); // 창을 닫으면 끝나지 않은 판은 기록 없이 사라진다
}

/** 대국 시작(장면 모듈 화면의 「체스 두기」에서). color: 플레이어 색. */
export function startChess(a: { scene: unknown; seat: unknown; color?: unknown }): { ok: boolean; error?: string } {
  const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 둘 수 있습니다.', 'Load a save first.') };
  const scene = String(a?.scene) as ChessScene; if (!CHESS_SCENES.includes(scene)) return { ok: false, error: L('체스는 사교회·만찬처럼 직접 만나는 자리에서만 둘 수 있습니다.', 'Chess can only be played when you meet in person (social gatherings, dinners).') };
  const seat = chessSeats(scene).find((s) => s.id === String(a?.seat)); if (!seat) return { ok: false, error: L('그 상대는 지금 이 자리에 없습니다.', 'That person is not here right now.') };
  if (game && !game.over && game.pos) return { ok: false, error: L('이미 두고 있는 판이 있습니다. 끝내거나 기권한 뒤에 새로 두세요.', 'A game is already in progress. Finish or resign it first.') };
  let style: Style;
  if (seat.opp.kind === 'leader') { const p = personOf(seat.opp.key); if (!p) return { ok: false, error: L('이 인물을 찾지 못했습니다.', 'This person was not found.') }; style = styleFor(p.lv, p.traits ?? [], p.role); }
  else style = styleFor(seat.opp.lv ?? 5, seat.opp.traits ?? [], 'ruler');
  const pc = a?.color === 'b' ? 'b' : a?.color === 'w' ? 'w' : Math.random() < 0.5 ? 'w' : 'b';
  game = { sid, scene, opp: seat.opp, oppId: oppIdOf(seat.opp), oppName: seat.name, me: pc === 'w' ? 'b' : 'w', pos: newGame(), ev: [], style, talk: { key: oppIdOf(seat.opp), lines: [], moved: 0, opened: ctx.gameDate || '' }, chat: [], over: null, thinking: false, asking: false, last: null, finalBoard: null };
  sys(L(`${seat.name}와(과) 체스를 시작합니다. 지도자는 ${pc === 'w' ? '백' : '흑'}입니다.`, `A game of chess with ${seat.name} begins. You play ${pc === 'w' ? 'White' : 'Black'}.`));
  openWindow(); const g = game; if (g.me === 'w') void themMove(g);
  logDiagnostic('info', 'chess.started', { scene, opp: seat.opp.kind });
  return { ok: true };
}
async function playerMove(a: { from: unknown; to: unknown; promo?: unknown }) {
  const g = game; if (!g || !g.pos || g.over) return { ok: false, error: L('두고 있는 판이 없습니다.', 'No game in progress.') };
  if (g.pos.turn === g.me || g.thinking) return { ok: false, error: L('상대 차례입니다.', 'It is their turn.') };
  const from = Number(a?.from), to = Number(a?.to), promo = String(a?.promo ?? '') as PieceType | '';
  const m = legalMoves(g.pos).find((x) => x.from === from && x.to === to && (x.promo ?? '') === (promo || (x.promo ? 'Q' : '')));
  if (!m) return { ok: false, error: L('둘 수 없는 수입니다.', 'That move is not allowed.') };
  record(g, g.pos, m, 'player'); push();
  if (!g.over) void themMove(g);
  return { ok: true };
}
/** 플레이어가 물을 때만 AI 한 번(판 상황을 사람 말로 넘김). 말 자체는 평소 대화와 똑같이 셈한다. */
async function ask(text: unknown) {
  const g = game, t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!g) return { ok: false, error: L('두고 있는 판이 없습니다.', 'No game in progress.') };
  if (!t) return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.') };
  if (g.asking) return { ok: false, error: L('이미 대답을 기다리는 중입니다.', 'Already waiting for a reply.') };
  const leaderName = ctx.playerName ? `the leader of ${ctx.playerName}` : 'the leader';
  const board = g.pos ? boardStory(g.pos, g.ev, g.me, g.oppName, leaderName) : `[The chess game] It just ended: ${g.over ? (g.over.result === 'win' ? `${leaderName} won` : g.over.result === 'loss' ? 'you won' : 'a draw') + ` by ${g.over.how === 'resign' ? 'resignation' : STATUS_EN[g.over.how as Status] ?? g.over.how}` : 'no result'}. The details of the moves are already fading; talk only about the result.`;
  g.asking = true; g.chat.push({ who: 'me', text: t }); push();
  try {
    if (g.opp.kind === 'leader') {
      const r = await sayInPerson(g.sid, g.opp.key, g.talk, t, { scene: SCENE_EN[g.scene], board });
      if (game !== g) return { ok: false };
      if (!r.ok) { g.chat.pop(); return { ok: false, error: String(r.error ?? '') }; }
      g.chat.push({ who: 'them', text: String(r.reply ?? '') });
      if (r.felt === 'threatened' || r.felt === 'insulted') sys(r.felt === 'threatened' ? L('상대가 위협으로 받아들였습니다.', 'They took that as a threat.') : L('상대가 모욕으로 받아들였습니다.', 'They took that as an insult.'));
      return { ok: true, delta: r.delta ?? 0 };
    }
    if (!rulerTalker) { g.chat.pop(); return { ok: false, error: L('다른 제국 통치자와의 대화는 아직 연결되지 않았습니다.', 'Talking with foreign rulers is not connected yet.') }; }
    const r = await rulerTalker({ sid: g.sid, scene: g.scene, opp: g.opp, text: t, board, history: g.talk.lines.slice(-16) });
    if (game !== g) return { ok: false };
    if ('error' in r) { g.chat.pop(); return { ok: false, error: r.error }; }
    g.talk.lines.push({ who: 'me', text: t }, { who: 'them', text: r.reply }); g.chat.push({ who: 'them', text: r.reply }); if (r.note) sys(r.note);
    return { ok: true };
  } catch (e) { g.chat.pop(); return { ok: false, error: String((e as Error)?.message || e) }; }
  finally { g.asking = false; push(); }
}

export function registerChess(): void {
  ipcMain.handle('chessSeats', (_e, scene: unknown) => (CHESS_SCENES.includes(String(scene) as ChessScene) ? chessSeats(String(scene) as ChessScene).map((s) => ({ id: s.id, name: s.name, sub: s.sub ?? '' })) : []));
  ipcMain.handle('chessStart', (_e, a: { scene: unknown; seat: unknown; color?: unknown }) => startChess(a));
  ipcMain.handle('chessState', () => view());
  ipcMain.handle('chessMove', (_e, a: { from: unknown; to: unknown; promo?: unknown }) => playerMove(a));
  ipcMain.handle('chessAsk', (_e, text: unknown) => ask(text));
  ipcMain.handle('chessResign', () => { const g = game; if (g && g.pos && !g.over) { finish(g, 'loss', 'resign'); push(); } return { ok: true }; });
  ipcMain.handle('chessClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  app.on('before-quit', () => { try { void worker?.terminate(); } catch { /* 끝 */ } });
}
/** 시험용(selftest): 판 진행만, 창·AI 없이. */
export const _chessTest = { sqName, colorOf, view, finish: (r: ChessResult['result'], how: ChessResult['how']) => { if (game) finish(game, r, how); } };
