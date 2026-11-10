// 신규 식민지 이름 짓기(명명식, 2026-11-04 사용자) — 앱 쪽. 규칙: src/colname.ts · 화면: ui/office-colname.js(집무실 「행성 총독」 칸의 「행성 이름 짓기」)
// 연결 모드 events/sllm_colname_events.txt 가 on_colonized(우리가 직접 개척한 행성만)에 COLNEW 한 줄을 남기면 → 기다리는 목록에 넣고 집무실 알림 한 줄.
// 고르면 그때만 게임에 명령 한 번(set_name). 「기본 이름 그대로」는 게임에 묻지 않고 목록에서만 뺀다. 알림은 화면에서 끌 수 있다(끄면 목록에만 조용히 쌓임).
// 저장: sllm_colname.json { notify: boolean, saves: { [세이브]: { pending: ColPending[] } } }
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { office } from './office-app';
import { gov } from './gov';
import { playerGestalt } from './gestalt-app';
import { gameLanguage } from '../savegame/loc';
import { runtimeUserDir } from '../environment-paths';
import { parseLocNames } from '../namegen';
import { COLNAME, parsePlanetNames, pickCandidates, colNameCommand, colNameMessages, readColNames, cleanColName, isNameKey, type PlanetNamePool, type ColCandidate, type ColAsked } from '../colname';

interface ColPending { idx: number; name: string; cls: string; sys: string; date: string; cands: ColCandidate[]; asked: ColAsked[] | null }
interface ColBook { notify: boolean; saves: Record<string, { pending: ColPending[] }> }
const file = () => path.join(app.getPath('userData'), 'sllm_colname.json');
let book: ColBook | null = null;
const bookNow = (): ColBook => {
  if (book) return book;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); book = { notify: j?.notify !== false, saves: j && typeof j.saves === 'object' && j.saves ? j.saves : {} }; } catch { book = { notify: true, saves: {} }; }
  return book!;
};
const save = () => { try { fs.writeFileSync(file(), JSON.stringify(bookNow())); } catch (e) { logDiagnostic('warn', 'colname.save_failed', { error: (e as Error).message }); } };
const pendingOf = (sid: string): ColPending[] => ((bookNow().saves[sid] ??= { pending: [] }).pending);

// 게임 이름 표(행성 이름) + 이름 번역 — 게임 폴더와 켠 모드에서 한 번 읽고 모드 목록이 바뀌면 다시.
let cache: { rev: number; lists: Map<string, PlanetNamePool>; en: Record<string, string>; ko: Record<string, string> } | null = null;
function names() {
  const res = ctx.modCompatibility.resources; res.refresh();
  if (cache && cache.rev === res.revision) return cache;
  const lists = new Map<string, PlanetNamePool>(), en: Record<string, string> = {}, ko: Record<string, string> = {};
  try {
    for (const f of res.files('common/name_lists', '.txt')) { try { for (const [k, v] of parsePlanetNames(res.read(f).toString('utf8'))) lists.set(k, v); } catch { /* 건너뜀 */ } }
    for (const f of res.files('localisation', '.yml')) {
      const base = path.basename(f.relative).toLowerCase(); if (!base.includes('name') || !/l_(english|korean)\.yml$/.test(base)) continue;
      try { const { lang, map } = parseLocNames(res.read(f).toString('utf8')); Object.assign(lang === 'korean' ? ko : en, map); } catch { /* 건너뜀 */ }
    }
  } catch (e) { logDiagnostic('warn', 'colname.names_failed', { error: e }); }
  cache = { rev: res.revision, lists, en, ko };
  return cache;
}
/** 게임 화면에 보일 글자로 후보를 보여 준다(게임 언어가 한국어면 한국어 이름, 없으면 영어). */
const gameLoc = (c: NonNullable<typeof cache>) => (gameLanguage(runtimeUserDir()) === 'korean' ? { ...c.en, ...c.ko } : c.en);
function candidatesFor(p: { name: string }): ColCandidate[] {
  try {
    const c = names(); if (!c.lists.size) return [];
    const info = ctx.flagProv.portraitInfoFor(ctx.playerIdx);
    const mix = info?.pop?.length ? info.pop : info?.mix?.length ? info.mix : info?.founder ? [{ share: 1, cls: info.founder.cls, list: info.founder.list }] : [];
    const used = new Set<string>([p.name, ...(gov.planetList?.planets ?? []).map((x) => x.name)]);
    return pickCandidates(mix, c.lists, gameLoc(c), used, Math.random);
  } catch (e) { logDiagnostic('warn', 'colname.cands_failed', { error: (e as Error).message }); return []; }
}

function toast(name: string): void {
  (office as { toastGo: string }).toastGo = 'colname';
  ctx.notify({ kind: 'office', title: L('새 식민지', 'New colony'), body: L(`${name}에 첫 정착민이 내렸습니다. 이름을 지어 주시겠습니까?`, `The first settlers have landed on ${name}. Would you like to name it?`), action: L('집무실', 'Office') });
}
function onColonized(m: SllmMessage): void {
  const sid = String(m.kv.sid ?? '').replace(/\.0+$/, ''), idx = Number(m.kv.idx), name = String(m.kv.name ?? '').trim();
  if (!sid || sid !== ctx.curSaveId || !Number.isSafeInteger(idx) || idx < 1 || !name) return;
  const list = pendingOf(sid); if (list.some((x) => x.idx === idx)) return;
  list.push({ idx, name, cls: String(m.kv.class ?? '').trim(), sys: String(m.kv.sys ?? '').trim(), date: ctx.gameDate || '', cands: candidatesFor({ name }), asked: null });
  while (list.length > COLNAME.pendingMax) list.shift();
  save(); logDiagnostic('info', 'colname.new', { idx });
  if (bookNow().notify) toast(name);
}

export function colNameView() {
  const sid = ctx.curSaveId, b = bookNow();
  return { ok: !!sid, notify: b.notify, running: !!(ctx.gameRunning && link.sessionReady), pending: sid ? pendingOf(sid).map((p) => ({ idx: p.idx, name: p.name, cls: p.cls, sys: p.sys, date: p.date, cands: p.cands, asked: p.asked })) : [] };
}

export function registerColName(router: LogRouter): void {
  router.on(SLOT.COLNAME, 'colname', (m: SllmMessage) => {
    if (m.kind === 'COLNEW') onColonized(m);
    else if (m.kind === 'COLNAME') terminalReplies.get('COLNAME:' + m.kv.req)?.(m);
  });
  ipcMain.handle('colNameState', () => colNameView());
  ipcMain.handle('colNameNotify', (_e, on: unknown) => { bookNow().notify = !!on; save(); return colNameView(); });
  ipcMain.handle('colNameAsk', async (_e, idx: unknown) => {
    try {
      const sid = ctx.curSaveId, p = sid ? pendingOf(sid).find((x) => x.idx === Number(idx)) : undefined; if (!sid || !p) throw new Error(L('목록을 다시 열어 주세요.', 'Reopen the list.'));
      const info = ctx.flagProv.portraitInfoFor(ctx.playerIdx), ethics = (ctx.flagProv.ethicsFor(ctx.playerIdx) ?? []).map((e) => e.replace(/^ethic_/, '').replace(/_/g, ' '));
      const raw = String(await ctx.ai.chat(colNameMessages({ planet: p.name, cls: p.cls, system: p.sys, empire: ctx.playerName, species: info?.founder?.cls ?? '', ethics, gestalt: !!playerGestalt() }), { maxTokens: 400, purpose: 'colony-name', json: true }) ?? '');
      const got = readColNames(raw, p.name); if (!got) throw new Error(L('정착민들이 이름을 정하지 못했습니다. 다시 물어봐 주세요.', 'The settlers could not agree on a name. Ask again.'));
      p.asked = got; save(); return { ok: true, view: colNameView() };
    } catch (e) { logDiagnostic('warn', 'colname.ask_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('colNamePick', async (_e, a: { idx?: unknown; key?: unknown; text?: unknown; keep?: unknown }) => {
    try {
      const sid = ctx.curSaveId, idx = Number(a?.idx), list = sid ? pendingOf(sid) : [], p = list.find((x) => x.idx === idx);
      if (!sid || !p) throw new Error(L('목록을 다시 열어 주세요.', 'Reopen the list.'));
      if (a?.keep) { list.splice(list.indexOf(p), 1); save(); return { ok: true, view: colNameView() }; } // 기본 이름 그대로: 게임에 묻지 않는다
      let name: { key: string } | { text: string } | null = null, shown = '';
      if (isNameKey(a?.key)) { const c = p.cands.find((x) => x.key === a.key); if (c) { name = { key: c.key }; shown = c.text; } }
      else { const t = cleanColName(a?.text); if (t) { name = { text: t }; shown = t; } }
      if (!name) throw new Error(L('이름을 골라 주세요.', 'Pick a name.'));
      if (!ctx.gameRunning || !link.sessionReady) throw new Error(L('게임이 켜져 있어야 이름을 바꿀 수 있습니다.', 'The game must be running to rename the planet.'));
      const req = ++link.reqCounter, m = await terminalRequest(colNameCommand(req, sid, idx, name), 'COLNAME', req);
      if (m.kv.status !== 'applied') throw new Error(L('게임이 이름을 받지 못했습니다.', 'The game did not accept the name.'));
      list.splice(list.indexOf(p), 1); save();
      const pl = gov.planetList?.planets.find((x) => x.idx === idx); if (pl) pl.name = shown; // 화면의 행성 목록도 새 이름으로(다음에 게임에서 읽으면 어차피 바뀜)
      return { ok: true, name: shown, view: colNameView() };
    } catch (e) { logDiagnostic('warn', 'colname.pick_failed', { error: (e as Error).message }); return { ok: false, error: (e as Error).message }; }
  });
}
