// 외교 거래(다음 업데이트, 2026-10-26 — CK3·배너로드 참고). 순수 규칙: 가치·확률·검증·명령·프롬프트 줄·약속 감시.
// 앱: src/features/deals-app.ts, 화면: ui/deal-ui.js, 모드: tester-mod/common/scripted_effects/sllm_deals.txt. 설계: docs/DIPLO_DEALS_DESIGN_KO.md
// 사용자 확정(2026-10-26):
//   ① 수락·거절은 앱 주사위. 확률 = 50 + 호감÷4(±25) + 신뢰(-5~+15) + 국력(±14) + 저울(-60~+30) + 갈고리 30 + 동맹 참전 25 + 전쟁 피로, 같은 달 다시 조르면 -10씩, 5~95%.
//   ② 거래 항목: 자원(한 번에·매달 N개월)·국경 개방·경쟁 관계 해제·약속(불가침·참전). 가치 = 바닐라 시장 비율(에너지·광물·식량 1, 소비재 2, 합금 4), 외교 항목은 연도 배율(×1/×2/×3).
//   ③ 매달 지급 한도 = 내는 쪽 그 자원 월수입 20%, 최대 120개월. 두 달 연속 미납이면 약속 파기.
//   ④ 갈고리 = 첩보 보고서의 확인된 비밀, 쓰면 +30%p 한 번.
//   ⑤ 참전 요청 거절 = 요청국 호감 -30 + 신문. 우리가 약속을 어기면 상대 호감 -50 + 신문 + 상대가 갈고리.
import { wrapForPlayer } from './protocol';
import { questYearFactor } from './quest-effects';
import { cleanGameName, isWhat, type RenameWhat } from './rename';

export type DealRes = 'energy' | 'minerals' | 'food' | 'alloys' | 'consumer_goods';
export const DEAL_RES: DealRes[] = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods'];
export const DEAL = {
  base: 50, minP: 5, maxP: 95,
  opinionDiv: 4, opinionCap: 25,
  trustPts: [-5, 0, 5, 10, 15], powerPts: [-14, -7, 0, 7, 14],
  balanceMin: -60, balanceMax: 30, balanceScaleMin: 500, balanceScaleMonths: 12,
  hook: 30, ally: 25, exhMult: 60, nag: 10,
  incomeShare: 0.2, maxMonths: 120, missLimit: 2, maxItems: 8, maxNapYears: 10,
  value: { energy: 1, minerals: 1, food: 1, alloys: 4, consumer_goods: 2 } as Record<DealRes, number>,
  diplo: { borders: 150, rivalry: 500, napYear: 100, joinWar: 2000, renameCap: 2500, renameSys: 1200, restore: 1500, cedeBase: 1000, cedeCol: 1500 },
  // 이름의 정치(2026-11-04): 개명 요구는 자존심 문제라 확률에 따로 깎이고(수도 행성 -30, 수도 성계 -18), 빼앗은 이름을 돌려주면 +20
  pride: { cap: -30, sys: -18, restore: 20, cedeBase: -10, cedeCol: -8, cedeMax: -40 }, humiliatedOpinion: -100, restoredOpinion: 40,
  brokenOpinion: -50, ctaOpinion: -30, hookRefusedOpinion: -30, ctaAnswerMonths: 2,
  // 영유권 포기(2026-11-05, Expanded Espionage and Diplomacy 모드의 생각만 참고): 서로 영유권을 지우고 10년간 새로 걸지 않는다.
  // 상대만 우리 땅에 영유권을 걸어 뒀으면 상대가 잃는 것이라 -12, 우리만 걸어 뒀으면 상대가 얻는 것이라 +12. 10년 안에 새로 걸면 그 쪽이 약속을 어긴 것(해마다 1월에 확인).
  waive: { years: 10, theirs: -12, ours: 12 },
} as const;
export const DEAL_MODS = { broken: 'sllm_deal_broken', ctaRefused: 'sllm_deal_cta_refused', hookRefused: 'sllm_deal_hook_refused', humiliated: 'sllm_deal_humiliated', restored: 'sllm_deal_name_restored' } as const;

export type Side = 'us' | 'them';
export type DealItem =
  | { k: 'res'; res: DealRes; amt: number; from: Side }
  | { k: 'monthly'; res: DealRes; amt: number; months: number; from: Side }
  | { k: 'borders' } // 상대가 우리에게 국경을 연다
  | { k: 'rivalry' } // 상대가 우리를 경쟁국에서 뺀다
  | { k: 'nap'; years: number; from: Side } // from 쪽이 상대를 공격하지 않겠다고 약속
  | { k: 'join_war' } // 상대가 우리 전쟁에 들어온다
  | { k: 'peace' } // 서로 전쟁을 끝낸다
  | { k: 'rename'; what: RenameWhat; name: string } // 굴욕 조항: 상대가 자기 수도 행성·성계 이름을 우리가 정한 이름으로(2026-11-04)
  | { k: 'restore'; rid: string; what: RenameWhat; name: string } // 우리가 빼앗은 이름을 돌려준다(name = 돌려줄 원래 이름, 앱 장부에서 확인)
  | { k: 'waive' } // 영유권 포기(2026-11-05): 서로 상대 영토에 건 영유권을 모두 거두고 10년간 새로 걸지 않는다(양쪽)
  | { k: 'cede'; from: Side; n: number; name: string; col: number }; // 성계 할양(2026-11-04): from 쪽이 성계 하나(번호 n = 별 변수 sllm_sys)를 내준다. 게임 명령은 vassal-admin 과 같음
export interface ResSide { stock: Record<DealRes, number>; income: Record<DealRes, number>; /** 창고 최대치(2026-11-05). 옛 모드면 없음 */ max?: Record<DealRes, number> }
export interface DealCtx { us: ResSide; them: ResSide; trust: number; pow: number; rival: boolean; ally: boolean; war: boolean; ourWar: boolean; exhUs: number; exhThem: number; /** 영유권(2026-11-05): 우리가 상대 땅에 · 상대가 우리 땅에 건 것이 있나(옛 모드면 false) */ claimsUs?: boolean; claimsThem?: boolean }

const int = (n: unknown): n is number => Number.isSafeInteger(n);
const okReq = (r: number) => int(r) && r >= 1;
const okIdx = (i: number) => int(i) && i >= 1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 게임 변수 글자(예: 1234.5, -3, 12.3K) → 수. 모르면 0. */
export function gameNum(s: unknown): number {
  const m = String(s ?? '').trim().replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([KkMm])?$/);
  if (!m) return 0;
  return Number(m[1]) * (m[2] ? (/[Kk]/.test(m[2]) ? 1e3 : 1e6) : 1);
}
const five = (s: unknown): Record<DealRes, number> => { const p = String(s ?? '').split(','); return Object.fromEntries(DEAL_RES.map((r, i) => [r, gameNum(p[i])])) as Record<DealRes, number>; };
export const parseResSide = (kv: Record<string, string>): ResSide => ({ stock: five(kv.s), income: five(kv.i), ...(kv.m ? { max: five(kv.m) } : {}) });
/** SLLM:DEALCTX(우리 쪽·관계) + SLLM:DEALX(상대 쪽) → 거래 사정. 상대를 못 찾았으면 null. */
export function parseDealCtx(kv: Record<string, string>, x: Record<string, string> | undefined): DealCtx | null {
  if (kv.ok !== '1' || !x) return null;
  const n = (k: string, lo: number, hi: number, d: number) => { const v = Math.round(gameNum(kv[k])); return Number.isFinite(v) && kv[k] !== undefined ? clamp(v, lo, hi) : d; };
  return { us: parseResSide(kv), them: parseResSide(x), trust: n('tr', 0, 4, 0), pow: n('pow', 0, 4, 2), rival: kv.rv === '1', ally: kv.al === '1', war: kv.wr === '1', ourWar: kv.ow === '1', exhUs: n('eu', 0, 10, 0), exhThem: n('et', 0, 10, 0), claimsUs: kv.cu === '1', claimsThem: kv.ct === '1' };
}

/** 화면에서 온 항목을 믿을 수 있는 모양으로(모르는 것은 버림). */
export function sanitizeItems(raw: unknown): DealItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DealItem[] = [];
  const side = (v: unknown): Side | null => (v === 'us' || v === 'them' ? v : null);
  const res = (v: unknown): DealRes | null => (DEAL_RES.includes(v as DealRes) ? (v as DealRes) : null);
  for (const r of raw.slice(0, 20) as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue;
    const amt = Math.floor(Number(r.amt)), months = Math.floor(Number(r.months)), years = Math.floor(Number(r.years));
    if (r.k === 'res' && res(r.res) && side(r.from) && amt >= 1 && amt <= 1e6) out.push({ k: 'res', res: res(r.res)!, amt, from: side(r.from)! });
    else if (r.k === 'monthly' && res(r.res) && side(r.from) && amt >= 1 && amt <= 1e5 && months >= 1 && months <= DEAL.maxMonths) out.push({ k: 'monthly', res: res(r.res)!, amt, months, from: side(r.from)! });
    else if (r.k === 'nap' && side(r.from) && years >= 1 && years <= DEAL.maxNapYears) out.push({ k: 'nap', years, from: side(r.from)! });
    else if (r.k === 'borders' || r.k === 'rivalry' || r.k === 'join_war' || r.k === 'peace' || r.k === 'waive') out.push({ k: r.k });
    else if (r.k === 'rename' && isWhat(r.what) && cleanGameName(r.name)) out.push({ k: 'rename', what: r.what, name: cleanGameName(r.name)! });
    else if (r.k === 'cede' && side(r.from) && Number.isSafeInteger(Number(r.n)) && Number(r.n) >= 1 && typeof r.name === 'string' && r.name.trim()) out.push({ k: 'cede', from: side(r.from)!, n: Number(r.n), name: String(r.name).replace(/[\r\n"\\]/g, '').trim().slice(0, 60), col: clamp(Math.floor(Number(r.col)) || 0, 0, 30) });
    else if (r.k === 'restore' && isWhat(r.what) && typeof r.rid === 'string' && /^[\w:.-]{1,80}$/.test(r.rid)) out.push({ k: 'restore', rid: r.rid, what: r.what, name: cleanGameName(r.name) ?? '' });
  }
  return out;
}

/** 이 항목을 내주는 쪽(종전은 양쪽). */
export function giver(it: DealItem): Side | 'both' { return it.k === 'res' || it.k === 'monthly' || it.k === 'nap' || it.k === 'cede' ? it.from : it.k === 'peace' || it.k === 'waive' ? 'both' : it.k === 'restore' ? 'us' : 'them'; }
/** 항목 가치(에너지 단위). 외교 항목은 연도 배율. 종전은 0(전쟁 피로가 확률에 들어감). */
export function itemValue(it: DealItem, year?: number): number {
  const f = questYearFactor(year);
  switch (it.k) {
    case 'res': return it.amt * DEAL.value[it.res];
    case 'monthly': return it.amt * it.months * DEAL.value[it.res];
    case 'borders': return DEAL.diplo.borders * f;
    case 'rivalry': return DEAL.diplo.rivalry * f;
    case 'nap': return DEAL.diplo.napYear * it.years * f;
    case 'join_war': return DEAL.diplo.joinWar * f;
    case 'peace': return 0;
    case 'waive': return 0; // 서로 주고받는 약속 — 가치 대신 영유권 사정이 확률(claims)에 들어감
    case 'rename': return (it.what === 'cap' ? DEAL.diplo.renameCap : DEAL.diplo.renameSys) * f;
    case 'restore': return DEAL.diplo.restore * f;
    case 'cede': return (DEAL.diplo.cedeBase + DEAL.diplo.cedeCol * it.col) * f;
  }
}
/** 저울: 상대가 받는 가치 - 상대가 주는 가치(양수 = 상대에게 이로움). */
export function dealBalance(items: DealItem[], year?: number): { toThem: number; fromThem: number; net: number } {
  let toThem = 0, fromThem = 0;
  for (const it of items) { const g = giver(it), v = itemValue(it, year); if (g === 'us') toThem += v; else if (g === 'them') fromThem += v; }
  return { toThem, fromThem, net: toThem - fromThem };
}

/** 거래가 성립할 수 있는지. 문제가 있으면 까닭 목록(코드). 빈 목록이면 제안할 수 있다. */
export function validateDeal(items: DealItem[], c: DealCtx): string[] {
  const err: string[] = [];
  if (!items.length) err.push('empty');
  if (items.length > DEAL.maxItems) err.push('too_many');
  const seen = new Set<string>();
  for (const it of items) {
    const key = it.k === 'res' || it.k === 'monthly' ? `${it.k}:${it.res}:${it.from}` : it.k === 'nap' ? `nap:${it.from}` : it.k === 'rename' || it.k === 'restore' ? `name:${it.what}` : it.k === 'cede' ? `cede:${it.n}` : it.k;
    if (seen.has(key)) err.push('dup:' + key); seen.add(key);
  }
  for (const s of ['us', 'them'] as Side[]) {
    const side = s === 'us' ? c.us : c.them;
    for (const r of DEAL_RES) {
      const once = items.reduce((n, it) => n + (it.k === 'res' && it.res === r && it.from === s ? it.amt : 0), 0);
      if (once > Math.floor(side.stock[r])) err.push(`stock_${s}:${r}`);
      // 받는 쪽 창고가 넘치면 넘친 만큼 사라진다(2026-11-05) — 최대치를 아는 경우만
      const rcv = s === 'us' ? c.them : c.us, mx = rcv.max ? rcv.max[r] : 0;
      if (once > 0 && mx > 0 && once > Math.max(0, Math.floor(mx - rcv.stock[r]))) err.push(`room_${s === 'us' ? 'them' : 'us'}:${r}`);
      const mon = items.reduce((n, it) => n + (it.k === 'monthly' && it.res === r && it.from === s ? it.amt : 0), 0);
      if (mon > 0 && mon > Math.floor(Math.max(0, side.income[r]) * DEAL.incomeShare)) err.push(`income_${s}:${r}`);
    }
  }
  const has = (k: DealItem['k']) => items.some((it) => it.k === k);
  if (has('peace') && !c.war) err.push('peace_nowar');
  if (has('join_war') && (!c.ourWar || c.war)) err.push('join_nowar');
  if (has('rivalry') && !c.rival) err.push('rivalry_none');
  if (has('nap') && c.war && !has('peace')) err.push('nap_atwar');
  if (has('borders') && c.war) err.push('borders_atwar');
  if (has('waive') && c.war && !has('peace')) err.push('waive_atwar');
  return err;
}
/** 화면에 보일 까닭(한/영). */
export function dealErrorText(code: string, L: (ko: string, en: string) => string, resName: (r: DealRes) => string): string {
  const [k, r] = code.split(':') as [string, DealRes | undefined];
  const rn = r ? resName(r) : '';
  const t: Record<string, string> = {
    empty: L('거래판이 비었습니다.', 'The deal is empty.'),
    too_many: L(`항목은 ${DEAL.maxItems}개까지입니다.`, `At most ${DEAL.maxItems} items.`),
    dup: L('같은 항목이 두 번 들어 있습니다.', 'The same item appears twice.'),
    stock_us: L(`우리 창고의 ${rn}이(가) 모자랍니다.`, `We do not have enough ${rn}.`),
    stock_them: L(`상대 창고의 ${rn}이(가) 모자랍니다.`, `They do not have enough ${rn}.`),
    room_us: L(`우리 ${rn} 창고에 다 들어가지 않습니다(남은 자리보다 많음).`, `Our ${rn} storage cannot hold that much (more than the room left).`),
    room_them: L(`상대 ${rn} 창고에 다 들어가지 않습니다(남은 자리보다 많음).`, `Their ${rn} storage cannot hold that much (more than the room left).`),
    income_us: L(`매달 ${rn}은(는) 우리 월수입의 20%까지만 약속할 수 있습니다.`, `Monthly ${rn} is capped at 20% of our income.`),
    income_them: L(`매달 ${rn}은(는) 상대 월수입의 20%까지만 받을 수 있습니다.`, `Monthly ${rn} is capped at 20% of their income.`),
    peace_nowar: L('서로 전쟁 중이 아니라 종전을 넣을 수 없습니다.', 'You are not at war with them, so peace cannot be included.'),
    join_nowar: L('참전은 우리가 다른 제국과 전쟁 중일 때만(이 상대와는 전쟁 중이 아니어야) 넣을 수 있습니다.', 'A call to arms needs us to be at war with someone else (and not with them).'),
    rivalry_none: L('상대가 우리를 경쟁국으로 두고 있지 않습니다.', 'They do not consider us a rival.'),
    nap_atwar: L('전쟁 중에는 종전 없이 불가침 약속을 넣을 수 없습니다.', 'A non-aggression promise needs peace while at war.'),
    waive_atwar: L('전쟁 중에는 종전 없이 영유권 포기를 넣을 수 없습니다.', 'Renouncing claims needs peace while at war.'),
    borders_atwar: L('전쟁 중에는 국경 개방을 넣을 수 없습니다.', 'Borders cannot be opened while at war.'),
    restore_none: L('돌려줄 이름이 장부에 없습니다(이미 돌려줬거나 다른 제국의 것).', 'There is no such name in the ledger to return (already returned, or another empire’s).'),
  };
  return t[k] ?? code;
}

export interface OddsParts { opinion: number; trust: number; power: number; balance: number; hook: number; ally: number; exhaustion: number; nag: number; pride?: number; claims?: number }
/** 수락 확률(5~95). score = 상대가 우리를 보는 의견 점수, nag = 이번 달 같은 상대에게 이미 낸 제안 수. */
export function dealOdds(items: DealItem[], c: DealCtx, o: { score: number; year?: number; hook?: boolean; nag?: number }): { p: number; parts: OddsParts } {
  const b = dealBalance(items, o.year), scale = Math.max(DEAL.balanceScaleMin, Math.max(0, c.them.income.energy) * DEAL.balanceScaleMonths);
  const parts: OddsParts = {
    opinion: Math.round(clamp((Number(o.score) || 0) / DEAL.opinionDiv, -DEAL.opinionCap, DEAL.opinionCap)),
    trust: DEAL.trustPts[clamp(Math.round(c.trust), 0, 4)],
    power: DEAL.powerPts[clamp(Math.round(c.pow), 0, 4)],
    balance: Math.round(clamp((b.net / scale) * 50, DEAL.balanceMin, DEAL.balanceMax)),
    hook: o.hook ? DEAL.hook : 0,
    ally: c.ally && items.some((it) => it.k === 'join_war') ? DEAL.ally : 0,
    exhaustion: items.some((it) => it.k === 'peace') ? Math.round(((c.exhThem - c.exhUs) / 10) * DEAL.exhMult) : 0,
    nag: -DEAL.nag * Math.max(0, Math.floor(o.nag ?? 0)),
    pride: Math.max(DEAL.pride.cedeMax * 2, items.reduce((a, it) => a + (it.k === 'rename' ? DEAL.pride[it.what] : it.k === 'restore' ? DEAL.pride.restore : it.k === 'cede' && it.from === 'them' ? Math.max(DEAL.pride.cedeMax, DEAL.pride.cedeBase + DEAL.pride.cedeCol * it.col) : 0), 0)),
    claims: items.some((it) => it.k === 'waive') ? (c.claimsThem ? DEAL.waive.theirs : 0) + (c.claimsUs ? DEAL.waive.ours : 0) : 0,
  };
  const sum = DEAL.base + Object.values(parts).reduce((a, v) => a + v, 0);
  return { p: clamp(Math.round(sum), DEAL.minP, DEAL.maxP), parts };
}
export const rollDeal = (p: number, rnd: () => number = Math.random): boolean => rnd() * 100 < p;
/** 거절했을 때 가장 크게 끌어내린 까닭(프롬프트 말투용). */
export function worstPart(parts: OddsParts): keyof OddsParts | null {
  let k: keyof OddsParts | null = null, v = 0;
  for (const [key, val] of Object.entries(parts) as Array<[keyof OddsParts, number]>) if (val < v) { v = val; k = key; }
  return k;
}

// ---- 게임 명령 ----
export function ctxCommand(req: number, tid: number): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_DEAL');
  return wrapForPlayer(`sllm_deal_ctx = { REQ = ${req} TID = ${tid} }`);
}
/** 한 번에 주고받는 자원 + 경쟁 해제 + 참전. 국경·종전은 기존 효과로 따로. */
export function applyCommand(req: number, tid: number, items: DealItem[]): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_DEAL');
  const sum = (s: Side, r: DealRes) => items.reduce((n, it) => n + (it.k === 'res' && it.from === s && it.res === r ? it.amt : 0), 0);
  const v = (s: Side, r: DealRes) => { const x = sum(s, r); if (!int(x) || x < 0 || x > 1e7) throw new Error('INVALID_DEAL'); return x; };
  const G = ['GEN', 'GMI', 'GFO', 'GAL', 'GCG'], T = ['TEN', 'TMI', 'TFO', 'TAL', 'TCG'];
  const parts = DEAL_RES.map((r, i) => `${G[i]} = ${v('us', r)}`).concat(DEAL_RES.map((r, i) => `${T[i]} = ${v('them', r)}`));
  const yn = (b: boolean) => (b ? 'yes' : 'no');
  return wrapForPlayer(`sllm_deal_apply = { REQ = ${req} TID = ${tid} ${parts.join(' ')} RIV = ${yn(items.some((it) => it.k === 'rivalry'))} JOIN = ${yn(items.some((it) => it.k === 'join_war'))} WAIVE = ${yn(items.some((it) => it.k === 'waive'))} }`);
}
export function payCommand(req: number, tid: number, payUs: boolean, res: DealRes, amt: number): string {
  if (!okReq(req) || !okIdx(tid) || !DEAL_RES.includes(res) || !int(amt) || amt < 1 || amt > 1e6) throw new Error('INVALID_DEAL');
  return wrapForPlayer(`sllm_deal_pay = { REQ = ${req} TID = ${tid} PAYUS = ${payUs ? 'yes' : 'no'} RES = ${res} AMT = ${amt} }`);
}
export function opinionCommand(req: number, tid: number, mod: string): string {
  if (!okReq(req) || !okIdx(tid) || !Object.values(DEAL_MODS).includes(mod as never)) throw new Error('INVALID_DEAL');
  return wrapForPlayer(`sllm_deal_opinion = { REQ = ${req} TID = ${tid} MOD = ${mod} }`);
}
export function joinCommand(req: number, tid: number): string {
  if (!okReq(req) || !okIdx(tid)) throw new Error('INVALID_DEAL');
  return wrapForPlayer(`sllm_deal_join = { REQ = ${req} TID = ${tid} }`);
}
export function allyWarCommand(req: number): string {
  if (!okReq(req)) throw new Error('INVALID_DEAL');
  return wrapForPlayer(`sllm_deal_allywar = { REQ = ${req} }`);
}

// ---- 글 ----
export const RES_NAME: Record<DealRes, [string, string]> = { energy: ['에너지', 'Energy'], minerals: ['광물', 'Minerals'], food: ['식량', 'Food'], alloys: ['합금', 'Alloys'], consumer_goods: ['소비재', 'Consumer Goods'] };
/** 항목 한 줄. who = 그 쪽의 이름(우리/상대). */
export function itemText(it: DealItem, L: (ko: string, en: string) => string, us: string, them: string): string {
  const rn = (r: DealRes) => L(RES_NAME[r][0], RES_NAME[r][1]);
  const who = (s: Side) => (s === 'us' ? us : them), other = (s: Side) => (s === 'us' ? them : us);
  switch (it.k) {
    case 'res': return L(`${who(it.from)} → ${rn(it.res)} ${it.amt}`, `${who(it.from)} → ${it.amt} ${rn(it.res)}`);
    case 'monthly': return L(`${who(it.from)} → 매달 ${rn(it.res)} ${it.amt} × ${it.months}개월`, `${who(it.from)} → ${it.amt} ${rn(it.res)} a month × ${it.months} months`);
    case 'borders': return L(`${them}이(가) 국경을 엶`, `${them} opens its borders`);
    case 'rivalry': return L(`${them}이(가) 경쟁 관계를 끝냄`, `${them} ends its rivalry`);
    case 'nap': return L(`${who(it.from)}이(가) ${it.years}년간 ${other(it.from)}을(를) 공격하지 않음`, `${who(it.from)} will not attack ${other(it.from)} for ${it.years} years`);
    case 'join_war': return L(`${them}이(가) 우리 전쟁에 참전`, `${them} joins our wars`);
    case 'peace': return L('서로 전쟁을 끝냄', 'Both sides make peace');
    case 'waive': return L(`서로 상대 영토에 건 영유권을 모두 거두고 ${DEAL.waive.years}년간 새로 걸지 않음`, `Both sides drop every claim on each other's territory and make no new ones for ${DEAL.waive.years} years`);
    case 'rename': return it.what === 'cap' ? L(`${them}이(가) 수도 행성 이름을 「${it.name}」(으)로 바꿈`, `${them} renames its capital world "${it.name}"`) : L(`${them}이(가) 수도 성계 이름을 「${it.name}」(으)로 바꿈`, `${them} renames its capital system "${it.name}"`);
    case 'restore': return L(`${us}이(가) ${them}에게 ${it.what === 'cap' ? '수도 행성' : '수도 성계'} 이름 「${it.name}」을(를) 돌려줌`, `${us} returns the name "${it.name}" to ${them}'s capital ${it.what === 'cap' ? 'world' : 'system'}`);
    case 'cede': return L(`${who(it.from)}이(가) ${other(it.from)}에게 「${it.name}」 성계(식민지 ${it.col})를 넘김`, `${who(it.from)} cedes the ${it.name} system (${it.col} colonies) to ${other(it.from)}`);
  }
}
/** AI 에게 줄 영어 항목 줄. 여기서 they = 플레이어, you = AI. */
function itemEn(it: DealItem): string {
  const who = (s: Side) => (s === 'us' ? 'they give you' : 'you give them');
  switch (it.k) {
    case 'res': return `${who(it.from)} ${it.amt} ${RES_NAME[it.res][1]} at once`;
    case 'monthly': return `${who(it.from)} ${it.amt} ${RES_NAME[it.res][1]} every month for ${it.months} months`;
    case 'borders': return 'you open your borders to them';
    case 'rivalry': return 'you stop treating them as a rival';
    case 'nap': return it.from === 'us' ? `they promise not to attack you for ${it.years} years` : `you promise not to attack them for ${it.years} years`;
    case 'join_war': return 'you join their current wars on their side';
    case 'peace': return 'both sides make peace';
    case 'waive': return `both sides drop all claims on each other's territory and promise to make no new claims for ${DEAL.waive.years} years`;
    case 'rename': return `you rename your own capital ${it.what === 'cap' ? 'world' : 'system'} to "${it.name}", a name they chose (a deep national humiliation)`;
    case 'restore': return `they give your capital ${it.what === 'cap' ? 'world' : 'system'} back its original name "${it.name}", which they had forced you to change`;
    case 'cede': return it.from === 'us' ? `they cede their ${it.name} system (${it.col} colonies) to you` : `you cede your ${it.name} system (${it.col} colonies) to them — giving up your own territory and people`;
  }
}
const WHY_EN: Record<keyof OddsParts, string> = {
  opinion: 'you simply do not like them enough', trust: 'you do not trust them', power: 'they are not strong enough to press you',
  balance: 'the terms are lopsided against you', hook: '', ally: '', exhaustion: 'your side is not worn down enough to make peace on these terms', nag: 'they keep pestering you with proposals',
  pride: 'renaming your own capital or giving up your own territory at their demand would be a national humiliation',
  claims: 'you are not ready to give up your own claims on their territory',
};
/** 결과를 정한 뒤 AI 에게 보낼 사용자 쪽 줄(시스템 표시). AI 는 이 결과에 맞춰 말만 한다. */
export function dealPromptText(items: DealItem[], accepted: boolean, parts: OddsParts, hook: boolean): string {
  const lines = [
    `[Deal proposal] The ruler you are talking to formally proposes a deal: ${items.map(itemEn).join('; ')}.`,
    accepted ? 'Your council has weighed it and the decision is final: you ACCEPT this deal.' : 'Your council has weighed it and the decision is final: you REFUSE this deal.',
  ];
  if (hook) lines.push('They also reminded you of a secret their spies uncovered about you; that leverage weighed on the decision.');
  if (!accepted) { const w = worstPart(parts); if (w && WHY_EN[w]) lines.push(`The main reason: ${WHY_EN[w]}.`); }
  lines.push('Answer in character in at most two sentences, stating the decision clearly. Do not add new conditions or counter-offers. Use action type none and mood none.');
  return lines.join(' ');
}

// ---- 약속 감시 ----
export interface Monthly { res: DealRes; amt: number; left: number; payUs: boolean; miss: number; /** 정기 송금(2026-11-09): 모드가 못 냈다고 알린 달(YYYY.MM) */ sm?: string; /** 모드 칸이 모자라 예전처럼 앱이 매달 보냄 */ legacy?: boolean }
export interface Nap { by: Side; until: string }
export interface Agreement { id: string; tid: number; name: string; since: string; monthly: Monthly[]; nap: Nap[]; done?: boolean; broken?: Side; /** 영유권 포기(2026-11-05): 이 날까지 서로 새 영유권 금지 */ waive?: { until: string };
  /** 정기 송금(2026-11-09): 모드 칸의 묶음 번호 · 이번 세션에 모드에 적었나(불러오면 다시 확인) · 불러온 뒤 확인만 할 차례(게임에 칸이 없으면 끝난 것) */ g?: number; reg?: boolean; chk?: boolean }
/** 수락된 거래에서 앱이 지켜볼 부분(매달 지급·불가침). 없으면 null. */
export function agreementFrom(id: string, tid: number, name: string, date: string, items: DealItem[], addYears: (d: string, y: number) => string): Agreement | null {
  const monthly: Monthly[] = items.flatMap((it) => (it.k === 'monthly' ? [{ res: it.res, amt: it.amt, left: it.months, payUs: it.from === 'us', miss: 0 }] : []));
  const nap: Nap[] = items.flatMap((it) => (it.k === 'nap' ? [{ by: it.from, until: addYears(date, it.years) }] : []));
  const waive = items.some((it) => it.k === 'waive') ? { until: addYears(date, DEAL.waive.years) } : undefined;
  return monthly.length || nap.length || waive ? { id, tid, name, since: date, monthly, nap, ...(waive ? { waive } : {}) } : null;
}
/** 한 달 지급 결과 반영(순수). results[i] = 그 줄의 결과(paid|short|그 밖 = 이번 달 건너뜀). 두 달 연속 미납이면 그 쪽이 어긴 것. */
export function monthStep(ag: Agreement, results: Array<string | undefined>): { ag: Agreement; breach: Side | null } {
  let breach: Side | null = null;
  const monthly = ag.monthly.map((m, i) => {
    const r = results[i];
    if (m.left <= 0) return m;
    if (r === 'paid') return { ...m, left: m.left - 1, miss: 0 };
    if (r === 'short') { const miss = m.miss + 1; if (miss >= DEAL.missLimit && !breach) breach = m.payUs ? 'us' : 'them'; return { ...m, miss }; }
    return m;
  });
  const done = monthly.every((m) => m.left <= 0) && ag.nap.length === 0 && !ag.waive;
  return { ag: { ...ag, monthly, ...(done ? { done } : {}) }, breach };
}
/** 정기 송금(2026-11-09): 모드가 매달 직접 보내는 지급의 앱 쪽 장부. 그 달 못 냈다는 줄(sm)이 없으면 낸 것으로 친다(잘 낸 달은 줄이 없다).
 *  맺은 달(since)에는 세지 않는다(모드는 다음 달 첫날부터 보낸다). 앱만 보는 숫자 — 실제 끝·끊김은 모드의 end·stop 줄이 정한다. */
export function mtStep(ag: Agreement, month: string): Agreement {
  if (!ag.reg || ag.since.slice(0, 7) === month) return ag;
  const monthly = ag.monthly.map((m) => (m.left <= 0 || m.legacy ? m : m.sm === month ? m : { ...m, left: m.left - 1, miss: 0 }));
  const done = monthly.every((m) => m.left <= 0) && ag.nap.length === 0 && !ag.waive;
  return { ...ag, monthly, ...(done ? { done } : {}) };
}
/** 불가침 약속을 어겼나: 이 상대와 전쟁 중이고, 약속한 쪽이 공격자이며 아직 기한 안. */
export function napBreach(ag: Agreement, war: { weAttacked: boolean } | null, today: string, cmp: (a: string, b: string) => number): Side | null {
  if (!war) return null;
  const by: Side = war.weAttacked ? 'us' : 'them';
  return ag.nap.some((n) => n.by === by && cmp(today, n.until) < 0) ? by : null;
}
/** 영유권 포기 약속을 어겼나(해마다 1월에 DEALCTX 로 읽은 cu·ct): 기한 안에 새로 건 쪽. 둘 다면 우리 쪽을 먼저(앱이 공정하게 우리 잘못부터 본다). */
export function waiveBreach(ag: Agreement, c: Pick<DealCtx, 'claimsUs' | 'claimsThem'> | null, today: string, cmp: (a: string, b: string) => number): Side | null {
  if (!ag.waive || !c || cmp(today, ag.waive.until) >= 0) return null;
  return c.claimsUs ? 'us' : c.claimsThem ? 'them' : null;
}
/** 기한이 지난 영유권 포기 약속은 지운다. */
export const pruneWaive = (ag: Agreement, today: string, cmp: (a: string, b: string) => number): Agreement => (ag.waive && cmp(today, ag.waive.until) >= 0 ? (({ waive: _w, ...rest }) => rest)(ag) : ag);
/** 기한이 지난 불가침 약속은 지운다. */
export const pruneNap = (ag: Agreement, today: string, cmp: (a: string, b: string) => number): Agreement => ({ ...ag, nap: ag.nap.filter((n) => cmp(today, n.until) < 0) });

// ---- 갈고리 ----
/** 첩보 보고서의 비밀 가운데 갈고리가 되는 것(확인된 것만, 소문 제외). */
export const HOOK_KEYS = ['cb', 'plan_attack', 'plan_weaken', 'plan_vassal'] as const;
export function hookFromSecrets(shown: Array<{ key: string; rumor?: boolean }>): string | null {
  const s = shown.find((x) => !x.rumor && (HOOK_KEYS as readonly string[]).includes(x.key));
  return s ? s.key : null;
}
/** 상대가 우리에 대한 갈고리를 쥐고 있을 때 AI 프롬프트 줄. */
export const owedLine = (): string => 'They once broke their word to you on a deal. You hold that over them as leverage: you may remind them of it when you make a demand, and they owe you.';
