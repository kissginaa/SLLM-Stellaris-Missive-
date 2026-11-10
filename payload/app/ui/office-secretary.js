// 집무실 비서 장면(2026-10-18 개편). 설계: docs/SECRETARY_SPEC_KO.md, 그림: docs/SECRETARY_ART_KO.md, 앱: src/features/secretary-app.ts.
// 「비서 호출」(#secCall) → 홀로그램 바탕화면이 투사기로 접혀 내려가고 비서가 오른쪽에서 걸어 들어온다(위에서 아래로 기동 빛).
// 대화는 화면 아래 대화창: 이름표·호감·행동지문(괄호, 기울임)·대사(한 글자씩, 누르면 바로 다 보임). 닫기(✕)·Esc 없음 — 「이만 물러가라」로만 끝낸다.
// 행동지문과 함께 오는 pose 에 맞춰 전신 그림 ui/assets/secretary/<pose>.png 로 바뀐다(없으면 idle → secretary.png → 임시 실루엣).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
// 이벤트(미연시식, 2026-10-19): 데이트·상황 이벤트는 장소 배경(assets/secretary/bg/<키>.png) 위에서 지문 → 대사 → 선택지 순으로 한 칸씩 누르며 진행. 결정적 장면은 CG(assets/secretary/cg/<키>.png). 그림이 없으면 색 배경·서 있는 그림으로 대신한다.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const STAGE = { work: ['업무 관계', 'Professional'], trust: ['신뢰', 'Trusted'], fond: ['호감', 'Fond'], lover: ['연인', 'Lovers'], spouse: ['배우자', 'Spouse'] };
  const QUICK = [
    [['지금 할 일', 'What now'], ['지금 무엇부터 해야 할까? 우선순위를 정해 줘.', 'What should I do first right now? Give me priorities.']],
    [['경제 점검', 'Economy check'], ['우리 경제 상태를 점검해 줘. 적자나 약점이 있어?', 'Check our economy. Any deficits or weak spots?']],
    [['전쟁 상황', 'War status'], ['지금 전쟁 상황은 어때? 계속 싸워도 될까?', 'How do our wars look? Should we keep fighting?']],
    [['파벌 동향', 'Factions'], ['파벌들 분위기는 어때? 신경 써야 할 곳이 있어?', 'How are the factions? Anyone I should worry about?']],
  ];
  // 물러가라 할 때 마지막 인사(AI 호출 없이 바로). 단계별.
  const BYE = {
    work: ['알겠습니다, 각하. 필요하시면 언제든 부르십시오.', 'Understood, Your Excellency. Call for me whenever you need.'],
    trust: ['네, 각하. 너무 무리하지는 마십시오.', 'Yes, Your Excellency. Please do not overwork yourself.'],
    fond: ['…네. 그럼, 나중에 또 불러 주세요. 기다리고 있겠습니다.', '…Yes. Then please call me again later. I will be waiting.'],
    lover: ['벌써요? …알겠어요. 오늘은 일찍 쉬세요. 약속이에요.', 'Already? …All right. Get some rest early tonight. Promise me.'],
    spouse: ['네, 여보. 집무실 불은 제가 끌게요. 먼저 들어가 계세요.', 'Yes, dear. I will turn off the office lights. Go on ahead.'],
  };
  const SIL = '<svg viewBox="0 0 200 520" fill="none" stroke="var(--hi)" stroke-width="1.6" aria-hidden="true"><ellipse cx="100" cy="58" rx="30" ry="36" fill="color-mix(in srgb,var(--hi) 12%,transparent)"/><path d="M70 50c2-30 58-34 62 2 4 30-6 52-14 64M70 50c-4 22 0 46 8 62"/><path d="M86 96v14M114 96v14"/><path d="M60 128c12-10 28-14 40-14s28 4 40 14l10 70-12 4 2 80-24 6-4 140h-10l-4-130-4 130h-10l-4-140-24-6 2-80-12-4z" fill="color-mix(in srgb,var(--hi) 10%,transparent)"/><path d="M100 118v100M78 160h44M80 250h40" opacity=".5"/><circle cx="100" cy="150" r="5" fill="var(--hi)"/></svg>';
  let S = null, scene = null, waiting = false, mode = '', err = '', lastDelta = 0, typing = null, logOn = false, leaving = false;
  let evStep = 0, evShown = null; // 이벤트: 지금 보여 주는 칸(0 = 지문, 1.. = 대사)
  const stageLabel = (k) => (STAGE[k] ? L(STAGE[k][0], STAGE[k][1]) : k);
  const MOOD = { warm: ['여운 · 다정함', 'Afterglow · Warm'], soft: ['여운 · 차분함', 'Afterglow · Gentle'], cool: ['여운 · 서운함', 'Afterglow · Distant'] };
  const lastThem = () => { const l = (S && S.lines) || []; for (let i = l.length - 1; i >= 0; i--) if (l[i].who === 'them') return l[i]; return null; };
  const lastMe = () => { const l = (S && S.lines) || []; const t = l[l.length - 1]; return t && t.who === 'me' ? t : null; };

  // ── 전신 그림: 자세가 바뀌면 다음 그림을 미리 불러 두었다가 겹쳐 바꾼다 ──
  let curPose = '', poseReq = 0;
  function setPose(pose) {
    if (S && S.ev && S.ev.id === "maintenance") { maintenancePose(pose); return; }
    if (S && S.ev && S.ev.id === "war_night") { war_nightPose(pose); return; }
    if (S && S.ev && S.ev.id === "farewell") { farewellPose(pose); return; }
    if (S && S.ev && S.ev.id === "mourning") { mourningPose(pose); return; }
    if (S && S.ev && S.ev.id === "restaurant") { restaurantPose(pose); return; }
    if (S && S.ev && S.ev.id === "balcony") { balconyPose(pose); return; }
    const fig = scene && scene.querySelector('.sec-fig'); const outfit = (S && S.ev && S.ev.outfit) || ''; // 이벤트 의상(식당 변장·국장 상복): <자세>_<의상>.png 를 먼저
    if (!fig || pose + '|' + outfit === curPose) return;
    curPose = pose + '|' + outfit; const my = ++poseReq;
    const fallback = { laugh: 'smile', tender: 'smile', shy: 'smile', worried: 'sad', surprised: 'think', bow: 'idle' }[pose];
    const base = [pose, fallback, 'idle', 'secretary'].filter((v, i, a) => v && a.indexOf(v) === i);
    const tries = (outfit ? [pose, fallback, 'idle'].filter(Boolean).map((p) => p + '_' + outfit) : []).concat(base).map((p) => 'assets/secretary/' + p + '.png');
    const next = (i) => {
      if (my !== poseReq) return;
      if (i >= tries.length) { if (!fig.querySelector('.sil')) { const s = h('div', 'sil'); s.innerHTML = SIL; fig.append(s); } return; }
      const img = new Image(); img.alt = ''; img.className = 'hide';
      img.onload = () => { if (my !== poseReq) return; fig.querySelector('.sil')?.remove(); const old = [...fig.querySelectorAll('img')]; fig.append(img); requestAnimationFrame(() => img.classList.remove('hide')); setTimeout(() => old.forEach((o) => o.remove()), 400); };
      img.onerror = () => next(i + 1);
      img.src = tries[i];
    };
    next(0);
  }

  // ── 장면 열기·닫기 ──
  function build() {
    scene = h('div'); scene.id = 'secScene'; scene.setAttribute('role', 'dialog'); scene.setAttribute('aria-label', L('비서', 'Secretary'));
    const fig = h('div', 'sec-fig'); fig.append(h('i', 'scan'));
    scene.append(h('div', 'sec-bg'), h('div', 'dim'), fig, h('div', 'sec-cg'), h('div', 'sec-log'), h('div', 'sec-box'));
    document.body.append(scene);
  }
  async function enter() {
    if (scene || $('secRetire') || document.body.classList.contains('docked') || $('secCall')?.style.display === 'none') return; // 숨긴 비서(단일 의식 제국)는 부를 수 없다
    $('secNudge')?.remove(); // 쪽지는 부르면 읽은 것(앱이 지운다)
    leaving = false; mode = ''; err = ''; logOn = false; curPose = ''; knowledgeDraft = null; knowledgeSid = ''; knowledgeEditing = false;
    build(); document.body.classList.add('sec-scene');
    try { S = await window.sllm.secretaryState(); } catch (e) { S = null; }
    if (S && S.pending && S.pending.forced) scene.dataset.ev = S.pending.id; // presentation only: quiet funeral arrival
    setTimeout(() => { if (!scene) return; scene.classList.add('on'); if (S && S.name) { setPose('idle'); scene.querySelector('.sec-fig').classList.add('in'); } draw(); ready(); }, 650); // 홀로그램이 다 접힌 뒤
  }
  // 비서가 준비되면: 진행 중인 이벤트로 돌아가거나, 벌어질 상황 이벤트를 먼저, 아니면 업무 보고
  function ready() {
    if (!S || !S.sid || !S.name) return;
    if (S.knowledgePending) { draw(false); return; }
    if (S.ev) { evShow(); return; }
    if (S.pending) { startEv(S.pending.id, false); return; }
    if (!(S.lines || []).length) open();
  }
  function leave() {
    if (!scene || leaving) return; leaving = true; if (S) S.quiet = false;
    const stage = (S && S.stage) || 'work';
    if (S && S.name && (S.lines || []).length) {
      S.lines = [...S.lines, { who: 'them', text: L(BYE[stage][0], BYE[stage][1]), action: L('가볍게 고개를 숙인다', 'She bows slightly'), pose: 'bow' }];
      draw(true);
    }
    window.sllm.secretaryEnd().catch(() => {}); // 기억·업무 메모 정리(뒤에서)
    setTimeout(() => {
      if (!scene) return;
      scene.querySelector('.sec-fig').classList.add('out'); scene.classList.remove('on');
      setTimeout(() => { scene?.remove(); scene = null; S = null; evShown = null; document.body.classList.remove('sec-scene'); refreshBadge(); }, 900);
    }, S && S.name ? 1700 : 50);
  }

  // ── 그리기 ──
  function type(el, text, done) { // 한 글자씩. 대사 칸을 누르면 바로 다 보인다
    if (typing) clearInterval(typing.t);
    let i = 0; el.textContent = '';
    const fin = () => { if (typing) clearInterval(typing.t); typing = null; el.textContent = text; done && done(); };
    typing = { fin, t: setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) fin(); }, 22) };
  }
  // First activation is local UI, independent from the ten-year maintenance event.
  let knowledgeDraft = null, knowledgeSid = '', knowledgeLoading = false, knowledgeEditing = false;
  async function fetchKnowledge() {
    if (knowledgeLoading || !S || !S.sid) return;
    const sid = S.sid; knowledgeLoading = true;
    try {
      const r = await window.sllm.secretaryKnowledge();
      if (scene && S && S.sid === sid && r && r.sid === sid && r.ok) { knowledgeDraft = r.knowledge; knowledgeSid = sid; }
      else if (scene && S && S.sid === sid) err = (r && r.error) || L('지식을 읽지 못했습니다.', 'Could not load knowledge.');
    } catch (e) { err = String(e); }
    knowledgeLoading = false; if (scene) draw(false);
  }
  function drawKnowledge() {
    const boot = !!S.knowledgePending;
    scene.dataset.ev = 'activation'; scene.classList.add('ev', 'sec-knowledge');
    setBg('maintenance_pov'); setCg('');
    let art = scene.querySelector('.sec-activation-art');
    if (!art) { art = h('img', 'sec-activation-art'); art.alt = ''; art.src = 'assets/secretary/scenes/maintenance/neutral.png'; scene.append(art); }
    const box = scene.querySelector('.sec-box'); box.textContent = '';
    box.append(h('b', '', boot ? L('첫 기동', 'First activation') : L('비서 지식 설정', 'Secretary knowledge')));
    if (boot) box.append(h('p', 'sec-narr', L('낯선 빛 속에서 비서가 천천히 눈을 뜹니다. 아직 조금 혼란스러운 듯, 당신을 바라봅니다.', 'The secretary slowly opens her eyes in the unfamiliar light. Still a little disoriented, she looks at you.')),
      h('p', '', L(`“${S.name}… 그게 제 이름인가요?”`, `“${S.name}… is that my name?”`)));
    box.append(h('h3', '', L('스텔라리스 기본 지식을 사용하시겠습니까?', 'Use the default Stellaris knowledge?')),
      h('p', '', L('게임 버전이나 모드에 맞게 추가·수정할 수 있습니다. 실제 세이브 정보와 별도로 저장되며, 나중에도 비서 지식 설정에서 바꿀 수 있습니다.', 'Add or edit knowledge for your game version or mods. It is stored separately from live save data and can be changed later in Secretary knowledge.')));
    if (!knowledgeDraft || knowledgeSid !== S.sid) {
      box.append(btn('', knowledgeLoading ? L('불러오는 중…', 'Loading…') : L('지식 불러오기', 'Load knowledge'), fetchKnowledge));
      if (err) box.append(h('div', 'sec-err', err));
      if (!knowledgeLoading && !err) fetchKnowledge(); return;
    }
    const d = knowledgeDraft;
    if (knowledgeEditing) {
      const editor = h('div', 'sec-knowledge-editor');
      const field = (label, value, max, change, rows) => {
        const lab = h('label'); lab.append(h('span', '', label)); const input = h(rows ? 'textarea' : 'input'); input.value = value; input.maxLength = max;
        if (rows) input.rows = rows; input.oninput = () => change(input.value); lab.append(input); editor.append(lab); return input;
      };
      field(L('게임 버전 / 모드 구성', 'Game version / mod setup'), d.version, 100, v => d.version = v);
      field(L('공통 핵심 지식 (항상 참고, 최대 2,000자)', 'Core knowledge (always included, up to 2,000 characters)'), d.core, 2000, v => d.core = v, 3);
      editor.append(h('p', '', L('주제별 지식은 질문과 검색어가 맞을 때만 최대 3개를 참고합니다. 기본 지식 본문은 영어이며 원하는 언어로 수정할 수 있습니다.', 'Up to three topic cards are included when their keywords match the question. Default card text is English; edit it in any language.')));
      const select = h('select'); d.cards.forEach((c, i) => { const o = h('option', '', c.id); o.value = i; select.append(o); }); editor.append(select);
      const topic = h('textarea'); topic.rows = 6; topic.maxLength = 3000;
      const kw = h('input'); kw.maxLength = 1400; kw.placeholder = L('검색어를 쉼표로 구분', 'Separate keywords with commas');
      const topicLabel = h('label'); topicLabel.append(h('span', '', L('주제 내용 (최대 3,000자)', 'Topic text (up to 3,000 characters)')), topic);
      const kwLabel = h('label'); kwLabel.append(h('span', '', L('이 지식을 찾을 검색어', 'Keywords for this knowledge')), kw);
      editor.append(kwLabel, topicLabel);
      const show = () => { const c = d.cards[Number(select.value)]; topic.value = c ? c.text : ''; kw.value = c ? c.kw.join(', ') : ''; topic.disabled = kw.disabled = !c; };
      select.onchange = show; topic.oninput = () => { const c = d.cards[Number(select.value)]; if (c) c.text = topic.value; };
      kw.oninput = () => { const c = d.cards[Number(select.value)]; if (c) c.kw = kw.value.split(',').map(x => x.trim()).filter(Boolean); }; show();
      const add = btn('', L('주제 추가', 'Add topic'), () => { if (d.cards.length >= 60) return; let n = 1; while (d.cards.some(c => c.id === 'custom_' + n)) n++; const c = { id: 'custom_' + n, kw: [], text: '' }; d.cards.push(c); const o = h('option', '', c.id); o.value = d.cards.length - 1; select.append(o); select.value = o.value; show(); kw.focus(); }); add.disabled = d.cards.length >= 60;
      editor.append(add, btn('', L('선택 주제 삭제', 'Delete selected topic'), () => { if (d.cards.length) d.cards.splice(Number(select.value), 1); draw(false); })); box.append(editor);
    }
    const buttons = h('div', 'sec-choices');
    if (!knowledgeEditing) buttons.append(btn('', L('추가하기 / 수정하기', 'Add / edit'), () => { knowledgeEditing = true; draw(false); }));
    const saveButton = btn('', L('확정하기', 'Confirm'), async () => {
      if (waiting) return; waiting = true; saveButton.disabled = true; err = '';
      const sid = S.sid;
      try {
        const r = await window.sllm.secretaryKnowledgeSave(sid, d);
        if (scene && S && S.sid === sid) { if (r && r.ok) { S = r.state; knowledgeEditing = false; mode = ''; scene.classList.remove('sec-knowledge', 'ev'); scene.dataset.ev = ''; scene.querySelector('.sec-activation-art')?.remove(); setBg(''); setPose('idle'); } else err = (r && r.error) || L('저장하지 못했습니다.', 'Could not save.'); }
      } catch (e) { err = String(e); }
      waiting = false; if (scene) { draw(false); if (!err && boot) ready(); }
    }); buttons.append(saveButton);
    if (!boot) buttons.append(btn('', L('취소', 'Cancel'), () => { mode = ''; knowledgeDraft = null; knowledgeEditing = false; scene.classList.remove('sec-knowledge', 'ev'); scene.dataset.ev = ''; scene.querySelector('.sec-activation-art')?.remove(); draw(false); }));
    box.append(buttons); if (err) box.append(h('div', 'sec-err', err));
  }


  function draw(animate) {
    if (!scene) return;
    if (S && S.name && (S.knowledgePending || mode === 'knowledge')) { drawKnowledge(); return; }
    if (S && S.ev) { drawEv(animate); return; }
    scene.classList.remove('ev'); setBg(''); setCg('');
    const box = scene.querySelector('.sec-box'); box.textContent = '';
    if (!S || !S.sid) { box.append(h('div', 'sec-say', L('세이브를 불러오면 비서를 호출할 수 있습니다.', 'Load a save to call your secretary.')), h('div', 'sec-tools')); box.querySelector('.sec-tools').append(btn('leave', L('돌아가기', 'Back'), leave)); return; }
    if (!S.name) { // 처음: 이름 짓기
      const f = h('div', 'sec-name');
      f.append(h('b', '', L('극비 안드로이드 비서', 'Classified android secretary')), h('p', '', L('제국이 극비로 만든 안드로이드 비서가 처음 깨어납니다. 늙지 않아 통치자가 바뀌어도 이 집무실을 지킵니다. 그녀를 무엇이라 부르시겠습니까?', 'The empire\'s classified android secretary awakens for the first time. She never ages and keeps this office through every ruler. What will you call her?')));
      const inp = h('input'); inp.maxLength = 20; inp.placeholder = L('이름', 'Name');
      const go = async () => { const r = await window.sllm.secretaryName(inp.value).catch((e) => ({ ok: false, error: String(e) })); if (r && r.ok) { S = r.state; err = ''; setPose('idle'); scene.querySelector('.sec-fig').classList.add('in'); draw(); ready(); } else { err = (r && r.error) || ''; draw(); } };
      inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      f.append(inp, btn('', L('이름 정하기', 'Set name'), go)); if (err) f.append(h('div', 'sec-err', err));
      const tools = h('div', 'sec-tools'); tools.append(btn('leave', L('돌아가기', 'Back'), leave));
      box.append(f, tools); setTimeout(() => inp.focus(), 50); return;
    }
    // 이름표
    const plate = h('div', 'sec-plate'); plate.append(h('b', '', S.name), h('small', '', stageLabel(S.stage) + (S.engaged ? ' · ' + L('약혼', 'Engaged') : '')));
    if (S.romance) { const hb = h('span', 'sec-heart'), bar = h('span', 'bar'), i = h('i'); i.style.width = Math.max(0, Math.min(100, S.aff)) + '%'; bar.append(i); hb.append(h('span', '', '♥'), bar, h('span', '', String(S.aff))); if (lastDelta) { const d = h('span', 'd show', (lastDelta > 0 ? '+' : '') + lastDelta); hb.append(d); setTimeout(() => d.classList.remove('show'), 1600); } plate.append(hb); }
    if (S.mood && MOOD[S.mood]) { const m = h('span', 'sec-mood ' + S.mood, L(MOOD[S.mood][0], MOOD[S.mood][1])); m.title = L('얼마 전 함께한 일의 여운이 남아 있습니다', 'The afterglow of a recent moment together lingers'); plate.append(m); }
    const tools = h('div', 'sec-tools'); tools.append(btn('', L('기록', 'Records'), () => { logOn = !logOn; drawLog(); }), btn('leave', L('이만 물러가라', 'You may go'), leave));
    tools.append(btn('', L('비서 지식 설정', 'Secretary knowledge'), () => { if (waiting) return; if (typing) typing.fin(); logOn = false; drawLog(); mode = 'knowledge'; knowledgeDraft = null; knowledgeSid = ''; knowledgeEditing = true; err = ''; draw(false); }));
    if (S.quiet) {
      setPose('idle');
      box.append(plate, tools,
        h('div', 'sec-say', L('네. 여기 함께 있겠습니다.', 'Of course. I will stay here with you.')),
        h('div', 'sec-act', L('말없이 곁을 지킨다.', 'She stays quietly by your side.')));
      const resume = btn('', L('다시 이야기하기', 'Resume conversation'), () => quiet(false));
      resume.disabled = waiting; const actions = h('div', 'sec-choices'); actions.append(resume); box.append(actions);
      if (err) box.append(h('div', 'sec-err', err));
      return;
    }
    // 대사
    const say = h('div', 'sec-say'); say.dataset.i18nSkip = '';
    const me = lastMe(), t = lastThem();
    if (waiting) { if (me) say.append(h('span', 'sec-me', '▸ ' + me.text)); say.append(h('span', 'sec-wait', mode === 'open' ? L('그녀가 들어와 서류를 정리한다…', 'She steps in and arranges her papers…') : '…')); }
    else if (t) {
      if (t.action) say.append(h('span', 'sec-act', t.action));
      const tx = h('span', 'sec-txt'); say.append(tx);
      setPose(t.pose || 'idle');
      if (animate !== false && t !== draw.shown) { draw.shown = t; type(tx, t.text, () => {}); say.onclick = () => typing && typing.fin(); } else tx.textContent = t.text;
    } else say.append(h('span', 'sec-wait', L('…', '…')));
    box.append(plate, tools);
    if (morningLine) { const mg = h('div', 'sec-morning', '☀ ' + morningLine); mg.dataset.i18nSkip = ''; mg.style.cssText = 'font-size:12.5px;opacity:.85;margin:2px 0 6px;font-style:italic'; box.append(mg); }
    box.append(say);
    if (err) box.append(h('div', 'sec-err', err));
    if (leaving) return;
    // 고르기·입력
    const ch = h('div', 'sec-choices');
    const stay = btn('', L('그냥 곁에 있어 줘', 'Just stay with me'), () => quiet(true)); stay.disabled = waiting || !t; ch.append(stay);
    for (const [lab, q] of QUICK) { const b = btn('', L(lab[0], lab[1]), () => talk(L(q[0], q[1]))); b.disabled = waiting || !t; ch.append(b); }
    for (const d of S.dates || []) { if (d.locked) continue; const b = btn('date', d.title, () => startEv(d.id, false)); b.disabled = waiting || !d.ok; if (!d.ok) b.title = L(`약 ${d.wait}개월 뒤에 다시 청할 수 있습니다`, `You can ask again in about ${d.wait} months`); ch.append(b); }
    if (S.parkDate && !S.parkDate.locked) { const b = btn('date', L('💐 데이트', '💐 Go on a date'), async () => { err = ''; try { const r = await window.sllm.dateOpen('sec'); if (r && !r.ok) { err = r.error || ''; draw(false); } } catch (e) { err = String(e); draw(false); } }); b.disabled = waiting || !S.parkDate.ok; if (!S.parkDate.ok) b.title = S.parkDate.why; ch.append(b); } // 지도 데이트 화면(date-park.html)으로 — 2026-10-23
    if (S.confess) { const b = btn('love', L('마음 전하기', 'Confess'), () => { mode = mode === 'confess' ? '' : 'confess'; draw(false); box.querySelector('textarea')?.focus(); }); b.disabled = waiting; ch.append(b); }
    // 비서 예식(2026-10-24 사용자 확정): 약혼 → 규모 선택(비용) → 1년 준비 → 예식. 지도자 예식과 같은 romance-app 명령(상대 'sec')
    if (S.engaged && S.wedding) { const w = S.wedding, c = w.cost, wd = async (fn) => { err = ''; waiting = true; draw(false); try { const r = await fn(); if (r && !r.ok) err = r.error || ''; else if (r && r.guests) err = L(`하객: ${r.guests.join(', ') || '없음'}`, `Guests: ${r.guests.join(', ') || 'none'}`); } catch (e) { err = String(e); } waiting = false; await open(); };
      if (w.state === 'engaged') { for (const [sc, lab] of [['state', L(`💒 국가공인 결혼식 준비 (에너지 ${c.state.energy}·식량 ${c.state.food}·광물 ${c.state.minerals})`, `💒 Prepare a state wedding (energy ${c.state.energy}, food ${c.state.food}, minerals ${c.state.minerals})`)], ['informal', L(`💒 비공식 결혼식 준비 (에너지 ${c.informal.energy}·식량 ${c.informal.food}·광물 ${c.informal.minerals})`, `💒 Prepare an informal wedding (energy ${c.informal.energy}, food ${c.informal.food}, minerals ${c.informal.minerals})`)]]) { const b = btn('love', lab, () => wd(() => window.sllm.weddingPrepare('sec', sc))); b.disabled = waiting; ch.append(b); } }
      else if (w.state === 'preparing') { const b = btn('love', w.due ? L('💒 예식 올리기', '💒 Hold the ceremony') : L(`결혼식 ${w.scheduledOn} 예정`, `Wedding set for ${w.scheduledOn}`), () => wd(() => window.sllm.weddingHold('sec'))); b.disabled = waiting || !w.due; ch.append(b); }
      const x = btn('', L('결혼식 취소 (교제는 유지)', 'Call off the wedding (stay together)'), () => { if (window.confirm(L(w.state === 'preparing' ? '결혼식 준비를 접습니까? 낸 비용의 50%를 돌려받고, 교제는 그대로입니다.' : '약혼을 물립니까? 교제는 그대로입니다.', w.state === 'preparing' ? 'Call off the wedding? 50% of what you paid is refunded; you stay together.' : 'Call off the engagement? You stay together.'))) wd(() => window.sllm.weddingCancel('sec')); }); x.disabled = waiting; ch.append(x);
    }
    if (S.propose) { const b = btn('love', L('청혼하기', 'Propose'), () => { mode = mode === 'propose' ? '' : 'propose'; draw(false); box.querySelector('textarea')?.focus(); }); b.disabled = waiting; ch.append(b); }
    const inr = h('div', 'sec-in'); const ta = h('textarea'); ta.maxLength = 600;
    ta.placeholder = mode === 'confess' ? L('그녀에게 전할 마음 (Enter 보내기)', 'What you want to tell her (Enter to send)') : mode === 'propose' ? L('청혼의 말 (Enter 보내기)', 'Your proposal (Enter to send)') : L('비서에게 말하기 (Enter 보내기, Shift+Enter 줄바꿈)', 'Speak to your secretary (Enter to send, Shift+Enter for a new line)');
    const send = btn('', L('말하기', 'Say'), () => fire()); send.disabled = waiting;
    const fire = () => { const v = ta.value.trim(); if (!v || waiting) return; ta.value = ''; if (mode === 'confess') special('secretaryConfess', v); else if (mode === 'propose') special('secretaryPropose', v); else talk(v); };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fire(); } };
    inr.append(ta, send); box.append(ch, inr);
    drawLog();
  }
  function drawLog() {
    const p = scene && scene.querySelector('.sec-log'); if (!p) return;
    p.classList.toggle('on', logOn); p.textContent = ''; if (!logOn || !S) return; p.dataset.i18nSkip = '';
    const list = (title, items, fmt) => { p.append(h('h4', '', title)); const ol = h('ol'); if (!items.length) ol.append(h('li', '', L('아직 없습니다.', 'Nothing yet.'))); for (const it of items) { const li = h('li'); const [d, t] = fmt(it); li.append(h('b', '', d), document.createTextNode(t)); ol.append(li); } p.append(ol); };
    list(L('업무 메모', 'Work notes'), S.notes || [], (n) => [n.date, n.text]);
    if (S.romance) list(L('함께한 기억', 'Shared memories'), S.mems || [], (n) => [n.date, n.text]);
    // 그녀가 기억하는 나(통치자가 직접 말한 취향) — 잘못 기억한 것은 지울 수 있다
    p.append(h('h4', '', L('각하에 대해 기억하는 것', 'What she remembers about you'))); const lk = h('ol', 'sec-likes');
    if (!(S.likes || []).length) lk.append(h('li', '', L('아직 없습니다. 대화에서 직접 말한 취향·습관을 기억합니다.', 'Nothing yet. She remembers tastes and habits you mention yourself.')));
    for (const x of S.likes || []) { const li = h('li'); li.append(h('b', '', x.date), document.createTextNode(x.text)); const del = btn('x', L('지우기', 'Forget'), async () => { const r = await window.sllm.secretaryForgetLike(x.i).catch(() => null); if (r && r.state) S = { ...r.state, lines: S.lines }; drawLog(); }); del.title = L('잊게 하기', 'Make her forget'); li.append(del); lk.append(li); }
    p.append(lk);
    list(L('함께한 이벤트', 'Shared moments'), S.recall || [], (r) => [r.date, r.title + (r.picks.length ? ' — ' + r.picks.join(' → ') : '')]);
    list(L('역대 통치자', 'Past rulers'), S.past || [], (r) => [r.from + ' ~ ' + r.to, r.name + ' · ' + stageLabel(r.stage)]);
    // 회상: 본 이벤트·CG 와 다시 보기(호감·기록은 바뀌지 않는다)
    p.append(h('h4', '', L('회상', 'Recollections'))); const gl = h('ol', 'sec-gal');
    if (!(S.gallery || []).length) gl.append(h('li', '', L('아직 없습니다.', 'Nothing yet.')));
    for (const g of S.gallery || []) {
      const li = h('li'); li.append(h('b', '', g.title + ' · ' + L(`${g.times}번`, `${g.times}×`)));
      const th = h('div', 'th'); for (const c of g.cgs) { const im = new Image(); im.alt = ''; im.onerror = () => im.remove(); im.src = 'assets/secretary/cg/' + c + '.png'; th.append(im); } li.append(th);
      const rb = btn('', L('다시 보기', 'Replay'), () => { logOn = false; startEv(g.id, true); }); rb.disabled = waiting || !!S.ev; li.append(rb); gl.append(li);
    }
    p.append(gl);
    const lab = h('label'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = !!S.romance;
    cb.onchange = async () => { const r = await window.sllm.secretaryRomance(cb.checked).catch(() => null); if (r && r.state) S = { ...r.state, lines: S.lines }; draw(false); };
    lab.append(cb, document.createTextNode(L('연애 요소 켜기', 'Romance on'))); p.append(lab);
    if (S.romance && S.stage === 'lover' && S.lifelong === false) p.append(h('p', '', L('결혼은 종신 통치자(독재정·제국정)만 할 수 있습니다.', 'Marriage is only possible for rulers for life (dictatorial or imperial).')));
  }

  // ── 이벤트(미연시식) ──
  // Side-by-side balcony: fixed body, separate expression layer, shared camera.
  function balconyPose(pose) {
    if (!scene) return;
    let layer = scene.querySelector('.sec-balcony-stage');
    if (!layer) {
      layer = h('div', 'sec-balcony-stage');
      const body = new Image(); body.className = 'sec-balcony-body'; body.alt = '';
      body.src = 'assets/secretary/scenes/balcony/look.png'; layer.append(body); scene.append(layer);
    }
    const key = pose === 'look' ? 'look' : ['smile','laugh','tender','shy'].includes(pose) ? 'smile' : ['sad','worried','stern','think'].includes(pose) ? 'worried' : 'neutral';
    if (layer.dataset.pose === key) return;
    layer.dataset.pose = key;
    const image = new Image(); image.alt = ''; image.className = 'sec-balcony-face hide';
    image.onload = () => {
      if (!scene || layer.dataset.pose !== key || !layer.isConnected) return;
      const old = [...layer.querySelectorAll('.sec-balcony-face')]; layer.append(image);
      requestAnimationFrame(() => {image.classList.remove('hide'); old.forEach(x => x.classList.add('hide'));});
      setTimeout(() => old.forEach(x => x.remove()), 250);
    };
    image.onerror = () => { if (key !== 'look' && layer.dataset.pose === key) { layer.dataset.pose = ''; balconyPose('look'); } };
    image.src = 'assets/secretary/scenes/balcony/' + key + '.png';
  }

  // Side-by-side restaurant: fixed body, separate expression layer, shared camera.
  function restaurantPose(pose) {
    if (!scene) return;
    let layer = scene.querySelector('.sec-restaurant-stage');
    if (!layer) {
      layer = h('div', 'sec-restaurant-stage');
      const body = new Image(); body.className = 'sec-restaurant-body'; body.alt = '';
      body.src = 'assets/secretary/scenes/restaurant/neutral.png'; layer.append(body); const fg = new Image(); fg.alt = ''; fg.className = 'sec-restaurant-front'; fg.src = 'assets/secretary/scenes/restaurant/foreground.png'; layer.append(fg); scene.append(layer);
    }
    const key = ['smile','laugh','tender','shy'].includes(pose) ? 'smile' : ['sad','worried','stern','think'].includes(pose) ? 'worried' : 'neutral';
    if (layer.dataset.pose === key) return;
    layer.dataset.pose = key;
    const image = new Image(); image.alt = ''; image.className = 'sec-restaurant-face hide';
    image.onload = () => {
      if (!scene || layer.dataset.pose !== key || !layer.isConnected) return;
      const old = [...layer.querySelectorAll('.sec-restaurant-face')]; layer.append(image);
      requestAnimationFrame(() => {image.classList.remove('hide'); old.forEach(x => x.classList.add('hide'));});
      setTimeout(() => old.forEach(x => x.remove()), 250);
    };
    image.onerror = () => { if (key !== 'neutral' && layer.dataset.pose === key) { layer.dataset.pose = ''; restaurantPose('neutral'); } };
    image.src = 'assets/secretary/scenes/restaurant/' + key + '.png';
  }

  // Side-by-side mourning: fixed body, separate expression layer, shared camera.
  function mourningPose(pose) {
    if (!scene) return;
    let layer = scene.querySelector('.sec-mourning-stage');
    if (!layer) {
      layer = h('div', 'sec-mourning-stage');
      const body = new Image(); body.className = 'sec-mourning-body'; body.alt = '';
      body.src = 'assets/secretary/scenes/mourning/neutral.png'; layer.append(body); scene.append(layer);
    }
    const key = ['smile','laugh','tender','shy'].includes(pose) ? 'soft' : ['sad','worried','stern','think'].includes(pose) ? 'sad' : 'neutral';
    if (layer.dataset.pose === key) return;
    layer.dataset.pose = key;
    const image = new Image(); image.alt = ''; image.className = 'sec-mourning-face hide';
    image.onload = () => {
      if (!scene || layer.dataset.pose !== key || !layer.isConnected) return;
      const old = [...layer.querySelectorAll('.sec-mourning-face')]; layer.append(image);
      requestAnimationFrame(() => {image.classList.remove('hide'); old.forEach(x => x.classList.add('hide'));});
      setTimeout(() => old.forEach(x => x.remove()), 250);
    };
    image.onerror = () => { if (key !== 'neutral' && layer.dataset.pose === key) { layer.dataset.pose = ''; mourningPose('neutral'); } };
    image.src = 'assets/secretary/scenes/mourning/' + key + '.png';
  }

  // Side-by-side farewell: fixed body, separate expression layer, shared camera.
  function farewellPose(pose) {
    if (!scene) return;
    let layer = scene.querySelector('.sec-farewell-stage');
    if (!layer) {
      layer = h('div', 'sec-farewell-stage');
      const body = new Image(); body.className = 'sec-farewell-body'; body.alt = '';
      body.src = 'assets/secretary/scenes/farewell/neutral.png'; layer.append(body); scene.append(layer);
    }
    const key = ['smile','laugh','tender','shy'].includes(pose) ? 'soft' : ['sad','worried','stern','think'].includes(pose) ? 'grief' : pose === 'neutral' || pose === 'look' ? 'neutral' : 'eye';
    if (layer.dataset.pose === key) return;
    layer.dataset.pose = key;
    const image = new Image(); image.alt = ''; image.className = 'sec-farewell-face hide';
    image.onload = () => {
      if (!scene || layer.dataset.pose !== key || !layer.isConnected) return;
      const old = [...layer.querySelectorAll('.sec-farewell-face')]; layer.append(image);
      requestAnimationFrame(() => {image.classList.remove('hide'); old.forEach(x => x.classList.add('hide'));});
      setTimeout(() => old.forEach(x => x.remove()), 250);
    };
    image.onerror = () => { if (key !== 'neutral' && layer.dataset.pose === key) { layer.dataset.pose = ''; farewellPose('neutral'); } };
    image.src = 'assets/secretary/scenes/farewell/' + key + '.png';
  }

  // Side-by-side war_night: fixed body, separate expression layer, shared camera.
  function war_nightPose(pose) {
    if (!scene) return;
    let layer = scene.querySelector('.sec-war_night-stage');
    if (!layer) {
      layer = h('div', 'sec-war_night-stage');
      const body = new Image(); body.className = 'sec-war_night-body'; body.alt = '';
      body.src = 'assets/secretary/scenes/war_night/neutral.png'; layer.append(body); const front = new Image(); front.alt = ''; front.className = 'sec-war_night-front'; front.src = 'assets/secretary/scenes/war_night/foreground.png'; layer.append(front); scene.append(layer);
    }
    const key = pose === 'stern' || pose === 'resolved' ? 'resolved' : ['sad','worried','think'].includes(pose) ? 'worried' : 'neutral';
    if (layer.dataset.pose === key) return;
    layer.dataset.pose = key;
    const image = new Image(); image.alt = ''; image.className = 'sec-war_night-face hide';
    image.onload = () => {
      if (!scene || layer.dataset.pose !== key || !layer.isConnected) return;
      const old = [...layer.querySelectorAll('.sec-war_night-face')]; layer.append(image);
      requestAnimationFrame(() => {image.classList.remove('hide'); old.forEach(x => x.classList.add('hide'));});
      setTimeout(() => old.forEach(x => x.remove()), 250);
    };
    image.onerror = () => { if (key !== 'neutral' && layer.dataset.pose === key) { layer.dataset.pose = ''; war_nightPose('neutral'); } };
    image.src = 'assets/secretary/scenes/war_night/' + key + '.png';
  }

  // Side-by-side maintenance: fixed body, separate expression layer, shared camera.
  function maintenancePose(pose) {
    if (!scene) return;
    let layer = scene.querySelector('.sec-maintenance-stage');
    if (!layer) {
      layer = h('div', 'sec-maintenance-stage');
      const body = new Image(); body.className = 'sec-maintenance-body'; body.alt = '';
      body.src = 'assets/secretary/scenes/maintenance/neutral.png'; layer.append(body); scene.append(layer);
    }
    const beat = S && S.ev ? S.ev.beat : 0;
    const key = beat === 1 ? 'drowsy' : beat >= 2 ? (['sad','worried','stern'].includes(pose) ? 'neutral' : 'awake') : (['smile','laugh','tender'].includes(pose) ? 'awake' : 'neutral');
    layer.classList.toggle('closed', beat === 1);
    if (layer.dataset.pose === key) return;
    layer.dataset.pose = key;
    const image = new Image(); image.alt = ''; image.className = 'sec-maintenance-face hide';
    image.onload = () => {
      if (!scene || layer.dataset.pose !== key || !layer.isConnected) return;
      const old = [...layer.querySelectorAll('.sec-maintenance-face')]; layer.append(image);
      requestAnimationFrame(() => {image.classList.remove('hide'); old.forEach(x => x.classList.add('hide'));});
      setTimeout(() => old.forEach(x => x.remove()), 250);
    };
    image.onerror = () => { if (key !== 'neutral' && layer.dataset.pose === key) { layer.dataset.pose = ''; maintenancePose('neutral'); } };
    image.src = 'assets/secretary/scenes/maintenance/' + key + '.png';
  }

  function setBg(key) {
    const el = scene && scene.querySelector('.sec-bg'); if (!el) return;
    if (el.dataset.k === key) return; el.dataset.k = key; el.className = 'sec-bg' + (key ? ' on fb-' + key : ''); el.style.backgroundImage = '';
    if (!key) return; const im = new Image(); im.onload = () => { if (el.dataset.k === key) { el.style.backgroundImage = 'url("' + im.src + '")'; if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el.animate([{opacity:0},{opacity:1}], {duration:900,easing:'ease-out'}); } }; im.src = 'assets/secretary/bg/' + key + '.png';
  }
  function setCg(key) {
    if (S && S.ev && S.ev.id === "maintenance") key = "";
    if (S && S.ev && S.ev.id === "war_night") key = "";
    if (S && S.ev && S.ev.id === "farewell") key = "";
    if (S && S.ev && S.ev.id === "mourning") key = "";
    if (S && S.ev && S.ev.id === "restaurant") key = "";
    if (S && S.ev && S.ev.id === "balcony") key = "";
    const el = scene && scene.querySelector('.sec-cg'), fig = scene && scene.querySelector('.sec-fig'); if (!el) return;
    if (el.dataset.k === key) return; el.dataset.k = key; el.classList.remove('on'); fig && fig.classList.remove('cgon');
    if (!key) return; const im = new Image(); im.onload = () => { if (el.dataset.k !== key) return; el.style.backgroundImage = 'url("' + im.src + '")'; el.classList.add('on'); fig && fig.classList.add('cgon'); }; im.onerror = () => {}; im.src = 'assets/secretary/cg/' + key + '.png';
  }
  function evShow() { evStep = 0; evShown = null; draw(); }
  function drawEv(animate) {
    const E = S.ev;
    if (E.id === 'mourning') {
      scene.dataset.ev = E.id; scene.classList.add('ev'); setBg('funeral_rain');
      const box = scene.querySelector('.sec-box'); box.textContent = '';
      const say = h('div', 'sec-say ev-say'); say.dataset.i18nSkip = ''; say.append(h('span', 'sec-narr', E.narr));
      box.append(say, btn('evc end', L('마치기', 'Finish'), () => { if (!waiting) nextEv(null); })); return;
    }
    scene.dataset.ev = E.id; scene.classList.add('ev'); setBg(E.id === "balcony" ? "balcony_side" : E.id === "restaurant" ? "restaurant_pov" : E.id === "mourning" ? "mourning_pov" : E.id === "farewell" ? "farewell_pov" : E.id === "war_night" ? "war_night_pov" : E.id === "maintenance" ? "maintenance_pov" : E.bg);
    const fig = scene.querySelector('.sec-fig'); if (!fig.classList.contains('in')) { fig.classList.add('in'); }
    const box = scene.querySelector('.sec-box'); box.textContent = '';
    const plate = h('div', 'sec-plate'); plate.append(h('b', '', S.name), h('small', '', E.title + (E.replay ? ' · ' + L('회상', 'Recollection') : '')));
    if (S.romance && !E.replay) { const hb = h('span', 'sec-heart'), bar = h('span', 'bar'), i = h('i'); i.style.width = Math.max(0, Math.min(100, S.aff)) + '%'; bar.append(i); hb.append(h('span', '', '♥'), bar, h('span', '', String(S.aff))); if (lastDelta) { const d = h('span', 'd show', (lastDelta > 0 ? '+' : '') + lastDelta); hb.append(d); setTimeout(() => d.classList.remove('show'), 1600); } plate.append(hb); }
    const tools = h('div', 'sec-tools'); tools.append(btn('', L('기록', 'Records'), () => { logOn = !logOn; drawLog(); })); tools.append(btn('leave', '‹ ' + L('돌아가기', 'Go back'), () => leaveEv())); // 2026-10-24: 이벤트 도중에도 언제든 돌아간다
    const say = h('div', 'sec-say ev-say'); say.dataset.i18nSkip = '';
    const items = [{ narr: E.narr }, ...E.lines]; const step = Math.min(evStep, items.length - 1); const it = items[step];
    const key = E.id + ':' + E.beat + ':' + step;
    if (waiting) { say.append(h('span', 'sec-wait', '…')); }
    else if (it.narr) { if (E.id === 'maintenance') maintenancePose('neutral'); if (E.id === 'war_night') war_nightPose('neutral'); if (E.id === 'farewell') farewellPose('neutral'); if (E.id === 'mourning') mourningPose('neutral'); if (E.id === 'restaurant') restaurantPose('neutral'); if (E.id === 'balcony') balconyPose(evStep === 0 ? 'look' : 'neutral'); setCg(E.cg || ''); const n = h('span', 'sec-narr'); say.append(n); if (animate !== false && evShown !== key) { evShown = key; type(n, it.narr); } else n.textContent = it.narr; }
    else {
      if (E.cg) setCg(E.cg); else setCg('');
      if (E.said && step === 1) say.append(h('span', 'sec-me', '▸ ' + E.said));
      if (it.action) say.append(h('span', 'sec-act', it.action));
      const tx = h('span', 'sec-txt'); say.append(tx); setPose(it.pose || 'idle');
      if (animate !== false && evShown !== key) { evShown = key; type(tx, it.text); } else tx.textContent = it.text;
    }
    const more = step < items.length - 1;
    if (more && !waiting) say.append(h('span', 'sec-more', '▼'));
    say.onclick = () => { if (typing) { typing.fin(); return; } if (more && !waiting) { evStep = step + 1; draw(); } };
    box.append(plate, tools, say);
    if (err) box.append(h('div', 'sec-err', err));
    if (!more && !waiting) {
      const ch = h('div', 'sec-choices ev-choices');
      if (E.choices.length) E.choices.forEach((c, i) => ch.append(btn('evc', c, () => nextEv(i))));
      else ch.append(btn('evc end', E.last ? L('마치기', 'Finish') : L('계속', 'Continue'), () => nextEv(null)));
      box.append(ch);
      // 직접 말하기(2026-10-19): 장면을 띄워 둔 채 자유롭게 대화(장면은 그대로). 앞부분을 잊기 시작할 만큼 길어지면 「돌아갈 시간」. 업무 부탁은 「개인 시간」이라 사양한다.
      if (E.timeUp) { box.append(h('div', 'ev-timeup', L('어느새 시간이 많이 흘렀다. 이제 돌아갈 시간이다.', 'Time has slipped away. It is time to go back.'))); ch.append(btn('evc end', L('돌아가기', 'Go back'), () => leaveEv())); }
      else if (E.canSay) {
        const inr = h('div', 'sec-in ev-in'); const ta = h('textarea'); ta.maxLength = 300; ta.rows = 1;
        ta.placeholder = L('직접 말하기 (Enter 보내기)', 'Say something yourself (Enter to send)');
        const fire = () => { const v = ta.value.trim(); if (!v || waiting) return; ta.value = ''; sayEv(v); };
        ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fire(); } };
        inr.append(ta, btn('', L('말하기', 'Say'), fire)); box.append(inr);
      }
    }
    drawLog();
  }
  async function startEv(id, replay) {
    if (waiting) return; err = ''; waiting = true; draw();
    try { const r = await window.sllm.secretaryEvent(id, replay); if (r && r.state) S = { ...r.state }; if (r && !r.ok) err = r.error || ''; } catch (e) { err = String(e); }
    waiting = false; evStep = 0; evShown = null;
    if (!S.ev && !(S.lines || []).length) { open(); return; } // 이벤트를 열지 못했으면 평소 업무 보고로
    draw();
  }
  async function sayEv(text) {
    if (waiting) return; err = ''; waiting = true; draw();
    try { const r = await window.sllm.secretaryEventSay(text); if (r && r.state) S = { ...r.state }; if (r && !r.ok) err = r.error || ''; } catch (e) { err = String(e); }
    waiting = false; evStep = 1; evShown = null; draw(); // 지문은 건너뛰고 바로 답을
  }
  /** 이벤트 도중 돌아가기(2026-10-24 사용자 요청): 고른 만큼만 남기고 장면을 닫는다. */
  async function leaveEv() {
    if (waiting) return; err = '';
    try { const r = await window.sllm.secretaryEventLeave(); if (r && r.state) S = { ...r.state }; if (r && !r.ok) { err = r.error || ''; draw(); return; } } catch (e) { err = String(e); draw(); return; }
    if (typing) { clearInterval(typing.t); typing = null; } evStep = 0; evShown = null;
    if (scene) { scene.classList.remove('ev'); delete scene.dataset.ev; } setCg(''); setBg(''); setPose('idle');
    if (!S || !(S.lines || []).length) { draw(); open(); return; }
    draw();
  }
  async function nextEv(choice) {
    if (waiting) return; err = ''; waiting = true; draw();
    const silent = S && S.ev && S.ev.id === "mourning";
    let done = false;
    try { const r = await window.sllm.secretaryEventNext(choice); if (r && r.state) S = { ...r.state }; if (r && r.ok) { lastDelta = r.delta || 0; done = !!r.done; } else err = (r && r.error) || ''; } catch (e) { err = String(e); }
    waiting = false; evStep = 0; evShown = null;
    if (done && silent) { if (typing) { clearInterval(typing.t); typing = null; } scene?.remove(); scene = null; S = null; evShown = null; document.body.classList.remove('sec-scene'); refreshBadge(); return; }
    if (done) { scene.classList.remove('ev'); setCg(''); setBg(''); setPose('idle'); if (!(S.lines || []).length) { draw(); open(); return; } }
    draw(); lastDelta = 0;
  }

  // ── 상황 이벤트 알림: 집무실 「비서 호출」 아이콘에 표시(장면 밖에서만 가볍게 물어본다) ──
  async function refreshBadge() {
    const call = $('secCall'); if (!call || scene || document.hidden) return;
    try {
      const st = await window.sllm.secretaryState(); call.style.display = st && st.off ? 'none' : ''; if (st && st.off) { $('secNudge')?.remove(); $('secRetire')?.remove(); return; } call.classList.toggle('sec-pending', !!(st && st.pending)); // off: 단일 의식 제국에는 비서가 없다(알파 11) call.title = st && st.pending ? L('비서가 전할 일이 있는 듯합니다', 'Your secretary seems to have something to tell you') : '';
      if (st && st.pending && st.pending.forced && !scene && !document.body.classList.contains('docked')) { $('secNudge')?.remove(); $('secRetire')?.remove(); enter(); return; } // 서거: 국장이 강제로 시작된다
      const old = $('secRetire');
      if (old && (!st || !st.retire || old.dataset.entry !== JSON.stringify([st.sid, st.retire.key, st.retire.date]))) old.remove();
      if (st && st.retire && !$('secRetire') && !document.body.classList.contains('docked')) showRetire(st);
    } catch (e) { /* 무시 */ }
  }
  // 재선·퇴임 알림 그림(2026-10-19): 집무실 TV 로 떠나는 선대의 뒷모습을 지켜보는 한 장. 이벤트 없음.
  function showRetire(st) {
    $('secNudge')?.remove();
    const el = h('div', 'sec-retire sec-retire-scene'); el.id = 'secRetire'; el.dataset.entry = JSON.stringify([st.sid, st.retire.key, st.retire.date]);
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L('떠나는 이를 바라보며', 'Watching them leave'));
    const card = h('div', 'card'), pic = h('div', 'pic fb-retire'), im = new Image(); im.alt = L('비서가 개인 사무실에서 퇴임 방송을 지켜봅니다.', 'The secretary watches the departure broadcast in her private office.');
    im.onload = () => { pic.classList.remove('fb-retire'); }; im.src = 'assets/secretary/cg/retire_private_office.png'; pic.append(im);
    const caption = h('div', 'retire-caption'), title = h('b'), narr = h('p'), progress = h('small');
    const lines = [
      L('비서의 개인 사무실. 낮게 켜 둔 TV에서 통치자 교체 소식이 흘러나옵니다.', 'In the secretary’s private office, a quiet television reports a change of ruler.'),
      L(`${st.retire.name}이(가) 통치자의 자리에서 물러났습니다. ${st.name || '비서'}은(는) 하던 일을 멈추고 화면을 바라봅니다.`, `${st.retire.name} has stepped down. ${st.name || 'Your secretary'} pauses her work and watches the screen.`),
      L('방송이 이어지는 동안, 비서는 한동안 말없이 그 자리에 앉아 있습니다.', 'As the broadcast continues, the secretary remains seated in silence for a while.')
    ];
    let step = 0, saving = false;
    const button = btn('', '', async () => {
      if (saving) return;
      if (step < lines.length - 1) { step++; render(); return; }
      saving = true; button.disabled = true;
      try { const result = await window.sllm.secretaryRetireSeen(st.sid, st.retire.key, st.retire.date); if (result && result.ok) { el.remove(); refreshBadge(); } else { el.remove(); refreshBadge(); } }
      catch (e) { progress.textContent = L('기록을 저장하지 못했습니다. 다시 눌러 주세요.', 'Could not save. Please try again.'); saving = false; button.disabled = false; }
    });
    function render() { title.textContent = L('떠나는 이를 바라보며', 'Watching them leave'); narr.textContent = lines[step]; progress.textContent = (st.retire.date || '') + ' · ' + (step + 1) + ' / ' + lines.length; button.textContent = step < lines.length - 1 ? L('다음', 'Next') : L('장면 마치기', 'Finish scene'); }
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } if (e.key === 'Tab') { e.preventDefault(); button.focus(); } });
    render(); caption.append(title, narr, progress, button); card.append(pic, caption); el.append(card); document.body.append(el); button.focus();
  }

  // ── 먼저 다가오기: 책상 위 쪽지(2026-10-19) ──
  let nudgeAt = 0;
  async function checkNudge() {
    const call = $('secCall'); if (!call || call.style.display === 'none' || scene || $('secRetire') || document.hidden || Date.now() - nudgeAt < 60000) return; nudgeAt = Date.now();
    let n = null; try { n = await window.sllm.secretaryNudge(); } catch (e) { n = null; }
    let el = $('secNudge'); if (!n || !n.text || scene) { el?.remove(); return; }
    if (!el) { el = h('div', 'sec-nudge'); el.id = 'secNudge'; el.dataset.i18nSkip = ''; document.body.append(el); }
    el.textContent = '';
    el.append(h('b', '', L(`${n.name}의 쪽지`, `A note from ${n.name}`)));
    if (n.anniv && n.anniv.length) el.append(h('small', '', n.anniv.join(' · ')));
    el.append(h('p', '', n.text));
    const row = h('div', 'row');
    row.append(btn('', L('불러 보기', 'Call her'), () => { el.remove(); enter(); }), btn('ghost', L('접어 두기', 'Put it away'), async () => { el.remove(); try { await window.sllm.secretaryNudgeRead(); } catch (e) { /* 무시 */ } }));
    el.append(row);
    const r = call.getBoundingClientRect(); el.style.left = Math.max(8, Math.min(window.innerWidth - 300, r.left + r.width / 2 - 140)) + 'px'; el.style.top = Math.max(8, r.top - 12) + 'px';
  }

  // ── 대화 ──
  let morningLine = ''; // 비서의 아침 인사(2026-10-28 동적 일상 분위기): 게임 달이 바뀐 뒤 처음 부를 때 한 줄, 이번 방문 동안만 보인다
  async function open() {
    err = ''; waiting = true; mode = 'open'; draw();
    morningLine = '';
    try { const r = await window.sllm.secretaryOpen(); if (r && r.state) { S = r.state; morningLine = r.state.morning || ''; } if (r && !r.ok && !r.needName) err = r.error || ''; } catch (e) { err = String(e); }
    waiting = false; mode = ''; draw();
  }
  async function talk(t) {
    err = ''; waiting = true; S.lines = [...(S.lines || []), { who: 'me', text: t }]; draw();
    try { const r = await window.sllm.secretarySay(t); if (r && r.ok) { S = r.state; lastDelta = r.delta || 0; } else { err = (r && r.error) || ''; S.lines = S.lines.slice(0, -1); } } catch (e) { err = String(e); }
    waiting = false; draw(); lastDelta = 0;
  }
  async function quiet(enabled) {
    if (waiting) return;
    if (typing) typing.fin();
    waiting = true; err = ''; mode = ''; draw(false);
    try {
      const r = await window.sllm.secretaryQuiet(enabled);
      if (r && r.ok) S = r.state; else err = r?.error || '';
    } catch (e) { err = String(e); }
    waiting = false; draw(false);
  }
  async function special(fn, t) { // 고백·청혼
    err = ''; waiting = true; S.lines = [...(S.lines || []), { who: 'me', text: t }]; draw();
    try { const r = await window.sllm[fn](t); if (r && r.ok) { S = r.state; mode = ''; } else { err = (r && r.error) || ''; S.lines = S.lines.slice(0, -1); } } catch (e) { err = String(e); }
    waiting = false; draw();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const call = $('secCall'); if (call) call.onclick = enter;
    refreshBadge(); setInterval(refreshBadge, 20000); document.addEventListener('visibilitychange', refreshBadge);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'secretary') refreshBadge(); }); // 알림 카드 → 집무실: 국장·퇴임 바로
    setTimeout(checkNudge, 1500); setInterval(checkNudge, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNudge(); });
    // 장면 동안 Esc 는 아무것도 하지 않는다(물러가라로만 끝낸다). 집무실의 Esc 처리보다 먼저 가로챈다.
    window.addEventListener('keydown', (e) => {
      if (!scene) return;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); if (typing) typing.fin(); return; }
      // 이벤트 중: Enter·Space 로 다음 칸(입력 칸이 없으니 안전)
      if (S && S.ev && (e.key === 'Enter' || e.key === ' ') && !/^(INPUT|TEXTAREA|BUTTON)$/.test((e.target && e.target.tagName) || '')) { e.preventDefault(); scene.querySelector('.ev-say')?.click(); }
    }, true);
    document.addEventListener('sllm-language', () => draw(false));
  });
  window.SLLMSecretary = { enter, leave, startEv }; // 시험·다른 화면에서 부를 때
})();
