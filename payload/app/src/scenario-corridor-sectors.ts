// 회랑 섹터(2026-11-08 사용자: 「섹터별 핵심 성계만 인식 — 그 성계마다 미리 정해 놓은 행성을 차지했을 때만」).
// 회랑(세렌 통과 지대 7 · 바스틸 변경 7)의 빈 거점 14곳. 거점 성계마다 거주 가능 행성 하나(행성 표식 sllm_cr_hub_world, common/solar_system_initializers/sllm_cr_hub_initializers.txt)가 있다.
// sys = 그 섹터에 드는 성계(지도 번호) — 지도 도구(tools/gen_galaxy_overlay.py)와 같은 방법(같은 지대 안에서 항로로 가장 가까운 거점)으로 미리 계산했다. 회랑 수도 성계는 뺐다.
// 앱은 회랑이 그 거점 행성을 가졌을 때만(땅 주인 로그 SCNOWN 의 w) 그 섹터를 회랑 섹터로 그린다. 그 전에는 회랑 땅이어도 수도 섹터에 붙는다.
export interface CrHub { id: number; ko: string; en: string; pc: string; pk: string; pe: string; role: 't' | 'f'; sys: number[] }
export const CR_HUBS: CrHub[] = [
  { id: 587, ko: "찌르레기", en: "Starling", pc: "continental", pk: "대륙", pe: "Continental", role: 't', sys: [580, 581, 582, 583, 584, 585, 586, 587] },
  { id: 592, ko: "참호", en: "Trench", pc: "tundra", pk: "툰드라", pe: "Tundra", role: 't', sys: [588, 589, 590, 591, 592] },
  { id: 600, ko: "소금늪", en: "Saltmarsh", pc: "tropical", pk: "열대", pe: "Tropical", role: 't', sys: [593, 594, 595, 596, 597, 598, 599, 600, 606, 607, 609] },
  { id: 601, ko: "땅거미 호수", en: "Duskmere", pc: "tundra", pk: "툰드라", pe: "Tundra", role: 't', sys: [601, 602, 603] },
  { id: 617, ko: "빈 별", en: "Hollow Star", pc: "arid", pk: "건조", pe: "Arid", role: 't', sys: [604, 605, 608, 611, 612, 613, 614, 615, 616, 617] },
  { id: 621, ko: "바스틸 관문", en: "Bastille Gate", pc: "desert", pk: "사막", pe: "Desert", role: 't', sys: [618, 619, 620, 621] },
  { id: 624, ko: "성벽", en: "Rampart", pc: "alpine", pk: "고산", pe: "Alpine", role: 't', sys: [622, 623, 624, 625, 626] },
  { id: 634, ko: "글리제 487", en: "Gliese 487", pc: "ocean", pk: "바다", pe: "Ocean", role: 'f', sys: [627, 628, 629, 630, 631, 632, 633, 634] },
  { id: 639, ko: "로스 475", en: "Ross 475", pc: "savannah", pk: "사바나", pe: "Savannah", role: 'f', sys: [635, 636, 637, 638, 639] },
  { id: 644, ko: "스트루베 2482", en: "Struve 2482", pc: "tropical", pk: "열대", pe: "Tropical", role: 'f', sys: [640, 641, 642, 643, 644, 647, 650] },
  { id: 646, ko: "그룸브리지 1311", en: "Groombridge 1311", pc: "savannah", pk: "사바나", pe: "Savannah", role: 'f', sys: [645, 646, 648, 649] },
  { id: 655, ko: "사초", en: "Sedge", pc: "alpine", pk: "고산", pe: "Alpine", role: 'f', sys: [651, 652, 653, 654, 655] },
  { id: 656, ko: "포곽", en: "Casemate", pc: "tundra", pk: "툰드라", pe: "Tundra", role: 'f', sys: [656, 657, 658, 659, 660] },
  { id: 662, ko: "길잡이별", en: "Lodestar", pc: "continental", pk: "대륙", pe: "Continental", role: 'f', sys: [661, 662, 663, 664] },
];
export const CR_HUB_BY_ID = new Map(CR_HUBS.map((h) => [h.id, h] as [number, CrHub]));
