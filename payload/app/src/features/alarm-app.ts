// 일정표·쿨다운 알림(앱 쪽, 2026-11-04 사용자: 「Alarm Clock」에서 1·2·3 채용). 규칙: src/alarm.ts · 화면: ui/office-alarm.js(집무실 「비서 호출」 옆 「일정표」) · 모드: sllm_alarm.txt·sllm_alarm_situations.txt
// 게임에 숨은 재사용 대기를 읽는다(ALARM 줄). 다시 된 것은 집무실 알림 + 비서 보고(alarmBrief).
// 2026-11-09(회랑 방식): 예전엔 매달 읽었다. 이제는 세이브를 불러온 뒤 첫 달·일정표를 연 달·12달마다만 읽고, 그 사이에는 읽어 둔 날짜로만 울린다.
// 우리 기능도 같은 표: 게임 쪽 표식(기술 원조·동화 정책·여론 공작 냉각)은 읽은 대로, 앱만 아는 것(성계 이양)은 addAppAlarm 으로 날짜를 적는다.
// 게임 「상황」 막대(②): alarmBar(동화 정책 다음 단계·기술 원조 재사용).
// 저장: sllm_alarm.json { saves: { [세이브]: { list: Alarm[], ring: Alarm[](최근 울린 것), scanned: 'YYYY.MM', off: string[](끈 키) } } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { featureOff } from '../app/feature-gate';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { office } from './office-app';
import { terminal, terminalRequest, terminalReplies } from './terminal';
import { ALL, scanCommand, readAlarm, mergeScan, ringByDate, monthsApart, ALARM_RESCAN_MONTHS, daysLeft, labelOf, briefFacts, situationCommand, addDays, alarmId, defOf, type Alarm, type AlarmLine } from '../alarm';

interface AlSave { list: Alarm[]; ring: Alarm[]; scanned: string; off: string[] }
const file = () => path.join(app.getPath('userData'), 'sllm_alarm.json');
let all: Record<string, AlSave> | null = null;
const books = (): Record<string, AlSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): AlSave => { const s = (books()[sid] ??= { list: [], ring: [], scanned: '', off: [] }); s.list ??= []; s.ring ??= []; s.off ??= []; return s; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'alarm.save_failed', { error: (e as Error).message }); } };
const ready = () => !!(ctx.gameRunning && link.sessionReady && ctx.curSaveId && /^\d+$/.test(ctx.curSaveId));
const vname = (idx: number): string => terminal.items.find((c) => c.idx === idx)?.name ?? '';

const pending = new Map<number, AlarmLine[]>();
let loadedFresh = true; // 앱을 켰거나 세이브를 불러온 뒤 첫 달은 꼭 읽는다
function onLine(m: SllmMessage): void {
  if (m.kind === 'LOADED') { loadedFresh = true; return; }
  const req = Math.round(Number(String(m.kv.req ?? '').replace(/^\\/, '')));
  if (m.kind === 'ALARM') { const l = readAlarm(m.kv), p = pending.get(req); if (l && p && p.length < 200) p.push(l); return; }
  if (m.kind === 'ALARMEND' || m.kind === 'ALARMSET') terminalReplies.get(m.kind + ':' + req)?.(m);
}

/** 이번 달 읽은 값: 그 항목의 남은 날(없으면 0). 이번 달에 아직 안 읽었으면 null(③ — 다른 기능이 게임 값을 믿고 쓰게). */
export function scanDays(key: string, v = 0): number | null {
  const sid = ctx.curSaveId; if (!sid) return null; const s = saveOf(sid);
  if (s.scanned !== (ctx.gameDate || '').slice(0, 7)) return null;
  const a = s.list.find((x) => x.id === alarmId(key, v) && x.from === 'game'); return a ? daysLeft(a, ctx.gameDate || '') : 0;
}
/** 앱만 아는 대기(성계 이양 등)를 일정표에 적는다. */
export function addAppAlarm(id: string, label: [string, string], days: number): void {
  const sid = ctx.curSaveId; if (!sid || !(days > 0)) return; const s = saveOf(sid), now = ctx.gameDate || '';
  s.list = s.list.filter((a) => a.id !== 'app:' + id); s.list.push({ id: 'app:' + id, key: 'app', v: 0, due: addDays(now, days), total: Math.round(days), from: 'app', label }); save();
}
/** 게임 「상황」 막대 켜기·끄기(②). 실패해도 조용히. */
export async function alarmBar(type: 'assim' | 'vatech', idx: number, days: number, on = true): Promise<void> {
  if (!ready()) return; const sid = ctx.curSaveId!, req = ++link.reqCounter;
  try { await terminalRequest(situationCommand(req, sid, type, idx, Math.max(1, Math.min(3600, Math.round(days))), on), 'ALARMSET', req); } catch (e) { logDiagnostic('warn', 'alarm.bar_failed', { error: (e as Error).message }); }
}

let lastMonth = '', busy = false;
/** 한 달에 한 번(또는 「지금 읽기」): 게임 값 읽기 → 표 갱신 → 다시 된 것 알림. */
async function scan(force = false): Promise<{ ok: boolean; why?: string }> {
  if (!ready()) return { ok: false, why: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
  const sid = ctx.curSaveId!, now = ctx.gameDate || '', month = now.slice(0, 7), s = saveOf(sid);
  if (!month || busy || (!force && s.scanned === month)) return { ok: true };
  busy = true; const req = ++link.reqCounter; pending.set(req, []);
  try {
    try { await terminalRequest(scanCommand(req, sid), 'ALARMEND', req); } catch { return { ok: false, why: L('게임이 응답하지 않았습니다.', 'The game did not answer.') }; }
    const lines = pending.get(req) ?? [];
    const r = mergeScan(s.list, lines, now);
    for (const a of r.list) if (a.v && !a.vname) a.vname = vname(a.v);
    s.list = r.list; s.scanned = month;
    ringOut(s, r.ring, now);
    save(); logDiagnostic('info', 'alarm.scan', { n: lines.length, ring: r.ring.length });
    return { ok: true };
  } finally { pending.delete(req); busy = false; }
}
/** 읽지 않는 달: 읽어 둔 날짜로만 울리기(게임 명령 없음). */
function tickByDate(): void {
  const sid = ctx.curSaveId; if (!sid) return; const s = saveOf(sid), now = ctx.gameDate || '';
  const r = ringByDate(s.list, now); if (!r.ring.length) return;
  s.list = r.list; ringOut(s, r.ring, now); save();
}
/** 다시 된 것 알리기(끈 항목은 조용히). */
function ringOut(s: AlSave, rung: Alarm[], now: string): void {
  {
    const ring = rung.filter((a) => !s.off.includes(a.key));
    if (ring.length) {
      s.ring = [...ring.map((a) => ({ ...a, due: now })), ...s.ring].slice(0, 20);
      (office as { toastGo: string }).toastGo = 'alarm';
      const names = ring.map((a) => L(...labelOf(a)));
      ctx.notify({ kind: 'office', title: L('일정표: 다시 할 수 있어요', 'Schedule: available again'), body: names.slice(0, 4).join(' · ') + (names.length > 4 ? L(` 외 ${names.length - 4}건`, ` and ${names.length - 4} more`) : ''), action: L('일정표', 'Schedule') });
    }
  }
}
/** 비서 보고(secretary-app 이 부름): 최근 한 달 사이 다시 된 것 + 60일 안에 될 것(영어 사실). */
export function alarmBrief(): { ready: string[]; soon: string[] } {
  const sid = ctx.curSaveId; if (!sid) return { ready: [], soon: [] }; const s = saveOf(sid), now = ctx.gameDate || '';
  const fresh = s.ring.filter((a) => (a.due || '').slice(0, 7) === now.slice(0, 7));
  return briefFacts(fresh, s.list.filter((a) => !s.off.includes(a.key)), now);
}

export function alarmView() {
  const sid = ctx.curSaveId; if (!sid) return { ok: false, list: [], ring: [] };
  const s = saveOf(sid), now = ctx.gameDate || '';
  const row = (a: Alarm) => { const d = defOf(a.key); return { id: a.id, key: a.key, label: labelOf(a), due: a.due, left: daysLeft(a, now), total: a.total, cat: d?.cat ?? 'app', from: a.from, off: s.off.includes(a.key) }; };
  return { ok: true, running: ready(), date: now, scanned: s.scanned, list: s.list.map(row).sort((a, b) => a.left - b.left), ring: s.ring.slice(0, 10).map((a) => ({ label: labelOf(a), due: a.due })), tracked: ALL.length };
}

export function registerAlarm(router: LogRouter): void {
  router.on(SLOT.ALARM, 'alarm', onLine);
  setInterval(() => {
    const m = (ctx.gameDate || '').slice(0, 7); if (!m || m === lastMonth || !ready() || featureOff('schedule')) return; lastMonth = m;
    const s = saveOf(ctx.curSaveId!);
    if (loadedFresh || monthsApart(s.scanned, m) >= ALARM_RESCAN_MONTHS) { loadedFresh = false; void scan().catch((e) => logDiagnostic('warn', 'alarm.scan_failed', { error: (e as Error).message })); }
    else tickByDate();
  }, 20000);
  ipcMain.handle('alarmState', () => { // 일정표를 연 달에 아직 안 읽었으면 뒤에서 한 번 읽는다(화면은 다음 갱신 때 반영)
    const sid = ctx.curSaveId, m = (ctx.gameDate || '').slice(0, 7);
    if (sid && m && ready() && !featureOff('schedule') && saveOf(sid).scanned !== m) void scan().catch((e) => logDiagnostic('warn', 'alarm.scan_failed', { error: (e as Error).message }));
    return alarmView();
  });
  ipcMain.handle('alarmScan', async () => ({ ...(await scan(true)), view: alarmView() }));
  ipcMain.handle('alarmMute', (_e, key: unknown, off: unknown) => {
    const sid = ctx.curSaveId; if (!sid || typeof key !== 'string' || !(defOf(key) || key === 'app')) return alarmView();
    const s = saveOf(sid); s.off = s.off.filter((k) => k !== key); if (off) s.off.push(key); save(); return alarmView();
  });
}
