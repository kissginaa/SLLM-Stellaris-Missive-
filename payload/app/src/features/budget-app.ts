// 예산 회의(앱 쪽, 2026-11-04). 규칙·문장: src/budget.ts. 게임: tester-mod/common/scripted_effects/sllm_budget.txt. 화면: ui/office-budget.js(집무실 「예산 회의」).
// 로그 자리 BUDGET(209): BUDCTX(소집 때 월 수입 읽기) · BUDSET(집행·중단 응답) · BUDSTOP(국고 부족으로 멈춤) · BUDEND(기간 끝).
// 「슈뢰딩거」: 게임 명령은 소집(읽기 1번)·확정(승인한 항목마다 1번)·중단만. 매달 차감은 게임 스크립트가 스스로 한다. LLM 은 소집 때 1번.
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
import { monthsBetween } from '../letters';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { peopleOf } from './people-app';
import { personaPeek, personaNote } from './persona-app';
import { cabMembersFrom, DOMAIN_KO, type Domain } from '../cabinet-meeting';
import { type BudRequest, type BudTier, type BudMember, BUD, CODE_DOMAIN, itemById, itemLabel, ctxCommand, applyCommand, cancelCommand, parseCtx, gnum, navalTight, budMessages, buildRequests, budFact } from '../budget';

interface Active { lid: number; name: string; item: string; tier: BudTier; cost: number; start: string; until: string }
interface Session { date: string; income: number; stock: number; war: boolean; requests: BudRequest[] }
interface Save { last?: string; directives: Record<string, string>; active: Partial<Record<Domain, Active>>; session?: Session; log: Array<{ date: string; text: string }> }
interface Store { saves: Record<string, Save> }
const file = () => path.join(app.getPath('userData'), 'sllm_budget.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), act: Save['active'] = {};
    for (const [d, a] of Object.entries(obj(x.active))) { const o = obj(a); if (Object.values(CODE_DOMAIN).includes(d as Domain) && typeof o.item === 'string' && itemById(o.item)) act[d as Domain] = o as unknown as Active; }
    saves[safeKey(sid)] = {
      ...(typeof x.last === 'string' ? { last: x.last } : {}),
      directives: Object.fromEntries(Object.entries(obj(x.directives)).filter(([, t]) => typeof t === 'string').slice(0, 20)) as Record<string, string>,
      active: act, log: Array.isArray(x.log) ? (x.log as Save['log']).filter((q) => q && typeof q.text === 'string').slice(-BUD.keep) : [],
    };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'budget', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; const out: Store = { saves: {} }; for (const [k, v] of Object.entries(all().saves)) { const { session: _s, ...rest } = v; out.saves[k] = rest as Save; } fs.writeFileSync(tmp, JSON.stringify(out), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'budget', error: e }); } }, 1500); }
const entry = (sid: string): Save => (all().saves[safeKey(sid)] ??= { directives: {}, active: {}, log: [] });
const note = (s: Save, text: string) => { s.log = [...s.log, { date: ctx.gameDate || '', text }].slice(-BUD.keep); };
const addDays = (date: string, days: number) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(date || ''); if (!m) return ''; let n = Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + Number(m[3]) - 1 + days; const y = Math.floor(n / 360); n -= y * 360; const mo = Math.floor(n / 30) + 1, d = n % 30 + 1; return `${y}.${String(mo).padStart(2, '0')}.${String(d).padStart(2, '0')}`; };
let busy = false;

function members(sid: string): BudMember[] {
  const s = entry(sid);
  return cabMembersFrom(peopleOf(sid)).map((m) => { const p = personaPeek(sid, 'p:' + m.lid); return { lid: m.lid, name: m.name, domain: m.domain, title: m.title, ...(p?.persona ? { persona: p.persona } : {}), ...(typeof p?.trust === 'number' ? { trust: p.trust } : {}), ...(s.directives[String(m.lid)] ? { directive: s.directives[String(m.lid)] } : {}) }; });
}
function coolUntil(s: Save): string { return s.last ? addDays(s.last, BUD.days) : ''; }
function ready(s: Save): boolean { return !s.last || monthsBetween(s.last, ctx.gameDate || '') >= BUD.coolMonths; }

export function budgetView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const s = entry(sid), ms = members(sid), ss = s.session;
  return {
    sid, running: ctx.gameRunning, busy, ready: ready(s), until: coolUntil(s), last: s.last ?? '',
    members: ms.map((m) => ({ lid: m.lid, name: m.name, title: L(m.title[0], m.title[1]), domain: L(...DOMAIN_KO[m.domain]), directive: m.directive ?? '' })),
    active: (Object.entries(s.active) as Array<[Domain, Active]>).map(([d, a]) => ({ domain: d, field: L(...DOMAIN_KO[d]), name: a.name, label: itemLabel(itemById(a.item)!, a.tier), cost: a.cost, until: a.until, cut: a.tier === 'h' })),
    session: ss ? { date: ss.date, income: ss.income, stock: ss.stock, war: ss.war, requests: ss.requests.map((r) => ({ lid: r.lid, name: r.name, field: L(...DOMAIN_KO[r.domain]), domain: r.domain, say: r.say, full: itemLabel(itemById(r.item)!, 'f'), halfLabel: itemLabel(itemById(r.item)!, 'h'), cost: r.cost, half: r.half, choice: r.choice ?? '', replaces: !!s.active[r.domain] })) } : null,
    log: s.log.slice(-12).reverse(),
  };
}
function push(): void { try { const v = budgetView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('budgetUpdate', v); } catch { /* 창 없음 */ } }

function onStop(m: SllmMessage, ended: boolean, halt = false): void {
  const sid = ctx.curSaveId; if (!sid) return; const d = CODE_DOMAIN[Math.round(gnum(m.kv.d))]; if (!d) return;
  const s = entry(sid), a = s.active[d]; if (!a) return; delete s.active[d];
  const it = itemById(a.item)!, lab = L(it.ko, it.en);
  if (ended) note(s, L(`${a.name}의 「${lab}」 예산이 1년 집행을 마쳤다.`, `${a.name}'s "${lab}" budget finished its year.`));
  else if (halt) note(s, L(`게임 안 비상 정지 칙령으로 ${a.name}의 「${lab}」 예산 집행을 멈췄다.`, `The in-game emergency edict suspended ${a.name}'s "${lab}" budget.`));
  else {
    note(s, L(`국고가 모자라 ${a.name}의 「${lab}」 예산 집행이 멈췄다.`, `The treasury ran short; ${a.name}'s "${lab}" budget was halted.`));
    ctx.notify({ kind: 'office', title: L('예산 집행 중단', 'Budget halted'), body: L(`${a.name}: 국고가 바닥나 「${lab}」 예산을 더는 집행할 수 없습니다.`, `${a.name}: The treasury is empty; we can no longer fund "${lab}".`) });
    try { personaNote(sid, 'p:' + a.lid, `My "${it.en}" budget was halted because the treasury ran out of energy.`, -1); } catch { /* 인물 없음 */ }
  }
  save(); push();
}

export function registerBudget(router: LogRouter): void {
  router.on(SLOT.BUDGET, 'budget', (m: SllmMessage) => {
    if (m.kind === 'BUDCTX' || m.kind === 'BUDSET') { terminalReplies.get(m.kind + ':' + String(Math.round(gnum(m.kv.req))))?.(m); return; }
    if (m.kind === 'BUDSTOP') onStop(m, false, String(m.kv.halt ?? '') === '1'); else if (m.kind === 'BUDEND') onStop(m, true); // halt=1: 게임 안 비상 정지 칙령(2026-11-04)
  });
  registerSecFacts({ id: 'Budgets', kw: ['예산', '장관', '연구', '투자', 'budget', 'minister', 'research', 'funding'], facts: (sid) => (sid === ctx.curSaveId ? budFact(Object.values(entry(sid).active).filter(Boolean) as Active[]) : []) });
  ipcMain.handle('budgetState', async () => budgetView());
  ipcMain.handle('budgetDirective', async (_e, lidIn: unknown, textIn: unknown) => {
    const sid = ctx.curSaveId || ''; if (!sid) return { ok: false, state: budgetView() };
    const s = entry(sid), lid = String(Number(lidIn)), t = String(textIn ?? '').trim().slice(0, 200);
    if (t) s.directives[lid] = t; else delete s.directives[lid]; save(); push(); return { ok: true, state: budgetView() };
  });
  // 소집: 월 수입 읽기(게임 1번) → 장관 요청(LLM 1번)
  ipcMain.handle('budgetConvene', async () => {
    const sid = ctx.curSaveId || '';
    if (!sid || !ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: budgetView() };
    const s = entry(sid); if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: budgetView() };
    if (s.session) return { ok: true, state: budgetView() };
    if (!ready(s)) return { ok: false, error: L(`예산 회의는 1년에 한 번입니다(${coolUntil(s)}부터 다시).`, `The budget meeting is held once a year (again from ${coolUntil(s)}).`), state: budgetView() };
    const ms = members(sid); if (!ms.length) return { ok: false, error: L('평의회에 장관이 없어 예산 회의를 열 수 없습니다.', 'There are no ministers on the council.'), state: budgetView() };
    busy = true; push();
    try {
      const req = ++link.reqCounter, c = parseCtx(await terminalRequest(ctxCommand(req), 'BUDCTX', req));
      let raw: string | null = null;
      try { raw = await ctx.ai.chat(budMessages({ empire: ctx.playerName || 'our empire', date: ctx.gameDate || '', war: c.war, income: c.inc, members: ms, active: (Object.values(s.active).filter(Boolean) as Active[]).map((a) => `${itemById(a.item)?.en} until ${a.until}`), naval: c.naval }), { purpose: 'budget-meeting', json: true, maxTokens: 1800 }); }
      catch (err) { logDiagnostic('warn', 'budget.ai_failed', { error: String(err) }); }
      s.session = { date: ctx.gameDate || '', income: c.inc, stock: c.stock, war: c.war, requests: buildRequests(raw, ms, c.war, c.inc, navalTight(c.naval)) };
      push(); return { ok: true, state: budgetView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: budgetView() }; }
    finally { busy = false; push(); }
  });
  ipcMain.handle('budgetDecide', async (_e, lidIn: unknown, choice: unknown) => {
    const sid = ctx.curSaveId || '', s = sid ? entry(sid) : null, r = s?.session?.requests.find((x) => x.lid === Number(lidIn));
    if (!r || !['full', 'half', 'no'].includes(String(choice))) return { ok: false, state: budgetView() };
    r.choice = choice as BudRequest['choice'];
    for (const o of s!.session!.requests) if (o !== r && o.domain === r.domain && r.choice !== 'no' && o.choice && o.choice !== 'no') o.choice = 'no'; // 분야마다 하나만
    push(); return { ok: true, state: budgetView() };
  });
  // 확정: 승인한 항목마다 게임에 1번 → 집행 기록·장관 신뢰
  ipcMain.handle('budgetConfirm', async () => {
    const sid = ctx.curSaveId || '', s = sid ? entry(sid) : null, ss = s?.session;
    if (!s || !ss) return { ok: false, error: L('열린 예산 회의가 없습니다.', 'No budget meeting is open.'), state: budgetView() };
    if (ss.requests.some((r) => !r.choice)) return { ok: false, error: L('모든 요청에 답해 주세요.', 'Answer every request first.'), state: budgetView() };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: budgetView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: budgetView() };
    busy = true; push();
    const date = ctx.gameDate || '', done: string[] = [], failed: string[] = [];
    try {
      for (const r of ss.requests) {
        const it = itemById(r.item)!, key = 'p:' + r.lid;
        if (r.choice === 'no') { try { personaNote(sid, key, `At the budget meeting the ruler turned down my request for "${it.en}".`, -3); } catch { /* 인물 없음 */ } continue; }
        const tier: BudTier = r.choice === 'half' ? 'h' : 'f', cost = tier === 'h' ? r.half : r.cost;
        const req = ++link.reqCounter;
        let st = 'failed'; try { st = (await terminalRequest(applyCommand(req, sid, r.item, tier, cost), 'BUDSET', req)).kv.status || 'failed'; } catch (err) { logDiagnostic('warn', 'budget.apply_failed', { error: String(err) }); }
        if (st !== 'applied') { failed.push(r.name); continue; }
        s.active[r.domain] = { lid: r.lid, name: r.name, item: r.item, tier, cost, start: date, until: addDays(date, BUD.days) };
        done.push(L(`${r.name} 「${itemLabel(it, tier)}」(월 ${cost})`, `${r.name} "${itemLabel(it, tier)}" (${cost}/month)`));
        try { personaNote(sid, key, tier === 'f' ? `At the budget meeting the ruler fully funded my request for "${it.en}".` : `At the budget meeting the ruler funded my "${it.en}" request at half.`, tier === 'f' ? 4 : 0); } catch { /* 인물 없음 */ }
      }
      s.last = ss.date; delete s.session;
      note(s, done.length ? L(`예산 회의: ${done.join(', ')}`, `Budget meeting: ${done.join(', ')}`) : L('예산 회의: 승인한 예산이 없다.', 'Budget meeting: nothing was funded.'));
      if (done.length) chronNoteWorld(L(`${date} 예산 회의에서 장관 예산 ${done.length}건이 승인되었다.`, `${date} ${done.length} ministerial budget(s) were approved at the budget meeting.`), true);
      save();
      return failed.length ? { ok: false, error: L(`게임이 확인해 주지 않은 예산이 있습니다: ${failed.join(', ')}. 모드가 최신인지 확인해 주세요.`, `Some budgets were not confirmed by the game: ${failed.join(', ')}. Check that the mod is up to date.`), state: budgetView() } : { ok: true, state: budgetView() };
    } finally { busy = false; push(); }
  });
  ipcMain.handle('budgetCancel', async (_e, dIn: unknown) => {
    const sid = ctx.curSaveId || '', d = String(dIn) as Domain, s = sid ? entry(sid) : null, a = s?.active[d];
    if (!s || !a) return { ok: false, state: budgetView() };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: budgetView() };
    try {
      const req = ++link.reqCounter, st = (await terminalRequest(cancelCommand(req, sid, d), 'BUDSET', req)).kv.status;
      if (st !== 'applied') return { ok: false, error: L('게임이 확인해 주지 않았습니다.', 'The game did not confirm.'), state: budgetView() };
      delete s.active[d]; note(s, L(`${a.name}의 「${L(itemById(a.item)!.ko, itemById(a.item)!.en)}」 예산 집행을 중단했다.`, `Stopped ${a.name}'s "${itemById(a.item)!.en}" budget.`));
      try { personaNote(sid, 'p:' + a.lid, `The ruler cut off my "${itemById(a.item)!.en}" budget before its year was up.`, -2); } catch { /* 인물 없음 */ }
      save(); push(); return { ok: true, state: budgetView() };
    } catch (err) { return { ok: false, error: (err as Error).message, state: budgetView() }; }
  });
}
