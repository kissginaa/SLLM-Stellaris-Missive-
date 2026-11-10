// 원시문명 개입(2026-11-03 사용자 결정 ③). 게임에 이미 있는 원시문명 첩보 작전(인지도 올리기·허위 정보·첨단 지식 심기·세뇌·침투)과
// 역병 상황의 바닐라 대응(approach)은 그대로 두고, 그것과 겹치지 않는 앱 쪽 개입만 둔다. 모두 우리 관측소가 있어야 한다.
// 모드: common/scripted_effects/sllm_probe_preftl.txt sllm_preftl_act(회신 PFTLACT). 앱: src/features/preftl-app.ts. 화면: ui/office-preftl.js.
// 은하 공동체 「불간섭」 결의안이 통과돼 있으면 경고만 한다(바닐라 벌금 판정은 게임이 따로 한다).
import { L } from './i18n-pick';
import { type Civ, AGE_MAX } from './preftl';
import { monthsBetween } from './letters';
import { type Standoff, SO, soActive, soStage } from './preftl-standoff';

export type ActKey = 'tech' | 'aid' | 'expose' | 'cover' | 'calm' | 'stoke' | 'disarm' | 'm_passive' | 'm_specimen' | 'm_none';
export interface ActDef { key: ActKey; w: number; ko: string; en: string; descKo: string; descEn: string; energy: number; cooldownMonths: number; mission?: number; loud?: boolean }
export const ACTS: Record<ActKey, ActDef> = {
  tech: { key: 'tech', w: 1, ko: '기술 선물', en: 'Gift of technology', descKo: '몰래 지식을 흘려 다음 시대로 끌어올립니다. 인지도 +20.', descEn: 'Quietly leak knowledge to lift them into the next age. Awareness +20.', energy: 500, cooldownMonths: 120, loud: true },
  aid: { key: 'aid', w: 2, ko: '역병 의료 지원', en: 'Plague medical aid', descKo: '치료제를 몰래 퍼뜨려 역병 진행을 늦춥니다(역병 진행 −20). 인지도 +10.', descEn: 'Secretly spread a cure to slow the plague (plague progress −20). Awareness +10.', energy: 300, cooldownMonths: 6, loud: true },
  expose: { key: 'expose', w: 3, ko: '고의 노출', en: 'Deliberate sighting', descKo: '관측선을 일부러 하늘에 드러냅니다. 인지도 +15.', descEn: 'Let an observation craft be seen on purpose. Awareness +15.', energy: 0, cooldownMonths: 12, loud: true },
  cover: { key: 'cover', w: 4, ko: '은폐 작전', en: 'Cover-up operation', descKo: '목격담을 덮고 증거를 치웁니다. 인지도 −10.', descEn: 'Bury the sightings and remove the evidence. Awareness −10.', energy: 250, cooldownMonths: 24 },
  // 핵 대치(2026-11-05, src/preftl-standoff.ts): 대치 중일 때만. 긴장 변화는 앱이 계산(게임은 비용·인지도만).
  calm: { key: 'calm', w: 21, ko: '긴장 완화 공작', en: 'Easing operation', descKo: `양쪽 지도부 사이에 몰래 대화 창구를 엽니다. 긴장 ${SO.act.calm}.`, descEn: `Quietly open a back channel between their leaders. Tension ${SO.act.calm}.`, energy: 200, cooldownMonths: 12 },
  stoke: { key: 'stoke', w: 22, ko: '긴장 고조 공작', en: 'Stoking operation', descKo: `가짜 경보와 첩보를 흘려 서로를 의심하게 합니다. 긴장 +${SO.act.stoke}.`, descEn: `Leak false alarms and intelligence so they suspect each other. Tension +${SO.act.stoke}.`, energy: 150, cooldownMonths: 12 },
  disarm: { key: 'disarm', w: 23, ko: '핵무기 무력화', en: 'Nuclear sabotage', descKo: `일촉즉발일 때만. 발사 체계를 몰래 망가뜨립니다. ${Math.round(SO.act.disarmChance * 100)}% 성공: 긴장 ${SO.act.disarmOk} · 실패: 긴장 +${SO.act.disarmFail}, 들켜서 인지도 +15.`, descEn: `Only on the brink. Secretly cripple their launch systems. ${Math.round(SO.act.disarmChance * 100)}% success: tension ${SO.act.disarmOk} · failure: tension +${SO.act.disarmFail} and awareness +15 when they notice.`, energy: 600, cooldownMonths: 60, loud: true },
  m_passive: { key: 'm_passive', w: 11, ko: '수동 관찰', en: 'Passive observation', descKo: '', descEn: '', energy: 0, cooldownMonths: 0, mission: 1 },
  m_specimen: { key: 'm_specimen', w: 12, ko: '표본 수집', en: 'Specimen collection', descKo: '', descEn: '', energy: 0, cooldownMonths: 0, mission: 2 },
  m_none: { key: 'm_none', w: 13, ko: '관측 중단', en: 'Suspend observation', descKo: '', descEn: '', energy: 0, cooldownMonths: 0, mission: 3 },
};
export const isActKey = (v: unknown): v is ActKey => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACTS, v);

/** 지금 할 수 없는 이유(화면 문구) 또는 ''. last = 이 문명에 마지막으로 그 개입을 한 날. */
export function actBlock(c: Civ, key: ActKey, last: string | undefined, date: string, so?: Standoff): string {
  const a = ACTS[key];
  if ((key === 'calm' || key === 'stoke' || key === 'disarm') && !soActive(so)) return L('핵 대치 중이 아닙니다.', 'There is no nuclear standoff.');
  if (key === 'disarm' && soActive(so) && soStage(so.t) !== 2) return L('일촉즉발일 때만 할 수 있습니다.', 'Only when they are on the brink.');
  if (c.gone) return L('더는 원시문명이 아닙니다.', 'They are no longer a pre-FTL civilization.');
  if (c.obs !== 1) return L('우리 관측소가 있어야 개입할 수 있습니다.', 'We need our own observation post to intervene.');
  if (a.mission) {
    if (c.lv >= 4) return L('그들이 우리를 완전히 알게 되어 관측 임무가 끝났습니다.', 'They fully know about us; observation missions have ended.');
    if (c.mis === a.mission) return L('지금 이 임무를 하고 있습니다.', 'This is the current mission.');
    return '';
  }
  if (key === 'tech' && c.age >= AGE_MAX) return L('마지막 시대입니다. 더 끌어올리면 정식 제국이 됩니다.', 'This is their last age; lifting them further would make them a star empire.');
  if (key === 'aid' && c.sit !== 1) return L('지금 역병이 돌고 있지 않습니다.', 'There is no plague right now.');
  if ((key === 'expose' || key === 'cover') && c.lv >= 4) return L('이미 우리를 완전히 압니다.', 'They already know about us completely.');
  if (key === 'cover' && c.aw <= 0) return L('덮을 목격담이 없습니다.', 'There are no sightings to cover up.');
  if (last && a.cooldownMonths && monthsBetween(last, date) < a.cooldownMonths) {
    const left = a.cooldownMonths - monthsBetween(last, date);
    return L(`다시 하려면 ${left}개월 더 기다려야 합니다.`, `Wait ${left} more month(s) before doing this again.`);
  }
  return '';
}

/** 게임 회신 st → 결과 문구. */
export function actResult(st: number, key: ActKey): { ok: boolean; text: string } {
  const a = ACTS[key];
  switch (st) {
    case 1: return { ok: true, text: a.mission ? L(`관측소 임무를 「${a.ko}」(으)로 바꿨습니다.`, `Observation post mission changed to "${a.en}".`) : L(`「${a.ko}」을(를) 실행했습니다.${a.energy ? ` 에너지 ${a.energy}을(를) 썼습니다.` : ''}`, `Carried out "${a.en}".${a.energy ? ` Spent ${a.energy} energy.` : ''}`) };
    case 2: return { ok: false, text: L('그 원시문명을 게임에서 찾지 못했습니다. 새로 관측해 주세요.', 'That civilization was not found in the game. Observe again.') };
    case 3: return { ok: false, text: L(`에너지가 모자랍니다(${a.energy} 필요).`, `Not enough energy (${a.energy} needed).`) };
    case 4: return { ok: false, text: L('게임에서 지금은 할 수 없다고 답했습니다(시대·역병·인지도를 다시 확인해 주세요).', 'The game says this cannot be done right now (check their age, plague or awareness).') };
    case 5: return { ok: false, text: L('그 행성 궤도에 우리 관측소가 없습니다.', 'We have no observation post over their world.') };
    case 6: return { ok: false, text: L('표본 수집은 「적극적 간섭」이나 「공격적 간섭」 정책일 때만 할 수 있습니다.', 'Specimen collection needs the Active or Aggressive Interference policy.') };
    default: return { ok: false, text: L('게임 응답을 이해하지 못했습니다.', 'Could not understand the game\'s reply.') };
  }
}

/** 개입 명령(플레이어 나라, 이 세이브에서만). */
export function actCommand(req: number, sid: string, id: number, key: ActKey, failed = false): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(id) || id < 1 || !isActKey(key)) throw new Error(L('개입 명령 인자가 올바르지 않습니다.', 'Invalid intervention command arguments.'));
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } sllm_preftl_act = { REQ = ${req} ID = ${id} W = ${key === 'disarm' && failed ? 24 : ACTS[key].w} } }`;
}

/** 결의안 경고(PFTL_END ni). */
export function resolutionWarning(ni: number): string {
  if (ni === 1) return L('은하 공동체 「불간섭」 결의안이 통과돼 있습니다. 눈에 띄는 개입(기술 선물·의료 지원·고의 노출)은 결의안 위반으로 벌금을 물 수 있습니다.', 'The Galactic Community\'s Non-Interference resolution is in force. Visible interventions (technology gift, medical aid, deliberate sighting) may be treated as a breach and fined.');
  if (ni === 2) return L('은하 공동체 「동등한 지위」 결의안이 통과돼 있습니다. 원시문명을 함부로 다루면 결의안 위반이 될 수 있습니다.', 'The Galactic Community\'s Equal Standing resolution is in force. Mistreating pre-FTL peoples may count as a breach.');
  return '';
}
