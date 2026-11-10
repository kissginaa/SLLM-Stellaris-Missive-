// 집무실 3단계: 개인 서신(앱 쪽, 2026-10-18). 순수 로직은 src/letters.ts.
// 매달 지도자 명단이 들어오면(people-app) 계기를 후보로 쌓고, 6개월마다 무작위로 골라 봉투를 만든다(AI 없음).
// 본문은 플레이어가 봉투를 열 때 한 번만 AI 로 쓴다. 부탁은 버튼(들어주기/거절)으로, 결과는 앱이 정하고 게임에 특성을 건다.
// 세이브별 sllm_letters.json(빈도 설정 포함). 새 편지: 집무실 아이콘·오버레이 집무실 버튼의 숫자 + 알림 카드.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { redactKey } from '../aiclient';
import { safeSend } from '../safe-send';
import { terminalRequest } from './terminal';
import { office, officeView, setOfficeLetters, pushOffice } from './office-app';
import { fleetView } from './fleet-app';
import { peopleOf, onPeopleChanged, onPeopleMonth } from './people-app';
import { memOf, personOf, ensurePersona, personaLast, personaNote, personaJson } from './persona-app';
import { wins } from './windows';
import { gestaltCode } from './gestalt-app';
import { pick, selectedLanguage } from './settings-ui';
import { traitLoc, traitLabel } from '../trait-names';
import { parseJson, cleanLine, STEP_CAP, type PersonInfo } from '../persona';
import {
  type LetterSave, type Letter, type LivePerson, type Freq, type Cand, emptyLetters, detect, draw, unreadCount, letterMessages, replyMessages, favorCommand,
  FAVORS, FAVOR_TRUST, DRAW_COUNT,
} from '../letters';

const L = pick; // 한국어·영어·언어 팩
interface LetterFile { freq: Freq; saves: Record<string, LetterSave> }
let data: LetterFile | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_letters.json');
function all(): LetterFile {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' && j.saves ? j : { freq: 'few', saves: {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'letters', error: e }); data = { freq: 'few', saves: {} }; }
  if (!(data!.freq in DRAW_COUNT)) data!.freq = 'few'; // 기본: 적게(6개월에 1통)
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'letters', error: e }); } }
const saveOf = (sid: string): LetterSave => { const s = (all().saves[sid] ??= emptyLetters()); s.cands ??= []; s.sent ??= {}; s.letters ??= []; s.seen ??= {}; s.next ??= 1; return s; };
const unread = (): number => (ctx.curSaveId ? unreadCount(saveOf(ctx.curSaveId)) : 0);
const loc = () => traitLoc(ctx.flagProv.game(), selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기
const traitNote = (k: string) => { const l = loc(); return traitLabel(l.names, k) + (l.descs[k] ? ` (${l.descs[k]})` : ''); };

function badge(): void { safeSend(wins.launcher, 'officeBadge', unread()); pushOffice(); }

/** 지금 살아 있는 내 지도자(명단 + 함대 사령부의 전투 수). */
function livePeople(sid: string): LivePerson[] {
  const roles = new Map((officeView().people as Array<{ key: string; role: string }>).map((p) => [p.key, p.role]));
  const adm = new Map((fleetView().admirals as Array<{ lid: number; battles: Array<{ sys?: string }> }>).map((a) => [a.lid, a]));
  return peopleOf(sid).filter((p) => !p.gone).map((p) => {
    const a = adm.get(p.lid);
    return { key: 'p:' + p.lid, lid: p.lid, name: p.name, role: roles.get('p:' + p.lid) ?? (p.ruler ? 'ruler' : p.cls), lv: p.lv, ...(p.traits ? { traits: p.traits } : {}), ...(a ? { battles: a.battles.length, battleSys: a.battles[a.battles.length - 1]?.sys ?? '' } : {}), first: p.first };
  });
}

/** 매달(명단이 들어온 뒤): 후보 쌓기 → 6개월이 지났으면 뽑기. */
function onMonth(): void {
  const sid = ctx.curSaveId, date = ctx.gameDate; if (!sid || !date) return;
  const s = saveOf(sid), people = livePeople(sid); if (!people.length) return;
  detect(s, people, date);
  const label = (c: Cand) => (c.kind === 'trait' ? traitLabel(loc().names, c.detail) : c.detail);
  const r = draw(s, people, date, all().freq, (k) => personaLast(sid, k), Math.random, label);
  if (gestaltCode()) for (const l of r.letters) delete l.favor; // 단일 의식 제국의 인물에게는 휴가·고향·동료 추천 같은 개인적인 부탁이 없다(2026-10-19)
  for (const m of r.memos) personaNote(sid, m.key, m.text);
  save();
  if (r.letters.length) {
    logDiagnostic('info', 'letters.drawn', { n: r.letters.length, favors: r.letters.filter((l) => l.favor).length });
    const first = r.letters[0]; office.toastGo = 'letters';
    ctx.notify({ kind: 'office', title: r.letters.length > 1 ? L(`개인 서신 ${r.letters.length}통이 도착했습니다`, `${r.letters.length} personal letters have arrived`) : subject(first), body: L('집무실의 개인 서신에서 읽을 수 있습니다.', 'Read them in Personal Letters in the office.'), action: L('개인 서신', 'Personal Letters') });
  }
  badge();
}

/** 봉투 제목(앱이 정함, AI 없음). */
function subject(l: Letter): string {
  const k = l.kinds[0]?.kind, n = l.name;
  if (l.final) return l.final === 'fired' ? L(`떠나는 ${n}의 작별 편지`, `A farewell from ${n}`) : L(`${n}의 마지막 편지`, `The last letter of ${n}`);
  const t = k === 'levelup' ? L(`${n}의 승진 소식`, `News of a promotion from ${n}`)
    : k === 'trait' ? L(`${n}의 근황`, `News from ${n}`)
    : k === 'battle' ? L(`전투를 마친 ${n}의 편지`, `A letter from ${n} after battle`)
    : L(`오랜만에 온 ${n}의 안부`, `Greetings from ${n} after a long silence`);
  return t;
}
const view = (l: Letter) => ({ final: l.final ?? '', id: l.id, key: l.key, name: l.name, role: l.role, date: l.date, subject: subject(l), read: l.read, body: l.body ?? '', favor: l.favor ? { kind: l.favor.kind, state: l.favor.state, note: l.favor.note ?? '', energy: FAVORS[l.favor.kind].energy } : null, reply: l.reply ?? null });
function listView() {
  const sid = ctx.curSaveId; const s = sid ? saveOf(sid) : emptyLetters();
  return { sid, running: ctx.gameRunning, freq: all().freq, unread: unreadCount(s), letters: s.letters.slice().reverse().map(view) };
}
/** 편지를 보낸 인물: 지금 연락처에 있으면 그 정보, 떠났으면 편지에 적힌 이름·직책만. */
const personFor = (l: Letter): PersonInfo => personOf(l.key) ?? { key: l.key, name: l.name, role: l.role, ...(l.traits && l.traits.length ? { traits: l.traits } : {}), ...(gestaltCode() ? { gestalt: gestaltCode() } : {}) };
const busy = new Set<number>();
const FAVOR_MEMO = { leave: '휴가', colleague: '동료 추천', homeworld: '고향 행성 지원' } as const;
const FAVOR_MEMO_EN = { leave: 'leave', colleague: 'colleague recommendation', homeworld: 'home planet aid' } as const;

/** 이 인물에게서 받은 편지 수(추모관 비석의 "남긴 일"). */
export const lettersFrom = (sid: string, key: string): number => saveOf(sid).letters.filter((l) => l.key === key && !l.final).length;
/** 작별 편지(memorial-app 이 부른다): 6개월 뽑기·1년 한도와 상관없이 바로 봉투. 본문은 열 때. */
export function addFarewell(sid: string, a: { key: string; lid: number; name: string; role: string; why: 'death' | 'fallen' | 'fired'; date: string; traits?: string[] }): void {
  const s = saveOf(sid);
  if (s.letters.some((l) => l.key === a.key && l.final)) return; // 한 사람에게 한 통
  const l: Letter = { id: s.next++, key: a.key, lid: a.lid, name: a.name, role: a.role, date: a.date, kinds: [{ kind: 'farewell', detail: a.why }], read: false, final: a.why, ...(a.traits && a.traits.length ? { traits: a.traits.slice(0, 12) } : {}) };
  s.letters.push(l); save();
  office.toastGo = 'letters';
  ctx.notify({ kind: 'office', title: subject(l), body: L('집무실의 개인 서신에서 읽을 수 있습니다.', 'Read it in Personal Letters in the office.'), action: L('개인 서신', 'Personal Letters') });
  badge();
}

export function registerLetters(): void {
  setOfficeLetters(unread);
  onPeopleChanged(onMonth);
  onPeopleMonth(onMonth); // 2026-11-03: 명단이 매달 오지 않으므로 달마다도 부른다(뽑기는 날짜로 한 번만)
  ipcMain.handle('lettersList', async () => listView());
  ipcMain.handle('officeLetterBadge', async () => unread());
  /** 모두 읽음 표시(2026-10-18): 봉투만 읽음으로 바꾼다. 본문(AI)은 쓰지 않고, 나중에 직접 열 때 처음 쓴다. */
  ipcMain.handle('lettersReadAll', async () => {
    const sid = ctx.curSaveId; if (!sid) return listView();
    let n = 0; for (const l of saveOf(sid).letters) if (!l.read) { l.read = true; n++; }
    if (n) { save(); badge(); }
    return listView();
  });
  ipcMain.handle('letterFreq', async (_e, f: unknown) => { if (typeof f === 'string' && f in DRAW_COUNT) { all().freq = f as Freq; save(); } return listView(); });
  /** 봉투 열기: 읽음 표시, 본문이 없으면 이때 한 번 AI 로 쓴다. */
  ipcMain.handle('letterOpen', async (_e, id: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 읽을 수 있습니다.', 'Load a save first.') };
    const s = saveOf(sid), l = s.letters.find((x) => x.id === Number(id)); if (!l) return { ok: false, error: L('편지를 찾지 못했습니다.', 'Letter not found.') };
    if (!l.read) { l.read = true; save(); badge(); }
    if (l.body) return { ok: true, letter: view(l) };
    if (busy.has(l.id)) return { ok: false, error: L('편지를 펼치는 중입니다.', 'Still opening the letter.') };
    busy.add(l.id);
    try {
      const p = personFor(l), m = memOf(sid, l.key);
      if (personOf(l.key)) await ensurePersona(sid, p, m); // 말투가 정해져 있어야 편지도 그 말투로
      const body = String((await personaJson(letterMessages(p, m, l, ctx.playerName || '', ctx.gameDate || '', traitNote), 2400, 'body'))?.body ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
      if (!body) return { ok: false, letter: view(l), error: L('편지를 읽지 못했습니다. 다시 열어 보세요.', 'Could not read the letter. Try opening it again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      l.body = body; save();
      return { ok: true, letter: view(l) };
    } catch (e) { return { ok: false, letter: view(l), error: redactKey(L('편지를 펼치지 못했습니다: ', 'Could not open the letter: ') + (e as Error).message) }; }
    finally { busy.delete(l.id); }
  });
  /** 부탁: 들어주기(게임에 「지도자의 신임」 특성, 고향 지원은 에너지) / 거절. AI 없음. */
  ipcMain.handle('letterFavor', async (_e, id: unknown, yes: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 할 수 있습니다.', 'Load a save first.') };
    const s = saveOf(sid), l = s.letters.find((x) => x.id === Number(id)), f = l?.favor;
    if (!l || !f || (f.state !== 'open' && f.state !== 'failed')) return { ok: false, error: L('이미 답한 부탁입니다.', 'This request was already answered.') };
    const what = FAVOR_MEMO[f.kind], whatEn = FAVOR_MEMO_EN[f.kind];
    if (!yes) { f.state = 'declined'; save(); personaNote(sid, l.key, L(`지도자가 ${what} 부탁을 거절했다`, `The leader declined my ${whatEn} request`), FAVOR_TRUST.declined); return { ok: true, letter: view(l) }; }
    if (!/^\d+$/.test(sid) || !ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 부탁을 들어줄 수 있습니다.', 'The game must be running to grant this.') };
    if (!personOf(l.key)) return { ok: false, error: L('이 인물은 이제 제국에 없습니다.', 'This person is no longer in your empire.') };
    const cid = f.cid && /^[a-f0-9]{32}$/.test(f.cid) ? f.cid : randomUUID().replace(/-/g, ''), req = ++link.reqCounter; // 다시 시도할 때는 같은 번호(게임이 이미 적용했으면 duplicate)
    f.cid = cid; f.state = 'pending'; save(); // 보내기 전에 기록: 응답 전에 앱이 꺼져도 두 번 보내지 않는다
    let status = 'uncertain';
    try { const r = await terminalRequest(favorCommand(req, sid, cid, l.lid, FAVORS[f.kind].energy), 'LETTERAPPLY', req); if (r.kv.cid === cid && r.kv.sid === sid) status = r.kv.status ?? 'uncertain'; }
    catch (e) { logDiagnostic('warn', 'letters.favor.failed', { error: String(e) }); }
    if (status === 'applied') { f.state = 'granted'; f.note = ''; personaNote(sid, l.key, L(`지도자가 ${what} 부탁을 들어주었다`, `The leader granted my ${whatEn} request`), FAVOR_TRUST.granted); }
    else if (status === 'poor') { f.state = 'open'; f.note = L('에너지가 모자라 들어주지 못했습니다.', 'Not enough energy.'); }
    else if (status === 'no_target') { f.state = 'failed'; f.note = L('게임에서 이 인물을 찾지 못했습니다.', 'This person was not found in game.'); }
    else if (status === 'duplicate') { f.state = 'granted'; f.note = ''; }
    // 2026-10-29 테스터 「들어주기를 눌러도 시간 초과」: 실패로 굳히지 않고 다시 누를 수 있게 둔다. 같은 cid 라 이미 적용됐으면 게임이 duplicate 로 답한다(두 번 적용 없음).
    else { f.state = 'open'; f.note = L('게임에서 응답을 받지 못했습니다. 게임이 켜져 있고 일시정지 메뉴가 닫혀 있는지 확인한 뒤 다시 눌러 주세요(두 번 적용되지 않습니다).', 'No response from the game. Make sure the game is running with no menu open, then press again (it will not be applied twice).'); }
    save(); logDiagnostic('info', 'letters.favor', { kind: f.kind, status });
    return { ok: true, letter: view(l) };
  });
  /** 직접 답장(편지마다 한 번): 인물의 짧은 회신 + 관계 ±2 + 기억 한 줄. */
  ipcMain.handle('letterReply', async (_e, id: unknown, text: unknown) => {
    const sid = ctx.curSaveId, t = cleanLine(text, 800); if (!sid || !t) return { ok: false, error: L('답장을 입력하세요.', 'Write a reply first.') };
    const s = saveOf(sid), l = s.letters.find((x) => x.id === Number(id));
    if (!l || !l.body) return { ok: false, error: L('편지를 먼저 열어 주세요.', 'Open the letter first.') };
    if (l.reply) return { ok: false, error: L('이미 답장을 보냈습니다.', 'You already replied.') };
    if (l.final === 'death' || l.final === 'fallen') return { ok: false, error: L('세상을 떠난 인물에게는 답장을 보낼 수 없습니다.', 'You cannot reply to someone who has passed away.') };
    if (busy.has(l.id)) return { ok: false, error: L('이미 답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    busy.add(l.id);
    try {
      const p = personFor(l), m = memOf(sid, l.key);
      const j = await personaJson(replyMessages(p, m, l, t, ctx.playerName || ''), 1500, 'reply'), them = cleanLine(j?.reply, 600);
      if (!them) return { ok: false, error: L('회신을 읽지 못했습니다. 다시 보내 보세요.', 'Could not read the response. Try again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      let d = Math.round(Number(j?.move)); if (!Number.isFinite(d)) d = 0; d = Math.max(-STEP_CAP, Math.min(STEP_CAP, d));
      l.reply = { me: t, them }; save();
      personaNote(sid, l.key, cleanLine(j?.memory, 160) || L('지도자가 편지에 답장을 보냈다', 'The leader replied to my letter'), d);
      return { ok: true, letter: view(l), delta: d };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { busy.delete(l.id); }
  });
}
