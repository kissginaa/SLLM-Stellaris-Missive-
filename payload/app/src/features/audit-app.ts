// 국정감사(2026-11-03 사용자 결정 ⑤). 규칙·문장: src/audit.ts. 화면: ui/office-audit.js(집무실 「의회」, 불신임과 함께). 설정 「국정감사」(auditOn, 기본 꺼짐)를 켰을 때만.
// 12년마다 1월에 감사 기간이 열리고(알림만, 게임 명령 없음) 그해 안에 받는다. 안 받으면 다음 해 1월에 불출석으로 처리.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { settings } from '../app/settings';
import type { StateSnapshot } from '../gamestate';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { redactKey } from '../aiclient';
import { chronKey } from '../chronicle';
import { civicCommand } from '../civic';
import { terminalRequest } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { moodView, moodNudge } from './mood-app';
import { chron, chronNoteWorld, WORLD_IDX } from './chronicle-app';
import { registerSecFacts } from './secretary-live';
import { civicRegimeNow } from './civic-app';
import { vaultGraftWeight } from './vault-app';
import { type AuditRec, type AuditItem, type AuditContext, AUDIT, VERDICT, isAuditYear, nextAuditYear, auditOpen, missedYear, agendaMessages, parseAgenda, judgeMessages, parseJudge, outcomeOf, shamItems, auditChron, auditFact } from '../audit';

interface AuditSave { recs: AuditRec[]; draft?: { year: number; date: string; items: AuditItem[] }; told?: number }
interface AuditStore { saves: Record<string, AuditSave> }
const file = () => path.join(app.getPath('userData'), 'sllm_audit.json');
let store: AuditStore | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): AuditStore {
  const saves: AuditStore['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), recs = Array.isArray(x.recs) ? (x.recs as AuditRec[]).filter((r) => r && typeof r === 'object' && Number.isFinite(r.year)).slice(-20) : [];
    const d = obj(x.draft), draft = Number.isFinite(d.year) && Array.isArray(d.items) ? { year: Number(d.year), date: String(d.date ?? ''), items: (d.items as AuditItem[]).filter((i) => i && typeof i.question === 'string').slice(0, AUDIT.items) } : undefined;
    saves[safeKey(sid)] = { recs, ...(draft ? { draft } : {}), ...(Number.isFinite(x.told) ? { told: Number(x.told) } : {}) };
  }
  return { saves };
}
function all(): AuditStore { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'audit', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'audit', error: e }); } }, 1500); }
const entry = (sid: string): AuditSave => (all().saves[safeKey(sid)] ??= { recs: [] });
const on = () => settings.auditOn === true;
const yearOf = (d: string) => { const m = /^(\d+)\./.exec(d || ''); return m ? Number(m[1]) : NaN; };

/** 지난 12년 우리 연대기(세계 소식) + 민심·전쟁·금고 의혹·파벌·정책. */
function context(sid: string): AuditContext {
  const date = ctx.gameDate || '', y = yearOf(date);
  const lines = chron().list(chronKey(sid, WORLD_IDX)).filter((e) => { const ey = yearOf(e.date); return Number.isFinite(ey) && y - ey <= AUDIT.everyYears; }).slice(-40).map((e) => e.text.replace(/\s+/g, ' ').slice(0, 220));
  const snap = gameState.last && gameState.last.sid === sid ? gameState.last : null;
  let graft = 0; try { graft = vaultGraftWeight(sid); } catch { /* 금고 없음 */ }
  return { empire: ctx.playerName || L('우리 제국', 'our empire'), date, chronicle: lines, mood: moodView().score, wars: (snap?.wars ?? []).map((w) => w.name).filter(Boolean).slice(0, 4), graft, factions: (snap?.factions ?? []).map((f) => ({ name: f.name, ethic: f.ethic, support: Math.round(f.support * 100), approval: Math.round(f.approval * 100) })).slice(0, 8), policies: [] }; // 파벌 값 0~1 → %
}

async function applyMod(sid: string, kind: 'clean' | 'scandal' | 'refused'): Promise<string> {
  const m = AUDIT[kind];
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) return 'offline';
  try { const req = ++link.reqCounter, r = await terminalRequest(civicCommand(req, sid, 'audit_' + kind, [{ name: m.mod, days: m.days }]), 'CIVIC', req); if (r.kv.status === 'missing') logDiagnostic('warn', 'audit.modifier_missing', { mod: m.mod, hint: 'mod outdated' }); return r.kv.status || 'unknown'; }
  catch (e) { logDiagnostic('warn', 'audit.effect_failed', { error: (e as Error).message }); return 'failed'; }
}
async function finish(sid: string, rec: AuditRec): Promise<void> {
  const e = entry(sid); delete e.draft;
  const kind = rec.kind === 'held' ? (rec.outcome === 'clean' ? 'clean' : rec.outcome === 'scandal' ? 'scandal' : null) : rec.kind === 'refused' || rec.kind === 'missed' ? 'refused' : null;
  if (kind) { rec.status = await applyMod(sid, kind); moodNudge(AUDIT[kind].mood, L(`${rec.year}년 국정감사`, `National audit ${rec.year}`)); }
  e.recs = [...e.recs, rec].slice(-20); save();
  chronNoteWorld(auditChron(rec, ctx.playerName || L('우리 제국', 'our empire')), true);
  push();
}

function onSnapshot(snap: StateSnapshot): void {
  if (!on() || !snap.sid || snap.sid !== ctx.curSaveId || civicRegimeNow() === 'none') return;
  const e = entry(snap.sid), y = yearOf(snap.date);
  const miss = missedYear(snap.date, e.recs);
  if (miss !== null && civicRegimeNow() === 'free') { void finish(snap.sid, { year: miss, date: snap.date, kind: 'missed', items: [], perjury: 0 }); ctx.notify({ kind: 'office', title: L('국정감사 불출석', 'National audit missed'), body: L(`${miss}년 국정감사에 끝내 나가지 않았습니다. 의회와 국민이 분노합니다.`, `You never appeared before the ${miss} national audit. Parliament and the people are furious.`) }); return; }
  if (auditOpen(snap.date, e.recs) && e.told !== y) { e.told = y; save(); ctx.notify({ kind: 'office', title: L('국정감사 기간', 'National audit season'), body: L(`${y}년 국정감사가 열렸습니다. 올해 안에 집무실 「의회」에서 의회의 질의를 받아야 합니다.`, `The ${y} national audit has opened. Answer parliament\'s questions in the office's "Parliament" before the year ends.`) }); push(); }
}

export function auditView() {
  const sid = ctx.curSaveId || '', date = ctx.gameDate || '', reg = civicRegimeNow();
  if (!sid) return { on: on(), sid: '', regime: reg };
  const e = entry(sid), y = yearOf(date);
  return {
    on: on(), sid, date, regime: reg, open: auditOpen(date, e.recs), year: y, next: nextAuditYear(date), every: AUDIT.everyYears,
    draft: e.draft ? { year: e.draft.year, items: e.draft.items.map((i) => ({ ...i, verdictName: i.verdict ? L(...VERDICT[i.verdict]) : '' })) } : null,
    recs: e.recs.slice(-5).reverse().map((r) => ({ year: r.year, date: r.date, kind: r.kind, outcome: r.outcome ?? '', perjury: r.perjury, items: r.items.map((i) => ({ topic: i.topic, mp: i.mp, faction: i.faction, question: i.question, answer: i.answer ?? '', verdict: i.verdict ?? '', verdictName: i.verdict ? L(...VERDICT[i.verdict]) : '', remark: i.remark ?? '' })) })),
    running: ctx.gameRunning, isAuditYear: isAuditYear(y),
  };
}
function push(): void { try { const v = auditView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('auditUpdate', v); } catch { /* 창 없음 */ } }

function guard(): { sid: string; e: AuditSave; y: number } {
  const sid = ctx.curSaveId || '', date = ctx.gameDate || '';
  if (!on()) throw new Error(L('설정에서 국정감사를 켜야 합니다.', 'Turn on the national audit in Settings.'));
  if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const e = entry(sid); if (!auditOpen(date, e.recs)) throw new Error(L('지금은 국정감사 기간이 아닙니다.', 'It is not national audit season.'));
  return { sid, e, y: yearOf(date) };
}
/** 감사 시작: 자유 정부 = LLM 의제(3항목), 요식 정부 = 바로 끝. */
async function start(): Promise<void> {
  const { sid, e, y } = guard(), reg = civicRegimeNow();
  if (reg === 'none') throw new Error(L('단일 의식 제국에는 의회가 없습니다.', 'A gestalt empire has no parliament.'));
  if (reg === 'sham') { await finish(sid, { year: y, date: ctx.gameDate || '', kind: 'sham', items: shamItems(), perjury: 0 }); return; }
  if (e.draft && e.draft.year === y) return;
  let items: AuditItem[] = [];
  try { items = parseAgenda(await ctx.ai.chat(agendaMessages(context(sid)), { purpose: 'audit-agenda', json: true, maxTokens: AUDIT.maxTokens })); }
  catch (err) { throw new Error(L('AI가 감사 의제를 만들지 못했습니다: ', 'The AI could not prepare the audit agenda: ') + redactKey((err as Error).message)); }
  if (!items.length) throw new Error(L('감사 의제를 만들지 못했습니다. 다시 시도해 주세요.', 'Could not prepare the audit agenda. Try again.'));
  e.draft = { year: y, date: ctx.gameDate || '', items }; save(); push();
}
/** 항목에 답변(LLM 판정). 마지막 항목이면 감사를 마친다. */
async function answer(iIn: unknown, textIn: unknown): Promise<{ done?: string }> {
  const { sid, e } = guard(), i = Number(iIn), text = String(textIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  const d = e.draft; if (!d) throw new Error(L('먼저 감사를 시작해 주세요.', 'Start the audit first.'));
  const it = d.items[i]; if (!it || it.verdict) throw new Error(L('이미 답한 질의입니다.', 'That question has already been answered.'));
  let j: { verdict: AuditItem['verdict'] & string; remark: string } | null = null;
  if (!text) j = { verdict: 'weak', remark: L('(정부 측이 답변을 거부했다.)', '(The government declined to answer.)') };
  else { try { j = parseJudge(await ctx.ai.chat(judgeMessages(context(sid), it, text), { purpose: 'audit-judge', json: true, maxTokens: AUDIT.judgeTokens })); } catch (err) { throw new Error(L('AI가 답변을 판정하지 못했습니다: ', 'The AI could not judge the answer: ') + redactKey((err as Error).message)); } }
  if (!j) throw new Error(L('판정을 이해하지 못했습니다. 다시 답해 주세요.', 'Could not understand the judgement. Answer again.'));
  it.answer = text; it.verdict = j.verdict; it.remark = j.remark; save();
  if (d.items.every((x) => x.verdict)) {
    const outcome = outcomeOf(d.items), perjury = d.items.filter((x) => x.verdict === 'perjury').length;
    await finish(sid, { year: d.year, date: ctx.gameDate || d.date, kind: 'held', items: d.items, outcome, perjury });
    return { done: outcome === 'clean' ? L('감사를 무사히 마쳤습니다. 5년 동안 모든 행성 안정도 +3.', 'The audit went well. All planets +3 stability for 5 years.') : outcome === 'scandal' ? L('감사가 큰 논란으로 끝났습니다. 3년 동안 모든 행성 안정도 −5.', 'The audit ended in uproar. All planets −5 stability for 3 years.') : L('감사가 팽팽하게 끝났습니다. 큰 변화는 없습니다.', 'The audit ended evenly. Nothing much changes.') };
  }
  push(); return {};
}
async function refuse(): Promise<string> {
  const { sid, y } = guard(); if (civicRegimeNow() !== 'free') throw new Error(L('요식 감사는 거부할 필요가 없습니다.', 'There is no need to refuse a rubber-stamp audit.'));
  await finish(sid, { year: y, date: ctx.gameDate || '', kind: 'refused', items: [], perjury: 0 });
  return L('국정감사 출석을 거부했습니다. 2년 동안 모든 행성 안정도 −8, 민심이 크게 떨어집니다.', 'You refused to appear. All planets −8 stability for 2 years, and approval drops sharply.');
}

/** ⑥ 불신임이 쓴다: 최근 감사 기록(위증 수 등). */
export function auditRecords(sid = ctx.curSaveId || ''): AuditRec[] { return sid ? entry(sid).recs.slice() : []; }

export function registerAudit(): void {
  onGameSnapshot(onSnapshot, 'parliament');
  registerSecFacts({ id: 'National audit', kw: ['국정감사', '감사', '의회', 'audit', 'parliament'], facts: (sid) => {
    if (sid !== ctx.curSaveId || !on()) return []; const e = entry(sid), out = e.recs.slice(-2).map(auditFact);
    out.push(`Next national audit year: ${nextAuditYear(ctx.gameDate || '')}.`); return out;
  } });
  ipcMain.handle('auditState', async () => auditView());
  const wrap = (fn: () => Promise<Record<string, unknown> | void>) => async () => { try { return { ok: true, ...((await fn()) || {}), state: auditView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: auditView() }; } };
  ipcMain.handle('auditStart', wrap(async () => { await start(); }));
  ipcMain.handle('auditAnswer', async (_e, i: unknown, text: unknown) => wrap(async () => answer(i, text))());
  ipcMain.handle('auditRefuse', wrap(async () => ({ text: await refuse() })));
}
