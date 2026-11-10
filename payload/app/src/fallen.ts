// 몰락한 제국·각성한 제국의 외교 통신(2026-10-19 사용자 결정).
// 1) 말투: 젊은 제국을 하등·미개한 존재, 아직 배워야 할 존재로 본다. 종류(가치관)에 따라 「보호해야 할 하등 생물」로 보기도 한다.
// 2) 각성: 여전히 미개하게 보지만, 깨어난 이유가 있어 늘 분노에 차 있다. 단호하고 철저하게 개미를 보는 시선.
// 3) 몰락(잠든) 상태: 일방적인 통신. 그들이 응할 때만 연결되고, 한 번 말을 주고받을 때마다 통신을 끊을 확률이 20%씩 오른다. 거절·끊음 뒤 그 해에는 다시 응하지 않는다.
// 순수 모듈(전자·파일 없음). 문구는 L(한, 영). AI 지시문은 영어(답 언어는 AiRouter 가 정함).
import { L } from './i18n-pick';

export type FallenState = 'dormant' | 'awakened';
export type FallenKind = 'xenophile' | 'materialist' | 'spiritualist' | 'xenophobe' | 'machine' | 'unknown'; // machine: 고대 관리인(기계 몰락제국, 알파 11)

/** 국가 유형 키(GetCountryType) → 몰락/각성. 아니면 null. */
export function fallenState(type: string | undefined | null): FallenState | null {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'fallen_empire') return 'dormant';
  if (t === 'awakened_fallen_empire') return 'awakened';
  return null;
}

/** 몰락한 제국의 종류: 가치관 키가 먼저, 없으면 성향(personality) 이름(한/영)으로. */
export function fallenKind(ethicIds?: string[] | null, personality?: string): FallenKind {
  const ids = (ethicIds || []).map((x) => String(x).toLowerCase());
  const has = (k: string) => ids.some((x) => x.includes(k));
  if (has('gestalt') || has('machine')) return 'machine'; // 고대 관리인: 단일 의식(기계) 몰락제국(알파 11)
  if (has('xenophile')) return 'xenophile';
  if (has('materialist')) return 'materialist';
  if (has('spiritualist')) return 'spiritualist';
  if (has('xenophobe')) return 'xenophobe';
  const p = String(personality || '').toLowerCase();
  if (/caretaker|machine|관리인|기계/.test(p)) return 'machine';
  if (/observer|관찰/.test(p)) return 'xenophile';
  if (/keeper|knowledge|지식/.test(p)) return 'materialist';
  if (/holy|guardian|성스러운|수호/.test(p)) return 'spiritualist';
  if (/isolation|militant|고립|호전/.test(p)) return 'xenophobe';
  return 'unknown';
}

const VIEW: Record<FallenKind, string> = {
  xenophile: 'You are benevolent wardens: you see them as fragile lesser creatures under your protection, like small animals in a preserve. Your condescension is gentle and patronizing; you shield them, scold them and keep them from hurting themselves or one another.',
  materialist: 'You are keepers of knowledge: you see them as ignorant pupils who must still learn, toddlers playing with technology they do not understand. Lecture them, correct them, and warn them away from forbidden or dangerous science.',
  spiritualist: 'You are holy guardians: you see them as a lost, ignorant flock who know nothing of the sacred. Speak with serene, righteous condescension, as to children who must be kept away from holy worlds and taught reverence.',
  xenophobe: 'You are militant isolationists: you see them as lesser vermin. Your contempt is cold and full of disgust; you tolerate their existence only while they keep their distance from your borders.',
  machine: 'You are the Ancient Caretakers: a machine intelligence left behind by creators who vanished long ago, still carrying out maintenance protocols over a galaxy that has changed beyond your parameters. You see the younger empires as unstable biological and synthetic processes to be monitored, catalogued and, when required, corrected. Speak in terse protocol language, cite your directives and your absent creators, and never show emotion. You may set them tasks of the kind your protocols allow: accepting inoculations, permitting changes to their code, providing worker units, or striking at an empire that threatens the balance.',
  unknown: 'See them as lesser beings who still have everything to learn.',
};
const WHY_AWAKE: Record<FallenKind, string> = {
  xenophile: 'the younger races have grown too reckless to be left unsupervised, and the wards must now be disciplined by force',
  materialist: 'the younger races reached for knowledge and technology they were never meant to touch',
  spiritualist: 'the younger races have desecrated what is sacred',
  xenophobe: 'the alien filth has spread too far and must be purged or driven back',
  machine: 'your dormant protocols have been reactivated: the galaxy has drifted into error and order must be restored, whatever your creators would have wanted',
  unknown: 'the younger races crossed a line that should never have been crossed',
};

// 몰락제국과의 지난 일(알파 11, 2026-10-25): 게임의 과업·선물 의견 수정자를 모드가 비트로 보낸다(sllm_probe_terminal.txt sllm_fe_m). 대화에서만 쓴다(게임 효과·감정 수치 없음).
export const FE_MEM = { completed: 1, accepted: 2, refusedReq: 4, refusedTask: 8, failed: 16, spurned: 32, gift: 64, active: 128, angered: 256 } as const;
const FE_MEM_LINE: [number, string][] = [
  [FE_MEM.active, 'A task you set them is still in progress. In your manner, ask whether they are carrying it out, and make clear you are watching.'],
  [FE_MEM.completed, 'They once completed a task you set them. You may acknowledge it with faint, condescending approval.'],
  [FE_MEM.accepted, 'They once accepted a request of yours.'],
  [FE_MEM.refusedReq, 'They once refused a request of yours. You have not forgotten their insolence.'],
  [FE_MEM.refusedTask, 'They once refused a task you set them.'],
  [FE_MEM.failed, 'They failed a task you set them. Remind them of their failure.'],
  [FE_MEM.spurned, 'They spurned a gift you offered. You remember it.'],
  [FE_MEM.gift, 'You once gave them a gift. Remind them of your generosity and of what is expected of them in return.'],
  [FE_MEM.angered, 'Your protocols flagged them as hostile after an earlier incident.'],
];
/** 지난 일 줄(영어). 많아도 3줄까지(진행 중인 과업이 먼저). */
export function fallenMemoryLines(mask: number | undefined): string[] {
  const m = Math.trunc(Number(mask) || 0); if (m <= 0) return [];
  const out = FE_MEM_LINE.filter(([b]) => (m & b) !== 0).map(([, t]) => t).slice(0, 3);
  return out.length ? ['[Your history with them] ' + out.join(' ')] : [];
}
/** 대화 AI 지시 줄. final = 이번 답을 마지막으로 통신을 끊는다(몰락 상태). wih = 하늘의 전쟁 진행 중(알파 11). */
export function fallenLines(state: FallenState, kind: FallenKind, final = false, opt: { mask?: number; wih?: boolean } = {}): string[] {
  const out: string[] = [];
  if (state === 'dormant') {
    out.push('You are a Fallen Empire: an ancient civilization of immense, near-godlike advancement that has slumbered in quiet decline for millennia. You regard the younger empires, including this one, as lesser, primitive beings who still have everything to learn. Never treat them as equals; speak down to them.');
    out.push(VIEW[kind]);
    out.push('This is a one-sided transmission, not a dialogue. You pronounce; you do not converse. Do not ask them questions, do not negotiate, do not explain yourself at length; dismiss whatever you judge beneath you. You only deigned to answer at all.');
    out.push('You do not trade, make deals, open borders, promise treaties or declare war in this channel. Use action type none.');
    if (final) out.push('This reply is your last: you are done with them. End with a curt, dismissive line that makes clear you are closing the channel.');
  } else {
    out.push('You are an Awakened Fallen Empire: an ancient, near-godlike civilization that has risen from its long slumber because ' + WHY_AWAKE[kind] + '. You still regard the younger empires as primitive lesser beings.');
    out.push(VIEW[kind]);
    out.push('Now you are always filled with wrath. Be curt, absolute and merciless: no warmth, no bargaining as equals, only verdicts and commands. Look at them the way one looks at ants.');
    if (opt.wih) out.push('The War in Heaven rages: you are locked in war with another awakened ancient empire for the fate of the galaxy. Demand that these lesser beings stand with you, or at the very least stay out of your way; those who side with your rival, or hide behind the so-called Non-Aligned League, will be remembered.');
  }
  for (const l of fallenMemoryLines(opt.mask)) out.push(l);
  return out;
}

/** 몰락 상태가 통신에 응할 확률(0.1~0.85). 호감이 높을수록, 보호자형(외계인 친화)일수록 잘 응한다. 전쟁 중이면 0.1. */
export function answerChance(score: number, kind: FallenKind, atWar = false): number {
  if (atWar) return 0.1;
  const base = 0.35 + (Number(score) || 0) / 200 + (kind === 'xenophile' ? 0.15 : kind === 'xenophobe' ? -0.1 : 0);
  return Math.max(0.1, Math.min(0.85, base));
}
/** n 번째 주고받기(1부터)에서 이 답을 마지막으로 끊을 확률: 20%씩 늘어 5번째에 100%. */
export function hangupChance(n: number): number { return Math.max(0, Math.min(1, 0.2 * Math.max(1, Math.floor(n)))); }

/** 게임 날짜 'YYYY.MM.DD' → 해 열쇠 'YYYY'. 끊거나 거절한 해에는 다시 응하지 않는다(2026-10-19 사용자 결정). */
export const yearKey = (date: string) => (/^(\d{3,4})\./.exec(String(date || '')) || [])[1] || '';

/** 각성할 때 가로챈 신호(한·영, 알파 11). */
export function awakenSignal(kind: FallenKind): [string, string] {
  return ({
    xenophile: ['보살핌의 시간은 끝났다. 이제 우리가 직접 질서를 세운다.', 'The time of gentle care is over. Now we shall impose order ourselves.'],
    materialist: ['너희는 손대지 말아야 할 것에 손을 댔다. 그 대가를 치르게 될 것이다.', 'You reached for what you were never meant to touch. You will pay the price.'],
    spiritualist: ['신성한 것이 더럽혀졌다. 심판의 때가 왔다.', 'What is sacred has been defiled. The hour of judgement has come.'],
    xenophobe: ['외계의 오물이 너무 멀리 퍼졌다. 이제 쓸어 낸다.', 'The alien filth has spread too far. Now it will be swept away.'],
    machine: ['휴면 규약 해제. 오류 상태의 은하를 교정한다.', 'Dormancy protocol lifted. Correcting a galaxy in error state.'],
    unknown: ['잠든 자가 깨어났다.', 'The sleeper has awoken.'],
  } as Record<FallenKind, [string, string]>)[kind];
}
/** 화면 안내 문구. */
export const fallenText = {
  refused: (name: string) => L(`${name}은(는) 통신에 응하지 않았습니다. 하등한 존재의 부름에 답할 생각이 없는 듯합니다.`, `${name} did not answer the call. They seem to have no interest in answering lesser beings.`),
  refusedYear: (name: string) => L(`${name}은(는) 올해에는 다시 응하지 않습니다. 내년에 다시 시도하세요.`, `${name} will not answer again this year. Try again next year.`),
  accepted: (name: string) => L(`${name}이(가) 통신에 응했습니다. 몰락한 제국은 언제든 통신을 끊을 수 있습니다.`, `${name} answered the call. A fallen empire may cut the channel at any moment.`),
  hungUp: (name: string) => L(`${name}이(가) 통신을 끊었습니다.`, `${name} closed the channel.`),
  closed: () => L('통신이 끊겼습니다. 외교 단말기에서 다시 연결하세요(올해에는 응하지 않습니다).', 'The channel is closed. Reconnect from the diplomatic terminal (they will not answer again this year).'),
};
