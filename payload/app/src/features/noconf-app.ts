// 불신임(2026-11-03 사용자 결정 ⑥). 규칙·문장: src/noconf.ts. 화면: ui/office-audit.js(집무실 「의회」). 설정 「(하드코어) 불신임」(noconfOn, 기본 꺼짐)을 켰을 때만.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { settings } from '../app/settings';
import type { StateSnapshot } from '../gamestate';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { redactKey } from '../aiclient';
import { civicCommand } from '../civic';
import { terminalRequest } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { moodView, moodNudge } from './mood-app';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { civicRegimeNow } from './civic-app';
import { auditRecords } from './audit-app';
import { govSeatsNow, oppositionMover } from './parliament-app';
import { seatBonus } from '../parliament';
import { type NoconfSave, type Vote, NOCONF, auditHeat, thresholdOf, tickLow, motionExpired, govShare, motionCharge, speechMessages, parseSpeech, voteChron, noconfFact } from '../noconf';

interface Store { saves: Record<string, NoconfSave> }
const file = () => path.join(app.getPath('userData'), 'sllm_noconf.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), m = obj(x.motion);
    saves[safeKey(sid)] = {
      low: Math.max(0, Math.round(Number(x.low) || 0)), votes: Array.isArray(x.votes) ? (x.votes as Vote[]).filter((q) => q && typeof q === 'object' && typeof q.date === 'string').slice(-10) : [],
      ...(typeof m.date === 'string' ? { motion: { date: m.date, approval: Number(m.approval) || 0, mover: String(m.mover ?? ''), faction: String(m.faction ?? ''), charge: String(m.charge ?? '') } } : {}),
      ...(typeof x.lastVote === 'string' ? { lastVote: x.lastVote } : {}), ...(typeof x.lastSeen === 'string' ? { lastSeen: x.lastSeen } : {}),
    };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'noconf', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'noconf', error: e }); } }, 1500); }
const entry = (sid: string): NoconfSave => (all().saves[safeKey(sid)] ??= { low: 0, votes: [] });
const on = () => settings.noconfOn === true;
const approvalNow = (): number | null => { const v = moodView(); const a = v.parts?.approval ?? v.score; return a === null || a === undefined ? null : Math.round(a); };
const empire = () => ctx.playerName || L('우리 제국', 'our empire');

async function applyMod(sid: string, kind: 'survived' | 'lameduck' | 'dissolved'): Promise<string> {
  const m = NOCONF[kind]; moodNudge(m.mood, L('불신임 표결', 'No-confidence vote'));
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return 'offline';
  try { const req = ++link.reqCounter, r = await terminalRequest(civicCommand(req, sid, 'noconf_' + kind, [{ name: m.mod, days: m.days }]), 'CIVIC', req); if (r.kv.status === 'missing') logDiagnostic('warn', 'noconf.modifier_missing', { mod: m.mod }); return r.kv.status || 'unknown'; }
  catch (e) { logDiagnostic('warn', 'noconf.effect_failed', { error: (e as Error).message }); return 'failed'; }
}
async function settle(sid: string, v: Vote): Promise<void> {
  const e = entry(sid); delete e.motion; e.low = 0; e.lastVote = v.date;
  v.status = await applyMod(sid, v.kind === 'dissolved' ? 'dissolved' : v.survived ? 'survived' : 'lameduck');
  e.votes = [...e.votes, v].slice(-10); save();
  chronNoteWorld(voteChron(v, empire()), true); push();
}
async function holdVote(sid: string, speech: string, score: number, reaction: string): Promise<Vote> {
  const e = entry(sid), m = e.motion!, heat = auditHeat(auditRecords(sid), ctx.gameDate || m.date), a = approvalNow() ?? m.approval;
  const seats = govSeatsNow(sid), gov = govShare(a, heat.perjury, score + (seats === null ? 0 : seatBonus(seats))); // 정부 의석(여당·연정·법안 거래)이 과반에서 먼 만큼 ±
  const v: Vote = { date: ctx.gameDate || m.date, kind: 'vote', ...(speech ? { speech } : {}), score, ...(reaction ? { reaction } : {}), gov, survived: gov >= 50 };
  await settle(sid, v); return v;
}

function onSnapshot(snap: StateSnapshot): void {
  if (!on() || !snap.sid || snap.sid !== ctx.curSaveId) return;
  setTimeout(() => { // 민심(mood-app)이 같은 상황으로 점수를 매긴 뒤에
    try {
      if (snap.sid !== ctx.curSaveId || civicRegimeNow() !== 'free') return;
      const e = entry(snap.sid), date = snap.date, heat = auditHeat(auditRecords(snap.sid), date), a = approvalNow();
      if (e.motion && motionExpired(e.motion, date)) { void holdVote(snap.sid, '', 0, L('(정부가 변론하지 않았다.)', '(The government made no defence.)')); return; }
      if (!tickLow(e, a, date, heat.hot)) { save(); return; }
      const facs = (gameState.last && gameState.last.sid === snap.sid ? gameState.last.factions : []).slice().sort((x, y) => x.approval - y.approval);
      const f = facs[0], op = oppositionMover(snap.sid); // 야당 대표가 있으면 그 사람이 발의
      e.motion = { date, approval: a ?? 0, faction: op?.faction ?? f?.name ?? '', mover: op ? L(`야당 대표 ${op.name}`, `Opposition leader ${op.name}`) : f ? L(`${f.name} 원내대표`, `Leader of ${f.name}`) : L('야당 원내대표', 'Opposition leader'), charge: motionCharge(a ?? 0, heat.hot) };
      save(); push();
      ctx.notify({ kind: 'office', title: L('정부 불신임안 발의', 'Motion of no confidence'), body: L(`지지율이 석 달째 ${thresholdOf(heat.hot)}%를 밑돌아 의회가 불신임안을 냈습니다. 석 달 안에 집무실 「의회」에서 변론하세요.`, `Approval has stayed below ${thresholdOf(heat.hot)}% for three months, and parliament has moved a motion of no confidence. Defend yourself in the office's "Parliament" within three months.`) });
      chronNoteWorld(L(`${date} 의회에 정부 불신임안이 발의되었다.`, `${date} A motion of no confidence in the government was tabled in parliament.`), true);
    } catch (err) { logDiagnostic('warn', 'noconf.tick_failed', { error: String(err) }); }
  }, 0);
}

export function noconfView() {
  const sid = ctx.curSaveId || '', date = ctx.gameDate || '';
  if (!sid) return { on: on(), sid: '' };
  const e = entry(sid), heat = auditHeat(auditRecords(sid), date);
  return { on: on(), sid, regime: civicRegimeNow(), threshold: thresholdOf(heat.hot), hot: heat.hot, low: e.low, lowNeed: NOCONF.lowMonths, approval: approvalNow(), motion: e.motion ?? null, votes: e.votes.slice(-5).reverse(), running: ctx.gameRunning };
}
function push(): void { try { const v = noconfView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('noconfUpdate', v); } catch { /* 창 없음 */ } }

async function defend(textIn: unknown): Promise<string> {
  const sid = ctx.curSaveId || '', speech = String(textIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000);
  if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const e = entry(sid); if (!e.motion) throw new Error(L('지금 불신임안이 없습니다.', 'There is no motion of no confidence.'));
  if (!speech) throw new Error(L('변론 연설을 적어 주세요.', 'Write your defence speech.'));
  let j: ReturnType<typeof parseSpeech> = null;
  const facts = (gameState.last && gameState.last.sid === sid ? gameState.last.wars.map((w) => `At war: ${w.name}`) : []).slice(0, 3);
  try { j = parseSpeech(await ctx.ai.chat(speechMessages({ empire: empire(), date: ctx.gameDate || '', approval: approvalNow() ?? e.motion.approval, motion: e.motion, facts }, speech), { purpose: 'noconf-speech', json: true, maxTokens: NOCONF.speechTokens })); }
  catch (err) { throw new Error(L('AI가 연설을 판정하지 못했습니다: ', 'The AI could not judge the speech: ') + redactKey((err as Error).message)); }
  if (!j) throw new Error(L('판정을 이해하지 못했습니다. 다시 시도해 주세요.', 'Could not understand the judgement. Try again.'));
  const v = await holdVote(sid, speech, j.score, j.reaction);
  return (j.headline ? `「${j.headline}」 ` : '') + (v.survived ? L(`불신임안이 부결되었습니다(정부 지지 ${v.gov}%). 1년 동안 안정도 +2.`, `The motion failed (${v.gov}% for the government). +2 stability for a year.`)
    : L(`불신임안이 가결되었습니다(정부 지지 ${v.gov}%). 정부는 레임덕에 빠집니다: 3년 동안 안정도 −5, 영향력 생산 −20%.`, `The motion passed (${v.gov}% for the government). The government is a lame duck: −5 stability and −20% influence for 3 years.`));
}
async function dissolve(): Promise<string> {
  const sid = ctx.curSaveId || ''; const e = sid ? entry(sid) : null; if (!e || !e.motion) throw new Error(L('지금 불신임안이 없습니다.', 'There is no motion of no confidence.'));
  await settle(sid, { date: ctx.gameDate || e.motion.date, kind: 'dissolved' });
  return L('의회를 해산했습니다. 2년 동안 모든 행성 안정도 −10, 민심이 크게 떨어집니다.', 'Parliament is dissolved. All planets −10 stability for 2 years, and approval drops sharply.');
}

export function registerNoconf(): void {
  onGameSnapshot(onSnapshot);
  registerSecFacts({ id: 'No-confidence', kw: ['불신임', '의회', '레임덕', 'no confidence', 'parliament', 'lame duck'], facts: (sid) => (sid === ctx.curSaveId && on() ? noconfFact(entry(sid)) : []) });
  ipcMain.handle('noconfState', async () => noconfView());
  ipcMain.handle('noconfDefend', async (_e, text: unknown) => { try { return { ok: true, text: await defend(text), state: noconfView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: noconfView() }; } });
  ipcMain.handle('noconfDissolve', async () => { try { return { ok: true, text: await dissolve(), state: noconfView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: noconfView() }; } });
}
