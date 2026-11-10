// 원시문명 관측(2026-11-03 사용자 결정 ①). 규칙·문장: src/preftl.ts. 모드: sllm_probe_preftl.txt(PFTL·PFTL_END). 화면: ui/office-preftl.js(집무실 「원시문명 관측」).
// 자동 관측 없음(2026-11-03 사용자: 「슈뢰딩거처럼」): 처음 접촉(조사선 조사·관측소 건설 → 모드 PFTL_FOUND)할 때 한 번 읽고,
// 그 뒤로는 플레이어가 화면을 열 때(같은 게임 날짜에는 한 번만)나 「새로 관측」을 누를 때만 읽는다. 바뀐 점은 기록으로 남기고, 보고서는 틀 문장 또는(고르면) LLM.
// 감청 방송 ④(src/preftl-broadcast.ts): 「방송 감청」을 누를 때만 만든다(게임 명령 없음). 다음 단계(개입 ③·하늘의 목소리 ②·기억 제국 ⑤)가 이 저장소(civs·log)를 이어서 쓴다.
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { redactKey } from '../aiclient';
import { terminalRequest, terminalReplies } from './terminal';
import { registerSecFacts } from './secretary-live';
import { type Civ, type CivEvent, type Report, PftlCollector, parseCiv, diffCiv, eventText, templateReport, reportMessages, parseReport, civFact, preftlCommand, ageName, awareName, AGE_MAX, RADIO_AGE, MISSION, SITUATION, REPORT_MAX_TOKENS } from '../preftl';
import { type ActKey, ACTS, isActKey, actBlock, actResult, actCommand, resolutionWarning } from '../preftl-act';
import { chronNoteWorld, chronNote } from './chronicle-app';
import { gov } from './gov';
import { terminal } from './terminal';
import { type Fate, sameName, memoryText, conquestText, memoryFact } from '../preftl-memory';
import { type Faith, type VoiceSession, VOICE, MOOD_NAME, emptyFaith, voiceBlock, voiceAwareness, teachProgress, pickAfter, afterMessages, parseAfter, afterNote, templateAfter, AFTER, AFTER_MAX_TOKENS, type Aftermath, voiceMessages, parseVoice, applyReply, faithLine, faithText, voiceCommand, faithFact } from '../preftl-voice';
import { type Standoff, SO, soMaybeStart, soAdvance, soPush, soActive, soCredit, soFact, soText, soView, soEndCommand, parseCalm, voiceDelta } from '../preftl-standoff';
import { onGameSnapshot } from './gamestate-app';
import { type Broadcast, interceptBlock, medium, templateBroadcast, broadcastMessages, parseBroadcast, broadcastFact, BROADCAST_KEEP, BROADCAST_MAX_TOKENS } from '../preftl-broadcast';

interface PftlSave { civs: Record<string, Civ>; log: Record<string, CivEvent[]>; reports: Record<string, Report[]>; bc: Record<string, Broadcast[]>; acts: Record<string, Partial<Record<ActKey, string>>>; faith: Record<string, Faith>; after: Record<string, Aftermath[]>; /** 핵 대치(2026-11-05) */ so: Record<string, Standoff>; ni?: number; lastScan?: string }
interface PftlStore { saves: Record<string, PftlSave> }
const LOG_KEEP = 40, REPORT_KEEP = 8;
const file = () => path.join(app.getPath('userData'), 'sllm_preftl.json');
let store: PftlStore | null = null;
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
function sanitize(v: unknown): PftlStore {
  const saves: PftlStore['saves'] = {};
  for (const [sid, e] of Object.entries(obj(obj(v).saves)).slice(0, 300)) {
    const x = obj(e), civs: Record<string, Civ> = {}, log: Record<string, CivEvent[]> = {}, reports: Record<string, Report[]> = {}, bc: Record<string, Broadcast[]> = {}, acts: PftlSave['acts'] = {}, faith: Record<string, Faith> = {}, after: Record<string, Aftermath[]> = {}, so: Record<string, Standoff> = {};
    for (const [k, c] of Object.entries(obj(x.civs)).slice(0, 100)) { const cc = obj(c); if (Number.isSafeInteger(cc.id) && typeof cc.name === 'string') civs[String(cc.id)] = cc as unknown as Civ; void k; }
    for (const [k, a] of Object.entries(obj(x.log))) if (civs[k] && Array.isArray(a)) log[k] = (a as CivEvent[]).filter((q) => q && typeof q === 'object' && typeof q.kind === 'string').slice(-LOG_KEEP);
    for (const [k, a] of Object.entries(obj(x.reports))) if (civs[k] && Array.isArray(a)) reports[k] = (a as Report[]).filter((q) => q && typeof q === 'object' && typeof q.body === 'string').slice(-REPORT_KEEP);
    for (const [k, a] of Object.entries(obj(x.bc))) if (civs[k] && Array.isArray(a)) bc[k] = (a as Broadcast[]).filter((q) => q && typeof q === 'object' && typeof q.body === 'string').slice(-BROADCAST_KEEP);
    for (const [k, a] of Object.entries(obj(x.acts))) if (civs[k]) { const o: Partial<Record<ActKey, string>> = {}; for (const [ak, d] of Object.entries(obj(a))) if (isActKey(ak) && typeof d === 'string') o[ak] = d.slice(0, 20); acts[k] = o; }
    for (const [k, a] of Object.entries(obj(x.faith))) if (civs[k]) { const o = obj(a); faith[k] = { name: typeof o.name === 'string' ? o.name.slice(0, 40) : '', devotion: Math.max(0, Math.min(100, Number(o.devotion) || 0)), sessions: Math.max(0, Math.round(Number(o.sessions) || 0)), ...(typeof o.last === 'string' ? { last: o.last.slice(0, 20) } : {}), notes: Array.isArray(o.notes) ? (o.notes as unknown[]).filter((q): q is string => typeof q === 'string').slice(-VOICE.keepNotes) : [] }; }
    for (const [k, a] of Object.entries(obj(x.after))) if (civs[k] && Array.isArray(a)) after[k] = (a as Aftermath[]).filter((q) => q && typeof q === 'object' && typeof q.body === 'string' && typeof q.kind === 'string' && q.kind in AFTER).slice(-VOICE.keepAfter);
    for (const [k, a] of Object.entries(obj(x.so))) if (civs[k]) { const o = obj(a), d = (v: unknown) => (typeof v === 'string' ? v.slice(0, 20) : ''); so[k] = { on: o.on === true, t: Math.max(0, Math.min(100, Number(o.t) || 0)), since: d(o.since), at: d(o.at), ours: Math.max(0, Number(o.ours) || 0), ...(o.end === 'war' || o.end === 'peace' ? { end: o.end, endAt: d(o.endAt) } : {}), ...(o.applied === true ? { applied: true } : {}) }; }
    saves[safeKey(sid)] = { civs, log, reports, bc, acts, faith, after, so, ...(typeof x.ni === 'number' ? { ni: x.ni } : {}), ...(typeof x.lastScan === 'string' ? { lastScan: x.lastScan.slice(0, 20) } : {}) };
  }
  return { saves };
}
function all(): PftlStore { if (store) return store; try { store = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'preftl', error: e }); store = sanitize({}); } return store; }
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'preftl', error: e }); } }, 1500); }
const entry = (sid: string): PftlSave => { const e = (all().saves[safeKey(sid)] ??= { civs: {}, log: {}, reports: {}, bc: {}, acts: {}, faith: {}, after: {}, so: {} }); e.so ??= {}; return e; };
/** 진행 중인 하늘의 목소리 교신(앱이 켜져 있는 동안만, 세이브·문명별). */
const sessions = new Map<string, VoiceSession>();
const sessKey = (sid: string, id: number) => sid + ':' + id;

/** 다른 단계(감청 방송 등)가 읽는 이 세이브의 원시문명. */
export function preftlCivs(sid = ctx.curSaveId || ''): Civ[] { return sid ? Object.values(entry(sid).civs) : []; }
export function preftlLog(id: number, sid = ctx.curSaveId || ''): CivEvent[] { return sid ? entry(sid).log[String(id)] ?? [] : []; }
/** 하늘의 목소리 신앙 한 줄(인터넷 염탐 src/features/preftl-net-app.ts 가 씀, 2026-11-04). 없으면 ''. */
export function preftlFaithLine(id: number, sid = ctx.curSaveId || ''): string { return sid ? faithLine(entry(sid).faith[String(id)]) : ''; }
/** 핵 대치 사실 줄(영어, 2026-11-05) — 인터넷 염탐·방송·보고서·하늘의 목소리 글에 묻어난다. 없으면 ''. */
export function preftlStandoffFact(id: number, sid = ctx.curSaveId || ''): string { return sid ? soFact(entry(sid).so[String(id)]) : ''; }

// ---- 핵 대치(2026-11-05) ----
const logEv = (e: PftlSave, k: string, ev: CivEvent) => { e.log[k] = [...(e.log[k] ?? []), ev].slice(-LOG_KEEP); };
/** 관측·달 바뀜·개입 뒤: 시작 주사위 → 흘리기 → 단계 변화 기록. 끝나면 true(결말 반영은 soSettle). */
function soTouch(sid: string, k: string, date: string, notes?: string[]): boolean {
  const e = entry(sid), c = e.civs[k]; if (!c) return false;
  const prev = e.so[k], s0 = soMaybeStart(prev, c, date); if (!s0) return false;
  if (!prev && s0.on) { logEv(e, k, { date, kind: 'so_start' }); notes?.push(`${c.name}: ${eventText({ date, kind: 'so_start' })}`); }
  const r = soAdvance(s0, c, date); e.so[k] = r.so;
  for (const st of r.stages) { logEv(e, k, { date, kind: 'so_stage', a: st }); if (st === 2) notes?.push(`${c.name}: ${eventText({ date, kind: 'so_stage', a: 2 })}`); }
  if (r.ended) soEnded(sid, k, date);
  return r.ended;
}
/** 결말이 났다: 기록·알림·연대기. 게임 반영은 soSettle 이 한다(실패하면 다음 달 다시). */
function soEnded(sid: string, k: string, date: string): void {
  const e = entry(sid), c = e.civs[k], so = e.so[k]; if (!c || !so?.end) return;
  const war = so.end === 'war', credit = soCredit(so);
  logEv(e, k, { date, kind: war ? 'so_war' : 'so_peace', a: credit ? 1 : 0 });
  ctx.notify({ kind: 'office', title: L('원시문명 관측', 'Pre-FTL observation'), body: `${c.name}: ${soText(so)}` });
  chronNoteWorld(war ? L(`${date} 우리가 지켜보던 원시문명 「${c.name}」에서 핵전쟁이 일어났다.`, `${date} A nuclear war broke out among the pre-FTL "${c.name}" we were watching.`)
    : L(`${date} 원시문명 「${c.name}」의 핵 대치가 평화롭게 끝났다.${credit ? ' 우리의 은밀한 중재가 있었다.' : ''}`, `${date} The nuclear standoff of the pre-FTL "${c.name}" ended peacefully.${credit ? ' We quietly helped.' : ''}`), false);
  save();
}
let soBusy = false;
/** 끝난 대치를 게임에 반영(핵전쟁 피해·우리 통합력). 게임이 켜져 있을 때만, 실패하면 다음에 다시. */
async function soSettle(sid: string): Promise<void> {
  if (soBusy || sid !== ctx.curSaveId || !ctx.gameRunning || !/^\d+$/.test(sid)) return;
  soBusy = true;
  try {
    const e = entry(sid);
    for (const [k, so] of Object.entries(e.so)) {
      if (!so.on || !so.end || so.applied) continue;
      const war = so.end === 'war', bonus = soCredit(so);
      if (!war && !bonus) { so.applied = true; save(); continue; } // 그들 쪽 효과 없음 · 우리 공도 없음 → 명령 없이 끝
      try { const req = ++link.reqCounter; const m = await terminalRequest(soEndCommand(req, sid, Number(k), war, bonus), 'PFTLACT', req); const st = Math.round(Number(m.kv.st)); if (st === 1 || st === 2) { so.applied = true; save(); } }
      catch (err) { logDiagnostic('warn', 'preftl.so_end_failed', { error: (err as Error).message }); }
    }
  } finally { soBusy = false; }
  push();
}
let soMonth = '';
/** 게임 달이 바뀔 때: 진행 중인 대치만 앱이 계산(게임 명령 없음 — 결말 때만 한 번). */
function soMonthly(sid: string, date: string): void {
  const mk = sid + ':' + date.slice(0, 7); if (!date || mk === soMonth || sid !== ctx.curSaveId) return; soMonth = mk;
  const e = entry(sid), notes: string[] = []; let any = false;
  for (const [k, so] of Object.entries(e.so)) if (soActive(so) && e.civs[k] && !e.civs[k].gone) { soTouch(sid, k, date, notes); any = true; }
  if (!any && !Object.values(e.so).some((so) => so.on && so.end && !so.applied)) return;
  save(); push();
  if (notes.length) ctx.notify({ kind: 'office', title: L('원시문명 관측', 'Pre-FTL observation'), body: notes.slice(0, 3).join(' · ') });
  void soSettle(sid);
}

const collector = new PftlCollector();
const rowsByReq = new Map<string, Record<string, string>[]>();
let scanning: Promise<{ n: number; changed: number }> | null = null;

/** 관측 결과를 저장소에 합친다. 변화 기록을 남기고, 눈에 띄는 변화는 알린다. */
function merge(sid: string, date: string, rows: Record<string, string>[]): { n: number; changed: number } {
  const e = entry(sid), seen = new Set<string>(); let changed = 0; const notes: string[] = [];
  const ups: Record<string, string>[] = [];
  for (const kv of rows) {
    if (kv.up === '1') { ups.push(kv); continue; } // 예전 원시문명이 이제 정식 제국(⑤)
    const cur = parseCiv(kv, date); if (!cur) continue; const k = String(cur.id); seen.add(k);
    const prev = e.civs[k]; if (prev) cur.first = prev.first || date;
    const evs = diffCiv(prev, cur, date);
    if (evs.length) { changed++; e.log[k] = [...(e.log[k] ?? []), ...evs].slice(-LOG_KEEP); }
    if (!prev) notes.push(L(`새 원시문명: ${cur.name} (${ageName(cur.age)})`, `New pre-FTL civilization: ${cur.name} (${ageName(cur.age)})`));
    for (const ev of evs) if (prev && (ev.kind === 'age_up' || ev.kind === 'aware_up' || ev.kind === 'sit_on')) notes.push(`${cur.name}: ${eventText(ev)}`);
    e.civs[k] = cur;
    if (soTouch(sid, k, date, notes)) changed++; // 핵 대치(2026-11-05)
  }
  for (const [k, c] of Object.entries(e.civs)) if (!seen.has(k) && !c.gone) { c.gone = true; changed++; e.log[k] = [...(e.log[k] ?? []), { date, kind: 'gone' as const }].slice(-LOG_KEEP); }
  // ⑤ 기억 제국: 정식 제국이 된 나라(up=1)는 그 연락처에 기억을 적고, 그 밖에 사라진 나라는 우리 행성이면 흡수, 아니면 사라짐.
  const upIds = new Set<string>();
  for (const kv of ups) {
    const k = String(Math.round(Number(kv.id))), c = e.civs[k]; if (!c) continue; upIds.add(k);
    const idx = Math.round(Number(kv.idx)) || 0, nm = String(kv.name ?? '').trim().slice(0, 80);
    if (c.fate !== 'uplifted') { c.fate = 'uplifted'; c.gone = true; changed++; e.log[k] = [...(e.log[k] ?? []), { date, kind: 'uplift' as const }].slice(-LOG_KEEP); }
    if (nm) c.newName = nm; if (idx > 0) c.idx = idx;
    if (c.idx && !c.memDone) writeMemory(sid, c, date);
  }
  for (const [k, c] of Object.entries(e.civs)) if (c.gone && !c.fate && !upIds.has(k)) {
    const ours = !!c.planet && (gov.planetList && (!gov.planetList.sid || gov.planetList.sid === sid) ? gov.planetList.planets : []).some((p: { name?: string }) => sameName(p.name, c.planet));
    settleFate(sid, c, ours ? 'conquered' : 'lost', date); changed++;
  }
  e.lastScan = ctx.gameDate || date; save(); push(); void soSettle(sid);
  if (notes.length) ctx.notify({ kind: 'office', title: L('원시문명 관측', 'Pre-FTL observation'), body: notes.slice(0, 3).join(' · ') + (notes.length > 3 ? L(` 외 ${notes.length - 3}건`, ` and ${notes.length - 3} more`) : '') });
  logDiagnostic('info', 'preftl.scan', { n: seen.size, changed });
  return { n: seen.size, changed };
}

/** ⑤ 그 제국 연대기에 기억을 한 번 적는다(연락처 번호를 알 때). 대화 프롬프트의 연대기로 쓰이고, 오래되면 기억 장으로 남는다. */
function writeMemory(sid: string, c: Civ, date: string): void {
  if (!c.idx || c.memDone || sid !== ctx.curSaveId) return;
  const e = entry(sid), k = String(c.id), empire = ctx.playerName || L('우리 제국', 'our empire');
  chronNote(c.idx, memoryText(c, e.log[k] ?? [], e.faith[k], e.after[k] ?? [], empire, date), true);
  c.memDone = true; save();
  ctx.notify({ kind: 'office', title: L('기억을 지닌 제국', 'An empire that remembers'), body: L(`우리가 지켜보던 「${c.name}」이(가) 별의 세계로 나왔습니다. 그들은 관측 시절의 일을 기억합니다. 외교 단말기에서 만나 보세요.`, `"${c.name}", whom we watched, has reached the stars. They remember the days of observation. Meet them in the diplomatic terminal.`) });
  chronNoteWorld(L(`${date} 우리가 지켜보던 원시문명 「${c.name}」이(가) 별의 세계로 나왔다.`, `${date} The pre-FTL "${c.name}" we had been watching reached the stars.`), true);
  logDiagnostic('info', 'preftl.memory_written', {});
}
/** 정식 제국이 아닌 채 사라짐: 우리가 흡수했거나(우리 행성 목록에 그 행성) 남이 정복·멸망. */
function settleFate(sid: string, c: Civ, fate: Fate, date: string): void {
  const e = entry(sid), k = String(c.id); c.fate = fate;
  e.log[k] = [...(e.log[k] ?? []), { date, kind: fate === 'conquered' ? 'conquered' as const : 'lost' as const }].slice(-LOG_KEEP);
  if (fate === 'conquered') chronNoteWorld(conquestText(c, e.faith[k], date), true);
}
/** 연락처 목록(CONTACT_END, 3달마다·게임 명령 없음)에서 정식 제국이 된 옛 원시문명을 이름으로 찾아 기억을 잇는다. */
function onContacts(): void {
  const sid = ctx.curSaveId || ''; if (!sid || terminal.sid !== sid) return; const e = entry(sid); let ch = false;
  for (const c of Object.values(e.civs)) {
    if (c.memDone || c.fate === 'conquered' || !c.gone) continue; // 「사라짐」이었다가 같은 이름의 새 제국으로 나타나는 경우도 잇는다
    const hit = terminal.items.find((t) => (c.idx && t.idx === c.idx) || sameName(t.name, c.newName || c.name)); if (!hit) continue;
    if (c.fate !== 'uplifted') { c.fate = 'uplifted'; e.log[String(c.id)] = [...(e.log[String(c.id)] ?? []), { date: ctx.gameDate || '', kind: 'uplift' as const }].slice(-LOG_KEEP); }
    c.idx = hit.idx; c.newName = hit.name; writeMemory(sid, c, ctx.gameDate || ''); ch = true;
  }
  if (ch) { save(); push(); }
}

export async function preftlScan(): Promise<{ n: number; changed: number }> {
  if (scanning) return scanning;
  const sid = ctx.curSaveId || '';
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 관측할 수 있습니다.', 'The game must be running to observe.'));
  scanning = (async () => {
    const req = ++link.reqCounter;
    try {
      const m = await terminalRequest(preftlCommand(req, sid), 'PFTL_END', req);
      if (sid !== ctx.curSaveId) throw new Error(L('세이브가 바뀌었습니다.', 'The save changed.'));
      const rows = rowsByReq.get(String(req)) ?? []; rowsByReq.delete(String(req));
      if (m.kv.ni !== undefined) entry(sid).ni = Math.round(Number(m.kv.ni)) || 0;
      return merge(sid, String(m.kv.date || ctx.gameDate || '').slice(0, 10) || ctx.gameDate || '', rows);
    } catch (err) {
      if (/응답이 없습니다|No response/.test((err as Error).message)) throw new Error(L('게임이 답하지 않았습니다. SLLM 연결 모드가 최신인지 확인해 주세요(원시문명 관측은 이번에 추가된 기능입니다).', 'The game did not answer. Check that the SLLM link mod is up to date (pre-FTL observation is new).'));
      throw err;
    }
  })();
  try { return await scanning; } finally { scanning = null; }
}

/** 처음 접촉(모드 PFTL_FOUND): 조사선이 원시문명 행성을 조사했거나 우리 관측소가 지어졌다 → 한 번 관측. 여러 줄이 몰려도 한 번만. */
let foundTimer: ReturnType<typeof setTimeout> | null = null;
function onFound(m: SllmMessage): void {
  if (!m.kv.sid || m.kv.sid !== ctx.curSaveId || foundTimer) return;
  foundTimer = setTimeout(() => { foundTimer = null; void preftlScan().catch((e) => logDiagnostic('warn', 'preftl.found_scan_failed', { error: (e as Error).message })); }, 3000);
}

export function preftlView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', date: '', lastScan: '', items: [] as unknown[], running: false };
  const e = entry(sid);
  const items = Object.values(e.civs).sort((a, b) => Number(!!a.gone) - Number(!!b.gone) || b.age - a.age || a.name.localeCompare(b.name)).map((c) => ({
    id: c.id, name: c.name, species: c.species, planet: c.planet, age: c.age, ageName: ageName(c.age), ageMax: AGE_MAX, radio: c.age >= RADIO_AGE,
    inb: c.inb !== false, aw: c.aw, lv: c.lv, lvName: awareName(c.lv), obs: c.obs, mission: c.obs === 1 ? L(MISSION[c.mis]?.ko ?? '', MISSION[c.mis]?.en ?? '') : '', hive: c.hive,
    sit: c.sit && SITUATION[c.sit] ? L(SITUATION[c.sit].ko, SITUATION[c.sit].en) : '', first: c.first, seen: c.seen, gone: !!c.gone,
    fate: c.fate ?? '', fateText: c.fate === 'uplifted' ? L(`정식 제국이 됨${c.newName && c.newName !== c.name ? `: ${c.newName}` : ''}`, `Became a star empire${c.newName && c.newName !== c.name ? `: ${c.newName}` : ''}`) + (c.memDone ? L(' · 기억을 지님', ' · remembers us') : L(' · 연락이 닿으면 기억이 이어짐', ' · memory links once we make contact')) : c.fate === 'conquered' ? L('우리 제국에 흡수됨', 'Absorbed into our empire') : c.fate === 'lost' ? L('사라짐', 'Disappeared') : '',
    log: (e.log[String(c.id)] ?? []).slice(-12).reverse().map((x) => ({ date: x.date, text: eventText(x) })),
    reports: (e.reports[String(c.id)] ?? []).slice().reverse(),
    broadcasts: (e.bc[String(c.id)] ?? []).slice().reverse(), listenBlock: interceptBlock(c, (e.bc[String(c.id)] ?? []).slice(-1)[0], ctx.gameDate || c.seen), radioMedium: c.age >= RADIO_AGE ? L(medium(c.age).ko, medium(c.age).en) : '',
    acts: (['tech', 'aid', 'expose', 'cover', ...(soActive(e.so[String(c.id)]) ? ['calm', 'stoke', 'disarm'] : [])] as ActKey[]).map((k) => ({ key: k, name: L(ACTS[k].ko, ACTS[k].en), desc: L(ACTS[k].descKo, ACTS[k].descEn), energy: ACTS[k].energy, loud: !!ACTS[k].loud, block: actBlock(c, k, e.acts[String(c.id)]?.[k], ctx.gameDate || c.seen, e.so[String(c.id)]) })),
    standoff: soView(e.so[String(c.id)], c), // 핵 대치(2026-11-05)
    voice: (() => { const f = e.faith[String(c.id)], s = sessions.get(sessKey(sid, c.id)); return {
      block: s ? '' : voiceBlock(c, f, ctx.gameDate || c.seen), active: !!s, speaker: s?.speaker ?? '', left: s ? VOICE.turns - s.turns.filter((t) => t.who === 'us').length : VOICE.turns,
      risk: s?.risk ?? 0, awIfEnd: s ? voiceAwareness(s.risk) : 0, teachIfEnd: s ? Math.round(teachProgress(s.teach) / 19.2) : 0, tp: c.tp ?? -1,
      after: (e.after[String(c.id)] ?? []).slice().reverse().map((a) => ({ date: a.date, kind: L(AFTER[a.kind].ko, AFTER[a.kind].en), headline: a.headline, body: a.body, llm: a.llm })),
      turns: (s?.turns ?? []).map((t) => ({ who: t.who, text: t.text, speaker: t.speaker ?? '', mood: t.mood ? L(...MOOD_NAME[t.mood]) : '', risk: t.risk ?? 0, teach: t.teach ?? 0 })),
      faith: f && f.sessions ? { name: f.name, devotion: f.devotion, sessions: f.sessions, text: faithText(f) } : null,
    }; })(),
    missions: (['m_passive', 'm_specimen', 'm_none'] as ActKey[]).map((k) => ({ key: k, name: L(ACTS[k].ko, ACTS[k].en), current: c.obs === 1 && c.mis === ACTS[k].mission, block: actBlock(c, k, undefined, ctx.gameDate || c.seen) })),
  }));
  return { sid, date: ctx.gameDate || '', lastScan: e.lastScan ?? '', items, running: ctx.gameRunning, warn: resolutionWarning(e.ni ?? 0) };
}
function push(): void { try { const v = preftlView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('preftlUpdate', v); } catch { /* 창 없음 */ } }

/** 신앙 한 줄을 LLM 요청(두 번째 메시지 = 사실 목록)에 붙인다. */
function withFaith<T extends { role: string; content: string }>(msgs: T[], f: Faith | undefined, so?: Standoff): T[] { const fl = [faithLine(f), soFact(so)].filter(Boolean).join('\n'); if (fl && msgs[1]) msgs[1] = { ...msgs[1], content: msgs[1].content + '\n' + fl }; return msgs; }
/** 하늘의 목소리 교신마다 쌓인 calm 합(대치 중일 때만, 2026-11-05). */
const calmSum = new Map<string, number>();

/** 하늘의 목소리(②): 말 한 번 = LLM 한 번(게임 명령 없음). 교신을 마칠 때만 게임에 인지도 명령 한 번. */
async function voiceSay(idIn: unknown, textIn: unknown): Promise<{ done?: string }> {
  const sid = ctx.curSaveId || '', id = Number(idIn), date = ctx.gameDate || '', text = String(textIn ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  if (!text) throw new Error(L('하늘에서 할 말을 적어 주세요.', 'Write what the voice will say.'));
  const e = entry(sid), c = e.civs[String(id)]; if (!c) throw new Error(L('그 원시문명을 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found. Observe again.'));
  const k = sessKey(sid, id); let s = sessions.get(k);
  if (!s) { const why = voiceBlock(c, e.faith[String(id)], date); if (why) throw new Error(why); s = { id, date, turns: [], speaker: '', risk: 0, teach: 0 }; }
  const f = e.faith[String(id)] ?? emptyFaith(), empire = ctx.playerName || L('우리 제국', 'Our empire');
  let r;
  const so = e.so[String(id)], soOn = soActive(so);
  let vm = voiceMessages(c, f, s, empire, text);
  if (soOn && vm[1]) vm = vm.map((m, i) => (i === 1 ? { ...m, content: m.content + '\n' + soFact(so) + '\nAlso add to your JSON "calm": -2..2 — how much this exchange pushes their rival powers toward war (-) or toward peace (+). Most words change nothing (0).' } : m));
  try { const raw = await ctx.ai.chat(vm, { purpose: 'preftl-voice', json: true, maxTokens: VOICE.maxTokens }); r = parseVoice(raw); if (r && soOn) calmSum.set(k, (calmSum.get(k) ?? 0) + parseCalm(raw)); }
  catch (err) { throw new Error(L('AI가 답하지 못했습니다: ', 'The AI did not answer: ') + redactKey((err as Error).message)); }
  if (!r) throw new Error(L('AI 답을 이해하지 못했습니다. 다시 말해 보세요.', 'Could not understand the AI reply. Try again.'));
  sessions.set(k, s);
  if (!s.speaker && r.speaker) s.speaker = r.speaker;
  s.turns.push({ who: 'us', text }, { who: 'them', text: r.reply, speaker: r.speaker || s.speaker, mood: r.mood, risk: r.risk, teach: r.teach });
  s.risk += r.risk; s.teach += r.teach; applyReply(f, r); e.faith[String(id)] = f; save();
  if (s.turns.filter((t) => t.who === 'us').length >= VOICE.turns) return { done: await voiceEnd(id) };
  push(); return {};
}
/** 교신 끝: 인지도(위험도 합)·기술 진척(가르친 만큼) → 기록 → 후일담(LLM) → 한 번 다시 관측. */
async function voiceEnd(idIn: unknown): Promise<string> {
  const sid = ctx.curSaveId || '', id = Number(idIn), k = sessKey(sid, id), s = sessions.get(k); if (!sid || !s) throw new Error(L('진행 중인 교신이 없습니다.', 'There is no conversation in progress.'));
  const e = entry(sid), c = e.civs[String(id)], f = e.faith[String(id)] ?? emptyFaith(), date = ctx.gameDate || s.date;
  sessions.delete(k); f.sessions++; f.last = date; e.faith[String(id)] = f;
  const cs = calmSum.get(k) ?? 0; calmSum.delete(k);
  let soNote = '';
  if (cs && soActive(e.so[String(id)])) { const d = voiceDelta(cs); e.so[String(id)] = soPush(e.so[String(id)], d, date); soNote = d < 0 ? L(` 그들의 핵 대치가 누그러졌습니다(긴장 ${d}).`, ` Their nuclear standoff eased (tension ${d}).`) : L(` 그들의 핵 대치가 더 팽팽해졌습니다(긴장 +${d}).`, ` Their nuclear standoff grew tenser (tension +${d}).`); if (e.so[String(id)].end) soEnded(sid, String(id), date); }
  const aw = voiceAwareness(s.risk), prog = teachProgress(s.teach);
  e.log[String(id)] = [...(e.log[String(id)] ?? []), { date, kind: 'voice' as const, a: aw }].slice(-LOG_KEEP); save();
  let applied = false;
  if (ctx.gameRunning && /^\d+$/.test(sid)) { try { const req = ++link.reqCounter; await terminalRequest(voiceCommand(req, sid, id, aw, prog), 'PFTLACT', req); applied = true; } catch (err) { logDiagnostic('warn', 'preftl.voice_aw_failed', { error: (err as Error).message }); } }
  // 후일담: 종류는 다양하게 고르고, 글은 LLM(실패하면 틀 문장). 신앙 열성도에도 반영.
  let aft: Aftermath | null = null;
  if (c && s.turns.length) {
    const kind = pickAfter(c.lv, s.risk, f.devotion);
    try { const raw = await ctx.ai.chat(afterMessages(c, f, s, kind, date), { purpose: 'preftl-aftermath', json: true, maxTokens: AFTER_MAX_TOKENS }); aft = parseAfter(raw, kind, date); const nt = afterNote(raw); if (aft && nt) f.notes = [...f.notes, nt].slice(-VOICE.keepNotes); }
    catch (err) { logDiagnostic('warn', 'preftl.aftermath_failed', { error: redactKey((err as Error).message) }); }
    aft ??= templateAfter(c, s, kind, date);
    f.devotion = Math.max(0, Math.min(100, f.devotion + AFTER[kind].dev));
    e.after[String(id)] = [...(e.after[String(id)] ?? []), aft].slice(-VOICE.keepAfter); save();
  }
  try { if (applied) await preftlScan(); else push(); } catch { push(); }
  const pct = Math.round(prog / 19.2), extra = (prog ? L(` 가르친 지식으로 다음 시대까지의 기술 진척이 ${pct}% 올랐습니다.`, ` What we taught advanced their progress toward the next age by ${pct}%.`) : '') + (aft ? L(` 그 뒤: 「${aft.headline}」`, ` Afterwards: "${aft.headline}"`) : '');
  void soSettle(sid);
  return soNote.trim() ? (applied ? L(`교신을 마쳤습니다. 인지도가 ${aw} 올랐습니다.`, `The conversation is over. Awareness +${aw}.`) + soNote + extra : L(`교신을 마쳤습니다.`, `The conversation is over.`) + soNote) : (applied ? L(`교신을 마쳤습니다. 인지도가 ${aw} 올랐습니다.`, `The conversation is over. Awareness +${aw}.`)
    : L(`교신을 마쳤습니다. 게임에 인지도(+${aw})를 반영하지 못했습니다. 게임이 켜져 있는지 확인해 주세요.`, `The conversation is over, but awareness (+${aw}) could not be applied. Check that the game is running.`)) + (applied ? extra : (aft ? L(` 그 뒤: 「${aft.headline}」`, ` Afterwards: "${aft.headline}"`) : ''));
}

/** 개입(③): 게임에 한 번 명령 → 회신 PFTLACT. 하면 기록·쿨다운을 남기고 그 문명을 한 번 다시 관측한다. */
async function act(idIn: unknown, keyIn: unknown): Promise<{ text: string }> {
  const sid = ctx.curSaveId || '', id = Number(idIn), date = ctx.gameDate || '';
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 개입할 수 있습니다.', 'The game must be running to intervene.'));
  if (!isActKey(keyIn)) throw new Error(L('개입 종류를 골라 주세요.', 'Choose an intervention.'));
  const e = entry(sid), c = e.civs[String(id)]; if (!c) throw new Error(L('그 원시문명을 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found. Observe again.'));
  const key = keyIn, why = actBlock(c, key, e.acts[String(id)]?.[key], date, e.so[String(id)]); if (why) throw new Error(why);
  const req = ++link.reqCounter, failed = key === 'disarm' && Math.random() >= SO.act.disarmChance; // 핵무기 무력화는 앱 주사위(실패하면 게임이 인지도 +15)
  let m: SllmMessage;
  try { m = await terminalRequest(actCommand(req, sid, id, key, failed), 'PFTLACT', req); }
  catch (err) { if (/응답이 없습니다|No response/.test((err as Error).message)) throw new Error(L('게임이 답하지 않았습니다. SLLM 연결 모드가 최신인지 확인해 주세요(개입은 이번에 추가된 기능입니다).', 'The game did not answer. Check that the SLLM link mod is up to date (interventions are new).')); throw err; }
  const r = actResult(Math.round(Number(m.kv.st)), key); if (!r.ok) throw new Error(r.text);
  (e.acts[String(id)] ??= {})[key] = date;
  e.log[String(id)] = [...(e.log[String(id)] ?? []), { date, kind: 'act' as const, a: ACTS[key].w }].slice(-LOG_KEEP); save();
  let soNote = '';
  if (key === 'calm' || key === 'stoke' || key === 'disarm') { // 핵 대치 긴장 옮기기(2026-11-05)
    const d = key === 'calm' ? SO.act.calm : key === 'stoke' ? SO.act.stoke : failed ? SO.act.disarmFail : SO.act.disarmOk;
    e.so[String(id)] = soPush(e.so[String(id)], d, date); save();
    soNote = key === 'disarm' ? (failed ? L(` 하지만 실패했습니다 — 긴장 +${d}, 그들이 무언가를 눈치챘습니다(인지도 +15).`, ` But it failed — tension +${d}, and they noticed something (awareness +15).`) : L(` 성공했습니다 — 긴장 ${d}.`, ` It worked — tension ${d}.`)) : L(` 긴장 ${d > 0 ? '+' : ''}${d}.`, ` Tension ${d > 0 ? '+' : ''}${d}.`);
    if (e.so[String(id)].end) { soEnded(sid, String(id), date); void soSettle(sid); }
  }
  if (key === 'tech') chronNoteWorld(L(`${date} 원시문명 「${c.name}」에 몰래 기술을 전해 다음 시대로 끌어올렸다.`, `${date} Secretly passed technology to the pre-FTL "${c.name}", lifting them into the next age.`), false);
  logDiagnostic('info', 'preftl.act', { key });
  try { await preftlScan(); } catch { push(); } // 바뀐 시대·인지도를 한 번 다시 읽는다(사용자가 한 일이라 명령 한 번)
  return { text: r.text + soNote };
}

/** 방송 감청(④): 저장된 관측 정보로만 만든다(게임 명령 없음). 한 문명당 게임 1달에 한 번. */
async function intercept(idIn: unknown, llmIn: unknown): Promise<{ broadcast: Broadcast; note?: string }> {
  const sid = ctx.curSaveId || '', id = Number(idIn); if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const e = entry(sid), c = e.civs[String(id)]; if (!c) throw new Error(L('그 원시문명을 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found. Observe again.'));
  const date = ctx.gameDate || c.seen, list = e.bc[String(id)] ?? [], why = interceptBlock(c, list[list.length - 1], date); if (why) throw new Error(why);
  const tpl = templateBroadcast(c, date), ft = faithText(e.faith[String(id)]); if (ft) { const ls = tpl.body.split('\n'); ls.splice(Math.max(0, ls.length - 1), 0, ft); tpl.body = ls.join('\n'); } let b = tpl, note: string | undefined;
  if (llmIn === true) {
    try { b = parseBroadcast(await ctx.ai.chat(withFaith(broadcastMessages(c, date, list), e.faith[String(id)], e.so[String(id)]), { purpose: 'preftl-broadcast', maxTokens: BROADCAST_MAX_TOKENS }), c, date, tpl.title) ?? tpl; if (b === tpl) note = L('AI 답이 비어 기본 방송으로 채웠습니다.', 'The AI reply was empty, so a standard broadcast was used.'); }
    catch (err) { note = L('AI가 방송을 쓰지 못해 기본 방송으로 채웠습니다: ', 'The AI could not write the broadcast, so a standard one was used: ') + redactKey((err as Error).message); }
  }
  e.bc[String(id)] = [...list, b].slice(-BROADCAST_KEEP); save(); push();
  return { broadcast: b, ...(note ? { note } : {}) };
}

async function writeReport(idIn: unknown, llmIn: unknown): Promise<{ report: Report; note?: string }> {
  const sid = ctx.curSaveId || '', id = Number(idIn); if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const e = entry(sid), c = e.civs[String(id)]; if (!c) throw new Error(L('그 원시문명을 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found. Observe again.'));
  const date = ctx.gameDate || c.seen, empire = ctx.playerName || L('우리 제국', 'Our empire'), evs = e.log[String(id)] ?? [];
  const tpl = templateReport(c, evs, date, empire), ft = faithText(e.faith[String(id)]); if (ft) tpl.body += '\n' + ft; const st = soText(e.so[String(id)]); if (st) tpl.body += '\n' + st; let rep = tpl, note: string | undefined;
  if (llmIn === true) {
    try { rep = parseReport(await ctx.ai.chat(withFaith(reportMessages(c, evs, date, empire), e.faith[String(id)], e.so[String(id)]), { purpose: 'preftl-report', maxTokens: REPORT_MAX_TOKENS }), date, tpl.title) ?? tpl; if (rep === tpl) note = L('AI 답이 비어 기본 보고서로 썼습니다.', 'The AI reply was empty, so the standard report was used.'); }
    catch (err) { note = L('AI 보고서를 쓰지 못해 기본 보고서로 썼습니다: ', 'Could not write the AI report, so the standard report was used: ') + redactKey((err as Error).message); }
  }
  e.reports[String(id)] = [...(e.reports[String(id)] ?? []), rep].slice(-REPORT_KEEP); save(); push();
  return { report: rep, ...(note ? { note } : {}) };
}

export function registerPreftl(router: LogRouter): void {
  router.on(SLOT.PREFTL, 'preftl', (m: SllmMessage) => {
    if (m.kind === 'PFTL_FOUND') { onFound(m); return; }
    if (m.kind === 'CONTACT_END') { try { onContacts(); } catch (err) { logDiagnostic('warn', 'preftl.contacts_failed', { error: String(err) }); } return; }
    if (m.kind === 'PFTLACT') { terminalReplies.get('PFTLACT:' + Math.round(Number(m.kv.req)))?.(m); return; }
    if (m.kind !== 'PFTL' && m.kind !== 'PFTL_END') return;
    const r = collector.feed(m.kind, m.kv); if (!r) return;
    rowsByReq.set(r.req, r.rows); if (rowsByReq.size > 8) rowsByReq.delete(rowsByReq.keys().next().value as string);
    terminalReplies.get('PFTL_END:' + r.req)?.(m);
  });
  registerSecFacts({ id: 'Pre-FTL civilizations', kw: ['원시', '원시문명', '관측소', '인지도', 'primitive', 'pre-ftl', 'preftl', 'observation post', 'awareness', '감청', '방송', 'broadcast', 'intercept', '하늘의 목소리', '신앙', 'voice from the sky'], facts: (sid) => {
    if (sid !== ctx.curSaveId) return []; const e = entry(sid); const mem = preftlCivs(sid).filter((c) => c.fate).slice(0, 6).map((c) => memoryFact(c, c.fate as Fate, e.faith[String(c.id)]));
    return [...mem, ...preftlCivs(sid).filter((c) => !c.gone).slice(0, 8).flatMap((c) => { const b = (e.bc[String(c.id)] ?? []).slice(-1)[0]; const fa = e.faith[String(c.id)]; const sf = soFact(e.so[String(c.id)]); return [civFact(c), ...(b ? [broadcastFact(c.name, b)] : []), ...(fa && fa.sessions ? [faithFact(c.name, fa)] : []), ...(sf ? [`Pre-FTL ${c.name}: ${sf}`] : [])]; })];
  } });
  onGameSnapshot((snap) => { if (snap.sid && snap.sid === ctx.curSaveId) { try { soMonthly(snap.sid, snap.date || ctx.gameDate || ''); } catch (err) { logDiagnostic('warn', 'preftl.so_monthly_failed', { error: String(err) }); } } }, 'preftl'); // 핵 대치(2026-11-05)
  ipcMain.handle('preftlState', async () => preftlView());
  // 화면을 열 때: 이 게임 날짜에 아직 안 읽었으면 그때만 읽는다(일시정지 중 여러 번 열어도 한 번).
  ipcMain.handle('preftlOpen', async () => { const sid = ctx.curSaveId || '', today = ctx.gameDate || ''; if (!sid || !ctx.gameRunning || !today || entry(sid).lastScan === today) return { ok: true, scanned: false, state: preftlView() }; try { const r = await preftlScan(); return { ok: true, scanned: true, ...r, state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
  ipcMain.handle('preftlScan', async () => { try { const r = await preftlScan(); return { ok: true, ...r, state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
  ipcMain.handle('preftlVoiceSay', async (_e, id: unknown, text: unknown) => { try { return { ok: true, ...(await voiceSay(id, text)), state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
  ipcMain.handle('preftlVoiceEnd', async (_e, id: unknown) => { try { return { ok: true, text: await voiceEnd(id), state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
  ipcMain.handle('preftlAct', async (_e, id: unknown, key: unknown) => { try { return { ok: true, ...(await act(id, key)), state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
  ipcMain.handle('preftlIntercept', async (_e, id: unknown, llm: unknown) => { try { return { ok: true, ...(await intercept(id, llm)), state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
  ipcMain.handle('preftlReport', async (_e, id: unknown, llm: unknown) => { try { return { ok: true, ...(await writeReport(id, llm)), state: preftlView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlView() }; } });
}
