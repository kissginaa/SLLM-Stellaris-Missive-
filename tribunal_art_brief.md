# 은하재판소 1인칭 법정 — ChatGPT 그림 주문서

그림 3장입니다. 받은 파일을 아래 **파일 이름 그대로** `ui/assets/rooms/` 에 넣으면 앱이 알아서 바꿔 씁니다(없으면 지금 그림으로 대신 보입니다).
위치가 그림과 조금 안 맞으면 알려 주세요. 그림을 다시 그릴 필요 없이 화면 좌표만 맞추면 됩니다.

**공통으로 첨부하면 좋은 참고 그림**
- 화풍: `ruler-press-pov-v2.png`(1인칭 기자회견) — 1인칭 시점 느낌
- 재질: `tribunal-hall-v1.png`, `tribunal-bench-v1.png` — 어두운 대리석, 금색 테두리, 가는 청록색 조명

---

## 1. 법정 배경 — `tribunal-pov-hall-v1.png`
- 크기: **2560 × 1440 (16:9)**, 투명 아님
- 화면 배치(앱이 이 자리에 그림을 겹칩니다):
  - **가운데 위**: 높은 재판석, 등받이 높은 빈 의자 3개(사람 없음)
  - **왼쪽 중간(가로 5~30%, 세로 35~80%)**: **비워 둔 바닥** — 앱이 고발국 단상과 대표 초상화를 여기에 올립니다
  - **가운데(가로 35~70%, 세로 35~55%)**: 비어 있는 바닥 + 바닥의 둥근 홀로그램 투사기 — 증거 홀로그램이 뜨는 자리
  - **오른쪽**: 어둡고 흐릿한 방청석
  - **아래 25%**: 어둡고 단순하게 — 내 변론대 그림이 덮습니다
- 글자·문장·로고 없음

**프롬프트**
```
First-person view from the defendant's lectern inside a vast sci-fi galactic tribunal hall, cinematic, 16:9, 2560x1440.
Center top: a tall, elevated judges' bench with three empty high-backed seats, softly lit from above. No people at the bench.
Left middle: an open, empty marble floor area (leave it clear, no podium) where a speaker's stand will be placed later.
Center: open floor with a circular holographic projector disc set into the floor, faint cyan glow.
Right: tiered public gallery in deep shadow, distant blurred featureless silhouettes only.
Bottom quarter: dark and plain, low detail.
Materials: dark polished marble, brushed gold trim, thin cyan light strips, tall arched windows showing deep space and a planet.
Moody, dramatic lighting, high contrast, slightly desaturated. No text, no letters, no logos, no symbols of real organizations.
```

---

## 2. 고발국 단상 — `tribunal-pov-stand-v1.png`
- 크기: **약 1400 × 560**, **투명 배경 PNG**
- 낮고 넓은 연설대 앞면만. 왼쪽에서 살짝 비스듬히 본 각도
- 앞판 가운데에 이름표가 들어갈 **빈 금속판**(글자 없음)
- 대표 초상화가 이 단상 **뒤에** 서 있는 것처럼 보이도록, 윗부분은 깔끔한 가로선

**프롬프트**
```
A wide, low speaker's podium for a sci-fi galactic tribunal, front view seen slightly from the left, isolated on a transparent background, PNG, about 1400x560.
Dark polished stone with brushed gold trim and thin vertical cyan light strips, matching a dark marble courtroom.
A blank, empty metal nameplate in the center of the front panel (no text). Clean, straight top edge.
No people, no text, no logos. Soft studio lighting from above, subtle reflections.
```

---

## 3. 내 변론대(앞쪽 가장자리) — `tribunal-pov-desk-v1.png`
- 크기: **2560 × 560**, **투명 배경 PNG**
- 1인칭으로 내려다본 내 책상 앞쪽 가장자리. 화면 가로 전체를 덮음
- 책상 윗면 선은 그림 높이의 20% 쯤
- **가운데는 비워 두기** — 앱의 입력칸이 여기에 올라갑니다
- 왼쪽·오른쪽 끝에만 서류 몇 장, 데이터 패드, 작은 마이크 정도
- **손·팔 없음**(종족마다 달라서)

**프롬프트**
```
First-person view looking down at the near edge of a defendant's desk in a sci-fi galactic tribunal, spanning the full width, isolated on a transparent background, PNG, 2560x560.
The desk top edge sits about 20% down from the top of the image.
Dark polished stone and brushed gold trim with a thin cyan light strip along the edge.
Keep the center completely clear and empty. Only at the far left and far right: a few paper documents, a glowing data slate, a slim microphone.
No hands, no arms, no people, no text, no logos. Moody lighting matching a dark marble courtroom.
```

---

### 받으면 확인할 것
- 투명 배경이 진짜 투명인지(체크무늬가 그림에 박혀 있으면 안 됨)
- 재판석이 가운데 위에 있는지, 왼쪽 중간이 비어 있는지
- 글자나 이상한 기호가 그려져 있지 않은지
