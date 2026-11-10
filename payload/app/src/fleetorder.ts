// 자동 작전(2026-11-04 사용자 결정: 「자동작전 · Auto Combat」 모드를 참고해 우리 기능으로). 순수 로직 — 로그 줄 묶기·게임 명령·제독 무전 틀 문장.
// 게임 쪽: tester-mod/common/scripted_effects/sllm_fleetorder.txt(해군 작전 최대 3개·수리 복귀·직접 지휘 표식). 앱 쪽: features/fleetorder-app.ts. 화면: ui/fleet-order.js(함대 사령부).
// 무전은 틀 문장(LLM 없음). LLM 은 누를 때만: ① 작전 지시(말 → 설정 숫자 + 제독 답 무전) ② 작전 결과 보고서 ③ 무전에 답하기(persona-app 1:1 과 같은 기억). 「슈뢰딩거」: 보고는 함대 사령부를 열 때·⟳ 때만, 매달 사건 줄은 게임이 스스로 남긴다(앱 명령 없음).
import { L } from './i18n-pick';
import type { SllmMessage } from './protocol';
import type { ChatMessage } from './player2';

export const FO = { keep: 40, ops: 3 } as const;
export type FoEv = 'new' | 'go' | 'done' | 'lost' | 'lead' | 'abort' | 'retreat' | 'repair' | 'repaired' | 'order';
const EVS: readonly FoEv[] = ['new', 'go', 'done', 'lost', 'lead', 'abort', 'retreat', 'repair', 'repaired', 'order'];
export interface FoEvent { n: number; date: string; ev: FoEv; op: number; pow: number; en: number; cnt: number; fleet: string; adm: string; at: string; sys: string; lid?: number; /** 'order': 작전 지시에 대한 제독의 답(LLM 이 쓴 문장) */ say?: string }
export interface FoOp { op: number; st: number; m: number; pow: number; en: number; cnt: number; fleet: string; adm: string; at: string; sys: string; lid?: number }
export interface FoFleet { fid: number; op: number; mode: number; pow: number; fleet: string; adm: string; at: string; own: string } // mode 4 = 빌려 온 동맹 함대(own = 그 나라)
/** 작전 지시 값(모드 변수): ratio 1.0~1.6, hpt 1~5(수리 40~80%), ops 1~3, range 1~3(12·25·40칸). prio = 우선 목표 성계 이름(없으면 ''). */
export interface FoOrders { ratio: number; hpt: number; ops: number; range: number; prio: string; /** 수색 섬멸식 조건(2026-11-04): 적 요새 피하기 · 우리 영토 안에서만 · 끝까지 추격 */ nosb?: boolean; home?: boolean; chase?: boolean }
export interface FoSys { sid: number; name: string; owner: string }
/** 합동 작전 후보(보고 FOALLYC): op 호감 단계 0~4, tr 신뢰 0~3, rel 3 연방 · 2 방위 조약 · 1 같은 전쟁, cw 같은 편으로 같은 전쟁, n·pow 빌려줄 수 있는 함대, lend 지금 우리에게 빌려준 중 */
export interface FoAlly { idx: number; name: string; op: number; tr: number; rel: number; cw: boolean; n: number; pow: number; lend: boolean }
export interface FoReport { on: boolean; war: boolean; date: string; ops: FoOp[]; fleets: FoFleet[]; orders?: FoOrders; systems: FoSys[]; allies: FoAlly[]; lent: Array<{ fleet: string; adm: string; to: string }>; leased: Array<{ fleet: string; adm: string; pow: number }> }

/** 게임 변수 글자(1234.5, -3, 12.3K) → 수. 모르면 0. */
const num = (v: string | undefined) => { const m = String(v ?? '').trim().replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*([KkMm])?$/); return m ? Number(m[1]) * (m[2] ? (/[Kk]/.test(m[2]) ? 1e3 : 1e6) : 1) : 0; };
/** 사건 번호(모드 EVN): 1 new 2 go 3 done 4 lost 5 lead 6 abort 7 retreat 8 repair 9 repaired. 글자로 와도 받는다. */
const EV_CODE: Record<number, FoEv> = { 1: 'new', 2: 'go', 3: 'done', 4: 'lost', 5: 'lead', 6: 'abort', 7: 'retreat', 8: 'repair', 9: 'repaired' };
const evOf = (v: string | undefined): FoEv | null => { const k = Math.round(num(v)); if (EV_CODE[k]) return EV_CODE[k]; return EVS.includes(v as FoEv) ? v as FoEv : null; };
const str = (v: string | undefined) => String(v ?? '').trim().slice(0, 80);

/** 매달 사건 줄(FOEV → FOEVF·FOEVS, 같은 n). 묶음이 끝났는지는 다음 FOEV 나 시간으로 앱이 정한다. */
export class FoEventCollector {
  private cur: FoEvent | null = null;
  /** 사건 줄이면 true. 새 FOEV 가 오면 앞 묶음을 돌려준다. */
  feed(m: SllmMessage): { done: FoEvent | null; used: boolean } {
    if (m.kind === 'FOEV') {
      const prev = this.cur, ev = evOf(m.kv.ev);
      this.cur = ev ? { n: Math.round(num(m.kv.n)), date: str(m.kv.date), ev, op: num(m.kv.op), pow: num(m.kv.pow), en: num(m.kv.en), cnt: num(m.kv.cnt), fleet: '', adm: '', at: '', sys: '' } : null;
      return { done: prev, used: true };
    }
    if (m.kind === 'FOEVA' && this.cur && Math.round(num(m.kv.n)) === this.cur.n) { const lid = Math.round(num(m.kv.lid)); if (lid > 0) this.cur.lid = lid; return { done: null, used: true }; }
    if ((m.kind === 'FOEVF' || m.kind === 'FOEVS') && this.cur && Math.round(num(m.kv.n)) === this.cur.n) {
      if (m.kind === 'FOEVF') Object.assign(this.cur, { fleet: str(m.kv.fleet), adm: str(m.kv.adm), at: str(m.kv.at) });
      else this.cur.sys = str(m.kv.sys);
      return { done: null, used: true };
    }
    return { done: null, used: false };
  }
  flush(): FoEvent | null { const c = this.cur; this.cur = null; return c; }
}

/** 보고 줄(FOREP·FOOP·FOOPF·FOOPS·FOFL, 같은 req) → FOREP_END 에서 끝. */
export class FoReportCollector {
  private by = new Map<string, FoReport>();
  feed(m: SllmMessage): boolean {
    const req = m.kv.req ? String(Math.round(num(m.kv.req))) : ''; if (!req || req === '0') return false;
    if (m.kind === 'FOREP') { this.by.set(req, { on: Math.round(num(m.kv.on)) === 1, war: Math.round(num(m.kv.war)) === 1, date: str(m.kv.date), ops: [], fleets: [], systems: [], allies: [], lent: [], leased: [] }); return true; }
    const r = this.by.get(req); if (!r) return false;
    const opOf = (n0: number) => { const n = Math.round(n0); let o = r.ops.find((x) => x.op === n); if (!o) { o = { op: n, st: 0, m: 0, pow: 0, en: 0, cnt: 0, fleet: '', adm: '', at: '', sys: '' }; r.ops.push(o); } return o; };
    if (m.kind === 'FOOP') { Object.assign(opOf(num(m.kv.op)), { st: num(m.kv.st), m: num(m.kv.m), pow: num(m.kv.pow), en: num(m.kv.en), cnt: num(m.kv.cnt) }); return true; }
    if (m.kind === 'FOOPF') { Object.assign(opOf(num(m.kv.op)), { fleet: str(m.kv.fleet), adm: str(m.kv.adm), at: str(m.kv.at) }); return true; }
    if (m.kind === 'FOOPS') { opOf(num(m.kv.op)).sys = str(m.kv.sys); return true; }
    if (m.kind === 'FOOPA') { const lid = Math.round(num(m.kv.lid)); if (lid > 0) opOf(num(m.kv.op)).lid = lid; return true; }
    if (m.kind === 'FORDR') { r.orders = { ratio: Math.round(num(m.kv.ratio) * 100) / 100 || 1.2, hpt: Math.round(num(m.kv.hpt)) || 3, ops: Math.round(num(m.kv.ops)) || 3, range: Math.round(num(m.kv.range)) || 3, prio: r.orders?.prio ?? '', nosb: num(m.kv.nosb) >= 1, home: num(m.kv.home) >= 1, chase: num(m.kv.chase) >= 1 }; return true; }
    if (m.kind === 'FOPRIO') { r.orders = { ...(r.orders ?? { ratio: 1.2, hpt: 3, ops: 3, range: 3 }), prio: str(m.kv.name) }; return true; }
    if (m.kind === 'FOALLYC') { const idx = Math.round(num(m.kv.idx)); if (idx > 0 && r.allies.length < 30 && !r.allies.some((x) => x.idx === idx)) r.allies.push({ idx, name: str(m.kv.name), op: Math.round(num(m.kv.op)), tr: Math.round(num(m.kv.tr)), rel: Math.round(num(m.kv.rel)) || 1, cw: Math.round(num(m.kv.cw)) === 1, n: Math.round(num(m.kv.n)), pow: Math.round(num(m.kv.pow)), lend: Math.round(num(m.kv.lend)) === 1 }); return true; }
    if (m.kind === 'FOLENT') { if (r.lent.length < 30) r.lent.push({ fleet: str(m.kv.fleet), adm: str(m.kv.adm), to: str(m.kv.to) }); return true; }
    if (m.kind === 'FOSYS') { const sid = Math.round(num(m.kv.sid)); if (sid > 0 && r.systems.length < 40 && !r.systems.some((x) => x.sid === sid)) r.systems.push({ sid, name: str(m.kv.name), owner: str(m.kv.owner) }); return true; }
    if (m.kind === 'FOFL') { if (r.fleets.length < 200) r.fleets.push({ fid: Math.round(num(m.kv.fid)), op: Math.round(num(m.kv.op)), mode: Math.round(num(m.kv.mode)), pow: num(m.kv.pow), fleet: str(m.kv.fleet), adm: str(m.kv.adm), at: str(m.kv.at), own: str(m.kv.own) }); return true; }
    return false;
  }
  /** FOREP_END 를 받았을 때 그 보고를 꺼낸다. */
  take(req: string): FoReport | null { const r = this.by.get(req) ?? null; this.by.delete(req); if (r) r.ops.sort((a, b) => a.op - b.op); return r; }
}

const target = (sid: string) => { if (!/^\d+$/.test(sid)) throw new Error(L('세이브 번호가 올바르지 않습니다.', 'Invalid save id.')); return `every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } }`; };
const okReq = (req: number) => { if (!Number.isSafeInteger(req) || req < 1) throw new Error('req'); };
/** 켜기·끄기 → SLLM:FOSET req·status */
export function foSwitchCommand(req: number, sid: string, on: boolean): string { okReq(req); return `effect ${target(sid)} ${on ? 'sllm_fo_enable' : 'sllm_fo_disable'} = { REQ = ${req} } }`; }
/** 보고 → FOREP … FOREP_END */
export function foReportCommand(req: number, sid: string): string { okReq(req); return `effect ${target(sid)} sllm_fo_report = { REQ = ${req} } }`; }
/** 함대 하나 직접 지휘 / 자동 작전 → FOSET */
export function foFleetCommand(req: number, sid: string, fid: number, manual: boolean): string {
  okReq(req); if (!Number.isSafeInteger(fid) || fid < 1) throw new Error(L('함대 번호가 올바르지 않습니다.', 'Invalid fleet id.'));
  return `effect ${target(sid)} sllm_fo_set_manual = { FID = ${fid} ON = ${manual ? 'yes' : 'no'} REQ = ${req} } }`;
}

/** 무전(틀 문장, 한/영). 같은 사건이라도 n 으로 문장을 돌린다. 제독이 없으면 함대 이름으로. */
export function radioText(e: FoEvent): { who: string; text: string } {
  const who = e.adm || e.fleet || L('작전 본부', 'Operations HQ'), sys = e.sys || L('목표 성계', 'the target system'), at = e.at || L('현 위치', 'our position');
  if (e.say) return { who, text: e.say };
  const ratio = e.en > 0 ? Math.round((e.pow / e.en) * 10) / 10 : 0;
  const pick = (xs: Array<[string, string]>) => { const x = xs[Math.abs(e.n) % xs.length]; return L(x[0], x[1]); };
  const T: Record<FoEv, Array<[string, string]>> = {
    new: [[`${sys}을(를) 목표로 작전을 엽니다. ${at}에서 함대를 모으겠습니다.`, `Opening an operation against ${sys}. I'll gather the fleets at ${at}.`],
      [`목표는 ${sys}입니다. 집결지는 ${at}. 이길 수 있을 만큼 모이면 바로 나갑니다.`, `Target: ${sys}. Rally point: ${at}. We move the moment we have enough to win.`]],
    go: [[`집결 끝났습니다. 함대 ${e.cnt}개, ${sys}로 진격합니다.${ratio ? ` 전력은 적의 ${ratio}배입니다.` : ''}`, `Rally complete. ${e.cnt} fleet(s) advancing on ${sys}.${ratio ? ` We outgun them ${ratio} to 1.` : ''}`],
      [`전 함대 출격. ${sys}에서 뵙겠습니다.`, `All fleets moving out. See you at ${sys}.`]],
    done: [[`${sys} 정리 끝났습니다. 다음 명령까지 대기합니다.`, `${sys} is clear. Standing by for the next target.`],
      [`${sys}에 적은 더 없습니다. 함대를 풉니다.`, `No more hostiles at ${sys}. Releasing the fleets.`]],
    lost: [[`${sys} 작전에 나간 함대와 연락이 끊겼습니다. 작전을 접습니다.`, `We have lost contact with every fleet sent against ${sys}. The operation is over.`]],
    lead: [[`선두 함대가 빠져서 제가 지휘를 넘겨받았습니다. ${sys} 작전은 계속됩니다.`, `The lead fleet dropped out, so I have taken command. The ${sys} operation continues.`],
      [`지휘권 인계받았습니다. 목표는 그대로 ${sys}입니다.`, `Command handed over to me. The target is still ${sys}.`]],
    abort: [[`${sys}을(를) 칠 만큼 모이지 않았습니다. 작전을 접고 함대를 풉니다.`, `We could not gather enough to take ${sys}. Calling off the operation.`]],
    retreat: [[`${sys}의 적이 우리보다 강해졌습니다. 수도로 물러납니다.`, `The enemy at ${sys} now outguns us. Falling back to the capital.`],
      [`이대로 들어가면 다 잃습니다. ${sys}에서 철수합니다.`, `Going in now would cost us everything. Withdrawing from ${sys}.`]],
    repair: [[`피해가 큽니다. ${at}에서 빠져 가장 가까운 조선소로 수리하러 갑니다.`, `We've taken heavy damage. Leaving ${at} for the nearest shipyard.`],
      [`선체가 버티지 못합니다. 작전에서 빠져 수리받겠습니다.`, `The hulls can't take much more. Pulling out for repairs.`]],
    repaired: [[`수리 끝났습니다. 다시 작전에 투입될 수 있습니다.`, `Repairs complete. Ready for operations again.`]],
    order: [[`지시 받았습니다.`, `Order received.`]],
  };
  return { who, text: pick(T[e.ev]) };
}
/** 알림을 띄울 사건(수리는 기록에만). */
export const foNotifies = (ev: FoEv) => ev === 'new' || ev === 'go' || ev === 'done' || ev === 'retreat' || ev === 'lost' || ev === 'lead';
/** 연대기에 남길 사건 */
export function foChron(e: FoEvent): string | null {
  const sys = e.sys || L('적 성계', 'an enemy system'), who = e.adm ? L(`${e.adm} 제독`, `Admiral ${e.adm}`) : (e.fleet || L('우리 함대', 'our fleet'));
  if (e.ev === 'done') return L(`${e.date} ${who}이(가) 이끈 자동 작전이 ${sys}을(를) 장악했다.`, `${e.date} An automated operation led by ${who} secured ${sys}.`);
  if (e.ev === 'retreat') return L(`${e.date} ${who}이(가) ${sys}에서 철수했다. 적의 전력이 더 컸다.`, `${e.date} ${who} withdrew from ${sys} in the face of superior enemy strength.`);
  if (e.ev === 'lost') return L(`${e.date} ${sys}로 향한 자동 작전 함대가 모두 돌아오지 못했다.`, `${e.date} None of the fleets sent against ${sys} came back.`);
  return null;
}
export function foFacts(on: boolean, log: FoEvent[]): string[] {
  const out = [on ? 'Automated fleet operations are ON: fleets pick targets, rally and attack on their own; damaged fleets go home for repairs.' : 'Automated fleet operations are off.'];
  for (const e of log.slice(-3)) out.push(`Fleet operation ${e.date}: ${e.ev}${e.sys ? ' at ' + e.sys : ''}${e.adm ? ' (Admiral ' + e.adm + ')' : ''}.`);
  return out;
}

// ── ① 작전 지시 ──
export const ORDERS_DEFAULT: FoOrders = { ratio: 1.2, hpt: 3, ops: 3, range: 3, prio: '', nosb: false, home: false, chase: false };
export const HPT_PCT = [0, 40, 50, 60, 70, 80];
export const RANGE_NAME: Record<number, [string, string]> = { 1: ['가까이(12칸)', 'Near (12 jumps)'], 2: ['중간(25칸)', 'Mid (25 jumps)'], 3: ['멀리(40칸)', 'Far (40 jumps)'] };
export function foOrdersCommand(req: number, sid: string, o: FoOrders, prioSid: number): string {
  okReq(req); const c = clampOrders(o);
  return `effect ${target(sid)} sllm_fo_orders = { RATIO = ${c.ratio.toFixed(2)} HPT = ${c.hpt} OPS = ${c.ops} RANGE = ${c.range} PRIO = ${Number.isSafeInteger(prioSid) && prioSid > 0 ? prioSid : 0} NOSB = ${c.nosb ? 1 : 0} HOME = ${c.home ? 1 : 0} CHASE = ${c.chase ? 1 : 0} REQ = ${req} } }`;
}
export function clampOrders(o: Partial<FoOrders>): FoOrders {
  const n = (v: unknown, a: number, b: number, d: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
  return { ratio: Math.round(n(o.ratio, 1, 1.6, 1.2) * 20) / 20, hpt: Math.round(n(o.hpt, 1, 5, 3)), ops: Math.round(n(o.ops, 1, 3, 3)), range: Math.round(n(o.range, 1, 3, 3)), prio: String(o.prio ?? '').slice(0, 80), nosb: o.nosb === true, home: o.home === true, chase: o.chase === true };
}
export function ordersText(o: FoOrders): string {
  return L(`전력 기준 적의 ${o.ratio}배 · 수리 복귀 체력 ${HPT_PCT[o.hpt]}% · 작전 ${o.ops}개 · 반경 ${RANGE_NAME[o.range][0]}${o.prio ? ` · 우선 목표 ${o.prio}` : ''}${o.nosb ? ' · 적 요새 피함' : ''}${o.home ? ' · 우리 영토 안에서만' : ''}${o.chase ? ' · 끝까지 추격' : ''}`,
    `Strength ${o.ratio}× the enemy · repair at ${HPT_PCT[o.hpt]}% hull · ${o.ops} operation(s) · range ${RANGE_NAME[o.range][1]}${o.prio ? ` · priority target ${o.prio}` : ''}${o.nosb ? ' · avoid enemy fortresses' : ''}${o.home ? ' · our territory only' : ''}${o.chase ? ' · pursue to the end' : ''}`);
}
/** 지시 해석(LLM 1번): 말 → 설정 + 지휘 제독의 짧은 답 무전. */
export function ordersMessages(a: { empire: string; date: string; admiral: string; current: FoOrders; systems: FoSys[]; ops: string[]; war: boolean }, text: string): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Stellaris. You are the staff of ${a.empire}'s Fleet Command (date ${a.date}). The ruler gives an order in plain words about how the automated fleet operations should fight. Turn it into settings, and write the senior admiral's short radio reply.`,
      'Settings (keep a setting unchanged when the order says nothing about it):',
      '- ratio: how much stronger than the enemy we must be before attacking, 1.0 (reckless) to 1.6 (very cautious). Default 1.2.',
      '- repair: hull % at which a fleet leaves to repair: 40, 50, 60, 70 or 80 (higher = more careful). Default 60.',
      '- ops: how many operations may run at once, 1 to 3 (fewer = keep fleets concentrated / at home). Default 3.',
      '- range: how far from the capital targets may be: "near" (defend home, 12 jumps), "mid" (25), "far" (40).',
      '- priority: the exact name of ONE target system from the supplied list if the order names or clearly means one, "" to clear it, or null to keep the current one. Never invent a name.',
      '- avoid_fortresses: true to skip enemy systems defended by a starbase bigger than an outpost, false to allow them, null to keep.',
      '- home_only: true to fight only enemies inside our own systems (defensive), false to allow attacks abroad, null to keep.',
      '- pursue: true to chase an enemy fleet that flees the target system (up to 3 jumps), false to stop when it leaves, null to keep.',
      'reply: the admiral acknowledges the order in 1-3 sentences, in character, may voice a concern if the order is risky. summary: one short line describing what changed.',
      'Reply ONLY with JSON: {"ratio":1.2,"repair":60,"ops":3,"range":"far","priority":null,"avoid_fortresses":null,"home_only":null,"pursue":null,"reply":"...","summary":"..."}',
    ].join('\n') },
    { role: 'user', content: [
      `Current settings: ratio ${a.current.ratio}, repair ${HPT_PCT[a.current.hpt]}, ops ${a.current.ops}, range ${a.current.range === 1 ? 'near' : a.current.range === 2 ? 'mid' : 'far'}, priority ${a.current.prio ? '"' + a.current.prio + '"' : 'none'}, avoid_fortresses ${!!a.current.nosb}, home_only ${!!a.current.home}, pursue ${!!a.current.chase}.`,
      a.war ? 'We are at war.' : 'We are not at war right now (new operations open only in wartime).',
      `Enemy systems we can see (possible priority targets): ${a.systems.length ? a.systems.map((x) => `${x.name} (${x.owner})`).join('; ') : 'none'}.`,
      a.ops.length ? `Running operations: ${a.ops.join('; ')}.` : 'No operation is running.',
      `Senior admiral replying: ${a.admiral || 'the chief of staff'}.`,
      `The ruler's order: ${text}`,
    ].join('\n') },
  ];
}
const jsonPart = (raw: string): Record<string, unknown> | null => { const t = String(raw ?? ''); const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null; try { const v = JSON.parse(t.slice(i, j + 1)); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; } };
export function parseOrders(raw: string, cur: FoOrders, systems: FoSys[]): { orders: FoOrders; prioSid: number; reply: string; summary: string } | null {
  const v = jsonPart(raw); if (!v) return null;
  const rep = Number(v.repair), hpt = [40, 50, 60, 70, 80].includes(Math.round(rep / 10) * 10) ? (Math.round(rep / 10) * 10 - 30) / 10 : cur.hpt;
  const range = v.range === 'near' ? 1 : v.range === 'mid' ? 2 : v.range === 'far' ? 3 : cur.range;
  let prio = cur.prio; if (v.priority === '') prio = ''; else if (typeof v.priority === 'string') { const hit = systems.find((x) => x.name === v.priority) ?? systems.find((x) => x.name.toLowerCase() === String(v.priority).toLowerCase()); if (hit) prio = hit.name; }
  const b = (x: unknown, d: boolean | undefined) => (x === true || x === false ? x : !!d);
  const orders = clampOrders({ ratio: v.ratio === undefined ? cur.ratio : Number(v.ratio), hpt, ops: v.ops === undefined ? cur.ops : Number(v.ops), range, prio, nosb: b(v.avoid_fortresses, cur.nosb), home: b(v.home_only, cur.home), chase: b(v.pursue, cur.chase) });
  const prioSid = orders.prio ? systems.find((x) => x.name === orders.prio)?.sid ?? 0 : 0;
  return { orders, prioSid, reply: String(v.reply ?? '').trim().slice(0, 500), summary: String(v.summary ?? '').trim().slice(0, 160) };
}

// ── ② 작전 기록 · 결과 보고서 ──
export interface OpRec { id: string; op: number; sys: string; adm: string; lid?: number; start: string; end?: string; result?: FoEv; peakPow: number; peakEn: number; events: Array<{ date: string; ev: FoEv; pow: number; en: number; cnt: number; adm: string }>; report?: { title: string; body: string } }
const ENDS: readonly FoEv[] = ['done', 'retreat', 'abort', 'lost'];
/** 사건을 작전 기록에 붙인다(new = 새 기록, done·retreat·abort·lost = 끝). 끝난 기록을 돌려준다. */
export function recordEvent(recs: OpRec[], e: FoEvent, keep = 12): OpRec | null {
  if (e.op < 1) return null;
  let r = recs.find((x) => x.op === e.op && !x.end);
  if (e.ev === 'new' || !r) { if (r && e.ev === 'new') { r.end = e.date; r.result = 'abort'; } r = { id: `${e.date}#${e.op}#${e.n}`, op: e.op, sys: e.sys, adm: e.adm, ...(e.lid ? { lid: e.lid } : {}), start: e.date, peakPow: 0, peakEn: 0, events: [] }; recs.push(r); while (recs.length > keep) recs.shift(); }
  if (e.sys) r.sys = e.sys; if (e.adm) r.adm = e.adm; if (e.lid) r.lid = e.lid;
  r.peakPow = Math.max(r.peakPow, Math.round(e.pow)); r.peakEn = Math.max(r.peakEn, Math.round(e.en));
  r.events.push({ date: e.date, ev: e.ev, pow: Math.round(e.pow), en: Math.round(e.en), cnt: e.cnt, adm: e.adm }); if (r.events.length > 20) r.events.splice(0, r.events.length - 20);
  if (ENDS.includes(e.ev)) { r.end = e.date; r.result = e.ev; return r; }
  return null;
}
export function reportMessages(r: OpRec, empire: string): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Stellaris. Write the after-action report of an automated fleet operation of ${empire}, in the voice of the commanding admiral${r.adm ? ' ' + r.adm : ''}, addressed to the ruler.`,
      'Use only the supplied log (dates, strength, outcome). Do not invent battles, ship names or numbers that are not given. 2-4 short paragraphs: what was ordered, how the rally and advance went, the outcome and its cost, and one lesson or recommendation.',
      'Reply ONLY with JSON: {"title":"report title","body":"report text","headline":"one newspaper headline about the outcome"}',
    ].join('\n') },
    { role: 'user', content: [`Operation ${r.op} against ${r.sys || 'an enemy system'}, from ${r.start} to ${r.end ?? '?'}. Outcome: ${r.result ?? 'unknown'}. Peak strength: ours ${r.peakPow}, enemy ${r.peakEn}.`,
      'Log:', ...r.events.map((x) => `- ${x.date}: ${x.ev} (ours ${x.pow}, enemy ${x.en}, ${x.cnt} fleet(s)${x.adm ? ', lead ' + x.adm : ''})`)].join('\n') },
  ];
}
export function parseReport(raw: string): { title: string; body: string; headline: string } | null {
  const v = jsonPart(raw); if (!v) return null; const body = String(v.body ?? '').trim();
  return body ? { title: String(v.title ?? '').trim().slice(0, 120), body: body.slice(0, 3000), headline: String(v.headline ?? '').trim().slice(0, 140) } : null;
}
// ── ③ 무전에 답하기: 1:1 대화 장면(persona-app sayInPerson 의 scene) ──
export function radioScene(e: { ev: FoEv; sys: string; date: string; text: string }): string {
  return `A fleet radio channel during an automated operation (${e.date}). The admiral just reported: "${e.text}" (event: ${e.ev}${e.sys ? ', target ' + e.sys : ''}). The ruler answers over the radio; keep replies short and military, in character.`;
}

// ── ④ 합동 작전(2026-11-04): 동맹 함대 빌려 오기(give_fleet) · 원정군 파견 ──
export const ALLY = { days: 360, coolMonths: 24 } as const;
/** 수락 확률(앱 주사위): 호감·신뢰·관계·같은 전쟁. 빌려줄 함대가 하나뿐이면 아까워한다. */
export function allyChance(a: FoAlly): number {
  if (a.n < 1 || a.lend) return 0;
  const p = 0.15 + a.op * 0.1 + a.tr * 0.08 + (a.rel === 3 ? 0.2 : a.rel === 2 ? 0.12 : 0) + (a.cw ? 0.15 : 0) - (a.n <= 1 ? 0.15 : 0);
  return Math.max(0.05, Math.min(0.9, Math.round(p * 100) / 100));
}
/** 빌려줄 함대 수: 연방이면 2, 호감이 높으면 +1, 가진 것보다 많이는 안 된다(최대 3). */
export const allyFleets = (a: FoAlly) => Math.max(1, Math.min(3, a.n, (a.rel === 3 ? 2 : 1) + (a.op >= 3 ? 1 : 0)));
export const relName = (rel: number): [string, string] => (rel === 3 ? ['연방', 'Federation'] : rel === 2 ? ['방위 조약', 'Defensive pact'] : ['같은 전쟁', 'Co-belligerent']);
export const opName = (op: number): [string, string] => ([['냉담', 'Cold'], ['보통', 'Neutral'], ['우호', 'Cordial'], ['친밀', 'Warm'], ['각별', 'Devoted']] as Array<[string, string]>)[Math.max(0, Math.min(4, op))];
export function foLeaseCommand(req: number, sid: string, tid: number, n: number, days: number = ALLY.days): string {
  okReq(req); if (!Number.isSafeInteger(tid) || tid < 1 || ![1, 2, 3].includes(n)) throw new Error('INVALID_ALLY');
  return `effect ${target(sid)} sllm_fo_ally_lease = { REQ = ${req} TID = ${tid} N = ${n} DAYS = ${Math.round(days)} } }`;
}
export function foReturnCommand(req: number, sid: string, tid: number): string { okReq(req); if (!Number.isSafeInteger(tid) || tid < 1) throw new Error('INVALID_ALLY'); return `effect ${target(sid)} sllm_fo_ally_return = { REQ = ${req} TID = ${tid} } }`; }
export function foLendCommand(req: number, sid: string, tid: number, fid: number, days: number = ALLY.days): string {
  okReq(req); if (!Number.isSafeInteger(tid) || tid < 1 || !Number.isSafeInteger(fid) || fid < 1) throw new Error('INVALID_ALLY');
  return `effect ${target(sid)} sllm_fo_lend_out = { REQ = ${req} TID = ${tid} FID = ${fid} DAYS = ${Math.round(days)} } }`;
}
/** 상대 통치자의 답신(LLM 1번). 수락·거절은 앱 주사위가 이미 정했다. */
export function allyMessages(a: { empire: string; date: string; ally: FoAlly; accepted: boolean; n: number; ask: string }): ChatMessage[] {
  return [
    { role: 'system', content: [
      `Stellaris. The ruler of ${a.ally.name} answers a request from ${a.empire} (date ${a.date}) to lend warships for a joint operation for one year.`,
      a.accepted ? `They AGREE and lend ${a.n} fleet(s). They may add a condition or a warning (bring them back intact).` : 'They REFUSE. Give a reason that fits the relationship (not trusted enough, need the ships at home, the risk is too great).',
      'One short message of 2-4 sentences, in character, diplomatic. Do not state game numbers. Reply ONLY with JSON: {"reply":"..."}',
    ].join('\n') },
    { role: 'user', content: [`Relationship: ${relName(a.ally.rel)[1]}${a.ally.cw ? ', fighting the same war' : ''}. Their opinion of us: ${opName(a.ally.op)[1]}. Trust level ${a.ally.tr}/3.`, a.ask ? `The request: ${a.ask}` : 'The request: lend us ships for our operations.'].join('\n') },
  ];
}
export function parseAllyReply(raw: string): string { const v = jsonPart(raw); return String(v?.reply ?? '').trim().slice(0, 600); }
export const allyFallback = (accepted: boolean, n: number, name: string) => accepted
  ? L(`${name}: 좋습니다. 함대 ${n}개를 1년 동안 맡기겠습니다. 온전히 돌려보내 주십시오.`, `${name}: Very well. ${n} fleet(s) are yours for a year. Bring them back whole.`)
  : L(`${name}: 유감이지만 지금은 함대를 내줄 수 없습니다.`, `${name}: Regrettably, we cannot spare any ships right now.`);
/** 매달 사건(FOALLY): ev 1 계약이 끝나 돌아감 · 2 일부 잃음 · 3 모두 잃음 · 4 우리가 돌려보냄. ai = 1 이면 동맹이 빌려준 함대, 0 이면 우리가 빌려준 원정군. */
export interface FoAllyEv { ev: number; idx: number; name: string; ai: boolean; n: number; left: number; date: string }
export function parseAllyEv(m: SllmMessage): FoAllyEv | null {
  if (m.kind !== 'FOALLY') return null; const ev = Math.round(num(m.kv.ev)); if (ev < 1 || ev > 4) return null;
  return { ev, idx: Math.round(num(m.kv.idx)), name: str(m.kv.name), ai: Math.round(num(m.kv.ai)) === 1, n: Math.round(num(m.kv.n)), left: Math.round(num(m.kv.left)), date: str(m.kv.date) };
}
export function allyEvText(e: FoAllyEv): { title: string; body: string; chron: string | null } {
  if (e.ai) {
    if (e.ev === 1) return { title: L('동맹 함대 귀환', 'Allied fleets return'), body: L(`${e.name}에서 빌려 온 함대 ${e.left}개가 계약을 마치고 돌아갔습니다.`, `${e.left} fleet(s) borrowed from ${e.name} finished their contract and went home.`), chron: L(`${e.date} ${e.name}의 함대가 합동 작전을 마치고 귀환했다.`, `${e.date} The fleets of ${e.name} returned home after the joint operation.`) };
    if (e.ev === 2) return { title: L('동맹 함대 손실', 'Allied fleet lost'), body: L(`${e.name}에서 빌려 온 함대를 잃었습니다(남은 함대 ${e.left}개). 그 나라의 호감이 떨어집니다.`, `We lost a fleet borrowed from ${e.name} (${e.left} left). Their opinion of us drops.`), chron: L(`${e.date} 합동 작전 중 ${e.name}의 함대가 격침되었다.`, `${e.date} A fleet of ${e.name} was destroyed during the joint operation.`) };
    if (e.ev === 3) return { title: L('동맹 함대 전멸', 'Allied fleets wiped out'), body: L(`${e.name}에서 빌려 온 함대를 모두 잃었습니다. 그 나라의 호감이 크게 떨어집니다.`, `Every fleet borrowed from ${e.name} has been lost. Their opinion of us falls sharply.`), chron: L(`${e.date} 합동 작전에 나선 ${e.name}의 함대가 전멸했다.`, `${e.date} The fleets ${e.name} sent to the joint operation were wiped out.`) };
    return { title: L('동맹 함대 돌려보냄', 'Allied fleets sent home'), body: L(`${e.name}의 함대를 계약보다 먼저 돌려보냈습니다.`, `We sent the fleets of ${e.name} home before the contract ended.`), chron: null };
  }
  if (e.ev === 1) return { title: L('원정군 귀환', 'Expeditionary force returns'), body: L(`원정군 함대 ${e.left}개가 돌아왔습니다.`, `${e.left} expeditionary fleet(s) have come home.`), chron: L(`${e.date} 동맹을 돕던 원정군이 귀환했다.`, `${e.date} Our expeditionary force returned from aiding an ally.`) };
  return { title: L('원정군 손실', 'Expeditionary fleet lost'), body: L(`동맹에게 보낸 원정군 함대를 잃었습니다(남은 함대 ${e.left}개).`, `We lost an expeditionary fleet lent to an ally (${e.left} left).`), chron: L(`${e.date} 동맹을 돕던 원정군 함대가 격침되었다.`, `${e.date} An expeditionary fleet aiding an ally was destroyed.`) };
}
