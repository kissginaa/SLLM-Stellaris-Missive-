// 게임 폴더 연결 DLL 자동 교체(2026-11-04 사용자: 게임 패치 때마다 설치기를 다시 깔게 하지 말고 앱 업데이트로 끝나게).
// 앱 업데이트 묶음이 native/bridge/command-bridge.dll(새 DLL)을 가져오면, 게임이 꺼져 있을 때 게임 폴더의 DLL 을 이것으로 바꾼다.
// 안전 규칙(설치기 manage-dll.ps1 과 같은 방식):
//   · 게임 폴더 DLL 이 「우리가 넣은 것」일 때만 바꾼다 = 옆의 .owner 파일(SHA-256 대문자)이 지금 DLL 해시와 같을 때. 아니면 손대지 않는다.
//   · 새 파일을 .sllm-new 로 먼저 복사해 해시를 확인 → 기존 DLL 을 .sllm-prev 로 백업 → 바꿔 넣고 다시 확인 → .owner 갱신. 하나라도 실패하면 원래대로 되돌린다.
//   · 게임이 켜져 있으면 하지 않는다(앱 쪽: src/features/game-dll-app.ts 가 게임이 꺼졌을 때·앱 켤 때 부른다).
// native/command-bridge.dll(예전 위치)은 일부러 그대로 둔다: 예전 앱은 그 파일이 바뀌면 「설치기로만 업데이트」라고 막기 때문(app-update-core DLL_FILE).
// 새 DLL 은 늘 native/bridge/ 로만 배포한다 → 예전 앱도 앱 업데이트로 이 코드를 받고, 다음 실행부터 스스로 DLL 을 바꾼다.
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** 앱 폴더 기준 새 DLL 위치(앱 업데이트로 바뀌는 파일). */
export const GAME_DLL_SOURCE = path.join('native', 'bridge', 'command-bridge.dll');
/** 게임 폴더에 설치기가 넣는 이름들(테스터판 · 정식판). */
export const GAME_DLL_NAMES = ['sllm-tester-command-bridge.dll', 'sllm-command-bridge.dll'];

export const shaUpper = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
export const ownerFile = (dll: string): string => dll.replace(/\.dll$/i, '.owner');

export type DllSync = { dll: string; state: 'same' | 'updated' | 'not_ours' | 'missing' | 'failed'; error?: string };

/** 게임 폴더 DLL 하나를 source 로 맞춘다. srcHash 는 source 의 SHA-256(대문자). */
export function syncGameDll(source: string, target: string, srcHash: string): DllSync {
  if (!fs.existsSync(target)) return { dll: target, state: 'missing' };
  let cur: string;
  try { cur = shaUpper(target); } catch (e) { return { dll: target, state: 'failed', error: (e as Error).message }; }
  if (cur === srcHash) return { dll: target, state: 'same' };
  let owner = '';
  try { owner = fs.readFileSync(ownerFile(target), 'utf8').trim().toUpperCase(); } catch { /* 표식 없음 = 우리 것인지 모름 */ }
  if (owner !== cur) return { dll: target, state: 'not_ours' };
  const tmp = target + '.sllm-new', bak = target + '.sllm-prev';
  let swapped = false;
  try {
    fs.copyFileSync(source, tmp);
    if (shaUpper(tmp) !== srcHash) throw new Error('copy hash mismatch');
    fs.copyFileSync(target, bak);
    if (shaUpper(bak) !== cur) throw new Error('backup hash mismatch');
    fs.renameSync(tmp, target); // 게임이 DLL 을 물고 있으면 여기서 실패(EBUSY/EPERM) → 그대로 둔다
    swapped = true;
    if (shaUpper(target) !== srcHash) throw new Error('installed hash mismatch');
    fs.writeFileSync(ownerFile(target), srcHash, 'ascii');
    try { fs.unlinkSync(bak); } catch { /* 백업은 남아도 무해 */ }
    return { dll: target, state: 'updated' };
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* 없음 */ }
    if (swapped) { // 바꿔 넣은 뒤 실패: 백업으로 되돌리고 표식도 원래대로
      try { fs.copyFileSync(bak, target); fs.writeFileSync(ownerFile(target), cur, 'ascii'); } catch { /* 되돌리기 실패는 오류 문구에 남는다 */ }
    }
    return { dll: target, state: 'failed', error: (e as Error).message };
  }
}

/** 게임 폴더 후보들 × DLL 이름들을 모두 맞춘다. 같은 폴더는 한 번만. source 가 없으면 빈 목록. */
export function syncGameDlls(appDir: string, gameDirs: string[]): DllSync[] {
  const source = path.join(appDir, GAME_DLL_SOURCE);
  if (!fs.existsSync(source)) return [];
  const srcHash = shaUpper(source), out: DllSync[] = [];
  for (const dir of [...new Set(gameDirs.filter(Boolean).map((d) => path.normalize(d)))]) {
    for (const name of GAME_DLL_NAMES) { const r = syncGameDll(source, path.join(dir, name), srcHash); if (r.state !== 'missing') out.push(r); }
  }
  return out;
}
