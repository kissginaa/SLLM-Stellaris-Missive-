// 감정 기억 4종 연결(알파 11, 2026-10-25). 규칙: src/emotions.ts. 화면: ui/terminal-ui.js(연락처 줄의 감정 표시).
// 통신 목록(CONTACT_END)이 오면 게임 날짜로 3달에 한 번만 쌓는다(사용자가 목록을 여러 번 갱신해도 한 번).
// 감정이 처음 「강함」(40)을 넘으면 그 제국이 먼저 편지를 보낸다 — 기존 서신 기능(설정에서 켰을 때만, 편지 1통 = AI 1번).
// 실제 게임 행동(2026-10-25 사용자 결정 「다 넣어」): 같은 3달마다 위협·포위 심리·강대국 경계·원조·도움 요청·선전포고(설정) — src/emotion-acts.ts.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { settings } from '../app/settings';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { dayNo } from '../gamedate';
import { terminal } from './terminal';
import { mail } from './mail-app';
import type { SllmMessage } from '../protocol';
import { link, enqueue, sendConsole } from '../app/game-link';
import { chronNote } from './chronicle-app';
import { L } from '../i18n-pick';
import { crisisView } from './crisis-app';
import { pactWith, betrayed } from './crisis-pact-app';
import { actCommands, quarterOf, HELP_WHY, type ActInput } from '../emotion-acts';
import { type EmotionEntry, type Emotions, EMO_CRISIS, bump, zero, quarterTick, talkOutcome, newlyHot, emotionLetterWhy, sanitizeEmotions } from '../emotions';

interface SaveEmo { lastTick?: string; items: Record<string, EmotionEntry> }
const file = () => path.join(app.getPath('userData'), 'sllm_emotions.json');
let store: Record<string, SaveEmo> | null = null;
function all(): Record<string, SaveEmo> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, any>)) store[k] = { ...(typeof v?.lastTick === 'string' ? { lastTick: v.lastTick.slice(0, 12) } : {}), items: sanitizeEmotions(v?.items) }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'emotions', error: e }); }
  return store;
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void { if (saveTimer) return; saveTimer = setTimeout(() => { saveTimer = null; try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'emotions', error: e }); } }, 1500); }
const saveOf = (sid: string): SaveEmo => (all()[safeKey(sid)] ??= { items: {} });
const entryOf = (s: SaveEmo, idx: number): EmotionEntry => (s.items[String(idx)] ??= { e: zero(), hot: {} });

/** 대화 프롬프트용: 지금 세이브에서 그 제국의 감정(없으면 undefined). */
/** 지금 「강함」(hot)인 감정들(단일 의식 보고서, 알파 11). */
export function hotEmotions(): { idx: number; key: 'grudge' | 'gratitude' | 'fear' | 'ambition' }[] { const sid = ctx.curSaveId; if (!sid) return []; const out: { idx: number; key: 'grudge' | 'gratitude' | 'fear' | 'ambition' }[] = []; for (const [k, v] of Object.entries(all()[safeKey(sid)]?.items ?? {})) for (const h of ['grudge', 'gratitude', 'fear', 'ambition'] as const) if (v.hot[h]) out.push({ idx: Number(k), key: h }); return out; }
export function emotionsFor(idx: number): Emotions | undefined { const sid = ctx.curSaveId; if (!sid || !(idx > 0)) return undefined; return all()[safeKey(sid)]?.items[String(idx)]?.e; }
/** 대화에서 호감이 움직였을 때(chat.ts). 1·2 따뜻 3·4 차갑. */
export function noteTalkMood(idx: number, mood: number): void { const sid = ctx.curSaveId; if (!sid || !(idx > 0) || !(mood >= 1 && mood <= 4)) return; const s = saveOf(sid); talkOutcome(entryOf(s, idx), mood); checkHot(s, idx); save(); }

function checkHot(s: SaveEmo, idx: number): void {
  const en = s.items[String(idx)]; if (!en) return;
  for (const k of newlyHot(en)) {
    logDiagnostic('info', 'emotion.hot', { idx, kind: k, value: en.e[k] });
    if (settings.mailEnabled) { const mon = Number(/^\d+\.(\d+)\./.exec(ctx.gameDate || '')?.[1] ?? 1); mail.plan.add({ idx, why: emotionLetterWhy(k, (ctx.profiles.get(idx) as { gest?: number } | undefined)?.gest), month: mon }); }
  }
}
function onContacts(): void {
  const sid = ctx.curSaveId, date = ctx.gameDate || terminal.date; if (!sid || terminal.sid !== sid || !date) return;
  const s = saveOf(sid), now = dayNo(date), last = s.lastTick ? dayNo(s.lastTick) : null;
  // 공동 대응 협약 배신(알파 11): 통신 목록마다 확인 — 협약 상대와 전쟁 중이면 협약을 깨고 원한 +40(한 번)
  for (const c of terminal.all) if (c.em?.war && pactWith(c.idx) && betrayed(c.idx)) { bump(entryOf(s, c.idx), 'grudge', EMO_CRISIS.pactBetray); checkHot(s, c.idx); save(); }
  if (now === null || (last !== null && now - last < 85 && now >= last)) return; // 3달(≈90일)에 한 번. 되감은 세이브(now < last)면 다시 기준을 잡는다
  const acts: ActInput[] = [], crisisOn = crisisView().hostile; // 세타나는 전쟁 뒤에만
  for (const c of terminal.all) { if (c.type !== 'default' || !c.em) continue; const en = entryOf(s, c.idx), pact = pactWith(c.idx); quarterTick(en, { ...c.em, pact }, crisisOn); checkHot(s, c.idx); acts.push({ idx: c.idx, e: { ...en.e }, pw: c.em.pw, ...(pact ? { noWar: true } : {}) }); }
  if (!acts.length) return; // 옛 모드(war·rv·pw 없음)면 아무것도 하지 않는다
  s.lastTick = date; save();
  sendActs(acts, quarterOf(now));
}
/** 감정 → 실제 게임 행동. 게임 쪽이 분기 번호로 중복을 막으므로 실패해도 다시 보내지 않는다(다음 분기에 다시). */
/** 개발자 도구 「AI 제국 실제 상태」(2026-10-29): 마지막 분기 계산·마지막으로 보낸 행동 명령. */
let lastActs: { date: string; n: number; cmds: number } | null = null;
export const emotionsDebug = () => { const sid = ctx.curSaveId; return { lastTick: sid ? all()[safeKey(sid)]?.lastTick ?? '' : '', lastActs }; };
function sendActs(acts: ActInput[], q: number): void {
  if (!link.sessionReady) return;
  const cmds = actCommands(acts, q, { war: settings.emotionWar === true });
  for (const cmd of cmds) void enqueue(() => sendConsole(cmd)).catch((e) => logDiagnostic('warn', 'emotion.acts_failed', { error: String(e) }));
  logDiagnostic('info', 'emotion.acts_sent', { n: acts.length, cmds: cmds.length, q }); lastActs = { date: ctx.gameDate || '', n: acts.length, cmds: cmds.length };
}
const nameOf = (idx: number) => terminal.all.find((c) => c.idx === idx)?.name || '#' + idx;
/** 게임이 알려 준 실제 행동(SLLM:EMOACT). */
function onAct(m: SllmMessage): void {
  const idx = Number(m.kv.idx), act = m.kv.act, name = nameOf(idx), date = ctx.gameDate || '';
  if (!(idx > 0)) return;
  logDiagnostic('info', 'emotion.act', { idx, act, kind: m.kv.kind, war: m.kv.war });
  if (act === 'aid') {
    const t = L(`${name}이(가) 감사의 뜻으로 원조 협정을 맺었습니다. 앞으로 5년 동안 매달 에너지 크레딧 25와 광물 25를 보내옵니다.`, `${name} has signed an aid agreement out of gratitude: 25 energy credits and 25 minerals every month for five years.`);
    ctx.notify({ kind: 'info', title: L('원조 도착', 'Aid received'), body: t }); chronNote(idx, (date ? date + ' ' : '') + t);
  } else if (act === 'help') {
    const t = L(`${name}이(가) 다른 제국과 전쟁 중이라며 우리에게 도움을 청합니다.`, `${name} is at war with another empire and asks us for help.`);
    ctx.notify({ kind: 'info', title: L('도움 요청', 'Request for help'), body: t }); chronNote(idx, (date ? date + ' ' : '') + t, true);
    if (settings.mailEnabled) { const mon = Number(/^\d+\.(\d+)\./.exec(date)?.[1] ?? 1); mail.plan.add({ idx, why: HELP_WHY, month: mon }); }
  } else if (act === 'war') {
    if (m.kv.war !== '1') return; // 게임이 선전포고를 거절함
    const t = m.kv.kind === '1'
      ? L(`${name}이(가) 쌓인 원한을 참지 못하고 우리에게 선전포고했습니다.`, `${name}, unable to contain its grudge any longer, has declared war on us.`)
      : L(`${name}이(가) 우리가 다른 전쟁에 묶인 틈을 노려 선전포고했습니다.`, `${name} has seized the moment while we are tied up in another war and declared war on us.`);
    ctx.notify({ kind: 'news', title: L('선전포고', 'War declared'), body: t }); chronNote(idx, (date ? date + ' ' : '') + t);
  }
}
export function registerEmotions(router: LogRouter): void {
  router.on(SLOT.EMOTIONS, 'emotions', (m: SllmMessage) => { if (m.kind === 'EMOACT') { try { onAct(m); } catch (e) { logDiagnostic('warn', 'emotion.act_failed', { error: String(e) }); } return; } if (m.kind === 'CONTACT_END') { try { onContacts(); } catch (e) { logDiagnostic('warn', 'emotion.tick_failed', { error: String(e) }); } } });
  ipcMain.handle('emotionsState', () => { const sid = ctx.curSaveId; const items = sid ? all()[safeKey(sid)]?.items ?? {} : {}; return Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.e])); });
}
