// 종속국 통치(2026-11-04 사용자: 종속국과의 상호작용을 늘리되 인게임 시스템과 연계되게). 순수 규칙 — 앱: src/features/vassal-court-app.ts, 게임: tester-mod/common/scripted_effects/sllm_vassal_court.txt, 화면: ui/vassal-court.js.
// 1) 조공 감면 요청: 가끔 종속국이 「올해 조공을 덜어 달라」고 청한다(전쟁 중·충성도 낮을 때 더 자주). 전액 = 1년간 매달 에너지 환급(그 나라 월 수입의 15%) + 충성도 매달 +1(1년),
//    절반 = 환급 절반만, 거절 = 충성도 매달 −1(1년). 환급은 게임 안에서 매달 실제로 옮긴다(sllm_vc.1).
// 2) 감독관 파견: 우리 지도자 한 명을 종속국에 보낸다(영향력 50). 그 종속국 충성도 매달 +1.5(sllm_vc_overseer). 감독관은 해마다 보고서(틀 문장)를 보내고,
//    죽거나 물러나면 자동 소환. 지도자 자체는 게임에서 묶지 않는다(앱 표시만).
// 3) 계약 재협상 반응: 게임 외교 화면의 「계약 재협상」이 받아들여지면(on_agreement_change_accepted) 새 조건 아래 월 충성도 방향에 따라 종속국 통치자가 서신(LLM, 기존 서신 틀).
// 문구는 L(한, 영). LLM 은 3)의 서신만(기존 종속국 서신과 같은 방식).
import { L } from './i18n-pick';

export const VC = {
  reliefShare: 0.15,      // 전액 감면 = 그 종속국 월 에너지 수입 × 15%(절반 = 7.5%), 최소 5. 게임이 승인할 때 같은 식으로 다시 계산한다(sllm_vc_calc, 2026-11-04 범위 변수 문법으로 칸 방식 대신 정확한 값)
  reliefGapMonths: 36,    // 한 종속국이 다시 청하기까지 최소 3년
  chanceHard: 1 / 18,     // 매달 확률: 우리가 전쟁 중이거나 충성도 30 미만
  chanceCalm: 1 / 60,     // 그 밖
  overseerCost: 50,       // 감독관 파견 영향력
  overseerLoyalty: 1.5,   // 매달 충성도
  keep: 30,
} as const;
/** 요청 때 보여 줄 예상 액수(게임 계산과 같은 식). */
export function reliefAmounts(income: number): { full: number; half: number } {
  const inc = Number.isFinite(income) ? Math.max(0, income) : 0;
  return { full: Math.max(5, Math.round(inc * VC.reliefShare)), half: Math.max(5, Math.round(inc * VC.reliefShare / 2)) };
}
/** 이번 달 이 종속국이 감면을 청할지(난수 주입). */
export function wantsRelief(o: { loyalty: number | null; atWar: boolean; monthsSinceLast: number; pending: boolean; relieved: boolean }, rnd: () => number = Math.random): boolean {
  if (o.pending || o.relieved || o.monthsSinceLast < VC.reliefGapMonths) return false;
  const hard = o.atWar || (o.loyalty !== null && o.loyalty < 30);
  return rnd() < (hard ? VC.chanceHard : VC.chanceCalm);
}
export const gnum = (v: unknown): number => { const s = String(v ?? '').trim().replace(/,/g, ''); const m = /^(-?[\d.]+)\s*([kKmM]?)$/.exec(s); if (!m) return Number(s) || 0; return Number(m[1]) * (m[2] === 'k' || m[2] === 'K' ? 1e3 : m[2] ? 1e6 : 1); };

// ---- 게임 명령(every_playable_country = 플레이어) ----
const okReq = (req: number) => Number.isSafeInteger(req) && req >= 1;
const okIdx = (idx: number) => Number.isSafeInteger(idx) && idx >= 1;
const wrap = (sid: string, body: string) => { if (!/^\d+$/.test(sid)) throw new Error('INVALID_VC'); return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`; };
export function ctxCommand(req: number, sid: string, idx: number): string { if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VC'); return wrap(sid, `sllm_vc_ctx = { REQ = ${req} TID = ${idx} }`); }
export type ReliefChoice = 'full' | 'half' | 'no';
export function reliefCommand(req: number, sid: string, idx: number, choice: ReliefChoice): string {
  if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VC');
  if (choice === 'no') return wrap(sid, `sllm_vc_refuse = { REQ = ${req} TID = ${idx} }`);
  return wrap(sid, `sllm_vc_grant_${choice === 'full' ? 'full' : 'half'} = { REQ = ${req} TID = ${idx} }`);
}
export function overseerCommand(req: number, sid: string, idx: number, on: boolean): string {
  if (!okReq(req) || !okIdx(idx)) throw new Error('INVALID_VC');
  return wrap(sid, on ? `sllm_vc_overseer_on = { REQ = ${req} TID = ${idx} COST = ${VC.overseerCost} }` : `sllm_vc_overseer_off = { REQ = ${req} TID = ${idx} }`);
}

// ---- 문장(틀) ----
export function reliefLetter(name: string, atWar: boolean, loyalty: number | null): { ko: string; en: string } {
  const why = atWar ? ['전쟁 물자를 대느라 국고가 바닥났습니다', 'supplying your wars has emptied our treasury'] : loyalty !== null && loyalty < 30 ? ['백성들 사이에 불만이 쌓이고 있습니다', 'discontent is growing among our people'] : ['올해 수확과 교역이 좋지 않았습니다', 'this year’s harvests and trade have been poor'];
  return { ko: `${name}의 통치자가 조공 감면을 청합니다 — 「${why[0]}. 올 한 해만이라도 조공의 짐을 덜어 주신다면 그 은혜를 잊지 않겠습니다.」`, en: `The ruler of ${name} asks for tribute relief — “${why[1][0].toUpperCase() + why[1].slice(1)}. If you would lighten our tribute for this one year, we will not forget your kindness.”` };
}
export function reliefResult(name: string, choice: ReliefChoice, amt: number): string {
  if (choice === 'full') return L(`${name}의 조공 감면을 전액 승인했다 — 1년간 매달 에너지 ${amt}을(를) 돌려주고, 충성도가 매달 +1 오른다.`, `Granted ${name} full tribute relief — ${amt} energy returned every month for a year; loyalty +1/month.`);
  if (choice === 'half') return L(`${name}의 조공 감면을 절반만 승인했다 — 1년간 매달 에너지 ${amt}을(를) 돌려준다.`, `Granted ${name} half tribute relief — ${amt} energy returned every month for a year.`);
  return L(`${name}의 조공 감면 요청을 거절했다 — 충성도가 1년간 매달 −1.`, `Refused ${name}'s request for tribute relief — loyalty −1/month for a year.`);
}
/** 감독관 연례 보고(틀 문장). trend = 지난 보고 이후 충성도 변화. */
export function overseerReport(overseer: string, name: string, loyalty: number | null, trend: number | null): string {
  const lv = loyalty === null ? L('알 수 없음', 'unknown') : String(Math.round(loyalty));
  const mood = loyalty === null ? L('이곳 분위기는 아직 가늠하기 어렵습니다.', 'It is still hard to read the mood here.')
    : loyalty >= 60 ? L('궁정은 우리를 믿고 따르고 있습니다.', 'The court trusts and follows us.')
    : loyalty >= 30 ? L('겉으로는 순종하지만, 속을 다 내보이지는 않습니다.', 'They obey outwardly but do not show everything.')
    : loyalty >= 0 ? L('불평이 공공연히 오갑니다. 눈을 떼지 않겠습니다.', 'Complaints are voiced openly. I will keep watch.')
    : L('독립을 입에 올리는 자들이 있습니다. 조치가 필요합니다.', 'Some speak openly of independence. Action is needed.');
  const tr = trend === null ? '' : trend > 2 ? L(` 지난 보고보다 충성도가 ${Math.round(trend)} 올랐습니다.`, ` Loyalty is up ${Math.round(trend)} since my last report.`) : trend < -2 ? L(` 지난 보고보다 충성도가 ${Math.round(-trend)} 떨어졌습니다.`, ` Loyalty is down ${Math.round(-trend)} since my last report.`) : '';
  return L(`감독관 ${overseer}의 연례 보고 — ${name} 충성도 ${lv}. ${mood}${tr}`, `Annual report from overseer ${overseer} — ${name} loyalty ${lv}. ${mood}${tr}`);
}
/** 재협상 반응 서신에 줄 상황(영어, AI 만 읽음). ml = 새 조건 아래 월 충성도 방향(−2..2). */
export function renegotiationSituation(ml: number): { kind: 'thanks' | 'complaint' | 'note'; line: string } {
  if (ml >= 1) return { kind: 'thanks', line: `The overlord just renegotiated our subject agreement. Under the new terms our loyalty is rising (${ml >= 2 ? 'strongly' : 'slightly'}): we find the new terms fair or generous. React to the new agreement in this letter.` };
  if (ml <= -1) return { kind: 'complaint', line: `The overlord just renegotiated our subject agreement. Under the new terms our loyalty is falling (${ml <= -2 ? 'sharply' : 'slightly'}): we find the new terms harsh. React to the new agreement in this letter, with restrained resentment.` };
  return { kind: 'note', line: '' };
}
