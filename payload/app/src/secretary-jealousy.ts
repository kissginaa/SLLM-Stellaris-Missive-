// 비서의 서운함과 질투(22번 설계, 2026-10-23 집 PC 초안). 앱: src/features/secretary-app.ts(첫 보고 때 한 번), 사건: src/features/romance-app.ts.
// 사용자 확정: 호감만 → 서운함·외로움(숨은 연애 감정을 확정하지 않음) / 연애 감정 → 은근한 질투(말을 멈춤·시선 피함·축하 속 아쉬움) /
//   지금 통치자와 교제·혼인 중 → (2026-10-24 일부다처) 사소한 질투만, 대사 한 번으로 교제·혼인·이별 상태를 바꾸지 않는다.
// 비서가 실제로 알 수 있는 사건만: 약혼·결혼(공개), 결혼한 뒤 배우자와 함께한 나들이(공개된 부부). 교제 시작·결혼 전 데이트는 비공개라 모른다.
// 같은 사건에 한 번만(사건 ID), 부를 때 한 번만, 오래된 사건(반년 넘음)은 흘려보낸다. 업무를 방해하거나 상대를 깎아내리지 않는다. 호감 자동 감소·게임 효과 없음.
// 관계 대상은 그때의 통치자 인물(bond = 통치자별) — 통치자가 바뀌면 이전 감정은 넘어가지 않는다. LLM 호출을 따로 늘리지 않고 기존 비서 대화에 짧은 영어 지시로만 붙인다.
import { type Bond, AFF_FOND, AFF_CONFESS } from './secretary';
import { dayNo } from './gamedate';

export type JealousKind = 'engaged' | 'wedding' | 'outing';
export interface JealousEvent { id: string; kind: JealousKind; partner: string; date: string }
export interface JealousState { seen: string[]; pending: JealousEvent[]; lastOn?: string }
export type JealousTier = 'none' | 'wistful' | 'jealous' | 'hurt';
export const JEALOUS = { staleDays: 180, maxPending: 3, maxSeen: 60 } as const;

/** 감정의 깊이(22): 로맨스를 끈 경우·호감이 낮으면 반응 없음. 숫자 기준은 비서 기존 단계(호감 45 = fond, 75 = 고백 가능)를 쓴다. */
export function jealousTier(b: Bond | undefined, romance: boolean): JealousTier {
  if (!romance || !b) return 'none';
  if (b.lover || b.spouse) return 'hurt';
  if (b.aff >= AFF_CONFESS) return 'jealous';
  if (b.aff >= AFF_FOND) return 'wistful';
  return 'none';
}
const st = (b: Bond): JealousState => ((b as Bond & { jealous?: JealousState }).jealous ??= { seen: [], pending: [] });
/** 사건을 알게 됨: 같은 ID 는 한 번만. */
export function noteJealousEvent(b: Bond, ev: JealousEvent): boolean {
  const s = st(b); if (s.seen.includes(ev.id)) return false;
  s.seen = [...s.seen, ev.id].slice(-JEALOUS.maxSeen);
  s.pending = [...s.pending, { ...ev, partner: String(ev.partner ?? '').replace(/[\r\n<>"]/g, ' ').slice(0, 40) }].slice(-JEALOUS.maxPending);
  return true;
}
/** 이번에 꺼낼 사건(가장 최근·반년 이내). */
export function pickJealous(b: Bond | undefined, today: string): JealousEvent | null {
  if (!b) return null; const s = (b as Bond & { jealous?: JealousState }).jealous; if (!s?.pending.length) return null;
  const t = dayNo(today);
  const fresh = s.pending.filter((e) => { const d = dayNo(e.date); return t === null || d === null || t - d <= JEALOUS.staleDays; });
  return fresh.length ? fresh[fresh.length - 1] : null;
}
/** 대화가 성공적으로 끝난 뒤: 쌓인 사건을 모두 비운다(같은 사건으로 다시 반응하지 않게). */
export function consumeJealous(b: Bond | undefined, today: string): void {
  if (!b) return; const s = (b as Bond & { jealous?: JealousState }).jealous; if (!s) return;
  s.pending = []; s.lastOn = today;
}
const WHAT: Record<JealousKind, (p: string) => string> = {
  engaged: (p) => `the ruler's engagement to ${p}`,
  wedding: (p) => `the ruler's wedding to ${p}`,
  outing: (p) => `the ruler spending a day out with their spouse ${p}`,
};
/** 비서 대화 system 에 붙일 짧은 영어 지시(없으면 빈 문자열). */
export function jealousNote(b: Bond | undefined, romance: boolean, today: string): string {
  const tier = jealousTier(b, romance), ev = pickJealous(b, today); if (tier === 'none' || !ev) return '';
  const head = `[A private feeling — the official news you heard: ${WHAT[ev.kind](ev.partner)} (${ev.date})]`;
  const tail = 'Show it at most once in this conversation, in one short line or a small change of expression, then return to work. Do not disrupt the report, do not belittle or speak ill of the partner, and do not reveal anything private you could not know. Work advice stays accurate.';
  if (tier === 'wistful') return `${head}\nYou are fond of the ruler, but this is NOT romantic love and you must not reveal or imply hidden romantic feelings. Let a faint loneliness show — the ruler will have less time for these conversations. Offer sincere congratulations if fitting. pose: smile or think. ${tail}`;
  if (tier === 'jealous') return `${head}\nYou have feelings for the ruler that you have never confessed. You hide them behind extra politeness: a brief pause when the partner is mentioned, eyes lowered for a moment, congratulations with a trace of regret. Never confess or say "I am jealous" outright. pose: sad or think. ${tail}`;
  // 일부다처(2026-10-24 사용자 확정): 연인·배우자여도 사소한 질투만 — 상처·항의·관계 정리 대화로 잇지 않는다.
  return `${head}\nYou are the ruler's ${b?.spouse ? 'wife' : 'lover'}. Multiple partners are accepted in this realm, so this is not a betrayal. Let only a small, light pang of jealousy show — a little pout, a teasing remark, or asking for a bit more of the ruler's time. Do not protest, do not ask whether things are over, no hurt or coldness; your feelings and your relationship are unchanged. pose: smile or think. ${tail}`;
}

/** 통치자 연애 사건 알림(romance-app → secretary-app). 모듈끼리 서로 가져오지 않도록 여기서 잇는다. */
type Listener = (sid: string, rulerKey: string, ev: JealousEvent) => void;
const listeners: Listener[] = [];
export function onRulerRomanceEvent(fn: Listener): void { listeners.push(fn); }
export function emitRulerRomanceEvent(sid: string, rulerKey: string, ev: JealousEvent): void { for (const f of listeners) { try { f(sid, rulerKey, ev); } catch { /* 비서 쪽 실패는 연애 흐름을 막지 않는다 */ } } }
