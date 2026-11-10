// 배경 이야기 입력(2026-10-18): 외교 단말기 대화창의 「제국 전기」 단추, 집무실 연락처의 「인물 전기」 단추.
// 저장 형식·우선순위는 ../backstory.ts. 제국 글은 withLore 가, 인물 글은 persona/letters/gov 프롬프트가 쓴다.
import { app, ipcMain } from 'electron';
import * as path from 'path';
import { BackstoryStore, cleanBackstory, BACKSTORY_MAX } from '../backstory';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { pick } from './settings-ui';
import { personOf, personBio, setPersonBio, governorBio, personCard, setPersonCard } from './persona-app';
import { setGovBio } from './gov';

export const backstories = new BackstoryStore(() => path.join(app.getPath('userData'), 'sllm_backstory.json'),
  (op, error) => logDiagnostic(op === 'read' ? 'warn' : 'error', op === 'read' ? 'storage.read_failed' : 'storage.write_failed', { store: 'backstory', error }));

/** autoLore: 사용자 글을 뺀 게임·모드·세이브 전기(main.ts withLore 와 같은 순서). */
export function registerBackstory(autoLore: (name: string, idx?: number) => string): void {
  setGovBio(governorBio);
  ipcMain.handle('backstoryEmpire', async (_e, a: { name?: unknown; idx?: unknown }) => {
    const name = String(a?.name ?? '').trim(); if (!name) return null;
    const idx = Number(a?.idx); let auto = '';
    try { auto = autoLore(name, Number.isFinite(idx) ? idx : undefined) || ''; } catch { /* 전기 없음 */ }
    return { name, custom: backstories.empire(name), auto, max: BACKSTORY_MAX, card: true, ...backstories.empireCard(name) }; // 말투·비밀(2026-10-28)
  });
  ipcMain.handle('backstoryEmpireSet', async (_e, a: { name?: unknown; text?: unknown; card?: { voice?: string; secret?: string } }) => {
    const name = String(a?.name ?? '').trim(); if (!name) return { ok: false, error: pick('제국 이름이 없습니다.', 'No empire name.') };
    if (!backstories.setEmpire(name, a?.text)) return { ok: false, error: pick('저장하지 못했습니다.', 'Could not save.') };
    if (a?.card && typeof a.card === 'object' && !backstories.setEmpireCard(name, a.card)) return { ok: false, error: pick('저장하지 못했습니다.', 'Could not save.') };
    try { const t = ctx.talk as { name?: string; player?: string } | null; if (t && (t.name === name || t.player === name)) ctx.talk = ctx.withLore(ctx.talk!); } catch { /* 다음 대화부터 반영 */ }
    return { ok: true, custom: backstories.empire(name) };
  });
  ipcMain.handle('backstoryPerson', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid || !k) return null;
    const p = personOf(k); if (!p) return null;
    return { name: p.name, custom: personBio(sid, k), max: BACKSTORY_MAX, card: true, ...personCard(sid, k) };
  });
  ipcMain.handle('backstoryPersonSet', async (_e, key: unknown, text: unknown, card: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? '');
    if (!sid || !k || !personOf(k)) return { ok: false, error: pick('연락처에서 이 인물을 찾지 못했습니다.', 'This person is not in your contacts.') };
    setPersonBio(sid, k, cleanBackstory(text));
    if (card && typeof card === 'object') setPersonCard(sid, k, card as { voice?: string; secret?: string }); // 말투·비밀(2026-10-28)
    return { ok: true, custom: personBio(sid, k) };
  });
}
