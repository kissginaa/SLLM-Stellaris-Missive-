# 「회랑의 삼파전」 그림 의뢰서 (GPT, 2026-11-06)

넣을 곳: `app/ui/assets/scenario/corridor/` (앱 두 루트 모두). 파일 이름은 아래 그대로. 없으면 앱은 단색 배경으로 돌아간다.
공통: 사람(인물) 없음 · 글자·로고·실제 국기 없음 · 스텔라리스풍 SF · 16:9 그림은 1920×1080 · 투명 그림은 PNG 알파.

## 1. 접견실 배경 3장 (전체 화면 1:1 대화 · 비밀회담)
화면 가운데는 비워 둔다(상대 초상화가 크게 뜬다). 아래 4분의 1은 대화창 자리라 어둡고 단순하게.

| 파일 | 장소 | 분위기 |
|---|---|---|
| `audience_a.png` | 은하 얼라이언스 귀족의 궁정 응접실 | 밝은 대리석, 푸른 유리 천장 너머 별, 식물, 열린 공화국 느낌 |
| `audience_b.png` | 인류 제국 귀족의 집무실 | 검은 금속과 금장, 붉은 휘장, 높은 창 너머 함대, 엄격하고 무거운 느낌 |
| `audience_p.png` | 플레이어 관저(세렌 회랑)의 응접실 | 아담하고 실용적, 창밖으로 상선이 오가는 항로, 두 세력 사이의 중립지대 느낌 |

프롬프트(영어, 장마다 [ ] 부분만 바꿈):
> Wide 16:9 first-person view of [a noble's reception hall in a liberal interstellar republic: white marble, blue glass ceiling showing stars, indoor plants]. Sci-fi, Stellaris-like painterly realism, cinematic lighting. The center of the image is an empty open space at eye level (a character portrait will be placed there). The bottom quarter is a dark, plain floor area (a dialogue box will cover it). No people, no text, no logos, no real-world flags.

- B: `[an aristocrat's private office in a stern human empire: black metal and gold trim, red banners, tall windows showing warships in orbit]`
- P: `[a modest, practical reception room in a small neutral corridor state: warm lamps, a large window onto a busy space shipping lane with freighters]`

## 2. 귀족 연감 펼친 책 `peerage_open.png`
집무실의 「귀족 연감」 창 배경. 1920×1080, 위에서 내려다본 펼친 두꺼운 책 두 쪽(왼쪽 명부·관계도, 오른쪽 인물 상세).
쪽 안쪽은 글이 올라가므로 밝고 무늬 없는 종이, 가장자리만 장식.
> Top-down view of a large open leather-bound ledger on a dark desk, two blank pages filling most of the frame, subtle sci-fi gilded corners and a faint star-chart watermark only at the page margins. Pages must stay plain and light for text overlay. 16:9, no text, no people.

## 3. 초상화 틀 2장 (투명 PNG, 512×640)
명부·관계도·접견실에서 귀족 초상화 위에 겹친다. 가운데는 완전히 투명.

| 파일 | 진영 | 모양 |
|---|---|---|
| `frame_a.png` | 얼라이언스 | 은빛과 푸른빛, 별과 월계 무늬, 가벼운 선 |
| `frame_b.png` | 제국 | 검은 쇠와 금, 날개 달린 방패 무늬(실제 국장 아님), 두꺼운 테 |

> Ornate portrait frame, transparent PNG, 512x640, the inner area fully transparent. [silver and blue, stars and laurel motif, light filigree] / [black iron and gold, an invented winged-shield motif, heavy border]. No text.

## 4. 시나리오 표지 `cover.png`
시나리오를 고를 때·시작 소개 화면. 1920×1080.
> Key art: a narrow glowing star corridor between two vast empires, the left side bright blue-white (a liberal alliance), the right side dark red-gold (a stern empire), small freighters travelling through the corridor in the middle. Painterly sci-fi, Stellaris-like, dramatic, no text, no logos.

## (선택) 5. 비밀회담 밀실 `audience_secret.png`
밀사 이야기를 꺼내는 비밀회담 전용. 없으면 위 3장 중 그 귀족 쪽 배경을 어둡게 해서 쓴다.
> Wide 16:9 first-person view of a dim private back room: a single lamp, closed shutters, a small table with two glasses, star map on the wall. Center empty at eye level, bottom quarter dark and plain. Sci-fi, Stellaris-like, no people, no text.
