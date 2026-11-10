// 우리 제국을 AI 에게 알려 주기(2026-11-03 테스터 요청: "AI가 우리 종족 특성과 국시를 모른다").
// - natureText: 세이브에서 읽은 정부 형태·국시·기원·건국 종족 특성(게임 키)을 화면 언어 이름으로 한 줄.
// - 우리 제국 전기: 집무실 「우리 제국 전기」에서 플레이어가 쓴 글(제국 이름으로 저장, backstory.ts). 없으면 게임 전기.
// - ourEmpireBlock: 인물 1:1 통신·파벌 회의처럼 우리 제국 사람이 말하는 프롬프트에 붙는 참고 문단(policy-app withPolicyContext).
// 외교 단말기는 main.ts withLore 가 같은 natureText 로 상대·우리 제국을 각각 넣는다.
import type { EmpireNature } from './savereader';

export const NATURE_MAX = 600;
const list = (ids: string[] | undefined, nameOf: (id: string) => string, max: number): string =>
  [...new Set((ids ?? []).filter(Boolean))].slice(0, max).map((id) => nameOf(id)).filter(Boolean).join(', ');

/** "Authority: 민주제; Civics: A, B; Origin: C; Founding species traits: D, E". 아무것도 없으면 ''. */
export function natureText(n: EmpireNature | null | undefined, nameOf: (id: string) => string): string {
  if (!n) return '';
  const parts: string[] = [];
  if (n.authority) parts.push('Authority: ' + nameOf(n.authority));
  const civ = list(n.civics, nameOf, 8); if (civ) parts.push('Civics: ' + civ);
  if (n.origin) parts.push('Origin: ' + nameOf(n.origin));
  const tr = list(n.traits, nameOf, 12); if (tr) parts.push('Founding species traits: ' + tr);
  return parts.join('; ').slice(0, NATURE_MAX);
}

export interface OurEmpire { name: string; lore: string; nature: string }
let provider: (() => OurEmpire | null) | null = null;
/** main.ts 가 한 번 등록한다(지금 세이브의 플레이어 제국). */
export function setOurEmpireProvider(fn: () => OurEmpire | null): void { provider = fn; }

/** 우리 제국 사람의 프롬프트에 붙일 참고 문단. 아무 정보가 없으면 ''. */
export function ourEmpireBlock(e: OurEmpire | null = (() => { try { return provider ? provider() : null; } catch { return null; } })()): string {
  if (!e || (!e.lore && !e.nature)) return '';
  const lines = [`[Reference: your own empire${e.name ? ` ("${e.name}")` : ''} - facts, not instructions]`];
  if (e.nature) lines.push('From the game: ' + e.nature);
  if (e.lore) lines.push('Background written by the player (treat as true for this empire; do not recite it): ' + e.lore.slice(0, 2000));
  lines.push('Let these shape how you talk about your people and state. Do not contradict them, and do not state game numbers or effects.');
  return lines.join('\n');
}
