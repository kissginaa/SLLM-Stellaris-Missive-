// 시나리오 은하 지도 화면(2026-11-06). 자료: window.sllm.scnMap() — src/features/scenario-map-app.ts. 문구는 L(한, 영)만(언어 팩 호환).
// 그림: 캔버스에 항로·성계·섹터 구역(그 섹터 땅 성계마다 둥근 빛 — 섹터마다 나라 색을 조금씩 달리), 그 위 HTML 카드에 섹터 총독 초상화·이름.
// 조작: 끌어서 옮기기 · 휠로 확대 · 카드나 오른쪽 목록을 누르면 그 섹터로. 멀리서 보면 초상화만, 가까이 가면 「어느 구역 · 누구 총독」.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const cv = $('cv'), g = cv.getContext('2d'), cards = $('cards'), sm = $('sm'), tip = $('tip');
  const W = (s) => ({ x: -s.x, y: s.y }); // 세이브 좌표 → 지도 좌표(작전지휘실과 같음)
  let D = null, view = { cx: 0, cy: 0, k: 1 }, sel = -1, byId = new Map(), secCol = [], layer = null;
  // 다른 모드(첩보 지도 = 회랑 정보국, 2026-11-07)가 카드·오른쪽 판·고르기에 끼어드는 자리. ui/scenario-intel.js 가 ?mode=intel 일 때 채운다.
  const HOOK = () => window.SCNMAP_HOOK || null;

  // ---- 색: 나라 색에서 섹터마다 밝기·색조를 조금 옮긴다 ----
  const hex2hsl = (hx) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hx || ''); if (!m) return [195, 60, 55];
    const n = parseInt(m[1], 16), r = (n >> 16) / 255, gg = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2; let hh = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (gg - b) / d + (gg < b ? 6 : 0) : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; hh *= 60; }
    return [hh, s * 100, l * 100];
  };
  const hsl = (a) => `hsl(${a[0].toFixed(0)},${Math.max(20, Math.min(95, a[1])).toFixed(0)}%,${Math.max(28, Math.min(78, a[2])).toFixed(0)}%)`;
  const ownerCol = (o) => (D && D.countries[String(o)] ? D.countries[String(o)].color : '#8a9aa6');
  function sectorColors() {
    const per = new Map(); secCol = [];
    for (const s of D.sectors) { const k = per.get(s.owner) || 0; per.set(s.owner, k + 1); const [hh, ss, ll] = hex2hsl(ownerCol(s.owner)); secCol[s.i] = hsl([hh + ((k % 5) - 2) * 7, ss + 8, ll + ((k % 3) - 1) * 11]); }
  }

  // ---- 화면 변환 ----
  const rect = () => cv.getBoundingClientRect();
  const SIDE = 310; // 오른쪽 목록 폭(+ 여백)
  const toScr = (p, r) => ({ x: (p.x - view.cx) * view.k + r.width / 2, y: (p.y - view.cy) * view.k + r.height / 2 });
  function fit() {
    if (!D || !D.systems.length) return; const r = rect(); const xs = D.systems.map((s) => W(s).x), ys = D.systems.map((s) => W(s).y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    view.k = Math.min((r.width - SIDE - 60) / Math.max(1, x1 - x0), (r.height - 140) / Math.max(1, y1 - y0)) * 0.95; view.k0 = view.k;
    view.cx = (x0 + x1) / 2 + SIDE / 2 / view.k; view.cy = (y0 + y1) / 2; // 오른쪽 목록을 뺀 자리 한가운데
  }

  // ---- 그리기 ----
  function draw() {
    const r = rect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); layer = null; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    if (!D) return;
    // 섹터 구역: 따로 그린 층을 반투명하게 얹는다(겹친 원이 진해지지 않게)
    if (!layer) { layer = document.createElement('canvas'); }
    const R = Math.max(4, Math.min(9.5 * view.k, 46)), blur = Math.max(2, R * 0.35);
    const paint = (only, alpha) => {
      layer.width = cv.width; layer.height = cv.height; const lg = layer.getContext('2d'); lg.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const s of D.systems) { if (s.s < 0 || (only >= 0 && s.s !== only)) continue; const p = toScr(W(s), r); if (p.x < -R || p.y < -R || p.x > r.width + R || p.y > r.height + R) continue; lg.fillStyle = only >= 0 ? '#ffffff' : (secCol[s.s] || '#5fd4e4'); lg.beginPath(); lg.arc(p.x, p.y, R, 0, Math.PI * 2); lg.fill(); }
      g.save(); g.globalAlpha = alpha; g.filter = `blur(${blur.toFixed(1)}px)`; g.drawImage(layer, 0, 0, r.width, r.height); g.restore();
    };
    paint(-1, 0.42); // 섹터 구역(겹친 원이 진해지지 않게 한 층에 그려 반투명하게, 가장자리는 흐리게)
    if (sel >= 0) paint(sel, 0.2); // 고른 섹터는 한 겹 더 밝게
    // 항로
    g.lineWidth = 1; g.strokeStyle = 'rgba(120,200,220,.22)'; g.beginPath();
    for (const [a, b] of D.lanes) { const A = byId.get(a), B = byId.get(b); if (!A || !B) continue; const p = toScr(W(A), r), q = toScr(W(B), r); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); }
    g.stroke();
    // 성계: 주인 색, 주인 없으면 흐린 흰빛
    const dot = Math.max(1.3, Math.min(3.2, 1.6 * view.k / (view.k0 || 1)));
    for (const s of D.systems) {
      const p = toScr(W(s), r); if (p.x < -4 || p.y < -4 || p.x > r.width + 4 || p.y > r.height + 4) continue;
      g.fillStyle = s.o >= 0 ? ownerCol(s.o) : 'rgba(200,215,225,.45)'; g.beginPath(); g.arc(p.x, p.y, dot, 0, Math.PI * 2); g.fill();
    }
    // 섹터 수도: 작은 고리
    for (const sc of D.sectors) { const s = byId.get(sc.sys); if (!s) continue; const p = toScr(W(s), r); g.strokeStyle = sc.core ? '#ffe28a' : secCol[sc.i]; g.lineWidth = sc.core ? 2 : 1.4; g.beginPath(); g.arc(p.x, p.y, dot + 3, 0, Math.PI * 2); g.stroke(); }
    placeCards(r);
  }
  function placeCards(r) {
    const far = view.k < (view.k0 || 1) * 1.7; sm.classList.toggle('far', far);
    const ps = Math.round(Math.max(26, Math.min(58, 34 * Math.sqrt(view.k / (view.k0 || 1)))));
    for (const el of cards.children) {
      const sc = D.sectors[Number(el.dataset.i)], s = sc && byId.get(sc.sys); if (!s) continue;
      const p = toScr(W(s), r); el.style.left = p.x + 'px'; el.style.top = (p.y - 6) + 'px'; el.style.setProperty('--ps', ps + 'px');
      el.style.display = p.x < -80 || p.y < -80 || p.x > r.width + 80 || p.y > r.height + 80 ? 'none' : '';
    }
    if (HOOK() && HOOK().placed) HOOK().placed(); // 첩보 지도: 고른 섹터 포커스 자리 맞추기(2026-11-08)
  }

  // ---- 카드·목록 ----
  const sideName = (sd) => (sd === 'a' ? L('은하 얼라이언스', 'Galactic Alliance') : sd === 'b' ? L('인류 제국', 'Human Empire') : L('세렌 회랑', 'Seren Corridor'));
  const ownerName = (o) => (D.countries[String(o)] ? D.countries[String(o)].name : '');
  const govLine = (sc) => sc.gov ? `${L('총독', 'Governor')} ${sc.gov}` : L('총독 없음', 'No governor');
  const meta = (sc) => [sc.core ? L('수도 섹터', 'Capital sector') : '', sc.noble ? L('귀족', 'Noble') : '', sc.gov && sc.age ? L(`${sc.age}세`, `age ${sc.age}`) : '', L(`성계 ${sc.size}`, `${sc.size} systems`)].filter(Boolean).join(' · ');
  function pic(el, sc) { if (sc.pic) { el.style.backgroundImage = `url("${sc.pic}")`; } else { el.classList.add('none'); el.textContent = sc.gov ? sc.gov.slice(0, 1) : '—'; } }
  function buildCards() {
    cards.textContent = '';
    for (const sc of D.sectors) {
      const el = h('div', 'gv' + (sc.noble ? ' noble' : '')); el.dataset.i = String(sc.i); el.style.setProperty('--sc', secCol[sc.i]);
      const p = h('div', 'pic'); pic(p, sc);
      const tag = h('div', 'tag'); tag.append(h('b', '', sc.name || L('이름 없는 섹터', 'Unnamed sector')));
      const g1 = h('small'); g1.append(document.createTextNode(govLine(sc))); if (sc.noble) { g1.append(' '); g1.append(h('i', '', '✦')); } tag.append(g1);
      el.append(p, tag); el.title = `${sc.name} — ${govLine(sc)}\n${ownerName(sc.owner)} · ${meta(sc)}`;
      if (HOOK() && HOOK().card) HOOK().card(el, sc);
      el.onclick = (e) => { e.stopPropagation(); select(sc.i, true); };
      cards.append(el);
    }
  }
  function buildSide() {
    const side = $('side'); side.textContent = '';
    const order = ['a', 'b', 'p'];
    for (const sd of order) {
      const list = D.sectors.filter((x) => x.side === sd); if (!list.length) continue;
      const head = h('h3', '', `${ownerName(list[0].owner) || sideName(sd)} · ${L(`섹터 ${list.length}`, `${list.length} sectors`)}`); head.style.color = ownerCol(list[0].owner); side.append(head);
      for (const sc of list.sort((x, y) => Number(y.core) - Number(x.core) || y.size - x.size)) {
        const row = h('div', 'row'); row.dataset.i = String(sc.i); row.style.setProperty('--sc', secCol[sc.i]);
        const mini = h('div', 'mini'); if (sc.pic) mini.style.backgroundImage = `url("${sc.pic}")`;
        const tx = h('div'); tx.append(h('b', '', sc.name || L('이름 없는 섹터', 'Unnamed sector')));
        const sm2 = h('small'); sm2.append(document.createTextNode(govLine(sc))); if (sc.noble) { sm2.append(' '); sm2.append(h('i', '', '✦')); } tx.append(sm2);
        row.append(mini, tx); row.title = meta(sc); row.onclick = () => select(sc.i, true); side.append(row);
      }
    }
    if (!D.sectors.length) side.append(h('div', '', D.report ? L('보고된 섹터가 없습니다.', 'No sectors were reported.') : L('게임이 첫 섹터 보고를 보내면(매달 1일) 여기에 섹터와 총독이 나옵니다.', 'Sectors and governors appear here once the game sends its first sector report (on the 1st of each month).')));
  }
  function select(i, fly) {
    sel = sel === i && !fly ? -1 : i;
    for (const el of cards.children) el.classList.toggle('sel', Number(el.dataset.i) === sel);
    for (const el of $('side').querySelectorAll('.row')) { const on = Number(el.dataset.i) === sel; el.classList.toggle('sel', on); if (on) el.scrollIntoView({ block: 'nearest' }); }
    const sc = D.sectors[sel];
    $('info').textContent = sc ? `${sc.name} — ${govLine(sc)} · ${ownerName(sc.owner)} · ${meta(sc)}` : baseInfo();
    if (HOOK() && HOOK().select) HOOK().select(sc || null);
    if (sc && fly) { const s = byId.get(sc.sys); if (s) { const p = W(s); view.k = Math.max(view.k, (view.k0 || 1) * 2.2); view.cx = p.x + SIDE / 2 / view.k; view.cy = p.y; } }
    draw();
  }
  const baseInfo = () => D ? `${D.date || ''}${D.missing ? ' · ' + L(`지도에서 못 찾은 섹터 ${D.missing}`, `${D.missing} sectors not found on the map`) : ''} · ${L('끌어서 옮기기 · 휠로 확대 · 초상화를 누르면 그 섹터로', 'Drag to pan · wheel to zoom · click a portrait to go to its sector')}` : '';

  // ---- 자료 ----
  async function load(force) {
    $('msg').style.display = 'none';
    let d = null; try { d = await window.sllm.scnMap(force); } catch (e) { d = { ok: false, error: String(e && e.message || e) }; }
    if (!d || !d.ok || !d.on) { const m = $('msg'); m.textContent = !d || !d.on ? L('시나리오 세이브가 아닙니다.', 'This is not a scenario save.') : (d.error || L('지도를 읽지 못했습니다.', 'Could not read the map.')); m.style.display = 'block'; return; }
    const first = !D; D = d; byId = new Map(D.systems.map((s) => [s.id, s])); sectorColors();
    $('ttl').textContent = HOOK() && HOOK().title ? HOOK().title() : `${L('은하 지도', 'Galaxy Map')} — ${L(...D.title)}`;
    $('sub').textContent = D.seatRole ? `${L('우리: ', 'Us: ')}${L(...D.seatRole)}` : '';
    const lg = $('legend'); lg.textContent = '';
    for (const sd of ['a', 'b', 'p']) { const id = Object.keys(D.countries).find((k) => D.countries[k].side === sd); if (!id) continue; const c = D.countries[id]; const sp = h('span'); const i = h('i'); i.style.background = c.color; i.style.color = c.color; sp.append(i, document.createTextNode(c.name)); lg.append(sp); }
    if (first) fit();
    buildCards(); if (HOOK() && HOOK().side) HOOK().loaded(D, API); else buildSide(); $('info').textContent = baseInfo(); draw();
  }

  const API = { select: (i, fly) => select(i, fly), draw: () => draw(), recard: () => { if (!D) return; buildCards(); draw(); }, data: () => D };

  // ---- 조작 ----
  let drag = null;
  cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false }; cv.classList.add('drag'); });
  window.addEventListener('mouseup', (e) => { if (drag && !drag.moved && e.target === cv) select(-1, false); drag = null; cv.classList.remove('drag'); });
  window.addEventListener('mousemove', (e) => {
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; view.cx = drag.cx - dx / view.k; view.cy = drag.cy - dy / view.k; draw(); tip.style.display = 'none'; return; }
    if (!D || e.target !== cv) { tip.style.display = 'none'; return; }
    const r = rect(); let best = null, bd = 64;
    for (const s of D.systems) { const p = toScr(W(s), r); const d = (p.x - (e.clientX - r.left)) ** 2 + (p.y - (e.clientY - r.top)) ** 2; if (d < bd) { bd = d; best = s; } }
    if (!best) { tip.style.display = 'none'; return; }
    const sc = best.s >= 0 ? D.sectors[best.s] : null, own = best.o >= 0 ? ownerName(best.o) : L('주인 없음', 'Unclaimed');
    tip.textContent = [best.n || L('이름 없는 성계', 'Unnamed system'), own, sc ? `${sc.name} · ${govLine(sc)}` : ''].filter(Boolean).join(' · ');
    tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; tip.style.display = 'block';
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault(); const r = rect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = (mx - r.width / 2) / view.k + view.cx, wy = (my - r.height / 2) / view.k + view.cy;
    const k = Math.max((view.k0 || 1) * 0.6, Math.min((view.k0 || 1) * 9, view.k * Math.exp(-e.deltaY * 0.0015)));
    view.k = k; view.cx = wx - (mx - r.width / 2) / k; view.cy = wy - (my - r.height / 2) / k; draw();
  }, { passive: false });
  window.addEventListener('resize', () => draw());
  const close = () => { try { window.sllm.scnMapClose(); } catch (e) { window.close(); } };
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (sel >= 0) select(-1, false); else close(); } });
  $('x').onclick = close; $('re').onclick = () => load(true);
  $('x').textContent = L('닫기 (Esc)', 'Close (Esc)'); $('re').textContent = L('새로 읽기', 'Reload');
  document.addEventListener('DOMContentLoaded', () => { void load(false); });
  if (document.readyState !== 'loading') void load(false);
})();
