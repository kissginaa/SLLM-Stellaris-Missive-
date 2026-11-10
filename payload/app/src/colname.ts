// 신규 식민지 이름 짓기(명명식, 2026-11-04 사용자). 순수 규칙 — 앱: src/features/colname-app.ts · 화면: ui/office-colname.js
// 사용자 확정: 우리가 직접 개척한 행성(on_colonized)만, 게임을 막지 않는 집무실 알림 한 줄 → 후보 3개(게임 종족 이름 표) + 「기본 이름 그대로」 + 「정착민에게 물어보기」(LLM).
// 후보는 스텔라리스 common/name_lists 의 planet_names(번역 키)에서 뽑는다 — 게임에 이름을 바꿀 때도 번역 키를 그대로 보내 게임 언어로 보인다(콘솔에 글자를 안 넣음).
// 정착민이 지은 이름(LLM)만 글자 그대로 보낸다.
import { parsePdx } from './lore';
import { pickWeighted, listsForClass, locName } from './namegen';

/** 이름 표 하나의 행성 이름: generic(모든 행성) + 행성 종류별(pc_desert 등). */
export interface PlanetNamePool { generic: string[]; byClass: Record<string, string[]> }
export interface ColCandidate { key: string; text: string }
export interface ColAsked { name: string; why: string }
export const COLNAME = { cands: 3, pendingMax: 12, nameMax: 40, whyMax: 140 } as const;

/** name_lists 파일 하나 → { 이름표 키: 행성 이름 }. planet_names 가 없거나 비었으면 뺀다. */
export function parsePlanetNames(text: string): Map<string, PlanetNamePool> {
  const out = new Map<string, PlanetNamePool>();
  let top: ReturnType<typeof parsePdx> = []; try { top = parsePdx(text); } catch { return out; }
  for (const [key, body] of top) {
    if (!key || !Array.isArray(body)) continue;
    const pn = body.find(([k]) => k === 'planet_names')?.[1]; if (!Array.isArray(pn)) continue;
    const pool: PlanetNamePool = { generic: [], byClass: {} };
    for (const [cls, cb] of pn) {
      if (!cls || !Array.isArray(cb)) continue;
      const names = cb.find(([k]) => k === 'names')?.[1]; if (!Array.isArray(names)) continue;
      const ws = names.filter(([k, v]) => k && v === '').map(([k]) => k); if (!ws.length) continue;
      if (cls === 'generic') pool.generic.push(...ws); else (pool.byClass[cls] ??= []).push(...ws);
    }
    if (pool.generic.length || Object.keys(pool.byClass).length) out.set(key, pool);
  }
  return out;
}

/** 우리 제국 종족 비율대로 이름 표를 고르고(종족의 name_list → 없으면 계열 기본 표), 그 표에서 이름 후보를 뽑는다.
 *  cls = 행성 종류 키(pc_desert 등, 모르면 null): 종류별 이름이 있으면 반은 거기서. used = 이미 쓰는 이름(글자) — 겹치면 뺀다. */
export function pickCandidates(mix: Array<{ share: number; cls: string; list?: string }>, lists: Map<string, PlanetNamePool>, loc: Record<string, string>,
  used: Set<string>, rand: () => number, cls: string | null = null, n: number = COLNAME.cands): ColCandidate[] {
  const out: ColCandidate[] = [], seen = new Set<string>();
  const poolsOf = (sp: { cls: string; list?: string }): PlanetNamePool[] => {
    if (sp.list && lists.has(sp.list)) return [lists.get(sp.list)!];
    return listsForClass(sp.cls, lists.keys()).map((k) => lists.get(k)!).filter(Boolean);
  };
  const species = mix.length ? mix : [{ share: 1, cls: 'HUM' }];
  for (let tries = 0; tries < 60 && out.length < n; tries++) {
    const sp = pickWeighted(species, rand()); if (!sp) break;
    let pools = poolsOf(sp); if (!pools.length) pools = poolsOf({ cls: 'HUM' }); if (!pools.length) break;
    const pool = pools[Math.floor(rand() * pools.length)];
    const byCls = cls ? pool.byClass[cls] ?? [] : [];
    const from = byCls.length && (!pool.generic.length || rand() < 0.5) ? byCls : pool.generic.length ? pool.generic : Object.values(pool.byClass).flat();
    if (!from.length) continue;
    const key = from[Math.floor(rand() * from.length)], text = locName(key, loc);
    if (!text || seen.has(key) || used.has(text) || out.some((c) => c.text === text)) continue;
    seen.add(key); out.push({ key, text });
  }
  return out;
}

/** 게임에 보낼 글자 이름 다듬기: 따옴표·괄호·게임 서식 문자(§ £ $ [ ] { } \)·줄바꿈을 뺀다. 비면 null. */
export function cleanColName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\r\n\t]+/g, ' ').replace(/["\\§£$\[\]{}<>|/;=#]/g, '').replace(/\s+/g, ' ').trim().slice(0, COLNAME.nameMax).trim();
  return s.length >= 1 ? s : null;
}
/** 번역 키처럼 생겼는가(이름 표 키만 보낸다). */
export const isNameKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9_]{3,80}$/.test(k);

/** 게임에 보낼 명령: 우리 제국에서 고유 번호 idx 행성의 이름을 바꾼다. name = 번역 키 또는 다듬은 글자. */
export function colNameCommand(req: number, sid: string, idx: number, name: { key: string } | { text: string }): string {
  if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(idx) || idx < 1) throw new Error('INVALID_COLNAME');
  const v = 'key' in name ? (isNameKey(name.key) ? name.key : null) : cleanColName(name.text);
  if (!v) throw new Error('INVALID_COLNAME');
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } every_owned_planet = { limit = { is_variable_set = sllm_pl_idx check_variable = { which = sllm_pl_idx value = ${idx} } } set_name = "${v}" } log = "SLLM:COLNAME/;/req=${req}/;/sid=${sid}/;/idx=${idx}/;/status=applied" }`;
}

/** 「정착민에게 물어보기」 AI 지시(영어, 응답 언어는 aiclient). 정착민 목소리로 이름 3개 + 짧은 까닭. JSON. */
export function colNameMessages(a: { planet: string; cls: string; system: string; empire: string; species: string; ethics: string[]; gestalt: boolean }): { role: 'system' | 'user'; content: string }[] {
  const who = a.gestalt ? 'the new drones of a gestalt consciousness (speak as the collective, briefly)' : 'the first settlers who just landed';
  return [{ role: 'system', content: [
    `You are ${who} on a newly colonised world of the Stellaris empire "${a.empire || 'our empire'}". The ruler asks what the colony should be called.`,
    'Propose exactly 3 different planet names that fit the planet and the people. Names must be short (1-3 words, at most 30 characters), pronounceable, and must not reuse the old catalogue name.',
    'For each, give one short reason in the settlers\' own voice (at most 100 characters). Do not invent wars, disasters or named historical heroes.',
    'Output only JSON: {"names": [{"name": "...", "why": "..."}, {"name": "...", "why": "..."}, {"name": "...", "why": "..."}]}',
  ].join('\n') }, { role: 'user', content: [`Current name: ${a.planet}`, a.cls ? `Planet type: ${a.cls}` : '', a.system ? `Star system: ${a.system}` : '', a.species ? `Settlers' species: ${a.species}` : '', a.ethics.length ? `Empire ethics: ${a.ethics.join(', ')}` : ''].filter(Boolean).join('\n') }];
}
/** AI 응답 → 이름 3개까지(다듬기·겹침 제거). 하나도 없으면 null. */
export function readColNames(raw: string, old: string): ColAsked[] | null {
  const t = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let j: unknown = null; try { j = JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { j = JSON.parse(m[0]); } catch { /* 없음 */ } }
  const arr = j && typeof j === 'object' && Array.isArray((j as { names?: unknown }).names) ? (j as { names: unknown[] }).names : [];
  const out: ColAsked[] = [];
  for (const x of arr) {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const name = cleanColName(o.name); if (!name || name === old || out.some((y) => y.name === name)) continue;
    const why = typeof o.why === 'string' ? o.why.replace(/\s+/g, ' ').trim().slice(0, COLNAME.whyMax) : '';
    out.push({ name, why }); if (out.length >= COLNAME.cands) break;
  }
  return out.length ? out : null;
}
