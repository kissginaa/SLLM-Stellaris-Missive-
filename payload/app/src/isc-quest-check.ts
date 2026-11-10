// 성간 임시회의 과제 자체 검사(2026-10-26). selftest.ts 에서 runIscQuestChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import { INCOME_RES, STOCK_RES } from './policy';
import { chainOf, logNum, monthsLeft, freeLogSlot, logBeginCommand, logUpdateCommand, LOG_SLOTS, ISCQ, pickGiver, canOffer, questMessages, parseQuestReply, fillTargets, judge, goalText, fxText, planOf, dueOf, offerUntilOf, measureCommand, parseQuestMeasure, giftCommand, sanitizeQuests, GIFT_RES, type IscQuest, type QuestMeasure, type Target } from './isc-quest';

export function runIscQuestChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'isc-quest: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  const CID = 'b'.repeat(32);

  // 수치(사용자 확정 2026-10-26)
  check(ISCQ.maxActive === 3 && ISCQ.monthsMin === 12 && ISCQ.monthsMax === 36 && ISCQ.opSuccess === 15 && ISCQ.opFail === 15 && ISCQ.stepSuccess === 2 && ISCQ.stepFail === 4, 'numbers: 3 at once, 1-3 years, opinion ±15 (steps 2/4)');

  // 과제를 낼 통치자
  const seats = [{ idx: 2, present: true }, { idx: 3, present: true }, { idx: 4, present: false }, { idx: 5, present: true }];
  check(pickGiver(seats, { 2: 0.4, 3: 1, 4: 1, 5: 0.4 }, {}, []) === 3, 'giver = most relevant present ruler');
  check(pickGiver(seats, { 2: 0.4, 3: 1, 5: 0.4 }, { 2: 1, 5: 4 }, [3]) === 5, 'busy giver skipped; tie → most turns');
  check(pickGiver([{ idx: 2, present: true }], {}, {}, [2]) === null, 'no giver when all busy');
  const q0 = (state: IscQuest['state'], meetingId = 'm0', idx = 2) => ({ id: CID, meetingId, topic: 't', giver: { idx, empire: 'E', ruler: 'R' }, title: 'T', say: '', goal: { type: 'naval', months: 24, diff: 1 }, fx: { reward: [{ id: 'energy', amount: 5, days: 720 }], penalty: [] }, state, offeredOn: '2240.01.01', offerUntil: '2240.02.01' }) as IscQuest;
  check(!canOffer([q0('active'), q0('active', 'a'), q0('active', 'b')], 'x').ok && canOffer([q0('active'), q0('success', 'a')], 'x').ok, 'at most 3 active');
  check(canOffer([q0('declined', 'm1')], 'm1').why === 'done', 'one task per summit');

  // 프롬프트(영어)
  const targets: Target[] = [{ idx: 2, name: 'Tzynn', atWar: false }, { idx: 3, name: 'Vosh', atWar: true }, { idx: 4, name: 'Kel', atWar: false }];
  const msgs = questMessages({ ruler: 'Ozan', empire: 'Tzynn', hostEmpire: 'Us', hostRuler: 'Me', date: '2240.01.01', topic: '북부 휴전', recent: 'Me (Us): hello', targets, giverIdx: 2 });
  const sys = msgs[0].content;
  check(sys.includes('"peace"') && sys.includes('"war"') && sys.includes('"gift"') && sys.includes('"relation"') && sys.includes('"income"') && sys.includes('"stock"') && sys.includes('"naval"'), 'prompt lists all 5 goal families');
  check(sys.includes('2: Tzynn (your own empire)') && sys.includes('3: Vosh (AT WAR with the host now)') && sys.includes('months 12-36') && sys.includes('Reply JSON'), 'prompt: targets, months, effect menu');
  check(!/[가-힣]/.test(sys.replace('북부 휴전', '')), 'prompt English except the host topic');

  // 응답 해석
  const base = { giverIdx: 2, hostIdx: 1, targets, year: 2240 };
  const ok1 = parseQuestReply('```json\n{"say":"Hold the line.","title":"Northern truce","goal":{"type":"peace","target":4,"months":60},"reward":[{"id":"happiness","amount":40,"days":720}],"penalty":[{"id":"stability","amount":5}]}\n```', base);
  check(ok1.ok && ok1.goal.type === 'peace' && ok1.goal.target === 4 && ok1.goal.months === 36 && ok1.goal.targetName === 'Kel', 'peace goal parsed, months clamped to 36');
  check(ok1.ok && ok1.fx.reward[0].id === 'happiness' && ok1.fx.reward[0].amount === 15 && ok1.fx.penalty[0].id === 'stability', 'reward clamped to 15% (engine cap), penalty kept');
  check(!parseQuestReply('{"goal":{"type":"peace","target":3},"reward":[{"id":"energy","amount":5}]}', base).ok, 'peace with an empire already at war refused');
  check(!parseQuestReply('{"goal":{"type":"war","target":2},"reward":[{"id":"energy","amount":5}]}', base).ok, 'war on the giver refused');
  check(!parseQuestReply('{"goal":{"type":"war","target":9},"reward":[{"id":"energy","amount":5}]}', base).ok, 'unknown target refused');
  check(!parseQuestReply('{"goal":{"type":"naval","difficulty":2},"reward":[]}', base).ok, 'no reward → refused');
  check(!parseQuestReply('{"goal":{"type":"conquer"},"reward":[{"id":"energy","amount":5}]}', base).ok && !parseQuestReply('nonsense', base).ok, 'unknown goal / junk refused');
  const gift = parseQuestReply('{"goal":{"type":"gift","resource":"res_alloys","amount":40},"reward":[{"id":"researchspeed","amount":6}]}', base);
  check(gift.ok && gift.goal.res === 'alloys' && gift.goal.steps === 15 && gift.goal.months === 0, 'gift: resource key + steps clamped to 15');
  check(!parseQuestReply('{"goal":{"type":"gift","resource":"influence","amount":3},"reward":[{"id":"energy","amount":5}]}', base).ok && GIFT_RES.includes('sr_zro'), 'gift only tradeable resources');
  const rel = parseQuestReply('{"goal":{"type":"relation","difficulty":7,"months":5},"reward":[{"id":"energy","amount":5}]}', base);
  check(rel.ok && rel.goal.target === 2 && rel.goal.diff === 3 && rel.goal.months === 12, 'relation defaults to giver, diff/months clamped');
  const inc = parseQuestReply('{"goal":{"type":"income","resource":"physics","difficulty":1,"months":24},"reward":[{"id":"energy","amount":5}]}', base);
  check(inc.ok && inc.goal.res === 'physics_research', 'income resource aliases');

  // 측정·목표 채우기·판정
  const kv: Record<string, string> = { sid: '123456', nv: '0.5', i_energy: '100', i_physics_research: '200', s_alloys: '1000' };
  const meas: QuestMeasure = parseQuestMeasure(kv, [{ idx: '2', op: '10', war: '0' }, { idx: '4', op: '-30', war: '0' }]);
  check(meas.alive.join() === '2,4' && meas.ops['4'] === -30 && meas.wars['2'] === false && meas.income.physics_research === 200 && meas.naval === 0.5, 'measure parse');
  const g1 = { ...(rel as any).goal }; check(fillTargets(g1, meas) && g1.base === 10 && g1.goal === 110, 'relation target = base + 100 (difficulty 3)');
  const g2 = { ...(inc as any).goal }; check(fillTargets(g2, meas) && g2.base === 200 && g2.goal === 210, 'income target = +5% (difficulty 1)');
  const g3 = { type: 'naval', months: 24, diff: 1 } as any; check(!fillTargets(g3, { ...meas, naval: 0.7 }) && fillTargets({ type: 'naval', months: 24, diff: 1 } as any, meas), 'naval already above target → not offered');
  check(!fillTargets({ type: 'peace', target: 2, months: 12 } as any, { ...meas, wars: { 2: true, 4: false } }) && !fillTargets({ type: 'war', target: 9, months: 12 } as any, meas), 'peace/war need a live target not at war');
  const act = (goal: any): IscQuest => ({ ...q0('active'), goal, acceptedOn: '2240.01.01', due: '2242.01.01' });
  const peace = act({ type: 'peace', target: 4, months: 24 });
  check(judge(peace, meas, '2241.01.01').result === null && judge(peace, { ...meas, wars: { 4: true } }, '2241.01.01').result === 'failed' && judge(peace, meas, '2242.01.01').result === 'success', 'peace: war → fail, due → success');
  const war = act({ type: 'war', target: 4, months: 24 });
  check(judge(war, { ...meas, wars: { 4: true } }, '2240.06.01').result === 'success' && judge(war, meas, '2242.01.01').result === 'failed', 'war: at war → success, due → fail');
  const r2 = act({ ...g1 });
  check(judge(r2, { ...meas, ops: { 2: 120 } }, '2240.06.01').result === 'success' && judge(r2, meas, '2242.02.01').result === 'failed' && judge(r2, meas, '2241.02.01').result === null, 'relation: reach → success, due → fail');
  check(judge(r2, { ...meas, alive: [4] }, '2240.06.01').result === 'success', 'vanished target → success (not the player\'s fault)');
  check(dueOf('2240.03.01', 24) === '2242.03.01' && offerUntilOf('2240.03.01') === '2240.04.01', 'due and offer windows');

  // 글
  check(goalText({ type: 'peace', target: 4, targetName: 'Kel', months: 24 }).length > 0 && goalText(g1).includes('110') && goalText({ type: 'naval', months: 12, diff: 1, base: 0.5, goal: 0.6 } as any).includes('60'), 'goal text');
  const fx = (ok1 as any).fx;
  check(fxText(fx, 'reward', 2240).length === 1 && fxText(fx, 'penalty', 2240).length === 1 && planOf(fx, 'reward', 2240).effects[0].steps === 15 && planOf(fx, 'penalty', 2240).effects[0].dir === 'n', 'stored fx re-plans the same');

  // 명령
  const mc = measureCommand(7, '123456', [4, 2, 4]);
  check(mc.startsWith('effect every_playable_country') && mc.includes('sllm_save_id value = 123456') && (mc.match(/SLLM:ISCQO/g) ?? []).length === 2 && mc.includes('is_at_war_with = prev') && mc.includes('SLLM:ISCQM/;/req=7'), 'measure command: per target + summary');
  check(throws(() => measureCommand(0, '1', [2])) && throws(() => measureCommand(1, 'x', [2])), 'measure command refuses bad args');
  const gc = giftCommand(8, '123456', CID, 2, 'alloys', 15);
  check(gc.includes(`sllm_iqg_${CID}`) && gc.includes('status=short') && gc.includes('status=given') && gc.includes('multiply_variable = { which = sllm_iq_g value = 6 }') && gc.includes('value = 1500'), 'gift command: 6 months of income, engine cap, once per task');
  check(throws(() => giftCommand(8, '123456', CID, 2, 'influence', 3)) && throws(() => giftCommand(8, '123456', CID, 2, 'alloys', 16)) && throws(() => giftCommand(8, '123456', 'x', 2, 'alloys', 3)), 'gift command refuses bad args');
  check(sanitizeQuests([q0('active'), { id: 'bad' }, null, { ...q0('active'), state: 'weird' }]).length === 1, 'sanitize drops broken entries');

  // 게임 상황 기록(이벤트 체인)
  check(chainOf({ type: 'peace', months: 12 } as any) === 'peace' && chainOf({ type: 'income', res: 'alloys', months: 12 } as any) === 'income_alloys' && chainOf({ type: 'gift', months: 0 } as any) === null, 'chain names per goal (gift has none)');
  check(logNum({ type: 'naval' } as any, 0.756) === 76 && logNum({ type: 'income' } as any, 132.46) === 132.5 && logNum({ type: 'relation' } as any, null) === 0, 'log numbers');
  check(monthsLeft('2240.01.01', '2242.01.01') === 24 && monthsLeft('2242.02.01', '2242.01.01') === 0 && monthsLeft('2240.01.15', '2240.03.01') === 2, 'months left');
  const withLog = (log: number) => ({ ...q0('active'), log });
  check(freeLogSlot([withLog(1), withLog(3)]) === 2 && freeLogSlot([withLog(1), withLog(2), withLog(3)]) === 0 && freeLogSlot([{ ...withLog(1), state: 'success' } as IscQuest]) === 1 && LOG_SLOTS === 3, 'log slots 1..3, freed when done');
  const lq = { ...q0('active'), goal: { type: 'relation', target: 4, months: 24, diff: 2, base: 10, goal: 60 }, due: '2242.01.01' } as IscQuest;
  check(logBeginCommand('123456', 2, lq, '2240.01.01') === 'effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = 123456 } } sllm_iscq_begin = { SLOT = 2 CHAIN = relation GIVER = 2 TARGET = 4 GOAL = 60 NOW = 10 LEFT = 24 } }', 'log begin command');
  check(logBeginCommand('1', 1, { ...lq, goal: { type: 'peace', target: 4, months: 12 } } as IscQuest, '2240.01.01').includes('GOAL = 0 NOW = 0'), 'peace shows no numbers');
  check(throws(() => logBeginCommand('1', 4, lq, '2240.01.01')) && throws(() => logBeginCommand('1', 1, { ...lq, goal: { type: 'gift', months: 0 } } as IscQuest, '2240.01.01')), 'log begin refuses slot 4 / gift');
  const lu = logUpdateCommand('1', [{ slot: 1, now: 125, left: 11 }], [{ slot: 2, chain: 'stock_alloys' }]);
  check(lu.includes('sllm_iscq_tick = { SLOT = 1 NOW = 125 LEFT = 11 }') && lu.includes('sllm_iscq_end = { SLOT = 2 CHAIN = stock_alloys }') && throws(() => logUpdateCommand('1', [], [{ slot: 1, chain: 'x y' }])), 'log tick/end command');
  const md = process.env.SLLM_MRD_MOD || path.join(__dirname, '..', 'tester-mod');
  const cf = path.join(md, 'common', 'event_chains', 'sllm_iscq_chains.txt'), ef = path.join(md, 'common', 'scripted_effects', 'sllm_iscq_log.txt'), kf = path.join(md, 'localisation', 'korean', 'sllm_iscq_l_korean.yml'), nf = path.join(md, 'localisation', 'english', 'sllm_iscq_l_english.yml');
  if (![cf, ef, kf, nf].every((f) => fs.existsSync(f))) { check(false, 'situation log mod files present'); return; }
  const chainsTxt = fs.readFileSync(cf, 'utf8'), eff = fs.readFileSync(ef, 'utf8'), ko = fs.readFileSync(kf, 'utf8'), en = fs.readFileSync(nf, 'utf8');
  const names = ['peace', 'war', 'relation', 'naval', ...INCOME_RES.map((r) => 'income_' + r), ...STOCK_RES.map((r) => 'stock_' + r)].flatMap((c) => [1, 2, 3].map((n) => `sllm_iscq_${c}_${n}`));
  const missing = names.filter((k) => !new RegExp('^' + k + ' = \\{', 'm').test(chainsTxt) || !ko.includes(` ${k}_title:0 "`) || !ko.includes(` ${k}_desc:0 "`) || !en.includes(` ${k}_title:0 "`) || !en.includes(` ${k}_desc:0 "`));
  check(names.length === 54 && missing.length === 0, 'every chain defined with KO/EN title+desc: ' + missing.slice(0, 3).join(','));
  check(ko.startsWith('\ufeffl_korean:') && en.startsWith('\ufeffl_english:') && !/[\u2212\u2013\u2014\u201c\u201d]/.test(ko + en), 'localisation BOM header, no glyphs the game garbles');
  check(['sllm_iscq_begin = {', 'sllm_iscq_tick = {', 'sllm_iscq_end = {', 'begin_event_chain = { event_chain = sllm_iscq_$CHAIN$_$SLOT$', 'end_event_chain = sllm_iscq_$CHAIN$_$SLOT$', 'save_global_event_target_as = sllm_iscq$SLOT$_giver', 'save_global_event_target_as = sllm_iscq$SLOT$_target'].every((x) => eff.includes(x)), 'scripted effects: begin/tick/end + name targets');
  check(ko.includes('[sllm_iscq1_giver.GetName]') && ko.includes('[Root.sllm_iscq2_left]') && en.includes('[sllm_iscq3_target.GetName]'), 'texts use the saved names and variables');
}
