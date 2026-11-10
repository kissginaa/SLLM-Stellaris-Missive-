// 사로잡은 적 제독(2026-11-04 사용자, War Crimes Expanded 모드의 게임 연결 방식을 참고해 우리 식으로). 순수 규칙 — 앱: src/features/captive-app.ts,
// 게임: tester-mod/common/scripted_effects/sllm_captive.txt · events/sllm_captive_events.txt, 화면: ui/fleet-captive.js(함대 사령부 창, 심문실 배경).
// 전투에서 적 함대의 마지막 배를 격침하면 25% 확률로 그 제독을 사로잡는다(동시에 3명까지). 심문실에서 LLM 대화로 심문하고, 대화가 협조도(0~100)를 움직인다.
// 처리: 몸값(에너지 300·영향력 25, 상대 호감 +15) · 심문(첩보 수준 +협조도에 비례, 한 번) · 회유(협조도 70 이상, 우리 지도자로, 상대 호감 −50) · 처형(상대 호감 −100) · 석방(상대 호감 +40).
import type { ChatMessage } from './player2';
import { L } from './i18n-pick';

export const CAP = { coopStart: 30, coopStep: 8, recruitAt: 70, maxTurns: 12, textMax: 600, slots: 3, keep: 40 } as const;
export type CapAct = 'ransom' | 'interrogate' | 'recruit' | 'execute' | 'release' | 'secret'; // secret = 비밀 처형(3단계: 숨은 악명 +8, 상대는 모름)
export const ACT_CODE: Record<CapAct, number> = { ransom: 1, interrogate: 2, recruit: 3, execute: 4, release: 5, secret: 6 };
export interface CapLine { who: 'ruler' | 'captive' | 'note'; text: string }
export interface Captive { slot: number; name: string; fidx: number; fname: string; date: string; coop: number; talk: CapLine[]; questioned?: boolean; turns: number }

export const clampCoop = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
/** 심문으로 얻는 첩보 수준(협조도 0 → 10, 100 → 50). */
export const intelOf = (coop: number): number => Math.round(10 + clampCoop(coop) * 0.4);
export const canRecruit = (c: Captive): boolean => c.coop >= CAP.recruitAt;
export const checkText = (t: string): string | null => { const s = t.trim(); if (s.length < 2) return L('2자 이상 입력해 주세요.', 'Please enter at least 2 characters.'); if (s.length > CAP.textMax) return L(`${CAP.textMax}자까지 입력할 수 있습니다.`, `Up to ${CAP.textMax} characters.`); return null; };

/** 게임 명령: 처리 하나. root = 플레이어인 이벤트(sllm_cap.2)를 불러 sllm_capN@root 를 맞게 푼다. */
export function actCommand(req: number, sid: string, slot: number, act: CapAct, intel: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !(slot >= 1 && slot <= CAP.slots) || !(act in ACT_CODE)) throw new Error('INVALID_CAP');
  const i = Math.max(1, Math.min(60, Math.round(intel)));
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_cap_req value = ${req} } set_variable = { which = sllm_cap_act value = ${ACT_CODE[act]} } set_variable = { which = sllm_cap_slot value = ${slot} } set_variable = { which = sllm_cap_intel value = ${i} } country_event = { id = sllm_cap.2 } }`;
}

/** 심문 대화(영어 지시, 답은 AI 응답 언어). JSON {"reply","coop"}. */
export function interrogationMessages(c: Captive, us: string, profile: string, text: string): ChatMessage[] {
  return [
    { role: 'system', content: `You are ${c.name}, a fleet admiral of ${c.fname || 'an enemy empire'}. Your fleet was destroyed in battle and you were captured by ${us}. You are held in an interrogation room aboard their flagship, and the ruler of ${us} is questioning you in person. Stay fully in character as a real officer: proud, defiant, frightened, bargaining or curious as fits how you are treated and what you believe. Never break character and never mention being an AI. Speak 1–4 sentences, in the first person, only your own words. Do not invent precise military numbers; you may hint, refuse or mislead. Then judge how the ruler's words just now changed your willingness to cooperate or even serve them: coop from -2 (much less willing) to +2 (much more). Threats can work on some officers and harden others; respect, honesty and good offers usually help. Your current willingness is ${c.coop}/100. JSON only: {"reply":"...","coop":0}` },
    { role: 'user', content: JSON.stringify({ your_empire: c.fname, your_empire_profile: profile || undefined, captured_on: c.date, conversation: c.talk.filter((x) => x.who !== 'note').slice(-12), ruler_says: text }) },
  ];
}
/** 처음 끌려왔을 때 한마디(질문 없이). */
export function openingMessages(c: Captive, us: string, profile: string): ChatMessage[] {
  return [
    { role: 'system', content: `You are ${c.name}, a fleet admiral of ${c.fname || 'an enemy empire'}, just captured in battle by ${us} and brought into an interrogation room to face their ruler. Say your first words when you are brought in (1–3 sentences, in character, first person, only your own words). Never mention being an AI. JSON only: {"reply":"...","coop":0}` },
    { role: 'user', content: JSON.stringify({ your_empire: c.fname, your_empire_profile: profile || undefined }) },
  ];
}
export function parseReply(raw: string): { reply: string; coop: number } | null {
  const m = /\{[\s\S]*\}/.exec(raw || ''); if (!m) return null;
  try { const j = JSON.parse(m[0]) as Record<string, unknown>; const reply = String(j.reply ?? '').trim(); if (!reply) return null; const k = Math.round(Number(j.coop)); return { reply: reply.slice(0, 1200), coop: Number.isFinite(k) ? Math.max(-2, Math.min(2, k)) : 0 }; } catch { return null; }
}

export function actResultText(c: Captive, act: CapAct, us: string, intel: number): string {
  switch (act) {
    case 'ransom': return L(`${c.fname}에서 몸값을 받고 ${c.name} 제독을 돌려보냈다 — 에너지 300·영향력 25.`, `Ransomed Admiral ${c.name} back to ${c.fname} — 300 energy and 25 influence.`);
    case 'interrogate': return L(`${c.name} 제독을 심문해 ${c.fname}에 대한 첩보를 얻었다(첩보 수준 +${intel}).`, `Interrogated Admiral ${c.name} and gained intelligence on ${c.fname} (intel +${intel}).`);
    case 'recruit': return L(`${c.name} 제독이 ${us}에 충성을 맹세했다 — 우리 지도자 명단에 들어왔다.`, `Admiral ${c.name} has sworn allegiance to ${us} and joined our leader pool.`);
    case 'execute': return L(`${c.name} 제독을 처형했다. ${c.fname}의 분노가 크다.`, `Executed Admiral ${c.name}. ${c.fname} is furious.`);
    case 'secret': return L(`${c.name} 제독을 아무도 모르게 처형했다. ${c.fname}은(는) 그가 실종된 줄로 안다 — 숨은 악명 +8.`, `Admiral ${c.name} was executed in secret. ${c.fname} believes them missing — hidden infamy +8.`);
    default: return L(`${c.name} 제독을 조건 없이 ${c.fname}로 돌려보냈다.`, `Released Admiral ${c.name} unconditionally back to ${c.fname}.`);
  }
}
/** 뉴스·연대기 한 줄(상대국 쪽 기록). */
export function chronText(c: Captive, act: CapAct, us: string): string {
  switch (act) {
    case 'ransom': return L(`사로잡힌 우리 제독 ${c.name}이(가) 몸값을 치르고 ${us}에서 돌아왔다`, `Our captured admiral ${c.name} returned from ${us} after a ransom`);
    case 'release': return L(`${us}이(가) 사로잡은 우리 제독 ${c.name}을(를) 조건 없이 풀어주었다`, `${us} released our captured admiral ${c.name} without conditions`);
    case 'recruit': return L(`사로잡힌 우리 제독 ${c.name}이(가) ${us} 편으로 넘어갔다`, `Our captured admiral ${c.name} defected to ${us}`);
    case 'execute': return L(`${us}이(가) 사로잡은 우리 제독 ${c.name}을(를) 처형했다`, `${us} executed our captured admiral ${c.name}`);
    case 'secret': return L(`${us}에 사로잡혔던 우리 제독 ${c.name}의 행방이 끊겼다`, `Our admiral ${c.name}, once held captive by ${us}, has vanished without a trace`);
    default: return L(`${us}이(가) 사로잡은 우리 제독 ${c.name}을(를) 심문했다`, `${us} interrogated our captured admiral ${c.name}`);
  }
}
