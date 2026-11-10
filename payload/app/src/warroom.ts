// 작전지휘실 2단계(2026-11-05 사용자: 은하 지도에서 함대를 골라 성계를 눌러 명령 + 장관·제독이 지도를 보며 작전 회의 — 매스 이펙트 은하 지도처럼). 순수 규칙.
// 게임: tester-mod/common/scripted_effects/sllm_warroom.txt(보고 WRREP·WRFL·WRSYS·WRWAR → WREND, 명령 응답 WRSET). 앱: src/features/galaxy-app.ts, 화면: ui/warroom.js.
// 번호: 성계 = sllm_sys(성계 번호표와 같은 번호), 함대 = sllm_fo_fid(자동 작전과 같은 번호). 명령을 받은 함대는 직접 지휘(자동 작전이 손대지 않음).
// LLM 은 「작전 회의」를 누를 때만 1번(장관·제독의 말 + 작전안 최대 3개, JSON). 실패하면 지도에서 계산한 틀 작전안.
import { L } from './i18n-pick';
import type { SllmMessage } from './protocol';

export const WR = { plans: 3, speakers: 5, allies: 2, cands: 40, fleets: 24, history: 8 } as const;
export type WrAct = 'move' | 'home' | 'hold';
export const ACT_CODE: Record<WrAct, number> = { move: 1, home: 2, hold: 3 };

/** 보고의 군 함대 한 줄. sn = 지금 있는 성계 번호(0 = 모름·이동 중). mode 0 자유 1 직접 지휘 2 수리 복귀 3 자동 작전 중 */
export interface WrFleet { fid: number; sn: number; lid: number; mode: number; idle: boolean; fight: boolean; pow: number; fleet: string; adm: string; at: string; /** 합동 작전으로 빌려 온 동맹 함대면 그 나라 sllm_idx(우리 함대는 0) */ aidx: number; /** 연합 원정군 함대(AI 가 꺼진 세력 소유) */ xf: boolean; /** 함대에서 가장 큰 배의 아이콘 칸(ship_sizes.dds, 0 = 모름) */ big: number }
/** 합동 작전 상대(연방·방위 조약·같은 편 전쟁). rel 3 연방 · 2 방위 조약 · 1 같은 전쟁, n = 지금 우리에게 빌려준 함대 수 */
export interface WrAlly { idx: number; name: string; rel: number; n: number; /** 연합 원정군 함대 수 */ xf: number; /** 보낼 수 있는 함대 수·전력 */ ln: number; pow: number; /** 호감 0~4 · 신뢰 0~3 · 같은 편 전쟁 · 함대 사령부 임대 중 */ op: number; tr: number; cw: boolean; ls: boolean }
export interface WrReport { war: boolean; date: string; fleets: WrFleet[]; fresh: Array<{ n: number; name: string }>; enemies: Array<{ idx: number; name: string }>; allies: WrAlly[] }

const num = (v: string | undefined) => { const m = String(v ?? '').trim().replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([KkMm])?$/); return m ? Number(m[1]) * (m[2] ? (/[Kk]/.test(m[2]) ? 1e3 : 1e6) : 1) : 0; };
const str = (v: string | undefined, n = 80) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const okReq = (req: number) => { if (!Number.isSafeInteger(req) || req < 1) throw new Error('INVALID_REQ'); };
const target = (sid: string) => { if (!/^\d+$/.test(sid)) throw new Error(L('세이브 번호가 올바르지 않습니다.', 'Invalid save id.')); return `every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } }`; };

export function reportCommand(req: number, sid: string): string { okReq(req); return `effect ${target(sid)} sllm_wr_report = { REQ = ${req} } }`; }
export function orderCommand(req: number, sid: string, fid: number, act: WrAct, sn: number): string {
  okReq(req);
  if (!Number.isSafeInteger(fid) || fid < 1) throw new Error(L('함대 번호가 올바르지 않습니다.', 'Invalid fleet id.'));
  if (!(act in ACT_CODE)) throw new Error('INVALID_ACT');
  const s = act === 'move' ? sn : 0; if (act === 'move' && (!Number.isSafeInteger(s) || s < 1)) throw new Error(L('이 성계에는 아직 번호가 없습니다. 「새로 읽기」 뒤 다시 해 주세요.', 'This system has no number yet. Press Reload and try again.'));
  return `effect ${target(sid)} sllm_wr_order = { REQ = ${req} FID = ${fid} ACT = ${ACT_CODE[act]} SYS = ${s} } }`;
}

/** 보고 줄 모으기(같은 req). WREND 가 오면 앱이 꺼낸다. */
export class WrCollector {
  private cur = new Map<string, WrReport>();
  feed(m: SllmMessage): boolean {
    const rq = String(Math.round(num(m.kv.req)));
    const r = () => { let x = this.cur.get(rq); if (!x) { x = { war: false, date: '', fleets: [], fresh: [], enemies: [], allies: [] }; this.cur.set(rq, x); } return x; };
    if (m.kind === 'WRREP') { const x = r(); x.war = Math.round(num(m.kv.war)) === 1; x.date = str(m.kv.date, 20); return true; }
    if (m.kind === 'WRSYS') { const x = r(); const n = Math.round(num(m.kv.n)); if (n > 0 && x.fresh.length < 5000) x.fresh.push({ n, name: str(m.kv.name) }); return true; }
    if (m.kind === 'WRFL') {
      const x = r(); const fid = Math.round(num(m.kv.fid)); if (fid < 1 || x.fleets.length >= 200) return true;
      x.fleets.push({ fid, sn: Math.max(0, Math.round(num(m.kv.sn))), lid: Math.max(0, Math.round(num(m.kv.lid))), mode: Math.round(num(m.kv.mode)), idle: Math.round(num(m.kv.idle)) === 1, fight: Math.round(num(m.kv.fight)) === 1, pow: Math.round(num(m.kv.pow)), fleet: str(m.kv.fleet), adm: str(m.kv.adm), at: str(m.kv.at), aidx: Math.max(0, Math.round(num(m.kv.ally))), xf: Math.round(num(m.kv.xf)) === 1, big: Math.max(0, Math.round(num(m.kv.big))) });
      return true;
    }
    if (m.kind === 'WRALLY') { const x = r(); const idx = Math.round(num(m.kv.idx)); if (idx > 0 && x.allies.length < 20 && !x.allies.some((a) => a.idx === idx)) x.allies.push({ idx, name: str(m.kv.name), rel: Math.round(num(m.kv.rel)), n: Math.max(0, Math.round(num(m.kv.n))), xf: Math.max(0, Math.round(num(m.kv.xf))), ln: Math.max(0, Math.round(num(m.kv.ln))), pow: Math.round(num(m.kv.pow)), op: Math.round(num(m.kv.op)), tr: Math.round(num(m.kv.tr)), cw: Math.round(num(m.kv.cw)) === 1, ls: Math.round(num(m.kv.ls)) === 1 }); return true; }
    if (m.kind === 'WRWAR') { const x = r(); if (x.enemies.length < 30) x.enemies.push({ idx: Math.round(num(m.kv.idx)), name: str(m.kv.name) }); return true; }
    return false;
  }
  take(req: number): WrReport | null { const k = String(req), x = this.cur.get(k) ?? null; this.cur.delete(k); if (this.cur.size > 8) this.cur.clear(); return x; }
}

/** 성계 번호 → 세이브 성계 id. 세이브에 적힌 번호가 먼저, 방금 새로 붙은 번호는 이름으로(같은 이름이 여럿이면 아직 번호가 없는 것 중 첫째). */
export function snMap(systems: Array<{ id: number; n: string; sn?: number }>, fresh: Array<{ n: number; name: string }>, prev?: Map<number, number>): Map<number, number> {
  const out = new Map<number, number>(prev ?? []);
  for (const s of systems) if (s.sn) out.set(s.sn, s.id);
  const taken = new Set(out.values()), byName = new Map<string, number[]>();
  for (const s of systems) if (s.n && !taken.has(s.id)) { const k = s.n.toLowerCase(); (byName.get(k) ?? byName.set(k, []).get(k)!).push(s.id); }
  for (const f of fresh) { if (out.has(f.n)) continue; const list = byName.get(f.name.toLowerCase()); const id = list?.shift(); if (id !== undefined) out.set(f.n, id); }
  return out;
}

export const modeText = (m: number): string => m === 1 ? L('직접 지휘', 'Direct command') : m === 2 ? L('수리하러 귀환 중', 'Returning for repairs') : m === 3 ? L('자동 작전 중', 'On automated operation') : L('대기', 'Standing by');
export const actText = (a: WrAct): string => a === 'move' ? L('이동', 'Move') : a === 'home' ? L('수도로 귀환', 'Return to capital') : L('정지', 'Hold');

// ---- 작전 회의 ----
/** role 'ally' = 합동 작전 상대 나라의 통치자(홀로그램 통신으로 참석, lid = −(1000 + 그 나라 idx)) */
export interface WrSpeaker { lid: number; name: string; role: 'minister' | 'admiral' | 'ally'; title: string; fleet?: string; persona?: string; trust?: number; empire?: string; aidx?: number; /** 지도자 레벨(높을수록 유능, 작전 건의 자격) */ lv?: number; /** 전쟁 성향(WR_DOCTRINES 키) */ doc?: string }
export const allyLid = (idx: number) => -(1000 + idx);
/** 회의에 보여 줄 지도 요약(앱이 세이브 지도와 보고로 만든다). */
export interface WrBrief {
  empire: string; date: string; war: boolean; enemies: string[];
  fleets: Array<{ fid: number; name: string; admiral: string; lid: number; power: number; at: string; status: string; on_loan_from?: string }>;
  /** 함께 싸우는 동맹(회의에 통치자가 홀로그램으로 참석) */ allies?: Array<{ empire: string; relation: string; fleets_lent_to_us: number }>;
  threats: Array<{ owner: string; power: number; at: string; near: string; hostile: boolean }>;
  /** 작전 대상 후보 성계(이름이 회의 답의 target 과 맞아야 함) */
  cands: Array<{ name: string; owner: string; kind: string; jumps: number; /** 항로로 바로 이웃한 후보 성계(방어선·협공을 이어지게 고르도록) */ next_to?: string[];
    /** 앱이 계산한 전략 표지(2026-11-05 사용자: 전략 틀): chokepoint · contested · junction · invasion_route · fortified */ tags?: string[]; lanes_to_enemy?: number; enemy_power_nearby?: number }>;
  ourSystems: number; capital: string;
}
export interface WrLine { lid: number; name: string; title: string; say: string }
/** 작전 한 갈래(2026-11-05 사용자: 작전 지도처럼): 주공·지원·견제·방어. 한 작전에 최대 3갈래 — 협공·양동 같은 작전이 지도에 화살표로 그려진다. */
export interface WrMove { fleets: number[]; target: string; role: 'main' | 'support' | 'feint' | 'defend' }
export interface WrPlan { id: string; by: number; byName: string; title: string; /** 작전명(2026-11-05 사용자: RP 요소, 예 「붉은 창」) */ code?: string; target: string; act: WrAct; fleets: number[]; why: string; done?: boolean; result?: string; moves?: WrMove[]; /** 방어선: 지켜 낼 성계 2~5개(지도에 선으로) */ line?: string[]; /** 회의를 부르지 않았는데 장관·유능한 제독이 스스로 들고 온 작전(건의) */ prop?: boolean; byLv?: number }

/** 전략 교리(2026-11-05 사용자: 앱이 계산한 표지를 어떻게 읽을지 틀을 준다) */
export const DOCTRINE = 'Strategic doctrine — candidates carry tags computed from the real map: ' +
  '"chokepoint" = the only gateway from the enemy into our core (hold it at almost any cost, ideally behind a fortified starbase); ' +
  '"contested" = several enemy hyperlanes converge on it (lanes_to_enemy) — the enemy will come here, keep strength nearby; ' +
  '"junction" = many hyperlanes meet — a good staging and rally point, costly to lose; ' +
  '"invasion_route" = on the enemy\'s shortest path to our capital; "fortified" = has an upgraded starbase. ' +
  'Principles: never leave the capital and its invasion route uncovered; concentrate force instead of splitting it against a stronger enemy (compare enemy_power_nearby with our fleet power); ' +
  'defend chokepoints and contested systems first, attack where the enemy is thin; strike enemy colonies close to the front when our defense allows; do not assault a fortified enemy system without clear superiority; ' +
  'a feint works best toward an enemy junction or colony to pull their fleets away from the main thrust. Mention these reasons in plain words when you speak. ';
/** 여러 갈래 작전 설명(회의·건의 공용) */
const OPS_MOVES = 'A bigger operation may instead give "moves" (up to 3), each {"fleets":[fid],"target":"system name from candidates","role":"main"|"support"|"feint"|"defend"} — e.g. a main thrust with a feint elsewhere, a pincer from two sides, or a strike while another fleet defends a threatened border; each fleet appears in only one move; then act is "move" and target is the main move\'s target. ' +
  'An operation that holds ground may add "line": 2-5 system names from candidates forming the defensive line to hold, drawn on the map — pick systems that are actually next to each other (use next_to) and that face the threat, usually our border systems. ' +
  'Speakers with a higher "level" are more capable: they read the map better and propose bolder, better-coordinated operations. ';
/** 통치자가 작전 지도에 그은 선(2026-11-05 사용자): 전선·방어선·공격 화살표 — 지나는 성계 이름 */
export interface WrMark { kind: 'front' | 'defense' | 'arrow'; systems: string[] }
export function councilMessages(b: WrBrief, sp: WrSpeaker[], ask: string, history: WrLine[], marks: WrMark[] = []): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: `You are running a war council in the war room of the Stellaris empire "${b.empire}". The ruler stands at a holographic galaxy map with ministers and admirals around it, like the galaxy map on the bridge of a starship. ` +
      `Each speaker gives a short in-character remark (1-2 sentences) that refers to concrete systems, fleets and powers from the briefing; admirals speak about their own fleet. Speakers may disagree. Then propose up to ${WR.plans} concrete operations. ` +
      `Each operation: by (speaker lid), code (an evocative operation codename of 1-3 words that does NOT reveal the target, flavored by the empire and the proposer — like Operation Overlord; write it without the word "Operation"), title (max 8 words, plain description), target (EXACTLY one system name from candidates, or "" for act "home"/"hold"), act ("move" = send the fleets to target, "home" = bring them back to the capital, "hold" = stop where they are), fleets (fid numbers from the briefing, the ones best suited), why (one sentence with the trade-off). ` +
      OPS_MOVES + DOCTRINE + CLASH +
      `Only war-related people attend: the defense minister(s), our admirals, and speakers with role "ally" — military liaison officers of allied empires attending by hologram; liaisons speak for their own empire's military interests, may support or question the plan, and may object if fleets on loan from them (on_loan_from) are sent on a reckless mission; fleets on loan can be ordered like ours. ` +
      `Respect the ruler's direction if one is given. The ruler may also have drawn on the map (ruler_marks): "front" = where the ruler sees the front line, "defense" = a line of systems the ruler wants held, "arrow" = an axis of attack the ruler wants (from the first system toward the last); speakers react to these drawings and plans should follow them unless an officer argues against it. Do not invent systems, fleets or empires. Never move fleets into a system of an empire we are not at war with unless it is unowned or ours. ` +
      `Reply with JSON only: {"lines":[{"lid":0,"say":""}],"plans":[{"by":0,"code":"","title":"","target":"","act":"move","fleets":[0],"why":"","moves":[],"line":[]}]}` },
    { role: 'user', content: JSON.stringify({ briefing: b, speakers: sp.map((s) => ({ lid: s.lid, name: s.name, role: s.role, title: s.title, commands_fleet: s.fleet || undefined, level: s.lv || undefined, doctrine: doctrineByKey(s.doc) ? `${doctrineByKey(s.doc)!.en} (${doctrineByKey(s.doc)!.style}): ${doctrineByKey(s.doc)!.desc}` : undefined, empire: s.empire || undefined, manner: s.persona || undefined, trust_in_ruler: typeof s.trust === 'number' ? s.trust : undefined })),
      ruler_direction: ask || undefined, ruler_marks: marks.length ? marks : undefined, earlier_in_this_council: history.slice(-WR.history).map((h) => `${h.name}: ${h.say}`) }) },
  ];
}

export function parseJson(raw: string): Record<string, unknown> | null { const m = /\{[\s\S]*\}/.exec(raw || ''); if (!m) return null; try { const j = JSON.parse(m[0]); return j && typeof j === 'object' ? j as Record<string, unknown> : null; } catch { return null; } }
const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** 회의 답 → 말 줄·작전안(없는 성계·함대·사람은 버림). */
export function parseCouncil(raw: string | null, b: WrBrief, sp: WrSpeaker[], seed: string): { lines: WrLine[]; plans: WrPlan[] } | null {
  const j = raw ? parseJson(raw) : null; if (!j) return null;
  const who = new Map(sp.map((s) => [s.lid, s])), names = new Map(b.cands.map((c) => [c.name.toLowerCase(), c.name])), fids = new Set(b.fleets.map((f) => f.fid));
  const lines: WrLine[] = [];
  for (const x of Array.isArray(j.lines) ? j.lines.slice(0, WR.speakers + 2) : []) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>, s = who.get(Number(o.lid)), say = clip(o.say, 360);
    if (s && say) lines.push({ lid: s.lid, name: s.name, title: s.title, say });
  }
  const plans: WrPlan[] = [];
  for (const x of Array.isArray(j.plans) ? j.plans : []) {
    if (plans.length >= WR.plans) break;
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    let act = (['move', 'home', 'hold'].includes(String(o.act)) ? String(o.act) : 'move') as WrAct;
    // 여러 갈래(moves): 갈래마다 성계·함대를 확인, 함대는 한 갈래에만
    const mv: WrMove[] = [], used = new Set<number>();
    for (const y of Array.isArray(o.moves) ? o.moves.slice(0, 3) : []) {
      const q = (y && typeof y === 'object' ? y : {}) as Record<string, unknown>, t = names.get(clip(q.target, 80).toLowerCase()); if (!t) continue;
      const f2 = (Array.isArray(q.fleets) ? q.fleets : []).map(Number).filter((n) => fids.has(n) && !used.has(n)).slice(0, 6); if (!f2.length) continue;
      f2.forEach((n) => used.add(n)); const r = String(q.role);
      mv.push({ fleets: f2, target: t, role: (['main', 'support', 'feint', 'defend'].includes(r) ? r : mv.length ? 'support' : 'main') as WrMove['role'] });
    }
    if (mv.length) act = 'move';
    const main = mv.find((m) => m.role === 'main') ?? mv[0];
    const tg = main ? main.target : act === 'move' ? names.get(clip(o.target, 80).toLowerCase()) : '';
    if (act === 'move' && !tg) continue;
    const fl = mv.length ? [...used] : (Array.isArray(o.fleets) ? o.fleets : []).map(Number).filter((n, i, a) => fids.has(n) && a.indexOf(n) === i).slice(0, 6);
    if (!fl.length) continue;
    const line = (Array.isArray(o.line) ? o.line : []).map((x) => names.get(clip(x, 80).toLowerCase())).filter((x, i, a): x is string => !!x && a.indexOf(x) === i).slice(0, 5);
    const s = who.get(Number(o.by)) ?? sp[0];
    plans.push({ id: `${seed}-${plans.length + 1}`, by: s?.lid ?? 0, byName: s?.name ?? '', ...(s?.lv ? { byLv: s.lv } : {}), code: clip(o.code, 32).replace(/^(operation|작전)\s*/i, '').replace(/^[「"']+|[」"']+$/g, '') || codeName(`${seed}-${plans.length}`), title: clip(o.title, 60) || (act === 'move' ? L(`${tg} 작전`, `Operation ${tg}`) : actText(act)), target: tg || '', act, fleets: fl, why: clip(o.why, 240), ...(mv.length > 1 ? { moves: mv } : {}), ...(line.length >= 2 ? { line } : {}) });
  }
  if (!lines.length && !plans.length) return null;
  return { lines, plans };
}

/** 작전명(LLM 이 안 주면): 형용사 + 명사를 씨앗으로 고른다. */
const CODE_A: Array<[string, string]> = [['붉은', 'Crimson'], ['고요한', 'Silent'], ['부서진', 'Shattered'], ['푸른', 'Azure'], ['강철', 'Iron'], ['마지막', 'Last'], ['타오르는', 'Burning'], ['얼어붙은', 'Frozen'], ['검은', 'Black'], ['황금', 'Golden'], ['떠오르는', 'Rising'], ['보이지 않는', 'Unseen']];
const CODE_N: Array<[string, string]> = [['창', 'Spear'], ['새벽', 'Dawn'], ['방패', 'Aegis'], ['망치', 'Hammer'], ['별무리', 'Cluster'], ['폭풍', 'Tempest'], ['송곳니', 'Fang'], ['등불', 'Lantern'], ['날개', 'Wing'], ['성벽', 'Rampart'], ['혜성', 'Comet'], ['칼날', 'Edge']];
export function codeName(seed: string): string { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; const a = CODE_A[h % CODE_A.length], n = CODE_N[(h >>> 8) % CODE_N.length]; return L(`${a[0]} ${n[0]}`, `${a[1]} ${n[1]}`); }
/** LLM 이 없을 때의 틀 회의: 전쟁 중이면 가장 가까운 적 식민지로 가장 센 함대, 아니면 위협받는 국경으로, 그것도 없으면 수도 집결. */
export function councilFallback(b: WrBrief, sp: WrSpeaker[], seed: string): { lines: WrLine[]; plans: WrPlan[] } {
  const lead = sp.find((s) => s.role === 'minister') ?? sp[0], adm = sp.find((s) => s.role === 'admiral');
  const strong = [...b.fleets].sort((x, y) => y.power - x.power), top = strong[0];
  const lines: WrLine[] = [], plans: WrPlan[] = [];
  const enemyCol = b.cands.filter((c) => c.kind === 'enemy colony').sort((x, y) => x.jumps - y.jumps)[0];
  const threat = b.cands.filter((c) => c.kind === 'threatened border').sort((x, y) => x.jumps - y.jumps)[0];
  const by = lead ?? adm;
  if (top && b.war && enemyCol) {
    if (lead) lines.push({ lid: lead.lid, name: lead.name, title: lead.title, say: L(`가장 가까운 적 거점은 ${enemyCol.name}입니다. ${top.name}을(를) 보내 압박하시지요.`, `The nearest enemy stronghold is ${enemyCol.name}. I suggest sending ${top.name} to press them.`) });
    plans.push({ id: seed + '-1', by: by?.lid ?? 0, byName: by?.name ?? '', code: codeName(seed), title: L(`${enemyCol.name} 공략`, `Strike on ${enemyCol.name}`), target: enemyCol.name, act: 'move', fleets: [top.fid], why: L(`${enemyCol.jumps}칸 거리 · 가장 센 함대를 보냅니다.`, `${enemyCol.jumps} jumps away · sends our strongest fleet.`) });
  } else if (top && threat) {
    if (lead) lines.push({ lid: lead.lid, name: lead.name, title: lead.title, say: L(`${threat.name} 근처에 다른 나라 군함이 보입니다. 국경을 지키는 편이 좋겠습니다.`, `Foreign warships are near ${threat.name}. We should guard the border.`) });
    plans.push({ id: seed + '-1', by: by?.lid ?? 0, byName: by?.name ?? '', code: codeName(seed), title: L(`${threat.name} 방어`, `Guard ${threat.name}`), target: threat.name, act: 'move', fleets: [top.fid], why: L('국경의 위협에 맞섭니다.', 'Meets the threat on our border.') });
  } else if (strong.length) {
    if (lead) lines.push({ lid: lead.lid, name: lead.name, title: lead.title, say: L('지금은 뚜렷한 위협이 없습니다. 함대를 수도에 모아 두시지요.', 'There is no clear threat right now. Let us gather the fleets at the capital.') });
    plans.push({ id: seed + '-1', by: by?.lid ?? 0, byName: by?.name ?? '', code: codeName(seed), title: L('수도 집결', 'Gather at the capital'), target: '', act: 'home', fleets: strong.slice(0, 3).map((f) => f.fid), why: L('흩어진 함대를 한곳에 모읍니다.', 'Gathers the scattered fleets in one place.') });
  }
  if (adm && top && adm.fleet) lines.push({ lid: adm.lid, name: adm.name, title: adm.title, say: L(`${adm.fleet}은(는) 명령만 기다리고 있습니다.`, `${adm.fleet} awaits your orders.`) });
  return { lines, plans };
}

// ---- 빌려 온 동맹 함대의 독자 행동(2026-11-05 사용자: 합동 작전 + 자동 작전 — 빌려 왔어도 그들이 직접 움직이는 느낌) ----
// 게임이 매달(sllm_wr.1) 쉬고 있는 동맹 함대를 스스로 움직이고 WRAUTO(함대)·WRAUTOS(목적지)를 보낸다. ev 1 진격 · 2 국경 순찰 · 3 수리하러 감.
export type WrAutoEv = 'attack' | 'patrol' | 'repair';
export interface WrAuto { n: number; date: string; ev: WrAutoEv; aidx: number; fleet: string; adm: string; at: string; sys: string }
const AUTO_EV: Record<number, WrAutoEv> = { 1: 'attack', 2: 'patrol', 3: 'repair' };
export class WrAutoCollector {
  private cur: WrAuto | null = null;
  /** 묶음이 끝나면(WRAUTOS 가 오거나 다음 WRAUTO) 돌려준다. */
  feed(m: SllmMessage): WrAuto | null {
    if (m.kind === 'WRAUTO') {
      const prev = this.cur, ev = AUTO_EV[Math.round(num(m.kv.ev))];
      this.cur = ev ? { n: Math.round(num(m.kv.n)), date: str(m.kv.date, 20), ev, aidx: Math.max(0, Math.round(num(m.kv.ally))), fleet: str(m.kv.fleet), adm: str(m.kv.adm), at: str(m.kv.at), sys: '' } : null;
      return prev;
    }
    if (m.kind === 'WRAUTOS' && this.cur && Math.round(num(m.kv.n)) === this.cur.n) { const c = this.cur; c.sys = str(m.kv.sys); this.cur = null; return c; }
    return null;
  }
  flush(): WrAuto | null { const c = this.cur; this.cur = null; return c; }
}
/** 동맹 함대 지휘관의 무전 한 줄(틀 문장, LLM 없음). */
export function autoRadio(a: WrAuto, ally: string): { title: string; body: string } {
  const who = a.adm ? `${a.fleet}(${a.adm})` : a.fleet;
  if (a.ev === 'attack') return { title: L(`${ally} 함대 독자 진격`, `${ally} fleet advances on its own`), body: L(`「${a.sys} 쪽 적을 치러 간다. 엄호는 필요 없다.」 — ${who}`, `"Moving on the enemy at ${a.sys}. No cover needed." — ${who}`) };
  if (a.ev === 'repair') return { title: L(`${ally} 함대 수리 귀환`, `${ally} fleet withdraws for repairs`), body: L(`「피해가 크다. ${a.sys} 조선소에서 정비하고 돌아오겠다.」 — ${who}`, `"We took heavy damage. Refitting at ${a.sys}, then we'll be back." — ${who}`) };
  return { title: L(`${ally} 함대 국경 순찰`, `${ally} fleet on border patrol`), body: L(`「${a.sys} 국경을 돌아보겠다. 조용하면 좋겠군.」 — ${who}`, `"Patrolling the border at ${a.sys}. Let's hope it stays quiet." — ${who}`) };
}
/** 동맹 함대가 우리 요청을 거절할 때(WRSET ally_repair · ally_refuse). */
export function allyRefuseText(status: string, fleet: string, ally: string): string {
  return status === 'ally_repair'
    ? L(`${ally}의 ${fleet}: 「지금은 무리다. 함선 절반이 불타고 있다 — 수리부터 하겠다.」`, `${fleet} of ${ally}: "Not now. Half our ships are burning — repairs first."`)
    : L(`${ally}의 ${fleet}: 「그 명령은 따를 수 없다. 우리 지휘관의 판단으로 지금 자리를 지키겠다.」`, `${fleet} of ${ally}: "We cannot follow that order. Our commander judges it best to hold here."`);
}

// ---- 연합 원정군(2026-11-05 사용자: 민간 방위군 모드처럼 따로 세력을 만들어 명령대로 움직이게) ----
// 동맹이 보낸 함대를 AI 가 꺼진 우리 쪽 세력 「<동맹> 연합 원정군」으로 옮긴다(게임: sllm_warroom_xf.txt). 게임 AI 가 덮어쓰지 않아 우리 명령·독자 판단 그대로 움직이고,
// 전쟁에는 끼지 않고 우리·그 동맹의 적에게 적대만 비춘다. 수락 판정·답신은 함대 사령부 합동 작전과 같은 규칙(fleetorder.ts allyChance·allyMessages)을 쓴다.
export const XF = { days: 1800, years: 5, coolMonths: 24 } as const; // 계약 5년(2026-11-05 사용자: 1년은 너무 빠르다)
export function xfCreateCommand(req: number, sid: string, tid: number, n: number, days: number = XF.days): string {
  okReq(req); if (!Number.isSafeInteger(tid) || tid < 1 || ![1, 2, 3].includes(n)) throw new Error('INVALID_ALLY');
  return `effect ${target(sid)} sllm_wr_xf_create = { REQ = ${req} TID = ${tid} N = ${n} DAYS = ${Math.round(days)} } }`;
}
export function xfEndCommand(req: number, sid: string, tid: number): string { okReq(req); if (!Number.isSafeInteger(tid) || tid < 1) throw new Error('INVALID_ALLY'); return `effect ${target(sid)} sllm_wr_xf_end = { REQ = ${req} TID = ${tid} } }`; }
/** 원정군 매달 사건(WRXF): 2 일부 잃음 · 3 전멸 · 4 기간 끝 귀환 · 5 우리가 돌려보냄 · 6 관계가 깨져 철수 · 7 보낸 나라가 사라져 우리에게 합류 */
export interface WrXfEv { ev: number; idx: number; n: number; left: number; date: string; name: string }
export function parseXf(m: SllmMessage): WrXfEv | null {
  if (m.kind !== 'WRXF') return null; const ev = Math.round(num(m.kv.ev)); if (ev < 2 || ev > 7) return null;
  return { ev, idx: Math.round(num(m.kv.idx)), n: Math.round(num(m.kv.n)), left: Math.round(num(m.kv.left)), date: str(m.kv.date, 20), name: str(m.kv.name) };
}
export function xfEvText(e: WrXfEv, ally: string): { title: string; body: string } {
  const f = e.name || L(`${ally} 연합 원정군`, `${ally} Expeditionary Force`);
  if (e.ev === 2) return { title: L(`${f} 손실`, `${f} losses`), body: L(`${ally}에서 온 원정군 함대를 잃었습니다(남은 함대 ${e.left}개). ${ally}의 호감이 떨어집니다.`, `We lost a fleet of the force sent by ${ally} (${e.left} left). ${ally}'s opinion of us drops.`) };
  if (e.ev === 3) return { title: L(`${f} 전멸`, `${f} destroyed`), body: L(`${ally}에서 온 원정군이 모두 격침되었습니다. ${ally}의 호감이 크게 떨어집니다.`, `The whole force sent by ${ally} has been destroyed. ${ally}'s opinion of us falls sharply.`) };
  if (e.ev === 4) return { title: L(`${f} 귀환`, `${f} goes home`), body: L(`계약 기간이 끝나 원정군 함대 ${e.left}개가 ${ally}(으)로 돌아갔습니다.`, `The contract ended; ${e.left} fleet(s) returned to ${ally}.`) };
  if (e.ev === 5) return { title: L(`${f} 해산`, `${f} released`), body: L(`원정군 함대 ${e.left}개를 ${ally}(으)로 돌려보냈습니다.`, `We sent ${e.left} fleet(s) back to ${ally}.`) };
  if (e.ev === 6) return { title: L(`${f} 철수`, `${f} withdraws`), body: L(`${ally}와(과)의 관계가 달라져 원정군이 본국으로 철수했습니다.`, `Relations with ${ally} changed; the force withdrew home.`) };
  return { title: L(`${f} 합류`, `${f} joins us`), body: L(`${ally}이(가) 사라져 갈 곳 없는 원정군 함대 ${e.left}개가 우리 함대에 합류했습니다.`, `${ally} is gone; ${e.left} stranded fleet(s) joined our navy.`) };
}

/** 원정군 요청에 대한 그 나라 통치자의 답신(LLM 1번, JSON {reply}). 수락·거절은 앱 주사위가 이미 정했다. 함대 사령부 합동 작전 문장과 달리 5년 원정군. */
export function xfMessages(a: { empire: string; date: string; ally: { name: string; rel: number; cw: boolean; op: number; tr: number }; accepted: boolean; n: number; ask: string; rel: string; op: string }): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: [
      `Stellaris. The ruler of ${a.ally.name} answers a request from ${a.empire} (date ${a.date}) to send an expeditionary force of warships that will fight alongside them under their war council for ${XF.years} years.`,
      a.accepted ? `They AGREE and send ${a.n} fleet(s) as the "${a.ally.name} Expeditionary Force". They may add a condition or a warning (bring them home, do not waste them).` : 'They REFUSE. Give a reason that fits the relationship (not trusted enough, need the ships at home, the commitment is too long).',
      'One short message of 2-4 sentences, in character, diplomatic. Do not state game numbers. Reply ONLY with JSON: {"reply":"..."}',
    ].join('\n') },
    { role: 'user', content: [`Relationship: ${a.rel}${a.ally.cw ? ', fighting the same war' : ''}. Their opinion of us: ${a.op}. Trust level ${a.ally.tr}/3.`, a.ask ? `The request: ${a.ask}` : 'The request: send us an expeditionary force.'].join('\n') },
  ];
}
export const xfFallback = (accepted: boolean, n: number, name: string) => accepted
  ? L(`${name}: 좋습니다. 함대 ${n}개로 원정군을 꾸려 ${XF.years}년 동안 함께 싸우겠습니다. 헛되이 잃지 마십시오.`, `${name}: Very well. ${n} fleet(s) will fight beside you as our expeditionary force for ${XF.years} years. Do not waste them.`)
  : L(`${name}: 유감이지만 지금은 원정군을 보낼 수 없습니다.`, `${name}: Regrettably, we cannot send an expeditionary force right now.`);

// ---- 명령에 대한 제독 의견(2026-11-05 사용자: 지도에서 내린 명령에 제독이 의견을 낼 수 있어야 한다) ----
// 명령은 이미 전해졌다(함대는 「직접 지휘」로 바뀌어 자동 작전이 손대지 않음). 그 함대의 지휘관이 찬성·우려·반대를 한두 문장으로 말한다.
// 적 함대·기지는 세이브 때 마지막으로 본 모습이라 낡았을 수 있다. 반대하면 화면이 「명령 철회(정지)」 단추를 보여 준다.
export type WrStance = 'agree' | 'caution' | 'object';
export interface WrOpinionCtx {
  empire: string; date: string; war: boolean; seenAt: string;
  speaker: { name: string; title: string; persona?: string; trust?: number; foreign?: string; doctrine?: string };
  fleet: { name: string; power: number; flagship: string; at: string; status: string; on_loan_from?: string };
  order: { act: WrAct; target: string; jumps: number | null };
  target?: { name: string; owner: string; relation: 'ours' | 'enemy' | 'other' | 'unclaimed'; colonies: number; starbase: string; sbLevel: number };
  enemyAtTarget: Array<{ owner: string; power: number; flagship: string }>;
  enemyNearby: Array<{ owner: string; power: number; at: string }>;
  oursNearby: Array<{ name: string; power: number; at: string }>;
}
/** 항성기지 등급 → 대략 전력(LLM 이 없을 때 판단용, 게임 값이 아니라 어림) */
export const SB_POW: Record<number, number> = { 2: 1500, 3: 4000, 4: 9000, 5: 18000 };
export const SB_EN: Record<number, string> = { 2: 'starport', 3: 'starhold', 4: 'star fortress', 5: 'citadel' };
/** 함선 크기 아이콘 칸 → 영어 이름(LLM 브리핑용, ship_sizes.dds 칸 = 모드 sllm_wr_big) */
export const SHIP_EN: Record<number, string> = { 2: 'corvette', 14: 'frigate', 3: 'destroyer', 4: 'cruiser', 5: 'battleship', 6: 'titan', 7: 'colossus', 13: 'juggernaut', 28: 'paladin', 15: 'mauler', 16: 'mauler', 17: 'mauler', 18: 'weaver', 19: 'weaver', 20: 'weaver', 21: 'harbinger', 22: 'harbinger', 23: 'harbinger', 24: 'stinger', 25: 'stinger', 26: 'stinger' };
export function opinionMessages(c: WrOpinionCtx): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: [
      `Stellaris war room of the empire "${c.empire}" (date ${c.date}). The ruler has just given a fleet an order on the holographic galaxy map, and the order is already on its way.`,
      c.speaker.foreign ? `You are ${c.speaker.name}, commander of the "${c.fleet.name}", a fleet on loan from ${c.speaker.foreign}. You serve your own empire first and speak plainly to a foreign ruler.` : `You are ${c.speaker.name} (${c.speaker.title}), commander of the "${c.fleet.name}".`,
      'Give your honest professional opinion of THIS order in 1-2 short sentences, in character and true to your war doctrine (a No-Retreat Charger cheers an assault, a Fortress Keeper grumbles about leaving the chokepoint, a Calculator weighs the numbers): name the concrete reason (enemy fleets or a fortified starbase at the target, distance, leaving a border open, a good opportunity). ',
      'stance: "agree" (sound order), "caution" (doable but there is a real risk you name), "object" (clearly reckless or pointless, e.g. the enemy forces there far outmatch us). Do not object lightly. ',
      `Enemy positions are what we last saw as of the save on ${c.seenAt}; they may have moved. Powers are fleet power numbers. Do not invent fleets or systems. Do not repeat numbers verbatim.`,
      'Reply ONLY with JSON: {"stance":"agree","say":"..."}',
    ].join('\n') },
    { role: 'user', content: JSON.stringify({ fleet: c.fleet, order: c.order, target: c.target, enemy_forces_at_target: c.enemyAtTarget, enemy_fleets_within_2_jumps: c.enemyNearby, our_fleets_nearby: c.oursNearby, at_war: c.war, commander_manner: c.speaker.persona || undefined, your_war_doctrine: c.speaker.doctrine || undefined, trust_in_ruler: typeof c.speaker.trust === 'number' ? c.speaker.trust : undefined }) },
  ];
}
export function parseOpinion(raw: string | null): { stance: WrStance; say: string } | null {
  const j = raw ? parseJson(raw) : null; if (!j) return null;
  const st = String(j.stance || '').toLowerCase(), say = clip(j.say, 300);
  if (!say) return null;
  return { stance: st === 'object' || st === 'caution' ? st : 'agree', say };
}
/** LLM 이 없을 때: 목표의 적 전력(함대 + 기지 어림) 대 우리 함대 전력, 거리로 판단. */
export function opinionFallback(c: WrOpinionCtx): { stance: WrStance; say: string } {
  const sbEn = c.target?.relation === 'enemy' ? SB_POW[c.target.sbLevel] ?? 0 : 0;
  const foe = c.enemyAtTarget.reduce((a, f) => a + f.power, 0) + sbEn, ours = Math.max(1, c.fleet.power), far = (c.order.jumps ?? 0) > 8;
  const tgt = c.order.target || L('목표', 'the target');
  if (c.order.act !== 'move') return { stance: 'agree', say: L('알겠습니다. 명령대로 하겠습니다.', 'Understood. Carrying out the order.') };
  if (foe > ours * 1.25) return { stance: 'object', say: L(`${tgt}에는 우리보다 강한 적 전력이 버티고 있습니다. 이대로 들어가면 함대를 잃을 수 있습니다.`, `The enemy holds ${tgt} with more strength than we have. Going in like this could cost us the fleet.`) };
  if (foe > ours * 0.6) return { stance: 'caution', say: L(`${tgt}의 적이 만만치 않습니다. 가능하면 다른 함대와 함께 들어가겠습니다.`, `The enemy at ${tgt} is no pushover. I would rather go in with another fleet.`) };
  if (far) return { stance: 'caution', say: L(`${tgt}까지는 멉니다. 그동안 국경이 비지 않도록 살펴 주십시오.`, `${tgt} is a long way off. Please keep an eye on the border while we are gone.`) };
  return { stance: 'agree', say: foe > 0 ? L(`${tgt}의 적은 우리가 감당할 만합니다. 바로 출격하겠습니다.`, `We can handle the enemy at ${tgt}. Moving out now.`) : L(`${tgt}(으)로 이동하겠습니다.`, `Moving to ${tgt}.`) };
}

// ---- 작전 건의(2026-11-05 사용자: 장관이나 레벨이 높은 유능한 제독이 회의를 부르지 않아도 스스로 작전을 들고 온다) ----
/** 건의할 자격: 국방 장관, 레벨 PROPOSE_LV 이상 제독. 게임 달마다 한 번(앱이 막는다). */
export const PROPOSE_LV = 5;
export function proposeMessages(b: WrBrief, sp: WrSpeaker[]): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: `War room of the Stellaris empire "${b.empire}". Without being summoned, the most capable officers — the defense minister(s) and high-level admirals — come to the ruler at the holographic galaxy map with operation proposals of their own. ` +
      'Each proposer brings AT MOST one proposal, only if there is something genuinely worth doing given the briefing (an exposed enemy colony, a threatened border, a chance to strike a weakened enemy, regrouping scattered fleets); a proposer with nothing worthwhile stays silent. Admirals mostly propose operations for their own fleet but may include others. ' +
      'For each proposal, the proposer says one short in-character line (why now). ' +
      'Operation fields: by (proposer lid), code (an evocative operation codename of 1-3 words that does NOT reveal the target, flavored by the empire and the proposer — like Operation Overlord; write it without the word "Operation"), title (max 8 words, plain description), target (EXACTLY one system name from candidates, or "" for act "home"/"hold"), act ("move" | "home" | "hold"), fleets (fid numbers from the briefing), why (one sentence with the trade-off). ' + OPS_MOVES + DOCTRINE + 'Each proposer\'s operation follows their own war doctrine (doctrine). ' +
      'Do not invent systems, fleets or empires. Never move fleets into a system of an empire we are not at war with unless it is unowned or ours. ' +
      'Reply with JSON only: {"lines":[{"lid":0,"say":""}],"plans":[{"by":0,"code":"","title":"","target":"","act":"move","fleets":[0],"why":"","moves":[],"line":[]}]} (empty arrays if nobody has a proposal).' },
    { role: 'user', content: JSON.stringify({ briefing: b, proposers: sp.map((s) => ({ lid: s.lid, name: s.name, role: s.role, title: s.title, level: s.lv || undefined, doctrine: doctrineByKey(s.doc) ? `${doctrineByKey(s.doc)!.en} (${doctrineByKey(s.doc)!.style}): ${doctrineByKey(s.doc)!.desc}` : undefined, commands_fleet: s.fleet || undefined, manner: s.persona || undefined })) }) },
  ];
}

// ---- 인물별 전쟁 성향(2026-11-05 사용자: 장관·제독·타제국 인물마다 공격적·방어적·전술적, 더 잘게 나눠서, 서로 의견이 부딪히게) ----
export type WrStyle = 'aggressive' | 'defensive' | 'tactical';
export interface WrDoctrine { key: string; style: WrStyle; ko: string; en: string; desc: string }
export const WR_DOCTRINES: WrDoctrine[] = [
  { key: 'no_retreat', style: 'aggressive', ko: '후퇴 없는 돌격가', en: 'No-Retreat Charger', desc: 'there is no retreat: throw everything at the enemy, head-on, even against the odds; scorns caution and withdrawal as cowardice' },
  { key: 'focused_striker', style: 'aggressive', ko: '집중 타격가', en: 'Focused Striker', desc: 'attacks, but only where it matters: masses overwhelming force on one decisive point and ignores the rest' },
  { key: 'raider', style: 'aggressive', ko: '기습 약탈가', en: 'Raider', desc: 'fast deep strikes on weakly held enemy colonies and supply, hit and run, never a pitched battle' },
  { key: 'fortress', style: 'defensive', ko: '요새 수호자', en: 'Fortress Keeper', desc: 'holds chokepoints and starbases at all costs and refuses to leave a fortified position to go adventuring' },
  { key: 'elastic', style: 'defensive', ko: '탄력 방어가', en: 'Elastic Defender', desc: 'gives ground on purpose, lets the enemy overextend into our space, then counterattacks their stretched fleets' },
  { key: 'guardian', style: 'defensive', ko: '본토 수호자', en: 'Homeland Guardian', desc: 'the capital and core worlds come first; risk-averse, wants fleets kept close to home' },
  { key: 'maneuver', style: 'tactical', ko: '기동 전술가', en: 'Maneuver Tactician', desc: 'flanks, pincers and feints; wins by movement and deception rather than mass' },
  { key: 'calculator', style: 'tactical', ko: '계산형 참모', en: 'Calculating Staff Officer', desc: 'fights only with a clear numbers advantage; talks power ratios, distance and timing, distrusts gut feeling' },
  { key: 'opportunist', style: 'tactical', ko: '기회주의자', en: 'Opportunist', desc: 'waits for the enemy to commit or get distracted elsewhere, then strikes the gap' },
];
const DOC_BY = new Map(WR_DOCTRINES.map((d) => [d.key, d]));
export const doctrineByKey = (k?: string): WrDoctrine | undefined => (k ? DOC_BY.get(k) : undefined);
/** 성향 고르기: 지도자 특성 키가 있으면 그것으로, 다른 나라 연락관은 그 나라 AI 성격으로 쏠리게, 없으면 씨앗(번호)으로 고정 — 같은 인물은 늘 같은 성향. */
export function doctrineOf(seed: number, traits: string[] = [], lean = ''): WrDoctrine {
  const own = traits.find((x) => x.startsWith('sllm_doc_')), od = own ? DOC_BY.get(own.slice(9)) : undefined; if (od) return od; // 이미 붙인 성향 특성
  const t = traits.join(' ').toLowerCase();
  const pick = (k: string) => DOC_BY.get(k)!;
  if (/reckless|berserk|glory|warmonger|bloodthirst/.test(t)) return pick('no_retreat');
  if (/unyielding|fortif|bastion|defender|paranoid/.test(t)) return pick('fortress');
  if (/trickster|flank|tactic|scout|gale/.test(t)) return pick('maneuver');
  if (/logistic|engineer|calculat|analytical|meticulous/.test(t)) return pick('calculator');
  if (/aggressive|brawl|hunter/.test(t)) return pick('focused_striker');
  if (/raider|nomad|corsair|wanderer/.test(t)) return pick('raider');
  if (/cautious|careful|stubborn/.test(t)) return pick('guardian');
  let h = (seed * 2654435761) >>> 0; h ^= h >>> 13;
  const style: WrStyle = /warrior|imperialist|zealot|purifier|devour|exterminat|conquer|honorbound|hegemon|slaver/.test(lean) ? 'aggressive' : /peaceful|isolation|harmon|pacif|trader|federation_builder|democratic_crusaders/.test(lean) ? (lean.includes('crusader') ? 'aggressive' : 'defensive') : '' as WrStyle;
  const pool = style ? WR_DOCTRINES.filter((d) => d.style === style) : WR_DOCTRINES;
  return pool[h % pool.length];
}
/** 회의 지시: 성향대로 말하고 서로 부딪힌다 */
export const CLASH = 'Every speaker has a war doctrine (doctrine) and argues consistently from it — a No-Retreat Charger scorns retreat and wants an all-out assault, a Fortress Keeper refuses to abandon the chokepoint, a Calculating Staff Officer demands the numbers, a Raider wants to slip past and burn colonies, and so on. ' +
  'When doctrines differ, let them openly clash for a few exchanges — they address each other by name, rebut each other\'s reasoning, sometimes sharply but never insubordinately toward the ruler — and the plans they propose follow their own doctrine, so the ruler gets genuinely different options to choose from. A tactical officer may mediate or side with one camp. ';

/** 성향 특성의 게임 효과(모드 common/traits/sllm_warroom_traits.txt 와 같아야 함): 맡은 함대 +3%, 평의회 의원이면 제국 전체 함선 +3% */
export const DOC_FX: Record<string, [string, string]> = {
  no_retreat: ['무기 피해 +3%', 'Weapon damage +3%'], focused_striker: ['연사 속도 +3%', 'Fire rate +3%'], raider: ['아광속 속도 +3%', 'Sublight speed +3%'],
  fortress: ['장갑 +3%', 'Armor +3%'], elastic: ['보호막 +3%', 'Shields +3%'], guardian: ['선체 +3%', 'Hull +3%'],
  maneuver: ['회피 +3%', 'Evasion +3%'], calculator: ['무기 사거리 +3%', 'Weapon range +3%'], opportunist: ['이탈 확률 +3%', 'Disengage chance +3%'],
};
/** 성향 특성 붙이기 명령(지도자 여럿, 마지막에 WRSET). */
export function docCommand(req: number, sid: string, list: Array<{ lid: number; key: string }>): string {
  okReq(req);
  const body = list.filter((x) => Number.isSafeInteger(x.lid) && x.lid > 0 && DOC_BY.has(x.key)).slice(0, 12).map((x) => `sllm_wr_doc_set = { LID = ${x.lid} TRAIT = sllm_doc_${x.key} }`).join(' ');
  return `effect ${target(sid)} ${body} sllm_wr_doc_done = { REQ = ${req} } }`;
}
