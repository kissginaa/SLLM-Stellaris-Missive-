// 통치자 개인 금고 창(2026-10-31) — 침실의 금고에서 연다(외출 화면의 💰 칩과 같은 기능). 앱: src/features/vault-app.ts.
// 쓰는 쪽: <script src="vault-ui.js"></script> 뒤 window.SLLMVault.open(). 문구는 L(한, 영)만(언어 팩 호환). CSS 는 스스로 붙인다.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
  let V = null, root = null, box = null, msg = '';
  function ensure() {
    if (root) return;
    const st = h('style'); st.textContent = `
#svWin{position:fixed;inset:0;z-index:60;background:linear-gradient(#000a,#000a),url(assets/private-rooms/private/vault-open.webp) center/cover no-repeat,#000;display:none;align-items:center;justify-content:center;font:13px/1.45 "Malgun Gothic","Segoe UI",sans-serif;color:#f0e6d6} #svWin.on{display:flex}
#svBox{width:min(720px,94vw);max-height:90vh;overflow:auto;padding:18px 22px;border-radius:14px;background:linear-gradient(#1a1410ee,#0e0b08f2);backdrop-filter:blur(3px);border:1px solid #e8c27a88;box-shadow:0 0 50px #000}
#svBox h2{margin:0 0 4px;color:#f0c870;font-size:20px;display:flex;align-items:center;gap:10px} #svBox h2 .bal{margin-left:auto;font-size:22px;color:#ffe2a0}
.sv-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0} .sv-card{border:1px solid #4a3a26;border-radius:10px;padding:10px 12px;background:#0008}
.sv-card h3{margin:0 0 6px;font-size:13.5px;color:#ffe2a0} .sv-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sv-row input{width:110px;padding:5px 7px;border-radius:5px;border:1px solid #4a3a26;background:#1a140e;color:inherit;font:inherit}
.sv-b{padding:5px 11px;border-radius:5px;border:1px solid #6a5232;background:#1e170f;color:inherit;font:inherit;cursor:pointer} .sv-b:hover:not(:disabled){border-color:#f0c870;color:#f0c870} .sv-b:disabled{opacity:.4;cursor:default}
.sv-b.gold{background:linear-gradient(#6a5218,#3a2c0e);border-color:#f0c870;color:#ffe2a0;font-weight:700}
.sv-note{color:#a8977e;font-size:12px;margin-top:6px} .sv-warn{color:#ffb070;font-size:12px} .sv-msg{min-height:18px;color:#ff8a8a;font-size:12.5px}
.sv-log div{display:grid;grid-template-columns:82px 1fr auto;gap:8px;padding:3px 0;border-top:1px solid #2a2016;font-size:12.5px} .sv-log > .sv-note{display:block} .sv-log .in,.sv-log .earn{color:#9fe0a0} .sv-log .out,.sv-log .spend{color:#ffb0a0}
@media(max-width:620px){.sv-grid{grid-template-columns:1fr}}`;
    document.head.append(st);
    root = h('div'); root.id = 'svWin'; box = h('div'); box.id = 'svBox'; root.append(box); document.body.append(root);
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('on')) { e.stopImmediatePropagation(); close(); } }, true);
    if (window.sllm && window.sllm.onVaultUpdate) window.sllm.onVaultUpdate((v) => { V = v; if (root.classList.contains('on')) draw(); });
  }
  async function open() { if (!window.sllm || !window.sllm.vaultState) return; ensure(); msg = ''; V = await window.sllm.vaultState(); root.classList.add('on'); draw(); }
  function close() { if (root) root.classList.remove('on'); }
  async function move(dir, amt) { const r = await window.sllm[dir === 'in' ? 'vaultDeposit' : 'vaultWithdraw'](amt); if (r && r.state) V = r.state; msg = r && !r.ok && r.error ? r.error : ''; draw(); }
  function draw() {
    box.textContent = ''; if (!V) return;
    if (!V.sid) { box.append(h('h2', '', '💰 ' + L('통치자 개인 금고', 'Ruler\'s private vault')), h('div', 'sv-note', L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.'))); const c0 = h('button', 'sv-b', L('닫기', 'Close')); c0.type = 'button'; c0.onclick = close; box.append(c0); return; }
    const hd = h('h2'); hd.append(document.createTextNode('💰 ' + L('통치자 개인 금고', 'Ruler\'s private vault')), h('span', 'bal', fmt(V.balance) + ' ' + L('크레딧', 'cr'))); box.append(hd);
    box.append(h('div', 'sv-note', L('게임의 에너지 크레딧을 금고에 넣어야 백화점·펫샵·카지노·암시장·스포츠토토에서 쓸 수 있습니다. 넣기·빼기는 게임이 켜져 있을 때 바로 반영됩니다(국고 ↔ 금고).', 'Move energy credits from the treasury into the vault to spend at the store, pet shop, casino, black market and sports toto. Deposits and withdrawals apply while the game is running (treasury ↔ vault).')));
    if (V.pending) { const w = h('div', 'sv-warn', L(`처리 중: ${V.pending.dir === 'in' ? '넣기' : '빼기'} ${fmt(V.pending.amount)} — 게임이 받으면 반영됩니다.`, `Pending: ${V.pending.dir === 'in' ? 'deposit' : 'withdraw'} ${fmt(V.pending.amount)} — applies once the game confirms.`)); const rb = h('button', 'sv-b', L('다시 보내기', 'Resend')); rb.type = 'button'; rb.onclick = async () => { const r = await window.sllm.vaultRetry(); if (r && r.state) V = r.state; draw(); }; w.append(' ', rb); box.append(w); }
    const g = h('div', 'sv-grid');
    for (const dir of ['in', 'out']) {
      const c = h('div', 'sv-card'); c.append(h('h3', '', dir === 'in' ? L('국고 → 금고 (넣기)', 'Treasury → vault (deposit)') : L('금고 → 국고 (빼기)', 'Vault → treasury (withdraw)')));
      const row = h('div', 'sv-row'), inp = h('input'); inp.type = 'number'; inp.min = '1'; inp.step = '100'; inp.value = dir === 'in' ? '1000' : String(Math.min(1000, Math.floor(V.balance)) || 0); row.append(inp);
      for (const v of [500, 1000, 5000]) { const q = h('button', 'sv-b', '+' + fmt(v)); q.type = 'button'; q.onclick = () => { inp.value = String((Number(inp.value) || 0) + v); }; row.append(q); }
      if (dir === 'out') { const all = h('button', 'sv-b', L('전부', 'All')); all.type = 'button'; all.onclick = () => { inp.value = String(Math.floor(V.balance)); }; row.append(all); }
      const go = h('button', 'sv-b gold', dir === 'in' ? L('넣기', 'Deposit') : L('빼기', 'Withdraw')); go.type = 'button'; go.disabled = !!V.pending || !!V.busy; go.onclick = () => move(dir, Number(inp.value)); row.append(go); c.append(row);
      if (dir === 'in') c.append(h('div', 'sv-note', L('에너지 수입이 적자일 때 넣으면 아주 드물게 부패 낌새가 쌓입니다.', 'Depositing while energy income is negative can, rarely, raise suspicion of graft.')));
      g.append(c);
    }
    box.append(g, h('div', 'sv-msg', msg));
    const lg = h('div', 'sv-card'); lg.append(h('h3', '', L('최근 장부', 'Recent ledger'))); const lv = h('div', 'sv-log');
    if (!V.log || !V.log.length) lv.append(h('div', 'sv-note', L('아직 기록이 없습니다.', 'No entries yet.')));
    for (const e of (V.log || []).slice(0, 20)) { const r = h('div'), k = e.k, lab = k === 'in' ? L('넣음', 'Deposit') : k === 'out' ? L('뺌', 'Withdraw') : k === 'spend' ? L('씀', 'Spent') : L('들어옴', 'Earned');
      r.append(h('span', 'sv-note', e.d || ''), h('span', k, lab + (e.what ? ` · ${e.what}` : '') + (e.def ? ' ' + L('(적자 중)', '(in deficit)') : '')), h('b', k, (k === 'in' || k === 'earn' ? '+' : '−') + fmt(e.amt))); lv.append(r); }
    lg.append(lv); box.append(lg);
    const cl = h('button', 'sv-b', L('닫기', 'Close')); cl.type = 'button'; cl.style.marginTop = '10px'; cl.onclick = close; box.append(cl);
  }
  window.SLLMVault = { open, close, isOpen: () => !!(root && root.classList.contains('on')) };
})();
