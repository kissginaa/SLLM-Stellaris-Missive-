// 작전지휘실(2026-11-05 사용자: 함대 사령부 → 작전지휘실, 웅장하게 화면 전체로) — warroom.html 의 그림·조작. 앱: src/features/galaxy-app.ts.
// 1단계: 은하 작전도(보기·고르기). 2단계(2026-11-05): 우리 군 함대(지금 게임에서 읽음)를 고르고 성계를 눌러 이동·수도 귀환·정지(우클릭 = 바로 이동),
//   「작전 회의」: 장관·제독이 지도를 보며 말하고 작전안(최대 3개)을 낸다 — 작전안 대상 성계가 지도에 번호로 빛나고, 승인하면 그 함대들에 명령.
// 좌표: 세이브 x 만 뒤집는다(Galaxy Forge(MIT, IanHeinrich/stellaris-galaxy-forge)가 게임 지도에 맞춰 잰 방향: 솔(397, -180)이 왼쪽 위).
// 영토: Galaxy Forge 가 밝힌 게임의 국경 방식(영향력 장)을 우리 식으로 간단히 — 성계·같은 주인 항로가 영향력을 내고(반지름 35·항로 굵기 20·최대 1.88배),
//   주인 없는 성계·항로도 「주인 없음」 하나로 겨룬다. 나라별 거리 = −k·ln Σ exp(−s/k)(k 0.155), 가장 가까운 나라가 0.8 안이면 그 나라 땅. 지도 자료를 받을 때 한 번 격자로 계산하고,
//   marching squares 로 국경선을 이어 벡터 도형으로 만든다(확대해도 계단이 안 생김). 그리기: 옅은 바탕 + 안쪽으로 번지는 빛 + 화면 기준 가는 선.
// 문구는 L(한, 영)만 — 언어 팩 호환. Esc = 닫기.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const $ = (id) => document.getElementById(id);
  // 지도 캔버스는 기울인 탁자(#holo, CSS 3D) 위에 있다: 크기는 기울이기 전 크기, 마우스는 투영을 거꾸로 풀어 탁자 위 점으로.
  const box = () => ({ width: cv.clientWidth || 1, height: cv.clientHeight || 1 });
  // ---- 배경 그림(2026-11-05 사용자: GPT 가 그린 성향별 작전지휘실 10종 × 평시·전시, ui/assets/rooms/warroom/<성향>[-war].webp) ----
  // 그림 속 탁자(타원, 그림 크기에 대한 비율 — 20장 공통 구도)에 지도를 정확히 얹는다: 탁자 지름만 한 정사각형 판을 세로로 눌러(scaleY) 타원에 맞춤.
  //   글자는 눌리지 않게 되돌려 쓴다(ft). 그림이 없거나 못 읽으면 예전처럼 CSS 로 그린 방 + 기울인 탁자.
  const BG = { w: 2560, h: 1440, cx: 0.4975, cy: 0.402, rx: 0.2975, ry: 0.244, inset: 0.975, flat: 0.9 }; // flat: 지도 눌림(1 = 정면, 탁자 그대로면 약 0.46). 2026-11-05 사용자: 0.9까지 세우고(답답하지 않게), 탁자 밖으로 넘치는 부분은 투명
  let bgOn = false, bgUrl = '', flat = 1, tableVy = 1; // tableVy: 펴진 판 위 탁자 타원의 세로 반지름(판 반높이에 대한 비율)
  const HG = () => (bgWar ? '255,140,110' : '120,225,240'); // 홀로그램 빛 색(전시면 붉은 경보색)
  let bgWar = false;
  function setBg(style, war) {
    bgWar = !!war; $('wr').classList.toggle('war', bgWar);
    const url = 'assets/rooms/warroom/' + (style || 'militarist') + (war ? '-war' : '') + '.webp'; if (url === bgUrl) return; bgUrl = url;
    const im = new Image();
    im.onload = () => { if (bgUrl !== url) return; $('bgimg').style.backgroundImage = 'url("' + url + '")'; $('wr').classList.add('hasbg'); bgOn = true; fitTable(); draw(); };
    im.onerror = () => { if (bgUrl !== url) return; if (style !== 'militarist') { bgUrl = ''; setBg('militarist', war); return; } bgOn = false; $('wr').classList.remove('hasbg'); fitTable(); draw(); };
    im.src = url;
  }
  function fitTable() {
    const st = $('stage'), ho = $('holo');
    if (!bgOn) { st.style.cssText = ''; ho.style.transform = ''; ho.style.transformOrigin = ''; ho.style.webkitMaskImage = ''; ho.style.maskImage = ''; ho.style.clipPath = ''; flat = 1; return; }
    const W0 = window.innerWidth, H0 = window.innerHeight, sc = Math.max(W0 / BG.w, H0 / BG.h), dw = BG.w * sc, dh = BG.h * sc, ox = (W0 - dw) / 2, oy = (H0 - dh) / 2;
    const cx = ox + BG.cx * dw, cy = oy + BG.cy * dh, rx = BG.rx * dw * BG.inset, ry = BG.ry * dh * BG.inset;
    // 탁자 너비 그대로, 덜 눕힌 만큼 위아래로 탁자를 넘는다 → 탁자 테두리 안쪽 가장자리만 흐리게, 탁자 밖으로 넘친 부분은 완전히 투명(가림막도 지도와 같이 눌리므로 펴진 좌표로 계산).
    const wid = 2 * rx; flat = BG.flat;
    st.style.cssText = `left:${cx - rx}px;top:${cy - rx}px;width:${wid}px;height:${wid}px;transform:none`;
    ho.style.transform = `scaleY(${flat})`; ho.style.transformOrigin = '50% 50%';
    const vy = Math.min(50, 50 * (ry / flat) / rx), m = `radial-gradient(ellipse 50% ${vy.toFixed(2)}% at 50% 50%, #000 90%, transparent 100%)`;
    ho.style.webkitMaskImage = m; ho.style.maskImage = m; tableVy = vy / 50;
    ho.style.clipPath = `ellipse(50% ${vy.toFixed(2)}% at 50% 50%)`;
    const bm = $('beam'); if (bm) bm.style.cssText = `left:${cx - rx}px;width:${2 * rx}px;top:${cy - ry * 2.2}px;height:${ry * 3.2}px`; // 탁자에서 솟는 빛기둥 // 탁자 밖은 마우스도 통과 → 뒤쪽 제독 홀로그램을 누를 수 있게
  }
  function toLocal(cx, cy) {
    const el = $('holo'), st = getComputedStyle(el), M = new DOMMatrixReadOnly(st.transform === 'none' ? undefined : st.transform);
    const par = el.offsetParent ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 }, o = st.transformOrigin.split(' ').map(parseFloat);
    const u = cx - (par.left + el.offsetLeft + o[0]), v = cy - (par.top + el.offsetTop + o[1]);
    const a1 = M.m11 - u * M.m14, b1 = M.m21 - u * M.m24, c1 = u * M.m44 - M.m41, a2 = M.m12 - v * M.m14, b2 = M.m22 - v * M.m24, c2 = v * M.m44 - M.m42, det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) return null;
    return { x: (c1 * b2 - c2 * b1) / det + o[0], y: (a1 * c2 - a2 * c1) / det + o[1] };
  }
  if (!window.sllm || !window.sllm.galaxyMap) return;
  let D = null, busy = false, err = '';
  let LV = null, liveErr = '', liveBusy = false, toast = '', toastT = null; // LV: 지금 게임의 우리 군 함대(보고)
  let CO = null, coOpen = false, coBusy = false, coErr = '', hiPlan = null; // 작전 회의
  const orders = new Map(); // fid → 목적지 성계 id(내가 방금 내린 명령, 도착하면 지움)
  let sel = { sys: null, fleet: null }, hover = null;
  let pdrag = null, armed = null; // 함대 아이콘 끌기 · 집어 든 함대(fid): 아이콘을 누르면 집고, 성계·적 아이콘·기지를 누르면 그리로 이동(2026-11-05 사용자)
  const view = { cx: 0, cy: 0, k: 1 }; // 세계 → 화면: (wx - cx) * k + w/2
  let cv = document.getElementById('cv'), ctx2 = cv.getContext('2d'), tip = document.getElementById('tip'), sysById = new Map(), fleetsAt = new Map();
  const W = (s) => ({ x: -s.x, y: s.y }); // 세이브 좌표 → 지도 좌표

  async function load(force) {
    busy = true; err = ''; draw(); render();
    let r; try { r = await window.sllm.galaxyMap(!!force); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    busy = false;
    if (!r || !r.ok) { err = (r && r.error) || L('불러오지 못했습니다.', 'Could not load.'); render(); draw(); return; }
    const first = !D; D = r; sysById = new Map(D.systems.map((s) => [s.id, s])); fleetsAt = new Map(); adj = null; routes.clear(); frontC = null; loadMarks();
    regroup();
    terr = territory();
    setBg(D.style, LV && LV.war);
    if (first) home();
    render(); draw();
    loadLive();
  }
  async function loadLive() {
    if (!window.sllm.warroomLive) return;
    liveBusy = true; render();
    let r; try { r = await window.sllm.warroomLive(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    liveBusy = false;
    if (r && r.ok) { setLive(r); if (r.council) CO = Object.assign(CO || {}, { council: r.council }); if (r.crew) { CREW = r.crew; if (!CO) CO = { council: r.council || { lines: [], plans: [] } }; CO.speakers = r.crew; } setTimeout(() => propose(false), 1200); /* 게임 달마다 한 번 장관·유능한 제독의 작전 건의(앱이 막음) */ } else { LV = null; liveErr = (r && r.error) || L('지금 게임의 함대를 읽지 못했습니다.', 'Could not read the fleets from the game.'); }
    render(); draw();
  }
  // 동맹에 함대 지원 요청(함대 사령부 합동 작전과 같은 판정·계약 — foAllyAsk). 답은 그 나라 통치자 홀로그램의 말풍선으로.
  let allyBusy = null, alOpen = false;
  async function allyAsk(a) {
    allyBusy = a.idx; render();
    let r; try { if (window.sllm.foRefresh) await window.sllm.foRefresh(); r = await window.sllm.foAllyAsk(a.idx, L('작전지휘실에서 합동 작전을 위해 함대 지원을 요청합니다.', 'Requesting fleet support for a joint operation from our war room.')); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    allyBusy = null;
    if (!r || !r.ok) say((r && r.error) || L('요청을 전하지 못했습니다.', 'The request did not go through.'));
    else {
      const c = CREW.find((x) => x.role === 'ally' && x.aidx === a.idx);
      if (r.reply && c) speak([{ lid: c.lid, name: c.name, say: r.reply }]); else if (r.reply) say(a.name + ': ' + r.reply);
      if (r.accepted) { say(L(`${a.name}의 함대가 합류했습니다. 왼쪽 목록에서 바로 지휘할 수 있습니다.`, `${a.name}'s fleets have joined. Command them from the list on the left.`)); await loadLive(); }
    }
    render();
  }
  // 연합 원정군(AI 가 꺼진 별도 세력)으로 청하기 — 답은 그 나라 통치자 홀로그램의 말풍선
  async function xfAsk(a) {
    allyBusy = a.idx; render();
    let r; try { r = await window.sllm.warroomXfAsk(a.idx, L('작전지휘실에서 연합 원정군 파견을 요청합니다.', 'From our war room, we request an expeditionary force.')); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    allyBusy = null;
    const c = CREW.find((x) => x.role === 'ally' && x.aidx === a.idx);
    if (r && r.reply) { const msg = L('본국 답신 — ', 'Message from home — ') + r.reply; if (c) speak([{ lid: c.lid, name: c.name, say: msg }]); else say(a.name + ': ' + r.reply); } // 연락관이 본국 통치자의 답을 전한다
    if (!r || !r.ok) say((r && r.error) || L('요청을 전하지 못했습니다.', 'The request did not go through.'));
    else if (r.accepted) { if (r.fleets) setLive(r); say(L(`${a.name} 연합 원정군이 도착했습니다${r.joined ? ' — ' + r.joined : ''}.`, `The ${a.name} expeditionary force has arrived${r.joined ? ' — ' + r.joined : ''}.`)); }
    render(); draw();
  }
  async function xfEnd(a) {
    allyBusy = a.idx; render();
    let r; try { r = await window.sllm.warroomXfEnd(a.idx); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    allyBusy = null;
    if (r && r.ok) { if (r.fleets) setLive(r); say(L(`${a.name} 연합 원정군을 돌려보냈습니다.`, `Sent the ${a.name} expeditionary force home.`)); } else say((r && r.error) || L('돌려보내지 못했습니다.', 'Could not send them home.'));
    render(); draw();
  }
  async function allyReturn(a) {
    allyBusy = a.idx; render();
    let r; try { r = await window.sllm.foAllyReturn(a.idx); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    allyBusy = null; say(r && r.ok ? L(`${a.name}의 함대를 돌려보냈습니다.`, `Sent ${a.name}'s fleets back.`) : (r && r.error) || L('돌려보내지 못했습니다.', 'Could not send them back.'));
    await loadLive();
  }
  function setLive(r) {
    LV = r; liveErr = ''; if (D) setBg(D.style, !!r.war); setTimeout(() => { regroup(); draw(); }, 0); // 전쟁 중이면 전시 그림
    for (const [fid, to] of orders) { const f = LV.fleets.find((x) => x.fid === fid); if (!f || f.s === to) orders.delete(fid); }
  }
  function say(t) { toast = t; clearTimeout(toastT); toastT = setTimeout(() => { toast = ''; render(); }, 6000); render(); }
  const liveFleet = (fid) => (LV ? LV.fleets.find((f) => f.fid === fid) : null);
  const selFid = () => (typeof sel.fleet === 'string' && sel.fleet[0] === 'L' ? Number(sel.fleet.slice(1)) : null); // 고른 우리 군 함대(지금 게임)
  async function order(fid, act, sys) {
    const f = liveFleet(fid); if (!f) return;
    let r; try { r = await window.sllm.warroomOrder(fid, act, sys === null || sys === undefined ? -1 : sys); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (!r || !r.ok) {
      if (r && r.ally) { const c = CREW.find((x) => x.role === 'ally' && x.aidx === f.aidx); if (c) speak([{ lid: c.lid, name: c.name, say: r.error }]); } // 빌려 온 동맹 함대가 스스로 판단해 거절
      say((r && r.error) || L('명령을 전하지 못했습니다.', 'The order did not go through.')); return;
    }
    if (act === 'move') orders.set(fid, sys); else orders.delete(fid);
    if (r.fleets) setLive(r);
    say(act === 'move' ? L(`명령 전달: ${f.n} → ${sysName(sys)}`, `Order sent: ${f.n} → ${sysName(sys)}`) : act === 'home' ? L(`명령 전달: ${f.n} 수도로 귀환`, `Order sent: ${f.n} returns to the capital`) : L(`명령 전달: ${f.n} 정지`, `Order sent: ${f.n} holds position`));
    anim(); draw();  if ((act === 'move' || act === 'home') && window.sllm.warroomOpinion) opine(fid, act, sys, f);
  }
  // ---- 작전 건의(2026-11-05 사용자): 국방 장관·레벨 높은(유능한) 제독이 회의를 부르지 않아도 작전을 들고 온다. 작전 지도에 바로 그려진다 ----
  const PROPOSE_LV = 5; let propBusy = false, ppT = null;
  async function propose(force) {
    if (!window.sllm.warroomPropose || propBusy || coBusy) return;
    propBusy = true; if (force) render();
    let r; try { r = await window.sllm.warroomPropose(!!force); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    propBusy = false;
    if (!r || !r.ok) { if (force) say((r && r.error) || L('건의를 받지 못했습니다.', 'No proposals came in.')); render(); return; }
    if (r.council) CO = Object.assign(CO || {}, { council: r.council }); if (r.crew) { CREW = r.crew; CO.speakers = r.crew; }
    if (!r.proposed) { if (force) say(r.none ? L(`건의할 사람이 없습니다(국방 장관 또는 레벨 ${PROPOSE_LV} 이상 제독).`, `Nobody to propose (a defense minister or an admiral of level ${PROPOSE_LV}+).`) : L('지금은 건의할 작전이 없다고 합니다.', 'They have no operation worth proposing right now.')); render(); return; }
    const plans = (CO.council.plans || []).filter((p) => (r.ids || []).includes(p.id)); if (plans[0]) hiPlan = plans[0].id;
    showProposals(plans); speak(r.lines || []); render(); anim(); draw();
  }
  function showProposals(plans) {
    const pp = $('pp'); pp.textContent = ''; clearTimeout(ppT); if (!plans.length) { pp.className = ''; return; }
    pp.className = 'show'; pp.style.top = coOpen ? '130px' : 'auto'; pp.style.bottom = coOpen ? '' : '64px'; /* 아래(인물 말풍선을 가리지 않게), 회의 창이 열려 있으면 위 */
    pp.append(h('div', 'pph', L('작전 건의', 'OPERATION PROPOSALS')));
    const all = (CO.council.plans || []);
    for (const pl of plans) {
      const i = all.indexOf(pl), d = h('div', 'ppr'); d.style.setProperty('--pc', 'rgb(' + PLAN_RGB[i % PLAN_RGB.length] + ')');
      d.append(h('i', '', String(i + 1)), h('b', '', opName(pl)), h('small', '', pl.byName + (pl.byLv ? ' · Lv ' + pl.byLv : '')));
      d.onmouseenter = () => { hiPlan = pl.id; anim(); draw(); };
      d.onclick = () => { hiPlan = pl.id; if (pl.sys >= 0) flyTo(pl.sys, Math.max(view.k, 1.2)); draw(); };
      pp.append(d);
    }
    const row = h('div', 'opb'), go = h('button', 'wb go', L('작전 회의에서 검토', 'Review in the war council')), no = h('button', 'wb', L('나중에', 'Later'));
    go.type = 'button'; no.type = 'button'; go.onclick = () => { pp.className = ''; coOpen = true; render(); anim(); draw(); }; no.onclick = () => { pp.className = ''; };
    row.append(go, no); pp.append(row);
    ppT = setTimeout(() => { pp.className = ''; }, 30000);
  }
  // ---- 명령에 대한 지휘관 의견(2026-11-05 사용자): 명령은 이미 갔고, 그 함대 제독이 찬성·우려·반대를 말한다. 우려·반대면 「명령 철회(정지)」를 고를 수 있다 ----
  let opSeq = 0, opT = null;
  async function opine(fid, act, sys, f) {
    const my = ++opSeq; clearTimeout(opT);
    showOpinion({ wait: true, name: f.adm || L('함대 참모', 'Fleet staff officer'), fleet: f.n });
    let r; try { r = await window.sllm.warroomOpinion(fid, act, sys === null || sys === undefined ? -1 : sys); } catch { r = null; }
    if (my !== opSeq) return; // 그새 다른 명령
    if (!r || !r.ok) { hideOpinion(); return; }
    showOpinion(Object.assign({ fid, fleet: f.n, act, sys }, r));
    if (CO && CO.council && CO.council.lines) CO.council.lines.push({ lid: r.lid, name: r.name, title: r.title, say: r.say });
    speak([{ lid: r.lid, name: r.name, say: r.say }]); render();
  }
  function hideOpinion() { const op = $('op'); op.className = ''; op.textContent = ''; }
  function showOpinion(o) {
    const op = $('op'); op.textContent = ''; clearTimeout(opT);
    const ST = { agree: L('찬성', 'AGREE'), caution: L('우려', 'CAUTION'), object: L('반대', 'OBJECTION') };
    op.className = 'show ' + (o.wait ? '' : o.stance);
    if (coOpen) { op.style.top = '130px'; op.style.bottom = ''; } else { op.style.top = 'auto'; op.style.bottom = '64px'; } // 회의 창이 열려 있으면 위, 아니면 아래(말풍선·인물을 가리지 않게)
    const hd = h('div', 'oph'); hd.append(...(o.wait ? [] : [h('span', 'ost', ST[o.stance] || ST.agree)]), h('b', '', o.name || ''), h('small', '', (o.title ? o.title + ' · ' : '') + (o.fleet || ''))); op.append(hd);
    if (o.wait) { op.append(h('p', 'opw', L('명령을 검토하고 있습니다…', 'Reviewing the order…'))); return; }
    op.append(h('p', '', o.say));
    const bt = h('div', 'opb');
    const ok = h('button', 'wb', o.stance === 'agree' ? L('확인', 'OK') : L('그대로 진행', 'Proceed as ordered')); ok.type = 'button'; ok.onclick = hideOpinion; bt.append(ok);
    if (o.stance !== 'agree') { const no = h('button', 'wb', L('명령 철회 — 정지', 'Withdraw — hold position')); no.type = 'button'; no.onclick = () => { hideOpinion(); orders.delete(o.fid); order(o.fid, 'hold', -1); }; bt.append(no); }
    op.append(bt);
    if (o.stance === 'agree') opT = setTimeout(hideOpinion, 9000); // 찬성은 저절로 닫힘, 우려·반대는 고를 때까지
  }
  // 부드럽게 카메라 옮기기
  let fly = null;
  function flyTo(sid, k) {
    const s = sysById.get(sid); if (!s) return; const p = W(s), kk = Math.max(view.k, k || 1.6), hh = box().height;
    const dy = 0 * hh;
    fly = { t0: performance.now(), from: { cx: view.cx, cy: view.cy, k: view.k }, to: { cx: p.x, cy: p.y + dy, k: kk } }; anim();
  }
  let rafOn = false;
  const animating = () => !!fly || orders.size > 0 || armed !== null || !!(CO && CO.council && CO.council.plans && CO.council.plans.some((p) => !p.done && p.sys >= 0));
  function anim() {
    if (rafOn) return; rafOn = true;
    const step = (t) => {
      if (fly) { const u = Math.min(1, (t - fly.t0) / 650), e = 1 - Math.pow(1 - u, 3); view.cx = fly.from.cx + (fly.to.cx - fly.from.cx) * e; view.cy = fly.from.cy + (fly.to.cy - fly.from.cy) * e; view.k = fly.from.k + (fly.to.k - fly.from.k) * e; if (u >= 1) fly = null; }
      draw();
      if (animating()) requestAnimationFrame(step); else rafOn = false;
    };
    requestAnimationFrame(step);
  }
  // 성계별 함대: 우리 군 함대는 지금 게임(LV) 위치, 나머지는 세이브
  function regroup() {
    fleetsAt = new Map(); if (!D) return;
    const add = (sid, f) => { if (sid < 0) return; if (!fleetsAt.has(sid)) fleetsAt.set(sid, []); fleetsAt.get(sid).push(f); };
    for (const f of D.fleets) { if (LV && f.o === D.player && f.cl === 'military') continue; add(f.s, f); }
    if (LV) for (const f of LV.fleets) add(f.s, { id: 'L' + f.fid, fid: f.fid, o: D.player, s: f.s, n: f.n, p: f.p, cl: 'military', live: true, aidx: f.aidx || 0, bg: f.bg || (D.fleets.find((x) => x.fid === f.fid) || {}).bg || 0 });
  }
  function home() {
    if (!D || !cv) return;
    const cap = D.systems.find((s) => s.cap === D.player) || D.systems.find((s) => s.o === D.player);
    const xs = D.systems.map((s) => W(s).x), ys = D.systems.map((s) => W(s).y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    const r = box();
    if (cap) { const p = W(cap); view.cx = p.x; view.cy = p.y; view.k = Math.min(r.width, r.height) / (span * 0.35); }
    else { view.cx = (Math.max(...xs) + Math.min(...xs)) / 2; view.cy = (Math.max(...ys) + Math.min(...ys)) / 2; view.k = Math.min(r.width, r.height) / span; }
  }
  const toScr = (p, r) => ({ x: (p.x - view.cx) * view.k + r.width / 2, y: (p.y - view.cy) * view.k + r.height / 2 });
  const toWorld = (sx, sy, r) => ({ x: (sx - r.width / 2) / view.k + view.cx, y: (sy - r.height / 2) / view.k + view.cy });

  /** 글자: 탁자가 세로로 눌려 있으면 글자만 되돌려 바로 보이게 */
  function ft(g, t, x, y) { if (flat === 1) { g.fillText(t, x, y); return; } g.save(); g.translate(x, y); g.scale(1, 1 / flat); g.fillText(t, 0, 0); g.restore(); }
  // ---- 예상 경로(2026-11-05 사용자): 아는 하이퍼레인을 따라 가장 짧은 길(게임 길찾기와 거의 같음). 길을 모르면 null → 직선으로 그림 ----
  let adj = null; const routes = new Map();
  function route(a, b) {
    if (a === b) return [a]; const key = a + '>' + b; if (routes.has(key)) return routes.get(key);
    if (!adj) { adj = new Map(); const link = (x, y) => { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); }; for (const s of D.systems) for (const t of s.hl) { link(s.id, t); link(t, s.id); } }
    const prev = new Map([[a, -1]]), q = [a]; let found = false;
    for (let i = 0; i < q.length && !found; i++) for (const t of adj.get(q[i]) || []) { if (prev.has(t)) continue; prev.set(t, q[i]); if (t === b) { found = true; break; } q.push(t); }
    let out = null; if (found) { out = []; for (let c = b; c !== -1; c = prev.get(c)) out.push(c); out.reverse(); }
    if (routes.size > 400) routes.clear(); routes.set(key, out); return out;
  }
  const opName = (pl) => (pl.code ? L(`「${pl.code}」 작전`, `Operation ${pl.code}`) : pl.title); // 작전명(RP)
  const ROLE_T = { main: ['주공', 'Main'], support: ['지원', 'Support'], feint: ['견제', 'Feint'], defend: ['방어', 'Defend'] };
  // ---- 작전 지도 선(2026-11-05 사용자: 전선·방어선 긋기) ----
  // 전선(자동): 전쟁 중일 때 우리 성계와 적 성계를 잇는 항로의 한가운데를 이어 붉은 선(2026-11-05 사용자: 이빨 없이).
  let frontC = null;
  function frontData() {
    const key = LV ? (LV.eidx || []).join(',') + '|' + (LV.enemies || []).join(',') : '';
    if (frontC && frontC.key === key && frontC.D === D) return frontC;
    const segs = [], byNode = new Map();
    if (LV && D) for (const s of D.systems) {
      if (s.o !== D.player) continue;
      for (const t of s.hl) {
        const q = sysById.get(t); if (!q || q.o < 0 || !enemyOf(q.o)) continue;
        const a = W(s), b = W(q), dl = Math.hypot(b.x - a.x, b.y - a.y) || 1, i = segs.length;
        segs.push({ m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: { x: (b.x - a.x) / dl, y: (b.y - a.y) / dl } });
        for (const k of [s.id, q.id]) { if (!byNode.has(k)) byNode.set(k, []); byNode.get(k).push(i); }
      }
    }
    const links = new Set(); // 같은 성계를 지나는 전선 조각끼리, 각도 순으로 이웃만 잇는다
    for (const [k, list] of byNode) {
      if (list.length < 2) continue; const c = W(sysById.get(k));
      const arr = list.map((i) => ({ i, an: Math.atan2(segs[i].m.y - c.y, segs[i].m.x - c.x) })).sort((x, y) => x.an - y.an);
      for (let j = 0; j < arr.length; j++) { if (arr.length === 2 && j === 1) break; const A = arr[j], B = arr[(j + 1) % arr.length]; let gap = B.an - A.an; if (gap < 0) gap += Math.PI * 2; if (gap < 2.3) links.add(Math.min(A.i, B.i) + '-' + Math.max(A.i, B.i)); }
    }
    frontC = { key, D, segs, links: [...links].map((x) => x.split('-').map(Number)) }; return frontC;
  }
  /** 이빨 달린 선(전선): pts 화면 점, 이빨은 side(+1 왼쪽 · −1 오른쪽) 쪽 */
  function teethLine(g, pts, rgb, al, side, kind) {
    if (pts.length < 2) return;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, a] of [[8, 0.16], [2.2, 0.9]]) { g.strokeStyle = `rgba(${rgb},${a * al})`; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
    if (kind !== 'defense') { g.restore(); return; } // 전선은 선만, 방어선만 반원
    g.fillStyle = `rgba(${rgb},${0.9 * al})`; g.strokeStyle = `rgba(${rgb},${0.9 * al})`; g.lineWidth = 1.4;
    let carry = 0; const step = kind === 'defense' ? 14 : 16;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dl = Math.hypot(b.x - a.x, b.y - a.y); if (dl < 0.5) continue;
      const ux = (b.x - a.x) / dl, uy = (b.y - a.y) / dl, nx = uy * side, ny = -ux * side;
      for (let t = step - carry; t < dl; t += step) {
        const x = a.x + ux * t, y = a.y + uy * t;
        if (kind === 'defense') { g.beginPath(); g.arc(x, y, 4, Math.atan2(ny, nx) - Math.PI / 2, Math.atan2(ny, nx) + Math.PI / 2); g.stroke(); } // 방어선: 반원(▷ 쪽이 적)
        else { g.beginPath(); g.moveTo(x - ux * 4, y - uy * 4); g.lineTo(x + ux * 4, y + uy * 4); g.lineTo(x + nx * 6, y + ny * 6); g.closePath(); g.fill(); } // 전선: 이빨
      }
      carry = (carry + dl) % step;
    }
    g.restore();
  }
  function drawFront(g, r) {
    const F = frontData(); if (!F.segs.length) return;
    const P = F.segs.map((x) => toScr(x.m, r)), deg = new Array(P.length).fill(0);
    g.save(); g.lineCap = 'round';
    for (const [w, a] of [[8, 0.14], [2.2, 0.85]]) { g.strokeStyle = `rgba(255,86,72,${a})`; g.lineWidth = w; g.beginPath(); for (const [i, j] of F.links) { g.moveTo(P[i].x, P[i].y); g.lineTo(P[j].x, P[j].y); } g.stroke(); }
    for (const [i, j] of F.links) { deg[i]++; deg[j]++; }
    g.fillStyle = 'rgba(255,96,82,0.92)'; g.strokeStyle = 'rgba(255,86,72,0.85)'; g.lineWidth = 2.2;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], d = F.segs[i].d, nx = -d.y, ny = d.x;
      if (!deg[i]) { g.beginPath(); g.moveTo(p.x + nx * 13, p.y + ny * 13); g.lineTo(p.x - nx * 13, p.y - ny * 13); g.stroke(); } // 외톨이 조각: 항로를 가로지르는 짧은 선
    }
    g.restore();
  }
  // 통치자가 그은 선(펜): 세이브별로 이 컴퓨터에 저장. kind front 전선(붉은 이빨) · defense 방어선(푸른 반원) · arrow 공격 화살표(금빛). 이빨·반원은 그은 방향의 왼쪽(적 쪽).
  const MARK_RGB = { front: '255,96,82', defense: '110,170,255', arrow: '255,214,120' };
  let pen = null, stroke = null, marks = [];
  const markKey = () => 'sllm_wr_marks:' + ((D && (D.sid || D.file)) || '');
  function loadMarks() { try { const v = JSON.parse(localStorage.getItem(markKey()) || '[]'); marks = Array.isArray(v) ? v.filter((m) => m && MARK_RGB[m.k] && Array.isArray(m.pts)).slice(0, 40) : []; } catch { marks = []; } }
  function saveMarks() { try { localStorage.setItem(markKey(), JSON.stringify(marks.slice(-40))); } catch { /* 저장 못 하면 이번 창에서만 */ } }
  function drawMarkPts(g, pts, k, al) {
    if (pts.length < 2) return;
    if (k === 'arrow') {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; const rgb = MARK_RGB.arrow;
      for (const [w, a] of [[9, 0.18], [2.4, 0.95]]) { g.strokeStyle = `rgba(${rgb},${a * al})`; g.lineWidth = w; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
      const z = pts[pts.length - 1]; let y = pts[pts.length - 2]; for (let i = pts.length - 2; i >= 0; i--) { y = pts[i]; if (Math.hypot(z.x - y.x, z.y - y.y) > 10) break; }
      const dl = Math.hypot(z.x - y.x, z.y - y.y) || 1, ux = (z.x - y.x) / dl, uy = (z.y - y.y) / dl;
      g.fillStyle = `rgba(${rgb},${al})`; g.beginPath(); g.moveTo(z.x + ux * 6, z.y + uy * 6); g.lineTo(z.x - ux * 10 - uy * 8, z.y - uy * 10 + ux * 8); g.lineTo(z.x - ux * 10 + uy * 8, z.y - uy * 10 - ux * 8); g.closePath(); g.fill();
      g.restore(); return;
    }
    teethLine(g, pts, MARK_RGB[k], al, 1, k);
  }
  function drawMarks(g, r) {
    for (const m of marks) drawMarkPts(g, m.pts.map((p) => toScr(p, r)), m.k, 0.95);
    if (stroke) drawMarkPts(g, stroke.pts.map((p) => toScr(p, r)), stroke.k, 0.7);
  }
  function eraseAt(p) { const r = box(); let hit = -1; marks.forEach((m, i) => { if (m.pts.some((q) => { const s = toScr(q, r); return Math.hypot(s.x - p.x, s.y - p.y) < 12; })) hit = i; }); if (hit >= 0) { marks.splice(hit, 1); saveMarks(); draw(); } }
  function setPen(k) { pen = pen === k ? null : k; armed = null; const w = document.getElementById('cvw'); if (w) w.style.cursor = pen ? (pen === 'erase' ? 'not-allowed' : 'crosshair') : ''; renderPen(); }
  function renderPen() {
    const el = document.getElementById('pen'); if (!el) return; el.textContent = '';
    const T = [['front', '⟿', L('전선 긋기', 'Draw a front line')], ['defense', '◠', L('방어선 긋기', 'Draw a defensive line')], ['arrow', '➜', L('공격 화살표', 'Draw an attack arrow')], ['erase', '⌫', L('선 지우기(선을 누름)', 'Erase a line (click it)')]];
    for (const [k, ic, tt] of T) { const b = h('button', 'pb' + (pen === k ? ' on' : ''), ic); b.type = 'button'; b.title = tt + (k === 'defense' ? L(' — 그은 방향의 왼쪽이 적 쪽', ' — the enemy side is to the left of the drawing direction') : ''); if (MARK_RGB[k]) b.style.setProperty('--mc', 'rgb(' + MARK_RGB[k] + ')'); b.onclick = () => setPen(k); el.append(b); }
    if (marks.length) { const c = h('button', 'pb', '✕'); c.type = 'button'; c.title = L('그은 선 모두 지우기', 'Clear all drawn lines'); c.onclick = () => { if (!c.dataset.arm) { c.dataset.arm = '1'; c.classList.add('on'); setTimeout(() => { delete c.dataset.arm; c.classList.remove('on'); }, 2500); return; } marks = []; saveMarks(); renderPen(); draw(); }; el.append(c); }
  }
  /** 회의에 넘길 선: 지나는 성계(가까운 이름 있는 성계, 차례대로) */
  function marksForCouncil() {
    return marks.map((m) => {
      const out = [];
      for (const p of m.pts) { let best = null, bd = 1e18; for (const s of D.systems) { if (!s.n) continue; const w = W(s), d = (w.x - p.x) ** 2 + (w.y - p.y) ** 2; if (d < bd) { bd = d; best = s; } } if (best && Math.sqrt(bd) < 40 && out[out.length - 1] !== best.n) out.push(best.n); }
      return { kind: m.k, systems: out.filter((n, i, a) => a.indexOf(n) === i).slice(0, 8) };
    }).filter((m) => m.systems.length);
  }
  // 작전안 방어선(LLM 의 line): 성계를 잇는 푸른 선, 반원은 적이 많은 쪽
  function planLine(g, r, ids, rgb, al) {
    const raw = ids.map((id) => sysById.get(id)).filter(Boolean); if (raw.length < 2) return;
    // AI 가 준 순서와 상관없이 지그재그가 안 되게: 서로 가장 먼 두 성계 중 하나에서 시작해 가까운 순으로 잇는다
    let s0 = raw[0], far = -1; for (const a of raw) for (const b of raw) { const d = (W(a).x - W(b).x) ** 2 + (W(a).y - W(b).y) ** 2; if (d > far) { far = d; s0 = a; } }
    const pts = [s0], left = raw.filter((x) => x !== s0); while (left.length) { const c = W(pts[pts.length - 1]); let bi = 0, bd = Infinity; left.forEach((x, i) => { const d = (W(x).x - c.x) ** 2 + (W(x).y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }); pts.push(left.splice(bi, 1)[0]); }
    const sp = pts.map((s) => toScr(W(s), r));
    let ex = 0, ey = 0, n = 0; for (const s of D.systems) if (s.o >= 0 && enemyOf(s.o)) { const w = W(s); ex += w.x; ey += w.y; n++; }
    let side = 1; if (n) { const c = toScr({ x: ex / n, y: ey / n }, r), a = sp[0], b = sp[sp.length - 1], cr = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); side = cr < 0 ? 1 : -1; }
    teethLine(g, sp, rgb, al, side, 'defense');
  }
  // 전략 표지(앱이 계산, 2026-11-05 사용자): 요충지 · 격전지 · 교차로 · 침공로 · 요새
  const STRAT_T = { chokepoint: ['요충지', 'Chokepoint'], contested: ['격전지', 'Contested'], junction: ['교차로', 'Junction'], invasion_route: ['침공로', 'Invasion route'], fortified: ['요새', 'Fortified'] };
  const stratOf = (id) => (LV && LV.strat ? LV.strat.find((x) => x.s === id) : null);
  const stratText = (z) => z.t.map((k) => (STRAT_T[k] ? L(...STRAT_T[k]) : k)).join(' · ') + (z.e ? L(` · 적 항로 ${z.e}`, ` · ${z.e} enemy lanes`) : '');
  function drawStrat(g, r, now) {
    if (!LV || !LV.strat) return;
    for (const z of LV.strat) {
      const s = sysById.get(z.s); if (!s) continue; const ch = z.t.includes('chokepoint'), co = z.t.includes('contested'); if (!ch && !co) continue;
      const p = toScr(W(s), r); if (p.x < -40 || p.y < -40 || p.x > r.width + 40 || p.y > r.height + 40) continue;
      const u0 = Math.max(4.5, Math.min(9, 6 * Math.sqrt(view.k))), big = s.sb && s.o >= 0, rgb = ch ? '255,214,120' : '255,120,96', rr = (ch ? 14 : 11) + (big ? u0 * 1.4 : 0); // 기지 무늬 바깥으로
      g.save(); g.strokeStyle = `rgba(${rgb},0.75)`; g.lineWidth = 1.3; g.setLineDash(ch ? [3, 3] : [2, 4]); g.lineDashOffset = -now / 120;
      if (ch) { g.beginPath(); g.moveTo(p.x, p.y - rr); g.lineTo(p.x + rr, p.y); g.lineTo(p.x, p.y + rr); g.lineTo(p.x - rr, p.y); g.closePath(); g.stroke(); } // 요충지: 금빛 마름모
      else { g.beginPath(); g.arc(p.x, p.y, rr, 0, Math.PI * 2); g.stroke(); } // 격전지: 붉은 점선 고리
      g.setLineDash([]);
      if (view.k > 0.9 || (hover && hover.id === s.id) || sel.sys === s.id) { g.font = 'bold 10px "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top'; const ty = p.y + (big ? Math.max(7, u0 * 2.6) : 7) + 13; /* 성계 이름 바로 아래 */ g.fillStyle = 'rgba(0,0,0,0.6)'; ft(g, L(...STRAT_T[ch ? 'chokepoint' : 'contested']), p.x + 1, ty + 1); g.fillStyle = `rgba(${rgb},0.95)`; ft(g, L(...STRAT_T[ch ? 'chokepoint' : 'contested']), p.x, ty); }
      g.restore();
    }
  }
  // 작전안 색(번호 순)
  const PLAN_RGB = ['95,212,228', '232,140,255', '140,235,140', '255,190,90', '255,120,170'];
  /** 작전 화살표: 항로를 따라 굵은 빛 띠 + 가운데 선 + 끝에 화살촉. role: main 굵게 · support 가늘게 · feint 점선 · defend 가늘게 */
  function opArrow(g, r, from, to, rgb, role, al, hot) {
    const path = route(from, to), pts = (path || [from, to]).map((id) => toScr(W(sysById.get(id)), r)); if (pts.length < 2) return;
    // 끝을 목적지 고리 바깥에서 멈춤
    const z = pts[pts.length - 1], y = pts[pts.length - 2], dx = z.x - y.x, dy = z.y - y.y, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, stop = Math.min(dl * 0.6, 20);
    const end = { x: z.x - ux * stop, y: z.y - uy * stop }, P = [...pts.slice(0, -1), end];
    const w = role === 'main' ? (hot ? 9 : 7) : (hot ? 6 : 4.5);
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = `rgba(${rgb},${0.22 * al})`; g.lineWidth = w; g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); // 빛 띠
    if (role === 'feint') g.setLineDash([6, 6]); g.lineDashOffset = -performance.now() / 40;
    g.strokeStyle = `rgba(${rgb},${0.9 * al})`; g.lineWidth = role === 'main' ? 2 : 1.3; g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]);
    const ah = role === 'main' ? 11 : 8, aw = ah * 0.6; // 화살촉
    g.fillStyle = `rgba(${rgb},${0.95 * al})`; g.beginPath(); g.moveTo(end.x + ux * ah * 0.4, end.y + uy * ah * 0.4); g.lineTo(end.x - ux * ah * 0.6 - uy * aw, end.y - uy * ah * 0.6 + ux * aw); g.lineTo(end.x - ux * ah * 0.6 + uy * aw, end.y - uy * ah * 0.6 - ux * aw); g.closePath(); g.fill();
    g.restore();
  }
  /** 함대 → 목적지 선(경로를 알면 항로를 따라 꺾어서, 모르면 직선) + 도착점에 「N칸」 */
  function drawRoute(g, r, from, to, color, dash, speed, width, label) {
    const a = sysById.get(from), b = sysById.get(to); if (!a || !b) return;
    const path = route(from, to), pts = (path || [from, to]).map((id) => toScr(W(sysById.get(id)), r));
    g.setLineDash(dash); g.lineDashOffset = -performance.now() / speed; g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round';
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    if (label) { const q = pts[pts.length - 1], txt = path ? L(`${path.length - 1}칸`, `${path.length - 1} jumps`) : L('경로 모름', 'route unknown'); g.font = '11px "Malgun Gothic", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.6)'; ft(g, txt, q.x + 19, q.y + 13); g.fillStyle = color; ft(g, txt, q.x + 18, q.y + 12); }
  }

  // ---- 영토(영향력 장) ----
  let terr = null; // { paths: Map(나라 → Path2D, 지도 좌표) }
  function territory() {
    const P = { R: 35, LANE: 20, OR: 30, OLANE: 20, F: 1.88, K: 0.155, EDGE: 0.8 }, T = 1.25;
    const pts = D.systems.map((s) => ({ s, p: W(s) })); if (!pts.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { p } of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const pad = P.R * P.F + 4; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const w = Math.ceil((x1 - x0) / T), hh = Math.ceil((y1 - y0) / T);
    // 나라 코드: 0 = 없음, 1 = 주인 없음, 2.. = 나라
    const codeOf = new Map(), owners = [null, null];
    const code = (o) => { if (o < 0) return 1; if (!codeOf.has(o)) { codeOf.set(o, owners.length); owners.push(o); } return codeOf.get(o); };
    const src = [];
    const add = (a, b, unit, c) => { const dx = b ? b.x - a.x : 0, dy = b ? b.y - a.y : 0, l2 = dx * dx + dy * dy; src.push({ ax: a.x, ay: a.y, dx, dy, inv: l2 > 0 ? 1 / l2 : 0, unit, c, reach: unit * P.F }); };
    for (const { s, p } of pts) add(p, null, s.o >= 0 ? P.R : P.OR, code(s.o));
    for (const { s, p } of pts) for (const t of s.hl) {
      const q = sysById.get(t); if (!q || (q.k && q.id < s.id)) continue;
      if (s.o >= 0 && q.o === s.o) add(p, W(q), P.LANE, code(s.o)); else if (s.o < 0 && q.o < 0) add(p, W(q), P.OLANE, 1);
    }
    // 격자 칸(80) 버킷
    const B = 80, bw = Math.ceil((x1 - x0) / B), bh = Math.ceil((y1 - y0) / B), buckets = Array.from({ length: bw * bh }, () => []);
    for (const so of src) {
      const ex = so.ax + so.dx, ey = so.ay + so.dy, r = so.reach;
      const bx0 = Math.max(0, Math.floor((Math.min(so.ax, ex) - r - x0) / B)), bx1 = Math.min(bw - 1, Math.floor((Math.max(so.ax, ex) + r - x0) / B));
      const by0 = Math.max(0, Math.floor((Math.min(so.ay, ey) - r - y0) / B)), by1 = Math.min(bh - 1, Math.floor((Math.max(so.ay, ey) + r - y0) / B));
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) buckets[by * bw + bx].push(so);
    }
    const n = owners.length, acc = new Float64Array(n), cell = new Uint16Array(w * hh), sd = new Float32Array(w * hh), touched = [];
    for (let j = 0; j < hh; j++) {
      const py = y0 + (j + 0.5) * T;
      for (let i = 0; i < w; i++) {
        const px = x0 + (i + 0.5) * T, list = buckets[Math.floor((py - y0) / B) * bw + Math.floor((px - x0) / B)];
        if (!list || !list.length) continue;
        touched.length = 0;
        for (const so of list) {
          let rx = px - so.ax, ry = py - so.ay;
          if (so.inv) { let t = (rx * so.dx + ry * so.dy) * so.inv; t = t < 0 ? 0 : t > 1 ? 1 : t; rx -= t * so.dx; ry -= t * so.dy; }
          const sd = Math.sqrt(rx * rx + ry * ry) / so.unit; if (sd > P.F) continue;
          if (acc[so.c] === 0) touched.push(so.c); acc[so.c] += Math.exp(-sd / P.K);
        }
        let best = 0, bd = Infinity, second = Infinity, bc = Infinity;
        for (const c of touched) { const d = -P.K * Math.log(acc[c]); if (d < bd) { second = bd; bd = d; best = c; } else if (d < second) second = d; if (c >= 2 && d < bc) bc = d; acc[c] = 0; }
        const q = j * w + i;
        if (best >= 2 && bd < P.EDGE) { cell[q] = best; sd[q] = P.R * Math.min(P.EDGE - bd, (second - bd) / 2); } // 국경까지 거리(세계 단위, 대략)
        else sd[q] = -P.R * Math.max(0.02, bc - P.EDGE, (bc - bd) / 2); // 땅 밖: 가장 가까운 나라 땅까지(음수)
      }
    }
    // 국경선: 나라마다 marching squares 로 0 등고선을 이어 닫힌 도형(Path2D, 지도 좌표) — 확대해도 매끈하게
    const paths = new Map();
    const X = (i) => x0 + (i + 0.5) * T, Y = (j) => y0 + (j + 0.5) * T;
    for (let c = 2; c < owners.length; c++) {
      const v = (i, j) => { if (i < 0 || j < 0 || i >= w || j >= hh) return -1; const q = j * w + i; return cell[q] === c ? sd[q] : cell[q] >= 2 ? -sd[q] : sd[q] < 0 ? sd[q] : -1; };
      // 이 나라 칸이 있는 범위만
      let i0 = w, i1 = -1, j0 = hh, j1 = -1;
      for (let q = 0; q < cell.length; q++) if (cell[q] === c) { const i = q % w, j = (q - i) / w; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
      if (i1 < 0) continue;
      i0 -= 1; j0 -= 1; i1 += 1; j1 += 1;
      const pt = new Map(), link = new Map();
      // 가장자리 번호: 가로(i,j)-(i+1,j) = ((j+1)*(w+2)+(i+1))*2, 세로(i,j)-(i,j+1) = …*2+1
      const ek = (i, j, vert) => (((j + 1) * (w + 2) + (i + 1)) * 2) + (vert ? 1 : 0);
      const point = (i, j, vert) => {
        const k = ek(i, j, vert); if (pt.has(k)) return k;
        const a = v(i, j), b = vert ? v(i, j + 1) : v(i + 1, j), t = a / (a - b);
        pt.set(k, vert ? [X(i), Y(j) + t * T] : [X(i) + t * T, Y(j)]); return k;
      };
      const join = (a, b) => { (link.get(a) || link.set(a, []).get(a)).push(b); (link.get(b) || link.set(b, []).get(b)).push(a); };
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const a = v(i, j) > 0, b = v(i + 1, j) > 0, cc = v(i + 1, j + 1) > 0, d = v(i, j + 1) > 0;
        const idx = (a ? 1 : 0) | (b ? 2 : 0) | (cc ? 4 : 0) | (d ? 8 : 0); if (idx === 0 || idx === 15) continue;
        const top = () => point(i, j, false), right = () => point(i + 1, j, true), bottom = () => point(i, j + 1, false), left = () => point(i, j, true);
        switch (idx) {
          case 1: case 14: join(left(), top()); break;
          case 2: case 13: join(top(), right()); break;
          case 3: case 12: join(left(), right()); break;
          case 4: case 11: join(right(), bottom()); break;
          case 6: case 9: join(top(), bottom()); break;
          case 7: case 8: join(left(), bottom()); break;
          case 5: join(left(), top()); join(right(), bottom()); break;
          case 10: join(top(), right()); join(left(), bottom()); break;
        }
      }
      const path = new Path2D(), seen = new Set();
      for (const start of link.keys()) {
        if (seen.has(start)) continue;
        let cur = start, prev = -1, n = 0; const p0 = pt.get(start); path.moveTo(p0[0], p0[1]); seen.add(start);
        while (n++ < 200000) {
          const nb = link.get(cur) || []; const nx = nb[0] !== prev ? nb[0] : nb[1]; if (nx === undefined) break;
          if (nx === start) break; if (seen.has(nx)) break;
          const p1 = pt.get(nx); path.lineTo(p1[0], p1[1]); seen.add(nx); prev = cur; cur = nx;
        }
        path.closePath();
      }
      paths.set(owners[c], path);
    }
    return { paths };
  }

  const shade = (hex, mul, add) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex); if (!m) return hex; return 'rgb(' + [m[1], m[2], m[3]].map((x) => Math.min(255, Math.round(parseInt(x, 16) * mul + add))).join(',') + ')'; };
  // ---- 그리기 ----
  // ---- 함대 기물 ----
  let pieceHits = []; // 화면에 세운 기물(누르기·툴팁): 캔버스 좌표 상자
  const hexRgb = (hx) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hx || ''); return m ? [1, 2, 3].map((k) => parseInt(m[k], 16)).join(',') : '232,200,114'; };
  /** 전쟁 상대 나라인가(지금 게임 보고의 WRWAR: 나라 번호 → 세이브 sllm_idx, 못 맞추면 이름). 보고가 없으면 모른다. */
  function enemyOf(o) {
    if (!LV || !D) return false; const c = D.countries[String(o)]; if (!c || c.me) return false;
    if (c.idx !== null && c.idx !== undefined && (LV.eidx || []).includes(c.idx)) return true;
    const nm = String(c.name || '').toLowerCase(); return !!nm && (LV.enemies || []).some((e) => String(e).toLowerCase() === nm);
  }
  // 함선 크기 아이콘(스텔라리스 gfx/interface/icons/ship_sizes.dds 를 흰 마스크로 옮긴 것, 30×30 칸). 번호 = 칸(1부터) — 모드 sllm_wr_big·src/galaxy.ts SIZE_ICON 과 같음.
  const SHIP_ICON = { w: 30, url: 'assets/rooms/warroom/ship_sizes.png' };
  const SHIP_NAME = { 2: ['코르벳', 'Corvette'], 14: ['프리깃', 'Frigate'], 3: ['구축함', 'Destroyer'], 4: ['순양함', 'Cruiser'], 5: ['전함', 'Battleship'], 6: ['타이탄', 'Titan'], 7: ['거상', 'Colossus'], 13: ['저거너트', 'Juggernaut'], 28: ['팔라딘', 'Paladin'],
    15: ['마울러', 'Mauler'], 16: ['마울러', 'Mauler'], 17: ['마울러', 'Mauler'], 18: ['위버', 'Weaver'], 19: ['위버', 'Weaver'], 20: ['위버', 'Weaver'], 21: ['하빈저', 'Harbinger'], 22: ['하빈저', 'Harbinger'], 23: ['하빈저', 'Harbinger'], 24: ['스팅어', 'Stinger'], 25: ['스팅어', 'Stinger'], 26: ['스팅어', 'Stinger'] };
  const shipImg = new Image(); let shipOk = false; shipImg.onload = () => { shipOk = true; tintCache.clear(); try { draw(); } catch { /* 아직 지도 없음 */ } }; shipImg.src = SHIP_ICON.url;
  const tintCache = new Map();
  function tinted(fr, rgb) { // 칸 하나를 색으로 물들인 작은 캔버스(캐시)
    const k = fr + '|' + rgb; let c = tintCache.get(k); if (c) return c;
    const W0 = SHIP_ICON.w; c = document.createElement('canvas'); c.width = W0; c.height = W0; const q = c.getContext('2d');
    q.drawImage(shipImg, (fr - 1) * W0, 0, W0, W0, 0, 0, W0, W0); q.globalCompositeOperation = 'source-in'; q.fillStyle = `rgb(${rgb})`; q.fillRect(0, 0, W0, W0);
    tintCache.set(k, c); return c;
  }
  /** 함대 아이콘 하나: (x, y) = 판 위 밑동. 판에 비친 빛 자리 + 빛 기둥 + 그 위에 선 함선 크기 아이콘(판이 눌린 만큼 세로를 펴서 서 있게). */
  function drawPiece(g, x, y, u, fr, rgb, on, foe, now) {
    g.save();
    g.fillStyle = `rgba(${rgb},${on ? 0.45 : 0.22})`; g.beginPath(); g.ellipse(x, y, u * 1.5, u * 0.55, 0, 0, Math.PI * 2); g.fill(); // 판에 비친 빛 자리
    if (on) { const pu = (Math.sin(now / 260) + 1) / 2; g.strokeStyle = `rgba(255,255,255,${0.4 + 0.5 * pu})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, u * (1.9 + pu * 0.6), u * (0.7 + pu * 0.2), 0, 0, Math.PI * 2); g.stroke(); }
    g.translate(x, y); g.scale(1, 1 / flat);
    const sz = u * 4, lift = u * 1.4; // 아이콘 크기·판에서 띄운 높이
    const gr = g.createLinearGradient(0, 0, 0, -lift); gr.addColorStop(0, `rgba(${rgb},0.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(-u * 0.12, -lift, u * 0.24, lift); // 빛 기둥
    const col = on ? '255,250,225' : rgb;
    if (shipOk && fr) {
      if (bgOn) { g.shadowColor = `rgba(${rgb},0.95)`; g.shadowBlur = on ? 14 : 9; }
      g.globalAlpha = foe ? 0.82 : 1; g.drawImage(tinted(fr, col), -sz / 2, -lift - sz, sz, sz);
    } else { // 그림을 못 읽으면 쐐기
      g.fillStyle = `rgb(${col})`; g.beginPath(); g.moveTo(0, -lift - sz); g.lineTo(sz / 2.4, -lift); g.lineTo(-sz / 2.4, -lift); g.closePath(); g.fill();
    }
    g.restore();
  }
  // 업그레이드된 항성기지(우주항 이상, 2026-11-05 사용자): 게임 starbase_ship_sizes_medium.dds 의 등급 그림 — 윗줄 = 무늬(가운데를 비워 별이 보이게), 아랫줄 = 육각 판(32×36 칸, 1 전초기지 ~ 5 성채)
  const SB_ICON = { w: 32, h: 36, url: 'assets/rooms/warroom/starbases.png' };
  const SB_NAME = { 2: ['우주항', 'Starport'], 3: ['항성 요새', 'Starhold'], 4: ['성채 요새', 'Star Fortress'], 5: ['성채', 'Citadel'] };
  const sbImg = new Image(); let sbOk = false; sbImg.onload = () => { sbOk = true; sbCache.clear(); try { draw(); } catch { /* 아직 지도 없음 */ } }; sbImg.src = SB_ICON.url;
  const sbCache = new Map();
  function sbTint(lv, row, rgb) {
    const k = lv + '|' + row + '|' + rgb; let c = sbCache.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = SB_ICON.w; c.height = SB_ICON.h; const q = c.getContext('2d');
    q.drawImage(sbImg, (lv - 1) * SB_ICON.w, row * SB_ICON.h, SB_ICON.w, SB_ICON.h, 0, 0, SB_ICON.w, SB_ICON.h); q.globalCompositeOperation = 'source-in'; q.fillStyle = `rgb(${rgb})`; q.fillRect(0, 0, SB_ICON.w, SB_ICON.h);
    sbCache.set(k, c); return c;
  }
  /** 항성기지 하나(2026-11-05 사용자): 등급 무늬의 가운데 고리가 별을 감싸도록 판 위에 눕혀 그린다(별 = 고리 한가운데). 무늬 중심 = 칸의 (16, 18.5). */
  function drawStarbase(g, x, y, u, lv, rgb, now) {
    if (!sbOk) return;
    const w = u * 4.4, h = w * SB_ICON.h / SB_ICON.w, cx = w * 16 / SB_ICON.w, cy = h * 18.5 / SB_ICON.h;
    g.save();
    const gl = g.createRadialGradient(x, y, 0, x, y, w * 0.55); gl.addColorStop(0, `rgba(${rgb},0.18)`); gl.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gl; g.beginPath(); g.arc(x, y, w * 0.55, 0, Math.PI * 2); g.fill(); // 기지 둘레 은은한 빛
    if (bgOn) { g.shadowColor = `rgba(${rgb},0.95)`; g.shadowBlur = 7; }
    g.globalAlpha = 0.85 + 0.15 * Math.sin(now / 900 + x);
    g.drawImage(sbTint(lv, 0, rgb), x - cx, y - cy, w, h);
    g.restore();
  }
  const pieceAt = (p) => { for (let i = pieceHits.length - 1; i >= 0; i--) { const b = pieceHits[i]; if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) return b; } return null; };
  function draw() {
    if (!cv || !ctx2) return;
    const r = box(), dpr = (window.devicePixelRatio || 1) * 1.35; // 기울인 탁자에서도 또렷하게
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = ctx2; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 바탕
    // 탁자 면: 투명 바탕에 옅은 빛(방이 비쳐 보이는 홀로그램)
    g.clearRect(0, 0, r.width, r.height);
    const bg = g.createRadialGradient(r.width / 2, r.height / 2, 0, r.width / 2, r.height / 2, Math.max(r.width, r.height) * 0.55);
    if (bgOn) { bg.addColorStop(0, 'rgba(' + HG() + ',0.10)'); bg.addColorStop(0.7, 'rgba(' + HG() + ',0.05)'); bg.addColorStop(1, 'rgba(' + HG() + ',0.02)'); } // 홀로그램: 빛만(화면 합성 screen — 탁자가 비쳐 보임)
    else { bg.addColorStop(0, 'rgba(10,46,60,0.55)'); bg.addColorStop(1, 'rgba(3,14,20,0.35)'); }
    g.fillStyle = bg; g.fillRect(0, 0, r.width, r.height);
    if (!D) return;
    // 은하 중심 고리
    const c0 = toScr({ x: 0, y: 0 }, r); g.strokeStyle = 'rgba(95,212,228,0.06)'; g.lineWidth = 1;
    for (let rr = 100; rr <= 500; rr += 100) { g.beginPath(); g.arc(c0.x, c0.y, rr * view.k, 0, Math.PI * 2); g.stroke(); }
    // 영토(미리 계산한 격자 그림을 지금 확대에 맞춰 늘려 그림)
    if (terr) {
      g.save(); g.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * (r.width / 2 - view.cx * view.k), dpr * (r.height / 2 - view.cy * view.k));
      const px = 1 / view.k; // 화면 1px 을 지도 단위로
      for (const [o, path] of terr.paths) {
        const col = (D.countries[String(o)] || {}).color || '#8a9aa6', me = o === D.player;
        // 옅은 바탕
        g.globalAlpha = me ? 0.16 : 0.11; g.fillStyle = col; g.fill(path, 'evenodd');
        // 안쪽으로 번지는 빛(넓고 옅게 → 좁고 진하게, 도형 안에만)
        g.save(); g.clip(path, 'evenodd'); g.lineJoin = 'round'; g.strokeStyle = shade(col, 1.15, 30);
        for (const [wpx, al] of [[34, 0.035], [28, 0.035], [22, 0.04], [17, 0.045], [12, 0.05], [8, 0.06], [4.5, 0.08], [2.5, 0.1]]) { g.globalAlpha = al * (me ? 1.25 : 1); g.lineWidth = wpx * px; g.stroke(path); }
        g.restore();
        // 가는 국경선(화면 기준 1.3px, 밝게)
        g.globalAlpha = 0.95; g.strokeStyle = shade(col, 1.25, 45); g.lineWidth = (me ? 1.6 : 1.3) * px; g.lineJoin = 'round'; g.stroke(path);
      }
      g.restore(); g.globalAlpha = 1;
    }
    if (LV && LV.war !== false) drawFront(g, r); // 전선(전쟁 상대가 있을 때)
    // 항로
    g.lineWidth = 1; g.strokeStyle = bgOn ? 'rgba(' + HG() + ',0.45)' : 'rgba(120,205,230,0.32)'; g.beginPath();
    if (bgOn) { g.shadowColor = 'rgba(' + HG() + ',0.9)'; g.shadowBlur = 6; } // 홀로그램 빛 번짐
    for (const s of D.systems) { if (!s.k) continue; const a = toScr(W(s), r); for (const t of s.hl) { const q = sysById.get(t); if (!q || (q.k && q.id < s.id)) continue; const b = toScr(W(q), r); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); } }
    g.stroke();
    // 이동 중인 우리 함대: 목적지까지 점선
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(232,200,114,0.7)';
    for (const f of D.fleets) { if (f.o !== D.player || f.to < 0 || f.to === f.s) continue; const a = sysById.get(f.s), b = sysById.get(f.to); if (!a || !b) continue; const p = toScr(W(a), r), q = toScr(W(b), r); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    g.setLineDash([]);
    // 내가 방금 내린 명령: 함대 → 목적지 금빛 선 + 맥박 고리
    const now = performance.now(), pulse = (Math.sin(now / 260) + 1) / 2;
    // 고른 함대 → 고른 성계: 명령 전 미리 보기(옅게)
    { const fi = selFid(), F0 = fi !== null ? liveFleet(fi) : null; if (F0 && F0.s >= 0 && sel.sys !== null && sel.sys !== F0.s && orders.get(fi) !== sel.sys) drawRoute(g, r, F0.s, sel.sys, 'rgba(232,200,114,0.45)', [2, 5], 60, 1.2, true); }
    for (const [fid, to] of orders) {
      const f = liveFleet(fid), a = f && sysById.get(f.s), b = sysById.get(to); if (!b) continue; const q = toScr(W(b), r);
      if (a) drawRoute(g, r, f.s, to, 'rgba(232,200,114,0.85)', [6, 5], 40, 1.4, true);
      g.strokeStyle = `rgba(232,200,114,${0.35 + 0.5 * pulse})`; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, 12 + 5 * pulse, 0, Math.PI * 2); g.stroke();
    }
    // 작전 지도(2026-11-05 사용자): 회의·건의 작전안을 늘 지도에 — 갈래마다 함대에서 목적지까지 굵은 화살표(주공 실선 · 지원 가는 선 · 견제 점선 · 방어 방패),
    // 목적지에 번호 표식. 가리킨(고른) 안은 진하게, 나머지는 옅게. 승인한 안은 지움(이동 명령선이 대신 그림).
    if (CO && CO.council) (CO.council.plans || []).forEach((pl, i) => {
      if (pl.done && hiPlan !== pl.id) return;
      const hot = hiPlan === pl.id, rgb = PLAN_RGB[i % PLAN_RGB.length], al = hot ? 1 : coOpen ? 0.55 : 0.38;
      const cap = D.systems.find((x) => x.cap === D.player);
      const legs = pl.moves && pl.moves.length ? pl.moves : [{ fleets: pl.fleets, sys: pl.act === 'move' ? pl.sys : pl.act === 'home' && cap ? cap.id : -1, role: 'main' }];
      for (const lg of legs) {
        const tgt = lg.sys >= 0 ? sysById.get(lg.sys) : null; if (!tgt) continue;
        for (const fid of lg.fleets) { const f = liveFleet(fid); if (f && f.s >= 0 && f.s !== tgt.id) opArrow(g, r, f.s, tgt.id, rgb, lg.role, al, hot); }
        const q = toScr(W(tgt), r);
        if (lg.role === 'defend') { g.strokeStyle = `rgba(${rgb},${al})`; g.lineWidth = hot ? 2 : 1.4; g.beginPath(); g.moveTo(q.x, q.y - 16); g.lineTo(q.x + 12, q.y - 10); g.lineTo(q.x + 10, q.y + 6); g.lineTo(q.x, q.y + 14); g.lineTo(q.x - 10, q.y + 6); g.lineTo(q.x - 12, q.y - 10); g.closePath(); g.stroke(); }
      }
      if (pl.lineSys && pl.lineSys.length >= 2) planLine(g, r, pl.lineSys, rgb, al); // 작전안의 방어선
      const main = legs.find((x) => x.role === 'main') || legs[0], tgt = main && main.sys >= 0 ? sysById.get(main.sys) : null; if (!tgt) return;
      const q = toScr(W(tgt), r), rr = 15 + (hot ? 6 * pulse : 2 * pulse);
      g.strokeStyle = `rgba(${rgb},${al})`; g.lineWidth = hot ? 2 : 1.2;
      g.beginPath(); g.arc(q.x, q.y, rr, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + now / 1600; g.beginPath(); g.moveTo(q.x + Math.cos(an) * (rr + 3), q.y + Math.sin(an) * (rr + 3)); g.lineTo(q.x + Math.cos(an) * (rr + 9), q.y + Math.sin(an) * (rr + 9)); g.stroke(); }
      g.font = 'bold 12px "Malgun Gothic", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      const lab = (i + 1) + '  ' + (pl.code ? '「' + pl.code + '」' + (hot ? ' ' + pl.title : '') : (hot || coOpen ? pl.title : '')); g.fillStyle = 'rgba(0,0,0,0.65)'; ft(g, lab, q.x + rr + 9, q.y - rr + 1); g.fillStyle = `rgba(${rgb},${Math.min(1, al + 0.25)})`; ft(g, lab, q.x + rr + 8, q.y - rr);
    });
    drawStrat(g, r, now); // 요충지·격전지
    drawMarks(g, r); // 통치자가 그은 선
    g.shadowBlur = 0;
    // 별
    if (bgOn) { g.shadowColor = 'rgba(' + HG() + ',0.95)'; g.shadowBlur = 8; }
    for (const s of D.systems) {
      const p = toScr(W(s), r); if (p.x < -20 || p.y < -20 || p.x > r.width + 20 || p.y > r.height + 20) continue;
      const big = s.k || s.n, sz = (big ? 2.2 : 1.2) * Math.min(2, Math.max(0.8, view.k));
      g.fillStyle = s.o >= 0 ? '#e8f6fa' : big ? '#cfe9f0' : 'rgba(170,200,215,0.45)';
      g.beginPath(); g.arc(p.x, p.y, sz, 0, Math.PI * 2); g.fill();
      if (s.c > 0) { g.strokeStyle = 'rgba(140,230,160,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, sz + 2.5, 0, Math.PI * 2); g.stroke(); }
      if (s.cap !== undefined) { const cc = (D.countries[String(s.cap)] || {}).color || '#fff'; g.strokeStyle = cc; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, p.y - 7); g.lineTo(p.x + 7, p.y); g.lineTo(p.x, p.y + 7); g.lineTo(p.x - 7, p.y); g.closePath(); g.stroke(); }
      if ((hover && hover.id === s.id) || (sel.sys === s.id)) { g.strokeStyle = sel.sys === s.id ? '#e8c872' : '#5fd4e4'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.stroke(); }
    }
    g.shadowBlur = 0;
    // 함대 = 판 위에 세운 홀로그램 아이콘(2026-11-05 사용자). 모양 = 그 함대에서 가장 큰 배의 스텔라리스 함선 크기 아이콘(타이탄이 있으면 타이탄).
    // 우리 = 금빛(빌려 온 함대는 그 나라 색, 지금 게임 위치), 적 = 붉은 아이콘(세이브 때 마지막으로 본 위치), 그 밖의 군함 = 작은 회색 쐐기.
    pieceHits = [];
    const u = Math.max(4.5, Math.min(9, 6 * Math.sqrt(view.k))), pmax = Math.max(1, ...[...fleetsAt.values()].flat().filter((f) => f.cl === 'military').map((f) => f.p || 0));
    const frameOf = (f) => f.bg || ((f.p || 0) >= pmax * 0.6 ? 5 : (f.p || 0) >= pmax * 0.25 ? 4 : 2); // 가장 큰 배 아이콘(모르면 전력으로 전함·순양함·코르벳)
    for (const s of D.systems) { // 업그레이드된 항성기지: 무늬 가운데 고리가 별을 감싼다
      if (!s.sb || s.o < 0) continue; const p = toScr(W(s), r); if (p.x < -40 || p.y < -40 || p.x > r.width + 40 || p.y > r.height + 60) continue;
      const rgb = s.o === D.player ? '232,200,114' : enemyOf(s.o) ? '255,96,82' : hexRgb((D.countries[String(s.o)] || {}).color || '#9aa8b4');
      drawStarbase(g, p.x, p.y, u, s.sb, rgb, now);
      pieceHits.push({ x0: p.x - u * 2, x1: p.x + u * 2, y0: p.y - u * 2, y1: p.y + u * 2, sb: s, s: s.id });
    }
    for (const [sid, list] of fleetsAt) {
      const s = sysById.get(sid); if (!s) continue; const p = toScr(W(s), r); if (p.x < -40 || p.y < -40 || p.x > r.width + 40 || p.y > r.height + 60) continue;
      const mine = [], foe = []; let i = 0;
      for (const f of list) {
        if (f.cl !== 'military') continue;
        if (f.o === D.player) { mine.push(f); continue; }
        if (enemyOf(f.o)) { foe.push(f); continue; }
        const ox = p.x + 9 + (i % 3) * 7, oy = p.y - 9 - Math.floor(i / 3) * 7, sz = 3; i++; // 전쟁 상대가 아닌 남의 군함
        g.fillStyle = 'rgba(160,175,188,0.55)'; g.beginPath(); g.moveTo(ox, oy - sz); g.lineTo(ox + sz, oy + sz); g.lineTo(ox - sz, oy + sz); g.closePath(); g.fill();
      }
      const side = (arr, dir, rgb) => {
        arr.sort((x, y) => (y.p || 0) - (x.p || 0)); const n = Math.min(3, arr.length), gap = u * 3.4;
        for (let k = n - 1; k >= 0; k--) { // 뒤(먼 쪽)부터 그려 앞 기물이 위에
          const f = arr[k], x = p.x + dir * (u * 2.6 + k * gap), y = p.y + 1 + (k % 2) * u * 0.5, on = sel.fleet !== null && sel.fleet === f.id;
          drawPiece(g, x, y, u, frameOf(f), typeof rgb === 'function' ? rgb(f) : rgb, on, dir > 0, now);
          pieceHits.push({ x0: x - u * 2, x1: x + u * 2, y0: y - u * 5.4 / flat, y1: y + u * 0.6, f, foe: dir > 0, s: sid });
        }
        if (arr.length > n) { g.fillStyle = dir > 0 ? '#ff8a7a' : '#f1d58a'; g.font = 'bold 11px "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; ft(g, '+' + (arr.length - n), p.x + dir * (u * 2.6 + n * gap - u), p.y - u * 1.5 / flat); }
      };
      if (mine.length) side(mine, -1, (f) => (f.aidx ? hexRgb(allyColor(f.aidx)) : '232,200,114'));
      if (foe.length) side(foe, 1, '255,96,82');
    }
    g.shadowBlur = 0;
    // 끄는 중·집어 든 함대: 놓을(누를) 성계까지 항로 미리 보기 + 끄는 아이콘
    { const fid = pdrag && pdrag.moved ? pdrag.fid : armed, F = fid !== null && fid !== undefined ? liveFleet(fid) : null, to = pdrag && pdrag.moved ? pdrag.to : (hover ? hover.id : null);
      if (F && F.s >= 0) {
        if (to !== null && to !== F.s) { drawRoute(g, r, F.s, to, 'rgba(255,236,170,0.95)', [5, 4], 50, 1.6, true); const q = toScr(W(sysById.get(to)), r); g.strokeStyle = `rgba(255,236,170,${0.5 + 0.4 * pulse})`; g.lineWidth = 1.6; g.beginPath(); g.arc(q.x, q.y, 11 + 4 * pulse, 0, Math.PI * 2); g.stroke(); }
        if (pdrag && pdrag.moved) { g.save(); g.globalAlpha = 0.75; drawPiece(g, pdrag.cur.x, pdrag.cur.y + u * 1.4, u, F.bg || 5, '255,236,170', true, false, now); g.restore(); }
      } }
    // 이름: 확대했거나 수도·고른 성계
    g.font = '11px "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (const s of D.systems) {
      if (!s.n) continue; const show = view.k > 1.6 || s.cap !== undefined || sel.sys === s.id || (hover && hover.id === s.id) || (s.o === D.player && view.k > 0.9);
      if (!show) continue; const p = toScr(W(s), r); if (p.x < -60 || p.y < -20 || p.x > r.width + 60 || p.y > r.height + 20) continue;
      const dy = s.sb && s.o >= 0 ? Math.max(7, u * 2.6) : 7; // 항성기지 무늬 아래로
      g.fillStyle = 'rgba(0,0,0,0.6)'; ft(g, s.n, p.x + 1, p.y + dy + 1); g.fillStyle = s.cap !== undefined ? '#f2f7f8' : 'rgba(205,228,236,0.85)'; ft(g, s.n, p.x, p.y + dy);
    }
  }

  // ---- 화면 틀 ----
  const clsName = (c) => c === 'science_ship' ? L('과학선', 'Science ship') : c === 'constructor' ? L('건설선', 'Construction ship') : c === 'colonizer' ? L('식민선', 'Colony ship') : c === 'transport' ? L('수송선', 'Transport') : L('함선', 'Ship');
  function sysName(id) { const s = sysById.get(id); return s ? (s.n || L('알 수 없는 성계', 'Unknown system')) : '?'; }
  function render() {
    $('ttl').textContent = L('작전지휘실', 'WAR ROOM');
    $('when').textContent = D ? L(`은하 작전도 · 세이브 기준 ${D.date}`, `GALACTIC MAP · AS OF SAVE ${D.date}`) : L('은하 작전도', 'GALACTIC MAP');
    const bt = $('btns'); bt.textContent = '';
    const mk = (t, fn, cls) => { const b = h('button', 'wb' + (cls ? ' ' + cls : ''), t); b.type = 'button'; b.onclick = fn; bt.append(b); return b; };
    mk(L('우리 수도로', 'Our capital'), () => { home(); draw(); });
    const rf = mk(busy ? L('읽는 중…', 'Reading…') : L('새로 읽기', 'Reload'), () => load(true)); rf.disabled = busy;
    if (window.sllm.warroomCouncil) { const cb = mk(coOpen ? L('작전 회의 닫기', 'Close council') : L('작전 회의', 'War council'), () => { coOpen = !coOpen; if (coOpen && !(CO && CO.council && CO.council.lines.length)) convene(''); render(); anim(); draw(); }, 'co'); cb.disabled = !LV; if (!LV) cb.title = liveErr || ''; }
    mk(L('나가기 ✕', 'Leave ✕'), close, 'x');
    // 왼쪽: 우리 함대 — 지금 게임에서 읽은 군 함대(명령 가능). 게임에서 못 읽으면 세이브 기준 목록만.
    const lp = $('lp'); lp.textContent = '';
    lp.append(h('p', 'sec', L('우리 함대', 'OUR FLEETS')));
    if (LV) {
      const list = [...LV.fleets].sort((a, b) => b.p - a.p);
      if (!list.length) lp.append(h('small', '', L('군 함대가 없습니다.', 'No warfleets.')));
      for (const f of list) {
        const id = 'L' + f.fid, b = h('button', 'fl' + (sel.fleet === id ? ' on' : '')); b.type = 'button';
        const where = f.s >= 0 ? sysName(f.s) : (f.at || L('이동 중', 'In transit')), to = orders.get(f.fid);
        if (f.aidx) { b.classList.add('al'); b.style.setProperty('--ac', allyColor(f.aidx)); }
        b.append(h('b', '', f.n), ...(f.aidx ? [h('small', 'altag', f.xf ? L(`${f.ally} 연합 원정군`, `${f.ally} Expeditionary Force`) : L(`동맹 ${f.ally}에서 빌려 옴`, `On loan from ${f.ally}`))] : []), h('small', '', L(`전력 ${f.p}`, `Power ${f.p}`) + (f.adm ? ' · ' + f.adm : '')), h('small', '', (f.fight ? L('⚔ 교전 중', '⚔ In combat') : f.modeText) + ' · ' + where + (to !== undefined ? ' → ' + sysName(to) : '')));
        b.onclick = () => { sel = { sys: f.s >= 0 ? f.s : sel.sys, fleet: id }; armed = f.s >= 0 ? f.fid : null; /* 목록에서 골라도 집어 든다 */ if (f.s >= 0) flyTo(f.s, 1.8); render(); draw(); };
        lp.append(b);
      }
      lp.append(h('small', 'note', L('지도에서 우리 함대 아이콘을 끌어 성계에 놓거나, 아이콘(또는 이 목록)을 누른 뒤 성계·적 함대·기지를 누르면 그리로 이동합니다. 우클릭 = 바로 이동, Esc = 취소.', 'Drag one of our fleet icons onto a system, or click the icon (or this list) and then click a system, enemy fleet or starbase to move there. Right-click = move at once, Esc = cancel.')));
      // 합동 작전 동맹(연방·방위 조약·같은 편 전쟁): 함대 지원을 청하면 빌려 온 함대가 위 목록에 들어와 우리 명령을 받는다(함대 사령부 「합동 작전」과 같은 계약).
      if (LV.allies && LV.allies.length && (window.sllm.warroomXfAsk || window.sllm.foAllyAsk)) {
        const sc = h('p', 'sec', L('합동 작전 동맹', 'JOINT-OPERATION ALLIES')); sc.style.marginTop = '14px'; lp.append(sc);
        const ALN = 5, list = alOpen ? LV.allies : LV.allies.slice(0, ALN); // 순서: 원정군·함대를 보낸 나라 → 같은 편 전쟁 → 연방 → 방위 조약(앱이 정렬). 5개 넘으면 접음
        for (const a of list) {
          const d = h('div', 'alrow'); d.style.setProperty('--ac', allyColor(a.idx));
          const lidA = -(1000 + a.idx), nm = h('b', 'alname' + (fav.has(lidA) ? ' fav' : ''), (fav.has(lidA) ? '✋ ' : '') + a.name); nm.title = L('누르면 이 나라 연락관에게 발언 요청(다음 회의에서 먼저 말함)', "Click to call on this ally's liaison (speaks first at the next council)"); nm.onclick = () => toggleFav(lidA);
          d.append(nm, h('small', '', a.relText + (a.xf ? L(` · 연합 원정군 함대 ${a.xf}`, ` · expeditionary force: ${a.xf} fleet(s)`) : '') + (a.n ? L(` · 빌려 온 함대 ${a.n}`, ` · ${a.n} fleet(s) on loan`) : '')));
          const last = (LV.autos || []).filter((x) => x.aidx === a.idx).pop(); // 빌려 온 함대가 스스로 한 최근 행동
          if (last) { const q = h('small', 'alauto', (last.date ? last.date + ' · ' : '') + last.text); d.append(q); }
          if (a.xf) d.append(h('small', 'alnote', L('연합 원정군은 그 나라가 5년 계약으로 보낸 별도 세력입니다. 쉬는 동안 스스로 움직이고, 우리 명령은 「요청」이라 거절할 수도 있습니다. 전쟁에 끼지 않고 우리·그 나라의 적과만 싸웁니다.', "The expeditionary force is a separate force they sent on a 5-year contract. It acts on its own when idle; our orders are requests it may refuse. It joins no war, but fights our and their enemies.")));
          else if (a.n) d.append(h('small', 'alnote', L('빌려 온 함대는 쉬는 동안 스스로 움직입니다. 우리 명령은 「요청」이라 거절할 수도 있습니다.', 'Borrowed fleets act on their own when idle. Our orders are requests — they may refuse.')));
          const bt = h('button', 'wb', allyBusy === a.idx ? L('응답을 기다리는 중…', 'Waiting for reply…') : a.xf ? L('원정군 돌려보내기', 'Send the force home') : a.n ? L('함대 돌려보내기', 'Send fleets back') : window.sllm.warroomXfAsk ? L('연합 원정군 요청', 'Request an expeditionary force') : L('함대 지원 요청', 'Request fleets')); bt.type = 'button'; bt.disabled = allyBusy !== null;
          bt.onclick = () => (a.xf ? xfEnd(a) : a.n ? allyReturn(a) : window.sllm.warroomXfAsk ? xfAsk(a) : allyAsk(a)); d.append(bt); lp.append(d);
        }
        if (LV.allies.length > ALN) { const mb = h('button', 'wb', alOpen ? L('접기', 'Show fewer') : L(`동맹 ${LV.allies.length - ALN}개 더 보기`, `Show ${LV.allies.length - ALN} more allies`)); mb.type = 'button'; mb.style.width = '100%'; mb.onclick = () => { alOpen = !alOpen; render(); }; lp.append(mb); }
      }
    } else {
      const mine = D ? D.fleets.filter((f) => f.o === D.player).sort((a, b) => (b.cl === 'military') - (a.cl === 'military') || b.p - a.p) : [];
      if (!mine.length) lp.append(h('small', '', D ? L('함대가 없습니다.', 'No fleets.') : ''));
      for (const f of mine) {
        const b = h('button', 'fl' + (sel.fleet === f.id ? ' on' : '')); b.type = 'button';
        b.append(h('b', '', f.n), h('small', '', (f.cl === 'military' ? L(`전력 ${f.p} · 함선 ${f.sh}`, `Power ${f.p} · ${f.sh} ships`) : clsName(f.cl)) + ' · ' + sysName(f.s) + (f.mv && f.to >= 0 ? ` → ${sysName(f.to)}` : '')));
        b.onclick = () => { sel = { sys: f.s, fleet: f.id }; flyTo(f.s, 1.8); render(); draw(); };
        lp.append(b);
      }
      const nt = h('small', 'note', liveBusy ? L('지금 게임의 함대를 읽는 중…', 'Reading fleets from the game…') : (liveErr ? liveErr + ' ' : '') + L('(세이브 기준 목록 — 명령은 게임이 켜져 있을 때)', '(As of the save — orders need the game running)'));
      lp.append(nt);
      if (!liveBusy && D && window.sllm.warroomLive) { const rb = h('button', 'wb', L('게임에서 다시 읽기', 'Read from game')); rb.type = 'button'; rb.style.marginTop = '8px'; rb.onclick = () => loadLive(); lp.append(rb); }
    }
    // 오른쪽: 고른 성계 + 명령
    const rp = $('rp'); rp.textContent = '';
    const s = sel.sys !== null ? sysById.get(sel.sys) : null, fid = selFid(), F = fid !== null ? liveFleet(fid) : null;
    if (F) {
      const box = h('div', 'cmd'); box.append(h('p', 'sec', L('함대 명령', 'FLEET ORDERS')), h('b', 'cmdf', F.n));
      box.append(h('small', '', (F.s >= 0 ? sysName(F.s) : (F.at || L('이동 중', 'In transit'))) + ' · ' + F.modeText));
      const row = h('div', 'cmdr');
      const btn = (t, fn, cls, dis) => { const b = h('button', 'wb' + (cls ? ' ' + cls : ''), t); b.type = 'button'; b.onclick = fn; b.disabled = !!dis; row.append(b); return b; };
      if (s && s.id !== F.s) { const rt = F.s >= 0 ? route(F.s, s.id) : null, j = rt ? L(` · ${rt.length - 1}칸`, ` · ${rt.length - 1} jumps`) : ''; btn(L(`▶ ${s.n || L('이 성계', 'this system')}(으)로 이동`, `▶ Move to ${s.n || 'this system'}`) + j, () => order(F.fid, 'move', s.id), 'go'); }
      else btn(L('지도에서 목적지 성계를 누르세요', 'Click a destination on the map'), () => {}, '', true);
      btn(L('수도로 귀환', 'Return to capital'), () => order(F.fid, 'home', null));
      btn(L('정지', 'Hold'), () => order(F.fid, 'hold', null));
      box.append(row);
      if (F.mode === 3 || F.mode === 2) box.append(h('small', 'note', L('명령을 내리면 이 함대는 직접 지휘로 바뀌어 자동 작전에서 빠집니다(함대 사령부 「자동 작전」에서 되돌릴 수 있음).', 'Ordering this fleet switches it to direct command, out of automated operations (revert in Fleet Command → Automated operations).')));
      rp.append(box);
    }
    rp.append(h('p', 'sec', L('성계 정보', 'SYSTEM')));
    if (!s) rp.append(h('small', '', L('지도에서 성계를 누르세요. 끌어서 이동, 휠로 확대합니다.', 'Click a system on the map. Drag to pan, wheel to zoom.')));
    else {
      rp.append(h('h2', '', s.n || L('알 수 없는 성계', 'Unknown system')));
      const kv = (a, b) => { const d = h('div', 'kv'); d.append(h('span', '', a), h('span', '', b)); rp.append(d); };
      const ow = s.o >= 0 ? D.countries[String(s.o)] : null;
      kv(L('주인', 'Owner'), ow ? ow.name + (ow.me ? L(' (우리)', ' (us)') : '') : L('없음 / 알 수 없음', 'None / unknown'));
      if (s.cap !== undefined) kv(L('수도', 'Capital'), (D.countries[String(s.cap)] || {}).name || '?');
      kv(L('식민지', 'Colonies'), String(s.c || 0));
      if (s.sb) kv(L('항성기지', 'Starbase'), L(...SB_NAME[s.sb]));
      { const zt = stratOf(s.id); if (zt && zt.t.length) kv(L('전략', 'Strategic'), stratText(zt)); }
      kv(L('항로', 'Hyperlanes'), s.k ? String(s.hl.length) : L('알 수 없음', 'Unknown'));
      const here = fleetsAt.get(s.id) || [];
      const sc = h('p', 'sec', L('이곳의 함대', 'FLEETS HERE')); sc.style.marginTop = '14px'; rp.append(sc);
      if (!here.length) rp.append(h('small', '', L('보이는 함대가 없습니다.', 'No visible fleets.')));
      for (const f of here) { const c = D.countries[String(f.o)] || {}, foe = f.o !== D.player && f.cl === 'military' && enemyOf(f.o); const d = h('div', 'kv' + (foe ? ' foe' : '')); d.append(h('span', '', (f.o === D.player ? '▲ ' : foe ? '⚔ ' : '△ ') + f.n + (foe ? L(' (마지막 위치)', ' (last seen)') : '')), h('span', '', f.cl === 'military' ? L(`전력 ${f.p}`, `Power ${f.p}`) : '')); d.title = c.name || ''; rp.append(d); }
      if (LV && !F) rp.append(h('small', 'note', L('왼쪽에서 우리 함대를 고르면 이 성계로 보낼 수 있습니다.', 'Pick one of our fleets on the left to send it here.')));
    }
    renderCouncil();
    renderCrew();
    renderPen();
    // 아래 범례
    const bot = $('bot'); bot.textContent = ''; bot.style.display = coOpen ? 'none' : 'flex';
    for (const [a, b, c] of [['◆', L('수도', 'capital')], ['○', L('식민지', 'colony')], ['▲', L('우리 함대(가장 큰 배 아이콘)', 'our fleets (icon = biggest ship)'), 'var(--gold)'], ['▲', L('적 함대(세이브 때 마지막으로 본 위치)', 'enemy fleets (last seen, as of the save)'), '#ff6052'], ['⟿', L('전선', 'front line'), '#ff6052'], ['◇', L('요충지', 'chokepoint'), '#ffd678'], ['◌', L('격전지', 'contested'), '#ff7860'], ['⬡', L('항성기지(우주항 이상)', 'starbases (starport and up)')], ['▲', L('다른 군함', 'other warships'), '#a0afbc']]) { const sp = h('span'); const i = h('i', '', a); if (c) i.style.color = c; sp.append(i, ' ' + b); bot.append(sp); }
    bot.append(h('span', '', L('아는 항로만 그립니다(세이브 기준)', 'Known hyperlanes only (as of the save)')));
    const tb = $('toast'); tb.textContent = toast; tb.style.display = toast ? 'block' : 'none';
    const m = $('msg'); m.textContent = err || (busy && !D ? L('세이브에서 은하를 읽는 중…', 'Reading the galaxy from the save…') : ''); m.style.display = m.textContent ? 'flex' : 'none';
  }
  // ---- 작전 탁자를 둘러선 사람들(3단, 2026-11-05 사용자: 헬다이버즈·매스 이펙트 작전 지도처럼) ----
  // 장관 = 탁자 양옆에 직접 서 있음(큰 초상), 제독 = 함대에서 홀로그램으로 참석(탁자 뒤, 푸른 빛). 말하는 사람은 밝아지고 말풍선이 뜬다.
  let CREW = [], IMG = { images: {}, defaults: {} }, crewSig = '', talking = null, talkQ = [], talkT = null, typeT = null;
  const portraitOf = (m) => { const name = m.name; if (m.pk) for (const k of m.pk) if (IMG.images && IMG.images[k]) return IMG.images[k]; const c = m.cls || (D && D.cls) || 'human'; return (window.SLLMVariant ? window.SLLMVariant.pick(IMG.images, ['class:' + c], name, IMG.defaults[c]) : IMG.defaults[c]) || IMG.defaults.human || ''; };
  function loadImages() { try { if (window.sllm.getImageState) window.sllm.getImageState().then((v) => { if (v) { IMG = v; crewSig = ''; renderCrew(); } }).catch(() => {}); } catch { /* 그림 없음 → 실루엣 */ } }
  const SIL = '<svg class="sil" viewBox="0 0 100 150" preserveAspectRatio="xMidYMax meet"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3d4a"/><stop offset="1" stop-color="#071820"/></linearGradient></defs><path d="M50 18c11 0 19 9 19 21s-8 23-19 23-19-11-19-23 8-21 19-21zM14 150c0-34 12-60 36-63 24 3 36 29 36 63z" fill="url(#sg)" stroke="rgba(95,212,228,.55)" stroke-width="1.2"/></svg>';
  // 자리: 장관 → 탁자 양옆(직접 참석). 제독 → 탁자 뒤 호(弧)에 홀로그램으로 — 후반에 제독이 많아지면(2026-11-05 사용자) 작게 줄여 더 많이 세우고,
  //   그래도 넘치면 「외 N명」. 먼저 세우는 순서: 발언 요청한 제독 → 이번 회의에서 말한 제독 → 전력 순.
  const SIDE = {
    sideL: 'left:max(380px, calc(50% - min(590px,31vw) - 10px));bottom:29vh;transform:translateX(-50%)',
    sideR: 'left:min(calc(100% - 410px), calc(50% + min(590px,31vw) + 10px));bottom:29vh;transform:translateX(-50%)',
  };
  const ADM_MAX = 9, ALLY_MAX = 4;
  const fav = new Set(); // 「발언 요청」한 제독 lid(다음 회의에서 먼저 말함, 3명까지)
  function toggleFav(lid) { if (fav.has(lid)) fav.delete(lid); else { if (fav.size >= 4) fav.delete([...fav][0]); fav.add(lid); } crewSig = ''; renderCrew(); render(); }
  function admOrder(list) {
    const spoke = new Set(((CO && CO.council && CO.council.lines) || []).slice(-12).map((x) => x.lid));
    return list.map((m, i) => [m, i]).sort((x, y) => (fav.has(y[0].lid) - fav.has(x[0].lid)) || (spoke.has(y[0].lid) - spoke.has(x[0].lid)) || x[1] - y[1]).map((x) => x[0]);
  }
  /** 뒤쪽 호 위 자리 n개: x(%)·top(vh)·너비(px). 가운데가 높고 양끝이 탁자 옆으로 내려온다. */
  function arc(n) {
    if (!n) return [];
    const xs = n === 1 ? [50] : n === 2 ? [40, 60] : n === 3 ? [36, 50, 64] : Array.from({ length: n }, (_, i) => 24 + 52 * i / (n - 1));
    const w = n <= 3 ? 150 : n <= 5 ? 124 : n <= 7 ? 106 : 92, amp = n <= 3 ? 1.5 : 7;
    return xs.map((x) => ({ x, top: 7 + amp * Math.pow((x - 50) / 26, 2), w }));
  }
  const allyColor = (idx) => { if (!D) return '#e8c872'; for (const k in D.countries) if (D.countries[k].idx === idx) return D.countries[k].color || '#e8c872'; return '#e8c872'; };
  function renderCrew() {
    const mins = CREW.filter((c) => c.role === 'minister'), adms = admOrder(CREW.filter((c) => c.role === 'admiral')), allAls = admOrder(CREW.filter((c) => c.role === 'ally'));
    const shown = adms.slice(0, adms.length > ADM_MAX ? ADM_MAX - 1 : ADM_MAX), more = adms.length - shown.length;
    const als = allAls.slice(0, allAls.length > ALLY_MAX ? ALLY_MAX - 1 : ALLY_MAX), moreA = allAls.length - als.length; // 동맹 연락관: 4명까지, 넘치면 「+N 동맹」
    const sig = JSON.stringify([mins.map((c) => c.lid), shown.map((c) => [c.lid, c.name]), als.map((c) => c.lid), more, moreA, D ? D.cls : '', IMG.defaults && Object.keys(IMG.defaults).length]);
    if (sig !== crewSig) {
      crewSig = sig; const back = $('crewb'), side = $('crews'); back.textContent = ''; side.textContent = '';
      const make = (m, cls, style, small) => {
        const el = h('div', 'crew ' + cls + (m.role === 'admiral' ? ' adm holo-p' : m.role === 'ally' ? ' ally holo-p' : ' min') + (small ? ' sm' : ''));
        el.style.cssText = style; if (m.role === 'ally') el.style.setProperty('--ac', allyColor(m.aidx)); el.dataset.lid = String(m.lid);
        const fig = h('div', 'fig'); fig.append(h('div', 'halo'));
        const url = portraitOf(m);
        if (url) { const im = h('img', 'pt'); im.src = url; im.alt = ''; im.onerror = () => { im.remove(); fig.insertAdjacentHTML('beforeend', SIL); }; fig.append(im); } else fig.insertAdjacentHTML('beforeend', SIL);
        fig.append(h('div', 'rimlt'));
        const np = h('div', 'np'); np.append(h('b', '', m.name)); if (m.doc && !small) { const dt = h('i', 'dtag ' + m.doc.style, m.doc.name); if (m.doc.fx) dt.title = m.doc.fx; np.append(dt); } // 전쟁 성향(+효과)
        if (!small) np.append(h('small', '', m.role === 'ally' ? L('동맹 · ', 'Ally · ') + m.title : m.title + (m.fleet ? ' · ' + m.fleet : '') + (m.role === 'admiral' ? L(' · 원격', ' · remote') : '')));
        el.append(fig, np);
        if (m.role === 'admiral' || m.role === 'ally') {
          el.title = m.name + (m.role === 'ally' ? ' · ' + m.title : '') + (m.fleet ? ' · ' + m.fleet : '') + (m.pow ? L(` · 전력 ${m.pow}`, ` · power ${m.pow}`) : '') + (m.doc ? '\n' + L('전쟁 성향: ', 'War doctrine: ') + m.doc.name + ' (' + L(...({ aggressive: ['공격형', 'aggressive'], defensive: ['방어형', 'defensive'], tactical: ['전술형', 'tactical'] })[m.doc.style] || [m.doc.style, m.doc.style]) + ')' + (m.doc.fx ? L(' — 맡은 함대 ', ' — own fleet ') + m.doc.fx : '') : '') + '\n' + L('누르면 발언 요청(다음 회의에서 먼저 말함)', 'Click to call on them (they speak first at the next council)');
          el.onclick = () => toggleFav(m.lid);
        }
        return el;
      };
      mins.slice(0, 2).forEach((m, i) => side.append(make(m, 'side ' + (i ? 'r' : 'l'), i ? SIDE.sideR : SIDE.sideL, false)));
      // 탁자 뒤 호: 양 끝에 동맹 연락관(1·3번째 왼쪽, 2·4번째 오른쪽), 가운데 제독, 넘치면 「+N」 동그라미
      const row = [];
      if (als[0]) row.push({ m: als[0] }); if (als[2]) row.push({ m: als[2] });
      for (const m of shown) row.push({ m });
      if (more > 0) row.push({ more: more, list: adms.slice(shown.length), label: L('제독 원격 대기', 'admirals on standby') });
      if (moreA > 0) row.push({ more: moreA, list: allAls.slice(als.length), label: L('동맹 연락관 대기', 'allied liaisons on standby'), ally: true });
      if (als[3]) row.push({ m: als[3] }); if (als[1]) row.push({ m: als[1] });
      const pos = arc(row.length), small = shown.length > 5;
      row.forEach((it, i) => {
        const p = pos[i];
        if (it.more) { const el = h('div', 'crew back more' + (it.ally ? ' amore' : '')); el.style.cssText = `left:${p.x}%;top:${p.top + 4}vh;transform:translateX(-50%)`; el.append(h('b', '', '+' + it.more), h('small', '', it.label)); el.title = it.list.map((m) => m.name + (m.fleet ? ' · ' + m.fleet : '')).join('\n') + (it.ally ? '\n' + L('왼쪽 동맹 칸에서 나라 이름을 누르면 발언을 요청할 수 있습니다.', 'Click an ally name in the left panel to call on them.') : ''); back.append(el); return; }
        const el = make(it.m, 'back ' + (p.x > 50 ? 'r' : 'l'), `left:${p.x}%;top:${p.top}vh;width:${p.w}px;transform:translateX(-50%)`, it.m.role === 'ally' ? row.length > 6 : small); el.querySelector('.fig').style.height = Math.round(p.w * 1.27) + 'px'; back.append(el);
      });
    }
    const hp = hiPlan && CO && CO.council ? (CO.council.plans || []).find((p) => p.id === hiPlan) : null;
    for (const el of document.querySelectorAll('.crew[data-lid]')) { const lid = Number(el.dataset.lid); el.classList.toggle('talk', talking !== null ? talking === lid : !!(hp && hp.by === lid)); el.classList.toggle('fav', fav.has(lid)); }
  }
  // 말 차례대로: 말하는 사람 밝게 + 말풍선(글자가 하나씩). 누르면 다음.
  function speak(lines) { talkQ.push(...lines.filter((x) => x.lid !== -1)); if (talking === null) nextTalk(); }
  function nextTalk() {
    clearTimeout(talkT); clearInterval(typeT); $('bubs').textContent = '';
    const ln = talkQ.shift(); if (!ln) { talking = null; renderCrew(); return; }
    const el = document.querySelector('.crew[data-lid="' + ln.lid + '"]');
    if (!el) { nextTalk(); return; }
    talking = ln.lid; renderCrew();
    const fr = el.querySelector('.fig').getBoundingClientRect(), wr = $('wr').getBoundingClientRect(), slot = el.classList.contains('back') ? (el.classList.contains('r') ? 'backR' : 'backL') : el.classList.contains('r') ? 'sideR' : 'sideL';
    const bb = h('div', 'bub' + (el.classList.contains('adm') ? ' adm' : '')); bb.append(h('b', '', ln.name)); const tx = h('span', '', ''); bb.append(tx);
    $('bubs').append(bb);
    if (slot.startsWith('back')) { const right = slot === 'backL'; bb.classList.add(right ? 'lt' : 'rt'); bb.style.top = (fr.top - wr.top + 30) + 'px'; bb.style.left = right ? (fr.right - wr.left + 4) + 'px' : (fr.left - wr.left - 304 - 4) + 'px'; }
    else { bb.classList.add('up'); bb.style.setProperty('--tx', slot === 'sideL' ? '60px' : slot === 'sideR' ? '240px' : '150px'); bb.style.left = Math.max(8, Math.min(wr.width - 308, fr.left - wr.left + fr.width / 2 - (slot === 'sideL' ? 60 : slot === 'sideR' ? 240 : 150))) + 'px'; bb.style.top = (fr.top - wr.top - 10) + 'px'; bb.style.transform = 'translateY(-100%)'; }
    let i = 0; const full = ln.say; typeT = setInterval(() => { i = Math.min(full.length, i + 2); tx.textContent = full.slice(0, i); if (i >= full.length) clearInterval(typeT); }, 22);
    bb.onclick = () => nextTalk();
    talkT = setTimeout(nextTalk, Math.max(3800, Math.min(10000, full.length * 70)));
  }

  // ---- 작전 회의(매스 이펙트 은하 지도처럼: 지도를 둘러싼 장관·제독이 말하고, 작전안 대상이 지도에 빛남) ----
  async function convene(ask) {
    if (coBusy) return; coBusy = true; coErr = ''; render();
    const want = [...fav]; let r; try { r = await window.sllm.warroomCouncil({ ask: ask || '', want, marks: D ? marksForCouncil() : [] }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    coBusy = false;
    if (!r || !r.ok) coErr = (r && r.error) || L('회의를 열지 못했습니다.', 'The council could not be held.');
    else { fav.clear(); const before = (CO && CO.council && CO.council.lines.length) || 0; CO = { council: r.council, speakers: r.crew || (CO && CO.speakers) || [] }; if (r.crew) CREW = r.crew; if (r.fleets) setLive(r); renderCrew(); speak(r.council.lines.slice(before)); const first = (r.council.plans || []).find((p) => p.sys >= 0); if (first) { hiPlan = first.id; flyTo(first.sys, Math.max(view.k, 1.2)); } }
    render(); anim(); draw();
  }
  async function approve(id) {
    let r; try { r = await window.sllm.warroomPlan(id); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (r && r.council) CO = Object.assign(CO || {}, { council: r.council });
    if (r && r.fleets) setLive(r);
    const pl = r && r.council ? r.council.plans.find((p) => p.id === id) : null;
    if (pl && pl.done && pl.act === 'move') { if (pl.moves && pl.moves.length) { for (const m of pl.moves) if (m.sys >= 0) for (const fid of m.fleets) orders.set(fid, m.sys); } else if (pl.sys >= 0) for (const fid of pl.fleets) orders.set(fid, pl.sys); }
    say(pl ? (pl.result || '') : ((r && r.error) || L('명령을 전하지 못했습니다.', 'The order did not go through.')));
    render(); anim(); draw();
  }
  function renderCouncil() {
    const cp = $('cp'); cp.style.display = coOpen ? 'flex' : 'none'; if (!coOpen) return;
    if (!cpUi) { // 입력 칸은 한 번만 만든다(다시 그려도 쓰던 글·초점이 사라지지 않게)
      const top = h('div'), ask = h('div', 'cpa'), inp = h('input'), go = h('button', 'wb go'); inp.type = 'text'; inp.maxLength = 400; go.type = 'button';
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !coBusy) { const t = inp.value.trim(); inp.value = ''; convene(t); } if (e.key === 'Escape') inp.blur(); };
      go.onclick = () => { const t = inp.value.trim(); inp.value = ''; convene(t); };
      ask.append(inp, go); cp.append(top, ask); cpUi = { top, inp, go };
    }
    const keep = cpUi.top.querySelector('.cpt'), sc0 = keep ? keep.scrollTop : 0, atEnd = !keep || keep.scrollTop + keep.clientHeight >= keep.scrollHeight - 8;
    cpUi.top.textContent = ''; { const cp = cpUi.top;
    const hd = h('div', 'cph'); hd.append(h('b', '', L('작 전 회 의', 'WAR COUNCIL')), h('small', '', L('장관과 제독들이 은하 작전도를 둘러싸고 있습니다', 'Ministers and admirals gather around the galactic map')));
    if (window.sllm.warroomPropose) { const pb = h('button', 'wb cpprop', propBusy ? L('건의를 모으는 중…', 'Gathering proposals…') : L('작전 건의 받기', 'Ask for proposals')); pb.type = 'button'; pb.disabled = propBusy || coBusy; pb.title = L(`국방 장관과 레벨 ${PROPOSE_LV} 이상 제독이 스스로 작전을 들고 옵니다`, `The defense minister and admirals of level ${PROPOSE_LV}+ bring their own operations`); pb.onclick = () => propose(true); hd.append(pb); }
    cp.append(hd);
    const fv = CREW.filter((c) => fav.has(c.lid)).map((c) => c.name);
    cp.append(h('div', 'cpf', fv.length ? L(`발언 요청: ${fv.join(', ')} — 다음 회의에서 먼저 말합니다`, `Called on: ${fv.join(', ')} — they speak first at the next council`) : L('제독 홀로그램을 누르면 발언을 요청할 수 있습니다.', 'Click an admiral hologram to call on them.')));
    const body = h('div', 'cpb'), tr = h('div', 'cpt'), pls = h('div', 'cpp');
    const lines = (CO && CO.council && CO.council.lines) || [];
    for (const ln of lines) { const d = h('div', 'ln' + (ln.lid === -1 ? ' me' : '')), who = h('b', '', ln.name + (ln.title && ln.lid !== -1 ? ' · ' + ln.title : '')), cm = CREW.find((x) => x.lid === ln.lid); if (cm && cm.doc) { const t = h('i', 'dtag ' + cm.doc.style, cm.doc.name); who.append(' ', t); } d.append(who, h('span', '', ln.say)); tr.append(d); } // 이름 옆 전쟁 성향
    if (coBusy) tr.append(h('div', 'ln wait', L('장관과 제독들이 지도를 살피는 중…', 'The council studies the map…')));
    if (coErr) tr.append(h('div', 'ln err', coErr));
    if (!lines.length && !coBusy && !coErr) tr.append(h('small', '', L('「회의 소집」을 누르면 장관과 제독들이 작전을 제안합니다.', 'Press Convene and the council will propose operations.')));
    const plans = (CO && CO.council && CO.council.plans) || [];
    plans.forEach((pl, i) => {
      const c = h('div', 'plan' + (hiPlan === pl.id ? ' hot' : '') + (pl.done ? ' done' : ''));
      c.onmouseenter = () => { hiPlan = pl.id; renderCrew(); anim(); draw(); }; 
      const pc = 'rgb(' + PLAN_RGB[i % PLAN_RGB.length] + ')', num = h('i', '', String(i + 1)); num.style.borderColor = pc; num.style.color = pc; c.style.setProperty('--pc', pc);
      const tt = h('div', 'pt'); tt.append(num, h('b', '', opName(pl)), ...(pl.prop ? [h('span', 'ptag', L('건의', 'PROPOSAL'))] : [])); c.append(tt);
      const fn = (ids) => ids.map((f) => (liveFleet(f) || {}).n || ('#' + f)).join(', ');
      if (pl.code) c.append(h('small', 'ptl', pl.title));
      c.append(h('small', '', (pl.byName ? pl.byName + (pl.byLv ? ' · Lv ' + pl.byLv : '') + ' · ' : '') + pl.actText + (pl.act === 'move' ? ' → ' + pl.target : '')));
      if (pl.moves && pl.moves.length) for (const m of pl.moves) c.append(h('small', 'mv', `${ROLE_T[m.role] ? L(...ROLE_T[m.role]) : m.role} · ${fn(m.fleets)} → ${m.target}`));
      else c.append(h('small', '', fn(pl.fleets)));
      if (pl.why) c.append(h('p', '', pl.why));
      const row = h('div', 'pr');
      if (pl.sys >= 0) { const v = h('button', 'wb', L('지도에서 보기', 'Show on map')); v.type = 'button'; v.onclick = () => { hiPlan = pl.id; flyTo(pl.sys, Math.max(view.k, 1.4)); render(); }; row.append(v); }
      if (pl.done) row.append(h('span', 'ok', pl.result || L('승인됨', 'Approved')));
      else { const a = h('button', 'wb go', L('승인 — 명령 하달', 'Approve — issue orders')); a.type = 'button'; let armed = false; a.onclick = () => { if (!armed) { armed = true; a.textContent = L('한 번 더 누르면 하달', 'Press again to issue'); setTimeout(() => { armed = false; a.textContent = L('승인 — 명령 하달', 'Approve — issue orders'); }, 3000); return; } a.disabled = true; approve(pl.id); }; row.append(a); }
      c.append(row); pls.append(c);
    });
    body.append(tr, pls); cp.append(body);
    tr.scrollTop = atEnd ? tr.scrollHeight : sc0; }
    cpUi.inp.placeholder = L('통치자의 방침(예: 국경 방어 위주로, ○○ 성계를 쳐라)…', "Ruler's direction (e.g. focus on defending the border, strike system X)…");
    cpUi.go.textContent = ((CO && CO.council && CO.council.lines) || []).length ? L('말하기', 'Speak') : L('회의 소집', 'Convene'); cpUi.go.disabled = coBusy;
  }
  let cpUi = null;
  function close() { try { window.sllm.warroomClose(); } catch { window.close(); } }
  function wire() {
    const wrap = $('cvw');
    let drag = null;
    const at = (e) => toLocal(e.clientX, e.clientY) || { x: -9999, y: -9999 };
    const onTable = (p) => { if (!bgOn) return true; const b = box(), dx = (p.x - b.width / 2) / (b.width / 2), dy = (p.y - b.height / 2) / (b.height / 2 * tableVy); return dx * dx + dy * dy <= 1; }; // 투명한(탁자 밖) 곳은 고르지 않음
    wrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; const p = at(e);
      if (pen && D && onTable(p)) { if (pen === 'erase') { eraseAt(p); return; } stroke = { k: pen, pts: [toWorld(p.x, p.y, box())], last: p }; return; } // 펜: 선 긋기
      const pc = D && onTable(p) ? pieceAt(p) : null; // 우리 함대 아이콘 = 끌기(놓으면 이동) 또는 누르기(집기)
      if (pc && pc.f && pc.f.live) { pdrag = { fid: pc.f.fid, id: pc.f.id, from: pc.s, x: p.x, y: p.y, cur: p, to: null, moved: false }; return; }
      drag = { x: p.x, y: p.y, cx: view.cx, cy: view.cy, moved: false }; wrap.classList.add('drag');
    });
    window.addEventListener('mouseup', (e) => {
      if (stroke) { const s0 = stroke; stroke = null; if (s0.pts.length >= 2) { marks.push({ k: s0.k, pts: s0.pts.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 })) }); saveMarks(); } draw(); return; }
      if (pdrag) {
        const d = pdrag; pdrag = null; wrap.style.cursor = ''; tip.style.display = 'none';
        if (d.moved) { armed = null; if (d.to !== null && d.to !== d.from) { sel = { sys: d.to, fleet: d.id }; order(d.fid, 'move', d.to); } else { render(); draw(); } return; }
        sel = { sys: d.from, fleet: d.id }; armed = armed === d.fid ? null : d.fid; render(); anim(); draw(); return; // 누르기 = 집기(다시 누르면 내려놓기)
      }
      if (!drag) return; wrap.classList.remove('drag');
      if (!drag.moved && D && e.button === 0 && armed !== null) { // 집어 든 함대 → 누른 곳(성계·적 아이콘·기지)으로 이동
        const p = at(e), pc = onTable(p) ? pieceAt(p) : null, hit = pc ? sysById.get(pc.s) : onTable(p) ? pick(p.x, p.y, box()) : null, fid = armed, F = liveFleet(fid); armed = null; drag = null;
        if (hit && F && hit.id !== F.s) { sel = { sys: hit.id, fleet: 'L' + fid }; order(fid, 'move', hit.id); } else { sel = { sys: hit ? hit.id : sel.sys, fleet: sel.fleet }; render(); draw(); }
        return;
      }
      if (!drag.moved && D && e.button === 0) { const p = at(e), pc = onTable(p) ? pieceAt(p) : null; if (pc) { sel = { sys: pc.s, fleet: pc.f && pc.f.live ? pc.f.id : sel.fleet }; render(); draw(); drag = null; return; } const hit = onTable(p) ? pick(p.x, p.y, box()) : null; sel = { sys: hit ? hit.id : null, fleet: sel.fleet }; render(); draw(); }
      drag = null;
    });
    wrap.addEventListener('mousemove', (e) => {
      const p = at(e);
      if (stroke) { if (Math.hypot(p.x - stroke.last.x, p.y - stroke.last.y) > 6) { stroke.pts.push(toWorld(p.x, p.y, box())); stroke.last = p; if (stroke.pts.length > 300) stroke.pts.splice(1, 1); draw(); } return; }
      if (pen) { wrap.style.cursor = pen === 'erase' ? 'not-allowed' : 'crosshair'; tip.style.display = 'none'; return; }
      if (pdrag) {
        if (Math.abs(p.x - pdrag.x) + Math.abs(p.y - pdrag.y) > 4) pdrag.moved = true;
        if (!pdrag.moved) return; pdrag.cur = p; wrap.style.cursor = 'grabbing';
        const pc = onTable(p) ? pieceAt(p) : null, hit = pc && !(pc.f && pc.f.live && pc.f.fid === pdrag.fid) ? sysById.get(pc.s) : onTable(p) ? pick(p.x, p.y, box()) : null; pdrag.to = hit ? hit.id : null; hover = hit;
        if (hit) { tip.textContent = L(`→ ${hit.n || '알 수 없는 성계'} (놓으면 이동)`, `→ ${hit.n || 'Unknown system'} (drop to move)`); tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 10) + 'px'; } else tip.style.display = 'none';
        draw(); return;
      }
      if (drag) { const dx = p.x - drag.x, dy = p.y - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; view.cx = drag.cx - dx / view.k; view.cy = drag.cy - dy / view.k; draw(); return; }
      if (!D) return; const pc = onTable(p) ? pieceAt(p) : null;
      if (armed !== null) { // 집어 든 함대: 가리킨 곳까지 항로 미리 보기
        const hit = pc && !(pc.f && pc.f.live && pc.f.fid === armed) ? sysById.get(pc.s) : onTable(p) ? pick(p.x, p.y, box()) : null;
        if ((hit && hit.id) !== (hover && hover.id)) { hover = hit; draw(); }
        wrap.style.cursor = hit ? 'crosshair' : '';
        if (hit) { tip.textContent = L(`→ ${hit.n || '알 수 없는 성계'} (누르면 이동 · Esc 취소)`, `→ ${hit.n || 'Unknown system'} (click to move · Esc to cancel)`); tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 10) + 'px'; } else tip.style.display = 'none';
        return;
      }
      if (pc && pc.sb) { const c = D.countries[String(pc.sb.o)] || {}; tip.textContent = L(`항성기지 · ${SB_NAME[pc.sb.sb][0]} · ${pc.sb.n || '?'} · ${c.name || '?'}`, `Starbase · ${SB_NAME[pc.sb.sb][1]} · ${pc.sb.n || '?'} · ${c.name || '?'}`) + (enemyOf(pc.sb.o) ? L(` (세이브 ${D.date} 기준)`, ` (as of save ${D.date})`) : ''); tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 10) + 'px'; wrap.style.cursor = 'pointer'; return; }
      if (pc) { const f = pc.f, c = D.countries[String(f.o)] || {}; const big = f.bg && SHIP_NAME[f.bg] ? ' · ' + L(...SHIP_NAME[f.bg]) + L('급 기함', '-class flagship') : ''; tip.textContent = pc.foe ? L(`⚔ ${f.n} · ${c.name || '적'}${big} · 전력 ${f.p} · 마지막으로 본 자리(세이브 ${D.date})`, `⚔ ${f.n} · ${c.name || 'enemy'}${big} · Power ${f.p} · last seen here (save ${D.date})`) : f.n + big + ' · ' + L(`전력 ${f.p}`, `Power ${f.p}`); if (pc.foe && f.dcn) tip.textContent += ' · ' + L('지휘관 특성: ', 'Commander trait: ') + f.dcn; /* 적 AI 는 성향대로 움직이지 않으니 특성 효과만 */ tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 10) + 'px'; wrap.style.cursor = 'pointer'; return; }
      wrap.style.cursor = '';
      const hit = onTable(p) ? pick(p.x, p.y, box()) : null;
      if ((hit && hit.id) !== (hover && hover.id)) { hover = hit; draw(); }
      if (hit) { const ow = hit.o >= 0 ? D.countries[String(hit.o)] : null, zt = stratOf(hit.id); tip.textContent = (hit.n || L('알 수 없는 성계', 'Unknown system')) + (ow ? ' · ' + ow.name : '') + (zt && zt.t.length ? ' — ' + stratText(zt) : ''); tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 10) + 'px'; }
      else tip.style.display = 'none';
    });
    wrap.addEventListener('contextmenu', (e) => { // 우클릭: 고른 우리 함대를 그 성계로 바로
      e.preventDefault(); if (!D) return; const p = at(e), pc = onTable(p) ? pieceAt(p) : null, hit = pc ? sysById.get(pc.s) : onTable(p) ? pick(p.x, p.y, box()) : null, fid = selFid(); armed = null;
      if (!hit) return; if (fid === null) { say(L('먼저 왼쪽에서 우리 함대를 고르세요.', 'Pick one of our fleets on the left first.')); return; }
      const f = liveFleet(fid); if (!f || f.s === hit.id) return; sel = { sys: hit.id, fleet: sel.fleet }; order(fid, 'move', hit.id);
    });
    wrap.addEventListener('mouseleave', () => { tip.style.display = 'none'; if (hover) { hover = null; draw(); } });
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault(); const rr = box(), p = at(e), before = toWorld(p.x, p.y, rr);
      view.k = Math.max(0.25, Math.min(12, view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const after = toWorld(p.x, p.y, rr); view.cx += before.x - after.x; view.cy += before.y - after.y; draw();
    }, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (pen) { setPen(null); } else if (armed !== null) { armed = null; tip.style.display = 'none'; draw(); } else if (coOpen) { coOpen = false; render(); draw(); } else close(); } });
    new ResizeObserver(() => draw()).observe(wrap);
    window.addEventListener('resize', () => { fitTable(); draw(); });
  }
  function pick(sx, sy, r) {
    let best = null, bd = 12 * 12;
    for (const s of D.systems) { const p = toScr(W(s), r), d = (p.x - sx) ** 2 + (p.y - sy) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  }
  wire(); render(); draw(); load(false); loadImages();
})();
