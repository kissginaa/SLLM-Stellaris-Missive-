// 처형(06, 2026-10-23 집 PC 초안). 규칙: src/execution-case.ts(대상·사유·공개·앎·반응), 명령: src/session-machines.ts executionCommand(kill_leader, 4.5.1 effects.log 확인).
// 사용자 확정: 대상 = 우리 제국 현직 지도자만(통치자 자신·비서·타국·은퇴 제외) / 사유 4가지(혐의 분류일 뿐 입증 아님) / 공개·비공개 / 실제로 아는 인물만 지지·유보·반발(앱 판정) /
//   반발만으로 반란·해임·수치 효과를 자동 실행하지 않는다 / 게임 결과 확인 전에는 발표·반응을 만들지 않는다 / 사망 알림·추모와 중복되지 않게 한 사건으로.
// 화면: 집무실 인물 카드의 「처형…」 → 대화 상자(ui/office-execution.js). 반응은 각 인물의 기억에 남아 1:1 통신에서 AI 가 참고한다(수치 효과 없음).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf, onLeaderOut } from './people-app';
import { relBookOf } from './relations-app';
import { executionCommand } from '../session-machines';
import type { Pid } from '../relations';
import { type ExecutionCase, type ExecReason, executionEligible, newCase, finalConfirmText, settleCase, deathBelongsToCase, spreadKnowledge, judgeReaction, stanceLabel, reasonLabel } from '../execution-case';

interface ExBook { sid: string; cases: ExecutionCase[] }
const dir = () => path.join(app.getPath('userData'), 'executions');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, ExBook>();
export function sanitizeExBook(x: unknown, sid: string): ExBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<ExBook>;
  const cases = (Array.isArray(o.cases) ? o.cases : []).filter((c): c is ExecutionCase => !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.target === 'string' && typeof c.state === 'string').slice(-40)
    .map((c) => (c.state === 'preparing' ? { ...c, state: 'cancelled' as const } : c.state === 'requested' ? { ...c, state: 'outcome_unknown' as const } : c)); // 준비하다 꺼진 것은 취소(실행되지 않았다) · 회신 전에 꺼진 것은 결과 미확인(06: 영구 대기 금지)
  return { sid, cases };
}
function bookOf(sid: string): ExBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeExBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'executions', error: e }); b = sanitizeExBook(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'executions', error: e }); }
}
/** 인물 기억(persona-app). main.ts 가 꽂는다. */
let personaNote: ((sid: string, key: string, text: string, delta?: number) => void) | null = null;
export function setExecutionPersona(p: { note: (sid: string, key: string, text: string, delta?: number) => void }): void { personaNote = p.note; }
/** 추모관(memorial-app)이 이 사망을 처형 사건이 맡았는지 묻는다(06: 사망 알림·추모와 중복 금지). */
export function executionOwnsDeath(sid: string, lid: number): boolean { return bookOf(sid).cases.some((c) => deathBelongsToCase(c, `p:${lid}`)); }

const live = (sid: string) => peopleOf(sid).filter((p) => !p.gone);
function eligibility(sid: string, key: Pid) {
  const p = peopleOf(sid).find((x) => `p:${x.lid}` === key);
  return executionEligible({ pid: key, ownEmpire: !!p, status: !p ? 'unknown' : p.gone ? 'unknown' : 'active', isRuler: !!p?.ruler, isSecretary: key === 'sec' });
}
const RSTANCE: Record<string, [string, string]> = { grief: ['슬픔', 'grief'], anxiety: ['불안', 'anxiety'], relief: ['안도', 'relief'], anger: ['분노', 'anger'], none: ['', ''] };
export function casesView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', cases: [] };
  const names = new Map(peopleOf(sid).map((p) => [`p:${p.lid}`, p.name]));
  return { sid, cases: bookOf(sid).cases.filter((c) => c.state !== 'cancelled').slice(-12).reverse().map((c) => ({ id: c.id, target: c.targetName, reason: reasonLabel(c.reason), note: c.note, publicity: c.publicity, state: c.state, on: c.appliedOn ?? '',
    reactions: Object.entries(c.reactions).map(([pid, rs]) => { const r = rs[rs.length - 1]; return { name: names.get(pid) ?? pid, stance: stanceLabel(r.stance), emotion: L(...(RSTANCE[r.emotion] ?? RSTANCE.none)) }; }),
    knowers: Object.values(c.knows).filter((k) => k.level === 'execution').length })) };
}
function push(): void { try { const v = casesView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('execUpdate', v); } catch { /* 창 없음 */ } }

/** 처형이 게임에서 확인된 뒤: 앎 퍼뜨리기(공개 = 우리 현직 지도자 모두 「처형」을 앎, 비공개 = 아무도 진상은 모르고 사망만) → 아는 사람만 반응 판정 → 기억에 한 줄. */
export function afterApplied(sid: string, c: ExecutionCase, today: string, rng: () => number): number {
  const others = live(sid).map((p) => `p:${p.lid}`).filter((p) => p !== c.target && p !== c.rulerPid);
  spreadKnowledge(c, today, c.publicity === 'public' ? { announced: others } : { deathOnly: others });
  const led = relBookOf(sid).ledger; let n = 0;
  for (const who of others) {
    const r = judgeReaction(c, led, who, { sameFaction: false, loyalty: 0, knowsEvidence: c.publicity === 'public' }, today, rng);
    if (r) { n++; personaNote?.(sid, who, L(`통치자가 ${c.targetName}을(를) 공개 처형했다(사유: ${reasonLabel(c.reason)}) — 나는 ${stanceLabel(r.stance)}${RSTANCE[r.emotion]?.[0] ? `, ${RSTANCE[r.emotion][0]}` : ''}`, `The ruler publicly executed ${c.targetName} (reason: ${reasonLabel(c.reason)}) — my stance: ${stanceLabel(r.stance)}${RSTANCE[r.emotion]?.[1] ? `, ${RSTANCE[r.emotion][1]}` : ''}`)); }
    else if (c.knows[who]?.level === 'death_only') personaNote?.(sid, who, L(`${c.targetName}이(가) 세상을 떠났다는 소식을 들었다`, `Heard that ${c.targetName} has died`));
  }
  return n;
}

async function execute(sid: string, id: string): Promise<{ status: string }> {
  const b = bookOf(sid), c = b.cases.find((x) => x.id === id); if (!c || c.state !== 'preparing') throw new Error(L('준비된 처형이 없습니다.', 'No execution is being prepared.'));
  const el = eligibility(sid, c.target); if (!el.ok) { c.state = 'cancelled'; save(sid); throw new Error(el.why); } // 실행 직전 재검사(06)
  const ruler = live(sid).find((p) => p.ruler); if (!ruler || `p:${ruler.lid}` !== c.rulerPid) { c.state = 'cancelled'; save(sid); throw new Error(L('통치자가 바뀌어 준비가 취소되었습니다.', 'The ruler changed, so the preparation was cancelled.')); }
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
  const lid = Number(c.target.slice(2)), req = ++link.reqCounter, key = `e${c.id.replace(/[^a-z0-9]/gi, '').slice(-16).toLowerCase()}`;
  c.state = 'requested'; c.requestId = String(req); save(sid); // 요청 전에 기록 → 더블클릭·재시작에도 한 번
  let st = 'outcome_unknown';
  try { st = String((await terminalRequest(executionCommand(req, sid, lid, key, false), 'EXECUTE', req)).kv.status ?? 'outcome_unknown'); } catch (e) { logDiagnostic('warn', 'execution.request_failed', { error: (e as Error).message }); }
  const today = ctx.gameDate || '';
  settleCase(c, st === 'applied' || st === 'duplicate' ? 'applied' : st === 'no_target' || st === 'ruler_blocked' ? 'rejected' : 'outcome_unknown', today);
  if ((c.state as ExecutionCase['state']) === 'applied') { // settleCase 가 바꾼 상태
    afterApplied(sid, c, today, Math.random);
    chronNoteWorld(c.publicity === 'public' ? L(`${today} ${c.targetName} 공개 처형 — ${reasonLabel(c.reason)}`, `${today} ${c.targetName} publicly executed — ${reasonLabel(c.reason)}`) : L(`${today} ${c.targetName} 사망`, `${today} ${c.targetName} died`), c.publicity === 'public'); // 비공개면 공개 기록에 진상을 넣지 않는다
  }
  save(sid); push(); logDiagnostic('info', 'execution.result', { status: c.state, publicity: c.publicity });
  return { status: c.state };
}

export function registerExecution(): void {
  onLeaderOut((kv) => { // LEADEROUT 이 처형 결과보다 먼저 오면(회신 유실 등) 처형 사건으로 묶어 확정한다
    const sid = ctx.curSaveId; if (!sid || kv.why !== 'death') return;
    const c = bookOf(sid).cases.find((x) => deathBelongsToCase(x, `p:${Number(kv.lid)}`) && x.state === 'outcome_unknown');
    if (c && settleCase(c, 'applied', String(kv.date || ctx.gameDate || ''))) { afterApplied(sid, c, c.appliedOn ?? '', Math.random); save(sid); push(); }
  });
  ipcMain.handle('execCheck', (_e, key: unknown) => { const sid = ctx.curSaveId; if (!sid) return { ok: false, why: L('세이브를 먼저 불러와 주세요.', 'Load a save first.') }; return eligibility(sid, String(key ?? '')); });
  ipcMain.handle('execState', () => casesView());
  ipcMain.handle('execPrepare', (_e, a: { key?: unknown; reason?: unknown; note?: unknown; publicity?: unknown }) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
      const key = String(a?.key ?? ''), el = eligibility(sid, key); if (!el.ok) throw new Error(el.why);
      const p = peopleOf(sid).find((x) => `p:${x.lid}` === key)!, ruler = live(sid).find((x) => x.ruler); if (!ruler) throw new Error(L('우리 통치자를 아직 확인하지 못했습니다.', 'Our ruler is not confirmed yet.'));
      const reason = (['treason', 'corruption', 'responsibility', 'other'].includes(String(a?.reason)) ? a!.reason : 'other') as ExecReason;
      const c = newCase(`ex:${randomUUID().slice(0, 12)}`, sid, key, p.name, `p:${ruler.lid}`, reason, String(a?.note ?? ''), a?.publicity === 'public' ? 'public' : 'private', []); // 근거 사건은 아직 연결하지 않는다 → 「플레이어 주장」
      if ('error' in c) throw new Error(c.error);
      const b = bookOf(sid); for (const x of b.cases) if (x.state === 'preparing') x.state = 'cancelled';
      b.cases.push(c); save(sid);
      return { ok: true, id: c.id, confirm: finalConfirmText(c) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('execCancel', (_e, id: unknown) => { const sid = ctx.curSaveId; if (!sid) return { ok: false }; const c = bookOf(sid).cases.find((x) => x.id === String(id)); if (c && c.state === 'preparing') { c.state = 'cancelled'; save(sid); } return { ok: true }; });
  ipcMain.handle('execRun', async (_e, id: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); const r = await execute(sid, String(id ?? '')); return { ok: true, ...r, state: casesView() }; } catch (e) { return { ok: false, error: (e as Error).message, state: casesView() }; } });
}
