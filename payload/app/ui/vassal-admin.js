// 종속국 행정(2026-11-04 사용자: 성계 이양·기술 원조·동화 정책) — 종속국 창(vassal.html) 「행정」 탭의 카드. 앱: src/features/vassal-admin-app.ts · 규칙: src/vassal-admin.ts
// 2026-11-05: 탭·카드 화면(window.VassalUI). 동화 정책 카드에 정책·종족 권리 동조(src/features/vassal-reign-app.ts) 안내. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const ETH = { authoritarian: ['권위주의', 'Authoritarian'], egalitarian: ['평등주의', 'Egalitarian'], xenophobe: ['외계인혐오', 'Xenophobe'], xenophile: ['외계인애호', 'Xenophile'], militarist: ['군국주의', 'Militarist'], pacifist: ['평화주의', 'Pacifist'], materialist: ['물질주의', 'Materialist'], spiritualist: ['정신주의', 'Spiritualist'] };
  const en = (list) => (list || []).map((e) => L(...(ETH[e] || [e, e]))).join('·') || L('없음', 'none');
  const IDS = ['vaSys', 'vaTech', 'vaBox'];
  let loading = false;
  const clear = () => IDS.forEach((i) => document.getElementById(i)?.remove());
  const btn = (t, cls) => { const b = h('button', 'btn' + (cls ? ' ' + cls : ''), t); b.type = 'button'; return b; };

  async function add() {
    const U = window.VassalUI, ch = U && U.ch; if (loading || !ch || ch.role !== 'vassal' || !ch.active || !U.host('admin') || document.getElementById('vaBox')) return;
    loading = true; let V = null; try { V = await window.sllm.vaState(ch.idx); } catch (e) { V = null; } loading = false;
    if (!U.ch || U.ch.key !== ch.key) { void add(); return; } if (!V || !V.ok || document.getElementById('vaBox')) return;
    const vname = ch.name, idx = ch.idx;
    const run = async (card, fn, btns) => {
      btns.forEach((b) => { b.disabled = true; }); card.say(L('처리 중…', 'Working…')); let r; try { r = await fn(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (r && r.ok) { const id = card.el.id; U.refresh(); setTimeout(() => { const m = document.querySelector(`#${id} .vk-msg`); if (m) m.textContent = r.text; }, 300); } else { card.say((r && r.error) || L('실패했습니다.', 'Failed.'), true); btns.forEach((b) => { b.disabled = !V.running; }); }
    };

    // ① 성계 이양
    const c1 = U.card('admin', 'vaSys', L('성계 이양', 'System transfer'), '✦', { order: 10 });
    if (c1) {
      c1.chip(L(`영향력 ${V.fee.base} + 식민지당 ${V.fee.perCol}`, `influence ${V.fee.base} + ${V.fee.perCol}/colony`));
      const dir = h('select'), sys = h('select'), load = btn(L('성계 목록', 'List systems')), go = btn(L('이양', 'Transfer'));
      for (const [v, t] of [['take', L(`${vname} → 우리 (가져오기)`, `${vname} → us (take)`)], ['give', L(`우리 → ${vname} (주기)`, `us → ${vname} (give)`)]]) { const o = h('option', '', t); o.value = v; dir.append(o); }
      const empty = () => { sys.textContent = ''; const o = h('option', '', L('— 목록을 불러오세요 —', '— load the list —')); o.value = ''; sys.append(o); go.disabled = true; };
      empty(); load.disabled = !V.running;
      load.onclick = async () => {
        load.disabled = true; sys.textContent = ''; const w = h('option', '', L('불러오는 중…', 'Loading…')); w.value = ''; sys.append(w);
        let r; try { r = await window.sllm.vaSystems(dir.value === 'take' ? idx : 0); } catch (e) { r = { ok: false, error: String(e) }; }
        sys.textContent = ''; load.disabled = !V.running;
        if (!r || !r.ok || !r.list.length) { const o = h('option', '', (r && r.error) || L('옮길 수 있는 성계가 없습니다.', 'No systems found.')); o.value = ''; sys.append(o); go.disabled = true; return; }
        for (const s of r.list) {
          const cool = V.cool && V.cool[String(s.n)], fee = V.fee.base + V.fee.perCol * s.col;
          const o = h('option', '', `${s.name} · ${L('식민지', 'colonies')} ${s.col} · ${L('영향력', 'influence')} ${fee}${s.cap ? L(' · 수도(불가)', ' · capital (no)') : ''}${cool ? L(' · 최근 옮김', ' · moved recently') : ''}`);
          o.value = String(s.n); o.dataset.name = s.name; o.dataset.col = String(s.col); o.disabled = !!s.cap; sys.append(o);
        }
        go.disabled = !V.running || ![...sys.options].some((o) => !o.disabled);
        const first = [...sys.options].find((o) => !o.disabled); if (first) sys.value = first.value;
      };
      dir.onchange = empty;
      go.onclick = () => { const o = sys.selectedOptions[0]; if (!o || !o.value) return; void run(c1, () => window.sllm.vaTransfer({ idx, n: Number(o.value), dir: dir.value, name: o.dataset.name, col: Number(o.dataset.col), vname }), [load, go]); };
      const r1 = h('div', 'vk-row'), r2 = h('div', 'vk-row'); r1.append(dir, load); r2.append(sys, go);
      c1.body.append(r1, r2, h('p', 'vk-d', L('국경이 붙지 않아도 됩니다. 가져오면 반감(자치도 +10)과 간섭 열기, 주면 감사(자치도 -6). 같은 성계는 5년에 한 번. 수도·점령된 행성이 있는 성계는 안 됩니다.', 'No shared border needed. Taking breeds resentment (autonomy +10) and meddling heat; giving earns gratitude (autonomy -6). Each system once per 5 years. Not for systems with a capital or an occupied planet.')), c1.msg);
    }

    // ② 기술 원조
    const c2 = U.card('admin', 'vaTech', L('기술 원조', 'Technology aid'), '⚗', { order: 20 });
    if (c2) {
      c2.chip(V.techLeft > 0 ? L(`${V.techLeft}년 뒤 다시`, `again in ${V.techLeft} yr`) : L('지금 가능', 'Available'), V.techLeft > 0 ? '' : 'good');
      const tb = btn(L(`연구 자료 넘기기 · 영향력 ${V.fee.tech}`, `Share research · ${V.fee.tech} influence`)); tb.disabled = !V.running || V.techLeft > 0;
      tb.onclick = () => run(c2, () => window.sllm.vaTech({ idx, vname }), [tb]);
      const r = h('div', 'vk-row'); r.append(tb);
      c2.body.append(r, h('p', 'vk-d', L('우리 월 연구량 6달 치를 종속국 연구에 보탭니다. 자치도 -8, 3년에 한 번. 손을 대는 일이라 간섭 열기가 조금 쌓입니다.', 'Adds six months of our research output to theirs. Autonomy -8, once per 3 years. It still counts as a little meddling.')), c2.msg);
    }

    // ③ 동화 정책 + 정책·종족 권리 동조
    const c3 = U.card('admin', 'vaBox', L('동화 정책', 'Assimilation'), '❖', { order: 30 });
    if (c3) {
      c3.chip(V.assim ? L(`진행 중 · 다음 걸음 ${V.assim.nextShift}년 뒤`, `Active · next step in ${V.assim.nextShift} yr`) : L('멈춤', 'Off'), V.assim ? 'warn' : '');
      const kv = h('div', 'vk-kv'); kv.append(h('span', '', L('우리 윤리', 'Our ethics')), h('span', '', en(V.ours)), h('span', '', L('그들 윤리', 'Their ethics')), h('span', '', en(V.theirs)));
      if (V.assim) kv.append(h('span', '', L('시작', 'Since')), h('span', '', V.assim.since));
      const ab = btn(V.assim ? L('동화 정책 멈추기', 'Stop assimilation') : L(`동화 정책 시작 · 영향력 ${V.fee.assim}`, `Begin assimilation · ${V.fee.assim} influence`), V.assim ? 'no' : ''); ab.disabled = !V.running;
      ab.onclick = () => run(c3, () => window.sllm.vaAssim({ idx, on: !V.assim, vname }), [ab]);
      const r = h('div', 'vk-row'); r.append(ab);
      c3.body.append(kv, r, h('p', 'vk-d', L('인구가 우리 윤리에 끌리고(+100%) 반대 윤리는 덜 끌립니다(-75%). 5년마다 정부 윤리가 우리 쪽으로 한 걸음, 같은 때 정책 하나 → 다음엔 종족 권리 하나(시민권·생활 수준)가 우리 쪽으로 옮겨 갑니다. 하는 동안 해마다 자치도 +3, 걸음마다 간섭 열기. 군체·기계 지성에는 못 겁니다.', 'Their pops are drawn to our ethics (+100%) and away from the opposites (-75%). Every 5 years their government shifts one step toward us, and at the same time one policy — then one species right (citizenship, living standard) — moves toward ours. Autonomy +3 each year while active; every step adds meddling heat. Not for gestalts.')), c3.msg);
    }
    if (!V.running) { const c = document.getElementById('vaSys'); if (c) c.querySelector('.vk-b').append(h('p', 'vk-d', L('게임이 켜져 있어야 행정 명령을 내릴 수 있습니다.', 'The game must be running to issue these orders.'))); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.vaState) return;
    const watch = () => { const pane = document.getElementById('pane'); if (!pane) return setTimeout(watch, 200); new MutationObserver(() => { void add(); }).observe(pane, { childList: true }); void add(); };
    document.addEventListener('vassal-refresh', () => { clear(); void add(); });
    watch();
  });
})();
