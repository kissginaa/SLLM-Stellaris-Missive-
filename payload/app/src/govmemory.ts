import { logDiagnostic } from './diagnostics';
// 총독의 특별한 기억. 이름이 있는 실제 총독에게만 있고, 플레이어가 고른 순간만 남는다.
// 세이브를 뒤로 불러도(총독이 죽기 전으로 돌아가도) 기억이 남도록 앱 쪽 파일에 따로 저장하고, 게임 세이브와 함께 되돌리지 않는다.
import * as fs from 'fs';

export interface Memory { id: number; text: string; date: string; ts: number; branch?: number; other?: boolean }
/** 시간선(분기). 세이브를 과거로 불러 게임 날짜가 뒤로 가면 새 분기가 갈라진다. fork = 갈라진 날짜. */
export interface Branch { id: number; parent: number | null; fork: string }
/** tls(2026-11-05): 모드가 매달 뽑는 시간선 번호 → 그 달이 속한 분기·날짜. tips: 분기별 마지막 번호. 옛 기록엔 없음. */
export interface BranchSet { cur: number; last: string; nextId: number; list: Branch[]; tls?: Record<string, { b: number; d: string }>; tips?: Record<string, string> }
/** 시간선 번호 글자(「123-45」) → 정규화한 열쇠. 0·빈 값·모양이 틀리면 null(모름). */
export function tlKey(v: unknown): string | null {
  const m = String(v ?? '').trim().match(/^(\d{1,3})(?:\.0+)?-(\d{1,3})(?:\.0+)?$/); if (!m) return null;
  const a = Number(m[1]), b = Number(m[2]); return a >= 100 && a <= 999 && b >= 0 && b <= 999 ? `${a}-${b}` : null;
}
const TL_KEEP = 1200;
export interface GovMemFile { next: number; govs: Record<string, Memory[]>; branches?: Record<string, BranchSet> }

/** "2200.01.15" -> 비교 가능한 숫자. 모르면 NaN. */
import { dateNum } from './gamedate';
export { dateNum }; // F-28: 날짜 계산은 gamedate.ts 한 곳에

export const MAX_MEMORIES = 30;
export const MEM_TEXT_MAX = 120;
export const LEVELS = ['업무 관계', '친근한 사이', '신뢰하는 사이', '특별한 사이'];

/** 기억 개수로 친밀도 단계를 정한다. 숨겨진 점수가 아니라 눈에 보이는 규칙이라 사용자가 기억을 지우면 단계도 내려간다. */
export function levelOf(count: number): number { return count >= 6 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0; }
export const cleanMemText = (t: unknown): string => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, MEM_TEXT_MAX) : '');
/** 같은 세이브 계열(sid)에서 같은 이름의 총독은 같은 사람으로 본다. */
export const govKey = (sid: string, name: string): string => `${sid || 'nosave'}|${name.trim()}`;

export class GovMemoryStore {
  private data: GovMemFile = { next: 1, govs: {} };
  constructor(private file: string) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j && typeof j === 'object' && j.govs)
        this.data = { next: Number(j.next) || 1, govs: j.govs, branches: j.branches && typeof j.branches === 'object' ? j.branches : {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        logDiagnostic('warn', 'storage.read_failed', { store: 'governor-memory', file, error });
    }
  }
  private save(): void { try { fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8'); } catch(error) { logDiagnostic('error','storage.write_failed',{store:'governor-memory',file:this.file,error}); } }
  sidOf(key: string): string { return key.split('|')[0]; }
  private bset(sid: string): BranchSet {
    const all = (this.data.branches ??= {});
    return (all[sid] ??= { cur: 1, last: '', nextId: 2, list: [{ id: 1, parent: null, fork: '' }] });
  }
  /** 지금 게임 날짜를 알린다. 이전에 본 날짜보다 뒤로 갔으면(세이브를 과거로 불러옴) 새 분기를 만들고 true. */
  track(sid: string, date: string): boolean {
    const n = dateNum(date); if (!sid || Number.isNaN(n)) return false;
    const b = this.bset(sid); const last = dateNum(b.last);
    if (!Number.isNaN(last) && n < last) {
      const id = b.nextId++; b.list.push({ id, parent: b.cur, fork: date }); b.cur = id; b.last = date; this.save(); return true;
    }
    if (Number.isNaN(last) || n > last) { b.last = date; this.save(); }
    return false;
  }
  /** 매달(MONTH): 이번 달 번호를 지금 분기에 적는다(tl). 날짜 규칙(track)은 따로 부른다. */
  noteMonth(sid: string, tl: unknown, date: string): void {
    const k = tlKey(tl); if (!sid || !k) return;
    const b = this.bset(sid); const t = (b.tls ??= {});
    t[k] = { b: b.cur, d: date }; (b.tips ??= {})[String(b.cur)] = k;
    const ks = Object.keys(t); if (ks.length > TL_KEEP) for (const x of ks.slice(0, ks.length - TL_KEEP)) delete t[x];
    this.save();
  }
  /** 불러오기(LOADED): 세이브에 든 번호로 어느 시간선의 어느 달인지 정확히 안다(2026-11-05).
   *  · 지금 분기의 마지막 달 → 그냥 이어짐(false) · 다른 분기의 마지막 달 → 그 분기로 돌아감(true)
   *  · 어떤 분기의 지난 달 → 그 분기에서 새로 갈라짐(true, 날짜가 앞으로 가도 알아챔) · 모르는 번호 → 예전 날짜 규칙(track). */
  trackLoad(sid: string, date: string, tl: unknown): boolean {
    const k = tlKey(tl); if (!sid) return false;
    const b = this.bset(sid); const hit = k ? b.tls?.[k] : undefined;
    if (!k || !hit || !b.list.some((x) => x.id === hit.b)) return this.track(sid, date);
    if (b.tips?.[String(hit.b)] === k) { const moved = hit.b !== b.cur; b.cur = hit.b; b.last = date; this.save(); return moved; }
    const id = b.nextId++; b.list.push({ id, parent: hit.b, fork: hit.d || date }); b.cur = id; b.last = date; (b.tips ??= {})[String(id)] = k; this.save(); return true;
  }
  currentBranch(sid: string): number { return this.bset(sid).cur; }
  /** 항목들을 이 시간선(own)과 되감기 전 다른 시간선(other)으로 나눈다. 항목은 id 와 branch, date 가 있어야 한다. */
  split<T extends { id: number; branch?: number; date: string }>(sid: string, all: T[]): { own: T[]; other: T[] } {
    if (!all.length) return { own: [], other: [] };
    const b = this.bset(sid); const byId = new Map(b.list.map((x) => [x.id, x]));
    const mine = new Set<number>();
    let c: number | null = b.cur; let cutoff = NaN;
    for (let guard = 0; c !== null && guard < 1000; guard++) {
      for (const m of all) {
        if ((m.branch ?? 1) !== c) continue;
        const dn = dateNum(m.date);
        if (Number.isNaN(cutoff) || Number.isNaN(dn) || dn <= cutoff) mine.add(m.id);
      }
      const br = byId.get(c); if (!br) break;
      const fn = dateNum(br.fork);
      if (!Number.isNaN(fn) && (Number.isNaN(cutoff) || fn < cutoff)) cutoff = fn;
      c = br.parent;
    }
    return { own: all.filter((m) => mine.has(m.id)), other: all.filter((m) => !mine.has(m.id)) };
  }
  /** 이 시간선에서 실제로 있었던 기억(own)과 되감기 전 다른 시간선의 기억(other). */
  view(key: string): { own: Memory[]; other: Memory[] } {
    const r = this.split(this.sidOf(key), this.list(key));
    return { own: r.own, other: r.other.map((m) => ({ ...m, other: true })) };
  }
  list(key: string): Memory[] { return (this.data.govs[key] ?? []).slice(); }
  add(key: string, text: string, date: string): Memory | null {
    const t = cleanMemText(text); if (!t) return null;
    const arr = (this.data.govs[key] ??= []);
    if (arr.some((m) => m.text === t)) return null; // 같은 기억은 두 번 넣지 않는다
    const m: Memory = { id: this.data.next++, text: t, date: date || '', ts: Date.now(), branch: this.bset(this.sidOf(key)).cur };
    arr.push(m);
    while (arr.length > MAX_MEMORIES) arr.shift(); // 가장 오래된 것부터 잊는다
    this.save(); return m;
  }
  remove(key: string, id: number): boolean {
    const arr = this.data.govs[key]; if (!arr) return false;
    const i = arr.findIndex((m) => m.id === id); if (i < 0) return false;
    arr.splice(i, 1); this.save(); return true;
  }
}

/** 프롬프트에 붙일 기억 문단(영어, 2026-10-19 프롬프트 영어화). 기억이 없으면 친밀도 안내만(업무 관계). */
const LEVELS_EN = ['a working relationship', 'a friendly relationship', 'a trusting relationship', 'a special relationship'];
export function memoryPrompt(items: Memory[], other: Memory[] = []): string {
  const lv = levelOf(items.length + other.length);
  const L = [`Your relationship with the leader: ${LEVELS_EN[lv]}.`];
  if (items.length) L.push('Special memories you two share (oldest first):\n' + items.slice(-12).map((m) => `- ${m.date ? '[' + m.date + '] ' : ''}${m.text}`).join('\n') + '\nDo not invent past events that are not in these memories.');
  if (other.length) L.push('Time was rewound, so these memories of events that did not happen now (or went differently) linger faintly, like a dream or déjà vu. Never bring them up first; if the leader mentions one, only react with something like "I vaguely feel that way". Never state them as fact or as things that happened now:\n' + other.slice(-6).map((m) => `- ${m.text}`).join('\n'));
  L.push(['Your tone is a polite work report.', 'Your tone may soften a little.', 'You deeply trust the leader. You may now and then share a personal worry or a joke.', 'You hold the leader especially dear. If the leader wants, you may accept a tender romance roleplay, but never push it first and keep it suitable for all ages.'][lv]);
  L.push('You may add a "memo" field after your line. Only when a moment worth keeping between you and the leader just happened (a promise, a confession, a shared secret, a big decision), write that moment in one line (within 60 characters); for ordinary reports or advice it must be null. Format: {"say":"line","memo":null}');
  return L.join('\n');
}
