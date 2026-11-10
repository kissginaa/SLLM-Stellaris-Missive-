// 하츠 오브 아이언 참고 외교 3가지(2026-10-28) 앱 쪽 — 규칙·수치: ../hoi.ts, 모드: tester-mod/common/scripted_effects/sllm_hoi.txt.
// 화면: 물자 지원 = 외교 거래판(deal-ui.js), 파벌 공작 = 대사관의 첩보 보고(office-embassy.js), 자치도 = 종속국 채널(vassal.html).
// LLM 은 쓰지 않는다(알림·연대기는 틀 문장). 게임 명령은 지급·호감·수정자·독립만.
// 가져오기 고리를 피하려고 deals-app·embassy-app 은 이 파일을 가져다 쓰고, 이 파일은 그쪽을 hoiHooks 로만 부른다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { terminalRequest, terminalReplies, terminal } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { moodNudge } from './mood-app';
import { openGameHearing } from './espionage-app';
import { addYears, addMonths, cmpDate } from '../gamedate';
import { payCommand, RES_NAME, DEAL_RES, type DealRes } from '../deals';
import { MT_OWNER, nextG, type MtEvent } from '../mtransfer';
import { mtSubscribe, mtSet, mtUnset } from './mtransfer-hub';
import { FACTION_ETHICS } from '../gamestate';
import { hoiLink } from '../app/hoi-hooks';
import {
  AID, HOI_MODS, type Aid, type AidEnemy, aidCheck, aidRange, enemyLearns, aidEnemiesCommand, hoiOpinionCommand, ctaAidDefault,
  FSUP, type FsupOp, type ForeignOp, type EthKey, isEth, ETH_KEYS, exposeChance, fsupStartCommand, fsupMoreCommand, fsupOnUsCommand, foreignTargetEthic,
  AUTO, type Autonomy, autonomyMonth, autonomyAdd, autoStage, autoFreeCommand,
} from '../hoi';

/** 다른 기능이 채워 주는 칸(가져오기 고리 방지). */
export const hoiHooks = {
  /** deals-app: 그 제국과의 거래 사정(우리 월수입 등). 못 읽으면 null */
  income: null as null | ((tid: number) => Promise<Record<DealRes, number> | null>),
  /** embassy-app: 그 제국에 대한 우리 첩보 수준 구간(0~4)과 마지막 보고 날짜 */
  intel: null as null | ((idx: number) => { band: number; date: string } | null),
};

interface SaveEntry { aids: Aid[]; ops: FsupOp[]; foreign: ForeignOp[]; auto: Record<string, Autonomy>; foreignYear: number; lastWar?: { atWar: boolean; own: number; foe: number } }
const file = () => path.join(app.getPath('userData'), 'sllm_hoi.json');
let store: Record<string, SaveEntry> | null = null;
const blank = (): SaveEntry => ({ aids: [], ops: [], foreign: [], auto: {}, foreignYear: 0 });
function all(): Record<string, SaveEntry> {
  if (store) return store; store = {};
  try {
    const o = JSON.parse(fs.readFileSync(file(), 'utf8'));
    for (const [k, v] of Object.entries((o?.saves ?? {}) as Record<string, any>)) {
      const e = blank();
      e.aids = (Array.isArray(v?.aids) ? v.aids : []).filter((a: any) => a && typeof a.id === 'string' && Number.isSafeInteger(a.tid) && DEAL_RES.includes(a.res)).slice(-40);
      e.ops = (Array.isArray(v?.ops) ? v.ops : []).filter((a: any) => a && typeof a.id === 'string' && Number.isSafeInteger(a.tid) && isEth(a.eth)).slice(-40);
      e.foreign = (Array.isArray(v?.foreign) ? v.foreign : []).filter((a: any) => a && typeof a.id === 'string' && Number.isSafeInteger(a.by) && isEth(a.eth)).slice(-20);
      if (v?.auto && typeof v.auto === 'object') for (const [i, a] of Object.entries(v.auto as Record<string, any>)) if (a && Number.isFinite(a.v)) e.auto[i] = { ...a, idx: Number(i) };
      e.foreignYear = Number.isSafeInteger(v?.foreignYear) ? v.foreignYear : 0;
      if (v?.lastWar && typeof v.lastWar === 'object') e.lastWar = v.lastWar;
      store[k] = e;
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'hoi', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'hoi', error: e }); } }
const entry = (sid: string): SaveEntry => (all()[safeKey(sid)] ??= blank());
const usName = () => ctx.playerName || L('우리', 'Us');
const resName = (r: DealRes) => L(RES_NAME[r][0], RES_NAME[r][1]);
const nameOf = (idx: number): string => terminal.items.find((c) => c.idx === idx)?.name || ctx.mailCountries.get(idx)?.name || L(`제국 #${idx}`, `Empire #${idx}`);
const today = () => ctx.gameDate || '';
const ETH_NAME: Record<EthKey, [string, string]> = { militarist: ['군국주의', 'Militarist'], pacifist: ['평화주의', 'Pacifist'], authoritarian: ['권위주의', 'Authoritarian'], egalitarian: ['평등주의', 'Egalitarian'], xenophile: ['외계종 선호', 'Xenophile'], xenophobe: ['외계종 혐오', 'Xenophobe'], materialist: ['물질주의', 'Materialist'], spiritualist: ['정신주의', 'Spiritualist'] };
const ethName = (e: EthKey) => L(ETH_NAME[e][0], ETH_NAME[e][1]);

// ---- 게임 묻기
const enemyRows = new Map<string, AidEnemy[]>();
/** 그 제국과 전쟁 중인 나라들(적국마다 우리에 대한 첩보 수준 30 이상인지). 못 찾으면 null. */
async function probeEnemies(tid: number): Promise<AidEnemy[] | null> {
  if (!ctx.gameRunning || !link.sessionReady) return null;
  const req = ++link.reqCounter, k = String(req); enemyRows.set(k, []);
  try { const m = await terminalRequest(aidEnemiesCommand(req, tid), 'AIDEND', req); if (m.kv.found !== '1') return null; return enemyRows.get(k) ?? []; }
  catch (e) { logDiagnostic('warn', 'hoi.enemies_failed', { error: (e as Error).message }); return null; }
  finally { enemyRows.delete(k); }
}
async function opinion(tid: number, mod: string): Promise<boolean> {
  const req = ++link.reqCounter;
  try { const m = await terminalRequest(hoiOpinionCommand(req, tid, mod), 'DEAL', req); return m.kv.status === 'applied' || m.kv.status === 'duplicate'; }
  catch (e) { logDiagnostic('warn', 'hoi.opinion_failed', { mod, error: (e as Error).message }); return false; }
}
async function game(cmd: (req: number) => string, end: string): Promise<string> {
  const req = ++link.reqCounter;
  try { const m = await terminalRequest(cmd(req), end, req); return String(m.kv.status ?? ''); } catch { return 'timeout'; }
}

// ---- ① 물자 지원
const probed = new Map<number, { war: boolean; enemies: AidEnemy[]; date: string }>();
/** 거래판을 열 때(deals-app): 상대가 전쟁 중인지 한 번 읽어 둔다. */
export async function aidProbe(tid: number): Promise<void> { const en = await probeEnemies(tid); if (en) probed.set(tid, { war: en.length > 0, enemies: en, date: today() }); }
/** 거래판에 넣을 물자 지원 칸. income: 거래판이 읽은 우리 월수입. */
export function aidViewFor(tid: number, income: Record<DealRes, number> | null) {
  const sid = ctx.curSaveId, e = sid ? entry(sid) : blank(), p = probed.get(tid), a = e.aids.find((x) => x.tid === tid && !x.done);
  return {
    war: !!p?.war, enemies: (p?.enemies ?? []).map((x) => x.name), years: [AID.minYears, AID.maxYears],
    ranges: income ? Object.fromEntries(DEAL_RES.map((r) => [r, aidRange(income[r])])) : null,
    active: a ? { id: a.id, text: L(`${resName(a.res)} 매달 ${a.amt} · 남은 ${a.left}개월 · ${a.since}부터`, `${a.amt} ${resName(a.res)} a month · ${a.left} months left · since ${a.since}`) } : null,
  };
}
/** 지원 시작(거래판·참전 요청 답). 호감 +30, 적국이 알면 그 적국 -20. */
export async function startAid(tid: number, res: DealRes, amt: number, years: number, via: 'deal' | 'cta' = 'deal'): Promise<{ ok: boolean; text?: string; error?: string }> {
  const sid = ctx.curSaveId; if (!sid || !ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
  if (!DEAL_RES.includes(res)) return { ok: false, error: L('자원을 읽지 못했습니다.', 'Unknown resource.') };
  const e = entry(sid); if (e.aids.some((a) => a.tid === tid && !a.done)) return { ok: false, error: L('이미 이 제국에 물자를 지원하고 있습니다.', 'We are already supplying this empire.') };
  const income = hoiHooks.income ? await hoiHooks.income(tid).catch(() => null) : null;
  const en = await probeEnemies(tid);
  if (!income || !en) return { ok: false, error: L('게임에서 사정을 읽지 못했습니다.', 'Could not read the situation from the game.') };
  probed.set(tid, { war: en.length > 0, enemies: en, date: today() });
  const errs = aidCheck(amt, years, income[res], en.length > 0);
  if (errs.length) { const r = aidRange(income[res]); return { ok: false, error: errs.map((c) => ({ nowar: L('그 제국은 지금 전쟁 중이 아닙니다.', 'That empire is not at war.'), years: L(`기간은 ${AID.minYears}~${AID.maxYears}년입니다.`, `Duration is ${AID.minYears}–${AID.maxYears} years.`), income: L(`${resName(res)} 월수입이 너무 적습니다.`, `Our ${resName(res)} income is too low.`), amount: L(`매달 ${r.lo}~${r.hi}(월수입의 5~20%)만 보낼 수 있습니다.`, `Send ${r.lo}–${r.hi} a month (5–20% of income).`) } as Record<string, string>)[c] ?? c).join(' ') }; }
  const name = nameOf(tid), d = today();
  const a: Aid = { id: randomUUID().replace(/-/g, '').slice(0, 12), tid, name, res, amt, left: years * 12, since: d, nextYear: addYears(d, 1), miss: 0, enemies: en.map((x) => ({ ...x })) };
  e.aids.push(a); save();
  await opinion(tid, HOI_MODS.aidStart);
  const knowers = a.enemies.filter((x) => x.knows);
  for (const x of knowers) await opinion(x.idx, HOI_MODS.aidEnemy);
  chronNote(tid, L(`우리가 참전 대신 물자를 지원하기 시작했다(${resName(res)} 매달 ${amt}, ${years}년)`, `We began supplying them instead of joining the war (${amt} ${resName(res)} a month, ${years} years)`));
  for (const x of knowers) chronNote(x.idx, L(`${usName()}이(가) 적국 ${name}에 물자를 대고 있다`, `${usName()} is supplying our enemy ${name}`));
  chronNoteWorld(L(`${d} ${usName()}이(가) 전쟁 중인 ${name}에 물자 지원을 시작함`, `${d} ${usName()} began supplying ${name} in its war`), true);
  logDiagnostic('info', 'hoi.aid_start', { via, years, knowers: knowers.length });
  return { ok: true, text: L(`${name}에 물자 지원을 시작했습니다(호감 +30${knowers.length ? `, 이를 알아챈 적국 ${knowers.length}곳 호감 -20` : ''}).`, `Began supplying ${name} (opinion +30${knowers.length ? `; ${knowers.length} enemy empire(s) noticed, opinion -20` : ''}).`) };
}
/** 지원을 그만둠(벌점 없음, 해마다 +10 이 끊김). */
export function stopAid(id: string): { ok: boolean } {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const a = entry(sid).aids.find((x) => x.id === id && !x.done); if (!a) return { ok: false };
  a.done = true; a.why = 'stopped'; aidUnset(a); save(); chronNote(a.tid, L('우리가 물자 지원을 중단했다', 'We stopped supplying them')); return { ok: true };
}
/** 참전 요청에 물자 지원으로 답할 때의 기본안(우리 에너지 월수입 5%, 2년). */
export async function ctaAidPlan(tid: number): Promise<{ res: DealRes; amt: number; years: number } | null> {
  const inc = hoiHooks.income ? await hoiHooks.income(tid).catch(() => null) : null; return inc ? ctaAidDefault(inc.energy) : null;
}
export const ctaAidMod = HOI_MODS.ctaAid;

/** 창고가 두 달 연속 모자라 지원이 끊김(앱이 보낸 달이든 모드의 stop 줄이든). */
function aidRanDry(a: Aid): void {
  a.done = true; a.why = 'short'; aidUnset(a);
  ctx.notify({ kind: 'event', title: L(`${a.name} 물자 지원이 끊겼습니다`, `Supplies to ${a.name} stopped`), body: L(`두 달 연속 ${resName(a.res)}이(가) 모자라 지원을 마쳤습니다.`, `We ran short of ${resName(a.res)} two months running, so the aid ended.`) });
  chronNote(a.tid, L('창고가 바닥나 물자 지원이 끊겼다', 'Our supplies to them ran dry'));
}
/** 앱이 지원을 끝낼 때 모드의 정기 송금 칸도 지운다(실패해도 조용히 — 다 내면 모드가 스스로 지운다). */
function aidUnset(a: Aid): void { if (a.reg && a.g) void mtUnset(a.tid, a.g, MT_OWNER.hoi); a.reg = false; }
/** 모드의 정기 송금 사건(기능 3 = 물자 지원): 못 냄 → 장부 · 끊김(두 달 연속) → 끊김 알림 · 다 냄 → 끝. */
function onAidMt(ev: MtEvent): void {
  const sid = ctx.curSaveId; if (!sid || (ev.sid && ev.sid !== sid)) return;
  const a = entry(sid).aids.find((x) => x.g === ev.g && x.tid === ev.tid && !x.done); if (!a) return;
  if (ev.ev === 'short') { a.miss = ev.miss; a.sm = (ev.date || ctx.gameDate || '').slice(0, 7); save(); return; }
  a.reg = false; // 칸은 모드가 이미 비웠다
  if (ev.ev === 'end') { a.left = 0; a.done = true; a.why = 'done'; save(); chronNote(a.tid, L('약속한 물자 지원 기간을 다 채웠다', 'We completed the promised aid')); return; }
  aidRanDry(a); save();
}
async function aidMonth(sid: string, d: string): Promise<void> {
  const e = entry(sid);
  for (const a of e.aids.filter((x) => !x.done)) {
    // 지급(2026-11-09, 회랑 방식 — 「매달 확인이 필요 없는 것은 바뀔 때만」): 정기 송금 칸(sllm_mt, 기능 3)에 한 번 적으면 모드가 매달 직접 보내고
    //   못 냈을 때·끊겼을 때·다 냈을 때만 줄을 남긴다(onAidMt). 칸이 모자라면(legacy) 예전처럼 앱이 매달 보낸다.
    //   세이브를 불러온 뒤에는 확인만 — 게임에 칸이 없으면 끝난 것(사용자 결정 2026-11-09 「게임을 믿고 끝냄」). 적국 확인은 매달 그대로(평화·새 적국).
    const month = d.slice(0, 7);
    if (!a.legacy && !a.reg) {
      if (!a.g) a.g = nextG(e.aids.map((x) => x.g));
      const r = await mtSet({ tid: a.tid, res: a.res, payUs: true, amt: a.amt, left: Math.max(1, Math.min(1200, a.left)), g: a.g, o: MT_OWNER.hoi }, true, !!a.chk);
      if (r === 'ok') { a.reg = true; a.rm = month; }
      else if (r === 'full') a.legacy = true;
      else if (r === 'gone') { a.done = true; a.why = 'gone'; }
      else if (r === 'missing') { a.done = true; a.why = 'done'; logDiagnostic('info', 'hoi.transfer_missing', { tid: a.tid, g: a.g, left: a.left }); }
      if (r !== 'fail') delete a.chk;
      if (a.done) continue;
    }
    if (a.legacy) {
      const req = ++link.reqCounter; let st = '';
      try { const r = await terminalRequest(payCommand(req, a.tid, true, a.res, a.amt), 'DEAL', req); st = r.kv.sid === sid ? String(r.kv.status) : ''; } catch { st = ''; }
      if (st === 'paid') { a.left -= 1; a.miss = 0; }
      else if (st === 'short') { a.miss += 1; if (a.miss >= AID.missLimit) { aidRanDry(a); continue; } }
      else if (st === 'target') { a.done = true; a.why = 'gone'; continue; }
    } else if (a.reg && a.rm !== month && a.sm !== month) { a.left -= 1; a.miss = 0; } // 모드가 낸 달(못 냈으면 short 줄이 sm 에 남음)
    const en = await probeEnemies(a.tid);
    if (en && !en.length) { a.done = true; a.why = 'peace'; aidUnset(a); ctx.notify({ kind: 'event', title: L(`${a.name}의 전쟁이 끝났습니다`, `${a.name}'s war is over`), body: L('물자 지원을 마쳤습니다.', 'The aid has ended.') }); chronNote(a.tid, L('그들의 전쟁이 끝나 우리 물자 지원도 마쳤다', 'Their war ended, and so did our aid')); continue; }
    if (en) for (const x of en) if (!a.enemies.some((y) => y.idx === x.idx)) { a.enemies.push({ ...x }); if (x.knows) { await opinion(x.idx, HOI_MODS.aidEnemy); chronNote(x.idx, L(`${usName()}이(가) 적국 ${a.name}에 물자를 대고 있다`, `${usName()} is supplying our enemy ${a.name}`)); } }
    if (cmpDate(d, a.nextYear) >= 0) {
      a.nextYear = addYears(a.nextYear, 1);
      await opinion(a.tid, HOI_MODS.aidYear);
      for (const x of a.enemies) if (!x.knows && enemyLearns(Math.random)) { x.knows = true; await opinion(x.idx, HOI_MODS.aidEnemy); chronNote(x.idx, L(`${usName()}이(가) 적국 ${a.name}에 몰래 물자를 대 온 것을 알아냈다`, `We found out ${usName()} has been quietly supplying our enemy ${a.name}`)); ctx.notify({ kind: 'event', title: L(`${x.name}이(가) 물자 지원을 알아챘습니다`, `${x.name} found out about the aid`), body: L(`${a.name}에 대한 지원을 알게 되어 우리 호감이 떨어졌습니다(-20).`, `They learned we are supplying ${a.name}; their opinion of us fell (-20).`) }); }
    }
    if (a.left <= 0) { a.done = true; a.why = 'done'; aidUnset(a); chronNote(a.tid, L('약속한 물자 지원 기간을 다 채웠다', 'We completed the promised aid')); }
  }
  e.aids = e.aids.filter((a) => !a.done || cmpDate(d, addYears(a.since, 8)) < 0).slice(-40);
}

// ---- ② 파벌 공작
/** 첩보 보고 화면(embassy-app)에 넣을 칸. factions: 그 나라 파벌(이름·이념 번호). */
export function fsupViewFor(idx: number, factions: Array<{ name: string; eth: number }>) {
  const sid = ctx.curSaveId, e = sid ? entry(sid) : blank(), band = hoiHooks.intel?.(idx)?.band ?? 0;
  const op = e.ops.find((o) => o.tid === idx && !o.done);
  const fx = e.foreign.find((f) => f.by === idx && f.revealed);
  return {
    can: band >= FSUP.minIntel && !op, cost: FSUP.cost, needIntel: band < FSUP.minIntel,
    factions: factions.filter((f) => isEth(ETH_KEYS[f.eth])).map((f) => ({ name: f.name, eth: ETH_KEYS[f.eth], ethName: ethName(ETH_KEYS[f.eth] as EthKey) })),
    active: op ? { faction: op.faction, ethName: ethName(op.eth), since: op.since, until: op.until, exposed: op.exposed ?? '' } : null,
    against: fx ? { ethName: ethName(fx.eth), since: fx.since, revealed: fx.revealed } : null,
  };
}
export async function startFsup(idx: number, eth: unknown, faction: unknown): Promise<{ ok: boolean; text?: string; error?: string }> {
  const sid = ctx.curSaveId; if (!sid || !ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
  if (!isEth(eth)) return { ok: false, error: L('파벌을 읽지 못했습니다.', 'Unknown faction.') };
  const band = hoiHooks.intel?.(idx)?.band ?? 0;
  if (band < FSUP.minIntel) return { ok: false, error: L('첩보 수준이 「보통」(30) 이상이어야 공작할 수 있습니다.', 'Our intel must be at least "Moderate" (30).') };
  const e = entry(sid); if (e.ops.some((o) => o.tid === idx && !o.done)) return { ok: false, error: L('이미 이 나라에서 공작 중입니다.', 'An operation is already running there.') };
  const st = await game((req) => fsupStartCommand(req, idx, eth), 'FSUP');
  if (st === 'short') return { ok: false, error: L(`영향력 ${FSUP.cost.influence}·에너지 ${FSUP.cost.energy}이(가) 필요합니다.`, `Needs ${FSUP.cost.influence} influence and ${FSUP.cost.energy} energy.`) };
  if (st !== 'applied') return { ok: false, error: L('게임에서 공작을 시작하지 못했습니다.', 'The game could not start the operation.') };
  const d = today(), name = nameOf(idx), fn = String(faction ?? '').replace(/[\r\n"]/g, ' ').slice(0, 80) || ethName(eth);
  e.ops.push({ id: randomUUID().replace(/-/g, '').slice(0, 12), tid: idx, name, eth, faction: fn, since: d, until: addYears(d, FSUP.years), nextYear: addYears(d, 1), year: 1 }); save();
  chronNote(idx, L(`(비밀) 우리 첩보망이 ${fn} 파벌에 자금을 대기 시작했다`, `(Secret) Our network began funding the ${fn} faction`));
  return { ok: true, text: L(`${name}의 ${fn} 파벌 지원 공작을 시작했습니다(2년, 영향력 ${FSUP.cost.influence}·에너지 ${FSUP.cost.energy}).`, `Began funding ${name}'s ${fn} faction (2 years, ${FSUP.cost.influence} influence, ${FSUP.cost.energy} energy).`) };
}
async function fsupMonth(sid: string, d: string): Promise<void> {
  const e = entry(sid);
  for (const o of e.ops.filter((x) => !x.done)) {
    if (cmpDate(d, o.until) >= 0) { o.done = true; continue; }
    if (cmpDate(d, o.nextYear) < 0) continue;
    o.nextYear = addYears(o.nextYear, 1); o.year += 1;
    if (o.year === 2) await game((req) => fsupMoreCommand(req, o.tid, o.eth), 'FSUP'); // 2년째: 매력도 +10% 더
    if (o.exposed) continue;
    const band = hoiHooks.intel?.(o.tid)?.band ?? 0;
    if (Math.random() < exposeChance(band)) {
      o.exposed = d; await opinion(o.tid, HOI_MODS.fsupExposed);
      chronNote(o.tid, L(`${usName()}이(가) 우리 ${o.faction} 파벌에 몰래 자금을 대 온 것이 드러났다`, `${usName()} was caught secretly funding our ${o.faction} faction`));
      chronNoteWorld(L(`${d} [폭로] ${usName()}이(가) ${o.name}의 ${o.faction} 파벌을 몰래 지원해 온 것이 드러남`, `${d} [Exposed] ${usName()} was caught secretly funding ${o.name}'s ${o.faction} faction`), true);
      ctx.notify({ kind: 'event', title: L(`${o.name}에서 파벌 공작이 발각되었습니다`, `Our faction operation in ${o.name} was exposed`), body: L('상대 호감 -50. 신문에 실립니다.', 'Their opinion -50. It will be in the papers.') });
      if (Math.random() < FSUP.accuse) openGameHearing({ opponent: o.name, operation: L('파벌 지원 공작', 'Funding a faction'), facts: [L(`${o.faction} 파벌에 몰래 자금을 댄 정황`, `Evidence of secret funding to the ${o.faction} faction`), L(`${o.since}부터`, `Since ${o.since}`)], key: 'fsup-' + o.id, idx: o.tid });
    }
  }
  e.ops = e.ops.filter((o) => !o.done || cmpDate(d, addYears(o.since, 6)) < 0).slice(-40);
}
/** AI 가 우리 파벌을 지원(해마다 한 번, 경쟁·적대 제국마다 4%, 한 번에 1건). 비밀 — 첩보 보고로 배후가 드러난다. */
async function foreignYear(sid: string, d: string, y: number): Promise<void> {
  const e = entry(sid); if (e.foreignYear === y) return; e.foreignYear = y;
  if (gameState.last?.gestalt) return;
  const active = e.foreign.filter((f) => cmpDate(d, f.until) < 0);
  if (active.length >= FSUP.foreignMax) return;
  const cands = [...ctx.mailCountries.values()].filter((c) => c.profile?.flags && (c.profile.flags.rival || c.profile.flags.hostile) && !c.profile.flags.war);
  for (const c of cands) {
    if (Math.random() >= FSUP.foreignChance) continue;
    const ours = (FACTION_ETHICS as readonly string[]).filter((x, i) => i > 0 && ((gameState.last?.empireEth ?? 0) & (1 << (i - 1))) !== 0);
    const eth = foreignTargetEthic(ours, Math.random);
    const st = await game((req) => fsupOnUsCommand(req, eth), 'FSUP'); if (st !== 'applied') return;
    e.foreign.push({ id: randomUUID().replace(/-/g, '').slice(0, 12), by: c.idx, name: c.name, eth, since: d, until: addYears(d, FSUP.years) });
    logDiagnostic('info', 'hoi.foreign_start', {}); return;
  }
}
/** 첩보 보고(첩보 수준 30 이상)로 배후가 드러남. */
function revealForeign(sid: string, d: string): void {
  const e = entry(sid);
  for (const f of e.foreign) {
    if (f.revealed || cmpDate(d, f.until) >= 0) continue;
    const it = hoiHooks.intel?.(f.by); if (!it || it.band < FSUP.revealIntel || !it.date || cmpDate(it.date, f.since) < 0) continue;
    f.revealed = d; moodNudge(2, L('외세 개입 폭로', 'Foreign meddling exposed'));
    chronNote(f.by, L(`그들이 우리 ${ethName(f.eth)} 파벌을 몰래 지원해 온 것을 우리 첩보가 밝혀냈다`, `Our spies exposed their secret funding of our ${ethName(f.eth)} faction`));
    chronNoteWorld(L(`${d} [폭로] ${f.name}이(가) ${usName()}의 ${ethName(f.eth)} 파벌을 몰래 지원해 온 것이 드러남`, `${d} [Exposed] ${f.name} was caught secretly funding ${usName()}'s ${ethName(f.eth)} faction`), true);
    ctx.notify({ kind: 'event', title: L(`배후가 드러났습니다 — ${f.name}`, `The hand behind it — ${f.name}`), body: L(`${f.name}이(가) 우리 ${ethName(f.eth)} 파벌을 몰래 지원해 왔습니다. 시위의 「외세 개입」 배후입니다(신문 보도, 민심 +2).`, `${f.name} has been secretly funding our ${ethName(f.eth)} faction — the foreign hand behind the protests (in the papers, public mood +2).`) });
  }
  save();
}
/** 시위 원인(protests-app): 진행 중인 외세 개입. */
export function foreignCauses(): Array<{ id: string; eth: EthKey; by: string; revealed: boolean; until: string }> {
  const sid = ctx.curSaveId; if (!sid) return []; const d = today();
  return entry(sid).foreign.filter((f) => !d || cmpDate(d, f.until) < 0).map((f) => ({ id: f.id, eth: f.eth, by: f.name, revealed: !!f.revealed, until: f.until }));
}

// ---- ③ 종속국 자치도
export function autonomyFor(idx: number): { v: number; stage: string; rightsPending: boolean; text: string } | null {
  const sid = ctx.curSaveId; if (!sid) return null; const a = entry(sid).auto[String(idx)]; if (!a) return null;
  const st = autoStage(a.v);
  const text = ({ calm: L('안정', 'Settled'), rights: L('권리 확대 요구', 'Demanding more rights'), independence: L('독립 요구', 'Demanding independence'), breakaway: L('이탈 직전', 'On the verge of breaking away') } as Record<string, string>)[st];
  return { v: Math.round(a.v), stage: st, rightsPending: !!a.rightsPending, text };
}
export function autonomyNudge(idx: number, n: number): void { const sid = ctx.curSaveId; if (!sid) return; const e = entry(sid), a = e.auto[String(idx)]; if (!a) return; e.auto[String(idx)] = autonomyAdd(a, n); save(); }
/** 종속국 채널에서 대화(달래기): 독립 요구 단계 이상이면 달마다 한 번 -3. */
export function autonomyCalm(idx: number): void {
  const sid = ctx.curSaveId; if (!sid) return; const e = entry(sid), a = e.auto[String(idx)]; if (!a || a.v < AUTO.independence) return;
  const mk = today().slice(0, 7); if (a.calmMonth === mk) return;
  e.auto[String(idx)] = { ...autonomyAdd(a, AUTO.calm), calmMonth: mk }; save();
}
export function answerRights(idx: number, yes: boolean): { ok: boolean; text?: string } {
  const sid = ctx.curSaveId; if (!sid) return { ok: false }; const e = entry(sid), a = e.auto[String(idx)]; if (!a || !a.rightsPending) return { ok: false };
  e.auto[String(idx)] = { ...autonomyAdd(a, yes ? AUTO.rightsYes : AUTO.rightsNo), rightsPending: false }; save();
  chronNote(idx, yes ? L('종주국이 우리의 권리 확대 요구를 들어주었다', 'Our overlord granted our demand for more rights') : L('종주국이 우리의 권리 확대 요구를 거절했다', 'Our overlord refused our demand for more rights'));
  return { ok: true, text: yes ? L('권리 확대를 들어주었습니다(자치도 -10).', 'Granted more rights (autonomy -10).') : L('권리 확대를 거절했습니다(자치도 +10).', 'Refused (autonomy +10).') };
}
async function autoMonth(sid: string, d: string): Promise<void> {
  const e = entry(sid), s = gameState.last; if (!s || s.sid !== sid) return;
  const atWar = s.wars.length > 0;
  // 종주국(우리) 패전: 전쟁이 끝났고 우리 피로가 상대보다 컸으면 자치도 +10
  const own = s.wars.reduce((m, w) => Math.max(m, w.side === 'att' ? w.ax : w.dx), 0), foe = s.wars.reduce((m, w) => Math.max(m, w.side === 'att' ? w.dx : w.ax), 0);
  const lost = !!e.lastWar && e.lastWar.atWar && !atWar && e.lastWar.own - e.lastWar.foe >= 0.2;
  e.lastWar = { atWar, own, foe };
  const aidedIdx = new Set(e.aids.filter((a) => !a.done).map((a) => a.tid));
  const seen = new Set<string>();
  for (const v of s.vassals ?? []) {
    const k = String(v.idx); seen.add(k);
    let a = e.auto[k] ?? { idx: v.idx, name: v.name, v: AUTO.start, peaceMonths: 0 };
    a = autonomyMonth({ ...a, name: v.name }, { loyalty: v.loyalty, atWar, aided: aidedIdx.has(v.idx) });
    if (lost) a = autonomyAdd(a, AUTO.warLost);
    const st = autoStage(a.v);
    if ((st === 'rights' || st === 'independence' || st === 'breakaway') && !a.rightsPending && (!a.rightsAsked || cmpDate(d, addYears(a.rightsAsked, 2)) >= 0)) {
      a.rightsPending = true; a.rightsAsked = d;
      ctx.notify({ kind: 'event', title: L(`${v.name}이(가) 권리 확대를 요구합니다`, `${v.name} demands more rights`), body: L('종속국 채널에서 답하세요(들어주면 자치도 -10, 거절하면 +10).', 'Answer in the subject channel (grant: autonomy -10, refuse: +10).') });
      chronNote(v.idx, L('종주국에 권리 확대를 요구했다', 'Demanded more rights from our overlord'));
    }
    if ((st === 'independence' || st === 'breakaway') && (!a.indepSent || cmpDate(d, addYears(a.indepSent, 2)) >= 0)) {
      a.indepSent = d;
      ctx.notify({ kind: 'event', title: L(`${v.name}이(가) 독립을 요구합니다`, `${v.name} demands independence`), body: L('자치도가 70을 넘었습니다. 90을 넘긴 채 2년이 지나면 실제로 떨어져 나갑니다. 종속국 채널에서 대화로 달랠 수 있습니다.', 'Autonomy is above 70. If it stays above 90 for two years they break away. You can calm them by talking in the subject channel.') });
      chronNote(v.idx, L('종주국에 독립을 요구하는 서신을 보냈다', 'Sent our overlord a letter demanding independence'));
      chronNoteWorld(L(`${d} ${v.name}이(가) 종주국 ${usName()}에 독립을 요구함`, `${d} ${v.name} demanded independence from its overlord ${usName()}`), true);
    }
    if (st === 'breakaway') a.highSince ??= d; else delete a.highSince;
    if (a.highSince && cmpDate(d, addMonths(a.highSince, AUTO.breakawayMonths)) >= 0) {
      const r = await game((req) => autoFreeCommand(req, v.idx), 'AUTOFREE');
      if (r === 'applied') {
        a.free = true; delete a.highSince;
        chronNote(v.idx, L(`종주국 ${usName()}에게서 독립했다`, `Broke away from our overlord ${usName()}`));
        chronNoteWorld(L(`${d} ${v.name}이(가) ${usName()}의 종속에서 벗어나 독립함`, `${d} ${v.name} broke free of ${usName()} and declared independence`), true);
        ctx.notify({ kind: 'event', title: L(`${v.name}이(가) 독립했습니다`, `${v.name} has broken away`), body: L('자치도가 오래 90을 넘어 종속에서 벗어났습니다.', 'Autonomy stayed above 90 too long; they are no longer our subject.') });
      }
    }
    e.auto[k] = a;
  }
  for (const k of Object.keys(e.auto)) if (!seen.has(k) && !e.auto[k].free) delete e.auto[k]; // 더 이상 종속국이 아님
}

// ---- 매달
let lastMonth = '', busy = false;
async function monthly(sid: string, d: string): Promise<void> {
  const mk = sid + ':' + d.slice(0, 7);
  if (busy || !d || mk === lastMonth || sid !== ctx.curSaveId || !ctx.gameRunning) return;
  lastMonth = mk; busy = true;
  try {
    await aidMonth(sid, d);
    await fsupMonth(sid, d);
    const y = parseInt(d, 10); if (Number.isFinite(y) && d.slice(5, 7) === '01') await foreignYear(sid, d, y);
    revealForeign(sid, d);
    await autoMonth(sid, d);
    save();
  } catch (e) { logDiagnostic('warn', 'hoi.month_failed', { error: String(e) }); }
  finally { busy = false; }
}

export function registerHoi(router: LogRouter): void {
  hoiLink.autonomy = autonomyFor; hoiLink.nudge = autonomyNudge; hoiLink.calm = autonomyCalm; hoiLink.foreign = foreignCauses;
  mtSubscribe(router, MT_OWNER.hoi, onAidMt); // 정기 송금(2026-11-09): 물자 지원 매달 지급은 모드가 직접
  router.on(SLOT.HOI, 'hoi', (m: SllmMessage) => {
    if (m.kind === 'LOADED') { const sid = String(m.kv.sid ?? '').replace(/^\\/, ''); if (sid) { let n = 0; for (const a of entry(sid).aids) if (!a.done && a.reg) { a.reg = false; a.chk = true; n++; } if (n) save(); } return; } // 불러오면 다음 달 칸을 확인만
    if (m.kind === 'AIDEN') { const l = enemyRows.get(String(m.kv.req)), i = Number(m.kv.idx); if (l && Number.isSafeInteger(i) && i > 0 && l.length < 30) l.push({ idx: i, name: String(m.kv.name ?? '').slice(0, 80), knows: m.kv.intel === '1' }); }
    else if (m.kind === 'AIDEND' || m.kind === 'FSUP' || m.kind === 'AUTOFREE') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
  });
  onGameSnapshot((snap) => { if (snap.sid) void monthly(snap.sid, snap.date || today()); });
  ipcMain.handle('aidStart', async (_e, tid: unknown, res: unknown, amt: unknown, years: unknown) => startAid(Number(tid), String(res) as DealRes, Math.floor(Number(amt)), Math.floor(Number(years))));
  ipcMain.handle('aidStop', async (_e, id: unknown) => stopAid(String(id)));
  ipcMain.handle('fsupStart', async (_e, idx: unknown, eth: unknown, faction: unknown) => startFsup(Number(idx), eth, faction));
  ipcMain.handle('autoRights', async (_e, idx: unknown, yes: unknown) => answerRights(Number(idx), !!yes));
}
