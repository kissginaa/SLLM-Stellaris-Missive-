// 통치자 침실(2026-10-30 사용자 결정, 계획서 8번) — 순수 자료·규칙(electron 없이 selftest).
// 개인실 책상 위 열쇠 → 침실. 그림은 성향별 8장(02_침실_그림_의뢰서.md: assets/private-rooms/private/<성향>-bedroom.webp), 없으면 앱이 그린 방.
// 꾸미기: 백화점(40·42층)·암시장에서 산 물건을 정해진 자리에 놓고 바꿈. 빈 액자·초상화 액자에는 플레이어가 고른 그림.
// 어항: 펫샵 물고기가 저절로 헤엄침. 양탄자: 펫샵 애완동물(이름·쓰다듬기). 돌봄 없음.
// 배우자·연인: 침실로 불러 단둘이 이야기(물을 때만 AI 한 번 — persona-app sayInPerson). 게임 명령 없음.

export type SlotId = 'bed' | 'floorA' | 'cornerB' | 'rug' | 'ceiling' | 'window' | 'wall1' | 'wall2' | 'wall3' | 'shelf1' | 'shelf2' | 'shelf3' | 'shelf4';
export type SlotKind = 'bed' | 'floor' | 'corner' | 'rug' | 'ceiling' | 'window' | 'wall' | 'shelf';
export interface Slot { id: SlotId; kind: SlotKind; ko: string; en: string }
export const SLOTS: Slot[] = [
  { id: 'bed', kind: 'bed', ko: '침대', en: 'Bed' },
  { id: 'floorA', kind: 'floor', ko: '어항 앞 바닥', en: 'Floor by the aquarium' },
  { id: 'cornerB', kind: 'corner', ko: '오른쪽 구석', en: 'Right corner' },
  { id: 'rug', kind: 'rug', ko: '침대 발치 양탄자', en: 'Rug at the foot of the bed' },
  { id: 'ceiling', kind: 'ceiling', ko: '천장 조명', en: 'Ceiling light' },
  { id: 'window', kind: 'window', ko: '창', en: 'Window' },
  { id: 'wall1', kind: 'wall', ko: '벽 액자 (왼쪽)', en: 'Wall frame (left)' },
  { id: 'wall2', kind: 'wall', ko: '벽 액자 (가운데)', en: 'Wall frame (center)' },
  { id: 'wall3', kind: 'wall', ko: '벽 액자 (오른쪽)', en: 'Wall frame (right)' },
  { id: 'shelf1', kind: 'shelf', ko: '협탁 위', en: 'Bedside table' },
  { id: 'shelf2', kind: 'shelf', ko: '진열 선반 1', en: 'Display shelf 1' },
  { id: 'shelf3', kind: 'shelf', ko: '진열 선반 2', en: 'Display shelf 2' },
  { id: 'shelf4', kind: 'shelf', ko: '진열 선반 3', en: 'Display shelf 3' },
];
export const slotById = (id: string): Slot | undefined => SLOTS.find((s) => s.id === id);

/** 백화점 물건 → 놓을 수 있는 자리 종류(백화점 src/store.ts 의 id). 41층(옷·장신구)은 선물이라 침실에 놓지 않음. */
export const STORE_FIT: Record<string, SlotKind> = {
  canopy_bed: 'bed', sleep_pod: 'bed',
  armchair: 'floor', holo_fireplace: 'floor', reading_nook: 'floor', chess_table: 'floor', gramophone: 'floor', alien_vine: 'floor',
  dresser: 'corner', mirror: 'corner', bookshelf: 'corner', nightstand: 'corner', crystal_sculpture: 'corner', bust: 'corner', candelabra: 'corner',
  starweave_rug: 'rug', starmap_lamp: 'ceiling', nebula_lamp: 'ceiling', silk_curtains: 'window',
  galaxy_map_frame: 'wall', homeworld_painting: 'wall', empty_frame: 'wall', nebula_oil: 'wall', holo_abstract: 'wall', constellation_tapestry: 'wall', voyage_painting: 'wall', portrait_frame: 'wall', alien_mask: 'wall',
  music_box: 'shelf', ship_model: 'shelf', cushion_set: 'shelf', candle_set: 'shelf', relic_replica: 'shelf', ancient_vase: 'shelf', meteorite: 'shelf', fossil: 'shelf', scroll: 'shelf', grav_hourglass: 'shelf', orrery: 'shelf', coin_case: 'shelf',
};
/** 플레이어가 고른 그림을 넣는 액자. */
export const CUSTOM_FRAMES = new Set(['empty_frame', 'portrait_frame']);
/** 암시장 물건은 모두 진열 선반(생물은 작은 유리 사육장째로). */
export const fitOf = (ref: string): SlotKind | null => {
  const [src, raw] = ref.split(':'), id = (raw ?? '').replace(/#\d+$/, ''); if (src === 'store') return STORE_FIT[id] ?? null; if (src === 'bm') return 'shelf'; return null;
};
export const fits = (slot: Slot, ref: string): boolean => fitOf(ref) === slot.kind;

/** 놓은 자리: 자리 → 물건 참조('store:<id>#<n>' 같은 물건 n번째 · 'bm:<uid>'). 없는 물건(팔거나 선물)은 화면에서 빈 자리. */
export type Layout = Partial<Record<SlotId, string>>;
/** 같은 물건을 두 자리에 놓을 수 없음 → 놓으면 다른 자리에서 뺌. */
export function place(layout: Layout, slot: SlotId, ref: string): Layout {
  const out: Layout = { ...layout };
  if (ref) for (const k of Object.keys(out) as SlotId[]) if (out[k] === ref) delete out[k];
  if (ref) out[slot] = ref; else delete out[slot];
  return out;
}
/** 남아 있지 않은 물건은 빼고 돌려줌. */
export function prune(layout: Layout, alive: Set<string>): Layout {
  const out: Layout = {}; for (const [k, v] of Object.entries(layout)) if (v && alive.has(v) && slotById(k) && fits(slotById(k)!, v)) out[k as SlotId] = v; return out;
}

/** 어항·양탄자 크기(펫샵 한도와 같게). */
export const TANK_MAX = 8, RUG_MAX = 3;

/** 쓰다듬기·어항 두드리기 — 침실에서(펫샵 줄과 따로, 이름으로 부름). */
export const PET_LINES: Array<[string, string]> = [
  ['{name}(이)가 이불 위로 뛰어올라 자리를 잡습니다.', '{name} hops onto the covers and settles in.'],
  ['{name}(이)가 손에 얼굴을 비비며 그르렁거립니다.', '{name} rubs against your hand, purring.'],
  ['{name}(이)가 양탄자 위에서 배를 보이며 뒹굽니다.', '{name} rolls over on the rug, belly up.'],
  ['{name}(이)가 통치자를 따라 창가까지 졸졸 따라옵니다.', '{name} trails after you all the way to the window.'],
  ['하루 일과 이야기를 들려주자 {name}(이)가 귀를 쫑긋 세웁니다.', 'You tell {name} about your day; its ears perk up.'],
];
export const FISH_LINES: Array<[string, string]> = [
  ['유리를 톡 두드리자 {name}(이)가 다가와 입을 뻐끔거립니다.', 'You tap the glass; {name} swims over, mouthing hello.'],
  ['먹이를 조금 뿌리자 물고기들이 반짝이며 모여듭니다.', 'A pinch of food, and the fish gather in a glittering swirl.'],
  ['어항 불빛이 방 안에 물결무늬를 드리웁니다. 마음이 차분해집니다.', 'The tank light casts rippling patterns over the room. You feel calmer.'],
];
export const EMPTY_ROOM_LINES: Record<'tank' | 'rug' | 'spouse', [string, string]> = {
  tank: ['어항이 비어 있습니다. 외출 → 펫샵에서 물고기를 들일 수 있습니다.', 'The tank is empty. Visit the pet shop (Outings) to bring fish home.'],
  rug: ['양탄자 위가 조용합니다. 펫샵에서 애완동물을 들일 수 있습니다.', 'The rug is quiet. The pet shop has companions waiting.'],
  spouse: ['침실로 부를 연인·배우자가 없습니다.', 'There is no partner or spouse to invite.'],
};

/** 배우자·연인 대화 장면(영어 프롬프트 — 대화 품질용). 단계별로 말투만 달리 함. 노골적인 내용 없음. */
export function bedroomScene(stage: string): string {
  const who = stage === 'married' ? 'your spouse' : stage === 'engaged' ? 'your betrothed' : 'your partner';
  return `It is late at night. The empire's leader (the player), ${who}, has invited you into the private bedchamber of the palace — away from courtiers, guards and state business. Soft lamplight, the aquarium glowing, the capital's lights beyond the window. Speak intimately and warmly, as one does alone with a loved one at the end of a long day; keep it tasteful and non-explicit.`;
}
/** 고른 그림 파일 이름(안전한 이름만). */
export const safeFrameName = (sid: string, slot: string, ext: string): string | null => {
  const e = ext.toLowerCase(); if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(e)) return null;
  const s = (sid + '_' + slot).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80); return `${s}_${Date.now()}${e}`;
};

// ---- 가구 편의(2026-10-31 사용자 결정): 침실에 가구를 놓지 않고, 백화점 40·42층 물건을 모은 종류 수만큼 통치자 컨디션 버프.
// 단계: 3·6·10·15종(같은 물건 여러 개는 1종). 게임 수정자 sllm_bedroom_comfort_1~4(나라, 기한 없음). 단계가 바뀔 때만 게임에 한 번 보냄(매달 안 보냄).
export const COMFORT = {
  steps: [3, 6, 10, 15] as const,
  mods: ['sllm_bedroom_comfort_1', 'sllm_bedroom_comfort_2', 'sllm_bedroom_comfort_3', 'sllm_bedroom_comfort_4'] as const,
  /** 화면·비서용 효과 설명(모드 파일 수치와 같게). */
  fx: [['', ''], ['통합력 +2% · 관료 경험치 +5%', 'Unity +2% · Official XP +5%'], ['통합력 +3% · 관료 경험치 +10%', 'Unity +3% · Official XP +10%'], ['통합력 +4% · 관료 경험치 +15%', 'Unity +4% · Official XP +15%'], ['통합력 +6% · 관료 경험치 +20% · 행복도 +2%', 'Unity +6% · Official XP +20% · Happiness +2%']] as Array<[string, string]>,
};
/** 모은 종류 수 → 단계(0~4). */
export const comfortTier = (kinds: number): number => COMFORT.steps.filter((s) => kinds >= s).length;
/** 다음 단계까지 남은 종류 수(최고 단계면 0). */
export const comfortNext = (kinds: number): number => { const n = COMFORT.steps.find((s) => kinds < s); return n === undefined ? 0 : n - kinds; };
/** 게임 명령: 네 단계 수정자를 모두 떼고 지금 단계만 붙임. 회신 SLLM:BEDCOMF status=applied. */
export function comfortCommand(req: number, sid: string, tier: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(tier) || tier < 0 || tier > COMFORT.mods.length) throw new Error('INVALID_BEDCOMF');
  const clear = COMFORT.mods.map((m) => `remove_modifier = ${m}`).join(' '), add = tier ? ` add_modifier = { modifier = ${COMFORT.mods[tier - 1]} days = -1 }` : '';
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${clear}${add} log = "SLLM:BEDCOMF/;/req=${req}/;/sid=${sid}/;/tier=${tier}/;/status=applied" }`;
}
