// 스텔라리스 세이브(gamestate) 텍스트 읽기(2026-11-03, 세이브 읽기 1단계). 순수 함수 — 작업 스레드(worker.ts)에서 쓴다.
// 형식: Clausewitz 텍스트(key=value, key={...}, 같은 키 반복, 이름 없는 목록). 후반 세이브는 압축을 풀면 80MB 넘게 커서
// 맨 위 덩어리 위치만 한 번 훑고(index), 필요한 덩어리만 객체로 바꾼다(parseRange). 85MB 기준 훑기 약 0.25초.

export type CwValue = string | CwObject | CwValue[];
export interface CwObject { [k: string]: CwValue }
/** 같은 키가 여러 번 나오면 배열로 모은다(이 표시가 붙은 배열). */
export const REP = Symbol('rep');

const SP = 0x20, EQ = 0x3d, LB = 0x7b, RB = 0x7d, QT = 0x22, BS = 0x5c, HASH = 0x23, NL = 0x0a, LT = 0x3c, GT = 0x3e;

/** 맨 위(깊이 0) 키 → [시작, 끝) 바이트. 덩어리는 '{' 부터 짝 '}' 까지, 값은 값 자리. 같은 키가 여럿이면 첫 것. */
export function indexTop(buf: Uint8Array): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>(), n = buf.length; let i = 0, depth = 0, cur: { k: string; s: number } | null = null;
  const name = (a: number, b: number) => { let s = ''; for (let x = a; x < b; x++) s += String.fromCharCode(buf[x]); return s; };
  while (i < n) {
    const c = buf[i];
    if (c === QT) { i++; while (i < n && buf[i] !== QT) { if (buf[i] === BS) i++; i++; } i++; continue; }
    if (c === HASH) { while (i < n && buf[i] !== NL) i++; continue; }
    if (c === LB) { if (depth === 0 && cur) cur.s = i; depth++; i++; continue; }
    if (c === RB) { depth--; if (depth === 0 && cur) { if (!out.has(cur.k)) out.set(cur.k, [cur.s, i + 1]); cur = null; } i++; continue; }
    if (depth === 0 && c > SP && c !== EQ) {
      let j = i; while (j < n && buf[j] > SP && buf[j] !== EQ && buf[j] !== LB) j++;
      const k = name(i, j); let m = j; while (m < n && buf[m] <= SP) m++;
      if (buf[m] === EQ) { m++; while (m < n && buf[m] <= SP) m++;
        if (buf[m] === LB) { cur = { k, s: m }; i = m; continue; }
        let e = m; if (buf[e] === QT) { e++; while (e < n && buf[e] !== QT) { if (buf[e] === BS) e++; e++; } e++; } else while (e < n && buf[e] > SP && buf[e] !== RB) e++;
        if (!out.has(k)) out.set(k, [m, e]); i = e; continue; }
      i = j; continue;
    }
    i++;
  }
  return out;
}

const dec = new TextDecoder('utf-8');
/** [s, e) 를 값으로 읽는다('{' 로 시작하면 덩어리). */
export function parseRange(buf: Uint8Array, s: number, e: number): CwValue {
  let i = s; const n = e;
  const ws = () => { while (i < n) { const c = buf[i]; if (c <= SP) { i++; continue; } if (c === HASH) { while (i < n && buf[i] !== NL) i++; continue; } break; } };
  const tok = (): string => { ws(); if (buf[i] === QT) { let j = i + 1; while (j < n && buf[j] !== QT) { if (buf[j] === BS) j++; j++; } const t = dec.decode(buf.subarray(i + 1, j)); i = j + 1; return t; }
    let j = i; while (j < n) { const c = buf[j]; if (c <= SP || c === EQ || c === LB || c === RB || c === LT || c === GT) break; j++; } const t = dec.decode(buf.subarray(i, j)); i = j; return t; };
  const val = (): CwValue => { ws(); if (buf[i] === LB) { i++; return block(); } return tok(); };
  const block = (): CwValue => {
    let obj: CwObject | null = null, arr: CwValue[] | null = null;
    for (;;) {
      ws(); if (i >= n) break; if (buf[i] === RB) { i++; break; }
      if (buf[i] === LB) { i++; (arr ??= []).push(block()); continue; }
      const k = tok(); ws(); const c = buf[i];
      if (c === EQ || c === LT || c === GT) { i++; if (buf[i] === EQ) i++; const v = val(); obj ??= {};
        if (Object.prototype.hasOwnProperty.call(obj, k)) { const o = obj[k] as CwValue[] & { [REP]?: boolean }; if (Array.isArray(o) && o[REP]) o.push(v); else { const a = [o, v] as CwValue[] & { [REP]?: boolean }; a[REP] = true; obj[k] = a; } }
        else obj[k] = v; }
      else if (k) (arr ??= []).push(k);
      else i++; // 알 수 없는 글자는 건너뛴다
    }
    return obj ?? arr ?? {};
  };
  ws(); if (buf[i] === LB) { i++; return block(); } return val();
}
/** 맨 위 덩어리 하나를 객체로(없으면 null). */
export function topBlock(buf: Uint8Array, idx: Map<string, [number, number]>, key: string): CwValue | null { const r = idx.get(key); return r ? parseRange(buf, r[0], r[1]) : null; }

// ---- 값 꺼내기 도우미
export const isObj = (v: unknown): v is CwObject => !!v && typeof v === 'object' && !Array.isArray(v);
export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const num = (v: unknown): number | null => { const x = Number(v); return typeof v === 'string' && v !== '' && Number.isFinite(x) ? x : null; };
/** 반복 키·목록을 늘 배열로. */
export const list = (v: unknown): CwValue[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v as CwValue]);
