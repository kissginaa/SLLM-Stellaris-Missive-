// 그레이트 칸 특별 대우 자체 검사(2026-10-26). selftest.ts 에서 runKhanChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import { KHAN, khanCheckCommand, parseKhan, khanEligible, khanBlessCommand, khanTalkLine, sanitizeKhan, type KhanCheck } from './khan';
import { systemPrompt, type TalkContext } from './prompt';

export function runKhanChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'khan: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  check(KHAN.minOpinion === 50 && KHAN.giftMonths === 6 && KHAN.favorPct === 15, 'numbers: opinion +50, alloys 6 months, favor +15%');
  const c = khanCheckCommand(5, '123456');
  check(c.includes('is_country_type = awakened_marauders') && [1, 2, 3].every((n) => c.includes(`has_country_flag = marauder_${n}`) && c.includes(`has_country_flag = sllm_fought_marauder_${n}`)), 'check: khan + clan flags + fought flags');
  check(c.includes('has_country_flag = hired@event_target:sllm_kh_k') && c.includes('sllm_mrd_is_merc_fleet = yes') && c.includes('overlord = { is_same_value = event_target:sllm_kh_k }') && c.includes('trigger = opinion parameters = { who = event_target:sllm_kh_p }') && c.includes('SLLM:KHAN/;/req=5') && c.includes('found=0'), 'check: hire history, satrapy, khan opinion of us, reply both ways');
  check((c.match(/\{/g) ?? []).length === (c.match(/\}/g) ?? []).length && c.length <= 4100 && throws(() => khanCheckCommand(0, '1')) && throws(() => khanCheckCommand(1, 'x')), 'check: braces, length, bad args');
  const k = parseKhan({ found: '1', clan: '2', fought: '0', hired: '0', sat: '0', fav: '0', op: '55', idx: '7', name: 'Horde "X"' });
  check(k.found && k.clan === 2 && !k.fought && k.op === 55 && k.idx === 7 && !k.name.includes('"'), 'parse');
  const base: KhanCheck = { ...k, op: 10 };
  check(khanEligible({ ...base, op: 50 }) && khanEligible({ ...base, hired: true }) && khanEligible(base, true) && !khanEligible(base), 'eligible: opinion ≥ 50, or hire history, or app deal');
  check(!khanEligible({ ...base, op: 90, fought: true }) && !khanEligible({ ...base, op: 90, clan: 0 }) && !khanEligible({ ...base, op: 90, found: false }), 'never if we fought that clan');
  const b = khanBlessCommand(6, '123456', 2240);
  check(b.includes('has_country_flag = sllm_khan_favored') && b.includes('set_country_flag = sllm_khan_favored') && b.includes('resource = alloys') && b.includes('value = 6 }') && b.includes('value < 50') && b.includes('value > 1500') && b.includes('status=duplicate') && b.includes('status=given'), 'bless: alloys 6 months clamped 50..1500, favor flag, once');
  check(khanBlessCommand(6, '1', 2260).includes('value > 3000'), 'bless: late game year factor');
  const good = khanTalkLine({ checked: true, eligible: true, clan: 1, idx: 7, name: 'H', on: '' }), bad = khanTalkLine({ checked: true, eligible: false, clan: 1, idx: 7, name: 'H', on: '', fought: true });
  check(good.includes('[Old ties]') && good.includes('+15%') && bad.includes('[Old grudge]') && khanTalkLine(null) === '' && khanTalkLine({ checked: true, eligible: false, clan: 1, idx: 7, name: '', on: '' }) === '' && !/[가-힣]/.test(good + bad), 'talk lines (English)');
  const t = { idx: 7, name: 'Horde', player: 'Us', opinionA: 0, opinionB: 0, score: 0, khan: good } as TalkContext;
  check(systemPrompt(t).includes('[Old ties]'), 'prompt carries the line');
  check(sanitizeKhan({ checked: true, eligible: true, clan: 2, idx: 7, name: 'x', on: '2240.01.01', gift: 900 })?.gift === 900 && sanitizeKhan({}) === null, 'sanitize');
  // 모드 파일
  const md = process.env.SLLM_MRD_MOD || path.join(__dirname, '..', 'tester-mod');
  const ev = path.join(md, 'events', 'sllm_khan_events.txt'), oa = path.join(md, 'common', 'on_actions', 'sllm_khan_on_actions.txt'), sm = path.join(md, 'common', 'static_modifiers', 'sllm_khan_modifiers.txt'), ko = path.join(md, 'localisation', 'korean', 'sllm_khan_l_korean.yml'), en = path.join(md, 'localisation', 'english', 'sllm_khan_l_english.yml');
  if (![ev, oa, sm, ko, en].every((f) => fs.existsSync(f))) { check(false, 'mod files present'); return; }
  const E = fs.readFileSync(ev, 'utf8'), O = fs.readFileSync(oa, 'utf8'), S = fs.readFileSync(sm, 'utf8'), K = fs.readFileSync(ko, 'utf8'), N = fs.readFileSync(en, 'utf8');
  const bal = (s: string) => (s.match(/\{/g) ?? []).length === (s.match(/\}/g) ?? []).length;
  check(bal(E) && bal(O) && bal(S) && /namespace = sllm_khan/.test(E) && /id = sllm_khan\.1\b/.test(E) && /id = sllm_khan\.10\b/.test(E), 'events defined, braces');
  check(O.includes('on_space_battle_won') && O.includes('on_space_battle_lost') && O.includes('on_monthly_pulse_country') && (O.match(/sllm_khan\.1 /g) ?? []).length === 2 && O.includes('sllm_khan.10'), 'on_actions: both battle results + monthly');
  check(['dormant_marauders', 'marauder_raiders', 'awakened_marauders'].every((x) => E.includes(x)) && E.includes('overlord = { is_country_type = awakened_marauders }') && E.includes('remove_modifier = sllm_khan_favor'), 'battle record for clan/raiders/khan; favor only while the khan\'s satrapy');
  check(['energy', 'minerals', 'food', 'alloys', 'consumer_goods'].every((r) => S.includes(`country_${r}_produces_mult = 0.15`)), 'favor = +15% basic resources');
  check(K.startsWith('﻿l_korean:') && N.startsWith('﻿l_english:') && K.includes('sllm_khan_favor:0') && N.includes('sllm_khan_favor_desc:0'), 'localisation KO/EN');
}
