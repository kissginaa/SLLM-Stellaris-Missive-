// 국가 문서함(알파 11, 2026-10-25). 순수 규칙: 문서 기록·번호·화면용 글(한/영). 앱: src/features/collectibles-app.ts, 화면: ui/state-docs.js·ui/office-docs.js.
// 사용자 결정: 「진짜 감정서·보증서·국가 공인 문서」처럼 보일 것(시안 승인 2026-10-25), LLM 을 부르지 않음 — 글은 목록·틀 문장(collectibles-data.ts·appraisal-text.ts)에서.
// 문서에는 열쇠(물건 번호 등)만 저장하고 글은 열 때 만든다 → 화면 언어·언어 팩을 바꾸면 문서 글도 바뀐다.
import { L } from './i18n-pick';
import { COLLECTIBLES, COLLECTIBLE_CLASS, COLLECTIBLE_GRADE, type CollectibleGrade, type CollectibleMerchant } from './collectibles-data';
import { collectibleAppraisal, specimenAppraisal } from './appraisal-text';
import { pledgeClauses } from './gov-pledges';
const CRISIS_DOC_NAME: Record<string, [string, string]> = { prethoryn: ['프레소린 스컬지', 'Prethoryn Scourge'], unbidden: ['언비든', 'The Unbidden'], contingency: ['컨틴전시', 'The Contingency'], cetana: ['세타나', 'Cetana'], khan: ['그레이트 칸', 'The Great Khan'], wih: ['하늘의 전쟁', 'The War in Heaven'] };
const PLEDGE_FIELD: Record<string, [string, string]> = { housing: ['주거', 'Housing'], amenities: ['편의 시설', 'Amenities'], order: ['치안·안정', 'Order and stability'], development: ['개발 투자', 'Development'] };

export type DocKind = 'warranty' | 'appraisal' | 'pledge' | 'contract' | 'crisis'; // crisis: 은하 위기 극복 기록(알파 11)
export type DocStatus = 'active' | 'kept' | 'broken' | 'record'; // record: 자료로 판정할 수 없어 기록만(총독 약속)
export interface StateDoc {
  id: string; kind: DocKind; no: string; date: string;
  /** warranty·appraisal: 물건 번호(수집품 id 또는 대보관소 표본 키) */ ref?: string; refKind?: 'col' | 'spec';
  /** warranty: 거래가·구매자(그때의 나라 이름) */ price?: number; buyer?: string;
  /** appraisal: 소장국 이름·대여 기간(년) */ nation?: string; years?: number;
  /** pledge(총독 약속): ref = 분야(housing·amenities·order·development), planet·약속한 이(by, 통치자)·약속받은 이(to, 총독)·기한·상태. 조항은 열 때 틀 문장으로. 옛 title·clauses 도 읽는다 */ title?: string; clauses?: string[]; by?: string; to?: string; due?: string; status?: DocStatus; planet?: string; closedOn?: string;
  /** crisis: 공동 대응 협약으로 함께 싸운 제국 이름(알파 11) */ allies?: string[];
}
export interface DocBook { seq: Record<string, number>; docs: StateDoc[] }
export const emptyBook = (): DocBook => ({ seq: {}, docs: [] });
export const DOC_MAX = 500;
const PREFIX: Record<CollectibleMerchant | 'curator' | 'gov' | 'artist' | 'crisis', string> = { xura: 'XUR', riggan: 'RIG', muutagan: 'MUU', curator: 'CUR', gov: 'GOV', artist: 'ART', crisis: 'CRI' };

/** 문서 번호: SLLM-XUR-2231-0047 (발행처·해마다 0001 부터). */
export function nextDocNo(b: DocBook, issuer: keyof typeof PREFIX, date: string): string {
  const y = /^(\d{1,5})\./.exec(date)?.[1] ?? '0000', k = `${PREFIX[issuer]}-${y}`;
  const n = (b.seq[k] = (b.seq[k] ?? 0) + 1);
  return `SLLM-${k}-${String(n).padStart(4, '0')}`;
}
export function addDoc(b: DocBook, d: StateDoc): StateDoc { b.docs = [...b.docs.filter((x) => x.id !== d.id), d].slice(-DOC_MAX); return d; }

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\r\n\u0000-\u001f]/g, ' ').trim().slice(0, n) : undefined);
/** 저장 파일에서 읽은 것 다듬기(모르는 칸·잘못된 값은 버린다). */
export function sanitizeBook(v: unknown): DocBook {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, b = emptyBook();
  if (o.seq && typeof o.seq === 'object') for (const [k, n] of Object.entries(o.seq as Record<string, unknown>)) if (/^[A-Z]{3}-\d{1,5}$/.test(k) && Number.isSafeInteger(n) && (n as number) > 0) b.seq[k] = n as number;
  if (Array.isArray(o.docs)) for (const x of o.docs.slice(-DOC_MAX)) {
    if (!x || typeof x !== 'object') continue; const d = x as Record<string, unknown>;
    const id = str(d.id, 80), no = str(d.no, 40), date = str(d.date, 12), kind = d.kind;
    if (!id || !no || !date || (kind !== 'warranty' && kind !== 'appraisal' && kind !== 'pledge' && kind !== 'contract' && kind !== 'crisis')) continue;
    const doc: StateDoc = { id, kind, no, date };
    const ref = str(d.ref, 80); if (ref && /^[a-z0-9_]+$/.test(ref)) doc.ref = ref;
    if (d.refKind === 'col' || d.refKind === 'spec') doc.refKind = d.refKind;
    if (Number.isSafeInteger(d.price) && (d.price as number) >= 0) doc.price = d.price as number;
    if (Number.isSafeInteger(d.years) && (d.years as number) > 0 && (d.years as number) < 100) doc.years = d.years as number;
    for (const k of ['buyer', 'nation', 'title', 'by', 'to', 'planet'] as const) { const s = str(d[k], 120); if (s) doc[k] = s; }
    const closed = str(d.closedOn, 12); if (closed) doc.closedOn = closed;
    const due = str(d.due, 12); if (due) doc.due = due;
    if (d.status === 'active' || d.status === 'kept' || d.status === 'broken' || d.status === 'record') doc.status = d.status;
    if (Array.isArray(d.allies)) { const al = d.allies.map((c) => str(c, 100)).filter((c): c is string => !!c).slice(0, 12); if (al.length) doc.allies = al; }
    if (Array.isArray(d.clauses)) doc.clauses = d.clauses.map((c) => str(c, 300)).filter((c): c is string => !!c).slice(0, 12);
    b.docs.push(doc);
  }
  return b;
}

// ---- 화면용 글 ----
export type DocTheme = 'curator' | CollectibleMerchant | 'state' | 'artist';
export interface DocView {
  id: string; kind: DocKind; theme: DocTheme; no: string; date: string;
  org: string; title: string; sub: string; ref2?: string;
  fields: Array<{ k: string; v: string; cls?: 'grade' | 'price' | 'verdict'; grade?: CollectibleGrade }>;
  bodyHead: string; body: string; fine?: string;
  signature: string; signer: string; signerRole: string; issued: string;
  seal: { ring: string; center: [string, string] };
  stamp?: { text: string; sub?: string; tone: 'green' | 'red' | 'grey' };
  img?: string;
}
const MERCHANT: Record<CollectibleMerchant, () => { org: string; signature: string; signer: string; role: string; ring: string; center: [string, string]; fine: string }> = {
  xura: () => ({ org: L('XuraCorp · 은하 종합 상회 · 수집품 사업부', 'XuraCorp · Galactic Trading House · Collectibles Division'), signature: 'K. Ombrecht', signer: L('K. 옴브레흐트', 'K. Ombrecht'), role: L('수집품 사업부 책임 감정역 · XuraCorp', 'Chief Appraiser, Collectibles Division · XuraCorp'), ring: 'XURACORP ✦ GENUINE ARTICLE ✦', center: [L('정품', 'GENU-'), L('보증', 'INE')],
    fine: L('본 보증서는 XuraCorp 표준 거래 약관 제14조(수집품)에 따라 발행되며, 물품의 진정성에 한하여 효력을 가집니다. 보증은 물품의 시장 가치, 향후 시세, 소장국의 정치적 안정을 포함하지 않습니다. 환불은 회사 방침상 불가합니다. 물품의 훼손·분실·압류·몰락 제국에 의한 몰수 등은 보증 범위에 포함되지 않습니다. 당사는 고객이 물품으로 무엇을 하시든 신경 쓰지 않는 것을 사업 원칙으로 삼습니다. XuraCorp™ 및 육각 문장은 XuraCorp 의 등록 상표입니다.',
      'This certificate is issued under Article 14 (Collectibles) of the XuraCorp Standard Terms of Trade and is valid solely as to the authenticity of the article. The warranty does not cover market value, future prices, or the political stability of the holding nation. No refunds, per company policy. Damage, loss, seizure, or confiscation by a Fallen Empire is not covered. The Company makes it its business not to care what customers do with their purchases. XuraCorp™ and the hexagon crest are registered trademarks of XuraCorp.') }),
  riggan: () => ({ org: L('Riggan 상업 거래소 · 천 년 자유 무역 정거장', 'Riggan Commerce Exchange · A Thousand Years of Free Trade'), signature: 'R. C. E.', signer: L('거래소 공증인 (성명 비공개)', 'Exchange Notary (name withheld)'), role: L('Riggan 상업 거래소', 'Riggan Commerce Exchange'), ring: 'RIGGAN COMMERCE EXCHANGE ✦ ANONYMITY ✦', center: [L('진품', 'AUTH-'), L('공증', 'ENTIC')],
    fine: L('본 증서는 물품의 진정성만을 보증합니다. 위탁자와 이전 소유자의 신원은 정거장 운영 규약 제1조 「고객은 익명이다」에 따라 영구히 공개되지 않으며, 본 증서의 소지자 역시 같은 보호를 받습니다. 본 거래소는 노예를 거래하지 않습니다. 예외는 없습니다. 천 년째 영업 중 — 그것이 저희의 신용입니다.',
      'This certificate warrants the authenticity of the article only. Under Article 1 of the station covenant, “All clients remain anonymous,” the identities of the consignor and former owners will never be disclosed, and the bearer of this certificate enjoys the same protection. This Exchange does not deal in slaves. No exceptions. A thousand years in business: that is our credibility.') }),
  muutagan: () => ({ org: L('Muutagan 상인 길드 · 옛 Muutagan 제국의 후예', 'Muutagan Merchant Guild · Heirs of the Muutagan Empire'), signature: 'Sar-Mudak', signer: L('사르-무다크', 'Sar-Mudak'), role: L('의전관 · Muutagan 상인 길드', 'Master of Protocol · Muutagan Merchant Guild'), ring: 'MUUTAGAN MERCHANT GUILD ✦ FULL PRICE ✦', center: [L('길드', 'GUILD'), L('인증', 'SEAL')],
    fine: L('본 증서는 Muutagan 상인 길드의 이름으로 물품의 진정성과 정가 거래를 증명합니다. 길드는 그 단어(할인)를 제공하지 않으며, 이 문장은 길드 의전 규칙에 따라 정중하게 인쇄되었습니다. 옛 제국의 법도에 따라 이 증서는 물품과 함께 대대로 전해지기를 바랍니다. 부적절한 농담이 있었다면 용서를 구합니다.',
      'In the name of the Muutagan Merchant Guild, this certificate attests to the authenticity of the article and to its sale at full price. The Guild does not offer that word (discount); this sentence is printed courteously, per Guild protocol. By the custom of the old Empire, may this certificate pass down the generations with the article. Should any jest herein be improper, we beg your forgiveness.') }),
};
const GRADE_DOT: Record<CollectibleGrade, string> = { 1: '·', 2: '··', 3: '···' };
const fmt = (n: number) => n.toLocaleString('en-US');

/** 문서 → 화면용 글. 모르는 물건이면 null. emblem·img 는 앱이 덧붙인다. */
export function renderDoc(d: StateDoc): DocView | null {
  if (d.kind === 'warranty') {
    const c = COLLECTIBLES.find((x) => x.id === d.ref); if (!c) return null; const m = MERCHANT[c.m]();
    return { id: d.id, kind: d.kind, theme: c.m, no: d.no, date: d.date, org: m.org, title: L('정 품 보 증 서', 'CERTIFICATE OF AUTHENTICITY'), sub: 'CERTIFICATE OF GENUINE ARTICLE', ref2: L(`상품 번호 ${c.id.toUpperCase()}`, `Article No. ${c.id.toUpperCase()}`),
      fields: [{ k: L('상품명', 'Article'), v: L(c.n[0], c.n[1]) }, { k: L('분류', 'Class'), v: L(COLLECTIBLE_CLASS[c.c][0], COLLECTIBLE_CLASS[c.c][1]) }, { k: L('등급', 'Grade'), v: L(COLLECTIBLE_GRADE[c.g][0], COLLECTIBLE_GRADE[c.g][1]) + ' ' + GRADE_DOT[c.g], cls: 'grade', grade: c.g },
        { k: L('원산지', 'Provenance'), v: L(c.o[0], c.o[1]) }, { k: L('거래가', 'Price'), v: L(`${fmt(d.price ?? c.price)} 에너지 크레딧`, `${fmt(d.price ?? c.price)} Energy Credits`), cls: 'price' }, { k: L('구매자', 'Purchaser'), v: d.buyer || L('귀국 정부', 'Your government') }],
      bodyHead: L('상 품 설 명', 'DESCRIPTION'), body: L(c.d[0], c.d[1]), fine: m.fine,
      signature: m.signature, signer: m.signer, signerRole: m.role, issued: L(`${d.date} 발행`, `Issued ${d.date}`), seal: { ring: m.ring, center: m.center } };
  }
  if (d.kind === 'appraisal') {
    const a = d.refKind === 'spec' ? specimenAppraisal(d.ref || '', d.nation || '', d.years || 1) : collectibleAppraisal(d.ref || ''); if (!a) return null;
    return { id: d.id, kind: d.kind, theme: 'curator', no: d.no, date: d.date, org: L('큐레이터 기사단 · 은하 학술 감정원', 'THE CURATOR ORDER · GALACTIC INSTITUTE OF APPRAISAL'), title: L('감 정 서', 'APPRAISAL'), sub: 'CERTIFICATE OF APPRAISAL',
      fields: [{ k: L('물건 이름', 'Item'), v: a.name }, { k: L('분류', 'Classification'), v: a.cls }, { k: L('추정 연대', 'Estimated age'), v: a.age }, { k: L('등급', 'Grade'), v: a.gradeName, cls: 'grade', grade: a.grade },
        { k: L('소장처', 'Holder'), v: d.nation || L('귀국', 'Your nation') }, { k: L('진위 판정', 'Verdict'), v: a.verdict, cls: 'verdict' }],
      bodyHead: L('감 정 의 견', 'OPINION OF THE APPRAISER'), body: a.opinion,
      signature: 'Ovran Teth-Vaal', signer: L('오브란 테스-발', 'Ovran Teth-Vaal'), signerRole: L('수석 감정관 · 큐레이터 기사단', 'Chief Appraiser · The Curator Order'), issued: L(`${d.date} 발행`, `Issued ${d.date}`), seal: { ring: 'CURATOR ORDER ✦ SEAL OF AUTHENTICITY ✦', center: [L('감정', 'VERI-'), L('필', 'FIED')] } };
  }
  if (d.kind === 'contract') { // 예술가 극단 순회 공연 계약서(알파 11). 틀 문장만.
    return { id: d.id, kind: d.kind, theme: 'artist', no: d.no, date: d.date, org: L('예술가 극단 · 은하 순회 예술단', 'THE ARTISAN TROUPE · GALACTIC TOURING COMPANY'), title: L('순 회 공 연 계 약 서', 'TOURING CONTRACT'), sub: 'CONTRACT OF PERFORMANCE',
      fields: [{ k: L('공연 단체', 'Company'), v: L('예술가 극단', 'The Artisan Troupe') }, { k: L('의뢰국', 'Patron nation'), v: d.nation || L('귀국', 'Your nation') }, { k: L('공연료', 'Fee'), v: L(`${fmt(d.price ?? 0)} 에너지 크레딧`, `${fmt(d.price ?? 0)} Energy Credits`), cls: 'price' },
        { k: L('공연 기간', 'Season'), v: L(`${d.date} ~ ${d.due ?? ''} (900일)`, `${d.date} – ${d.due ?? ''} (900 days)`) }, { k: L('기대 효과', 'Expected effect'), v: L('제국 전역 행복도 +4% · 인구 증가 +2.5%', 'Empire-wide happiness +4% · population growth +2.5%') }],
      bodyHead: L('계 약 조 항', 'TERMS'), body: L('제1조 극단은 의뢰국의 여러 행성을 돌며 공연한다. 「세계의 축제」만큼 화려하지는 않으나, 마음은 같다.\n제2조 의뢰국은 공연료를 미리 낸다. 예술은 값을 매길 수 없으나, 극단의 식비는 매길 수 있다.\n제3조 공연 기간 중 「세계의 축제」를 새로 열 수 없다. 극단원은 한 번에 한 무대에만 선다.\n창의적인 하루 되시길!', 'Art. 1 The Troupe shall tour and perform across the patron nation\'s worlds: less grand than the Festival of Worlds, but with the same heart.\nArt. 2 The patron pays the fee in advance. Art is priceless; the Troupe\'s meals are not.\nArt. 3 No Festival of Worlds may begin during the season; our artists stand on one stage at a time.\nHave a creative day!'),
      signature: 'Maestra Velloria', signer: L('마에스트라 벨로리아', 'Maestra Velloria'), signerRole: L('단장 · 예술가 극단', 'Headmaster · The Artisan Troupe'), issued: L(`${d.date} 체결`, `Signed ${d.date}`), seal: { ring: 'ARTISAN TROUPE ✦ A CREATIVE DAY ✦', center: [L('공연', 'ENCO-'), L('계약', 'RE!')] } };
  }
  if (d.kind === 'crisis') { // 은하 위기 극복 기록(알파 11): ref = 위기 열쇠, date = 처음 확인, closedOn = 사라진 날. 틀 문장만, 게임 효과 없음.
    const nm = CRISIS_DOC_NAME[d.ref ?? ''] ?? [d.ref || '?', d.ref || '?'], name = L(nm[0], nm[1]), nation = d.nation || L('우리 제국', 'our empire');
    const yrs = (() => { const a = /^(\d+)\./.exec(d.date)?.[1], b = /^(\d+)\./.exec(d.closedOn ?? '')?.[1]; return a && b ? Math.max(0, Number(b) - Number(a)) : null; })();
    return { id: d.id, kind: d.kind, theme: 'state', no: d.no, date: d.closedOn || d.date, org: d.nation || '', title: L('국가 공인 문서', 'OFFICIAL STATE RECORD'), sub: L('은하 위기 극복 기록 · RECORD OF A GALACTIC CRISIS', 'RECORD OF A GALACTIC CRISIS OVERCOME'),
      fields: [{ k: L('은하 위기', 'Galactic crisis'), v: name }, { k: L('처음 확인', 'First confirmed'), v: d.date }, { k: L('은하에서 사라짐', 'Vanished from the galaxy'), v: d.closedOn || '' }, ...(yrs !== null ? [{ k: L('지속 기간', 'Duration'), v: L(`약 ${yrs}년`, `About ${yrs} year${yrs === 1 ? '' : 's'}`) }] : []), ...(d.allies?.length ? [{ k: L('함께 싸운 제국', 'Fought alongside'), v: d.allies.join(', ') }] : []), { k: L('기록 보관', 'Kept by'), v: nation }],
      bodyHead: L('기 록', 'RECORD'), body: [L(`은하 위기 「${name}」는 ${d.date}에 처음 확인되어 ${d.closedOn || ''}에 은하에서 사라졌다.`, `The galactic crisis "${name}" was first confirmed on ${d.date} and vanished from the galaxy on ${d.closedOn || ''}.`), L('그동안 은하의 모든 나라가 비상 체제에 들어갔고, 신문과 방송은 특별 편성으로 그 시대를 전했다.', 'Throughout, every nation of the galaxy lived on emergency footing, and the press and broadcasters covered the era in special editions.'), ...(d.allies?.length ? [L(`그 시대에 ${d.allies.join(', ')}이(가) 공동 대응 협약을 맺고 끝까지 함께 싸웠다.`, `In that era, ${d.allies.join(', ')} stood with us under a joint crisis response pact to the end.`)] : []), L(`이 문서는 그 시대를 견뎌 낸 ${nation}의 기록으로 국가 문서함에 보관한다.`, `This document is kept in the state archive as the record of ${nation}, which endured that era.`)].join('\n'),
      signature: '', signer: L('국가 기록원', 'State Records Office'), signerRole: nation, issued: L(`${d.closedOn || d.date} 작성`, `Drawn up ${d.closedOn || d.date}`), seal: { ring: '', center: [L('국가', 'STATE'), L('기록', 'RECORD')] },
      stamp: { text: L('극 복', 'OVERCOME'), tone: 'green' } };
  }
  // pledge(국가 공인 문서) — 총독회의 약속(알파 11). 분야 열쇠로 조항을 틀 문장으로 만든다(gov-pledges.ts).
  const st = d.status ?? 'active', fieldName = PLEDGE_FIELD[d.ref ?? ''];
  const clauses = d.ref && fieldName ? pledgeClauses(d.ref, d.planet || '', d.to || '') : (d.clauses || []);
  return { id: d.id, kind: d.kind, theme: 'state', no: d.no, date: d.date, org: d.nation || '', title: L('국가 공인 문서', 'OFFICIAL STATE RECORD'), sub: L('총독 회의 약속 기록 · OFFICIAL RECORD OF COMMITMENT', 'COMMITMENT MADE AT THE GOVERNORS\' COUNCIL'),
    fields: [{ k: L('약속한 이', 'Pledged by'), v: d.by || L('통치자', 'The ruler') }, { k: L('약속받은 이', 'Pledged to'), v: d.to || '' }, ...(d.planet ? [{ k: L('대상 행성', 'Planet'), v: d.planet }] : []), ...(fieldName ? [{ k: L('분야', 'Field'), v: L(fieldName[0], fieldName[1]) }] : []),
      { k: L('이행 기한', 'Deadline'), v: st === 'record' ? L('없음 (기록만)', 'None (record only)') : d.due || L('기한 없음(2년 안 진전 필요)', 'No deadline (progress due within 2 years)') },
      ...(d.closedOn && (st === 'kept' || st === 'broken') ? [{ k: st === 'kept' ? L('이행 확인', 'Fulfilled on') : L('불이행 확정', 'Broken on'), v: d.closedOn, cls: 'verdict' as const }] : [])],
    bodyHead: fieldName ? L('약 속 조 항', 'TERMS OF THE PLEDGE') : d.title || '', body: clauses.map((c, i) => L(`제${i + 1}조 `, `Art. ${i + 1} `) + c).join('\n'),
    signature: d.by || '', signer: d.by || '', signerRole: d.ref ? L(`통치자${d.nation ? ' · ' + d.nation : ''}`, `Ruler${d.nation ? ' · ' + d.nation : ''}`) : '', issued: L(`${d.date} 작성`, `Drawn up ${d.date}`), seal: { ring: '', center: [L('국가', 'STATE'), L('공인', 'SEAL')] },
    stamp: st === 'kept' ? { text: L('이 행', 'FULFILLED'), tone: 'green' } : st === 'broken' ? { text: L('불이행', 'BROKEN'), tone: 'red' } : st === 'record' ? { text: L('기 록', 'RECORD'), tone: 'grey' } : { text: L('진행 중', 'IN FORCE'), tone: 'grey' } };
}
/** 문서함 목록 한 줄. */
export function docSummary(d: StateDoc): { id: string; kind: DocKind; no: string; date: string; title: string; theme: DocTheme } {
  const v = renderDoc(d);
  const name = v?.fields[0]?.v || d.title || d.no;
  const kindName = d.kind === 'warranty' ? L('정품 보증서', 'Certificate of authenticity') : d.kind === 'appraisal' ? L('감정서', 'Appraisal') : d.kind === 'contract' ? L('순회 공연 계약서', 'Touring contract') : d.kind === 'crisis' ? L('은하 위기 극복 기록', 'Galactic crisis record') : L('국가 공인 문서', 'Official state record');
  return { id: d.id, kind: d.kind, no: d.no, date: d.date, title: `${kindName} · ${name}`, theme: v?.theme ?? 'state' };
}
