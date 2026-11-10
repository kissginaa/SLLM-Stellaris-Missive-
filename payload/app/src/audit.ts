// 국정감사(2026-11-03 사용자 결정 ⑤): 설정에서 켰을 때만(하드코어, 기본 꺼짐). 12년마다(게임 연도가 12의 배수인 해: 2212, 2224, …) 1월에 감사 기간이 열리고 그해 안에 받아야 한다.
// 자유 정부(민주·과두 등)만 실제 감사(LLM: 감사 의제 1번 + 항목마다 답변 판정), 독재·제국은 요식 감사(LLM 없음), 단일 의식은 없음.
// 의제는 지난 12년 우리 연대기(세계 소식) + 민심·전쟁·금고 의혹·파벌에서 LLM 이 실제 있었던 일만 골라 만든다. 결과는 안정도 수정자·민심·신문(연대기)·⑥ 불신임용 위증 기록.
// 「슈뢰딩거」: 감사 기간이 열렸는지는 매달 앱 계산만(게임 명령 없음). 게임 명령은 결과 수정자를 붙일 때 한 번(civicCommand, 회신 CIVIC).
// 모드: common/static_modifiers/sllm_audit_modifiers.txt. 앱: src/features/audit-app.ts. 화면: ui/office-audit.js.
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';

export const AUDIT = {
  everyYears: 12, baseYear: 2200, items: 3,
  clean: { mod: 'sllm_audit_clean', days: 1800, mood: 3 },
  scandal: { mod: 'sllm_audit_scandal', days: 1080, mood: -4 },
  refused: { mod: 'sllm_audit_refused', days: 720, mood: -6 },
  maxTokens: 1400, judgeTokens: 700,
};
export type Verdict = 'cleared' | 'weak' | 'perjury';
export const VERDICT: Record<Verdict, [string, string]> = { cleared: ['해명됨', 'Cleared'], weak: ['답변 미흡', 'Unconvincing'], perjury: ['위증 의심', 'Suspected perjury'] };
export interface AuditItem { topic: string; mp: string; faction: string; question: string; answer?: string; verdict?: Verdict; remark?: string }
export interface AuditRec { year: number; date: string; kind: 'held' | 'sham' | 'refused' | 'missed'; items: AuditItem[]; outcome?: 'clean' | 'mixed' | 'scandal'; perjury: number; status?: string }

const yearOf = (d: string) => { const m = /^(\d+)\./.exec(d || ''); return m ? Number(m[1]) : NaN; };
const monthOf = (d: string) => { const m = /^\d+\.(\d+)/.exec(d || ''); return m ? Number(m[1]) : NaN; };
/** 그해가 감사 해인가(2212, 2224 …). */
export const isAuditYear = (y: number) => Number.isFinite(y) && y > AUDIT.baseYear && (y - AUDIT.baseYear) % AUDIT.everyYears === 0;
/** 다음(또는 올해) 감사 해. */
export function nextAuditYear(date: string): number { const y = yearOf(date); if (!Number.isFinite(y)) return NaN; let n = y; while (!isAuditYear(n)) n++; return n; }
/** 지금 감사 기간인가(감사 해이고 아직 그해 감사를 치르지 않았음). */
export function auditOpen(date: string, done: AuditRec[]): boolean { const y = yearOf(date); return isAuditYear(y) && !done.some((r) => r.year === y); }
/** 12월이 끝나도록 안 받으면 불출석으로 처리(다음 해 1월에 판정). 처리할 해를 돌려준다. */
export function missedYear(date: string, done: AuditRec[]): number | null { const y = yearOf(date) - 1; return monthOf(date) === 1 && isAuditYear(y) && !done.some((r) => r.year === y) ? y : null; }

export interface AuditContext { empire: string; date: string; chronicle: string[]; mood: number | null; wars: string[]; graft: number; factions: Array<{ name: string; ethic: string; support: number; approval: number }>; policies: string[] }
/** 감사 의제 요청(LLM 1번). */
export function agendaMessages(c: AuditContext): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Stellaris. The parliament of ${c.empire} holds its national audit (held once every ${AUDIT.everyYears} years) on the government. Date: ${c.date}.`,
      `Pick exactly ${AUDIT.items} audit topics from what REALLY happened (the record below). Prefer controversial decisions: forced policies, defied referendums, pardons of political prisoners, crushed protests, executions, costly wars, budget trouble, hints of corruption. Never invent events that are not in the record or facts.`,
      'For each topic, an opposition member of parliament from one of the listed factions (pick the faction most likely to object) asks one sharp question (1-3 sentences) to the head of government.',
      'Reply ONLY with JSON: {"items":[{"topic":"short title","mp":"name of the MP (invent one fitting the empire)","faction":"faction name from the list","question":"..."}]}.',
    ].join('\n') },
    { role: 'user', content: [
      `Government record of the last ${AUDIT.everyYears} years (oldest first):`, ...(c.chronicle.length ? c.chronicle.map((x) => '- ' + x) : ['- (little was recorded)']),
      `Public approval: ${c.mood === null ? 'unknown' : c.mood + '/100'}.`, `Wars now: ${c.wars.length ? c.wars.join(', ') : 'none'}.`,
      ...(c.graft >= 2 ? ['There are rumours that the ruler moved state funds into a private vault.'] : []),
      ...(c.policies.length ? ['Policies in force: ' + c.policies.join('; ')] : []),
      'Factions: ' + (c.factions.length ? c.factions.map((f) => `${f.name} (${f.ethic}, support ${f.support}%, approval ${f.approval}%)`).join('; ') : 'none known (use "Opposition bench")'),
    ].join('\n') },
  ];
}
const jsonPart = (raw: string): Record<string, unknown> | null => { const t = String(raw ?? ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { const v = JSON.parse(t.slice(a, b + 1)); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; } };
const str = (v: unknown, n: number) => String(v ?? '').replace(/[\r\t]+/g, ' ').trim().slice(0, n);
export function parseAgenda(raw: string): AuditItem[] {
  const v = jsonPart(raw), arr = Array.isArray(v?.items) ? v!.items as unknown[] : [];
  return arr.map((x) => { const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>; return { topic: str(o.topic, 80), mp: str(o.mp, 60), faction: str(o.faction, 60), question: str(o.question, 600) }; })
    .filter((i) => i.topic && i.question).slice(0, AUDIT.items);
}
/** 답변 판정 요청(항목마다 LLM 1번). */
export function judgeMessages(c: AuditContext, it: AuditItem, answer: string): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Stellaris national audit of ${c.empire}. You are ${it.mp || 'an opposition MP'} of ${it.faction || 'the opposition'}, who asked the question. Judge the head of government's answer fairly but sceptically.`,
      'cleared = a direct, credible answer that addresses the facts; weak = evasive, vague, or only blames others; perjury = contradicts the record, denies what clearly happened, or makes claims that are obviously false.',
      'Reply ONLY with JSON: {"verdict":"cleared|weak|perjury","remark":"your spoken reaction in the chamber, 1-2 sentences"}.',
    ].join('\n') },
    { role: 'user', content: [`Topic: ${it.topic}`, `Your question: ${it.question}`, 'Record:', ...c.chronicle.slice(-15).map((x) => '- ' + x), `Answer of the head of government: ${answer}`].join('\n') },
  ];
}
export function parseJudge(raw: string): { verdict: Verdict; remark: string } | null {
  const v = jsonPart(raw); if (!v) return null; const verdict = v.verdict === 'cleared' || v.verdict === 'weak' || v.verdict === 'perjury' ? v.verdict : null;
  return verdict ? { verdict, remark: str(v.remark, 400) } : null;
}
/** 종합 판정: 해명 +1, 미흡 −1, 위증 −2. 1 이상 clean, −2 이하 scandal. */
export function outcomeOf(items: AuditItem[]): 'clean' | 'mixed' | 'scandal' {
  const s = items.reduce((a, i) => a + (i.verdict === 'cleared' ? 1 : i.verdict === 'perjury' ? -2 : -1), 0);
  return s >= 1 ? 'clean' : s <= -2 ? 'scandal' : 'mixed';
}
/** 요식 감사(독재·제국): 틀 문장. */
export function shamItems(): AuditItem[] {
  return [
    { topic: L('국정 전반', 'State affairs in general'), mp: L('여당 원내대표', 'Government whip'), faction: '', question: L('정부의 빛나는 업적에 대해 한 말씀 부탁드립니다.', 'Could you say a few words about the government\'s brilliant achievements?'), answer: '', verdict: 'cleared', remark: L('(기립 박수)', '(standing ovation)') },
  ];
}
/** 연대기(세계 소식) 한 줄 = 신문 재료. */
export function auditChron(r: AuditRec, empire: string): string {
  const y = r.year;
  if (r.kind === 'sham') return L(`${r.date} ${y}년 국정감사가 30분 만에 끝났다. 의원들은 기립 박수로 정부를 칭송했고, 외국 언론은 요식 감사라며 비꼬았다.`, `${r.date} The ${y} national audit was over in thirty minutes. Members praised the government with a standing ovation; foreign newspapers mocked it as a rubber-stamp audit.`);
  if (r.kind === 'refused') return L(`${r.date} 정부가 ${y}년 국정감사 출석을 거부했다. 의회는 거세게 반발했다.`, `${r.date} The government refused to appear before the ${y} national audit. Parliament reacted furiously.`);
  if (r.kind === 'missed') return L(`${y}년 국정감사가 정부의 불출석으로 무산되었다.`, `The ${y} national audit collapsed because the government never appeared.`);
  const per = r.perjury ? L(` 위증 의혹 ${r.perjury}건이 제기되었다.`, ` ${r.perjury} accusation(s) of perjury were raised.`) : '';
  const how = r.outcome === 'clean' ? L('정부가 의혹을 대부분 해명했다.', 'the government answered most of the charges.') : r.outcome === 'scandal' ? L('정부의 답변이 큰 논란을 낳았다.', 'the government\'s answers caused an uproar.') : L('공방이 팽팽했다.', 'the exchanges were evenly matched.');
  return L(`${r.date} ${y}년 국정감사(${r.items.map((i) => i.topic).join(', ')}): ${how}${per}`, `${r.date} The ${y} national audit of ${empire} (${r.items.map((i) => i.topic).join(', ')}): ${how}${per}`);
}
/** 비서·⑥ 불신임이 쓰는 한 줄(영어). */
export function auditFact(r: AuditRec): string { return `National audit ${r.year}: ${r.kind}${r.outcome ? `, outcome ${r.outcome}` : ''}${r.perjury ? `, ${r.perjury} perjury accusation(s)` : ''}.`; }
