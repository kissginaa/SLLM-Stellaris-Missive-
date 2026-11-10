// 함대 명명 건(2026-11-04 사용자): 함대가 처음 이기면 그 제독이 「함대에 이름을 붙이자」고 건의하고, 다음 내각 회의 안건 목록에 함께 올라온다.
// 순수 규칙 — 앱: src/features/fleetname-app.ts · 화면: ui/cabinet-fleetname.js(내각 회의실 스크린의 안건 목록 아래 「제독 건의」 카드)
// 사용자 확정: 의제(내각 회의) 안에서 다룬다 / 안건을 열 때만 LLM 이 제독 말투로 이름 후보 3개 + 까닭 / 채택·직접 짓기·기각 — 기각은 그냥 넘어감(효과 없음)
// 채택하면 게임 함대 이름이 바뀌고 신문(연대기)에 한 줄. 게임 효과(버프)는 없다.
import type { Battle } from './fleet';
import { dayNo } from './gamedate';

export interface FleetNameProp { id: string; lid: number; adm: string; fleet: string; enemy: string; sys: string; date: string; cands: Array<{ name: string; why: string }> | null }
export interface FleetNameBook { pending: FleetNameProp[]; seen: string[]; last: string }
export const FLEETNAME = { gapDays: 3 * 360, pendingMax: 3, nameMax: 40, whyMax: 140, cands: 3 } as const;
export const emptyFleetNameBook = (): FleetNameBook => ({ pending: [], seen: [], last: '' });
const keyOf = (b: { lid: number; fleet: string }) => b.lid + ':' + b.fleet;

/** 이 전투가 건의를 낳는가: 일반·몰락 제국 상대(kind 0) 우주전 승리, 그 제독·함대의 첫 승리(한 번만), 마지막 건의에서 3년이 지났고, 기다리는 건의가 3건 미만. */
export function proposalFrom(book: FleetNameBook, b: Battle): FleetNameProp | null {
  if (b.res !== 'won' || b.kind !== 0 || (b.type ?? 'space') !== 'space' || !b.fleet || !(b.lid > 0)) return null;
  const k = keyOf(b); if (book.seen.includes(k) || book.pending.some((p) => keyOf(p) === k) || book.pending.length >= FLEETNAME.pendingMax) return null;
  const a = book.last ? dayNo(book.last) : null, d = dayNo(b.date); if (a !== null && d !== null && d - a < FLEETNAME.gapDays) return null;
  return { id: k + ':' + b.date, lid: b.lid, adm: b.adm, fleet: b.fleet, enemy: b.enemy, sys: b.sys, date: b.date, cands: null };
}
export function addProposal(book: FleetNameBook, p: FleetNameProp): void { book.pending.push(p); book.seen.push(keyOf(p)); if (book.seen.length > 200) book.seen.splice(0, book.seen.length - 200); book.last = p.date; }

/** 게임에 보낼 함대 이름 다듬기(따옴표·괄호·게임 서식 문자·줄바꿈 제거). 비면 null. */
export function cleanFleetName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\r\n\t]+/g, ' ').replace(/["\\§£$\[\]{}<>|/;=#]/g, '').replace(/\s+/g, ' ').trim().slice(0, FLEETNAME.nameMax).trim();
  return s ? s : null;
}
/** 게임 명령: 우리 함대 가운데 지휘관이 lid 인 함대의 이름을 바꾼다. 못 찾으면 status=no_target. */
export function fleetNameCommand(req: number, sid: string, lid: number, name: string): string {
  const v = cleanFleetName(name);
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(lid) || lid < 1 || !v) throw new Error('INVALID_FLEETNAME');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_fn_ok value = 0 } every_owned_fleet = { limit = { exists = leader leader = { is_variable_set = sllm_lid check_variable = { which = sllm_lid value = ${lid} } } } set_name = "${v}" prev = { set_variable = { which = sllm_fn_ok value = 1 } } } if = { limit = { check_variable = { which = sllm_fn_ok value = 1 } } log = "SLLM:FLEETNAME/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/status=applied" } else = { log = "SLLM:FLEETNAME/;/req=${req}/;/sid=${sid}/;/lid=${lid}/;/status=no_target" } clear_variable = sllm_fn_ok }`;
}

/** 제독의 건의(AI 지시 영어, 응답 언어는 aiclient): 제독 말투로 이름 3개 + 짧은 까닭. JSON. */
export function fleetNameMessages(p: FleetNameProp, a: { empire: string; ethics: string[] }): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    `You are ${p.adm || 'the admiral'}, commanding the fleet "${p.fleet}" of the Stellaris empire "${a.empire || 'our empire'}". At the cabinet meeting you propose giving your fleet a proper name to honour its first victory.`,
    'Propose exactly 3 different fleet names (1-4 words, at most 30 characters each), fitting the victory and the empire. Do not reuse the current fleet name.',
    'For each, give one short reason in your own voice as you would say it to the ruler (at most 100 characters). Do not invent other battles or named heroes.',
    'Output only JSON: {"names": [{"name": "...", "why": "..."}, {"name": "...", "why": "..."}, {"name": "...", "why": "..."}]}',
  ].join('\n') }, { role: 'user', content: [`Current fleet name: ${p.fleet}`, p.enemy ? `Defeated: ${p.enemy}` : '', p.sys ? `Battle system: ${p.sys}` : '', p.date ? `Date: ${p.date}` : '', a.ethics.length ? `Empire ethics: ${a.ethics.join(', ')}` : ''].filter(Boolean).join('\n') }];
}
export function readFleetNames(raw: string, old: string): Array<{ name: string; why: string }> | null {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  const arr = j && typeof j === 'object' && Array.isArray((j as { names?: unknown }).names) ? (j as { names: unknown[] }).names : [];
  const out: Array<{ name: string; why: string }> = [];
  for (const x of arr) {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const name = cleanFleetName(o.name); if (!name || name === old || out.some((y) => y.name === name)) continue;
    out.push({ name, why: typeof o.why === 'string' ? o.why.replace(/\s+/g, ' ').trim().slice(0, FLEETNAME.whyMax) : '' }); if (out.length >= FLEETNAME.cands) break;
  }
  return out.length ? out : null;
}
