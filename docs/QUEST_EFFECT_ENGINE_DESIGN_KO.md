# 퀘스트 효과 엔진 설계서 (0.1.0-alpha.10.5 이후, 2026-10-26 초안)

총독·장관·외교 상대가 AI로 퀘스트를 주고, **보상·불이익의 수치를 AI가 그때그때 정한다.** 앱은 AI가 고른 효과와 수치를 허용 목록·범위로 검증하고, 모드는 받은 수치를 그대로 게임에 건다.
사용자 확정 사항(2026-10-26)은 ★ 표시. 나머지는 이 문서의 제안이며, 확인을 받은 뒤 구현한다.

## 1. 확정 사항

| 항목 | 내용 |
| --- | --- |
| 효과 종류 ★ | Cheat Interface(창작마당 3311950726, 4.4 기준) 항목을 **하나도 빼지 않고** 전부 정의한다(지금 쓸 곳이 없어도 나중을 위해). 자원 17종 + 수정자 111종. 기존 버프 카탈로그 99종을 확장하는 방식. 전체 대응표는 부록 A |
| 상한 ★ | 퍼센트 효과는 퀘스트 1개당 **±15%까지**(일단). 고정값 효과는 아래 표의 "15%급" 범위 |
| 중첩 ★ | **상한 없음.** 여러 퀘스트가 같은 수정자를 걸면 그대로 쌓인다. 해 보고 조정 |
| 모드 규격 ★ | 모드 파일과 연결 규격이 바뀌므로 10.5 다음 업데이트 일. 앱 업데이트 묶음만으로는 안 되고 모드도 함께 올림 |
| 범위 분류 | 아래 3장의 분류는 제안(사용자가 "인간적으로 맞겠다 싶은 범위"로 맡김) |

## 2. 흐름

```
[AI] 퀘스트 생성 (기존 대화·회의 호출 안에서, JSON)
  { "title": "...", "goal": {...}, "reward":  [{ "id": "happiness", "amount": 6, "days": 720 }],
                                   "penalty": [{ "id": "stability", "amount": -4, "days": 360 }] }
   ↓
[앱] 검증 — id 가 카탈로그에 있나 / 이 퀘스트를 준 사람이 걸 수 있는 범위인가 / 수치·기간을 범위 안으로 잘라냄 / 0 이면 버림
   ↓
[모드] 변수 저장 → 대상(제국·행성·총독 구역)에 수정자 적용 → 로그로 결과 보고
```

- AI는 **효과 ID와 숫자만** 고른다. 효과의 종류는 모드 파일에 미리 정의된 것만 쓸 수 있다.
- 퀘스트 제목·본문 같은 문장은 앱 화면(집무실·서신함)에만 쓴다. 게임 안에는 숫자와 진행 상태만 둔다.
- 잘라낸 경우 앱은 조용히 범위 안 최대값으로 바꾸고, 진단 로그에 원래 값을 남긴다.

## 3. 대상 범위 분류 (누가 어디에 걸 수 있나)

| 범위 | 거는 곳 | 줄 수 있는 사람 | 예 |
| --- | --- | --- | --- |
| **제국** | 우리 제국 전체 (`country`) | 통치자·장관(내각 회의)·외교 상대(협정 보상) | 연구 속도, 함선 피해, 외교 비중 |
| **행성** | 행성 하나 (`planet`) | 총독(자기 구역 행성)·시민 청원 | 행복, 안정도, 범죄, 건물 비용 |
| **총독 구역** | 그 총독 구역의 모든 행성 | 총독 | 행성 효과를 구역 전체에 (같은 범위표, 다만 상한은 행성 하나일 때의 **2/3**로 제안: 넓게 걸리니까) |
| **일회성 자원** | 우리 창고에 한 번 지급·차감 | 누구나 | 합금 300, 영향력 50 |

- 총독은 **행성·총독 구역 범위만** 줄 수 있다(함대·연구 같은 제국 효과를 총독이 주면 어색함). 장관은 자기 직책 분야의 제국 효과만(내각 회의 규칙과 같게).
- 4.5.1 `add_modifier` 는 **fleet·ship·starbase·pop_group·federation·spy_network** 범위도 받는다(덤프 확인). 그래서 "함대 하나" 범위를 추가할 수 있다: 함대 사령관(제독)이 주는 퀘스트 → 그 함대에만 함선 효과. 지도자 범위(leader)는 목록에 없어서 넣지 않는다.
- 함선 효과의 기본 범위는 제국. 함대 범위는 같은 수치 범위를 쓴다(한 함대라 좁으니 상한 그대로).

## 4. 카탈로그

표기: ✓ = 기존 99종(`buff-catalog.ts`, 이미 정의·일부 실게임 부착 확인) / ☆ = 새로 추가. **4.5.1 `script_docs` 덤프로 이름 확인 완료(2026-10-26, 부록 B).** 표의 "후보/이름 확인" 대신 부록 B 의 실제 이름을 쓴다. 기존 99종도 4.5.1에 전부 존재함을 확인.
수치 칸은 **좋은 쪽 기준 퀘스트 1개당 범위**. 불이익은 같은 범위를 반대 방향으로 쓴다. 비용·유지비·범죄처럼 낮을수록 좋은 것은 "좋은 쪽"이 마이너스.

### 4-1. 경제 (제국)
| id | 수정자 | 범위(좋은 쪽) | |
| --- | --- | --- | --- |
| energy / minerals / food / alloys / goods / unity / influence / trade | country_*_produces_mult | +1~15% | ✓ |
| gases / motes / crystals / nanites / darkmatter / zro / livingmetal / artifacts | country_*_produces_mult | +1~15% | ✓ |
| storage | country_resource_max_add | +1,000~10,000 | ✓ |

### 4-2. 연구 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| physics / society / engineering | country_*_research_produces_mult | +1~15% | ✓ |
| researchspeed | all_technology_research_speed | +1~15% | ✓ |
| techchoices | num_tech_alternatives_add | +1~2 | ✓ |

### 4-3. 제국 운영 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| size / sizepops / sizecol | empire_size_*mult | −1~15% | ✓ |
| edictcost / tradcost / claimcost | edicts_cost_mult 등 | −1~15% | ✓ |
| edictfund | country_edict_fund_add | +10~100 | ✓ |
| agenda / agendacd | council_agenda_* | ±1~15% | ✓ |
| approval | faction_approval | +1~15%p | ✓ |
| officials / scientists / commanders | country_*_cap_add | +1~2 | ✓ |
| terraformcost | terraforming_cost_mult | −1~15% | ☆ |
| decisionspeed | 행성 결정 속도(이름 확인) | +1~15% | ☆ |

### 4-4. 외교·첩보 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| diploweight / relations / tribute / contactspeed / opspeed | *_mult | +1~15% | ✓ |
| opcost / warex | *_mult | −1~15% | ✓ |
| envoys | envoys_add | +1~2 | ✓ |
| trust | country_trust_growth | +0.05~0.25 | ✓ |
| loyalty | monthly_loyalty_from_subjects | +0.05~0.25 | ✓ |
| decrypt / encrypt | intel_*_add | +1~10 | ✓ |
| infiltration | 첩보망 성장 속도(이름 확인) | +1~15% | ☆ |
| intel | 정보 수준 고정값(이름 확인) | +1~10 | ☆ |

### 4-5. 함대 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| shipdmg / shiprate / shiprange / shiphull / shiparmor / shipshield / shipevasion | ship_*_mult 등 | +1~15% | ✓ |
| shipspeed / ftlspeed / navalcap / shipexp / shipspeedbuild | *_mult | +1~15% | ✓ |
| shipupkeep / shipcost | *_mult | −1~15% | ✓ |
| shipacc | ship_accuracy_add | +1~10 | ✓ |
| shiptracking | ship_tracking_add | +1~10 | ☆ |
| armorregen / hullregen / shieldregen | ship_*_regen_add_perc | +1~5%p | ☆ (재생은 원래 값이 작아서 낮게) |
| disengage | ship_disengage_chance_mult | +1~15% | ☆ |
| commandlimit | command_limit_add | +1~5 | ☆ (함대 지휘 한도, 기본 20의 15%급) |
| cloak / cloakdetect | 은폐 세기·탐지 고정값(이름 확인) | +1 | ☆ |
| sensor | ship_sensor_range_add | +1~2 | ☆ |
| jumpcd | 점프 드라이브 재사용 시간(이름 확인) | −1~15% | ☆ |

### 4-6. 지상군 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| armydmg / armyhp / armymorale | army_attack_*_mult | +1~15% | ✓ |
| armycost / armyupkeep | armies_*_mult | −1~15% | ✓ |
| defdmg / defhp / defmorale | army_defense_*_mult | +1~15% | ☆ |
| armyexp | 육군 경험치(이름 확인) | +1~15% | ☆ |
| armybuild | 육군 생산 속도(이름 확인) | +1~15% | ☆ |
| moraledmg | army_morale_damage_mult | +1~15% | ☆ |
| collateral | army_collateral_damage_mult | ±1~15% | ☆ (Cheat Interface 처럼 양쪽 다 허용) |
| bombard | 궤도 폭격 피해(이름 확인) | +1~15% | ☆ |
| armytaken | 육군이 받는 피해(이름 확인) | −1~15% | ☆ |
| defarmies | 행성 방어군 수(이름 확인) | +1~3 | ☆ (행성 범위) |

### 4-7. 건설 (제국 / 행성)
| id | 수정자 | 범위 | 범위 구분 | |
| --- | --- | --- | --- | --- |
| bldcost / bldupkeep / distcost / distupkeep | planet_*_mult | −1~15% | 행성 | ✓ |
| bldspeed | planet_building_build_speed_mult | +1~15% | 행성 | ✓ |
| blocker | 장애물 제거 속도(이름 확인) | +1~15% | 행성 | ☆ |
| maxdistricts | planet_max_districts_add | +1~3 | 행성 | ☆ |
| bldslots | zone_building_slots_add | +1 | 행성 | ☆ |
| megacost / megaspeed / terraform / sbcost / sbspeed / sbcap | *_mult | ±1~15% | 제국 | ✓ |
| megaupkeep | megastructures_upkeep_mult | −1~15% | 제국 | ☆ |
| megacap | 동시 건설 거대구조물 수(이름 확인) | +1 | 제국 | ☆ |
| sbupgrade / sbinfluence | starbase_upgrade_cost_mult · country_starbase_influence_cost_mult | −1~15% | 제국 | ☆ |
| platforms | 방어 플랫폼 한도(이름 확인) | +1~3 | 제국 | ☆ |
| outpostspeed | 전초기지 건설 속도(이름 확인) | +1~15% | 제국 | ☆ |
| stationspeed | 정거장(채굴·연구 기지) 건설 속도(이름 확인) | +1~15% | 제국 | ☆ |
| sbbuildspeed | 우주기지 건설·업그레이드 속도(이름 확인) | +1~15% | 제국 | ☆ |
| shipyard | 조선소 관련(Cheat Interface 「Shipyard」, 정확한 수정자 확인) | +1~15% 또는 +1 | 제국 | ☆ |
| bldoutput | 건물 산출(이름 확인) | +1~15% | 행성 | ☆ |

### 4-8. 인구·사회 (행성)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| happiness | pop_happiness | +1~15% | ✓ |
| amenities / jobs / popgrowth / assembly / colonydev / ethicshift | *_mult | +1~15% | ✓ |
| housing / jobupkeep / popupkeep / resettle | *_mult | −1~15% | ✓ |
| crime | planet_crime_add | −1~15 | ✓ |
| stability | planet_stability_add | +1~10 | ☆(모드에서 이미 쓰는 이름, 카탈로그에만 없음) |
| habitability | pop_environment_tolerance | +1~10%p | ☆ |
| amenityuse | pop_amenities_usage_mult | −1~15% | ☆ |
| bioassembly | 생체 조립(클론 통 등, 이름 확인) | +1~15% | ☆ |
| housingadd | 주거 고정값(이름 확인) | 행성 주거의 1~15%만큼(앱이 행성 값 보고 계산) | ☆ |
| workforce | 노동력(4.x, 이름 확인) | 1~15%(퍼센트형이 있으면 그것, 고정값뿐이면 앱이 행성 값 보고 계산) | ☆ |

- 「조선소」「정거장 건설 속도」「건물 산출」은 페이지 설명만으로는 정확한 수정자를 알 수 없어서, `modifiers.log` 확인 때 같이 찾는다.
- 주거·노동력은 4.5.1 에 퍼센트형(planet_housing_mult · pop_workforce_mult)이 있어서 그대로 +1~15% 로 쓴다(부록 B).

### 4-9. 지도자 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| leaderexp / scientistexp / officialexp / lifespan | *_exp_gain · leader_lifespan_mult | +1~15% | ✓ |
| hirecost / leaderupkeep | leaders_*_mult | −1~15% | ✓ |
| councilexp | 평의원 경험치(이름 확인) | +1~15% | ☆ |
| leaderpool | 지도자 후보 수(이름 확인) | +1~2 | ☆ |
| levelcap / startlevel | 지도자 레벨 상한·시작 레벨(이름 확인) | +1 | ☆ (강력해서 1만) |

### 4-10. 탐사 (제국)
| id | 수정자 | 범위 | |
| --- | --- | --- | --- |
| survey / anomaly / archaeo | *_mult | +1~15% | ✓ |

### 4-11. 일회성 자원 (`add_resource`)
Cheat Interface 의 17종 전부: 에너지·광물·식량·소비재·합금·영향력·통합·휘발성 미립자·이국적 가스·희귀 수정·생체 금속·즈로·암흑 물질·나나이트·소형 유물·성계 실(Astral Threads)·위협(Menace).

| 묶음 | 1회 범위(지급·차감) | 비고 |
| --- | --- | --- |
| 기본(에너지·광물·식량) | 100~3,000 | |
| 고급(합금·소비재) | 50~1,500 | |
| 통치(영향력) | 10~150 | 영향력은 귀해서 낮게 |
| 통치(통합) | 50~1,500 | |
| 전략(미립자·가스·수정) | 10~200 | |
| 희귀(생체 금속·즈로·암흑 물질·나나이트) | 5~100 | |
| 유물(소형 유물·성계 실) | 1~30 | DLC 없으면 그 자원은 고를 수 없게 |
| 위협(Menace) | 10~200 | 위기 제국(Become the Crisis)일 때만 |

- **구현**: AI 는 자원도 1~15 단계로 말하고, 1단계 = 그 자원 월 수입 0.4개월분(15단계 = 6개월). 게임이 `export_resource_income_to_variable` 로 수입을 읽어 계산하고, 결과를 위 표의 [최소, 최대] × 연도 배율로 자른다. 그래서 초반·후반 규모가 자동으로 맞는다(제안값, 확인 필요).
- 상한은 **게임 연도에 따라 앱이 늘린다**(제안: 2200년 ×1, 2250년 ×2, 2300년 이후 ×3). 초반에 합금 1,500은 너무 크고, 후반 300은 의미가 없어서.
- 차감(불이익)은 창고에 있는 만큼까지만(마이너스 창고 방지). `export_resource_stockpile_to_variable` 로 창고량을 읽어 그보다 많으면 창고량만 뺀다.

### 4-12. 기간
- 수정자 효과: **180~1,080일(0.5~3년)**, 기본 720일. 정책 퀘스트(1~3년)와 맞춤.
- 불이익도 같은 범위. 다만 AI가 기간을 안 주면 보상 720일·불이익 360일.

## 5. 모드에서 수치를 거는 방법

### 확정: `add_modifier` 의 `multiplier`·`time_multiplier` 에 변수 (4.5.1 덤프 확인)
```
add_modifier = {
	modifier = <key>
	days/months/years = <int>
	multiplier = <float>/<variable> (optional)
	time_multiplier = <variable> (optional: days/months/years value is multiplied by the value of this variable)
}
Supported Scopes: megastructure planet country ship pop pop_group fleet galactic_object pop_faction federation starbase spy_network ...
```
- 정적 수정자를 **1단위(1% 또는 고정값 1)** 로 정의하고 `multiplier = <변수>` 로 크기를, `days = 1 time_multiplier = <변수>` 로 기간을 건다. 수치·기간 모두 앱이 보낸 숫자 그대로.
- 불이익은 multiplier 를 음수로 줄 수 있는지 게임 확인(덤프에는 add_modifier 쪽에 "cannot be negative" 표시가 없음). 안 되면 반대 방향 1단위 수정자를 따로 정의.
- 전에 적은 대비책(1·2·4·8 쪼개기)은 필요 없어졌다.
- **구현(2026-10-26 작업컴, `1026_집컴_옮기기\code`)**: 앱이 콘솔 `effect` 명령에 숫자를 직접 쓴다(`multiplier = 6 days = 720`). 그래서 모드에는 변수·스크립트 효과가 필요 없고 **1단위 정적 수정자와 현지화만** 있으면 된다. 불이익은 반대 방향 1단위 수정자(`_n`)에 양수 multiplier 로 건다(음수 multiplier 확인 불필요).
- 카탈로그는 145종(생체 조립은 assembly 의 별칭으로 합침).

### 중첩(상한 없음 ★)을 위한 "퀘스트 자리"
- 스텔라리스는 **같은 이름의 수정자를 다시 걸면 쌓이지 않고 기간만 갱신**한다. 그래서 퀘스트마다 다른 이름이 필요하다: `sllm_q<자리>_<id>`.
- 제안: **동시 진행 퀘스트 자리 8개**. 이건 중첩 상한이 아니라 기술적인 자리 수이고, 늘려도 생성기로 다시 만들면 된다.
- 정의 개수(생성기 `tools/gen-buffs.py` 확장으로 자동 생성):
  - 8자리 × 약 146개(기존 99 + 새 47) × 방향 2 ≈ 2,350개 (음수 multiplier 가 되면 방향 1 → 약 1,170개)
- 같은 퀘스트 안에서 보상 여러 개는 같은 자리를 쓴다(id가 달라서 겹치지 않음).

### 명령과 로그
- `sllm_quest_apply = { SLOT N TARGET country|planet:<id>|sector:<id> ID happiness AMT 6 DAYS 720 SIGN + }`
- `sllm_quest_clear = { SLOT N }`: 그 자리 수정자 전부 제거(퀘스트 취소·실패 전환).
- 로그: `SLLM:QUEST/;/phase=applied/;/slot/;/id/;/amt/;/status=ok|failed|no_target`.
- 총독 구역 범위는 모드가 `every_owned_planet = { limit = { sector = 그 구역 } }` 식으로 돈다(구역 판정 트리거 이름 게임 확인).

## 6. 게임에서 꼭 확인할 것 (구현 전·후)
1. ~~`multiplier` + 변수 지원~~ → **4.5.1 덤프로 확인 완료.** 남은 것: 음수 multiplier 로 불이익이 되는지.
2. ~~☆ 수정자 이름~~ → **부록 B 로 확인 완료.** 남은 것: 4.4/4.5 이외 버전(사용자 게임 버전)에서 이름 차이 — `tools/` 에 덤프 비교 검사 추가 권장.
3. 같은 이름 수정자를 다시 걸면 쌓이지 않고 갱신되는지(퀘스트 자리 설계의 전제).
4. 정의가 수천 개일 때 게임 로딩 시간·`error.log`.
5. 기존 효과 검증 도구(효과 일괄 검증)를 퀘스트 자리에도 돌려 부착·제거 확인.

## 7. 아직 정하지 않은 것 (다음 논의)
- 퀘스트 흐름 자체: 누가 언제 주는지, 목표 판정(정책 퀘스트의 유지 조건·시민 청원의 건설 과제를 재사용할지), 수락·거절, 기한.
- 기존 기능(내각 의제·총독 약속 등)을 이 엔진으로 옮길지 — 옮기지 않고 그대로 두는 것이 기본. 약속 파기 −15 같은 고정 수치는 예측 가능해야 공정해서 고정 유지 권장.
- 4-11 자원 수치와 게임 연도 배율.

## 부록 A. Cheat Interface 전 항목 대응표

모든 항목이 위 카탈로그의 id 하나 이상에 대응한다(빠진 것 없음). 「±」 항목은 Cheat Interface 처럼 늘리기·줄이기 둘 다 정의.

**자원 (17)** → 4-11 전부.

**제국 (30)**: 외교 비중+ / 외교 비중− → diploweight(±) · 특사 → envoys · 특사 효율 → relations · 첫 접촉 속도 → contactspeed · 월 충성도 → loyalty · 행정 한도(지도자 한도) → officials·scientists·commanders · 영유권 비용 → claimcost · 행성 결정 속도 → decisionspeed☆ · 창고 한도 → storage · 전쟁 피로 → warex · 연구 산출 → physics·society·engineering · 연구 속도 → researchspeed · 교역 가치 → trade · 파벌 승인도 → approval · 제국 규모 → size·sizepops·sizecol · 식민지 발전 → colonydev · 전통 비용 → tradcost · 종속국 조공 → tribute · 테라포밍 속도 → terraform · 테라포밍 비용 → terraformcost☆ · 칙령 기금 → edictfund · 칙령 비용 → edictcost · 첩보망 침투 → infiltration☆ · 정보 수준 → intel☆ · 방첩 → encrypt · 첩보 → opspeed·opcost·decrypt · 가치관 변화 → ethicshift · 의제 속도 → agenda(+agendacd) · 신뢰 → trust

**함선 (22)**: 기본 속도 → shipspeed · 초광속 → ftlspeed · 장갑·선체·보호막 재생 → armorregen☆·hullregen☆·shieldregen☆ · 건조 속도 → shipspeedbuild · 해군 수용량 → navalcap · 함대 한도 → commandlimit☆ · 내구 → shiphull·shiparmor·shipshield · 경험치 → shipexp · 무기 피해 → shipdmg · 발사 속도 → shiprate · 사거리 → shiprange · 명중·추적 → shipacc·shiptracking☆ · 회피 → shipevasion · 이탈 확률 → disengage☆ · 유지비 → shipupkeep(+shipcost) · 은폐 세기 → cloak☆ · 은폐 탐지 → cloakdetect☆ · 탐지 거리 → sensor☆ · 점프 드라이브 → jumpcd☆ · 과학선 작업 → survey·anomaly·archaeo

**육군 (15)**: 생산 속도 → armybuild☆ · 비용 → armycost · 유지비 → armyupkeep · 경험치 → armyexp☆ · 방어군 → defarmies☆ · 공격 피해·체력·사기 → armydmg·armyhp·armymorale · 방어 피해·체력·사기 → defdmg☆·defhp☆·defmorale☆ · 부수 피해(±) → collateral☆ · 받는 피해 → armytaken☆ · 사기 피해 → moraledmg☆ · 궤도 폭격 → bombard☆

**건물·행성 (21)**: 건물 산출 → bldoutput☆ · 건물 비용 → bldcost(+bldupkeep) · 건물 칸 → bldslots☆ · 조선소 → shipyard☆ · 구역 비용 → distcost(+distupkeep) · 최대 구역 → maxdistricts☆ · 행성 건설 속도 → bldspeed · 장애물 제거 → blocker☆ · 전초기지 건설 → outpostspeed☆ · 정거장 건설 → stationspeed☆ · 방어 플랫폼 한도 → platforms☆ · 우주기지 한도 → sbcap · 우주기지 건설 → sbbuildspeed☆ · 모듈 건설 → sbspeed · 업그레이드 비용 → sbupgrade☆ · 구조물 비용 → sbcost · 우주기지 영향력 비용 → sbinfluence☆ · 거대구조물 동시 건설 → megacap☆ · 거대구조물 속도 → megaspeed · 비용 → megacost · 유지비 → megaupkeep☆

**인구 (15)**: 생체 성장 → popgrowth · 생체 조립 → bioassembly☆ · 로봇 생산 → assembly · 거주 적합도 → habitability☆ · 주거 → housingadd☆(+housing 사용량) · 노동력 → workforce☆ · 일자리 산출 → jobs · 일자리 유지비 → jobupkeep · 인구 유지비 → popupkeep · 행복 → happiness · 안정도 → stability☆ · 편의시설 → amenities · 편의시설 사용량 → amenityuse☆ · 범죄 → crime · 이주 비용 → resettle

**지도자 (8)**: 수명 → lifespan · 고용 비용 → hirecost · 유지비 → leaderupkeep · 후보 수 → leaderpool☆ · 레벨 상한 → levelcap☆ · 경험치 → leaderexp·scientistexp·officialexp · 평의원 경험치 → councilexp☆ · 시작 기술 → startlevel☆

카탈로그에만 있고 Cheat Interface 에 없는 기존 항목(techchoices·agendacd·distupkeep·bldupkeep 등)도 그대로 둔다.

## 부록 B. 새 수정자 실제 이름 (Stellaris 4.5.1 `script_docs`, OldEnt/stellaris-triggers-modifiers-effects-list)

| id | 4.5.1 수정자 | 비고 |
| --- | --- | --- |
| terraformcost | terraforming_cost_mult | |
| decisionspeed | planet_decision_enact_speed_mult | |
| infiltration | spy_network_daily_value_mult | 첩보망 성장 |
| intel | intel_gain_speed | 정보 획득 속도(퍼센트형). 고정값형은 없음 → 범위 +1~15% |
| shiptracking | ship_tracking_add | |
| armorregen / hullregen / shieldregen | ship_armor_regen_add_perc / ship_hull_regen_add_perc / ship_shield_regen_add_perc | |
| disengage | ship_disengage_chance_mult | |
| commandlimit | command_limit_add | |
| cloak / cloakdetect | ship_cloaking_strength_add / ship_cloaking_detection_add | |
| sensor | ship_sensor_range_add | 퍼센트형 없음 → 범위 +1~2 |
| jumpcd | ship_jumpdrive_cooldown_mult | |
| defdmg / defhp / defmorale | army_defense_damage_mult / army_defense_health_mult / army_defense_morale_mult | |
| armyexp | army_experience_gain_mult | |
| armybuild | planet_army_build_speed_mult | |
| moraledmg | army_morale_damage_mult | |
| collateral | army_collateral_damage_mult | |
| bombard | ship_orbital_bombardment_mult | |
| defarmies | planet_defense_armies_add | |
| armytaken | army_damage_taken_mult | |
| bldoutput | planet_buildings_produces_mult | |
| blocker | planet_clear_blocker_speed_mult | |
| maxdistricts | planet_max_districts_add | |
| bldslots | zone_building_slots_add | 4.x 구역(zone) 체계. 일반 planet_max_buildings_add 는 없음 |
| shipyard | starbase_shipyard_capacity_add | 조선소 칸 → 범위 +1~2 |
| stationspeed | shipclass_mining_station_build_speed_mult + shipclass_research_station_build_speed_mult | 둘을 같이 건다 |
| sbbuildspeed / sbupgrade | starbase_upgrade_speed_mult / starbase_upgrade_cost_mult | |
| sbinfluence | country_starbase_influence_cost_mult | |
| platforms | starbase_defense_platform_capacity_add | |
| outpostspeed | starbase_outpost_cost_mult | **속도 수정자가 없음** → 전초기지 비용으로 대신(−1~15%) |
| megaupkeep / megacap | megastructures_upkeep_mult / country_megastructure_build_cap_add | |
| stability | planet_stability_add | |
| habitability | pop_environment_tolerance | |
| amenityuse | pop_amenities_usage_mult | |
| bioassembly | (전용 수정자 없음) | 4.5.1 에는 생체 조립 전용이 없어 assembly(planet_pop_assembly_mult)와 합침 |
| housingadd | planet_housing_mult | **퍼센트형이 있음** → 앱 환산 없이 +1~15% |
| workforce | pop_workforce_mult | **퍼센트형이 있음** → 앱 환산 없이 +1~15% |
| councilexp | councilor_exp_gain | |
| leaderpool | country_leader_pool_size | |
| levelcap | leader_skill_levels | 지도자 최대 레벨 |
| startlevel | leader_initial_skill | |

- 덤프 출처: https://github.com/OldEnt/stellaris-triggers-modifiers-effects-list (4.5.1, 2026-09-24 갱신). 사용자의 게임 버전이 다르면 그 버전 파일로 다시 대조한다.

## 8. 퀘스트 흐름 — 성간 임시회의 과제 (2026-10-26 사용자 확정, 집 PC 구현)
- **어디서**: 일단 성간 임시회의에서만. 「회의 종료」를 누르면 플레이어가 쓴 회의 주제에 가장 관련 깊은 참석 통치자(관련도 같으면 회의에서 더 많이 말한 쪽) 1명이, 주제·오간 대화를 보고 과제 1개를 제안한다(LLM 1회 추가, 통치자들이 한 번도 말하지 않은 회의는 없음). 한 회의에 과제 1개, 제안은 한 번에 하나(게임 1개월 안에 받거나 거절).
- **목표 5종**(앱이 매달 게임에서 재서 판정): ① 특정 제국과 평화 유지(그 기간 동안 전쟁하면 실패) ② 공동의 적에 선전포고(기한 안에 그 제국과 전쟁 상태면 성공) ③ 자원 건네기(우리 월수입 기준 최대 6개월치 = 엔진 자원 규칙, 수락 즉시 건네고 바로 성공, 교역 가능한 자원만) ④ 관계 개선(그 제국의 우리 호감 +25/+50/+100) ⑤ 경제(수입·창고 +5/+10/+20%, 해군 사용률 60/75/90%). ④⑤의 난이도 값은 정책 퀘스트(policy.ts makeCond) 그대로.
- **기한**: AI 가 1~3년(12~36개월). **보상·불이익**: AI 가 퀘스트 엔진 범위(±15%) 안에서, 성공하면 보상, 실패하면 불이익.
- **호감**: 성공 +15 / 실패 −15(기존 외교 대화의 「많이 오름·내림」 단계). **거절**: 아무 일 없음. **동시에 3개**, 같은 제국은 한 번에 1개.
- 대상 제국이 사라지면 플레이어 잘못이 아니므로 성공(정책 퀘스트와 같음). 퀘스트 효과 자리(8개)가 다 차 있으면 효과는 걸지 못하고 호감만 바뀐다(알림에 표시).
- **게임 상황 기록(Situation Log)에 표시** (2026-10-26 사용자 「인게임 퀘스트 기능을 이용하고 싶다」): 바닐라 몰락한 제국 과제와 같은 이벤트 체인(begin_event_chain / end_event_chain). 받으면 뜨고, 매달 지금 값·남은 개월이 바뀌고, 성공·실패하면 닫힌다. 게임 글은 고정(배포 모드는 읽기 전용이라 실행 중 글을 바꿀 수 없음)이라 AI 가 지은 제목·대사는 앱 카드에만 있고, 상황 기록은 목표 종류·자원별 한/영 문구 + 과제를 준 제국·대상 제국 이름(전역 이벤트 대상) + 목표·지금·남은 개월(변수). 칸 3개 × 18종 = 54개 체인, 생성기 `tools/gen-iscq-chains.py` → `tester-mod/common/event_chains/sllm_iscq_chains.txt`, `localisation/*/sllm_iscq_l_*.yml`, 효과 `common/scripted_effects/sllm_iscq_log.txt`. 자원 건네기는 받는 즉시 끝나 띄우지 않음.
- 측정(SLLM:ISCQO·ISCQM)·자원 건네기(ISCQGIFT)는 앱이 보내는 콘솔 effect, 보상·불이익은 엔진의 1단위 수정자(sllm_quest_modifiers.txt, 다음 업데이트 모드에 이미 포함).
- 파일: `src/isc-quest.ts`(규칙·프롬프트·명령), `src/features/isc-quest-app.ts`(제안·수락·매달 판정·저장 sllm_isc_quests.json), `src/isc-quest-check.ts`(자체 검사 37개), `features/isc-app.ts`(회의 종료 연결·IPC), `ui/isc-room.html`(소집 화면 위 과제 카드, 한/영), `app/log-router.ts`(SLOT.ISC_QUEST 224), `preload.ts`.
- 게임에서 확인할 것: 자원 건네기의 `set_variable … value = prev.변수`, `is_at_war_with = prev`(상대 범위에서), 보상 적용(QUESTAPPLY) 실제 부착, 호감 ±15 반영.
