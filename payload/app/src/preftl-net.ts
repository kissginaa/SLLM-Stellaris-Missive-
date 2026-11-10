// 원시문명 인터넷 염탐(2026-11-04 사용자): 원자력 시대부터 그들의 컴퓨터망을 엿본다. 순수 규칙 — 앱: src/features/preftl-net-app.ts · 화면: ui/office-preftl-net.js
// 사용자 확정: 감청 방송(산업 시대 이상, src/preftl-broadcast.ts)과 겹치지 않게 원자력 시대부터.
//   원자력 시대 = 초기 컴퓨터망 게시판(인터넷 말투 없음 — 메모·전보·연구 노트 같은 격식체, 2026-11-04 사용자), 화면은 녹색 인광 단말기(옛 게임의 터미널 느낌, 실제 상표·문구는 쓰지 않음).
//   초기 우주 시대 = 대중 인터넷 게시판, 화면은 2000년대 초 운영체제 창·브라우저·테이블 게시판(2026-11-04 사용자).
// 「슈뢰딩거」: 「접속」을 누를 때만 만든다(게임 명령 없음, 저장된 관측 정보만), 한 문명당 게임 1달에 한 번. LLM 한 번 = 스레드 3개. 실패하면 틀 글.
// 글쓰기(2026-11-04 사용자): 이번 달 접속한 게시판에 우리가 몰래 글을 쓴다(답글·새 글, 접속 한 번에 3개). 현지인 답글이 달리고,
//   LLM 이 위험도 0~2(현지인처럼 섞임 0 · 이상함 1 · 외계 지식·존재를 드러냄 2)를 매겨 그만큼 인지도가 바로 오른다(하늘의 목소리와 같은 게임 명령).
//   단 초기 우주 시대(대중 인터넷)는 소음에 묻혀 극악의 확률(2%·5%)로만 오른다(netAwareness, 2026-11-04 사용자). 원자력 시대는 소수만 쓰는 망이라 그대로.
// 인지도가 글감을 바꾸고(하늘의 이상한 빛 → UFO 음모론 → 「누가 지켜본다」 공식 논란), 하늘의 목소리 신앙·원시문명 위기도 글에 나온다.
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';
import { type Civ, AWARE, SITUATION, ageEn, civFact } from './preftl';
import { monthsBetween } from './letters';

export const NET_AGE = 9; // 원자력 시대
export const NET = { keep: 6, gapMonths: 1, threads: 3, postsMin: 2, postsMax: 7, textMax: 360, titleMax: 70, maxTokens: 1800, myPosts: 3, riskMax: 2, replyTokens: 700 } as const;
export type NetMode = 'term' | 'web';
export interface NetPost { who: string; text: string; mine?: boolean; risk?: number }
export interface NetThread { title: string; posts: NetPost[] }
export interface NetVisit { date: string; mode: NetMode; net: string; threads: NetThread[]; llm: boolean; mine?: number; aw?: number }

export const netMode = (age: number): NetMode => (age >= NET_AGE + 1 ? 'web' : 'term');
/** 접속할 수 없는 까닭(없으면 ''). */
export function netBlock(c: Civ, last: NetVisit | undefined, date: string): string {
  if (c.gone) return L('더는 원시문명이 아닙니다.', 'They are no longer a pre-FTL civilization.');
  if (c.hive) return L('군체 의식에게는 게시판이 없습니다.', 'A hive mind has no message boards.');
  if (c.age < NET_AGE) return L('컴퓨터망은 원자력 시대부터 생깁니다.', 'They will not have computer networks until the Atomic Age.');
  if (c.obs !== 1) return L('우리 관측소가 있어야 그들의 망에 몰래 접속할 수 있습니다.', 'We need our own observation post to tap into their network.');
  if (last && monthsBetween(last.date, date) < NET.gapMonths) return L('이번 달에는 이미 접속했습니다.', 'We have already tapped in this month.');
  return '';
}

const AW_TOPIC = [
  'Nobody suspects aliens. Threads are entirely about their own daily life, work, science, politics and gossip.',
  'One thread may mention strange lights in the sky or a glitch in a radio telescope, and others laugh it off.',
  'A UFO conspiracy thread is popular: believers versus sceptics, blurry "evidence", government cover-up theories.',
  'People are fairly sure something is watching them from space. There is real fear, cults, official denials and heated arguments.',
  'They know aliens exist. Boards are obsessed with what contact will mean.',
];
const MODE_STYLE: Record<NetMode, string> = {
  term: 'This is an early computer network of the Atomic Age: a slow text-only bulletin board used by researchers, engineers, officials and a few hobbyists. Handles are terse ALL-CAPS user IDs or terminal codes (e.g. "LAB7-KORVAN", "SYSOP"). Internet culture does not exist yet: write like memos, telegrams, lab notes and letters to the editor — complete sentences in a formal or plainly polite register. NO internet slang, NO emoticons, NO memes, NO "lol"-style laughter or casual chat abbreviations of any language (in Korean: no ㅋㅋ/ㅎㅎ/ㄷㄷ and no casual -임/-음/-ㅇㅇ endings; use 합니다/한다 style).',
  web: 'This is the early public internet of their Early Space Age, in the spirit of a turn-of-the-millennium web forum: handles are nicknames with numbers and underscores, posts use text emoticons like :) and :P, "lol", "first post!", "+1", ALL CAPS rants, off-topic flame wars, people asking for help with their slow dial-up, chain-letter hoaxes. Casual everyday life.',
};
/** 그들의 망 한 번 엿보기 → 스레드 3개. faith = 하늘의 목소리 신앙 한 줄(있으면). */
export function netMessages(c: Civ, faithLine: string, recent: string[]): ChatMessage[] {
  const mode = netMode(c.age);
  return [{ role: 'system', content: [
    `We are secretly reading the computer network of a primitive alien civilization (${ageEn(c.age)}). They do not know we are reading it.`,
    MODE_STYLE[mode],
    `Write ${NET.threads} threads currently on the network: each with a short title and ${NET.postsMin}-${NET.postsMax} posts by different users of that civilization. Make it about THEIR world, culture, species and current events, invented consistently with the facts given. Also give the network a name in their culture.`,
    AW_TOPIC[c.lv] ?? AW_TOPIC[0],
    c.sit && SITUATION[c.sit] ? `A crisis is under way: ${SITUATION[c.sit].en}. At least one thread reacts to it.` : '',
    faithLine.split('\n').some((l) => l.trim() && !/nuclear/i.test(l)) ? 'If a faith inspired by "voices from the sky" exists, one thread may show believers and mockers arguing about it.' : '',
    /nuclear/i.test(faithLine) ? 'If their great powers are in a nuclear standoff (or just had a nuclear war), one thread should show how ordinary people live with it (drills, fear, propaganda, hope or grief).' : '', // 핵 대치(2026-11-05, src/preftl-standoff.ts)
    'Posts are machine-translated into the reader\'s language, so keep them natural in that language. No real-world references or brands.',
    'Output only JSON: {"net":"network name","threads":[{"title":"...","posts":[{"who":"handle","text":"..."}]}]}',
  ].filter(Boolean).join('\n') }, { role: 'user', content: [civFact(c), `Awareness: ${AWARE[c.lv]?.desc ?? ''}.`, faithLine, recent.length ? 'Recent thread titles (do not repeat): ' + recent.join(' | ') : ''].filter(Boolean).join('\n') }];
}
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max).trim() : '');
export function parseNet(raw: string, c: Civ, date: string): NetVisit | null {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  if (!j || typeof j !== 'object') return null;
  const o = j as { net?: unknown; threads?: unknown };
  const threads: NetThread[] = (Array.isArray(o.threads) ? o.threads : []).slice(0, NET.threads + 1).map((x) => {
    const r = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const posts = (Array.isArray(r.posts) ? r.posts : []).slice(0, NET.postsMax + 2).map((p) => { const q = p && typeof p === 'object' ? (p as Record<string, unknown>) : {}; return { who: clean(q.who, 24) || 'anon', text: clean(q.text, NET.textMax) }; }).filter((p) => p.text);
    return { title: clean(r.title, NET.titleMax), posts };
  }).filter((th) => th.title && th.posts.length >= NET.postsMin);
  if (!threads.length) return null;
  return { date, mode: netMode(c.age), net: clean(o.net, 40) || defaultNet(c), threads, llm: true };
}
const defaultNet = (c: Civ): string => (netMode(c.age) === 'term' ? L(`${c.name} 학술 연산망`, `${c.name} Academic Compute Net`) : L(`${c.name} 넷`, `${c.name}Net`));
/** 틀 글(AI 없이·실패 때). 인지도에 따라 한 스레드가 바뀐다. */
export function templateNet(c: Civ, date: string): NetVisit {
  const term = netMode(c.age) === 'term';
  const who = term ? ['SYSOP', 'LAB3-OPR', 'GRAD-114', 'RELAY-9'] : ['quietcomet', 'sunburnt_99', 'xX_orbit_Xx', 'momof3moons'];
  const sky: Array<[string, string, string, string]> = [
    ['연산기 예약 시간 조정 공지', 'Mainframe time-slot changes', '다음 주부터 야간 예약은 두 시간 단위입니다.', 'Night bookings move to two-hour blocks next week.'],
    ['어젯밤 관측 기록에 잡힌 이상 신호', 'Odd signal in last night\'s telescope log', '장비 오류겠지. 다시 보정해 봐.', 'Probably equipment error. Recalibrate.'],
    ['하늘의 그 빛, 정부는 왜 말이 없나', 'Why is the government silent about the lights?', '세 번째 목격담이다. 우연이 아니야.', 'Third sighting this month. Not a coincidence.'],
    ['우리는 감시당하고 있다', 'We are being watched', '이제 공식 발표만 남았다. 다들 하늘을 봐.', 'Only the official statement is left. Look up, everyone.'],
    ['접촉 이후의 세계', 'The world after contact', '그들이 우리 글도 읽고 있을까?', 'Do you think they read our posts too?'],
  ];
  const s = sky[Math.max(0, Math.min(4, c.lv))];
  const threads: NetThread[] = [
    { title: L(s[0], s[1]), posts: [{ who: who[0], text: L(s[2], s[3]) }, { who: who[1], text: L('동의합니다.', 'Agreed.') }, { who: who[2], text: L('저는 아직 모르겠습니다.', 'I am not convinced yet.') }] },
    { title: term ? L('계산 결과 공유', 'Sharing computation results') : L('오늘 점심 뭐 먹음', 'what did u eat for lunch'), posts: [{ who: who[3], text: term ? L('궤도 계산을 다시 돌렸습니다. 오차가 줄었습니다.', 'Reran the orbit calculation; the error is smaller.') : L('또 배달. 지갑이 운다', 'delivery again. my wallet is crying') }, { who: who[1], text: term ? L('수고하셨습니다.', 'Good work.') : L('ㅋㅋ 나도', 'lol same') }] },
  ];
  if (c.sit && SITUATION[c.sit]) threads.push({ title: L(`${SITUATION[c.sit].ko} 소식 모음`, `${SITUATION[c.sit].en}: updates`), posts: [{ who: who[2], text: L('상황이 심각해지고 있습니다.', 'Things are getting serious.') }, { who: who[0], text: L('공식 발표를 기다립시다.', 'Let us wait for the official statement.') }] });
  return { date, mode: netMode(c.age), net: defaultNet(c), threads, llm: false };
}

// ---- 글쓰기(2026-11-04 사용자) ----
/** 이번 접속(가장 최근, 이번 달)에만 쓸 수 있다. 못 쓰면 까닭. */
export function postBlock(v: NetVisit | undefined, date: string): string {
  if (!v) return L('먼저 컴퓨터망에 접속해 주세요.', 'Tap into their network first.');
  if (monthsBetween(v.date, date) >= NET.gapMonths) return L('이번 달 접속에서만 글을 쓸 수 있습니다. 다시 접속해 주세요.', 'You can only post during this month\'s session. Tap in again.');
  if ((v.mine ?? 0) >= NET.myPosts) return L(`이번 접속에서는 글을 ${NET.myPosts}개까지만 쓸 수 있습니다. 더 쓰면 추적당합니다.`, `Only ${NET.myPosts} posts per session — any more and the line could be traced.`);
  return '';
}
/** 우리 글쓴이 이름(비워 두면): 단말기는 손님 계정, 게시판은 평범한 닉네임. */
export function netHandle(mode: NetMode, seed: number): string {
  const n = Math.abs(Math.round(seed)) % 90 + 10;
  return mode === 'term' ? `GUEST-${String(n).padStart(2, '0')}` : ['nightowl', 'quiet_one', 'skywatcher', 'just_a_guy', 'lurker'][n % 5] + '_' + n;
}
export const cleanHandle = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\r\n\t"\\]/g, '').trim().slice(0, 24) : '');
export const cleanPostText = (v: unknown): string => clean(v, NET.textMax);
export const cleanTitle = (v: unknown): string => clean(v, NET.titleMax);
/** 우리 글 → 현지인 답글 2~4개 + 위험도. ti = 스레드 번호(새 글이면 -1, 제목은 title). */
export function netPostMessages(c: Civ, v: NetVisit, ti: number, title: string, mine: NetPost, faithLine: string): ChatMessage[] {
  const th = ti >= 0 ? v.threads[ti] : null;
  return [{ role: 'system', content: [
    `This is the computer network "${v.net}" of a primitive alien civilization (${ageEn(c.age)}).`,
    MODE_STYLE[v.mode],
    'A new post just appeared. Unknown to the locals, it was secretly written by an alien observer pretending to be one of them. Write 2 to 4 replies from local users reacting to it naturally, in the same style as the board.',
    'Then judge "risk", how much this post raises their awareness that someone is out there: 0 = it blends in as an ordinary local post; 1 = it is odd or eerie, hints at things they should not know; 2 = it openly reveals alien existence or impossible knowledge and alarms readers. Replies should match the risk (shrug it off, get curious, or panic).',
    v.mode === 'web' ? 'This is a huge public network full of trolls and hoaxes: even a revealing post is usually dismissed as trolling, a hoax or role-play ("nice try", "pics or it didn\'t happen"), so replies mostly mock or ignore it. Still judge the risk of the post itself honestly.' : 'This is a small network of a few hundred professionals: an odd post is noticed and taken seriously.',
    'Output only JSON: {"replies":[{"who":"handle","text":"..."}],"risk":0}',
  ].join('\n') }, { role: 'user', content: [civFact(c), `Awareness: ${AWARE[c.lv]?.desc ?? ''}.`, faithLine,
    th ? `Thread "${th.title}":\n` + th.posts.slice(-6).map((p) => `${p.who}: ${p.text}`).join('\n') : `New thread titled "${title}".`,
    `New post by ${mine.who}: ${mine.text}`].filter(Boolean).join('\n') }];
}
/** 초기 우주 시대(대중 인터넷)는 글이 너무 많아 우리 글이 소음에 묻힌다(2026-11-04 사용자: 극악의 확률로만 인지도 상승).
 *  위험도 1 → 2%, 2 → 5% 확률로만 그 위험도만큼 오른다. 원자력 시대(소수만 쓰는 망)는 위험도 그대로. */
export const WEB_AW_CHANCE = [0, 0.02, 0.05] as const;
export function netAwareness(mode: NetMode, risk: number, r: number): number {
  const k = Math.max(0, Math.min(NET.riskMax, Math.round(risk)));
  if (mode === 'term') return k;
  return k > 0 && r < WEB_AW_CHANCE[k] ? k : 0;
}
export function parseNetReply(raw: string): { replies: NetPost[]; risk: number } | null {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  if (!j || typeof j !== 'object') return null;
  const o = j as { replies?: unknown; risk?: unknown };
  const replies = (Array.isArray(o.replies) ? o.replies : []).slice(0, 4).map((p) => { const q = p && typeof p === 'object' ? (p as Record<string, unknown>) : {}; return { who: clean(q.who, 24) || 'anon', text: clean(q.text, NET.textMax) }; }).filter((p) => p.text);
  const r = Math.round(Number(o.risk));
  return { replies, risk: Number.isFinite(r) ? Math.max(0, Math.min(NET.riskMax, r)) : 1 };
}
