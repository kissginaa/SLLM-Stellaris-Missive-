// 대립 긴장도(시나리오 전용 기능, 2026-11-05 사용자) — 앱 쪽. 규칙: src/tension.ts · 화면: ui/office-tension.js(집무실 「대사관 보고」 옆 칸 + 「대립 긴장도」 창)
// 모드: common/scripted_effects/sllm_tension.txt — 시나리오 모드가 sllm_tn_begin 을 불렀을 때만 줄이 온다(평소 게임에서는 조용함).
// 로그 자리 TENSION(191): TNN(이름) · TN(매달) · TNST(단계) · TNWAR · TNPEACE · TNADD(더하기 회신) · TNQ(조회 끝)
// 다른 기능이 쓰는 것: tensionShift(n, 이유) — 긴장 올리기·내리기 · tensionPrompt() — LLM 프롬프트 한 줄 · tensionNow() — 지금 상태
// 저장: sllm_tension.json { saves: { [세이브]: TnSave } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { office } from './office-app';
import { TN, type TnSave, fixSave, applyLine, eventText, promptLine, stageName, note, shiftCommand, queryCommand } from '../tension';

const file = () => path.join(app.getPath('userData'), 'sllm_tension.json');
let all: Record<string, TnSave> | null = null;
const books = (): Record<string, TnSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): TnSave => { const b = books(); b[sid] = fixSave(b[sid]); return b[sid]; };
let dirty: ReturnType<typeof setTimeout> | null = null;
const save = () => { if (dirty) return; dirty = setTimeout(() => { dirty = null; try { const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: books() })); fs.renameSync(t, file()); } catch (e) { logDiagnostic('warn', 'tension.save_failed', { error: (e as Error).message }); } }, 1500); };
const ready = () => !!(ctx.gameRunning && link.sessionReady && ctx.curSaveId && /^\d+$/.test(ctx.curSaveId));
const world = (text: string) => { try { chronNoteWorld(text); } catch { /* 연대기는 덤 */ } };

function onLine(m: SllmMessage): void {
  if (m.kind === 'TNADD' || m.kind === 'TNQ') { terminalReplies.get(m.kind + ':' + Math.round(Number(String(m.kv.req ?? '').replace(/^\\/, '')) || 0))?.(m); return; }
  if (!['TNN', 'TN', 'TNST', 'TNWAR', 'TNPEACE'].includes(m.kind)) return;
  const sid = ctx.curSaveId; if (!sid) return;
  const s = saveOf(sid), e = applyLine(s, m.kind, m.kv as Record<string, string>); save();
  if (!e || e.kind === 'month') return;
  if (e.kind === 'incident') return; // 마찰은 상황판 기록에만
  const t = eventText(s, e); if (!t) return;
  (office as { toastGo: string }).toastGo = 'embassy';
  ctx.notify({ kind: 'office', title: L(...t.title), body: L(...t.body), action: L('대립 긴장도', 'Rivalry Tension') });
  world(L(...t.body));
}

let queried = '';
async function queryOnce(): Promise<void> {
  if (!ready()) return; const sid = ctx.curSaveId!; if (queried === sid) return; queried = sid;
  const req = ++link.reqCounter;
  try { await terminalRequest(queryCommand(req, sid), 'TNQ', req); } catch { queried = ''; }
}

/** 다른 기능이 긴장을 올리거나 내린다(n: −30~30, 0 아님). 시나리오가 아니면 false. */
export async function tensionShift(n: number, why: [string, string]): Promise<{ ok: boolean; v?: number }> {
  if (!ready()) return { ok: false }; const sid = ctx.curSaveId!;
  const k = Math.max(-TN.maxShift, Math.min(TN.maxShift, Math.round(n))); if (!k) return { ok: false };
  const req = ++link.reqCounter;
  try {
    const m = await terminalRequest(shiftCommand(req, sid, k), 'TNADD', req);
    const ok = Math.round(Number(String(m.kv.ok ?? '').replace(/^\\/, ''))) === 1; if (!ok) return { ok: false };
    const s = saveOf(sid), v = Math.round(Number(String(m.kv.v ?? '').replace(/^\\/, '')) || 0);
    note(s, { d: ctx.gameDate || '', kind: 'shift', ko: `${why[0]} (${k > 0 ? '+' : ''}${k} → ${v})`, en: `${why[1]} (${k > 0 ? '+' : ''}${k} → ${v})` }); save();
    return { ok: true, v };
  } catch (e) { logDiagnostic('warn', 'tension.shift_failed', { error: (e as Error).message }); return { ok: false }; }
}
/** 지금 세이브의 긴장 상태(켜져 있지 않으면 null). */
export function tensionNow(): TnSave | null { const sid = ctx.curSaveId; if (!sid) return null; const s = saveOf(sid); return s.on ? s : null; }
/** LLM 프롬프트 한 줄(영어). 시나리오가 아니면 빈 문자열. */
export function tensionPrompt(): string { return promptLine(tensionNow()); }

function view() {
  const s = tensionNow();
  if (!s) return { ok: true, on: false };
  return { ok: true, on: true, running: ready(), a: s.a?.name || '', b: s.b?.name || '', v: s.v, st: s.st, stage: stageName(s.st), war: s.war, date: s.date, hist: s.hist.slice(-240), notes: s.notes.slice(-40).reverse() };
}

export function registerTension(router: LogRouter): void {
  router.on(SLOT.TENSION, 'tension', onLine);
  setInterval(() => { void queryOnce(); }, 30000);
  ipcMain.handle('tnState', () => view());
}
// 순수 함수 검사용
export const tnTest = { onLine };
