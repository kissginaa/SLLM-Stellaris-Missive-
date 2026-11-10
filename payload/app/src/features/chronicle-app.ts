// A-00b 4번: 연대기(앱 쪽) — 저장소, 기록 함수(chronNote 등), 연대기 화면 IPC(chronList).
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 순수 저장 로직은 src/chronicle.ts.
import { app, ipcMain } from 'electron';
import * as path from 'path';
import { ChronicleStore, ChronMeta, RADIO_IDX, chronKey } from '../chronicle';
import { radioMirrorPlan } from '../radio';
import { ctx } from '../app/ctx';
import { bgWriteJson, flushBgWrites } from '../app/bg-worker';
import { pick } from './settings-ui';

let chronStore: ChronicleStore | null = null;
export function chron(): ChronicleStore {
  if (!chronStore) {
    chronStore = new ChronicleStore(path.join(app.getPath('userData'), 'sllm_chronicle.json'), (sid) => ctx.govMem().currentBranch(sid));
    chronStore.lazyMs = 1500; // 줄마다 파일 전체를 다시 쓰지 않고 1.5초에 한 번(2026-11-08, 사건 줄이 몰릴 때 앱 멈춤) — 끌 때 마저 쓴다
    chronStore.writer = (f, d, done) => bgWriteJson(f, d, done); // 9MB 남짓을 만들고 쓰는 일은 작업 스레드가(2026-11-08)
    const st = chronStore; app.on('before-quit', () => { try { flushBgWrites(); st.flush(); } catch { /* 종료 중 */ } });
    // 새 기록이 들어가면 연대기 화면에 알린다(짧은 시간에 몰리면 한 번으로 합친다)
    chronStore.onAdd = () => { if (chronNotifyT) return; chronNotifyT = setTimeout(() => { chronNotifyT = null; ctx.toUi('chronChanged', null); }, 300); };
  }
  return chronStore;
}
/** 연대기 한 줄을 남긴다(대화 상대 번호와 세이브 번호가 있을 때만). */
export const idxNames = new Map<number, string>(); // IDX 신호로 알게 된 제국 이름
type ChronPending = { idx: number; date: string; text: string; once: boolean; meta: ChronMeta };
const chronPending: ChronPending[] = []; // 세이브 번호를 알기 전에 들어온 기록. 번호를 알게 되면 한꺼번에 넣는다
let chronWarned = '', chronNotifyT: ReturnType<typeof setTimeout> | null = null;
export function chronCheckSave(): void { const e = chron().error; if (e && e !== chronWarned) { chronWarned = e; ctx.toUi('status', pick('연대기 저장 실패: ', 'Failed to save the chronicle: ') + e + pick(' (기록은 메모리에 있고 다음 기록 때 다시 저장을 시도합니다)', ' (records stay in memory; saving is retried with the next record)')); } else if (!e) chronWarned = ''; }
export function chronPut(idx: number, date: string, text: string, once: boolean, meta: ChronMeta): void {
  if (!ctx.curSaveId) { chronPending.push({ idx, date, text, once, meta }); while (chronPending.length > 800) chronPending.shift(); return; }
  try { chron().add(ctx.curSaveId, idx, date, text, once, meta); chronCheckSave(); } catch (e) { ctx.toUi('status', pick('연대기 기록 실패: ', 'Failed to write the chronicle: ') + (e instanceof Error ? e.message : String(e))); }
}
export function flushChronPending(): void { if (!ctx.curSaveId || !chronPending.length) return; for (const q of chronPending.splice(0)) chronPut(q.idx, q.date, q.text, q.once, q.meta); }
export function chronNote(idx: number, text: string, once = false, world = false): void {
  if (idx > 0)
    chronPut(idx, ctx.gameDate, text, once, {
      ruler: ctx.profiles.get(idx)?.ruler,
      name: idxNames.get(idx) ?? ctx.mailCountries.get(idx)?.name ?? (ctx.talk && ctx.talk.idx === idx ? ctx.talk.name : undefined),
      world,
    });
}
/** 번호 없이 이름만 아는 제국의 기록: IDX 신호로 알게 된 이름과 같으면 그 제국 연대기에 넣고, 못 찾으면 넣지 않는다. */
export function chronNoteByName(name: string, text: string, world = true): boolean { const n = name.trim(); if (!n) return false; for (const [i, nm] of idxNames) if (nm === n && i > 0 && i < 9000) { chronNote(i, text, false, world); return true; } return false; }
/** 번호를 모르는 세계 사건을 넣는 가상 제국(은하 위기 안건도 여기 들어간다). */
export const WORLD_IDX = 9999;
export function chronNoteWorld(text: string, once = false): void { idxNames.set(WORLD_IDX, '세계 소식'); chronNote(WORLD_IDX, text, once, true); }

/** 라디오 연대기 ⊇ 신문 연대기(알파 6): 제국별 기록 가운데 라디오 연대기에 없는 최근 1년 기록을 채운다. 같은 기록은 uid 로 한 번만. */
let radioSyncKey = '';
export function syncRadioChron(): number {
  const sid = ctx.curSaveId, today = ctx.gameDate; if (!sid || !today) return 0;
  const key = `${sid}|${today}|${chron().rev}`; if (key === radioSyncKey) return 0; // 연대기·날짜가 그대로면 다시 훑지 않는다(라디오가 빌 때마다 2분 주기로 불림)
  try {
    const groups = chron().groups(sid, (all) => ctx.govMem().split(sid, all).own).filter((g) => g.idx !== RADIO_IDX);
    const radioItems = ctx.govMem().split(sid, chron().list(chronKey(sid, RADIO_IDX))).own;
    const plan = radioMirrorPlan(groups, radioItems, today, RADIO_IDX);
    const n = chron().batch(() => { let k = 0; for (const p of plan) if (chron().add(sid, RADIO_IDX, p.date, p.text, false, { name: '성간라디오 전용 연대기', world: true, uid: p.uid })) k++; return k; });
    chronCheckSave(); radioSyncKey = `${sid}|${today}|${chron().rev}`;
    return n;
  } catch (e) { ctx.toUi('status', pick('라디오 연대기 동기화 실패: ', 'Failed to sync the radio chronicle: ') + (e instanceof Error ? e.message : String(e))); return 0; }
}

export function registerChronicle(): void {
  ipcMain.handle('chronList', async () => {
    if (!ctx.curSaveId) return { sid: '', groups: [] };
    const groups = chron().groups(ctx.curSaveId, (all) => ctx.govMem().split(ctx.curSaveId, all).own);
    return { sid: ctx.curSaveId, groups: groups.map((g) => ({ idx: g.idx, name: g.name, items: g.items.map((e) => ({ date: e.date, ruler: e.ruler ?? '', text: e.text })) })) };
  });
}
