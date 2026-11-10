// 공동 대응 협약 연결(알파 11, 2026-10-25). 규칙: src/crisis-pact.ts. 모드: sllm_crisis_pact.txt.
// 맺기: 대화(chat.ts)의 crisis_pact 제안을 플레이어가 수락하면 makeCommand → ACK. 배신 확인·감사: emotions-app(통신 목록마다). 끝: 위기가 모두 끝나면(crisis-app setCrisisCalm).
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { enqueue, sendConsole, sendAndWait } from '../app/game-link';
import { logDiagnostic } from '../diagnostics';
import { safeKey } from '../music';
import { L } from '../i18n-pick';
import { chronNote } from './chronicle-app';
import { crisisView } from './crisis-app';
import { type PactSave, emptyPacts, sanitizePacts, hasPact, canPact, addPact, breakPact, endAll, makeCommand, endCommand, pactLine } from '../crisis-pact';
import type { Emotions } from '../emotions';

const file = () => path.join(app.getPath('userData'), 'sllm_crisis_pacts.json');
let store: Record<string, PactSave> | null = null;
function all(): Record<string, PactSave> {
  if (store) return store; store = {};
  try { const o = JSON.parse(fs.readFileSync(file(), 'utf8')); if (o && typeof o.saves === 'object') for (const [k, v] of Object.entries(o.saves as Record<string, unknown>)) store[k] = sanitizePacts(v); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'crisis_pacts', error: e }); }
  return store;
}
function save(): void { try { const f = file(), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, saves: all() }), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'crisis_pacts', error: e }); } }
const cur = (): PactSave | null => { const sid = ctx.curSaveId; return sid ? (all()[safeKey(sid)] ??= emptyPacts()) : null; };
const sendEnd = (idx: number) => { void enqueue(() => sendConsole(endCommand(idx))).catch((e) => logDiagnostic('warn', 'pact.end_failed', { idx, error: String(e) })); };

export const pactWith = (idx: number): boolean => { const s = cur(); return !!s && hasPact(s, idx); };
/** 대화 프롬프트 한 줄(main.ts withLore, 일반 제국만). */
export function pactTalk(idx: number, o: { type?: string; war?: boolean; score: number; e?: Emotions }): string {
  const s = cur(); if (!s) return '';
  if (hasPact(s, idx)) return pactLine('active');
  return canPact(s, idx, { hostile: crisisView().hostile, type: o.type, war: o.war }) ? pactLine('offer', { score: o.score, e: o.e }) : '';
}
export function pactAllowed(idx: number, o: { type?: string; war?: boolean }): boolean { const s = cur(); return !!s && canPact(s, idx, { hostile: crisisView().hostile, type: o.type, war: o.war }); }

/** 플레이어가 수락함(chat.ts accept). */
export async function makePact(idx: number, name: string): Promise<{ outcome: string; text: string }> {
  const s = cur(); if (!s) return { outcome: 'fail', text: L('세이브를 몰라 협약을 맺지 못했습니다.', 'The save is unknown, so the pact could not be made.') };
  const o = await enqueue(() => sendAndWait((req) => makeCommand(req, idx)));
  if (o !== 'ok') return { outcome: o, text: o === 'timeout' ? L('게임에서 응답이 없습니다. 연결 상태를 확인해 주세요.', 'No response from the game. Check the connection.') : L('실패: 상대를 찾지 못했거나 이미 전쟁 중입니다.', 'Failed: the empire was not found or is at war with us.') };
  addPact(s, idx, name, ctx.gameDate || ''); save();
  chronNote(idx, L('은하 위기에 맞서 공동 대응 협약을 맺었다', 'Signed a joint crisis response pact against the galactic crisis'));
  logDiagnostic('info', 'pact.made', { idx });
  return { outcome: 'ok', text: L(`${name}과(와) 공동 대응 협약을 맺었습니다. 위기가 끝날 때까지 서로의 호감 +30, 양쪽 함선 화력 +5%.`, `A joint crisis response pact with ${name} is in force: +30 mutual opinion and +5% ship fire rate for both until the crisis ends.`) };
}
/** 협약 중 전쟁(emotions-app 이 통신 목록에서 발견). 협약을 깨고 true. 원한은 emotions-app 이 넣는다. */
export function betrayed(idx: number): boolean {
  const s = cur(); if (!s) return false;
  const p = breakPact(s, idx); if (!p) return false;
  save(); sendEnd(idx);
  const t = L(`${p.name}과(와) 전쟁이 벌어져 공동 대응 협약이 깨졌습니다.`, `War broke out with ${p.name}, and the joint crisis response pact is broken.`);
  chronNote(idx, (ctx.gameDate ? ctx.gameDate + ' ' : '') + t); ctx.notify({ kind: 'news', title: L('협약 파기', 'Pact broken'), body: t });
  logDiagnostic('info', 'pact.broken', { idx });
  return true;
}
/** 함께한 제국 이름(위기 극복 기록용). */
export function pactAllies(): string[] { return cur()?.allies.map((a) => a.name).filter(Boolean) ?? []; }
/** 적대 위기가 모두 끝남. */
export function endAllPacts(): void {
  const s = cur(); if (!s || (!s.pacts.length && !s.allies.length)) return;
  const { ended } = endAll(s); save();
  for (const p of ended) { sendEnd(p.idx); chronNote(p.idx, L('은하 위기가 끝나 공동 대응 협약을 마쳤다', 'The galactic crisis is over, and the joint crisis response pact has ended')); }
  if (ended.length) ctx.notify({ kind: 'info', title: L('협약 종료', 'Pacts ended'), body: L(`위기가 끝나 공동 대응 협약 ${ended.length}건을 마쳤습니다: ${ended.map((p) => p.name).join(', ')}`, `With the crisis over, ${ended.length} joint crisis response pact${ended.length === 1 ? '' : 's'} ended: ${ended.map((p) => p.name).join(', ')}`) });
  logDiagnostic('info', 'pact.ended_all', { n: ended.length });
}
