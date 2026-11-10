// 갤럭틱 포럼(2026-11-04 사용자, 4chan /int/ 형식) — 집무실 「인터넷」 창(office-internet.js)의 네 번째 탭. 앱: src/features/gforum-app.ts · 규칙: src/gforum.ts
// office-internet.js 는 고치지 않는다: 탭 줄(.net-tabs)에 탭 하나를 덧붙이고, 누르면 같은 본문 자리(#netView)에 게시판을 그린다. 이 탭일 때 ⟳ 는 포럼 새로고침.
// 글쓴이는 익명 + 국기(제국). 우리 공식 계정은 「공식」 표시. 문구는 L(한, 영)만 — 언어 팩 호환. 게시글은 생성 데이터라 data-i18n-skip(본문 칸에 이미 걸려 있음).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let on = false, S = null, busy = false, open = null, quote = null, msg = '';
  const FLAGS = {};
  const flagOf = (idx) => (FLAGS[idx] ??= (window.sllm.flagFor ? window.sllm.flagFor(idx).catch(() => null) : Promise.resolve(null)));
  const css = () => { if ($('gfCss')) return; const st = document.createElement('style'); st.id = 'gfCss'; st.textContent = [
    '#net .gf{background:#eef2ff !important;color:#111;font:14px/1.55 arial,helvetica,"Malgun Gothic",sans-serif;min-height:100%;padding:8px 12px 24px;opacity:1;position:relative;isolation:isolate;-webkit-font-smoothing:antialiased}',
    // 읽기 편하게(2026-11-04 사용자): 집무실 홀로그램 글자 번짐(text-shadow·흐림)을 게시판 안에서는 끈다, 답글 상자는 불투명
    '#net .gf,#net .gf *{text-shadow:none !important;filter:none !important;backdrop-filter:none !important}',
    '#net .gf .gf-p{background:#d6daf0 !important;opacity:1 !important}#net .gf-t{color:#111}',
    '#net .gf-top{text-align:center;margin:4px 0 10px}#net .gf-bn{display:block;width:300px;height:100px;margin:0 auto 6px;border:1px solid #b7c5d9;object-fit:cover}#net .gf-top h1{margin:0;color:#af0a0f;font:700 26px/1.2 tahoma,sans-serif;letter-spacing:-1px}#net .gf-top small{color:#555}',
    '#net .gf-bar{display:flex;gap:8px;justify-content:center;align-items:center;margin:6px 0;color:#34345c}#net .gf-bar button,#net .gf button{background:#fff;border:1px solid #b7c5d9;color:#34345c;padding:2px 9px;cursor:pointer;font-size:12px}',
    '#net .gf hr{border:0;border-top:1px solid #b7c5d9;margin:10px 0}',
    '#net .gf-th{margin:0 0 6px}#net .gf-op{padding:2px 0 6px}#net .gf-sub{color:#0f0c5d;font-weight:700}',
    '#net .gf-p{display:table;background:#d6daf0;border:1px solid #b7c5d9;border-left:none;border-top:none;padding:4px 8px;margin:4px 0 4px 18px;max-width:92%}',
    '#net .gf-h{font-size:12px;color:#000}#net .gf-h b{color:#117743}#net .gf-h .no{cursor:pointer;color:#000}#net .gf-h .no:hover{color:#d00}#net .gf-h .off{color:#d00;font-weight:700;margin-left:4px}',
    '#net .gf-h img{width:20px;height:13px;vertical-align:-2px;margin:0 4px;border:1px solid #889;object-fit:cover}#net .gf-h .emp{color:#555;font-size:11px}',
    '#net .gf-t{margin:3px 0 0 6px;white-space:pre-wrap;word-break:break-word}#net .gf-t .gt{color:#789922}#net .gf-t .ql{color:#d00;text-decoration:underline;cursor:pointer}',
    '#net .gf-ev{font-size:11.5px;color:#555;margin:2px 0 4px}#net .gf-more{font-size:12px;color:#707070;margin-left:18px;cursor:pointer}',
    '#net .gf-form{margin:6px 0 0 18px;display:flex;flex-direction:column;gap:4px;max-width:520px}#net .gf-form textarea{min-height:56px;font:13px arial,sans-serif;border:1px solid #aaa;padding:4px}#net .gf-form label{font-size:12px;color:#34345c}',
    '#net .gf-empty{text-align:center;color:#555;margin:30px 0}#net .gf-msg{text-align:center;color:#af0a0f;min-height:1em;font-size:12px}',
  ].join(''); document.head.append(st); };

  const lines = (t) => esc(t).split('\n').map((l) => (/^&gt;(?!&gt;)/.test(l) ? `<span class="gt">${l}</span>` : l.replace(/&gt;&gt;(\d{5,9})/g, '<span class="ql" data-q="$1">&gt;&gt;$1</span>'))).join('\n');
  function postHtml(p, op) {
    const who = esc(p.empire), tag = p.official ? `<span class="off">## ${esc(L('공식', 'Official'))}</span>` : '';
    return `<div class="${op ? 'gf-op' : 'gf-p'}" id="gfp${p.no}"><div class="gf-h"><b>${esc(L('익명', 'Anonymous'))}</b>${tag}<img data-flag="${p.idx}" alt="" title="${who}"><span class="emp">${who}</span> <span class="no" data-reply="${p.no}">No.${p.no}</span></div>`
      + `<div class="gf-t">${p.to ? `<span class="ql" data-q="${p.to}">&gt;&gt;${p.to}</span>\n` : ''}${lines(p.text)}</div></div>`;
  }
  function draw() {
    const view = $('netView'); if (!on || !view) return; css();
    const addr = $('netAddr'); if (addr) addr.textContent = 'galnet://forum.gal/int/' + (open ? 'thread/' + open : '');
    if (!S || !S.ok) { view.innerHTML = `<div class="gf"><p class="gf-empty">${esc((S && S.error) || L('불러오는 중…', 'Loading…'))}</p></div>`; return; }
    if (S.gestalt) { view.innerHTML = `<div class="gf"><p class="gf-empty">${esc(L('단일 의식에게 은하 공용망의 수다는 소음일 뿐입니다.', 'To a gestalt consciousness, the galactic chatter is only noise.'))}</p></div>`; return; }
    const th = S.threads || [];
    const bn = 1 + ((S.date || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 4); // 게시판 배너(GPT 의뢰서 24): 4장 중 하나, 날짜마다 바뀜 — 없으면 숨김
    let h = `<div class="gf"><div class="gf-top"><img class="gf-bn" src="assets/internet/gforum/banner_${bn}.webp" alt="" onerror="this.remove()"><h1>/int/ - ${esc(L('은하 국제', 'Galactic International'))}</h1><small>${esc(L('갤럭틱 포럼 · 은하 공용망 · 모든 글은 자동 번역됨', 'Galactic Forum · galaxy-wide net · all posts machine-translated'))}</small></div>`;
    h += `<div class="gf-bar">${open ? `<button type="button" data-gf="back">[${esc(L('목록으로', 'Return'))}]</button>` : ''}<button type="button" data-gf="refresh"${busy ? ' disabled' : ''}>[${esc(busy ? L('불러오는 중…', 'Loading…') : L('새로고침', 'Refresh'))}]</button></div><div class="gf-msg">${esc(msg)}</div><hr>`;
    if (!th.length) h += `<p class="gf-empty">${esc(L('아직 조용합니다. 은하를 뒤흔들 소식(신문 1면)이 생기면 스레드가 올라옵니다.', 'Quiet for now. Threads appear when galaxy-shaking news (front-page stories) breaks.'))}</p>`;
    for (const t of th) {
      if (open && t.id !== open) continue;
      const [op, ...rest] = t.posts, shown = open ? rest : rest.slice(-3);
      h += `<div class="gf-th">${op ? postHtml({ ...op }, true).replace('<div class="gf-h">', `<div class="gf-h"><span class="gf-sub">${esc(t.title)}</span> `) : ''}<div class="gf-ev">${t.kind === 'chat' ? esc(L('일상 잡담', 'Off-topic chatter')) : esc(L('기사', 'Article')) + ': ' + esc(t.event)} · ${esc(t.date)}</div>`;
      if (!open && rest.length > 3) h += `<div class="gf-more" data-open="${esc(t.id)}">${esc(L(`답글 ${rest.length - 3}개 생략됨. 스레드를 열려면 누르세요.`, `${rest.length - 3} replies omitted. Click to view the thread.`))}</div>`;
      for (const p of shown) h += postHtml(p, false);
      if (open) h += `<div class="gf-form"><label>${quote ? esc(L(`>>${quote}에 답글`, `Replying to >>${quote}`)) + ' ' : ''}</label><textarea id="gfTxt" maxlength="420" placeholder="${esc(L('답글 쓰기 (익명)', 'Write a reply (anonymous)'))}"></textarea><label><input type="checkbox" id="gfOff"> ${esc(L('정부 공식 계정으로 쓰기 — 우리 정부의 입장으로 읽힙니다', 'Post from the official government account — read as our government\'s statement'))}</label><div><button type="button" data-gf="send"${busy ? ' disabled' : ''}>${esc(L('올리기', 'Post'))}</button></div></div>`;
      else h += `<div class="gf-more" data-open="${esc(t.id)}">[${esc(L('답글', 'Reply'))}]</div>`;
      h += '<hr></div>';
    }
    view.innerHTML = h + '</div>';
    for (const img of view.querySelectorAll('img[data-flag]')) flagOf(Number(img.dataset.flag)).then((u) => { if (u) img.src = u; else img.style.visibility = 'hidden'; });
  }
  async function load(refresh, force) {
    busy = true; msg = ''; draw();
    try {
      const r = refresh ? await window.sllm.gforumRefresh(!!force) : await window.sllm.gforumState();
      S = r; if (refresh) msg = r && r.made ? L(`새 스레드 ${r.made}개`, `${r.made} new thread(s)`) : r && r.why === 'month' ? L('이번 달에는 더 새로고침할 수 없습니다(게임 시간이 흐르면 다시).', 'No more refreshes this month (try again as game time passes).') : r && r.why === 'nobody' ? L('통신이 닿는 제국이 없어 글쓴이가 없습니다.', 'No contacted empires to post here yet.') : L('새 글을 받아 오지 못했습니다. 다시 눌러 주세요.', 'Could not fetch new posts. Try again.');
    } catch (e) { msg = String((e && e.message) || e); }
    busy = false; draw();
  }
  async function send() {
    const t = ($('gfTxt') && $('gfTxt').value || '').trim(); if (!t || !open) return;
    busy = true; draw();
    try { const r = await window.sllm.gforumReply({ id: open, text: t, official: !!($('gfOff') && $('gfOff').checked), to: quote }); if (r && r.ok) { S = r.view; quote = null; msg = ''; } else msg = (r && r.error) || L('실패했습니다.', 'Failed.'); } catch (e) { msg = String((e && e.message) || e); }
    busy = false; draw();
  }
  function activate() {
    on = true; open = null; quote = null;
    for (const t of document.querySelectorAll('#net .net-tab')) t.classList.toggle('on', t.dataset.s === 'gf');
    void load(!S, false); // 처음 열 때는 새 소식이 있으면 바로 만든다
  }
  function build() {
    const tabs = document.querySelector('#net .net-tabs'); if (!tabs || $('gfTab')) return !!tabs;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'net-tab'; b.dataset.s = 'gf'; b.id = 'gfTab';
    // 로고(GPT 의뢰서 24): assets/internet/logos/logo_galforum_a_64.webp — 없으면 지구본 선 그림
    b.innerHTML = '<img src="assets/internet/logos/logo_galforum_a_64.webp" alt=""><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-right:5px;display:none"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg><span></span>';
    { const im = b.querySelector('img'), sv = b.querySelector('svg'); im.onerror = () => { im.remove(); sv.style.display = ''; }; }
    b.querySelector('span').textContent = L('갤럭틱 포럼', 'Galactic Forum');
    b.onclick = (e) => { e.stopPropagation(); activate(); };
    tabs.append(b);
    // 다른 탭을 누르면 포럼을 끈다(그 그리기는 office-internet.js 가 한다). ⟳ 는 이 탭일 때 포럼 새로고침으로.
    for (const t of tabs.querySelectorAll('.net-tab')) if (t !== b) t.addEventListener('click', () => { on = false; }, true);
    const rf = document.querySelector('#net .net-rf'); if (rf) rf.addEventListener('click', (e) => { if (!on) return; e.stopImmediatePropagation(); e.preventDefault(); void load(true, true); }, true);
    const view = $('netView');
    if (view) view.addEventListener('click', (e) => {
      if (!on) return; const el = e.target.closest('[data-gf],[data-open],[data-reply],[data-q]'); if (!el) return; e.stopPropagation();
      if (el.dataset.gf === 'back') { open = null; quote = null; draw(); }
      else if (el.dataset.gf === 'refresh') void load(true, true);
      else if (el.dataset.gf === 'send') void send();
      else if (el.dataset.open) { open = el.dataset.open; quote = null; draw(); }
      else if (el.dataset.reply) { if (!open) { const th = (S && S.threads || []).find((t) => t.posts.some((p) => String(p.no) === el.dataset.reply)); if (th) open = th.id; } quote = Number(el.dataset.reply); draw(); const ta = $('gfTxt'); if (ta) ta.focus(); }
      else if (el.dataset.q) { const p = $('gfp' + el.dataset.q); if (p) { p.scrollIntoView({ block: 'center' }); p.style.outline = '2px solid #d00'; setTimeout(() => (p.style.outline = ''), 1200); } }
    }, true);
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.gforumState) return;
    let n = 0; const t = setInterval(() => { if (build() || ++n > 60) clearInterval(t); }, 150);
    document.addEventListener('sllm-language', () => { const b = $('gfTab'); if (b) b.querySelector('span').textContent = L('갤럭틱 포럼', 'Galactic Forum'); if (on) draw(); });
  });
})();
