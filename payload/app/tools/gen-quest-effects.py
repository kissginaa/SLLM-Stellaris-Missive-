#!/usr/bin/env python3
"""SLLM 퀘스트 효과 엔진 카탈로그 생성기 (2026-10-26, 작업컴 초안 — docs/QUEST_EFFECT_ENGINE_DESIGN_KO.md).
AI 가 퀘스트 보상·불이익의 수치를 정하면, 앱이 1단위 정적 수정자에 multiplier = 단계 수 로 붙인다.
  add_modifier = { modifier = sllm_q3_happiness_p days = 720 multiplier = 6 }   → 인구 행복 +6%
키는 Stellaris 4.5.1 script_docs 덤프(OldEnt/stellaris-triggers-modifiers-effects-list)에 있는 바닐라 이름만 쓴다.
항목 = Cheat Interface(창작마당 3311950726) 전 항목 + 기존 버프 카탈로그 99종.
이름: sllm_q<자리 1~8>_<id>_p (좋은 쪽) / _n (나쁜 쪽). 같은 이름은 다시 걸면 쌓이지 않으므로 퀘스트 자리마다 따로 둔다.
실행: python3 tools/gen-quest-effects.py  → tester-mod/common/static_modifiers/sllm_quest_modifiers.txt,
      tester-mod/localisation/{korean,english}/sllm_quest_l_*.yml, src/quest-catalog.ts
"""
import os, json, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SLOTS = 8
# (id, [키...], 한글, 영문, 묶음, 1단계 값, 좋은 쪽 부호(+1/-1), 최소 단계, 최대 단계, 표시('pct'|'num'))
E = []
def pct(i, k, ko, en, g, good=1, lo=1, hi=15):  # 1단계 = 1%
    E.append((i, k if isinstance(k, list) else [k], ko, en, g, 0.01, good, lo, hi, 'pct'))
def num(i, k, ko, en, g, step, lo, hi, good=1, show='num'):
    E.append((i, k if isinstance(k, list) else [k], ko, en, g, step, good, lo, hi, show))

# ── 경제 ──
for i, k, ko, en in [('energy', 'country_energy_produces_mult', '에너지 생산', 'Energy Output'), ('minerals', 'country_minerals_produces_mult', '광물 생산', 'Minerals Output'),
    ('food', 'country_food_produces_mult', '식량 생산', 'Food Output'), ('alloys', 'country_alloys_produces_mult', '합금 생산', 'Alloys Output'),
    ('goods', 'country_consumer_goods_produces_mult', '소비재 생산', 'Consumer Goods Output'), ('unity', 'country_unity_produces_mult', '통합 생산', 'Unity Output'),
    ('influence', 'country_influence_produces_mult', '영향력 생산', 'Influence Output'), ('trade', 'country_trade_produces_mult', '교역 가치', 'Trade Value'),
    ('gases', 'country_exotic_gases_produces_mult', '이국 기체 생산', 'Exotic Gases Output'), ('motes', 'country_volatile_motes_produces_mult', '휘발성 입자 생산', 'Volatile Motes Output'),
    ('crystals', 'country_rare_crystals_produces_mult', '희귀 결정 생산', 'Rare Crystals Output'), ('nanites', 'country_nanites_produces_mult', '나노 생산', 'Nanites Output'),
    ('darkmatter', 'country_sr_dark_matter_produces_mult', '암흑 물질 생산', 'Dark Matter Output'), ('zro', 'country_sr_zro_produces_mult', '조로 생산', 'Zro Output'),
    ('livingmetal', 'country_sr_living_metal_produces_mult', '살아있는 금속 생산', 'Living Metal Output'), ('artifacts', 'country_minor_artifacts_produces_mult', '소형 유물 생산', 'Minor Artifacts Output')]:
    pct(i, k, ko, en, 'economy')
num('storage', 'country_resource_max_add', '자원 저장 한도', 'Resource Storage', 'economy', 100, 10, 100)
# ── 연구 ──
pct('physics', 'country_physics_research_produces_mult', '물리학 연구 생산', 'Physics Research', 'research')
pct('society', 'country_society_research_produces_mult', '사회학 연구 생산', 'Society Research', 'research')
pct('engineering', 'country_engineering_research_produces_mult', '공학 연구 생산', 'Engineering Research', 'research')
pct('researchspeed', 'all_technology_research_speed', '기술 연구 속도', 'Research Speed', 'research')
num('techchoices', 'num_tech_alternatives_add', '연구 선택지 추가', 'Research Choices', 'research', 1, 1, 2)
# ── 제국 운영 ──
pct('size', 'empire_size_mult', '제국 규모 부담', 'Empire Size', 'empire', -1)
pct('sizepops', 'empire_size_pops_mult', '인구에 따른 제국 규모', 'Empire Size from Pops', 'empire', -1)
pct('sizecol', 'empire_size_colonies_mult', '식민지에 따른 제국 규모', 'Empire Size from Colonies', 'empire', -1)
pct('edictcost', 'edicts_cost_mult', '칙령 비용', 'Edict Cost', 'empire', -1)
num('edictfund', 'country_edict_fund_add', '칙령 기금', 'Edict Fund', 'empire', 10, 1, 10)
pct('tradcost', 'tradition_cost_mult', '전통 비용', 'Tradition Cost', 'empire', -1)
pct('claimcost', 'country_claim_influence_cost_mult', '영유권 주장 비용', 'Claim Cost', 'empire', -1)
pct('agenda', 'council_agenda_progress_speed', '의제 진행 속도', 'Agenda Speed', 'empire')
pct('agendacd', 'council_agenda_cooldown_mult', '의제 재사용 대기', 'Agenda Cooldown', 'empire', -1)
num('approval', 'faction_approval', '파벌 지지', 'Faction Approval', 'empire', 0.01, 1, 15, show='pct')
num('officials', 'country_official_cap_add', '관리 정원', 'Official Cap', 'empire', 1, 1, 2)
num('scientists', 'country_scientist_cap_add', '과학자 정원', 'Scientist Cap', 'empire', 1, 1, 2)
num('commanders', 'country_commander_cap_add', '사령관 정원', 'Commander Cap', 'empire', 1, 1, 2)
pct('terraformcost', 'terraforming_cost_mult', '행성 개조 비용', 'Terraforming Cost', 'empire', -1)
pct('decisionspeed', 'planet_decision_enact_speed_mult', '행성 결정 속도', 'Planetary Decision Speed', 'empire')
# ── 외교·첩보 ──
pct('diploweight', 'diplo_weight_mult', '외교 비중', 'Diplomatic Weight', 'diplomacy')
num('envoys', 'envoys_add', '특사 수', 'Envoys', 'diplomacy', 1, 1, 2)
pct('relations', 'envoy_improve_relations_mult', '특사 관계 개선', 'Envoy Relations', 'diplomacy')
num('trust', 'country_trust_growth', '신뢰 성장', 'Trust Growth', 'diplomacy', 0.01, 5, 25)
pct('tribute', 'subject_tribute_mult', '속국 조공', 'Subject Tribute', 'diplomacy')
num('loyalty', 'monthly_loyalty_from_subjects', '속국 충성', 'Subject Loyalty', 'diplomacy', 0.01, 5, 25)
pct('warex', 'country_war_exhaustion_mult', '전쟁 피로', 'War Exhaustion', 'diplomacy', -1)
num('decrypt', 'intel_decryption_add', '암호 해독', 'Decryption', 'diplomacy', 1, 1, 10)
num('encrypt', 'intel_encryption_add', '암호화(방첩)', 'Encryption', 'diplomacy', 1, 1, 10)
pct('opspeed', 'espionage_operation_speed_mult', '첩보 작전 속도', 'Operation Speed', 'diplomacy')
pct('opcost', 'espionage_operation_cost_mult', '첩보 작전 비용', 'Operation Cost', 'diplomacy', -1)
pct('contactspeed', 'first_contact_speed_mult', '최초 접촉 속도', 'First Contact Speed', 'diplomacy')
pct('infiltration', 'spy_network_daily_value_mult', '첩보망 성장', 'Spy Network Growth', 'diplomacy')
pct('intel', 'intel_gain_speed', '정보 획득 속도', 'Intel Gain Speed', 'diplomacy')
# ── 함대 ── (fleet = 함대 하나에도 걸 수 있는 것)
FLEET_OK = set()
def fpct(i, k, ko, en, good=1, lo=1, hi=15): pct(i, k, ko, en, 'fleet', good, lo, hi); FLEET_OK.add(i)
def fnum(i, k, ko, en, step, lo, hi, good=1): num(i, k, ko, en, 'fleet', step, lo, hi, good); FLEET_OK.add(i)
fpct('shipdmg', 'ship_weapon_damage', '함선 무기 피해', 'Ship Weapon Damage')
fpct('shiprate', 'ship_fire_rate_mult', '함선 발사 속도', 'Ship Fire Rate')
fpct('shiprange', 'ship_weapon_range_mult', '함선 무기 사거리', 'Ship Weapon Range')
fnum('shipacc', 'ship_accuracy_add', '함선 명중', 'Ship Accuracy', 1, 1, 10)
fnum('shiptracking', 'ship_tracking_add', '함선 추적', 'Ship Tracking', 1, 1, 10)
fpct('shiphull', 'ship_hull_mult', '함선 선체', 'Ship Hull')
fpct('shiparmor', 'ship_armor_mult', '함선 장갑', 'Ship Armor')
fpct('shipshield', 'ship_shield_mult', '함선 방어막', 'Ship Shield')
fpct('shipevasion', 'ship_evasion_mult', '함선 회피', 'Ship Evasion')
fpct('shipspeed', 'ship_base_speed_mult', '함선 기본 속도', 'Ship Speed')
fpct('ftlspeed', 'ship_interstellar_speed_mult', '성간 이동 속도', 'FTL Speed')
fpct('shipexp', 'ship_experience_gain_mult', '함선 경험치', 'Ship Experience')
fpct('armorregen', 'ship_armor_regen_add_perc', '장갑 재생', 'Armor Regeneration', 1, 1, 5)
fpct('hullregen', 'ship_hull_regen_add_perc', '선체 재생', 'Hull Regeneration', 1, 1, 5)
fpct('shieldregen', 'ship_shield_regen_add_perc', '방어막 재생', 'Shield Regeneration', 1, 1, 5)
fpct('disengage', 'ship_disengage_chance_mult', '전투 이탈 확률', 'Disengage Chance')
fnum('cloak', 'ship_cloaking_strength_add', '은폐 세기', 'Cloaking Strength', 1, 1, 1)
fnum('cloakdetect', 'ship_cloaking_detection_add', '은폐 탐지', 'Cloak Detection', 1, 1, 1)
fnum('sensor', 'ship_sensor_range_add', '탐지 거리', 'Sensor Range', 1, 1, 2)
fpct('jumpcd', 'ship_jumpdrive_cooldown_mult', '점프 드라이브 재사용 대기', 'Jump Drive Cooldown', -1)
fpct('bombard', 'ship_orbital_bombardment_mult', '궤도 폭격', 'Orbital Bombardment')
pct('navalcap', 'country_naval_cap_mult', '함대 용량', 'Naval Capacity', 'fleet')
num('commandlimit', 'command_limit_add', '함대 지휘 한도', 'Fleet Command Limit', 'fleet', 1, 1, 5)
pct('shipupkeep', 'ships_upkeep_mult', '함선 유지비', 'Ship Upkeep', 'fleet', -1)
pct('shipcost', 'starbase_shipyard_build_cost_mult', '함선 건조 비용', 'Ship Build Cost', 'fleet', -1)
pct('shipspeedbuild', 'starbase_shipyard_build_speed_mult', '함선 건조 속도', 'Ship Build Speed', 'fleet')
# ── 지상군 ──
pct('armydmg', 'army_attack_damage_mult', '지상군 공격 피해', 'Army Damage', 'army')
pct('armyhp', 'army_attack_health_mult', '지상군 체력', 'Army Health', 'army')
pct('armymorale', 'army_attack_morale_mult', '지상군 사기', 'Army Morale', 'army')
pct('armycost', 'armies_cost_mult', '지상군 비용', 'Army Cost', 'army', -1)
pct('armyupkeep', 'armies_upkeep_mult', '지상군 유지비', 'Army Upkeep', 'army', -1)
pct('defdmg', 'army_defense_damage_mult', '방어군 피해', 'Defense Army Damage', 'army')
pct('defhp', 'army_defense_health_mult', '방어군 체력', 'Defense Army Health', 'army')
pct('defmorale', 'army_defense_morale_mult', '방어군 사기', 'Defense Army Morale', 'army')
pct('armyexp', 'army_experience_gain_mult', '지상군 경험치', 'Army Experience', 'army')
pct('armybuild', 'planet_army_build_speed_mult', '지상군 생산 속도', 'Army Build Speed', 'army')
pct('moraledmg', 'army_morale_damage_mult', '사기 피해', 'Morale Damage', 'army')
pct('collateral', 'army_collateral_damage_mult', '부수 피해', 'Collateral Damage', 'army')
pct('armytaken', 'army_damage_taken_mult', '지상군 받는 피해', 'Army Damage Taken', 'army', -1)
num('defarmies', 'planet_defense_armies_add', '행성 방어군 수', 'Defense Armies', 'army', 1, 1, 3)
# ── 건설 ──
pct('bldcost', 'planet_buildings_cost_mult', '건물 비용', 'Building Cost', 'build', -1)
pct('bldupkeep', 'planet_buildings_upkeep_mult', '건물 유지비', 'Building Upkeep', 'build', -1)
pct('distcost', 'planet_districts_cost_mult', '구역 비용', 'District Cost', 'build', -1)
pct('distupkeep', 'planet_districts_upkeep_mult', '구역 유지비', 'District Upkeep', 'build', -1)
pct('bldspeed', 'planet_building_build_speed_mult', '건물 건설 속도', 'Building Speed', 'build')
pct('bldoutput', 'planet_buildings_produces_mult', '건물 산출', 'Building Output', 'build')
pct('blocker', 'planet_clear_blocker_speed_mult', '장애물 제거 속도', 'Blocker Clearing Speed', 'build')
num('maxdistricts', 'planet_max_districts_add', '최대 구역 수', 'Max Districts', 'build', 1, 1, 3)
num('bldslots', 'zone_building_slots_add', '건물 칸', 'Building Slots', 'build', 1, 1, 1)
pct('megacost', 'megastructures_cost_mult', '거대구조물 비용', 'Megastructure Cost', 'build', -1)
pct('megaspeed', 'megastructure_build_speed_mult', '거대구조물 건설 속도', 'Megastructure Speed', 'build')
pct('megaupkeep', 'megastructures_upkeep_mult', '거대구조물 유지비', 'Megastructure Upkeep', 'build', -1)
num('megacap', 'country_megastructure_build_cap_add', '거대구조물 동시 건설', 'Megastructure Build Capacity', 'build', 1, 1, 1)
pct('terraform', 'terraform_speed_mult', '행성 개조 속도', 'Terraform Speed', 'build')
pct('sbcost', 'starbase_buildings_cost_mult', '우주 기지 건물 비용', 'Starbase Building Cost', 'build', -1)
pct('sbspeed', 'starbase_building_build_speed_mult', '우주 기지 모듈 건설 속도', 'Starbase Module Build Speed', 'build')
pct('sbcap', 'country_starbase_capacity_mult', '우주 기지 용량', 'Starbase Capacity', 'build')
pct('sbbuildspeed', 'starbase_upgrade_speed_mult', '우주 기지 업그레이드 속도', 'Starbase Upgrade Speed', 'build')
pct('sbupgrade', 'starbase_upgrade_cost_mult', '우주 기지 업그레이드 비용', 'Starbase Upgrade Cost', 'build', -1)
pct('sbinfluence', 'country_starbase_influence_cost_mult', '우주 기지 영향력 비용', 'Starbase Influence Cost', 'build', -1)
num('platforms', 'starbase_defense_platform_capacity_add', '방어 플랫폼 한도', 'Defense Platform Capacity', 'build', 1, 1, 3)
num('shipyard', 'starbase_shipyard_capacity_add', '조선소 칸', 'Shipyard Capacity', 'build', 1, 1, 2)
pct('outpostspeed', 'starbase_outpost_cost_mult', '전초기지 비용', 'Outpost Cost', 'build', -1)
pct('stationspeed', ['shipclass_mining_station_build_speed_mult', 'shipclass_research_station_build_speed_mult'], '채굴·연구 정거장 건설 속도', 'Station Build Speed', 'build')
# ── 인구·사회 (행성) ──
pct('happiness', 'pop_happiness', '인구 행복', 'Pop Happiness', 'society')
pct('amenities', 'planet_amenities_mult', '편의 시설 산출', 'Amenities', 'society')
pct('housing', 'pop_housing_usage_mult', '주거 사용량', 'Housing Usage', 'society', -1)
pct('housingadd', 'planet_housing_mult', '주거 공급', 'Housing', 'society')
num('crime', 'planet_crime_add', '범죄율', 'Crime', 'society', 1, 1, 15, -1)
pct('jobs', 'planet_jobs_produces_mult', '일자리 생산', 'Job Output', 'society')
pct('jobupkeep', 'planet_jobs_upkeep_mult', '일자리 유지비', 'Job Upkeep', 'society', -1)
pct('popupkeep', 'planet_pops_upkeep_mult', '인구 유지비', 'Pop Upkeep', 'society', -1)
pct('popgrowth', 'logistic_growth_mult', '인구 성장 속도', 'Pop Growth', 'society')
pct('assembly', 'planet_pop_assembly_mult', '인구 조립 속도', 'Pop Assembly', 'society')
pct('resettle', 'pop_resettlement_cost_mult', '이주 비용', 'Resettlement Cost', 'society', -1)
pct('ethicshift', 'pop_ethics_shift_speed_mult', '성향 변화 속도', 'Ethics Shift Speed', 'society')
pct('colonydev', 'planet_colony_development_speed_mult', '식민지 발전 속도', 'Colony Development', 'society')
pct('workforce', 'pop_workforce_mult', '노동력', 'Workforce', 'society')
num('stability', 'planet_stability_add', '안정도', 'Stability', 'society', 1, 1, 10)
num('habitability', 'pop_environment_tolerance', '거주 적합도', 'Habitability', 'society', 0.01, 1, 10, show='pct')
pct('amenityuse', 'pop_amenities_usage_mult', '편의 시설 사용량', 'Amenities Usage', 'society', -1)
# ── 지도자 ──
pct('leaderexp', 'commander_exp_gain', '사령관 경험치', 'Commander Experience', 'leader')
pct('scientistexp', 'scientist_exp_gain', '과학자 경험치', 'Scientist Experience', 'leader')
pct('officialexp', 'official_exp_gain', '관리 경험치', 'Official Experience', 'leader')
pct('councilexp', 'councilor_exp_gain', '평의원 경험치', 'Councilor Experience', 'leader')
pct('lifespan', 'leader_lifespan_mult', '지도자 수명', 'Leader Lifespan', 'leader')
pct('hirecost', 'leaders_cost_mult', '지도자 고용 비용', 'Leader Hire Cost', 'leader', -1)
pct('leaderupkeep', 'leaders_upkeep_mult', '지도자 유지비', 'Leader Upkeep', 'leader', -1)
num('leaderpool', 'country_leader_pool_size', '지도자 후보 수', 'Leader Pool Size', 'leader', 1, 1, 2)
num('levelcap', 'leader_skill_levels', '지도자 최대 레벨', 'Leader Level Cap', 'leader', 1, 1, 1)
num('startlevel', 'leader_initial_skill', '지도자 시작 레벨', 'Leader Starting Level', 'leader', 1, 1, 1)
# ── 탐사 ──
pct('survey', 'science_ship_survey_speed', '탐사 속도', 'Survey Speed', 'explore')
pct('anomaly', 'ship_anomaly_research_speed_mult', '이상 현상 연구 속도', 'Anomaly Research', 'explore')
pct('archaeo', 'ship_archaeological_site_excavation_speed_mult', '유적 발굴 속도', 'Excavation Speed', 'explore')

ALIASES = {'bioassembly': 'assembly', 'robotgrowth': 'assembly', 'admincap': 'size', 'counterintel': 'encrypt', 'espionage': 'opspeed'}
# 일회성 자원: AI 는 1~15 단계로 말한다. 1단계 = 월 수입 0.4개월(15단계 = 6개월). 결과는 [min, max] × 연도 배율 로 자른다(제안값).
RES = [('energy', '에너지', 'Energy', 'basic'), ('minerals', '광물', 'Minerals', 'basic'), ('food', '식량', 'Food', 'basic'),
    ('consumer_goods', '소비재', 'Consumer Goods', 'advanced'), ('alloys', '합금', 'Alloys', 'advanced'),
    ('influence', '영향력', 'Influence', 'influence'), ('unity', '통합', 'Unity', 'unity'),
    ('volatile_motes', '휘발성 입자', 'Volatile Motes', 'strategic'), ('exotic_gases', '이국 기체', 'Exotic Gases', 'strategic'), ('rare_crystals', '희귀 결정', 'Rare Crystals', 'strategic'),
    ('sr_living_metal', '살아있는 금속', 'Living Metal', 'rare'), ('sr_zro', '조로', 'Zro', 'rare'), ('sr_dark_matter', '암흑 물질', 'Dark Matter', 'rare'), ('nanites', '나노', 'Nanites', 'rare'),
    ('minor_artifacts', '소형 유물', 'Minor Artifacts', 'relic'), ('astral_threads', '성계 실', 'Astral Threads', 'relic'), ('menace', '위협', 'Menace', 'menace')]
RES_BAND = {'basic': [100, 3000], 'advanced': [50, 1500], 'influence': [10, 150], 'unity': [50, 1500], 'strategic': [10, 200], 'rare': [5, 100], 'relic': [1, 30], 'menace': [10, 200]}
GROUPS = {'economy': ['경제', 'Economy'], 'research': ['연구', 'Research'], 'empire': ['제국 운영', 'Empire'], 'diplomacy': ['외교·첩보', 'Diplomacy & Espionage'],
    'fleet': ['함대', 'Fleet'], 'army': ['지상군', 'Army'], 'build': ['건설', 'Construction'], 'society': ['인구·사회', 'Population & Society'], 'leader': ['지도자', 'Leaders'], 'explore': ['탐사', 'Exploration']}

# 행성 범위 키(국가 대상이면 every_owned_colony 안에서 붙임). 기존 gen-buffs.py 규칙 + 4.5.1 새 키.
PLANET_PREFIX = ('planet_', 'pop_', 'zone_')
COUNTRY_EXCEPT = {'planet_decision_enact_speed_mult'}  # 행성 결정은 행성 범위지만 제국 단위로 의미 → 그래도 행성에 붙인다(아래 scope 참고)
def scope(keys):
    s = {'planet' if (k.startswith(PLANET_PREFIX) or k == 'logistic_growth_mult') else 'country' for k in keys}
    assert len(s) == 1, keys
    return s.pop()

def known_modifiers():
    p = os.environ.get('SLLM_MODLIST')  # 4.5.1 modifiers.log 에서 뽑은 이름 목록(한 줄에 하나). 있으면 검사.
    if not p: return None
    return set(x.strip() for x in open(p, encoding='utf-8') if x.strip())

def fmtv(v, show):
    return ('%+g%%' % round(v * 100, 4)) if show == 'pct' else ('%+g' % v)

def build():
    known = known_modifiers()
    mods, ko, en, cat = [], [], [], []
    seen = set()
    for (i, keys, lko, len_, g, step, good, lo, hi, show) in E:
        assert i not in seen, i; seen.add(i)
        assert g in GROUPS and good in (1, -1) and 1 <= lo <= hi <= 100, i
        if known is not None:
            bad = [k for k in keys if k not in known]
            assert not bad, (i, bad)
        sc = scope(keys)
        for s in range(1, SLOTS + 1):
            for d, sign, tko, ten in [('p', good, '퀘스트 보상', 'Quest Reward'), ('n', -good, '퀘스트 불이익', 'Quest Penalty')]:
                name = 'sllm_q%d_%s_%s' % (s, i, d)
                body = ''.join('\t%s = %s\n' % (k, '%g' % (step * sign)) for k in keys)
                mods.append('%s = {\n%s}\n' % (name, body))
                ko.append(' %s:0 "SLLM %s: %s"\n %s_desc:0 "SLLM 연결 모드가 퀘스트 결과로 부여한 효과입니다. 크기는 퀘스트마다 다르고, 기간이 끝나면 사라집니다."\n' % (name, tko, lko, name))
                en.append(' %s:0 "SLLM %s: %s"\n %s_desc:0 "Applied by the SLLM connection mod as a quest result. Its size varies by quest and it expires on its own."\n' % (name, ten, len_, name))
        cat.append({'id': i, 'keys': keys, 'ko': lko, 'en': len_, 'group': g, 'scope': sc, 'step': step, 'good': good, 'min': lo, 'max': hi,
                    'show': show, 'fleet': i in FLEET_OK})
    res = [{'id': 'res_' + k, 'key': k, 'ko': lko, 'en': len_, 'band': b, 'min': RES_BAND[b][0], 'max': RES_BAND[b][1]} for k, lko, len_, b in RES]
    return mods, ko, en, cat, res

def main():
    mods, ko, en, cat, res = build()
    head = ('# SLLM 퀘스트 효과 라이브러리 (tools/gen-quest-effects.py 로 생성 — 직접 고치지 말고 생성기를 고칠 것)\n'
            '# 이름: sllm_q<자리 1~%d>_<id>_p (좋은 쪽 1단계) / _n (나쁜 쪽 1단계). 앱이 add_modifier = { modifier = … days = N multiplier = 단계 } 로 붙인다.\n'
            '# 키는 Stellaris 4.5.1 script_docs 의 바닐라 이름만 쓴다 — 다른 모드 없이 동작.\n\n' % SLOTS)
    out = lambda *p: os.path.join(ROOT, *p)
    for d in ['tester-mod/common/static_modifiers', 'tester-mod/localisation/korean', 'tester-mod/localisation/english', 'src']:
        os.makedirs(out(d), exist_ok=True)
    open(out('tester-mod/common/static_modifiers/sllm_quest_modifiers.txt'), 'w', encoding='utf-8').write(head + '\n'.join(mods))
    open(out('tester-mod/localisation/korean/sllm_quest_l_korean.yml'), 'w', encoding='utf-8-sig').write('l_korean:\n' + ''.join(ko))
    open(out('tester-mod/localisation/english/sllm_quest_l_english.yml'), 'w', encoding='utf-8-sig').write('l_english:\n' + ''.join(en))
    ts = ('// 자동 생성(tools/gen-quest-effects.py). SLLM 퀘스트 효과 목록 — 직접 고치지 말 것.\n'
          "export interface QuestEffectEntry { id: string; keys: string[]; ko: string; en: string; group: string; scope: 'country' | 'planet'; step: number; good: 1 | -1; min: number; max: number; show: 'pct' | 'num'; fleet: boolean }\n"
          'export interface QuestResourceEntry { id: string; key: string; ko: string; en: string; band: string; min: number; max: number }\n'
          'export const QUEST_SLOTS = %d;\n' % SLOTS +
          'export const QUEST_GROUPS: Record<string, [string, string]> = ' + json.dumps(GROUPS, ensure_ascii=False) + ';\n'
          'export const QUEST_ALIASES: Record<string, string> = ' + json.dumps(ALIASES) + ';\n'
          'export const QUEST_EFFECTS: QuestEffectEntry[] = ' + json.dumps(cat, ensure_ascii=False, separators=(',', ':')) + ';\n'
          'export const QUEST_RESOURCES: QuestResourceEntry[] = ' + json.dumps(res, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(out('src/quest-catalog.ts'), 'w', encoding='utf-8').write(ts)
    print(len(cat), 'effects,', len(res), 'resources,', len(mods), 'modifiers')
main()
