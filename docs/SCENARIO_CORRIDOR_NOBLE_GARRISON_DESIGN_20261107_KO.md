# 회랑의 삼파전 — 영지 수비대 설계 (2026-11-07)

사용자 요청: 「귀족마다 자기 함대 — 너무 많으면 차라리 전초기지·민방위군 같은 것(무역선 때 본 Live Space 모드처럼)」.

## 결정
- **숨은 수비대 나라는 둘뿐**: 강대국(얼라이언스 a / 제국 b)마다 하나씩, `sllm_cr_garrison` 나라 종류. AI 없음·국경 없음·접촉 목록에 안 보임. 귀족 63명이 따로 나라가 되지 않는다.
- **귀족 수비대 = 거점 성계의 방어 플랫폼**(`military_station_small`, 움직이지 않음) + **거점 행성의 영지 민병대**(방어 지상군 `sllm_cr_militia`).
  함대 이름 「<귀족> 가 수비대」, 깃발 `sllm_cr_garf`, 변수 `sllm_cr_gar_nid` = 귀족 번호.
- **크기**(앱, `garrisonOf`): 플랫폼 = 1 + 영지 성계 수/4 + (요새 +2 · 조병창 +1) + (용맹 +1), 1~6기. 민병대 = 2 + (요새 +2) + 영지 성계 수/6, 1~6개.
  처음 배치에서 모두 약 215기 · 민병대 약 195개(수도 섹터 귀족 4명은 영지가 없어 없음).
- **충성**: 「모반의 기미」(3단계) 아래면 수비대가 손을 놓는다(passive, 교전 안 함). 충성이 돌아오면 다시 aggressive.
- **반란**: 그 귀족의 수비대가 반란국으로 넘어간다(`sllm_cr_gar_defect`, 반란 효과 셋 모두 안에서).
- **전쟁**: 수비대 나라의 적대 관계를 모국과 같게 — 게임이 스스로 전쟁 시작·끝(`on_war_beginning`/`on_war_ended`)과 해마다(`sllm_cr.51`). 상대가 다른 강대국의 수비대 나라면 그 모국 기준.

## 게임 부담(매달 신호 금지 규칙)
- 앱은 **연례 회의 때만** 크기를 맞춘다 — 달라진 귀족만. **5년마다 한 번은 전부 다시 짠다**(전쟁에서 부서진 플랫폼 채우기). 한 줄에 효과 4개씩.
- 매달은 **충성 단계가 바뀌어 손을 놓거나 다시 잡을 때만** 태세 한 줄(`sllm_cr_gar_stance`, 다시 짓지 않음).
- 민병대는 늘어난 만큼만 더한다(게임 쪽에서 줄이지 않음 — 지상군 종류 판정 트리거를 쓰지 않으려고).

## 줄다리기(성계 쟁탈 현황판)에 주는 영향
- 지키는 쪽: 거점에서 2칸 안의 성계면 플랫폼마다 +0.4(「영지 수비대」 줄).
- 미는 쪽: 공작이 「무력 시위」일 때만 플랫폼마다 +0.3.
- 손 놓은 수비대는 0. 시뮬레이션: 한 해 넘어가는 성계 3~14곳, 전선 55~75곳(전과 비슷).

## 파일
- 모드: `common/country_types/sllm_cr_garrison_types.txt`, `common/armies/sllm_cr_armies.txt`, `common/scripted_effects/sllm_cr_garrison_effects.txt`,
  `common/scripted_effects/sllm_cr_intel_effects.txt`(반란 효과 셋에 수비대 넘기기 한 줄씩), `common/on_actions/sllm_cr_garrison_on_actions.txt`,
  `events/sllm_cr_garrison_events.txt`(sllm_cr.51), `localisation/<10개 언어>/sllm_cr_garrison_l_<언어>.yml`(`tools/gen_garrison_loc.py` 가 만듦).
- 앱: `src/scenario-domains.ts`(GAR · garrisonOf · 줄다리기 반영), `src/features/scenario-domains-app.ts`(garSync), `ui/office-nobles.js`(인물 파일 「수비대」 칸 · 현황판 줄), `ui/scenario-dev.js`(「영지 수비대 모두 다시 짜기」).

## 게임에서 확인할 것
1. 개발자 패널 「귀족 연례 판단 지금 돌리기」 → 「영지 수비대 모두 다시 짜기」 → 귀족 거점 성계에 플랫폼과 「… 가 수비대」 함대가 생기는지.
2. error.log 에 `sllm_cr_gar`·`sllm_cr_militia` 관련 오류가 없는지(특히 `random_existing_design`, `create_army`, `set_hostile`).
3. 전쟁을 걸면 적 함대가 수비대와 싸우는지, 평화가 되면 멈추는지.
4. 반란(개발자 패널)을 일으키면 수비대가 반란국 소유가 되는지.
5. 게임 속도(렉) — 플랫폼 약 215기.
