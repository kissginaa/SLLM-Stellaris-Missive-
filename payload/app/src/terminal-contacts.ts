import type { SllmMessage } from './protocol';
/** gest: 0 일반 제국, 1 기계 지성, 2 군집 의식(모드 CONTACT 의 gest 값. 없으면 0) */
/** 엔클레이브 세부 종류(모드 CONTACT 의 sub, 2026-10-25 알파 11). 게임 나라 깃발 artist_enclave_country 등에서 온다. */
export type EnclaveSub = 'artist' | 'curator' | 'xura' | 'riggan' | 'muutagan' | 'salvager' | 'shroudwalker';
export const ENCLAVE_SUBS: ReadonlyArray<EnclaveSub | ''> = ['', 'artist', 'curator', 'xura', 'riggan', 'muutagan', 'salvager', 'shroudwalker'];
export function enclaveSub(type: string, sub: string | undefined): EnclaveSub | undefined {
  if (type !== 'enclave') return undefined; const n = Number(sub);
  return Number.isInteger(n) && n > 0 && n < ENCLAVE_SUBS.length ? ENCLAVE_SUBS[n] as EnclaveSub : undefined;
}
export interface TerminalContact { idx: number; name: string; type: string; score: number; gest: number; sub?: EnclaveSub; /** 감정 기억 재료(알파 11): 우리와 전쟁·경쟁자·함대 전력(1 상대 열세 2 상대 우세). 옛 모드면 없음 */ em?: { war: boolean; rival: boolean; pw: 0 | 1 | 2; /** 위기 세력과 국경을 맞댐(알파 11) */ front?: boolean }; /** 몰락제국과의 지난 일 비트(알파 11, fallen.ts FE_MEM). 몰락제국이 아니거나 없으면 없음 */ fe?: number }
/** 모드 CONTACT 의 ct(나라 종류 번호, 2026-10-19) → 종류 키. 게임의 GetCountryType 은 번역 이름(「몰락한 제국」「원시」)을 줄 때가 있어서 번호를 믿는다.
 *  번호 0(그 밖)인데 이름이 영문 키가 아니면(번역된 바닐라 종류: 티얀키·쿠톨로이드 등) 'vanilla_other' — 통신 목록에서 뺀다. ct 가 없으면(옛 모드) 그대로. */
export const CT_KEYS = ['', 'default', 'fallen_empire', 'awakened_fallen_empire', 'primitive', 'enclave', 'mindwarden_enclave', 'caravaneer_home', 'dormant_marauders', 'awakened_marauders', 'ruined_marauders', 'enclave_mercenary', 'swarm', 'extradimensional', 'extradimensional_2', 'extradimensional_3', 'ai_empire', 'synth_queen']; // 12~17 은하 위기(알파 11)
export function contactTypeKey(type: string | undefined, ct: string | undefined): string {
  const t = String(type ?? '').trim(); if (ct === undefined || ct === '') return t;
  const n = Number(ct); if (Number.isInteger(n) && n > 0 && n < CT_KEYS.length) return CT_KEYS[n];
  return /^[a-z0-9_]+$/i.test(t) ? t : 'vanilla_other';
}
/** 통신 단말기 목록의 분류(2026-10-24 알파 11): 일반 제국(기계·군집 포함) · 몰락/각성 제국 · 엔클레이브·캐러밴 · 약탈자 · 그 밖(원시·모드 세력 등). */
export type ContactCategory = 'empire' | 'fallen' | 'enclave' | 'marauder' | 'crisis' | 'other';
export const CONTACT_CATEGORIES: ContactCategory[] = ['empire', 'fallen', 'enclave', 'marauder', 'crisis', 'other'];
export function contactCategory(type: string): ContactCategory {
  if (type === 'default') return 'empire';
  if (type === 'fallen_empire' || type === 'awakened_fallen_empire') return 'fallen';
  if (type === 'enclave' || type === 'mindwarden_enclave' || type === 'caravaneer_home' || type === 'enclave_mercenary') return 'enclave';
  if (/marauders$/.test(type)) return 'marauder';
  if (['swarm', 'extradimensional', 'extradimensional_2', 'extradimensional_3', 'ai_empire', 'synth_queen'].includes(type)) return 'crisis'; // 은하 위기(알파 11)
  return 'other';
}
/** Only completed, matching snapshots become visible. Unknown empires never enter this list. */
export class TerminalContacts {
  sid = ''; date = ''; items: TerminalContact[] = [];
  /** 「통신 단절」(2026-10-24): 사용자가 목록에서 지운 상대. items 에서 빠지고(앱 전체가 그 상대를 모르는 것처럼) 여기만 남는다. all = 받은 그대로. */
  all: TerminalContact[] = []; cut: TerminalContact[] = [];
  isCut: (sid: string, idx: number) => boolean = () => false;
  /** 단절 목록이 바뀌면 다시 나눈다. */
  refilter(): void { this.items = this.all.filter((c) => !this.isCut(this.sid, c.idx)); this.cut = this.all.filter((c) => this.isCut(this.sid, c.idx)); }
  /** 플레이어 제국의 정체: 0 일반, 1 기계 지성, 2 군집 의식 */
  playerGest = 0;
  private pending: { sid: string; n: string; date: string; gest: number; items: TerminalContact[] } | null = null;
  reset(): void { this.sid = ''; this.date = ''; this.items = []; this.all = []; this.cut = []; this.pending = null; this.playerGest = 0; }
  feed(m: SllmMessage): boolean {
    const k = m.kv;
    if (m.kind === 'CONTACT_BEGIN') {
      if (!/^\d{1,9}$/.test(k.sid || '') || !k.n) return false;
      this.pending = { sid: k.sid, n: k.n, date: k.date || '', gest: k.gest === '1' ? 1 : k.gest === '2' ? 2 : 0, items: [] }; return false;
    }
    const p = this.pending;
    if (!p || k.sid !== p.sid || k.n !== p.n) return false;
    if (m.kind === 'CONTACT') {
      const idx = Number(k.idx), score = Number(k.score);
      if (k.rel !== 'comm' || !Number.isSafeInteger(idx) || idx <= 0 || !k.name || !Number.isFinite(score)) return false;
      const type = contactTypeKey(k.type, k.ct), sub = enclaveSub(type, k.sub);
      const em = k.war === '0' || k.war === '1' ? { war: k.war === '1', rival: k.rv === '1', pw: (k.pw === '1' ? 1 : k.pw === '2' ? 2 : 0) as 0 | 1 | 2, ...(k.cr === '1' ? { front: true } : {}) } : undefined;
      if (!p.items.some(c => c.idx === idx)) p.items.push({ idx, name: k.name.slice(0, 100), type, score, gest: k.gest === '1' ? 1 : k.gest === '2' ? 2 : 0, ...(sub ? { sub } : {}), ...(em ? { em } : {}), ...(/^\d{1,4}$/.test(k.fe ?? '') && Number(k.fe) > 0 ? { fe: Number(k.fe) } : {}) });
    }
    if (m.kind !== 'CONTACT_END') return false;
    this.sid = p.sid; this.date = p.date; this.playerGest = p.gest; this.all = p.items.sort((a,b) => a.name.localeCompare(b.name, 'ko')); this.pending = null; this.refilter(); return true;
  }
}
