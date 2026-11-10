// 약탈자 대응 연결(다음 업데이트, 2026-10-26). 규칙·수치: src/marauder-deals.ts, 모드: sllm_marauder_deals.txt.
// 잠든 약탈자와 통화할 때 매 발언 전에 습격 상태(SLLM:MRD op=status)를 한 번 읽어 프롬프트에 넣는다(추가 LLM 호출 없음).
// AI 가 고른 행동(위협에 물러남·습격 돌리기·용병 할인)은 다른 제안처럼 플레이어가 수락해야 게임에 들어간다.
// 용병 할인은 1년 동안 세이브마다 기억하고, 매달 게임에 정산 명령을 보낸다(새로 고용한 용병이 있으면 모드가 돌려주고 SLLM:MRCREF).
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { chronNote } from './chronicle-app';
import { terminal, terminalRequest, terminalReplies, contactAllowed } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { addMonths, cmpDate } from '../gamedate';
import type { SllmMessage } from '../protocol';
import type { Action } from '../action';
import { type MrdStatus, type RedirectTarget, MRD, parseStatus, parseTargetRow, rankTargets, threatMin, redirectCost, hireCost, TF, clampMercPct, statusCommand, withdrawCommand, redirectCommand, hireCommand, mercDealCommand, marauderLines } from '../marauder-deals';

export const MARAUDER_TYPE = 'dormant_marauders';
export const MARAUDER_ACTIONS = new Set(['marauder_withdraw', 'marauder_redirect', 'marauder_hire', 'merc_discount']);
interface Deal { tid: number; name: string; pct: number; since: string; until: string }
interface SaveEntry { deal: Deal | null; /** 거래가 성사된 약탈자 번호(습격 돌리기·용병 흥정) — 그레이트 칸 특별 대우의 「거래 이력」(2026-10-26) */ dealt?: number[] }

const file = () => path.join(app.getPath('userData'), 'sllm_marauders.json');
let store: Record<string, SaveEntry> | null = null;
function all(): Record<string, SaveEntry> {
  if (store) return store; store = {};
  try {
    const o = JSON.parse(fs.readFileSync(file(), 'utf8'));
    if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, any>)) {
      const d = v?.deal; store[k] = { deal: d && Number.isSafeInteger(d.tid) && d.tid > 0 && Number.isSafeInteger(d.pct) && d.pct >= 1 && d.pct <= MRD.mercMaxPct && typeof d.until === 'string' ? { tid: d.tid, name: String(d.name ?? '').slice(0, 100), pct: d.pct, since: String(d.since ?? '').slice(0, 12), until: d.until.slice(0, 12) } : null, ...(Array.isArray(v?.dealt) ? { dealt: (v.dealt as unknown[]).filter((x): x is number => Number.isSafeInteger(x) && (x as number) > 0).slice(-20) } : {}) };
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'marauders', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'marauders', error: e }); } }
const entry = (sid: string): SaveEntry => (all()[safeKey(sid)] ??= { deal: null });
const noteDealt = (sid: string, tid: number) => { const e = entry(sid); e.dealt = [...new Set([...(e.dealt ?? []), tid])].slice(-20); save(); };
/** 이 약탈자와 거래(습격 돌리기·용병 흥정)가 성사된 적이 있나. */
export const marauderDealWith = (tid: number): boolean => !!ctx.curSaveId && (entry(ctx.curSaveId).dealt ?? []).includes(tid);
const liveDeal = (sid: string | null | undefined): Deal | null => { if (!sid) return null; const d = entry(sid).deal; return d && (!ctx.gameDate || cmpDate(ctx.gameDate, d.until) < 0) ? d : null; };

/** 상태 캐시: 'sid:tid' → 상태. 매 발언 전에 새로 읽는다. */
const statusCache = new Map<string, MrdStatus>();
/** 대상 사정(SLLM:MRDT, 건의 ①): 'sid:tid' → 제국 번호 → f·tf. 상태와 같이 읽는다. */
const rowCache = new Map<string, Map<number, { f: number; tf: number }>>();
const rowsOf = new Map<string, Map<number, { f: number; tf: number }>>(); // 요청 번호 → 모으는 중
const ck = (tid: number) => (ctx.curSaveId || '') + ':' + tid;
export const isMarauderType = (ct?: string): boolean => ct === MARAUDER_TYPE;

/** 돌리기·의뢰 대상: 지금 세이브 통신 목록의 일반 제국(끊은 상대 제외). 그 약탈자와 대화 중 읽은 사정이 있으면 붙이고 습격받는 곳은 빼며, 쓸 만한 곳부터 8곳까지. */
export function redirectTargets(tid?: number): RedirectTarget[] {
  if (terminal.sid !== ctx.curSaveId) return [];
  const list = terminal.items.filter((c) => c.type === 'default' && c.idx > 0 && c.idx !== ctx.playerIdx && contactAllowed(c.type)).map((c) => ({ idx: c.idx, name: c.name.replace(/[\r\n;]/g, ' ').slice(0, 60) }));
  return rankTargets(list, (tid !== undefined && rowCache.get(ck(tid))) || new Map());
}

/** 발언 전: 게임에서 습격 상태를 읽는다. 실패하면 이전 값(없으면 null) — 대화는 계속된다. */
export async function refreshMarauder(tid: number): Promise<MrdStatus | null> {
  if (!ctx.gameRunning || !Number.isSafeInteger(tid) || tid < 1) return statusCache.get(ck(tid)) ?? null;
  const req = ++link.reqCounter, rows = new Map<number, { f: number; tf: number }>(); rowsOf.set(String(req), rows);
  try {
    const m = await terminalRequest(statusCommand(req, tid), 'MRD', req);
    const st = m.kv.sid === ctx.curSaveId ? parseStatus(m.kv) : null;
    if (st) { statusCache.set(ck(tid), st); rowCache.set(ck(tid), rows); }
    return st;
  } catch (e) { logDiagnostic('warn', 'marauder.status_failed', { tid, error: (e as Error).message }); return statusCache.get(ck(tid)) ?? null; }
  finally { rowsOf.delete(String(req)); }
}
/** 프롬프트 줄(withLore). 잠든 약탈자일 때만. */
export function marauderTalk(tid: number, score: number): string[] {
  return marauderLines(statusCache.get(ck(tid)) ?? null, { targets: redirectTargets(tid), score, dealActive: !!liveDeal(ctx.curSaveId) });
}

/** AI 가 고른 약탈자 행동을 지금 받을 수 있나. 못 받으면 화면에 보일 까닭(받으면 null). */
export function marauderActionBlock(a: Action, tid: number): string | null {
  const st = statusCache.get(ck(tid));
  if (a.type === 'marauder_withdraw') {
    if (!st?.raid) return L('지금 이 약탈자의 습격 대상이 아니라 물러나겠다는 제안은 무시했습니다.', 'They are not raiding you right now, so the offer to withdraw was ignored.');
    if (!threatMin(st.pow)) return L('우리 함대가 약해 위협이 통하지 않습니다. 물러나겠다는 제안은 무시했습니다.', 'Our fleets are too weak for the threat to work, so the offer to withdraw was ignored.');
    return null;
  }
  if (a.type === 'marauder_redirect') {
    if (!st?.raid) return L('지금 이 약탈자의 습격 대상이 아니라 습격을 돌리겠다는 제안은 무시했습니다.', 'They are not raiding you right now, so the offer to redirect the raid was ignored.');
    if (!redirectTargets(tid).some((t) => t.idx === a.target)) return L('돌릴 대상 제국을 통신 목록에서 찾지 못해 제안을 무시했습니다.', 'The target empire was not found in the contact list, so the offer was ignored.');
    return null;
  }
  if (a.type === 'marauder_hire') {
    if (st?.raid) return L('지금 이 약탈자가 우리를 습격하는 중이라 의뢰 제안은 무시했습니다(습격을 돌려 달라고 하세요).', 'This clan is raiding you right now, so the hire offer was ignored (ask them to redirect the raid instead).');
    if (!st?.free) return L('이 약탈자는 다른 습격 중이거나 쉬는 중이라 의뢰 제안은 무시했습니다.', 'This clan is busy with another raid or resting, so the hire offer was ignored.');
    if (!redirectTargets(tid).some((t) => t.idx === a.target)) return L('습격할 대상 제국을 통신 목록에서 찾지 못해 제안을 무시했습니다.', 'The target empire was not found in the contact list, so the offer was ignored.');
    return null;
  }
  if (a.type === 'merc_discount') {
    if (liveDeal(ctx.curSaveId)) return L('이미 받아 둔 용병 할인이 있어 새 할인 제안은 무시했습니다.', 'You already hold a mercenary discount, so the new offer was ignored.');
    return null;
  }
  return null;
}
/** 제안 문구(대상 이름까지). */
/** 의뢰 대상이 우리 경쟁국인가(이 약탈자와 대화 중 읽은 사정, 모르면 아님 = 비싼 쪽). */
const isRival = (tid: number, idx?: number): boolean => idx !== undefined && !!((rowCache.get(ck(tid))?.get(idx)?.f ?? 0) & TF.rival);
const nameOf = (idx?: number): string => (terminal.sid === ctx.curSaveId ? terminal.items.find((c) => c.idx === idx)?.name.replace(/[\r\n;]/g, ' ').slice(0, 60) : undefined) ?? `#${idx}`;
export function marauderProposal(a: Action, aiName: string, tid?: number): string {
  if (a.type === 'marauder_hire') {
    const t = nameOf(a.target), rv = tid !== undefined && isRival(tid, a.target), cost = hireCost(a.pct, rv);
    return L(`${aiName}이(가) 에너지 ${cost}을(를) 받고 「${t}」을(를) 습격하겠다고 합니다(내 에너지가 줄어듭니다${rv ? '' : '. 우리 경쟁국이 아니라 1.5배'}).`, `${aiName} offers to raid ${t} for ${cost} energy (your energy will go down${rv ? '' : '; not your rival, so 1.5x'}).`);
  }
  if (a.type === 'marauder_redirect') {
    const t = nameOf(a.target), rv = tid !== undefined && isRival(tid, a.target), cost = hireCost(a.pct, rv);
    return L(`${aiName}이(가) 에너지 ${cost}을(를) 받고 습격을 「${t}」(으)로 돌리겠다고 합니다(내 에너지가 줄어듭니다${rv ? '' : '. 우리 경쟁국이 아니라 1.5배'}).`, `${aiName} offers to send the raid against ${t} for ${cost} energy (your energy will go down${rv ? '' : '; not your rival, so 1.5x'}).`);
  }
  if (a.type === 'marauder_withdraw') return L(`${aiName}이(가) 위협에 물러나 습격을 거두겠다고 합니다. 수락하면 습격 함대가 돌아가고 이 약탈자는 한동안 습격하지 않습니다.`, `${aiName} backs down from your threat and offers to call off the raid. Accepting sends the raiders home, and this clan will not raid for a while.`);
  return L(`${aiName}이(가) 용병 고용 비용을 ${a.pct}% 깎아 주겠다고 합니다. 1년 안에 이 약탈자의 용병을 게임의 「용병 고용」으로 처음 고용하면 깎은 만큼 에너지로 돌려받습니다.`, `${aiName} offers ${a.pct}% off hiring their mercenaries. If you hire one of this clan's fleets through the game's Hire Mercenaries menu within a year, the discount comes back to you as energy.`);
}

/** 플레이어가 수락함(chat.ts accept). */
export async function acceptMarauder(a: Action, tid: number, aiName: string): Promise<{ outcome: string; text: string }> {
  const sid = ctx.curSaveId; if (!sid) return { outcome: 'fail', text: L('세이브를 몰라 처리하지 못했습니다.', 'The save is unknown, so nothing was done.') };
  if (!ctx.gameRunning) return { outcome: 'fail', text: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
  const block = marauderActionBlock(a, tid); if (block) return { outcome: 'fail', text: block };
  const req = ++link.reqCounter, st = statusCache.get(ck(tid));
  let cmd: string, cost = 0, target: RedirectTarget | undefined, pct = 0;
  if (a.type === 'marauder_withdraw') cmd = withdrawCommand(req, tid, threatMin(st?.pow ?? -1) ?? 'superior');
  else if (a.type === 'marauder_redirect') { target = redirectTargets(tid).find((x) => x.idx === a.target)!; const rv = isRival(tid, target.idx); cost = hireCost(a.pct, rv); cmd = redirectCommand(req, tid, target.idx, cost, rv); }
  else if (a.type === 'marauder_hire') { target = redirectTargets(tid).find((x) => x.idx === a.target)!; const rv = isRival(tid, target.idx); cost = hireCost(a.pct, rv); cmd = hireCommand(req, tid, target.idx, cost, rv); }
  else { pct = clampMercPct(a.pct); if (pct < 1) return { outcome: 'fail', text: L('할인율이 올바르지 않습니다.', 'The discount is invalid.') }; cmd = mercDealCommand(req, tid, pct); }
  let status: string;
  try { const m = await terminalRequest(cmd, 'MRD', req); status = m.kv.sid === sid ? String(m.kv.status ?? '') : 'save'; }
  catch (e) { return { outcome: 'timeout', text: (e as Error).message }; }
  statusCache.delete(ck(tid));
  const date = ctx.gameDate || '';
  if (status === 'applied' || status === 'duplicate') {
    if (a.type === 'marauder_withdraw') {
      chronNote(tid, L('우리 함대의 위협에 물러나 습격을 거두었다', 'Backed down before our fleets and called off their raid'));
      logDiagnostic('info', 'marauder.withdraw', { tid, status });
      return { outcome: 'ok', text: L(`${aiName}의 습격 함대가 물러갔습니다.`, `${aiName}'s raiding fleet has withdrawn.`) };
    }
    if (a.type === 'marauder_redirect') {
      noteDealt(sid, tid);
      chronNote(tid, L(`에너지 ${cost}을(를) 받고 우리 대신 「${target!.name}」을(를) 습격하러 갔다`, `Took ${cost} energy to raid ${target!.name} instead of us`));
      logDiagnostic('info', 'marauder.redirect', { tid, target: target!.idx, cost, status });
      return { outcome: 'ok', text: L(`에너지 ${cost}을(를) 건넸습니다. ${aiName}의 습격이 「${target!.name}」(으)로 향합니다.`, `Paid ${cost} energy. ${aiName}'s raid now heads for ${target!.name}.`) };
    }
    if (a.type === 'marauder_hire') {
      noteDealt(sid, tid);
      chronNote(tid, L(`에너지 ${cost}을(를) 받고 우리 의뢰로 「${target!.name}」을(를) 습격하러 갔다`, `Took ${cost} energy from us to raid ${target!.name}`));
      chronNote(target!.idx, L(`우리가 약탈자 ${aiName}에게 이 제국 습격을 의뢰했다`, `We hired the marauders ${aiName} to raid them`));
      logDiagnostic('info', 'marauder.hire', { tid, target: target!.idx, cost, status });
      return { outcome: 'ok', text: L(`에너지 ${cost}을(를) 건넸습니다. ${aiName}의 습격대가 「${target!.name}」(으)로 출발합니다.`, `Paid ${cost} energy. ${aiName}'s raiders set out for ${target!.name}.`) };
    }
    noteDealt(sid, tid);
    entry(sid).deal = { tid, name: aiName.slice(0, 100), pct, since: date, until: date ? addMonths(date, MRD.dealDays / 30) : '' }; save();
    chronNote(tid, L(`용병 고용 비용 ${pct}% 할인을 약속했다`, `Promised us ${pct}% off hiring their mercenaries`));
    logDiagnostic('info', 'marauder.merc_deal', { tid, pct, status });
    return { outcome: 'ok', text: L(`${aiName}과(와) 용병 할인 ${pct}%를 약속했습니다. 1년 안에 게임의 「용병 고용」으로 이 약탈자의 용병을 고용하면 다음 달 초에 할인분을 에너지로 돌려받습니다.`, `${aiName} agreed to ${pct}% off mercenaries. Hire one of their fleets through the game's Hire Mercenaries menu within a year and the discount is refunded as energy at the start of the next month.`) };
  }
  const why: Record<string, string> = {
    busy: L('그 약탈자가 이미 다른 습격 중이거나 쉬는 중입니다. 차감된 것은 없습니다.', 'The clan is already on another raid or resting. Nothing was charged.'),
    norival: L('그 제국이 더는 우리 경쟁국이 아니라 경쟁국 가격으로는 받지 않았습니다. 차감된 것은 없습니다. 다시 이야기하면 1.5배 가격으로 제안합니다.', 'That empire is no longer your rival, so the rival price was refused. Nothing was charged. Talk again for the 1.5x price.'),
    raiding: L('그 약탈자가 지금 우리를 습격하는 중이라 의뢰할 수 없습니다. 차감된 것은 없습니다.', 'The clan is raiding us right now, so it cannot be hired. Nothing was charged.'),
    noraid: L('습격이 이미 끝났거나 공물로 정리되었습니다. 바뀐 것은 없습니다.', 'The raid has already ended or was settled with tribute. Nothing changed.'),
    weak: L('게임에서 다시 비교해 보니 우리 함대가 약해 위협이 통하지 않았습니다. 바뀐 것은 없습니다.', 'Re-checked in the game: our fleets are too weak for the threat to work. Nothing changed.'),
    target: L('대상을 찾지 못했습니다(이미 습격 중이거나 통신이 없는 제국일 수 있습니다). 차감된 것은 없습니다.', 'The target was not found (it may already be under raid or out of contact). Nothing was charged.'),
    short: L(`에너지 크레딧이 모자랍니다(${cost} 필요). 차감된 것은 없습니다.`, `Not enough energy credits (${cost} needed). Nothing was charged.`),
    save: L('세이브가 바뀌어 결과를 반영하지 않았습니다.', 'The save changed, so the result was not applied.'),
  };
  logDiagnostic('info', 'marauder.refused', { op: a.type, tid, status });
  return { outcome: 'fail', text: why[status] ?? L('결과를 확인하지 못했습니다. 다시 수락해도 두 번 처리되지 않습니다.', 'Result unknown. Accepting again never applies twice.') };
}

function monthly(sid: string, today: string): void {
  if (sid !== ctx.curSaveId || !ctx.gameRunning) return;
  const e = entry(sid), d = e.deal; if (!d) return;
  if (today && d.until && cmpDate(today, d.until) >= 0) { e.deal = null; save(); logDiagnostic('info', 'marauder.merc_deal_expired', { tid: d.tid }); return; }
  // 2026-11-09(회랑 방식 — 「매달 확인이 필요 없는 것은 바뀔 때만」): 정산 확인은 모드가 매달 스스로 한다(events/sllm_mrd_events.txt sllm_mrd.1 →
  //   sllm_mrd_merc_check). 앱은 보내지 않고, 돌려줄 때만 오는 MRCREF 줄을 받는다(onRefund).
}
function onRefund(m: SllmMessage): void {
  const sid = ctx.curSaveId; if (!sid || m.kv.sid !== sid) return;
  const e = entry(sid), d = e.deal, amt = Math.max(0, Math.round(Number(m.kv.amt) || 0));
  e.deal = null; save();
  const name = d?.name || L('약탈자', 'the marauders');
  if (d) chronNote(d.tid, L(`약속대로 용병 고용비 ${d.pct}%(에너지 ${amt})를 돌려주었다`, `Refunded ${d.pct}% of the mercenary fee (${amt} energy) as promised`));
  ctx.notify({ kind: 'info', title: L('용병 할인 정산', 'Mercenary discount refunded'), body: L(`${name}이(가) 약속한 용병 할인으로 에너지 ${amt}을(를) 돌려주었습니다.`, `${name} refunded ${amt} energy under the promised mercenary discount.`) });
  logDiagnostic('info', 'marauder.merc_refund', { amt });
}

export function registerMarauders(router: LogRouter): void {
  router.on(SLOT.MARAUDER, 'marauder:reply', (m: SllmMessage) => {
    if (m.kind === 'MRD') terminalReplies.get('MRD:' + m.kv.req)?.(m);
    else if (m.kind === 'MRDT') { const rows = rowsOf.get(String(m.kv.req)), r = parseTargetRow(m.kv); if (rows && r && rows.size < 60) rows.set(r.idx, { f: r.f, tf: r.tf }); }
    else if (m.kind === 'MRCREF') onRefund(m);
  });
  onGameSnapshot((snap) => { if (snap.sid) monthly(snap.sid, snap.date || ctx.gameDate || ''); });
}
