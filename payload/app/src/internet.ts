// 「인터넷」(2026-10-28 알파 10 동적 일상 분위기) — 순수 규칙. 앱: src/features/internet-app.ts, 화면: ui/office-internet.js.
// 사이트 3곳: 트윙클(tw, 트위터식·여성 사용자 많음) · DS인사이드(ds, 디시식 익명 갤럭시) · 레드시프트(rs, 레딧식 토론).
// 글은 LLM 이 쓴다(사용자 확정): 틀 문장이 글마다 작성자·주제·입장·인기를 정하고(초안), 열기·⟳ 때 사이트당 LLM 1번으로 본문을 다시 쓴다.
// 댓글은 글을 누를 때 LLM 1번으로 인기 댓글 최대 7개(TOP_COMMENTS)만. LLM 이 실패하면 틀 문장 그대로 보여 준다.
// 플레이어 글·답글·레드시프트 AMA 도 LLM 1번씩(internet-app).
// 규칙(사용자 확정 2026-10-28):
//  - 글은 인터넷을 열거나 ⟳ 새로고침할 때만, 지난번 이후 흐른 게임 시간만큼 만든다(안 열면 아무것도 안 만듦). 사이트마다 한 번에 최대 15개.
//  - 15개 안에서 몫: 통치자 자녀 글 최대 3개 · 일상 인플루언서 글 전체 합쳐 최소 2개(무작위, 서로 다른 사람) · 나머지 시민 글.
//  - 단골 시민 24명(진보 9 · 보수 9 · 중립 6을 기본으로 실제 파벌 지지율에 맞추되 갈래마다 최소 4명). 정신/물질은 곁가지 성향.
//  - 입장은 민심에 비례하되 긍정·부정 각각 최대 90%(아무리 좋아도 10%는 비판, 아무리 나빠도 10%는 낙관).
//  - 인터넷 말투 80% / 평문 20%(레드시프트는 50/50). 트윙클은 여성 70%·감성적 공감형 말투. 혐오 표현·현실 집단 비하는 쓰지 않는다(세계관 속 종족 계열로만).
//  - DS인사이드 본문 1~5줄(평균 1~2줄). DS·레드시프트 본문·댓글과 트윙클 답글은 글을 열 때 만든다(씨앗값으로 늘 같은 내용).
//  - 댓글은 실제로 최대 15개 만들고, 보이는 숫자는 인기만큼 크게(인기 답글/베스트 댓글/추천순 상위 댓글로 묶어 보임).
//  - DS 익명은 「ㅇㅇ(KL4.118)」처럼 행성 노드 코드 + 숫자(작성자마다 고정).
import type { FactionEthic } from './gamestate';

export type Site = 'tw' | 'ds' | 'rs';
export const SITES: readonly Site[] = ['tw', 'ds', 'rs'];
export type Lang = 'ko' | 'en';
export type Lean = 'prog' | 'cons' | 'neu';
export type Stance = 'pro' | 'con' | 'neu';
export const MAX_NEW = 15, MAX_KEEP: Record<Site, number> = { tw: 100, ds: 60, rs: 40 }, MAX_COMMENTS = 15, TOP_COMMENTS = 7, CHILD_SLOTS = 3, INF_MIN = 2;

// ── 씨앗 난수 ──
export function rng(seed: number): () => number { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pickOf = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ── 행성 노드 코드(DS 익명 주소, LLM 없음) ──
// 영문: 자음 2글자 + 숫자(Kalis IV → KL4). 한글: 초성 로마자 2글자. 겹치면 글자 하나 덧붙임.
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const CHO = ['G', 'K', 'N', 'D', 'T', 'R', 'M', 'B', 'P', 'S', 'S', 'O', 'J', 'J', 'C', 'K', 'T', 'P', 'H'];
export function nodeCode(name: string): string {
  const words = name.trim().split(/\s+/); let num = '';
  const last = words[words.length - 1] ?? ''; if (ROMAN[last.toUpperCase()]) { num = String(ROMAN[last.toUpperCase()]); words.pop(); } else if (/^\d+$/.test(last)) { num = last.slice(0, 2); words.pop(); }
  const base = words.join('');
  let letters = '';
  for (const ch of base) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) { letters += CHO[Math.floor((c - 0xac00) / 588)]; }
    else if (/[A-Za-z]/.test(ch)) { const u = ch.toUpperCase(); if (!letters || !/[AEIOU]/.test(u)) letters += u; }
    if (letters.length >= 2) break;
  }
  if (letters.length < 2) letters = (letters + 'XX').slice(0, 2);
  return letters + (num || String((hash(name) % 9) + 1));
}
export function nodeCodes(planets: string[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const p of planets) { let c = nodeCode(p), k = 0; while (seen.has(c) && k < 26) c = c.slice(0, 2) + String.fromCharCode(65 + k++) + c.slice(2); seen.add(c); out.push(c); }
  return out.length ? out : ['KL4', 'TR9', 'SL3', 'BR5'];
}
export function anonIp(seed: string, nodes: string[]): string { const h = hash(seed); return nodes[h % nodes.length] + '.' + (10 + ((h >>> 5) % 240)); }

// ── 시민 ──
export interface Citizen { id: string; name: string; g: 'm' | 'f'; lean: Lean; ethic: FactionEthic; side: 'spiritualist' | 'materialist' | ''; slang: boolean; planet: string; tw: string; rs: string }
const PROG: FactionEthic[] = ['egalitarian', 'xenophile', 'pacifist'], CONS: FactionEthic[] = ['authoritarian', 'xenophobe', 'militarist'];
export function leanOf(e: FactionEthic | ''): Lean { return PROG.includes(e as FactionEthic) ? 'prog' : CONS.includes(e as FactionEthic) ? 'cons' : 'neu'; }
/** 진보·보수·중립 인원(합 24). 파벌 지지율이 있으면 거기에 맞추되 갈래마다 최소 4명. */
export function leanSplit(factions: Array<{ ethic: FactionEthic; support: number }> | undefined, total = 24): Record<Lean, number> {
  const s = { prog: 0, cons: 0, neu: 0 }; for (const f of factions ?? []) s[leanOf(f.ethic)] += Math.max(0, f.support);
  const t = s.prog + s.cons + s.neu; if (t <= 0) return { prog: 9, cons: 9, neu: 6 };
  const min = 4, free = total - min * 3; const raw = { prog: min + free * s.prog / t, cons: min + free * s.cons / t, neu: min + free * s.neu / t };
  const out = { prog: Math.floor(raw.prog), cons: Math.floor(raw.cons), neu: Math.floor(raw.neu) };
  let rest = total - out.prog - out.cons - out.neu; const order = (['prog', 'cons', 'neu'] as Lean[]).sort((a, b) => (raw[b] - out[b]) - (raw[a] - out[a]));
  for (let i = 0; rest > 0; i++, rest--) out[order[i % 3]]++;
  return out;
}
const HANDLE_KO = ['별빛', '달토끼', '궤도', '새벽', '은하수', '조선소', '성운', '코코아', '푸른', '먼지', '라떼', '파도', '고양이', '로켓', '이끼', '노을'];
const HANDLE_EN = ['star', 'moon', 'orbit', 'dawn', 'nova', 'dock', 'nebula', 'cocoa', 'blue', 'dust', 'latte', 'wave', 'kitty', 'rocket', 'moss', 'dusk'];
const slug = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '').toLowerCase().slice(0, 10);
/** 세이브마다 한 번 만든다. name(g) 은 게임 이름 표에서 짓는 함수(못 지으면 null). */
export function makeCitizens(seed: number, split: Record<Lean, number>, planets: string[], name: (g: 'm' | 'f') => string | null): Citizen[] {
  const r = rng(seed), out: Citizen[] = []; let n = 0;
  const push = (lean: Lean) => {
    const g: 'm' | 'f' = r() < 0.55 ? 'f' : 'm', nm = name(g) || pickOf(r, g === 'f' ? ['Mirra Tell', 'Tila Oss', 'Sena Volk', 'Ruen Ah'] : ['Kori Vael', 'Brann Ox', 'Talos Dree', 'Ivo Sarn']);
    const ethic = lean === 'prog' ? pickOf(r, PROG) : lean === 'cons' ? pickOf(r, CONS) : pickOf(r, ['materialist', 'spiritualist', ''] as FactionEthic[]);
    const side = ethic === 'materialist' || ethic === 'spiritualist' ? ethic : r() < 0.3 ? (r() < 0.5 ? 'spiritualist' : 'materialist') : '';
    const i = n++, s = slug(nm) || 'citizen';
    out.push({ id: 'c' + i, name: nm, g, lean, ethic, side, slang: r() < 0.8, planet: planets.length ? pickOf(r, planets) : '', tw: s + '_' + (10 + Math.floor(r() * 89)), rs: pickOf(r, HANDLE_EN) + '_' + s.slice(0, 6) });
  };
  for (const l of ['prog', 'cons', 'neu'] as Lean[]) for (let i = 0; i < split[l]; i++) push(l);
  return out;
}

// ── 인플루언서(LLM 이 만들지 않고 미리 정해 둔 5명, 설정·프로필에서 바꿀 수 있다) ──
export type InfField = 'travel' | 'food' | 'fitness' | 'pets' | 'fashion';
export interface Influencer { id: string; field: InfField; ethic: FactionEthic; followers: number; name: { ko: string; en: string }; handle: string; bio: { ko: string; en: string }; catch: { ko: string; en: string }; avatar?: string }
export const INFLUENCERS: Influencer[] = [
  { id: 'lumi', field: 'travel', ethic: 'xenophile', followers: 482000, name: { ko: '루미', en: 'Lumi' }, handle: 'lumi_orbit', bio: { ko: '은하 37개 행성 여행 중 ✈ 창가 자리 수집가. 홍보 문의는 DM', en: '37 planets and counting ✈ window-seat collector. DM for collabs' }, catch: { ko: '다음 행성에서 만나요♡', en: 'see you on the next planet ♡' } },
  { id: 'sora', field: 'food', ethic: 'pacifist', followers: 315000, name: { ko: '소라 셰프', en: 'Chef Sora' }, handle: 'sora_kitchen', bio: { ko: '외계 식재료로 집밥 만들기 🍳 배급 시절 레시피도 있어요', en: 'home cooking with alien ingredients 🍳 ration-era recipes too' }, catch: { ko: '오늘의 한 접시!', en: "today's plate!" } },
  { id: 'nev', field: 'fitness', ethic: 'militarist', followers: 228000, name: { ko: '네브', en: 'Nev' }, handle: 'nevfit', bio: { ko: '전직 함대 해병대. 저중력 홈트 알려드림 💪', en: 'ex-fleet marine. low-g home workouts 💪' }, catch: { ko: '중력은 핑계일 뿐 💪', en: 'gravity is just an excuse 💪' } },
  { id: 'mio', field: 'pets', ethic: 'egalitarian', followers: 561000, name: { ko: '미오와 꼬물이', en: 'Mio & Squish' }, handle: 'mio_n_squish', bio: { ko: '외계 생물 꼬물이랑 사는 일상 🫧 꼬물이는 3살', en: 'life with my alien critter Squish 🫧 Squish is 3' }, catch: { ko: '꼬물이 오늘도 귀여움 주의', en: 'squish cuteness alert' } },
  { id: 'adele', field: 'fashion', ethic: 'authoritarian', followers: 402000, name: { ko: '아델 본', en: 'Adele Vonn' }, handle: 'adele_style', bio: { ko: '상류층 패션 큐레이터 👗 궁정 행사 코디 전문', en: 'high-society style curator 👗 court-event looks' }, catch: { ko: '오늘의 코디는?', en: 'fit check?' } },
];

// ── 경기 단계(호황~공황, LLM 없음) ──
export type Econ = 'boom' | 'normal' | 'slow' | 'recession' | 'depression';
export interface IncomeLike { energy?: number; food?: number; consumer_goods?: number; minerals?: number; alloys?: number }
/** 월 수입(적자 수)과 민심으로 정한 "이번 달 점수"를 최근 몇 달 이어 보고 단계를 정한다(몇 달 연속일 때만 바뀜). */
export function econScore(inc: IncomeLike | null | undefined, mood: number | null): number {
  let s = 0;
  if (inc) { for (const k of ['energy', 'food', 'consumer_goods'] as const) { const v = inc[k]; if (typeof v === 'number') s += v < 0 ? -2 : v > 30 ? 1 : 0; } }
  if (mood !== null) s += mood >= 70 ? 1 : mood < 35 ? -2 : mood < 45 ? -1 : 0;
  return s;
}
export function econStage(history: number[]): Econ {
  const h = history.slice(-3); if (!h.length) return 'normal';
  const avg = h.reduce((a, b) => a + b, 0) / h.length, all = (f: (x: number) => boolean) => h.length >= 2 && h.every(f);
  if (all((x) => x <= -5)) return 'depression'; if (all((x) => x <= -3)) return 'recession'; if (avg <= -1.5) return 'slow'; if (all((x) => x >= 2)) return 'boom'; return 'normal';
}

// ── 글 ──
export interface Comment { name: string; ip?: string; text: string; up: number; mine?: boolean; replies?: Comment[] }
export interface Post {
  id: string; site: Site; date: string; topic: string; stance: Stance; seed: number;
  by: { kind: 'cit' | 'one' | 'inf' | 'child' | 'me'; id?: string; name: string; handle?: string; off?: boolean; ip?: string };
  title?: string; body: string; head?: string; tags?: string[]; photo?: { n: number; desc: string }; promo?: { planet: string; img: string };
  likes: number; shares: number; views: number; ccount: number; star?: boolean; comments?: Comment[]; opened?: boolean; mine?: boolean; ethicTag?: string; ai?: boolean; ama?: boolean;
}
export interface World {
  lang: Lang; empire: string; ruler: string; date: string; mood: number | null; econ: Econ; atWar: string[]; planets: string[]; unrest: string[];
  events: string[]; founder: string; minority: string; rivals: string[]; nodes: string[];
}

// ── 문구 묶음(한/영). {e}=제국 {r}=통치자 {p}=행성 {u}=불안 행성 {w}=전쟁 상대 {x}=다른 종족 계열 {v}=경쟁국 {ev}=소식 ──
type T = { ko: string[]; en: string[] };
const B: Record<string, T> = {
  // 트윙클: 짧고 감성적(여성 사용자 많음)
  'tw.war.pro': { ko: ['{w}랑 전쟁이라니 무섭긴 한데ㅠㅠ 우리 함대 믿어요♡ 다들 조심해요', '오늘 출정식 영상 봤는데 울컥했어요ㅠㅠ 다 무사히 돌아오길🙏', '{w} 이번엔 진짜 끝내자!! 우리 군인분들 너무 멋있어요'], en: ["war with {w} is scary but i trust our fleet ♡ stay safe everyone", 'watched the send-off stream and literally teared up 😭 come home safe 🙏', 'end it this time with {w}!! our soldiers are so brave'] },
  'tw.war.con': { ko: ['또 전쟁이에요..? 동생 징집될까봐 너무 불안해요ㅠㅠ', '{w}랑 싸우는 거 진짜 필요한 걸까요.. 그냥 다들 무사했으면', '전쟁 뉴스 그만 보고 싶다ㅠㅠ 오늘은 그냥 따뜻한 차 마실래요'], en: ['another war..? so scared my little brother gets drafted 😭', 'do we really need to fight {w}.. i just want everyone safe', 'i cannot watch more war news 😭 tea and blankets tonight'] },
  'tw.econ.bad': { ko: ['장 보러 갔다가 가격 보고 그냥 나왔어요ㅠㅠ 물가 미쳤다', '이번 달 월급으로 버틸 수 있을까.. 다들 어떻게 버텨요?ㅠ', '{p} 마트 진열대 반은 비어 있더라구요.. 헐'], en: ['went grocery shopping and just walked out at the prices 😭', 'will this paycheck even last.. how are you all coping?', 'half the shelves at the {p} market were empty.. omg'] },
  'tw.econ.good': { ko: ['요즘 경기 좋아서 그런가 다들 표정이 밝아요♡', '보너스 나와서 언니랑 {p} 여행 예약했어요!! 너무 신나', '신상 나온 거 다 사고 싶다ㅎㅎ 지갑 열리는 중'], en: ['economy is good lately and everyone looks so happy ♡', "bonus came in so i booked a {p} trip with my sister!! so excited", 'i want everything new this season lol wallet is open'] },
  'tw.mood.good': { ko: ['요즘 {e} 분위기 너무 좋지 않아요?♡', '오늘 하늘 보면서 이 나라 살아서 다행이다 싶었어요', '{r} 님 요즘 잘하시는 것 같아요ㅎㅎ'], en: ['the vibe in {e} lately is so good right?? ♡', 'looked at the sky today and felt lucky to live here', '{r} is doing great lately ngl'] },
  'tw.mood.bad': { ko: ['다들 요즘 지쳐 보여요.. 서로 다정하게 대해줘요ㅠㅠ', '{u} 소식 들으면 마음이 너무 아파요', '요즘 뉴스 보면 한숨만 나와요..'], en: ['everyone seems so tired lately.. be kind to each other 😢', 'hearing about {u} breaks my heart', 'every news story lately is just sigh..'] },
  'tw.event.pro': { ko: ['「{ev}」 소식 봤어요?? 완전 좋은 일이에요♡', '헐 「{ev}」 이거 진짜예요? 너무 좋다ㅠㅠ'], en: ['did you see "{ev}"?? such good news ♡', 'omg "{ev}" is this real? love it 😭'] },
  'tw.event.con': { ko: ['「{ev}」.. 이거 괜찮은 거 맞아요?ㅠ', '「{ev}」 소식 보고 좀 불안해졌어요..'], en: ['"{ev}".. is this actually okay? 😟', 'seeing "{ev}" made me kinda anxious..'] },
  'tw.daily': { ko: ['퇴근길에 본 노을이 너무 예뻤어요♡', '오늘 {p} 날씨 완전 좋아요! 산책 가실 분?', '새로 생긴 카페 라떼 맛집이에요ㅎㅎ', '주말엔 그냥 집에서 홀로드라마 정주행할래요', '친구랑 저중력 요가 처음 해봤는데 너무 웃겼어요ㅋㅋ'], en: ['the sunset on my way home was so pretty ♡', 'weather in {p} is perfect today! walk anyone?', 'the new café has the best latte lol', 'weekend plan: binge holodramas at home', 'tried low-g yoga with a friend and could not stop laughing lol'] },
  // DS인사이드: 제목 + 짧은 본문, 거칠고 드립
  'ds.war.pro': { ko: ['{w} 이번에 확실히 밟아야 함|함대 규모 보면 우리가 이김\nㅇㅈ?', '출정식 국뽕 차오른다|이번엔 진짜 간다'], en: ['we have to crush {w} this time|look at fleet size we win\nagree?', 'send-off stream got me hyped|this is it'] },
  'ds.war.con': { ko: ['전쟁 언제 끝나냐 진짜|조선소 다니는데 3주째 집에 못 감\nㅋㅋ', '{w}랑 싸워서 얻는 게 뭐임?|세금만 오름'], en: ['when does this war end fr|shipyard worker, home 0 days in 3 weeks\nlol', 'what do we even get from fighting {w}?|just higher taxes'] },
  'ds.econ.bad': { ko: ['물가 실화냐|소비재 값 두 배 됨\n월급은 그대로\nㅋㅋㅋ', '{p} 일자리 다 사라짐|구인 공고가 없다'], en: ['these prices are insane|consumer goods doubled\npay the same\nlmao', 'jobs in {p} are gone|zero listings'] },
  'ds.econ.good': { ko: ['요즘 돈 좀 도는 듯|보너스 받은 사람 ㅇㅇ?', '경기 좋을 때 링월드 분양 넣어봄|떨어질 듯 ㅋㅋ'], en: ['money seems to be flowing lately|anyone got a bonus?', 'applied for ringworld housing while times are good|gonna lose lol'] },
  'ds.mood.good': { ko: ['요즘 나라 분위기 괜찮지 않냐|딱히 불만 없음', '{r} 요즘 일 좀 하네|인정할 건 인정함'], en: ['country vibe is decent lately ngl|no complaints', '{r} actually doing work lately|credit where due'] },
  'ds.mood.bad': { ko: ['요즘 다들 화나 있음|어딜 가도 불평뿐', '{u} 시위 현장 다녀옴|생각보다 큼\n언론은 왜 조용하냐'], en: ['everyone is angry lately|complaints everywhere', 'went to the {u} protest|bigger than you think\nwhy is media silent'] },
  'ds.event.pro': { ko: ['「{ev}」 이거 잘한 거 맞지?|개념 행보임', '「{ev}」 떴다|ㅊㅊ'], en: ['"{ev}" good move right?|based', '"{ev}" just dropped|upvote'] },
  'ds.event.con': { ko: ['「{ev}」 이거 실화냐|누가 결재한 거임', '「{ev}」 보고 혈압 오름|하..'], en: ['"{ev}" is this real|who signed off on this', '"{ev}" raised my blood pressure|sigh..'] },
  'ds.daily': { ko: ['외계 요리 잘하는 집 추천 좀|{p} 북부 기준', '오늘 퇴근하고 뭐 먹냐|추천 받음', '함대 갤럭시 놈들 또 싸우네|ㅋㅋ', '홀로드라마 결말 실화냐|작가 나와'], en: ['good alien food spots?|north {p}', 'what are you eating after work|taking recs', 'fleet galaxy guys fighting again|lol', 'that holodrama ending is a crime|writer explain'] },
  // 레드시프트: 분석글 제목|미리보기|본문
  'rs.war.pro': { ko: ['{w}와의 전쟁, 지금이 적기인 이유|국경 상황과 함대 규모를 보면 늦출수록 불리합니다.|지금 물러서면 다음 세대가 더 큰 값을 치릅니다.'], en: ['Why now is the right time for war with {w}|Border and fleet numbers say delay only hurts us.|Backing down now means the next generation pays more.'] },
  'rs.war.con': { ko: ['{w}와의 전쟁, 정말 필요한가?|전쟁 피로와 생산 손실을 따져 봐야 합니다.|외교 비용이 함선 한 척 유지비보다 쌉니다. 조약을 먼저 시도해야 합니다.'], en: ['Is the war with {w} really necessary?|We should weigh war weariness and lost output.|Diplomacy costs less than one ship\'s upkeep. Try a treaty first.'] },
  'rs.econ.bad': { ko: ['{e} 경기 둔화, 원인 정리|소비재와 식량 수지가 동시에 나빠졌습니다.|단기 처방보다 생산 구조를 손봐야 합니다. 여러분 생각은?'], en: ['{e} slowdown: what is causing it|Consumer goods and food balances turned negative together.|Fix the production base rather than quick patches. Thoughts?'] },
  'rs.econ.good': { ko: ['요즘 {e} 호황, 얼마나 갈까?|수입이 늘었지만 과열 신호도 보입니다.|지금이 거대 구조물에 투자할 때라는 의견에 동의하시나요?'], en: ['{e} boom: how long will it last?|Income is up, but there are signs of overheating.|Do you agree now is the time to invest in megastructures?'] },
  'rs.mood.good': { ko: ['{r} 정부 지지율이 오르는 이유|안정도와 파벌 승인도가 함께 올랐습니다.|하지만 비판 없는 정치는 위험합니다. 반대 의견도 듣고 싶네요.'], en: ['Why support for {r} is rising|Stability and faction approval rose together.|Still, politics without criticism is risky. I want to hear the other side.'] },
  'rs.mood.bad': { ko: ['{u} 시위, 무엇을 요구하나|현장에 있었습니다. 요구는 생각보다 단순합니다.|정부가 대표단과 대화하길 바랍니다.'], en: ['{u} protests: what do they want|I was there. The demands are simpler than reported.|Hope the government talks to the delegation.'] },
  'rs.event.pro': { ko: ['「{ev}」: 장기적으로 이득인 이유|단기 비용보다 얻는 것이 큽니다.|근거를 정리해 봤습니다. 반박 환영합니다.'], en: ['"{ev}": why it pays off long term|The gains outweigh the short-term cost.|I laid out the reasoning. Rebuttals welcome.'] },
  'rs.event.con': { ko: ['「{ev}」에 대한 비판적 검토|절차와 비용 면에서 문제가 있습니다.|누가 이 결정으로 손해를 보는지 따져 봐야 합니다.'], en: ['A critical look at "{ev}"|There are problems with process and cost.|We should ask who loses from this decision.'] },
  'rs.daily': { ko: ['{p}에서 살아 본 1년 후기|생활비·일자리·분위기를 정리했습니다.|이주를 고민하는 분들께 도움이 되길.', '은하 역사상 가장 과소평가된 사건은?|교과서에는 한 줄로 나오지만 중요했던 일들.|각자 하나씩 말해 봅시다.'], en: ['One year living on {p}: a review|Cost of living, jobs and vibe summarized.|Hope it helps anyone thinking of moving.', 'Most underrated event in galactic history?|Things that get one line in textbooks but mattered.|Name one each.'] },
};
// 성향 의견글(사건 없이 자기 신념). 사이트별 한 줄/제목|본문
const IDEO: Record<string, T> = {
  xenophobe: { ko: ['요즘 {p}에 {x} 이주민이 너무 많아진 것 같아요.. 저만 그렇게 느끼나요?|{x} 이주민 또 늘었다는데 본토 일자리는 어쩌냐|국경 관리를 강화해야 하는 이유|이주 속도가 너무 빠르면 통합이 따라가지 못합니다.'], en: ["is it just me or are there way too many {x} settlers on {p} now..|more {x} immigrants again, what about homeworld jobs|Why we need stricter border control|If migration moves too fast, integration cannot keep up."] },
  xenophile: { ko: ['{x} 친구가 만들어 준 요리 너무 맛있었어요♡ 다양성 최고|{x} 없으면 조선소 안 돌아감 ㄹㅇ|{x} 이주민이 {e} 경제에 한 일 정리|숫자부터 봤으면 합니다. 혐오 글보다 데이터가 먼저입니다.'], en: ['my {x} friend cooked for me and it was amazing ♡ diversity wins|shipyard would not run without {x} fr|What {x} immigrants did for the {e} economy|Look at the numbers first. Data before hostility.'] },
  militarist: { ko: ['함대 퍼레이드 보고 왔는데 진짜 멋있었어요♡ {v} 쪽에서 좀 쫄았으면ㅎㅎ|함대 더 늘려야 함 {v} 보면 모르냐|함대 증강이 평화를 지키는 방법|약해 보이는 순간 {v}가 움직입니다.'], en: ['went to the fleet parade and it was sooo cool ♡ hope {v} noticed lol|we need more ships, look at {v}|A stronger fleet is how we keep the peace|The moment we look weak, {v} moves.'] },
  pacifist: { ko: ['전쟁 얘기 그만했으면.. 평화 공원 산책하니 마음이 편해요|군비에 쓸 돈으로 학교나 지어라|{v}와 불가침 조약이 함대 증강보다 싸다|함선 한 척 유지비로 10년치 외교 비용이 나옵니다.'], en: ['can we stop talking about war.. walked the peace park and felt better|spend the military budget on schools|A non-aggression pact with {v} is cheaper than a buildup|One ship\'s upkeep covers ten years of diplomacy.'] },
  authoritarian: { ko: ['시위 때문에 전철 또 멈췄대요.. 질서 좀 지켜줬으면|강한 지도자가 있어야 나라가 산다|질서가 먼저인 이유|혼란 속에서는 아무도 자유롭지 않습니다.'], en: ['rail stopped again because of protests.. can we keep some order|a nation needs a strong leader|Why order comes first|No one is free in chaos.'] },
  egalitarian: { ko: ['투표 꼭 해요 다들!! 우리 목소리가 중요해요♡|언론 자유 건드리면 가만 안 있음|시민 권리, 어디까지 왔나|선거와 언론 자유는 타협할 수 없는 기본입니다.'], en: ['everyone go vote!! our voices matter ♡|touch press freedom and we riot (peacefully)|Where citizen rights stand today|Elections and a free press are non-negotiable basics.'] },
  spiritualist: { ko: ['오늘 사원에서 기도하고 왔어요. 마음이 맑아져요🙏|기도로 함선 고쳤다는 사람 봄 ㄹㅇ|신앙이 사회에 주는 것|과학으로 설명되지 않는 위안이 있습니다.'], en: ['prayed at the temple today. my mind feels clear 🙏|saw a guy fix a ship by praying fr|What faith gives a society|There is comfort science cannot explain.'] },
  materialist: { ko: ['새 연구소 견학 다녀왔어요! 과학 최고✨|기도로 엔진 고친다는 사람들 실화냐|미신보다 연구 예산을|증명된 것에 투자해야 합니다.'], en: ['visited the new research lab! science rules ✨|people think prayer fixes engines lmao|Fund research, not superstition|Invest in what is proven.'] },
};
// 댓글 묶음(사이트×입장)
const C: Record<string, T> = {
  'tw.agree': { ko: ['헐 완전 공감이에요ㅠㅠ', 'ㅠㅠ 인정이요', '저도요!! 힘내요 우리♡', '이거 맞아요ㅎㅎ', '너무 좋다♡', '언니 말이 다 맞아요ㅠ', '저장 완료♡ 진짜 공감', '이 글 보고 위로받았어요', '저만 그런 게 아니었구나ㅠㅠ', '오늘 본 글 중 최고예요✨', '알티합니다!!', '맞아요 맞아요ㅠㅠ'], en: ['omg so relatable 😭', 'literally', 'same!! we got this ♡', 'this is so true lol', 'love this ♡', 'you are so right', 'saved ♡ so real', 'this made me feel better', 'glad it is not just me 😭', 'best post today ✨', 'reposting!!', 'yes yes yes'] },
  'tw.disagree': { ko: ['음 저는 좀 생각이 달라요..', '그건 좀 아닌 것 같아요ㅠ', '이런 글 좀 그만 봤으면', '너무 한쪽만 보는 것 같아요', '조금 무서운 말 같아요..', '다른 사람 입장도 생각해 줘요ㅠ', '저는 반대예요 솔직히', '이건 좀 오바 아닌가요?'], en: ['hmm i kinda disagree..', "that's not really fair 😟", 'can we not do this again', 'feels a bit one-sided tbh', 'that sounds kinda scary..', 'think about other people too', 'honestly i disagree', 'isnt this a bit much?'] },
  'tw.neu': { ko: ['사진 더 올려주세요!!', '오 처음 알았어요', '저장해 둘게요♡', 'ㅋㅋㅋ 귀여워', '어디예요?? 알려주세요', '오늘 날씨랑 딱이네요', '저도 가보고 싶다', '팔로우했어요♡'], en: ['post more pics!!', 'oh i did not know that', 'saving this ♡', 'lol cute', 'where is this?? tell me', 'perfect for today', 'i want to go too', 'followed ♡'] },
  'ds.agree': { ko: ['ㄹㅇ', 'ㅇㅈ', '이건 개념성 가야 함', '팩트임', 'ㅋㅋ 이거지', '추천 박고 감', '오랜만에 맞는 말', '이게 맞다', '나도 이 생각함', '정답 ㅇㅇ', '고닉 각', '빠르게 인정'], en: ['fr', 'agree', 'this belongs in the hall of stars', 'facts', 'lol this', 'upvoted', 'finally someone said it', 'based', 'thought the same', 'correct', 'top post material', 'instantly agree'] },
  'ds.disagree': { ko: ['또 이 얘기냐', '선동 ㄴ', '반대로 생각하는 사람도 있음', '뇌피셜 ㄴㄴ', '출처 가져와', '어그로 ㄴ', '이건 아니지', '현실을 모르네', '정신 차려라', '응 아니야'], en: ['this again?', 'propaganda', 'some of us disagree', 'source: your head', 'sources?', 'bait', 'nah', 'touch grass', 'wake up', 'no'] },
  'ds.neu': { ko: ['ㅋㅋㅋ', '그래서 결론이 뭐임', '난 그냥 구경', '나도 궁금', '세줄요약 좀', '퇴근하고 싶다', '이 글 왜 개념글임?', '팝콘 챙겨옴'], en: ['lol', 'so what is the point', 'just watching', 'same question', 'tldr?', 'i want to go home', 'how is this a top post?', 'grabbing popcorn'] },
  'rs.agree': { ko: ['정리 좋네요. 동의합니다.', '근거가 탄탄합니다.', '이 관점은 처음 봤는데 설득력 있네요.', '현장에 있던 사람으로서 맞는 말입니다.', '좋은 글 감사합니다. 저장했습니다.', '수치까지 보니 납득됩니다.', '이런 토론이 더 많아야 합니다.'], en: ['Great summary. Agreed.', 'Solid reasoning.', 'Never saw it this way, but convincing.', 'I was there. This is accurate.', 'Thanks for writing this. Saved.', 'The numbers make it convincing.', 'We need more threads like this.'] },
  'rs.disagree': { ko: ['출처가 있나요?', '반대 측 비용은 빠져 있네요.', '그럼 반대로 가면 무엇을 잃죠?', '표본이 너무 작습니다.', '감정적인 주장 같네요.', '역사적으로는 반대 사례가 많습니다.', '전제부터 틀렸다고 봅니다.'], en: ['Sources?', 'You left out the costs on the other side.', 'So what do we lose going the other way?', 'Sample size is too small.', 'This reads as emotional.', 'History has plenty of counterexamples.', 'The premise is wrong.'] },
  'rs.neu': { ko: ['흥미로운 토론이네요.', '양쪽 다 일리가 있습니다.', '추가 자료가 있으면 좋겠어요.', '댓글이 본문보다 유익하네요.', '이 스레드 저장합니다.', '중재자로서 한마디: 서로 예의를 지켜 주세요.'], en: ['Interesting discussion.', 'Both sides have a point.', 'More data would help.', 'Comments better than the post.', 'Saving this thread.', 'Mod note: keep it civil, please.'] },
};
// 글 주제에 맞춘 댓글(2026-10-28 실플레이 피드백: 「댓글이 다 예시 같다」 — 주제와 상관없는 반응만 나오던 문제).
// 방향 짝(pro/anti 등)마다 반말(트윙클·DS)과 존댓말(레드시프트) 줄. 글의 방향에 동의하면 같은 쪽, 반대하면 반대쪽 줄을 쓴다.
type Reg = { c: string[]; f: string[] };
const TC: Record<string, { ko: Reg; en: Reg }> = {
  'war.pro': { ko: { c: ['{w} 이번엔 확실히 눌러야 함', '우리 함대 믿는다 진짜', '전선 소식 볼 때마다 든든해', '{w} 쪽이 먼저 건드렸잖아'], f: ['지금 물러서면 {w}에게 다음 기회를 주는 겁니다.', '보급만 버텨 주면 승산은 충분하다고 봅니다.', '전쟁 목표가 분명하다면 지지합니다.'] }, en: { c: ['we need to finish {w} this time', 'i trust our fleet fr', 'every front report makes me proud', '{w} started it tho'], f: ['Backing down now just gives {w} another shot later.', 'If logistics hold, we have the edge.', 'With clear war goals, I support this.'] } },
  'war.anti': { ko: { c: ['그만 싸우고 협상하자 제발', '{w}랑 전쟁 언제 끝나', '배급 줄어든 거 체감됨..', '아는 집 아들도 전선 갔대'], f: ['전쟁 비용을 생각하면 협상이 낫습니다.', '{w}와의 전쟁으로 얻는 게 무엇인지 설명이 필요합니다.', '전선 사상자 통계부터 공개해야 합니다.'] }, en: { c: ['can we just negotiate already', 'when does the {w} war end', 'the rations are getting smaller..', 'my neighbor\'s son got sent to the front'], f: ['Given the costs, talks make more sense.', 'Someone should explain what we gain from fighting {w}.', 'Publish the casualty figures first.'] } },
  'econ.good': { ko: { c: ['요즘 월급 좀 올랐어', '{p} 시장 장사 잘 되더라', '새 상점가 생긴 거 봄?', '이번 달은 좀 숨통 트인다'], f: ['수입 지표가 좋아진 건 사실입니다.', '이 흐름이 이어지려면 투자가 계속돼야 합니다.', '호황일 때 비축해 둬야 합니다.'] }, en: { c: ['got a small raise lately', 'the {p} market is booming', 'did you see the new arcade?', 'finally some breathing room this month'], f: ['The income numbers really have improved.', 'Investment has to keep up for this to last.', 'Save while times are good.'] } },
  'econ.bad': { ko: { c: ['장보기 무서워 요즘', '물가 또 올랐더라', '우리 동네 가게 또 닫음', '정전 또 됨.. 에너지 어디 감'], f: ['소비재 수급부터 손봐야 합니다.', '서민 지원책이 필요하다고 봅니다.', '적자 원인을 따져 봐야 합니다.'] }, en: { c: ['groceries are scary rn', 'prices went up again', 'another shop closed on my street', 'blackout again.. where is the energy going'], f: ['Consumer goods supply needs fixing first.', 'We need relief for ordinary people.', 'Someone should trace where the deficit comes from.'] } },
  'mood.good': { ko: { c: ['요즘 분위기 괜찮은 듯', '{r} 잘하고 있다고 봄', '오랜만에 다들 웃는 얼굴'], f: ['전반적으로 안정된 시기라고 봅니다.', '정부 운영이 무난하다는 데 동의합니다.', '이럴 때 개혁을 밀어붙여야 합니다.'] }, en: { c: ['the vibe is good lately', 'i think {r} is doing fine', 'everyone is smiling again'], f: ['This feels like a stable period overall.', 'Agreed, the government is doing reasonably.', 'This is the moment to push reforms.'] } },
  'mood.bad': { ko: { c: ['{u} 소식 들었어? 분위기 안 좋더라', '다들 지쳐 보여', '{r}은 우리 얘기 듣고는 있나'], f: ['불만이 쌓이는 원인을 봐야 합니다.', '{u}의 상황은 일시적인 문제가 아닙니다.', '민심을 가볍게 보면 안 됩니다.'] }, en: { c: ['heard about {u}? things look bad', 'everyone seems exhausted', 'is {r} even listening to us'], f: ['We need to look at why the frustration keeps building.', 'What is happening on {u} is not a one-off.', 'Public mood should not be taken lightly.'] } },
  'event.pro': { ko: { c: ['이번 결정은 잘했다', '{e} 이번엔 제대로 했네', '소식 듣고 좀 안심됨'], f: ['이번 조치는 시의적절했다고 봅니다.', '결정 과정이 투명했다면 더 좋았겠지만 방향은 맞습니다.', '장기적으로 이득이 될 결정입니다.'] }, en: { c: ['good call this time', '{e} actually got it right', 'felt relieved hearing that'], f: ['This was well timed.', 'More transparency would help, but the direction is right.', 'This will pay off long term.'] } },
  'event.con': { ko: { c: ['이건 좀 아니지 않음?', '위에서 또 멋대로 정했네', '이게 우리한테 뭐가 좋은데'], f: ['결정의 근거가 공개되지 않았습니다.', '비용이 누구에게 돌아가는지 따져 봐야 합니다.', '이번 결정에는 동의하기 어렵습니다.'] }, en: { c: ['is this really ok?', 'decided over our heads again', 'how does this help us exactly'], f: ['The reasoning behind this was never published.', 'We should ask who ends up paying for it.', 'Hard to agree with this one.'] } },
  'ideo.pro': { ko: { c: ['이런 생각하는 사람 많아져야 함', '이게 우리 제국다운 거지', '말 시원하게 잘했다'], f: ['우리 제국의 근본 가치와 맞는 주장입니다.', '논리적으로 납득됩니다.', '이 관점이 더 알려졌으면 합니다.'] }, en: { c: ['we need more people thinking like this', 'this is what our empire is about', 'said it perfectly'], f: ['This fits the core values of our empire.', 'The argument holds up.', 'I wish this view were more widely heard.'] } },
  'ideo.anti': { ko: { c: ['그 생각이 제국 망치는 거임', '너무 극단적인데', '반대 쪽 얘기도 들어 봐'], f: ['전제부터 동의하기 어렵습니다.', '그 주장대로라면 소수가 피해를 봅니다.', '역사를 보면 그 방향은 위험했습니다.'] }, en: { c: ['that mindset is ruining the empire', 'that is way too extreme', 'listen to the other side for once'], f: ['I cannot accept the premise.', 'Following this, minorities pay the price.', 'History says that road is dangerous.'] } },
  'daily.pro': { ko: { c: ['오 나도 해 보고 싶다', '어디서 했어? 알려줘', '부럽다 진짜', '{p}에도 그런 데 있음?'], f: ['좋은 경험 공유 감사합니다.', '저도 비슷한 경험이 있어 공감됩니다.', '자세한 정보 부탁드려요.'] }, en: { c: ['oh i want to try that', 'where was this? tell me', 'so jealous', 'is there one on {p}?'], f: ['Thanks for sharing.', 'I had a similar experience; relatable.', 'Could you share more details?'] } },
  'daily.anti': { ko: { c: ['나 해봤는데 별로던데', '돈 아깝지 않음?', '그거 요즘 다 하는 거잖아'], f: ['제 경험은 좀 달랐습니다.', '비용 대비 효과는 의문입니다.', '모두에게 맞는 방법은 아닌 것 같습니다.'] }, en: { c: ['tried it, kinda meh', 'isnt that a waste of credits?', 'everyone does that now'], f: ['My experience was different.', 'Not sure it is worth the cost.', 'Probably not for everyone.'] } },
  'inf.pro': { ko: { c: ['사진만 봐도 힐링♡', '{p} 꼭 가볼래요', '오늘도 최고예요✨'], f: ['좋은 정보 감사합니다.', '추천해 주신 곳 가 봤는데 좋았습니다.', '꾸준한 글 잘 보고 있습니다.'] }, en: { c: ['healing just looking at this ♡', 'adding {p} to my list', 'iconic as always ✨'], f: ['Thanks for the tips.', 'Went to the place you recommended. Loved it.', 'Always enjoy your posts.'] } },
  'inf.anti': { ko: { c: ['이거 광고 아님?', '현실은 저렇지 않던데', '협찬 티 너무 난다'], f: ['협찬 여부를 밝혀 주셨으면 합니다.', '실제와는 차이가 있습니다.', '홍보성 글이 많아진 것 같네요.'] }, en: { c: ['isnt this an ad?', 'reality looks nothing like this', 'the sponsorship is so obvious'], f: ['Please disclose sponsorships.', 'This does not match reality.', 'Feels like a lot of promo lately.'] } },
};
/** 글의 주제·방향 → [동의할 때 쓸 묶음, 반대할 때 쓸 묶음]. 없으면 null(일반 반응만). */
function topicPair(p: Post, w: World): [string, string] | null {
  const sw = (a: string, b: string, flip: boolean): [string, string] => (flip ? [b, a] : [a, b]);
  switch (p.topic) {
    case 'war': return sw('war.pro', 'war.anti', p.stance === 'con');
    case 'econ': return sw('econ.good', 'econ.bad', w.econ !== 'boom');
    case 'mood': return sw('mood.good', 'mood.bad', p.stance === 'con' || (w.mood ?? 50) < 40);
    case 'event': return sw('event.pro', 'event.con', p.stance === 'con');
    case 'ideo': return ['ideo.pro', 'ideo.anti'];
    case 'daily': return ['daily.pro', 'daily.anti'];
    case 'inf': case 'promo': return ['inf.pro', 'inf.anti'];
    default: return null;
  }
}
/** 주제 댓글 한 줄(반말/존댓말은 사이트 따라). 없으면 ''. */
function topicLine(p: Post, w: World, agree: boolean, r: () => number): string {
  const pair = topicPair(p, w); if (!pair) return '';
  const set = TC[agree ? pair[0] : pair[1]]; if (!set) return '';
  return fill(pickOf(r, set[w.lang][p.site === 'rs' ? 'f' : 'c']), w, r);
}
const INFP: Record<InfField, T> = {
  travel: { ko: ['{p} 항구 카페 창가 자리 찾았어요☕ 여기 살고 싶다 진짜|창가 너머 {p} 풍경과 김 오르는 커피', '{p} 전망대 올라갔는데 하늘이 두 개 같았어요✨|{p} 대표 풍경 전망'], en: ['found the window seat at a {p} harbor café ☕ i literally want to live here|{p} skyline behind a steaming coffee', 'went up the {p} observatory and it felt like two skies ✨|wide view over {p}'] },
  food: { ko: ['오늘 저녁은 시장에서 산 낯선 뿌리채소 수프🍲|도마 위 보라색 뿌리채소', '배급 식재료로 만든 오늘의 볶음밥🍳 생각보다 고소해요|붉은 이끼 볶음밥 한 접시'], en: ['tonight: soup from a strange root veggie i bought at the market 🍲|purple roots on a cutting board', 'ration-ingredient fried rice 🍳 way nuttier than you would think|a plate of red-moss fried rice'] },
  fitness: { ko: ['궤도 정거장 0.4G에서 스쿼트 100개 챌린지💪 같이 하실 분?|정거장 창 앞 운동 매트', '오늘은 달리기 10km 완주! 다들 물 많이 드세요|운동 끝난 신발과 물병'], en: ['100-squat challenge at 0.4G on the station 💪 who is in?|workout mat by the station window', '10 km done today! hydrate everyone|post-run shoes and a water bottle'] },
  pets: { ko: ['꼬물이가 창가에서 낮잠 자요ㅠㅠ|햇빛 속에서 동그랗게 만 꼬물이', '꼬물이가 새 장난감을 무서워해요ㅠㅠ 아직 적응 중|장난감 옆에 숨은 꼬물이'], en: ['squish napping by the window 😭|Squish curled up in a sunbeam', 'squish is scared of the new toy 😭 still adjusting|Squish hiding next to a toy'] },
  fashion: { ko: ['이번 시즌 궁정 코디 정리했어요👗 금색 포인트 필수!|금색 장식이 들어간 정장 네 벌', '비 오는 날 코디✨ 반투명 망토 강추|반투명 망토를 걸친 마네킹'], en: ['court looks for this season 👗 gold accents are a must!|four outfits with gold accents', 'rainy day fit ✨ translucent capes are in|a mannequin in a translucent cape'] },
};
// 일상 글 조합(틀 × 소재 × 느낌 — 수백 가지, 같은 문장이 자주 반복되지 않게)
const DT: Record<Site, { ko: { t: string[]; thing: string[]; feel: string[] }; en: { t: string[]; thing: string[]; feel: string[] } }> = {
  tw: {
    ko: { t: ['오늘 {th} 했는데 {fe}', '{th} 하고 왔어요ㅎㅎ {fe}', '요즘 {th}에 빠졌어요.. {fe}', '드디어 {th}!! {fe}', '{th} 같이 할 사람~? {fe}'],
      thing: ['저중력 요가', '{p} 야시장 구경', '홀로드라마 정주행', '새 카페 투어', '궤도 엘리베이터 야경 보기', '외계 식물 키우기', '친구랑 노래방', '수경 농장 체험', '네일 새로 하기', '중고 우주복 쇼핑', '별자리 사진 찍기', '빵 굽기', '고양이 카페', '{p} 해변 산책', '새 향수 고르기'],
      feel: ['너무 행복해요♡', '완전 힐링이에요ㅠㅠ', '생각보다 별로였어요ㅋㅋ', '다음에 또 갈래요!', '사진 올릴게요✨', '지갑은 울고 있어요..', '하루가 순삭됐어요', '이게 행복이지♡'] },
    en: { t: ['did {th} today and {fe}', 'just got back from {th} {fe}', 'obsessed with {th} lately.. {fe}', 'finally {th}!! {fe}', 'anyone up for {th}? {fe}'],
      thing: ['low-g yoga', 'the {p} night market', 'a holodrama binge', 'a café crawl', 'watching the space-elevator lights', 'growing alien houseplants', 'karaoke with friends', 'a hydro-farm tour', 'new nails', 'thrifting old spacesuits', 'stargazing photos', 'baking bread', 'the cat café', 'a walk on the {p} beach', 'picking a new perfume'],
      feel: ['so happy ♡', 'literally healing 😭', 'kinda overrated lol', 'going again for sure!', 'pics soon ✨', 'my wallet is crying..', 'the day just vanished', 'this is happiness ♡'] },
  },
  ds: {
    ko: { t: ['{th} 해본 놈 있냐|{fe}', '오늘 {th} 함|{fe}', '{th} 이거 왜 함?|{fe}', '{th} 후기|{fe}'],
      thing: ['저중력 축구', '{p} 야시장', '외계 요리 배달', '홀로드라마 몰아보기', '함선 모형 조립', '조선소 야간 알바', '중고 호버바이크 구입', '광산 행성 출장', '사이보그 팔 수리', '수경 농장 견학', '구독형 산소 요금제'],
      feel: ['생각보다 개꿀임', '돈 아까움 ㅋㅋ', '다신 안 함', '추천함', '그냥 그럼', '3줄 요약 불가'] },
    en: { t: ['anyone tried {th}?|{fe}', 'did {th} today|{fe}', 'why does anyone do {th}?|{fe}', '{th} review|{fe}'],
      thing: ['low-g soccer', 'the {p} night market', 'alien food delivery', 'a holodrama binge', 'building ship models', 'night shifts at the shipyard', 'buying a used hoverbike', 'a mining-world business trip', 'fixing a cyborg arm', 'a hydro-farm tour', 'a subscription oxygen plan'],
      feel: ['way better than expected', 'waste of credits lol', 'never again', 'recommend', 'mid', 'cannot summarize'] },
  },
  rs: {
    ko: { t: ['{th}: 제 경험을 공유합니다|{fe}', '{th}, 어떻게 생각하세요?|{fe}'],
      thing: ['{p} 이주 후 첫해', '저중력 육아', '궤도 정거장 출퇴근', '수경 농장 창업', '함대 퇴역 후 재취업', '외계 언어 배우기', '원격 근무와 시간대 차이'],
      feel: ['장단점을 정리해 봤습니다. 비슷한 경험이 있으면 댓글 부탁드려요.', '생각보다 어려웠지만 보람 있었습니다. 질문 받습니다.', '제도가 아직 따라오지 못합니다. 개선 방향을 같이 이야기해 봐요.'] },
    en: { t: ['{th}: sharing my experience|{fe}', '{th}: what do you think?|{fe}'],
      thing: ['My first year after moving to {p}', 'Raising kids in low gravity', 'Commuting to an orbital station', 'Starting a hydro-farm', 'Finding work after leaving the fleet', 'Learning an alien language', 'Remote work across time zones'],
      feel: ['I listed the pros and cons. Share yours below.', 'Harder than expected but worth it. AMA.', 'The rules have not caught up yet. Let us talk about fixes.'] },
  },
};
function composeDaily(site: Site, lang: Lang, r: () => number): string { const d = DT[site][lang]; return pickOf(r, d.t).replace('{th}', pickOf(r, d.thing)).replace('{fe}', pickOf(r, d.feel)); }
const DS_REACT = { ko: ['나만 그렇게 생각함?', 'ㄹㅇ 반박 시 니 말이 맞음', '할 말 많은데 참는다', '이건 진짜임', '다들 어떻게 생각함'], en: ['is it just me?', 'prove me wrong', 'holding back so much rn', 'this is real', 'thoughts?'] };
const HEAD = { ko: { chat: '잡담', info: '정보', q: '질문', debate: '토론' }, en: { chat: 'Chat', info: 'Info', q: 'Q', debate: 'Debate' } };
const SLANG_KO = ['ㅋㅋ', 'ㄹㅇ', 'ㅠㅠ', '..', 'ㅎㅎ'], SLANG_EN = ['lol', 'ngl', 'tbh', 'fr', '😭'];
function fill(s: string, w: World, r: () => number): string {
  const p = w.planets.length ? pickOf(r, w.planets) : w.lang === 'ko' ? '수도' : 'the capital';
  return s.replace(/\{e\}/g, w.empire).replace(/\{r\}/g, w.ruler).replace(/\{p\}/g, p).replace(/\{u\}/g, w.unrest[0] || p).replace(/\{w\}/g, w.atWar[0] || (w.lang === 'ko' ? '적국' : 'the enemy'))
    .replace(/\{x\}/g, w.minority || (w.lang === 'ko' ? '외계' : 'alien')).replace(/\{v\}/g, w.rivals[0] || w.atWar[0] || (w.lang === 'ko' ? '이웃 제국' : 'the neighbors')).replace(/\{ev\}/g, (w.events[0] || '').slice(0, 60));
}
/** 입장: 민심(0~100)에 비례, 긍정·부정 각각 최대 90%. lean 이 정부 쪽(event)과 맞으면 조금 더 긍정. */
export function stanceOf(r: () => number, mood: number | null, tilt = 0): Stance {
  const m = mood === null ? 50 : mood; const pPro = clamp(0.2 + (m / 100) * 0.7 + tilt, 0.1, 0.9);
  const x = r(); if (x < pPro * 0.85) return 'pro'; if (x > 1 - (1 - pPro) * 0.85) return 'con'; return 'neu';
}
function slangify(s: string, lang: Lang, on: boolean, r: () => number): string { if (!on || r() < 0.4 || /[ㅋㅠㅎ♡✨😭💪🙏!?]$/u.test(s.trim()) || /\b(lol|lmao|ngl|tbh|fr|omg)\b|ㄹㅇ|ㅋㅋ|ㅠㅠ/i.test(s)) return s; return s + (lang === 'ko' ? ' ' + pickOf(r, SLANG_KO) : ' ' + pickOf(r, SLANG_EN)); }
function plainify(s: string, lang: Lang): string { return lang === 'ko' ? s.replace(/(ㅋ|ㅠ|ㅎ){2,}/g, '').replace(/\s*(ㄹㅇ|ㅇㅈ|ㄴㄴ)\s*/g, ' ').replace(/[♡✨💪🙏😭]/g, '').trim() : s.replace(/\b(lol|lmao|ngl|tbh|fr|omg)\b/gi, '').replace(/[♡✨💪🙏😭😢😟🫶🥺]/g, '').replace(/\s+/g, ' ').trim(); }
const bank = (k: string, lang: Lang) => (B[k] ?? B[k.replace(/\.(pro|con|neu)$/, '.pro')])?.[lang] ?? [];

/** 이번 갱신에 쓸 주제 하나. */
function topicOf(r: () => number, w: World, used: number): { topic: string; ethic?: FactionEthic } {
  const opts: Array<[string, number]> = [['daily', 3], ['mood', 1.5], ['ideo', 2.2]];
  if (w.atWar.length) opts.push(['war', 3]);
  if (w.econ !== 'normal') opts.push(['econ', 2.5]); else opts.push(['econ', 0.6]);
  if (w.events.length && used < w.events.length) opts.push(['event', 3]);
  const tot = opts.reduce((a, o) => a + o[1], 0); let x = r() * tot; for (const [k, v] of opts) { if ((x -= v) <= 0) return { topic: k }; } return { topic: 'daily' };
}
function citizenPost(site: Site, w: World, c: Citizen | null, r: () => number, date: string, idn: string, evIdx: number, slangRate: number): Post {
  const lang = w.lang, t = topicOf(r, w, evIdx), tilt = c ? (c.lean === 'cons' && t.topic === 'war' ? 0.15 : c.lean === 'prog' && t.topic === 'war' ? -0.15 : 0) : 0;
  const st = stanceOf(r, w.mood, tilt); let key = '', ethicTag = '';
  if (t.topic === 'ideo') { const e = c?.ethic || c?.side || pickOf(r, Object.keys(IDEO) as FactionEthic[]); key = 'IDEO:' + e; ethicTag = e; }
  else if (t.topic === 'war') key = `${site}.war.${st === 'con' ? 'con' : 'pro'}`;
  else if (t.topic === 'econ') key = `${site}.econ.${w.econ === 'boom' ? 'good' : 'bad'}`;
  else if (t.topic === 'mood') key = `${site}.mood.${st === 'con' || (w.mood ?? 50) < 40 ? 'bad' : 'good'}`;
  else if (t.topic === 'event') key = `${site}.event.${st === 'con' ? 'con' : 'pro'}`;
  else key = `${site}.daily`;
  const ev = t.topic === 'event' ? [w.events[evIdx % Math.max(1, w.events.length)]] : w.events;
  const ww = { ...w, events: ev.length ? ev : w.events };
  let raw: string;
  if (key.startsWith('IDEO:')) { const arr = IDEO[key.slice(5)]?.[lang] ?? IDEO.materialist[lang]; const parts = pickOf(r, arr).split('|'); raw = site === 'tw' ? parts[0] : site === 'ds' ? parts[1] + '|' + pickOf(r, DS_REACT[lang]) : parts[2] + '|' + parts[3]; }
  else if (key === `${site}.daily` && r() < 0.75) raw = composeDaily(site, lang, r);
  else raw = pickOf(r, bank(key, lang).length ? bank(key, lang) : bank(`${site}.daily`, lang));
  raw = fill(raw, ww, r);
  const slang = (c ? c.slang : true) && r() < slangRate;
  const seed = Math.floor(r() * 2 ** 31), base = 3 + Math.floor(r() * 40) + (t.topic === 'event' || t.topic === 'war' ? 30 : 0);
  const pop = r() < 0.12 ? 8 + r() * 30 : r() < 0.35 ? 2 + r() * 4 : 0.3 + r();
  const ccount = Math.round(pop < 1 ? r() * 4 : pop < 6 ? 5 + r() * 40 : 60 + r() * 400);
  const by = c ? { kind: 'cit' as const, id: c.id, name: site === 'rs' ? 'u/' + c.rs : c.name, handle: '@' + c.tw } : { kind: 'one' as const, name: site === 'rs' ? 'u/' + pickOf(r, HANDLE_EN) + '_' + Math.floor(r() * 999) : lang === 'ko' ? pickOf(r, HANDLE_KO) + Math.floor(r() * 99) : pickOf(r, HANDLE_EN) + Math.floor(r() * 99), handle: '@' + pickOf(r, HANDLE_EN) + Math.floor(r() * 999) };
  const p: Post = { id: idn, site, date, topic: t.topic, stance: st, seed, by, body: '', likes: Math.round(base * pop), shares: Math.round(base * pop * 0.2), views: Math.round(base * pop * (8 + r() * 20)), ccount, ...(ethicTag ? { ethicTag } : {}) };
  if (site === 'tw') { p.body = slang ? slangify(raw, lang, true, r) : plainify(raw, lang); if (t.topic === 'event' && r() < 0.5) p.tags = ['#' + (lang === 'ko' ? '오늘의소식' : 'News')]; }
  else if (site === 'ds') {
    const [title, ...lines] = raw.split('|'); p.title = slang ? title : plainify(title, lang);
    const body = (lines.join('\n') || title).split('\n'); const want = pickLines(r); p.body = body.slice(0, want).join('\n');
    if (c === null) p.by = { kind: 'one', name: lang === 'ko' ? 'ㅇㅇ' : 'anon', ip: anonIp(idn, w.nodes) }; else if (r() < 0.6) p.by = { kind: 'cit', id: c.id, name: lang === 'ko' ? 'ㅇㅇ' : 'anon', ip: anonIp(c.id, w.nodes) }; else p.by = { kind: 'cit', id: c.id, name: c.name.split(' ')[0] };
    p.head = (HEAD[lang] as Record<string, string>)[t.topic === 'ideo' ? 'debate' : t.topic === 'daily' ? (r() < 0.5 ? 'q' : 'chat') : t.topic === 'econ' ? 'info' : 'chat'];
    p.star = p.likes > 80;
  } else {
    const [title, preview, rest] = raw.split('|'); p.title = title; p.body = [preview, rest].filter(Boolean).map((x) => (slang ? x : plainify(x, lang))).join('\n');
  }
  return p;
}
/** DS 본문 줄 수: 1줄 45% · 2줄 30% · 3줄 13% · 4줄 8% · 5줄 4%. */
export function pickLines(r: () => number): number { const x = r(); return x < 0.45 ? 1 : x < 0.75 ? 2 : x < 0.88 ? 3 : x < 0.96 ? 4 : 5; }

const PROMO_TXT: Record<string, T> = {
  cafe: { ko: ['{p} 카페 창가 자리 발견☕ 커피 한 잔에 풍경이 덤이에요|{p} 카페 창가', '{p}에서 제일 예쁜 카페 찾았어요♡ 여기 살고 싶다 진짜|{p} 카페'], en: ['found a window seat at a {p} café ☕ the view comes free with the coffee|{p} café window', 'the prettiest café on {p} ♡ i literally want to live here|{p} café'] },
  view: { ko: ['{p} 풍경 실화예요?✨ 사진으로 다 안 담겨요|{p} 전경', '{p} 전망 보러 꼭 가보세요!! 눈이 맑아지는 기분|{p} 전망'], en: ['is {p} even real?? ✨ photos cannot do it justice|{p} panorama', 'go see the {p} view at least once!! my eyes feel cleaner|{p} view'] },
  street: { ko: ['{p} 거리 산책 중인데 다들 너무 친절해요ㅠㅠ|{p} 거리', '{p} 골목마다 볼거리가 가득♡|{p} 골목'], en: ['walking the streets of {p} and everyone is so nice 😭|{p} street', 'every corner of {p} has something to see ♡|{p} alley'] },
  food: { ko: ['{p} 현지 음식 먹어봤어요🍽 이 맛 때문에라도 또 올래요|{p} 현지 음식', '{p} 시장 음식 투어 성공!!|{p} 시장 음식'], en: ['tried local food on {p} 🍽 coming back for this alone|{p} local food', '{p} market food tour was a win!!|{p} market food'] },
  leisure: { ko: ['{p}에서 보낸 주말, 진짜 힐링 그 자체♡|{p} 휴양', '{p} 놀거리 생각보다 엄청 많아요!!|{p} 여가'], en: ['a weekend on {p} was pure healing ♡|{p} leisure', 'so much more to do on {p} than i thought!!|{p} fun'] },
  home: { ko: ['{p}에서 살면 이런 집에서 산대요🏡 이사 각..|{p} 주택', '{p} 집들 너무 예쁘지 않아요? 이주 진지하게 고민 중|{p} 주거'], en: ['this is what homes look like on {p} 🏡 thinking of moving..|{p} home', 'aren’t the houses on {p} cute? seriously considering moving|{p} homes'] },
};
export function influencerPost(inf: Influencer, w: World, r: () => number, date: string, idn: string, promoPlanet?: string, promoImg?: string): Post {
  const scene = promoImg ? promoImg.split('_').pop() || 'view' : '';
  const lang = w.lang, line = promoPlanet ? pickOf(r, (PROMO_TXT[scene] ?? PROMO_TXT.view)[lang]) : pickOf(r, INFP[inf.field][lang]), [txt, desc] = fill(promoPlanet ? line.replace(/\{p\}/g, promoPlanet) : line, w, r).split('|');
  const k = Math.round(inf.followers / 1000), pop = 0.6 + r();
  const body = `${txt} ${lang === 'ko' ? inf.catch.ko : inf.catch.en}`.trim();
  return { id: idn, site: 'tw', date, topic: promoPlanet ? 'promo' : 'inf', stance: 'neu', seed: Math.floor(r() * 2 ** 31), by: { kind: 'inf', id: inf.id, name: lang === 'ko' ? inf.name.ko : inf.name.en, handle: '@' + inf.handle },
    body, likes: Math.round(k * 10 * pop), shares: Math.round(k * pop), views: Math.round(k * 100 * pop), ccount: Math.round(k / 4 * pop), ...(promoPlanet && promoImg ? { promo: { planet: promoPlanet, img: promoImg } } : { photo: { n: 1 + Math.floor(r() * 4), desc } }) };
}

/** 한 사이트의 새 글. months = 지난번 이후 흐른 게임 달 수(0 이면 만들지 않음). infCount = 이번 갱신에 넣을 인플루언서 글 수(tw 에만). */
export function generate(site: Site, w: World, cits: Citizen[], months: number, seed: number, nextId: () => string, opt: { infs?: Influencer[]; infCount?: number; follow?: string[]; children?: Array<{ name: string; handle: string; line?: string; take?: () => void }>; recent?: Set<string> } = {}): Post[] {
  if (months <= 0) return [];
  const r = rng(seed), out: Post[] = [];
  const n = Math.min(MAX_NEW, Math.max(3, Math.round(3 + months * 2 + w.events.length)));
  const slangRate = site === 'rs' ? 0.5 : 0.8;
  // 인플루언서(트윙클): 서로 다른 사람, 팔로우한 사람 가중
  if (site === 'tw' && opt.infs?.length && opt.infCount) {
    const pool = [...opt.infs]; const want = Math.min(pool.length, Math.max(INF_MIN, opt.infCount));
    for (let i = 0; i < want && pool.length; i++) { const wts = pool.map((x) => (opt.follow?.includes(x.id) ? 2 : 1)); let t = r() * wts.reduce((a, b) => a + b, 0), k = 0; for (; k < pool.length - 1; k++) if ((t -= wts[k]) <= 0) break; out.push(influencerPost(pool.splice(k, 1)[0], w, r, w.date, nextId())); }
  }
  // 통치자 자녀(최대 3, 돌아가며 — 부르는 쪽이 순서대로 넘긴다)
  if (site === 'tw' && opt.children?.length) for (const ch of opt.children.slice(0, CHILD_SLOTS)) { const p = citizenPost(site, w, null, r, w.date, nextId(), 0, slangRate); p.by = { kind: 'child', name: ch.name, handle: '@' + ch.handle }; p.topic = 'daily'; p.body = ch.line || fill(pickOf(r, B['tw.daily'][w.lang]), w, r); ch.take?.(); out.push(p); } // line: 민간인 자녀의 작은 근황(2026-10-28)
  let ev = 0;
  const seen = new Set(out.map((p) => (p.title || '') + p.body)); let guard = 0;
  while (out.length < n && guard++ < n * 6) { const c = r() < 0.7 && cits.length ? pickOf(r, cits) : null; const p = citizenPost(site, w, c, r, w.date, 'tmp', ev, slangRate); const k = (p.title || '') + p.body; if (seen.has(k) || (opt.recent && opt.recent.has(k))) continue; seen.add(k); p.id = nextId(); if (p.topic === 'event') ev++; out.push(p); }
  // 섞기(인플루언서 글이 늘 맨 위에 오지 않게)
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, MAX_NEW);
}

/** 글을 열 때 댓글을 만든다(씨앗값으로 늘 같은 내용). 실제로는 최대 15개, ccount 는 보이는 숫자. */
export function commentsFor(p: Post, w: World, cits: Citizen[]): Comment[] {
  const r = rng(p.seed ^ 0x9e3779b9), lang = w.lang, n = Math.min(TOP_COMMENTS, p.ccount < 5 ? p.ccount : p.ccount < 60 ? 5 + Math.floor(r() * 3) : TOP_COMMENTS);
  const out: Comment[] = [];
  for (let i = 0; i < n; i++) {
    const c = cits.length && r() < 0.6 ? pickOf(r, cits) : null;
    const agree = p.stance === 'neu' ? r() < 0.4 : (c ? (c.lean === 'prog') === (p.stance === 'con' ? p.topic === 'war' : true) : r() < 0.55);
    const kind = r() < 0.2 ? 'neu' : agree ? 'agree' : 'disagree';
    // 주제 댓글 75%(동의·반대일 때) — 트윙클·DS는 가끔 사이트 반응을 꼬리로 붙인다. 나머지는 사이트 일반 반응.
    const tl = kind !== 'neu' && r() < 0.75 ? topicLine(p, w, kind === 'agree', r) : '';
    let text = tl ? (p.site !== 'rs' && r() < 0.35 ? tl + ' ' + pickOf(r, C[`${p.site}.${kind}`][lang]) : tl) : pickOf(r, C[`${p.site}.${kind}`][lang]);
    for (let t = 0; t < 4 && out.some((x) => x.text === text); t++) text = topicLine(p, w, kind === 'agree', r) || pickOf(r, C[`${p.site}.${['agree', 'disagree', 'neu'][t % 3]}`][lang]);
    if (c && !c.slang) text = plainify(text, lang) || text;
    const name = p.site === 'ds' ? (lang === 'ko' ? 'ㅇㅇ' : 'anon') : p.site === 'rs' ? 'u/' + (c ? c.rs : pickOf(r, HANDLE_EN) + Math.floor(r() * 99)) : (c ? c.name : (lang === 'ko' ? pickOf(r, HANDLE_KO) : pickOf(r, HANDLE_EN)) + Math.floor(r() * 99));
    const cm: Comment = { name, text, up: Math.round((r() * 3) ** 3 * (p.likes / 20 + 1)), ...(p.site === 'ds' ? { ip: anonIp(c ? c.id : p.id + ':' + i, w.nodes) } : {}) };
    // 반대 입장이 붙으면 짧은 언쟁(한 줄기에 최대 3번)
    if (p.site !== 'tw' && kind === 'disagree' && r() < 0.5) { cm.replies = []; for (let k = 0; k < 1 + Math.floor(r() * 2); k++) cm.replies.push({ name: p.site === 'ds' ? (lang === 'ko' ? 'ㅇㅇ' : 'anon') : 'u/' + pickOf(r, HANDLE_EN) + Math.floor(r() * 99), text: topicLine(p, w, k % 2 === 1, r) || pickOf(r, C[`${p.site}.${k % 2 ? 'disagree' : 'agree'}`][lang]), up: Math.round(r() * 30), ...(p.site === 'ds' ? { ip: anonIp(p.id + ':r' + i + k, w.nodes) } : {}) }); }
    out.push(cm);
  }
  return out.sort((a, b) => b.up - a.up);
}

// ── LLM 공통 재료(2026-10-28): 출력 언어 · 민심 · 파벌 분포 · 단골 시민 몇 명의 성향 ──
export interface NetAiCtx { langName: string; factions: Array<{ ethic: string; support: number }>; cits: Citizen[] }
const LEAN_EN: Record<Lean, string> = { prog: 'progressive', cons: 'conservative', neu: 'neutral' };
function worldLines(w: World, x: NetAiCtx): string {
  const fac = x.factions.filter((f) => f.support > 0).sort((a, b) => b.support - a.support).slice(0, 6).map((f) => `${f.ethic} ${Math.round(f.support * (f.support <= 1 ? 100 : 1))}%`).join(', ');
  return [
    `Empire: ${w.empire}. Ruler: ${w.ruler}. Game date: ${w.date}. Public mood: ${w.mood ?? 50}/100. Economy: ${w.econ}.`,
    w.atWar.length ? `At war with: ${w.atWar.join(', ')}.` : 'Not at war.',
    w.unrest.length ? `Unrest on: ${w.unrest.join(', ')}.` : '',
    w.planets.length ? `Our planets: ${w.planets.slice(0, 8).join(', ')}.` : '',
    w.rivals.length ? `Known foreign empires: ${w.rivals.join(', ')}.` : '',
    fac ? `Faction support: ${fac}.` : '',
    w.events.length ? `Recent news (facts you may mention): ${w.events.slice(0, 5).join(' / ')}` : '',
  ].filter(Boolean).join('\n');
}
const citLine = (c: Citizen) => `${c.id}: ${c.name}, ${c.g === 'f' ? 'woman' : 'man'}, ${LEAN_EN[c.lean]} (${c.ethic}${c.side ? ', ' + c.side : ''}), lives on ${c.planet || 'the capital'}, ${c.slang ? 'uses internet slang' : 'writes plainly'}`;
const RULES = 'Stay inside the fictional Stellaris setting. Never target real-world ethnic, national or religious groups; hostility toward fictional alien species only as mild in-world opinion, never slurs. Do not invent wars, deaths, laws or numbers that are not in the given facts; small personal daily-life details are fine.';
const SITE_FORM: Record<Site, string> = {
  tw: 'Twinkle post: one short post (1–3 sentences, under 200 characters), no title.',
  ds: 'DS Inside post: a short punchy title plus a body of 1–5 short lines (usually 1–2), lines separated by \\n.',
  rs: 'Redshift post: a clear title plus a body of 2–4 short paragraphs (intro, argument, conclusion) separated by \\n.',
};
function authorOf(p: Post, cits: Citizen[], infs: Influencer[], lang: Lang): string {
  const b = p.by;
  if (b.kind === 'cit') { const c = cits.find((x) => x.id === b.id); return c ? 'regular citizen ' + citLine(c) : `citizen ${b.name}`; }
  if (b.kind === 'inf') { const i = infs.find((x) => x.id === b.id); return i ? `lifestyle influencer ${i.name[lang]} (${i.field}; rarely talks politics; catchphrase "${i.catch[lang]}")` : 'lifestyle influencer'; }
  if (b.kind === 'child') return `the ruler's adult child ${b.name} (personal life update, not politics)`;
  return b.off ? 'an official account' : `a one-off citizen ${b.name}`;
}
/** 열기·⟳ 한 번에 사이트당 한 번: 틀 초안(작성자·주제·입장)을 그대로 지키며 본문을 새로 쓴다. */
export function postWriterMessages(site: Site, w: World, posts: Post[], x: NetAiCtx, infs: Influencer[]): Array<{ role: 'system' | 'user'; content: string }> {
  const sys = [
    `You write citizen posts for ${SITE_STYLE[site]} The site exists inside the game Stellaris. Write in ${x.langName}.`,
    SITE_FORM[site],
    'For each item, keep the given author, topic and stance (pro = supports / agrees with the situation, con = critical, neu = neutral), and keep the gist of the draft, but write it fresh and natural in the author\'s own voice. Each post must sound like a different person. Use the facts below where they fit.',
    'Influencers keep their catchphrase. Photo descriptions are shown separately; do not describe photos.',
    RULES,
    'Output ONLY JSON: {"posts":[{"id":"…","title":"…","body":"…"}]} with every id exactly once (title only for DS Inside and Redshift).',
  ].join('\n');
  const items = posts.map((p) => ({ id: p.id, author: authorOf(p, x.cits, infs, w.lang), topic: p.topic, stance: p.stance, ...(p.ethicTag ? { belief: p.ethicTag } : {}), ...(p.head ? { tag: p.head } : {}), ...(p.promo ? { promo: `sponsored post promoting the planet ${p.promo.planet} (travel/life there; mark it #ad)` } : {}), draft: (p.title ? p.title + ' | ' : '') + p.body.slice(0, 400) }));
  return [{ role: 'system', content: sys }, { role: 'user', content: worldLines(w, x) + '\n\nPosts:\n' + JSON.stringify(items) }];
}
export function parsePostWriter(raw: unknown, ids: string[]): Map<string, { title?: string; body: string }> {
  const out = new Map<string, { title?: string; body: string }>();
  let j: any = raw; if (typeof raw === 'string') { const m = /\{[\s\S]*\}/.exec(raw); if (!m) return out; try { j = JSON.parse(m[0]); } catch { return out; } }
  for (const it of Array.isArray(j?.posts) ? j.posts : []) {
    if (!it || typeof it.id !== 'string' || !ids.includes(it.id) || typeof it.body !== 'string' || !it.body.trim()) continue;
    out.set(it.id, { body: it.body.replace(/\\n/g, '\n').trim().slice(0, 1500), ...(typeof it.title === 'string' && it.title.trim() ? { title: it.title.trim().slice(0, 90) } : {}) });
  }
  return out;
}
/** 글을 눌렀을 때 한 번: 인기 댓글 n개(최대 7). 반대 성향끼리 짧게 맞받아치기(한 줄기 최대 2개 답글). */
export function commentWriterMessages(p: Post, w: World, n: number, x: NetAiCtx, picks: Citizen[]): Array<{ role: 'system' | 'user'; content: string }> {
  const fight = p.site === 'tw' ? 'emotionally' : p.site === 'ds' ? 'bluntly, with jokes' : 'with reasons';
  const sys = [
    `You write the top comments under a post on ${SITE_STYLE[p.site]} The site exists inside the game Stellaris. Write in ${x.langName}.`,
    `Write exactly ${n} top comments from different citizens, most liked first. They react to what this post actually says (its claims, mood and details), not generic reactions. Opinions follow public mood and faction support, but include agreement and disagreement. Citizens of the opposite leaning push back ${fight}: up to 2 of the comments may have 1–2 short replies arguing back.`,
    'Some commenters are regular citizens from the list (use their id in "who" and write in their voice); others are passers-by (who = "").',
    RULES,
    'Output ONLY JSON: {"comments":[{"who":"","name":"short username","text":"…","replies":[{"name":"…","text":"…"}]}]}',
  ].join('\n');
  const usr = `${worldLines(w, x)}\n\nRegular citizens who may comment:\n${picks.map(citLine).join('\n')}\n\nPost by ${p.by.name} (topic ${p.topic}, stance ${p.stance}):\n${p.title ? p.title + '\n' : ''}${p.body.slice(0, 1500)}`;
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
export interface AiComment { who?: string; name?: string; text: string; replies?: Array<{ name?: string; text: string }> }
export function parseCommentWriter(raw: unknown, n: number): AiComment[] {
  let j: any = raw; if (typeof raw === 'string') { const m = /\{[\s\S]*\}/.exec(raw); if (!m) return []; try { j = JSON.parse(m[0]); } catch { return []; } }
  const ok = (c: any) => c && typeof c.text === 'string' && c.text.trim();
  return (Array.isArray(j?.comments) ? j.comments : []).filter(ok).slice(0, Math.min(n, TOP_COMMENTS)).map((c: any) => ({
    who: typeof c.who === 'string' ? c.who.slice(0, 12) : '', name: typeof c.name === 'string' ? c.name.slice(0, 30) : undefined, text: c.text.trim().slice(0, 400),
    ...(Array.isArray(c.replies) && c.replies.some(ok) ? { replies: c.replies.filter(ok).slice(0, 2).map((r: any) => ({ name: typeof r.name === 'string' ? r.name.slice(0, 30) : undefined, text: r.text.trim().slice(0, 300) })) } : {}),
  }));
}
/** 플레이어 글의 댓글 수(인기 따라, 최대 7): 공식 5~7 · 익명 3~6 · 민간 2~5(팔로워·공감 적음). */
export function playerCommentCount(acct: 'off' | 'civ' | 'anon', r: () => number): number { return acct === 'off' ? 5 + Math.floor(r() * 3) : acct === 'anon' ? 3 + Math.floor(r() * 4) : 2 + Math.floor(r() * 4); }

// ── 플레이어 글에 대한 시민 반응(LLM 한 번) ──
export interface PlayerPostAi { comments: Array<{ name?: string; text: string }>; praise_ruler?: boolean; newsworthy?: boolean; reception?: 'praise' | 'backlash' | 'mixed' }
const SITE_STYLE: Record<Site, string> = {
  tw: 'Twinkle, a short-post social network (like Twitter) whose users are mostly women; replies are short, warm and emotional, with common internet slang (e.g. ㅠㅠ, ♡, omg, literally) from about 80% of users.',
  ds: 'DS Inside, an anonymous community board (like a rough image-board forum); replies are blunt, short and joking, common internet slang from about 80% of users, but no slurs or hate speech.',
  rs: 'Redshift, a discussion board (like Reddit); replies argue with reasons, about half use casual internet slang.',
};
export function playerPostMessages(site: Site, acct: 'off' | 'civ' | 'anon', w: World, text: string, n: number, thread?: { op: string; parent?: string }, x?: NetAiCtx, mode: 'post' | 'ama' | 'amaAnswer' = 'post'): Array<{ role: 'system' | 'user'; content: string }> {
  const who = acct === 'off' ? `the empire's ruler ${w.ruler} posting from the verified official account` : acct === 'civ' ? 'an ordinary-looking citizen account (secretly the ruler, but nobody knows)' : 'an anonymous user (secretly the ruler, but nobody knows)';
  const sys = [
    `You write citizen replies on ${SITE_STYLE[site]} The site exists inside the game Stellaris, in the empire ${w.empire}.${x ? ' Write in ' + x.langName + '.' : ''}`,
    mode === 'ama' ? `The ruler ${w.ruler} opened an AMA ("ask me anything") from the verified official account; the post is below. Write ${n} questions from different citizens: policy, war, economy, the ruler's personal life, at least one hostile or awkward question and one light joke. Questions follow public mood and faction support.`
      : mode === 'amaAnswer' ? `In the ruler's AMA, the ruler answered a citizen's question. Write ${n} replies: the first is the citizen who asked, reacting to the answer; then 1–2 others join. Judge the answer honestly: evasive or arrogant answers get pushback.`
      : `The post below was written by ${who}. Write ${n} replies from different citizens. Opinions follow public mood (${w.mood ?? 50}/100) and faction support, but at least one reply disagrees and at least one agrees. React only to what the post says; do not invent new game events, numbers or facts.`,
    x ? worldLines(w, x) : '',
    x && x.cits.length ? 'Some repliers may be these regular citizens (write in their voice and use their name):\n' + x.cits.slice(0, 6).map(citLine).join('\n') : '',
    'Stay inside the fictional setting; never target real-world ethnic, national or religious groups. Hostility toward fictional alien species is allowed only as mild in-world opinion, never slurs.',
    thread && mode === 'post' ? 'This is a reply thread: the first reply must be the original poster answering the player, then 1–2 others join.' : '',
    'Also judge: praise_ruler = true if the post defends or praises the ruler/government; newsworthy = true if it is about war, diplomacy or national policy and could make the news; reception = "praise" | "backlash" | "mixed".',
    'Output ONLY JSON: {"comments":[{"name":"short username","text":"…"}],"praise_ruler":false,"newsworthy":false,"reception":"mixed"}',
  ].filter(Boolean).join('\n');
  const usr = (thread ? `Original post: ${thread.op.slice(0, 500)}\n${thread.parent ? (mode === 'amaAnswer' ? 'Citizen question: ' : 'Replying to: ') + thread.parent.slice(0, 300) + '\n' : ''}${mode === 'amaAnswer' ? 'Ruler answer: ' : 'Player reply: '}` : 'Post: ') + text.slice(0, 1200);
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
export function parsePlayerAi(raw: unknown): PlayerPostAi | null {
  let j: any = raw; if (typeof raw === 'string') { const m = /\{[\s\S]*\}/.exec(raw); if (!m) return null; try { j = JSON.parse(m[0]); } catch { return null; } }
  if (!j || !Array.isArray(j.comments)) return null;
  const comments = j.comments.filter((c: any) => c && typeof c.text === 'string' && c.text.trim()).slice(0, MAX_COMMENTS).map((c: any) => ({ name: typeof c.name === 'string' ? c.name.slice(0, 30) : undefined, text: c.text.trim().slice(0, 400) }));
  if (!comments.length) return null;
  const rec = j.reception === 'praise' || j.reception === 'backlash' ? j.reception : 'mixed';
  return { comments, praise_ruler: j.praise_ruler === true, newsworthy: j.newsworthy === true, reception: rec };
}

// ── 신분 노출(진짜 낮게, 사용자 확정): 글·답글마다 기본 0.05% + 감싸는 글마다 의심 +0.01%p(최대 +0.5%p), 1년 감싸지 않으면 절반 ──
export const EXPOSE = { base: 0.0005, perPraise: 0.0001, maxSus: 0.005 };
export function exposeChance(sus: number): number { return EXPOSE.base + clamp(sus, 0, EXPOSE.maxSus); }
export function addSuspicion(sus: number, praised: boolean): number { return praised ? Math.min(EXPOSE.maxSus, sus + EXPOSE.perPraise) : sus; }
// ── 공식 글 기사화: 반응 폭발/논란 + 기사감 + 6개월에 1건 ──
export function articleWorthy(ai: PlayerPostAi, likes: number, followers: number): 'praise' | 'backlash' | null {
  if (!ai.newsworthy) return null;
  if (ai.reception === 'backlash') return 'backlash';
  if (ai.reception === 'praise' && likes >= Math.max(500, followers * 0.02)) return 'praise';
  return null;
}

// ── 행성 홍보 협업(2026-10-28 사용자 확정): 의뢰 즉시 에너지 50 + 소비재 100, 2년 동안 그 행성 이주 끌림 +10~25%(인플루언서 규모) ──
export const PROMO = { energy: 50, goods: 100, days: 720 };
export function promoTier(followers: number): 1 | 2 | 3 { return followers >= 450000 ? 3 : followers >= 300000 ? 2 : 1; }
/** k = 행성 순서(1부터, every_owned_colony 순서 — planet-holiday 와 같은 방식). 회신 SLLM:NETPROMO status=applied|duplicate|short|no_target. */
export function promoCommand(req: number, sid: string, k: number, tier: 1 | 2 | 3, n: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(k) || k < 1 || !Number.isSafeInteger(n) || n < 1) throw new Error('INVALID_PROMO');
  const mod = `sllm_net_promo_${tier}`, mark = `sllm_netp_${n}`, log = (s: string) => `log = "SLLM:NETPROMO/;/req=${req}/;/sid=${sid}/;/k=${k}/;/status=${s}"`;
  const loop = `set_variable = { which = sllm_pt_n value = 0 } set_variable = { which = sllm_pt_ok value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_pt_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_pt_n value = ${k} } } } remove_modifier = sllm_net_promo_1 remove_modifier = sllm_net_promo_2 remove_modifier = sllm_net_promo_3 add_modifier = { modifier = ${mod} days = ${PROMO.days} } prev = { set_variable = { which = sllm_pt_ok value = 1 } } } }`;
  const pay = `add_resource = { energy = -${PROMO.energy} consumer_goods = -${PROMO.goods} } set_variable = { which = ${mark} value = 1 }`;
  const done = `if = { limit = { check_variable = { which = sllm_pt_ok value = 1 } } ${pay} ${log('applied')} } else = { ${log('no_target')} } clear_variable = sllm_pt_n clear_variable = sllm_pt_ok`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { OR = { resource_stockpile_compare = { resource = energy value < ${PROMO.energy} } resource_stockpile_compare = { resource = consumer_goods value < ${PROMO.goods} } } } ${log('short')} } else = { ${loop} ${done} } }`;
}
/** 행성 종류 묶음(planets.ts pc) → 홍보 사진 종류. 모르면 대륙. */
const PC_PROMO: Record<number, string> = { 1: 'desert', 2: 'savannah', 3: 'continental', 4: 'tropical', 5: 'ocean', 6: 'arctic', 7: 'alpine', 8: 'relic', 9: 'tomb', 10: 'arid', 11: 'desert', 14: 'ecumenopolis', 15: 'ringworld', 16: 'habitat', 19: 'arid', 20: 'gaia', 21: 'tundra' }; // planets.ts PC_KO 순서
export const PROMO_SCENES = ['view', 'cafe', 'street', 'food', 'leisure', 'home'] as const;
export function promoImage(pc: number, r: () => number): string { return `promo_${PC_PROMO[pc] ?? 'continental'}_${pickOf(r, PROMO_SCENES)}`; }

// ── 저장 정리 ──
export interface NetSave {
  seed: number; seq: number; citizens: Citizen[]; posts: Record<Site, Post[]>; last: Record<Site, string>; econHist: number[]; econDate: string;
  nick: { tw: string; ds: string; rs: string }; follow: string[]; infs: Influencer[]; sus: number; susDate: string; articleDate: string; childTurn: number;
  promo: Array<{ n: number; inf: string; planet: string; pc?: number; until: string }>; promoSeq: number; evSeen: string[];
}
export function emptyNet(seed: number): NetSave {
  return { seed, seq: 0, citizens: [], posts: { tw: [], ds: [], rs: [] }, last: { tw: '', ds: '', rs: '' }, econHist: [], econDate: '', nick: { tw: '', ds: '', rs: '' }, follow: [], infs: INFLUENCERS.map((x) => ({ ...x, name: { ...x.name }, bio: { ...x.bio }, catch: { ...x.catch } })), sus: 0, susDate: '', articleDate: '', childTurn: 0, promo: [], promoSeq: 0, evSeen: [] };
}
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
export function sanitizeNet(v: unknown, seed: number): NetSave {
  const o = (v && typeof v === 'object' ? v : {}) as any, e = emptyNet(Number.isSafeInteger(o.seed) ? o.seed : seed);
  e.seq = Number.isSafeInteger(o.seq) && o.seq >= 0 ? o.seq : 0;
  if (Array.isArray(o.citizens)) e.citizens = o.citizens.filter((c: any) => c && typeof c.id === 'string' && typeof c.name === 'string').slice(0, 40);
  for (const s of SITES) { if (Array.isArray(o.posts?.[s])) e.posts[s] = o.posts[s].filter((p: any) => p && typeof p.id === 'string' && typeof p.body === 'string').slice(0, MAX_KEEP[s]); e.last[s] = str(o.last?.[s], 12); }
  if (Array.isArray(o.econHist)) e.econHist = o.econHist.filter((x: unknown) => typeof x === 'number').slice(-12); e.econDate = str(o.econDate, 12);
  e.nick = { tw: str(o.nick?.tw, 16), ds: str(o.nick?.ds, 16), rs: str(o.nick?.rs, 16) };
  if (Array.isArray(o.follow)) e.follow = o.follow.filter((x: unknown) => typeof x === 'string').slice(0, 200);
  if (Array.isArray(o.infs)) { const by = new Map(o.infs.filter((x: any) => x && typeof x.id === 'string').map((x: any) => [x.id, x])); e.infs = e.infs.map((d) => { const x: any = by.get(d.id); if (!x) return d; return { ...d, name: { ko: str(x.name?.ko, 30) || d.name.ko, en: str(x.name?.en, 30) || d.name.en }, handle: str(x.handle, 20) || d.handle, bio: { ko: str(x.bio?.ko, 160) || d.bio.ko, en: str(x.bio?.en, 160) || d.bio.en }, catch: { ko: str(x.catch?.ko, 60) || d.catch.ko, en: str(x.catch?.en, 60) || d.catch.en }, field: (['travel', 'food', 'fitness', 'pets', 'fashion'] as InfField[]).includes(x.field) ? x.field : d.field, ethic: typeof x.ethic === 'string' ? x.ethic : d.ethic, followers: Number.isSafeInteger(x.followers) ? x.followers : d.followers, ...(typeof x.avatar === 'string' && x.avatar.startsWith('data:image/') && x.avatar.length < 600000 ? { avatar: x.avatar } : {}) }; }); }
  e.sus = typeof o.sus === 'number' ? clamp(o.sus, 0, EXPOSE.maxSus) : 0; e.susDate = str(o.susDate, 12); e.articleDate = str(o.articleDate, 12); e.childTurn = Number.isSafeInteger(o.childTurn) ? o.childTurn : 0;
  if (Array.isArray(o.promo)) e.promo = o.promo.filter((x: any) => x && typeof x.planet === 'string').slice(-30); e.promoSeq = Number.isSafeInteger(o.promoSeq) ? o.promoSeq : 0;
  if (Array.isArray(o.evSeen)) e.evSeen = o.evSeen.filter((x: unknown) => typeof x === 'string').slice(-60);
  return e;
}
