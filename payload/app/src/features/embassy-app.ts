// 대사관 보고서(앱 쪽, 2026-10-19). 규칙·예측은 src/embassy.ts, 화면은 ui/office-embassy.js(집무실 「대사관」).
// 알파 9: 화면은 「대사관 보고」(공식 경로: 대사관이 있어야 열림)와 「첩보 보고」(비밀 경로: 첩보 수준에 따라, 소문 표시) 두 갈래. 같은 자료(EMBASSY·PROFILE)를 두 시선으로 본다.
// 흐름: 연락처(외교 단말기와 같은 목록)에서 제국을 고름 → 「최신 정보 받기」 = 모드 sllm_probe_embassy(EMBFAC 여러 줄 + PROFILE + 끝 줄 EMBASSY)
// → 세이브별 sllm_embassy.json 에 마지막 자료 저장 → 화면은 볼 때마다 화면 언어로 예측을 다시 계산. 「대사 보고 받기」 = AI 가 쓴 전문(선택).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { terminal, terminalRequest, terminalReplies, terminalView, contactAllowed } from './terminal';
import { agentFor, agentView, setAgentCover, agentHasMail, openAgentLetter, agentHooks, spyPowerOf } from './agents-app';
import { office } from './office-app'; // 첩보 공작원(2026-10-20 알파 9 ④)
import { chronNoteWorld, chronNote } from './chronicle-app';
import { noteExtra } from './media';
import { gameName } from './namegen-app';
import { randomName } from '../debate';
import { MANNERS, agentPromptLine } from '../agents';
import { withSpyPower, diplomaticBoost, expelReason, canReturn, farewellMessages, type ExpelWhy, ambassadorTalkMessages, cleanTalkReply, regularDue, TALK_MAX, TALK_TEXT, type TalkTurn } from '../embassy';
import { type EmbRaw, type EmbFaction, type EmbReport, embFromKv, factionFromKv, assessEmbassy, assessOfficial, assessSecret, embChanges, seriesChanges, embPointFromKv, pushPoint, type EmbPoint, type Ambassador, factionLines, embassyMessages, spyReportMessages, parseEmbassyReport, embassyCommand, INTEL_NAME, LEVEL_NAME } from '../embassy';
import { refreshFrontier, frontierFor } from './frontier-app'; // 국경·영유권 등(2026-10-26)
import { frontierFactsUs } from '../frontier';
import { stanceOfEmpire, stanceLabel } from './condemn-app'; // 우리 전쟁에 대한 이 나라의 성명(2026-10-20)
import { hoiHooks, fsupViewFor } from './hoi-app'; // 파벌 공작(2026-10-28 하츠 참고)
import { noteSecretHook } from '../app/deal-hooks'; // 첩보 보고서의 확인된 비밀 → 거래 갈고리(2026-10-26) — deals-app 이 등록(가져오기 고리 방지)

const L = pick; // 한국어·영어·언어 팩
const T = (x: [string, string]) => L(x[0], x[1]);
/** prev = 직전 날짜의 자료(변화 비교용), amb = 상주 대사 인물(처음 전문에서 정해지면 계속 같은 인물) */
interface Entry { raw: EmbRaw; report?: EmbReport; spy?: EmbReport; prev?: EmbRaw; amb?: Ambassador; spyAmb?: Ambassador; /** 대사와 나눈 대화(2026-10-20) */ talk?: TalkTurn[] }
let data: Record<string, Record<string, Entry>> | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_embassy.json');
function all(): Record<string, Record<string, Entry>> {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'embassy', error: e }); data = {}; }
  return data!;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'embassy', error: e }); } }
const saveOf = (sid: string) => (all()[sid] ??= {});
/** 대사 추방 기록(2026-10-20 알파 9): 세이브 → 제국 번호. active 동안 공식 전문이 끊긴다. 관계가 회복되면 닫고 새 대사가 부임한다. */
interface Expel { host: string; date: string; why: ExpelWhy; amb: Ambassador; active: boolean; back?: string; cable?: EmbReport }
let exData: Record<string, Record<string, Expel>> | null = null;
const exFile = () => path.join(app.getPath('userData'), 'sllm_expel.json');
function exAll(): Record<string, Record<string, Expel>> { if (exData) return exData; try { const j = JSON.parse(fs.readFileSync(exFile(), 'utf8')); exData = j && typeof j === 'object' ? j : {}; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'expel', error: e }); exData = {}; } return exData!; }
function exSave(): void { try { fs.writeFileSync(exFile(), JSON.stringify(exAll()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'expel', error: e }); } }
const expelOf = (sid: string, idx: number): Expel | undefined => exAll()[sid]?.[String(idx)];
const WHY_TEXT: Record<ExpelWhy, [string, string]> = { war: ['전쟁 발발', 'war broke out'], opinion: ['관계 붕괴', 'relations collapsed'], spy: ['대사관 무관(공작원) 발각', 'embassy attaché (our agent) exposed'] };
/** 정기 공식 보고(2026-10-20): 세이브 → { 제국 번호 → 마지막으로 표시한 해 }, due = 아직 전문을 받지 않은 정기 보고. */
interface Reg { year: Record<string, number>; due: number[] }
let regData: Record<string, Reg> | null = null;
const regFile = () => path.join(app.getPath('userData'), 'sllm_embreg.json');
function regAll(): Record<string, Reg> { if (regData) return regData; try { const j = JSON.parse(fs.readFileSync(regFile(), 'utf8')); regData = j && typeof j === 'object' ? j : {}; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'embreg', error: e }); regData = {}; } return regData!; }
function regSave(): void { try { fs.writeFileSync(regFile(), JSON.stringify(regAll()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'embreg', error: e }); } }
const regOf = (sid: string): Reg => { const r = (regAll()[sid] ??= { year: {}, due: [] }); r.year ??= {}; r.due = Array.isArray(r.due) ? r.due : []; return r; };
const isDue = (sid: string, idx: number) => regOf(sid).due.includes(idx);
let regTimer: ReturnType<typeof setTimeout> | null = null, regNew = 0;
function markRegular(sid: string, idx: number, date: string): void {
  const r = regOf(sid), d = regularDue(r.year[String(idx)], date); if (!d) return;
  r.year[String(idx)] = d.year;
  if (d.due && !r.due.includes(idx)) { r.due.push(idx); regNew += 1; if (!regTimer) regTimer = setTimeout(() => { regTimer = null; const n = regNew; regNew = 0; if (!n) return; (office as { toastGo: string }).toastGo = 'embassy'; ctx.notify({ kind: 'office', title: L(`대사관 정기 보고 ${n}건이 도착했습니다`, `${n} annual embassy report(s) have arrived`), body: L('집무실 「대사관」에서 대사 전문을 받아 보세요(전문을 받을 때만 AI를 씁니다).', 'Request the cables in the office under Embassies (AI is used only when you request one).'), action: L('대사관', 'Embassies') }); }, 3000); }
  regSave();
}
const newAmb = (): Ambassador => { const mi = Math.floor(Math.random() * MANNERS.length); return { name: gameName(Math.random() < 0.5 ? 'm' : 'f') || randomName(), manner: MANNERS[mi][1], mi }; };
/** 우리 대사가 추방된다: 기록·연대기·호외·알림, 그리고 대사의 마지막 전문(AI 한 번, 실패해도 추방은 그대로). */
export function expelAmbassador(idx: number, host: string, why: ExpelWhy, date: string): void {
  const sid = ctx.curSaveId; if (!sid || !idx) return;
  const cur = expelOf(sid, idx); if (cur?.active) return;
  const e = saveOf(sid)[String(idx)], amb = e?.amb ?? newAmb();
  const x: Expel = { host, date, why, amb, active: true }; (exAll()[sid] ??= {})[String(idx)] = x; exSave();
  const line = L(`${date} [추방] ${host}이(가) 우리 대사 ${amb.name}을(를) 추방했다(${WHY_TEXT[why][0]}).`, `${date} [Expelled] ${host} expelled our ambassador ${amb.name} (${WHY_TEXT[why][1]}).`);
  chronNoteWorld(line, true); chronNote(idx, L(`우리는 ${ctx.playerName || '그들'}의 대사 ${amb.name}을(를) 추방했다(${WHY_TEXT[why][0]}).`, `We expelled ${ctx.playerName || 'their'} ambassador ${amb.name} (${WHY_TEXT[why][1]}).`), true);
  noteExtra('expel', date, line);
  ctx.notify({ kind: 'event', title: L(`${host}이(가) 우리 대사를 추방했습니다`, `${host} has expelled our ambassador`), body: L(`대사 ${amb.name}이(가) 귀국합니다(${WHY_TEXT[why][0]}). 관계가 회복될 때까지 대사관 전문은 끊깁니다. 첩보 보고는 그대로 받을 수 있습니다.`, `Ambassador ${amb.name} is coming home (${WHY_TEXT[why][1]}). Embassy cables stop until relations recover. Espionage reports still work.`) });
  logDiagnostic('info', 'embassy.expel', { why });
  void (async () => { try { const rep = parseEmbassyReport(await ctx.ai.chat(farewellMessages(host, ctx.playerName || 'the player empire', amb, why, date), { purpose: 'embassy-farewell', json: true, maxTokens: 1200 }), date); if (rep && expelOf(sid, idx) === x) { x.cable = { ...rep, amb }; exSave(); } } catch (err) { logDiagnostic('warn', 'embassy.farewell_failed', { error: String(err) }); } })();
}
/** 관계가 회복됐다: 대사관 재개, 다음 전문부터 새 대사. */
function reopenEmbassy(sid: string, idx: number, x: Expel, date: string): void {
  x.active = false; x.back = date; exSave();
  const e = saveOf(sid)[String(idx)]; if (e?.amb) { delete e.amb; save(); }
  chronNoteWorld(L(`${date} ${x.host}와(과)의 관계가 회복되어 우리 대사관이 다시 문을 열었다.`, `${date} Relations with ${x.host} have recovered and our embassy has reopened.`), true);
  logDiagnostic('info', 'embassy.reopen', {});
}
/** 지난 보고 이후 달라진 점(공식은 대사관이 있을 때, 비밀은 첩보망이 닿을 때만 보여 준다). */
function changesOf(e: Entry) {
  const all = embChanges(e.prev, e.raw), o = assessOfficial(e.raw).available, sc = assessSecret(effRaw(e.raw)).available;
  const pick2 = (ch: 'official' | 'secret') => all.filter((c) => c.ch === ch && (ch === 'official' ? o : sc)).map((c) => ({ text: T(c.text), worse: c.worse }));
  return { official: pick2('official'), secret: pick2('secret'), prevDate: e.prev?.date ?? '' };
}
/** 두 달 간격 감시 기록(모드 EMBMON): 세이브 → 제국 번호 → 점들. 따로 저장한다. */
let mon: Record<string, Record<string, EmbPoint[]>> | null = null;
const monFile = () => path.join(app.getPath('userData'), 'sllm_embmon.json');
function monAll(): Record<string, Record<string, EmbPoint[]>> {
  if (mon) return mon;
  try { const j = JSON.parse(fs.readFileSync(monFile(), 'utf8')); mon = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'embmon', error: e }); mon = {}; }
  return mon!;
}
let monTimer: ReturnType<typeof setTimeout> | null = null;
function monSave(): void { if (monTimer) return; monTimer = setTimeout(() => { monTimer = null; try { fs.writeFileSync(monFile(), JSON.stringify(monAll()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'embmon', error: e }); } }, 2000); }
const seriesOf = (sid: string, idx: number): EmbPoint[] => monAll()[sid]?.[String(idx)] ?? [];
/** 감시 기록에서 본 변화: 공식은 대사관이 있을 때, 비밀은 첩보망이 닿을 때만. */
function monChanges(sid: string, idx: number, e?: Entry) {
  const ch = seriesChanges(seriesOf(sid, idx)), o = e ? assessOfficial(e.raw).available : true, sc = e ? assessSecret(effRaw(e.raw)).available : false;
  const pick3 = (c: 'official' | 'secret') => ch.filter((x) => x.ch === c && (c === 'official' ? o : sc)).map((x) => ({ text: T(x.text), worse: x.worse }));
  return { official: pick3('official'), secret: pick3('secret') };
}
const facBuf = new Map<number, EmbFaction[]>(); // 요청 번호 → 모은 파벌 줄
const busy = new Set<number>();

/** 첩보 수준을 첩보망 침투 수준으로 보완한 자료(2026-10-27: 게임 정보 값 조건이 실패해 늘 0 이던 문제). */
function effRaw(r: EmbRaw): EmbRaw { return withSpyPower(r, spyPowerOf(r.name)); }
function detail(sid: string, idx: number) {
  const e = saveOf(sid)[String(idx)]; if (!e) return null;
  const a = assessEmbassy(e.raw), o = assessOfficial(e.raw), ag0 = agentFor(e.raw.name), sc = ag0?.dip ? diplomaticBoost(assessSecret(effRaw(e.raw))) : assessSecret(effRaw(e.raw)), x = expelOf(sid, idx);
  return {
    official: { available: o.available, level: o.level, levelName: T(LEVEL_NAME[o.level]), threat: o.threat, signals: o.shown.map((s) => ({ text: T(s.text), weight: s.weight })), factions: factionLines(e.raw, L, false) },
    amb: e.amb ? { ...e.amb, manner: e.amb.mi !== undefined && MANNERS[e.amb.mi] ? L(MANNERS[e.amb.mi][0], MANNERS[e.amb.mi][1]) : e.amb.manner } : null, changes: changesOf(e), monthly: monChanges(sid, idx, e), series: seriesOf(sid, idx).map((p) => ({ date: p.date, op: p.op })),
    secret: { available: sc.available, level: sc.level, levelName: T(LEVEL_NAME[sc.level]), threat: sc.threat, confidence: T(sc.confidence), signals: sc.shown.map((s) => ({ text: T(s.text), weight: s.weight, rumor: s.rumor })), hidden: sc.hidden, rumors: sc.rumors, factions: factionLines(e.raw, L, true), ops: sc.available ? fsupViewFor(idx, e.raw.factions) : null, report: e.spy ?? null, amb: e.spyAmb ?? null, agent: ag0 ? { ...agentView(ag0, e.raw.date || ctx.gameDate || ''), canDip: o.available && !x?.active } : null },
    talk: (e.talk ?? []).slice(-TALK_MAX), due: isDue(sid, idx), canTalk: o.available && !x?.active,
    expel: x ? { active: x.active, date: x.date, back: x.back ?? '', why: T(WHY_TEXT[x.why]), amb: x.amb.name, cable: x.cable ?? null } : null,
    idx, name: e.raw.name, date: e.raw.date, intel: effRaw(e.raw).intel, intelName: T(INTEL_NAME[effRaw(e.raw).intel]), level: a.level, levelName: T(LEVEL_NAME[a.level]), threat: a.threat,
    confidence: T(a.confidence), signals: a.shown.map((s) => ({ text: T(s.text), weight: s.weight })), hidden: a.hidden,
    factions: factionLines(e.raw, L), report: e.report ?? null,
    warStance: (() => { const w = stanceOfEmpire(idx); return w ? { ...w, label: stanceLabel(w.stance) } : null; })(), // 우리 전쟁에 대한 이 나라의 공개 성명
  };
}
export function embassyView() {
  const sid = ctx.curSaveId, tv = terminalView(), mine = sid ? saveOf(sid) : {};
  const contacts = (tv.sid === sid ? tv.items : []).filter((c) => !c.talkOnly).map((c) => { const e = mine[String(c.idx)]; const a = e ? assessEmbassy(e.raw) : null; return { idx: c.idx, name: c.name, date: e?.raw.date ?? '', due: sid ? isDue(sid, c.idx) : false, mail: agentHasMail(c.name), level: a?.level ?? '', levelName: a ? T(LEVEL_NAME[a.level]) : '', threat: a?.threat ?? null, alert: e ? (() => { const ch = changesOf(e), mc = monChanges(sid!, c.idx, e); return ch.official.some((x) => x.worse) || ch.secret.some((x) => x.worse) || mc.official.some((x) => x.worse) || mc.secret.some((x) => x.worse); })() : (sid ? monChanges(sid, c.idx).official.some((x) => x.worse) : false) }; });
  return { sid, date: ctx.gameDate, running: ctx.gameRunning, contacts };
}

export function registerEmbassy(router: LogRouter): void {
  hoiHooks.intel = (idx) => { const sid = ctx.curSaveId; const e = sid ? saveOf(sid)[String(idx)] : undefined; return e ? { band: effRaw(e.raw).intel, date: e.raw.date } : null; }; // 파벌 공작의 첩보 수준
  agentHooks.dipLost = (idx, host, date) => expelAmbassador(idx, host, 'spy', date); // 외교관 위장 공작원 발각 → 대사 추방(2026-10-20)
  router.on(SLOT.EMBASSY, 'embassy', (m: SllmMessage) => {
    if (m.kind === 'EMBFAC') { const req = Number(m.kv.req), f = factionFromKv(m.kv); if (Number.isSafeInteger(req) && f) { const a = facBuf.get(req) ?? []; if (a.length < 20) a.push(f); facBuf.set(req, a); } return; }
    if (m.kind === 'EMBMON') { // 두 달 간격 감시 한 줄(초안): 지금 불러온 세이브에 기록
      const sid = ctx.curSaveId, r = embPointFromKv(m.kv); if (!sid || !r) return;
      const bySave = (monAll()[sid] ??= {}); bySave[String(r.idx)] = pushPoint(bySave[String(r.idx)], r.pt); monSave();
      // 대사 추방·재개(2026-10-20 알파 9): 대사관이 (어느 방향이든) 있는 나라가 전쟁 중이거나 호감 −100 이하 → 추방, 전쟁이 끝나고 호감 0 이상 → 재개
      const x = expelOf(sid, r.idx), host = String(m.kv.name || '').trim().slice(0, 100) || x?.host || '';
      if (x?.active) { if (canReturn(r.pt)) reopenEmbassy(sid, r.idx, x, r.pt.date); }
      else { const emb = m.kv.pe === '1' || m.kv.ce === '1', why = expelReason(r.pt, emb); if (why && host) expelAmbassador(r.idx, host, why, r.pt.date); else if (emb) markRegular(sid, r.idx, r.pt.date); } // 정기 공식 보고(해마다 한 번)
      return;
    }
    if (m.kind === 'EMBASSY') terminalReplies.get('EMBASSY:' + m.kv.req)?.(m);
  });
  ipcMain.handle('embassyState', async () => embassyView());
  /** 공작원을 외교관 위장(대사관 무관)으로 옮기거나 되돌린다(2026-10-20). 대사관이 있고 대사가 추방되지 않았을 때만. */
  ipcMain.handle('agentCover', async (_e, idxIn: unknown, on: unknown) => {
    const sid = ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined;
    if (!sid || !e) return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
    if (on === true && (!assessOfficial(e.raw).available || expelOf(sid, idx)?.active)) return { ok: false, error: L('그 나라에 우리 대사관이 있어야 외교관으로 위장시킬 수 있습니다.', 'We need an embassy there to give the agent diplomatic cover.') };
    if (!setAgentCover(e.raw.name, on === true)) return { ok: false, error: L('그 나라에 공작원이 없습니다.', 'We have no agent there.') };
    return { ok: true, detail: detail(sid, idx) };
  });
  ipcMain.handle('embassyDetail', async (_e, idx: unknown) => (ctx.curSaveId ? detail(ctx.curSaveId, Number(idx)) : null));
  /** 상주 대사와 대화(2026-10-20 알파 9): 상대 원수가 응하지 않아도 대사와는 이야기한다. 게임에는 아무것도 하지 않는다. */
  ipcMain.handle('embassyTalk', async (_e, idxIn: unknown, textIn: unknown) => {
    const sid = ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined, text = String(textIn ?? '').trim().slice(0, TALK_TEXT);
    if (!sid || !e) return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
    if (!text) return { ok: false, error: L('대사에게 할 말을 적어 주세요.', 'Write something to the ambassador.') };
    if (!assessOfficial(e.raw).available) return { ok: false, error: L('이 나라에는 대사관이 없어 대사가 없습니다.', 'We have no embassy there, so there is no ambassador.') };
    if (expelOf(sid, idx)?.active) return { ok: false, error: L('우리 대사가 추방되어 연락할 수 없습니다.', 'Our ambassador was expelled and cannot be reached.') };
    if (busy.has(-idx - 2000000)) return { ok: false, error: L('대사가 답하는 중입니다.', 'The ambassador is replying.') };
    busy.add(-idx - 2000000);
    try {
      if (!e.amb) { e.amb = newAmb(); save(); }
      await refreshFrontier([idx]).catch(() => {}); // 국경·영유권 등(2026-10-26)
      const reply = cleanTalkReply(await ctx.ai.chat(ambassadorTalkMessages(e.raw, ctx.playerName || 'the player empire', e.amb, e.talk ?? [], text, e.report, stanceOfEmpire(idx), frontierFactsUs(frontierFor(idx))), { purpose: 'embassy-talk', maxTokens: 700, conversationId: `embassy:${ctx.curSaveId}:${idx}` }));
      if (!reply) return { ok: false, error: L('대사의 답을 받지 못했습니다. 다시 보내 주세요.', 'No reply from the ambassador. Please send again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      (e.talk ??= []).push({ me: text, them: reply, date: ctx.gameDate || e.raw.date }); if (e.talk.length > TALK_MAX) e.talk.splice(0, e.talk.length - TALK_MAX); save();
      logDiagnostic('info', 'embassy.talk', { n: e.talk.length });
      return { ok: true, detail: detail(sid, idx) };
    } catch (err) { return { ok: false, error: (err as Error).message }; }
    finally { busy.delete(-idx - 2000000); }
  });
  /** 공작원 서신 열기(2026-10-20): 처음이면 AI 가 본문을 쓴다. */
  ipcMain.handle('agentLetterOpen', async (_e, idxIn: unknown, idIn: unknown) => {
    const sid = ctx.curSaveId, idx = Number(idxIn), r = await openAgentLetter(Number(idIn));
    return { ...r, ...(sid ? { detail: detail(sid, idx), state: embassyView() } : {}) };
  });
  ipcMain.handle('embassyContacts', async () => {
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 목록을 갱신할 수 있습니다.', 'The game must be running to refresh the list.') };
    const req = ++link.reqCounter;
    try { await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = ' + req + ' } }', 'CONTACT_END', req); return { ok: true, state: embassyView() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('embassyProbe', async (_e, idxIn: unknown) => {
    const sid = ctx.curSaveId, idx = Number(idxIn);
    if (!ctx.gameRunning || !sid) return { ok: false, error: L('게임이 켜져 있어야 대사관 보고를 받을 수 있습니다.', 'The game must be running to get an embassy report.') };
    const c = terminal.items.find((x) => x.idx === idx);
    if (terminal.sid !== sid || !c || !contactAllowed(c.type)) return { ok: false, error: L('현재 연락처에 없는 제국입니다. 목록을 갱신해 주세요.', 'This empire is not in the current contacts. Please refresh the list.') };
    if (busy.has(idx)) return { ok: false, error: L('이미 정보를 받는 중입니다.', 'Already receiving information.') };
    busy.add(idx); const req = ++link.reqCounter; facBuf.set(req, []);
    try {
      const m = await terminalRequest(embassyCommand(idx, req), 'EMBASSY', req);
      if (m.kv.sid !== ctx.curSaveId || sid !== ctx.curSaveId) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      const raw = embFromKv(m.kv, facBuf.get(req) ?? [], ctx.gameDate || '');
      if (!raw) return { ok: false, error: L('그 제국과 통신이 닿지 않아 정보를 받지 못했습니다.', 'No communications with that empire, so no information arrived.') };
      const pf = ctx.profiles.get(idx); if (pf) { raw.att = pf.att; raw.beh = pf.beh; raw.flags = { ...pf.flags }; }
      if (!raw.name) raw.name = c.name;
      const prev = saveOf(sid)[String(idx)];
      const base = prev && prev.raw.date !== raw.date ? prev.raw : prev?.prev; // 같은 날짜에 다시 받아도 비교 기준이 사라지지 않게
      saveOf(sid)[String(idx)] = { raw, ...(prev?.report ? { report: prev.report } : {}), ...(prev?.spy ? { spy: prev.spy } : {}), ...(base ? { prev: base } : {}), ...(prev?.amb ? { amb: prev.amb } : {}), ...(prev?.spyAmb ? { spyAmb: prev.spyAmb } : {}) }; save();
      logDiagnostic('info', 'embassy.probe', { idx, intel: raw.intel, spy: spyPowerOf(raw.name), factions: raw.factions.length, profile: !!pf });
      return { ok: true, detail: detail(sid, idx), state: embassyView() };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
    finally { busy.delete(idx); facBuf.delete(req); }
  });
  ipcMain.handle('embassyReport', async (_e, idxIn: unknown) => {
    const sid = ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined;
    if (!sid || !e) return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
    if (busy.has(-idx)) return { ok: false, error: L('대사가 보고서를 쓰는 중입니다.', 'The ambassador is writing the report.') };
    if (!assessOfficial(e.raw).available) return { ok: false, error: L('이 나라에는 대사관이 없어 대사의 전문을 받을 수 없습니다.', 'We have no embassy there, so there is no ambassador to write a cable.') };
    if (expelOf(sid, idx)?.active) return { ok: false, error: L('우리 대사가 추방되어 전문을 받을 수 없습니다. 관계가 회복되면 새 대사가 부임합니다.', 'Our ambassador was expelled, so there are no cables. A new ambassador will be posted once relations recover.') };
    busy.add(-idx);
    try {
      const a = assessEmbassy(e.raw);
      if (!e.amb) { const mi = Math.floor(Math.random() * MANNERS.length); e.amb = { name: gameName(Math.random() < 0.5 ? 'm' : 'f') || randomName(), manner: MANNERS[mi][1], mi }; save(); } // 대사: 우리 제국 종족 이름 표(AI 가 짓지 않음)
      await refreshFrontier([idx]).catch(() => {}); // 국경·영유권 등(2026-10-26)
      const raw = await ctx.ai.chat(embassyMessages(e.raw, a, ctx.playerName || 'the player empire', e.amb, e.prev, stanceOfEmpire(idx), frontierFactsUs(frontierFor(idx))), { purpose: 'embassy-report', json: true, maxTokens: 2400 });
      const rep = parseEmbassyReport(raw, e.raw.date);
      if (!rep) return { ok: false, error: L('대사의 보고서를 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the ambassador\'s report. Please try again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      e.report = rep; save();
      { const rg = regOf(sid); if (rg.due.includes(idx)) { rg.due = rg.due.filter((x) => x !== idx); regSave(); } } // 정기 보고를 받았다
      return { ok: true, detail: detail(sid, idx), state: embassyView() };
    } catch (err) { return { ok: false, error: (err as Error).message }; }
    finally { busy.delete(-idx); }
  });
  ipcMain.handle('embassySpyReport', async (_e, idxIn: unknown) => {
    const sid = ctx.curSaveId, idx = Number(idxIn), e = sid ? saveOf(sid)[String(idx)] : undefined;
    if (!sid || !e) return { ok: false, error: L('먼저 「최신 정보 받기」로 자료를 받아 주세요.', 'Get the latest information first.') };
    const sc = agentFor(e.raw.name)?.dip ? diplomaticBoost(assessSecret(effRaw(e.raw))) : assessSecret(effRaw(e.raw)); // 외교관 위장이면 소문이 확인된 정보로
    if (!sc.available) return { ok: false, error: L('첩보망이 그 나라에 닿지 않아 보고할 내용이 없습니다. 첩보망을 키워 주세요.', 'Our network does not reach that empire, so there is nothing to report. Grow your espionage network.') };
    if (busy.has(-idx - 1000000)) return { ok: false, error: L('첩보부장이 보고서를 쓰는 중입니다.', 'The spymaster is writing the briefing.') };
    busy.add(-idx - 1000000);
    try {
      await refreshFrontier([idx]).catch(() => {}); // 국경·영유권·명분·신뢰(2026-10-26)
      const raw = await ctx.ai.chat(spyReportMessages(effRaw(e.raw), sc, ctx.playerName || 'the player empire', e.spyAmb, (() => { const ag = agentFor(e.raw.name); return ag ? agentPromptLine(ag, e.raw.date || ctx.gameDate || '') : undefined; })(), frontierFactsUs(frontierFor(idx), { secret: true })), { purpose: 'spy-report', json: true, maxTokens: 2400 });
      const rep = parseEmbassyReport(raw, e.raw.date);
      if (!rep) return { ok: false, error: L('첩보 보고서를 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the briefing. Please try again.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      e.spy = rep; save(); // 공작원·첩보부장 이름은 AI 가 짓지 않는다(옛 기록의 spyAmb 는 그대로 둔다)
      try { noteSecretHook(idx, e.raw.name, sc.shown); } catch { /* 갈고리는 부가 기능 */ } // 확인된 비밀 → 거래 갈고리(2026-10-26 외교 거래)
      return { ok: true, detail: detail(sid, idx) };
    } catch (err) { return { ok: false, error: (err as Error).message }; }
    finally { busy.delete(-idx - 1000000); }
  });
}
