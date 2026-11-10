// 집무실 「로비」(2026-11-03 ⑦): 이익단체의 공식 지원·뒷돈. 앱: src/features/lobby-app.ts, 규칙: src/lobby.ts.
// 아이콘은 「의회」 옆(없으면 「여론조사」·정책 옆). 단일 의식 제국에서는 숨긴다. 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn, dis) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; return b; };
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const TITLE = () => L('로비', 'Lobbying');
  const SVG = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="16" width="32" height="22" rx="3"/><path d="M18 16v-4a2 2 0 012-2h8a2 2 0 012 2v4"/><path d="M8 26h32"/><circle cx="24" cy="26" r="3"/></svg>';
  let S = null, msg = '', err = '', busy = '';

  function build() {
    const holo = $('policy') && $('policy').parentElement; if (!holo || $('lobbyCall')) return;
    const anchor = $('auditCall') || $('pollCall') || document.querySelector('[data-app="policy"]'); if (!anchor) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'lobbyCall'; b.innerHTML = SVG; b.append(h('span', '', TITLE()), h('b', 'n', ''));
    b.onclick = () => { msg = ''; err = ''; show('lobbyView'); load(); };
    anchor.after(b);
    const sec = h('section', 'view app'); sec.id = 'lobbyView'; sec.setAttribute('aria-label', TITLE());
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', TITLE())); const body = h('div', 'appb'); body.id = 'lobbyRoot'; sec.append(hd, body); holo.append(sec);
  }
  function badge() {
    const b = $('lobbyCall'); if (!b) return;
    b.style.display = S && S.regime === 'none' ? 'none' : '';
    const n = b.querySelector('.n'); if (n) n.textContent = S && S.offer ? '!' : '';
  }
  async function answer(a) {
    if (busy) return; busy = a; msg = ''; err = ''; draw();
    try { const r = await window.sllm.lobbyAnswer(a); if (r && r.state) S = r.state; if (r && r.ok) msg = r.text || ''; else err = (r && r.error) || L('처리하지 못했습니다.', 'Something went wrong.'); }
    catch (e) { err = String(e && e.message || e); }
    busy = ''; draw();
  }
  function draw() {
    badge();
    const r = $('lobbyRoot'); if (!r) return; r.textContent = '';
    const w = h('div', 'lb-main'); r.append(w);
    if (!S || !S.sid) { w.append(h('p', 'lb-empty', L('세이브를 불러오면 표시됩니다.', 'Shown once a save is loaded.'))); return; }
    w.append(h('p', 'lb-note', L('가끔 이익단체가 통치자를 찾아옵니다. 공식 후원은 국고로 들어오고 기록이 공개됩니다. 뒷돈은 개인 금고로 들어오지만 언젠가 드러날 수 있습니다. 어느 쪽이든 그 단체와 가까운 파벌은 정부를 더 지지하고, 반대 성향 파벌은 반감을 품습니다.', 'Now and then an interest group comes to the ruler. Official donations go to the treasury and are on public record. Bribes go to your private vault, but may come out one day. Either way, the faction close to the group backs the government more and the opposite faction resents it.')));
    if (msg) w.append(h('div', 'lb-ok', msg)); if (err) w.append(h('div', 'lb-err', err));
    const o = S.offer;
    if (o) {
      const card = h('div', 'lb-card ' + o.kind);
      const hd = h('div', 'lb-ch'); hd.append(h('b', '', o.group), h('span', 'lb-tag ' + o.kind, o.kind === 'official' ? L('공식 지원', 'Official support') : L('뒷돈', 'Bribe')), h('span', 'lb-date', o.date)); card.append(hd);
      card.append(h('p', 'lb-text', o.text));
      const row = h('div', 'lb-row');
      row.append(btn('lb-btn', busy === 'accept' ? L('처리 중…', 'Working…') : o.kind === 'official' ? L(`후원 받기 (에너지 ${o.amount})`, `Accept (${o.amount} energy)`) : L(`몰래 받기 (금고 +${o.amount})`, `Take it quietly (vault +${o.amount})`), () => answer('accept'), !!busy || !S.running));
      row.append(btn('lb-btn ghost', L('돌려보내기', 'Send them away'), () => answer('decline'), !!busy));
      if (o.kind === 'bribe') row.append(btn('lb-btn good', L('공개 고발 (민심 +2)', 'Expose it (+2 approval)'), () => answer('report'), !!busy));
      card.append(row);
      card.append(h('p', 'lb-note', L('석 달 안에 답하지 않으면 그냥 돌아갑니다.', 'If you do not answer within three months, they leave.')));
      w.append(card);
    } else w.append(h('p', 'lb-empty', L('지금 찾아온 이익단체는 없습니다.', 'No interest group is waiting right now.')));
    if (S.recs && S.recs.length) {
      w.append(h('p', 'lb-hh', L('지난 일', 'Past dealings')));
      const ol = h('ol', 'lb-hist');
      for (const x of S.recs) {
        const ans = { accepted: x.kind === 'official' ? L('후원 받음', 'Accepted') : L('몰래 받음', 'Took it'), declined: L('돌려보냄', 'Sent away'), reported: L('공개 고발', 'Exposed'), expired: L('답하지 않음', 'No answer') }[x.answer] || x.answer;
        const li = h('li'); li.append(h('span', '', x.answered || x.date), h('b', '', `${x.group} · ${x.kind === 'official' ? L('공식 지원', 'Official support') : L('뒷돈', 'Bribe')} ${x.amount} · ${ans}${x.exposed ? L(' · 발각됨', ' · exposed') : ''}`)); ol.append(li);
      }
      w.append(ol);
    }
  }
  async function load() { try { S = await window.sllm.lobbyState(); } catch (e) { S = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.lobbyState) return;
    setTimeout(() => { build(); load(); }, 560); // 「의회」 아이콘(office-audit.js, 520ms) 뒤
    if (window.sllm.onLobbyUpdate) window.sllm.onLobbyUpdate((v) => { S = v; draw(); });
    document.addEventListener('sllm-language', () => {
      const b = $('lobbyCall'); if (b) b.querySelector('span').textContent = TITLE();
      const t = $('lobbyView') && $('lobbyView').querySelector('h3'); if (t) t.textContent = TITLE();
      const bk = $('lobbyView') && $('lobbyView').querySelector('.back'); if (bk) bk.textContent = '‹ ' + L('바탕화면', 'Desktop');
      load();
    });
  });
  window.SLLMLobby = { load };
})();
