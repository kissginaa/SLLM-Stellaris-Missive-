// 은하 위기 특집 방송(앱 쪽, 2026-10-17). 순수 로직은 src/crisis.ts.
// 모드(sllm_crisis.1)가 매달 남기는 CRISIS/CRISIS_END 묶음으로 지금 은하에 있는 위기를 정하고,
// 라디오(radio-app)·신문(media)이 프롬프트와 지면 모양을 바꿀 수 있게 상태를 내준다. 창들에는 'crisisState' 로 알린다.
import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { SllmMessage } from '../protocol';
import { LogRouter, SLOT } from '../app/log-router';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import { playerGestalt } from './gestalt-app';
import { CrisisCollector, CrisisSave, applyCrisis, emptyCrisis, crisisBeginText, crisisEndText, crisisName, crisisNames, crisisRadioDirective, crisisFacts, crisisTalkLine, crisisNewsDirective, markCrisisIssue, crisisSpecialFact, hostileCrisis } from '../crisis';
import { chronNoteWorld } from './chronicle-app';
import { crisisSignal } from '../crisis-signals'; // 가로챈 위기 신호(알파 11)
import { L } from '../i18n-pick';
import { pick, selectedBase } from './settings-ui';
import type { ChatMessage } from '../player2';

let data: Record<string, CrisisSave> | null = null;
/** 호외 예약(media.noteExtra)·위기 특별판 발행(media.publishCrisisSpecial). 가져오기 고리를 만들지 않으려고 media 가 시작할 때 넣어 준다. */
let noteExtra: (kind: string, date: string, text: string) => void = () => {};
let publishSpecial: (date: string, fact: string, label: { ko: string; en: string }) => Promise<void> = async () => {};
export function setCrisisExtra(fn: (kind: string, date: string, text: string) => void): void { noteExtra = fn; }
/** 은하 위기 극복 기록 발행(국가 문서함, 알파 11). 가져오기 고리를 피하려고 main.ts 가 넣어 준다. */
let issueCrisisDoc: (kind: string, since: string, ended: string) => void = () => {};
let onCalm: () => void = () => {};
/** 은하를 적대하는 위기가 모두 끝났을 때(공동 대응 협약 끝내기, 알파 11). 극복 기록을 낸 다음에 부른다. */
export function setCrisisCalm(fn: () => void): void { onCalm = fn; }
export function setCrisisDoc(fn: (kind: string, since: string, ended: string) => void): void { issueCrisisDoc = fn; }
/** 위기 특별판을 따로 낸다(몰락제국 각성, 알파 11). */
export const crisisSpecialEdition = (date: string, fact: string, label: { ko: string; en: string }): Promise<void> => publishSpecial(date, fact, label);
export function setCrisisSpecial(fn: (date: string, fact: string, label: { ko: string; en: string }) => Promise<void>): void { publishSpecial = fn; }
const file = () => path.join(app.getPath('userData'), 'sllm_crisis.json');
function all(): Record<string, CrisisSave> {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'crisis', error: e }); data = {}; }
  return data!;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'crisis', error: e }); } }
const cur = (): CrisisSave => { const sid = ctx.curSaveId; if (!sid) return emptyCrisis(); const d = all(); const s = (d[sid] ??= emptyCrisis()); s.issues ??= []; s.since ??= {}; s.ended ??= {}; s.active ??= []; return s; };

/** 화면에 보낼 상태(창은 이 값으로 특별 테마를 켜고 끈다). */
export function crisisView() {
  const s = cur();
  return { active: s.active.length > 0, kinds: s.active.slice(), names: crisisNames(s.active, 'ko'), namesEn: crisisNames(s.active, 'en'), since: { ...s.since }, issues: s.issues.slice(), labels: { ...(s.labels ?? {}) }, hostile: hostileCrisis(s) };
}
const broadcast = () => { const v = crisisView(); for (const w of BrowserWindow.getAllWindows()) safeSend(w, 'crisisState', v); };

/** 라디오(radio-app)용: 위기 동안 덧붙일 지시와, 새 사건이 없을 때 쓸 위기 특보 사실. */
/** 외교 대화용 한 줄(알파 11). */
export const crisisTalk = (): string => crisisTalkLine(cur());
/** 하늘의 전쟁 진행 중(알파 11): 각성한 몰락제국의 말투에 쓴다. */
export const crisisWih = (): boolean => cur().active.includes('wih');
export const crisisRadio = (): { directive: string | null; facts: string[] } => { const s = cur(); return { directive: crisisRadioDirective(s), facts: crisisFacts(s, ctx.gameDate) }; };
/** 신문(media)용: 위기 동안 프롬프트 앞에 특별판 지시를 끼운다(없으면 그대로). */
export function crisisNewsWrap(messages: ChatMessage[]): ChatMessage[] { const d = crisisNewsDirective(cur()); return d ? [messages[0], { role: 'system', content: d }, ...messages.slice(1)] : messages; }
/** 신문(media)용: 위기 특별판 호를 표시(이 호만 특별판 지면). */
export function crisisMarkIssue(id: number, label: { ko: string; en: string }): void { const s = cur(); markCrisisIssue(s, id, label); save(); broadcast(); }
/** 신문(media)용: 이 호가 위기 특별판인가(호외 연 상한 계산에서 뺀다). */
export const crisisIsSpecial = (id: number): boolean => cur().issues.includes(id);

const collector = new CrisisCollector();
const mach = (): boolean => playerGestalt() === 'machine'; // 기계 지성 플레이어용 신호(알파 11)
export function onCrisisBatch(kinds: string[], date: string, cetanaWar = false): void {
  if (!ctx.curSaveId) return;
  const s = cur(); const wasHostile = hostileCrisis(s); const { began, ended } = applyCrisis(s, kinds, date || ctx.gameDate);
  if (!!s.cetanaWar !== cetanaWar) { if (cetanaWar) s.cetanaWar = true; else delete s.cetanaWar; save(); }
  // 가로챈 위기 신호(알파 11): 해가 바뀌면 진행 중인 위기마다 한 줄(나타난 해에는 begin 줄만)
  const yr = Number(/^(\d+)\./.exec(date || ctx.gameDate || '')?.[1] ?? NaN);
  if (Number.isFinite(yr)) for (const k of s.active) if (!began.includes(k) && (s.signal ??= {})[k] !== undefined && s.signal[k] < yr) { s.signal[k] = yr; const t = crisisSignal(k, 'year', date || ctx.gameDate, undefined, mach()); if (t) { chronNoteWorld((date ? date + ' ' : '') + L('가로챈 신호 — ', 'Intercepted signal — ') + t, false); } save(); }
  if (!began.length && !ended.length) return;
  for (const k of began) if (Number.isFinite(yr)) (s.signal ??= {})[k] = yr;
  save();
  for (const k of began) {
    const t = crisisBeginText(k); chronNoteWorld(t, false);
    { const sg = crisisSignal(k, 'begin', date || ctx.gameDate, undefined, mach()); if (sg) chronNoteWorld((date ? date + ' ' : '') + L('가로챈 신호 — ', 'Intercepted signal — ') + sg, false); } // 가로챈 위기 신호(알파 11)
    const nm = crisisName(k, selectedBase()); ctx.notify({ kind: 'news', title: pick('⚠ 은하 위기 · 긴급 특별 방송', '⚠ Galactic crisis · Emergency broadcast'), body: `"${nm}" — ` + pick('신문과 라디오가 특별 편성으로 바뀝니다.', 'newspapers and radio switch to special programming.') });
  }
  if (began.length) void publishSpecial(date || ctx.gameDate, crisisSpecialFact(began, date || ctx.gameDate) + began.map((k) => { const sg = crisisSignal(k, 'begin', date || ctx.gameDate, 'en', mach()); return sg ? ` Intercepted signal: ${sg}` : ''; }).join(''), { ko: crisisNames(began, 'ko'), en: crisisNames(began, 'en') }); // 위기 특별판은 이때 한 번만(정기호·일반 호외는 평소 지면)
  for (const k of ended) { const t = crisisEndText(k); chronNoteWorld(t, false); const sg = crisisSignal(k, 'end', date || ctx.gameDate, undefined, mach()); if (sg) chronNoteWorld((date ? date + ' ' : '') + L('가로챈 신호 — ', 'Intercepted signal — ') + sg, false); if (!s.active.length) noteExtra('war_end', date || ctx.gameDate, t + (sg ? ' ' + sg : '')); if (s.since[k]) try { issueCrisisDoc(k, s.since[k], s.ended[k] || date || ctx.gameDate); } catch (e) { logDiagnostic('warn', 'crisis.doc_failed', { error: String(e) }); } if (s.signal) delete s.signal[k]; } // 극복 기록(국가 문서함)·마지막 신호(알파 11)
  logDiagnostic('info', 'crisis.changed', { began, ended, active: s.active });
  if (wasHostile && !hostileCrisis(s)) try { onCalm(); } catch (e) { logDiagnostic('warn', 'crisis.calm_failed', { error: String(e) }); } // 공동 대응 협약 끝(알파 11)
  broadcast();
}

export function registerCrisis(router: LogRouter): void {
  router.on(SLOT.CRISIS, 'crisis:scan', (m: SllmMessage) => {
    if (m.kind !== 'CRISIS' && m.kind !== 'CRISIS_END') return;
    const r = collector.feed(m.kind, m.kv); if (r) onCrisisBatch(r.kinds, r.date, r.cetanaWar === true);
  });
  ipcMain.handle('crisisState', async () => crisisView());
}
export const _crisisTest = { reset: () => { data = {}; } };
