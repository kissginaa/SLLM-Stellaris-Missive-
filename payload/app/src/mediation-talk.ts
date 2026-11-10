// 두 지도자 중재(32·33·34, 2026-10-24 설계 대조로 추가): 플레이어가 아는 갈등의 당사자 둘을 불러 실제로 대화하고, 마칠 때 AI 가 「합의했는가」만 판정한다.
// 앱: src/features/relations-app.ts(relMediate*). 화면: ui/office-relations.js(인물 카드 「두 사람 중재하기」). 합의하면 resolveConflict(…, 'mediation') — 친구가 되지 않아도 업무상 갈등 정리면 해결(32).
// 갈등 사연(34)은 「이유 알아보기」또는 첫 중재 때만 한 번 생성해 저장하고 다시 쓴다. 이 파일은 순수 규칙·프롬프트만(시험: selftest-plans).
import type { Pid, Conflict } from './relations';
import type { HallLine } from './social-hall';
export { parseHallReply } from './social-hall';

export interface MedParty { pid: Pid; name: string; cls: string; traits: string[]; persona?: string }
export const MED = { maxLines: 40, maxTurnChars: 400 } as const;

const KIND_EN: Record<string, string> = { friction: 'a clash at a social gathering', policy: 'a dispute over policy or the allocation of support', credit: 'feeling their contribution went unrecognised' };
/** 갈등 한 줄 설명(영어, 프롬프트용). 사연이 있으면 그것을 쓴다. */
export function conflictBrief(c: Conflict, names: Record<Pid, string>, rulerPid: Pid): string {
  const nm = (p: Pid) => (p === rulerPid ? 'the ruler' : names[p] ?? 'someone');
  const base = `${nm(c.a)} and ${nm(c.b)} have been at odds since ${c.createdOn}: ${KIND_EN[c.kind] ?? 'a disagreement'}.`;
  const cause = Object.entries(c.cause).map(([k, v]) => `${k}=${String(v).slice(0, 60)}`).join(', ');
  return c.story?.text ? `${base} What happened: ${c.story.text.slice(0, 600)}` : `${base}${cause ? ` (recorded cause: ${cause})` : ''}`;
}
/** 사연 생성(34): 최소 원인에서 2~3문장. 게임 사실·수치를 지어내지 않게. */
export function storyMessages(a: { empire: string; date: string }, c: Conflict, parties: MedParty[], names: Record<Pid, string>, rulerPid: Pid): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    `You write a short backstory for a personal conflict between two leaders of the Stellaris empire "${a.empire || 'our empire'}". Date: ${a.date || 'unknown'}.`,
    conflictBrief({ ...c, story: undefined }, names, rulerPid),
    ...parties.map((p) => `- ${p.name} (${p.cls})${p.traits.length ? `; traits: ${p.traits.slice(0, 4).join(', ')}` : ''}${p.persona ? `; manner: ${p.persona}` : ''}`),
    'Write 2-3 sentences in plain prose: what was said or done, and why each side felt wronged. Keep both sides understandable. Do not invent game facts, numbers, battles or events beyond the recorded cause. No dialogue lines, no headings.',
  ].join('\n') }, { role: 'user', content: '(Describe what happened between them.)' }];
}
/** 중재 대화 프롬프트: 두 당사자만 답한다. 「이름: 대사」 1~3줄. 통치자 대사는 쓰지 않는다. */
export function mediationMessages(a: { empire: string; ruler: string; date: string }, c: Conflict, parties: MedParty[], names: Record<Pid, string>, rulerPid: Pid, history: HallLine[], text: string, toName?: string): { role: 'system' | 'user'; content: string }[] {
  const sys = [
    `You voice two leaders of the Stellaris empire "${a.empire || 'our empire'}" whom the ruler ${a.ruler || ''} has called in to settle a personal conflict. Date: ${a.date || 'unknown'}.`,
    `[The conflict] ${conflictBrief(c, names, rulerPid)}`,
    '[The two people]',
    ...parties.map((p) => `- ${p.name} (${p.cls})${p.traits.length ? `; traits: ${p.traits.slice(0, 4).join(', ')}` : ''}${p.persona ? `; manner: ${p.persona}` : ''}`),
    toName ? `The ruler is speaking mainly to ${toName}; ${toName} answers first, the other may react.` : 'The ruler is speaking to both; whoever fits best answers first, the other may react.',
    'They start guarded and defensive, each sure they were wronged. They can soften if the ruler listens, acknowledges their side, or proposes something fair; they can also dig in if the ruler is dismissive or takes sides. They may agree to set the matter aside for work without becoming friends.',
    'Reply with 1-3 lines in total, each on its own line in the exact form "Name: what they say". Use only the two names above. Each line 1-3 sentences. Never write lines or actions for the ruler. Do not invent game facts, numbers or events.',
  ].join('\n');
  const past = history.slice(-14).map((l) => `${l.who === 'ruler' ? `${a.ruler || 'The ruler'} (ruler)` : l.name}: ${l.text}`).join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: `${past ? `[Conversation so far]\n${past}\n\n` : ''}[The ruler now says${toName ? ` to ${toName}` : ''}]\n${String(text ?? '').slice(0, MED.maxTurnChars)}` }];
}
/** 마칠 때 판정(JSON): 둘이 (업무상이라도) 갈등을 정리하기로 했는가. 말한 내용만 근거로. */
export function verdictMessages(ruler: string, parties: MedParty[], lines: HallLine[]): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    'You judge whether a mediation between two leaders ended in an agreement. Judge only from what was actually said.',
    `"agreed" is true only if BOTH ${parties.map((p) => p.name).join(' and ')} clearly accepted a settlement, apology or working arrangement in their own words. Being polite, or only one side yielding, is not agreement.`,
    'Answer with JSON only: {"agreed": true|false, "note": "one short sentence on how it ended"}',
  ].join('\n') }, { role: 'user', content: lines.slice(-30).map((l) => `${l.who === 'ruler' ? `${ruler || 'Ruler'} (ruler)` : l.name}: ${l.text}`).join('\n') || '(nothing was said)' }];
}
export function parseVerdict(raw: string): { agreed: boolean; note: string } {
  try { const m = String(raw ?? '').match(/\{[\s\S]*\}/); const j = m ? JSON.parse(m[0]) : null; return { agreed: j?.agreed === true, note: typeof j?.note === 'string' ? j.note.slice(0, 200) : '' }; } catch { return { agreed: false, note: '' }; }
}
