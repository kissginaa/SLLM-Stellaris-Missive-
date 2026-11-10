// 대립 긴장도(시나리오 전용 기능, 2026-11-05 사용자) — 집무실 「대사관 보고」 화면 옆 칸 + 「대립 긴장도」 창(그래프·단계·기록).
// 시나리오가 켜져 있지 않으면(tnState().on = false) 아무것도 그리지 않는다. 시나리오면 「은하 지도」 버튼도(ui/scenario-map.html, 2026-11-06). 앱: src/features/tension-app.ts. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const STN = [['평온', 'Calm'], ['냉랭', 'Cold'], ['위기', 'Crisis'], ['동원', 'Mobilised'], ['일촉즉발', 'On the Brink'], ['개전 명분', 'Casus Belli']];
  const COL = ['#7fd88f', '#b8c47a', '#e0c48a', '#e0a060', '#ff8a7a', '#ff5a5a'];
  const css = () => { if (document.getElementById('tnCss')) return; const st = h('style'); st.id = 'tnCss'; st.textContent =
    '#tnBox{margin:0 0 8px;padding:8px 10px;border:1px solid #b8975a88;background:#b8975a12;font-size:12.5px;line-height:1.45}#tnBox b{display:block;font-weight:600;margin-bottom:3px}'
    + '#tnBox .tn-num{font-size:20px;font-weight:700}#tnBox .tn-bar{height:6px;background:#ffffff18;margin:4px 0}#tnBox .tn-bar i{display:block;height:100%}#tnBox small{display:block;opacity:.8}#tnBox button{margin-top:6px;font-size:12px;padding:3px 8px;cursor:pointer}'
    + '#tnWin{position:fixed;inset:0;z-index:9000;background:#000a;display:flex;align-items:center;justify-content:center}'
    + '#tnWin .tn-box{width:min(720px,94vw);max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:16px 18px;background:#14161c;color:#e8e4d8;border:1px solid #b8975a;font-size:13px;line-height:1.5}'
    + '#tnWin h3{margin:0;font-size:16px;color:#e0c48a}#tnWin h4{margin:4px 0 2px;font-size:13.5px;color:#e0c48a;border-bottom:1px solid #b8975a44;padding-bottom:2px}'
    + '#tnWin .tn-top{display:flex;justify-content:space-between;align-items:center}#tnWin button{padding:4px 10px;cursor:pointer;font-size:12.5px}'
    + '#tnWin .tn-head{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}#tnWin .tn-num{font-size:30px;font-weight:700}#tnWin svg{width:100%;height:auto;background:#ffffff06;border:1px solid #8884}'
    + '#tnWin ul{margin:2px 0;padding-left:18px}#tnWin small{opacity:.75}#tnWin .tn-none{opacity:.6}#tnWin .tn-steps{display:grid;grid-template-columns:auto 1fr;gap:2px 10px}';
    document.head.append(st); };
  let busy = false, S = null, C = null; // C: 시나리오(scnState, 2026-11-05)
  const col = (st) => COL[Math.max(0, Math.min(5, st | 0))];

  function chart(hist) {
    const W = 660, H = 180, P = 26, svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': L('긴장도 추이', 'Tension over time') });
    [25, 50, 75, 90].forEach((y) => { const yy = P + (H - 2 * P) * (1 - y / 100); svg.append(sv('line', { x1: P, x2: W - 6, y1: yy, y2: yy, stroke: '#ffffff22', 'stroke-dasharray': '3 4' })); const t = sv('text', { x: 2, y: yy + 4, fill: '#bbb', 'font-size': 10 }); t.textContent = y; svg.append(t); });
    if (hist.length < 2) { const t = sv('text', { x: W / 2, y: H / 2, fill: '#aaa', 'font-size': 12, 'text-anchor': 'middle' }); t.textContent = L('기록이 쌓이면 그래프가 그려집니다.', 'The chart appears once a few months are recorded.'); svg.append(t); return svg; }
    const n = hist.length, x = (i) => P + (W - P - 6) * (i / (n - 1)), y = (v) => P + (H - 2 * P) * (1 - v / 100);
    svg.append(sv('polyline', { points: hist.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '), fill: 'none', stroke: '#e0c48a', 'stroke-width': 2 }));
    const last = hist[n - 1]; svg.append(sv('circle', { cx: x(n - 1), cy: y(last.v), r: 4, fill: '#e0c48a' }));
    const t0 = sv('text', { x: P, y: H - 6, fill: '#bbb', 'font-size': 10 }); t0.textContent = hist[0].d; svg.append(t0);
    const t1 = sv('text', { x: W - 6, y: H - 6, fill: '#bbb', 'font-size': 10, 'text-anchor': 'end' }); t1.textContent = last.d; svg.append(t1);
    return svg;
  }
  function win() {
    document.getElementById('tnWin')?.remove(); if (!S || !S.on) return;
    const ov = h('div'); ov.id = 'tnWin'; ov.setAttribute('data-i18n-skip', ''); const box = h('div', 'tn-box'); ov.append(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    const top = h('div', 'tn-top'); const close = h('button', '', L('닫기', 'Close')); close.onclick = () => ov.remove(); top.append(h('h3', '', L('대립 긴장도', 'Rivalry Tension')), close); box.append(top);
    const head = h('div', 'tn-head'), num = h('span', 'tn-num', String(S.v)); num.style.color = col(S.st);
    head.append(num, h('b', '', `${L(...S.stage)}${S.war ? ' · ' + L('전쟁 중', 'at war') : ''}`), h('span', '', `${S.a} ↔ ${S.b}`), h('small', '', S.date)); box.append(head);
    box.append(chart(S.hist || []));
    if (C && C.on) {
      box.append(h('h4', '', L('시나리오', 'Scenario')));
      box.append(h('div', '', `${L(...C.title)}${C.seatRole ? ' · ' + L('우리: ', 'Us: ') + L(...C.seatRole) : ''}${C.lvl ? ' · ' + L('두 거대 세력: ', 'Great powers: ') + L(...C.lvlName) : ''}`));
      const hist = [['솔에서 얼라이언스가, 데네브에서 제국이 세워져 인류가 둘로 갈라짐', 'The Alliance (Sol) and the Empire (Deneb) split humanity in two'], ['바스틸 회랑에서 세 번의 전쟁, 철문 요새 함락', 'Three wars in the Bastille Corridor; the Irongate fortress fell'], ['철문 휴전 조약(2189) — 낡아 가는 중', 'The Irongate Truce (2189), now aging'], ['세렌 회랑: 두 나라 사이의 또 하나뿐인 길', 'The Seren Corridor: the only other route between them']];
      const ul = h('ul'); for (const [ko, en] of hist) ul.append(h('li', '', L(ko, en))); box.append(ul);
      if (C.truce && C.truce.length) { const tu = h('ul'); for (const t of C.truce) tu.append(h('li', '', `${t.d} · ${L(...t.line)}`)); box.append(h('small', '', L('휴전 기념일에 우리가 한 일', 'What we did on truce anniversaries')), tu); }
      box.append(h('small', '', C.seeded ? L('지난 역사는 연대기에 들어가 있고, AI 대화도 이 배경을 압니다.', 'This history is in the chronicle, and AI conversations know the background.') : L('게임이 앱에 나라 이름을 알려 주면(시작 사흘 뒤) 연대기에 지난 역사를 넣습니다.', 'Once the game reports the nations (three days in), this history is added to the chronicle.')));
    }
    box.append(h('h4', '', L('단계', 'Stages')));
    const g = h('div', 'tn-steps');
    [[0, '0~24', '서로 껄끄럽지만 전쟁을 예상하는 이는 없음', 'Strained, but nobody expects war'], [1, '25~49', '차가운 말이 오감', 'Cold words are exchanged'], [2, '50~74', '두 세력이 서로를 크게 나쁘게 봄(관계 −50)', 'The two powers think much worse of each other (opinion −50)'],
      [3, '75~89', '양쪽 동원: 함대 한도 +20, 함선 유지비 +10%', 'Both mobilise: naval capacity +20, ship upkeep +10%'], [4, '90~99', '안정도 −3, 관계 −50 더', 'Stability −3, opinion −50 more'], [5, '100', '서로에 대한 전쟁 명분 「결판」(전쟁을 강제하지는 않음)', 'Each gains the "Showdown" casus belli (war is not forced)']]
      .forEach(([st, r, ko, en]) => { const a = h('b', '', `${r} ${L(...STN[st])}`); a.style.color = col(st); if (st === S.st) a.style.textDecoration = 'underline'; g.append(a, h('span', '', L(ko, en))); });
    box.append(g);
    box.append(h('small', '', L('매달 저절로 1씩 식습니다. 상대 국경(안이나 바로 옆 성계)에 모인 군함 함대가 있으면 오르고(1개 이상 +1, 3개 이상 +2, 양쪽 따로), 가끔 국경 마찰(+3)이 일어납니다. 둘이 싸우는 동안은 100, 전쟁이 끝나면 70에서 다시 시작합니다. 시나리오 사건과 우리 외교도 이 값을 움직입니다.', 'Cools by 1 each month. Warships massed on the other side\'s border (inside it or one jump away) raise it (+1 for one fleet, +2 for three, each side counted), and border friction (+3) flares up now and then. While they fight it stays at 100; after the war it restarts at 70. Scenario events and our own diplomacy move it too.')));
    box.append(h('h4', '', L('기록', 'Record')));
    if (!S.notes.length) box.append(h('div', 'tn-none', L('아직 기록이 없습니다.', 'Nothing recorded yet.')));
    else { const ul = h('ul'); for (const n of S.notes) ul.append(h('li', '', `${n.d} · ${L(n.ko, n.en)}`)); box.append(ul); }
    document.body.append(ov);
  }
  function refresh() { document.getElementById('tnBox')?.remove(); void add(); }
  async function add() {
    const root = document.getElementById('embRoot'), tt = document.getElementById('embTitle');
    if (busy || !root || !tt || tt.textContent !== L('대사관 보고', 'Embassy Reports')) return;
    const side = root.querySelector('.emb-side'); if (!side || document.getElementById('tnBox')) return;
    busy = true; try { S = await window.sllm.tnState(); } catch (e) { S = null; } try { C = window.sllm.scnState ? await window.sllm.scnState() : null; } catch (e) { C = null; } busy = false;
    if (!S || !S.ok || !S.on || document.getElementById('tnBox') || !side.isConnected) return;
    css();
    const box = h('div'); box.id = 'tnBox'; box.setAttribute('data-i18n-skip', '');
    box.append(h('b', '', L('대립 긴장도', 'Rivalry Tension')));
    const row = h('div'), num = h('span', 'tn-num', String(S.v)); num.style.color = col(S.st); row.append(num, document.createTextNode(` ${L(...S.stage)}${S.war ? ' · ' + L('전쟁 중', 'at war') : ''}`)); box.append(row);
    const bar = h('div', 'tn-bar'), fill = h('i'); fill.style.width = Math.max(0, Math.min(100, S.v)) + '%'; fill.style.background = col(S.st); bar.append(fill); box.append(bar);
    box.append(h('small', '', `${S.a} ↔ ${S.b}`));
    if (C && C.on) box.append(h('small', '', `${L('시나리오: ', 'Scenario: ')}${L(...C.title)}${C.seatRole ? ' · ' + L('우리: ', 'Us: ') + L(...C.seatRole) : ''}`));
    const b = h('button', '', L('열기', 'Open')); b.type = 'button'; b.onclick = () => win(); box.append(b);
    // 시나리오 은하 지도(2026-11-06, src/features/scenario-map-app.ts): 섹터 구역마다 총독 초상화. 시나리오 세이브에서만.
    if (C && C.on && window.sllm.scnMapOpen) { const mb = h('button', '', L('은하 지도', 'Galaxy Map')); mb.type = 'button'; mb.style.marginLeft = '6px'; mb.onclick = async () => { try { const r = await window.sllm.scnMapOpen(); if (r && !r.ok && r.error) { box.querySelector('.tn-err')?.remove(); box.append(h('small', 'tn-err', r.error)); } } catch (e) { /* 창을 못 열면 그대로 */ } }; box.append(mb); }
    side.prepend(box);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.tnState) return;
    const watch = () => { const root = document.getElementById('embRoot'); if (!root) return setTimeout(watch, 300); new MutationObserver(() => { void add(); }).observe(root, { childList: true }); void add(); };
    watch();
    setInterval(() => { if (document.getElementById('tnBox')) refresh(); }, 60000);
  });
})();
