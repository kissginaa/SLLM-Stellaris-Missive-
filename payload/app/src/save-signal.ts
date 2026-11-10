// 세이브 다시 읽기 신호 — 순수 규칙(2026-11-09, 회랑 방식 — 「매달 확인이 필요 없는 것은 바뀔 때만」). 앱 쪽: features/save-signal-app.ts · 읽기: flags.ts(FlagProvider.markStale).
// 예전: 자동 저장이 될 때마다 세이브 전체를 풀어 깃발·윤리·초상화·통치자·국시를 다시 읽었다(작업 스레드, 후반 세이브는 1~2초·수백 MB).
// 지금: 들고 있는 것을 쓰고, 이미 오는 모드 줄 가운데 「그 값이 바뀌었다」는 것이 오면 다음 자동 저장을 한 번 읽는다. 모드는 바꾸지 않는다.
//   LOADED(세이브 불러옴) · NEWS kind=ruler(어느 제국이든 통치자가 바뀜) · EVT kind=first_contact(두 제국이 처음 만남)
//   월간 상황에서 우리 제국 윤리·통치 체제가 바뀜 · 들고 있는 세이브가 12달보다 오래됨(놓친 것 바로잡기)
import { monthsApart } from './alarm';

/** 들고 있는 세이브가 이만큼(게임 달) 오래되면 한 번 다시 읽는다. */
export const SAVE_REREAD_MONTHS = 12;

const v = (x: unknown): string => String(x ?? '').replace(/^\\/, '').trim();

/** 로그 줄 하나가 세이브를 다시 읽을 이유인가. 이유 이름(진단용) 또는 ''. */
export function saveSignalOf(m: { kind: string; kv: Record<string, unknown> }): string {
  if (m.kind === 'LOADED') return 'loaded';
  if (m.kind === 'NEWS' && v(m.kv.kind) === 'ruler') return 'ruler';
  if (m.kind === 'EVT' && v(m.kv.kind) === 'first_contact') return 'first_contact';
  return '';
}
export interface GovMark { sid: string; empireEth?: number; authority?: number }
/** 월간 상황 두 개 사이에 우리 정부(윤리·통치 체제)가 바뀌었나. 앞의 것이 없거나 다른 세이브면 false. */
export function ourGovChanged(prev: GovMark | null, cur: GovMark): boolean {
  if (!prev || prev.sid !== cur.sid) return false;
  return (prev.empireEth !== undefined && cur.empireEth !== undefined && prev.empireEth !== cur.empireEth)
    || (prev.authority !== undefined && cur.authority !== undefined && prev.authority !== cur.authority);
}
/** 들고 있는 세이브가 너무 오래됐나(날짜를 모르면 false — 처음 읽기는 FlagProvider 가 알아서 한다). */
export function saveTooOld(held: string, now: string): boolean {
  if (!held || !now) return false;
  const d = monthsApart(held, now);
  return Number.isFinite(d) && d >= SAVE_REREAD_MONTHS && d < 999;
}
