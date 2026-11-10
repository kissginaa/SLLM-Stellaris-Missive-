// 게임 이름 표로 인물 이름 짓기 — 앱 쪽(2026-10-20). 규칙: src/namegen.ts.
// 게임 폴더 + 켠 모드(ModResources)의 common/name_lists 와 이름 지역화 파일을 한 번 읽어 두고(모드 목록이 바뀌면 다시), 세이브의 종족 비율로 이름을 뽑는다.
// 화면 언어가 한국어면 l_korean 이름이 있으면 그것, 없으면 영어 이름. 재료가 없으면 null — 부르는 쪽이 대신 이름을 쓴다(AI 에게 짓게 하지 않는다).
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { selectedLanguage } from './settings-ui';
import { parseNameLists, parseLocNames, empireName, type NameCulture, type NameGender } from '../namegen';

let cache: { rev: number; lists: Map<string, NameCulture[]>; loc: { en: Record<string, string>; ko: Record<string, string> } } | null = null;
function load() {
  const res = ctx.modCompatibility.resources; res.refresh();
  if (cache && cache.rev === res.revision) return cache;
  const lists = new Map<string, NameCulture[]>(), en: Record<string, string> = {}, ko: Record<string, string> = {};
  try {
    for (const f of res.files('common/name_lists', '.txt')) { try { for (const [k, v] of parseNameLists(res.read(f).toString('utf8'))) lists.set(k, v); } catch { /* 깨진 표는 건너뜀 */ } }
    // 이름 지역화: 파일 이름에 name 이 들어간 것만(게임: localisation/<언어>/name_lists/name_list_*.yml). 한국어·영어만 본다.
    for (const f of res.files('localisation', '.yml')) {
      const base = path.basename(f.relative).toLowerCase(); if (!base.includes('name') || !/l_(english|korean)\.yml$/.test(base)) continue;
      try { const { lang, map } = parseLocNames(res.read(f).toString('utf8')); Object.assign(lang === 'korean' ? ko : en, map); } catch { /* 건너뜀 */ }
    }
  } catch (e) { logDiagnostic('warn', 'namegen.load_failed', { error: e }); }
  cache = { rev: res.revision, lists, loc: { en, ko } };
  logDiagnostic('info', 'namegen.loaded', { lists: lists.size, en: Object.keys(en).length, ko: Object.keys(ko).length });
  return cache;
}
/** 우리 제국(기본) 또는 idx 제국 사람의 이름. 종족은 인구 비율대로 뽑는다. 못 지으면 null. */
export function gameName(g: NameGender, idx = ctx.playerIdx, rand: () => number = Math.random): string | null {
  try {
    const c = load(); if (!c.lists.size) return null;
    const info = ctx.flagProv.portraitInfoFor(idx);
    const mix = info?.pop?.length ? info.pop : info?.mix?.length ? info.mix : info?.founder ? [{ share: 1, cls: info.founder.cls, list: info.founder.list }] : [];
    const loc = selectedLanguage() === 'ko' ? { ...c.loc.en, ...c.loc.ko } : c.loc.en; // i18n-data: 게임 이름 지역화(한국어판 이름이 있을 때만 한국어, 그 밖의 언어는 영어 이름)
    // 세이브 정보가 없으면(새 게임 직후 등) 사람 계열 표로라도 짓는다
    return empireName(mix.length ? mix : [{ share: 1, cls: 'HUM' }], c.lists, loc, g, rand)?.name ?? null;
  } catch (e) { logDiagnostic('warn', 'namegen.failed', { error: e }); return null; }
}
/** 한·영 본명 한 쌍(레전드 오브 갤럭시 선수, 2026-10-30). 같은 씨앗으로 두 번 뽑아 같은 이름의 한국어판·영어판을 얻는다(한국어 이름이 없으면 영어 그대로).
 *  cls 가 있으면 그 종족 계열 이름 표(레전드 — 초상화 종족), 없으면 idx 제국의 종족 비율대로. 재료가 없으면 null(나중에 다시). */
export function namePair(g: NameGender, cls: string | null, seed: number, idx = ctx.playerIdx): { ko: string; en: string } | null {
  try {
    const c = load(); if (!c.lists.size) return null;
    const info = ctx.flagProv.portraitInfoFor(idx);
    const mix = cls ? [{ share: 1, cls }] : info?.pop?.length ? info.pop : info?.mix?.length ? info.mix : info?.founder ? [{ share: 1, cls: info.founder.cls, list: info.founder.list }] : [{ share: 1, cls: 'HUM' }];
    const rnd = () => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const en = empireName(mix, c.lists, c.loc.en, g, rnd())?.name, ko = empireName(mix, c.lists, { ...c.loc.en, ...c.loc.ko }, g, rnd())?.name; // i18n-data: 게임 이름 지역화
    return en ? { en, ko: ko ?? en } : null;
  } catch (e) { logDiagnostic('warn', 'namegen.pair_failed', { error: e }); return null; }
}
