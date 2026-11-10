// 대립 긴장도(시나리오 전용 기능, 2026-11-05 사용자) — 순수 규칙. 앱: src/features/tension-app.ts · 화면: ui/office-tension.js
// 게임 쪽: tester-mod/common/scripted_effects/sllm_tension.txt(시나리오 모드가 sllm_tn_begin 을 불러야 켜짐).
// 두 거대 세력 A↔B 사이 긴장 0~100 하나. 단계 0 평온 · 1 냉랭 · 2 위기 · 3 동원 · 4 일촉즉발 · 5 개전 명분.

export type Pair = [string, string]; // [한국어, 영어]
export interface TnSide { idx: number; name: string }
export interface TnPoint { d: string; v: number }
export interface TnNote { d: string; kind: 'stage' | 'war' | 'peace' | 'shift' | 'incident'; ko: string; en: string }
export interface TnSave { on: boolean; a?: TnSide; b?: TnSide; v: number; st: number; date: string; war: boolean; hist: TnPoint[]; notes: TnNote[] }

export const TN = { keepHist: 1200, keepNotes: 200, maxShift: 30 };
export const STAGE: Pair[] = [['평온', 'Calm'], ['냉랭', 'Cold'], ['위기', 'Crisis'], ['동원', 'Mobilised'], ['일촉즉발', 'On the Brink'], ['개전 명분', 'Casus Belli']];
export const stageName = (st: number): Pair => STAGE[Math.max(0, Math.min(5, Math.round(st)))] || STAGE[0];
export function stageOf(v: number): number { return v >= 100 ? 5 : v >= 90 ? 4 : v >= 75 ? 3 : v >= 50 ? 2 : v >= 25 ? 1 : 0; }

export function fixSave(s: unknown): TnSave {
  const o = (s && typeof s === 'object' ? s : {}) as Partial<TnSave>;
  const side = (x: unknown): TnSide | undefined => { const y = x as TnSide; return y && typeof y.name === 'string' ? { idx: Number(y.idx) || 0, name: y.name } : undefined; };
  return {
    on: !!o.on, a: side(o.a), b: side(o.b), v: Number(o.v) || 0, st: Number.isFinite(Number(o.st)) ? Number(o.st) : 0, date: String(o.date || ''), war: !!o.war,
    hist: Array.isArray(o.hist) ? o.hist.filter((p) => p && typeof p.d === 'string' && Number.isFinite(Number(p.v))).map((p) => ({ d: p.d, v: Number(p.v) })).slice(-TN.keepHist) : [],
    notes: Array.isArray(o.notes) ? o.notes.filter((n) => n && typeof n.d === 'string' && typeof n.ko === 'string').slice(-TN.keepNotes) : [],
  };
}

const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/^\\/, '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown) => String(v ?? '').replace(/^\\/, '').trim().slice(0, 80);
const clampV = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** 한 달 값 기록(같은 달이면 덮어씀). */
export function pushPoint(s: TnSave, d: string, v: number): void {
  if (!d) return; const month = d.slice(0, 7), last = s.hist[s.hist.length - 1];
  if (last && last.d.slice(0, 7) === month) last.v = clampV(v); else s.hist.push({ d, v: clampV(v) });
  if (s.hist.length > TN.keepHist) s.hist.splice(0, s.hist.length - TN.keepHist);
}
export function note(s: TnSave, n: TnNote): void { s.notes.push(n); if (s.notes.length > TN.keepNotes) s.notes.splice(0, s.notes.length - TN.keepNotes); }

const nm = (s: TnSave, side: 'a' | 'b'): string => s[side]?.name || (side === 'a' ? 'A' : 'B');

export interface TnEvent { kind: 'stage-up' | 'stage-down' | 'war' | 'peace' | 'incident' | 'month'; st?: number; was?: number }
/** 로그 줄 하나를 적용하고, 알릴 만한 일이면 돌려준다. */
export function applyLine(s: TnSave, kind: string, kv: Record<string, string>): TnEvent | null {
  const d = str(kv.date);
  if (kind === 'TNN') {
    const side = str(kv.side) === 'b' ? 'b' : 'a', name = str(kv.name); if (!name) return null;
    s[side] = { idx: Math.round(num(kv.idx)), name }; s.on = true; return null;
  }
  if (kind === 'TN') {
    s.on = true; s.v = clampV(num(kv.v)); s.st = Math.round(num(kv.st)); if (d) s.date = d; pushPoint(s, d, s.v);
    if (Math.round(num(kv.inc)) === 1) { note(s, { d, kind: 'incident', ko: `${nm(s, 'a')}와(과) ${nm(s, 'b')}의 국경에서 마찰이 있었다(+3).`, en: `Friction on the border between ${nm(s, 'a')} and ${nm(s, 'b')} (+3).` }); return { kind: 'incident' }; }
    return { kind: 'month' };
  }
  if (kind === 'TNST') {
    const st = Math.round(num(kv.st)), was = Math.round(num(kv.was)); s.on = true; s.st = st; s.v = clampV(num(kv.v)); if (d) s.date = d;
    if (was < 0 || st === was) return null;
    const [ko, en] = stageName(st);
    note(s, { d, kind: 'stage', ko: `긴장이 「${ko}」 단계로 ${st > was ? '올랐다' : '내려왔다'}(${s.v}).`, en: `Tension ${st > was ? 'rose' : 'fell'} to "${en}" (${s.v}).` });
    return { kind: st > was ? 'stage-up' : 'stage-down', st, was };
  }
  if (kind === 'TNWAR') { s.on = true; s.war = true; note(s, { d, kind: 'war', ko: `${nm(s, 'a')}와(과) ${nm(s, 'b')}이(가) 전쟁에 들어갔다.`, en: `${nm(s, 'a')} and ${nm(s, 'b')} have gone to war.` }); return { kind: 'war' }; }
  if (kind === 'TNPEACE') { s.on = true; s.war = false; note(s, { d, kind: 'peace', ko: `${nm(s, 'a')}와(과) ${nm(s, 'b')}의 전쟁이 끝났다. 긴장은 70에서 다시 시작한다.`, en: `The war between ${nm(s, 'a')} and ${nm(s, 'b')} has ended. Tension restarts at 70.` }); return { kind: 'peace' }; }
  return null;
}

/** 알림 문구. */
export function eventText(s: TnSave, e: TnEvent): { title: Pair; body: Pair } | null {
  const a = nm(s, 'a'), b = nm(s, 'b');
  if (e.kind === 'stage-up' || e.kind === 'stage-down') {
    const [ko, en] = stageName(e.st ?? s.st);
    return e.kind === 'stage-up'
      ? { title: [`긴장 고조: ${ko}`, `Tension rising: ${en}`], body: [`${a}와(과) ${b} 사이의 긴장이 ${s.v}에 이르러 「${ko}」 단계가 되었습니다.`, `Tension between ${a} and ${b} has reached ${s.v}: "${en}".`] }
      : { title: [`긴장 완화: ${ko}`, `Tension easing: ${en}`], body: [`${a}와(과) ${b} 사이의 긴장이 ${s.v}로 내려와 「${ko}」 단계가 되었습니다.`, `Tension between ${a} and ${b} has fallen to ${s.v}: "${en}".`] };
  }
  if (e.kind === 'war') return { title: ['거대 세력 개전', 'The great powers are at war'], body: [`${a}와(과) ${b}이(가) 전쟁에 들어갔습니다.`, `${a} and ${b} have gone to war.`] };
  if (e.kind === 'peace') return { title: ['거대 세력 종전', 'The great powers make peace'], body: [`${a}와(과) ${b}의 전쟁이 끝났습니다. 긴장은 70에서 다시 시작합니다.`, `The war between ${a} and ${b} is over. Tension restarts at 70.`] };
  return null;
}

/** LLM 프롬프트에 넣는 한 줄(영어). 켜져 있지 않으면 빈 문자열. */
export function promptLine(s: TnSave | null | undefined): string {
  if (!s || !s.on || !s.a || !s.b) return '';
  const [, en] = stageName(s.st);
  const trend = (() => { const h = s.hist; if (h.length < 4) return ''; const d = h[h.length - 1].v - h[h.length - 4].v; return d >= 5 ? ' and rising' : d <= -5 ? ' and easing' : ' and holding'; })();
  return `[Great-power tension] Tension between ${s.a.name} and ${s.b.name} is ${s.v}/100 (${en})${trend}${s.war ? '; they are at war' : ''}.`;
}

// ---- 게임 명령(플레이어 범위에서 부름) ----
const okN = (n: number) => Number.isInteger(n) && n >= 0 && n < 1e9;
export function tnWrap(sid: string, body: string): string {
  if (!/^\d+$/.test(sid)) throw new Error('INVALID_TN');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;
}
/** 긴장 더하기·빼기. 회신 TNADD ok(1 적용) v(지금 값). */
export function shiftCommand(req: number, sid: string, n: number): string {
  if (!okN(req) || !Number.isInteger(n) || n === 0 || Math.abs(n) > TN.maxShift) throw new Error('INVALID_TN');
  return tnWrap(sid, `sllm_tn_add = { REQ = ${req} N = ${n} }`);
}
/** 지금 값 묻기(이름 줄·TN 줄이 함께 옴). 끝 줄 TNQ ok. */
export function queryCommand(req: number, sid: string): string { if (!okN(req)) throw new Error('INVALID_TN'); return tnWrap(sid, `sllm_tn_query = { REQ = ${req} }`); }
