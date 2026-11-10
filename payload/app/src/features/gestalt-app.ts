// 단일 의식(기계 지성·군체) 플레이어 제국 판정(2026-10-19 사용자 결정): 파벌·언론·시민 개개인을 전제로 한 기능은 막고, 인물 기능은 말투를 바꾼다.
// 어디서 알게 되나: 플레이어 제국 정보(PROFILE gest 1=기계·2=군체) → 외교 단말기 연락처(playerGest) → 월간 상황(COUNCILAG gest, 종류는 모름).
// 가져오기 고리를 만들지 않으려고 월간 상황은 main.ts 가 noteGestaltSnapshot 으로 넘겨 준다(이 파일은 ctx·terminal 만 가져온다).
import { ipcMain } from 'electron';
import { ctx } from '../app/ctx';
import { terminal } from './terminal';

export type GestaltKind = 'machine' | 'hive' | 'gestalt' | ''; // gestalt: 단일 의식인 줄은 아는데 기계·군체를 아직 모름
let snap: { sid: string; on: boolean } | null = null;
export function noteGestaltSnapshot(s: { sid: string; gestalt?: boolean }): void { if (s.sid && typeof s.gestalt === 'boolean') snap = { sid: s.sid, on: s.gestalt }; }
/** 지금 세이브의 플레이어 제국이 단일 의식이면 그 종류, 아니면 ''. */
export function playerGestalt(): GestaltKind {
  const sid = ctx.curSaveId; if (!sid) return '';
  const g = (ctx.profiles.get(ctx.playerIdx) as { gest?: number } | undefined)?.gest;
  if (g === 1) return 'machine'; if (g === 2) return 'hive';
  if (terminal.sid === sid) { if (terminal.playerGest === 1) return 'machine'; if (terminal.playerGest === 2) return 'hive'; }
  if (snap && snap.sid === sid) return snap.on ? 'gestalt' : '';
  return '';
}
export const isGestalt = (): boolean => playerGestalt() !== '';
/** 따로 뜨는 창(총독회의·연설)이 말투를 고르려고 묻는다(ui/gestalt-terms.js, 알파 11). */
export function registerGestalt(): void { ipcMain.handle('playerGestalt', () => playerGestalt()); }
/** 인물 프롬프트에 넘길 값(persona/letters/memorial): 1 기계, 2 군체(종류를 모르면 군체로 보지 않고 1·2 둘 다 아님 → 3). */
export const gestaltCode = (): 0 | 1 | 2 | 3 => { const k = playerGestalt(); return k === 'machine' ? 1 : k === 'hive' ? 2 : k === 'gestalt' ? 3 : 0; };
