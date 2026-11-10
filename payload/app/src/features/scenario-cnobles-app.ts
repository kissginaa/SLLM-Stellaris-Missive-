// 회랑의 귀족(시나리오 「회랑의 삼파전」, 앱 쪽, 2026-11-08). 규칙: src/scenario-cnobles.ts · 화면: ui/office-cnobles.js(제국 세력도 「회랑의 귀족」)
// 2026-11-08 사용자: 「그 섹터의 행성이 플레이어 소유로 넘어가면 괴뢰국을 세울지 … 본인의 지도자들을 앉힐 수 있게. 앉힐 때 말투를 그 지도자의 페르소나를 참고하는 거지,
//   대신 자비 같은 특수 특성은 일단은 인식하지 말고. 플레이어의 귀족이라는 다른 창도 생기긴 해야겠네 세력도에」
// 정복지 감지: 은하 지도가 세이브를 읽을 때(domainSyncOwners → cnSyncLand). 회랑 자리 판에서는 석 달마다 한 번 지도를 스스로 읽는다(scenario-map-app).
// 게임으로(처분할 때·배신할 때만 — 매달 신호 없음): 시나리오 모드 common/scripted_effects/sllm_cr_cnoble_effects.txt
//   sllm_cr_cn_mark = { M } (성계 표식) → sllm_cr_cn_appoint = { L [KIND] [IRON] } · sllm_cr_cn_direct · sllm_cr_cn_puppet = { N [PREV K G] } · sllm_cr_cn_dismiss = { L } · sllm_cr_cn_betray = { L S } · sllm_cr_cn_free = { L N }
// 저장: userData/sllm_scenario_cnobles.json(세이브별, 최근 12개, 작업 스레드로 씀).
import { app, ipcMain } from 'electron';
import { libraryPortraitUrl } from './portrait-lib-app';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link, enqueue, sendConsole } from '../app/game-link';
import { bgWriteJson } from '../app/bg-worker';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { withNobleSave } from './scenario-nobles-app';
import { chronNoteWorld } from './chronicle-app';
import { peopleOf } from './people-app';
import { CR_NOBLES } from '../scenario-nobles-data';
import { hash01, shiftLoyal, shiftRel, pairKey, type NSide } from '../scenario-nobles';
import { sysName } from '../scenario-domains';
import {
  CN, newCnSave, fixCnSave, checkTraits, pointsOf, loyalStart, loyalWord, betrayChance, cnYear, cnSeeLand, sysOf, busyLid, sideOfKey, talkLoyal,
  type CnSave, type CnNoble, type CnTie,
} from '../scenario-cnobles';

const KEEP = 12;
const NOBLE_BY_ID = new Map(CR_NOBLES.map((n) => [n.id, n] as [number, (typeof CR_NOBLES)[number]]));
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_cnobles.json');
let all: Record<string, CnSave> | null = null;
function saves(): Record<string, CnSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixCnSave(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_cnobles', error: (e as Error).message }); }
  return all;
}
function save(): void {
  const s = saves(), keys = Object.keys(s); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete s[k];
  bgWriteJson(file(), { saves: s }, (e) => { if (e) logDiagnostic('warn', 'scenario_cnobles.save_failed', { error: e }); });
}
const stateOf = (sid: string): CnSave => { const s = saves(); return (s[sid] ??= newCnSave()); };
/** 회랑 자리를 맡은 시나리오 판의 지금 세이브(아니면 null). */
function mine(): string | null { const s = scenarioNow(), sid = ctx.curSaveId; return s && sid && s.id === 'corridor' && s.seat === 'p' ? sid : null; }
const ready = () => !!(ctx.gameRunning && link.sessionReady);
const yearOf = (date: string): number => { const m = /^(\d{3,5})\./.exec(date || ''); return m ? Number(m[1]) : -1; };
const sideKo = (sd: NSide): string => scenarioNow()?.names?.[sd] || (sd === 'a' ? '은하 얼라이언스' : '인류 제국');
const sideEn = (sd: NSide): string => (sd === 'a' ? 'Galactic Alliance' : 'Human Empire');
const nobleSide = (id: number): 'a' | 'b' | undefined => NOBLE_BY_ID.get(id)?.side;
/** 묶음 이름: 원래 귀족의 옛 영지 · 군주 직할령. [한, 영] */
function groupName(key: number): [string, string] {
  if (key === -1) return [`${sideKo('a')} 직할령`, `${sideEn('a')} crown land`];
  if (key === -2) return [`${sideKo('b')} 직할령`, `${sideEn('b')} crown land`];
  const n = NOBLE_BY_ID.get(key); return n ? [`${n.ko} 가의 옛 영지`, `Former domain of House ${n.en}`] : [`영지 ${key}`, `Domain ${key}`];
}
const gName = (key: number): string => { const [k, e] = groupName(key); return L(k, e); };
function note(s: CnSave, ko: string, en: string, grave = false): void { s.log.push({ d: ctx.gameDate || '', ko, en, ...(grave ? { grave: true } : {}) }); if (s.log.length > CN.keepLog) s.log.splice(0, s.log.length - CN.keepLog); }

// ---- 게임으로 ----
async function cmd(line: string): Promise<void> { await enqueue(() => sendConsole(`effect ${line}`)); }
async function mark(sys: number[]): Promise<void> { for (let i = 0; i < sys.length; i += 12) await cmd(sys.slice(i, i + 12).map((m) => `sllm_cr_cn_mark = { M = ${m} }`).join(' ')); }
const KIND = (n: CnNoble): string => `${n.tr[1] > 0 || n.tr[2] > 0 ? ' KIND = yes' : ''}${n.tr[1] < 0 ? ' IRON = yes' : ''}`;
async function applyGroup(s: CnSave, key: number, sys?: number[]): Promise<void> {
  const g = s.grp[key]; if (!g || g.st === 'pending') return;
  await mark(sys ?? sysOf(s, key));
  const n = g.lid !== undefined ? s.nobles[g.lid] : undefined;
  if (g.st === 'noble' && n && !n.gone) await cmd(`sllm_cr_cn_appoint = { L = ${n.lid}${KIND(n)} }`); else await cmd('sllm_cr_cn_direct = yes');
}
const fail = (e: unknown) => logDiagnostic('warn', 'scenario_cnobles.game_failed', { error: String((e as Error)?.message || e) });

// ---- 정복지 감지(scenario-domains-app 의 domainSyncOwners 가 부른다 — 영지 장부가 바뀌기 전에) ----
export function cnSyncLand(sid: string, systems: Array<{ m: number; o: number }>, me: number | undefined, owner: Record<string, number>): void {
  try {
    if (mine() !== sid || me === undefined) return;
    const s = stateOf(sid), date = ctx.gameDate || '';
    const r = cnSeeLand(s, systems, owner, me, date);
    let ch = r.fresh.length + r.emptied.length + r.added.length > 0;
    for (const g of r.emptied) for (const n of Object.values(s.nobles)) if (!n.gone && n.key === g) { // 맡은 땅을 모두 잃은 귀족
      n.gone = { why: 'lost', d: date }; ch = true;
      note(s, `${n.name}: 맡은 땅(${groupName(g)[0]})을 모두 잃었습니다.`, `${n.name}: lost all of the land in their charge (${groupName(g)[1]}).`);
    }
    if (r.fresh.length) {
      const names = r.fresh.map((g) => groupName(g)), cnt = r.fresh.reduce((a, g) => a + sysOf(s, g).length, 0);
      const ko = `강대국의 땅 ${cnt}곳을 차지했습니다: ${names.map((x) => x[0]).join(' · ')}. 제국 세력도의 「회랑의 귀족」에서 정복지를 처분하세요(괴뢰국 · 우리 귀족 앉히기 · 직할령).`;
      const en = `We have taken ${cnt} system(s) from the great powers: ${names.map((x) => x[1]).join(' · ')}. Decide their fate under "Corridor Nobles" in the Power Atlas (puppet state · appoint one of our own · direct rule).`;
      for (const g of r.fresh) s.grp[g].told = 1;
      note(s, ko, en);
      ctx.notify({ kind: 'office', title: L('정복지 처분', 'Conquered land awaits'), body: L(ko, en) });
    }
    if (r.added.length && ready()) { const by = new Map<number, number[]>(); for (const x of r.added) (by.get(x.g) ?? by.set(x.g, []).get(x.g)!).push(x.m); void (async () => { for (const [g, ms] of by) await applyGroup(s, g, ms); })().catch(fail); }
    if (ch) save();
  } catch (e) { logDiagnostic('warn', 'scenario_cnobles.sync_failed', { error: (e as Error).message }); }
}

// ---- 연례(scenario-domains-app 의 domainOnSectorBook 이 해가 바뀔 때 부른다) ----
let susOf: ((sid: string) => { a: number; b: number } | null) | null = null;
/** 회랑 정보국이 강대국의 의심도를 알려 준다(가져오기 고리를 만들지 않으려고 이 방식). 의심이 높은 강대국일수록 우리 귀족을 흔든다. */
export function setCnPressureSource(fn: (sid: string) => { a: number; b: number } | null): void { susOf = fn; }
let yearBusy = false;
export function cnobleYear(sid: string, date: string): void {
  try {
    if (mine() !== sid || yearBusy) return;
    const y = yearOf(date); if (y < 0) return;
    const s = stateOf(sid); if (s.y === y) return;
    const sus = susOf?.(sid) ?? { a: 0, b: 0 };
    const press = (n: CnNoble) => Math.min(1, (sus[sideOfKey(n.key, nobleSide)] ?? 0) / 100);
    const spied: Array<{ n: CnNoble; by: 'a' | 'b' }> = [];
    const outs = cnYear(s, y, press, (k) => hash01(`${sid}|cn|${k}`), sus, spied);
    for (const x of spied) { // 우리 쪽도 당한다(2026-11-08) — 정보국이 알아챈 것으로 알린다
      const ko = `회랑 정보국 보고: ${sideKo(x.by)}이(가) ${x.n.name}의 하인을 매수한 흔적이 있습니다. 그 귀족이 흔들릴 수 있습니다. 「회랑의 귀족」에서 내부 단속을 할 수 있습니다.`, en = `Intelligence bureau: the ${sideEn(x.by)} appears to have bought one of ${x.n.name}'s servants. The noble may waver. Order a purge under "Corridor nobles".`;
      note(s, ko, en, true); ctx.notify({ kind: 'office', title: L('우리 귀족 곁의 첩자', 'A spy beside our noble'), body: L(ko, en) });
    }
    cnTieYear(sid, s);
    save();
    if (!outs.length || !ready()) return;
    yearBusy = true;
    void (async () => { for (const o of outs) await betray(sid, s, o.n, o.kind, date); })().catch(fail).finally(() => { yearBusy = false; save(); });
  } catch (e) { logDiagnostic('warn', 'scenario_cnobles.year_failed', { error: (e as Error).message }); }
}
/** 배신(2026-11-08 사용자: 「배신 같은 거네. 재밌다」): 독립(맡은 땅을 들고 새 나라 + 독립 전쟁) 또는 원래 강대국으로 귀순(땅을 넘기고 떠남). */
async function betray(sid: string, s: CnSave, n: CnNoble, kind: 'free' | 'betray', date: string): Promise<void> {
  const sys = sysOf(s, n.key); if (!sys.length) return;
  const to = sideOfKey(n.key, nobleSide);
  await mark(sys);
  if (kind === 'free') await cmd(`sllm_cr_cn_free = { L = ${n.lid} N = ${n.key} }`); else await cmd(`sllm_cr_cn_betray = { L = ${n.lid} S = ${to} }`);
  n.gone = { why: kind, d: date, ...(kind === 'betray' ? { to } : {}) };
  delete s.grp[n.key]; for (const m of sys) delete s.land[m];
  const land = groupName(n.key);
  const ko = kind === 'free' ? `${n.name}이(가) 배신했습니다. 맡겨 둔 ${land[0]}(성계 ${sys.length}곳)을 들고 독립을 선포하고 회랑에 칼을 겨눴습니다.` : `${n.name}이(가) 배신했습니다. 맡겨 둔 ${land[0]}(성계 ${sys.length}곳)을 ${sideKo(to)}에 바치고 그쪽으로 넘어갔습니다.`;
  const en = kind === 'free' ? `${n.name} has betrayed us, declaring independence with the ${land[1]} (${sys.length} systems) we entrusted to them, and turning their blade on the Corridor.` : `${n.name} has betrayed us, handing the ${land[1]} (${sys.length} systems) we entrusted to them over to the ${sideEn(to)} and defecting.`;
  note(s, ko, en, true);
  ctx.notify({ kind: 'office', title: L('귀족의 배신', 'A noble betrays us'), body: L(ko, en) });
  try { chronNoteWorld(L(`${date} ${ko}`, `${date} ${en}`), true); } catch { /* 연대기는 덤 */ }
  logDiagnostic('info', 'scenario_cnobles.betray', { sid, lid: n.lid, key: n.key, kind, systems: sys.length });
}

// ---- 화면 ----
function candidates(sid: string, s: CnSave): Array<{ lid: number; name: string; cls: string; lv: number; ruler: boolean }> {
  return peopleOf(sid).filter((p) => !p.gone && !p.ruler && !busyLid(s, p.lid)).map((p) => ({ lid: p.lid, name: p.name, cls: p.cls, lv: p.lv, ruler: !!p.ruler })).sort((a, b) => b.lv - a.lv || a.name.localeCompare(b.name));
}
/** 우리 귀족 얼굴(2026-11-08): 회랑 통치자 종족의 초상 도서관에서 그 지도자 번호로 고정해 뽑는다 — 은하 지도·세력지도와 같은 얼굴. */
export function cnPic(sid: string, lid: number): string | undefined {
  try { const idx = scenarioNow()?.idx?.p, r = idx ? ctx.flagProv.rulerFor(idx) : null; return libraryPortraitUrl(r?.portrait || 'human', '', `${sid}|cn|${lid}`, 'governor'); } catch { return undefined; }
}
const SIDE_NAME = (sd: 'a' | 'b'): string => (sd === 'a' ? L(sideKo('a'), sideEn('a')) : L(sideKo('b'), sideEn('b')));
const CLS = (): Record<string, string> => ({ commander: L('지휘관', 'Commander'), official: L('관료', 'Official'), scientist: L('과학자', 'Scientist') });
/** 우리 나라를 부르는 이름 [한, 영](2026-11-08 사용자: 「OO 직할」·「OO의 귀족」). 직접 정한 이름 → 게임 속 우리 나라 이름 → 「회랑」. */
export function cnRealm(sid?: string): [string, string] {
  const id = sid ?? ctx.curSaveId ?? ''; const own = id ? saves()[id]?.realm : undefined; if (own) return [own, own];
  const g = scenarioNow()?.names?.p || ''; return g ? [g, g] : ['회랑', 'the Corridor'];
}
/** 화면용 이름 묶음: rule 「OO 직할」 · nobles 「OO의 귀족」 · noble 「OO의 귀족」(한 사람) · subject 「OO의 속국」 */
export function cnRealmWords(sid?: string): Record<string, string> {
  const [k, e] = cnRealm(sid), E = e === 'the Corridor' ? 'Corridor' : e;
  return { name: L(k, e), rule: L(`${k} 직할`, `${E} rule`), nobles: L(`${k}의 귀족`, `${E} nobles`), noble: L(`${k}의 귀족`, `${E} noble`), subject: L(`${k}의 속국`, `${E} subject`), own: saves()[sid ?? ctx.curSaveId ?? '']?.realm ?? '' };
}
function info(): Record<string, unknown> {
  const scn = scenarioNow(), sid = ctx.curSaveId || '';
  if (!scn || scn.id !== 'corridor' || !sid) return { ok: true, on: false };
  if (scn.seat !== 'p') return { ok: true, on: true, seat: false };
  const s = stateOf(sid);
  const alive = withNobleSave(sid, (ns) => (id: number) => !ns.fate[id] && !ns.pending[id]);
  const cls = CLS();
  const groups = Object.entries(s.grp).map(([k, g]) => {
    const key = Number(k), sys = sysOf(s, key), pn = NOBLE_BY_ID.get(key), n = g.lid !== undefined ? s.nobles[g.lid] : undefined;
    return { key, st: g.st, since: g.since, name: gName(key), sys: sys.map((m) => ({ m, name: L(...sysName(m)) })),
      canPuppet: key >= 0, ...(pn ? { prev: { id: pn.id, name: L(pn.ko, pn.en), alive: alive(pn.id), side: pn.side, pic: `assets/scenario/corridor/gov/gov_${pn.side.toUpperCase()}-${pn.id}.png` } } : {}),
      side: sideOfKey(key, nobleSide), ...(n && !n.gone ? { lid: n.lid, lord: n.name } : {}) };
  }).sort((a, b) => Number(b.st === 'pending') - Number(a.st === 'pending') || b.sys.length - a.sys.length);
  const nobles = Object.values(s.nobles).map((n) => {
    const w = loyalWord(n.loyal);
    const pic = cnPic(sid, n.lid);
    return { lid: n.lid, name: n.name, key: n.key, land: gName(n.key), ...(pic ? { pic } : {}), sys: n.gone ? 0 : sysOf(s, n.key).length, tr: n.tr, loyal: n.loyal, word: L(w[0], w[1]), risk: Math.round(betrayChance(n) * 100), warn: n.loyal < CN.warnAt, since: n.since,
      ...(n.gone ? { gone: n.gone.why, goneD: n.gone.d } : {}), ...(n.spy && !n.gone ? { spy: SIDE_NAME(n.spy) } : {}),
      ...(n.ties?.length && !n.gone ? { ties: n.ties.map((t) => { const p = NOBLE_BY_ID.get(t.id); return { id: t.id, k: t.k, name: p ? L(p.ko, p.en) : '?', ...(p ? { pic: `assets/scenario/corridor/gov/gov_${p.side.toUpperCase()}-${p.id}.png` } : {}), ...(t.g ? { fallen: true } : {}) }; }) } : {}) };
  }).sort((a, b) => Number(!!a.gone) - Number(!!b.gone) || a.loyal - b.loyal);
  return { ok: true, on: true, seat: true, realm: cnRealmWords(sid), base: CN.base, purgeCost: CN.purgeCost, groups, nobles, cands: candidates(sid, s).map((c) => ({ ...c, clsName: cls[c.cls] ?? c.cls })), puppets: s.puppets.map((p) => ({ name: gName(p.key), d: p.d, prev: p.prev })), log: s.log.slice(-30).reverse().map((l) => ({ d: l.d, text: L(l.ko, l.en), grave: !!l.grave })), live: ready() };
}

async function act(req: unknown): Promise<Record<string, unknown>> {
  const r = (req ?? {}) as { a?: string; key?: number; lid?: number; tr?: unknown; prev?: boolean };
  const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리를 맡은 시나리오 판에서만 쓸 수 있습니다.', 'Only available when playing the Corridor seat in this scenario.') };
  if (r.a === 'realm') { // 우리 나라 부르는 이름(2026-11-08) — 비우면 게임 속 나라 이름으로
    const nm = String((req as { name?: unknown }).name ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 24);
    const rs = stateOf(sid); if (nm) rs.realm = nm; else delete rs.realm; save(); return { ok: true, ...info() };
  }
  if (!ready()) return { ok: false, error: L('게임이 켜져 있고 앱과 이어져 있어야 합니다.', 'The game must be running and linked to the app.') };
  const s = stateOf(sid), date = ctx.gameDate || '', key = Number(r.key);
  if (r.a === 'purge') { // 내부 단속(2026-11-08): 에너지를 들여 첩자를 걷어낸다 — 귀족은 조금 불쾌해한다
    const n = s.nobles[Number(r.lid)]; if (!n || n.gone) return { ok: false, error: L('그런 귀족이 없습니다.', 'No such noble.') };
    if (!n.spy) return { ok: false, error: L('걷어낼 첩자가 보고되지 않았습니다.', 'No spy has been reported.') };
    try { await cmd(`add_resource = { energy = -${CN.purgeCost} }`); } catch (e) { return { ...info(), ok: false, error: (e as Error).message }; } // 에너지가 모자라면 단속하지 않는다(2026-11-08)
    delete n.spy; n.loyal = Math.max(0, n.loyal + CN.purgeLoyal);
    note(s, `${n.name}의 저택을 단속해 첩자를 걷어냈습니다. 귀족은 의심받은 것에 조금 언짢아합니다.`, `We purged ${n.name}'s household of spies. The noble is a little offended at the suspicion.`);
    save(); return { ok: true, ...info() };
  }
  if (r.a === 'dismiss') {
    const n = s.nobles[Number(r.lid)]; if (!n || n.gone) return { ok: false, error: L('그런 귀족이 없습니다.', 'No such noble.') };
    n.gone = { why: 'dismissed', d: date }; const g = s.grp[n.key]; if (g) { g.st = 'direct'; delete g.lid; }
    await cmd(`sllm_cr_cn_dismiss = { L = ${n.lid} }`).catch(fail); await applyGroup(s, n.key).catch(fail);
    note(s, `${n.name}을(를) 귀족 자리에서 물렸습니다. ${groupName(n.key)[0]}은(는) 직할령이 되었습니다.`, `${n.name} was removed from their seat. The ${groupName(n.key)[1]} is now under direct rule.`);
    save(); return { ok: true, ...info() };
  }
  const g = s.grp[key]; if (!g) return { ok: false, error: L('처분할 땅이 아닙니다.', 'That land is not ours to dispose of.') };
  const sys = sysOf(s, key); if (!sys.length) return { ok: false, error: L('그 땅을 이미 잃었습니다.', 'That land has already been lost.') };
  const land = groupName(key);
  if (r.a === 'direct') {
    if (g.st === 'noble' && g.lid !== undefined) return { ok: false, error: L('귀족을 먼저 물리세요.', 'Remove the noble first.') };
    g.st = 'direct'; await applyGroup(s, key).catch(fail);
    note(s, `${land[0]}을(를) 직할령으로 두었습니다. 정당성이 없어 안정도가 떨어집니다.`, `The ${land[1]} is held under direct rule. Lacking legitimacy, its stability suffers.`);
    save(); return { ok: true, ...info() };
  }
  if (r.a === 'appoint') {
    if (g.st === 'noble' && g.lid !== undefined && s.nobles[g.lid] && !s.nobles[g.lid].gone) return { ok: false, error: L('이미 귀족이 있습니다. 먼저 물리세요.', 'A noble already holds it. Remove them first.') };
    const lid = Number(r.lid), p = peopleOf(sid).find((x) => x.lid === lid && !x.gone);
    if (!p || p.ruler) return { ok: false, error: L('앉힐 지도자를 고르세요(통치자는 안 됩니다).', 'Choose a leader to appoint (not the ruler).') };
    if (busyLid(s, lid)) return { ok: false, error: L('이미 다른 땅을 맡은 귀족입니다.', 'That leader already holds other land.') };
    const tr = checkTraits(r.tr); if (tr === 'bad') return { ok: false, error: L('성격 칸이 바르지 않습니다.', 'Invalid personality.') }; if (tr === 'over') return { ok: false, error: L('점수를 넘게 찍었습니다.', 'Too many points spent.') };
    const n: CnNoble = { lid, name: p.name, key, tr, loyal: loyalStart(tr), since: date };
    s.nobles[lid] = n; g.st = 'noble'; g.lid = lid;
    await applyGroup(s, key).catch(fail);
    note(s, `${p.name}을(를) ${land[0]}의 귀족으로 앉혔습니다(성계 ${sys.length}곳). 정당성이 서서 안정도가 오릅니다.`, `${p.name} was made noble of the ${land[1]} (${sys.length} systems). Legitimacy brings stability.`);
    try { chronNoteWorld(L(`${date} 회랑이 ${p.name}을(를) ${land[0]}의 귀족으로 앉혔습니다.`, `${date} The Corridor made ${p.name} noble of the ${land[1]}.`)); } catch { /* 덤 */ }
    logDiagnostic('info', 'scenario_cnobles.appoint', { sid, lid, key, tr: tr.join(','), pts: pointsOf(tr).left });
    save(); return { ok: true, ...info() };
  }
  if (r.a === 'puppet') {
    const pn = NOBLE_BY_ID.get(key); if (!pn) return { ok: false, error: L('귀족의 옛 영지만 괴뢰국으로 세울 수 있습니다.', 'Only a former noble domain can become a puppet state.') };
    if (g.st === 'noble' && g.lid !== undefined && s.nobles[g.lid] && !s.nobles[g.lid].gone) return { ok: false, error: L('귀족을 먼저 물리세요.', 'Remove the noble first.') };
    const usePrev = !!r.prev && withNobleSave(sid, (ns) => !ns.fate[pn.id] && !ns.pending[pn.id]);
    await mark(sys);
    await cmd(`sllm_cr_cn_puppet = { N = ${key}${usePrev ? ` PREV = yes K = ${pn.side}_${pn.id} G = ${({ m: 'male', f: 'female', x: 'indeterminate' } as const)[pn.g]}` : ''} }`).catch(fail);
    if (usePrev) withNobleSave(sid, (ns) => { // 원래 귀족이 회랑의 괴뢰 군주로 — 원래 진영에서는 배신자(2026-11-08 설계 3-1)
      delete ns.pending[pn.id]; ns.fate[pn.id] = 'defect_p';
      for (const m of CR_NOBLES) if (m.side === pn.side && m.id !== pn.id && !ns.fate[m.id]) shiftLoyal(ns, m.id, -2);
      ns.notes.push({ d: date, id: pn.id, kind: 'fate', ko: `${pn.ko}: 회랑의 괴뢰 군주가 됨`, en: `${pn.en}: Became the Corridor's puppet ruler` });
    });
    s.puppets.push({ key, d: date, prev: usePrev, sys: [...sys] }); delete s.grp[key]; for (const m of sys) delete s.land[m];
    const ko = usePrev ? `${land[0]}에 괴뢰국을 세웠습니다. ${pn.ko}이(가) 옛 주인을 버리고 회랑의 괴뢰 군주가 되었습니다.` : `${land[0]}에 괴뢰국을 세웠습니다(성계 ${sys.length}곳).`;
    const en = usePrev ? `A puppet state was raised in the ${land[1]}. ${pn.en} abandoned their old master to rule as the Corridor's puppet.` : `A puppet state was raised in the ${land[1]} (${sys.length} systems).`;
    note(s, ko, en); try { chronNoteWorld(L(`${date} ${ko}`, `${date} ${en}`), true); } catch { /* 덤 */ }
    logDiagnostic('info', 'scenario_cnobles.puppet', { sid, key, prev: usePrev, systems: sys.length });
    save(); return { ok: true, ...info() };
  }
  return { ok: false, error: L('알 수 없는 명령입니다.', 'Unknown command.') };
}

// ---- 관계망(2026-11-08 사용자: 「회랑의 귀족도 강대국 귀족들 사이에 낄 수 있게」) ----
/** 해마다: 친분·혼인 상대의 속마음(충성)을 알게 되고, 혼인 상대는 자기 군주에게서 조금 멀어진다. 혼인 상대가 몰락했으면 우리 귀족이 흔들린다(한 번). */
function cnTieYear(sid: string, s: CnSave): void {
  const live = Object.values(s.nobles).filter((n) => !n.gone && n.ties?.length); if (!live.length) return;
  withNobleSave(sid, (ns) => {
    for (const n of live) for (const t of n.ties!) {
      const p = NOBLE_BY_ID.get(t.id); if (!p) continue;
      if (ns.fate[t.id]) {
        if (t.k === 'union' && !t.g) { t.g = 1; n.loyal = Math.max(0, n.loyal + CN.tieGrief); note(s, `${n.name}의 혼인 상대 ${p.ko}이(가) 몰락했습니다. ${n.name}이(가) 크게 흔들립니다(충성 ${CN.tieGrief}).`, `${n.name}'s spouse ${p.en} has fallen. ${n.name} is badly shaken (loyalty ${CN.tieGrief}).`, true); }
        continue;
      }
      ns.knownLoyal[String(t.id)] = true;
      if (t.k === 'union') shiftLoyal(ns, t.id, CN.tiePull);
    }
  });
}
/** 인연을 맺는다(이미 있으면 혼인으로만 올린다). 맺었으면 true. */
export function cnTie(sid: string, lid: number, id: number, k: 'friend' | 'union', date: string): boolean {
  const s = saves()[sid], n = s?.nobles[lid]; if (!s || !n || n.gone || !NOBLE_BY_ID.has(id)) return false;
  const t = (n.ties ??= []), o = t.find((x) => x.id === id);
  if (o) { if (k === 'union' && o.k !== 'union') { o.k = 'union'; o.d = date; save(); return true; } return false; }
  if (t.length >= CN.maxTies) return false;
  t.push({ id, k, d: date }); save(); return true;
}
/** 우리 귀족 한 사람의 인연(떠났으면 빈 목록). */
export function cnTiesFor(sid: string, lid: number): CnTie[] { const n = saves()[sid]?.nobles[lid]; return n && !n.gone ? n.ties ?? [] : []; }
/** 강대국 귀족 한 사람과 인연이 있는 우리 귀족들. */
export function cnTiesOf(sid: string, id: number): Array<{ lid: number; name: string; k: 'friend' | 'union' }> {
  const s = saves()[sid]; if (!s) return [];
  const out: Array<{ lid: number; name: string; k: 'friend' | 'union' }> = [];
  for (const n of Object.values(s.nobles)) { if (n.gone) continue; const t = n.ties?.find((x) => x.id === id); if (t) out.push({ lid: n.lid, name: n.name, k: t.k }); }
  return out;
}
/** 우리 귀족과 혼인으로 묶인 강대국 귀족 번호. */
export function cnUnionIds(sid: string): Set<number> { const out = new Set<number>(); for (const n of Object.values(saves()[sid]?.nobles ?? {})) if (!n.gone) for (const t of n.ties ?? []) if (t.k === 'union') out.add(t.id); return out; }
/** 정략 혼인(접견에서 명할 때): 우리 귀족 충성 · 상대 가문의 마음으로 정한다. 결과 문구[한, 영]와 성공 여부. */
export function cnMatch(sid: string, lid: number, id: number, date: string, opts: { known: boolean; spouse: boolean; playerWed: boolean }): { ok: boolean; text: [string, string] } {
  const s = saves()[sid], n = s?.nobles[lid], p = NOBLE_BY_ID.get(id); if (!s || !n || n.gone || !p) return { ok: false, text: ['그런 사람이 없습니다.', 'No such person.'] };
  const name: [string, string] = [p.ko, p.en];
  if (!opts.known) return { ok: false, text: [`${n.name}: 「${name[0]}이라니, 우리가 아는 집안이 아닙니다.」 먼저 그 귀족을 알아야 합니다.`, `${n.name}: "${name[1]}? We do not even know that house." We must come to know that noble first.`] };
  if (n.ties?.some((t) => t.k === 'union')) return { ok: false, text: [`${n.name}은(는) 이미 혼인으로 묶인 몸입니다.`, `${n.name} is already bound by marriage.`] };
  if (opts.spouse || opts.playerWed || cnUnionIds(sid).has(id)) return { ok: false, text: [`${name[0]}에게는 이미 혼약 상대가 있습니다.`, `${name[1]} is already promised to someone.`] };
  if (n.loyal < CN.matchLoyal) { n.loyal = Math.max(0, n.loyal - 3); save(); return { ok: false, text: [`${n.name}이(가) 자신을 흥정거리로 쓰느냐며 거절했습니다(충성 −3).`, `${n.name} refused, asking whether they are a bargaining chip (loyalty −3).`] }; }
  return withNobleSave(sid, (ns) => {
    if (ns.fate[id] || ns.pending[id]) return { ok: false, text: [`${name[0]}의 집안은 지금 혼사를 논할 처지가 아닙니다.`, `${name[1]}'s house is in no position to discuss a match.`] as [string, string] };
    const rel = ns.rel[pairKey(id, 'P')] ?? 0, lv = ns.loyal[id] ?? 100;
    if (rel < CN.matchRel && lv >= CN.matchTargetLoyal) { shiftRel(ns, id, 'P', -2); return { ok: false, text: [`${name[0]}의 집안이 회랑과의 혼사를 정중히 물렸습니다. 먼저 그 귀족과 가까워져야 합니다.`, `${name[1]}'s house politely declined a match with the Corridor. Grow closer to that noble first.`] as [string, string] }; }
    if (!cnTie(sid, lid, id, 'union', date)) return { ok: false, text: ['혼인을 맺지 못했습니다(인연이 너무 많습니다).', 'The match could not be made (too many ties).'] as [string, string] };
    shiftRel(ns, id, 'P', CN.matchBonus); shiftLoyal(ns, id, CN.matchPull); ns.knownLoyal[String(id)] = true;
    note(s, `${n.name}과(와) ${name[0]}의 정략 혼인이 맺어졌습니다.`, `A political marriage was arranged between ${n.name} and ${name[1]}.`, true);
    try { chronNoteWorld(L(`${date} 회랑의 귀족 ${n.name}과(와) ${p.side === 'a' ? '은하 얼라이언스' : '인류 제국'}의 ${name[0]}이(가) 혼인으로 맺어졌습니다.`, `${date} The Corridor noble ${n.name} and ${name[1]} of the ${p.side === 'a' ? 'Galactic Alliance' : 'Human Empire'} were joined in marriage.`), true); } catch { /* 연대기는 덤 */ }
    return { ok: true, text: [`${n.name}과(와) ${name[0]}의 정략 혼인이 맺어졌습니다. ${name[0]}이(가) 우리에게 한결 가까워지고, 그 속마음도 알게 됩니다.`, `${n.name} and ${name[1]} are now joined by a political marriage. ${name[1]} draws closer to us, and we learn where their heart lies.`] as [string, string] };
  });
}

// ---- 접견(scenario-audience-app 이 부른다) ----
/** 접견할 수 있는 회랑의 귀족(떠나지 않은). */
export function cnobleOf(sid: string, lid: number): { lid: number; name: string; key: number; land: string; tr: CnNoble['tr']; loyal: number; word: string; side: 'a' | 'b'; sys: number } | null {
  const n = saves()[sid]?.nobles[lid]; if (!n || n.gone) return null;
  const w = loyalWord(n.loyal);
  return { lid: n.lid, name: n.name, key: n.key, land: gName(n.key), tr: n.tr, loyal: n.loyal, word: L(w[0], w[1]), side: sideOfKey(n.key, nobleSide), sys: sysOf(saves()[sid], n.key).length };
}
/** 영어 프롬프트용 땅 이야기. */
export function cnobleLandEn(sid: string, lid: number): string {
  const s = saves()[sid], n = s?.nobles[lid]; if (!s || !n) return '';
  const sys = sysOf(s, n.key), names = sys.slice(0, 5).map((m) => sysName(m)[1]).join(', ');
  return `${groupName(n.key)[1]} (${sys.length} systems${names ? `: ${names}${sys.length > 5 ? ', …' : ''}` : ''}), conquered from the ${sideEn(sideOfKey(n.key, nobleSide))}`;
}
/** 지금 자리에 있는 회랑의 귀족(적 공작 「회랑 귀족 포섭」의 표적, 2026-11-08). */
/** 은하 지도·세력지도(2026-11-08 사용자: 「점령하고 나서 우리 귀족의 영역도, 내 땅인 것도 안 뜬다」): 회랑이 쥔 정복지 무리와 앉힌 귀족. */
export function cnMapGroups(sid: string): Array<{ key: number; sys: number[]; st: string; lid?: number; lord?: string; name: [string, string] }> {
  const s = saves()[sid]; if (!s) return [];
  return Object.entries(s.grp).map(([k, g]) => { const key = Number(k), n = g.lid !== undefined ? s.nobles[g.lid] : undefined; return { key, sys: sysOf(s, key), st: g.st, ...(n && !n.gone ? { lid: n.lid, lord: n.name } : {}), name: groupName(key) }; }).filter((x) => x.sys.length > 0);
}
/** 지도(2026-11-08 사용자: 「속국이 1년이 지나도 빈 영지로 나온다」): 회랑이 세운 괴뢰국. key 는 옛 귀족 거점(지도 번호), prev 면 그 귀족이 군주. */
export function cnPuppets(sid: string): Array<{ key: number; sys: number[]; prev: boolean; name: [string, string] }> {
  const s = saves()[sid]; if (!s) return [];
  return s.puppets.map((p) => ({ key: p.key, sys: p.sys ?? [p.key], prev: p.prev, name: groupName(p.key) }));
}
export function cnActive(sid: string): Array<{ lid: number; name: string }> { const s = saves()[sid]; return s ? Object.values(s.nobles).filter((n) => !n.gone).map((n) => ({ lid: n.lid, name: n.name })) : []; }
/** 위협 탭(2026-11-08): 충성이 「불온」 아래로 떨어진 회랑의 귀족 */
export function cnRisky(sid: string): Array<{ lid: number; name: string; loyal: number; risk: boolean }> {
  const s = saves()[sid]; return s ? Object.values(s.nobles).filter((n) => !n.gone && n.loyal < CN.warnAt).map((n) => ({ lid: n.lid, name: n.name, loyal: Math.round(n.loyal), risk: n.loyal < CN.riskAt })).sort((a, b) => a.loyal - b.loyal) : [];
}
/** 적 공작으로 충성이 흔들린다(한 해 한도 없음). 움직인 만큼 돌려준다. */
/** 접견에서 내린 첩자 단속 지시(2026-11-08 숨은 대화 카드). 「내부 단속」과 같다 — 에너지가 모자라면 하지 않는다. */
export async function cnPurgeSpy(sid: string, lid: number): Promise<[string, string]> {
  const s = saves()[sid], n = s?.nobles[lid]; if (!s || !n || n.gone) return ['그런 귀족이 없습니다.', 'No such noble.'];
  if (!n.spy) return [`${n.name}의 집안에서 첩자가 보고되지 않았습니다. 단속할 대상이 없습니다.`, `No spy has been reported in ${n.name}'s household. There is no one to purge.`];
  try { await cmd(`add_resource = { energy = -${CN.purgeCost} }`); } catch { return [`에너지가 모자라 단속하지 못했습니다(에너지 ${CN.purgeCost}).`, `Not enough energy for the purge (${CN.purgeCost}).`]; }
  delete n.spy; n.loyal = Math.max(0, n.loyal + CN.purgeLoyal);
  note(s, `${n.name}에게 집안 단속을 명해 첩자를 걷어냈습니다.`, `${n.name} was ordered to purge their household; the spy is gone.`); save();
  return [`${n.name}이(가) 집안을 뒤져 첩자를 걷어냈습니다(에너지 ${CN.purgeCost}, 충성 ${CN.purgeLoyal}).`, `${n.name} searched the household and rooted out the spy (${CN.purgeCost} energy, loyalty ${CN.purgeLoyal}).`];
}
export function cnobleShake(sid: string, lid: number, d: number): number {
  const s = saves()[sid], n = s?.nobles[lid]; if (!s || !n || n.gone) return 0;
  const v = Math.max(0, Math.min(100, n.loyal + d)), moved = v - n.loyal; n.loyal = v; if (moved) save(); return moved;
}
/** 접견 말솜씨로 충성이 움직인다(한 해 한도). */
export function cnobleTalk(sid: string, lid: number, warmth: number): number {
  const s = saves()[sid], n = s?.nobles[lid]; if (!s || !n || n.gone) return 0;
  const d = talkLoyal(n, warmth, yearOf(ctx.gameDate || '')); if (d) save(); return d;
}

// ---- 개발자 도구(2026-11-08 사용자: 「개발자 도구에서 즉각 테스트되게」) ----
/** 정복지 하나를 지금 만든다: 게임에서도 그 성계를 회랑에 넘기고(sllm_cr_cn_devtake), 장부에 「처분 대기」로 넣는다. */
export async function cnDevTake(sid: string, key: number, sys: number[]): Promise<string> {
  const s = stateOf(sid), date = ctx.gameDate || '';
  if (ready()) { await mark(sys); await cmd('sllm_cr_cn_devtake = yes'); }
  for (const m of sys) s.land[m] = key; if (!s.grp[key]) s.grp[key] = { st: 'pending', since: date, told: 1 };
  note(s, `(개발자 도구) ${groupName(key)[0]} 성계 ${sys.length}곳을 차지했습니다.`, `(Dev tools) Took ${sys.length} system(s) of the ${groupName(key)[1]}.`); save();
  return L(`${groupName(key)[0]} · 성계 ${sys.length}곳 — 세력도 「회랑의 귀족」에서 처분하세요${ready() ? '' : '(게임이 꺼져 있어 장부에만 넣었습니다)'}`, `${groupName(key)[1]} · ${sys.length} system(s) — dispose of it under "Corridor nobles"${ready() ? '' : ' (game offline: ledger only)'}`);
}
/** 우리 귀족 하나를 지금 배신시키거나(kind) 첩자를 심거나, 연례를 지금 돌린다. */
export async function cnDev(sid: string, a: string, kind?: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  const s = stateOf(sid), date = ctx.gameDate || '', live = Object.values(s.nobles).filter((n) => !n.gone);
  if (a === 'year') { s.y = -1; cnobleYear(sid, date || '2200.01.01'); return { ok: true, message: L(`연례를 돌렸습니다 — 우리 귀족 ${live.length}명`, `Yearly pass run — ${live.length} noble(s)`) }; }
  if (!live.length) return { ok: false, error: L('앉힌 우리 귀족이 없습니다. 먼저 정복지를 만들고 귀족을 앉히세요.', 'No noble appointed yet. Take land and appoint one first.') };
  const n = live[Math.floor(Math.random() * live.length)];
  if (a === 'spy') { n.spy = Math.random() < 0.5 ? 'a' : 'b'; save(); return { ok: true, message: L(`${n.name} 곁에 ${sideKo(n.spy)} 첩자를 심었습니다(내부 단속 단추 확인).`, `Planted a ${sideEn(n.spy)} spy beside ${n.name} (check the purge button).`) }; }
  if (a === 'betray') {
    if (!ready()) return { ok: false, error: L('게임이 연결돼 있어야 합니다.', 'The game must be connected.') };
    const k = kind === 'free' || kind === 'betray' ? kind : (n.key >= 0 && Math.random() < 0.5 ? 'free' : 'betray');
    await betray(sid, s, n, k as 'free' | 'betray', date); save();
    return { ok: true, message: L(`${n.name} 배신 실행(${k === 'free' ? '독립' : '귀순'})`, `${n.name} betrayed (${k === 'free' ? 'independence' : 'defection'})`) };
  }
  if (a === 'low') { n.loyal = 15; save(); return { ok: true, message: L(`${n.name}의 충성을 15로 낮췄습니다(배신 위험 표시 확인).`, `Set ${n.name}'s loyalty to 15 (check the betrayal warning).`) }; }
  return { ok: false, error: 'unknown' };
}
export function registerScenarioCnobles(): void {
  ipcMain.handle('scnCn', async () => { try { return info(); } catch (e) { logDiagnostic('warn', 'scenario_cnobles.info_failed', { error: String(e) }); return { ok: false }; } });
  ipcMain.handle('scnCnAct', async (_e, req: unknown) => { try { return await act(req); } catch (e) { logDiagnostic('warn', 'scenario_cnobles.act_failed', { error: String(e) }); return { ok: false, error: String((e as Error).message || e) }; } });
}
export const scnCnTest = { reset: () => { all = {}; }, info, act, stateOf };
