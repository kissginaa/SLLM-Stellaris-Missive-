// 갤럭틱 포럼(2026-11-04 사용자, 4chan /int/ 형식) — 은하 공용망의 익명 국제 게시판. 순수 규칙 — 앱: src/features/gforum-app.ts · 화면: ui/office-gforum.js(인터넷 창의 네 번째 탭)
// 사용자 확정: 국내망(트윙클·DS인사이드·레드시프트)과 따로, 외국 시민들이 큰 사건(신문 1면 = 세계 소식)에 반응하는 곳. 글쓴이는 익명이지만 국기(제국)가 보인다.
// LLM: 사건 하나 = 스레드 하나 = 호출 한 번(원글 + 답글 8~12). 우리 답글에 대한 반응도 한 번. 사건이 없으면 만들지 않는다.

export interface GfPoster { n: number; idx: number; empire: string; ethics: string; stance: string; war: boolean; rival: boolean; ours: boolean; xeno?: 0 | 1 | 2 }
/** 외계인혐오 제국 시민(2026-11-04 사용자): 은하 공용망을 잘 쓰지 않고(글쓴이로 덜 뽑힘), 쓰면 매우 공격적. 0 아님 · 1 외계인혐오 · 2 광신적 외계인혐오(또는 순수주의 시민 강령). */
export function xenoLevel(ethicKeys: string[], ethicsText = '', civics: string[] = []): 0 | 1 | 2 {
  const k = ethicKeys.join(' ').toLowerCase(), c = civics.join(' ').toLowerCase();
  if (/fanatic_xenophobe/.test(k) || /fanatic_purifiers|hive_devouring|machine_terminator/.test(c)) return 2;
  if (/xenophobe/.test(k) || (!k && /xenophob|외계인\s*혐오/i.test(ethicsText))) return 1;
  return 0;
}
/** 이번 스레드에 나올지: 외계인혐오는 40%, 광신적은 25%만(앱이 Math.random 으로 부름). */
export const xenoJoins = (lv: 0 | 1 | 2, r: number): boolean => (lv === 2 ? r < 0.25 : lv === 1 ? r < 0.4 : true);
const xenoNote = (p: GfPoster): string => (p.xeno === 2 ? '; FANATIC XENOPHOBE — despises aliens; posts here at most once and only to spew open contempt, threats and supremacist insults at the other species (no slurs)' : p.xeno === 1 ? '; xenophobe — dislikes mixing with aliens and rarely posts here (at most once); when they do, they are openly hostile, condescending and aggressive toward other species' : '');
export interface GfPost { no: number; idx: number; empire: string; text: string; to?: number; official?: boolean; mine?: boolean }
export interface GfThread { id: string; date: string; title: string; event: string; posts: GfPost[]; kind?: 'news' | 'chat'; topic?: string }
export const GFORUM = { keep: 30, perRefresh: 2, sameMonth: 3, textMax: 420, titleMax: 80, minPosts: 4 } as const;

/** 호감 점수 → 우리를 보는 태도(프롬프트용 영어). */
export const stanceOf = (score: number): string => (score <= -60 ? 'hates our empire' : score <= -20 ? 'dislikes our empire' : score < 20 ? 'neutral toward our empire' : score < 60 ? 'likes our empire' : 'admires our empire');
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max).trim() : '');

const STYLE = [
  'This is the /int/ board of the Galactic Forum, an anonymous imageboard on the galaxy-wide network where citizens of many space empires post. Every post shows only the poster\'s empire flag, never a name.',
  'Write like real imageboard users: short posts (1-3 sentences), casual, sarcastic or heated, banter between nationalities, occasional greentext lines starting with ">". Each poster speaks as an ordinary citizen of their own empire, reflecting its ethics and its attitude toward the empire in the news.',
  'Posts are machine-translated into the reader\'s language, so keep them natural in that language. No real-world references, no slurs, no explicit content. Do not invent new wars or events beyond the news given.',
];

/** 사건 하나 → 스레드(원글 + 답글). posters: 번호(n)로 고른다. */
export function gfThreadMessages(event: string, posters: GfPoster[], ourEmpire: string): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [...STYLE,
    'Create one thread about the news item below. The first post is the original post that brings up the news; then 8 to 12 replies from various posters. Replies may answer an earlier post by its index ("reply": index of that post in your list, 0 = the original post).',
    'Pick posters only from the list by their number ("who"). Use most of them at least once if there are several; the same poster may post more than once. Posters from "' + ourEmpire + '" defend or brag about their own empire.',
    'Output only JSON: {"title":"short thread subject, at most 60 characters","posts":[{"who":1,"text":"..."},{"who":3,"text":"...","reply":0}]}',
  ].join('\n') }, { role: 'user', content: [`News: ${event}`, 'Posters:', ...posters.map((p) => `${p.n}. citizen of ${p.empire}${p.ours ? ' (the empire in the news\' home side — our empire)' : ''}; ethics: ${p.ethics || 'unknown'}; ${p.ours ? '' : p.stance}${p.war ? '; at war with ' + ourEmpire : ''}${p.rival ? '; rival of ' + ourEmpire : ''}${xenoNote(p)}`)].join('\n') }];
}

/** 잡담 스레드(새 소식이 없을 때, 2026-11-04 사용자: 국내망처럼 ⟳ 하면 늘 새 글 · 주제도 LLM 이 알아서). recent = 최근 스레드 제목(겹치지 않게). */
export function gfChatMessages(recent: string[], posters: GfPoster[], ourEmpire: string): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [...STYLE,
    'There is no breaking news today. Invent one casual off-topic thread yourself, the kind of everyday chatter people start on an international board: food, weather, daily life, hobbies, sports and esports, travel, pets, work, gossip about their own rulers, cultural differences, silly hypotheticals. Pick something that fits a galaxy of very different alien empires. Do not reuse the recent thread subjects listed below.',
    'The first post opens the topic; then 8 to 12 replies from various posters, each answering from their own empire\'s everyday life, culture and ethics. Replies may answer an earlier post by its index ("reply": index of that post in your list, 0 = the original post).',
    'Pick posters only from the list by their number ("who"). Use most of them at least once; the same poster may post more than once. Keep it light, petty and funny rather than political.',
    'Output only JSON: {"title":"short thread subject, at most 60 characters","posts":[{"who":1,"text":"..."},{"who":3,"text":"...","reply":0}]}',
  ].join('\n') }, { role: 'user', content: [recent.length ? 'Recent thread subjects (do not repeat): ' + recent.join(' | ') : 'No recent threads.', 'Posters:', ...posters.map((p) => `${p.n}. citizen of ${p.empire}${p.ours ? ' (our empire: ' + ourEmpire + ')' : ''}; ethics: ${p.ethics || 'unknown'}${xenoNote(p)}`)].join('\n') }];
}

/** 게시글 번호: 스레드마다 씨앗에서 6~7자리로 시작해 몇씩 건너뛴다(진짜 게시판처럼). */
export function postNumbers(seed: number, n: number): number[] { let x = 1000000 + (Math.abs(seed) % 8000000), out: number[] = []; for (let i = 0; i < n; i++) { x += 3 + ((seed >> (i % 16)) & 15) + i * 2; out.push(x); } return out; }

/** AI 응답 → 스레드. 모르는 글쓴이는 버리고, 글이 너무 적으면 null. */
export function readThread(raw: string, posters: GfPoster[], seed: number): { title: string; posts: GfPost[] } | null {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  if (!j || typeof j !== 'object') return null;
  const o = j as { title?: unknown; posts?: unknown };
  const arr = Array.isArray(o.posts) ? o.posts.slice(0, 16) : [];
  const kept: Array<{ p: GfPoster; text: string; reply: number | null; src: number }> = [];
  arr.forEach((x, i) => {
    const r = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const p = posters.find((q) => q.n === Number(r.who)), text = clean(r.text, GFORUM.textMax);
    if (p && text) kept.push({ p, text, reply: Number.isInteger(r.reply) ? Number(r.reply) : null, src: i });
  });
  if (kept.length < GFORUM.minPosts) return null;
  const nos = postNumbers(seed, kept.length), bySrc = new Map(kept.map((k, i) => [k.src, nos[i]]));
  const posts = kept.map((k, i) => { const to = k.reply !== null && k.reply < k.src ? bySrc.get(k.reply) : undefined; return { no: nos[i], idx: k.p.idx, empire: k.p.empire, text: k.text, ...(to && i > 0 ? { to } : {}) }; });
  return { title: clean(o.title, GFORUM.titleMax) || posts[0].text.slice(0, 40), posts };
}

/** 우리가 단 답글에 대한 반응(2~4개). official = 공식 계정(국기 옆 「공식」 표시) — 외교적 무게가 실린다. */
export function gfReplyMessages(th: GfThread, mine: GfPost, posters: GfPoster[], ourEmpire: string): { role: 'system' | 'user'; content: string }[] {
  const last = th.posts.slice(-8).map((p) => `No.${p.no} [${p.empire}]${p.official ? ' [OFFICIAL]' : ''}${p.to ? ' >>' + p.to : ''}: ${p.text}`);
  return [{ role: 'system', content: [...STYLE,
    `A new post just appeared in the thread "${th.title}". ${mine.official ? `It is from the verified OFFICIAL account of the government of ${ourEmpire}, so people react to it as a statement by that government (mockery, outrage, support, screenshots).` : `It is an anonymous post by a citizen of ${ourEmpire}.`}`,
    'Write 2 to 4 replies to it from posters in the list (by number). They reply to that new post.',
    'Output only JSON: {"posts":[{"who":2,"text":"..."}]}',
  ].join('\n') }, { role: 'user', content: [`News: ${th.event}`, 'Recent posts:', ...last, `New post No.${mine.no} [${mine.empire}]${mine.official ? ' [OFFICIAL]' : ''}: ${mine.text}`, 'Posters:', ...posters.map((p) => `${p.n}. citizen of ${p.empire}; ethics: ${p.ethics || 'unknown'}; ${p.ours ? 'our own citizen' : p.stance}${p.war ? '; at war with ' + ourEmpire : ''}${xenoNote(p)}`)].join('\n') }];
}
/** 반응 읽기: 모두 우리 글(to)에 대한 답글로 번호를 이어 붙인다. */
export function readReplies(raw: string, posters: GfPoster[], after: number, to: number): GfPost[] {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  const arr = j && typeof j === 'object' && Array.isArray((j as { posts?: unknown }).posts) ? (j as { posts: unknown[] }).posts.slice(0, 4) : [];
  const out: GfPost[] = []; let no = after;
  for (const x of arr) { const r = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}; const p = posters.find((q) => q.n === Number(r.who)), text = clean(r.text, GFORUM.textMax); if (!p || !text) continue; no += 2 + out.length * 3; out.push({ no, idx: p.idx, empire: p.empire, text, to }); }
  return out;
}
export const cleanMine = (v: unknown): string => clean(v, GFORUM.textMax);
