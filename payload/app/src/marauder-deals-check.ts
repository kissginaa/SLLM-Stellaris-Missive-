// 약탈자 대응 자체 검사(2026-10-26). selftest.ts 에서 runMarauderChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import { MRD, TF, parseStatus, parseTargetRow, rankTargets, targetText, threatMin, redirectCost, hireCost, clampMercPct, statusCommand, withdrawCommand, redirectCommand, hireCommand, mercDealCommand, mercCheckCommand, marauderLines } from './marauder-deals';
import { parseReply } from './action';
import { systemPrompt, type TalkContext } from './prompt';

export function runMarauderChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'marauder: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

  // 수치(사용자 확정 2026-10-26)
  check(MRD.raidCost === 3000 && MRD.redirectSwing === 15 && MRD.mercMaxPct === 15, 'numbers: raid 3000 ±15%, merc discount ≤15%');
  check(redirectCost(0) === 3000 && redirectCost(15) === 3450 && redirectCost(-15) === 2550 && redirectCost(40) === 3450 && redirectCost(-99) === 2550 && redirectCost('x') === 3000, 'redirect cost clamps to ±15%');
  check(redirectCost(7) === 3210 && redirectCost(-3) === 2910, 'redirect cost rounds to 10');
  check(clampMercPct(20) === 15 && clampMercPct(-5) === 0 && clampMercPct(9.6) === 10, 'merc pct clamps to 0..15 (discount only)');
  check(threatMin(4) === 'superior' && threatMin(3) === 'superior' && threatMin(2) === 'equivalent' && threatMin(1) === null && threatMin(0) === null && threatMin(-1) === null, 'threat: superior+ succeeds, equivalent = AI, lower fails');

  // 상태 줄
  const st = parseStatus({ found: '1', raid: '1', pow: '3', m: '2' });
  check(!!st && st.found && st.raid && st.pow === 3 && st.m === 2 && !st.free, 'status parse (free missing = not free)');
  check(parseStatus({ found: '1', raid: '0', pow: '2', m: '1', free: '1' })!.free === true, 'status parse free');
  check(parseStatus({ pow: 'x', m: '1' }) === null && parseStatus({ found: '1', raid: '0', pow: '9', m: '1' })!.pow === 4, 'status parse rejects junk, clamps power');

  // 명령
  check(statusCommand(5, 4) === 'effect every_playable_country = { limit = { is_ai = no } sllm_mrd_status = { REQ = 5 TID = 4 } }', 'status command');
  check(withdrawCommand(6, 4, 'superior').includes('sllm_mrd_withdraw = { REQ = 6 TID = 4 MIN = superior }') && withdrawCommand(6, 4, 'equivalent').includes('MIN = equivalent'), 'withdraw command');
  check(throws(() => withdrawCommand(6, 4, 'inferior' as 'superior')) && throws(() => withdrawCommand(0, 4, 'superior')), 'withdraw command refuses bad input');
  check(redirectCommand(7, 4, 9, 3150, true).includes('sllm_mrd_redirect = { REQ = 7 TID = 4 TARGET = 9 COST = 3150 RIVAL = 1 }') && redirectCommand(7, 4, 9, 4500, false).includes('COST = 4500 RIVAL = 0'), 'redirect command');
  check(throws(() => redirectCommand(7, 4, 4, 3000, true)) && throws(() => redirectCommand(7, 4, 9, 0, true)) && throws(() => redirectCommand(7, 4, 9, 99999, false)) && throws(() => redirectCommand(7, 4, 9, 1.5, true)), 'redirect command refuses self target and bad cost');
  check(mercDealCommand(8, 4, 15).includes('sllm_mrd_merc_deal = { REQ = 8 TID = 4 PCT = 15 }') && throws(() => mercDealCommand(8, 4, 16)) && throws(() => mercDealCommand(8, 4, 0)), 'merc deal command 1..15');
  check(hireCommand(9, 4, 7, 3000, true).includes('sllm_mrd_hire = { REQ = 9 TID = 4 TARGET = 7 COST = 3000 RIVAL = 1 }') && hireCommand(9, 4, 7, 4500, false).includes('COST = 4500 RIVAL = 0') && throws(() => hireCommand(9, 4, 4, 3000, true)) && throws(() => hireCommand(9, 4, 7, 99999, false)) && throws(() => hireCommand(0, 4, 7, 3000, true)), 'hire command (건의 ①)');
  check(MRD.hireNonRivalMult === 1.5 && hireCost(0, true) === 3000 && hireCost(0, false) === 4500 && hireCost(15, false) === 5180 && hireCost(-15, false) === 3830 && hireCost(15, true) === 3450 && hireCost(15, false) <= MRD.raidCost * 2, 'hire cost: rival = redirect price, non-rival ×1.5 (사용자 확정)');
  check(mercCheckCommand() === 'effect every_playable_country = { limit = { is_ai = no } sllm_mrd_merc_check = yes }', 'merc check command');

  // 대화 행동 해석
  const w = parseReply('{"say":"Fine.","mood":"none","action":{"type":"marauder_withdraw"}}');
  check(w.action?.type === 'marauder_withdraw', 'parse marauder_withdraw');
  const r = parseReply('{"say":"Pay.","mood":"none","action":{"type":"marauder_redirect","target":7,"price_pct":40}}');
  check(r.action?.type === 'marauder_redirect' && r.action.target === 7 && r.action.pct === 15, 'parse marauder_redirect, pct clamped');
  check(parseReply('{"say":"x","action":{"type":"marauder_redirect","target":"abc"}}').action === null, 'redirect without target ignored');
  const h = parseReply('{"say":"Done.","mood":"none","action":{"type":"marauder_hire","target":9,"price_pct":-20}}');
  check(h.action?.type === 'marauder_hire' && h.action.target === 9 && h.action.pct === -15, 'parse marauder_hire, pct clamped');
  check(parseReply('{"say":"x","action":{"type":"marauder_hire"}}').action === null, 'hire without target ignored');
  const d = parseReply('{"say":"Deal.","action":{"type":"merc_discount","percent":30}}');
  check(d.action?.type === 'merc_discount' && d.action.pct === 15 && !!d.note, 'merc_discount capped at 15 with note');
  check(parseReply('{"say":"x","action":{"type":"merc_discount","percent":-3}}').action === null, 'negative discount ignored (never dearer)');

  // 대상 사정(건의 ①)
  check(JSON.stringify(parseTargetRow({ idx: '7', f: '5.000', tf: '1' })) === JSON.stringify({ idx: 7, f: 5, tf: 1 }) && parseTargetRow({ idx: '0', f: '1', tf: '1' }) === null && parseTargetRow({ idx: '3', f: '99', tf: '1' }) === null && parseTargetRow({ idx: '3', f: '0', tf: '9' })!.tf === 4, 'target row parse');
  const rows = new Map([[7, { f: 0, tf: 3 }], [9, { f: TF.rival | TF.border, tf: 1 }], [11, { f: TF.war | TF.raided, tf: 0 }]]);
  const rk = rankTargets([{ idx: 7, name: 'A' }, { idx: 9, name: 'B' }, { idx: 11, name: 'C' }, { idx: 13, name: 'D' }], rows);
  check(rk.map((t) => t.idx).join(',') === '9,13,7', 'targets: raided removed, rival/weak first, unknown kept');
  check(rankTargets(Array.from({ length: 12 }, (_, i) => ({ idx: i + 1, name: 'x' })), new Map()).length === 8, 'targets: at most 8');
  check(targetText(rk[0]) === '9: B (their rival, borders them, weak against your fleets)' && targetText({ idx: 13, name: 'D' }) === '13: D' && targetText({ idx: 7, name: 'A', f: TF.war | TF.rich, tf: 3 }) === '7: A (at war with them, richer than them, strong against your fleets)', 'target text');

  // 프롬프트(영어, 행동 목록 대체)
  const targets = [{ idx: 7, name: 'Tzynn' }, { idx: 9, name: 'Vosh' }];
  const strong = marauderLines({ found: true, raid: true, pow: 3, m: 1, free: false }, { targets, score: 10, dealActive: false }).join('\n');
  check(strong.includes('must back down') && strong.includes('"marauder_withdraw"') && strong.includes('7: Tzynn') && strong.includes('merc_discount') && strong.includes('3000'), 'prompt: superior → must yield, redirect + merc listed');
  const even = marauderLines({ found: true, raid: true, pow: 2, m: 1, free: false }, { targets, score: 0, dealActive: true }).join('\n');
  check(even.includes('evenly matched') && even.includes('already promised') && !even.includes('"merc_discount"'), 'prompt: equivalent → AI decides; active deal blocks new discount');
  const weak = marauderLines({ found: true, raid: true, pow: 1, m: 1, free: false }, { targets: [], score: 0, dealActive: false }).join('\n');
  check(weak.includes('never use marauder_withdraw') && !weak.includes('marauder_redirect"'), 'prompt: inferior → refuse; no targets → no redirect');
  const calm = marauderLines(null, { targets, score: 0, dealActive: false }).join('\n');
  const free = marauderLines({ found: true, raid: false, pow: 2, m: 1, free: true }, { targets: rk, score: 0, dealActive: false }).join('\n');
  const busy = marauderLines({ found: true, raid: false, pow: 2, m: 1, free: false }, { targets: rk, score: 0, dealActive: false }).join('\n');
  check(calm.includes('not raiding') && !calm.includes('"marauder_hire"') && !/[가-힣]/.test(strong + even + weak + calm + free + busy), 'prompt: no raid; all English');
  check(free.includes('4500 if it is not') && free.includes('"marauder_hire"') && free.includes('recommend') && free.includes('9: B (their rival') && !free.includes('11: C'), 'prompt: free clan recommends and can be hired');
  check(busy.includes('come back later') && !busy.includes('"marauder_hire"') && !strong.includes('"marauder_hire"'), 'prompt: busy clan or active raid → no hire');
  const c: TalkContext = { idx: 4, name: 'Khans', player: 'Us', opinionA: 0, opinionB: 0, score: 0, readOnlyActions: true, ctype: 'dormant_marauders', marauder: marauderLines({ found: true, raid: true, pow: 3, m: 1, free: false }, { targets, score: 0, dealActive: false }) } as TalkContext;
  const sp = systemPrompt(c);
  check(sp.includes('[Marauders]') && !sp.includes('"give_energy"') && !sp.includes('conversation only'), 'system prompt uses marauder actions instead of generic list');

  // 모드 파일(효과 이름·괄호)
  const md = process.env.SLLM_MRD_MOD || path.join(__dirname, '..', 'tester-mod');
  const f = path.join(md, 'common', 'scripted_effects', 'sllm_marauder_deals.txt'), tf = path.join(md, 'common', 'scripted_triggers', 'sllm_marauder_triggers.txt');
  if (!fs.existsSync(f) || !fs.existsSync(tf)) { check(false, 'mod files present'); return; }
  const txt = fs.readFileSync(f, 'utf8'), trg = fs.readFileSync(tf, 'utf8');
  const code = (s: string) => s.split('\n').map((l) => l.replace(/#.*$/, '')).join('\n').replace(/"[^"]*"/g, '""');
  const bal = (s: string) => { let n = 0; for (const ch of code(s)) { if (ch === '{') n++; else if (ch === '}' && --n < 0) return false; } return n === 0; };
  check(bal(txt) && bal(trg), 'mod braces balanced');
  for (const n of ['sllm_mrd_status', 'sllm_mrd_withdraw', 'sllm_mrd_redirect', 'sllm_mrd_merc_deal', 'sllm_mrd_merc_check', 'sllm_mrd_hire', 'sllm_mrd_find', 'sllm_mrd_end_raid', 'sllm_mrd_raid_flag']) check(new RegExp('^' + n + ' = \\{', 'm').test(txt), 'mod effect defined: ' + n);
  check(/^sllm_mrd_is_merc_fleet = \{/m.test(trg) && txt.includes('sllm_mrd_is_merc_fleet = yes'), 'merc fleet trigger defined and used');
  check(['armada_of_the_voidborn', 'star_rider_flotilla', 'first_storm_wing', 'dwamak_bashers', 'unhinged_screamer_flotilla', 'frenzied_volunteer_squadron', 'her_chosen_champions', 'order_of_eternal_night', 'twilight_congregation'].every((x) => trg.includes(x) && txt.includes(x)), 'all 9 vanilla merc fleets covered');
  check(txt.includes('value = 9000') && txt.includes('value = 6500') && txt.includes('value = 4000'), 'merc refund uses vanilla hire prices');
  check(txt.includes('days = 360') && txt.includes('days = @raidcooldown') && txt.includes('id = marauder.33'), 'deal 1 year, vanilla cooldown, vanilla raid event');
  check((txt.match(/status=duplicate/g) ?? []).length === 4, 'every paid/changing op is deduplicated by request number');
  check(txt.includes('SLLM:MRDT/;/req=\\\\[This.sllm_mrdt_req]/;/tid=\\\\[This.sllm_mrdt_tid]') && txt.includes('/;/free=') && txt.includes('has_communications = event_target:sllm_player') && txt.includes('clear_variable = sllm_mrdt') && txt.includes('clear_variable = sllm_mrdt_tf'), 'status lists targets and clears its variables');
  check(strong.includes('4500 if it is not'), 'prompt: redirect also lists non-rival 1.5x price');
  check((txt.match(/which = sllm_mrd_riv value = \$RIVAL\$/g) ?? []).length === 2 && (txt.match(/status=norival"/g) ?? []).length === 2, 'redirect and hire both re-check rival price');
  check(txt.includes('which = sllm_mrd_riv value = $RIVAL$') && /check_variable = \{ which = sllm_mrd_riv value = 1 \} NOT = \{ is_rival = event_target:sllm_mr_target \}[\s\S]*status=norival/.test(txt), 'hire re-checks rival price in game');
  check((txt.match(/id = marauder\.33 scopes = \{ from = event_target:sllm_player \}/g) ?? []).length === 2 && /sllm_mrd_hire = \{[\s\S]*raid_ongoing[\s\S]*raid_cooldown[\s\S]*status=busy/.test(txt), 'hire uses vanilla raid event and refuses busy clan');
}
