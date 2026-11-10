// 은퇴 지도자의 앱 내 생활(18·19·20, 2026-10-23 집 PC 초안). 규칙: src/retired.ts. 화면: 집무실 「은퇴 인물」(ui/office-retired.js), 인물 카드의 「은퇴 뒤에도 연락 유지」.
// 사용자 확정: 사망하지 않고 은퇴가 확인된 인물은 앱이 생활·나이·연락을 맡는다(게임 생존 추적은 조건 아님) / 일반 지도자는 「연락처 유지」 선택 + 은퇴 사유로 연락 가능 판정 /
//   전임 통치자는 기본으로 유지 / 자동 사망 규칙은 미정(넣지 않는다) / 함께 사는 배우자가 대신 받거나 같이 나오는 장면.
// 판정 근거: 모드 LEADEROUT why=death|fired, 월간 명단에서 사라짐 + 통치자 교체. 명단 누락만으로는 사망·은퇴를 정하지 않는다(→ 확인 필요).
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf, onLeaderOut, onPeopleChanged } from './people-app';
import { relBookOf, setRetiredGuests } from './relations-app';
import { traitLoc, traitLabel } from '../trait-names';
import { selectedLanguage } from './settings-ui';
import { dayNo } from '../gamedate';
import type { Person } from '../people';
import { type RetiredRecord, type DepartureReason, departureFromSignals, contactEligibility, canContact, ageNow, yearsLeftHint, retiredListing, pickResponder } from '../retired';

type Talk = { who: 'ruler' | 'self' | 'partner'; name: string; text: string; on: string };
type Rec = RetiredRecord & { talk: Talk[] };
interface RetBook { sid: string; records: Record<string, Rec>; keep: Record<string, boolean> }
const dir = () => path.join(app.getPath('userData'), 'retired');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, RetBook>();
export function sanitizeRetBook(x: unknown, sid: string): RetBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<RetBook>, records: Record<string, Rec> = {};
  for (const [k, r] of Object.entries(o.records ?? {})) if (r && typeof r === 'object' && typeof r.name === 'string' && /^p:\d+$/.test(k)) records[k] = { ...r, pid: k, talk: Array.isArray(r.talk) ? r.talk.slice(-30) : [], snapshot: r.snapshot && typeof r.snapshot === 'object' ? r.snapshot : {} };
  const keep: Record<string, boolean> = {}; for (const [k, v] of Object.entries(o.keep ?? {})) if (/^p:\d+$/.test(k) && typeof v === 'boolean') keep[k] = v;
  return { sid, records, keep };
}
function bookOf(sid: string): RetBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeRetBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'retired', error: e }); b = sanitizeRetBook(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'retired', error: e }); }
}

/** 인물 말투·기억(persona-app). main.ts 가 꽂는다. */
let personaPeek: ((sid: string, key: string) => { persona?: string; mems?: { text: string }[] } | null) | null = null;
export function setRetiredPersona(p: { mem: (sid: string, key: string) => { persona?: string; mems?: { text: string }[] } | null }): void { personaPeek = p.mem; }

const roleOf = (p: Person): string => (p.ruler ? 'ruler' : p.council ? 'councilor' : p.cls);
/** 은퇴 기록 만들기(한 사람 한 번 — 같은 pid 는 사유만 더 정확하게 고친다). 전임 통치자는 기본 유지(18), 일반 지도자는 미리 고른 「연락 유지」를 따른다(19). */
export function makeRecord(b: RetBook, p: Person, reason: DepartureReason, on: string): Rec {
  const pid = `p:${p.lid}`, had = b.records[pid];
  if (had) { if (reason !== 'unknown' && reason !== 'vanished' && had.reason !== reason) { had.reason = reason; had.eligibility = contactEligibility(reason); } return had; }
  const r: Rec = { pid, sid: b.sid, name: p.name, cls: p.cls, lastRole: roleOf(p), wasRuler: !!p.ruler, retiredOn: on, reason, eligibility: contactEligibility(reason), keepRequested: b.keep[pid] ?? !!p.ruler,
    ...(p.age !== undefined ? { ageAtRetire: p.age } : {}), ...(p.immortal !== undefined ? { immortal: p.immortal } : {}), ...(p.life !== undefined ? { lifespanAtRetire: p.life } : {}), ...(p.svc !== undefined ? { yearsOfService: p.svc } : {}),
    snapshot: { traits: (p.traits ?? []).slice(0, 12) }, talk: [] };
  b.records[pid] = r; return r;
}
/** 월간 명단 뒤: 이번에 사라진 인물(최근 2개월 안)만 판정. 통치자였고 통치자가 바뀌었으면 임기 종료 은퇴, 아니면 확인 필요. 다시 나타나면 확인 필요 기록은 지운다. */
export function rosterSweep(b: RetBook, people: Person[], today: string): Rec[] {
  const out: Rec[] = [], now = dayNo(today) ?? 0, curRuler = people.find((p) => p.ruler && !p.gone);
  for (const p of people) {
    const pid = `p:${p.lid}`, had = b.records[pid];
    if (!p.gone) { if (had && (had.reason === 'vanished' || had.reason === 'unknown')) delete b.records[pid]; continue; } // 다른 직책으로 돌아옴 등
    if (had) continue;
    const g = dayNo(p.gone); if (g === null || now - g > 60) continue; // 기능 이전에 떠난 사람까지 한꺼번에 만들지 않는다
    const reason = departureFromSignals({ stillListed: false, wasRuler: !!p.ruler, rulerChanged: !!curRuler && curRuler.lid !== p.lid });
    out.push(makeRecord(b, p, reason, p.gone!));
  }
  return out;
}

const REASON: Record<DepartureReason, [string, string]> = { death: ['세상을 떠남', 'Passed away'], fired: ['해임됨', 'Dismissed'], retired: ['임기를 마치고 물러남', 'Stepped down after their term'], vanished: ['명단에서 사라짐(사유 확인 필요)', 'Left the roster (reason unconfirmed)'], unknown: ['사유 미확인', 'Reason unknown'] };
const ROLE: Record<string, [string, string]> = { ruler: ['전임 통치자', 'Former ruler'], councilor: ['전 평의원', 'Former councilor'], commander: ['전 지휘관', 'Former commander'], official: ['전 관료', 'Former official'], scientist: ['전 과학자', 'Former scientist'] };
function householdOf(sid: string, r: Rec): { partner: string; partnerName: string; cohabit: boolean; known: boolean } | null {
  const led = relBookOf(sid).ledger, b = bookOf(sid);
  for (const pr of Object.values(led.pairs)) {
    if ((pr.a !== r.pid && pr.b !== r.pid) || !['married', 'dating', 'engaged'].includes(pr.romance)) continue;
    const other = pr.a === r.pid ? pr.b : pr.a, o = b.records[other];
    const name = o?.name ?? peopleOf(sid).find((p) => `p:${p.lid}` === other)?.name ?? '';
    // 20: 함께 사는 것은 혼인 중이고 상대도 은퇴 생활일 때만(현역이면 근무지에 있다). 과거 연애로 동거를 만들지 않는다.
    return { partner: other, partnerName: name, cohabit: pr.romance === 'married' && !!o && !o.lifeEndedOn && o.reason !== 'death', known: pr.visibility === 'public' || pr.visibility === 'player' || led.playerKnows.pairs.includes(pr.key) };
  }
  return null;
}
export function retiredView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', items: [] };
  const b = bookOf(sid), today = ctx.gameDate || '', loc = traitLoc(ctx.flagProv.game(), selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
  const items = Object.values(b.records).sort((a, c) => (a.retiredOn < c.retiredOn ? 1 : -1)).map((r) => {
    const hh = householdOf(sid, r), lst = retiredListing(r);
    return { pid: r.pid, name: r.name, role: L(...(ROLE[r.lastRole] ?? ROLE.official)), retiredOn: r.retiredOn, reason: L(...REASON[r.reason]), reasonCode: r.reason, listing: L(lst.ko, lst.en), canContact: canContact(r), eligibility: r.eligibility, keep: r.keepRequested,
      age: ageNow(r, today), yearsLeft: yearsLeftHint(r, today), immortal: !!r.immortal, traits: (r.snapshot.traits ?? []).map((k) => traitLabel(loc.names, k)).slice(0, 6),
      household: hh && hh.cohabit ? { partnerName: hh.partnerName } : null, talk: r.talk.slice(-20) };
  });
  return { sid, date: today, items };
}
function push(): void { try { const v = retiredView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('retiredUpdate', v); } catch { /* 창 없음 */ } }

/** 은퇴자 통신 장면(20): 한 번의 호출에 화자별 발언(본인·배우자). 영어 지시, 응답 언어는 aiclient. 은퇴 뒤 비밀은 모른다. */
export function retiredMessages(a: { empire: string; ruler: string; date: string }, r: { name: string; role: string; retiredOn: string; reason: string; age: number | null; traits: string[]; persona?: string; memories: string[] }, responder: 'self' | 'partner' | 'both', partnerName: string, talk: Talk[], said: string): { role: 'system' | 'user'; content: string }[] {
  const scene = responder === 'partner' ? `${partnerName}, ${r.name}'s spouse who lives with them, picks up the call first and may go fetch ${r.name}; ${r.name} may join at the end.` : responder === 'both' ? `${r.name} answers with their spouse ${partnerName} beside them; both may speak.` : `${r.name} answers personally.`;
  return [{ role: 'system', content: [
    `You voice a retired leader of the Stellaris empire "${a.empire || 'our empire'}" receiving a private call from the ruler ${a.ruler || ''}. Date: ${a.date || 'unknown'}.`,
    `${r.name}: ${r.role}; left office on ${r.retiredOn} (${r.reason}).${r.age !== null ? ` Now about ${r.age} years old.` : ''}`,
    r.traits.length ? `Traits: ${r.traits.join(', ')}.` : '', r.persona ? `Manner: ${r.persona}` : '',
    r.memories.length ? `[Memories from their time in office]\n${r.memories.slice(-5).map((m) => '- ' + m).join('\n')}` : '',
    scene,
    talk.length ? `[Earlier in this call]\n${talk.slice(-8).map((t) => `${t.name}: ${t.text.slice(0, 240)}`).join('\n')}` : '',
    'Their daily life in retirement is creative role-play (a garden, a walk, a book): keep it small and consistent, and never present it as game events. They do not know state secrets from after they retired — only what they witnessed in office and public news. Do not invent game facts or numbers. Never write the ruler\'s lines.',
    'Output only JSON: {"lines":[{"who":"self|partner","text":"..."}]} with 1-3 short lines.',
  ].filter(Boolean).join('\n') }, { role: 'user', content: String(said ?? '').slice(0, 600) || '(The ruler calls to see how they are doing.)' }];
}
export function parseRetiredReply(raw: string, allowPartner: boolean): { who: 'self' | 'partner'; text: string }[] {
  const clean = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let o: unknown; try { o = JSON.parse(clean); } catch { const m = /\{[\s\S]*\}/.exec(clean); if (!m) return []; try { o = JSON.parse(m[0]); } catch { return []; } }
  const lines = (o as { lines?: unknown })?.lines; if (!Array.isArray(lines)) return [];
  return lines.map((x) => ({ who: (x as { who?: unknown })?.who === 'partner' && allowPartner ? 'partner' as const : 'self' as const, text: String((x as { text?: unknown })?.text ?? '').trim().slice(0, 700) })).filter((x) => x.text).slice(0, 3);
}

async function talk(sid: string, pid: string, said: string) {
  const b = bookOf(sid), r = b.records[pid]; if (!r) throw new Error(L('그 인물의 은퇴 기록이 없습니다.', 'No retirement record for that person.'));
  if (!canContact(r)) throw new Error(r.eligibility !== 'eligible' ? L('지금은 연락할 수 없는 인물입니다.', 'This person cannot be contacted.') : L('먼저 연락처에 넣어 주세요.', 'Add them to your contacts first.'));
  const today = ctx.gameDate || '', ruler = peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? '', hh = householdOf(sid, r);
  const hhRec = hh ? { partner: hh.partner, cohabit: hh.cohabit, since: '' } : undefined;
  const responder = said && r.talk.length ? 'self' : pickResponder({ ...r, household: hhRec }, !!hh?.known, Math.random); // 통화를 시작할 때만 배우자가 받을 수 있다
  const mem = personaPeek?.(sid, pid), loc = traitLoc(ctx.flagProv.game(), 'en');
  const raw = String(await ctx.ai.chat(retiredMessages({ empire: ctx.playerName, ruler, date: today }, { name: r.name, role: (ROLE[r.lastRole] ?? ROLE.official)[1].toLowerCase(), retiredOn: r.retiredOn, reason: REASON[r.reason][1].toLowerCase(), age: ageNow(r, today), traits: (r.snapshot.traits ?? []).map((k) => traitLabel(loc.names, k)).slice(0, 4), persona: mem?.persona, memories: (mem?.mems ?? []).map((m) => m.text) }, responder, hh?.partnerName ?? '', r.talk, said), { maxTokens: 500, purpose: 'retired-call', json: true }) ?? '');
  const lines = parseRetiredReply(raw, responder !== 'self' && !!hh?.cohabit); if (!lines.length) throw new Error(L('대답을 읽지 못했습니다. 다시 말해 주세요.', 'Could not read the reply. Please try again.'));
  if (said) r.talk.push({ who: 'ruler', name: ruler, text: said, on: today });
  for (const l of lines) r.talk.push({ who: l.who, name: l.who === 'partner' ? hh?.partnerName ?? '' : r.name, text: l.text, on: today });
  r.talk = r.talk.slice(-30); save(sid); push();
  return lines.map((l) => ({ ...l, name: l.who === 'partner' ? hh?.partnerName ?? '' : r.name }));
}

export function registerRetired(): void {
  setRetiredGuests((sid) => Object.values(bookOf(sid).records).filter(canContact).map((r) => ({ pid: r.pid, name: r.name, cls: r.cls, traits: r.snapshot?.traits ?? [] }))); // 29: 연락 가능한 은퇴자는 사교회 초대 대상(수락 50%)
  onLeaderOut((kv) => {
    const sid = ctx.curSaveId; if (!sid) return;
    const lid = Number(kv.lid), p = peopleOf(sid).find((x) => x.lid === lid); if (!p || (kv.why !== 'death' && kv.why !== 'fired')) return;
    const b = bookOf(sid), r = makeRecord(b, p, kv.why, String(kv.date || ctx.gameDate || ''));
    if (r.reason === 'fired' && r.keepRequested) chronNoteWorld(L(`${r.retiredOn} ${r.name} — 해임 뒤에도 연락을 이어갑니다`, `${r.retiredOn} ${r.name} — dismissed, but still in touch`), false);
    save(sid); push();
  });
  onPeopleChanged(() => {
    const sid = ctx.curSaveId; if (!sid) return;
    const made = rosterSweep(bookOf(sid), peopleOf(sid), ctx.gameDate || '');
    for (const r of made) if (r.reason === 'retired') chronNoteWorld(L(`${r.retiredOn} ${r.name} — 통치자 자리에서 물러나 은퇴 생활을 시작했습니다`, `${r.retiredOn} ${r.name} — stepped down as ruler and began a quiet retirement`), true);
    if (made.length) { save(sid); push(); }
  });
  ipcMain.handle('retiredState', () => retiredView());
  ipcMain.handle('retiredKeep', (_e, pid: unknown, on: unknown) => {
    const sid = ctx.curSaveId, k = String(pid ?? ''); if (!sid || !/^p:\d+$/.test(k)) return { ok: false };
    const b = bookOf(sid); b.keep[k] = !!on; if (b.records[k]) b.records[k].keepRequested = !!on; save(sid); push();
    return { ok: true, keep: !!on, state: retiredView() };
  });
  ipcMain.handle('retiredKeepState', (_e, pid: unknown) => { const sid = ctx.curSaveId, k = String(pid ?? ''); if (!sid) return null; const b = bookOf(sid), p = peopleOf(sid).find((x) => `p:${x.lid}` === k); return p ? { keep: b.keep[k] ?? !!p.ruler, ruler: !!p.ruler } : null; });
  ipcMain.handle('retiredTalk', async (_e, pid: unknown, text: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, lines: await talk(sid, String(pid ?? ''), String(text ?? '').trim().slice(0, 600)), state: retiredView() }; } catch (e) { return { ok: false, error: (e as Error).message, state: retiredView() }; } });
}
