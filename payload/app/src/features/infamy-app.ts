// 악명·전쟁범죄(앱 쪽, 2026-11-04). 규칙·문장: src/infamy.ts. 게임: tester-mod/common/scripted_effects/sllm_infamy.txt · events/sllm_infamy_events.txt · events/sllm_warcrim_events.txt.
// 화면: ui/fleet-infamy.js(함대 사령부 창 「악명 · 전쟁범죄」). 로그 자리 INFAMY:
//   ATROC(범죄 한 건) · INFTIER(우리 단계 바뀜) · INFY·WCL·INFEND(악명 목록·전범 명단, 해마다/요청)
//   3단계: INFCOVER(은폐 공작 응답) · INFEXPOSE(숨은 악명 폭로) · WCMARK(우리 제독 전범 표식) · WCDEMAND(전범 인도 요구) · WCSET(답 응답)
// 알리는 곳: 알림 · 피해국/가해국 연대기(그 제국과의 외교 대화에 들어감) · 행성 말살·폭로·인도 거부는 은하 뉴스 · 피해 AI 의 외교 노선 · 외교 대화 프롬프트(infamy-hooks) · 비서.
// LLM: 폭로 기사(은하 언론) · 전범 인도 요구 서신(요구한 제국 통치자). 실패하면 틀 문장.
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
import { terminalRequest, terminalReplies } from './terminal';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { temperPush } from '../app/temper-hooks';
import { setInfamyHooks } from '../app/infamy-hooks';
import {
  INF, type Crime, type CrimeKind, tierOf, tierName, tierEffect, kindName, addCrime, crimeLine, tierChangeText, victimChron, attackerChron, talkLine, secLines, readCommand, num, dayOf,
  COVER, exposeChance, coverCommand, coverResult, type WcAnswer, wcCommand, wcResultText, pickSource, exposeMessages, exposeFallback, demandMessages, demandFallback, parseJsonObj,
} from '../infamy';

interface Emp { name: string; inf: number; tier: number }
interface Demand { id: number; tid: number; them: string; why: 'war' | 'exposed'; date: string; letter: string; n: number; state: 'pending' | WcAnswer | 'gone'; result?: string }
interface Art { date: string; headline: string; body: string }
interface Save { inf: number; tier: number; date: string; log: Crime[]; empires: Record<string, Emp>; hid: number; coverAt: string; criminals: string[]; demands: Demand[]; articles: Art[] }
interface Store { saves: Record<string, Save> }
const file = () => path.join(app.getPath('userData'), 'sllm_infamy.json');
let store: Store | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const strs = (v: unknown, n: number, len = 80) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => String(x).slice(0, len)).slice(0, n) : []);
function sanitize(v: unknown): Store {
  const saves: Store['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), emp: Save['empires'] = {};
    for (const [k, a] of Object.entries(obj(x.empires)).slice(0, 200)) { const o = obj(a); emp[k] = { name: String(o.name ?? '').slice(0, 80), inf: num(o.inf), tier: num(o.tier) }; }
    const log = Array.isArray(x.log) ? (x.log as Crime[]).filter((c) => c && typeof c === 'object' && [1, 2, 3, 4, 5].includes(Number(c.k))).map((c) => ({ k: Number(c.k) as CrimeKind, by: num(c.by), byName: String(c.byName ?? '').slice(0, 80), byMe: !!c.byMe, vic: num(c.vic), vicName: String(c.vicName ?? '').slice(0, 80), vicMe: !!c.vicMe, place: String(c.place ?? '').slice(0, 80), date: String(c.date ?? ''), first: String(c.first ?? c.date ?? ''), count: Math.max(1, num(c.count)), inf: num(c.inf), covered: !!c.covered, exposed: !!c.exposed })).slice(-INF.keep) : [];
    const demands = Array.isArray(x.demands) ? (x.demands as Demand[]).filter((d) => d && typeof d === 'object').map((d) => ({ id: num(d.id), tid: num(d.tid), them: String(d.them ?? '').slice(0, 80), why: (d.why === 'exposed' ? 'exposed' : 'war') as Demand['why'], date: String(d.date ?? ''), letter: String(d.letter ?? '').slice(0, 2000), n: num(d.n), state: (['pending', 'hand', 'trial', 'refuse', 'gone'].includes(String(d.state)) ? d.state : 'gone') as Demand['state'], result: d.result ? String(d.result).slice(0, 400) : undefined })).slice(-6) : [];
    const articles = Array.isArray(x.articles) ? (x.articles as Art[]).filter((a) => a && typeof a.headline === 'string').map((a) => ({ date: String(a.date ?? ''), headline: String(a.headline).slice(0, 200), body: String(a.body ?? '').slice(0, 1500) })).slice(-8) : [];
    saves[safeKey(sid)] = { inf: num(x.inf), tier: num(x.tier), date: String(x.date ?? ''), log, empires: emp, hid: num(x.hid), coverAt: String(x.coverAt ?? ''), criminals: strs(x.criminals, 30), demands, articles };
  }
  return { saves };
}
function all(): Store { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'infamy', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'infamy', error: e }); } }, 1500); }
const entry = (sid: string): Save => (all().saves[safeKey(sid)] ??= { inf: 0, tier: 0, date: '', log: [], empires: {}, hid: 0, coverAt: '', criminals: [], demands: [], articles: [] });
const usName = () => ctx.playerName || L('우리 제국', 'Our empire');
const sidOf = (m: SllmMessage) => String(m.kv.sid ?? '').replace(/[^\d]/g, '');
const ready = () => !!ctx.curSaveId && ctx.gameRunning && link.sessionReady;
let busy = false;
/** 은폐 공작을 다시 할 수 있기까지 남은 날(대략). */
const coverWait = (s: Save) => (s.coverAt ? Math.max(0, COVER.cooldownDays - (dayOf(ctx.gameDate || s.date) - dayOf(s.coverAt))) : 0);

export function infamyView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const s = entry(sid), us = usName();
  const line = (c: Crime) => ({ k: c.k, kind: kindName(c.k), text: crimeLine(c, us), date: c.date, first: c.first, count: c.count, place: c.place, byName: c.byMe ? us : c.byName, vicName: c.vicMe ? us : c.vicName, covered: !!c.covered, exposed: !!c.exposed });
  return {
    sid, running: ctx.gameRunning, busy, inf: Math.round(s.inf * 10) / 10, tier: s.tier, tierName: tierName(s.tier), effect: tierEffect(s.tier), next: INF.tiers.find((t) => t > s.inf) ?? null, date: s.date, decay: INF.decay,
    hid: Math.round(s.hid * 10) / 10, chance: exposeChance(s.hid), cover: { influence: COVER.influence, energy: COVER.energy, max: COVER.max, waitDays: coverWait(s) },
    criminals: s.criminals.slice(0, 20),
    demands: s.demands.slice().reverse().map((d) => ({ id: d.id, them: d.them, why: d.why, date: d.date, letter: d.letter, n: d.n, state: d.state, result: d.result || '' })),
    articles: s.articles.slice(-4).reverse(),
    mine: s.log.filter((c) => c.byMe).slice(-20).reverse().map(line),
    against: s.log.filter((c) => c.vicMe).slice(-12).reverse().map(line),
    others: s.log.filter((c) => !c.byMe && !c.vicMe).slice(-12).reverse().map(line),
    ranking: Object.entries(s.empires).filter(([, e]) => e.inf > 0).sort((a, b) => b[1].inf - a[1].inf).slice(0, 12).map(([idx, e]) => ({ idx: Number(idx), name: e.name, inf: Math.round(e.inf), tier: tierOf(e.inf), tierName: tierName(tierOf(e.inf)) })),
  };
}
function push(): void { try { const v = infamyView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('infamyUpdate', v); } catch { /* 창 없음 */ } }

function onCrime(m: SllmMessage): void {
  const sid = sidOf(m); if (!sid || sid !== ctx.curSaveId) return;
  const k = Math.round(num(m.kv.k)) as CrimeKind; if (![1, 2, 3, 4, 5].includes(k)) return;
  const s = entry(sid), date = String(m.kv.date ?? ctx.gameDate ?? '');
  const c: Crime = { k, by: Math.round(num(m.kv.by)), byName: String(m.kv.byname ?? '').slice(0, 80), byMe: num(m.kv.byme) === 1, vic: Math.round(num(m.kv.vic)), vicName: String(m.kv.vicname ?? '').slice(0, 80), vicMe: num(m.kv.vicme) === 1, place: String(m.kv.place ?? '').slice(0, 80), date, first: date, count: 1, inf: num(m.kv.inf) };
  if (c.byMe && c.vicMe) return; // 자기 행성(반란 진압 등)은 범죄로 치지 않음
  const r = addCrime(s.log, c); s.log = r.log;
  if (c.byMe) { s.inf = c.inf; s.date = date; } else if (c.by > 0) s.empires[String(c.by)] = { name: c.byName || s.empires[String(c.by)]?.name || '', inf: c.inf, tier: tierOf(c.inf) };
  save(); push();
  if (r.merged) return; // 이어지는 폭격은 처음 한 번만 알린다
  const us = usName();
  if (c.byMe) {
    ctx.notify({ kind: 'fleet', title: L(`전쟁범죄 기록: ${kindName(k)}`, `War crime recorded: ${kindName(k)}`), body: L(`${c.place ? c.place + ' — ' : ''}은하가 지켜보고 있습니다. 악명 ${Math.round(c.inf)}/100(${tierName(tierOf(c.inf))}).`, `${c.place ? c.place + ' — ' : ''}the galaxy is watching. Infamy ${Math.round(c.inf)}/100 (${tierName(tierOf(c.inf))}).`), action: L('함대 사령부', 'Fleet Command') });
    if (c.vic > 0 && k <= 3) { chronNote(c.vic, victimChron(c, us)); temperPush(c.vic, k === 3 ? -25 : -10, ['우리 백성을 학살함', 'massacred our people']); }
    if (k === 3) chronNoteWorld(L(`${us}, ${c.vicName || '이웃 제국'}의 식민지 ${c.place}을(를) 폭격으로 말살`, `${us} annihilates ${c.vicName || 'a neighbor'}'s colony ${c.place} by bombardment`), true);
  } else if (c.vicMe) {
    ctx.notify({ kind: 'fleet', title: L(`${c.byName}의 전쟁범죄`, `War crime by ${c.byName}`), body: L(`${c.byName}이(가) 우리 행성 ${c.place}에 ${kindName(k)}을(를) 가하고 있습니다.`, `${c.byName} is committing ${kindName(k).toLowerCase()} on our world ${c.place}.`) });
    if (c.by > 0) chronNote(c.by, L(`${c.byName}이(가) ${attackerChron(c)}`, `${c.byName} ${attackerChron(c)}`));
    if (k === 3) chronNoteWorld(L(`${c.byName}, ${us}의 식민지 ${c.place}을(를) 폭격으로 말살`, `${c.byName} annihilates ${us}'s colony ${c.place} by bombardment`), true);
  } else if (k === 3) {
    chronNoteWorld(L(`${c.byName}, ${c.vicName || '이웃 제국'}의 식민지 ${c.place}을(를) 폭격으로 말살`, `${c.byName} annihilates ${c.vicName || 'a neighbor'}'s colony ${c.place} by bombardment`), true);
  }
}

// ---- 3단계: 폭로 · 인도 요구 ----
let demandSeq = 0;
async function writeLetter(sid: string, d: Demand): Promise<void> {
  const s = entry(sid), us = usName();
  try {
    const raw = await ctx.ai.chat(demandMessages({ them: d.them, us, against: s.log.filter((c) => c.byMe && c.vic === d.tid), criminals: s.criminals, why: d.why }), { purpose: 'infamy.demand', maxTokens: 700 });
    const j = parseJsonObj(raw), t = j ? String(j.letter ?? '').trim() : ''; if (t) d.letter = t.slice(0, 2000);
  } catch { /* 틀 문장 유지 */ }
  save(); push();
}
function makeDemand(sid: string, tid: number, them: string, why: Demand['why'], n: number, date: string): void {
  const s = entry(sid); if (!(tid > 0)) return;
  if (s.demands.some((d) => d.tid === tid && d.state === 'pending')) return;
  const d: Demand = { id: Date.now() * 10 + (demandSeq++ % 10), tid, them: them || s.empires[String(tid)]?.name || `#${tid}`, why, date, letter: demandFallback(them, usName(), s.criminals), n, state: 'pending' };
  s.demands = [...s.demands, d].slice(-6); save(); push();
  ctx.notify({ kind: 'letter', title: L(`전범 인도 요구 · ${d.them}`, `War criminals demanded · ${d.them}`), body: L(`${d.them}이(가) 우리 지휘관 ${n || s.criminals.length}명을 전범으로 넘기라고 요구합니다. 함대 사령부 「악명 · 전쟁범죄」에서 답할 수 있습니다.`, `${d.them} demands that we hand over ${n || s.criminals.length} commander(s) as war criminals. Answer under Infamy · war crimes in Fleet Command.`), action: L('함대 사령부', 'Fleet Command') });
  chronNote(tid, L(`${usName()}에 전범 인도를 요구했다`, `demanded that ${usName()} hand over its war criminals`));
  void writeLetter(sid, d);
}
async function onExpose(sid: string, ex: number, inf: number, date: string): Promise<void> {
  const s = entry(sid), us = usName();
  const shown = s.log.filter((c) => c.byMe && c.covered);
  for (const c of shown) { c.covered = false; c.exposed = true; }
  s.inf = inf; s.hid = 0; s.date = date || s.date; save(); push();
  let art = exposeFallback(us, shown);
  try { const j = parseJsonObj(await ctx.ai.chat(exposeMessages(us, shown, ex, pickSource()), { purpose: 'infamy.expose', maxTokens: 600 })); const hl = j ? String(j.headline ?? '').trim() : '', bd = j ? String(j.body ?? '').trim() : ''; if (hl && bd) art = { headline: hl.slice(0, 200), body: bd.slice(0, 1500) }; } catch { /* 틀 문장 */ }
  s.articles = [...s.articles, { date, ...art }].slice(-8); save(); push();
  ctx.notify({ kind: 'news', title: art.headline, body: L(`숨겨 온 전쟁범죄가 드러났습니다 — 악명 +${Math.round(ex)}(지금 ${Math.round(inf)}/100).`, `Our hidden war crimes are out — infamy +${Math.round(ex)} (now ${Math.round(inf)}/100).`), action: L('함대 사령부', 'Fleet Command') });
  chronNoteWorld(art.headline, true);
  const hit = new Map<number, string>();
  for (const c of shown) if (c.vic > 0 && !hit.has(c.vic)) { hit.set(c.vic, c.vicName); chronNote(c.vic, L(`${us}이(가) 숨겨 온 만행이 드러났다: ${crimeLine(c, us)}`, `${us}'s concealed atrocity came to light: ${crimeLine(c, us)}`)); temperPush(c.vic, -15, ['숨겨 온 만행이 드러남', 'their concealed atrocities came out']); }
  // 피해가 가장 큰 제국이 전범 인도를 요구(우리 전범 표식이 있을 때)
  if (s.criminals.length && hit.size) { const [tid, name] = [...hit.entries()][0]; makeDemand(sid, tid, name, 'exposed', s.criminals.length, date); }
}

const listBuf = new Map<string, Record<string, Emp>>();
const wcBuf = new Map<string, string[]>();
export function registerInfamy(router: LogRouter): void {
  router.on(SLOT.INFAMY, 'infamy', (m: SllmMessage) => {
    const k = m.kind;
    if (k === 'ATROC') { onCrime(m); return; }
    if (k === 'INFCOVER' || k === 'WCSET') { terminalReplies.get(k + ':' + String(m.kv.req ?? ''))?.(m); return; }
    const sid = sidOf(m); if (!sid || sid !== ctx.curSaveId) return;
    if (k === 'INFTIER') {
      const s = entry(sid), old = Math.round(num(m.kv.old)), t = Math.round(num(m.kv.tier)); s.inf = num(m.kv.inf); s.tier = t; s.date = String(m.kv.date ?? ''); save(); push();
      const tx = tierChangeText(old, t, s.inf); ctx.notify({ kind: 'fleet', title: tx.title, body: tx.body, action: L('함대 사령부', 'Fleet Command') });
      if (t === 3 && old < 3) chronNoteWorld(L(`은하가 ${usName()}을(를) 공공의 적으로 지탄하다`, `The galaxy denounces ${usName()} as a pariah`), true);
      return;
    }
    if (k === 'INFEXPOSE') { void onExpose(sid, num(m.kv.ex), num(m.kv.inf), String(m.kv.date ?? ctx.gameDate ?? '')); return; }
    if (k === 'WCMARK') {
      const s = entry(sid), name = String(m.kv.name ?? '').slice(0, 80); if (!name || s.criminals.includes(name)) return;
      s.criminals = [...s.criminals, name].slice(-30); save(); push();
      ctx.notify({ kind: 'fleet', title: L(`전범 낙인: ${name}`, `Branded a war criminal: ${name}`), body: L(`${name} 제독의 함대가 민간인을 폭격했습니다. 전쟁에 지거나 범죄가 드러나면 상대가 인도를 요구할 수 있습니다.`, `Admiral ${name}'s fleet bombarded civilians. If we lose a war or our crimes come out, others may demand they be handed over.`) });
      return;
    }
    if (k === 'WCDEMAND') { makeDemand(sid, Math.round(num(m.kv.tid)), String(m.kv.name ?? '').slice(0, 80), 'war', Math.round(num(m.kv.n)), String(m.kv.date ?? ctx.gameDate ?? '')); return; }
    if (k === 'INFY') { const b = listBuf.get(sid) ?? {}; const idx = Math.round(num(m.kv.idx)); if (idx > 0) b[String(idx)] = { name: String(m.kv.name ?? '').slice(0, 80), inf: num(m.kv.inf), tier: Math.round(num(m.kv.tier)) }; listBuf.set(sid, b); return; }
    if (k === 'WCL') { const b = wcBuf.get(sid) ?? []; const n = String(m.kv.name ?? '').slice(0, 80); if (n && !b.includes(n)) b.push(n); wcBuf.set(sid, b); return; }
    if (k === 'INFEND') {
      const s = entry(sid); s.empires = listBuf.get(sid) ?? {}; listBuf.delete(sid); s.criminals = (wcBuf.get(sid) ?? []).slice(0, 30); wcBuf.delete(sid);
      s.inf = num(m.kv.inf); s.tier = Math.round(num(m.kv.tier)); s.hid = num(m.kv.hid); s.date = String(m.kv.date ?? s.date); save(); push();
      terminalReplies.get('INFEND:' + String(m.kv.req ?? ''))?.(m);
    }
  });
  setInfamyHooks({
    talk: (idx) => {
      const sid = ctx.curSaveId; if (!sid) return ''; const s = entry(sid); const e = s.empires[String(idx)];
      const known = s.log.filter((c) => c.byMe && !c.covered); // 은폐한 범죄는 남들이 모른다(드러나기 전까지)
      let t = talkLine({ us: usName(), myInf: s.inf, mine: known.filter((c) => c.k !== 4), againstThem: s.log.filter((c) => c.byMe && c.vic === idx && (!c.covered || c.k <= 3)), theirInf: e ? e.inf : null });
      const d = s.demands.filter((x) => x.tid === idx).pop();
      if (d) t += (t ? '\n' : '') + (d.state === 'pending' ? `You have demanded that "${usName()}" hand over their war criminals (${s.criminals.slice(0, 4).join(', ') || 'their commanders'}); they have not answered yet. Press them on it.` : d.state === 'refuse' ? `"${usName()}" refused your demand to hand over their war criminals. You resent this deeply.` : d.state === 'hand' ? `"${usName()}" handed over their war criminals to your tribunal as you demanded; justice was done.` : d.state === 'trial' ? `"${usName()}" put the accused commanders before their own military tribunal instead of handing them over; you find it only half a gesture.` : '');
      return t;
    },
    exec: (o) => {
      const sid = ctx.curSaveId; if (!sid) return; const s = entry(sid);
      if (o.secret) { const d = ctx.gameDate || ''; s.log = [...s.log, { k: 5 as CrimeKind, by: -1, byName: '', byMe: true, vic: o.fidx, vicName: o.fname, vicMe: false, place: o.name, date: d, first: d, count: 1, inf: s.inf, covered: true }].slice(-INF.keep); s.hid = Math.min(100, s.hid + 8); save(); push(); return; }
      for (let i = s.log.length - 1; i >= 0; i--) { const c = s.log[i]; if (c.byMe && c.k === 5 && !c.place) { s.log[i] = { ...c, place: o.name, vic: o.fidx, vicName: o.fname }; save(); push(); return; } }
    },
  });
  registerSecFacts({ id: 'Infamy and war crimes', kw: ['악명', '전쟁범죄', '범죄', '학살', '폭격', '은폐', '전범', '인도', 'infamy', 'war crime', 'atrocit', 'bombard', 'cover', 'extradit'], facts: (sid) => { if (sid !== ctx.curSaveId) return []; const s = entry(sid); const out = secLines(s.inf, s.log.filter((c) => c.byMe), s.log.filter((c) => c.vicMe), { hid: s.hid, criminals: s.criminals }); const d = s.demands.filter((x) => x.state === 'pending'); if (d.length) out.push(`Pending demands to hand over our war criminals: ${d.map((x) => x.them).join(', ')}.`); return out; } });
  ipcMain.handle('infamyState', async () => infamyView());
  ipcMain.handle('infamyRefresh', async () => {
    const sid = ctx.curSaveId || '';
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: infamyView() };
    const req = ++link.reqCounter;
    try { await terminalRequest(readCommand(req, sid), 'INFEND', req); return { ok: true, state: infamyView() }; }
    catch (e) { return { ok: false, error: String((e as Error).message || e), state: infamyView() }; }
  });
  ipcMain.handle('infamyCover', async () => {
    const sid = ctx.curSaveId || '';
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: infamyView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: infamyView() };
    busy = true; push();
    try {
      const req = ++link.reqCounter; let m: SllmMessage;
      try { m = await terminalRequest(coverCommand(req, sid), 'INFCOVER', req); } catch (e) { return { ok: false, error: String((e as Error).message || e), state: infamyView() }; }
      const st = Math.round(num(m.kv.st)), mv = num(m.kv.mv), r = coverResult(st, mv), s = entry(sid);
      if (st === 1) { s.inf = num(m.kv.inf); s.hid = num(m.kv.hid); s.coverAt = ctx.gameDate || s.date; s.tier = tierOf(s.inf); for (const c of s.log) if (c.byMe && !c.exposed) c.covered = true; save(); }
      return { ok: r.ok, text: r.text, error: r.ok ? undefined : r.text, state: infamyView() };
    } finally { busy = false; push(); }
  });
  ipcMain.handle('infamyAnswer', async (_e, idIn: unknown, aIn: unknown) => {
    const sid = ctx.curSaveId || '', s = entry(sid), a = String(aIn) as WcAnswer, d = s.demands.find((x) => x.id === Number(idIn));
    if (!d || d.state !== 'pending' || !['hand', 'trial', 'refuse'].includes(a)) return { ok: false, error: L('답할 요구가 없습니다.', 'No such demand.'), state: infamyView() };
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), state: infamyView() };
    if (busy) return { ok: false, error: L('이미 처리 중입니다.', 'Already working.'), state: infamyView() };
    busy = true; push();
    try {
      const req = ++link.reqCounter; let m: SllmMessage;
      try { m = await terminalRequest(wcCommand(req, sid, d.tid, a), 'WCSET', req); } catch (e) { return { ok: false, error: String((e as Error).message || e), state: infamyView() }; }
      const st = String(m.kv.status ?? ''), n = Math.round(num(m.kv.n)), us = usName();
      if (st === 'short') return { ok: false, error: L('영향력이 모자랍니다(군사법정 50).', 'Not enough influence (tribunal costs 50).'), state: infamyView() };
      if (st === 'gone') { d.state = 'gone'; d.result = L(`${d.them}이(가) 더는 없어 요구가 사라졌다.`, `${d.them} no longer exists; the demand lapses.`); save(); return { ok: true, text: d.result, state: infamyView() }; }
      if (st !== 'applied') return { ok: false, error: L('게임이 응답하지 않았습니다.', 'The game did not respond.'), state: infamyView() };
      d.state = a; d.result = wcResultText(a, d.them, n);
      if (a !== 'refuse') s.criminals = [];
      if (a === 'hand') { temperPush(d.tid, 15, ['전범을 인도받음', 'they handed over their war criminals']); chronNote(d.tid, L(`${us}이(가) 요구대로 전범 ${n}명을 넘겨 우리 법정에 세웠다`, `${us} handed over ${n} war criminal(s) to our tribunal as demanded`)); chronNoteWorld(L(`${us}, 전범 ${n}명을 ${d.them}에 인도`, `${us} hands ${n} war criminal(s) over to ${d.them}`), true); }
      else if (a === 'trial') { temperPush(d.tid, 5, ['자국 법정에서 전범을 재판함', 'they tried their war criminals at home']); chronNote(d.tid, L(`${us}이(가) 인도 대신 자국 군사법정에서 전범을 재판했다`, `${us} tried the accused at its own military tribunal instead of handing them over`)); }
      else { temperPush(d.tid, -20, ['전범 인도를 거부함', 'they refused to hand over war criminals']); chronNote(d.tid, L(`${us}이(가) 우리의 전범 인도 요구를 거부했다`, `${us} refused our demand to hand over war criminals`)); chronNoteWorld(L(`${us}, ${d.them}의 전범 인도 요구 거부`, `${us} refuses ${d.them}'s demand to hand over war criminals`), true); }
      save(); return { ok: true, text: d.result, state: infamyView() };
    } finally { busy = false; push(); }
  });
}
