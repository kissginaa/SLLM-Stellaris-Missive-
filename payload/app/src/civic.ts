// 시민 정치(2026-11-03 사용자 결정): ① 여론조사 ② 국민투표 ③ 특별사면. 순수 로직만 둔다(LLM 없음 — 틀 문장과 앱 주사위).
// 앱: features/civic-app.ts(여론조사·특별사면·국민투표 기록), 국민투표 흐름은 features/policy-app.ts(정책 선포 단계), 화면: ui/office-civic.js · ui/office-policy.js.
// 모드: common/static_modifiers/sllm_civic_modifiers.txt, 회신 SLLM:CIVIC.
// 정부 형태(모드 auth): 1 민주 2 과두 3 독재 4 제정 5 기업 6 군체 7 기계 0 모름.
//  - 자유(민주·과두·기업·모름): 여론조사는 실제 수치, 국민투표는 진짜 표결.
//  - 권위(독재·제정): 「관제 조사」(늘 80% 이상, 실제 수치는 비서만 앎), 「요식 투표」(늘 통과, 민심 효과 없음, 외국 언론이 비웃음).
//  - 단일 의식(군체·기계): 세 기능 모두 없음.
import { L } from './i18n-pick';

export type CivicRegime = 'free' | 'sham' | 'none';
export function civicRegime(auth: number | null | undefined, gestalt: boolean): CivicRegime {
  if (gestalt || auth === 6 || auth === 7) return 'none';
  if (auth === 3 || auth === 4) return 'sham';
  return 'free';
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ym = (d: string): number => { const m = /^(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN; };
const dayNo = (d: string): number => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + Number(m[3]) - 1 : NaN; };

// ── ① 여론조사 ──
/** 3개월마다(1·4·7·10월 첫 상황). 신문사 편향은 PAPERS 순서(보수·진보·중립)대로, 오차는 ±3. */
export const POLL = { everyMonths: 3, paperBias: [2, -3, 0], noise: 3, shamFloor: 80, keep: 12 } as const;
export interface PollPaper { paper: number; value: number }
/** 정당(파벌)별 지지율(2026-11-03 여당·야당): side = 의회 진영(ruling·coalition·deal·opposition), 없으면 의회 정보 없음. key 'none' = 지지 정당 없음. */
export interface PollParty { key: string; name: string; ethic: string; v: number; side?: string }
export interface Poll { date: string; real: number; shown: number; papers: PollPaper[]; sham: boolean; good: string[]; bad: string[]; parties?: PollParty[] }
/** 정당 지지율: 파벌 지지율(0~1) × 100 ± 2(오차), 나머지는 「지지 정당 없음」. 자유 정부만(관제 조사는 정당 지지율을 내지 않는다). */
export function pollParties(facs: Array<{ key: string; name: string; ethic: string; support: number; side?: string }>, rng: () => number): PollParty[] {
  const out: PollParty[] = facs.filter((f) => f.name && f.support > 0).map((f) => ({ key: f.key, name: f.name, ethic: f.ethic, v: Math.round(clamp(f.support * 100 + (rng() * 2 - 1) * 2, 0.5, 99)), ...(f.side ? { side: f.side } : {}) }));
  if (!out.length) return [];
  out.sort((a, b) => b.v - a.v); const top = out.slice(0, 8), sum = top.reduce((a, p) => a + p.v, 0);
  if (sum < 100) top.push({ key: 'none', name: '', ethic: '', v: 100 - sum });
  return top;
}
const partyLine = (p: Poll) => (p.parties && p.parties.length ? ' Party support: ' + p.parties.map((x) => `${x.key === 'none' ? 'no party' : x.name}${x.side === 'ruling' ? ' (ruling)' : x.side === 'coalition' ? ' (coalition)' : x.side === 'opposition' ? ' (opposition)' : ''} ${x.v}%`).join(', ') + '.' : '');
/** 이번 달이 조사 달인가(1·4·7·10월). */
export function pollMonth(date: string): boolean { const m = /^\d+\.(\d+)/.exec(date || ''); return !!m && (Number(m[1]) - 1) % POLL.everyMonths === 0; }
/** 같은 달에 이미 했으면 다시 하지 않는다. */
export function pollDue(polls: Poll[], date: string): boolean { if (!pollMonth(date)) return false; const k = ym(date); return !polls.some((p) => ym(p.date) === k); }
export interface PollParts { stability: number | null; approval: number | null; warPenalty: number; unrestPenalty: number; eventAdj: number }
/** 정부가 잘하는 일 / 못하는 일(민심 구성 요소로 고른다). 열쇠는 ISSUE 표의 이름. */
export const ISSUE: Record<string, [string, string]> = {
  order: ['치안과 질서', 'Law and order'], unrest: ['불안한 행성 관리', 'Handling restless worlds'], harmony: ['파벌 화합', 'Keeping the factions together'],
  factions: ['파벌 갈등', 'Faction infighting'], war: ['전쟁 수행', 'Conduct of the war'], peace: ['평화 유지', 'Keeping the peace'],
  wins: ['최근 국정 성과', 'Recent achievements'], scandal: ['최근 추문', 'Recent scandals'], none_good: ['뚜렷한 성과 없음', 'No standout achievement'], none_bad: ['뚜렷한 불만 없음', 'No major complaints'],
};
export function pollIssues(p: PollParts): { good: string[]; bad: string[] } {
  const good: string[] = [], bad: string[] = [];
  if (p.stability !== null) { if (p.stability >= 60) good.push('order'); else if (p.stability < 40) bad.push('order'); }
  if (p.unrestPenalty > 0) bad.push('unrest');
  if (p.approval !== null) { if (p.approval >= 60) good.push('harmony'); else if (p.approval < 40) bad.push('factions'); }
  if (p.warPenalty > 0) bad.push('war'); else good.push('peace');
  if (p.eventAdj > 0) good.push('wins'); else if (p.eventAdj < 0) bad.push('scandal');
  return { good: good.length ? good.slice(0, 3) : ['none_good'], bad: bad.length ? bad.slice(0, 3) : ['none_bad'] };
}
/** 조사: real = 정부 지지율(파벌 승인도가 있으면 그것, 없으면 민심), 신문사마다 편향+오차. 권위 정부는 보이는 값이 80 이상(실제 값은 real). */
export function makePoll(date: string, real: number, parts: PollParts, sham: boolean, rng: () => number, papers = 3): Poll {
  const r = Math.round(clamp(real, 0, 100)), out: PollPaper[] = [];
  const shownOf = (v: number) => sham ? Math.round(clamp(POLL.shamFloor + v * 0.15 + rng() * 4, POLL.shamFloor, 99)) : Math.round(clamp(v, 1, 99));
  for (let i = 0; i < papers; i++) out.push({ paper: i, value: shownOf(r + (sham ? 0 : (POLL.paperBias[i] ?? 0)) + (rng() * 2 - 1) * POLL.noise) });
  const shown = Math.round(out.reduce((a, p) => a + p.value, 0) / Math.max(1, out.length));
  return { date, real: r, shown, papers: out, sham, ...pollIssues(parts) };
}
/** 비서·신문이 아는 한 줄(영어). 권위 정부면 비서만 실제 값을 안다. */
export function pollFact(p: Poll): string {
  return p.sham ? `Latest state-run approval poll (${p.date}): officially ${p.shown}% — the real figure is about ${p.real}% (only the secretary knows).`
    : `Latest approval poll (${p.date}): ${p.shown}% on average (${p.papers.map((x) => x.value + '%').join(' / ')} across the three newspapers).${partyLine(p)}`;
}

/** 신문 프롬프트 한 줄(영어, 2026-11-03): 그 신문사의 최근 조사. 반년이 넘었으면 빈 글. 관제 조사면 보수·진보지는 받아쓰고 중립지(공허 통신, 2번)는 검증할 수 없다고 쓴다.
 *  LLM 호출은 늘지 않는다(원래 나가는 신문 호의 프롬프트에 한 줄). */
export function pollPromptLine(p: Poll | undefined, paper: number, date: string): string {
  if (!p) return ''; const a = ym(p.date), b = ym(date); if (!Number.isFinite(a) || !Number.isFinite(b) || b - a > 6 || b < a) return '';
  const mine = p.papers.find((x) => x.paper === paper)?.value ?? p.shown, en = (k: string) => (ISSUE[k] ?? [k, k])[1].toLowerCase();
  if (p.sham) return paper === 2
    ? `The state polling agency claims government approval of ${p.shown}% (${p.date}). This paper cannot verify the figure; if you mention it, treat it with dry skepticism and do not invent a "real" number.`
    : `The state polling agency reports government approval of ${p.shown}% (${p.date}). This paper reports the official figure as given.`;
  return `This newspaper's own latest opinion poll (${p.date}): government approval ${mine}% (three-paper average ${p.shown}%). Seen as doing well: ${p.good.map(en).join(', ')}; doing badly: ${p.bad.map(en).join(', ')}.${partyLine(p)} You may report this poll as the paper's own survey (keep the numbers exact).`;
}

// ── ② 국민투표 ──
/** 재임 중 2년에 1번(세이브마다). 통과 = 안정도 +5·민심 +3(2년), 부결 강행 = 안정도 −5(1년)·민심 −4. */
export const REF = { cooldownDays: 720, mandateMod: 'sllm_referendum_mandate', mandateDays: 720, defiedMod: 'sllm_referendum_defied', defiedDays: 360, moodPass: 3, moodDefy: -4, noise: 6 } as const;
export function referendumReady(last: string | undefined, today: string): { ok: boolean; until?: string } {
  if (!last) return { ok: true };
  const a = dayNo(last), b = dayNo(today); if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok: true };
  if (b - a >= REF.cooldownDays) return { ok: true };
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(last)!; return { ok: false, until: `${Number(m[1]) + 2}.${m[2]}.${m[3]}` };
}
export interface Tally { yes: number; no: number; abstain: number }
/** 찬성률(%): 파벌 표결이 있으면 찬성 파벌 지지율 + 기권 몫 × 민심, 없으면 민심만. 앱 주사위로 ±6. 50% 넘으면 통과. */
export function referendumYes(t: Tally | null, mood: number | null, rng: () => number): number {
  const m = clamp((mood ?? 50) / 100, 0, 1), base = t ? clamp(t.yes + t.abstain * m, 0, 1) : m;
  return Math.round(clamp(base * 100 + (rng() * 2 - 1) * REF.noise, 1, 99) * 10) / 10;
}
/** 요식 투표: 늘 98~99.8%. */
export function shamYes(rng: () => number): number { return Math.round((98 + rng() * 1.8) * 10) / 10; }
export interface Referendum { date: string; yes: number; passed: boolean; sham: boolean; title: string }

// ── ③ 특별사면 ──
/** 국경일·행성 기념일이 든 달에만, 1년에 1번. 범위마다 모든 행성 안정도 +·범죄 +(1년). 정치범 포함 = 비권위 파벌 승인도 +, 권위 파벌 승인도 −(1년). */
export type AmnestyTier = 'petty' | 'general' | 'grand';
export const AMNESTY: Record<AmnestyTier, { mod: string; stab: number; crime: number; ko: string; en: string }> = {
  petty: { mod: 'sllm_amnesty_petty', stab: 2, crime: 5, ko: '경범 사면', en: 'Petty-offence pardon' },
  general: { mod: 'sllm_amnesty_general', stab: 4, crime: 10, ko: '일반 사면', en: 'General pardon' },
  grand: { mod: 'sllm_amnesty_grand', stab: 6, crime: 20, ko: '대사면', en: 'Grand amnesty' },
};
export const AMNESTY_DAYS = 360, AMNESTY_POL_UP = 'sllm_amnesty_pol_up', AMNESTY_POL_DOWN = 'sllm_amnesty_pol_down';
export const isTier = (v: unknown): v is AmnestyTier => v === 'petty' || v === 'general' || v === 'grand';
export interface Amnesty { date: string; tier: AmnestyTier; political: boolean; occasion: string; status: string }
export function amnestyUsed(list: Amnesty[], today: string): boolean { const y = (today || '').split('.')[0]; return !!y && list.some((a) => a.date.split('.')[0] === y && a.status !== 'failed'); }

// ── 게임 명령 ──
/** 국가 scope 수정자 + (있으면) 파벌 scope 수정자. 붙었는지 확인해서 회신(missing = 모드가 낡음). 회신 SLLM:CIVIC req·sid·what·status. */
export function civicCommand(req: number, sid: string, what: string, mods: Array<{ name: string; days: number }>, factions: { up?: number[]; down?: number[]; upMod?: string; downMod?: string; days?: number } = {}): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !/^[a-z_]{2,24}$/.test(what) || !mods.length || mods.some((m) => !/^sllm_[a-z_]+$/.test(m.name) || !Number.isSafeInteger(m.days) || m.days < 1)) throw new Error(L('시민 정치 명령 인자가 올바르지 않습니다.', 'Invalid civic command arguments.'));
  const log = (s: string) => `log = "SLLM:CIVIC/;/req=${req}/;/sid=${sid}/;/what=${what}/;/status=${s}"`;
  const add = mods.map((m) => `remove_modifier = ${m.name} add_modifier = { modifier = ${m.name} days = ${m.days} }`).join(' ');
  const fac = (ids: number[] | undefined, mod: string | undefined) => {
    const ok = (ids ?? []).filter((x) => Number.isSafeInteger(x) && x > 0); if (!ok.length || !mod || !/^sllm_[a-z_]+$/.test(mod)) return '';
    return ` every_pop_faction = { limit = { OR = { ${ok.map((i) => `check_variable = { which = sllm_f_id value = ${i} }`).join(' ')} } } remove_modifier = ${mod} add_modifier = { modifier = ${mod} days = ${factions.days ?? AMNESTY_DAYS} } }`;
  };
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${add}${fac(factions.up, factions.upMod)}${fac(factions.down, factions.downMod)} if = { limit = { has_modifier = ${mods[0].name} } ${log('applied')} } else = { ${log('missing')} } }`;
}
