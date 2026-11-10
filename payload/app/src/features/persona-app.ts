// 집무실 인물 대화 + 기억(앱 쪽, 2026-10-18). 순수 로직은 src/persona.ts.
// 연락처의 인물과 집무실 안에서 1:1로 이야기한다(총독은 행성 정보가 있는 기존 총독 창을 그대로 쓴다).
// 세이브별 sllm_persona.json 에 인물마다 말투 한 줄·신뢰·기억(최근 12개)을 둔다. 대화는 끝날 때 한 번 요약해 기억으로 남긴다.
// 2026-10-29: 지도자에 대해 아는 것(facts)을 대화 답에서 같이 받아 쌓고(호출 추가 없음), 오래 안 지킨 약속은 신뢰를 깎는다. 요약이 실패하면 AI 없이 한 줄을 남긴다.
import { cleanCard, CARD_MAX } from '../memory-links';
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { redactKey, conversationOf } from '../aiclient';
import { officeView } from './office-app';
import { gestaltCode } from './gestalt-app';
import { fleetView } from './fleet-app';
import { pick } from './settings-ui';
import { withPolicyContext } from './policy-app';
import { addMonths } from '../gamedate';
import { isRulerSpouse, noteIntimate, familyPromptLine } from '../app/children-hooks';
import {
  type PersonaMem, type Talk, type PersonInfo, emptyMem, applyMove, addMemory, syncEvents, syncHearing, trustLevel,
  personaMessages, talkMessages, summaryMessages, parseJson, endSentence, cleanLine, MAX_TURNS, MAX_MEM, needsPersona, traitSig, clampTrust,
  applyFacts, applyKept, promiseDebt, FACT,
  toneRead, temperFelt, applyFelt, calmDown, gossipHearers, gossipStory, hearGossip,
} from '../persona';

const L = pick; // 한국어·영어·언어 팩
let data: Record<string, Record<string, PersonaMem>> | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_persona.json');
function all(): Record<string, Record<string, PersonaMem>> {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'persona', error: e }); data = {}; }
  return data!;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'persona', error: e }); } }
export const memOf = (sid: string, key: string): PersonaMem => { const s = (all()[sid] ??= {}); const m = (s[key] ??= emptyMem()); m.mems ??= []; return m; };

/** 지금 세이브의 연락처에서 이 인물 찾기. */
export function personOf(key: string): PersonInfo | null {
  const p = (officeView().people as PersonInfo[]).find((x) => x.key === key);
  if (!p) return null;
  const g = gestaltCode(); return g ? { ...p, gestalt: g } : p; // 단일 의식 제국이면 인물 말투가 달라진다(2026-10-19)
}
/** 사건(기술 수준 상승·청문회 결과)을 신뢰와 기억에 반영. */
function syncPerson(sid: string, p: PersonInfo): PersonaMem {
  const m = memOf(sid, p.key); const date = ctx.gameDate || '';
  let ch = syncEvents(m, p, date);
  if (date && promiseDebt(m, date)) ch = true; // 2년 넘게 안 지킨 약속(2026-10-29)
  if (calmDown(m, date)) ch = true; if (hearGossip(m, date)) ch = true; // 두려움·원한 옅어짐, 때가 된 뒷말(2026-10-29)
  const lid = Number(String(p.key).replace(/^(p|adm):/, ''));
  if (Number.isFinite(lid) && lid > 0) { const a = fleetView().admirals.find((x: { lid: number }) => x.lid === lid) as { hearings?: number; status?: string } | undefined; if (a && typeof a.hearings === 'number') ch = syncHearing(m, a.hearings, a.status, date) || ch; }
  if (ch) save();
  return m;
}
const view = (m: PersonaMem, p?: PersonInfo) => ({ traits: p?.traits ?? [], persona: m.persona ?? '', trust: m.trust, fear: m.fear ?? 0, resent: m.resent ?? 0, level: (() => { const t = trustLevel(m.trust); return L(t.ko, t.en); })(), mems: m.mems.slice().reverse(), talks: m.talks, last: m.last ?? '',
  // 아는 것(2026-10-29): 플레이어에게는 모두 보여 준다(자기가 한 말이니까). guarded = 비밀인데 지금 신뢰로는 대화에 안 꺼냄
  facts: (m.facts ?? []).slice().sort((a, b) => b.w - a.w).map((f) => ({ text: f.t, cat: f.c, date: f.d, kept: !!f.kept, owed: !!f.owed, guarded: f.c === 'secret' && m.trust < FACT.secretTrust })) });

const talks = new Map<string, Talk>(); // 진행 중인 대화(세이브|인물)
const busy = new Set<string>();

/** 인물 AI 호출(JSON). 추론형 모델(Player2 등)은 생각에 토큰을 많이 써서 답이 잘릴 수 있다(2026-10-18 실기: 700 중 686 을 쓰고 본문 30자).
 *  넉넉한 한도로 부르고, 필요한 칸을 못 읽으면 한도를 두 배로 한 번 더. 못 읽으면 null. */
/** need: 반드시 채워져야 하는 칸 하나, 또는 칸 목록(그중 하나라도 들어 있으면 값이 비어 있어도 완성된 답으로 본다 — 2026-10-22 실기: 비서 요약의 "note" 는
 *  업무 이야기가 없으면 빈 칸이 정상인데, 이를 실패로 보고 두 번 부른 뒤 기억·취향까지 통째로 버렸다). */
export async function personaJson(msgs: Parameters<typeof ctx.ai.chat>[0], maxTokens: number, need: string | string[], conversationId?: string): Promise<Record<string, unknown> | null> {
  let cut: Record<string, unknown> | null = null; // 끊긴 답(마지막 수단)
  for (const mt of [maxTokens, maxTokens * 2]) {
    const raw = await ctx.ai.chat(msgs, { purpose: 'persona', maxTokens: mt, json: true, ...(conversationId ? { conversationId } : {}) });
    const j = parseJson(raw); const has = Array.isArray(need) ? !!(j && !j.partial && need.some((k) => k in j)) : !!(j && String(j[need] ?? '').trim());
    if (has && !j!.partial) return j; // 완성된 JSON 만 바로 쓴다. 한도에 걸려 끊긴 답은 한도를 늘려 다시
    if (has) cut = j;
    logDiagnostic('warn', 'ai.response.invalid', { feature: 'persona.' + (Array.isArray(need) ? need.join('+') : need), chars: String(raw || '').length, maxTokens: mt, partial: has });
  }
  if (cut && !Array.isArray(need)) { const { partial: _p, ...rest } = cut; return { ...rest, [need]: endSentence(String(cut[need])) }; } // 두 번 다 끊기면 마지막 완성 문장까지
  return null;
}
export async function ensurePersona(sid: string, p: PersonInfo, m: PersonaMem): Promise<void> {
  if (!needsPersona(m, p)) return; // 처음이거나 특성이 새로 들어오거나 바뀌었을 때만
  try {
    const j = await personaJson(personaMessages(p, ctx.playerName || '', m.bio || ''), 1000, 'persona'); const t = cleanLine(j?.persona, 120);
    if (t && ctx.curSaveId === sid) { m.persona = t; m.traitSig = traitSig(p); save(); }
  } catch (e) { logDiagnostic('warn', 'persona.init_failed', { error: String(e) }); }
}

async function finishTalk(sid: string, key: string): Promise<{ ok: boolean; memory?: string; error?: string }> {
  const tk = sid + '|' + key, talk = talks.get(tk); talks.delete(tk);
  if (!talk || !talk.lines.some((l) => l.who === 'me')) return { ok: true };
  const p = personOf(key); if (!p) return { ok: true };
  const m = memOf(sid, key); m.talks++; m.last = ctx.gameDate || m.last; save();
  // 요약을 못 받으면 AI 없이 한 줄(2026-10-29): 날짜·주고받은 수·관계 변화
  const plain = () => { const n = talk.lines.filter((l) => l.who === 'me').length; return L(`지도자와 ${n}번 이야기를 나눴다${talk.moved ? `(관계 ${talk.moved > 0 ? '+' : ''}${talk.moved})` : ''}`, `Talked with the leader (${n} exchange${n === 1 ? '' : 's'}${talk.moved ? `, relationship ${talk.moved > 0 ? '+' : ''}${talk.moved}` : ''})`); };
  try {
    const memo = cleanLine((await personaJson(summaryMessages(p, talk, ctx.playerName || ''), 1000, 'memory'))?.memory, 160) || plain();
    if (memo && ctx.curSaveId === sid && addMemory(m, ctx.gameDate || '', memo)) save();
    return { ok: true, ...(memo ? { memory: memo } : {}) };
  } catch (e) {
    const memo = plain(); if (ctx.curSaveId === sid && addMemory(m, ctx.gameDate || '', memo)) save();
    return { ok: false, memory: memo, error: redactKey(L('기억을 정리하지 못했습니다: ', 'Could not save the memory: ') + (e as Error).message) };
  }
}

/** 뒷말 퍼뜨리기(2026-10-29): 동료 최대 3명이 한 달 뒤 소문으로 듣는다(사람마다 최대 10건). */
function spreadGossip(sid: string, from: PersonInfo, story: { t: string; d: number }, date: string): void {
  if (!date) return;
  let people: PersonInfo[] = []; try { people = officeView().people as PersonInfo[]; } catch { return; }
  const due = addMonths(date, 1);
  for (const k of gossipHearers(from, people, Math.random)) { const h = memOf(sid, k); h.heard = [...(h.heard ?? []), { t: story.t, d: story.d, due, from: from.key }].slice(-10); }
}
export function registerPersona(): void {
  /** 연락처 상세용: 말투·신뢰·기억(최근 것 먼저). 대화 기록은 없다. */
  ipcMain.handle('personaInfo', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid || !k) return null;
    const p = personOf(k); if (!p) return null;
    return view(syncPerson(sid, p), p);
  });
  /** 통신 열기: 처음이면 말투를 정하고, 이 인물이 먼저 인사한다(기억이 있으면 지난 이야기로). */
  ipcMain.handle('personaOpen', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 통신할 수 있습니다.', 'Load a save before opening a channel.') };
    const p = personOf(k); if (!p) return { ok: false, error: L('연락처에서 이 인물을 찾지 못했습니다.', 'This person is not in your contacts.') };
    const tk = sid + '|' + k; if (busy.has(tk)) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    busy.add(tk);
    try {
      const m = syncPerson(sid, p); await ensurePersona(sid, p, m);
      const talk: Talk = { key: k, lines: [], moved: 0, opened: ctx.gameDate || '' }; talks.set(tk, talk);
      let greet = '';
      try {
        greet = cleanLine((await personaJson(withPolicyContext(talkMessages(p, m, talk, '[Channel open - the leader has opened the hologram link. Greet them briefly first.]', ctx.playerName || '', ctx.gameDate || '', { family: familyPromptLine(sid, k) })), 1500, 'reply', conversationOf(talk)))?.reply);
      } catch (e) { return { ok: true, person: p, ...view(m, p), lines: [], error: redactKey(L('인사를 받지 못했습니다: ', 'No greeting: ') + (e as Error).message) }; }
      if (greet) talk.lines.push({ who: 'them', text: greet });
      return { ok: true, person: p, ...view(m, p), lines: talk.lines.slice() };
    } finally { busy.delete(tk); }
  });
  /** 말하기: 인물의 답 + 이번 말로 움직인 신뢰(앱이 한도로 묶음). */
  ipcMain.handle('personaSay', async (_e, key: unknown, text: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''), t = cleanLine(text, 500); if (!sid || !t) return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.') };
    const tk = sid + '|' + k, talk = talks.get(tk), p = personOf(k);
    if (!talk || !p) return { ok: false, error: L('통신이 끊겼습니다. 다시 열어 주세요.', 'The channel was closed. Open it again.') };
    if (busy.has(tk)) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    if (talk.lines.length >= MAX_TURNS * 2) return { ok: false, error: L('대화가 길어졌습니다. 마치고 다시 열어 주세요.', 'This conversation is long. End it and open a new one.') };
    busy.add(tk);
    try { return await sayCore(sid, k, p, talk, t); }
    finally { busy.delete(tk); }
  });
  /** 대화 마치기: 1~2줄로 요약해 기억에 쌓는다. */
  ipcMain.handle('personaEnd', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid || !k) return { ok: true };
    const r = await finishTalk(sid, k);
    const m = memOf(sid, k);
    return { ...r, ...view(m, personOf(k) ?? undefined) };
  });
}
/** 직접 만나는 자리에서의 대화(2026-10-30 체스: 사교회·만찬). 신뢰·말이 들린 방식·아는 것·뒷말은 1:1 통신과 똑같이 셈한다.
 *  talk 은 부르는 쪽(chess-app)이 들고 있고, opts.scene·opts.board 로 장면과 판 상황을 넘긴다. */
export async function sayInPerson(sid: string, k: string, talk: Talk, text: string, opts: { scene: string; board?: string }): Promise<Record<string, unknown>> {
  const p = personOf(k), t = cleanLine(text, 500); if (!p) return { ok: false, error: L('이 인물을 찾지 못했습니다.', 'This person was not found.') };
  if (!t) return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.') };
  const tk = sid + '|' + k + '|scene'; if (busy.has(tk)) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
  if (talk.lines.length >= MAX_TURNS * 2) talk.lines.splice(0, talk.lines.length - MAX_TURNS); // 긴 대국: 오래된 말은 흘려보낸다
  busy.add(tk);
  try { const m = syncPerson(sid, p); await ensurePersona(sid, p, m); return await sayCore(sid, k, p, talk, t, opts); }
  catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
  finally { busy.delete(tk); }
}
async function sayCore(sid: string, k: string, p: PersonInfo, talk: Talk, t: string, scene: { scene?: string; board?: string } = {}): Promise<Record<string, unknown>> {
    try {
      const m = memOf(sid, k), spouse = isRulerSpouse(sid, k); // 통치자의 배우자면 친밀함 묘사 여부도 같은 답에서(통치자의 아이, 2026-10-27)
      const j = await personaJson(withPolicyContext(talkMessages(p, m, talk, t, ctx.playerName || '', ctx.gameDate || '', { spouse, family: familyPromptLine(sid, k), ...scene })), 1500, 'reply', conversationOf(talk)); const reply = cleanLine(j?.reply);
      if (!reply) return { ok: false, error: L('답을 읽지 못했습니다. 다시 말해 보세요.', 'Could not read the reply. Try again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      talk.lines.push({ who: 'me', text: t }, { who: 'them', text: reply });
      const date = ctx.gameDate || '', read = toneRead(t), tf = temperFelt(j?.felt, read); // 말이 어떻게 들렸는지: AI felt + 낱말 바닥선(2026-10-29)
      const d = applyFelt(m, p, tf.felt, applyMove(m, talk, j?.move), t, date, read.denial);
      { const story = gossipStory(tf.felt, j?.tell_others, p.name); if (story) spreadGossip(sid, p, story, date); } // 뒷말: 한 달 뒤 동료에게
      const learned = applyFacts(m, j?.facts, ctx.gameDate || ''), kept = applyKept(m, j?.kept); save(); // 아는 것·지켜진 약속(같은 답, 2026-10-29)
      if (spouse && j?.intimate === true) noteIntimate(sid, k);
      return { ok: true, reply, delta: d, felt: tf.felt, fear: m.fear ?? 0, resent: m.resent ?? 0, trust: m.trust, level: (() => { const t = trustLevel(m.trust); return L(t.ko, t.en); })(), learned, kept, ...(learned || kept ? { facts: view(m, p).facts } : {}) };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
}
/** 인물 전기(2026-10-18, features/backstory-app.ts). 바꾸면 말투를 다시 정한다. */
export const personBio = (sid: string, key: string): string => all()[sid]?.[key]?.bio ?? '';
/** 플레이어가 정한 말투·비밀(2026-10-28). */
export const personCard = (sid: string, key: string): { voice: string; secret: string } => { const m = all()[sid]?.[key]; return { voice: m?.voice ?? '', secret: m?.secret ?? '' }; };
export function setPersonCard(sid: string, key: string, c: { voice?: string; secret?: string }): void {
  const m = memOf(sid, key); const v = cleanCard(c?.voice, CARD_MAX.voice), s = cleanCard(c?.secret, CARD_MAX.secret);
  if ((m.voice ?? '') === v && (m.secret ?? '') === s) return;
  if (v) m.voice = v; else delete m.voice; if (s) m.secret = s; else delete m.secret; save();
}
export function setPersonBio(sid: string, key: string, text: string): void {
  const m = memOf(sid, key), t = text.trim();
  if ((m.bio ?? '') === t) return;
  if (t) m.bio = t; else delete m.bio;
  delete m.persona; delete m.traitSig; save();
}
/** 총독 창(gov.ts)에서: 이 행성 총독의 인물 전기. */
export function governorBio(planet: string): string {
  const sid = ctx.curSaveId; if (!sid || !planet) return '';
  try { const p = (officeView().people as PersonInfo[]).find((x) => x.role === 'governor' && x.planet === planet); return p ? personBio(sid, p.key) : ''; } catch { return ''; }
}
/** 개인 서신(letters-app)에서: 마지막으로 이야기한 날짜, 기억 한 줄·신뢰 변화 남기기. */
export const personaLast = (sid: string, key: string): string | undefined => all()[sid]?.[key]?.last;
export function personaNote(sid: string, key: string, text: string, delta = 0): void {
  const m = memOf(sid, key); let ch = false;
  if (text && addMemory(m, ctx.gameDate || '', text)) ch = true;
  if (delta) { m.trust = clampTrust(m.trust + delta); ch = true; }
  if (ch) save();
}
/** 내각 회의(faction-app, 2026-10-19)에서: 이 인물의 말투·신뢰·기억 읽기만(없으면 null, 새로 만들지 않는다). */
export const personaPeek = (sid: string, key: string): PersonaMem | null => all()[sid]?.[key] ?? null;
export const _personaLimits = { MAX_MEM, MAX_TURNS };
