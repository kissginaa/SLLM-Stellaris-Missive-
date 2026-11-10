// 반란과 공작(앱 쪽, 2026-11-05 사용자: Potent Rebellions 참고 ② ③ ④). 규칙: src/rebels.ts · 화면: ui/office-rebels.js(집무실 「첩보 보고」 → 「반란과 공작」)
// 모드: common/scripted_effects/sllm_rebels.txt · 로그 자리 REBELS(195): RBQ · RBSET · RBAFF/RBAF · RBVF/RBV · RBSOWP/RBSOW · RBASF/RBASP/RBAS
// 저장: sllm_rebels.json { saves: { [세이브]: RbSave } }
// 2026-11-09(회랑 방식): 후원 매달 지급은 정기 송금(src/mtransfer.ts — 모드가 매달 직접, 못 냄·끊김·다 냄만 줄),
//   취약 판정은 모드가 3달마다 스스로 하고 상태가 바뀐 때만 RBV(req=0)를 남긴다 — 앱이 매달·3달마다 게임에 묻지 않는다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { addYears } from '../mail';
import { terminalRequest, terminalReplies } from './terminal';
import { chronNote, chronNoteByName, chronNoteWorld, idxNames } from './chronicle-app';
import { receiveLetter, mail } from './mail-app';
import { onGameOrigin, onGameSnapshot } from './gamestate-app';
import { agentFor, spyPowerOf } from './agents-app';
import { office } from './office-app';
import {
  RB, TIER_NAME, type Tier, type RbSave, type Aid, type AidAsk, fixSave, noteRebellion, activeAids, activeSows, sowBlock, aiSowRoll, monthsBetween, addDaysTo, isTier, tierAmt,
  aidDetect, sowDetect, aiSowSpot, aiFundSpot, stText, vulnText, askSituation, thanksSituation, caughtSituation, sowCaughtSituation,
  aidQueryCommand, aidStartCommand, aidPayCommand, aidCaughtCommand, aiFundCommand, vulnCommand, vulnAutoCommand, sowCommand, aiSowCommand,
} from '../rebels';
import { mtSubscribe, mtSet, mtUnset } from './mtransfer-hub'; // 정기 송금(2026-11-09)
import { MT_OWNER, nextG, type MtEvent } from '../mtransfer';

const file = () => path.join(app.getPath('userData'), 'sllm_rebels.json');
let all: Record<string, RbSave> | null = null;
const books = (): Record<string, RbSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): RbSave => { const b = books(); b[sid] = fixSave(b[sid]); return b[sid]; };
const save = () => { try { const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: books() })); fs.renameSync(t, file()); } catch (e) { logDiagnostic('warn', 'rebels.save_failed', { error: (e as Error).message }); } };
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/^\\/, '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const sv = (v: unknown) => String(v ?? '').replace(/^\\/, '').trim().slice(0, 80);
const ready = () => !!(ctx.gameRunning && link.sessionReady && ctx.curSaveId && /^\d+$/.test(ctx.curSaveId));
const us = () => ctx.playerName || L('우리 제국', 'our empire');
function idxOf(name: string): number { for (const [i, n] of idxNames) if (n === name && i > 0 && i < 9000) return i; return 0; }
let nets: Array<{ target: string; power: number }> = [];
let busy = false, lastMonth = '';
/** 취약 판정을 모드에 맡긴 세이브(이번 세션). 불러오면 비워서 다시 맡긴다. */
let autoSid = '', autoFoe = '';

// ---- 줄 모으기 ----
const extra = new Map<number, { foe?: string; planet?: string }>();
function onLine(m: SllmMessage): void {
  if (m.kind === 'LOADED') { autoSid = ''; const sid = sv(m.kv.sid); if (sid && books()[sid]) { for (const a of books()[sid].aids) { if (a.reg) a.chk = true; a.reg = false; } } return; }
  const req = Math.round(num(m.kv.req));
  if (req === 0 && m.kind === 'RBVF') { autoFoe = sv(m.kv.foe); return; } // 모드가 스스로 한 취약 판정(2026-11-09)
  if (req === 0 && m.kind === 'RBV') { const sid = ctx.curSaveId; if (sid && sv(m.kv.sid) === sid) applyVuln(sid, Math.round(num(m.kv.st)) === 1, Math.round(num(m.kv.use)), autoFoe); autoFoe = ''; return; }
  if (m.kind === 'RBAFF' || m.kind === 'RBVF' || m.kind === 'RBASF') { const x = extra.get(req); if (x) x.foe = sv(m.kv.foe); return; }
  if (m.kind === 'RBSOWP' || m.kind === 'RBASP') { const x = extra.get(req); if (x) x.planet = sv(m.kv.planet); return; }
  if (['RBQ', 'RBSET', 'RBAF', 'RBV', 'RBSOW', 'RBAS'].includes(m.kind)) terminalReplies.get(m.kind + ':' + req)?.(m);
}
/** 명령 보내고 끝 줄 받기. 끝 줄 · 그 사이 이름 줄(foe·planet). 응답이 없으면 m = null. */
async function ask(cmd: (req: number) => string, end: string): Promise<{ m: SllmMessage | null; foe?: string; planet?: string }> {
  const req = ++link.reqCounter; extra.set(req, {});
  try { const m = await terminalRequest(cmd(req), end, req); return { m, ...extra.get(req) }; } catch { return { m: null }; } finally { extra.delete(req); }
}
const stOf = (m: SllmMessage | null): number => (m ? Math.round(num(m.kv.st)) : -1);

// ---- 서신 ----
async function letter(idx: number, name: string, situation: string, source: string, years = 1): Promise<boolean> {
  const sid = ctx.curSaveId; if (!sid || !idx) return false;
  try {
    const p = ctx.profileWithEthics(ctx.profiles.get(idx) ?? mail.countries.get(idx)?.profile, idx);
    const sys = [`You are the leadership of "${name}" in the Stellaris galaxy, writing a diplomatic letter to ${us()}.`,
      p ? `[Nation info] Government: ${p.gov || 'unknown'}, species: ${p.species || 'unknown'}, leader: ${p.ruler || 'unknown'}${p.title ? ` (${p.title})` : ''}.${p.ethicsText ? `\n[Ethics]\n${p.ethicsText}` : ''}` : '',
      `[Situation] ${situation}`,
      'Format: a letter of 3-6 sentences ending with the leader\'s title and name. Do not invent specific figures or events. Do not write that anything was carried out in the game. Output only the letter text.'].filter(Boolean).join('\n');
    const raw = String(await ctx.ai.chat([{ role: 'system', content: sys }, { role: 'user', content: `[${ctx.gameDate}] Write the letter.` }], { maxTokens: 900, purpose: 'rebels-letter' }) ?? '');
    const text = raw.replace(/^```[a-z]*\s*|```\s*$/gi, '').trim().slice(0, 2400);
    if (!text || sid !== ctx.curSaveId) return false;
    receiveLetter(sid, ctx.govMem().currentBranch(sid), { idx, name, date: ctx.gameDate, text, proposal: null, expires: addYears(ctx.gameDate, years), read: false, sourceId: source });
    return true;
  } catch (e) { logDiagnostic('warn', 'rebels.letter_failed', { source, error: (e as Error).message }); return false; }
}
const toast = (title: string, body: string) => { (office as { toastGo: string }).toastGo = 'spy'; ctx.notify({ kind: 'office', title, body, action: L('첩보 보고', 'Espionage') }); };
const chron = (idx: number, text: string, mine = false) => { try { if (idx > 0) chronNote(idx, text, mine); } catch { /* 연대기는 덤 */ } };
const world = (text: string) => { try { chronNoteWorld(text); } catch { /* 덤 */ } };

// ---- ② 반란 소식 ----
function onOrigin(o: { kind: string; country: string; from: string; date: string }): void {
  const sid = ctx.curSaveId; if (!sid || o.kind !== 'rebels') return;
  const r = noteRebellion(saveOf(sid), o, us(), ctx.gameDate || o.date); if (r) { save(); logDiagnostic('info', 'rebels.noted', { country: o.country, from: o.from, kind: r }); }
}

// ---- 매달 ----
async function monthly(): Promise<void> {
  if (!ready() || busy) return; const sid = ctx.curSaveId!, date = ctx.gameDate || '', month = date.slice(0, 7); if (!month || month === lastMonth) return; lastMonth = month;
  const s = saveOf(sid); busy = true;
  try {
    // ③ 취약 국가(3달마다) — 이때 「가까운 나라」 깃발도 다시 붙인다(아래 AI 공작·후원 판정이 이 깃발을 쓰므로 맨 먼저)
    //   2026-11-09: 모드에 맡긴다(한 번). 맡기지 못했을 때만(옛 모드) 예전처럼 3달마다 묻는다.
    if (autoSid !== sid) { const r = await ask((req) => vulnAutoCommand(req, sid), 'RBSET'); if (stOf(r.m) === 0) autoSid = sid; }
    if (autoSid !== sid && monthsBetween(s.vuln.last, date) >= RB.vulnEvery) {
      const r = await ask((req) => vulnCommand(req, sid), 'RBV');
      if (r.m) applyVuln(sid, stOf(r.m) === 1, Math.round(num(r.m.kv.use)), r.foe);
    }
    // 반란국의 후원 요청: 둘의 통신 번호를 알면 모드에 묻고 서신
    for (const a of s.asks) {
      if (a.state === 'ask' && a.due && a.due <= date) { a.state = 'ignored'; save(); continue; }
      if (a.state !== 'wait') continue;
      if (monthsBetween(a.at, date) > RB.waitMonths) { a.state = 'expired'; save(); continue; }
      const tid = idxOf(a.country), pid = idxOf(a.from); if (!tid || !pid) continue;
      const q = await ask((req) => aidQueryCommand(req, sid, tid, pid), 'RBQ'); if (!q.m) continue;
      if (Math.round(num(q.m.kv.ok)) !== 1 || activeAids(s).length >= RB.maxAid) { a.state = 'skip'; save(); continue; }
      a.state = 'ask'; a.due = addDaysTo(date, RB.askDays); save();
      void letter(tid, a.country, askSituation(a, us()), 'rebels-ask:' + a.country);
      toast(L(`${a.country}이(가) 지원을 청함`, `${a.country} asks for support`), L(`${a.from}에 맞서 막 독립한 ${a.country}이(가) 매달 자원 지원을 청합니다. 집무실 「첩보 보고」 → 「반란과 공작」에서 답하세요(${a.due}까지).`, `${a.country}, newly free of ${a.from}, asks for monthly support. Answer in the office's Espionage Reports → Rebels & Covert Ops (by ${a.due}).`));
    }
    // 진행 중인 후원: 매달 지급 · 1월에 발각 판정
    for (const a of activeAids(s)) {
      const tid = idxOf(a.country);
      if (date >= a.until) { a.state = 'done'; save(); if (a.reg && a.g && tid) void mtUnset(tid, a.g, MT_OWNER.rebel); chron(tid, L(`${us()}의 5년 지원이 끝났다.`, `${us()}'s five years of support came to an end.`)); continue; }
      if (!tid) continue;
      const amt = tierAmt(a.tier);
      // 2026-11-09: 정기 송금 — 모드가 매달 직접 보낸다. 앱 장부는 「못 냈다」 줄이 없던 달을 낸 것으로 센다(끊김·끝은 모드 줄이 정함).
      if (!a.legacy && !a.reg) await aidRegister(s, a, tid, date, true, !!a.chk);
      if (a.state !== 'on') continue;
      if (!a.legacy) { if (a.reg && a.sm !== month && a.since.slice(0, 7) !== month) { a.paid += amt; a.short = 0; save(); } }
      else {
        const r = await ask((req) => aidPayCommand(req, sid, tid, amt), 'RBSET'), st = stOf(r.m);
        if (st === 0) { a.paid += amt; a.short = 0; }
        else if (st === 3) { a.short += 1; if (a.short >= RB.shortMax) aidLapsed(a, tid); }
        else if (st === 4) { a.state = 'gone'; }
        save();
      }
      if (a.state === 'on' && !a.caught && month.endsWith('.01') && a.lastCheck !== month) {
        a.lastCheck = month; save();
        if (Math.random() < aidDetect(a.tier)) {
          const pid = idxOf(a.from); a.caught = true; save();
          if (pid) await ask((req) => aidCaughtCommand(req, sid, pid, a.tier), 'RBSET');
          toast(L('반란군 지원 발각', 'Rebel funding exposed'), L(`${a.from}이(가) 우리가 ${a.country}을(를) 돕고 있다는 사실을 알아냈습니다. 관계가 크게 나빠졌습니다.`, `${a.from} has found out we are funding ${a.country}. Relations have soured badly.`));
          if (pid) { chron(pid, L(`${us()}이(가) 우리에게서 갈라져 나간 ${a.country}을(를) 몰래 돕고 있다는 사실을 알아냈다.`, `Discovered that ${us()} was secretly funding ${a.country}, the rebels who broke away from us.`)); void letter(pid, a.from, caughtSituation(a, us()), 'rebels-caught:' + a.country); }
          world(L(`${us()}이(가) ${a.from}에서 갈라진 반란국 ${a.country}을(를) 몰래 지원해 온 것이 드러났다.`, `${us()} was exposed secretly funding ${a.country}, the breakaway state from ${a.from}.`));
        }
      }
    }
    // 우리에게서 갈라진 반란국: AI 후원 판정(한 번)
    for (const o of s.ours) {
      if (o.state !== 'wait') continue;
      if (monthsBetween(o.at, date) > RB.waitMonths) { o.state = 'expired'; save(); continue; }
      const tid = idxOf(o.country); if (!tid) continue;
      if (Math.random() >= RB.aiFundChance) { o.state = 'done'; save(); continue; }
      const r = await ask((req) => aiFundCommand(req, sid, tid), 'RBAF'); if (!r.m) continue;
      o.state = 'done';
      if (stOf(r.m) === 1 && r.foe) {
        o.foe = r.foe; o.spotted = Math.random() < aiFundSpot(nets.some((n) => n.target === r.foe));
        if (o.spotted) {
          toast(L('우리 반란군의 뒷배', 'Who backs our rebels'), L(`첩보에 따르면 ${r.foe}이(가) 우리에게서 갈라진 ${o.country}에 자금과 물자를 대고 있습니다.`, `Our intelligence says ${r.foe} is funding and supplying ${o.country}, the rebels who broke away from us.`));
          chronNoteByName(r.foe, L(`우리에게서 갈라진 반란국 ${o.country}을(를) 몰래 돕다 우리 첩보에 걸렸다.`, `Was caught by our intelligence secretly backing ${o.country}, the rebels who broke away from us.`), false);
        }
      }
      save();
    }
    // ④ AI 의 선동
    if (aiSowRoll(s, date)) {
      const r = await ask((req) => aiSowCommand(req, sid), 'RBAS');
      if (r.m && stOf(r.m) === 1) {
        const spotted = !!r.foe && Math.random() < aiSowSpot(nets.some((n) => n.target === r.foe));
        s.lastAiSow = date; s.aiSows.push({ foe: spotted ? r.foe! : '', planet: r.planet || '', at: date, until: addDaysTo(date, RB.sowDays), spotted });
        if (s.aiSows.length > RB.keep) s.aiSows.shift(); save();
        toast(L('행성에 소요', 'Unrest on a colony'), spotted ? L(`${r.planet}에서 ${r.foe}의 선동가들이 불만을 부추기고 있습니다(3년간 안정도 −10, 범죄 +10).`, `Agitators from ${r.foe} are stirring trouble on ${r.planet} (stability −10, crime +10 for 3 years).`) : L(`${r.planet}에서 누군가 조직적으로 불만을 부추기고 있습니다. 배후는 알 수 없습니다.`, `Someone is organising unrest on ${r.planet}. We do not know who is behind it.`));
        if (spotted) chronNoteByName(r.foe!, L(`우리 행성 ${r.planet}에 선동가를 심었다가 우리 첩보에 걸렸다.`, `Was caught by our intelligence planting agitators on our world ${r.planet}.`), false);
      }
    }
  } finally { busy = false; }
}

/** 취약 판정 결과 반영(모드가 스스로 했든, 앱이 물었든). */
function applyVuln(sid: string, on: boolean, use: number, foe?: string): void {
  const s = saveOf(sid), date = ctx.gameDate || '', was = s.vuln.on;
  s.vuln = { on, last: date, use, ...(on ? { foe: foe || s.vuln.foe, since: was ? s.vuln.since : date } : {}) }; save();
  if (on && !was) toast(L('국방 경고: 흔들리는 나라', 'Defence warning: a shaken nation'), vulnText(s.vuln));
  else if (!on && was) toast(L('국방: 불안이 걷힘', 'Defence: the unease has lifted'), L('적대 세력의 위협이 줄었거나 함대 한도를 충분히 채워, 백성의 동요가 가라앉았습니다.', 'The threat has eased or our naval capacity is well used, and the people have calmed.'));
}
function aidLapsed(a: Aid, tid: number): void {
  a.state = 'lapsed';
  toast(L('반란군 지원 끊김', 'Rebel support lapsed'), L(`창고가 모자라 ${a.country}에 보낼 지원을 두 달 연속 못 보냈습니다. 지원이 끊겼습니다.`, `Our stockpile ran short two months running, so support for ${a.country} has lapsed.`));
  chron(tid, L(`${us()}의 지원이 끊겼다.`, `${us()}'s support dried up.`));
}
/** 후원을 정기 송금 칸에 적는다(에너지·광물 같이, 우리가 냄). keep = 이미 있으면 그대로(불러온 세이브). 응답이 없으면 다음 달 다시.
 *  check = 세이브를 불러온 뒤 확인만: 게임에 칸이 없으면 다시 만들지 않고 후원은 끝난 것으로 본다(사용자 결정 2026-11-09 「게임을 믿고 끝냄」). */
async function aidRegister(s: RbSave, a: Aid, tid: number, date: string, keep: boolean, check = false): Promise<void> {
  if (!a.g) a.g = nextG(s.aids.map((x) => x.g));
  const left = Math.max(1, Math.min(1200, monthsBetween(date, a.until)));
  const r = await mtSet({ tid, res: 'energy_minerals', payUs: true, amt: tierAmt(a.tier), left, g: a.g, o: MT_OWNER.rebel }, keep, check);
  if (r === 'full') a.legacy = true; else if (r === 'ok') a.reg = true; else if (r === 'gone') a.state = 'gone';
  else if (r === 'missing') { logDiagnostic('info', 'rebels.transfer_missing', { tid, g: a.g }); a.state = 'done'; }
  if (r !== 'fail') delete a.chk;
  save();
}
/** 모드의 정기 송금 사건(o = 반란군 후원): 못 냄 → 장부 · 끊김(두 달 연속) → 끊김 알림 · 다 냄 → 끝. */
function onMt(ev: MtEvent): void {
  const sid = ctx.curSaveId; if (!sid || (ev.sid && ev.sid !== sid)) return;
  const a = saveOf(sid).aids.find((x) => x.g === ev.g && x.state === 'on'); if (!a) return;
  if (ev.ev === 'short') { a.short = ev.miss; a.sm = (ev.date || ctx.gameDate || '').slice(0, 7); save(); return; }
  if (ev.ev === 'end') { a.state = 'done'; save(); chron(ev.tid, L(`${us()}의 5년 지원이 끝났다.`, `${us()}'s five years of support came to an end.`)); return; }
  a.short = RB.shortMax; aidLapsed(a, ev.tid); save();
}

// ---- 화면 ----
export function rbView() {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const s = saveOf(sid), date = ctx.gameDate || '';
  const targets = nets.map((n) => { const a = agentFor(n.target); return { target: n.target, idx: a?.idx || idxOf(n.target), power: n.power, agent: a ? a.name : '', odds: sowDetect(n.power), block: sowBlock(s, n.target, date) }; }).filter((t) => t.idx > 0);
  return {
    ok: true, running: ready(), date, tiers: RB.tiers, detect: RB.detect, aidMonths: RB.aidMonths, sowInf: RB.sowInf, maxAid: RB.maxAid,
    asks: s.asks.filter((a) => a.state === 'ask').map((a) => ({ country: a.country, from: a.from, due: a.due, sown: !!a.sown })),
    aids: s.aids.slice(-8).reverse().map((a) => ({ ...a, amt: tierAmt(a.tier), name: TIER_NAME[a.tier] })),
    ours: s.ours.filter((o) => o.state === 'done' && o.spotted && o.foe).slice(-5).reverse(),
    vuln: { ...s.vuln, text: vulnText(s.vuln) },
    targets, sows: s.sows.slice(-6).reverse().map((w) => ({ ...w, active: activeSows(s, date).includes(w) })),
    aiSows: s.aiSows.slice(-5).reverse(),
  };
}
type Res = { ok: boolean; error?: string; text?: string; view?: ReturnType<typeof rbView> };
const fail = (e: unknown): Res => ({ ok: false, error: (e as Error).message, view: rbView() });
let acting = false;
async function guard(fn: () => Promise<string>): Promise<Res> {
  if (acting) return { ok: false, error: L('처리 중입니다.', 'Busy.') };
  if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
  acting = true; try { const text = await fn(); return { ok: true, text, view: rbView() }; } catch (e) { return fail(e); } finally { acting = false; }
}

export function registerRebels(router: LogRouter): void {
  router.on(SLOT.REBELS, 'rebels', onLine);
  mtSubscribe(router, MT_OWNER.rebel, onMt); // 정기 송금 사건(2026-11-09)
  onGameOrigin(onOrigin);
  onGameSnapshot((snap) => { if (snap.sid === ctx.curSaveId) nets = snap.spynets.filter((n) => n.target).map((n) => ({ target: n.target, power: Math.max(0, Number(n.power) || 0) })); });
  setInterval(() => { void monthly().catch((e) => logDiagnostic('warn', 'rebels.monthly_failed', { error: (e as Error).message })); }, 30000);
  ipcMain.handle('rbState', () => rbView());
  // ② 후원 요청에 답하기: tier 1~3 = 지원, 0 = 거절
  ipcMain.handle('rbAidAnswer', async (_e, a: { country?: unknown; tier?: unknown }): Promise<Res> => guard(async () => {
    const sid = ctx.curSaveId!, s = saveOf(sid), q = s.asks.find((x) => x.country === String(a?.country ?? '') && x.state === 'ask');
    if (!q) throw new Error(L('답할 요청이 없습니다.', 'There is no request to answer.'));
    const tier = Number(a?.tier), tid = idxOf(q.country);
    if (tier === 0) { q.state = 'declined'; save(); chron(tid, L(`${us()}에 지원을 청했으나 거절당했다.`, `Asked ${us()} for support and was refused.`)); return L(`${q.country}의 요청을 거절했습니다.`, `Declined ${q.country}'s request.`); }
    if (!isTier(tier)) throw new Error(L('지원 단계를 고르세요.', 'Choose a level of support.'));
    if (activeAids(s).length >= RB.maxAid) throw new Error(L(`지원은 동시에 ${RB.maxAid}곳까지입니다.`, `At most ${RB.maxAid} at a time.`));
    if (!tid) throw new Error(stText(4));
    const r = await ask((req) => aidStartCommand(req, sid, tid, tier as Tier), 'RBSET'), st = stOf(r.m); if (st !== 0) throw new Error(stText(st));
    const date = ctx.gameDate || ''; q.state = 'taken';
    const aid: Aid = { country: q.country, from: q.from, tier: tier as Tier, since: date, until: addDaysTo(date, RB.aidMonths * 30), paid: 0, short: 0, caught: false, state: 'on' };
    s.aids.push(aid); if (s.aids.length > RB.keep) s.aids.shift(); save();
    await aidRegister(s, aid, tid, date, false); // 정기 송금(2026-11-09): 매달 지급은 게임이 직접
    chron(tid, L(`${us()}이(가) ${q.from}에 맞서는 우리에게 5년간 매달 에너지·광물 ${tierAmt(aid.tier)}씩을 보내기로 했다.`, `${us()} agreed to send us ${tierAmt(aid.tier)} energy and minerals a month for five years against ${q.from}.`));
    void letter(tid, q.country, thanksSituation(aid, us()), 'rebels-thanks:' + q.country);
    return L(`${q.country}에 매달 에너지·광물 ${tierAmt(aid.tier)}씩, 5년 동안 보냅니다. 해마다 ${Math.round(aidDetect(aid.tier) * 100)}% 확률로 ${q.from}에 들킵니다.`, `Sending ${q.country} ${tierAmt(aid.tier)} energy and minerals a month for 5 years. Each year there is a ${Math.round(aidDetect(aid.tier) * 100)}% chance ${q.from} finds out.`);
  }));
  ipcMain.handle('rbAidStop', async (_e, a: { country?: unknown }): Promise<Res> => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브가 없습니다.', 'No save loaded.') };
    const x = activeAids(saveOf(sid)).find((v) => v.country === String(a?.country ?? '')); if (!x) return { ok: false, error: L('진행 중인 지원이 없습니다.', 'No support is running.') };
    x.state = 'stopped'; save(); chron(idxOf(x.country), L(`${us()}이(가) 지원을 끊었다.`, `${us()} cut off its support.`));
    { const tid = idxOf(x.country); if (x.reg && x.g && tid) void mtUnset(tid, x.g, MT_OWNER.rebel); }
    return { ok: true, text: L(`${x.country}에 보내던 지원을 멈췄습니다.`, `Stopped support for ${x.country}.`), view: rbView() };
  });
  // ④ 선동
  ipcMain.handle('rbSow', async (_e, a: { target?: unknown }): Promise<Res> => guard(async () => {
    const sid = ctx.curSaveId!, s = saveOf(sid), date = ctx.gameDate || '', name = String(a?.target ?? '');
    const n = nets.find((x) => x.target === name); if (!n) throw new Error(L('그 나라에는 첩보망이 없습니다.', 'We have no spy network there.'));
    const b = sowBlock(s, name, date); if (b) throw new Error(b);
    const idx = agentFor(name)?.idx || idxOf(name); if (!idx) throw new Error(stText(4));
    const caught = Math.random() < sowDetect(spyPowerOf(name) || n.power);
    const r = await ask((req) => sowCommand(req, sid, idx, caught), 'RBSOW'), st = stOf(r.m); if (st !== 0) throw new Error(stText(st));
    const w = { target: name, idx, planet: r.planet || '', at: date, until: addDaysTo(date, RB.sowDays), caught };
    s.sows.push(w); if (s.sows.length > RB.keep) s.sows.shift(); save();
    if (caught) {
      chron(idx, L(`우리 행성 ${w.planet}에서 ${us()}의 선동 공작원을 잡아냈다.`, `Caught agents of ${us()} stirring unrest on our world ${w.planet}.`));
      void letter(idx, name, sowCaughtSituation(w, us()), 'rebels-sow:' + name + ':' + date);
      world(L(`${name}이(가) 자국 행성 ${w.planet}의 소요 배후로 ${us()}을(를) 지목했다.`, `${name} has named ${us()} as the hand behind the unrest on its world ${w.planet}.`));
    }
    const ag = agentFor(name);
    return caught
      ? L(`${w.planet}에 불안을 심었지만 들켰습니다. ${name}이(가) 우리를 크게 나쁘게 봅니다(관계 −80).`, `Unrest sown on ${w.planet}, but we were caught. ${name} thinks much worse of us (opinion −80).`)
      : L(`${ag ? ag.name + ' 공작원이 ' : ''}${w.planet}에 불안을 심었습니다(3년간 안정도 −10, 범죄 +10). 들키지 않았습니다.`, `${ag ? 'Agent ' + ag.name + ' has ' : 'We have '}sown unrest on ${w.planet} (stability −10, crime +10 for 3 years). Undetected.`);
  }));
}
// 순수 함수 검사용
export const rbTest = { onLine, extra, noteFromOrigin: onOrigin };
export type { AidAsk };
