// 집무실 연락처 — 내 지도자 명단(앱 쪽, 2026-10-18). 순수 로직은 src/people.ts.
// 모드(sllm_people.1)가 LEADER·LEADERAT·LEADER_END 를 남기면 세이브별 인물 장부(sllm_people.json)에 반영한다.
// 2026-11-03 「슈뢰딩거」: 명단은 매달이 아니라 지도자에 바뀐 일이 있던 달·1년에 한 번·집무실 연락처를 열 때(peopleRefresh)만 온다.
// 그래서 「매달 할 일」(서신 뽑기·추모 대기열)은 명단이 아니라 MONTH 줄(onPeopleMonth)에 건다.
import { app, ipcMain } from 'electron';
import * as path from 'path';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { terminalReplies } from './terminal';
import { enqueue, sendConsole } from '../app/game-link';
import { PeopleCollector, PeopleStore, applyRoster, type Person } from '../people';

let storeInst: PeopleStore | null = null;
const store = () => (storeInst ??= new PeopleStore(path.join(app.getPath('userData'), 'sllm_people.json')));
const collector = new PeopleCollector();
const listeners: Array<() => void> = [];
/** 명단이 바뀌면 부를 함수(집무실이 화면을 새로 그린다). 가져오기 고리를 만들지 않으려고 이 방식으로 받는다. */
export function onPeopleChanged(fn: () => void): void { listeners.push(fn); }
const monthHooks: Array<() => void> = [];
/** 게임 달이 바뀔 때 부를 함수(명단이 오든 안 오든 매달 한 번). 서신·추모가 쓴다. */
export function onPeopleMonth(fn: () => void): void { monthHooks.push(fn); }
let lastRoster: { sid: string; date: string } | null = null;
const outHooks: Array<(kv: Record<string, string>) => void> = []; // 작별·추모(memorial-app), 비서 국장·퇴임(secretary-app, 2026-10-19)
/** 지도자 사망·해임 신호(LEADEROUT)를 받을 함수(memorial-app). */
export function onLeaderOut(fn: (kv: Record<string, string>) => void): void { outHooks.push(fn); }
/** 이 세이브의 인물 장부(떠난 인물 포함). */
export function peopleOf(sid: string): Person[] { return sid ? Object.values(store().get(sid).persons) : []; }

export function onRoster(list: Parameters<typeof applyRoster>[1], date: string): void {
  const sid = ctx.curSaveId; if (!sid) return;
  const r = applyRoster(store().get(sid), list, date || ctx.gameDate);
  if (!list.length) return;
  lastRoster = { sid, date: ctx.gameDate || date };
  store().save();
  if (r.added.length || r.gone.length || r.renamed.length) logDiagnostic('info', 'people.changed', { added: r.added.length, gone: r.gone.length, renamed: r.renamed.length, total: list.length });
  for (const fn of listeners) { try { fn(); } catch { /* 화면 갱신 실패는 무시 */ } }
}

/** 플레이어 통치자 이름(2026-10-18 사용자 규칙: 화면의 「나」는 늘 통치자 이름으로). 이번 달 명단 → 제국 정보 순, 모르면 ''. */
export function playerRulerName(): string {
  const sid = ctx.curSaveId;
  const p = sid ? peopleOf(sid).find((x) => x.ruler && !x.gone) : undefined;
  return (p?.name || ctx.profiles.get(ctx.playerIdx)?.ruler || '').trim();
}
export function registerPeople(router: LogRouter): void {
  ipcMain.handle('playerRuler', async () => playerRulerName());
  // 집무실 연락처를 열 때: 이 게임 날짜에 아직 명단을 안 받았으면 한 번만 부른다(일시정지 중 여러 번 열어도 한 번).
  ipcMain.handle('peopleRefresh', async () => {
    const sid = ctx.curSaveId || '', today = ctx.gameDate || '';
    if (!sid || !today || !ctx.gameRunning || (lastRoster && lastRoster.sid === sid && lastRoster.date === today)) return { sent: false };
    lastRoster = { sid, date: today };
    try { await enqueue(() => sendConsole('effect every_playable_country = { limit = { is_ai = no } country_event = { id = sllm_people.1 } }')); return { sent: true }; }
    catch (e) { logDiagnostic('warn', 'people.refresh_failed', { error: String(e) }); return { sent: false }; }
  });
  router.on(SLOT.PEOPLE, 'people:roster', (m: SllmMessage) => {
    if (m.kind === 'MONTH') { setTimeout(() => { for (const f of monthHooks) { try { f(); } catch (e) { logDiagnostic('warn', 'people.month_hook_failed', { error: String(e) }); } } }, 0); return; } // 날짜(ctx.gameDate)가 다른 자리에서 정해진 뒤에
    if (m.kind === 'LEADEROUT') { for (const f of outHooks) { try { f(m.kv); } catch (e) { logDiagnostic('warn', 'memorial.out_failed', { error: String(e) }); } } return; } // 작별·추모(memorial-app)
    if (m.kind === 'LETTERAPPLY') { terminalReplies.get('LETTERAPPLY:' + m.kv.req)?.(m); return; } // 개인 서신 부탁 결과(letters-app)
    if (m.kind !== 'LEADER' && m.kind !== 'LTRAIT' && m.kind !== 'LEADERAT' && m.kind !== 'LEADER_END') return; // LTRAIT: 특성(빠뜨리면 특성이 안 들어온다)
    const r = collector.feed(m.kind, m.kv); if (r) onRoster(r.list, r.date);
  });
}
