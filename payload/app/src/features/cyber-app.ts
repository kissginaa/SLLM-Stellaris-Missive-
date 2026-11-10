// 사이버전·해외발 여론 공작(2026-11-04 사용자) — 앱 쪽. 모드: events/sllm_cyber_events.txt · common/situations/sllm_cyber_situations.txt
// 게임 AI 가 우리에게 건 여론 첩보 작전(비방 공작·외교 사건 조작)이 성공하면 게임이 「해외발 여론 공작」 상황(진행 막대·단계·대응)을 띄우고 CYBER 줄을 남긴다.
// 여기서는: 공작 장부(sllm_cyber.json)에 쌓고, 시작하면 집무실 알림, 단계·대응·결말을 연대기에 적는다 →
//   국내 인터넷(새로고침 때 연대기 recentEvents 로 「해외 IP」 선동 글·검열 논란), 갤럭틱 포럼(세계 소식: 항의·격퇴·장악).
// 효과(안정도 등)는 게임이 바로 건다. 글은 인터넷을 새로고침할 때 생긴다(2026-11-04 합의).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { office } from './office-app';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { CYBER, TRIAL, readCyber, cyberApName, cyberChron, evidenceGain, evidenceNow, newTrial, trialSayMessages, readTrialSay, trialRulingMessages, trialCommand, trialChron, trialChance, type CyberOp } from '../cyber';
import { link } from '../app/game-link';
import { terminal, terminalRequest, terminalReplies } from './terminal';
import { hoiHooks } from './hoi-app';

interface CyberSave { cur: CyberOp | null; past: CyberOp[] }
const file = () => path.join(app.getPath('userData'), 'sllm_cyber.json');
let all: Record<string, CyberSave> | null = null;
const books = (): Record<string, CyberSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): CyberSave => { const s = (books()[sid] ??= { cur: null, past: [] }); s.past ??= []; return s; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'cyber.save_failed', { error: (e as Error).message }); } };

/** 배후 이름: 게임이 준 이름 → 우리가 아는 제국 이름 순. */
const nameOf = (idx: number, given: string): string => given || terminal.items.find((c) => c.idx === idx)?.name || L('어느 외국', 'a foreign power');
function note(op: CyberOp, text: { ko: string; en: string } | null, world: { ko: string; en: string } | null): void {
  try {
    if (text) { if (op.from > 0) chronNote(op.from, L(text.ko, text.en)); else chronNoteWorld(L(text.ko, text.en)); }
    if (world) chronNoteWorld(L(world.ko, world.en));
  } catch (e) { logDiagnostic('warn', 'cyber.chron_failed', { error: (e as Error).message }); }
}

function onCyber(m: SllmMessage): void {
  const ev = readCyber(m.kv); if (!ev || ev.sid !== ctx.curSaveId) return;
  const s = saveOf(ev.sid), us = ctx.playerName || L('우리 제국', 'our empire');
  if (ev.ev === 'start') {
    if (s.cur) { s.cur.res = 0; s.cur.end = ev.date; s.past.push(s.cur); } // 끝 줄을 못 받은 옛 공작은 「알 수 없음」으로 닫는다
    const op: CyberOp = { from: ev.from, name: nameOf(ev.from, ev.name), start: ev.date, stage: 1, ap: 0, aps: [], end: '', res: -1, apSince: ev.date, ev: 0 };
    s.cur = op; save(); logDiagnostic('info', 'cyber.start', { from: op.from });
    const c = cyberChron('start', op, us); note(op, c.text, c.world);
    (office as { toastGo: string }).toastGo = 'spy';
    ctx.notify({ kind: 'office', title: L('해외발 여론 공작', 'Foreign disinformation campaign'), body: L(`${op.name}의 소행으로 보이는 여론 공작이 우리 인터넷에서 시작됐습니다. 게임의 「상황」 화면에서 대응을 고르세요.`, `A disinformation campaign, apparently by ${op.name}, has started on our networks. Choose a response in the game's Situations screen.`), action: L('첩보 보고', 'Espionage') });
    return;
  }
  const op = s.cur; if (!op) return;
  if (ev.ev === 'stage') {
    if (ev.n <= op.stage) return; op.stage = ev.n; save();
    const c = cyberChron('stage', op, us); note(op, c.text, c.world);
  } else if (ev.ev === 'ap') {
    if (ev.ap === op.ap) return; op.ev = (op.ev ?? 0) + evidenceGain(op.ap, op.apSince, ev.date); op.apSince = ev.date; op.ap = ev.ap; if (ev.ap && !op.aps.includes(ev.ap)) op.aps.push(ev.ap); save();
    const c = cyberChron('ap', op, us); note(op, c.text, c.world);
  } else if (ev.ev === 'end') {
    op.res = ev.res; op.end = ev.date; s.past.push(op); s.cur = null;
    while (s.past.length > CYBER.keep) s.past.shift(); save();
    const c = cyberChron('end', op, us); note(op, c.text, c.world);
    if (ev.res === 2) ctx.notify({ kind: 'office', title: L('여론 장악당함', 'Public opinion hijacked'), body: L(`${op.name}의 여론 공작이 끝내 우리 여론을 장악했습니다. 1년 동안 모든 행성의 안정도가 떨어집니다.`, `${op.name}'s campaign has taken over our public opinion. Stability drops on every planet for a year.`), action: L('첩보 보고', 'Espionage') });
  }
}

const band = (idx: number): number | undefined => { try { return idx > 0 ? hoiHooks.intel?.(idx)?.band : undefined; } catch { return undefined; } };

export function cyberView() {
  const sid = ctx.curSaveId; if (!sid) return { ok: false, cur: null, past: [] };
  const s = saveOf(sid), show = (o: CyberOp) => ({ ...o, apName: cyberApName(o.ap) });
  const cur = s.cur ? { ...show(s.cur), evNow: s.cur.trial ? s.cur.trial.ev : evidenceNow(s.cur, ctx.gameDate || '', band(s.cur.from)), chance: s.cur.trial ? s.cur.trial.p : trialChance(evidenceNow(s.cur, ctx.gameDate || '', band(s.cur.from)), 0) } : null;
  return { ok: true, running: !!(ctx.gameRunning && link.sessionReady), fee: TRIAL.fee, loseFee: TRIAL.loseFee, says: TRIAL.says, cur, past: s.past.slice(-5).reverse().map(show) };
}

export function registerCyber(router: LogRouter): void {
  router.on(SLOT.CYBER, 'cyber', (m: SllmMessage) => { if (m.kind === 'CYBER') onCyber(m); else if (m.kind === 'CYBERTRIAL') terminalReplies.get('CYBERTRIAL:' + m.kv.req)?.(m); });
  ipcMain.handle('cyberState', () => cyberView());
  // 역제소(2026-11-04 사용자): 증거가 없어도 걸 수 있지만 거의 진다. 공작 하나에 한 번. 발언 최대 3번 → 판결.
  const curOp = (): { sid: string; op: CyberOp } => { const sid = ctx.curSaveId, op = sid ? saveOf(sid).cur : null; if (!sid || !op) throw new Error(L('진행 중인 여론 공작이 없습니다.', 'There is no campaign in progress.')); return { sid, op }; };
  const us = () => ctx.playerName || L('우리 제국', 'our empire');
  ipcMain.handle('cyberTrialStart', () => {
    try {
      const { op } = curOp(); if (op.trial) throw new Error(L('이 공작은 이미 제소했습니다.', 'You have already taken this campaign to court.'));
      if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 제소할 수 있습니다.', 'The game must be running to file a case.'));
      op.trial = newTrial(op, ctx.gameDate || '', band(op.from)); save();
      const c = trialChron('file', op, us()); note(op, c.text, c.world);
      return { ok: true, view: cyberView() };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('cyberTrialSay', async (_e, text: unknown) => {
    try {
      const { op } = curOp(), t = op.trial; if (!t || t.state !== 'open') throw new Error(L('재판이 열려 있지 않습니다.', 'No hearing is open.'));
      const said = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 500) : ''; if (!said) throw new Error(L('발언을 적어 주세요.', 'Write your statement first.'));
      if (t.says >= TRIAL.says) throw new Error(L('발언 기회를 다 썼습니다. 판결을 받으세요.', 'You have used all your statements. Ask for the verdict.'));
      const raw = String(await ctx.ai.chat(trialSayMessages(op, us(), t, said), { maxTokens: 600, purpose: 'cyber-trial', json: true }) ?? '');
      const r = readTrialSay(raw) ?? { defense: L('피고 측은 「근거 없는 모함」이라며 답변을 거부했습니다.', 'The defendant dismisses it as "baseless slander" and refuses to answer.'), judge: '', lean: 0 };
      t.log.push({ who: 'us', text: said }, { who: 'def', text: r.defense }); if (r.judge) t.log.push({ who: 'judge', text: r.judge });
      t.says += 1; t.lean += r.lean; t.p = trialChance(t.ev, t.lean); save();
      return { ok: true, view: cyberView() };
    } catch (e) { logDiagnostic('warn', 'cyber.trial_say_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('cyberTrialVerdict', async () => {
    try {
      const { sid, op } = curOp(), t = op.trial; if (!t || t.state !== 'open') throw new Error(L('재판이 열려 있지 않습니다.', 'No hearing is open.'));
      if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 판결을 받을 수 있습니다.', 'The game must be running to hear the verdict.'));
      const won = Math.random() < t.p, req = ++link.reqCounter;
      const m = await terminalRequest(trialCommand(req, sid, op.from, won), 'CYBERTRIAL', req);
      if (m.kv.status !== 'applied') throw new Error(L('게임이 판결을 받지 못했습니다.', 'The game did not apply the verdict.'));
      let ruling = '';
      try { ruling = String(await ctx.ai.chat(trialRulingMessages(op, us(), t, won), { maxTokens: 300, purpose: 'cyber-trial' }) ?? '').trim().slice(0, 700); } catch { /* 틀 문장으로 */ }
      t.state = won ? 'won' : 'lost'; t.ruling = ruling || (won ? L(`본 재판소는 ${op.name}의 여론 공작 혐의를 유죄로 판단한다.`, `This tribunal finds ${op.name} guilty of the disinformation campaign.`) : L('본 재판소는 증거 부족으로 이 사건을 기각한다.', 'This tribunal dismisses the case for lack of evidence.'));
      save(); const c = trialChron(won ? 'won' : 'lost', op, us()); note(op, c.text, c.world);
      return { ok: true, won, view: cyberView() };
    } catch (e) { logDiagnostic('warn', 'cyber.trial_verdict_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
}
