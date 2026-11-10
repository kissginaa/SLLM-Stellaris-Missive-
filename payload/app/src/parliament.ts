// 여당·야당(2026-11-03 사용자 결정): ① 의석·여당 연정 ② 이름 있는 야당 대표(영수회담) ③ 원내 공방. 자유 정부만 실제 정치, 독재·제국은 「관제 의회」, 단일 의식은 없음.
// 의석: 200석을 파벌 지지율대로 나눈다(최대 잉여법), 파벌에 속하지 않은 인구 몫은 무소속. 탈당·빼오기로 생긴 의석 이동(adj)은 해마다 1석씩 원래대로.
// 여당: 제국 가치관과 같은 성향의 파벌(여럿이면 가장 큰 것), 없으면 정부 승인도가 가장 높은 파벌. 과반(101석)이 안 되면 연정이 필요하다.
// 정부 의석 = 여당 + 연정 + 법안 거래 중인 파벌. 이 의석이 불신임 표결에 들어간다(noconf.ts govShare).
// 「슈뢰딩거」: 원내 사건은 매달 앱 확률(게임 명령 없음). 게임 명령은 연정·거래·빼오기 효과를 붙일 때만(회신 CIVIC).
// 앱: src/features/parliament-app.ts. 화면: ui/office-audit.js(집무실 「의회」). 모드: common/static_modifiers/sllm_parliament_modifiers.txt.
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';
import { monthsBetween } from './letters';

export const PARL = {
  seats: 200, majority: 101,
  coalitionMod: 'sllm_parl_coalition', dealMod: 'sllm_parl_deal', spurnMod: 'sllm_lobby_spurned', scandalMod: 'sllm_lobby_scandal', modDays: 3600, dealDays: 720, spurnDays: 720, scandalDays: 720,
  offerCooldownMonths: 24, poachGapMonths: 12, poachEnergy: 400, poachSeats: 4, poachExpose: 0.3, dealGapMonths: 24,
  talkGapMonths: 6, talkTurns: 5, talkTokens: 800,
  breakLowApproval: 35, breakMonths: 3, eventChance: 0.04,
};
export const ETHIC_BITS: Record<string, number> = { militarist: 1, pacifist: 2, authoritarian: 4, egalitarian: 8, xenophile: 16, xenophobe: 32, materialist: 64, spiritualist: 128 };
export const OPPOSITE: Record<string, string> = { militarist: 'pacifist', pacifist: 'militarist', authoritarian: 'egalitarian', egalitarian: 'authoritarian', xenophile: 'xenophobe', xenophobe: 'xenophile', materialist: 'spiritualist', spiritualist: 'materialist' };
export interface Fac { key: string; fid?: number; name: string; ethic: string; support: number; approval: number }
export interface Leader { ko: string; en: string; g: 'm' | 'f' }
export interface ParlSave {
  coalition: string[]; deal?: { key: string; until: string }; adj: Record<string, number>; low: Record<string, number>; refused: Record<string, string>;
  leaders: Record<string, Leader>; relation: number; lastTalk?: string; lastPoach?: string; lastDeal?: string; lastSeen?: string; lastDecay?: string;
  log: Array<{ date: string; text: string }>;
  /** 필리버스터로 계류 중인 법안(정책 버프 조합 열쇠 → 풀리는 날, 2026-11-03). 마법사를 닫았다 다시 짜도 같은 법안이면 기다린 시간이 이어진다. */
  pending?: Record<string, string>;
}
export const emptyParl = (): ParlSave => ({ coalition: [], adj: {}, low: {}, refused: {}, leaders: {}, relation: 0, log: [] });
export const facKey = (f: { fid?: number; name: string }) => (f.fid ? 'f' + f.fid : 'n:' + f.name);

/** 200석 배분(최대 잉여법). 파벌 지지율 합이 100보다 작으면 나머지는 무소속(key 'ind'). adj 로 탈당·빼오기를 반영(합은 200 유지). */
export function allocate(facs: Fac[], adj: Record<string, number> = {}): Array<{ key: string; seats: number }> {
  const sum = facs.reduce((a, f) => a + Math.max(0, f.support), 0);
  const parts = [...facs.map((f) => ({ key: f.key, share: Math.max(0, f.support) })), ...(sum < 100 ? [{ key: 'ind', share: 100 - sum }] : [])];
  const tot = parts.reduce((a, p) => a + p.share, 0) || 1;
  const raw = parts.map((p) => ({ key: p.key, q: (p.share / tot) * PARL.seats }));
  const out = raw.map((r) => ({ key: r.key, seats: Math.floor(r.q), rem: r.q - Math.floor(r.q) }));
  let left = PARL.seats - out.reduce((a, o) => a + o.seats, 0);
  for (const o of out.slice().sort((a, b) => b.rem - a.rem)) { if (left <= 0) break; o.seats++; left--; }
  // 의석 이동: 줄어드는 쪽은 0 밑으로 못 간다. 남거나 모자란 만큼은 무소속이 받는다.
  const res = out.map((o) => ({ key: o.key, seats: o.seats }));
  let ind = res.find((r) => r.key === 'ind'); if (!ind) { ind = { key: 'ind', seats: 0 }; res.push(ind); }
  const moves = Object.entries(adj).filter(([k, d]) => k !== 'ind' && d).sort((x, y) => x[1] - y[1]); // 빠지는 쪽 먼저(무소속으로), 그다음 들어오는 쪽(무소속에서)
  for (const [k, d] of moves) { const r = res.find((x) => x.key === k); if (!r) continue; const take = d > 0 ? Math.min(d, ind.seats) : -Math.min(-d, r.seats); r.seats += take; ind.seats -= take; }
  return res.filter((r) => r.seats > 0 || r.key !== 'ind');
}
/** 여당 파벌. */
export function rulingKey(facs: Fac[], empireEth: number | undefined): string | null {
  if (!facs.length) return null;
  const same = empireEth !== undefined ? facs.filter((f) => ETHIC_BITS[f.ethic] && (empireEth & ETHIC_BITS[f.ethic]) !== 0) : [];
  const pool = same.length ? same : facs;
  return pool.slice().sort((a, b) => (same.length ? b.support - a.support : b.approval - a.approval))[0].key;
}
export interface Chamber { seats: Array<{ key: string; name: string; ethic: string; seats: number; side: 'ruling' | 'coalition' | 'deal' | 'opposition' | 'ind' }>; gov: number; ruling: string | null; opp: string | null; majority: boolean }
/** 지금 의회 구성. */
export function chamber(facs: Fac[], s: ParlSave, empireEth: number | undefined, date: string): Chamber {
  const alloc = allocate(facs, s.adj), ruling = rulingKey(facs, empireEth);
  const deal = s.deal && monthsBetween(date, s.deal.until) > 0 ? s.deal.key : null;
  const seats = alloc.map((a) => {
    const f = facs.find((x) => x.key === a.key);
    const side: Chamber['seats'][number]['side'] = a.key === 'ind' ? 'ind' : a.key === ruling ? 'ruling' : s.coalition.includes(a.key) ? 'coalition' : a.key === deal ? 'deal' : 'opposition';
    return { key: a.key, name: f?.name ?? L('무소속', 'Independents'), ethic: f?.ethic ?? '', seats: a.seats, side };
  }).sort((a, b) => ['ruling', 'coalition', 'deal', 'ind', 'opposition'].indexOf(a.side) - ['ruling', 'coalition', 'deal', 'ind', 'opposition'].indexOf(b.side) || b.seats - a.seats);
  const gov = seats.filter((x) => x.side === 'ruling' || x.side === 'coalition' || x.side === 'deal').reduce((a, x) => a + x.seats, 0);
  const opp = seats.filter((x) => x.side === 'opposition').sort((a, b) => b.seats - a.seats)[0]?.key ?? null;
  return { seats, gov, ruling, opp, majority: gov >= PARL.majority };
}
/** 불신임 표결 보정: 정부 의석이 과반에서 얼마나 먼가(±). */
export const seatBonus = (gov: number) => Math.round((gov / PARL.seats * 100 - 50) * 0.6 * 10) / 10;

/** 연정 제안 수락 확률. 여당과 정반대 성향이면 어렵다. */
export function coalitionChance(f: Fac, rulingEthic: string, relation: number): number {
  let p = f.approval / 100 * 0.8 + 0.15 + relation / 400;
  if (OPPOSITE[rulingEthic] === f.ethic) p -= 0.45;
  return Math.max(0.05, Math.min(0.9, p));
}
/** 연정 파트너 불만(승인도 35 미만 석 달) → 파기. 바뀐 low 를 돌려준다. 깨진 파트너 목록. */
export function partnerTick(s: ParlSave, facs: Fac[]): string[] {
  const broke: string[] = [];
  for (const k of s.coalition) {
    const f = facs.find((x) => x.key === k); if (!f) { broke.push(k); continue; }
    s.low[k] = f.approval < PARL.breakLowApproval ? (s.low[k] ?? 0) + 1 : 0;
    if (s.low[k] >= PARL.breakMonths) broke.push(k);
  }
  s.coalition = s.coalition.filter((k) => !broke.includes(k)); for (const k of broke) delete s.low[k];
  return broke;
}
/** 해마다 의석 이동이 1석씩 원래대로. */
export function decayAdj(s: ParlSave, date: string): void {
  if (s.lastDecay && monthsBetween(s.lastDecay, date) < 12) return; s.lastDecay = date;
  for (const k of Object.keys(s.adj)) { const v = s.adj[k]; s.adj[k] = v > 0 ? v - 1 : v < 0 ? v + 1 : 0; if (!s.adj[k]) delete s.adj[k]; }
}
export type ParlEvent = { kind: 'defect_out'; from: string; n: number } | { kind: 'defect_in'; from: string; n: number } | { kind: 'rally' } | { kind: 'statement' };
/** 이번 달 원내 사건(4%): 지지율 낮으면 정부 쪽 의원 탈당, 야당 대표와 사이가 좋으면 야당 의원이 넘어옴, 사이가 나쁘면 장외 투쟁. */
export function rollEvent(c: Chamber, approval: number | null, relation: number, rng: () => number): ParlEvent | null {
  if (rng() >= PARL.eventChance) return null;
  const govSide = c.seats.filter((x) => x.side === 'ruling' || x.side === 'coalition').sort((a, b) => b.seats - a.seats)[0];
  const opp = c.opp;
  const a = approval ?? 50, r = rng();
  if (a < 35 && govSide && r < 0.5) return { kind: 'defect_out', from: govSide.key, n: 2 + Math.floor(rng() * 4) };
  if (relation >= 30 && opp && r < 0.6) return { kind: 'defect_in', from: opp, n: 2 + Math.floor(rng() * 3) };
  if (relation <= -20 && a < 50) return { kind: 'rally' };
  return { kind: 'statement' };
}
/** 영수회담(LLM). 야당 대표 한 사람과 말 5번까지. */
export function talkMessages(a: { empire: string; date: string; leader: string; faction: string; ethic: string; seats: number; gov: number; relation: number; approval: number | null; notes: string[] }, turns: Array<{ who: 'us' | 'them'; text: string }>, say: string): ChatMessage[] {
  const msgs: ChatMessage[] = [
    { role: 'system', content: [
      `Stellaris. You are ${a.leader}, leader of the opposition in the parliament of ${a.empire}: head of the ${a.faction} (${a.ethic || 'opposition'} faction, ${a.seats} of ${PARL.seats} seats). The government holds ${a.gov} seats. Date ${a.date}. You meet the head of government for a private leaders' summit.`,
      `Your current relationship with the head of government: ${a.relation} (-100 hostile … 100 cooperative). Public approval of the government: ${a.approval ?? '?'}%. Speak as a shrewd politician who defends your faction's ideals and voters; you can be won over by real concessions, but not by flattery or threats alone.`,
      ...(a.notes.length ? ['Earlier dealings: ' + a.notes.slice(-4).join(' | ')] : []),
      'Reply ONLY with JSON: {"reply":"what you say, 1-4 sentences","relation":-10..10,"note":"one short English line: what was agreed or what changed"}. relation = how this exchange changes your stance toward the government.',
    ].join('\n') },
  ];
  for (const t of turns) msgs.push(t.who === 'us' ? { role: 'user', content: t.text } : { role: 'assistant', content: JSON.stringify({ reply: t.text, relation: 0 }) });
  msgs.push({ role: 'user', content: say });
  return msgs;
}
export function parseTalk(raw: string): { reply: string; relation: number; note: string } | null {
  const t = String(raw ?? ''); const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null;
  try { const v = JSON.parse(t.slice(i, j + 1)) as Record<string, unknown>; const reply = String(v.reply ?? '').trim().slice(0, 900); if (!reply) return null; return { reply, relation: Math.max(-10, Math.min(10, Math.round(Number(v.relation)) || 0)), note: String(v.note ?? '').trim().slice(0, 160) }; } catch { return null; }
}
/** 파벌 수정자 명령(연정·거래·반감·스캔들). 회신 SLLM:CIVIC what=parl. */
export function parlCommand(req: number, sid: string, ops: Array<{ fid: number; mod: string; days: number; remove?: boolean }>, countryMod?: { mod: string; days: number }): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error(L('의회 명령 인자가 올바르지 않습니다.', 'Invalid parliament command arguments.'));
  const ok = ops.filter((o) => Number.isSafeInteger(o.fid) && o.fid > 0 && /^sllm_[a-z_]+$/.test(o.mod) && Number.isSafeInteger(o.days) && o.days > 0);
  const fac = ok.map((o) => ` every_pop_faction = { limit = { check_variable = { which = sllm_f_id value = ${o.fid} } } remove_modifier = ${o.mod}${o.remove ? '' : ` add_modifier = { modifier = ${o.mod} days = ${o.days} }`} }`).join('');
  const cm = countryMod && /^sllm_[a-z_]+$/.test(countryMod.mod) ? ` remove_modifier = ${countryMod.mod} add_modifier = { modifier = ${countryMod.mod} days = ${countryMod.days} }` : '';
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } }${cm}${fac} log = "SLLM:CIVIC/;/req=${req}/;/sid=${sid}/;/what=parl/;/status=applied" }`;
}
export function parlFacts(c: Chamber, s: ParlSave, leaderName: string): string[] {
  const r = c.seats.find((x) => x.key === c.ruling), o = c.seats.find((x) => x.key === c.opp);
  return [
    `Parliament (${PARL.seats} seats): government side ${c.gov}${c.majority ? ' (majority)' : ' (no majority)'}; ruling party ${r?.name ?? '?'} ${r?.seats ?? 0}; coalition ${c.seats.filter((x) => x.side === 'coalition').map((x) => x.name).join(', ') || 'none'}.`,
    ...(o ? [`Opposition leader: ${leaderName} of ${o.name} (${o.seats} seats); relationship with the government ${s.relation}.`] : []),
  ];
}
