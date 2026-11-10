// 총독에게 행성 맡기기(2026-11-03 사용자) — 앱 쪽. 규칙: src/govpolicy.ts · 화면: ui/office-govpolicy.js(집무실 「행성 총독」 칸)
// 행성 목록: 지금 판의 자동 저장이 6달 안이면 세이브에서 읽고(게임에 묻지 않음, 2026-11-03 세이브 읽기), 아니면 총독 창과 같은 길(gov.ts refreshPlanets)로 화면을 열 때만 게임에 묻는다.
// 맡기기·거두기 때만 게임에 명령 한 번.
// 총독 말은 틀 문장뿐(LLM 없음). 짓기는 연결 모드가 직접 한다(sllm_gov_build_gen.txt, 게임 자동화를 켤 필요 없음).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { dayNo } from '../gamedate';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { gov, refreshPlanets } from './gov';
import { governorName, planetType, type Planet } from '../planets';
import { GOV_POLICIES, policyById, policyByN, recommend, temperOf, govPolicyCommand, govLine, temperLine, TEMPER_STOCK, GOV_BUFF, GOV_VETERAN_DAYS, parseGovBuild, govBuildLine, govBuildName, GOV_WHY, type GovBuild, GOV_QUOTA, govQuotaCommand, quotaLine, quotaRewardText, type QuotaEv } from '../govpolicy';

// 맡기기·거두기 기록(게임 날짜) — 숙련까지 남은 달 + 세이브보다 새로 바꾼 방침을 덮어쓸 때. sllm_govpol.json { 세이브: { 행성 번호: { p: 방침 번호(0 = 거둠), d: 날짜 } } }
// (2026-11-03 첫 판은 값이 날짜 문자열 하나였다 → 맡긴 날로만 읽는다)
type Rec = { p: number; d: string };
const file = () => path.join(app.getPath('userData'), 'sllm_govpol.json');
let since: Record<string, Record<string, Rec | string>> | null = null;
const sinceAll = () => { if (since) return since; try { since = JSON.parse(fs.readFileSync(file(), 'utf8')) || {}; } catch { since = {}; } return since!; };
const saveSince = () => { try { fs.writeFileSync(file(), JSON.stringify(sinceAll())); } catch { /* 다음에 */ } };
const recOf = (idx: number | undefined): Rec | null => { const v = idx ? sinceAll()[ctx.curSaveId || '']?.[String(idx)] : undefined; return typeof v === 'string' ? { p: -1, d: v } : v && typeof v === 'object' ? v : null; };
// 총독이 최근에 지은 것(2026-11-05) — 연결 모드 로그 GOVBUILD. sllm_govbuild.json { 세이브: { 행성 이름: GovBuild[](새것이 앞, 최대 BUILD_KEEP) } }
const BUILD_KEEP = 6;
const bfile = () => path.join(app.getPath('userData'), 'sllm_govbuild.json');
let builds: Record<string, Record<string, GovBuild[]>> | null = null;
const buildsAll = () => { if (builds) return builds; try { builds = JSON.parse(fs.readFileSync(bfile(), 'utf8')) || {}; } catch { builds = {}; } return builds!; };
let buildSaveT: NodeJS.Timeout | null = null;
const saveBuilds = () => { if (buildSaveT) return; buildSaveT = setTimeout(() => { buildSaveT = null; try { fs.writeFileSync(bfile(), JSON.stringify(buildsAll())); } catch { /* 다음에 */ } }, 2000); };
const buildsOf = (name: string): GovBuild[] => buildsAll()[ctx.curSaveId || '']?.[name] ?? [];
// 행성 할당량(2026-11-05) — 단계는 게임 로그 GOVQUOTA 로 따라간다. sllm_govquota.json { 세이브: { 행성 이름: Quota } }
type Quota = { on: boolean; ph: number; since: string; ev: QuotaEv; evd: string; n?: number };
const qfile = () => path.join(app.getPath('userData'), 'sllm_govquota.json');
let quotas: Record<string, Record<string, Quota>> | null = null;
const quotasAll = () => { if (quotas) return quotas; try { quotas = JSON.parse(fs.readFileSync(qfile(), 'utf8')) || {}; } catch { quotas = {}; } return quotas!; };
const saveQuotas = () => { try { fs.writeFileSync(qfile(), JSON.stringify(quotasAll())); } catch { /* 다음에 */ } };
const quotaOf = (name: string): Quota | null => quotasAll()[ctx.curSaveId || '']?.[name] ?? null;
const setQuota = (name: string, q: Quota) => { const all = quotasAll(); (all[ctx.curSaveId || ''] ??= {})[name] = q; saveQuotas(); };
const QUOTA_FRESH_DAYS = 400; // 할당량 소식은 이만큼 지나면 총독 말 앞에 붙이지 않는다
function quotaView(p: Planet, g: string, ko: boolean) {
  const q = quotaOf(p.name), cur = policyByN(p.gpol), r = cur ? quotaRewardText(cur.id, ko) : '';
  const now = dayNo(ctx.gameDate || ''), since = q ? dayNo(q.since) : null, evd = q ? dayNo(q.evd) : null;
  const left = q && q.on && since !== null && now !== null ? Math.max(0, GOV_QUOTA.months[q.ph] - Math.floor((now - since) / 30)) : null;
  const fresh = q && evd !== null && now !== null && now - evd <= QUOTA_FRESH_DAYS;
  return { on: !!(q && q.on), ph: q && q.on ? q.ph : null, left, reward: r,
    note: q && fresh ? quotaLine(q.ev, ko, { g, p: p.name, r, n: q.n }, q.evd) : '' };
}
/** 지금 화면이 쓰는 행성 목록(세이브 또는 게임) — 맡기기 때 행성을 찾는 데 쓴다. */
let planetsNow: Planet[] = [];
/** 세이브가 이만큼(일)보다 오래되면 게임에 묻는다. */
export const SAVE_FRESH_DAYS = 180;
/** 세이브 요약 → 행성 목록(총독 화면용). 세이브가 없거나 오래됐거나, 행성 번호가 아직 없는 행성이 있으면 null. */
function planetsFromSave(): { planets: Planet[]; date: string } | null {
  const snap = ctx.flagProv.saveSnap(); if (!snap || !snap.planets.length) return null;
  const a = dayNo(snap.date), b = dayNo(ctx.gameDate || ''); if (a === null || b === null || b - a > SAVE_FRESH_DAYS || b < a) return null;
  if (snap.planets.some((p) => !p.idx)) return null; // 새 행성은 연결 모드가 아직 번호를 안 붙였다 → 게임에 한 번 묻는다
  const planets: Planet[] = snap.planets.map((p) => {
    const r = recOf(p.idx!), rd = r ? dayNo(r.d) : null, newer = r && r.p >= 0 && rd !== null && rd > a; // 세이브 뒤에 바꾼 방침은 앱 기록이 이긴다
    // 편의·주거: 세이브도 게임 로그처럼 100배 값
    return { name: p.name, pops: p.pops, stability: p.stability, amenities: p.freeAmenities === null ? null : p.freeAmenities / 100, housing: p.freeHousing === null ? null : p.freeHousing / 100, capital: p.capital, pc: 0, className: p.clsName, governor: p.governorName || null, des: p.des, idx: p.idx!, gpol: newer ? r!.p : p.gpol, gvet: newer ? false : p.gvet };
  });
  return { planets, date: snap.date };
}

const polName = (id: string | undefined): string => { const p = id ? policyById(id) : undefined; return p ? L(p.ko, p.en) : ''; };
const isKo = (): boolean => L('ko', 'en') === 'ko';

function planetView(p: Planet) {
  const g = governorName(p), t = temperOf(g), cur = policyByN(p.gpol), rec = recommend(p.des, p.capital), ko = isKo();
  const rc = cur ? recOf(p.idx) : null, d0 = rc && rc.p !== 0 ? rc.d : undefined, a = d0 ? dayNo(d0) : null, b = dayNo(ctx.gameDate || '');
  const days = a !== null && b !== null ? Math.max(0, b - a) : null, veteran = !!(cur && p.gvet);
  const v = { g, p: p.name, pol: polName(cur ? cur.id : rec[0]) };
  const done = buildsOf(p.name), last = done[0], quota = quotaView(p, g, ko);
  return {
    idx: p.idx ?? null, name: p.name, type: planetType(p), governor: g, hasGovernor: !!(p.governor && p.governor.trim()), capital: p.capital,
    policy: cur ? cur.id : null, rec, temper: t, stock: TEMPER_STOCK[t],
    quota, say: cur ? (quota.note ? quota.note + ' ' : '') + (last ? govBuildLine(last, ko) + ' ' : '') + govLine(veteran ? 'veteran' : 'report', ko, v) : govLine('propose', ko, v), temperSay: temperLine(t, ko),
    recent: done.map((b) => ({ what: govBuildName(b, ko), why: GOV_WHY[b.why][ko ? 0 : 1], urgent: b.why !== 'mandate', ok: b.ok, d: b.d })),
    veteran, since: d0 ?? null, toVeteran: cur && !veteran && days !== null ? Math.max(0, Math.ceil((GOV_VETERAN_DAYS - days) / 30)) : null,
  };
}

export function registerGovPolicy(router: LogRouter): void {
  router.on(SLOT.GOVBUILD, 'govpol:build', (m: SllmMessage) => {
    if (m.kind !== 'GOVBUILD' || !ctx.curSaveId) return;
    const b = parseGovBuild(m.kv, ctx.gameDate || ''); if (!b) return;
    const all = buildsAll(), mine = (all[ctx.curSaveId] ??= {}), list = (mine[b.pl] ??= []);
    list.unshift(b); if (list.length > BUILD_KEEP) list.length = BUILD_KEEP; saveBuilds();
  });
  router.on(SLOT.GOVQUOTA, 'govpol:quota', (m: SllmMessage) => {
    if (m.kind !== 'GOVQUOTA') return;
    if (m.kv.req) { terminalReplies.get('GOVQUOTA:' + m.kv.req)?.(m); return; }
    const pl = (m.kv.pl || '').trim(), ev = m.kv.ev as QuotaEv; if (!pl || !ctx.curSaveId || !['phase', 'strain', 'done', 'fail', 'cancel'].includes(ev)) return;
    const d = ctx.gameDate || '', q = quotaOf(pl) ?? { on: true, ph: 0, since: d, ev, evd: d };
    if (ev === 'phase') { const n = Number(m.kv.ph); setQuota(pl, { on: true, ph: Number.isInteger(n) && n >= 0 && n <= 3 ? n : q.ph + 1, since: d, ev, evd: d, n }); }
    else if (ev === 'strain') setQuota(pl, { ...q, ev, evd: d, n: q.ph });
    else setQuota(pl, { on: false, ph: q.ph, since: q.since, ev, evd: d });
  });
  ipcMain.handle('govQuotaSet', async (_e, a: { idx?: unknown; on?: unknown }) => {
    try {
      const sid = ctx.curSaveId, idx = Number(a?.idx), on = !!a?.on;
      if (!sid) throw new Error(L('세이브를 불러온 뒤에 할 수 있습니다.', 'Load a save first.'));
      const p = planetsNow.find((x) => x.idx === idx) ?? gov.planetList?.planets.find((x) => x.idx === idx); if (!p) throw new Error(L('행성 목록을 다시 읽어 주세요.', 'Reload the planet list.'));
      if (on && !policyByN(p.gpol)) throw new Error(L('방침을 맡긴 행성에만 할당량을 매길 수 있습니다.', 'Only planets with a mandate can take a quota.'));
      if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      const req = ++link.reqCounter, m = await terminalRequest(govQuotaCommand(req, sid, idx, on), 'GOVQUOTA', req);
      if (m.kv.status !== 'applied') throw new Error(on ? L('게임이 할당량을 받지 못했습니다(방침이 없거나 이미 할당량이 있음).', 'The game refused the quota (no mandate, or one is already running).') : L('이 행성에는 할당량이 없습니다.', 'This planet has no quota.'));
      const d = ctx.gameDate || ''; setQuota(p.name, on ? { on: true, ph: 0, since: d, ev: 'start', evd: d } : { on: false, ph: 0, since: d, ev: 'withdraw', evd: d });
      return { ok: true, planet: planetView(p) };
    } catch (e) { logDiagnostic('warn', 'govpol.quota_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
  router.on(SLOT.GOVPOL, 'govpol:reply', (m: SllmMessage) => { if (m.kind === 'GOVPOL') terminalReplies.get('GOVPOL:' + m.kv.req)?.(m); });
  ipcMain.handle('govPolState', async (_e, o?: { live?: unknown }) => {
    if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 열 수 있습니다.', 'Load a save first.') };
    const fromSave = o?.live ? null : planetsFromSave(); let source: { kind: 'save' | 'game'; date: string };
    if (fromSave) { planetsNow = fromSave.planets; source = { kind: 'save', date: fromSave.date }; }
    else {
      const r = await refreshPlanets() as { list?: { planets: Planet[] }; error?: string };
      if (!r.list) return { ok: false, error: r.error || L('행성 목록을 읽지 못했습니다.', 'Could not read the planet list.') };
      planetsNow = r.list.planets; source = { kind: 'game', date: ctx.gameDate || '' };
    }
    const planets = planetsNow.map(planetView), oldMod = planets.length > 0 && planets.every((p) => p.idx === null);
    return { ok: true, oldMod, source, planets, buff: GOV_BUFF, quota: { months: GOV_QUOTA.months, prod: GOV_QUOTA.prod, stab: GOV_QUOTA.stab, done: GOV_QUOTA.done, failBelow: GOV_QUOTA.failBelow, failMonths: GOV_QUOTA.failMonths }, policies: GOV_POLICIES.map((p) => ({ id: p.id, name: L(p.ko, p.en), icon: p.icon })) };
  });
  ipcMain.handle('govPolSet', async (_e, a: { idx?: unknown; policy?: unknown }) => {
    try {
      const sid = ctx.curSaveId, idx = Number(a?.idx), pol = a?.policy == null ? null : String(a.policy);
      if (!sid) throw new Error(L('세이브를 불러온 뒤에 할 수 있습니다.', 'Load a save first.'));
      if (pol && !policyById(pol)) throw new Error(L('알 수 없는 방침입니다.', 'Unknown mandate.'));
      const p = planetsNow.find((x) => x.idx === idx) ?? gov.planetList?.planets.find((x) => x.idx === idx); if (!p) throw new Error(L('행성 목록을 다시 읽어 주세요.', 'Reload the planet list.'));
      if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 방침을 맡길 수 있습니다.', 'The game must be running to hand over a mandate.'));
      const g = governorName(p), t = temperOf(g), req = ++link.reqCounter;
      const m = await terminalRequest(govPolicyCommand(req, sid, idx, pol, t), 'GOVPOL', req);
      if (m.kv.status !== 'applied') throw new Error(L('게임이 방침을 받지 못했습니다.', 'The game did not accept the mandate.'));
      p.gpol = pol ? policyById(pol)!.n : 0; p.gvet = false; { const all = sinceAll(), m = (all[sid] ??= {}); m[String(idx)] = { p: p.gpol ?? 0, d: ctx.gameDate || '' }; saveSince(); } const ko = isKo(), v = { g, p: p.name, pol: polName(pol ?? undefined) };
      return { ok: true, planet: planetView(p), say: pol ? govLine('accept', ko, v) + ' ' + temperLine(t, ko) : govLine('recall', ko, v) };
    } catch (e) { logDiagnostic('warn', 'govpol.set_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
}
