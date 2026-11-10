// 집무실 연락처 — 내 지도자 명단(2026-10-18). 순수 로직: 매달 모드가 보내는 LEADER·LEADERAT·LEADER_END 묶음을 모아
// 세이브별 인물 장부에 반영한다. 지도자 번호(lid)는 함대 사령부와 같은 번호라 같은 사람으로 이어진다.
// 명단에서 사라진 인물은 지우지 않고 gone(날짜)으로 남긴다(뒤에 추모관·작별 편지에서 쓴다).
import * as fs from 'fs';
import { logDiagnostic } from './diagnostics';
import { parseLeaderAge } from './retired'; // 나이·수명(2026-10-23 은퇴 생활)

export type LeaderClass = 'commander' | 'official' | 'scientist';
export interface LeaderSeen { lid: number; name: string; cls: LeaderClass; lv: number; ruler: boolean; council: boolean; fleet?: string; traits?: string[]; /** 평의회 직책 번호(cabinet-meeting.ts COUNCIL_POS +1, 2026-10-19). 0·없음 = 모름 */ cpos?: number; /** 함대·과학선·구역(총독)을 맡음(모드 asg=1, 2026-10-19 내각 회의 홀로그램 참석) */ asg?: boolean } // traits: 이번 달에 특성을 읽었을 때만(tr=1) 들어 있다
/** 나이·수명(2026-10-23 은퇴 생활): 모드 LEADER 줄 age·life·svc·imm. 옛 모드면 없음. */
export interface LeaderAge { age?: number; life?: number; svc?: number; immortal?: boolean }
export interface Person extends LeaderSeen, LeaderAge { first: string; last: string; gone?: string; names?: string[] }
export interface PeopleSave { persons: Record<string, Person> }

const CLS: LeaderClass[] = ['commander', 'official', 'scientist'];

/** 한 달 묶음을 모은다. 묶음 끝(LEADER_END)에서 명단과 날짜를 돌려준다. */
export class PeopleCollector {
  private cur = new Map<number, LeaderSeen>();
  feed(kind: string, kv: Record<string, string>): { list: LeaderSeen[]; date: string } | null {
    if (kind === 'LEADER') {
      const lid = Number(kv.lid), name = String(kv.name ?? '').trim();
      if (!Number.isInteger(lid) || lid <= 0 || !name) return null;
      const cls = (CLS.includes(kv.cls as LeaderClass) ? kv.cls : 'official') as LeaderClass;
      const lv = Math.max(0, Math.min(20, Math.round(Number(kv.lv) || 0)));
      this.cur.set(lid, { ...parseLeaderAge(kv), lid, name: name.slice(0, 60), cls, lv, ruler: kv.ruler === '1', council: kv.council === '1', ...(kv.tr === '1' ? { traits: [] } : {}), ...(kv.asg === '1' ? { asg: true } : {}), ...(Number(kv.cpos) > 0 && Number.isSafeInteger(Number(kv.cpos)) ? { cpos: Number(kv.cpos) } : {}) });
      return null;
    }
    if (kind === 'LTRAIT') { // 특성 키(바닐라 지도자 특성). 같은 묶음의 LEADER 뒤에 온다
      const p = this.cur.get(Number(kv.lid)), t = String(kv.t ?? '').trim();
      if (p && p.traits && /^[A-Za-z0-9_]{1,80}$/.test(t) && !p.traits.includes(t) && p.traits.length < 40) p.traits.push(t);
      return null;
    }
    if (kind === 'LEADERAT') {
      const p = this.cur.get(Number(kv.lid)), f = String(kv.fleet ?? '').trim();
      if (p && f) p.fleet = f.slice(0, 60);
      return null;
    }
    if (kind === 'LEADER_END') { const list = [...this.cur.values()]; this.cur.clear(); return { list, date: String(kv.date ?? '').trim() }; }
    return null;
  }
}

/** 이번 달 명단을 장부에 반영한다. 새 인물·떠난 인물·이름이 바뀐 인물을 돌려준다. 빈 명단은 반영하지 않는다(읽기 실패로 모두 떠난 것처럼 되지 않게). */
export function applyRoster(s: PeopleSave, list: LeaderSeen[], date: string): { added: number[]; gone: number[]; renamed: number[] } {
  const out = { added: [] as number[], gone: [] as number[], renamed: [] as number[] };
  if (!list.length) return out;
  const seen = new Set<number>();
  for (const l of list) {
    seen.add(l.lid);
    const k = String(l.lid), p = s.persons[k];
    if (!p) { s.persons[k] = { ...l, first: date, last: date }; out.added.push(l.lid); continue; }
    if (p.name !== l.name) { (p.names ??= []).includes(p.name) || p.names.push(p.name); if (p.names.length > 5) p.names.splice(0, p.names.length - 5); out.renamed.push(l.lid); }
    const back = !!p.gone;
    const keep = p.traits; Object.assign(p, l, { last: date }); if (!l.fleet) delete p.fleet; if (!l.cpos) delete p.cpos; if (!l.asg) delete p.asg; if (back) delete p.gone; // 같은 번호가 다시 보이면 돌아온 것
    if (!l.traits && keep) p.traits = keep; // 특성을 읽지 않은 달에는 지난 특성 그대로
  }
  for (const [k, p] of Object.entries(s.persons)) if (!p.gone && !seen.has(Number(k))) { p.gone = date; out.gone.push(p.lid); }
  return out;
}

export class PeopleStore {
  private data: Record<string, PeopleSave> = {};
  constructor(private file: string) {
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j && typeof j === 'object') this.data = j; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'people', file, error: e }); }
  }
  get(sid: string): PeopleSave { const s = (this.data[sid] ??= { persons: {} }); s.persons ??= {}; return s; }
  save(): void { try { fs.writeFileSync(this.file, JSON.stringify(this.data), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'people', file: this.file, error: e }); } }
}

/** 연락처 역할: 통치자 > (과학자) > 총독(행성 목록의 총독 이름과 맞으면) > 제독(함대가 있으면) > 장군(지상전 기록만 있으면) > 지휘관·관료. */
export type ContactRole = 'ruler' | 'governor' | 'admiral' | 'general' | 'scientist' | 'commander' | 'official';
export function contactRole(p: { cls: LeaderClass; ruler: boolean; fleet?: string }, isGovernor: boolean, groundOnly: boolean): ContactRole {
  if (p.ruler) return 'ruler';
  if (p.cls === 'scientist') return 'scientist';
  if (p.cls === 'official') return isGovernor ? 'governor' : 'official';
  if (p.fleet) return 'admiral';
  return groundOnly ? 'general' : 'commander';
}
