// 제국 세력도 「회랑의 귀족」(2026-11-08) — 회랑 자리 판에서 강대국 땅을 차지하면 처분(괴뢰국 · 우리 지도자를 귀족으로 · 직할령)하고, 앉힌 귀족을 돌본다.
// office-nobles.js 가 이 칸을 열 때 이 파일을 불러 window.SLLMCn.draw(left, right, opts) 를 부른다. 앱: src/features/scenario-cnobles-app.ts(scnCn · scnCnAct).
// 성격 점수(2026-11-08 사용자): 기본 4점, 부정(−) 칸마다 +1점, 긍정(+) 칸마다 1점을 쓴다. 임명할 때 한 번만 찍고 영구.
// 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  // 확인 창(2026-11-08 사용자: 「알람 디자인 짜침」): 윈도우 기본 confirm() 대신 앱 안에서 뜨는 창. 부드럽게 나타나기만 한다(깜빡임 없음). Esc = 취소, Enter = 확인.
  if (!window.sllmAsk) window.sllmAsk = (msg, o = {}) => new Promise((done) => {
    const Lq = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
    if (!document.getElementById('sllmAskCss')) { const st = document.createElement('style'); st.id = 'sllmAskCss'; st.textContent = ''
      + '.sllm-ask{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(4,8,14,.62);backdrop-filter:blur(3px);animation:sllmAskIn .18s ease-out both;font-family:inherit}'
      + '.sllm-ask .sa-box{position:relative;width:min(460px,calc(100vw - 40px));padding:22px 24px 18px;border-radius:10px;background:linear-gradient(180deg,#151d29 0%,#0d131c 100%);border:1px solid rgba(214,184,116,.38);box-shadow:0 18px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);color:#dfe6ee;animation:sllmAskUp .22s ease-out both}'
      + '.sllm-ask .sa-box::before{content:"";position:absolute;left:18px;right:18px;top:0;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#d6b874,transparent)}'
      + '.sllm-ask.danger .sa-box{border-color:rgba(226,120,104,.45)}.sllm-ask.danger .sa-box::before{background:linear-gradient(90deg,transparent,#e27868,transparent)}'
      + '.sllm-ask .sa-h{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:15px;font-weight:700;letter-spacing:.02em;color:#f1dfae}.sllm-ask.danger .sa-h{color:#f3b2a6}'
      + '.sllm-ask .sa-ic{width:26px;height:26px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:rgba(214,184,116,.14);border:1px solid rgba(214,184,116,.4)}.sllm-ask.danger .sa-ic{background:rgba(226,120,104,.14);border-color:rgba(226,120,104,.45)}'
      + '.sllm-ask .sa-m{white-space:pre-wrap;font-size:13.5px;line-height:1.6;color:#c9d3de;margin:0 0 18px}'
      + '.sllm-ask .sa-b{display:flex;justify-content:flex-end;gap:8px}.sllm-ask button{min-width:92px;padding:8px 16px;border-radius:6px;font:inherit;font-size:13px;cursor:pointer;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#cfd8e2;transition:background .15s,border-color .15s}'
      + '.sllm-ask button:hover{background:rgba(255,255,255,.1)}.sllm-ask button.ok{background:linear-gradient(180deg,#c9a65a,#a88540);border-color:#e0c27c;color:#1a1408;font-weight:700}.sllm-ask button.ok:hover{background:linear-gradient(180deg,#d6b468,#b4904a)}'
      + '.sllm-ask.danger button.ok{background:linear-gradient(180deg,#c4604f,#9e4537);border-color:#e08a7a;color:#fff3f0}.sllm-ask.danger button.ok:hover{background:linear-gradient(180deg,#d06d5c,#aa4f40)}'
      + '.sllm-ask button:focus-visible{outline:2px solid #f1dfae;outline-offset:2px}'
      + '@keyframes sllmAskIn{from{opacity:0}to{opacity:1}}@keyframes sllmAskUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
      + '@media (prefers-reduced-motion:reduce){.sllm-ask,.sllm-ask .sa-box{animation:none}}';
      document.head.append(st); }
    const danger = o.danger ?? /되돌릴 수 없|cannot be undone|반란|revolt|처형|execute/i.test(String(msg));
    const wrap = document.createElement('div'); wrap.className = 'sllm-ask' + (danger ? ' danger' : ''); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true');
    const box = document.createElement('div'); box.className = 'sa-box';
    const hd = document.createElement('div'); hd.className = 'sa-h'; const ic = document.createElement('span'); ic.className = 'sa-ic'; ic.textContent = danger ? '!' : '?'; hd.append(ic, document.createTextNode(o.title || (danger ? Lq('신중히 결정하세요', 'Decide with care') : Lq('확인', 'Confirm'))));
    const m = document.createElement('div'); m.className = 'sa-m'; m.textContent = String(msg ?? '');
    const bt = document.createElement('div'); bt.className = 'sa-b';
    const no = document.createElement('button'); no.type = 'button'; no.textContent = o.cancel || Lq('취소', 'Cancel');
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'ok'; ok.textContent = o.ok || Lq('확인', 'OK');
    bt.append(no, ok); box.append(hd, m, bt); wrap.append(box);
    const fin = (v) => { document.removeEventListener('keydown', key, true); wrap.remove(); done(v); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fin(true); } };
    no.onclick = (e) => { e.stopPropagation(); fin(false); }; ok.onclick = (e) => { e.stopPropagation(); fin(true); };
    wrap.onclick = (e) => { e.stopPropagation(); if (e.target === wrap) fin(false); };
    wrap.onmousedown = (e) => e.stopPropagation();
    document.addEventListener('keydown', key, true); document.body.append(wrap); (danger ? no : ok).focus();
  });
  const sllmAsk = window.sllmAsk;
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const AXES = () => [
    { pos: L('명예', 'Honor'), neg: L('교활', 'Devious'), tip: L('명예로우면 매수·이간질에 강하고, 교활하면 배신하기 쉽습니다.', 'Honorable lords resist bribes and intrigue; devious ones betray easily.') },
    { pos: L('자비', 'Mercy'), neg: L('잔혹', 'Cruel'), tip: L('자비로우면 정복지 민심이 풀리고, 잔혹하면 반발을 짓누르지만 사람들이 숨죽입니다.', 'Mercy softens the conquered; cruelty crushes dissent but breeds fear.') },
    { pos: L('관대', 'Generous'), neg: L('인색', 'Closefisted'), tip: L('관대하면 정복지 안정도가 오르고 충성도 조금 오릅니다.', 'Generosity steadies the land and slightly warms loyalty.') },
    { pos: L('용맹(야심)', 'Daring (ambition)'), neg: L('신중', 'Cautious'), tip: L('야심이 크면 언젠가 제 나라를 꿈꿉니다(배신 위험·독립).', 'Ambition dreams of a realm of its own (betrayal, independence).') },
    { pos: L('계산(침착)', 'Calculating'), neg: L('충동', 'Impulsive'), tip: L('침착하면 흔들리지 않고, 충동적이면 홧김에 등을 돌립니다.', 'Calm lords hold steady; impulsive ones turn on a whim.') },
  ];
  const SIDE = () => ({ a: L('은하 얼라이언스', 'Galactic Alliance'), b: L('인류 제국', 'Human Empire') });
  const GONE = () => ({ betray: L('귀순(배신)', 'Defected (betrayal)'), free: L('독립(배신)', 'Independence (betrayal)'), dead: L('사망', 'Dead'), dismissed: L('물러남', 'Removed'), lost: L('땅을 잃음', 'Lost the land') });
  const css = () => { if (document.getElementById('cnCss')) return; const st = h('style'); st.id = 'cnCss'; st.textContent =
    // 2026-11-08 사용자: 「여기 화면 보기 불편하다 — 조금 더 개선」: 글씨를 키우고, 귀족마다 얼굴 있는 카드, 위에 한눈 요약, 상태는 왼쪽 색 띠로
    '#nbWin .cn-pages{grid-template-columns:1.25fr 1fr}#nbWin .cn{font-size:13.5px;line-height:1.5}'
    + '#nbWin .cn h4{margin:14px 0 10px;color:#8fe4ff;font-size:15px;letter-spacing:.08em;border-bottom:1px solid #5fd4ff44;padding-bottom:6px;display:flex;align-items:center;gap:8px}#nbWin .cn h4:first-child{margin-top:2px}#nbWin .cn h4 .n{font-size:12px;color:#9fc7d6;font-weight:400;letter-spacing:0}'
    + '#nbWin .cn-rn{margin-left:auto;padding:1px 8px;font-size:11px;letter-spacing:0;text-transform:none}#nbWin .cn h4{display:flex;align-items:center;gap:8px}#nbWin .cn-rnrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 10px;padding:8px;border:1px solid #f0c25a55;background:#f0c25a0d}#nbWin .cn-rnrow input{flex:1;min-width:140px;padding:5px 8px;background:#02101a;border:1px solid #5fd4ff66;color:#e6f6ff;font:inherit;font-size:13px}#nbWin .cn-rnrow small{width:100%;color:#9fb6c4;font-size:11px}' // 이름 바꾸기(2026-11-08)
    + '#nbWin .cn-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 12px}#nbWin .cn-sum div{border:1px solid #5fd4ff33;background:#04131dcc;padding:8px 10px;text-align:center}#nbWin .cn-sum b{display:block;font-size:22px;color:#e6f7ff;line-height:1.2}#nbWin .cn-sum small{font-size:11.5px;color:#8fb7c6}#nbWin .cn-sum .hot b{color:#ffc86a}#nbWin .cn-sum .bad b{color:#ff8a7a}'
    + '#nbWin .cn-card{border:1px solid #5fd4ff3a;border-left:4px solid #5fd4ff;background:#04131dd9;padding:12px 14px;margin:0 0 12px;position:relative}#nbWin .cn-card.pend{border-left-color:#ffc86a;box-shadow:0 0 16px #ffb84a22}#nbWin .cn-card.dir{border-left-color:#ff9a6a}'
    + '#nbWin .cn-card .t{display:flex;gap:10px;align-items:center}#nbWin .cn-card .t b{font-size:16px;color:#f2fbff}#nbWin .cn-card .t .sp{flex:1}#nbWin .cn-tag{font-size:12px;padding:2px 9px;border:1px solid #5fd4ff77;color:#bfefff;white-space:nowrap}#nbWin .cn-tag.pend{border-color:#ffc86a;color:#ffd99a;background:#ffc86a14}#nbWin .cn-tag.dir{border-color:#ff9a6a;color:#ffc2a0}'
    + '#nbWin .cn-meta{color:#9fc0cc;font-size:12.5px;margin-top:2px}'
    + '#nbWin .cn-sys{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}#nbWin .cn-sys span{font-size:12px;padding:1px 8px;background:#5fd4ff14;border:1px solid #5fd4ff33;color:#d6f3ff}'
    + '#nbWin .cn-prev{display:flex;gap:10px;align-items:center;font-size:12.5px;margin-top:6px;color:#c6dde6}#nbWin .cn-prev img{width:40px;height:44px;object-fit:cover;border:1px solid #5fd4ff66}'
    + '#nbWin .cn-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#nbWin .cn-acts button{padding:5px 12px;font-size:13px}#nbWin .cn-acts button.go{border-color:#ffc86a;background:#ffc86a26;color:#ffe7b8}'
    + '#nbWin .cn-form{margin-top:12px;padding:12px;border:1px dashed #5fd4ff55;background:#02080e}#nbWin .cn-form select{width:100%;margin:6px 0 12px;padding:5px;font-size:13px}'
    + '#nbWin .cn-ax{display:grid;grid-template-columns:110px 1fr 110px;gap:8px;align-items:center;margin:6px 0;font-size:13px}#nbWin .cn-ax .seg{display:flex;gap:2px}#nbWin .cn-ax .seg button{flex:1;padding:4px 0;font-size:12px}#nbWin .cn-ax .seg button.on{background:#5fd4ff33;border-color:#8fe4ff}#nbWin .cn-ax .seg button.neg.on{background:#ff8a6a44;border-color:#ff9a6a}#nbWin .cn-ax span:last-child{text-align:right}'
    + '#nbWin .cn-pts{display:flex;gap:14px;align-items:center;margin:10px 0;font-size:13px}#nbWin .cn-pts b{font-size:20px;color:#9fe6ff}#nbWin .cn-pts b.bad{color:#ff8a7a}#nbWin .cn-warn{font-size:12px;color:#ffd99a;opacity:.95}'
    + '#nbWin .cn-lord{display:grid;grid-template-columns:72px 1fr;gap:4px 14px;border:1px solid #5fd4ff2e;border-left:4px solid #5fd4ff;background:#04131dd9;padding:12px;margin:0 0 12px}#nbWin .cn-lord.warn{border-left-color:#ffb06a}#nbWin .cn-lord.risk{border-left-color:#ff6a5a;box-shadow:0 0 14px #ff6a5a22}#nbWin .cn-lord.gone{opacity:.5;border-left-color:#5a6a72}'
    + '#nbWin .cn-face{grid-row:1/5;width:72px;height:84px;border:1px solid #5fd4ff66;background:#071a26 center/cover no-repeat;display:flex;align-items:center;justify-content:center;color:#5fd4ff88;font-size:26px}'
    + '#nbWin .cn-lord .hd{display:flex;align-items:baseline;gap:10px}#nbWin .cn-lord .nm{font-weight:700;font-size:16px;color:#f2fbff}#nbWin .cn-lord .ly{margin-left:auto;font-size:13px;color:#cfe9f3;white-space:nowrap}#nbWin .cn-lord .ly b{font-size:18px;color:#e6f7ff;margin-left:4px}'
    + '#nbWin .cn-lord .ld{color:#9fc0cc;font-size:12.5px}'
    + '#nbWin .cn-bar{height:7px;background:#5fd4ff1c;position:relative;border-radius:4px;overflow:hidden}#nbWin .cn-bar i{position:absolute;left:0;top:0;bottom:0;background:#5fd4ff}#nbWin .cn-bar.warn i{background:#ffb06a}#nbWin .cn-bar.risk i{background:#ff6a5a}'
    + '#nbWin .cn-trs{display:flex;gap:5px;flex-wrap:wrap}#nbWin .cn-trs span{font-size:12px;padding:1px 8px;border:1px solid #5fd4ff44;color:#cfefff}#nbWin .cn-trs span.neg{border-color:#ff9a6a88;color:#ffc2a0}'
    + '#nbWin .cn-lord .cn-acts{grid-column:1/3;margin-top:6px}#nbWin .cn-flags{display:flex;gap:6px;flex-wrap:wrap}'
    + '#nbWin .cn-ties{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:12px}#nbWin .cn-ties .lb{opacity:.7}#nbWin .cn-ties .t{border:1px solid #5fd4ff44;padding:0 7px}#nbWin .cn-ties .t.u{border-color:#e0577f88;color:#ffd0dc}#nbWin .cn-ties .t.f{opacity:.5;text-decoration:line-through}'
    + '#nbWin .cn-risk{color:#ff9a8a;font-weight:600;font-size:12.5px;border:1px solid #ff6a5a66;background:#ff6a5a14;padding:0 7px}'
    + '#nbWin .cn-log{display:grid;grid-template-columns:78px 1fr;gap:8px;font-size:12.5px;color:#cfe3ea;margin:0;padding:6px 8px;border-left:2px solid #5fd4ff44}#nbWin .cn-log:nth-child(odd){background:#5fd4ff08}#nbWin .cn-log .d{color:#7fa7b6;font-variant-numeric:tabular-nums}#nbWin .cn-log.grave{border-left-color:#ff6a5a;color:#ffe0d8}'
    + '#nbWin .cn-empty{padding:26px 16px;text-align:center;color:#a9c6d2;line-height:1.8;white-space:pre-line;border:1px dashed #5fd4ff33;background:#04131d88}#nbWin .cn-msg{position:sticky;top:0;z-index:3;padding:8px 12px;margin-bottom:10px;background:#2a1a12;border:1px solid #ff9a6a;color:#ffd6c2}';
    document.head.append(st); };

  const pts = (tr) => { let have = 4, used = 0; for (const v of tr) { if (v < 0) have += -v; else used += v; } return { have, used, left: have - used }; };
  let D = null, openForm = null, msg = '';

  async function load() { try { D = await window.sllm.scnCn(); } catch (e) { D = null; } return D; }
  async function act(req, redraw) {
    let r = null; try { r = await window.sllm.scnCnAct(req); } catch (e) { r = { ok: false, error: String(e) }; }
    if (r && r.ok) { D = r; openForm = null; msg = ''; } else msg = (r && r.error) || L('하지 못했습니다.', 'Could not do that.');
    redraw();
  }

  function traitForm(g, redraw) {
    const f = h('div', 'cn-form'), tr = [0, 0, 0, 0, 0];
    const sel = h('select'); const o0 = h('option', '', L('— 앉힐 지도자 —', '— Choose a leader —')); o0.value = ''; sel.append(o0);
    for (const c of D.cands || []) { const o = h('option', '', `${c.name} · ${c.clsName} ${L('레벨', 'Lv')} ${c.lv}`); o.value = c.lid; sel.append(o); }
    f.append(h('div', '', L('우리 지도자 가운데 한 명을 이 땅의 귀족으로 앉힙니다. 접견에서는 그 지도자의 말투(인물 기록)로 말하고, 게임의 지도자 특성은 보지 않습니다.', 'Raise one of our leaders as noble of this land. In audiences they speak in their own recorded voice; in-game leader traits are ignored.')), sel);
    if (!(D.cands || []).length) f.append(h('div', 'cn-warn', L('앉힐 수 있는 지도자가 없습니다. 집무실 「연락처」를 한 번 열어 명단을 받아 오세요(통치자·이미 귀족인 사람은 빠집니다).', 'No leader available. Open Contacts in the office once to fetch the roster (the ruler and current nobles are excluded).')));
    const ptsRow = h('div', 'cn-pts'), axBox = h('div');
    const paint = () => {
      axBox.textContent = ''; const p = pts(tr);
      AXES().forEach((ax, i) => {
        const row = h('div', 'cn-ax'); row.title = ax.tip;
        const seg = h('div', 'seg');
        for (const v of [-2, -1, 0, 1, 2]) {
          const b = h('button', (v < 0 ? 'neg ' : '') + (tr[i] === v ? 'on' : ''), v > 0 ? '+' + v : String(v)); b.type = 'button';
          b.onclick = (e) => { e.stopPropagation(); tr[i] = v; paint(); }; seg.append(b);
        }
        row.append(h('span', '', ax.neg), seg, h('span', '', ax.pos)); axBox.append(row);
      });
      ptsRow.textContent = '';
      const left = h('b', p.left < 0 ? 'bad' : '', String(p.left));
      ptsRow.append(h('span', '', L('남은 점수', 'Points left')), left, h('small', '', L(`받은 점수 ${p.have}(기본 4 + 부정 ${p.have - 4}) · 쓴 점수 ${p.used}`, `Received ${p.have} (base 4 + ${p.have - 4} from flaws) · spent ${p.used}`)));
      ok.disabled = p.left < 0 || !sel.value;
    };
    const ok = h('button', 'go', L('이 성격으로 앉히기', 'Appoint with this personality')); ok.type = 'button';
    ok.onclick = (e) => { e.stopPropagation(); if (!sel.value) return; void act({ a: 'appoint', key: g.key, lid: Number(sel.value), tr: tr.slice() }, redraw); };
    const cancel = h('button', '', L('그만두기', 'Cancel')); cancel.type = 'button'; cancel.onclick = (e) => { e.stopPropagation(); openForm = null; redraw(); };
    sel.onchange = () => paint();
    f.append(h('div', 'cn-warn', L('긍정(+) 칸은 1칸에 1점을 쓰고, 부정(−) 칸은 1칸마다 1점을 더 줍니다. 한 번 찍은 성격은 영구입니다 — 다시 찍을 수 없고 점수를 더 얻을 길도 없습니다.', 'Each positive step costs 1 point; each negative step grants 1 more. The personality is permanent — no respec and no further points.')), axBox, ptsRow);
    const acts = h('div', 'cn-acts'); acts.append(ok, cancel); f.append(acts);
    paint(); return f;
  }

  function groupCard(g, redraw) {
    const c = h('div', 'cn-card' + (g.st === 'pending' ? ' pend' : g.st === 'direct' ? ' dir' : ''));
    const t = h('div', 't'); t.append(h('b', '', g.name), h('span', 'sp'));
    t.append(h('span', 'cn-tag' + (g.st === 'pending' ? ' pend' : g.st === 'direct' ? ' dir' : ''), g.st === 'pending' ? L('처분 대기', 'Awaiting decision') : g.st === 'direct' ? L('직할령', 'Direct rule') : L('귀족 통치', 'Noble rule') + (g.lord ? ` · ${g.lord}` : '')));
    c.append(t);
    const sys = h('div', 'cn-sys'); for (const x of g.sys) sys.append(h('span', '', x.name)); c.append(sys);
    c.append(h('div', 'cn-meta', L(`원래 ${SIDE()[g.side]}의 땅 · 성계 ${g.sys.length}곳 · ${g.since}부터`, `Formerly ${SIDE()[g.side]} · ${g.sys.length} system(s) · since ${g.since}`)));
    let usePrev = null;
    if (g.prev) {
      const p = h('div', 'cn-prev'); const im = h('img'); im.src = g.prev.pic; im.alt = ''; im.onerror = () => im.remove();
      p.append(im, h('span', '', g.prev.alive ? L(`옛 주인 ${g.prev.name} — 살아 있음`, `Former lord ${g.prev.name} — alive`) : L(`옛 주인 ${g.prev.name} — 이제 없음`, `Former lord ${g.prev.name} — gone`)));
      c.append(p);
      if (g.prev.alive && g.st !== 'noble') { const l = h('label'), cb = h('input'); cb.type = 'checkbox'; usePrev = cb; l.append(cb, document.createTextNode(' ' + L(`괴뢰국을 세우면 ${g.prev.name}을(를) 괴뢰 군주로 앉힌다(원래 진영에서는 배신자가 됨)`, `If made a puppet, seat ${g.prev.name} as its ruler (a traitor to their old realm)`))); l.onclick = (e) => e.stopPropagation(); c.append(l); }
    }
    const acts = h('div', 'cn-acts');
    const btn = (txt, cls, fn, tip) => { const b = h('button', cls, txt); b.type = 'button'; if (tip) b.title = tip; b.onclick = (e) => { e.stopPropagation(); fn(); }; acts.append(b); return b; };
    if (g.st !== 'noble') {
      btn(L('우리 귀족 앉히기', 'Appoint one of our own'), 'go', () => { openForm = g.key; redraw(); }, L('정당성이 서서 안정도가 오릅니다. 성격에 따라 충성·배신 위험이 정해집니다.', 'Legitimacy raises stability. Personality decides loyalty and the risk of betrayal.'));
      if (g.canPuppet) btn(L('괴뢰국 세우기', 'Raise a puppet state'), '', async () => { if (await sllmAsk(L(`이 땅을 떼어 ${(D.realm && D.realm.subject) || '회랑의 속국'}으로 만듭니다. 되돌릴 수 없습니다.`, `This land will be split off as a ${(D.realm && D.realm.subject) || 'Corridor subject'}. This cannot be undone.`))) void act({ a: 'puppet', key: g.key, prev: !!(usePrev && usePrev.checked) }, redraw); }, L('땅을 떼어 회랑의 종속국으로', 'Split the land off as a Corridor subject'));
      if (g.st === 'pending') btn(L('직할령으로 두기', 'Keep under direct rule'), '', () => { void act({ a: 'direct', key: g.key }, redraw); }, L('아무도 앉히지 않습니다. 정당성이 없어 안정도가 떨어집니다.', 'Appoint no one. Without legitimacy, stability drops.'));
    }
    c.append(acts);
    if (openForm === g.key) c.append(traitForm(g, redraw));
    return c;
  }

  function lordRow(n, onMeet, redraw) {
    const r = h('div', 'cn-lord' + (n.gone ? ' gone' : n.risk > 0 ? ' risk' : n.warn ? ' warn' : ''));
    const face = h('div', 'cn-face'); if (n.pic) face.style.backgroundImage = `url("${n.pic}")`; else face.textContent = '✦'; r.append(face);
    const hd = h('div', 'hd'); hd.append(h('span', 'nm', n.name));
    if (!n.gone) { const ly = h('span', 'ly', n.word); ly.append(h('b', '', String(n.loyal))); hd.append(ly); } else hd.append(h('span', 'ly', `${GONE()[n.gone] || n.gone} · ${n.goneD || ''}`));
    r.append(hd, h('div', 'ld', n.gone ? n.land : L(`${n.land} · 성계 ${n.sys}곳 · ${n.since}부터`, `${n.land} · ${n.sys} system(s) · since ${n.since}`)));
    if (!n.gone) { const bar = h('div', 'cn-bar' + (n.risk > 0 ? ' risk' : n.warn ? ' warn' : '')); const i = h('i'); i.style.width = n.loyal + '%'; bar.append(i); bar.title = L(`충성 ${n.loyal}/100`, `Loyalty ${n.loyal}/100`); r.append(bar); }
    const row = h('div', 'cn-flags'), trs = h('div', 'cn-trs'); AXES().forEach((ax, i) => { const v = n.tr[i]; if (!v) return; const t = h('span', v < 0 ? 'neg' : '', (v < 0 ? ax.neg : ax.pos) + (Math.abs(v) === 2 ? ' ++' : '')); t.title = ax.tip; trs.append(t); }); if (!trs.childNodes.length) trs.append(h('span', '', L('무난함', 'Balanced'))); row.append(trs);
    if (!n.gone && n.risk > 0) row.append(h('span', 'cn-risk', L(`배신 위험 ${n.risk}%/년`, `Betrayal ${n.risk}%/yr`)));
    if (!n.gone && n.spy) row.append(h('span', 'cn-risk', L(`${n.spy}의 첩자가 곁에 있음`, `A ${n.spy} spy is close by`)));
    r.append(row);
    if (!n.gone && n.ties && n.ties.length) { // 강대국 귀족과의 인연(관계망, 2026-11-08)
      const tr = h('div', 'cn-ties'); tr.append(h('span', 'lb', L('인연', 'Ties')));
      for (const t of n.ties) { const s = h('span', 't' + (t.k === 'union' ? ' u' : '') + (t.fallen ? ' f' : ''), (t.k === 'union' ? '♥ ' : '') + t.name); s.title = t.k === 'union' ? L('정략 혼인 — 해마다 상대의 속마음을 알고, 상대는 자기 군주에게서 조금씩 멀어집니다. 상대가 몰락하면 우리 귀족이 흔들립니다.', 'Political marriage — each year we learn their true loyalty and they drift from their sovereign. If they fall, our noble is shaken.') : L('아는 사이 — 해마다 상대의 속마음(충성)을 알게 됩니다.', 'Acquaintance — each year we learn their true loyalty.'); tr.append(s); }
      r.append(tr);
    }
    if (!n.gone) {
      const acts = h('div', 'cn-acts');
      const m = h('button', 'go', L('접견', 'Audience')); m.type = 'button'; m.onclick = (e) => { e.stopPropagation(); onMeet({ kind: 'cnoble', id: n.lid }); };
      const d = h('button', '', L('물리기', 'Remove')); d.type = 'button'; d.title = L('귀족 자리에서 물립니다. 땅은 직할령이 됩니다.', 'Remove them from their seat. The land falls under direct rule.');
      d.onclick = async (e) => { e.stopPropagation(); if (await sllmAsk(L(`${n.name}을(를) 귀족 자리에서 물립니까? 찍은 성격은 그대로 남고, 다시 앉힐 수 없습니다.`, `Remove ${n.name} from their seat? Their personality stays as it is; they cannot be appointed again.`))) void act({ a: 'dismiss', lid: n.lid }, redraw); };
      acts.append(m, d);
      if (n.spy) { const pu = h('button', '', L(`내부 단속 · 에너지 ${D.purgeCost || 300}`, `Purge · ${D.purgeCost || 300} energy`)); pu.type = 'button'; pu.title = L('첩자를 걷어냅니다. 귀족은 의심받은 것에 조금 언짢아합니다(충성 −2).', 'Root out the spy. The noble is mildly offended (loyalty −2).'); pu.onclick = (e) => { e.stopPropagation(); void act({ a: 'purge', lid: n.lid }, redraw); }; acts.append(pu); }
      r.append(acts);
    }
    return r;
  }

  /** left·right: 세력도의 두 판. opts.meet(target): 접견 열기 · opts.redraw(): 세력도 다시 그리기. */
  async function draw(left, right, opts) {
    css();
    if (!D) { left.append(h('div', 'cn-empty', L('불러오는 중…', 'Loading…'))); await load(); left.textContent = ''; }
    if (window.sllm.peopleRefresh && !draw.asked) { draw.asked = true; window.sllm.peopleRefresh().then(async () => { await load(); opts.redraw(); }).catch(() => {}); }
    const redraw = () => opts.redraw();
    if (!D || !D.ok) { left.append(h('div', 'cn-empty', L('불러오지 못했습니다.', 'Could not load.'))); return; }
    if (!D.seat) { left.append(h('div', 'cn-empty', L('회랑 자리를 맡은 판에서만 우리 귀족을 둘 수 있습니다.', 'Our own nobles exist only when you play the Corridor seat.'))); return; }
    const L1 = h('div', 'cn'), R1 = h('div', 'cn');
    if (msg) L1.append(h('div', 'cn-msg', msg));
    if (!D.live) L1.append(h('div', 'cn-warn', L('게임이 켜져 있고 앱과 이어져 있을 때 처분할 수 있습니다.', 'Decisions need the game running and linked to the app.')));
    { const alive = D.nobles.filter((n) => !n.gone), pend = D.groups.filter((g) => g.st === 'pending').length, risky = alive.filter((n) => n.risk > 0).length, avg = alive.length ? Math.round(alive.reduce((t, n) => t + n.loyal, 0) / alive.length) : 0;
      const sum = h('div', 'cn-sum'); const cell = (v, k, cls) => { const d = h('div', cls || ''); d.append(h('b', '', String(v)), h('small', '', k)); sum.append(d); };
      cell(alive.length, L('우리 귀족', 'Our nobles')); cell(pend, L('처분 대기 땅', 'Land awaiting'), pend ? 'hot' : ''); cell(alive.length ? avg : '—', L('평균 충성', 'Avg. loyalty')); cell(risky, L('배신 위험', 'Betrayal risk'), risky ? 'bad' : ''); L1.append(sum); }
    { const hh = h('h4', '', L('정복지', 'Conquered land')); hh.append(h('span', 'n', `${D.groups.length}`)); L1.append(hh); }
    if (!D.groups.length) L1.append(h('div', 'cn-empty', L('아직 강대국에게서 빼앗은 땅이 없습니다.\n강대국의 성계를 차지하면 여기에서 괴뢰국을 세우거나, 우리 지도자를 귀족으로 앉히거나, 직할령으로 둘 수 있습니다.', 'No land has been taken from the great powers yet.\nOnce you hold their systems, you can raise a puppet state, appoint one of our leaders as noble, or keep it under direct rule here.')));
    for (const g of D.groups) L1.append(groupCard(g, redraw));
    if (D.puppets && D.puppets.length) { L1.append(h('h4', '', L('세운 괴뢰국', 'Puppet states raised'))); for (const p of D.puppets) L1.append(h('div', 'cn-log', `${p.d} · ${p.name}${p.prev ? L(' · 옛 주인이 군주', ' · ruled by its former lord') : ''}`)); }
    { const RN = D.realm || {}; const hh = h('h4', '', RN.nobles || L('회랑의 귀족', 'Corridor nobles')); hh.append(h('span', 'n', `${D.nobles.filter((n) => !n.gone).length}`));
      // 우리 나라 부르는 이름 바꾸기(2026-11-08 사용자: 「OO 직할」·「OO의 귀족」 — 사람마다 자기 제국 이름으로)
      const ed = h('button', 'cn-rn', '\u270E ' + L('이름', 'Name')); ed.type = 'button'; ed.title = L(`지금: 「${RN.rule || '회랑 직할'}」 · 「${RN.nobles || '회랑의 귀족'}」\n누르면 우리 나라를 부르는 이름을 바꿉니다(비우면 게임 속 나라 이름).`, `Now: "${RN.rule || 'Corridor rule'}" · "${RN.nobles || 'Corridor nobles'}"\nClick to change what our realm is called (leave empty for the in-game empire name).`);
      ed.onclick = (e) => { e.stopPropagation(); if (R1.querySelector('.cn-rnrow')) return;
        const row = h('div', 'cn-rnrow'), inp = h('input'); inp.type = 'text'; inp.maxLength = 24; inp.value = RN.own || ''; inp.placeholder = L('비우면 게임 속 나라 이름', 'Empty = in-game empire name');
        const ok = h('button', '', L('바꾸기', 'Apply')), no = h('button', 'ghost', L('그만두기', 'Cancel')); ok.type = no.type = 'button';
        const go = async () => { await act({ a: 'realm', name: inp.value }, redraw); };
        ok.onclick = (ev) => { ev.stopPropagation(); void go(); }; no.onclick = (ev) => { ev.stopPropagation(); row.remove(); };
        inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') void go(); else if (ev.key === 'Escape') row.remove(); };
        row.append(inp, ok, no, h('small', '', L('예: 「헤수카르」 → 「헤수카르 직할」 · 「헤수카르의 귀족」', 'e.g. "Hesukar" → "Hesukar rule" · "Hesukar nobles"'))); hh.after(row); inp.focus(); };
      hh.append(ed); R1.append(hh); }
    if (!D.nobles.length) R1.append(h('div', 'cn-empty', L('아직 앉힌 귀족이 없습니다.\n왼쪽 정복지에서 「우리 귀족 앉히기」를 누르세요.', 'No nobles appointed yet.\nUse "Appoint one of our own" on the conquered land at left.')));
    for (const n of D.nobles) R1.append(lordRow(n, opts.meet, redraw));
    R1.append(h('h4', '', L('기록', 'Record')));
    if (!D.log.length) R1.append(h('div', 'cn-empty', L('기록이 없습니다.', 'Nothing recorded.')));
    for (const l of D.log) { const row = h('div', 'cn-log' + (l.grave ? ' grave' : '')); row.append(h('span', 'd', l.d), h('span', '', l.text)); R1.append(row); }
    left.append(L1); right.append(R1);
  }
  window.SLLMCn = { draw, reset: () => { D = null; openForm = null; msg = ''; draw.asked = false; }, load };
})();
