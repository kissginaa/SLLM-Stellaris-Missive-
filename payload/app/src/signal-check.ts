// 「바뀔 때만 신호」 자체 검사(2026-11-09 회랑 방식을 본편에). selftest.ts 에서 runSignalChecks() 로 부른다.
// 정기 송금(외교 거래 매달 지급·반란군 후원) · 취약 판정 모드 위임 · 대리전·징발 신호 · 동맹 방어전 줄 · 일정표 날짜 울림 · 월간 상황 바뀐 것만.
import * as fs from 'fs';
import * as path from 'path';
import { mtSetCommand, mtUnsetCommand, parseMt, nextG, MT_RES, MT_OWNER } from './mtransfer';
import { mtStep, type Agreement } from './deals';
import { ringByDate, monthsApart, ALARM_RESCAN_MONTHS, type Alarm } from './alarm';
import { vulnAutoCommand } from './rebels';
import { StateCollector, carryKept, STATE_KEEP, type StateSnapshot } from './gamestate';
import { saveSignalOf, ourGovChanged, saveTooOld, SAVE_REREAD_MONTHS } from './save-signal';
import { FlagProvider } from './flags';
import { effectKey, UsageMeter } from './usage-meter';
import { watchCommand, parseWatch } from './isc-quest';
import { buildRelGraph, ringsOf } from './relgraph';
import { emptyLedger, getPair } from './relations';
import { scenesOf, classFor, photoClass, pickPhoto, photoMenu, pickAd, seeded, tabOf, shipKeyOf, TAB_RULES, type PhotoEntry } from './newsphoto';
import { sectionMessages, parseSection, sectionKey } from './galnews';
import { knownEmpire, GALAXY_WIDE, newsFrom, newsText, MAJOR_WORLD, NOT_ON_RADIO } from './mail';

export function runSignalChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'signals: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  const root = path.join(__dirname, '..');
  const rd = (...p: string[]) => { try { return fs.readFileSync(path.join(root, ...p), 'utf8'); } catch { return ''; } };
  const bal = (s: string) => { let d = 0; for (const ch of s.replace(/#.*$/gm, '').replace(/"[^"\n]*"/g, '')) { if (ch === '{') d++; else if (ch === '}') { d--; if (d < 0) return false; } } return d === 0; };
  const noParamInLog = (s: string) => !s.split('\n').some((l) => /\blog\s*=\s*"[^"]*\$[A-Z_]+\$/.test(l)); // F-39

  // ---- 정기 송금: 명령·줄 ----
  const set = mtSetCommand(7, { tid: 4, res: 'alloys', payUs: true, amt: 30, left: 24, g: 3, o: MT_OWNER.deal }, false);
  check(set.includes('sllm_mt_set = { REQ = 7 TID = 4 R = 4 D = 1 A = 30 L = 24 G = 3 O = 1 KEEP = no CHECK = no }') && set.startsWith('effect every_playable_country = { limit = { is_ai = no }'), 'transfer: set command');
  check(mtSetCommand(8, { tid: 9, res: 'energy_minerals', payUs: true, amt: 50, left: 60, g: 1, o: MT_OWNER.rebel }, true).includes('R = 6 D = 1 A = 50 L = 60 G = 1 O = 2 KEEP = yes CHECK = no') && mtUnsetCommand(9, 4, 3, MT_OWNER.deal).includes('sllm_mt_unset = { REQ = 9 TID = 4 G = 3 O = 1 }'), 'transfer: rebel pair resource, unset command');
  check([() => mtSetCommand(0, { tid: 4, res: 'energy', payUs: true, amt: 1, left: 1, g: 1, o: 1 }, false), () => mtSetCommand(1, { tid: 0, res: 'energy', payUs: true, amt: 1, left: 1, g: 1, o: 1 }, false),
    () => mtSetCommand(1, { tid: 4, res: 'unity' as never, payUs: true, amt: 1, left: 1, g: 1, o: 1 }, false), () => mtSetCommand(1, { tid: 4, res: 'energy', payUs: true, amt: 0, left: 1, g: 1, o: 1 }, false),
    () => mtSetCommand(1, { tid: 4, res: 'energy', payUs: true, amt: 1, left: 0, g: 1, o: 1 }, false), () => mtSetCommand(1, { tid: 4, res: 'energy', payUs: true, amt: 1, left: 1, g: 1, o: 4 as never }, false), () => mtUnsetCommand(1, 4, 0, 1)].every(throws), 'transfer: bad inputs refused');
  check(Object.values(MT_RES).join() === '1,2,3,4,5,6', 'transfer: resource codes 1..6 (mod sllm_mt<K>_r)');
  const e1 = parseMt({ ev: 'short', sid: '\\77', tid: '4.000', g: '3', o: '1', r: '4', d: '1', miss: '1', date: '2250.03.01' });
  check(!!e1 && e1.ev === 'short' && e1.sid === '77' && e1.tid === 4 && e1.g === 3 && e1.res === 'alloys' && e1.payUs && e1.miss === 1, 'transfer: MT line read');
  check(parseMt({ ev: 'stop', tid: '4', g: '3', o: '2', r: '6', d: '2' })!.res === 'energy_minerals' && parseMt({ ev: 'paid', tid: '4', g: '3', o: '1', d: '1' }) === null && parseMt({ ev: 'end', tid: '0', g: '3', o: '1', d: '1' }) === null && parseMt({ ev: 'end', tid: '4', g: '3', o: '1', d: '3' }) === null, 'transfer: MT line refuses bad shapes');
  check(nextG([]) === 1 && nextG([undefined, 3, 2]) === 4, 'transfer: next group number');
  const ag: Agreement = { id: 'a', tid: 4, name: 'X', since: '2250.01.15', monthly: [{ res: 'energy', amt: 10, left: 2, payUs: true, miss: 0 }, { res: 'alloys', amt: 5, left: 3, payUs: false, miss: 0, legacy: true }], nap: [], reg: true, g: 1 };
  check(mtStep(ag, '2250.01') === ag && mtStep({ ...ag, reg: false }, '2250.02').monthly[0].left === 2, 'transfer: no count in the month it was made, nor before it is registered');
  const s2 = mtStep(ag, '2250.02'), s3 = mtStep({ ...s2, monthly: s2.monthly.map((m, i) => (i === 0 ? { ...m, sm: '2250.03' } : m)) }, '2250.03');
  check(s2.monthly[0].left === 1 && s2.monthly[1].left === 3 && s3.monthly[0].left === 1 && !s3.done, 'transfer: a quiet month counts as paid, a short month does not, legacy items untouched');
  check(mtStep({ ...ag, monthly: [{ res: 'energy', amt: 10, left: 1, payUs: true, miss: 0 }] }, '2250.02').done === true, 'transfer: done when every payment is made');

  // ---- 정기 송금: 모드 ----
  const fx = rd('tester-mod', 'common', 'scripted_effects', 'sllm_mtransfer.txt'), ev = rd('tester-mod', 'events', 'sllm_mtransfer_events.txt'), oa = rd('tester-mod', 'common', 'on_actions', 'sllm_mtransfer_on_actions.txt');
  check(bal(fx) && bal(ev) && noParamInLog(fx) && ['sllm_mt_set = {', 'sllm_mt_unset = {', 'sllm_mt_monthly = {', 'sllm_mt_drop_g = {', 'SLLM:MTSET', 'SLLM:MT/;/ev=short', 'SLLM:MT/;/ev=stop', 'SLLM:MT/;/ev=end'].every((k) => fx.includes(k)), 'transfer mod: effects, change-only lines, no $params in log text');
  check([1, 2, 3, 4, 5, 6].every((k) => fx.includes(`sllm_mt_slot_${k} = {`) && fx.includes(`sllm_mt_pay_${k}_6 = {`)) && /export_resource_stockpile_to_variable = \{ resource = minerals variable = sllm_mt_stock2 \}/.test(fx) && !/add_resource = \{ [a-z_]+ = -\$/.test(fx), 'transfer mod: 6 slots, pair resource, stock checked before paying (never goes negative)');
  check(/namespace = sllm_mt\b/.test(ev) && /has_country_flag = sllm_mt_on/.test(ev) && /on_monthly_pulse_country = \{\s*events = \{ sllm_mt\.1 \}/.test(oa) && fx.includes('remove_country_flag = sllm_mt_on'), 'transfer mod: monthly only while slots exist (flag removed when empty)');

  // ---- 앱 쪽 배선 ----
  const src = (p: string) => rd('src', ...p.split('/'));
  const da = src('features/deals-app.ts'), ra = src('features/rebels-app.ts'), hub = src('features/mtransfer-hub.ts'), lr = src('app/log-router.ts');
  check(lr.includes('MTRANSFER: 187') && hub.includes('router.on(SLOT.MTRANSFER') && da.includes('mtSubscribe(router, MT_OWNER.deal, onMt)') && ra.includes('mtSubscribe(router, MT_OWNER.rebel, onMt)'), 'transfer app: log slot, both features subscribed');
  check(/if \(!ag\.reg && ag\.monthly\.some/.test(da) && da.includes('mtStep(ag, monthKey(date))') && /if \(m\.left <= 0 \|\| !m\.legacy\)/.test(da) && da.includes('void mtUnset(ag.tid, ag.g, MT_OWNER.deal)') && /m\.kind === 'LOADED'[\s\S]{0,200}a\.reg = false/.test(da), 'deals app: register once, pay by console only when the mod has no room, unset on breach, recheck after load');
  check(/if \(!a\.legacy && !a\.reg\) await aidRegister/.test(ra) && ra.includes("res: 'energy_minerals', payUs: true") && /void mtUnset\(tid, a\.g, MT_OWNER\.rebel\)/.test(ra), 'rebels app: aid registered once, unset when it ends');

  // ---- 취약 판정 위임 ----
  const rf = rd('tester-mod', 'common', 'scripted_effects', 'sllm_rebels.txt'), re = rd('tester-mod', 'events', 'sllm_rebels_events.txt'), ro = rd('tester-mod', 'common', 'on_actions', 'sllm_rebels_on_actions.txt');
  check(vulnAutoCommand(5, '12').includes('sllm_rb_auto_on = { REQ = 5 }') && throws(() => vulnAutoCommand(5, 'x')), 'vuln auto: command');
  check(bal(rf) && bal(re) && noParamInLog(rf) && /sllm_rb_auto_on = \{[\s\S]{0,200}set_country_flag = sllm_rb_auto/.test(rf) && /sllm_rb_vuln_auto = \{[\s\S]*NOT = \{ check_variable = \{ which = sllm_rb_vl value = sllm_rb_st \} \}[\s\S]*SLLM:RBV\/;\/req=0/.test(rf)
    && /sllm_rb_vuln_auto = \{[\s\S]{0,200}sllm_rb_near_refresh = yes/.test(rf) && /check_variable = \{ which = sllm_rb_vm value >= 3 \}/.test(re) && /on_monthly_pulse_country = \{\s*events = \{ sllm_rbm\.1 \}/.test(ro), 'vuln auto mod: every 3 months, line only when it changes, near flags still refreshed');
  check(/if \(autoSid !== sid\) \{ const r = await ask\(\(req\) => vulnAutoCommand/.test(ra) && /req === 0 && m\.kind === 'RBV'/.test(ra) && /autoSid !== sid && monthsBetween\(s\.vuln\.last, date\) >= RB\.vulnEvery/.test(ra), 'vuln auto app: hand over once per save, read unsolicited lines, old way only as fallback');

  // ---- 대리전·징발 신호 ----
  const vm = rd('tester-mod', 'common', 'scripted_effects', 'sllm_vassal_reign.txt'), ve = rd('tester-mod', 'events', 'sllm_vrsig_events.txt'), vo = rd('tester-mod', 'common', 'on_actions', 'sllm_vrsig_on_actions.txt');
  check(bal(vm) && bal(ve) && noParamInLog(ve) && vm.includes('set_country_flag = sllm_vr_pxt set_variable = { which = sllm_vr_pxv value = $TID$ }') && vm.includes('set_country_flag = sllm_vr_lvon'), 'reign signals mod: proxy target and levy owner marked');
  check(/on_war_ended = \{\s*events = \{ sllm_vrs\.1 \}/.test(vo) && /on_fleet_destroyed_victim = \{\s*events = \{ sllm_vrs\.3 \}/.test(vo) && /on_fleet_contract_expired = \{\s*events = \{ sllm_vrs\.5 \}/.test(vo)
    && /id = sllm_vrs\.1[\s\S]{0,200}any_country = \{ has_country_flag = sllm_vr_pxt \}/.test(ve) && /id = sllm_vrs\.3[\s\S]{0,200}fromfrom = \{ has_fleet_flag = sllm_vr_levied \}/.test(ve) && ve.includes('SLLM:VRPXW/;/req=0') && ve.includes('SLLM:VRLVC/;/req=0') && /days = 1 \}/.test(ve), 'reign signals mod: war end, fleet lost, lease over (a day later, cheap triggers)');
  const vr = src('features/vassal-reign-app.ts'), op = src('features/overlord-pressure-app.ts');
  check(/req === 0 && \(m\.kind === 'VRPXW' \|\| m\.kind === 'VRLVC'\)/.test(vr) && /const sweep = month\.endsWith\('\.01'\)/.test(vr) && /if \(!sweep \|\| p\.state !== 'war'\) continue/.test(vr) && /if \(!sweep \|\| lv\.state !== 'on'\) continue/.test(vr), 'reign app: signals handled, console check only every January');
  check(/m\.kind === 'VRPXW' \|\| m\.kind === 'VRLVC'\) && Math\.round\(Number\(sv\(m\.kv\.req\)\)\) === 0/.test(op) && /if \(sweep && v\.levy\?\.state === 'on'\)/.test(op) && /if \(sweep && v\.proxy\?\.state === 'war'\)/.test(op), 'overlord app: signals handled (tid 0), console check only every January');

  // ---- 동맹 방어전 줄 ----
  const sc = rd('tester-mod', 'common', 'scripted_effects', 'sllm_probe_scan.txt');
  check(/set_variable = \{ which = sllm_st_al value = 1 \}[\s\S]{0,700}SLLM:STALLY\/;\/idx=/.test(sc) && /m\.kind === 'STALLY'/.test(da) && /const rows = allyScan\.sid === sid && allyScan\.set\.size \? allyScan\.set : null/.test(da), 'ally war: the monthly scan names the allies, no separate query');

  // ---- 일정표 ----
  const al: Alarm[] = [{ id: 'a', key: 'raid_cooldown', v: 0, due: '2230.03.01', total: 90, from: 'game' }, { id: 'b', key: 'raid_cooldown', v: 1, due: '2230.05.01', total: 90, from: 'game' }, { id: 'c', key: 'x', v: 0, due: '2230.01.01', total: 1, from: 'game', rang: true }];
  const rb = ringByDate(al, '2230.03.10');
  check(rb.ring.map((a) => a.id).join() === 'a' && rb.ring[0].rang === true && rb.list.map((a) => a.id).join() === 'b,c', 'alarm: rings by stored date without asking the game');
  check(monthsApart('2230.01', '2231.01') === 12 && monthsApart('', '2231.01') === 999 && ALARM_RESCAN_MONTHS === 12, 'alarm: rescan every 12 months');
  const aa = src('features/alarm-app.ts');
  check(/if \(loadedFresh \|\| monthsApart\(s\.scanned, m\) >= ALARM_RESCAN_MONTHS\)/.test(aa) && aa.includes('else tickByDate();') && /m\.kind === 'LOADED'\) \{ loadedFresh = true/.test(aa), 'alarm app: reads after load / every 12 months / when opened, otherwise by date');

  // ---- 월간 상황: 바뀐 것만(2026-11-09) ----
  const line = (t: string): any => { const [kind, ...rest] = t.split('/;/'); const kv: Record<string, string> = {}; for (const r of rest) { const i = r.indexOf('='); kv[r.slice(0, i)] = r.slice(i + 1); } return { kind, kv }; };
  const sc2 = new StateCollector();
  sc2.feed(line('STATE_BEGIN/;/sid=5/;/n=1')); sc2.feed(line('COUNCILAG/;/free=1/;/gest=0/;/eth=33/;/agv=7/;/auth=1/;/al=1/;/n=1'));
  sc2.feed(line('FACTION/;/fid=2/;/name=a/;/eth=1/;/sup=0.4/;/app=0.6/;/n=1')); sc2.feed(line('VASSAL/;/idx=9/;/name=v/;/loyalty=30/;/n=1'));
  sc2.feed(line('MOOD/;/n=1/;/sum=300/;/cnt=5/;/low=1/;/ox=0.1/;/dx=0')); sc2.feed(line('ENCLAVE/;/n=1/;/fest=1/;/outrage=0/;/cara=2'));
  const f1 = sc2.feed(line('STATE_END/;/sid=5/;/n=1/;/kp=0'));
  sc2.feed(line('STATE_BEGIN/;/sid=5/;/n=2')); sc2.feed(line('MOOD/;/n=2/;/sum=200/;/cnt=5/;/low=3/;/ox=0.1/;/dx=0'));
  const f2 = sc2.feed(line('STATE_END/;/sid=5/;/n=2/;/kp=' + (STATE_KEEP.council | STATE_KEEP.enclave | STATE_KEEP.factions | STATE_KEEP.vassals)));
  check(!!f1 && !!f2 && f2.agendaFree === true && f2.empireEth === 33 && f2.allyWar === true && f2.factions.length === 1 && f2.factions[0].support === 0.4 && f2.vassals![0].loyalty === 30 && f2.enclave!.cara === 2 && f2.mood!.low === 3, 'state: kept parts carried from last month, sent parts fresh');
  const sc3 = new StateCollector(); sc3.feed(line('STATE_BEGIN/;/sid=5/;/n=7'));
  check(sc3.feed(line('STATE_END/;/sid=5/;/n=7/;/kp=4')) === null && sc3.needFull === true, 'state: nothing to carry (app just started) → month dropped, full report asked');
  check(!carryKept({ sid: '6', n: '1', date: '', wars: [], factions: [], spynets: [], subject: null } as StateSnapshot, f2, 4) && carryKept({ sid: '6', n: '1', date: '', wars: [], factions: [], spynets: [], subject: null } as StateSnapshot, null, 0), 'state: never carry across saves; kp 0 needs nothing');
  const ps = rd('tester-mod', 'common', 'scripted_effects', 'sllm_probe_scan.txt'), pp = rd('tester-mod', 'common', 'scripted_effects', 'sllm_probe_protest.txt'), pe = rd('tester-mod', 'events', 'sllm_probe_events.txt'), ga = src('features/gamestate-app.ts');
  check(bal(ps) && noParamInLog(ps) && /sllm_st_cmp = \{\n\tif = \{ limit = \{ OR = \{ NOT = \{ is_variable_set = \$L\$ \}/.test(ps) && ps.includes('SLLM:STATE_END/;/sid=\\\\[This.sllm_save_id]/;/n=\\\\[This.sllm_st_n]/;/kp=\\\\[This.sllm_st_kp]')
    && [1, 2, 4, 8, 16].every((b) => ps.includes(`change_variable = { which = sllm_st_kp value = ${b} }`)) && /check_variable = \{ which = sllm_st_fm value >= 12 \}/.test(ps) && /is_variable_set = sllm_st_full/.test(ps), 'state mod: change-only parts with kp bits, full every 12th scan or on request');
  check(/id = sllm_probe\.101[\s\S]*set_variable = \{ which = sllm_st_full value = 1 \}[\s\S]{0,200}sllm_probe_state_scan = yes/.test(pe) && /needFull[\s\S]{0,400}set_variable = \{ which = sllm_st_full value = 1 \}/.test(ga), 'state: full report after load, and when the app has nothing to carry');
  check(/planet_stability variable = sllm_pq_st \}\r?\n\t\t\tprev = \{ change_variable = \{ which = sllm_md_sum value = prev\.sllm_pq_st \}/.test(pp) && /is_gestalt = yes \}\s*every_owned_planet = \{/.test(ps) && ps.indexOf('sllm_probe_protest_scan = yes') < ps.indexOf('log = "SLLM:MOOD/'), 'state mod: mood sums ride the protest planet loop (gestalt keeps its own), MOOD line after it');
  // ---- 스크립트 효과 중첩 깊이(2026-11-09, 회랑에서 배움) ----
  // 게임은 스크립트 효과 안에서 효과를 부르는 단계가 5단을 넘으면 불러오는 중에 튕긴다(error.log 「Max effects post init recursive depth of 5」).
  // 이벤트가 효과를 부르는 한 단계를 빼고 4단까지만 허용한다. 효과 이름 = 최상위 `이름 = {`, 부름 = `이름 = yes` 또는 `이름 = {`.
  {
    const dir = path.join(root, 'tester-mod', 'common', 'scripted_effects');
    let files: string[] = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')); } catch { /* 모드 폴더 없음 */ }
    const defs = new Map<string, string>();
    for (const f of files) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').replace(/#[^\n]*/g, '');
      let depth = 0, name = '', start = 0; const re = /[{}]|^[ \t]*([A-Za-z_]\w*)[ \t]*=[ \t]*\{/gm;
      for (let m = re.exec(t); m; m = re.exec(t)) {
        if (m[0] === '{') depth++;
        else if (m[0] === '}') { depth--; if (depth === 0 && name) { defs.set(name, t.slice(start, m.index + 1)); name = ''; } }
        else { if (depth === 0) { name = m[1]; start = m.index; } depth++; }
      }
    }
    const calls = new Map<string, string[]>();
    for (const [k, v] of defs) calls.set(k, [...new Set([...v.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(?:yes|\{)/g)].map((m) => m[1]).filter((n) => n !== k && defs.has(n)))]);
    const memo = new Map<string, number>();
    const deep = (k: string, stack: Set<string>): number => {
      if (stack.has(k)) return 0; const hit = memo.get(k); if (hit !== undefined) return hit;
      stack.add(k); let best = 0; for (const c of calls.get(k) ?? []) best = Math.max(best, deep(c, stack)); stack.delete(k);
      memo.set(k, best + 1); return best + 1;
    };
    let worst = 0, worstName = ''; for (const k of defs.keys()) { const d = deep(k, new Set()); if (d > worst) { worst = d; worstName = k; } }
    check(files.length === 0 || (defs.size > 100 && worst <= 4), `effects: nesting depth ≤ 4 (now ${worst}${worstName ? ' ' + worstName : ''}, ${defs.size} effects)`);
  }
  // ---- 세이브 다시 읽기: 바뀜 신호 때만(2026-11-09) ----
  check(saveSignalOf({ kind: 'LOADED', kv: {} }) === 'loaded' && saveSignalOf({ kind: 'NEWS', kv: { kind: '\\ruler' } }) === 'ruler' && saveSignalOf({ kind: 'EVT', kv: { kind: 'first_contact' } }) === 'first_contact'
    && saveSignalOf({ kind: 'NEWS', kv: { kind: 'fed_join' } }) === '' && saveSignalOf({ kind: 'STATE_END', kv: {} }) === '', 'save: which game lines ask for a re-read');
  check(ourGovChanged({ sid: '5', empireEth: 3, authority: 1 }, { sid: '5', empireEth: 5, authority: 1 }) && ourGovChanged({ sid: '5', empireEth: 3, authority: 1 }, { sid: '5', empireEth: 3, authority: 3 })
    && !ourGovChanged({ sid: '5', empireEth: 3, authority: 1 }, { sid: '5', empireEth: 3, authority: 1 }) && !ourGovChanged(null, { sid: '5', empireEth: 3 }) && !ourGovChanged({ sid: '4', empireEth: 3 }, { sid: '5', empireEth: 9 })
    && !ourGovChanged({ sid: '5' }, { sid: '5', empireEth: 9 }), 'save: our ethics or authority changed (same save only)');
  check(SAVE_REREAD_MONTHS === 12 && saveTooOld('2230.01.01', '2231.01.15') && !saveTooOld('2230.01.01', '2230.12.01') && !saveTooOld('', '2231.01.01') && !saveTooOld('2230.01.01', ''), 'save: re-read after 12 game months');
  {
    const fp = new FlagProvider([]) as any; let scans = 0; fp.latestSave = () => { scans++; return null; };
    const ask = (f: () => unknown) => { fp.lastScan = 0; f(); };
    fp.save = { file: 'a.sav', mtime: 1000, data: { byIdx: { 3: {} }, statsByIdx: {}, statsById: {}, byId: {}, bioById: {}, bioByIdx: {}, ethicsByIdx: { 3: ['ethic_pacifist'] }, date: '2230.01.01' } };
    ask(() => fp.ethicsFor(3)); ask(() => fp.rulerFor(3)); const quiet = scans;
    ask(() => fp.statsFor(3)); const fresh = scans;
    ask(() => fp.ethicsFor(9)); ask(() => fp.ethicsFor(3)); const miss = scans;
    fp.loaded(1500); ask(() => fp.ethicsFor(3)); const after = scans;
    ask(() => fp.ethicsFor(9)); ask(() => fp.ethicsFor(3)); const once = scans;
    fp.markStale('ruler', 5000); fp.loaded(4000); const still = fp.needAfter !== null; fp.loaded(6000); const cleared = fp.needAfter === null;
    check(quiet === 0 && fresh === 1 && miss === 2 && after === 2 && once === 2 && still && cleared && fp.heldDate() === '2230.01.01',
      `save: held save is used until a signal (quiet ${quiet}, fresh ${fresh}, unknown empire ${miss}, after read ${after}, same unknown again ${once}, older save keeps the mark ${still}, newer clears ${cleared})`);
    fp.setExpectedSid('77'); scans = 0; ask(() => fp.ethicsFor(3));
    check(scans === 1, 'save: another save (different save number) is always read');
  }
  const fl = src('flags.ts'), sa = src('features/save-signal-app.ts'), mainSrc = src('main.ts');
  check(/refresh\(fresh = false\): void \{\n\s*if \(this\.save && this\.matchesSave\(\) && !fresh && this\.needAfter === null\) return;/.test(fl) && /saveSnap\(\)[^\n]*this\.refresh\(true\)/.test(fl) && /statsFor\(idx: number\)[^\n]*\n\s*this\.refresh\(true\);/.test(fl)
    && (fl.match(/this\.loaded\(mt\)/g) ?? []).length === 2 && sa.includes('router.on(SLOT.SAVESIGNAL') && /markStale\('yearly', 0\)/.test(sa) && mainSrc.includes('registerSaveSignals(router);'), 'save app: wired (gate in refresh, fresh readers, signal slot)');
  // ---- 위기 감시: 바뀐 달에만 보내므로 해마다 한 번 다시(2026-11-09) ----
  const co = rd('tester-mod', 'common', 'on_actions', 'sllm_crisis_on_actions.txt'), ce = rd('tester-mod', 'events', 'sllm_crisis_events.txt');
  check(bal(co) && bal(ce) && /on_yearly_pulse_country = \{\s*events = \{ sllm_crisis\.3 \}/.test(co) && /id = sllm_crisis\.3[\s\S]{0,200}trigger = \{ is_ai = no \}[\s\S]{0,120}clear_variable = sllm_crisis_m country_event = \{ id = sllm_crisis\.1 \}/.test(ce),
    'crisis: resent once a year (app restarted while the game ran)');
  // ---- 정기 송금: 세이브를 불러온 뒤에는 확인만(게임에 칸이 없으면 끝난 것, 사용자 결정 2026-11-09) ----
  const chkCmd = mtSetCommand(9, { tid: 4, res: 'food', payUs: false, amt: 5, left: 3, g: 2, o: MT_OWNER.deal }, true, true);
  check(chkCmd.includes('R = 3 D = 2 A = 5 L = 3 G = 2 O = 1 KEEP = yes CHECK = yes }') && mtSetCommand(9, { tid: 4, res: 'food', payUs: false, amt: 5, left: 3, g: 2, o: MT_OWNER.deal }, false, true).includes('KEEP = yes CHECK = yes'), 'transfer: check-only command (never creates a slot)');
  const fx2 = rd('tester-mod', 'common', 'scripted_effects', 'sllm_mtransfer.txt'), hub2 = src('features/mtransfer-hub.ts'), dap = src('features/deals-app.ts'), rap = src('features/rebels-app.ts');
  check(/if = \{ limit = \{ always = \$CHECK\$ OR = \{ check_variable = \{ which = sllm_mt_st value = 1 \} check_variable = \{ which = sllm_mt_st value = 2 \} \} \} set_variable = \{ which = sllm_mt_st value = 4 \} set_variable = \{ which = sllm_mt_k value = 0 \} \}/.test(fx2)
    && fx2.indexOf('always = $CHECK$') < fx2.indexOf('limit = { check_variable = { which = sllm_mt_k value = 1 } }') && bal(fx2), 'transfer mod: CHECK = yes answers st 4 and writes nothing');
  check(hub2.includes("st === 4 ? 'missing'") && /a\.reg = false; a\.chk = true;/.test(dap) && dap.includes('mtRegister(ag, true, !!ag.chk)') && /r === 'missing'\) \{[^\n]*m\.left = 0;/.test(dap)
    && /if \(a\.reg\) a\.chk = true; a\.reg = false;/.test(rap) && rap.includes('aidRegister(s, a, tid, date, true, !!a.chk)') && /r === 'missing'\) \{[^\n]*a\.state = 'done';/.test(rap), 'transfer apps: after load, a missing slot ends the payment instead of restarting it');
  // ---- 한 달 사용량(2026-11-09): 콘솔 명령 수·세이브 읽기 ----
  check(effectKey('effect every_playable_country = { limit = { is_ai = no } sllm_mt_set = { REQ = 1 } }') === 'sllm_mt_set'
    && effectKey('effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = 5 } } set_variable = { which = sllm_st_full value = 1 } }') === 'other'
    && effectKey('effect sllm_idx = 3 sllm_probe_hello = { REQ = 2 }') === 'sllm_probe_hello', 'usage: command named by its first sllm effect');
  {
    const um = new UsageMeter(); check(um.flush('2230.01') === null, 'usage: quiet month leaves no line');
    um.noteConsole('sllm_a = yes'); um.noteConsole('sllm_b = yes'); um.noteConsole('sllm_a = yes'); um.noteSaveRead('flags', 1200.4); um.noteSaveRead('galaxy', 800); um.noteSaveRead('flags', 0, false);
    const r = um.flush('2230.02');
    check(!!r && r.month === '2230.02' && r.console === 3 && r.top.join() === 'sllm_a:2,sllm_b:1' && r.flagsReads === 1 && r.flagsMs === 1200 && r.galaxyReads === 1 && r.galaxyMs === 800 && r.failed === 1 && um.flush('2230.03') === null, 'usage: counts per month, then starts over');
  }
  const gl = src('app/game-link.ts'), gx = src('features/galaxy-app.ts'), fl2 = src('flags.ts');
  check((gl.match(/usage\.noteConsole\(/g) ?? []).length === 2 && (fl2.match(/usage\.noteSaveRead\('flags'/g) ?? []).length === 3 && /usage\.noteSaveRead\('galaxy', Date\.now\(\) - t0/.test(gx)
    && src('main.ts').includes('registerUsage();') && src('features/usage-app.ts').includes("logDiagnostic('info', 'usage.month'"), 'usage: counted where commands go out and saves are read');
  check(/const newest = ctx\.flagProv\.latestSave\(\), file = newest && path\.dirname\(newest\) === path\.dirname\(d\.file\) \? newest : d\.file;/.test(gx) && !/readInWorker\(d\.file\)/.test(gx) && /cache = \{ file, mtime: mt, map \}/.test(gx),
    'galaxy map: reads the newest save of the same game (the flag provider may hold an older one)');
  // ---- 물자 지원(hoi)도 정기 송금으로(2026-11-09) ----
  check(MT_OWNER.hoi === 3 && mtSetCommand(5, { tid: 7, res: 'minerals', payUs: true, amt: 40, left: 24, g: 2, o: MT_OWNER.hoi }, true).includes('R = 2 D = 1 A = 40 L = 24 G = 2 O = 3 KEEP = yes CHECK = no')
    && parseMt({ ev: 'end', tid: '7', g: '2', o: '3', r: '2', d: '1' })?.o === 3 && parseMt({ ev: 'end', tid: '7', g: '2', o: '4', r: '2', d: '1' }) === null, 'transfer: owner 3 = war aid');
  const hoiApp = src('features/hoi-app.ts');
  check(hoiApp.includes('mtSubscribe(router, MT_OWNER.hoi, onAidMt)') && /mtSet\(\{ tid: a\.tid, res: a\.res, payUs: true, amt: a\.amt, left: [^\n]*o: MT_OWNER\.hoi \}, true, !!a\.chk\)/.test(hoiApp)
    && /if \(a\.legacy\) \{\n\s*const req = \+\+link\.reqCounter;[^\n]*\n\s*try \{ const r = await terminalRequest\(payCommand\(/.test(hoiApp) && /else if \(a\.reg && a\.rm !== month && a\.sm !== month\) \{ a\.left -= 1; a\.miss = 0; \}/.test(hoiApp)
    && /m\.kind === 'LOADED'\)[^\n]*a\.reg = false; a\.chk = true;/.test(hoiApp) && (hoiApp.match(/aidUnset\(a\)/g) ?? []).length >= 4 && (hoiApp.match(/terminalRequest\(payCommand\(/g) ?? []).length === 1,
    'war aid app: paid by the game each month; the app pays only when no slot is free');
  // ---- 성간 임시회의 과제: 모드가 매달 재고 바뀔 때만(2026-11-09) ----
  check(watchCommand('12', 2, 'income_alloys') === "effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = 12 } } sllm_iscq_watch = { SLOT = 2 CHAIN = income_alloys } }"
    && throws(() => watchCommand('12', 4, 'peace')) && throws(() => watchCommand('12', 1, 'gift')) && throws(() => watchCommand('x', 1, 'peace')), 'quest watch: command (slots 1..3, real chains only)');
  check(parseWatch({ sid: '\\12', slot: '2', ev: 'hit' })?.slot === 2 && parseWatch({ slot: '1', ev: 'war' })?.ev === 'war' && parseWatch({ slot: '4', ev: 'hit' }) === null && parseWatch({ slot: '1', ev: 'paid' }) === null, 'quest watch: ISCQW line read');
  {
    const qw = rd('tester-mod', 'common', 'scripted_effects', 'sllm_iscq_watch.txt'), qe = rd('tester-mod', 'events', 'sllm_iscq_watch_events.txt'), qo = rd('tester-mod', 'common', 'on_actions', 'sllm_iscq_watch_on_actions.txt');
    const ql = rd('tester-mod', 'common', 'scripted_effects', 'sllm_iscq_log.txt'), qc = rd('tester-mod', 'common', 'event_chains', 'sllm_iscq_chains.txt');
    const flags = [...qw.matchAll(/has_country_flag = sllm_iqw(\d)_([a-z_]+) \}/g)].map((m) => `sllm_iscq_${m[2]}_${m[1]}`);
    const allChains = flags.length === 54 && flags.every((c) => new RegExp('^' + c + ' = \\{', 'm').test(qc));
    check(bal(qw) && bal(qe) && bal(qo) && noParamInLog(qw) && allChains && /sllm_iscq_watch = \{\n\tset_country_flag = sllm_iqw\$SLOT\$_\$CHAIN\$/.test(qw)
      && /trigger = \{ is_ai = no has_country_flag = sllm_iqw_on \}\s*immediate = \{ sllm_iscq_watch_tick = yes \}/.test(qe) && /on_monthly_pulse_country = \{\s*events = \{ sllm_iqw\.1 \}/.test(qo)
      && /sllm_iscq_end = \{\n\tend_event_chain = sllm_iscq_\$CHAIN\$_\$SLOT\$\n\tremove_country_flag = sllm_iqw\$SLOT\$_\$CHAIN\$/.test(ql), `quest watch mod: 3 slots x 18 goals, each one a real situation-log chain (${flags.length})`);
    const qa = src('features/isc-quest-app.ts');
    check(/const need = act\.filter\(\(q\) => !q\.log \|\| fresh\.includes\(q\) \|\| signaled\.has\(q\.log\) \|\| \(q\.due && cmpDate\(today, q\.due\) >= 0\)\);/.test(qa) && qa.includes("if (m.kind === 'ISCQW') { onWatch(m.kv); return; }")
      && /m\.kind === 'LOADED'\) \{ watched\.clear\(\); signaled\.clear\(\);/.test(qa) && /q\.log = slot; ensureWatch\(ctx\.curSaveId, q\);/.test(qa), 'quest app: measures only on a signal, at the deadline, or for old tasks');
  }
  // ---- 약탈자 용병 할인: 모드가 매달 스스로 확인(2026-11-09) ----
  {
    const me = rd('tester-mod', 'events', 'sllm_mrd_events.txt'), mo = rd('tester-mod', 'common', 'on_actions', 'sllm_mrd_on_actions.txt'), ma = src('features/marauder-app.ts');
    const mon = ma.slice(ma.indexOf('function monthly('), ma.indexOf('function onRefund('));
    check(bal(me) && bal(mo) && /trigger = \{ is_ai = no has_country_flag = sllm_mrd_deal \}\s*immediate = \{ sllm_mrd_merc_check = yes \}/.test(me) && /events = \{ sllm_mrd\.1 \}/.test(mo) && mon.length > 0 && !/sendConsole|terminalRequest|enqueue/.test(mon),
      'mercenary refund: the mod checks monthly, the app sends nothing');
  }
  // ---- 인물 관계도(2026-11-09): 인물 카드와 같은 공개 규칙, 우리 지도자만 ----
  {
    const lg = emptyLedger('5');
    const pr = (a: string, b: string, f: Partial<ReturnType<typeof getPair>>) => Object.assign(getPair(lg, a, b), f);
    pr('p:1', 'p:2', { friend: 'close' });                               // 통치자와 → 늘 보임
    pr('p:2', 'p:3', { romance: 'engaged', visibility: 'public' });      // 공개 연애
    pr('p:3', 'p:4', { friend: 'friendly', visibility: 'hidden' });      // 숨은 친분 → 안 보임
    pr('p:3', 'p:5', { rival: 'rival', visibility: 'parties' });         // 당사자만 → 안 보임
    pr('p:4', 'p:5', { rival: 'tense', visibility: 'hidden' }); lg.playerKnows.pairs.push('p:4|p:5'); // 소개로 알게 됨 → 보임
    pr('p:2', 'p:9', { friend: 'close', visibility: 'public' });         // 떠난 사람(명단에 없음) → 안 보임
    pr('p:5', 'p:6', { friend: 'acquainted', visibility: 'public' });  // 공개된 지인 → 가는 선
    pr('p:2', 'p:6', { friend: 'acquainted', visibility: 'public' });  // 바깥 둘레끼리의 지인도 선
    pr('p:3', 'p:6', { friend: 'acquainted', visibility: 'hidden' });  // 숨은 지인 → 안 보임
    lg.conflicts.c1 = { id: 'c1', sid: '5', kind: 'friction', a: 'p:2', b: 'p:5', createdOn: '2230.01.01', cause: {}, visibility: 'player', resolved: false } as any;
    const ppl = [1, 2, 3, 4, 5, 6].map((i) => ({ pid: `p:${i}`, name: `n${i}`, cls: 'official', ruler: i === 1 }));
    const g = buildRelGraph(lg, ppl, 'p:1'), E = Object.fromEntries(g.edges.map((e) => [e.a + '|' + e.b, e]));
    check(g.nodes[0].pid === 'p:1' && Object.keys(E).sort().join() === 'p:1|p:2,p:2|p:3,p:2|p:5,p:2|p:6,p:4|p:5,p:5|p:6' && E['p:5|p:6'].kinds.join() === 'acquaint' && E['p:5|p:6'].friend === 'acquainted' && E['p:1|p:2'].friend === 'close' && E['p:2|p:3'].kinds.join() === 'partner' && E['p:2|p:3'].romance === 'engaged'
      && E['p:4|p:5'].kinds.join() === 'rival' && E['p:2|p:5'].kinds.join() === 'conflict', 'relationship chart: only ties the leader card would show (ruler, public, introduced, known conflicts) + known acquaintances');
    const r = ringsOf(g, 'p:3', 'p:1'), r4 = ringsOf(g, 'p:4', 'p:1');
    check(r.ring1.sort().join() === 'p:2' && r.ring2.sort().join() === 'p:1,p:5,p:6' && !r.apart.length && !r.edges.some((e) => e.a === 'p:4' || e.b === 'p:4')
      && r4.ring1.join() === 'p:5' && r4.ring2.sort().join() === 'p:2,p:6' && r4.apart.join() === 'p:1' && !r4.edges.some((e) => e.a === 'p:1' || e.b === 'p:1') && r4.edges.some((e) => e.a === 'p:2' && e.b === 'p:6'),
      'relationship chart: rings around the chosen person; ties among the shown people are all drawn (outer ring too); an unconnected ruler stands apart with no line');
    const ui2 = rd('ui', 'office-relgraph.js');
    check(!/kinds: \[\], none: true/.test(ui2) && !/stroke-dasharray', '3 8'/.test(ui2) && /const T0 = G\.filter\(tied\)/.test(ui2) && /const U = G\.filter\(\(g\) => !tied\(g\)\)/.test(ui2), 'relationship board: no lines to people without a known tie; untied circles stand apart (all still shown)');
    // 2026-11-09 사용자: 「줄이 난잡 — 지인 많은 인물 위주로 통합」 — 무리 사이 지인 선은 지인이 가장 많은 사람끼리 한 줄로 묶고(누르면 풀림), 관계도는 가운데를 가로지르는 선을 휘어 돌린다
    check(/'bun'\)/.test(ui2) && /'ind'\)/.test(ui2) && /function lightBoard\(pid\)/.test(ui2) && /mode === 'board'\) lightBoard\(/.test(ui2) && /const hubOf = /.test(ui2) && /function hover\(pid\)/.test(ui2) && /Q\$\{cv\[0\]\}/.test(ui2) && /지인 \$\{n\}/.test(ui2) && /\$\{n\} acq\./.test(ui2),
      'relationship board/chart: acquaintance lines between circles are bundled at each circle’s best-connected person (a click unbundles); chart lines bend around the centre; hover lights one person’s lines');
    const ui = rd('ui', 'office-relgraph.js'), card = rd('ui', 'office-relations.js'), oh = rd('ui', 'office.html');
    check(/window\.sllm\.relGraph\(\)/.test(ui) && /window\.SLLMRelGraph = \{ open, close \}/.test(ui) && !/scnNobles|corridor\//.test(ui.replace(/^\s*\/\/.*$/gm, '')) && card.includes('window.SLLMRelGraph.open(p.key)') && oh.includes('<script src="office-relations.js"></script><script src="office-relgraph.js"></script>')
      && src('preload.ts').includes("relGraph: () => ipcRenderer.invoke('relGraph')") && src('features/relations-app.ts').includes("ipcMain.handle('relGraph'"), 'relationship chart: own files (not the corridor’s), opened from the leader card');
  }

  // ---- 신문 「사진 먼저」(2026-11-10): 장면 고르기 · 종족 계열 · 사진 후보 · 지면 ----
  {
    const fixed = () => 0.5;
    check(scenesOf('A이(가) B에 선전포고했다')[0] === 'war_fleet' && scenesOf('A이(가) B에 선전포고했다')[1] === 'n_war_fleet' && scenesOf('A and B were married')[0] === 'wedding' && scenesOf('은하 위기가 시작되었다')[0] === 'n_dark_swarm' && !scenesOf('아무 일').length, 'news photos: scene from a chronicle line (ko/en)');
    check(photoClass('modded_species') === 'human' && photoClass(null) === 'human' && photoClass('machine') === 'robot' && photoClass('avian') === 'avian', 'news photos: unknown/mod species default to human, machine to robot');
    check(classFor('speech', { gest: 2, cls: 'avian' }, fixed) === null && classFor('speech', { gest: 1, cls: 'avian' }, fixed) === 'robot' && classFor('speech', { cls: 'avian', mix: [{ k: 'human', s: 0.9 }, { k: 'avian', s: 0.1 }] }, fixed) === 'avian', 'news photos: hive = no species photo, machine = robot, person-centred scenes use the main species');
    check(classFor('protest', { cls: 'avian', mix: [{ k: 'human', s: 0.6 }, { k: 'lithoid', s: 0.4 }] }, () => 0.2) === 'human' && classFor('protest', { cls: 'avian', mix: [{ k: 'human', s: 0.6 }, { k: 'lithoid', s: 0.4 }] }, () => 0.9) === 'lithoid', 'news photos: civil scenes pick a species by population share');
    const IX: PhotoEntry[] = [{ file: 'human_speech.webp', cls: 'human', scene: 'speech', desc: 'h' }, { file: 'avian_speech.webp', cls: 'avian', scene: 'speech', desc: 'a' }, { file: 'n_speech_crowd.webp', cls: 'neutral', scene: 'speech_crowd', desc: 'n' },
      { file: 'n_war_fleet.webp', cls: 'neutral', scene: 'war_fleet', desc: 'w' }, { file: 'human_ad_cosmetics.webp', cls: 'human', scene: 'cosmetics', desc: 'c', kind: 'ad' }];
    check(pickPhoto(IX, ['speech'], { cls: 'reptilian' }, fixed)?.file === 'human_speech.webp' && pickPhoto(IX, ['speech'], { gest: 2 }, fixed)?.file === 'n_speech_crowd.webp' && pickPhoto(IX, ['speech'], { cls: 'avian' }, fixed)?.file === 'avian_speech.webp', 'news photos: missing class falls back to human; hive falls back to a species-free photo');
    const menu = photoMenu(IX, [{ text: 'X declared war on Y' }, { text: '통치자가 연설했다' }], () => ({ cls: 'avian' }), 'seed');
    check(menu.map((m) => m.id + m.file).join() === 'P1avian_speech.webp,P2n_war_fleet.webp' && seeded('a')() === seeded('a')() && pickAd(IX, { cls: 'avian' }, fixed)?.file === 'human_ad_cosmetics.webp' && pickAd(IX, { gest: 2 }, fixed) === null, 'news photos: one photo per fact, newest first, ids P1…, same seed same pick; ads by reader species, hive gets print ads');
    let ix: PhotoEntry[] = []; try { ix = JSON.parse(rd('ui', 'news', 'photos', 'index.json')); } catch { /* 없음 */ }
    check(ix.length >= 500 && ix.every((e) => /^[a-z0-9_]+\.webp$/.test(e.file) && fs.existsSync(path.join(root, 'ui', 'news', 'photos', e.file))) && ['n_war_fleet', 'n_dark_swarm', 'neutral_bombarded_colony'].every((k) => ix.some((e) => e.file === k + '.webp')), 'news photos: index lists only existing files, incl. species-free shots');
    const pp = rd('ui', 'paper.html');
    check(/function renderWeb\(/.test(pp) && /function halftoneURL\(/.test(pp) && /np-stamp/.test(pp) && /function issueAds\(/.test(pp) && /L\('광고', 'AD'\)/.test(pp) && fs.existsSync(path.join(root, 'ui', 'news', 'paper', 'fold.webp')) && fs.existsSync(path.join(root, 'ui', 'news', 'ads', 'wide_resort.webp'))
      && /paper\/hdr_' \+ paperKey/.test(pp) && ['stn', 'starcluster', 'void'].every((k) => fs.existsSync(path.join(root, 'ui', 'news', 'paper', 'hdr_' + k + '.webp')))
      && /MediaBrands\.web\(br/.test(pp) && /web\(img, index\)/.test(rd('ui', 'media-brands.js')) && ['stn', 'starcluster', 'void'].every((k) => fs.existsSync(path.join(root, 'ui', 'brands', k + '-web.svg')) && fs.existsSync(path.join(root, 'ui', 'brands', k + '-web.webp')))
      && /webImage: brandData\(f\.id, 'web'\)/.test(rd('src', 'media-custom.ts')) && rd('ui', 'index.html').includes('data-brand-pick="web"') && /\['paper', 'web', 'radio'\]/.test(rd('ui', 'media-settings.js')) && /kind === 'web' \? 'webImage'/.test(rd('ui', 'media-brands.js')), 'newspaper: paper surface (halftone photos, extra stamp, ads) and office homepage with a per-paper header banner and its own round logo (changed in settings separately from the newspaper image)');
  }

  // ---- 홈페이지 = 피드 + 분야 탭(2026-11-10): 앱과 화면의 분야 규칙이 같고, 탭 기사는 그 분야 사실로만 많아야 3건 ----
  {
    const pp = rd('ui', 'paper.html');
    const uiRules = [...pp.matchAll(/\['(\w+)', \/(.+?)\/i\],?\n/g)].map((m) => m[1] + ':' + m[2]);
    check(TAB_RULES.every(([k, re]) => uiRules.includes(k + ':' + re.source)) && uiRules.length === TAB_RULES.length, 'news tabs: app and homepage use the same section rules');
    check(tabOf('A이(가) B에 선전포고했다') === 'war' && tabOf('A and B signed a commercial pact') === 'diplomacy' && tabOf('새 지도자 X가 즉위했다') === 'politics' && tabOf('은하 위기가 시작되었다') === 'galaxy' && tabOf('LoG 결승') === 'sports', 'news tabs: chronicle lines go to the right tab (unmatched = galaxy)');
    const sm = JSON.stringify(sectionMessages('P', '2231.01.01', 'War', [{ date: '2230.05.01', text: 'X declared war on Y', who: 'X' }], ['Front page story']));
    const ps = parseSection('{"articles":[{"title":"a","body":"b","photo":"P1"},{"title":"c","body":"d"},{"title":"e","body":"f"},{"title":"g","body":"h"}]}');
    check(sm.includes('at most 3 articles') && sm.includes('never pad') && sm.includes('Front page story') && sm.includes('X declared war on Y') && !!ps && ps.length === 3 && ps[0].photo === 'P1' && parseSection('{"articles":[]}')?.length === 0 && parseSection('nope') === null, 'news tabs: section prompt (facts only, at most 3, no repeats of the front page) and parser');
    check(/ipcMain\.handle\('newsSection'/.test(src('features/media.ts')) && /setSection\(id, sk, \[\]\)/.test(src('features/media.ts')) && src('preload.ts').includes("newsSection: (id: number, tab: string, paper?: number) => ipcRenderer.invoke('newsSection', id, tab, paper)") && /function webFeed\(/.test(pp) && /const WEB_PAGE = 9;/.test(pp) && /pg\.className = 'pager'/.test(pp) && !/webShown/.test(pp) && !/nav\('#e9ebef'/.test(pp), 'homepage: one feed across issues (no issue paging), tabs ask the app for this year\'s section stories and remember an empty section');
    check(/ipcMain\.handle\('newsLive'/.test(src('features/media.ts')) && /ipcMain\.handle\('newsLiveWrite'/.test(src('features/media.ts')) && /liveStore\(\)\.get\(sid, key, pi\)/.test(src('features/media.ts')) && src('preload.ts').includes("newsLiveWrite: (key: string, paper?: number) => ipcRenderer.invoke('newsLiveWrite', key, paper)")
      && /s\.onclick = \(\) => openLive\(f\.key\)/.test(pp) && /setInterval\(loadLive, 20000\)/.test(pp) && /if \(!closeReader\(\)\) window\.sllm\.paperClose\(\)/.test(pp), 'homepage live news: chronicle lines shown as they are (no LLM), a story is written only when the reader clicks one, and kept');
    // 2026-11-10 사용자: 신문사 홈페이지 3곳을 탭으로 오가고, 각 홈페이지엔 그 신문사 기사만, 실시간·분야 기사는 보고 있는 신문사가 쓴다
    check(sectionKey('war', undefined, 1) === 'war' && sectionKey('war', 1, 1) === 'war' && sectionKey('war', 2, 0) === 'war#2' && /const secKey = \(tab, wp, it\) => \(wp === \(it\.paper \?\? 0\) \? tab : tab \+ '#' \+ wp\)/.test(pp)
      && /tabs\.className = 'ptabs'/.test(pp) && /if \(\(it\.paper \?\? 0\) === wp\) for \(const a of it\.articles/.test(pp) && /\(st\.paper \?\? 0\) === wp/.test(pp) && /window\.sllm\.newsLiveWrite\(key, wp\)/.test(pp) && /window\.sllm\.newsSection\(cur\.id, tab, wp\)/.test(pp) && /papers: paperTabs\(\)/.test(src('features/media.ts')),
      'homepage: one site per newspaper (tabs, only that paper\'s stories; live and section stories written by the paper being read)');
    // 2026-11-10 사용자: LLM 을 아끼려고 신문 구독제(무료, 처음엔 하나 고르기). 구독하지 않은 신문사는 새 기사를 쓰지 않는다
    { const md = src('features/media.ts');
      check(/ipcMain\.handle\('newsSubscribe'/.test(md) && /if \(!next\.some\(Boolean\)\) return \{ ok: false, last: true \}/.test(md) && (md.match(/if \(!subscribed\(pi\)\) return \{ ok: false, unsub: true \}/g) || []).length === 2
        && /settings\.newsSubPicked = settings\.newsSubPicked === true/.test(src('app/settings.ts')) && src('preload.ts').includes("newsSubscribe: (paper: number, on: boolean, only?: boolean) => ipcRenderer.invoke('newsSubscribe', paper, on, only)")
        && /function subPicker\(\)/.test(pp) && /if \(!isSub\(wp\)\) return; \/\/ 구독하지 않은 신문사는 쓰지 않는다/.test(pp) && /if \(!isSub\(wp\)\) \{ document\.querySelector/.test(pp),
        'newspaper subscriptions: free, pick one at first, unsubscribed papers write nothing new (app refuses too), the last one cannot be cancelled'); }
  }

  // ---- 실시간 신문 소식(2026-11-10): 모드가 큰 사건이 터지는 순간 SLLM:NEWS 한 줄 → 앱이 연대기 글로 ----
  {
    const ev = rd('tester-mod', 'events', 'sllm_news_events.txt'), oa = rd('tester-mod', 'common', 'on_actions', 'sllm_news_on_actions.txt');
    const kinds = ['mega', 'gov', 'captured', 'bombed', 'fed_lead', 'galcom'];
    check(!!ev && bal(ev) && bal(oa) && noParamInLog(ev) && [1, 2, 3, 4, 5, 6].every((i) => ev.includes('id = sllm_news.' + i) && oa.includes('sllm_news.' + i + ' ')) && kinds.every((k) => ev.includes('kind=' + k + '/'))
      && /leader_event = \{\s*id = sllm_news\.3/.test(ev) && /planet_event = \{\s*id = sllm_news\.4/.test(ev) && ['on_megastructure_built', 'on_post_government_changed', 'on_leader_captured', 'on_colony_destroyed_by_bombardment', 'on_federation_new_leader', 'on_galactic_community_formed'].every((h) => oa.includes(h + ' = {')),
      'live news mod: six hidden events on real game hooks, one SLLM:NEWS line each, right event type per scope');
    const mk = (kv: Record<string, string>) => newsFrom({ kind: 'NEWS', kv } as never);
    const t = [mk({ kind: 'mega', date: '2231.01.02', a: '3', aname: 'Blorg', what: 'Dyson Sphere', where: 'Sol' }), mk({ kind: 'gov', date: 'd', a: '3', aname: 'Blorg', gov: 'Holy Theocracy' }), mk({ kind: 'captured', date: 'd', a: '3', aname: 'Blorg', b: '4', bname: 'Kir', leader: 'Zorn', where: 'Vega' }),
      mk({ kind: 'bombed', date: 'd', a: '3', aname: 'Blorg', where: 'Aria' }), mk({ kind: 'fed_lead', date: 'd', a: '3', aname: 'Blorg' }), mk({ kind: 'galcom', date: 'd', a: '3', aname: 'Blorg' })];
    check(t.every((n) => !!n && !newsText(n).includes('?') && newsText(n).includes('Blorg')) && newsText(t[0]!).includes('Dyson Sphere') && newsText(t[2]!).includes('Zorn') && mk({ kind: 'mega', date: 'd', aname: 'X' }) === null
      && kinds.every((k) => MAJOR_WORLD.has(k) && NOT_ON_RADIO.has(k)) && tabOf(newsText(t[2]!)) === 'war' && tabOf(newsText(t[1]!)) === 'politics' && scenesOf(newsText(t[0]!))[0] === 'n_laboratory',
      'live news app: new kinds become full chronicle sentences (names, places), kept as world news, not doubled on the radio, sorted into tabs and given photos');
    // 2026-11-10 사용자: 전투 승리·고고학·궤도 폭격도 기사로(폭격 훅은 날마다 불리므로 표식으로 처음 한 번만)
    const k2 = ['battle', 'arch', 'bomb_start', 'bomb_dead'];
    const ev9 = /id = sllm_news\.9[\s\S]*?trigger = \{\s*NOT = \{ has_planet_flag = sllm_news_bomb \}/.test(ev) && /set_timed_planet_flag = \{ flag = sllm_news_bomb days = 360 \}/.test(ev);
    check([7, 8, 9, 10].every((i) => ev.includes('id = sllm_news.' + i) && oa.includes('sllm_news.' + i + ' ')) && k2.every((k) => ev.includes('kind=' + k + '/'))
      && ['on_space_battle_won', 'on_arch_site_finished', 'on_planet_bombarded', 'on_pop_bombed_to_death'].every((h) => oa.includes(h + ' = {'))
      && /fleet_event = \{\s*id = sllm_news\.8/.test(ev) && /planet_event = \{\s*id = sllm_news\.9/.test(ev) && /planet_event = \{\s*id = sllm_news\.10/.test(ev)
      && ev9 && /trigger = \{\s*NOT = \{ has_country_flag = sllm_news_battle \}/.test(ev) && /is_at_war_with = From/.test(ev) && /has_country_flag = sllm_news_bomb_ai/.test(ev),
      'live news mod: battle wins, finished dig sites and orbital bombardment report once (daily bombardment hook exits on the planet flag first; AI-only bombardment once a year per attacker)');
    const u = [mk({ kind: 'battle', date: 'd', a: '3', aname: 'Blorg', b: '4', bname: 'Kir', leader: 'Zorn', what: 'Home Guard' }), mk({ kind: 'arch', date: 'd', a: '3', aname: 'Blorg', where: 'Zanaam Ruins', leader: 'Ix' }),
      mk({ kind: 'bomb_start', date: 'd', a: '3', aname: 'Blorg', b: '4', bname: 'Kir', where: 'Aria' }), mk({ kind: 'bomb_dead', date: 'd', a: '3', aname: 'Blorg', b: '4', bname: 'Kir', where: 'Aria' })];
    const pix = [{ file: 'human_battle.webp', cls: 'human', scene: 'battle', desc: '' }, { file: 'n_two_fleets.webp', cls: 'neutral', scene: 'two_fleets', desc: '' }];
    check(u.every((n) => !!n && !newsText(n).includes('?') && newsText(n).includes('Blorg')) && mk({ kind: 'battle', date: 'd', aname: 'X', bname: 'Y' }) === null && mk({ kind: 'bomb_start', date: 'd', aname: 'X', bname: 'Y' }) === null
      && k2.every((k) => MAJOR_WORLD.has(k) && NOT_ON_RADIO.has(k)) && tabOf(newsText(u[0]!)) === 'war' && tabOf(newsText(u[2]!)) === 'war'
      && scenesOf(newsText(u[0]!))[0] === 'battle' && scenesOf(newsText(u[1]!))[0] === 'archaeology' && scenesOf(newsText(u[2]!))[0] === 'bombardment' && scenesOf(newsText(u[3]!))[0] === 'bombardment'
      && pickPhoto(pix, ['battle', 'n_two_fleets'], { cls: 'avian' }, () => 0)?.file === 'n_two_fleets.webp' && pickPhoto(pix, ['battle', 'n_two_fleets'], { cls: 'human' }, () => 0)?.file === 'human_battle.webp',
      'live news app: battle/dig/bombardment sentences, war tab, ship photos of the right empire — never a human fleet standing in for another species (falls back to the species-free shot)');
    // 2026-11-10 사용자: 1차 함선 정지 사진은 「자료사진」으로 — 현장 사진이 없으면 그 계열 자료사진, 그것도 없으면 종족 없는 사진. 특수 세력(몰락 제국·위기)은 함선 양식이 아니라 그 제국으로 판별
    const fx = [{ file: 'avian_file_fleet.webp', cls: 'avian', scene: 'file_fleet', desc: '' }, { file: 'avian_file_science.webp', cls: 'avian', scene: 'file_science', desc: '' }, { file: 'prethoryn_file_fleet.webp', cls: 'prethoryn', scene: 'file_fleet', desc: '' },
      { file: 'avian_battle.webp', cls: 'avian', scene: 'battle', desc: '' }, { file: 'n_war_fleet.webp', cls: 'neutral', scene: 'war_fleet', desc: '' }, { file: 'avian_celebration.webp', cls: 'avian', scene: 'celebration', desc: '' }];
    const ixs = JSON.parse(fs.readFileSync(path.join(root, 'ui', 'news', 'photos', 'index.json'), 'utf8')) as PhotoEntry[];
    check(pickPhoto(fx, ['battle'], { cls: 'avian' }, () => 0)?.file === 'avian_battle.webp' && pickPhoto(fx, ['war_fleet', 'n_war_fleet'], { cls: 'avian' }, () => 0)?.file === 'avian_file_fleet.webp'
      && pickPhoto(fx, ['archaeology'], { cls: 'avian' }, () => 0)?.file === 'avian_file_science.webp' && pickPhoto(fx, ['war_fleet', 'n_war_fleet'], { cls: 'reptilian' }, () => 0)?.file === 'n_war_fleet.webp'
      && pickPhoto(fx, ['war_fleet', 'n_war_fleet'], { cls: 'avian', gest: 2 }, () => 0)?.file === 'avian_file_fleet.webp' && pickPhoto(fx, ['war_fleet', 'n_war_fleet'], { cls: 'avian', ship: 'prethoryn' }, () => 0)?.file === 'prethoryn_file_fleet.webp'
      && pickPhoto(fx, ['victory_return', 'celebration'], { cls: 'avian' }, () => 0)?.file === 'avian_celebration.webp'
      && shipKeyOf('swarm', 2, 'x') === 'prethoryn' && shipKeyOf('fallen_empire', 1, 'x') === 'fallen_machine' && shipKeyOf('awakened_fallen_empire', 0, 'x') === 'fallen' && shipKeyOf('extradimensional_2', 0, 'x') === 'unbidden'
      && shipKeyOf('default', 2, 'Hive of Zorg') === null && shipKeyOf(undefined, 0, '프레소린 스컬지') === 'prethoryn' && shipKeyOf('default', 0, 'Contingency') === 'contingency'
      && ixs.filter((e) => e.scene.startsWith('file_')).length === 51 && ['contingency', 'prethoryn'].every((c) => ixs.some((e) => e.cls === c && e.scene === 'file_fleet')) && !ixs.some((e) => e.cls === 'robot' && e.scene.startsWith('file_')),
      'news photos: archive ship photos fill in when there is no scene photo (hive empires use their species fleet), special factions by who they are, not by ship set');
    const sx = [{ file: 'lithoid_fleet_review.webp', cls: 'lithoid', scene: 'fleet_review', desc: '' }, { file: 'lithoid_archaeology.webp', cls: 'lithoid', scene: 'archaeology', desc: '' }, { file: 'lithoid_file_fleet.webp', cls: 'lithoid', scene: 'file_fleet', desc: '' }, { file: 'human_two_fleets.webp', cls: 'human', scene: 'two_fleets', desc: '' }];
    check(pickPhoto(sx, ['two_fleets', 'n_two_fleets'], { cls: 'lithoid' }, () => 0)?.file === 'lithoid_fleet_review.webp' && pickPhoto(sx, ['first_contact', 'n_first_contact'], { cls: 'lithoid' }, () => 0)?.file === 'lithoid_archaeology.webp'
      && pickPhoto(sx, ['two_fleets'], { cls: 'human' }, () => 0)?.file === 'human_two_fleets.webp',
      'news photos: a missing ship scene borrows a similar scene of the same species (ships still match the empire) before archive photos');
    // 2026-11-10 사용자 제보: 접촉도 없는 게임 초반에 신문에 은하 판세(남의 함대 순위)·모르는 해적 멸망이 실림 → 아는(통신 있는) 나라 일만
    const kc = new Map<number, { name: string }>([[5, { name: 'Elf Empire' }]]), tcs = [{ idx: 9, name: 'Kirr' }];
    const ma = src('features/mail-app.ts'), ta = src('features/temper-app.ts');
    check(knownEmpire(5, 'x', kc, []) && knownEmpire(-1, 'Elf Empire', kc, []) && knownEmpire(9, '', kc, tcs) && !knownEmpire(7, 'White Raiders', kc, tcs) && !knownEmpire(undefined, undefined, kc, tcs)
      && GALAXY_WIDE.has('crisis') && /const unknown = !mine && !GALAXY_WIDE\.has\(n\.kind\) && !knownEmpire\(n\.a, n\.aname, mail\.countries, terminal\.all\) && !knownEmpire\(n\.b, n\.bname, mail\.countries, terminal\.all\)/.test(ma) && /if \(!unknown\) \{/.test(ma)
      && /const seenTop = b\.top\.filter\(\(x\) => x\.us \|\| knownEmpire\(/.test(ta) && /seenTop\.some\(\(x\) => !x\.us\) \? yearHeadline\(y, seenTop/.test(ta),
      'news only about empires we know: AI-only events between unknown empires and the yearly balance-of-power line skip empires we have no contact with (galaxy-wide crises still run)');
  }
}
