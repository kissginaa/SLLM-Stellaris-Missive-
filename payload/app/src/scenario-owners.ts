// 시나리오 성계 주인 장부(2026-11-08 사용자: 「세이브를 읽는 데 자원이 계속 든다」 → 세이브 대신 로그로).
// 시나리오 모드(sllm_cr_own_* , common/scripted_effects/sllm_cr_effects.txt)가 찍는 줄:
//   SCNOC  sid c sd rv ix name — 나라(우리 번호 c · 자리 1 얼라이언스 2 제국 3 회랑 0 그 밖 · 반란국·괴뢰국이면 옛 귀족 거점 rv · SLLM 제국 번호 ix)
//   SCNOWN sid m c w date      — 성계(지도 번호 m)의 주인 나라 c(0 = 주인 없음) · w 회랑 빈 거점의 거점 행성을 가진 나라(0 없음, 거점 아니면 -1, 2026-11-08)
//   SCNOWNBEG / SCNOWNEND      — 전체 보고(불러온 직후 한 번). END 가 오면 그 장부를 「다 갖춤(full)」으로 바꾼다.
// 매달 오는 줄은 바뀐 성계만이다. 줄마다 날짜를 같이 둬서, 세이브(날짜)와 섞을 때 더 새것을 쓴다.
export interface OwnC { sd: number; rv: number; ix: number; name: string }
/** sys: 지도 번호 → [주인 나라, 날짜, 회랑 빈 거점이면 거점 행성을 가진 나라(0 없음) · 거점 아니면 -1] */
export interface OwnBook { date: string; full: boolean; sys: Record<string, [number, string, number]>; cc: Record<string, OwnC> }

const clean = (v: unknown) => String(v ?? '').replace(/^\\+/, '').trim();
const int = (v: unknown, d = 0) => { const n = Number(clean(v).replace(/,/g, '')); return Number.isFinite(n) ? Math.round(n) : d; };
/** 게임 날짜 「2301.03.01」 → 23010301(비교용). 못 읽으면 0. */
export function dateNum(d: string): number { const m = /^(\d{1,5})\.(\d{1,2})\.(\d{1,2})/.exec(d || ''); return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0; }
const MAX_SYS = 2000, MAX_C = 400;

export const newOwnBook = (): OwnBook => ({ date: '', full: false, sys: {}, cc: {} });
/** 저장 파일에서 읽은 장부 다듬기. */
export function fixOwnBook(v: unknown): OwnBook | null {
  if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>, b = newOwnBook();
  b.date = clean(o.date).slice(0, 16); b.full = !!o.full;
  for (const [k, x] of Object.entries((o.sys as Record<string, unknown>) ?? {}).slice(0, MAX_SYS)) { if (!Array.isArray(x)) continue; const m = int(k, -1), c = int(x[0], -1); if (m >= 0 && c >= 0) b.sys[String(m)] = [c, clean(x[1]).slice(0, 16), int(x[2], -1)]; }
  for (const [k, x] of Object.entries((o.cc as Record<string, unknown>) ?? {}).slice(0, MAX_C)) { if (!x || typeof x !== 'object') continue; const c = int(k, -1), y = x as Record<string, unknown>; if (c > 0) b.cc[String(c)] = { sd: int(y.sd), rv: int(y.rv), ix: int(y.ix), name: clean(y.name).slice(0, 80) }; }
  return b;
}

/** 줄을 장부에 넣는다. 전체 보고는 END 가 올 때까지 따로 모았다가 통째로 바꾼다. 장부가 바뀌었으면 true. */
export class OwnCollector {
  private open = new Map<string, OwnBook>();
  feed(kind: string, sid: string, kv: Record<string, string>, book: OwnBook): boolean {
    if (clean(kv.sc) !== 'corridor' || !sid) return false;
    const date = clean(kv.date).slice(0, 16), full = this.open.get(sid);
    if (kind === 'SCNOWNBEG') { this.open.set(sid, { ...newOwnBook(), date, cc: { ...book.cc } }); return false; }
    if (kind === 'SCNOC') {
      const c = int(kv.c, -1); if (c <= 0) return false;
      const x: OwnC = { sd: int(kv.sd), rv: int(kv.rv), ix: int(kv.ix), name: clean(kv.name).slice(0, 80) };
      if (Object.keys(book.cc).length < MAX_C || book.cc[String(c)]) book.cc[String(c)] = x;
      if (full) full.cc[String(c)] = x;
      return true;
    }
    if (kind === 'SCNOWN') {
      const m = int(kv.m, -1), c = int(kv.c, -1), w = kv.w === undefined ? -1 : int(kv.w, -1); if (m < 0 || c < 0) return false;
      if (full) { if (Object.keys(full.sys).length < MAX_SYS) full.sys[String(m)] = [c, date, w]; return false; }
      const old = book.sys[String(m)]; if (old && dateNum(old[1]) > dateNum(date)) return false; // 더 새 줄이 이미 있음
      if (Object.keys(book.sys).length < MAX_SYS || old) book.sys[String(m)] = [c, date, w];
      if (dateNum(date) > dateNum(book.date)) book.date = date;
      return true;
    }
    if (kind === 'SCNOWNEND') {
      if (!full) return false; this.open.delete(sid);
      book.sys = full.sys; book.cc = full.cc; book.full = Object.keys(full.sys).length > 0; book.date = full.date || date;
      return true;
    }
    return false;
  }
}
/** 이 나라 번호의 주인을 화면 색으로(자리 나라는 고정색, 그 밖은 번호로 고른 색). */
export function ownColor(c: number, sd: number): string {
  if (sd === 1) return '#3f6fe0'; if (sd === 2) return '#d83a3a'; if (sd === 3) return '#d9a640';
  const h = (c * 137.508) % 360; return `hsl(${Math.round(h)}, 45%, 52%)`;
}
