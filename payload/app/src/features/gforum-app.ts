// 갤럭틱 포럼(2026-11-04 사용자, 4chan /int/ 형식) — 앱 쪽. 규칙: src/gforum.ts · 화면: ui/office-gforum.js(집무실 「인터넷」 창의 네 번째 탭)
// 글감 = 세계 소식(연대기 WORLD_IDX, 신문 1면 줄: 굴욕 조약·치욕의 조약·참전·약속 파기 등). 탭을 열거나 ⟳ 를 누를 때만, 새 소식이 있을 때만 스레드를 만든다(한 번에 최대 2개).
// 글쓴이 = 통신이 닿는 일반 제국들의 시민(국기) + 우리 시민. 기계 지성·군체 제국은 시민 글이 없다.
// 저장: sllm_gforum.json { saves: { [세이브]: { threads, seen, month, n } } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminal } from './terminal';
import { WORLD_IDX } from './chronicle-app';
import { playerGestalt } from './gestalt-app';
import { cmpDate } from '../gamedate';
import { GFORUM, stanceOf, xenoLevel, xenoJoins, gfThreadMessages, gfChatMessages, readThread, gfReplyMessages, readReplies, cleanMine, type GfPoster, type GfThread, type GfPost } from '../gforum';

interface GfSave { threads: GfThread[]; seen: string[]; month: string; n: number; since: string }
const file = () => path.join(app.getPath('userData'), 'sllm_gforum.json');
let all: Record<string, GfSave> | null = null;
const books = (): Record<string, GfSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): GfSave => { const s = (books()[sid] ??= { threads: [], seen: [], month: '', n: 0, since: '' }); s.threads ??= []; s.seen ??= []; return s; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'gforum.save_failed', { error: (e as Error).message }); } };
const key = (t: string) => createHash('sha1').update(t).digest('hex').slice(0, 12);
const seedOf = (s: string) => parseInt(key(s).slice(0, 7), 16);

/** 글쓴이 목록: 통신이 닿는 일반 제국(최대 7, 전쟁·경쟁국 먼저) + 우리 제국. 단일 의식 제국은 뺀다. */
function postersNow(): GfPoster[] {
  const out: GfPoster[] = [];
  const cs = terminal.items.filter((c) => c.type === 'default').slice().sort((a, b) => Number(!!b.em?.war) - Number(!!a.em?.war) || Number(!!b.em?.rival) - Number(!!a.em?.rival) || Math.abs(b.score) - Math.abs(a.score));
  for (const c of cs) {
    const p = ctx.profileWithEthics(ctx.profiles.get(c.idx) ?? ctx.mailCountries.get(c.idx)?.profile, c.idx);
    const eth = (p?.ethicsText ?? '').replace(/\s+/g, ' ').slice(0, 160); if (/gestalt|단일 의식|machine intelligence|hive mind/i.test(eth)) continue;
    const xeno = xenoLevel(ctx.flagProv.ethicsFor(c.idx) ?? [], eth, ctx.flagProv.natureFor?.(c.idx)?.civics ?? []);
    if (!xenoJoins(xeno, Math.random())) continue; // 외계인혐오 제국 시민은 은하 공용망을 잘 안 쓴다(2026-11-04 사용자)
    out.push({ n: out.length + 1, idx: c.idx, empire: c.name, ethics: eth, stance: stanceOf(c.score), war: !!c.em?.war, rival: !!c.em?.rival, ours: false, xeno });
    if (out.length >= 7) break;
  }
  const me = ctx.profileWithEthics(ctx.profiles.get(ctx.playerIdx), ctx.playerIdx);
  out.push({ n: out.length + 1, idx: ctx.playerIdx, empire: ctx.playerName || L('우리 제국', 'our empire'), ethics: (me?.ethicsText ?? '').replace(/\s+/g, ' ').slice(0, 160), stance: '', war: false, rival: false, ours: true, xeno: xenoLevel(ctx.flagProv.ethicsFor(ctx.playerIdx) ?? [], me?.ethicsText ?? '', ctx.flagProv.natureFor?.(ctx.playerIdx)?.civics ?? []) });
  return out;
}
/** 마지막으로 본 날 뒤의 세계 소식(오래된 것부터 최대 n). */
function newsSince(sid: string, s: GfSave): Array<{ date: string; text: string }> {
  try {
    const g = ctx.chron().groups(sid).find((x) => x.idx === WORLD_IDX); if (!g) return [];
    return g.items.filter((it) => it.date && (!s.since || cmpDate(it.date, s.since) >= 0) && !s.seen.includes(key(it.text)))
      .map((it) => ({ date: it.date, text: it.text.replace(/^\d+\.\d+\.\d+\s*/, '').trim() })).filter((x) => x.text.length >= 6)
      .sort((a, b) => cmpDate(b.date, a.date)).slice(0, GFORUM.perRefresh).reverse();
  } catch { return []; }
}
export function gforumView() {
  const sid = ctx.curSaveId, gest = !!playerGestalt();
  if (!sid) return { ok: false, error: L('세이브를 불러오면 접속할 수 있습니다.', 'Load a save to go online.') };
  return { ok: true, gestalt: gest, us: ctx.playerIdx, empire: ctx.playerName, date: ctx.gameDate || '', threads: saveOf(sid).threads.slice().reverse() };
}
async function makeThreads(sid: string, force: boolean): Promise<{ made: number; why?: string }> {
  const s = saveOf(sid), month = (ctx.gameDate || '').slice(0, 7);
  if (s.month !== month) { s.month = month; s.n = 0; }
  if (force && s.n >= GFORUM.sameMonth) return { made: 0, why: 'month' };
  const news = newsSince(sid, s), posters = postersNow(); if (posters.length < 2) return { made: 0, why: 'nobody' };
  // 새 소식이 없으면 잡담 스레드 하나(⟳ 를 누르면 국내망처럼 늘 새 글, 2026-11-04 사용자). 처음 열 때는 스레드가 하나도 없을 때만.
  if (!news.length) {
    if (!force && s.threads.length) return { made: 0, why: 'quiet' };
    s.n += 1; const recent = s.threads.slice(-8).map((t) => t.title);
    try {
      const raw = String(await ctx.ai.chat(gfChatMessages(recent, posters, ctx.playerName || 'our empire'), { maxTokens: 1800, purpose: 'galactic-forum', json: true }) ?? '');
      const th = readThread(raw, posters, seedOf((ctx.gameDate || '') + s.threads.length + Date.now()));
      if (th) { s.threads.push({ id: key(th.title + (ctx.gameDate || '') + Date.now()), date: ctx.gameDate || '', title: th.title, event: L('일상 잡담', 'Off-topic chatter'), posts: th.posts, kind: 'chat' }); while (s.threads.length > GFORUM.keep) s.threads.shift(); save(); return { made: 1 }; }
    } catch (e) { logDiagnostic('warn', 'gforum.chat_failed', { error: (e as Error).message }); }
    save(); return { made: 0, why: 'failed' };
  }
  s.n += 1; let made = 0;
  for (const ev of news) {
    s.seen.push(key(ev.text)); if (s.seen.length > 300) s.seen.splice(0, s.seen.length - 300);
    try {
      const raw = String(await ctx.ai.chat(gfThreadMessages(ev.text, posters, ctx.playerName || 'our empire'), { maxTokens: 1800, purpose: 'galactic-forum', json: true }) ?? '');
      const th = readThread(raw, posters, seedOf(ev.text)); if (!th) continue;
      s.threads.push({ id: key(ev.text + ev.date), date: ev.date, title: th.title, event: ev.text, posts: th.posts }); made++;
    } catch (e) { logDiagnostic('warn', 'gforum.thread_failed', { error: (e as Error).message }); }
  }
  while (s.threads.length > GFORUM.keep) s.threads.shift();
  s.since = ctx.gameDate || s.since; save();
  return { made };
}

export function registerGForum(): void {
  ipcMain.handle('gforumState', () => gforumView());
  ipcMain.handle('gforumRefresh', async (_e, force?: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return gforumView();
    if (playerGestalt()) return { ...gforumView(), made: 0 };
    const r = await makeThreads(sid, !!force);
    return { ...gforumView(), made: r.made, why: r.why ?? '' };
  });
  ipcMain.handle('gforumReply', async (_e, a: { id?: unknown; text?: unknown; official?: unknown; to?: unknown }) => {
    try {
      const sid = ctx.curSaveId, th = sid ? saveOf(sid).threads.find((x) => x.id === a?.id) : undefined, text = cleanMine(a?.text);
      if (!sid || !th) throw new Error(L('스레드를 다시 열어 주세요.', 'Reopen the thread.'));
      if (!text) throw new Error(L('내용을 적어 주세요.', 'Write something first.'));
      const lastNo = th.posts[th.posts.length - 1]?.no ?? 1000000, to = Number(a?.to);
      const mine: GfPost = { no: lastNo + 5, idx: ctx.playerIdx, empire: ctx.playerName || L('우리 제국', 'our empire'), text, mine: true, ...(a?.official ? { official: true } : {}), ...(th.posts.some((p) => p.no === to) ? { to } : {}) };
      th.posts.push(mine); save();
      try {
        const posters = postersNow().filter((p) => !p.ours || !a?.official);
        const raw = String(await ctx.ai.chat(gfReplyMessages(th, mine, posters, ctx.playerName || 'our empire'), { maxTokens: 700, purpose: 'galactic-forum', json: true }) ?? '');
        th.posts.push(...readReplies(raw, posters, mine.no, mine.no)); save();
      } catch (e) { logDiagnostic('warn', 'gforum.reply_ai_failed', { error: (e as Error).message }); }
      return { ok: true, view: gforumView() };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
}
