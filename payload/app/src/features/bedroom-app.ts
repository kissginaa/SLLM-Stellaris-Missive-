// 통치자 침실 창(2026-10-30, 계획서 8번). 규칙·자료: src/bedroom.ts · 화면: ui/bedroom.html · 입구: 개인실 책상 위 열쇠(private-rooms.js → bedroomOpen(성향)).
// 물건은 백화점(storeOwned)·암시장(blackmarketOwned)·펫샵(petshopOwned)에서 읽기만 함. 침실은 자리 배치·액자 그림만 저장(sllm_bedroom.json).
// 배우자·연인 대화: 물을 때만 AI 한 번(persona-app sayInPerson — 백화점 라운지와 같은 길). 비서는 개인실 소파·비서실에서.
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import type { Talk } from '../persona';
import { COMFORT, comfortTier, comfortNext, comfortCommand, STORE_FIT } from '../bedroom';
import { link } from '../app/game-link';
import { terminalRequest } from './terminal';
import { storeHooks } from './store-app';
import { registerSecFacts } from './secretary-live';
import { SLOTS, CUSTOM_FRAMES, PET_LINES, FISH_LINES, EMPTY_ROOM_LINES, TANK_MAX, RUG_MAX, slotById, fits, fitOf, place, prune, bedroomScene, safeFrameName, type Layout, type SlotId } from '../bedroom';
import { itemById } from '../store';
import { itemOf as bmItemOf } from '../blackmarket';
import { animalById } from '../petshop';
import { storeOwned } from './store-app';
import { blackmarketOwned } from './blackmarket-app';
import { petshopOwned } from './petshop-app';
import { outingPartners, SEC_KEY } from './romance-app';
import { sayInPerson } from './persona-app';

interface BedSave { layout: Layout; frames: Record<string, string>; comfort?: number } // comfort: 게임에 붙여 둔 가구 편의 단계(2026-10-31)
const file = () => path.join(app.getPath('userData'), 'sllm_bedroom.json');
const frameDir = () => path.join(app.getPath('userData'), 'bedroom-frames');
let data: { saves: Record<string, BedSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'bedroom', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'bedroom', error: e }); } }
const saveOf = (sid: string): BedSave => { const s = (all().saves[sid] ??= { layout: {}, frames: {} }); s.layout ??= {}; s.frames ??= {}; return s; };

const THEMES = ['authoritarian', 'egalitarian', 'xenophile', 'xenophobe', 'militarist', 'pacifist', 'spiritualist', 'materialist'];
let win: BrowserWindow | null = null, theme = 'authoritarian', guest: { key: string; name: string; stage: string } | null = null, talk: Talk | null = null, chat: Array<{ who: 'me' | 'them'; text: string }> = [], asking = false, touchN = 0;
const artSeen = new Map<string, boolean>();
const art = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_m, k) => String(v[k] ?? ''));

/** 가진 물건(침실에 놓을 수 있는 것만) — ref: 'store:<id>#<n>' · 'bm:<uid>'. */
function things(sid: string) {
  const out: Array<{ ref: string; kind: string; name: string; icon: string | null; room?: string | null; custom: boolean; fake?: boolean }> = [], seen: Record<string, number> = {};
  for (const o of storeOwned(sid)) { const it = itemById(o.id); if (!it || !fitOf(`store:${o.id}`)) continue; const n = (seen[o.id] = (seen[o.id] ?? -1) + 1);
    out.push({ ref: `store:${o.id}#${n}`, kind: fitOf(`store:${o.id}`)!, name: L(it.ko, it.en), icon: art(`store/items/${o.id}.png`), room: art(`store/room/${o.id}.png`), custom: CUSTOM_FRAMES.has(o.id) }); } // room: 방에 세우는 그림(14_침실_가구, 2026-10-31)
  for (const o of blackmarketOwned(sid)) { const it = bmItemOf(o.id); if (!it || !o.uid) continue;
    out.push({ ref: `bm:${o.uid}`, kind: 'shelf', name: L(it.ko, it.en) + (o.kind === 'creature' ? L(' (사육장)', ' (terrarium)') : ''), icon: art(`blackmarket/items/${o.id}.png`), custom: false, ...(o.fake !== undefined ? { fake: o.fake } : {}) }); }
  return out;
}
const fitsRef = (slot: string, ref: string) => { const s = slotById(slot); return !!s && fits(s, ref); };

function partners(sid: string) { try { return outingPartners(sid).filter((p) => p.key !== SEC_KEY && p.name); } catch { return []; } }

export function bedroomView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const s = saveOf(sid), have = things(sid), alive = new Set(have.map((t) => t.ref));
  // 같은 물건 id 의 #n 은 보관함 순서라 팔거나 선물하면 바뀔 수 있음 → 살아 있는 것만 남김.
  const lay = prune(s.layout, alive); if (Object.keys(lay).length !== Object.keys(s.layout).length) { s.layout = lay; save(); }
  const byRef = new Map(have.map((t) => [t.ref, t]));
  const pets = petshopOwned(sid), sec = (() => { try { return outingPartners(sid).some((p) => p.key === SEC_KEY); } catch { return false; } })();
  return {
    sid, ready: true, theme, comfort: comfortView(sid),
    art: { bg: art(`assets/private-rooms/private/${theme}-bedroom.webp`), full: !!art(`assets/private-rooms/private/${theme}-bedroom.webp`), bed: art('store/room/default_bed.png') }, // full: 가구까지 그려진 완성 침실(17번 의뢰서, 2026-10-31 받음) — 기본 침대를 얹지 않고 그림 속 금고를 누름
    slots: SLOTS.map((sl) => { const ref = lay[sl.id], t = ref ? byRef.get(ref) : null, fr = s.frames[sl.id];
      return { id: sl.id, kind: sl.kind, name: L(sl.ko, sl.en), ref: ref ?? null, item: t ? { name: t.name, icon: t.icon, room: t.room ?? null, custom: t.custom, fake: t.fake } : null, picture: t?.custom && fr && fs.existsSync(fr) ? pathToFileURL(fr).href : null }; }),
    things: have.map((t) => ({ ...t, at: (Object.entries(lay).find(([, v]) => v === t.ref) ?? [null])[0] })),
    fish: pets.filter((p) => p.kind === 'fish').slice(0, TANK_MAX).map((p) => { const a = animalById(p.id); return { uid: p.uid, id: p.id, name: p.name || (a ? L(a.ko, a.en) : p.id), icon: art(`petshop/items/${p.id}.png`) }; }),
    pets: pets.filter((p) => p.kind === 'pet').slice(0, RUG_MAX).map((p) => { const a = animalById(p.id); return { uid: p.uid, id: p.id, name: p.name || (a ? L(a.ko, a.en) : p.id), species: a ? L(a.ko, a.en) : p.id, icon: art(`petshop/items/${p.id}.png`) }; }),
    partners: partners(sid).map((p) => ({ key: p.key, name: p.name, stage: p.stage })), secretaryPartner: sec,
    guest, chat: chat.slice(-30), asking,
    empty: { tank: L(...EMPTY_ROOM_LINES.tank), rug: L(...EMPTY_ROOM_LINES.rug), spouse: L(...EMPTY_ROOM_LINES.spouse) },
  };
}
const push = () => safeSend(win, 'bedroomState', bedroomView());

// ---- 가구 편의(2026-10-31): 백화점 40·42층 물건 종류 수 → 통치자 컨디션 단계. 단계가 바뀌었거나(구입) 이번 실행에서 처음 침실에 들어갈 때만 게임에 보냄.
/** 모은 가구·장식 종류 수(같은 물건 여러 개는 1종, 선물한 것 제외). */
export const comfortKinds = (sid: string): number => new Set(storeOwned(sid).filter((o) => STORE_FIT[o.id]).map((o) => o.id)).size;
const comfortSent = new Set<string>(); let comfortBusy = false;
export async function syncComfort(sid: string, force = false): Promise<void> {
  if (!sid || sid !== ctx.curSaveId || comfortBusy || !ctx.gameRunning || !link.sessionReady) return;
  const s = saveOf(sid), tier = comfortTier(comfortKinds(sid));
  if (!force && (s.comfort ?? 0) === tier && comfortSent.has(sid)) return;
  if (!tier && !(s.comfort ?? 0) && !force) { comfortSent.add(sid); return; } // 붙인 적 없고 0단계면 보낼 것 없음
  comfortBusy = true;
  try { const req = ++link.reqCounter, m = await terminalRequest(comfortCommand(req, sid, tier), 'BEDCOMF', req); if (m.kv.status === 'applied') { s.comfort = tier; comfortSent.add(sid); save(); push(); } }
  catch (e) { logDiagnostic('warn', 'bedroom.comfort_failed', { error: (e as Error).message }); }
  finally { comfortBusy = false; }
}
function comfortView(sid: string) { const n = comfortKinds(sid), tier = comfortTier(n); return { kinds: n, tier, next: comfortNext(n), steps: [...COMFORT.steps], fx: L(...COMFORT.fx[tier]), nextFx: tier < COMFORT.steps.length ? L(...COMFORT.fx[tier + 1]) : '', applied: (saveOf(sid).comfort ?? 0) === tier }; }

export function openBedroom(t?: unknown): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 들어갈 수 있습니다.', 'Load a save first.') };
  void syncComfort(ctx.curSaveId);
  if (typeof t === 'string' && THEMES.includes(t)) theme = t; artSeen.clear();
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#07060a', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'bedroom.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) { win = null; guest = null; talk = null; chat = []; } });
  return { ok: true };
}

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: bedroomView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: bedroomView() });
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };

/** 자리에 놓기(ref 빈 값이면 치우기). 같은 물건이 다른 자리에 있으면 옮김. */
export function placeThing(sid: string, slot: string, ref: string): void {
  const sl = slotById(slot); if (!sl) throw new Error(L('그런 자리가 없습니다.', 'No such spot.'));
  if (ref) { if (!things(sid).some((t) => t.ref === ref)) throw new Error(L('그 물건을 가지고 있지 않습니다.', 'You do not own that.')); if (!fitsRef(slot, ref)) throw new Error(L('그 자리에는 놓을 수 없는 물건입니다.', 'That does not fit there.')); }
  const s = saveOf(sid); s.layout = place(s.layout, sl.id, ref); save();
}

export function registerBedroom(): void {
  storeHooks.changed = (sid) => { void syncComfort(sid); }; // 백화점에서 사면 단계가 바뀌었을 때만 게임에 반영
  registerSecFacts({ id: 'Bedroom comfort', kw: ['가구', '침실', '개인실', '컨디션', 'furniture', 'bedroom', 'comfort'], facts: (sid) => { const c = comfortView(sid); return [`Furniture comfort: ${c.kinds} kinds of store furniture/decor owned, tier ${c.tier}/4 (${COMFORT.fx[c.tier][1] || 'no bonus yet'})${c.next ? `; ${c.next} more kinds for the next tier` : ''}.`]; } });
  ipcMain.handle('bedroomOpen', (_e, t: unknown) => openBedroom(t));
  ipcMain.handle('bedroomState', () => bedroomView());
  ipcMain.handle('bedroomClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  ipcMain.handle('bedroomPlace', (_e, slot: unknown, ref: unknown) => { try { placeThing(need(), String(slot ?? ''), String(ref ?? '')); push(); return ok(); } catch (e) { return err(e); } });
  /** 빈 액자·초상화 액자: 그림 고르기 → 앱 폴더로 복사(원본은 그대로). */
  ipcMain.handle('bedroomFrame', async (e, slot: unknown) => {
    try {
      const sid = need(), sl = String(slot ?? ''), s = saveOf(sid), ref = s.layout[sl as SlotId]; if (!ref || !CUSTOM_FRAMES.has(ref.split(':')[1]?.replace(/#\d+$/, '') ?? '')) throw new Error(L('그 자리에는 그림을 넣는 액자가 없습니다.', 'There is no picture frame there.'));
      const parent = BrowserWindow.fromWebContents(e.sender) ?? win ?? undefined;
      const r = parent ? await dialog.showOpenDialog(parent, { title: L('액자에 넣을 그림', 'Picture for the frame'), properties: ['openFile'], filters: [{ name: L('그림', 'Images'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] }) : await dialog.showOpenDialog({ properties: ['openFile'] });
      if (r.canceled || !r.filePaths[0]) return ok();
      const src = r.filePaths[0], name = safeFrameName(sid, sl, path.extname(src)); if (!name) throw new Error(L('png, jpg, webp, gif 그림만 쓸 수 있습니다.', 'Only png, jpg, webp and gif images can be used.'));
      if (fs.statSync(src).size > 20 * 1024 * 1024) throw new Error(L('20MB 이하 그림을 골라 주세요.', 'Choose an image no larger than 20 MB.'));
      fs.mkdirSync(frameDir(), { recursive: true }); const dst = path.join(frameDir(), name); fs.copyFileSync(src, dst);
      const old = s.frames[sl]; if (old && old !== dst && old.startsWith(frameDir())) { try { fs.unlinkSync(old); } catch { /* 이미 없음 */ } }
      s.frames[sl] = dst; save(); push(); return ok();
    } catch (x) { return err(x); }
  });
  /** 쓰다듬기·어항 두드리기 — 한 줄(돈·기록 없음). */
  ipcMain.handle('bedroomTouch', (_e, uid: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return ''; const p = petshopOwned(sid).find((x) => x.uid === String(uid)); if (!p) return '';
    const a = animalById(p.id), name = p.name || (a ? L(a.ko, a.en) : p.id), ls = p.kind === 'fish' ? FISH_LINES : PET_LINES, l = ls[touchN++ % ls.length]; return fill(L(l[0], l[1]), { name });
  });
  /** 배우자·연인 부르기(key 빈 값이면 돌려보내기). */
  ipcMain.handle('bedroomInvite', (_e, key: unknown) => {
    try {
      const sid = need(), k = String(key ?? ''); if (!k) { guest = null; talk = null; chat = []; push(); return ok(); }
      const p = partners(sid).find((x) => x.key === k); if (!p) throw new Error(L('지금 연인·배우자가 아닙니다.', 'Not your partner or spouse.'));
      if (guest?.key !== p.key) { talk = null; chat = []; } guest = { key: p.key, name: p.name, stage: p.stage }; push(); return ok();
    } catch (e) { return err(e); }
  });
  ipcMain.handle('bedroomSay', async (_e, text: unknown) => {
    const sid = ctx.curSaveId, t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!sid || !guest) return err(new Error(L('침실에 부른 사람이 없습니다.', 'Nobody is here with you.')));
    if (!t) return err(new Error(L('할 말을 입력하세요.', 'Type something to say.'))); if (asking) return err(new Error(L('이미 대답을 기다리는 중입니다.', 'Already waiting for a reply.')));
    talk ??= { key: guest.key, lines: [], moved: 0, opened: ctx.gameDate || '' }; asking = true; chat.push({ who: 'me', text: t }); push();
    try {
      const r = await sayInPerson(sid, guest.key, talk, t, { scene: bedroomScene(guest.stage) });
      if (!r.ok) { chat.pop(); asking = false; return err(new Error(String(r.error ?? ''))); }
      chat.push({ who: 'them', text: String(r.reply ?? '') }); asking = false; return ok();
    } catch (e) { chat.pop(); return err(e); } finally { asking = false; push(); }
  });
}
export const _bedroomTest = { bedroomView, saveOf, placeThing, setTheme: (t: string) => { theme = t; } };
