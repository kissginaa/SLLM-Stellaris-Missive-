// 타국 주최 만찬(2026-10-23, 사용자 결정: 새 화면을 만들지 않고 기존 「지도자 만찬」 화면을 그대로 쓴다). 앱: src/features/fbanquet-app.ts(banquet.html?mode=foreign).
// 만찬장 그림·좌석·카드·대화 칸은 banquet.html 그대로. 우리가 손님이므로 왼쪽 = 주최 통치자, 오른쪽 = 우리 통치자. 선물·수집품 단추는 숨기고,
// 「초대의 말」 카드를 「참석한 지도자」(소개받기·연락처 교환)로, 대화 칸에 말 걸 상대 고르기·「만찬 마치고 돌아가기」를 더한다. 문구는 L(한, 영)만.
(() => {
  if (!window.SLLM_FB) return;
  const $ = (id) => document.getElementById(id);
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  let S = null, busy = false, IMG = { images: {}, defaults: {} };
  const HO = { grand: ['성대한 환영', 'Grand welcome'], plain: ['평범한 접대', 'Ordinary hospitality'], humiliating: ['냉대', 'Cold reception'] };
  const ART = { grand: 'grand', plain: 'normal', humiliating: 'humiliating' }; // banquet-art.css 의 배경 그림 키
  const CLS = { commander: ['지휘관', 'Commander'], official: ['관료', 'Official'], scientist: ['과학자', 'Scientist'] };
  // 초상화는 지도자 만찬과 같은 순서: 우리 통치자 그림(ruler:player) / 그 제국 그림(country:이름) → 종족 그림(class:)
  const pic = (first, k, seed) => (first && IMG.images[first]) || (k && window.SLLMVariant && SLLMVariant.pick(IMG.images, ['class:' + k], seed, IMG.defaults[k])) || null;
  // 준비: 지도자 만찬 전용 요소 숨기기 + 말 걸 상대 고르기 + 마치기 단추
  for (const id of ['giftOpen', 'archiveOpen', 'giftCard', 'specCard', 'askCard', 'demo']) { const e = $(id); if (e) e.hidden = true; }
  const to = h('select'); to.id = 'fbTo'; to.setAttribute('aria-label', 'to'); to.style.cssText = 'font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:5px 8px';
  $('chatInput').before(to);
  const fin = h('button', 'ghost'); fin.type = 'button'; const tools = document.querySelector('.chat-tools'); if (tools) tools.prepend(fin);
  function statics() {
    document.title = L('타국 만찬', 'Foreign banquet'); document.querySelector('header h1').textContent = '🍽️ ' + L('타국 만찬', 'Foreign banquet');
    document.querySelector('.overline').textContent = 'FOREIGN BANQUET'; document.querySelector('.place-label').textContent = L('타국 주최 · 만찬장', 'Hosted abroad · banquet hall');
    $('close').textContent = L('닫기', 'Close'); $('close').title = L('닫기 (만찬은 마치기 전까지 이어집니다)', 'Close (the dinner continues until you take your leave)');
    fin.textContent = L('만찬 마치고 돌아가기', 'Take your leave');
    document.querySelector('.lower .card h3').textContent = L('참석한 지도자', 'Other guests');
    $('notice').textContent = L('대화에서 한 약속은 조약이나 자원 지급이 아닙니다. 소개받은 사람과는 연락처를 바꿀 수 있고, 다음에 개인 서신을 주고받을 수 있습니다.', 'Promises made in conversation are not treaties or transfers. You can exchange contacts with people you are introduced to and write to them later.');
    $('chatInput').placeholder = L('말을 건네세요… (Ctrl+Enter로 전송)', 'Say something… (Ctrl+Enter to send)'); $('chatSend').textContent = L('말하기', 'Say');
  }
  function seat(id, role, name, sub, cls, first) {
    const el = $(id); el.replaceChildren();
    const fr = h('div', 'portrait'), url = pic(first, cls, name);
    if (url) { const img = h('img'); img.src = url; img.alt = name; img.onerror = () => { fr.textContent = L('초상화 미등록', 'No portrait'); }; fr.append(img); } else fr.textContent = L('초상화 미등록', 'No portrait');
    el.append(h('div', 'role', role), fr, skip(h('div', 'name', name)), skip(h('div', 'ruler', sub)));
  }
  async function act(p) { if (busy) return; busy = true; $('chatError').textContent = ''; render(); try { const r = await p; if (r && r.state) S = r.state; if (r && !r.ok) $('chatError').textContent = r.error || ''; } catch (e) { $('chatError').textContent = String(e); } busy = false; render(); }
  function render(st) {
    if (st) S = st; if (!S) return;
    if (!S.open) { $('chatBusy').textContent = L('만찬이 끝났습니다.', 'The dinner is over.'); $('chatSend').disabled = true; $('chatInput').disabled = true; fin.disabled = true; return; }
    const hl = HO[S.hospitality] || HO.plain;
    document.body.dataset.banquetArt = 'true'; document.body.dataset.greeting = ART[S.hospitality] || 'normal';
    $('title').textContent = L(...hl); $('greeting').textContent = L(...hl); $('date').textContent = S.date || '';
    document.querySelector('.headline p').textContent = S.empire;
    seat('hostSeat', L('주최 통치자', 'Host'), S.host, [S.hostTitle, S.empire].filter(Boolean).join(' · '), S.hostCls || S.playerCls, 'country:' + S.empire);
    seat('guestSeat', L('초대받은 통치자', 'Invited ruler'), S.ruler || L('우리 통치자', 'Our ruler'), L('손님', 'Guest'), S.playerCls, 'ruler:player');
    // 참석한 지도자(소개받기 → 연락처 교환)
    const box = $('invitation'); box.replaceChildren();
    if (!S.guests.length) box.textContent = L('다른 지도자는 참석하지 않았습니다.', 'No other leaders are attending.');
    for (const g of S.guests) {
      const row = h('div'); row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:3px 0';
      row.append(skip(h('b', '', g.name)), h('span', 'muted', L(...(CLS[g.cls] || CLS.official)) + (g.council ? ' · ' + L('평의원', 'Councilor') : '')));
      if (!g.introduced) { const b = h('button', 'ghost', L('소개받기', 'Ask for an introduction')); b.type = 'button'; b.disabled = busy; b.onclick = () => act(window.sllm.fbIntroduce(g.pid)); row.append(b); }
      else if (!g.contact) { const b = h('button', 'ghost', L('연락처 교환', 'Exchange contacts')); b.type = 'button'; b.disabled = busy; b.onclick = () => act(window.sllm.fbExchange(g.pid)); row.append(b); }
      else row.append(h('span', 'muted', L('연락처 교환함', 'Contacts exchanged')));
      box.append(row);
    }
    // 말 걸 상대
    const cur = to.value; to.replaceChildren();
    const o0 = h('option', '', `${S.host} (${L('주최자', 'host')})`); o0.value = ''; skip(o0); to.append(o0);
    for (const g of S.guests.filter((x) => x.introduced)) { const o = skip(h('option', '', g.name)); o.value = g.pid; to.append(o); }
    to.value = [...to.options].some((o) => o.value === cur) ? cur : '';
    // 대화(지도자 만찬과 같은 말풍선)
    $('chatTitle').textContent = L('만찬 대화', 'Dinner conversation');
    const log = $('chatLog'); log.replaceChildren();
    if (!S.talk.length) log.append(h('p', 'muted', S.hospitality === 'humiliating' ? L('한참을 기다린 끝에야 주최자가 모습을 드러냅니다…', 'After a long wait, the host finally appears…') : S.hospitality === 'grand' ? L('의장대와 음악이 당신을 맞이합니다. 주최자가 다가옵니다.', 'An honour guard and music greet you. The host approaches.') : L('정갈하게 차려진 자리로 안내받습니다.', 'You are shown to a neatly laid table.')));
    for (const t of S.talk) { const c = h('article', 'banquet-message ' + (t.who === 'ruler' ? 'player' : 'guest')); c.append(skip(h('b', '', t.name + (t.to ? ' → ' + t.to : ''))), skip(h('div', '', t.text))); log.append(c); }
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    $('chatBusy').textContent = busy || S.busy ? L('상대가 답을 준비하고 있습니다…', 'They are preparing a reply…') : '';
    $('chatSend').disabled = busy || !!S.busy; $('chatInput').disabled = busy; fin.disabled = busy;
  }
  async function send() { const t = $('chatInput').value.trim(); if (!t || busy) return; $('chatInput').value = ''; await act(window.sllm.fbSay(t, to.value)); $('chatInput').focus(); }
  $('chatSend').onclick = send; $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) { e.preventDefault(); void send(); } });
  fin.onclick = async () => { if (busy) return; if (!window.confirm(L('만찬을 마치고 돌아갈까요? 이 제국은 3년 동안 다시 초대하지 않습니다.', 'Take your leave? This empire will not invite you again for three years.'))) return; await window.sllm.fbFinish(); };
  $('close').onclick = () => window.sllm.fbClose();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.sllm.fbClose(); });
  statics(); document.addEventListener('sllm-language', () => { statics(); render(); });
  window.sllm.onFbHall((st) => { if (!busy) render(st); else S = st; });
  window.sllm.getImageState().then((st) => { IMG = st || IMG; }, () => {}).then(() => window.sllm.fbHall()).then((st) => render(st));
})();
