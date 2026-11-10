// 「외출」 창(2026-10-30 사용자 결정, 계획서 10번). 규칙·자료: src/outing.ts · 화면: ui/outing.html · 입구: 집무실 책상 위 가죽 지갑(ui/office.html #deskWallet).
// 지금 갈 수 있는 곳: 도시 공원(연인·배우자와 데이트 → date-park.html), 우주 경기장(레전드 오브 갤럭시), 카지노 정거장(ui/casino.html). 나머지는 「준비 중」으로 지도에만 보임.
// 동행(혼자 · 연인/배우자 · 지도자 한 명)과 성향별 특별한 곳 선택은 세이브마다 기억. 위에 통치자 개인 금고 잔액(외출에서 쓰는 돈).
// 게임 명령 없음, AI 없음.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import { autoOfficeStyle } from '../office-style';
import { type Companion, type PlaceId, OUTING_MAPS, SPECIAL_PLACES, ETHIC_NAMES, ALONE, ethicChoices, specialKey, validCompanion, canGo } from '../outing';
import { peopleOf } from './people-app';
import { vaultBalance } from './vault-app';
import { outingPartners, openDateFromOuting } from './romance-app';
import { paparazziSnap } from './paparazzi-app'; // 파파라치(2026-10-31)
import { openLog } from './log-app';
import { openCasino } from './casino-app';
import { openStore } from './store-app';
import { openPetshop } from './petshop-app';
import { openTavern } from './tavern-app';
import { openBlackmarket } from './blackmarket-app';
import { openLandmark } from './landmark-app';

interface OutingSave { ethic?: string; comp?: Companion; trips?: number }
const file = () => path.join(app.getPath('userData'), 'sllm_outing.json');
let data: { saves: Record<string, OutingSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'outing', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'outing', error: e }); } }
const saveOf = (sid: string): OutingSave => (all().saves[sid] ??= {});

let win: BrowserWindow | null = null;
const artSeen = new Map<string, boolean>();
const art = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };

function ethicsNow(): string[] { try { return ctx.playerIdx >= 0 ? ctx.flagProv.ethicsFor(ctx.playerIdx) ?? [] : []; } catch { return []; } }
function leaders(sid: string): Companion[] { return peopleOf(sid).filter((p) => !p.gone && !p.ruler).sort((a, b) => (b.council ? 1 : 0) - (a.council ? 1 : 0) || b.lv - a.lv).map((p) => ({ kind: 'leader' as const, key: `p:${p.lid}`, name: p.name })); }
function partners(sid: string): Companion[] { try { return outingPartners(sid).map((p) => ({ kind: 'partner' as const, key: p.key, name: p.name })); } catch { return []; } }

export function outingView() {
  const sid = ctx.curSaveId || '';
  if (!sid) return { sid: '', ready: false };
  const s = saveOf(sid), eth = ethicsNow(), choices = ethicChoices(eth), auto = autoOfficeStyle(eth), sk = specialKey(auto, choices, s.ethic);
  const ps = partners(sid), ls = leaders(sid), comp = validCompanion(s.comp, ps, ls), map = OUTING_MAPS[0];
  const sp = sk ? SPECIAL_PLACES[sk] : null;
  return {
    sid, ready: true, date: ctx.gameDate || '', vault: vaultBalance(sid), trips: s.trips ?? 0,
    map: { id: map.id, name: L(map.ko, map.en), art: art(`assets/outing/${sk ?? 'spiritualist'}-city.webp`), depart: art('assets/outing/outing-depart.webp') }, // 단일 의식이면 특별한 곳 없이 기본 지도
    ethic: sk, ethicName: sk ? L(...ETHIC_NAMES[sk]) : '', ethicPicked: !!(s.ethic && choices.includes(s.ethic)),
    ethicChoices: choices.map((k) => ({ key: k, name: L(...ETHIC_NAMES[k]), place: L(SPECIAL_PLACES[k].ko, SPECIAL_PLACES[k].en) })),
    places: map.places.map((p) => {
      const g = canGo(p, comp, sk), isSp = p.id === 'special';
      return { id: p.id, x: p.x, y: p.y, name: isSp && sp ? L(sp.ko, sp.en) : L(p.ko, p.en), about: isSp && sp ? L(`${p.aboutKo} 할 수 있는 일: ${sp.doKo}.`, `${p.aboutEn} Things to do: ${sp.doEn}.`) : L(p.aboutKo, p.aboutEn), ready: p.ready && !(isSp && !sp), art: isSp ? (sk ? art(`assets/outing/${sk}-landmark.webp`) : null) : p.id === 'park' ? null : art(`assets/outing/outing-${p.id}.webp`), go: g.ok, why: g.ok ? '' : L(g.whyKo, g.whyEn), hidden: isSp && !sp };
    }),
    comp, companions: { partners: ps, leaders: ls },
  };
}
const push = () => safeSend(win, 'outingState', outingView());

export function openOuting(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 나갈 수 있습니다.', 'Load a save first.') };
  artSeen.clear();
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.88)) };
  const ow = BrowserWindow.getAllWindows().find((x) => !x.isDestroyed() && x.isVisible() && /office\.html$/i.test(x.webContents.getURL())), ob = ow ? ow.getBounds() : null;
  const w = new BrowserWindow({ ...(ob ? { width: ob.width, height: ob.height, x: ob.x, y: ob.y } : { ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2) }), minWidth: 900, minHeight: 600, frame: false, show: false, backgroundColor: '#070b14', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'outing.html'));
  w.once('ready-to-show', () => { w.show(); push(); });
  w.on('closed', () => { if (win === w) win = null; if (ow && !ow.isDestroyed()) ow.focus(); });
  return { ok: true };
}

/** 장소로 가기. 붙어 있는 곳만 실제로 열고, 외출 창은 뒤로 내린다(장소 창을 닫으면 다시 지도). */
function go(id: PlaceId): { ok: boolean; error?: string; opened?: string } {
  const v = outingView(); if (!v.ready) return { ok: false, error: L('세이브를 불러온 뒤에 나갈 수 있습니다.', 'Load a save first.') };
  const p = v.places!.find((x) => x.id === id); if (!p) return { ok: false, error: L('그런 장소가 없습니다.', 'No such place.') };
  if (!p.go) return { ok: false, error: p.why };
  const sid = v.sid, s = saveOf(sid);
  if (id === 'park') { openDateFromOuting(sid, v.comp!.key); try { const ps = outingPartners(sid), me = ps.find((x) => x.key === v.comp!.key), wed = ps.some((x) => x.stage === 'married' && x.key !== v.comp!.key); paparazziSnap(me && me.stage !== 'married' && wed ? 'affair' : 'date', { who: v.comp!.name }); } catch { /* 연인 정보 없음 */ } } // 파파라치: 배우자가 따로 있는데 다른 연인과면 밀회
  else if (id === 'stadium') { const r = openLog(); if (!r.ok) return r; }
  else if (id === 'casino') { const r = openCasino(); if (!r.ok) return r; }
  else if (id === 'store') { const r = openStore(v.comp); if (!r.ok) return r; }
  else if (id === 'petshop') { const r = openPetshop(v.comp); if (!r.ok) return r; }
  else if (id === 'tavern') { const r = openTavern(); if (!r.ok) return r; }
  else if (id === 'blackmarket') { const r = openBlackmarket(); if (!r.ok) return r; }
  else if (id === 'special') { const r = openLandmark(v.ethic ?? null, v.comp); if (!r.ok) return r; }
  else return { ok: false, error: L('아직 준비 중인 곳입니다.', 'This place is not open yet.') };
  s.trips = (s.trips ?? 0) + 1; save();
  return { ok: true, opened: id };
}

const ok = () => ({ ok: true, state: outingView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: outingView() });
export function registerOuting(): void {
  ipcMain.handle('outingOpen', () => openOuting());
  ipcMain.handle('outingState', () => outingView());
  ipcMain.handle('outingClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  ipcMain.handle('outingEthic', (_e, k: unknown) => { try { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 고를 수 있습니다.', 'Load a save first.')); const s = saveOf(sid); if (k === null || k === '') delete s.ethic; else if (typeof k === 'string' && ethicChoices(ethicsNow()).includes(k)) s.ethic = k; else throw new Error(L('우리 제국의 성향이 아닙니다.', 'Not one of our ethics.')); save(); push(); return ok(); } catch (e) { return err(e); } });
  ipcMain.handle('outingCompanion', (_e, a: unknown) => {
    try {
      const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 고를 수 있습니다.', 'Load a save first.'));
      const s = saveOf(sid), o = (a ?? {}) as { kind?: unknown; key?: unknown };
      if (!o.kind || o.kind === 'alone') s.comp = ALONE;
      else { const pool = o.kind === 'partner' ? partners(sid) : o.kind === 'leader' ? leaders(sid) : []; const c = pool.find((x) => x.key === o.key); if (!c) throw new Error(L('그 인물과는 함께 나갈 수 없습니다.', 'You cannot go out with that person.')); s.comp = c; }
      save(); push(); return ok();
    } catch (e) { return err(e); }
  });
  ipcMain.handle('outingGo', (_e, id: unknown) => { try { const r = go(String(id) as PlaceId); push(); return { ...r, state: outingView() }; } catch (e) { return err(e); } });
}
export const _outingTest = { outingView, saveOf, go };
