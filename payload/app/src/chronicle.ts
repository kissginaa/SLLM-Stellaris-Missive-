import { logDiagnostic } from './diagnostics';
// 관계 연대기: 플레이어와 각 AI 제국 사이에 있었던 일을 날짜와 함께 쌓아 두고, 대화 때 "우리 사이에 있었던 일"로 알려 준다.
// 되감기(시간선)를 따라가도록 항목마다 분기 번호를 둔다. 앱 파일에 따로 저장한다.
import * as fs from 'fs';

export interface ChronEntry { id: number; date: string; text: string; branch?: number; ruler?: string; world?: boolean; uid?: string } // world: 플레이어와 무관한 세계 소식(대화 프롬프트에는 넣지 않는다)
export interface ChronFile { next: number; items: Record<string, ChronEntry[]>; names?: Record<string, string> }
export interface ChronMeta { ruler?: string; name?: string; world?: boolean; uid?: string }

export const RADIO_IDX = 9990; // 성간 라디오 전용 연대기(모든 on_action 사건을 날짜별로 쌓는 가상의 제국 번호)
export const MAX_RADIO = 5000;
export const MAX_CHRON = 60; // 제국 하나당 보관하는 최대 항목 수
/** 스텔라리스 달력: 한 달 30일, 한 해 360일. 'YYYY.MM.DD' → 일 수. */
import { L } from './i18n-pick';
import { dayNo } from './gamedate'; // F-28: 스텔라리스 달력 일 수(한 달 30일, 한 해 360일)
export const RADIO_KEEP_DAYS = 360; // 1년(한 해 360일). 라디오를 켤 때 이 기간의 미방송 사건으로 대기열을 채운다(F-03)
export const chronKey = (sid: string, idx: number): string => `${sid || 'nosave'}|${idx}`;

export class ChronicleStore {
  private data: ChronFile = { next: 1, items: {} };
  /** 기록이 실제로 들어갈 때마다 1씩 오른다(바뀐 게 없으면 다시 계산하지 않게, 2026-10-18). */
  rev = 0;
  private batchDepth = 0;
  private dirty = false;
  /** 여러 개를 넣을 때 파일 저장·화면 알림을 끝에 한 번만 한다(항목마다 연대기 파일 전체를 다시 쓰던 문제). */
  batch<T>(fn: () => T): T {
    this.batchDepth++;
    try { return fn(); }
    finally { if (--this.batchDepth === 0 && this.dirty) { this.dirty = false; this.saveSoon(); try { this.onAdd?.(); } catch { /* 화면 알림 실패는 무시 */ } } }
  }
  constructor(private file: string, private branchOf: (sid: string) => number) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (j && typeof j === 'object' && j.items)
        this.data = { next: Number(j.next) || 1, items: j.items, names: j.names && typeof j.names === 'object' ? j.names : {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        logDiagnostic('warn', 'storage.read_failed', { store: 'chronicle', file, error });
    }
  }
  /** 마지막 저장이 실패했으면 그 이유(성공하면 null). 대화는 막지 않지만 화면에는 알린다. */
  error: string | null = null;
  /** 새 기록이 실제로 들어갔을 때 부른다(화면 자동 갱신용). */
  onAdd: (() => void) | null = null;
  /** 상한(MAX_CHRON)에서 밀려난 줄(2026-10-28 ChatSyncAuto 참고: 오래된 기록을 장으로 압축, 원문은 따로 보관). */
  onTrim: ((sid: string, idx: number, dropped: ChronEntry[]) => void) | null = null;
  /** 늦춰 쓰기(2026-11-08): 0 이면 기록마다 바로 쓴다(검사·예전 동작). 앱은 1500ms — 연대기 파일(수 MB)을 줄마다 통째로 다시 쓰면
   *  시나리오 시작처럼 사건 줄이 수천 개 몰릴 때 앱이 몇 분씩 멈췄다(행성 조사 6천여 줄 × 9MB). 앱을 끌 때 flush() 로 남은 것을 쓴다. */
  lazyMs = 0;
  private lazyT: ReturnType<typeof setTimeout> | null = null;
  /** 늦춰 쓰기 때 실제로 쓰는 쪽(앱: 작업 스레드 bgWriteJson). 없으면 이 스레드에서 쓴다. done(실패 이유 | null). */
  writer: ((file: string, data: ChronFile, done: (err: string | null) => void) => void) | null = null;
  /** 늦춰 둔 저장을 지금 한다(앱 종료 때). */
  flush(): void { if (this.lazyT) { clearTimeout(this.lazyT); this.lazyT = null; this.save(); } }
  private saveSoon(): void {
    if (!this.lazyMs) { this.save(); return; }
    if (this.lazyT) return;
    this.lazyT = setTimeout(() => {
      this.lazyT = null;
      if (!this.writer) { this.save(); return; }
      try { this.writer(this.file, this.data, (err) => { this.error = err; if (err) logDiagnostic('error', 'storage.write_failed', { store: 'chronicle', file: this.file, error: err }); }); } catch { this.save(); }
    }, this.lazyMs);
  }
  private save(): void {
    try { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8'); fs.renameSync(tmp, this.file); this.error = null; }
    catch (e) { this.error = e instanceof Error ? e.message : String(e);logDiagnostic('error','storage.write_failed',{store:'chronicle',file:this.file,error:e}); } // 기억 속 기록은 남아 있으니 다음 기록 때 다시 저장을 시도한다
  }
  list(key: string): ChronEntry[] { return (this.data.items[key] ?? []).slice(); }
  /** 이 세이브의 제국별 기록 묶음: [{ key, idx, name, items }]. 항목을 어느 시간선까지 보일지는 filter 가 정한다. */
  groups(sid: string, filter: (all: ChronEntry[]) => ChronEntry[] = (a) => a): Array<{ idx: number; name: string; items: ChronEntry[] }> {
    const pre = `${sid || 'nosave'}|`; const out: Array<{ idx: number; name: string; items: ChronEntry[] }> = [];
    for (const [k, arr] of Object.entries(this.data.items)) {
      if (!k.startsWith(pre)) continue;
      const items = filter(arr.slice()); if (!items.length) continue;
      const idx = Number(k.slice(pre.length));
      out.push({ idx, name: this.data.names?.[k] || L(`제국 ${idx}`, `Empire ${idx}`), items });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }
  /** 같은 날짜에 같은 문장은 한 번만 넣는다. */
  add(sid: string, idx: number, date: string, text: string, once = false, meta: ChronMeta = {}): boolean {
    const t = text.replace(/\s+/g, ' ').trim().slice(0, 140); if (!t) return false;
    const k = chronKey(sid, idx); const arr = (this.data.items[k] ??= []);
    const br = this.branchOf(sid);
    if (meta.uid) { if (arr.some((e) => e.uid === meta.uid && (e.branch ?? 1) === br)) return false; }
    else if (once && arr.some((e) => e.text === t && (e.branch ?? 1) === br)) return false;
    if (!meta.uid && arr.some((e) => e.text === t && e.date === date && (e.branch ?? 1) === br)) return false;
    arr.push({ id: this.data.next++, date: date || '', text: t, branch: br, ...(meta.ruler ? { ruler: meta.ruler.slice(0, 40) } : {}), ...(meta.world ? { world: true } : {}), ...(meta.uid ? { uid: meta.uid.slice(0, 200) } : {}) });
    if (meta.name) (this.data.names ??= {})[k] = meta.name.slice(0, 60);
    // 성간 라디오 전용 연대기는 게임 날짜로 최근 RADIO_KEEP_DAYS(360)일만 남긴다(라디오는 지금 일어난 일을 전하는 것이 목적이다). 연도가 넘어가도 최근 사건은 이어지고, 같은 시간선(branch)의 더 오래된 것만 지운다. 상한은 MAX_RADIO 건.
    if (idx === RADIO_IDX) { const nd = dayNo(date); if (nd !== null) for (let i = arr.length - 1; i >= 0; i--) { const ed = dayNo(arr[i].date); if (ed !== null && ed < nd - RADIO_KEEP_DAYS && (arr[i].branch ?? 1) === br) arr.splice(i, 1); } }
    const cap = idx === RADIO_IDX ? MAX_RADIO : MAX_CHRON;
    const dropped: ChronEntry[] = [];
    while (arr.length > cap) dropped.push(arr.shift()!);
    if (dropped.length && idx !== RADIO_IDX && this.onTrim) { try { this.onTrim(sid, idx, dropped); } catch { /* 장(章) 압축은 부가 기능 */ } } // 상한에서 밀려난 줄 → 장(章) 압축·원문 보관(2026-10-28)
    this.rev++;
    if (this.batchDepth) { this.dirty = true; return true; }
    this.saveSoon(); try { this.onAdd?.(); } catch { /* 화면 알림 실패는 무시 */ } return true;
  }
}

/** 프롬프트에 넣을 줄들(오래된 것부터, 최근 max 개). */
export function chronLines(items: ChronEntry[], max = 8): string[] {
  return items.slice(-max).map((e) => (e.date ? `[${e.date}] ` : '') + e.text);
}
