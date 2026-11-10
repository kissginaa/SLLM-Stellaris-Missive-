// 시나리오 귀족 충성도·친밀도(앱 쪽, 2026-11-06). 규칙: src/scenario-nobles.ts · 표: src/scenario-nobles-data.ts(gen_nobles.py 가 만듦)
// 계산은 전부 앱에서(게임 부담 없음): 매달 섹터 보고(scenario-map-app 의 SCNSEC 묶음)를 받을 때 분기(게임 90일)마다 한 번.
// 저장: userData/sllm_scenario_nobles.json(세이브별, 최근 12개). 반란·귀순은 정해지면 pending 에 두고, 게임 실행(3단계)은 아직 — 진단 기록만 남긴다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { cleanSaveId } from '../images';
import { dayNo } from '../gamedate';
import { scenarioNow } from './scenario-app';
import { tensionNow } from './tension-app';
import type { ScnSectorBook } from '../scenario-map';
import { CR_NOBLES, CR_BONDS } from '../scenario-nobles-data';
import { CR_FACTIONS, factionOf, factionState, factionTick, type FKey } from '../scenario-factions';
import { introCands } from '../scenario-audience';
// 밀사 통로·의심·만난(소개받은 귀족 포함) 귀족 표시(연감 세력판, 2026-11-06)는 접견실(scenario-audience-app)이 등록할 때 넘겨준다 — 서로 가져오면 기능 파일 순환 검사(A-00b)에 걸린다
type AuMarks = { ch: number[]; sus: number[]; met: number[]; love?: number[] }; // love: 플레이어 통치자와 연애 중인 귀족(2026-11-08)
let audienceMarks: (sid: string) => AuMarks = () => ({ ch: [], sus: [], met: [] });
export function setAudienceMarksSource(fn: (sid: string) => AuMarks): void { audienceMarks = fn; }
// 회랑 정보국(scenario-intel-app)이 정찰로 알아낸 귀족(2026-11-07) — 같은 까닭으로 등록 방식
let intelSeen: (sid: string) => number[] = () => [];
export function setIntelSeenSource(fn: (sid: string) => number[]): void { intelSeen = fn; }
// 회랑 정보국 2단계(협박 → 밀사 통로, 누명 → 군주의 의심, 2026-11-07): 접견실 저장에 표시를 쓰는 함수도 접견실이 등록한다
type AuWrite = (sid: string, kind: 'ch' | 'sus', id: number, on: boolean) => void;
let audienceWrite: AuWrite = () => { /* 접견실이 아직 등록 안 됨 */ };
export function setAudienceWriter(fn: AuWrite): void { audienceWrite = fn; }
export function markAudience(sid: string, kind: 'ch' | 'sus', id: number, on: boolean): void { audienceWrite(sid, kind, id, on); }
// 귀족 영역다툼·귀족 외교(scenario-domains-app, 2026-11-07)가 세력도에 줄 것 — 그쪽이 이 파일을 가져오므로 등록 방식
let domainInfo: (sid: string) => Record<string, unknown> | null = () => null;
export function setDomainSource(fn: (sid: string) => Record<string, unknown> | null): void { domainInfo = fn; }
import { fixNobleSave, newNobleSave, quarterTick, loyalView, bondVisible, pairKey, rulerOf, confirmFate, INTIMACY_STAGE, type NobleSave, type BondKind, type Fate, type LoyalStage } from '../scenario-nobles';

// 화면 문구는 L('한', 'En') 글자 그대로 둔다(언어 팩 뼈대 도구 i18n-pairs 가 이 쌍을 모은다). 순수 규칙 파일의 표와 순서가 같아야 한다.
const loyalName = (st: LoyalStage): string => [L('충성', 'Loyal'), L('평온', 'Content'), L('불만', 'Discontent'), L('모반의 기미', 'Conspiring'), L('반란 직전', 'On the Brink')][st];
const INTIMACY_TEXT = (): string[] => [L('서약', 'Oathbound'), L('협약', 'Accord'), L('신뢰', 'Trusted'), L('우호', 'Cordial'), L('접촉', 'Contact'), L('냉담', 'Cold'), L('경쟁자', 'Rival'), L('숙적', 'Nemesis')];
const intimacyName = (v: number): string => { const t = INTIMACY_TEXT(); for (let i = 0; i < INTIMACY_STAGE.length; i++) if (v >= INTIMACY_STAGE[i].min) return t[i]; return t[t.length - 1]; };
const bondName = (k: BondKind): string => ({ oath: L('서약', 'Oathbound'), union: L('혼약', 'Union'), accord: L('협약', 'Accord'), rival: L('경쟁자', 'Rival'), back: L('비밀 회선', 'Back Channel') })[k];
const fateName = (f: Fate): string => ({ rebel: L('반란', 'Rebellion'), defect_p: L('플레이어 나라로 귀순', 'Defects to the player'), defect_other: L('상대 세력으로 귀순', 'Defects to the rival power'), fallen: L('몰락', 'Fallen') })[f];
const traitName = (i: number, plus: boolean): string => [
  [L('명예로움', 'Honorable'), L('교활함', 'Devious')], [L('자비로움', 'Merciful'), L('잔혹함', 'Cruel')], [L('관대함', 'Generous'), L('인색함', 'Closefisted')],
  [L('용맹함', 'Daring'), L('신중함', 'Cautious')], [L('계산적', 'Calculating'), L('충동적', 'Impulsive')],
][i][plus ? 0 : 1];

// 대세력 문구(2026-11-06) — 언어 팩이 모으도록 글자 그대로
const factionName = (side: 'a' | 'b', k: FKey): string => (side === 'a'
  ? { core: L('성좌 원로회', 'Council of the Constellation'), inner: L('중원 가문', 'Houses of the Midlands'), border: L('변경 수호가', 'Wardens of the Marches') }
  : { core: L('옥좌의 측근', 'The Throne’s Inner Circle'), inner: L('제국 심장부의 영주들', 'Lords of the Imperial Heart'), border: L('철문 변경백', 'Margraves of the Iron Gate') })[k];
const stanceName = (k: FKey): string => ({ core: L('충성파', 'Loyalists'), inner: L('실리파', 'Pragmatists'), border: L('자치파', 'Autonomists') })[k];
const regionName = (k: FKey): string => ({ core: L('수도권', 'Capital'), inner: L('내지', 'Heartland'), border: L('국경', 'Frontier') })[k];
const agendaText = (side: 'a' | 'b', k: FKey): string => (side === 'a'
  ? { core: L('원수의 권위 유지 · 회랑 견제', 'Uphold the head of state’s authority · keep the Corridor in check'), inner: L('교역로 안정 · 세금 경감', 'Stable trade routes · lower taxes'), border: L('변경 자치 확대 · 회랑과의 교역', 'Wider frontier autonomy · trade with the Corridor') }
  : { core: L('총통 친정 강화 · 동원 준비', 'Strengthen the Führer’s personal rule · prepare mobilization'), inner: L('군수 계약 · 영지 특권 보장', 'Military contracts · guaranteed estate privileges'), border: L('변경백 자치권 · 철문 통행 관리', 'Margraves’ autonomy · control of Iron Gate traffic') })[k];

const KEEP = 12;
/** 수도 섹터에 든 거점(섹터가 따로 없음 — 지도자용으로 남김, 2026-11-06). 섹터 보고에 안 보여도 「잃음」이 아니다. */
const CORE_HUBS = new Set([342, 396, 561, 263]);
export const isCoreHub = (id: number): boolean => CORE_HUBS.has(id);
const file = () => path.join(app.getPath('userData'), 'sllm_scenario_nobles.json');
let all: Record<string, NobleSave> | null = null;
function saves(): Record<string, NobleSave> {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) if (cleanSaveId(k)) all[k] = fixNobleSave(v, k, CR_NOBLES, CR_BONDS); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario_nobles', error: (e as Error).message }); }
  return all;
}
let dirty: ReturnType<typeof setTimeout> | null = null;
function save(): void {
  if (dirty) return;
  dirty = setTimeout(() => {
    dirty = null;
    try {
      const s = saves(), keys = Object.keys(s); if (keys.length > KEEP) for (const k of keys.slice(0, keys.length - KEEP)) delete s[k];
      const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: s })); fs.renameSync(t, file());
    } catch (e) { logDiagnostic('warn', 'scenario_nobles.save_failed', { error: (e as Error).message }); }
  }, 1000);
}
function stateOf(sid: string): NobleSave { const s = saves(); if (!s[sid]) s[sid] = newNobleSave(sid, CR_NOBLES, CR_BONDS); return s[sid]; }
/** 접견실(scenario-audience-app)이 같은 귀족 저장을 고칠 때(2026-11-06). fn 안에서 고친 뒤 저장한다. */
export function withNobleSave<T>(sid: string, fn: (s: NobleSave) => T): T { const r = fn(stateOf(sid)); save(); return r; }

/** 회랑 정보국 「반란 부추기기」가 게임에 반란을 실행한 뒤(2026-11-07): 운명을 반란으로 확정하고 인연으로 엮인 귀족을 흔든다. */
export function nobleRevolted(sid: string, id: number, date: string): Array<{ id: number; from: number; to: number }> {
  const s = stateOf(sid); if (s.fate[id]) return [];
  s.pending[id] = 'rebel';
  const shaken = confirmFate(s, CR_NOBLES, CR_BONDS, id, date);
  s.notes.push({ d: date, id, kind: 'fate', ko: `${CR_NOBLES.find((n) => n.id === id)?.ko ?? id}: 반란`, en: `${CR_NOBLES.find((n) => n.id === id)?.en ?? id}: Rebellion` });
  save(); return shaken;
}

/** scenario-map-app 이 섹터 보고 한 묶음을 다 받으면 부른다. */
export function nobleOnSectorBook(sid: string, book: ScnSectorBook): void {
  try {
    const scn = scenarioNow(); if (!scn || scn.id !== 'corridor' || ctx.curSaveId !== sid) return;
    const day = dayNo(book.date); if (day === null) return;
    const s = stateOf(sid);
    // 거점을 잃음 = 그 거점이 다른 나라 섹터의 수도로 보고됨(2026-11-07: 게임은 「섹터 수도끼리 5칸」 규칙 때문에 거점 섹터를 다 만들지 못하므로, 섹터가 없다고 잃은 것으로 보지 않는다)
    const otherCap = new Map<number, string>(); for (const sc of book.list) if ((sc.side === 'a' || sc.side === 'b' || sc.side === 'p') && sc.cap >= 0) otherCap.set(sc.cap, sc.side);
    const lost = new Set<number>(); for (const n of CR_NOBLES) { const sd = otherCap.get(n.id); if (!CORE_HUBS.has(n.id) && sd && sd !== n.side) lost.add(n.id); }
    const tn = tensionNow();
    // 전쟁 승패는 아직 앱이 모른다(다음: 세이브 전쟁 점수) — 전쟁 중이면 'even'(효과 없음)
    const war = tn?.war ? { a: 'even' as const, b: 'even' as const } : {};
    const r = quarterTick(s, CR_NOBLES, CR_BONDS, { day, date: book.date, lost, war, tensionStage: tn?.st ?? 0, rand: Math.random });
    if (r.ran) factionTick(s, CR_NOBLES, CR_BONDS, book.date); // 대세력: 구성원이 대표를 따라간다(2026-11-06)
    if (!r.ran && s.last !== day) { save(); return; }
    save();
    if (r.outcomes.length) logDiagnostic('info', 'scenario_nobles.fate_pending', { sid, list: r.outcomes.map((o) => `${o.id}:${o.fate}`).join(',') }); // 3단계에서 게임 실행·신문·알림으로
  } catch (e) { logDiagnostic('warn', 'scenario_nobles.tick_failed', { error: (e as Error).message }); }
}

/** 얼굴이 알려진 귀족(세력판 실루엣, 2026-11-06): 국경(우리와 맞닿음) · 수도 섹터(공인) · 만났거나 소개받았거나(2026-11-07) 충성도·인연을 알아냈거나 통로·의심·운명이 정해진 귀족. 접견실의 소개 판정도 이것을 쓴다. */
export function knownNobles(sid: string): Set<number> {
  const s = stateOf(sid), marks = audienceMarks(sid), out = new Set<number>([...marks.met, ...marks.ch, ...marks.sus, ...intelSeen(sid)]);
  for (const [k, a, b] of CR_BONDS) if (bondVisible(s, k, a, b)) { out.add(a); out.add(b); }
  for (const n of CR_NOBLES) if (n.border || CORE_HUBS.has(n.id) || s.knownLoyal[n.id] || s.fate[n.id] || s.pending[n.id]) out.add(n.id);
  return out;
}

/** 화면(인물 관계도·접견실)에 줄 것 — 플레이어가 아는 만큼만. */
function view(): Record<string, unknown> {
  const sid = ctx.curSaveId || '', scn = scenarioNow();
  if (!sid || !scn || scn.id !== 'corridor') return { ok: true, on: false };
  const s = stateOf(sid), marks = audienceMarks(sid), chSet = new Set(marks.ch), susSet = new Set(marks.sus), loveSet = new Set(marks.love ?? []);
  const known = knownNobles(sid), seenOf = (id: number) => known.has(id);
  const factions = CR_FACTIONS.map((d) => { const st = factionState(s, CR_NOBLES, d.side, d.key); return { side: d.side, key: d.key, name: factionName(d.side, d.key), stance: stanceName(d.key), region: regionName(d.key), agenda: agendaText(d.side, d.key), leader: st.leader, acting: st.acting, stage: st.stage, stageName: loyalName(st.stage), inf: st.inf, count: st.count, active: st.active }; });
  const leaders = new Set(factions.map((f) => f.leader));
  const nobles = CR_NOBLES.map((n) => {
    const lv = loyalView(s, n.id), fate = s.fate[n.id] ?? s.pending[n.id];
    return {
      id: n.id, side: n.side, g: n.g, border: n.border, t: n.t ?? 2, name: L(n.ko, n.en) /* 귀족 이름은 고정 표(언어 팩 대상 아님) */, spec: n.spec,
      traits: n.tr.map((v, i) => (v ? traitName(i, v > 0) : '')).filter(Boolean),
      stage: lv.stage, stageName: loyalName(lv.stage), ...(lv.v !== undefined ? { loyal: lv.v } : {}),
      ruler: intimacyName(s.rel[pairKey(n.id, rulerOf(n.side))] ?? 0), me: intimacyName(s.rel[pairKey(n.id, 'P')] ?? 0), rr: s.rel[pairKey(n.id, rulerOf(n.side))] ?? 0,
      ...(chSet.has(n.id) ? { ch: true } : {}), ...(susSet.has(n.id) ? { sus: true } : {}), ...(loveSet.has(n.id) ? { love: true } : {}), seen: seenOf(n.id), ...(seenOf(n.id) && !fate ? { intro: introCands(s, CR_NOBLES, CR_BONDS, known, n.id).length } : {}),
      ...(fate ? { fate: fateName(fate), gone: !!s.fate[n.id] } : {}),
      fac: factionOf(n), ...(leaders.has(n.id) ? { lead: true } : {}),
      tr: n.tr, pic: `assets/scenario/corridor/gov/gov_${n.side.toUpperCase()}-${n.id}.png`, // ui/ 기준 상대 경로(집무실·관계도 화면이 ui/ 안에 있음)
    };
  });
  const facNote = (x: { ko: string }): string | null => { const m = /^#([ab]):(core|inner|border)$/.exec(x.ko); return m ? `${factionName(m[1] as 'a' | 'b', m[2] as FKey)}: ${L('세력 분위기가 나빠졌습니다', 'the faction’s mood has soured')}` : null; };
  const notes = s.notes.slice(-40).reverse().map((x) => ({ d: x.d, id: x.id, text: (x.kind === 'faction' ? facNote(x) : null) ?? L(x.ko, x.en) }));
  const bonds = CR_BONDS.filter(([k, a, b]) => bondVisible(s, k, a, b)).map(([k, a, b]) => ({ kind: k, a, b, name: bondName(k), stage: intimacyName(s.rel[pairKey(a, b)] ?? 0) }));
  let dom: Record<string, unknown> | null = null; try { dom = domainInfo(sid); } catch (e) { logDiagnostic('warn', 'scenario_domains.view_failed', { error: (e as Error).message }); }
  return { ok: true, on: true, date: s.date, nobles, bonds, notes, factions, ...(dom ? { dom } : {}) };
}

export function registerScenarioNobles(): void {
  ipcMain.handle('scnNobles', async () => { try { return view(); } catch (e) { logDiagnostic('warn', 'scenario_nobles.view_failed', { error: e }); return { ok: false, error: L('귀족 정보를 만들지 못했습니다.', 'Could not build the noble list.') }; } });
}
// 순수 함수 검사용
export const scnNoblesTest = { saves: () => saves(), reset: () => { all = {}; } };
