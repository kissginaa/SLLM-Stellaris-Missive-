// 스텔라체스(2026-10-31 사용자 결정) — 카지노 정거장의 함대 오토배틀러. 순수 규칙(electron 없이 selftest).
// 장르만 빌려 옴(림월드 「RimtoChess」 같은 TFT식 오토배틀러) — 코드·그림·이름은 우리 것. 유닛 = 함선(사용자 결정), 게임 효과 없음(재미로만, 사용자 결정), AI 없음.
// 한 판(런): 금고에서 바이인 → 20라운드(5·10·15·20 보스) → 이긴 보스 단계만큼 배당. 보스를 이긴 뒤에는 「철수」로 그 배당을 받고 끝낼 수 있음.
// 라운드마다 상점(5칸)에서 함선을 사고, 같은 함선 3척 = ★2, ★2 3척 = ★3. 앞줄 4 · 뒷줄 4 자리, 함대 규모(레벨)만큼 배치. 무기 계열·역할 시너지, 부품 장착.
// 전투는 정해진 씨앗으로 계산(같은 씨앗 = 같은 전투) → 화면은 기록을 재생만 한다. 수치는 처음 조정값(해 보며 고침).

export type Family = 'kinetic' | 'energy' | 'explosive' | 'strike';
/** 무기 특성(2026-11-03 사용자: 종족 도배 말고도 빌드를 짤 수 있게 — 롤토체스 직업처럼 무기를 9갈래로 세분). 계열(fam)은 탄 모양·층별 배율에만 씀. */
export type Weapon = 'massdriver' | 'autocannon' | 'railgun' | 'laser' | 'plasma' | 'lance' | 'missile' | 'torpedo' | 'strike';
export type Role = 'picket' | 'line' | 'artillery' | 'raider' | 'carrier';
/** 부품 8개 + 완성 아이템 36개(2026-11-03 사용자: 롤토체스처럼 부품 둘 = 완성 하나 — 이름·효과는 우리 것). */
export type CompId = 'armor' | 'shield' | 'computer' | 'thruster' | 'reactor' | 'sensor' | 'ecm' | 'nanite';
export type ItemId = string;
export interface ShipDef { id: string; ko: string; en: string; cost: 1 | 2 | 3 | 4 | 5; fam: Family; role: Role; hp: number; sh: number; ar: number; dmg: number; cd: number; /** 종족(2026-11-03: 종족마다 함선 5척, 그림도 종족별). */ sp?: Origin; /** false = 상점에 안 나옴(보스·이변 전용). */ shop?: boolean; /** 보스 전용 능력(2026-11-03): aoe = 맞은 목표 둘레 반경 안 적 모두에게 60% 피해, multi = 사격마다 무작위 적에게 추가 공격 수(70%). big = 화면에서 크게. */ aoe?: number; multi?: number; big?: number; /** 렉(2026-11-03 6번 보스): every초마다 적 n척을 dur초 동안 멈춤. */ lag?: { every: number; n: number; dur: number }; /** 보스 함선의 아이템식 효과(itemStats 의 fx 와 같은 열쇠). */ fx?: Record<string, number> }

export const SHIPS: ShipDef[] = [
  { id: 'escort_corvette', ko: '호위 코르벳', en: 'Escort Corvette', cost: 1, fam: 'kinetic', role: 'raider', hp: 260, sh: 120, ar: 40, dmg: 22, cd: 6, sp: 'humanoid' },
  { id: 'laser_corvette', ko: '레이저 코르벳', en: 'Laser Corvette', cost: 1, fam: 'energy', role: 'raider', hp: 240, sh: 100, ar: 60, dmg: 24, cd: 6, shop: false },
  { id: 'torpedo_boat', ko: '어뢰정', en: 'Torpedo Boat', cost: 1, fam: 'explosive', role: 'raider', hp: 220, sh: 60, ar: 60, dmg: 40, cd: 10, shop: false },
  { id: 'picket_destroyer', ko: '경계 구축함', en: 'Picket Destroyer', cost: 1, fam: 'kinetic', role: 'picket', hp: 420, sh: 180, ar: 120, dmg: 18, cd: 8, shop: false },
  { id: 'patrol_carrier', ko: '초계 모함', en: 'Patrol Carrier', cost: 1, fam: 'strike', role: 'carrier', hp: 300, sh: 120, ar: 80, dmg: 12, cd: 5, shop: false },
  { id: 'destroyer', ko: '구축함', en: 'Destroyer', cost: 2, fam: 'energy', role: 'line', hp: 480, sh: 180, ar: 160, dmg: 30, cd: 7, sp: 'humanoid' },
  { id: 'flak_destroyer', ko: '대공 구축함', en: 'Flak Destroyer', cost: 2, fam: 'kinetic', role: 'picket', hp: 520, sh: 220, ar: 180, dmg: 20, cd: 7, shop: false },
  { id: 'missile_frigate', ko: '미사일 프리깃', en: 'Missile Frigate', cost: 2, fam: 'explosive', role: 'artillery', hp: 360, sh: 120, ar: 80, dmg: 48, cd: 11, shop: false },
  { id: 'gunboat', ko: '포함', en: 'Gunboat', cost: 2, fam: 'kinetic', role: 'artillery', hp: 380, sh: 160, ar: 100, dmg: 38, cd: 9, shop: false },
  { id: 'assault_cruiser', ko: '돌격 순양함', en: 'Assault Cruiser', cost: 3, fam: 'kinetic', role: 'line', hp: 760, sh: 300, ar: 260, dmg: 40, cd: 7, sp: 'humanoid' },
  { id: 'lance_cruiser', ko: '광선 순양함', en: 'Lance Cruiser', cost: 3, fam: 'energy', role: 'artillery', hp: 640, sh: 240, ar: 220, dmg: 64, cd: 11, shop: false },
  { id: 'escort_carrier', ko: '호위 항모', en: 'Escort Carrier', cost: 3, fam: 'strike', role: 'carrier', hp: 700, sh: 280, ar: 200, dmg: 22, cd: 5, shop: false },
  { id: 'interceptor', ko: '요격 순양함', en: 'Interceptor Cruiser', cost: 3, fam: 'explosive', role: 'raider', hp: 620, sh: 220, ar: 200, dmg: 46, cd: 8, shop: false },
  { id: 'battleship', ko: '전함', en: 'Battleship', cost: 4, fam: 'kinetic', role: 'artillery', hp: 1100, sh: 420, ar: 380, dmg: 90, cd: 11, sp: 'humanoid' },
  { id: 'particle_battleship', ko: '입자 전함', en: 'Particle Battleship', cost: 4, fam: 'energy', role: 'artillery', hp: 1050, sh: 380, ar: 420, dmg: 100, cd: 12, shop: false },
  { id: 'fleet_carrier', ko: '함대 항모', en: 'Fleet Carrier', cost: 4, fam: 'strike', role: 'carrier', hp: 1150, sh: 400, ar: 360, dmg: 34, cd: 5, shop: false },
  { id: 'bulwark', ko: '방벽 전함', en: 'Bulwark Battleship', cost: 4, fam: 'energy', role: 'picket', hp: 1400, sh: 520, ar: 460, dmg: 50, cd: 9, shop: false },
  { id: 'titan', ko: '타이탄', en: 'Titan', cost: 5, fam: 'energy', role: 'line', hp: 2000, sh: 700, ar: 620, dmg: 140, cd: 12, sp: 'humanoid' },
  { id: 'juggernaut', ko: '저거너트', en: 'Juggernaut', cost: 5, fam: 'strike', role: 'line', hp: 2600, sh: 900, ar: 800, dmg: 60, cd: 6, shop: false },
  { id: 'doom_cruiser', ko: '종말 미사일 순양함', en: 'Doom Cruiser', cost: 5, fam: 'explosive', role: 'artillery', hp: 1500, sh: 400, ar: 400, dmg: 160, cd: 14, shop: false },
  // ---- 2026-11-03 사용자: 종족마다 함선 디자인을 따로 — 10종족 × 5척(가격 1~5). 인간형은 위의 다섯 척(첫 그림).
  { id: 'mam_guard', ko: '털가죽 경비정', en: 'Pelt Guard', cost: 1, fam: 'kinetic', role: 'picket', hp: 360, sh: 160, ar: 80, dmg: 14, cd: 7, sp: 'mammalian' },
  { id: 'mam_hound', ko: '사냥개 쾌속정', en: 'Hound Cutter', cost: 2, fam: 'explosive', role: 'raider', hp: 360, sh: 100, ar: 110, dmg: 45, cd: 9, sp: 'mammalian' },
  { id: 'mam_den', ko: '굴 모함', en: 'Den Carrier', cost: 3, fam: 'strike', role: 'carrier', hp: 680, sh: 260, ar: 210, dmg: 23, cd: 5, sp: 'mammalian' },
  { id: 'mam_howler', ko: '포효 포함', en: 'Howler Gunship', cost: 4, fam: 'energy', role: 'artillery', hp: 1000, sh: 340, ar: 370, dmg: 110, cd: 13, sp: 'mammalian' },
  { id: 'mam_alpha', ko: '우두머리 기함', en: 'Alpha Flagship', cost: 5, fam: 'kinetic', role: 'line', hp: 2180, sh: 720, ar: 590, dmg: 99, cd: 10, sp: 'mammalian' },
  { id: 'rep_fang', ko: '송곳니 습격정', en: 'Fang Raider', cost: 1, fam: 'explosive', role: 'raider', hp: 230, sh: 70, ar: 60, dmg: 32, cd: 8, sp: 'reptilian' },
  { id: 'rep_scale', ko: '비늘 구축함', en: 'Scale Destroyer', cost: 2, fam: 'kinetic', role: 'picket', hp: 570, sh: 250, ar: 160, dmg: 19, cd: 8, sp: 'reptilian' },
  { id: 'rep_stalker', ko: '매복 순양함', en: 'Stalker Cruiser', cost: 3, fam: 'kinetic', role: 'raider', hp: 610, sh: 240, ar: 160, dmg: 46, cd: 7, sp: 'reptilian' },
  { id: 'rep_spitter', ko: '독침 포격함', en: 'Venom Spitter', cost: 4, fam: 'explosive', role: 'artillery', hp: 950, sh: 260, ar: 340, dmg: 130, cd: 17, sp: 'reptilian' },
  { id: 'rep_tyrant', ko: '폭군 전함', en: 'Tyrant Dreadnought', cost: 5, fam: 'kinetic', role: 'line', hp: 2180, sh: 720, ar: 590, dmg: 99, cd: 10, sp: 'reptilian' },
  { id: 'avi_nest', ko: '둥지 모함', en: 'Nest Tender', cost: 1, fam: 'strike', role: 'carrier', hp: 270, sh: 110, ar: 70, dmg: 12, cd: 5, sp: 'avian' },
  { id: 'avi_talon', ko: '발톱 요격정', en: 'Talon Interceptor', cost: 2, fam: 'energy', role: 'raider', hp: 380, sh: 130, ar: 120, dmg: 37, cd: 7, sp: 'avian' },
  { id: 'avi_swift', ko: '칼날깃 순양함', en: 'Bladewing Cruiser', cost: 3, fam: 'explosive', role: 'raider', hp: 580, sh: 150, ar: 180, dmg: 60, cd: 9, sp: 'avian' },
  { id: 'avi_roost', ko: '횃대 항모', en: 'Roost Carrier', cost: 4, fam: 'strike', role: 'carrier', hp: 1180, sh: 420, ar: 380, dmg: 36, cd: 6, sp: 'avian' },
  { id: 'avi_phoenix', ko: '불사조 전함', en: 'Phoenix Battleship', cost: 5, fam: 'energy', role: 'artillery', hp: 1620, sh: 530, ar: 560, dmg: 167, cd: 14, sp: 'avian' },
  { id: 'art_drone', ko: '일개미 경비정', en: 'Worker Picket', cost: 1, fam: 'kinetic', role: 'picket', hp: 360, sh: 160, ar: 80, dmg: 14, cd: 7, sp: 'arthropoid' },
  { id: 'art_stinger', ko: '침 쾌속정', en: 'Stinger Skiff', cost: 2, fam: 'explosive', role: 'raider', hp: 360, sh: 100, ar: 110, dmg: 45, cd: 9, sp: 'arthropoid' },
  { id: 'art_carapace', ko: '갑각 순양함', en: 'Carapace Cruiser', cost: 3, fam: 'kinetic', role: 'line', hp: 780, sh: 290, ar: 220, dmg: 42, cd: 7, sp: 'arthropoid' },
  { id: 'art_hive', ko: '군체 모함', en: 'Hive Carrier', cost: 4, fam: 'strike', role: 'carrier', hp: 1180, sh: 420, ar: 380, dmg: 36, cd: 6, sp: 'arthropoid' },
  { id: 'art_queen', ko: '여왕 전함', en: 'Brood Queen', cost: 5, fam: 'explosive', role: 'artillery', hp: 1530, sh: 410, ar: 510, dmg: 199, cd: 19, sp: 'arthropoid' },
  { id: 'mol_glimmer', ko: '미광 코르벳', en: 'Glimmer Corvette', cost: 1, fam: 'energy', role: 'raider', hp: 240, sh: 80, ar: 60, dmg: 26, cd: 6, sp: 'molluscoid' },
  { id: 'mol_spiral', ko: '나선 포격함', en: 'Spiral Lancer', cost: 2, fam: 'energy', role: 'artillery', hp: 360, sh: 140, ar: 130, dmg: 52, cd: 10, sp: 'molluscoid' },
  { id: 'mol_shell', ko: '소라 방벽함', en: 'Conch Bulwark', cost: 3, fam: 'energy', role: 'picket', hp: 920, sh: 320, ar: 300, dmg: 29, cd: 8, sp: 'molluscoid' },
  { id: 'mol_ink', ko: '먹물 항모', en: 'Ink Carrier', cost: 4, fam: 'strike', role: 'carrier', hp: 1180, sh: 420, ar: 380, dmg: 36, cd: 6, sp: 'molluscoid' },
  { id: 'mol_oracle', ko: '신탁 전함', en: 'Oracle Leviathan', cost: 5, fam: 'energy', role: 'line', hp: 2180, sh: 580, ar: 730, dmg: 110, cd: 10, sp: 'molluscoid' },
  { id: 'fun_puff', ko: '포자 포격정', en: 'Puffball Battery', cost: 1, fam: 'explosive', role: 'artillery', hp: 220, sh: 70, ar: 60, dmg: 44, cd: 12, sp: 'fungoid' },
  { id: 'fun_cap', ko: '갓 모함', en: 'Cap Carrier', cost: 2, fam: 'strike', role: 'carrier', hp: 420, sh: 170, ar: 130, dmg: 17, cd: 5, sp: 'fungoid' },
  { id: 'fun_mycel', ko: '균사 순양함', en: 'Mycelium Cruiser', cost: 3, fam: 'explosive', role: 'line', hp: 740, sh: 180, ar: 240, dmg: 55, cd: 10, sp: 'fungoid' },
  { id: 'fun_bloom', ko: '개화 방벽함', en: 'Bloom Bulwark', cost: 4, fam: 'kinetic', role: 'picket', hp: 1590, sh: 620, ar: 450, dmg: 41, cd: 10, sp: 'fungoid' },
  { id: 'fun_rot', ko: '부패 전함', en: 'Blight Dreadnought', cost: 5, fam: 'explosive', role: 'artillery', hp: 1530, sh: 410, ar: 510, dmg: 199, cd: 19, sp: 'fungoid' },
  { id: 'pla_sprout', ko: '새싹 경비정', en: 'Sprout Picket', cost: 1, fam: 'energy', role: 'picket', hp: 360, sh: 130, ar: 100, dmg: 15, cd: 7, sp: 'plantoid' },
  { id: 'pla_thorn', ko: '가시 구축함', en: 'Thorn Destroyer', cost: 2, fam: 'kinetic', role: 'line', hp: 480, sh: 190, ar: 140, dmg: 31, cd: 7, sp: 'plantoid' },
  { id: 'pla_pollen', ko: '꽃가루 모함', en: 'Pollen Carrier', cost: 3, fam: 'strike', role: 'carrier', hp: 680, sh: 260, ar: 210, dmg: 23, cd: 5, sp: 'plantoid' },
  { id: 'pla_bark', ko: '나무껍질 방벽함', en: 'Barkhide Bulwark', cost: 4, fam: 'energy', role: 'picket', hp: 1590, sh: 510, ar: 550, dmg: 45, cd: 10, sp: 'plantoid' },
  { id: 'pla_elder', ko: '고목 전함', en: 'Elder Grove', cost: 5, fam: 'explosive', role: 'artillery', hp: 1530, sh: 410, ar: 510, dmg: 199, cd: 19, sp: 'plantoid' },
  { id: 'lit_pebble', ko: '자갈 전열함', en: 'Pebble Gunship', cost: 1, fam: 'kinetic', role: 'line', hp: 310, sh: 120, ar: 70, dmg: 22, cd: 6, sp: 'lithoid' },
  { id: 'lit_slab', ko: '석판 경비함', en: 'Slab Picket', cost: 2, fam: 'kinetic', role: 'picket', hp: 570, sh: 250, ar: 160, dmg: 19, cd: 8, sp: 'lithoid' },
  { id: 'lit_crystal', ko: '수정 포격함', en: 'Crystal Lancer', cost: 3, fam: 'energy', role: 'artillery', hp: 580, sh: 210, ar: 210, dmg: 70, cd: 10, sp: 'lithoid' },
  { id: 'lit_basalt', ko: '현무암 순양함', en: 'Basalt Cruiser', cost: 4, fam: 'explosive', role: 'line', hp: 1290, sh: 290, ar: 440, dmg: 85, cd: 12, sp: 'lithoid' },
  { id: 'lit_monolith', ko: '거석 요새함', en: 'Monolith Citadel', cost: 5, fam: 'energy', role: 'picket', hp: 2560, sh: 790, ar: 830, dmg: 69, cd: 11, sp: 'lithoid' },
  { id: 'mac_probe', ko: '탐사 드론', en: 'Probe Drone', cost: 1, fam: 'energy', role: 'raider', hp: 240, sh: 80, ar: 60, dmg: 26, cd: 6, sp: 'machine' },
  { id: 'mac_rail', ko: '레일건 포격함', en: 'Railgun Platform', cost: 2, fam: 'kinetic', role: 'artillery', hp: 360, sh: 170, ar: 110, dmg: 47, cd: 10, sp: 'machine' },
  { id: 'mac_node', ko: '연산 노드함', en: 'Node Cruiser', cost: 3, fam: 'energy', role: 'line', hp: 780, sh: 230, ar: 270, dmg: 46, cd: 8, sp: 'machine' },
  { id: 'mac_swarm', ko: '미사일 군집함', en: 'Missile Swarmer', cost: 4, fam: 'explosive', role: 'raider', hp: 1010, sh: 250, ar: 320, dmg: 95, cd: 12, sp: 'machine' },
  { id: 'mac_core', ko: '중추 모함', en: 'Core Mothership', cost: 5, fam: 'strike', role: 'carrier', hp: 1900, sh: 650, ar: 570, dmg: 55, cd: 7, sp: 'machine' },
  // ---- 보스 전용(2026-11-03 사용자: … · 같은 날 「좀 더 어렵게」로 선체 1.15배: 보스마다 전용 함선 — 스텔라리스의 강적에서 이름을 빌림, 그림은 새로 디자인)
  { id: 'khan_flagship', ko: '대칸의 기함', en: 'Great Khan\'s Flagship', cost: 5, fam: 'kinetic', role: 'line', hp: 1310, sh: 340, ar: 340, dmg: 46, cd: 9, shop: false, big: 1.5, multi: 1 },
  { id: 'horde_raider', ko: '무리 습격선', en: 'Horde Raider', cost: 2, fam: 'kinetic', role: 'raider', hp: 220, sh: 60, ar: 60, dmg: 16, cd: 6, shop: false },
  { id: 'horde_lancer', ko: '무리 창기함', en: 'Horde Lancer', cost: 3, fam: 'explosive', role: 'raider', hp: 300, sh: 60, ar: 90, dmg: 27, cd: 9, shop: false },
  { id: 'horde_carrier', ko: '무리 모함', en: 'Horde Carrier', cost: 3, fam: 'strike', role: 'carrier', hp: 360, sh: 120, ar: 90, dmg: 9, cd: 5, shop: false },
  { id: 'dim_horror', ko: '차원의 공포', en: 'Dimensional Horror', cost: 5, fam: 'energy', role: 'line', hp: 9020, sh: 1690, ar: 1400, dmg: 84, cd: 8, shop: false, big: 2.6, multi: 3 },
  { id: 'ether_drake', ko: '에테르 드레이크', en: 'Ether Drake', cost: 5, fam: 'energy', role: 'line', hp: 15620, sh: 2730, ar: 2730, dmg: 176, cd: 10, shop: false, big: 2.8, aoe: 170 },
  { id: 'unbidden_herald', ko: '언비든 전령', en: 'Unbidden Herald', cost: 5, fam: 'energy', role: 'artillery', hp: 3950, sh: 1380, ar: 680, dmg: 149, cd: 11, shop: false, big: 2, aoe: 120 },
  { id: 'unbidden_warform', ko: '차원 전투체', en: 'Unbidden Warform', cost: 4, fam: 'energy', role: 'line', hp: 1110, sh: 520, ar: 180, dmg: 54, cd: 8, shop: false },
  { id: 'unbidden_lurker', ko: '차원 잠복체', en: 'Unbidden Lurker', cost: 3, fam: 'energy', role: 'raider', hp: 600, sh: 290, ar: 90, dmg: 46, cd: 6, shop: false },
  { id: 'cetana', ko: '세타나', en: 'Cetana', cost: 5, fam: 'energy', role: 'artillery', hp: 10270, sh: 2060, ar: 1710, dmg: 113, cd: 10, shop: false, big: 3, aoe: 150, multi: 2 },
  { id: 'cetana_shard', ko: '세타나의 파편', en: 'Cetana Shard', cost: 4, fam: 'explosive', role: 'raider', hp: 710, sh: 140, ar: 310, dmg: 41, cd: 8, shop: false },
  { id: 'preth_queen', ko: '프레소린 군체 모체', en: 'Prethoryn Brood Mother', cost: 5, fam: 'strike', role: 'carrier', hp: 3240, sh: 330, ar: 860, dmg: 64, cd: 6, shop: false, big: 2.2, multi: 2, fx: { steal: 0.2, hpRegen: 0.02 } },
  { id: 'preth_hunter', ko: '프레소린 사냥체', en: 'Prethoryn Hunter', cost: 3, fam: 'explosive', role: 'raider', hp: 820, sh: 0, ar: 270, dmg: 46, cd: 6, shop: false, fx: { hpRegen: 0.03 } },
  { id: 'preth_spitter', ko: '프레소린 산성 포격체', en: 'Prethoryn Acid Spitter', cost: 3, fam: 'explosive', role: 'artillery', hp: 630, sh: 0, ar: 190, dmg: 60, cd: 10, shop: false, aoe: 80, fx: { hpRegen: 0.03, shred: 0.05 } },
  { id: 'lag_avatar', ko: '후반 렉의 화신', en: 'Avatar of Late-Game Lag', cost: 5, fam: 'energy', role: 'artillery', hp: 17030, sh: 2960, ar: 2960, dmg: 147, cd: 12, shop: false, big: 3, aoe: 140, lag: { every: 4, n: 3, dur: 1.6 } },
  { id: 'lag_echo', ko: '연산 지연 잔상', en: 'Desync Echo', cost: 3, fam: 'energy', role: 'line', hp: 1480, sh: 300, ar: 190, dmg: 30, cd: 9, shop: false },
  { id: 'cetana_warden', ko: '세타나의 수호기', en: 'Cetana Warden', cost: 4, fam: 'kinetic', role: 'picket', hp: 1190, sh: 470, ar: 470, dmg: 24, cd: 8, shop: false },
];
export const shipById = (id: string): ShipDef | undefined => SHIPS.find((s) => s.id === id);
/** 상점·일반 적 함대에 나오는 함선(종족 함선 50척). 나머지는 보스 전용. */
export const SHOP_SHIPS: ShipDef[] = SHIPS.filter((s) => s.shop !== false);

// 종족 특성(2026-11-03 사용자: 롤토체스 계열처럼 — TFT 세트 13 계열 구조를 참고해 스텔라리스 종족으로 새로 지음 → 같은 날 「종족마다 함선을 따로」로 10종족 × 5척).
// 인간형=부품 후원 · 포유류=복수심 · 파충류=약탈(격침 누적·전리품) · 조류=수리 · 절지류=외골격 반사 · 연체류=장막의 화신 소환 · 균류=포자 · 식물=성장(3라운드마다 영구) · 암석=피해 감소 · 기계=충전 방전.
export type Origin = 'humanoid' | 'mammalian' | 'reptilian' | 'avian' | 'arthropoid' | 'molluscoid' | 'fungoid' | 'plantoid' | 'lithoid' | 'machine';
export const ORIGIN_IDS: Origin[] = ['humanoid', 'mammalian', 'reptilian', 'avian', 'arthropoid', 'molluscoid', 'fungoid', 'plantoid', 'lithoid', 'machine'];
export const originsOf = (id: string): Origin[] => { const d = SHIPS.find((s) => s.id === id); return d && d.sp ? [d.sp] : []; };
export const ORIGIN_NAMES: Record<Origin, [string, string]> = { humanoid: ['인간형', 'Humanoid'], mammalian: ['포유류', 'Mammalian'], reptilian: ['파충류', 'Reptilian'], avian: ['조류', 'Avian'], arthropoid: ['절지류', 'Arthropoid'], molluscoid: ['연체류', 'Molluscoid'], fungoid: ['균류', 'Fungoid'], plantoid: ['식물', 'Plantoid'], lithoid: ['암석', 'Lithoid'], machine: ['기계', 'Machine'] };
/** 식물 성장 한 번 = +6%, 최대 6번. */
export const GROW = 0.06, GROW_MAX = 6;
export const AVATAR = [null, { hp: 900, sh: 300, ar: 200, dmg: 45, cd: 7 }, { hp: 1900, sh: 650, ar: 450, dmg: 95, cd: 7 }] as const;

export const WEAPON_OF: Record<string, Weapon> = {
  assault_cruiser: 'massdriver', mam_alpha: 'massdriver', rep_tyrant: 'massdriver', art_carapace: 'massdriver', fun_bloom: 'massdriver',
  mam_guard: 'autocannon', rep_scale: 'autocannon', art_drone: 'autocannon', lit_slab: 'autocannon', escort_corvette: 'autocannon', rep_stalker: 'autocannon',
  battleship: 'railgun', mac_rail: 'railgun', pla_thorn: 'railgun', lit_pebble: 'railgun',
  avi_talon: 'laser', mol_glimmer: 'laser', mac_probe: 'laser', destroyer: 'laser', mac_node: 'laser',
  mol_shell: 'plasma', pla_sprout: 'plasma', pla_bark: 'plasma', lit_monolith: 'plasma', mol_oracle: 'plasma',
  mam_howler: 'lance', avi_phoenix: 'lance', mol_spiral: 'lance', lit_crystal: 'lance', titan: 'lance',
  fun_puff: 'missile', rep_spitter: 'missile', art_queen: 'missile', fun_rot: 'missile', pla_elder: 'missile', mac_swarm: 'missile',
  mam_hound: 'torpedo', rep_fang: 'torpedo', avi_swift: 'torpedo', art_stinger: 'torpedo', fun_mycel: 'torpedo', lit_basalt: 'torpedo',
};
/** 함선의 무기 특성(표에 없으면 계열로: 보스·옛 함선). */
export const weaponOf = (id: string): Weapon => { const w = WEAPON_OF[id]; if (w) return w; const f = SHIPS.find((s) => s.id === id)?.fam; return f === 'kinetic' ? 'massdriver' : f === 'energy' ? 'laser' : f === 'explosive' ? 'missile' : 'strike'; };
export const WEAPON_NAMES: Record<Weapon, [string, string]> = { massdriver: ['질량 투사기', 'Mass driver'], autocannon: ['자동포', 'Autocannon'], railgun: ['레일건', 'Railgun'], laser: ['레이저', 'Laser'], plasma: ['플라스마', 'Plasma'], lance: ['광선창', 'Lance'], missile: ['미사일', 'Missile'], torpedo: ['어뢰', 'Torpedo'], strike: ['함재기', 'Strike craft'] };
export const FAMILY_NAMES: Record<Family, [string, string]> = { kinetic: ['키네틱', 'Kinetic'], energy: ['에너지', 'Energy'], explosive: ['폭발', 'Explosive'], strike: ['함재기', 'Strike craft'] };
export const ROLE_NAMES: Record<Role, [string, string]> = { picket: ['경계', 'Picket'], line: ['전열', 'Line'], artillery: ['포격', 'Artillery'], raider: ['기습', 'Raider'], carrier: ['항모', 'Carrier'] };
/** 시너지 단계(같은 종류의 서로 다른 함선 수)와 효과 설명. 값은 단계별. */
export const SYNERGY = {
  // 무기 특성 9갈래(2026-11-03 사용자: 롤토체스 직업처럼) — 그 무기를 단 함선에만
  massdriver: { at: [2, 4], val: [0.2, 0.4], ko: '질량 투사기 함선의 발사 간격 감소', en: 'Mass driver ships fire faster' },
  autocannon: { at: [2, 4, 6], val: [0.35, 0.6, 0.9], ko: '자동포 함선이 확률로 한 번 더 쏨', en: 'Autocannon ships may fire an extra shot' },
  railgun: { at: [2, 4], val: [0.6, 1.2], ko: '레일건 함선이 장갑에 주는 피해 증가 · 선체가 가장 적은 적을 노림(사거리 +50%)', en: 'Railgun ships deal more damage to armor · target the enemy with the least hull (+50% range)' },
  laser: { at: [2, 4], val: [0.07, 0.14], ko: '레이저 함선이 쏠 때마다 피해 누적 증가(최대 10번)', en: 'Laser ships gain damage with every shot, stacking (up to 10)' },
  plasma: { at: [2, 4], val: [0.08, 0.16], ko: '플라스마 함선이 맞힌 적의 장갑을 깎음', en: 'Plasma ships strip armor from enemies they hit' },
  lance: { at: [2, 4], val: [3, 5], ko: '광선창 함선의 첫 사격이 몇 배(4: 선체 30% 아래 적에게 피해 2배도)', en: 'Lance ships\' first shot hits several times harder (4: also double damage to enemies below 30% hull)' },
  missile: { at: [2, 4, 6], val: [0.3, 0.55, 0.8], ko: '미사일 함선이 확률로 두 번 명중(실드 무시는 원래대로)', en: 'Missile ships may hit twice (they still ignore shields)' },
  torpedo: { at: [2, 4, 6], val: [0.5, 1.1, 1.8], ko: '어뢰 함선이 선체에 주는 피해 증가', en: 'Torpedo ships deal more damage to hull' },
  strike: { at: [2, 4, 6], val: [1, 2, 3], ko: '함재기 함선이 공격마다 추가 편대', en: 'Strike craft ships launch extra wings' },
  // 역할 5갈래 — 2·4·6으로 더 강하게(같은 날)
  picket: { at: [2, 4, 6], val: [0.15, 0.35, 0.6], ko: '아군 전체의 실드 증가(6: 아군 전체 받는 피해 −10%도)', en: 'All allies gain shields (6: all allies also take 10% less damage)' },
  line: { at: [2, 4, 6], val: [0.2, 0.4, 0.7], ko: '전열 함선의 선체 증가', en: 'Line ships gain hull' },
  artillery: { at: [2, 4, 6], val: [0.2, 0.45, 0.8], ko: '포격 함선의 피해 증가', en: 'Artillery ships deal more damage' },
  raider: { at: [2, 4, 6], val: [0.15, 0.3, 0.45], ko: '기습 함선이 먼저 쏘고 확률로 피함', en: 'Raiders strike first and may evade' },
  carrier: { at: [2, 4, 6], val: [0.25, 0.5, 0.9], ko: '항모의 피해 증가', en: 'Carriers deal more damage' },
  // 종족 단계(2026-11-03 사용자: 종족이 늘어난 김에 보너스를 더 — 종족마다 5척이라 2·3·4·5 네 단계, 다 모으면 가장 큼)
  humanoid: { at: [2, 3, 4, 5], val: [0.06, 0.09, 0.12, 0.16], ko: '인간형 함선이 단 부품 하나마다 선체·피해 증가(4부터: 다른 함선도 절반만큼)', en: 'Humanoid ships gain hull and damage per component they carry (from 4: other ships get half)' },
  mammalian: { at: [2, 3, 4, 5], val: [0.1, 0.15, 0.2, 0.28], ko: '아군이 격침될 때마다 포유류 함선 피해 증가(최대 3번)', en: 'Each time an ally is destroyed, Mammalian ships deal more damage (up to 3 times)' },
  reptilian: { at: [2, 3, 4, 5], val: [0.05, 0.07, 0.09, 0.12], ko: '격침할 때마다 이번 전투 파충류 피해 증가(최대 5번) · 격침이 전리품으로 쌓여 10마다 자재 +4(3부터 두 배, 5는 세 배로 쌓임)', en: 'Each kill raises Reptilian damage this combat (up to 5) · kills pile up as plunder; every 10 gives +4 materials (double from 3, triple at 5)' },
  avian: { at: [2, 3, 4, 5], val: [0.25, 0.35, 0.45, 0.6], ko: '조류 함선이 2초마다 최근 받은 피해 일부를 수리하고 다음 사격이 1.5배', en: 'Every 2 seconds Avian ships repair part of recent damage and their next shot hits 1.5×' },
  arthropoid: { at: [2, 3, 4, 5], val: [0.15, 0.22, 0.3, 0.4], ko: '절지류 함선이 받은 피해 일부를 쏜 적에게 되돌려 줌', en: 'Arthropoid ships reflect part of the damage they take back to the attacker' },
  molluscoid: { at: [2, 3, 4, 5], val: [1, 2, 3, 4], ko: '뒷줄에 장막의 화신을 불러냄(3: 연체류 피해 +15% · 4: 더 강한 화신 · 5: 연체류 피해 +30%)', en: 'Summons a Shroud Avatar in the back row (3: +15% Molluscoid damage · 4: a stronger avatar · 5: +30% Molluscoid damage)' },
  fungoid: { at: [2, 3, 4, 5], val: [0.1, 0.15, 0.2, 0.3], ko: '균류 함선 선체 증가 · 전투마다 포자를 모음(지면 두 배), 6개마다 부품 하나', en: 'Fungoid ships gain hull · gather spores each combat (double on a loss); every 6 gives a component' },
  plantoid: { at: [2, 3, 4, 5], val: [1, 1, 2, 3], ko: '배치한 채 3라운드를 지날 때마다 식물 함선이 영구히 자람(한 번에 +6%, 4: 두 번씩, 5: 세 번씩, 최대 6번) · 3부터 바로 한 번 자란 채로 시작', en: 'Every 3 rounds deployed, Plantoid ships grow permanently (+6% each; 4: twice, 5: three times; up to 6) · from 3 they fight with one extra growth' },
  lithoid: { at: [2, 3, 4, 5], val: [0.15, 0.22, 0.3, 0.4], ko: '암석 함선이 선체 절반 이상일 때 받는 피해 감소(절반 아래면 그 절반)', en: 'Lithoid ships take less damage above half hull (half as much below)' },
  machine: { at: [2, 3, 4, 5], val: [180, 260, 420, 600], ko: '기계 함선이 피해를 주며 충전 → 가득 차면 목표 둘레 적 모두에게 방전(4부터: 방전 뒤 장갑 회복)', en: 'Machine ships charge as they deal damage, then discharge into every enemy around the target (from 4: discharging restores armor)' },
} as const;
export type SynKey = keyof typeof SYNERGY;

export const COMPS: Record<CompId, { ko: string; en: string; dko: string; den: string }> = {
  armor: { ko: '장갑판', en: 'Armor plating', dko: '장갑 +40%', den: 'Armor +40%' },
  shield: { ko: '실드 생성기', en: 'Shield generator', dko: '실드 +45%', den: 'Shields +45%' },
  computer: { ko: '조준 컴퓨터', en: 'Targeting computer', dko: '피해 +25%', den: 'Damage +25%' },
  thruster: { ko: '추진기', en: 'Afterburner', dko: '발사 간격 −15%', den: 'Fire interval −15%' },
  reactor: { ko: '반응로 증폭기', en: 'Reactor booster', dko: '선체 +25%', den: 'Hull +25%' },
  sensor: { ko: '정밀 탐지기', en: 'Precision sensor', dko: '치명타 확률 +15%(치명타 = 피해 1.6배)', den: 'Critical chance +15% (critical = 1.6× damage)' },
  ecm: { ko: '전자 교란기', en: 'ECM suite', dko: '회피 +10%', den: 'Evasion +10%' },
  nanite: { ko: '나노 수리기', en: 'Nanite repairer', dko: '2초마다 선체 2% 수리', den: 'Repairs 2% hull every 2 s' },
};
export const COMP_IDS = Object.keys(COMPS) as CompId[];
/** 완성 아이템: 부품 둘(순서 무관)과 고유 효과. fx = 전투에서 쓰는 값. */
export const COMBOS: Array<{ id: string; a: CompId; b: CompId; ko: string; en: string; dko: string; den: string; fx: Record<string, number> }> = [
  { id: 'neutronium', a: 'armor', b: 'armor', ko: '중성자 격벽', en: 'Neutronium Bulkhead', dko: '받는 피해 −15%', den: 'Damage taken −15%', fx: { drFlat: 0.15 } },
  { id: 'adaptive', a: 'armor', b: 'shield', ko: '적응형 장갑', en: 'Adaptive Plating', dko: '아군 전체 실드 +10%', den: 'All allies +10% shields', fx: { auraSh: 0.1 } },
  { id: 'penetrator', a: 'armor', b: 'computer', ko: '장갑 관통탄', en: 'Penetrator Rounds', dko: '장갑에 주는 피해 +40%', den: '+40% damage to armor', fx: { pierce: 0.4 } },
  { id: 'ram', a: 'armor', b: 'thruster', ko: '충각', en: 'Ram Prow', dko: '첫 사격 피해 3배', den: 'First shot deals 3× damage', fx: { opener: 3 } },
  { id: 'citadel', a: 'armor', b: 'reactor', ko: '요새 선체', en: 'Citadel Hull', dko: '선체가 처음 절반 아래로 떨어지면 장갑을 모두 회복하고 최대 선체 20%만큼 실드', den: 'The first time hull drops below half, restores all armor and gains shields equal to 20% max hull', fx: { fortify: 0.2 } },
  { id: 'retaliation', a: 'armor', b: 'sensor', ko: '반격 포탑', en: 'Retaliation Turrets', dko: '받은 피해의 20%를 되돌려 줌', den: 'Reflects 20% of damage taken', fx: { reflect: 0.2 } },
  { id: 'beacon', a: 'armor', b: 'ecm', ko: '도발 신호기', en: 'Taunt Beacon', dko: '적이 이 함선을 먼저 노림', den: 'Enemies target this ship first', fx: { taunt: 1 } },
  { id: 'regen_armor', a: 'armor', b: 'nanite', ko: '자가 복구 장갑', en: 'Regenerative Armor', dko: '2초마다 장갑 6% 회복', den: 'Restores 6% armor every 2 s', fx: { arRegen: 0.06 } },
  { id: 'lattice', a: 'shield', b: 'shield', ko: '이중 실드 격자', en: 'Twin Shield Lattice', dko: '2초마다 실드 8% 회복', den: 'Restores 8% shields every 2 s', fx: { shRegen: 0.08 } },
  { id: 'overcharger', a: 'shield', b: 'computer', ko: '실드 과부하포', en: 'Shield Overcharger', dko: '사격마다 자기 실드의 6%만큼 추가 피해', den: 'Each shot adds damage equal to 6% of own shields', fx: { shBonus: 0.06 } },
  { id: 'phase', a: 'shield', b: 'thruster', ko: '위상 회피기', en: 'Phase Dodger', dko: '회피 +20%', den: 'Evasion +20%', fx: { dodge: 0.2 } },
  { id: 'resonance', a: 'shield', b: 'reactor', ko: '공명 실드', en: 'Resonance Shield', dko: '전투 시작 때 최대 선체 30%만큼 실드 추가', den: 'Starts combat with extra shields equal to 30% max hull', fx: { startSh: 0.3 } },
  { id: 'breaker', a: 'shield', b: 'sensor', ko: '실드 파괴탄', en: 'Shield Breaker', dko: '실드에 주는 피해 +60%', den: '+60% damage to shields', fx: { vsSh: 0.6 } },
  { id: 'jammer', a: 'shield', b: 'ecm', ko: '광역 교란기', en: 'Wide-band Jammer', dko: '전투 시작 때 가까운 적 2척을 2초 동안 멈춤', den: 'At the start of combat, stuns the 2 nearest enemies for 2 s', fx: { freezeStart: 2 } },
  { id: 'projector', a: 'shield', b: 'nanite', ko: '보호막 투사기', en: 'Shield Projector', dko: '2초마다 가장 다친 아군에게 이 함선 최대 선체 6%만큼 실드', den: 'Every 2 s, the most damaged ally gains shields equal to 6% of this ship\'s max hull', fx: { guard: 0.06 } },
  { id: 'tactical_ai', a: 'computer', b: 'computer', ko: '전술 AI 핵심', en: 'Tactical AI Core', dko: '사격마다 피해 +4% 누적(최대 10번)', den: '+4% damage per shot, stacking (up to 10)', fx: { stack: 0.04 } },
  { id: 'rapid', a: 'computer', b: 'thruster', ko: '속사 제어기', en: 'Rapid-fire Controller', dko: '사격마다 25% 확률로 한 번 더', den: '25% chance to fire again', fx: { extra: 0.25 } },
  { id: 'lens', a: 'computer', b: 'reactor', ko: '집속 렌즈', en: 'Focusing Lens', dko: '맞힌 적 둘레(반경 90)에 60% 피해', den: 'Hits splash 60% damage around the target (radius 90)', fx: { aoe: 90 } },
  { id: 'scope', a: 'computer', b: 'sensor', ko: '저격 조준기', en: 'Sniper Scope', dko: '사거리 +50%, 선체가 가장 적은 적을 노림', den: '+50% range; targets the enemy with the least hull', fx: { snipe: 1 } },
  { id: 'execute', a: 'computer', b: 'ecm', ko: '처형 프로토콜', en: 'Execution Protocol', dko: '선체 30% 아래 적에게 피해 2배', den: 'Double damage to enemies below 30% hull', fx: { execute: 0.3 } },
  { id: 'siphon', a: 'computer', b: 'nanite', ko: '흡수 동력기', en: 'Siphon Array', dko: '준 피해의 15%만큼 선체 수리', den: 'Repairs hull by 15% of damage dealt', fx: { steal: 0.15 } },
  { id: 'jump', a: 'thruster', b: 'thruster', ko: '점프 드라이브 시제품', en: 'Prototype Jump Drive', dko: '전투 시작 때 적 뒷줄로 도약 · 회피 +10%', den: 'Jumps behind the enemy lines at the start · evasion +10%', fx: { blink: 1, dodge: 0.1 } },
  { id: 'overdrive', a: 'thruster', b: 'reactor', ko: '과급 엔진', en: 'Overdrive Engines', dko: '2초마다 다음 사격 1.6배', den: 'Every 2 s the next shot deals 1.6×', fx: { pulse: 1.6 } },
  { id: 'painter', a: 'thruster', b: 'sensor', ko: '표적 지정기', en: 'Target Painter', dko: '맞힌 적이 받는 피해 +15%', den: 'Enemies it hits take +15% damage', fx: { mark: 0.15 } },
  { id: 'scatter', a: 'thruster', b: 'ecm', ko: '분산 사격기', en: 'Scatter Battery', dko: '사격마다 다른 적 2척에게 40% 피해', den: 'Each shot also hits 2 other enemies for 40%', fx: { split: 2 } },
  { id: 'field_kit', a: 'thruster', b: 'nanite', ko: '기동 정비 장치', en: 'Field Maintenance Kit', dko: '이동 속도 +50% · 2초마다 선체 3% 수리', den: '+50% speed · repairs 3% hull every 2 s', fx: { speed: 0.5, hpRegen: 0.03 } },
  { id: 'zero_point', a: 'reactor', b: 'reactor', ko: '제로점 반응로', en: 'Zero-Point Reactor', dko: '격침되면 둘레 적에게 최대 선체 30%만큼 폭발 피해', den: 'On destruction, explodes for 30% of max hull around itself', fx: { deathBlast: 0.3 } },
  { id: 'hull_cracker', a: 'reactor', b: 'sensor', ko: '선체 파쇄탄', en: 'Hull Cracker', dko: '선체에 주는 피해 +40%', den: '+40% damage to hull', fx: { vsHp: 0.4 } },
  { id: 'escape_pods', a: 'reactor', b: 'ecm', ko: '구명정 사출기', en: 'Escape Pod Launcher', dko: '한 번 격침될 때 선체 30%로 다시 일어남', den: 'The first time it is destroyed, it comes back with 30% hull', fx: { revive: 0.3 } },
  { id: 'biofused', a: 'reactor', b: 'nanite', ko: '생체 융합 선체', en: 'Bio-fused Hull', dko: '2초마다 선체 5% 수리', den: 'Repairs 5% hull every 2 s', fx: { hpRegen: 0.05 } },
  { id: 'sensor_web', a: 'sensor', b: 'sensor', ko: '광역 탐지망', en: 'Sensor Web', dko: '치명타 피해 2.2배', den: 'Critical hits deal 2.2×', fx: { critMul: 2.2 } },
  { id: 'shredder', a: 'sensor', b: 'ecm', ko: '장갑 분쇄기', en: 'Armor Shredder', dko: '맞힌 적의 장갑을 8%씩 깎음', den: 'Strips 8% armor from enemies it hits', fx: { shred: 0.08 } },
  { id: 'analyzer', a: 'sensor', b: 'nanite', ko: '전투 분석기', en: 'Combat Analyzer', dko: '아군 전체 피해 +8%', den: 'All allies +8% damage', fx: { auraDmg: 0.08 } },
  { id: 'cloak', a: 'ecm', b: 'ecm', ko: '은폐장', en: 'Cloaking Field', dko: '처음 3초 동안 적이 노리지 못함 · 회피 +10%', den: 'Cannot be targeted for the first 3 s · evasion +10%', fx: { stealth: 3, dodge: 0.1 } },
  { id: 'hangar_refit', a: 'ecm', b: 'nanite', ko: '함재기 개조 격납고', en: 'Hangar Refit', dko: '사격마다 함재기 편대 하나 추가', den: 'Launches one extra strike craft wing per shot', fx: { wingsAdd: 1 } },
  { id: 'replicators', a: 'nanite', b: 'nanite', ko: '자가 복제 나노군', en: 'Self-replicating Nanites', dko: '2초마다 선체 4% 수리 · 아군 전체 1%', den: 'Repairs 4% hull every 2 s · all allies 1%', fx: { hpRegen: 0.04, auraRegen: 0.01 } },
];
const COMBO_BY = new Map(COMBOS.map((c) => [c.id, c]));
export const comboOf = (a: CompId, b: CompId) => COMBOS.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a))!;
export const isComp = (id: ItemId): id is CompId => id in COMPS;
/** 부품·완성 아이템 모두의 이름·설명(완성은 부품 둘의 능력 + 고유 효과). */
export const ITEMS: Record<ItemId, { ko: string; en: string; dko: string; den: string; parts?: [CompId, CompId] }> = {
  ...Object.fromEntries(COMP_IDS.map((k) => [k, COMPS[k]])),
  ...Object.fromEntries(COMBOS.map((c) => [c.id, { ko: c.ko, en: c.en, dko: `${COMPS[c.a].dko} · ${COMPS[c.b].dko} · ${c.dko}`, den: `${COMPS[c.a].den} · ${COMPS[c.b].den} · ${c.den}`, parts: [c.a, c.b] as [CompId, CompId] }])),
};
export const ITEM_IDS = COMP_IDS as ItemId[];
/** 아이템 목록 → 부품 수(완성 아이템은 부품 둘로 셈)와 고유 효과 합. */
export function itemStats(items: ItemId[]): { n: Record<CompId, number>; fx: Record<string, number> } {
  const n = Object.fromEntries(COMP_IDS.map((k) => [k, 0])) as Record<CompId, number>, fx: Record<string, number> = {};
  for (const it of items) { if (isComp(it)) { n[it]++; continue; } const c = COMBO_BY.get(it); if (!c) continue; n[c.a]++; n[c.b]++; for (const [k, v] of Object.entries(c.fx)) fx[k] = (fx[k] ?? 0) + v; }
  return { n, fx };
}

export const SC = {
  // 2026-11-03 사용자: 롤토체스 「톡톡이의 시험」처럼 — 30라운드 · 보스 6 · 목숨 3(질 때마다 하나) · 혼자서 시간 제한 없이 · 점수와 최고 기록 · 혼돈 모드.
  rounds: 30, bosses: [5, 10, 15, 20, 25, 30], itemRounds: [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28],
  /** 이긴 마지막 보스 단계 → 바이인 배수. 끝까지 이기면 마지막 값. 패배(목숨 0)·포기로 끝나면 그 절반. 혼돈 모드는 × chaosPay. */
  payout: { 0: 0, 5: 0.4, 10: 0.8, 15: 1.25, 20: 1.8, 25: 2.6, 30: 4, /* 잠깐 있던 보스 5개 판 호환 */ 6: 0.45, 12: 0.9, 18: 1.5, 24: 2.4 } as Record<number, number>, lives: 3, chaosPay: 1.5,
  /** 하드 모드(2026-11-03 사용자): 보스 함대의 선체·실드·장갑 2.5배, 일반 적은 1.5배(같은 날 조정), 피해는 모두 1.25배 · 배당은 이 표 · 점수 × hardScore. */
  hard: { stats: 2.5, normalStats: 1.5, dmg: 1.25, bossStats: { 5: 2 } as Record<number, number> }, hardScore: 2, payoutHard: { 0: 0, 5: 0.4, 10: 0.8, 15: 1.3, 20: 2, 25: 3, 30: 5 } as Record<number, number>, // hard.bossStats: 보스별 따로(2026-11-03 사용자: 그레이트 칸만 2배)
  deathShare: 0.5, minBuyIn: 200, maxBuyIn: 20_000,
  startGold: 8, startLevel: 2, income: 5, interestPer: 10, interestMax: 5, winGold: 1,
  dropChance: 0.2, // 2026-11-03 사용자: 일반 라운드(지급·보스 라운드 아님)를 이기면 20%로 적 잔해에서 부품 하나
  reroll: 2, xpCost: 4, xpBuy: 4, xpPerRound: 2, shop: 5, bench: 8, board: 8, maxLevel: 8, itemsPerShip: 3,
  /** 레벨 L → L+1 에 필요한 누적 경험치(인덱스 = 지금 레벨). */
  xpNeed: [0, 0, 2, 6, 10, 20, 36, 56, 80],
  /** 레벨별 상점 확률(가격 1~5, %). */
  odds: { 1: [100, 0, 0, 0, 0], 2: [100, 0, 0, 0, 0], 3: [75, 25, 0, 0, 0], 4: [55, 30, 15, 0, 0], 5: [45, 33, 20, 2, 0], 6: [30, 40, 25, 5, 0], 7: [19, 30, 35, 15, 1], 8: [16, 20, 35, 25, 4] } as Record<number, number[]>,
  starMul: [1, 1, 1.8, 3.2], ticks: 120, ownedBias: 0.3,
} as const;

// ---- 난수(씨앗)
export function rng(seed: number): () => number { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pickW = (r: () => number, w: number[]): number => { const t = w.reduce((a, b) => a + b, 0); let x = r() * t; for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return w.length - 1; };

// ---- 런 상태
export interface Unit { uid: number; id: string; star: 1 | 2 | 3; items: ItemId[] }
export interface Run {
  seed: number; buyIn: number; round: number; lives: number; score: number; chaos: boolean; hard?: boolean; gold: number; level: number; xp: number;
  board: Array<Unit | null>; bench: Array<Unit | null>; shop: Array<string | null>; locked: boolean; items: ItemId[];
  bossBeaten: number; streak: number; spores?: number; plunder?: number; forge?: Record<string, number>; over: boolean; won: boolean; retreated: boolean; next: number; log: string[]; itemOffer: ItemId[] | null; rolls: number;
}
export function newRun(seed: number, buyIn: number, chaos = false, hard = false): Run {
  const r: Run = { seed: seed >>> 0, buyIn, round: 1, lives: SC.lives, score: 0, chaos, ...(hard ? { hard: true } : {}), gold: SC.startGold, level: SC.startLevel, xp: SC.xpNeed[SC.startLevel], board: Array(SC.board).fill(null), bench: Array(SC.bench).fill(null), shop: [], locked: false, items: [], bossBeaten: 0, streak: 0, over: false, won: false, retreated: false, next: 1, log: [], itemOffer: null, rolls: 0 };
  rollShop(r); return r;
}
const runRng = (r: Run, salt: number) => rng((r.seed ^ Math.imul(r.round + 1, 2654435761) ^ Math.imul(salt + 7, 40503) ^ Math.imul(r.rolls + 3, 69069)) >>> 0);
/** 상점: 가격은 레벨별 확률, 그 가격 안에서는 무작위. 함선이 50척이라 같은 함선 셋을 모으기 어려우므로, 칸마다 SC.ownedBias 확률로 이미 가진 같은 가격 함선이 다시 나옴(★ 올리기용). */
export function rollShop(r: Run): void { const g = runRng(r, 11); const od = SC.odds[r.level] ?? SC.odds[8], owned = [...new Set([...r.board, ...r.bench].filter(Boolean).map((u) => u!.id))].filter((id) => shipById(id)?.shop !== false);
  r.shop = Array.from({ length: SC.shop }, () => { const cost = pickW(g, od) + 1, mine = owned.filter((id) => shipById(id)!.cost === cost), roll = g(); if (mine.length && roll < SC.ownedBias) return mine[Math.floor(g() * mine.length)]; const pool = SHOP_SHIPS.filter((s) => s.cost === cost); return pool[Math.floor(g() * pool.length)].id; }); r.rolls++; }
export const isBoss = (round: number): boolean => (SC.bosses as readonly number[]).includes(round);
export const boardCount = (r: Run): number => r.board.filter(Boolean).length;
export const payoutMul = (beaten: number, hard = false): number => (hard ? SC.payoutHard : SC.payout)[beaten] ?? 0;
/** 지금 끝내면 받는 돈(철수 또는 패배). */
export function payoutOf(r: Run, death = false): number { const m = payoutMul(r.bossBeaten, !!r.hard) * (death ? SC.deathShare : 1) * (r.chaos ? SC.chaosPay : 1); return Math.floor(r.buyIn * m); }

function freeBench(r: Run): number { return r.bench.findIndex((x) => !x); }
/** 같은 함선·같은 별 3척 → 한 척 별 올림(부품은 모아서 최대 3개, 남은 건 창고). 연달아 올라갈 수 있음. */
export function combine(r: Run): string[] {
  const out: string[] = []; let changed = true;
  while (changed) { changed = false;
    for (const star of [1, 2] as const) {
      const all: Array<{ where: 'board' | 'bench'; i: number; u: Unit }> = []; r.board.forEach((u, i) => u && all.push({ where: 'board', i, u })); r.bench.forEach((u, i) => u && all.push({ where: 'bench', i, u }));
      const by = new Map<string, typeof all>(); for (const x of all) if (x.u.star === star) { const k = x.u.id; by.set(k, [...(by.get(k) ?? []), x]); }
      for (const [id, list] of by) { if (list.length < 3) continue; const three = list.slice(0, 3), keep = three.find((x) => x.where === 'board') ?? three[0];
        const items = three.flatMap((x) => x.u.items); for (const x of three) { if (x === keep) continue; (x.where === 'board' ? r.board : r.bench)[x.i] = null; }
        keep.u.star = (star + 1) as 2 | 3; keep.u.items = items.slice(0, SC.itemsPerShip); r.items.push(...items.slice(SC.itemsPerShip)); out.push(`${id}:${keep.u.star}`); changed = true; break; }
      if (changed) break; }
  }
  return out;
}
export function buy(r: Run, slot: number): void {
  const id = r.shop[slot], d = id ? shipById(id) : null; if (!d) throw new Error('EMPTY'); if (r.gold < d.cost) throw new Error('GOLD');
  let b = freeBench(r);
  if (b < 0) { // 벤치가 꽉 차도 이걸 사면 바로 합쳐지면 산다
    const same = [...r.board, ...r.bench].filter((u) => u && u.id === id && u.star === 1).length; if (same < 2) throw new Error('BENCH');
    r.gold -= d.cost; r.shop[slot] = null; const tmp: Unit = { uid: r.next++, id: d.id, star: 1, items: [] }; r.bench.push(tmp); combine(r); r.bench = r.bench.slice(0, SC.bench); return; } // 새 함선은 세 척 중 마지막이라 합쳐지면서 빠진다
  r.gold -= d.cost; r.shop[slot] = null; r.bench[b] = { uid: r.next++, id: d.id, star: 1, items: [] }; combine(r);
}
export const sellValue = (u: Unit): number => { const d = shipById(u.id)!; return u.star === 1 ? d.cost : d.cost * (u.star === 2 ? 3 : 9) - (d.cost > 1 ? 1 : 0); };
export function sell(r: Run, where: 'board' | 'bench', i: number): void { const arr = where === 'board' ? r.board : r.bench, u = arr[i]; if (!u) throw new Error('EMPTY'); r.gold += sellValue(u); r.items.push(...u.items); arr[i] = null; }
export function reroll(r: Run): void { if (r.gold < SC.reroll) throw new Error('GOLD'); r.gold -= SC.reroll; rollShop(r); }
export function addXp(r: Run, n: number): void { r.xp += n; while (r.level < SC.maxLevel && r.xp >= SC.xpNeed[r.level + 1]) r.level++; }
export function buyXp(r: Run): void { if (r.level >= SC.maxLevel) throw new Error('MAX'); if (r.gold < SC.xpCost) throw new Error('GOLD'); r.gold -= SC.xpCost; addXp(r, SC.xpBuy); }
/** 자리 옮기기: 보드·벤치 사이 맞바꾸기. 보드에 올릴 때는 함대 규모(레벨)를 넘지 않게. */
export function move(r: Run, from: { where: 'board' | 'bench'; i: number }, to: { where: 'board' | 'bench'; i: number }): void {
  const A = from.where === 'board' ? r.board : r.bench, B = to.where === 'board' ? r.board : r.bench; const a = A[from.i], b = B[to.i]; if (!a) throw new Error('EMPTY');
  if (to.where === 'board' && from.where === 'bench' && !b && boardCount(r) >= r.level) throw new Error('FULL');
  A[from.i] = b ?? null; B[to.i] = a;
}
/** 장착: 부품을 부품 하나만 단 함선에 주면 둘이 합쳐져 완성 아이템이 됨(롤토체스식). 칸은 3개까지. */
export function equip(r: Run, item: number, where: 'board' | 'bench', i: number): string | null { const it = r.items[item], u = (where === 'board' ? r.board : r.bench)[i]; if (!it || !u) throw new Error('EMPTY');
  const lone = isComp(it) ? u.items.findIndex((x) => isComp(x)) : -1;
  if (lone >= 0) { const c = comboOf(u.items[lone] as CompId, it as CompId); u.items[lone] = c.id; r.items.splice(item, 1); return c.id; }
  if (u.items.length >= SC.itemsPerShip) throw new Error('ITEMS'); u.items.push(it); r.items.splice(item, 1); return null; }
export function takeItem(r: Run, k: number): void { if (!r.itemOffer || !r.itemOffer[k]) throw new Error('EMPTY'); r.items.push(r.itemOffer[k]); r.itemOffer = null; }

// ---- 시너지
export function synergies(units: Array<Unit | null>): Array<{ key: SynKey; n: number; tier: number }> {
  const ids = [...new Set(units.filter(Boolean).map((u) => u!.id))]; const cnt = new Map<SynKey, number>();
  for (const id of ids) { const d = shipById(id); if (!d) continue; const wp = weaponOf(id); cnt.set(wp, (cnt.get(wp) ?? 0) + 1); cnt.set(d.role, (cnt.get(d.role) ?? 0) + 1); for (const o of originsOf(id)) cnt.set(o, (cnt.get(o) ?? 0) + 1); }
  return [...cnt].map(([key, n]) => ({ key, n, tier: (SYNERGY[key].at as readonly number[]).filter((x) => n >= x).length })).sort((a, b) => b.tier - a.tier || b.n - a.n);
}

// ---- 전투
export interface Fighter { side: 0 | 1; slot: number; id: string; name: [string, string]; star: number; fam: Family; role: Role; hp: number; maxHp: number; sh: number; maxSh: number; ar: number; maxAr: number; dmg: number; cd: number; t: number; dodge: number; dbl: number; wings: number; boss?: boolean; uid?: number; orig?: Origin[]; dr?: number; charge?: number; burst?: number; burstArmor?: boolean; mend?: number; taken?: number; boost?: number; plunderer?: number; aoe?: number; multi?: number; lag?: { every: number; n: number; dur: number }; crit?: number; critMul?: number; fx?: Record<string, number>; stacks?: number; shots?: number; marked?: number; revived?: boolean; fortified?: boolean; kills?: number; rage?: number; rages?: number; reflect?: number }
export interface Ev { t: number; a: number; d: number; dmg: number; kill?: boolean; kind?: 'wing' | 'double' | 'dodge' | 'burst' | 'repair' | 'reflect' | 'freeze' | 'crit'; /** repair 의 층(없으면 선체). */ l?: 'sh' | 'ar' }
export interface Battle { fighters: Fighter[]; events: Ev[]; shots: Shot[]; frames: number[][]; winner: 0 | 1; ticks: number; left: number; marKills: number }
const famMul = (fam: Family, layer: 'sh' | 'ar' | 'hp'): number => (fam === 'kinetic' ? { sh: 1.5, ar: 0.6, hp: 1 } : fam === 'energy' ? { sh: 0.6, ar: 1.5, hp: 1 } : fam === 'explosive' ? { sh: 0, ar: 1, hp: 1 } : { sh: 1, ar: 1, hp: 1 })[layer];
export function makeFighters(side: 0 | 1, units: Array<Unit | null>, forge: Record<string, number> = {}): Fighter[] {
  const syn = new Map(synergies(units).filter((s) => s.tier > 0).map((s) => [s.key, (SYNERGY[s.key].val as readonly number[])[s.tier - 1]]));
  const out: Fighter[] = [], tierOf = new Map(synergies(units).map((x) => [x.key, x.tier]));
  units.forEach((u, slot) => { if (!u) return; const d = shipById(u.id); if (!d) return; const m = SC.starMul[u.star], IS = itemStats(u.items), it = (k: CompId) => IS.n[k];
    const og = originsOf(d.id), fg = 1 + GROW * Math.min(GROW_MAX, forge[String(u.uid)] ?? 0);
    let hp = d.hp * m * fg, sh = d.sh * m * fg * (1 + 0.45 * it('shield')), ar = d.ar * m * fg * (1 + 0.4 * it('armor')), dmg = d.dmg * m * fg * (1 + 0.25 * it('computer')), cd = d.cd * Math.pow(0.85, it('thruster')); hp *= 1 + 0.25 * it('reactor');
    if (syn.has('humanoid')) { const per = og.includes('humanoid') ? syn.get('humanoid')! : (syn.get('humanoid')! >= SYNERGY.humanoid.val[2] ? syn.get('humanoid')! / 2 : 0), k = 1 + per * u.items.length; hp *= k; dmg *= k; }
    if (og.includes('fungoid') && syn.has('fungoid')) hp *= 1 + syn.get('fungoid')!;
    if (og.includes('molluscoid') && (syn.get('molluscoid') ?? 0) >= 2) dmg *= (syn.get('molluscoid') ?? 0) >= 4 ? 1.3 : 1.15;
    if (og.includes('plantoid') && (tierOf.get('plantoid') ?? 0) >= 2) { const g2 = 1 + GROW; hp *= g2; sh *= g2; ar *= g2; dmg *= g2; }
    if (syn.has('picket')) sh *= 1 + syn.get('picket')!;
    if (d.role === 'line' && syn.has('line')) hp *= 1 + syn.get('line')!;
    if (d.role === 'artillery' && syn.has('artillery')) dmg *= 1 + syn.get('artillery')!;
    const wp = weaponOf(d.id), wv = syn.get(wp), wt = tierOf.get(wp) ?? 0; if (wp === 'massdriver' && wv) cd *= 1 - wv;
    if (d.role === 'carrier' && syn.has('carrier')) dmg *= 1 + syn.get('carrier')!;
    const raid = d.role === 'raider' && syn.has('raider') ? syn.get('raider')! : 0;
    out.push({ side, slot, id: d.id, name: [d.ko, d.en], star: u.star, fam: d.fam, role: d.role, hp: Math.round(hp), maxHp: Math.round(hp), sh: Math.round(sh), maxSh: Math.round(sh), ar: Math.round(ar), maxAr: Math.round(ar), dmg: Math.round(dmg), cd: Math.max(2, Math.round(cd)), t: 0, dodge: raid, dbl: wp === 'missile' && wv ? wv : 0, wings: wp === 'strike' && wv ? wv : 0 });
    const F = out[out.length - 1]; F.t = raid ? 1 : 2 + (slot % 4); F.uid = u.uid; F.orig = og; if (d.aoe) F.aoe = d.aoe; if (d.multi) F.multi = d.multi; if (d.lag) F.lag = { ...d.lag };
    const fx: Record<string, number> = { ...IS.fx }; for (const [k, v] of Object.entries(d.fx ?? {})) fx[k] = (fx[k] ?? 0) + v;
    if (wt) F.dmg = Math.round(F.dmg * (1 + 0.1 * wt)); // 무기 특성이 켜지면 그 함선 피해 +10%/단계(공통)
    if (wv) { const add = (k: string, v: number) => { fx[k] = (fx[k] ?? 0) + v; }; // 무기 특성 → 아이템과 같은 효과 장치
      if (wp === 'autocannon') add('extra', wv); else if (wp === 'railgun') { add('pierce', wv); fx.snipe = 1; } else if (wp === 'laser') add('stack', wv); else if (wp === 'plasma') add('shred', wv);
      else if (wp === 'lance') { fx.opener = Math.max(fx.opener ?? 0, wv); if (wt >= 2) add('execute', 0.3); } else if (wp === 'torpedo') add('vsHp', wv); }
    if ((tierOf.get('picket') ?? 0) >= 3) fx.drFlat = (fx.drFlat ?? 0) + 0.1; // 경계 6 F.crit = 0.15 * it('sensor'); F.critMul = fx.critMul ?? 1.6; F.dodge = Math.min(0.6, F.dodge + 0.1 * it('ecm') + (fx.dodge ?? 0)); if (it('nanite')) fx.hpRegen = (fx.hpRegen ?? 0) + 0.02 * it('nanite');
    if (fx.reflect) F.reflect = (F.reflect ?? 0) + fx.reflect; if (fx.aoe) F.aoe = Math.max(F.aoe ?? 0, fx.aoe); if (fx.wingsAdd) F.wings += fx.wingsAdd; if (Object.keys(fx).length) F.fx = fx;
    if (og.includes('lithoid') && syn.has('lithoid')) F.dr = syn.get('lithoid')!;
    if (og.includes('machine') && syn.has('machine')) { F.charge = 0; F.burst = Math.round(syn.get('machine')! * m); F.burstArmor = syn.get('machine')! >= SYNERGY.machine.val[2]; }
    if (og.includes('avian') && syn.has('avian')) { F.mend = syn.get('avian')!; F.taken = 0; }
    if (og.includes('reptilian') && syn.has('reptilian')) { F.plunderer = syn.get('reptilian')!; F.kills = 0; }
    if (og.includes('mammalian') && syn.has('mammalian')) { F.rage = syn.get('mammalian')!; F.rages = 0; }
    if (og.includes('arthropoid') && syn.has('arthropoid')) F.reflect = syn.get('arthropoid')!; });
  const ps = syn.get('molluscoid'); if (ps) { const free = [4, 5, 6, 7, 0, 1, 2, 3].find((sl) => !units[sl]); const A = AVATAR[ps >= 3 ? 2 : 1]!;
    if (free !== undefined) out.push({ side, slot: free, id: 'shroud_avatar', name: ['장막의 화신', 'Shroud Avatar'], star: ps >= 3 ? 2 : 1, fam: 'energy', role: 'line', hp: A.hp, maxHp: A.hp, sh: A.sh, maxSh: A.sh, ar: A.ar, maxAr: A.ar, dmg: A.dmg, cd: A.cd, t: 3, dodge: 0, dbl: 0, wings: 0, orig: ['molluscoid'] }); }
  // 아군 전체에 걸리는 아이템(적응형 장갑·전투 분석기·공명 실드)
  const auraSh = out.reduce((a, f) => a + (f.fx?.auraSh ?? 0), 0), auraDmg = out.reduce((a, f) => a + (f.fx?.auraDmg ?? 0), 0);
  for (const f of out) { const add = f.fx?.startSh ? Math.round(f.maxHp * f.fx.startSh) : 0; if (auraSh || add) { f.sh = f.maxSh = Math.round(f.maxSh * (1 + auraSh)) + add; } if (auraDmg) f.dmg = Math.round(f.dmg * (1 + auraDmg)); }
  return out;
}
const alive = (f: Fighter) => f.hp > 0;
const front = (slot: number) => slot < 4;
function hit(target: Fighter, raw: number, fam: Family, lm?: { sh?: number; ar?: number; hp?: number }): number { // 실드 → 장갑 → 선체 순서. 계열마다 층별 배율(lm = 아이템의 층별 추가 배율).
  if (target.dr) raw *= 1 - (target.hp >= target.maxHp / 2 ? target.dr : target.dr / 2); // 암석: 체력 절반 이상일 때 피해 감소
  if (target.fx?.drFlat) raw *= 1 - target.fx.drFlat; if (target.marked) raw *= 1 + target.marked;
  let left = raw, dealt = 0;
  for (const layer of ['sh', 'ar', 'hp'] as const) { if (left <= 0) break; const mul = famMul(fam, layer) * (1 + (lm?.[layer] ?? 0)); if (mul === 0) continue; const pool = target[layer]; if (pool <= 0) continue; const eff = left * mul, take = Math.min(pool, eff); target[layer] = Math.round(pool - take); dealt += take; left -= take / mul; }
  return Math.round(dealt);
}
// 실시간 공간 전투(2026-11-03 사용자: 림토체스처럼 싸움 보는 맛 — 림월드식으로 실제로 움직이며 싸움).
// 전장 1000×600, 우리는 왼쪽·적은 오른쪽. 함선은 역할마다 속도·사거리가 달라 다가가거나(돌격·기습) 거리를 벌리고(포격·항모) 쏜다.
// 탄은 날아간다: 키네틱 = 빠른 포탄, 에너지 = 즉시 광선, 폭발 = 느린 유도 미사일(도착 전에 목표가 죽으면 불발), 함재기 = 편대가 날아가 공격.
// 0.1초 단위로 계산하고 0.2초마다 위치를 기록 → 화면은 그 기록과 사격·명중 기록을 재생만 한다(같은 씨앗 = 같은 전투).
export const ARENA = { w: 1000, h: 600, dt: 0.1, frame: 0.2, max: 45, tick: 0.25 } as const;
const SPEED: Record<Role, number> = { raider: 150, line: 80, picket: 70, artillery: 45, carrier: 50 };
const RANGE: Record<Role, number> = { raider: 170, line: 330, picket: 230, artillery: 560, carrier: 620 };
const SHOT_SPEED: Record<Family, number> = { kinetic: 900, energy: 0, explosive: 320, strike: 420 };
export interface Shot { t: number; a: number; d: number; kind: 'shell' | 'beam' | 'missile' | 'wing'; travel: number }
export function startPos(side: 0 | 1, slot: number): [number, number] { const fr = slot < 4, x = side === 0 ? (fr ? 300 : 160) : (fr ? 700 : 840); return [x, 90 + (slot % 4) * 140]; }
export function simulate(a: Fighter[], b: Fighter[], seed: number): Battle {
  const fs: Fighter[] = [...a, ...b].map((f) => ({ ...f })), g = rng(seed), events: Ev[] = [], shots: Shot[] = [], frames: number[][] = [];
  const P = fs.map((f) => startPos(f.side, f.slot)), tgt: number[] = fs.map(() => -1), timer = fs.map((f) => Math.max(0.2, f.t * ARENA.tick));
  const pend: Array<{ at: number; a: number; d: number; raw: number; kind: Ev['kind']; fam: Family }> = [];
  let t = 0, marKills = 0, nextFrame = 0, nextMend = 2; const CHARGE = 520, frozen: number[] = fs.map(() => 0), nextLag: number[] = fs.map((f) => (f.lag ? f.lag.every : Infinity));
  const dist = (i: number, j: number) => Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
  const pushFrame = () => frames.push(P.flatMap((p) => [Math.round(p[0]), Math.round(p[1])]));
  function resolve(i: number, di: number, raw: number, kind: Ev['kind'], fam: Family) {
    const f = fs[i], d = fs[di]; if (!alive(d)) return; const tt = Math.round(t * 100) / 100;
    if (d.dodge > 0 && g() < d.dodge) { events.push({ t: tt, a: i, d: di, dmg: 0, kind: 'dodge' }); return; }
    const fx = f.fx; if (fx?.execute && d.hp < d.maxHp * fx.execute) raw *= 2; // 처형 프로토콜
    const dealt = hit(d, raw, fam, fx ? { sh: fx.vsSh, ar: fx.pierce, hp: fx.vsHp } : undefined); if (d.mend) d.taken = (d.taken ?? 0) + dealt;
    if (fx?.mark) d.marked = Math.max(d.marked ?? 0, fx.mark); if (fx?.shred && d.ar > 0) d.ar = Math.max(0, Math.round(d.ar - d.maxAr * fx.shred));
    if (d.hp <= 0 && d.fx?.revive && !d.revived) { d.revived = true; d.hp = Math.round(d.maxHp * d.fx.revive); events.push({ t: tt, a: i, d: di, dmg: dealt, ...(kind ? { kind } : {}) }); events.push({ t: tt, a: di, d: di, dmg: -d.hp, kind: 'repair' }); return; } // 구명정
    events.push({ t: tt, a: i, d: di, dmg: dealt, ...(kind ? { kind } : {}), ...(d.hp <= 0 ? { kill: true } : {}) });
    if (fx?.steal && alive(f) && dealt > 0 && kind !== 'reflect') { const h2 = Math.min(f.maxHp - f.hp, Math.round(dealt * fx.steal)); if (h2 > 0) { f.hp += h2; events.push({ t: tt, a: i, d: i, dmg: -h2, kind: 'repair' }); } } // 흡수 동력기
    if (d.fx?.fortify && !d.fortified && alive(d) && d.hp < d.maxHp / 2) { d.fortified = true; const ga = d.maxAr - d.ar, gs = Math.round(d.maxHp * d.fx.fortify); d.ar = d.maxAr; d.sh += gs; events.push({ t: tt, a: di, d: di, dmg: -ga, kind: 'repair', l: 'ar' }, { t: tt, a: di, d: di, dmg: -gs, kind: 'repair', l: 'sh' }); } // 요새 선체
    if (d.hp <= 0 && d.fx?.deathBlast) fs.forEach((x, xi) => { if (x.side === d.side || !alive(x) || Math.hypot(P[xi][0] - P[di][0], P[xi][1] - P[di][1]) > 150) return; const bd = hit(x, Math.round(d.maxHp * d.fx!.deathBlast), 'strike'); events.push({ t: tt, a: di, d: xi, dmg: bd, kind: 'burst', ...(x.hp <= 0 ? { kill: true } : {}) }); }); // 제로점 반응로
    if (d.hp <= 0 && f.plunderer) { f.kills = Math.min(5, (f.kills ?? 0) + 1); if (f.side === 0) marKills++; }
    if (d.hp <= 0) fs.forEach((x) => { if (x.side === d.side && x.rage && alive(x)) x.rages = Math.min(3, (x.rages ?? 0) + 1); }); // 포유류: 복수심
    if (f.aoe && kind !== 'burst' && kind !== 'reflect') fs.forEach((x, xi) => { if (xi === di || x.side === f.side || !alive(x) || Math.hypot(P[xi][0] - P[di][0], P[xi][1] - P[di][1]) > f.aoe!) return; const sd = hit(x, Math.round(raw * 0.6), fam); events.push({ t: tt, a: i, d: xi, dmg: sd, kind: 'burst', ...(x.hp <= 0 ? { kill: true } : {}) }); }); // 보스: 광역
    if (d.reflect && dealt > 0 && alive(f) && kind !== 'reflect') { const rd = hit(f, Math.round(dealt * d.reflect), 'strike'); if (rd > 0) events.push({ t: tt, a: di, d: i, dmg: rd, kind: 'reflect', ...(f.hp <= 0 ? { kill: true } : {}) }); } // 절지류: 반사
    if (f.burst !== undefined && alive(f)) { f.charge = (f.charge ?? 0) + dealt; if (f.charge >= CHARGE) { f.charge = 0; // 기계: 목표 둘레 적 모두에게 방전
      fs.forEach((x, xi) => { if (x.side === f.side || !alive(x) || Math.hypot(P[xi][0] - P[di][0], P[xi][1] - P[di][1]) > 150) return; const bd = hit(x, f.burst!, 'strike'); if (x.mend) x.taken = (x.taken ?? 0) + bd; events.push({ t: tt, a: i, d: xi, dmg: bd, kind: 'burst', ...(x.hp <= 0 ? { kill: true } : {}) }); });
      if (f.burstArmor) f.ar = Math.min(f.maxAr, f.ar + Math.round(f.maxAr * 0.3)); } }
  }
  fs.forEach((f, i) => { if (f.fx?.blink) P[i] = [f.side === 0 ? 860 : 140, P[i][1]]; }); // 점프 드라이브: 적 뒷줄로
  fs.forEach((f, i) => { if (!f.fx?.freezeStart) return; const pool = fs.map((x, j) => j).filter((j) => fs[j].side !== f.side).sort((x, y) => dist(i, x) - dist(i, y)).slice(0, 2); for (const j of pool) { frozen[j] = Math.max(frozen[j], f.fx.freezeStart); events.push({ t: 0, a: i, d: j, dmg: 0, kind: 'freeze' }); } }); // 광역 교란기
  pushFrame(); nextFrame = ARENA.frame;
  while (t < ARENA.max) {
    t = Math.round((t + ARENA.dt) * 100) / 100;
    if (t >= nextMend) { nextMend += 2; fs.forEach((f, i) => { if (f.mend && alive(f) && f.taken) { const heal = Math.min(f.maxHp - f.hp, Math.round(f.taken * f.mend)); if (heal > 0) { f.hp += heal; events.push({ t, a: i, d: i, dmg: -heal, kind: 'repair' }); } f.taken = 0; f.boost = 1.5; } });
      fs.forEach((f, i) => { const fx = f.fx; if (!fx || !alive(f)) return; // 아이템: 2초마다 수리·회복
        const heal = (x: Fighter, xi: number, n: number, l?: 'sh' | 'ar') => { const k = l ?? 'hp', mx = l === 'sh' ? x.maxSh : l === 'ar' ? x.maxAr : x.maxHp, v = Math.min(mx - x[k], Math.round(n)); if (v > 0) { x[k] += v; events.push({ t, a: i, d: xi, dmg: -v, kind: 'repair', ...(l ? { l } : {}) }); } };
        if (fx.hpRegen) heal(f, i, f.maxHp * fx.hpRegen); if (fx.arRegen) heal(f, i, f.maxAr * fx.arRegen, 'ar'); if (fx.shRegen) heal(f, i, f.maxSh * fx.shRegen, 'sh'); if (fx.pulse) f.boost = Math.max(f.boost ?? 1, fx.pulse);
        if (fx.auraRegen) fs.forEach((x, xi) => { if (x.side === f.side && xi !== i && alive(x)) heal(x, xi, x.maxHp * fx.auraRegen); });
        if (fx.guard) { let lo = -1; fs.forEach((x, xi) => { if (x.side === f.side && alive(x) && (lo < 0 || x.hp / x.maxHp < fs[lo].hp / fs[lo].maxHp)) lo = xi; }); if (lo >= 0) { const x = fs[lo], v = Math.round(f.maxHp * fx.guard); x.sh += v; events.push({ t, a: i, d: lo, dmg: -v, kind: 'repair', l: 'sh' }); } } }); } // 조류: 2초마다 수리
    fs.forEach((f, i) => { if (!f.lag || !alive(f) || t < nextLag[i]) return; nextLag[i] += f.lag.every; // 렉: 적 몇 척이 잠깐 멈춤(응답 없음)
      const pool = fs.map((x, j) => j).filter((j) => fs[j].side !== f.side && alive(fs[j]) && frozen[j] <= t); for (let k = 0; k < f.lag.n && pool.length; k++) { const j = pool.splice(Math.floor(g() * pool.length), 1)[0]; frozen[j] = t + f.lag.dur; events.push({ t, a: i, d: j, dmg: 0, kind: 'freeze' }); } });
    for (let i = 0; i < fs.length; i++) { const f = fs[i]; if (!alive(f)) continue; if (frozen[i] > t) continue;
      const foes = fs.map((x, j) => j).filter((j) => fs[j].side !== f.side && alive(fs[j])); if (!foes.length) break;
      if (tgt[i] < 0 || !alive(fs[tgt[i]])) { // 목표 고르기
        let pool = foes.filter((j) => !(fs[j].fx?.stealth && t < fs[j].fx!.stealth)); if (!pool.length) pool = foes; // 은폐장
        const taunt = pool.filter((j) => fs[j].fx?.taunt); // 도발 신호기
        if (taunt.length) pool = taunt; else if (f.role === 'raider') { const back = pool.filter((j) => fs[j].slot >= 4); if (back.length) pool = back; }
        tgt[i] = f.fx?.snipe ? pool.reduce((m, j) => (fs[j].hp < fs[m].hp ? j : m)) : f.role === 'carrier' || f.fam === 'strike' ? pool[Math.floor(g() * pool.length)] : pool.reduce((m, j) => (dist(i, j) < dist(i, m) ? j : m)); }
      const j = tgt[i], R = RANGE[f.role] * (f.fx?.snipe ? 1.5 : 1), dd = dist(i, j), sp = SPEED[f.role] * ARENA.dt * (1 + (f.fx?.speed ?? 0));
      const ux = (P[j][0] - P[i][0]) / (dd || 1), uy = (P[j][1] - P[i][1]) / (dd || 1);
      if (dd > R * 0.95) { P[i][0] += ux * sp; P[i][1] += uy * sp; } else if ((f.role === 'artillery' || f.role === 'carrier') && dd < R * 0.55) { P[i][0] -= ux * sp * 0.5; P[i][1] -= uy * sp * 0.5; } // 다가가기 / 거리 벌리기
      for (let k = 0; k < fs.length; k++) { if (k === i || !alive(fs[k])) continue; const ox = P[i][0] - P[k][0], oy = P[i][1] - P[k][1], o = Math.hypot(ox, oy); if (o > 0 && o < 46) { P[i][0] += (ox / o) * (46 - o) * 0.3; P[i][1] += (oy / o) * (46 - o) * 0.3; } } // 겹치지 않게
      P[i][0] = Math.max(30, Math.min(ARENA.w - 30, P[i][0])); P[i][1] = Math.max(40, Math.min(ARENA.h - 40, P[i][1]));
      timer[i] -= ARENA.dt; if (timer[i] > 0 || dist(i, j) > R) continue; timer[i] = f.cd * ARENA.tick;
      const shotsN = 1 + (f.wings > 0 ? f.wings : 0) + (f.dbl > 0 && g() < f.dbl ? 1 : 0) + (f.fx?.extra && g() < f.fx.extra ? 1 : 0) + (f.multi ?? 0) + (f.fx?.split ?? 0), nSplit = f.fx?.split ?? 0;
      for (let s = 0; s < shotsN; s++) { const isSplit = s > 0 && s >= shotsN - nSplit, isMulti = !isSplit && s > 0 && s >= shotsN - nSplit - (f.multi ?? 0), kind: Ev['kind'] = s === 0 ? undefined : isMulti || isSplit ? 'double' : s <= f.wings ? 'wing' : 'double';
        let d = j; if (isSplit) { const o = foes.filter((x) => x !== j); if (!o.length) continue; d = o[Math.floor(g() * o.length)]; } else if (s > 0 && (isMulti || f.fam === 'strike' || f.role === 'carrier')) { d = foes[Math.floor(g() * foes.length)]; } if (!alive(fs[d])) continue;
        const crit = s === 0 && (f.crit ?? 0) > 0 && g() < f.crit!, fx = f.fx;
        let raw = f.dmg * (kind === 'wing' ? 0.4 : isSplit ? 0.4 : isMulti ? 0.7 : 1) * (0.9 + g() * 0.2) * (f.boost ?? 1) * (f.plunderer ? 1 + f.plunderer * (f.kills ?? 0) : 1) * (f.rage ? 1 + f.rage * (f.rages ?? 0) : 1) * (crit ? f.critMul ?? 1.6 : 1);
        if (s === 0) { if (fx?.opener && !f.shots) raw *= fx.opener; if (fx?.stack) { raw *= 1 + fx.stack * (f.stacks ?? 0); f.stacks = Math.min(10, (f.stacks ?? 0) + 1); } if (fx?.shBonus) raw += f.sh * fx.shBonus; f.shots = (f.shots ?? 0) + 1; f.boost = undefined; }
        const v = SHOT_SPEED[f.fam], look: Shot['kind'] = f.fam === 'energy' ? 'beam' : f.fam === 'kinetic' ? 'shell' : f.fam === 'explosive' ? 'missile' : 'wing', travel = v ? Math.round((dist(i, d) / v) * 100) / 100 : 0;
        shots.push({ t, a: i, d, kind: look, travel });
        const k2: Ev['kind'] = crit ? 'crit' : kind; if (!travel) resolve(i, d, raw, k2, f.fam); else pend.push({ at: t + travel, a: i, d, raw, kind: k2, fam: f.fam }); }
    }
    for (let k = pend.length - 1; k >= 0; k--) if (pend[k].at <= t) { const q = pend.splice(k, 1)[0]; resolve(q.a, q.d, q.raw, q.kind, q.fam); }
    if (t >= nextFrame - 1e-9) { pushFrame(); nextFrame += ARENA.frame; }
    if (!fs.some((x) => x.side === 0 && alive(x)) || !fs.some((x) => x.side === 1 && alive(x))) { pushFrame(); break; }
  }
  const A = fs.filter((x) => x.side === 0 && alive(x)), B = fs.filter((x) => x.side === 1 && alive(x));
  const hpShare = (L: Fighter[], all: Fighter[]) => L.reduce((s, x) => s + x.hp + x.ar + x.sh, 0) / Math.max(1, all.reduce((s, x) => s + x.maxHp + x.maxAr + x.maxSh, 0));
  const winner: 0 | 1 = !B.length && A.length ? 0 : !A.length ? 1 : hpShare(A, fs.filter((x) => x.side === 0)) >= hpShare(B, fs.filter((x) => x.side === 1)) ? 0 : 1; // 시간이 다 되면 남은 체력 비율로
  return { fighters: [...a, ...b].map((f) => ({ ...f })), events, shots, frames, winner, ticks: Math.round(t * 100) / 100, left: winner === 0 ? A.length : B.length, marKills };
}

// ---- 적 함대
// 보스(2026-11-03 사용자: 순서 = 그레이트 칸의 무리 → 차원의 공포 → 에테르 드레이크 → 언비든 → 세타나 → 후반 렉의 화신(우주적 존재 패러디). 2·3은 보스 하나만(대신 강력하게), 나머지는 전용 함선 함대).
export const BOSSES: Record<number, { ko: string; en: string; units: Array<{ id: string; star: 1 | 2 | 3; slot: number; mul?: number }> }> = {
  5: { ko: '그레이트 칸의 무리', en: 'The Great Khan\'s Horde', units: [{ id: 'horde_raider', star: 1, slot: 0 }, { id: 'khan_flagship', star: 1, slot: 1 }, { id: 'horde_raider', star: 1, slot: 2 }, { id: 'horde_lancer', star: 1, slot: 3 }, { id: 'horde_carrier', star: 1, slot: 5 }] },
  10: { ko: '차원의 공포', en: 'Dimensional Horror', units: [{ id: 'dim_horror', star: 1, slot: 1 }] },
  15: { ko: '에테르 드레이크', en: 'Ether Drake', units: [{ id: 'ether_drake', star: 1, slot: 1 }] },
  20: { ko: '언비든', en: 'The Unbidden', units: [{ id: 'unbidden_warform', star: 1, slot: 0 }, { id: 'unbidden_warform', star: 1, slot: 1 }, { id: 'unbidden_warform', star: 1, slot: 2 }, { id: 'unbidden_lurker', star: 1, slot: 3 }, { id: 'unbidden_herald', star: 1, slot: 5 }, { id: 'unbidden_lurker', star: 1, slot: 6 }] },
  25: { ko: '세타나', en: 'Cetana', units: [{ id: 'cetana_warden', star: 1, slot: 0 }, { id: 'cetana_shard', star: 1, slot: 1 }, { id: 'cetana_shard', star: 1, slot: 2 }, { id: 'cetana_warden', star: 1, slot: 3 }, { id: 'cetana', star: 1, slot: 5 }] },
  30: { ko: '후반 렉의 화신', en: 'Avatar of Late-Game Lag', units: [{ id: 'lag_echo', star: 1, slot: 0 }, { id: 'lag_echo', star: 1, slot: 1 }, { id: 'lag_echo', star: 1, slot: 2 }, { id: 'lag_echo', star: 1, slot: 3 }, { id: 'lag_avatar', star: 1, slot: 5 }] },
};
/** 같은 라운드의 다른 보스(2026-11-03 사용자: 20라운드는 언비든과 프레소린 중 하나가 반반으로 — 판마다 씨앗으로 정해짐). */
export const BOSS_ALTS: Record<number, { ko: string; en: string; units: Array<{ id: string; star: 1 | 2 | 3; slot: number; mul?: number }> }> = {
  20: { ko: '프레소린', en: 'The Prethoryn Scourge', units: [{ id: 'preth_hunter', star: 1, slot: 0 }, { id: 'preth_hunter', star: 1, slot: 1 }, { id: 'preth_hunter', star: 1, slot: 2 }, { id: 'preth_hunter', star: 1, slot: 3 }, { id: 'preth_spitter', star: 1, slot: 4 }, { id: 'preth_queen', star: 1, slot: 5 }, { id: 'preth_spitter', star: 1, slot: 6 }] },
};
/** 이 판(씨앗)에서 그 라운드에 나오는 보스. */
export function bossOf(seed: number, round: number) { const alt = BOSS_ALTS[round]; if (alt && (rng((seed ^ Math.imul(round, 0x9e3779b1) ^ 0x51ed) >>> 0)() < 0.5)) return alt; return BOSSES[round]; }
/** 라운드 r 의 적 함대(씨앗으로 고정). 보스 라운드는 정해진 함대. */
export function enemyFleet(seed: number, round: number): { name: [string, string]; units: Array<Unit | null>; boss: boolean; mul: number[] } {
  const units: Array<Unit | null> = Array(SC.board).fill(null), mul: number[] = Array(SC.board).fill(1);
  const B = bossOf(seed, round); if (B) { B.units.forEach((u, k) => { units[u.slot] = { uid: -1 - k, id: u.id, star: u.star, items: [] }; mul[u.slot] = u.mul ?? 1; }); return { name: [B.ko, B.en], units, boss: true, mul }; }
  const g = rng((seed ^ Math.imul(round, 97531)) >>> 0), n = Math.min(SC.board, 1 + Math.floor(round / 3.2)), lv = Math.min(8, 1 + Math.ceil(round / 3.5)), od = SC.odds[lv];
  const stars = round >= 26 ? [0, 0.4, 0.5, 0.1] : round >= 21 ? [0, 0.55, 0.43, 0.02] : round >= 16 ? [0, 0.6, 0.4, 0] : round >= 11 ? [0, 0.75, 0.25, 0] : round >= 7 ? [0, 0.9, 0.1, 0] : [0, 1, 0, 0];
  const frontSlots = [0, 1, 2, 3], backSlots = [4, 5, 6, 7];
  for (let k = 0; k < n; k++) { const cost = pickW(g, od) + 1, pool = SHOP_SHIPS.filter((s) => s.cost === cost), d = pool[Math.floor(g() * pool.length)];
    const wantBack = d.role === 'artillery' || d.role === 'carrier', list = wantBack && backSlots.length ? backSlots : frontSlots.length ? frontSlots : backSlots; const slot = list.shift()!;
    units[slot] = { uid: -100 - k, id: d.id, star: (pickW(g, stars) || 1) as 1 | 2 | 3, items: round >= 16 && g() < 0.25 ? [COMBOS[Math.floor(g() * COMBOS.length)].id] : round >= 8 && g() < 0.25 ? [COMP_IDS[Math.floor(g() * COMP_IDS.length)]] : [] }; }
  const NAMES: Array<[string, string]> = [['해적 선단', 'Pirate flotilla'], ['약탈자 순찰대', 'Marauder patrol'], ['분리주의 함대', 'Separatist fleet'], ['용병 함대', 'Mercenary fleet'], ['국경 분쟁 함대', 'Border fleet'], ['광신도 함대', 'Zealot fleet']];
  return { name: NAMES[Math.floor(g() * NAMES.length)], units, boss: false, mul };
}
export function enemyFighters(seed: number, round: number): { name: [string, string]; boss: boolean; fighters: Fighter[] } {
  const e = enemyFleet(seed, round), fs = makeFighters(1, e.units);
  for (const f of fs) { const m = e.mul[f.slot] * (e.boss ? 1 : 1) * (1 + Math.max(0, round - 15) * 0.015); f.hp = f.maxHp = Math.round(f.maxHp * m); f.sh = f.maxSh = Math.round(f.maxSh * m); f.ar = f.maxAr = Math.round(f.maxAr * m); f.dmg = Math.round(f.dmg * m); if (e.boss && (e.mul[f.slot] > 1 || shipById(f.id)?.big)) f.boss = true; }
  return { name: e.name, boss: e.boss, fighters: fs };
}

// ---- 혼돈 모드: 라운드마다 이변 하나(씨앗으로 고정, 미리 보임). 양쪽 모두에 걸리는 것과 한쪽만 걸리는 것.
export type ChaosMod = 'overcharge' | 'ironclad' | 'glass' | 'elite' | 'swarm' | 'surge' | 'windfall' | 'mirror';
export const CHAOS: Record<ChaosMod, [string, string, string, string]> = {
  overcharge: ['과충전', 'Overcharge', '양쪽 모든 피해 ×1.4', 'All damage on both sides ×1.4'],
  ironclad: ['철갑의 날', 'Ironclad', '양쪽 장갑 ×2', 'Armor ×2 on both sides'],
  glass: ['유리 대포', 'Glass cannons', '양쪽 선체 ×0.6 · 피해 ×1.2', 'Hull ×0.6 and damage ×1.2 on both sides'],
  elite: ['정예 적군', 'Elite foes', '적 함대 전체 능력 ×1.25', 'Enemy fleet stats ×1.25'],
  swarm: ['떼거리', 'Swarm', '적에게 ★2 코르벳 두 척 추가', 'The enemy gains two ★2 corvettes'],
  surge: ['사기 충천', 'High morale', '우리 함선 선체 ×1.3', 'Our ships\' hull ×1.3'],
  windfall: ['횡재', 'Windfall', '이번 라운드 시작에 자재 +6', '+6 materials at the start of this round'],
  mirror: ['거울 함대', 'Mirror fleet', '적이 우리 함대를 그대로 베낌(부품 없이)', 'The enemy copies our fleet (without components)'],
};
export const CHAOS_IDS = Object.keys(CHAOS) as ChaosMod[];
/** 혼돈 모드의 라운드 이변(일반 모드·1라운드는 없음). */
export const chaosOf = (r: Pick<Run, 'chaos' | 'seed' | 'round'>): ChaosMod | null => (!r.chaos || r.round < 2 ? null : CHAOS_IDS[Math.floor(rng((r.seed ^ Math.imul(r.round, 48271) ^ 0xc4a05) >>> 0)() * CHAOS_IDS.length)]);
function applyChaos(mod: ChaosMod | null, mine: Fighter[], foe: Fighter[]): void {
  if (!mod) return; const all = [...mine, ...foe], mul = (L: Fighter[], k: 'hp' | 'ar' | 'dmg', m: number) => L.forEach((f) => { if (k === 'dmg') f.dmg = Math.round(f.dmg * m); else if (k === 'hp') { f.hp = f.maxHp = Math.round(f.maxHp * m); } else { f.ar = f.maxAr = Math.round(f.maxAr * m); } });
  if (mod === 'overcharge') mul(all, 'dmg', 1.4); else if (mod === 'ironclad') mul(all, 'ar', 2); else if (mod === 'glass') { mul(all, 'hp', 0.6); mul(all, 'dmg', 1.2); }
  else if (mod === 'elite') { mul(foe, 'hp', 1.25); mul(foe, 'ar', 1.25); mul(foe, 'dmg', 1.25); foe.forEach((f) => { f.sh = f.maxSh = Math.round(f.maxSh * 1.25); }); } else if (mod === 'surge') mul(mine, 'hp', 1.3);
}
/** 라운드 점수(톡톡이의 시험처럼): 이기면 기본 + 라운드 + 살아남은 함선, 한 척도 안 잃으면 보너스, 보스는 크게. 혼돈은 끝에 × 1.5. */
export function roundScore(round: number, won: boolean, survivors: number, lost: number): number { if (!won) return 0; const bi = (SC.bosses as readonly number[]).indexOf(round) + 1; return 10 + round * 5 + survivors * 3 + (lost === 0 ? 15 : 0) + (bi > 0 ? 100 * bi : 0); }
export const finalScore = (r: Run): number => Math.round(r.score * (r.chaos ? 1.5 : 1) * (r.hard ? SC.hardScore : 1));

/** 출격: 전투 → 결과 적용(목숨·보스·점수·금·경험치·다음 상점). 끝났으면 over. */
export interface FightBonus { drop?: ItemId; spores?: number; sporeItem?: ItemId; plunder?: number; plunderGold?: number; forged?: number; score?: number; chaos?: ChaosMod | null }
export function fight(r: Run): { battle: Battle; enemy: [string, string]; boss: boolean; won: boolean; loss: number; gold: number; payout: number | null; bonus: FightBonus } {
  if (r.over) throw new Error('OVER'); if (r.itemOffer) throw new Error('ITEM'); if (!boardCount(r)) throw new Error('NOBOARD');
  if (r.lives === undefined) r.lives = SC.lives; if (r.score === undefined) r.score = 0; // 예전(20라운드·체력) 판 호환
  const mod = chaosOf(r), en = enemyFighters(r.seed, r.round), mine = makeFighters(0, r.board, r.forge ?? {});
  if (mod === 'mirror') { en.fighters = makeFighters(1, r.board.map((u) => (u ? { ...u, items: [] } : null))); } // 거울 함대
  if (mod === 'swarm') { const free = [0, 1, 2, 3, 4, 5, 6, 7].filter((sl) => !en.fighters.some((f) => f.slot === sl)).slice(0, 2); en.fighters.push(...makeFighters(1, free.map((sl, k) => ({ uid: -900 - k, id: k ? 'laser_corvette' : 'escort_corvette', star: 2 as const, items: [] }))).map((f, k) => ({ ...f, slot: free[k] }))); }
  if (r.hard) for (const f of en.fighters) { const k = en.boss ? (SC.hard.bossStats[r.round] ?? SC.hard.stats) : SC.hard.normalStats; f.hp = f.maxHp = Math.round(f.maxHp * k); f.sh = f.maxSh = Math.round(f.maxSh * k); f.ar = f.maxAr = Math.round(f.maxAr * k); f.dmg = Math.round(f.dmg * SC.hard.dmg); } // 하드 모드
  applyChaos(mod, mine, en.fighters);
  const battle = simulate(mine, en.fighters, (r.seed ^ Math.imul(r.round, 7919) ^ 0x5eed) >>> 0), won = battle.winner === 0;
  const myAlive = (() => { const fsEnd = battle.fighters.map((f) => ({ ...f })); for (const e of battle.events) { const d = fsEnd[e.d]; if (e.kill && d) d.hp = 0; } return fsEnd.filter((f) => f.side === 0 && f.hp > 0).length; })();
  let loss = 0; const sc = roundScore(r.round, won, myAlive, mine.length - myAlive); r.score += sc;
  if (won) { r.streak = Math.max(1, r.streak + 1); if (isBoss(r.round)) r.bossBeaten = r.round; }
  else { r.streak = Math.min(-1, r.streak - 1); loss = 1; r.lives = Math.max(0, r.lives - 1); } // 질 때마다 목숨 하나
  const gold0 = r.gold, syn = new Map(synergies(r.board).filter((x) => x.tier > 0).map((x) => [x.key, x.tier])), bonus: FightBonus = { score: sc, chaos: mod };
  if (syn.has('fungoid')) { r.spores = (r.spores ?? 0) + (won ? 1 : 2); bonus.spores = r.spores; if (r.spores >= 6) { r.spores -= 6; const g = runRng(r, 31); bonus.sporeItem = ITEM_IDS[Math.floor(g() * ITEM_IDS.length)]; r.items.push(bonus.sporeItem); bonus.spores = r.spores; } } // 균류: 포자
  if (syn.has('reptilian') && battle.marKills) { r.plunder = (r.plunder ?? 0) + battle.marKills * (syn.get('reptilian')! >= 4 ? 3 : syn.get('reptilian')! >= 2 ? 2 : 1); let n = 0; while (r.plunder >= 10) { r.plunder -= 10; n += 4; } if (n) { r.gold += n; bonus.plunderGold = n; } bonus.plunder = r.plunder; } // 약탈자: 전리품
  if (syn.has('plantoid') && r.round % 3 === 0) { r.forge = r.forge ?? {}; const step = SYNERGY.plantoid.val[syn.get('plantoid')! - 1]; let grown = 0; for (const u of r.board) { if (!u || !originsOf(u.id).includes('plantoid')) continue; const k = String(u.uid), was = r.forge[k] ?? 0; r.forge[k] = Math.min(GROW_MAX, was + step); if (r.forge[k] > was) grown++; } if (grown) bonus.forged = grown; } // 식물: 성장
  let payout: number | null = null;
  if (r.lives <= 0) { r.over = true; payout = payoutOf(r, true); }
  else if (r.round >= SC.rounds) { r.over = true; r.won = r.bossBeaten >= SC.rounds; payout = payoutOf(r, false); }
  else {
    const interest = Math.min(SC.interestMax, Math.floor(r.gold / SC.interestPer));
    r.gold += SC.income + interest + (won ? SC.winGold : 0) + (Math.abs(r.streak) >= 3 ? 1 : 0);
    if (won && !isBoss(r.round) && !(SC.itemRounds as readonly number[]).includes(r.round)) { const g = runRng(r, 29); if (g() < SC.dropChance) { bonus.drop = COMP_IDS[Math.floor(g() * COMP_IDS.length)]; r.items.push(bonus.drop); } } // 잔해에서 부품(랜덤 드랍)
    if ((SC.itemRounds as readonly number[]).includes(r.round)) { const g = runRng(r, 23), done = won && isBoss(r.round), pool: ItemId[] = done ? COMBOS.map((c) => c.id) : [...COMP_IDS]; r.itemOffer = [0, 1, 2].map(() => pool.splice(Math.floor(g() * pool.length), 1)[0]); } // 보스를 이기면 완성 아이템 중 하나
    r.round++; addXp(r, SC.xpPerRound); if (!r.locked) rollShop(r); r.locked = false; if (chaosOf(r) === 'windfall') r.gold += 6;
  }
  return { battle, enemy: en.name, boss: en.boss, won, loss, gold: r.gold - gold0, payout, bonus };
}
/** 보스를 하나라도 이겼으면 언제든 철수(그 단계 배당). */
export function retreat(r: Run): number { if (r.over) throw new Error('OVER'); if (!r.bossBeaten) throw new Error('NOBOSS'); r.over = true; r.retreated = true; return payoutOf(r, false); }
