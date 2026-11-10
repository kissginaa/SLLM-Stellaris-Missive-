// 집무실 「은퇴 인물」 화면(2026-10-23 초안). 앱: src/features/retired-app.ts, 규칙: src/retired.ts.
// 은퇴한 인물은 앱이 생활·나이·연락을 맡는다(게임 생존 추적과 무관). 전임 통치자는 기본으로 연락 유지, 일반 지도자는 인물 카드에서 「은퇴 뒤에도 연락 유지」를 켜 둔 사람만.
// 함께 사는 배우자가 대신 받거나 같이 나올 수 있다. 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  let S = null, pick = '', busy = false, err = '', draft = '';
  const show = (id) => { for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  async function load() { try { S = await window.sllm.retiredState(); } catch (e) { S = null; } draw(); }
  const css = '#retRoot{display:block;overflow-y:auto;padding:0 12px}.ret-main{display:grid;grid-template-columns:240px 1fr;gap:12px;padding:14px 4px}.ret-list{display:flex;flex-direction:column;gap:4px}'
    + '.ret-list button{text-align:left;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);padding:6px 9px;border-radius:4px;cursor:pointer}.ret-list button[aria-current=true]{border-color:var(--hi)}.ret-list small,.ret-d small{display:block;color:var(--dim);font-size:11px}'
    + '.ret-hh{margin:4px 0 0;font-size:11.5px;color:var(--dim)}.ret-d h4{margin:0 0 2px}.ret-d dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12.5px;margin:8px 0}.ret-d dt{color:var(--dim)}'
    + '.ret-log{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line);padding-top:8px;margin-top:8px}.ret-msg{padding:6px 10px;border-radius:6px;max-width:90%;font-size:13px;line-height:1.55;white-space:pre-wrap}.ret-msg.ruler{align-self:flex-end;background:color-mix(in srgb,var(--hi) 12%,transparent)}.ret-msg.self,.ret-msg.partner{align-self:flex-start;background:rgba(255,255,255,.05);font-family:Georgia,"Noto Serif KR",serif}.ret-msg.partner{border-left:3px solid #e8a8c8}.ret-msg small{display:block;color:var(--dim);font-size:11px;font-family:inherit}'
    + '.ret-in{display:flex;gap:6px;margin-top:6px}.ret-in input{flex:1;background:rgba(0,0,0,.25);color:var(--text);border:1px solid var(--line);border-radius:4px;padding:6px 8px;font:inherit}.ret-btn{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 14%,transparent);color:var(--text);border-radius:4px;padding:5px 12px;cursor:pointer}.ret-btn:disabled{opacity:.45;cursor:default}.ret-err{color:#ffd2cb;font-size:12.5px}.ret-empty{color:var(--dim);font-size:13px;line-height:1.6}';
  function draw() {
    const root = $('retRoot'); if (!root || !$('retired').classList.contains('on')) return; root.textContent = '';
    if (!document.getElementById('retCss')) { const s = h('style'); s.id = 'retCss'; s.textContent = css; document.head.append(s); }
    if (!S || !S.sid) { root.append(h('p', 'ret-empty', L('세이브를 불러오면 은퇴한 인물이 이곳에 모입니다.', 'Load a save and retired figures will gather here.'))); return; }
    if (!S.items.length) { root.append(h('p', 'ret-empty', L('아직 은퇴한 인물이 없습니다. 통치자가 임기를 마치거나 지도자가 해임되면 이곳에서 계속 연락할 수 있습니다. 일반 지도자는 집무실 연락처의 인물 카드에서 「은퇴 뒤에도 연락 유지」를 켜 두세요.', 'No one has retired yet. When a ruler ends their term or a leader is dismissed, you can stay in touch here. For ordinary leaders, turn on "Keep in touch after retirement" on their contact card.'))); return; }
    const main = h('div', 'ret-main'), list = h('div', 'ret-list'); main.append(list); root.append(main);
    if (!S.items.some((x) => x.pid === pick)) pick = S.items[0].pid;
    for (const it of S.items) { const b = h('button'); b.type = 'button'; b.setAttribute('aria-current', String(it.pid === pick)); b.append(skip(h('b', '', it.name)), h('small', '', `${it.role} · ${it.listing}`)); b.onclick = () => { pick = it.pid; err = ''; draw(); }; list.append(b); }
    const it = S.items.find((x) => x.pid === pick), d = h('div', 'ret-d'); main.append(d);
    d.append(skip(h('h4', '', it.name)), h('small', '', `${it.role} · ${it.listing}`));
    const dl = h('dl'), row = (k, v, raw) => { if (v === null || v === undefined || v === '') return; const dd = h('dd', '', String(v)); if (raw) skip(dd); dl.append(h('dt', '', k), dd); };
    row(L('떠난 날', 'Left office'), it.retiredOn, true); row(L('사유', 'Reason'), it.reason);
    row(L('지금 나이', 'Age now'), it.age === null ? L('미확인', 'Unknown') : L(`약 ${it.age}세 (앱이 셈)`, `about ${it.age} (counted by the app)`));
    if (it.immortal) row(L('수명', 'Lifespan'), L('불멸', 'Immortal'));
    if (it.traits.length) row(L('특성', 'Traits'), it.traits.join(' · '), true);
    d.append(dl);
    if (it.household) d.append(skip(h('p', 'ret-hh', L(`배우자 ${it.household.partnerName}와(과) 함께 지냅니다.`, `Lives with their spouse ${it.household.partnerName}.`))));
    if (it.reasonCode === 'death') { d.append(h('p', 'ret-empty', L('추모관에서 기억할 수 있습니다.', 'Remembered in the memorial hall.'))); return; }
    if (it.eligibility !== 'eligible') { d.append(h('p', 'ret-empty', L('떠난 사유를 확인하지 못해 아직 연락할 수 없습니다(사망·실종일 수도 있어 추정하지 않습니다).', 'The reason they left is unconfirmed, so they cannot be contacted yet (it could be death or disappearance; the app does not guess).'))); return; }
    if (!it.keep) { const b = h('button', 'ret-btn', L('연락처에 넣기', 'Add to contacts')); b.type = 'button'; b.onclick = async () => { const r = await window.sllm.retiredKeep(it.pid, true); if (r && r.state) S = r.state; draw(); }; d.append(b); return; }
    const log = h('div', 'ret-log'); d.append(log);
    if (!it.talk.length) log.append(h('p', 'ret-empty', L('통신을 걸면 본인이나, 함께 사는 배우자가 먼저 받을 수 있습니다.', 'When you call, they — or a spouse who lives with them — may answer first.')));
    for (const m of it.talk) { const e = skip(h('div', 'ret-msg ' + m.who, m.text)); e.prepend(h('small', '', m.who === 'ruler' ? L('나', 'Me') : m.name + (m.who === 'partner' ? L(' (배우자)', ' (spouse)') : ''))); log.append(e); }
    if (err) d.append(h('p', 'ret-err', err));
    const inr = h('div', 'ret-in'), q = h('input'); q.placeholder = it.talk.length ? L('할 말…', 'Say something…') : L('안부 인사(비워 두면 그냥 통신을 겁니다)', 'Greeting (leave empty to just call)'); q.value = draft; q.oninput = () => { draft = q.value; };
    const go = h('button', 'ret-btn', busy ? L('기다리는 중…', 'Waiting…') : it.talk.length ? L('말하기', 'Say') : L('통신 걸기', 'Call')); go.type = 'button'; go.disabled = busy;
    const send = async () => { if (busy || (it.talk.length && !q.value.trim())) return; busy = true; err = ''; draw(); try { const r = await window.sllm.retiredTalk(it.pid, draft); if (r.state) S = r.state; if (!r.ok) err = r.error || ''; else draft = ''; } catch (e) { err = String(e); } busy = false; draw(); };
    go.onclick = send; q.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) send(); };
    inr.append(q, go); d.append(inr);
  }
  function build() {
    const after = $('gcCall') || $('socCall') || $('iscCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('retired')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'retCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 40V22l14-10 14 10v18z"/><path d="M20 40V30h8v10"/><path d="M34 8c-3 0-5 2-5 5"/><circle cx="36" cy="12" r="0.5"/></svg>';
    b.append(h('span', '', L('은퇴 인물', 'Retired')));
    b.onclick = () => { show('retired'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'retired'; sec.setAttribute('aria-label', L('은퇴 인물', 'Retired'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('은퇴 인물', 'Retired figures'))); const body = h('div', 'appb'); body.id = 'retRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { build(); }, 100); // 총독회의 아이콘(80ms) 뒤
    if (window.sllm.onRetiredUpdate) window.sllm.onRetiredUpdate((v) => { S = v; if (!busy) draw(); });
    document.addEventListener('sllm-language', () => { const b = $('retCall'); if (b) b.querySelector('span').textContent = L('은퇴 인물', 'Retired'); draw(); });
  });
  window.SLLMRetired = { load };
})();
