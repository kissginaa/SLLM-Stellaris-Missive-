// 총독 대화: 게임이 로그로 알려 주는 내 행성 목록(SLLM:PLANETS ... SLLM:PLANET ... SLLM:GOV ... SLLM:PLANETS_END)을 모으고, 총독의 프롬프트를 만든다.
import { SllmMessage } from './protocol';
import { ChatMessage } from './player2';
import { classKey } from './speciesClass';
import { Memory, memoryPrompt } from './govmemory';

export const DEFAULT_GOVERNOR = '일반 총독관';

export interface Planet {
  name: string;
  pops: number | null; // 주민 수. 모르면 null
  popsApprox?: boolean; // true 면 pops 는 '이상'(정확한 수를 못 읽고 단계 값만 읽음)
  stability: number | null;
  amenities: number | null; // 남는 여가(음수면 부족)
  housing: number | null; // 남는 주거(음수면 부족)
  capital: boolean;
  pc: number; // 행성 종류 묶음(0 = 모름). PC_KO 참고
  className?: string; // Localized class name supplied by the game, including mod classes.
  governor: string | null; // 총독 이름. 총독이 없거나 읽지 못하면 null
  /** 설립 뒤 개월(colony_age, 2026-10-23 행성 기념일). 모르면 없음 */ age?: number;
  /** 총독 방침(2026-11-03): 행성 고유 번호(연결 모드가 처음 읽을 때 붙임)·맡긴 방침 번호(0 없음, src/govpolicy.ts). 옛 모드면 없음 */ idx?: number; gpol?: number; /** 숙련된 총독(맡긴 지 1년) */ gvet?: boolean;
  /** 빈 일자리·실업자(게임 단위 그대로)·안정도 고정 보정 합(2026-11-05, Empire Dashboard Feed 에서 배운 기법). 옛 모드면 없음 */ jobs?: number; unemployed?: number; stabAdd?: number;
  /** 행성 지정 번호(1 수도 2 광업 3 농업 4 에너지 5 연구 6 산업 7 교역 8 행정·신앙 9 요새 10 휴양 11 형벌·노예 12 도시 0 그 밖). 옛 모드면 없음 */ des?: number;
}
export interface PlanetList { run: number; sid: string; cls: number; empire: string; planets: Planet[] }

const num = (v: string | undefined, none: number): number | null => { if (!v?.trim()) return null; const n = Number(v); return Number.isFinite(n) && n !== none ? n : null; };
/** 정확한 주민 수(pn)가 있으면 그것을, 없으면 단계 값(pops, 'N 이상')을 쓴다. */
const popsOf = (pn: string | undefined, step: string | undefined): { pops: number | null; popsApprox?: boolean } => {
  const exact = num(pn, -1), lo = num(step, -1);
  // 4.x 에서 옛 모드의 num_pops 는 늘 0 을 보낸다(2026-10-18 제보: 총독 화면 주민 0). 단계 값이 1 이상인데 정확한 수가 0 이면 정확한 수를 믿지 않는다.
  if (exact !== null && exact >= 0 && !(exact === 0 && lo !== null && lo > 0)) return { pops: Math.round(exact) };
  return lo === null ? { pops: null } : { pops: lo, popsApprox: true };
};
export function cleanPlanetClassName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(/[\u0000-\u001f]/g, ' ').trim();
  return !text || /[\[\]$]/.test(text) ? '' : text.slice(0, 120);
}

/** 게임 로그 줄을 받아 행성 목록을 모은다. 목록이 끝나면(PLANETS_END) 완성된 목록을 돌려준다. */
/** colony_age·지정 번호(옛 모드면 없음 → 넣지 않는다). */
function ageDes(kv: Record<string, string>): { age?: number; des?: number } {
  const a = Number(kv.cage), d = Number(kv.des), out: { age?: number; des?: number } = {};
  if (kv.cage !== undefined && kv.cage !== '' && Number.isFinite(a) && a >= 0) out.age = Math.round(a);
  if (kv.des !== undefined && kv.des !== '' && Number.isInteger(d) && d >= 0 && d <= 12) out.des = d;
  return out;
}
/** 행성 고유 번호·맡긴 방침(옛 모드면 없음). */
function idxPol(kv: Record<string, string>): { idx?: number; gpol?: number; gvet?: boolean } {
  const i = Number(kv.idx), g = Number(kv.gpol), out: { idx?: number; gpol?: number; gvet?: boolean } = {};
  if (kv.gvet === '1') out.gvet = true;
  if (kv.idx !== undefined && Number.isInteger(i) && i >= 1) out.idx = i;
  if (kv.gpol !== undefined && Number.isInteger(g) && g >= 0 && g <= 8) out.gpol = g;
  return out;
}
/** fj·un(-1 = 못 읽음)·sa(안정도 고정 보정). */
function workOf(kv: Record<string, string>): { jobs?: number; unemployed?: number; stabAdd?: number } {
  // 4.x 는 주민 단위가 커서 「1.2K」처럼 줄여 찍힐 수 있다
  const g = (v: string | undefined): number | null => { const m = String(v ?? '').trim().replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([KkMm])?$/); return m ? Number(m[1]) * (m[2] ? (/[Kk]/.test(m[2]) ? 1e3 : 1e6) : 1) : null; };
  const o: { jobs?: number; unemployed?: number; stabAdd?: number } = {}, fj = g(kv.fj), un = g(kv.un), sa = g(kv.sa);
  if (fj !== null && fj >= 0) o.jobs = Math.round(fj); if (un !== null && un >= 0) o.unemployed = Math.round(un); if (sa !== null) o.stabAdd = Math.round(sa);
  return o;
}
export class PlanetCollector {
  private cur: PlanetList | null = null;
  feed(m: SllmMessage): PlanetList | null {
    if (m.kind === 'PLANETS') {
      this.cur = { run: Number(m.kv.run) || 0, sid: (m.kv.sid ?? '').trim(), cls: Number(m.kv.cls) || 0, empire: (m.kv.empire ?? '').trim(), planets: [] };
    } else if (m.kind === 'PLANET' && this.cur) {
      const name = (m.kv.name ?? '').trim();
      const className = cleanPlanetClassName(m.kv.class);
      if (name) this.cur.planets.push({ name, ...popsOf(m.kv.pn, m.kv.pops), stability: num(m.kv.stab, -999), amenities: scale100(num(m.kv.amen, -999)), housing: scale100(num(m.kv.hous, -999)), capital: m.kv.cap === '1', pc: Number(m.kv.pc) || 0, governor: null, ...(className ? { className } : {}), ...workOf(m.kv), ...ageDes(m.kv), ...idxPol(m.kv) });
    } else if (m.kind === 'GOV' && this.cur && this.cur.planets.length) {
      const g = (m.kv.name ?? '').trim();
      if (g) this.cur.planets[this.cur.planets.length - 1].governor = g;
    } else if (m.kind === 'PLANETS_END' && this.cur) {
      const done = this.cur; this.cur = null; return done;
    }
    return null;
  }
}

export const PC_KO = ['', '사막 행성', '초원 행성', '대륙 행성', '열대 행성', '해양 행성', '북극·빙설 행성', '고산 행성', '불모의 행성', '핵폐허 행성', '용암 행성', '독성 행성', '가스 거인', '소행성', '기계·도시 행성', '고리 세계', '서식지', '장막에 싸인 행성', '군집 행성', '건조 행성', '가이아 행성', '툰드라 행성'];
export const planetType = (p: Planet): string => cleanPlanetClassName(p.className) || PC_KO[p.pc] || '';
/** AI 프롬프트용 행성 종류(영어, 2026-10-19 프롬프트 영어화). 게임이 준 이름(게임 언어)이 있으면 그대로. */
const PC_EN = ['', 'desert world', 'savanna world', 'continental world', 'tropical world', 'ocean world', 'arctic world', 'alpine world', 'barren world', 'tomb world', 'molten world', 'toxic world', 'gas giant', 'asteroid', 'machine/ecumenopolis world', 'ring world', 'habitat', 'shrouded world', 'hive world', 'arid world', 'gaia world', 'tundra world'];
export const planetTypeEn = (p: Planet): string => cleanPlanetClassName(p.className) || PC_EN[p.pc] || '';

/** 총독의 이름. 총독이 있으면 그 이름, 없으면 일반 총독관. */
/** 편의/주거는 게임이 값을 100배로 내보낸다(6581 = 65.81). -999(못 읽음)는 그대로. */
function scale100(v: number | null): number | null { return v === null ? null : v / 100; }
export function governorName(p: Planet): string { return p.governor && p.governor.trim() ? p.governor.trim() : DEFAULT_GOVERNOR; }

const CLASS_KO: Record<string, string> = {
  human: '인간형',
  mammalian: '포유류',
  reptilian: '파충류',
  avian: '조류',
  arthropoid: '절지류',
  molluscoid: '연체류',
  fungoid: '균류',
  plantoid: '식물류',
  infernal: '지옥형',
  lithoid: '암석형',
  necroid: '사령형',
  aquatic: '수생',
  toxoid: '독성형',
  robot: '로봇',
  machine: '기계',
  cybernetic: '사이버네틱',
};
export function className(cls: number): string { const k = classKey(cls); return k ? (CLASS_KO[k] ?? '') : ''; }
/** AI 프롬프트용 종족 계열(영어). */
export function classNameEn(cls: number): string { const k = classKey(cls); return k ?? ''; }

/** 행성의 현재 상태를 한 문단의 사실로. 읽지 못한 값은 적지 않는다(지어내지 않게). */
export function planetFacts(p: Planet): string {
  const f: string[] = [];
  if (p.capital) f.push('it is the empire\'s capital world');
  if (p.pops !== null) f.push(p.popsApprox ? `population at least ${p.pops} (exact count unknown: only say it is large, never invent a number)` : `population ${p.pops}`);
  if (p.stability !== null) f.push(`stability ${Math.round(p.stability)}` + (p.stability < 25 ? ' (low)' : p.stability >= 75 ? ' (high)' : ''));
  if (p.amenities !== null) f.push(p.amenities < 0 ? `amenities short by ${Math.round(-p.amenities)}` : `amenities surplus of ${Math.round(p.amenities)}`);
  if (p.housing !== null) f.push(p.housing < 0 ? `housing short by ${Math.round(-p.housing)}` : `housing surplus of ${Math.round(p.housing)}`);
  if (p.unemployed !== undefined && p.unemployed > 0) f.push(`${p.unemployed} unemployed`);
  if (p.jobs !== undefined && p.jobs > 0) f.push(`${p.jobs} open jobs`);
  if (p.stabAdd !== undefined && p.stabAdd !== 0) f.push(`flat stability modifiers total ${p.stabAdd > 0 ? '+' : ''}${p.stabAdd}`);
  return f.length ? f.join(', ') + '.' : '(no figures could be read)';
}

/** mem: 이름 있는 총독이고 기억 기능을 쓸 때만 넘긴다(일반 총독관은 undefined). 프롬프트는 영어(답 언어는 AI 라우터가 정함, 2026-10-19). */
export function govPrompt(list: PlanetList, p: Planet, player: string, mem?: Memory[], other?: Memory[]): string {
  const gov = governorName(p), real = gov !== DEFAULT_GOVERNOR, cn = classNameEn(list.cls), pt = planetTypeEn(p);
  const lines = [
    `You are ${real ? `Governor ${gov}` : 'the standard governing administrator'} of the planet "${p.name}" in the empire "${list.empire || 'the empire'}". The empire's leader "${player || 'the player'}" is talking with you now.`,
    `Current state of this planet (background you know): ${planetFacts(p)}`,
  ];
  if (pt) lines.push(`This planet is a ${pt}. You may add a very brief remark about its scenery or climate, but do not invent details its planet type does not imply.`);
  if (cn) lines.push(`You belong to a ${cn} species. You may very occasionally let species traits show in how you speak, but do not overdo it.`);
  lines.push('Most important rule: do not volunteer status reports or advice until the leader directly asks about the planet\'s state, situation, problems or advice. Answer greetings, small talk, personal questions and other topics naturally without a report. Do not habitually tack the planet\'s situation onto the end of your lines.');
  lines.push('Only when the leader asks about the state or for advice, answer from the state above: point out the problems the figures show (stability, amenities, housing) and suggest what could be done. Do not invent specific figures not listed above, such as buildings, resource output or population makeup. Say you do not know what you do not know.');
  lines.push('You only report and advise; you do not change the game state yourself. Never say or promise that you built or redesignated anything. The leader decides.');
  lines.push(real ? 'Speak realistically, like a field chief who has served on this planet for a long time.' : 'Speak like a calm, diligent bureaucrat.');
  if (mem) { lines.push(memoryPrompt(mem, other)); lines.push('Answer in two or three sentences at most, always as this planet\'s governor. Do not talk about anything outside the game. Answer only in the JSON format above.'); }
  else lines.push('Answer in two or three sentences at most, always as this planet\'s governor. Do not talk about anything outside the game. Write only the spoken line, with no JSON or explanation.');
  return lines.join('\n');
}

export function govMessages(list: PlanetList, p: Planet, player: string, history: ChatMessage[], userText: string, mem?: Memory[], other?: Memory[]): ChatMessage[] {
  return [{ role: 'system', content: govPrompt(list, p, player, mem, other) }, ...history.slice(-8), { role: 'user', content: userText }];
}

/** 총독 답변에서 대사를 뽑는다. JSON 이 끊기거나 깨져도 "say" 값만 건진다. */
export function extractGovSay(raw: string): { say: string; memo: string } {
  let t = raw.trim().replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
  if (!t.startsWith('{')) return { say: t, memo: '' };
  try { const j = JSON.parse(t); if (typeof j.say === 'string') return { say: j.say.trim(), memo: typeof j.memo === 'string' ? j.memo : '' }; } catch { /* 아래에서 직접 뽑는다 */ }
  const st = /"say"\s*:\s*"/.exec(t);
  if (!st) return { say: t.replace(/^\{\s*/, ''), memo: '' };
  // 모델이 대사 안에 따옴표를 이스케이프 없이 쓰는 경우가 있어, 닫는 따옴표를 "memo" 앞/문장 끝에서 찾는다.
  let body = t.slice(st.index + st[0].length);
  const e1 = body.search(/"\s*,\s*"memo"/);
  if (e1 >= 0) body = body.slice(0, e1); else body = body.replace(/"?\s*\}?\s*$/, '');
  let say = body; try { say = JSON.parse('"' + body.replace(/\\$/, '').replace(/(?<!\\)"/g, '\\"') + '"'); } catch { /* 그대로 */ }
  const mm = /"memo"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(t);
  return { say: say.trim(), memo: mm ? mm[1] : '' };
}

/** 답이 중간에 끊겼는가: 토큰 한도 표시가 있거나, JSON 으로 시작했는데 닫히지 않았다. */
export function govLooksCut(raw: string): boolean {
  const t = raw.trim().replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
  if (t.includes('…(잘림)') || t.includes('…(cut off)')) return true; // player2.ts 끊김 표시(화면 언어에 따라 한/영)
  return t.startsWith('{') && !t.endsWith('}');
}
