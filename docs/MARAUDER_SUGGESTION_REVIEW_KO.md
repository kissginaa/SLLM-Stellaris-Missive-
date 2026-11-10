# 약탈자(Marauders) 건의 검토 (2026-10-26, 외부 건의 → 사용자 검토 중)

건의 원문 요약: ① 채팅으로 약탈 대상 추천 ② 습격 전 요구 → 돈 주기/위협/딴 데로 돌리기(전력 차이, 경로에 공허 요새·Gigastructures 방어 구조물) ③ 중반 함대 구매 ④ 그레이트 칸 등장 때 그 약탈자를 공격 안 했고 관계가 좋았으면 특별 상호작용.
상태: 약탈자 기능은 보류 중이었음. 모드 파일이 바뀌므로 하게 되면 10.5 다음 업데이트.

## 4.5.1 script_docs 덤프로 확인한 것 (OldEnt/stellaris-triggers-modifiers-effects-list)

| 쓸 곳 | 트리거·효과 | 내용 |
| --- | --- | --- |
| ② 위협 판정 | `relative_power = { who = <국가> category = fleet value >= superior }` | 함대 전력을 pathetic/inferior/equivalent/superior/overwhelming 5단계로 비교. "압도적이면 위협 성공" 같은 규칙에 바로 씀 |
| ② 위협 판정 | `fleet_power` | 함대 전력 수치 비교 |
| ② 경로 대신 | `closest_system = { steps = N limit = { ... } }` | 우리 국경에서 N 칸 안에 방어 거대구조물(공허 요새·Gigastructures 등)이 있는지 → 위협 성공률 보너스. 실제 길찾기 경로는 스크립트로 못 읽음 |
| ②·① 습격 돌리기 | `order_forced_return`, `queue_actions`, `auto_move_to_planet` | 습격 함대를 되돌리거나 다른 곳으로 보낼 수 있음. 다만 바닐라 약탈자 습격이 이벤트로 대상을 고르는지 AI 가 고르는지는 게임 파일(events) 확인 필요 |
| ③ 함대 구매 | `create_fleet`, `set_owner` | 함대를 만들어 주거나 소유권을 넘김 |
| 거리 | `distance_to_empire`, `distance_to_capital`, `num_neighbor_systems` | 습격 위험·가격 계산 등 |

- 약탈자·그레이트 칸 전용 효과는 덤프에 없음(`num_marauder_empires_to_spawn` 트리거만). 바닐라 약탈자 이벤트·공물 요구·용병 고용 흐름은 게임 폴더 `events/` · `common/` 파일로 확인해야 함.

## 우선순위 제안
2(요구 대응) → 3(함대 구매) → 4(그레이트 칸) → 1(대상 추천). 1은 습격 대상을 고르는 방식 확인 결과에 따라 범위가 정해짐.
요구 금액·함대 가격은 퀘스트 효과 엔진(01번 문서)의 자원 범위로 AI가 정하게 하면 맞음.

## ②③ 구현 상태 (2026-10-26 집 PC 반영, 다음 업데이트용 — 모드 파일 추가)
- 수치(사용자 확정): 위협 = 함대 전력 우세 이상이면 성공 · 대등은 대화한 AI 판단 · 열세는 실패(추가 벌칙 없음). 돌리기 = 바닐라 습격 의뢰 가격 3000 ±15%(AI 가 정함). 용병 흥정 = 할인만 최대 15%(1년 안 첫 고용분을 다음 달 초 에너지로 환급).
- 흐름: 잠든 약탈자와 통화하면 매 발언 전에 게임에서 습격 상태·전력 비교(relative_power 5단계)를 읽어 프롬프트에 넣음(추가 LLM 호출 없음). AI 가 행동(marauder_withdraw / marauder_redirect / merc_discount)을 고르면 다른 제안처럼 플레이어가 수락해야 실행. 약탈자는 원래 「대화 전용」이라 이 세 행동만 열어 둠(다른 행동은 계속 막힘).
- 게임 쪽 정리는 바닐라 공물 선택지(marauder.102)와 같음: 습격 플래그·공물 등급 제거, 습격 함대 삭제, raid_cooldown. 돌리기는 바닐라 습격 의뢰처럼 새 대상에 marauder.33(from = 우리).
- 새 파일: `src/marauder-deals.ts`(규칙·명령·영어 프롬프트), `src/features/marauder-app.ts`(상태 읽기·수락·매달 정산·저장 sllm_marauders.json), `src/marauder-deals-check.ts`(자체 검사 38개), `tester-mod/common/scripted_effects/sllm_marauder_deals.txt`, `tester-mod/common/scripted_triggers/sllm_marauder_triggers.txt`.
- 바꾼 파일: `action.ts`(행동 3종 해석·문구), `prompt.ts`(약탈자면 일반 행동 목록 대신 약탈자 행동만), `features/chat.ts`(발언 전 상태 읽기·수락 연결), `main.ts`(등록·프롬프트 줄), `app/log-router.ts`(SLOT.MARAUDER 226), `selftest.ts`.
- 미확인(게임 안에서 볼 것): ① 콘솔에서 부른 marauder.33 이 from·raiding_marauder 를 제대로 받아 새 대상에 습격 함대를 보내는지 ② relative_power 방향(우리 기준 superior = 우리가 셈) ③ 습격 함대 삭제 뒤 게임 안 「습격 예고」 창이 남아 있으면 닫혀도 문제없는지 ④ 용병 고용 뒤 다음 달 환급 ⑤ `add_resource … mult = 변수`·`round_variable_to_closest`.

## ④ 그레이트 칸 특별 대우 구현 상태 (2026-10-26 집 PC 반영, 다음 업데이트용 — 모드 파일 추가)
- 사용자 확정: 「그 부족과 전투한 적」이 없고(우주 전투 이김·짐·습격 방어 모두) 「호감 +50 이상 또는 거래 이력」(습격 의뢰 hired@·용병 고용·앱의 습격 돌리기·용병 흥정)이면 → 그레이트 칸의 사자 통신·특별 대화 + 선물(합금 월수입 6개월치, 50~1,500 × 연도 배율) + 우대 태수국(칸의 총애: 기본 자원 생산 +15%, 그레이트 칸의 태수국인 동안).
- 바닐라 태수국 조건(preset_satrapy, 기본 자원 30%)은 그대로 둔다 — 반란 선택지 등 다른 바닐라 약탈자 이벤트가 그 조건 이름을 검사하기 때문. 총애 수정자로 부담을 덜어 준다.
- 흐름: 모드가 전투마다 그 부족 표식(sllm_fought_marauder_1~3)을 남김 → 그레이트 칸이 나타나면(월간 위기 줄) 앱이 세이브마다 한 번 조사(SLLM:KHAN) → 자격이면 선물·총애 표식(SLLM:KHANGIFT) + 사자 통신 알림·연대기 → 그레이트 칸과 대화할 때 「옛정」(또는 싸웠으면 「옛 원한」) 줄 → 태수국이 되면 모드가 매달 칸의 총애를 붙이고, 벗어나면 뗀다(SLLM:KHANFAVOR).
- 새 파일: `src/khan.ts`, `src/features/khan-app.ts`, `src/khan-check.ts`(17개), 모드 `events/sllm_khan_events.txt`, `common/on_actions/sllm_khan_on_actions.txt`, `common/static_modifiers/sllm_khan_modifiers.txt`, `localisation/*/sllm_khan_l_*.yml`.
- 한계: 이 업데이트 전의 전투는 기록이 없어 「싸운 적 없음」으로 본다. 공물을 낸 이력은 바닐라가 남기지 않아 세지 않는다.
- 게임에서 볼 것: 약탈자와 싸운 뒤 표식, 그레이트 칸 등장 때 사자 알림·합금, 태수국이 된 뒤 칸의 총애 수정자.

## ① 습격 대상 추천·의뢰 구현 상태 (2026-10-26 집 PC 반영, 다음 업데이트용 — 모드 파일 수정)
- 범위: 우리가 습격당하지 않을 때 약탈자에게 「누굴 털면 좋겠냐」고 물으면 후보 사정을 보고 추천하고, 그 자리에서 습격을 맡길 수 있다(행동 marauder_hire). 추가 LLM 호출 없음.
- 조건·가격: 바닐라 「습격 의뢰」(marauder.20 → 31 → 32 → 33)와 같은 조건(그 약탈자가 다른 습격·쿨다운 중이 아님), 가격은 돌리기와 같은 3000 ±15%. 대상도 돌리기와 같음(통신 중인 일반 AI 제국만, 이미 습격받는 곳 제외). 바닐라는 경쟁국만 고를 수 있지만 대화에서는 경쟁국이 아니어도 되고, 대신 **경쟁국이 아니면 가격 1.5배**(사용자 확정 2026-10-26: 3000 → 4500, ±15% 적용 후). 앱이 경쟁국 가격으로 계산했는데 수락 때 게임에서 더는 경쟁국이 아니면 받지 않는다(status=norival). **②의 돌리기에도 같은 1.5배를 적용**(사용자 확정 2026-10-26).
- 후보 사정: 발언 전 상태 읽기(sllm_mrd_status)가 통신 중인 제국마다 SLLM:MRDT 한 줄 — 우리 경쟁국·우리와 전쟁 중·우리와 국경이 닿음·이미 습격받는 중·경제가 우리보다 우세 이상, 그 제국 함대가 이 약탈자에 비해 0~4. 쓴 변수는 바로 지운다. 앱은 쓸 만한 곳부터 8곳을 프롬프트에 넣는다(돌리기 후보에도 같은 사정이 붙음).
- 바꾼 파일: `src/marauder-deals.ts`(parseTargetRow·rankTargets·targetText·hireCommand·프롬프트), `src/features/marauder-app.ts`(MRDT 수집·의뢰 수락), `src/action.ts`(marauder_hire), `src/marauder-deals-check.ts`(+15), 모드 `sllm_marauder_deals.txt`(상태에 후보 줄·free, sllm_mrd_hire).
- 게임에서 볼 것: 상태 읽기 때 `SLLM:MRDT` 줄과 `free=`, `tf` 방향(그 제국이 약탈자보다 셀 때 3·4), 의뢰 수락 뒤 에너지 차감과 대상 쪽 습격 함대(marauder.33).
