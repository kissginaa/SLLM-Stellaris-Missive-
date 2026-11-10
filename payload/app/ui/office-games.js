// 화합 대회 초청(시나리오 전용, 2026-11-06 사용자: 「올림픽·월즈는 이벤트처럼 따로 개설 — 우리가 제안해야, 초청 같은 거」).
// 집무실 「회랑의 삼파전」 칸(office-nobles.js 가 만든 #nbGrp)에 아이콘 하나를 붙이고, 누르면 초청장 창. 앱: src/features/scenario-games-app.ts.
// 대회가 확정되면 개최 준비·경기·토토는 우주 경기장(본편 화면) 그대로. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let D = null, msg = '';

  const css = () => { if ($('gmCss')) return; const st = h('style'); st.id = 'gmCss'; st.textContent =
    '#gmWin{position:fixed;inset:0;z-index:9000;background:#000b;display:flex;align-items:center;justify-content:center}'
    + '#gmWin .gm-box{width:min(760px,94vw);max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:18px 22px;color:#e8e4d8;background:#15171d;border:1px solid #b8975a;font-size:13px;line-height:1.5;box-shadow:0 10px 40px #000c}'
    + '#gmWin .gm-top{display:flex;align-items:center;gap:10px}#gmWin .gm-top h3{margin:0;font-size:17px;color:#e8d4a0}#gmWin .sp{flex:1}'
    + '#gmWin .gm-note{opacity:.8}#gmWin .gm-row{display:flex;gap:10px;flex-wrap:wrap}'
    + '#gmWin .gm-card{flex:1 1 300px;border:1px solid #b8975a66;padding:10px 12px;background:#b8975a10;display:flex;flex-direction:column;gap:6px}'
    + '#gmWin .gm-card h4{margin:0;font-size:15px;color:#e8d4a0}#gmWin .gm-why{color:#ffb38a}#gmWin .gm-msg{padding:8px 10px;border:1px solid #7fd88f88;background:#7fd88f14}'
    + '#gmWin table{border-collapse:collapse;width:100%}#gmWin td{padding:3px 6px;border-bottom:1px solid #ffffff14}'
    + '#gmWin button{padding:5px 12px;cursor:pointer;font-size:12.5px;background:#b8975a22;color:#e8e4d8;border:1px solid #b8975a99}#gmWin button:disabled{opacity:.45;cursor:default}';
    document.head.append(st); };

  function render() {
    const ov = $('gmWin'); if (!ov || !D) return; const box = ov.querySelector('.gm-box'); box.textContent = '';
    const top = h('div', 'gm-top'), close = h('button', '', L('닫기', 'Close')); close.onclick = () => ov.remove();
    top.append(h('h3', '', L('화합 대회 초청', 'Invite to the Unity Games')), h('span', 'sp'), close);
    box.append(top, h('div', 'gm-note', L('은하 공동체가 없는 이 은하에서는 올림픽·월즈가 저절로 열리지 않습니다. 우리가 주최국이 되어 다른 나라를 초청합니다. 두 거대 세력이 한자리에 오면 긴장이 누그러지고, 한쪽만 오면 오히려 날이 섭니다.',
      'With no Galactic Community in this galaxy, the Olympics and Worlds never happen on their own. We host and send the invitations. If both great powers come, tension eases; if only one does, it sharpens.')));
    if (msg) box.append(h('div', 'gm-msg', msg));
    if (D.busy) box.append(h('div', 'gm-why', L(`준비 중: ${D.busy.year}년 ${D.busy.name} — 우주 경기장에서 개최 준비를 하세요.`, `In preparation: ${D.busy.year} ${D.busy.name} — prepare the venue in the Space Stadium.`)));
    const gt = h('table'); for (const g of D.guests || []) { const tr = h('tr'); tr.append(h('td', '', g.name), h('td', '', g.war ? L('우리와 전쟁 중', 'At war with us') : g.chance)); gt.append(tr); }
    box.append(h('div', '', L('초청할 나라(예상 반응)', 'Nations to invite (expected response)')), gt);
    const row = h('div', 'gm-row');
    for (const k of D.kinds || []) {
      const c = h('div', 'gm-card'); c.append(h('h4', '', k.name), h('div', '', L(`비용: ${k.cost}`, `Cost: ${k.cost}`)), h('div', '', L(`열리는 해: ${k.when}년`, `Held in: ${k.when}`)));
      if (k.last) c.append(h('div', 'gm-note', L(`지난번: ${k.last}년`, `Last held: ${k.last}`)));
      if (!k.can && k.why) c.append(h('div', 'gm-why', k.why));
      const b = h('button', '', L('초청장 보내기', 'Send invitations')); b.disabled = !k.can;
      b.onclick = async () => {
        b.disabled = true; let r = null; try { r = await window.sllm.scnGamesInvite(k.kind); } catch (e) { r = { ok: false, error: String(e) }; }
        if (!r || !r.ok) { msg = L('초청하지 못했습니다: ', 'Could not invite: ') + ((r && r.error) || ''); await load(); return; }
        const came = (r.came || []).join(', '), no = (r.refused || []).join(', ');
        msg = r.held ? L(`${k.name} 개최 확정 — 참가: ${came}${no ? ` · 불참: ${no}` : ''}`, `${k.name} confirmed — attending: ${came}${no ? ` · declined: ${no}` : ''}`)
          : L(`모든 나라가 초청을 거절했습니다(${no}). 비용은 들지 않았습니다.`, `Every nation declined (${no}). Nothing was spent.`);
        D = r; render();
      };
      c.append(b); row.append(c);
    }
    box.append(row);
    if ((D.log || []).length) {
      const lt = h('table'); for (const l of D.log) { const tr = h('tr'); tr.append(h('td', '', String(l.y)), h('td', '', l.name), h('td', '', L(`참가 ${l.came.join(', ') || '-'}`, `Came: ${l.came.join(', ') || '-'}`)), h('td', '', L(`불참 ${l.refused.join(', ') || '-'}`, `Declined: ${l.refused.join(', ') || '-'}`))); lt.append(tr); }
      box.append(h('div', '', L('지난 초청', 'Past invitations')), lt);
    }
  }
  async function load() { let r = null; try { r = await window.sllm.scnGames(); } catch (e) { r = null; } if (!r || !r.ok || !r.on) { $('gmWin')?.remove(); return; } D = r; render(); }
  async function openWin() {
    css(); $('gmWin')?.remove(); msg = '';
    const ov = h('div'); ov.id = 'gmWin'; ov.setAttribute('data-i18n-skip', ''); ov.append(h('div', 'gm-box')); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    document.body.append(ov); await load();
  }
  function attach() {
    const g = $('nbGrp'), row = g && g.querySelector('.row'); if (!row || $('gmCall')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'gmCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="20" r="6"/><circle cx="24" cy="20" r="6"/><circle cx="34" cy="20" r="6"/><circle cx="19" cy="27" r="6"/><circle cx="29" cy="27" r="6"/><path d="M12 40h24"/></svg>';
    b.append(h('span', '', L('화합 대회', 'Unity Games')));
    b.onclick = () => { void openWin(); };
    row.append(b);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.scnGames) return;
    const mo = new MutationObserver(() => attach()); const icons = $('icons'); if (icons) mo.observe(icons, { childList: true, subtree: false });
    setTimeout(attach, 900);
    document.addEventListener('sllm-language', () => { const s = document.querySelector('#gmCall span'); if (s) s.textContent = L('화합 대회', 'Unity Games'); if ($('gmWin')) render(); });
  });
})();
