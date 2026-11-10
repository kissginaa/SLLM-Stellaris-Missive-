// 집무실 「원시문명 관측」(2026-11-03). 감청 방송(④)·개입(③)·하늘의 목소리(②)도 이 화면 안에 있다. 앱: src/features/preftl-app.ts, 규칙: src/preftl.ts. 아이콘은 「첩보」 옆(없으면 정책 옆).
// office.html 은 이 파일·css 만 더하고, 아이콘·화면은 모두 여기서 만든다. 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const LLM_KEY = 'sllm.preftl.llm';
  const llmOn = () => { try { return localStorage.getItem(LLM_KEY) === '1'; } catch (e) { return false; } };
  const setLlm = (v) => { try { localStorage.setItem(LLM_KEY, v ? '1' : '0'); } catch (e) { /* 저장 안 됨 */ } };
  let S = null, sel = null, msg = '', err = '', busy = '', draft = '';
  const TITLE = () => L('원시문명 관측', 'Pre-FTL observation');
  const SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="30" r="10"/><path d="M10 26c4 2 12 2 16 0"/><path d="M30 14l8-8M34 18l8-2M28 10l2-6"/><circle cx="36" cy="10" r="3"/></svg>';

  function build() {
    const holo = $('policy') && $('policy').parentElement; if (!holo || $('pftlCall')) return;
    const anchor = $('spyCall') || $('embCall') || document.querySelector('[data-app="policy"]'); if (!anchor) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'pftlCall'; b.innerHTML = SVG; b.append(h('span', '', TITLE()));
    b.onclick = () => { msg = ''; err = ''; show('preftlView'); open(); };
    anchor.after(b);
    const sec = h('section', 'view app'); sec.id = 'preftlView'; sec.setAttribute('aria-label', TITLE());
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', TITLE())); const body = h('div', 'appb'); body.id = 'pftlRoot'; sec.append(hd, body); holo.append(sec);
  }

  function steps(n, max, cls) { const w = h('span', 'pf-steps ' + (cls || '')); for (let i = 1; i <= max; i++) w.append(h('i', i <= n ? 'on' : '')); return w; }
  function card(c) {
    const el = h('button', 'pf-card' + (sel === c.id ? ' sel' : '') + (c.gone ? ' gone' : '')); el.type = 'button';
    el.onclick = () => { sel = c.id; msg = ''; err = ''; draw(); };
    const top = h('div', 'pf-top'); top.append(h('b', '', c.name)); if (c.species) top.append(h('small', '', c.species)); el.append(top);
    const age = h('div', 'pf-row'); age.append(h('span', 'pf-k', L('시대', 'Age')), steps(c.age, c.ageMax), h('span', 'pf-v', c.ageName)); el.append(age);
    const aw = h('div', 'pf-row'); const tr = h('span', 'pf-track'); const bar = h('i'); bar.style.width = Math.max(0, Math.min(100, c.aw)) + '%'; tr.append(bar);
    aw.append(h('span', 'pf-k', L('인지도', 'Awareness')), tr, h('span', 'pf-v', c.lvName + ' ' + c.aw)); el.append(aw);
    if (c.voice && c.voice.tp >= 0 && !c.gone) { const tp = h('div', 'pf-row'); const t2 = h('span', 'pf-track tp'); const b2 = h('i'); b2.style.width = c.voice.tp + '%'; t2.append(b2); tp.append(h('span', 'pf-k', L('기술 진척', 'Progress')), t2, h('span', 'pf-v', c.voice.tp + '%')); el.append(tp); }
    if (c.standoff && !c.standoff.end && !c.gone) { const so = h('div', 'pf-row'); const t3 = h('span', 'pf-track so s' + c.standoff.stage); const b3 = h('i'); b3.style.width = c.standoff.t + '%'; t3.append(b3); so.append(h('span', 'pf-k', L('핵 대치', 'Nuclear')), t3, h('span', 'pf-v', c.standoff.stageName + ' ' + c.standoff.t)); el.append(so); } // 핵 대치(2026-11-05)
    const tags = h('div', 'pf-tags');
    tags.append(h('span', 'pf-tag' + (c.obs === 1 ? ' ok' : ''), c.obs === 1 ? c.mission : c.obs === 2 ? L('다른 나라 관측소', 'Foreign post') : L('관측소 없음', 'No post')));
    if (c.radio) tags.append(h('span', 'pf-tag', L('무선 통신', 'Radio')));
    if (c.hive) tags.append(h('span', 'pf-tag', L('군체', 'Hive')));
    if (c.sit) tags.append(h('span', 'pf-tag warn', c.sit));
    if (c.standoff && c.standoff.end) tags.append(h('span', 'pf-tag' + (c.standoff.end === 'war' ? ' warn' : ' ok'), c.standoff.end === 'war' ? L('핵전쟁 뒤', 'After nuclear war') : L('핵 대치 종결', 'Standoff ended')));
    if (!c.inb && !c.gone) tags.append(h('span', 'pf-tag', L('국경 밖', 'Outside borders')));
    if (c.gone) tags.append(h('span', 'pf-tag' + (c.fate === 'uplifted' ? ' ok' : ''), c.fateText || L('원시문명 아님', 'No longer pre-FTL')));
    el.append(tags); return el;
  }
  function detail(c) {
    const d = h('div', 'pf-detail');
    const hd = h('div', 'pf-dh'); hd.append(h('b', '', c.name), h('span', '', [c.species, c.planet].filter(Boolean).join(' · '))); d.append(hd);
    d.append(h('p', 'pf-note', L(`처음 관측 ${c.first} · 마지막 관측 ${c.seen}`, `First observed ${c.first} · last observed ${c.seen}`)));
    if (c.fateText) d.append(h('div', 'pf-fate ' + (c.fate || ''), c.fateText));
    if (c.standoff) { // 핵 대치(2026-11-05): 긴장도는 앱이 매달 계산, 결말 때만 게임에 반영
      const so = c.standoff, box = h('div', 'pf-so s' + so.stage + (so.end ? ' end ' + so.end : ''));
      box.append(h('b', '', so.text));
      if (!so.end) box.append(h('small', '', (so.trend > 0 ? L(`지금 흐름: 매달 약 +${so.trend} (전쟁 쪽)`, `Drift: about +${so.trend} a month (toward war)`) : so.trend < 0 ? L(`지금 흐름: 매달 약 ${so.trend} (평화 쪽)`, `Drift: about ${so.trend} a month (toward peace)`) : L('지금 흐름: 제자리', 'Drift: steady')) + (so.ours ? L(` · 우리가 낮춘 긴장 ${so.ours}`, ` · tension we lowered: ${so.ours}`) : '')),
        h('small', 'pf-note', L('100에 닿으면 핵전쟁(인구 절반·두 시대 후퇴), 0에 닿으면 평화적 종결. 우리가 20 넘게 낮춰 평화가 오면 통합력 +150. 아래 「개입」의 완화·고조·무력화와 하늘의 목소리로 움직일 수 있습니다.', 'At 100 a nuclear war breaks out (half the people, two ages lost); at 0 it ends peacefully. If peace comes after we lowered tension by more than 20, we gain 150 unity. Move it with the easing, stoking and sabotage interventions below, or with the voice from the sky.')));
      d.append(box);
    }
    const act = h('div', 'pf-act');
    const chk = h('label', 'pf-chk'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = llmOn(); cb.onchange = () => setLlm(cb.checked);
    chk.append(cb, h('span', '', L('AI가 실제 보고서처럼 쓰기', 'Have the AI write it like a real report')));
    act.append(btn('pf-btn', busy === 'report' ? L('작성하는 중…', 'Writing…') : L('관찰 보고서 작성', 'Write field report'), async () => {
      if (busy) return; busy = 'report'; msg = ''; err = ''; draw();
      try { const r = await window.sllm.preftlReport(c.id, cb.checked); if (r && r.state) S = r.state; if (r && r.ok) msg = r.note || ''; else err = (r && r.error) || L('보고서를 쓰지 못했습니다.', 'Could not write the report.'); }
      catch (e) { err = String(e && e.message || e); }
      busy = ''; draw();
    }, !!busy), chk);
    d.append(act);
    if (c.reports && c.reports.length) {
      for (const [i, r] of c.reports.entries()) {
        const box = h('details', 'pf-rep'); if (i === 0) box.open = true;
        const sm = h('summary'); sm.append(h('b', '', r.title), h('span', 'pf-date', r.date + (r.llm ? ' · AI' : ''))); box.append(sm);
        box.append(h('pre', 'pf-body', r.body)); d.append(box);
      }
    } else d.append(h('p', 'pf-empty', L('아직 쓴 보고서가 없습니다.', 'No reports written yet.')));
    // 개입(③): 우리 관측소가 있어야 한다. 한 번 누르면 게임에 명령 한 번.
    if (c.acts && !c.gone) {
      d.append(h('p', 'pf-hh', L('개입', 'Interventions')));
      const run = async (key) => {
        if (busy) return; busy = 'act:' + key; msg = ''; err = ''; draw();
        try { const r = await window.sllm.preftlAct(c.id, key); if (r && r.state) S = r.state; if (r && r.ok) msg = r.text || ''; else err = (r && r.error) || L('개입하지 못했습니다.', 'Could not intervene.'); }
        catch (e) { err = String(e && e.message || e); }
        busy = ''; draw();
      };
      const grid = h('div', 'pf-acts');
      for (const a of c.acts) {
        const box = h('div', 'pf-actc' + (a.block ? ' off' : ''));
        const top = h('div', 'pf-acth'); top.append(h('b', '', a.name), h('span', 'pf-cost', a.energy ? L(`에너지 ${a.energy}`, `${a.energy} energy`) : L('무료', 'Free'))); box.append(top);
        box.append(h('span', 'pf-adesc', a.desc));
        if (a.block) box.append(h('span', 'pf-ablock', a.block));
        box.append(btn('pf-btn', busy === 'act:' + a.key ? L('실행하는 중…', 'Carrying out…') : L('실행', 'Carry out'), () => run(a.key), !!busy || !!a.block || !S.running));
        grid.append(box);
      }
      d.append(grid);
      if (c.obs === 1 && c.missions) {
        const row = h('div', 'pf-mis'); row.append(h('span', 'pf-k', L('관측소 임무', 'Post mission')));
        for (const m of c.missions) { const b = btn('pf-mbtn' + (m.current ? ' on' : ''), m.name, () => run(m.key), !!busy || !!m.block || !S.running); if (m.block && !m.current) b.title = m.block; row.append(b); }
        d.append(row);
      }
    }
    // 하늘의 목소리(②): 인지도가 「완전」이 되기 전까지. 말 한 번 = AI 한 번, 교신을 마치면 인지도가 오른다(위험도만큼 더).
    if (c.voice && !c.gone) {
      const v = c.voice;
      d.append(h('p', 'pf-hh', L('하늘의 목소리', 'Voice from the sky')));
      const vb = h('div', 'pf-voice');
      vb.append(h('p', 'pf-note', L('관측소에서 그들에게 말을 겁니다. 우리를 모를수록 신의 목소리로 받아들입니다. 말마다 위험도가 0(한 사람에게 조용히 속삭임)~3(온 세상이 하늘을 올려다봄)으로 매겨지고, 교신을 마칠 때 그 합만큼 인지도가 오릅니다. 그들 시대에 맞는 쓸모 있는 지식을 가르치면 기술 진척도 조금 오릅니다.', 'Speak to them from the observation post. The less they know of us, the more likely they hear a god. Each line is rated risk 0 (a quiet whisper to one person) to 3 (the whole world looks up); when the conversation ends, awareness rises by the total. Teaching useful knowledge that fits their age also nudges their technological progress.')));
      if (v.faith) vb.append(h('div', 'pf-faith', (v.faith.name ? L(`그들이 부르는 이름: 「${v.faith.name}」 · `, `They call it "${v.faith.name}" · `) : '') + L(`열성도 ${v.faith.devotion} · 교신 ${v.faith.sessions}번`, `Devotion ${v.faith.devotion} · ${v.faith.sessions} conversation(s)`) + (v.faith.text ? ' — ' + v.faith.text : '')));
      if (v.active || (v.turns && v.turns.length)) {
        const log = h('div', 'pf-vlog');
        if (v.speaker) log.append(h('div', 'pf-vwho', L(`듣는 이: ${v.speaker}`, `Listener: ${v.speaker}`)));
        for (const t of v.turns) {
          const row = h('div', 'pf-vt ' + (t.who === 'us' ? 'us' : 'them'));
          if (t.who === 'us') row.append(h('b', '', L('하늘의 목소리', 'The voice')), h('span', '', t.text));
          else { row.append(h('b', '', t.speaker || L('그들', 'They')), h('span', '', t.text)); const tag = h('small', 'pf-vtag' + (t.risk >= 2 ? ' hot' : ''), t.mood + ' · ' + L(`위험도 ${t.risk}`, `risk ${t.risk}`) + (t.teach ? ' · ' + L(`가르침 ${t.teach}`, `taught ${t.teach}`) : '')); row.append(tag); }
          log.append(row);
        }
        vb.append(log);
        vb.append(h('p', 'pf-note', L(`남은 말 ${v.left}번 · 지금 교신을 마치면 인지도 +${v.awIfEnd}`, `${v.left} line(s) left · ending now raises awareness by ${v.awIfEnd}`) + (v.teachIfEnd ? L(` · 기술 진척 +${v.teachIfEnd}%`, ` · progress +${v.teachIfEnd}%`) : '')));
      }
      if (v.block) vb.append(h('p', 'pf-ablock', v.block));
      else {
        const ta = h('textarea', 'pf-vin'); ta.rows = 2; ta.maxLength = 500; ta.value = draft; ta.placeholder = L('하늘에서 들려줄 말…', 'What the voice will say…'); ta.oninput = () => { draft = ta.value; };
        const say = async () => {
          const text = ta.value.trim(); if (!text || busy) return; busy = 'voice'; msg = ''; err = ''; draw();
          try { const r = await window.sllm.preftlVoiceSay(c.id, text); if (r && r.state) S = r.state; if (r && r.ok) { draft = ''; if (r.done) msg = r.done; } else err = (r && r.error) || L('말을 전하지 못했습니다.', 'The words did not get through.'); }
          catch (e) { err = String(e && e.message || e); }
          busy = ''; draw();
        };
        ta.onkeydown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); say(); } };
        const row = h('div', 'pf-vrow'); row.append(ta, btn('pf-btn', busy === 'voice' ? L('듣는 중…', 'Listening…') : L('말하기', 'Speak'), say, !!busy));
        if (v.active) row.append(btn('pf-btn', busy === 'vend' ? L('마치는 중…', 'Ending…') : L('교신 마치기', 'End conversation'), async () => {
          if (busy) return; busy = 'vend'; msg = ''; err = ''; draw();
          try { const r = await window.sllm.preftlVoiceEnd(c.id); if (r && r.state) S = r.state; if (r && r.ok) msg = r.text || ''; else err = (r && r.error) || ''; }
          catch (e) { err = String(e && e.message || e); }
          busy = ''; draw();
        }, !!busy));
        vb.append(row);
      }
      if (v.after && v.after.length) {
        vb.append(h('p', 'pf-hh', L('그 뒤의 일', 'Afterwards')));
        for (const [i, a] of v.after.entries()) {
          const box = h('details', 'pf-rep pf-aft'); if (i === 0) box.open = true;
          const sm = h('summary'); sm.append(h('b', '', a.headline), h('span', 'pf-date', a.date + ' · ' + a.kind + (a.llm ? ' · AI' : ''))); box.append(sm);
          box.append(h('p', 'pf-body', a.body)); vb.append(box);
        }
      }
      d.append(vb);
    }
    // 감청 방송(④): 누를 때만 만든다. 같은 「AI가 쓰기」 설정을 쓴다.
    const bh = h('div', 'pf-bh'); bh.append(h('p', 'pf-hh', L('감청 방송', 'Intercepted broadcasts') + (c.radioMedium ? ' · ' + c.radioMedium : '')));
    bh.append(btn('pf-btn', busy === 'listen' ? L('듣는 중…', 'Listening…') : L('방송 감청', 'Listen in'), async () => {
      if (busy) return; busy = 'listen'; msg = ''; err = ''; draw();
      try { const r = await window.sllm.preftlIntercept(c.id, llmOn()); if (r && r.state) S = r.state; if (r && r.ok) msg = r.note || ''; else err = (r && r.error) || L('방송을 잡지 못했습니다.', 'Could not pick up a broadcast.'); }
      catch (e) { err = String(e && e.message || e); }
      busy = ''; draw();
    }, !!busy || !!c.listenBlock));
    d.append(bh);
    if (c.listenBlock) d.append(h('p', 'pf-note', c.listenBlock));
    if (c.broadcasts && c.broadcasts.length) {
      for (const [i, b] of c.broadcasts.entries()) {
        const box = h('details', 'pf-rep pf-bc'); if (i === 0) box.open = true;
        const sm = h('summary'); sm.append(h('b', '', b.title), h('span', 'pf-date', b.date + (b.llm ? ' · AI' : ''))); box.append(sm);
        box.append(h('pre', 'pf-body', b.body)); d.append(box);
      }
    }
    if (c.log && c.log.length) {
      d.append(h('p', 'pf-hh', L('변화 기록', 'Change log')));
      const ol = h('ol', 'pf-log'); for (const x of c.log) { const li = h('li'); li.append(h('span', '', x.date), h('b', '', x.text)); ol.append(li); } d.append(ol);
    }
    return d;
  }
  function draw() {
    const r = $('pftlRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'pf-main'); r.append(w);
    if (!S || !S.sid) { w.append(h('p', 'pf-empty', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    const top = h('div', 'pf-head');
    top.append(h('p', 'pf-note', L('조사선이나 관측소로 처음 접촉한 원시문명과 우리 국경 안의 원시문명이 나옵니다. 자동으로 계속 관측하지 않고, 이 화면을 열 때 한 번 새로 봅니다. 인지도가 「완전」이 되면 그들이 우리 존재를 알게 되고 게임이 통신을 엽니다.', 'Shows pre-FTL civilizations first contacted by our survey ships or observation posts, and those inside our borders. They are not watched continuously: opening this screen takes one fresh look. When awareness becomes "Full" they know we exist and the game opens communications.')));
    top.append(btn('pf-btn', busy === 'scan' ? L('관측하는 중…', 'Observing…') : L('새로 관측', 'Observe now'), async () => {
      if (busy) return; busy = 'scan'; msg = ''; err = ''; draw();
      try { const res = await window.sllm.preftlScan(); if (res && res.state) S = res.state; if (res && res.ok) msg = res.n ? L(`원시문명 ${res.n}곳을 관측했습니다.`, `Observed ${res.n} civilization(s).`) : L('우리 국경 안에 원시문명이 없습니다.', 'There are no pre-FTL civilizations inside our borders.'); else err = (res && res.error) || L('관측하지 못했습니다.', 'Could not observe.'); }
      catch (e) { err = String(e && e.message || e); }
      busy = ''; draw();
    }, !!busy || !S.running));
    w.append(top);
    if (S.lastScan) w.append(h('p', 'pf-note', L(`마지막 관측: ${S.lastScan}`, `Last observation: ${S.lastScan}`)));
    if (msg) w.append(h('div', 'pf-ok', msg)); if (err) w.append(h('div', 'pf-err', err));
    if (S.warn) w.append(h('div', 'pf-warn', S.warn));
    if (!S.items.length) { w.append(h('p', 'pf-empty', S.lastScan ? L('우리 국경 안에서 관측된 원시문명이 없습니다.', 'No pre-FTL civilizations have been observed inside our borders.') : L('아직 관측 기록이 없습니다. 「새로 관측」을 눌러 보세요.', 'No observations yet. Press "Observe now".'))); return; }
    if (sel === null || !S.items.some((c) => c.id === sel)) sel = S.items[0].id;
    const grid = h('div', 'pf-grid'), list = h('div', 'pf-list');
    for (const c of S.items) list.append(card(c));
    grid.append(list, detail(S.items.find((c) => c.id === sel))); w.append(grid);
  }
  async function load() { try { S = await window.sllm.preftlState(); } catch (e) { S = null; } draw(); }
  // 화면을 열 때: 먼저 저장된 것을 보여 주고, 이 게임 날짜에 아직 안 봤으면 그때 한 번 게임에 묻는다.
  async function open() {
    await load(); if (!window.sllm.preftlOpen || busy) return;
    busy = 'scan'; draw();
    try { const r = await window.sllm.preftlOpen(); if (r && r.state) S = r.state; if (r && !r.ok) err = r.error || ''; }
    catch (e) { err = String(e && e.message || e); }
    busy = ''; draw();
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.preftlState) return;
    setTimeout(() => { build(); load(); }, 500); // 「첩보」 아이콘(office-embassy.js) 뒤
    if (window.sllm.onPreftlUpdate) window.sllm.onPreftlUpdate((v) => { S = v; draw(); });
    document.addEventListener('sllm-language', () => {
      const b = $('pftlCall'); if (b) b.querySelector('span').textContent = TITLE();
      const t = $('preftlView') && $('preftlView').querySelector('h3'); if (t) t.textContent = TITLE();
      const bk = $('preftlView') && $('preftlView').querySelector('.back'); if (bk) bk.textContent = '‹ ' + L('바탕화면', 'Desktop');
      load();
    });
  });
  window.SLLMPreftl = { load };
})();
