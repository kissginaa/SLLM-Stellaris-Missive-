// 악명·전쟁범죄(2026-11-04 사용자, War Crimes Expanded 모드의 생각을 참고해 우리 식으로). 순수 규칙 — 앱: src/features/infamy-app.ts,
// 게임: tester-mod/common/scripted_effects/sllm_infamy.txt · events/sllm_infamy_events.txt, 화면: ui/fleet-infamy.js(함대 사령부 창).
// 악명(0~100)은 게임이 계산한다(나라 변수 sllm_inf). 앱은 범죄 기록을 모아 보여 주고, 외교 대화·비서·연대기·외교 노선에 알린다.
// 범죄(k): 1 무차별 폭격 · 2 아마겟돈 폭격 · 3 행성 말살 · 4 숙청 · 5 포로 처형. 단계: 1 악명(25+) · 2 오명(50+) · 3 공공의 적(75+).
// 3단계(2026-11-04): 숨은 악명(은폐 공작·비밀 처형) — 해마다 드러날 수 있고 드러나면 1.5배로 공개 악명에. 폭로 기사는 LLM.
//   전범: 폭격·말살한 우리 함대 제독에게 게임 표식. 전쟁에 지면 이긴 AI 가 인도를 요구(LLM 서신) → 인도·자국 군사법정·거부.
import { L } from './i18n-pick';

export const INF = { tiers: [25, 50, 75] as const, keep: 60, mergeDays: 400, decay: 0.5 } as const;
export type CrimeKind = 1 | 2 | 3 | 4 | 5;
export interface Crime { k: CrimeKind; by: number; byName: string; byMe: boolean; vic: number; vicName: string; vicMe: boolean; place: string; date: string; first: string; count: number; inf: number; /** 은폐됨(우리만 앎, 3단계) */ covered?: boolean; /** 은폐했다가 드러남 */ exposed?: boolean }

export const tierOf = (v: number): 0 | 1 | 2 | 3 => (v >= 75 ? 3 : v >= 50 ? 2 : v >= 25 ? 1 : 0);
export function tierName(t: number): string { return t >= 3 ? L('은하의 공공의 적', 'Galactic Pariah') : t === 2 ? L('오명', 'Infamous') : t === 1 ? L('악명', 'Notorious') : L('없음', 'None'); }
/** 단계 효과(게임 수정자·호감과 같은 값). */
export function tierEffect(t: number): string {
  if (t >= 3) return L('외교 영향력 −35% · 신뢰 증가 −50% · 교신하는 나라들 호감 −100', 'Diplomatic weight −35% · trust growth −50% · opinion −100 from every empire in contact');
  if (t === 2) return L('외교 영향력 −20% · 신뢰 증가 −30% · 교신하는 나라들 호감 −50', 'Diplomatic weight −20% · trust growth −30% · opinion −50 from every empire in contact');
  if (t === 1) return L('외교 영향력 −10% · 신뢰 증가 −15% · 교신하는 나라들 호감 −20', 'Diplomatic weight −10% · trust growth −15% · opinion −20 from every empire in contact');
  return L('불이익 없음', 'No penalties');
}
export function kindName(k: number): string {
  switch (k) { case 1: return L('무차별 궤도 폭격', 'Indiscriminate orbital bombardment'); case 2: return L('아마겟돈 폭격', 'Armageddon bombardment'); case 3: return L('행성 말살', 'Annihilation of a colony'); case 4: return L('종족 숙청', 'Species purge'); case 5: return L('포로 처형', 'Execution of a prisoner'); default: return L('전쟁범죄', 'War crime'); }
}
const KIND_EN: Record<number, string> = { 1: 'indiscriminate orbital bombardment of civilians', 2: 'armageddon bombardment', 3: 'the annihilation of an entire colony by bombardment', 4: 'the purge of a species', 5: 'the execution of a captured admiral' };

/** 게임 날짜 "2231.04.01" → 대략 일수(비교용). */
export function dayOf(d: string): number { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + Number(m[3]) : 0; }
/** 같은 범죄가 이어지는지(같은 가해국·종류·장소, 마지막 기록 뒤 mergeDays 안). */
export function sameCrime(a: Crime, b: Pick<Crime, 'k' | 'by' | 'byMe' | 'place' | 'date'>): boolean {
  return a.k === b.k && a.byMe === b.byMe && (a.byMe || a.by === b.by) && a.place === b.place && dayOf(b.date) - dayOf(a.date) <= INF.mergeDays;
}
/** 새 범죄 줄을 기록에 합친다. 이어지는 건이면 횟수만 늘림. merged = 이어진 건. */
export function addCrime(log: Crime[], c: Crime): { log: Crime[]; merged: boolean } {
  const i = log.findIndex((x) => sameCrime(x, c));
  if (i >= 0) { const x = { ...log[i], count: log[i].count + 1, date: c.date, inf: c.inf, vicName: c.vicName || log[i].vicName }; const out = log.slice(); out.splice(i, 1); out.push(x); return { log: out, merged: true }; }
  return { log: [...log, c].slice(-INF.keep), merged: false };
}
export function crimeLine(c: Crime, us: string): string {
  const by = c.byMe ? us : c.byName || L('어느 제국', 'an empire');
  const where = c.place ? L(` — ${c.place}${c.vicName ? `(${c.vicName})` : ''}`, ` — ${c.place}${c.vicName ? ` (${c.vicName})` : ''}`) : '';
  const n = c.count > 1 ? L(` · ${c.count}달째`, ` · ${c.count} months`) : '';
  return `${by}: ${kindName(c.k)}${where}${n}`;
}
/** 악명 단계가 바뀐 알림. */
export function tierChangeText(old: number, t: number, inf: number): { title: string; body: string } {
  const up = t > old;
  return {
    title: up ? L(`악명 단계 상승: ${tierName(t)}`, `Infamy rose: ${tierName(t)}`) : L(`악명 단계 하락: ${tierName(t)}`, `Infamy fell: ${tierName(t)}`),
    body: L(`악명 ${Math.round(inf)}/100. ${tierEffect(t)}.${up ? ' 전쟁이 없는 동안 매달 0.5씩 줄어듭니다.' : ''}`, `Infamy ${Math.round(inf)}/100. ${tierEffect(t)}.${up ? ' It falls by 0.5 each month while we are at peace.' : ''}`),
  };
}
/** 연대기 한 줄(피해국 쪽 기록) — 그 제국과의 외교 대화에 들어간다. */
export function victimChron(c: Crime, us: string): string {
  switch (c.k) {
    case 3: return L(`${us}이(가) 우리 식민지 ${c.place}을(를) 폭격으로 말살했다`, `${us} annihilated our colony ${c.place} by bombardment`);
    case 2: return L(`${us}이(가) ${c.place}에 아마겟돈 폭격을 퍼부어 민간인을 학살했다`, `${us} unleashed armageddon bombardment on ${c.place}, massacring civilians`);
    default: return L(`${us}이(가) ${c.place}을(를) 무차별 폭격해 민간인을 죽였다`, `${us} indiscriminately bombarded ${c.place}, killing civilians`);
  }
}
/** 우리가 당했을 때(가해국 쪽 연대기). */
export function attackerChron(c: Crime): string {
  switch (c.k) {
    case 3: return L(`우리 식민지 ${c.place}을(를) 폭격으로 말살했다`, `annihilated our colony ${c.place} by bombardment`);
    case 2: return L(`우리 행성 ${c.place}에 아마겟돈 폭격을 퍼부었다`, `unleashed armageddon bombardment on our world ${c.place}`);
    default: return L(`우리 행성 ${c.place}을(를) 무차별 폭격했다`, `indiscriminately bombarded our world ${c.place}`);
  }
}

/** 외교 대화 프롬프트 줄(영어, AI 만 읽음). 우리 악명·최근 범죄 · 이 제국이 당한 일 · 이 제국 자신의 악명. 없으면 ''. */
export function talkLine(o: { us: string; myInf: number; mine: Crime[]; againstThem: Crime[]; theirInf: number | null }): string {
  const out: string[] = [];
  const t = tierOf(o.myInf);
  const recent = o.mine.slice(-3).reverse().map((c) => `${KIND_EN[c.k] ?? 'a war crime'}${c.place ? ` at ${c.place}` : ''}${c.vicName ? ` (${c.vicName})` : ''} (${c.date.slice(0, 4)})`);
  if (t > 0) out.push(`The other empire ("${o.us}") is known across the galaxy for war crimes: reputation "${['', 'notorious', 'infamous', 'galactic pariah'][t]}" (infamy ${Math.round(o.myInf)}/100)${recent.length ? '. Known atrocities: ' + recent.join('; ') : ''}. Let this color your view of them according to your own values: most empires find it repugnant and distrust them; ruthless militarists or xenophobes may grudgingly respect it; machine intelligences treat it as threat data. You may bring it up when it fits, e.g. if they speak of honor, peace or trust.`);
  else if (o.mine.length) out.push(`The other empire ("${o.us}") has committed war crimes, though they are not yet widely notorious (infamy ${Math.round(o.myInf)}/100). Known: ${recent.join('; ')}.`);
  if (o.againstThem.length) out.push(`Atrocities "${o.us}" committed against YOUR own people (facts): ${o.againstThem.slice(-3).reverse().map((c) => `${KIND_EN[c.k] ?? 'a war crime'} at ${c.place}${c.count > 1 ? ` for ${c.count} months` : ''} (${c.date.slice(0, 4)})`).join('; ')}. You remember this bitterly; it weighs on every word between you.`);
  if (o.theirInf !== null && tierOf(o.theirInf) > 0) out.push(`Your own empire is itself reputed for war crimes ("${['', 'notorious', 'infamous', 'galactic pariah'][tierOf(o.theirInf)]}", infamy ${Math.round(o.theirInf)}/100). If accused, answer in character: deny, justify or defy.`);
  return out.join('\n');
}
/** 비서용 사실 줄(영어). */
export function secLines(myInf: number, mine: Crime[], against: Crime[], x?: { hid: number; criminals: string[] }): string[] {
  const out = [`Our infamy: ${Math.round(myInf)}/100 (${['none', 'notorious', 'infamous', 'galactic pariah'][tierOf(myInf)]}). It falls by 0.5 a month while we are at peace.`];
  if (x && x.hid > 0.5) out.push(`Hidden (covered-up) infamy: ${Math.round(x.hid)} — known only inside our government; about ${exposeChance(x.hid)}% chance a year that it comes out (then x1.5). Speak of it only discreetly.`);
  if (x && x.criminals.length) out.push(`Our commanders marked as war criminals: ${x.criminals.slice(0, 8).join(', ')}.`);
  for (const c of mine.slice(-4).reverse()) out.push(`Our war crime${c.covered ? ' (covered up, still secret)' : ''}: ${KIND_EN[c.k]}${c.place ? ` at ${c.place}` : ''}${c.vicName ? ` (${c.vicName})` : ''}, ${c.date}${c.count > 1 ? `, ${c.count} months` : ''}.`);
  for (const c of against.slice(-3).reverse()) out.push(`War crime against us: ${c.byName} — ${KIND_EN[c.k]} at ${c.place}, ${c.date}.`);
  return out;
}

/** 게임 명령: 악명 목록 읽기(INFY … INFEND). */
export function readCommand(req: number, sid: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error('INVALID_INF');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_inf_req value = ${req} } country_event = { id = sllm_inf.4 } }`;
}
export const num = (v: unknown): number => { const n = Number(String(v ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : 0; };

// ---- 3단계: 숨은 악명 · 전범 인도 ----
export const COVER = { influence: 75, energy: 300, max: 15, cooldownDays: 720, expose: 1.5 } as const;
/** 해마다 숨은 악명이 드러날 확률(%) — 게임 sllm_inf.5 와 같은 식. */
export function exposeChance(hid: number): number { if (!(hid > 0.5)) return 0; return 10 + (hid >= 10 ? 10 : 0) + (hid >= 25 ? 15 : 0) + (hid >= 40 ? 20 : 0); }
export function coverCommand(req: number, sid: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error('INVALID_INF');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_inf_req value = ${req} } country_event = { id = sllm_inf.6 } }`;
}
export type WcAnswer = 'hand' | 'trial' | 'refuse';
const WC_CODE: Record<WcAnswer, number> = { hand: 1, trial: 2, refuse: 3 };
export function wcCommand(req: number, sid: string, tid: number, a: WcAnswer): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(tid) || tid < 1 || !(a in WC_CODE)) throw new Error('INVALID_WC');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } set_variable = { which = sllm_wc_req value = ${req} } set_variable = { which = sllm_wc_act value = ${WC_CODE[a]} } set_variable = { which = sllm_wc_tid value = ${tid} } country_event = { id = sllm_wc.2 } }`;
}
export function coverResult(st: number, mv: number): { ok: boolean; text: string } {
  if (st === 1) return { ok: true, text: L(`은폐 공작 성공 — 공개 악명 ${Math.round(mv)}을(를) 묻었습니다. 해마다 드러날 수 있습니다.`, `Cover-up done — buried ${Math.round(mv)} infamy. It may still come out each year.`) };
  if (st === 2) return { ok: false, text: L(`자원이 모자랍니다(영향력 ${COVER.influence}·에너지 ${COVER.energy}).`, `Not enough resources (${COVER.influence} influence · ${COVER.energy} energy).`) };
  if (st === 3) return { ok: false, text: L('은폐 공작은 2년에 한 번만 할 수 있습니다.', 'A cover-up can only be run once every two years.') };
  if (st === 4) return { ok: false, text: L('묻을 악명이 없습니다.', 'There is no infamy to bury.') };
  return { ok: false, text: L('게임이 응답하지 않았습니다.', 'The game did not respond.') };
}
export function wcResultText(a: WcAnswer, them: string, n: number): string {
  if (a === 'hand') return L(`전범 ${n}명을 ${them}에 인도했다 — 그들은 재판을 받고 처형되었다. 악명 −10, ${them} 호감 +30.`, `Handed ${n} war criminal(s) over to ${them}; they were tried and executed. Infamy −10, ${them} opinion +30.`);
  if (a === 'trial') return L(`전범 ${n}명을 자국 군사법정에 세웠다(영향력 50). 그들은 직위를 지켰지만 낙인은 지워졌다. 악명 −5, ${them} 호감 +10.`, `Put ${n} war criminal(s) before our own military tribunal (50 influence). They keep their posts, but the mark is cleared. Infamy −5, ${them} opinion +10.`);
  return L(`${them}의 전범 인도 요구를 거부했다. 악명 +5, ${them} 호감 −40.`, `Refused ${them}'s demand to hand over war criminals. Infamy +5, ${them} opinion −40.`);
}
const SOURCES = ['a defecting officer of our own fleet', 'a foreign intelligence service', 'an independent galactic journalist', 'survivors who escaped the bombardment', 'leaked military logs'];
export function pickSource(rnd: () => number = Math.random): string { return SOURCES[Math.floor(rnd() * SOURCES.length) % SOURCES.length]; }
/** 숨은 범죄 폭로 기사(JSON {headline, body}). */
export function exposeMessages(us: string, crimes: Crime[], ex: number, source: string): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: `You are a galactic news outlet in a Stellaris galaxy breaking an exposé. Hidden war crimes committed by the empire "${us}" have just come to light. Write a punchy headline (max 14 words) and a short article (2-4 sentences) in a sober news style. Name the source of the leak as given. Do not invent numbers of dead or new crimes beyond those listed. JSON only: {"headline":"...","body":"..."}` },
    { role: 'user', content: JSON.stringify({ empire: us, source, crimes: crimes.slice(-5).map((c) => ({ crime: KIND_EN[c.k] ?? 'a war crime', place: c.place || undefined, victim: c.vicName || undefined, date: c.date })), infamy_added: Math.round(ex) }) },
  ];
}
export function exposeFallback(us: string, crimes: Crime[]): { headline: string; body: string } {
  const c = crimes[crimes.length - 1];
  return { headline: L(`${us}의 숨겨진 전쟁범죄 드러나`, `${us}'s hidden war crimes exposed`), body: c ? L(`${us}이(가) 감춰 온 ${kindName(c.k)}${c.place ? `(${c.place})` : ''}의 증거가 공개되었다. 은하 각국이 해명을 요구하고 있다.`, `Evidence of ${us}'s concealed ${kindName(c.k).toLowerCase()}${c.place ? ` at ${c.place}` : ''} has been made public. Empires across the galaxy demand answers.`) : L(`${us}이(가) 감춰 온 만행의 증거가 공개되었다.`, `Evidence of atrocities concealed by ${us} has been made public.`) };
}
/** 전범 인도 요구 서신(JSON {letter}). why: war = 전쟁에서 이김 · exposed = 범죄가 폭로됨. */
export function demandMessages(o: { them: string; us: string; against: Crime[]; criminals: string[]; why: 'war' | 'exposed'; profile?: string }): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: `You are the leader of the empire "${o.them}" in a Stellaris galaxy, writing a formal diplomatic letter to the ruler of "${o.us}". ${o.why === 'war' ? 'You have just won the war against them.' : 'Their concealed war crimes have just been exposed to the whole galaxy.'} Demand that they hand over the named commanders responsible for war crimes to face your tribunal. Write in your own voice (fitting your empire), 3-5 sentences, firm, citing the crimes listed. Do not invent other crimes or numbers. JSON only: {"letter":"..."}` },
    { role: 'user', content: JSON.stringify({ your_empire: o.them, your_empire_profile: o.profile || undefined, their_empire: o.us, accused_commanders: o.criminals.slice(0, 8), crimes_against_your_people: o.against.slice(-4).map((c) => ({ crime: KIND_EN[c.k] ?? 'a war crime', place: c.place || undefined, date: c.date })) }) },
  ];
}
export function demandFallback(them: string, us: string, criminals: string[]): string {
  const names = criminals.slice(0, 5).join(', ');
  return L(`${them}의 통치자가 ${us}에 요구합니다 — 「우리 백성을 학살한 지휘관${names ? `(${names})` : '들'}을 우리 법정에 넘기십시오. 정의 없이는 평화도 없습니다.」`, `The ruler of ${them} demands of ${us}: "Hand over the commanders${names ? ` (${names})` : ''} who massacred our people to our tribunal. There is no peace without justice."`);
}
export function parseJsonObj(raw: string): Record<string, unknown> | null { const m = /\{[\s\S]*\}/.exec(raw || ''); if (!m) return null; try { const j = JSON.parse(m[0]); return j && typeof j === 'object' ? j as Record<string, unknown> : null; } catch { return null; } }
