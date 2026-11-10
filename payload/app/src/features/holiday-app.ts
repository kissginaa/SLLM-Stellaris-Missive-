// 행성 고유 기념일과 통치자 방문(12, 2026-10-23 집 PC 초안). 규칙: src/planet-holiday.ts. 화면: 집무실 「국가 행사날」 창 안의 「행성 기념일」 칸(ui/planet-holidays.js).
// 사용자 확정: 주민이 정한 기념일(국가기념일과 별개) / AI 가 행성 정보로 제목·한 문장 설명 / 기념일 자체엔 효과 없음 / 기념일이 든 달 안에 「방문」하면 그 행성에만 효과(2026-10-23: 정확한 날짜 → 그 달) / 설립 1년 뒤부터 생성.
// 설립일 = 행성 목록을 받은 날 − colony_age 개월(모드 PLANET cage). 한 번 정하면 저장하고 옮기지 않는다. 설립일을 모르면 만들지 않는다(추정하지 않음).
// 비용 상한: 한 달에 최대 3개만 생성(AI). 행성 목록은 앱이 6개월에 한 번만 새로 받는다. 방문 효과·기간은 모드 파일(sllm_holiday_visit, 자리값 안정도 +5·360일).
import { dayMoodEvent } from '../app/daymood-hooks'; // 동적 일상 분위기: 행성 기념일 = 경사(2026-10-28)
import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { terminalRequest } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { office } from './office-app';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf } from './people-app';
import { gov, refreshPlanets } from './gov';
import { selectedLanguage } from './settings-ui';
import { planetTypeEn, type Planet } from '../planets';
import { addMonths, cmpDate } from '../gamedate';
import { type PlanetHoliday, holidayEligible, foundedFromColonyAge, assignHolidayDate, cleanHolidayText, isHolidayToday, isHolidayMonth, holidayYear, canVisit, upcoming, holidayVisitCommand } from '../planet-holiday';

export const HOLIDAY = { perMonth: 3, refreshMonths: 6 } as const;
const DES_EN = ['', 'capital world', 'mining world', 'agricultural world', 'generator world', 'research world', 'industrial world', 'trade world', 'administrative/unity world', 'fortress world', 'resort world', 'penal colony', 'urban world'];

interface HolBook { sid: string; holidays: Record<string, PlanetHoliday>; founded: Record<string, string>; listOn: string; noticed: string[]; failed: Record<string, number> }
const dir = () => path.join(app.getPath('userData'), 'planet-holidays');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, HolBook>();
export function sanitizeHolBook(x: unknown, sid: string): HolBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<HolBook>, hs: Record<string, PlanetHoliday> = {};
  for (const [k, h] of Object.entries(o.holidays ?? {})) if (h && typeof h === 'object' && typeof h.title === 'string' && Number.isInteger(h.month) && Number.isInteger(h.day)) hs[k] = { ...h, visits: h.visits && typeof h.visits === 'object' ? h.visits : {} };
  const fd: Record<string, string> = {}; for (const [k, v] of Object.entries(o.founded ?? {})) if (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v)) fd[k] = v;
  return { sid, holidays: hs, founded: fd, listOn: typeof o.listOn === 'string' ? o.listOn : '', noticed: Array.isArray(o.noticed) ? o.noticed.slice(-24) : [], failed: o.failed && typeof o.failed === 'object' ? o.failed : {} };
}
function bookOf(sid: string): HolBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeHolBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'planet-holidays', error: e }); b = sanitizeHolBook(null, sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'planet-holidays', error: e }); }
}
const planetsNow = (sid: string): Planet[] => (gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets : []);

/** 행성 목록에서 설립일을 처음 한 번만 기록(12: 개척 완료 기준, 앱 관측일로 대신하지 않음). colony_age 가 없으면 기록하지 않는다. */
export function recordFounding(b: HolBook, planets: Planet[], listDate: string): string[] {
  const added: string[] = [];
  for (const p of planets) { if (b.founded[p.name]) continue; const f = foundedFromColonyAge(listDate, p.age); if (f) { b.founded[p.name] = f; added.push(p.name); } }
  return added;
}
/** 생성 대기: 설립 1년이 지났고 아직 기념일이 없는 행성. 실패 3번이면 쉰다. */
export function holidayQueue(b: HolBook, planets: Planet[], today: string): Planet[] {
  return planets.filter((p) => !b.holidays[p.name] && (b.failed[p.name] ?? 0) < 3 && holidayEligible(b.founded[p.name], today) === 'eligible');
}
/** AI 지시(영어, 응답 언어는 aiclient): 확인된 행성 정보만, 지어낸 역사 금지, JSON 두 칸. */
export function holidayMessages(p: Planet, a: { empire: string; foundedOn: string }): { role: 'system' | 'user'; content: string }[] {
  const facts = [`Planet: ${p.name}`, `Type: ${planetTypeEn(p) || 'unknown'}`, p.des ? `Designation: ${DES_EN[p.des] ?? 'other'}` : 'Designation: unknown', p.capital ? 'It is the imperial capital.' : '', p.pops !== null ? `Population: about ${p.pops}` : '', `Settled: ${a.foundedOn}`].filter(Boolean).join('\n');
  return [{ role: 'system', content: [
    `Invent the local annual holiday that the residents of one planet in the Stellaris empire "${a.empire || 'our empire'}" celebrate. It is the residents' own festival, not a state holiday.`,
    'Base it on the confirmed planet facts below (especially the designation and type). This is creative role-play about local culture: do not invent wars, massacres, named heroes or other events as real game history, and do not assume the residents are human.',
    'Output only JSON: {"title": "short name, at most 30 characters", "desc": "one sentence, at most 140 characters"}',
  ].join('\n') }, { role: 'user', content: facts }];
}

async function generate(sid: string, p: Planet): Promise<PlanetHoliday | null> {
  const b = bookOf(sid), foundedOn = b.founded[p.name]; if (!foundedOn) return null;
  try {
    const raw = String(await ctx.ai.chat(holidayMessages(p, { empire: ctx.playerName, foundedOn }), { maxTokens: 300, purpose: 'planet-holiday', json: true }) ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let j: unknown = null; try { j = JSON.parse(raw); } catch { const m = /\{[\s\S]*\}/.exec(raw); if (m) try { j = JSON.parse(m[0]); } catch { /* 아래에서 실패 처리 */ } }
    const t = cleanHolidayText(j as { title?: unknown; desc?: unknown } | null); if (!t) throw new Error('bad holiday text');
    const d = assignHolidayDate(foundedOn, Math.random);
    const src = ['name', 'type', ...(p.des ? ['designation'] : []), ...(p.capital ? ['capital'] : []), 'founded'];
    const h: PlanetHoliday = { sid, planet: p.name, title: t.title, desc: t.desc, month: d.month, day: d.day, createdOn: ctx.gameDate || '', foundedOn, source: src, lang: selectedLanguage(), visits: {} };
    b.holidays[p.name] = h; return h;
  } catch (e) { b.failed[p.name] = (b.failed[p.name] ?? 0) + 1; logDiagnostic('warn', 'holiday.generate_failed', { error: (e as Error).message }); return null; }
}

function toast(title: string, body: string): void { (office as { toastGo: string }).toastGo = 'planetHol'; ctx.notify({ kind: 'office', title, body, action: L('집무실', 'Office') }); }
async function onMonth(sid: string, date: string): Promise<void> {
  const b = bookOf(sid);
  // 행성 목록: 반년에 한 번만 새로 받는다(게임이 켜져 있을 때). 그 사이에는 다른 기능이 받아 둔 목록을 쓴다.
  if (ctx.gameRunning && (!b.listOn || cmpDate(date, addMonths(b.listOn, HOLIDAY.refreshMonths)) >= 0)) { const r = await refreshPlanets(); if (r && 'list' in r) b.listOn = date; }
  const planets = planetsNow(sid); if (!planets.length) { save(sid); return; }
  recordFounding(b, planets, ctx.gameDate || date);
  const made: PlanetHoliday[] = [];
  for (const p of holidayQueue(b, planets, date).slice(0, HOLIDAY.perMonth)) { const h = await generate(sid, p); if (h) made.push(h); }
  for (const h of made) chronNoteWorld(L(`${date} 「${h.planet}」 주민들의 기념일이 알려졌습니다 — ${h.title} (${h.month}월 ${h.day}일)`, `${date} The residents of "${h.planet}" have a holiday of their own — ${h.title} (month ${h.month}, day ${h.day})`), false);
  // 이번 달 기념일 한 번에 묶어 알림(행성마다 팝업을 띄우지 않는다)
  const mo = Number(date.split('.')[1]), key = `${holidayYear(date)}.${mo}`, owned = new Set(planets.map((p) => p.name));
  const thisMonth = Object.values(b.holidays).filter((h) => h.month === mo && owned.has(h.planet));
  if (thisMonth.length && !b.noticed.includes(key)) {
    b.noticed.push(key);
    dayMoodEvent('joy', L('행성 기념일', 'Planet holiday'));
    toast(L('이번 달 행성 기념일', 'Planet holidays this month'), thisMonth.map((h) => L(`${h.day}일 「${h.planet}」 ${h.title}`, `Day ${h.day}: "${h.planet}" ${h.title}`)).join(' · ') + L(' — 이번 달 안에 집무실 「행성 총독 › 행성 기념일」에서 방문하면 그 행성에 효과가 있습니다.', ' — visit any time this month from the office "Planetary governors › Planet holidays" for a local bonus.'));
  }
  save(sid); push();
}

export function holidaysView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '' };
  const b = bookOf(sid), today = ctx.gameDate || '', planets = planetsNow(sid), owned = new Set(planets.map((p) => p.name)), y = holidayYear(today);
  const waiting = planets.filter((p) => !b.holidays[p.name]).map((p) => ({ planet: p.name, why: holidayEligible(b.founded[p.name], today) }));
  return {
    sid, date: today, listOn: b.listOn,
    items: upcoming(Object.values(b.holidays), today).map((h) => ({ planet: h.planet, title: h.title, desc: h.desc, month: h.month, day: h.day, owned: owned.has(h.planet), today: isHolidayToday(h, today), month_: isHolidayMonth(h, today), visited: !!h.visits[y], status: h.visits[y]?.status ?? '' })),
    waiting: { young: waiting.filter((w) => w.why === 'too_young').map((w) => w.planet), unknown: waiting.filter((w) => w.why === 'unknown_founding').map((w) => w.planet), queued: waiting.filter((w) => w.why === 'eligible').map((w) => w.planet) },
  };
}
function push(): void { try { const v = holidaysView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('holidaysUpdate', v); } catch { /* 창 없음 */ } }

/** 방문(12): 게임에 지금 날짜를 다시 묻고(일 단위), 기념일이 든 달·올해 처음·지금 소유를 확인한 뒤 그 행성에만 효과 요청. 회신을 받은 뒤에 방문 완료로 기록. */
async function visit(sid: string, planet: string): Promise<{ text: string }> {
  if (!ctx.gameRunning || !/^\d+$/.test(sid)) throw new Error(L('게임이 켜져 있어야 방문할 수 있습니다.', 'The game must be running to visit.'));
  const b = bookOf(sid), h = b.holidays[planet]; if (!h) throw new Error(L('그 행성의 기념일이 없습니다.', 'That planet has no holiday.'));
  const hr = ++link.reqCounter, hello = await terminalRequest(`effect every_playable_country = { limit = { is_ai = no } sllm_probe_hello = { REQ = ${hr} } }`, 'HELLO', hr);
  const today = String(hello.kv.date ?? ''); if (!/^\d+\.\d+\.\d+$/.test(today)) throw new Error(L('게임 날짜를 확인하지 못했습니다.', 'Could not read the game date.'));
  const r = await refreshPlanets(); if (!r || !('list' in r)) throw new Error(L('행성 목록을 받지 못했습니다. 다시 시도해 주세요.', 'Could not get the planet list. Try again.'));
  const list = planetsNow(sid), k = list.findIndex((p) => p.name === planet) + 1;
  const c = canVisit(h, today, k > 0);
  if (!c.ok) throw new Error(c.why === 'not_today' ? L(`지금(${today})은 기념일이 든 달이 아닙니다. ${h.month}월 안에 방문해 주세요(${h.month}월 ${h.day}일이 기념일).`, `It is not the holiday month now (${today}). Visit any time during month ${h.month} (the holiday is on day ${h.day}).`) : c.why === 'already' ? L('올해는 이미 방문했습니다.', 'You already visited this year.') : L('지금 우리 행성이 아닙니다.', 'This planet is not ours now.'));
  const req = ++link.reqCounter, y = holidayYear(today), ruler = peopleOf(sid).find((p) => p.ruler && !p.gone)?.name ?? '';
  h.visits[y] = { on: today, ruler, req, status: 'pending' }; save(sid); // 요청 전에 기록 → 중복 클릭에도 한 번
  try {
    const st = (await terminalRequest(holidayVisitCommand(req, sid, k, Number(y)), 'HOLIDAYVISIT', req)).kv.status;
    h.visits[y].status = st === 'applied' || st === 'duplicate' ? 'applied' : st === 'no_target' ? 'no_target' : 'unknown';
  } catch (e) { h.visits[y].status = 'unknown'; logDiagnostic('warn', 'holiday.visit_failed', { error: (e as Error).message }); }
  save(sid); push();
  if (h.visits[y].status === 'no_target') { delete h.visits[y]; save(sid); throw new Error(L('게임에서 그 행성을 찾지 못했습니다.', 'The game could not find that planet.')); }
  const gv = list[k - 1]?.governor;
  chronNoteWorld(L(`${today} 통치자 ${ruler}이(가) 「${planet}」의 ${h.title}에 방문했습니다`, `${today} Ruler ${ruler} visited "${planet}" for ${h.title}`), true);
  return { text: L(`「${planet}」 주민들이 ${h.title}에 찾아온 통치자를 환호로 맞았습니다.${gv ? ` 총독 ${gv}이(가) 행사를 안내했습니다.` : ''}${h.visits[y].status === 'applied' ? ' 이 행성에 방문 효과가 적용되었습니다.' : ' 효과 적용 회신을 받지 못했습니다(다시 보내지 않습니다).'}`, `The residents of "${planet}" cheered the ruler who came for ${h.title}.${gv ? ` Governor ${gv} guided the festivities.` : ''}${h.visits[y].status === 'applied' ? ' The visit bonus now applies to this planet.' : ' No confirmation came back for the bonus (it will not be resent).'}`) };
}

export function registerHolidays(): void {
  onGameSnapshot((snap) => { if (!snap.sid || snap.sid !== ctx.curSaveId || snap.gestalt) return; void onMonth(snap.sid, snap.date).catch((e) => logDiagnostic('warn', 'holiday.month_failed', { error: (e as Error).message })); }, 'planetHoliday'); // 시나리오 잠금이면 매달 기념일 만들기·알림도 쉰다(2026-11-08)
  ipcMain.handle('holidaysState', () => holidaysView());
  ipcMain.handle('holidayVisit', async (_e, planet: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 먼저 불러와 주세요.', 'Load a save first.')); return { ok: true, ...(await visit(sid, String(planet ?? '').slice(0, 120))), state: holidaysView() }; } catch (e) { return { ok: false, error: (e as Error).message, state: holidaysView() }; } });
  ipcMain.handle('holidaysRefresh', async () => { const sid = ctx.curSaveId; if (!sid) return holidaysView(); const r = await refreshPlanets(); if (r && 'list' in r) { const b = bookOf(sid); b.listOn = ctx.gameDate || b.listOn; recordFounding(b, planetsNow(sid), ctx.gameDate || ''); save(sid); } return holidaysView(); });
}
