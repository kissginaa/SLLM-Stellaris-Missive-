// 이름의 정치 — 앱 장부와 게임 호출(2026-11-04). 규칙: src/rename.ts. 외교 거래(deals-app)·종속국(vassal-app)·AI 의 개명 요구(chat)·갤럭틱 포럼이 함께 쓴다.
// 저장: sllm_renames.json { saves: { [세이브]: RenameRec[] } } — 원래 이름을 남겨 「이름 반환」 조항으로 돌려줄 수 있게.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest, terminalReplies } from './terminal';
import { RENAME, renameCommand, cleanGameName, isWhat, originalName, type RenameRec, type RenameTarget, type RenameWhat, type RenameBy } from '../rename';

const file = () => path.join(app.getPath('userData'), 'sllm_renames.json');
let all: Record<string, RenameRec[]> | null = null;
const books = (): Record<string, RenameRec[]> => {
  if (all) return all;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); all = {}; for (const [k, v] of Object.entries((j?.saves ?? {}) as Record<string, unknown>)) if (Array.isArray(v)) all[k] = v.filter((r: any) => r && typeof r.id === 'string' && Number.isSafeInteger(r.tid) && isWhat(r.what) && typeof r.name === 'string'); }
  catch { all = {}; }
  return all!;
};
const save = () => { try { fs.writeFileSync(file(), JSON.stringify({ saves: books() })); } catch (e) { logDiagnostic('warn', 'rename.save_failed', { error: (e as Error).message }); } };
export const renamesOf = (sid: string): RenameRec[] => (books()[sid] ??= []);
const olds = new Map<string, string>();

/** 게임에서 이름을 바꾸고(바꾸기 전 이름을 받아) 결과를 돌려준다. 장부에는 넣지 않는다(부르는 쪽이 recordRename). */
export async function gameRename(t: RenameTarget, what: RenameWhat, name: string): Promise<{ ok: boolean; old: string; status: string }> {
  const sid = ctx.curSaveId; if (!sid || !ctx.gameRunning || !link.sessionReady) return { ok: false, old: '', status: 'offline' };
  const req = ++link.reqCounter;
  try {
    const m = await terminalRequest(renameCommand(req, sid, t, what, name), 'RENAME', req);
    const old = olds.get(String(req)) ?? ''; olds.delete(String(req));
    return { ok: m.kv.status === 'applied', old, status: String(m.kv.status ?? '') };
  } catch (e) { olds.delete(String(req)); logDiagnostic('warn', 'rename.failed', { error: (e as Error).message }); return { ok: false, old: '', status: 'timeout' }; }
}
/** 장부에 한 줄. 같은 자리를 두 번 바꿔도 처음 이름을 「원래 이름」으로 둔다. */
export function recordRename(sid: string, r: { tid: number; empire: string; what: RenameWhat; old: string; name: string; by: RenameBy }): RenameRec {
  const list = renamesOf(sid), old = originalName(list, r.tid, r.what, r.old);
  for (const x of list) if (x.tid === r.tid && x.what === r.what && !x.restored) x.restored = ctx.gameDate || '?'; // 앞의 개명은 이번 것에 묻힌다(원래 이름은 이어받음)
  const rec: RenameRec = { id: `${r.tid}:${r.what}:${Date.now().toString(36)}`, tid: r.tid, empire: r.empire, what: r.what, old, name: cleanGameName(r.name) ?? r.name, date: ctx.gameDate || '', by: r.by };
  list.push(rec); while (list.length > RENAME.keep) list.shift(); save(); return rec;
}
export function markRestored(sid: string, id: string): RenameRec | null { const r = renamesOf(sid).find((x) => x.id === id); if (!r) return null; r.restored = ctx.gameDate || '?'; save(); return r; }

export function registerRenameLedger(router: LogRouter): void {
  router.on(SLOT.RENAME, 'rename', (m: SllmMessage) => {
    if (m.kind === 'RENAMEOLD') { olds.set(String(m.kv.req), String(m.kv.old ?? '').trim()); if (olds.size > 50) olds.delete(olds.keys().next().value!); }
    else if (m.kind === 'RENAME') terminalReplies.get('RENAME:' + m.kv.req)?.(m);
  });
}
