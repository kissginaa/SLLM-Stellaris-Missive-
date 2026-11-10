// 은하 변호사·재판 판정 검사(2026-10-27). selftest.ts 에서 runSpyLawyerChecks() 로 부른다.
import { newSpy, spyFixture, spyChoose, scriptedEvidence, spyHireLawyer, spyCanHireLawyer, spyLawyerCommand, SPY_LAWYERS, spyLawyerFee, _lawyerLines, josa, parseSpyVerdict, advanceSpy, spyMessages } from './espionage';

export function runSpyLawyerChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'spy-lawyer: ' + name); if (!ok) process.exitCode = 1; };
  const start = () => spyChoose(newSpy(spyFixture(), 'scripted'), 'face', scriptedEvidence());
  check(SPY_LAWYERS.intl.chance === 0.2 && SPY_LAWYERS.office.chance === 0.75 && SPY_LAWYERS.firm.chance === 0.95 && SPY_LAWYERS.intl.energy === 0 && SPY_LAWYERS.office.energy === 500 && SPY_LAWYERS.office.influence === 50 && SPY_LAWYERS.firm.energy === 1000 && SPY_LAWYERS.firm.influence === 100, 'tiers: free 20% · 500/50 75% · 1000/100 95%');
  check(spyLawyerFee('office').energy === 750 && spyLawyerFee('office').influence === 50 && spyLawyerFee('firm').energy === 1500 && spyLawyerFee('firm', 1).energy === 1000 && spyLawyerFee('firm').influence === 100 && spyLawyerFee('intl').energy === 0, 'fee: first exhibit base, +25% energy for each more (3 → 150%), influence flat');
  const s0 = start(); check(spyCanHireLawyer(s0), 'can hire at the start of the hearing');
  const seq = [0.1, 0.8, 0.3]; let i = 0;
  const s1 = spyHireLawyer(s0, 'office', () => seq[i++]);
  check(s1.phase === 'finished' && s1.lawyer === 'office' && s1.failures === 1 && s1.evidence.map((e) => e.rebutted).join() === 'true,false,true' && s1.evidence.every((e) => e.closed), 'each exhibit rolled at the chance (0.1/0.8/0.3 at 75% → win, lose, win)');
  const judge = s1.log.filter((l) => l.who === '은하재판소').map((l) => l.text);
  check(judge.length === 4 && judge[1].startsWith('승리: 플레이어 제국') && judge[1].includes('은하사무소변호사가 변호를 진행한 결과 증거 「') && judge[1].includes('승소하였습니다') && judge[2].startsWith('승리: ') && !judge[2].startsWith('승리: 플레이어') && judge[2].includes('패소하였습니다'), 'tribunal: winner line + lawyer result (승소/패소)');
  check(_lawyerLines.win.every((t) => t[0].includes('{who}이(가) 변호를 진행한 결과 증거 「{ev}」에 대해 승소하였습니다') && t[1].includes('won on the exhibit')) && _lawyerLines.lose.every((t) => t[0].includes('{who}이(가) 변호를 진행한 결과 증거 「{ev}」에 대해 패소하였습니다') && t[1].includes('lost on the exhibit')) && _lawyerLines.win.length === _lawyerLines.lose.length && _lawyerLines.argue.length >= 5, 'lawyer lines: varied, every result line says 승소/패소 (KO/EN)');
  check(josa('변호사이(가) 「흔적」은(는) 「장비」을(를) 연맹와(과)') === '변호사가 「흔적」은 「장비」를 연맹과' && josa('X이(가)') === 'X이(가)', 'Korean particles follow the last syllable');
  const s2 = advanceSpy(s0, '해명', '응답'); check(!spyCanHireLawyer(s2), 'cannot hire after the first statement');
  let threw = false; try { spyHireLawyer(s2, 'firm'); } catch { threw = true; } check(threw, 'hiring late is rejected');
  const cmd = spyLawyerCommand(5, '123', 'abc', 'firm'); check(cmd.includes('energy = -1500 influence = -100') && cmd.includes('resource = energy value < 1500') && cmd.includes('resource = influence value < 100') && cmd.includes('SLLM:SPYLAWYER/;/req=5') && (cmd.match(/\{/g) ?? []).length === (cmd.match(/\}/g) ?? []).length, 'fee command (both resources, short check, once)');
  threw = false; try { spyLawyerCommand(5, '123', 'abc', 'intl'); } catch { threw = true; } check(threw, 'free lawyer sends no fee command');
  // 판정 형식(2026-10-27 피드백: 판결문과 승자가 반대로 찍힘)
  const v = (o: object) => parseSpyVerdict(JSON.stringify({ reason: 'r', domestic: 'd', foreign: 'f', ...o })).rebutted;
  check(v({ winner: 'accuser' }) === false && v({ winner: 'player' }) === true && v({ rebutted: true }) === true && v({ winner: 'accuser', rebutted: true }) === false, 'verdict: named winner wins over the old flag');
  const court = spyMessages(s0, 'court', 'x', 'y')[0].content; check(court.includes('"winner":"player"|"accuser"') && court.indexOf('"reason"') < court.indexOf('"winner"') && court.includes('winner MUST be "accuser"'), 'court prompt: reason first, named winner, consistency rule');
}
