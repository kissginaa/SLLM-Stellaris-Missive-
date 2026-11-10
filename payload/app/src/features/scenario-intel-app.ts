// 회랑 정보국(시나리오 전용 첩보, 앱 쪽, 2026-11-07). 규칙: src/scenario-intel.ts · 화면: 첩보 지도(ui/scenario-map.html?intel=1 + ui/scenario-intel.js) · 집무실 아이콘: ui/office-intel.js
// 회랑 자리를 맡은 판에서만. 매달 섹터 보고가 오면(scenario-map-app) 한 번 계산하고, 정보 예산만 게임에서 뺀다(콘솔 한 줄, 예산이 0 이면 안 보냄).
// 1단계(설계 7-1): 공작원 · 정보 예산 · 귀족 정보망 · 정찰 작전(신원 파악 · 충성도 탐지 · 인연 캐기).
// 알림(2026-11-07 사용자 B안): 평범한 작전 결과는 알림 없이 보고서함에 쌓았다가 연례 회의 때 「연말 보고서」로 한꺼번에. 공작원 체포·큰 공작 들통·반란·의심도 단계·최후통첩만 바로 알림.
// 카드 방식(2026-11-07, docs/SCENARIO_CORRIDOR_ESPIONAGE_CARDS_DESIGN_20261107_KO.md): 작전은 손패의 카드로 건다(act 'play'). 손패·첩보력은 매년 1월 섹터 보고 때 「연례 정보 회의」에서.
// 2단계(2026-11-07): 매수 · 이간질 · 약점 캐기 · 협박 · 누명 · 반란 부추기기 + 의심도 단계(경계·감찰·최후통첩) + 회랑과 각 강대국 사이 긴장(적대).
//   게임으로: 발각·최후통첩은 sllm_cr_intel_op(호감), 반란은 sllm_cr_revolt(섹터가 실제로 떨어져 나가 새 나라가 됨, 이름은 모드 표의 자동 작명, 통치자는 그 귀족).
//   매달 게임에 보내는 것은 없다(2026-11-07): 정보 예산은 연례 회의 때 1년치를 한 번에 낸다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link, enqueue, sendConsole } from '../app/game-link';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { scenarioNow } from './scenario-app';
import { withNobleSave, setIntelSeenSource, knownNobles, markAudience, isCoreHub } from './scenario-nobles-app';
import { chronNoteWorld } from './chronicle-app';
import { domainYearLines, inciteRevolt, revealPlotsOf, setSusHook, killNoble } from './scenario-domains-app';
import { setCnPressureSource, cnActive, cnobleShake, cnRisky } from './scenario-cnobles-app';
import { setInsiderSource, healthRecord, plantRumor, harmNoble } from './scenario-health-app';
import { addDevHook } from './scenario-dev-hooks';
import { tensionNow, tensionShift } from './tension-app';
import { CR_NOBLES, CR_BONDS } from '../scenario-nobles-data';
import { D, DCARDS, DSHOP, dAdd, dRemove, dUpgrade, dUpgradable, dn, playD, injectD, nodeEst, bufCount, endTurnD, rewardOffer, chiefChance, chiefFallback, setDuelNames, type DSide, type DC, type DCard, type PlayWhyD } from '../scenario-duel';
import { reveal, bondVisible, loyalStage, shiftRel, shiftLoyal, rulerOf, type NobleRow, type NSide, type LoyalStage } from '../scenario-nobles';
import type { ScnSectorBook } from '../scenario-map';
import { FLEET_SEEN_DAYS, SUM, summitTick, FORGE, forgeQuality, forgeCatch, type Forged, type ForgeKind } from '../scenario-intel';
import { CR_MAP_SYS } from '../scenario-corridor-map-data';
import { IN, OPS, OP_KINDS, CARD, CK, type IntelSave, type OpKind, type Agent, type WeakKind, type UltChoice, type StartWhy, type Card, type CardKind, type PlayWhy, newIntelSave, fixIntelSave, makeAgent, opChance, opRisk, canStart, monthTick, pushReport, accuracy, susStage, weakFor, answerUlt, dayOf, isSupport, isOpCard, canPlay, playCard, cardCost, meetingTick, ipGain, takeOffer, buyCard, removeCard, upgradeCard, deckSize, JOBS, JOB_OF, JOB_NAME, favFood, GUARD_EDGE, PRIEST_YEAR, POISON, ACCIDENT, DOUBLE, AFFAIR, PLUS, SCOUT, COMMON, cardRar, SHOP, rollShop, rerollCost, halfOf, CEN, centralTick, readPlan, planOf, cnetOf, type Intent, FOE, foeBuild, foeGap, chiefOf, shpOf, shpRegen, duelDeck, type FoeKind, type FoeRes } from '../scenario-intel';

const KEEP = 12;
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_intel.json');
let all: Record<string, IntelSave> | null = null;
function books(): Record<string, IntelSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixIntelSave(v, ''); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_intel', error: (e as Error).message }); }
  return all;
}
function save(): void { try { const b = books(), keys = Object.keys(b); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete b[k]; const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: b })); fs.renameSync(t, file()); } catch (e) { logDiagnostic('warn', 'scenario_intel.save_failed', { error: (e as Error).message }); } }
const bookOf = (sid: string): IntelSave => (books()[sid] ??= newIntelSave(ctx.gameDate || ''));
function mine(): string | null { const s = scenarioNow(), sid = ctx.curSaveId; return s && sid && s.id === 'corridor' && s.seat === 'p' ? sid : null; }
const ready = () => !!(ctx.gameRunning && link.sessionReady);
const byId = new Map<number, NobleRow>(CR_NOBLES.map((n) => [n.id, n]));
const nobleName = (n: NobleRow): string => L(n.ko, n.en); // 고유 이름(언어 팩 대상 아님)
const agentName = (a: Agent): string => L(a.ko, a.en);
/** 공작원 초상(검은 실루엣)의 남녀 — 이름표 기준(2026-11-08). 표에 없는 이름은 번호로. */
const AGENT_F = new Set(['Lise Amaren', 'Mira Sante', 'Eda Quillon', 'Nisa Fell', 'Bess Hallow', 'Sala Onyx', 'Ilka Vern', 'Jona Kessel']);
const agentG = (a: Agent): 'f' | 'm' => (AGENT_F.has(a.en) ? 'f' : a.en ? 'm' : a.id % 2 ? 'm' : 'f');
const sideName = (x: NSide): string => scenarioNow()?.names?.[x] || (x === 'a' ? L('은하 얼라이언스', 'Galactic Alliance') : L('인류 제국', 'Human Empire'));
const loyalName = (st: LoyalStage): string => [L('충성', 'Loyal'), L('평온', 'Content'), L('불만', 'Discontent'), L('모반의 기미', 'Conspiring'), L('반란 직전', 'On the Brink')][st];
const opName = (k: OpKind): string => ({
  identify: L('신원 파악', 'Identify'), loyalty: L('충성도 탐지', 'Gauge loyalty'), ties: L('인연 캐기', 'Uncover ties'),
  bribe: L('매수', 'Bribe'), sow: L('이간질', 'Sow discord'), dirt: L('약점 캐기', 'Dig up dirt'), blackmail: L('협박', 'Blackmail'), frame: L('누명 씌우기', 'Frame'), incite: L('반란 부추기기', 'Incite rebellion'), assassinate: L('암살', 'Assassinate'),
  ins_cook: L('요리사 매수', 'Buy the cook'), ins_doctor: L('주치의 매수', 'Buy the physician'), ins_driver: L('운전수 매수', 'Buy the chauffeur'), ins_mech: L('정비사 매수', 'Buy the mechanic'),
  ins_butler: L('집사 매수', 'Buy the butler'), ins_secretary: L('비서 매수', 'Buy the secretary'), ins_guard: L('경호대장 매수', 'Buy the guard captain'), ins_treasurer: L('회계관 매수', 'Buy the treasurer'), ins_lover: L('정부 들이기', 'Plant a lover'), ins_priest: L('고해신부 매수', 'Buy the confessor'), ins_journalist: L('전속 기자 매수', 'Buy the court journalist'),
  ins_clerk: L('회사 직원 매수', 'Buy a clerk'), ins_paparazzo: L('파파라치 매수', 'Buy a paparazzo'), ins_expat: L('비자 거주자 포섭', 'Recruit a visa resident'), ins_courier: L('배달원 매수', 'Buy a courier'), ins_cleaner: L('청소부 매수', 'Buy a cleaner'),
  ins_canteen: L('사내 식당 요리사 매수', 'Buy a canteen cook'), ins_sleuth: L('인터넷 탐정 고용', 'Hire an internet sleuth'), ins_streamer: L('음모론 스트리머 매수', 'Buy a conspiracy streamer'), ins_installer: L('설치 기사 매수', 'Buy an installer'),
  poison: L('중독', 'Poison'), accident: L('사고', 'Arrange an accident'),
  warplan: L('전쟁 계획 입수', 'Steal war plans'), tipoff: L('정보 흘리기', 'Leak to the rival'), fakedoc: L('위조 문서', 'Forged dossier'), fleets: L('함대 동향', 'Fleet movements'), summit: L('정상회담 방해', 'Sabotage the summit'),
})[k];
const opDesc = (k: OpKind): string => ({
  identify: L('이 섹터 총독이 누구인지 알아냅니다. 귀족 연감에 얼굴과 이름이 드러납니다.', 'Find out who governs this sector. Their face and name appear in the peerage.'),
  loyalty: L('이 귀족이 자기 나라에 얼마나 충성하는지 정확한 수치를 알아냅니다.', 'Learn exactly how loyal this noble is to their own realm.'),
  ties: L('이 귀족의 숨은 인연(서약·협약·비밀 회선) 하나를 캐냅니다.', 'Uncover one of this noble\'s hidden ties (oath, accord or back channel).'),
  bribe: L(`에너지 ${OPS.bribe.cost}을(를) 건넵니다. 우리 쪽 친밀도가 오르고, 자기 나라 충성도가 내려갑니다.`, `Hand over ${OPS.bribe.cost} energy. Their warmth toward us rises and their loyalty to their realm falls.`),
  sow: L('이 귀족과 군주(또는 다른 귀족) 사이를 벌립니다. 군주와 틀어지면 충성도도 내려갑니다.', 'Drive a wedge between this noble and their sovereign (or another noble). A rift with the sovereign also lowers loyalty.'),
  dirt: L('빚·밀거래·추문 같은 약점을 캐냅니다. 약점 카드는 협박에 씁니다.', 'Dig up a weakness — debts, smuggling, a scandal. The card is used for blackmail.'),
  blackmail: L('약점 카드를 들이밀어 밀사 통로를 억지로 엽니다. 대신 이 귀족은 우리를 크게 미워하게 됩니다.', 'Use the weakness card to force a secret channel open. The noble will resent us deeply.'),
  frame: L('위조 문서로 이 귀족이 군주의 의심을 받게 합니다. 들키면 모함이 드러나 큰일이 납니다.', 'Forged papers put this noble under their sovereign\'s suspicion. If caught, the frame-up becomes a scandal.'),
  incite: L(`충성도가 ${IN.incite} 아래인 귀족을 부추겨 실제 반란을 일으킵니다. 섹터가 떨어져 나가 새 나라가 됩니다. 들키면 큰 사건이 됩니다.`, `Push a noble whose loyalty is below ${IN.incite} into open rebellion. The sector breaks away as a new nation. If caught, it becomes a major incident.`),
  ins_cook: L(`에너지 ${OPS.ins_cook.cost}(으)로 이 귀족의 요리사를 삽니다. 좋아하는 음식과 식사 습관을 알게 되고(접견 대접), 뒤에 중독 공작의 길이 열립니다.`, `Spend ${OPS.ins_cook.cost} energy to buy this noble's cook. Learn their favorite dish and habits (for hosting audiences), and later open the way to poisoning.`),
  ins_doctor: L(`에너지 ${OPS.ins_doctor.cost}(으)로 이 귀족의 주치의를 삽니다. 소문이 아닌 진짜 건강(수치·지병·쌓인 독)을 알게 됩니다. 어렵고 비쌉니다.`, `Spend ${OPS.ins_doctor.cost} energy to buy this noble's physician. Learn their true health — the figure, any illness, accumulated poison — not just rumor. Hard and costly.`),
  ins_driver: L(`에너지 ${OPS.ins_driver.cost}(으)로 이 귀족의 운전수를 삽니다. 이동 일정과 일상을 알게 되어 건강을 더 정확히 짐작하고, 뒤에 사고 공작과 리무진 회담의 길이 열립니다.`, `Spend ${OPS.ins_driver.cost} energy to buy this noble's chauffeur. Their schedule and daily life sharpen our read of their health, and later open the way to accidents and limousine meetings.`),
  ins_mech: L(`에너지 ${OPS.ins_mech.cost}(으)로 이 귀족의 함선·차량 정비사를 삽니다. 정비 기록을 손에 넣고, 뒤에 사고 공작의 성공률을 올립니다.`, `Spend ${OPS.ins_mech.cost} energy to buy the mechanic who maintains this noble's ships and vehicles. Obtain the maintenance logs; later raises the odds of an accident.`),
  ins_butler: L(`에너지 ${OPS.ins_butler.cost}(으)로 이 귀족의 집사를 삽니다. 저택의 일상과 손님 명단으로 건강을 관찰하고, 숨은 인연 하나를 알아냅니다. 뒤에 저택 회담에서 문서를 엿볼 수 있습니다.`, `Spend ${OPS.ins_butler.cost} energy to buy this noble's butler. The household routine and guest list let us observe their health and reveal one hidden tie. Later, peek at papers during manor meetings.`),
  ins_secretary: L(`에너지 ${OPS.ins_secretary.cost}(으)로 이 귀족의 비서를 삽니다. 오간 서신에서 이 귀족이 얽힌 반란 밀약을 들춰냅니다.`, `Spend ${OPS.ins_secretary.cost} energy to buy this noble's secretary. Their correspondence exposes any rebel conspiracy the noble is part of.`),
  ins_guard: L(`에너지 ${OPS.ins_guard.cost}(으)로 이 귀족의 경호대장을 삽니다. 경호의 빈틈을 알게 되어 이 귀족 암살 성공률이 +${GUARD_EDGE} 오릅니다. 어렵고 비쌉니다.`, `Spend ${OPS.ins_guard.cost} energy to buy this noble's guard captain. Knowing the gaps in their protection raises assassination odds against them by +${GUARD_EDGE}. Hard and costly.`),
  ins_treasurer: L(`에너지 ${OPS.ins_treasurer.cost}(으)로 이 귀족의 회계관을 삽니다. 장부에서 약점을 찾아 약점 카드를 얻습니다(협박에 씀).`, `Spend ${OPS.ins_treasurer.cost} energy to buy this noble's treasurer. The ledgers yield a weakness card (for blackmail).`),
  ins_lover: L(`에너지 ${OPS.ins_lover.cost}(으)로 이 귀족 곁에 우리 쪽 정부를 들입니다. 속마음 — 자기 나라에 대한 정확한 충성을 알게 되고, 베갯머리 말로 충성이 조금 흔들립니다. 혼약한 귀족이면 불륜이 됩니다: 추문 약점 카드가 생기고 협박 성공 +${AFFAIR.blackmail}, 전속 기자로 터뜨리면 배우자와 원수가 되고 군주의 눈 밖에 납니다.`, `Spend ${OPS.ins_lover.cost} energy to place a lover of ours at this noble's side. Learn their true loyalty to their realm, and pillow talk shakes it a little. If the noble is in a Union, it becomes an affair: a scandal weakness card, +${AFFAIR.blackmail} to blackmail, and if a court journalist breaks it, the spouse turns enemy and the sovereign turns cold.`),
  ins_priest: L(`에너지 ${OPS.ins_priest.cost}(으)로 이 귀족의 고해신부를 삽니다. 양심을 건드리는 말로, 해마다 자기 나라에 대한 충성이 ${-PRIEST_YEAR}씩 흔들립니다.`, `Spend ${OPS.ins_priest.cost} energy to buy this noble's confessor. Words that prick the conscience shake their loyalty to their realm by ${-PRIEST_YEAR} every year.`),
  ins_journalist: L(`에너지 ${OPS.ins_journalist.cost}(으)로 이 귀족의 전속 기자를 삽니다. 건강설과 추문을 퍼뜨려 군주와의 사이를 벌리고, 소문 속 건강을 나쁘게 보이게 합니다.`, `Spend ${OPS.ins_journalist.cost} energy to buy this noble's court journalist. Spread health rumors and scandal: their sovereign cools toward them, and the rumor mill paints them as ailing.`),
  ins_clerk: L(`에너지 ${OPS.ins_clerk.cost}(으)로 이 귀족 회사의 평직원을 삽니다. 사내 소문이 들어와 이 섹터 정보망이 ${COMMON.clerkNet} 오릅니다.`, `Spend ${OPS.ins_clerk.cost} energy on a junior clerk at this noble's company. Office gossip raises the network here by ${COMMON.clerkNet}.`),
  ins_paparazzo: L(`에너지 ${OPS.ins_paparazzo.cost}(으)로 이 귀족을 쫓는 길거리 파파라치를 삽니다. 이 귀족의 약점 캐기 성공률 +${COMMON.papDirt}.`, `Spend ${OPS.ins_paparazzo.cost} energy on a street paparazzo who tails this noble. Digging up dirt on them gains +${COMMON.papDirt} success.`),
  ins_expat: L(`에너지 ${OPS.ins_expat.cost}(으)로 이 섹터에 사는 비자 거주자를 포섭합니다. 해마다 연례 회의 때 이 섹터 정보망 +${COMMON.expatNet}.`, `Spend ${OPS.ins_expat.cost} energy to recruit a visa resident living in this sector. Each yearly meeting, the network here +${COMMON.expatNet}.`),
  ins_courier: L(`에너지 ${OPS.ins_courier.cost}(으)로 저택을 드나드는 배달원을 삽니다. 이 귀족을 노리는 모든 작전의 발각률 −${COMMON.courierRisk}.`, `Spend ${OPS.ins_courier.cost} energy on a courier who visits the manor. All missions against this noble get −${COMMON.courierRisk} detection.`),
  ins_cleaner: L(`에너지 ${OPS.ins_cleaner.cost}(으)로 저택 청소부를 삽니다. ${Math.round(COMMON.cleanerWeak * 100)}% 확률로 휴지통에서 약점을 건집니다.`, `Spend ${OPS.ins_cleaner.cost} energy on the manor's cleaner. ${Math.round(COMMON.cleanerWeak * 100)}% chance to fish a weakness out of the wastebaskets.`),
  ins_canteen: L(`에너지 ${OPS.ins_canteen.cost}(으)로 귀족 회사 사내 식당의 요리사를 삽니다. 점심시간 수다를 엿들어 ${Math.round(COMMON.canteenTie * 100)}% 확률로 숨은 인연 하나가 드러납니다.`, `Spend ${OPS.ins_canteen.cost} energy on the cook at this noble's company canteen. Overheard lunch talk: ${Math.round(COMMON.canteenTie * 100)}% chance to reveal a hidden tie.`),
  ins_sleuth: L(`에너지 ${OPS.ins_sleuth.cost}(으)로 인터넷 탐정을 고용합니다. 흩어진 게시물을 엮어 ${Math.round(COMMON.sleuthLoyal * 100)}% 확률로 이 귀족의 정확한 충성을 알아냅니다.`, `Spend ${OPS.ins_sleuth.cost} energy to hire an internet sleuth. Piecing scattered posts together: ${Math.round(COMMON.sleuthLoyal * 100)}% chance to learn this noble's exact loyalty.`),
  ins_streamer: L(`에너지 ${OPS.ins_streamer.cost}(으)로 음모론 스트리머를 삽니다. 이 귀족에 대한 건강설이 돌고, 군주와의 사이가 ${COMMON.streamerRel} 벌어집니다.`, `Spend ${OPS.ins_streamer.cost} energy on a conspiracy streamer. Health rumors about this noble spread, and their sovereign's regard drops ${COMMON.streamerRel}.`),
  ins_installer: L(`에너지 ${OPS.ins_installer.cost}(으)로 저택에 장비를 놓는 설치 기사를 삽니다. 몰래 단 도청기로 이 귀족에 대한 정찰(신원·충성·인연 파악) 성공률 +${COMMON.installerRecon}.`, `Spend ${OPS.ins_installer.cost} energy on the installer who services the manor. A hidden bug gives +${COMMON.installerRecon} success to recon on this noble (identity, loyalty, ties).`),
  poison: L(`매수한 요리사를 시켜 음식에 독을 탑니다. 건강이 ${POISON.hurt[0]}~${POISON.hurt[1]} 줄고 독이 쌓입니다(쌓인 단계마다 해마다 건강 −5). 여러 번 겹칠 수 있고 잘 들키지 않습니다. 주치의까지 사 두면 더 안 들키고, 끝내 죽어도 병사로 기록됩니다. 요리사 매수가 필요합니다.`, `Have our bought cook slip poison into their food. Health drops by ${POISON.hurt[0]}–${POISON.hurt[1]} and poison accumulates (−5 health per stage each year). Stackable and hard to detect. With the physician bought too, detection drops further and a death is recorded as illness. Requires the cook.`),
  accident: L(`비행 리무진이나 함선에 「사고」를 꾸밉니다. 성공하면 대개 즉사하지만 ${Math.round(ACCIDENT.survive * 100)}%는 살아남아 건강이 ${ACCIDENT.hurt} 줄어듭니다. 정비사가 있으면 성공률 +${ACCIDENT.mechEdge}, 운전수·정비사마다 발각 −${ACCIDENT.insRisk}. 운전수나 정비사 매수가 필요하고, 큰 가문(4대 가문)에는 쓸 수 없습니다.`, `Stage an "accident" with their flying limousine or ship. Success is usually fatal, but ${Math.round(ACCIDENT.survive * 100)}% survive with −${ACCIDENT.hurt} health. The mechanic adds +${ACCIDENT.mechEdge} success; the chauffeur and mechanic each cut detection by ${ACCIDENT.insRisk}. Requires the chauffeur or mechanic; not usable on the four great houses.`),
  assassinate: L('이 귀족을 암살합니다. 성공하면 영구히 죽고, 영지는 군주 직할이 됩니다. 성공은 어렵고 들키기 쉬우며, 들키면 그 나라와의 긴장이 크게 오르고 최후통첩이 거의 확실합니다. 큰 가문(4대 가문)에는 쓸 수 없습니다.', 'Assassinate this noble. On success they die permanently and the domain passes to the crown. Success is hard and detection likely; if caught, tension with that power soars and an ultimatum is all but certain. Not usable on the four great houses.'),
  warplan: L(`그 나라 수도 섹터에서 정부 문서를 빼냅니다(중앙 정보망 ${OPS.warplan.need} 필요). 상대 강대국을 어떻게 보는지(공격 준비·방어·관망), 두 강대국 사이 긴장, 회랑과의 긴장, 다음 적 공작이 이 나라에서 오는지를 1년 동안 정확히 압니다.`, `Lift government papers in that power's capital sector (central network ${OPS.warplan.need}). For a year you know exactly how it views the rival power (attack, defend or wait), the great-power tension, its tension with us, and whether the next enemy operation comes from it.`),
  fleets: L(`그 나라 수도 섹터에서 함대 사령부의 배치표를 빼냅니다(중앙 정보망 ${OPS.fleets.need} 필요). 그 나라 군 함대마다 있는 곳과 전력을 첩보 지도에 반 년 동안 표시합니다. 게임에서 그 순간의 배치를 한 번 읽습니다.`, `Steals the fleet command's deployment chart from the capital sector (central network ${OPS.fleets.need}). Every military fleet's position and strength is marked on the espionage map for half a year. The game is read once, at that moment.`),
  summit: L(`예고된 두 강대국 정상회담을 깨뜨립니다(중앙 정보망 ${OPS.summit.need} 필요, 회담이 예고됐을 때만). 그 나라 대표단의 일정·경호·의전을 흔들어 회담이 결렬되게 만듭니다. 성공하면 회담 날 긴장이 오르고(+${SUM.breakTn}), 그냥 두면 회담이 열려 긴장이 크게 풀립니다(${SUM.calmTn}). 들키면 크게 의심받습니다.`, `Breaks up an announced great-power summit (central network ${OPS.summit.need}, only while a summit is announced). Disrupt that delegation's schedule, security and protocol until the talks collapse. On success tension rises on the summit day (+${SUM.breakTn}); left alone, the summit is held and tension falls sharply (${SUM.calmTn}). Exposure draws heavy suspicion.`),
  tipoff: L(`입수한 그 나라의 전쟁 계획을 상대 강대국에 몰래 넘깁니다(중앙 정보망 ${OPS.tipoff.need} · 전쟁 계획 필요). 받은 나라는 회랑을 덜 의심하고(의심 −${CEN.tipThanks.sus} · 긴장 −${CEN.tipThanks.hostile}), 계획이 공격 준비였다면 두 강대국 사이 긴장 +${CEN.tipTn.atk}, 아니었다면 ${CEN.tipTn.calm}. 들키면 흘린 나라가 크게 의심합니다.`, `Secretly pass that power's war plans to its rival (central network ${OPS.tipoff.need}; needs the war plans). The receiver trusts us more (suspicion −${CEN.tipThanks.sus}, tension with us −${CEN.tipThanks.hostile}); if the plans showed an attack, great-power tension +${CEN.tipTn.atk}, otherwise ${CEN.tipTn.calm}. If caught, the leaked power grows very suspicious.`),
  fakedoc: L(`「상대가 공격을 준비한다」거나 「상대는 싸울 뜻이 없다」는 가짜 문서를 그 나라 정부에 흘립니다(중앙 정보망 ${OPS.fakedoc.need}). 두 강대국 사이 긴장 ±${CEN.fakeTn}(강화 ±${CEN.fakeTn + CEN.fakePlus}). 들키면 두 나라 모두 회랑을 의심합니다.`, `Feed that government a fake dossier: "the rival is preparing to strike" or "the rival has no will to fight" (central network ${OPS.fakedoc.need}). Great-power tension ±${CEN.fakeTn} (upgraded ±${CEN.fakeTn + CEN.fakePlus}). If caught, both powers suspect the Corridor.`),
})[k];
const weakName = (k: WeakKind): string => ({ debt: L('갚지 못한 빚', 'Unpaid debts'), smuggle: L('밀거래 장부', 'Smuggling ledgers'), scandal: L('감춰 둔 추문', 'A buried scandal'), cruelty: L('영지민 학대 기록', 'Records of cruelty to their subjects'), letters: L('상대 진영과 오간 서신', 'Letters to the rival camp') })[k];
const WEAK_KO: Record<WeakKind, [string, string]> = { debt: ['갚지 못한 빚', 'unpaid debts'], smuggle: ['밀거래 장부', 'smuggling ledgers'], scandal: ['감춰 둔 추문', 'a buried scandal'], cruelty: ['영지민 학대 기록', 'records of cruelty to their subjects'], letters: ['상대 진영과 오간 서신', 'letters to the rival camp'] };
const susName = (st: number): string => [L('평온', 'Calm'), L('경계', 'Wary'), L('감찰', 'Inspection'), L('최후통첩', 'Ultimatum')][st] || '';
const whyText = (w: StartWhy): string => ({ '': '', agent: L('공작원을 찾지 못했습니다.', 'Operative not found.'), busy: L('이미 작전 중입니다.', 'Already on a mission.'), net: L('정보망이 부족합니다.', 'The network is too weak.'), dup: L('같은 작전이 이미 진행 중입니다.', 'The same mission is already under way.'), place: L('그 섹터에 배치된 공작원만 작전을 걸 수 있습니다.', 'Only an operative posted to that sector can run it.'), card: L('먼저 약점 카드가 있어야 합니다.', 'You need a weakness card first.'), have: L('이미 약점 카드를 쥐고 있습니다.', 'You already hold a weakness card.'), loyal: L(`충성도가 ${IN.incite} 아래여야 합니다(충성도 탐지로 확인).`, `Loyalty must be below ${IN.incite} (check with Gauge loyalty).`), core: L('수도 섹터에 든 거점이라 떨어져 나갈 섹터가 없습니다.', 'This hub sits in the capital sector; there is no sector to break away.'), gone: L('이미 떨어져 나간 귀족입니다.', 'This noble has already broken away.'), with: L('이간질할 상대를 고르세요.', 'Choose whom to set them against.'), hired: L('이 귀족 곁에 이미 그 내부자가 있습니다.', 'We already have that insider beside this noble.'), nocook: L('먼저 이 귀족의 요리사를 매수해야 합니다.', 'Buy this noble\'s cook first.'), noride: L('먼저 이 귀족의 운전수나 정비사를 매수해야 합니다.', 'Buy this noble\'s chauffeur or mechanic first.'), notcore: L('그 나라 수도 섹터에 잠입한 공작원만 정부를 노릴 수 있습니다.', 'Only an operative in that power\'s capital sector can reach its government.'), cnet: L('그 나라 중앙 정보망이 부족합니다. 수도 섹터에 공작원을 오래 두세요.', 'The central network in that power is too weak. Keep operatives in its capital sector.'), noplan: L('먼저 「전쟁 계획 입수」로 그 나라 계획을 손에 넣어야 합니다.', 'Steal that power\'s war plans first.'), nosummit: L('예고된 정상회담이 없거나 이미 손을 썼습니다.', 'No summit is announced, or it is already sabotaged.') })[w];
const opCmd = (s: NSide, m: 'caught' | 'exposed' | 'refuse' | 'hand' | 'pay') => enqueue(() => sendConsole(`effect sllm_cr_intel_op = { S = ${s} M = ${m} }`));
/** 옛 방첩 카드 문구용 수치(카드 대결 1·2판 — 이제 대전 카드로 바뀌어 본 덱에서는 빠짐) */
const COUNTER: Record<string, number> = { sweep: 10, firewall: 15, redund: 30, hide: 20, disinfo: 30, trap: 10, plus: 10 };
// ---- 카드 문구(2026-11-07) ----
const cardName = (k: CardKind): string => (isOpCard(k) ? opName(k) : ({
  plant: L('연줄 심기', 'Plant contacts'), scout: L('내부자 탐색', 'Insider search'), sweep: L('방첩 수색', 'Counter-sweep'), hide: L('잠적', 'Go dark'), disinfo: L('역정보', 'Disinformation'), trap: L('함정', 'Trap'), seal: L('봉쇄', 'Lockdown'), firewall: L('방화벽', 'Firewall'), redund: L('이중화', 'Redundancy'), quarantine: L('격리', 'Quarantine'), forge: L('위조 신분증', 'Forged papers'), lurk: L('잠복', 'Lie low'), escape: L('도주로', 'Escape route'), rush: L('급행', 'Rush job'),
  weak: L('약점', 'Weakness'), watch: L('감시 중', 'Under watch'), leak: L('누설', 'Leak'),
} as Record<string, string>)[k]);
const cardDesc = (k: CardKind, plus = false): string => {
  if (k === 'bribe' && plus) return L(`에너지 ${OPS.bribe.cost}을(를) 건넵니다. 우리 쪽 친밀도 +25, 자기 나라 충성도 −12.`, `Hand over ${OPS.bribe.cost} energy. Warmth toward us +25, loyalty to their realm −12.`);
  if (k === 'sow' && plus) return L('이 귀족과 군주(또는 다른 귀족) 사이를 크게 벌립니다. 군주와 틀어지면 충성도 −10.', 'Drive a deep wedge between this noble and their sovereign (or another noble). A rift with the sovereign lowers loyalty by 10.');
  if (k === 'forge' && plus) return L(`함께 내는 작전의 성공률 +${CK.forgeChance + 10}.`, `The mission it accompanies gains +${CK.forgeChance + 10} success.`);
  if (isOpCard(k)) return opDesc(k);
  return ({
    plant: L(`공작원이 있는 섹터의 정보망을 바로 ${CK.plantNet} 올립니다.`, `Instantly raise the network in the operative's sector by ${CK.plantNet}.`),
    scout: plus ? L(`공작원이 귀족 주변 사람들을 살펴 매수할 만한 사람을 반드시 한 명 찾습니다. 직업은 무작위인 내부자 카드 한 장이 손패에 들어옵니다(일반 ${SCOUT.tier.c}% · 고급 ${SCOUT.tier.u}% · 희귀 ${SCOUT.tier.r}%). 이 카드는 다시 덱으로 돌아갑니다.`, `Your operative studies the people around nobles and always finds one who can be bought. A random insider card enters your hand (common ${SCOUT.tier.c}%, uncommon ${SCOUT.tier.u}%, rare ${SCOUT.tier.r}%). This card returns to the deck.`)
      : L(`공작원이 귀족 주변 사람들을 살핍니다. ${SCOUT.chance}% 확률로 매수할 만한 사람을 찾아, 직업은 무작위인 내부자 카드 한 장이 손패에 들어옵니다(일반 ${SCOUT.tier.c}% · 고급 ${SCOUT.tier.u}% · 희귀 ${SCOUT.tier.r}%). 이 카드는 다시 덱으로 돌아갑니다.`, `Your operative studies the people around nobles. ${SCOUT.chance}% chance to find someone who can be bought: a random insider card enters your hand (common ${SCOUT.tier.c}%, uncommon ${SCOUT.tier.u}%, rare ${SCOUT.tier.r}%). This card returns to the deck.`),
    sweep: L(`[어디든] 적 카드 한 칸에 냅니다. 공격이면 피해, 임무면 성공률 −${COUNTER.sweep + (plus ? COUNTER.plus : 0)}, 그 칸의 엎어 둔 카드와 미끼를 드러내고, 공작을 건 귀족의 정체를 밝힙니다.`, `[Any slot] Play on one enemy card: attack damage or mission odds −${COUNTER.sweep + (plus ? COUNTER.plus : 0)}, reveal that slot's face-down card and decoy, and unmask the noble behind it.`),
    hide: L(`[첩보 방어] 침투 임무 한 칸에 냅니다. 표적을 숨겨 성공률 −${COUNTER.hide + (plus ? COUNTER.plus : 0)}.`, `[Counter-espionage] Play on one infiltration mission. Hide the target: success −${COUNTER.hide + (plus ? COUNTER.plus : 0)}.`),
    disinfo: L(`[첩보 방어] 침투 임무 한 칸에 냅니다. 거짓 정보를 흘려 성공률 −${COUNTER.disinfo + (plus ? COUNTER.plus : 0)}.`, `[Counter-espionage] Play on one infiltration mission. Feed them false leads: success −${COUNTER.disinfo + (plus ? COUNTER.plus : 0)}.`),
    trap: L(`[첩보 방어] 침투 임무 한 칸에 냅니다. 성공률 −${COUNTER.trap + (plus ? COUNTER.plus : 0)}. 그 칸이 막히면 적 공작원을 붙잡아, 공작을 건 귀족의 정체와 약점을 쥡니다.`, `[Counter-espionage] Play on one infiltration mission. Success −${COUNTER.trap + (plus ? COUNTER.plus : 0)}. If that card is blocked, we catch their operative: the noble behind it is unmasked and we hold their weakness.`),
    seal: L('[첩보 방어] 침투 임무 한 칸을 완전히 막습니다(성공률 0%). 다만 그 칸에 역함정이 있으면 무효가 됩니다.', '[Counter-espionage] Completely blocks one infiltration mission (0%) — unless a counter-trap sits behind it.'),
    firewall: L(`[순수 방어] 공격 카드 한 칸의 피해 −${COUNTER.firewall + (plus ? COUNTER.plus : 0)}.`, `[Pure defense] One attack card deals −${COUNTER.firewall + (plus ? COUNTER.plus : 0)} damage.`),
    redund: L(`[순수 방어] 공격 카드 한 칸의 피해 −${COUNTER.redund + (plus ? COUNTER.plus : 0)}.`, `[Pure defense] One attack card deals −${COUNTER.redund + (plus ? COUNTER.plus : 0)} damage.`),
    quarantine: L('[순수 방어] 공격 카드 한 칸을 완전히 막습니다(피해 0). 그 칸에 역함정이 있으면 무효.', '[Pure defense] Completely blocks one attack card (0 damage) — unless a counter-trap sits behind it.'),
    forge: L(`함께 내는 작전의 성공률 +${CK.forgeChance}.`, `The mission it accompanies gains +${CK.forgeChance} success.`),
    lurk: L(`함께 내는 작전의 발각률 −${CK.lurkRisk}.`, `The mission it accompanies has −${CK.lurkRisk} detection.`),
    escape: L('함께 내는 작전이 발각돼도 공작원이 붙잡히지 않습니다.', 'If the mission it accompanies is detected, the operative still escapes.'),
    rush: L('함께 내는 작전의 기간이 절반이 됩니다.', 'The mission it accompanies takes half the time.'),
    weak: L('약점 캐기로 얻은 카드입니다. 낼 수 없습니다. 손에 있으면 그 귀족 협박 비용 −1. 협박에 성공하면 사라집니다.', 'Gained by digging up dirt. Cannot be played. While in hand, blackmailing that noble costs 1 less. Used up by a successful blackmail.'),
    watch: L(`손에 있으면 연례 회의 때 첩보력이 ${CK.watchCut} 덜 찹니다. 첩보력 1로 내서 지울 수 있습니다.`, `While in hand, the yearly meeting grants ${CK.watchCut} less intel. Pay 1 to play it and remove it.`),
    leak: L(`손에 있으면 모든 작전 발각률 +${CK.leakRisk}. 첩보력 2로 내서 지울 수 있습니다.`, `While in hand, every mission has +${CK.leakRisk} detection. Pay 2 to play it and remove it.`),
  } as Record<string, string>)[k];
};
/** 카드에 바로 적는 짧은 설명(2026-11-08 사용자: 「슬레이 더 스파이어처럼 — 설명이 카드에 적혀 있게」). 긴 설명은 카드 툴팁·오른쪽 판에. */
const cardShort = (k: CardKind, plus = false): string => ({
  identify: L('이 섹터 총독의 정체를 알아낸다.', 'Reveal who governs this sector.'),
  loyalty: L('이 귀족의 정확한 충성을 알아낸다.', 'Learn this noble\'s exact loyalty.'),
  ties: L('숨은 인연 하나를 캐낸다. 밀약이 드러나기도 한다.', 'Uncover a hidden tie; may expose plots.'),
  plant: L(`이 섹터 정보망 +${CK.plantNet}.`, `Network here +${CK.plantNet}.`),
  sweep: L(`방첩(어디든). −${COUNTER.sweep + (plus ? COUNTER.plus : 0)}, 칸을 뒤집고 배후를 밝힌다.`, `Counter (any slot): −${COUNTER.sweep + (plus ? COUNTER.plus : 0)}, flip the slot, unmask them.`),
  hide: L(`첩보 방어. 표적을 숨겨 임무 성공률 −${COUNTER.hide + (plus ? COUNTER.plus : 0)}.`, `Counter-espionage: hide the target, mission −${COUNTER.hide + (plus ? COUNTER.plus : 0)}.`),
  disinfo: L(`첩보 방어. 거짓 정보로 임무 성공률 −${COUNTER.disinfo + (plus ? COUNTER.plus : 0)}.`, `Counter-espionage: false leads, mission −${COUNTER.disinfo + (plus ? COUNTER.plus : 0)}.`),
  trap: L(`첩보 방어. 임무 성공률 −${COUNTER.trap + (plus ? COUNTER.plus : 0)}. 실패하면 적 공작원을 붙잡는다.`, `Counter-espionage: mission −${COUNTER.trap + (plus ? COUNTER.plus : 0)}. If it fails, catch their agent.`),
  seal: L('첩보 방어. 임무 한 칸을 완전히 막는다.', 'Counter-espionage: fully block one mission.'),
  firewall: L(`순수 방어. 공격 피해 −${COUNTER.firewall + (plus ? COUNTER.plus : 0)}.`, `Pure defense: attack −${COUNTER.firewall + (plus ? COUNTER.plus : 0)} dmg.`),
  redund: L(`순수 방어. 공격 피해 −${COUNTER.redund + (plus ? COUNTER.plus : 0)}.`, `Pure defense: attack −${COUNTER.redund + (plus ? COUNTER.plus : 0)} dmg.`),
  quarantine: L('순수 방어. 공격 한 칸을 완전히 막는다.', 'Pure defense: fully block one attack.'),
  scout: plus ? L('내부자 카드 1장을 반드시 얻는다(직업 무작위).', 'Always gain 1 insider card (random job).') : L(`${SCOUT.chance}% 확률로 내부자 카드 1장(직업 무작위).`, `${SCOUT.chance}%: gain 1 insider card (random job).`),
  bribe: plus ? L('에너지 500. 우리 쪽 친밀 +25, 충성 −12.', '500 energy. Warmth +25, loyalty −12.') : L('에너지 500. 우리 쪽 친밀 +15, 충성 −8.', '500 energy. Warmth +15, loyalty −8.'),
  sow: plus ? L('군주나 다른 귀족과 사이를 크게 벌린다. 충성 −10.', 'Drive a deep wedge. Loyalty −10.') : L('군주나 다른 귀족과 사이를 벌린다. 충성 −6.', 'Drive a wedge. Loyalty −6.'),
  dirt: L('약점 카드를 얻는다(협박용).', 'Gain a weakness card (for blackmail).'),
  blackmail: L('약점으로 밀사 통로를 억지로 연다. 대신 깊이 미움받는다.', 'Force a secret channel open. They will hate us.'),
  frame: L('위조 문서로 군주의 의심을 받게 한다. 충성 −10.', 'Forged papers bring the sovereign\'s suspicion. Loyalty −10.'),
  incite: L(`충성 ${IN.incite} 미만 귀족을 반란시킨다. 섹터가 떨어져 나간다.`, `Push a noble under ${IN.incite} loyalty into revolt.`),
  assassinate: plus ? L(`즉사. 발각 −${PLUS.assnRisk}. 정보망이 낮을수록 실패. 4대 가문 불가.`, `Instant death. Detection −${PLUS.assnRisk}. Weak network fails. Not great houses.`) : L('즉사. 정보망이 낮을수록 실패·발각. 4대 가문 불가.', 'Instant death. Weak network: fails, gets caught. Not great houses.'),
  poison: plus ? L(`건강 −${POISON.hurt[0] + PLUS.poisonHurt}~${POISON.hurt[1] + PLUS.poisonHurt}, 독이 쌓인다. 잘 안 들킨다. 요리사 필요.`, `Health −${POISON.hurt[0] + PLUS.poisonHurt}–${POISON.hurt[1] + PLUS.poisonHurt}, poison builds. Subtle. Needs the cook.`) : L(`건강 −${POISON.hurt[0]}~${POISON.hurt[1]}, 독이 쌓인다. 잘 안 들킨다. 요리사 필요.`, `Health −${POISON.hurt[0]}–${POISON.hurt[1]}, poison builds. Subtle. Needs the cook.`),
  accident: plus ? L(`대개 즉사(${Math.round(ACCIDENT.survive * 50)}%만 중상). 운전수나 정비사 필요.`, `Usually fatal (only ${Math.round(ACCIDENT.survive * 50)}% survive). Needs chauffeur or mechanic.`) : L(`대개 즉사(${Math.round(ACCIDENT.survive * 100)}%는 중상). 운전수나 정비사 필요.`, `Usually fatal (${Math.round(ACCIDENT.survive * 100)}% survive hurt). Needs chauffeur or mechanic.`),
  ins_cook: L('요리사를 산다. 좋아하는 음식을 알고 중독이 열린다.', 'Buy the cook: favorite dish; opens poisoning.'),
  ins_doctor: L('주치의를 산다. 진짜 건강·지병·독을 본다.', 'Buy the physician: true health, illness, poison.'),
  ins_driver: L('운전수를 산다. 건강 관찰, 사고·리무진이 열린다.', 'Buy the chauffeur: observe health; opens accidents, limousine.'),
  ins_mech: L(`정비사를 산다. 사고 성공 +${ACCIDENT.mechEdge}.`, `Buy the mechanic: accident odds +${ACCIDENT.mechEdge}.`),
  ins_butler: L('집사를 산다. 건강 관찰, 숨은 인연, 저택 서류.', 'Buy the butler: observe health, a hidden tie, manor papers.'),
  ins_secretary: L('비서를 산다. 반란 밀약을 들춰낸다.', 'Buy the secretary: expose rebel plots.'),
  ins_guard: L(`경호대장을 산다. 이 귀족 암살 +${GUARD_EDGE}.`, `Buy the guard captain: assassination +${GUARD_EDGE}.`),
  ins_treasurer: L('회계관을 산다. 장부에서 약점 카드.', 'Buy the treasurer: a weakness card from the ledgers.'),
  ins_lover: L('정부를 들인다. 속마음, 충성 −5. 혼약이면 불륜 — 추문.', 'Plant a lover: true loyalty, −5. If wed: an affair, a scandal.'),
  ins_priest: L(`고해신부를 산다. 해마다 충성 ${PRIEST_YEAR}.`, `Buy the confessor: loyalty ${PRIEST_YEAR} each year.`),
  ins_journalist: L('기자를 산다. 군주와 사이 −10, 건강설. 불륜을 터뜨린다.', 'Buy the journalist: sovereign −10, health rumors; breaks affairs.'),
  ins_clerk: L(`회사 직원. 이 섹터 정보망 +${COMMON.clerkNet}.`, `Company clerk: network here +${COMMON.clerkNet}.`),
  ins_paparazzo: L(`파파라치. 약점 캐기 +${COMMON.papDirt}.`, `Paparazzo: dig up dirt +${COMMON.papDirt}.`),
  ins_expat: L(`비자 거주자. 해마다 정보망 +${COMMON.expatNet}.`, `Visa resident: network +${COMMON.expatNet} each year.`),
  ins_courier: L(`배달원. 이 귀족 상대 발각 −${COMMON.courierRisk}.`, `Courier: −${COMMON.courierRisk} detection vs this noble.`),
  ins_cleaner: L(`청소부. ${Math.round(COMMON.cleanerWeak * 100)}% 확률로 약점.`, `Cleaner: ${Math.round(COMMON.cleanerWeak * 100)}% chance of a weakness.`),
  ins_canteen: L(`사내 식당 요리사. ${Math.round(COMMON.canteenTie * 100)}% 확률로 숨은 인연.`, `Canteen cook: ${Math.round(COMMON.canteenTie * 100)}% chance of a hidden tie.`),
  ins_sleuth: L(`인터넷 탐정. ${Math.round(COMMON.sleuthLoyal * 100)}% 확률로 충성 파악.`, `Internet sleuth: ${Math.round(COMMON.sleuthLoyal * 100)}% chance to learn loyalty.`),
  ins_streamer: L(`음모론 스트리머. 건강설, 군주와 사이 ${COMMON.streamerRel}.`, `Conspiracy streamer: health rumors, ruler regard ${COMMON.streamerRel}.`),
  ins_installer: L(`설치 기사. 이 귀족 정찰 +${COMMON.installerRecon}.`, `Installer: recon on this noble +${COMMON.installerRecon}.`),
  forge: L(`함께 내는 작전 성공 +${CK.forgeChance + (plus ? 10 : 0)}.`, `Paired mission success +${CK.forgeChance + (plus ? 10 : 0)}.`),
  warplan: L('수도 섹터에서. 그 나라의 속내·긴장·다음 적 공작을 1년간 안다.', 'Capital sector: learn its intent, tensions and next strike for a year.'),
  fleets: L('수도 섹터에서. 그 나라 군 함대의 위치·전력을 반 년간 지도에.', 'Capital sector: chart its military fleets on the map for half a year.'),
  summit: L('수도 섹터에서, 회담이 예고됐을 때만. 회담을 결렬시킨다.', 'Capital sector, only while a summit is announced: make the talks collapse.'),
  tipoff: L(`수도 섹터에서. 전쟁 계획을 상대 강대국에 넘긴다 — 그쪽 의심 −${CEN.tipThanks.sus}.`, `Capital sector: hand its war plans to the rival — their suspicion −${CEN.tipThanks.sus}.`),
  fakedoc: L(`수도 섹터에서. 두 강대국 사이 긴장 ±${CEN.fakeTn + (plus ? CEN.fakePlus : 0)}.`, `Capital sector: great-power tension ±${CEN.fakeTn + (plus ? CEN.fakePlus : 0)}.`),
  lurk: L(`함께 내는 작전 발각 −${CK.lurkRisk}.`, `Paired mission detection −${CK.lurkRisk}.`),
  escape: L('들켜도 공작원이 붙잡히지 않는다.', 'If detected, the operative escapes.'),
  rush: L('함께 내는 작전 기간 절반.', 'Paired mission takes half the time.'),
  weak: L('협박 비용 −1. 혼자 낼 수 없다.', 'Blackmail costs 1 less. Cannot be played.'),
  watch: L(`손에 있으면 첩보력 충전 −${CK.watchCut}. 1로 내서 지운다.`, `In hand: intel refill −${CK.watchCut}. Pay 1 to discard.`),
  leak: L(`손에 있으면 발각 +${CK.leakRisk}. 2로 내서 지운다.`, `In hand: detection +${CK.leakRisk}. Pay 2 to discard.`),
} as Record<string, string>)[k] ?? '';
const cardShortP = (k: CardKind, plus = false): string => { const t = cardShort(k, plus); return plus && JOB_OF[k as OpKind] ? t + L(` (+: 성공 +${PLUS.insChance}·발각 −${PLUS.insRisk})`, ` (+: success +${PLUS.insChance}, detection −${PLUS.insRisk})`) : t; };
const playWhyText = (w: PlayWhy): string => ({ nocard: L('손에 없는 카드입니다.', 'That card is not in hand.'), ip: L('첩보력이 모자랍니다.', 'Not enough intel.'), unplayable: L('혼자 낼 수 없는 카드입니다.', 'This card cannot be played on its own.'), support: L('보조 카드는 작전 카드와 함께 냅니다.', 'Support cards go with a mission card.'), nosector: L('공작원이 잠입한 섹터에서 냅니다.', 'Play it in a sector where an operative is embedded.') } as Record<string, string>)[w] ?? whyText(w as StartWhy);
const weakTarget = (sid: string, c: Card): string => { const n = c.t !== undefined ? byId.get(c.t) : undefined; return n ? (knownNobles(sid).has(n.id) ? nobleName(n) : L('정체 미상', 'Unknown')) : ''; };
const cardView = (sid: string, sv: IntelSave, c: Card) => ({ id: c.id, k: c.k, short: cardShortP(c.k, !!c.plus), rar: cardRar(c.k), type: CARD[c.k].type, name: cardName(c.k) + (c.plus ? '+' : '') + (c.k === 'weak' ? `: ${weakTarget(sid, c)}` : ''), desc: cardDesc(c.k, !!c.plus), cost: CARD[c.k].cost, ...(c.plus ? { plus: true } : {}), ...(c.t !== undefined ? { t: c.t } : {}) });

// 귀족 연감·접견실이 「정찰로 알아낸 귀족」도 얼굴이 알려진 것으로 보게(기능 파일끼리 서로 가져오지 않도록 등록 방식)
setIntelSeenSource((sid) => Object.keys(bookOf(sid).seen).map(Number));

/** 대상 귀족의 지금 형편(작전 가능 판정용): 충성도 · 수도 섹터 거점 · 이미 떨어져 나갔나 */
const infoOf = (sid: string, id: number) => withNobleSave(sid, (ns) => ({ loyal: ns.loyal[id] ?? 100, core: isCoreHub(id), gone: !!(ns.fate[id] || ns.pending[id]), side: byId.get(id)?.side, now: dayOf(ctx.gameDate || '') }));
/** 위조 문서의 방향 고르기(화면의 「방향」 칸) */
const FAKE_WITH = () => ({ with: [{ id: 1, name: L('전쟁 쪽으로 — 긴장 올리기', 'Toward war — raise tension') }, { id: -1, name: L('평화 쪽으로 — 긴장 내리기', 'Toward peace — lower tension') }], withLabel: L('방향: ', 'Direction: ') });
const intentName = (k: Intent): string => ({ atk: L('공격 준비', 'Preparing to attack'), def: L('방어 태세', 'Defensive posture'), wait: L('관망', 'Waiting it out') })[k];
const otherSide = (x: NSide): NSide => (x === 'a' ? 'b' : 'a');
/** 이간질 상대 후보: 그 귀족의 군주(-1) + 보이는 인연으로 엮인 같은 진영 귀족 */
function sowWith(sid: string, t: NobleRow, known: Set<number>): Array<{ id: number; name: string }> {
  const out = [{ id: -1, name: L(`${sideName(t.side)}의 군주`, `The ${sideName(t.side)} sovereign`) }];
  withNobleSave(sid, (ns) => { for (const [k, a, b] of CR_BONDS) { if (a !== t.id && b !== t.id) continue; const o = byId.get(a === t.id ? b : a); if (!o || o.side !== t.side || !bondVisible(ns, k, a, b) || !known.has(o.id) || ns.fate[o.id]) continue; if (!out.some((x) => x.id === o.id)) out.push({ id: o.id, name: nobleName(o) }); } });
  return out;
}

/** 화면에 줄 것. 정체를 모르는 귀족은 이름·성격을 감춘다(첩보 지도의 안개). */
// ---- 두 강대국 정상회담(2026-11-08, 설계 3절 「정상회담 방해」) ----
const placeName = (m: number): [string, string] => { const q = CR_MAP_SYS.find((x) => x[0] === m); return q ? [q[4], q[5]] : ['회랑', 'the Corridor']; };
function summitStep(sid: string, sv: IntelSave, today: string): void {
  const tn = tensionNow(); if (!tn) return;
  const r = summitTick(sv, dayOf(today), today, tn.st, !!tn.war, Math.random); if (!r) return;
  const [pk, pe] = placeName(r.s.place); let ko = '', en = '', title: [string, string] = ['정상회담', 'Summit'];
  if (r.ev === 'begin') {
    ko = `두 강대국이 회랑의 ${pk}에서 정상회담을 열기로 했습니다(${Math.round(SUM.lead / 30)}달 뒤). 회담이 열리면 긴장이 크게 풀립니다. 깨뜨리려면 「정상회담 방해」 카드를 수도 섹터 공작원에게 쓰세요.`;
    en = `The two great powers will hold a summit at ${pe} in the Corridor (in ${Math.round(SUM.lead / 30)} months). If it is held, tension will ease sharply. To break it up, play "Sabotage the summit" with an operative in a capital sector.`;
    title = ['정상회담 예고', 'Summit announced'];
  } else if (r.ev === 'held') {
    void tensionShift(SUM.calmTn, [`${pk} 정상회담`, `Summit at ${pe}`]).catch(() => undefined);
    ko = `${pk}에서 두 강대국 정상회담이 열렸습니다. 두 군주가 악수를 나눴고 긴장이 크게 풀렸습니다(${SUM.calmTn}).`;
    en = `The great-power summit was held at ${pe}. The two sovereigns shook hands, and tension eased sharply (${SUM.calmTn}).`;
    title = ['정상회담 개최', 'Summit held'];
  } else if (r.ev === 'broken') {
    void tensionShift(SUM.breakTn, [`${pk} 정상회담 결렬`, `Summit at ${pe} collapsed`]).catch(() => undefined);
    ko = `${pk} 정상회담이 결렬됐습니다. 대표단이 서로를 탓하며 자리를 떴고 긴장이 올랐습니다(+${SUM.breakTn}). 회랑의 손이 닿았다는 것은 아무도 모릅니다.`;
    en = `The summit at ${pe} collapsed. The delegations walked out blaming each other, and tension rose (+${SUM.breakTn}). No one knows the Corridor had a hand in it.`;
    title = ['정상회담 결렬', 'Summit collapsed'];
  } else {
    ko = `전쟁이 벌어져 ${pk} 정상회담은 없던 일이 됐습니다.`; en = `War broke out, and the summit at ${pe} was called off.`;
    title = ['정상회담 취소', 'Summit called off'];
  }
  pushReport(sv, { d: today, kind: 'alert', target: -1, ok: r.ev !== 'held', ko, en });
  ctx.notify({ kind: 'office', title: L(...title), body: L(ko, en) });
  if (r.ev !== 'begin') { try { chronNoteWorld(L(`${today} ${ko}`, `${today} ${en}`)); } catch { /* 덤 */ } }
  logDiagnostic('info', 'scenario_intel.summit', { sid, ev: r.ev, place: r.s.place });
}
// ---- 함대 동향(2026-11-08) ----
const fleetAsk = new Map<string, NSide>();
const fleetCol = new Map<string, { sd: NSide; list: Array<{ m: number; p: number; n: string }> }>();
const SYS_NAME = new Map(CR_MAP_SYS.map((q) => [q[0], [q[4], q[5]]] as [number, [string, string]]));
/** 화면에 줄 함대 표(반 년 지난 것은 뺀다). */
function fleetView(sv: IntelSave, x: NSide, now: number): Record<string, unknown> | null {
  const f = sv.fleets?.[x]; if (!f || !f.list.length || now - dayOf(f.d) > FLEET_SEEN_DAYS) return null;
  return { d: f.d, left: Math.max(0, Math.ceil((FLEET_SEEN_DAYS - (now - dayOf(f.d))) / 30)), total: f.list.reduce((s, q) => s + q.p, 0), list: f.list.map((q) => ({ ...q, at: q.m >= 0 ? L(...(SYS_NAME.get(q.m) ?? ['?', '?'])) : L('항해 중', 'In transit') })) };
}
/** 모드 줄 SCNFLTBEG · SCNFLT · SCNFLTEND(sllm_cr_fleet_peek) — scenario-map-app 의 로그 자리에서 부른다. */
export function intelOnFleetLine(kind: string, kv: Record<string, string>): void {
  try {
    const c = (v: unknown) => String(v ?? '').replace(/^\\+/, '').replace(/,/g, '').trim();
    if (c(kv.sc) !== 'corridor') return;
    const sid = cleanSaveId(c(kv.sid).replace(/\.0+$/, '')); if (!sid || sid === '0') return;
    const sd: NSide | null = Math.round(Number(c(kv.sd))) === 1 ? 'a' : Math.round(Number(c(kv.sd))) === 2 ? 'b' : null; if (!sd) return;
    if (kind === 'SCNFLTBEG') { fleetCol.set(sid, { sd, list: [] }); return; }
    const cur = fleetCol.get(sid); if (!cur || cur.sd !== sd) return;
    if (kind === 'SCNFLT') { if (cur.list.length < 60) cur.list.push({ m: Math.round(Number(c(kv.m))) >= 0 ? Math.round(Number(c(kv.m))) : -1, p: Math.max(0, Math.round(Number(c(kv.p)) || 0)), n: c(kv.name).slice(0, 60) }); return; }
    if (kind !== 'SCNFLTEND') return;
    fleetCol.delete(sid); if (fleetAsk.get(sid) === sd) fleetAsk.delete(sid);
    const sv = bookOf(sid), today = ctx.gameDate || c(kv.date) || '';
    cur.list.sort((a, b) => b.p - a.p); (sv.fleets ??= {})[sd] = { d: today, list: cur.list };
    const total = cur.list.reduce((s, q) => s + q.p, 0), top = cur.list.slice(0, 3).map((q) => ({ n: q.n, p: q.p, at: q.m >= 0 ? (SYS_NAME.get(q.m) ?? ['?', '?']) : ['항해 중', 'in transit'] as [string, string] }));
    const ko = cur.list.length ? `${sideKo(sd)} 함대 배치표: 군 함대 ${cur.list.length}개, 전력 합계 ${total.toLocaleString()}. 가장 큰 함대 — ${top.map((q) => `${q.n}(${q.p.toLocaleString()}, ${q.at[0]})`).join(' · ')}.` : `${sideKo(sd)} 함대 배치표: 지금 움직이는 군 함대가 없습니다.`;
    const en = cur.list.length ? `${sideEn(sd)} deployment chart: ${cur.list.length} military fleets, total strength ${total.toLocaleString()}. Largest — ${top.map((q) => `${q.n} (${q.p.toLocaleString()}, ${q.at[1]})`).join(' · ')}.` : `${sideEn(sd)} deployment chart: no military fleets in the field right now.`;
    pushReport(sv, { d: today, kind: 'fleets', target: -1, ok: true, ko, en });
    save(); logDiagnostic('info', 'scenario_intel.fleets', { sid, side: sd, n: cur.list.length, total });
  } catch (e) { logDiagnostic('warn', 'scenario_intel.fleet_line_failed', { error: (e as Error).message }); }
}

function view(): Record<string, unknown> {
  const sid = mine(); if (!sid) return { ok: true, on: false };
  const sv = bookOf(sid), today = ctx.gameDate || '', known = knownNobles(sid), now = dayOf(today);
  const loyal = withNobleSave(sid, (ns) => ns.knownLoyal);
  const agents = sv.agents.filter((a) => a.st !== 'lost').map((a) => {
    const t = a.at !== null ? byId.get(a.at) : undefined, info = t ? infoOf(sid, t.id) : undefined;
    const plays = t ? sv.hand.filter((c) => !isSupport(c.k) && CARD[c.k].type !== 'weak' && CARD[c.k].type !== 'curse').map((c) => {
      const why = canPlay(sv, { card: c.id, agent: a.id }, info);
      const pv = isOpCard(c.k) ? { chance: opChance(sv, c.k, t.id, a, undefined, t.side), risk: opRisk(sv, c.k, t.side, a, undefined, t.id), days: OPS[c.k].days } : {};
      return { card: c.id, cost: cardCost(sv, c, t.id), why, whyText: why ? playWhyText(why) : '', ...pv, ...(OPS[c.k as OpKind]?.cost ? { energy: OPS[c.k as OpKind].cost } : {}), ...(c.k === 'sow' ? { with: sowWith(sid, t, known) } : {}), ...(c.k === 'fakedoc' ? FAKE_WITH() : {}) };
    }) : [];
    const opts = t ? OP_KINDS.map((k) => {
      const why = canStart(sv, k, t.id, a.id, info);
      return { kind: k, name: opName(k), desc: opDesc(k), need: OPS[k].need, days: OPS[k].days, chance: opChance(sv, k, t.id, a, undefined, t.side), risk: opRisk(sv, k, t.side, a, undefined, t.id), why, whyText: whyText(why), ...(OPS[k].cost ? { cost: OPS[k].cost } : {}), ...(k === 'sow' ? { with: sowWith(sid, t, known) } : {}), ...(k === 'fakedoc' ? FAKE_WITH() : {}) };
    }) : [];
    const op = sv.ops.find((p) => p.agent === a.id);
    return { id: a.id, name: agentName(a), g: agentG(a), key: (a.en || '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''), sk: a.sk, xp: a.xp, st: a.st, at: a.at, atName: t ? (known.has(t.id) ? nobleName(t) : L('정체 미상', 'Unknown')) : '', opts, plays,
      ...(op ? { op: { kind: op.kind, name: opName(op.kind), left: Math.max(0, Math.ceil((dayOf(op.start) + op.days - now) / 30)) } } : {}) };
  });
  const lost = sv.agents.filter((a) => a.st === 'lost').map((a) => ({ id: a.id, name: agentName(a) }));
  const nobles = CR_NOBLES.map((n) => { const c = sv.cards[String(n.id)], ins = sv.ins?.[String(n.id)]; return { id: n.id, side: n.side, net: Math.round(sv.net[String(n.id)] ?? 0), known: known.has(n.id), ...(known.has(n.id) ? { name: nobleName(n) } : {}), ...(loyal[n.id] ? { loyal: true } : {}), ...(c ? { card: weakName(c.k) } : {}), ...(ins ? { ins: JOBS.filter((j) => ins[j]).map((j) => L(...JOB_NAME[j])) } : {}), ...(sv.affair?.[String(n.id)] !== undefined ? { affair: true } : {}) }; });
  const cards = Object.entries(sv.cards).map(([k, c]) => { const n = byId.get(Number(k)); return n ? { id: n.id, name: known.has(n.id) ? nobleName(n) : L('정체 미상', 'Unknown'), what: weakName(c.k), d: c.d } : null; }).filter(Boolean);
  const sides = (['a', 'b'] as NSide[]).map((x) => { const u = sv.ult[x]; return { side: x, name: sideName(x), v: Math.round(sv.sus[x]), st: susStage(sv.sus[x]), stName: susName(susStage(sv.sus[x])), hostile: Math.round(sv.hostile[x]), cnet: Math.round(cnetOf(sv, x)), ...(fleetView(sv, x, now) ? { fleets: fleetView(sv, x, now) } : {}), ...(planOf(sv, x, now) ? { plan: (() => { const p = planOf(sv, x, now)!; return { intent: p.intent, intentName: intentName(p.intent), tn: p.tn, hostile: p.hostile, foe: p.foe, left: Math.max(0, Math.ceil((p.until - now) / 30)), tnOn: !!tensionNow() }; })() } : {}), ...(u ? { ult: { left: Math.max(0, u.due - now), pay: IN.ultPay } } : {}) }; });
  return {
    ok: true, on: true, live: ready(), date: today, ...(sv.summit ? { summit: { place: L(...placeName(sv.summit.place)), left: Math.max(0, Math.ceil((sv.summit.at - now) / 30)), sab: sv.summit.sab } } : {}), budget: sv.budget, budgets: IN.budget, hireCost: IN.hireCost, maxAgents: IN.maxAgents, forge: forgeView(sid, sv, known),
    deck: {
      ip: sv.ip, gain: ipGain(sv), meet: sv.meet, next: sv.meet ? sv.meet + 1 : 0, nDeck: sv.deck.length, nDisc: sv.disc.length, size: deckSize(sv), min: CK.deckMin, max: CK.deckMax,
      hand: sv.hand.map((c) => cardView(sid, sv, c)), rewards: sv.rewards, offer: sv.offer.map((k) => ({ k, rar: cardRar(k), type: CARD[k].type, name: cardName(k), desc: cardDesc(k), short: cardShort(k), cost: CARD[k].cost })),
      market: marketView(sid, sv, today), removeCost: CK.removeCost,
      list: [...sv.deck, ...sv.hand, ...sv.disc].sort((x, y) => x.k.localeCompare(y.k) || Number(!!x.plus) - Number(!!y.plus)).map((c) => cardView(sid, sv, c)),
      upgrade: CK.upgradable.filter((k) => [...sv.deck, ...sv.hand, ...sv.disc].filter((c) => c.k === k && !c.plus).length >= 2).map((k) => ({ k, name: cardName(k) })),
    },
    year: (() => { const y = [...sv.reports].reverse().find((r) => r.kind === 'year'); return y ? { d: y.d, text: L(y.ko, y.en) } : null; })(),
    ...foeView(sid, sv, now), threats: threatList(sid, sv, now), sus: sides, agents, lost, nobles, cards, reports: sv.reports.slice(-30).reverse().map((r) => ({ d: r.d, ok: r.ok, kind: r.kind, target: r.target, text: L(r.ko, r.en) })),
  };
}
/** 합친 첩보 상점(2026-11-08): 진열 6칸 · 반년마다/대전 뒤 새로 · 다시 깔기 */
function marketView(sid: string, sv: IntelSave, today: string): Record<string, unknown> {
  if (!sv.shop) { rollShop(sv, halfOf(today)); save(); }
  const opFull = deckSize(sv) >= CK.deckMax, duelFull = duelDeck(sv).length >= D.deckMax;
  return {
    reroll: rerollCost(sv), slots: SHOP.slots,
    items: sv.shop!.slots.map((x, n) => {
      const card = x.pool === 'duel' ? dCardView({ id: 0, k: x.k as DCard }) : { k: x.k, rar: cardRar(x.k as CardKind), type: CARD[x.k as CardKind].type, name: cardName(x.k as CardKind), desc: cardDesc(x.k as CardKind), short: cardShort(x.k as CardKind), cost: CARD[x.k as CardKind].cost };
      return { n, pool: x.pool, price: x.price, ...(x.sale ? { sale: true } : {}), ...(x.sold ? { sold: true } : {}), full: x.pool === 'duel' ? duelFull : opFull, card };
    }),
  };
}
const pay = (energy: number) => enqueue(() => sendConsole(`effect add_resource = { energy = -${Math.round(energy)} }`));
const sideKo = (x: NSide) => (x === 'a' ? '얼라이언스' : '제국'), sideEn = (x: NSide) => (x === 'a' ? 'Alliance' : 'Imperial');

/** 화면 조작: hire · dismiss · post · budget · play(카드) · take(보상) · buy · remove · upgrade · ult */
async function act(req: unknown): Promise<Record<string, unknown>> {
  const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리를 맡은 시나리오 판에서만 쓸 수 있습니다.', 'Only available when playing the Corridor seat in this scenario.') };
  const r = (req && typeof req === 'object' ? req : {}) as { a?: unknown; agent?: unknown; target?: unknown; n?: unknown; kind?: unknown; with?: unknown; side?: unknown; choice?: unknown; card?: unknown; support?: unknown; col?: unknown; node?: unknown };
  const sv = bookOf(sid), today = ctx.gameDate || '';
  const agent = sv.agents.find((x) => x.id === Number(r.agent) && x.st !== 'lost');
  switch (r.a) {
    case 'hire': {
      if (sv.agents.filter((x) => x.st !== 'lost').length >= IN.maxAgents) return { ok: false, error: L(`공작원은 ${IN.maxAgents}명까지 둘 수 있습니다.`, `You can keep up to ${IN.maxAgents} operatives.`) };
      if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 영입 비용을 낼 수 있습니다.', 'The game must be running to pay the recruiting cost.') };
      try { await pay(IN.hireCost); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      const a = makeAgent(sv, today, Math.random); sv.agents.push(a);
      pushReport(sv, { d: today, kind: 'hire', target: -1, ok: true, ko: `새 공작원 ${a.ko}을(를) 영입했습니다.`, en: `Recruited a new operative, ${a.en}.` });
      break;
    }
    case 'dismiss': {
      if (!agent) return { ok: false, error: L('공작원을 찾지 못했습니다.', 'Operative not found.') };
      if (agent.st === 'op') return { ok: false, error: L('작전 중인 공작원은 내보낼 수 없습니다.', 'An operative on a mission cannot be dismissed.') };
      sv.agents = sv.agents.filter((x) => x.id !== agent.id); break;
    }
    case 'post': {
      if (!agent) return { ok: false, error: L('공작원을 찾지 못했습니다.', 'Operative not found.') };
      if (agent.st === 'op') return { ok: false, error: L('작전이 끝나야 옮길 수 있습니다.', 'Wait for the mission to end before moving them.') };
      const t = r.target === null || r.target === undefined ? null : Number(r.target);
      if (t !== null && !byId.has(t)) return { ok: false, error: L('그 섹터에는 보낼 수 없습니다.', 'Cannot send them to that sector.') };
      if (t !== null && sv.agents.some((x) => x.id !== agent.id && x.at === t && x.st !== 'lost')) return { ok: false, error: L('그 섹터에는 이미 다른 공작원이 있습니다.', 'Another operative is already in that sector.') };
      agent.at = t; agent.st = t === null ? 'idle' : 'post'; break;
    }
    case 'budget': {
      const n = Math.round(Number(r.n)); if (!(n >= 0 && n <= 3)) return { ok: false, error: L('알 수 없는 예산 단계입니다.', 'Unknown budget level.') };
      sv.budget = n; break;
    }
    case 'play': {
      const card = sv.hand.find((c) => c.id === Number(r.card)); if (!card) return { ok: false, error: playWhyText('nocard') };
      const t = agent && agent.at !== null ? byId.get(agent.at) : undefined;
      const info = t ? infoOf(sid, t.id) : {};
      const req = { card: card.id, ...(agent ? { agent: agent.id } : {}), ...(r.support !== undefined && r.support !== null && r.support !== '' ? { support: Number(r.support) } : {}), ...(card.k === 'sow' || card.k === 'fakedoc' ? { with: Math.round(Number(r.with ?? -1)) } : {}) };
      const why = canPlay(sv, req, info); if (why) return { ok: false, error: playWhyText(why) };
      if (card.k === 'fakedoc' && req.with !== 1 && req.with !== -1) return { ok: false, error: L('긴장을 올릴지 내릴지 고르세요.', 'Choose whether to raise or lower the tension.') };
      if (card.k === 'sow' && t && !sowWith(sid, t, knownNobles(sid)).some((x) => x.id === req.with)) return { ok: false, error: whyText('with') };
      const energy = isOpCard(card.k) ? OPS[card.k].cost ?? 0 : 0;
      if (energy) {
        if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 비용을 낼 수 있습니다.', 'The game must be running to pay the cost.') };
        try { await pay(energy); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      }
      const base = t && agent && card.k === 'plant' ? { chance: 0, risk: 0, side: t.side, core: !!(info as { core?: boolean }).core } : t && agent && isOpCard(card.k) ? { chance: opChance(sv, card.k, t.id, agent, undefined, t.side), risk: opRisk(sv, card.k, t.side, agent, undefined, t.id), side: t.side, core: !!(info as { core?: boolean }).core } : undefined;
      const out = playCard(sv, req, today, base);
      if (out.scouted !== undefined && t) pushReport(sv, out.scouted
        ? { d: today, kind: 'hire', target: t.id, ok: true, ko: `${agent!.ko}이(가) ${t.ko} 주변 사람들을 살폈습니다. 매수할 만한 사람을 찾았습니다 — 「${cardName(out.scouted)}」 카드가 손패에 들어왔습니다.`, en: `${agent!.en} studied the people around ${t.en} and found someone who can be bought. "${cardName(out.scouted)}" is now in your hand.` }
        : { d: today, kind: 'hire', target: t.id, ok: false, ko: `${agent!.ko}이(가) ${t.ko} 주변 사람들을 살폈지만 매수할 만한 사람을 찾지 못했습니다.`, en: `${agent!.en} studied the people around ${t.en} but found no one who could be bought.` });
      if (out.planted !== undefined && t) pushReport(sv, { d: today, kind: 'hire', target: t.id, ok: true, ko: `${agent!.ko}이(가) ${t.ko} 섹터에 연줄을 심었습니다. 정보망이 올랐습니다.`, en: `${agent!.en} planted contacts in ${t.en}'s sector. The network grew.` });
      break;
    }
    case 'take': { if (!sv.offer.length) return { ok: false, error: L('고를 보상이 없습니다.', 'There is no reward to choose.') }; takeOffer(sv, Math.round(Number(r.n ?? -1)), Math.random); break; }
    case 'sbuy': { // 합친 상점에서 한 칸 사기(2026-11-08)
      const x = sv.shop?.slots[Math.round(Number(r.n ?? -1))]; if (!x || x.sold) return { ok: false, error: L('이미 팔렸거나 없는 칸입니다.', 'That slot is sold or empty.') };
      if (x.pool === 'op' ? deckSize(sv) >= CK.deckMax : duelDeck(sv).length >= D.deckMax) return { ok: false, error: x.pool === 'op' ? L(`첩보 덱은 ${CK.deckMax}장까지입니다.`, `The intel deck holds at most ${CK.deckMax} cards.`) : L(`방첩 덱은 ${D.deckMax}장까지입니다.`, `The counter-intelligence deck holds at most ${D.deckMax} cards.`) };
      if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 값을 치를 수 있습니다.', 'The game must be running to pay.') };
      try { await pay(x.price); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      if (x.pool === 'op') buyCard(sv, x.k as CardKind); else dAdd(duelDeck(sv), x.k as DCard, () => sv.nextId++);
      x.sold = true; break;
    }
    case 'reroll': { // 진열 다시 깔기 — 낼수록 비싸짐(반년마다 초기화)
      if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 값을 치를 수 있습니다.', 'The game must be running to pay.') };
      const cost = rerollCost(sv); try { await pay(cost); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      rollShop(sv, sv.shop?.h ?? halfOf(today), Math.random, true); sv.shop!.rr++; break;
    }
    case 'remove': {
      if (deckSize(sv) <= CK.deckMin) return { ok: false, error: L(`덱은 ${CK.deckMin}장보다 줄일 수 없습니다.`, `The deck cannot go below ${CK.deckMin} cards.`) };
      if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 값을 치를 수 있습니다.', 'The game must be running to pay.') };
      const id = Number(r.card); if (![...sv.deck, ...sv.hand, ...sv.disc].some((c) => c.id === id && c.k !== 'weak')) return { ok: false, error: L('지울 수 없는 카드입니다.', 'That card cannot be removed.') };
      try { await pay(CK.removeCost); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      removeCard(sv, id); break;
    }
    case 'upgrade': { if (!upgradeCard(sv, String(r.kind) as CardKind)) return { ok: false, error: L('같은 카드가 두 장 있어야 강화할 수 있습니다.', 'You need two copies of the card to upgrade it.') }; break; }
    case 'dPlay': { const f = sv.foe; if (!f) return { ok: false, error: L('대전이 없습니다.', 'No duel in progress.') }; const why = playD(f.duel, Number(r.card), Math.random); if (why) return { ok: false, error: counterWhyText(why) }; if (f.duel.over) foeFinish(sid, sv, ctx.gameDate || '', f.duel.over); break; } // 방첩 대전(2026-11-08)
    case 'dInject': { const f = sv.foe; if (!f) return { ok: false, error: L('대전이 없습니다.', 'No duel in progress.') }; const why = injectD(f.duel, Number(r.card), Math.round(Number(r.node ?? -1))); if (why) return { ok: false, error: counterWhyText(why) }; break; }
    case 'dEnd': { const f = sv.foe; if (!f) return { ok: false, error: L('대전이 없습니다.', 'No duel in progress.') }; endTurnD(f.duel, Math.random); if (f.duel.over) foeFinish(sid, sv, ctx.gameDate || '', f.duel.over); break; }
    case 'dAuto': { if (!sv.foe) return { ok: false, error: L('대전이 없습니다.', 'No duel in progress.') }; if (!foeAuto(sid, sv, ctx.gameDate || '', false)) return { ok: false, error: L(`첩보부장은 ${D.chief.unlock}승부터 대전을 맡을 수 있습니다.`, `The spymaster can take duels after ${D.chief.unlock} wins.`) }; break; }
    case 'dTake': { const l = sv.foeLast, i = Math.round(Number(r.n ?? -1)); if (l?.offer && l.offer[i]) { duelDeck(sv).push({ id: sv.nextId++, k: l.offer[i] }); } if (l) l.offer = []; break; } // 승리 보상 카드 한 장
    case 'foeSeen': { sv.foeLast = undefined; break; }
    case 'dRemove': {
      if (duelDeck(sv).length <= DSHOP.min) return { ok: false, error: L(`방첩 덱은 ${DSHOP.min}장보다 줄일 수 없습니다.`, `The counter-intelligence deck cannot go below ${DSHOP.min} cards.`) };
      if (!duelDeck(sv).some((c) => c.id === Number(r.card))) return { ok: false, error: L('지울 수 없는 카드입니다.', 'That card cannot be removed.') };
      if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 값을 치를 수 있습니다.', 'The game must be running to pay.') };
      try { await pay(DSHOP.remove); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      dRemove(duelDeck(sv), Number(r.card)); break;
    }
    case 'dUpgrade': { if (dUpgrade(duelDeck(sv), String(r.kind) as DCard, () => sv.nextId++)) return { ok: false, error: L('같은 카드가 두 장 있어야 강화할 수 있습니다.', 'You need two copies of the card to upgrade it.') }; break; }
    case 'ult': {
      const side = r.side === 'a' || r.side === 'b' ? r.side : null, choice = (['hand', 'pay', 'refuse'] as UltChoice[]).find((c) => c === r.choice);
      if (!side || !choice || !sv.ult[side]) return { ok: false, error: L('답할 최후통첩이 없습니다.', 'There is no ultimatum to answer.') };
      if (choice === 'pay') {
        if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 배상금을 낼 수 있습니다.', 'The game must be running to pay reparations.') };
        try { await pay(IN.ultPay); } catch (e) { return { ok: false, error: L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message }; }
      }
      ultAnswered(sid, sv, side, choice, today); break;
    }
    case 'burn': { const n = (sv.fakes ?? []).findIndex((f) => f.id === Number(r.card)); if (n < 0) return { ok: false, error: L('그 문서가 없습니다.', 'No such document.') }; sv.fakes!.splice(n, 1); break; } // 위조 문서 버리기
    case 'forge': { // 위조 문서 공방(2026-11-08)
      const why = await forgeMake(sid, sv, r as Record<string, unknown>, today); if (why) return { ok: false, error: why }; break;
    }
    default: return { ok: false, error: L('알 수 없는 명령입니다.', 'Unknown command.') };
  }
  save(); logDiagnostic('info', 'scenario_intel.act', { a: String(r.a) });
  return { ok: true, ...view() };
}

/** 최후통첩 답(화면에서 고르거나, 기한이 지나 거절로) — 보고서·알림·게임 호감·연대기 */
function ultAnswered(sid: string, sv: IntelSave, side: NSide, choice: UltChoice, today: string, late = false): void {
  const res = answerUlt(sv, side, choice, today, CR_NOBLES);
  let ko = '', en = '';
  if (choice === 'hand') { const names = res.handed.map((a) => a.ko).join(', '), namesEn = res.handed.map((a) => a.en).join(', '); ko = `${sideKo(side)}의 최후통첩을 받아들여 공작원 ${names || '없음'}을(를) 넘겼습니다. 의심이 조금 누그러졌습니다.`; en = `We accepted the ${sideEn(side)} ultimatum and handed over ${namesEn || 'no one'}. Their suspicion eases somewhat.`; }
  else if (choice === 'pay') { ko = `${sideKo(side)}에 배상금 ${IN.ultPay}을(를) 치렀습니다. 의심이 조금 누그러졌습니다.`; en = `We paid ${IN.ultPay} in reparations to the ${sideEn(side)} side. Their suspicion eases somewhat.`; }
  else { ko = late ? `${sideKo(side)}의 최후통첩에 기한까지 답하지 않았습니다. 거절로 받아들여져 회랑과의 긴장이 크게 올랐습니다.` : `${sideKo(side)}의 최후통첩을 거절했습니다. 회랑과의 긴장이 크게 올랐습니다.`; en = late ? `We let the ${sideEn(side)} ultimatum lapse. It was taken as a refusal, and tension with the Corridor soared.` : `We rejected the ${sideEn(side)} ultimatum. Tension with the Corridor soared.`; }
  pushReport(sv, { d: today, kind: 'ult', target: -1, ok: choice !== 'refuse', ko, en });
  ctx.notify({ kind: 'office', title: L('최후통첩', 'Ultimatum'), body: L(ko, en) });
  try { chronNoteWorld(L(ko, en), true); } catch { /* 연대기는 덤 */ }
  if (ready() && ctx.curSaveId === sid) void opCmd(side, choice).catch((e) => logDiagnostic('warn', 'scenario_intel.op_failed', { error: (e as Error).message }));
}

/** 반란 대기열을 게임에 보낸다(게임이 켜져 있을 때). 보내면 귀족 운명을 반란으로 확정. */
function flushRevolts(sid: string, sv: IntelSave, today: string): void {
  if (!sv.rv.length || ctx.curSaveId !== sid) return;
  // 2026-11-07 귀족 영역다툼 2단계: 반란 실행은 영지 장부(scenario-domains-app)가 맡는다 — 앱 영지의 성계 목록을 넘기고, 그 귀족이 모아 둔 밀약이 있으면 연합 반란.
  // 게임이 아직 준비 안 됐으면 그쪽이 미뤄 두었다가 다음 보고 때 실행한다.
  for (const id of [...sv.rv]) {
    try { inciteRevolt(sid, id, today); } catch (e) { logDiagnostic('warn', 'scenario_intel.revolt_failed', { id, error: (e as Error).message }); return; }
    sv.rv = sv.rv.filter((x) => x !== id);
    logDiagnostic('info', 'scenario_intel.revolt', { sid, id });
  }
  save();
}

/** 작전 결과를 귀족 저장·보고서·알림에. */
function applyResult(sid: string, sv: IntelSave, today: string, res: ReturnType<typeof monthTick>): void {
  if (!res) return;
  for (const x of res.results) {
    const t = byId.get(x.op.target); if (!t) continue;
    const who = sv.seen[String(t.id)] || knownNobles(sid).has(t.id) ? t : null;
    const agKo = x.agent.ko, agEn = x.agent.en, net = sv.net[String(t.id)] ?? 0, key = String(t.id);
    let ko = '', en = '';
    if (x.ok) {
      switch (x.op.kind) {
        case 'identify': sv.seen[key] = true; ko = `${agKo}의 보고: 이 섹터의 총독은 ${t.ko}입니다.`; en = `${agEn} reports: the governor of this sector is ${t.en}.`; break;
        case 'loyalty': {
          const st = withNobleSave(sid, (ns) => { ns.knownLoyal[t.id] = true; return loyalStage(ns.loyal[t.id] ?? 100); });
          const nm = who ? who : t; ko = `${agKo}의 보고: ${nm.ko}의 충성은 「${['충성', '평온', '불만', '모반의 기미', '반란 직전'][st]}」 상태입니다. 귀족 연감에 정확한 수치를 적었습니다.`; en = `${agEn} reports: ${nm.en} is "${['Loyal', 'Content', 'Discontent', 'Conspiring', 'On the Brink'][st]}". The exact figure is now in the peerage.`;
          break;
        }
        case 'ties': {
          const found = withNobleSave(sid, (ns) => {
            const hidden = CR_BONDS.filter(([k, a, b]) => (a === t.id || b === t.id) && !bondVisible(ns, k, a, b));
            if (!hidden.length) return null; const pick = hidden[Math.floor(Math.random() * hidden.length)]; reveal(ns, pick[1], pick[2]); return pick;
          });
          if (found) { const o = byId.get(found[1] === t.id ? found[2] : found[1]); const kind = { oath: ['서약', 'an Oath'], accord: ['협약', 'an Accord'], back: ['비밀 회선', 'a Back Channel'], union: ['혼약', 'a Union'], rival: ['경쟁', 'a Rivalry'] }[found[0]]; ko = `${agKo}의 보고: ${t.ko}은(는) ${o ? o.ko : '누군가'}와(과) ${kind[0]}으로 묶여 있습니다.`; en = `${agEn} reports: ${t.en} is bound to ${o ? o.en : 'someone'} by ${kind[1]}.`; }
          else { ko = `${agKo}의 보고: ${t.ko}에게서 숨은 인연을 찾지 못했습니다.`; en = `${agEn} reports: no hidden ties were found around ${t.en}.`; }
          { const pn = revealPlotsOf(sid, t.id); if (pn) { ko += ` 그리고 반란 밀약의 약속 ${pn}건을 찾아냈습니다 — 세력도에서 확인하세요.`; en += ` We also uncovered ${pn} pledge(s) of a rebel conspiracy — see the Power Atlas.`; } } // 2단계 밀약 들춰내기(2026-11-07)
          break;
        }
        case 'bribe': withNobleSave(sid, (ns) => { shiftRel(ns, t.id, 'P', x.op.plus ? 25 : 15); shiftLoyal(ns, t.id, x.op.plus ? -12 : -8); }); ko = `${agKo}의 보고: ${t.ko}이(가) 우리 돈을 받았습니다. 우리를 보는 눈이 부드러워지고, 자기 군주에 대한 충성은 흔들립니다.`; en = `${agEn} reports: ${t.en} took our money. They look on us more kindly, and their loyalty to their sovereign wavers.`; break;
        case 'sow': {
          const w = x.op.with ?? -1, o = w >= 0 ? byId.get(w) : undefined;
          const pl = !!x.op.plus; withNobleSave(sid, (ns) => { if (o) shiftRel(ns, t.id, o.id, pl ? -35 : -25); else { shiftRel(ns, t.id, rulerOf(t.side), pl ? -30 : -20); shiftLoyal(ns, t.id, pl ? -10 : -6); } });
          ko = o ? `${agKo}의 보고: ${t.ko}과(와) ${o.ko} 사이에 금이 갔습니다.` : `${agKo}의 보고: ${t.ko}이(가) 군주를 원망하기 시작했습니다. 충성이 흔들립니다.`;
          en = o ? `${agEn} reports: a rift has opened between ${t.en} and ${o.en}.` : `${agEn} reports: ${t.en} has begun to resent their sovereign. Their loyalty wavers.`;
          break;
        }
        case 'dirt': { const k = weakFor(t); sv.cards[key] = { k, d: today }; if (![...sv.deck, ...sv.hand, ...sv.disc].some((c) => c.k === 'weak' && c.t === t.id)) sv.hand.push({ id: sv.nextId++, k: 'weak', t: t.id }); ko = `${agKo}의 보고: ${t.ko}의 약점을 쥐었습니다 — ${WEAK_KO[k][0]}. 협박에 쓸 수 있습니다.`; en = `${agEn} reports: we now hold ${t.en}'s weakness — ${WEAK_KO[k][1]}. It can be used for blackmail.`; break; }
        case 'blackmail': { delete sv.cards[key]; for (const pile of ['deck', 'hand', 'disc'] as const) sv[pile] = sv[pile].filter((c) => !(c.k === 'weak' && c.t === t.id)); markAudience(sid, 'ch', t.id, true); withNobleSave(sid, (ns) => { shiftRel(ns, t.id, 'P', -25); }); ko = `${agKo}의 보고: ${t.ko}이(가) 이를 갈며 굴복했습니다. 밀사 통로가 열렸습니다. 다만 그는 우리를 깊이 미워합니다.`; en = `${agEn} reports: ${t.en} gave in through gritted teeth. A secret channel is open, but they hate us for it.`; break; }
        case 'frame': markAudience(sid, 'sus', t.id, true); withNobleSave(sid, (ns) => { shiftRel(ns, t.id, rulerOf(t.side), -30); shiftLoyal(ns, t.id, -10); }); ko = `${agKo}의 보고: 위조 문서가 먹혔습니다. ${t.ko}은(는) 이제 군주의 의심을 받습니다.`; en = `${agEn} reports: the forged papers worked. ${t.en} now lives under their sovereign's suspicion.`; break;
        case 'assassinate': try { killNoble(sid, t.id, 'assassinated'); } catch (e) { logDiagnostic('warn', 'scenario_intel.assassinate_failed', { error: (e as Error).message }); } ko = `${agKo}의 보고: 일은 끝났습니다. ${t.ko}은(는) 더 이상 숨 쉬지 않습니다.`; en = `${agEn} reports: it is done. ${t.en} breathes no more.`; break;
        case 'ins_cook': case 'ins_doctor': case 'ins_driver': case 'ins_mech': case 'ins_butler': case 'ins_secretary': case 'ins_guard': case 'ins_treasurer': case 'ins_lover': case 'ins_priest': case 'ins_journalist': // 내부자 매수(2026-11-08) — 11종 모두(전엔 4종만 걸려 있었음)
        case 'ins_clerk': case 'ins_paparazzo': case 'ins_expat': case 'ins_courier': case 'ins_cleaner': case 'ins_canteen': case 'ins_sleuth': case 'ins_streamer': case 'ins_installer': {
          const j = JOB_OF[x.op.kind]!; (sv.ins ??= {})[key] = { ...(sv.ins[key] ?? {}), [j]: today };
          const jb = JOB_NAME[j], nm = who ?? t;
          ko = `${agKo}의 보고: ${nm.ko}의 ${jb[0]}이(가) 우리 사람이 되었습니다.`; en = `${agEn} reports: ${nm.en}'s ${jb[1].toLowerCase()} now works for us.`;
          if (j === 'cook') { const f = favFood(t); ko += ` 그가 가장 즐기는 음식은 ${f[0]}입니다.`; en += ` Their favorite dish is ${f[1]}.`; }
          if (j === 'doctor') { const r = healthRecord(sid, t.id); if (r) { ko += ` 진료 기록: 건강 ${r.v}${r.ill ? ' · 지병이 있음' : ''}${r.tox ? ` · 몸에 독이 쌓임(${r.tox}단계)` : ''}.`; en += ` Medical record: health ${r.v}${r.ill ? ' · chronic illness' : ''}${r.tox ? ` · poison accumulated (stage ${r.tox})` : ''}.`; } }
          if (j === 'driver') { ko += ' 이제 그의 이동 일정과 일상이 보고됩니다.'; en += ' Their movements and daily routine will now be reported.'; }
          if (j === 'mech') { ko += ' 함선과 차량의 정비 기록을 손에 넣었습니다.'; en += ' We now hold the maintenance logs of their ships and vehicles.'; }
          if (j === 'butler') { // 손님 명단에서 숨은 인연 하나
            const found = withNobleSave(sid, (ns) => { const hidden = CR_BONDS.filter(([k, a, b]) => (a === t.id || b === t.id) && !bondVisible(ns, k, a, b)); if (!hidden.length) return null; const pick = hidden[Math.floor(Math.random() * hidden.length)]; reveal(ns, pick[1], pick[2]); return pick; });
            const o = found ? byId.get(found[1] === t.id ? found[2] : found[1]) : undefined;
            if (o) { ko += ` 손님 명단에서 ${o.ko}과(와)의 숨은 인연이 드러났습니다.`; en += ` The guest list reveals a hidden tie with ${o.en}.`; } else { ko += ' 저택의 일상이 보고되기 시작합니다.'; en += ' Reports on the household routine begin.'; }
          }
          if (j === 'secretary') { const pn = revealPlotsOf(sid, t.id); if (pn) { ko += ` 서신에서 반란 밀약의 약속 ${pn}건을 찾아냈습니다 — 세력도에서 확인하세요.`; en += ` The letters exposed ${pn} pledge(s) of a rebel conspiracy — see the Power Atlas.`; } else { ko += ' 서신에서 밀약의 흔적은 보이지 않습니다.'; en += ' The letters show no trace of a conspiracy.'; } }
          if (j === 'guard') { ko += ` 경호의 빈틈을 알게 되었습니다(이 귀족 암살 성공률 +${GUARD_EDGE}).`; en += ` We now know the gaps in their protection (assassination odds +${GUARD_EDGE}).`; }
          if (j === 'treasurer') { const k = sv.cards[key]?.k ?? weakFor(t); if (!sv.cards[key]) sv.cards[key] = { k, d: today }; if (![...sv.deck, ...sv.hand, ...sv.disc].some((c) => c.k === 'weak' && c.t === t.id)) sv.hand.push({ id: sv.nextId++, k: 'weak', t: t.id }); ko += ` 장부에서 약점을 찾았습니다 — ${WEAK_KO[k][0]}.`; en += ` The ledgers reveal a weakness — ${WEAK_KO[k][1]}.`; }
          if (j === 'lover') { const st = withNobleSave(sid, (ns) => { ns.knownLoyal[t.id] = true; shiftLoyal(ns, t.id, -5); return loyalStage(ns.loyal[t.id] ?? 100); }); ko += ` 그의 속마음은 「${['충성', '평온', '불만', '모반의 기미', '반란 직전'][st]}」입니다. 귀족 연감에 정확한 충성을 적었습니다.`; en += ` At heart they are "${['Loyal', 'Content', 'Discontent', 'Conspiring', 'On the Brink'][st]}". Their exact loyalty is now in the peerage.`;
            const sp = spouseOf(t.id); if (sp) { // 혼약한 귀족 — 불륜(2026-11-08)
              (sv.affair ??= {})[key] = sp.id; sv.cards[key] = { k: 'scandal', d: today };
              if (![...sv.deck, ...sv.hand, ...sv.disc].some((c) => c.k === 'weak' && c.t === t.id)) sv.hand.push({ id: sv.nextId++, k: 'weak', t: t.id });
              ko += ` 그는 ${sp.ko}과(와) 혼약한 몸입니다 — 이것은 불륜입니다. 추문 약점 카드를 쥐었습니다(협박 +${AFFAIR.blackmail}).`; en += ` They are bound in Union to ${sp.en} — this is an affair. We hold a scandal card (+${AFFAIR.blackmail} to blackmail).`;
              if (sv.ins?.[key]?.journalist) { const [k2, e2] = breakAffair(sid, sv, t, 'press'); ko += ' ' + k2; en += ' ' + e2; }
            } }
          if (j === 'clerk') { sv.net[key] = Math.min(100, (sv.net[key] ?? 0) + COMMON.clerkNet); ko += ` 사내 소문이 들어오기 시작했습니다(정보망 +${COMMON.clerkNet}).`; en += ` Office gossip starts flowing in (network +${COMMON.clerkNet}).`; }
          if (j === 'paparazzo') { ko += ` 그가 어디 가든 렌즈가 따라붙습니다(약점 캐기 +${COMMON.papDirt}).`; en += ` A lens now follows them everywhere (dig up dirt +${COMMON.papDirt}).`; }
          if (j === 'expat') { ko += ` 해마다 동네 이야기를 전해 올 겁니다(정보망 +${COMMON.expatNet}/년).`; en += ` They will pass on neighborhood talk each year (network +${COMMON.expatNet}/yr).`; }
          if (j === 'courier') { ko += ` 저택 출입 시간을 알게 되었습니다(이 귀족 상대 발각 −${COMMON.courierRisk}).`; en += ` We now know the manor's delivery hours (−${COMMON.courierRisk} detection vs this noble).`; }
          if (j === 'cleaner') { if (Math.random() < COMMON.cleanerWeak) { const k = sv.cards[key]?.k ?? weakFor(t); if (!sv.cards[key]) sv.cards[key] = { k, d: today }; if (![...sv.deck, ...sv.hand, ...sv.disc].some((c) => c.k === 'weak' && c.t === t.id)) sv.hand.push({ id: sv.nextId++, k: 'weak', t: t.id }); ko += ` 휴지통에서 약점을 건졌습니다 — ${WEAK_KO[k][0]}.`; en += ` The wastebaskets yielded a weakness — ${WEAK_KO[k][1]}.`; } else { ko += ' 휴지통에서는 아직 쓸 만한 것이 나오지 않았습니다.'; en += ' Nothing useful in the wastebaskets yet.'; } }
          if (j === 'canteen') { // 점심시간 수다 — 숨은 인연 하나(확률)
            const found = Math.random() < COMMON.canteenTie ? withNobleSave(sid, (ns) => { const hidden = CR_BONDS.filter(([k, a, b]) => (a === t.id || b === t.id) && !bondVisible(ns, k, a, b)); if (!hidden.length) return null; const pick = hidden[Math.floor(Math.random() * hidden.length)]; reveal(ns, pick[1], pick[2]); return pick; }) : null;
            const o = found ? byId.get(found[1] === t.id ? found[2] : found[1]) : undefined;
            if (o) { ko += ` 점심시간 수다에서 ${o.ko}과(와)의 숨은 인연이 새어 나왔습니다.`; en += ` Lunchtime chatter let slip a hidden tie with ${o.en}.`; } else { ko += ' 아직 점심시간 수다에서 건질 것은 없었습니다.'; en += ' Nothing useful in the lunchtime chatter yet.'; }
          }
          if (j === 'sleuth') { if (Math.random() < COMMON.sleuthLoyal) { const st = withNobleSave(sid, (ns) => { ns.knownLoyal[t.id] = true; return loyalStage(ns.loyal[t.id] ?? 100); }); ko += ` 흩어진 게시물을 엮어 그의 속마음을 짚어 냈습니다 — 「${['충성', '평온', '불만', '모반의 기미', '반란 직전'][st]}」. 귀족 연감에 적었습니다.`; en += ` Stitching scattered posts together, they read their heart — "${['Loyal', 'Content', 'Discontent', 'Conspiring', 'On the Brink'][st]}". Noted in the Almanac.`; } else { ko += ' 게시물만으로는 속마음까지 알 수 없었습니다.'; en += ' The posts alone did not reveal their heart.'; } }
          if (j === 'streamer') { plantRumor(sid, t.id); withNobleSave(sid, (ns) => { shiftRel(ns, t.id, rulerOf(t.side), COMMON.streamerRel); }); ko += ' 방송에 건강설이 오르기 시작했습니다. 군주가 조금 언짢아합니다.'; en += ' Health rumors start appearing on the stream. Their sovereign is mildly annoyed.'; }
          if (j === 'installer') { ko += ` 저택에 도청기를 달았습니다(이 귀족 정찰 +${COMMON.installerRecon}).`; en += ` A bug is now planted in the manor (recon on this noble +${COMMON.installerRecon}).`; }
          if (j === 'priest') { ko += ` 이제 해마다 그의 양심이 흔들립니다(충성 ${PRIEST_YEAR}/년).`; en += ` From now on their conscience will be stirred each year (loyalty ${PRIEST_YEAR}/yr).`; }
          if (j === 'journalist' && sv.affair?.[key] !== undefined) { const [k2, e2] = breakAffair(sid, sv, t, 'press'); ko += ' ' + k2; en += ' ' + e2; } // 정부가 이미 있으면 불륜을 터뜨린다
          if (j === 'journalist') { plantRumor(sid, t.id); withNobleSave(sid, (ns) => { shiftRel(ns, t.id, rulerOf(t.side), -10); }); ko += ' 건강설과 추문이 돌기 시작했습니다. 군주의 눈길이 차가워집니다.'; en += ' Rumors of ill health and scandal begin to spread. Their sovereign grows cold.'; }
          break;
        }
        case 'poison': { // 중독(2026-11-08 3단계)
          const dv = POISON.hurt[0] + Math.floor(Math.random() * (POISON.hurt[1] - POISON.hurt[0] + 1)) + (x.op.plus ? PLUS.poisonHurt : 0), left = harmNoble(sid, t.id, dv, true), doc = !!sv.ins?.[key]?.doctor;
          if (left <= 0) {
            try { killNoble(sid, t.id, doc ? 'illness' : 'poison', doc ? [`${t.ko}이(가) 오랜 병 끝에 세상을 떠났습니다. 주치의는 병사라고 적었습니다. 영지는 군주 직할이 되었습니다.`, `${t.en} has died after a long illness, according to their physician. The domain passes to the crown.`] : [`${t.ko}이(가) 갑자기 쓰러져 숨을 거두었습니다. 궁정에는 독이라는 말이 돕니다. 영지는 군주 직할이 되었습니다.`, `${t.en} collapsed and died. The court whispers of poison. The domain passes to the crown.`]); } catch (e) { logDiagnostic('warn', 'scenario_intel.poison_failed', { error: (e as Error).message }); }
            ko = `${agKo}의 보고: 마지막 한 접시였습니다. ${t.ko}은(는) 더 이상 일어나지 못합니다.${doc ? ' 주치의가 병사로 적었습니다.' : ''}`; en = `${agEn} reports: that was the last plate. ${t.en} will not rise again.${doc ? ' The physician recorded it as illness.' : ''}`;
          } else { ko = `${agKo}의 보고: 독이 든 음식이 식탁에 올랐습니다. ${t.ko}의 몸에 독이 쌓이고 있습니다.`; en = `${agEn} reports: the poisoned dish reached the table. Poison is building up in ${t.en}'s body.`; }
          break;
        }
        case 'accident': { // 사고(2026-11-08 3단계)
          if (Math.random() < ACCIDENT.survive * (x.op.plus ? 0.5 : 1)) { harmNoble(sid, t.id, ACCIDENT.hurt); ko = `${agKo}의 보고: 리무진이 추락했지만 ${t.ko}은(는) 목숨을 건졌습니다. 크게 다쳤습니다.`; en = `${agEn} reports: the limousine went down, but ${t.en} survived — badly hurt.`; }
          else { try { killNoble(sid, t.id, 'accident', [`${t.ko}을(를) 태운 비행 리무진이 추락했습니다. 생존자는 없습니다. 영지는 군주 직할이 되었습니다.`, `The flying limousine carrying ${t.en} has crashed. There were no survivors. The domain passes to the crown.`]); } catch (e) { logDiagnostic('warn', 'scenario_intel.accident_failed', { error: (e as Error).message }); } ko = `${agKo}의 보고: 사고는 사고로 남을 것입니다. ${t.ko}은(는) 돌아오지 못했습니다.`; en = `${agEn} reports: the accident will stay an accident. ${t.en} did not come back.`; }
          break;
        }
        case 'warplan': { // 2단계 저울질(2026-11-08)
          const x2 = t.side, tn = tensionNow(), wa = 10 + sv.sus.a + sv.hostile.a, wb = 10 + sv.sus.b + sv.hostile.b, p = readPlan(sv, x2, today, tn?.v ?? 0, x2 === 'a' ? wa / (wa + wb) : wb / (wa + wb), Math.random);
          const [ik, ie] = [{ atk: '공격 준비', def: '방어 태세', wait: '관망' }[p.intent], { atk: 'preparing to attack', def: 'in a defensive posture', wait: 'waiting it out' }[p.intent]];
          ko = `${agKo}의 보고: ${sideKo(x2)} 정부의 전쟁 계획을 빼냈습니다. 상대 강대국에 대해서는 「${ik}」입니다.${tn ? ` 두 강대국 사이 긴장은 ${p.tn}.` : ''} 회랑과의 긴장 ${p.hostile}. 다음 적 공작은 ${p.foe ? '이 나라에서 옵니다' : '이 나라에서 오지 않습니다'}. 1년 동안 유효합니다.`;
          en = `${agEn} reports: we have the ${sideEn(x2)} government's war plans. Toward the rival power it is ${ie}.${tn ? ` Great-power tension stands at ${p.tn}.` : ''} Tension with the Corridor: ${p.hostile}. The next enemy operation ${p.foe ? 'will come from them' : 'will not come from them'}. Valid for a year.`; break;
        }
        case 'fleets': { // 함대 동향(2026-11-08): 모드가 그 나라 군 함대를 한 줄씩 찍는다(SCNFLT, intelOnFleetLine) — 세이브를 읽지 않는다
          const x2 = t.side; fleetAsk.set(sid, x2);
          void enqueue(() => sendConsole(`effect sllm_cr_fleet_peek = { S = ${x2} }`)).catch((e) => logDiagnostic('warn', 'scenario_intel.fleet_peek_failed', { error: (e as Error).message }));
          ko = `${agKo}의 보고: ${sideKo(x2)} 함대 사령부의 배치표를 빼냈습니다. 함대 위치를 첩보 지도에 반 년 동안 표시합니다.`;
          en = `${agEn} reports: we have the ${sideEn(x2)} fleet command's deployment chart. Fleet positions will be marked on the espionage map for half a year.`; break;
        }
        case 'summit': { // 정상회담 방해(2026-11-08)
          const s = sv.summit;
          if (!s || s.sab || s.at <= dayOf(today)) { ko = `${agKo}의 보고: 회담이 이미 끝나 손쓸 일이 없었습니다.`; en = `${agEn} reports: the summit was already over; there was nothing left to do.`; break; }
          s.sab = true;
          ko = `${agKo}의 보고: ${sideKo(t.side)} 대표단의 일정과 경호선을 흔들어 놓았습니다. 회담 날 협상은 결렬될 것입니다.`;
          en = `${agEn} reports: we have unsettled the ${sideEn(t.side)} delegation's schedule and security. On the summit day the talks will collapse.`; break;
        }
        case 'tipoff': {
          const x2 = t.side, o = otherSide(x2), p = planOf(sv, x2, dayOf(today));
          if (!p) { ko = `${agKo}의 보고: 넘길 계획이 이미 낡아 ${sideKo(o)}이(가) 받지 않았습니다.`; en = `${agEn} reports: the plans had gone stale, and the ${sideEn(o)} side would not take them.`; break; }
          sv.sus[o] = Math.max(0, sv.sus[o] - CEN.tipThanks.sus); sv.hostile[o] = Math.max(0, sv.hostile[o] - CEN.tipThanks.hostile);
          const n = p.intent === 'atk' ? CEN.tipTn.atk : CEN.tipTn.calm;
          void tensionShift(n, p.intent === 'atk' ? [`회랑이 흘린 ${sideKo(x2)}의 공격 계획`, `Corridor leak: ${sideEn(x2)} attack plans`] : [`회랑이 흘린 ${sideKo(x2)}의 방어 계획`, `Corridor leak: ${sideEn(x2)} defensive plans`]).catch(() => undefined);
          ko = `${agKo}의 보고: ${sideKo(x2)}의 계획을 ${sideKo(o)}에 넘겼습니다. ${sideKo(o)}이(가) 회랑을 한결 믿습니다(의심 −${CEN.tipThanks.sus}, 긴장 −${CEN.tipThanks.hostile}). ${p.intent === 'atk' ? `공격 계획을 본 ${sideKo(o)}이(가) 군을 움직여 두 강대국 사이 긴장이 오릅니다(+${n}).` : `싸울 뜻이 없다는 것을 알고 두 강대국 사이 긴장이 조금 풀립니다(${n}).`}`;
          en = `${agEn} reports: we passed the ${sideEn(x2)} plans to the ${sideEn(o)} side. They trust the Corridor more (suspicion −${CEN.tipThanks.sus}, tension −${CEN.tipThanks.hostile}). ${p.intent === 'atk' ? `Seeing an attack plan, they mobilise; great-power tension rises (+${n}).` : `Learning there is no will to fight, great-power tension eases a little (${n}).`}`; break;
        }
        case 'fakedoc': {
          const up = (x.op.with ?? 1) > 0, n = (CEN.fakeTn + (x.op.plus ? CEN.fakePlus : 0)) * (up ? 1 : -1);
          void tensionShift(n, up ? [`${sideKo(t.side)}에 흘러든 위조 공격 문서`, `Forged attack dossier in the ${sideEn(t.side)} realm`] : [`${sideKo(t.side)}에 흘러든 위조 화해 문서`, `Forged peace dossier in the ${sideEn(t.side)} realm`]).catch(() => undefined);
          ko = `${agKo}의 보고: 위조 문서가 ${sideKo(t.side)} 정부 책상에 올랐습니다. ${up ? `상대가 공격을 준비한다고 믿게 됐습니다 — 두 강대국 사이 긴장 +${n}.` : `상대는 싸울 뜻이 없다고 믿게 됐습니다 — 두 강대국 사이 긴장 ${n}.`}`;
          en = `${agEn} reports: the forged dossier reached the ${sideEn(t.side)} government. ${up ? `They now believe the rival is preparing to strike — great-power tension +${n}.` : `They now believe the rival has no will to fight — great-power tension ${n}.`}`; break;
        }
        case 'incite': if (!sv.rv.includes(t.id)) sv.rv.push(t.id); ko = `${agKo}의 보고: ${t.ko}이(가) 마침내 칼을 뽑기로 했습니다. 반란이 시작됩니다.`; en = `${agEn} reports: ${t.en} has finally resolved to draw the sword. The rebellion begins.`; break;
      }
    } else {
      const acc = accuracy(net);
      ko = acc === 0 ? `${agKo}의 보고: 확인되지 않은 소문만 모았습니다. ${opName0(x.op.kind)[0]} 작전은 성과가 없습니다.` : `${agKo}의 보고: ${opName0(x.op.kind)[0]} 작전이 실패했습니다.`;
      en = acc === 0 ? `${agEn} reports: only unconfirmed rumours. The ${opName0(x.op.kind)[1]} mission came to nothing.` : `${agEn} reports: the ${opName0(x.op.kind)[1]} mission failed.`;
    }
    if (x.caught) { ko += ` 그러나 ${agKo}은(는) ${sideKo(t.side)} 당국에 붙잡혔습니다. 연락이 끊겼습니다.`; en += ` But ${agEn} was caught by the ${sideEn(t.side)} authorities. Contact is lost.`; }
    else if (x.detected) { ko += ' 다만 움직임이 들켜 그 나라가 우리를 더 의심합니다.'; en += ' Their movements were noticed, and that power now suspects us more.'; }
    if (x.detected && x.op.kind === 'frame') { markAudience(sid, 'sus', t.id, false); ko += ' 모함이 드러났습니다.'; en += ' The frame-up has been exposed.'; }
    if (x.detected && x.op.kind === 'fakedoc') { const o = otherSide(t.side); sv.sus[o] = Math.min(100, sv.sus[o] + OPS.fakedoc.hit[0]); ko += ` 위조가 드러나 ${sideKo(o)}도 회랑을 의심합니다.`; en += ` The forgery came to light, and the ${sideEn(o)} side suspects the Corridor too.`; }
    if (x.detected && x.op.kind === 'blackmail') withNobleSave(sid, (ns) => { shiftRel(ns, t.id, 'P', -15); });
    if (x.caught && sv.affair?.[key] !== undefined && Math.random() < 0.5) { const [k2, e2] = breakAffair(sid, sv, t, 'caught'); ko += ' ' + k2; en += ' ' + e2; } // 붙잡힌 공작원이 불륜까지 불었다
    if (x.caught) { const ins = sv.ins?.[key], have = ins ? JOBS.filter((j) => ins[j]) : []; // 붙잡힌 공작원이 불면 그 귀족 곁의 내부자 하나가 드러나 쫓겨난다(절반 확률, 2026-11-08)
      if (have.length && Math.random() < 0.5) { const j = have[Math.floor(Math.random() * have.length)];
        if (Math.random() < DOUBLE.turn) { const d = ((sv.dbl ??= {})[key] ??= []); if (!d.includes(j)) d.push(j); } // 상대가 몰래 돌려세웠다 — 보고서에는 아무것도 안 나온다(이중 첩자)
        else { delete ins![j]; if (!Object.keys(ins!).length) delete sv.ins![key]; ko += ` ${JOB_NAME[j][0]}도 정체가 드러나 쫓겨났습니다.`; en += ` Our ${JOB_NAME[j][1].toLowerCase()} was exposed and dismissed as well.`; } } }
    pushReport(sv, { d: today, kind: x.caught ? 'lost' : x.op.kind, target: t.id, ok: x.ok, ko, en });
    const grave = x.detected && (x.op.kind === 'frame' || x.op.kind === 'incite' || x.op.kind === 'assassinate' || x.op.kind === 'poison' || x.op.kind === 'accident' || x.op.kind === 'fakedoc');
    if (x.caught || grave) ctx.notify({ kind: 'office', title: x.caught ? L('공작원 체포', 'Operative captured') : L('공작이 드러났습니다', 'A plot is exposed'), body: L(ko, en) }); // 급한 일만 바로(B안) — 나머지는 연말 보고서로
    if ((x.caught || grave) && ready() && ctx.curSaveId === sid) void opCmd(t.side, grave ? 'exposed' : 'caught').catch((e) => logDiagnostic('warn', 'scenario_intel.op_failed', { error: (e as Error).message }));
    if (grave) { try { chronNoteWorld(L(`회랑의 ${opName0(x.op.kind)[0]} 공작이 ${sideKo(t.side)}에 드러났습니다.`, `A Corridor ${opName0(x.op.kind)[1]} plot was exposed in the ${sideEn(t.side)} realm.`), true); } catch { /* 덤 */ } }
  }
  // 의심도 단계·최후통첩
  for (const e of res.events) {
    const x = e.side;
    if (e.kind === 'stage') {
      const ko = e.st === 1 ? `${sideKo(x)}이(가) 회랑을 경계하기 시작했습니다. 그 나라 방첩이 강해집니다.` : `${sideKo(x)}이(가) 감찰관을 보냈습니다. 그 나라에서의 작전이 한층 위험해집니다.`;
      const en = e.st === 1 ? `The ${sideEn(x)} realm has grown wary of the Corridor. Its counter-intelligence tightens.` : `The ${sideEn(x)} realm has sent inspectors. Operations there grow more dangerous.`;
      pushReport(sv, { d: today, kind: 'alert', target: -1, ok: false, ko, en }); ctx.notify({ kind: 'office', title: L('의심도 상승', 'Suspicion rising'), body: L(ko, en) });
    } else if (e.kind === 'ult') {
      const ko = `${sideKo(x)}이(가) 최후통첩을 보냈습니다: 공작원을 넘기거나 배상금 ${IN.ultPay}을(를) 내라. ${IN.ultDays}일 안에 답하지 않으면 거절로 봅니다. 회랑 정보국에서 답하세요.`;
      const en = `The ${sideEn(x)} realm has issued an ultimatum: hand over our operatives or pay ${IN.ultPay} in reparations. No answer within ${IN.ultDays} days counts as refusal. Answer in the Intelligence bureau.`;
      pushReport(sv, { d: today, kind: 'ult', target: -1, ok: false, ko, en }); ctx.notify({ kind: 'office', title: L('최후통첩', 'Ultimatum'), body: L(ko, en) });
    } else ultAnswered(sid, sv, x, 'refuse', today, true);
  }
}
/** 혼약 상대(공개 인연 union). */
function spouseOf(id: number): NobleRow | null { const b = CR_BONDS.find(([k, a, c]) => k === 'union' && (a === id || c === id)); return b ? byId.get(b[1] === id ? b[2] : b[1]) ?? null : null; }
/** 불륜이 터진다(2026-11-08): 배우자와 원수 · 군주의 눈 밖 · 충성 흔들림. 정부는 쫓겨나고 추문 카드는 쓸모를 잃는다. */
function breakAffair(sid: string, sv: IntelSave, t: NobleRow, how: 'press' | 'caught'): [string, string] {
  const key = String(t.id), spId = sv.affair?.[key]; if (spId === undefined) return ['', ''];
  const sp = byId.get(spId); delete sv.affair![key];
  if (sv.ins?.[key]?.lover) delete sv.ins[key].lover;
  withNobleSave(sid, (ns) => { if (sp) shiftRel(ns, t.id, sp.id, AFFAIR.spouse); shiftRel(ns, t.id, rulerOf(t.side), AFFAIR.ruler); shiftLoyal(ns, t.id, AFFAIR.loyal); });
  const ko = `${how === 'press' ? '전속 기자가 불륜을 터뜨렸습니다' : '붙잡힌 공작원의 입에서 불륜이 새어 나갔습니다'}: ${t.ko}과(와) 그의 정부 이야기가 궁정을 뒤흔듭니다.${sp ? ` ${sp.ko}은(는) 배신감에 이를 갈고,` : ''} 군주의 눈길은 차가워졌습니다.`;
  const en = `${how === 'press' ? 'Our court journalist broke the affair' : 'The captured operative let the affair slip'}: the tale of ${t.en} and their lover shakes the court.${sp ? ` ${sp.en} seethes at the betrayal, and` : ''} the sovereign's gaze has turned cold.`;
  try { chronNoteWorld(L(ko, en), true); } catch { /* 덤 */ }
  return [ko, en];
}
const opName0 = (k: OpKind): [string, string] => ({ poison: ['독살', 'poisoning'], accident: ['사고 공작', 'staged accident'], ins_cook: ['요리사 매수', 'cook-buying'], ins_clerk: ['회사 직원 매수', 'clerk-buying'], ins_paparazzo: ['파파라치 매수', 'paparazzo-buying'], ins_expat: ['비자 거주자 포섭', 'visa-resident recruiting'], ins_courier: ['배달원 매수', 'courier-buying'], ins_cleaner: ['청소부 매수', 'cleaner-buying'], ins_canteen: ['사내 식당 요리사 매수', 'canteen-cook buying'], ins_sleuth: ['인터넷 탐정 고용', 'sleuth hiring'], ins_streamer: ['스트리머 매수', 'streamer-buying'], ins_installer: ['설치 기사 매수', 'installer-buying'], ins_doctor: ['주치의 매수', 'physician-buying'], ins_driver: ['운전수 매수', 'chauffeur-buying'], ins_mech: ['정비사 매수', 'mechanic-buying'], ins_butler: ['집사 매수', 'butler-buying'], ins_secretary: ['비서 매수', 'secretary-buying'], ins_guard: ['경호대장 매수', 'guard-buying'], ins_treasurer: ['회계관 매수', 'treasurer-buying'], ins_lover: ['정부 들이기', 'lover-planting'], ins_priest: ['고해신부 매수', 'confessor-buying'], ins_journalist: ['기자 매수', 'journalist-buying'], identify: ['신원 파악', 'identify'], loyalty: ['충성도 탐지', 'gauge loyalty'], ties: ['인연 캐기', 'uncover ties'], bribe: ['매수', 'bribery'], sow: ['이간질', 'discord'], dirt: ['약점 캐기', 'dirt-digging'], blackmail: ['협박', 'blackmail'], frame: ['누명', 'frame-up'], incite: ['반란 부추기기', 'incitement'], assassinate: ['암살', 'assassination'], warplan: ['전쟁 계획 입수', 'war-plan theft'], tipoff: ['정보 흘리기', 'leak'], fakedoc: ['위조 문서', 'forged dossier'] } as Record<OpKind, [string, string]>)[k];

/** 연말 보고서(B안): 그해 보고서함을 한 장으로 요약해 보고서함 맨 위(kind 'year')에 둔다. 그해 기록이 없으면 null. */
function yearReport(sv: IntelSave, year: number, today: string, dom: Array<{ ko: string; en: string }> = []): { ko: string; en: string } | null {
  const rs = sv.reports.filter((r) => r.d.startsWith(`${year}.`) && r.kind !== 'year' && r.kind !== 'hire');
  if (!rs.length && !dom.length) return null;
  const ops = rs.filter((r) => (OP_KINDS as string[]).includes(r.kind)), ok = ops.filter((r) => r.ok).length, bad = ops.length - ok, lost = rs.filter((r) => r.kind === 'lost').length;
  const sus = `${sideKo('a')} ${Math.round(sv.sus.a)} · ${sideKo('b')} ${Math.round(sv.sus.b)}`, susEn = `${sideEn('a')} ${Math.round(sv.sus.a)} · ${sideEn('b')} ${Math.round(sv.sus.b)}`;
  const ko = `${year}년 연말 보고서 — 작전 ${ops.length}건 중 성공 ${ok}, 실패 ${bad}${lost ? `, 잃은 공작원 ${lost}명` : ''}. 지금 의심도: ${sus}.`;
  const en = `${year} year-end report — ${ops.length} missions: ${ok} succeeded, ${bad} failed${lost ? `, ${lost} operative(s) lost` : ''}. Current suspicion: ${susEn}.`;
  const lines = rs.slice(-12);
  // 귀족 정세(영역다툼·귀족 외교, 2026-11-07): 그해 연례 판단에서 나온 줄
  const dk = dom.length ? ['', '[귀족 정세]', ...dom.slice(0, 14).map((x) => `· ${x.ko}`)] : [], de = dom.length ? ['', '[Noble affairs]', ...dom.slice(0, 14).map((x) => `· ${x.en}`)] : [];
  pushReport(sv, { d: today, kind: 'year', target: -1, ok: true, ko: [ko, ...lines.map((r) => `· ${r.d} ${r.ko}`), ...dk].join('\n'), en: [en, ...lines.map((r) => `· ${r.d} ${r.en}`), ...de].join('\n') });
  return { ko, en };
}

// ---- 적 공작: 방첩 대전(2026-11-08, 슬레이 더 스파이어식 — scenario-duel.ts) ----
const foeName = (k: FoeKind): string => ({ hunt: L('공작원 사냥', 'Operative hunt'), purge: L('내부자 숙청', 'Insider purge'), jam: L('정보망 교란', 'Network jamming'), smear: L('흑색선전', 'Smear campaign'), subvert: L('회랑 귀족 포섭', 'Subvert our lord') })[k];
const DNAME: Record<DCard, [string, string]> = {
  probe: ['탐침', 'Probe'], brute: ['무차별 대입', 'Brute Force'], phish: ['스피어 피싱', 'Spear Phishing'], fund: ['공작 자금', 'Slush Fund'], rehack: ['역해킹', 'Hack Back'], backdoor: ['백도어 심기', 'Plant Backdoor'],
  chain: ['연쇄 해킹', 'Chain Exploit'], ddos: ['디도스', 'DDoS'], expose: ['약점 폭로', 'Expose'], exfil: ['데이터 탈취', 'Exfiltrate'], spread: ['백도어 확산', 'Spread Backdoor'], jamsig: ['교란 신호', 'Jamming Signal'],
  zeroday: ['제로데이', 'Zero-Day'], offensive: ['공세 전환', 'Go on the Offensive'], execute: ['암살 명령', 'Kill Order'],
  firewall: ['방화벽', 'Firewall'], encrypt: ['암호화', 'Encrypt'], patch: ['보안 패치', 'Security Patch'], lowkey: ['잠적', 'Lie Low'], decoy: ['미끼 서버', 'Decoy Server'], drone: ['감시 드론', 'Watch Drone'],
  redund: ['이중화', 'Redundancy'], trace: ['역추적', 'Traceback'], honeypot: ['허니팟', 'Honeypot'], disinfo: ['역정보', 'Disinformation'], command: ['방첩부장 지휘', "Chief's Command"], isolate: ['격리', 'Quarantine'],
  thorns: ['반격 태세', 'Counterstrike Stance'], lockdown: ['봉쇄', 'Lockdown'], backup: ['비상 백업', 'Emergency Backup'], rumor: ['헛소문', 'Idle Rumor'],
};
const dName = (k: DCard): string => L(...DNAME[k]);
function dDesc(c: DC): string {
  const n = dn(c), p = !!c.plus;
  const t: Record<DCard, [string, string]> = {
    probe: [`${n} 피해. 카드 1장 뽑기.`, `Deal ${n}. Draw 1.`], brute: [`${n} 피해.`, `Deal ${n}.`], phish: [`${n} 피해. 상대 손패 무작위 1장을 버리게 한다.`, `Deal ${n}. The enemy discards a random card.`],
    fund: [`이번 턴 마나 +${p ? 2 : 1}.`, `Gain ${p ? 2 : 1} mana this turn.`], rehack: [`${n} 피해.`, `Deal ${n}.`], backdoor: [`백도어: 상대 턴 시작마다 ${n} 피해(3턴).`, `Backdoor: ${n} damage at the start of each enemy turn (3 turns).`],
    chain: [`${n} 피해. 이번 턴 앞서 낸 카드 1장마다 +1.`, `Deal ${n}, +1 per card played earlier this turn.`], ddos: [`${n} 피해 5번.`, `Deal ${n} five times.`], expose: [`${n} 피해. 이번 턴 동안 상대가 받는 피해 +50%.`, `Deal ${n}. The enemy takes 50% more damage this turn.`],
    exfil: [`${n} 피해. 카드 2장 뽑기.`, `Deal ${n}. Draw 2.`], spread: ['상대 백도어 남은 턴을 두 배로 하고 한 번 바로 터뜨린다(없으면 백도어 1을 심는다).', 'Double the enemy backdoor duration and trigger it once now (or plant Backdoor 1).'],
    jamsig: [`상대의 다음 턴 마나 −${p ? 3 : 2}.`, `The enemy has ${p ? 3 : 2} less mana next turn.`], zeroday: [`방벽을 무시하고 ${n} 피해.`, `Deal ${n}, ignoring armor.`],
    offensive: [`상시: 우리 카드의 피해 +${p ? 2 : 1}.`, `Power: our cards deal +${p ? 2 : 1} damage.`], execute: [`공작선이 ${D.execAt + (p ? 3 : 0)} 이하면 바로 끊는다. 아니면 ${n} 피해.`, `If their line is at ${D.execAt + (p ? 3 : 0)} or less, cut it now. Otherwise deal ${n}.`],
    firewall: [`방어 버퍼: 그 노드 피해 −${n}.`, `Buffer: that node deals −${n}.`], encrypt: [`방어 버퍼: 그 노드 피해 −${n}. 카드 1장 뽑기.`, `Buffer: that node deals −${n}. Draw 1.`], patch: [`보안망 ${n} 회복.`, `Restore ${n} security.`],
    lowkey: [`방어 버퍼: 그 노드 피해 −${n}. 다음 턴 카드 1장 더.`, `Buffer: that node deals −${n}. Draw 1 more next turn.`], decoy: [`방어 버퍼: 그 노드 피해 −${n}.`, `Buffer: that node deals −${n}.`], drone: [`상시: 우리 턴 시작마다 방벽 ${p ? 2 : 1}.`, `Power: gain ${p ? 2 : 1} armor at the start of each turn.`],
    redund: [`방어 버퍼: 그 노드 피해 −${n}. 다음 턴 시작에 방벽 ${n}.`, `Buffer: that node deals −${n}. Gain ${n} armor next turn.`], trace: ['방어 버퍼: 그 노드에 맞은 만큼 공작선에 되돌린다.', 'Buffer: whatever that node deals to us is dealt back to their line.'],
    honeypot: ['방어 버퍼: 그 노드를 통째로 헛돌게 한다.', 'Buffer: that node whiffs entirely.'], disinfo: [`상대 손패 무작위 ${p ? 2 : 1}장을 「헛소문」으로 바꾼다.`, `Turn ${p ? 2 : 1} random enemy card(s) into "Idle Rumor".`],
    command: ['지금 방벽을 두 배로.', 'Double your current armor.'], isolate: [`상대의 백도어·상시 효과를 모두 지운다. 방벽 ${p ? 5 : 3}.`, `Remove all enemy backdoors and powers. Gain ${p ? 5 : 3} armor.`],
    thorns: [`상시: 피해를 받을 때마다 상대에게 ${p ? 2 : 1} 피해.`, `Power: deal ${p ? 2 : 1} back whenever we take damage.`], lockdown: ['비밀: 보안망이 무너질 피해를 받으면 1로 버틴다.', 'Secret: when lethal damage would hit, survive at 1.'],
    backup: [`보안망 ${n} 회복. 방벽 ${p ? 6 : 5}.`, `Restore ${n} security. Gain ${p ? 6 : 5} armor.`], rumor: ['아무 일도 없는 쓸모없는 카드.', 'A useless card that does nothing.'],
  };
  return L(...t[c.k]);
}
const dCardView = (c: DC) => ({ id: c.id, k: c.k, art: 'd_' + c.k, ...(DCARDS[c.k].buf ? { buf: true } : {}), type: DCARDS[c.k].junk ? 'curse' : DCARDS[c.k].side === 'atk' ? 'op' : 'counter', ...(DCARDS[c.k].secret ? { secret: true } : {}), rar: DCARDS[c.k].rar, name: dName(c.k) + (c.plus ? '+' : ''), short: dDesc(c), desc: dDesc(c), cost: DCARDS[c.k].cost, side: DCARDS[c.k].side, ...(c.plus ? { plus: true } : {}) });
const counterWhyText = (w: PlayWhyD): string => ({ '': '', over: L('대전이 이미 끝났습니다.', 'The duel is already over.'), nocard: L('손패에 없는 카드입니다.', 'That card is not in hand.'), mana: L('마나가 모자랍니다.', 'Not enough mana.'), node: L('이 카드는 상대 노드의 방어 버퍼에 넣어야 합니다.', 'This card must be injected into an enemy node buffer.'), nobuf: L('방어 버퍼에 넣는 카드가 아닙니다.', 'That card does not go into a buffer.'), full: L(`우리 필드가 가득 찼습니다(방어 버퍼 ${D.field}장까지).`, `Our field is full (${D.field} buffer cards max).`) })[w];
/** 표적 이름 [한, 영] */
function foeTarget(sid: string, sv: IntelSave, k: FoeKind, tgt: number): [string, string] {
  if (k === 'hunt') { const a = sv.agents.find((x) => x.id === tgt); return a ? [`우리 공작원 ${a.ko}`, `our operative ${a.en}`] : ['우리 공작원', 'our operative']; }
  if (k === 'purge' || k === 'jam') { const n = byId.get(tgt); return n ? [`${n.ko} 곁의 우리 ${k === 'purge' ? '내부자' : '정보망'}`, `our ${k === 'purge' ? 'insiders around' : 'network around'} ${n.en}`] : ['우리 정보망', 'our network']; }
  if (k === 'subvert') { const c = cnActive(sid).find((x) => x.lid === tgt); return c ? [`회랑의 귀족 ${c.name}`, `our lord ${c.name}`] : ['회랑의 귀족', 'our lord']; }
  return ['회랑의 평판', "the Corridor's standing"];
}
const foeWho = (sv: IntelSave, side: NSide, by: number, seen: boolean): [string, string] => { const n = byId.get(by); return seen && n ? [n.ko, n.en] : [`정체를 알 수 없는 ${sideKo(side)} 귀족`, `an unknown ${sideEn(side)} noble`]; };
function foeView(sid: string, sv: IntelSave, now: number): Record<string, unknown> {
  const ch = chiefOf(sv), out: Record<string, unknown> = { shp: Math.round(shpOf(sv)), shpMax: D.hpMax, chief: { w: ch.w, l: ch.l, auto: chiefChance(ch.w), unlock: D.chief.unlock }, ddeck: duelDeck(sv).map(dCardView),
    dshop: { max: D.deckMax, min: DSHOP.min, remove: DSHOP.remove, upgrade: dUpgradable(duelDeck(sv)).map((k) => ({ k, name: dName(k) })) } };
  const f = sv.foe;
  if (f) {
    const du = f.duel, who = foeWho(sv, f.side, f.by, f.seen);
    const sideV = (x: DSide, me: boolean) => ({ hp: x.hp, max: x.max, armor: x.armor, mana: x.mana, maxMana: x.maxMana, overload: x.overload, power: x.power, drone: x.drone, thorns: x.thorns, poison: x.poisonT ? x.poison : 0, poisonT: x.poisonT, vuln: x.vuln,
      nDeck: x.deck.length, nHand: x.hand.length, ...(me ? { secrets: x.secrets.map((k) => dName(k)) } : { secrets: x.secrets.length }) });
    out.foe = {
      id: f.id, side: f.side, sideName: sideName(f.side), who: L(who[0], who[1]), seen: f.seen, left: Math.max(0, f.due - now), turn: du.turn, turns: D.turns,
      ops: f.ops.map((o) => { const t = foeTarget(sid, sv, o.k, o.tgt); return { k: o.k, icon: FOE.icon[o.k], name: foeName(o.k), tgt: L(t[0], t[1]) }; }),
      me: sideV(du.me, true), en: sideV(du.foe, false), hand: du.me.hand.map(dCardView), played: du.foePlayed.map(dCardView),
      nodes: du.nodes.map((t, i) => { const e = nodeEst(du, t); return { i, card: { ...dCardView(t.card), type: 'foe', frame: 'foe' }, buf: t.buf.map(dCardView), ...e }; }),
      field: D.field, nBuf: bufCount(du),
      proj: Math.max(0, du.me.hp - Math.max(0, du.nodes.reduce((a, t) => a + nodeEst(du, t).dmg, 0) - du.me.armor)),
      lastRes: du.lastRes.map((r) => ({ name: dName(r.k), dmg: r.dmg, how: r.how })),
      mine: (du.mine ?? []).map((m) => ({ ...dCardView(m.c), dmg: m.dmg, ...(m.node !== undefined ? { node: m.node } : {}) })), mineLast: (du.mineLast ?? []).map((m) => ({ ...dCardView(m.c), dmg: m.dmg, ...(m.node !== undefined ? { node: m.node } : {}) })), // 우리가 낸 카드(2026-11-08)
      log: du.log.slice(-6).map((l) => L(l[0], l[1])), over: du.over ?? null,
    };
  }
  if (sv.foeLast) { const l = sv.foeLast, who = foeWho(sv, l.side, l.by, l.seen);
    out.foeLast = { d: l.d, res: l.res, auto: l.auto ?? null, sideName: sideName(l.side), who: L(who[0], who[1]), text: L(l.ko, l.en), ops: l.ops.map((k) => ({ icon: FOE.icon[k], name: foeName(k) })),
      offer: (l.offer ?? []).map((k) => dCardView({ id: 0, k })) }; }
  return out;
}
/** 위협 탭(2026-11-08 사용자: 「상대방이 우리에게 공격이 오는 걸 잘 보여 줘야」): 다가오는 위협을 급한 순으로 모은다.
 *  lvl: 3 지금 막아야 함 · 2 곧 · 1 지켜볼 것. days: 남은 날(있으면). */
function threatList(sid: string, sv: IntelSave, now: number): Array<Record<string, unknown>> {
  const out: Array<{ lvl: number; icon: string; title: string; text: string; days?: number; act?: string }> = [];
  const f = sv.foe;
  if (f) { const who = foeWho(sv, f.side, f.by, f.seen); out.push({ lvl: 3, icon: '\u26A0', title: L('방첩 대전 진행 중', 'Counter-intel duel in progress'), days: Math.max(0, f.due - now), act: 'duel',
    text: L(`${who[0]}이(가) 공작선을 펼쳤습니다 — 노리는 것: ${f.ops.map((o) => foeName(o.k)).join(', ')}. 턴 ${f.duel.turn}/${D.turns} · 우리 보안망 ${f.duel.me.hp} · 공작선 ${f.duel.foe.hp}. 기한 안에 안 하면 첩보부장이 대신 맞섭니다.`, `${who[1]} has opened an operation line — aiming for: ${f.ops.map((o) => foeName(o.k)).join(', ')}. Turn ${f.duel.turn}/${D.turns} · our grid ${f.duel.me.hp} · their line ${f.duel.foe.hp}. If not handled in time, the spymaster steps in.`) }); }
  for (const x of ['a', 'b'] as NSide[]) {
    const u = sv.ult[x];
    if (u) out.push({ lvl: 3, icon: '\u{1F4DC}', title: L(`${sideName(x)}의 최후통첩`, `Ultimatum from ${sideName(x)}`), days: Math.max(0, u.due - now), text: L(`공작원을 넘기거나 배상금 ${IN.ultPay}을(를) 내라고 요구합니다. 기한이 지나면 거절로 봅니다(긴장 크게 오름).`, `They demand our operatives or ${IN.ultPay} in reparations. Silence counts as refusal (tension soars).`) });
    const h = sv.hostile[x], rk = sv.reck?.[x] ?? 0;
    if (h >= IN.reckAt * 0.6) out.push({ lvl: h >= IN.reckAt * 0.85 ? 3 : 2, icon: '\u2694', title: L(`${sideName(x)}과(와)의 긴장 ${Math.round(h)}/${IN.reckAt}`, `Tension with ${sideName(x)} ${Math.round(h)}/${IN.reckAt}`), text: L(`${IN.reckAt}에 닿으면 30일 예고 뒤 회랑에 선전포고합니다.${rk > now ? ` (지난 응징 뒤 ${Math.ceil((rk - now) / 30)}달 동안은 다시 오지 않음)` : ''}`, `At ${IN.reckAt} they declare war on the Corridor after 30 days' notice.${rk > now ? ` (No repeat for ${Math.ceil((rk - now) / 30)} months after the last one)` : ''}`) });
    const v = sv.sus[x], st = susStage(v);
    if (st >= 2 && !u) out.push({ lvl: st >= 3 ? 3 : 2, icon: '\u{1F441}', title: L(`${sideName(x)}의 의심 ${Math.round(v)}`, `${sideName(x)} suspicion ${Math.round(v)}`), text: st >= 3 ? L('최후통첩이 언제든 올 수 있습니다. 작전을 쉬며 의심을 가라앉히세요.', 'An ultimatum can come any time. Lie low to let suspicion settle.') : L(`감찰 단계 — 작전이 더 위험합니다. ${IN.susStage[2]}이면 최후통첩.`, `Inspection — missions are riskier. At ${IN.susStage[2]}, an ultimatum.`) });
  }
  if (!f && sv.foeNext !== undefined) { const left = Math.max(0, sv.foeNext - now), pl = (['a', 'b'] as NSide[]).find((x) => planOf(sv, x, now)?.foe), seen = !!pl || Object.values(sv.ins ?? {}).some((v) => FOE.seeJobs.some((j) => v[j]));
    if (left <= 180 || seen) out.push({ lvl: left <= 90 ? 2 : 1, icon: '\u{1F575}', title: L('다음 적 공작 예상', 'Next enemy operation'), ...(seen ? { days: left } : {}), text: pl ? L(`빼낸 전쟁 계획에 다음 공작이 적혀 있습니다 — ${sideName(pl)}에서 옵니다. 방첩 덱을 손봐 두세요.`, `The stolen war plans name the next operation — it comes from ${sideName(pl)}. Tune the counter-intel deck.`) : seen ? L('상대 귀족 곁의 내부자가 다음 공작 시점을 알려 왔습니다. 방첩 덱을 손봐 두세요.', 'An insider close to their nobles leaked the timing. Tune the counter-intel deck.') : L('상대 쪽 움직임이 잦아졌습니다. 반년 안에 공작이 올 수 있습니다.', 'Enemy activity is picking up. An operation may come within six months.') }); }
  const g = shpOf(sv); if (g < D.hpMax * 0.5) out.push({ lvl: g < D.hpMax * 0.3 ? 2 : 1, icon: '\u{1F6E1}', title: L(`우리 보안망 ${Math.round(g)}/${D.hpMax}`, `Our security grid ${Math.round(g)}/${D.hpMax}`), text: L('다음 방첩 대전을 깎인 채로 시작합니다. 매달 조금씩 회복합니다.', 'The next duel starts with this grid. It recovers a little each month.') });
  for (const n of cnRisky(sid)) out.push({ lvl: n.risk ? 2 : 1, icon: '\u{1F451}', title: L(`회랑의 귀족 ${n.name} — 충성 ${n.loyal}`, `Our lord ${n.name} — loyalty ${n.loyal}`), text: n.risk ? L('배신할 수 있는 수준입니다. 접견으로 달래거나 내부 단속을 하세요.', 'Disloyal enough to betray us. Win them over in an audience or purge their circle.') : L('불온합니다. 더 떨어지면 배신을 꾀합니다.', 'Restless. Any lower and they may plot betrayal.') });
  const lost = sv.agents.filter((a) => a.st === 'lost').length; if (lost) out.push({ lvl: 1, icon: '\u26D3', title: L(`붙잡힌 공작원 ${lost}명`, `${lost} operative(s) captured`), text: L('붙잡힌 공작원은 돌아오지 않습니다. 빈자리는 새로 영입하세요.', 'Captured operatives do not return. Recruit replacements.') });
  return out.sort((a, b) => b.lvl - a.lvl || (a.days ?? 9999) - (b.days ?? 9999));
}
/** 1~3년마다 얼라이언스나 제국의 귀족 하나가 덤빈다 */
function foeSpawn(sid: string, sv: IntelSave, today: string): boolean {
  const rnd = Math.random;
  const gone = withNobleSave(sid, (ns) => (id: number) => !!(ns.fate[id] || ns.pending[id]));
  const wa = 10 + sv.sus.a + sv.hostile.a, wb = 10 + sv.sus.b + sv.hostile.b, side: NSide = sv.foeSide ?? (rnd() * (wa + wb) < wa ? 'a' : 'b'); // 전쟁 계획으로 엿봤으면 그 나라
  sv.foeSide = undefined; for (const p of Object.values(sv.plan ?? {})) if (p) p.foe = false;
  const mine = CR_NOBLES.filter((n) => n.side === side && !gone(n.id)); if (!mine.length) return false;
  const by = mine[Math.floor(rnd() * mine.length)];
  const agents = sv.agents.filter((a) => a.st !== 'lost'), atSide = agents.filter((a) => a.at !== null && byId.get(a.at)?.side === side), hunt = atSide.length ? atSide : agents;
  const insN = mine.filter((n) => Object.keys(sv.ins?.[String(n.id)] ?? {}).length).sort((x, y) => Object.keys(sv.ins?.[String(y.id)] ?? {}).length - Object.keys(sv.ins?.[String(x.id)] ?? {}).length);
  const netN = mine.filter((n) => (sv.net[String(n.id)] ?? 0) >= 20).sort((x, y) => (sv.net[String(y.id)] ?? 0) - (sv.net[String(x.id)] ?? 0));
  const lords = cnActive(sid);
  const tgtOf: Record<FoeKind, number | null> = {
    hunt: hunt.length ? hunt[Math.floor(rnd() * hunt.length)].id : null, purge: insN.length ? insN[0].id : null, jam: netN.length ? netN[0].id : null,
    smear: -1, subvert: lords.length ? lords[Math.floor(rnd() * lords.length)].lid : null,
  };
  const f = foeBuild(sv, side, by.id, today, tgtOf, sv.sus[side] + sv.hostile[side], rnd); if (!f) return false;
  sv.foe = f;
  const who = foeWho(sv, side, by.id, f.seen), goal = f.ops.map((o) => { const t = foeTarget(sid, sv, o.k, o.tgt); return [`${foeName(o.k)}(${t[0]})`, `${foeName(o.k)} (${t[1]})`]; });
  const ko = `⚠ 경보: ${who[0]}이(가) 우리 보안망을 치고 들어옵니다 — 노리는 것: ${goal.map((g) => g[0]).join(', ')}. ${FOE.days}일 안에 회랑 정보국에서 방첩 대전으로 공작선을 끊으세요(그 안에 안 하면 첩보부장이 대신 맞섭니다).`;
  const en = `⚠ Alert: ${who[1]} is striking at our security grid — aiming for: ${goal.map((g) => g[1]).join(', ')}. Cut their line in a counter-intelligence duel in the Intelligence bureau within ${FOE.days} days (otherwise the spymaster faces them alone).`;
  pushReport(sv, { d: today, kind: 'alert', target: -1, ok: false, ko, en });
  ctx.notify({ kind: 'office', title: L('⚠ 적 공작 감지', '⚠ Enemy operation detected'), body: L(ko, en) });
  logDiagnostic('info', 'scenario_intel.foe_spawn', { sid, side, by: by.id, ops: f.ops.map((o) => o.k).join(','), ehp: f.duel.foe.max });
  return true;
}
/** 침투 임무 하나의 효과 */
function foeHit(sid: string, sv: IntelSave, side: NSide, k: FoeKind, tgt: number, t: [string, string]): [string, string] {
  const key = String(tgt);
  if (k === 'hunt') { const a = sv.agents.find((x) => x.id === tgt && x.st !== 'lost'); if (!a) return ['표적이었던 공작원은 이미 자리에 없었습니다.', 'The targeted operative was already gone.']; a.st = 'lost'; a.at = null; sv.ops = sv.ops.filter((o) => o.agent !== a.id); return [`${t[0]}이(가) 붙잡혔습니다.`, `${t[1]} was captured.`]; }
  if (k === 'purge') { const ins = sv.ins?.[key], have = ins ? JOBS.filter((j) => ins[j]) : []; const out = have.sort(() => Math.random() - 0.5).slice(0, FOE.purgeN); for (const j of out) { delete ins![j]; if (sv.dbl?.[key]) sv.dbl[key] = sv.dbl[key].filter((x) => x !== j); } if (ins && !Object.keys(ins).length) delete sv.ins![key];
    return out.length ? [`${out.map((j) => JOB_NAME[j][0]).join('·')}이(가) 들통나 쫓겨났습니다.`, `Exposed and dismissed: ${out.map((j) => JOB_NAME[j][1].toLowerCase()).join(', ')}.`] : ['쫓겨날 내부자가 이미 없었습니다.', 'No insiders were left to purge.']; }
  if (k === 'jam') { const v = sv.net[key] ?? 0, to = Math.max(0, v - FOE.jamNet); if (to > 0) sv.net[key] = to; else delete sv.net[key]; return [`${t[0]} ${Math.round(v)} → ${Math.round(to)}.`, `${t[1]} ${Math.round(v)} → ${Math.round(to)}.`]; }
  if (k === 'smear') { sv.sus[side] = Math.min(100, sv.sus[side] + FOE.smearSus); sv.hostile[side] = Math.min(100, sv.hostile[side] + FOE.smearHostile); return [`회랑을 헐뜯는 소문이 퍼졌습니다(의심 +${FOE.smearSus}, 긴장 +${FOE.smearHostile}).`, `Slander spread (suspicion +${FOE.smearSus}, tension +${FOE.smearHostile}).`]; }
  const d = cnobleShake(sid, tgt, FOE.subvertLoyal); return d ? [`${t[0]}의 충성 ${d}.`, `${t[1]}: loyalty ${d}.`] : [`${t[0]}은(는) 이미 자리에 없었습니다.`, `${t[1]} was no longer in place.`];
}
/** 대전 결과를 반영(직접 끝냈거나, 첩보부장이 대신 했거나) */
function foeFinish(sid: string, sv: IntelSave, today: string, res: FoeRes, auto?: number): void {
  const f = sv.foe; if (!f) return;
  const now = dayOf(today), by = byId.get(f.by), ch = chiefOf(sv);
  let ko = '', en = '';
  if (res === 'win') {
    ch.w++; f.seen = true;
    ko = `${auto !== undefined ? `첩보부장이 대신 맞서(승률 ${auto}%) ` : ''}공작선을 끊어냈습니다. 침투 임무는 모두 무산되었습니다.`; en = `${auto !== undefined ? `The spymaster stepped in (${auto}% odds) and ` : 'We '}cut their operation line. Every infiltration failed.`;
    if (by) { const k2 = sv.cards[String(by.id)]?.k ?? weakFor(by); if (!sv.cards[String(by.id)]) sv.cards[String(by.id)] = { k: k2, d: today };
      if (![...sv.deck, ...sv.hand, ...sv.disc].some((c) => c.k === 'weak' && c.t === by.id)) sv.hand.push({ id: sv.nextId++, k: 'weak', t: by.id });
      ko += ` 배후는 ${by.ko}였습니다 — 약점(${WEAK_KO[k2][0]})을 쥐었습니다.`; en += ` ${by.en} was behind it — we now hold their weakness (${WEAK_KO[k2][1]}).`; }
    ko += ` 첩보부장 ${ch.w}승.`; en += ` Spymaster: ${ch.w} win(s).`;
    if (ch.w === D.chief.unlock) { ko += ` 이제 첩보부장에게 대전을 맡길 수 있습니다(승률 ${chiefChance(ch.w)}%).`; en += ` The spymaster can now take duels for us (${chiefChance(ch.w)}% odds).`; }
  } else if (res === 'draw') {
    ko = `${auto !== undefined ? `첩보부장이 대신 맞서 ` : ''}${D.turns}턴을 버텼습니다. 상대가 물러나 침투 임무는 무산되었습니다.`; en = `${auto !== undefined ? 'The spymaster ' : 'We '}held for ${D.turns} turns. The enemy withdrew; the infiltrations failed.`;
  } else {
    ch.l++;
    ko = `${auto !== undefined ? `첩보부장이 대신 맞섰지만(승률 ${auto}%) ` : ''}보안망이 무너졌습니다.`; en = `${auto !== undefined ? `The spymaster stepped in (${auto}% odds), but our` : 'Our'} security grid fell.`;
    for (const o of f.ops) { const t = foeTarget(sid, sv, o.k, o.tgt), [k2, e2] = foeHit(sid, sv, f.side, o.k, o.tgt, t); ko += ` [${foeName(o.k)}] ${k2}`; en += ` [${foeName(o.k)}] ${e2}`; }
  }
  const who = foeWho(sv, f.side, f.by, f.seen);
  ko = `${who[0]}과(와)의 방첩 대전 — ${ko}`; en = `Counter-intelligence duel with ${who[1]} — ${en}`;
  sv.shp = res === 'lose' ? D.lossHp : auto !== undefined ? shpOf(sv) : Math.max(1, f.duel.me.hp);
  sv.foeLast = { d: today, side: f.side, by: f.by, seen: f.seen, res, ...(auto !== undefined ? { auto } : {}), ops: f.ops.map((o) => o.k), ko, en, ...(res === 'win' && auto === undefined ? { offer: rewardOffer(Math.random) } : {}) };
  pushReport(sv, { d: today, kind: 'alert', target: f.seen ? f.by : -1, ok: res !== 'lose', ko, en });
  ctx.notify({ kind: 'office', title: res === 'win' ? L('적 공작을 끊어냈습니다', 'Enemy operation cut') : res === 'draw' ? L('적 공작을 버텨냈습니다', 'Enemy operation repelled') : L('적 공작에 당했습니다', 'An enemy operation hit us'), body: L(ko, en) });
  logDiagnostic('info', 'scenario_intel.foe_finish', { sid, res, auto: auto ?? -1, w: ch.w, l: ch.l });
  sv.foe = undefined; sv.foeNext = foeGap(now, Math.random);
  rollShop(sv, halfOf(today)); // 대전이 끝나면 상점에 새 물건이 들어온다
}
/** 첩보부장에게 맡기기(4승부터) · 방치되면 기한에 자동으로 */
function foeAuto(sid: string, sv: IntelSave, today: string, forced: boolean): boolean {
  const f = sv.foe; if (!f) return false; const ch = chiefOf(sv), p = forced ? chiefFallback(ch.w) : chiefChance(ch.w); if (p === null) return false;
  const r = Math.random() * 100; foeFinish(sid, sv, today, r < p ? 'win' : r < p + (100 - p) * 0.4 ? 'draw' : 'lose', p); return true;
}
/** 매달: 보안망 회복 · 기한 넘긴 대전 · 다음 적 공작 */
function foeTick(sid: string, sv: IntelSave, today: string): void {
  const now = dayOf(today); if (!now) return;
  shpRegen(sv);
  if (sv.foe) { if (now >= sv.foe.due) foeAuto(sid, sv, today, true); return; }
  if (sv.foeNext === undefined) { sv.foeNext = foeGap(now, Math.random); return; }
  if (now >= sv.foeNext && !foeSpawn(sid, sv, today)) sv.foeNext = foeGap(now, Math.random);
}

/** scenario-map-app 이 매달 섹터 보고를 다 받으면 부른다. */
export function intelOnSectorBook(sid: string, book: ScnSectorBook): void {
  try {
    if (mine() !== sid) return;
    const sv = bookOf(sid), today = book.date || ctx.gameDate || '';
    const res = monthTick(sv, today, CR_NOBLES);
    if (res) centralTick(sv, CR_NOBLES, isCoreHub); // 중앙 정보망(2단계 저울질, 2026-11-08)
    { const h = halfOf(today); if (h && (!sv.shop || sv.shop.h !== h)) rollShop(sv, h); } // 상점 진열: 1월·7월에 새로
    if (res) {
      applyResult(sid, sv, today, res);
      if (res.results.length) logDiagnostic('info', 'scenario_intel.tick', { sid, results: res.results.map((x) => `${x.op.kind}:${x.ok ? 1 : 0}${x.caught ? 'C' : x.detected ? 'D' : ''}`).join(',') });
    }
    foeTick(sid, sv, today); // 적 공작(2026-11-08)
    summitStep(sid, sv, today); // 두 강대국 정상회담(2026-11-08)
    // 회랑과의 긴장이 끝까지 차면 그 강대국이 30일 예고 뒤 회랑에 선전포고(게임 이벤트 sllm_cr.60~62, 2026-11-08 사용자: 「플레이어한테도 이벤트로만 전쟁」)
    for (const x of ['a', 'b'] as NSide[]) {
      const rk = (sv.reck ??= { a: 0, b: 0 });
      if (sv.hostile[x] < IN.reckAt || dayOf(today) < rk[x] || !ready() || ctx.curSaveId !== sid) continue;
      rk[x] = dayOf(today) + IN.reckCool; sv.hostile[x] = IN.reckAfter;
      void enqueue(() => sendConsole(`effect sllm_cr_reckon = { S = ${x} }`)).catch((e) => logDiagnostic('warn', 'scenario_intel.reckon_failed', { error: (e as Error).message }));
      pushReport(sv, { d: today, kind: 'alert', target: -1, ok: false, ko: `${sideName(x)}이(가) 회랑에 최후의 경고를 보냈습니다. 30일 뒤 선전포고합니다.`, en: `${sideName(x)} has sent the Corridor a final warning: war in 30 days.` });
      logDiagnostic('info', 'scenario_intel.reckon', { sid, side: x });
    }
    const mt = meetingTick(sv, today, Math.random);
    if (mt) {
      { const pri = Object.entries(sv.ins ?? {}).filter(([, v]) => v.priest).map(([k]) => Number(k)); if (pri.length) withNobleSave(sid, (ns) => { for (const id of pri) if (!ns.fate[id]) shiftLoyal(ns, id, PRIEST_YEAR); }); } // 고해신부(2026-11-08)
      for (const [k, v] of Object.entries(sv.ins ?? {})) if (v.expat) sv.net[k] = Math.min(100, (sv.net[k] ?? 0) + COMMON.expatNet); // 비자 거주자(2026-11-08)
      // 정보 예산은 매달 보내지 않고 연례 회의 때 1년치를 한 번에(2026-11-07 사용자: 「매달 게임에 신호 보내는 게 없어야」)
      const cost = (IN.budget[sv.budget] ?? 0) * 12;
      if (cost > 0 && ready() && ctx.curSaveId === sid) void pay(cost).catch((e) => logDiagnostic('warn', 'scenario_intel.pay_failed', { error: (e as Error).message }));
      const yr = yearReport(sv, mt.year - 1, today, domainYearLines(sid, mt.year));
      const ko = `${mt.year}년 연례 정보 회의가 열렸습니다.${yr ? ` ${yr.ko}` : ''} 첩보력 ${sv.ip}(올해 +${mt.gain}), 새 카드 ${mt.drawn.length}장.${sv.rewards ? ` 고를 보상 ${sv.rewards}개.` : ''} 회랑 정보국에서 올해 작전을 정하세요.`;
      const en = `The ${mt.year} yearly intelligence meeting has convened.${yr ? ` ${yr.en}` : ''} Intel ${sv.ip} (+${mt.gain} this year), ${mt.drawn.length} new cards.${sv.rewards ? ` ${sv.rewards} reward(s) to choose.` : ''} Set this year's operations in the Intelligence bureau.`;
      ctx.notify({ kind: 'office', title: yr ? L(`${mt.year - 1}년 연말 보고서`, `${mt.year - 1} year-end report`) : L('연례 정보 회의', 'Yearly intelligence meeting'), body: L(ko, en) });
    }
    save();
    void flushRevolts(sid, sv, today);
  } catch (e) { logDiagnostic('warn', 'scenario_intel.tick_failed', { error: (e as Error).message }); }
}

// ---- 손에 쥔 기밀 문서(2026-11-08 사용자: 「첩보로 얻은 정보는 카드로 남고, 그걸 귀족·군주에게 직접 건넬 수 있게 — 전쟁으로 번지거나 이간질」) ----
// 접견실(scenario-audience-app)이 부른다: 입수한 전쟁 계획 · 약점 카드. 건네면 약점 카드는 손에서 사라진다.
export function intelDocSource(sid: string): { plans: Array<{ side: NSide; intent: 'atk' | 'def' | 'wait'; d: string }>; weak: Array<{ card: number; t: number; k: WeakKind }> } {
  const sv = books()[sid]; if (!sv) return { plans: [], weak: [] };
  const now = dayOf(ctx.gameDate || ''), plans: Array<{ side: NSide; intent: 'atk' | 'def' | 'wait'; d: string }> = [];
  for (const x of ['a', 'b'] as NSide[]) { const p = planOf(sv, x, now); if (p) plans.push({ side: x, intent: p.intent, d: p.d }); }
  const weak = [...sv.hand, ...sv.deck, ...sv.disc].filter((c) => c.k === 'weak' && c.t !== undefined).map((c) => ({ card: c.id, t: c.t!, k: sv.cards[String(c.t)]?.k ?? 'debt' as WeakKind }));
  return { plans, weak };
}
/** 약점 카드 한 장을 내준다(손패·덱·버린 더미 어디에 있든). */
export function intelGiveWeak(sid: string, card: number): boolean {
  const sv = books()[sid]; if (!sv) return false;
  for (const pile of [sv.hand, sv.deck, sv.disc]) { const i = pile.findIndex((c) => c.id === card); if (i >= 0) { pile.splice(i, 1); save(); return true; } }
  return false;
}
/** 그 나라가 회랑을 덜(−) 또는 더(+) 의심한다 · 긴장도 함께. */
export function intelSway(sid: string, side: NSide, sus: number, hostile: number): void {
  const sv = books()[sid]; if (!sv) return;
  sv.sus[side] = Math.max(0, Math.min(100, sv.sus[side] + sus)); sv.hostile[side] = Math.max(0, Math.min(100, sv.hostile[side] + hostile)); save();
}
export const WEAK_PAIR = (k: WeakKind): [string, string] => WEAK_KO[k] ?? ['약점', 'a weakness'];

// ---- 위조 문서 공방(2026-11-08 사용자: 「위조계획 제조하는 것도 만들자」) ----
// 정보국에서 에너지를 내고 가짜 문서를 만든다: 누가(from) → 누구를(to) 한다. 접견에서 진짜처럼 건넨다(scenario-audience-app presentDoc).
// 솜씨(q)는 그 정부의 중앙 정보망 · 그 귀족(들)의 정보망이 높을수록 좋다. 건넬 때 forgeCatch(q)% 확률로 들킨다(본인·당사국 군주에게는 늘 들킨다).
const fullKo = (x: NSide) => (x === 'a' ? '은하 얼라이언스' : '인류 제국'), fullEn = (x: NSide) => (x === 'a' ? 'Galactic Alliance' : 'Human Empire');
const FORGE_BOND: Record<'back' | 'accord' | 'oath', [string, string]> = { back: ['비밀 회선(내통)', 'a secret back channel'], accord: ['밀약', 'a secret accord'], oath: ['비밀 서약', 'a secret oath'] };
const INTENT_KO: Record<Intent, [string, string]> = { atk: ['공격 준비', 'preparing to attack'], def: ['방어 태세', 'bracing for defence'], wait: ['관망', 'waiting it out'] };
/** 위조 문서 한 장의 「누가 → 누구를: 무엇을」 이름 [한, 영] */
export function forgedLabel(f: Forged): [string, string] {
  const nk = (x: number | NSide): [string, string] => typeof x === 'number' ? [byId.get(x)?.ko ?? '?', byId.get(x)?.en ?? '?'] : [fullKo(x), fullEn(x)];
  const a = nk(f.from);
  if (f.k === 'plan') { const b = nk(f.to), v = INTENT_KO[f.intent ?? 'atk']; return [`${a[0]} → ${b[0]}: ${v[0]}`, `${a[1]} → ${b[1]}: ${v[1]}`]; }
  if (f.k === 'tie') { const b = nk(f.to), v = FORGE_BOND[f.bk ?? 'back']; return [`${a[0]} → ${b[0]}: ${v[0]}`, `${a[1]} → ${b[1]}: ${v[1]}`]; }
  const n = typeof f.from === 'number' ? byId.get(f.from) : undefined; const r: [string, string] = n ? [`${fullKo(n.side)} 군주`, `the ${fullEn(n.side)} sovereign`] : ['군주', 'the sovereign'];
  return [`${a[0]} → ${r[0]}: 배신을 꾀함`, `${a[1]} → ${r[1]}: plotting betrayal`];
}
function forgeView(sid: string, sv: IntelSave, known: Set<number>): Record<string, unknown> {
  const nobles = CR_NOBLES.filter((n) => known.has(n.id)).map((n) => ({ id: n.id, name: nobleName(n), side: n.side, sideName: L(fullKo(n.side), fullEn(n.side)), net: Math.round(sv.net[String(n.id)] ?? 0) }));
  return {
    max: FORGE.max, cost: FORGE.cost, base: FORGE.base, netW: FORGE.netW, catchTop: FORGE.catchTop, catchMin: FORGE.catchMin, catchW: FORGE.catchW,
    cnet: { a: Math.round(sv.cnet?.a ?? 0), b: Math.round(sv.cnet?.b ?? 0) }, sides: { a: L(fullKo('a'), fullEn('a')), b: L(fullKo('b'), fullEn('b')) }, nobles,
    held: (sv.fakes ?? []).map((f) => ({ id: f.id, label: L(...forgedLabel(f)), q: f.q, caught: forgeCatch(f.q), d: f.d })),
  };
}
async function forgeMake(sid: string, sv: IntelSave, r: Record<string, unknown>, today: string): Promise<string> {
  const k = (['plan', 'tie', 'loy'] as ForgeKind[]).find((x) => x === r.kind); if (!k) return L('만들 문서 종류를 고르세요.', 'Choose what kind of document to forge.');
  if ((sv.fakes ?? []).length >= FORGE.max) return L(`위조 문서는 ${FORGE.max}장까지 쥘 수 있습니다. 먼저 하나를 건네거나 버리세요.`, `You can hold up to ${FORGE.max} forged documents. Hand one over or burn one first.`);
  const known = knownNobles(sid), nob = (v: unknown): NobleRow | undefined => { const n = byId.get(Number(v)); return n && known.has(n.id) && !withNobleSave(sid, (ns) => ns.fate[n.id]) ? n : undefined; };
  let f: Forged;
  if (k === 'plan') {
    const from = r.from === 'a' || r.from === 'b' ? r.from : null, intent = (['atk', 'def', 'wait'] as Intent[]).find((x) => x === r.intent);
    if (!from || !intent) return L('어느 정부의 어떤 계획인지 고르세요.', 'Choose whose plans and what they say.');
    f = { id: sv.nextId++, k, from, to: otherSide(from), intent, q: 0, d: today };
  } else if (k === 'tie') {
    const a = nob(r.from), b = nob(r.to), bk = (['back', 'accord', 'oath'] as const).find((x) => x === r.bk) ?? 'back';
    if (!a || !b || a.id === b.id) return L('정체를 아는 귀족 둘을 고르세요.', 'Choose two nobles whose identities you know.');
    f = { id: sv.nextId++, k, from: a.id, to: b.id, bk, q: 0, d: today };
  } else {
    const n = nob(r.from); if (!n) return L('정체를 아는 귀족을 고르세요.', 'Choose a noble whose identity you know.');
    f = { id: sv.nextId++, k, from: n.id, to: n.side, q: 0, d: today };
  }
  f.q = forgeQuality(sv, k, f.from, f.to);
  if (!ready()) return L('게임이 켜져 있어야 비용을 낼 수 있습니다.', 'The game must be running to pay the cost.');
  try { await pay(FORGE.cost[k]); } catch (e) { return L('게임에 보내지 못했습니다: ', 'Could not send to the game: ') + (e as Error).message; }
  (sv.fakes ??= []).push(f);
  const lb = forgedLabel(f);
  pushReport(sv, { d: today, kind: 'forge', target: -1, ok: true, ko: `위조 문서를 만들었습니다 — ${lb[0]} (솜씨 ${f.q}, 들킬 확률 ${forgeCatch(f.q)}%). 접견에서 꺼내 건넬 수 있습니다.`, en: `Forged a document — ${lb[1]} (craft ${f.q}, ${forgeCatch(f.q)}% chance of exposure). Bring it out in an audience to hand it over.` });
  return '';
}
/** 접견실이 부른다: 손에 쥔 위조 문서 */
export function intelForged(sid: string): Forged[] { return [...(books()[sid]?.fakes ?? [])]; }
/** 위조 문서를 써 버린다(건넸거나 들켰거나). */
export function intelUseForged(sid: string, id: number): Forged | undefined {
  const sv = books()[sid]; if (!sv?.fakes) return undefined; const i = sv.fakes.findIndex((f) => f.id === id); if (i < 0) return undefined;
  const [f] = sv.fakes.splice(i, 1); save(); return f;
}

export function registerScenarioIntel(): void {
  setDuelNames((k) => DNAME[k]); // 대전 기록에 카드 이름을 쓰도록
  // 개발자 도구(2026-11-08 사용자: 「개발자 도구에서 즉각 테스트되게」) — scenario-domains-app 의 scnDev 가 찾아 부른다
  addDevHook('in_foe', () => { const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') }; const sv = bookOf(sid), today = ctx.gameDate || '';
    if (sv.foe) sv.foe = undefined; sv.foeLast = undefined; sv.shp = D.hpMax;
    if (!foeSpawn(sid, sv, today)) return { ok: false, error: L('공작을 걸 귀족이 없습니다.', 'No noble can launch an operation.') }; save();
    return { ok: true, message: L(`방첩 대전 시작 · 공작선 ${sv.foe!.duel.foe.max}`, `Duel started · enemy line ${sv.foe!.duel.foe.max}`) }; });
  addDevHook('in_chief', () => { const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') }; const sv = bookOf(sid); chiefOf(sv).w += 4; save();
    return { ok: true, message: L(`첩보부장 ${chiefOf(sv).w}승(자동 대응 ${chiefChance(chiefOf(sv).w)}%)`, `Spymaster ${chiefOf(sv).w} wins (auto ${chiefChance(chiefOf(sv).w)}%)`) }; });
  addDevHook('in_cards', () => { const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') }; const sv = bookOf(sid);
    const ks: CardKind[] = ['scout', 'poison', 'accident', 'assassinate', 'ins_cook', 'ins_doctor', 'ins_driver', 'ins_mech', 'ins_butler', 'ins_secretary', 'ins_guard', 'ins_treasurer', 'ins_lover', 'ins_priest', 'ins_journalist', 'ins_clerk', 'ins_paparazzo', 'ins_expat', 'ins_courier', 'ins_cleaner', 'ins_canteen', 'ins_sleuth', 'ins_streamer', 'ins_installer'];
    for (const k of ks) sv.hand.push({ id: sv.nextId++, k }); sv.ip = Math.min(40, sv.ip + 30); save();
    return { ok: true, message: L(`손패에 새 카드 ${ks.length}장, 첩보력 +30`, `${ks.length} new cards in hand, intel +30`) }; });
  addDevHook('in_ins', () => { const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') }; const sv = bookOf(sid);
    const at = sv.agents.find((a) => a.st !== 'lost' && a.at !== null)?.at; const t = at !== undefined && at !== null ? byId.get(at) : CR_NOBLES[Math.floor(Math.random() * CR_NOBLES.length)]; if (!t) return { ok: false, error: 'no target' };
    const today = ctx.gameDate || ''; (sv.ins ??= {})[String(t.id)] = Object.fromEntries(JOBS.map((j) => [j, today])); sv.seen[String(t.id)] = true; sv.net[String(t.id)] = Math.max(sv.net[String(t.id)] ?? 0, 90); save();
    return { ok: true, message: L(`${t.ko}: 내부자 11명 모두 · 정보망 90 · 정체 파악(공작원 배치 섹터 우선)`, `${t.en}: all 11 insiders · network 90 · identified (posted sector first)`) }; });
  addDevHook('in_dbl', () => { const sid = mine(); if (!sid) return { ok: false, error: L('회랑 자리 판에서만 쓸 수 있습니다.', 'Only when playing the Corridor seat.') }; const sv = bookOf(sid);
    const keys = Object.keys(sv.ins ?? {}); if (!keys.length) return { ok: false, error: L('매수한 내부자가 없습니다(먼저 「내부자 모두 매수」).', 'No insiders yet (use "Buy all insiders" first).') };
    const k = keys[Math.floor(Math.random() * keys.length)], d = ((sv.dbl ??= {})[k] ??= []); for (const j of ['doctor', 'driver', 'butler', 'cook'] as const) if (sv.ins![k][j] && !d.includes(j)) d.push(j); save();
    const t = byId.get(Number(k)); return { ok: true, message: L(`${t?.ko ?? k}: 주치의·운전수·집사·요리사가 몰래 돌아섰습니다(건강이 늘 「건재」로 보이고, 중독은 잘 들킴).`, `${t?.en ?? k}: physician, chauffeur, butler and cook secretly turned (health always shows "Hale"; poisoning gets exposed).`) }; });
  setInsiderSource((sid, id) => books()[sid]?.ins?.[String(id)] ?? null, (sid, id) => books()[sid]?.dbl?.[String(id)] ?? []); // 귀족 건강: 내부자(의사·운전수)가 있으면 더 정확히(2026-11-08)
  setCnPressureSource((sid) => { const sv = books()[sid]; return sv ? { a: sv.sus.a, b: sv.sus.b } : null; }); // 회랑의 귀족: 의심이 높은 강대국일수록 우리 귀족을 흔든다(2026-11-08)
  setSusHook((sid, side, d) => { const sv = bookOf(sid); sv.sus[side] = Math.max(0, Math.min(100, sv.sus[side] + d)); save(); }); // 귀족 밀약 끼어들기(밀고·귀띔·뒷배)가 의심도를 바꾼다(2026-11-07)
  ipcMain.handle('scnIntel', async () => { try { return view(); } catch (e) { logDiagnostic('warn', 'scenario_intel.view_failed', { error: String(e) }); return { ok: false, on: false }; } });
  ipcMain.handle('scnIntelAct', async (_e, req: unknown) => { try { return await act(req); } catch (e) { logDiagnostic('warn', 'scenario_intel.act_failed', { error: String(e) }); return { ok: false, error: String((e as Error).message || e) }; } });
}
export const scnIntelTest = { reset: () => { all = {}; }, view, act };
