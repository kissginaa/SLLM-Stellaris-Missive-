// 총독 약속 국가 문서(알파 11, 2026-10-25, 설계 §8-1·§8-3 A+B). 순수 규칙. 앱: src/features/gc-app.ts, 문서: src/state-docs.ts(pledge).
// 사용자 확정: 어기면 그 총독 호감 −10·충성 −15, 지키면 호감 +3·충성 +5. 기한 없는 약속은 2년 안에 진전이 없으면 불이행.
// 약속은 총독회의의 「우선 지원·조건부 지원」 결정(gcDecide)으로 생긴다 — 통치자가 직접 누른 것이라 AI 가 약속을 짐작해 뽑을 필요가 없다(B 는 이것으로 대신).
// 이행 판정은 게임 자료(행성 주거·편의·안정도)로만, AI 판단 없음. 자료로 판정할 수 없는 분야(개발 투자)는 「기록만」 — 호감·충성 영향 없음.
// 호감 = 인물 기억(persona-app)의 신뢰(−100~100). 충성 = 총독회의 장부의 총독별 값(0~100, 처음 50) — 회의 발언·참석 태도에 쓰인다.
import { addYears, cmpDate } from './gamedate';
import { L } from './i18n-pick';
import type { GovernorRequest } from './governor-council';

export const PLEDGE = { kept: { trust: 3, loyal: 5 }, broken: { trust: -10, loyal: -15 }, noDueYears: 2, loyalDefault: 50 } as const;
export const JUDGEABLE: readonly string[] = ['housing', 'amenities', 'order'];
export const judgeable = (field: string): boolean => JUDGEABLE.includes(field);
export const clampLoyal = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** 이행 기한: 정해진 기한이 있으면 그것, 없으면 약속일 + 2년. 판정할 수 없는 분야는 기한 없음. */
export function pledgeDue(r: Pick<GovernorRequest, 'field' | 'due' | 'promisedOn'>): string | undefined {
  if (!judgeable(r.field)) return undefined;
  return r.due || (r.promisedOn ? addYears(r.promisedOn, PLEDGE.noDueYears) : undefined);
}
/** 불이행: 판정할 수 있는 약속이 기한을 넘겼고 아직 이루어지지 않음. */
export function pledgeBroken(r: GovernorRequest, today: string): boolean {
  if (r.state !== 'promised' || !judgeable(r.field)) return false;
  const due = pledgeDue(r); return !!due && !!today && cmpDate(today, due) > 0;
}
/** 문서 조항(틀 문장, 화면 언어로 열 때마다 만든다). */
export function pledgeClauses(field: string, planet: string, governor: string): string[] {
  const p = planet || L('해당 행성', 'the planet'), g = governor || L('담당 총독', 'the governor');
  const goal: Record<string, [string, string]> = {
    housing: [`「${p}」의 주거 부족을 해소하여 주거 여유를 0 이상으로 만든다.`, `Relieve the housing shortage on "${p}" so that free housing is zero or more.`],
    amenities: [`「${p}」의 편의 시설 부족을 해소하여 편의 여유를 0 이상으로 만든다.`, `Relieve the amenities shortage on "${p}" so that free amenities are zero or more.`],
    order: [`「${p}」의 치안과 안정을 회복하여 안정도를 50 이상으로 만든다(단일 의식 제국은 이탈도 30 미만까지).`, `Restore order on "${p}" so that stability is 50 or more (for a gestalt empire, deviancy also below 30).`],
    development: [`「${p}」의 개발에 투자한다.`, `Invest in the development of "${p}".`],
  };
  const g0 = goal[field] ?? [`「${p}」의 요구를 지원한다.`, `Support the request of "${p}".`];
  return judgeable(field)
    ? [L(`통치자는 ${g}의 요구에 따라 다음을 약속한다. ${g0[0]}`, `At the request of ${g}, the ruler pledges the following. ${g0[1]}`),
      L(`이행 여부는 제국 행정 기록(행성 자료)으로 판정한다. 기한 안에 이루어지면 이행, 넘기면 불이행으로 기록한다.`, `Fulfilment is judged from the imperial administrative record (planet data). Met before the deadline it is recorded as fulfilled; past the deadline, as broken.`),
      L(`이행 시 ${g}의 통치자에 대한 호감과 충성이 오르고, 불이행 시 크게 떨어진다.`, `If fulfilled, ${g}'s regard for and loyalty to the ruler rise; if broken, they fall sharply.`)]
    : [L(`통치자는 ${g}의 요구에 따라 다음을 약속한다. ${g0[0]}`, `At the request of ${g}, the ruler pledges the following. ${g0[1]}`),
      L('이 분야는 행정 기록으로 이행을 판정할 수 없어 기록으로만 남긴다. 호감·충성에는 영향이 없다.', 'This field cannot be judged from the administrative record, so it is kept as a record only. It does not affect regard or loyalty.')];
}
/** 총독회의 발언 프롬프트(영어): 충성과 통치자가 한 약속의 이력. */
export function loyaltyLine(n: number | undefined): string {
  if (n === undefined) return '';
  const lv = n >= 75 ? 'devoted' : n >= 55 ? 'loyal' : n >= 40 ? 'dutiful but reserved' : n >= 20 ? 'doubtful' : 'resentful and disloyal';
  return `Your loyalty to the ruler: ${n}/100 (${lv}). Let it shape how much you trust the ruler's word and how openly you defer or object.`;
}
export function promisesLine(list: { field: string; planet: string; state: string }[]): string {
  const rows = list.slice(-6).map((p) => `- ${p.field} for ${p.planet}: ${p.state === 'observed_fulfilled' ? 'kept' : p.state === 'broken' ? 'BROKEN' : p.state === 'promised' ? 'still pending' : p.state}`);
  return rows.length ? `[Promises the ruler made to you at past councils]\n${rows.join('\n')}\nRemember them: a broken promise makes you skeptical of new ones; a kept one earns some goodwill.` : '';
}

/** 비서가 「물어볼 때만」 답하는 약속 기한(사용자 결정 2026-10-25: 알림으로 먼저 오지 않는다). 질문에 약속·기한·총독 낱말이 있을 때만 자료를 넣는다. */
export const asksPledges = (text: string): boolean => /약속|기한|마감|총독|공약|promise|pledge|deadline|governor|commitment/i.test(text || '');
export function pledgeReport(list: Pick<GovernorRequest, 'planet' | 'field' | 'state' | 'due' | 'promisedOn' | 'fulfilledOn' | 'brokenOn'>[], gov: (r: unknown) => string, today: string, dayOf: (d: string) => number | null): string {
  const now = dayOf(today), open = list.filter((r) => r.state === 'promised'), done = list.filter((r) => r.state === 'observed_fulfilled' || r.state === 'broken').slice(-4);
  if (!open.length && !done.length) return '[Promises to governors] None on record. If asked, say there are no open council promises.';
  const left = (d?: string) => { const n = d && now !== null ? dayOf(d) : null; return n === null || now === null ? '' : n - now >= 0 ? ` — ${n - now} days left` : ' — overdue'; };
  const row = (r: (typeof list)[number]) => `- ${gov(r)} / ${r.planet} / ${r.field}: ${r.state === 'promised' ? (judgeable(r.field) ? `deadline ${pledgeDue(r) ?? 'unknown'}${left(pledgeDue(r))}` : 'record only (cannot be judged from data)') : r.state === 'broken' ? `BROKEN on ${r.brokenOn ?? '?'}` : `kept on ${r.fulfilledOn ?? '?'}`}`;
  return `[Promises to governors — the ruler asked, so answer from this list only; most urgent first]\n${[...open.sort((a, b) => (dayOf(pledgeDue(a) ?? '9999.12.30') ?? 0) - (dayOf(pledgeDue(b) ?? '9999.12.30') ?? 0)), ...done].map(row).join('\n')}\nPromises are judged monthly from planet data (housing ≥ 0, amenities ≥ 0, stability ≥ 50). Breaking one costs that governor's regard and loyalty sharply.`;
}
