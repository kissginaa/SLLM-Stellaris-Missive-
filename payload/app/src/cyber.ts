// 사이버전·해외발 여론 공작(2026-11-04 사용자) — 순수 규칙. 앱: src/features/cyber-app.ts · 모드: events/sllm_cyber_events.txt, common/situations/sllm_cyber_situations.txt
// 역제소(2026-11-04 사용자): 진행 중인 공작을 은하재판소에 제소. 증거가 없어도 걸 수 있지만 거의 진다. 공작 하나에 한 번.
// 모드 줄: SLLM:CYBER/;/ev=start|stage|ap|end/;/sid=/;/from=(공작국 sllm_idx, 모르면 0)/;/n=(단계)/;/ap=(0 무시·1 사이버 사령부·2 외교 항의·3 역공작)/;/res=(1 격퇴·2 장악)/;/date=/;/name=(시작 때 공작국 이름, 맨 끝)

export const CYBER = { keep: 20 } as const;
export type CyberAp = 0 | 1 | 2 | 3;
/** res: -1 진행 중 · 0 알 수 없음(끝 줄을 못 받음) · 1 격퇴 · 2 장악당함 */
export interface CyberOp { from: number; name: string; start: string; stage: number; ap: CyberAp; aps: CyberAp[]; end: string; res: -1 | 0 | 1 | 2; apSince?: string; ev?: number; trial?: CyberTrial }
export type CyberEv =
  | { ev: 'start'; sid: string; from: number; date: string; name: string }
  | { ev: 'stage'; sid: string; from: number; date: string; n: number }
  | { ev: 'ap'; sid: string; from: number; date: string; ap: CyberAp }
  | { ev: 'end'; sid: string; from: number; date: string; res: 1 | 2; ap: CyberAp };

const num = (v: unknown): number => { const n = Number(String(v ?? '').replace(/^\\/, '').trim()); return Number.isFinite(n) ? Math.round(n) : NaN; };
const str = (v: unknown): string => String(v ?? '').replace(/^\\/, '').trim();
const apOf = (v: unknown): CyberAp => { const n = num(v); return n === 1 || n === 2 || n === 3 ? n : 0; };

/** 로그 한 줄의 kv → 사건. 모르는 줄은 null. */
export function readCyber(kv: Record<string, unknown>): CyberEv | null {
  const ev = str(kv.ev), sid = str(kv.sid).replace(/\.0+$/, ''), from = Math.max(0, num(kv.from) || 0), date = str(kv.date);
  if (!sid) return null;
  if (ev === 'start') return { ev, sid, from, date, name: str(kv.name).slice(0, 80) };
  if (ev === 'stage') { const n = num(kv.n); return n >= 1 && n <= 3 ? { ev, sid, from, date, n } : null; }
  if (ev === 'ap') return { ev, sid, from, date, ap: apOf(kv.ap) };
  if (ev === 'end') { const r = num(kv.res); return r === 1 || r === 2 ? { ev, sid, from, date, res: r, ap: apOf(kv.ap) } : null; }
  return null;
}

const AP: Record<CyberAp, [string, string]> = { 0: ['무시', 'Ignore it'], 1: ['사이버 사령부 투입', 'Cyber Command'], 2: ['외교 항의', 'Diplomatic protest'], 3: ['역공작', 'Counter-operation'] };
/** 대응 이름 [한, 영]. */
export const cyberApName = (ap: CyberAp): [string, string] => AP[ap] ?? AP[0];

type Two = { ko: string; en: string } | null;
/**
 * 연대기 줄. text = 공작국 쪽 연대기(국내 인터넷이 새로고침 때 「해외 IP」 선동 글·검열 논란으로 씀),
 * world = 세계 소식(신문·갤럭틱 포럼). 무시로 돌아갈 때는 아무것도 적지 않는다.
 */
export function cyberChron(kind: 'start' | 'stage' | 'ap' | 'end', op: CyberOp, us: string): { text: Two; world: Two } {
  const x = op.name;
  if (kind === 'start') return { text: { ko: `${us}의 인터넷 게시판에 해외 IP 계정들이 몰려들어 정부 비방·패배주의 글을 퍼뜨리기 시작했다. 배후로 ${x}이(가) 의심된다.`, en: `Accounts with foreign addresses flood ${us}'s message boards with slander against the government and defeatist rumours. ${x} is suspected to be behind it.` }, world: null };
  if (kind === 'stage') {
    if (op.stage === 2) return { text: { ko: `${x}발로 의심되는 선동 글이 ${us} 인터넷 인기 글을 휩쓸고, 게시판마다 「해외 공작이다」 「아니다」 싸움이 벌어진다.`, en: `Propaganda believed to come from ${x} tops ${us}'s trending boards; every forum argues over whether it is a foreign operation.` }, world: null };
    if (op.stage >= 3) return { text: { ko: `${us} 여론이 ${x}발 공작 글에 포위됐다. 정부 발표마다 「또 거짓말」 댓글이 수천 개씩 달린다.`, en: `${us}'s public opinion is under siege by ${x}'s campaign; every government statement draws thousands of "more lies" replies.` }, world: null };
    return { text: null, world: null };
  }
  if (kind === 'ap') {
    if (op.ap === 1) return { text: { ko: `${us} 정부가 사이버 사령부를 투입해 해외 계정 수천 개를 지웠다. 「검열이다」라는 반발도 거세다.`, en: `${us}'s government sends in Cyber Command and deletes thousands of foreign accounts, drawing angry cries of censorship.` }, world: null };
    if (op.ap === 2) return { text: { ko: `${us} 정부가 ${x}에 여론 공작을 정식으로 항의했다.`, en: `${us}'s government formally protests ${x}'s disinformation campaign.` }, world: { ko: `${us}, ${x}의 여론 공작에 공식 항의 — ${x}은(는) 「근거 없는 모함」이라며 부인.`, en: `${us} formally accuses ${x} of a disinformation campaign; ${x} denies it as "baseless slander".` } };
    if (op.ap === 3) return { text: { ko: `${us} 정보기관이 ${x}을(를) 겨냥한 역공작에 나섰다는 소문이 돈다.`, en: `Rumour has it that ${us}'s intelligence services have launched a counter-operation against ${x}.` }, world: null };
    return { text: null, world: null };
  }
  if (op.res === 2) return { text: { ko: `${x}발 여론 공작이 끝내 ${us} 여론을 장악했다. 정부 신뢰가 바닥이다.`, en: `${x}'s disinformation campaign has taken over ${us}'s public opinion; trust in the government has hit bottom.` }, world: { ko: `${x}, ${us} 여론 공작에 성공한 듯 — ${us} 전역에 불안 확산.`, en: `${x} appears to have hijacked ${us}'s public opinion; unrest spreads across ${us}.` } };
  return { text: { ko: `${us}이(가) ${x}발 여론 공작을 막아 냈다. 해외 계정들이 하룻밤 새 사라졌다.`, en: `${us} beats back ${x}'s disinformation campaign; the foreign accounts vanish overnight.` }, world: { ko: `${us}, ${x}의 여론 공작을 격퇴했다고 발표.`, en: `${us} announces it has repelled a disinformation campaign by ${x}.` } };
}

// ---- 역제소: 은하재판소(2026-11-04 사용자) ----
/** 증거 점수: 사이버 사령부 한 달 0.5 · 역공작 한 달 1 · 외교 항의 1(한 번) · 그 나라 첩보 수준 높음 +1, 완전 +2. 최대 6. */
export const TRIAL = { evMax: 6, says: 3, fee: 25, loseFee: 40, base: 0.08, perEv: 0.12, perLean: 0.05, pMin: 0.03, pMax: 0.9 } as const;
export interface CyberTrialTurn { who: 'us' | 'def' | 'judge'; text: string }
export interface CyberTrial { state: 'open' | 'won' | 'lost'; date: string; ev: number; exhibits: Array<[string, string]>; log: CyberTrialTurn[]; lean: number; says: number; p: number; ruling?: string }
const dayN = (d: string): number | null => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec((d || '').trim()); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + Number(m[3]) : null; };
/** 대응을 바꿀 때 지난 대응으로 쌓인 증거(달 단위). */
export function evidenceGain(ap: CyberAp, since: string | undefined, now: string): number {
  const a = since ? dayN(since) : null, b = dayN(now); if (a === null || b === null || b <= a) return 0;
  const months = (b - a) / 30; return ap === 3 ? months : ap === 1 ? months * 0.5 : 0;
}
export const intelBonus = (band: number | undefined): number => (band === 4 ? 2 : band === 3 ? 1 : 0);
/** 지금까지의 증거 점수(진행 중인 대응까지 셈, 정수로 내림). */
export function evidenceNow(op: CyberOp, now: string, band?: number): number {
  const v = (op.ev ?? 0) + evidenceGain(op.ap, op.apSince, now) + (op.aps.includes(2) ? 1 : 0) + intelBonus(band);
  return Math.max(0, Math.min(TRIAL.evMax, Math.floor(v)));
}
/** 증거 목록(재판에 내는 증거물 이름 [한, 영]) — 점수만큼, 어디서 얻었는지에 맞춰. */
export function trialExhibits(op: CyberOp, ev: number, band?: number): Array<[string, string]> {
  const pool: Array<[string, string]> = [];
  if (intelBonus(band) > 0) pool.push(['현지 공작원이 빼낸 공작 지시 문서', 'Operation orders smuggled out by our field agent']);
  if (op.aps.includes(3)) pool.push(['역공작으로 확보한 지휘 서버 접속 기록', 'Command-server logs seized by our counter-operation'], ['포섭한 상대 공작원의 진술서', 'Sworn statement from a turned enemy operative']);
  if (op.aps.includes(1)) pool.push(['삭제한 해외 계정들의 접속 경로 분석', 'Traffic analysis of the deleted foreign accounts'], ['같은 문장을 복사해 붙인 게시물 수천 건', 'Thousands of copy-pasted posts with identical wording']);
  if (op.aps.includes(2)) pool.push(['외교 항의 때 받은 앞뒤가 맞지 않는 해명', 'Their contradictory reply to our diplomatic protest']);
  pool.push(['공작 계정들의 활동 시간대 통계', 'Activity-hour statistics of the campaign accounts'], ['선동 글에 남은 외국식 표현', 'Foreign turns of phrase in the propaganda posts']);
  return pool.slice(0, ev);
}
export const trialChance = (ev: number, lean: number): number => Math.max(TRIAL.pMin, Math.min(TRIAL.pMax, TRIAL.base + TRIAL.perEv * ev + TRIAL.perLean * lean));
export function newTrial(op: CyberOp, now: string, band?: number): CyberTrial {
  const ev = evidenceNow(op, now, band);
  return { state: 'open', date: now, ev, exhibits: trialExhibits(op, ev, band), log: [], lean: 0, says: 0, p: trialChance(ev, 0) };
}
type Msg = { role: 'system' | 'user'; content: string };
const TRIAL_STAGE = (op: CyberOp, us: string, t: CyberTrial) => [
  `This is a hearing at the Galactic Tribunal. The plaintiff, ${us}, accuses ${op.name} of running a disinformation campaign on ${us}'s networks (fake accounts, slander, defeatist rumours). The defendant is ${op.name}'s ambassador, who denies everything.`,
  t.exhibits.length ? 'Evidence the plaintiff has filed: ' + t.exhibits.map((e, i) => `(${i + 1}) ${e[1]}`).join('; ') + '.' : 'The plaintiff has filed NO hard evidence at all — only suspicion. The defendant should exploit this mercilessly and the judges are skeptical.',
  'Stay in a sci-fi diplomatic courtroom tone. No real-world references.',
];
/** 우리 발언 하나 → 피고 대사의 반박 + 재판장 한마디 + 이번 발언이 원고에게 유리했는지(lean -1·0·1). */
export function trialSayMessages(op: CyberOp, us: string, t: CyberTrial, said: string): Msg[] {
  return [{ role: 'system', content: [...TRIAL_STAGE(op, us, t),
    'The plaintiff just spoke. Reply as the defendant ambassador (2-4 sentences, evasive, indignant or mocking) and then give one short remark from the presiding judge.',
    'Judge fairly: a statement that cites filed evidence concretely helps the plaintiff (lean 1); empty accusations, insults or claims without evidence hurt (lean -1); otherwise 0.',
    'Output only JSON: {"defense":"...","judge":"...","lean":0}',
  ].join('\n') }, { role: 'user', content: [...t.log.slice(-6).map((x) => `${x.who === 'us' ? 'Plaintiff' : x.who === 'def' ? 'Defendant' : 'Judge'}: ${x.text}`), `Plaintiff: ${said}`].join('\n') }];
}
export function readTrialSay(raw: string): { defense: string; judge: string; lean: number } | null {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>, cl = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 600) : '');
  const defense = cl(o.defense), judge = cl(o.judge), l = Number(o.lean); if (!defense) return null;
  return { defense, judge, lean: l > 0 ? 1 : l < 0 ? -1 : 0 };
}
/** 판결문(결과는 앱이 이미 정함 — LLM 은 글만). */
export function trialRulingMessages(op: CyberOp, us: string, t: CyberTrial, won: boolean): Msg[] {
  return [{ role: 'system', content: [...TRIAL_STAGE(op, us, t),
    won ? `The tribunal has found ${op.name} GUILTY of the disinformation campaign.` : `The tribunal has DISMISSED the case and rebuked ${us} for filing it${t.exhibits.length ? ' on insufficient evidence' : ' with no evidence'}.`,
    'Write the presiding judge\'s ruling in 2-3 formal sentences. Output only the ruling text.',
  ].join('\n') }, { role: 'user', content: t.log.slice(-8).map((x) => `${x.who === 'us' ? 'Plaintiff' : x.who === 'def' ? 'Defendant' : 'Judge'}: ${x.text}`).join('\n') || '(no statements)' }];
}
/** 판결을 게임에 적용: 수수료(영향력)는 늘, 이기면 공작 막대가 빨리 줄고(표식) 다른 제국들이 피고를 싫어함, 지면 영향력 더 잃고 공작이 탄력. */
export function trialCommand(req: number, sid: string, from: number, won: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(from) || from < 0) throw new Error('INVALID_TRIAL');
  const tag = `SLLM:CYBERTRIAL/;/req=${req}/;/sid=${sid}`;
  const conv = from > 0 ? `random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${from} } sllm_is_empire = yes } save_event_target_as = sllm_cy_d } `
    + 'if = { limit = { exists = event_target:sllm_cy_d } every_country = { limit = { sllm_is_empire = yes NOT = { is_same_value = event_target:sllm_cy_d } } add_opinion_modifier = { modifier = sllm_cyber_convicted who = event_target:sllm_cy_d } } } ' : '';
  const body = won ? `add_resource = { influence = -${TRIAL.fee} } set_country_flag = sllm_cy_trial_won ${conv}`
    : `add_resource = { influence = -${TRIAL.fee + TRIAL.loseFee} } set_country_flag = sllm_cy_trial_lost `;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body}log = "${tag}/;/status=applied" }`;
}
/** 재판 연대기: 제소(세계)·판결(세계, 지면 국내 망신 글). */
export function trialChron(kind: 'file' | 'won' | 'lost', op: CyberOp, us: string): { text: Two; world: Two } {
  const x = op.name;
  if (kind === 'file') return { text: null, world: { ko: `${us}, ${x}을(를) 여론 공작 혐의로 은하재판소에 제소.`, en: `${us} takes ${x} to the Galactic Tribunal over a disinformation campaign.` } };
  if (kind === 'won') return { text: { ko: `은하재판소가 ${x}의 ${us} 여론 공작에 유죄를 선고했다. 게시판에 「역시 해외 공작이었다」는 글이 쏟아진다.`, en: `The Galactic Tribunal finds ${x} guilty of the campaign against ${us}; boards fill with "told you it was foreign".` }, world: { ko: `은하재판소, ${x}의 ${us} 여론 공작 유죄 판결.`, en: `Galactic Tribunal rules ${x} guilty of a disinformation campaign against ${us}.` } };
  return { text: { ko: `${us} 정부가 증거도 없이 ${x}을(를) 제소했다가 은하재판소에서 기각당했다. 「망신」이라는 조롱이 쏟아진다.`, en: `${us}'s government had its case against ${x} thrown out of the Galactic Tribunal; mockery pours in.` }, world: { ko: `은하재판소, ${us}의 ${x} 제소 기각 — 「근거 부족」.`, en: `Galactic Tribunal dismisses ${us}'s case against ${x} for lack of evidence.` } };
}
