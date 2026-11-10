// 암시장 골목 창(2026-10-30). 규칙·자료: src/blackmarket.ts · 화면: ui/blackmarket.html · 입구: 외출 지도 → 암시장 골목(혼자만, 후드).
// 값은 통치자 개인 금고에서. 흥정·가짜·단속은 앱이 판정(AI 없음). 정보상 단서는 궁정 음모의 「수상한 낌새」를 미리 켬(courtTipOff).
// 결과는 기록만(연대기 한 줄 + 저장): 게임·민심 효과 없음. 단속에 걸린 날은 다시 못 들어감. 게임 명령 없음.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import { chronNote } from './chronicle-app';
import { courtTipOff } from './court-app';
import { paparazziSnap } from './paparazzi-app'; // 파파라치(2026-10-31)
import { vaultBalance, spendFromVault } from './vault-app';
import { ITEMS, STALLS, BM, LINES, itemOf, stallOf, floorOf, offer, fakeChance, clampHeat, raidNow, type Deal } from '../blackmarket';

interface Owned { uid: string; id: string; on: string; price: number; fake: boolean; appraised?: boolean }
interface BmSave { n: number; owned: Owned[]; raids: string[]; tips: Array<{ on: string; kind: string; name: string }> }
const file = () => path.join(app.getPath('userData'), 'sllm_blackmarket.json');
let data: { saves: Record<string, BmSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'blackmarket', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'blackmarket', error: e }); } }
const saveOf = (sid: string): BmSave => { const s = (all().saves[sid] ??= { n: 0, owned: [], raids: [], tips: [] }); s.owned ??= []; s.raids ??= []; s.tips ??= []; s.n ??= 0; return s; };
/** 들여놓은 밀수 생물·물건(침실 쪽에서 읽음). 가짜인지 아직 모르면 fake 를 숨김. */
export const blackmarketOwned = (sid: string) => saveOf(sid).owned.map((o) => ({ uid: o.uid, id: o.id, on: o.on, kind: itemOf(o.id)?.stall === 'creatures' ? 'creature' : 'goods', fake: o.appraised ? o.fake : undefined }));

interface Visit { day: string; heat: number; deals: Record<string, Deal>; raided: boolean; said: Record<string, string> }
let win: BrowserWindow | null = null, v: Visit | null = null;
const artSeen = new Map<string, boolean>();
const art1 = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
const art = (base: string, png = false): string | null => (png ? art1(`${base}.png`) ?? art1(`${base}.webp`) : art1(`${base}.webp`) ?? art1(`${base}.png`));
const fill = (t: string, x: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_m, k) => String(x[k] ?? ''));
const line = (k: keyof typeof LINES, x: Record<string, string | number> = {}) => fill(L(...LINES[k]), x);
const bannedToday = (sid: string) => { const d = ctx.gameDate || ''; return !!d && saveOf(sid).raids.includes(d); };
const creaturesOf = (sid: string) => saveOf(sid).owned.filter((o) => itemOf(o.id)?.stall === 'creatures').length;

export function blackmarketView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const s = saveOf(sid), vv = v;
  return {
    sid, ready: true, vault: vaultBalance(sid), banned: bannedToday(sid) && !vv?.raided, heat: vv?.heat ?? 0, heatMax: BM.heatMax, raided: !!vv?.raided, raidText: vv?.raided ? line('raid') : '', bannedText: line('banned'),
    art: { bg: art('blackmarket/bg'), merchants: Object.fromEntries(STALLS.map((x) => [x.id, art(`blackmarket/merchants/${x.id}`)])), cut: Object.fromEntries(STALLS.map((x) => [x.id, art(`blackmarket/merchants/${x.id}_cut`)])) },
    stalls: STALLS.map((x) => ({ id: x.id, name: L(x.ko, x.en), who: L(x.whoKo, x.whoEn), greet: vv?.said[x.id] ?? L(x.greetKo, x.greetEn) })),
    items: ITEMS.map((it) => { const d = vv?.deals[it.id]; return { id: it.id, stall: it.stall, name: L(it.ko, it.en), about: L(it.aboutKo, it.aboutEn), ask: d?.ask ?? it.ask, list: it.ask, patience: d?.patience ?? BM.patience, closed: !!d?.closed, icon: art(`blackmarket/items/${it.id}`, true) }; }),
    creatures: creaturesOf(sid), maxCreatures: BM.maxCreatures, tipCost: BM.tipCost, appraiseCost: BM.appraiseCost,
    home: s.owned.slice().reverse().map((o) => { const it = itemOf(o.id); return { uid: o.uid, id: o.id, name: it ? (o.appraised && o.fake ? L(`가짜 ${it.ko}`, `Fake ${it.en}`) : L(it.ko, it.en)) : o.id, on: o.on, price: o.price, appraised: !!o.appraised, fake: o.appraised ? o.fake : null }; }),
    tips: s.tips.slice(-5).reverse(),
  };
}
const push = () => safeSend(win, 'blackmarketState', blackmarketView());

export function openBlackmarket(): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 갈 수 있습니다.', 'Load a save first.') };
  artSeen.clear(); const d = ctx.gameDate || '';
  if (!v || v.raided || v.day !== d) v = bannedToday(ctx.curSaveId) ? null : { day: d, heat: 0, deals: {}, raided: false, said: {} };
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#05070a', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'blackmarket.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: blackmarketView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: blackmarketView() });
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };
const inside = (sid: string) => { if (bannedToday(sid) && !v?.raided) throw new Error(line('banned')); if (!v) throw new Error(line('banned')); if (v.raided) throw new Error(L('단속을 피해 이미 빠져나왔습니다.', 'You already fled the raid.')); return v; };
/** 행동마다 열기 + 단속 판정. 걸리면 기록만 남기고 끝. */
function heatUp(sid: string, n: number, rand = Math.random): boolean {
  if (!v) return false; v.heat = clampHeat(v.heat + n);
  if (raidNow(v.heat, rand())) { v.raided = true; paparazziSnap('bmRaid'); const d = ctx.gameDate || ''; const s = saveOf(sid); if (!s.raids.includes(d)) s.raids.push(d); s.raids = s.raids.slice(-50); save();
    try { if (ctx.playerIdx) chronNote(ctx.playerIdx, L(`${d} 통치자가 후드를 쓰고 암시장 골목에 갔다가 단속을 피해 급히 빠져나왔다`, `${d} The hooded ruler fled a patrol raid in the black-market alley`)); } catch { /* 기록 실패는 무시 */ }
    return true; }
  return false;
}
export function registerBlackmarket(): void {
  ipcMain.handle('blackmarketOpen', () => openBlackmarket());
  ipcMain.handle('blackmarketState', () => blackmarketView());
  ipcMain.handle('blackmarketClose', () => { if (v?.raided) v = null; if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  /** 흥정: 값을 부름 → 받아들임(삼)·되부름·기분 상함·안 팜. */
  ipcMain.handle('blackmarketOffer', (_e, id: unknown, price: unknown) => {
    try {
      const sid = need(), vv = inside(sid), it = itemOf(String(id)); if (!it) throw new Error(L('그런 물건이 없습니다.', 'No such item.'));
      if (it.stall === 'creatures' && creaturesOf(sid) >= BM.maxCreatures) { vv.said[it.stall] = line('full'); push(); return ok({ reply: line('full') }); }
      const d0 = vv.deals[it.id] ?? { ask: it.ask, patience: BM.patience }; if (d0.closed) { vv.said[it.stall] = line('walk'); push(); return ok({ reply: line('walk') }); }
      const p = Math.round(Number(price)); if (!Number.isFinite(p) || p <= 0) throw new Error(L('값을 숫자로 부르세요.', 'Name a price in numbers.'));
      const fl = floorOf(it, vv.day), { deal, r } = offer(d0, p, fl);
      if (r.kind === 'accept') {
        if (vaultBalance(sid) < r.price) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${r.price}).`, `Not enough credits in the vault (need ${r.price}).`));
        if (!spendFromVault(sid, r.price, `blackmarket: ${it.en}`)) throw new Error(L('금고에서 꺼내지 못했습니다.', 'Could not draw from the vault.'));
        const s = saveOf(sid); s.owned.push({ uid: `b${++s.n}`, id: it.id, on: ctx.gameDate || '', price: r.price, fake: Math.random() < fakeChance(it) }); s.owned = s.owned.slice(-120); save();
        vv.deals[it.id] = { ...deal, closed: true }; const reply = line('accept', { price: r.price }); vv.said[it.stall] = reply; const raid = heatUp(sid, BM.buyHeat); if (!raid) paparazziSnap('bmBuy', { item: L(it.ko, it.en) }); push(); return ok({ reply, bought: L(it.ko, it.en), raid });
      }
      vv.deals[it.id] = deal; const reply = r.kind === 'counter' ? line('counter', { ask: r.ask }) : r.kind === 'insult' ? line('insult', { ask: r.ask }) : line('walk'); vv.said[it.stall] = reply;
      const raid = heatUp(sid, BM.offerHeat); push(); return ok({ reply, raid });
    } catch (e) { return err(e); }
  });
  /** 정보상: 궁정 음모 단서(없으면 상담료만). */
  ipcMain.handle('blackmarketTip', () => {
    try {
      const sid = need(), vv = inside(sid); if (vaultBalance(sid) < BM.tipCost) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${BM.tipCost}).`, `Not enough credits in the vault (need ${BM.tipCost}).`));
      const t = courtTipOff(); let reply: string;
      if (t) { spendFromVault(sid, BM.tipCost, 'blackmarket: tip'); const s = saveOf(sid); s.tips.push({ on: ctx.gameDate || '', kind: t.kind, name: t.name }); s.tips = s.tips.slice(-30); save(); reply = line('tip', { name: t.name, kind: t.kind }); }
      else { spendFromVault(sid, BM.tipNone, 'blackmarket: consultation'); reply = line('tipNone'); }
      vv.said.broker = reply; const raid = heatUp(sid, BM.brokerHeat); push(); return ok({ reply, tipped: !!t, raid });
    } catch (e) { return err(e); }
  });
  /** 정보상: 산 물건 감정(진짜·가짜가 드러남). */
  ipcMain.handle('blackmarketAppraise', (_e, uid: unknown) => {
    try {
      const sid = need(), vv = inside(sid), o = saveOf(sid).owned.find((x) => x.uid === String(uid)); if (!o) throw new Error(L('그런 물건이 없습니다.', 'No such item.')); if (o.appraised) throw new Error(L('이미 감정했습니다.', 'Already appraised.'));
      if (!spendFromVault(sid, BM.appraiseCost, 'blackmarket: appraisal')) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${BM.appraiseCost}).`, `Not enough credits in the vault (need ${BM.appraiseCost}).`));
      o.appraised = true; save(); const it = itemOf(o.id)!; const reply = o.fake ? line('appraiseFake', { item: L(it.ko, it.en), fake: L(it.fakeKo, it.fakeEn) }) : line('appraiseReal', { item: L(it.ko, it.en) });
      vv.said.broker = reply; const raid = heatUp(sid, BM.brokerHeat / 2); push(); return ok({ reply, fake: o.fake, raid });
    } catch (e) { return err(e); }
  });
}
export const _blackmarketTest = { blackmarketView, saveOf, heatUp, visit: () => v, reset: () => { v = null; } };
