// 종속국 통치권(2026-11-05 사용자: Vassals Expanded and Reworked 참고 — 괴뢰 통치자·대리전·간섭 반감·정책 동조·종속국 쟁탈) — 종속국 창(vassal.html)의 카드.
// 「현황」 간섭 반감 · 「통치」 통치자 교체 · 「전쟁」 대리전 지시·종속국 쟁탈. 앱: src/features/vassal-reign-app.ts · 규칙: src/vassal-reign.ts. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const IDS = ['vgBox', 'vgHeat', 'vgProxy', 'vgFleet', 'vgPrize'];
  let loading = false;
  const clear = () => IDS.forEach((i) => document.getElementById(i)?.remove());
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  const btn = (t, cls) => { const b = h('button', 'btn' + (cls ? ' ' + cls : ''), t); b.type = 'button'; return b; };
  const opt = (sel, v, t, dis) => { const o = h('option', '', t); o.value = v; if (dis) o.disabled = true; sel.append(o); return o; };
  // 목록 불러오기 단추: 누르면 게임에 물어 select 를 채운다.
  function loader(sel, go, label, fetch, fill, can) {
    const b = btn(label); opt(sel, '', L('— 목록을 불러오세요 —', '— load the list —')); go.disabled = true; b.disabled = !can;
    b.onclick = async () => {
      b.disabled = true; sel.textContent = ''; opt(sel, '', L('불러오는 중…', 'Loading…'));
      let r; try { r = await fetch(); } catch (e) { r = { ok: false, error: String(e) }; }
      sel.textContent = ''; b.disabled = !can;
      if (!r || !r.ok || !r.list.length) { opt(sel, '', (r && r.error) || L('고를 것이 없습니다.', 'Nothing to choose.')); go.disabled = true; return; }
      fill(r.list); const first = [...sel.options].find((o) => !o.disabled && o.value); if (first) sel.value = first.value; go.disabled = !can || !first;
    };
    return b;
  }

  async function add() {
    const U = window.VassalUI, ch = U && U.ch; if (loading || !ch || ch.role !== 'vassal' || !ch.active || !U.host('war') || document.getElementById('vgBox')) return;
    loading = true; let V = null; try { V = await window.sllm.vrState(ch.idx); } catch (e) { V = null; } loading = false;
    if (!U.ch || U.ch.key !== ch.key) { void add(); return; } if (!V || !V.ok || document.getElementById('vgBox')) return;
    const vname = ch.name, idx = ch.idx;
    const run = async (card, fn, btns) => {
      btns.forEach((b) => { b.disabled = true; }); card.say(L('처리 중…', 'Working…')); let r; try { r = await fn(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (r && r.ok) { const id = card.el.id; U.refresh(); setTimeout(() => { const m = document.querySelector(`#${id} .vk-msg`); if (m) m.textContent = r.text; }, 300); } else { card.say((r && r.error) || L('실패했습니다.', 'Failed.'), true); btns.forEach((b) => { b.disabled = !V.running; }); }
    };

    // 현황: 간섭 반감
    const ch1 = U.card('status', 'vgHeat', L('간섭 반감', 'Meddling resentment'), '♨', { order: 20 });
    if (ch1) {
      const t = V.heat.tier; ch1.chip(t > 0 ? L(`${t}단계`, `Tier ${t}`) : L('없음', 'None'), t >= 3 ? 'bad' : t >= 1 ? 'warn' : 'good');
      U.dot('status', 'heat', t >= 2 ? 'warn' : null);
      const meter = h('div', 'vk-odds'); for (const [k, w] of [['a', Math.min(100, (V.heat.h / 9) * 100)], ['', 100 - Math.min(100, (V.heat.h / 9) * 100)]]) { const i = h('i', k === 'a' ? (t >= 3 ? 'r' : t >= 1 ? 'h' : 'a') : ''); i.style.width = w + '%'; meter.append(i); }
      ch1.body.append(h('div', '', V.heat.text), meter, h('p', 'vk-d', L('성계 가져오기·기술 원조·개명·동화·통치자 교체·대리전 지시가 모두 열기를 올립니다. 열기 2·5·9에서 행성 안정도와 파벌 지지가 떨어지고, 6달마다 1씩 식습니다. 충성도 60 이상이면 덜, 20 미만이면 더 오래 분노합니다.', 'Taking systems, tech aid, renaming, assimilation, replacing the ruler and proxy-war orders all add heat. At 2/5/9 planet stability and faction approval drop; heat cools by 1 every 6 months. Loyalty 60+ minds less; under 20 stays angry longer.')));
    }

    // 통치: 통치자 교체
    const c1 = U.card('rule', 'vgBox', L('통치자 교체', 'Replace the ruler'), '♛', { order: 10 });
    if (c1) {
      c1.chip(V.installLeft > 0 ? L(`${V.installLeft}년 뒤 다시`, `again in ${V.installLeft} yr`) : L('지금 가능', 'Available'), V.installLeft > 0 ? '' : 'good');
      const who = h('select'), go = btn(L('통치자로 앉히기', 'Install as ruler'));
      const ld = loader(who, go, L('후보 불러오기', 'List candidates'), () => window.sllm.vrLeaders(idx), (list) => {
        const gt = h('optgroup'); gt.label = L(`${vname}의 인물 · 영향력 ${V.cost.install}`, `${vname}'s people · ${V.cost.install} influence`);
        const gm = h('optgroup'); gm.label = L(`우리 인물(그 나라로 보냄) · 영향력 ${V.cost.installOurs}`, `Our people (sent over) · ${V.cost.installOurs} influence`);
        for (const x of list) { const o = h('option', '', `${x.name} · ${x.clsName}`); o.value = `${x.side}:${x.n}`; o.dataset.name = x.name; (x.side === 'me' ? gm : gt).append(o); }
        if (gt.children.length) who.append(gt); if (gm.children.length) who.append(gm);
      }, V.running && V.installLeft <= 0);
      go.onclick = () => { const o = who.selectedOptions[0]; if (!o || !o.value) return; const [side, n] = o.value.split(':'); void run(c1, () => window.sllm.vrInstall({ idx, n: Number(n), side, name: o.dataset.name, vname }), [ld, go]); };
      const r1 = h('div', 'vk-row'), r2 = h('div', 'vk-row'); r1.append(ld); r2.append(who, go);
      c1.body.append(r1, r2);
      if (V.deposed) { const kv = h('div', 'vk-kv'); kv.append(h('span', '', L('밀려난 통치자', 'Deposed ruler')), h('span', '', L(`${V.deposed.name} (${V.deposed.since}부터 궁정에서 원한)`, `${V.deposed.name} (bitter at court since ${V.deposed.since})`))); c1.body.append(kv); }
      c1.body.append(h('p', 'vk-d', L('새 통치자는 5년간 충성도 매달 +1.5(우리 인물이면 +2.5), 자치도 +8(우리 인물 +15). 밀려난 통치자는 궁정에 남아 3년간 충성도 매달 -0.5, 가끔 원한 서신을 보냅니다. 10년에 한 번.', 'The new ruler gives loyalty +1.5/month for 5 years (+2.5 if ours); autonomy +8 (+15 if ours). The deposed ruler stays at court: loyalty -0.5/month for 3 years and an occasional bitter letter. Once per 10 years.')), c1.msg);
    }

    // 전쟁: 대리전 지시
    const c2 = U.card('war', 'vgProxy', L('대리전 지시', 'Proxy war'), '⚔', { order: 10, wide: true });
    if (c2) {
      const P = V.proxy, blocked = !V.running || (P && (P.state === 'pending' || P.state === 'war')) || V.proxyLeft > 0;
      c2.chip(P && P.state === 'war' ? L(`${P.target}과(와) 교전 중`, `At war with ${P.target}`) : P && P.state === 'pending' ? L('지원금 요청', 'Asks for funds') : V.proxyLeft > 0 ? L(`${V.proxyLeft}년 뒤 다시`, `again in ${V.proxyLeft} yr`) : L('지시 가능', 'Available'),
        P && P.state === 'pending' ? 'bad' : P && P.state === 'war' ? 'warn' : V.proxyLeft > 0 ? '' : 'good');
      if (P && P.state === 'pending') {
        U.dot('war', 'proxy', 'warn'); U.todo('proxy', [{ text: L(`대리전 지원금 요청에 답하기(${P.target})`, `Answer the war-funds request (${P.target})`), tab: 'war' }]);
        const pay = btn(L(`에너지 ${P.bribe} 보내고 선전포고시키기`, `Send ${P.bribe} energy and have them declare war`), 'yes'), no = btn(L('지시 거두기', 'Withdraw the order'), 'no');
        pay.disabled = no.disabled = !V.running;
        pay.onclick = () => run(c2, () => window.sllm.vrProxyAnswer({ idx, pay: true }), [pay, no]); no.onclick = () => run(c2, () => window.sllm.vrProxyAnswer({ idx, pay: false }), [pay, no]);
        const r = h('div', 'vk-row'); r.append(pay, no);
        c2.body.append(h('div', 'vk-ask', L(`${vname}이(가) ${P.target} 공격을 주저하며 전쟁 자금으로 에너지 ${P.bribe}을(를) 바랍니다.`, `${vname} hesitates to attack ${P.target} and asks for ${P.bribe} energy to fund the campaign.`)), r);
      } else { U.dot('war', 'proxy', null); U.todo('proxy', []); }
      if (P && P.state !== 'pending') {
        const kv = h('div', 'vk-kv'); kv.append(h('span', '', L('지난 지시', 'Last order')), h('span', '', `${P.target} · ${P.at}`), h('span', '', L('결과', 'Outcome')),
          h('span', '', P.state === 'war' ? L('전쟁 중', 'At war') : P.state === 'refused' ? L('이루어지지 않음', 'Did not happen') : P.won ? L('승리', 'Won') : L('끝남', 'Ended'))); c2.body.append(kv);
      }
      const tg = h('select'), go = btn(L(`치라고 명하기 · 영향력 ${V.cost.proxy}`, `Order the attack · ${V.cost.proxy} influence`));
      const ld = loader(tg, go, L('이웃 불러오기', 'List neighbours'), () => window.sllm.vrTargets(idx), (list) => { for (const x of list) { const o = opt(tg, String(x.n), x.name); o.dataset.name = x.name; } }, !blocked);
      go.onclick = () => { const o = tg.selectedOptions[0]; if (!o || !o.value) return; void run(c2, () => window.sllm.vrProxy({ idx, n: Number(o.value), name: o.dataset.name, vname }), [ld, go]); };
      const odds = h('div', 'vk-odds'); for (const [k, v] of [['a', V.odds.accept], ['h', V.odds.hesitate], ['r', V.odds.refuse]]) { const i = h('i', k); i.style.width = pct(v); odds.append(i); }
      const r1 = h('div', 'vk-row'); r1.append(ld, tg, go);
      c2.body.append(r1, h('div', 'vk-sub', L('지금 명하면', 'IF ORDERED NOW')), odds,
        h('div', 'vk-d', L(`수락 ${pct(V.odds.accept)} · 주저(지원금 요청) ${pct(V.odds.hesitate)} · 거절 ${pct(V.odds.refuse)} — 충성도 ${V.loyalty === null ? '?' : Math.round(V.loyalty)}, 자치도 ${V.autonomy}`, `Accept ${pct(V.odds.accept)} · hesitate (asks for funds) ${pct(V.odds.hesitate)} · refuse ${pct(V.odds.refuse)} — loyalty ${V.loyalty === null ? '?' : Math.round(V.loyalty)}, autonomy ${V.autonomy}`)),
        h('p', 'vk-d', L('우리 동맹·연방·방위조약 상대가 아닌 이웃만 고를 수 있습니다. 거절하면 자치도 +5. 종속국마다 2년에 한 번. 결과는 서신·연대기·세계 소식에 남습니다.', 'Only neighbours that are not our allies, federation members or defensive-pact partners. Refusal: autonomy +5. Once per 2 years per subject. Outcomes go to letters, the chronicle and world news.')), c2.msg);
    }

    // 전쟁: 함대 징발 · 헌납(2026-11-05)
    const cf = U.card('war', 'vgFleet', L('함대 징발 · 헌납', 'Fleet levy · tithe'), '⚓', { order: 15, wide: true });
    if (cf) {
      const LV = V.levy, T = V.tithe, levyOn = LV && LV.state === 'on', pend = T && T.state === 'pending';
      cf.chip(levyOn ? L(`「${LV.fleet}」 징발 중 · ${LV.until}까지`, `"${LV.fleet}" levied · until ${LV.until}`) : pend ? L('헌납 거절됨', 'Tithe refused') : L('요구 가능', 'Available'), pend ? 'bad' : levyOn ? 'warn' : 'good');
      if (pend) {
        U.dot('war', 'tithe', 'warn'); U.todo('tithe', [{ text: L(`거절된 함대 헌납 정리하기(「${T.fleet}」)`, `Settle the refused fleet tithe ("${T.fleet}")`), tab: 'war' }]);
        const fo = btn(L('강제로 받아 내기', 'Seize it anyway'), 'no'), dr = btn(L('요구 거두기', 'Drop the demand'));
        fo.disabled = dr.disabled = !V.running;
        fo.onclick = () => run(cf, () => window.sllm.vrTitheForce({ idx, force: true }), [fo, dr]); dr.onclick = () => run(cf, () => window.sllm.vrTitheForce({ idx, force: false }), [fo, dr]);
        const r = h('div', 'vk-row'); r.append(fo, dr);
        cf.body.append(h('div', 'vk-ask', L(`${vname}이(가) 「${T.fleet}」을(를) 바치라는 요구를 거절했습니다. 강제로 받아 내면 자치도 +20, 3년간 충성도 매달 -2, 간섭 열기가 크게 쌓이고 원한 서신이 옵니다.`, `${vname} refused to hand over the "${T.fleet}". Seizing it costs autonomy +20, loyalty -2/month for 3 years, heavy meddling heat and a bitter letter.`)), r);
      } else { U.dot('war', 'tithe', null); U.todo('tithe', []); }
      const fs = h('select'), lvB = btn(L(`징발 · 영향력 ${V.cost.levy}`, `Levy · ${V.cost.levy} influence`)), thB = btn(L(`헌납 요구 · 영향력 ${V.cost.tithe}`, `Demand · ${V.cost.tithe} influence`), 'no');
      let cnt = 0;
      const canLevy = V.running && !levyOn && V.levyLeft <= 0, canTithe = V.running && !pend && V.titheLeft <= 0;
      const ld = btn(L('함대 불러오기', 'List fleets')); opt(fs, '', L('— 목록을 불러오세요 —', '— load the list —')); lvB.disabled = thB.disabled = true; ld.disabled = !V.running || (!canLevy && !canTithe);
      ld.onclick = async () => {
        ld.disabled = true; fs.textContent = ''; opt(fs, '', L('불러오는 중…', 'Loading…'));
        let r; try { r = await window.sllm.vrFleets(idx); } catch (e) { r = { ok: false, error: String(e) }; }
        fs.textContent = ''; ld.disabled = false;
        if (!r || !r.ok || !r.list.length) { opt(fs, '', (r && r.error) || L('내줄 수 있는 함대가 없습니다(전투·수리·임대 중이면 빠집니다).', 'No fleet available (fleets in combat, damaged or leased are left out).')); return; }
        cnt = r.cnt; for (const x of r.list.slice().sort((a, b) => b.pow - a.pow)) { const o = opt(fs, String(x.n), L(`${x.name} · 전력 ${x.pow}`, `${x.name} · power ${x.pow}`)); o.dataset.name = x.name; }
        lvB.disabled = !canLevy; thB.disabled = !canTithe || cnt < 2;
        if (cnt < 2) cf.say(L('전투 함대가 하나뿐이라 헌납은 요구할 수 없습니다.', 'They have only one combat fleet, so no tithe.'));
      };
      lvB.onclick = () => { const o = fs.selectedOptions[0]; if (!o || !o.value) return; void run(cf, () => window.sllm.vrLevy({ idx, n: Number(o.value), name: o.dataset.name, vname }), [ld, lvB, thB]); };
      thB.onclick = () => { const o = fs.selectedOptions[0]; if (!o || !o.value) return; void run(cf, () => window.sllm.vrTithe({ idx, n: Number(o.value), name: o.dataset.name, vname, cnt }), [ld, lvB, thB]); };
      const r1 = h('div', 'vk-row'); r1.append(ld, fs, lvB, thB);
      const odds = h('div', 'vk-odds'); for (const [k, v] of [['a', V.levyOdds.accept], ['h', V.levyOdds.hesitate], ['r', V.levyOdds.refuse]]) { const i = h('i', k); i.style.width = pct(v); odds.append(i); }
      cf.body.append(r1, h('div', 'vk-sub', L('징발을 요구하면', 'IF YOU LEVY')), odds,
        h('div', 'vk-d', L(`내줌 ${pct(V.levyOdds.accept)} · 가장 약한 함대만 ${pct(V.levyOdds.hesitate)} · 거절 ${pct(V.levyOdds.refuse)}   |   헌납에 응할 확률 ${pct(V.titheChance)}`, `Hands it over ${pct(V.levyOdds.accept)} · weakest fleet only ${pct(V.levyOdds.hesitate)} · refuses ${pct(V.levyOdds.refuse)}   |   Chance they accept a tithe ${pct(V.titheChance)}`)));
      const kv = h('div', 'vk-kv');
      if (LV) kv.append(h('span', '', L('징발', 'Levy')), h('span', '', LV.state === 'on' ? L(`「${LV.fleet}」 ${LV.until}까지 우리 지휘`, `"${LV.fleet}" under our command until ${LV.until}`) : LV.state === 'lost' ? L(`「${LV.fleet}」을(를) 잃음`, `Lost the "${LV.fleet}"`) : V.levyLeft > 0 ? L(`끝남 · ${V.levyLeft}년 뒤 다시`, `Over · again in ${V.levyLeft} yr`) : L('끝남', 'Over')));
      if (T && !pend) kv.append(h('span', '', L('헌납', 'Tithe')), h('span', '', T.state === 'dropped' ? L('지난 요구 거둠', 'Last demand dropped') : `${T.state === 'forced' ? L('강제로 받음', 'Seized') : L('받음', 'Received')} 「${T.fleet}」 · ${T.at}${V.titheLeft > 0 ? L(` · ${V.titheLeft}년 뒤 다시`, ` · again in ${V.titheLeft} yr`) : ''}`));
      if (kv.children.length) cf.body.append(kv);
      cf.body.append(h('p', 'vk-d', L('징발: 함대 하나를 2년간 우리 지휘 아래 둡니다(주인은 종속국 그대로, 끝나면 돌아감). 거절하면 자치도 +5, 징발한 함대를 잃으면 원망합니다. 끝난 뒤 1년 쉬고 다시. 헌납: 함대를 아주 넘겨받습니다. 마지막 전투 함대는 안 되고, 받으면 자치도 +10·2년간 충성도 매달 -1. 5년에 한 번.', 'Levy: one fleet serves under our command for 2 years (they keep ownership; it returns afterwards). Refusal: autonomy +5; losing a levied fleet breeds resentment. One year rest after it ends. Tithe: we take a fleet for good. Never their last combat fleet; autonomy +10 and loyalty -1/month for 2 years. Once per 5 years.')), cf.msg);
    }

    // 전쟁: 종속국 쟁탈
    const c3 = U.card('war', 'vgPrize', L('종속국 쟁탈', 'Take a subject'), '⚑', { order: 20, wide: true });
    if (c3) {
      c3.chip(L(`영향력 ${V.cost.prize}`, `${V.cost.prize} influence`));
      const pz = h('select'), go = btn(L('전쟁명분 얻기', 'Gain casus belli'));
      const ld = loader(pz, go, L('국경의 남의 종속국', 'Foreign subjects on our border'), () => window.sllm.vrPrizes(), (list) => { for (const x of list) { const o = opt(pz, String(x.n), `${x.name} ← ${x.ov || '?'}${x.cb ? L(' · 명분 있음', ' · claimed') : ''}`, x.cb); o.dataset.name = x.name; o.dataset.ov = x.ov || ''; } }, V.running);
      go.onclick = () => { const o = pz.selectedOptions[0]; if (!o || !o.value) return; void run(c3, () => window.sllm.vrPrize({ n: Number(o.value), name: o.dataset.name, ov: o.dataset.ov, idx }), [ld, go]); };
      const r = h('div', 'vk-row'); r.append(ld, pz, go);
      c3.body.append(r, h('p', 'vk-d', L('그 종주국에 대한 전쟁명분이 5년간 생깁니다. 게임 외교 화면에서 「종속국 빼앗기」 목표로 이기면 그 나라가 우리 종속국이 되고, 그 나라 종족 가운데 새 통치자가 섭니다.', 'Gives a casus belli against its overlord for 5 years. Win with the "Take Their Subject" war goal from the game\'s diplomacy screen and it becomes our subject, with a new ruler from its own species.')), c3.msg);
    }
    if (!V.running) for (const id of ['vgBox', 'vgProxy']) { const c = document.getElementById(id); if (c) c.querySelector('.vk-b').append(h('p', 'vk-d', L('게임이 켜져 있어야 명령을 내릴 수 있습니다.', 'The game must be running to issue these orders.'))); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.vrState) return;
    const watch = () => { const pane = document.getElementById('pane'); if (!pane) return setTimeout(watch, 200); new MutationObserver(() => { void add(); }).observe(pane, { childList: true }); void add(); };
    document.addEventListener('vassal-refresh', () => { clear(); void add(); });
    watch();
  });
})();
