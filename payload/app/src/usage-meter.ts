// 한 달 사용량(2026-11-09 사용자: 「바뀔 때만」 작업이 실제로 얼마나 줄였는지 숫자로). electron 없이 쓰는 순수 모듈.
// 세는 것: 게임에 보낸 콘솔 명령(효과 이름별) · 세이브 통째 읽기(깃발 공급자 flags · 은하 지도 galaxy — 횟수와 걸린 시간).
// 게임 달이 바뀔 때마다(features/usage-app.ts, 월간 상황) 진단 기록 usage.month 한 줄로 남기고 0 으로 돌린다.

/** 콘솔 명령의 이름: 처음 나오는 `sllm_… =` 효과(세이브 번호·제국 번호 같은 변수 이름은 뺀다). 없으면 'other'. */
export function effectKey(cmd: string): string {
  const re = /\b(sllm_[a-z0-9_]+)\s*=/g;
  for (let m = re.exec(cmd); m; m = re.exec(cmd)) { if (!/^sllm_(save_id|idx|sys|lid|fo_fid)$/.test(m[1])) return m[1].slice(0, 48); }
  return 'other';
}

export type SaveReadKind = 'flags' | 'galaxy';
export interface UsageMonth { month: string; console: number; top: string[]; flagsReads: number; flagsMs: number; galaxyReads: number; galaxyMs: number; failed: number }

export class UsageMeter {
  private cmds = new Map<string, number>();
  private total = 0;
  private reads: Record<SaveReadKind, { n: number; ms: number }> = { flags: { n: 0, ms: 0 }, galaxy: { n: 0, ms: 0 } };
  private failed = 0;
  /** 콘솔 명령 하나를 보냈다. */
  noteConsole(cmd: string): void {
    this.total++; const k = effectKey(cmd);
    if (this.cmds.has(k) || this.cmds.size < 200) this.cmds.set(k, (this.cmds.get(k) ?? 0) + 1);
  }
  /** 세이브를 통째로 한 번 읽었다(ok = 읽기에 성공). */
  noteSaveRead(kind: SaveReadKind, ms: number, ok = true): void {
    if (!ok) { this.failed++; return; }
    const r = this.reads[kind]; r.n++; r.ms += Math.max(0, Math.round(ms));
  }
  /** 이번 달 몫을 꺼내고 0 으로 돌린다. 아무 일도 없었으면 null. */
  flush(month: string): UsageMonth | null {
    const r = this.reads, empty = this.total === 0 && r.flags.n === 0 && r.galaxy.n === 0 && this.failed === 0;
    const out: UsageMonth = { month, console: this.total, top: [...this.cmds].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([k, n]) => `${k}:${n}`),
      flagsReads: r.flags.n, flagsMs: r.flags.ms, galaxyReads: r.galaxy.n, galaxyMs: r.galaxy.ms, failed: this.failed };
    this.cmds.clear(); this.total = 0; this.failed = 0; this.reads = { flags: { n: 0, ms: 0 }, galaxy: { n: 0, ms: 0 } };
    return empty ? null : out;
  }
}

/** 앱 전체가 함께 쓰는 하나. */
export const usage = new UsageMeter();
