// 회랑 무역로(시나리오 전용, 순수 규칙, 2026-11-06 사용자: 「회랑 무역로 아이콘 — 무역 관세·집중 단속 등을 관리, 두 거대 세력이 반응하게」).
// 게임 쪽: 시나리오 모드 common/scripted_effects/sllm_cr_trade_effects.txt(sllm_cr_tr_set · 관세 TOLL · 출항 빈도 · 호감 수정자).
// 앱: src/features/scenario-trade-app.ts · 화면: ui/office-trade.js(집무실 「회랑의 삼파전」 칸)
// 관세 단계: 0 낮음 · 1 보통 · 2 높음 · 3 징벌 · 4 통항 금지(그 나라 배는 회랑을 지나지 않는다).
// 집중 단속: 매달 에너지 −20, 국경 너머 출항 −10%p, 두 나라 호감 −10 — 대신 관세를 낸 배마다 밀수 적발 판정(벌금).
export type TSide = 'a' | 'b';
export const TOLL = [15, 25, 40, 60, 0] as const;          // 게임 sllm_cr_fr_pay 와 같게
export const TR = { crackCost: 20, catchChance: 0.1, fine: 60, restDays: 180, keepLog: 40, keepYears: 8, keepSeen: 400 };

export interface YearRow { a: { n: number; e: number }; b: { n: number; e: number }; caught: number; fines: number }
export interface TradeLog { d: string; side: TSide; sys: string; toll: number; caught?: boolean }
export interface TradeSave { v: 1; lv: Record<TSide, number>; crack: boolean; changed: { a?: string; b?: string; crack?: string }; years: Record<string, YearRow>; log: TradeLog[]; seen: string[] }

export const newTradeSave = (): TradeSave => ({ v: 1, lv: { a: 1, b: 1 }, crack: false, changed: {}, years: {}, log: [], seen: [] });
const lvOk = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 4;
export function fixTradeSave(o: unknown): TradeSave {
  const s = (o && typeof o === 'object' ? o : {}) as Partial<TradeSave>, out = newTradeSave();
  if (s.lv && typeof s.lv === 'object') for (const k of ['a', 'b'] as TSide[]) if (lvOk(s.lv[k])) out.lv[k] = s.lv[k];
  out.crack = s.crack === true;
  if (s.changed && typeof s.changed === 'object') for (const k of ['a', 'b', 'crack'] as const) { const v = (s.changed as Record<string, unknown>)[k]; if (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v)) out.changed[k] = v; }
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  if (s.years && typeof s.years === 'object') for (const [y, r] of Object.entries(s.years)) if (/^\d+$/.test(y) && r && typeof r === 'object') { const x = r as YearRow; out.years[y] = { a: { n: num(x.a?.n), e: num(x.a?.e) }, b: { n: num(x.b?.n), e: num(x.b?.e) }, caught: num(x.caught), fines: num(x.fines) }; }
  const ys = Object.keys(out.years).sort(); for (const y of ys.slice(0, Math.max(0, ys.length - TR.keepYears))) delete out.years[y];
  if (Array.isArray(s.log)) out.log = s.log.filter((l) => l && typeof l.d === 'string' && (l.side === 'a' || l.side === 'b')).map((l) => ({ d: l.d, side: l.side, sys: String(l.sys || '').slice(0, 60), toll: num(l.toll), ...(l.caught ? { caught: true } : {}) })).slice(-TR.keepLog);
  if (Array.isArray(s.seen)) out.seen = s.seen.filter((x) => typeof x === 'string').slice(-TR.keepSeen);
  return out;
}

/** 게임 날짜 → 대략의 날 수(정책 변경 쉬는 기간 계산용). */
export function dayOf(d: string): number { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : 0; }
/** 같은 정책(나라별 관세·단속)은 반년에 한 번만 바꾼다. 안 되면 다시 바꿀 수 있는 대략의 날 수. */
export function restLeft(sv: TradeSave, key: TSide | 'crack', today: string): number {
  const c = sv.changed[key]; if (!c) return 0; const left = dayOf(c) + TR.restDays - dayOf(today); return left > 0 ? left : 0;
}

export type LetterKind = 'raise' | 'punish' | 'ban' | 'lower' | 'lift';
/** 관세를 바꿀 때 두 나라의 반응: 그 나라의 항의·감사 서신 + 긴장 변화(편들기). */
export function reactions(old: Record<TSide, number>, next: Record<TSide, number>, side: TSide): { letter: LetterKind | null; tension: number } {
  const o = old[side], n = next[side];
  let letter: LetterKind | null = null;
  if (n > o) letter = n >= 4 ? 'ban' : n === 3 ? 'punish' : n === 2 ? 'raise' : null;
  else if (n < o) letter = o >= 4 ? 'lift' : o >= 2 ? 'lower' : null;
  let tension = 0;
  if (n >= 4 && o < 4) tension += 3;                          // 한쪽만 막으면 다른 쪽을 돕는 셈
  const gapOld = Math.abs(old.a - old.b), gapNew = Math.abs(next.a - next.b);
  if (gapNew >= 2 && gapOld < 2) tension += 2;                // 차별 관세가 눈에 띄게 벌어짐
  else if (gapNew < 2 && gapOld >= 2) tension -= 1;           // 다시 고르게
  return { letter, tension };
}

function hash01(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }
/** 단속 중 관세를 낸 배의 밀수 적발(같은 배·날짜면 늘 같은 답). */
export const caughtRoll = (sid: string, key: string): boolean => hash01(`${sid}:trcatch:${key}`) < TR.catchChance;

/** 게임 명령(콘솔): 관세 단계와 단속을 한 번에. */
export function setCommand(a: number, b: number, crack: boolean): string {
  if (!lvOk(a) || !lvOk(b)) throw new Error('INVALID_TR');
  return `effect sllm_cr_tr_set = { A = ${a} B = ${b} C = ${crack ? 1 : 0} }`;
}
/** 벌금은 플레이어(회랑) 국고로. */
export const fineCommand = (n: number): string => { if (!Number.isInteger(n) || n <= 0 || n > 10000) throw new Error('INVALID_TR'); return `effect every_playable_country = { limit = { is_ai = no } add_resource = { energy = ${n} } }`; };

const clean = (v: unknown) => String(v ?? '').replace(/^\\+/, '').trim();
/** 게임 줄 SLLM:SCNTRADE(ev=toll|arrive) 읽기. from 1 얼라이언스 · 2 제국 · 3 회랑. */
export function parseTrade(kv: Record<string, unknown>): { ev: string; side: TSide | null; date: string; sys: string; id: string } {
  const f = Math.round(Number(clean(kv.from))), id = String(Math.round(Number(clean(kv.id))) || 0); return { ev: clean(kv.ev), side: f === 1 ? 'a' : f === 2 ? 'b' : null, date: clean(kv.date), sys: clean(kv.sys).slice(0, 60), id };
}
/** 관세를 낸 배 한 척 기록. 같은 줄을 두 번 읽으면(로그 다시 읽기) 무시. 적발이면 true. */
export function recordToll(sv: TradeSave, sid: string, p: { side: TSide; date: string; sys: string; id: string }): { added: boolean; caught: boolean; toll: number } {
  const key = p.id !== '0' ? `${p.side}#${p.id}` : `${p.date}|${p.sys}|${p.side}`; // 배 번호(게임이 나라마다 매김)가 있으면 그것으로
  if (sv.seen.includes(key)) return { added: false, caught: false, toll: 0 };
  sv.seen.push(key); if (sv.seen.length > TR.keepSeen) sv.seen.splice(0, sv.seen.length - TR.keepSeen);
  const y = (/^(\d+)/.exec(p.date) || [])[1] || '0', row = (sv.years[y] ??= { a: { n: 0, e: 0 }, b: { n: 0, e: 0 }, caught: 0, fines: 0 });
  const lv = sv.lv[p.side], toll = TOLL[lv >= 4 ? 1 : lv]; // 금지 직전에 떠난 배는 보통 관세(게임과 같게)
  row[p.side].n++; row[p.side].e += toll;
  const caught = sv.crack && caughtRoll(sid, key);
  if (caught) { row.caught++; row.fines += TR.fine; }
  sv.log.push({ d: p.date, side: p.side, sys: p.sys, toll, ...(caught ? { caught: true } : {}) }); if (sv.log.length > TR.keepLog) sv.log.splice(0, sv.log.length - TR.keepLog);
  return { added: true, caught, toll };
}
