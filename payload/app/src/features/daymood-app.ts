// 동적 일상 분위기(2026-10-28 알파 10) 앱 쪽 — 규칙·문장: ../daymood.ts.
// 매달 월간 상황(onGameSnapshot)에서 분위기 태그를 다시 정하고(LLM 없음, 게임 명령 없음), 비서 아침 인사·라디오 짧은 꼭지에 틀 문장을 내준다.
// 경기 단계는 인터넷이 매달 쌓는 기록을 그대로 쓴다(따로 게임에 묻지 않음). 다른 기능은 app/daymood-hooks 로만 부른다.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { onGameSnapshot, gameState } from './gamestate-app';
import { protestsView } from './protests-app';
import { crisisRadio } from './crisis-app';
import { econNow } from './internet-app';
import { gov } from './gov';
import { gameName } from './namegen-app';
import { dayMoodLink, type DayFlash } from '../app/daymood-hooks';
import { addMonths, cmpDate } from '../gamedate';
import { type DayTags, type FlashMark, FLASH_MONTHS, computeTags, addFlash, greeting, makeSegment, SEG_LABEL } from '../daymood';

interface SaveEntry { flash: FlashMark | null; greetMonth: string; tags: DayTags | null; war: { on: boolean; own: number; foe: number } | null }
const file = () => path.join(app.getPath('userData'), 'sllm_daymood.json');
let store: Record<string, SaveEntry> | null = null;
const blank = (): SaveEntry => ({ flash: null, greetMonth: '', tags: null, war: null });
function all(): Record<string, SaveEntry> {
  if (store) return store; store = {};
  try {
    const o = JSON.parse(fs.readFileSync(file(), 'utf8'));
    for (const [k, v] of Object.entries((o?.saves ?? {}) as Record<string, any>)) {
      const e = blank();
      if (v?.flash && typeof v.flash.until === 'string' && ['joy', 'grief', 'stir'].includes(v.flash.kind)) e.flash = { kind: v.flash.kind, until: v.flash.until, why: String(v.flash.why ?? '').slice(0, 80) };
      e.greetMonth = typeof v?.greetMonth === 'string' ? v.greetMonth : '';
      if (v?.tags && typeof v.tags.main === 'string') e.tags = v.tags;
      if (v?.war && typeof v.war.on === 'boolean') e.war = { on: v.war.on, own: Number(v.war.own) || 0, foe: Number(v.war.foe) || 0 };
      store[k] = e;
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'daymood', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'daymood', error: e }); } }
const entry = (sid: string): SaveEntry => (all()[safeKey(sid)] ??= blank());
const today = () => ctx.gameDate || '';
const planetsOf = (sid: string) => (gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets : []);
const capitalOf = (sid: string) => planetsOf(sid).find((p) => p.capital)?.name ?? '';

function event(kind: DayFlash, why: string): void {
  const sid = ctx.curSaveId, d = today(); if (!sid || !d) return;
  const e = entry(sid); e.flash = addFlash(e.flash, kind, why, d, addMonths(d, FLASH_MONTHS[kind]), cmpDate);
  if (e.tags) e.tags = recompute(sid, e, gameState.last); // 바로 반영(다음 월간까지 기다리지 않음)
  save();
}
type Snap = typeof gameState.last;
function recompute(sid: string, e: SaveEntry, s: Snap): DayTags {
  const m = s?.mood;
  let protests = 0; try { protests = protestsView().open.length; } catch { /* 없음 */ }
  let crisis = false; try { crisis = !!crisisRadio().directive; } catch { /* 없음 */ }
  let econ: DayTags['econ'] = 'normal'; try { econ = econNow(sid); } catch { /* 없음 */ }
  return computeTags({ war: !!s?.wars?.length, econ, avgStability: m && m.cnt > 0 ? m.sum / m.cnt : null, protests, crisis, flash: e.flash, today: today(), ethBits: s?.empireEth }, cmpDate);
}
/** 월간: 전쟁이 끝났으면 승전(경사)·패전(애도), 그다음 태그. */
function monthly(snap: NonNullable<Snap>): void {
  const sid = snap.sid; if (!sid || sid !== ctx.curSaveId || snap.gestalt) return;
  const e = entry(sid), wars = snap.wars ?? [];
  const own = wars.length ? Math.max(...wars.map((w) => (w.side === 'att' ? w.ax : w.dx))) : 0, foe = wars.length ? Math.max(...wars.map((w) => (w.side === 'att' ? w.dx : w.ax))) : 0;
  if (e.war?.on && !wars.length) { // 전쟁이 끝남: 마지막 달의 전쟁 피로로 가른다
    const won = e.war.own + 0.05 < e.war.foe, lost = e.war.own > e.war.foe + 0.15;
    if (won) e.flash = addFlash(e.flash, 'joy', L('승전', 'Victory'), snap.date, addMonths(snap.date, FLASH_MONTHS.joy), cmpDate);
    else if (lost) e.flash = addFlash(e.flash, 'grief', L('패전', 'Defeat'), snap.date, addMonths(snap.date, FLASH_MONTHS.grief), cmpDate);
  }
  e.war = { on: wars.length > 0, own, foe };
  e.tags = recompute(sid, e, snap);
  save();
}
function greet(sid: string): string {
  if (!sid || gameState.last?.gestalt) return '';
  const e = entry(sid), mk = today().slice(0, 7); if (!mk || e.greetMonth === mk) return '';
  const t = e.tags ?? recompute(sid, e, gameState.last);
  e.greetMonth = mk; save();
  return greeting(t, capitalOf(sid), Math.random, L);
}
let lastSegDate = '';
function segment() {
  const sid = ctx.curSaveId, d = today(); if (!sid || !d || gameState.last?.gestalt) return null;
  if (lastSegDate === sid + ':' + d) return null; // 게임 날짜가 그대로면(일시정지) 꼭지를 넣지 않는다
  lastSegDate = sid + ':' + d;
  const e = entry(sid), t = e.tags ?? recompute(sid, e, gameState.last);
  const planets = planetsOf(sid).map((p) => ({ name: p.name, pc: p.pc }));
  const g = Math.random() < 0.5 ? 'm' : 'f', r = Math.random();
  const lean = r < 9 / 24 ? 'prog' : r < 18 / 24 ? 'cons' : 'neu'; // 인터넷 단골 시민 기본 비율(진보 9 · 보수 9 · 중립 6)
  const s = makeSegment({ tags: t, planets, callerName: gameName(g) ?? '', callerLean: lean, r: Math.random, L });
  return { label: L(...SEG_LABEL[s.kind]), kind: s.kind, lines: s.lines, ...(s.caller ? { caller: s.caller } : {}) };
}
/** 화면·검사용: 지금 태그. */
export const dayMoodNow = (): DayTags | null => { const sid = ctx.curSaveId; return sid ? entry(sid).tags : null; };

export function registerDayMood(): void {
  dayMoodLink.greet = greet; dayMoodLink.segment = segment; dayMoodLink.event = event;
  onGameSnapshot((snap) => { try { monthly(snap); } catch (err) { logDiagnostic('warn', 'daymood.month_failed', { error: String(err) }); } });
}
