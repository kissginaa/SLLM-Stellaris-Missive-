// 관저 파티(2026-11-03 사용자: 매스 이펙트 3 시타델 DLC 의 셰퍼드 아파트 파티처럼 — 사교회와 다른, 우리 사람들끼리의 사적인 파티).
// 순수 자료·규칙(electron 없이 selftest). 앱: src/features/party-app.ts, 화면: ui/party.html.
// 사용자 결정: 아무 때나 열 수 있음(주기 제한) · 효과는 관계(신뢰·지도자끼리 관계 + 통합력 아주 조금) + 전쟁·위기 중이면 아주아주 소폭의 전투 보정 · 관저 그림 위 손님 초상화.
// 손님끼리의 수다·소동은 미리 쓴 틀 문장(AI 없음). 통치자가 직접 말을 걸 때만 AI(1:1 과 같은 셈법).

export const PARTY = { cooldownDays: 180, minGuests: 2, maxGuests: 10, phases: 3, trust: 3, buffDays: 360, maxForeign: 2 } as const;
export type Group = 'mil' | 'sci' | 'civ' | 'fam';
/** foreign: 다른 나라의 친해진 지도자(2026-11-03 사용자 — 통치자 제외, 전쟁 중인 나라 제외, 한 파티에 둘까지). */
export interface Guest { key: string; name: string; role: string; group: Group; talk: boolean; foreign?: { idx: number; empire: string } }

/** 관저 안의 자리(화면 % — 그림이 오면 재서 맞춤). 자리마다 둘까지. */
export const SPOTS: Array<{ id: string; ko: string; en: string; x: number; y: number }> = [
  { id: 'sofa', ko: '거실 소파', en: 'Living-room sofa', x: 17, y: 73 },
  { id: 'bar', ko: '바', en: 'The bar', x: 33, y: 58 },
  { id: 'balcony', ko: '발코니', en: 'Balcony', x: 82, y: 54 },
  { id: 'kitchen', ko: '주방 아일랜드', en: 'Kitchen island', x: 66, y: 63 },
  { id: 'piano', ko: '피아노 옆', en: 'By the piano', x: 11, y: 54 },
  { id: 'dance', ko: '음악 앞', en: 'By the music', x: 50, y: 84 },
  { id: 'window', ko: '큰 창가', en: 'The big window', x: 50, y: 63 },
  { id: 'stairs', ko: '계단', en: 'The stairs', x: 92, y: 68 },
];
export const PHASES: Array<[string, string]> = [['손님 맞이', 'Arrivals'], ['한창', 'In full swing'], ['늦은 밤', 'Late night']];

export const groupOf = (role: string, kind: 'leader' | 'partner' | 'child' = 'leader'): Group => {
  if (kind !== 'leader') return 'fam'; const r = role.toLowerCase();
  return /admiral|general|commander|fleet|army|제독|장군/.test(r) ? 'mil' : /scien|research|과학/.test(r) ? 'sci' : 'civ';
};
export function rng(seed: number): () => number { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hashStr = (s: string): number => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- 손님끼리의 수다(둘이 한 자리에 앉으면) — 2026-11-03 사용자: 간단하게, 말끝을 흐리는 생략식으로("그러니까 ...", "내 말은 ...").
// 무슨 이야기인지는 보여 주지 않고 분위기만. 직책과 상관없이 한 묶음에서 뽑는다.
export const FRAGS: Array<[string, string]> = [
  ['그러니까 ...', 'So, like ...'], ['내 말은 ...', 'What I mean is ...'], ['아니 근데 ...', 'No, but ...'], ['진짜? ...', 'Really? ...'],
  ['하하, 그건 ...', 'Haha, that\'s ...'], ['음 ...', 'Hmm ...'], ['그때 말이야 ...', 'Back then ...'], ['잠깐만, ...', 'Wait, ...'],
  ['솔직히 ...', 'Honestly ...'], ['아, 맞다 ...', 'Oh, right ...'], ['그건 좀 ...', 'That\'s a bit ...'], ['에이, 설마 ...', 'Come on, no way ...'],
  ['건배! ...', 'Cheers! ...'], ['쉿, 이건 비밀인데 ...', 'Shh, this is a secret, but ...'], ['어쨌든 ...', 'Anyway ...'], ['그래서 결국 ...', 'So in the end ...'],
];
export function banter(a: Guest, b: Guest, r: () => number): { a: string; b: string; who: string[]; ko: string[]; en: string[]; group?: boolean } {
  const i = Math.floor(r() * FRAGS.length); let j = Math.floor(r() * FRAGS.length); if (j === i) j = (j + 1) % FRAGS.length;
  return { a: a.key, b: b.key, who: [a.key, b.key], ko: [FRAGS[i][0], FRAGS[j][0]], en: [FRAGS[i][1], FRAGS[j][1]] };
}
// ---- 2026-11-03 사용자: 사교회처럼 가끔은 셋·넷이 한자리에 모인 무리도. 장면마다 확률로 하나, 소동 자리와는 다른 곳.
export const GROUP = { chance: 0.4, minGuests: 5, spots: ['sofa', 'bar', 'dance'] } as const; // 옆 자리와 안 겹치는 넓은 곳만
export const GROUP_FRAGS: Array<[string, string]> = [
  ['다들 들어 봐 ...', 'Listen, everyone ...'], ['자, 그럼 ...', 'Right, so ...'], ['나도 나도 ...', 'Me too, me too ...'], ['하하하 ...', 'Hahaha ...'],
  ['그 얘기 또 해? ...', 'This story again? ...'], ['누가 그랬는데 ...', 'Someone told me ...'], ['아니야, 그게 아니라 ...', 'No, no, it was ...'], ['우리끼리 얘긴데 ...', 'Just between us ...'],
];
export function groupBanter(gs: Guest[], r: () => number): ReturnType<typeof banter> {
  const pool = [...GROUP_FRAGS, ...FRAGS], used = new Set<number>(), ko: string[] = [], en: string[] = [];
  for (let n = 0; n < gs.length; n++) { let i = Math.floor(r() * pool.length); while (used.has(i)) i = (i + 1) % pool.length; used.add(i); ko.push(pool[i][0]); en.push(pool[i][1]); }
  return { a: gs[0].key, b: gs[1].key, who: gs.map((g) => g.key), ko, en, group: true };
}

// ---- 소동(장면마다 하나). need = 필요한 손님 수, spot = 어디서. good = 같이 한 두 사람의 관계(교류) 결과
export interface Incident { id: string; need: 1 | 2 | 3; spot: string; icon?: string; phase: number[]; ko: string; en: string; good: 'good' | 'friction' | 'none' }
export const INCIDENTS: Incident[] = [
  { id: 'toast', icon: '🥂', need: 1, spot: 'bar', phase: [0], ko: '{a}이(가) 잔을 들고 즉석 건배사를 합니다. "우리 제국과 — 오늘 밤의 휴전에!"', en: '{a} raises a glass for an impromptu toast: "To the empire — and to tonight\'s ceasefire!"', good: 'none' },
  { id: 'arrival_gift', icon: '🎁', need: 1, spot: 'sofa', phase: [0], ko: '{a}이(가) 고향 행성의 특산물을 선물로 가져왔습니다. 냄새가… 독특합니다.', en: '{a} brought a delicacy from their home world. The smell is… distinctive.', good: 'none' },
  { id: 'drinking', icon: '🍺', need: 2, spot: 'bar', phase: [1], ko: '{a}와(과) {b}의 술 대결이 붙었습니다! 구경꾼이 모여들고, 결국 {a}이(가) 바닥에 주저앉습니다.', en: '{a} and {b} start a drinking contest! A crowd gathers, and {a} ends up sitting on the floor.', good: 'good' },
  { id: 'karaoke', icon: '🎤', need: 2, spot: 'dance', phase: [1, 2], ko: '{a}이(가) 마이크를 잡자 {b}이(가) 화음을 넣습니다. 의외로 꽤 잘합니다.', en: '{a} grabs the mic and {b} joins in harmony. Surprisingly, they\'re good.', good: 'good' },
  { id: 'dance', icon: '💃', need: 2, spot: 'dance', phase: [1], ko: '{a}이(가) {b}을(를) 끌고 나와 춤을 춥니다. 둘 다 박자는 엉망이지만 웃음이 끊이지 않습니다.', en: '{a} drags {b} onto the floor. Neither has rhythm, but they can\'t stop laughing.', good: 'good' },
  { id: 'cook', icon: '🔥', need: 2, spot: 'kitchen', phase: [1], ko: '{a}와(과) {b}이(가) 주방에서 안주를 만들다 연기를 피웁니다. 화재경보가 울릴 뻔했습니다.', en: '{a} and {b} try to make snacks and fill the kitchen with smoke. The fire alarm nearly goes off.', good: 'good' },
  { id: 'argument', icon: '💢', need: 2, spot: 'window', phase: [1, 2], ko: '{a}와(과) {b}이(가) 예전 작전 이야기로 언성을 높입니다. 잠시 분위기가 싸늘해집니다.', en: '{a} and {b} raise their voices over an old operation. The room goes cold for a moment.', good: 'friction' },
  { id: 'piano', icon: '🎹', need: 1, spot: 'piano', phase: [1, 2], ko: '{a}이(가) 피아노 앞에 앉더니 조용한 곡을 연주합니다. 다들 잠시 말을 멈춥니다.', en: '{a} sits at the piano and plays something quiet. Everyone stops talking for a moment.', good: 'none' },
  { id: 'balcony_talk', icon: '🌃', need: 2, spot: 'balcony', phase: [2], ko: '발코니에서 {a}와(과) {b}이(가) 도시 불빛을 보며 오래 이야기합니다. 무슨 이야기인지는 둘만 압니다.', en: 'On the balcony, {a} and {b} talk for a long time under the city lights. Only they know what about.', good: 'good' },
  { id: 'asleep', icon: '💤', need: 1, spot: 'sofa', phase: [2], ko: '{a}이(가) 소파에서 잠들었습니다. 누군가 얼굴에 장난을 칠까 고민 중입니다.', en: '{a} has fallen asleep on the sofa. Someone is considering doodling on their face.', good: 'none' },
  { id: 'stairs_fall', icon: '👏', need: 1, spot: 'stairs', phase: [2], ko: '{a}이(가) 계단에서 미끄러졌지만 잔은 한 방울도 흘리지 않았습니다. 박수가 쏟아집니다.', en: '{a} slips on the stairs without spilling a single drop. Applause erupts.', good: 'none' },
  { id: 'secret', icon: '🤫', need: 2, spot: 'stairs', phase: [2], ko: '{a}이(가) {b}에게 오랫동안 숨겨 온 이야기를 털어놓습니다. {b}은(는) 조용히 고개를 끄덕입니다.', en: '{a} confides a long-kept secret to {b}, who simply nods.', good: 'good' },
  // 2026-11-03 사용자: 파티 더 다듬기 — 소동 늘림(셋이 함께하는 소동 포함)
  { id: 'late_entrance', need: 1, spot: 'stairs', phase: [0], icon: '🚪', ko: '{a}이(가) 한참 늦게 계단 위에 나타납니다. 모두의 시선이 쏠리자 태연하게 손을 흔듭니다.', en: '{a} appears at the top of the stairs, fashionably late, and waves as if nothing happened.', good: 'none' },
  { id: 'same_outfit', need: 2, spot: 'window', phase: [0], icon: '👔', ko: '{a}와(과) {b}이(가) 똑같은 옷을 입고 왔습니다. 어색한 침묵 끝에 둘 다 웃음을 터뜨립니다.', en: '{a} and {b} showed up in the exact same outfit. After an awkward silence, both burst out laughing.', good: 'good' },
  { id: 'reunion', need: 2, spot: 'bar', phase: [0], icon: '🎓', ko: '{a}와(과) {b}이(가) 같은 사관학교 동기였다는 걸 알게 됩니다. 옛 교관 흉내가 시작됩니다.', en: '{a} and {b} discover they were in the same academy class. Impressions of old instructors begin.', good: 'good' },
  { id: 'buffet_rush', need: 1, spot: 'kitchen', phase: [0], icon: '🍤', ko: '{a}이(가) 뷔페에 제일 먼저 달려갑니다. 접시가 벌써 산더미입니다.', en: '{a} is first to the buffet. Their plate is already a small mountain.', good: 'none' },
  { id: 'coat_mixup', need: 2, spot: 'sofa', phase: [0], icon: '🧥', ko: '{a}이(가) {b}의 외투를 자기 것인 줄 알고 입고 있었습니다. 주머니에서 낯선 물건이 나오자 둘 다 당황합니다.', en: '{a} has been wearing {b}\'s coat by mistake. Something unfamiliar turns up in the pocket, and both are flustered.', good: 'good' },
  { id: 'welcome_tune', need: 1, spot: 'piano', phase: [0], icon: '🎼', ko: '{a}이(가) 손님이 들어올 때마다 피아노로 짧은 환영곡을 쳐 줍니다. 점점 곡이 장난스러워집니다.', en: '{a} plays a little welcome tune on the piano for each arrival. The tunes get sillier each time.', good: 'none' },
  { id: 'arm_wrestle', need: 2, spot: 'bar', phase: [1], icon: '💪', ko: '{a}와(과) {b}의 팔씨름이 붙었습니다. 바 위의 잔들이 위태롭게 흔들립니다.', en: '{a} and {b} start arm-wrestling on the bar. The glasses tremble dangerously.', good: 'good' },
  { id: 'conga', need: 3, spot: 'dance', phase: [1], icon: '🎶', ko: '{a}이(가) 앞장서자 {b}와(과) {c}이(가) 뒤에 붙어 줄줄이 춤을 춥니다. 줄이 점점 길어집니다.', en: '{a} starts a conga line and {b} and {c} latch on behind. The line keeps growing.', good: 'good' },
  { id: 'card_game', need: 3, spot: 'sofa', phase: [1, 2], icon: '🃏', ko: '{a}, {b}, {c}이(가) 소파에 모여 홀로 카드 게임을 벌입니다. 판돈은 {a}이(가) 싹쓸이합니다.', en: '{a}, {b} and {c} gather on the sofa for a holo-card game. {a} sweeps the pot.', good: 'good' },
  { id: 'piano_duet', need: 2, spot: 'piano', phase: [1], icon: '🎹', ko: '{a}와(과) {b}이(가) 피아노 앞에 나란히 앉아 연탄곡을 칩니다. 틀린 음마다 웃음이 터집니다.', en: '{a} and {b} sit side by side at the piano for a duet. Every wrong note gets a laugh.', good: 'good' },
  { id: 'spill', need: 2, spot: 'window', phase: [1], icon: '🍷', ko: '{a}이(가) {b}의 옷에 술을 쏟았습니다. 사과는 했지만 {b}의 표정이 굳어 있습니다.', en: '{a} spills a drink all over {b}. An apology is made, but {b} is not smiling.', good: 'friction' },
  { id: 'dare', need: 1, spot: 'balcony', phase: [1], icon: '🎤', ko: '{a}이(가) 내기에 져서 발코니에서 도시를 향해 노래를 부릅니다. 아래층에서 박수가 들려옵니다.', en: '{a} lost a bet and has to sing to the city from the balcony. Applause drifts up from below.', good: 'none' },
  { id: 'ghost_story', need: 3, spot: 'stairs', phase: [2], icon: '👻', ko: '{a}이(가) 계단에 앉아 버려진 함선 괴담을 들려줍니다. {b}와(과) {c}이(가) 동시에 비명을 지릅니다.', en: '{a} tells a derelict-ship ghost story on the stairs. {b} and {c} scream at the same moment.', good: 'good' },
  { id: 'stargazing', need: 2, spot: 'window', phase: [2], icon: '🌌', ko: '{a}와(과) {b}이(가) 큰 창가에 서서 지나가는 함선 불빛을 셉니다.', en: '{a} and {b} stand at the big window, counting the lights of passing ships.', good: 'good' },
  { id: 'midnight_snack', need: 2, spot: 'kitchen', phase: [2], icon: '🍜', ko: '{a}와(과) {b}이(가) 몰래 주방에서 야식을 끓입니다. 냄새를 맡은 손님들이 하나둘 모여듭니다.', en: '{a} and {b} sneak a midnight snack in the kitchen. The smell draws guests in one by one.', good: 'good' },
  { id: 'slow_dance', need: 2, spot: 'dance', phase: [2], icon: '💃', ko: '음악이 느려지자 {a}와(과) {b}이(가) 플로어에 남아 천천히 춤을 춥니다.', en: 'The music slows, and {a} and {b} stay on the floor for a slow dance.', good: 'good' },
  { id: 'philosophy', need: 3, spot: 'bar', phase: [2], icon: '🥃', ko: '{a}, {b}, {c}이(가) 바에 남아 「우리 제국은 어디로 가는가」를 두고 토론합니다. 결론은 나지 않습니다.', en: '{a}, {b} and {c} linger at the bar debating "where is our empire headed". No conclusion is reached.', good: 'good' },
];
const fill = (s: string, a?: Guest, b?: Guest, c?: Guest) => s.replace(/\{a\}/g, a?.name ?? '').replace(/\{b\}/g, b?.name ?? '').replace(/\{c\}/g, c?.name ?? '');

export interface Scene { phase: number; seats: Record<string, string[]>; chats: Array<ReturnType<typeof banter>>; group?: { spot: string; who: string[] }; incident: { id: string; spot: string; who: string[]; icon?: string; ko: string; en: string; good: Incident['good'] } | null }
/** 장면 하나: 손님을 자리에 앉히고(자리마다 둘까지, 가끔 한 곳은 셋·넷이 모인 무리), 둘 이상 앉은 자리는 수다, 장면에 맞는 소동 하나. 같은 씨앗 = 같은 장면. */
export function planScene(guests: Guest[], phase: number, seed: number): Scene {
  const r = rng((seed ^ Math.imul(phase + 1, 2654435761)) >>> 0), list = guests.slice();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const spots = SPOTS.map((s) => s.id).sort(() => r() - 0.5), seats: Record<string, string[]> = {};
  const cand = INCIDENTS.filter((x) => x.phase.includes(phase) && guests.length >= x.need), pick = cand.length ? cand[Math.floor(r() * cand.length)] : null;
  const who = pick ? list.slice(0, pick.need) : [], rest = list.slice(who.length);
  // 무리: 소동에 안 끼는 손님 중 셋(손님 많으면 가끔 넷), 소동 자리 아닌 곳
  let grp: Guest[] = [], gspot = '';
  if (guests.length >= GROUP.minGuests && rest.length >= 3 && r() < GROUP.chance) {
    gspot = spots.find((sp) => (GROUP.spots as readonly string[]).includes(sp) && sp !== pick?.spot) ?? '';
    if (gspot) { const n = rest.length >= 8 && r() < 0.5 ? 4 : 3; grp = rest.splice(0, n); seats[gspot] = grp.map((g) => g.key); }
  }
  const free = spots.filter((sp) => sp !== gspot);
  rest.forEach((g, i) => { const sp = free[Math.floor(i / 2) % free.length]; (seats[sp] ??= []).push(g.key); });
  who.forEach((g) => { const sp = pick!.spot === gspot ? free[0] : pick!.spot; (seats[sp] ??= []).push(g.key); });
  const by = new Map(guests.map((g) => [g.key, g])), chats: Scene['chats'] = [];
  if (grp.length) chats.push(groupBanter(grp, r));
  for (const [sp, ks] of Object.entries(seats)) if (sp !== gspot && ks.length >= 2) chats.push(banter(by.get(ks[0])!, by.get(ks[1])!, r));
  let incident: Scene['incident'] = null;
  if (pick) { const [a, b, c] = who; incident = { id: pick.id, spot: pick.spot, who: who.map((g) => g.key), icon: pick.icon ?? '✨', ko: fill(pick.ko, a, b, c), en: fill(pick.en, a, b, c), good: pick.good };
    for (const k of incident.who) for (const sp of Object.keys(seats)) seats[sp] = seats[sp].filter((x) => x !== k); (seats[pick.spot] ??= []).unshift(...incident.who); // 소동 주인공은 그 자리로
    for (const sp of Object.keys(seats)) if (!seats[sp].length) delete seats[sp]; }
  return { phase, seats, chats, incident, ...(gspot && grp.length ? { group: { spot: gspot, who: grp.map((g) => g.key) } } : {}) };
}
/** 장면의 무리 알림(대화창 한 줄) — 없으면 null */
export function groupNote(s: Scene, guests: Guest[]): { ko: string; en: string } | null {
  if (!s.group) return null; const sp = SPOTS.find((x) => x.id === s.group!.spot), names = s.group.who.map((k) => guests.find((g) => g.key === k)?.name ?? k);
  return { ko: `🥂 ${sp?.ko ?? ''}에 ${names.join('·')}이(가) 모여 이야기꽃을 피웁니다.`, en: `🥂 ${names.join(', ')} gather ${sp ? 'at ' + sp.en.toLowerCase() : ''} and get a lively conversation going.` };
}
/** 함께 어울린 두 사람(같은 자리에 앉았거나 소동을 같이 함) — 관계 교류에 씀. 결과: 소동이 말다툼이면 friction, 아니면 good. */
export function pairsOf(scenes: Scene[]): Array<{ a: string; b: string; result: 'good' | 'friction' }> {
  const out = new Map<string, { a: string; b: string; result: 'good' | 'friction' }>();
  const add = (a: string, b: string, res: 'good' | 'friction') => { if (a === b) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; const cur = out.get(k); if (!cur || res === 'friction') out.set(k, { a, b, result: cur && cur.result === 'friction' ? 'friction' : res }); };
  for (const s of scenes) { for (const ks of Object.values(s.seats)) if (ks.length >= 2) add(ks[0], ks[1], 'good'); if (s.group) for (const x of s.group.who) for (const y of s.group.who) if (x < y) add(x, y, 'good'); if (s.incident) for (const x of s.incident.who) for (const y of s.incident.who) if (x < y) add(x, y, s.incident.good === 'friction' ? 'friction' : 'good'); }
  return [...out.values()];
}

// ---- 주기·날짜
const ymd = (d: string): number | null => { const m = /^(\d{1,5})\.(\d{1,2})\.(\d{1,2})$/.exec(String(d ?? '').trim()); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : null; };
/** 다음 파티까지 남은 날(0이면 지금 열 수 있음). 날짜를 모르면 0. */
export function daysUntil(last: string | undefined, now: string): number { const a = last ? ymd(last) : null, b = ymd(now); if (a === null || b === null) return 0; return Math.max(0, PARTY.cooldownDays - (b - a)); }

// ---- 게임 효과(모드 static modifier): 늘 통합력 아주 조금, 전쟁·위기 중에 열었으면 전투 보정 아주아주 조금. 360일.
export const PARTY_MODS = { cheer: 'sllm_party_cheer', resolve: 'sllm_party_resolve' } as const;
export function partyCommand(req: number, sid: string, resolve: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error('INVALID_PARTYFX');
  const add = `add_modifier = { modifier = ${PARTY_MODS.cheer} days = ${PARTY.buffDays} }` + (resolve ? ` add_modifier = { modifier = ${PARTY_MODS.resolve} days = ${PARTY.buffDays} }` : '');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } remove_modifier = ${PARTY_MODS.cheer} remove_modifier = ${PARTY_MODS.resolve} ${add} log = "SLLM:PARTYFX/;/req=${req}/;/sid=${sid}/;/resolve=${resolve ? 1 : 0}/;/status=applied" }`;
}
/** 타국 손님의 나라에 호감(앱이 그 나라에 붙임, who = 우리). sllm_idx 로 나라를 찾는다. 가볍게: +10, 달마다 줄어듦. */
export const PARTY_FOREIGN_OPINION = 'sllm_party_guest_goodwill';
export function partyForeignCommand(req: number, sid: string, idxs: number[]): string {
  const ids = [...new Set(idxs)].filter((i) => Number.isSafeInteger(i) && i > 0);
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !ids.length || ids.length > PARTY.maxForeign) throw new Error('INVALID_PARTYFG');
  const each = ids.map((i) => `every_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${i} } } remove_opinion_modifier = { who = prev modifier = ${PARTY_FOREIGN_OPINION} } add_opinion_modifier = { who = prev modifier = ${PARTY_FOREIGN_OPINION} } }`).join(' ');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${each} log = "SLLM:PARTYFG/;/req=${req}/;/sid=${sid}/;/n=${ids.length}/;/status=applied" }`;
}
/** 타국 손님 고르기 규칙: 둘까지, 같은 사람 중복 없음. */
export const foreignCount = (keys: string[]): number => keys.filter((k) => /^f:\d+:/.test(k)).length;
/** 타국 손님과의 대화 — 파티 자리의 사적인 잡담(외교 자리 아님). AI 한 번. */
/** 관저 파티 말투(2026-11-04 사용자: "관저파티 애들이 너무 사무적이야"). 우리 지도자·외국 손님 둘 다 이 문단을 붙인다.
 *  others: 같은 자리의 다른 손님 이름, happening: 지금 벌어지는 일·최근 대화(대화창 문장). */
export function partyTone(a: { others?: string[]; happening?: string[] } = {}): string {
  const others = (a.others ?? []).filter(Boolean).slice(0, 8), hap = (a.happening ?? []).map((t) => String(t).replace(/\s+/g, ' ').slice(0, 220)).filter(Boolean).slice(-6);
  return [
    '[Party mood - this matters more than your usual manner] You are off duty, a drink in hand, music playing. Talk like a person enjoying a party, not like an official on the job.',
    'Be warm and human: joke, tease, laugh at yourself, share a small personal story or opinion (food, drinks, music, hobbies, old memories, the other guests), and ask the ruler something back now and then.',
    'Keep your own personality and traits, but show their off-duty side: a stiff or logical person makes awkward small talk or a dry joke; a proud one boasts a little; a shy one gets chatty after a drink.',
    'Do NOT give reports, briefings, analyses, recommendations or advice on state affairs, and do not lecture or correct the ruler. Do not talk shop unless the ruler raises it - then only briefly, and drift back to the party.',
    'Avoid stiff official wording ("optimization", "efficiency", "it is my duty", "I recommend", "Your Excellency should..."). Use the relaxed, friendly register of your language (in Korean: soft, friendly 해요체 instead of stiff 합니다체; 반말 only if you are very close to the ruler).',
    'React to what is happening right now and to what the ruler actually said. Short and lively: one to three sentences.',
    others.length ? `Other guests nearby: ${others.join(', ')}.` : '',
    hap.length ? `[Happening at the party just now]\n${hap.map((t) => '- ' + t).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

export function foreignPartyMessages(a: { host: string; ruler: string; guest: string; role: string; empire: string; phase: string; spot?: string; ethics?: string; personality?: string; others?: string[]; happening?: string[] }, lines: Array<{ who: 'me' | 'them'; text: string }>, said: string): { role: 'system' | 'user'; content: string }[] {
  return [{ role: 'system', content: [
    `You are ${a.guest}, ${a.role} from the Stellaris empire "${a.empire}". You met ${a.ruler || 'the ruler'} of "${a.host}" at an earlier dinner and became friends; now they invited you to their private house party at their residence — friends, drinks and music, off the record, not a diplomatic event.`,
    `It is the "${a.phase}" part of the evening${a.spot ? `, and you are by the ${a.spot.toLowerCase()}` : ''}. Speak casually and warmly, as a foreign friend at a party.`,
    a.ethics ? `Your empire's ethics: ${a.ethics}.` : '', a.personality ? `Your empire's diplomatic personality: ${a.personality}.` : '',
    partyTone({ others: a.others, happening: a.happening }),
    lines.length ? `[Conversation so far]\n${lines.slice(-10).map((t) => `${t.who === 'me' ? (a.ruler || 'Host') : a.guest}: ${t.text.slice(0, 240)}`).join('\n')}` : '',
    'Reply in character. Your own personal view, not your government\'s. Never claim a treaty, deal or game action was made. Do not invent game facts or numbers. Never write the host\'s lines.',
  ].filter(Boolean).join('\n') }, { role: 'user', content: said.slice(0, 600) }];
}
