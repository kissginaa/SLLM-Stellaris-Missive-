// 큐레이터 감정서 문구(알파 11, 2026-10-25 Claude 작성). LLM 을 부르지 않으려고 미리 써 둔 틀(설계: docs/ALPHA11_ENCLAVES_DESIGN_KO.md §8-3).
// - 상인 수집품: collectibles-data.ts 의 물건별 감정문(a)을 그대로 쓴다.
// - 대보관소 표본(specimens-data.ts): 분류 3 × 희귀도 4 마다 틀 3개. 같은 표본은 늘 같은 틀(키 해시) → 다시 열어도 글이 바뀌지 않는다.
// 빈칸: {name} 표본 이름, {nation} 소장국, {years} 대여 기간(년). 문구는 모두 ["한국어", "English"] 쌍 → 언어 팩 뼈대 도구가 모은다.
import { L } from './i18n-pick';
import { COLLECTIBLES, COLLECTIBLE_CLASS, COLLECTIBLE_GRADE, type Collectible, type CollectibleGrade, type Pair } from './collectibles-data';
import { SPEC_BY_KEY, type SpecCat, type SpecRarity } from './archive';

/** 큐레이터 대여 보상 등급(사용자 확정 2026-10-25): 일반 +3% · 희귀 +5% · 전설 +8% 연구 속도, 360일. */
export const LOAN_BONUS: Record<CollectibleGrade, number> = { 1: 3, 2: 5, 3: 8 };
export const LOAN_BONUS_DAYS = 360;
export const specimenGrade = (r: SpecRarity): CollectibleGrade => (r === 'common' ? 1 : r === 'rare' ? 2 : 3);

export const SPEC_CAT_NAME: Record<SpecCat, Pair> = {
  xeno_geology: ['자연 표본 · 외계 지질', 'Natural specimen · Xeno-geology'],
  aesthetic_wonder: ['예술품 · 미적 경이', 'Artwork · Aesthetic wonder'],
  historical_item: ['문서·유물 · 역사 물품', 'Artefact · Historical item'],
};
export const SPEC_RARITY_NAME: Record<SpecRarity, Pair> = {
  common: ['일반', 'Common'], rare: ['희귀', 'Rare'], epic: ['영웅', 'Epic'], exceptional: ['특별', 'Exceptional'],
};
const AGE: Record<SpecCat, Pair[]> = {
  xeno_geology: [['지질 연대 측정 중', 'Geological dating in progress'], ['수백만 년 이상으로 추정', 'Estimated at several million years or more'], ['형성 연대 미상', 'Date of formation unknown']],
  aesthetic_wonder: [['제작 연대 미상', 'Date of making unknown'], ['양식으로 보아 수백 년 전', 'Several centuries, judging by style'], ['연대 추정 불가 — 기록 없음', 'Undatable — no records survive']],
  historical_item: [['문명 초기로 추정', 'Thought to date to an early civilisation'], ['기록상 연대 일치', 'Date consistent with records'], ['정확한 연대는 추가 조사 필요', 'Exact date requires further study']],
};
export const VERDICT: Pair = ['진품 — 위조·복제 흔적 없음', 'Authentic — no trace of forgery or replication'];

type Cell = readonly Pair[];
const OP: Record<SpecCat, Record<SpecRarity, Cell>> = {
  xeno_geology: {
    common: [
      ['{name}은(는) 비교적 흔히 보고되는 외계 표본이지만, 이 개체는 구조 손상이 적고 보존 상태가 양호하다. {years}년간의 대여로 비교 측정 자료를 확보하였음을 밝힌다.', 'The {name} is a fairly commonly reported xeno-specimen, but this one has little structural damage and is well preserved. We record that the {years}-year loan provided valuable comparative measurements.'],
      ['{name}의 물질 조성은 알려진 범위 안에 있다. 다만 채취 위치 기록이 정확해 표준 표본으로 삼기에 알맞다.', 'The material composition of the {name} lies within known ranges. Its precise collection record, however, makes it well suited as a reference sample.'],
      ['{name}은(는) 학술적으로 특별하지 않으나, {nation}이(가) 잘 관리해 온 덕분에 표면 오염이 거의 없다. 교육용 전시에 권할 만하다.', 'The {name} is not exceptional to science, but thanks to {nation}\'s careful keeping its surface is nearly free of contamination. Recommended for educational display.'],
    ],
    rare: [
      ['{name}은(는) 같은 계통 표본이 손에 꼽힐 만큼 드물다. 내부 구조 측정으로 형성 조건에 관한 새로운 단서를 얻었다.', 'Specimens of the {name}\'s lineage can be counted on one hand. Measurements of its inner structure yielded new clues to its formation.'],
      ['{name}의 동위원소 비율은 우리 기사단 소장 기록과 다른 값을 보인다. 기존 분류를 재검토할 필요가 있다.', 'The isotope ratios of the {name} differ from those in the Order\'s records. Its existing classification may need review.'],
      ['{name}은(는) 극한 환경에서만 형성되는 것으로 알려져 있다. {years}년간의 연구는 그 환경을 복원하는 데 크게 이바지했다.', 'The {name} is known to form only in extreme environments. The {years}-year study contributed greatly to reconstructing those conditions.'],
    ],
    epic: [
      ['{name}은(는) 학계에 몇 차례만 보고된 표본이다. 이 개체의 상태는 보고된 어느 것보다 좋다. 기사단은 {nation}의 너그러움에 깊이 감사한다.', 'The {name} has been reported to science only a handful of times, and this example is in better condition than any of them. The Order is deeply grateful for {nation}\'s generosity.'],
      ['{name}의 내부에서 자연적으로는 설명하기 어려운 규칙성이 관측된다. 우연인지 아닌지는 아직 판단할 수 없다.', 'Regularities hard to explain by natural processes are observed within the {name}. Whether this is chance cannot yet be judged.'],
      ['{name}은(는) 외계 환경 형성 이론의 한 가설을 직접 뒷받침하는 실물이다. 대여 기간 동안 얻은 자료는 논문 세 편의 근거가 되었다.', 'The {name} is physical support for one hypothesis of how alien environments form. Data gathered during the loan underpins three papers.'],
    ],
    exceptional: [
      ['{name}은(는) 우리가 아는 한 은하에 단 하나뿐인 표본이다. 이 표본을 직접 측정할 수 있었던 것은 감정관 생애의 영광이다.', 'To our knowledge the {name} is the only specimen of its kind in the galaxy. To have measured it in person is the honour of this appraiser\'s life.'],
      ['{name}은(는) 현재의 외계 자연사 체계로 분류할 수 없다. 기사단은 이 표본을 위한 새 분류 항목을 만들 것을 제안한다.', 'The {name} cannot be classified within current xeno-natural history. The Order proposes a new category created for it alone.'],
      ['{name}이(가) 존재한다는 사실 자체가 학계의 사건이다. {nation}이(가) 이 표본을 공개하고 빌려준 결정은 오래 기억될 것이다.', 'That the {name} exists at all is an event for science. {nation}\'s decision to reveal and lend it will long be remembered.'],
    ],
  },
  aesthetic_wonder: {
    common: [
      ['{name}은(는) 같은 양식의 작품이 여럿 남아 있으나, 이 작품은 손질 흔적이 적어 원형을 잘 간직하고 있다.', 'Several works in the style of the {name} survive, but this one bears few restorations and keeps its original form well.'],
      ['{name}의 제작 기법은 널리 알려진 것이다. 그러나 세부 장식에 작가 고유의 버릇이 보여 작자 추적의 단서가 된다.', 'The technique of the {name} is well known, yet the artist\'s particular habits in its detail offer a clue to attribution.'],
      ['{name}은(는) 대중적 공예품에 속한다. 당시 사람들의 미감을 보여 주는 생활 미술 자료로 가치가 있다.', 'The {name} belongs to popular craft. It is valuable as everyday art revealing the taste of its time.'],
    ],
    rare: [
      ['{name}은(는) 한 문명의 짧은 전성기에만 만들어진 양식이다. 남은 작품이 드물어 비교 연구에 크게 쓰였다.', 'The {name} belongs to a style made only during a civilisation\'s brief golden age. Few survive, and it served comparative study greatly.'],
      ['{name}의 안료 분석에서 지금은 구할 수 없는 재료가 확인되었다. 복원 연구에 귀한 참고가 된다.', 'Pigment analysis of the {name} identified materials no longer obtainable. A precious reference for restoration research.'],
      ['{name}은(는) 보는 각도와 빛에 따라 인상이 크게 달라진다. {years}년 동안 여러 조건에서 관찰한 기록을 감정서에 덧붙인다.', 'The impression the {name} gives changes greatly with angle and light. Records of {years} year(s) of observation under varied conditions are appended.'],
    ],
    epic: [
      ['{name}은(는) 이름난 거장의 작품으로 전해지며, 감정 결과 그 전승이 사실일 가능성이 높다.', 'The {name} is traditionally attributed to a renowned master, and appraisal finds the tradition very likely true.'],
      ['{name}은(는) 여러 종족이 함께 감상할 수 있도록 설계된 드문 작품이다. 감각 기관이 다른 관람객 모두에게 같은 감동을 준다.', 'The {name} is a rare work designed to be appreciated across species. It moves visitors of very different senses alike.'],
      ['{name} 앞에서 기사단 감정관 셋이 같은 시각에 말을 잃었다. 감정서에 감상을 적는 것은 관례가 아니나, 이번에는 적어 둔다.', 'Before the {name}, three of the Order\'s appraisers fell silent at the same moment. Impressions are not customary in a certificate; this time we record them.'],
    ],
    exceptional: [
      ['{name}은(는) 은하 미술사 전체에서 손꼽히는 걸작이다. {nation}이(가) 이 작품을 소장하고 있다는 사실이 그 나라의 문화적 위상을 말해 준다.', 'The {name} ranks among the masterpieces of all galactic art. That {nation} holds it speaks to that nation\'s cultural standing.'],
      ['{name}은(는) 어떤 양식 계보에도 속하지 않는다. 기원이 밝혀진다면 미술사의 한 장을 새로 써야 할 것이다.', 'The {name} belongs to no known stylistic lineage. Were its origin found, a chapter of art history would need rewriting.'],
      ['{name}을(를) 감정하는 동안 기사단 전시관의 관람객 수가 세 배로 늘었다. 이 작품의 가치는 숫자로 다 말할 수 없다.', 'While the {name} was under appraisal, visitors to the Order\'s halls tripled. Its worth cannot be fully told in numbers.'],
    ],
  },
  historical_item: {
    common: [
      ['{name}은(는) 같은 시대 유물로서 흔한 편이나, 출처 기록이 잘 이어져 있어 사료로서 신뢰도가 높다.', 'The {name} is fairly common among relics of its era, but an unbroken provenance makes it a reliable historical source.'],
      ['{name}의 사용 흔적은 당시 사람들의 생활을 생생하게 보여 준다. 화려하지 않지만 역사가에게는 반가운 물건이다.', 'Wear on the {name} vividly shows the daily life of its users. Unremarkable to the eye, but welcome to a historian.'],
      ['{name}은(는) 여러 문헌에 언급되는 종류의 물건이다. 실물과 기록을 맞대어 볼 수 있다는 점에서 가치가 있다.', 'The {name} is of a kind mentioned in many texts. Its value lies in letting record and object be compared.'],
    ],
    rare: [
      ['{name}은(는) 한 사건과 직접 연결된 물건으로, 그 사건의 기록에 없는 세부를 알려 준다.', 'The {name} is tied directly to a particular event and reveals details absent from its records.'],
      ['{name}의 제작 방식은 이미 사라진 기술이다. 기사단은 대여 기간 동안 그 공정을 일부 복원하는 데 성공했다.', 'The {name} was made by a lost technique. During the loan the Order succeeded in partly reconstructing the process.'],
      ['{name}은(는) 사라진 나라가 남긴 몇 안 되는 흔적 가운데 하나다. {nation}이(가) 이를 지켜 온 것에 경의를 표한다.', 'The {name} is among the few traces left by a vanished nation. We pay tribute to {nation} for preserving it.'],
    ],
    epic: [
      ['{name}은(는) 은하사의 전환점에 있었던 물건이다. 실물을 직접 조사한 것은 기사단으로서도 처음이다.', 'The {name} stood at a turning point in galactic history. This is the Order\'s first examination of the object itself.'],
      ['{name}에 남은 기록은 공식 역사와 어긋나는 부분이 있다. 어느 쪽이 옳은지는 후대 연구에 맡긴다.', 'Records borne by the {name} contradict official history in places. Which is right we leave to future scholars.'],
      ['{name}은(는) 여러 세대에 걸쳐 주인이 바뀌었으나 한 번도 훼손되지 않았다. 그 자체로 하나의 역사다.', 'The {name} changed hands across generations yet was never damaged. That is a history in itself.'],
    ],
    exceptional: [
      ['{name}은(는) 문명의 기원에 관한 우리의 이해를 바꿀 수 있는 유물이다. 감정관은 이 문장을 쓰며 손이 떨렸음을 고백한다.', 'The {name} could change our understanding of the origins of civilisation. The appraiser confesses a trembling hand in writing this sentence.'],
      ['{name}은(는) 전설로만 알려져 있던 물건이다. 감정 결과 전설이 실재했음을 기사단의 이름으로 확인한다.', 'The {name} was known only in legend. In the Order\'s name we confirm that the legend was real.'],
      ['{name}에 비할 만한 유물은 몰락 제국의 보물고에나 있을 것이다. {nation}이(가) 이를 세상에 내보인 용기에 감사한다.', 'A relic comparable to the {name} would be found only in a Fallen Empire\'s vaults. We thank {nation} for the courage to show it to the galaxy.'],
    ],
  },
};

/** 문자열 → 0 이상 정수(같은 키는 늘 같은 값). */
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** 「은(는)·이(가)·을(를)」을 바로 앞 글자의 받침에 맞춰 고른다(한글이 아니면 그대로 둔다). 공식 문서라 괄호 표기를 남기지 않으려고. */
export function resolveJosa(t: string): string {
  const J: Record<string, [string, string]> = { '은(는)': ['은', '는'], '이(가)': ['이', '가'], '을(를)': ['을', '를'] };
  // 받침 여부: 한글은 글자 그대로, 대문자·숫자는 한국어로 읽은 소리(엘·엠·엔·알 / 영·일·삼·육·칠·팔). 그 밖(소문자 영어 등)은 알 수 없어 괄호를 남긴다.
  const fin = (ch: string): boolean | null => {
    const c = ch.charCodeAt(0) - 0xac00; if (c >= 0 && c <= 11171) return c % 28 !== 0;
    if (/[A-Z]/.test(ch)) return 'LMNR'.includes(ch);
    if (/[0-9]/.test(ch)) return '013678'.includes(ch);
    return null;
  };
  return t.replace(/([^\s'"’”」』)\]])(['"’”」』)\]]*)(은\(는\)|이\(가\)|을\(를\))/g, (m, ch: string, q: string, j: string) => {
    const f = fin(ch); return f === null ? m : ch + q + J[j][f ? 0 : 1];
  });
}
const fill = (t: string, v: Record<string, string>) => resolveJosa(t.replace(/\{(name|nation|years)\}/g, (_, k: string) => v[k] ?? ''));
const pk = (p: Pair) => L(p[0], p[1]);

export interface AppraisalText { name: string; cls: string; grade: CollectibleGrade; gradeName: string; age: string; verdict: string; opinion: string }

/** 대보관소 표본 감정서 글. 모르는 키면 null. */
export function specimenAppraisal(key: string, nation: string, years = 1): AppraisalText | null {
  const r = SPEC_BY_KEY.get(key); if (!r) return null;
  const [, cat, rarity, ko, en] = r, h = hash(key), cell = OP[cat][rarity], name = L(ko, en);
  return { name, cls: pk(SPEC_CAT_NAME[cat]), grade: specimenGrade(rarity), gradeName: pk(SPEC_RARITY_NAME[rarity]), age: pk(AGE[cat][h % AGE[cat].length]), verdict: pk(VERDICT), opinion: fill(pk(cell[h % cell.length]), { name, nation, years: String(years) }) };
}
/** 상인 수집품 감정서 글(목록의 물건별 감정문). */
export function collectibleAppraisal(c: Collectible | string): AppraisalText | null {
  const it = typeof c === 'string' ? COLLECTIBLES.find((x) => x.id === c) : c; if (!it) return null;
  return { name: pk(it.n), cls: pk(COLLECTIBLE_CLASS[it.c]), grade: it.g, gradeName: pk(COLLECTIBLE_GRADE[it.g]), age: pk(['상회 기록에 따름', 'Per the trading house\'s records']), verdict: pk(VERDICT), opinion: pk(it.a) };
}
/** 시험용: 모든 틀 묶음. */
export const _appraisalTemplates = { OP, AGE };
