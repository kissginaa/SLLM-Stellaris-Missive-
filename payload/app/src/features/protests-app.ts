// 시위(2026-10-23 초안): 월간 상황 묶음 안의 PROTPLANET·RIGHTS 를 받아 한 달에 한 번 판정하고(LLM 없음), 집무실 「시위」 화면에 보인다.
// 규칙: src/protests.ts(사용자 확정·제안 수치는 PROTEST). 모드: tester-mod/common/scripted_effects/sllm_probe_protest.txt, 해산 수정자 sllm_protest_dispersed.
// 대응 5가지 중 LLM 은 「대표단과 대화」에서만 부른다. 해산은 게임 명령(행성 안정도 +5, 180일), 나머지는 앱 기록과 다음 달 판정.
// 정치적 지위(시민 편 +10·강경 −5)는 politics-app 장부에, 총독 신뢰(∓5)는 인물 카드 신뢰(persona-app)에 넣는다(2026-10-23).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { hoiLink } from '../app/hoi-hooks'; // 외세 개입(2026-10-28)
import { courtLink } from '../app/court-hooks'; // 음모의 반동·독립 모의(2026-10-28 정치)
import { terminalRequest, terminalReplies } from './terminal';
import { refreshPlanets } from './gov';
import { onGameSnapshot } from './gamestate-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { gameName } from './namegen-app';
import { peopleOf } from './people-app';
import { recordProtestStance } from './politics-app';
import type { StateSnapshot } from '../gamestate';
import { type ProtestBook, type Protest, type ProtestScan, type PlanetSnap, type Response, ProtestScanCollector, fillStaleShares, type DemandKind, type Ethic, protestMonth, respond, dispersalCommand, delegateMessages, addTalk, sanitizeProtestBook, emptyProtestBook, openProtests, governorStandingHint, DEMAND_LABEL, ETHIC_LABEL, PROTEST } from '../protests';

const L = pick;
const dir = () => path.join(app.getPath('userData'), 'protests');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, ProtestBook>();
function bookOf(sid: string): ProtestBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeProtestBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'protests', error: e }); b = emptyProtestBook(sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'protests', error: e }); }
}
const scans = new ProtestScanCollector();
let lastScan: ProtestScan | null = null;
const busy = new Set<string>();

/** 외세 개입: 그 이념 파벌이 20% 이상인 행성마다 대기 원인 하나(1년). 근거는 대표단 대화(AI)에 그대로 넘어간다 — 배후가 드러나기 전에는 「의혹」. */
const FOREIGN_DEMAND: Record<string, DemandKind> = { militarist: 'stop_war_humiliation', pacifist: 'end_war', authoritarian: 'order', egalitarian: 'living_conditions', xenophile: 'living_conditions', xenophobe: 'limit_aliens', materialist: 'research', spiritualist: 'faith' };
function injectForeign(b: ProtestBook, scan: ProtestScan, date: string): void {
  const list = hoiLink.foreign(); if (!list.length || !date) return;
  b.pending ??= [];
  for (const f of list) {
    const eth = f.eth as Ethic, kind = FOREIGN_DEMAND[f.eth]; if (!kind) continue;
    for (const p of scan.planets) {
      if ((p.factionShare[eth] ?? 0) < PROTEST.minFactionShare) continue;
      const eventId = `foreign:${f.id}:${p.k}`; if (b.pending.some((c) => c.eventId === eventId)) continue;
      const text = f.revealed ? L(`외세 개입: ${f.by}이(가) 이 파벌에 몰래 자금을 대 왔다(첩보로 확인)`, `Foreign meddling: ${f.by} has been secretly funding this faction (confirmed by our spies)`) : L('외세 개입 의혹: 출처를 알 수 없는 자금이 이 파벌에 흘러든다는 소문', 'Suspected foreign meddling: rumors of untraceable money flowing to this faction');
      b.pending.push({ planetK: p.k, ethic: eth, demand: { kind, ethic: eth }, strength: 0.5, evidence: [{ key: 'foreign', text, on: date }], until: f.until, eventId });
    }
  }
}
/** 음모(정치, 2026-10-28)의 반동: 체포·추방에 반발하거나 독립 모의가 터짐 → 그 파벌이 20% 이상인 행성(독립 모의는 그 행성)마다 대기 원인. */
function injectCourt(b: ProtestBook, scan: ProtestScan, date: string): void {
  const list = courtLink.causes(); if (!list.length || !date) return;
  b.pending ??= [];
  for (const f of list) {
    const eth = f.eth as Ethic, kind = FOREIGN_DEMAND[f.eth]; if (!kind) continue;
    for (const p of scan.planets) {
      if (f.planetK ? p.k !== f.planetK : (p.factionShare[eth] ?? 0) < PROTEST.minFactionShare) continue;
      const eventId = `court:${f.id}:${p.k}`; if (b.pending.some((c) => c.eventId === eventId)) continue;
      b.pending.push({ planetK: p.k, ethic: eth, demand: { kind, ethic: eth }, strength: 0.5, evidence: [{ key: 'court', text: f.text, on: date }], until: f.until, eventId });
    }
  }
}
/** 지난 달 시위 자료의 행성(음모 판정용, 2026-10-28): 순서 k·이름·안정도·총독·총독 지지 파벌. 아직 못 받았으면 빈 목록. */
let usedPlanets: { sid: string; planets: Array<{ k: number; name: string; stability?: number; governor?: string; govEthic?: string }> } | null = null;
export function protestPlanetsNow(sid: string): Array<{ k: number; name: string; stability?: number; governor?: string; govEthic?: string }> { return usedPlanets && usedPlanets.sid === sid ? usedPlanets.planets : []; }
function delegateName(): string { const g = Math.random() < 0.5 ? 'm' : 'f'; return gameName(g) ?? L('시위 대표', 'Protest spokesperson'); } // 이름은 게임 이름 표(AI 에게 짓게 하지 않음)
function rulerName(sid: string): string { return peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? ''; }

function onSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId) return;
  const scan = lastScan && lastScan.n === snap.n ? lastScan : null; lastScan = null;
  if (!scan) return; // 옛 모드(시위 자료 없음)면 아무것도 하지 않는다 — 원인을 지어내지 않는다
  const b = bookOf(snap.sid); let seq = Object.keys(b.protests).length;
  if (!fillStaleShares(b, scan)) { save(snap.sid); return; } // 성향별 인구를 아직 한 번도 못 받은 행성이 있음(앱을 새로 켠 뒤 등) — 다음 전체 자료까지 판정하지 않는다
  injectForeign(b, scan, snap.date); // 외세 개입(2026-10-28 하츠 참고: 다른 제국이 우리 파벌을 몰래 지원)
  injectCourt(b, scan, snap.date); // 음모의 반동(2026-10-28 정치)
  usedPlanets = { sid: snap.sid, planets: scan.planets.map((p) => ({ k: p.k, name: p.name, ...(p.stability !== undefined ? { stability: p.stability } : {}), ...(p.governor ? { governor: p.governor } : {}), ...((p as PlanetSnap & { govEthic?: string }).govEthic ? { govEthic: (p as PlanetSnap & { govEthic?: string }).govEthic } : {}) })) };
  const r = protestMonth(b, snap, scan, Math.random, (k) => `pr${snap.date.replace(/\D/g, '')}k${k}n${++seq}`);
  if (r.started) {
    const p = r.started; p.delegate.name = delegateName();
    (office as { toastGo: string }).toastGo = 'protests';
    ctx.notify({ kind: 'office', title: L(`「${p.planetName}」에서 시위가 시작되었습니다`, `A protest has begun on "${p.planetName}"`), body: L(`핵심 요구: ${DEMAND_LABEL[p.demand.kind]()}. 집무실 「시위」에서 대응할 수 있습니다.`, `Core demand: ${DEMAND_LABEL[p.demand.kind]()}. Respond from the Office under "Protests".`), action: L('집무실', 'Office') });
    chronNoteWorld(L(`${snap.date} 「${p.planetName}」 시위 — ${DEMAND_LABEL[p.demand.kind]()}`, `${snap.date} Protest on "${p.planetName}" — ${DEMAND_LABEL[p.demand.kind]()}`), true);
    const hint = governorStandingHint(p); // 총독 입장 → 지역 민심(정치적 지위 장부)·통치자 신뢰(인물 카드), 시위마다 한 번(2026-10-23)
    if (hint && (p.governorStance === 'advocate' || p.governorStance === 'hardline')) { const r2 = recordProtestStance(snap.sid, { protestId: p.id, governor: hint.pid, stance: p.governorStance, planet: p.planetName, date: snap.date }); logDiagnostic('info', 'protest.governor_stance', { stance: p.governorStance, planet: p.planetName, applied: r2.changes.length, trust: r2.trustDelta }); }
  }
  if (r.tick) {
    for (const p of r.tick.resolved) chronNoteWorld(L(`${snap.date} 「${p.planetName}」 시위대의 요구가 이루어져 시위가 끝났습니다.`, `${snap.date} The protesters on "${p.planetName}" got their demand; the protest is over.`), true);
    for (const p of r.tick.broken) ctx.notify({ kind: 'office', title: L('약속 기한이 지났습니다', 'A promise deadline has passed'), body: L(`「${p.planetName}」 시위대에게 한 약속이 지켜지지 않았습니다. 불만이 남습니다.`, `The promise to the protesters on "${p.planetName}" was not kept. Resentment lingers.`), action: L('집무실', 'Office') });
  }
  save(snap.sid); pushView();
}

export function protestsView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', open: [], history: [], date: ctx.gameDate || '', gestalt: false };
  const b = bookOf(sid);
  const card = (p: Protest) => ({ id: p.id, planet: p.planetName, ethic: p.ethic, ethicLabel: p.ethic === 'any' ? L('여러 계층', 'Mixed groups') : ETHIC_LABEL[p.ethic](), demand: DEMAND_LABEL[p.demand.kind](), target: p.demand.target ?? '', intensity: p.intensity, state: p.state, startedOn: p.startedOn, endedOn: p.endedOn ?? '',
    evidence: p.evidence.map((e) => ({ on: e.on, text: e.text })), promise: p.promise ?? null, governorStance: p.governorStance ?? '', delegate: p.delegate.name ?? '', talk: (p.talk ?? []).slice(-20), sourceEvent: !!p.sourceEventId });
  const all = Object.values(b.protests).sort((a, c) => (a.startedOn < c.startedOn ? 1 : -1));
  return { sid, date: ctx.gameDate || '', open: openProtests(b).map(card), history: all.filter((p) => !openProtests(b).includes(p)).slice(0, 12).map(card), celebrations: b.celebrations.slice(-5).reverse(), promiseYears: PROTEST.promiseYears };
}
function pushView(): void { try { const v = protestsView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('protestsUpdate', v); } catch { /* 창 없음 */ } }
const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: protestsView() });

async function act(id: string, kind: string, text?: string) {
  const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
  const b = bookOf(sid), pr = b.protests[String(id)]; if (!pr) throw new Error(L('그 시위를 찾을 수 없습니다.', 'That protest could not be found.'));
  if (busy.has(pr.id)) throw new Error(L('처리 중입니다.', 'Already in progress.'));
  const today = ctx.gameDate || pr.startedOn;
  if (kind === 'disperse') {
    if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 해산 명령을 내릴 수 있습니다.', 'The game must be running to order a dispersal.'));
    busy.add(pr.id);
    try {
      // 2026-10-29 테스터 「행성을 찾지 못함」: 시위가 시작된 달의 순서 번호(planetK)는 새 식민지·잃은 행성으로 바뀐다 → 지금 행성 목록에서 이름으로 다시 찾는다.
      const pl = await refreshPlanets() as { list?: { sid: string; planets: Array<{ name: string }> }; error?: string };
      let k = pr.planetK;
      if (pl.list && (!pl.list.sid || pl.list.sid === sid)) { const i = pl.list.planets.findIndex((x) => x.name === pr.planetName); if (i < 0) throw new Error(L(`「${pr.planetName}」은(는) 지금 우리 행성 목록에 없습니다(잃었거나 이름이 바뀜).`, `"${pr.planetName}" is not in our planet list now (lost or renamed).`)); k = i + 1; pr.planetK = k; }
      const req = ++link.reqCounter, key = pr.id.replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 40);
      const reply = await terminalRequest(dispersalCommand(req, sid, k, key), 'PROTESTDISPERSE', req);
      if (reply.kv.status !== 'applied' && reply.kv.status !== 'duplicate') throw new Error(L('게임에서 그 행성을 찾지 못했습니다(행성 순서가 바뀌었을 수 있습니다).', 'The planet was not found in the game (the planet order may have changed).'));
      respond(b, pr, { kind: 'disperse', effectRequestId: String(req) }, today);
      chronNoteWorld(L(`${today} 「${pr.planetName}」 집회 해산 명령`, `${today} Rally on "${pr.planetName}" ordered dispersed`), true);
    } finally { busy.delete(pr.id); }
  } else {
    const r: Response = kind === 'promise' ? { kind: 'promise', text: String(text ?? '') } : kind === 'support' ? { kind: 'support', effectRequestId: 'player' } : kind === 'ignore' ? { kind: 'ignore' } : { kind: 'talk' };
    const res = respond(b, pr, r, today); if (!res.ok) throw new Error(res.why || L('할 수 없습니다.', 'Not possible.'));
  }
  save(sid); pushView(); return { ok: true, state: protestsView() };
}
async function talk(id: string, text: string) {
  const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.'));
  const b = bookOf(sid), pr = b.protests[String(id)]; if (!pr || !openProtests(b).includes(pr)) throw new Error(L('진행 중인 시위가 아닙니다.', 'This protest is not ongoing.'));
  const msg = String(text ?? '').trim().slice(0, 800); if (!msg) throw new Error(L('할 말을 적어 주세요.', 'Write what you want to say.'));
  if (busy.has(pr.id)) throw new Error(L('대표단이 답하는 중입니다.', 'The delegation is answering.'));
  busy.add(pr.id);
  try {
    if (!pr.delegate.name) pr.delegate.name = delegateName();
    const msgs = delegateMessages(pr, { empire: ctx.playerName, ruler: rulerName(sid), date: ctx.gameDate || '' }, msg);
    const raw = String(await ctx.ai.chat(msgs, { maxTokens: 700, purpose: 'protest-delegate' }) ?? '').trim();
    if (!raw) throw new Error(L('대표단의 답을 받지 못했습니다.', 'No reply from the delegation.'));
    if (ctx.curSaveId !== sid || !openProtests(b).includes(pr)) throw new Error(L('그 사이 상황이 바뀌었습니다.', 'The situation changed in the meantime.')); // 늦은 답은 버린다
    const today = ctx.gameDate || pr.startedOn;
    respond(b, pr, { kind: 'talk' }, today); addTalk(pr, 'ruler', msg, today); addTalk(pr, 'delegate', raw.slice(0, 1200), today);
    save(sid); pushView(); return { ok: true, state: protestsView() };
  } finally { busy.delete(pr.id); }
}

export function registerProtests(router: LogRouter): void {
  router.on(SLOT.PROTESTS, 'protests', (m: SllmMessage) => {
    if (m.kind === 'PROTESTDISPERSE') { terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); return; }
    if (m.kind === 'STATE_BEGIN' || m.kind === 'PROTPLANET' || m.kind === 'RIGHTS' || m.kind === 'STATE_END') { const s = scans.feed(m); if (s) lastScan = s; }
  });
  onGameSnapshot(onSnapshot, 'protest'); // 월간 상황이 완성되면(STATE_END 뒤) 한 달 판정
  ipcMain.handle('protestsState', () => protestsView());
  ipcMain.handle('protestAct', async (_e, id: string, kind: string, text?: string) => { try { if (!['promise', 'support', 'ignore', 'disperse'].includes(kind)) throw new Error('bad'); return await act(id, kind, text); } catch (e) { return err(e); } });
  ipcMain.handle('protestTalk', async (_e, id: string, text: string) => { try { return await talk(id, text); } catch (e) { return err(e); } });
}
