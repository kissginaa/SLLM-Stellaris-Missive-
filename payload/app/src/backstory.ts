// 사용자가 직접 쓰는 배경 이야기(2026-10-18 테스터 요청: 모드의 특수 제국·영웅 설정을 AI 가 알게).
//  - 제국: 이름으로 저장(세이브와 상관없이 같은 이름이면 같이 씀). 있으면 게임·모드 전기보다 먼저 쓴다.
//  - 인물(내 제국 연락처): 세이브별 인물 기억(sllm_persona.json 의 bio)에 둔다 → features/persona-app.ts.
import * as fs from 'fs';
import * as path from 'path';
import { cardPrompt, cleanCard, CARD_MAX } from './memory-links';
/** 제국 지도자의 말투·비밀(2026-10-28 ChatSyncAuto 참고: 인물 성격 편집·내보내기). */
export interface EmpireCard { voice?: string; secret?: string }

export const BACKSTORY_MAX = 2000;
/** 줄바꿈은 두고 제어 문자·앞뒤 공백을 지운 뒤 길이를 자른다. */
export const cleanBackstory = (s: unknown, max = BACKSTORY_MAX): string =>
  String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const nameKey = (name: unknown): string => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);

export class BackstoryStore {
  private data: { empires: Record<string, string>; cards: Record<string, EmpireCard> } | null = null;
  constructor(private file: () => string, private onError: (op: string, e: unknown) => void = () => {}) {}
  private load(): { empires: Record<string, string>; cards: Record<string, EmpireCard> } {
    if (this.data) return this.data;
    try { const j = JSON.parse(fs.readFileSync(this.file(), 'utf8')); this.data = { empires: j && typeof j.empires === 'object' && j.empires ? j.empires : {}, cards: j && typeof j.cards === 'object' && j.cards ? j.cards : {} }; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') this.onError('read', e); this.data = { empires: {}, cards: {} }; }
    return this.data;
  }
  empire(name: unknown): string { const k = nameKey(name); return k ? cleanBackstory(this.load().empires[k]) : ''; }
  empireCard(name: unknown): EmpireCard { const k = nameKey(name); const c = k ? this.load().cards[k] : undefined; return { voice: cleanCard(c?.voice, CARD_MAX.voice), secret: cleanCard(c?.secret, CARD_MAX.secret) }; }
  empireCardPrompt(name: unknown): string { return cardPrompt(this.empireCard(name)); }
  /** 말투·비밀 저장(둘 다 비면 지운다). */
  setEmpireCard(name: unknown, c: EmpireCard): boolean {
    const k = nameKey(name); if (!k) return false;
    const d = this.load(), v = cleanCard(c?.voice, CARD_MAX.voice), sct = cleanCard(c?.secret, CARD_MAX.secret);
    if (v || sct) d.cards[k] = { ...(v ? { voice: v } : {}), ...(sct ? { secret: sct } : {}) }; else delete d.cards[k];
    return this.write(d);
  }
  private write(d: { empires: Record<string, string>; cards: Record<string, EmpireCard> }): boolean {
    try { fs.mkdirSync(path.dirname(this.file()), { recursive: true }); fs.writeFileSync(this.file() + '.tmp', JSON.stringify(d), 'utf8'); fs.renameSync(this.file() + '.tmp', this.file()); return true; }
    catch (e) { this.onError('write', e); return false; }
  }
  /** 빈 글이면 지운다(게임·모드 전기로 돌아감). 저장했으면 true. */
  setEmpire(name: unknown, text: unknown): boolean {
    const k = nameKey(name); if (!k) return false;
    const d = this.load(), t = cleanBackstory(text);
    if (t) d.empires[k] = t; else delete d.empires[k];
    try { fs.mkdirSync(path.dirname(this.file()), { recursive: true }); fs.writeFileSync(this.file() + '.tmp', JSON.stringify(d), 'utf8'); fs.renameSync(this.file() + '.tmp', this.file()); return true; }
    catch (e) { this.onError('write', e); return false; }
  }
}
