// 인물 세력판 · 인물 관계도(본편, 2026-11-09 사용자: 「회랑의 인물도를 본편용으로 따로 떼서 — 우리 지도자만, 일단은」 → 「제국세력도의 인물관계도·가문도처럼」).
// 집무실 인물 카드 「인간관계」의 「관계도」 버튼이 연다. 화면 전체를 덮는 홀로그램 판(Esc·「닫기」로 닫음).
//   세력판: 통치자를 가운데 큰 원으로, 알려진 관계로 이어진 지도자들을 「무리」로 묶어 둘레에(관계가 가장 많은 사람이 수장 카드). 이어진 사람이 없으면 「홀로 선 인물」.
//           무리를 누르면 카메라가 그 무리로 날아가 구성원이 펼쳐진다. 끌어서 옮기기 · 휠·버튼으로 확대. 인물을 누르면 오른쪽에 그 사람의 관계.
//   인물 관계도: 고른 인물을 가운데, 바로 이어진 사람(통치자는 늘)을 첫째 둘레에, 그 사람들의 관계를 바깥 둘레에 흐리게. 누르면 그 인물로 옮겨 가며 움직인다.
// 모양만 회랑 제국 세력도(ui/office-nobles.js)를 참고했고 코드·자료는 따로다. 자료: window.sllm.relGraph()(src/features/relations-app.ts → src/relgraph.ts) — 플레이어가 아는 관계만(인물 카드와 같은 규칙).
// 초상화: 이 인물에게 넣어 둔 그림(집무실 「초상화 넣기」)이 있으면 그것, 없으면 직업 표시. 문구는 L(한, 영)만(언어 팩 호환). 게임에 묻는 것 없음.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (el) => { el.setAttribute('data-i18n-skip', ''); return el; }; // 사람 이름은 번역하지 않는다
  const NS = 'http://www.w3.org/2000/svg';
  const COL = { partner: '#ff8fc8', friend: '#7fd0ff', rival: '#ff6a5a', conflict: '#ffb05a', acquaint: '#9fb3c4' };
  const KIND = () => ({ partner: L('연인·배우자', 'Partner'), friend: L('친구', 'Friend'), rival: L('껄끄러운 사이', 'At odds'), conflict: L('갈등', 'Conflict'), acquaint: L('지인', 'Acquaintance') });
  const ROM = () => ({ dating: L('교제 중', 'Dating'), engaged: L('약혼', 'Engaged'), married: L('배우자', 'Spouse') });
  const FRI = () => ({ acquainted: L('아는 사이', 'Acquainted'), friendly: L('친한 사이', 'Friends'), close: L('가까운 사이', 'Close friends') });
  const RIV = () => ({ tense: L('긴장', 'Tense'), rival: L('라이벌', 'Rivals') });
  const CLS = () => ({ commander: ['⚔', L('지휘관', 'Commander')], official: ['✒', L('관료', 'Official')], scientist: ['⚗', L('과학자', 'Scientist')] });

  const css = () => { if (document.getElementById('rgCss')) return; const st = h('style'); st.id = 'rgCss'; st.textContent = ''
    + '#rgWin{position:fixed;inset:0;z-index:9000;background:#02070c;animation:rgIn .2s ease-out both}'
    // 홀로그램 판: 푸른 빛 판 · 주사선 · 모서리 괄호(그림 없이 CSS)
    + '#rgWin .rg-book{position:absolute;inset:0;overflow:hidden;color:#d6f3ff;font-size:13px;line-height:1.45;background:radial-gradient(ellipse at 50% 0%,#1d6f9a33,transparent 60%),radial-gradient(ellipse at 50% 100%,#0e3b5a40,transparent 65%),linear-gradient(180deg,#04121cf2,#061a28ee);border:1px solid #5fd4ff88;box-shadow:0 0 0 1px #5fd4ff22 inset,0 0 38px #2bb8ff44}'
    + '#rgWin .rg-book::before{content:"";position:absolute;inset:0;z-index:9;pointer-events:none;background:repeating-linear-gradient(0deg,#9fe6ff0a 0 1px,transparent 1px 3px);mix-blend-mode:screen}'
    + '#rgWin .rg-book::after{content:"";position:absolute;inset:-1px;z-index:9;pointer-events:none;background:linear-gradient(#7fe0ff,#7fe0ff) 0 0/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 0 0/2px 26px,linear-gradient(#7fe0ff,#7fe0ff) 100% 0/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 100% 0/2px 26px,linear-gradient(#7fe0ff,#7fe0ff) 0 100%/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 0 100%/2px 26px,linear-gradient(#7fe0ff,#7fe0ff) 100% 100%/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 100% 100%/2px 26px;background-repeat:no-repeat}'
    + '#rgWin .rg-top{position:absolute;left:22px;right:22px;top:14px;z-index:8;display:flex;align-items:center;gap:12px}#rgWin h3{margin:0;font-size:18px;color:#8fe4ff;letter-spacing:.08em;text-shadow:0 0 10px #39c4ff88}#rgWin .rg-top small{opacity:.7}#rgWin .rg-top .sp{flex:1}'
    + '#rgWin button{padding:4px 10px;cursor:pointer;font:inherit;font-size:12.5px;background:#3fbfff14;color:#d6f3ff;border:1px solid #5fd4ff77}#rgWin button:hover{background:#3fbfff26}#rgWin button.on{background:#3fbfff44;border-color:#9fe6ff;box-shadow:0 0 8px #39c4ff55}'
    // 세력판(카메라로 움직이는 판)
    + '#rgWin .rg-web{position:absolute;inset:0;overflow:hidden;cursor:grab;background:#02070c}#rgWin .rg-web.drag{cursor:grabbing}'
    + '#rgWin .web-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 35%,#000c 100%)}'
    + '#rgWin .web-dots{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(#9fe6ff1c 1px,transparent 1.5px);background-size:44px 44px}'
    + '#rgWin .web-stage{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0}#rgWin .web-stage.fly{transition:transform .85s cubic-bezier(.2,.8,.2,1)}'
    + '#rgWin .web-stage svg{position:absolute;left:-4000px;top:-4000px;width:8000px;height:8000px;overflow:visible;pointer-events:none}'
    + '#rgWin .wn{position:absolute;left:0;top:0;transition:opacity .5s ease}'
    + '#rgWin .wn.sov{width:220px;margin:-110px 0 0 -110px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;z-index:3}'
    + '#rgWin .wn.sov .disc{overflow:hidden;width:200px;height:200px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:90px;color:#bff0ff;background:radial-gradient(circle at 50% 38%,#16597c,#04121c 72%) center 15%/cover no-repeat;border:3px solid #9fe6ff;box-shadow:0 0 0 10px #5fd4ff12,0 0 0 22px #5fd4ff08,0 0 80px #39c4ffaa;animation:rgSov 5s ease-in-out infinite}'
    + '#rgWin .wn.sov b{font-size:22px;letter-spacing:.12em;color:#dff7ff;text-shadow:0 0 16px #39c4ff;white-space:nowrap}#rgWin .wn.sov small{opacity:.7;white-space:nowrap;font-size:12px}'
    + '@keyframes rgSov{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}'
    + '#rgWin .wn.btitle{z-index:2;pointer-events:none;text-align:center;white-space:nowrap;background:radial-gradient(ellipse,#02070cd9 55%,transparent 75%);padding:6px 0;transform:translate(-50%,-50%)}#rgWin .wn.btitle b{display:block;font-size:16px;letter-spacing:.1em;color:#bff0ff;text-shadow:0 0 12px #39c4ff,0 0 3px #000}#rgWin .wn.btitle span{font-size:11.5px;opacity:.7}'
    + '#rgWin .wn.card{width:96px;margin:-44px 0 0 -48px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font-size:11.5px;text-align:center;z-index:2}'
    + '#rgWin .card .ph{position:relative;width:70px;height:80px;border:1px solid #5fd4ffaa;background:#062234 center 15%/cover no-repeat;box-shadow:0 0 10px #000c;transition:transform .2s;display:flex;align-items:center;justify-content:center;font-size:26px;color:#8fe4ff}'
    + '#rgWin .card:hover .ph{transform:scale(1.1);border-color:#fff}#rgWin .card .nm{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#02070ccc;padding:0 5px;margin-top:3px}#rgWin .card .sub{opacity:.6;font-size:10.5px}'
    + '#rgWin .wn.card.head{width:160px;margin:-96px 0 0 -80px;z-index:3}#rgWin .card.head .ph{width:132px;height:152px;border:2px solid #9fe6ff;box-shadow:0 0 26px #39c4ff66,0 0 0 6px #5fd4ff14;font-size:52px}'
    + '#rgWin .card.head .nm{margin-top:8px;font-size:14px;color:#e6f9ff;max-width:160px}'
    + '#rgWin .card .cn{position:absolute;right:-6px;top:-6px;z-index:2;min-width:18px;height:18px;border-radius:9px;font-size:10.5px;line-height:18px;color:#04121c;font-weight:700;padding:0 3px;background:#8fe4ff;box-shadow:0 0 4px #000}'
    + '#rgWin .card.love .ph::before{content:"♥";position:absolute;right:3px;bottom:3px;width:16px;height:16px;border-radius:50%;background:#e0577f;color:#fff;font-size:10px;line-height:16px;text-align:center;z-index:2}'
    + '#rgWin .card.sel .ph{outline:2px solid #fff;outline-offset:3px;box-shadow:0 0 26px #fff9}#rgWin .wn.fold{opacity:.5}#rgWin .wn.fold .nm,#rgWin .wn.fold .sub{visibility:hidden}#rgWin .wn.fold:hover{opacity:.85}'
    // 연인·배우자는 맞붙인 한 쌍(2026-11-09 사용자: 「연인이나 배우자가 되면 바로 옆에 딱 붙어 있는 초상화」): 분홍 테두리로 함께 감싸고 이음새에 ♥
    + '#rgWin .wn.pairbox{z-index:1;pointer-events:none;border:1px solid #ff8fc8aa;border-radius:4px;box-shadow:0 0 18px #ff8fc855,inset 0 0 14px #ff8fc822;background:#ff8fc80a}'
    + '#rgWin .wn.heart,#rgWin .gheart{z-index:4;pointer-events:none;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#e0577f;color:#fff;font-size:12px;line-height:22px;text-align:center;box-shadow:0 0 0 2px #02070c,0 0 12px #ff8fc8aa}'
    + '#rgWin .wn.hlab,#rgWin .ghlab{z-index:4;pointer-events:none;transform:translate(-50%,-100%);font-size:11px;color:#ffd3e6;background:#02070ccc;padding:0 6px;white-space:nowrap}#rgWin .gheart,#rgWin .ghlab{position:absolute}'
    + '#rgWin .web-ui{position:absolute;left:22px;bottom:16px;z-index:8;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:11.5px;background:#02070cd9;padding:6px 12px;border:1px solid #5fd4ff33}#rgWin .web-ui i{display:inline-block;width:18px;height:3px;margin-right:5px;vertical-align:middle}#rgWin .web-ui i.d{background:repeating-linear-gradient(90deg,#ffb05a 0 5px,transparent 5px 9px)!important}'
    + '#rgWin .web-zoom{position:absolute;right:22px;bottom:16px;z-index:8;display:flex;gap:4px}#rgWin .web-zoom button{min-width:30px;padding:3px 6px}'
    + '#rgWin .web-hint{position:absolute;left:50%;top:58px;transform:translateX(-50%);z-index:8;font-size:12px;opacity:.75;background:#02070cb0;padding:3px 12px;pointer-events:none;white-space:nowrap}'
    + '#rgWin .glab{font-size:12px;fill:#e8eef5;paint-order:stroke;stroke:#02070c;stroke-width:4px}#rgWin .glab.aqn{font-size:11px;fill:#c9d3dc}'
    + '#rgWin svg line.ind{display:none}#rgWin svg line.ind.on{display:inline}#rgWin svg .dim{opacity:.12!important;transition:opacity .25s}#rgWin svg .gl-on{opacity:1!important}#rgWin svg .gl-off{opacity:.07!important}'
    // 오른쪽 상세 칸
    + '#rgWin .rg-det{position:absolute;right:22px;top:64px;bottom:64px;width:min(360px,30vw);z-index:7;overflow:auto;padding:14px 16px;background:#03101af0;border:1px solid #5fd4ff55;box-shadow:0 0 30px #000c;transition:transform .35s ease,opacity .35s ease}'
    + '#rgWin .rg-det.hide{transform:translateX(30px);opacity:0;pointer-events:none}#rgWin .rg-det .x{position:absolute;right:8px;top:6px}'
    + '#rgWin .rg-det .head{display:flex;gap:12px;align-items:center}#rgWin .rg-det .head .ph{width:96px;height:110px;flex:none;border:1px solid #5fd4ff;box-shadow:0 0 14px #39c4ff55;background:#062234 center 15%/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:40px;color:#8fe4ff}'
    + '#rgWin .rg-det b.nm{font-size:16px;color:#e6f9ff}#rgWin .rg-det h4{margin:14px 0 6px;color:#8fe4ff;font-size:13px;border-bottom:1px solid #5fd4ff44;letter-spacing:.04em}'
    + '#rgWin .rg-det .tie{display:flex;align-items:center;gap:8px;padding:4px 2px;cursor:pointer;border-bottom:1px solid #5fd4ff1c}#rgWin .rg-det .tie:hover{background:#3fbfff14}#rgWin .rg-det .tie i{width:10px;height:10px;border-radius:50%;flex:none}#rgWin .rg-det .tie span:last-child{margin-left:auto;opacity:.75;font-size:12px}'
    + '#rgWin .rg-det .none{opacity:.6;font-size:12.5px}#rgWin .rg-det .acts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}'
    // 인물 관계도(고른 인물 가운데)
    + '#rgWin .rg-chart{position:absolute;inset:56px 0 52px 0;overflow:hidden}#rgWin .rg-chart svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'
    + '#rgWin .gn{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;transition:left .5s ease,top .5s ease,opacity .4s ease;z-index:2}'
    + '#rgWin .gn .ph{width:58px;height:66px;border:2px solid #5fd4ff;background:#062234 center 15%/cover no-repeat;box-shadow:0 0 10px #000a;display:flex;align-items:center;justify-content:center;font-size:24px;color:#8fe4ff}'
    + '#rgWin .gn.c .ph{width:104px;height:118px;border-width:3px;box-shadow:0 0 22px #39c4ffaa;font-size:44px}#rgWin .gn.r2 .ph{width:40px;height:46px;opacity:.85;font-size:17px}#rgWin .gn.r2 span{font-size:10.5px;opacity:.75}'
    + '#rgWin .gn span{font-size:11.5px;background:#000b;padding:0 4px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis}#rgWin .gn.c span{font-size:13px;color:#8fe4ff;max-width:110px}'
    + '#rgWin .gn.ruler .ph{border-radius:50%;border-color:#9fe6ff}#rgWin .gn:hover{z-index:5}#rgWin .gn:hover .ph{border-color:#fff}#rgWin .gn.out{opacity:0}'
    + '#rgWin .rg-empty{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);z-index:4;font-size:12.5px;opacity:.8;text-align:center;max-width:70%;background:#02070cb0;padding:4px 12px}'
    + '@keyframes rgIn{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){#rgWin,#rgWin .wn.sov .disc{animation:none}#rgWin .web-stage.fly,#rgWin .gn{transition:none}}';
    document.head.append(st); };

  // ---- 자료 ----
  let D = null, IMG = {}, SAVE = '', win = null, mode = 'board', sel = '', focus = '', center = '';
  const byPid = (pid) => (D ? D.nodes.find((n) => n.pid === pid) : null);
  const edgesOf = (pid) => D.edges.filter((e) => e.a === pid || e.b === pid);
  const near = (pid) => edgesOf(pid).map((e) => (e.a === pid ? e.b : e.a));
  /** 진한 관계(지인만인 선 빼고) — 세력판 무리는 이것으로만 묶는다(지인까지 묶으면 다 한 덩어리가 된다). */
  const nearStrong = (pid) => edgesOf(pid).filter((e) => e.kinds.some((k) => k !== 'acquaint')).map((e) => (e.a === pid ? e.b : e.a));
  const edgeOf = (a, b) => D.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  /** 연인·배우자(교제·약혼·결혼). 없으면 ''. */
  const mateOf = (pid) => { const e = pid && D.edges.find((x) => (x.a === pid || x.b === pid) && x.kinds.includes('partner')); return e ? (e.a === pid ? e.b : e.a) : ''; };
  let JOIN = []; // 맞붙여 놓은 짝 [a, b] — 둘 사이에는 선 대신 ♥
  const joined = (a, b) => JOIN.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const label = (e) => e.kinds.map((k) => (k === 'partner' ? ROM()[e.romance] || KIND().partner : k === 'friend' ? FRI()[e.friend] || KIND().friend : k === 'acquaint' ? FRI().acquainted : k === 'rival' ? RIV()[e.rival] || KIND().rival : KIND().conflict)).join(' · ');
  const dashed = (e) => e.kinds.includes('conflict') || e.romance === 'dating';
  function pic(n) { const lid = /^p:(\d+)$/.exec(n.pid)?.[1]; return lid && SAVE ? IMG['person:' + SAVE + ':' + lid] || '' : ''; }
  function face(el, n) { const u = pic(n); if (u) el.style.backgroundImage = `url("${u}")`; else { const c = CLS()[n.cls]; el.textContent = n.ruler ? '★' : c ? c[0] : '●'; } return el; }
  const roleOf = (n) => (n.ruler ? L('통치자', 'Ruler') : (CLS()[n.cls] || [, ''])[1] + (n.council ? ' · ' + L('평의회', 'Council') : ''));

  /** 무리: 통치자를 뺀 지도자를 알려진 관계로 이어진 덩어리로. 수장 = 무리 안 관계가 가장 많은 사람. 이어진 사람이 없으면 「홀로 선 인물」 한 무리. */
  function groups() {
    // 통치자의 짝은 통치자 옆에 서므로 무리에서 뺀다. 그 짝을 통해서만 이어진 사람들은 「○○ 곁의 무리」로 남긴다(홀로 선 인물이 아니다).
    const rm = mateOf(D.ruler), rest = D.nodes.filter((n) => n.pid !== D.ruler), seen = new Set(), out = [], solo = [];
    for (const n of rest) {
      if (seen.has(n.pid)) continue;
      let comp = [], st = [n.pid]; seen.add(n.pid);
      while (st.length) { const p = st.pop(); comp.push(p); for (const q of nearStrong(p)) if (q !== D.ruler && !seen.has(q)) { seen.add(q); st.push(q); } }
      const via = rm && comp.includes(rm) ? rm : ''; if (via) comp = comp.filter((p) => p !== rm);
      if (!comp.length) continue;
      if (comp.length === 1 && !via) { solo.push(comp[0]); continue; }
      const deg = (p) => nearStrong(p).filter((q) => comp.includes(q)).length;
      comp.sort((x, y) => deg(y) - deg(x) || byPid(x).name.localeCompare(byPid(y).name));
      out.push({ key: comp[0], head: comp[0], members: comp.slice(1), via });
    }
    out.sort((x, y) => y.members.length - x.members.length || byPid(x.head).name.localeCompare(byPid(y.head).name));
    if (solo.length) out.push({ key: 'solo', head: null, members: solo.sort((x, y) => byPid(x).name.localeCompare(byPid(y).name)) });
    return out;
  }
  /** 판 위 자리(세계 좌표): 통치자 (0,0), 무리는 둘레에, 구성원은 수장 둘레에(통치자 반대쪽으로 부채꼴). */
  function webLayout(G) {
    const pos = new Map(); pos.set(D.ruler, [0, 0]); JOIN = [];
    // 통치자의 짝은 통치자와 같은 큰 원으로 나란히(2026-11-09 사용자: 「플레이어의 연인·배우자면 플레이어와 똑같은 크기 — 너무 딱 붙지 않게」). 둘이 판 가운데에 오게
    const rm = mateOf(D.ruler); if (rm && byPid(rm)) { pos.set(D.ruler, [-120, 0]); pos.set(rm, [120, 0]); JOIN.push([D.ruler, rm]); }
    // 통치자(또는 그 짝)와 알려진 관계가 있는 무리만 가까운 둘레에. 관계가 없는 무리·홀로 선 인물은 바깥 둘레에 따로(선 없음) — 2026-11-09 사용자: 「안 친한 관계는 선 없이 따로, 그래도 다 나와야」
    const tied = (g) => [g.head, ...g.members].some((p) => p && (edgeOf(p, D.ruler) || (rm && edgeOf(p, rm))));
    // 무리 순서(2026-11-09 사용자: 「줄이 난잡 — 지인 많은 인물 위주로 통합」): 서로 많이 아는 무리끼리 이웃하게(선이 짧고 덜 엇갈리게)
    const gm = (g) => [g.head, ...g.members].filter(Boolean), gw = (g1, g2) => { const A = new Set(gm(g1)), B = new Set(gm(g2)); return D.edges.filter((e) => (A.has(e.a) && B.has(e.b)) || (A.has(e.b) && B.has(e.a))).length; };
    const T0 = G.filter(tied), T = T0.length ? [T0.shift()] : [];
    while (T0.length) { const last = T[T.length - 1]; let bi = 0, bw = -1; T0.forEach((g, i) => { const w = gw(last, g); if (w > bw) { bw = w; bi = i; } }); T.push(T0.splice(bi, 1)[0]); }
    const U = G.filter((g) => !tied(g)), R0 =Math.max(470, T.length * 150) + (rm ? 130 : 0), R2 = T.length ? R0 + Math.max(420, U.length * 60) : R0;
    const ringPos = new Map(), TA = T.map((g, i) => -Math.PI / 2 + (i / T.length) * Math.PI * 2); T.forEach((g, i) => ringPos.set(g, [R0, TA[i]]));
    if (!T.length) U.forEach((g, i) => ringPos.set(g, [R2, -Math.PI / 2 + (i / U.length) * Math.PI * 2]));
    else { // 바깥 무리는 가까운 무리들 사이의 빈 방향에(겹치지 않게): 틈마다 고르게 나눠 담는다
      const gaps = TA.map((x, i) => [x, (i + 1 < TA.length ? TA[i + 1] : TA[0] + Math.PI * 2)]), per = gaps.map(() => []);
      // 바깥 무리는 가장 많이 아는 가까운 무리 곁의 틈으로(고르게 나누되 지인 쪽을 먼저)
      U.forEach((g) => { let bj = 0, bs = -1e9; gaps.forEach((_, j) => { const s = gw(g, T[j]) + gw(g, T[(j + 1) % T.length]) - per[j].length * 0.6; if (s > bs) { bs = s; bj = j; } }); per[bj].push(g); });
      per.forEach((list, j) => { const [g0, g1] = gaps[j]; list.forEach((g, k) => ringPos.set(g, [R2, g0 + ((k + 1) / (list.length + 1)) * (g1 - g0)])); });
    }
    G.forEach((g) => {
      const [R, a] = ringPos.get(g), gx = Math.cos(a) * R, gy = Math.sin(a) * R; g.at = [gx, gy]; g.far = !tied(g);
      if (g.head) pos.set(g.head, [gx, gy]);
      const hm = g.head ? mateOf(g.head) : ''; if (hm && g.members.includes(hm)) { pos.set(hm, [gx + 160, gy]); JOIN.push([g.head, hm]); g.hmate = hm; } else g.hmate = ''; // 수장의 짝은 수장 카드 바로 옆
      const slots = [], done = new Set([hm]); // 구성원 자리: 짝끼리는 한 자리에 둘
      for (const p of g.members) { if (done.has(p)) continue; done.add(p); const q = mateOf(p); if (q && g.members.includes(q) && !done.has(q)) { done.add(q); slots.push([p, q]); JOIN.push([p, q]); } else slots.push([p]); }
      const m = slots.length, wide = slots.some((x) => x.length > 1) ? 1.25 : 1, rr = g.head ? Math.max(240, 30 * m * wide + 150) + (g.hmate ? 120 : 0) : Math.max(120, 24 * m * wide + 70); // 수장 곁에 같은 크기 짝이 서면 구성원은 더 바깥으로
      const span = g.head ? Math.min(Math.PI * 1.6, Math.max(Math.PI * 0.7, m * 0.42 * wide)) : Math.PI * 2, start = a - span / 2;
      slots.forEach((sl, j) => { const b = g.head ? (m === 1 ? a : start + (j / (m - 1)) * span) : a + (j / m) * Math.PI * 2, sx = gx + Math.cos(b) * rr, sy = gy + Math.sin(b) * rr;
        if (sl.length === 1) pos.set(sl[0], [sx, sy]); else { pos.set(sl[0], [sx - 48, sy]); pos.set(sl[1], [sx + 48, sy]); } }); // 짝 사이 틈 ♥ 자리
      g.title = g.head ? [gx - Math.cos(a) * 165, gy - Math.sin(a) * 165] : [gx, gy]; // 이름표는 수장과 통치자 사이(구성원은 바깥쪽 부채꼴)
    });
    return pos;
  }

  // ---- 세력판 ----
  let cam = { x: 0, y: 0, s: 1 }, POS = null, G = null, stage = null, web = null, BG = new Map(); // BG: 사람 → 무리 열쇠(묶음 선)
  /** 세력판에서 고른 인물의 선만 밝히고, 그 사람의 무리 사이 지인 선은 묶음에서 풀어 보인다. pid '' = 원래대로. */
  function lightBoard(pid) {
    const svg = stage && stage.querySelector('svg'); if (!svg) return;
    for (const el of svg.children) { const on = !!pid && (el.dataset.a === pid || el.dataset.b === pid), cl = el.classList;
      if (cl.contains('ind')) { cl.toggle('on', on); continue; }
      cl.toggle('dim', !!pid && (!on || cl.contains('bun') || cl.contains('aqn'))); }
  }
  const applyCam = (fly) => { if (!stage) return; stage.classList.toggle('fly', !!fly); stage.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`; };
  function fitAll(fly) {
    const W = web.clientWidth, H = web.clientHeight; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of POS.values()) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    x0 -= 150; x1 += 150; y0 -= 200; y1 += 150; const s = Math.max(0.3, Math.min(1, (W - 60) / (x1 - x0), (H - 140) / (y1 - y0)));
    cam = { s, x: W / 2 - ((x0 + x1) / 2) * s, y: H / 2 + 20 - ((y0 + y1) / 2) * s }; applyCam(fly);
  }
  function flyTo(x, y, s, fly = true) { const W0 = web.clientWidth, W = W0 - (sel ? Math.min(360, W0 * 0.3) : 0), H = web.clientHeight; cam = { s, x: W / 2 - x * s, y: H / 2 + 20 - y * s }; applyCam(fly); }
  function setFocus(key) {
    focus = key; const g = G.find((x) => x.key === key);
    for (const el of stage.querySelectorAll('.wn[data-g]')) { const gk = el.dataset.g; el.classList.toggle('fold', !!focus && gk !== focus && gk !== 'ruler'); }
    if (!g) { fitAll(true); return; }
    // 무리 전체(수장·구성원·이름표)가 화면에 들어오게(오른쪽 상세 칸 자리는 빼고)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const grow = (x, y, w, hh) => { x0 = Math.min(x0, x - w); x1 = Math.max(x1, x + w); y0 = Math.min(y0, y - hh); y1 = Math.max(y1, y + hh); };
    if (g.head) grow(g.at[0], g.at[1], 90, 120); if (g.hmate) { const [x, y] = POS.get(g.hmate); grow(x, y, 90, 120); } for (const p of g.members) { const [x, y] = POS.get(p); grow(x, y, 70, 70); } grow(g.title[0], g.title[1], 120, 30);
    const W0 = web.clientWidth, W = W0 - (sel ? Math.min(380, W0 * 0.3) : 0), H = web.clientHeight - 150, s = Math.max(0.35, Math.min(1, (W - 80) / (x1 - x0), H / (y1 - y0)));
    cam = { s, x: W / 2 - ((x0 + x1) / 2) * s, y: 75 + H / 2 - ((y0 + y1) / 2) * s }; applyCam(true);
  }
  function card(n, head, gkey) {
    const el = h('div', 'wn card' + (head ? ' head' : '')); el.dataset.g = gkey; el.dataset.p = n.pid;
    const ph = face(h('div', 'ph'), n), ties = near(n.pid).length;
    if (ties) ph.append(h('b', 'cn', String(ties)));
    const mt = mateOf(n.pid); if (mt && !joined(n.pid, mt)) el.classList.add('love'); // 맞붙지 않은 짝만 ♥ 표지
    el.append(ph, skip(h('div', 'nm', n.name)), h('div', 'sub', roleOf(n)));
    el.onclick = (ev) => { ev.stopPropagation(); if (moved) return; select(n.pid); if (focus !== gkey) setFocus(gkey); };
    return el;
  }
  let moved = false;
  function board(host) {
    G = groups(); POS = webLayout(G);
    web = h('div', 'rg-web'); web.append(h('div', 'web-dots')); stage = h('div', 'web-stage'); web.append(stage, h('div', 'web-vig')); host.append(web);
    const svg = document.createElementNS(NS, 'svg'); stage.append(svg);
    const P = (pid) => { const p = POS.get(pid); return p ? [p[0] + 4000, p[1] + 4000] : null; };
    const line = (a, b, col, w, op, dash, cls) => { const p = P(a), q = P(b); if (!p || !q) return; const ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', p[0]); ln.setAttribute('y1', p[1]); ln.setAttribute('x2', q[0]); ln.setAttribute('y2', q[1]); ln.setAttribute('stroke', col); ln.setAttribute('stroke-width', w); ln.setAttribute('opacity', op); if (dash) ln.setAttribute('stroke-dasharray', dash); if (cls) ln.setAttribute('class', cls); ln.dataset.a = a; ln.dataset.b = b; svg.append(ln); return [p, q, ln]; };
    const text = (x, y, txt, a, b, cls) => { const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'glab' + (cls ? ' ' + cls : '')); t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', 'middle'); t.textContent = txt; t.dataset.a = a; t.dataset.b = b; svg.append(t); };
    // (통치자와 무리를 잇던 흐린 줄기는 없앴다 — 선은 알려진 관계에만)
    // 무리 사이의 지인 선은 무리마다 지인이 가장 많은 사람끼리 한 줄로 묶는다(2026-11-09 사용자: 「줄이 난잡 — 지인 많은 인물 위주로 통합」). 인물을 누르면 그 사람 것만 풀어 보인다(lightBoard).
    BG = new Map(); for (const g of G) for (const p of [g.head, ...g.members]) if (p) BG.set(p, g.key === 'solo' ? 'solo:' + p : g.key);
    BG.set(D.ruler, 'ruler'); const rm0 = mateOf(D.ruler); if (rm0) BG.set(rm0, 'ruler');
    const aqOnly = (e) => e.kinds.length === 1 && e.kinds[0] === 'acquaint', aqDeg = (p) => edgesOf(p).filter(aqOnly).length;
    const hubOf = (k) => { let best = '', bd = -1; for (const [p, gk] of BG) if (gk === k) { const d = aqDeg(p) + (p === D.ruler || G.some((g) => g.head === p) ? 0.5 : 0); if (d > bd) { bd = d; best = p; } } return best; };
    const bundles = new Map(), boxes = []; // boxes: 선 이름표끼리 겹치면 선을 따라 비켜 놓는다
    for (const e of D.edges) {
      if (joined(e.a, e.b)) continue; // 맞붙은 짝은 선 대신 ♥
      const ka = BG.get(e.a), kb = BG.get(e.b);
      if (aqOnly(e) && ka && kb && ka !== kb) { const k = [ka, kb].sort().join('#'); if (!bundles.has(k)) bundles.set(k, []); bundles.get(k).push(e); line(e.a, e.b, '#dfe9f1', 1.8, 0.9, null, 'ind'); continue; } // 풀어 볼 때만 보이는 실제 선
      const thin = e.kinds[0] === 'acquaint', pq = line(e.a, e.b, COL[e.kinds[0]] || '#c9c9c9', thin ? 1.4 : 2.6, thin ? 0.55 : 0.85, dashed(e) ? '8 6' : null); if (!pq) continue;
      if (thin) continue; // 지인 선은 이름표 없이(회색 가는 선 = 범례 「지인」)
      const [p, q] = pq, txt = label(e), w = txt.length * 12 + 10;
      let at = null; for (const f of [0.5, 0.36, 0.64, 0.26, 0.74]) { const x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f - 5; if (!boxes.some((b) => Math.abs(b[0] - x) < (b[2] + w) / 2 && Math.abs(b[1] - y) < 16)) { at = [x, y]; break; } }
      at ??= [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 5]; boxes.push([at[0], at[1], w]);
      text(at[0], at[1], txt, e.a, e.b);
    }
    for (const [k, list] of bundles) { // 묶음 선: 지인 수만큼 굵게, 2쌍 이상이면 「지인 n」
      const [ka, kb] = k.split('#'), ha = hubOf(ka), hb = hubOf(kb), n = list.length, pq = ha && hb && ha !== hb && line(ha, hb, COL.acquaint, n > 1 ? 1.6 + Math.min(n - 2, 3) * 0.8 : 1, n > 1 ? 0.6 + Math.min(n, 4) * 0.05 : 0.28, null, 'bun'); if (!pq) continue;
      pq[2].dataset.ka = ka; pq[2].dataset.kb = kb;
      if (n > 1) { const [p, q] = pq, x = (p[0] + q[0]) / 2, y = (p[1] + q[1]) / 2 - 4; if (!boxes.some((b) => Math.abs(b[0] - x) < (b[2] + 60) / 2 && Math.abs(b[1] - y) < 16)) { boxes.push([x, y, 60]); text(x, y, L(`지인 ${n}`, `${n} acq.`), ha, hb, 'aqn'); } }
    }
    // 통치자(큰 원)
    const r = byPid(D.ruler);
    const disc = (n, sub) => { const sv = h('div', 'wn sov'), [x, y] = POS.get(n.pid) || [0, 0]; sv.dataset.p = n.pid; sv.append(face(h('div', 'disc'), n), skip(h('b', '', n.name)), h('small', '', sub)); sv.style.left = x + 'px'; sv.style.top = y + 'px'; sv.onclick = (ev) => { ev.stopPropagation(); if (moved) return; select(n.pid); setFocus(''); }; stage.append(sv); };
    if (r) disc(r, L('통치자', 'Ruler'));
    const rmt = mateOf(D.ruler), re = rmt && edgeOf(D.ruler, rmt); if (rmt && byPid(rmt) && re) disc(byPid(rmt), L(`통치자의 ${ROM()[re.romance] || KIND().partner}`, `Ruler’s ${(ROM()[re.romance] || KIND().partner).toLowerCase()}`)); // 통치자의 짝: 같은 크기 원
    // 맞붙은 짝: 함께 감싸는 분홍 테두리 · 이음새의 ♥ · 사이 이름(교제 중·약혼·배우자)
    const box = (pid) => { const p = POS.get(pid); if (!p) return null; if (pid === D.ruler || pid === rmt) return [p[0], p[1] - 10, 103, 103]; const hd = G.some((g) => g.head === pid || g.hmate === pid); return hd ? [p[0], p[1] - 20, 68, 78] : [p[0], p[1] - 4, 36, 41]; };
    for (const [a, b] of JOIN) {
      const A = box(a), B = box(b), e = edgeOf(a, b); if (!A || !B || !e) continue;
      const gk = a === D.ruler ? 'ruler' : (G.find((g) => g.head === a || g.members.includes(a)) || { key: 'ruler' }).key;
      const [L1, R1] = A[0] < B[0] ? [A, B] : [B, A], sx = (L1[0] + L1[2] + R1[0] - R1[2]) / 2, sy = Math.max(L1[1], R1[1]), top = Math.min(L1[1] - L1[3], R1[1] - R1[3]);
      if (a !== D.ruler) { const pb = h('div', 'wn pairbox'); pb.dataset.g = gk; const x0 = L1[0] - L1[2] - 6, x1 = R1[0] + R1[2] + 6, y0 = top - 6, y1 = Math.max(L1[1] + L1[3], R1[1] + R1[3]) + 6; Object.assign(pb.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' }); stage.append(pb); }
      const ht = h('div', 'wn heart', '♥'); ht.dataset.g = gk; ht.style.left = sx + 'px'; ht.style.top = sy + 'px';
      const hl = h('div', 'wn hlab', label(e)); hl.dataset.g = gk; hl.style.left = sx + 'px'; hl.style.top = (top - 8) + 'px'; stage.append(ht, hl);
    }
    // 무리 제목 · 카드
    for (const g of G) {
      const t = h('div', 'wn btitle'), hn = g.head ? byPid(g.head).name : '';
      const vn = g.via ? byPid(g.via).name : '';
      t.append(skip(h('b', '', g.via ? L(`${vn} 곁의 무리`, `Around ${vn}`) : g.head ? L(`${hn}의 무리`, `Circle of ${hn}`) : L('홀로 선 인물', 'Standing alone'))), h('span', '', (g.via ? L('통치자의 짝과 이어짐', 'Tied to the ruler’s partner') : g.head ? L('알려진 관계로 이어짐', 'Bound by known ties') : L('진한 관계 없음(지인만)', 'No close ties (acquaintances only)')) + ' · ' + L(`${g.members.length + (g.head ? 1 : 0)}명`, `${g.members.length + (g.head ? 1 : 0)}`)));
      t.style.left = g.title[0] + 'px'; t.style.top = g.title[1] + 'px'; stage.append(t);
      if (g.head) { const el = card(byPid(g.head), true, g.key); el.style.left = g.at[0] + 'px'; el.style.top = g.at[1] + 'px'; stage.append(el); }
      // 수장의 짝은 수장과 같은 크기 카드
      for (const p of g.members) { const [x, y] = POS.get(p), el = card(byPid(p), p === g.hmate, g.key); el.style.left = x + 'px'; el.style.top = y + 'px'; stage.append(el); }
    }
    // 끌어서 옮기기 · 휠 확대
    let drag = null;
    web.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; moved = false; web.classList.add('drag'); stage.classList.remove('fly'); });
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    function onMove(e) { if (!drag || !web.isConnected) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; cam.x = drag.cx + dx; cam.y = drag.cy + dy; applyCam(false); }
    function onUp() { if (!drag) return; drag = null; web.classList.remove('drag'); setTimeout(() => { moved = false; }, 0); }
    web.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    web.addEventListener('click', () => { if (moved) return; if (sel) select(''); });
    const zoomAt = (px, py, f) => { const br = web.getBoundingClientRect(), x = px - br.left, y = py - br.top, s = Math.max(0.25, Math.min(2.2, cam.s * f)); cam.x = x - ((x - cam.x) / cam.s) * s; cam.y = y - ((y - cam.y) / cam.s) * s; cam.s = s; applyCam(false); };
    const zm = h('div', 'web-zoom'), zb = (t, fn, tip) => { const b = h('button', '', t); b.type = 'button'; b.title = tip; b.onclick = (e) => { e.stopPropagation(); fn(); }; zm.append(b); };
    zb('+', () => { const br = web.getBoundingClientRect(); zoomAt(br.left + br.width / 2, br.top + br.height / 2, 1.25); }, L('확대', 'Zoom in'));
    zb('−', () => { const br = web.getBoundingClientRect(); zoomAt(br.left + br.width / 2, br.top + br.height / 2, 1 / 1.25); }, L('축소', 'Zoom out'));
    zb('⤢', () => { select(''); setFocus(''); }, L('전체 보기', 'Show all'));
    host.append(zm, h('div', 'web-hint', L('무리를 누르면 그쪽으로 날아갑니다 · 끌어서 옮기기 · 휠로 확대', 'Click a circle to fly to it · Drag to pan · Wheel to zoom')));
    requestAnimationFrame(() => { fitAll(false); if (sel) { const g = G.find((x) => x.head === sel || x.members.includes(sel)); if (g) setFocus(g.key); } });
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }

  // ---- 오른쪽 상세 칸 ----
  function select(pid) {
    sel = pid; const det = win && win.querySelector('.rg-det'); if (!det) return;
    for (const el of win.querySelectorAll('.wn.card')) el.classList.toggle('sel', el.dataset.p === pid);
    if (mode === 'board') lightBoard(byPid(pid) ? pid : '');
    const n = byPid(pid); if (!n) { det.classList.add('hide'); return; }
    det.classList.remove('hide'); det.textContent = '';
    const x = h('button', 'x', '✕'); x.type = 'button'; x.title = L('닫기', 'Close'); x.onclick = (e) => { e.stopPropagation(); select(''); }; det.append(x);
    const hd = h('div', 'head'), info = h('div'); info.append(skip(h('b', 'nm', n.name)), h('div', '', roleOf(n)), ...(n.lv ? [h('div', '', L(`기술 수준 ${n.lv}`, `Level ${n.lv}`))] : [])); hd.append(face(h('div', 'ph'), n), info); det.append(hd);
    det.append(h('h4', '', L('알려진 관계', 'Known relationships')));
    const ties = edgesOf(pid);
    if (!ties.length) det.append(h('div', 'none', L('알려진 관계가 아직 없습니다. 사교회나 만남 주선으로 관계가 생기면 여기에 보입니다.', 'No known relationships yet. Ties formed at social gatherings or arranged meetings will show here.')));
    for (const e of ties) {
      const o = byPid(e.a === pid ? e.b : e.a); if (!o) continue;
      const row = h('div', 'tie'), dot = h('i'); dot.style.background = COL[e.kinds[0]];
      row.append(dot, skip(h('span', '', o.name)), h('span', '', label(e))); row.title = L('이 인물 보기', 'View this person');
      row.onclick = () => { if (mode === 'chart') { center = o.pid; drawChart(); } select(o.pid); if (mode === 'board') { const g = G.find((y) => y.head === o.pid || y.members.includes(o.pid)); if (g && g.key !== focus) setFocus(g.key); } };
      det.append(row);
    }
    const acts = h('div', 'acts');
    if (mode === 'board') { const b = h('button', '', L('🕸 인물 관계도로 보기', '🕸 View in the chart')); b.type = 'button'; b.onclick = () => { center = pid; setMode('chart'); }; acts.append(b); }
    det.append(acts);
  }

  // ---- 인물 관계도(고른 인물 가운데) ----
  let hov = ''; // 관계도에서 마우스를 올린 인물
  function hover(pid) { hov = pid; const svg = win && win.querySelector('.rg-chart svg'); if (!svg) return; for (const el of svg.children) { const on = el.dataset.a === pid || el.dataset.b === pid; el.classList.toggle('gl-on', !!pid && on && el.tagName !== 'text'); el.classList.toggle('gl-off', !!pid && !on); } }
  let chartNodes = new Map(), anim = 0, SIZE = new Map(); // SIZE: 그릴 크기(0 가운데 · 1 첫째 둘레 · 2 바깥) — 짝은 상대와 같게
  function rings(c) {
    const r1 = new Set(near(c));
    const r2 = new Set(); for (const p of r1) for (const q of near(p)) if (q !== c && !r1.has(q)) r2.add(q);
    const shown = new Set([c, ...r1, ...r2]);
    // 통치자가 이 둘레와 이어져 있지 않으면 선 없이 한쪽 구석에 따로(짝이 있으면 함께)
    const apart = []; if (D.ruler && byPid(D.ruler) && !shown.has(D.ruler)) { apart.push(D.ruler); const m = mateOf(D.ruler); if (m && !shown.has(m)) apart.push(m); }
    return { r1: [...r1], r2: [...r2], apart, edges: D.edges.filter((e) => shown.has(e.a) && shown.has(e.b)) }; // 나온 사람들끼리의 관계는 모두(바깥 둘레끼리도)
  }
  function chartLayout(R, W, H) {
    const pos = new Map(), cx = W / 2, cy = H / 2, rx1 = Math.min(W * 0.26, 330), ry1 = Math.min(H * 0.27, 200), rx2 = Math.min(W * 0.42, 560), ry2 = Math.min(H * 0.43, 320);
    pos.set(center, [cx, cy]); JOIN = []; SIZE = new Map([[center, 0]]);
    const cm = mateOf(center); if (cm && R.r1.includes(cm)) { pos.set(center, [cx - 67, cy]); pos.set(cm, [cx + 67, cy]); JOIN.push([center, cm]); SIZE.set(cm, 0); } // 가운데 인물의 짝은 같은 크기로 옆에(둘이 가운데)
    const slots = [], done = new Set([cm]);
    for (const p of R.r1) { if (done.has(p)) continue; done.add(p); const q = mateOf(p); if (q && R.r1.includes(q) && !done.has(q)) { done.add(q); slots.push([p, q]); JOIN.push([p, q]); } else slots.push([p]); }
    { // 첫째 둘레 순서(2026-11-09 사용자: 「줄이 난잡」): 서로 아는 사람끼리 이웃하게 — 관계가 가장 많은 사람부터 이어 붙인다
      const sw = (s1, s2) => s1.reduce((t, p) => t + s2.filter((q) => edgeOf(p, q)).length, 0), deg = (sl) => sl.reduce((t, p) => t + near(p).length, 0);
      const rest = slots.splice(0).sort((x, y) => deg(y) - deg(x)); if (rest.length) slots.push(rest.shift());
      while (rest.length) { const last = slots[slots.length - 1]; let bi = 0, bw = -1; rest.forEach((sl, i) => { const w = sw(last, sl) * 10 + deg(sl); if (w > bw) { bw = w; bi = i; } }); slots.push(rest.splice(bi, 1)[0]); }
    }
    const n1 = Math.max(1, slots.length), a0 = -Math.PI / 2 + (n1 % 2 === 0 ? Math.PI / n1 : 0);
    slots.forEach((sl, i) => { const a = a0 + (i / n1) * Math.PI * 2, sx = cx + Math.cos(a) * rx1, sy = cy + Math.sin(a) * ry1; if (sl.length === 1) pos.set(sl[0], [sx, sy]); else { pos.set(sl[0], [sx - 43, sy]); pos.set(sl[1], [sx + 43, sy]); } });
    for (const p of R.r2) { const q = mateOf(p); if (q && pos.has(q) && q !== center && !JOIN.some(([x, y]) => x === q || y === q)) { const [qx, qy] = pos.get(q); pos.set(p, [qx + (qx >= cx ? 86 : -86), qy]); JOIN.push([q, p]); SIZE.set(p, 1); } } // 짝과 같은 크기 // 바깥 둘레 사람도 짝이 첫째 둘레에 있으면 그 옆에
    // 바깥 둘레: 아는 첫째 둘레 사람들의 한가운데 방향에(여럿을 아는 사람일수록 그 사이에) — 그다음 서로 겹치지 않게 벌린다
    const ang = (q) => { const pp = pos.get(q); return Math.atan2((pp[1] - cy) / ry1, (pp[0] - cx) / rx1); }, out = [];
    for (const p of R.r2) { if (pos.has(p)) continue; const ns = R.r1.filter((q) => pos.has(q) && edgeOf(p, q)); let sx = 0, sy = 0; for (const q of ns) { sx += Math.cos(ang(q)); sy += Math.sin(ang(q)); } out.push([p, ns.length ? Math.atan2(sy, sx) : 0]); }
    if (out.length) { const gap = Math.min(0.34, (Math.PI * 2) / out.length); out.sort((x, y) => x[1] - y[1]);
      for (let pass = 0; pass < 6; pass++) for (let i = 0; i < out.length; i++) { const j = (i + 1) % out.length; let d = out[j][1] - out[i][1]; if (j === 0) d += Math.PI * 2; if (out.length > 1 && d < gap) { const m = (gap - d) / 2; out[i][1] -= m; out[j][1] += m; } }
      for (const [p, a] of out) pos.set(p, [cx + Math.cos(a) * rx2, cy + Math.sin(a) * ry2]); }
    for (const [k, [x, y]] of pos) pos.set(k, [Math.max(70, Math.min(W - 70, x)), Math.max(70, Math.min(H - 50, y))]);
    R.apart.forEach((p, i) => { pos.set(p, [70 + i * 86, 70]); SIZE.set(p, 1); }); if (R.apart.length === 2) JOIN.push([R.apart[0], R.apart[1]]); // 따로 선 통치자(선 없음)
    return pos;
  }
  function drawChart() {
    const st = win && win.querySelector('.rg-chart'); if (!st || !byPid(center)) return;
    st.querySelector('.rg-empty')?.remove();
    const R = rings(center), keep = new Set([center, ...R.r1, ...R.r2, ...R.apart]), W = st.clientWidth - (sel ? Math.min(380, st.clientWidth * 0.3) : 0), H = st.clientHeight, pos = chartLayout(R, W, H);
    const ringOf = (p) => (p === center ? 0 : R.r1.includes(p) ? 1 : 2);
    for (const [k, v] of chartNodes) if (!keep.has(k)) { v.classList.add('out'); setTimeout(() => v.remove(), 420); chartNodes.delete(k); }
    for (const p of keep) {
      const n = byPid(p); if (!n) continue; const [tx, ty] = pos.get(p), old = chartNodes.get(p);
      const sz = SIZE.has(p) ? SIZE.get(p) : ringOf(p), el = h('div', 'gn' + (sz === 0 ? ' c' : sz === 2 ? ' r2' : '') + (n.ruler ? ' ruler' : '') + (old ? '' : ' out'));
      el.append(face(h('div', 'ph'), n), skip(h('span', '', n.name))); el.title = roleOf(n) + ' · ' + n.name;
      el.onclick = () => { if (p === center) { select(p); return; } hov = ''; center = p; select(p); drawChart(); };
      el.onmouseenter = () => hover(p); el.onmouseleave = () => hover(''); // 올린 인물의 선만 밝게
      el.style.left = (old ? old.style.left : W / 2 + 'px'); el.style.top = (old ? old.style.top : H / 2 + 'px');
      if (old) old.replaceWith(el); else st.append(el); chartNodes.set(p, el);
      requestAnimationFrame(() => { el.classList.remove('out'); el.style.left = tx + 'px'; el.style.top = ty + 'px'; });
    }
    if (!near(center).length) st.append(h('div', 'rg-empty', L('알려진 인간관계가 아직 없습니다. 사교회나 만남 주선으로 관계가 생기면 여기에 이어집니다.', 'No known relationships yet. Ties formed at social gatherings or arranged meetings will appear here.')));
    const svg = st.querySelector('svg'), t0 = performance.now(), my = ++anim;
    const lines = () => { // 움직이는 동안 선을 따라 그린다(사진 틀 가장자리에서 가장자리까지)
      if (my !== anim || !st.isConnected) return; svg.textContent = ''; const br = st.getBoundingClientRect();
      const at = (k) => { const v = chartNodes.get(k); if (!v) return null; const r = v.querySelector('.ph').getBoundingClientRect(); return [r.left - br.left + r.width / 2, r.top - br.top + r.height / 2, Math.max(r.width, r.height) / 2 + 2]; };
      const pairs = R.edges.slice(), placed = [], cmate = JOIN.some(([x, y]) => x === center || y === center) ? mateOf(center) : ''; // 관계가 없는 사람에게는 선을 긋지 않는다 · placed: 놓은 선 이름표(겹침 피하기)
      st.querySelectorAll('.gheart,.ghlab').forEach((x) => x.remove());
      for (const [a, b] of JOIN) { // 맞붙은 짝: 이음새에 ♥ 와 사이 이름
        const A = chartNodes.get(a), B = chartNodes.get(b), e = edgeOf(a, b); if (!A || !B || !e) continue;
        const ra = A.querySelector('.ph').getBoundingClientRect(), rb = B.querySelector('.ph').getBoundingClientRect(), [l, r] = ra.left < rb.left ? [ra, rb] : [rb, ra];
        const sx = (l.right + r.left) / 2 - br.left, sy = Math.max(l.top + l.height / 2, r.top + r.height / 2) - br.top, top = Math.min(l.top, r.top) - br.top;
        const ht = h('div', 'gheart', '♥'), hl = h('div', 'ghlab', label(e)); ht.style.left = sx + 'px'; ht.style.top = sy + 'px'; hl.style.left = sx + 'px'; hl.style.top = (top - 6) + 'px'; st.append(ht, hl);
      }
      for (const e of pairs) {
        if (joined(e.a, e.b)) continue;
        const P = at(e.a), Q = at(e.b); if (!P || !Q) continue; const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1; if (len <= P[2] + Q[2]) continue;
        const p = [P[0] + (dx / len) * P[2], P[1] + (dy / len) * P[2]], q = [Q[0] - (dx / len) * Q[2], Q[1] - (dy / len) * Q[2]], faint = ringOf(e.a) === 2 || ringOf(e.b) === 2;
        // 가운데 인물(과 그 짝)을 가로지르는 남들끼리의 선은 바깥으로 휘어 돌아간다(2026-11-09 사용자: 「줄이 난잡」)
        let cv = null; for (const k of [center, cmate]) { const C = k && e.a !== k && e.b !== k && at(k); if (!C) continue; const t = Math.max(0, Math.min(1, ((C[0] - p[0]) * (q[0] - p[0]) + (C[1] - p[1]) * (q[1] - p[1])) / ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 || 1))), fx = p[0] + (q[0] - p[0]) * t, fy = p[1] + (q[1] - p[1]) * t, d = Math.hypot(C[0] - fx, C[1] - fy);
          if (d < C[2] + 26) { let nx = fx - C[0], ny = fy - C[1], nl = Math.hypot(nx, ny); if (nl < 1) { nx = -(q[1] - p[1]); ny = q[0] - p[0]; nl = Math.hypot(nx, ny) || 1; } const push = (C[2] + 46 - d) * 2; cv = [fx + (nx / nl) * push, fy + (ny / nl) * push]; break; } }
        const pt = (f) => (cv ? [(1 - f) ** 2 * p[0] + 2 * (1 - f) * f * cv[0] + f * f * q[0], (1 - f) ** 2 * p[1] + 2 * (1 - f) * f * cv[1] + f * f * q[1]] : [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
        const ln = document.createElementNS(NS, cv ? 'path' : 'line'); if (cv) { ln.setAttribute('d', `M${p[0]},${p[1]} Q${cv[0]},${cv[1]} ${q[0]},${q[1]}`); ln.setAttribute('fill', 'none'); } else { ln.setAttribute('x1', p[0]); ln.setAttribute('y1', p[1]); ln.setAttribute('x2', q[0]); ln.setAttribute('y2', q[1]); }
        ln.setAttribute('stroke', e.none ? '#5fd4ff' : COL[e.kinds[0]] || '#c9c9c9'); const thin = e.kinds[0] === 'acquaint', mine = e.a === center || e.b === center; ln.setAttribute('stroke-width', e.none ? 1 : thin ? (mine ? 1.8 : 1.2) : faint ? 1.6 : 2.8); ln.setAttribute('opacity', e.none ? 0.3 : thin ? (mine ? 0.75 : 0.26) : faint ? 0.45 : 0.9); // 지인은 가는 선 — 가운데 인물의 지인은 또렷하게, 남들끼리의 지인은 옅게
        ln.dataset.a = e.a; ln.dataset.b = e.b; if (hov) ln.classList.add(e.a === hov || e.b === hov ? 'gl-on' : 'gl-off');
        if (e.none) ln.setAttribute('stroke-dasharray', '2 7'); else if (dashed(e)) ln.setAttribute('stroke-dasharray', '8 6'); svg.append(ln);
        if (!e.none && !faint && !thin) { const up = Math.abs(dx) < Math.abs(dy) * 0.6, big = (k) => (SIZE.has(k) ? SIZE.get(k) : ringOf(k)) === 0, f0 = big(e.a) && !big(e.b) ? 0.64 : big(e.b) && !big(e.a) ? 0.36 : 0.5; // 가운데 쌍에서 나가는 선은 이름표를 바깥쪽으로(짝 카드에 가리지 않게)
          const txt = label(e), w = txt.length * 12 + 10; let lx = 0, ly = 0;
          for (const f of [f0, f0 - 0.14, f0 + 0.14, f0 - 0.26, f0 + 0.26]) { const [fx, fy] = pt(f); lx = fx + (up ? 8 : 0); ly = fy + (up ? 4 : -6); if (!placed.some((b) => Math.abs(b[0] - lx) < (b[2] + w) / 2 && Math.abs(b[1] - ly) < 15)) break; } // 이름표끼리 겹치면 선을 따라 비킨다
          placed.push([lx + (up ? w / 2 : 0), ly, w]);
          const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'glab'); t.setAttribute('x', lx); t.setAttribute('y', ly); t.setAttribute('text-anchor', up ? 'start' : 'middle'); t.textContent = txt; t.dataset.a = e.a; t.dataset.b = e.b; if (hov && e.a !== hov && e.b !== hov) t.classList.add('gl-off'); svg.append(t); }
      }
      if (performance.now() - t0 < 700) requestAnimationFrame(lines);
    };
    requestAnimationFrame(lines);
  }

  // ---- 창 ----
  let undo = null;
  function legend(host) { const lg = h('div', 'web-ui'); for (const k of ['partner', 'friend', 'acquaint', 'rival', 'conflict']) { const s = h('span'), i = h('i', k === 'conflict' ? 'd' : ''); i.style.background = COL[k]; s.append(i, document.createTextNode(KIND()[k])); lg.append(s); } lg.append(h('span', '', L('· 플레이어가 아는 관계만', '· Only relationships you know about'))); if (mode === 'board') lg.append(h('span', '', L('· 무리 사이 지인은 한 줄로 묶음(인물을 누르면 풀림)', '· Acquaintances between circles are bundled (click a person to unbundle)'))); else lg.append(h('span', '', L('· 인물에 마우스를 올리면 그 사람 선만', '· Hover a person to see only their lines'))); host.append(lg); }
  function setMode(m) {
    mode = m; if (!win) return; const body = win.querySelector('.rg-body'); body.textContent = ''; undo?.(); undo = null; chartNodes = new Map(); anim++;
    for (const b of win.querySelectorAll('.rg-top .tab')) b.classList.toggle('on', b.dataset.m === m);
    if (m === 'board') undo = board(body);
    else { const st = h('div', 'rg-chart'); st.append(document.createElementNS(NS, 'svg')); body.append(st); if (!byPid(center)) center = sel || D.ruler; requestAnimationFrame(drawChart); }
    legend(body); body.append(h('div', 'rg-det hide')); if (sel) select(sel);
  }
  function close() { anim++; undo?.(); undo = null; document.getElementById('rgWin')?.remove(); win = null; document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key !== 'Escape') return; e.stopPropagation(); if (sel) select(''); else close(); }
  async function open(key) {
    css(); close();
    win = h('div'); win.id = 'rgWin'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true');
    const book = h('div', 'rg-book'), top = h('div', 'rg-top'), body = h('div', 'rg-body');
    top.append(h('h3', '', L('인물 세력판', 'Circles of the Court')), h('small', '', L('우리 제국 지도자들', 'Leaders of our empire')));
    for (const [m, t] of [['board', L('세력판', 'Power board')], ['chart', L('인물 관계도', 'Relationship chart')]]) { const b = h('button', 'tab', t); b.type = 'button'; b.dataset.m = m; b.onclick = () => setMode(m); top.append(b); }
    const x = h('button', '', L('닫기', 'Close')); x.type = 'button'; x.onclick = close; top.append(h('span', 'sp'), x);
    book.append(body, top); win.append(book); document.body.append(win);
    document.addEventListener('keydown', onKey, true);
    const [g, is] = await Promise.all([window.sllm.relGraph ? window.sllm.relGraph().catch(() => null) : null, window.sllm.getImageState ? window.sllm.getImageState().catch(() => null) : null]);
    if (!win) return;
    if (!g || !g.ok) { body.append(h('div', 'rg-empty', (g && g.error) || L('관계도를 불러오지 못했습니다.', 'Could not load the chart.'))); return; }
    D = g; IMG = (is && is.images) || {}; SAVE = String((is && is.save) || '');
    if (!D.nodes.length) { body.append(h('div', 'rg-empty', L('지도자 명단이 아직 없습니다. 집무실 연락처를 한 번 열어 주세요.', 'No leader list yet. Open the office contacts once.'))); return; }
    sel = byPid(key) ? key : ''; center = sel || D.ruler || D.nodes[0].pid; focus = '';
    setMode('board');
  }
  window.SLLMRelGraph = { open, close };
})();
