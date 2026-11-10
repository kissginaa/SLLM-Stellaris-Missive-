// 스텔라체스 — 카지노 정거장의 함대 오토배틀러(2026-10-31 사용자 결정: 함선 유닛 · 카지노 정거장 · 재미로만). 규칙: src/stellachess.ts.
// 바이인은 통치자 개인 금고에서, 배당은 금고로. 게임 명령·AI 없음. 진행 중인 판은 세이브별로 저장(앱을 껐다 켜도 이어 함).
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { vaultBalance, spendFromVault, earnToVault } from './vault-app';
import { SC, SHIPS, SYNERGY, ITEMS, FAMILY_NAMES, ROLE_NAMES, ORIGIN_NAMES, originsOf, BOSSES, BOSS_ALTS, WEAPON_NAMES, weaponOf, CHAOS, chaosOf, finalScore, shipById, newRun, buy, sell, reroll, buyXp, move, equip, takeItem, fight, retreat, synergies, payoutOf, payoutMul, sellValue, enemyFleet, isBoss, boardCount, makeFighters, type Run, type Unit, type ItemId } from '../stellachess';

/** 카지노(파파라치 사진감)에 따고 잃은 돈을 알림 — casino-app 이 채움(가져오기 고리를 피하려고 훅). */
export const scHooks: { net: (sid: string, delta: number) => void } = { net: () => {} };

interface Rec { runs: number; best: number; won: number; net: number; hi?: number; hiChaos?: number; wonChaos?: number; hiHard?: number; wonHard?: number }
interface Store { [sid: string]: { run: Run | null; rec: Rec } }
const file = () => path.join(app.getPath('userData'), 'sllm_stellachess.json');
let store: Store | null = null;
function load(): Store { if (store) return store; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); store = j && typeof j === 'object' ? j : {}; } catch { store = {}; } return store!; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(load())); } catch { /* 저장 실패는 조용히(다음에 다시) */ } }
const slot = (sid: string) => { const s = load(); return (s[sid] ??= { run: null, rec: { runs: 0, best: 0, won: 0, net: 0 } }); };
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.')); return sid; };

const ERR: Record<string, [string, string]> = {
  GOLD: ['자재가 모자랍니다.', 'Not enough materials.'], BENCH: ['대기열이 가득 찼습니다. 함선을 팔거나 배치하세요.', 'Your reserve is full. Sell or deploy a ship.'],
  FULL: ['함대 규모만큼 배치했습니다. 함대 규모를 키우세요.', 'Your fleet is at its size limit. Raise fleet size.'], EMPTY: ['그 자리는 비어 있습니다.', 'That slot is empty.'],
  MAX: ['함대 규모가 최대입니다.', 'Fleet size is at maximum.'], ITEMS: ['함선 하나에 아이템은 3개까지입니다.', 'Up to 3 items per ship.'],
  OVER: ['이 판은 끝났습니다.', 'This run is over.'], ITEM: ['먼저 보급 부품을 고르세요.', 'Pick a supply component first.'], NOBOARD: ['배치된 함선이 없습니다.', 'No ships are deployed.'],
  NOBOSS: ['보스를 하나 이상 이긴 뒤에 철수할 수 있습니다.', 'You can retreat after beating at least one boss.'], NORUN: ['진행 중인 판이 없습니다.', 'No run in progress.'],
};
const msg = (e: unknown) => { const k = String((e as Error)?.message || e); return ERR[k] ? L(...ERR[k]) : k; };

const unitView = (u: Unit | null, where: 'board' | 'bench', i: number) => { if (!u) return null; const d = shipById(u.id)!; return { uid: u.uid, id: u.id, star: u.star, items: u.items, where, i, name: L(d.ko, d.en), cost: d.cost, fam: d.fam, wpn: weaponOf(d.id), role: d.role, orig: originsOf(d.id), sell: sellValue(u) }; };
// 그림(2026-11-03, 18번 의뢰서): ui/stellachess/ships/<함선 id>.png(위에서 본 함선, 기수가 오른쪽) · shroud_avatar.png · arena.webp(전장 배경). 없으면 앱이 그린 모양.
const artSeen = new Map<string, boolean>();
const art = (rel: string): string | null => { let ok = artSeen.get(rel); if (ok === undefined) { ok = fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)); artSeen.set(rel, ok); } return ok ? rel : null; };
export function scCatalog() {
  return {
    art: { ships: Object.fromEntries([...SHIPS.map((x) => x.id), 'shroud_avatar'].map((id) => [id, art(`stellachess/ships/${id}.png`)])), arena: art('stellachess/arena.webp'), items: Object.fromEntries(Object.keys(ITEMS).map((id) => [id, art(`stellachess/items/${id}.png`)])) },
    ships: SHIPS.map((s) => ({ id: s.id, name: L(s.ko, s.en), cost: s.cost, big: s.big ?? 0, fam: s.fam, wpn: weaponOf(s.id), role: s.role, orig: originsOf(s.id), hp: s.hp, sh: s.sh, ar: s.ar, dmg: s.dmg, cd: s.cd })),
    fams: Object.fromEntries(Object.entries({ ...FAMILY_NAMES, ...WEAPON_NAMES }).map(([k, v]) => [k, L(...v)])), roles: Object.fromEntries(Object.entries(ROLE_NAMES).map(([k, v]) => [k, L(...v)])), origins: Object.fromEntries(Object.entries(ORIGIN_NAMES).map(([k, v]) => [k, L(...v)])),
    syn: Object.fromEntries(Object.entries(SYNERGY).map(([k, v]) => [k, { at: v.at, text: L(v.ko, v.en) }])),
    items: Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, { name: L(v.ko, v.en), text: L(v.dko, v.den), ...(v.parts ? { parts: v.parts } : {}) }])),
    rules: { rounds: SC.rounds, bosses: SC.bosses, payout: SC.payout, payoutHard: SC.payoutHard, hard: SC.hard, hardScore: SC.hardScore, deathShare: SC.deathShare, lives: SC.lives, chaosPay: SC.chaosPay, chaos: Object.fromEntries(Object.entries(CHAOS).map(([k, v]) => [k, { name: L(v[0], v[1]), text: L(v[2], v[3]) }])), minBuyIn: SC.minBuyIn, maxBuyIn: SC.maxBuyIn, reroll: SC.reroll, xpCost: SC.xpCost, xpBuy: SC.xpBuy, odds: SC.odds },
    bossNames: Object.fromEntries(Object.entries(BOSSES).map(([k, v]) => [k, BOSS_ALTS[Number(k)] ? L(`${v.ko} 또는 ${BOSS_ALTS[Number(k)].ko}`, `${v.en} or ${BOSS_ALTS[Number(k)].en}`) : L(v.ko, v.en)])),
  };
}
export function scView() {
  const sid = ctx.curSaveId; if (!sid) return { sid: '', balance: 0, run: null, rec: null };
  const S = slot(sid), r = S.run;
  return {
    sid, balance: vaultBalance(sid), rec: S.rec,
    run: r ? (() => { const en = enemyFleet(r.seed, r.round);
      const cm = chaosOf(r); return { buyIn: r.buyIn, round: r.round, lives: r.lives ?? SC.lives, maxLives: SC.lives, hard: !!r.hard, score: finalScore(r), chaos: !!r.chaos, chaosNow: cm ? { key: cm, name: L(CHAOS[cm][0], CHAOS[cm][1]), text: L(CHAOS[cm][2], CHAOS[cm][3]) } : null, gold: r.gold, level: r.level, xp: r.xp, xpNext: r.level < SC.maxLevel ? SC.xpNeed[r.level + 1] : null, locked: r.locked, items: r.items, itemOffer: r.itemOffer, over: r.over, won: r.won, retreated: r.retreated, bossBeaten: r.bossBeaten, streak: r.streak,
        board: r.board.map((u, i) => unitView(u, 'board', i)), bench: r.bench.map((u, i) => unitView(u, 'bench', i)), cap: r.level, onBoard: boardCount(r),
        shop: r.shop.map((id) => (id ? { id, name: L(shipById(id)!.ko, shipById(id)!.en), cost: shipById(id)!.cost, fam: shipById(id)!.fam, wpn: weaponOf(id), role: shipById(id)!.role, orig: originsOf(id) } : null)),
        spores: r.spores ?? 0, plunder: r.plunder ?? 0, forge: r.forge ?? {},
        syn: synergies(r.board).map((s) => ({ ...s, at: SYNERGY[s.key].at })), odds: SC.odds[r.level],
        payNow: payoutOf(r, false), payDeath: payoutOf(r, true), mulNow: payoutMul(r.bossBeaten, !!r.hard),
        next: { name: L(...en.name), boss: en.boss, units: en.units.map((u, i) => (u ? { id: u.id, star: u.star, slot: i, name: L(shipById(u.id)!.ko, shipById(u.id)!.en) } : null)) }, nextBoss: SC.bosses.find((b) => b >= r.round && isBoss(b)) ?? null };
    })() : null,
  };
}
const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, state: scView(), ...extra });
const err = (e: unknown) => ({ ok: false, error: msg(e), state: scView() });
function runOf(sid: string): Run { const r = slot(sid).run; if (!r) throw new Error('NORUN'); return r; }
/** 판이 끝나면 배당·기록. 돌려줄 돈. */
function settle(sid: string, r: Run, payout: number): number {
  const S = slot(sid); S.rec.runs++; S.rec.best = Math.max(S.rec.best, r.bossBeaten); if (r.won) { if (r.chaos) S.rec.wonChaos = (S.rec.wonChaos ?? 0) + 1; else S.rec.won++; if (r.hard) S.rec.wonHard = (S.rec.wonHard ?? 0) + 1; } const fsc = finalScore(r); if (r.chaos) S.rec.hiChaos = Math.max(S.rec.hiChaos ?? 0, fsc); else S.rec.hi = Math.max(S.rec.hi ?? 0, fsc); if (r.hard) S.rec.hiHard = Math.max(S.rec.hiHard ?? 0, fsc); S.rec.net += payout - r.buyIn;
  if (payout > 0) { earnToVault(sid, payout, 'Stellachess payout'); scHooks.net(sid, payout); }
  return payout;
}

export function registerStellaChess(): void {
  ipcMain.handle('scState', () => ({ ...scView(), catalog: scCatalog() }));
  ipcMain.handle('scStart', (_e, buyIn: unknown, chaos?: unknown, hard?: unknown) => { try { const sid = need(), b = Math.round(Number(buyIn)), S = slot(sid), ch = chaos === true, hd = hard === true;
      if (ch && !(S.rec.won > 0)) throw new Error(L('혼돈 모드는 일반 모드를 한 번 완주한 뒤에 열립니다.', 'Chaos mode unlocks after you finish normal mode once.'));
      if (S.run && !S.run.over) throw new Error(L('이미 진행 중인 판이 있습니다.', 'A run is already in progress.'));
      if (!Number.isSafeInteger(b) || b < SC.minBuyIn || b > SC.maxBuyIn) throw new Error(L(`바이인은 ${SC.minBuyIn}~${SC.maxBuyIn} 사이입니다.`, `The buy-in must be ${SC.minBuyIn}–${SC.maxBuyIn}.`));
      if (!spendFromVault(sid, b, 'Stellachess buy-in')) throw new Error(L(`금고에 크레딧이 모자랍니다(필요 ${b}).`, `Not enough credits in the vault (need ${b}).`));
      scHooks.net(sid, -b); S.run = newRun((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, b, ch, hd); save(); return ok(); } catch (e) { return err(e); } });
  ipcMain.handle('scAct', (_e, a: { op?: unknown; i?: unknown; from?: unknown; to?: unknown; item?: unknown; where?: unknown }) => { try { const sid = need(), r = runOf(sid); if (r.over) throw new Error('OVER');
      const w = (x: unknown): 'board' | 'bench' => (x === 'board' ? 'board' : 'bench'), n = (x: unknown) => Math.max(0, Math.floor(Number(x)) || 0), pos = (x: unknown) => { const o = (x && typeof x === 'object' ? x : {}) as { where?: unknown; i?: unknown }; return { where: w(o.where), i: n(o.i) }; };
      switch (a?.op) {
        case 'buy': buy(r, n(a.i)); break; case 'sell': { const p = pos(a.from); sell(r, p.where, p.i); break; }
        case 'reroll': reroll(r); break; case 'xp': buyXp(r); break; case 'lock': r.locked = !r.locked; break;
        case 'move': move(r, pos(a.from), pos(a.to)); break; case 'equip': { const p = pos(a.to), made = equip(r, n(a.item), p.where, p.i); if (made) { save(); return ok({ made: L(ITEMS[made].ko, ITEMS[made].en) }); } break; }
        case 'take': takeItem(r, n(a.i)); break;
        default: throw new Error('BAD_OP');
      }
      save(); return ok(); } catch (e) { return err(e); } });
  ipcMain.handle('scFight', () => { try { const sid = need(), r = runOf(sid), mine = makeFighters(0, r.board, r.forge ?? {}), round = r.round, res = fight(r);
      const out = { round, enemy: L(...res.enemy), boss: res.boss, won: res.won, loss: res.loss, gold: res.gold, payout: res.payout, bonus: { ...res.bonus, ...(res.bonus.sporeItem ? { sporeItemName: L(ITEMS[res.bonus.sporeItem].ko, ITEMS[res.bonus.sporeItem].en) } : {}), ...(res.bonus.drop ? { dropName: L(ITEMS[res.bonus.drop].ko, ITEMS[res.bonus.drop].en) } : {}) }, battle: { ...res.battle, fighters: res.battle.fighters.map((f) => ({ ...f, name: L(...f.name) })) }, mineCount: mine.length };
      if (res.payout !== null) settle(sid, r, res.payout);
      save(); return ok({ fight: out }); } catch (e) { return err(e); } });
  ipcMain.handle('scRetreat', () => { try { const sid = need(), r = runOf(sid), p = retreat(r); settle(sid, r, p); save(); return ok({ payout: p }); } catch (e) { return err(e); } });
  /** 포기: 보스를 이긴 단계의 절반만(패배와 같음). */
  ipcMain.handle('scForfeit', () => { try { const sid = need(), r = runOf(sid); if (r.over) throw new Error('OVER'); r.over = true; const p = payoutOf(r, true); settle(sid, r, p); save(); return ok({ payout: p }); } catch (e) { return err(e); } });
  /** 끝난 판 치우기(결과 화면 닫기). */
  ipcMain.handle('scClear', () => { try { const sid = need(), S = slot(sid); if (S.run && S.run.over) S.run = null; save(); return ok(); } catch (e) { return err(e); } });
}
export const _scTest = { msg, ERR };
export type { ItemId };
