// 상인 엔클레이브 「진품 상점」(알파 11, 2026-10-25). 통신 단말기의 XuraCorp·Riggan·Muutagan 줄에서 연다.
// 앱: src/features/collectibles-app.ts(colShop·colBuy). 산 물건은 전시실 「골동품 진열장」에 놓이고, 정품 보증서가 국가 문서함에 들어간다.
// 고정 문구는 P(한, 영)(언어 팩 호환). 물건 이름·설명은 앱이 화면 언어로 준다(data-i18n-skip).
(() => {
  const P = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = '.cs-ov{position:fixed;inset:0;z-index:8800;background:rgba(5,7,10,.8);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:30px 12px}'
    + '.cs-box{width:min(940px,100%);background:#14181e;border:1px solid #3a414c;border-radius:6px;color:#e6e2d8;box-shadow:0 20px 60px rgba(0,0,0,.6)}'
    + '.cs-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #2c323b}.cs-head h3{margin:0;font-size:17px;letter-spacing:.04em}.cs-head small{color:#9aa3ae;display:block;font-size:12px;font-weight:400;margin-top:2px}'
    + '.cs-head button{margin-left:auto}.cs-box button{background:#232a33;color:#e6e2d8;border:1px solid #4a5260;border-radius:4px;padding:5px 12px;cursor:pointer;font:inherit}.cs-box button:disabled{opacity:.5;cursor:default}'
    + '.cs-x .cs-head{background:linear-gradient(90deg,#123d42,#1d5c63)}.cs-r .cs-head{background:linear-gradient(90deg,#2a1218,#5b2a3a)}.cs-m .cs-head{background:linear-gradient(90deg,#173c3a,#2b6e6a 70%,#8a6a2a)}'
    + '.cs-msg{padding:8px 18px;color:#d9c48a;min-height:18px;font-size:13px}.cs-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:6px 18px 18px}'
    + '.cs-card{display:grid;grid-template-columns:96px 1fr;gap:10px;border:1px solid #2f3640;border-radius:5px;padding:10px;background:#181d24}.cs-card.g3{border-color:#8a6420;box-shadow:inset 0 0 0 1px rgba(196,130,30,.25)}'
    + '.cs-pic{width:96px;height:96px;border-radius:4px;background:radial-gradient(circle at 50% 30%,#3a3326,#14120e 75%);display:flex;align-items:center;justify-content:center}.cs-pic img{max-width:92%;max-height:92%}.cs-pic svg{width:58px;height:58px;opacity:.5}'
    + '.cs-card b{display:block;font-size:14px}.cs-meta{font-size:11.5px;color:#9aa3ae;margin:3px 0}.cs-chip{display:inline-block;font-size:10.5px;padding:0 6px;border:1px solid;border-radius:2px;margin-right:6px}.cs-chip.g1{color:#a1a8b1}.cs-chip.g2{color:#7fa6dd}.cs-chip.g3{color:#e0a84a}'
    + '.cs-card p{font-size:12.5px;line-height:1.55;color:#cfcabf;margin:4px 0 8px}.cs-buy{display:flex;align-items:center;gap:8px}.cs-price{font-family:Consolas,monospace;color:#e0c070;font-weight:700}.cs-buy button.armed{background:#7a3a1a;border-color:#c06a3a}'
    + '.cs-sold{padding:0 18px 18px}.cs-sold summary{cursor:pointer;color:#9aa3ae;font-size:13px}.cs-sold li{font-size:12.5px;color:#9aa3ae;margin:4px 0}.cs-empty{padding:20px 18px;color:#9aa3ae}';
  const SIL = '<svg viewBox="0 0 48 48" fill="none" stroke="#c9b27a" stroke-width="2"><path d="M18 8h12M20 8c0 6-8 8-8 18 0 8 5 14 12 14s12-6 12-14c0-10-8-12-8-18"/><path d="M14 44h20"/></svg>';
  const NAME = { xura: () => P('XuraCorp 상회 · 수집품 사업부', 'XuraCorp · Collectibles Division'), riggan: () => P('Riggan 상업 거래소 · 위탁 진품', 'Riggan Commerce Exchange · Consigned antiques'), muutagan: () => P('Muutagan 상인 길드 · 옛 제국의 유산', 'Muutagan Merchant Guild · Legacy of the Empire') };
  const GREET = { xura: () => P('묻지도 따지지도 않는 진품 거래. 환불은 회사 방침상 불가합니다.', 'Genuine articles, no questions asked. No refunds, per company policy.'), riggan: () => P('모든 위탁자는 익명입니다. 출처는 묻지 않으시는 편이 좋습니다.', 'All consignors remain anonymous. It is best not to ask about provenance.'), muutagan: () => P('모든 물건은 정가입니다. 그 단어는 꺼내지 말아 주십시오.', 'Every article is full price. Please do not say that word.') };
  let styled = false;
  async function open(merchant, contactName) {
    if (!styled) { const s = h('style'); s.textContent = css; document.head.append(s); styled = true; }
    document.querySelectorAll('.cs-ov').forEach((x) => x.remove());
    const ov = h('div', 'cs-ov'), box = h('div', 'cs-box ' + ({ xura: 'cs-x', riggan: 'cs-r', muutagan: 'cs-m' })[merchant]);
    const head = h('div', 'cs-head'), t = h('h3', '', P('진품 상점', 'Antiques for sale') + ' — ' + (contactName || '')), close = h('button', '', P('닫기', 'Close'));
    t.append(h('small', '', NAME[merchant]())); close.type = 'button'; head.append(t, close);
    const msg = h('div', 'cs-msg', GREET[merchant]()), list = h('div', 'cs-list'), sold = h('details', 'cs-sold'); list.setAttribute('data-i18n-skip', ''); sold.setAttribute('data-i18n-skip', '');
    box.append(head, msg, list, sold); ov.append(box); document.body.append(ov);
    const shut = () => { ov.remove(); document.removeEventListener('keydown', key); }; const key = (e) => { if (e.key === 'Escape') shut(); };
    close.onclick = shut; ov.onclick = (e) => { if (e.target === ov) shut(); }; document.addEventListener('keydown', key);
    let armed = '', timer = 0, busy = false, S = null;
    const draw = () => {
      list.replaceChildren(); sold.replaceChildren();
      if (!S || !S.ok) { list.append(h('div', 'cs-empty', (S && S.error) || P('불러오는 중…', 'Loading…'))); return; }
      if (!S.reachable) msg.textContent = P('이 상인과 지금 통신이 닿지 않습니다. 단말기 목록을 갱신해 주세요.', 'This merchant cannot be reached right now. Refresh the terminal list.');
      if (!S.items.length) list.append(h('div', 'cs-empty', P('모든 진품이 팔렸습니다. 이 상인이 내놓을 물건은 더 없습니다.', 'Every article has been sold. This merchant has nothing more to offer.')));
      for (const it of S.items) {
        const c = h('div', 'cs-card g' + it.g), pic = h('div', 'cs-pic');
        if (it.img) { const i = h('img'); i.src = it.img; i.alt = ''; pic.append(i); } else pic.innerHTML = SIL;
        const info = h('div'), meta = h('div', 'cs-meta'); meta.append(h('span', 'cs-chip g' + it.g, it.grade), document.createTextNode(it.cls + ' · ' + it.origin));
        const buy = h('div', 'cs-buy'), price = h('span', 'cs-price', it.price.toLocaleString('en-US') + ' EC'), b = h('button', armed === it.id ? 'armed' : '', armed === it.id ? P('정말 살까요?', 'Buy for real?') : P('구매', 'Buy'));
        b.type = 'button'; b.disabled = busy || !S.reachable;
        b.onclick = async () => {
          if (armed !== it.id) { armed = it.id; clearTimeout(timer); timer = setTimeout(() => { armed = ''; draw(); }, 3000); draw(); return; }
          clearTimeout(timer); armed = ''; busy = true; msg.textContent = P('결제를 확인하는 중…', 'Confirming payment…'); draw();
          try {
            const r = await window.sllm.colBuy(it.id);
            if (!r.ok) msg.textContent = r.error; else { S = r.state; msg.textContent = P(`「${it.name}」을(를) 사들였습니다. 전시실 골동품 진열장에 놓였고, 보증서가 국가 문서함에 들어갔습니다.`, `Acquired "${it.name}". It is in the gallery's antiques showcase, and its certificate is in the State archive.`); if (window.SLLMDocs && r.docId) window.SLLMDocs.openId(r.docId).catch(() => {}); }
          } catch (e) { msg.textContent = e.message; }
          busy = false; draw();
        };
        buy.append(price, b); info.append(h('b', '', it.name), meta, h('p', '', it.desc), buy); c.append(pic, info); list.append(c);
      }
      if (S.sold.length) { sold.append(h('summary', '', P(`매진 · 우리가 소장 중 (${S.sold.length})`, `Sold out · in our collection (${S.sold.length})`))); const ul = h('ul'); for (const it of S.sold) ul.append(h('li', '', `${it.name} · ${it.grade} · ${it.price.toLocaleString('en-US')} EC`)); sold.append(ul); }
    };
    draw();
    try { S = await window.sllm.colShop(merchant); } catch (e) { S = { ok: false, error: e.message }; }
    draw();
  }
  window.SLLMShop = { open, merchants: ['xura', 'riggan', 'muutagan'] };
})();
