// 성계 번호표 연결(알파 11, 2026-10-25). 규칙: src/systems.ts. 모드: sllm_systems.txt(SYS_BEGIN·SYS·SYS_END).
// 통신 목록(CONTACT_END)이 올 때 표가 없거나 1년이 지났으면 한 번 읽는다. 대화에 성계 이름이 나오면(chat.ts noteMentions) 지도 이름표를 1년 세운다.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { bgWriteJson } from '../app/bg-worker';
import { LogRouter, SLOT } from '../app/log-router';
import { link, enqueue, sendConsole } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { dayNo } from '../gamedate';
import { L } from '../i18n-pick';
import type { SllmMessage } from '../protocol';
import { type SysTable, type SysMark, SYS, scanCommand, markCommand, needScan, findMentions, sanitizeSysTable, sanitizeMarks } from '../systems';

interface SaveSys { table?: SysTable; marks: SysMark[] }
const file = () => path.join(app.getPath('userData'), 'sllm_systems.json');
let store: Record<string, SaveSys> | null = null;
function all(): Record<string, SaveSys> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, any>)) { const t = sanitizeSysTable(v?.table); store[k] = { ...(t ? { table: t } : {}), marks: sanitizeMarks(v?.marks) }; } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'systems', error: e }); }
  return store;
}
function save(): void { bgWriteJson(file(), { version: 1, saves: all() }, (err) => { if (err) logDiagnostic('error', 'storage.write_failed', { store: 'systems', error: err }); }); } // 작업 스레드가 쓴다(2026-11-08)
const saveOf = (sid: string): SaveSys => (all()[safeKey(sid)] ??= { marks: [] });

let scan: { req: number; sid: string; names: Record<string, string>; open: boolean } | null = null;
const send = (cmd: string) => { void enqueue(() => sendConsole(cmd)).catch((e) => logDiagnostic('warn', 'systems.send_failed', { error: String(e) })); };

function onContacts(): void {
  const sid = ctx.curSaveId, date = ctx.gameDate; if (!sid || !date || !link.sessionReady) return;
  const now = dayNo(date); if (now === null) return;
  const s = saveOf(sid);
  // 기한이 지난 이름표 치우기
  const keep: SysMark[] = [];
  for (const m of s.marks) { if (m.until <= now || m.until - now > SYS.markDays * 2) send(markCommand(m.n, m.kind, false)); else keep.push(m); }
  if (keep.length !== s.marks.length) { s.marks = keep; save(); }
  if (!scan && needScan(s.table, now, dayNo)) {
    link.reqCounter += 1; scan = { req: link.reqCounter, sid, names: {}, open: false };
    send(scanCommand(scan.req)); logDiagnostic('info', 'systems.scan_sent', { req: scan.req });
    setTimeout(() => { if (scan && !scan.open) scan = null; }, 60000); // 응답이 없으면 다음 기회에 다시
  }
}
function onLine(m: SllmMessage): void {
  if (m.kind === 'CONTACT_END') { onContacts(); return; }
  if (!scan) return;
  if (m.kind === 'SYS_BEGIN' && Number(m.kv.req) === scan.req) { scan.open = true; return; }
  if (m.kind === 'SYS' && scan.open) { const n = Number(m.kv.n), nm = (m.kv.name || '').trim(); if (Number.isSafeInteger(n) && n > 0 && nm) scan.names[String(n)] = nm.slice(0, 80); return; }
  if (m.kind === 'SYS_END' && scan.open && Number(m.kv.req) === scan.req) {
    const done = scan; scan = null;
    if (ctx.curSaveId !== done.sid || !Object.keys(done.names).length) return;
    saveOf(done.sid).table = { scanned: ctx.gameDate || '', names: done.names }; save();
    logDiagnostic('info', 'systems.scanned', { n: Object.keys(done.names).length });
  }
}
/** 대화에서 성계 이름이 나오면 지도 이름표(1년). chat.ts 가 플레이어 말 + 상대 답으로 부른다. */
export function noteMentions(text: string): void {
  const sid = ctx.curSaveId, now = ctx.gameDate ? dayNo(ctx.gameDate) : null; if (!sid || now === null || !link.sessionReady) return;
  const s = saveOf(sid), t = s.table; if (!t) return;
  const found = findMentions(text, t).filter((n) => !s.marks.some((m) => m.n === n)); if (!found.length) return;
  for (const n of found) { s.marks.push({ n, kind: 'talk', until: now + SYS.markDays }); send(markCommand(n, 'talk', true)); }
  while (s.marks.length > SYS.maxMarks) { const old = s.marks.shift()!; send(markCommand(old.n, old.kind, false)); }
  save();
  const names = found.map((n) => t.names[String(n)]).join(', ');
  ctx.notify({ kind: 'info', title: L('지도에 표시함', 'Marked on the map'), body: L(`대화에 나온 성계를 1년 동안 지도에 표시합니다: ${names}`, `Systems named in the conversation are marked on the map for one year: ${names}`) });
}
export function registerSystems(router: LogRouter): void { router.on(SLOT.SYSTEMS, 'systems', onLine); }
