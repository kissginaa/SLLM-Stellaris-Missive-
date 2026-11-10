// 감정 기억 → 실제 게임 행동(알파 11, 2026-10-25, 사용자 결정 「다 넣어」). 순수 규칙. 앱: src/features/emotions-app.ts, 모드: tester-mod/common/scripted_effects/sllm_emotion_acts.txt.
// 群星AI mod 의 AI 행동(위협·포위 심리·강대국 경계·원조·도움 요청·복수/틈탄 선전포고)을 우리 감정 수치로 고른다. LLM 호출 없음.
// 앱은 감정으로 「해도 되는 행동」만 고르고, 게임 쪽 효과가 실제 상황(자원·전쟁·전력·쿨다운)을 다시 확인한다.
// 선전포고는 설정(emotionWar)을 켰을 때만. 대화로 생긴 감사·원한은 이미 호감 변화로 게임에 들어가므로 호감 수정자로 또 넣지 않는다.
import { EMO, type Emotions } from './emotions';
import { wrapForPlayer } from './protocol';

export const ACT = { strong: EMO.hot, revenge: 60 } as const;
export type ActName = 'wary' | 'arrogant' | 'threat3' | 'threat2' | 'coalition' | 'coalition_end' | 'aid' | 'help' | 'revenge' | 'opportunism';
export interface ActInput { idx: number; e: Emotions; pw: 0 | 1 | 2; /** 공동 대응 협약 상대: 선전포고 행동을 고르지 않는다 */ noWar?: boolean }

/** 감정·전력으로 고른 행동 목록(시험·진단용). */
export function plannedActs(i: ActInput, opt: { war: boolean }): ActName[] {
  const e = i.e, s = ACT.strong, out: ActName[] = [];
  if (i.pw === 1) out.push('wary'); else if (i.pw === 2) out.push('arrogant');
  if (e.grudge >= s) out.push('threat3');
  if (e.fear >= s) out.push('threat2');
  out.push(e.grudge >= s || e.fear >= s ? 'coalition' : 'coalition_end');
  if (e.gratitude >= s) out.push('aid');
  if (e.fear >= s || e.gratitude >= s) out.push('help');
  if (opt.war && !i.noWar) { if (e.grudge >= ACT.revenge) out.push('revenge'); else if (e.ambition >= s) out.push('opportunism'); }
  return out;
}
const EFFECT: Record<ActName, string> = {
  wary: 'sllm_emo_wary = yes', arrogant: 'sllm_emo_arrogant = yes',
  threat3: 'sllm_emo_threat = { AMT = 3 }', threat2: 'sllm_emo_threat = { AMT = 2 }',
  coalition: 'sllm_emo_coalition = yes', coalition_end: 'sllm_emo_coalition_end = yes',
  aid: 'sllm_emo_aid = yes', help: 'sllm_emo_help = yes',
  revenge: 'set_variable = { which = sllm_emo_kind value = 1 } sllm_emo_war = yes',
  opportunism: 'set_variable = { which = sllm_emo_kind value = 2 } sllm_emo_war = yes',
};
/** 감정 지도 깃발: 가장 센 감정 하나(20 이상). 2 = 강함(40 이상), 1 = 눈에 띔. 없으면 빈 글. */
export function emotionFlag(e: Emotions): string {
  let best: keyof Emotions | null = null;
  for (const k of ['grudge', 'gratitude', 'fear', 'ambition'] as const) if (e[k] >= EMO.notable && (!best || e[k] > e[best])) best = k;
  return best ? `sllm_emf_${best}_${e[best] >= EMO.hot ? 2 : 1}` : '';
}
/** 한 나라 몫. 같은 분기(q)에 두 번 들어가도 한 번만 일어나도록 AI 쪽에 분기 번호를 적는다. */
export function actBlock(i: ActInput, q: number, opt: { war: boolean }): string {
  const idx = Math.trunc(i.idx), qq = Math.trunc(q);
  if (!(idx > 0) || !(qq >= 1)) return '';
  return `random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } NOT = { check_variable = { which = sllm_emo_q value = ${qq} } } } set_variable = { which = sllm_emo_q value = ${qq} } sllm_emo_clear_stance = yes sllm_emo_flags_clear = yes ${(() => { const f = emotionFlag(i.e); return f ? `set_country_flag = ${f} ` : ''; })()}${plannedActs(i, opt).map((a) => EFFECT[a]).join(' ')} sllm_emo_marks = yes }`; // 지도 이름표: 행동 뒤(이번 분기에 맺은 원조 협정도 바로 표시)
}
/** 콘솔 명령들(길면 나눈다). 플레이어를 event_target:sllm_player 로 먼저 저장한다. */
export function actCommands(list: ActInput[], q: number, opt: { war: boolean }, maxLen = 1800): string[] {
  const out: string[] = []; let cur: string[] = [], len = 0;
  const flush = () => { if (cur.length) out.push(wrapForPlayer('save_event_target_as = sllm_player ' + cur.join(' '))); cur = []; len = 0; };
  for (const i of list) { const b = actBlock(i, q, opt); if (!b) continue; if (len && len + b.length > maxLen) flush(); cur.push(b); len += b.length; }
  flush();
  return out;
}
/** 게임 날짜 → 분기 번호(90일 단위). 1부터(게임에서 안 적힌 변수는 0으로 읽히므로). */
export const quarterOf = (day: number) => Math.floor(day / 90) + 1;
/** 도움 요청 편지의 사유(영어, 기존 서신 기능 writeLetter 의 why). */
export const HELP_WHY = 'You are at war with another empire and the war weighs on you. Write to them asking for help: military support, resources or diplomatic pressure, in keeping with your personality and your feelings toward them.';
