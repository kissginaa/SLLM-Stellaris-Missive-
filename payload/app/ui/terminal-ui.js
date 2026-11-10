(() => {
  const button = document.getElementById('btnContacts'), list = document.getElementById('contactList');
  const search = document.getElementById('contactSearch'), status = document.getElementById('contactStatus'), reload = document.getElementById('contactReload');
  const led = document.getElementById('tmLed'), ledT = document.getElementById('tmLedT'), bars = document.getElementById('tmBars');
  let state = { sid: '', date: '', items: [], cut: [] }, busy = false, dialing = 0, linked = 0, scanning = false, armed = 0, armTimer = 0;
  const P = (ko, en) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(ko, en) : ko); // 새 문구(2026-10-24)는 한·영 짝으로(언어 팩 호환)
  const TYPE = { fallen_empire: ['몰락 제국', 'Fallen Empire'], awakened_fallen_empire: ['각성 제국', 'Awakened Empire'], enclave: ['엔클레이브', 'Enclave'], mindwarden_enclave: ['정신 감시자 엔클레이브', 'Mindwarden Enclave'], caravaneer_home: ['캐러밴', 'Caravaneers'], dormant_marauders: ['약탈자', 'Marauders'], awakened_marauders: ['각성한 약탈자', 'Awakened Marauders'], ruined_marauders: ['몰락한 약탈자', 'Ruined Marauders'], primitive: ['원시 문명', 'Primitive Civilization'], enclave_mercenary: ['용병 엔클레이브', 'Mercenary Enclave'], swarm: ['은하 위기 · 프레소린 스컬지', 'Crisis · Prethoryn Scourge'], extradimensional: ['은하 위기 · 언비든', 'Crisis · The Unbidden'], extradimensional_2: ['은하 위기 · 이상체', 'Crisis · The Aberrant'], extradimensional_3: ['은하 위기 · 격노체', 'Crisis · The Vehement'], ai_empire: ['은하 위기 · 컨틴전시', 'Crisis · The Contingency'], synth_queen: ['은하 위기 · 세타나', 'Crisis · Cetana'] };
  // 엔클레이브 세부 이름(2026-10-25 알파 11): 앱이 c.sub 를 준다(모드 나라 깃발).
  const SUB = { artist: ['예술가 극단', 'Artisan Troupe'], curator: ['큐레이터 기사단', 'Curator Order'], xura: ['XuraCorp 상회', 'XuraCorp'], riggan: ['Riggan 상업 거래소', 'Riggan Commerce Exchange'], muutagan: ['Muutagan 상인 길드', 'Muutagan Merchant Guild'], salvager: ['고철상 엔클레이브', 'Salvager Enclave'], shroudwalker: ['장막 순례자', 'Shroudwalkers'] };
  const typeName = (t, g, s) => (s && SUB[s] ? P(SUB[s][0], SUB[s][1]) : g === 1 ? P('기계 지성', 'Machine Intelligence') : g === 2 ? P('군집 의식', 'Hive Mind') : t === 'default' || !t ? P('제국', 'Empire') : TYPE[t] ? P(TYPE[t][0], TYPE[t][1]) : P('특수 세력', 'Special power'));
  // 목록 분류(2026-10-24 알파 11): 앱이 c.cat 을 준다. 접은 분류는 이 창에서만 기억한다.
  const CATS = [['empire', '은하 제국', 'Galactic Empires'], ['fallen', '몰락·각성 제국', 'Fallen & Awakened Empires'], ['enclave', '엔클레이브·캐러밴', 'Enclaves & Caravaneers'], ['marauder', '약탈자', 'Marauders'], ['crisis', '은하 위기', 'Galactic Crises'], ['other', '그 밖의 세력', 'Other Powers']];
  const folded = new Set(['cut']);
  const T = (s) => (window.SLLMI18n ? window.SLLMI18n.t(s) : s); // .tm-name 은 자동 번역 제외 칸이라 고정 문구만 직접 번역
  const rel = (s) => Math.max(-1, Math.min(1, s / 200)); // 관계 점수를 막대 길이로(±200 이상은 끝까지)
  const ch = (n) => 'CH ' + String(n).padStart(2, '0');
  function lamp() {
    const cls = scanning || dialing ? 'busy' : state.sid ? 'on' : '';
    led.className = 'tm-led ' + cls; bars.classList.toggle('on', !!state.sid);
    ledT.textContent = scanning ? '스캔 중' : dialing ? '호출 중' : state.sid ? '수신 ' + state.items.length + '채널' : '신호 없음';
  }
  function empty(box, title, text) { const d = document.createElement('div'); d.className = 'tm-empty'; const b = document.createElement('b'); b.textContent = title; d.append(b, text); box.appendChild(d); }
  function head(key, label, count) {
    const h = document.createElement('button'); h.type = 'button'; h.className = 'tm-cat' + (folded.has(key) ? ' folded' : ''); h.setAttribute('aria-expanded', String(!folded.has(key)));
    const t = document.createElement('span'); t.textContent = label; const n = document.createElement('small'); n.textContent = String(count);
    h.append(t, n); h.onclick = () => { if (folded.has(key)) folded.delete(key); else folded.add(key); draw(); }; list.appendChild(h);
  }
  async function cutOrRestore(c, restore) {
    if (busy) return; busy = true; draw();
    try {
      const r = await (restore ? window.sllm.contactRestore : window.sllm.contactCut)({ sid: state.sid, idx: c.idx });
      if (!r.ok) status.textContent = (restore ? P('복구 실패: ', 'Restore failed: ') : P('통신 단절 실패: ', 'Cut-off failed: ')) + r.error;
      else { state = r.state; if (linked === c.idx) linked = 0; status.textContent = (restore ? P('통신 복구: ', 'Restored: ') : P('통신 단절: ', 'Cut off: ')) + c.name; }
    } catch (e) { status.textContent = P('처리 실패: ', 'Failed: ') + e.message; }
    finally { busy = false; armed = 0; draw(); }
  }
  let emo = {}; // 감정 기억(알파 11): idx → {grudge,gratitude,fear,ambition}
  function draw() {
    list.textContent = ''; lamp();
    const term = search.value.trim().toLocaleLowerCase();
    const match = (c) => c.name.toLocaleLowerCase().includes(term);
    const items = state.items.filter(match), cut = (state.cut || []).filter(match);
    if (!items.length && !cut.length) empty(list, term ? '일치하는 채널 없음' : state.sid ? '수신 가능한 채널 없음' : '신호 없음',
      term ? '검색어를 바꿔 보세요.' : state.sid ? '첫 조우를 마친 뒤 채널 스캔을 눌러 주세요.' : '게임을 불러온 뒤 채널 스캔을 누르세요. 이후 게임 날짜로 매달 자동 수신합니다.');
    let n = 0; const ordered = [];
    for (const [key, ko, en] of CATS) {
      const group = items.filter((c) => (c.cat || 'empire') === key); if (!group.length) continue;
      ordered.push({ key, label: P(ko, en), group });
    }
    const showHeads = ordered.length > 1 || cut.length > 0;
    for (const { key, label, group } of ordered) {
      if (showHeads) head(key, label, group.length);
      if (folded.has(key)) { n += group.length; continue; }
      for (const c of group) row(c, ++n);
    }
    if (cut.length) {
      head('cut', P('통신 단절됨', 'Cut off'), cut.length);
      if (!folded.has('cut')) for (const c of cut) {
        const r = document.createElement('div'); r.className = 'tm-row tm-cutrow';
        const chEl = document.createElement('div'); chEl.className = 'tm-ch'; chEl.textContent = '—';
        const nm = document.createElement('div'); nm.className = 'tm-name'; const b = document.createElement('b'); b.textContent = c.name; b.title = c.name; const sm = document.createElement('small'); sm.textContent = typeName(c.type, c.gest, c.sub) + ' · ' + P('목록에서 지움', 'Removed from the list'); nm.append(b, sm);
        const sp = document.createElement('div');
        const re = document.createElement('button'); re.className = 'tm-call'; re.type = 'button'; re.textContent = P('↺ 복구', '↺ Restore'); re.disabled = busy; re.onclick = () => cutOrRestore(c, true);
        r.append(chEl, nm, sp, re); list.appendChild(r);
      }
    }
  }
  function row(c, n) {
    {
      const row = document.createElement('div'); row.className = 'tm-row' + (dialing === c.idx ? ' dialing' : '') + (linked === c.idx ? ' linked' : '');
      const chEl = document.createElement('div'); chEl.className = 'tm-ch'; const avc = document.createElement('div'); avc.className = 'tm-av'; avc.textContent = (c.name.trim()[0] || '?').toUpperCase(); const chs = document.createElement('span'); chs.textContent = ch(n); chEl.append(avc, chs);
      const nm = document.createElement('div'); nm.className = 'tm-name'; const b = document.createElement('b'); b.textContent = c.name; b.title = c.name; const sm = document.createElement('small'); sm.textContent = T(typeName(c.type, c.gest, c.sub)) + ' · ' + T(c.talkOnly ? '대화 전용' : '통신 가능'); if (c.talkOnly) sm.title = T('이 나라는 대화만 할 수 있습니다. 조약·선전포고 같은 게임 행동은 보내지 않습니다.'); nm.append(b, sm);
      const rb = document.createElement('div'); rb.className = 'tm-relbox'; const bar = document.createElement('div'); bar.className = 'tm-rel'; const fill = document.createElement('i'); const r = rel(c.score);
      fill.className = r < 0 ? 'neg' : ''; fill.style.left = (r < 0 ? 50 + r * 50 : 50) + '%'; fill.style.width = Math.abs(r) * 50 + '%'; bar.appendChild(fill);
      const rl = document.createElement('div'); rl.className = 'tm-rel-l'; rl.textContent = '관계 ' + Math.round(c.score); rb.append(bar, rl);
      const call = document.createElement('button'); call.className = 'tm-call'; call.textContent = dialing === c.idx ? '호출 중…' : linked === c.idx ? '연결됨' : '▶ 호출'; call.disabled = busy;
      call.onclick = async () => {
        if (busy) return; busy = true; dialing = c.idx; linked = 0; draw(); status.textContent = c.name + ' 채널(' + ch(n) + ') 호출 중…';
        try {
          const res = await window.sllm.contactDial({ sid: state.sid, idx: c.idx });
          if (!res.ok) status.textContent = '호출 실패: ' + res.error; else { linked = c.idx; status.textContent = '통신 연결됨: ' + c.name; }
        } catch (e) { status.textContent = '호출 실패: ' + e.message; }
        finally { busy = false; dialing = 0; draw(); }
      };
      // 통신 단절(2026-10-24): 모드가 보낸 「민간 선단」 같은 잘못된 연락처를 목록에서 지운다. 두 번 눌러야 지워진다(복구 가능).
      const cutB = document.createElement('button'); cutB.type = 'button'; cutB.className = 'tm-cut' + (armed === c.idx ? ' armed' : ''); cutB.disabled = busy;
      cutB.textContent = armed === c.idx ? P('단절?', 'Cut?') : '✕';
      cutB.title = P('통신 단절: 이 상대를 목록에서 지웁니다. 편지·만찬 등 다른 기능에서도 빠지며, 아래 「통신 단절됨」에서 복구할 수 있습니다.', 'Cut off: remove this contact from the list. It also disappears from letters, dinners and other features; you can restore it under "Cut off" below.');
      cutB.setAttribute('aria-label', cutB.title);
      cutB.onclick = () => { if (armed === c.idx) { clearTimeout(armTimer); cutOrRestore(c, false); return; } armed = c.idx; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = 0; draw(); }, 3000); draw(); };
      // 진품 상점(2026-10-25 알파 11): XuraCorp·Riggan·Muutagan 상인 엔클레이브만. 이름 칸 아래에 둔다(줄 칸 배치는 그대로).
      if (window.SLLMShop && window.SLLMShop.merchants.includes(c.sub)) { const shop = document.createElement('button'); shop.type = 'button'; shop.className = 'tm-shop'; shop.textContent = P('🛒 진품 상점', '🛒 Antiques'); shop.disabled = busy; shop.onclick = () => window.SLLMShop.open(c.sub, c.name); nm.append(shop); }
      if (window.SLLMLoan && c.sub === 'curator') { const ln = document.createElement('button'); ln.type = 'button'; ln.className = 'tm-shop'; ln.textContent = P('📜 대여 의뢰', '📜 Loan request'); ln.disabled = busy; ln.onclick = () => window.SLLMLoan.open(); nm.append(ln); } // 큐레이터 대여(2026-10-25 알파 11)
      if (window.SLLMTour && c.sub === 'artist') { const tr = document.createElement('button'); tr.type = 'button'; tr.className = 'tm-shop'; tr.textContent = P('🎭 순회 공연 의뢰', '🎭 Commission a tour'); tr.disabled = busy; tr.onclick = () => window.SLLMTour.open(); nm.append(tr); } // 예술가 극단 순회 공연(2026-10-25 알파 11)
      // 감정 기억(2026-10-25 알파 11): 눈에 띄는 감정(20 이상)만 이름 칸 아래에 작은 표시로. 게임 호감과는 별개(대화 말투·먼저 오는 편지에만 쓰임).
      { const em = emo[String(c.idx)]; if (em) { const EMO_N = c.gest === 1 ? [P('위협 우선순위', 'Threat priority'), P('협력 가치', 'Cooperation value'), P('위험 평가', 'Risk assessment'), P('확장 기회', 'Expansion opportunity')] : c.gest === 2 ? [P('적대 본능', 'Hostile instinct'), P('공생 본능', 'Symbiotic instinct'), P('경계 본능', 'Wary instinct'), P('포식 본능', 'Predatory instinct')] : [P('원한', 'Grudge'), P('감사', 'Gratitude'), P('두려움', 'Fear'), P('야망', 'Ambition')]; const EMO_L = { grudge: [EMO_N[0], '#c0504d'], gratitude: [EMO_N[1], '#5fa86a'], fear: [EMO_N[2], '#8a7fc0'], ambition: [EMO_N[3], '#d09a3a'] }; /* 게슈탈트식 이름(알파 11): 기계 = 계산값, 군체 = 본능 */ const ks = Object.keys(EMO_L).filter((k) => em[k] >= 20).sort((x, y) => em[y] - em[x]); if (ks.length) { const box = document.createElement('div'); box.className = 'tm-emo'; for (const k of ks) { const i = document.createElement('span'); i.textContent = EMO_L[k][0] + (em[k] >= 70 ? ' ●●●' : em[k] >= 40 ? ' ●●' : ' ●'); i.style.color = EMO_L[k][1]; i.title = c.gest === 1 ? P('이 제국이 실제로 겪은 일로 쌓인 평가입니다(기계 지성이라 감정 대신 계산값으로 표시). 대화 말투와 먼저 보내는 편지에 드러나며, 시간이 지나면 옅어집니다.', 'An assessment built from what actually happened (shown as computed values because this is a machine intelligence). It colors their tone and the letters they send first, and fades over time.') : c.gest === 2 ? P('이 제국이 실제로 겪은 일로 쌓인 본능입니다(군체라 감정 대신 본능으로 표시). 대화 말투와 먼저 보내는 편지에 드러나며, 시간이 지나면 옅어집니다.', 'An instinct built from what actually happened (shown as instincts because this is a hive mind). It colors their tone and the letters they send first, and fades over time.') : P('이 제국이 실제로 겪은 일로 쌓인 감정입니다. 대화 말투와 먼저 보내는 편지에 드러나며, 시간이 지나면 옅어집니다.', 'A feeling built from what actually happened. It colors their tone and the letters they send first, and fades over time.'); box.append(i); } nm.append(box); } } }
      row.append(chEl, nm, rb, call, cutB); list.appendChild(row);
    }
  }
  function update(s) { if (window.sllm.emotionsState) window.sllm.emotionsState().then((m) => { emo = m || {}; draw(); }).catch(() => {}); state = { cut: [], ...s }; if (linked && !state.items.some(c => c.idx === linked)) linked = 0; draw(); if (!busy && !scanning) status.textContent = state.sid ? `수신 완료 · ${state.items.length}채널 · ${state.date || '날짜 확인 중'}` : '대기 중…'; }
  button.onclick = () => { if(openPane!=='contacts')showPane('contacts'); window.sllm.contactsList().then(update); };
  search.oninput = draw;
  reload.onclick = async () => {
    if (busy) return; busy = true; scanning = true; reload.disabled = true; draw(); status.textContent = '게임에서 채널을 스캔하는 중…';
    try { const r = await window.sllm.contactsRefresh(); if (!r.ok) status.textContent = '스캔 실패: ' + r.error; else { state = r.state; status.textContent = `스캔 완료 · ${state.items.length}채널 · ${state.date}`; } }
    catch (e) { status.textContent = '스캔 실패: ' + e.message; }
    finally { busy = false; scanning = false; reload.disabled = false; draw(); }
  };
  window.sllm.onContacts(update);
  window.sllm.contactsList().then(update);
  if (!SETWIN) showPane('contacts');
})();
