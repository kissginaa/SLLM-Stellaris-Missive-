// 외교 거래 자체 검사(2026-10-26). selftest.ts 에서 runDealChecks() 로 부른다.
import * as fs from 'fs';
import * as path from 'path';
import {
  DEAL, DEAL_MODS, type DealCtx, type DealItem, gameNum, parseDealCtx, sanitizeItems, giver, itemValue, dealBalance, validateDeal, parseResSide, dealOdds, rollDeal, worstPart,
  ctxCommand, applyCommand, payCommand, opinionCommand, joinCommand, allyWarCommand, itemText, dealPromptText, agreementFrom, monthStep, napBreach, pruneNap, hookFromSecrets, owedLine,
} from './deals';
import { addYears, cmpDate } from './gamedate';
import { systemPrompt, type TalkContext } from './prompt';

export function runDealChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'deals: ' + name); if (!ok) process.exitCode = 1; };
  const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  const L = (_k: string, e: string) => e;

  // 수치(사용자 확정 2026-10-26)
  check(DEAL.base === 50 && DEAL.minP === 5 && DEAL.maxP === 95 && DEAL.opinionDiv === 4 && DEAL.opinionCap === 25 && DEAL.hook === 30 && DEAL.ally === 25 && DEAL.nag === 10, 'odds numbers');
  check(DEAL.trustPts.join() === '-5,0,5,10,15' && DEAL.powerPts.join() === '-14,-7,0,7,14' && DEAL.balanceMin === -60 && DEAL.balanceMax === 30, 'trust / power / balance ranges');
  check(DEAL.value.energy === 1 && DEAL.value.minerals === 1 && DEAL.value.food === 1 && DEAL.value.consumer_goods === 2 && DEAL.value.alloys === 4, 'resource values = vanilla market ratio');
  check(DEAL.diplo.borders === 150 && DEAL.diplo.rivalry === 500 && DEAL.diplo.napYear === 100 && DEAL.diplo.joinWar === 2000, 'diplomatic values');
  check(DEAL.incomeShare === 0.2 && DEAL.maxMonths === 120 && DEAL.missLimit === 2, 'tribute: 20% of income, 10 years, two misses');
  check(DEAL.brokenOpinion === -50 && DEAL.ctaOpinion === -30, 'penalties -50 / -30');

  // 읽기
  check(gameNum('1234.5') === 1234.5 && gameNum('12.3K') === 12300 && gameNum('-4') === -4 && gameNum('x') === 0 && gameNum(undefined) === 0, 'game number parse (K suffix)');
  const x = { s: '500,300,200,100,50', i: '40,30,20,10,5' };
  const kv = { ok: '1', s: '1000,800,600,400,200', i: '100,80,60,20,10', tr: '3', pow: '1', rv: '1', al: '0', wr: '1', ow: '1', eu: '2', et: '6' };
  const c = parseDealCtx(kv, x)!;
  check(!!c && c.us.stock.energy === 1000 && c.them.income.alloys === 10 && c.trust === 3 && c.pow === 1 && c.rival && !c.ally && c.war && c.exhThem === 6, 'ctx parse');
  check(parseDealCtx({ ...kv, ok: '0' }, x) === null && parseDealCtx(kv, undefined) === null, 'ctx parse refuses missing empire');

  // 항목
  const its = sanitizeItems([{ k: 'res', res: 'alloys', amt: 50, from: 'us' }, { k: 'monthly', res: 'energy', amt: 8, months: 24, from: 'them' }, { k: 'peace' }, { k: 'res', res: 'gold', amt: 5, from: 'us' }, { k: 'nap', years: 99, from: 'us' }, { k: 'hack' }, 'x']);
  check(its.length === 3 && its[0].k === 'res' && its[1].k === 'monthly' && its[2].k === 'peace', 'sanitize drops unknown resources, bad years and junk');
  check(giver({ k: 'borders' }) === 'them' && giver({ k: 'peace' }) === 'both' && giver({ k: 'nap', years: 2, from: 'us' }) === 'us', 'giver');
  check(itemValue({ k: 'res', res: 'alloys', amt: 50, from: 'us' }) === 200 && itemValue({ k: 'monthly', res: 'consumer_goods', amt: 10, months: 12, from: 'us' }) === 240, 'resource value');
  check(itemValue({ k: 'rivalry' }, 2240) === 500 && itemValue({ k: 'rivalry' }, 2260) === 1000 && itemValue({ k: 'join_war' }, 2320) === 6000 && itemValue({ k: 'nap', years: 3, from: 'us' }, 2200) === 300, 'diplomatic values scale with year (×1/×2/×3)');
  const b = dealBalance([{ k: 'res', res: 'energy', amt: 300, from: 'us' }, { k: 'borders' }], 2220);
  check(b.toThem === 300 && b.fromThem === 150 && b.net === 150, 'balance');

  // 검증
  const peace = { ...c, war: false, ourWar: false };
  check(validateDeal([], c).includes('empty'), 'empty deal');
  check(validateDeal([{ k: 'res', res: 'energy', amt: 1001, from: 'us' }], peace).includes('stock_us:energy') && validateDeal([{ k: 'res', res: 'energy', amt: 501, from: 'them' }], peace).includes('stock_them:energy'), 'stockpile cap both sides');
  { // 받는 쪽 창고 자리(2026-11-05): 상대 에너지 500/최대 800 → 300 까지만
    const mx = { energy: 800, minerals: 0, food: 0, alloys: 0, consumer_goods: 0 } as typeof peace.them.stock;
    const pm = { ...peace, them: { ...peace.them, max: mx } };
    check(validateDeal([{ k: 'res', res: 'energy', amt: 301, from: 'us' }], pm).includes('room_them:energy') && validateDeal([{ k: 'res', res: 'energy', amt: 300, from: 'us' }], pm).length === 0 && validateDeal([{ k: 'res', res: 'energy', amt: 301, from: 'us' }], peace).length === 0, 'one-time amount must fit the receiver storage (only when max is known)');
    check(parseResSide({ s: '1,2,3,4,5', i: '0,0,0,0,0', m: '10K,0,0,0,0' }).max?.energy === 10000 && parseResSide({ s: '1', i: '0' }).max === undefined, 'parse storage max (m=)');
  }
  check(validateDeal([{ k: 'monthly', res: 'energy', amt: 9, months: 12, from: 'them' }], peace).includes('income_them:energy') && validateDeal([{ k: 'monthly', res: 'energy', amt: 8, months: 12, from: 'them' }], peace).length === 0, 'monthly cap = 20% of payer income');
  check(validateDeal([{ k: 'peace' }], peace).includes('peace_nowar') && validateDeal([{ k: 'peace' }], c).length === 0, 'peace only at war');
  check(validateDeal([{ k: 'join_war' }], c).includes('join_nowar') && validateDeal([{ k: 'join_war' }], { ...c, war: false, ourWar: true }).length === 0, 'call to arms needs our war, not with them');
  check(validateDeal([{ k: 'rivalry' }], { ...peace, rival: false }).includes('rivalry_none') && validateDeal([{ k: 'borders' }], c).includes('borders_atwar'), 'rivalry / borders conditions');
  check(validateDeal([{ k: 'nap', years: 2, from: 'them' }], c).includes('nap_atwar') && !validateDeal([{ k: 'nap', years: 2, from: 'them' }, { k: 'peace' }], c).includes('nap_atwar'), 'non-aggression needs peace while at war');
  check(validateDeal([{ k: 'res', res: 'energy', amt: 1, from: 'us' }, { k: 'res', res: 'energy', amt: 2, from: 'us' }], peace).some((e) => e.startsWith('dup:')), 'duplicate item');

  // 확률
  const base = { ...peace, trust: 1, pow: 2 };
  const o0 = dealOdds([{ k: 'res', res: 'energy', amt: 1, from: 'us' }], base, { score: 0 });
  check(o0.p === 50 && o0.parts.opinion === 0 && o0.parts.trust === 0 && o0.parts.power === 0, 'neutral deal ≈ 50%');
  check(dealOdds([{ k: 'res', res: 'energy', amt: 1, from: 'us' }], base, { score: 200 }).parts.opinion === 25 && dealOdds([{ k: 'res', res: 'energy', amt: 1, from: 'us' }], base, { score: -60 }).parts.opinion === -15, 'opinion ÷4, capped ±25');
  const big = dealOdds([{ k: 'res', res: 'energy', amt: 500, from: 'them' }], base, { score: 0 });
  check(big.parts.balance === -50 && big.p === 5, 'lopsided demand drops the chance');
  check(dealOdds([{ k: 'res', res: 'energy', amt: 900, from: 'us' }], base, { score: 0 }).parts.balance === 30, 'generous offer capped at +30');
  check(dealOdds([{ k: 'res', res: 'energy', amt: 1, from: 'us' }], base, { score: 0, hook: true, nag: 2 }).p === 50 + 30 - 20, 'hook +30, pestering -10 each');
  check(dealOdds([{ k: 'join_war' }], { ...base, ally: true, ourWar: true }, { score: 0, year: 2200 }).parts.ally === 25, 'ally call to arms +25');
  check(dealOdds([{ k: 'peace' }], { ...c }, { score: 0 }).parts.exhaustion === 24, 'peace weighs war exhaustion');
  check(dealOdds([{ k: 'res', res: 'energy', amt: 1, from: 'us' }], { ...base, trust: 4, pow: 4 }, { score: 400, hook: true }).p === 95 && dealOdds([{ k: 'res', res: 'energy', amt: 500, from: 'them' }], { ...base, trust: 0, pow: 0 }, { score: -400 }).p === 5, 'clamped to 5..95');
  check(rollDeal(60, () => 0.59) && !rollDeal(60, () => 0.6), 'app dice');
  check(worstPart({ opinion: -10, trust: 0, power: -14, balance: 5, hook: 0, ally: 0, exhaustion: 0, nag: 0 }) === 'power' && worstPart({ opinion: 1, trust: 0, power: 0, balance: 0, hook: 0, ally: 0, exhaustion: 0, nag: 0 }) === null, 'worst part');

  // 명령
  check(ctxCommand(3, 7) === 'effect every_playable_country = { limit = { is_ai = no } sllm_deal_ctx = { REQ = 3 TID = 7 } }', 'ctx command');
  const ap = applyCommand(4, 7, [{ k: 'res', res: 'alloys', amt: 50, from: 'us' }, { k: 'res', res: 'energy', amt: 20, from: 'them' }, { k: 'rivalry' }]);
  check(ap.includes('GAL = 50') && ap.includes('TEN = 20') && ap.includes('GEN = 0') && ap.includes('RIV = yes') && ap.includes('JOIN = no') && ap.length < 600, 'apply command');
  check(payCommand(5, 7, true, 'food', 30).includes('sllm_deal_pay = { REQ = 5 TID = 7 PAYUS = yes RES = food AMT = 30 }') && throws(() => payCommand(5, 7, true, 'gold' as never, 30)) && throws(() => payCommand(5, 7, false, 'food', 0)), 'pay command');
  check(opinionCommand(6, 7, DEAL_MODS.broken).includes('MOD = sllm_deal_broken') && throws(() => opinionCommand(6, 7, 'hack')), 'opinion command whitelist');
  check(joinCommand(8, 7).includes('sllm_deal_join') && allyWarCommand(9).includes('sllm_deal_allywar = { REQ = 9 }') && throws(() => ctxCommand(0, 7)), 'join / ally war commands');

  // 글
  check(itemText({ k: 'monthly', res: 'energy', amt: 8, months: 24, from: 'them' }, L, 'Us', 'Tzynn') === 'Tzynn → 8 Energy a month × 24 months', 'item text');
  const pt = dealPromptText([{ k: 'res', res: 'energy', amt: 300, from: 'us' }, { k: 'rivalry' }], false, { opinion: -20, trust: 0, power: 0, balance: -5, hook: 0, ally: 0, exhaustion: 0, nag: 0 }, false);
  check(pt.includes('they give you 300 Energy at once') && pt.includes('you stop treating them as a rival') && pt.includes('REFUSE') && pt.includes('do not like them') && !/[가-힣]/.test(pt), 'prompt: decision fixed, reason, English');
  check(dealPromptText([{ k: 'peace' }], true, { opinion: 0, trust: 0, power: 0, balance: 0, hook: 30, ally: 0, exhaustion: 0, nag: 0 }, true).includes('ACCEPT') && dealPromptText([{ k: 'peace' }], true, { opinion: 0, trust: 0, power: 0, balance: 0, hook: 30, ally: 0, exhaustion: 0, nag: 0 }, true).includes('secret'), 'prompt: accept + hook');

  // 약속
  const ag = agreementFrom('a1', 7, 'Tzynn', '2230.01.01', [{ k: 'monthly', res: 'energy', amt: 8, months: 2, from: 'them' }, { k: 'monthly', res: 'food', amt: 5, months: 3, from: 'us' }, { k: 'nap', years: 3, from: 'them' }], addYears)!;
  check(ag.monthly.length === 2 && ag.monthly[0].payUs === false && ag.monthly[1].payUs === true && ag.nap[0].until === '2233.01.01', 'agreement from deal');
  check(agreementFrom('a2', 7, 'T', '2230.01.01', [{ k: 'res', res: 'energy', amt: 1, from: 'us' }], addYears) === null, 'one-time deals need no tracking');
  const s1 = monthStep(ag, ['paid', 'short']);
  check(s1.breach === null && s1.ag.monthly[0].left === 1 && s1.ag.monthly[1].miss === 1, 'first miss is forgiven');
  const s2 = monthStep(s1.ag, ['paid', 'short']);
  check(s2.breach === 'us' && s2.ag.monthly[0].left === 0, 'two misses in a row = we broke it');
  check(monthStep(s1.ag, ['paid', 'paid']).ag.monthly[1].miss === 0, 'paying resets the miss count');
  check(napBreach(ag, { weAttacked: false }, '2231.05.01', cmpDate) === 'them' && napBreach(ag, { weAttacked: true }, '2231.05.01', cmpDate) === null && napBreach(ag, { weAttacked: false }, '2234.01.01', cmpDate) === null && napBreach(ag, null, '2231.05.01', cmpDate) === null, 'non-aggression breach only by the promiser, within the term');
  check(pruneNap(ag, '2233.01.02', cmpDate).nap.length === 0, 'expired promises drop');

  // 갈고리
  check(hookFromSecrets([{ key: 'fleet3' }, { key: 'plan_attack', rumor: true }]) === null && hookFromSecrets([{ key: 'opgood' }, { key: 'cb', rumor: false }]) === 'cb', 'hooks only from confirmed secrets');
  const tc = { idx: 4, name: 'Tzynn', player: 'Us', opinionA: 0, opinionB: 0, score: 0, owed: owedLine() } as TalkContext;
  check(systemPrompt(tc).includes('broke their word to you'), 'owed line reaches the prompt');

  // 모드
  const md = process.env.SLLM_MRD_MOD || path.join(__dirname, '..', 'tester-mod');
  const f = path.join(md, 'common', 'scripted_effects', 'sllm_deals.txt'), om = path.join(md, 'common', 'opinion_modifiers', 'sllm_deal_opinion.txt');
  if (!fs.existsSync(f) || !fs.existsSync(om)) { check(false, 'mod files present'); return; }
  const txt = fs.readFileSync(f, 'utf8'), op = fs.readFileSync(om, 'utf8');
  const code = (s: string) => s.split('\n').map((l) => l.replace(/#.*$/, '')).join('\n').replace(/"[^"]*"/g, '""');
  const bal = (s: string) => { let n = 0; for (const ch of code(s)) { if (ch === '{') n++; else if (ch === '}' && --n < 0) return false; } return n === 0; };
  check(bal(txt) && bal(op), 'mod braces balanced');
  for (const n of ['sllm_deal_find', 'sllm_deal_res_vars', 'sllm_deal_res_clear', 'sllm_deal_exh', 'sllm_deal_ctx', 'sllm_deal_apply', 'sllm_deal_pay', 'sllm_deal_opinion', 'sllm_deal_join', 'sllm_deal_allywar']) check(new RegExp('^' + n + ' = \\{', 'm').test(txt), 'mod effect defined: ' + n);
  for (const m of Object.values(DEAL_MODS)) check(new RegExp('^' + m + ' = \\{', 'm').test(op), 'opinion modifier defined: ' + m);
  check(/sllm_deal_broken = \{\s*opinion = \{ base = -50 \}/.test(op) && /sllm_deal_cta_refused = \{\s*opinion = \{ base = -30 \}/.test(op), 'opinion modifier sizes');
  check((txt.match(/status=duplicate/g) ?? []).length === 4, 'every changing op is deduplicated by request number');
  check(txt.includes('export_resource_income_to_variable') && txt.includes('category = all') && txt.includes('end_rivalry = event_target:sllm_dl_p') && txt.includes('join_war = event_target:sllm_dl_p') && txt.includes('join_war = event_target:sllm_dl_x'), 'uses verified effects');
  check(txt.includes('SLLM:DEALX/;/req=\\\\[This.sllm_dl_req]') && txt.includes('SLLM:DEALCTX/;/req=\\\\[This.sllm_dl_req]/;/sid=\\\\[This.sllm_save_id]/;/tid=\\\\[This.sllm_dl_tid]') && txt.includes('SLLM:DEALAWEND/;/req=\\\\[This.sllm_dl_req]') && !/log = "[^"]*\$[A-Z]+\$/.test(txt), 'reply lines');
  for (const lang of ['korean', 'english']) {
    let loc = ''; try { loc = fs.readFileSync(path.join(md, 'localisation', lang, `sllm_deals_l_${lang}.yml`), 'utf8'); } catch { /* 없음 */ }
    check(loc.charCodeAt(0) === 0xfeff && Object.values(DEAL_MODS).every((m) => loc.includes(m + ':0 "')), 'opinion names localised: ' + lang);
  }
  // 동맹 방어 전쟁 조사는 매달 상황 조사(al=)가 1일 때만(2026-10-27 최적화)
  { const scan = (() => { try { return fs.readFileSync(path.join(md, 'common', 'scripted_effects', 'sllm_probe_scan.txt'), 'utf8'); } catch { return ''; } })();
    check(scan.includes('/;/al=\\\\[This.sllm_st_al]') && scan.includes('set_variable = { which = sllm_st_al value = 1 }') && (scan.match(/\{/g) ?? []).length === (scan.match(/\}/g) ?? []).length, 'monthly scan reports al= (braces balanced)');
    const da = (() => { try { return fs.readFileSync(path.join(__dirname, 'features', 'deals-app.ts'), 'utf8'); } catch { try { return fs.readFileSync(path.join(__dirname, '..', 'src', 'features', 'deals-app.ts'), 'utf8'); } catch { return ''; } } })();
    check(da.includes('gameState.last.allyWar') && /if \(aw === false\)/.test(da), 'deals monthly skips the ally-war query when al=0'); }
  // 집무실 「외교 거래」 화면(2026-10-26): office.html 이 거래판·집무실 화면을 싣고, preload 가 목록·제국 지정 열기를 낸다.
  const ui = path.join(__dirname, '..', 'ui'), rd = (f: string) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
  const off = rd(path.join(ui, 'office.html')), pre = rd(path.join(__dirname, '..', 'src', 'preload.ts')), od = rd(path.join(ui, 'office-deals.js'));
  check(off.includes('href="office-deals.css"') && off.indexOf('src="deal-ui.js"') > off.indexOf('src="office-embassy.js"') && off.indexOf('src="office-deals.js"') > off.indexOf('src="deal-ui.js"'), 'office loads deal board after embassy');
  check(/dealList:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('dealList'\)/.test(pre) && /dealOpen:\s*\(tid\?: number\)\s*=>\s*ipcRenderer\.invoke\('dealOpen', tid\)/.test(pre), 'preload exposes dealList and dealOpen(tid)');
  check(od.includes("$('embCall')") && od.includes("SLLMDeal.open({ host: main, tid: cur") && !/language\(\)\s*===/.test(od), 'office deals app: icon after embassy, board in host, L() only');
}
