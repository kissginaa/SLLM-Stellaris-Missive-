// 「동기화 로그」(기계) / 「공명 보고」(군체) · 「이탈 노드 보고」 연결(알파 11, 2026-10-25). 규칙·문장: src/gestalt-report.ts. 화면: ui/office-gestalt.js.
// 비서가 없는 단일 의식 제국에서 비서 업무 보고 자리를 채운다(LLM 없음). 이탈 노드는 매달 월간 상황 묶음의 DEVIANT 줄(모드 sllm_probe_protest.txt).
import { ipcMain } from 'electron';
import { ctx } from '../app/ctx';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { dayNo } from '../gamedate';
import { planetTrouble, REPORT_MIN_SCORE } from '../govreport';
import { gov } from './gov';
import { gameState } from './gamestate-app';
import { terminal } from './terminal';
import { crisisView } from './crisis-app';
import { hotEmotions } from './emotions-app';
import { openPledgeList } from './gc-app';
import { playerGestalt } from './gestalt-app';
import { setDeviant, deviantOf } from './deviancy-store';
import { DeviantCollector, buildReport, reportTitle, DEVIANCY_ALERT, type GestaltKind } from '../gestalt-report';
import type { SllmMessage } from '../protocol';

const collector = new DeviantCollector();
const kindNow = (): GestaltKind | '' => { const k = playerGestalt(); return k === 'machine' || k === 'hive' || k === 'gestalt' ? k : ''; };

function onLine(m: SllmMessage): void {
  const r = collector.feed(m); if (!r) return;
  const sid = ctx.curSaveId; if (!sid || !kindNow()) return; // 단일 의식 제국만(일반 제국은 모드가 줄을 보내지 않는다)
  const before = new Set((deviantOf(sid)?.list ?? []).map((p) => p.name)), date = ctx.gameDate || '';
  setDeviant(sid, date, r.list);
  const fresh = r.list.filter((p) => p.dev >= DEVIANCY_ALERT && !before.has(p.name));
  if (fresh.length) { // 새로 이탈 30을 넘은 행성만 한 번 알린다
    const names = fresh.map((p) => p.name).join(', '), mach = kindNow() === 'machine';
    ctx.notify({ kind: 'office', title: mach ? L('이탈 노드 감지', 'Deviant node detected') : L('공명이 흐트러짐', 'The resonance falters'), body: mach ? L(`이탈도가 ${DEVIANCY_ALERT}을 넘은 행성: ${names}. 동기화 로그에서 확인하십시오.`, `Planets above deviancy ${DEVIANCY_ALERT}: ${names}. See the synchronization log.`) : L(`드론들이 흩어지는 곳: ${names}. 공명 보고에서 확인하라.`, `Where the drones drift apart: ${names}. See the resonance report.`) });
  }
  logDiagnostic('info', 'gestalt.deviant', { n: r.list.length, fresh: fresh.length });
}

export function gestaltReport() {
  const sid = ctx.curSaveId, kind = kindNow();
  if (!sid || !kind) return { ok: false, kind: '', title: '', items: [] as { tag: string; text: string }[] };
  const pl = gov.planetList && (!gov.planetList.sid || gov.planetList.sid === sid) ? gov.planetList.planets : [];
  const planets = pl.map((p) => ({ p, s: planetTrouble(p).score })).filter((x) => x.s >= REPORT_MIN_SCORE).sort((a, b) => b.s - a.s).slice(0, 3)
    .map(({ p }) => ({ name: p.name, facts: { ...(p.stability !== null && p.stability < 50 ? { stability: p.stability } : {}), ...(p.amenities !== null && p.amenities < 0 ? { amenities: p.amenities } : {}), ...(p.housing !== null && p.housing < 0 ? { housing: p.housing } : {}) } }));
  const snap = gameState.last && gameState.last.sid === sid ? gameState.last : null, cv = crisisView();
  const nameOf = (idx: number) => terminal.all.find((c) => c.idx === idx)?.name || '#' + idx;
  const items = buildReport({ kind, date: ctx.gameDate || '', deviant: deviantOf(sid)?.list ?? [], planets, pledges: openPledgeList(sid), crises: cv.hostile ? (L('ko', 'en') === 'en' ? cv.namesEn : cv.names).split(/[,·]\s*/).filter(Boolean) : [], wars: (snap?.wars ?? []).map((w) => w.name).filter(Boolean).slice(0, 4), hot: hotEmotions().slice(0, 4).map((h) => ({ name: nameOf(h.idx), key: h.key })) });
  return { ok: true, kind, title: reportTitle(kind), date: ctx.gameDate || '', items };
}
export function registerGestaltReport(router: LogRouter): void {
  router.on(SLOT.GESTALT, 'gestalt-report', (m: SllmMessage) => { if (m.kind === 'STATE_BEGIN' || m.kind === 'DEVIANT' || m.kind === 'STATE_END') { try { onLine(m); } catch (e) { logDiagnostic('warn', 'gestalt.deviant_failed', { error: String(e) }); } } });
  ipcMain.handle('gestaltReport', () => gestaltReport());
}
