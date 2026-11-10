// 원시문명 관측(2026-11-03 사용자 결정 ①): 우리가 아는(국경 안 + 처음 접촉한) 원시문명의 시대·인지도·관측소를 읽어 목록과 변화 기록, 관찰 보고서를 만든다.
// 자동 관측 없음(「슈뢰딩거처럼」): 처음 접촉할 때 한 번, 그 뒤로는 플레이어가 화면을 열 때만 게임에 묻는다.
// 보고서는 틀 문장이 기본이고, 사용자가 고르면 LLM 이 실제 보고서처럼 쓴다. 게임 효과 없음(읽기만).
// 모드: common/scripted_effects/sllm_probe_preftl.txt(PFTL·PFTL_END 줄). 앱: src/features/preftl-app.ts. 화면: ui/office-preftl.js.
// 게임 확인(F: 게임 파일, 2026-11-03): 시대 10단계 technology_ages/preftl/preftl_ages.txt, 관측소 임무 3개(no_observation·passive_observation·specimen_collection),
// 인지도 단계 none/low/medium/high/full(full 이 되면 게임이 통신을 연다 awareness.900), 원시문명 위기 situation_pre_ftl_plague·singularity·nwo.
import { L } from './i18n-pick';
import type { ChatMessage } from './player2';

/** 시대 번호 1~10(모드 sllm_pf_age). 7 산업 시대부터 무선 방송이 있다(감청 방송 ④가 쓴다). */
export const AGES: ReadonlyArray<{ key: string; ko: string; en: string }> = [
  { key: 'stone_age', ko: '석기 시대', en: 'Stone Age' },
  { key: 'bronze_age', ko: '청동기 시대', en: 'Bronze Age' },
  { key: 'iron_age', ko: '철기 시대', en: 'Iron Age' },
  { key: 'late_medieval_age', ko: '중세 후기', en: 'Late Medieval Age' },
  { key: 'renaissance_age', ko: '르네상스 시대', en: 'Renaissance Age' },
  { key: 'steam_age', ko: '증기 시대', en: 'Steam Age' },
  { key: 'industrial_age', ko: '산업 시대', en: 'Industrial Age' },
  { key: 'machine_age', ko: '기계 시대', en: 'Machine Age' },
  { key: 'atomic_age', ko: '원자력 시대', en: 'Atomic Age' },
  { key: 'early_space_age', ko: '초기 우주 시대', en: 'Early Space Age' },
];
export const AGE_MAX = AGES.length;
export const RADIO_AGE = 7;
export const ageOf = (n: number) => (n >= 1 && n <= AGE_MAX ? AGES[n - 1] : null);
export const ageName = (n: number) => { const a = ageOf(n); return a ? L(a.ko, a.en) : L('알 수 없는 시대', 'Unknown age'); };
export const ageEn = (n: number) => ageOf(n)?.en ?? 'unknown age';

/** 인지도 단계 0~4(게임 current_awareness_level). */
export const AWARE: ReadonlyArray<{ ko: string; en: string; desc: string }> = [
  { ko: '없음', en: 'None', desc: 'they have no idea anyone is out there' },
  { ko: '낮음', en: 'Low', desc: 'a few strange sightings, dismissed as myth or error' },
  { ko: '중간', en: 'Medium', desc: 'rumours and theories about visitors from the sky are widespread' },
  { ko: '높음', en: 'High', desc: 'they are fairly sure they are being watched from space' },
  { ko: '완전', en: 'Full', desc: 'they know about us; open contact is possible' },
];
export const awareName = (lv: number) => { const a = AWARE[lv]; return a ? L(a.ko, a.en) : '?'; };

/** 우리 관측소 임무(모드 sllm_pf_mis). */
export const MISSION: Record<number, { ko: string; en: string }> = {
  0: { ko: '관측소 없음', en: 'No observation post' },
  1: { ko: '수동 관찰', en: 'Passive observation' },
  2: { ko: '표본 수집', en: 'Specimen collection' },
  3: { ko: '관측 중단', en: 'Observation suspended' },
};
/** 진행 중인 원시문명 위기(모드 sllm_pf_sit). */
export const SITUATION: Record<number, { ko: string; en: string }> = {
  1: { ko: '역병 확산', en: 'Spreading plague' },
  2: { ko: '기술 특이점', en: 'Technological singularity' },
  3: { ko: '신세계 질서', en: 'New world order' },
};

/** 개입 번호(preftl-act.ts ACTS 의 w) → 이름. 변화 기록 문장용(가져오기 고리를 만들지 않으려고 여기 둔다). */
export const ACT_NAMES: Record<number, [string, string]> = { 1: ['기술 선물', 'Gift of technology'], 2: ['역병 의료 지원', 'Plague medical aid'], 3: ['고의 노출', 'Deliberate sighting'], 4: ['은폐 작전', 'Cover-up operation'], 11: ['관측소 임무: 수동 관찰', 'Post mission: passive observation'], 12: ['관측소 임무: 표본 수집', 'Post mission: specimen collection'], 13: ['관측소 임무: 관측 중단', 'Post mission: observation suspended'] , 21: ['긴장 완화 공작', 'Easing operation'], 22: ['긴장 고조 공작', 'Stoking operation'], 23: ['핵무기 무력화', 'Nuclear sabotage'], 24: ['핵무기 무력화(실패)', 'Nuclear sabotage (failed)'] };

export interface Civ {
  id: number; name: string; species: string; planet: string;
  age: number; aw: number; lv: number;
  /** 1 우리 관측소, 2 다른 나라 관측소, 0 없음 */
  obs: number; mis: number; hive: boolean; sit: number;
  /** 성향(핵 대치용, 2026-11-05): pe 군국 1·2 / 평화 −1·−2, px 외계인혐오 1·2 / 외계인애호 −1·−2. 옛 모드면 없음 */
  pe?: number; px?: number;
  /** 우리 국경 안(관측소를 지을 수 있음) */
  inb: boolean;
  /** 다음 시대까지 기술 진척 %(게임 상황), 모르면 -1 */
  tp?: number;
  /** 원시문명이 아니게 된 뒤(⑤ 기억 제국): 정식 제국이 됨 · 우리가 흡수 · 사라짐(남의 정복·멸망) */
  fate?: 'uplifted' | 'conquered' | 'lost';
  /** 정식 제국이 된 뒤의 연락처 번호와 이름 */
  idx?: number; newName?: string;
  /** 기억을 그 제국 연대기에 적었다 */
  memDone?: boolean;
  first: string; seen: string;
  /** 더는 원시문명이 아니다(정식 제국이 됐거나, 정복·멸망했다) */
  gone?: boolean;
}
export type EvKind = 'uplift' | 'conquered' | 'lost' | 'voice' | 'act' | 'found' | 'border_in' | 'border_out' | 'age_up' | 'age_down' | 'aware_up' | 'aware_down' | 'obs_on' | 'obs_off' | 'sit_on' | 'sit_off' | 'gone' | 'back' | 'so_start' | 'so_stage' | 'so_war' | 'so_peace';
export interface CivEvent { date: string; kind: EvKind; a?: number; b?: number }
export interface Report { date: string; title: string; body: string; llm: boolean }

const num = (v: unknown) => { const n = Math.round(Number(String(v ?? '').replace(/,/g, ''))); return Number.isFinite(n) ? n : 0; };
const clip = (v: unknown, n = 80) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** PFTL 한 줄 → 원시문명(날짜는 앱이 채운다). 번호가 없으면 버린다. */
export function parseCiv(kv: Record<string, string>, date: string): Civ | null {
  const id = num(kv.id); if (id < 1) return null;
  const name = clip(kv.name) || '#' + id;
  return {
    id, name, species: clip(kv.species), planet: clip(kv.planet),
    age: clamp(num(kv.age), 0, AGE_MAX), aw: clamp(num(kv.aw), 0, 100), lv: clamp(num(kv.lv), 0, 4),
    obs: clamp(num(kv.obs), 0, 2), mis: clamp(num(kv.mis), 0, 3), hive: num(kv.hive) === 1, sit: clamp(num(kv.sit), 0, 3), inb: kv.in === undefined ? true : num(kv.in) === 1, tp: kv.tp === undefined || num(kv.tp) < 0 ? -1 : clamp(num(kv.tp), 0, 100),
    ...(kv.pe !== undefined ? { pe: clamp(num(kv.pe), -2, 2) } : {}), ...(kv.px !== undefined ? { px: clamp(num(kv.px), -2, 2) } : {}),
    first: date, seen: date,
  };
}

/** PFTL_BEGIN 이 없으므로 요청 번호별로 PFTL 줄을 모았다가 PFTL_END 에서 꺼낸다. */
export class PftlCollector {
  private bags = new Map<string, Record<string, string>[]>();
  feed(kind: string, kv: Record<string, string>): { req: string; rows: Record<string, string>[] } | null {
    const req = String(num(kv.req));
    if (kind === 'PFTL') { const b = this.bags.get(req) ?? []; if (b.length < 200) b.push(kv); this.bags.set(req, b); if (this.bags.size > 8) this.bags.delete(this.bags.keys().next().value as string); return null; }
    if (kind === 'PFTL_END') { const rows = this.bags.get(req) ?? []; this.bags.delete(req); return { req, rows }; }
    return null;
  }
}

/** 지난 관측과 이번 관측의 차이 → 변화 기록. prev 가 없으면 「발견」. */
export function diffCiv(prev: Civ | undefined, cur: Civ, date: string): CivEvent[] {
  if (!prev) return [{ date, kind: 'found', a: cur.age }];
  const out: CivEvent[] = [];
  if (prev.gone) out.push({ date, kind: 'back' });
  if (cur.inb && prev.inb === false) out.push({ date, kind: 'border_in' });
  else if (!cur.inb && prev.inb !== false) out.push({ date, kind: 'border_out' });
  if (cur.age > prev.age && prev.age > 0) out.push({ date, kind: 'age_up', a: prev.age, b: cur.age });
  else if (cur.age < prev.age && cur.age > 0) out.push({ date, kind: 'age_down', a: prev.age, b: cur.age });
  if (cur.lv > prev.lv) out.push({ date, kind: 'aware_up', a: prev.lv, b: cur.lv });
  else if (cur.lv < prev.lv) out.push({ date, kind: 'aware_down', a: prev.lv, b: cur.lv });
  if (cur.obs === 1 && prev.obs !== 1) out.push({ date, kind: 'obs_on' });
  else if (cur.obs !== 1 && prev.obs === 1) out.push({ date, kind: 'obs_off' });
  if (cur.sit && cur.sit !== prev.sit) out.push({ date, kind: 'sit_on', a: cur.sit });
  else if (!cur.sit && prev.sit) out.push({ date, kind: 'sit_off', a: prev.sit });
  return out;
}

/** 변화 기록 한 줄(화면 언어). */
export function eventText(e: CivEvent): string {
  const S = (n?: number) => (n && SITUATION[n] ? L(SITUATION[n].ko, SITUATION[n].en) : '');
  switch (e.kind) {
    case 'uplift': return L('별의 세계로 나와 정식 제국이 됨', 'Reached the stars and became a star empire');
    case 'conquered': return L('우리 제국에 흡수됨', 'Absorbed into our empire');
    case 'lost': return L('사라짐(다른 나라에 정복되었거나 멸망)', 'Disappeared (conquered by others or destroyed)');
    case 'voice': return L(`하늘의 목소리로 교신함(인지도 +${e.a ?? 0})`, `Spoke as the voice from the sky (awareness +${e.a ?? 0})`);
    case 'act': return L(`우리의 개입: ${ACT_NAMES[e.a ?? 0]?.[0] ?? '?'}`, `Our intervention: ${ACT_NAMES[e.a ?? 0]?.[1] ?? '?'}`);
    case 'found': return L(`처음 관측: ${ageName(e.a ?? 0)}`, `First observed: ${ageName(e.a ?? 0)}`);
    case 'age_up': return L(`${ageName(e.a ?? 0)} → ${ageName(e.b ?? 0)}로 발전`, `Advanced from the ${ageName(e.a ?? 0)} to the ${ageName(e.b ?? 0)}`);
    case 'age_down': return L(`${ageName(e.a ?? 0)} → ${ageName(e.b ?? 0)}로 후퇴`, `Fell back from the ${ageName(e.a ?? 0)} to the ${ageName(e.b ?? 0)}`);
    case 'aware_up': return L(`인지도 상승: ${awareName(e.a ?? 0)} → ${awareName(e.b ?? 0)}`, `Awareness rose: ${awareName(e.a ?? 0)} → ${awareName(e.b ?? 0)}`);
    case 'aware_down': return L(`인지도 하락: ${awareName(e.a ?? 0)} → ${awareName(e.b ?? 0)}`, `Awareness fell: ${awareName(e.a ?? 0)} → ${awareName(e.b ?? 0)}`);
    case 'obs_on': return L('우리 관측소가 관찰을 시작함', 'Our observation post began watching');
    case 'obs_off': return L('우리 관측소가 사라짐', 'Our observation post is gone');
    case 'sit_on': return L(`위기 발생: ${S(e.a)}`, `Crisis began: ${S(e.a)}`);
    case 'sit_off': return L(`위기 끝남: ${S(e.a)}`, `Crisis ended: ${S(e.a)}`);
    case 'border_in': return L('우리 국경 안으로 들어옴', 'Now within our borders');
    case 'border_out': return L('우리 국경 밖으로 나감', 'Now outside our borders');
    case 'gone': return L('더는 원시문명으로 관측되지 않음', 'No longer observed as a pre-FTL civilization');
    case 'back': return L('다시 원시문명으로 관측됨', 'Observed as a pre-FTL civilization again');
    case 'so_start': return L('강대국들이 핵무기를 두고 대치하기 시작함', 'Their great powers entered a nuclear standoff');
    case 'so_stage': return e.a === 2 ? L('핵 대치가 일촉즉발로 치달음', 'The nuclear standoff reached the brink') : e.a === 0 ? L('핵 대치가 풀리기 시작함(해빙)', 'The nuclear standoff began to thaw') : L('핵 대치가 다시 팽팽해짐', 'The nuclear standoff tightened again');
    case 'so_war': return L('핵전쟁 — 인구 절반을 잃고 두 시대 뒤로 물러남', 'Nuclear war — lost half their people and fell back two ages');
    case 'so_peace': return e.a ? L('핵 대치가 평화롭게 끝남(우리의 은밀한 중재)', 'The nuclear standoff ended peacefully (our quiet mediation)') : L('핵 대치가 평화롭게 끝남', 'The nuclear standoff ended peacefully');
  }
}
const eventEn = (e: CivEvent): string => {
  const S = (n?: number) => (n && SITUATION[n] ? SITUATION[n].en.toLowerCase() : 'a crisis');
  switch (e.kind) {
    case 'uplift': return 'became a star empire';
    case 'conquered': return 'were absorbed into our empire';
    case 'lost': return 'disappeared';
    case 'voice': return 'we spoke to them as a voice from the sky';
    case 'act': return `we intervened (${ACT_NAMES[e.a ?? 0]?.[1] ?? '?'})`;
    case 'found': return `first observed in the ${ageEn(e.a ?? 0)}`;
    case 'age_up': return `advanced from the ${ageEn(e.a ?? 0)} to the ${ageEn(e.b ?? 0)}`;
    case 'age_down': return `fell back from the ${ageEn(e.a ?? 0)} to the ${ageEn(e.b ?? 0)}`;
    case 'aware_up': return `awareness of us rose from ${AWARE[e.a ?? 0]?.en ?? '?'} to ${AWARE[e.b ?? 0]?.en ?? '?'}`;
    case 'aware_down': return `awareness of us fell from ${AWARE[e.a ?? 0]?.en ?? '?'} to ${AWARE[e.b ?? 0]?.en ?? '?'}`;
    case 'obs_on': return 'our observation post began watching';
    case 'obs_off': return 'our observation post was lost';
    case 'sit_on': return `${S(e.a)} broke out`;
    case 'sit_off': return `${S(e.a)} ended`;
    case 'border_in': return 'came within our borders';
    case 'border_out': return 'ended up outside our borders';
    case 'gone': return 'stopped being a pre-FTL civilization';
    case 'back': return 'was observed as pre-FTL again';
    case 'so_start': return 'their great powers entered a nuclear standoff';
    case 'so_stage': return e.a === 2 ? 'their nuclear standoff reached the brink of war' : e.a === 0 ? 'their nuclear standoff began to thaw' : 'their nuclear standoff tightened again';
    case 'so_war': return 'a nuclear war destroyed half their people and threw them back two ages';
    case 'so_peace': return e.a ? 'their nuclear standoff ended peacefully, quietly helped along by us' : 'their nuclear standoff ended peacefully';
  }
};

/** 틀 문장 보고서(LLM 없이). 화면 언어로. */
export function templateReport(c: Civ, events: CivEvent[], date: string, empire: string): Report {
  const ours = c.obs === 1, lines: string[] = [];
  lines.push(L(`관측 대상: ${c.name}${c.species ? ` (${c.species})` : ''}${c.planet ? `, 행성 ${c.planet}` : ''}`, `Subject: ${c.name}${c.species ? ` (${c.species})` : ''}${c.planet ? `, planet ${c.planet}` : ''}`));
  lines.push(L(`문명 단계: ${ageName(c.age)} (${c.age}/${AGE_MAX})${c.hive ? ', 군체 의식' : ''}`, `Stage: ${ageName(c.age)} (${c.age}/${AGE_MAX})${c.hive ? ', hive mind' : ''}`));
  lines.push(L(`우리에 대한 인지도: ${awareName(c.lv)} (${c.aw}/100)`, `Awareness of us: ${awareName(c.lv)} (${c.aw}/100)`));
  lines.push(ours ? L(`관측소 임무: ${MISSION[c.mis]?.ko ?? '알 수 없음'}`, `Observation post mission: ${MISSION[c.mis]?.en ?? 'Unknown'}`) : c.obs === 2 ? L('다른 나라의 관측소가 이 행성을 지켜보고 있다. 우리 관측소는 없다.', 'Another power has an observation post here. We have none.') : L('우리 관측소가 없어 먼 거리에서 본 내용뿐이다.', 'We have no observation post; this is a long-range view only.'));
  if (!c.inb) lines.push(L('우리 국경 밖에 있어 관측소를 지을 수 없다.', 'They lie outside our borders, so we cannot build an observation post.'));
  if (c.sit && SITUATION[c.sit]) lines.push(L(`진행 중인 위기: ${SITUATION[c.sit].ko}`, `Ongoing crisis: ${SITUATION[c.sit].en}`));
  if (c.age >= RADIO_AGE) lines.push(L('무선 통신을 쓰는 단계라 방송을 감청할 수 있다.', 'They use radio, so their broadcasts can be intercepted.'));
  const recent = events.slice(-5);
  if (recent.length) { lines.push(''); lines.push(L('최근 변화', 'Recent changes')); for (const e of recent) lines.push(`- ${e.date} ${eventText(e)}`); }
  return { date, llm: false, title: L(`${empire} 관측 보고 — ${c.name}`, `${empire} field report — ${c.name}`), body: lines.join('\n') };
}

export const REPORT_MAX_TOKENS = 900;
/** LLM 보고서 요청(영어로 지시, 답은 화면 언어 — aiclient 가 언어 지시를 붙인다). */
export function reportMessages(c: Civ, events: CivEvent[], date: string, empire: string): ChatMessage[] {
  const facts = [
    `Civilization: ${c.name}${c.species ? `, species ${c.species}` : ''}${c.planet ? `, homeworld ${c.planet}` : ''}${c.hive ? ' (a hive mind: one collective consciousness, no individuals)' : ''}.`,
    `Technological stage: ${ageEn(c.age)} (${c.age} of ${AGE_MAX}; after the ${AGES[AGE_MAX - 1].en} they become a spacefaring empire).`,
    `Awareness of outside observers: ${AWARE[c.lv]?.en ?? '?'} (${c.aw}/100) — ${AWARE[c.lv]?.desc ?? ''}.`,
    c.obs === 1 ? `We watch them from our own observation post; its current mission: ${MISSION[c.mis]?.en ?? 'unknown'}.` : c.obs === 2 ? 'Another star empire has an observation post over their world; we do not. Our view is indirect.' : 'We have no observation post; this is long-range observation only.',
    ...(!c.inb ? ['Their world lies outside our borders; we only passed by with a survey ship.'] : []),
    ...(c.sit && SITUATION[c.sit] ? [`Ongoing crisis on their world: ${SITUATION[c.sit].en}.`] : []),
    ...(c.age >= RADIO_AGE ? ['They already use radio; some of what we know comes from intercepted broadcasts.'] : []),
    ...(events.length ? ['Recorded changes: ' + events.slice(-6).map((e) => `${e.date} ${eventEn(e)}`).join('; ') + '.'] : []),
  ];
  return [
    { role: 'system', content: [
      `You write in-universe field reports for the xenology office of ${empire}, a star-faring empire in Stellaris that secretly observes a primitive (pre-FTL) civilization inside its borders.`,
      'Write ONE report dated ' + date + ' as a field researcher at the observation post would: a title line first, then short sections (Summary, Observations, Assessment). 140-230 words, plain text, no markdown symbols except "- " for list items.',
      'Use only the facts given. You may add small, plausible everyday details that fit their technological stage (customs, tools, myths, politics), but never contradict the facts, never invent contact with them, and never claim they know more about us than their awareness level allows.',
      'Keep the tone of a careful scientist. Do not address the reader, do not add notes outside the report.',
    ].join('\n') },
    { role: 'user', content: facts.join('\n') },
  ];
}
/** LLM 답 → 보고서(첫 줄 제목). 비면 null. */
export function parseReport(raw: string, date: string, fallbackTitle: string): Report | null {
  const t = String(raw ?? '').replace(/\r/g, '').replace(/^```[a-z]*\n?|```$/g, '').replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim();
  if (t.length < 40) return null;
  const lines = t.split('\n'); const first = lines[0].trim();
  const title = first.length && first.length <= 90 ? first : fallbackTitle;
  const body = (title === first ? lines.slice(1) : lines).join('\n').trim().slice(0, 3000);
  return body ? { date, llm: true, title: title.slice(0, 90), body } : null;
}

/** 비서가 알 수 있는 사실(영어). */
export function civFact(c: Civ): string {
  return `Pre-FTL civilization ${c.name}${c.species ? ` (${c.species})` : ''}${c.planet ? ` on ${c.planet}` : ''}: ${ageEn(c.age)}, awareness of us ${AWARE[c.lv]?.en ?? '?'} (${c.aw}/100)${c.obs === 1 ? `, our observation post: ${MISSION[c.mis]?.en ?? '?'}` : ', no observation post of ours'}${c.sit && SITUATION[c.sit] ? `, crisis: ${SITUATION[c.sit].en}` : ''}.`;
}

/** 관측 명령(플레이어 나라, 이 세이브에서만). */
export function preftlCommand(req: number, sid: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error(L('원시문명 관측 명령 인자가 올바르지 않습니다.', 'Invalid pre-FTL observation command arguments.'));
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } sllm_probe_preftl = { REQ = ${req} } }`;
}
