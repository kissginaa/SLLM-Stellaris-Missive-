// SLLM 시나리오 알아보기(2026-11-05 사용자: 「앱이랑 연계」 1·2단계) — 순수 규칙. 앱: src/features/scenario-app.ts · 화면: ui/office-tension.js(대립 긴장도 칸·창)
// 시나리오 모드(scenario-mods/sllm_scenario_corridor)가 game.log 에 찍는 줄:
//   SCN   sc=corridor ev=start|year|power|truce|cleared [lvl=1~3] [opt=1~3] date=
//   SCNN  sc=corridor side=a|b|p name= idx=(SLLM 본편 sllm_idx, 모르면 0) date=
//   SCNSEAT sc=corridor seat=a|b|p|x name= date=   — 사람 플레이어가 앉은 자리
// 하는 일: 세이브가 시나리오인지 기억 · 처음 알아본 때 연대기에 지난 역사 넣기 · LLM 프롬프트에 시나리오 배경 한 덩이.

export type Pair = [string, string]; // [한국어, 영어]
export type Side = 'a' | 'b' | 'p';
export interface ScnSave {
  id: string; start: string; date: string; seat: '' | Side | 'x'; lvl: number;
  names: Partial<Record<Side, string>>; idx: Partial<Record<Side, number>>;
  seeded: { world?: boolean; a?: boolean; b?: boolean; p?: boolean };
  truce: Array<{ d: string; opt: number }>; told?: boolean;
}
export const SCN_IDS = ['corridor'] as const;
export const SCN_TITLE: Record<string, Pair> = { corridor: ['회랑의 삼파전', 'The Corridor Triangle'] };
export const SIDE_ROLE: Record<Side, Pair> = { a: ['은하 얼라이언스 자리', 'the Alliance seat'], b: ['인류 제국 자리', 'the Empire seat'], p: ['세렌 회랑의 작은 나라 자리', 'the small Seren Corridor nation'] };
export const LVL_NAME: Pair[] = [['', ''], ['보통', 'Normal'], ['강함', 'Strong'], ['은하의 거인', 'Galactic Giants']];

const str = (v: unknown) => String(v ?? '').replace(/^\\+/, '').trim().slice(0, 80);
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/^\\+/, '')); return Number.isFinite(n) ? n : 0; };
const side = (v: unknown): Side | null => { const s = str(v); return s === 'a' || s === 'b' || s === 'p' ? s : null; };

export function fixScn(o: unknown): ScnSave | null {
  const s = (o && typeof o === 'object' ? o : null) as Partial<ScnSave> | null;
  if (!s || !SCN_IDS.includes(s.id as typeof SCN_IDS[number])) return null;
  const pick = <T>(x: unknown, ok: (v: unknown) => boolean): Partial<Record<Side, T>> => { const r: Partial<Record<Side, T>> = {}; if (x && typeof x === 'object') for (const k of ['a', 'b', 'p'] as Side[]) { const v = (x as Record<string, unknown>)[k]; if (ok(v)) r[k] = v as T; } return r; };
  return {
    id: s.id!, start: String(s.start || ''), date: String(s.date || ''), seat: (['a', 'b', 'p', 'x'].includes(String(s.seat)) ? s.seat : '') as ScnSave['seat'], lvl: Math.max(0, Math.min(3, Math.round(Number(s.lvl) || 0))),
    names: pick<string>(s.names, (v) => typeof v === 'string' && !!v), idx: pick<number>(s.idx, (v) => Number.isInteger(v) && (v as number) > 0),
    seeded: { ...(s.seeded && typeof s.seeded === 'object' ? s.seeded : {}) },
    truce: Array.isArray(s.truce) ? s.truce.filter((t) => t && typeof t.d === 'string' && [1, 2, 3].includes(Number(t.opt))).slice(-20) : [], told: !!s.told,
  };
}
export const newScn = (id: string): ScnSave => ({ id, start: '', date: '', seat: '', lvl: 0, names: {}, idx: {}, seeded: {}, truce: [] });

export interface ScnEvent { kind: 'start' | 'year' | 'power' | 'truce' | 'name' | 'seat'; opt?: number; lvl?: number }
/** 줄 하나 적용. s 가 없으면(이 세이브에서 처음) 새로 만든다. 시나리오 줄이 아니면 null. */
export function applyScn(s: ScnSave | null, kind: string, kv: Record<string, string>): { s: ScnSave; e: ScnEvent } | null {
  if (!['SCN', 'SCNN', 'SCNSEAT'].includes(kind)) return null;
  const id = str(kv.sc); if (!SCN_IDS.includes(id as typeof SCN_IDS[number])) return null;
  const o = s && s.id === id ? s : newScn(id), d = str(kv.date);
  if (d) { o.date = d; if (!o.start) o.start = d; }
  if (kind === 'SCNN') {
    const sd = side(kv.side), name = str(kv.name); if (!sd || !name) return null;
    o.names[sd] = name; const i = Math.round(num(kv.idx)); if (i > 0) o.idx[sd] = i;
    return { s: o, e: { kind: 'name' } };
  }
  if (kind === 'SCNSEAT') { const st = str(kv.seat); o.seat = st === 'a' || st === 'b' || st === 'p' ? st : 'x'; return { s: o, e: { kind: 'seat' } }; }
  const ev = str(kv.ev);
  if (ev === 'start') { if (d) o.start = d; return { s: o, e: { kind: 'start' } }; }
  if (ev === 'power') { o.lvl = Math.max(1, Math.min(3, Math.round(num(kv.lvl)) || 1)); return { s: o, e: { kind: 'power', lvl: o.lvl } }; }
  if (ev === 'truce') { const opt = Math.round(num(kv.opt)); if (![1, 2, 3].includes(opt)) return null; o.truce.push({ d, opt }); if (o.truce.length > 20) o.truce.shift(); return { s: o, e: { kind: 'truce', opt } }; }
  if (ev === 'year') return { s: o, e: { kind: 'year' } };
  return { s: o, e: { kind: 'year' } }; // cleared 등: 시나리오라는 것만 안다
}

// ---- 지난 역사(회랑의 삼파전). {A}{B}{P} 는 게임 속 이름으로 바꾼다. 연대기 한 줄은 140자 안 ----
export interface SeedLine { d: string; ko: string; en: string }
const WORLD: SeedLine[] = [
  { d: '2131.06.01', ko: '지구 국제연합이 외계 종족을 시민으로 받아들이기로 했다. 데네브의 식민지들은 배신이라 부르며 모든 통신을 끊었다(결별의 맹세).', en: "Earth's United Nations voted to accept alien species as citizens. The Deneb colonies called it betrayal and cut all contact (the Severed Oath)." },
  { d: '2133.02.10', ko: '솔에서 {A}이(가), 데네브에서 {B}이(가) 세워졌다. 인류는 두 나라로 갈라졌다.', en: 'The {A} was founded at Sol and the {B} at Deneb. Humanity was split in two.' },
  { d: '2151.08.20', ko: '바스틸 회랑에서 첫 전쟁이 일어났다. {A}와(과) {B}의 함대가 처음 맞붙었다.', en: 'The first war broke out in the Bastille Corridor as the fleets of the {A} and the {B} met.' },
  { d: '2172.04.03', ko: '두 번째 바스틸 전쟁. {B}이(가) 회랑 한가운데에 철문 요새를 세웠다.', en: 'The second Bastille war. The {B} raised the Irongate fortress in the middle of the corridor.' },
  { d: '2188.11.15', ko: '세 번째 바스틸 전쟁 끝에 철문 요새가 무너졌다.', en: 'The third Bastille war ended with the fall of the Irongate fortress.' },
  { d: '2189.03.01', ko: '{A}와(과) {B}이(가) 철문 휴전 조약을 맺었다. {B}의 총통은 이날을 씻어야 할 치욕의 날이라 불렀다.', en: "The {A} and the {B} signed the Irongate Truce. The {B}'s leader called it a day of shame to be avenged." },
  { d: '2194.07.12', ko: '{P}이(가) 두 나라 사이의 또 하나뿐인 길, 세렌 회랑을 쥐었다.', en: 'The {P} took hold of the Seren Corridor, the only other route between the two powers.' },
  { d: '2199.10.01', ko: '휴전 조약이 낡아 간다. 두 나라가 다시 함대를 쌓기 시작했다.', en: 'The truce is growing old. Both powers have begun building up their fleets again.' },
];
// 두 나라 사이에 있었던 일(그 제국의 연대기 = 그 제국과 플레이어 사이의 일). 키는 두 자리를 abc 순으로
const PAIR: Record<'ab' | 'ap' | 'bp', SeedLine[]> = {
  ab: [
    { d: '2131.06.01', ko: '지구가 외계 종족과 섞이기로 한 날, 데네브는 통신을 끊었다. {B}은(는) 지금도 지구를 배신자라 부른다.', en: 'When Earth chose to live with aliens, Deneb cut all contact. The {B} still calls Earth a traitor.' },
    { d: '2151.08.20', ko: '바스틸 회랑에서 서로 첫 전쟁을 치렀다.', en: 'Fought each other for the first time in the Bastille Corridor.' },
    { d: '2172.04.03', ko: '두 번째 바스틸 전쟁. 회랑 한가운데에 철문 요새가 섰다.', en: 'The second Bastille war. The Irongate fortress rose in the middle of the corridor.' },
    { d: '2188.11.15', ko: '세 번째 바스틸 전쟁에서 철문 요새가 무너졌다. 양쪽 모두 많은 전사자를 냈다.', en: 'The Irongate fortress fell in the third Bastille war. Both sides lost many.' },
    { d: '2189.03.01', ko: '철문 휴전 조약을 맺었다. 한쪽에는 추모일, 다른 쪽에는 치욕의 날이다.', en: 'Signed the Irongate Truce: a day of mourning for one side, a day of shame for the other.' },
  ],
  ap: [
    { d: '2194.07.12', ko: '세렌 회랑을 사이에 둔 이웃이 되었다. {A}은(는) {P}을(를) 동맹으로 삼고 싶어 한다.', en: 'Became neighbours across the Seren Corridor. The {A} would like the {P} as an ally.' },
  ],
  bp: [
    { d: '2194.07.12', ko: '{B}은(는) 세렌 회랑을 「인류의 길목」이라 부르며 {P}에게 복종을 요구해 왔다.', en: 'The {B} calls the Seren Corridor "humanity\'s gateway" and has long demanded the submission of the {P}.' },
  ],
};
/** 이름 뒤 조사 「이(가)」 등을 받침에 맞게(한글로 끝나지 않으면 그대로 둔다). */
export function josa(t: string): string {
  const P: Record<string, [string, string]> = { '이(가)': ['이', '가'], '와(과)': ['과', '와'], '은(는)': ['은', '는'], '을(를)': ['을', '를'] };
  return t.replace(/([^\s])(이\(가\)|와\(과\)|은\(는\)|을\(를\))/g, (m, c: string, j: string) => {
    const code = c.charCodeAt(0) - 0xac00; if (code < 0 || code > 11171) return m;
    return c + (code % 28 ? P[j][0] : P[j][1]);
  });
}
const fill = (t: string, n: Partial<Record<Side, string>>) => josa(t.replace(/\{A\}/g, n.a || '은하 얼라이언스').replace(/\{B\}/g, n.b || '인류 제국').replace(/\{P\}/g, n.p || '세렌의 작은 나라'));
const fillEn = (t: string, n: Partial<Record<Side, string>>) => t.replace(/\{A\}/g, n.a || 'Galactic Alliance').replace(/\{B\}/g, n.b || 'Human Empire').replace(/\{P\}/g, n.p || 'Seren nation');
const done = (l: SeedLine, n: Partial<Record<Side, string>>): SeedLine => ({ d: l.d, ko: fill(l.ko, n).slice(0, 140), en: fillEn(l.en, n).slice(0, 140) });
/** 세계 연대기에 넣을 줄. */
export function worldSeed(s: ScnSave): SeedLine[] { return s.id === 'corridor' ? WORLD.map((l) => done(l, s.names)) : []; }
/** 제국 x 의 연대기(x 와 플레이어 사이의 일)에 넣을 줄. 플레이어 자리를 모르거나 x 가 플레이어 자리면 빈 목록. */
export function sideSeed(s: ScnSave, x: Side): SeedLine[] {
  if (s.id !== 'corridor' || !s.seat || s.seat === 'x' || s.seat === x) return [];
  const k = [x, s.seat].sort().join('') as 'ab' | 'ap' | 'bp';
  return (PAIR[k] || []).map((l) => done(l, s.names));
}

/** 휴전 기념일 선택의 연대기 줄. */
export function truceLine(s: ScnSave, opt: number): Pair {
  const a = s.names.a || 'A', b = s.names.b || 'B';
  if (opt === 1) return [josa(`철문 휴전 기념일: 우리는 휴전 연장을 공개적으로 촉구했다. ${a}은(는) 반겼고 ${b}은(는) 간섭이라 불렀다.`), `Irongate Truce anniversary: we publicly urged extending the truce. The ${a} welcomed it; the ${b} called it meddling.`];
  if (opt === 3) return ['철문 휴전 기념일: 우리는 세렌 회랑 수비대를 늘렸다. 두 나라 모두 앞날의 신호로 받아들였다.', 'Irongate Truce anniversary: we reinforced the Seren Corridor garrison. Both powers read it as a sign of things to come.'];
  return ['철문 휴전 기념일: 우리는 아무 말도 하지 않았다.', 'Irongate Truce anniversary: we said nothing.'];
}

/** LLM 프롬프트 한 덩이(영어). 시나리오가 아니면 ''. tension: 긴장도 한 줄(있으면). */
export function scenarioPrompt(s: ScnSave | null | undefined, tension = ''): string {
  if (!s || s.id !== 'corridor') return '';
  const a = s.names.a || 'Galactic Alliance', b = s.names.b || 'Human Empire', p = s.names.p || 'a small nation';
  const L: string[] = [
    '[Scenario: The Corridor Triangle] This galaxy was set up as a scenario. Treat the following as established history.',
    `- Humanity split in two. The ${a} (capital Sol, born from Earth's United Nations) lets humans and aliens such as the Velari live as equals. The ${b} (capital Deneb, colonies that turned their back on Earth) holds that only humanity may rule and all other species must serve; it calls Earth a traitor for mixing with aliens (the Severed Oath).`,
    `- The two fought three wars in the Bastille Corridor. The last ended when the Irongate fortress fell and the Irongate Truce was signed (2189). The ${a} mourns that day; the ${b}'s leader calls it a shame to be avenged. The truce is aging and both are rearming.`,
    `- The only other route between them is the Seren Corridor, held by the ${p}. The ${a} wants it as an ally; the ${b} demands its submission.`,
    '- Between the two powers lies a wide empty void (the Silent Expanse); the corridors are the only ways across.',
  ];
  if (s.seat && s.seat !== 'x') L.push(`- The player's empire holds ${SIDE_ROLE[s.seat][1]}.`);
  if (s.lvl >= 2) L.push(`- Both great powers are far stronger than the ${p}${s.lvl === 3 ? ', with economies and fleets rivalling the ancient fallen empires' : ''}.`);
  const last = s.truce[s.truce.length - 1];
  const me = s.seat && s.seat !== 'x' ? `the ${s.names[s.seat] || 'player'}` : 'the player';
  if (last) L.push(`- At the latest Irongate Truce anniversary (${last.d}) ${me} ${last.opt === 1 ? 'publicly urged extending the truce' : last.opt === 3 ? 'reinforced the Seren Corridor garrison' : 'stayed silent'}.`);
  if (tension) L.push('- ' + tension.replace(/^\[[^\]]*\]\s*/, ''));
  return L.join('\n');
}
