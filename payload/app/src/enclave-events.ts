// 엔클레이브·캐러밴 소식(알파 11, 2026-10-25). 순수 규칙만. 모드가 매달 STATE 안에 SLLM:ENCLAVE(fest·outrage·cara)를 보내고(sllm_probe_scan.txt),
// 앱은 지난달과 비교해 「바뀐 것」만 알린다. 게임 효과 없음 · AI 호출 없음(축제 개막·소동은 기존 호외 후보로만 올린다 — 호외는 연 상한 안에서만 나온다).
// 그레이트 칸 등장은 은하 위기 특별판(crisis.ts khan)이 이미 맡는다.
import { L } from './i18n-pick';

export interface EnclaveSeen { fest: boolean; outrage: boolean; cara: number }
export interface EnclaveChange { festStart: boolean; festEnd: boolean; outrage: boolean; caravans: number[] }
export const NO_CHANGE: EnclaveChange = { festStart: false, festEnd: false, outrage: false, caravans: [] };

/** 지난달(prev) → 이번 달(cur). prev 가 없으면(이 세이브 첫 달·앱을 새로 켬) 기준만 잡고 알리지 않는다. */
export function enclaveChanges(prev: EnclaveSeen | undefined, cur: EnclaveSeen): EnclaveChange {
  if (!prev) return NO_CHANGE;
  const caravans = [1, 2, 3].filter((n) => (cur.cara & (1 << (n - 1))) && !(prev.cara & (1 << (n - 1))));
  return { festStart: cur.fest && !prev.fest, festEnd: !cur.fest && prev.fest, outrage: cur.outrage && !prev.outrage, caravans };
}

export const enclaveText = {
  festStartTitle: () => L('세계의 축제가 막을 올렸습니다', 'The Festival of Worlds has begun'),
  festStartBody: () => L('예술가 극단의 축제가 제국 곳곳에서 열립니다. 단말기에서 극단 단장과 이야기할 수 있습니다.', 'The Artisan Troupe\'s festival is under way across the empire. You can speak with the headmaster from the terminal.'),
  festStart: (date: string) => L(`${date} 예술가 극단의 「세계의 축제」가 우리 제국에서 막을 올렸다`, `${date} The Artisan Troupe's Festival of Worlds opened in our empire`),
  festEnd: (date: string) => L(`${date} 「세계의 축제」가 막을 내렸다`, `${date} The Festival of Worlds came to a close`),
  outrage: (date: string) => L(`${date} 「세계의 축제」 인파 사고 — 한 행성에서 군중이 몰려 큰 피해가 났다`, `${date} Festival of Worlds disaster: a crowd stampede caused heavy casualties on one of our worlds`),
  caravanTitle: () => L('캐러밴 선단이 국경에 들어왔습니다', 'A Caravaneer fleet has entered our borders'),
  caravanBody: (n: number) => L(`${n}번 캐러밴 선단이 우리 영역을 지나갑니다. 게임의 캐러밴 거래 창에서 물건을 볼 수 있습니다.`, `Caravaneer fleet ${n} is passing through our space. You can browse their wares in the game's Caravaneer window.`),
  caravan: (date: string, n: number) => L(`${date} ${n}번 캐러밴 선단이 우리 국경에 들어왔다`, `${date} Caravaneer fleet ${n} entered our borders`),
};
