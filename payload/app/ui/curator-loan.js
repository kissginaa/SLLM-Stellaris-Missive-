// 큐레이터 기사단 「대여 의뢰」(알파 11, 2026-10-25). 통신 단말기의 큐레이터 기사단 줄과 전시실 골동품 진열장에서 연다.
// 앱: src/features/collectibles-app.ts(loanState·loanStart). 1년 빌려주면 감정서 + 연구 속도 +3/+5/+8%(360일). 한 번에 한 점.
// 고정 문구는 P(한, 영)(언어 팩 호환). 물건 이름은 앱이 화면 언어로 준다(data-i18n-skip).
(() => {
  const P = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = '.cl-ov{position:fixed;inset:0;z-index:8800;background:rgba(5,7,10,.8);display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:30px 12px}'
    + '.cl-box{width:min(760px,100%);background:#f4ecd8;color:#2b2418;border:2px solid #9a7b3c;border-radius:4px;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:"Noto Serif KR","Noto Serif CJK KR",Georgia,serif}'
    + '.cl-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #c9b27a}.cl-head h3{margin:0;font-size:18px;letter-spacing:.06em}.cl-head small{display:block;color:#8a7a5c;font-size:12px;font-weight:400;margin-top:2px}.cl-head button{margin-left:auto}'
    + '.cl-box button{background:#efe3c4;color:#2b2418;border:1px solid #9a7b3c;border-radius:3px;padding:4px 12px;cursor:pointer;font:inherit}.cl-box button:disabled{opacity:.5;cursor:default}.cl-box button.armed{background:#7a3a1a;color:#fff}'
    + '.cl-msg{padding:10px 18px;color:#6b5a32;font-size:13.5px;line-height:1.6}.cl-cur{margin:0 18px 10px;padding:10px 12px;border:1px dashed #9a7b3c;background:rgba(255,255,255,.35)}.cl-cur b{display:block}'
    + '.cl-list{padding:0 18px 12px}.cl-row{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;border-bottom:1px dotted #b8a57c;padding:7px 0}.cl-row small{display:block;color:#8a7a5c;font-size:11.5px}'
    + '.cl-g1{color:#6b7480}.cl-g2{color:#3f6fb0}.cl-g3{color:#c4821e}.cl-bonus{font-family:Consolas,monospace;color:#2f7a3d;font-weight:700}.cl-hist{padding:0 18px 16px;font-size:12.5px;color:#6b5a32}.cl-hist li{margin:3px 0}.cl-hist button{padding:0 8px;font-size:11.5px;margin-left:6px}';
  let styled = false;
  async function open(opts = {}) {
    if (!styled) { const s = h('style'); s.textContent = css; document.head.append(s); styled = true; }
    document.querySelectorAll('.cl-ov').forEach((x) => x.remove());
    const ov = h('div', 'cl-ov'), box = h('div', 'cl-box'), head = h('div', 'cl-head'), t = h('h3', '', P('대여 의뢰 — 큐레이터 기사단', 'Loan request — The Curator Order')), close = h('button', '', P('닫기', 'Close'));
    t.append(h('small', '', P('「지식은 보존되어야 합니다. 물론 운영비도요.」', '“Knowledge must be preserved. So must our overheads.”'))); close.type = 'button'; head.append(t, close);
    const msg = h('div', 'cl-msg'), cur = h('div'), list = h('div', 'cl-list'), hist = h('div', 'cl-hist'); for (const e of [cur, list, hist]) e.setAttribute('data-i18n-skip', '');
    box.append(head, msg, cur, list, hist); ov.append(box); document.body.append(ov);
    const shut = () => { ov.remove(); document.removeEventListener('keydown', key); }; const key = (e) => { if (e.key === 'Escape') shut(); };
    close.onclick = shut; ov.onclick = (e) => { if (e.target === ov) shut(); }; document.addEventListener('keydown', key);
    let S = null, armed = '', timer = 0, busy = false;
    const draw = () => {
      cur.replaceChildren(); list.replaceChildren(); hist.replaceChildren();
      if (!S) { msg.textContent = P('불러오는 중…', 'Loading…'); return; }
      if (!S.ok) { msg.textContent = S.error; return; }
      msg.textContent = P(`물건 한 점을 1년 동안 빌려주면, 돌아올 때 감정서와 함께 ${S.days}일 동안 모든 연구 속도가 오릅니다(일반 +3% · 희귀 +5% · 전설 +8%). 한 번에 한 점만 빌려줄 수 있습니다.`, `Lend one item for a year; when it returns you receive an appraisal and all research speed rises for ${S.days} days (Common +3% · Rare +5% · Legendary +8%). One item at a time.`)
        + (S.reachable ? '' : ' ' + P('지금은 큐레이터 기사단과 통신이 닿지 않습니다.', 'The Curator Order cannot be reached right now.'));
      if (S.current) { const c = h('div', 'cl-cur'); c.append(h('b', '', P('대여 중: ', 'On loan: ') + S.current.name), h('small', '', P(`${S.current.start}에 빌려줌 · ${S.current.due}에 돌아옴 · 돌아오면 연구 속도 +${S.current.bonus}%`, `Lent ${S.current.start} · returns ${S.current.due} · research speed +${S.current.bonus}% on return`))); cur.append(c); }
      const cands = (S.candidates || []).filter((c) => !opts.only || c.ref === opts.only);
      if (!cands.length) list.append(h('p', '', S.specKnown ? P('빌려줄 수 있는 물건이 없습니다. 상인에게서 진품을 사거나 대보관소에 표본을 모아 보세요.', 'Nothing to lend. Buy antiques from merchants or collect specimens in the Grand Archive.') : P('빌려줄 수 있는 진품이 없습니다. (대보관소 표본은 게임이 켜져 있을 때 목록에 나옵니다.)', 'No antiques to lend. (Grand Archive specimens appear while the game is running.)')));
      for (const c of cands) {
        const row = h('div', 'cl-row'), nm = h('div'); nm.append(h('b', 'cl-g' + c.grade, c.name), h('small', '', (c.kind === 'col' ? P('진품', 'Antique') : P('대보관소 표본', 'Archive specimen')) + ' · ' + c.gradeName));
        const b = h('button', armed === c.ref ? 'armed' : '', armed === c.ref ? P('1년 빌려줄까요?', 'Lend for a year?') : P('빌려주기', 'Lend')); b.type = 'button'; b.disabled = busy || !S.reachable || !!S.current;
        b.onclick = async () => {
          if (armed !== c.ref) { armed = c.ref; clearTimeout(timer); timer = setTimeout(() => { armed = ''; draw(); }, 3000); draw(); return; }
          clearTimeout(timer); armed = ''; busy = true; draw();
          try { const r = await window.sllm.loanStart(c.kind, c.ref); if (r.ok) { S = r.state; } else msg.textContent = r.error; } catch (e) { msg.textContent = e.message; }
          busy = false; draw();
        };
        row.append(nm, h('span', 'cl-bonus', '+' + c.bonus + '%'), b); list.append(row);
      }
      if (S.history && S.history.length) {
        hist.append(h('b', '', P('지난 대여', 'Past loans'))); const ul = h('ul');
        for (const x of S.history) { const li = h('li', '', `${x.name} · ${x.returnedOn} · +${x.bonus}%`); if (x.docId && window.SLLMDocs) { const d = h('button', '', P('감정서', 'Appraisal')); d.type = 'button'; d.onclick = () => window.SLLMDocs.openId(x.docId).catch(() => {}); li.append(d); } ul.append(li); }
        hist.append(ul);
      }
    };
    draw();
    try { S = await window.sllm.loanState(true); } catch (e) { S = { ok: false, error: e.message }; }
    draw();
  }
  window.SLLMLoan = { open };
})();
