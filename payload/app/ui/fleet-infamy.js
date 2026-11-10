// 악명·전쟁범죄(2026-11-04 사용자) — 함대 사령부 창(fleet.html) 왼쪽 「악명 · 전쟁범죄」 칸 + 오른쪽 칸 위에 겹쳐 띄우는 기록판.
// 앱: src/features/infamy-app.ts · 규칙: src/infamy.ts. 본문(fleet.html)이 #side 를 다시 그려도 칸을 다시 붙인다(MutationObserver).
// 포로 심문실(fleet-captive.js)과 한 번에 하나만 열린다('sllm-fleet-overlay' 사건). 문구는 L(한, 영)만 — 언어 팩 호환.
// 3단계(2026-11-04): 숨은 악명·은폐 공작 · 전범 명단 · 전범 인도 요구(LLM 서신)에 답하기 · 폭로 기사.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  if (!window.sllm || !window.sllm.infamyState) return;
  const TC = ['var(--dim)', 'var(--gold,#e8c872)', '#e8a05a', 'var(--bad,#e88)'];
  const css = () => { if (document.getElementById('infCss')) return; const st = h('style'); st.id = 'infCss'; st.textContent =
    '#infSec .meter,#infRoom .meter{height:5px;border-radius:3px;background:color-mix(in srgb,var(--bg,#06141b) 70%,transparent);border:1px solid var(--line2);margin-top:6px;overflow:hidden;position:relative}#infSec .meter i,#infRoom .meter i{display:block;height:100%}'
    + '#infSec .meter u,#infRoom .meter u{position:absolute;top:0;bottom:0;width:1px;background:var(--line)}'
    + '#infRoom{grid-column:2;grid-row:1;z-index:5;display:flex;flex-direction:column;min-height:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg,#06141b)}'
    + '#infRoom .hd{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--line2)}#infRoom .hd b{font-size:15px}#infRoom .hd small{color:var(--dim)}#infRoom .hd .sp{flex:1}'
    + '#infRoom .bd{flex:1;min-height:0;overflow-y:auto;padding:12px 16px}#infRoom .big{font-size:26px;letter-spacing:.04em}#infRoom .card{margin-bottom:12px}'
    + '#infRoom .row{border-left:2px solid var(--line);padding:3px 0 3px 10px;margin:0 0 6px;font-size:12.5px}#infRoom .row small{color:var(--dim);display:block}#infRoom .row.k3,#infRoom .row.k5{border-color:var(--bad)}#infRoom .row.k2{border-color:#e8a05a}'
    + '#infRoom .rk{display:flex;gap:8px;font-size:12.5px;padding:2px 0}#infRoom .rk b{flex:1;font-weight:500}#infRoom .msg{color:var(--bad);font-size:12px;min-height:1em}#infRoom .rules{font-size:11.5px;color:var(--dim);line-height:1.6}'
    + '#infRoom .tag{display:inline-block;margin-left:6px;font-size:10.5px;padding:0 6px;border-radius:8px;border:1px solid var(--line);color:var(--dim)}#infRoom .tag.cov{border-color:var(--gold);color:var(--gold)}#infRoom .tag.exp{border-color:var(--bad);color:var(--bad)}'
    + '#infRoom .dem{border:1px solid var(--bad,#e88);border-radius:6px;padding:10px 12px;margin:0 0 12px;background:color-mix(in srgb,var(--bad,#e88) 6%,transparent)}#infRoom .dem.done{border-color:var(--line);background:none}#infRoom .dem .lt{white-space:pre-wrap;font-style:italic;margin:6px 0 8px;line-height:1.55}#infRoom .acts{display:flex;flex-wrap:wrap;gap:6px}#infRoom .acts .btn{padding:5px 11px;font-size:12px}'
    + '#infRoom .hid{border:1px dashed var(--gold,#e8c872);border-radius:6px;padding:8px 10px;margin:0 0 12px;font-size:12.5px}#infRoom .art{border-left:3px solid var(--gold);padding:4px 10px;margin:0 0 8px}#infRoom .art b{display:block}#infRoom .ok{color:var(--good)}#infSec .dot{color:var(--bad,#e88);margin-left:6px}';
    document.head.append(st); };
  let S = null, open = false, msg = '', msgOk = false, busy = false, confirmCover = false;
  const meter = (v) => { const m = h('div', 'meter'), i = h('i'); i.style.width = Math.max(0, Math.min(100, v)) + '%'; i.style.background = v >= 25 ? TC[v >= 75 ? 3 : v >= 50 ? 2 : 1] : 'var(--hi,#5fd4e4)'; m.append(i); for (const t of [25, 50, 75]) { const u = h('u'); u.style.left = t + '%'; m.append(u); } return m; };

  function side() {
    const sd = document.getElementById('side'); if (!sd || !S || !S.sid) return;
    const old = document.getElementById('infSec'); if (old) old.remove();
    css();
    const b = h('button', 'adm' + (open ? ' on' : '')); b.id = 'infSec'; b.type = 'button'; b.setAttribute('data-i18n-skip', '');
    const t = h('b', '', L('악명 · 전쟁범죄', 'Infamy · war crimes')); t.style.color = S.tier ? TC[S.tier] : '';
    const pend = (S.demands || []).filter((d) => d.state === 'pending').length; if (pend) t.append(h('span', 'dot', L(`● 인도 요구 ${pend}`, `● ${pend} demand(s)`)));
    b.append(t, h('small', '', L(`악명 ${Math.round(S.inf)}/100 · ${S.tierName}${S.mine.length ? ` · 기록 ${S.mine.length}건` : ''}`, `Infamy ${Math.round(S.inf)}/100 · ${S.tierName}${S.mine.length ? ` · ${S.mine.length} crimes` : ''}`)), meter(S.inf));
    b.onclick = () => { open = !open; msg = ''; if (open) window.dispatchEvent(new CustomEvent('sllm-fleet-overlay', { detail: 'infamy' })); side(); room(); };
    // 포로 칸 아래(없으면 자동 작전 버튼 아래)
    const cap = document.getElementById('capSec'), first = sd.firstElementChild;
    if (cap) cap.after(b); else if (first && first.nextSibling) sd.insertBefore(b, first.nextSibling); else sd.prepend(b);
  }

  function list(box, title, rows, empty) {
    box.append(h('p', 'th', title));
    if (!rows.length) { const p = h('small', '', empty); p.style.color = 'var(--dim)'; box.append(p); return; }
    for (const r of rows) { const d = h('div', 'row k' + r.k); const sp = h('span', '', r.text); if (r.covered) sp.append(h('span', 'tag cov', L('은폐됨', 'covered up'))); else if (r.exposed) sp.append(h('span', 'tag exp', L('폭로됨', 'exposed'))); d.append(sp, h('small', '', r.count > 1 && r.first !== r.date ? `${r.first} ~ ${r.date}` : r.date)); box.append(d); }
  }
  async function act(fn) {
    if (busy) return; busy = true; msg = L('처리 중…', 'Working…'); msgOk = true; room();
    let res; try { res = await fn(); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; }
    busy = false; if (res.state) S = res.state; msgOk = !!res.ok; msg = res.ok ? (res.text || L('반영했습니다.', 'Done.')) : (res.error || L('실패했습니다.', 'Failed.')); side(); room();
  }
  function demandBox(bd) {
    const ds = S.demands || []; if (!ds.length) return;
    bd.append(h('p', 'th', L('전범 인도 요구', 'WAR CRIMINAL DEMANDS')));
    for (const d of ds.slice(0, 4)) {
      const box = h('div', 'dem' + (d.state === 'pending' ? '' : ' done'));
      box.append(h('b', '', L(`${d.them} — ${d.why === 'war' ? '전쟁에서 이긴 뒤' : '범죄가 폭로된 뒤'} (${d.date})`, `${d.them} — ${d.why === 'war' ? 'after winning the war' : 'after our crimes came out'} (${d.date})`)), h('div', 'lt', d.letter));
      if (d.state === 'pending') {
        const row = h('div', 'acts'), dis = busy || !S.running;
        const mk = (label, a, cls) => { const b = h('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.disabled = dis; b.onclick = () => act(() => window.sllm.infamyAnswer(d.id, a)); row.append(b); };
        mk(L('인도한다 (전범 처형 · 악명 −10 · 호감 +30)', 'Hand them over (executed · infamy −10 · opinion +30)'), 'hand');
        mk(L('자국 군사법정 (영향력 50 · 악명 −5 · 호감 +10)', 'Own military tribunal (50 influence · infamy −5 · opinion +10)'), 'trial', 'sub');
        mk(L('거부한다 (악명 +5 · 호감 −40)', 'Refuse (infamy +5 · opinion −40)'), 'refuse', 'sub');
        box.append(row);
        if (!S.running) box.append(h('small', '', L('답은 게임이 켜져 있을 때만 됩니다.', 'Answering needs the game running.')));
      } else box.append(h('small', '', d.result || ''));
      bd.append(box);
    }
  }
  function hiddenBox(bd) {
    const box = h('div', 'hid');
    box.append(h('b', '', L(`숨은 악명 ${S.hid}`, `Hidden infamy ${S.hid}`)), h('div', '', S.hid > 0.5 ? L(`정부 안에서만 아는 범죄입니다. 해마다 약 ${S.chance}% 확률로 드러나며, 드러나면 ${'1.5'}배가 공개 악명에 더해집니다. 드러나지 않은 해에는 증거가 조금씩 흐려집니다.`, `Crimes known only inside our government. About ${S.chance}% chance a year they come out; if so, 1.5× is added to public infamy. Each year they stay hidden, the evidence fades a little.`) : L('숨긴 범죄가 없습니다.', 'Nothing is hidden.')));
    const c = S.cover, row = h('div', 'acts'); row.style.marginTop = '6px';
    const b = h('button', 'btn sub', confirmCover ? L('정말 은폐합니까? 한 번 더 누르세요', 'Really cover it up? Click again') : L(`은폐 공작 (영향력 ${c.influence}·에너지 ${c.energy} · 공개 악명 최대 ${c.max}을 숨김)`, `Cover-up (${c.influence} influence · ${c.energy} energy · hides up to ${c.max} infamy)`));
    b.type = 'button'; b.disabled = busy || !S.running || c.waitDays > 0 || S.inf < 1;
    b.onclick = () => { if (!confirmCover) { confirmCover = true; room(); return; } confirmCover = false; act(() => window.sllm.infamyCover()); };
    row.append(b); if (c.waitDays > 0) row.append(h('small', '', L(`약 ${Math.ceil(c.waitDays / 30)}달 뒤 다시 가능`, `available again in ~${Math.ceil(c.waitDays / 30)} months`)));
    box.append(row); bd.append(box);
  }
  function room() {
    const main = document.getElementById('main'); if (!main) return;
    let r = document.getElementById('infRoom');
    if (!open || !S || !S.sid) { if (r) r.remove(); return; }
    css();
    const keep = r && r.querySelector('.bd') ? r.querySelector('.bd').scrollTop : 0;
    if (!r) { r = h('div'); r.id = 'infRoom'; r.setAttribute('data-i18n-skip', ''); main.append(r); }
    r.textContent = '';
    const hd = h('div', 'hd'), t = h('div'); t.style.display = 'flex'; t.style.flexDirection = 'column'; t.style.lineHeight = '1.3';
    t.append(h('b', '', L('악명 · 전쟁범죄 기록', 'Infamy · war crimes')), h('small', '', S.date ? L(`게임에서 읽은 때: ${S.date}`, `Read from game: ${S.date}`) : L('아직 게임에서 읽지 않았습니다.', 'Not read from the game yet.')));
    const rf = h('button', 'btn sub', busy ? L('읽는 중…', 'Reading…') : L('게임에서 다시 읽기', 'Refresh from game')); rf.type = 'button'; rf.disabled = busy || !S.running;
    rf.onclick = async () => { busy = true; msg = ''; room(); let res; try { res = await window.sllm.infamyRefresh(); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; } busy = false; if (res.state) S = res.state; msg = res.ok ? '' : (res.error || L('실패했습니다.', 'Failed.')); side(); room(); };
    const x = h('button', 'btn sub', L('닫기', 'Close')); x.type = 'button'; x.onclick = () => { open = false; side(); room(); };
    hd.append(t, h('span', 'sp'), rf, x); r.append(hd);
    const bd = h('div', 'bd');
    // 현재 상태
    const card = h('div', 'card'); const big = h('div', 'big', `${Math.round(S.inf)} / 100`); big.style.color = S.tier ? TC[S.tier] : 'var(--text)';
    card.append(h('b', '', L(`우리 악명 — ${S.tierName}`, `Our infamy — ${S.tierName}`)), big, meter(S.inf), h('div', '', S.effect));
    const nx = S.next ? L(`다음 단계까지 ${Math.ceil(S.next - S.inf)}`, `${Math.ceil(S.next - S.inf)} to the next tier`) : '';
    card.append(h('small', '', [nx, L(`전쟁이 없는 동안 매달 −${S.decay}`, `−${S.decay} per month while at peace`)].filter(Boolean).join(' · ')));
    const mg = h('div', 'msg' + (msgOk ? ' ok' : ''), msg);
    bd.append(card, mg);
    demandBox(bd);
    hiddenBox(bd);
    bd.append(h('p', 'th', L('우리 전범 명단', 'OUR WAR CRIMINALS')));
    if (!S.criminals.length) { const p = h('small', '', L('전범 낙인이 찍힌 지휘관이 없습니다.', 'No commander is branded a war criminal.')); p.style.color = 'var(--dim)'; bd.append(p); } else bd.append(h('div', '', S.criminals.join(' · ')));
    if (S.articles && S.articles.length) { bd.append(h('p', 'th', L('폭로 기사', 'EXPOSÉS'))); for (const a of S.articles) { const d = h('div', 'art'); d.append(h('b', '', a.headline), h('div', '', a.body), h('small', '', a.date)); bd.append(d); } }
    list(bd, L('우리가 저지른 전쟁범죄', 'OUR WAR CRIMES'), S.mine, L('기록된 전쟁범죄가 없습니다.', 'No war crimes on record.'));
    list(bd, L('우리가 당한 전쟁범죄', 'WAR CRIMES AGAINST US'), S.against, L('없습니다.', 'None.'));
    list(bd, L('은하의 다른 전쟁범죄(교신하는 제국)', 'OTHER WAR CRIMES (EMPIRES IN CONTACT)'), S.others, L('알려진 것이 없습니다.', 'None known.'));
    bd.append(h('p', 'th', L('은하 악명 순위', 'GALACTIC INFAMY')));
    if (!S.ranking.length) { const p = h('small', '', L('악명이 쌓인 제국이 없습니다(해마다 1월·「다시 읽기」로 갱신).', 'No empire has infamy (updated each January or with Refresh).')); p.style.color = 'var(--dim)'; bd.append(p); }
    for (const e of S.ranking) { const d = h('div', 'rk'); const n = h('b', '', e.name); const tt = h('span', '', `${e.inf} · ${e.tierName}`); tt.style.color = TC[e.tier]; d.append(n, tt); bd.append(d); }
    bd.append(h('p', 'th', L('규칙', 'RULES')), h('div', 'rules', L(
      '무차별 궤도 폭격 +1/달 · 아마겟돈 폭격 +2/달(행성마다) · 행성 말살 +10 · 종족 숙청 +3/해 · 포로 처형 +5. 말살자 제국은 악명을 쌓지도, 신경 쓰지도 않습니다.\n25 악명 · 50 오명 · 75 은하의 공공의 적 — 단계마다 외교 영향력·신뢰 증가가 줄고, 교신하는 모든 제국의 호감이 떨어집니다. 외교 대화에서도 상대가 우리 범죄를 알고 말합니다.\n숨은 악명: 은폐 공작(2년에 한 번)·포로 비밀 처형(+8)으로 쌓입니다. 남들은 모르지만 해마다 드러날 수 있고, 드러나면 1.5배가 공개 악명에 더해지고 폭로 기사가 납니다.\n전범: 민간인을 폭격한 우리 함대의 제독에게 낙인이 찍힙니다. 전쟁에 지거나 범죄가 폭로되면 상대가 인도를 요구합니다.\n동족 학대(게임이 스스로 판단): 다른 나라의 건국 종족을 우리가 노예로 부리면 −40 · 내쫓으면 −25 · 숙청하면 −120 · 신경 절제하면 −35, 그 나라가 우리를 보는 호감이 깎입니다. 그 나라가 우리 경제 첩보를 갖고 있어야만 압니다(신경 절제는 2단계). 평등주의 나라는 더 화내고 권위주의 나라는 덜 화냅니다.',
      'Indiscriminate bombardment +1/month · armageddon +2/month (per planet) · annihilating a colony +10 · purging a species +3/year · executing a prisoner +5. Exterminator empires neither gain infamy nor care.\n25 Notorious · 50 Infamous · 75 Galactic Pariah — each tier cuts diplomatic weight and trust growth, and lowers the opinion of every empire in contact. In diplomatic talks, other leaders know about our crimes.\nHidden infamy: built by cover-ups (once every two years) and secret executions of prisoners (+8). Others do not know, but it may come out each year; then 1.5× is added to public infamy and an exposé runs.\nWar criminals: admirals whose fleets bombard civilians are branded. If we lose a war or our crimes come out, the other side demands they be handed over.\nAbuse of their kin (judged by the game itself): if we enslave another empire\'s founding species −40 · expel them −25 · purge them −120 · nerve-staple them −35 to that empire\'s opinion of us. They only know if they hold enough intel on our economy (level 2 for nerve stapling). Egalitarians take it harder, authoritarians less so.')));
    bd.lastChild.style.whiteSpace = 'pre-wrap';
    r.append(bd); bd.scrollTop = keep;
  }

  function boot() {
    const sd = document.getElementById('side'); if (!sd) return;
    window.addEventListener('sllm-fleet-overlay', (e) => { if (e.detail !== 'infamy' && open) { open = false; side(); room(); } });
    new MutationObserver(() => { if (S && S.sid && !document.getElementById('infSec')) side(); else { const c = document.getElementById('capSec'), b = document.getElementById('infSec'); if (c && b && c.nextSibling !== b) c.after(b); } }).observe(sd, { childList: true });
    window.sllm.onInfamyUpdate && window.sllm.onInfamyUpdate((v) => { S = v; side(); room(); });
    window.sllm.infamyState().then((v) => { S = v; side(); room(); }).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
