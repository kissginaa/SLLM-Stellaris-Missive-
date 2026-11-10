// 긴급회의(02 최신 확정)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 수동 소집만(자동 감지·제안 없음) / 개최 무료·재소집 제한 없음 / 참석자 = 현재 중앙 평의회 /
//   지목하면 그 인물, 전체 질문이면 관련 담당 1명 + 필요 시 다른 1명 보충, 「전원 의견 듣기」면 참석자 한 번씩(통치자 대사 자동 생성 없음) /
//   총 발언 무제한, 플레이어가 직접 종료 / 같은 의제는 기록에서 재개(이전 발언 재생성 없음) / 종료 때 통치자의 명시 결정·약속만 기록.
// 게임 자료 근거: 평의회 명단 = LEADER 줄의 cpos(평의회 자리). 회의실 최대 8석 → 넘으면 페이지로(조용히 빼지 않는다).
// 13 행성총독회의·46 성간제국통신임시회의와 상태·ID 를 공유하지 않는다(발언 원칙만 같음).
import { L } from './i18n-pick';
import type { Pid } from './relations';

export const EMERGENCY_SEATS = 8;
/** 평의원 담당 분야(앱이 관련 담당자를 고를 때 쓰는 꼬리표). cpos 이름 → 분야는 집컴 최신 평의회 키로 채운다(자리값). */
export type Domain = 'military' | 'economy' | 'diplomacy' | 'research' | 'interior' | 'intel';
export interface Councilor { pid: Pid; name: string; domains: Domain[] }

export interface EmergencyMeeting {
  id: string; sid: string; topic: string;
  /** 플레이어가 적은 위기 설명은 플레이어 주장(02: 게임 관측 사실과 구분). */
  topicSource: 'player';
  rulerPid: Pid; participants: Pid[]; snapshotRevision: number;
  state: 'active' | 'closed'; openedOn: string; closedOn?: string;
  /** 이어 논의하면 같은 회의를 재개한다(새 ID 아님). 재개 날짜 기록. */
  resumedOn: string[];
  turns: { id: string; speaker: Pid; mode: SpeakMode; on: string; text?: string; /** 발언 당시 화자 이름(01: 과거 기록에 현재 통치자를 소급 표시하지 않는다). */ name?: string }[];
  /** 통치자가 명시적으로 정한 것만(02). AI 제안은 여기 들어오지 않는다. 게임 실행과는 별개. */
  decisions: { id: string; text: string; on: string; kind: 'decision' | 'promise'; effectRequestId?: string }[];
}
export type SpeakMode = 'named' | 'primary' | 'supplement' | 'roll_call';

/** 수동 소집(02): 주제 필수, 참석자 = 지금 평의회. 비용·간격 제한 없음. */
export function convene(id: string, sid: string, topic: string, rulerPid: Pid, council: Councilor[], today: string): EmergencyMeeting | { error: string } {
  const t = String(topic ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!t) return { error: L('회의 주제를 적어 주세요.', 'Enter a topic for the meeting.') };
  const ps = council.map((c) => c.pid).filter((p) => p !== rulerPid);
  if (!ps.length) return { error: L('지금 평의회에 참석할 평의원이 없습니다.', 'No councilors are currently seated.') };
  return { id, sid, topic: t, topicSource: 'player', rulerPid, participants: ps, snapshotRevision: 1, state: 'active', openedOn: today, resumedOn: [], turns: [], decisions: [] };
}
/** 8석 넘는 모드 환경(02): 페이지로 나눈다. */
export function seatPages(ps: Pid[]): Pid[][] { const out: Pid[][] = []; for (let i = 0; i < ps.length; i += EMERGENCY_SEATS) out.push(ps.slice(i, i + EMERGENCY_SEATS)); return out; }

/** 주제 → 분야(앱 규칙, AI 없음). 한/영 낱말만 본다. 맞는 게 없으면 빈 배열. */
const DOMAIN_WORDS: Record<Domain, RegExp> = {
  military: /전쟁|함대|군|침공|방어|war|fleet|army|invasion|defen[cs]e|military/i,
  economy: /경제|자원|에너지|광물|식량|생산|무역|economy|resource|energy|mineral|food|trade|production/i,
  diplomacy: /외교|동맹|조약|대사|연방|diplomac|alliance|treaty|envoy|federation/i,
  research: /연구|기술|과학|research|tech|science/i,
  interior: /반란|안정|불안|파벌|독립|행성|rebel|stability|unrest|faction|independen|planet/i,
  intel: /첩보|간첩|정보|spy|espionage|intel/i,
};
export function topicDomains(text: string): Domain[] { return (Object.keys(DOMAIN_WORDS) as Domain[]).filter((d) => DOMAIN_WORDS[d].test(text)); }

/** 화자 고르기(02).
 *  - named: 지목한 참석자 한 명(참석자 아니면 null).
 *  - all: 질문 분야와 겹치는 평의원 중 최근에 덜 말한 사람 1명 → wantSupplement 이면 다른 1명(가능하면 다른 분야) 추가. 2명을 넘지 않는다.
 *  - roll_call: 지금 참석자 모두 한 번씩(통치자 제외). 이후 반박을 자동으로 잇지 않는다. */
export function pickSpeakers(m: EmergencyMeeting, council: Councilor[], ask: { kind: 'named'; pid: Pid } | { kind: 'all'; text: string; wantSupplement: boolean } | { kind: 'roll_call' }): { pid: Pid; mode: SpeakMode }[] {
  if (m.state !== 'active') return [];
  if (ask.kind === 'named') return m.participants.includes(ask.pid) ? [{ pid: ask.pid, mode: 'named' }] : [];
  if (ask.kind === 'roll_call') return m.participants.map((pid) => ({ pid, mode: 'roll_call' as const }));
  const seated = council.filter((c) => m.participants.includes(c.pid)); if (!seated.length) return [];
  const ds = topicDomains(ask.text);
  const lastAt = new Map<Pid, number>(); m.turns.forEach((x, i) => lastAt.set(x.speaker, i)); // 최적화: 비교마다 발언 전체를 훑지 않는다
  const spoke = (p: Pid) => lastAt.get(p) ?? -1;
  const rank = (cs: Councilor[]) => [...cs].sort((a, b) => spoke(a.pid) - spoke(b.pid) || seated.indexOf(a) - seated.indexOf(b));
  const fit = seated.filter((c) => c.domains.some((d) => ds.includes(d)));
  const first = rank(fit.length ? fit : seated)[0];
  const out: { pid: Pid; mode: SpeakMode }[] = [{ pid: first.pid, mode: 'primary' }];
  if (ask.wantSupplement) {
    const rest = seated.filter((c) => c.pid !== first.pid); if (rest.length) {
      const other = rest.filter((c) => !c.domains.some((d) => first.domains.includes(d)));
      out.push({ pid: rank(fit.filter((c) => c.pid !== first.pid).length ? fit.filter((c) => c.pid !== first.pid) : other.length ? other : rest)[0].pid, mode: 'supplement' });
    }
  }
  return out;
}
/** 발언 기록(같은 turn ID 는 한 번만 — 재시도로 중복 생성 금지). */
export function recordTurn(m: EmergencyMeeting, t: { id: string; speaker: Pid; mode: SpeakMode; on: string; text?: string }, snapshotRevision: number): boolean {
  if (m.state !== 'active' || snapshotRevision !== m.snapshotRevision || !m.participants.includes(t.speaker) || m.turns.some((x) => x.id === t.id)) return false;
  m.turns.push({ ...t }); return true;
}
/** 통치자의 명시 결정·약속(02). 같은 ID 는 한 번만. */
export function recordDecision(m: EmergencyMeeting, d: { id: string; text: string; on: string; kind: 'decision' | 'promise' }): boolean {
  const text = String(d.text ?? '').trim(); if (!text || m.decisions.some((x) => x.id === d.id)) return false;
  m.decisions.push({ ...d, text }); return true;
}
/** 플레이어가 직접 종료(발언 수 제한 없음). */
export function closeMeeting(m: EmergencyMeeting, today: string): boolean { if (m.state !== 'active') return false; m.state = 'closed'; m.closedOn = today; return true; }
/** 재개(02): 같은 회의를 다시 연다. 참석자는 지금 평의회로 다시 맞추고(빠진 사람 돌려줌), 과거 발언·결정은 그대로 둔다. */
export function resumeMeeting(m: EmergencyMeeting, council: Councilor[], today: string): { dropped: Pid[]; added: Pid[] } {
  const now = council.map((c) => c.pid).filter((p) => p !== m.rulerPid);
  const dropped = m.participants.filter((p) => !now.includes(p)), added = now.filter((p) => !m.participants.includes(p));
  m.participants = now; m.state = 'active'; delete m.closedOn; m.resumedOn.push(today);
  if (dropped.length || added.length) m.snapshotRevision++;
  return { dropped, added };
}
/** 재개 때 AI 에 줄 기억: 이전 결정·약속과 최근 발언 몇 개의 요약 줄(정형, LLM 없이). */
export function resumeContext(m: EmergencyMeeting, maxTurns = 6): string[] {
  const out = m.decisions.map((d) => (d.kind === 'promise' ? L('약속: ', 'Promise: ') : L('결정: ', 'Decision: ')) + d.text);
  for (const t of m.turns.slice(-maxTurns)) if (t.text) out.push(`${t.speaker}: ${t.text.slice(0, 200)}`);
  return out;
}

// ======================================================================================
// 앱 연결(2026-10-23 초안): 참석자 = 내각 회의와 같은 평의원(cabinet-meeting.ts cabMembersFrom), 분야는 장관 직책 분야에서.
// ======================================================================================
import type { ChatMessage } from './player2';
/** 내각 직책 분야(cabinet-meeting Domain) → 긴급회의 담당 분야. */
export const CAB_TO_DOMAIN: Record<string, Domain[]> = { defense: ['military'], research: ['research'], state: ['diplomacy', 'intel'], economy: ['economy'], interior: ['interior'] };
export interface SpeakerInfo { pid: Pid; name: string; title: string; traits: string[]; persona?: string; trust?: number; away?: string; /** 인맥(31): 통치자와의 관계·다른 평의원과의 관계 한 줄(영어). 무조건 찬반 금지는 프롬프트에서. */ relation?: string }
/** 한 평의원의 발언 프롬프트(영어 지시문, 응답 언어는 AI 호출 쪽이 붙인다). 플레이어의 위기 설명은 「통치자의 설명」으로만 — 사실 확인 안 됨. */
export function emergencyMessages(m: EmergencyMeeting, sp: SpeakerInfo, mode: SpeakMode, a: { empire: string; ruler: string; date: string; facts: string[] }, userText: string, others: SpeakerInfo[]): ChatMessage[] {
  const nameOf = (pid: Pid) => (pid === m.rulerPid ? a.ruler || 'the ruler' : others.find((o) => o.pid === pid)?.name ?? (sp.pid === pid ? sp.name : 'a councilor'));
  const recent = m.turns.slice(-8).filter((t) => t.text).map((t) => `${t.name || nameOf(t.speaker)}: ${t.text!.slice(0, 300)}`).join('\n');
  const modeLine = mode === 'supplement' ? 'Another councilor just answered. Add what they missed or push back where you disagree — do not repeat them.'
    : mode === 'roll_call' ? 'The ruler asked every councilor for their position. State yours clearly in 2-3 sentences.'
    : mode === 'named' ? 'The ruler addressed you directly. Answer the ruler in 2-4 complete sentences.' : 'The ruler asked the whole council; you answer first because this falls under your portfolio.';
  const sys = [
    `You are ${sp.name}, ${sp.title} on the council of the Stellaris empire "${a.empire || 'our empire'}". Date: ${a.date || 'unknown'}.${sp.away ? ` You attend remotely by hologram (${sp.away}).` : ''}`,
    `This is an emergency council meeting the ruler ${a.ruler || ''} convened. Topic as described by the ruler (the ruler's own words, not verified game facts): "${m.topic}".`,
    a.facts.length ? `[Confirmed game facts]\n${a.facts.map((f) => '- ' + f).join('\n')}` : '',
    m.decisions.length ? `[Decisions the ruler already made in this meeting]\n${m.decisions.map((d) => `- ${d.kind === 'promise' ? 'Promise' : 'Decision'}: ${d.text}`).join('\n')}` : '',
    sp.traits.length ? `Your traits: ${sp.traits.slice(0, 4).join(', ')}.` : '', sp.persona ? `Your manner: ${sp.persona}` : '', sp.trust !== undefined ? `Your trust in the ruler: ${sp.trust} (−100..100).` : '',
    sp.relation ? `[Personal ties] ${sp.relation} Let this colour your tone, patience and how far you will go along — but judge the matter by interests and your portfolio; a friend need not agree and a rival need not oppose.` : '',
    `Other councilors present: ${others.filter((o) => o.pid !== sp.pid).map((o) => `${o.name} (${o.title})`).join(', ') || 'none'}.`,
    recent ? `[Recent discussion]\n${recent}` : '',
    modeLine,
    // 2026-10-31 사용자: 긴급 의제에서 장관들이 의제보다 자기 분야가 더 중요하다고만 함 → 전공은 의제를 보는 렌즈로만
    `FOCUS ON THE EMERGENCY TOPIC ("${m.topic}"). Your portfolio is the lens through which you judge THIS topic, not a competing agenda: say what the topic means for your area (risks, opportunities, what your department can contribute) and give a concrete recommendation for handling the topic itself. Do not argue that your department's priorities matter more than the topic, do not steer the meeting to your own pet issue, and do not deliver a general philosophy lecture. If the ruler's remark drifts from the topic, answer it briefly and bring the discussion back to the topic. When you disagree with a colleague, disagree about how to handle the topic. Plain, natural speech without business jargon.`,
    'Speak in character. Friends need not agree and rivals need not oppose. 2-5 sentences. Do not invent game facts, numbers or events. Do not claim anything was already carried out in the game. Never write lines for the ruler or other councilors.',
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: String(userText ?? '').slice(0, 800) || '(The ruler waits for your view.)' }];
}
/** 발언이 끊겼나(2026-10-23 사용자 보고: 지목 발언이 문장 중간에서 끊김). 토큰 한도 표시(player2 finishText)나 문장 끝맺음 없이 끝나면 끊김. */
export function emLooksCut(raw: string): boolean {
  const t = String(raw ?? '').trim(); if (!t) return false;
  if (t.includes('…(잘림)') || t.includes('…(cut off)')) return true;
  return !/[.!?。！？…"”’'»)\]~*]$/.test(t);
}
/** 다시 물어도 끊겼으면 마지막 완결 문장까지만 남긴다(끊김 표시도 지운다). 완결 문장이 없으면 그대로. */
export function emTrimCut(raw: string): string {
  const t = String(raw ?? '').replace(/\s*…\((잘림|cut off)\)\s*$/, '').trim();
  if (!emLooksCut(t)) return t;
  const m = t.match(/^[\s\S]*[.!?。！？…](?=[\s"”’'»)]|$)["”’'»)]*/); return m && m[0].trim().length >= 8 ? m[0].trim() : t;
}
/** 저장 정리: 망가진 회의는 버린다. 최근 30개만. */
export function sanitizeMeetings(x: unknown): EmergencyMeeting[] {
  const a = Array.isArray(x) ? x : [];
  return a.filter((m): m is EmergencyMeeting => !!m && typeof m === 'object' && typeof (m as EmergencyMeeting).id === 'string' && typeof (m as EmergencyMeeting).topic === 'string' && Array.isArray((m as EmergencyMeeting).turns) && Array.isArray((m as EmergencyMeeting).participants)).slice(-30)
    .map((m) => ({ ...m, state: 'closed' as const })); // 앱을 다시 켜면 열린 회의는 닫힌 것으로(재개로 다시 연다)
}
