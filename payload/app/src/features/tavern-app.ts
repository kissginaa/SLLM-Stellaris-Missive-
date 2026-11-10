// 뒷골목 선술집 창(2026-10-30, 변장 잠행). 규칙·자료·프롬프트: src/tavern.ts · 화면: ui/tavern.html · 입구: 외출 지도 → 뒷골목 선술집(혼자만).
// LLM: 들어갈 때 엿듣기 한 번(네 테이블 한꺼번에, 같은 날·같은 상황이면 저장해 둔 것을 다시 씀) + 합석해서 말할 때마다 한 번. 꺼져 있거나 실패하면 틀 문장(합석은 안내 문구).
// 정체 탄로 = 기록만(연대기 한 줄 + 저장, 게임·민심 효과 없음). 그날은 다시 못 들어감. 게임 명령 없음.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import { selectedLanguage } from './settings-ui';
import { gameState } from './gamestate-app';
import { moodView, moodPromptNow } from './mood-app';
import { chron, chronNote } from './chronicle-app';
import { paparazziSnap } from './paparazzi-app'; // 파파라치(2026-10-31)
import { peopleOf } from './people-app';
import { personaJson } from './persona-app';
import { vaultBalance, spendFromVault } from './vault-app';
import { DISGUISES, TABLES, SUS, BARTENDER, BAR_LINES, disguiseOf, tableOf, talkSuspicion, clampSus, bandOf, fallbackOverheard, overhearMessages, cleanOverheard, talkMessages, type DisguiseId, type TableKey } from '../tavern';

type Heard = Record<TableKey, { lines: string[]; deep: string[] }>;
interface TavSave { visits: number; exposures: Array<{ date: string; disguise: string }>; cache?: { key: string; heard: Heard; llm: boolean } }
const file = () => path.join(app.getPath('userData'), 'sllm_tavern.json');
let data: { saves: Record<string, TavSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'tavern', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'tavern', error: e }); } }
const saveOf = (sid: string): TavSave => { const s = (all().saves[sid] ??= { visits: 0, exposures: [] }); s.exposures ??= []; s.visits ??= 0; return s; };
/** 정체가 드러난 기록(나중에 파파라치가 읽음). */
export const tavernExposures = (sid: string) => saveOf(sid).exposures.slice();

interface Visit { disguise: DisguiseId; sus: number; rounds: TableKey[]; heard: Heard | null; llm: boolean; loading: boolean; listened: TableKey[]; seat: TableKey | null; chat: Array<{ who: 'me' | 'them' | 'sys'; text: string }>; asking: boolean; exposed: boolean; date: string }
let win: BrowserWindow | null = null, v: Visit | null = null;
const artSeen = new Map<string, boolean>();
const art1 = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
const art = (base: string): string | null => art1(`${base}.webp`) ?? art1(`${base}.png`);
const isKo = () => selectedLanguage() === 'ko'; // i18n-data: LLM이 쓸 엿듣기·대화 언어 고르기(자료)
const fill = (t: string, x: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_m, k) => x[k] ?? '');
const bar = (k: keyof typeof BAR_LINES, x: Record<string, string> = {}) => fill(L(...BAR_LINES[k]), x);
const bannedToday = (sid: string) => { const d = ctx.gameDate || ''; return !!d && saveOf(sid).exposures.some((e) => e.date === d); };

function situation() {
  const sid = ctx.curSaveId || '', snap = gameState.last, wars = (snap?.wars ?? []).map((w) => `${w.name}${w.side === 'att' ? ' (we attack)' : ' (we defend)'}`).slice(0, 4);
  let recent: string[] = [];
  try { recent = chron().groups(sid).filter((g) => g.idx < 9000 || g.idx === 9999).flatMap((g) => g.items).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5).map((e) => `${e.date} ${String(e.text).slice(0, 140)}`); } catch { recent = []; }
  const ruler = peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? '';
  return { date: ctx.gameDate || '', mood: moodPromptNow(), level: moodView().level, wars, recent, empire: ctx.playerName || '', ruler };
}
/** 바텐더의 소문 한 줄: 가장 최근 연대기 소식(없으면 틀 문장). */
const rumorOf = (): string => { const r = situation().recent[0]; return r ? L(`"요즘 골목에 도는 얘기? ${r.replace(/^\S+\s/, '')}"`, `"What's going round the alleys? ${r.replace(/^\S+\s/, '')}"`) : bar('noRumor'); };
const cacheKey = (s: ReturnType<typeof situation>) => `${s.date}|${s.level ?? ''}|${s.wars.length}`;

export function tavernView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const vv = v;
  return {
    sid, ready: true, vault: vaultBalance(sid), banned: bannedToday(sid) && !vv?.exposed, exposures: saveOf(sid).exposures.length,
    art: { bg: art('tavern/bg'), bartender: art('tavern/bartender'), barman: art('tavern/bartender_cut'), tables: Object.fromEntries(TABLES.map((t) => [t.key, art(`tavern/tables/${t.key}`)])), disguise: Object.fromEntries(DISGUISES.map((d) => [d.id, art(`tavern/disguise/${d.id}`)])) },
    disguises: DISGUISES.map((d) => ({ id: d.id, name: L(d.ko, d.en), about: L(d.aboutKo, d.aboutEn), fits: d.fits })),
    tables: TABLES.map((t) => ({ key: t.key, name: L(t.ko, t.en), who: L(t.whoKo, t.whoEn), round: !!vv?.rounds.includes(t.key), listened: !!vv?.listened.includes(t.key), fits: !!vv && disguiseOf(vv.disguise)!.fits === t.key })),
    bartender: { name: L(BARTENDER.ko, BARTENDER.en), greet: vv ? bar('greet', { who: L(disguiseOf(vv.disguise)!.ko, disguiseOf(vv.disguise)!.en) }) : '' },
    sus: { now: vv?.sus ?? 0, max: SUS.max }, roundCost: SUS.roundCost,
    visit: vv ? { disguise: vv.disguise, disguiseName: L(disguiseOf(vv.disguise)!.ko, disguiseOf(vv.disguise)!.en), loading: vv.loading, llm: vv.llm, seat: vv.seat, seatName: vv.seat ? L(tableOf(vv.seat)!.ko, tableOf(vv.seat)!.en) : '', chat: vv.chat.slice(-30), asking: vv.asking, exposed: vv.exposed, exposedText: vv.exposed ? bar('exposed') : '',
      heard: vv.heard ? Object.fromEntries(TABLES.map((t) => [t.key, vv.listened.includes(t.key) ? { lines: vv.heard![t.key].lines, deep: vv.rounds.includes(t.key) ? vv.heard![t.key].deep : [] } : null])) : null,
      rumor: rumorOf() } : null,
    lines: { banned: bar('banned'), leave: bar('leave') },
  };
}
const push = () => safeSend(win, 'tavernState', tavernView());

export function openTavern(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 갈 수 있습니다.', 'Load a save first.') };
  artSeen.clear(); if (v && (v.exposed || v.date !== (ctx.gameDate || ''))) v = null;
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#07060c', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'tavern.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

/** 엿듣기 준비: 같은 날·같은 상황이면 저장본, 아니면 LLM 한 번(실패하면 틀 문장). */
async function loadHeard(sid: string): Promise<void> {
  if (!v) return; const s = situation(), key = cacheKey(s), sv = saveOf(sid);
  if (sv.cache && sv.cache.key === key) { v.heard = sv.cache.heard; v.llm = sv.cache.llm; v.loading = false; push(); return; }
  let heard: Heard | null = null;
  try { const j = await personaJson(overhearMessages({ ...s, ko: isKo() }), 2400, 'tables'); heard = cleanOverheard(j); } catch (e) { logDiagnostic('warn', 'tavern.overhear_failed', { error: e }); }
  const llm = !!heard;
  if (!heard) { const fb = fallbackOverheard(bandOf(s.level), s.wars.length > 0); heard = Object.fromEntries(TABLES.map((t) => [t.key, { lines: fb[t.key].lines.map((p) => L(p[0], p[1])), deep: fb[t.key].deep.map((p) => L(p[0], p[1])) }])) as Heard; }
  sv.cache = { key, heard, llm }; save();
  if (v) { v.heard = heard; v.llm = llm; v.loading = false; } push();
}
function expose(sid: string): void {
  if (!v || v.exposed) return; v.exposed = true; v.seat = null; const d = ctx.gameDate || '';
  paparazziSnap('tavern'); // 변장이 들키면 늘 찍힘
  saveOf(sid).exposures.push({ date: d, disguise: v.disguise }); saveOf(sid).exposures = saveOf(sid).exposures.slice(-50); save();
  try { if (ctx.playerIdx) chronNote(ctx.playerIdx, L(`${d} 통치자가 변장하고 뒷골목 선술집에 갔다가 정체가 드러났다`, `${d} The ruler visited a back-alley bar in disguise and was recognised`)); } catch { /* 기록 실패는 무시 */ }
}
const addSus = (sid: string, n: number) => { if (!v) return; v.sus = clampSus(v.sus + n); if (v.sus >= SUS.max) expose(sid); };

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: tavernView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: tavernView() });
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };
const inside = () => { if (!v) throw new Error(L('먼저 변장을 고르세요.', 'Choose a disguise first.')); if (v.exposed) throw new Error(L('정체가 드러났습니다. 궁으로 돌아가세요.', 'You have been recognised. Head back to the palace.')); return v; };

export function registerTavern(): void {
  ipcMain.handle('tavernOpen', () => openTavern());
  ipcMain.handle('tavernState', () => tavernView());
  ipcMain.handle('tavernClose', () => { if (v && !v.asking) { if (v.exposed) v = null; } if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  /** 변장 고르고 들어가기 → 엿듣기 준비(LLM 한 번). */
  ipcMain.handle('tavernEnter', (_e, id: unknown) => {
    try { const sid = need(), d = disguiseOf(String(id)); if (!d) throw new Error(L('그런 변장이 없습니다.', 'No such disguise.')); if (bannedToday(sid)) throw new Error(bar('banned'));
      v = { disguise: d.id, sus: 0, rounds: [], heard: null, llm: false, loading: true, listened: [], seat: null, chat: [], asking: false, exposed: false, date: ctx.gameDate || '' };
      saveOf(sid).visits++; save(); void loadHeard(sid); return ok();
    } catch (e) { return err(e); }
  });
  ipcMain.handle('tavernListen', (_e, key: unknown) => {
    try { const sid = need(), vv = inside(), t = tableOf(String(key)); if (!t) throw new Error(L('그런 테이블이 없습니다.', 'No such table.')); if (!vv.listened.includes(t.key)) { vv.listened.push(t.key); addSus(sid, SUS.listen); } push(); return ok(); } catch (e) { return err(e); }
  });
  /** 한 잔 돌리기: 금고에서 조금 → 속 이야기 + 의심 내림. 테이블마다 한 번. */
  ipcMain.handle('tavernRound', (_e, key: unknown) => {
    try { const sid = need(), vv = inside(), t = tableOf(String(key)); if (!t) throw new Error(L('그런 테이블이 없습니다.', 'No such table.')); if (vv.rounds.includes(t.key)) throw new Error(L('그 테이블엔 이미 돌렸습니다.', 'You already bought that table a round.'));
      if (!spendFromVault(sid, SUS.roundCost, 'tavern: round')) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${SUS.roundCost}).`, `Not enough credits in the vault (need ${SUS.roundCost}).`));
      vv.rounds.push(t.key); if (!vv.listened.includes(t.key)) vv.listened.push(t.key); vv.sus = clampSus(vv.sus + SUS.round); push(); return ok({ msg: bar('round', { table: L(t.ko, t.en) }) });
    } catch (e) { return err(e); }
  });
  ipcMain.handle('tavernSit', (_e, key: unknown) => {
    try { const vv = inside(), t = key == null || key === '' ? null : tableOf(String(key)); if (vv.asking) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for a reply.')); vv.seat = t ? t.key : null; vv.chat = t ? [{ who: 'sys', text: L(`${t.ko}에 슬쩍 합석했습니다. (${t.whoKo})`, `You slide into a seat at the ${t.en}. (${t.whoEn})`) }] : []; push(); return ok(); } catch (e) { return err(e); }
  });
  /** 합석 대화: 물을 때만 LLM 한 번. 답과 함께 수상함(0~3)을 받아 의심에 더함. */
  ipcMain.handle('tavernSay', async (_e, text: unknown) => {
    const sid = ctx.curSaveId, t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
    try { if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); const vv = inside(); if (!vv.seat) throw new Error(L('먼저 테이블에 합석하세요.', 'Sit at a table first.')); if (!t) throw new Error(L('할 말을 입력하세요.', 'Type something to say.')); if (vv.asking) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for a reply.'));
      const seat = vv.seat, prior = vv.chat.filter((c) => c.who !== 'sys') as Array<{ who: 'me' | 'them'; text: string }>; vv.asking = true; vv.chat.push({ who: 'me', text: t }); push();
      const s = situation(); let j: Record<string, unknown> | null = null;
      try { j = await personaJson(talkMessages({ table: seat, disguise: vv.disguise, heard: vv.heard?.[seat]?.lines ?? [], lines: prior, text: t, mood: s.mood, wars: s.wars, ko: isKo() }), 900, 'reply'); } catch (e) { logDiagnostic('warn', 'tavern.talk_failed', { error: e }); }
      vv.asking = false;
      if (!j) { vv.chat.pop(); push(); throw new Error(L('대답을 받지 못했습니다(AI 연결을 확인하세요).', 'No reply (check the AI connection).')); }
      vv.chat.push({ who: 'them', text: String(j.reply ?? '').trim().slice(0, 600) }); addSus(sid, talkSuspicion(vv.disguise, seat, Number(j.suspicion) || 0)); push(); return ok();
    } catch (e) { if (v) v.asking = false; return err(e); }
  });
}
export const _tavernTest = { tavernView, saveOf, situation, visit: () => v };
