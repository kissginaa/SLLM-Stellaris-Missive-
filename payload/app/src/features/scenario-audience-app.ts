// 접견실(시나리오 전용, 앱 쪽, 2026-11-06). 규칙: src/scenario-audience.ts · 화면: ui/audience.html(전체 화면 1:1)
// 상대: 시나리오 귀족(귀족 연감의 「접견」) 또는 두 거대 세력의 군주(연감 위 「군주 접견」). 회랑 자리를 맡은 판에서만.
// 한 번의 회담에서 말 수 제한은 없다(2026-11-07 사용자: 「말 제한 없애자」). 귀족은 두 달, 군주는 여섯 달에 한 번 만날 수 있다(2026-11-08).
// 대사마다 LLM 이 「플레이어가 밀사를 청했나 · 누구를 지목했나」를 함께 내고, 결과(허락·거절·고발·모함)는 앱이 수치로 정한다.
// 게임 반응(호감): effect sllm_cr_au_op = { S = a|b M = plot|tip|slander }(시나리오 모드 sllm_cr_trade_effects.txt 옆 sllm_cr_audience_effects.txt)
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { enqueue, sendConsole, link } from '../app/game-link';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { tensionNow, tensionShift } from './tension-app';
import { intelDocSource, intelGiveWeak, intelSway, intelForged, intelUseForged, WEAK_PAIR } from './scenario-intel-app';
import { chronNoteWorld } from './chronicle-app';
import { withNobleSave, setAudienceMarksSource, setAudienceWriter, knownNobles, isCoreHub } from './scenario-nobles-app';
import { domainBrief, rebelLord, revealPlotsOf, inciteRevolt } from './scenario-domains-app';
import { cnobleOf, cnobleLandEn, cnobleTalk, cnobleShake, cnPurgeSpy, cnTie, cnTiesOf, cnTiesFor, cnUnionIds, cnMatch } from './scenario-cnobles-app';
import { personaPeek } from './persona-app';
import { insidersOf } from './scenario-health-app';
import { menuFor, dishScore, DISH_CATS, FORGE, forgeCatch, type WeakKind } from '../scenario-intel';
import { CR_NOBLES, CR_BONDS } from '../scenario-nobles-data';
import { shiftRel, shiftLoyal, pairKey, rulerOf, reveal, bondVisible, NB, INTIMACY_STAGE, TRAIT_NAME, BOND_NAME, BOND_PUBLIC, type NSide, type NobleRow } from '../scenario-nobles';
import { AU, AUX, LOVE, LOVE_NAME, loveOf, spouseOf, wedTo, applyHeart, type AuSave, type AuTarget, type AuOutcome, newAuSave, fixAuSave, targetKey, parseTarget, restLeft, auMessages, parseAuReply, judge, applyOutcomes, introCands } from '../scenario-audience';
import { stageName } from '../tension';

const KEEP = 12;
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_audience.json');
let all: Record<string, AuSave> | null = null;
function books(): Record<string, AuSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixAuSave(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_audience', error: (e as Error).message }); }
  return all;
}
function save(): void { try { const b = books(), keys = Object.keys(b); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete b[k]; const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: b })); fs.renameSync(t, file()); } catch (e) { logDiagnostic('warn', 'scenario_audience.save_failed', { error: (e as Error).message }); } }
const bookOf = (sid: string): AuSave => (books()[sid] ??= newAuSave());
const byId = new Map<number, NobleRow>(CR_NOBLES.map((n) => [n.id, n]));
const nobleName = (n: NobleRow): string => L(n.ko, n.en); // 고유 이름(언어 팩이 바꿀 문구가 아님)
const sideName = (x: NSide): string => scenarioNow()?.names?.[x] || (x === 'a' ? L('은하 얼라이언스', 'Galactic Alliance') : L('인류 제국', 'Human Empire'));
const INTIMACY_TEXT = (): string[] => [L('서약', 'Oathbound'), L('협약', 'Accord'), L('신뢰', 'Trusted'), L('우호', 'Cordial'), L('접촉', 'Contact'), L('냉담', 'Cold'), L('경쟁자', 'Rival'), L('숙적', 'Nemesis')];
const intimacyName = (v: number): string => { const t = INTIMACY_TEXT(); for (let i = 0; i < INTIMACY_STAGE.length; i++) if (v >= INTIMACY_STAGE[i].min) return t[i]; return t[t.length - 1]; };
function mine(): string | null { const s = scenarioNow(), sid = ctx.curSaveId; return s && sid && s.id === 'corridor' && s.seat === 'p' ? sid : null; }

let win: BrowserWindow | null = null, cur: AuTarget | null = null, busy = false;
let curC: number | null = null; // 회랑의 귀족(우리 지도자, 2026-11-08) — 지도자 번호
// ---- 접견 장소(2026-11-08 사용자: 「백화점 상층부 고위식당, 정원, 고위 리무진(비행), 저택」) ----
// 응접실(기본) · 식당(대접: 요리사가 알려 준 음식이면 크게 기뻐함, 남의 눈이 있어 밀사 이야기는 들키기 쉬움) · 정원(속마음 — 숨은 인연을 흘릴 수 있음)
// · 리무진(둘만의 밀폐 공간 — 밀사 이야기가 거의 새지 않음, 상대 운전수를 사 둬야) · 저택(격식, 비쌈 — 집사를 사 뒀으면 서류를 엿봄)
type Venue = 'room' | 'dining' | 'garden' | 'limo' | 'manor';
const VENUES: Venue[] = ['room', 'dining', 'garden', 'limo', 'manor'];
const VENUE_COST: Record<Venue, number> = { room: 0, dining: 100, garden: 0, limo: 0, manor: 500 };
const VENUE_NAME = (): Record<Venue, string> => ({ room: L('응접실', 'Reception room'), dining: L('상층 고급 식당', 'Sky-tier restaurant'), garden: L('정원', 'Garden'), limo: L('비행 리무진', 'Flying limousine'), manor: L('저택', 'Manor') });
const VENUE_EN: Record<Venue, string> = {
  room: '',
  dining: 'The meeting takes place over dinner at an exclusive restaurant atop a station department tower. Other diners are around, so speak with some care in public.',
  garden: 'The meeting is a quiet walk in a domed garden. The setting puts you at ease; you are more candid than usual about your feelings, grievances and the people around you.',
  limo: 'The meeting takes place inside a flying limousine, sealed and private, the partition raised. No one else can hear; you may speak more freely of secret matters.',
  manor: 'The meeting is a formal audience in a noble manor\'s great hall. It is a weighty, ceremonial occasion suited to serious commitments.',
};
let venue: Venue = 'room', gardenTold = false, giftGiven = false, cnIntro = false, dish = '', heartMoved = 0; // dish: 식당에서 고른 음식(차림표 열쇠)
const ready = () => !!(ctx.gameRunning && link.sessionReady);
const parseVenue = (x: unknown): Venue => (VENUES.includes(x as Venue) ? (x as Venue) : 'room');
/** 장소를 고를 수 있나 · 비용을 낸다. 안 되면 오류 문구. cn: 회랑의 귀족(우리 사람)이면 리무진 조건이 없다. */
function venueCheck(sid: string, v: Venue, id: number, cn: boolean): string {
  if (v === 'limo' && !cn && !insidersOf(sid, id)?.driver) return L('리무진 회담은 상대 운전수를 매수해 둬야 마련할 수 있습니다(회랑 정보국).', 'A limousine meeting needs their chauffeur bought first (Intelligence bureau).');
  const cost = VENUE_COST[v];
  if (cost > 0) { if (!ready()) return L('비용(에너지)을 내려면 게임이 켜져 있어야 합니다.', 'The game must be running to pay the cost (energy).'); void enqueue(() => sendConsole(`effect add_resource = { energy = -${cost} }`)).catch((e) => logDiagnostic('warn', 'scenario_audience.pay_failed', { error: (e as Error).message })); }
  return '';
}
/** 회담을 시작할 때 장소의 덤(대접·서류 엿보기)을 기록 줄로. */
function venueOpen(sid: string, sv: AuSave, key: string, v: Venue, n: NobleRow | null, cnLid: number | null): void {
  const today = ctx.gameDate || '', h = (sv.hist[key] ??= []), line = (text: string) => h.push({ who: 'sys', text, d: today });
  if (v === 'dining') {
    if (n) { // 차림표에서 고른 음식(2026-11-08) — 고르지 않았으면 차림표 첫 음식
      const menu = menuFor(n), m = menu.find((x) => x.key === dish) ?? menu[0], sc = dishScore(n, m.key)!; dish = m.key;
      withNobleSave(sid, (ns) => { shiftRel(ns, n.id, 'P', sc.d); });
      const T: Record<typeof sc.kind, [string, string]> = {
        fav: [`${m.ko}을(를) 내자 ${n.ko}의 얼굴이 환해집니다. 가장 즐기는 음식이었습니다(친밀도 +${sc.d}).`, `When ${m.en} arrives, ${n.en}'s face lights up — their favorite dish (warmth +${sc.d}).`],
        kin: [`${m.ko}이(가) ${n.ko}의 입맛에 맞습니다. 만찬이 부드럽게 흘러갑니다(친밀도 +${sc.d}).`, `${m.en} suits ${n.en}'s palate. The dinner goes smoothly (warmth +${sc.d}).`],
        other: [`${n.ko}은(는) ${m.ko}을(를) 예의상 조금 맛봅니다. 낯선 음식인 모양입니다(친밀도 +${sc.d}).`, `${n.en} politely tastes the ${m.en}. It seems unfamiliar to them (warmth +${sc.d}).`],
        hate: [`${m.ko}을(를) 보자 ${n.ko}의 표정이 굳습니다. 싫어하는 음식이었습니다(친밀도 ${sc.d}).`, `At the sight of ${m.en}, ${n.en}'s expression stiffens — a dish they loathe (warmth ${sc.d}).`],
      };
      line(L(...T[sc.kind]));
    } else if (cnLid !== null) { const d = cnobleTalk(sid, cnLid, 1); line(L(`만찬을 베풀었습니다${d ? `(충성 +${d})` : ''}.`, `We hosted a dinner${d ? ` (loyalty +${d})` : ''}.`)); }
  }
  if (v === 'manor' && n && insidersOf(sid, n.id)?.butler) { const pn = revealPlotsOf(sid, n.id); line(pn ? L(`매수한 집사가 서재의 서류를 보여 주었습니다 — 반란 밀약의 약속 ${pn}건이 드러났습니다.`, `Our bought butler showed us the papers in the study — ${pn} pledge(s) of a rebel conspiracy exposed.`) : L('매수한 집사가 서재의 서류를 보여 주었지만, 밀약의 흔적은 없었습니다.', 'Our bought butler showed us the papers in the study, but there was no trace of a conspiracy.')); }
  if (h.length > AU.keepHist) h.splice(0, h.length - AU.keepHist);
}

function openWindow(): void {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); win.webContents.send('auRefresh'); return; }
  // 화면 전체(작업 표시줄까지 덮는다, 2026-11-06 사용자: 「윈도우 작업바까지 전체화면이 안됐다」) — 게임 창이 있는 모니터의 bounds(workArea 아님)
  const base = ctx.gameDip ?? screen.getPrimaryDisplay().bounds;
  const area = screen.getDisplayMatching(base).bounds;
  win = new BrowserWindow({ x: area.x, y: area.y, width: area.width, height: area.height, frame: false, show: false, backgroundColor: '#07090d', alwaysOnTop: true, resizable: false, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), backgroundThrottling: false } });
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  void win.loadFile(path.join(__dirname, '..', '..', 'ui', 'audience.html'));
  win.once('ready-to-show', () => { win?.show(); });
  win.on('closed', () => { win = null; endMeeting(); });
}
function endMeeting(): void { const sid = mine(); if (sid) { const sv = bookOf(sid); sv.now = ''; sv.turns = 0; save(); } cur = null; curC = null; }

function startMeeting(t: AuTarget, v: Venue = 'room', ds = ''): { ok: boolean; error?: string } {
  const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리를 맡은 시나리오 판에서만 쓸 수 있습니다.', 'Only available when playing the Corridor seat in this scenario.') };
  if (t.kind === 'noble' && !byId.has(t.id)) return { ok: false, error: L('알 수 없는 귀족입니다.', 'Unknown noble.') };
  const sv = bookOf(sid), today = ctx.gameDate || '', key = targetKey(t);
  if (t.kind === 'noble') { const gone = withNobleSave(sid, (ns) => !!ns.fate[String(t.id)]) && !rebelLord(sid, t.id); if (gone) return { ok: false, error: L('이미 떠난 귀족입니다.', 'This noble is no longer in office.') }; } // 반란국 군주는 반란 뒤에도 만난다(2026-11-08)
  if (sv.now !== key) {
    const left = restLeft(sv, t, today);
    if (left > 0) return { ok: false, error: L(`약 ${Math.ceil(left / 30)}달 뒤에 다시 만날 수 있습니다.`, `You can meet again in about ${Math.ceil(left / 30)} month(s).`) };
    if (t.kind === 'ruler' && v !== 'room') v = 'room'; // 군주는 늘 궁정에서
    const why = t.kind === 'noble' ? venueCheck(sid, v, t.id, false) : ''; if (why) return { ok: false, error: why };
    sv.now = key; sv.turns = 0; sv.met[key] = today; venue = v; gardenTold = false; giftGiven = false; cnIntro = false; dish = ds; heartMoved = 0;
    if (t.kind === 'noble') venueOpen(sid, sv, key, v, byId.get(t.id) ?? null, null);
    save();
  }
  cur = t; curC = null; openWindow(); return { ok: true };
}

/** 배경(2026-11-06 GPT 그림, WebP 로 줄임 — PNG 가 있으면 그것도): 군주는 그 나라 궁정. 귀족은 그 나라 응접실, 밀사 통로가 열린 뒤로는 밀실. */
function bgFor(t: AuTarget, sid: string): string[] {
  const D = 'assets/scenario/corridor/', side = t.kind === 'ruler' ? t.side : byId.get(t.id)?.side ?? 'a';
  const both = (n: string) => [`${D}${n}.webp`, `${D}${n}.png`];
  const secret = t.kind === 'noble' && !!bookOf(sid).ch[String(t.id)];
  const room = t.kind === 'ruler' ? both(`ruler/ruler_room_${side}`) : []; // 군주 전용 집무실(2026-11-07 GPT 그림)
  const ven = t.kind === 'noble' && venue !== 'room' ? [...both(`venues/venue_${venue}_${secret ? 'night' : 'day'}`), ...both(`venues/venue_${venue}_day`)] : []; // 접견 장소(2026-11-08, 그림이 오면)
  return [...ven, ...room, ...(secret ? both('audience_secret') : []), ...both(`audience_${side}`), ...both('audience_p')];
}
function view(): Record<string, unknown> {
  if (curC !== null) return cnView();
  const sid = mine(); if (!sid || !cur) return { ok: false };
  const sv = bookOf(sid), t = cur, key = targetKey(t);
  const hist = (sv.hist[key] ?? []).map((h) => ({ who: h.who, text: h.text }));
  if (t.kind === 'noble') {
    const n = byId.get(t.id)!;
    const [rel, intro] = withNobleSave(sid, (ns) => [ns.rel[pairKey(n.id, 'P')] ?? 0, introCands(ns, CR_NOBLES, CR_BONDS, knownNobles(sid), n.id).length] as [number, number]);
    const served = venue === 'dining' && dish ? menuFor(n).find((x) => x.key === dish) : undefined; // 식탁에 오른 음식(2026-11-08)
    return { ok: true, kind: 'noble', ...(served ? { dish: { name: L(served.ko, served.en), pic: served.pic } } : {}), venue: venue !== 'room' ? VENUE_NAME()[venue] : '', name: nobleName(n), title: (venue !== 'room' ? VENUE_NAME()[venue] + ' · ' : '') + (rebelLord(sid, n.id) ? L(`${sideName(n.side)}에서 떨어져 나간 반란국의 군주`, `Sovereign of a realm broken away from the ${sideName(n.side)}`) : L(`${sideName(n.side)} 귀족 · 거점 총독`, `${sideName(n.side)} noble · hub governor`)), side: n.side, pic: `assets/scenario/corridor/gov/gov_${n.side.toUpperCase()}-${n.id}.png`, frame: `assets/scenario/corridor/frame_${n.side}.png`, bg: bgFor(t, sid), stage: intimacyName(rel), channel: !!sv.ch[String(n.id)], suspect: !!sv.sus[String(n.id)], ...(loveOf(sv, n.id) ? { love: L(...LOVE_NAME[loveOf(sv, n.id)!.st]) } : {}), docs: docsOf(sid, sv).map(docLabel), intro, hist, busy };
  }
  // 두 통치자(2026-11-07 GPT 초상 — 이름·직함은 시나리오 모드 prescripted 와 같게)
  const RULER: Record<string, { name: string; title: string }> = {
    a: { name: L('엘라나 오시아', 'Elana Ossia'), title: L('은하 얼라이언스 대통령', 'President of the Galactic Alliance') },
    b: { name: L('콘스탄틴 볼크', 'Konstantin Volk'), title: L('인류 제국 총통', 'Supreme Leader of the Human Empire') },
  };
  const rr = RULER[t.side];
  return { ok: true, kind: 'ruler', name: rr ? rr.name : sideName(t.side), title: rr ? rr.title : L('군주', 'Sovereign'), side: t.side, pic: rr ? `assets/scenario/corridor/ruler/ruler_${t.side}_full.png` : '', full: !!rr, frame: `assets/scenario/corridor/frame_${t.side}.png`, bg: bgFor(t, sid), stage: '', channel: false, suspect: false, docs: docsOf(sid, sv).map(docLabel), hist, busy };
}

/** 판정 결과를 화면 줄·알림·연대기·게임 호감으로. */
function outcomeText(o: AuOutcome): string {
  const nm = (id: number) => { const n = byId.get(id); return n ? nobleName(n) : '?'; };
  switch (o.k) {
    case 'envoy_open': return L(`${nm(o.id)}이(가) 밀사 왕래를 받아들였습니다. 비밀 통로가 열렸습니다.`, `${nm(o.id)} has agreed to exchange envoys. A secret channel is open.`);
    case 'envoy_refused': return L(`${nm(o.id)}은(는) 밀사 이야기를 못 들은 것으로 하겠다고 합니다.`, `${nm(o.id)} will pretend they never heard the envoy proposal.`);
    case 'envoy_already': return L(`${nm(o.id)}과(와)는 이미 비밀 통로가 열려 있습니다.`, `A secret channel with ${nm(o.id)} is already open.`);
    case 'reported': return o.by === 'ruler' ? L(`밀사 이야기가 ${sideName(o.side)} 군주의 귀에 직접 들어갔습니다. 우리 공작이 드러났습니다.`, `The envoy proposal went straight to the ${sideName(o.side)} sovereign. Our scheme is exposed.`)
      : L(`${nm(o.by)}이(가) 회담 내용을 군주에게 보고했습니다. 우리 공작이 ${sideName(o.side)}에 드러났습니다.`, `${nm(o.by)} reported the meeting to their sovereign. Our scheme is exposed to ${sideName(o.side)}.`);
    case 'accuse_true': return L(`${nm(o.id)}의 내통이 사실로 드러났습니다. 비밀 통로가 끊기고, 그는 군주의 의심을 받습니다.`, `${nm(o.id)}'s disloyalty proved true. Any secret channel is cut and they now live under their sovereign's suspicion.`);
    case 'accuse_false': return o.caught ? L(`${nm(o.id)}에 대한 고발은 누명으로 드러났습니다. 모함한 우리의 신뢰가 떨어졌습니다.`, `The accusation against ${nm(o.id)} was exposed as slander. Our credibility has suffered.`)
      : L(`증거는 없지만 ${nm(o.id)}에 대한 의심이 심어졌습니다.`, `There is no proof, but suspicion has been planted against ${nm(o.id)}.`);
    case 'intro': return o.via === 'faction'
      ? L(`${nm(o.by)}이(가) 자기 세력의 ${nm(o.id)}을(를) 소개했습니다. 귀족 연감에 얼굴이 드러났습니다.`, `${nm(o.by)} introduced ${nm(o.id)}, a member of their faction. Their face now appears in the peerage.`)
      : L(`${nm(o.by)}이(가) 가까운 사이인 ${nm(o.id)}을(를) 소개했습니다. 귀족 연감에 얼굴이 드러났습니다.`, `${nm(o.by)} introduced their close acquaintance ${nm(o.id)}. Their face now appears in the peerage.`);
    case 'intro_refused': return L(`${nm(o.by)}은(는) 아직 누구를 소개할 만큼 우리를 믿지 않습니다.`, `${nm(o.by)} does not yet trust us enough to make introductions.`);
    case 'intro_none': return L(`${nm(o.by)}에게는 우리가 아직 모르는 사람 중 소개해 줄 만한 이가 없습니다.`, `${nm(o.by)} knows no one we have not already met.`);
    case 'rumor': return L(`${nm(o.id)}에 대한 말은 소문으로만 떠돌 것입니다.`, `What was said about ${nm(o.id)} will only circulate as a rumor.`);
    // 숨은 대화 카드(2026-11-08)
    case 'info_loyal': return L(`${nm(o.by)}의 귀띔으로 ${nm(o.id)}의 속마음(충성도)을 알게 되었습니다.`, `Thanks to ${nm(o.by)}, we now know where ${nm(o.id)}'s loyalty truly lies.`);
    case 'info_tie': return L(`${nm(o.by)}이(가) ${nm(o.a)}과(와) ${nm(o.b)} 사이의 숨은 인연을 흘렸습니다.`, `${nm(o.by)} let slip a hidden tie between ${nm(o.a)} and ${nm(o.b)}.`);
    case 'info_none': return L(`${nm(o.by)}도 ${nm(o.id)}에 대해 우리가 모르는 이야기는 알지 못합니다.`, `${nm(o.by)} knows nothing about ${nm(o.id)} that we do not.`);
    case 'info_refused': return L(`${nm(o.by)}은(는) 동료 귀족 이야기를 외국인에게 하지 않으려 합니다.`, `${nm(o.by)} will not discuss fellow nobles with a foreigner.`);
    case 'gift_ok': return L(`선물(에너지 ${AUX.gift})을 건넸습니다. ${nm(o.id)}이(가) 우리를 한결 가깝게 여깁니다.`, `We presented a gift (${AUX.gift} energy). ${nm(o.id)} warms to us.`);
    case 'gift_refused': return L(`${nm(o.id)}은(는) 선물을 뇌물로 여겨 물리쳤습니다. 오히려 언짢아합니다.`, `${nm(o.id)} took the gift for a bribe and refused it, offended.`);
    case 'defect_yes': return L(`${nm(o.id)}이(가) 회랑으로 넘어오기로 했습니다. 때가 오면 영지를 들고 귀순합니다.`, `${nm(o.id)} has agreed to come over to the Corridor. When the time comes they will defect with their domain.`);
    case 'defect_no': return L(`${nm(o.id)}은(는) 아직 자기 나라를 버릴 생각이 없습니다.`, `${nm(o.id)} is not ready to abandon their realm.`);
    case 'revolt_yes': return L(`${nm(o.id)}이(가) 마침내 칼을 뽑기로 했습니다. 반란이 시작됩니다.`, `${nm(o.id)} has resolved to draw the sword. The rebellion begins.`);
    case 'revolt_no': return L(`${nm(o.id)}은(는) 아직 반란을 일으킬 때가 아니라고 봅니다.`, `${nm(o.id)} does not think the time for revolt has come.`);
    case 'pact_ok': return L(`${nm(o.id)}과(와) 사사로운 서약을 맺었습니다. 이제 우리 이야기를 군주에게 고하지 않습니다.`, `We swore a private pledge with ${nm(o.id)}. They will no longer report our talks to their sovereign.`);
    case 'pact_no': return L(`${nm(o.id)}은(는) 아직 서약을 맺을 만큼 우리를 믿지 않습니다.`, `${nm(o.id)} does not trust us enough for a pledge yet.`);
    case 'date_ok': return o.first ? L(`${nm(o.id)}이(가) 데이트 신청을 받아들였습니다. 두 사람 사이에 설렘이 시작됩니다.`, `${nm(o.id)} accepted your invitation. Something has begun between you.`) : L(`${nm(o.id)}과(와) 또 한 번 함께 시간을 보냈습니다. 마음이 한결 가까워졌습니다.`, `Another evening with ${nm(o.id)}. You have grown closer.`);
    case 'date_no': return o.wed ? L(`${nm(o.id)}은(는) 배우자가 있는 몸이라며 단호히 거절했습니다. 오히려 실망한 눈치입니다.`, `${nm(o.id)} refused firmly — they are bound to a spouse — and seems disappointed in you.`) : L(`${nm(o.id)}은(는) 정중히 데이트를 사양했습니다. 아직 그럴 사이가 아닙니다.`, `${nm(o.id)} politely declined. You are not that close yet.`);
    case 'love_ok': return L(`${nm(o.id)}이(가) 마음을 받아들였습니다. 이제 둘은 비밀 연인입니다. 연인은 우리 이야기를 군주에게 고하지 않습니다.`, `${nm(o.id)} returned your feelings. You are now secret lovers — and a lover keeps your secrets from their sovereign.`);
    case 'love_no': return L(`${nm(o.id)}은(는) 아직 마음을 열 때가 아니라고 합니다.`, `${nm(o.id)} says it is too soon to open their heart.`);
    case 'love_public': return L(`${nm(o.id)}과(와)의 관계를 공개했습니다. 궁정이 술렁이고, ${nm(o.id)}은(는) 자기 군주와 멀어졌습니다.${o.spouse !== undefined ? ` 배우자 ${nm(o.spouse)}이(가) 등을 돌렸습니다.` : ''}`, `You made your relationship with ${nm(o.id)} public. The court is abuzz, and ${nm(o.id)} has grown distant from their sovereign.${o.spouse !== undefined ? ` Their spouse ${nm(o.spouse)} has turned against them.` : ''}`);
    case 'public_no': return L(`${nm(o.id)}은(는) 아직 세상에 알릴 용기가 없다고 합니다.`, `${nm(o.id)} is not yet ready to face the world with it.`);
    case 'wed_ok': return L(`${nm(o.id)}이(가) 청혼을 받아들였습니다. 회랑의 통치자와 혼약을 맺었습니다.`, `${nm(o.id)} accepted your proposal. They are now betrothed to the ruler of the Corridor.`);
    case 'wed_no': return L(`${nm(o.id)}은(는) 지금은 청혼을 받아들일 수 없다고 합니다.`, `${nm(o.id)} cannot accept a proposal now.`);
    case 'love_already': return L(`${nm(o.id)}과(와)는 이미 ${LOVE_NAME[o.st][0]} 사이입니다.`, `You and ${nm(o.id)} are already ${LOVE_NAME[o.st][1].toLowerCase()}.`);
    case 'love_rumor': return L(`식당에서 ${nm(o.id)}과(와) 함께 있는 모습이 남의 눈에 띄었습니다. 소문이 그 군주의 귀에 들어갑니다.`, `You were seen dining with ${nm(o.id)}. The rumor will reach their sovereign.`);
    case 'pact_already': return L(`${nm(o.id)}과(와)는 이미 서약을 맺은 사이입니다.`, `We are already pledged to ${nm(o.id)}.`);
  }
}
function gameReact(o: AuOutcome): void {
  const op = (s: NSide, m: 'plot' | 'tip' | 'slander') => { void enqueue(() => sendConsole(`effect sllm_cr_au_op = { S = ${s} M = ${m} }`)).catch((e) => logDiagnostic('warn', 'scenario_audience.op_failed', { error: (e as Error).message })); };
  if (o.k === 'reported') op(o.side, 'plot');
  else if (o.k === 'accuse_true' && o.to === 'ruler') { const n = byId.get(o.id); if (n) op(n.side, 'tip'); }
  else if (o.k === 'accuse_false' && o.caught) { const n = byId.get(o.id); if (n) op(n.side, 'slander'); }
}

// ---- 기밀 문서 건네기(2026-11-08 사용자: 「첩보로 얻은 정보는 카드로 남고, 그걸 귀족·군주에게 제출 — 전쟁으로 번지거나 이간질」) ----
// 숨은 카드처럼 화면 단추는 없다. 접견에서 「이걸 보시오」 하고 문서를 꺼내면 LLM 이 어느 문서인지 표시하고, 결과는 앱이 받는 사람에 따라 정한다.
// 문서: 입수한 전쟁 계획(정보국 「전쟁 계획 입수」) · 약점 카드(「약점 캐기」 등) · 드러난 숨은 인연 · 정확히 알아낸 딴마음(충성 45 아래).
export const DOC = {
  loyBelow: 45,
  planTn: { atk: 12, calm: -8 }, planSus: -12, planHostile: -15,     // 적국 군주에게 상대의 계획 — 공격 계획이면 긴장이 크게 오른다(전쟁으로 번질 수 있다)
  planNobleTn: { atk: 5, calm: -3 }, planNobleSus: -5, planNobleRel: 6, // 적국 귀족에게(군주에게 전해진다, 효과는 절반쯤)
  ownSus: 15, ownHostile: 10,                                         // 그 나라 사람에게 그 나라 기밀을 보이면: 새어 나간 것을 알고 회랑을 의심
  weakLoyal: -8, weakRuler: -20, weakThanks: -5,                      // 군주에게 그 나라 귀족의 약점
  gossip: -15, gossipP: 5, friendP: -8, threatP: -15,                 // 다른 귀족에게(이간질) · 그 귀족의 벗이면 거절 · 본인에게 보이면 협박으로 받아들임
  tieLoyal: -5, tieRuler: -15, tieGossip: -10,                        // 숨은 인연
  loyLoyal: -10, loyRuler: -30, loyThanks: -5, loyGossip: -10,        // 딴마음
  crossMul: 2, crossTn: 6,                                            // 제국 간 내통(두 나라 귀족 사이의 숨은 인연·상대 진영과 오간 서신): 군주의 노여움 2배 · 군주는 상대 나라를 탓한다(긴장 +)
};
// 문서마다 「누가(act) → 누구를(tgt): 무엇을(verb)」을 정확히 가리킨다(2026-11-08 사용자: 「문서가 정확히 좌표를 가리켜야 의미가 있다」).
interface Doc {
  id: string; k: 'plan' | 'weak' | 'tie' | 'loy'; side: NSide; ko: string; en: string; desc: string;
  act: [string, string]; tgt: [string, string]; verb: [string, string]; cross?: boolean; fake?: number;
  intent?: 'atk' | 'def' | 'wait'; card?: number; t?: number; a?: number; b?: number; wk?: WeakKind;
}
const sKo = (x: NSide) => scenarioNow()?.names?.[x] || (x === 'a' ? '은하 얼라이언스' : '인류 제국'), sEn = (x: NSide) => scenarioNow()?.names?.[x] || (x === 'a' ? 'Galactic Alliance' : 'Human Empire');
const govOf = (x: NSide): [string, string] => [`${sKo(x)} 정부`, `the ${sEn(x)} government`];
const rulerName = (x: NSide): [string, string] => [`${sKo(x)} 군주`, `the ${sEn(x)} sovereign`];
const nobleOf = (n: NobleRow): [string, string] => [`${n.ko}(${sKo(n.side)})`, `${n.en} (${sEn(n.side)})`];
const INTENT_V: Record<'atk' | 'def' | 'wait', [string, string]> = { atk: ['공격 준비', 'preparing to attack'], def: ['방어 태세', 'bracing for defence'], wait: ['관망', 'waiting it out'] };
const BOND_V: Record<string, [string, string]> = { oath: ['비밀 서약', 'a secret oath'], accord: ['밀약', 'a secret accord'], back: ['비밀 회선(내통)', 'a secret back channel'] };
/** 약점 종류마다 누구를 향한 잘못인가: 빚·밀거래·추문 → 자기 군주를 속임 · 학대 → 영지민 · 상대 진영과 오간 서신 → 상대 나라(제국 간 내통) */
function weakAim(n: NobleRow, k: WeakKind): { tgt: [string, string]; verb: [string, string]; cross: boolean } {
  const o: NSide = n.side === 'a' ? 'b' : 'a';
  switch (k) {
    case 'debt': return { tgt: rulerName(n.side), verb: ['갚지 못한 빚을 숨김', 'hiding unpaid debts'], cross: false };
    case 'smuggle': return { tgt: rulerName(n.side), verb: ['밀거래로 국법을 어김', 'breaking the realm\'s law through smuggling'], cross: false };
    case 'scandal': return { tgt: rulerName(n.side), verb: ['추문을 감춤', 'covering up a scandal'], cross: false };
    case 'cruelty': return { tgt: [`${n.ko}의 영지민`, `${n.en}'s subjects`], verb: ['학대', 'cruelty'], cross: false };
    default: return { tgt: rulerName(o), verb: ['몰래 서신을 주고받음', 'secret correspondence'], cross: true };
  }
}
function mkDoc(d: Omit<Doc, 'ko' | 'en' | 'desc'>, descTail: string): Doc {
  const tag: [string, string] = d.cross ? ['[제국 간 내통] ', '[Cross-realm collusion] '] : ['', ''];
  return { ...d, ko: `${tag[0]}${d.act[0]} → ${d.tgt[0]}: ${d.verb[0]}`, en: `${tag[1]}${d.act[1]} → ${d.tgt[1]}: ${d.verb[1]}`, desc: `${d.act[1]} → ${d.tgt[1]}: ${d.verb[1]}${d.cross ? ' (collusion across the two great powers)' : ''} — ${descTail}` };
}
function docsOf(sid: string, sv: AuSave): Doc[] {
  const out: Doc[] = [], given = sv.given ?? {}, src = intelDocSource(sid);
  for (const p of src.plans) {
    const id = `p:${p.side}:${p.d}`; if (given[id]) continue; const o: NSide = p.side === 'a' ? 'b' : 'a';
    out.push(mkDoc({ id, k: 'plan', side: p.side, intent: p.intent, act: govOf(p.side), tgt: [sKo(o), sEn(o)], verb: INTENT_V[p.intent] }, 'stolen war plans'));
  }
  for (const w of src.weak) {
    const n = byId.get(w.t); if (!n) continue; const aim = weakAim(n, w.k);
    out.push(mkDoc({ id: `w:${w.card}`, k: 'weak', side: n.side, t: n.id, card: w.card, wk: w.k, act: nobleOf(n), tgt: aim.tgt, verb: aim.verb, cross: aim.cross }, `proof of ${n.en}'s ${WEAK_PAIR(w.k)[1]}`));
  }
  withNobleSave(sid, (ns) => {
    for (const [k, a, b] of CR_BONDS) {
      if (BOND_PUBLIC[k] || k === 'rival' || !bondVisible(ns, k, a, b) || ns.fate[a] || ns.fate[b]) continue;
      const id = `t:${a}-${b}`, A = byId.get(a), B = byId.get(b); if (given[id] || !A || !B) continue;
      out.push(mkDoc({ id, k: 'tie', side: A.side, a, b, act: nobleOf(A), tgt: nobleOf(B), verb: BOND_V[k] ?? [BOND_NAME[k][0], BOND_NAME[k][1]], cross: A.side !== B.side }, `evidence of a hidden ${BOND_NAME[k][1]} tie`));
    }
    for (const n of CR_NOBLES) {
      const id = `l:${n.id}`; if (given[id] || !ns.knownLoyal[String(n.id)] || ns.fate[n.id] || ns.pending[n.id] || (ns.loyal[n.id] ?? 100) >= DOC.loyBelow) continue;
      out.push(mkDoc({ id, k: 'loy', side: n.side, t: n.id, act: nobleOf(n), tgt: rulerName(n.side), verb: ['배신을 꾀함', 'plotting betrayal'] }, 'intercepted proof of disloyalty'));
    }
  });
  // 위조 문서(정보국 위조 공방) — 받는 쪽(LLM)에게는 진짜와 똑같이 보인다. 화면(플레이어)에게만 「위조」라고 붙인다.
  for (const f of intelForged(sid)) {
    if (f.k === 'plan' && typeof f.from === 'string') { const o: NSide = f.from === 'a' ? 'b' : 'a'; out.push(mkDoc({ id: `f:${f.id}`, fake: f.id, k: 'plan', side: f.from, intent: f.intent ?? 'atk', act: govOf(f.from), tgt: [sKo(o), sEn(o)], verb: INTENT_V[f.intent ?? 'atk'] }, 'stolen war plans')); continue; }
    const A = typeof f.from === 'number' ? byId.get(f.from) : undefined; if (!A) continue;
    if (f.k === 'tie') { const B = typeof f.to === 'number' ? byId.get(f.to) : undefined; if (!B) continue; out.push(mkDoc({ id: `f:${f.id}`, fake: f.id, k: 'tie', side: A.side, a: A.id, b: B.id, act: nobleOf(A), tgt: nobleOf(B), verb: BOND_V[f.bk ?? 'back'], cross: A.side !== B.side }, `evidence of a hidden ${f.bk ?? 'back'} tie`)); continue; }
    out.push(mkDoc({ id: `f:${f.id}`, fake: f.id, k: 'loy', side: A.side, t: A.id, act: nobleOf(A), tgt: rulerName(A.side), verb: ['배신을 꾀함', 'plotting betrayal'] }, 'intercepted proof of disloyalty'));
  }
  return out.slice(0, 14);
}
/** 화면에 보일 문서 이름(위조면 표시) */
const docLabel = (d: Doc): string => L(d.ko, d.en) + (d.fake !== undefined ? L(' (위조)', ' (forged)') : '');
function docBrief(docs: Doc[]): string {
  if (!docs.length) return '';
  return ['', '[Documents the player holds] The player may show or hand you one of these (only these exist; never invent others). Each names exactly who acts against whom:', ...docs.map((d) => `- ${d.id}: ${d.desc}`),
    'When the player hands over a document about a noble, do not also list that noble under "accused" — the document speaks for itself.',
    'If the player hands you one, react in character to what it means for you and your realm (gratitude, alarm, anger, suspicion of the messenger…), but do not invent consequences.',
    'Add one more field to your JSON: "present_doc": the id of the document the player handed or showed you in their latest message, or null.'].join('\n');
}
const sideOfT = (t: AuTarget): NSide | undefined => (t.kind === 'ruler' ? t.side : byId.get(t.id)?.side);
/** 위조 문서를 건넸을 때 — 들키면 망신, 안 들키면 진짜처럼 */
async function presentFake(sid: string, sv: AuSave, t: AuTarget, d: Doc, today: string): Promise<{ line: [string, string]; big: boolean } | null> {
  const f = intelUseForged(sid, d.fake!); if (!f) return null;
  const to = sideOfT(t); if (!to) return null;
  const who = t.kind === 'ruler' ? null : byId.get(t.id)!, whoKo = who ? who.ko : rulerName(to)[0], whoEn = who ? who.en : rulerName(to)[1];
  // 문서가 가리키는 당사자(그 귀족 본인 · 계획의 주인 나라 군주)는 거짓을 바로 안다
  const party = (f.k === 'plan' && t.kind === 'ruler' && t.side === f.from) || (!!who && (who.id === f.from || who.id === f.to));
  const caught = party || Math.random() * 100 < forgeCatch(f.q);
  if (caught) {
    intelSway(sid, to, FORGE.sus, FORGE.hostile); if (who) withNobleSave(sid, (ns) => { shiftRel(ns, who.id, 'P', FORGE.relP); });
    return { line: [`${whoKo}이(가) 문서가 위조된 것을 알아챘습니다. 회랑을 거짓말쟁이로 여기고 크게 의심합니다(의심 +${FORGE.sus}${who ? `, 친밀 ${FORGE.relP}` : ''}).`, `${whoEn} saw through the forgery. They now take the Corridor for liars (suspicion +${FORGE.sus}${who ? `, intimacy ${FORGE.relP}` : ''}).`], big: true };
  }
  const real: Doc = { ...d, fake: undefined, id: `x:${d.id}` }; // 진짜처럼 통했다
  return presentDoc(sid, sv, t, real, today);
}
/** 문서를 건넨 결과. 돌려주는 [한, 영] 줄이 화면·기록에 남는다. */
async function presentDoc(sid: string, sv: AuSave, t: AuTarget, d: Doc, today: string): Promise<{ line: [string, string]; big: boolean } | null> {
  if (d.fake !== undefined) return presentFake(sid, sv, t, d, today);
  const to = sideOfT(t); if (!to) return null;
  const who = t.kind === 'ruler' ? null : byId.get(t.id)!, rebel = !!who && rebelLord(sid, who.id), whoKo = who ? who.ko : rulerName(to)[0], whoEn = who ? who.en : rulerName(to)[1];
  const give = () => { if (!d.id.startsWith('x:')) (sv.given ??= {})[d.id] = today; };
  const N = (id: number) => byId.get(id)!;
  const what: [string, string] = [`「${d.act[0]} → ${d.tgt[0]}: ${d.verb[0]}」`, `"${d.act[1]} → ${d.tgt[1]}: ${d.verb[1]}"`];
  if (d.k === 'plan') {
    const x = d.side, atk = d.intent === 'atk';
    if (to === x && !rebel) { intelSway(sid, x, DOC.ownSus, DOC.ownHostile); give(); return { line: [`${whoKo}에게 ${what[0]} 문서를 보였습니다. 나라의 기밀이 회랑 손에 있다는 것을 알고 회랑을 크게 의심합니다(의심 +${DOC.ownSus}).`, `You showed ${whoEn} the document ${what[1]}. Knowing the Corridor holds their secrets, they grow deeply suspicious (suspicion +${DOC.ownSus}).`], big: true }; }
    if (t.kind === 'ruler') {
      const n = atk ? DOC.planTn.atk : DOC.planTn.calm; give(); intelSway(sid, to, DOC.planSus, DOC.planHostile);
      await tensionShift(n, atk ? [`회랑이 건넨 문서 ${what[0]}`, `Corridor hands over ${what[1]}`] : [`회랑이 건넨 문서 ${what[0]}`, `Corridor hands over ${what[1]}`]).catch(() => undefined);
      return { line: atk ? [`${whoKo}에게 ${what[0]} 문서를 건넸습니다. 군주가 군을 움직입니다 — 두 강대국 사이 긴장 +${n}. 회랑을 한결 믿습니다(의심 ${DOC.planSus}).`, `You handed ${whoEn} ${what[1]}. The sovereign mobilises — great-power tension +${n}. They trust the Corridor more (suspicion ${DOC.planSus}).`]
        : [`${whoKo}에게 ${what[0]} 문서를 건넸습니다. 상대가 싸울 뜻이 없다는 것을 알고 긴장이 풀립니다(${n}). 회랑을 한결 믿습니다(의심 ${DOC.planSus}).`, `You handed ${whoEn} ${what[1]}. Seeing no will to fight, tension eases (${n}). They trust the Corridor more (suspicion ${DOC.planSus}).`], big: true };
    }
    const n = atk ? DOC.planNobleTn.atk : DOC.planNobleTn.calm; give(); intelSway(sid, to, DOC.planNobleSus, 0);
    withNobleSave(sid, (ns) => { shiftRel(ns, who!.id, 'P', DOC.planNobleRel); });
    await tensionShift(n, [`${who!.ko}이(가) 군주에게 올린 문서 ${what[0]}`, `${what[1]} passed up by ${who!.en}`]).catch(() => undefined);
    return { line: [`${whoKo}에게 ${what[0]} 문서를 건넸습니다. 그가 군주에게 올립니다 — 긴장 ${n > 0 ? '+' : ''}${n}. ${whoKo}이(가) 고마워합니다.`, `You gave ${whoEn} ${what[1]}. They pass it up to their sovereign — tension ${n > 0 ? '+' : ''}${n}. ${whoEn} is grateful.`], big: true };
  }
  if (d.k === 'weak') {
    const n = N(d.t!), mul = d.cross ? DOC.crossMul : 1;
    if (who && who.id === n.id) { withNobleSave(sid, (ns) => { shiftRel(ns, n.id, 'P', DOC.threatP); }); return { line: [`${n.ko}은(는) 자기 약점을 들이민 것을 협박으로 받아들였습니다(친밀 ${DOC.threatP}).`, `${n.en} took it as a threat (intimacy ${DOC.threatP}).`], big: false }; }
    if (to !== n.side || rebel) return { line: [`${whoKo}은(는) 남의 나라 귀족의 일에는 관심이 없습니다.`, `${whoEn} has no interest in a foreign noble's affairs.`], big: false };
    if (t.kind === 'ruler') {
      if (!intelGiveWeak(sid, d.card!)) return null;
      const lo = Math.round(DOC.weakLoyal * mul), ru = Math.round(DOC.weakRuler * mul);
      withNobleSave(sid, (ns) => { shiftLoyal(ns, n.id, lo); shiftRel(ns, n.id, rulerOf(n.side), ru); }); sv.sus[String(n.id)] = today; intelSway(sid, to, DOC.weakThanks, 0);
      if (d.cross) await tensionShift(DOC.crossTn, [`${n.ko}과(와) 상대 나라의 서신이 드러남`, `${n.en}'s letters to the rival power exposed`]).catch(() => undefined);
      return { line: [`${whoKo}에게 ${what[0]} 증거를 넘겼습니다. 군주가 ${n.ko}을(를) 차갑게 보기 시작합니다(충성 ${lo}).${d.cross ? ` 상대 나라가 손을 뻗었다며 분노합니다 — 긴장 +${DOC.crossTn}.` : ''}`, `You gave ${whoEn} proof of ${what[1]}. The sovereign turns cold on ${n.en} (loyalty ${lo}).${d.cross ? ` Furious that the rival power reached into the court — tension +${DOC.crossTn}.` : ''}`], big: true };
    }
    const friend = CR_BONDS.some(([k, a, b]) => k !== 'rival' && ((a === who!.id && b === n.id) || (b === who!.id && a === n.id)));
    if (friend) { withNobleSave(sid, (ns) => { shiftRel(ns, who!.id, 'P', DOC.friendP); }); return { line: [`${whoKo}은(는) 벗 ${n.ko}을(를) 헐뜯는 말에 귀를 막았습니다(친밀 ${DOC.friendP}).`, `${whoEn} refused to hear ill of their friend ${n.en} (intimacy ${DOC.friendP}).`], big: false }; }
    if (!intelGiveWeak(sid, d.card!)) return null;
    withNobleSave(sid, (ns) => { shiftRel(ns, who!.id, n.id, DOC.gossip * mul); shiftRel(ns, who!.id, 'P', DOC.gossipP); });
    return { line: [`${whoKo}에게 ${what[0]} 증거를 흘렸습니다. ${whoKo}과(와) ${n.ko} 사이가 틀어집니다(${DOC.gossip * mul}).`, `You let ${whoEn} see proof of ${what[1]}. Things sour between ${whoEn} and ${n.en} (${DOC.gossip * mul}).`], big: true };
  }
  if (d.k === 'tie') {
    const A = N(d.a!), B = N(d.b!), inv = [A, B].filter((x) => x.side === to), mul = d.cross ? DOC.crossMul : 1;
    if (who && (who.id === A.id || who.id === B.id)) { withNobleSave(sid, (ns) => { shiftRel(ns, who.id, 'P', DOC.threatP / 2); }); return { line: [`${whoKo}은(는) 숨겨 온 ${d.verb[0]}을(를) 우리가 안다는 것에 몸을 사립니다.`, `${whoEn} grows wary, knowing we have found out about ${d.verb[1]}.`], big: false }; }
    if (!inv.length || rebel) return { line: [`${whoKo}에게는 남의 나라 일입니다.`, `To ${whoEn}, it is another realm's business.`], big: false };
    give();
    if (t.kind === 'ruler') {
      const lo = Math.round(DOC.tieLoyal * mul), ru = Math.round(DOC.tieRuler * mul);
      withNobleSave(sid, (ns) => { for (const x of inv) { shiftLoyal(ns, x.id, lo); shiftRel(ns, x.id, rulerOf(x.side), ru); } }); for (const x of inv) sv.sus[String(x.id)] = today;
      if (d.cross) await tensionShift(DOC.crossTn, [`제국 간 내통이 드러남: ${A.ko} ↔ ${B.ko}`, `Cross-realm collusion exposed: ${A.en} and ${B.en}`]).catch(() => undefined);
      return { line: [`${whoKo}에게 ${what[0]}을(를) 알렸습니다. 군주가 ${inv.map((x) => x.ko).join('·')}을(를) 의심합니다(충성 ${lo}).${d.cross ? ` 상대 나라가 우리 귀족과 내통했다며 분노합니다 — 긴장 +${DOC.crossTn}.` : ''}`, `You revealed ${what[1]} to ${whoEn}. The sovereign now suspects ${inv.map((x) => x.en).join(' and ')} (loyalty ${lo}).${d.cross ? ` Furious that the rival power colluded with their nobles — tension +${DOC.crossTn}.` : ''}`], big: true };
    }
    withNobleSave(sid, (ns) => { shiftRel(ns, who!.id, A.id, DOC.tieGossip * mul); shiftRel(ns, who!.id, B.id, DOC.tieGossip * mul); });
    return { line: [`${whoKo}에게 ${what[0]}을(를) 흘렸습니다. ${whoKo}이(가) ${A.ko}·${B.ko}을(를) 경계합니다.`, `You let ${whoEn} in on ${what[1]}. ${whoEn} now distrusts ${A.en} and ${B.en}.`], big: true };
  }
  const n = N(d.t!);
  if (who && who.id === n.id) { withNobleSave(sid, (ns) => { shiftRel(ns, n.id, 'P', DOC.threatP / 2); }); return { line: [`${n.ko}은(는) 속마음을 들킨 것에 얼굴이 굳었습니다.`, `${n.en}'s face hardens, knowing their true heart is known.`], big: false }; }
  if (to !== n.side || rebel) return { line: [`${whoKo}에게는 남의 나라 일입니다.`, `To ${whoEn}, it is another realm's business.`], big: false };
  give();
  if (t.kind === 'ruler') {
    withNobleSave(sid, (ns) => { shiftLoyal(ns, n.id, DOC.loyLoyal); shiftRel(ns, n.id, rulerOf(n.side), DOC.loyRuler); }); sv.sus[String(n.id)] = today; delete sv.ch[String(n.id)]; intelSway(sid, to, DOC.loyThanks, 0);
    return { line: [`${whoKo}에게 ${what[0]} 증거를 알렸습니다. 군주가 ${n.ko}을(를) 의심하고, 둘 사이가 크게 벌어집니다. ${n.ko}와(과)의 밀사 통로가 있었다면 끊깁니다.`, `You exposed ${what[1]} to ${whoEn}, with proof. The sovereign now suspects ${n.en}, and the rift between them widens. Any envoy channel with ${n.en} is cut.`], big: true };
  }
  withNobleSave(sid, (ns) => { shiftRel(ns, who!.id, n.id, DOC.loyGossip); });
  return { line: [`${whoKo}에게 ${what[0]}을(를) 흘렸습니다. ${whoKo}이(가) ${n.ko}을(를) 경계합니다.`, `You let ${whoEn} know of ${what[1]}. ${whoEn} now keeps their distance.`], big: true };
}

async function say(text: unknown): Promise<Record<string, unknown>> {
  if (curC !== null) return cnSay(text);
  const sid = mine(); if (!sid || !cur) return { ok: false, error: L('회담이 열려 있지 않습니다.', 'No meeting is open.') };
  const msg = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600); if (!msg) return { ok: false, error: L('할 말을 적어 주세요.', 'Write something to say.') };
  if (busy) return { ok: false, error: L('상대가 답하는 중입니다.', 'They are still answering.') };
  const sv = bookOf(sid), t = cur, key = targetKey(t), today = ctx.gameDate || '';
  busy = true;
  try {
    const tn = tensionNow(), ids = CR_NOBLES.map((n) => n.id);
    const msgs = withNobleSave(sid, (ns) => auMessages({ player: ctx.playerName || 'the Corridor', sideName: { a: sideName('a'), b: sideName('b') }, tension: tn ? stageName(tn.st)[1] : '', nobles: CR_NOBLES, bonds: CR_BONDS, known: knownNobles(sid), wedCn: cnUnionIds(sid) }, ns, sv, t, msg));
    if (msgs[0] && msgs[0].role === 'system') msgs[0].content += domainBrief(sid, t); // 영지 사정(귀족 영역다툼, 2026-11-07)
    if (msgs[0] && msgs[0].role === 'system' && t.kind === 'noble') { const ties = cnTiesOf(sid, t.id); if (ties.length) msgs[0].content += `\n[Ties to the Corridor] ${ties.map((x) => x.k === 'union' ? `you are married to the Corridor noble ${x.name} (a political marriage)` : `the Corridor noble ${x.name} is an old acquaintance of yours`).join('; ')}.`; } // 회랑의 귀족과의 인연(2026-11-08)
    if (msgs[0] && msgs[0].role === 'system' && t.kind === 'noble' && VENUE_EN[venue]) msgs[0].content += `\n[Setting] ${VENUE_EN[venue]}`; // 접견 장소(2026-11-08)
    const docs = docsOf(sid, sv); if (msgs[0] && msgs[0].role === 'system') msgs[0].content += docBrief(docs); // 손에 쥔 기밀 문서(2026-11-08)
    const raw = await ctx.ai.session(async (chat) => { let r = await chat(msgs, { maxTokens: 900, json: true }); if (!parseAuReply(r, ids)) r = await chat(msgs, { maxTokens: 900 }); return r; });
    const rep = parseAuReply(raw, ids);
    if (!rep) { logDiagnostic('warn', 'scenario_audience.parse_failed', { raw: String(raw).slice(0, 400) }); return { ok: false, error: L('상대의 답을 알아듣지 못했습니다. 다시 말해 보세요.', 'Could not make out the reply. Try again.') }; }
    const outs = withNobleSave(sid, (ns) => {
      let o = judge(sv, ns, CR_NOBLES, t, rep, CR_BONDS, knownNobles(sid));
      if (t.kind === 'noble' && venue === 'limo') o = o.filter((x) => x.k !== 'reported' || Math.random() >= 0.7); // 밀폐된 리무진: 밀사 이야기가 거의 새지 않는다
      if (t.kind === 'noble' && venue === 'dining' && rep.askedEnvoy && !o.some((x) => x.k === 'reported') && Math.random() < 0.25) { const n = byId.get(t.id); if (n) o.push({ k: 'reported', side: n.side, by: 'ruler' }); } // 식당: 남의 눈
      if (t.kind === 'noble' && venue === 'garden' && !gardenTold && Math.random() < 0.3) { // 정원: 속마음 — 숨은 인연을 흘린다
        const hid = CR_BONDS.filter(([k, a, b]) => (a === t.id || b === t.id) && !bondVisible(ns, k, a, b));
        if (hid.length) { const pick = hid[Math.floor(Math.random() * hid.length)]; reveal(ns, pick[1], pick[2]); gardenTold = true; const ob = byId.get(pick[1] === t.id ? pick[2] : pick[1]); if (ob) ns.notes.push({ d: today, id: t.id, kind: 'reveal', ko: `정원을 걷다가 ${byId.get(t.id)?.ko}이(가) ${ob.ko}과(와)의 인연을 흘렸습니다.`, en: `Strolling in the garden, ${byId.get(t.id)?.en} let slip their tie with ${ob.en}.` }); }
      }
      if (t.kind === 'noble' && venue === 'dining' && (loveOf(sv, t.id)?.st ?? 0) <= 2 && o.some((x) => x.k === 'date_ok') && Math.random() < LOVE.gossip) o.push({ k: 'love_rumor', id: t.id }); // 식당 데이트: 남의 눈 — 군주 귀에 소문(2026-11-08)
      o = o.map((x) => (x.k === 'revolt_yes' && isCoreHub(x.id) ? { k: 'revolt_no', id: x.id } as AuOutcome : x)).filter((x) => !(x.k === 'gift_ok' && giftGiven)); // 숨은 카드: 수도 섹터 거점은 반란할 땅이 없다 · 선물은 한 회담에 한 번
      if (t.kind === 'noble' && rep.warmth) shiftRel(ns, t.id, 'P', rep.warmth * 2);
      if (t.kind === 'noble' && rep.heart) heartMoved = applyHeart(sv, t.id, rep.heart, heartMoved); // 연애 호감(보이지 않음, 비서와 같은 난이도) — 판정 뒤에
      applyOutcomes(sv, o, today, (id) => rulerOf(byId.get(id)?.side ?? 'a'), (x, y, d) => { shiftRel(ns, x, y, d); }, (id, d) => { shiftLoyal(ns, id, d); });
      for (const x of o) if (x.k === 'intro') { // 소개: 연감에 얼굴이 드러나고, 소개해 준 사람과의 인연도 알게 된다
        if (x.via === 'bond') reveal(ns, x.by, x.id);
        const a = byId.get(x.by), b = byId.get(x.id); if (!a || !b) continue;
        ns.notes.push({ d: today, id: x.id, kind: 'reveal', ko: `${a.ko}의 소개로 ${b.ko}을(를) 알게 되었습니다.`, en: `Introduced to ${b.en} by ${a.en}.` });
        if (ns.notes.length > NB.keepNotes) ns.notes.splice(0, ns.notes.length - NB.keepNotes);
      }
      // 숨은 대화 카드(2026-11-08): 한 회담에 선물은 한 번 · 수도 섹터 거점은 반란할 땅이 없다
      for (const x of o) {
        if (x.k === 'info_loyal') ns.knownLoyal[String(x.id)] = true;
        else if (x.k === 'info_tie') reveal(ns, x.a, x.b);
        else if (x.k === 'defect_yes') ns.pending[String(x.id)] = 'defect_p';
      }
      return o;
    });
    for (const x of outs) {
      if (x.k === 'gift_ok') { giftGiven = true; try { await enqueue(() => sendConsole(`effect add_resource = { energy = -${AUX.gift} }`)); } catch (e) { withNobleSave(sid, (ns) => { shiftRel(ns, x.id, 'P', -AUX.giftRel); }); (x as { k: string }).k = 'gift_nomoney'; giftGiven = false; } }
      if (x.k === 'revolt_yes') { try { inciteRevolt(sid, x.id, today); } catch (e) { logDiagnostic('warn', 'scenario_audience.revolt_failed', { error: String(e) }); } }
    }
    const h = (sv.hist[key] ??= []);
    h.push({ who: 'me', text: msg, d: today }, { who: 'them', text: rep.say, d: today });
    const events: string[] = [];
    { const pd = /"present_doc"\s*:\s*"([^"]{1,40})"/.exec(String(raw)), doc = pd ? docs.find((x) => x.id === pd[1]) : undefined; // 기밀 문서를 건넸나
      if (doc) { try { const r = await presentDoc(sid, sv, t, doc, today); if (r) { const line = L(r.line[0], r.line[1]); events.push(line); h.push({ who: 'sys', text: line, d: today });
        if (r.big) { sv.log.push({ d: today, ko: r.line[0], en: r.line[1] }); if (sv.log.length > AU.keepLog) sv.log.splice(0, sv.log.length - AU.keepLog); } logDiagnostic('info', 'scenario_audience.doc', { key, doc: doc.id }); } }
        catch (e) { logDiagnostic('warn', 'scenario_audience.doc_failed', { error: String(e) }); } } }
    for (const o of outs) {
      const line = (o as { k: string }).k === 'gift_nomoney' ? L('에너지가 모자라 선물을 건네지 못했습니다.', 'Not enough energy to present the gift.') : outcomeText(o); events.push(line); h.push({ who: 'sys', text: line, d: today });
      gameReact(o);
      if (o.k === 'reported' || o.k === 'accuse_true' || (o.k === 'accuse_false' && o.caught) || o.k === 'envoy_open' || o.k === 'defect_yes' || o.k === 'revolt_yes' || o.k === 'pact_ok' || o.k === 'love_ok' || o.k === 'love_public' || o.k === 'wed_ok' || o.k === 'love_rumor') {
        sv.log.push({ d: today, ko: line, en: line }); if (sv.log.length > AU.keepLog) sv.log.splice(0, sv.log.length - AU.keepLog);
        if (o.k !== 'envoy_open' && o.k !== 'defect_yes' && o.k !== 'pact_ok' && o.k !== 'love_ok') { try { chronNoteWorld(line, true); } catch { /* 연대기는 덤 */ } } // 밀사 통로·귀순 약속·서약은 비밀이라 연대기에 남기지 않는다
        if (o.k === 'reported') ctx.notify({ kind: 'office', title: L('공작이 드러났습니다', 'Our scheme is exposed'), body: line });
        if (o.k === 'love_rumor') ctx.notify({ kind: 'office', title: L('밀회가 소문났습니다', 'Word of a tryst is out'), body: line });
      }
    }
    if (h.length > AU.keepHist) h.splice(0, h.length - AU.keepHist);
    sv.turns++; save();
    logDiagnostic('info', 'scenario_audience.turn', { key, asked: rep.askedEnvoy, accused: rep.accused, intro: rep.introduce, askedIntro: rep.askedIntro, warmth: rep.warmth, outs: outs.map((o) => o.k) });
    return { ok: true, say: rep.say, events, ...view() };
  } catch (e) { logDiagnostic('warn', 'scenario_audience.say_failed', { error: String(e) }); return { ok: false, error: (e as Error).message }; }
  finally { busy = false; }
}

// ---- 회랑의 귀족 접견(2026-11-08 사용자: 「앉힐 때 말투를 그 지도자의 페르소나를 참고 … 자비 같은 특수 특성은 일단은 인식하지 말고」) ----
// 말투: 그 지도자의 SLLM 인물 기록(집무실 연락처 대화에서 정해진 말투·플레이어가 정한 말투·전기). 게임 지도자 특성은 넣지 않는다.
// 태도: 임명할 때 찍은 성격(명예·자비·관대·용맹·계산)과 지금 충성. 말솜씨(warmth)로 충성이 조금 움직인다(한 해 한도).
const CN_REST = 30;
function startCn(lid: number, v: Venue = 'room'): { ok: boolean; error?: string } {
  const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리를 맡은 시나리오 판에서만 쓸 수 있습니다.', 'Only available when playing the Corridor seat in this scenario.') };
  const n = cnobleOf(sid, lid); if (!n) return { ok: false, error: L('지금 우리 귀족이 아닙니다.', 'Not one of our nobles right now.') };
  const sv = bookOf(sid), key = `c${lid}`, today = ctx.gameDate || '';
  if (sv.now !== key) {
    const m = sv.met[key], left = m ? dayOf(m) + CN_REST - dayOf(today) : 0;
    if (left > 0) return { ok: false, error: L(`약 ${Math.ceil(left / 30)}달 뒤에 다시 부를 수 있습니다.`, `You can summon them again in about ${Math.ceil(left / 30)} month(s).`) };
    const why = venueCheck(sid, v, lid, true); if (why) return { ok: false, error: why };
    sv.now = key; sv.turns = 0; sv.met[key] = today; venue = v; gardenTold = false; giftGiven = false; cnIntro = false;
    venueOpen(sid, sv, key, v, null, lid); save();
  }
  cur = null; curC = lid; openWindow(); return { ok: true };
}
const dayOf = (d: string): number => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? Number(m[1]) * 360 + (Number(m[2]) - 1) * 30 + (Number(m[3]) - 1) : 0; };
function cnView(): Record<string, unknown> {
  const sid = mine(); if (!sid || curC === null) return { ok: false };
  const n = cnobleOf(sid, curC); if (!n) return { ok: false };
  const sv = bookOf(sid), hist = (sv.hist[`c${n.lid}`] ?? []).map((h) => ({ who: h.who, text: h.text }));
  const D = 'assets/scenario/corridor/', ven = venue !== 'room' ? [`${D}venues/venue_${venue}_day.webp`, `${D}venues/venue_${venue}_day.png`] : [];
  return { ok: true, kind: 'cnoble', venue: venue !== 'room' ? VENUE_NAME()[venue] : '', name: n.name, title: (venue !== 'room' ? VENUE_NAME()[venue] + ' · ' : '') + L(`회랑의 귀족 · ${n.land}`, `Corridor noble · ${n.land}`), side: 'p', pic: '', frame: '', bg: [...ven, `${D}audience_p.webp`, `${D}audience_p.png`], stage: n.word, channel: false, suspect: false, hist, busy };
}
function cnPrompt(sid: string, lid: number): string {
  const n = cnobleOf(sid, lid)!, pm = personaPeek(sid, `p:${lid}`);
  const tr = n.tr.map((v, i) => (v ? `${TRAIT_NAME[i][v > 0 ? 0 : 1][1]}${Math.abs(v) === 2 ? ' (strongly)' : ''}` : '')).filter(Boolean).join(', ') || 'balanced';
  const voice = [pm?.voice ? `Speaking style set by the player (follow it first): ${pm.voice}` : '', pm?.persona ? `Established persona and manner of speech: ${pm.persona}` : '', pm?.bio ? `Biography: ${pm.bio}` : '',
    pm?.mems?.length ? `Things they remember about the ruler: ${pm.mems.slice(-4).map((m) => m.text).join(' / ')}` : ''].filter(Boolean).join('\n');
  return [
    'You write one character\'s lines in a private 1:1 audience in the space strategy game "Stellaris" (scenario "The Corridor Triangle": two great powers, the Galactic Alliance and the Human Empire, separated by the small Seren Corridor state, which the player rules).',
    `You play ${n.name}, one of the player's own leaders, whom the player raised to nobility over newly conquered land: ${cnobleLandEn(sid, lid)}. You now rule it as a Corridor noble on the player's behalf and are summoned before your ruler.`,
    voice || 'No established persona yet: give them a distinct, consistent voice of your own.',
    `Personality as a lord (shape your attitude by it): ${tr}. Current loyalty to the ruler: ${n.word} (${n.loyal}/100). Low loyalty shows as coolness, demands or veiled ambition; never openly confess treason.`,
    'Ignore any in-game leader traits; only the personality above matters.',
    'Stay in character. Answer in 2–4 sentences of dialogue (the response language follows the language instruction below). No stage directions, no quotation marks. Do not invent game effects or promise things outside your power.',
    'Besides the line, report what the RULER said in their latest message (the game decides the results; your line should match the stance below):',
    '- reward: true if the ruler is granting you a reward, honor or money right now.',
    '- oath: true if the ruler demands that you swear (or renew) an oath of loyalty.',
    '- tax: true if the ruler demands more tribute or taxes from your land.',
    '- purge: true if the ruler orders you to root out spies or traitors in your household.',
    '- intro: true if the ruler asks you to introduce them to someone you know from the land\'s former realm.',
    '- match_target: if the ruler orders or asks you to marry, court for marriage, or form a marriage alliance with a noble of the great powers, that noble\'s roster number (see the list below); otherwise null.',
    cnTieBrief(sid, lid),
    `Your stance on a political marriage: ${n.loyal >= CN_MATCH_LOYAL ? 'you accept it as your duty to the ruler (whether the other house agrees is not up to you).' : 'you resent being used as a bargaining chip and refuse.'}`,
    `Your stance: a reward pleases you. ${n.tr[0] > 0 || n.tr[4] > 0 ? 'Asked for an oath, you swear gladly.' : n.tr[3] > 0 || n.tr[4] < 0 ? 'Asked for an oath, you bristle at the distrust (you may still say the words, coldly).' : 'Asked for an oath, you swear dutifully.'} ${n.tr[2] > 0 ? 'Asked for more taxes, you comply with good grace.' : 'Asked for more taxes, you grumble — your land is still raw from conquest.'} Ordered to purge spies, you obey.`,
    '- warmth: how much the ruler\'s words pleased you, integer −2..2 (insults, threats −2; respect, rewards, trust that fits your character +1..2).',
    'Reply with JSON only: {"say": "...", "reward": false, "oath": false, "tax": false, "purge": false, "intro": false, "match_target": null, "warmth": 0}',
    'Nobles of the great powers the ruler knows (roster):', [...knownNobles(sid)].map((id) => byId.get(id)).filter((x): x is NobleRow => !!x).map((x) => `#${x.id} ${x.en} / ${x.ko} (${x.side === 'a' ? 'Alliance' : 'Empire'})`).join('\n') || 'none',
  ].filter(Boolean).join('\n');
}
const CN_MATCH_LOYAL = 45; // scenario-cnobles CN.matchLoyal 과 같게
/** 회랑의 귀족 프롬프트: 강대국 귀족과의 인연(2026-11-08). */
function cnTieBrief(sid: string, lid: number): string {
  const t = cnTiesFor(sid, lid); if (!t.length) return 'You have no ties yet with the nobles of the great powers.';
  return 'Your ties with nobles of the great powers: ' + t.map((x) => { const p = byId.get(x.id); return `${p?.en ?? '?'} (${x.k === 'union' ? `your spouse by a political marriage${x.g ? ' — fallen from grace' : ''}` : 'an acquaintance from the old realm'})`; }).join('; ') + '.';
}
type CnAsk = 'reward' | 'oath' | 'tax' | 'purge' | 'intro' | 'match';
function cnParse(raw: string): { say: string; warmth: number; asks: CnAsk[]; matchT?: number } | null {
  const t = String(raw || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const m = /\{[\s\S]*\}/.exec(t); if (!m) return null;
  try { const j = JSON.parse(m[0]) as Record<string, unknown>; const say = String(j.say ?? '').trim(); if (!say) return null; const w = Number(j.warmth);
    const mt = Math.round(Number(j.match_target)), hasMt = j.match_target !== null && j.match_target !== undefined && byId.has(mt);
    return { say: say.slice(0, 1200), warmth: Number.isFinite(w) ? Math.max(-2, Math.min(2, Math.round(w))) : 0, asks: [...(['reward', 'oath', 'tax', 'purge', 'intro'] as CnAsk[]).filter((k) => j[k] === true), ...(hasMt ? ['match' as CnAsk] : [])], ...(hasMt ? { matchT: mt } : {}) }; } catch { return null; }
}
/** 회랑의 귀족 숨은 대화 카드(2026-11-08): 포상 · 충성 맹세 · 세금 더 걷기(각 한 해 한 번) · 첩자 단속 · 옛 진영 귀족 소개(한 회담 한 번) */
async function cnAsks(sid: string, sv: AuSave, lid: number, asks: CnAsk[], today: string, matchT?: number): Promise<string[]> {
  const out: string[] = [], n = cnobleOf(sid, lid); if (!n) return out;
  const y = Number(/^(\d+)/.exec(today)?.[1] ?? 0), yr = (sv.cnY ??= {})[String(lid)] ??= {};
  const once = (k: string): boolean => { if (yr[k] === y) { out.push(L('올해는 이미 한 일입니다.', 'That has already been done this year.')); return false; } yr[k] = y; return true; };
  const sh = (d: number): string => { const m = cnobleShake(sid, lid, d); return m ? L(`충성 ${m > 0 ? '+' : ''}${m}`, `loyalty ${m > 0 ? '+' : ''}${m}`) : ''; };
  for (const k of asks) {
    if (k === 'reward' && once('rw')) {
      try { await enqueue(() => sendConsole(`effect add_resource = { energy = -${AUX.cnReward} }`)); out.push(L(`포상(에너지 ${AUX.cnReward})을 내렸습니다. ${sh(AUX.cnRewardLoyal)}`, `A reward (${AUX.cnReward} energy) was granted. ${sh(AUX.cnRewardLoyal)}`)); }
      catch (e) { delete yr.rw; out.push(L('에너지가 모자라 포상을 내리지 못했습니다.', 'Not enough energy for the reward.')); }
    } else if (k === 'oath' && once('oath')) {
      const d = n.tr[0] > 0 || n.tr[4] > 0 ? AUX.cnOath : n.tr[3] > 0 || n.tr[4] < 0 ? -AUX.cnOath : 1;
      out.push(d > 0 ? L(`${n.name}이(가) 충성을 맹세했습니다. ${sh(d)}`, `${n.name} swore loyalty. ${sh(d)}`) : L(`${n.name}은(는) 의심받은 것에 기분이 상했습니다. ${sh(d)}`, `${n.name} resents being doubted. ${sh(d)}`));
    } else if (k === 'tax' && once('tax')) {
      try { await enqueue(() => sendConsole(`effect add_resource = { energy = ${AUX.cnTax} }`)); const d = n.tr[2] > 0 ? Math.round(AUX.cnTaxLoyal / 2) : AUX.cnTaxLoyal; out.push(L(`${n.name}의 땅에서 세금을 더 걷었습니다(에너지 +${AUX.cnTax}). ${sh(d)}`, `Extra taxes were levied on ${n.name}'s land (+${AUX.cnTax} energy). ${sh(d)}`)); }
      catch (e) { delete yr.tax; out.push(L('게임에 보내지 못해 세금을 걷지 못했습니다.', 'Could not reach the game to levy taxes.')); }
    } else if (k === 'purge') {
      const r = await cnPurgeSpy(sid, lid); out.push(L(r[0], r[1]));
    } else if (k === 'intro') {
      if (cnIntro) { out.push(L('이번 접견에서는 이미 소개를 받았습니다.', 'You were already introduced to someone this audience.')); continue; }
      const known = knownNobles(sid), pick = withNobleSave(sid, (ns) => {
        const c = CR_NOBLES.filter((x) => x.side === n.side && !known.has(x.id) && !sv.intro[String(x.id)] && !ns.fate[String(x.id)]);
        if (!c.length) return null; const x = c[(lid * 7 + c.length) % c.length];
        sv.intro[String(x.id)] = today; shiftRel(ns, x.id, 'P', AU.introBonus);
        cnTie(sid, lid, x.id, 'friend', today); // 소개해 준 우리 귀족과 그 사람은 아는 사이(관계망, 2026-11-08)
        ns.notes.push({ d: today, id: x.id, kind: 'reveal', ko: `회랑의 귀족 ${n.name}의 소개로 ${x.ko}을(를) 알게 되었습니다.`, en: `Introduced to ${x.en} by our noble ${n.name}.` }); if (ns.notes.length > NB.keepNotes) ns.notes.splice(0, ns.notes.length - NB.keepNotes);
        return x;
      });
      cnIntro = true;
      out.push(pick ? L(`${n.name}이(가) 옛 진영의 ${pick.ko}을(를) 소개했습니다. 귀족 연감에 얼굴이 드러났습니다.`, `${n.name} introduced ${pick.en} from the former realm. Their face now appears in the peerage.`) : L(`${n.name}에게는 우리가 아직 모르는 사람 중 소개해 줄 만한 이가 없습니다.`, `${n.name} knows no one we have not already met.`));
    } else if (k === 'match' && matchT !== undefined && once('match')) { // 정략 혼인(2026-11-08) — 한 해 한 번
      const sp = withNobleSave(sid, (ns) => spouseOf(ns, CR_BONDS, matchT));
      const r = cnMatch(sid, lid, matchT, today, { known: knownNobles(sid).has(matchT), spouse: sp !== null, playerWed: wedTo(sv) === matchT || (loveOf(sv, matchT)?.st ?? 0) >= 3 });
      if (!r.ok) delete yr.match;
      out.push(L(r.text[0], r.text[1]));
    }
  }
  return out.filter(Boolean);
}
async function cnSay(text: unknown): Promise<Record<string, unknown>> {
  const sid = mine(), lid = curC; if (!sid || lid === null || !cnobleOf(sid, lid)) return { ok: false, error: L('회담이 열려 있지 않습니다.', 'No meeting is open.') };
  const msg = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600); if (!msg) return { ok: false, error: L('할 말을 적어 주세요.', 'Write something to say.') };
  if (busy) return { ok: false, error: L('상대가 답하는 중입니다.', 'They are still answering.') };
  const sv = bookOf(sid), key = `c${lid}`, today = ctx.gameDate || '';
  busy = true;
  try {
    const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [{ role: 'system', content: cnPrompt(sid, lid) + (VENUE_EN[venue] ? `\n[Setting] ${VENUE_EN[venue]}` : '') }];
    for (const h of (sv.hist[key] ?? []).slice(-AU.keepHist)) if (h.who !== 'sys') msgs.push({ role: h.who === 'me' ? 'user' : 'assistant', content: h.who === 'me' ? h.text : JSON.stringify({ say: h.text }) });
    msgs.push({ role: 'user', content: msg });
    const raw = await ctx.ai.session(async (chat) => { let r = await chat(msgs, { maxTokens: 700, json: true }); if (!cnParse(r)) r = await chat(msgs, { maxTokens: 700 }); return r; });
    const rep = cnParse(raw);
    if (!rep) { logDiagnostic('warn', 'scenario_audience.cn_parse_failed', { raw: String(raw).slice(0, 400) }); return { ok: false, error: L('상대의 답을 알아듣지 못했습니다. 다시 말해 보세요.', 'Could not make out the reply. Try again.') }; }
    const moved = rep.warmth ? cnobleTalk(sid, lid, rep.warmth) : 0;
    const h = (sv.hist[key] ??= []); h.push({ who: 'me', text: msg, d: today }, { who: 'them', text: rep.say, d: today });
    const events: string[] = [];
    for (const line of await cnAsks(sid, sv, lid, rep.asks, today, rep.matchT)) { events.push(line); h.push({ who: 'sys', text: line, d: today }); }
    if (moved) { const line = moved > 0 ? L(`충성이 올랐습니다(+${moved}).`, `Loyalty rose (+${moved}).`) : L(`충성이 떨어졌습니다(${moved}).`, `Loyalty fell (${moved}).`); events.push(line); h.push({ who: 'sys', text: line, d: today }); }
    if (h.length > AU.keepHist) h.splice(0, h.length - AU.keepHist);
    sv.turns++; save();
    return { ok: true, say: rep.say, events, ...cnView() };
  } catch (e) { logDiagnostic('warn', 'scenario_audience.cn_say_failed', { error: String(e) }); return { ok: false, error: (e as Error).message }; }
  finally { busy = false; }
}

/** 연감 화면용: 지금 열린 밀사 통로와 의심받는 귀족(플레이어가 아는 것). */
export function audienceMarks(sid: string): { ch: number[]; sus: number[]; met: number[]; love?: number[] } { const sv = bookOf(sid); return { ...(sv.love ? { love: Object.keys(sv.love).map(Number) } : {}), ch: Object.keys(sv.ch).map(Number), sus: Object.keys(sv.sus).map(Number), met: [...Object.keys(sv.met).filter((k) => k.startsWith('n')).map((k) => Number(k.slice(1))), ...Object.keys(sv.intro).map(Number)] }; } // 소개받은 귀족도 얼굴이 알려진다

export function registerScenarioAudience(): void {
  setAudienceMarksSource(audienceMarks); // 연감 세력판이 밀사 통로·의심·만난 귀족을 알도록(순환 가져오기 없이)
  setAudienceWriter((sid, kind, id, on) => { const sv = bookOf(sid), m = sv[kind]; if (on) m[String(id)] = ctx.gameDate || ''; else delete m[String(id)]; save(); }); // 회랑 정보국 2단계: 협박 → 밀사 통로 · 누명 → 군주의 의심(2026-11-07)
  /** 만찬 차림표(2026-11-08): 귀족 접견을 식당에서 할 때. 요리사를 사 뒀으면 좋아하는 것·싫어하는 것이 표시된다. */
  ipcMain.handle('auMenu', async (_e, t: unknown) => {
    const sid = mine(), o = (t ?? {}) as { id?: unknown }, n = byId.get(Number(o.id)); if (!sid || !n) return { ok: false };
    const cook = !!insidersOf(sid, n.id)?.cook;
    const SP: Record<string, [string, string]> = { hum: ['인간형', 'Humanoid'], mam: ['포유류', 'Mammalian'], rep: ['파충류', 'Reptilian'], avi: ['조류', 'Avian'], art: ['절지류', 'Arthropoid'], mol: ['연체류', 'Molluscoid'], fun: ['균류', 'Fungoid'], plant: ['식물형', 'Plantoid'], lith: ['암석', 'Lithoid'], necro: ['언데드형', 'Necroid'], aqua: ['수생', 'Aquatic'] };
    const CAT: Record<string, [string, string]> = { main: ['메인 요리', 'Mains'], bowl: ['수프와 식사', 'Soups & Bowls'], rare: ['별미', 'Delicacies'], sweet: ['디저트', 'Desserts'], drink: ['음료', 'Drinks'] };
    return { ok: true, cook, cats: DISH_CATS.map((c) => ({ k: c, name: L(...CAT[c]), en: CAT[c][1] })), dishes: menuFor(n).map((m) => ({ key: m.key, cat: m.cat, name: m.ko, en: m.en, likes: m.likes.map((c) => L(...(SP[c] ?? [c, c]))).join(' · '), pic: m.pic, ...(cook && m.fav ? { fav: true } : {}), ...(cook && m.hate ? { hate: true } : {}) })) };
  });
  ipcMain.handle('auOpen', async (_e, t: unknown) => { const o = (t ?? {}) as { kind?: unknown; id?: unknown; venue?: unknown; dish?: unknown }, v = parseVenue(o.venue); if (o.kind === 'cnoble') { try { return startCn(Number(o.id), v); } catch (e) { return { ok: false, error: String((e as Error).message || e) }; } } const x = parseTarget(t); if (!x) return { ok: false, error: L('누구를 만날지 고르세요.', 'Choose whom to meet.') }; try { return startMeeting(x, v, typeof o.dish === 'string' ? o.dish.slice(0, 20) : ''); } catch (e) { return { ok: false, error: String((e as Error).message || e) }; } });
  ipcMain.handle('auState', async () => { try { return view(); } catch (e) { logDiagnostic('warn', 'scenario_audience.view_failed', { error: String(e) }); return { ok: false }; } });
  ipcMain.handle('auSay', async (_e, text: unknown) => say(text));
  ipcMain.handle('auClose', async (event) => { if (win && event.sender === win.webContents) win.close(); return true; });
}
export const scnAudienceTest = { reset: () => { all = {}; } };
