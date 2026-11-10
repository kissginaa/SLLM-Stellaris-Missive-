// 비서가 아는 「앱 안의 실제 기록」(2026-10-31 사용자: 비서는 우리 기능을 거의 다 알아야 함 — LoG 리그 경기 결과 같은 것도).
// 기능마다 짧은 사실 줄(영어, AI 만 읽음)을 내는 함수를 등록해 두고, 통치자가 그 주제를 물을 때만 프롬프트에 넣는다(토큰 아끼기, 게임 명령·추가 LLM 없음).
// 이 파일은 아무것도 가져오지 않는다 — 기능 파일이 여기를 가져와 등록하므로 가져오기 고리가 생기지 않는다.

export interface SecFactSource { id: string; kw: string[]; facts: (sid: string) => string[] }
const sources: SecFactSource[] = [];

/** 기능이 자기 사실 줄을 등록한다(같은 id 는 바꿔 끼움). */
export function registerSecFacts(src: SecFactSource): void { const i = sources.findIndex((x) => x.id === src.id); if (i >= 0) sources[i] = src; else sources.push(src); }

/** 질문 낱말과 맞는 기능의 기록만(최대 max 개 기능, 기능마다 14줄·한 줄 400자). 오류는 조용히 건너뜀. */
export function liveFacts(sid: string, question: string, max = 3): string[] {
  const q = String(question || '').toLowerCase(); if (!sid || !q.trim()) return [];
  const hit = sources.map((s) => ({ s, n: s.kw.reduce((n, k) => n + (q.includes(k.toLowerCase()) ? (k.length >= 3 ? 2 : 1) : 0), 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, max);
  const out: string[] = [];
  for (const { s } of hit) {
    let lines: string[] = []; try { lines = s.facts(sid).filter((l) => typeof l === 'string' && l.trim()).slice(0, 14).map((l) => l.slice(0, 400)); } catch { lines = []; }
    if (lines.length) out.push(...lines.map((l) => `[${s.id}] ${l}`));
  }
  return out.length ? ['App records (observed in this save, authoritative; report them accurately, do not invent other results):', ...out] : [];
}
export const secFactSources = (): string[] => sources.map((s) => s.id);
