// 정기 송금(2026-11-09 사용자: 「매달 확인이 필요 없는 것은 바뀔 때만」 — 회랑의 삼파전 방식을 본편에). 순수 규칙.
// 예전: 외교 거래 매달 지급·반란군 후원을 앱이 매달 콘솔로 한 건씩 보냈다(약정·자원마다 한 번).
// 지금: 맺을 때 한 번 모드에 「칸」을 적어 두면(sllm_mt_set) 모드가 매달 직접 보내고, 못 냈을 때·끊겼을 때·다 냈을 때만 줄(MT)을 남긴다.
// 모드: tester-mod/common/scripted_effects/sllm_mtransfer.txt(생성기 SLLM_Dev_20261016/tools/gen-mtransfer.py) · 앱: src/features/mtransfer-hub.ts
import { wrapForPlayer } from './protocol';

/** 자원 번호(모드 sllm_mt<K>_r 와 같아야 한다). 6 = 에너지와 광물을 같은 양씩 함께(둘 다 있어야 보냄). */
export const MT_RES = { energy: 1, minerals: 2, food: 3, alloys: 4, consumer_goods: 5, energy_minerals: 6 } as const;
export type MtRes = keyof typeof MT_RES;
/** 어느 기능의 칸인가(모드 sllm_mt<K>_o). */
export const MT_OWNER = { deal: 1, rebel: 2, hoi: 3 } as const; // 3 = 전쟁 중인 나라 물자 지원(hoi-app, 2026-11-09)
export type MtOwner = (typeof MT_OWNER)[keyof typeof MT_OWNER];
/** 연속으로 못 내면 끊기는 달 수(모드가 판정 — 바꾸려면 생성기도). */
export const MT_MISS_LIMIT = 2;

export interface MtSlot { tid: number; res: MtRes; payUs: boolean; amt: number; left: number; g: number; o: MtOwner }
const int = (n: unknown): n is number => Number.isSafeInteger(n);
function check(req: number, tid: number, g: number, o: number): void {
  if (!int(req) || req < 1 || !int(tid) || tid < 1 || !int(g) || g < 1 || g > 999999 || !(o === 1 || o === 2 || o === 3)) throw new Error('INVALID_MT');
}
/** 칸 적기. keep = 이미 같은 칸이 있으면 그대로 둔다(불러온 세이브의 남은 달을 믿음). checkOnly = 확인만(없으면 만들지 않음 — 세이브를 불러온 뒤, 2026-11-09).
 *  응답 MTSET st: 1 적음 · 2 칸 모자람 · 3 이미 있음(keep) · 4 없음(check) · 0 상대 없음. */
export function mtSetCommand(req: number, s: MtSlot, keep: boolean, checkOnly = false): string {
  check(req, s.tid, s.g, s.o);
  if (!(s.res in MT_RES) || !int(s.amt) || s.amt < 1 || s.amt > 1e6 || !int(s.left) || s.left < 1 || s.left > 1200) throw new Error('INVALID_MT');
  return wrapForPlayer(`sllm_mt_set = { REQ = ${req} TID = ${s.tid} R = ${MT_RES[s.res]} D = ${s.payUs ? 1 : 2} A = ${s.amt} L = ${s.left} G = ${s.g} O = ${s.o} KEEP = ${keep || checkOnly ? 'yes' : 'no'} CHECK = ${checkOnly ? 'yes' : 'no'} }`);
}
/** 묶음(g) 칸 모두 지우기 — 약속을 끝내거나 깰 때. 응답 MTSET st 1. */
export function mtUnsetCommand(req: number, tid: number, g: number, o: MtOwner): string {
  check(req, tid, g, o);
  return wrapForPlayer(`sllm_mt_unset = { REQ = ${req} TID = ${tid} G = ${g} O = ${o} }`);
}

export type MtEv = 'short' | 'stop' | 'end';
export interface MtEvent { ev: MtEv; sid: string; tid: number; g: number; o: number; res: MtRes | null; payUs: boolean; miss: number; date: string }
const n = (v: unknown): number => { const x = Number(String(v ?? '').replace(/^\\/, '').replace(/,/g, '')); return Number.isFinite(x) ? Math.round(x) : NaN; };
const RES_BY_CODE = Object.fromEntries(Object.entries(MT_RES).map(([k, v]) => [v, k])) as Record<number, MtRes>;
/** SLLM:MT 줄 → 사건. 모양이 틀리면 null. */
export function parseMt(kv: Record<string, unknown>): MtEvent | null {
  const ev = String(kv.ev ?? '').replace(/^\\/, '').trim();
  if (ev !== 'short' && ev !== 'stop' && ev !== 'end') return null;
  const tid = n(kv.tid), g = n(kv.g), o = n(kv.o), d = n(kv.d);
  if (!(tid > 0) || !(g > 0) || !(o === 1 || o === 2 || o === 3) || !(d === 1 || d === 2)) return null;
  const miss = n(kv.miss);
  return { ev, sid: String(kv.sid ?? '').replace(/^\\/, '').trim(), tid, g, o, res: RES_BY_CODE[n(kv.r)] ?? null, payUs: d === 1, miss: Number.isFinite(miss) ? Math.max(0, miss) : 0, date: String(kv.date ?? '').replace(/^\\/, '').trim() };
}
/** 다음 묶음 번호(이미 쓴 것 중 가장 큰 것 + 1). */
export function nextG(used: Array<number | undefined>): number { let m = 0; for (const g of used) if (int(g) && g > m) m = g; return Math.min(999999, m + 1); }
