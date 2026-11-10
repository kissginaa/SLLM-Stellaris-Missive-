// 펫샵 창(2026-10-30, 계획서 8·10번). 규칙·자료: src/petshop.ts · 화면: ui/petshop.html · 입구: 외출 지도 → 펫샵(openPetshop, 동행을 넘겨받음).
// 값은 통치자 개인 금고에서(spendFromVault). 산 아이는 세이브별 목록(침실이 생기면 어항·동물 자리에 들어감). 돌봄 없음.
// 함께 온 사람은 동물마다 취향 반응 한 줄(AI 없음). 연인·배우자가 마음에 들어 한 아이를 사면 호감 조금(giftToPartner). 게임 명령 없음.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { safeSend } from '../safe-send';
import type { Companion } from '../outing';
import { ANIMALS, KEEPER, KEEPER_LINES, TOUCH_LINES, FISH_MAX, PET_MAX, animalById, rareOfDay, petLikesOf, petReactionOf, pickDelta, cleanName, type Animal } from '../petshop';
import { vaultBalance, spendFromVault } from './vault-app';
import { giftToPartner } from './romance-app';

interface Owned { uid: string; id: string; name: string; on: string }
interface PetSave { spent: number; owned: Owned[]; picks: Array<{ to: string; id: string; on: string; delta: number }>; n: number }
const file = () => path.join(app.getPath('userData'), 'sllm_petshop.json');
let data: { saves: Record<string, PetSave> } | null = null;
function all() {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = { saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'petshop', error: e }); data = { saves: {} }; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'petshop', error: e }); } }
const saveOf = (sid: string): PetSave => { const s = (all().saves[sid] ??= { spent: 0, owned: [], picks: [], n: 0 }); s.owned ??= []; s.picks ??= []; s.spent ??= 0; s.n ??= 0; return s; };
/** 들여놓은 아이들(침실 쪽에서 읽음). */
export const petshopOwned = (sid: string): Array<Owned & { kind: 'fish' | 'pet' }> => saveOf(sid).owned.map((o) => ({ ...o, kind: animalById(o.id)?.kind ?? 'pet' }));
const countOf = (sid: string, kind: 'fish' | 'pet') => petshopOwned(sid).filter((o) => o.kind === kind).length;

let win: BrowserWindow | null = null, comp: Companion = { kind: 'alone', key: '', name: '' }, touchN = 0;
const artSeen = new Map<string, boolean>();
const art = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_m, k) => String(v[k] ?? ''));
const line = (k: keyof typeof KEEPER_LINES, v: Record<string, string | number> = {}) => fill(L(...KEEPER_LINES[k]), v);
const nameOf = (a: Animal) => L(a.ko, a.en);

export function petshopView() {
  const sid = ctx.curSaveId || ''; if (!sid) return { sid: '', ready: false };
  const s = saveOf(sid), today = ctx.gameDate || '', rare = rareOfDay(sid, today), liked = comp.key && comp.key !== 'sec' ? petLikesOf(comp.key) : [];
  const card = (a: Animal) => {
    const r = liked.length ? petReactionOf(a, liked, comp.name) : null;
    return { id: a.id, kind: a.kind, name: nameOf(a), about: L(a.aboutKo, a.aboutEn), price: a.price, rare: !!a.rare, owned: s.owned.filter((o) => o.id === a.id).length, icon: art(`petshop/items/${a.id}.png`), reaction: r ? L(...r.line) : '', loves: (r?.hit ?? 0) > 0 };
  };
  return {
    sid, ready: true, vault: vaultBalance(sid), comp, partner: comp.kind === 'partner',
    keeper: { name: L(KEEPER.ko, KEEPER.en), greet: comp.kind !== 'alone' ? line('greetWith', { name: comp.name }) : line('greet'), rare: line('rare', { animal: nameOf(rare) }), bye: line('bye') },
    art: { bg: art('petshop/bg.webp') ?? art('assets/outing/outing-petshop.webp'), keeper: art('petshop/keeper.png') },
    fishMax: FISH_MAX, petMax: PET_MAX, fishN: countOf(sid, 'fish'), petN: countOf(sid, 'pet'),
    rare: { ...card(rare), soldToday: s.owned.some((o) => o.id === rare.id && o.on === today) },
    animals: ANIMALS.map(card),
    home: petshopOwned(sid).map((o) => { const a = animalById(o.id); return { uid: o.uid, id: o.id, kind: o.kind, species: a ? nameOf(a) : o.id, name: o.name, on: o.on, icon: art(`petshop/items/${o.id}.png`) }; }),
  };
}
const push = () => safeSend(win, 'petshopState', petshopView());

export function openPetshop(c?: Companion): { ok: boolean; error?: string } {
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 갈 수 있습니다.', 'Load a save first.') };
  comp = c && c.kind !== 'alone' ? c : { kind: 'alone', key: '', name: '' }; artSeen.clear();
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1400, Math.round(area.width * 0.88)), height: Math.min(900, Math.round(area.height * 0.9)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#0b1210', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'petshop.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra, state: petshopView() });
const err = (e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : String(e), state: petshopView() });
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };

/** 사기: 오늘의 희귀종은 그날 한 번만. 한도 넘으면 주인이 막음. 애완동물은 이름 필수. */
export function buyAnimal(sid: string, id: string, rawName: unknown): { msg: string; delta: number; affection?: number } {
  const today = ctx.gameDate || '', a = animalById(id); if (!a) throw new Error(L('그런 아이가 없습니다.', 'No such animal.'));
  const s = saveOf(sid);
  if (a.rare) { if (rareOfDay(sid, today).id !== a.id) throw new Error(L('그 아이는 오늘 가게에 없습니다.', 'That one is not in the shop today.')); if (s.owned.some((o) => o.id === a.id && o.on === today)) throw new Error(L('오늘 들어온 아이는 이미 데려가셨어요.', 'You already took today\'s arrival home.')); }
  if (a.kind === 'fish' && countOf(sid, 'fish') >= FISH_MAX) throw new Error(line('fullFish', { n: FISH_MAX }));
  if (a.kind === 'pet' && countOf(sid, 'pet') >= PET_MAX) throw new Error(line('fullPet', { n: PET_MAX }));
  const name = cleanName(rawName); if (a.kind === 'pet' && !name) throw new Error(L('애완동물은 이름을 지어 주세요.', 'Please give your pet a name.'));
  let delta = 0, rep = false;
  if (comp.kind === 'partner') { rep = s.picks.some((p) => p.to === comp.key && p.on === today); delta = pickDelta(petReactionOf(a, petLikesOf(comp.key), comp.name).hit, rep); if (delta) { const chk = giftToPartner(sid, comp.key, 0); if (!chk.ok) delta = 0; } }
  if (!spendFromVault(sid, a.price, `petshop: ${a.en}`)) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${a.price}).`, `Not enough credits in the vault (need ${a.price}).`));
  s.spent += a.price; s.owned.push({ uid: `p${++s.n}`, id: a.id, name, on: today });
  let affection: number | undefined; if (delta) { const g = giftToPartner(sid, comp.key, delta); affection = g.affection; s.picks.push({ to: comp.key, id: a.id, on: today, delta }); s.picks = s.picks.slice(-200); }
  save();
  const who = name || nameOf(a), base = line('buy', { name: who });
  return { msg: delta ? base + ' ' + L(`${comp.name}이(가) 무척 기뻐합니다 — 호감 +${delta}${affection !== undefined ? ` → ${affection}` : ''}`, `${comp.name} is delighted — affection +${delta}${affection !== undefined ? ` → ${affection}` : ''}`) : base, delta, affection };
}
export function registerPetshop(): void {
  ipcMain.handle('petshopOpen', () => openPetshop());
  ipcMain.handle('petshopState', () => petshopView());
  ipcMain.handle('petshopClose', () => { if (win && !win.isDestroyed()) win.close(); win = null; return true; });
  ipcMain.handle('petshopBuy', (_e, id: unknown, name: unknown) => { try { const r = buyAnimal(need(), String(id), name); push(); return ok({ bought: r.msg }); } catch (e) { return err(e); } });
  /** 구경: 쓰다듬기·먹이 구경 한 줄(돈·기록 없음). */
  ipcMain.handle('petshopTouch', (_e, id: unknown) => { const a = animalById(String(id)); if (!a) return ''; const ls = TOUCH_LINES[a.kind], l = ls[touchN++ % ls.length]; return fill(L(l[0], l[1]), { name: nameOf(a) }); });
  /** 이름 바꾸기. */
  ipcMain.handle('petshopRename', (_e, uid: unknown, name: unknown) => {
    try { const sid = need(), o = saveOf(sid).owned.find((x) => x.uid === String(uid)); if (!o) throw new Error(L('그런 아이가 없습니다.', 'No such animal.')); const n = cleanName(name); if (!n && animalById(o.id)?.kind === 'pet') throw new Error(L('애완동물은 이름이 있어야 합니다.', 'A pet needs a name.')); o.name = n; save(); push(); return ok(); } catch (e) { return err(e); }
  });
  /** 다른 집으로 보내기(자리 비우기, 돈은 돌아오지 않음). */
  ipcMain.handle('petshopRehome', (_e, uid: unknown) => {
    try { const sid = need(), s = saveOf(sid), i = s.owned.findIndex((x) => x.uid === String(uid)); if (i < 0) throw new Error(L('그런 아이가 없습니다.', 'No such animal.')); const [o] = s.owned.splice(i, 1), a = animalById(o.id); save(); push();
      return ok({ msg: L(`${o.name || (a ? a.ko : o.id)}(은)는 좋은 새 집으로 갔습니다.`, `${o.name || (a ? a.en : o.id)} has gone to a good new home.`) }); } catch (e) { return err(e); }
  });
}
export const _petshopTest = { petshopView, saveOf, buyAnimal, setComp: (c: Companion) => { comp = c; } };
