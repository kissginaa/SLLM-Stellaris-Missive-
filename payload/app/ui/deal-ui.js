// 외교 거래판(다음 업데이트, 2026-10-26 — CK3 갈고리·배너로드 물물교환·설득 확률). 통신 단말기 아래 「거래 제안」 버튼으로 연다.
// 앱: src/features/deals-app.ts(dealOpen·dealPreview·dealPropose·dealCancel·dealCta). 확률·저울은 앱이 계산, 수락·거절은 앱 주사위.
// 고정 문구는 P(한, 영)(언어 팩 호환).
(() => {
  const P = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  // 통신 단말기의 서랍(연락처·서신)과 같은 자리·틀(.tm-frame·.tm-head)·테마 색을 쓴다 → 집무실 컴퓨터에 붙은 유리 단말기에서도 같은 모양(2026-10-26).
  const css = '.dl-ov{position:absolute;left:0;right:0;top:37px;bottom:0;z-index:4;background:var(--bg);display:flex;flex-direction:column;border-top:1px solid var(--line);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}'
    + 'body:has(.dl-ov) main,body:has(.dl-ov) #drawer,body:has(.dl-ov) #gateBar{visibility:hidden}' // 유리 단말기에서 뒤 대화 화면이 비쳐 겹치지 않게(서랍과 같은 규칙)
    + '.dl-ov .tm-frame{flex:1 0 auto}.dl-ov .tm-head button{width:26px;height:22px;padding:0;border-color:transparent;background:none;color:var(--dim)}.dl-ov .tm-head button:hover{color:var(--hi);background:none}'
    + '.dl-body{padding:10px 12px 12px;font-size:13px;line-height:1.55}.dl-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.dl-tags span{border:1px solid var(--line2);padding:1px 8px;color:var(--dim);font-size:11.5px;letter-spacing:.04em}'
    + '.dl-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dl-col{border:1px solid var(--line2);padding:8px 10px;background:var(--shade)}.dl-col h4{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--hi);letter-spacing:.08em}'
    + '.dl-add{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:4px 0}.dl-add select,.dl-add input{background:var(--inputbg,var(--panel));padding:3px 5px;font-size:12.5px}.dl-add input[type=number]{width:72px}.dl-add button{padding:3px 9px;font-size:12px}'
    + '.dl-hint{font-size:11.5px;color:var(--dim)}.dl-item{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed var(--line2)}.dl-item button{padding:0 7px;font-size:11.5px}'
    + '.dl-odds{display:flex;gap:16px;align-items:center;margin:12px 0 6px;padding:8px 12px;border:1px solid var(--line);background:color-mix(in srgb,var(--hi) 6%,transparent)}.dl-p{font:700 28px/1 var(--mono);color:var(--hi);min-width:80px;text-align:center}'
    + '.dl-parts{display:grid;grid-template-columns:auto auto auto auto;gap:2px 14px;font-size:12px;color:var(--dim)}.dl-parts span:nth-child(2n){color:var(--text);font-family:var(--mono)}'
    + '.dl-err{color:var(--bad);min-height:18px;font-size:12px}.dl-say{border-left:2px solid var(--ai);color:var(--ai);padding:4px 10px;margin:8px 0;font-family:var(--mono)}'
    + '.dl-sec{margin-top:12px;font-size:12.5px}.dl-sec>b{display:block;color:var(--gold);font-weight:600;letter-spacing:.08em;margin-bottom:4px}'
    + '.dl-ov button.armed{border-color:var(--bad);color:var(--bad)}.dl-ov .tm-foot{white-space:pre-wrap}'
    + '@media (max-width:640px){.dl-cols{grid-template-columns:1fr}}';
  let styled = false;
  const TRUST = () => [P('신뢰 없음', 'No trust'), P('신뢰 낮음', 'Low trust'), P('신뢰 보통', 'Some trust'), P('신뢰 높음', 'High trust'), P('깊은 신뢰', 'Deep trust')];
  const POWER = () => [P('우리가 한참 약함', 'We are pathetic to them'), P('우리가 약함', 'We are weaker'), P('국력 대등', 'Evenly matched'), P('우리가 우세', 'We are stronger'), P('우리가 압도', 'We overwhelm them')];
  const PART = () => ({ opinion: P('호감', 'Opinion'), trust: P('신뢰', 'Trust'), power: P('국력', 'Power'), balance: P('거래 저울', 'Deal balance'), hook: P('갈고리', 'Hook'), ally: P('동맹', 'Alliance'), exhaustion: P('전쟁 피로', 'War exhaustion'), nag: P('다시 조르기', 'Pestering'), pride: P('자존심', 'Pride'), claims: P('영유권', 'Claims') });
  const HOOK = () => ({ cb: P('우리를 칠 전쟁 명분을 쥔 사실', 'that they hold a casus belli against us'), plan_attack: P('우리를 공격할 계획', 'their plan to attack us'), plan_weaken: P('우리를 약화시키려는 계획', 'their plan to weaken us'), plan_vassal: P('우리를 속국으로 삼으려는 계획', 'their plan to make us a subject') });
  const num = (n) => (Math.round(n * 10) / 10).toLocaleString();
  // open(): 외교 단말기에서 통신 중인 상대와 거래판(덮개). open({ tid, host }): 집무실 「외교 거래」 화면 안(host)에 그 제국과의 거래판을 그린다(office-deals.js).
  async function open(o = {}) {
    if (!styled) { const s = h('style'); s.textContent = css; document.head.append(s); styled = true; }
    const office = !!o.host;
    let body, foot, title = null, shut = () => {};
    if (office) { body = h('div', 'dl-body dl-office'); foot = h('div', 'dl-foot'); foot.setAttribute('role', 'status'); o.host.replaceChildren(body, foot); }
    else {
    document.querySelectorAll('.dl-ov').forEach((x) => x.remove());
    const ov = h('div', 'dl-ov'), box = h('div', 'tm-frame'), head = h('div', 'tm-head'), close = h('button', '', '✕'); title = h('b', '', P('외교 거래', 'Diplomatic deal'));
    close.type = 'button'; close.title = P('닫기', 'Close'); head.append(title, h('small', '', 'DIPLOMATIC DEAL'), h('span', 'sp'), close);
    const note = h('div', 'tm-note', P('주고받을 것을 담으면 상대가 받아들일 확률이 바로 보입니다. 결정은 그 확률대로 정해집니다.', 'Add what to give and take; the chance they accept updates as you go. The outcome follows that chance.'));
    body = h('div', 'dl-body'); foot = h('div', 'tm-foot'); foot.setAttribute('role', 'status'); box.append(head, note, body, foot); ov.append(box); document.body.append(ov);
    // 제목줄 버튼(연락처·서신·설정 서랍)을 누르면 거래판을 닫아 서랍이 가려지지 않게 한다.
    const tb = document.getElementById('titlebar'), onTb = (e) => { if (e.target.closest && e.target.closest('button')) shut(); };
    shut = () => { ov.remove(); document.removeEventListener('keydown', key); if (tb) tb.removeEventListener('click', onTb, true); }; const key = (e) => { if (e.key === 'Escape') shut(); };
    if (tb) tb.addEventListener('click', onTb, true);
    close.onclick = shut; document.addEventListener('keydown', key);
    }
    let V = null, items = [], useHook = false, pv = null, busy = false, msg = '', say = '', results = [], timer = 0, armedCancel = '';
    let mKid = '', mDowry = 0, mSend = false, mOdds = null, mWait = false; // 정략결혼(2026-10-28 정치)
    const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { if (!V || !V.ok) return; try { pv = await window.sllm.dealPreview(items, useHook); } catch (e) { pv = { errors: [e.message] }; } draw(); }, 120); };
    const ctaBox = () => {
      if (!V || !V.cta || !V.cta.length) return null;
      const d = h('div', 'dl-sec'); d.append(h('b', '', P('동맹의 참전 요청', 'Calls to arms from allies')));
      for (const c of V.cta) {
        const row = h('div', 'dl-item'); row.append(h('span', '', P(`${c.name} — ${c.asked}에 요청(두 달 안에 답하지 않으면 거절)`, `${c.name} — asked on ${c.asked} (no answer within two months counts as a refusal)`)));
        const yes = h('button', 'primary', P('참전', 'Join')), no = h('button', '', P('거절(호감 -30, 신문)', 'Refuse (opinion -30, in the papers)'));
        const aidB = h('button', '', P('물자 지원으로 답하기(호감 -10)', 'Answer with supplies (opinion -10)')); // 2026-10-28 하츠 참고
        yes.type = no.type = aidB.type = 'button'; yes.disabled = no.disabled = aidB.disabled = busy;
        const go = async (acc) => { busy = true; draw(); try { const r = acc === 'aid' ? await window.sllm.dealCtaAid(c.tid) : await window.sllm.dealCta(c.tid, acc); msg = r.text || r.error || ''; if (r.view) V = { ...V, cta: r.view.cta, aid: r.view.aid || V.aid }; } catch (e) { msg = e.message; } busy = false; draw(); };
        yes.onclick = () => go(true); no.onclick = () => go(false); aidB.onclick = () => go('aid');
        const bt = h('span'); bt.append(yes, aidB, no); row.append(bt); d.append(row);
      }
      return d;
    };
    const resOpts = (sel) => { for (const r of V.res) { const o = h('option', '', r.name); o.value = r.key; sel.append(o); } };
    const sideBox = (side) => {
      const c = V.ctx, mine = side === 'us' ? c.us : c.them, col = h('div', 'dl-col');
      col.append(h('h4', '', side === 'us' ? P(`${V.us}이(가) 주는 것`, `${V.us} gives`) : P(`${V.name}이(가) 주는 것`, `${V.name} gives`)));
      // 자원
      const add = h('div', 'dl-add'), kind = h('select'), res = h('select'), amt = h('input'), len = h('input'), btn = h('button', '', P('담기', 'Add'));
      for (const [v, t] of [['res', P('자원 한 번에', 'Resources at once')], ['monthly', P('자원 매달', 'Resources monthly')], ['nap', P('불가침 약속', 'Non-aggression promise')]]) { const o = h('option', '', t); o.value = v; kind.append(o); }
      resOpts(res); amt.type = 'number'; amt.min = '1'; amt.placeholder = P('양', 'Amount'); len.type = 'number'; len.min = '1'; btn.type = 'button';
      const hint = h('div', 'dl-hint');
      const sync = () => {
        const k = kind.value, r = res.value; res.hidden = k === 'nap'; amt.hidden = k === 'nap'; len.hidden = k === 'res';
        len.placeholder = k === 'nap' ? P('년', 'Years') : P('개월', 'Months'); len.max = k === 'nap' ? String(V.limits.maxNapYears) : String(V.limits.maxMonths);
        hint.textContent = k === 'nap' ? P(`이 쪽이 상대를 ${V.limits.maxNapYears}년까지 공격하지 않겠다고 약속합니다. 어기면 약속 파기.`, `This side promises not to attack the other for up to ${V.limits.maxNapYears} years. Breaking it breaks the deal.`)
          : k === 'monthly' ? P(`월수입 ${num(mine.income[r])} · 매달 최대 ${Math.max(0, Math.floor(mine.income[r] * V.limits.incomeShare))} · 최대 ${V.limits.maxMonths}개월 · 두 달 연속 못 내면 파기`, `Income ${num(mine.income[r])} · up to ${Math.max(0, Math.floor(mine.income[r] * V.limits.incomeShare))} a month · up to ${V.limits.maxMonths} months · two missed months break the deal`)
          : P(`창고 ${num(mine.stock[r])}`, `Stockpile ${num(mine.stock[r])}`);
      };
      kind.onchange = res.onchange = sync; sync();
      btn.onclick = () => {
        const k = kind.value, a = Math.floor(Number(amt.value)), l = Math.floor(Number(len.value));
        if (k === 'res' && a >= 1) items.push({ k, res: res.value, amt: a, from: side });
        else if (k === 'monthly' && a >= 1 && l >= 1) items.push({ k, res: res.value, amt: a, months: l, from: side });
        else if (k === 'nap' && l >= 1) items.push({ k, years: l, from: side });
        else return;
        amt.value = ''; len.value = ''; refresh();
      };
      add.append(kind, res, amt, len, btn); col.append(add, hint);
      if (side === 'them') {
        const dip = h('div', 'dl-add');
        const one = (k, label, ok) => { const b = h('button', '', label); b.type = 'button'; b.disabled = !ok || items.some((x) => x.k === k); b.onclick = () => { items.push({ k }); refresh(); }; dip.append(b); };
        one('borders', P('국경 개방', 'Open borders'), !c.war);
        one('rivalry', P('경쟁 관계 해제', 'End rivalry'), c.rival);
        one('join_war', P('우리 전쟁에 참전', 'Join our wars'), c.ourWar && !c.war);
        col.append(dip);
        // 굴욕 조항(2026-11-04): 상대 수도 행성·성계 이름을 우리가 정한 이름으로
        const rn = h('div', 'dl-add'), what = h('select'), nm = h('input'), rb = h('button', '', P('개명 요구 담기', 'Demand a rename'));
        for (const [v, t] of [['cap', P('수도 행성', 'Capital world')], ['sys', P('수도 성계', 'Capital system')]]) { const op = h('option', '', t); op.value = v; what.append(op); }
        nm.maxLength = 40; nm.placeholder = P('새 이름', 'New name'); rb.type = 'button';
        rb.onclick = () => { const n = nm.value.trim(); if (!n || items.some((x) => (x.k === 'rename' || x.k === 'restore') && x.what === what.value)) return; items.push({ k: 'rename', what: what.value, name: n }); nm.value = ''; refresh(); };
        rn.append(what, nm, rb); col.append(rn, h('div', 'dl-hint', P('굴욕 조항 — 받아들이기 어렵고(자존심), 받아들이면 그 제국이 오래 원한을 품습니다. 원래 이름은 장부에 남아 나중에 돌려줄 수 있습니다.', 'A humiliating clause — hard to accept (pride), and an empire that accepts will hold a long grudge. The original name is kept so it can be returned later.')));
      } else if (V.renames && V.renames.length) {
        // 이름 반환: 우리가 빼앗은 이름을 돌려준다(화해 카드)
        const rs = h('div', 'dl-add');
        for (const r of V.renames) { const b = h('button', '', P(`「${r.name}」 → 원래 이름 「${r.old}」 돌려주기`, `Return "${r.old}" (now "${r.name}")`)); b.type = 'button'; b.disabled = items.some((x) => (x.k === 'restore' || x.k === 'rename') && x.what === r.what); b.onclick = () => { items.push({ k: 'restore', rid: r.id, what: r.what, name: r.old }); refresh(); }; rs.append(b); }
        col.append(rs, h('div', 'dl-hint', P('빼앗았던 이름을 돌려주면 원한이 크게 풀립니다.', 'Returning a name we took eases their grudge a great deal.')));
      }
      // 성계 할양(2026-11-04): 그 쪽 성계 목록을 게임에 물어 하나를 고른다(수도 불가). 종속국 행정과 같은 게임 명령.
      if (window.sllm.vaSystems) {
        const cd = h('div', 'dl-add'), sel = h('select'), ld = h('button', '', side === 'them' ? P('성계 할양 요구', 'Demand a system') : P('우리 성계 넘기기', 'Cede one of ours')), ad = h('button', '', P('담기', 'Add'));
        const o0 = h('option', '', P('— 목록 —', '— list —')); o0.value = ''; sel.append(o0); ad.disabled = true; [ld, ad].forEach((b) => { b.type = 'button'; });
        ld.onclick = async () => {
          ld.disabled = true; sel.textContent = ''; const w = h('option', '', P('불러오는 중…', 'Loading…')); w.value = ''; sel.append(w);
          let r; try { r = await window.sllm.vaSystems(side === 'them' ? V.tid : 0); } catch (e) { r = { ok: false, error: String(e) }; }
          sel.textContent = ''; ld.disabled = false;
          if (!r || !r.ok || !r.list.length) { const o = h('option', '', (r && r.error) || P('성계가 없습니다.', 'No systems.')); o.value = ''; sel.append(o); ad.disabled = true; return; }
          for (const sy of r.list) { const o = h('option', '', `${sy.name} · ${P('식민지', 'colonies')} ${sy.col}${sy.cap ? P(' · 수도(불가)', ' · capital (no)') : ''}`); o.value = String(sy.n); o.dataset.name = sy.name; o.dataset.col = String(sy.col); o.disabled = !!sy.cap; sel.append(o); }
          const first = [...sel.options].find((o) => !o.disabled); if (first) sel.value = first.value; ad.disabled = !first;
        };
        ad.onclick = () => { const o = sel.selectedOptions[0]; if (!o || !o.value || items.some((x) => x.k === 'cede' && x.n === Number(o.value))) return; items.push({ k: 'cede', from: side, n: Number(o.value), name: o.dataset.name, col: Number(o.dataset.col) }); refresh(); };
        cd.append(ld, sel, ad); col.append(cd, h('div', 'dl-hint', side === 'them' ? P('영토를 내놓으라는 요구 — 식민지가 많을수록 자존심이 크게 걸리고, 받아들이면 오래 원한을 품습니다.', 'A demand for their territory — the more colonies, the more their pride resists, and they will hold a long grudge if they accept.') : P('우리 성계를 내주면 큰 대가가 됩니다(국경이 붙지 않아도 됨).', 'Ceding one of our systems is a big sweetener (no shared border needed).')));
      }
      for (const [i, it] of items.entries()) {
        const mineSide = it.k === 'res' || it.k === 'monthly' || it.k === 'nap' || it.k === 'cede' ? it.from === side : it.k === 'restore' ? side === 'us' : side === 'them' && it.k !== 'peace' && it.k !== 'waive';
        if (!mineSide) continue;
        const row = h('div', 'dl-item'); row.append(h('span', '', (pv && pv.lines && pv.lines[i]) || '…'));
        const x = h('button', '', '✕'); x.type = 'button'; x.title = P('빼기', 'Remove'); x.onclick = () => { items.splice(i, 1); refresh(); }; row.append(x); col.append(row);
      }
      return col;
    };
    const draw = () => {
      body.replaceChildren(); foot.textContent = [msg, ...results].filter(Boolean).join('\n');
      if (!V) { body.append(h('p', '', P('게임에서 상대 사정을 읽는 중…', 'Reading the empire from the game…'))); return; }
      if (title) title.firstChild.textContent = V.ok ? P(`외교 거래 — ${V.name}`, `Diplomatic deal — ${V.name}`) : P('외교 거래', 'Diplomatic deal');
      else if (V.ok) { // 집무실: 대사관 화면처럼 오른쪽 머리에 제국 이름
        const hd = h('div', 'emb-hd'), nm = h('h4', '', V.name); nm.setAttribute('data-i18n-skip', ''); hd.append(nm); body.append(hd);
        body.append(h('p', 'emb-note', V.talk ? P('주고받을 것을 담으면 수락 확률이 바로 보입니다. 결정은 그 확률대로 정해지고, 통신 중이라 상대가 한마디 답합니다.', 'Add what to give and take; the chance they accept updates as you go. The outcome follows that chance, and since the channel is open they will answer in a line.') : P('주고받을 것을 담으면 수락 확률이 바로 보입니다. 결정은 그 확률대로 정해집니다(AI 를 쓰지 않음).', 'Add what to give and take; the chance they accept updates as you go. The outcome follows that chance (no AI used).')));
      }
      const cb = office ? null : ctaBox(); if (cb) body.append(cb); // 집무실은 왼쪽 목록 위에 참전 요청을 둔다
      if (!V.ok) { body.append(h('p', 'dl-err', V.error || '')); return; }
      const c = V.ctx, tags = h('div', 'dl-tags');
      for (const t of [P(`호감 ${V.score}`, `Opinion ${V.score}`), TRUST()[c.trust], POWER()[c.pow], c.rival ? P('우리를 경쟁국으로 둠', 'Rivals us') : '', c.ally ? P('동맹(방위 조약·연방)', 'Ally (pact or federation)') : '', c.war ? P('서로 전쟁 중', 'At war with us') : '', V.owed ? P('우리가 약속을 어긴 빚이 있음', 'We owe them for a broken promise') : '', c.claimsUs ? P('우리가 그 땅에 영유권을 걸어 둠', 'We hold claims on them') : '', c.claimsThem ? P('그들이 우리 땅에 영유권을 걸어 둠', 'They hold claims on us') : '', V.nag ? P(`이번 달 ${V.nag}번 제안함`, `${V.nag} proposals this month`) : ''].filter(Boolean)) tags.append(h('span', '', t));
      body.append(tags);
      const cols = h('div', 'dl-cols'); cols.append(sideBox('us'), sideBox('them')); body.append(cols);
      if (c.war) {
        const pz = h('div', 'dl-add'), b = h('button', items.some((x) => x.k === 'peace') ? 'primary' : '', items.some((x) => x.k === 'peace') ? P('✓ 종전 포함', '✓ Peace included') : P('종전 넣기', 'Include peace'));
        b.type = 'button'; b.onclick = () => { const i = items.findIndex((x) => x.k === 'peace'); if (i >= 0) items.splice(i, 1); else items.push({ k: 'peace' }); refresh(); };
        pz.append(b, h('span', 'dl-hint', P('전쟁 피로가 상대 쪽이 크면 받아들이기 쉽습니다. 매달 조공과 함께 넣으면 조공 평화가 됩니다.', 'Easier when their side is more war-weary. Add monthly tribute for a tribute peace.'))); body.append(pz);
      }
      { // 영유권 포기(2026-11-05): 서로 주고받는 약속이라 양쪽 칸 밖에 둔다. 전쟁 중이면 종전과 함께만.
        const on = items.some((x) => x.k === 'waive'), wz = h('div', 'dl-add'), b = h('button', on ? 'primary' : '', on ? P('✓ 영유권 포기 포함', '✓ Claims renounced') : P('서로 영유권 포기', 'Renounce claims on each other'));
        b.type = 'button'; b.disabled = !on && c.war && !items.some((x) => x.k === 'peace');
        b.onclick = () => { const i = items.findIndex((x) => x.k === 'waive'); if (i >= 0) items.splice(i, 1); else items.push({ k: 'waive' }); refresh(); };
        wz.append(b, h('span', 'dl-hint', P('서로 상대 영토에 건 영유권을 모두 지우고 10년간 새로 걸지 않습니다. 그들만 우리 땅에 걸어 뒀다면 내켜 하지 않고, 우리만 걸어 뒀다면 반깁니다. 10년 안에 새로 거는 쪽이 약속을 어긴 것입니다.', 'Both sides drop every claim on each other and make none for 10 years. They are reluctant if only they hold claims on us, and glad if only we hold claims on them. Whoever lays a new claim within 10 years breaks the deal.'))); body.append(wz);
      }
      if (V.hook) {
        const lab = h('label', 'dl-add'), ch = h('input'); ch.type = 'checkbox'; ch.checked = useHook; ch.onchange = () => { useHook = ch.checked; refresh(); };
        lab.append(ch, h('span', '', P(`갈고리 쓰기 — 첩보로 알아낸 ${HOOK()[V.hook] || V.hook}을(를) 들이댑니다(+30%p, 한 번 쓰면 사라짐)`, `Use the hook — confront them with ${HOOK()[V.hook] || V.hook} (+30 points, used up either way)`))); body.append(lab);
      }
      const odds = h('div', 'dl-odds'), pEl = h('div', 'dl-p', pv && pv.parts ? pv.p + '%' : '—'), parts = h('div', 'dl-parts');
      if (pv && pv.parts) for (const [k, v] of Object.entries(pv.parts)) { if (!v && k !== 'opinion' && k !== 'balance') continue; parts.append(h('span', '', PART()[k] || k), h('span', '', (v > 0 ? '+' : '') + v)); }
      if (pv && pv.balance) parts.append(h('span', '', P('저울(가치)', 'Balance (value)')), h('span', '', P(`받음 ${num(pv.balance.toThem)} / 줌 ${num(pv.balance.fromThem)}`, `they get ${num(pv.balance.toThem)} / give ${num(pv.balance.fromThem)}`)));
      odds.append(pEl, parts); body.append(odds);
      const errs = pv && pv.errors ? pv.errors : []; body.append(h('div', 'dl-err', errs.join(' ')));
      const go = h('button', 'primary', busy ? P('상대가 검토하는 중…', 'They are weighing it…') : P('제안하기', 'Propose')); go.type = 'button'; go.disabled = busy || !items.length || errs.length > 0;
      go.onclick = async () => {
        busy = true; msg = ''; say = ''; results = []; draw();
        try {
          const r = await window.sllm.dealPropose(items, useHook);
          if (!r.ok) msg = r.error || '';
          else { say = r.say || ''; msg = r.accepted ? P(`수락했습니다 (확률 ${r.p}%).`, `They accepted (chance ${r.p}%).`) : P(`거절했습니다 (확률 ${r.p}%).`, `They refused (chance ${r.p}%).`); results = r.results || []; if (r.accepted) items = []; useHook = false; }
          if (r.view) V = r.view;
          if (o.onChange) o.onChange();
        } catch (e) { msg = e.message; }
        busy = false; pv = null; refresh(); draw();
      };
      body.append(go);
      if (say) body.append(h('div', 'dl-say', say));
      // 물자 지원(랜드리스, 2026-10-28 하츠 참고): 전쟁 중인 제국에 참전 없이 매달 자원. 거래가 아니라 우리가 정하는 지원이라 확률이 없다.
      if (V.aid && (V.aid.war || V.aid.active)) {
        const A = V.aid, sec = h('div', 'dl-sec'); sec.append(h('b', '', P('물자 지원 (참전 없이)', 'Supplies (without joining the war)')));
        if (A.active) {
          const row = h('div', 'dl-item'); row.append(h('span', '', A.active.text));
          const st = h('button', '', P('지원 중단', 'Stop aid')); st.type = 'button'; st.title = P('벌점은 없지만 해마다 오르던 호감(+10)이 끊깁니다.', 'No penalty, but the yearly opinion bonus (+10) stops.');
          st.onclick = async () => { busy = true; draw(); try { await window.sllm.aidStop(A.active.id); V = await window.sllm.dealOpen(office ? o.tid : undefined); msg = P('물자 지원을 중단했습니다.', 'Aid stopped.'); } catch (e) { msg = e.message; } busy = false; draw(); };
          row.append(st); sec.append(row);
        } else {
          sec.append(h('div', 'dl-hint', P(`${V.name}은(는) 지금 ${A.enemies.join(', ') || '다른 제국'}과(와) 전쟁 중입니다. 매달 보내면 호감 +30(지원하는 동안 해마다 +10), 이를 알아챈 적국은 호감 -20. 첩보 수준 30 이상인 적국은 바로 알고, 나머지는 해마다 20% 확률로 알게 됩니다.`, `${V.name} is at war with ${A.enemies.join(', ') || 'another empire'}. Monthly supplies give opinion +30 (+10 every year it lasts); enemies who notice lose -20 opinion of us. Enemies with intel 30+ on us know at once; others find out with a 20% chance each year.`)));
          const add = h('div', 'dl-add'), res = h('select'), amt = h('input'), yrs = h('input'), b = h('button', 'primary', P('지원 시작', 'Start aid'));
          resOpts(res); amt.type = 'number'; amt.min = '1'; yrs.type = 'number'; yrs.min = String(A.years[0]); yrs.max = String(A.years[1]); yrs.value = '2'; yrs.placeholder = P('년', 'Years'); b.type = 'button'; b.disabled = busy;
          const hint = h('div', 'dl-hint'); const sync = () => { const r = A.ranges && A.ranges[res.value]; amt.placeholder = r ? `${r.lo}~${r.hi}` : P('양', 'Amount'); if (r && !amt.value) amt.value = String(r.lo); hint.textContent = r ? (r.hi >= r.lo ? P(`매달 ${r.lo}~${r.hi}(우리 월수입의 5~20%) · ${A.years[0]}~${A.years[1]}년 · 창고가 두 달 연속 모자라면 끊김`, `${r.lo}–${r.hi} a month (5–20% of our income) · ${A.years[0]}–${A.years[1]} years · stops after two short months`) : P('이 자원은 월수입이 적어 보낼 수 없습니다.', 'Our income of this resource is too low.')) : ''; };
          res.onchange = () => { amt.value = ''; sync(); }; sync();
          b.onclick = async () => { busy = true; msg = ''; draw(); try { const r = await window.sllm.dealAid(res.value, Number(amt.value), Number(yrs.value)); msg = r.text || r.error || ''; if (r.view) V = r.view; if (o.onChange) o.onChange(); } catch (e) { msg = e.message; } busy = false; draw(); };
          add.append(res, amt, yrs, b); sec.append(add, hint);
        }
        body.append(sec);
      }
      // 정략결혼(2026-10-28 정치 — 토탈워 참고): 성인 자녀와 상대 통치 가문 인물. 확률 = 거래 확률(지참금이 저울) + 10, 경쟁국이면 -20.
      if (V.marry) {
        const M = V.marry, sec = h('div', 'dl-sec'); sec.append(h('b', '', P('정략결혼', 'Political marriage')));
        for (const m of M.marriages || []) sec.append(h('div', 'dl-item', `${m.on} · ${m.text}${m.state === 'strained' ? P(' · 전쟁으로 곤란해짐', ' · strained by war') : ''}`));
        const kids = M.kids || [];
        sec.append(h('div', 'dl-hint', P(`상대: ${M.house}${(M.houseTraits || []).length ? ' (' + M.houseTraits.map((t) => t.name).join(', ') + ')' : ''}. 받아들이면 혼인이 이어지는 동안 호감 +${M.opinion}. 전쟁이 나면 사라지고 자녀가 곤란해집니다.`, `Their side: ${M.house}${(M.houseTraits || []).length ? ' (' + M.houseTraits.map((t) => t.name).join(', ') + ')' : ''}. If accepted, opinion +${M.opinion} while the marriage lasts; war ends it and puts the child in a hard spot.`)));
        if (!kids.length) sec.append(h('div', 'dl-hint', P('혼인할 수 있는 성인 자녀가 없습니다(아기방에서 자란 자녀만, 이미 혼인한 자녀 제외).', 'No grown child can marry (only children raised in the nursery, not already married).')));
        else {
          if (!kids.some((k) => k.id === mKid)) { mKid = kids[0].id; mOdds = null; }
          const add = h('div', 'dl-add'), sel = h('select'), dw = h('input'), b = h('button', 'primary', P('혼인 제안', 'Propose the match'));
          for (const k of kids) { const op = h('option', '', `${k.name} · ${k.leader ? P('지도자', 'leader') : k.job || P('민간인', 'civilian')}${k.heir ? P(' · 후계자', ' · heir') : ''}`); op.value = k.id; if (k.id === mKid) op.selected = true; sel.append(op); }
          sel.setAttribute('data-i18n-skip', ''); dw.type = 'number'; dw.min = '0'; dw.step = '50'; dw.value = String(mDowry || ''); dw.placeholder = P('지참금(에너지)', 'Dowry (energy)'); dw.title = P('지참금을 얹으면 거래 저울이 상대에게 기울어 받아들이기 쉬워집니다.', 'A dowry tips the deal balance their way.');
          const kid = kids.find((k) => k.id === mKid);
          const lab = h('label', 'dl-add'); const ch = h('input'); ch.type = 'checkbox'; ch.checked = mSend; ch.onchange = () => { mSend = ch.checked; };
          lab.append(ch, h('span', '', P('지도자 자녀를 상대 제국으로 보내기(그쪽 지도자가 됨)', 'Send the leader child to their empire (becomes one of their leaders)')));
          const pEl = h('span', 'dl-hint', mOdds ? (mOdds.errors.length ? mOdds.errors.join(' ') : P(`받아들일 확률 ${mOdds.p}%`, `Chance they accept: ${mOdds.p}%`)) : P('확률 계산 중…', 'Working out the odds…'));
          const recalc = async () => { if (mWait) return; mWait = true; try { mOdds = await window.sllm.dealMarryOdds(mKid, mDowry); } catch (e) { mOdds = { p: 0, errors: [e.message] }; } mWait = false; draw(); };
          sel.onchange = () => { mKid = sel.value; mOdds = null; void recalc(); }; dw.onchange = () => { mDowry = Math.max(0, Math.floor(Number(dw.value) || 0)); mOdds = null; void recalc(); };
          if (!mOdds) void recalc();
          b.type = 'button'; b.disabled = busy || !mOdds || mOdds.errors.length > 0;
          b.onclick = async () => {
            busy = true; msg = ''; say = ''; results = []; draw();
            try {
              const r = await window.sllm.dealMarry(mKid, mDowry, mSend && !!(kid && kid.leader));
              if (!r.ok) msg = r.error || '';
              else { say = r.say || ''; msg = r.accepted ? P(`혼인을 받아들였습니다 (확률 ${r.p}%).`, `They accepted the match (chance ${r.p}%).`) : P(`혼인을 거절했습니다 (확률 ${r.p}%).`, `They declined the match (chance ${r.p}%).`); results = r.results || []; }
              if (r.view) V = r.view; mOdds = null; if (o.onChange) o.onChange();
            } catch (e) { msg = e.message; }
            busy = false; draw();
          };
          add.append(sel, dw, b); sec.append(add); if (kid && kid.leader) sec.append(lab); sec.append(pEl);
        }
        body.append(sec);
      }
      if (V.agreements && V.agreements.length) {
        const sec = h('div', 'dl-sec'); sec.append(h('b', '', P('이 제국과 맺은 약속', 'Standing agreements with this empire')));
        for (const a of V.agreements) {
          const row = h('div', 'dl-item'), txt = h('span', '', [P(`${a.since}부터`, `Since ${a.since}`), ...a.monthly.map((m) => m.text), ...a.nap].join(' · '));
          row.append(txt);
          if (a.monthly.some((m) => m.payUs)) {
            const b = h('button', armedCancel === a.id ? 'armed' : '', armedCancel === a.id ? P('정말 끊을까요? 약속 파기(호감 -50·신문·상대 갈고리)', 'Really stop? Breaks the deal (opinion -50, papers, they get a hook)') : P('지급 끊기', 'Stop paying'));
            b.type = 'button'; b.onclick = async () => {
              if (armedCancel !== a.id) { armedCancel = a.id; draw(); setTimeout(() => { if (armedCancel === a.id) { armedCancel = ''; draw(); } }, 4000); return; }
              armedCancel = ''; busy = true; draw(); try { const r = await window.sllm.dealCancel(a.id); if (r.view) V = r.view; if (o.onChange) o.onChange(); msg = r.error || P('지급을 끊었습니다. 약속을 어긴 것으로 처리했습니다.', 'Payments stopped. Counted as breaking our word.'); } catch (e) { msg = e.message; } busy = false; draw();
            };
            row.append(b);
          }
          sec.append(row);
        }
        body.append(sec);
      }
    };
    draw();
    try { V = await window.sllm.dealOpen(office ? o.tid : undefined); } catch (e) { V = { ok: false, error: e.message }; }
    draw(); refresh();
  }
  const bind = () => { const b = document.getElementById('dealBtn'); if (b) b.onclick = () => { open().catch(() => {}); }; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  window.SLLMDeal = { open };
})();
