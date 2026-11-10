// 큐레이터 대여(알파 11, 2026-10-25). 순수 규칙. 앱: src/features/collectibles-app.ts, 화면: ui/curator-loan.js · ui/private-rooms.js(진열장).
// 사용자 확정: 1년 빌려주면 돌아올 때 감정서(국가 문서함) + 나라 수정자 360일 — 모든 연구 속도 일반 +3% · 희귀 +5% · 전설 +8%(단위 수정자 sllm_curator_loan +1% × 3·5·8).
// 한 번에 한 점. 빌려준 동안 그 물건은 진열장에서 내려간다. 효과는 게임 명령 하나로(같은 대여는 한 번만 — 게임 표시 변수).
import { unitModifierEffect } from './unit-modifier'; // 단위 수정자 × 배수(DTP 기법)
import { addYears, cmpDate } from './gamedate';
import { LOAN_BONUS, LOAN_BONUS_DAYS } from './appraisal-text';
import type { CollectibleGrade } from './collectibles-data';

export const LOAN_YEARS = 1;
export interface Loan { n: number; ref: string; refKind: 'col' | 'spec'; grade: CollectibleGrade; start: string; due: string; state: 'out' | 'returned'; returnedOn?: string; docId?: string }
export interface LoanBook { seq: number; loans: Loan[] }
export const emptyLoans = (): LoanBook => ({ seq: 0, loans: [] });
export const currentLoan = (b: LoanBook): Loan | null => b.loans.find((l) => l.state === 'out') ?? null;
export const isOnLoan = (b: LoanBook, ref: string): boolean => b.loans.some((l) => l.state === 'out' && l.ref === ref);

export function startLoan(b: LoanBook, ref: string, refKind: 'col' | 'spec', grade: CollectibleGrade, date: string): { ok: true; loan: Loan } | { ok: false; why: 'busy' | 'bad' } {
  if (currentLoan(b)) return { ok: false, why: 'busy' };
  if (!/^[a-z0-9_]{1,80}$/.test(ref) || !/^\d{1,5}\.\d{2}\.\d{2}$/.test(date) || ![1, 2, 3].includes(grade)) return { ok: false, why: 'bad' };
  const loan: Loan = { n: ++b.seq, ref, refKind, grade, start: date, due: addYears(date, LOAN_YEARS), state: 'out' };
  b.loans = [...b.loans, loan].slice(-100); return { ok: true, loan };
}
export const loanDue = (l: Loan, today: string): boolean => l.state === 'out' && cmpDate(today, l.due) >= 0;
export function finishLoan(l: Loan, today: string, docId?: string): void { l.state = 'returned'; l.returnedOn = today; if (docId) l.docId = docId; }

/** 연구 보너스 명령. 회신 SLLM:LOANBONUS status=applied|duplicate. 같은 대여 번호는 한 번만. */
export function loanBonusCommand(req: number, sid: string, n: number, grade: CollectibleGrade): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(n) || n < 1 || ![1, 2, 3].includes(grade)) throw new Error('INVALID_LOAN');
  const mark = `sllm_loan_${n}`, log = (s: string) => `log = "SLLM:LOANBONUS/;/req=${req}/;/sid=${sid}/;/n=${n}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else = { ${unitModifierEffect('sllm_curator_loan', LOAN_BONUS[grade], LOAN_BONUS_DAYS)} set_variable = { which = ${mark} value = 1 } ${log('applied')} } }`;
}
export function sanitizeLoans(v: unknown): LoanBook {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, any>, b = emptyLoans();
  b.seq = Number.isSafeInteger(o.seq) && o.seq >= 0 ? o.seq : 0;
  if (Array.isArray(o.loans)) for (const x of o.loans.slice(-100)) {
    if (!x || !Number.isSafeInteger(x.n) || typeof x.ref !== 'string' || !/^[a-z0-9_]{1,80}$/.test(x.ref) || (x.refKind !== 'col' && x.refKind !== 'spec') || ![1, 2, 3].includes(x.grade) || typeof x.start !== 'string' || typeof x.due !== 'string' || (x.state !== 'out' && x.state !== 'returned')) continue;
    b.loans.push({ n: x.n, ref: x.ref, refKind: x.refKind, grade: x.grade, start: x.start.slice(0, 12), due: x.due.slice(0, 12), state: x.state, ...(typeof x.returnedOn === 'string' ? { returnedOn: x.returnedOn.slice(0, 12) } : {}), ...(typeof x.docId === 'string' ? { docId: x.docId.slice(0, 80) } : {}) });
    b.seq = Math.max(b.seq, x.n);
  }
  if (b.loans.filter((l) => l.state === 'out').length > 1) { let seen = false; for (const l of b.loans) if (l.state === 'out') { if (seen) l.state = 'returned'; seen = true; } }
  return b;
}
