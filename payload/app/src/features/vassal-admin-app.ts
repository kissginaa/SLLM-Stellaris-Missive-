// 종속국 행정(앱 쪽, 2026-11-04 사용자: 「Subject Administration」에서 성계 이양·기술 원조·동화 정책 채용). 규칙: src/vassal-admin.ts · 화면: ui/vassal-admin.js(종속국 창) · 거래 「성계 할양」은 deals-app 이 vaTransfer 를 부른다.
// 로그 자리 VADMIN: VADMSYS·VADMEND(성계 목록) · VADMSET(적용 응답) · VADMRES(우리 월 연구량).
// 기록은 종속국 채널에 시스템 줄(vassalNote), 반응은 종속국 서신(vassalReact), 연대기(종속국 쪽·세계 소식).
// 저장: sllm_vassal_admin.json { saves: { [세이브]: { cool: {성계번호: 날짜}, tech: {idx: 날짜}, assim: {idx: {since, shift, renew, eth[]}} } } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { featureOff } from '../app/feature-gate';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { hoiLink } from '../app/hoi-hooks';
import { reignLink } from '../app/reign-hooks'; // 간섭 반감·정책 동조(2026-11-05, src/features/vassal-reign-app.ts)
import { terminalRequest, terminalReplies } from './terminal';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { vassalNote, vassalReact, vassalPush } from './vassal-app';
import { scanDays, addAppAlarm, alarmBar } from './alarm-app'; // 일정표(2026-11-04): 게임 쪽 남은 날 · 상황 막대
import { VADM, baseEthics, nextShift, sysFee, listCommand, transferCommand, researchCommand, techAmounts, techCommand, assimCommand, readSys, stText, coolLeft, yearsSince, type Ethic, type VaSys } from '../vassal-admin';

interface Assim { since: string; shift: string; renew: string; eth: Ethic[]; name: string }
interface VaSave { cool: Record<string, string>; tech: Record<string, string>; assim: Record<string, Assim> }
const file = () => path.join(app.getPath('userData'), 'sllm_vassal_admin.json');
let all: Record<string, VaSave> | null = null;
const books = (): Record<string, VaSave> => { if (all) return all; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = j && typeof j.saves === 'object' && j.saves ? j.saves : {}; } catch { all = {}; } return all!; };
const saveOf = (sid: string): VaSave => { const s = (books()[sid] ??= { cool: {}, tech: {}, assim: {} }); s.cool ??= {}; s.tech ??= {}; s.assim ??= {}; return s; };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'vadmin.save_failed', { error: (e as Error).message }); } };
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/^\\/, '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const ready = () => !!(ctx.gameRunning && link.sessionReady && ctx.curSaveId && /^\d+$/.test(ctx.curSaveId));
const us = () => ctx.playerName || L('우리 제국', 'our empire');
let busy = false;

// ---- 성계 목록(누를 때 게임에 물어봄) ----
const lists = new Map<number, VaSys[]>();
function onLine(m: SllmMessage): void {
  const req = Math.round(num(m.kv.req));
  if (m.kind === 'VADMSYS') { const l = lists.get(req), s = readSys(m.kv); if (l && s && l.length < VADM.listMax) l.push(s); return; }
  if (m.kind === 'VADMEND' || m.kind === 'VADMSET' || m.kind === 'VADMRES') terminalReplies.get(m.kind + ':' + req)?.(m);
}
/** idx 나라(0 = 우리)의 성계 목록(수도 먼저, 식민지 많은 순). */
export async function vaSystems(idx: number): Promise<VaSys[]> {
  if (!ready()) throw new Error(L('게임이 켜져 있어야 성계 목록을 불러올 수 있습니다.', 'The game must be running to list systems.'));
  const req = ++link.reqCounter, sid = ctx.curSaveId!; lists.set(req, []);
  try { await terminalRequest(listCommand(req, sid, idx), 'VADMEND', req); } catch { lists.delete(req); throw new Error(stText(-1, L)); }
  const out = lists.get(req) ?? []; lists.delete(req);
  return out.sort((a, b) => Number(b.cap) - Number(a.cap) || b.col - a.col || a.name.localeCompare(b.name));
}
const st = async (cmd: (req: number) => string): Promise<number> => { const req = ++link.reqCounter; try { const m = await terminalRequest(cmd(req), 'VADMSET', req); return Math.round(num(m.kv.st)); } catch { return -1; } };
/** 성계 하나 옮기기(종속국 칙령·외교 거래 공용). take = 대상 → 우리. fee = 영향력. */
export async function vaTransfer(idx: number, n: number, dir: 'take' | 'give', fee: number): Promise<number> {
  if (!ready()) return -1; const sid = ctx.curSaveId!;
  return st((req) => transferCommand(req, sid, idx, n, dir, fee));
}

// ---- 화면 ----
function ethicsOf(idx: number): Ethic[] { try { return baseEthics(ctx.flagProv.ethicsFor(idx) ?? []); } catch { return []; } }
export function vaView(idx: number) {
  const sid = ctx.curSaveId || '', s = sid ? saveOf(sid) : { cool: {}, tech: {}, assim: {} } as VaSave, date = ctx.gameDate || '';
  const a = s.assim[String(idx)];
  return { ok: !!sid, running: ready(), fee: { base: VADM.sysBase, perCol: VADM.sysPerCol, tech: VADM.techCost, assim: VADM.assimCost },
    techLeft: ((d) => (d === null ? coolLeft(s.tech[String(idx)], date, VADM.techCoolYears) : Math.ceil(d / 360)))(scanDays('sllm_va_tech_cd', idx)), cool: s.cool,
    assim: a ? { since: a.since, nextShift: ((d) => (d === null ? Math.max(0, Math.ceil(VADM.assimShiftYears - yearsSince(a.shift || a.since, date))) : Math.ceil(d / 360)))(scanDays('sllm_va_assim_cd', idx)) } : null,
    ours: ethicsOf(ctx.playerIdx), theirs: ethicsOf(idx) };
}

// ---- 월 점검: 동화 갱신(끌림 수정자 다시 걸기)·자치도 반감·5년마다 정부 윤리 한 걸음 ----
let lastMonth = '';
async function monthly(): Promise<void> {
  if (!ready() || busy) return; const sid = ctx.curSaveId!, date = ctx.gameDate || '', month = date.slice(0, 7); if (!month || month === lastMonth) return; lastMonth = month;
  const s = saveOf(sid); busy = true;
  try {
    for (const [k, a] of Object.entries(s.assim)) {
      const idx = Number(k);
      if (yearsSince(a.renew || a.since, date) >= 1) { // 해마다: 끌림 갱신 + 반감
        const r = await st((req) => assimCommand(req, sid, idx, 'renew', a.eth));
        if (r === 9) { a.renew = date; hoiLink.nudge?.(idx, VADM.assimAutoYear); } else if (r === 4) { delete s.assim[k]; }
        save();
      }
      const gd = scanDays('sllm_va_assim_cd', idx); // ③ 게임 표식이 끝났으면(0) 다음 단계. 이번 달 아직 안 읽었으면 날짜로
      if (s.assim[k] && (gd === null ? yearsSince(a.shift || a.since, date) >= VADM.assimShiftYears : gd === 0 && yearsSince(a.shift || a.since, date) >= 1)) {
        const e = nextShift(a.eth, ethicsOf(idx)); a.shift = date; save();
        await reignLink.align(idx, a.name); // ④ 정책·종족 권리 한 걸음(2026-11-05) — 윤리가 이미 같아도 한다
        if (!e) continue;
        const r = await st((req) => assimCommand(req, sid, idx, 'shift', [e]));
        if (r === 9) {
          reignLink.meddle(idx, 'shift');
          void alarmBar('assim', idx, VADM.assimShiftYears * 360);
          const en = ETH_NAME[e];
          vassalNote(idx, L(`동화 정책: ${a.name}의 정부가 ${en[0]} 쪽으로 한 걸음 옮겨 갔다.`, `Assimilation: ${a.name}'s government has shifted one step toward ${en[1]}.`), true);
          chronNote(idx, L(`종주국 ${us()}의 동화 정책 끝에 우리 정부가 ${en[0]} 쪽으로 기울었다`, `After years of ${us()}'s assimilation policy, our government has tilted toward ${en[1]}`));
          vassalReact(idx, 'complaint', `The overlord's assimilation policy has just shifted your government toward ${en[1]}. Many of your people feel their culture is being erased.`);
        }
      }
    }
  } finally { busy = false; }
}
const ETH_NAME: Record<Ethic, [string, string]> = { authoritarian: ['권위주의', 'authoritarianism'], egalitarian: ['평등주의', 'egalitarianism'], xenophobe: ['외계인혐오', 'xenophobia'], xenophile: ['외계인애호', 'xenophilia'], militarist: ['군국주의', 'militarism'], pacifist: ['평화주의', 'pacifism'], materialist: ['물질주의', 'materialism'], spiritualist: ['정신주의', 'spiritualism'] };

type Res = { ok: true; text: string; view: ReturnType<typeof vaView> } | { ok: false; error: string };
const fail = (error: string): Res => ({ ok: false, error });
function needIdx(v: unknown): number { const i = Number(v); if (!Number.isSafeInteger(i) || i < 1) throw new Error(L('종속국을 골라 주세요.', 'Pick a subject.')); return i; }

export function registerVassalAdmin(router: LogRouter): void {
  router.on(SLOT.VADMIN, 'vassal-admin', onLine);
  setInterval(() => { if (featureOff('vassal')) return; void monthly().catch((e) => logDiagnostic('warn', 'vadmin.monthly_failed', { error: (e as Error).message })); }, 30000);
  ipcMain.handle('vaState', (_e, idx: unknown) => vaView(Number(idx)));
  ipcMain.handle('vaSystems', async (_e, idx: unknown) => { try { return { ok: true, list: await vaSystems(Number(idx) > 0 ? Number(idx) : 0) }; } catch (e) { return { ok: false, error: (e as Error).message, list: [] }; } });
  // ① 성계 이양(종속국 칙령): take = 종속국 → 우리(자치도 +10), give = 우리 → 종속국(자치도 -6). 영향력 25 + 식민지당 50, 같은 성계는 5년에 한 번.
  ipcMain.handle('vaTransfer', async (_e, a: { idx?: unknown; n?: unknown; dir?: unknown; name?: unknown; col?: unknown; vname?: unknown }): Promise<Res> => {
    try {
      const idx = needIdx(a?.idx), n = Number(a?.n), dir = a?.dir === 'give' ? 'give' : a?.dir === 'take' ? 'take' : null, sid = ctx.curSaveId;
      if (!sid || !dir || !Number.isSafeInteger(n) || n < 1) return fail(L('옮길 성계를 골라 주세요.', 'Pick a system to transfer.'));
      if (!ready()) return fail(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      const s = saveOf(sid), left = coolLeft(s.cool[String(n)], ctx.gameDate || '', VADM.sysCoolYears); if (left) return fail(L(`이 성계는 최근에 옮겼습니다. ${left}년 뒤에 다시 옮길 수 있습니다.`, `This system was moved recently. Try again in ${left} year(s).`));
      if (busy) return fail(L('처리 중입니다.', 'Busy.'));
      const name = String(a?.name ?? '').slice(0, 60) || '?', vn = String(a?.vname ?? '').slice(0, 60) || '?', col = Math.max(0, Math.round(Number(a?.col) || 0)), fee = sysFee(col);
      busy = true; let r: number; try { r = await vaTransfer(idx, n, dir, fee); } finally { busy = false; }
      if (r !== 9) return fail(stText(r, L));
      s.cool[String(n)] = ctx.gameDate || ''; save(); addAppAlarm(`sys:${n}`, [`성계 이양 다시 가능: ${name}`, `System transfer available again: ${name}`], VADM.sysCoolYears * 360);
      if (dir === 'take') {
        hoiLink.nudge?.(idx, VADM.takeAuto);
        reignLink.meddle(idx, 'take');
        vassalNote(idx, L(`성계 이양 칙령: ${vn}의 「${name}」 성계(식민지 ${col})를 우리가 가져왔다. 종속국의 반감이 커졌다(자치도 +${VADM.takeAuto}).`, `Transfer edict: we took the ${name} system (${col} colonies) from ${vn}. Resentment grows (autonomy +${VADM.takeAuto}).`));
        vassalReact(idx, 'complaint', `Your overlord has just seized your ${name} system${col ? ` with ${col} colonies` : ''} by decree.`);
        chronNote(idx, L(`종주국 ${us()}이(가) 칙령으로 우리 「${name}」 성계를 빼앗아 갔다`, `Our overlord ${us()} seized our ${name} system by decree`));
        chronNoteWorld(L(`${ctx.gameDate} ${us()}, 종속국 ${vn}의 「${name}」 성계를 직할령으로 편입`, `${ctx.gameDate} ${us()} annexes the ${name} system from its subject ${vn}`), true);
      } else {
        hoiLink.nudge?.(idx, VADM.giveAuto);
        vassalNote(idx, L(`성계 이양 칙령: 우리 「${name}」 성계(식민지 ${col})를 ${vn}에게 넘겼다(자치도 ${VADM.giveAuto}).`, `Transfer edict: we handed our ${name} system (${col} colonies) to ${vn} (autonomy ${VADM.giveAuto}).`));
        vassalReact(idx, 'thanks', `Your overlord has just granted you the ${name} system${col ? ` with ${col} colonies` : ''}.`);
        chronNote(idx, L(`종주국 ${us()}이(가) 「${name}」 성계를 우리에게 내주었다`, `Our overlord ${us()} granted us the ${name} system`));
      }
      vassalPush();
      return { ok: true, text: dir === 'take' ? L(`「${name}」 성계를 가져왔습니다(영향력 -${fee}).`, `Took the ${name} system (influence -${fee}).`) : L(`「${name}」 성계를 넘겼습니다(영향력 -${fee}).`, `Handed over the ${name} system (influence -${fee}).`), view: vaView(idx) };
    } catch (e) { return fail((e as Error).message); }
  });
  // ② 기술 원조: 영향력 100 → 우리 월 연구량 6달 치를 종속국 연구에. 자치도 -8. 3년에 한 번.
  ipcMain.handle('vaTech', async (_e, a: { idx?: unknown; vname?: unknown }): Promise<Res> => {
    try {
      const idx = needIdx(a?.idx), sid = ctx.curSaveId; if (!sid) return fail(L('세이브를 불러와 주세요.', 'Load a save first.'));
      if (!ready()) return fail(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      const s = saveOf(sid), left = coolLeft(s.tech[String(idx)], ctx.gameDate || '', VADM.techCoolYears); if (left) return fail(L(`기술 원조는 ${left}년 뒤에 다시 할 수 있습니다.`, `Technology aid is available again in ${left} year(s).`));
      if (busy) return fail(L('처리 중입니다.', 'Busy.'));
      busy = true;
      try {
        const rq = ++link.reqCounter; let m: SllmMessage;
        try { m = await terminalRequest(researchCommand(rq, sid), 'VADMRES', rq); } catch { return fail(stText(-1, L)); }
        const amt = techAmounts(num(m.kv.p), num(m.kv.s), num(m.kv.e)); if (!amt.p && !amt.s && !amt.e) return fail(L('우리 연구량을 읽지 못했습니다.', 'Could not read our research output.'));
        const r = await st((req) => techCommand(req, sid, idx, amt)); if (r !== 9) return fail(stText(r, L));
        s.tech[String(idx)] = ctx.gameDate || ''; save(); hoiLink.nudge?.(idx, VADM.techAuto); reignLink.meddle(idx, 'tech'); void alarmBar('vatech', idx, VADM.techCoolYears * 360);
        const vn = String(a?.vname ?? '').slice(0, 60) || '?', sum = `${amt.p}/${amt.s}/${amt.e}`;
        vassalNote(idx, L(`기술 원조: ${vn}에 연구 자료(물리/사회/공학 ${sum})를 넘겼다(영향력 -${VADM.techCost}, 자치도 ${VADM.techAuto}).`, `Technology aid: research data (physics/society/engineering ${sum}) sent to ${vn} (influence -${VADM.techCost}, autonomy ${VADM.techAuto}).`));
        vassalReact(idx, 'thanks', `Your overlord has just shared a large body of research data with you (physics/society/engineering ${sum}).`);
        chronNote(idx, L(`종주국 ${us()}이(가) 대규모 연구 자료를 넘겨주었다`, `Our overlord ${us()} handed us a large body of research data`));
        vassalPush();
        return { ok: true, text: L(`연구 자료를 넘겼습니다(물리/사회/공학 ${sum}).`, `Research data sent (physics/society/engineering ${sum}).`), view: vaView(idx) };
      } finally { busy = false; }
    } catch (e) { return fail((e as Error).message); }
  });
  // ③ 동화 정책: 시작(영향력 50) / 멈춤. 군체에는 못 건다.
  ipcMain.handle('vaAssim', async (_e, a: { idx?: unknown; on?: unknown; vname?: unknown }): Promise<Res> => {
    try {
      const idx = needIdx(a?.idx), sid = ctx.curSaveId, on = !!a?.on; if (!sid) return fail(L('세이브를 불러와 주세요.', 'Load a save first.'));
      if (!ready()) return fail(L('게임이 켜져 있어야 합니다.', 'The game must be running.'));
      if (busy) return fail(L('처리 중입니다.', 'Busy.'));
      const s = saveOf(sid), vn = String(a?.vname ?? '').slice(0, 60) || '?', date = ctx.gameDate || '';
      busy = true;
      try {
        if (!on) {
          if (!s.assim[String(idx)]) return fail(L('동화 정책을 펴고 있지 않습니다.', 'No assimilation policy is in effect.'));
          const r = await st((req) => assimCommand(req, sid, idx, 'stop', [])); if (r !== 9) return fail(stText(r, L));
          delete s.assim[String(idx)]; save(); void alarmBar('assim', idx, 1, false);
          vassalNote(idx, L(`동화 정책을 거두었다. 이미 바뀐 윤리는 그대로 남는다.`, `The assimilation policy was lifted. Ethics already changed stay as they are.`));
          vassalPush(); return { ok: true, text: L('동화 정책을 멈췄습니다.', 'Assimilation stopped.'), view: vaView(idx) };
        }
        if (s.assim[String(idx)]) return fail(L('이미 동화 정책을 펴고 있습니다.', 'Assimilation is already in effect.'));
        const eth = ethicsOf(ctx.playerIdx); if (!eth.length) return fail(L('우리 윤리를 읽지 못했습니다(군체·기계 지성은 동화 정책을 쓸 수 없습니다).', 'Could not read our ethics (gestalt empires cannot use assimilation).'));
        const r = await st((req) => assimCommand(req, sid, idx, 'start', eth)); if (r !== 9) return fail(stText(r, L));
        s.assim[String(idx)] = { since: date, shift: date, renew: date, eth, name: vn }; save(); reignLink.meddle(idx, 'assim'); void alarmBar('assim', idx, VADM.assimShiftYears * 360);
        const names = eth.map((e) => ETH_NAME[e]);
        vassalNote(idx, L(`동화 정책: ${vn}에 우리 가치(${names.map((x) => x[0]).join('·')})를 퍼뜨리기 시작했다(영향력 -${VADM.assimCost}). 해마다 반감이 쌓인다.`, `Assimilation: we began spreading our values (${names.map((x) => x[1]).join(', ')}) in ${vn} (influence -${VADM.assimCost}). Resentment will build each year.`));
        vassalReact(idx, 'complaint', `Your overlord has just begun an assimilation policy, pushing its own values (${names.map((x) => x[1]).join(', ')}) on your people through schools, media and officials.`);
        chronNote(idx, L(`종주국 ${us()}이(가) 우리 학교와 방송에 자기네 가치를 밀어 넣기 시작했다`, `Our overlord ${us()} began pushing its own values into our schools and broadcasts`));
        vassalPush();
        return { ok: true, text: L('동화 정책을 시작했습니다.', 'Assimilation begun.'), view: vaView(idx) };
      } finally { busy = false; }
    } catch (e) { return fail((e as Error).message); }
  });
}
