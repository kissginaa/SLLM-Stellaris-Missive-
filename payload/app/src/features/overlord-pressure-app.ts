// 역방향: AI 종주국이 플레이어에게 · AI 이웃이 우리 종속국을 노림(앱 쪽, 2026-11-05 사용자: 「플레이어가 AI에게 당할 때만 역으로 생기게 하자」).
// 규칙: src/overlord-pressure.ts · 화면: ui/overlord-orders.js(종속국 창 · 종주국 채널 「명령」·「현황」 탭)
// 줄 모으기는 종속국 통치권(src/features/vassal-reign-app.ts)의 것을 그대로 쓴다(VRTGT·VRFLT·VRSET…). 이 모듈만의 줄: VOPZ(로그 자리 OVPRESS).
// 저장: sllm_overlord_pressure.json { saves: { [세이브]: VoSave } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { vassalNote, vassalPush, vassalLetter, overlordInfo, vassalIdxByName, vassalCount } from './vassal-app';
import { vrSt, vrPicks, vrFleets, vrNamed, vrAlignBy, vrAsk, vrHooks } from './vassal-reign-app';
import { VR, meddle, cool, tierOf, heatScale, heatText, alignText, stText, type Heat, type MeddleKind } from '../vassal-reign';
import { addDays } from '../alarm';
import {
  VO, ORDER_NAME, ORDER_ICON, rollOrder, forceDue, alignDue, orderText, refuseText, orderSituation, answerSituation, type Order, type OrderType,
  defyCommand, minderCommand, revTargetsCommand, revProxyCommand, revProxyCheckCommand, revFleetsCommand, revLevyCommand, revLevyCheckCommand, revTitheCommand, revAlignCommand, revMeddleCommand, aiPrizeCommand,
} from '../overlord-pressure';

interface Hist { type: OrderType | 'align' | 'prize' | 'lost'; at: string; ans: 'ok' | 'no' | 'late' | 'forced' | 'info'; text: string }
interface VoSave {
  overlord: string; since: string; lastAlign?: string; last: Partial<Record<OrderType, string>>; any?: string;
  pending: Order | null; refusals: string[]; heat?: Heat; hist: Hist[];
  levy?: { fleet: string; until: string; state: 'on' | 'done' | 'lost' }; proxy?: { target: string; state: 'war' | 'done'; won?: boolean };
  prizeAt?: string; threats: Array<{ name: string; foe: string; at: string }>;
}
const file = () => path.join(app.getPath('userData'), 'sllm_overlord_pressure.json');
let all: Record<string, VoSave> | null = null;
const books = (): Record<string, VoSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const fresh = (overlord: string, date: string): VoSave => ({ overlord, since: date, last: {}, pending: null, refusals: [], hist: [], threats: [] });
const saveOf = (sid: string): VoSave => { const s = (books()[sid] ??= fresh('', '')); s.last ??= {}; s.refusals ??= []; s.hist ??= []; s.threats ??= []; return s; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'vopress.save_failed', { error: (e as Error).message }); } };
const sv = (v: unknown) => String(v ?? '').replace(/^\\/, '').trim();
const ready = () => !!(ctx.gameRunning && link.sessionReady && ctx.curSaveId && /^\d+$/.test(ctx.curSaveId));
const us = () => ctx.playerName || L('우리 제국', 'our empire');
/** 종주국 연대기(그 나라 AI 가 기억하는 역사)에 남긴다. 종주국 채널엔 번호가 없어 이름으로 찾는다. */
function ovChron(text: string): void { const name = overlordInfo()?.name; if (!name) return; for (const [i, c] of ctx.mailCountries) if (c?.name === name) { chronNote(i, text); return; } }
const hist = (s: VoSave, h: Hist) => { s.hist.push(h); s.hist = s.hist.slice(-20); };
let busy = false;

// ---- 우리 백성의 간섭 반감(종주국이 시킨 일을 받아들일 때마다) ----
async function heatUs(sid: string, s: VoSave, kind: MeddleKind): Promise<void> {
  const date = ctx.gameDate || '', loy = overlordInfo()?.loyalty ?? null, r = meddle(s.heat, kind, loy, date), before = s.heat?.tier ?? 0;
  s.heat = r.heat; save(); if (!r.changed) return;
  if ((await vrSt((req) => revMeddleCommand(req, sid, r.tier, r.days))) === 9 && r.tier > before) {
    vassalNote(0, L(`간섭 반감: 종주국의 간섭에 우리 백성의 불만이 커졌다 — ${heatText(s.heat)}, ${r.days}일.`, `Meddling backlash: our people resent the overlord's meddling — ${heatText(s.heat)}, ${r.days} days.`), true);
  }
}
const strongest = (l: Array<{ n: number; name: string; pow: number }>) => l.slice().sort((a, b) => b.pow - a.pow)[0];

// ---- 명령 내리기(AI 종주국) ----
async function issue(sid: string, s: VoSave, type: OrderType): Promise<void> {
  const date = ctx.gameDate || '', o: Order = { id: Math.random().toString(36).slice(2, 10), type, at: date, due: addDays(date, VO.answerDays) };
  if (type === 'proxy') {
    const l = await vrPicks((req) => revTargetsCommand(req, sid), 'VRTEND').catch(() => []); if (!l.length) return;
    o.target = l[Math.floor(Math.random() * l.length)].name;
  } else if (type === 'levy' || type === 'tithe') {
    const f = await vrFleets((req) => revFleetsCommand(req, sid)).catch(() => ({ list: [], cnt: 0 }));
    if (f.cnt < (type === 'levy' ? VO.levy.minFleets : VO.tithe.minFleets) || !f.list.length) return;
    o.fleet = strongest(f.list).name;
  }
  s.pending = o; s.last[type] = date; s.any = date; save();
  const ovn = s.overlord || overlordInfo()?.name || '?';
  vassalNote(0, L(`종주국 명령 — ${ORDER_NAME[type][0]}: ${orderText(o, ovn)} ${o.due}까지 답해야 합니다(종주국 채널 「명령」 탭).`, `Overlord order — ${ORDER_NAME[type][1]}: ${orderText(o, ovn)} Answer by ${o.due} (overlord channel, Orders tab).`), true);
  vassalLetter(0, 'warning', 'a formal order', orderSituation(o, us()));
  ctx.notify({ kind: 'vassal', title: L(`종주국 명령 · ${ORDER_NAME[type][0]}`, `Overlord order · ${ORDER_NAME[type][1]}`), body: orderText(o, ovn), action: L('열기', 'Open') });
  vassalPush();
}

// ---- 답하기 ----
async function refuse(sid: string, s: VoSave, o: Order, late: boolean): Promise<string> {
  await vrSt((req) => defyCommand(req, sid));
  const ovn = s.overlord || '?'; s.pending = null;
  hist(s, { type: o.type, at: ctx.gameDate || '', ans: late ? 'late' : 'no', text: orderText(o, ovn) });
  if (o.type === 'tithe') s.refusals.push(ctx.gameDate || '');
  save();
  vassalNote(0, late ? L(`종주국 명령(${ORDER_NAME[o.type][0]})에 답하지 않아 거역으로 처리됐다 — 종주국 관계 −60, 2년간 충성도 매달 −1.`, `We did not answer the overlord's ${ORDER_NAME[o.type][1].toLowerCase()} in time; it counts as defiance — overlord opinion −60, loyalty −1/month for 2 years.`)
    : L(`종주국 명령(${ORDER_NAME[o.type][0]})을 거절했다 — 종주국 관계 −60, 2년간 충성도 매달 −1.`, `We refused the overlord's ${ORDER_NAME[o.type][1].toLowerCase()} — overlord opinion −60, loyalty −1/month for 2 years.`), true);
  ovChron(L(`종속국 ${us()}이(가) 우리의 ${ORDER_NAME[o.type][0]}을(를) 거역했다`, `Our subject ${us()} defied our ${ORDER_NAME[o.type][1].toLowerCase()}`));
  vassalLetter(0, 'warning', 'a rebuke', answerSituation(o, us(), false));
  if (o.type === 'tithe' && forceDue(s.refusals, ctx.gameDate || '')) return seize(sid, s, o);
  return L('명령을 거절했습니다.', 'Order refused.');
}
async function seize(sid: string, s: VoSave, o: Order): Promise<string> {
  const f = await vrFleets((req) => revFleetsCommand(req, sid)).catch(() => ({ list: [], cnt: 0 })), pick = f.list.find((x) => x.name === o.fleet) ?? strongest(f.list);
  if (!pick || f.cnt < 2) return L('명령을 거절했습니다.', 'Order refused.');
  const r = await vrNamed((req) => revTitheCommand(req, sid, pick.n, true, VR.titheForceDays)); if (r.code !== 9) return L('명령을 거절했습니다.', 'Order refused.');
  const fleet = r.name || pick.name, ovn = s.overlord || '?', date = ctx.gameDate || ''; s.refusals = [];
  hist(s, { type: 'tithe', at: date, ans: 'forced', text: L(`「${fleet}」을(를) 강제로 빼앗김`, `"${fleet}" seized by force`) }); save(); await heatUs(sid, s, 'force');
  vassalNote(0, L(`종주국 ${ovn}이(가) 두 번 거절당하자 우리 함대 「${fleet}」을(를) 강제로 빼앗아 갔다(3년간 충성도 매달 −2).`, `After two refusals, ${ovn} seized our fleet "${fleet}" by force (loyalty −2/month for 3 years).`), true);
  ovChron(L(`두 번 거역한 종속국 ${us()}에게서 함대 「${fleet}」을(를) 강제로 거두었다`, `We seized the fleet "${fleet}" from our twice-defiant subject ${us()}`));
  chronNoteWorld(L(`${date} ${ovn}, 종속국 ${us()}의 함대 「${fleet}」을(를) 강제로 빼앗음`, `${date} ${ovn} seizes the fleet "${fleet}" from its subject ${us()}`), true);
  vassalLetter(0, 'warning', 'a cold notice', answerSituation({ ...o, fleet }, us(), false, true));
  ctx.notify({ kind: 'vassal', title: L('종주국이 함대를 빼앗았습니다', 'The overlord seized a fleet'), body: L(`「${fleet}」`, `"${fleet}"`) });
  return L(`명령을 거절했지만, 10년 안에 두 번째라 종주국이 「${fleet}」을(를) 강제로 빼앗아 갔습니다.`, `Refused — but as the second refusal within 10 years, the overlord seized the "${fleet}" by force.`);
}
async function accept(sid: string, s: VoSave, o: Order): Promise<string> {
  const date = ctx.gameDate || '', ovn = s.overlord || '?';
  if (o.type === 'proxy') {
    const l = await vrPicks((req) => revTargetsCommand(req, sid), 'VRTEND'), t = l.find((x) => x.name === o.target);
    if (!t) throw new Error(L(`${o.target}은(는) 이제 칠 수 없습니다(국경·조약이 바뀜). 거절하거나 기한을 넘기세요.`, `${o.target} can no longer be attacked (borders or treaties changed). Refuse or let it lapse.`));
    if ((await vrSt((req) => revProxyCommand(req, sid, t.n))) !== 9) throw new Error(stText(6));
    const c = await vrAsk((req) => revProxyCheckCommand(req, sid), 'VRPXW'); if (c.m && sv(c.m.kv.war).startsWith('0')) throw new Error(stText(6));
    s.proxy = { target: o.target!, state: 'war' };
    chronNoteWorld(L(`${date} ${us()}, 종주국 ${ovn}의 명으로 ${o.target}에 선전포고`, `${date} ${us()} declares war on ${o.target} at the command of its overlord ${ovn}`), true);
    await heatUs(sid, s, 'proxy');
  } else if (o.type === 'levy') {
    const f = await vrFleets((req) => revFleetsCommand(req, sid)), pick = f.list.find((x) => x.name === o.fleet) ?? strongest(f.list);
    if (!pick) throw new Error(stText(0));
    const r = await vrNamed((req) => revLevyCommand(req, sid, pick.n, VR.levyDays)); if (r.code !== 9) throw new Error(stText(r.code));
    o.fleet = r.name || pick.name; s.levy = { fleet: o.fleet, until: addDays(date, VR.levyDays), state: 'on' };
    await heatUs(sid, s, 'levy');
  } else if (o.type === 'tithe') {
    const f = await vrFleets((req) => revFleetsCommand(req, sid)), pick = f.list.find((x) => x.name === o.fleet) ?? strongest(f.list);
    if (!pick) throw new Error(stText(0)); if (f.cnt < 2) throw new Error(stText(5));
    const r = await vrNamed((req) => revTitheCommand(req, sid, pick.n, false, VR.titheDays)); if (r.code !== 9) throw new Error(stText(r.code));
    o.fleet = r.name || pick.name; await heatUs(sid, s, 'tithe');
  } else {
    if ((await vrSt((req) => minderCommand(req, sid))) !== 9) throw new Error(stText(-1));
    await heatUs(sid, s, 'shift');
  }
  s.pending = null; hist(s, { type: o.type, at: date, ans: 'ok', text: orderText(o, ovn) }); save();
  vassalNote(0, L(`종주국 명령을 따랐다 — ${orderText(o, ovn)}`, `We obeyed the overlord — ${orderText(o, ovn)}`));
  ovChron(L(`종속국 ${us()}이(가) 우리의 ${ORDER_NAME[o.type][0]}을(를) 따랐다`, `Our subject ${us()} obeyed our ${ORDER_NAME[o.type][1].toLowerCase()}`));
  vassalLetter(0, 'praise', 'an acknowledgement', answerSituation(o, us(), true));
  return L('명령을 따랐습니다.', 'Order obeyed.');
}

// ---- 월 점검 ----
let lastMonth = '';
async function monthly(): Promise<void> {
  if (!ready() || busy) return; const sid = ctx.curSaveId!, date = ctx.gameDate || '', month = date.slice(0, 7); if (!month || month === lastMonth) return; lastMonth = month;
  busy = true;
  try {
    const ov = overlordInfo(), s = saveOf(sid);
    if (ov) {
      if (s.overlord !== ov.name) { const keep = s.threats, prizeAt = s.prizeAt; books()[sid] = { ...fresh(ov.name, date), threats: keep, prizeAt }; save(); }
      const v = saveOf(sid);
      if (v.pending && date >= v.pending.due) await refuse(sid, v, v.pending, true);
      if (v.heat) { const c = cool(v.heat, date); if (c !== v.heat) { const t = tierOf(c.h), was = v.heat.tier; v.heat = { ...c, tier: t }; save(); if (t < was) await vrSt((req) => revMeddleCommand(req, sid, t, heatScale(ov.loyalty).days)); } }
      if (alignDue(v.since, v.lastAlign, date)) {
        v.lastAlign = date; save();
        const r = await vrAlignBy((req) => revAlignCommand(req, sid));
        const t = r.code === 9 && r.got.length ? alignText(r.got[0].k, r.got[0].sp) : null;
        if (t) {
          hist(v, { type: 'align', at: date, ans: 'info', text: L(t[0], t[1]) }); save(); await heatUs(sid, v, 'align');
          vassalNote(0, L(`종주국 동조 압박: 우리 법이 종주국 쪽으로 바뀌었다 — ${t[0]}.`, `Overlord alignment: our laws were changed toward the overlord's — ${t[1]}.`), true);
          ovChron(L(`종속국 ${us()}의 법을 우리 쪽으로 고치게 했다 — ${t[0]}`, `We made our subject ${us()} change its laws toward ours — ${t[1]}`));
        }
      }
      // 징발·대리전 확인(2026-11-09): 평소에는 모드가 사건 때 알린다(onLine 의 req=0 줄). 해마다 1월에만 예전처럼 물어 놓친 것을 바로잡는다.
      const sweep = month.endsWith('.01');
      if (sweep && v.levy?.state === 'on') {
        const c = await vrAsk((req) => revLevyCheckCommand(req, sid), 'VRLVC');
        if (c.m) revLevy(v, Number(sv(c.m.kv.left)) || 0, Number(sv(c.m.kv.leased)) || 0);
      }
      if (sweep && v.proxy?.state === 'war') {
        const c = await vrAsk((req) => revProxyCheckCommand(req, sid), 'VRPXW');
        if (c.m && sv(c.m.kv.war).startsWith('0')) revProxyOver(v);
      }
      if (!v.pending) {
        const t = rollOrder(date, v.last, v.any, 99);
        if (t) await issue(sid, v, t);
      }
    }
    // ⑦ AI 이웃이 우리 종속국을 노림(우리에게 종속국이 있을 때만)
    const s2 = saveOf(sid), hasSubj = vassalCount() > 0;
    if (hasSubj && (!s2.prizeAt || monthsBetweenSafe(s2.prizeAt, date) >= VO.prize.coolMonths) && Math.random() < VO.prize.chance) {
      s2.prizeAt = date; save(); await vrSt((req) => aiPrizeCommand(req, sid));
    }
  } catch (e) { logDiagnostic('warn', 'vopress.monthly_failed', { error: (e as Error).message }); } finally { busy = false; }
}
function monthsBetweenSafe(a: string, b: string): number { const p = (d: string) => { const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(d); return m ? Number(m[1]) * 12 + Number(m[2]) : NaN; }; const x = p(a), y = p(b); return Number.isFinite(x) && Number.isFinite(y) ? y - x : Infinity; }

/** 우리(종속국) 함대 징발 상태 — 모드 신호든 1월 확인이든. */
function revLevy(v: ReturnType<typeof saveOf>, left: number, leased: number): void {
  if (!v.levy || v.levy.state !== 'on') return;
  if (left < 1) { v.levy.state = 'lost'; save(); vassalNote(0, L(`종주국에 징발당한 「${v.levy.fleet}」이(가) 종주국의 전쟁에서 사라졌다.`, `Our levied fleet "${v.levy.fleet}" was lost in the overlord's war.`), true); ovChron(L(`종속국 ${us()}에게서 징발한 함대 「${v.levy.fleet}」을(를) 우리 전쟁에서 잃었다`, `We lost the fleet "${v.levy.fleet}" levied from our subject ${us()}`)); }
  else if (leased < 1) { v.levy.state = 'done'; save(); vassalNote(0, L(`징발 끝: 「${v.levy.fleet}」이(가) 돌아왔다.`, `Levy over: the "${v.levy.fleet}" came home.`)); }
}
function revProxyOver(v: ReturnType<typeof saveOf>): void {
  if (!v.proxy || v.proxy.state !== 'war') return;
  v.proxy.state = 'done'; save(); if (!v.proxy.won) vassalNote(0, L(`종주국 명으로 치른 ${v.proxy.target}과(와)의 전쟁이 끝났다.`, `The war against ${v.proxy.target}, fought at the overlord's command, is over.`));
}

// VOPZ: AI 가 우리 종속국에 대한 전쟁명분을 얻음 · (2026-11-09) 모드 신호 VRPXW·VRLVC(req=0, tid=0 = 우리 쪽)
function onLine(m: SllmMessage): void {
  if ((m.kind === 'VRPXW' || m.kind === 'VRLVC') && Math.round(Number(sv(m.kv.req))) === 0 && Math.round(Number(sv(m.kv.tid))) === 0) {
    const sid = ctx.curSaveId; if (!sid || sv(m.kv.sid) !== sid || !overlordInfo()) return; const v = saveOf(sid);
    if (m.kind === 'VRPXW') { if (sv(m.kv.war).startsWith('0')) revProxyOver(v); } else revLevy(v, Number(sv(m.kv.left)) || 0, Number(sv(m.kv.leased)) || 0);
    return;
  }
  if (m.kind !== 'VOPZ') return; const sid = ctx.curSaveId; if (!sid) return;
  const name = sv(m.kv.name).slice(0, 60), foe = sv(m.kv.foe).slice(0, 60); if (!name || !foe) return;
  const s = saveOf(sid), date = ctx.gameDate || ''; s.threats.push({ name, foe, at: date }); s.threats = s.threats.slice(-10); save();
  const idx = vassalIdxByName(name);
  if (idx) vassalNote(idx, L(`경고: ${foe}이(가) ${name}을(를) 우리에게서 빼앗을 전쟁명분을 얻었다(5년). 전쟁에서 지면 ${name}을(를) 잃는다.`, `Warning: ${foe} gained a casus belli to take ${name} from us (5 years). If we lose the war, we lose ${name}.`), true);
  chronNoteWorld(L(`${date} ${foe}, ${us()}의 종속국 ${name}에 대한 권리를 주장 — 전쟁의 그림자`, `${date} ${foe} lays claim to ${us()}'s subject ${name} — war looms`), true);
  ctx.notify({ kind: 'vassal', title: L('종속국을 노리는 나라가 있습니다', 'A rival covets our subject'), body: L(`${foe} → ${name}`, `${foe} → ${name}`) });
}

export function overlordView() {
  const sid = ctx.curSaveId || '', ov = overlordInfo(), s = sid ? saveOf(sid) : fresh('', ''), date = ctx.gameDate || '';
  const hh = s.heat ? cool(s.heat, date) : undefined, p = s.pending;
  return {
    ok: !!sid, running: ready(), active: !!ov, overlord: ov?.name ?? s.overlord,
    pending: p ? { ...p, name: L(...ORDER_NAME[p.type]), icon: ORDER_ICON[p.type], text: orderText(p, ov?.name ?? s.overlord) } : null, refuseText: refuseText(),
    heat: { tier: hh ? tierOf(hh.h) : 0, h: hh?.h ?? 0, text: heatText(hh ? { ...hh, tier: tierOf(hh.h) } : undefined) },
    hist: s.hist.slice(-8).reverse().map((h) => ({ ...h, name: h.type === 'align' ? L('정책·권리 동조', 'Policy alignment') : h.type === 'prize' || h.type === 'lost' ? L('종속국 쟁탈', 'Subject contest') : L(...ORDER_NAME[h.type as OrderType]) })),
    levy: s.levy ?? null, proxy: s.proxy ?? null, threats: s.threats.slice(-5).reverse(), refusals: s.refusals.length,
    nextAlign: s.since ? Math.max(0, Math.ceil(VO.alignYears - ((): number => { const a = s.lastAlign || s.since; const m = monthsBetweenSafe(a, date); return Number.isFinite(m) ? m / 12 : 0; })())) : null,
  };
}

export function registerOverlordPressure(router: LogRouter): void {
  router.on(SLOT.OVPRESS, 'overlord-pressure', onLine);
  vrHooks.lostSubject = (name: string) => {
    const sid = ctx.curSaveId; if (!sid) return; const s = saveOf(sid), date = ctx.gameDate || '';
    hist(s, { type: 'lost', at: date, ans: 'info', text: L(`${name}을(를) 빼앗김`, `Lost ${name}`) }); save();
    chronNoteWorld(L(`${date} ${us()}, 전쟁에서 져 종속국 ${name}을(를) 빼앗김`, `${date} ${us()} loses the war and its subject ${name}`), true);
    ctx.notify({ kind: 'vassal', title: L('종속국을 빼앗겼습니다', 'A subject was taken from us'), body: name });
  };
  vrHooks.proxyWonByUs = (foe: string) => {
    const sid = ctx.curSaveId; if (!sid) return; const s = saveOf(sid); if (s.proxy) { s.proxy.won = true; save(); }
    vassalNote(0, L(`종주국 명으로 치른 대리전에서 ${foe || '상대'}에게 이겼다(영향력 +50, 상대는 굴욕).`, `We won the proxy war against ${foe || 'the enemy'} fought at the overlord's command (influence +50; the enemy is humiliated).`), true);
  };
  setInterval(() => { void monthly(); }, 30000);
  ipcMain.handle('voState', () => overlordView());
  ipcMain.handle('voAnswer', async (_e, a: { id?: unknown; accept?: unknown }) => {
    const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러와 주세요.', 'Load a save first.') };
    if (!ready()) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
    if (busy) return { ok: false, error: L('처리 중입니다.', 'Busy.') };
    const s = saveOf(sid), o = s.pending; if (!o || o.id !== String(a?.id ?? '')) return { ok: false, error: L('답할 명령이 없습니다.', 'There is no order to answer.') };
    busy = true;
    try { const text = a?.accept ? await accept(sid, s, o) : await refuse(sid, s, o, false); vassalPush(); return { ok: true, text, view: overlordView() }; }
    catch (e) { return { ok: false, error: (e as Error).message }; } finally { busy = false; }
  });
}
