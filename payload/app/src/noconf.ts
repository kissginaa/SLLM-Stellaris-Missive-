// 불신임(2026-11-03 사용자 결정 ⑥): 설정 「(하드코어) 불신임」을 켰을 때만(기본 꺼짐). 자유 정부(민주·과두 등)에서 지지율이 25% 아래로 3달 이어지면 의회가 불신임안을 낸다.
// 최근 국정감사(3년 안)가 큰 논란이었거나 위증 의심이 2건 이상이면 기준이 30%로 오른다. 표결 뒤 2년은 다시 내지 않는다.
// 대응: ① 변론(플레이어가 직접 연설 → LLM 이 점수 −10~+12) 뒤 표결 ② 의회 해산(큰 벌). 석 달 안에 대응하지 않으면 변론 없이 표결.
// 표결: 정부 지지 = 50 + (지지율 − 25) × 1.2 − 최근 위증 × 4 + 연설 점수 + 의석 보정(정부 의석 %−50)×0.6 ± 5(무작위). 50 이상이면 살아남는다.
// 결과: 살아남음 = 1년 안정도 +2·민심 +3, 가결(레임덕) = 3년 안정도 −5·영향력 생산 −20%·민심 −5, 해산 = 2년 안정도 −10·민심 −8.
// 스텔라리스에는 통치자를 바로 끌어내리는 효과가 없어서 가결은 「레임덕」으로 다룬다. 「슈뢰딩거」: 판정은 매달 앱 계산(게임 명령 없음), 게임 명령은 결과 수정자를 붙일 때 한 번.
// 모드: common/static_modifiers/sllm_noconf_modifiers.txt. 앱: src/features/noconf-app.ts. 화면: ui/office-audit.js(집무실 「의회」).
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';
import { monthsBetween } from './letters';
import type { AuditRec } from './audit';

export const NOCONF = {
  threshold: 25, thresholdHot: 30, lowMonths: 3, answerMonths: 3, cooldownMonths: 24, auditWindowMonths: 36,
  survived: { mod: 'sllm_noconf_survived', days: 360, mood: 3 },
  lameduck: { mod: 'sllm_noconf_lameduck', days: 1080, mood: -5 },
  dissolved: { mod: 'sllm_noconf_dissolved', days: 720, mood: -8 },
  speechTokens: 700,
};
export interface Motion { date: string; approval: number; mover: string; faction: string; charge: string }
export interface Vote { date: string; kind: 'vote' | 'dissolved'; speech?: string; score?: number; reaction?: string; gov?: number; survived?: boolean; status?: string }
export interface NoconfSave { low: number; motion?: Motion; votes: Vote[]; lastVote?: string; lastSeen?: string }

/** 최근 감사(3년 안)가 논란이었으면 기준을 올린다. 최근 위증 수도 돌려준다. */
export function auditHeat(recs: AuditRec[], date: string): { hot: boolean; perjury: number } {
  const r = recs.filter((x) => x.kind === 'held' || x.kind === 'refused' || x.kind === 'missed').filter((x) => monthsBetween(x.date, date) <= NOCONF.auditWindowMonths);
  const perjury = r.reduce((a, x) => a + (x.perjury || 0), 0);
  return { hot: r.some((x) => x.outcome === 'scandal' || x.kind === 'refused' || x.kind === 'missed') || perjury >= 2, perjury };
}
export const thresholdOf = (hot: boolean) => (hot ? NOCONF.thresholdHot : NOCONF.threshold);
/** 매달 한 번: 지지율이 기준 아래인 달 수를 센다. 발의할 때가 되면 true. */
export function tickLow(s: NoconfSave, approval: number | null, date: string, hot: boolean): boolean {
  if (s.lastSeen && monthsBetween(s.lastSeen, date) < 1) return false; s.lastSeen = date;
  if (approval === null) return false;
  s.low = approval < thresholdOf(hot) ? s.low + 1 : 0;
  if (s.motion) return false;
  if (s.lastVote && monthsBetween(s.lastVote, date) < NOCONF.cooldownMonths) return false;
  return s.low >= NOCONF.lowMonths;
}
/** 대응 기한이 지났나(석 달). */
export const motionExpired = (m: Motion, date: string) => monthsBetween(m.date, date) >= NOCONF.answerMonths;

/** 정부 지지 표(%). 50 이상이면 살아남는다. */
export function govShare(approval: number, perjury: number, score: number, rng: () => number = Math.random): number {
  const v = 50 + (approval - NOCONF.threshold) * 1.2 - perjury * 4 + score + (rng() * 10 - 5);
  return Math.max(5, Math.min(95, Math.round(v * 10) / 10));
}

export function motionCharge(approval: number, hot: boolean): string {
  return hot ? L(`국정감사의 논란과 바닥난 지지율(${approval}%)을 이유로 정부 불신임안을 낸다.`, `Citing the audit scandal and approval at rock bottom (${approval}%), we move a motion of no confidence in the government.`)
    : L(`지지율이 석 달째 ${approval}%에 머물렀다. 정부는 국민의 신임을 잃었다.`, `Approval has sat at ${approval}% for three months. The government has lost the people's confidence.`);
}
/** 변론 연설 판정(LLM 1번). */
export function speechMessages(a: { empire: string; date: string; approval: number; motion: Motion; facts: string[] }, speech: string): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Stellaris. Parliament of ${a.empire} debates a motion of no confidence in the government (date ${a.date}). The head of government gives a defence speech. You judge how many wavering members it wins over.`,
      'Score from -10 (insulting, arrogant, threatening or empty — it pushes members to vote against) to +12 (honest, concrete, addresses the grievances and offers real change). Most speeches land between -3 and +6.',
      'Reply ONLY with JSON: {"score":-10..12,"reaction":"how the chamber reacts, 1-2 sentences","headline":"newspaper headline about the speech"}.',
    ].join('\n') },
    { role: 'user', content: [`Motion by ${a.motion.mover}${a.motion.faction ? ` (${a.motion.faction})` : ''}: ${a.motion.charge}`, `Approval: ${a.approval}%.`, ...a.facts.map((f) => '- ' + f), `Defence speech: ${speech}`].join('\n') },
  ];
}
const jsonPart = (raw: string): Record<string, unknown> | null => { const t = String(raw ?? ''); const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { const v = JSON.parse(t.slice(a, b + 1)); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; } };
export function parseSpeech(raw: string): { score: number; reaction: string; headline: string } | null {
  const v = jsonPart(raw); if (!v || !Number.isFinite(Number(v.score))) return null;
  return { score: Math.max(-10, Math.min(12, Math.round(Number(v.score)))), reaction: String(v.reaction ?? '').trim().slice(0, 400), headline: String(v.headline ?? '').trim().slice(0, 120) };
}
export function voteChron(v: Vote, empire: string): string {
  if (v.kind === 'dissolved') return L(`${v.date} 정부가 불신임 표결을 앞두고 의회를 해산했다. 거리에서 항의가 이어졌다.`, `${v.date} Facing a no-confidence vote, the government dissolved parliament. Protests filled the streets.`);
  const pct = (v.gov ?? 0).toFixed(1) + '%';
  return v.survived ? L(`${v.date} 정부 불신임안이 부결되었다(정부 지지 ${pct}).`, `${v.date} The motion of no confidence in the government of ${empire} failed (${pct} for the government).`)
    : L(`${v.date} 정부 불신임안이 가결되었다(정부 지지 ${pct}). 정부는 자리를 지켰지만 레임덕에 빠졌다.`, `${v.date} The motion of no confidence passed (${pct} for the government). The government clings on as a lame duck.`);
}
export function noconfFact(s: NoconfSave): string[] {
  const out: string[] = [];
  if (s.motion) out.push(`A motion of no confidence in the government is pending (moved ${s.motion.date} by ${s.motion.mover}).`);
  const v = s.votes[s.votes.length - 1]; if (v) out.push(v.kind === 'dissolved' ? `The government dissolved parliament on ${v.date} to avoid a no-confidence vote.` : `Last no-confidence vote ${v.date}: ${v.survived ? 'the government survived' : 'passed — the government is a lame duck'}.`);
  return out;
}
