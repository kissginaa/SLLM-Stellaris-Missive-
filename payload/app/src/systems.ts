// 성계 번호표(알파 11, 2026-10-25, 사용자 결정 「1번도 하자」). 순수 규칙. 앱: src/features/systems-app.ts, 모드: tester-mod/common/scripted_effects/sllm_systems.txt.
// 모드가 성계마다 번호를 붙여 SYS 줄로 보내면 세이브별 표로 저장한다. 대화에서 성계 이름이 나오면 그 번호로 지도 이름표를 1년 세운다. LLM 호출 없음.
import { wrapForPlayer } from './protocol';

export interface SysTable { scanned: string; names: Record<string, string> } // 번호 → 이름
export interface SysMark { n: number; kind: 'talk'; until: number } // until = 게임 날짜 dayNo
export const SYS = { rescanDays: 360, markDays: 360, maxMarks: 12, perTurn: 2, minLen: 3 } as const;

export function scanCommand(req: number): string {
  if (!Number.isSafeInteger(req) || req < 1) throw new Error('INVALID_REQ');
  return wrapForPlayer(`sllm_probe_systems = { REQ = ${req} }`);
}
export function markCommand(n: number, kind: SysMark['kind'], on: boolean): string {
  if (!Number.isSafeInteger(n) || n < 1 || kind !== 'talk') throw new Error('INVALID_MARK');
  return wrapForPlayer(`${on ? 'sllm_mark_sys' : 'sllm_unmark_sys'} = { N = ${n} KIND = ${kind} }`);
}
/** 다시 읽을 때가 됐는지(표가 없거나 1년이 지났거나 되감은 세이브). */
export function needScan(t: SysTable | undefined, now: number, dayOf: (d: string) => number | null): boolean {
  if (!t || !Object.keys(t.names).length) return true;
  const s = dayOf(t.scanned); return s === null || now < s || now - s >= SYS.rescanDays;
}

const isLetter = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
const isHangul = (c: string | undefined) => !!c && /[가-힣]/.test(c);
/** 글에 나온 성계 번호들(긴 이름 먼저, 겹치지 않게). 앞은 글자 경계, 뒤는 라틴이면 경계·한글이면 조사 허용. */
export function findMentions(text: string, t: SysTable | undefined, max: number = SYS.perTurn): number[] {
  if (!t || !text) return [];
  const low = text.toLowerCase(), used: [number, number][] = [], out: number[] = [];
  const list = Object.entries(t.names).filter(([, nm]) => [...nm.trim()].length >= SYS.minLen).sort((a, b) => b[1].length - a[1].length);
  for (const [n, nm] of list) {
    const key = nm.trim().toLowerCase(); let from = 0;
    while (out.length < max) {
      const i = low.indexOf(key, from); if (i < 0) break; from = i + 1;
      const end = i + key.length, before = low[i - 1], after = low[end];
      if (isLetter(before)) continue;
      if (isLetter(after) && !(isHangul(key[key.length - 1]) && isHangul(after))) continue;
      if (used.some(([a, b]) => i < b && end > a)) continue;
      used.push([i, end]); if (!out.includes(Number(n))) out.push(Number(n)); break;
    }
    if (out.length >= max) break;
  }
  return out;
}
export function sanitizeSysTable(v: unknown): SysTable | undefined {
  const o = v as Record<string, any>; if (!o || typeof o !== 'object' || typeof o.scanned !== 'string' || !o.names || typeof o.names !== 'object') return undefined;
  const names: Record<string, string> = {};
  for (const [k, nm] of Object.entries(o.names as Record<string, unknown>)) if (/^\d{1,6}$/.test(k) && typeof nm === 'string' && nm.trim()) names[k] = nm.slice(0, 80);
  return { scanned: o.scanned.slice(0, 12), names };
}
export function sanitizeMarks(v: unknown): SysMark[] {
  return Array.isArray(v) ? v.filter((m) => m && Number.isSafeInteger(m.n) && m.n > 0 && m.kind === 'talk' && Number.isFinite(m.until)).slice(-SYS.maxMarks).map((m) => ({ n: m.n, kind: 'talk' as const, until: m.until })) : [];
}
