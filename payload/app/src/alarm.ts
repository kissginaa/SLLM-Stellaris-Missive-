// 일정표·쿨다운 알림(2026-11-04 사용자: 다른 모드 「Alarm Clock」에서 1·2·3 채용) — 순수 규칙. 앱: src/features/alarm-app.ts · 화면: ui/office-alarm.js · 모드: common/scripted_effects/sllm_alarm.txt
// ① 게임이 숨겨 둔 재사용 대기(시간 제한 표식·시간 제한 수정자)를 매달 한 번 읽어 남은 날을 정확히 안다(게임 명령 1번, 플레이어 나라만).
//    + 우리 앱 기능의 대기(성계 이양·기술 원조·동화 정책 다음 단계·여론 공작 냉각)도 같은 표에. 날이 오면 집무실 알림 + 비서 보고 항목.
// ② 우리 기능(동화 정책 다음 단계·기술 원조 재사용)은 게임 「상황」 화면에도 남은 날 막대로(sllm_alarm_situations.txt).
// ③ 앱 쿨다운을 게임 쪽 시간 제한 표식으로 두고 그 남은 날을 읽는다 → 세이브를 되돌려도 맞다.
// 목록 출처: Alarm Clock(Mysterywisc)의 카탈로그를 사람이 옮겨 적음(이름·표식만, 코드는 가져오지 않음).

export type AlarmKind = 'f' | 'm'; // f = 시간 제한 나라 표식 · m = 시간 제한 수정자
export interface AlarmDef { key: string; kind: AlarmKind; ko: string; en: string; cat: 'psi' | 'shadow' | 'spy' | 'enclave' | 'relic' | 'leader' | 'planet' | 'misc' | 'sit' }
const F = (key: string, ko: string, en: string, cat: AlarmDef['cat']): AlarmDef => ({ key, kind: 'f', ko, en, cat });
const M = (key: string, ko: string, en: string, cat: AlarmDef['cat']): AlarmDef => ({ key, kind: 'm', ko, en, cat });

/** 바닐라 쿨다운 목록. ko/en = 「다시 할 수 있게 되는 것」. */
export const VANILLA: AlarmDef[] = [
  ...Array.from({ length: 9 }, (_, i) => F(`generic_vision_${i + 1}_cooldown`, `장막 탐사 ${i + 1}번 자리`, `Shroud delve slot ${i + 1}`, 'psi')),
  F('aura_amplification_cooldown', '오라 증폭', 'Aura amplification', 'psi'),
  F('animator_of_clay_cooldown', '흙의 조형자 소환', 'Animator of Clay', 'psi'),
  F('shroud_seals_disabled_timer', '장막 봉인 사용', 'Shroud seals', 'psi'),
  F('proxy_war_cooldown', '대리전 선동', 'Instigate proxy war', 'psi'),
  F('mindwarden_raid_cooldown', '마인드워든 습격', 'Mindwarden raid', 'shadow'),
  F('mindwarden_zro_cooldown', '마인드워든 즈로 추출', 'Mindwarden zro extraction', 'shadow'),
  F('mindwarden_decision_cooldown', '마인드워든 결의안', 'Mindwarden decision', 'shadow'),
  F('mindwarden_army_cooldown', '마인드워든 군대 소집', 'Mindwarden army raising', 'shadow'),
  F('mindwarden_commander_cooldown', '마인드워든 지휘관 소환', 'Mindwarden commander', 'shadow'),
  F('mindwarden_logistics_cooldown', '마인드워든 보급', 'Mindwarden logistics', 'shadow'),
  F('mindwarden_enclave_capacity_bought_timer', '마인드워든 고립 거주지 수용량 구매', 'Mindwarden enclave capacity', 'shadow'),
  F('recently_stole_technology', '기술 탈취 작전', 'Steal Technology', 'spy'),
  F('operation_diplomatic_incident_timer', '외교 사건 조작 작전', 'Spark Diplomatic Incident', 'spy'),
  F('sleeper_cell_success', '잠복 세포 활성화', 'Sleeper cell activation', 'spy'),
  F('target_of_operation_arm_privateers', '우리를 노린 사략선 무장 작전 종료', 'Arm Privateers against us ends', 'spy'),
  F('crisis_beacon_timer', '위기 신호기', 'Crisis beacon', 'spy'),
  F('recently_received_espionage_asset', '첩보 자산 받기', 'Receiving an espionage asset', 'spy'),
  F('recently_dropped_finderskeepers', '파인더스 키퍼스 정보 넘기기', 'Dropping Finders Keepers intel', 'spy'),
  F('recently_received_finderskeepers', '파인더스 키퍼스 정보 받기', 'Receiving Finders Keepers intel', 'spy'),
  F('shroudwalker_insight_cooldown', '장막 보행자의 통찰', 'Shroudwalker insight', 'enclave'),
  F('shroudwalker_teacher_cooldown', '장막 보행자 스승', 'Shroudwalker teacher', 'enclave'),
  F('shroudwalker_divination_timer', '장막 보행자 점술', 'Shroudwalker divination', 'enclave'),
  F('salvager_enclave_recently_reclaimed_destroyer', '인양업자 구축함 인양', 'Salvager: reclaim a destroyer', 'enclave'),
  F('salvager_enclave_recently_reclaimed_cruiser', '인양업자 순양함 인양', 'Salvager: reclaim a cruiser', 'enclave'),
  F('salvager_enclave_recently_reclaimed_battleship', '인양업자 전함 인양', 'Salvager: reclaim a battleship', 'enclave'),
  F('salvager_enclave_recently_reclaimed_all', '인양업자 전체 인양', 'Salvager: full salvage', 'enclave'),
  F('salvager_enclave_recently_scrapped', '인양업자 해체', 'Salvager scrapping', 'enclave'),
  F('salvager_overdrive_timer', '인양업자 과부하', 'Salvager overdrive', 'enclave'),
  F('curator_guidance_cooldown', '큐레이터 조언', 'Curator guidance', 'enclave'),
  F('hosting_cfl_cooldown', '챔피언 대회 개최', 'Hosting the Champion\'s Forge', 'enclave'),
  F('dreamers_wake_cooldown', '몽상가의 각성', 'Dreamers Wake', 'enclave'),
  F('mind_wipe_cooldown', '기억 지우기', 'Mind Wipe', 'enclave'),
  F('updating_databanks_timer', '데이터 뱅크 갱신', 'Databank updating', 'enclave'),
  F('strange_manifestations_cooldown', '기이한 현상', 'Strange manifestations', 'enclave'),
  F('lateral_artifacting_available', '측면 유물 연구', 'Lateral artifacting', 'relic'),
  F('relic_cs_trigger', '유물 발동', 'Relic activation', 'relic'),
  F('relic_last_baol_activated', '바올 유물 발동', 'Baol relic activation', 'relic'),
  F('leader_recruited_recently', '지도자 영입', 'Leader recruitment', 'leader'),
  F('recently_had_leader_funeral', '지도자 장례식', 'Leader funeral', 'leader'),
  F('beholder_psi_pops_cooldown_timer', '주시자의 사이오닉 인구', 'Beholder psionic pops', 'leader'),
  F('idyllic_bloom_holding_timer', '목가적 개화', 'Idyllic Bloom', 'planet'),
  F('gaia_seeder_bloom_timer', '가이아 파종', 'Gaia seeding', 'planet'),
  F('necrophage_elevation_timer', '네크로파지 승격', 'Necrophage elevation', 'planet'),
  F('reemployment_center_timer', '재취업 센터', 'Reemployment center', 'planet'),
  F('situation_paperclips_timer', '페이퍼클립 상황 시한', 'Paperclips situation timer', 'planet'),
  F('festival_cooldown', '유랑민 축제', 'Nomad festival', 'misc'),
  F('nomadic_paragon_cooldown', '유랑 영웅', 'Nomadic paragon', 'misc'),
  F('lootboxed_recently', '캐러밴 보물 상자', 'Caravaneer Reliquary', 'misc'),
  F('payback_debt_collectors_timer', '빚 수금업자 상환 시한', 'Debt collectors payback', 'misc'),
  F('planet_roots_success', '행성 뿌리 내리기', 'Embed planetary roots', 'misc'),
  F('intensification_cooldown_timer', '후원 협정 재가동', 'Patron accord reactivation', 'misc'),
  F('indoctrination_cooldown', '원시문명 세뇌', 'Pre-FTL indoctrination', 'misc'),
  F('criminal_branch_closed_cooldown', '범죄 지사 폐쇄 대기', 'Criminal branch office cooldown', 'misc'),
  F('dragon_materials_cooldown', '용 재료', 'Dragon materials', 'misc'),
  F('raid_cooldown', '약탈자가 다시 습격할 수 있음(경계)', 'Marauders can raid again (warning)', 'misc'),
  F('recently_raided_or_threatened', '약탈자 위협 유예 끝(경계)', 'Marauder threat window ends (warning)', 'misc'),
  F('upgraded_station_timer', '정거장 개량', 'Station upgrading', 'misc'),
  F('approach_shroud_forged_cooldown_appease_flag', '장막 단련자: 달래기', 'Shroud-Forged: Appease', 'sit'),
  F('approach_shroud_forged_cooldown_support_flag', '장막 단련자: 지원', 'Shroud-Forged: Support', 'sit'),
  F('approach_shroud_forged_cooldown_suppress_flag', '장막 단련자: 억압', 'Shroud-Forged: Suppress', 'sit'),
  F('approach_breach_shroud_endbringers_cooldown_blind_flag', '종말을 부르는 자: 눈가림', 'Endbringers: Blind', 'sit'),
  F('approach_breach_shroud_endbringers_cooldown_forsake_flag', '종말을 부르는 자: 저버림', 'Endbringers: Forsake', 'sit'),
  F('approach_breach_shroud_endbringers_cooldown_wait_flag', '종말을 부르는 자: 기다림', 'Endbringers: Wait', 'sit'),
  M('celebrate_diversity', '다양성 기념', 'Celebrate Diversity', 'relic'),
  M('proclaim_religious_finding', '종교적 계시 선포', 'Proclaim Religious Revelation', 'relic'),
  M('proclaim_superiority', '우월성 선포', 'Proclaim Superiority', 'relic'),
  M('arcane_deciphering_cooldown', '비전 해독', 'Arcane Deciphering', 'relic'),
  M('artifact_find_applications_cooldown', '응용법 찾기', 'Find Applications', 'relic'),
  M('artifact_lgate_insight_cooldown', 'L-관문 통찰', 'L-Gate Insight', 'relic'),
  M('artifact_precursor_insight_cooldown', '선구자 통찰', 'Precursor Insight', 'relic'),
  M('artifact_sell_cooldown', '작은 유물 팔기', 'Selling minor artifacts', 'relic'),
  M('relic_activation_cooldown', '유물 발동', 'Relic activation', 'relic'),
];
/** 우리 앱 기능의 대기(게임 쪽 시간 제한 표식). own = 우리 나라에 붙음, sub = 종속국에 붙음(로그에 그 나라 번호). */
export const OWN: AlarmDef[] = [F('sllm_cy_cooldown', '해외발 여론 공작이 다시 시작될 수 있음(경계)', 'A foreign disinformation campaign can start again (warning)', 'spy')];
export const SUB: AlarmDef[] = [F('sllm_va_tech_cd', '기술 원조', 'Technology aid', 'misc'), F('sllm_va_assim_cd', '동화 정책 다음 단계', 'Next assimilation step', 'misc')];
export const ALL = [...VANILLA, ...OWN, ...SUB];
export const defOf = (key: string): AlarmDef | undefined => ALL.find((d) => d.key === key);

/** 쿨다운 읽기 명령(매달 한 번). 줄: ALARM(k, d, v=종속국 번호) … ALARMEND. 게임 효과는 모드 sllm_alarm_scan(생성기: 이 목록과 같아야 함 — 자가 점검). */
export function scanCommand(req: number, sid: string): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid)) throw new Error('INVALID_ALARM');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } sllm_alarm_scan = { REQ = ${req} } }`;
}
/** 모드 효과 본문(생성): 표식은 timed_flag_days_left, 수정자는 export_modifier_duration_to_variable. */
export function scanEffectText(): string {
  const flag = (d: AlarmDef, who: string, extra: string) => `\tif = {\n\t\tlimit = { has_country_flag = ${d.key} }\n\t\texport_trigger_value_to_variable = { trigger = timed_flag_days_left parameters = { flag = ${d.key} } variable = sllm_al_d }\n\t\t${who}log = "SLLM:ALARM/;/req=\\\\[Root.sllm_al_req]/;/k=${d.key}/;/d=\\\\[This.sllm_al_d]${extra}"${who ? ' }' : ''}\n\t}`;
  const mod = (d: AlarmDef) => `\tif = {\n\t\tlimit = { has_modifier = ${d.key} }\n\t\texport_modifier_duration_to_variable = { modifier = ${d.key} variable = sllm_al_d }\n\t\tlog = "SLLM:ALARM/;/req=\\\\[Root.sllm_al_req]/;/k=${d.key}/;/d=\\\\[This.sllm_al_d]"\n\t}`;
  const own = [...VANILLA, ...OWN].map((d) => (d.kind === 'm' ? mod(d) : flag(d, '', ''))).join('\n');
  const sub = SUB.map((d) => `\t\tif = {\n\t\t\tlimit = { has_country_flag = ${d.key} }\n\t\t\texport_trigger_value_to_variable = { trigger = timed_flag_days_left parameters = { flag = ${d.key} } variable = sllm_al_d }\n\t\t\tlog = "SLLM:ALARM/;/req=\\\\[Root.sllm_al_req]/;/k=${d.key}/;/d=\\\\[This.sllm_al_d]/;/v=\\\\[This.sllm_idx]"\n\t\t}`).join('\n');
  return [
    '# 생성됨(src/alarm.ts scanEffectText) — 목록을 고치면 앱 자가 점검이 다시 맞춘 내용을 요구한다. 손으로 고치지 말 것.',
    '# 일정표·쿨다운 알림(2026-11-04). 앱 src/features/alarm-app.ts 가 매달 한 번 every_playable_country(플레이어) 안에서 부른다.',
    'sllm_alarm_scan = {',
    '\tset_variable = { which = sllm_al_req value = $REQ$ }',
    own,
    '\tevery_subject = {',
    '\t\tlimit = { is_variable_set = sllm_idx }',
    sub,
    '\t}',
    '\tlog = "SLLM:ALARMEND/;/req=\\\\[This.sllm_al_req]/;/sid=\\\\[This.sllm_save_id]"',
    '}',
    '',
  ].join('\n');
}

export interface AlarmLine { key: string; days: number; v: number }
export function readAlarm(kv: Record<string, string>): AlarmLine | null {
  const k = String(kv.k ?? '').replace(/^\\/, '').trim(), d = Number(String(kv.d ?? '').replace(/^\\/, '').replace(/,/g, '')), v = Math.round(Number(String(kv.v ?? '0').replace(/^\\/, '')) || 0);
  if (!defOf(k) || !Number.isFinite(d) || d <= 0) return null;
  return { key: k, days: Math.round(d), v: v > 0 ? v : 0 };
}

// 날짜(게임 30일 달, 360일 해)
export const dayNo = (d: string): number | null => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec((d || '').trim()); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : null; };
export const dateOf = (n: number): string => { const y = Math.floor(n / 360), r = n - y * 360, mo = Math.floor(r / 30) + 1, d = r - (mo - 1) * 30 + 1; return `${y}.${String(mo).padStart(2, '0')}.${String(d).padStart(2, '0')}`; };
export const addDays = (d: string, n: number): string => { const x = dayNo(d); return x === null ? d : dateOf(x + Math.round(n)); };

/** 일정 한 줄. id = 키(+종속국 번호). due = 다시 되는 날. */
export interface Alarm { id: string; key: string; v: number; vname?: string; due: string; total: number; from: 'game' | 'app'; rang?: boolean; label?: [string, string] }
export const alarmId = (key: string, v: number): string => (v ? `${key}:${v}` : key);
/** 이번 읽기 결과 → 일정 표 갱신. 게임에 없는 게임 쪽 항목은 끝난 것(세이브를 되돌려도 맞게, ③). 새로 끝난 것 = 울릴 것. */
export function mergeScan(prev: Alarm[], lines: AlarmLine[], now: string): { list: Alarm[]; ring: Alarm[] } {
  const ring: Alarm[] = [], list: Alarm[] = [], seen = new Set<string>();
  for (const l of lines) {
    const id = alarmId(l.key, l.v); if (seen.has(id)) continue; seen.add(id);
    const old = prev.find((a) => a.id === id), due = addDays(now, l.days);
    list.push({ id, key: l.key, v: l.v, vname: old?.vname, due, total: old && old.due === due ? old.total : Math.max(l.days, old?.total ?? 0, l.days), from: 'game' });
  }
  for (const a of prev) {
    if (seen.has(a.id)) continue;
    if (a.from === 'app') { list.push(a); continue; } // 앱이 직접 적은 일정(성계 이양 등)은 날짜로만 끝난다
    if (!a.rang) ring.push({ ...a, rang: true }); // 게임에서 사라짐 = 다시 됨
  }
  for (const a of list) if (a.from === 'app' && !a.rang) { const x = dayNo(a.due), n = dayNo(now); if (x !== null && n !== null && n >= x) { a.rang = true; ring.push(a); } }
  return { list: list.filter((a) => !(a.from === 'app' && a.rang)), ring };
}
/** 다시 읽지 않는 달(2026-11-09 회랑 방식): 지난번에 읽어 둔 날짜로만 울린다 — 게임에 묻지 않는다.
 *  날이 된 항목은 울리고 표에서 뺀다(다음 읽기 때 게임에 아직 남아 있으면 다시 들어온다). */
export function ringByDate(prev: Alarm[], now: string): { list: Alarm[]; ring: Alarm[] } {
  const n = dayNo(now), ring: Alarm[] = [], list: Alarm[] = [];
  for (const a of prev) { const x = dayNo(a.due); if (n !== null && x !== null && n >= x && !a.rang) ring.push({ ...a, rang: true }); else list.push(a); }
  return { list, ring };
}
/** 'YYYY.MM' 두 달 사이 달 수(모르면 큰 수 — 다시 읽게). */
export function monthsApart(a: string, b: string): number { const p = (s: string) => { const m = /^(\d+)\.(\d+)/.exec(s || ''); return m ? Number(m[1]) * 12 + Number(m[2]) : NaN; }; const x = p(a), y = p(b); return Number.isFinite(x) && Number.isFinite(y) ? y - x : 999; }
/** 모드를 다시 읽는 간격(달). 그 사이에는 날짜로만 울리고, 세이브를 불러오거나 일정표를 열면(그달 처음) 바로 읽는다. */
export const ALARM_RESCAN_MONTHS = 12;
/** 남은 날(음수면 0). */
export const daysLeft = (a: Alarm, now: string): number => { const x = dayNo(a.due), n = dayNo(now); return x === null || n === null ? 0 : Math.max(0, x - n); };
export const labelOf = (a: Alarm): [string, string] => { if (a.label) return a.label; const d = defOf(a.key); const base: [string, string] = d ? [d.ko, d.en] : [a.key, a.key]; return a.vname ? [`${base[0]} — ${a.vname}`, `${base[1]} — ${a.vname}`] : base; };

/** 비서 보고용(영어 사실): 이번 달 다시 된 것 + 곧(60일 안) 될 것. */
export function briefFacts(ring: Alarm[], list: Alarm[], now: string): { ready: string[]; soon: string[] } {
  return { ready: ring.map((a) => labelOf(a)[1]).slice(0, 6), soon: list.filter((a) => daysLeft(a, now) <= 60).sort((a, b) => daysLeft(a, now) - daysLeft(b, now)).slice(0, 4).map((a) => `${labelOf(a)[1]} in ${daysLeft(a, now)} days`) };
}

// ② 게임 「상황」 막대(우리 기능): 시작·치우기 명령. TYPE = assim | vatech, IDX = 종속국 번호, DAYS = 남은 날.
export function situationCommand(req: number, sid: string, type: 'assim' | 'vatech', idx: number, days: number, on: boolean): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || (type !== 'assim' && type !== 'vatech') || !Number.isSafeInteger(idx) || idx < 1 || !Number.isSafeInteger(days) || days < 1 || days > 3600) throw new Error('INVALID_ALARM');
  const target = `random_country = { limit = { is_variable_set = sllm_idx check_variable = { which = sllm_idx value = ${idx} } } save_event_target_as = sllm_al_t }`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${target} ${on ? 'sllm_alarm_bar_on' : 'sllm_alarm_bar_off'} = { REQ = ${req} TYPE = ${type} IDX = ${idx} DAYS = ${days} } }`;
}
