// 엔클레이브·캐러밴 소식 연결(알파 11, 2026-10-25): 월간 상황의 ENCLAVE 줄을 세이브마다 기억하고, 바뀐 것만 알림·연대기·호외 후보로 올린다.
// 규칙: src/enclave-events.ts. AI 를 직접 부르지 않는다(호외는 media.noteExtra 가 연 상한 안에서만 낸다).
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { chronNoteWorld } from './chronicle-app';
import { noteExtra } from './media';
import { onGameSnapshot } from './gamestate-app';
import type { StateSnapshot } from '../gamestate';
import { type EnclaveSeen, enclaveChanges, enclaveText } from '../enclave-events';

const file = () => path.join(app.getPath('userData'), 'sllm_enclave.json');
let store: { saves: Record<string, EnclaveSeen> } | null = null;
function all() {
  if (store) return store;
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); store = { saves: o && typeof o.saves === 'object' && o.saves ? o.saves : {} }; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'enclave', error: e }); store = { saves: {} }; }
  return store;
}
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'enclave', error: e }); } }

export function onEnclaveSnapshot(snap: StateSnapshot): void {
  if (!snap.sid || snap.sid !== ctx.curSaveId || !snap.enclave) return; // 옛 모드(ENCLAVE 줄 없음)면 아무것도 하지 않는다
  const k = safeKey(snap.sid), prev = all().saves[k], cur = { ...snap.enclave }, date = snap.date || ctx.gameDate;
  const ch = enclaveChanges(prev, cur);
  all().saves[k] = cur;
  if (!prev || prev.fest !== cur.fest || prev.outrage !== cur.outrage || prev.cara !== cur.cara) save();
  if (ch.festStart) {
    ctx.notify({ kind: 'news', title: enclaveText.festStartTitle(), body: enclaveText.festStartBody() });
    chronNoteWorld(enclaveText.festStart(date), true); noteExtra('festival', date, enclaveText.festStart(date));
  }
  if (ch.outrage) { chronNoteWorld(enclaveText.outrage(date), true); noteExtra('festival_outrage', date, enclaveText.outrage(date)); }
  if (ch.festEnd) chronNoteWorld(enclaveText.festEnd(date), true);
  for (const n of ch.caravans) { ctx.notify({ kind: 'info', title: enclaveText.caravanTitle(), body: enclaveText.caravanBody(n) }); chronNoteWorld(enclaveText.caravan(date, n), true); }
  if (ch.festStart || ch.festEnd || ch.outrage || ch.caravans.length) logDiagnostic('info', 'enclave.changed', { ...ch });
}
export function registerEnclave(): void { onGameSnapshot(onEnclaveSnapshot); }
