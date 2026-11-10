// 집무실 「서재」 화면(세계관 팩, 2026-10-23 초안). 앱: src/features/lore-app.ts, 규칙: src/addon-packs.ts.
// 켜 둔 애드온의 세계관 책을 읽고, 캠페인마다 「AI 참고」를 켠다. 지금은 요약이 있는 「세계 전반」 책만 AI 가 참고하고, 다른 책은 열람만 한다.
// 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만. 책 본문·제목은 애드온 작성자의 글이라 번역하지 않는다(data-i18n-skip).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  let S = null, open = null, busy = false, err = '';
  const show = (id) => { for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const CAT = () => ({ world: L('세계 전반', 'World'), species: L('종족', 'Species'), empire: L('제국', 'Empire'), history: L('역사', 'History') });
  async function load() { try { S = await window.sllm.loreState(); } catch { S = null; } draw(); }
  const css = '#loreRoot{display:block;overflow-y:auto;padding:0 12px}.lore-main{display:grid;grid-template-columns:260px 1fr;gap:12px;padding:14px 4px}.lore-list{display:flex;flex-direction:column;gap:4px}'
    + '.lore-list button{text-align:left;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);padding:6px 9px;border-radius:4px;cursor:pointer}.lore-list button[aria-current=true]{border-color:var(--hi)}.lore-list small{display:block;color:var(--dim);font-size:11px}'
    + '.lore-cat{font-size:11px;color:var(--dim);margin:8px 0 2px;letter-spacing:.06em}.lore-book{font-family:Georgia,"Noto Serif KR",serif;line-height:1.75;font-size:14px;white-space:pre-wrap;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:6px;padding:14px 18px;max-height:62vh;overflow-y:auto}'
    + '.lore-d h4{margin:0 0 2px}.lore-sum{font-size:12.5px;color:var(--dim);margin:6px 0}.lore-ai{display:flex;gap:8px;align-items:center;font-size:12.5px;margin:6px 0 10px}.lore-err{color:#ffd2cb;font-size:12.5px}.lore-empty{color:var(--dim);font-size:13px;line-height:1.6}.lore-bud{font-size:11.5px;color:var(--dim)}';
  async function openBook(ref) { busy = true; err = ''; draw(); try { const r = await window.sllm.loreOpen(ref); if (r.state) S = r.state; if (r.ok) open = { ref, title: r.title, pack: r.pack, text: r.text }; else err = r.error || ''; } catch (e) { err = String(e); } busy = false; draw(); }
  function draw() {
    const root = $('loreRoot'); if (!root || !$('lore').classList.contains('on')) return; root.textContent = '';
    if (!document.getElementById('loreCss')) { const s = h('style'); s.id = 'loreCss'; s.textContent = css; document.head.append(s); }
    if (!S || !S.books.length) { root.append(h('p', 'lore-empty', L('서재가 비어 있습니다. 세계관 책이 든 애드온을 설정 → 애드온에서 켜면 이곳에 꽂힙니다. 애드온 addon.json 의 "lore" 항목에 책(.md/.txt)과 요약을 넣을 수 있습니다.', 'The library is empty. Turn on an add-on with lore books in Settings → Add-ons and they will appear here. Add books (.md/.txt) and summaries under "lore" in an add-on\'s addon.json.'))); return; }
    const main = h('div', 'lore-main'), list = h('div', 'lore-list'); main.append(list); root.append(main);
    const cats = CAT();
    for (const c of Object.keys(cats)) {
      const books = S.books.filter((b) => b.category === c); if (!books.length) continue;
      list.append(h('div', 'lore-cat', cats[c]));
      for (const b of books) { const x = h('button'); x.type = 'button'; x.setAttribute('aria-current', String(!!open && open.ref === b.ref)); x.append(skip(h('b', '', b.title)), skip(h('small', '', b.pack)), h('small', '', [b.read ? L('읽음', 'Read') : '', b.ai && b.aiAllowed ? L('AI 참고 중', 'AI reference on') : ''].filter(Boolean).join(' · '))); x.onclick = () => openBook(b.ref); list.append(x); }
    }
    const d = h('div', 'lore-d'); main.append(d);
    if (S.sid) d.append(h('p', 'lore-bud', L(`AI 참고 중인 요약: ${S.aiChars}자 / ${S.budget}자 (넘치는 요약은 빠집니다). 게임에서 관측한 사실이 언제나 우선합니다.`, `Summaries in AI reference: ${S.aiChars} / ${S.budget} characters (extra summaries are left out). Observed game facts always take priority.`)));
    else d.append(h('p', 'lore-bud', L('세이브를 불러오면 이 캠페인에서 AI 가 참고할 책을 고를 수 있습니다.', 'Load a save to choose which books the AI references in this campaign.')));
    if (err) d.append(h('p', 'lore-err', err));
    const b = open && S.books.find((x) => x.ref === open.ref);
    if (!b) { d.append(h('p', 'lore-empty', L('왼쪽에서 책을 고르세요.', 'Pick a book on the left.'))); return; }
    d.append(skip(h('h4', '', b.title)), skip(h('small', '', b.pack)), h('small', '', ' · ' + (cats[b.category] || b.category)));
    if (b.summary) d.append(skip(h('p', 'lore-sum', b.summary)));
    const ai = h('label', 'lore-ai'), cb = h('input'); cb.type = 'checkbox'; cb.checked = b.ai; cb.disabled = busy || !S.sid || (!b.aiAllowed && !b.ai);
    cb.onchange = async () => { busy = true; err = ''; try { const r = await window.sllm.loreSetAi(b.ref, cb.checked); if (r.state) S = r.state; if (!r.ok) err = r.error || ''; } catch (e) { err = String(e); } busy = false; draw(); };
    ai.append(cb, h('span', '', b.aiAllowed ? L('이 캠페인에서 AI 가 이 책의 요약을 참고하게 하기', 'Let the AI reference this book\'s summary in this campaign') : L('AI 참고는 요약이 있는 「세계 전반」 책만 됩니다. 이 책은 읽기만 할 수 있습니다.', 'Only "World" books with a summary can be referenced by the AI. This book is read-only.')));
    d.append(ai, skip(h('div', 'lore-book', open.text)));
  }
  function build() {
    const after = $('fbCall') || $('retCall') || $('gcCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('lore')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'loreCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h10v30H8z"/><path d="M18 12h9v28h-9z"/><path d="M29 13l8-2 5 27-8 2z"/><path d="M8 16h10M18 18h9"/></svg>';
    b.append(h('span', '', L('서재', 'Library')));
    b.onclick = () => { show('lore'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'lore'; sec.setAttribute('aria-label', L('서재', 'Library'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('서재', 'Library'))); const body = h('div', 'appb'); body.id = 'loreRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { build(); }, 140); // 초대장 아이콘(120ms) 뒤
    if (window.sllm.onLoreUpdate) window.sllm.onLoreUpdate((v) => { S = v; if (open && !v.books.some((x) => x.ref === open.ref)) open = null; if (!busy) draw(); });
    document.addEventListener('sllm-language', () => { const b = $('loreCall'); if (b) b.querySelector('span').textContent = L('서재', 'Library'); draw(); });
  });
})();
