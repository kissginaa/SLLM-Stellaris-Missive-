// 사로잡은 적 제독(앱 쪽, 2026-11-04). 규칙·프롬프트: src/captive.ts. 게임: tester-mod/common/scripted_effects/sllm_captive.txt · events/sllm_captive_events.txt.
// 화면: ui/fleet-captive.js(함대 사령부 창 왼쪽 「사로잡은 적 제독」 + 심문실). 로그 자리 CAPTIVE: CAPFROM·CAPTURE(사로잡음) · CAPSET(처리 응답).
// 게임 명령은 처리할 때만(사로잡기는 게임이 스스로 알린다).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { infamyExec } from '../app/infamy-hooks'; // 악명·전쟁범죄(2026-11-04): 처형 기록에 이름 붙이기
import { CAP, type CapAct, type Captive, clampCoop, intelOf, canRecruit, checkText, actCommand, interrogationMessages, openingMessages, parseReply, actResultText, chronText } from '../captive';

interface Save { captives: Record<string, Captive>; log: Array<{ date: string; text: string }> }
interface Store { saves: Record<string, Save> }
const file = () => path.join(app.getPath('userData'), 'sllm_captive.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), cs: Save['captives'] = {};
    for (const [k, a] of Object.entries(obj(x.captives)).slice(0, CAP.slots)) {
      const o = obj(a), slot = Number(o.slot); if (!(slot >= 1 && slot <= CAP.slots) || typeof o.name !== 'string') continue;
      cs[k] = { slot, name: String(o.name).slice(0, 80), fidx: Number(o.fidx) || -1, fname: String(o.fname ?? '').slice(0, 80), date: String(o.date ?? ''), coop: clampCoop(Number(o.coop) || 0), turns: Number(o.turns) || 0, questioned: !!o.questioned,
        talk: Array.isArray(o.talk) ? (o.talk as Captive['talk']).filter((l) => l && typeof l.text === 'string' && ['ruler', 'captive', 'note'].includes(l.who)).slice(-40) : [] };
    }
    saves[safeKey(sid)] = { captives: cs, log: Array.isArray(x.log) ? (x.log as Save['log']).filter((q) => q && typeof q.text === 'string').slice(-CAP.keep) : [] };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'captive', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'captive', error: e }); } }, 1500); }
const entry = (sid: string): Save => (all().saves[safeKey(sid)] ??= { captives: {}, log: [] });
const note = (s: Save, text: string) => { s.log = [...s.log, { date: ctx.gameDate || '', text }].slice(-CAP.keep); };
const usName = () => ctx.playerName || L('우리 제국', 'Our empire');
const ready = () => !!ctx.curSaveId && ctx.gameRunning && link.sessionReady;
let busy = false;

export function captiveView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const s = entry(sid);
  return {
    sid, running: ctx.gameRunning, busy, recruitAt: CAP.recruitAt, maxTurns: CAP.maxTurns,
    captives: Object.values(s.captives).sort((a, b) => a.slot - b.slot).map((c) => ({ slot: c.slot, name: c.name, fname: c.fname, date: c.date, coop: c.coop, turns: c.turns, questioned: !!c.questioned, canRecruit: canRecruit(c), intel: intelOf(c.coop), talk: c.talk.slice(-30) })),
    log: s.log.slice(-10).reverse(),
  };
}
function push(): void { try { const v = captiveView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('captiveUpdate', v); } catch { /* 창 없음 */ } }

const pend = new Map<string, { fidx: number; fname: string }>(); // slot → CAPFROM(CAPTURE 보다 먼저 온다)
async function opening(sid: string, slot: number): Promise<void> {
  const c = entry(sid).captives[String(slot)]; if (!c || c.talk.length) return;
  try { const r = parseReply(await ctx.ai.chat(openingMessages(c, usName(), ''), { purpose: 'captive.opening', maxTokens: 400 })); if (r) { c.talk.push({ who: 'captive', text: r.reply }); save(); push(); } } catch { /* 첫마디 없음 */ }
}

export function registerCaptive(router: LogRouter): void {
  router.on(SLOT.CAPTIVE, 'captive', (m: SllmMessage) => {
    const k = m.kind; if (k !== 'CAPFROM' && k !== 'CAPTURE' && k !== 'CAPSET') return;
    if (k === 'CAPSET') { terminalReplies.get('CAPSET:' + String(m.kv.req ?? ''))?.(m); return; }
    const sid = String(m.kv.sid ?? '').replace(/[^\d]/g, ''), slot = Math.round(Number(m.kv.slot));
    if (!sid || sid !== ctx.curSaveId || !(slot >= 1 && slot <= CAP.slots)) return;
    if (k === 'CAPFROM') { pend.set(String(slot), { fidx: Math.round(Number(m.kv.fidx)) || -1, fname: String(m.kv.fname ?? '').slice(0, 80) }); return; }
    const s = entry(sid), f = pend.get(String(slot)) ?? { fidx: -1, fname: '' }; pend.delete(String(slot));
    const c: Captive = { slot, name: String(m.kv.name ?? '').slice(0, 80) || L('이름 모를 제독', 'an unnamed admiral'), fidx: f.fidx, fname: f.fname, date: String(m.kv.date ?? ctx.gameDate ?? ''), coop: CAP.coopStart, turns: 0, talk: [] };
    s.captives[String(slot)] = c; note(s, L(`${c.fname}의 ${c.name} 제독을 사로잡았다.`, `Captured Admiral ${c.name} of ${c.fname}.`)); save();
    if (c.fidx > 0) chronNote(c.fidx, L(`우리 제독 ${c.name}이(가) 전투에서 ${usName()}에 사로잡혔다`, `Our admiral ${c.name} was captured in battle by ${usName()}`));
    ctx.notify({ kind: 'fleet', title: L('적 제독을 사로잡았습니다', 'Enemy admiral captured'), body: L(`${c.fname}의 ${c.name} 제독이 우리 기함 심문실에 있습니다. 함대 사령부에서 심문하거나 처리할 수 있습니다.`, `Admiral ${c.name} of ${c.fname} is held in our flagship's interrogation room. Question or deal with them in Fleet Command.`), action: L('함대 사령부', 'Fleet Command') });
    push(); void opening(sid, slot);
  });
  registerSecFacts({ id: 'Captured enemy admirals', kw: ['포로', '제독', '사로잡', 'captive', 'prisoner', 'admiral'], facts: (sid) => (sid === ctx.curSaveId ? Object.values(entry(sid).captives).map((c) => `We hold captured enemy admiral ${c.name} of ${c.fname} (willingness to cooperate ${c.coop}/100).`) : []) });
  ipcMain.handle('captiveState', async () => captiveView());
  ipcMain.handle('captiveSay', async (_e, slotIn: unknown, textIn: unknown) => {
    const sid = ctx.curSaveId || '', c = entry(sid).captives[String(Number(slotIn))], text = String(textIn ?? '').replace(/\s+/g, ' ').trim();
    if (!c) return { ok: false, error: L('그 포로가 없습니다.', 'No such captive.'), state: captiveView() };
    const bad = checkText(text); if (bad) return { ok: false, error: bad, state: captiveView() };
    if (c.turns >= CAP.maxTurns) return { ok: false, error: L('더 물어도 입을 열지 않습니다. 처리 방법을 고르세요.', 'They will say no more. Choose what to do with them.'), state: captiveView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: captiveView() };
    busy = true; push();
    try {
      let r: { reply: string; coop: number } | null = null;
      for (let i = 0; i < 2 && !r; i++) { try { r = parseReply(await ctx.ai.chat(interrogationMessages(c, usName(), '', text), { purpose: 'captive.talk', maxTokens: 600 })); } catch { /* 다시 */ } }
      if (!r) return { ok: false, error: L('대답을 받지 못했습니다. 다시 시도해 주세요.', 'No answer came. Please try again.'), state: captiveView() };
      c.talk.push({ who: 'ruler', text }, { who: 'captive', text: r.reply }); c.turns++; c.coop = clampCoop(c.coop + r.coop * CAP.coopStep); c.talk = c.talk.slice(-40); save();
      return { ok: true, state: captiveView() };
    } finally { busy = false; push(); }
  });
  ipcMain.handle('captiveAct', async (_e, slotIn: unknown, actIn: unknown) => {
    const sid = ctx.curSaveId || '', slot = Number(slotIn), act = String(actIn) as CapAct, s = entry(sid), c = s.captives[String(slot)];
    if (!c || !['ransom', 'interrogate', 'recruit', 'execute', 'release', 'secret'].includes(act)) return { ok: false, error: L('처리할 수 없습니다.', 'Cannot do that.'), state: captiveView() };
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: captiveView() };
    if (act === 'recruit' && !canRecruit(c)) return { ok: false, error: L(`아직 넘어올 마음이 없습니다(협조도 ${CAP.recruitAt} 이상 필요).`, `Not willing to defect yet (needs willingness ${CAP.recruitAt}+).`), state: captiveView() };
    if (act === 'interrogate' && c.questioned) return { ok: false, error: L('이미 심문해 정보를 얻었습니다.', 'Already interrogated for intelligence.'), state: captiveView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: captiveView() };
    busy = true; push();
    try {
      const intel = intelOf(c.coop), req = ++link.reqCounter; let st = '';
      try { st = String((await terminalRequest(actCommand(req, sid, slot, act, intel), 'CAPSET', req)).kv.status ?? ''); } catch { st = ''; }
      if (st === 'none') { delete s.captives[String(slot)]; save(); return { ok: false, error: L('게임에 이 포로가 없습니다(이미 처리됨).', 'This captive is no longer held in game.'), state: captiveView() }; }
      if (st !== 'applied' && st !== 'gone') return { ok: false, error: L('게임이 응답하지 않습니다. 잠시 뒤 다시 해 주세요.', 'The game did not respond. Try again shortly.'), state: captiveView() };
      if (st === 'gone') {
        const t = L(`${c.fname}이(가) 더는 없어 ${c.name} 제독은 갈 곳을 잃었다.`, `${c.fname} no longer exists; Admiral ${c.name} has nowhere to go.`);
        if (act === 'interrogate') { c.talk.push({ who: 'note', text: t }); save(); return { ok: false, error: t, state: captiveView() }; }
        delete s.captives[String(slot)]; note(s, t); save(); return { ok: true, state: captiveView() };
      }
      const text = actResultText(c, act, usName(), intel); note(s, text);
      if (c.fidx > 0) chronNote(c.fidx, chronText(c, act, usName()));
      if (act === 'execute' || act === 'secret') infamyExec({ name: c.name, fname: c.fname, fidx: c.fidx, secret: act === 'secret' });
      if (act === 'execute' || act === 'recruit') chronNoteWorld(act === 'execute' ? L(`${usName()}, 사로잡은 ${c.fname}의 ${c.name} 제독 처형`, `${usName()} executes captured Admiral ${c.name} of ${c.fname}`) : L(`${c.fname}의 ${c.name} 제독, ${usName()}로 전향`, `Admiral ${c.name} of ${c.fname} defects to ${usName()}`), true);
      if (act === 'interrogate') { c.questioned = true; c.talk.push({ who: 'note', text }); } else delete s.captives[String(slot)];
      save(); return { ok: true, text, state: captiveView() };
    } finally { busy = false; push(); }
  });
}
