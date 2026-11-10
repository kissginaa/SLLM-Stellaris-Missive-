// 국경·전선 자체 검사(2026-10-26). selftest.ts 에서 runFrontierChecks() 로 부른다.
import { frontNewsLine, frontierFactsUs, frontierBrief, type Frontier, frontierCommands, frontierCommand, parseFrontier, frontierLines, frontierTag, FRONT } from './frontier';
import { systemPrompt, type TalkContext } from './prompt';
import { iscMessages, type IscMeeting } from './interstellar-council';
import { declMessages } from './declare';
import { reactionMessages } from './condemn';

const EMPTY: Omit<Frontier, 'idx' | 'neighbor'> = { us: [], them: [], lost: [], taken: [], xclaim: [], pclaim: [], foewar: [], foerival: [], khX: 0, khP: 0, kin: [], trust: -1, intel: -1, cbX: false, cbP: false, sub: 0, envX: 0, envP: 0, gcX: -1, gcP: -1 };
export function runFrontierChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'frontier: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  const c = frontierCommand(9, '123456', 4);
  check(c.startsWith('effect every_playable_country') && c.includes('sllm_save_id value = 123456') && c.includes('check_variable = { which = sllm_idx value = 4 }'), 'command scoped to save and empire');
  check(['is_neighbor_of = prev', 'every_system_within_border', 'any_neighbor_system', 'space_owner = { is_same_value = event_target:sllm_fr_x }', 'controller = { is_same_value = event_target:sllm_fr_p }'].every((x) => c.includes(x)), 'uses the vanilla triggers checked in the game folder');
  check(['side=us', 'side=them', 'side=lost', 'side=taken'].every((x) => c.includes(x)) && c.includes('SLLM:FR_END/;/req=9') && c.includes('name=\\[This.GetName]'), 'reply lines');
  check(throws(() => frontierCommand(0, '1', 2)) && throws(() => frontierCommand(1, 'x', 2)) && throws(() => frontierCommand(1, '1', 0)), 'refuses bad args');
  const rows = [{ side: 'us', name: 'Sol' }, { side: 'us', name: 'Sol' }, { side: 'them', name: 'Vega' }, { side: 'taken', name: 'Deneb' }, { side: 'lost', name: 'Altair' }, { side: 'bogus', name: 'X' }, { side: 'us', name: '' }];
  const f = parseFrontier(4, { found: '1', nb: '0' }, rows)!;
  check(f.neighbor && f.us.join() === 'Sol' && f.them.join() === 'Vega' && f.taken.join() === 'Deneb' && f.lost.join() === 'Altair', 'parse: dedupe, drop junk, touching systems imply neighbour');
  check(parseFrontier(4, { found: '0', nb: '1' }, rows) === null && !parseFrontier(4, { found: '1', nb: '0' }, [])!.neighbor, 'missing empire → null; no rows → not neighbour');
  // AI(상대) 시점: them = 그들 성계, us = 플레이어 성계, taken = 플레이어가 점령한 그들 성계
  const l = frontierLines(f, { atWar: true }).join('\n');
  check(l.includes('shares a border') && l.includes('Your border systems facing them: Vega') && l.includes('Their border systems facing you: Sol') && l.includes('They currently occupy these systems of yours: Deneb') && l.includes('You currently occupy these systems of theirs: Altair'), 'lines from the AI empire\'s point of view');
  const far = frontierLines({ ...EMPTY, idx: 4, neighbor: false }).join('\n');
  check(far.includes('does not share a border') && !/[가-힣]/.test(l + far) && frontierLines(null).length === 0, 'non-neighbour line, English only, nothing when unknown');
  const many = frontierLines({ ...EMPTY, idx: 4, neighbor: true, them: Array.from({ length: 8 }, (_, i) => 'S' + i) }).join('\n');
  check(many.includes('(+3 more)') && FRONT.maxNames === 5, 'long lists trimmed');
  check(frontierTag(f) === ' (borders the host)' && frontierTag(undefined) === '', 'quest target tag');
  const t = { idx: 4, name: 'Vosh', player: 'Us', opinionA: 0, opinionB: 0, score: 0, frontier: frontierLines(f) } as TalkContext;
  check(systemPrompt(t).includes('[Geography] Your empire shares a border'), 'diplomacy prompt carries the lines');
  const m = { id: 'm', hostIdx: 1, topic: 't', turns: [] } as unknown as IscMeeting;
  const sys = iscMessages(m, { idx: 4, empire: 'Vosh', ruler: 'Ila', title: '', atWar: false, score: 0, frontier: frontierLines(f) }, 'named', { hostEmpire: 'Us', hostRuler: 'Me', date: '2240.01.01' }, 'hi', [])[0].content;
  check(sys.includes('Between you and the host empire: [Geography]'), 'summit prompt carries the lines');

  // 외교 사정(2026-10-26 「전부다」)
  check(['has_claim = prev', 'has_casus_belli = { target = event_target:sllm_fr_p }', 'has_casus_belli = { target = event_target:sllm_fr_x }', 'trust = { who = event_target:sllm_fr_p value >= 60 }', 'intel = { who = event_target:sllm_fr_p value >= 90 }', 'is_rival = prev', 'is_at_war_with = event_target:sllm_fr_x is_at_war_with = event_target:sllm_fr_p', 'has_overlord = event_target:sllm_fr_x', 'is_improving_relations_with = event_target:sllm_fr_p', 'is_harming_relations_with = event_target:sllm_fr_x', 'is_part_of_galactic_council = yes', 'is_galactic_custodian = yes', 'is_galactic_emperor = yes'].every((x) => c.includes(x)), 'reads claims, casus belli, trust, intel, common foes, subjects, envoys, galactic status (names checked in vanilla / 4.5.1 dump)');
  check(['side=xclaim', 'side=pclaim', 'side=foewar', 'side=foerival', '/;/tr=', '/;/in=', '/;/cbx=', '/;/cbp=', '/;/sub=', '/;/ex=', '/;/ep=', '/;/gx=', '/;/gp='].every((x) => c.includes(x)) && (c.match(/\{/g) ?? []).length === (c.match(/\}/g) ?? []).length, 'reply fields, braces balanced');
  const g = parseFrontier(4, { found: '1', nb: '1', tr: '3', in: '0', cbx: '1', cbp: '0', sub: '1', ex: '2', ep: '1', gx: '4', gp: '1' }, [{ side: 'xclaim', name: 'Sol' }, { side: 'pclaim', name: 'Vega' }, { side: 'foewar', name: 'Kel' }, { side: 'foerival', name: 'Zor' }])!;
  check(g.trust === 3 && g.intel === 0 && g.cbX && !g.cbP && g.sub === 1 && g.envX === 2 && g.envP === 1 && g.gcX === 4 && g.gcP === 1 && g.xclaim[0] === 'Sol' && g.foerival[0] === 'Zor', 'parse diplomatic fields');
  const gl = frontierLines(g).join('\n');
  check(gl.includes('You have laid claim to these systems of theirs: Sol') && gl.includes('They have laid claim to these systems of yours: Vega') && gl.includes('You hold a valid casus belli against them') && !gl.includes('They hold a valid casus belli'), 'claims and casus belli from the AI\'s side');
  check(gl.includes('both at war with: Kel') && gl.includes('both regard as a rival: Zor') && gl.includes('Your trust in them: high') && gl.includes('do not cite their economy') && gl.includes('You are their overlord') && gl.includes('envoy working to harm relations with them') && gl.includes('They have sent an envoy to improve') && gl.includes('You are the Galactic Custodian; they are a member of the Galactic Community'), 'common foes, trust, low intel warning, subjects, envoys, galactic status');
  const unk = parseFrontier(4, { found: '1', nb: '0', tr: 'x', gx: '99' }, [])!;
  check(unk.trust === -1 && unk.gcX === -1 && !frontierLines(unk).some((l) => l.startsWith('[Trust]') || l.startsWith('[Galactic')), 'unknown values stay silent');
  check(frontierTag(g) === ' (borders the host) (claims disputed)', 'quest tag shows disputed claims');
  { const [k, a, b] = frontierCommands(9, '123456', 99999); check(k.length <= 4100 && a.length <= 4100 && b.length <= 4100 && b.includes('SLLM:FR_END') && !a.includes('SLLM:FR_END') && !k.includes('SLLM:FR_END'), 'three console lines, each within the length already proven in game (policy measure ≈ 4,100)'); }
  // 그레이트 칸 후계국(2026-10-26)
  check(['has_origin = origin_khan_successor', 'has_country_flag = diadochi', 'has_country_flag = new_khanate_flag', 'has_country_flag = democratic_khanate_flag', 'side=kin', '/;/kx=', '/;/kp='].every((x) => c.includes(x)), 'khan successor: origin + vanilla flags, other successors, reply fields');
  const kh = parseFrontier(4, { found: '1', nb: '1', kx: '1', kp: '0' }, [{ side: 'kin', name: 'Ordu Var' }, { side: 'kin', name: 'Ordu Tem' }])!;
  const kl = frontierLines(kh).join('\n');
  check(kh.khX === 1 && kh.khP === 0 && kh.kin.length === 2 && kl.includes('[Khan\'s legacy] Your empire is one of the Diadochi') && kl.includes('Other successor states of the Great Khan: Ordu Var, Ordu Tem') && kl.includes('do not invent it'), 'diadochi line with sibling successors, cause of death not invented');
  const kl2 = frontierLines(parseFrontier(4, { found: '1', nb: '0', kx: '0', kp: '2' }, [])!).join('\n');
  check(kl2.includes('They are the New Khanate') && !kl2.includes('Your empire is'), 'player as successor described from the AI side');
  check(!frontierLines(parseFrontier(4, { found: '1', nb: '0', kx: '0', kp: '0' }, [{ side: 'kin', name: 'X' }])!).some((l) => l.includes('Khan')), 'no khan line for ordinary empires');
  // 다른 기능에서 쓰는 우리 시점 사실(2026-10-26)
  const pub = frontierFactsUs(g), sec = frontierFactsUs(g, { secret: true });
  check(pub.some((l) => l.startsWith('Our empires share a border')) && pub.includes('They claim these systems of ours: Sol.') && pub.includes('We claim these systems of theirs: Vega.') && pub.includes('They are our overlord.') && pub.includes('They are the Galactic Custodian.'), 'our-side facts (public)');
  check(!pub.some((l) => l.includes('casus belli against us') || l.startsWith('Their trust') || l.startsWith('How much they know')) && sec.includes('They hold a valid casus belli against us.') && sec.some((l) => l.startsWith('Their trust in us: high')) && sec.some((l) => l.startsWith('How much they know about us: almost nothing')), 'secret facts only for the spy service');
  check(frontierFactsUs(null).length === 0 && frontierBrief(g).includes('borders the player') && frontierBrief(g).includes('disputed claims') && frontierBrief(g).includes('overlord') && frontierBrief(null) === '', 'brief for condemnation speakers');
  const dm = declMessages('Us', 'War', 'Them', 'att', [], false, '2240.01.01', 'claims', pub)[1].content;
  check(dm.includes('Borders, claims and front with the enemy') && dm.includes('Vega') && !declMessages('Us', 'War', 'Them', 'att', [], false, '', '')[1].content.includes('Borders, claims'), 'war declaration gets the front');
  const rm = reactionMessages('Us', { war: 'W', attacker: 'Us', defender: 'Them', side: 'att' } as any, [{ name: 'Kel', stance: 'condemn', ethics: [], geo: frontierBrief(g) }], null, '')[1].content;
  check(rm.includes('Kel') && rm.includes('relation to the player: borders the player'), 'condemnation speaker line gets the relation');
  // 신문·라디오 전선 줄(2026-10-26)
  const nl = frontNewsLine('Kel', g), nl2 = frontNewsLine('Kel', { ...EMPTY, idx: 4, neighbor: false });
  check(frontNewsLine('Kel', { ...EMPTY, idx: 4, neighbor: true, lost: ['Sol'], taken: ['Vega'] }) === 'War front with Kel (a neighbouring empire): Kel holds these systems of ours: Sol; we hold these systems of theirs: Vega.' && nl2.includes('no systems have changed hands yet') && nl2.includes('not a neighbour') && frontNewsLine('Kel', null) === '' && nl.startsWith('War front with Kel'), 'news front line');
}
