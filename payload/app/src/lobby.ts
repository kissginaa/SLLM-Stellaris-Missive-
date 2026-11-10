// 로비(2026-11-03 사용자 결정 ⑦): 이익단체가 통치자를 찾아온다. 「공식 지원」과 「뒷돈」을 서로 다른 이벤트로 나눈다.
//   공식 지원: 합법 후원 → 받으면 국고(에너지)에 들어오고, 그 단체와 가까운 파벌 승인도 +, 반대 성향 파벌 −(2년). 기록이 공개된다.
//   뒷돈: 비밀 돈 → 받으면 통치자 개인 금고(vault)에 들어오고 같은 파벌 효과. 대신 들킬 수 있다(6~24개월 뒤 판정, 기본 30%, 부패 낌새가 쌓일수록 ↑):
//         들키면 2년 안정도 −6·민심 −6·연대기(신문·국정감사 재료). 「공개 고발」하면 민심 +2, 그 단체 쪽 파벌 승인도 −.
// LLM 없음(틀 문장). 「슈뢰딩거」: 찾아오는지는 매달 앱 확률(게임 명령 없음), 게임 명령은 받거나 들켰을 때 한 번(회신 CIVIC).
// 모드: common/static_modifiers/sllm_lobby_modifiers.txt. 앱: src/features/lobby-app.ts. 화면: ui/office-lobby.js(집무실 「로비」).
import { L } from './i18n-pick';
import type { FactionEthic } from './gamestate';
import { monthsBetween } from './letters';

export const LOBBY = {
  chance: 0.05, gapMonths: 18, answerMonths: 3, keep: 12,
  favMod: 'sllm_lobby_favor', spurnMod: 'sllm_lobby_spurned', modDays: 720,
  scandal: { mod: 'sllm_lobby_scandal', days: 720, mood: -6 }, reportMood: 2,
  bribeExposeBase: 0.3, bribeExposePerSusp: 0.05, exposeMinMonths: 6, exposeMaxMonths: 24,
};
export type LobbyKind = 'official' | 'bribe';
export const OPPOSITE: Record<string, FactionEthic> = { militarist: 'pacifist', pacifist: 'militarist', authoritarian: 'egalitarian', egalitarian: 'authoritarian', xenophile: 'xenophobe', xenophobe: 'xenophile', materialist: 'spiritualist', spiritualist: 'materialist' };
/** 성향별 이익단체와 원하는 것. */
export const GROUPS: Record<string, { ko: string; en: string; wantKo: string; wantEn: string }> = {
  militarist: { ko: '방위 산업 협회', en: 'Defence Industry Association', wantKo: '군함 발주를 늘려 달라', wantEn: 'more warship contracts' },
  pacifist: { ko: '성간 평화 재단', en: 'Interstellar Peace Foundation', wantKo: '군비를 줄이고 외교에 힘써 달라', wantEn: 'less armament and more diplomacy' },
  authoritarian: { ko: '질서 수호 협회', en: 'Order Preservation Society', wantKo: '치안을 강화하고 시위를 엄하게 다뤄 달라', wantEn: 'tougher policing and a firm hand with protests' },
  egalitarian: { ko: '노동조합 총연맹', en: 'General Federation of Unions', wantKo: '노동자 권리와 복지를 넓혀 달라', wantEn: 'wider workers\' rights and welfare' },
  xenophile: { ko: '성간 무역 상공회의소', en: 'Interstellar Chamber of Commerce', wantKo: '외계 교역과 이민 문을 넓혀 달라', wantEn: 'more alien trade and open migration' },
  xenophobe: { ko: '순혈 연맹', en: 'League of the Pure', wantKo: '외계인 이민을 막아 달라', wantEn: 'an end to alien immigration' },
  materialist: { ko: '기술 산업 연합', en: 'Technology Industry Alliance', wantKo: '연구 예산을 늘려 달라', wantEn: 'a bigger research budget' },
  spiritualist: { ko: '성전 협의회', en: 'Council of the Temples', wantKo: '신앙을 존중하고 사원을 지원해 달라', wantEn: 'respect for the faith and support for the temples' },
};
export interface Offer { id: string; date: string; kind: LobbyKind; ethic: string; group: string; amount: number; fav?: number; spurn?: number[] }
export type Answer = 'accepted' | 'declined' | 'reported' | 'expired';
export interface LobbyRec extends Offer { answer: Answer; answered: string; exposeAt?: string; exposed?: boolean; status?: string }
export interface LobbySave { offer?: Offer; recs: LobbyRec[]; last?: string; lastSeen?: string }

/** 이번 달 이익단체가 찾아오나(18개월에 한 번까지, 달마다 5%). */
export function lobbyDue(s: LobbySave, date: string, rng: () => number): boolean {
  if (s.offer) return false; if (s.last && monthsBetween(s.last, date) < LOBBY.gapMonths) return false;
  return rng() < LOBBY.chance;
}
/** 제안 만들기: 파벌 가운데 하나를 골라(지지가 클수록 자주) 그 성향의 단체가 온다. 금액은 월 에너지 수입 × 6(모르면 300 + 2200년부터 해마다 12), 뒷돈은 1.3배. */
export function makeOffer(factions: Array<{ fid?: number; ethic: string; support: number }>, energyIncome: number | null, date: string, rng: () => number): Offer | null {
  const pool = factions.filter((f) => GROUPS[f.ethic]); if (!pool.length) return null;
  const sum = pool.reduce((a, f) => a + Math.max(1, f.support), 0); let x = rng() * sum, pickF = pool[0];
  for (const f of pool) { x -= Math.max(1, f.support); if (x <= 0) { pickF = f; break; } }
  const kind: LobbyKind = rng() < 0.5 ? 'official' : 'bribe';
  const yr = Number(/^(\d+)/.exec(date || '')?.[1]) || 2200, fallback = 300 + Math.max(0, yr - 2200) * 12; // 수입을 모르면 게임 연도로 키운다(후반일수록 큰돈)
  const base = (energyIncome && energyIncome > 0 ? energyIncome * 6 : fallback) * (kind === 'bribe' ? 1.3 : 1);
  const amount = Math.max(150, Math.min(5000, Math.round(base / 50) * 50));
  const opp = OPPOSITE[pickF.ethic], spurn = factions.filter((f) => f.ethic === opp && f.fid).map((f) => f.fid!) ;
  const g = GROUPS[pickF.ethic];
  return { id: `${date}-${Math.floor(rng() * 1e6)}`, date, kind, ethic: pickF.ethic, group: L(g.ko, g.en), amount, ...(pickF.fid ? { fav: pickF.fid } : {}), ...(spurn.length ? { spurn } : {}) };
}
export const offerExpired = (o: Offer, date: string) => monthsBetween(o.date, date) >= LOBBY.answerMonths;
/** 제안 문구(화면 언어). */
export function offerText(o: Offer): string {
  const g = GROUPS[o.ethic], want = g ? L(g.wantKo, g.wantEn) : '';
  return o.kind === 'official'
    ? L(`「${o.group}」 대표단이 정식으로 면담을 청했습니다. 국고에 에너지 ${o.amount}을(를) 공식 후원하겠다며, ${want}고 요청합니다. 후원 내역은 공개됩니다.`, `A delegation from the ${o.group} has formally requested an audience. They offer an official donation of ${o.amount} energy to the treasury and ask for ${want}. The donation will be on public record.`)
    : L(`「${o.group}」의 한 인사가 늦은 밤 몰래 찾아왔습니다. 에너지 ${o.amount}을(를) 통치자 개인 금고에 넣어 주겠다며, ${want}고 속삭입니다. 아무도 모를 거라고 합니다.`, `A man from the ${o.group} slipped in late at night. He offers ${o.amount} energy for your private vault and whispers that they want ${want}. Nobody will ever know, he says.`);
}
/** 뒷돈을 받으면 들킬지 미리 정한다(6~24개월 뒤 판정). 부패 낌새가 쌓일수록 잘 들킨다. */
export function exposeRoll(susp: number, date: string, rng: () => number): { exposeAt: string; exposed: boolean } {
  const p = Math.min(0.85, LOBBY.bribeExposeBase + Math.max(0, susp) * LOBBY.bribeExposePerSusp);
  const m = LOBBY.exposeMinMonths + Math.floor(rng() * (LOBBY.exposeMaxMonths - LOBBY.exposeMinMonths + 1));
  const y = /^(\d+)\.(\d+)/.exec(date || ''); let at = date;
  if (y) { const t = Number(y[1]) * 12 + Number(y[2]) - 1 + m; at = `${Math.floor(t / 12)}.${String((t % 12) + 1).padStart(2, '0')}.01`; }
  return { exposeAt: at, exposed: rng() < p };
}
/** 연대기 한 줄(신문·국정감사 재료). 공식 후원과 고발·발각만 남긴다(몰래 받은 뒷돈은 들키기 전엔 기록이 없다). */
export function lobbyChron(r: LobbyRec, kind: 'official' | 'reported' | 'exposed'): string {
  if (kind === 'official') return L(`${r.answered} 정부가 「${r.group}」의 공식 후원(에너지 ${r.amount})을 받았다.`, `${r.answered} The government accepted an official donation from the ${r.group} (${r.amount} energy).`);
  if (kind === 'reported') return L(`${r.answered} 통치자가 「${r.group}」의 뇌물 제안을 공개 고발했다.`, `${r.answered} The ruler publicly exposed a bribe offered by the ${r.group}.`);
  return L(`통치자가 「${r.group}」에게서 몰래 에너지 ${r.amount}을(를) 받은 사실이 드러났다(${r.answered}). 뇌물 스캔들이 번지고 있다.`, `It came out that the ruler secretly took ${r.amount} energy from the ${r.group} (${r.answered}). A bribery scandal is spreading.`);
}
/** 게임 명령: 국고 에너지(공식 후원만) + 파벌 승인도(좋아함/싫어함 수정자). 회신은 SLLM:CIVIC(what=lobby). */
export function lobbyCommand(req: number, sid: string, energy: number, fav: number | undefined, spurn: number[] | undefined): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(energy) || energy < 0 || energy > 100000) throw new Error(L('로비 명령 인자가 올바르지 않습니다.', 'Invalid lobby command arguments.'));
  const ids = (a: number[]) => a.filter((x) => Number.isSafeInteger(x) && x > 0);
  const fac = (list: number[], mod: string) => list.length ? ` every_pop_faction = { limit = { OR = { ${list.map((i) => `check_variable = { which = sllm_f_id value = ${i} }`).join(' ')} } } remove_modifier = ${mod} add_modifier = { modifier = ${mod} days = ${LOBBY.modDays} } }` : '';
  const log = `log = "SLLM:CIVIC/;/req=${req}/;/sid=${sid}/;/what=lobby/;/status=applied"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${energy ? `add_resource = { energy = ${energy} } ` : ''}${fac(ids(fav ? [fav] : []), LOBBY.favMod)}${fac(ids(spurn ?? []), LOBBY.spurnMod)} ${log} }`;
}
export function lobbyFact(r: LobbyRec): string {
  return r.kind === 'official' ? `${r.answered}: ${r.answer} an official donation from the ${r.group} (${r.amount} energy).`
    : r.answer === 'accepted' ? `${r.answered}: the ruler secretly took ${r.amount} energy from the ${r.group}${r.exposed && r.status === 'exposed' ? ' — it has been exposed' : ' (still secret)'}.` : `${r.answered}: ${r.answer} a bribe from the ${r.group}.`;
}
