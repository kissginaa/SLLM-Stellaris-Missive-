// 그레이트 칸 특별 대우 연결(다음 업데이트, 2026-10-26). 규칙: src/khan.ts. 모드: events/sllm_khan_events.txt(전투 표식·매달 칸의 총애).
// 그레이트 칸이 나타나면(월간 위기 줄 kind=khan) 세이브마다 한 번 게임에서 조사 → 자격이 되면 선물·총애 표식 → 사자 통신 알림·연대기.
// 그레이트 칸과 대화할 때 프롬프트에 「옛정」 또는 「옛 원한」 줄. AI 호출 없음.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { chronNote, chronNoteWorld } from './chronicle-app';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot } from './gamestate-app';
import { crisisView } from './crisis-app';
import { marauderDealWith } from './marauder-app';
import type { SllmMessage } from '../protocol';
import { type KhanSave, khanCheckCommand, parseKhan, khanEligible, khanBlessCommand, khanTalkLine, khanText, sanitizeKhan } from '../khan';

const file = () => path.join(app.getPath('userData'), 'sllm_khan.json');
let store: Record<string, KhanSave> | null = null;
function all(): Record<string, KhanSave> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, unknown>)) { const s = sanitizeKhan(v); if (s) store[k] = s; } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'khan', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'khan', error: e }); } }
const yearNow = (): number | undefined => { const y = parseInt(String(ctx.gameDate || ''), 10); return Number.isFinite(y) ? y : undefined; };

/** 그레이트 칸(각성한 약탈자)과 대화할 때 프롬프트 줄. */
export function khanTalk(): string { const sid = ctx.curSaveId; return sid ? khanTalkLine(all()[safeKey(sid)]) : ''; }

let busy = false;
async function onMonth(sid: string): Promise<void> {
  if (busy || sid !== ctx.curSaveId || !ctx.gameRunning || all()[safeKey(sid)]?.checked || !crisisView().kinds.includes('khan')) return;
  busy = true;
  try {
    const req = ++link.reqCounter, m = await terminalRequest(khanCheckCommand(req, sid), 'KHAN', req);
    if (m.kv.sid !== sid || ctx.curSaveId !== sid) return;
    const c = parseKhan(m.kv); if (!c.found) return;
    const ok = khanEligible(c, c.idx > 0 && marauderDealWith(c.idx));
    const s: KhanSave = { checked: true, eligible: ok, clan: c.clan, idx: c.idx, name: c.name, on: ctx.gameDate || '', ...(c.fought ? { fought: true } : {}) };
    all()[safeKey(sid)] = s; save();
    logDiagnostic('info', 'khan.checked', { clan: c.clan, fought: c.fought, hired: c.hired, op: c.op, eligible: ok, already: c.fav });
    if (!ok || c.fav) return;
    const r2 = ++link.reqCounter, g = await terminalRequest(khanBlessCommand(r2, sid, yearNow()), 'KHANGIFT', r2);
    const amt = Math.round(Number(g.kv.amt) || 0); s.gift = amt; save();
    ctx.notify({ kind: 'news', title: khanText.title(c.name), body: khanText.body(c.name, amt) });
    if (c.idx > 0) chronNote(c.idx, khanText.chron(c.name, amt)); else chronNoteWorld(khanText.chron(c.name, amt), true);
  } catch (e) { logDiagnostic('warn', 'khan.check_failed', { error: (e as Error).message }); }
  finally { busy = false; }
}

export function registerKhan(router: LogRouter): void {
  router.on(SLOT.KHAN, 'khan', (m: SllmMessage) => {
    if (m.kind === 'KHAN' || m.kind === 'KHANGIFT') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m);
    else if (m.kind === 'KHANFAVOR' && m.kv.sid === ctx.curSaveId) ctx.notify({ kind: 'info', title: m.kv.on === '1' ? khanText.favorOn() : khanText.favorOff(), body: '' });
  });
  onGameSnapshot((snap) => { if (snap.sid) void onMonth(snap.sid); });
}
