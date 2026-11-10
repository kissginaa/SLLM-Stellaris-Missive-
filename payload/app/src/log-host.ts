// 국제 대회 유치(2026-10-31 사용자 결정): 유치 경쟁·로비·투표 장면 → 개최 준비(경기장 건설) → 대회 기간 개최 효과.
// 올림픽·월즈 공통 규칙. 순수 모듈(전자·파일·게임 없음) — 앱은 src/features/log-app.ts, 화면은 ui/log.html.
// 돈: 국가 행사라 신청비·외교 선물·뒷돈·공식 사절·경기장·선수촌·보안·홍보 모두 게임 자원(에너지·합금·영향력·소비재, 게임 명령 SLLM:LOGPAY) — 통치자 개인 금고는 쓰지 않음(2026-11-04 사용자 결정).

export type HostEvent = 'oly' | 'worlds';
export type LobbyKind = 'gift' | 'envoy' | 'bribe';
export type Lean = 'us' | 'swing' | 'them';
export interface GameCost { energy?: number; alloys?: number; influence?: number; consumer_goods?: number }

/** 저장: 올림픽 s.oly.hb, 월즈 nat.wbid.hb. */
export interface HostBid {
  rivals?: number[];                       // 유치 경쟁국(은하 공동체 회원국 sllm_idx) — 신청 기간이 열릴 때 정함
  lobby?: Record<string, number>;          // 회원국별 우리 쪽 호감 보정(로비)
  used?: Record<string, LobbyKind[]>;      // 회원국별로 이미 쓴 로비 수단(수단마다 한 번)
  bribed?: number[]; caught?: number[];    // 뒷돈 준 나라 · 들킨 나라
  rounds?: Array<Record<string, number>>;  // 투표 라운드별 득표(후보 → 표, 우리 = -1)
  ballots?: Record<string, number>;        // 마지막 투표에서 회원국 → 고른 후보(투표 장면, 2026-10-31)
  speech?: Record<string, number>;         // 은하 공동체 회의 연설로 움직인 호감(회원국별 누적, 상한 HOST.speech.cap)
  prep?: { planet?: string; level: number; done: string[] }; // 개최 준비(투표에서 이긴 뒤)
  ceremony?: 'open' | 'unity' | 'glory' | 'rivalry'; // 개막식 축사(대회가 열리면 open → 고른 것)
  result?: 'great' | 'ok' | 'poor';        // 대회 기간 개최 성적
}

export const HOST = {
  gift: { base: 200, perWeight: 8, like: 0.3 },                 // 외교 선물(에너지, 2026-11-04 금고 → 게임 자원)
  envoy: { cost: { influence: 30 } as GameCost, like: 0.3 },     // 공식 사절(영향력)
  bribe: { base: 500, perWeight: 15, like: 0.8, catch: 0.25, caughtLike: -0.8, mood: -2, susp: 2 }, // 뒷돈(에너지, 2026-11-04 금고 → 게임 자원) — 들키면 그 나라는 반대표·민심 −·부패 낌새
  speech: { perPoint: 0.02, cap: 0.6 },                         // 회의 연설: 설득 1점 = 호감 0.02, 나라마다 ±0.6까지(2026-10-31)
  leanGap: 0.15,                                                 // 표 예상: 이 차이보다 작으면 「흔들림」
  good: 60, poor: 30,                                            // 준비도 기준(대성공 · 망신)
  homeGear: 4,                                                   // 개최국 홈 이점(장비 보너스, 준비도에 비례해 절반~전부)
  tourism: { great: 900, ok: 400 },                              // 관광 수입(에너지)
  prideDays: 360,
} as const;

/** 개최 준비 사업(각각 한 번). gain = 준비도 +. */
export const PREP: Array<{ id: string; ko: string; en: string; game: GameCost; gain: number }> = [
  { id: 'arena', ko: '주경기장 건설', en: 'Build the main arena', game: { alloys: 300, energy: 500 }, gain: 40 },
  { id: 'village', ko: '선수촌·교통망', en: "Athletes' village & transit", game: { energy: 400 }, gain: 25 },
  { id: 'security', ko: '보안·질서 유지', en: 'Security & order', game: { influence: 50 }, gain: 15 },
  { id: 'promo', ko: '홍보·개막식 준비', en: 'Promotion & opening ceremony', game: { consumer_goods: 300 }, gain: 20 }, // 2026-11-04: 금고 1500 → 소비재 300(사용자 결정)
];

/** 외교 선물·뒷돈 비용(에너지). 게임 납부 명령 한도(5000) 안. */
export const lobbyCost = (kind: LobbyKind, weight: number): number => Math.min(5000, Math.round(((kind === 'bribe' ? HOST.bribe.base + HOST.bribe.perWeight * weight : HOST.gift.base + HOST.gift.perWeight * weight)) / 50) * 50);
export const lobbyLike = (kind: LobbyKind): number => (kind === 'bribe' ? HOST.bribe.like : kind === 'envoy' ? HOST.envoy.like : HOST.gift.like);

/** 표 예상(난수 없이): 회원국마다 우리 점수 vs 가장 좋아하는 경쟁국 점수. 자기 나라가 후보면 자기에게. */
export function predict(voters: Array<{ idx: number; weight: number; like: number }>, rivals: number[], lobby: Record<string, number> = {}): Array<{ idx: number; weight: number; lean: Lean; score: number }> {
  return voters.map((v) => {
    const us = v.like + (lobby[String(v.idx)] ?? 0), them = rivals.length ? Math.max(...rivals.map((b) => (b === v.idx ? 2 : 0))) : -9;
    const lean: Lean = them >= 2 ? 'them' : us > them + HOST.leanGap ? 'us' : us < them - HOST.leanGap ? 'them' : 'swing';
    return { idx: v.idx, weight: v.weight, lean, score: Math.round((us - them) * 100) / 100 };
  });
}

/** 회의 연설 한 번의 설득 점수(−10~10) → 그 나라 호감 변화. 누적은 ±cap 안에서만(끝없이 연설해서 표를 쓸어 담지 못하게). 돌려주는 값 = 실제로 더해진 호감. */
export function speechLike(hb: HostBid, idx: number, delta: number): number {
  if (!Number.isFinite(delta) || !delta) return 0; const k = String(idx), sp = (hb.speech ??= {}), prev = sp[k] ?? 0;
  const next = Math.max(-HOST.speech.cap, Math.min(HOST.speech.cap, prev + delta * HOST.speech.perPoint)), add = Math.round((next - prev) * 1000) / 1000;
  if (!add) return 0; sp[k] = next; const lb = (hb.lobby ??= {}); lb[k] = Math.round(((lb[k] ?? 0) + add) * 1000) / 1000; return add;
}
/** 준비도 → 대회 성적. */
export const hostResult = (level: number): 'great' | 'ok' | 'poor' => (level >= HOST.good ? 'great' : level < HOST.poor ? 'poor' : 'ok');
/** 홈 이점(장비 보너스): 준비도 0이면 절반, 100이면 전부. */
export const homeBonus = (level: number): number => Math.round(HOST.homeGear * (0.5 + Math.max(0, Math.min(100, level)) / 200) * 10) / 10;

/** 게임 자원 납부 명령: 자원이 모두 있어야 한 번에 차감. 같은 납부 ID 는 한 번만. 회신 SLLM:LOGPAY status=applied|short|duplicate. */
export function hostPayCommand(req: number, sid: string, payId: string, cost: GameCost): string {
  const parts = (['energy', 'alloys', 'influence', 'consumer_goods'] as const).filter((k) => cost[k] !== undefined);
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !/^[a-z0-9_]{1,40}$/.test(payId) || !parts.length || !parts.every((k) => Number.isSafeInteger(cost[k]) && (cost[k] as number) >= 1 && (cost[k] as number) <= 5000)) throw new Error('INVALID_LOGPAY');
  const mark = `sllm_lgpay_${payId}`, log = (s: string) => `log = "SLLM:LOGPAY/;/req=${req}/;/sid=${sid}/;/pid=${payId}/;/status=${s}"`;
  const short = `OR = { ${parts.map((k) => `resource_stockpile_compare = { resource = ${k} value < ${cost[k]} }`).join(' ')} }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { ${short} } ${log('short')} } else = { add_resource = { ${parts.map((k) => `${k} = -${cost[k]}`).join(' ')} } set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}

/** 저장 정리(손상·옛 저장). */
export function sanitizeHostBid(v: unknown): HostBid | undefined {
  if (!v || typeof v !== 'object') return undefined; const o = v as Record<string, unknown>, out: HostBid = {};
  const nums = (a: unknown) => (Array.isArray(a) ? a.filter((x) => Number.isSafeInteger(x)).slice(0, 40) as number[] : undefined);
  if (o.rivals) out.rivals = nums(o.rivals); if (o.bribed) out.bribed = nums(o.bribed); if (o.caught) out.caught = nums(o.caught);
  if (o.lobby && typeof o.lobby === 'object') { out.lobby = {}; for (const [k, x] of Object.entries(o.lobby as object)) if (typeof x === 'number' && Number.isFinite(x)) out.lobby[k] = Math.max(-2, Math.min(3, x)); }
  if (o.used && typeof o.used === 'object') { out.used = {}; for (const [k, x] of Object.entries(o.used as object)) if (Array.isArray(x)) out.used[k] = x.filter((y) => y === 'gift' || y === 'envoy' || y === 'bribe'); }
  for (const k of ['ballots', 'speech'] as const) if (o[k] && typeof o[k] === 'object') { const m: Record<string, number> = {}; for (const [kk, x] of Object.entries(o[k] as object)) if (typeof x === 'number' && Number.isFinite(x) && /^-?\d+$/.test(kk)) m[kk] = k === 'speech' ? Math.max(-HOST.speech.cap, Math.min(HOST.speech.cap, x)) : x; out[k] = m; }
  if (Array.isArray(o.rounds)) out.rounds = (o.rounds as unknown[]).filter((r) => r && typeof r === 'object').slice(0, 8) as Array<Record<string, number>>;
  if (o.prep && typeof o.prep === 'object') { const p = o.prep as Record<string, unknown>; out.prep = { level: Math.max(0, Math.min(100, Number(p.level) || 0)), done: Array.isArray(p.done) ? p.done.filter((x) => PREP.some((q) => q.id === x)) as string[] : [], ...(typeof p.planet === 'string' && p.planet ? { planet: p.planet.slice(0, 60) } : {}) }; }
  if (o.ceremony === 'open' || o.ceremony === 'unity' || o.ceremony === 'glory' || o.ceremony === 'rivalry') out.ceremony = o.ceremony;
  if (o.result === 'great' || o.result === 'ok' || o.result === 'poor') out.result = o.result;
  return out;
}
