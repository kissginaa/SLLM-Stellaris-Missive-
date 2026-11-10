// 공동 대응 협약(알파 11, 2026-10-25, 위기 제안 5번 — 사용자 「일단 제안대로 가보고 후에 생각해보지」). 순수 규칙. 앱: src/features/crisis-pact-app.ts, 모드: tester-mod/common/scripted_effects/sllm_crisis_pact.txt.
// 은하를 적대하는 위기(세타나는 전쟁 뒤에만)가 진행 중일 때 대화에서 일반 AI 제국과 맺는다. 받아들일지는 그 대화의 AI 가 정하고(추가 LLM 호출 없음), 플레이어가 수락하면 게임에 넣는다.
// 수치(사용자 확정 2026-10-25): 서로의 호감 +30, 양쪽 함선 화력 +5%(위기 동안), 감사 +3/분기, 협약 중 전쟁(배신) 원한 +40(한 번), 동시에 3개까지.
// 위기가 모두 끝나면 협약도 끝나고, 함께한 제국은 위기 극복 기록에 이름이 남는다.
import { wrapForPlayer } from './protocol';
import type { Emotions } from './emotions';

export const PACT = { opinion: 30, fireRate: 0.05, gratitude: 3, betrayGrudge: 40, max: 3 } as const;
export interface Pact { idx: number; name: string; since: string }
export interface PactSave { pacts: Pact[]; /** 이번 위기 시대에 협약을 맺었던 제국(배신한 나라는 뺀다) */ allies: { idx: number; name: string }[] }
export const emptyPacts = (): PactSave => ({ pacts: [], allies: [] });

export const hasPact = (s: PactSave, idx: number): boolean => s.pacts.some((p) => p.idx === idx);
/** 맺을 수 있는가: 적대 위기 진행 중 · 일반 제국 · 우리와 전쟁 중이 아님 · 아직 협약 없음 · 3개 미만. */
export function canPact(s: PactSave, idx: number, o: { hostile: boolean; type?: string; war?: boolean }): boolean {
  return o.hostile && o.type === 'default' && !o.war && idx > 0 && !hasPact(s, idx) && s.pacts.length < PACT.max;
}
export function addPact(s: PactSave, idx: number, name: string, date: string): boolean {
  if (hasPact(s, idx) || s.pacts.length >= PACT.max) return false;
  s.pacts.push({ idx, name: name.slice(0, 100), since: date.slice(0, 12) });
  const a = s.allies.find((x) => x.idx === idx); if (a) a.name = name.slice(0, 100); else s.allies.push({ idx, name: name.slice(0, 100) });
  return true;
}
/** 배신: 협약을 지우고 함께한 제국 목록에서도 뺀다. */
export function breakPact(s: PactSave, idx: number): Pact | null {
  const p = s.pacts.find((x) => x.idx === idx); if (!p) return null;
  s.pacts = s.pacts.filter((x) => x.idx !== idx); s.allies = s.allies.filter((x) => x.idx !== idx);
  return p;
}
/** 위기가 끝남: 모든 협약을 마치고 함께한 제국 이름을 돌려준 뒤 비운다. */
export function endAll(s: PactSave): { ended: Pact[]; allies: string[] } {
  const ended = s.pacts, allies = s.allies.map((a) => a.name);
  s.pacts = []; s.allies = [];
  return { ended, allies };
}

export function makeCommand(req: number, idx: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !Number.isSafeInteger(idx) || idx < 1) throw new Error('INVALID_PACT');
  return wrapForPlayer(`sllm_crisis_pact_make = { REQ = ${req} TID = ${idx} }`);
}
export function endCommand(idx: number): string {
  if (!Number.isSafeInteger(idx) || idx < 1) throw new Error('INVALID_PACT');
  return wrapForPlayer(`save_event_target_as = sllm_player sllm_crisis_pact_end = { TID = ${idx} }`);
}

/** 대화 프롬프트(영어). 협약 중이면 그 사실, 맺을 수 있으면 제안 방법과 속마음. 아니면 빈 글. */
export function pactLine(state: 'active' | 'offer' | 'none', o: { score: number; e?: Emotions } = { score: 0 }): string {
  if (state === 'active') return '[Joint crisis response pact] You and they are bound by a joint crisis response pact against the galactic crisis. You stand together until it is over; speak as an ally in this fight. Declaring war on them would be a betrayal.';
  if (state !== 'offer') return '';
  const g = o.e?.grudge ?? 0, lean = o.score >= 20 && g < 40 ? 'favorable' : o.score <= -20 || g >= 40 ? 'unfavorable' : 'undecided';
  return `[Joint crisis response pact] Because of the galactic crisis, a joint crisis response pact is possible between you: mutual goodwill and sharper fleets against the crisis until it ends. Only if they propose it, or if your personality would make you propose it yourself, and you are willing, set action to {"type":"crisis_pact"} and phrase it as an offer. Your private leaning is "${lean}". If you are unwilling, refuse in words and use no action.`;
}

export function sanitizePacts(v: unknown): PactSave {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, s = emptyPacts();
  const name = (x: unknown) => (typeof x === 'string' ? x.replace(/[\r\n\u0000-\u001f]/g, ' ').trim().slice(0, 100) : '');
  if (Array.isArray(o.pacts)) for (const p of o.pacts) if (p && Number.isSafeInteger(p.idx) && p.idx > 0 && !hasPact(s, p.idx) && s.pacts.length < PACT.max) s.pacts.push({ idx: p.idx, name: name(p.name), since: typeof p.since === 'string' ? p.since.slice(0, 12) : '' });
  if (Array.isArray(o.allies)) for (const a of o.allies.slice(0, 40)) if (a && Number.isSafeInteger(a.idx) && a.idx > 0 && !s.allies.some((x) => x.idx === a.idx)) s.allies.push({ idx: a.idx, name: name(a.name) });
  return s;
}
