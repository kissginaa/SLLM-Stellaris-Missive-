import { L } from './i18n-pick';
// A-16: 강제 통과·취소 전에 앱(본체)이 의회 집계를 다시 확인한다. 2026-10-15 추가팀.
// 회의 창(ui/council.html)과 같은 규칙으로 명단·가중치·입장을 들고 있다가, 강제 결정 요청이 오면 80%를 다시 계산한다.
// 화면 쪽이 조작돼도(F-05 같은 구멍) 미달이면 게임에 아무것도 보내지 않게 하는 마지막 방어선. 순수 모듈(Electron 없음).
// 연결(6단계): 회의 창을 열 때 open(), councilDebate 결과마다 noteDebate(), councilForce 맨 앞에서 check().
// 화면 규칙과 어긋나지 않는지는 selftest가 council.html의 실제 계산 코드와 비교한다.

/** 강제 결정에 필요한 비율(%) — council.html FORCE 와 같음. 2026-11-04 사용자 결정: 언제든 → 찬성(통과)·반대(부결)가 60% 이상일 때만. */
export const FORCE_PCT = 60;
/**
 * 플레이어가 은하공동체 비회원일 때 붙는 가상 의석(전체 가중치의 10%)을 집계에 넣을지.
 * F-15 후속으로 게임 확인 뒤 사용자가 정한다. 정하기 전에는 화면과 같은 규칙(넣음). 바꿀 곳은 여기 한 곳.
 */
export const COUNT_VIRTUAL_SEAT = true;
const VIRTUAL_SHARE = 0.1;

export interface CouncilMemberIn { idx: number; name: string; weight: number; ai: boolean; pos?: number }
export interface CouncilOpenInfo { key: string; demo?: boolean; reliable?: boolean; members: CouncilMemberIn[] }
export interface Seat { idx?: number; name: string; w: number; p: number; player?: boolean; virtual?: boolean }
export type Dir = 'f' | 'a';
export interface Tally { f: number; a: number; u: number }
export type DevVote = { vote: 'normal' | 'for' | 'against'; percent: number } | null;
export type CheckResult = { ok: true; pct: Tally } | { ok: false; reason: string; pct?: Tally };

/** council.html 의 hash 와 같은 FNV-1a(이름으로 만든 가상 입장) */
export function councilHash(str: string): number { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const stanceOf = (p: number): 'f' | 'a' | 'u' => (p >= 25 ? 'f' : p <= -25 ? 'a' : 'u');

/** 회의 창이 실제 안건으로 여는 경우와 같은 조건·같은 값으로 의석을 만든다(council.html 117~120줄). 실제 안건이 아니면 null. */
export function initialSeats(info: CouncilOpenInfo | null | undefined): Seat[] | null {
  const real = info && !info.demo && Array.isArray(info.members) && info.members.length >= 2 ? info.members : null;
  if (!real) return null;
  const anyPos = real.some((mb) => mb.ai !== false && (mb.pos ?? 0) > 0);
  const M: Seat[] = real.map((mb) => {
    const h = councilHash(mb.name + '|' + (info!.key || '')) % 181 - 90;
    return { idx: mb.idx, name: mb.name, w: Math.round((mb.weight || 1) * 10) / 10, p: mb.ai === false ? 0 : (mb.pos === 1 ? 90 : mb.pos === 2 ? -90 : mb.pos === 3 ? 0 : anyPos ? 0 : h), player: mb.ai === false };
  });
  if (!M.some((m) => m.player)) M.push({ name: L('플레이어 제국 (비회원 가상 의석)', 'Player empire (virtual non-member seat)'), w: Math.round(M.reduce((a, m) => a + m.w, 0) * VIRTUAL_SHARE * 10) / 10 || 1, p: 0, player: true, virtual: true });
  return M;
}

/** 찬성·반대·기권 비율(%). 플레이어는 미는 방향으로 투표한다(council.html stOf·tallyPct). */
export function tally(seats: Seat[], dir: Dir, countVirtual = COUNT_VIRTUAL_SEAT): Tally {
  const sum = { f: 0, a: 0, u: 0 };
  for (const m of seats) { if (m.virtual && !countVirtual) continue; const st = m.player ? dir : stanceOf(m.p); sum[st] += m.w; }
  const t = sum.f + sum.a + sum.u || 1;
  return { f: sum.f / t * 100, a: sum.a / t * 100, u: sum.u / t * 100 };
}

/** 개발자 고정 집계(council.html tallyPct 의 fixedVotes 분기) */
export function devTally(dev: DevVote): Tally | null {
  if (!dev || (dev.vote !== 'for' && dev.vote !== 'against')) return null;
  const n = Number(dev.percent), p = Number.isFinite(n) ? Math.max(80, Math.min(100, Math.round(n))) : 85;
  return dev.vote === 'for' ? { f: p, a: 100 - p, u: 0 } : { f: 100 - p, a: p, u: 0 };
}

/** 설득 변화 적용(council.html 292~293줄): 소수 한 자리 반올림, -100~100 */
export function applyDelta(p: number, delta: unknown): number {
  const add = Number.isFinite(Number(delta)) ? Number(delta) : 0;
  return Math.max(-100, Math.min(100, Math.round((p + add) * 10) / 10));
}

interface Open { sid: string; key: string; reliable: boolean; seats: Seat[]; dir: Dir }

/** 지금 열린 회의 하나의 상태(메모리만, 회의 창을 닫으면 clear). */
export class CouncilState {
  private cur: Open | null = null;
  /** 회의 창을 열 때(또는 "정보 다시 읽기" 뒤 다시 열 때). 실제 안건이 아니면 상태를 비운다. */
  open(sid: string, info: CouncilOpenInfo | null | undefined): void {
    const seats = initialSeats(info);
    this.cur = seats && info ? { sid, key: info.key || '', reliable: info.reliable === true, seats, dir: 'f' } : null;
  }
  clear(): void { this.cur = null; }
  /** 토론 한 번의 결과: 플레이어가 민 방향과 의원별 설득 변화(id = 의석 순서, councilDebate 와 같은 번호). 개발자 고정 집계 중이면 화면처럼 변화를 더하지 않는다. */
  noteDebate(sid: string, key: string, dir: Dir, replies: { id: unknown; delta?: unknown }[], devFixed = false): boolean {
    const c = this.cur; if (!c || c.sid !== sid || c.key !== key) return false;
    c.dir = dir === 'a' ? 'a' : 'f';
    for (const r of replies) { const m = c.seats[Number(r.id)]; if (!m || m.player) continue; m.p = applyDelta(m.p, devFixed ? 0 : r.delta); }
    return true;
  }
  /** 지금 상태(진단·selftest 용 복사본) */
  view(): { sid: string; key: string; dir: Dir; seats: Seat[] } | null { const c = this.cur; return c ? { sid: c.sid, key: c.key, dir: c.dir, seats: c.seats.map((s) => ({ ...s })) } : null; }
  /** 강제 결정 직전 확인. 통과(pass=true)는 찬성, 취소(pass=false)는 반대가 80% 이상이어야 한다. 모르는 회의·불완전한 정보면 보내지 않는다. */
  check(sid: string, key: string, pass: boolean, dev: DevVote = null): CheckResult {
    const c = this.cur;
    if (!c || c.sid !== sid || c.key !== key) return { ok: false, reason: L('앱이 이 회의의 집계를 갖고 있지 않습니다. 회의 창을 다시 열어 주세요.', 'The app has no tally for this meeting. Please reopen the council window.') };
    // 2026-11-04 사용자 결정: 강제 통과는 찬성, 강제 부결은 반대가 60% 이상일 때만(2026-10-29의 「언제든」을 조건부로). 정보 완전성 잠금은 여전히 없다.
    const pct = devTally(dev) ?? tally(c.seats, c.dir), got = pass ? pct.f : pct.a;
    if (got < FORCE_PCT) return { ok: false, pct, reason: L(`강제 ${pass ? '통과' : '부결'}에는 ${pass ? '찬성' : '반대'} ${FORCE_PCT}% 이상이 필요합니다(지금 ${Math.round(got)}%).`, `Forcing ${pass ? 'passage' : 'rejection'} needs at least ${FORCE_PCT}% ${pass ? 'for' : 'against'} (now ${Math.round(got)}%).`) };
    return { ok: true, pct };
  }
}
