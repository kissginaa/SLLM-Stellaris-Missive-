// 백화점 창(2026-10-30, 계획서 9번). 규칙·자료: src/store.ts · 화면: ui/store.html · 입구: 외출 지도 → 백화점(openStore, 동행을 넘겨받음).
// 값은 통치자 개인 금고에서(spendFromVault). 산 물건은 세이브별 보관함(침실이 생기면 거기서 배치). 41층 물건은 함께 온 연인·배우자에게 바로 선물(호감).
// 43층 라운지: 함께 온 사람과 식사 대화(물을 때만 AI 한 번 — persona-app sayInPerson, 카지노 포커와 같은 길). 게임 명령 없음.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import type { Talk } from '../persona';
import type { Companion } from '../outing';
import { ITEMS, FLOORS, TIERS, BLOCKED_LINES, itemById, tierOf, priceFor, canBuy, giftDelta, likesOf, reactionOf } from '../store';
import { vaultBalance, spendFromVault } from './vault-app';
import { giftToPartner } from './romance-app';
import { sayInPerson } from './persona-app';
import { paparazziSnap } from './paparazzi-app'; // 파파라치(2026-10-31)
import { PAP } from '../paparazzi';
import { STORE_FIT } from '../bedroom'; // 가구 편의(2026-10-31)
import { giftableChildren, childGiftedToday, giftToChild } from './children-app';

interface Owned { id: string; on: string; giftTo?: string; child?: string }
interface StoreSave { spent: number; owned: Owned[]; gifts: Array<{ to: string; id: string; on: string; delta: number }> }
const file = () => path.join(app.getPath('userData'), 'sllm_store.json');
let data: { saves: Record<string, StoreSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'store', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'store', error: e }); } }
const saveOf = (sid: string): StoreSave => { const s = (all().saves[sid] ??= { spent: 0, owned: [], gifts: [] }); s.owned ??= []; s.gifts ??= []; s.spent ??= 0; return s; };
/** 보관함 물건(침실 쪽에서 읽음). */
/** 산 물건이 바뀌면 부름(침실 가구 편의가 연결, 2026-10-31 — 가져오기 고리 없이). */
export const storeHooks: { changed: (sid: string) => void } = { changed: () => {} };
export const storeOwned = (sid: string): Owned[] => saveOf(sid).owned.filter((o) => !o.giftTo);

let win: BrowserWindow | null = null, comp: Companion = { kind: 'alone', key: '', name: '' }, talk: Talk | null = null, chat: Array<{ who: 'me' | 'them' | 'sys'; text: string }> = [], asking = false, blockedN = 0;
const artSeen = new Map<string, boolean>();
const art = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };

export function storeView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const kids = giftableChildren(sid), kidLikes = new Map(kids.map((k) => [k.id, likesOf(`child:${k.id}`)])), s = saveOf(sid), tier = tierOf(s.spent), next = TIERS.find((t) => t.tier === tier + 1), liked = comp.kind === 'partner' ? likesOf(comp.key) : [], today = ctx.gameDate || '';
  return {
    sid, ready: true, vault: vaultBalance(sid), spent: s.spent, tier, tierName: L(TIERS[tier].ko, TIERS[tier].en), off: TIERS[tier].off, next: next ? { name: L(next.ko, next.en), need: next.spent - s.spent } : null,
    comp, partner: comp.kind === 'partner',
    floors: FLOORS.map((f) => ({ n: f.n, name: L(f.ko, f.en), about: L(f.aboutKo, f.aboutEn), bg: art(`store/bg/f${f.n}.webp`) })),
    art: { elevator: art('store/bg/elevator.webp') ?? null, concierge: art('store/concierge.webp') ?? art('store/concierge.png'), entrance: art('assets/outing/outing-store.webp') },
    items: ITEMS.map((it) => {
      const r = liked.length ? reactionOf(it, liked, comp.name) : null;
      return { id: it.id, floor: it.floor, name: L(it.ko, it.en), price: priceFor(it, tier), base: it.price, vip: it.vip ?? 0, vipName: it.vip ? L(TIERS[it.vip].ko, TIERS[it.vip].en) : '', locked: !canBuy(it, tier), owned: s.owned.filter((o) => o.id === it.id && !o.giftTo).length, gifted: s.gifts.some((g) => g.id === it.id && g.to === comp.key && g.on === today), icon: art(`store/items/${it.id}.png`), reaction: r ? L(...r) : '', kidsLike: kids.filter((k) => it.tags.some((t) => kidLikes.get(k.id)!.includes(t))).map((k) => k.id) };
    }),
    storage: storeOwned(sid).slice(-60).reverse().map((o) => { const it = itemById(o.id); return { id: o.id, name: it ? L(it.ko, it.en) : o.id, on: o.on }; }),
    chat: chat.slice(-30), asking,
    kids, // 자식에게 선물(2026-10-30)
  };
}
const push = () => safeSend(win, 'storeState', storeView());

export function openStore(c?: Companion): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 갈 수 있습니다.', 'Load a save first.') };
  const nc = c && c.kind !== 'alone' ? c : { kind: 'alone' as const, key: '', name: '' };
  if (nc.key !== comp.key) { talk = null; chat = []; } comp = nc; artSeen.clear();
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#0d0a08', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'store.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: storeView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: storeView() });
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };
function buy(sid: string, id: string): { it: NonNullable<ReturnType<typeof itemById>>; price: number } {
  const it = itemById(id); if (!it) throw new Error(L('그런 물건이 없습니다.', 'No such item.'));
  const s = saveOf(sid), tier = tierOf(s.spent); if (!canBuy(it, tier)) throw new Error(L(`${TIERS[it.vip!].ko} 등급부터 살 수 있는 한정품입니다.`, `A limited item for ${TIERS[it.vip!].en} members and above.`));
  const price = priceFor(it, tier); if (!spendFromVault(sid, price, `store: ${it.en}`)) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${price}).`, `Not enough credits in the vault (need ${price}).`));
  s.spent += price; return { it, price };
}
export function registerStore(): void {
  ipcMain.handle('storeOpen', () => openStore());
  ipcMain.handle('storeState', () => storeView());
  ipcMain.handle('storeClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  ipcMain.handle('storeBlocked', () => { const l = BLOCKED_LINES[blockedN++ % BLOCKED_LINES.length]; return L(l[0], l[1]); });
  ipcMain.handle('storeBuy', (_e, id: unknown) => {
    try { const sid = need(), was = tierOf(saveOf(sid).spent), { it, price } = buy(sid, String(id)), s = saveOf(sid); s.owned.push({ id: it.id, on: ctx.gameDate || '' }); save(); push(); storeHooks.changed(sid); if (price >= PAP.shopping) paparazziSnap('shopping', { amount: price.toLocaleString() });
      const now = tierOf(s.spent); return ok({ bought: STORE_FIT[it.id] ? L(`${it.ko} 구입(${price}) — 개인실이 한결 편안해졌습니다(가구 편의는 침실의 🛋 단추에서).`, `Bought ${it.en} (${price}) — your private rooms feel more comfortable (see 🛋 furniture comfort in the bedroom).`) : L(`${it.ko} 구입(${price}) — 침실 보관함으로 보냈습니다.`, `Bought ${it.en} (${price}) — sent to your bedroom storage.`), tierUp: now > was ? L(`귀빈 등급이 ${TIERS[now].ko}(으)로 올랐습니다!`, `Your VIP tier is now ${TIERS[now].en}!`) : '' });
    } catch (e) { return err(e); }
  });
  /** 41층: 사서 바로 함께 온 연인·배우자에게 선물. */
  ipcMain.handle('storeGift', (_e, id: unknown) => {
    try {
      const sid = need(); if (comp.kind !== 'partner') throw new Error(L('선물은 함께 온 연인·배우자에게만 줄 수 있습니다.', 'You can only give gifts to the partner who came with you.'));
      const pre = itemById(String(id)); if (!pre || pre.floor !== 41) throw new Error(L('선물은 41층 물건만 됩니다.', 'Only items from floor 41 can be given as gifts.'));
      const s = saveOf(sid), today = ctx.gameDate || '', rep = s.gifts.some((g) => g.id === pre.id && g.to === comp.key && g.on === today), delta = giftDelta(pre, likesOf(comp.key), rep);
      const chk = giftToPartner(sid, comp.key, 0); if (!chk.ok) throw new Error(chk.error);
      const { it, price } = buy(sid, pre.id), g = giftToPartner(sid, comp.key, delta);
      s.owned.push({ id: it.id, on: today, giftTo: comp.key }); s.gifts.push({ to: comp.key, id: it.id, on: today, delta }); s.gifts = s.gifts.slice(-200); save(); push(); paparazziSnap('gift', { who: comp.name, item: L(it.ko, it.en) });
      return ok({ gifted: L(`${comp.name}에게 ${it.ko}을(를) 선물했습니다(${price}). 호감 ${delta >= 0 ? '+' : ''}${delta}${g.affection !== undefined ? ` → ${g.affection}` : ''}`, `You gave ${comp.name} the ${it.en} (${price}). Affection ${delta >= 0 ? '+' : ''}${delta}${g.affection !== undefined ? ` → ${g.affection}` : ''}`) });
    } catch (e) { return err(e); }
  });
  /** 자식에게 선물(2026-10-30 사용자): 어느 층 물건이든 사서 궁의 아이에게 보냄 → 부모와의 정 조금↑(아이 취향이면 더, 같은 날 같은 물건은 반). */
  ipcMain.handle('storeGiftChild', (_e, id: unknown, childId: unknown) => {
    try {
      const sid = need(), pre = itemById(String(id)), cid = String(childId ?? ''); if (!pre) throw new Error(L('그런 물건이 없습니다.', 'No such item.'));
      const chk = giftToChild(sid, cid, pre.id, 0, '', ''); if (!chk.ok) throw new Error(chk.error);
      const delta = giftDelta(pre, likesOf(`child:${cid}`), childGiftedToday(sid, cid, pre.id)), liked = pre.tags.some((t) => likesOf(`child:${cid}`).includes(t));
      const { it, price } = buy(sid, pre.id), g = giftToChild(sid, cid, it.id, delta, it.ko, it.en), today = ctx.gameDate || '';
      saveOf(sid).owned.push({ id: it.id, on: today, giftTo: `child:${cid}`, child: cid }); save(); push();
      return ok({ gifted: L(`${g.name}에게 ${it.ko}을(를) 보냈습니다(${price}). ${liked ? '무척 좋아합니다! ' : ''}정 +${delta} → ${g.bond}${g.eased ? ' · 서운함이 조금 풀렸습니다' : ''}`, `Sent ${g.name} the ${it.en} (${price}). ${liked ? 'They love it! ' : ''}Bond +${delta} → ${g.bond}${g.eased ? ' · some old hurt eased' : ''}`) });
    } catch (e) { return err(e); }
  });
  /** 43층 라운지: 함께 온 사람과 식사 대화(물을 때만 AI 한 번). */
  ipcMain.handle('storeLoungeSay', async (_e, text: unknown) => {
    const sid = ctx.curSaveId, t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!sid || comp.kind === 'alone' || comp.key === 'sec') return err(new Error(L('함께 온 사람이 없습니다.', 'Nobody came with you.')));
    if (!t) return err(new Error(L('할 말을 입력하세요.', 'Type something to say.'))); if (asking) return err(new Error(L('이미 대답을 기다리는 중입니다.', 'Already waiting for a reply.')));
    talk ??= { key: comp.key, lines: [], moved: 0, opened: ctx.gameDate || '' }; asking = true; chat.push({ who: 'me', text: t }); push();
    try {
      const scene = comp.kind === 'partner' ? 'You are having a private dinner with the empire\'s leader (the player), your partner, at the rooftop sky lounge on the 43rd floor of the capital\'s grand department store, a candle-lit table by the window over the night city.' : 'You are having a private dinner with the empire\'s leader (the player) at the rooftop sky lounge on the 43rd floor of the capital\'s grand department store, a quiet table by the window over the night city. It is an informal, off-duty occasion.';
      const r = await sayInPerson(sid, comp.key, talk, t, { scene });
      if (!r.ok) { chat.pop(); asking = false; return err(new Error(String(r.error ?? ''))); }
      chat.push({ who: 'them', text: String(r.reply ?? '') }); asking = false; return ok();
    } catch (e) { chat.pop(); return err(e); } finally { asking = false; push(); }
  });
}
export const _storeTest = { storeView, saveOf, setComp: (c: Companion) => { comp = c; } };
