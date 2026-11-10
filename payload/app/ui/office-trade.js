// 회랑 무역로(시나리오 전용, 2026-11-06 사용자: 「회랑 무역로 아이콘 — 무역 관세·집중 단속 등을 관리」).
// 집무실 「회랑의 삼파전」 칸(office-nobles.js 의 #nbGrp)에 아이콘을 붙인다. 회랑 자리를 맡은 판에서만(scnTrade().on). 앱: src/features/scenario-trade-app.ts
// 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let D = null, msg = '', busy = false;
  const LV_COL = ['#7fd88f', '#c9d27a', '#e0c48a', '#ff9a6a', '#ff5a5a'];

  const css = () => { if ($('trCss')) return; const st = h('style'); st.id = 'trCss'; st.textContent =
    '#trWin{position:fixed;inset:0;z-index:9000;background:#000b;display:flex;align-items:center;justify-content:center}'
    + '#trWin .tr-box{width:min(900px,95vw);max-height:92vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:18px 22px;color:#e8e4d8;background:#14171c;border:1px solid #b8975a;font-size:13px;line-height:1.5;box-shadow:0 10px 40px #000c}'
    + '#trWin .tr-top{display:flex;align-items:center;gap:10px}#trWin .tr-top h3{margin:0;font-size:17px;color:#e8d4a0}#trWin .sp{flex:1}'
    + '#trWin .tr-note{opacity:.8}#trWin .tr-row{display:flex;gap:10px;flex-wrap:wrap}'
    + '#trWin .tr-card{flex:1 1 380px;border:1px solid #b8975a66;padding:10px 12px;background:#b8975a10;display:flex;flex-direction:column;gap:6px}'
    + '#trWin .tr-card h4{margin:0;font-size:15px;color:#e8d4a0}#trWin .tr-lv{display:flex;gap:4px;flex-wrap:wrap}'
    + '#trWin .tr-why{color:#ffb38a}#trWin .tr-msg{padding:8px 10px;border:1px solid #7fd88f88;background:#7fd88f14}'
    + '#trWin table{border-collapse:collapse;width:100%}#trWin td,#trWin th{padding:3px 6px;border-bottom:1px solid #ffffff14;text-align:left}#trWin th{color:#e8d4a0;font-weight:normal}'
    + '#trWin button{padding:5px 10px;cursor:pointer;font-size:12.5px;background:#b8975a22;color:#e8e4d8;border:1px solid #b8975a99}#trWin button.on{background:#b8975a77;border-color:#e8d4a0}#trWin button:disabled{opacity:.45;cursor:default}';
    document.head.append(st); };

  async function act(req) {
    if (busy) return; busy = true; let r = null;
    try { r = await window.sllm.scnTradeSet(req); } catch (e) { r = { ok: false, error: String(e) }; }
    busy = false;
    if (!r || !r.ok) { msg = L('바꾸지 못했습니다: ', 'Could not change: ') + ((r && r.error) || ''); render(); return; }
    msg = L('정책을 바꿨습니다. 두 나라의 반응은 서신함과 호감도에서 확인하세요.', 'Policy changed. Check the mailbox and opinions for both powers\' reactions.');
    D = r; render();
  }

  function render() {
    const ov = $('trWin'); if (!ov || !D) return; const box = ov.querySelector('.tr-box'); box.textContent = '';
    const top = h('div', 'tr-top'), close = h('button', '', L('닫기', 'Close')); close.onclick = () => ov.remove();
    top.append(h('h3', '', L('회랑 무역로', 'Corridor Trade Route')), h('span', 'sp'), close);
    box.append(top, h('div', 'tr-note', L('두 거대 세력 사이를 오가는 상선은 회랑 영토에 들어서는 순간 관세를 냅니다. 관세를 올리면 척당 수입은 늘지만 배가 덜 오고, 그 나라는 불쾌해합니다. 한쪽만 차별하면 두 나라 사이의 긴장도 오릅니다. 같은 정책은 반년에 한 번만 바꿀 수 있습니다.',
      'Merchant ships travelling between the two great powers pay a tariff the moment they enter Corridor space. Higher tariffs earn more per ship but fewer ships come, and that power takes offence. Discriminating against one side also raises tension between them. Each policy can be changed once every six months.')));
    if (!D.live) box.append(h('div', 'tr-why', L('게임이 켜져 있지 않아 지금은 볼 수만 있습니다.', 'The game is not running, so this is view-only for now.')));
    if (msg) box.append(h('div', 'tr-msg', msg));
    const row = h('div', 'tr-row');
    for (const s of D.sides || []) {
      const c = h('div', 'tr-card'); c.append(h('h4', '', L(`${s.name} 상선 관세`, `Tariff on ${s.name} shipping`)), h('div', '', L(`지금: ${s.lvName} (척당 에너지 ${s.toll})`, `Now: ${s.lvName} (${s.toll} energy per ship)`)));
      const lv = h('div', 'tr-lv');
      for (const x of D.levels || []) { const b = h('button', x.n === s.lv ? 'on' : '', x.n === 4 ? x.name : `${x.name} · ${x.toll}`); b.style.borderLeft = `4px solid ${LV_COL[x.n]}`; b.disabled = !D.live || s.rest > 0 || x.n === s.lv; b.onclick = () => { void act({ side: s.side, lv: x.n }); }; lv.append(b); }
      c.append(lv);
      if (s.rest > 0) c.append(h('div', 'tr-why', L(`약 ${Math.ceil(s.rest / 30)}달 뒤에 다시 바꿀 수 있습니다.`, `Can be changed again in about ${Math.ceil(s.rest / 30)} month(s).`)));
      row.append(c);
    }
    box.append(row);
    const ck = h('div', 'tr-card'); ck.append(h('h4', '', L('집중 단속', 'Crackdown')), h('div', 'tr-note', L(`켜면 매달 에너지 ${D.crackCost}가 들고 두 나라 모두 조금 불쾌해하며, 국경 너머로 오는 배가 조금 줄어듭니다. 대신 관세를 낸 배마다 밀수 적발 판정이 있어, 걸리면 벌금 ${D.fine}을 받습니다.`, `While on, it costs ${D.crackCost} energy a month, both powers are mildly offended, and slightly fewer ships cross. In exchange every ship that pays a tariff is inspected for smuggling; offenders are fined ${D.fine}.`)));
    const cb = h('button', D.crack ? 'on' : '', D.crack ? L('단속 중 — 풀기', 'Crackdown on — lift it') : L('단속 시작', 'Start a crackdown')); cb.disabled = !D.live || D.crackRest > 0; cb.onclick = () => { void act({ crack: !D.crack }); }; ck.append(cb);
    if (D.crackRest > 0) ck.append(h('div', 'tr-why', L(`약 ${Math.ceil(D.crackRest / 30)}달 뒤에 다시 바꿀 수 있습니다.`, `Can be changed again in about ${Math.ceil(D.crackRest / 30)} month(s).`)));
    box.append(ck);
    const st = h('table'), hr = h('tr'); hr.append(h('th', '', ''), h('th', '', L('올해', 'This year')), h('th', '', L('지난해', 'Last year'))); st.append(hr);
    const cell = (r, f) => (r ? f(r) : '-');
    const line = (label, f) => { const tr = h('tr'); tr.append(h('td', '', label), h('td', '', cell(D.thisYear, f)), h('td', '', cell(D.lastYear, f))); st.append(tr); };
    const [sa, sb] = D.sides || [];
    if (sa) line(L(`${sa.name} 상선`, `${sa.name} ships`), (r) => L(`${r.a.n}척 · ${r.a.e}`, `${r.a.n} ships · ${r.a.e}`));
    if (sb) line(L(`${sb.name} 상선`, `${sb.name} ships`), (r) => L(`${r.b.n}척 · ${r.b.e}`, `${r.b.n} ships · ${r.b.e}`));
    line(L('밀수 적발', 'Smuggling caught'), (r) => L(`${r.caught}건 · 벌금 ${r.fines}`, `${r.caught} · fines ${r.fines}`));
    line(L('합계(에너지)', 'Total (energy)'), (r) => String(r.total));
    box.append(h('div', '', L('관세 수입', 'Tariff income')), st);
    if ((D.log || []).length) {
      const lt = h('table'); for (const l of D.log) { const tr = h('tr'); tr.append(h('td', '', l.d), h('td', '', l.name), h('td', '', l.sys), h('td', '', String(l.toll)), h('td', '', l.caught ? L('밀수 적발', 'Smuggling caught') : '')); lt.append(tr); }
      box.append(h('div', '', L('최근 통과', 'Recent crossings')), lt);
    }
  }
  async function load() { let r = null; try { r = await window.sllm.scnTrade(); } catch (e) { r = null; } if (!r || !r.ok || !r.on) { $('trWin')?.remove(); return; } D = r; render(); }
  async function openWin() {
    css(); $('trWin')?.remove(); msg = '';
    const ov = h('div'); ov.id = 'trWin'; ov.setAttribute('data-i18n-skip', ''); ov.append(h('div', 'tr-box')); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    document.body.append(ov); await load();
  }
  async function attach() {
    const g = $('nbGrp'), row = g && g.querySelector('.row'); if (!row) return;
    let on = false; try { const r = await window.sllm.scnTrade(); on = !!(r && r.ok && r.on); } catch (e) { on = false; }
    const old = $('trCall'); if (!on) { if (old) old.remove(); return; } if (old) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'trCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 34h36"/><path d="M10 34l3-8h22l3 8"/><rect x="16" y="18" width="7" height="8"/><rect x="25" y="18" width="7" height="8"/><path d="M8 40c4-2 8-2 12 0s8 2 12 0 8-2 8-2"/><path d="M24 6v8M20 10h8"/></svg>';
    b.append(h('span', '', L('회랑 무역로', 'Trade Route')));
    b.onclick = () => { void openWin(); };
    row.append(b);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.scnTrade) return;
    const icons = $('icons'); if (icons) new MutationObserver(() => { if ($('nbGrp') && !$('trCall')) void attach(); }).observe(icons, { childList: true });
    setTimeout(() => { void attach(); }, 950);
    setInterval(() => { void attach(); }, 30000);
    document.addEventListener('sllm-language', () => { const s = document.querySelector('#trCall span'); if (s) s.textContent = L('회랑 무역로', 'Trade Route'); if ($('trWin')) render(); });
  });
})();
