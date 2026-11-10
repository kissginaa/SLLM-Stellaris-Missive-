// 단일 의식 용어(알파 11, 2026-10-25 사용자 결정 「1단계 용어 바꾸기」): 기계 지성·군체 제국이면 집무실 이름표와 그 창의 제목·뒤로 가기를 바꾼다(화면 구조·기능은 그대로).
// body[data-gestalt] = machine | hive | gestalt(종류 모름) — office.html draw() 가 정한다. 일반 제국이면 손대지 않고, 바꿨던 것만 되돌린다.
// 모든 글은 한·영 짝(pick)이라 언어 팩과 맞는다. 언어가 바뀌거나(sllm-language) 다른 스크립트가 이름표를 다시 그리면 다시 입힌다.
(() => {
  const P = (ko, en) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(ko, en) : ko);
  // [찾는 곳, 일반, 기계, 군체, 종류 모름] — 각 칸은 [한국어, English]
  const TERMS = [
    ['title', ['집무실', 'Office'], ['중앙 처리 핵', 'Central Processing Core'], ['군체 핵', 'Hive Core'], ['의식의 핵', 'Core of the Consciousness']],
    ['#icons .grp:has(.ic[data-app=contacts]) > h2', ['제국 안의 사람들', 'People of the empire'], ['네트워크의 유닛들', 'Units of the network'], ['군체의 드론들', 'Drones of the hive'], ['의식의 구성체', 'Parts of the consciousness']],
    ['#icons .grp:has(.ic[data-open=terminal]) > h2', ['국정', 'Affairs of state'], ['중앙 연산', 'Central computation'], ['군체의 의지', 'Will of the hive'], ['단일 의지', 'The single will']],
    ['.ic[data-app=contacts] > span', ['연락처', 'Contacts'], ['유닛 목록', 'Unit registry'], ['드론 목록', 'Drone registry'], ['구성체 목록', 'Registry']],
    ['.ic[data-app=letters] > span', ['개인 서신', 'Personal letters'], ['유닛 교신', 'Unit transmissions'], ['공명 전언', 'Resonant messages'], ['내부 전언', 'Internal messages']],
    ['.ic[data-app=memorial] > span', ['추모관', 'Memorial hall'], ['정지 유닛 기록', 'Deactivated unit archive'], ['사라진 드론의 기억', 'Memory of lost drones'], ['소멸 기록', 'Record of the lost']],
    ['.ic[data-app=policy] > span', ['정책', 'Policies'], ['운영 지침', 'Operating directives'], ['군체 지침', 'Hive directives'], ['지침', 'Directives']],
    ['.ic[data-open=speech] > span', ['연설', 'Speech'], ['전 유닛 방송', 'Network-wide broadcast'], ['군체 공명', 'Hive resonance'], ['의식 전파', 'Consciousness broadcast']],
    ['#feed > h2', ['우리 제국 최근 소식', 'Recent news from our empire'], ['네트워크 최근 기록', 'Recent network log'], ['군체의 최근 기억', 'Recent memories of the hive'], ['최근 기록', 'Recent record']],
    ['#feedEmpty', ['아직 연대기에 기록된 일이 없습니다.', 'Nothing has been recorded in the chronicle yet.'], ['아직 기록 로그에 남은 일이 없습니다.', 'Nothing has been written to the log yet.'], ['아직 군체가 새긴 기억이 없습니다.', 'The hive has not stored any memory yet.'], ['아직 기록된 일이 없습니다.', 'Nothing has been recorded yet.']],
    ['#govGrp > h2', ['행성 총독', 'Planetary governors'], ['행성 관리 유닛', 'Planetary management units'], ['행성 감독 드론', 'Planetary overseer drones'], ['행성 관리 구성원', 'Planetary stewards']],
    // 창 안(알파 11 1단계 확장): 아이콘과 같은 이름으로 창 제목·뒤로 가기·창 이름(접근성)·도킹 표시줄
    ['#contacts .apph h3', ['연락처', 'Contacts'], ['유닛 목록', 'Unit registry'], ['드론 목록', 'Drone registry'], ['구성체 목록', 'Registry']],
    ['#contacts@aria-label', ['연락처', 'Contacts'], ['유닛 목록', 'Unit registry'], ['드론 목록', 'Drone registry'], ['구성체 목록', 'Registry']],
    ['#talkBack', ['‹ 연락처', '‹ Contacts'], ['‹ 유닛 목록', '‹ Unit registry'], ['‹ 드론 목록', '‹ Drone registry'], ['‹ 구성체 목록', '‹ Registry']],
    ['#letters .apph h3', ['개인 서신', 'Personal letters'], ['유닛 교신', 'Unit transmissions'], ['공명 전언', 'Resonant messages'], ['내부 전언', 'Internal messages']],
    ['#letters@aria-label', ['개인 서신', 'Personal letters'], ['유닛 교신', 'Unit transmissions'], ['공명 전언', 'Resonant messages'], ['내부 전언', 'Internal messages']],
    ['#memorial .apph h3', ['추모관', 'Memorial hall'], ['정지 유닛 기록', 'Deactivated unit archive'], ['사라진 드론의 기억', 'Memory of lost drones'], ['소멸 기록', 'Record of the lost']],
    ['#memorial@aria-label', ['추모관', 'Memorial hall'], ['정지 유닛 기록', 'Deactivated unit archive'], ['사라진 드론의 기억', 'Memory of lost drones'], ['소멸 기록', 'Record of the lost']],
    ['#policy .apph h3', ['정책', 'Policies'], ['운영 지침', 'Operating directives'], ['군체 지침', 'Hive directives'], ['지침', 'Directives']],
    ['#policy@aria-label', ['정책', 'Policies'], ['운영 지침', 'Operating directives'], ['군체 지침', 'Hive directives'], ['지침', 'Directives']],
    ['#runName~', ['행성 총독', 'Planetary governors'], ['행성 관리 유닛', 'Planetary management units'], ['행성 감독 드론', 'Planetary overseer drones'], ['행성 관리 구성원', 'Planetary stewards']],
    ['#runName~', ['연설', 'Speech'], ['전 유닛 방송', 'Network-wide broadcast'], ['군체 공명', 'Hive resonance'], ['의식 전파', 'Consciousness broadcast']],
  ];
  const COL = { machine: 2, hive: 3, gestalt: 4 };
  let applied = false;
  // 번역 표에 짝을 올려 둔다: 번역되는 칸은 한국어 원문만 넣으면 i18n-ui 가 영어·언어 팩으로 바꾼다(언어를 오가도 원문이 한국어로 남는다).
  if (window.SLLMCatalog) for (const r of TERMS) for (const pair of r.slice(1)) if (!window.SLLMCatalog[pair[0]]) window.SLLMCatalog[pair[0]] = pair[1];
  // 찾는 곳: 'title' 창 제목 · 'x@attr' 속성 · 'x~' 지금 그 이름(일반·다른 단일 의식 말)일 때만 바꿈(도킹 표시줄은 여러 창이 함께 쓴다)
  function set(sel, pair, row) {
    if (sel === 'title') { if (document.title !== pair[0]) { document.title = pair[0]; window.SLLMI18n?.refresh?.(); } return; }
    if (sel.includes('@')) { const [q, at] = sel.split('@'); const el = document.querySelector(q); if (el && el.getAttribute(at) !== pair[0] && el.getAttribute(at) !== P(pair[0], pair[1])) el.setAttribute(at, pair[0]); return; }
    if (sel.endsWith('~')) { const el = document.querySelector(sel.slice(0, -1)); if (!el) return; const cur = el.textContent.trim(); if (row.slice(1).some((p) => p[0] === cur || P(p[0], p[1]) === cur || p[1] === cur) && cur !== P(pair[0], pair[1])) el.textContent = P(pair[0], pair[1]); return; }
    const el = document.querySelector(sel); if (!el) return;
    const t = el.closest('[data-i18n-skip]') ? P(pair[0], pair[1]) : pair[0]; // 번역에서 빠진 칸(행성 총독)은 직접 고른 말
    if (el.textContent !== t && el.textContent !== P(pair[0], pair[1])) el.textContent = t;
  }
  function apply() {
    const col = COL[document.body.dataset.gestalt || ''];
    if (PAGE === 'office.html' && window.SLLMI18n && window.SLLMI18n.setDialect) window.SLLMI18n.setDialect(dialectFor(document.body.dataset.gestalt || '')); // 집무실 안 문장(바뀔 때만 다시 그린다)
    if (!col) { if (applied) { applied = false; for (const r of TERMS) set(r[0], r[1], r); } return; } // 일반 제국: 되돌리기만
    applied = true; for (const r of TERMS) set(r[0], r[col], r);
  }
  // ── 말투(dialect) — 집무실은 body[data-gestalt], 따로 뜨는 창(총독회의·연설)은 앱에 묻는다: 플레이어 제국 종류를 앱에 물어 말투(dialect)를 입힌다 — i18n-ui 가 번역 뒤 모든 글에 적용(대화 기록·이름 칸은 빼고) ──
  // 한국어는 받침이 있는 말끼리 바꿔 조사(을·이·과)가 맞게 한다. 같은 글에 두 번 들어가도 결과가 같다.
  const PAGE = (location.pathname.split('/').pop() || '').toLowerCase();
  const GOV = { machine: ['관리 유닛', 'management unit', 'Management unit', 'MANAGEMENT UNIT'], hive: ['감독 드론', 'overseer drone', 'Overseer drone', 'OVERSEER DRONE'], gestalt: ['관리 구성원', 'steward', 'Steward', 'STEWARD'] };
  const SPEECH = { machine: ['방송문', '전 유닛 방송', '유닛', 'broadcast', 'Broadcast', 'the units', 'The units'], hive: ['공명문', '군체 공명', '드론', 'resonance', 'Resonance', 'the drones', 'The drones'], gestalt: ['전파문', '의식 전파', '구성원', 'transmission', 'Transmission', 'the members', 'The members'] };
  // 한국어 낱말 바꾸기 + 조사 맞추기: 바꾸는 말의 받침이 다르면 을/를·이/가·은/는·과/와·으로/로 를 함께 고친다.
  const jong = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : 0; };
  const parts = (w) => { const j = jong(w); return j === 0 ? ['를', '가', '는', '와', '로'] : j === 8 ? ['을', '이', '은', '과', '로'] : ['을', '이', '은', '과', '으로']; };
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function noun(from, to) {
    const pf = parts(from), pt = parts(to), out = [];
    [4, 0, 1, 2, 3].forEach((i) => { if (pf[i] !== pt[i]) out.push([new RegExp(esc(from) + pf[i] + '(?![가-힣])', 'g'), to + pt[i]]); }); // 으로·로 먼저(긴 것), 조사 뒤에 다른 글자가 붙으면 낱말 일부라 건너뛴다
    out.push([new RegExp(esc(from), 'g'), to]);
    return out;
  }
  // 집무실 안 문장(추모관 안내·연락처 안내 등). 연대기 기록 목록·대화 기록·이름 칸은 i18n-ui 가 보호하므로 손대지 않는다.
  const OFFICE = {
    machine: [['명예의 전당', '영구 보존 기록'], ['추모관', '정지 유닛 기록'], ['연대기', '기록 로그'], ['개인 서신', '유닛 교신'], ['서신함', '교신함'], ['연락처', '유닛 목록'], ['총독회의', '관리 유닛 회의'], ['총독', '관리 유닛']],
    hive: [['명예의 전당', '영원한 기억'], ['추모관', '사라진 드론의 기억'], ['연대기', '공명 기록부'], ['개인 서신', '공명 전언'], ['서신함', '전언함'], ['연락처', '드론 목록'], ['총독회의', '감독 드론 회의'], ['총독', '감독 드론']],
    gestalt: [['명예의 전당', '영구 기록'], ['추모관', '소멸 기록'], ['연대기', '기록부'], ['개인 서신', '내부 전언'], ['서신함', '전언함'], ['연락처', '구성체 목록'], ['총독회의', '관리 구성원 회의'], ['총독', '관리 구성원']],
  };
  const OFFICE_EN = {
    machine: [[/Memorial hall/g, 'Deactivated unit archive'], [/memorial hall/g, 'deactivated unit archive'], [/Hall of Fame/g, 'Permanent archive'], [/the chronicle/g, 'the log'], [/Chronicle/g, 'Log'], [/Personal letters/g, 'Unit transmissions'], [/Contacts/g, 'Unit registry'], [/governors/g, 'management units'], [/governor/g, 'management unit'], [/Governors/g, 'Management units'], [/Governor/g, 'Management unit']],
    hive: [[/Memorial hall/g, 'Memory of lost drones'], [/memorial hall/g, 'memory of lost drones'], [/Hall of Fame/g, 'Eternal memory'], [/the chronicle/g, 'the resonance record'], [/Chronicle/g, 'Resonance record'], [/Personal letters/g, 'Resonant messages'], [/Contacts/g, 'Drone registry'], [/governors/g, 'overseer drones'], [/governor/g, 'overseer drone'], [/Governors/g, 'Overseer drones'], [/Governor/g, 'Overseer drone']],
    gestalt: [[/Memorial hall/g, 'Record of the lost'], [/memorial hall/g, 'record of the lost'], [/Hall of Fame/g, 'Permanent record'], [/the chronicle/g, 'the record'], [/Chronicle/g, 'Record'], [/Personal letters/g, 'Internal messages'], [/Contacts/g, 'Registry'], [/governors/g, 'stewards'], [/governor/g, 'steward'], [/Governors/g, 'Stewards'], [/Governor/g, 'Steward']],
  };
  function dialectFor(kind) {
    if (PAGE === 'office.html' && OFFICE[kind]) return [...OFFICE[kind].flatMap(([f, t]) => noun(f, t)), ...OFFICE_EN[kind]];
    if (PAGE === 'gov-council.html' && GOV[kind]) { const [ko, en, En, EN] = GOV[kind]; return [...noun('총독회의', ko + ' 회의'), ...noun('총독', ko), [/governors/g, en + 's'], [/governor/g, en], [/Governors/g, En + 's'], [/Governor/g, En], [/GOVERNORS/g, EN + 'S'], [/GOVERNOR/g, EN]]; }
    if (PAGE === 'speech.html' && SPEECH[kind]) { const [doc, sp, ppl, en, En, the, The] = SPEECH[kind]; return [...noun('연설문', doc), ...noun('연설', sp), ...noun('국민', ppl), [/speeches/g, en + (en.endsWith('s') ? 'es' : 's')], [/speech/g, en], [/Speech/g, En], [/the people/g, the], [/The people/g, The]]; }
    return null;
  }
  async function askKind() {
    if (PAGE === 'office.html' || !window.sllm || !window.sllm.playerGestalt || !window.SLLMI18n || !window.SLLMI18n.setDialect) return;
    let kind = ''; try { kind = (await window.sllm.playerGestalt()) || ''; } catch (e) { return; }
    window.SLLMI18n.setDialect(dialectFor(kind));
  }
  let queued = false;
  const later = () => { if (queued) return; queued = true; setTimeout(() => { queued = false; apply(); }, 0); }; // 다른 스크립트·번역이 끝난 뒤
  document.addEventListener('DOMContentLoaded', () => {
    if (PAGE !== 'office.html') { askKind(); setInterval(askKind, 30000); window.addEventListener('focus', askKind); return; } // 세이브가 바뀌어도 따라간다
    new MutationObserver(later).observe(document.body, { attributes: true, attributeFilter: ['data-gestalt'] });
    const icons = document.getElementById('icons'); if (icons) new MutationObserver(later).observe(icons, { childList: true }); // 행성 총독 칸이 나중에 붙는다
    const run = document.getElementById('runName'); if (run) new MutationObserver(later).observe(run, { childList: true, characterData: true, subtree: true }); // 도킹한 창 이름(행성 총독·연설)
    document.addEventListener('sllm-language', later);
    later();
  });
  window.SLLMGestaltTerms = { TERMS, apply, dialectFor };
})();
