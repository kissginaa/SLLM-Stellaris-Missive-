// 몰락제국 각성 알림(알파 11, 2026-10-25 사용자 결정 「1,2,3 괜찮네」 3번). 외교 단말기 통신 목록(CONTACT_END)에서 몰락 → 각성으로 바뀐 나라를 찾아
// 가로챈 신호(연대기) + 알림 + 신문 특별판(위기 특별판 경로, 한 번)을 낸다. 처음 보는 각성 제국은 조용히 기록만(앱을 새로 켰을 때 거짓 알림 방지). LLM: 특별판 한 번뿐.
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { LogRouter, SLOT } from '../app/log-router';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { terminal } from './terminal';
import { chronNoteWorld } from './chronicle-app';
import { crisisSpecialEdition } from './crisis-app';
import { fallenKind, awakenSignal } from '../fallen';
import type { SllmMessage } from '../protocol';

const file = () => path.join(app.getPath('userData'), 'sllm_fallen.json');
let store: Record<string, Record<string, 'dormant' | 'awakened'>> | null = null;
function all(): Record<string, Record<string, 'dormant' | 'awakened'>> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, any>)) { const m: Record<string, 'dormant' | 'awakened'> = {}; for (const [i, st] of Object.entries(v || {})) if (/^\d{1,6}$/.test(i) && (st === 'dormant' || st === 'awakened')) m[i] = st; store[k] = m; } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'fallen', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'fallen', error: e }); } }

function onContacts(): void {
  const sid = ctx.curSaveId; if (!sid || terminal.sid !== sid) return;
  const s = (all()[safeKey(sid)] ??= {}); let ch = false;
  for (const c of terminal.all) {
    const st = c.type === 'fallen_empire' ? 'dormant' : c.type === 'awakened_fallen_empire' ? 'awakened' : null; if (!st) continue;
    const was = s[String(c.idx)]; if (was === st) continue;
    s[String(c.idx)] = st; ch = true;
    if (was === 'dormant' && st === 'awakened') awaken(c.idx, c.name);
  }
  if (ch) save();
}
function awaken(idx: number, name: string): void {
  let eth: string[] | null = null; try { eth = ctx.flagProv.ethicsFor(idx); } catch { eth = null; }
  const kind = fallenKind(eth, (ctx.profiles.get(idx) as { personality?: string } | undefined)?.personality), date = ctx.gameDate || '';
  const sig = awakenSignal(kind);
  const t = L(`가로챈 신호 — 몰락한 제국 「${name}」이(가) 긴 잠에서 깨어났다: 「${sig[0]}」`, `Intercepted signal — the Fallen Empire "${name}" has woken from its long slumber: "${sig[1]}"`);
  chronNoteWorld((date ? date + ' ' : '') + t, false);
  ctx.notify({ kind: 'news', title: L('⚠ 몰락한 제국 각성', '⚠ A Fallen Empire awakens'), body: t });
  void crisisSpecialEdition(date, `${date ? date + ' ' : ''}The ancient Fallen Empire "${name}" has awakened from its slumber and declared: "${sig[1]}". The galaxy fears what it will do next.`, { ko: `${name} 각성`, en: `${name} awakens` }).catch((e) => logDiagnostic('warn', 'fallen.special_failed', { error: String(e) }));
  logDiagnostic('info', 'fallen.awakened', { idx, kind });
}
export function registerFallen(router: LogRouter): void {
  router.on(SLOT.FALLEN, 'fallen', (m: SllmMessage) => { if (m.kind === 'CONTACT_END') { try { onContacts(); } catch (e) { logDiagnostic('warn', 'fallen.tick_failed', { error: String(e) }); } } });
}
