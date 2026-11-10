// 타국 지인 개인 서신(45)의 순수 규칙. 2026-10-23 Claude 사전 설계.
// 사용자 확정: 만찬 등에서 연락처를 교환한 타국 지인과 안부·지난 만남·개인 의견·다음 만남 서신 /
//   개인 의견은 국가 공식 입장과 구분 / 「다음 만남」 의사만으로 방문·게임 이동 확정 없음 /
//   직책·확인된 권한이 없으면 조약·자원 약속 불가 → 주최국 통치자 전달 또는 공식 외교로 안내 / 「전달하겠다」를 실제 전달로 저장하지 않음 /
//   통치자·상대가 바뀌면 후임에게 대화 승계 없음 / 없는 공동 추억 금지 / 사적 편지 자동 공유 금지 / 편지 열 때마다 재생성 금지.
// 응답 확률·대기 기간·호감 증감은 미정 → 상수 없음(호출 쪽 훅).
import { L } from './i18n-pick';
import type { Pid } from './relations';
import type { ForeignBanquetInvite } from './foreign-banquet';

export type LetterTopic = 'greetings' | 'past_meeting' | 'personal_opinion' | 'next_meeting';
export const topicLabel = (t: LetterTopic): string => ({ greetings: L('안부·근황', 'Greetings and news'), past_meeting: L('지난 만남', 'Our last meeting'), personal_opinion: L('개인 의견', 'Personal opinion'), next_meeting: L('다음 만남', 'Meeting again') })[t];

/** 서신 묶음 키(45): 캠페인·발신 통치자·수신 인물. 통치자가 바뀌면 다른 묶음 → 승계 없음. */
export const threadKey = (sid: string, rulerPid: Pid, foreign: Pid): string => `${sid}|${rulerPid}|${foreign}`;
export interface ForeignLetter { id: string; from: Pid; to: Pid; topic?: LetterTopic; text: string; on: string; reply?: { text: string; on: string; claims: Claim[] }; refs: string[] }
export interface ForeignThread { key: string; sid: string; ruler: Pid; foreign: Pid; empireIdx: number; contactFrom: string; letters: ForeignLetter[] }

/** 연락처를 실제로 교환한 사람만(44 의 record.contacts). 그 만찬을 받은 통치자 본인만. */
export function contactSource(invites: ForeignBanquetInvite[], ruler: Pid, foreign: Pid): ForeignBanquetInvite | null {
  return invites.find((i) => i.state === 'completed' && i.recipient === ruler && !!i.record?.contacts.includes(foreign)) ?? null;
}
/** 편지 쓸 자격(45). 상대 생애·은퇴는 호출 쪽 상태로(은퇴 이후는 18·19 규칙). */
export function canWrite(invites: ForeignBanquetInvite[], ruler: Pid, foreign: Pid, foreignStatus: 'active' | 'retired_contactable' | 'retired_lost' | 'dead' | 'unknown'): { ok: boolean; why?: string } {
  if (!contactSource(invites, ruler, foreign)) return { ok: false, why: L('연락처를 교환한 지인이 아닙니다.', 'You have not exchanged contacts with this person.') };
  if (foreignStatus === 'dead') return { ok: false, why: L('이미 세상을 떠난 인물입니다.', 'This person has passed away.') };
  if (foreignStatus === 'retired_lost') return { ok: false, why: L('연락이 끊긴 인물입니다.', 'Contact with this person has been lost.') };
  if (foreignStatus === 'unknown') return { ok: false, why: L('지금 연락 가능한지 확인할 수 없습니다.', 'Cannot confirm this person can be reached.') };
  return { ok: true };
}

/** 국가 권한이 필요한 요청(45). 앱이 플레이어 글에서 미리 걸러 AI 맥락에 「권한 경계」를 붙인다. 낱말은 자리값. */
export type StateAsk = 'treaty' | 'resources' | 'official_statement' | 'military' | 'classified';
const ASK_WORDS: Record<StateAsk, RegExp> = {
  treaty: /조약|동맹|협정|불가침|연방|treaty|alliance|pact|federation|non-?aggression/i,
  resources: /자원|에너지|광물|합금|식량|지원금|원조|resource|energy|minerals?|alloys?|food|aid|credits/i,
  official_statement: /공식 ?입장|성명|발표|official (position|statement)|announce/i,
  military: /함대|군대|파병|전쟁|fleet|troops|army|war/i,
  classified: /기밀|비밀|첩보|classified|secret|intel/i,
};
export function stateAsks(text: string): StateAsk[] { return (Object.keys(ASK_WORDS) as StateAsk[]).filter((k) => ASK_WORDS[k].test(text)); }
/** 상대의 권한(45): 그 제국 통치자면 국가 권한, 아니면 확인된 직책 권한만. 자료가 없으면 없음. */
export type Authority = 'state' | 'office' | 'none';
export function authorityOf(f: { isRuler?: boolean; verifiedOffice?: string }): Authority { return f.isRuler === true ? 'state' : f.verifiedOffice ? 'office' : 'none'; }
/** 요청 처리 경로: 권한이 없으면 「통치자에게 전달 의사」(실제 전달 아님) 또는 「공식 외교로 안내」. */
export function routeAsk(a: StateAsk, auth: Authority): 'personal_reply_only' | 'forward_intent' | 'official_channel' {
  if (a === 'classified') return 'personal_reply_only'; // 친분은 기밀 접근 권한이 아니다
  if (auth === 'state') return 'official_channel'; // 통치자라도 편지로 체결하지 않는다 → 공식 외교 절차로
  return a === 'official_statement' ? 'personal_reply_only' : 'forward_intent';
}
/** AI 맥락용 경계 문장(정형). */
export function boundaryNote(asks: StateAsk[], auth: Authority): string[] {
  return asks.map((a) => {
    const r = routeAsk(a, auth);
    return r === 'official_channel' ? L('국가 약속은 편지로 확정하지 않고 공식 외교 절차를 안내한다.', 'Do not commit the state by letter; point to official diplomacy.')
      : r === 'forward_intent' ? L('국가 권한이 없다. 통치자에게 전하겠다는 개인 의사만 말할 수 있고, 전달·체결·지급을 했다고 말하지 않는다.', 'No state authority. May only say they will pass it on; never claim it was delivered, signed or paid.')
      : L('개인 의견으로만 답한다. 국가 공식 입장·기밀을 말하지 않는다.', 'Answer only as a personal view; no official position or secrets.');
  });
}

/** 답장 속 「주장」(45): 앱이 저장하는 상태는 이것뿐. executed 는 실제 게임 경로가 확인됐을 때만 따로 설정한다(여기서는 만들지 않는다). */
export interface Claim { kind: 'personal_view' | 'intent_forward' | 'wish_meet' | 'promise_personal'; text: string; executed: false }
export function classifyReplyClaims(reply: string): Claim[] {
  const out: Claim[] = []; const t = String(reply ?? '');
  if (/전하겠|전달하겠|말씀드리겠|pass (it|this) on|let .* know|will tell/i.test(t)) out.push({ kind: 'intent_forward', text: L('통치자에게 전하겠다는 개인 의사', 'Personal intent to pass it on'), executed: false });
  if (/다시 만나|또 뵙|다음에 뵙|meet again|see you again|next visit/i.test(t)) out.push({ kind: 'wish_meet', text: L('다시 만나고 싶다는 의사(일정 아님)', 'Wish to meet again (not a schedule)'), executed: false });
  if (/생각에는|개인적으로|제 생각|personally|in my view|i think/i.test(t)) out.push({ kind: 'personal_view', text: L('개인 의견(국가 입장 아님)', 'Personal view (not official)'), executed: false });
  return out;
}

/** 공동 추억 근거(45): 실제 만찬·선물·약속만. 다른 통치자가 받은 만찬은 넣지 않는다. */
export function sharedMemories(invites: ForeignBanquetInvite[], ruler: Pid, foreign: Pid): { banquetId: string; on?: string; gifts: string[]; promises: string[] }[] {
  return invites.filter((i) => i.state === 'completed' && i.recipient === ruler && !!i.record?.met.includes(foreign))
    .map((i) => ({ banquetId: i.id, on: i.completedOn, gifts: [...(i.record?.gifts ?? [])], promises: [...(i.record?.promises ?? [])] }));
}
/** AI 가 언급한 사건 ID 가 실제 추억인지 — 없는 ID 는 버린다. */
export const validRefs = (refs: string[], mem: { banquetId: string }[]): string[] => refs.filter((r) => mem.some((m) => m.banquetId === r));

/** 편지 보내기·답장 저장(45): 같은 편지 ID 는 한 번, 답장도 한 번(재열람으로 재생성 없음). 늦은 답장은 묶음 키가 맞을 때만. */
export function addLetter(th: ForeignThread, l: Omit<ForeignLetter, 'reply'>): boolean {
  if (th.letters.some((x) => x.id === l.id) || l.from !== th.ruler || l.to !== th.foreign) return false;
  th.letters.push({ ...l, refs: [...l.refs] }); return true;
}
export function saveReply(th: ForeignThread, letterId: string, threadKeyNow: string, reply: { text: string; on: string }): boolean {
  if (threadKeyNow !== th.key) return false; // 통치자 교체 뒤 도착한 답장
  const l = th.letters.find((x) => x.id === letterId); if (!l || l.reply) return false;
  l.reply = { text: reply.text, on: reply.on, claims: classifyReplyClaims(reply.text) }; return true;
}
/** 공유 범위(45): 사적 서신은 통치자 본인만. 신문·비서·다른 인물 맥락에 넣지 않는다. */
export const letterVisibleTo = (th: ForeignThread, viewer: Pid | 'player' | 'secretary' | 'press'): boolean => viewer === 'player' || viewer === th.ruler;
