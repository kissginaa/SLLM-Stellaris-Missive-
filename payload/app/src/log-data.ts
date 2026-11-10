// 레전드 오브 갤럭시 — 고정 데이터(2026-10-30 사용자 결정): 무기 100개(자리마다 20개), 선수 200명(그중 레전드 20명).
// 모든 세이브에서 같은 선수·같은 무기(초상화·아이콘 그림을 붙이기 위해). 그림 자리: ui/log/legends/<id>.png, ui/log/weapons/<id>.png(없으면 글자만).
// 선수 이름은 이스포츠 닉네임처럼 라틴 글자 그대로(한·영 공통). 레전드는 별명만 한·영.
import { type Role, type WeaponMods, ROLES, hashSeed } from './log-game';

// ---------------- 무기 100개 ----------------
// 성향: A 공격, X 폭발(공격↑방어↓), D 방어, T 탱커(방어·밀기), P 밀기, O 수호자 사냥, B 고르게. 수치는 ±0.02 정도 개성.
const PROFILE: Record<string, WeaponMods> = {
  A: { atk: 1.12, def: 0.93, push: 1, obj: 1 }, X: { atk: 1.16, def: 0.88, push: 1, obj: 1 }, D: { atk: 0.92, def: 1.12, push: 1, obj: 1 },
  T: { atk: 0.88, def: 1.16, push: 1.04, obj: 1 }, P: { atk: 1, def: 0.96, push: 1.15, obj: 1 }, O: { atk: 1, def: 0.98, push: 1, obj: 1.18 }, B: { atk: 1.05, def: 1.04, push: 1, obj: 1 },
};
export interface WeaponDef { id: string; role: Role; ko: string; en: string; kind: string; m: WeaponMods }
const W_RAW: Record<Role, string> = {
  top: `grav_greatsword|중력 대검|Gravity Greatsword|A;plasma_halberd|플라스마 미늘창|Plasma Halberd|B;aegis_tower|이지스 대방패|Aegis Tower Shield|T;seismic_hammer|지진 망치|Seismic Hammer|P;chain_axe|사슬 도끼|Chain Axe|X;phase_lance|위상 랜스|Phase Lance|A;bastion_gauntlet|요새 건틀릿|Bastion Gauntlets|D;thermal_maul|열압 철퇴|Thermal Maul|P;void_cleaver|공허 식칼|Void Cleaver|X;ion_glaive|이온 언월도|Ion Glaive|B;riot_shield|진압 방패|Riot Shield|T;magnetic_flail|자기 도리깨|Magnetic Flail|O;fusion_claymore|융합 클레이모어|Fusion Claymore|A;kinetic_ram|운동 충각|Kinetic Ram|P;spiked_bulwark|가시 방벽|Spiked Bulwark|D;nova_warhammer|노바 전쟁망치|Nova Warhammer|X;arc_trident|전호 삼지창|Arc Trident|O;titan_fists|타이탄 주먹|Titan Fists|B;shatter_pike|파쇄 장창|Shatter Pike|A;stasis_buckler|정지장 원형방패|Stasis Buckler|T`,
  jungle: `mono_dagger|단분자 단검|Monofilament Dagger|X;phase_blades|위상 쌍검|Phase Blades|A;chain_sickle|사슬낫|Chain Sickle|O;cloak_knife|은폐 나이프|Cloak Knife|X;venom_claws|독침 발톱|Venom Claws|A;grapple_launcher|갈고리 사출기|Grapple Launcher|O;shadow_katana|그림자 카타나|Shadow Katana|B;stun_baton|기절봉|Stun Baton|D;razor_chakram|면도날 차크람|Razor Chakram|P;hunter_spear|사냥꾼 투창|Hunter's Spear|O;blink_tonfa|순간이동 톤파|Blink Tonfa|B;nanite_whip|나노 채찍|Nanite Whip|A;trap_layer|함정 설치기|Trap Layer|D;ripper_saw|절단 톱날|Ripper Saw|X;silent_crossbow|무음 석궁|Silent Crossbow|P;gravity_kunai|중력 쿠나이|Gravity Kunai|O;wolf_fang|늑대 송곳니 검|Wolf-fang Blade|A;smoke_scythe|연막 대낫|Smoke Scythe|B;leech_dirk|흡수 단도|Leech Dirk|T;predator_net|포식자 그물|Predator Net|D`,
  mid: `plasma_orb|플라스마 구체|Plasma Orb|X;gravity_well|중력우물 발생기|Gravity Well Projector|O;chrono_staff|시간 지팡이|Chrono Staff|B;lightning_coil|번개 코일|Lightning Coil|A;psi_amplifier|초능력 증폭기|Psionic Amplifier|X;nebula_scepter|성운 홀|Nebula Scepter|B;beam_caster|융합 광선 투사기|Fusion Beam Caster|A;mirror_prism|거울 프리즘|Mirror Prism|D;singularity_core|특이점 코어|Singularity Core|X;frost_emitter|냉기 방사기|Frost Emitter|D;star_forge|별 용광로|Star Forge|P;ion_storm|이온 폭풍기|Ion Storm Engine|P;hologram_deck|홀로그램 카드|Hologram Deck|B;void_tablet|공허 서판|Void Tablet|A;solar_flare|태양 플레어 총|Solar Flare Gun|X;quantum_dice|양자 주사위|Quantum Dice|O;echo_chime|메아리 종|Echo Chime|D;magma_rod|용암 막대|Magma Rod|P;dark_glove|암흑물질 장갑|Dark-matter Glove|A;aurora_fan|오로라 부채|Aurora Fan|O`,
  bot: `railgun|레일건|Railgun|X;twin_blasters|쌍권총 블래스터|Twin Blasters|A;pulse_rifle|펄스 소총|Pulse Rifle|B;gauss_cannon|가우스 캐논|Gauss Cannon|P;sniper_lance|저격 광창|Sniper Lance|X;scatter_gun|산탄총|Scatter Gun|A;drone_swarm|공격 드론 떼|Attack Drone Swarm|P;star_bow|별빛 활|Starlight Bow|B;rocket_pod|로켓 포드|Rocket Pod|P;flak_launcher|대공 발사기|Flak Launcher|O;laser_carbine|레이저 카빈|Laser Carbine|B;plasma_minigun|플라스마 미니건|Plasma Minigun|A;smart_pistol|유도 권총|Smart Pistol|D;arc_repeater|전호 연발총|Arc Repeater|A;mortar_tube|박격포|Mortar Tube|P;needle_gun|바늘총|Needle Gun|X;heavy_slugger|중탄총|Heavy Slugger|B;photon_sling|광자 투석구|Photon Sling|O;tesla_rifle|테슬라 소총|Tesla Rifle|O;hunter_longbow|사냥꾼 장궁|Hunter's Longbow|D`,
  support: `med_beam|치료 광선총|Medi-beam|D;shield_projector|방어막 투사기|Shield Projector|T;sonic_lyre|음파 리라|Sonic Lyre|B;warden_chain|집행 사슬|Warden's Chain|O;nano_censer|나노 향로|Nanite Censer|D;barrier_drone|방벽 드론|Barrier Drone|T;rally_beacon|깃발 신호기|Rally Beacon|B;stasis_rod|정지 막대|Stasis Rod|O;repair_swarm|수리 나노떼|Repair Swarm|D;gravity_tether|중력 밧줄|Gravity Tether|O;light_lantern|빛의 등불|Lantern of Light|B;emp_grenades|EMP 수류탄|EMP Grenades|A;guardian_wings|수호 날개|Guardian Wings|T;pheromone_sprayer|페로몬 분무기|Pheromone Sprayer|B;decoy_projector|미끼 투영기|Decoy Projector|D;overclock_relay|과부하 중계기|Overclock Relay|A;spirit_bell|영혼 방울|Spirit Bell|O;bulwark_dome|방벽 돔|Bulwark Dome|T;harmony_flute|조화의 피리|Flute of Harmony|B;lifeline_tether|생명줄|Lifeline Tether|D`,
};
const jit = (id: string, k: string) => ((hashSeed(`${id}:${k}`) % 5) - 2) / 100;
export const WEAPONS: WeaponDef[] = ROLES.flatMap((role) => W_RAW[role].split(';').map((row) => {
  const [id, ko, en, kind] = row.split('|'), b = PROFILE[kind];
  return { id, role, ko, en, kind, m: { atk: +(b.atk + jit(id, 'a')).toFixed(2), def: +(b.def + jit(id, 'd')).toFixed(2), push: +(b.push + jit(id, 'p') / 2).toFixed(3), obj: +(b.obj + jit(id, 'o') / 2).toFixed(3) } };
}));
export const KIND_NAME: Record<string, [string, string]> = { A: ['공격형', 'Offense'], X: ['폭발형', 'Burst'], D: ['방어형', 'Defense'], T: ['탱커형', 'Tank'], P: ['밀기형', 'Push'], O: ['사냥형', 'Hunter'], B: ['균형형', 'Balanced'] };
const W_BY = new Map(WEAPONS.map((w) => [w.id, w]));
export const weaponById = (id: string): WeaponDef | undefined => W_BY.get(id);

// ---------------- 선수 200명 ----------------
/** g = 성별(본명 짓기용), cls = 본명을 지을 종족 계열(레전드만 — 초상화 종족. 일반 선수는 우리 제국 종족 비율대로). */
export interface RosterEntry { rid: string; handle: string; role: Role; g: 'm' | 'f'; cls?: string; legend?: { ko: string; en: string; sig: string; species: string }; order: number }
/** 레전드 20명(자리마다 4명): 닉네임 · 별명(한·영) · 대표 무기 · 종족 모습(초상화 의뢰용). */
const LEGENDS: Array<[string, Role, string, string, string, string, 'm' | 'f']> = [
  ['Aegis', 'top', '불멸의 방패', 'The Undying Shield', 'aegis_tower', 'lithoid', 'm'],
  ['Krakatoa', 'top', '화산', 'The Volcano', 'thermal_maul', 'reptilian', 'm'],
  ['Monolith', 'top', '움직이지 않는 산', 'The Unmoving Mountain', 'bastion_gauntlet', 'avian', 'm'],
  ['Valkyr', 'top', '전장의 여왕', 'Queen of the Field', 'phase_lance', 'humanoid', 'f'],
  ['Phantom', 'jungle', '유령', 'The Ghost', 'cloak_knife', 'humanoid', 'f'],
  ['Mantis', 'jungle', '사마귀', 'The Mantis', 'phase_blades', 'arthropoid', 'f'],
  ['Nightjar', 'jungle', '밤의 사냥새', 'The Nightjar', 'gravity_kunai', 'avian', 'm'],
  ['Fenrir', 'jungle', '사슬 끊은 늑대', 'The Unchained Wolf', 'wolf_fang', 'mammalian', 'm'],
  ['Zenith', 'mid', '정점', 'The Apex', 'singularity_core', 'humanoid', 'm'],
  ['Oracle', 'mid', '예언자', 'The Oracle', 'chrono_staff', 'molluscoid', 'f'],
  ['Singularity', 'mid', '특이점', 'The Singularity', 'gravity_well', 'machine', 'm'],
  ['Obsidia', 'mid', '흑요석 마녀', 'The Obsidian Witch', 'void_tablet', 'necroid', 'f'],
  ['Deadeye', 'bot', '백발백중', 'Never Misses', 'railgun', 'reptilian', 'm'],
  ['Helios', 'bot', '태양', 'The Sun', 'star_bow', 'plantoid', 'm'],
  ['Quasar', 'bot', '퀘이사', 'The Quasar', 'gauss_cannon', 'humanoid', 'f'],
  ['Ricochet', 'bot', '도탄', 'The Ricochet', 'twin_blasters', 'aquatic', 'f'],
  ['Seraph', 'support', '치천사', 'The Seraph', 'guardian_wings', 'avian', 'f'],
  ['Lighthouse', 'support', '등대', 'The Lighthouse', 'light_lantern', 'fungoid', 'f'],
  ['Shepherd', 'support', '목자', 'The Shepherd', 'rally_beacon', 'mammalian', 'm'],
  ['Echo', 'support', '메아리', 'The Echo', 'sonic_lyre', 'toxoid', 'f'],
];
/** 초상화 종족 → 게임 종족 계열(본명을 그 종족 이름 표로). */
export const SPECIES_CLASS: Record<string, string> = { lithoid: 'LITHOID', reptilian: 'REP', avian: 'AVI', humanoid: 'HUM', arthropoid: 'ART', mammalian: 'MAM', molluscoid: 'MOL', machine: 'MACHINE', necroid: 'NECROID', plantoid: 'PLANT', aquatic: 'AQUATIC', fungoid: 'FUN', toxoid: 'TOX' };
/** 일반 선수 닉네임 — 조합(사용자 결정 2026-10-30: 바리에이션 5,000개 이상). 앞말 60 × 뒷말 90 = 5,400(같은 말 겹침 빼고), 이스포츠식 붙여 쓰기(예: SilentFox).
 *  처음 명단 180명도 여기서(모든 세이브 같은 이름), 그 뒤 신인은 늘 새 닉네임(세이브 안에서 겹치지 않게). 레전드 20명은 고유 닉네임. */
const NICK_A = `Neo Dark Silent Iron Blue Red Star Night Void Sky Frost Storm Shadow Solar Lunar Nova Hyper Cyber Quantum Astro Crimson Golden Silver Swift Wild Lucky Mad Little Big Lone
Rogue Ghost Steel Fire Ice Thunder Zero Prime Ultra Mega Mini Atomic Cosmic Stellar Pixel Neon Turbo Mystic Royal Savage Brave Calm Lazy Happy Grim Holy Final First Last True`.split(/\s+/);
const NICK_B = `Fox Wolf Hawk Blade Fang Claw Bear Tiger Lion Viper Raven Crow Owl Shark Whale Moth Bee Cat Dog Rabbit Panda Otter Lynx Puma Cobra Dragon Phoenix Golem Knight Ronin
Ninja Monk Mage Bard Sage King Queen Prince Joker Pilot Rider Hunter Sniper Gunner Ace Bolt Spark Flame Wave Tide Comet Meteor Orbit Star Moon Sun Rock Stone Storm Wind
Rain Snow Leaf Root Seed Rose Lotus Pearl Jade Gem Coin Dice Card Bit Byte Code Core Gear Drone Robot Mech Engine Rocket Arrow Spear Shield Hammer Axe Bullet Echo`.split(/\s+/);
const NICKS: string[] = (() => {
  const all: string[] = []; for (const a of NICK_A) for (const b of NICK_B) if (a !== b) all.push(a + b);
  const out: string[] = [], n = all.length; let step = 2477; while (gcd(step, n) !== 1) step++; // 섞인 순서(비슷한 이름이 줄줄이 나오지 않게)
  for (let i = 0; i < n; i++) out.push(all[(i * step + 131) % n]);
  return out;
})();
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }
export const NICK_COUNT = NICKS.length;
/** k번째 닉네임(다 쓰면 숫자를 붙여 계속). */
export const nickname = (k: number): string => NICKS[k % NICKS.length] + (k >= NICKS.length ? String(Math.floor(k / NICKS.length) + 1) : '');
const NORMALS = Array.from({ length: 180 }, (_, i) => nickname(i));
export const FIRST_NICKS = NORMALS.length; // 신인 닉네임은 이 번호부터
/** 데뷔 순서: 0~79 = 첫 시즌부터 뛰는 선수(레전드 8명 포함), 80~ = 시즌마다 신인 10명씩 데뷔(레전드 12명이 사이사이). */
export const ROSTER: RosterEntry[] = (() => {
  const legends = LEGENDS.map(([handle, role, ko, en, sig, species, g], i) => ({ rid: `L${String(i + 1).padStart(2, '0')}`, handle, role, g, cls: SPECIES_CLASS[species], legend: { ko, en, sig, species }, order: 0 }));
  const normals = NORMALS.map((handle, i) => ({ rid: `P${String(i + 1).padStart(3, '0')}`, handle, role: ROLES[i % 5], g: hashSeed(`g:${handle}`) % 2 ? 'f' : 'm', order: 0 } as RosterEntry));
  const early = new Set(['L01', 'L06', 'L09', 'L14', 'L19', 'L02', 'L11', 'L16']); // 처음부터 뛰는 레전드 8명(자리 고르게)
  const out: RosterEntry[] = []; let n = 0;
  for (const p of normals.slice(0, 72)) out.push({ ...p, order: n++ });
  for (const l of legends.filter((x) => early.has(x.rid))) out.push({ ...l, order: n++ });
  const late = legends.filter((x) => !early.has(x.rid)), rest = normals.slice(72);
  for (let i = 0, j = 0; i < rest.length || j < late.length;) { // 신인 10명마다 레전드 1명꼴
    for (let k = 0; k < 9 && i < rest.length; k++) out.push({ ...rest[i++], order: n++ });
    if (j < late.length) out.push({ ...late[j++], order: n++ });
  }
  return out;
})();
export const START_ACTIVE = 80;
export const isLegend = (rid: string) => rid.startsWith('L');

// ---------------- 직접 키운 레전드(2026-10-30 사용자 결정: 레전드 양성) ----------------
/** 별명 후보(자동, 자리별). 이미 쓴 별명은 건너뜀. */
export const EPITHETS: Record<Role, Array<[string, string]>> = {
  top: [['강철 성벽', 'The Iron Rampart'], ['꺾이지 않는 자', 'The Unbending'], ['최전선의 왕', 'King of the Front Line'], ['파도막이', 'The Breakwater'], ['산을 옮기는 자', 'The Mountain Mover'], ['붉은 망치', 'The Red Hammer'], ['마지막 문', 'The Last Gate'], ['폭풍의 방패', 'Shield of the Storm']],
  jungle: [['그림자 걸음', 'Shadowstep'], ['숲의 망령', 'Wraith of the Wilds'], ['보이지 않는 칼', 'The Unseen Blade'], ['밤의 포식자', 'Night Predator'], ['수호자 사냥꾼', 'The Warden Hunter'], ['안개 속의 송곳니', 'Fang in the Mist'], ['길 없는 길', 'The Pathless'], ['사냥의 군주', 'Lord of the Hunt']],
  mid: [['별을 다루는 자', 'The Starweaver'], ['은하의 두뇌', 'Brain of the Galaxy'], ['빛의 설계자', 'Architect of Light'], ['폭풍의 눈', 'Eye of the Storm'], ['천재 마술사', 'The Prodigy Mage'], ['시간을 멈춘 자', 'The Timestopper'], ['중력의 주인', 'Master of Gravity'], ['푸른 섬광', 'The Blue Flash']],
  bot: [['한 발의 신', 'God of One Shot'], ['유성 저격수', 'The Meteor Sniper'], ['끝없는 탄창', 'The Endless Magazine'], ['황금 조준경', 'The Golden Scope'], ['폭격의 별', 'Star of the Barrage'], ['마지막 한 발', 'The Final Shot'], ['은하 명사수', 'Marksman of the Galaxy'], ['불꽃 비', 'The Fire Rain']],
  support: [['수호천사', 'The Guardian Angel'], ['전장의 등대', 'Beacon of the Field'], ['생명의 노래', 'Song of Life'], ['보이지 않는 손', 'The Invisible Hand'], ['동료의 방패', 'Shield of the Team'], ['기적의 손', 'The Miracle Hand'], ['마지막 숨결', 'The Last Breath'], ['별빛 목자', 'The Starlit Shepherd']],
};
/** 예비 초상화(종족별, 승격할 때 고름) — ui/log/legends/extra/H01.png … H12.png. 내 그림은 ui/log/legends/custom/ 아무 이름.png. */
export const EXTRA_PORTRAITS = Array.from({ length: 12 }, (_, i) => `H${String(i + 1).padStart(2, '0')}`);

// ---------------- 구단 모기업(회사) 이름 — 「회사명 + 팀 이름」(2026-10-30 사용자 제안: 행성이 적어도 팀 이름이 겹치지 않게) ----------------
// 브랜드 85개 × 업종 12개 ≈ 1,000개. 실제 큰 회사 이름처럼 들리는 말은 뺐음. 한·영 한 쌍.
const BRANDS = `베가|Vega 시리우스|Sirius 알타이르|Altair 데네브|Deneb 리겔|Rigel 카노푸스|Canopus 안타레스|Antares 베텔게우스|Betelgeuse 아르크투루스|Arcturus 카펠라|Capella
프로키온|Procyon 알데바란|Aldebaran 스피카|Spica 레굴루스|Regulus 미라|Mira 카스토르|Castor 폴룩스|Pollux 아케르나르|Achernar 하다르|Hadar 벨라트릭스|Bellatrix
엘나트|Elnath 알니탁|Alnitak 민타카|Mintaka 사이프|Saiph 아크룩스|Acrux 샤울라|Shaula 알키오네|Alcyone 마이아|Maia 엘렉트라|Electra 타이게타|Taygeta
메로페|Merope 플레이오네|Pleione 헬릭스|Helix 아스트라|Astra 코스모|Cosmo 스텔라|Stella 솔라리스|Solaris 테라노바|Terranova 네오스타|Neostar 퀀텀|Quantum
하이페리온|Hyperion 프로메테우스|Prometheus 아르테미스|Artemis 헤르메스|Hermes 아테나|Athena 다이달로스|Daedalus 오디세이|Odyssey 제네시스|Genesis 엑셀시어|Excelsior 인피니티|Infinity
버텍스|Vertex 시너지|Synergy 그랜드스타|Grandstar 임페리얼|Imperial 센추리|Century 밀레니엄|Millennium 퓨전|Fusion 프론티어|Frontier 보이저|Voyager 콘스텔레이션|Constellation
셀레스티얼|Celestial 사파이어|Sapphire 에메랄드|Emerald 플래티넘|Platinum 이리듐|Iridium 실버라인|Silverline 블루오션|Blue Ocean 그린필드|Greenfield 레드록|Redrock 화이트스톤|Whitestone
바이너리|Binary 새별|Saebyeol 누리|Nuri 가람|Garam 하늬|Hanui 별빛|Byeolbit 온누리|Onnuri 다솜|Dasom 해솔|Haesol 은하수|Eunhasu
노스게이트|Northgate 스타브릿지|Starbridge 아이언웰|Ironwell 크레센트|Crescent 제니스|Zenyth 오메가|Omega 알파센타우리|Alpha Centauri 케플러|Kepler 허블|Hubble 라그랑주|Lagrange`;
const INDUSTRIES: Array<[string, string]> = [['중공업', 'Heavy Industries'], ['전자', 'Electronics'], ['제약', 'Pharmaceuticals'], ['항공우주', 'Aerospace'], ['에너지', 'Energy'], ['성간운송', 'Interstellar Freight'], ['통신', 'Communications'], ['바이오', 'Biotech'], ['로보틱스', 'Robotics'], ['금융', 'Financial'], ['광업', 'Mining'], ['엔터테인먼트', 'Entertainment']];
export const BRAND_LIST: Array<[string, string]> = BRANDS.split(/\s+(?=[^\s|]+\|)/).map((x) => x.trim().split('|') as [string, string]);
export const COMPANY_COUNT = BRAND_LIST.length * INDUSTRIES.length;
/** 회사 번호 → [한, 영] 이름. 번호 = 브랜드 × 12 + 업종. */
export const companyName = (i: number): [string, string] => { const b = BRAND_LIST[Math.floor(i / INDUSTRIES.length) % BRAND_LIST.length], ind = INDUSTRIES[i % INDUSTRIES.length]; return [`${b[0]} ${ind[0]}`, `${b[1]} ${ind[1]}`]; };
export const brandOf = (i: number) => Math.floor(i / INDUSTRIES.length) % BRAND_LIST.length;
/** 팀 이름(마스코트) 20개 — 리그 안에서 겹치지 않게 고름. */
export const MASCOTS: Array<[string, string]> = [['스톰', 'Storm'], ['노바', 'Novas'], ['펄서', 'Pulsars'], ['코멧', 'Comets'], ['타이탄', 'Titans'], ['레이스', 'Wraiths'], ['피닉스', 'Phoenixes'], ['나이츠', 'Knights'], ['바이퍼스', 'Vipers'], ['오로라', 'Auroras'],
  ['그리핀스', 'Griffins'], ['메테오', 'Meteors'], ['레인저스', 'Rangers'], ['드래곤즈', 'Dragons'], ['센티널', 'Sentinels'], ['호크스', 'Hawks'], ['울브스', 'Wolves'], ['이클립스', 'Eclipse'], ['블레이저스', 'Blazers'], ['스펙터스', 'Specters']];

// ---------------- 구단 로고 — 스텔라리스 깃발처럼 조합(2026-10-30 사용자 결정) ----------------
// 문장(그림) 40개 × 방패 모양 8 × 바탕 무늬 6 × 색 조합 16. 문장 그림은 ui/log/emblems/<id>.png(흰 실루엣·투명, 앱이 색을 입힘), 없으면 앱이 간단한 기본 문양으로.
export const EMBLEMS: Array<[string, string, string]> = [
  ['wolf', '늑대', 'Wolf'], ['phoenix', '불사조', 'Phoenix'], ['dragon', '용', 'Dragon'], ['lion', '사자', 'Lion'], ['eagle', '독수리', 'Eagle'], ['serpent', '뱀', 'Serpent'], ['shark', '상어', 'Shark'], ['bear', '곰', 'Bear'],
  ['stag', '사슴', 'Stag'], ['scorpion', '전갈', 'Scorpion'], ['kraken', '크라켄', 'Kraken'], ['griffin', '그리핀', 'Griffin'], ['mantis', '사마귀', 'Mantis'], ['raven', '까마귀', 'Raven'], ['tiger', '호랑이', 'Tiger'], ['bull', '황소', 'Bull'],
  ['sword', '검', 'Sword'], ['crown', '왕관', 'Crown'], ['star', '별', 'Star'], ['comet', '혜성', 'Comet'], ['ringed_planet', '고리 행성', 'Ringed Planet'], ['crescent', '초승달', 'Crescent'], ['sun', '태양', 'Sun'], ['bolt', '번개', 'Lightning Bolt'],
  ['flame', '불꽃', 'Flame'], ['rocket', '로켓', 'Rocket'], ['satellite', '위성', 'Satellite'], ['atom', '원자', 'Atom'], ['gear', '톱니바퀴', 'Gear'], ['crystal', '결정', 'Crystal'], ['anchor', '닻', 'Anchor'], ['skull', '해골', 'Skull'],
  ['eye', '눈', 'Eye'], ['wings', '날개', 'Wings'], ['trident', '삼지창', 'Trident'], ['hammer', '망치', 'Hammer'], ['tower', '탑', 'Tower'], ['galaxy', '은하', 'Galaxy'], ['mask', '가면', 'Mask'], ['helm', '투구', 'Helm'],
];
export const LOGO_SHAPES: Array<[string, string, string]> = [['shield', '방패', 'Shield'], ['round', '원', 'Round'], ['hex', '육각형', 'Hexagon'], ['badge', '오각 엠블럼', 'Badge'], ['diamond', '마름모', 'Diamond'], ['octagon', '팔각형', 'Octagon'], ['pennant', '깃발', 'Pennant'], ['winged', '날개 방패', 'Winged Shield']];
export const LOGO_PATTERNS: Array<[string, string, string]> = [['solid', '단색', 'Solid'], ['split', '반반', 'Split'], ['diagonal', '사선', 'Diagonal'], ['band', '띠', 'Band'], ['chevron', '갈매기', 'Chevron'], ['quarter', '사분', 'Quartered']];
/** 색 조합: [바탕1, 바탕2, 테두리, 문장]. */
export const LOGO_COLORS: Array<[string, string, string, string]> = [
  ['#0b2a4a', '#1d5c96', '#6fd6ff', '#ffffff'], ['#4a0b12', '#9b1b2a', '#ffcf6a', '#ffffff'], ['#0d3b1e', '#1f7a3e', '#c8f07a', '#ffffff'], ['#2d0b4a', '#6a2a9b', '#e2b8ff', '#ffffff'],
  ['#3b2a05', '#a8761a', '#ffe08a', '#1a1206'], ['#111316', '#3a3f47', '#ff5d6c', '#ffffff'], ['#05333b', '#118a96', '#a8fff4', '#ffffff'], ['#4a2205', '#d0661a', '#ffd2a0', '#ffffff'],
  ['#e8e8ee', '#9aa3b0', '#1d2b3c', '#1d2b3c'], ['#16063a', '#2c1a7a', '#ff7ae0', '#ffe9fb'], ['#0a1f12', '#111d16', '#3cff8a', '#3cff8a'], ['#3a0b2a', '#8a1a5a', '#ffd700', '#ffd700'],
  ['#08121f', '#0f2440', '#f0c96a', '#f0c96a'], ['#2a0606', '#140404', '#ff3b30', '#ff9b8f'], ['#062a2a', '#0b4a3a', '#ffffff', '#e8fff8'], ['#20222a', '#5a5f6a', '#6fd6ff', '#6fd6ff'],
];
export interface Logo { e: number; s: number; p: number; c: number }
export const LOGO_COUNT = EMBLEMS.length * LOGO_SHAPES.length * LOGO_PATTERNS.length * LOGO_COLORS.length;

// ---------------- 무기 궁극기 이름(2026-10-31) ----------------
// 효과는 무기 성향(A 공격 난사 · X 폭발 처형 · D 방어 보호막 · T 탱커 기절 · P 밀기 공성 · O 사냥 강타 · B 균형 회복)이 정하고, 이름은 자리마다 다름.
export const ULT_NAMES: Record<Role, Record<string, [string, string]>> = {
  top: { A: ['광전사의 연격', 'Berserker Flurry'], X: ['단두 일격', 'Executioner\'s Cleave'], D: ['불굴의 성채', 'Unyielding Bastion'], T: ['대지 붕괴', 'Earthshatter'], P: ['공성 돌격', 'Siege Charge'], O: ['거인 사냥', 'Giant Slayer'], B: ['투사의 숨결', 'Champion\'s Second Wind'] },
  jungle: { A: ['그림자 난무', 'Shadow Frenzy'], X: ['암살', 'Assassinate'], D: ['연막 장막', 'Smoke Veil'], T: ['덫 폭발', 'Snare Burst'], P: ['배후 기습', 'Flank Raid'], O: ['포식자의 강타', 'Predator Smite'], B: ['사냥꾼의 본능', 'Hunter\'s Instinct'] },
  mid: { A: ['연쇄 번개', 'Chain Lightning'], X: ['초신성', 'Supernova'], D: ['시간 정지 방벽', 'Chrono Barrier'], T: ['중력 붕괴', 'Gravity Collapse'], P: ['궤도 포격', 'Orbital Strike'], O: ['성운 낙인', 'Nebula Brand'], B: ['시간 역행', 'Rewind'] },
  bot: { A: ['총알 폭풍', 'Bullet Storm'], X: ['관통 저격', 'Piercing Snipe'], D: ['반사 장갑', 'Reflective Plating'], T: ['충격탄', 'Concussion Round'], P: ['융단 폭격', 'Carpet Bombing'], O: ['대형 표적 사격', 'Big Game Shot'], B: ['전술 재장전', 'Tactical Reload'] },
  support: { A: ['전투 함성', 'War Cry'], X: ['심판의 빛', 'Judgment Ray'], D: ['수호 결계', 'Guardian Ward'], T: ['정지장', 'Stasis Field'], P: ['진격 신호', 'Advance Signal'], O: ['봉인 사슬', 'Binding Chains'], B: ['재생의 노래', 'Song of Renewal'] },
};
