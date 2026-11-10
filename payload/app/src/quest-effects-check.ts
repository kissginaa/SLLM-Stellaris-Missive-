// 퀘스트 효과 엔진 자체 검사(2026-10-26). selftest.ts 에서 runQuestEffectChecks() 로 부른다.
import { QUEST_EFFECTS, QUEST_RESOURCES, QUEST_SLOTS } from './quest-catalog';
import { planQuestEffects, questApplyCommand, questClearCommand, questEffectMenu, questEffectText, questResourceText, amountToSteps, effectCap, questEffectById, freeQuestSlot, questYearFactor, parseQuestEffectReply, type QuestTarget } from './quest-effects';

export function runQuestEffectChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'quest-effects: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  const CID = 'a'.repeat(32), country: QuestTarget = { kind: 'country' }, planet: QuestTarget = { kind: 'planet', k: 3 };

  // 카탈로그
  check(QUEST_EFFECTS.length === 145 && QUEST_RESOURCES.length === 17 && QUEST_SLOTS === 8, 'catalog size 145 effects + 17 resources, 8 slots');
  check(new Set(QUEST_EFFECTS.map((e) => e.id)).size === QUEST_EFFECTS.length, 'effect ids unique');
  check(QUEST_EFFECTS.filter((e) => e.show === 'pct' && e.step === 0.01).every((e) => e.max <= 15), 'percent effects capped at 15% (user rule)');
  check(QUEST_EFFECTS.every((e) => e.min >= 1 && e.min <= e.max && (e.good === 1 || e.good === -1)), 'ranges sane');
  check(questEffectById('BioAssembly')?.id === 'assembly' && questEffectById('happiness')?.keys[0] === 'pop_happiness', 'aliases and lookup');

  // 크기 해석
  const hap = questEffectById('happiness')!, trust = questEffectById('trust')!, storage = questEffectById('storage')!;
  check(amountToSteps(hap, 6) === 6 && amountToSteps(hap, 0.06) === 6 && amountToSteps(hap, -4) === 4, 'pct amount: 6, 0.06, -4');
  check(amountToSteps(trust, 0.1) === 10 && amountToSteps(trust, 10) === 10, 'fractional num amount (trust 0.1 = 10 steps)');
  check(amountToSteps(storage, 30) === 30 && amountToSteps(hap, 'x') === 0, 'step amount and garbage');

  // 계획: 자르기·합치기·범위
  const p1 = planQuestEffects('```json\n{"reward":[{"id":"happiness","amount":40,"days":5000},{"id":"happiness","amount":3}],"penalty":[{"id":"stability","amount":4}]}\n```', { giver: 'governor', target: planet });
  const h = p1.effects.find((e) => e.id === 'happiness');
  check(!!h && h.steps === 15 && h.days === 1080 && h.dir === 'p', 'clamp to 15 steps and 1080 days, merge same id');
  check(p1.clamped.some((c) => c.id === 'happiness' && c.from === 43 && c.to === 15), 'clamp recorded');
  const st = p1.effects.find((e) => e.id === 'stability');
  check(!!st && st.dir === 'n' && st.steps === 4 && st.days === 360, 'penalty default 360 days');
  const p2 = planQuestEffects({ reward: [{ id: 'shipdmg', amount: 5 }, { id: 'nope', amount: 5 }] }, { giver: 'governor', target: planet });
  check(p2.effects.length === 0 && p2.dropped.some((d) => d.reason === 'scope') && p2.dropped.some((d) => d.reason === 'unknown'), 'governor cannot give fleet effect; unknown dropped');
  const p3 = planQuestEffects({ reward: [{ id: 'happiness', amount: 15 }] }, { giver: 'governor', target: { kind: 'sector', lid: 7 } });
  check(p3.effects[0]?.steps === 10 && effectCap(hap, { kind: 'sector', lid: 1 }) === 10, 'sector cap = 2/3');
  check(planQuestEffects({ reward: [{ id: 'happiness', amount: 5 }] }, { giver: 'admiral', target: country }).dropped[0]?.reason === 'giver_target', 'admiral must target a fleet');
  const p4 = planQuestEffects({ reward: [{ id: 'shipdmg', amount: 5 }, { id: 'navalcap', amount: 5 }] }, { giver: 'admiral', target: { kind: 'fleet', lid: 9 } });
  check(p4.effects.length === 1 && p4.effects[0].id === 'shipdmg' && p4.dropped[0]?.id === 'navalcap', 'fleet target takes only fleet effects');
  const p5 = planQuestEffects({ reward: [{ id: 'shipdmg', amount: 5 }, { id: 'jobs', amount: 5 }] }, { giver: 'minister', target: country, groups: ['fleet'] });
  check(p5.effects.length === 1 && p5.dropped[0]?.reason === 'group', 'minister limited to own groups');

  // 자원
  const r1 = planQuestEffects({ reward: [{ resource: 'alloys', amount: 5 }], penalty: [{ id: 'res_menace', amount: 3 }, { id: 'res_influence', amount: 99 }] }, { giver: 'foreign', target: country, year: 2260 });
  const al = r1.resources.find((r) => r.entry.key === 'alloys'), inf = r1.resources.find((r) => r.entry.key === 'influence');
  check(!!al && al.months === 2 && al.min === 100 && al.max === 3000, 'resource: 5 steps = 2 months, year 2260 caps x2');
  check(!!inf && inf.steps === 15 && inf.dir === 'n' && r1.dropped.some((d) => d.id === 'res_menace' && d.reason === 'resource_unavailable'), 'resource clamp; menace only when allowed');
  check(questYearFactor(2200) === 1 && questYearFactor(2299) === 2 && questYearFactor(2400) === 3, 'year factor');

  // 명령
  const c1 = questApplyCommand(12, '123456', CID, 3, planet, p1);
  check(c1.startsWith('effect every_playable_country') && c1.includes('sllm_save_id value = 123456'), 'command scoped to save');
  check(c1.includes('add_modifier = { modifier = sllm_q3_happiness_p days = 1080 multiplier = 15 }') && c1.includes('modifier = sllm_q3_stability_n days = 360 multiplier = 4'), 'modifier names and multiplier');
  check(c1.includes('check_variable = { which = sllm_q_n value = 3 }') && c1.includes('is_variable_set = sllm_qa_' + CID) && c1.includes('status=no_target'), 'planet loop, duplicate guard, no_target');
  check((c1.match(/\{/g) ?? []).length === (c1.match(/\}/g) ?? []).length, 'braces balanced (planet)');
  const c2 = questApplyCommand(13, '1', CID, 1, country, planQuestEffects({ reward: [{ id: 'researchspeed', amount: 4 }, { id: 'jobs', amount: 2 }, { resource: 'alloys', amount: 5 }] }, { giver: 'ruler', target: country }));
  check(c2.includes('modifier = sllm_q1_researchspeed_p days = 720 multiplier = 4') && /every_owned_colony = \{ remove_modifier = sllm_q1_jobs_p/.test(c2), 'country: country mods direct, planet mods on every colony');
  check(c2.includes('export_resource_income_to_variable = { resource = alloys variable = sllm_q_r }') && c2.includes('add_resource = { alloys = 1 mult = sllm_q_r }') && c2.includes('SLLM:QUESTRES'), 'resource reward via income x months');
  check((c2.match(/\{/g) ?? []).length === (c2.match(/\}/g) ?? []).length, 'braces balanced (country)');
  const c3 = questApplyCommand(14, '1', CID, 2, { kind: 'country' }, r1);
  check(c3.includes('export_resource_stockpile_to_variable = { resource = influence variable = sllm_q_s }') && c3.includes('multiply_variable = { which = sllm_q_r value = -1 }'), 'resource penalty capped by stockpile');
  const c4 = questApplyCommand(15, '1', CID, 4, { kind: 'fleet', lid: 9 }, p4);
  check(c4.includes('check_variable = { which = sllm_lid value = 9 } exists = fleet } fleet = { remove_modifier = sllm_q4_shipdmg_p') && (c4.match(/\{/g) ?? []).length === (c4.match(/\}/g) ?? []).length, 'fleet target via admiral');
  const c5 = questApplyCommand(16, '1', CID, 5, { kind: 'sector', lid: 7 }, p3);
  check(c5.includes('every_owned_colony = { limit = { exists = leader leader = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = 7 } } }') && !c5.includes('every_owned_sector') && (c5.match(/\{/g) ?? []).length === (c5.match(/\}/g) ?? []).length, 'sector target via governor');
  check(throws(() => questApplyCommand(0, '1', CID, 1, country, p1)) && throws(() => questApplyCommand(1, 'x', CID, 1, country, p1)) && throws(() => questApplyCommand(1, '1', 'bad', 1, country, p1))
    && throws(() => questApplyCommand(1, '1', CID, 9, country, p1)) && throws(() => questApplyCommand(1, '1', CID, 1, { kind: 'fleet', lid: 1 }, p1)), 'bad args rejected');
  const cl = questClearCommand(17, '1', CID, 3, planet, [{ id: 'happiness', dir: 'p' }, { id: 'stability', dir: 'n' }]);
  check(cl.includes('remove_modifier = sllm_q3_happiness_p') && cl.includes('remove_modifier = sllm_q3_stability_n') && cl.includes('status=cleared') && !cl.includes('add_modifier'), 'clear command');
  check(throws(() => questClearCommand(17, '1', CID, 3, planet, [{ id: 'nope', dir: 'p' }])), 'clear rejects unknown id');
  check(freeQuestSlot([1, 2, 4]) === 3 && freeQuestSlot([1, 2, 3, 4, 5, 6, 7, 8]) === 0, 'free slot');

  // 글·프롬프트
  const en = (ko: string, e: string) => e;
  check(questEffectText(h!) === '인구 행복 +15% · 1080일' && questEffectText(h!, en) === 'Pop Happiness +15% · 1080 days', 'effect text ko/en');
  check(questEffectText(st!, en) === 'Stability -4 · 360 days', 'penalty text (flat)');
  const cost = planQuestEffects({ reward: [{ id: 'bldcost', amount: 7 }] }, { giver: 'governor', target: planet }).effects[0];
  check(questEffectText(cost, en) === 'Building Cost -7% · 720 days', 'cost effect good direction is negative');
  check(questResourceText(al!, en).startsWith('Alloys +2 months of income'), 'resource text');
  const menu = questEffectMenu({ giver: 'governor', target: planet });
  check(menu.includes('happiness(Pop Happiness, 1-15%)') && !menu.includes('shipdmg(') && menu.includes('"reward"'), 'prompt menu filtered by target');
  check(!/[가-힣]/.test(menu), 'prompt menu is English');
  check(parseQuestEffectReply('garbage').reward.length === 0 && parseQuestEffectReply({ reward: { id: 'jobs', amount: 1 } }).reward.length === 1, 'reply parsing tolerant');
}
if (require.main === module) runQuestEffectChecks();
