// 「인터넷」(2026-10-28) 앱 연결. 규칙: src/internet.ts, 화면: ui/office-internet.js(집무실 「제국 안의 사람들」 묶음).
// 글은 열 때·⟳ 때만 만든다: 틀이 작성자·주제·입장·인기를 정하고 사이트당 LLM 1번으로 본문을 쓴다(사용자 확정 2026-10-28).
// 댓글은 글을 누를 때 LLM 1번(인기 댓글 최대 7개). 플레이어 글·답글·AMA 도 한 번에 한 번. LLM 이 안 되면 틀 문장으로.
// 민심 효과는 주지 않는다 — 신문에 실릴 때(공식 글 기사화·민간 계정 신분 노출)만 예외(사용자 확정 2026-10-28).
// 기계 지성·군체(gestalt)는 아예 숨긴다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { bgWriteJson } from '../app/bg-worker';
import { link } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { selectedLanguage, aiLanguage } from './settings-ui';
import { gameState, onGameSnapshot } from './gamestate-app';
import { mood, moodNudge } from './mood-app';
import { gameName } from './namegen-app';
import { noteExtra } from './media';
import { chronNoteWorld } from './chronicle-app';
import { terminal, terminalRequest } from './terminal';
import { gov, refreshPlanets } from './gov';
import { incomeNow } from './secretary-app';
import { childrenOnline } from './children-app';
import { peopleOf } from './people-app';
import { addMonths, cmpDate } from '../gamedate';
import {
  type Site, type Lang, type NetSave, type World, type Post, type Comment, SITES, MAX_KEEP, MAX_COMMENTS, CHILD_SLOTS,
  rng, hash, nodeCodes, leanSplit, makeCitizens, econScore, econStage, generate, commentsFor, playerPostMessages, parsePlayerAi, TOP_COMMENTS,
  type NetAiCtx, type Citizen, postWriterMessages, parsePostWriter, commentWriterMessages, parseCommentWriter, playerCommentCount,
  exposeChance, addSuspicion, articleWorthy, promoTier, promoCommand, promoImage, influencerPost, sanitizeNet, emptyNet, anonIp, PROMO,
} from '../internet';

const file = () => path.join(app.getPath('userData'), 'sllm_internet.json');
let store: Record<string, NetSave> | null = null;
function all(): Record<string, NetSave> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, unknown>)) store[k] = sanitizeNet(v, hash(k)); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'internet', error: e }); }
  return store;
}
let timer: ReturnType<typeof setTimeout> | null = null;
function save(now = false): void {
  const run = () => { timer = null; bgWriteJson(file(), { version: 1, saves: all() }, (err) => { if (err) logDiagnostic('error', 'storage.write_failed', { store: 'internet', error: err }); }); }; // 작업 스레드가 쓴다(2026-11-08)
  if (now) { if (timer) clearTimeout(timer); run(); return; } if (!timer) timer = setTimeout(run, 1500);
}
const netOf = (sid: string): NetSave => (all()[safeKey(sid)] ??= emptyNet(hash(sid + ':net')));
const lang = (): Lang => (selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 시민 글 틀 문장(자료)의 언어 고르기
const hidden = () => !!gameState.last?.gestalt;
const today = () => ctx.gameDate || gameState.last?.date || '';
function monthsBetween(a: string, b: string): number {
  const pa = /^(\d+)\.(\d+)/.exec(a), pb = /^(\d+)\.(\d+)/.exec(b); if (!pa || !pb) return 0;
  return (Number(pb[1]) - Number(pa[1])) * 12 + Number(pb[2]) - Number(pa[2]);
}
const planetNames = (sid: string): string[] => (gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets.map((p) => p.name) : []);
const SPECIES = { ko: ['파충류계', '조류계', '절지류계', '연체류계', '균류계', '식물계', '암석계', '수생계'], en: ['Reptilian', 'Avian', 'Arthropoid', 'Molluscoid', 'Fungoid', 'Plantoid', 'Lithoid', 'Aquatic'] };
function rulerName(): string { const p = peopleOf(ctx.curSaveId).find((x) => x.ruler && !x.gone); return p?.name || L('통치자', 'the Ruler'); }
const sameMonthRefresh = new Map<string, number>(); // ⟳ 를 같은 게임 달에 누른 횟수(앱을 켜 있는 동안만)

function recentEvents(sid: string, since: string): string[] {
  try {
    const out: Array<{ d: string; t: string }> = [];
    for (const g of ctx.chron().groups(sid)) for (const it of g.items) if (it.date && (!since || cmpDate(it.date, since) > 0)) out.push({ d: it.date, t: it.text.replace(/^\d+\.\d+\.\d+\s*/, '').trim() });
    return out.sort((a, b) => cmpDate(b.d, a.d)).map((x) => x.t).filter((t) => t.length >= 6).slice(0, 5);
  } catch { return []; }
}
function worldNow(sid: string, since: string): World {
  const n = netOf(sid), lg = lang(), snap = gameState.last && gameState.last.sid === sid ? gameState.last : null;
  const planets = planetNames(sid), r = rng(n.seed);
  const atWar = (snap?.wars ?? []).map((w) => (w.side === 'att' ? w.defender : w.attacker) || w.name).filter(Boolean) as string[];
  const rivals = terminal.items.filter((c) => c.em?.rival || c.em?.war).map((c) => c.name).concat(terminal.items.slice(0, 3).map((c) => c.name)).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 4);
  const unrest = gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets.filter((p) => p.stability !== null && p.stability < 35).map((p) => p.name).slice(0, 3) : [];
  return { lang: lg, empire: ctx.playerName || L('우리 제국', 'our empire'), ruler: rulerName(), date: today(), mood: mood.cur?.score ?? null, econ: econStage(n.econHist), atWar, planets, unrest, events: recentEvents(sid, since), founder: '', minority: SPECIES[lg][Math.floor(r() * SPECIES[lg].length)], rivals, nodes: nodeCodes(planets.slice(0, 20)) };
}
function ensureCitizens(sid: string): void {
  const n = netOf(sid); if (n.citizens.length) return;
  n.citizens = makeCitizens(n.seed, leanSplit(gameState.last?.factions), planetNames(sid), (g) => gameName(g));
}
const LANG_NAME: Record<string, string> = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese', 'zh-cn': 'Simplified Chinese', fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian', pl: 'Polish', 'pt-br': 'Brazilian Portuguese' };
function aiCtx(sid: string, cits?: Citizen[]): NetAiCtx {
  const a = String(aiLanguage() || 'en'), snap = gameState.last && gameState.last.sid === sid ? gameState.last : null;
  return { langName: LANG_NAME[a.toLowerCase()] ?? a, factions: (snap?.factions ?? []).map((f) => ({ ethic: f.ethic || 'other', support: f.support })), cits: cits ?? netOf(sid).citizens };
}
/** 틀 초안을 LLM 이 다시 쓴다(사이트당 1번). 실패하면 초안 그대로. */
async function aiPosts(sid: string, site: Site, w: World, fresh: Post[]): Promise<void> {
  const todo = fresh.filter((p) => !p.mine); if (!todo.length) return;
  try {
    const raw = await ctx.ai.chat(postWriterMessages(site, w, todo, aiCtx(sid), netOf(sid).infs), { maxTokens: site === 'rs' ? 6000 : site === 'ds' ? 4000 : 3000, purpose: 'internet-posts', json: true });
    const got = parsePostWriter(raw, todo.map((p) => p.id));
    for (const p of todo) { const g = got.get(p.id); if (!g) continue; p.body = g.body; if (site !== 'tw' && g.title) p.title = g.title; p.ai = true; }
    if (got.size < todo.length) logDiagnostic('warn', 'internet.ai_posts_partial', { site, want: todo.length, got: got.size });
  } catch (e) { logDiagnostic('warn', 'internet.ai_posts_failed', { site, error: (e as Error).message }); }
}
/** 글을 눌렀을 때: 인기 댓글 최대 7개를 LLM 1번으로. 실패하면 틀 댓글. 같은 글을 두 번 눌러도 한 번만 부른다. */
const pendingCm = new Map<string, Promise<void>>();
async function aiCommentsFor(sid: string, p: Post): Promise<void> {
  const n = netOf(sid), w = worldNow(sid, ''), want = Math.min(TOP_COMMENTS, p.ccount);
  if (want <= 0) { p.comments = []; return; }
  const r = rng(p.seed ^ 0x51ed), picks = [...n.citizens].sort(() => r() - 0.5).slice(0, Math.min(6, want + 2));
  let list: Comment[] = [];
  try {
    const raw = await ctx.ai.chat(commentWriterMessages(p, w, want, aiCtx(sid), picks), { maxTokens: 1800, purpose: 'internet-comments', json: true });
    const got = parseCommentWriter(raw, want), codes = nodeCodes(planetNames(sid).slice(0, 20));
    const nameFor = (who: string | undefined, nm: string | undefined, i: string): { name: string; ip?: string } => {
      const c = who ? n.citizens.find((x) => x.id === who) : undefined;
      if (p.site === 'ds') return { name: L('ㅇㅇ', 'anon'), ip: anonIp(c ? c.id : p.id + ':' + i, codes) };
      if (p.site === 'rs') return { name: 'u/' + (c ? c.rs : (nm || 'user' + i).replace(/^u\//, '').replace(/\s+/g, '_')) };
      return { name: c ? c.name : nm || L('시민', 'citizen') };
    };
    list = got.map((c, i) => ({ ...nameFor(c.who, c.name, String(i)), text: c.text, up: Math.round((r() * 3) ** 3 * (p.likes / 20 + 1)) + (got.length - i) * 3,
      ...(c.replies?.length ? { replies: c.replies.map((x, k) => ({ ...nameFor('', x.name, i + 'r' + k), text: x.text, up: Math.round(r() * 30) })) } : {}) }));
  } catch (e) { logDiagnostic('warn', 'internet.ai_comments_failed', { site: p.site, error: (e as Error).message }); }
  p.comments = (list.length ? list : commentsFor(p, w, n.citizens)).sort((a, b) => b.up - a.up).slice(0, TOP_COMMENTS);
}
function nextId(n: NetSave) { return () => 'p' + (++n.seq).toString(36); }
/** 사이트 하나 갱신. 첫 방문이면 석 달치를 한 번에. */
async function refreshSite(sid: string, site: Site, force = false): Promise<number> {
  const n = netOf(sid), d = today(); if (!d) return 0;
  ensureCitizens(sid);
  let months = n.last[site] ? monthsBetween(n.last[site], d) : 3;
  if (force && months <= 0) { // ⟳ 는 같은 달에도 몇 개는 더 보이게(같은 달엔 3번까지만)
    const k = `${sid}:${site}:${d.slice(0, 7)}`, c = sameMonthRefresh.get(k) ?? 0; if (c >= 3) return 0; sameMonthRefresh.set(k, c + 1); months = 1;
  }
  if (months <= 0) return 0;
  const w = worldNow(sid, n.last[site]), seed = hash(`${sid}:${site}:${d}:${n.seq}`);
  const kids = site === 'tw' ? childrenOnline(sid) : [];
  let children: ReturnType<typeof childrenOnline> = [];
  if (kids.length) { const r = rng(seed ^ 7), take = Math.min(CHILD_SLOTS, kids.length, r() < 0.5 ? 1 : 2); for (let i = 0; i < take; i++) children.push(kids[(n.childTurn + i) % kids.length]); n.childTurn = (n.childTurn + take) % Math.max(1, kids.length); }
  const infCount = site === 'tw' ? 2 + Math.floor(rng(seed ^ 3)() * 2) : 0;
  const fresh = generate(site, w, n.citizens, Math.max(1, Math.round(months)), seed, nextId(n), { infs: n.infs, infCount, follow: n.follow, children: months >= 1 ? children : [] });
  // 진행 중인 홍보 협업: 그 인플루언서가 가끔 홍보 글(GPT 사진)을 올린다
  if (site === 'tw') for (const pr of n.promo) { if (cmpDate(pr.until, d) < 0) continue; const inf = n.infs.find((x) => x.id === pr.inf); if (!inf) continue; const r = rng(seed ^ hash(pr.planet)); if (r() < 0.6) fresh.unshift(influencerPost(inf, w, r, d, nextId(n)(), pr.planet, promoImage(pr.pc ?? 3, r))); }
  n.posts[site] = [...fresh, ...n.posts[site]].slice(0, MAX_KEEP[site]); n.last[site] = d;
  await aiPosts(sid, site, w, fresh); save();
  return fresh.length;
}
// 매달: 경기 단계 재료와 의심 감쇠만(글은 만들지 않는다)
async function onMonth(sid: string, date: string): Promise<void> {
  const n = netOf(sid); if (n.econDate.slice(0, 7) === date.slice(0, 7)) return;
  n.econHist = [...n.econHist, econScore(await incomeNow(), mood.cur?.score ?? null)].slice(-12); n.econDate = date;
  if (n.sus > 0 && n.susDate && monthsBetween(n.susDate, date) >= 12) { n.sus = n.sus / 2; n.susDate = date; }
  save();
}

function view(sid: string, site?: Site) {
  const n = netOf(sid);
  const strip = (p: Post) => ({ ...p, comments: undefined, hasComments: !!p.comments });
  const eb = gameState.last?.empireEth ?? 0, ethics = Object.entries(ETHIC_BIT).filter(([, b]) => eb & b).map(([k]) => k);
  const enclaves = terminal.items.filter((c) => c.sub).map((c) => ({ sub: c.sub, name: c.name }));
  return { ok: true, hidden: false, sid, date: today(), ethics, enclaves, lang: lang(), empire: ctx.playerName, ruler: rulerName(), nick: n.nick, follow: n.follow, infs: n.infs, econ: econStage(n.econHist), promo: n.promo, promoCost: { energy: PROMO.energy, goods: PROMO.goods, days: PROMO.days }, planets: planetNames(sid),
    posts: site ? { [site]: n.posts[site].map(strip) } : { tw: n.posts.tw.map(strip), ds: n.posts.ds.map(strip), rs: n.posts.rs.map(strip) } };
}
function need(): string { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); if (hidden()) throw new Error('HIDDEN'); return sid; }
function findPost(sid: string, site: Site, id: string): Post { const p = netOf(sid).posts[site].find((x) => x.id === id); if (!p) throw new Error(L('글을 찾지 못했습니다.', 'Post not found.')); return p; }
const ETHIC_BIT: Record<string, number> = { militarist: 1, pacifist: 2, authoritarian: 4, egalitarian: 8, xenophile: 16, xenophobe: 32, materialist: 64, spiritualist: 128 }; // faction-meeting ETHIC_BITS
const asSite = (v: unknown): Site => { if (SITES.includes(v as Site)) return v as Site; throw new Error('BAD_SITE'); };
const clean = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);

async function aiComments(site: Site, acct: 'off' | 'civ' | 'anon', text: string, nWant: number, thread?: { op: string; parent?: string }, mode: 'post' | 'ama' | 'amaAnswer' = 'post') {
  try {
    const sid = ctx.curSaveId, r = rng(hash(text)), cits = [...netOf(sid).citizens].sort(() => r() - 0.5).slice(0, 6);
    const raw = await ctx.ai.chat(playerPostMessages(site, acct, worldNow(sid, ''), text, nWant, thread, aiCtx(sid, cits), mode), { maxTokens: 1400, purpose: 'internet-post', json: true });
    return parsePlayerAi(raw);
  } catch (e) { logDiagnostic('warn', 'internet.ai_failed', { error: (e as Error).message }); return null; }
}
function exposeRoll(sid: string, site: Site, praised: boolean, text: string): boolean {
  const n = netOf(sid), d = today(); n.sus = addSuspicion(n.sus, praised); if (praised) n.susDate = d;
  if (Math.random() >= exposeChance(n.sus)) return false;
  n.sus = 0;
  const siteName = site === 'tw' ? L('트윙클', 'Twinkle') : site === 'ds' ? L('DS인사이드', 'DS Inside') : L('레드시프트', 'Redshift');
  const fact = L(`통치자가 ${siteName}에서 신분을 숨기고 글을 써 온 사실이 드러났다. 문제의 글: 「${text.slice(0, 120)}」`, `The ruler was revealed to have been posting on ${siteName} under a hidden identity. The post in question: "${text.slice(0, 120)}"`);
  noteExtra('scandal', d, fact); moodNudge(-6, fact); chronNoteWorld(`${d} ${fact}`, true);
  ctx.notify({ kind: 'scandal', title: L('익명 글의 주인이 드러났습니다', 'Your hidden account was exposed'), body: L(`${siteName}의 네티즌들이 글쓴이가 통치자라는 것을 알아냈습니다. 다음 신문에 실릴 수 있습니다.`, `${siteName} users worked out the poster is the ruler. It may make the next paper.`) });
  return true;
}
function maybeArticle(sid: string, site: Site, ai: NonNullable<Awaited<ReturnType<typeof aiComments>>>, likes: number, text: string): void {
  const n = netOf(sid), d = today(); if (n.articleDate && monthsBetween(n.articleDate, d) < 6) return;
  const w = articleWorthy(ai, likes, 300000); if (!w) return;
  n.articleDate = d;
  const fact = w === 'praise' ? L(`통치자의 공식 계정 글이 큰 호응을 얻었다: 「${text.slice(0, 120)}」`, `A post on the ruler's official account drew wide praise: "${text.slice(0, 120)}"`) : L(`통치자의 공식 계정 글이 거센 논란을 불렀다: 「${text.slice(0, 120)}」`, `A post on the ruler's official account sparked a fierce backlash: "${text.slice(0, 120)}"`);
  noteExtra('scandal', d, fact); moodNudge(w === 'praise' ? 3 : -4, fact); chronNoteWorld(`${d} ${fact}`, true);
}
const ACCT_OK: Record<Site, Array<'off' | 'civ' | 'anon'>> = { tw: ['off', 'civ'], ds: ['anon', 'civ'], rs: ['off', 'civ'] }; // DS 는 익명(ㅇㅇ+노드) 또는 고정닉

async function write(site: Site, acct: 'off' | 'civ' | 'anon', title: string, body: string, amaOn = false) {
  const sid = need(), n = netOf(sid), d = today(); if (!ACCT_OK[site].includes(acct)) throw new Error('BAD_ACCOUNT');
  if (!body) throw new Error(L('내용을 써 주세요.', 'Write something first.'));
  if (acct === 'civ' && !n.nick[site]) throw new Error('NEED_NICK');
  const ama = amaOn && site === 'rs' && acct === 'off'; // 레드시프트 공식 계정 AMA: 댓글 = 시민 질문
  const ai = await aiComments(site, acct, (title ? title + '\n' : '') + body, ama ? TOP_COMMENTS : playerCommentCount(acct, Math.random), undefined, ama ? 'ama' : 'post');
  const off = acct === 'off', r = rng(hash(body + d));
  const likes = off ? 800 + Math.floor(r() * 4000) : 1 + Math.floor(r() * (ai?.reception === 'praise' ? 60 : 15));
  const name = off ? ctx.playerName || L('정부', 'Government') : acct === 'anon' ? L('ㅇㅇ', 'anon') : n.nick[site];
  const comments: Comment[] = (ai?.comments ?? []).map((c, i) => ({ name: site === 'ds' ? L('ㅇㅇ', 'anon') : site === 'rs' ? 'u/' + (c.name || 'user' + i).replace(/\s+/g, '_') : c.name || L('시민', 'citizen'), text: c.text, up: Math.round(r() * likes * 0.3), ...(site === 'ds' ? { ip: anonIp(body + i, nodeCodes(planetNames(sid).slice(0, 20))) } : {}) }));
  const p: Post = { id: nextId(n)(), site, date: d, topic: 'mine', stance: 'neu', seed: hash(body), mine: true,
    by: { kind: 'me', name, ...(off ? { off: true, handle: '@' + (ctx.playerName || 'gov').replace(/\s+/g, '_').slice(0, 16) } : site === 'tw' ? { handle: '@' + n.nick.tw } : {}), ...(acct === 'anon' ? { ip: anonIp('me:' + sid, nodeCodes(planetNames(sid).slice(0, 20))) } : {}) },
    ...(site !== 'tw' ? { title: title || body.split('\n')[0].slice(0, 60) } : {}), body, likes, shares: Math.round(likes * 0.15), views: likes * 12, ccount: off ? comments.length * (20 + Math.floor(r() * 50)) : comments.length, comments: comments.sort((a, b) => b.up - a.up), opened: true, ...(ama ? { ama: true } : {}) };
  n.posts[site] = [p, ...n.posts[site]].slice(0, MAX_KEEP[site]);
  let exposed = false;
  if (ai && !ama) { if (off) maybeArticle(sid, site, ai, likes, body); else exposed = exposeRoll(sid, site, !!ai.praise_ruler, body); }
  save();
  return { post: p, exposed, aiFailed: !ai };
}
async function reply(site: Site, id: string, acct: 'off' | 'civ' | 'anon', text: string, to: number) {
  const sid = need(), n = netOf(sid), p = findPost(sid, site, id); if (!ACCT_OK[site].includes(acct)) throw new Error('BAD_ACCOUNT');
  if (!text) throw new Error(L('내용을 써 주세요.', 'Write something first.'));
  if (acct === 'civ' && !n.nick[site]) throw new Error('NEED_NICK');
  if (!p.comments) p.comments = commentsFor(p, worldNow(sid, ''), n.citizens);
  const parent = Number.isSafeInteger(to) && to >= 0 ? p.comments[to] : undefined;
  const name = acct === 'off' ? ctx.playerName || L('정부', 'Government') : acct === 'anon' ? L('ㅇㅇ', 'anon') : n.nick[site];
  const mine: Comment = { name, text, up: 0, mine: true, ...(acct === 'anon' ? { ip: anonIp('me:' + sid, nodeCodes(planetNames(sid).slice(0, 20))) } : {}) };
  const amaAns = !!(p.ama && p.mine && acct === 'off' && parent); // AMA 질문에 통치자가 답함: 질문자 반응 + 다른 시민
  const ai = await aiComments(site, acct, text, 2 + Math.floor(Math.random() * 2), { op: (p.title ? p.title + '\n' : '') + p.body, parent: parent?.text }, amaAns ? 'amaAnswer' : 'post');
  if (amaAns && ai) { const q = Math.random(); mine.up = ai.reception === 'praise' ? 200 + Math.round(q * 700) : ai.reception === 'backlash' ? -(50 + Math.round(q * 350)) : 20 + Math.round(q * 130); }
  const answers: Comment[] = (ai?.comments ?? []).map((c, i) => ({ name: i === 0 && !amaAns ? (parent?.name ?? p.by.name) : i === 0 && parent ? parent.name : site === 'ds' ? L('ㅇㅇ', 'anon') : c.name || L('시민', 'citizen'), text: c.text, up: Math.floor(Math.random() * 12), ...(site === 'ds' ? { ip: i === 0 ? (parent?.ip ?? p.by.ip) : anonIp(id + text + i, nodeCodes(planetNames(sid).slice(0, 20))) } : {}) }));
  if (parent) { parent.replies = [...(parent.replies ?? []), mine, ...answers].slice(0, MAX_COMMENTS); }
  else { p.comments = [...p.comments, { ...mine, replies: answers }].slice(-MAX_COMMENTS * 2); }
  p.ccount += 1 + answers.length;
  let exposed = false; if (ai && acct !== 'off') exposed = exposeRoll(sid, site, !!ai.praise_ruler, text); else if (ai && acct === 'off' && !amaAns) maybeArticle(sid, site, ai, 0, text);
  save();
  return { comments: p.comments, exposed, aiFailed: !ai };
}
async function promo(infId: string, planet: string) {
  const sid = need(), n = netOf(sid), d = today();
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 협업을 의뢰할 수 있습니다.', 'The game must be running to commission a collaboration.'));
  const inf = n.infs.find((x) => x.id === infId); if (!inf) throw new Error(L('인플루언서를 찾지 못했습니다.', 'Influencer not found.'));
  if (n.promo.some((x) => x.planet === planet && cmpDate(x.until, d) >= 0)) throw new Error(L('그 행성은 이미 홍보 중입니다.', 'That planet is already being promoted.'));
  const rp = await refreshPlanets(); if (!rp || !('list' in rp)) throw new Error(L('행성 목록을 받지 못했습니다. 다시 시도해 주세요.', 'Could not get the planet list. Try again.'));
  const list = gov.planetList?.sid === sid ? gov.planetList.planets : [], k = list.findIndex((p) => p.name === planet) + 1;
  if (k < 1) throw new Error(L('지금 우리 행성이 아닙니다.', 'This planet is not ours now.'));
  const req = ++link.reqCounter, num = ++n.promoSeq, tier = promoTier(inf.followers); save(true);
  const st = String((await terminalRequest(promoCommand(req, sid, k, tier, num), 'NETPROMO', req)).kv.status ?? '');
  if (st === 'short') throw new Error(L(`자원이 모자랍니다(에너지 ${PROMO.energy} · 소비재 ${PROMO.goods} 필요).`, `Not enough resources (needs ${PROMO.energy} energy and ${PROMO.goods} consumer goods).`));
  if (st === 'no_target') throw new Error(L('게임에서 그 행성을 찾지 못했습니다.', 'The game could not find that planet.'));
  if (st !== 'applied' && st !== 'duplicate') throw new Error(L('게임에서 회신을 받지 못했습니다(다시 보내지 않습니다).', 'No reply from the game (it will not be resent).'));
  const pc = list[k - 1]?.pc ?? 1;
  n.promo.push({ n: num, inf: inf.id, planet, pc, until: addMonths(d, Math.round(PROMO.days / 30)) });
  const w = worldNow(sid, ''), r = rng(hash(planet + d));
  const pp = influencerPost(inf, w, r, d, nextId(n)(), planet, promoImage(pc, r)); await aiPosts(sid, 'tw', w, [pp]); // 첫 홍보 글도 LLM 이 쓴다(사용자 확정)
  n.posts.tw = [pp, ...n.posts.tw].slice(0, MAX_KEEP.tw);
  save(true);
  chronNoteWorld(L(`${d} 인플루언서 ${inf.name.ko}이(가) 「${planet}」 홍보를 시작했다`, `${d} Influencer ${inf.name.en} began promoting "${planet}"`), true);
  return { text: L(`${inf.name.ko}이(가) 「${planet}」 홍보 글을 올렸습니다. 2년 동안 이 행성으로 오려는 이주민이 늘어납니다.`, `${inf.name.en} posted a promo for "${planet}". For two years more migrants will want to move there.`) };
}

/** 지금 경기 단계(동적 일상 분위기가 같은 값을 쓴다, 2026-10-28). 매달 onMonth 가 쌓는 기록에서. */
export const econNow = (sid: string) => econStage(netOf(sid).econHist);
export function registerInternet(): void {
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId || snap.gestalt) return; void onMonth(snap.sid, snap.date).catch((e) => logDiagnostic('warn', 'internet.month_failed', { error: (e as Error).message })); }, 'internet');
  const wrap = (fn: (...a: any[]) => Promise<unknown> | unknown) => async (_e: unknown, ...a: unknown[]) => {
    try { if (hidden()) return { ok: false, hidden: true }; return { ok: true, ...((await fn(...a)) as object) }; }
    catch (e) { const m = (e as Error).message; return { ok: false, error: m === 'NEED_NICK' ? L('먼저 닉네임을 정해 주세요.', 'Set a nickname first.') : m, needNick: m === 'NEED_NICK', hidden: m === 'HIDDEN' }; }
  };
  ipcMain.handle('internetState', wrap(() => view(need())));
  ipcMain.handle('internetOpen', wrap(async (site: unknown) => { const sid = need(), s = asSite(site); if (ctx.gameRunning && (!gov.planetList || gov.planetList.sid !== sid)) { try { await refreshPlanets(); } catch { /* 행성 이름 없이 */ } } const made = await refreshSite(sid, s); return { made, ...view(sid, s) }; }));
  ipcMain.handle('internetRefresh', wrap(async (site: unknown) => { const sid = need(), s = asSite(site); const made = await refreshSite(sid, s, true); return { made, ...view(sid, s) }; }));
  ipcMain.handle('internetPost', wrap(async (site: unknown, id: unknown) => {
    const sid = need(), s = asSite(site), p = findPost(sid, s, String(id ?? ''));
    if (!p.comments) {
      const k = sid + ':' + s + ':' + p.id; let job = pendingCm.get(k);
      if (!job) { job = aiCommentsFor(sid, p).finally(() => pendingCm.delete(k)); pendingCm.set(k, job); }
      await job; p.opened = true; save();
    }
    return { post: p };
  }));
  ipcMain.handle('internetWrite', wrap((site: unknown, acct: unknown, title: unknown, body: unknown, ama: unknown) => write(asSite(site), String(acct) as 'off', clean(title, 80), clean(body, 1200), ama === true)));
  ipcMain.handle('internetReply', wrap((site: unknown, id: unknown, acct: unknown, text: unknown, to: unknown) => reply(asSite(site), String(id ?? ''), String(acct) as 'off', clean(text, 400), Number(to))));
  ipcMain.handle('internetNick', wrap((site: unknown, nick: unknown) => {
    const sid = need(), s = asSite(site), v = clean(nick, 16).replace(/[\s@]/g, ''); if (s === 'ds' && !v) { netOf(sid).nick.ds = ''; save(); return view(sid); } if (v.length < 2) throw new Error(L('닉네임은 2~16자로 정해 주세요.', 'Nicknames must be 2–16 characters.'));
    netOf(sid).nick[s] = v; save(); return view(sid);
  }));
  ipcMain.handle('internetFollow', wrap((who: unknown, on: unknown) => {
    const sid = need(), n = netOf(sid), w = clean(who, 40); if (!w) throw new Error('BAD');
    n.follow = on ? [...new Set([...n.follow, w])].slice(-200) : n.follow.filter((x) => x !== w); save(); return view(sid);
  }));
  ipcMain.handle('internetInfluencer', wrap((id: unknown, patch: unknown) => {
    const sid = need(), n = netOf(sid), i = n.infs.findIndex((x) => x.id === id); if (i < 0) throw new Error('BAD');
    const merged = sanitizeNet({ ...n, infs: n.infs.map((x, k) => (k === i ? { ...x, ...(patch && typeof patch === 'object' ? patch : {}) } : x)) }, n.seed).infs;
    if ((patch as any)?.avatar === null) delete merged[i].avatar;
    n.infs = merged; save(); return view(sid);
  }));
  ipcMain.handle('internetPromo', wrap((inf: unknown, planet: unknown) => promo(clean(inf, 40), clean(planet, 120))));
}
