// 집무실 「초대장」(2026-10-23 초안): 다른 제국 통치자가 보낸 사적인 만찬 초대. 앱: src/features/fbanquet-app.ts, 규칙: src/foreign-banquet.ts.
// 초대장은 정형 서신(AI 없음). 수락 → 3개월 뒤 방문일, 거절·1개월 무응답 → 그 제국 1년 재초대 없음. 방문일에 「만찬장 들어가기」.
// 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만. 제국·인물 이름과 초대장 본문은 data-i18n-skip.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  const ST = { offered: ['답을 기다림', 'Awaiting reply'], scheduled: ['방문 예정', 'Visit scheduled'], arrived: ['오늘 만찬', 'Dinner today'], completed: ['다녀옴', 'Attended'], declined: ['사양함', 'Declined'], expired: ['기한 지남', 'Lapsed'], cancelled: ['취소', 'Cancelled'] };
  const HO = { grand: ['성대한 환영', 'Grand welcome'], plain: ['평범한 접대', 'Ordinary hospitality'], humiliating: ['냉대', 'Cold reception'] };
  let S = null, F = null, busy = false, err = '', open = '', drafts = {};
  const show = (id) => { for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  function badge() { const n = $('nFb'); if (!n) return; const c = (S && S.items || []).filter((i) => i.state === 'offered' || i.state === 'arrived').length; n.textContent = String(c); n.classList.toggle('show', c > 0); }
  async function load() { try { S = await window.sllm.fbInvites(); } catch (e) { S = null; } try { F = window.sllm.flState ? await window.sllm.flState() : null; } catch (e) { F = null; } badge(); draw(); }
  async function run(fn, letters) { if (busy) return; busy = true; err = ''; draw(); try { const r = await fn(); if (r && r.state) { if (letters) F = r.state; else S = r.state; } if (r && !r.ok) err = r.error || ''; return r; } catch (e) { err = String(e); } finally { busy = false; badge(); draw(); } }
  const css = '#fbRoot{display:block;overflow-y:auto;padding:0 12px}.fb-main{display:flex;flex-direction:column;gap:10px;padding:14px 4px}.fb-card{border:1px solid var(--line);border-radius:8px;padding:10px 14px;background:rgba(255,255,255,.03);border-left:3px solid #e8c872}'
    + '.fb-card.done{opacity:.7;border-left-color:var(--line)}.fb-hd{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.fb-hd b{color:var(--hi)}.fb-tag{border:1px solid var(--line);border-radius:10px;padding:0 8px;font-size:11.5px}.fb-letter{white-space:pre-wrap;font-family:Georgia,"Noto Serif KR",serif;font-size:13px;line-height:1.6;margin:8px 0;padding:8px 10px;background:rgba(0,0,0,.2);border-radius:4px}'
    + '.fb-letter.reply{border-left:3px solid #e8c872}.fl textarea,.fl select{box-sizing:border-box;background:rgba(0,0,0,.25);color:var(--text);border:1px solid var(--line);border-radius:4px;padding:6px 8px;font:inherit}'
    + '.fb-row{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.fb-btn{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 14%,transparent);color:var(--text);border-radius:4px;padding:5px 12px;cursor:pointer}.fb-btn.soft{border-color:var(--line);background:transparent}.fb-btn:disabled{opacity:.45}.fb-note{color:var(--dim);font-size:12.5px;line-height:1.6}.fb-err{color:#ffd2cb}';
  function draw() {
    const root = $('fbRoot'); if (!root || !$('fbanquet').classList.contains('on')) return; root.textContent = '';
    if (!document.getElementById('fbCss')) { const s = h('style'); s.id = 'fbCss'; s.textContent = css; document.head.append(s); }
    const wrap = h('div', 'fb-main'); root.append(wrap);
    if (!S || !S.sid) { wrap.append(h('p', 'fb-note', L('세이브를 불러오면 다른 제국의 초대장이 이곳에 옵니다.', 'Load a save and invitations from other empires will arrive here.'))); return; }
    if (err) wrap.append(h('p', 'fb-err', err));
    if (!S.items.length) wrap.append(h('p', 'fb-note', L('아직 받은 초대장이 없습니다. 관계가 좋은 제국일수록 사적인 만찬에 초대할 가능성이 큽니다(관계가 나쁘면 초대하지 않습니다).', 'No invitations yet. The better your relations with an empire, the likelier its ruler invites you to a private dinner (none while relations are bad).')));
    for (const i of S.items) {
      const c = h('article', 'fb-card' + (['completed', 'declined', 'expired', 'cancelled'].includes(i.state) ? ' done' : ''));
      const hd = h('div', 'fb-hd'); hd.append(skip(h('b', '', i.empire)), skip(h('span', '', i.host)), h('span', 'fb-tag', L(...(ST[i.state] || [i.state, i.state]))), h('span', 'fb-note', i.visitOn ? L(`방문 ${i.visitOn}`, `Visit ${i.visitOn}`) : L(`받은 날 ${i.sentOn}`, `Received ${i.sentOn}`)));
      if (i.hospitality) hd.append(h('span', 'fb-tag', L(...HO[i.hospitality])));
      c.append(hd);
      if (i.state === 'offered') {
        c.append(skip(h('div', 'fb-letter', i.letter)));
        const r = h('div', 'fb-row'), y = h('button', 'fb-btn', L('참석하겠습니다', 'I will attend')), n = h('button', 'fb-btn soft', L('정중히 사양', 'Politely decline'));
        y.type = n.type = 'button'; y.disabled = n.disabled = busy; y.onclick = () => run(() => window.sllm.fbReply(i.id, true)); n.onclick = () => run(() => window.sllm.fbReply(i.id, false));
        r.append(n, y); c.append(r, h('p', 'fb-note', L('사양하거나 기한까지 답하지 않으면 그 제국은 1년 동안 다시 초대하지 않습니다.', 'If you decline or do not answer in time, that empire will not invite you again for a year.')));
      } else if (i.state === 'arrived') {
        if (i.needsReconfirm) c.append(h('p', 'fb-note', L('전임 통치자가 받은 초대라 취소되었습니다. 주최국은 새 통치자를 다시 초대할 수 있습니다.', 'Cancelled: the former ruler accepted this invitation. Its host may invite the new ruler again.')));
        else { const r = h('div', 'fb-row'), e = h('button', 'fb-btn', L('🍷 만찬장 들어가기', '🍷 Enter the banquet hall')); e.type = 'button'; e.disabled = busy; e.onclick = () => run(() => window.sllm.fbEnter(i.id)); r.append(e); c.append(r); }
      }
      wrap.append(c);
    }
    if (F && F.contacts && F.contacts.length) { // 타국 지인 개인 서신(45, fletters-app): 안부·지난 만남·개인 의견·다음 만남. 답장은 다음 게임 달에 온다
      wrap.append(h('h5', 'fb-note', L('타국 지인 — 만찬에서 연락처를 바꾼 사람들', 'Foreign acquaintances — people you exchanged contacts with at dinners')));
      for (const k of F.contacts) {
        const c = h('article', 'fb-card fl'); const hd = h('div', 'fb-hd'); hd.append(skip(h('b', '', k.name)), skip(h('span', '', k.empire)), h('span', 'fb-note', L(`${k.metOn} 만남`, `met ${k.metOn}`))); if (k.gone) hd.append(h('span', 'fb-note', L('· 소식 끊김', '· out of touch')));
        const tg = h('button', 'fb-btn soft', open === k.pid ? L('접기', 'Collapse') : L(`편지 ${k.letters.length}통`, `${k.letters.length} letter(s)`)); tg.type = 'button'; tg.onclick = () => { open = open === k.pid ? '' : k.pid; draw(); }; hd.append(tg); c.append(hd);
        if (open === k.pid) {
          for (const l of k.letters) {
            const m = skip(h('div', 'fb-letter', l.text)); m.prepend(h('small', 'fb-note', `${l.on}${l.topic ? ' · ' + l.topic : ''} — ${L('보낸 편지', 'Your letter')}\n`)); c.append(m);
            if (l.reply) { const rp = skip(h('div', 'fb-letter reply', l.reply.text)); rp.prepend(h('small', 'fb-note', `${l.reply.on} — ${k.name}\n`)); c.append(rp); if (l.reply.notes.length) c.append(h('p', 'fb-note', '※ ' + l.reply.notes.join(' · '))); }
          }
          if (!k.canWrite) c.append(h('p', 'fb-note', k.why));
          else if (k.pending) c.append(h('p', 'fb-note', L('답장을 기다리는 중입니다(다음 달에 옵니다).', 'Waiting for a reply (it arrives next month).')));
          else {
            const sel = h('select'); for (const t of F.topics) sel.append(new Option(t.name, t.id)); const d = drafts[k.pid] || { topic: 'greetings', text: '' }; sel.value = d.topic; sel.onchange = () => { drafts[k.pid] = { ...d, topic: sel.value }; };
            const ta = h('textarea'); ta.rows = 4; ta.style.width = '100%'; ta.placeholder = L('편지를 적어 주세요. 개인적인 편지입니다 — 조약이나 자원은 공식 외교로 다룹니다.', 'Write your letter. It is personal — treaties and resources go through official diplomacy.'); ta.value = d.text; ta.oninput = () => { drafts[k.pid] = { topic: sel.value, text: ta.value }; };
            const sb = h('button', 'fb-btn', L('보내기', 'Send')); sb.type = 'button'; sb.disabled = busy; sb.onclick = async () => { const r = await run(() => window.sllm.flSend(k.pid, sel.value, ta.value), true); if (r && r.ok) delete drafts[k.pid]; draw(); };
            const row = h('div', 'fb-row'); row.append(sel, sb); c.append(ta, row);
          }
        }
        wrap.append(c);
      }
    }
  }
  function build() {
    const after = $('retCall') || $('gcCall') || $('socCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('fbanquet')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'fbCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="12" width="32" height="24" rx="2"/><path d="M8 14l16 12 16-12"/><path d="M30 34l4-4 4 4"/></svg>';
    b.append(h('span', '', L('초대장', 'Invitations')), Object.assign(h('b', 'n'), { id: 'nFb' }));
    b.onclick = () => { show('fbanquet'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'fbanquet'; sec.setAttribute('aria-label', L('초대장', 'Invitations'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('초대장', 'Invitations'))); const body = h('div', 'appb'); body.id = 'fbRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { build(); load(); }, 120); // 은퇴 인물 아이콘(100ms) 뒤
    if (window.sllm.onFbInvites) window.sllm.onFbInvites((v) => { S = v; badge(); if (!busy) draw(); });
    if (window.sllm.onFlUpdate) window.sllm.onFlUpdate((v) => { F = v; if (!busy) draw(); });
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'fbanquet') { build(); show('fbanquet'); load(); } });
    document.addEventListener('sllm-language', () => { const b = $('fbCall'); if (b) b.querySelector('span').textContent = L('초대장', 'Invitations'); draw(); });
  });
})();
