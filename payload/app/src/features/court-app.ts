// 정치(음모·궁정 정치·반대파 처리·망명 / 가문·가계도 / 정략결혼, 2026-10-28 사용자 확정) 앱 쪽. 규칙·수치: ../court.ts, 모드: sllm_court.txt.
// 화면: 집무실 「궁정」(ui/office-court.js — 음모·수감자·가문·가계도), 아기방의 「가문·가계도」, 외교 거래판의 「정략결혼」(deal-ui.js).
// LLM 은 쓰지 않는다(알림·연대기는 틀 문장). 매달 월간 상황(onGameSnapshot)에서 앱이 판정하고, 게임 명령은 비용·직책 해제·수감 특성·추방·망명·수정자·호감뿐.
// 가져오기 고리를 피하려고 children-app·protests-app 과는 app/court-hooks(courtLink)로만 주고받는다. deals-app 은 이 파일을 가져다 쓴다(혼인 IPC).
import { dayMoodEvent } from '../app/daymood-hooks'; // 동적 일상 분위기: 음모가 드러남 = 술렁임, 혼인 = 경사, 통치자의 죽음 = 애도(2026-10-28)
import { app, ipcMain, BrowserWindow } from 'electron';
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
import { office } from './office-app';
import { peopleOf } from './people-app';
import { gameName } from './namegen-app';
import { protestsView, protestPlanetsNow } from './protests-app';
import { vaultGraftWeight } from './vault-app'; // 통치자 개인 금고의 부패 낌새 → 「부패」 음모 가중치(2026-10-30)
import { courtLink, type KidInfo } from '../app/court-hooks';
import { addYears, cmpDate } from '../gamedate';
import {
  PLOT, type Plot, type PlotKind, type PlotAct, type Prisoner, type Relapse, type EthKey, ETHS, isEth, PLOT_NAME, ACT_NAME,
  plotYearChance, plotCandidates, pickPlot, newPlot, plotStep, canAct, actCost, applyCheck, backlash, plotText, hintText, foundText, wonText, actText,
  courtPayCommand, courtLoseCommand, courtLeaderCommand, courtSendCommand, courtModCommand, courtPlanetCommand, marryBondCommand, type CourtMod,
  HOUSE, HOUSE_TRAITS, type House, type ForeignHouse, traitOf, houseTraitsNew, inheritTraits, houseNameText, houseLabel, sameHouse, houseLine,
  MARRY, type Marriage, type MarryKid, canMarry, marryErrors, marryErrorText, marryText, marryChron, strainText, type PlotWorld,
} from '../court';

interface Cause { id: string; eth: EthKey; text: string; until: string; planetK?: number }
interface SaveEntry {
  plots: Plot[]; prisoners: Array<Prisoner & { cell: number }>; relapses: Relapse[]; plotYear: number;
  houses: House[]; kin: Record<string, string[]>; ruler: string; foreign: Record<string, ForeignHouse>;
  marriages: Marriage[]; causes: Cause[];
  /** 마지막으로 본 통치 체제(1 민주 2 과두 3 독재 4 제정 5 기업). 가계도는 독재·제정만(사용자 확정 2026-10-28) */ auth?: number;
}
const file = () => path.join(app.getPath('userData'), 'sllm_court.json');
let store: Record<string, SaveEntry> | null = null;
const blank = (): SaveEntry => ({ plots: [], prisoners: [], relapses: [], plotYear: 0, houses: [], kin: {}, ruler: '', foreign: {}, marriages: [], causes: [] });
const arr = <T>(v: unknown, ok: (x: any) => boolean, n: number): T[] => (Array.isArray(v) ? v.filter(ok).slice(-n) : []) as T[];
function all(): Record<string, SaveEntry> {
  if (store) return store; store = {};
  try {
    const o = JSON.parse(fs.readFileSync(file(), 'utf8'));
    for (const [k, v] of Object.entries((o?.saves ?? {}) as Record<string, any>)) {
      const e = blank();
      e.plots = arr<Plot>(v?.plots, (x) => x && typeof x.id === 'string' && typeof x.pid === 'string' && Number.isFinite(x.prog), 60).map((p) => ({ ...p, log: Array.isArray(p.log) ? p.log.slice(-20) : [] }));
      e.prisoners = arr(v?.prisoners, (x) => x && typeof x.pid === 'string' && typeof x.state === 'string', 40);
      e.relapses = arr(v?.relapses, (x) => x && typeof x.pid === 'string' && typeof x.at === 'string', 20);
      e.plotYear = Number.isSafeInteger(v?.plotYear) ? v.plotYear : 0;
      e.houses = arr<House>(v?.houses, (x) => x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.rulers), 30).map((h) => ({ ...h, traits: (Array.isArray(h.traits) ? h.traits : []).filter((t: string) => !!traitOf(t)) }));
      if (v?.kin && typeof v.kin === 'object') for (const [c, t] of Object.entries(v.kin as Record<string, unknown>)) if (Array.isArray(t)) e.kin[c] = (t as string[]).filter((x) => !!traitOf(x)).slice(0, HOUSE.maxTraits);
      e.ruler = typeof v?.ruler === 'string' ? v.ruler : '';
      if (v?.foreign && typeof v.foreign === 'object') for (const [i, f] of Object.entries(v.foreign as Record<string, any>)) if (f && typeof f.name === 'string') e.foreign[i] = { tid: Number(i), name: f.name, traits: Array.isArray(f.traits) ? f.traits.filter((t: string) => !!traitOf(t)) : [] };
      e.marriages = arr<Marriage>(v?.marriages, (x) => x && typeof x.id === 'string' && Number.isSafeInteger(x.tid) && typeof x.cid === 'string', 40);
      if (Number.isSafeInteger(v?.auth)) e.auth = v.auth;
      e.causes = arr<Cause>(v?.causes, (x) => x && typeof x.id === 'string' && isEth(x.eth) && typeof x.until === 'string', 20);
      store[k] = e;
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'court', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'court', error: e }); } }
const entry = (sid: string): SaveEntry => (all()[safeKey(sid)] ??= blank());
const today = () => ctx.gameDate || '';
const usName = () => ctx.playerName || L('우리', 'Us');
const lidOf = (pid: string): number => { const m = /^p:(\d+)$/.exec(pid); return m ? Number(m[1]) : 0; };
const live = (sid: string) => peopleOf(sid).filter((p) => !p.gone);
const alive = (sid: string, pid: string) => live(sid).some((p) => `p:${p.lid}` === pid);
const ETH_NAME: Record<EthKey, [string, string]> = { militarist: ['군국주의', 'Militarist'], pacifist: ['평화주의', 'Pacifist'], authoritarian: ['권위주의', 'Authoritarian'], egalitarian: ['평등주의', 'Egalitarian'], xenophile: ['외계종 선호', 'Xenophile'], xenophobe: ['외계종 혐오', 'Xenophobe'], materialist: ['물질주의', 'Materialist'], spiritualist: ['정신주의', 'Spiritualist'] };
const ethName = (e?: EthKey) => (e ? L(ETH_NAME[e][0], ETH_NAME[e][1]) : '');
const enabled = () => !gameState.last?.gestalt; // 군체·기계 제국: 궁정·가문 없음
function toast(title: string, body: string): void {
  (office as { toastGo: string }).toastGo = 'court';
  ctx.notify({ kind: 'office', title, body, action: L('궁정으로 가기', 'Go to the court') });
}
function chron(text: string, world = false): void { try { if (world) chronNoteWorld((today() ? today() + ' ' : '') + text, true); else chronNote(ctx.playerIdx, (today() ? today() + ' ' : '') + text); } catch { /* 연대기 없음 */ } }
function push(): void { try { const v = courtView(); for (const bw of BrowserWindow.getAllWindows()) if (!bw.isDestroyed()) bw.webContents.send('courtUpdate', v); } catch { /* 창 없음 */ } }
const pLog = (pl: Plot, ko: string, en: string) => { pl.log.push({ date: today(), ko, en }); if (pl.log.length > 20) pl.log = pl.log.slice(-20); };

// ---- 게임 명령
async function court(cmd: string, req: number): Promise<string> {
  if (!ctx.gameRunning || !link.sessionReady) return 'offline';
  try { const m = await terminalRequest(cmd, 'COURT', req); return m.kv.sid && m.kv.sid !== ctx.curSaveId ? 'save' : String(m.kv.status ?? ''); }
  catch (e) { logDiagnostic('warn', 'court.cmd_failed', { error: (e as Error).message }); return 'timeout'; }
}
const pay = (en: number, inf: number) => { const r = ++link.reqCounter; return court(courtPayCommand(r, en, inf), r); };
const leader = (lid: number, act: 'unassign' | 'jail' | 'free' | 'exile') => { const r = ++link.reqCounter; return court(courtLeaderCommand(r, lid, act), r); };
const send = (lid: number, tid: number) => { const r = ++link.reqCounter; return court(courtSendCommand(r, lid, tid), r); };
const mod = (m: CourtMod, days: number) => { const r = ++link.reqCounter; return court(courtModCommand(r, m, days), r); };
const planetMod = (k: number, m: CourtMod, days: number) => { const r = ++link.reqCounter; return court(courtPlanetCommand(r, k, m, days), r); };
const lose = (inf: number) => { const r = ++link.reqCounter; return court(courtLoseCommand(r, inf), r); };
const bond = (tid: number, add: boolean) => { const r = ++link.reqCounter; return court(marryBondCommand(r, tid, add), r); };
const failText = (st: string) => ({ short: L('창고(에너지·영향력)가 모자랍니다.', 'Not enough energy or influence.'), offline: L('게임이 켜져 있어야 합니다.', 'The game must be running.'), timeout: L('게임이 응답하지 않았습니다.', 'The game did not respond.'), no_target: L('게임에서 그 인물을 찾지 못했습니다.', 'That person was not found in the game.'), target: L('상대 제국을 찾지 못했습니다.', 'The other empire was not found.'), save: L('세이브가 바뀌었습니다.', 'The save changed.') } as Record<string, string>)[st] ?? L(`게임 결과를 확인하지 못했습니다(${st}).`, `Could not confirm the game result (${st}).`);

// ======================================================================================
// 가문
// ======================================================================================
const kidsOf = (sid: string): KidInfo[] => { try { return courtLink.kids(sid); } catch { return []; } };
/** 이 지도자(pid)가 아기방에서 자란 자녀라면 그 부모 통치자 pid. */
const childOf = (sid: string) => (pid: string): string | null => kidsOf(sid).find((k) => k.adultLid && `p:${k.adultLid}` === pid)?.ruler ?? null;
const houseOfRuler = (e: SaveEntry, pid: string): House | undefined => e.houses.find((h) => h.rulers.some((r) => r.pid === pid));
const curHouse = (e: SaveEntry): House | undefined => (e.ruler ? houseOfRuler(e, e.ruler) : undefined);
/** 가문이 없는 체제: 가문은 기록하지 않고 통치자 죽음(애도)만 본다. */
function rulerWatch(sid: string, e: SaveEntry): void {
  const r = live(sid).find((p) => p.ruler); if (!r) return;
  const pid = `p:${r.lid}`; if (e.ruler === pid) return;
  const prev = e.ruler ? houseOfRuler(e, e.ruler) : undefined;
  if (prev) { const pr = prev.rulers.find((x) => x.pid === e.ruler && !x.to); if (pr) pr.to = today(); }
  if (e.ruler && peopleOf(sid).some((p) => `p:${p.lid}` === e.ruler && p.gone)) dayMoodEvent('grief', L('통치자의 죽음', 'Death of the ruler'));
  e.ruler = pid;
}
/** 월간: 통치자가 바뀌었으면 가문을 잇거나 새로 연다. */
function houseMonth(sid: string, e: SaveEntry): boolean {
  const r = live(sid).find((p) => p.ruler); if (!r) return false;
  const pid = `p:${r.lid}`; if (e.ruler === pid && houseOfRuler(e, pid)) return false; // 가문이 없던 체제에서 바뀌었으면 지금 통치자로 연다
  const d = today();
  const prev = e.ruler ? houseOfRuler(e, e.ruler) : undefined;
  if (prev) { const pr = prev.rulers.find((x) => x.pid === e.ruler && !x.to); if (pr) pr.to = d; }
  if (e.ruler && peopleOf(sid).some((p) => `p:${p.lid}` === e.ruler && p.gone)) dayMoodEvent('grief', L('통치자의 죽음', 'Death of the ruler')); // 앞 통치자가 세상을 떠남
  let h = houseOfRuler(e, pid);
  if (!h) {
    h = e.houses.find((x) => sameHouse(x, { pid, last: r.last || '' }, childOf(sid)));
    if (h) h.rulers.push({ pid, name: r.name, from: d });
    else {
      const nm = houseNameText(r.last || r.first || r.name.split(/\s+/).pop() || r.name) || L('이름 없는', 'Nameless');
      h = { id: randomUUID().replace(/-/g, '').slice(0, 12), name: nm, traits: houseTraitsNew(Math.random), since: d, rulers: [{ pid, name: r.name, from: d }] };
      e.houses.push(h);
      if (e.ruler) chron(L(`새 통치 가문이 섰다: ${houseLabel(h, L)}`, `A new ruling house rose: ${houseLabel(h, L)}`));
    }
  }
  if (e.ruler && prev && prev !== h) chron(L(`통치 가문이 ${houseLabel(prev, L)}에서 ${houseLabel(h, L)}(으)로 바뀌었다`, `Rule passed from ${houseLabel(prev, L)} to ${houseLabel(h, L)}`));
  e.ruler = pid;
  return true;
}
/** 가문 특성: 아기방에서 자란 사람 = 물려받은 특성, 그 밖의 통치자 = 가문 특성. */
let kidCache: { sid: string; at: number; kids: KidInfo[] } | null = null;
const kidsNow = (sid: string): KidInfo[] => { const t = Date.now(); if (!kidCache || kidCache.sid !== sid || t - kidCache.at > 2000) kidCache = { sid, at: t, kids: kidsOf(sid) }; return kidCache.kids; };
function traitsFor(e: SaveEntry, pid: string): string[] {
  const kid = e.ruler !== undefined ? kidsNow(ctx.curSaveId || '').find((k) => k.adultLid && `p:${k.adultLid}` === pid) : undefined;
  if (kid) return e.kin[kid.id] ?? [];
  return houseOfRuler(e, pid)?.traits ?? [];
}
function onBirth(sid: string, cid: string, rulerPid: string): void {
  const e = entry(sid); if (e.kin[cid] || !treeAllowed(sid)) return;
  const kid = kidsOf(sid).find((k) => k.id === cid);
  // 부모 통치자가 아기방 출신이면 그 아이의 특성, 아니면 가문 특성
  const parentKid = kidsOf(sid).find((k) => k.adultLid && `p:${k.adultLid}` === rulerPid);
  const base = parentKid ? e.kin[parentKid.id] ?? [] : (houseOfRuler(e, rulerPid)?.traits ?? curHouse(e)?.traits ?? []);
  e.kin[cid] = inheritTraits(base, Math.random);
  void kid; save();
}
function foreignHouse(e: SaveEntry, tid: number): ForeignHouse {
  const k = String(tid); let f = e.foreign[k]; if (f) return f;
  const nm = gameName(Math.random() < 0.5 ? 'm' : 'f', tid) ?? '';
  const last = houseNameText(nm.split(/\s+/).slice(-1)[0] || '') || L(`제국 ${tid}`, `Empire ${tid}`);
  f = { tid, name: last, traits: houseTraitsNew(Math.random, HOUSE.foreignTraits) }; e.foreign[k] = f; return f;
}
/** 1:1 통신 프롬프트 한 줄: 통치자·아기방 자녀·통치자의 배우자. */
function houseLineFor(sid: string, key: string): string {
  if (!treeAllowed(sid)) return '';
  if (!enabled()) return '';
  const e = entry(sid); const h = houseOfRuler(e, key);
  if (h) return houseLine(h, traitsFor(e, key), 'ruler');
  const kid = kidsOf(sid).find((k) => k.adultLid && `p:${k.adultLid}` === key);
  if (kid) { const hh = houseOfRuler(e, kid.ruler) ?? curHouse(e); if (hh) return houseLine(hh, e.kin[kid.id] ?? [], 'kin'); }
  const spouseOf = kidsOf(sid).find((k) => k.parent === key);
  if (spouseOf) { const hh = houseOfRuler(e, spouseOf.ruler); if (hh) return houseLine(hh, [], 'inlaw'); }
  return '';
}
const traitView = (keys: string[]) => keys.map((k) => traitOf(k)).filter(Boolean).map((t) => ({ key: t!.key, name: L(t!.ko, t!.en), desc: L(t!.dko, t!.den) }));

/** 가계도 자료(배치는 화면이 연다 — 열 때만 그린다). 세대 = 통치자 줄기. */
/** 가문·가계도는 세습 군주제(제정)·독재 정부에서만(사용자 확정 2026-10-28 — 민주주의에 가문은 어색함). 지금 체제를 모르면 마지막으로 본 값. */
const TREE_AUTH = [3, 4];
function treeAllowed(sid: string): boolean { const au = gameState.last?.sid === sid && gameState.last.authority !== undefined ? gameState.last.authority : entry(sid).auth; return au !== undefined && TREE_AUTH.includes(au); }
function treeView(sid: string) {
  const e = entry(sid), kids = kidsOf(sid), d = today();
  const persons = new Map(peopleOf(sid).map((p) => [`p:${p.lid}`, p]));
  const marr = new Map(e.marriages.map((m) => [m.cid, m]));
  const prison = new Map(e.prisoners.filter((p) => p.state === 'held').map((p) => [p.pid, p]));
  const plotEnd = new Map(e.plots.filter((p) => p.end === 'exile' || (p.end === 'won' && p.kind === 'defect')).map((p) => [p.pid, p]));
  const tagsOf = (pid: string): string[] => { const t: string[] = []; if (prison.has(pid)) t.push('prison'); const pe = plotEnd.get(pid); if (pe) t.push(pe.end === 'exile' ? 'exiled' : 'defected'); return t; };
  const houses = e.houses.map((h) => {
    const gens = h.rulers.map((r) => {
      const mine = kids.filter((k) => k.ruler === r.pid && k.born);
      const spouses = [...new Map(mine.map((k) => [k.parent, k.parentName])).entries()].map(([pid, name]) => ({ pid, name, gone: !alive(sid, pid) }));
      return {
        ruler: { pid: r.pid, name: r.name, from: r.from, to: r.to ?? '', gone: !alive(sid, r.pid) && !!persons.get(r.pid)?.gone, now: e.ruler === r.pid, traits: traitView(traitsFor(e, r.pid)), tags: tagsOf(r.pid) },
        spouses,
        children: mine.map((k) => {
          const m = marr.get(k.id), kp = k.adultLid ? `p:${k.adultLid}` : '';
          return {
            id: k.id, pid: kp, name: k.name || '?', gender: k.gender, parent: k.parent, born: k.born ?? '', dead: k.dead ?? '', stage: k.stage,
            role: k.leader ? (h.rulers.some((x) => x.pid === kp) ? 'ruler' : 'leader') : k.civ ? 'civ' : k.adult ? 'adult' : 'young', job: k.job ?? '', heir: !!k.heir,
            next: !!kp && h.rulers.some((x) => x.pid === kp), traits: traitView(e.kin[k.id] ?? []), tags: kp ? tagsOf(kp) : [],
            wed: m ? { spouse: m.spouse, empire: m.empire, house: m.house, state: m.state, sent: !!m.sent } : (k.married ? { spouse: k.married, empire: '', house: '', state: 'wed', sent: false } : null),
            talk: !!kp && alive(sid, kp),
          };
        }),
      };
    });
    return { id: h.id, name: h.name, label: houseLabel(h, L), custom: !!h.custom, since: h.since, traits: traitView(h.traits), current: h === curHouse(e), gens };
  });
  return { ok: true, today: d, houses: houses.reverse() };
}

// ======================================================================================
// 음모
// ======================================================================================
function plotWorld(sid: string, e: SaveEntry): PlotWorld {
  const scan = protestPlanetsNow(sid);
  const kids = kidsOf(sid), rulerPid = e.ruler;
  const govEth = new Map(scan.map((p) => [p.governor ?? '', p.govEthic]));
  const persons = live(sid).filter((p) => !e.prisoners.some((x) => x.pid === `p:${p.lid}` && x.state === 'held')).map((p) => {
    const pid = `p:${p.lid}`, kid = kids.find((k) => k.adultLid === p.lid);
    const eth = govEth.get(pid);
    return { pid, name: p.name, cls: String(p.cls ?? ''), lv: Number(p.lv) || 0, council: !!p.council, asg: !!p.asg, ruler: !!p.ruler, ...(isEth(eth) ? { eth } : {}), rulerChild: !!kid && kid.ruler === rulerPid, heirChild: !!kid?.heir };
  });
  const st = gameState.last;
  const factions = (st?.factions ?? []).filter((f) => isEth(f.ethic)).map((f) => ({ eth: f.ethic as EthKey, support: f.support, approval: f.approval }));
  const foes = terminal.items.filter((c) => c.type === 'default' && (c.em?.war || c.em?.rival)).sort((a, b) => Number(!!b.em?.war) - Number(!!a.em?.war)).map((c) => ({ idx: c.idx, name: c.name }));
  const amb = (pid: string) => traitsFor(e, pid).includes('ambitious') || (() => { const k = kids.find((x) => x.adultLid && `p:${x.adultLid}` === pid); return !!k && (e.kin[k.id] ?? []).includes('ambitious'); })();
  return { persons, planets: scan.map((p) => ({ k: p.k, name: p.name, stability: p.stability, governor: p.governor })), foes, hereditary: st?.authority === 4, factions, busy: e.plots.filter((p) => !p.ended).map((p) => p.pid), ambitious: amb, graftWeight: vaultGraftWeight(sid) };
}
function yearFactors(): { lowStability: boolean; protest: boolean; warLosing: boolean } {
  const st = gameState.last, m = st?.mood;
  const lowStability = !!m && m.cnt > 0 && m.sum / m.cnt < PLOT.lowStability;
  let protest = false; try { protest = protestsView().open.length > 0; } catch { /* 없음 */ }
  const warLosing = !!st?.wars?.some((w) => { const own = w.side === 'att' ? w.ax : w.dx, foe = w.side === 'att' ? w.dx : w.ax; return own - foe > 0.15; });
  return { lowStability, protest, warLosing };
}
function startPlot(sid: string, e: SaveEntry, only?: { pid: string; kind: PlotKind }): Plot | null {
  if (e.plots.filter((p) => !p.ended).length >= PLOT.maxActive) return null;
  const w = plotWorld(sid, e);
  let c = plotCandidates(w);
  if (only) c = c.filter((x) => x.p.pid === only.pid && x.kind === only.kind);
  const pick = pickPlot(c, Math.random); if (!pick) return null;
  const pl = newPlot(randomUUID().replace(/-/g, '').slice(0, 12), pick, today(), w);
  pLog(pl, '음모가 시작되었다(아직 아무도 모른다)', 'The plot began (no one knows yet)');
  e.plots.push(pl); logDiagnostic('info', 'court.plot_started', { kind: pl.kind });
  return pl;
}
async function plotsMonth(sid: string, e: SaveEntry): Promise<void> {
  const d = today(), y = parseInt(d, 10);
  if (Number.isFinite(y) && y > e.plotYear) { // 1년에 한 번
    if (e.plotYear && Math.random() < plotYearChance(yearFactors())) startPlot(sid, e);
    e.plotYear = y;
  }
  for (const r of e.relapses.filter((x) => cmpDate(d, x.at) >= 0)) { if (alive(sid, r.pid)) startPlot(sid, e, { pid: r.pid, kind: r.kind }); }
  e.relapses = e.relapses.filter((x) => cmpDate(d, x.at) < 0);
  for (let i = 0; i < e.plots.length; i++) {
    const pl = e.plots[i]; if (pl.ended) continue;
    if (!alive(sid, pl.pid)) { pl.ended = d; pl.end = 'gone'; pLog(pl, '음모자가 사라져 음모도 흩어졌다', 'The plotter is gone; the plot fell apart'); continue; }
    if (pl.found) continue;
    const r = plotStep(pl, Math.random); e.plots[i] = r.pl; const p = r.pl;
    if (r.hint) { p.hinted = d; pLog(p, '수상한 낌새가 비서의 귀에 들어갔다', 'Rumors reached the secretary'); toast(L('수상한 낌새', 'Something is off'), hintText(p, L)); }
    if (r.found) { dayMoodEvent('stir', L('음모가 드러남', 'A plot uncovered')); p.found = d; pLog(p, '음모가 드러났다', 'The plot was uncovered'); toast(L('음모가 드러났습니다', 'A plot uncovered'), foundText(p, L)); chron(L(`${plotText(p, L)} — 음모가 드러났다`, `${plotText(p, L)} — the plot was uncovered`)); }
    if (r.won) await plotWon(sid, e, p);
  }
  e.plots = e.plots.filter((p) => !p.ended || cmpDate(addYears(p.ended, 10), d) > 0).slice(-60);
  e.causes = e.causes.filter((c) => cmpDate(c.until, d) > 0);
  // 수감자가 세상을 떠남(처형 포함)
  for (const pr of e.prisoners) if (pr.state === 'held' && !alive(sid, pr.pid)) { pr.state = 'executed'; pr.until = d; }
}
/** 음모가 이루어짐(진행도 100): 종류별 결과. */
async function plotWon(sid: string, e: SaveEntry, pl: Plot): Promise<void> {
  const d = today(); pl.ended = d; pl.end = 'won';
  const out: string[] = [];
  try {
    if (pl.kind === 'secede' && pl.planetK) {
      const now = pl.planet ? protestPlanetsNow(sid).find((x) => x.name === pl.planet) : undefined; if (now) pl.planetK = now.k; // 모의가 시작된 뒤 행성 순서가 바뀌었을 수 있다(2026-10-29)
      const st = await planetMod(pl.planetK, 'sllm_plot_secede', PLOT.win.secedeDays); out.push(st);
      if (pl.eth) e.causes.push({ id: 'plot:' + pl.id, eth: pl.eth, planetK: pl.planetK, text: L(`총독 ${pl.name}의 독립 모의가 드러나 거리가 술렁인다`, `Governor ${pl.name}'s secession plot has the streets in turmoil`), until: addYears(d, 2) });
    } else if (pl.kind === 'power' || pl.kind === 'succession') {
      out.push(await lose(PLOT.win.powerInfluence));
      if (pl.kind === 'succession') moodNudge(-3, L('후계 다툼', 'Succession struggle'));
    } else if (pl.kind === 'graft') out.push(await mod('sllm_plot_graft', PLOT.win.graftDays));
    else if (pl.kind === 'collude' && pl.eth) out.push(await mod(`sllm_plot_collude_${pl.eth}`, PLOT.win.colludeDays));
    else if (pl.kind === 'defect' && pl.tid) out.push(await send(lidOf(pl.pid), pl.tid));
  } catch (err) { logDiagnostic('warn', 'court.won_failed', { error: (err as Error).message }); }
  const txt = wonText(pl, L);
  pLog(pl, '음모가 이루어졌다', 'The plot succeeded');
  toast(L('음모가 이루어졌습니다', 'A plot succeeded'), txt);
  chron(txt, pl.kind === 'power' || pl.kind === 'defect' || pl.kind === 'secede'); // 신문 호외(세계 소식)
  if (pl.kind === 'defect' && pl.tid) chronNote(pl.tid, L(`${usName()}의 ${pl.name}이(가) 우리에게 망명해 왔다`, `${pl.name} of ${usName()} defected to us`));
  logDiagnostic('info', 'court.plot_won', { kind: pl.kind, results: out.join(',') });
}
/** 플레이어의 대응(견제·처리). */
async function act(id: string, a: PlotAct): Promise<{ ok: boolean; text?: string; error?: string }> {
  const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러와 주세요.', 'Load a save first.') };
  const e = entry(sid), pl = e.plots.find((p) => p.id === id);
  if (!pl || !canAct(pl, a)) return { ok: false, error: L('지금은 그렇게 할 수 없습니다.', 'That is not possible right now.') };
  if (!ctx.gameRunning) return { ok: false, error: failText('offline') };
  const cost = actCost(a);
  if (cost.energy || cost.influence) { const st = await pay(cost.energy, cost.influence); if (st !== 'applied' && st !== 'duplicate') return { ok: false, error: failText(st) }; }
  const d = today(), lid = lidOf(pl.pid); let extra = '';
  if (a === 'bribe' || a === 'expose') {
    Object.assign(pl, applyCheck(pl, a));
    pLog(pl, actText(pl, a, (k) => k), actText(pl, a, (_k, en) => en));
  } else {
    if (a === 'demote' || a === 'arrest' || a === 'exile') {
      const exileTo = a === 'exile' && Math.random() < PLOT.exile.defect ? (pl.tid ? { idx: pl.tid, name: pl.target ?? '' } : plotWorld(sid, e).foes[0]) : undefined;
      const st = a === 'demote' ? await leader(lid, 'unassign') : a === 'arrest' ? await leader(lid, 'jail') : exileTo ? await send(lid, exileTo.idx) : await leader(lid, 'exile');
      if (st !== 'applied') return { ok: false, error: failText(st) };
      if (a === 'arrest') e.prisoners.push({ pid: pl.pid, name: pl.name, since: d, plotId: pl.id, state: 'held', cell: e.prisoners.filter((p) => p.state === 'held').length + 1 });
      if (exileTo) { extra = L(` — ${exileTo.name}이(가) 그를 받아 주었다`, ` — ${exileTo.name} took them in`); chronNote(exileTo.idx, L(`${usName()}에서 추방된 ${pl.name}을(를) 받아들였다`, `Took in ${pl.name}, exiled from ${usName()}`)); }
      const b = backlash(a);
      if (b.mood) moodNudge(b.mood, L(`${ACT_NAME[a][0]}: ${pl.name}`, `${ACT_NAME[a][1]}: ${pl.name}`));
      if (b.crack && pl.eth) await mod(`sllm_plot_crack_${pl.eth}`, PLOT.crackDays);
      if (b.protest && pl.eth && Math.random() < b.protest) e.causes.push({ id: 'plot:' + pl.id, eth: pl.eth, text: L(`${pl.name}을(를) ${a === 'arrest' ? '체포' : '추방'}한 데 반발하는 목소리`, `Outrage over the ${a === 'arrest' ? 'arrest' : 'exile'} of ${pl.name}`), until: addYears(d, 1) });
    } else if (a === 'appease' && Math.random() < PLOT.appease.relapse) {
      e.relapses.push({ pid: pl.pid, name: pl.name, kind: pl.kind, at: addYears(d, 1 + Math.floor(Math.random() * PLOT.appease.relapseYears)) });
    }
    pl.ended = d; pl.end = a;
    pLog(pl, actText(pl, a, (k) => k, extra), actText(pl, a, (_k, en) => en, extra));
    chron(actText(pl, a, L, extra), a === 'exile' || a === 'arrest');
  }
  save(); push();
  return { ok: true, text: actText(pl, a, L, extra) };
}
async function freePrisoner(pid: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const e = entry(sid), pr = e.prisoners.find((p) => p.pid === pid && p.state === 'held'); if (!pr) return { ok: false, error: L('그 수감자를 찾지 못했습니다.', 'That prisoner was not found.') };
  const st = await leader(lidOf(pid), 'free'); if (st !== 'applied' && st !== 'no_target') return { ok: false, error: failText(st) };
  pr.state = 'freed'; pr.until = today(); save(); push();
  chron(L(`${pr.name}을(를) 풀어 주었다`, `Released ${pr.name}`));
  return { ok: true, text: L(`${pr.name}을(를) 석방했습니다.`, `${pr.name} was released.`) };
}

// ======================================================================================
// 정략결혼(deals-app 이 거래판에서 부른다)
// ======================================================================================
const kidToMarry = (k: KidInfo, e: SaveEntry): MarryKid => ({ id: k.id, name: k.name, gender: k.gender, leader: k.leader, ...(k.adultLid ? { lid: k.adultLid } : {}), ...(k.job ? { job: k.job } : {}), married: !!k.married || e.marriages.some((m) => m.cid === k.id && m.state !== 'ended'), dead: !!k.dead, adult: k.adult, heir: k.heir });
export function marryView(tid: number) {
  const sid = ctx.curSaveId; if (!sid || !enabled()) return null;
  const e = entry(sid);
  const kids = kidsOf(sid).map((k) => kidToMarry(k, e)).filter(canMarry).map((k) => ({ id: k.id, name: k.name, gender: k.gender, leader: k.leader, heir: !!k.heir, job: k.job ?? '' }));
  const fh = foreignHouse(e, tid); save();
  const ms = e.marriages.filter((m) => m.tid === tid && m.state !== 'ended').map((m) => ({ id: m.id, text: marryText(m, L), state: m.state, on: m.on }));
  return { kids, house: L(`${fh.name} 가문`, `House ${fh.name}`), houseTraits: traitView(fh.traits), marriages: ms, bonus: MARRY.bonus, opinion: MARRY.opinion };
}
export function marryCheck(tid: number, cid: string, war: boolean): string[] {
  const sid = ctx.curSaveId; if (!sid) return ['kid'];
  const e = entry(sid), k = kidsOf(sid).find((x) => x.id === cid);
  return marryErrors(k ? kidToMarry(k, e) : undefined, war, e.marriages.some((m) => m.tid === tid && m.state === 'wed'));
}
export const marryErrText = (codes: string[]) => codes.map((c) => marryErrorText(c, L)).join(' ');
/** 수락된 혼인을 반영: 호감 +40, 기록, (지도자 자녀를 보내기로 했으면) 상대 지도자로. */
export async function marryDone(tid: number, empire: string, cid: string, sendLeader: boolean): Promise<string[]> {
  const sid = ctx.curSaveId; if (!sid) return [];
  const e = entry(sid), k = kidsOf(sid).find((x) => x.id === cid); if (!k) return [];
  const fh = foreignHouse(e, tid), g: 'm' | 'f' = k.gender === 'm' ? 'f' : 'm';
  const spouse = gameName(g, tid) ?? L('이름 모를 배필', 'An unnamed spouse');
  const m: Marriage = { id: randomUUID().replace(/-/g, '').slice(0, 12), cid, child: k.name, childGender: k.gender, tid, empire, spouse, house: fh.name, on: today(), state: 'wed' };
  const out: string[] = [];
  const st = await bond(tid, true); out.push(st === 'applied' ? L(`혼인 동맹: ${empire}의 호감 +${MARRY.opinion}`, `Marriage bond: ${empire} opinion +${MARRY.opinion}`) : failText(st));
  if (sendLeader && k.leader && k.adultLid) {
    const s2 = await send(k.adultLid, tid);
    if (s2 === 'applied') { m.sent = true; m.lid = k.adultLid; out.push(L(`${k.name}이(가) ${empire}(으)로 건너가 그곳의 지도자가 되었습니다.`, `${k.name} moved to ${empire} and is now one of its leaders.`)); }
    else out.push(L(`${k.name}을(를) 보내지 못했습니다: ${failText(s2)}`, `Could not send ${k.name}: ${failText(s2)}`));
  }
  e.marriages.push(m); save(); dayMoodEvent('joy', L('정략결혼', 'A royal marriage'));
  try { courtLink.markWed(sid, cid, { ko: `${empire}의 ${fh.name} 가문 ${spouse}와(과) 혼인했다`, en: `Married ${spouse} of House ${fh.name}, ${empire}`, spouse: `${spouse} (${empire})` }); } catch { /* 아기방 없음 */ }
  chronNote(tid, marryChron(m, usName(), L));
  chron(L(`${k.name}이(가) ${empire}의 ${fh.name} 가문 ${spouse}와(과) 혼인했다`, `${k.name} married ${spouse} of House ${fh.name}, ${empire}`), true);
  push();
  return out;
}
/** 월간: 혼인한 제국과 전쟁 → 혼인 동맹 호감을 떼고 「곤란해진 자녀」. */
async function marryMonth(sid: string, e: SaveEntry): Promise<void> {
  for (const m of e.marriages.filter((x) => x.state === 'wed')) {
    const c = terminal.items.find((x) => x.idx === m.tid); if (!c?.em?.war) continue;
    m.state = 'strained'; m.strainedOn = today();
    await bond(m.tid, false);
    const t = strainText(m, L);
    toast(L('곤란해진 자녀', 'A child caught in between'), t);
    chron(t); chronNote(m.tid, L(`혼인 동맹을 맺은 ${usName()}과(와) 전쟁이 났다`, `War broke out with ${usName()}, despite our marriage bond`));
    try { courtLink.markWed(sid, m.cid, { ko: `${m.empire}과(와) 전쟁이 나 처지가 곤란해졌다`, en: `Caught in between when war broke out with ${m.empire}`, spouse: '' }); } catch { /* 없음 */ }
  }
}

// ======================================================================================
// 화면
// ======================================================================================
/** 암시장 정보상(2026-10-30): 아직 낌새가 없는 진행 중 음모 하나를 미리 귀띔(「수상한 낌새」를 켬). 없으면 null. */
export function courtTipOff(): { kind: string; name: string } | null {
  const sid = ctx.curSaveId; if (!sid) return null; const e = entry(sid);
  const p = e.plots.find((x) => !x.ended && !x.found && !x.hinted); if (!p) return null;
  p.hinted = today(); pLog(p, '암시장 정보상에게서 낌새를 샀다', 'A black-market broker sold a tip'); save(); push(); return { kind: L(...PLOT_NAME[p.kind]), name: p.name };
}
export function courtView() {
  const sid = ctx.curSaveId || '';
  if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 볼 수 있습니다.', 'Load a save first.') };
  if (!enabled()) return { ok: true, off: true };
  const e = entry(sid), d = today();
  const plotV = (p: Plot) => ({
    id: p.id, kind: p.kind, kindName: L(...PLOT_NAME[p.kind]), name: p.found || p.ended ? p.name : p.hinted ? p.name : '', text: p.found || p.ended ? plotText(p, L) : '',
    prog: p.found || p.ended ? p.prog : null, inf: p.found || p.hinted ? p.inf : null, since: p.since, hinted: p.hinted ?? '', found: p.found ?? '', ended: p.ended ?? '', end: p.end ?? '',
    endName: p.end && p.end !== 'won' && p.end !== 'gone' ? L(...ACT_NAME[p.end]) : p.end === 'won' ? L('음모 성공', 'Succeeded') : p.end === 'gone' ? L('흐지부지', 'Fizzled') : '',
    eth: ethName(p.eth), acts: (['bribe', 'expose', 'appease', 'demote', 'arrest', 'exile'] as PlotAct[]).filter((a) => canAct(p, a)).map((a) => ({ key: a, name: L(...ACT_NAME[a]), cost: actCost(a) })),
    log: p.log.slice().reverse().map((l) => ({ date: l.date, text: L(l.ko, l.en) })), wonText: p.end === 'won' ? wonText(p, L) : '',
  });
  const open = e.plots.filter((p) => !p.ended && (p.hinted || p.found));
  const h = curHouse(e);
  return {
    ok: true, today: d, running: !!ctx.gameRunning,
    plots: open.map(plotV), past: e.plots.filter((p) => p.ended && (p.found || p.end === 'won')).slice(-12).reverse().map(plotV),
    quiet: !open.length,
    prisoners: e.prisoners.filter((p) => p.state === 'held').map((p) => ({ pid: p.pid, name: p.name, since: p.since, alive: alive(sid, p.pid) })),
    houseOff: !treeAllowed(sid), house: h && treeAllowed(sid) ? { id: h.id, name: h.name, label: houseLabel(h, L), since: h.since, traits: traitView(h.traits), rulers: h.rulers.map((r) => ({ name: r.name, from: r.from, to: r.to ?? '' })) } : null,
    marriages: e.marriages.slice().reverse().map((m) => ({ id: m.id, text: marryText(m, L), state: m.state, on: m.on })),
    rules: { bribe: PLOT.bribe, expose: PLOT.expose, appease: PLOT.appease, exileDefect: PLOT.exile.defect },
  };
}
function renameHouse(id: string, name: string): { ok: boolean; error?: string } {
  const sid = ctx.curSaveId; if (!sid) return { ok: false };
  const e = entry(sid), h = e.houses.find((x) => x.id === id), nm = houseNameText(name);
  if (!h || !nm) return { ok: false, error: L('이름을 써 주세요.', 'Enter a name.') };
  h.name = nm; h.custom = true; save(); push(); return { ok: true };
}

// ---- 월간
let busy = false, lastMonth = '';
async function monthly(sid: string, d: string): Promise<void> {
  const mk = sid + ':' + d.slice(0, 7);
  if (busy || !d || mk === lastMonth || sid !== ctx.curSaveId || !enabled()) return;
  lastMonth = mk; busy = true;
  try {
    const e = entry(sid);
    { const au = gameState.last?.sid === sid ? gameState.last.authority : undefined; if (au !== undefined) e.auth = au; }
    if (treeAllowed(sid)) houseMonth(sid, e); else rulerWatch(sid, e);
    if (ctx.gameRunning && link.sessionReady) { await plotsMonth(sid, e); await marryMonth(sid, e); }
    save(); push();
  } catch (err) { logDiagnostic('warn', 'court.month_failed', { error: String(err) }); }
  finally { busy = false; }
}

export function registerCourt(router: LogRouter): void {
  courtLink.onBirth = onBirth;
  courtLink.houseLine = houseLineFor;
  courtLink.causes = () => { const sid = ctx.curSaveId; return sid ? entry(sid).causes.map((c) => ({ ...c })) : []; };
  courtLink.kidTraits = (sid, cid) => (!treeAllowed(sid) ? [] : traitView(entry(sid).kin[cid] ?? []).map((t) => t.name));
  router.on(SLOT.COURT, 'court', (m: SllmMessage) => { if (m.kind === 'COURT') terminalReplies.get('COURT:' + m.kv.req)?.(m); });
  onGameSnapshot((snap) => { if (snap.sid) void monthly(snap.sid, snap.date || today()); }, 'court');
  ipcMain.handle('courtView', () => courtView());
  ipcMain.handle('courtTree', () => { const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 볼 수 있습니다.', 'Load a save first.') }; if (!enabled()) return { ok: true, off: true, houses: [] }; if (!treeAllowed(sid)) return { ok: true, off: true, noAuth: true, houses: [] }; return treeView(sid); });
  ipcMain.handle('courtAct', async (_e, id: unknown, a: unknown) => {
    const k = String(a ?? '') as PlotAct; if (!['bribe', 'expose', 'appease', 'demote', 'arrest', 'exile'].includes(k)) return { ok: false };
    const r = await act(String(id ?? ''), k); return { ...r, view: courtView() };
  });
  ipcMain.handle('courtFree', async (_e, pid: unknown) => { const r = await freePrisoner(String(pid ?? '')); return { ...r, view: courtView() }; });
  ipcMain.handle('courtRename', (_e, id: unknown, name: unknown) => { const r = renameHouse(String(id ?? ''), String(name ?? '')); return { ...r, view: courtView() }; });
  ipcMain.handle('devCourtPlot', () => { // 개발자 도구: 음모 하나를 바로 꾸미게 하고 낌새까지
    const sid = ctx.curSaveId; if (!sid) return { ok: false }; const e = entry(sid); const p = startPlot(sid, e); if (!p) return { ok: false, error: 'no candidate' };
    p.prog = PLOT.hintAt; p.hinted = today(); save(); push(); return { ok: true, kind: p.kind, name: p.name };
  });
  void ETHS; void HOUSE_TRAITS;
}
