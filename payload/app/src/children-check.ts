// 통치자의 아이(2026-10-27) 검사. selftest.ts 에서 runChildrenChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import {
  CHILDREN, CHILD_EVENTS, emptyBook, canHaveMore, childLimit, rollYear, markIntimate, chanceFor, monthTick, answerEvent, ageOf, stageOf, adultPlan,
  childAdultCommand, childHeirCommand, gameNameText, TAG_TRAIT, CLASS_TRAITS, type Child,
  RULER_CHILD_TRAIT, FAMILY_GRIEF_TRAIT, familyTraitCommand, familyOf, familyLine, canTalk, teenTalkMessages, teenSummaryMessages,
} from './children';
import { talkMessages } from './persona';
import { JOBS, WISHES, CIV, CIV_TPL, kindRoll, pickCiv, civText, fitsWish, jobOf, birthWish, shouldNotify, heirReturnLine, isBig } from './children-civ';

function runCivChecks(check: (ok: boolean, name: string) => void): void {
  // 민간인 경로(2026-10-28)
  check(JOBS.length >= 6 && JOBS.every((j) => j.ko && j.en && WISHES.includes(j.wish)) && WISHES.every((w) => JOBS.some((j) => j.wish === w)), 'civ: jobs cover every wish with KO/EN names');
  check(jobOf('healthcare')?.en === 'Medical Worker' && jobOf('artisan')?.ko === '직공' && jobOf('foundry' as never) === null, 'civ: official game job names (4.x specialist)');
  check([1, 4, 5, 12, 13, 40].map(CIV.capFor).join() === '1,1,2,2,3,3' && CIV.chanceFor(1) === 0.15 && CIV.chanceFor(3) === 0.3 && CIV.chanceFor(20) === 0.4, 'civ: yearly cap and chance by count');
  { let g = 0, nn = 0, bd = 0; let x = 0; const r = () => { x = (x + 0.0001) % 1; return x; }; for (let i = 0; i < 10000; i++) { const k = kindRoll(r, 0); if (k === 'good') g++; else if (k === 'normal') nn++; else bd++; } check(Math.abs(g - 7500) < 50 && Math.abs(nn - 2000) < 50 && Math.abs(bd - 500) < 50, 'civ: 75/20/5'); }
  { let g = 0; let x = 0; const r = () => { x = (x + 0.0001) % 1; return x; }; for (let i = 0; i < 10000; i++) if (kindRoll(r, 40) === 'good') g++; check(Math.abs(g - 8500) < 50, 'civ: talks shift up to +10%p to good'); }
  check(pickCiv([{ id: 'a', star: false, yearsQuiet: 9 }, { id: 'b', star: true, yearsQuiet: 5 }], () => 0) === 'b', 'civ: starred child quiet 5+ years goes first');
  { let a = 0; for (let i = 0; i < 1000; i++) if (pickCiv([{ id: 'a', star: true, yearsQuiet: 0 }, { id: 'b', star: false, yearsQuiet: 0 }], () => i / 1000) === 'a') a++; check(a > 700 && a < 800, 'civ: star weight x3'); }
  check(Object.values(CIV_TPL).every((t) => t.ko.length >= 3 && t.en.length >= 3), 'civ: 3+ templates per event kind');
  { const t = civText('award', jobOf('physicist')!, { name: 'Ann', planet: 'Earth' }, () => 0.1); check(!/\{\w+\}/.test(t.ko + t.en) && t.ko.includes('Ann') && t.en.includes('Ann'), 'civ: templates filled in both languages'); }
  check(fitsWish('arts', { job: 'entertainer' }) && !fitsWish('arts', { leader: 'official' }) && fitsWish('politics', { leader: 'official' }) && fitsWish('science', { leader: 'scientist' }) && fitsWish('science', { job: 'physicist' }), 'civ: wish fit');
  check(WISHES.includes(birthWish(() => 0.9, ['official'])) && birthWish(() => 0.1, ['commander']) === 'adventure', 'civ: birth wish follows a parent sometimes');
  check(shouldNotify('all', 'move') && !shouldNotify('big', 'promotion') && shouldNotify('big', 'marriage') && shouldNotify('big', 'setback') && !shouldNotify('off', 'award') && isBig('award'), 'civ: notify setting');
  { const h = heirReturnLine('Ann', 'f', jobOf('artisan')); check(h.ko.includes('공주 Ann께서') && h.en.startsWith('Princess Ann'), 'civ: heir return line'); }
}

export function runChildrenChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'children: ' + name); if (!ok) process.exitCode = 1; };
  const braces = (s: string) => (s.match(/\{/g) ?? []).length === (s.match(/\}/g) ?? []).length;
  let n = 0; const id = () => 'c' + (++n);
  // 판정·상한
  const b = emptyBook('1'); const R = { pid: 'p:1', name: 'Ruler' }, A = { pid: 'p:2', name: 'A' }, B = { pid: 'p:3', name: 'B' };
  check(chanceFor(b, A.pid, 2230) === 0.03, 'base chance 3%');
  check(markIntimate(b, A.pid, 2230) && !markIntimate(b, A.pid, 2230) && chanceFor(b, A.pid, 2230) === 0.3, 'depicted intimacy → 30% that year, once');
  const made = rollYear(b, 2230, '2231.01.01', R, [A, B], () => 0.2, id);
  check(made.length === 1 && made[0].parent === A.pid && made[0].due === '2231.10.01' && b.rolled === 2231 && !(A.pid in b.intimate), 'roll: only the 30% spouse at 0.2, due in 9 months, mark cleared');
  rollYear(b, 2231, '2232.01.01', R, [A, B], () => 0, id);
  check(b.children.filter((c) => c.parent === A.pid).length === 2 && !canHaveMore(b, R.pid, A.pid), '2 per spouse');
  for (let i = 0; i < 6; i++) rollYear(b, 2232 + i, '2233.01.01', R, [B, { pid: 'p:' + (10 + i), name: 'S' + i }, { pid: 'p:' + (20 + i), name: 'T' + i }], () => 0, id);
  check(b.children.filter((c) => c.ruler === R.pid).length === CHILDREN.total && !canHaveMore(b, R.pid, 'p:99'), 'total cap 8 per ruler');
  check(canHaveMore(b, 'p:50', 'p:99'), 'another ruler has their own cap');
  childLimit.off = true; check(canHaveMore(b, R.pid, A.pid) && canHaveMore(b, R.pid, 'p:99'), 'limit off: no caps'); childLimit.off = false; check(!canHaveMore(b, R.pid, A.pid), 'limit back on');
  // 성장·사건
  const c: Child = { id: 'kid1', name: 'Kid', gender: 'f', ruler: R.pid, rulerName: 'Ruler', parent: A.pid, parentName: 'A', conceived: '2200.01.01', due: '2200.10.01', score: { official: 0, scientist: 0, commander: 0 }, tags: [], done: [], pending: null, log: [] };
  const bk = emptyBook('1'); bk.children.push(c); const alive = () => true;
  check(monthTick(bk, '2200.09.01', alive).length === 0 && stageOf(c, '2200.09.01') === 'expecting', 'not born before due');
  const t1 = monthTick(bk, '2200.10.01', alive); check(t1[0]?.kind === 'born' && c.born === '2200.10.01', 'born on due date');
  const t2 = monthTick(bk, '2201.10.01', alive); check(t2.some((t) => t.kind === 'event' && t.event?.id === 'steps') && ageOf(c, '2201.10.01') === 1, 'first event at 1');
  check(answerEvent(c, 0, '2201.11.01').ok && c.score.scientist === 2 && c.tags[0] === 'curious' && !c.pending, 'answer adds score and tag');
  monthTick(bk, '2204.10.01', alive); check(c.pending?.id === 'quarrel', 'event at 4');
  const t3 = monthTick(bk, '2205.10.01', alive); check(t3.some((t) => t.kind === 'missed') && c.done.includes('quarrel'), 'unanswered for a year → missed');
  monthTick(bk, '2206.10.01', () => false); check(c.pending?.id === 'loss' && c.lossFor?.length === 2, 'parent loss event first');
  answerEvent(c, 2, '2206.11.01', 'A'); monthTick(bk, '2206.12.01', () => false); check(c.pending?.id === 'loss', 'second loss queued');
  answerEvent(c, 1, '2207.01.01', 'Ruler');
  check(stageOf(c, '2214.10.01') === 'teen', 'teen at 14');
  const ta = monthTick(bk, '2218.10.01', () => false); check(ta.some((t) => t.kind === 'cross') && !!c.cross && !c.adult && !c.pending, 'at 18: crossroad waits for the player (2026-10-28)');
  check(monthTick(bk, '2218.11.01', () => false).length === 0, 'crossroad: nothing more until decided');
  runCivChecks(check);
  check(CHILD_EVENTS.length === 6 && CHILD_EVENTS.map((e) => e.age).join() === '1,4,7,10,13,16', '6 events: baby 1, child 3, teen 2');
  { const kid: Child = { ...c, born: '2200.01.01', adult: undefined }; check(!canTalk(kid, '2201.06.01') && canTalk(kid, '2203.01.01') && canTalk(kid, '2214.01.01') && !canTalk({ ...kid, adult: { state: 'applied', on: '2218.01.01' } }, '2218.06.01'), 'talks: infants cannot, children and teens can');
    const cm = teenTalkMessages(kid, 6, [], 'hi', '2206.01.01', 'ko')[0].content, tm = teenTalkMessages(kid, 14, [], 'hi', '2214.01.01', 'ko')[0].content;
    check(cm.includes('ONE short sentence') && cm.includes('6-year-old') && !tm.includes('ONE short sentence') && tm.includes('one to three sentences'), 'child talk prompt is short and childlike'); }
  check(adultPlan({ ...c, study: 'scientist', score: { official: 9, scientist: 0, commander: 0 } }).cls === 'scientist' && adultPlan({ ...c, study: undefined, score: { official: 9, scientist: 0, commander: 0 } }).cls === 'official', 'chosen study decides the career, otherwise upbringing score');
  { const sm = teenSummaryMessages(c, [{ who: 'me', text: 'a' }], 'ko')[0].content; check(!sm.includes('lean') && sm.includes('{"memory":"...","wish":"..."}'), 'talk summary: memory + wish tag only, no career leaning'); }
  // 성인식 명령
  const plan = adultPlan(c); check(['official', 'scientist', 'commander'].includes(plan.cls) && plan.traits.length === 3 && plan.traits[2] === RULER_CHILD_TRAIT && CLASS_TRAITS[plan.cls].includes(plan.traits[1]) && Object.values(TAG_TRAIT).includes(plan.traits[0]), 'plan: class + tag trait + class trait');
  const cmd = childAdultCommand(9, '123', { ...c, name: 'Kid "X" [Vance]' }, [2, 1], plan);
  check(braces(cmd) && cmd.includes('create_leader = { class = ' + plan.cls) && cmd.includes('species = event_target:sllm_ch_species') && cmd.includes('species = owner_main_species') && cmd.includes('name = "Kid X Vance"') && cmd.includes('set_age = 18') && cmd.includes('randomize_traits = no'), 'adult command: parent species, fallback, clean name, age 18');
  check(cmd.indexOf('check_variable = { which = sllm_lid value = 2 } gender = female }') > 0 && cmd.indexOf('check_variable = { which = sllm_lid value = 1 } gender = female }') > cmd.indexOf('check_variable = { which = sllm_lid value = 2 } gender = female }') && cmd.indexOf('check_variable = { which = sllm_lid value = 2 } }') > cmd.indexOf('check_variable = { which = sllm_lid value = 1 } gender = female }'), 'species: mother first, then the other parent, then the main species');
  { let f = 0; for (let i = 0; i < 2000; i++) if (adultPlan({ ...c, id: 'k' + i }).side === 'female') f++; check(f > 1100 && f < 1300, 'species side: about 60% mother (' + f + '/2000)'); }
  check(childAdultCommand(9, '123', c, [2, 1], { ...plan, side: 'male' }).includes('value = 2 } gender = male }'), 'species side male → father first');
  check(cmd.includes('check_variable = { which = sllm_lid value = 2 }') && cmd.includes('set_variable = { which = sllm_lid value = root.sllm_lid_next }') && cmd.includes('SLLM:CHILDADULT/;/req=9') && cmd.includes('lid=\\[This.sllm_lid]') && cmd.includes('is_variable_set = sllm_ch_kid1'), 'adult command: lid given, reply, once per child');
  const heir = childHeirCommand(4, '123', 77); check(braces(heir) && heir.includes('set_heir = prev') && heir.includes('SLLM:CHILDHEIR/;/req=4'), 'heir command');
  check(gameNameText('a"b\\c[d]{e}$f§g') === 'abcdefg', 'name cleaned for game text');
  let threw = false; try { childAdultCommand(1, 'x', c, [1], plan); } catch { threw = true; } check(threw, 'bad sid rejected');
  // 배우자 대화: intimate 칸은 배우자일 때만
  const p = { key: 'p:2', name: 'A', role: 'official' }, m = { trust: 0, mems: [], talks: 0 }, tk = { key: 'p:2', lines: [], moved: 0, opened: '' };
  const sp = talkMessages(p, m, tk, 'hi', 'E', '2200.01.01', { spouse: true })[0].content, np = talkMessages(p, m, tk, 'hi', 'E', '2200.01.01')[0].content;
  check(sp.includes('"intimate":false') && !np.includes('intimate'), 'intimate field only in spouse talks');
  check(!/fade to black|keep it tasteful|do not describe/i.test(sp), 'no content-level instruction in spouse prompt');
  // 가족(2026-10-27): 가족관계·특성·슬픔
  check(cmd.includes('0 = sllm_trait_ruler_child'), 'adult command adds the ruler-child trait');
  const fb = emptyBook('1'); const mk = (id: string, parent: string, born: string, lid?: number): Child => ({ ...c, id, name: id, parent, parentName: parent, born, due: born, pending: null, done: [], adult: lid ? { state: 'applied', on: born, lid } : undefined, dead: undefined });
  fb.children.push(mk('Ann', 'p:2', '2200.01.01', 50), mk('Bo', 'p:2', '2210.01.01'), mk('Cy', 'p:3', '2212.01.01'));
  const fa = familyOf(fb, 'p:50', '2220.01.01', (pid) => pid !== 'p:2');
  check(!!fa && fa.parents.length === 2 && fa.parents[1].gone === true && fa.siblings.length === 2 && fa.siblings.find((x) => x.name === 'Cy')?.half === true && fa.siblings.find((x) => x.name === 'Bo')?.half === false, 'family: parents (with deceased), full and half siblings');
  const fr = familyOf(fb, 'p:1', '2220.01.01', () => true), f2 = familyOf(fb, 'p:2', '2220.01.01', () => true);
  check(fr?.children.length === 3 && f2?.children.length === 2 && familyOf(fb, 'p:9', '2220.01.01', () => true) === null, 'family: ruler sees all children, spouse sees theirs, stranger none');
  const fl = familyLine(fa); check(fl.startsWith('[Your family]') && fl.includes('(deceased)') && fl.includes('[half-sibling]') && familyLine(null) === '', 'family prompt line');
  const ft = familyTraitCommand(3, '123', 50, [FAMILY_GRIEF_TRAIT.official], [], 'x_on'); check(braces(ft) && ft.includes('add_trait = sllm_trait_family_grief_official') && ft.includes('SLLM:CHILDTRAIT/;/req=3') && ft.includes('sllm_cht_x_on'), 'grief trait command');
  // 연결
  const root = path.join(__dirname, '..');
  const rd = (f: string) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };
  const mt = rd('tester-mod/common/traits/sllm_family_traits.txt'), le = rd('tester-mod/localisation/english/sllm_family_l_english.yml'), lk = rd('tester-mod/localisation/korean/sllm_family_l_korean.yml');
  check([RULER_CHILD_TRAIT, ...Object.values(FAMILY_GRIEF_TRAIT)].every((t) => mt.includes(t + ' = {') && le.includes(' ' + t + ':0 "') && lk.includes(' ' + t + ':0 "')) && mt.includes('species_leader_exp_gain = 0.15') && braces(mt), 'mod: family traits (+15% xp, grief) with KO/EN text');
  const main = rd('src/main.ts'), pre = rd('src/preload.ts'), pa = rd('src/features/persona-app.ts'), pr = rd('ui/private-rooms.js'), oh = rd('ui/office.html'), nu = rd('ui/nursery.js');
  check(main.includes('registerChildren(router)') && ['childList', 'childAnswer', 'childRename', 'childHeir', 'childTalkOpen', 'childTalkSay', 'childTalkEnd'].every((k) => pre.includes(k + ':')), 'app: registration and preload');
  check(pa.includes("from '../app/children-hooks'") && pa.includes('noteIntimate(sid, k)') && pa.includes('family: familyPromptLine(sid, k)') && rd('ui/office-relations.js').includes('window.sllm.familyInfo(p.key)') && pre.includes('familyInfo:') && !pa.includes('children-app'), 'persona → children via hooks (no import cycle)');
  check(pr.includes("nursery:()=>L('아기방','Nursery')") && pr.includes("SLLMNursery?.babyObject(stage,{modal,go:()=>go('nursery')})") && pr.includes("v==='nursery'") && oh.includes('nursery.js') && oh.includes('nursery.css') && nu.includes('window.SLLMNursery={draw,babyObject') && nu.includes("L('누구를 보러 가시겠습니까?','Who would you like to see?')") && nu.includes("base+'nursery.webp'") && nu.includes('sil-${st}-${g}-${n}.webp'), 'ui: nursery room, baby object → child list first, one nursery picture, office go');
}
