// 규탄 성명(2026-10-20 알파 10): 전쟁이 시작되면 모드가 보내는 WARVOICE(제국별 관계)를 모아, 선언문을 발표한 뒤(또는 2시간 안에 발표하지 않으면) 각 제국·은하 공동체의 입장을 정하고 AI 가 문장을 쓴다.
// 규칙: src/condemn.ts. 결과: 알림 카드 + 연대기(세계 소식·제국별) + 저장(sllm_condemn.json, 신문·대사관·대화 재료) + (켜져 있으면) 호감 적용(모드 opinion_shift STEP 1·3).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { refreshFrontier, frontierFor } from './frontier-app'; // 국경·영유권(2026-10-26)
import { frontierBrief } from '../frontier';
import { logDiagnostic } from '../diagnostics';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { pick } from './settings-ui';
import { enqueue, sendBatch, link } from '../app/game-link';
import { opinionShiftEffects } from '../protocol';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { mail } from './mail-app';
import { debateOn } from './debate-app'; // 찬반 논평(2026-10-20 알파 10)
import { safeKey } from '../music';
import type { WarInfo } from '../warinfo';
import { warAggression } from '../warinfo';
import { parseWarInfo, describeWar } from '../warinfo';
import { creedEthics } from '../music';
import { gameState } from './gamestate-app';
import { BrowserWindow, screen } from 'electron';
import { type ForeignWar, type OurStatement, parseForeignWar, advisorStance, foreignWorthNotice, ourStatementSteps, ourPastStanceOn } from '../condemn';
import { type Voice, type Verdict, type Stance, sanitizeCondemn, voiceFromKv, voiceScore, stanceOf, galcomStance, pickSpeakers, countStances, reactionMessages, parseReactions, stanceStep, countsLine, STANCE_KO, STANCE_EN } from '../condemn';

const L = pick;
const file = () => path.join(app.getPath('userData'), 'sllm_condemn.json');
let store: ReturnType<typeof sanitizeCondemn> | null = null;
function all() { if (store) return store; try { store = sanitizeCondemn(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'condemn', error: e }); store = sanitizeCondemn({}); } return store; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'condemn', error: e }); } }
/** 이 세이브의 판정 기록(신문·대사관·대화가 재료로 쓴다). */
export function warVerdicts(sid = ctx.curSaveId): Verdict[] { return all().saves[safeKey(sid)] ?? []; }
/** 특정 제국이 우리 전쟁에 냈던 입장(가장 최근). 대화 기억용. */
export function stanceOfEmpire(idx: number, sid = ctx.curSaveId): { war: string; stance: Stance; text: string } | null {
  for (const v of warVerdicts(sid).slice().reverse()) { const r = v.reactions.find((x) => x.idx === idx); if (r) return { war: v.war, stance: r.stance, text: r.text }; }
  return null;
}

type WarSession = { sid: string; epoch: number };
const session = (): WarSession => ({ sid: ctx.curSaveId, epoch: link.epoch });
const current = (s: WarSession | null): boolean => !!s?.sid && s.sid === ctx.curSaveId && s.epoch === link.epoch;
/** Cancel transient war work on a save switch, rewind or log reset. */
export function resetCondemnSession(): void {
  for (const p of condemn.pending.values()) if (p.timer) clearTimeout(p.timer);
  condemn.pending.clear(); condemn.cur = ''; running = null;
  foreign.cur = null; foreign.session = null; foreign.seen.clear();
  if (foreign.win && !foreign.win.isDestroyed()) foreign.win.close();
}

/** 전쟁마다 모은 목소리(WARVOICE)와 전쟁 정보. 판정이 끝나면 지운다. */
export const condemn = { pending: new Map<string, { session: WarSession; info: WarInfo | null; voices: Array<Omit<Voice, 'ethics' | 'opinion'>>; collecting: string; timer: ReturnType<typeof setTimeout> | null; done: boolean }>(), cur: '' };
const DELAY_MS = 2 * 60 * 60 * 1000; // 선언문을 쓰지 않아도 이 시간이 지나면 반응이 나온다(실시간 2시간 ≈ 게임에서 며칠)

function slot(war: string) { let p = condemn.pending.get(war); if (p && !current(p.session)) { if (p.timer) clearTimeout(p.timer); condemn.pending.delete(war); p = undefined; } if (!p) { p = { session: session(), info: null, voices: [], collecting: '', timer: null, done: false }; condemn.pending.set(war, p); if (condemn.pending.size > 10) condemn.pending.delete(condemn.pending.keys().next().value as string); } return p; }
export function condemnSetInfo(w: WarInfo): void { const p = slot(w.war); p.info = w; condemn.cur = w.war; if (!p.timer && !p.done) p.timer = setTimeout(() => { if (current(p.session) && condemn.pending.get(w.war) === p) void runVerdict(w.war, ''); }, DELAY_MS); }
/** 선언문을 발표했을 때 부른다(선언문 본문을 AI 에게 보여 줌). */
export function condemnAfterDeclaration(war: string, declText: string): void { const p = condemn.pending.get(war); if (!p || p.done || !current(p.session)) return; if (p.timer) { clearTimeout(p.timer); p.timer = null; } p.timer = setTimeout(() => { if (current(p.session) && condemn.pending.get(war) === p) void runVerdict(war, declText); }, 4000); }

function fillVoice(v: Omit<Voice, 'ethics' | 'opinion'>): Voice {
  const c = mail.countries.get(v.idx); let ethics: string[] = [];
  try { ethics = ctx.adoptedEthics(v.idx).names; } catch { /* 모름 */ }
  if (!ethics.length) { try { ethics = ctx.flagProv.ethicsFor(v.idx) ?? []; } catch { /* 모름 */ } }
  const past = ourPastStanceOn(all().ours[safeKey(ctx.curSaveId)], v.idx);
  return { ...v, opinion: c?.op ?? 0, ethics, flags: { ...v.flags, ...(past?.stance === 'condemn' ? { weCondemned: true } : past?.stance === 'support' ? { weSupported: true } : {}) } };
}
let running: WarSession | null = null;
async function runVerdict(war: string, declText: string): Promise<void> {
  const p = condemn.pending.get(war); if (!p || p.done || !current(p.session) || current(running) || !p.info) return; const owner = p.session; running = owner; p.done = true; if (p.timer) { clearTimeout(p.timer); p.timer = null; }
  try {
    const w = p.info, us = w.side === 'att';
    const voices = p.voices.map(fillVoice);
    if (!voices.length) { logDiagnostic('info', 'condemn.no_voices', { war }); return; }
    const gc = galcomStance(voices, w, us), speakers = pickSpeakers(voices, w, us, 4), counts = countStances(voices, w, us);
    let texts: { galcom: string; items: Array<{ name: string; text: string }> } | null = null;
    if (speakers.length || gc) {
      await refreshFrontier(speakers.map((s) => s.v.idx)).catch(() => {}); // 국경·영유권 사이(2026-10-26)
      try { const raw = await ctx.ai.chat(reactionMessages(ctx.playerName || 'the player empire', w, speakers.map((s) => { const past = ourPastStanceOn(all().ours[safeKey(ctx.curSaveId)], s.v.idx); return { name: s.v.name, stance: s.stance, ethics: s.v.ethics, ...(past ? { memory: `In ${past.date} the player's government issued a ${past.stance} statement about this empire's war "${past.war}"${past.text ? ': "' + past.text.slice(0, 140) + '"' : ''}` } : {}), ...(frontierBrief(frontierFor(s.v.idx)) ? { geo: frontierBrief(frontierFor(s.v.idx)) } : {}) }; }), gc && gc.stance !== 'silent' ? gc.stance : null, declText), { purpose: 'war-reactions', json: true, maxTokens: 1400 }); texts = parseReactions(raw); }
      catch (e) { logDiagnostic('warn', 'condemn.ai_failed', { war, error: e }); }
    }
    if (!current(owner) || condemn.pending.get(war) !== p) return;
    const findText = (name: string) => texts?.items.find((x) => x.name === name || name.includes(x.name) || x.name.includes(name))?.text ?? '';
    const verdict: Verdict = { war: w.war, date: w.date || ctx.gameDate || '', side: w.side, aggression: warAggression(w), galcom: gc ? { stance: gc.stance, score: gc.score, text: texts?.galcom ?? '' } : null,
      reactions: speakers.map((s) => ({ idx: s.v.idx, name: s.v.name, stance: s.stance, score: s.score, text: findText(s.v.name) })), counts };
    const key = safeKey(owner.sid), list = (all().saves[key] ??= []); list.push(verdict); if (list.length > 30) list.splice(0, list.length - 30); save();
    // 알림·연대기
    const line = L(countsLine(counts, true), countsLine(counts, false)); // 언어 팩 호환: 한/영 짝으로 고른다
    const head = gc && gc.stance !== 'silent' ? L(`은하 공동체: ${stanceLabel(gc.stance)}`, `Galactic Community: ${stanceLabel(gc.stance)}`) : L('은하가 반응했습니다', 'The galaxy reacts');
    ctx.notify({ kind: 'event', title: head + ' — ' + w.war, body: line + (verdict.reactions[0]?.text ? ` · ${verdict.reactions[0].name}: "${verdict.reactions[0].text.slice(0, 90)}"` : '') });
    chronNoteWorld(`${verdict.date} ${w.war}: ${line}` + (gc && gc.stance !== 'silent' && verdict.galcom?.text ? ` — ${L('은하 공동체', 'Galactic Community')}: ${verdict.galcom.text}` : '') + (verdict.reactions[0]?.text ? ` — ${verdict.reactions[0].name}: ${verdict.reactions[0].text}` : ''), true); // 신문(연간 호)이 이 줄을 기사 재료로 쓴다
    if (gc && gc.stance === 'condemn' && w.side === 'att') void debateOn('galcom_condemn', `${w.war}: ${verdict.galcom?.text || line}`, verdict.date); // 공동체 규탄에 대한 국내 찬반
    for (const r of verdict.reactions) chronNote(r.idx, L(`우리의 전쟁(${w.war})에 ${stanceLabel(r.stance)} 성명`, `${stanceLabel(r.stance)} over our war (${w.war})`) + (r.text ? `: ${r.text}` : ''), true);
    logDiagnostic('info', 'condemn.verdict', { war, counts, galcom: gc?.stance, speakers: verdict.reactions.map((r) => `${r.name}:${r.stance}:${r.score}`) });
    // 호감 적용(켜져 있을 때): 규탄 → cold small, 지지 → warm small. 성명 낸 제국만.
    if (all().applyOpinion) for (const r of verdict.reactions) { const step = stanceStep(r.stance); if (!step || !ctx.actionsAllowed(r.idx)) continue; void enqueue(async () => { if (!current(owner)) return; const o = await sendBatch(1, (reqs) => opinionShiftEffects(reqs, r.idx, [step])); logDiagnostic('info', 'condemn.opinion', { idx: r.idx, stance: r.stance, outcome: o }); }); }
  } finally { if (running === owner) running = null; if (condemn.pending.get(war) === p) condemn.pending.delete(war); }
}

export function registerCondemn(router: LogRouter): void {
  router.on(SLOT.CONDEMN, 'condemn', (m: SllmMessage) => {
    if (m.kind === 'WARVOICE') { const war = condemn.cur; if (!war) return; const p = slot(war); const w = p.info; const v = voiceFromKv(m.kv, !w || w.side === 'att'); if (v) { const at = p.voices.findIndex((x) => x.idx === v.idx); if (at >= 0) p.voices[at] = v; else p.voices.push(v); } }
    else if (m.kind === 'FOREIGNWAR') { const f = parseForeignWar(m.kv, parseWarInfo); if (f) onForeignWar(f); }
    else if (m.kind === 'WARVOICE_END') { const war = String(m.kv.war ?? ''); if (war && condemn.pending.has(war)) logDiagnostic('info', 'condemn.voices', { war, n: condemn.pending.get(war)!.voices.length }); }
  });
  ipcMain.handle('condemnState', async () => ({ applyOpinion: all().applyOpinion, recent: warVerdicts().slice(-5) }));
  /** 집무실 「은하 여론」: 이 세이브의 판정 기록(최근 것 먼저)과 입장 이름. */
  ipcMain.handle('condemnList', async () => ({ sid: ctx.curSaveId || '', applyOpinion: all().applyOpinion, labels: { condemn: stanceLabel('condemn'), concern: stanceLabel('concern'), silent: stanceLabel('silent'), support: stanceLabel('support') }, verdicts: warVerdicts().slice().reverse(), ours: (all().ours[safeKey(ctx.curSaveId)] ?? []).slice().reverse(), foreignNotify: all().foreignNotify }));
  ipcMain.handle('condemnApplyOpinion', async (_e, on: unknown) => { all().applyOpinion = !!on; save(); return all().applyOpinion; });
  ipcMain.handle('foreignState', async () => {
    const f = current(foreign.session) ? foreign.cur : null; if (!f) return null; const adv = advisorFor(f);
    return { war: f.war, date: f.date, attacker: f.attacker, defender: f.defender, cause: L(describeWar(f, 'ko'), describeWar(f, 'en')), advisor: adv.stance, advisorLabel: stanceLabel(adv.stance), labels: { condemn: stanceLabel('condemn'), concern: stanceLabel('concern'), silent: stanceLabel('silent'), support: stanceLabel('support') }, applyOpinion: all().applyOpinion, empire: ctx.playerName || '' };
  });
  ipcMain.handle('foreignIssue', async (_e, stIn: unknown, textIn: unknown) => issueOurStatement(stIn, textIn));
  ipcMain.handle('foreignClose', async () => { if (foreign.win && !foreign.win.isDestroyed()) foreign.win.close(); return true; });
  ipcMain.handle('foreignNotify', async (_e, on: unknown) => { all().foreignNotify = !!on; save(); return all().foreignNotify; });
  ipcMain.handle('condemnNow', async (_e, warIn: unknown) => { const war = typeof warIn === 'string' && warIn ? warIn : condemn.cur; if (!war || !condemn.pending.has(war)) return { ok: false, error: L('기다리는 전쟁이 없습니다.', 'No war is waiting for a verdict.') }; await runVerdict(war, ''); return { ok: true }; });
}
/** 화면 문구(선언문 창 등). */
export const stanceLabel = (s: Stance): string => L(STANCE_KO[s], STANCE_EN[s]);

// ── 남의 전쟁에 우리가 성명(방향 2, 2026-10-20) ─────────────────────────────────────────────────
export const foreign = { cur: null as ForeignWar | null, session: null as WarSession | null, seen: new Set<string>(), win: null as BrowserWindow | null };
function advisorFor(f: ForeignWar) {
  let ethics: string[] = []; try { ethics = ctx.adoptedEthics(ctx.playerIdx).names; } catch { /* 모름 */ }
  if (!ethics.length) ethics = creedEthics(gameState.last?.empireEth);
  return advisorStance(f, ethics, mail.countries.get(f.ai)?.op ?? 0);
}
function onForeignWar(f: ForeignWar): void {
  const owner = session(); if (!current(owner)) return;
  const key = owner.sid + '|' + owner.epoch + '|' + f.war + '|' + f.date; if (foreign.seen.has(key)) return; foreign.seen.add(key); if (foreign.seen.size > 200) foreign.seen.delete(foreign.seen.values().next().value as string);
  logDiagnostic('info', 'condemn.foreign_war', { war: f.war, att: f.attacker, def: f.defender, goal: f.attGoal, notice: foreignWorthNotice(f) });
  chronNoteWorld(`${f.date} ${L('전쟁 발발', 'War breaks out')}: ${f.attacker} → ${f.defender} (${f.war})`, true);
  if (!all().foreignNotify || !foreignWorthNotice(f)) return; // 작은 전쟁은 조용히 연대기에만
  foreign.cur = f; foreign.session = owner;
  ctx.notify({ kind: 'statement', title: L(`${f.attacker}이(가) ${f.defender}을(를) 침공했습니다 — 입장을 밝히시겠습니까?`, `${f.attacker} has attacked ${f.defender} — will you issue a statement?`), body: L(describeWar(f, 'ko'), describeWar(f, 'en')).slice(0, 160), action: L('성명 내기', 'Issue a statement') });
}
export function openForeignStatement(): void {
  if (!foreign.cur || !current(foreign.session)) return;
  if (foreign.win && !foreign.win.isDestroyed()) { foreign.win.show(); foreign.win.focus(); return; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, w = Math.min(820, Math.round(area.width * 0.7)), h = Math.min(640, Math.round(area.height * 0.8));
  foreign.win = new BrowserWindow({ width: w, height: h, x: Math.round(area.x + (area.width - w) / 2), y: Math.round(area.y + (area.height - h) / 2), resizable: false, maximizable: false, fullscreenable: false, frame: false, show: false, backgroundColor: '#06141b', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  foreign.win.setAlwaysOnTop(true, 'screen-saver', 1);
  void foreign.win.loadFile(path.join(__dirname, '..', '..', 'ui', 'statement.html'));
  foreign.win.once('ready-to-show', () => foreign.win?.show());
  foreign.win.on('closed', () => { foreign.win = null; });
}
async function issueOurStatement(stIn: unknown, textIn: unknown): Promise<{ ok: boolean; error?: string }> {
  const f = current(foreign.session) ? foreign.cur : null; if (!f) return { ok: false, error: L('기다리는 전쟁이 없습니다.', 'No war is waiting.') };
  const owner = foreign.session!;
  const stance: Stance = stIn === 'condemn' || stIn === 'concern' || stIn === 'support' ? stIn : 'silent';
  if (stance === 'silent') { foreign.cur = null; return { ok: true }; } // 침묵: 기록·효과 없음
  const text = typeof textIn === 'string' ? textIn.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
  const rec: OurStatement = { war: f.war, date: f.date || ctx.gameDate || '', attacker: f.attacker, defender: f.defender, ai: f.ai, di: f.di, goal: f.attGoal, stance, text };
  const key = safeKey(owner.sid), list = (all().ours[key] ??= []); list.push(rec); if (list.length > 40) list.splice(0, list.length - 40); save();
  const me = ctx.playerName || L('우리 정부', 'our government');
  chronNoteWorld(`${rec.date} ${me} — ${f.war}: ${stanceLabel(stance)}${text ? ` — "${text}"` : ''}`, true); // 신문 재료
  void debateOn(stance === 'condemn' ? 'our_condemn' : stance === 'support' ? 'our_support' : 'our_concern', `${f.war}: ${f.attacker} → ${f.defender}${text ? ' — ' + text : ''}`, rec.date); // 국내 찬반
  if (f.ai) chronNote(f.ai, L(`${me}이(가) 우리의 전쟁(${f.war})을 두고 ${stanceLabel(stance)} 성명을 냈다${text ? `: "${text.slice(0, 160)}"` : ''}`, `${me} issued a statement (${stanceLabel(stance)}) about our war (${f.war})${text ? `: "${text.slice(0, 160)}"` : ''}`), true);
  if (f.di) chronNote(f.di, L(`${me}이(가) ${f.attacker}의 침공(${f.war})을 두고 ${stanceLabel(stance)} 성명을 냈다`, `${me} issued a statement (${stanceLabel(stance)}) about ${f.attacker}'s attack on us (${f.war})`), true);
  if (all().applyOpinion) {
    const [sa, sd] = ourStatementSteps(stance);
    for (const [idx, step] of [[f.ai, sa], [f.di, sd]] as Array<[number, number]>) {
      if (!idx || !step || !ctx.actionsAllowed(idx)) continue;
      void enqueue(async () => { if (!current(owner)) return; const o = await sendBatch(1, (reqs) => opinionShiftEffects(reqs, idx, [step])); logDiagnostic('info', 'condemn.our_opinion', { idx, stance, outcome: o }); });
    }
  }
  logDiagnostic('info', 'condemn.our_statement', { war: f.war, stance, chars: text.length });
  foreign.cur = null;
  return { ok: true };
}
