// 타국 지인 개인 서신(45·07, 2026-10-23 집 PC 초안). 규칙: src/foreign-letters.ts. 화면: 집무실 「초대장」 안의 「타국 지인」 칸(ui/office-fbanquet.js).
// 사용자 확정: 만찬에서 연락처를 바꾼 지인과 안부·지난 만남·개인 의견·다음 만남 / 개인 의견 ≠ 국가 입장 / 권한 없는 사람은 조약·자원을 약속하지 않고 「전하겠다」만(실제 전달로 저장 안 함) /
//   통치자·상대가 바뀌면 승계 없음 / 없는 추억 금지 / 사적 편지는 신문·비서와 공유하지 않음 / 편지를 열 때마다 다시 만들지 않음.
// 답장 시기(미정 → 이번 초안): 보낸 다음 게임 달에 한 번 AI 로 답장을 만든다(편지다운 간격, 생성은 플레이어가 쓴 편지마다 한 번).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { onGameSnapshot } from './gamestate-app';
import { office } from './office-app';
import { peopleOf } from './people-app';
import { fbInvitesOf, foreignContactsOf, checkContactsAlive } from './fbanquet-app';
import { cmpDate } from '../gamedate';
import type { Pid } from '../relations';
import { type ForeignThread, type LetterTopic, threadKey, canWrite, stateAsks, authorityOf, boundaryNote, sharedMemories, addLetter, saveReply, topicLabel } from '../foreign-letters';

interface FlBook { sid: string; threads: Record<string, ForeignThread> }
const dir = () => path.join(app.getPath('userData'), 'foreign-letters');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, FlBook>();
export function sanitizeFlBook(x: unknown, sid: string): FlBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<FlBook>, threads: Record<string, ForeignThread> = {};
  for (const [k, t] of Object.entries(o.threads ?? {})) if (t && typeof t === 'object' && typeof t.foreign === 'string' && Array.isArray(t.letters)) threads[k] = { ...t, key: k, letters: t.letters.filter((l) => l && typeof l.id === 'string' && typeof l.text === 'string').slice(-40) };
  return { sid, threads };
}
function bookOf(sid: string): FlBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeFlBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'foreign-letters', error: e }); b = sanitizeFlBook(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'foreign-letters', error: e }); }
}
const rulerOf = (sid: string) => peopleOf(sid).find((p) => p.ruler && !p.gone);
const TOPIC_EN: Record<LetterTopic, string> = { greetings: 'greetings and personal news', past_meeting: 'the dinner where you met', personal_opinion: 'your personal opinion on a policy matter', next_meeting: 'wishing to meet again' };

/** 답장 프롬프트(영어 지시, 응답 언어는 aiclient). 허용된 프로필·실제 추억·이 묶음의 지난 편지·권한 경계만 넣는다. */
export function letterMessages(a: { ruler: string; rulerEmpire: string; date: string }, f: { name: string; empire: string; cls: string }, mem: { on?: string }[], past: { from: 'ruler' | 'them'; text: string }[], letter: { topic?: LetterTopic; text: string }, boundaries: string[]): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    `You are ${f.name}, a ${f.cls} leader of the Stellaris empire "${f.empire}" (not its ruler). You are writing a private reply to ${a.ruler || 'the ruler'} of "${a.rulerEmpire || 'their empire'}", whom you met at a dinner. Date: ${a.date || 'unknown'}.`,
    mem.length ? `[Real shared memories]\n${mem.map((m) => `- A private dinner hosted by your ruler${m.on ? ` (${m.on})` : ''}, where you were introduced and exchanged contacts.`).join('\n')}` : '',
    past.length ? `[Earlier letters]\n${past.slice(-6).map((p) => `${p.from === 'ruler' ? a.ruler || 'Ruler' : f.name}: ${p.text.slice(0, 300)}`).join('\n')}` : '',
    letter.topic ? `The ruler writes about: ${TOPIC_EN[letter.topic]}.` : '',
    boundaries.length ? `[Authority limits]\n${boundaries.map((b) => '- ' + b).join('\n')}` : '',
    'Write a personal letter of 3-6 sentences. Your opinions are your own, not your empire\'s official position. You hold no authority to sign treaties, pledge resources or move fleets; at most say you will mention it to your ruler, and never claim anything was delivered, agreed or paid. Do not invent shared memories beyond those listed, do not reveal state secrets, do not invent game facts or numbers. Wishing to meet again is not a schedule. Keep it friendly but not romantic.',
  ].filter(Boolean).join('\n') }, { role: 'user', content: String(letter.text ?? '').slice(0, 1500) }];
}

export function lettersView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', contacts: [] };
  const r = rulerOf(sid), rp = r ? `p:${r.lid}` : '', b = bookOf(sid), inv = fbInvitesOf(sid);
  return { sid, date: ctx.gameDate || '', topics: (['greetings', 'past_meeting', 'personal_opinion', 'next_meeting'] as LetterTopic[]).map((t) => ({ id: t, name: topicLabel(t) })),
    contacts: foreignContactsOf(sid).map((c) => { const th = rp ? b.threads[threadKey(sid, rp, c.pid)] : undefined, w0 = rp ? canWrite(inv, rp, c.pid, 'active') : { ok: false, why: L('우리 통치자를 아직 확인하지 못했습니다.', 'Our ruler is not confirmed yet.') }, w = c.status === 'gone' ? { ok: false, why: goneWhy(c.goneOn) } : w0;
      return { pid: c.pid, name: c.name, empire: c.empireName, metOn: c.metOn, gone: c.status === 'gone', canWrite: w.ok, why: w.why ?? '', pending: !!th?.letters.some((l) => !l.reply), letters: (th?.letters ?? []).slice(-10).map((l) => ({ id: l.id, topic: l.topic ? topicLabel(l.topic) : '', text: l.text, on: l.on, reply: l.reply ? { text: l.reply.text, on: l.reply.on, notes: l.reply.claims.map((c) => c.text) } : null })) }; }) };
}
const goneWhy = (on?: string) => L(`${on ? on + '부터 ' : ''}소식이 끊겼습니다. 세상을 떠났거나 공직에서 물러났을 수 있습니다.`, `No word${on ? ' since ' + on : ''}. They may have passed away or left public life.`);
function push(): void { try { const v = lettersView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('flUpdate', v); } catch { /* 창 없음 */ } }

function send(sid: string, pid: Pid, topic: LetterTopic | undefined, text: string): void {
  if (foreignContactsOf(sid).find((x) => x.pid === pid)?.status === 'gone') throw new Error(goneWhy(foreignContactsOf(sid).find((x) => x.pid === pid)?.goneOn));
  const r = rulerOf(sid); if (!r) throw new Error(L('우리 통치자를 아직 확인하지 못했습니다.', 'Our ruler is not confirmed yet.'));
  const rp = `p:${r.lid}`, c = foreignContactsOf(sid).find((x) => x.pid === pid); if (!c) throw new Error(L('그 지인을 찾을 수 없습니다.', 'That acquaintance was not found.'));
  const w = canWrite(fbInvitesOf(sid), rp, pid, 'active'); if (!w.ok) throw new Error(w.why);
  const b = bookOf(sid), key = threadKey(sid, rp, pid), th = (b.threads[key] ??= { key, sid, ruler: rp, foreign: pid, empireIdx: c.empireIdx, contactFrom: c.via, letters: [] });
  if (th.letters.some((l) => !l.reply)) throw new Error(L('지난 편지의 답장을 기다리는 중입니다.', 'Still waiting for a reply to your last letter.'));
  const t = String(text ?? '').trim().slice(0, 1500); if (!t) throw new Error(L('편지 내용을 적어 주세요.', 'Write your letter.'));
  addLetter(th, { id: `fl:${randomUUID().slice(0, 12)}`, from: rp, to: pid, ...(topic ? { topic } : {}), text: t, on: ctx.gameDate || '', refs: [] });
  save(sid); push();
}
/** 달이 바뀌면 지난달 이전에 보낸 편지의 답장을 만든다(편지마다 한 번). 통치자가 바뀌었으면 답장은 그 묶음에만 남고 새 통치자에게 넘어가지 않는다. */
async function replyMonth(sid: string, date: string): Promise<void> {
  const b = bookOf(sid), r = rulerOf(sid), rp = r ? `p:${r.lid}` : '', contacts = foreignContactsOf(sid), inv = fbInvitesOf(sid); let made = 0;
  for (const th of Object.values(b.threads)) for (const l of th.letters) {
    if (l.reply || !l.on || cmpDate(date.slice(0, 7) + '.01', l.on.slice(0, 7) + '.01') <= 0 || made >= 3) continue; // 같은 달에 보낸 편지는 다음 달에, 한 달에 3통까지
    const c = contacts.find((x) => x.pid === th.foreign); if (!c || c.status === 'gone') continue; // 소식이 끊긴 지인은 답장하지 않는다
    const past = th.letters.filter((x) => x.id !== l.id).flatMap((x) => [{ from: 'ruler' as const, text: x.text }, ...(x.reply ? [{ from: 'them' as const, text: x.reply.text }] : [])]);
    const bounds = boundaryNote(stateAsks(l.text), authorityOf({ isRuler: false }));
    try {
      const raw = String(await ctx.ai.chat(letterMessages({ ruler: peopleOf(sid).find((p) => `p:${p.lid}` === th.ruler)?.name ?? '', rulerEmpire: ctx.playerName, date }, { name: c.name, empire: c.empireName, cls: c.cls }, sharedMemories(inv, th.ruler, th.foreign), past, l, bounds), { maxTokens: 700, purpose: 'foreign-letter' }) ?? '').trim();
      if (raw && saveReply(th, l.id, th.key, { text: raw.slice(0, 2000), on: date })) { made++; if (th.ruler === rp) { (office as { toastGo: string }).toastGo = 'fbanquet'; ctx.notify({ kind: 'office', title: L(`${c.name}의 답장`, `A reply from ${c.name}`), body: L(`${c.empireName}의 지인이 답장을 보냈습니다. 집무실 「초대장」의 타국 지인 칸에서 읽을 수 있습니다.`, `Your acquaintance in ${c.empireName} wrote back. Read it under foreign acquaintances in the office "Invitations".`), action: L('집무실', 'Office') }); } }
    } catch (e) { logDiagnostic('warn', 'fletter.reply_failed', { error: (e as Error).message }); }
  }
  if (made) { save(sid); push(); }
}

export function registerFletters(): void {
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId) return; void replyMonth(snap.sid, snap.date).catch((e) => logDiagnostic('warn', 'fletter.month_failed', { error: (e as Error).message })); }, 'invite');
  ipcMain.handle('flState', () => lettersView());
  ipcMain.handle('flSend', async (_e, pid: unknown, topic: unknown, text: unknown) => {
    try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); const tp = ['greetings', 'past_meeting', 'personal_opinion', 'next_meeting'].includes(String(topic)) ? (String(topic) as LetterTopic) : undefined; await checkContactsAlive(sid, ctx.gameDate || ''); send(sid, String(pid ?? ''), tp, String(text ?? '')); return { ok: true, state: lettersView() }; }
    catch (e) { return { ok: false, error: (e as Error).message, state: lettersView() }; }
  });
}
