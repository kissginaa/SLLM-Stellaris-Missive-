// ChatSyncAuto 참고 기억 기능(2026-10-28) 앱 쪽 — 규칙은 ../memory-links.ts.
//  1. 들은 말 퍼지기: chat.ts 가 답의 heard 꼬리표를 noteHeard 로 넘긴다 → 게임에 상대의 동맹·우호국을 묻고(RUMORNET) 앱이 확률을 굴린다.
//  2. 관련 기억: olderMemories(chat.ts 가 발언마다 부름).
//  3. 장(章): 연대기 상한에서 밀려난 줄을 모아(제국마다 20줄) 한 번 압축. 원문은 sllm_chron_archive.jsonl 에 줄마다 보관.
//  4. 인물 카드: backstory-app 이 cardPrompt 를 쓴다.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { pick as L, selectedLanguage } from './settings-ui';
import { terminalRequest, terminalReplies } from './terminal';
import { chron, chronNote } from './chronicle-app';
import { onGameSnapshot } from './gamestate-app';
import { chronKey, type ChronEntry } from '../chronicle';
import { cmpDate, addYears } from '../gamedate';
import {
  type Heard, type Friend, type Chapter, friendFrom, rumorNetCommand, rollSpread, heardLine, saidLine, pickOlder, situationWords,
  CHAPTER, chapterMessages, chapterLines,
} from '../memory-links';

interface Rumor { id: number; from: number; fromName: string; heard: Heard; date: string; done: boolean; to: number[] }
interface MemFile { rumors: Record<string, Rumor[]>; chapters: Record<string, Chapter[]>; pend: Record<string, ChronEntry[]>; seq: number }
const file = () => path.join(app.getPath('userData'), 'sllm_memory_links.json');
const archiveFile = () => path.join(app.getPath('userData'), 'sllm_chron_archive.jsonl');
let data: MemFile | null = null;
function all(): MemFile {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { rumors: j?.rumors ?? {}, chapters: j?.chapters ?? {}, pend: j?.pend ?? {}, seq: Number(j?.seq) || 0 }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'memory_links', error: e }); data = { rumors: {}, chapters: {}, pend: {}, seq: 0 }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'memory_links', error: e }); } }
const isKo = () => selectedLanguage() === 'ko'; // i18n-data: 장(章) 압축 자료의 언어 고르기

// ---- 1. 들은 말이 퍼지기
/** 외교 대화의 답에 꼬리표가 붙었을 때(chat.ts). 들은 제국의 연대기에도 한 줄 남긴다. */
export function noteHeard(listener: { idx: number; name: string }, h: Heard): void {
  const sid = ctx.curSaveId; if (!sid || !(listener.idx > 0)) return;
  const player = ctx.playerName || L('플레이어 제국', 'the player empire');
  chronNote(listener.idx, saidLine(h, player, isKo()));
  const d = all(); const list = (d.rumors[sid] ??= []);
  const r: Rumor = { id: ++d.seq, from: listener.idx, fromName: listener.name, heard: h, date: ctx.gameDate || '', done: false, to: [] };
  list.push(r); while (list.length > 60) list.shift(); save();
  void spread(sid, r);
}
const nets = new Map<number, Friend[]>(); // req → 모은 친구
let spreading = false;
async function spread(sid: string, r: Rumor): Promise<void> {
  if (r.done || spreading || !ctx.gameRunning || !link.sessionReady || ctx.curSaveId !== sid) return; // 게임이 꺼져 있으면 다음 달에 다시
  spreading = true; const req = ++link.reqCounter; nets.set(req, []);
  try {
    await terminalRequest(rumorNetCommand(req, r.from), 'RUMORNETEND', req);
    if (ctx.curSaveId !== sid) return;
    const hits = rollSpread(nets.get(req) ?? [], [r.from, ctx.playerIdx], Math.random);
    const player = ctx.playerName || L('플레이어 제국', 'the player empire');
    for (const f of hits) { chronNote(f.idx, heardLine(r.heard, player, r.fromName, isKo())); r.to.push(f.idx); }
    r.done = true; save();
    if (hits.length) logDiagnostic('info', 'memory.rumor_spread', { from: r.from, to: hits.map((f) => f.idx) });
  } catch (e) { logDiagnostic('warn', 'memory.rumor_failed', { error: (e as Error).message }); }
  finally { nets.delete(req); spreading = false; }
}
/** 다음 달: 못 굴린 말(1년 안)만 다시. */
async function retryRumors(sid: string): Promise<void> {
  const list = all().rumors[sid] ?? []; const today = ctx.gameDate || '';
  for (const r of list) { if (r.done) continue; if (today && r.date && cmpDate(addYears(r.date, 1), today) < 0) { r.done = true; continue; } await spread(sid, r); }
}

// ---- 2. 관련 있는 기억
/** 이 제국과의 연대기 중 최근 recent 줄보다 오래된 것에서, 지금 상황·발언과 맞는 것 최대 3줄. */
export function olderMemories(idx: number, flags: Record<string, boolean> | undefined, said: string, recent = 8): string[] {
  const sid = ctx.curSaveId; if (!sid || !(idx > 0)) return [];
  try {
    const own = ctx.govMem().split(sid, chron().list(chronKey(sid, idx))).own.filter((e) => !e.world);
    const names: string[] = [];
    for (const c of ctx.mailCountries.values()) { if (!c.name || c.idx === idx) continue; if (said.includes(c.name) || c.profile?.flags?.war) names.push(c.name); }
    return pickOlder(own, recent, { names, words: situationWords(flags, said) });
  } catch { return []; }
}

// ---- 3. 장(章)
function onTrim(sid: string, idx: number, dropped: ChronEntry[]): void {
  const k = chronKey(sid, idx);
  try { fs.appendFileSync(archiveFile(), dropped.map((e) => JSON.stringify({ k, ...e })).join('\n') + '\n', 'utf8'); } catch (e) { logDiagnostic('warn', 'storage.write_failed', { store: 'chron_archive', error: e }); }
  const d = all(); const p = (d.pend[k] ??= []); p.push(...dropped.filter((e) => !e.world)); save();
  if (p.length >= CHAPTER.batch) void compress(sid, idx);
}
const compressing = new Set<string>();
async function compress(sid: string, idx: number): Promise<void> {
  const k = chronKey(sid, idx); if (compressing.has(k)) return; compressing.add(k);
  try {
    const d = all(); const take = (d.pend[k] ?? []).slice(0, CHAPTER.batch * 2); if (take.length < CHAPTER.batch) return;
    const own = ctx.govMem().split(sid, take).own; // 지금 시간선의 줄만
    if (!own.length) { d.pend[k] = (d.pend[k] ?? []).slice(take.length); save(); return; }
    const name = ctx.mailCountries.get(idx)?.name || String(idx);
    const raw = await ctx.ai.chat(chapterMessages(name, ctx.playerName || 'the player empire', own, isKo() ? 'ko' : 'en'), { purpose: 'memory', maxTokens: 900, json: true });
    let text = ''; try { const m = /\{[\s\S]*\}/.exec(raw); text = String(JSON.parse(m ? m[0] : raw)?.chapter ?? '').replace(/\s+/g, ' ').trim().slice(0, 700); } catch { text = ''; }
    if (!text) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'memory_chapter', chars: String(raw || '').length }); return; }
    const cs = (d.chapters[k] ??= []); cs.push({ from: own[0].date, to: own[own.length - 1].date, text }); while (cs.length > CHAPTER.keep) cs.shift();
    d.pend[k] = (d.pend[k] ?? []).slice(take.length); save();
  } catch (e) { logDiagnostic('warn', 'memory.chapter_failed', { error: (e as Error).message }); }
  finally { compressing.delete(k); }
}
/** 대화 프롬프트에 넣을 최근 장 2개(없으면 []). main.ts withLore 가 부른다. */
export function chaptersFor(idx: number): string[] { const sid = ctx.curSaveId; if (!sid || !(idx > 0)) return []; return chapterLines(all().chapters[chronKey(sid, idx)] ?? []); }

export function registerMemoryLinks(router: LogRouter): void {
  chron().onTrim = onTrim;
  router.on(SLOT.MEMORY, 'memory-links', (m: SllmMessage) => {
    if (m.kind === 'RUMORNET') { const f = friendFrom(m.kv); const list = nets.get(Number(m.kv.req)); if (f && list) list.push(f); }
    else if (m.kind === 'RUMORNETEND') terminalReplies.get('RUMORNETEND:' + m.kv.req)?.(m);
  });
  onGameSnapshot((snap) => { if (snap.sid && snap.sid === ctx.curSaveId) void retryRumors(snap.sid); });
}
