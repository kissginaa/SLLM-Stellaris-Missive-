#!/usr/bin/env node
// 총독 방침 직접 건설 생성기(2026-11-03 사용자 결정: 「총독 방침」 자동화를 플레이어가 켜지 않아도 짓게).
// 게임 데이터(지구·구역·구역 칸·건물·전역 변수·인라인 스크립트)를 읽어 연결 모드의 스크립트를 만든다.
//   - 연구 조건(prerequisites) → owner has_technology, 지을 수 있는 조건(potential·allow·unlock) → 원문 그대로
//   - 비용(resources.cost, 인라인 nomadic_cost_switcher 포함)·건설 기간(base_buildtime) → @변수를 숫자로 풀어서
//   - 칸 고르기(어느 지구·구역·몇 번째 칸)는 우리 규칙(아래 MANDATES 순서) + 완성할 때 실제로 들어갔는지 세어 보고 안 됐으면 돌려줌
// 게임 패치 뒤에는 다시 돌리면 된다:  node tools/gen-gov-build.js "<스텔라리스 폴더>" payload/app/tester-mod
// 결과: common/scripted_triggers/sllm_gov_build_gen.txt, common/scripted_effects/sllm_gov_build_gen.txt (손으로 고치지 말 것)
'use strict';
const fs = require('fs');
const path = require('path');

// ---- 방침별 목록(옛 colony_automation/sllm_gov_automation.txt 와 같은 키·순서). first: 먼저 지을 종류.
const MANDATES = {
  research: { first: 'zone', d: ['district_city', 'district_hive', 'district_nexus', 'district_arcology_housing', 'district_rw_city', 'district_hab_science', 'district_hab_housing', 'district_ark_city'],
    z: ['zone_research', 'zone_habitat_research', 'zone_research_arcology', 'zone_research_ring_world', 'zone_minerals_physics', 'zone_research_nexus', 'zone_research_hive', 'zone_ark_research_unity', 'zone_ark_research_unity_gestalt', 'zone_ark_reactor_physics'],
    b: ['building_vultaum_reality_computer', 'building_institute', 'building_supercomputer', 'building_archaeostudies_faculty', 'building_research_efficiency_1', 'building_research_upkeep_1', 'building_engineering_facility_1', 'building_physics_lab_1', 'building_biolab_1'] },
  foundry: { first: 'zone', d: ['district_city', 'district_hive', 'district_nexus', 'district_arcology_housing', 'district_rw_city', 'district_hab_housing', 'district_ark_city'],
    z: ['zone_foundry', 'zone_foundry_arcology', 'zone_foundry_ring_world', 'zone_foundry_nexus', 'zone_foundry_hive', 'zone_ark_foundry', 'zone_ark_industrial', 'zone_ark_shipwright'],
    b: ['building_ministry_production', 'building_production_center', 'building_foundry_efficiency_1', 'building_foundry_upkeep_1', 'building_foundry_1'] },
  factory: { first: 'zone', d: ['district_city', 'district_hive', 'district_nexus', 'district_arcology_housing', 'district_rw_city', 'district_hab_housing', 'district_ark_city'],
    z: ['zone_factory', 'zone_factory_arcology', 'zone_factory_ring_world', 'zone_factory_nexus', 'zone_factory_hive', 'zone_ark_industrial'],
    b: ['building_ministry_production', 'building_production_center', 'building_factory_efficiency_1', 'building_factory_upkeep_1', 'building_factory_1'] },
  mining: { first: 'district', d: ['district_mining', 'district_hab_mining'],
    z: ['zone_subterranean_urban', 'zone_minerals_physics', 'zone_minerals', 'zone_minerals_nexus', 'zone_minerals_hive'],
    b: ['building_crystal_mines', 'building_mineral_purification_plant', 'building_mining_districts_1'] },
  generator: { first: 'district', d: ['district_generator', 'district_hab_energy', 'district_rw_urban_1', 'district_ark_generator'],
    z: ['zone_energy', 'zone_energy_ring_world', 'zone_energy_nexus', 'zone_energy_hive', 'zone_ark_engine_bypass'],
    b: ['building_energy_grid', 'building_mote_harvesters', 'building_generator_districts_1'] },
  farming: { first: 'district', d: ['district_farming', 'district_rw_urban_1', 'district_ark_basic'],
    z: ['zone_agrarian_anglers', 'zone_anglers', 'zone_agrarian_urban', 'zone_food', 'zone_food_ring_world', 'zone_food_hive', 'zone_ark_food'],
    b: ['building_food_processing_facility', 'building_gas_extractors', 'building_farming_districts_1'] },
  urban: { first: 'zone', d: ['district_city', 'district_hive', 'district_nexus', 'district_arcology_housing', 'district_rw_city', 'district_hab_housing', 'district_ark_city'],
    z: ['zone_trade', 'zone_ark_waystation_trade'],
    b: ['building_galactic_stock_exchange', 'building_commercial_megaplex', 'building_commercial_zone'] },
  fortress: { first: 'zone', d: ['district_city', 'district_hive', 'district_nexus', 'district_arcology_housing', 'district_rw_city', 'district_hab_housing', 'district_ark_military'],
    z: ['zone_fortress', 'zone_fortress_arcology', 'zone_fortress_ring_world', 'zone_fortress_nexus', 'zone_fortress_hive', 'zone_ark_missile_silos'],
    b: ['building_dread_encampment', 'building_military_academy', 'building_planetary_shield_generator', 'building_stronghold'] },
};
// (급한 일 건물은 도시 지구들(MANDATES.urban.d)의 정부 구역 → 도시 구역 순서로 칸을 본다. 정부 구역은 include = { all } 이라 무엇이든 받는다.)
// ---- 급한 일(2026-11-05, 사용자 「행성총독 자동화 개선」): 방침보다 먼저 살핀다. 조건(sllm_gov_triggers.txt, 손으로 쓴 것)이 맞으면 이 목록에서 하나.
//   why 번호는 로그(/;/why=…)와 앱 총독 보고(src/govpolicy.ts GOV_WHY)에 쓰인다. 0 = 방침대로.
//   d: 지구, b: 건물(z: 건물이 들어갈 도시 구역 — 정부 구역을 먼저 본다). 게임자 쪽 조건(potential)이 맞지 않는 건물은 알아서 빠진다(군체·기계는 그쪽 건물만).
// 로그 한 줄(앱이 읽는다, 2026-11-05). why 는 변수 sllm_gov_why 를 그대로 찍는다(0 방침 · FIXES 의 why 번호) — 로그 문자열에 $매개변수$ 를 넣으면 4.5.2 가 깨뜨려서(F-39).
const glog = (kind, key, ok) => `log = "SLLM:GOVBUILD/;/kind=${kind}/;/key=${key}/;/ok=${ok}/;/why=\\\\[This.sllm_gov_why]/;/pl=\\\\[This.GetName]"`;
const URBAN_Z = ['zone_unity', 'zone_trade', 'zone_fortress', 'zone_research_physics', 'zone_research_society', 'zone_research_engineering', 'zone_resort'];
const FIXES = [
  { why: 1, tag: 'housing', when: 'sllm_gov_short_housing', d: MANDATES.urban.d, b: ['building_luxury_residence', 'building_communal_housing', 'building_drone_storage', 'building_hive_warren'], z: URBAN_Z },
  { why: 2, tag: 'energy', when: 'sllm_gov_short_energy', d: MANDATES.generator.d, b: [], z: [], lock: true },
  { why: 3, tag: 'food', when: 'sllm_gov_short_food', d: MANDATES.farming.d, b: [], z: [], lock: true },
  { why: 4, tag: 'minerals', when: 'sllm_gov_short_minerals', d: MANDATES.mining.d, b: [], z: [], lock: true },
  { why: 5, tag: 'amenity', when: 'sllm_gov_short_amenity', d: [], b: ['building_luxury_residence', 'building_communal_housing', 'building_holo_theatres', 'building_medical_1', 'building_drone_storage', 'building_hive_warren'], z: URBAN_Z },
  { why: 6, tag: 'crime', when: 'sllm_gov_crime_high', d: [], b: ['building_precinct_house', 'building_state_academy', 'building_sentinel_posts'], z: URBAN_Z },
];
const MANDATE_ORDER = ['research', 'foundry', 'factory', 'mining', 'generator', 'farming', 'urban', 'fortress']; // 앱 src/govpolicy.ts GOV_POLICIES 와 같은 순서
const BLOCK_DAYS = 360; // 칸이 없어 못 지은 항목은 이만큼 다시 고르지 않는다
const PROG_BASE = 35, PROG_BOLD = 3, PROG_VET = 3; // 한 달 진척(일): 30일 × 총독 관할 +15% · 대담 +10% · 숙련 +10%
const FRUGAL = 0.95; // 꼼꼼한 총독: 건설비 -5%
// 부담 나누기(2026-11-05, 사용자 승인 6번): 한 달에 나라 전체에서 새로 시작하는 공사는 이만큼까지(국가 변수 sllm_gov_starts, sllm_gov.1 이 달마다 0으로).
// 지을 게 없던 행성은 IDLE_DAYS 동안 다시 고르지 않는다(고르기 조건이 무거워서 — 렉 줄이기). 방침을 바꾸면 앱이 이 표식을 뗀다.
const START_CAP = 3, IDLE_DAYS = 60;
// 적자 메우기는 자원마다 한 번에 한 행성만(국가 표식 sllm_gov_fixing_<자원>, 완성하면 떼고, 혹시 남아도 LOCK_DAYS 뒤 사라짐) — 모든 행성이 같은 달에 발전 지구를 몰아 짓지 않게.
const LOCK_DAYS = 400;
// 헐기(2026-11-05, 사용자 승인 2번): 방침과 맞지 않는 일자리 건물이 한 채 몫 일자리가 통째로 비어 있고, 실업자도 없고, 칸이 모자라거나 에너지가 적자면
//   그 상태가 PRUNE_MONTHS(기질별: 꼼꼼 12 · 보통 6 · 대담 3) 달 이어질 때 한 채 헌다. 헌 칸은 다음 고르기에서 방침대로 채운다.
//   헐 수 있는 건 아래 목록뿐(연구소·공장·상업·주둔지 계열). 유일 건물·자원 건물·급한 일 건물·지구 칸 건물은 절대 헐지 않는다.
const PRUNABLE = ['building_physics_lab_1', 'building_physics_lab_2', 'building_physics_lab_3', 'building_biolab_1', 'building_biolab_2', 'building_biolab_3',
  'building_engineering_facility_1', 'building_engineering_facility_2', 'building_engineering_facility_3', 'building_foundry_1', 'building_foundry_2', 'building_foundry_3',
  'building_factory_1', 'building_factory_2', 'building_factory_3', 'building_commercial_zone', 'building_commercial_megaplex', 'building_stronghold', 'building_fortress'];
const PRUNE_MONTHS = { frugal: 12, normal: 6, bold: 3 };

// ---- 읽기 도구 ----------------------------------------------------------------------
const readText = (f) => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
const listTxt = (dir) => { try { return fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort().map((f) => path.join(dir, f)); } catch { return []; } };
const stripComments = (s) => s.replace(/"(?:[^"\\]|\\.)*"|#[^\n]*/g, (m) => (m[0] === '#' ? '' : m));

/** inline_script = { script = x A = 1 } / inline_script = "x" 를 파일 내용으로 바꾼다($A$ 치환, 여러 겹). 파일이 없으면 그대로 둔다(게임이 푼다). */
function expandInline(text, inlineDir, depth = 0) {
  if (depth > 6) return text;
  let out = '', i = 0;
  const re = /\binline_script\s*=\s*/g; let m;
  while ((m = re.exec(text))) {
    let j = m.index + m[0].length, script = '', params = {}, end = j;
    if (text[j] === '{') {
      let d = 0, k = j; for (; k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}') { d--; if (d === 0) break; } }
      const body = text.slice(j + 1, k); end = k + 1;
      for (const t of body.matchAll(/([A-Za-z0-9_]+)\s*=\s*("[^"]*"|[^\s{}]+)/g)) { const v = t[2].replace(/^"|"$/g, ''); if (t[1] === 'script') script = v; else params[t[1]] = v; }
    } else { const t = /^("[^"]*"|[^\s{}]+)/.exec(text.slice(j)); if (!t) continue; script = t[1].replace(/^"|"$/g, ''); end = j + t[1].length; }
    const file = path.join(inlineDir, script + '.txt');
    if (!script || !fs.existsSync(file)) continue;
    let body = stripComments(readText(file)).replace(/\$([A-Za-z0-9_]+)\$/g, (_, k) => (params[k] !== undefined ? params[k] : `$${k}$`));
    body = expandInline(body, inlineDir, depth + 1);
    out += text.slice(i, m.index) + '\n' + body + '\n'; i = end; re.lastIndex = end;
  }
  return out + text.slice(i);
}

/** 패러독스 스크립트 → [{k, op, v(string | 노드 배열), s, e}] (s·e = 원문에서의 위치, 블록 원문을 그대로 베끼려고). */
function parse(text) {
  const toks = []; const re = /"(?:[^"\\]|\\.)*"|[{}]|<=|>=|!=|==|[=<>]|[^\s{}=<>"]+/g; let m;
  while ((m = re.exec(text))) toks.push({ t: m[0], s: m.index, e: m.index + m[0].length });
  let p = 0;
  const block = () => { // p 는 '{' 다음
    const out = [];
    while (p < toks.length && toks[p].t !== '}') {
      const a = toks[p++];
      if (p < toks.length && /^(=|<|>|<=|>=|!=|==)$/.test(toks[p].t)) {
        const op = toks[p++].t; const b = toks[p];
        if (!b) break;
        if (b.t === '{') { p++; const v = block(); const close = toks[p++]; out.push({ k: a.t, op, v, s: a.s, e: close ? close.e : text.length, bs: b.s }); }
        else { p++; out.push({ k: a.t, op, v: b.t, s: a.s, e: b.e }); }
      } else if (a.t === '{') { const v = block(); p++; out.push({ k: '', op: '', v, s: a.s, e: toks[p - 1] ? toks[p - 1].e : text.length }); }
      else out.push({ k: a.t, op: '', v: null, s: a.s, e: a.e });
    }
    return out;
  };
  return block();
}
const get = (nodes, k) => nodes && nodes.find((n) => n.k === k);
const getAll = (nodes, k) => (nodes || []).filter((n) => n.k === k);
const words = (n) => (n && Array.isArray(n.v) ? n.v.map((x) => x.k.replace(/^"|"$/g, '')).filter(Boolean) : []);

// ---- 게임 데이터 모으기 --------------------------------------------------------------------
function loadVars(common) {
  const vars = {};
  for (const f of listTxt(path.join(common, 'scripted_variables'))) for (const t of stripComments(readText(f)).matchAll(/^\s*@([A-Za-z0-9_]+)\s*=\s*(-?[0-9.]+)/gm)) vars[t[1]] = Number(t[2]);
  return vars;
}
function loadDefs(dir, inlineDir, gvars) {
  const defs = {};
  for (const f of listTxt(dir)) {
    const raw = stripComments(readText(f)), local = { ...gvars };
    for (const t of raw.matchAll(/^\s*@([A-Za-z0-9_]+)\s*=\s*(-?[0-9.]+)/gm)) local[t[1]] = Number(t[2]);
    const text = expandInline(raw, inlineDir);
    for (const n of parse(text)) if (Array.isArray(n.v) && /^[a-z]/.test(n.k)) defs[n.k] = { key: n.k, nodes: n.v, text, vars: local, file: path.basename(f) };
  }
  return defs;
}
/** 원문 블록 안쪽(중괄호 사이)만. 없으면 ''. @변수는 숫자로. */
function inner(def, node) {
  if (!node || !Array.isArray(node.v)) return '';
  const s = def.text.slice(node.bs + 1, node.e - 1);
  return s.replace(/@([A-Za-z0-9_]+)/g, (m, k) => (def.vars[k] !== undefined ? String(def.vars[k]) : m)).replace(/\s+/g, ' ').trim();
}
const num = (def, v) => { if (v === undefined || v === null) return NaN; if (/^-?[0-9.]+$/.test(v)) return Number(v); const m = /^@([A-Za-z0-9_]+)$/.exec(v); return m && def.vars[m[1]] !== undefined ? def.vars[m[1]] : NaN; };
/** 프레임(planet scope)에서 못 쓰는 범위 참조가 있으면 베끼지 않는다(우리 이벤트에서는 root=나라, from 없음). */
const UNSAFE = /\b(root|ROOT|from|FROM|fromfrom|prev|PREV|prevprev|this|THIS)\b/;

/** 비용 변형: [{trigger, res:{minerals: 800}}]. 비용 트리거 안의 from(?)는 비용 문맥에서 소유국이라 owner 로 바꾼다. */
function costsOf(def) {
  const out = [];
  const res = get(def.nodes, 'resources'); if (!res) return out;
  for (const c of getAll(res.v, 'cost')) {
    if (!Array.isArray(c.v)) continue;
    const trig = get(c.v, 'trigger'); let mult = 1; const r = {};
    for (const x of c.v) {
      if (x.k === 'trigger' || !x.op) continue;
      if (x.k === 'mult') { const v = num(def, x.v); mult = Number.isFinite(v) ? v : NaN; continue; }
      if (typeof x.v === 'string') { const v = num(def, x.v); if (!Number.isFinite(v)) return null; r[x.k] = v; }
    }
    if (!Number.isFinite(mult)) return null;
    for (const k of Object.keys(r)) r[k] = Math.round(r[k] * mult);
    let t = trig ? inner(def, trig).replace(/\bfrom\?\s*=/g, 'owner? =').replace(/\bfrom\s*=/g, 'owner =') : '';
    if (t && UNSAFE.test(t)) return null;
    if (Object.keys(r).length) out.push({ trigger: t, res: r });
  }
  return out;
}
const buildtime = (def) => { const v = num(def, get(def.nodes, 'base_buildtime')?.v); return Number.isFinite(v) && v > 0 ? Math.round(v) : 360; };
const prereqs = (def) => words(get(def.nodes, 'prerequisites')).filter((t) => /^tech_|^[a-z]/.test(t));

// ---- 스크립트 조각 -----------------------------------------------------------------------
const res = (r, sign, k) => Object.entries(r).map(([n, v]) => `${n} = ${sign * Math.round(v * k)}`).join(' ');
function costEffect(costs, sign) { // sign -1 빼기, +1 돌려주기. 꼼꼼한 총독은 95%.
  if (!costs.length) return '';
  const one = (k) => costs.map((c) => (c.trigger ? `if = { limit = { ${c.trigger} } owner = { add_resource = { ${res(c.res, sign, k)} } } }` : `owner = { add_resource = { ${res(c.res, sign, k)} } }`)).join(' ');
  return `if = { limit = { has_planet_flag = sllm_gov_frugal } ${one(FRUGAL)} } else = { ${one(1)} }`;
}
function costTrigger(costs) { // 국고에 있는가(변형마다, 그 변형이 해당할 때만)
  return costs.map((c) => { const chk = Object.entries(c.res).map(([n, v]) => `resource_stockpile_compare = { resource = ${n} value >= ${Math.round(v)} }`).join(' ');
    return c.trigger ? `if = { limit = { ${c.trigger} } owner = { ${chk} } }` : `owner = { ${chk} }`; }).join(' ');
}
const techTrigger = (list) => (list.length ? `owner = { ${list.map((t) => `has_technology = ${t}`).join(' ')} }` : '');

function main() {
  const gameDir = process.argv[2], modDir = process.argv[3];
  if (!gameDir || !modDir) { console.error('사용법: node tools/gen-gov-build.js <스텔라리스 폴더> <연결 모드 폴더>'); process.exit(2); }
  const common = path.join(gameDir, 'common');
  const gvars = loadVars(common);
  const inl = path.join(common, 'inline_scripts');
  const D = loadDefs(path.join(common, 'districts'), inl, gvars), Z = loadDefs(path.join(common, 'zones'), inl, gvars), S = loadDefs(path.join(common, 'zone_slots'), inl, gvars), B = loadDefs(path.join(common, 'buildings'), inl, gvars);
  const report = { skipped: [], projects: 0 };

  const zoneSets = (z) => words(get(z.nodes, 'zone_sets'));
  const slotAccepts = (s, z) => {
    const inc = words(get(s.nodes, 'include')), exc = words(get(s.nodes, 'exclude')), incSets = words(get(s.nodes, 'included_zone_sets')), excSets = words(get(s.nodes, 'excluded_zone_sets'));
    if (exc.includes(z.key) || zoneSets(z).some((x) => excSets.includes(x))) return false;
    return inc.includes('all') || inc.includes(z.key) || zoneSets(z).some((x) => incSets.includes(x));
  };
  const zoneAcceptsBuilding = (z, b, allOk = false) => {
    const inc = words(get(z.nodes, 'include')), exc = words(get(z.nodes, 'exclude')), incSets = words(get(z.nodes, 'included_building_sets')), excSets = words(get(z.nodes, 'excluded_building_sets')), bs = words(get(b.nodes, 'building_sets'));
    if (exc.includes(b.key) || bs.some((x) => excSets.includes(x))) return false;
    return (allOk && inc.includes('all')) || inc.includes(b.key) || bs.some((x) => incSets.includes(x));
  };
  /** 구역 z 가 들어갈 수 있는 (지구 종류, 칸 번호 목록, 칸 정의). 칸 번호는 그 지구 zone_slots 안 순서(0부터). start 가 있는 칸(정부 칸)은 뺀다. */
  const hostsOf = (z) => {
    const out = [];
    for (const d of Object.values(D)) {
      const slots = words(get(d.nodes, 'zone_slots'));
      const idx = []; const defs = [];
      slots.forEach((sn, i) => { const s = S[sn]; if (s && !get(s.nodes, 'start') && slotAccepts(s, z)) { idx.push(i); defs.push(s); } });
      if (idx.length) out.push({ d: d.key, idx, slots: defs, allSlots: slots.map((sn) => S[sn]).filter((s) => s && !get(s.nodes, 'start')) });
    }
    return out;
  };
  const okBlock = (def, k) => { const n = get(def.nodes, k); const t = inner(def, n); if (t && UNSAFE.test(t)) return null; return t; };

  const triggers = [], effects = [], finish = [];
  let id = 0;
  const projectsFor = {};
  const zoneHosts = new Map(); // 지구 종류 → 구역 칸 정보(빈 칸 계산용)
  const seen = new Map(); // 같은 항목을 방침 여럿이 쓰면 하나로

  const addProject = (kind, key, mk) => {
    const sig = kind + ':' + key; if (seen.has(sig)) return seen.get(sig);
    const p = mk(); if (!p) { seen.set(sig, null); return null; }
    p.id = ++id; p.kind = kind; p.key = key; seen.set(sig, p); report.projects++;
    const name = `sllm_gov_p${p.id}`;
    triggers.push(`# ${kind} ${key}\n${name}_ok = {\n\tNOT = { has_planet_flag = sllm_gov_blk_${p.id} }\n\t${[p.cond, costTrigger(p.costs)].filter(Boolean).join('\n\t')}\n}`);
    effects.push(`${name}_start = {\n\t${costEffect(p.costs, -1)}\n\tset_variable = { which = sllm_gov_proj value = ${p.id} }\n\tset_variable = { which = sllm_gov_prog value = 0 }\n\tset_variable = { which = sllm_gov_need value = ${p.days} }\n}`);
    if (p.done) effects.push(`${name}_done = {\n${p.done(name, p)}\n}`); else effects.push(`${name}_done = {\n\texport_trigger_value_to_variable = { trigger = ${p.count} parameters = { type = ${key} } variable = sllm_gov_c0 }\n\tset_variable = { which = sllm_gov_c1 value = sllm_gov_c0 }\n${p.tries.map((t) => `\tif = { limit = { check_variable = { which = sllm_gov_c1 value <= sllm_gov_c0 } } ${t} export_trigger_value_to_variable = { trigger = ${p.count} parameters = { type = ${key} } variable = sllm_gov_c1 } }`).join('\n')}\n\tif = { limit = { check_variable = { which = sllm_gov_c1 value <= sllm_gov_c0 } }\n\t\t${costEffect(p.costs, 1)}\n\t\tset_timed_planet_flag = { flag = sllm_gov_blk_${p.id} days = ${BLOCK_DAYS} }\n\t\t${glog(kind, key, 0)}\n\t}\n\telse = { ${glog(kind, key, 1)} }\n}`);
    finish.push(`\telse_if = { limit = { check_variable = { which = sllm_gov_proj value = ${p.id} } } ${name}_done = yes }`);
    return p;
  };

  const districtProject = (key) => addProject('district', key, () => {
    const d = D[key]; if (!d) { report.skipped.push(key + ' (없음)'); return null; }
    const pot = okBlock(d, 'potential'), allow = okBlock(d, 'allow'); const costs = costsOf(d);
    if (pot === null || allow === null || costs === null) { report.skipped.push(key + ' (범위 참조·풀 수 없는 비용)'); return null; }
    return { costs, days: buildtime(d), count: 'num_districts',
      cond: [`num_free_districts = { type = ${key} value > 0 }`, techTrigger(prereqs(d)), pot && `${pot}`, allow && `${allow}`].filter(Boolean).join('\n\t'),
      tries: [`add_district = ${key}`] };
  });
  const zoneProject = (key) => addProject('zone', key, () => {
    const z = Z[key]; if (!z) { report.skipped.push(key + ' (없음)'); return null; }
    const pot = okBlock(z, 'potential'), unlocks = getAll(z.nodes, 'unlock').map((n) => inner(z, n)); const costs = costsOf(z);
    if (pot === null || unlocks.some((u) => UNSAFE.test(u)) || costs === null) { report.skipped.push(key + ' (범위 참조·풀 수 없는 비용)'); return null; }
    const hosts = hostsOf(z).filter((h) => h.slots.every((s) => !UNSAFE.test(inner(s, get(s.nodes, 'unlock')) + inner(s, get(s.nodes, 'potential')))));
    if (!hosts.length) { report.skipped.push(key + ' (들어갈 칸 없음)'); return null; }
    // 빈 칸이 있을 법한가: 이 구역이 들어갈 지구가 있고, 그 지구의 열린 칸 수 > 그 칸들에 들어갈 수 있는 구역 수(대략). 실제 성공 여부는 완성 때 센다.
    // 빈 칸이 있을 법한가: 지구 종류별로 「열린 칸 수 − 그 칸들에 들어갈 수 있는 구역 수」(sllm_gov_zf_<지구>, 고르기 직전 한 번 계산). 실제 성공 여부는 완성 때 센다.
    for (const h of hosts) if (!zoneHosts.has(h.d)) zoneHosts.set(h.d, h);
    return { costs, days: buildtime(z), count: 'num_zones', hosts: hosts.map((h) => h.d),
      cond: [`OR = { ${hosts.map((h) => `AND = { num_districts = { type = ${h.d} value > 0 } check_variable = { which = sllm_gov_zf_${h.d} value > 0 } }`).join(' ')} }`, techTrigger(prereqs(z)), pot, ...unlocks].filter(Boolean).join('\n\t'),
      tries: hosts.flatMap((h) => h.idx.map((i) => `if = { limit = { num_districts = { type = ${h.d} value > 0 } } add_zone = { district = ${h.d} zone = ${key} zone_slot = ${i} replace = no } }`)) };
  });
  const buildingProject = (key, zoneKeys, onlyD = null) => addProject('building', key, () => {
    const b = B[key]; if (!b) { report.skipped.push(key + ' (없음)'); return null; }
    const pot = okBlock(b, 'potential'), allow = okBlock(b, 'allow'); const costs = costsOf(b);
    if (pot === null || allow === null || costs === null) { report.skipped.push(key + ' (범위 참조·풀 수 없는 비용)'); return null; }
    const uniq = placesOf(b, zoneKeys, onlyD);
    if (!uniq.length) { report.skipped.push(key + ' (들어갈 구역 없음)'); return null; }
    const lim = num(b, get(b.nodes, 'planet_limit')?.v);
    return { costs, days: buildtime(b), count: 'num_buildings',
      cond: ['free_building_slots > 0', `OR = { ${uniq.map((p) => `num_zones = { type = ${p.z} value > 0 }`).filter((v, i, a) => a.indexOf(v) === i).join(' ')} }`,
        Number.isFinite(lim) ? `num_buildings = { type = ${key} value < ${lim} in_construction = any }` : `NOT = { num_buildings = { type = ${key} value > 0 in_construction = yes } }`,
        techTrigger(prereqs(b)), pot, allow].filter(Boolean).join('\n\t'),
      tries: addTries(uniq, key) };
  });
  // 건물이 들어갈 자리: 방침 목록의 구역 × 그 구역이 들어가는 지구 (+ 정부 구역). onlyD = 급한 일(도시 지구만, 정부 구역 먼저).
  function placesOf(b, zoneKeys, onlyD, allOk = !!onlyD, max = 12) {
    const places = [], govPlaces = [];
    for (const zk of zoneKeys) { const z = Z[zk]; if (!z || !zoneAcceptsBuilding(z, b)) continue; for (const h of hostsOf(z)) if (!onlyD || onlyD.includes(h.d)) places.push({ d: h.d, z: zk }); }
    // 정부 구역(zone_default 등, 칸의 start)에 들어가는 건물(관청 계열)
    for (const s of Object.values(S)) { const st = get(s.nodes, 'start')?.v; const z = st && Z[st]; if (z && zoneAcceptsBuilding(z, b, allOk)) for (const d of Object.values(D)) if ((!onlyD || onlyD.includes(d.key)) && words(get(d.nodes, 'zone_slots')).includes(s.key)) govPlaces.push({ d: d.key, z: st }); }
    const all = onlyD ? [...govPlaces, ...places] : [...places, ...govPlaces];
    return [...new Map(all.map((p) => [p.d + '|' + p.z, p])).values()].slice(0, max);
  }
  const addTries = (places, key) => places.map((p) => `if = { limit = { num_districts = { type = ${p.d} value > 0 } num_zones = { type = ${p.z} value > 0 } } add_building = { district = ${p.d} zone = ${p.z} building = ${key} } }`);
  /** 칸마다 하나씩 해 보고 개수(variable cnt)가 늘면 멈춘다. */
  const tryUntil = (tries, key, base, cnt, ind) => tries.map((t) => `${ind}if = { limit = { check_variable = { which = ${cnt} value <= ${base} } } ${t} export_trigger_value_to_variable = { trigger = num_buildings parameters = { type = ${key} } variable = ${cnt} } }`).join('\n');

  // 개량(2026-11-05, 사용자 승인 3번): 게임에 건물 개량 효과가 없어서 완성 때 새 건물을 넣고 옛 건물을 뺀다.
  //   ① 빈 칸에 새 건물 → 되면 옛 건물 빼기  ② 빈 칸이 없으면 옛 건물을 빼고 그 자리에 새 건물  ③ 그래도 안 되면 옛 건물을 되돌려 놓고 비용 환불.
  //   비용·기간은 새 건물 것. 빈 일자리가 1개 넘게 남아 있으면 개량하지 않는다(일자리만 늘어남). 차례는 그 방침의 새 건물 다음.
  // 개량 자리는 옛 건물이 정부 구역에 있을 수도 있어 정부 구역(무엇이든 받음)까지 넣는다 — 옛 건물을 뺀 그 칸에 새 건물이 들어가야 하니까. 지구는 방침·도시 지구로 좁힌다.
  const upgradeProject = (oldKey, key, zoneKeys, onlyD, jobsGuard = true) => addProject('upgrade', key, () => {
    const o = B[oldKey], b = B[key]; if (!o || !b) { report.skipped.push(key + ' (없음)'); return null; }
    const pot = okBlock(b, 'potential'), allow = okBlock(b, 'allow'); const costs = costsOf(b);
    if (pot === null || allow === null || costs === null) { report.skipped.push(key + ' (범위 참조·풀 수 없는 비용)'); return null; }
    const newPl = [...new Map([...placesOf(o, zoneKeys, onlyD, true, 20), ...placesOf(b, zoneKeys, onlyD, true, 20)].map((p) => [p.d + '|' + p.z, p])).values()].slice(0, 20);
    const oldPl = placesOf(o, zoneKeys, onlyD, true, 20);
    if (!newPl.length || !oldPl.length) { report.skipped.push(key + ' (들어갈 구역 없음)'); return null; }
    const lim = num(b, get(b.nodes, 'planet_limit')?.v);
    const tn = addTries(newPl, key), to = addTries(oldPl, oldKey);
    return { costs, days: buildtime(b), count: 'num_buildings', old: oldKey,
      cond: [`num_buildings = { type = ${oldKey} value > 0 }`, jobsGuard && 'free_jobs <= 100',
        Number.isFinite(lim) ? `num_buildings = { type = ${key} value < ${lim} in_construction = any }` : `NOT = { num_buildings = { type = ${key} value > 0 in_construction = yes } }`,
        techTrigger(prereqs(b)), pot, allow].filter(Boolean).join('\n\t'),
      tries: tn,
      done: (name, p) => [
        `\texport_trigger_value_to_variable = { trigger = num_buildings parameters = { type = ${key} } variable = sllm_gov_c0 }`,
        `\tset_variable = { which = sllm_gov_c1 value = sllm_gov_c0 }`,
        `\tif = { limit = { num_buildings = { type = ${oldKey} value > 0 } }`,
        tryUntil(tn, key, 'sllm_gov_c0', 'sllm_gov_c1', '\t\t'),
        `\t\tremove_building = ${oldKey}`,
        `\t\tif = { limit = { check_variable = { which = sllm_gov_c1 value <= sllm_gov_c0 } }`,
        tryUntil(tn, key, 'sllm_gov_c0', 'sllm_gov_c1', '\t\t\t'),
        `\t\t\tif = { limit = { check_variable = { which = sllm_gov_c1 value <= sllm_gov_c0 } }`,
        `\t\t\t\texport_trigger_value_to_variable = { trigger = num_buildings parameters = { type = ${oldKey} } variable = sllm_gov_c2 }`,
        `\t\t\t\tset_variable = { which = sllm_gov_c3 value = sllm_gov_c2 }`,
        tryUntil(to, oldKey, 'sllm_gov_c2', 'sllm_gov_c3', '\t\t\t\t'),
        `\t\t\t}`,
        `\t\t}`,
        `\t}`,
        `\tif = { limit = { check_variable = { which = sllm_gov_c1 value <= sllm_gov_c0 } }`,
        `\t\t${costEffect(p.costs, 1)}`,
        `\t\tset_timed_planet_flag = { flag = sllm_gov_blk_${p.id} days = ${BLOCK_DAYS} }`,
        `\t\t${glog('upgrade', key, 0)}`,
        `\t}`,
        `\telse = { ${glog('upgrade', key, 1)} }`].join('\n') };
  });
  /** 건물 목록 → 개량 사슬(1 → 2 → 3) 항목들. */
  const upgradesOf = (keys, zoneKeys, onlyD, jobsGuard = true) => {
    const out = [], seenK = new Set();
    const walk = (k, depth) => { if (depth > 4 || seenK.has(k)) return; seenK.add(k); const d = B[k]; for (const n of words(d && get(d.nodes, 'upgrades'))) { const p = upgradeProject(k, n, zoneKeys, onlyD, jobsGuard); if (p) out.push(p); walk(n, depth + 1); } };
    for (const k of keys) walk(k, 0);
    return out;
  };

  const pick = [];
  for (const m of MANDATE_ORDER) {
    const M = MANDATES[m]; const list = [];
    const ds = M.d.map(districtProject).filter(Boolean), zs = M.z.map(zoneProject).filter(Boolean), bs = M.b.map((k) => buildingProject(k, M.z)).filter(Boolean);
    const us = upgradesOf(M.b, M.z, [...new Set([...M.d, ...MANDATES.urban.d])]);
    const order = M.first === 'district' ? [ds, zs, bs, us] : [zs, bs, us, ds];
    for (const g of order) list.push(...g);
    projectsFor[m] = list;
    const pre = [...new Set(zs.flatMap((p) => p.hosts))].map((d) => `if = { limit = { num_districts = { type = ${d} value > 0 } } sllm_gov_zf_${d} = yes }`).join('\n\t');
    pick.push(`sllm_gov_pick_${m} = {\n\t${pre}\n${list.map((p, i) => `\t${i ? 'else_if' : 'if'} = { limit = { sllm_gov_p${p.id}_ok = yes } sllm_gov_p${p.id}_start = yes set_variable = { which = sllm_gov_why value = 0 } }`).join('\n')}\n}`);
  }
  for (const F of FIXES) {
    const list = [...F.d.map(districtProject), ...F.b.map((k) => buildingProject(k, F.z, MANDATES.urban.d)), ...upgradesOf(F.b, F.z, MANDATES.urban.d, false)].filter(Boolean);
    projectsFor['fix_' + F.tag] = list;
    pick.push(`# 급한 일 ${F.why}: ${F.tag}\nsllm_gov_fix_${F.tag} = {\n${list.map((p, i) => `\t${i ? 'else_if' : 'if'} = { limit = { sllm_gov_p${p.id}_ok = yes } sllm_gov_p${p.id}_start = yes set_variable = { which = sllm_gov_why value = ${F.why} }${F.lock ? ` owner = { set_timed_country_flag = { flag = sllm_gov_fixing_${F.tag} days = ${LOCK_DAYS} } }` : ''} }`).join('\n')}\n}`);
  }

  // ---- 헐기: 방침마다 「이 방침에 안 맞는 헐 수 있는 건물」 목록
  const jobsOf = (def) => { // 건물이 주는 일자리 종류 → 한 채 몫(가장 큰 값). 게임 값은 100배(일자리 1 = 100).
    const out = {}; const walk = (nodes) => { for (const n of nodes || []) { if (Array.isArray(n.v)) walk(n.v); else if (/^job_[a-z0-9_]+_add$/.test(n.k) && n.op === '=') { const v = num(def, n.v); if (Number.isFinite(v) && v > 0) { const j = n.k.slice(4, -4); out[j] = Math.max(out[j] || 0, v); } } } };
    walk(def.nodes); return out;
  };
  const ownKeys = (m) => new Set((projectsFor[m] || []).filter((p) => p.kind === 'building' || p.kind === 'upgrade').map((p) => p.key));
  const pruneEff = MANDATE_ORDER.map((m) => {
    const own = ownKeys(m);
    const cands = PRUNABLE.filter((k) => B[k] && !own.has(k)).map((k) => ({ k, jobs: jobsOf(B[k]) })).filter((c) => Object.keys(c.jobs).length);
    const empty = (c) => `num_buildings = { type = ${c.k} value > 0 } OR = { ${Object.entries(c.jobs).map(([j, v]) => `free_jobs_of_type = { job = ${j} value >= ${v} }`).join(' ')} }`;
    return `# 방침 ${m}: 헐 수 있는 건물(방침 밖)\nsllm_gov_prune_${m}_any = {\n\tOR = {\n${cands.map((c) => `\t\tAND = { ${empty(c)} }`).join('\n')}\n\t}\n}\nsllm_gov_prune_${m} = {\n${cands.map((c, i) => `\t${i ? 'else_if' : 'if'} = { limit = { ${empty(c)} } remove_building = ${c.k} ${glog('demolish', c.k, 1)} }`).join('\n')}\n}`;
  });
  const pruneTrig = MANDATE_ORDER.map((m) => pruneEff[MANDATE_ORDER.indexOf(m)].split('\nsllm_gov_prune_' + m + ' = {')[0]);
  const pruneOnly = MANDATE_ORDER.map((m, i) => 'sllm_gov_prune_' + m + ' = {' + pruneEff[i].split('\nsllm_gov_prune_' + m + ' = {')[1]);
  const zfEff = [...zoneHosts.values()].map((h) => {
    const slotsAll = h.allSlots;
    const accepted = Object.values(Z).filter((zz) => slotsAll.some((s) => slotAccepts(s, zz))).map((zz) => zz.key);
    const open = slotsAll.map((s) => { const u = [inner(s, get(s.nodes, 'potential')), inner(s, get(s.nodes, 'unlock'))].filter(Boolean).join(' '); return u ? `if = { limit = { ${u} } change_variable = { which = sllm_gov_zf_${h.d} value = 1 } }` : `change_variable = { which = sllm_gov_zf_${h.d} value = 1 }`; }).join('\n\t');
    const used = accepted.map((k) => `export_trigger_value_to_variable = { trigger = num_zones parameters = { type = ${k} } variable = sllm_gov_zt } subtract_variable = { which = sllm_gov_zf_${h.d} value = sllm_gov_zt }`).join('\n\t');
    return `# ${h.d}: 구역 빈 칸(대략)\nsllm_gov_zf_${h.d} = {\n\tset_variable = { which = sllm_gov_zf_${h.d} value = 0 }\n\t${open}\n\t${used}\n}`;
  });
  const head = (what) => `# 자동 생성(tools/gen-gov-build.js, ${new Date().toISOString().slice(0, 10)}) — 손으로 고치지 말고 생성기를 다시 돌릴 것.\n# 총독 방침 직접 건설: ${what}\n`;
  const trigOut = head('항목별 지을 수 있는가(연구·조건·국고)') + triggers.join('\n\n') + '\n\n' + pruneTrig.join('\n\n') + `

# 헐 거리가 있는가: 지금 방침 밖 건물 한 채 몫 일자리가 비었고 · 실업자 없음 · (빈 건물 칸 없음 또는 에너지 적자)
sllm_gov_prune_due = {
	num_unemployed < 100
	OR = {
		free_building_slots < 1
		owner = { resource_income_compare = { resource = energy value < 0 } }
	}
	OR = {
${MANDATE_ORDER.map((m) => `\t\tAND = { has_planet_flag = sllm_gov_${m} sllm_gov_prune_${m}_any = yes }`).join('\n')}
	}
}
`;
  const effOut = head('시작(비용)·완성(실제로 들어갔는지 세어 보고 안 됐으면 돌려줌)·방침별 고르기·매달 진척') + effects.join('\n\n') + '\n\n' + zfEff.join('\n\n') + '\n\n' + pick.join('\n\n') + `

# 계획 다시 짜기(2026-11-05, 사용자 승인 4번): 행성 등급이 바뀌면(테라포밍·가이아화 등) 「칸이 없어 못 지음」으로 막아 둔 항목을 모두 풀어 준다(sllm_gov.20).
sllm_gov_unblock = {
${Array.from({ length: id }, (_, i) => `\tremove_planet_flag = sllm_gov_blk_${i + 1}`).join('\n')}
}

${pruneOnly.join('\n\n')}

# 헐기(매달, 짓던 것이 없을 때): 헐 거리가 이어지면 달 수를 세고(sllm_gov_dm), 기질별 달 수가 차면 한 채 헐고 쉬기를 푼다. 끊기면 처음부터.
sllm_gov_prune = {
	if = {
		limit = { sllm_gov_prune_due = yes }
		change_variable = { which = sllm_gov_dm value = 1 }
		if = {
			limit = { OR = {
				AND = { has_planet_flag = sllm_gov_frugal check_variable = { which = sllm_gov_dm value >= ${PRUNE_MONTHS.frugal} } }
				AND = { has_planet_flag = sllm_gov_bold check_variable = { which = sllm_gov_dm value >= ${PRUNE_MONTHS.bold} } }
				AND = { NOT = { has_planet_flag = sllm_gov_frugal } NOT = { has_planet_flag = sllm_gov_bold } check_variable = { which = sllm_gov_dm value >= ${PRUNE_MONTHS.normal} } }
			} }
${MANDATE_ORDER.map((m, i) => `\t\t\t${i ? 'else_if' : 'if'} = { limit = { has_planet_flag = sllm_gov_${m} } sllm_gov_prune_${m} = yes }`).join('\n')}
			clear_variable = sllm_gov_dm
			remove_planet_flag = sllm_gov_idle
		}
	}
	else = { clear_variable = sllm_gov_dm }
}

# 고르기: 먼저 급한 일(주거 부족 → 자원 적자 → 편의 부족 → 범죄) 하나, 없으면 방침 표식 순서대로 하나
sllm_gov_pick = {
${FIXES.map((F, i) => `\tif = { limit = { ${i ? 'sllm_gov_busy = no ' : ''}${F.when} = yes } sllm_gov_fix_${F.tag} = yes }`).join('\n')}
	if = {
		limit = { sllm_gov_busy = no }
${MANDATE_ORDER.map((m, i) => `\t\t${i ? 'else_if' : 'if'} = { limit = { has_planet_flag = sllm_gov_${m} } sllm_gov_pick_${m} = yes }`).join('\n')}
	}
}

# 완성: 지금 짓던 항목
sllm_gov_finish = {
	if = { limit = { always = no } }
${finish.join('\n')}
	clear_variable = sllm_gov_proj
	clear_variable = sllm_gov_prog
	clear_variable = sllm_gov_need
${FIXES.filter((F) => F.lock).map((F) => `\tif = { limit = { check_variable = { which = sllm_gov_why value = ${F.why} } } owner = { remove_country_flag = sllm_gov_fixing_${F.tag} } }`).join('\n')}
	clear_variable = sllm_gov_why
}

# 매달(행성 scope): 짓던 것이 있으면 진척(관할 ${PROG_BASE}일 · 대담 +${PROG_BOLD} · 숙련 +${PROG_VET}), 다 됐으면 완성. 없고 방침이 있고 국고가 넉넉하면 다음 것을 고른다.
# 부담 나누기: 이달 나라 전체 새 공사가 ${START_CAP}개 미만일 때만 고르고, 고를 게 없었으면 ${IDLE_DAYS}일 쉰다(sllm_gov_idle).
sllm_gov_build_tick = {
	if = { limit = { sllm_gov_has_mandate = yes sllm_gov_busy = no } sllm_gov_prune = yes } # 헐기(방침 밖·빈 건물) — 헌 칸은 바로 아래 고르기가 채운다
	if = {
		limit = { is_variable_set = sllm_gov_proj check_variable = { which = sllm_gov_proj value > 0 } }
		change_variable = { which = sllm_gov_prog value = ${PROG_BASE} }
		if = { limit = { has_planet_flag = sllm_gov_bold } change_variable = { which = sllm_gov_prog value = ${PROG_BOLD} } }
		if = { limit = { has_modifier = sllm_gov_veteran } change_variable = { which = sllm_gov_prog value = ${PROG_VET} } }
		if = { limit = { check_variable = { which = sllm_gov_prog value >= sllm_gov_need } } sllm_gov_finish = yes }
	}
	else_if = {
		limit = {
			sllm_gov_has_mandate = yes
			NOT = { has_planet_flag = sllm_gov_idle }
			owner = { NOT = { check_variable = { which = sllm_gov_starts value >= ${START_CAP} } } }
			sllm_gov_can_spend = yes
		}
		sllm_gov_pick = yes
		if = { limit = { sllm_gov_busy = yes } owner = { change_variable = { which = sllm_gov_starts value = 1 } } }
		else = { set_timed_planet_flag = { flag = sllm_gov_idle days = ${IDLE_DAYS} } }
	}
}
`;
  const tdir = path.join(modDir, 'common', 'scripted_triggers'), edir = path.join(modDir, 'common', 'scripted_effects');
  fs.mkdirSync(tdir, { recursive: true }); fs.mkdirSync(edir, { recursive: true });
  fs.writeFileSync(path.join(tdir, 'sllm_gov_build_gen.txt'), trigOut, 'utf8');
  fs.writeFileSync(path.join(edir, 'sllm_gov_build_gen.txt'), effOut, 'utf8');
  console.log(`항목 ${report.projects}개 · 빠진 것 ${report.skipped.length}개`);
  for (const m of MANDATE_ORDER) console.log(`  ${m}: ${projectsFor[m].map((p) => p.key).join(', ')}`);
  if (report.skipped.length) console.log('빠진 것: ' + report.skipped.join(' / '));
}
main();
