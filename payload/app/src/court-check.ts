// 정치(음모·가문·정략결혼, 2026-10-28) 검사. selftest.ts 에서 runCourtChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import {
  PLOT, plotYearChance, plotCandidates, pickPlot, newPlot, plotStep, canAct, applyCheck, backlash, startInfluence, plotEthic, actCost,
  courtPayCommand, courtLeaderCommand, courtSendCommand, courtModCommand, courtPlanetCommand, marryBondCommand, courtLoseCommand,
  HOUSE, HOUSE_TRAITS, inheritTraits, houseTraitsNew, sameHouse, houseNameText, houseLine, MARRY, canMarry, marryBonus, marryErrors,
  PLOT_KINDS, PLOT_NAME, type Plot, type PlotWorld,
} from './court';

export function runCourtChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'court: ' + name); if (!ok) process.exitCode = 1; };
  const braces = (s: string) => (s.match(/\{/g) ?? []).length === (s.match(/\}/g) ?? []).length;
  // 확률
  check(plotYearChance({ lowStability: false, protest: false, warLosing: false }) === 0.08, 'year chance 8%');
  check(Math.abs(plotYearChance({ lowStability: true, protest: true, warLosing: true }) - 0.25) < 1e-9, 'year chance capped at 25%');
  check(Math.abs(plotYearChance({ lowStability: true, protest: false, warLosing: false }) - 0.13) < 1e-9, 'unrest +5');
  // 후보
  const w: PlotWorld = {
    persons: [
      { pid: 'p:1', name: 'Ruler', cls: 'official', lv: 5, council: true, asg: false, ruler: true },
      { pid: 'p:2', name: 'Gov', cls: 'official', lv: 2, council: false, asg: true, ruler: false, eth: 'pacifist' },
      { pid: 'p:3', name: 'Adm', cls: 'commander', lv: 3, council: false, asg: true, ruler: false },
      { pid: 'p:4', name: 'Kid', cls: 'scientist', lv: 1, council: false, asg: false, ruler: false, rulerChild: true },
    ],
    planets: [{ k: 1, name: 'Home', stability: 70, governor: 'p:9' }, { k: 2, name: 'Rim', stability: 30, governor: 'p:2' }],
    foes: [{ idx: 7, name: 'Foe' }], hereditary: true, factions: [{ eth: 'militarist', support: 0.3, approval: 0.6 }, { eth: 'egalitarian', support: 0.2, approval: 0.3 }], busy: [],
  };
  const c = plotCandidates(w);
  check(!c.some((x) => x.p.pid === 'p:1'), 'ruler never plots');
  check(c.some((x) => x.kind === 'secede' && x.p.pid === 'p:2' && x.planetK === 2), 'governor of unstable planet: secession');
  check(c.some((x) => x.kind === 'power' && x.p.pid === 'p:3'), 'commander lv2+: power grab');
  check(c.some((x) => x.kind === 'defect' && x.tid === 7), 'foe → defection candidate');
  check(c.some((x) => x.kind === 'succession' && x.p.pid === 'p:4'), 'hereditary ruler child: succession');
  check(!plotCandidates({ ...w, busy: ['p:2', 'p:3', 'p:4'] }).length, 'busy plotters skipped');
  check(startInfluence(w.persons[1]) === 20 + 16 + 10 && startInfluence(w.persons[2], true) === 20 + 24 + 10 + 10, 'start influence');
  check(plotEthic(w.persons[1], w.factions) === 'pacifist' && plotEthic(w.persons[2], w.factions) === 'egalitarian', 'plot faction: own support, else lowest approval');
  const pick = pickPlot(c, () => 0)!; check(!!pick, 'pick');
  // 진행
  let pl: Plot = newPlot('x', pick, '2300.01.01', w); pl.inf = 0;
  let r = plotStep(pl, () => 0.99); check(r.pl.prog === 3 && !r.found, 'step min 3 at influence 0');
  pl.inf = 100; r = plotStep({ ...pl, prog: 0 }, () => 0.999); check(r.pl.prog === 6, 'step max 6 at influence 100');
  r = plotStep({ ...pl, prog: 27 }, () => 0.5); check(r.hint && r.pl.prog >= 30, 'hint at 30');
  r = plotStep({ ...pl, prog: 20 }, () => 0.02); check(r.found, 'discover 3%');
  r = plotStep({ ...pl, prog: 60 }, () => 0.05); check(r.found, 'discover 6% past 50');
  r = plotStep({ ...pl, prog: 30 }, () => 0.05); check(!r.found, 'not 6% below 50');
  r = plotStep({ ...pl, prog: 98 }, () => 0.9); check(r.won && r.pl.prog === 100, 'won at 100');
  check(plotStep({ ...pl, found: 'x' }, () => 0).pl.prog === pl.prog, 'found plots freeze');
  // 대응
  const hinted = { ...pl, hinted: 'd', prog: 50, inf: 60 };
  check(canAct(hinted, 'bribe') && canAct(hinted, 'expose') && !canAct(hinted, 'arrest'), 'checks before discovery only');
  check(canAct({ ...hinted, found: 'd' }, 'exile') && !canAct({ ...hinted, found: 'd' }, 'bribe'), 'responses after discovery');
  check(applyCheck(hinted, 'bribe').prog === 20 && applyCheck(hinted, 'expose').inf === 20 && applyCheck(hinted, 'expose').prog === 30, 'bribe -30, expose -40 inf -20 prog');
  check(actCost('bribe').energy === 300 && actCost('expose').influence === 50 && actCost('appease').energy === 500 && actCost('appease').influence === 50, 'costs');
  check(backlash('arrest').mood === -3 && backlash('arrest').protest === 0.3 && backlash('exile').mood === -5 && backlash('exile').protest === 0.5 && backlash('demote').mood === -1 && !backlash('appease').crack, 'backlash');
  check(PLOT.exile.defect === 0.4 && PLOT.appease.relapse === 0.3 && PLOT.appease.relapseYears === 5, 'exile defects 40%, appease relapse 30%/5y');
  check(PLOT_KINDS.every((k) => PLOT_NAME[k][0] && PLOT_NAME[k][1]), 'plot names KO/EN');
  // 명령
  const cmds = [courtPayCommand(5, 300, 0), courtLeaderCommand(5, 12, 'jail'), courtSendCommand(5, 12, 4), courtModCommand(5, 'sllm_plot_crack_pacifist', 360), courtPlanetCommand(5, 2, 'sllm_plot_secede', 720), marryBondCommand(5, 4, true), courtLoseCommand(5, 100)];
  check(cmds.every(braces) && cmds[0].includes('sllm_court_pay = { REQ = 5 EN = 300 INF = 0 }') && cmds[1].includes('sllm_court_jail = { REQ = 5 LID = 12 }') && cmds[5].includes('ADD = yes'), 'commands');
  let threw = 0; for (const f of [() => courtModCommand(5, 'evil' as never, 30), () => courtLeaderCommand(5, 0, 'jail'), () => courtSendCommand(0, 1, 1), () => courtPlanetCommand(5, 1, 'sllm_plot_secede', 5)]) { try { f(); } catch { threw++; } }
  check(threw === 4, 'commands reject bad input');
  // 가문
  check(HOUSE_TRAITS.length === 16 && new Set(HOUSE_TRAITS.map((t) => t.key)).size === 16 && HOUSE_TRAITS.every((t) => t.ko && t.en && t.dko && t.den && t.prompt), '16 house traits with KO/EN');
  check(houseTraitsNew(Math.random).length === HOUSE.traits, 'new house has 2 traits');
  { let kept = 0, fresh = 0; for (let i = 0; i < 4000; i++) { const t = inheritTraits(['martial', 'pious'], Math.random); kept += t.filter((k) => k === 'martial' || k === 'pious').length; fresh += t.some((k) => k !== 'martial' && k !== 'pious') ? 1 : 0; } check(Math.abs(kept / 8000 - 0.7) < 0.03 && Math.abs(fresh / 4000 - 0.2) < 0.03, 'inherit 70% each, new 20%'); }
  const house = { id: 'h', name: 'Varr', traits: ['martial'], since: 'd', rulers: [{ pid: 'p:1', name: 'A Varr', from: 'd' }] };
  check(sameHouse(house, { pid: 'p:5', last: 'Varr' }, () => null) && sameHouse(house, { pid: 'p:6', last: 'Other' }, (p) => (p === 'p:6' ? 'p:1' : null)) && !sameHouse(house, { pid: 'p:7', last: 'Other' }, () => null), 'same house by surname or nursery child');
  check(!sameHouse({ ...house, custom: true }, { pid: 'p:5', last: 'Varr' }, () => null), 'renamed house: surname alone does not continue it');
  check(houseNameText(' "Va{r}r" ') === 'Varr' && houseLine(house, ['martial'], 'ruler').includes('House Varr'), 'house name & prompt line');
  // 정략결혼
  check(MARRY.opinion === 40 && marryBonus(false) === 10 && marryBonus(true) === -10, 'marriage +40 opinion, +10 odds, rival -20');
  const kid = { id: 'k', name: 'K', gender: 'f' as const, leader: false, married: false, dead: false, adult: true };
  check(canMarry(kid) && !canMarry({ ...kid, married: true }) && !canMarry({ ...kid, adult: false }), 'who can marry');
  check(marryErrors(kid, true, false).includes('war') && marryErrors(kid, false, true).includes('already') && !marryErrors(kid, false, false).length, 'marriage errors');
  // 모드 파일
  const mod = path.join(__dirname, '..', 'tester-mod');
  const read = (f: string) => { try { return fs.readFileSync(path.join(mod, f), 'utf8'); } catch { return ''; } };
  const eff = read('common/scripted_effects/sllm_court.txt');
  if (eff) {
    check(braces(eff) && ['sllm_court_pay', 'sllm_court_lose', 'sllm_court_unassign', 'sllm_court_jail', 'sllm_court_free', 'sllm_court_exile', 'sllm_court_send', 'sllm_court_mod', 'sllm_court_planet', 'sllm_court_bond'].every((k) => eff.includes(k + ' = {')), 'mod effects present');
    check(!/log = "[^"]*\$[A-Z]+\$[^"]*"/.test(eff), 'no $PARAM$ inside log strings (F-39)');
    const sm = read('common/static_modifiers/sllm_court_modifiers.txt'), en = read('localisation/english/sllm_court_l_english.yml'), ko = read('localisation/korean/sllm_court_l_korean.yml');
    const keys = [...sm.matchAll(/^(sllm_[a-z_]+) = \{/gm)].map((m) => m[1]).concat(['sllm_marry_bond', 'sllm_trait_imprisoned']);
    check(keys.length >= 19 && keys.every((k) => en.includes(` ${k}:0 `) && ko.includes(` ${k}:0 `)), 'modifier/opinion/trait localised in EN and KO');
  }
}
