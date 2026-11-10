## 2026-10-19 비서 그림 23장·전용 화면 정리 (GPT 완료)

- 첨부 얼굴 기준으로 투명 자세 6장, 외출/상복 5장, 이벤트 배경 5장·CG 7장 제작. payload/app와 실행 앱에 반영. 기존 6개 자세 파일 유지.
- 이벤트 대화창·선택지·직접 입력·시간 종료 안내·기록/회상·여운·쪽지·퇴임 카드·데이트 버튼·알림 점 정리. 국장 페이드와 움직임 줄이기 대응. IPC/AI/저장 동작 변경 없음.
- 최종 검사 PASS 2390 / FAIL 0. 한/영/중국어 팩 × 3화면 크기, 6개 CG, 퇴임/기록/쪽지 캡처 확인. 중국어 시험 팩의 기존 비서 번역 누락은 영어 대체 표시.
- 상세 docs/SECRETARY_PRESENTATION_RESULT_KO.md. 예시: 새 폴더/비서_예시_20261019/비서_모아보기.html. 게임/실제 AI 미검수, 새 설치 EXE/ZIP 없음.

# 비서 그림 목록과 그리기 지시 (ChatGPT 등 그림 AI 용, 2026-10-18)

> 2026-10-19: 비서의 그림·인터페이스 다듬기는 GPT 담당. 할 일 전체(남은 자세 6장, 이벤트 의상, 배경 5·CG 7, 화면 다듬기 11가지)는 `docs/GPT_SECRETARY_TODO_KO.md` 에 모아 두었다.

비서가 말할 때마다 AI 가 행동지문과 함께 **자세(pose)** 하나를 고르고, 앱이 그 자세의 전신 그림으로 바꿔 보여 줍니다.
그림이 없는 자세는 `idle` → `secretary` → 임시 실루엣 순서로 대신하므로, 몇 장만 먼저 넣어도 됩니다.

## 넣는 곳·형식
- 폴더: `app\ui\assets\secretary\` (개발 쪽은 `payload\app\ui\assets\secretary\`)
- 파일 이름: 아래 표의 `키.png` (예: `idle.png`, `smile.png`)
- 크기: 세로 1024×1792 (9:16 가까이), **배경 투명 PNG**, 머리부터 발끝까지 전신, 발이 그림 아래쪽 끝에 닿게.
- 모든 그림에서 **같은 인물·같은 옷·같은 카메라 거리와 높이**(정면 약간 비스듬히, 눈높이). 자세만 바뀌게.
- 화면 오른쪽에 서서 왼쪽(대화창 쪽)을 보는 구도가 자연스럽습니다.

## 인물 설정(모든 그림 공통으로 붙이는 문장)
사용자 확정 기준(2026-10-18): `secretary-reference/canonical-face-sheet.png`의 **오른쪽 위 정면 얼굴**이 최우선 얼굴 기준. `secretary-reference/approved-tablet-pose.png`는 차분한 표정·곧은 자세·의상·태블릿 기준이다. 추가 얼굴 사진은 보조 참조이며, 이미 승인된 얼굴을 임의로 재설계하지 않는다.

> Same character as the TOP RIGHT frontal face in canonical-face-sheet.png. Preserve her recognizable facial proportions, large blue-gray eyes, delicate nose, softly full lips and gently tapered chin. Blonde hair in a neat low updo with loose face-framing strands. Charcoal tailored office blazer with fine champagne-gold piping, ivory high-neck blouse with gold clasp, matching skirt. A small cyan hollow circular indicator at the temple and a fine metallic seam behind the ear down the side of the neck. Realistic cinematic game character rendering, NOT anime. Calm attentive expression, no broad smile unless the pose explicitly requests it. Upright head, level shoulders, balanced posture, no fashion-model leaning. Keep the face and clothes identical across poses. True transparent PNG with no studio backdrop or light haze. Use the approved tablet pose as outfit and posture reference; change only the requested gesture.

- 기존 네이비 제복·은발/흑발·애니메이션풍 인물 설정은 폐기한다.
- 12장 제작 목표 규격(1024×1792 전신)은 유지하되, 현재 첫 적용본 `idle.png`·`report.png`는 승인된 태블릿 자세의 **1024×1536, 허벅지까지 보이는 투명 컷아웃**이다. 두 파일은 같은 기본 그림이다. 추가로 smile/sad/stern/think 표정 4종을 적용했으며, 나머지 6자세는 아직 미제작이다. 완성된 12종이라고 표기하지 않는다.
- 첫 적용본의 idle은 태블릿을 들고 차분히 대기하는 모습이다. 전신 규격으로 확장할 때 얼굴과 의상을 다시 디자인하지 않는다.
- 투명도는 알파 채널로 확인한다. 검정/갈색 스튜디오 배경은 투명 배경이 아니다.
처음에 `idle` 을 만든 뒤, 그 그림을 **참고 그림으로 함께 올리고** "Same character, same outfit, same framing" 을 붙여 나머지를 만들면 얼굴·옷이 흔들리지 않습니다.

## 자세 목록 (12장)
| 키(파일 이름) | 뜻 | 그림 지시(공통 문장 뒤에 붙이기) |
|---|---|---|
| `idle` | 차분히 서 있음(기본) | Standing calmly, hands lightly clasped in front, neutral polite expression. |
| `smile` | 살짝 미소 | Gentle soft smile, relaxed shoulders, hands clasped. |
| `bow` | 정중히 고개 숙여 인사 | Polite bow of about 30 degrees, hands together in front, eyes lowered. |
| `report` | 태블릿을 보며 보고 | Holding a glowing holographic tablet in one hand, looking up from it toward the viewer, focused expression. |
| `think` | 턱에 손을 대고 생각 | One hand to her chin, eyes slightly to the side, thoughtful. |
| `worried` | 걱정스러운 표정 | Slight frown, eyebrows drawn together, one hand at her chest. |
| `stern` | 단호하게 반대·경고 | Firm serious expression, upright, one hand slightly raised as if saying "no", direct gaze. |
| `shy` | 수줍어 시선을 피함 | Light blush, looking away to the side, fingers touching a lock of hair, small embarrassed smile. |
| `surprised` | 놀람 | Eyes widened, lips slightly parted, one hand raised near her mouth. |
| `sad` | 슬픔·서운함 | Downcast eyes, lips pressed, shoulders slightly lowered, hands clasped tightly. |
| `laugh` | 손으로 입을 가리고 웃음 | Laughing softly with eyes closed in a smile, hand covering her mouth. |
| `tender` | 다정하게 바라봄 | Warm affectionate gaze toward the viewer, soft smile, head tilted slightly, hands at her chest. |

## 나중에 넣을 수 있는 것
- `secretary.png`: 대표 그림 하나만 있을 때 쓰는 기본 그림(없으면 `idle` 을 씀).
- 관계 단계별 옷(연인·배우자) 같은 변형은 2단계 이후. 필요하면 파일 이름 규칙(`idle_lover.png` 등)을 정해 넣겠습니다.
- 수위: 창작마당·Player2 규칙 때문에 노출이나 선정적인 자세는 쓰지 않습니다.

## 집무실 책상과 겹침
- office-art.css의 #secScene::after가 기존 office-ai-v1.png를 같은 center bottom/cover 배치로 다시 그리고 책상 부분만 잘라 전경으로 사용한다.
- 레이어 순서: 방 → 비서 → 책상 전경 → 대화창/기록. 전경은 pointer-events:none으로 입력을 가로채지 않는다.
- 배경 책상 뒤쪽 경계는 원본 높이 약 68%이며 화면비에 따라 max(32vh,24vw)로 환산한다. 배경을 교체하면 경계도 재검수한다.

### 집무실 광원 기준
- idle/report 첫 적용본은 오른쪽 벽의 약한 금빛 측광, 왼쪽 창의 푸른 윤곽광, 태블릿의 청록 반사광으로 보정했다. 후속 자세도 밝은 스튜디오 정면광을 피하고 이 파일들의 광원을 따른다.
- 대화창 윗선은 비서 허리 높이(장면 높이 50%)이며 캐릭터 bottom:18vh와 책상 전경 가림을 유지한다.

### 표정 4종 및 태블릿 투명도 (2026-10-18)
- 행복=smile.png, 슬픔=sad.png, 못마땅함/부정적=stern.png, 의아함/궁금함=think.png. 현재는 손·태블릿·곧은 자세를 고정하고 표정을 바꾼 1024×1536 버전이다. 위의 자세 표는 후속 몸동작 제작 지침이다.
- 집무실 광원은 오른쪽 금빛 측광·왼쪽 푸른 윤곽광·낮은 정면 밝기를 고정한다.
- 모든 후속 그림은 태블릿 바깥 부분의 실제 알파 투명도를 유지한다. 흰색/회색 바탕을 넣지 않는다. 몸에 겹치는 부분은 옷이 보이고, 몸 바깥은 방 배경이 비쳐야 한다.
- idle/report의 태블릿도 수정했다. 집무실 배경에 합성해 표정 4종을 확인했으며 실제 AI 표정 선택은 별도 게임 검증 대상이다.

### 행동지문 연결
- AI 공통 POSE_RULE이 idle/report/smile/sad/stern/think 중 표정과 행동지문을 함께 고르도록 연결했다. 행복→smile, 슬픔→sad, 부정/못마땅→stern, 궁금/의아→think.
- 미제작 자세는 해당 파일을 먼저 찾고, 없으면 laugh/tender/shy→smile, worried→sad, surprised→think, bow→idle 순으로 대체한다. 향후 실제 자세 그림이 생기면 그것을 우선 사용한다.
- Tester TypeScript 빌드 및 UI 구문 검사 통과. 개발본 동일 소스의 secretary 실행 파일 갱신. 실제 AI 응답의 표정 선택은 게임에서 후속 확인.


## 이벤트 배경·CG (2026-10-19, 미연시식 이벤트)
이벤트 장면은 **장소 배경 위에 서 있는 그림(위의 표정 그림)** 을 겹치고, 결정적인 순간에만 **CG(배경과 인물이 함께 그려진 한 장)** 를 띄웁니다. 그림이 없으면 색 배경·서 있는 그림으로 대신하므로 하나씩 넣어도 됩니다.

### 넣는 곳·형식
- 배경: `ui/assets/secretary/bg/<키>.png` — **1920×1080 가로**, 인물 없음. 오른쪽 1/3 에 비서가 서므로 그쪽은 너무 복잡하지 않게. 아래쪽 절반에 대화창이 덮인다.
- CG: `ui/assets/secretary/cg/<키>.png` — **1920×1080 가로**, 비서와(필요하면 뒷모습·손만 보이는) 통치자가 함께 있는 장면. 비서 얼굴·옷은 위 공통 문장과 참조 그림 그대로. 아래 40% 는 대화창에 가려지니 얼굴과 핵심은 위쪽 60% 안에.
- 통치자는 종족·성별이 플레이어마다 다르므로 **얼굴을 보이지 않게**(뒷모습·실루엣·손만).
- 광원은 장면마다 다르지만 인물 그림체(사실적인 시네마틱 게임 렌더링, 애니메이션풍 아님)는 같게.

### 목록 (배경 5장 + CG 7장)
| 파일 | 장면 | 그림 지시(공통 인물 문장 뒤에) |
|---|---|---|
| `bg/balcony.png` | 집무실 옆 발코니, 밤 | Wide night view from a high balcony of a futuristic capital palace: elegant stone-and-metal railing in the foreground, an endless city of warm lights far below, a vast glowing galaxy band across the sky. No people. Calm, romantic, cinematic. 1920x1080. |
| `bg/restaurant.png` | 수도 번화가의 작은 식당(신분을 감추고 찾은 곳), 저녁 | Interior of a small, cozy restaurant in a futuristic capital's busy district at evening: a window table for two with warm lamp light, steam rising from dishes on other tables, a bustling neon street visible through the large window. No people in focus (blurred background diners at most). Warm, intimate, everyday. 1920x1080. |
| `bg/funeral_rain.png` | 비 내리는 수도 대광장의 국장 | A vast plaza of a futuristic capital during a state funeral in heavy rain: an enormous silent crowd in dark clothes standing with bowed heads, black banners and a distant memorial portrait framed in light, grey sky, rain streaks, wet stone reflecting lights. No single person in focus. Solemn, overwhelming, cinematic. 1920x1080. |
| `bg/office_night.png` | 전쟁이 선포된 밤의 집무실 | The ruler's office late at night: dim lights, a large holographic star map over the desk glowing with red front lines, papers and a cold cup on the desk, rain-streaked window. No people. Tense but quiet. 1920x1080. |
| `bg/maint_bay.png` | 집무실 아래 비밀 정비실 | A secret, clean maintenance bay beneath the palace: a glass-lidded maintenance pod bathed in soft cyan light, cables and diagnostic screens, empty technician stations. No people. Quiet, clinical, a little lonely. 1920x1080. |
| `cg/balcony.png` | 발코니에서 난간에 기대어 함께 하늘을 봄 | The secretary leaning lightly on the balcony railing beside the ruler (seen only from behind, face not visible), both looking up at the galaxy over the city lights; she glances sideways at him with a faint, shy smile; a soft night breeze moves loose strands of her hair. 1920x1080. |
| `cg/restaurant.png` | 식당 창가 자리에서 그녀가 첫 한 입을 맛봄 | At the window table of the small restaurant, the secretary in a simple disguise (light coat over her outfit) carefully tastes her first bite with a spoon, eyes slightly widened in quiet delight; the ruler sits across from her, seen only from behind or as a hand reaching over to share food from his plate. Warm lamp light, steam, neon street behind the window. 1920x1080. |
| `cg/farewell.png` | 선대 통치자의 서랍을 정리하다 작은 물건을 손바닥에 올려 든 그녀(배경은 `bg/office_night` 를 같이 씀) | In the dim office late at night, the secretary sits by an open desk drawer holding a small keepsake (an old medal or a worn data-chip) on her open palm, looking down at it with quiet grief; a small open box beside her; the new ruler stands at the edge of the frame, seen only from behind. Soft lamp light, melancholy but gentle. 1920x1080. |
| `cg/mourning.png` | 국장 인파 한가운데, 애도하는 그녀의 뒷모습 | Seen from behind: the secretary standing alone at the very center of an endless mourning crowd in the rain at the state funeral, in a simple black mourning dress, rain-soaked hair, head slightly bowed, hands clasped; the crowd around her blurred and bowed; a distant memorial portrait of the late ruler glowing ahead (face not recognizable). Her face is not visible. Grief, stillness, rain. 1920x1080. |
| `cg/retire_tv.png` | 집무실 TV 로 퇴임하는 선대의 뒷모습을 지켜봄(알림 그림) | Inside the ruler's office: a large wall screen shows a news broadcast of the former ruler (only a dark silhouette from behind) walking away down a long hall or onto a shuttle ramp after leaving office; in the foreground the secretary stands watching the screen, seen from behind or in profile with her face mostly turned away, tablet lowered. Quiet, bittersweet. 1920x1080. |
| `cg/war_night.png` | 그녀가 책상에 따뜻한 차를 내려놓음 | In the dim office at night under the red-lit holographic war map, the secretary gently sets a steaming cup of tea beside the ruler's hand on the desk (ruler shown only as a hand and shoulder), her expression worried but warm. 1920x1080. |
| `cg/maintenance.png` | 정비 포드 안에서 잠드는 그녀 | The secretary lying peacefully inside a glass-lidded maintenance pod with cyan light, eyes nearly closed, the blue ring at her temple dimming; the ruler's hand rests on the outside of the glass. Tender, quiet. 1920x1080. |

- 수위: 노출·선정적 구도 금지(창작마당·Player2 규칙). 손잡기·기대기 정도까지.
