// 「회랑의 삼파전」 대세력(2026-11-06 사용자: 「거대양당보다 대세력 셋, 대표 귀족 3명」 — 지역 기준으로 확정).
// 나라마다 세 세력(수도권·내지·국경)이 있고, 대표 귀족이 정해져 있다. 대표가 떠나면(반란·귀순) 군주와 가장 가까운 구성원이 대표를 대행한다.
// 대표의 마음이 세력을 끈다: 분기마다 구성원의 충성이 대표 쪽으로 조금씩 따라간다(대표와 서약·혼약·협약으로 묶이면 더 빨리).
// 화면 문구는 앱(scenario-nobles-app)에서 L('한','En') 글자 그대로 — 여기 영어는 AI 프롬프트용.
import { loyalStage, pairKey, rulerOf, NB, type NobleRow, type NobleSave, type NSide, type BondRow, type LoyalStage } from './scenario-nobles';

export type FKey = 'core' | 'inner' | 'border';
export const FKEYS: FKey[] = ['core', 'inner', 'border'];
export type Stance = 'loyalist' | 'pragmatic' | 'autonomist';
/** 지역 = 세력: 국경 거점이면 국경, 수도에서 가까운 묶음(t=1)이면 수도권, 나머지는 내지. 연감 세력판의 지역 갈래와 같다. */
export const factionOf = (n: NobleRow): FKey => (n.border ? 'border' : (n.t ?? 2) <= 1 ? 'core' : 'inner');

export interface FactionDef { side: NSide; key: FKey; leader: number; stance: Stance; en: string; agendaEn: string }
/** 대표 6명: 성격·거점으로 고름(수도권 = 수도 섹터의 명예로운 귀족, 내지 = 계산적인 실리가, 국경 = 계산적인 자치파). */
export const CR_FACTIONS: FactionDef[] = [
  { side: 'a', key: 'core', leader: 396, stance: 'loyalist', en: 'Council of the Constellation', agendaEn: "uphold the head of state's authority and keep the Corridor in check" },
  { side: 'a', key: 'inner', leader: 575, stance: 'pragmatic', en: 'Houses of the Midlands', agendaEn: 'stable trade routes and lower taxes' },
  { side: 'a', key: 'border', leader: 459, stance: 'autonomist', en: 'Wardens of the Marches', agendaEn: 'wider frontier autonomy and open trade with the Corridor' },
  { side: 'b', key: 'core', leader: 263, stance: 'loyalist', en: "The Throne's Inner Circle", agendaEn: "strengthen the Führer's personal rule and prepare mobilization" },
  { side: 'b', key: 'inner', leader: 13, stance: 'pragmatic', en: 'Lords of the Imperial Heart', agendaEn: 'military contracts and guaranteed estate privileges' },
  { side: 'b', key: 'border', leader: 297, stance: 'autonomist', en: 'Margraves of the Iron Gate', agendaEn: "the margraves' autonomy and control of Iron Gate traffic" },
];
export const FX = { pullGap: 10, pull: 1, boundPull: 2 };
const STANCE_EN: Record<Stance, string> = { loyalist: 'loyalist', pragmatic: 'pragmatic', autonomist: 'autonomist' };

const live = (s: NobleSave, id: number) => !s.fate[id] && !s.pending[id];
export const defOf = (side: NSide, key: FKey): FactionDef => CR_FACTIONS.find((f) => f.side === side && f.key === key) as FactionDef;
export const membersOf = (nobles: NobleRow[], side: NSide, key: FKey): NobleRow[] => nobles.filter((n) => n.side === side && factionOf(n) === key);

/** 지금 대표: 정해진 대표가 남아 있으면 그 귀족, 떠났으면 군주와 가장 가까운 남은 구성원(대행). 아무도 없으면 null. */
export function leaderOf(s: NobleSave, nobles: NobleRow[], side: NSide, key: FKey): { id: number; acting: boolean } | null {
  const d = defOf(side, key);
  const up = s.flead?.[`${side}_${key}`]; // 하극상으로 대표 자리를 차지한 귀족(2026-11-07)
  if (up !== undefined && live(s, up) && nobles.some((n) => n.id === up && n.side === side && factionOf(n) === key)) return { id: up, acting: false };
  if (live(s, d.leader)) return { id: d.leader, acting: false };
  const rest = membersOf(nobles, side, key).filter((n) => live(s, n.id));
  if (!rest.length) return null;
  rest.sort((x, y) => ((s.rel[pairKey(y.id, rulerOf(side))] ?? 0) - (s.rel[pairKey(x.id, rulerOf(side))] ?? 0)) || (x.id - y.id));
  return { id: rest[0].id, acting: true };
}

export interface FactionState { side: NSide; key: FKey; leader: number | null; acting: boolean; avg: number; stage: LoyalStage; inf: number; count: number; active: number }
/** 세력 분위기(남은 구성원의 평균 충성) · 영향력(남은 구성원 비율 0~100). */
export function factionState(s: NobleSave, nobles: NobleRow[], side: NSide, key: FKey): FactionState {
  const ms = membersOf(nobles, side, key), act = ms.filter((n) => live(s, n.id)), ld = leaderOf(s, nobles, side, key);
  const avg = act.length ? Math.round(act.reduce((t, n) => t + (s.loyal[n.id] ?? 100), 0) / act.length) : 0;
  return { side, key, leader: ld ? ld.id : null, acting: !!ld?.acting, avg, stage: loyalStage(avg), inf: ms.length ? Math.round((100 * act.length) / ms.length) : 0, count: ms.length, active: act.length };
}

/** 분기 계산 뒤에 부른다: 구성원 충성이 대표 쪽으로 따라간다. 세력 분위기가 한 단계 나빠지면 기록을 남긴다. */
export function factionTick(s: NobleSave, nobles: NobleRow[], bonds: BondRow[], date: string): Array<{ id: number; from: number; to: number }> {
  const out: Array<{ id: number; from: number; to: number }> = [];
  for (const d of CR_FACTIONS) {
    const before = factionState(s, nobles, d.side, d.key), ld = leaderOf(s, nobles, d.side, d.key); if (!ld) continue;
    const lv = s.loyal[ld.id] ?? 100;
    for (const m of membersOf(nobles, d.side, d.key)) {
      if (m.id === ld.id || !live(s, m.id)) continue;
      const from = s.loyal[m.id] ?? 100, gap = lv - from; if (Math.abs(gap) < FX.pullGap) continue;
      const bound = bonds.some(([k, a, b]) => (k === 'oath' || k === 'union' || k === 'accord') && ((a === m.id && b === ld.id) || (b === m.id && a === ld.id)));
      const to = Math.max(0, Math.min(100, from + Math.sign(gap) * (bound ? FX.boundPull : FX.pull)));
      s.loyal[m.id] = to; out.push({ id: m.id, from, to });
    }
    const after = factionState(s, nobles, d.side, d.key);
    if (after.stage > before.stage) {
      s.notes.push({ d: date, id: ld.id, kind: 'faction', ko: `#${d.side}:${d.key}`, en: `#${d.side}:${d.key}` }); // 문구는 앱이 세력 이름으로 바꿔 보여 준다(언어 팩 쌍 유지)
      if (s.notes.length > NB.keepNotes) s.notes.splice(0, s.notes.length - NB.keepNotes);
    }
  }
  return out;
}

/** 접견 AI 프롬프트: 이 귀족이 속한 세력과 대표. */
export function factionBrief(s: NobleSave, nobles: NobleRow[], n: NobleRow): string {
  const key = factionOf(n), d = defOf(n.side, key), ld = leaderOf(s, nobles, n.side, key);
  const lead = ld ? nobles.find((x) => x.id === ld.id) : undefined;
  const seized = !!ld && s.flead?.[`${n.side}_${key}`] === ld.id;
  if (ld && ld.id === n.id) return ` You ${ld.acting ? 'are the acting leader' : seized ? 'lead (having seized the leadership by challenging your former leader)' : 'lead'} the ${d.en}, a ${STANCE_EN[d.stance]} faction of the realm whose agenda is ${d.agendaEn}; its members look to you.`;
  return ` Member of the ${d.en} (${STANCE_EN[d.stance]} faction; agenda: ${d.agendaEn}), led by ${lead ? lead.en : 'no one at present'}${seized ? ' (who seized the leadership by challenge)' : ''}. A lesser house does not take land from its own faction leader; only an open challenge for the leadership would dare it.`;
}
/** 군주 프롬프트: 궁정의 세 세력. */
export function courtBrief(s: NobleSave, nobles: NobleRow[], side: NSide): string {
  return ' Your court is split into three factions: ' + FKEYS.map((k) => {
    const d = defOf(side, k), st = factionState(s, nobles, side, k), lead = st.leader !== null ? nobles.find((x) => x.id === st.leader) : undefined;
    return `${d.en} (${STANCE_EN[d.stance]}, led by ${lead ? lead.en : 'no one'}; agenda: ${d.agendaEn})`;
  }).join('; ') + '.';
}
