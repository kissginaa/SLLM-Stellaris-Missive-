// 원시문명 인터넷 염탐(2026-11-04 사용자) — 앱 쪽. 규칙: src/preftl-net.ts · 화면: ui/office-preftl-net.js(「원시문명 관측」 상세에 「컴퓨터망 접속」)
// 글쓰기(2026-11-04): 이번 달 접속 게시판에 답글·새 글(접속 한 번에 3개) → 현지인 답글 + 위험도(0~2)만큼 인지도(게임 명령, 하늘의 목소리와 같은 명령).
// 원자력 시대부터, 우리 관측소가 있을 때, 누를 때만(게임 명령 없음) 한 문명당 게임 1달에 한 번. 관측 정보는 preftl-app 의 저장소(civs)를 읽기만 한다.
// 저장: sllm_preftl_net.json { saves: { [세이브]: { [문명 번호]: NetVisit[] } } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { redactKey } from '../aiclient';
import { preftlCivs, preftlFaithLine, preftlStandoffFact, preftlScan } from './preftl-app';
import { link } from '../app/game-link';
import { terminalRequest } from './terminal';
import { voiceCommand } from '../preftl-voice';
import { NET, NET_AGE, netBlock, netMode, netMessages, parseNet, templateNet, postBlock, netHandle, cleanHandle, cleanPostText, cleanTitle, netPostMessages, parseNetReply, netAwareness, type NetVisit, type NetPost } from '../preftl-net';

const file = () => path.join(app.getPath('userData'), 'sllm_preftl_net.json');
let all: Record<string, Record<string, NetVisit[]>> | null = null;
const books = () => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const listOf = (sid: string, id: number): NetVisit[] => ((books()[sid] ??= {})[String(id)] ??= []);
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'preftlnet.save_failed', { error: (e as Error).message }); } };

export function preftlNetView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { ok: false, items: [] };
  const date = ctx.gameDate || '';
  return { ok: true, items: preftlCivs(sid).map((c) => { const v = listOf(sid, c.id); return { id: c.id, name: c.name, show: (c.age >= NET_AGE && !c.hive) || v.length > 0, mode: netMode(c.age), block: netBlock(c, v[v.length - 1], date || c.seen), postBlock: postBlock(v[v.length - 1], date || c.seen), myLeft: Math.max(0, NET.myPosts - (v[v.length - 1]?.mine ?? 0)), handle: netHandle(netMode(c.age), c.id * 13 + v.length), visits: v.slice().reverse() }; }) };
}
async function tapIn(idIn: unknown): Promise<{ visit: NetVisit; note?: string }> {
  const sid = ctx.curSaveId || '', id = Number(idIn); if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const c = preftlCivs(sid).find((x) => x.id === id); if (!c) throw new Error(L('그 원시문명을 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found. Observe again.'));
  const list = listOf(sid, id), date = ctx.gameDate || c.seen, why = netBlock(c, list[list.length - 1], date); if (why) throw new Error(why);
  const recent = list.slice(-3).flatMap((v) => v.threads.map((t) => t.title));
  let v: NetVisit | null = null, note: string | undefined;
  try { v = parseNet(String(await ctx.ai.chat(netMessages(c, [preftlFaithLine(id, sid), preftlStandoffFact(id, sid)].filter(Boolean).join('\n'), recent), { purpose: 'preftl-net', maxTokens: NET.maxTokens, json: true }) ?? ''), c, date); if (!v) note = L('AI 답이 비어 기본 게시판으로 채웠습니다.', 'The AI reply was empty, so standard posts were used.'); }
  catch (err) { note = L('AI가 게시판을 쓰지 못해 기본 게시판으로 채웠습니다: ', 'The AI could not write the board, so standard posts were used: ') + redactKey((err as Error).message); }
  v ??= templateNet(c, date);
  list.push(v); while (list.length > NET.keep) list.shift(); save(); logDiagnostic('info', 'preftlnet.tap', { mode: v.mode, llm: v.llm });
  return { visit: v, ...(note ? { note } : {}) };
}
/** 글쓰기(2026-11-04 사용자): 이번 달 접속 게시판에 몰래 글 → 현지인 답글 + 위험도만큼 인지도(게임 명령). */
async function post(a: { id?: unknown; thread?: unknown; title?: unknown; text?: unknown; handle?: unknown }): Promise<{ visit: NetVisit; ti: number; risk: number; aw: number; mode: string; applied: boolean }> {
  const sid = ctx.curSaveId || '', id = Number(a?.id); if (!sid) throw new Error(L('세이브를 불러와 주세요.', 'Load a save first.'));
  const c = preftlCivs(sid).find((x) => x.id === id); if (!c) throw new Error(L('그 원시문명을 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found. Observe again.'));
  const list = listOf(sid, id), v = list[list.length - 1], date = ctx.gameDate || c.seen, why = postBlock(v, date); if (why || !v) throw new Error(why);
  if (!ctx.gameRunning || !link.sessionReady || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 글을 쓸 수 있습니다(들키면 인지도가 오릅니다).', 'The game must be running to post (getting noticed raises their awareness).'));
  const text = cleanPostText(a?.text); if (!text) throw new Error(L('내용을 적어 주세요.', 'Write something first.'));
  let ti = Number(a?.thread); const newTitle = cleanTitle(a?.title);
  if (!(Number.isInteger(ti) && ti >= 0 && ti < v.threads.length)) { if (!newTitle) throw new Error(L('새 글에는 제목이 필요합니다.', 'A new thread needs a title.')); ti = -1; }
  const mine: NetPost = { who: cleanHandle(a?.handle) || netHandle(v.mode, c.id * 13 + list.length), text, mine: true };
  let r: { replies: NetPost[]; risk: number } | null = null;
  try { r = parseNetReply(String(await ctx.ai.chat(netPostMessages(c, v, ti, newTitle, mine, [preftlFaithLine(id, sid), preftlStandoffFact(id, sid)].filter(Boolean).join('\n')), { purpose: 'preftl-net', maxTokens: NET.replyTokens, json: true }) ?? '')); }
  catch (err) { logDiagnostic('warn', 'preftlnet.post_ai_failed', { error: redactKey((err as Error).message) }); }
  r ??= { replies: [], risk: 1 }; // AI 가 못 읽으면 조심스럽게 「이상함」으로 본다
  mine.risk = r.risk;
  if (ti < 0) { v.threads.push({ title: newTitle, posts: [mine, ...r.replies] }); ti = v.threads.length - 1; } else v.threads[ti].posts.push(mine, ...r.replies);
  v.mine = (v.mine ?? 0) + 1; save();
  const aw = netAwareness(v.mode, r.risk, Math.random()); // 초기 우주 시대는 소음에 묻혀 극악의 확률로만
  let applied = aw === 0;
  if (aw > 0) {
    try { const req = ++link.reqCounter; await terminalRequest(voiceCommand(req, sid, id, aw, 0), 'PFTLACT', req); applied = true; v.aw = (v.aw ?? 0) + aw; save(); }
    catch (err) { logDiagnostic('warn', 'preftlnet.aw_failed', { error: (err as Error).message }); }
    try { if (applied) await preftlScan(); } catch { /* 다음 관측 때 */ }
  }
  logDiagnostic('info', 'preftlnet.post', { risk: r.risk, aw, applied });
  return { visit: v, ti, risk: r.risk, aw, mode: v.mode, applied };
}

export function registerPreftlNet(): void {
  ipcMain.handle('preftlNetState', () => preftlNetView());
  ipcMain.handle('preftlNetPost', async (_e, a: { id?: unknown; thread?: unknown; title?: unknown; text?: unknown; handle?: unknown }) => { try { return { ok: true, ...(await post(a)), state: preftlNetView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlNetView() }; } });
  ipcMain.handle('preftlNetTap', async (_e, id: unknown) => { try { return { ok: true, ...(await tapIn(id)), state: preftlNetView() }; } catch (err) { return { ok: false, error: (err as Error).message, state: preftlNetView() }; } });
}
