// 성향별 특별한 곳(랜드마크) 창(2026-10-30). 자료·규칙·프롬프트: src/landmark.ts · 화면: ui/landmark.html · 입구: 외출 지도 → 특별한 곳(openLandmark, 성향·동행을 넘겨받음).
// 의식(AI 없음) · 인물과 대화(물을 때만 AI) · 공개 연설(AI 한 번: 군중 반응 + 점수). 민심은 의식·연설 각각 해마다 한 번만 잠깐 움직임(moodNudge, 1년에 걸쳐 사라짐). 게임 명령 없음.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import type { Companion } from '../outing';
import { SPECIAL_PLACES } from '../outing';
import { selectedLanguage } from './settings-ui';
import { gameState } from './gamestate-app';
import { moodPromptNow, moodNudge } from './mood-app';
import { paparazziSnap } from './paparazzi-app'; // 파파라치(2026-10-31)
import { speechKind } from '../paparazzi';
import { chronNote } from './chronicle-app';
import { peopleOf } from './people-app';
import { personaJson } from './persona-app';
import { LANDMARKS, SPEECH, SCORE_WORD, isEthicKey, clampScore, yearOf, figureMessages, addressMessages, type EthicKey } from '../landmark';

interface LmSave { done: Record<string, { ritual?: number; address?: number }>; speeches: Array<{ date: string; key: string; score: number; text: string; reaction: string }> }
const file = () => path.join(app.getPath('userData'), 'sllm_landmark.json');
let data: { saves: Record<string, LmSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'landmark', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'landmark', error: e }); } }
const saveOf = (sid: string): LmSave => { const s = (all().saves[sid] ??= { done: {}, speeches: [] }); s.done ??= {}; s.speeches ??= []; return s; };

let win: BrowserWindow | null = null, key: EthicKey = 'spiritualist', comp: Companion = { kind: 'alone', key: '', name: '' };
let chat: Array<{ who: 'me' | 'them' | 'sys'; text: string }> = [], asking = false, speaking = false, lastSpeech: { text: string; reaction: string; score: number; counted: boolean } | null = null, ritualText = '';
const artSeen = new Map<string, boolean>();
const art1 = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
const art = (base: string): string | null => art1(`${base}.webp`) ?? art1(`${base}.png`);
const isKo = () => selectedLanguage() === 'ko'; // i18n-data: LLM이 쓸 대화·군중 반응 언어 고르기(자료)
const place = () => { const sp = SPECIAL_PLACES[key]; return sp ? L(sp.ko, sp.en) : ''; };
const placeEn = () => SPECIAL_PLACES[key]?.en ?? '';
function situation() {
  const sid = ctx.curSaveId || '', wars = (gameState.last?.wars ?? []).map((w) => `${w.name}${w.side === 'att' ? ' (we attack)' : ' (we defend)'}`).slice(0, 4);
  return { mood: moodPromptNow(), wars, ruler: peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? '', empire: ctx.playerName || '' };
}

export function landmarkView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const lm = LANDMARKS[key], d = saveOf(sid).done[key] ?? {}, y = yearOf(ctx.gameDate || '');
  return {
    sid, ready: true, key, place: place(), color: lm.color, color2: lm.color2, comp,
    art: { bg: art(`assets/outing/${key}-landmark`), figure: art(`landmark/figures/${key}`) },
    ritual: { name: L(lm.ritual.ko, lm.ritual.en), counted: d.ritual === y, text: ritualText },
    figure: { name: L(lm.figure.ko, lm.figure.en), greet: L(lm.figure.greetKo, lm.figure.greetEn) },
    address: { name: L(lm.address.ko, lm.address.en), prompt: L(lm.address.promptKo, lm.address.promptEn), counted: d.address === y, last: lastSpeech ? { ...lastSpeech, word: L(...SCORE_WORD[String(lastSpeech.score)]) } : null, speaking },
    chat: chat.slice(-30), asking,
  };
}
const push = () => safeSend(win, 'landmarkState', landmarkView());

export function openLandmark(k: string | null, c?: Companion): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 갈 수 있습니다.', 'Load a save first.') };
  if (!isEthicKey(k)) return { ok: false, error: L('이 제국에는 특별한 곳이 없습니다.', 'This empire has no such place.') };
  const nc = c && c.kind !== 'alone' ? c : { kind: 'alone' as const, key: '', name: '' };
  if (k !== key || nc.key !== comp.key) { chat = []; lastSpeech = null; ritualText = ''; } key = k; comp = nc; artSeen.clear();
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#06060c', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'landmark.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: landmarkView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: landmarkView() });
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };

/** 의식: 장면 글 + 해마다 한 번 민심 +1. */
export function doRitual(sid: string): { text: string; counted: boolean } {
  const lm = LANDMARKS[key], s = saveOf(sid), y = yearOf(ctx.gameDate || ''), d = (s.done[key] ??= {}); ritualText = L(lm.ritual.sceneKo, lm.ritual.sceneEn);
  let counted = false; if (Number.isFinite(y) && d.ritual !== y) { d.ritual = y; counted = true; moodNudge(SPEECH.ritualMood, `landmark ritual: ${lm.ritual.en}`); save(); paparazziSnap('ritual', { place: L(SPECIAL_PLACES[key]?.ko ?? '', SPECIAL_PLACES[key]?.en ?? '') }); }
  return { text: ritualText, counted };
}
export function registerLandmark(): void {
  ipcMain.handle('landmarkState', () => landmarkView());
  ipcMain.handle('landmarkClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  ipcMain.handle('landmarkRitual', () => { try { const r = doRitual(need()); push(); return ok(r); } catch (e) { return err(e); } });
  /** 인물과 대화(물을 때만 AI). */
  ipcMain.handle('landmarkSay', async (_e, text: unknown) => {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    try { need(); if (!t) throw new Error(L('할 말을 입력하세요.', 'Type something to say.')); if (asking) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for a reply.'));
      const prior = chat.filter((c) => c.who !== 'sys') as Array<{ who: 'me' | 'them'; text: string }>; asking = true; chat.push({ who: 'me', text: t }); push();
      const s = situation(); let j: Record<string, unknown> | null = null;
      try { j = await personaJson(figureMessages({ key, place: placeEn(), ...s, companion: comp.kind !== 'alone' ? comp.name : '', lines: prior, text: t, ko: isKo() }), 900, 'reply'); } catch (e) { logDiagnostic('warn', 'landmark.talk_failed', { error: e }); }
      asking = false; if (!j) { chat.pop(); push(); throw new Error(L('대답을 받지 못했습니다(AI 연결을 확인하세요).', 'No reply (check the AI connection).')); }
      chat.push({ who: 'them', text: String(j.reply ?? '').trim().slice(0, 700) }); chat = chat.slice(-40); push(); return ok();
    } catch (e) { asking = false; return err(e); }
  });
  /** 공개 연설·문답(AI 한 번): 군중 반응 + 점수 → 해마다 한 번 민심에 잠깐. */
  ipcMain.handle('landmarkAddress', async (_e, text: unknown) => {
    const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200);
    try { const sid = need(); if (t.length < 4) throw new Error(L('연설을 조금 더 써 주세요.', 'Please write a little more.')); if (speaking) throw new Error(L('군중이 아직 반응하는 중입니다.', 'The crowd is still reacting.'));
      speaking = true; push(); const s = situation(); let j: Record<string, unknown> | null = null;
      try { j = await personaJson(addressMessages({ key, place: placeEn(), ...s, speech: t, ko: isKo() }), 900, 'reaction'); } catch (e) { logDiagnostic('warn', 'landmark.address_failed', { error: e }); }
      speaking = false; if (!j) { push(); throw new Error(L('군중의 반응을 받지 못했습니다(AI 연결을 확인하세요).', 'No crowd reaction (check the AI connection).')); }
      const score = clampScore(j.score), reaction = String(j.reaction ?? '').trim().slice(0, 800), lm = LANDMARKS[key], y = yearOf(ctx.gameDate || ''), d = (saveOf(sid).done[key] ??= {});
      let counted = false; if (Number.isFinite(y) && d.address !== y) { d.address = y; counted = true; if (score) moodNudge(score, `landmark speech: ${lm.address.en}`); const pk = speechKind(score); if (pk) paparazziSnap(pk, { place: L(SPECIAL_PLACES[key]?.ko ?? '', SPECIAL_PLACES[key]?.en ?? '') }); }
      const sv = saveOf(sid); sv.speeches.push({ date: ctx.gameDate || '', key, score, text: t.slice(0, 300), reaction: reaction.slice(0, 300) }); sv.speeches = sv.speeches.slice(-40); save();
      try { if (ctx.playerIdx) chronNote(ctx.playerIdx, L(`${ctx.gameDate || ''} 통치자가 ${SPECIAL_PLACES[key]?.ko ?? ''}에서 「${lm.address.ko}」 — 군중 반응: ${SCORE_WORD[String(score)][0]}`, `${ctx.gameDate || ''} The ruler gave "${lm.address.en}" at the ${placeEn()} — the crowd: ${SCORE_WORD[String(score)][1]}`)); } catch { /* 기록 실패는 무시 */ }
      lastSpeech = { text: t, reaction, score, counted }; push(); return ok({ score, counted });
    } catch (e) { speaking = false; return err(e); }
  });
}
export const _landmarkTest = { landmarkView, saveOf, doRitual, set: (k: EthicKey, c?: Companion) => { key = k; comp = c ?? { kind: 'alone', key: '', name: '' }; } };
