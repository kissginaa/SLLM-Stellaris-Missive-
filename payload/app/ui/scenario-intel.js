// 첩보 지도 — 회랑 정보국(시나리오 「회랑의 삼파전」 전용, 2026-11-07). 은하 지도 창(scenario-map.html)을 ?mode=intel 로 열면 켜진다.
// 자료: window.sllm.scnIntel() / scnIntelAct() — src/features/scenario-intel-app.ts. 지도 그리기는 scenario-map.js 가, 여기는 끼어들기(SCNMAP_HOOK)만.
// 안개: 정체를 모르는 귀족 섹터는 초상화 대신 「?」. 섹터 카드 아래 정보망 막대, 공작원이 있으면 핀. 오른쪽 판: 섹터 · 공작원 · 보고서 + 위쪽에 예산·의심도.
// 효과(2026-11-07): 화면은 부드럽게 나타나기만(광과민성 문제로 브라운관·깜빡임 뺌) · 효과음은 매스 이펙트/스텔라리스풍 UI 소리(WebAudio, 파일 없음) · 끄기 단추(localStorage).
// 연말 보고서(2026-11-07 B안): 덱 탭 위쪽과 보고서 탭에 그해 요약. 평범한 결과는 알림 없이 여기로.
// 카드 방식(2026-11-07): 아래쪽 손패 띠(카드를 누르거나 지도 섹터로 끌어다 놓아 고름) → 오른쪽 섹터 탭에서 그 섹터 공작원에게 내기. 덱 탭: 연례 회의·보상·상점·강화. 그림: assets/scenario/corridor/cards/.
// 2단계(2026-11-07): 귀족 공작 6종(이간질은 상대를 고름) · 의심도 단계 · 회랑과의 긴장 · 최후통첩 답하기 · 약점 카드.
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
  if (new URLSearchParams(location.search).get('mode') !== 'intel') return;
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  // ---- UI 효과음(2026-11-07 사용자: 「유치하다 — 매스 이펙트·스텔라리스 사운드에서 영감」) — 파일 없이 WebAudio 로.
  //   원칙: 네모파·톱니파·큰 음높이 미끄럼 없음. 낮고 짧은 울림(쿵) + 걸러 낸 공기 소리(쉭) + 맑은 유리 같은 울림(핑)을 작은 잔향과 함께, 소리는 작게.
  const UISND = (key) => {
    let ctx = null, bus = null, rv = null, on = true;
    try { on = localStorage.getItem(key) !== '0'; } catch (e) { on = true; }
    const ac = () => {
      if (!ctx) { try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain(); master.gain.value = 0.5; const comp = ctx.createDynamicsCompressor(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
        bus = ctx.createGain(); bus.connect(lp); lp.connect(master); master.connect(comp); comp.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 1.4), b = ctx.createBuffer(2, len, ctx.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
        rv = ctx.createConvolver(); rv.buffer = b; const wet = ctx.createGain(); wet.gain.value = 0.28; rv.connect(wet); wet.connect(lp);
      } catch (e) { ctx = null; } }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx && on ? ctx : null;
    };
    const env = (c, t, a, dur, vol) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(bus); g.connect(rv); return g; };
    /** 낮은 쿵(몸통) */
    const thump = (c, t, f, dur, vol) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dur); o.connect(env(c, t, 0.006, dur, vol)); o.start(t); o.stop(t + dur + 0.05); };
    /** 맑은 유리 울림(핑) — 배음을 살짝 어긋나게 해 금속·홀로그램 느낌 */
    const glass = (c, t, f, dur, vol) => { const g = env(c, t, 0.004, dur, vol), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.connect(g); for (const [m, v, ty] of [[1, 1, 'sine'], [2.01, 0.35, 'sine'], [1.5, 0.18, 'triangle']]) { const o = c.createOscillator(), og = c.createGain(); o.type = ty; o.frequency.value = f * m; og.gain.value = v; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); } };
    /** 걸러 낸 공기 소리(쉭) — f0→f1 로 쓸고 지나감 */
    const whoosh = (c, t, dur, f0, f1, vol) => { const n = c.createBufferSource(), b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; n.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + dur); n.connect(f); f.connect(g); g.connect(bus); g.connect(rv); n.start(t); };
    /** 아주 작은 딸깍 */
    const tick = (c, t, vol) => { const n = c.createBufferSource(), b = c.createBuffer(1, Math.floor(c.sampleRate * 0.015), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3; const g = c.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(bus); n.start(t); };
    let lastHover = 0;
    const api = {
      get on() { return on; },
      toggle() { on = !on; try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* 저장 안 돼도 됨 */ } return on; },
      /** 화면이 열릴 때: 낮게 차오르는 울림 + 지나가는 공기 + 조용한 유리 화음 */
      open() { const c = ac(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(38, t); o.frequency.linearRampToValueAtTime(52, t + 1.2); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 2.3); whoosh(c, t, 1.3, 220, 2600, 0.07); [523.25, 783.99, 1046.5].forEach((f, i) => glass(c, t + 0.85 + i * 0.05, f, 1.9, 0.022)); },
      /** 마우스를 올릴 때(너무 자주 울리지 않게) */
      hover() { const c = ac(); if (!c) return; const now = performance.now(); if (now - lastHover < 60) return; lastHover = now; tick(c, c.currentTime, 0.02); },
      /** 고르기: 낮은 쿵 + 짧은 쉭 + 핑 */
      select() { const c = ac(); if (!c) return; const t = c.currentTime; thump(c, t, 150, 0.16, 0.16); whoosh(c, t, 0.22, 700, 3200, 0.035); glass(c, t + 0.02, 880, 0.55, 0.03); },
      /** 확정·실행: 완전5도로 오르는 두 핑 */
      confirm() { const c = ac(); if (!c) return; const t = c.currentTime; thump(c, t, 120, 0.14, 0.12); glass(c, t, 659.25, 0.5, 0.032); glass(c, t + 0.07, 987.77, 0.8, 0.03); },
      /** 카드를 집을 때: 종이 스치듯 짧은 쉭 */
      card() { const c = ac(); if (!c) return; const t = c.currentTime; whoosh(c, t, 0.13, 1600, 4200, 0.045); tick(c, t + 0.1, 0.012); },
      /** 안 됨: 둔한 쿵 두 번 */
      error() { const c = ac(); if (!c) return; const t = c.currentTime; thump(c, t, 95, 0.2, 0.2); thump(c, t + 0.13, 80, 0.24, 0.17); },
      /** 경보: 내려가는 두 핑 + 낮은 쿵 */
      alert() { const c = ac(); if (!c) return; const t = c.currentTime; thump(c, t, 70, 0.5, 0.18); glass(c, t, 587.33, 0.9, 0.04); glass(c, t + 0.2, 466.16, 1.2, 0.04); },
    };
    window.addEventListener('pointerdown', () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }, { capture: true });
    return api;
  };
  // 첩보 화면의 소리 이름 → 새 효과음(예전 단말기 삑삑·웅웅거림·타자 소리는 뺌)
  const SFX = (() => { const u = UISND('sllmIntelSfx'); return { get on() { return u.on; }, toggle: () => u.toggle(), power: () => u.open(), type: () => {}, beep: () => u.hover(), select: () => u.select(), card: () => u.card(), play: () => u.confirm(), error: () => u.error(), humStart: () => {}, humStop: () => {} }; })();
  function powerOn() { // 화면 효과 없이 소리만(2026-11-07 광과민성 문제로 브라운관 연출은 뺌)
    SFX.power(); setTimeout(() => SFX.humStart(), 700);
  }

  let I = null, API = null, cur = null, tab = 'sector', msg = '', busy = false, selCard = null, dragCard = null, dragAgent = null; // dragAgent = 끌고 있는 공작원 카드(2026-11-08) // dragCard = 끌고 있는 카드(2026-11-07) // selCard = 손패에서 고른 카드 번호(카드 방식, 2026-11-07)
  const SKILL = () => [L('잠입', 'Infiltration'), L('설득', 'Persuasion'), L('위조', 'Forgery')];
  const ST = (s) => ({ idle: L('대기', 'Idle'), post: L('잠입 중', 'Embedded'), op: L('작전 중', 'On mission'), lost: L('연락 두절', 'Lost') })[s] || s;

  const css = () => { if ($('inCss')) return; const st = h('style'); st.id = 'inCss'; st.textContent =
    '#side{width:350px!important}'
    + '.gv.fog .pic{background:#071722!important;display:flex;align-items:center;justify-content:center;font-weight:700;color:#5fd4ff99!important;font-size:calc(var(--ps,40px)*.5)}'
    + '.gv .net{width:calc(var(--ps,40px)*1.3);height:4px;margin-top:3px;background:#ffffff1c;border-radius:2px;overflow:hidden}.gv .net i{display:block;height:100%;background:#7fd88f}'
    + '.gv .pin{position:absolute;top:-4px;left:calc(50% + var(--ps,40px)*.32);min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#e8c872;color:#1a1408;font-size:11px;font-weight:700;line-height:18px;text-align:center;}'
    + '.gv .pin.op{background:#ff9a6a}'
    + '.gv.spied .pic{border-color:#dff4ff!important;box-shadow:0 0 0 2px #dff4ff,0 0 16px 5px #9fd4ff99;animation:spyGlow 4s ease-in-out infinite alternate}'
    + '.gv.spy-op .pic{border-color:#ffc89a!important;box-shadow:0 0 0 2px #ffc89a,0 0 16px 5px #ff9a6a99;animation-name:spyGlowOp}'
    + '.gv .spyring{position:absolute;top:calc(var(--ps,40px)*-.18);left:50%;width:calc(var(--ps,40px)*1.36);height:calc(var(--ps,40px)*1.36);margin-left:calc(var(--ps,40px)*-.68);border:2px dashed #dff4ffcc;border-radius:50%;pointer-events:none;animation:spySpin 26s linear infinite;box-sizing:border-box}'
    + '.gv.spy-op .spyring{border-color:#ffc89acc}'
    + '.gv .fltb{margin-top:2px;padding:1px 6px;font-size:10px;font-weight:700;letter-spacing:.02em;border-radius:3px;white-space:nowrap;pointer-events:auto;cursor:help;background:#0a1420e6;border:1px solid}.gv .fltb.a{color:#9cc4ff;border-color:#5b8de0}.gv .fltb.b{color:#ffaaa0;border-color:#d9574a}#side .in-flt b{color:#ffd28a}#side .in-sum b{color:#c9e7ff}' // 함대 동향(2026-11-08)
    + '.gv .spyav{position:absolute;top:calc(var(--ps,40px)*-.28);left:calc(50% + var(--ps,40px)*.3);width:calc(var(--ps,40px)*.62);height:calc(var(--ps,40px)*.62);min-width:22px;min-height:22px;border-radius:50%;border:2px solid #dff4ff;background:#0a1a24 center/cover no-repeat;box-shadow:0 0 8px #000c}'
    + '.gv.spy-op .spyav{border-color:#ffc89a}'
    + '.gv .spylbl{margin-top:3px;padding:1px 7px;border-radius:9px;background:#0b2230e6;border:1px solid #9fd4ff88;color:#dff4ff;font-size:10.5px;font-weight:600;white-space:nowrap;text-shadow:none}'
    + '.gv.spy-op .spylbl{border-color:#ffc89a99;color:#ffe2c8;background:#2a160be6}'
    + '@keyframes spySpin{to{transform:rotate(360deg)}}@keyframes spyGlow{from{box-shadow:0 0 0 2px #dff4ff,0 0 10px 3px #9fd4ff66}to{box-shadow:0 0 0 2px #dff4ff,0 0 20px 7px #9fd4ffaa}}@keyframes spyGlowOp{from{box-shadow:0 0 0 2px #ffc89a,0 0 10px 3px #ff9a6a66}to{box-shadow:0 0 0 2px #ffc89a,0 0 20px 7px #ff9a6aaa}}'
    + '@media (prefers-reduced-motion:reduce){.gv .spyring,.gv.spied .pic{animation:none}}'
    + '#side .in-top{display:flex;flex-direction:column;gap:6px;padding-bottom:8px;border-bottom:1px solid var(--line2)}'
    + '#side .in-sus{display:flex;align-items:center;gap:6px;font-size:12px}#side .in-sus b{width:110px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#side .in-bar{flex:1;height:6px;background:#ffffff18;border-radius:3px;overflow:hidden}#side .in-bar i{display:block;height:100%}'
    + '#side .in-bud{display:flex;gap:4px;align-items:center;font-size:12px;flex-wrap:wrap}#side button{background:#5fd4e414;border:1px solid var(--line);border-radius:3px;padding:3px 8px;color:var(--text);font-size:12px}#side button.on{background:#5fd4e455;border-color:var(--hi);color:#fff}#side button:disabled{opacity:.4;cursor:default}'
    + '#side .in-tabs{display:flex;gap:4px;margin:8px 0}#side .in-tabs button{flex:1}'
    + '#side .in-card{border:1px solid var(--line2);border-radius:4px;padding:8px;margin:6px 0;background:#ffffff06}#side .in-card h4{margin:0 0 4px;font-size:13px;color:#fff}'
    + '#side .in-op{display:flex;flex-direction:column;gap:3px;border-top:1px solid var(--line2);padding-top:6px;margin-top:6px}#side .in-op small{color:var(--dim)}#side .in-op .n{display:flex;gap:8px;font-size:12px}#side .in-op .n span b{color:#7fd88f}#side .in-op .n span.r b{color:#ff9a6a}'
    + '#side .in-msg{padding:6px 8px;border:1px solid #e8c87288;background:#e8c87214;border-radius:3px;font-size:12px;margin:6px 0}'
    + '#side .in-rep{font-size:12px;padding:5px 0;border-bottom:1px solid var(--line2)}#side .in-rep small{display:block;color:var(--dim)}#side .in-rep.bad{color:#ffb38a}'
    + '#side .in-sk{display:flex;gap:8px;font-size:11.5px;color:var(--dim)}#side .in-sk b{color:#e8c872}'
    + '#side .in-sus.ho b{font-weight:400;color:var(--dim)}#side .in-mkt .mk{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0}#side .mki{display:flex;flex-direction:column;align-items:center;gap:4px}#side .mki .icard{width:84px;height:126px}#side .mki .icard .nm{font-size:8.5px}#side .mki .icard .ds{display:none}#side .mki.sold .icard{opacity:.3;filter:grayscale(1)}#side .mkt{font-size:10.5px;padding:1px 6px;border-radius:3px;letter-spacing:.5px}#side .mkt.op{background:#e8b45a22;color:#f0c878}#side .mkt.duel{background:#9fd4ff22;color:#9fd4ff}#side .mki button{width:100%}#side .mki button.sale{border-color:#7fe0a0;color:#7fe0a0}#side .in-plan{font-size:11.5px;color:#cfe6ff;padding:2px 0 4px 18px}#side .in-plan b{color:#9fd4ff;margin-right:2px}#side .in-ult{border:1px solid #ff5a5a88;background:#ff5a5a14;border-radius:4px;padding:8px;font-size:12px;display:flex;flex-direction:column;gap:5px}#side .in-ult .bt{display:flex;gap:4px;flex-wrap:wrap}'
    + '#inHand{position:absolute;left:14px;right:388px;bottom:8px;height:198px;display:flex;align-items:flex-end;gap:8px;padding:0 8px;pointer-events:none;z-index:5}'
    + '#inHand .ip{pointer-events:auto;flex:none;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a8,#c8962e 55%,#5a3d0c);box-shadow:0 0 16px #e8c87288;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1a1206;font-weight:800;font-size:26px;margin-bottom:10px}'
    + '#inHand .ip small{font-size:10px;font-weight:600}#inHand .pile{pointer-events:auto;flex:none;font-size:11px;color:var(--dim);text-align:center;margin-bottom:12px}'
    + '#inHand .pile .cb{width:52px;height:78px;margin:0 auto 3px;background:url(assets/scenario/corridor/cards/card_back.png) center/cover;border-radius:5px}'
    + '#inHand .row{display:flex;gap:6px;align-items:flex-end;justify-content:center;overflow:visible;padding-top:24px;pointer-events:auto;flex:1;min-width:0}'
    + '.icard{position:relative;flex:none;width:104px;height:156px;border-radius:7px;cursor:pointer;transition:transform .15s,margin .15s;user-select:none;color:#fff}'
    // 슬레이 더 스파이어처럼(2026-11-08 사용자: 「설명이 카드에 바로 적혀 있고, 갖다 대면 카드가 커지면서 읽기 쉽게」): 손패는 부채꼴로 펼치고, 마우스를 올리면 크게 들어 올린다
    + '#inHand .icard{width:122px;height:183px;transform-origin:50% 100%;transform:translateY(var(--y,0px)) rotate(var(--r,0deg))}'
    + '#inHand .icard:hover{transform:translateY(-38px) rotate(0deg) scale(1.85);z-index:30;filter:drop-shadow(0 12px 22px #000c)}'
    + '#inHand .icard.sel{transform:translateY(calc(var(--y,0px) - 24px)) rotate(var(--r,0deg));filter:drop-shadow(0 0 10px #e8c872)}#inHand .icard.sel:hover{transform:translateY(-38px) rotate(0deg) scale(1.85)}'
    + '#inHand .icard .nm{font-size:10px}#inHand .icard .ds{font-size:7.6px;line-height:1.28}#inHand .icard:hover .why{font-size:6px}'
    + '.icard:hover{transform:translateY(-6px) scale(1.04);z-index:3}.icard.sel{transform:translateY(-10px);filter:drop-shadow(0 0 10px #e8c872)}.icard.off{filter:grayscale(.6) brightness(.7)}'
    + '.icard .art{position:absolute;left:8%;top:6.7%;width:84%;height:45.6%;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:2.4em;opacity:.9}'
    + '.icard .fr{position:absolute;inset:0;background:center/100% 100% no-repeat}'
    // 방첩 대전(2026-11-08): 지도 위 경보 띠 + 대전판 — 해킹 단말(노드·방어 버퍼) + 하스스톤 규칙. 색: 얼음빛 파랑 · 초록 · 진홍. 깜빡임·번쩍임 없음(광과민성 배려)
    + '#inFoe{position:absolute;left:14px;right:388px;top:58px;display:flex;justify-content:center;pointer-events:none;z-index:6}'
    + '#inFoe .fb{pointer-events:auto;display:flex;gap:12px;align-items:center;padding:8px 14px;background:#0a0f12ee;border:1px solid #ff4a5a;color:#f3e6e6;font:12.5px/1.4 Consolas,"D2Coding","Malgun Gothic",monospace;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);animation:inFoeGlow 2.8s ease-in-out infinite}'
    + '@keyframes inFoeGlow{0%,100%{box-shadow:inset 0 0 10px #ff4a5a33}50%{box-shadow:inset 0 0 26px #ff4a5a66}}'
    + '#inFoe .fb b{color:#ff6a78;letter-spacing:.06em}#inFoe .fb.done{animation:none;border-color:#7fe0a0}#inFoe .fb.done b{color:#7fe0a0}#inFoe .fb.done.bad{border-color:#ffb08a}#inFoe .fb.done.bad b{color:#ffb08a}'
    + '#inFoe button,#inDuel button{font:700 12px Consolas,"D2Coding","Malgun Gothic",monospace;letter-spacing:.05em;border:1px solid #9fd4ff;background:#9fd4ff14;color:#9fd4ff;padding:6px 12px;cursor:pointer;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}#inFoe button:hover,#inDuel button:hover{background:#9fd4ff;color:#0a0f12}'
    + '#inDuel{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:#03070acc;backdrop-filter:blur(2px)}'
    + '#inDuel .db{position:relative;width:min(1200px,96vw);max-height:97vh;display:flex;flex-direction:column;gap:8px;padding:14px 20px 16px;background:linear-gradient(180deg,#0c1418f7,#070c0ff7);border:1px solid #7fe0a055;color:#d8f6f2;font-family:Consolas,"D2Coding","Malgun Gothic",monospace;overflow:auto;clip-path:polygon(18px 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%,0 18px);box-shadow:inset 0 0 0 1px #7fe0a022,inset 0 0 60px #7fe0a011}'
    + '#inDuel .db::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,#7fe0a008 0 1px,transparent 1px 3px),linear-gradient(90deg,#7fe0a00a 1px,transparent 1px) 0 0/48px 48px,linear-gradient(0deg,#7fe0a00a 1px,transparent 1px) 0 0/48px 48px}'
    + '#inDuel .hex{position:absolute;right:16px;top:64px;bottom:150px;width:150px;overflow:hidden;font-size:10px;line-height:1.55;color:#7fe0a01c;white-space:pre;pointer-events:none;text-align:right}'
    + '#inDuel .dbar{display:flex;align-items:center;gap:10px;font-size:11px;letter-spacing:.18em;color:#9fd4ff;background:linear-gradient(90deg,#16304a,#0e1c2c 70%,transparent);border-bottom:1px solid #9fd4ff55;padding:3px 10px;margin:-14px -20px 0}#inDuel .dbar b{font-size:12px}#inDuel .dbar span{margin-left:auto;opacity:.75}'
    + '#inDuel .dtop{position:relative;display:flex;align-items:center;gap:14px}#inDuel .dwho{display:flex;align-items:center;gap:12px;flex:1}'
    + '#inDuel .dav{width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;background:#ff4a5a18;border:1px solid #ff4a5a;color:#ff6a78;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}'
    + '#inDuel .dwho b{color:#ff6a78;letter-spacing:.04em}#inDuel .dwho small{color:#9fc8c2}#inDuel .dleft{font-weight:700;color:#9fd4ff;letter-spacing:.08em;border:1px solid #9fd4ff66;padding:3px 9px}#inDuel .dx{padding:4px 10px}'
    + '#inDuel .dgrid{position:relative;display:flex;gap:22px;padding:2px 4px}#inDuel .dgc{flex:1;display:flex;flex-direction:column;gap:4px}#inDuel .dgr{position:relative;display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.06em}#inDuel .dgr b{min-width:84px}#inDuel .dgr.foe b{color:#ff6a78}#inDuel .dgr.me b{color:#7fe0a0}#inDuel .dgr span{min-width:70px;text-align:right;color:#c8e8e4;font-weight:700}#inDuel .dgr span.low{color:#ff6a78}'
    + '#inDuel .gbar{flex:1;position:relative;height:11px;background:#ffffff0d;border:1px solid #ffffff22}#inDuel .gbar i{position:absolute;top:0;bottom:0;transition:width .5s ease,left .5s ease}#inDuel .dgr.me .gbar i.aft{left:0;background:linear-gradient(90deg,#3a9a6a,#7fe0a0)}#inDuel .dgr.foe .gbar i.aft{left:0;background:linear-gradient(90deg,#a0202c,#ff4a5a)}#inDuel .gbar i.now{background:repeating-linear-gradient(45deg,#ff4a5a88 0 4px,#ff4a5a33 4px 8px)}#inDuel .gbar s{position:absolute;top:-3px;bottom:-3px;width:2px;background:#ff6a78}'
    + '#inDuel .dfloat{position:absolute;left:50%;top:-14px;font-size:20px;font-weight:900;pointer-events:none;animation:inFloat 1.3s ease-out forwards;text-shadow:0 2px 4px #000}#inDuel .dfloat.foe{color:#ffd0d4}#inDuel .dfloat.me{color:#ff6a78}'
    + '@keyframes inFloat{from{transform:translateY(0);opacity:1}to{transform:translateY(-24px);opacity:0}}'
    + '#inDuel .dchips{display:flex;flex-wrap:wrap;gap:5px}#inDuel .dchip{font-size:10.5px;padding:1px 7px;border:1px solid;letter-spacing:.04em}#inDuel .dchip.blk{color:#9fd4ff;border-color:#9fd4ff}#inDuel .dchip.up{color:#7fe0a0;border-color:#7fe0a088}#inDuel .dchip.dn{color:#ffb08a;border-color:#ffb08a88}#inDuel .dchip.psn{color:#c89aff;border-color:#c89aff88}#inDuel .dchip.sec{color:#e0b0ff;border-color:#b07ae0;background:#b07ae014}'
    + '#inDuel .dfield{position:relative;display:flex;justify-content:center;gap:26px;padding:14px 6px 8px;border-top:1px solid #ff4a5a55;min-height:260px;background:linear-gradient(180deg,#ff4a5a08,transparent 60%)}'
    + '#inDuel .dfield::before{content:"// 적 침입 노드  INTRUSION NODES";position:absolute;left:4px;top:-9px;font-size:10px;letter-spacing:.14em;color:#ff6a78;background:#0b1316;padding:0 6px}'
    + '#inDuel .dempty{align-self:center;color:#9fc8c2;font-size:12px;letter-spacing:.06em}'
    + '#inDuel .dcol{display:flex;flex-direction:column;align-items:center;gap:6px;width:154px;position:relative}#inDuel .dnode{font-size:10px;letter-spacing:.16em;color:#ff6a78}'
    + '#inDuel .dcol::after{content:"";position:absolute;left:50%;top:24px;bottom:84px;width:1px;background:linear-gradient(#ff4a5a66,#7fe0a066);z-index:-1}'
    + '#inDuel .icard.dfoe{width:130px;height:195px;cursor:default;filter:drop-shadow(0 0 8px #ff4a5a66)}#inDuel .icard.dfoe:hover{transform:scale(1.35);z-index:20}#inDuel .icard.dfoe .ds{font-size:9px}'
    + '#inDuel .dtg{font-size:11px;color:#ffc8cc;text-align:center}#inDuel .dtg em{font-style:normal;font-size:9.5px;letter-spacing:.16em;color:#ff8a94}'
    + '#inDuel .dch{font-weight:800;font-size:15px;color:#ff6a78;background:#0a0f12;border:1px solid #ff4a5a;padding:1px 12px;letter-spacing:.06em;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}#inDuel .dch.low{color:#7fe0a0;border-color:#7fe0a0}'
    + '#inDuel .dslot{width:146px;min-height:80px;border:1px dashed #9fd4ff77;display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;padding:4px;cursor:pointer;background:#9fd4ff08;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}'
    + '#inDuel .dslot small{color:#9fd4ffaa;font-size:10px;letter-spacing:.12em}#inDuel .dslot.ready{border:1px solid #9fd4ff;background:#9fd4ff14}#inDuel .dslot.ready small{color:#9fd4ff}#inDuel .dslot.hot{background:#9fd4ff2a}#inDuel .dslot.nofit{opacity:.35;cursor:not-allowed}'
    + '#inDuel .dslot .icard{width:44px;height:66px}#inDuel .dslot .icard .ds,#inDuel .dslot .icard .nm{display:none}'
    + '#inDuel .dstrip{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;font-size:11px}#inDuel .dstrip small{font-size:9.5px;letter-spacing:.14em;color:#9fc8c2;margin:0 4px}'
    + '#inDuel .dstamp{font-weight:800;font-size:11px;padding:2px 8px;border:1px solid;letter-spacing:.06em}#inDuel .dstamp.hit{color:#0a0f12;background:#ff4a5a;border-color:#ff4a5a}#inDuel .dstamp.block{color:#0a0f12;background:#7fe0a0;border-color:#7fe0a0}#inDuel .dstamp.decoy{color:#9fd4ff;border-color:#9fd4ff;background:#9fd4ff14}#inDuel .dstamp.wait{color:#c8e8e4;border-color:#c8e8e455}'
    + '#inDuel .dez{display:flex;align-items:center;gap:16px;padding:6px 8px;border:1px solid #ff4a5a33;background:linear-gradient(180deg,#ff4a5a10,transparent)}#inDuel .dhero{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}#inDuel .dhero.me{padding:6px 8px;border:1px solid #7fe0a033;background:linear-gradient(0deg,#7fe0a010,transparent)}'
    + '#inDuel .dehand{display:flex;align-items:center;height:62px;padding:0 10px}#inDuel .dback{display:block;width:34px;height:50px;margin-left:-12px;background:#1a0c10 url(assets/scenario/corridor/cards/card_back_foe.png) center/cover no-repeat;border:1px solid #ff4a5a99;border-radius:3px;box-shadow:0 2px 6px #000a}#inDuel .dback:first-child{margin-left:0}'
    + '#inDuel .decount{display:flex;flex-direction:column;align-items:center;min-width:64px}#inDuel .decount b{font-size:24px;color:#ff8a94;line-height:1}#inDuel .decount small{font-size:9.5px;letter-spacing:.14em;color:#ffb8be}'
    + '#inDuel .dpile{width:40px;height:54px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#ffd0d4;background:#1a0c10 url(assets/scenario/corridor/cards/card_back_foe.png) center/cover no-repeat;border:1px solid #ff4a5a77;box-shadow:3px 3px 0 #1a0c10,6px 6px 0 #ff4a5a33;text-shadow:0 1px 3px #000}'
    + '#inDuel .deplayed{display:flex;align-items:center;gap:6px;padding-left:10px;border-left:1px solid #ff4a5a33}#inDuel .deplayed small{writing-mode:vertical-rl;font-size:9.5px}#inDuel .db>*{flex-shrink:0}#inDuel .deplayed small,#inDuel .dmlab{font-size:10px;letter-spacing:.14em;color:#ff8a94}#inDuel .dmlab{color:#7fe0a0}'
    + '#inDuel .icard.dmini{width:50px;height:75px;cursor:default}#inDuel .icard.dmini .ds{display:none}#inDuel .icard.dmini .nm{font-size:8px}#inDuel .icard.dmini:hover{transform:scale(1.8);z-index:30}'
    + '#inDuel .dmine{position:relative;display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:6px 14px;padding:8px 8px 4px;border-top:2px solid #7fe0a066;background:linear-gradient(180deg,#7fe0a00c,transparent)}#inDuel .dmine::before{content:"";position:absolute;left:10%;right:10%;top:-2px;height:2px;background:linear-gradient(90deg,transparent,#c8ffe0,transparent);opacity:.6}'
    + '#inDuel .dmrow{flex:1;display:flex;gap:10px;justify-content:center;align-items:flex-end;min-height:92px;flex-wrap:wrap}#inDuel .dmine .dempty{font-size:11px}#inDuel .dmlab{writing-mode:horizontal-tb;max-width:120px}#inDuel .dmine .dstrip{flex-basis:100%}#inDuel .dtg{display:none}#inDuel .dmc{display:flex;flex-direction:column;align-items:center;gap:4px}#inDuel .dmres{font-size:10.5px;font-weight:800;padding:1px 7px;border:1px solid;letter-spacing:.04em}#inDuel .dmres.hit{color:#0a0f12;background:#7fe0a0;border-color:#7fe0a0}#inDuel .dmres.buf{color:#9fd4ff;border-color:#9fd4ff}#inDuel .dmres.eff{color:#d8f6f2;border-color:#d8f6f266}'
    + '#inDuel .dstamp.mine{color:#c8ffe0;border-color:#7fe0a088;background:#7fe0a014;font-weight:600}'
    + '#inDuel .dsec{font-size:10px;letter-spacing:.14em;color:#7fe0a0;border-top:1px solid #7fe0a055;padding-top:4px}'
    + '#inDuel .dtip{text-align:center;font-size:11px;color:#9fd4ff;letter-spacing:.03em}#inDuel .dtip::before{content:"> "}'
    + '#inDuel .dbot{position:relative;display:flex;align-items:flex-end;gap:14px}'
    + '#inDuel .dip{flex:none;width:92px;height:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:22px;font-weight:800;color:#9fd4ff;background:#9fd4ff12;border:1px solid #9fd4ff;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}#inDuel .dip small{font-size:9px;letter-spacing:.1em}'
    + '#inDuel .dmana .cr{display:flex;flex-wrap:wrap;width:56px;gap:2px;justify-content:center}#inDuel .dmana .cr i{width:6px;height:6px;transform:rotate(45deg);border:1px solid #9fd4ff55}#inDuel .dmana .cr i.on{background:#9fd4ff;border-color:#9fd4ff}#inDuel .dmana .cr i.used{background:#1a3048;border-color:#3a6a90}'
    + '#inDuel .dhand{flex:1;display:flex;gap:10px;justify-content:center;align-items:flex-end;min-height:184px;padding-bottom:12px;flex-wrap:wrap}#inDuel .dhand .icard{filter:drop-shadow(0 0 6px #7fe0a055)}#inDuel .dhand .icard:hover{transform:translateY(-14px) scale(1.3);z-index:5}#inDuel .dhand .icard.sel{filter:drop-shadow(0 0 10px #9fd4ff)}#inDuel .dhand .icard.off{filter:grayscale(.7) brightness(.6)}'
    + '#inDuel .drole{position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);font-size:9px;letter-spacing:.08em;padding:1px 6px;white-space:nowrap;background:#0a0f12;border:1px solid;z-index:6}#inDuel .drole.buf{color:#9fd4ff;border-color:#9fd4ff}#inDuel .drole.atk{color:#ffb08a;border-color:#ffb08a}#inDuel .drole.now{color:#7fe0a0;border-color:#7fe0a0}'
    + '#inDuel .dside2{display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:210px}#inDuel .ddk{font-size:10.5px;color:#9fc8c2;letter-spacing:.06em;text-align:right}'
    + '#inDuel .dend{font-size:13px!important;padding:10px 18px!important;background:#9fd4ff!important;color:#0a0f12!important}#inDuel .dend:hover{background:#c8e6ff!important}#inDuel .dauto{border-color:#7fe0a0!important;color:#7fe0a0!important;background:#7fe0a014!important}#inDuel .dauto:hover{background:#7fe0a0!important;color:#0a0f12!important}'
    + '#inDuel .dfoot{display:flex;justify-content:flex-end}#inDuel .drow{display:flex;gap:10px;justify-content:center}'
    + '#inDuel .dres-big{text-align:center;font-size:24px;font-weight:900;letter-spacing:.16em;padding:14px;border:1px solid}#inDuel .dres-big.win{color:#7fe0a0;border-color:#7fe0a0}#inDuel .dres-big.draw{color:#9fd4ff;border-color:#9fd4ff}#inDuel .dres-big.lose{color:#ff6a78;border-color:#ff6a78}'
    + '#inDuel .dres-txt{font-size:12px;line-height:1.6;color:#c8e8e4;padding:4px 8px}#inDuel .doffer{display:flex;flex-direction:column;align-items:center;gap:8px}#inDuel .doffer .icard:hover{transform:scale(1.15)}'
    + '.in-tabs .tbadge{display:inline-block;margin-left:5px;min-width:16px;padding:0 4px;border-radius:8px;background:#ffb08a33;color:#ffb08a;font-size:10px;font-weight:800}.in-tabs .tbadge.hi{background:#ff4a5a;color:#fff}'
    + '.in-thr{margin:6px 0;padding:8px 10px;border-left:3px solid;background:#ffffff08;font-size:12px;line-height:1.5}.in-thr.lv3{border-color:#ff4a5a;background:#ff4a5a12}.in-thr.lv2{border-color:#ffb08a}.in-thr.lv1{border-color:#7fa3ad}'
    + '.in-thr .th{display:flex;align-items:center;gap:6px}.in-thr .th .ic{font-size:15px}.in-thr .th b{flex:1}.in-thr.lv3 .th b{color:#ff8a94}.in-thr .th .dd{font-weight:800;color:#ffcf8a}.in-thr .tx{color:#c8d8dc;margin-top:3px}.in-thr button{margin-top:6px}'
    + '#inHand .icard.counter-can{filter:drop-shadow(0 0 9px #7fd88f)}'
    // 희귀도(2026-11-08): 일반은 그대로, 고급은 푸른 테두리, 희귀는 금빛 테두리와 지나가는 광택 — 오른쪽 위 보석 색으로도 구분
    + '.icard .gem{position:absolute;right:10%;top:7.2%;width:8%;aspect-ratio:1;transform:translate(50%,-50%) rotate(45deg);border:1px solid #000b;z-index:4;background:#9aa3ad}'
    + '.icard.rar-u{box-shadow:0 0 0 1.5px #5fb4ffcc,0 0 10px #4aa8ff66}.icard.rar-u .gem{background:#4aa8ff;box-shadow:0 0 6px #4aa8ff}.icard.rar-u .nm{color:#bfe0ff}'
    + '.icard.rar-r{box-shadow:0 0 0 2px #ffd25acc,0 0 16px #ffb84a99}.icard.rar-r .gem{background:#ffcf4a;box-shadow:0 0 9px #ffcf4a}.icard.rar-r .nm{color:#ffe08a}'
    + '.icard.rar-r::after{content:"";position:absolute;inset:0;border-radius:7px;pointer-events:none;z-index:5;background:linear-gradient(115deg,transparent 35%,#fff5 47%,transparent 59%) no-repeat;background-size:260% 100%;animation:inRsh 3.4s linear infinite;mix-blend-mode:screen}'
    + '@keyframes inRsh{from{background-position:140% 0}to{background-position:-60% 0}}'
    + '.icard .cost{position:absolute;left:13%;top:8.7%;transform:translate(-50%,-50%);font-weight:800;font-size:15px;text-shadow:0 0 4px #000}'
    + '.icard .nm{position:absolute;left:8%;width:84%;top:53.3%;height:8.9%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:9.5px;font-weight:700;line-height:1.05;padding:0 3px;box-sizing:border-box}'
    + '.icard .ds{position:absolute;left:10%;width:80%;top:67%;height:27%;font-size:8px;line-height:1.25;color:#d8e0ea;overflow:hidden;text-align:center;text-shadow:0 1px 2px #000}'
    + '.icard.big{width:200px;height:300px}.icard.big .cost{font-size:26px}.icard.big .nm{font-size:15px}.icard.big .ds{font-size:12px}.icard.big:hover{transform:none}.icard.big .art{font-size:4.5em}'
    + '#side .in-play{display:flex;flex-direction:column;gap:6px;align-items:flex-start;border-top:1px solid var(--line2);margin-top:8px;padding-top:8px}#side .in-play .n{display:flex;gap:8px;font-size:12px}#side .in-play .n span b{color:#7fd88f}#side .in-play .n span.r b{color:#ff9a6a}'
    + '#side .in-deck{display:flex;flex-wrap:wrap;gap:6px}#side .in-li{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px;padding:3px 0;border-bottom:1px solid var(--line2)}'
    + '.gv.dd-ok .pic{box-shadow:0 0 0 3px #7fd88f,0 0 18px #7fd88f!important}.gv.dd-ok.dd-hover{transform:translate(-50%,-50%) scale(1.18);z-index:4}.gv.dd-no{opacity:.3}.icard[draggable=true]{cursor:grab}.icard.drag{opacity:.45}'
    + '#side .in-rep,#side .in-yr{white-space:pre-line}#side .in-rep.yr{border:1px solid #e8c87266;background:#e8c87210;border-radius:4px;padding:6px 8px;margin:4px 0}#side .in-yr{font-size:12px;max-height:220px;overflow:auto}'
    + '#sm{animation:inFade .35s ease-out both!important}@keyframes inFade{from{opacity:0}to{opacity:1}}' // 2026-11-07 사용자: 「광과민성 — 깔끔하게」 → 브라운관 켜짐·깜빡임·주사선·타자 효과를 모두 없애고 부드럽게 나타나기만
    + '#side .in-sfx{position:absolute;right:10px;top:6px;padding:1px 6px!important;font-size:12px!important;opacity:.75}#side{position:absolute}'
    + '#side select{background:#0b1a24;color:var(--text);border:1px solid var(--line);border-radius:3px;font-size:12px;padding:2px 4px}#side .in-why{color:#ffb38a;font-size:11.5px}#side .in-cardk{color:#e8c872}'
    // ---- 2026-11-08 사용자: 「처음 들어가 카드를 눌렀을 때 왜 안 써지지?」 · 「더 예쁘고 직관적으로 — 섹터를 누르면 주변이 어두워지며 포커스」 ----
    + '#inFocus{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s ease;background:radial-gradient(circle at var(--fx,50%) var(--fy,50%),transparent 0,transparent var(--fr,80px),rgba(1,5,9,.58) calc(var(--fr,80px) * 2.6),rgba(1,5,9,.82) 100%)}'
    + '#sm.in-focus #inFocus{opacity:1}#sm.in-focus .gv:not(.sel){opacity:.32}#sm.in-focus .gv.sel{z-index:4}#sm.in-focus .gv.sel .tag{display:block!important}'
    + '#sm.in-focus .gv.sel .pic{box-shadow:0 0 0 2px #fff,0 0 0 5px color-mix(in srgb,var(--sc,#5fd4e4) 55%,transparent),0 0 34px var(--sc,#5fd4e4)!important}'
    + '#side .dos{position:relative;border:1px solid var(--line2);border-radius:6px;padding:12px;margin:6px 0;background:linear-gradient(160deg,color-mix(in srgb,var(--sc,#5fd4e4) 14%,transparent),#ffffff05 60%)}'
    + '#side .dos-h{display:flex;gap:12px;align-items:center}#side .dos-pic{flex:none;width:58px;height:58px;border-radius:50%;border:2px solid var(--sc,#5fd4e4);background:#071722 center/cover no-repeat;box-shadow:0 0 14px color-mix(in srgb,var(--sc,#5fd4e4) 55%,transparent);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#5fd4ff99}'
    + '#side .dos-h b{display:block;font-size:15px;color:#fff;line-height:1.25}#side .dos-h small{display:block;color:var(--dim);font-size:11.5px}'
    + '#side .side-b{display:inline-block;margin-top:3px;padding:0 6px;border-radius:8px;font-size:10.5px;font-weight:700;color:#06121a}'
    + '#side .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}#side .chip{font-size:11px;padding:1px 7px;border-radius:9px;border:1px solid var(--line2);color:var(--dim)}#side .chip.ok{border-color:#7fd88f88;color:#bff0c8;background:#7fd88f14}#side .chip.gold{border-color:#e8c87288;color:#f3dc9c;background:#e8c87214}'
    + '#side .gauge{margin-top:10px}#side .gauge .lb{display:flex;justify-content:space-between;font-size:11.5px;color:var(--dim)}#side .gauge .lb b{color:#fff;font-size:13px}#side .gauge .tr{height:9px;border-radius:5px;background:#ffffff14;overflow:hidden;margin-top:3px}#side .gauge .tr i{display:block;height:100%;background:linear-gradient(90deg,#3fb8b0,#7fd88f);box-shadow:0 0 8px #7fd88f88}'
    + '#side .steps{display:flex;gap:4px;margin:10px 0 2px}#side .step{flex:1;border-radius:4px;padding:5px 6px;font-size:11px;line-height:1.3;border:1px solid var(--line2);color:var(--dim);background:#ffffff05}#side .step b{display:block;font-size:11.5px}'
    + '#side .step.done{border-color:#7fd88f77;color:#bff0c8;background:#7fd88f12}#side .step.now{border-color:#e8c872;color:#fff;background:#e8c87218;box-shadow:0 0 10px #e8c87233}'
    + '#side .nexth{margin-top:10px;padding:8px 10px;border-radius:4px;border-left:3px solid #e8c872;background:#e8c87210;font-size:12px;color:#f3e6bf}'
    + '#side .ag{display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid var(--line2);border-radius:5px;margin-top:6px;background:#ffffff05}#side .ag .av{flex:none;width:30px;height:30px;border-radius:50%;background:#e8c872;color:#1a1408;font-weight:800;display:flex;align-items:center;justify-content:center}#side .ag .tx{flex:1;min-width:0}#side .ag .tx b{display:block;font-size:12.5px}'
    + '#side button.pri{background:linear-gradient(180deg,#5fd4e455,#5fd4e422);border-color:var(--hi);color:#fff;font-weight:600;padding:4px 10px}#side button.pri:hover{box-shadow:0 0 12px #5fd4e466}'
    + '#side .minis{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}#side .minis .icard{width:78px;height:117px}#side .minis .icard .nm{font-size:8px}#side .minis .icard .ds{display:none}'
    + '#inHint{position:absolute;left:24px;bottom:192px;max-width:min(760px,calc(100% - 420px));z-index:6;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 12px;border-radius:5px;background:#04121aee;border:1px solid #e8c87288;color:#f3e6bf;font-size:12.5px;box-shadow:0 4px 18px #0008}'
    + '#inHint .st{display:inline-flex;align-items:center;gap:5px}#inHint .st i{font-style:normal;width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:#ffffff1a;color:#dceef2}#inHint .st.done i{background:#7fd88f;color:#06120a}#inHint .st.now i{background:#e8c872;color:#1a1206}#inHint .ar{color:#7fa3ad}'
    + '#inHint button{background:#5fd4e422;border:1px solid var(--line);border-radius:3px;padding:2px 8px;color:#fff;font-size:12px;cursor:pointer}'
    + '.acard{position:relative;flex:none;width:104px;height:156px;border-radius:7px;overflow:hidden;cursor:grab;user-select:none;color:#fff;border:1px solid #5fd4e455;background:#06121a center/cover no-repeat;box-shadow:0 4px 14px #0009;transition:transform .12s}'
    + '.acard:hover{transform:translateY(-14px) scale(1.05);z-index:3;border-color:#5fd4e4}.acard.drag{opacity:.45}.acard.posted{border-color:#e8c87288}.acard.busy{filter:saturate(.6)}'
    + '.acard .pl{position:absolute;left:0;right:0;bottom:0;padding:16px 5px 5px;background:linear-gradient(180deg,transparent,#000d 45%);text-align:center}.acard .pl b{display:block;font-size:11px;line-height:1.2}.acard .pl small{display:block;font-size:9px;color:#9fc6cf;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.acard .sk{display:flex;justify-content:center;gap:5px;font-size:8.5px;color:#e8c872;margin-top:1px}.acard .tagx{position:absolute;top:5px;left:5px;padding:0 5px;border-radius:7px;font-size:9px;font-weight:700;background:#e8c872;color:#1a1408}.acard .tagx.idle{background:#5fd4e4;color:#03141a}.acard .tagx.op{background:#ff9a6a}'
    + '.acard.hire{cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-style:dashed;background:#5fd4e40a;color:#9fd8e4;font-size:11px;text-align:center}.acard.hire .plus{font-size:30px;line-height:1}'
    + '.acard.lead{cursor:default;border-color:#e8c872;box-shadow:0 0 14px #e8c87266}.acard.lead:hover{transform:none}'
    + '#inHand .sep{flex:none;width:1px;align-self:stretch;margin:24px 4px 8px;background:linear-gradient(180deg,transparent,#5fd4e466,transparent)}'
    + '#side .ag .av.pic{background:#06121a center 16%/cover no-repeat;border:1px solid #5fd4e455}'
    + '.icard.can{filter:drop-shadow(0 0 8px #7fd88f)}.icard .why{position:absolute;left:4px;right:4px;bottom:4px;padding:2px 3px;border-radius:3px;background:#000c;color:#ffb38a;font-size:9px;line-height:1.2;text-align:center;pointer-events:none}.icard.can .why{display:none}';
    document.head.append(st); };

  const nobleOf = (sc) => (sc && sc.nb !== undefined && I ? I.nobles.find((n) => n.id === sc.nb) : null);
  const agentAt = (id) => (I ? I.agents.find((a) => a.at === id) : null);
  const secOfNoble = (id) => { const D = API && API.data(); return D ? D.sectors.find((s) => s.nb === id) : null; };

  // ---- 카드 그리기(2026-11-07) ----
  const TYPE_COL = { recon: '#3fb8b0', op: '#e0a040', grand: '#c8323c', support: '#8fb4d8', counter: '#4ad08a', weak: '#8a4fc8', curse: '#7a7a80', foe: '#ff4a4a' };
  const FRAME_OF = { counter: 'support', foe: 'grand' }; // 전용 틀이 오기 전엔 닮은 틀을 빌린다
  // 삽화가 들어오기 전 임시 기호(지금은 쓰지 않음, 남겨 둠)
  const GLYPH = { identify: '\u{1F50D}', loyalty: '\u2696', ties: '\u{1F517}', plant: '\u{1F331}', scout: '\u{1F575}', bribe: '\u{1F4B0}', sow: '\u2702', dirt: '\u{1F4DC}', blackmail: '\u{1F512}', frame: '\u{1F58B}', incite: '\u{1F525}', forge: '\u{1FAAA}', lurk: '\u{1F311}', escape: '\u{1F6AA}', rush: '\u23F1', weak: '\u{1F5DD}', watch: '\u{1F441}', leak: '\u{1F4A7}' };
  function cardEl(c, big) {
    const el = h('div', 'icard' + (big ? ' big' : '') + ' rar-' + (c.rar || 'c')), col = TYPE_COL[c.type] || '#888';
    const art = h('div', 'art'); art.style.background = `url(assets/scenario/corridor/cards/art/card_art_${c.art || c.k}.jpg) center/cover no-repeat, radial-gradient(circle at 50% 40%, ${col}66, #0a1018 75%)`; // 삽화(GPT 2026-11-07), 없으면 색 바탕
    const fr = h('div', 'fr'); fr.style.backgroundImage = `url(assets/scenario/corridor/cards/card_frame_${c.type}_${c.rar || 'c'}.png), url(assets/scenario/corridor/cards/card_frame_${c.frame || FRAME_OF[c.type] || c.type}.png)`; // 희귀도별 틀(2026-11-08 의뢰) — 아직 없으면 기본 틀
    el.append(art, fr, h('div', 'cost', String(c.cost)), h('div', 'nm', c.name), h('div', 'gem'), h('div', 'ds', big ? c.desc : (c.short || c.desc))); // 설명은 카드에 바로(2026-11-08) — 손패에는 짧은 설명, 오른쪽 큰 카드에는 긴 설명
    el.title = `${c.name} — ${c.desc}`; return el;
  }
  // ---- 공작원 초상(2026-11-08 사용자: 「바바리코트에 모자 눌러쓴 검은 실루엣 — 여성·남성」) — 파일 없이 SVG 로 ----
  const SPY = {};
  function spyPic(g, seed) {
    const k = (g === 'f' ? 'f' : 'm') + (seed % 3); if (SPY[k]) return SPY[k];
    const hue = [192, 205, 178][seed % 3], bg = `<defs><radialGradient id="b" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="hsl(${hue},40%,26%)"/><stop offset=".5" stop-color="hsl(${hue},50%,10%)"/><stop offset="1" stop-color="#02060a"/></radialGradient><radialGradient id="h" cx="50%" cy="45%" r="35%"><stop offset="0" stop-color="hsl(${hue},70%,60%)" stop-opacity=".45"/><stop offset="1" stop-color="hsl(${hue},70%,60%)" stop-opacity="0"/></radialGradient><linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient></defs><rect width="100" height="150" fill="url(#b)"/><ellipse cx="50" cy="66" rx="40" ry="44" fill="url(#h)"/>`;
    // 남: 넓은 어깨 · 크게 세운 코트 깃 · 비스듬한 중절모(가운데가 눌린 모자) / 여: 좁은 어깨 · 허리띠 · 챙 넓은 모자를 깊게 · 모자 아래로 흘러내린 단발
    const F = g === 'f';
    const shape = F
      ? `<path d="M30 66 C24 82 26 98 36 104 C40 96 41 86 42 80 L58 80 C59 86 60 96 64 104 C74 98 76 82 70 66 Z"/><path d="M16 150 C18 128 26 112 42 106 L58 106 C74 112 82 128 84 150 Z"/><path d="M42 106 L37 90 L47 98 Z M58 106 L63 90 L53 98 Z"/><ellipse cx="50" cy="75" rx="10" ry="12"/><path d="M8 67 Q50 52 92 57 Q94 61 89 62 Q50 57 11 72 Q6 71 8 67 Z"/><path d="M35 63 C35 51 41 45 50 45 C59 45 65 50 65 59 Z"/>`
      : `<path d="M6 150 C8 122 20 108 36 103 L64 103 C80 108 92 122 94 150 Z"/><path d="M37 104 L31 82 L46 93 Z M63 104 L69 82 L54 93 Z"/><ellipse cx="50" cy="75" rx="11" ry="13"/><path d="M17 67 Q50 54 85 60 Q87 64 82 65 Q50 59 20 71 Q15 70 17 67 Z"/><path d="M33 64 C32 51 38 42 50 41 C62 41 67 48 66 60 Z"/>`;
    const detail = F
      ? `<path d="M42 106 L37 90 L47 98 L50 122 Z M58 106 L63 90 L53 98 L50 122 Z" fill="#0b161c"/><rect x="22" y="138" width="56" height="4" rx="1" fill="#0d1a21"/><rect x="46" y="136" width="8" height="8" rx="1" fill="#10202a"/><path d="M36 61 Q50 56.5 64 57.5 L64 59.5 Q50 58.5 36 63 Z" fill="#10202a"/>`
      : `<path d="M37 104 L31 82 L46 93 L50 120 Z M63 104 L69 82 L54 93 L50 120 Z" fill="#0b161c"/><path d="M50 120 L50 150" stroke="#0e1b22" stroke-width="1.2"/><circle cx="44" cy="132" r="1.4" fill="#0e1b22"/><circle cx="44" cy="143" r="1.4" fill="#0e1b22"/><path d="M45 42 L50 47 L55 42 Z" fill="#0b161c"/><path d="M33.5 61 Q50 57 65.5 58 L65.7 60.5 Q50 59.5 33.6 63.8 Z" fill="#10202a"/>`;
    // 바깥 윤곽에만 빛(역광): 굵게 빛 칠한 실루엣 위에 검은 실루엣을 다시 얹는다
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150">${bg}<g fill="hsl(${hue},70%,70%)" stroke="hsl(${hue},70%,70%)" stroke-width="1.6" stroke-linejoin="round" opacity=".38">${shape}</g><g fill="#020507">${shape}</g>${detail}<rect width="100" height="150" fill="url(#fog)"/></svg>`;
    return (SPY[k] = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`);
  }
  // GPT 초상(ui/assets/scenario/corridor/agents/agent_<이름>.png)이 있으면 그것을, 없으면 그 밑의 임시 실루엣이 보인다(2026-11-08)
  const agentPic = (a) => (a.key ? `url("assets/scenario/corridor/agents/agent_${a.key}.png"), ` : '') + spyPic(a.g, a.id);
  const STAR = (n) => '★'.repeat(Math.max(0, Math.min(5, n || 0)));
  function agentCard(a, lead) {
    const el = h('div', 'acard' + (a.at !== null ? ' posted' : '') + (a.op ? ' busy' : '') + (lead ? ' lead' : '')); el.style.backgroundImage = agentPic(a);
    el.append(h('span', 'tagx' + (a.op ? ' op' : a.at === null ? ' idle' : ''), a.op ? L('작전 중', 'On mission') : a.at === null ? L('대기', 'Idle') : L('잠입', 'Embedded')));
    const pl = h('div', 'pl'); pl.append(h('b', '', a.name));
    const sk = h('div', 'sk'); SKILL().forEach((nm, i) => { const sp = h('span', '', nm.slice(0, 1) + STAR(a.sk[i])); sk.append(sp); }); pl.append(sk);
    pl.append(h('small', '', a.op ? a.op.name : a.at !== null ? a.atName : L('지도로 끌어 잠입', 'Drag onto the map'))); el.append(pl);
    el.title = `${a.name} — ${SKILL().map((nm, i) => nm + ' ' + STAR(a.sk[i])).join(' · ')}\n` + (lead ? L('이 섹터에 잠입한 공작원', 'Operative embedded in this sector') : a.at === null ? L('귀족 섹터로 끌어다 놓으면 잠입합니다', 'Drag onto a noble sector to embed') : L('누르면 잠입한 섹터로 · 다른 섹터로 끌면 옮깁니다', 'Click to go to its sector · drag elsewhere to move'));
    if (!lead && !a.op) {
      el.draggable = true;
      el.ondragstart = (e) => { SFX.card(); dragAgent = a.id; e.dataTransfer.setData('text/plain', 'agent:' + a.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag'); markTargets(); };
      el.ondragend = () => endDrag();
    }
    el.onclick = () => { if (lead) return; if (a.at !== null) { const sc = secOfNoble(a.at); if (sc && API) API.select(sc.i, true); } else { SFX.error(); flashHint(); renderHint(); } };
    return el;
  }
  function markTargets() {
    if (dragAgent !== null) { // 공작원 카드: 공작원이 없는 귀족 섹터(또는 제 자리)에만
      for (const el of document.querySelectorAll('#cards .gv')) {
        const nb = el.dataset.nb !== undefined ? Number(el.dataset.nb) : null, at = nb !== null ? agentAt(nb) : null, ok = nb !== null && (!at || at.id === dragAgent);
        el.classList.toggle('dd-ok', ok); el.classList.toggle('dd-no', !ok);
        el.title = nb === null ? L('귀족 섹터가 아닙니다', 'Not a noble sector') : ok ? L('여기에 놓으면 잠입합니다', 'Drop here to embed') : L('이미 다른 공작원이 잠입한 섹터입니다', 'Another operative is already embedded here');
      }
      return;
    }
    for (const el of document.querySelectorAll('#cards .gv[data-nb]')) {
      const a = agentAt(Number(el.dataset.nb)), p = a && (a.plays || []).find((x) => x.card === dragCard);
      el.classList.toggle('dd-ok', !!(p && !p.why)); el.classList.toggle('dd-no', !(p && !p.why));
      el.title = p ? (p.why ? p.whyText : L('여기에 놓으면 이 카드를 냅니다', 'Drop here to play this card')) : L('공작원이 잠입한 섹터에만 놓을 수 있습니다', 'You can only drop on a sector with an embedded operative');
    }
  }
  function endDrag() { dragCard = null; dragAgent = null; for (const el of document.querySelectorAll('#cards .gv')) el.classList.remove('dd-ok', 'dd-no', 'dd-hover'); for (const el of document.querySelectorAll('.icard.drag')) el.classList.remove('drag'); }
  function dropOn(sc, n, id) {
    const a = agentAt(n.id), p = a && (a.plays || []).find((x) => x.card === id);
    if (!a) { msg = L('이 섹터에는 잠입한 공작원이 없습니다. 먼저 공작원을 보내세요.', 'No operative is embedded in this sector. Send one first.'); }
    else if (p && p.why) msg = p.whyText; else msg = '';
    selCard = id; tab = 'sector';
    if (API) API.select(sc.i, false); else { cur = sc; renderSide(); }
    renderHand();
    const pb = document.querySelector('#side .in-play'); if (pb) pb.scrollIntoView({ block: 'nearest' });
  }
  function counterEl(c) {
    const el = cardEl(c, false);
    if (I.foe) {
      el.classList.add('counter-can'); el.title = L(`${c.name} — 적 공작에 냅니다. ${c.desc}`, `${c.name} — play against the enemy operation. ${c.desc}`);
      el.onclick = () => { SFX.card(); void act({ a: 'counter', card: c.id }); };
      el.draggable = true; el.ondragstart = (e) => { SFX.card(); dragCard = c.id; e.dataTransfer.setData('text/plain', String(c.id)); el.classList.add('drag'); }; el.ondragend = () => endDrag();
    } else { el.classList.add('off'); el.append(h('div', 'why', L('막을 적 공작 없음', 'No enemy op'))); }
    return el;
  }
  function renderHand() {
    let box = $('inHand'); if (!box) { box = h('div'); box.id = 'inHand'; document.body.append(box); }
    box.textContent = ''; if (!I || !I.deck) return;
    const D = I.deck, ip = h('div', 'ip', String(D.ip)); ip.append(h('small', '', L('첩보력', 'Intel'))); ip.title = L(`첩보력 ${D.ip}. 매년 1월 연례 정보 회의 때 찹니다(다음 회의 예상 +${D.gain}).`, `Intel ${D.ip}. Refilled at each January yearly meeting (next: about +${D.gain}).`);
    const pile = h('div', 'pile'); pile.append(h('div', 'cb'), h('div', '', L(`덱 ${D.nDeck} · 버림 ${D.nDisc}` + (D.nDef ? ` · 방첩 ${D.nDef}` : ''), `Deck ${D.nDeck} · Discard ${D.nDisc}` + (D.nDef ? ` · Counter ${D.nDef}` : '')))); pile.onclick = () => { tab = 'deck'; renderSide(); };
    const row = h('div', 'row'), here = curAgent();
    // 2026-11-08 사용자: 「공작원 카드로 시작 — 지도 섹터로 끌어 넣고, 그 섹터를 누르면 그제서야 첩보 카드」
    if (!here) {
      for (const a of I.agents) row.append(agentCard(a, false));
      if (I.agents.length < I.maxAgents) { const hc = h('div', 'acard hire'); hc.append(h('div', 'plus', '+'), h('div', '', L('공작원 영입', 'Recruit')), h('small', '', L(`에너지 ${I.hireCost}`, `${I.hireCost} energy`))); hc.title = I.live ? L('새 공작원을 영입합니다', 'Recruit a new operative') : L('게임이 켜져 있어야 영입할 수 있습니다', 'The game must be running to recruit'); hc.onclick = () => { if (I.live) act({ a: 'hire' }); else SFX.error(); }; row.append(hc); }
      const ctr = I.foe ? D.hand.filter((c) => c.type === 'counter') : []; // 적 공작이 오면 공작원을 안 골라도 방첩 카드가 보인다
      if (ctr.length) { row.append(h('div', 'sep')); for (const c of ctr) row.append(counterEl(c)); }
      box.append(ip, row); renderHint(); return;
    }
    row.append(agentCard(here, true), h('div', 'sep'));
    for (const c of D.hand) {
      if (c.type === 'counter') { row.append(counterEl(c)); continue; }
      const el = cardEl(c, false); if (selCard === c.id) el.classList.add('sel'); if (c.type === 'weak' || c.type === 'support') el.classList.add('off');
      // 지금 고른 섹터에 낼 수 있는지 카드마다 바로 보이게(2026-11-08)
      if (here && !here.op && c.type !== 'weak' && c.type !== 'support' && c.type !== 'curse') {
        const p = (here.plays || []).find((x) => x.card === c.id);
        if (p && !p.why) el.classList.add('can'); else { el.classList.add('off'); el.append(h('div', 'why', p ? shortWhy(p) : L('여기선 못 냄', 'Not here'))); }
      }
      el.onclick = () => {
        SFX.card(); selCard = selCard === c.id ? null : c.id;
        if (c.type === 'curse') tab = 'deck'; else if (tab !== 'sector') tab = 'sector';
        if (selCard !== null && c.type !== 'curse' && !(here && !here.op)) { SFX.error(); flashHint(); } // 낼 곳이 없으면 안내 띠를 깜빡이지 않고 밝게만
        renderHand(); renderSide();
      };
      if (c.type !== 'weak' && c.type !== 'support' && c.type !== 'curse') {
        el.draggable = true;
        el.ondragstart = (e) => { SFX.card(); dragCard = c.id; e.dataTransfer.setData('text/plain', String(c.id)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('drag'); markTargets(); };
        el.ondragend = () => endDrag();
      }
      row.append(el);
    }
    if (!D.hand.length) row.append(h('div', 'in-msg', L(`손패가 없습니다. ${D.next || ''}년 1월 연례 정보 회의 때 카드를 뽑습니다.`, `No cards in hand. You draw at the January ${D.next || ''} yearly meeting.`)));
    box.append(ip, row, pile);
    fanOut(row);
    renderHint();
  }
  // ---- 방첩 대전(2026-11-08 사용자: 「노드·방어 버퍼 인터페이스가 이뻤다 — 그 화면에 하스스톤 방식」) ----
  // 상대 턴: 공격 카드를 「노드」로 깐다(앞면). 우리 턴: 마나 수정으로 공격 카드는 공작선에 바로, 방어 카드는 노드의 방어 버퍼에 넣는다.
  // 턴 종료: 노드가 왼쪽부터 터진다 → 상대가 새 노드를 깐다. 깜빡임 없이: 숫자는 위로 흐려지며 떠오르기만 한다.
  let foeSeenId = null, duelOpen = false, duelPrev = null, duelPick = null;
  function renderFoe() {
    let box = $('inFoe'); if (!box) { box = h('div'); box.id = 'inFoe'; document.body.append(box); }
    box.textContent = ''; if (!I) { renderDuel(); return; }
    const F = I.foe, R = I.foeLast;
    if (F) {
      if (foeSeenId !== F.id) { foeSeenId = F.id; SFX.error(); duelOpen = true; } // 새 적 공작: 경보음 한 번 + 대전판을 연다
      const fb = h('div', 'fb'), t = h('div', 'ft');
      t.innerHTML = L(`<b>⚠ 적 공작</b> — ${F.who} · 턴 ${F.turn}/${F.turns} · 기한 ${F.left}일`, `<b>⚠ Enemy operation</b> — ${F.who} · turn ${F.turn}/${F.turns} · ${F.left} days left`);
      const b = h('button', '', L('대전판 열기', 'Open the duel')); b.type = 'button'; b.onclick = () => { duelOpen = true; renderDuel(); };
      fb.append(t, b); box.append(fb);
    } else if (R && !duelOpen) {
      const fb = h('div', 'fb done' + (R.res === 'lose' ? ' bad' : '')), t = h('div', 'ft');
      t.innerHTML = R.res === 'win' ? L('<b>방첩 대전</b> — 공작선을 끊어냈습니다', '<b>Duel</b> — their line is cut') : R.res === 'draw' ? L('<b>방첩 대전</b> — 버텨냈습니다(무승부)', '<b>Duel</b> — held off (draw)') : L('<b>방첩 대전</b> — 보안망이 무너졌습니다', '<b>Duel</b> — our grid fell');
      const b = h('button', '', L('결과 보기', 'See results')); b.type = 'button'; b.onclick = () => { duelOpen = true; renderDuel(); };
      fb.append(t, b); box.append(fb);
    }
    renderDuel();
  }
  const chip = (cls, txt, tip) => { const c = h('span', 'dchip ' + cls, txt); if (tip) c.title = tip; return c; };
  function sideChips(s, me) {
    const row = h('div', 'dchips');
    if (s.armor) row.append(chip('blk', `\u{1F6E1} ${s.armor}`, L('방벽 — 피해를 먼저 막습니다', 'Armor — absorbs damage first')));
    if (s.poisonT) row.append(chip('psn', L(`백도어 ${s.poison}×${s.poisonT}턴`, `Backdoor ${s.poison}×${s.poisonT}`), L('턴 시작마다 피해', 'Damage at the start of each turn')));
    if (s.power) row.append(chip(me ? 'up' : 'dn', L(`공세 +${s.power}`, `Power +${s.power}`), L('카드 피해에 더해집니다', 'Added to card damage')));
    if (s.drone) row.append(chip('up', L(`드론 +${s.drone}`, `Drone +${s.drone}`), L('턴 시작마다 방벽', 'Armor at the start of each turn')));
    if (s.thorns) row.append(chip('up', L(`반격 ${s.thorns}`, `Thorns ${s.thorns}`), L('피해를 받으면 되돌립니다', 'Deals damage back when hit')));
    if (s.vuln) row.append(chip('dn', L('취약', 'VULN'), L('이번 턴 받는 피해 +50%', 'Takes 50% more this turn')));
    if (s.overload) row.append(chip('dn', L(`교란 −${s.overload}`, `Jammed −${s.overload}`), L('다음 턴 마나가 줄어듭니다', 'Less mana next turn')));
    if (me) for (const sc of s.secrets || []) row.append(chip('sec', `? ${sc}`, L('비밀 — 조건이 되면 발동', 'Secret — triggers when its condition is met')));
    return row;
  }
  function gbar(label, cur, aft, max, cls, gate) {
    const row = h('div', 'dgr ' + cls), bar = h('div', 'gbar'), a = h('i', 'aft'), n = h('i', 'now');
    a.style.width = Math.max(0, aft) / max * 100 + '%'; n.style.left = Math.max(0, aft) / max * 100 + '%'; n.style.width = Math.max(0, cur - aft) / max * 100 + '%'; bar.append(a, n);
    if (gate) { const g = h('s'); g.style.left = gate / max * 100 + '%'; bar.append(g); }
    row.append(h('b', '', label), bar, h('span', aft < cur ? 'low' : '', cur === aft ? `${cur}/${max}` : `${cur} → ${aft}`)); return row;
  }
  function crystals(s) {
    const w = h('div', 'dmana'), row = h('div', 'cr'); for (let i = 0; i < 10; i++) row.append(h('i', i < s.mana ? 'on' : i < s.maxMana ? 'used' : ''));
    w.append(row); w.title = L('마나 수정 — 턴마다 1개씩 늘어 10개까지', 'Mana crystals — one more each turn, up to 10'); return w;
  }
  function floatNum(anchor, v, cls) { if (!anchor || !v) return; const f = h('div', 'dfloat ' + cls, (v > 0 ? '−' : '+') + Math.abs(v)); anchor.append(f); setTimeout(() => f.remove(), 1400); }
  const ROLE = (c) => (c.buf ? ['buf', L('방어 버퍼', 'BUFFER')] : c.side === 'atk' ? ['atk', L('공격', 'ATTACK')] : ['now', L('즉시', 'INSTANT')]);
  function renderDuel() {
    let ov = $('inDuel'); if (!ov) { ov = h('div'); ov.id = 'inDuel'; document.body.append(ov); }
    ov.textContent = ''; ov.style.display = 'none'; if (!I || !duelOpen) return;
    const F = I.foe, R = I.foeLast; if (!F && !R) { duelOpen = false; return; }
    ov.style.display = 'flex';
    const bd = h('div', 'db');
    { // 머리 띠 · 옆 16진수 열(정지된 장식)
      const bar = h('div', 'dbar'); bar.innerHTML = F ? L('<b>COUNTER-INTRUSION</b> // 방첩 대응 단말', '<b>COUNTER-INTRUSION</b> // defense terminal') : L('<b>INTRUSION LOG</b> // 대응 결과', '<b>INTRUSION LOG</b> // outcome');
      bar.append(h('span', '', F ? `NODE ${F.nodes.length}/${F.field} · BUFFER ${F.nBuf}/${F.field} · TURN ${F.turn}/${F.turns} · T-${F.left}` : R.d)); bd.append(bar);
      let hx = ''; let seed = (F ? F.id : 977) || 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 40; i++) { const row = []; for (let j = 0; j < 4; j++) row.push(Math.floor(rnd() * 256).toString(16).toUpperCase().padStart(2, '0')); hx += row.join(' ') + '\n'; }
      bd.append(h('div', 'hex', hx));
    }
    const x = h('button', 'dx', '✕'); x.type = 'button'; x.title = L('닫기(대전은 이어집니다)', 'Close (the duel continues)'); x.onclick = () => { duelOpen = false; duelPick = null; renderFoe(); };
    if (!F) { // ---- 결과 ----
      const top = h('div', 'dtop'), who = h('div', 'dwho'); who.append(h('div', 'dav', (R.who || '?').slice(0, 1)), h('div', ''));
      who.lastChild.innerHTML = `<b>${R.who}</b><br><small>${R.sideName}${R.auto !== null ? L(` · 첩보부장 자동 대응(${R.auto}%)`, ` · spymaster auto (${R.auto}%)`) : ''}</small>`; top.append(who, x); bd.append(top);
      const res = h('div', 'dres-big ' + R.res, R.res === 'win' ? L('공작선 절단 — 승리', 'LINE CUT — VICTORY') : R.res === 'draw' ? L('상대 철수 — 무승부', 'WITHDRAWN — DRAW') : L('보안망 붕괴 — 패배', 'GRID DOWN — DEFEAT'));
      bd.append(res, h('div', 'dres-txt', R.text));
      if (R.offer && R.offer.length) {
        const c = h('div', 'doffer'); c.append(h('div', 'dtip', L('방첩 덱에 넣을 카드 1장을 고르세요', 'Pick one card for your counter-intelligence deck')));
        const row = h('div', 'drow'); R.offer.forEach((o, n) => { const el = cardEl(o, false); el.onclick = () => { SFX.play(); void act({ a: 'dTake', n }); }; row.append(el); });
        const sk = h('button', '', L('건너뛰기', 'Skip')); sk.type = 'button'; sk.onclick = () => act({ a: 'dTake', n: -1 }); c.append(row, sk); bd.append(c);
      } else { const ok = h('button', 'dend', L('확인', 'OK')); ok.type = 'button'; ok.onclick = () => { duelOpen = false; void act({ a: 'foeSeen' }); }; const bt = h('div', 'dfoot'); bt.append(ok); bd.append(bt); }
      ov.append(bd); return;
    }
    // ---- 머리: 상대 · 노리는 것 · 기한 ----
    const top = h('div', 'dtop'), who = h('div', 'dwho'); who.append(h('div', 'dav', F.seen ? F.who.slice(0, 1) : '?'), h('div', ''));
    who.lastChild.innerHTML = L(`<b>${F.who}</b><br><small>${F.sideName} · 노리는 것: ${F.ops.map((o) => `${o.icon} ${o.name}(${o.tgt})`).join(', ')}</small>`, `<b>${F.who}</b><br><small>${F.sideName} · Aiming for: ${F.ops.map((o) => `${o.icon} ${o.name} (${o.tgt})`).join(', ')}</small>`);
    top.append(who, h('div', 'dleft', L(`기한 ${F.left}일`, `${F.left} days left`)), x); bd.append(top);
    // ---- 하스스톤식 판(2026-11-08 사용자: 「내가 뭘 냈는지 모르겠다 · 상대가 패를 얼마나 들고 있는지 · 필드는 잘 보이게」) ----
    //   위: 상대 영웅(공작선) · 상대 손패(뒷면) · 상대 덱  /  가운데: 상대 노드 줄 · 경계선 · 우리 줄(방어 버퍼 + 이번 턴에 낸 카드)  /  아래: 우리 영웅(보안망) · 마나 · 손패
    const eRow = gbar(L('적 공작선', 'ENEMY LINE'), F.en.hp, F.en.hp, F.en.max, 'foe'), mRow = gbar(L('우리 보안망', 'OUR GRID'), F.me.hp, F.proj, F.me.max, 'me');
    eRow.title = L('0이 되면 공작을 끊어낸 것 — 승리', 'Cut it to 0 to win'); mRow.title = L('노드가 지금 그대로 다 터지면 여기까지 떨어집니다. 0이 되면 패배.', 'Where it falls if every node lands as is. At 0 we lose.');
    { const ez = h('div', 'dez'), hero = h('div', 'dhero foe'); hero.append(eRow, sideChips(F.en, false));
      const eh = h('div', 'dehand'), nH = Math.min(10, F.en.nHand || 0);
      for (let k = 0; k < nH; k++) { const b = h('i', 'dback'); const d = k - (nH - 1) / 2; b.style.transform = `rotate(${(d * -3).toFixed(1)}deg) translateY(${(d * d * -0.6).toFixed(1)}px)`; eh.append(b); }
      const ec = h('div', 'decount'); ec.append(h('b', '', String(F.en.nHand || 0)), h('small', '', L('상대 손패', 'ENEMY HAND'))); eh.title = L(`상대가 손에 든 카드 ${F.en.nHand}장`, `The enemy holds ${F.en.nHand} card(s)`);
      const pile = h('div', 'dpile', String(F.en.nDeck)); pile.title = L(`상대 덱 ${F.en.nDeck}장`, `Enemy deck: ${F.en.nDeck}`);
      ez.append(hero, eh, ec, pile);
      if (F.played.length) { const ep = h('div', 'deplayed'); ep.append(h('small', '', L('상대가 바로 쓴 카드', 'ENEMY PLAYED'))); for (const c of F.played) { const el = cardEl(c, false); el.classList.add('dmini'); el.title = `${c.name} — ${c.desc || ''}`; ep.append(el); } ez.append(ep); }
      bd.append(ez); }
    // ---- 적 침입 노드 ----
    const field = h('div', 'dfield');
    if (!F.nodes.length) field.append(h('div', 'dempty', L('상대가 이번 턴에 깐 노드가 없습니다. 공격할 차례입니다.', 'The enemy laid no nodes this turn. Time to strike.')));
    const pk = duelPick !== null ? F.hand.find((c) => c.id === duelPick) : null;
    F.nodes.forEach((t, i) => {
      const col = h('div', 'dcol'); col.append(h('div', 'dnode', `NODE ${String(i + 1).padStart(2, '0')}`));
      const fc = cardEl({ ...t.card, cost: t.card.cost }, false); fc.classList.add('dfoe'); col.append(fc);
      const tg = h('div', 'dtg'); tg.innerHTML = `<em>${L('공격', 'ATTACK')}</em><br>${L('→ 우리 보안망', '→ our grid')}`; col.append(tg);
      const badge = t.nul ? L('무효', 'NULL') : t.lethal ? L('치명!', 'LETHAL!') : t.note === 'poison' ? L('백도어', 'BACKDOOR') : t.note === 'jam' ? L('교란', 'JAM') : `${L('보안', 'GRID')} −${t.dmg}${t.pierce ? ' ⟂' : ''}`;
      const ch = h('div', 'dch' + (t.nul || (!t.dmg && !t.note && !t.lethal) ? ' low' : '')); ch.textContent = badge; ch.title = L(t.pierce ? '방벽·버퍼를 무시합니다' : '방어 버퍼를 넣으면 줄어듭니다', t.pierce ? 'Ignores armor and buffers' : 'Buffers reduce it'); col.append(ch);
      const fit = pk && pk.buf && F.nBuf < F.field, slot = h('div', 'dslot' + (fit ? ' ready' : pk ? ' nofit' : ''));
      for (const b of t.buf) slot.append(cardEl(b, false));
      if (!t.buf.length) slot.append(h('small', '', fit ? L('▶ 여기에 주입', '▶ INJECT HERE') : L('방어 버퍼', 'DEFENSE BUFFER')));
      slot.onclick = () => { if (!fit) { SFX.error(); return; } const id = duelPick; duelPick = null; SFX.card(); void act({ a: 'dInject', card: id, node: i }); };
      slot.addEventListener('dragover', (e) => { if (dragCard !== null) { e.preventDefault(); slot.classList.add('hot'); } });
      slot.addEventListener('dragleave', () => slot.classList.remove('hot'));
      slot.addEventListener('drop', (e) => { e.preventDefault(); slot.classList.remove('hot'); const id = dragCard; endDrag(); duelPick = null; if (id !== null) void act({ a: 'dInject', card: id, node: i }); });
      col.append(slot); field.append(col);
    });
    bd.append(field);
    // ---- 우리 줄: 이번 턴에 낸 카드(공격·즉시는 피해와 함께, 방어 버퍼는 넣은 노드 번호와 함께) ----
    { const mb = h('div', 'dmine'); mb.append(h('div', 'dmlab', L('// 우리 필드 — 이번 턴에 낸 카드', '// OUR FIELD — played this turn')));
      const row = h('div', 'dmrow'), mine = F.mine || [];
      for (const m of mine) { const w = h('div', 'dmc'), el = cardEl(m, false); el.classList.add('dmini'); el.title = `${m.name} — ${m.desc || ''}`; w.append(el, h('span', 'dmres ' + (m.node !== undefined ? 'buf' : m.dmg ? 'hit' : 'eff'), m.node !== undefined ? L(`노드 ${m.node + 1} 방어`, `Node ${m.node + 1} buffer`) : m.dmg ? L(`공작선 −${m.dmg}`, `Line −${m.dmg}`) : L('효과', 'Effect'))); row.append(w); }
      if (!mine.length) row.append(h('div', 'dempty', L('아직 이번 턴에 낸 카드가 없습니다. 손패의 카드를 내면 여기에 놓입니다.', 'Nothing played this turn yet. Cards you play land here.')));
      mb.append(row);
      const back = h('div', 'dstrip');
      if (F.lastRes.length) { back.append(h('small', '', L('지난 턴 노드', 'LAST NODES'))); for (const r of F.lastRes) back.append(h('span', 'dstamp ' + (r.how === 'hit' ? 'hit' : r.how === 'null' ? 'decoy' : 'block'), `${r.name} ${r.how === 'hit' ? '−' + r.dmg : r.how === 'trace' ? L('역추적 ', 'TRACE ') + '−' + r.dmg : r.how === 'null' ? L('무효', 'NULL') : L('막음', 'BLOCKED')}`)); }
      if ((F.mineLast || []).length) { back.append(h('small', '', L('지난 턴 우리', 'WE PLAYED LAST TURN'))); for (const m of F.mineLast) back.append(h('span', 'dstamp mine', m.name + (m.dmg ? ` −${m.dmg}` : ''))); }
      if (back.childNodes.length) mb.append(back);
      bd.append(mb); }
    // ---- 우리 영웅(보안망) ----
    { const hz = h('div', 'dhero me'); hz.append(mRow, sideChips(F.me, true)); bd.append(hz); }
    // ---- 아래: 마나 · 손패 · 턴 종료 ----
    const bot = h('div', 'dbot');
    const ip = h('div', 'dip', `${F.me.mana}/${F.me.maxMana}`); ip.append(h('small', '', L('마나', 'MANA')), crystals(F.me));
    const hand = h('div', 'dhand');
    for (const c of F.hand) {
      const el = cardEl(c, false), [rc, rt] = ROLE(c); el.append(h('div', 'drole ' + rc, rt));
      if (duelPick === c.id) el.classList.add('sel'); if (c.cost > F.me.mana) el.classList.add('off'); else el.classList.add('can');
      el.onclick = () => {
        if (c.cost > F.me.mana) { SFX.error(); return; }
        if (c.buf) { if (!F.nodes.length) { SFX.error(); msg = L('방어 버퍼를 넣을 노드가 없습니다.', 'There is no node to inject into.'); renderDuel(); msg = ''; return; } SFX.card(); duelPick = duelPick === c.id ? null : c.id; renderDuel(); return; }
        SFX.card(); duelPick = null; void act({ a: 'dPlay', card: c.id });
      };
      if (c.buf) { el.draggable = true; el.ondragstart = (e) => { SFX.card(); dragCard = c.id; e.dataTransfer.setData('text/plain', String(c.id)); el.classList.add('drag'); }; el.ondragend = () => endDrag(); }
      hand.append(el);
    }
    if (!F.hand.length) hand.append(h('div', 'in-msg', L('손패가 없습니다. 턴을 넘기세요.', 'No cards in hand. End your turn.')));
    const side = h('div', 'dside2');
    side.append(h('div', 'ddk', L(`덱 ${F.me.nDeck} · 상대 손패 ${F.en.nHand} · 상대 덱 ${F.en.nDeck}`, `Deck ${F.me.nDeck} · enemy hand ${F.en.nHand} · enemy deck ${F.en.nDeck}`)));
    const C = I.chief || { w: 0, auto: null, unlock: 4 };
    if (C.auto !== null && C.auto !== undefined) { const au = h('button', 'dauto', L(`첩보부장에게 맡기기 ${C.auto}%`, `Spymaster takes over ${C.auto}%`)); au.type = 'button'; au.onclick = async () => { if (await sllmAsk(L(`첩보부장에게 맡길까요? 승률 ${C.auto}% — 지면 침투 임무가 성공합니다.`, `Hand it to the spymaster? ${C.auto}% to win — if they lose, the infiltrations succeed.`))) void act({ a: 'dAuto' }); }; side.append(au); }
    else side.append(h('div', 'ddk', L(`첩보부장 ${C.w}승 — ${C.unlock}승부터 자동`, `Spymaster ${C.w} wins — auto from ${C.unlock}`)));
    const end = h('button', 'dend', L('▶ 실행 — 턴 종료', '▶ EXECUTE — end turn')); end.type = 'button'; end.onclick = () => { duelPick = null; SFX.play(); void act({ a: 'dEnd' }); }; side.append(end);
    bot.append(ip, hand, side);
    bd.append(h('div', 'dsec', L(`// 방어 버퍼 ${F.nBuf}/${F.field} · 손패 ${F.hand.length}/10  DEFENSE BUFFER`, `// DEFENSE BUFFER ${F.nBuf}/${F.field} · HAND ${F.hand.length}/10`)));
    if (msg) { const m = h('div', 'dtip'); m.style.color = '#ff9a8a'; m.textContent = msg; bd.append(m); }
    bd.append(h('div', 'dtip', duelPick !== null ? L('주입할 노드의 방어 버퍼(파란 테두리)를 누르세요', 'Click a node buffer (blue border) to inject it') : L('공격 카드는 누르면 상대 공작선을 칩니다 · 방어 버퍼 카드는 노드 아래 칸에 넣습니다 · 턴을 넘기면 노드가 왼쪽부터 터집니다', 'Attack cards hit their line when clicked · buffer cards go into the slot under a node · ending the turn detonates nodes left to right')));
    bd.append(bot);
    if (duelPrev && duelPrev.id === F.id) { floatNum(eRow, duelPrev.ehp - F.en.hp, 'foe'); floatNum(mRow, duelPrev.hp - F.me.hp, 'me'); }
    duelPrev = { id: F.id, ehp: F.en.hp, hp: F.me.hp };
    ov.append(bd);
  }
  /** 손패 부채꼴(2026-11-08): 가운데에서 멀수록 살짝 기울이고 내린다. 자리가 모자라면 겹쳐 놓는다(마우스를 올리면 그 카드만 크게). */
  function fanOut(row) {
    const cards = [...row.querySelectorAll(':scope > .icard')], n = cards.length; if (!n) return;
    cards.forEach((el, i) => { const d = i - (n - 1) / 2; el.style.setProperty('--r', `${(d * 2.4).toFixed(1)}deg`); el.style.setProperty('--y', `${(d * d * 0.9).toFixed(1)}px`); });
    requestAnimationFrame(() => {
      const lead = row.querySelector(':scope > .acard'), sep = row.querySelector(':scope > .sep');
      const avail = row.clientWidth - (lead ? lead.offsetWidth + 6 : 0) - (sep ? sep.offsetWidth + 14 : 0), w = cards[0].offsetWidth, need = n * w + (n - 1) * 6;
      const over = need > avail && n > 1 ? Math.ceil((need - avail) / (n - 1)) + 6 : 0;
      cards.forEach((el, i) => { el.style.marginLeft = i && over ? `-${over}px` : ''; });
    });
  }
  // ---- 카드 쓰는 법 안내 띠(2026-11-08) — 손패 바로 위. 지금 무엇을 해야 카드를 낼 수 있는지 단계로 ----
  const curNoble = () => (cur ? nobleOf(cur) : null);
  const curAgent = () => { const n = curNoble(); return n ? agentAt(n.id) : null; };
  const shortWhy = (p) => ({ ip: L('첩보력 부족', 'Need intel'), net: L('정보망 부족', 'Network low'), busy: L('작전 중', 'Busy'), nosector: L('잠입 필요', 'Embed first') })[p.why] || L('지금 못 냄', 'Not now');
  let hintHot = 0;
  function flashHint() { hintHot = Date.now(); }
  function renderHint() {
    let el = $('inHint'); if (!el) { el = h('div'); el.id = 'inHint'; document.body.append(el); }
    el.textContent = ''; if (!I || !I.deck) { el.style.display = 'none'; return; }
    const n = curNoble(), a = curAgent(), canHere = a && !a.op && (a.plays || []).some((p) => !p.why);
    if (canHere) { el.style.display = 'none'; return; } // 이미 낼 수 있으면 안내 없이
    el.style.display = 'flex'; el.style.borderColor = Date.now() - hintHot < 1500 ? '#ffb38a' : '';
    const st = (no, done, now, text) => { const x = h('span', 'st' + (done ? ' done' : now ? ' now' : '')); x.append(h('i', '', done ? '✓' : String(no)), document.createTextNode(text)); return x; };
    const ar = () => h('span', 'ar', '›'), posted = I.agents.some((x) => x.at !== null);
    el.append(h('b', '', L('첩보 시작하기', 'Getting started')));
    el.append(st(1, posted, !posted, L('공작원 카드를 귀족 섹터로 끌어다 놓기', 'Drag an operative card onto a noble sector')), ar(), st(2, !!a, posted && !a, L('잠입한 섹터 누르기', 'Click that sector')), ar(), st(3, false, !!a, L('첩보 카드 내기', 'Play an intel card')));
    if (!I.agents.length) el.append(h('span', '', L('— 공작원이 없습니다. 「+ 공작원 영입」으로 시작하세요.', '— You have no operatives. Start with "+ Recruit".')));
    else if (n && !a) el.append(h('span', '', L('— 이 섹터엔 아직 공작원이 없습니다.', '— No operative here yet.')));
    else if (a && a.op) el.append(h('span', '', L(`— ${a.name}은(는) 작전 중이라 끝나면 낼 수 있습니다.`, `— ${a.name} is on a mission; play again when it ends.`)));
    else if (a) el.append(h('span', '', L('— 이 섹터에 지금 낼 수 있는 카드가 없습니다(카드 아래 이유).', '— nothing in hand can be played here now (reason under each card).')));
    if (n) { const b = h('button', '', L('← 공작원 카드로', '← Operative cards')); b.type = 'button'; b.onclick = () => { if (API) API.select(-1, false); }; el.append(b); }
  }


  async function load() {
    let r = null; try { r = await window.sllm.scnIntel(); } catch (e) { r = null; }
    if (!r || !r.ok || !r.on) { I = null; const s = $('side'); s.textContent = ''; s.append(h('div', '', L('회랑 자리를 맡은 시나리오 판에서만 쓸 수 있습니다.', 'Only available when playing the Corridor seat in this scenario.'))); return; }
    I = r; if (API) API.recard(); renderSide(); renderHand(); renderFoe();
  }
  async function act(req) {
    if (busy) return; busy = true; let r = null;
    try { r = await window.sllm.scnIntelAct(req); } catch (e) { r = { ok: false, error: String(e) }; }
    busy = false;
    if (!r || !r.ok) { msg = (r && r.error) || L('하지 못했습니다.', 'Could not do that.'); SFX.error(); renderSide(); if (duelOpen) renderDuel(); return; }
    if (req && (req.a === 'play' || req.a === 'take' || req.a === 'sbuy' || req.a === 'upgrade' || req.a === 'dTake' || req.a === 'dBuy' || req.a === 'dUpgrade')) SFX.play(); else SFX.beep();
    msg = ''; I = r; if (I.deck && selCard !== null && !I.deck.hand.some((c) => c.id === selCard)) selCard = null; if (API) API.recard(); renderSide(); renderHand(); renderFoe();
  }

  // ---- 함대 동향(2026-11-08): 그 섹터에 있는 강대국 군 함대 수·전력 띠 ----
  let fltCache = null;
  function fleetsBySector() {
    const D = API && API.data(); if (!I || !D || !I.sides) return new Map();
    if (fltCache && fltCache.I === I && fltCache.D === D) return fltCache.m;
    const sysOfM = new Map(); for (const s of D.systems) if (s.m !== undefined && s.m >= 0) sysOfM.set(s.m, s);
    const m = new Map();
    for (const sd of I.sides) { if (!sd.fleets) continue; for (const q of sd.fleets.list) { const s = sysOfM.get(q.m); if (!s || s.s < 0) continue; const k = s.s; const e = m.get(k) || { a: [], b: [] }; e[sd.side].push(q); m.set(k, e); } }
    fltCache = { I, D, m }; return m;
  }
  function fleetBadge(el, sc) {
    const e = fleetsBySector().get(sc.i); if (!e) return;
    for (const sd of ['a', 'b']) { const list = e[sd]; if (!list.length) continue;
      const pw = list.reduce((s, q) => s + q.p, 0), b = h('div', 'fltb ' + sd, `\u2694 ${list.length} · ${pw >= 10000 ? Math.round(pw / 1000) + 'k' : pw.toLocaleString()}`);
      b.title = (sd === 'a' ? L('얼라이언스 함대', 'Alliance fleets') : L('제국 함대', 'Imperial fleets')) + '\n' + list.map((q) => `${q.n} — ${q.p.toLocaleString()} · ${q.at}`).join('\n'); el.append(b); }
  }
  // ---- 카드: 안개 · 정보망 막대 · 공작원 핀 ----
  function card(el, sc) {
    if (!I) return; if (cur && sc && cur.i === sc.i) el.classList.add('sel'); // 카드를 다시 그려도 고른 섹터·포커스 유지(2026-11-08)
    fleetBadge(el, sc); // 함대 동향 카드로 본 강대국 함대(2026-11-08)
    const n = nobleOf(sc); if (!n) return;
    // 카드 끌어다 놓기(2026-11-07): 손패 카드를 이 섹터에 놓으면 그 섹터 공작원에게 그 카드를 고른 채로 오른쪽 판이 열린다
    el.dataset.nb = String(n.id);
    el.addEventListener('dragover', (e) => { if (dragCard !== null || dragAgent !== null) { e.preventDefault(); e.dataTransfer.dropEffect = el.classList.contains('dd-ok') ? 'move' : 'none'; } });
    el.addEventListener('dragenter', () => { if (dragCard !== null || dragAgent !== null) el.classList.add('dd-hover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dd-hover'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('dd-hover'); const id = dragCard, ag = dragAgent, okDrop = el.classList.contains('dd-ok'); endDrag();
      if (ag !== null) { if (!okDrop) { SFX.error(); return; } void act({ a: 'post', agent: ag, target: n.id }).then(() => { if (API) API.select(sc.i, true); }); return; } // 공작원 잠입(2026-11-08)
      if (id !== null) dropOn(sc, n, id); });
    if (!n.known) {
      el.classList.add('fog'); const p = el.querySelector('.pic'); if (p) { p.style.backgroundImage = 'none'; p.textContent = '?'; }
      const b = el.querySelector('.tag b'); if (b) b.textContent = '???'; const sm = el.querySelector('.tag small'); if (sm) sm.textContent = L('정체 미상', 'Unknown');
      el.title = L('정체 미상 — 공작원을 보내 신원을 파악하세요', 'Unknown — send an operative to identify them');
    }
    if (n.net > 0) { const bar = h('div', 'net'), i = h('i'); i.style.width = Math.min(100, n.net) + '%'; bar.append(i); bar.title = L(`정보망 ${n.net}`, `Network ${n.net}`); el.append(bar); }
    const a = agentAt(n.id); if (a) { // 공작원이 잠입한 섹터(2026-11-08 사용자: 「글자에 노란 공이 아니라 더 가시적으로」): 점선 고리 + 공작원 얼굴 + 아래 띠
      el.classList.add('spied'); if (a.op) el.classList.add('spy-op');
      el.prepend(h('div', 'spyring'));
      const av = h('div', 'spyav'); av.style.backgroundImage = agentPic(a); av.title = `${a.name} · ${ST(a.st)}`; el.append(av);
      el.append(h('div', 'spylbl', a.op ? L(`작전 중 · ${a.op.name} · ${a.op.left}달`, `On mission · ${a.op.name} · ${a.op.left} mo`) : L(`${a.name} 잠입 중 · 정보망 ${n.net}`, `${a.name} embedded · network ${n.net}`)));
    }
  }

  // ---- 오른쪽 판 ----
  function head(box) {
    const sb = h('button', 'in-sfx', SFX.on ? '\u{1F50A}' : '\u{1F507}'); sb.type = 'button'; sb.title = L('효과음 켜기/끄기', 'Sound effects on/off'); sb.onclick = () => { SFX.toggle(); renderSide(); }; box.append(sb);
    const top = h('div', 'in-top');
    if (I.summit) { const s = I.summit, sd = h('div', 'in-plan in-sum'); sd.append(h('b', '', L('정상회담', 'Summit')), document.createTextNode(' ' + (s.sab ? L(`${s.place} · ${s.left}달 뒤 · 결렬 공작 끝남`, `${s.place} · in ${s.left} mo · sabotage in place`) : L(`${s.place} · ${s.left}달 뒤 열림 — 「정상회담 방해」로 깨뜨릴 수 있음`, `${s.place} · in ${s.left} mo — can be broken with "Sabotage the summit"`))));
      sd.title = L('회담이 열리면 두 강대국 사이 긴장이 크게 풀립니다. 방해에 성공하면 회담 날 결렬되고 긴장이 오릅니다.', 'If the summit is held, great-power tension eases sharply. If sabotaged, it collapses on the day and tension rises.'); top.append(sd); } // 두 강대국 정상회담(2026-11-08)
    for (const s of I.sus) {
      const row = h('div', 'in-sus'), bar = h('div', 'in-bar'), i = h('i'); i.style.width = s.v + '%'; i.style.background = s.v >= 90 ? '#ff5a5a' : s.v >= 60 ? '#ff9a6a' : s.v >= 30 ? '#e8c872' : '#7fd88f'; bar.append(i);
      row.append(h('b', '', s.name), bar, h('span', '', L(`의심 ${s.v}`, `Suspicion ${s.v}`) + (s.st ? ` · ${s.stName}` : ''))); row.title = L('발각되면 오르고 매달 조금씩 가라앉습니다. 30 경계(방첩 강화) · 60 감찰(작전 더 위험) · 90 최후통첩', 'Rises when we are caught, fades a little each month. 30 wary (tighter counter-intelligence) · 60 inspection (riskier missions) · 90 ultimatum'); top.append(row);
      if (s.hostile > 0) { const r2 = h('div', 'in-sus ho'), b2 = h('div', 'in-bar'), i2 = h('i'); i2.style.width = s.hostile + '%'; i2.style.background = '#ff5a5a'; b2.append(i2); r2.append(h('b', '', L('　회랑과의 긴장', '　Tension with us')), b2, h('span', '', String(s.hostile))); r2.title = L('최후통첩을 거절하거나 큰 공작이 들통나면 오릅니다. 높을수록 그 나라가 회랑을 적대합니다.', 'Rises when we reject an ultimatum or a major plot is exposed. The higher it is, the more hostile that power is to the Corridor.'); top.append(r2); }
      if (s.cnet > 0 || s.plan) { // 중앙 정보망 · 빼낸 전쟁 계획(2단계 저울질, 2026-11-08)
        const r3 = h('div', 'in-sus ho'), b3 = h('div', 'in-bar'), i3 = h('i'); i3.style.width = (s.cnet || 0) + '%'; i3.style.background = '#9fd4ff'; b3.append(i3);
        r3.append(h('b', '', L('　중앙 정보망', '　Central network')), b3, h('span', '', String(s.cnet || 0)));
        r3.title = L('그 나라 정부 안의 정보망입니다. 수도 섹터에 공작원을 두면 아주 천천히 자랍니다. 25 전쟁 계획 입수 · 40 정보 흘리기 · 50 위조 문서', 'Our network inside that government. It grows very slowly while an operative sits in its capital sector. 25 war plans · 40 leak · 50 forged dossier'); top.append(r3);
        if (s.plan) { const p = s.plan, pd = h('div', 'in-plan'); pd.append(h('b', '', L('전쟁 계획', 'War plans')), document.createTextNode(' ' + p.intentName + (p.tnOn ? L(` · 두 강대국 긴장 ${p.tn}`, ` · great-power tension ${p.tn}`) : '') + L(` · 다음 적 공작 ${p.foe ? '이 나라' : '아님'} · ${p.left}달 유효`, ` · next enemy op: ${p.foe ? 'from them' : 'not them'} · ${p.left} mo left`))); top.append(pd); }
        if (s.fleets) { const f = s.fleets, fd = h('div', 'in-plan in-flt'); fd.append(h('b', '', L('함대 배치', 'Fleet chart')), document.createTextNode(' ' + L(`군 함대 ${f.list.length} · 전력 ${f.total.toLocaleString()} · ${f.left}달 남음`, `${f.list.length} military fleets · strength ${f.total.toLocaleString()} · ${f.left} mo left`)));
          fd.title = f.list.slice(0, 12).map((q) => `${q.n} — ${q.p.toLocaleString()} · ${q.at}`).join('\n'); top.append(fd); } // 함대 동향(2026-11-08)
      }
      if (s.ult) {
        const u = h('div', 'in-ult'); u.append(h('b', '', L(`${s.name}의 최후통첩 — ${s.ult.left}일 남음`, `Ultimatum from ${s.name} — ${s.ult.left} days left`)), h('div', '', L('공작원을 넘기거나 배상금을 내라고 요구합니다. 기한이 지나면 거절로 봅니다.', 'They demand our operatives or reparations. If the deadline passes, it counts as refusal.')));
        const bt = h('div', 'bt');
        const mk = (choice, ko, en, warn) => { const b = h('button', '', L(ko, en)); b.type = 'button'; b.onclick = async () => { if (!warn || await sllmAsk(warn)) act({ a: 'ult', side: s.side, choice }); }; bt.append(b); return b; };
        mk('hand', '공작원 넘기기', 'Hand over operatives', L('그 나라에 잠입한 공작원(최대 2명)을 넘깁니다. 되찾을 수 없습니다. 넘길까요?', 'Hand over up to two operatives embedded in that realm? They cannot be recovered.'));
        const pb = mk('pay', `배상금 ${s.ult.pay}`, `Pay ${s.ult.pay}`, null); pb.disabled = !I.live;
        mk('refuse', '거절', 'Refuse', L('거절하면 그 나라와 회랑 사이의 긴장이 크게 오릅니다. 거절할까요?', 'Refusing will sharply raise tension between that realm and the Corridor. Refuse?'));
        u.append(bt); top.append(u);
      }
    }
    if (I.shp !== undefined) { // 우리 보안망(방첩 대전 체력, 2026-11-08)
      const v = I.shp, row = h('div', 'in-sus'), bar = h('div', 'in-bar'), i = h('i'); i.style.width = (v / I.shpMax * 100) + '%'; i.style.background = v < I.shpMax * 0.4 ? '#ff6a6a' : '#7fe0a0'; bar.append(i);
      row.append(h('b', '', L('우리 보안망', 'Our security grid')), bar, h('span', '', `${v}/${I.shpMax}`)); row.title = L(`방첩 대전의 체력입니다. 판이 끝나도 이어지고 매달 조금씩 회복합니다. 첩보부장 ${I.chief ? I.chief.w : 0}승.`, `Health in counter-intelligence duels. It carries over and recovers a little each month. Spymaster: ${I.chief ? I.chief.w : 0} wins.`); top.append(row);
    }
    const bud = h('div', 'in-bud'); bud.append(h('span', '', L('정보 예산(에너지/달 · 연례 회의 때 1년치를 냄): ', 'Intel budget (energy/month · a year\'s worth paid at the yearly meeting): ')));
    I.budgets.forEach((v, n) => { const b = h('button', n === I.budget ? 'on' : '', String(v)); b.type = 'button'; b.onclick = () => act({ a: 'budget', n }); bud.append(b); });
    bud.title = L('예산이 많을수록 정보망이 빨리 자라고 이듬해 첩보력이 늘어납니다. 매달 내지 않고 매년 1월 연례 회의 때 12달치를 한 번에 냅니다.', 'A larger budget grows networks faster and adds next year\'s intel. It is not paid monthly: twelve months\' worth is paid at each January meeting.');
    top.append(bud); box.append(top);
    const tabs = h('div', 'in-tabs');
    for (const [k, ko, en] of [['sector', '섹터', 'Sector'], ['agents', '공작원', 'Operatives'], ['deck', '덱', 'Deck'], ['threat', '위협', 'Threats'], ['reports', '보고서', 'Reports']]) {
      const b = h('button', tab === k ? 'on' : '', L(ko, en)); b.type = 'button'; b.onclick = () => { tab = k; renderSide(); };
      if (k === 'threat' && I.threats && I.threats.length) { const hi = I.threats.filter((t) => t.lvl >= 3).length; b.append(h('span', 'tbadge' + (hi ? ' hi' : ''), String(hi || I.threats.length))); } // 급한 위협 수
      tabs.append(b);
    }
    box.append(tabs);
    if (!I.live) box.append(h('div', 'in-msg', L('게임이 켜져 있지 않아 영입·예산 지출은 게임을 켠 뒤에 됩니다.', 'The game is not running; recruiting and budget spending need the game.')));
    if (msg) box.append(h('div', 'in-msg', msg));
  }
  function skills(a) { const row = h('div', 'in-sk'); SKILL().forEach((nm, i) => { const sp = h('span', '', nm + ' '); sp.append(h('b', '', '★'.repeat(a.sk[i]))); row.append(sp); }); return row; }
  function sectorTab(box) {
    const sc = cur, n = nobleOf(sc);
    if (!sc) {
      const c = h('div', 'dos'); c.append(h('div', '', L('지도에서 귀족 섹터를 누르세요.', 'Click a noble sector on the map.')));
      const st = h('div', 'steps'); for (const [t1, t2] of [[L('① 섹터 고르기', '① Pick a sector'), L('귀족 초상화를 누름', 'Click a portrait')], [L('② 공작원 잠입', '② Embed'), L('정보망이 자람', 'Network grows')], [L('③ 카드 내기', '③ Play a card'), L('손패 → 섹터로 끌기', 'Drag from hand')]]) { const x = h('div', 'step'); x.append(h('b', '', t1), document.createTextNode(t2)); st.append(x); }
      c.append(st); box.append(c); return;
    }
    const c = h('div', 'dos'); c.style.setProperty('--sc', (cur && cur.i !== undefined && document.querySelector(`#cards .gv[data-i="${cur.i}"]`)?.style.getPropertyValue('--sc')) || '#5fd4e4');
    const hd = h('div', 'dos-h'), pc = h('div', 'dos-pic');
    if (n && n.known && sc.pic) pc.style.backgroundImage = `url("${sc.pic}")`; else pc.textContent = n && !n.known ? '?' : (sc.gov ? sc.gov.slice(0, 1) : '—');
    const tx = h('div'); tx.append(h('b', '', n ? (n.known ? n.name : L('정체 미상의 귀족', 'Unidentified noble')) : (sc.name || L('섹터', 'Sector'))), h('small', '', sc.name || ''));
    if (n) { const sd = n.side === 'a' ? I.sus[0] : I.sus[1], bd = h('span', 'side-b', sd.name); bd.style.background = n.side === 'a' ? '#7fc8ff' : '#ff9a8a'; tx.append(bd); }
    hd.append(pc, tx); c.append(hd);
    if (!n) { c.append(h('div', 'nexth', L('귀족이 다스리는 섹터가 아닙니다. 회랑 정보국은 귀족 섹터에서만 활동합니다.', 'This sector is not ruled by a noble. The bureau only operates in noble sectors.'))); box.append(c); return; }
    // 칩: 신원 · 충성도 · 약점
    const chips = h('div', 'chips');
    chips.append(h('span', 'chip' + (n.known ? ' ok' : ''), n.known ? L('신원 파악', 'Identified') : L('신원 미상', 'Unidentified')));
    chips.append(h('span', 'chip' + (n.loyal ? ' ok' : ''), n.loyal ? L('충성도 파악', 'Loyalty known') : L('충성도 모름', 'Loyalty unknown')));
    if (n.card) chips.append(h('span', 'chip gold', L(`약점: ${n.card}`, `Weakness: ${n.card}`)));
    if (n.affair) chips.append(h('span', 'chip gold', L('불륜 — 추문 카드', 'Affair — scandal card'))); // 혼약한 귀족의 정부(2026-11-08)
    if (n.ins && n.ins.length) chips.append(h('span', 'chip gold', L(`내부자: ${n.ins.join(' · ')}`, `Insiders: ${n.ins.join(' · ')}`))); // 내부자 매수(2026-11-08)
    c.append(chips);
    // 정보망 막대
    const gg = h('div', 'gauge'), lb = h('div', 'lb'); lb.append(h('span', '', L('정보망', 'Network')), h('b', '', `${n.net} / 100`)); const tr = h('div', 'tr'), fi = h('i'); fi.style.width = Math.min(100, n.net) + '%'; tr.append(fi); gg.append(lb, tr);
    gg.title = L('공작원이 잠입해 있으면 매달 자랍니다(정보 예산이 클수록 빨리). 큰 작전일수록 정보망이 더 필요합니다.', 'Grows every month while an operative is embedded (faster with a bigger intel budget). Bigger missions need a stronger network.'); c.append(gg);
    const a = agentAt(n.id), ok = a ? (a.plays || []).filter((p) => !p.why) : [];
    // 단계
    const steps = h('div', 'steps');
    const step = (done, now, t1, t2) => { const x = h('div', 'step' + (done ? ' done' : now ? ' now' : '')); x.append(h('b', '', t1), document.createTextNode(t2)); steps.append(x); };
    step(!!a, !a, L('① 잠입', '① Embed'), a ? a.name : L('공작원 없음', 'No operative'));
    step(!!a && n.net > 0, !!a && n.net === 0, L('② 정보망', '② Network'), n.net > 0 ? L(`${n.net} 쌓임`, `${n.net} built`) : L('아직 0', 'still 0'));
    step(false, !!a && !a.op && ok.length > 0, L('③ 카드', '③ Card'), a && a.op ? L('작전 중', 'on mission') : L(`낼 수 있는 ${ok.length}장`, `${ok.length} playable`));
    c.append(steps);
    if (!a) {
      c.append(h('div', 'nexth', L('아래 공작원 카드를 이 섹터로 끌어다 놓거나 「보내기」를 누르세요. 잠입한 다음 달부터 정보망이 자라고, 이 섹터를 누르면 첩보 카드가 나옵니다.', 'Drag an operative card from below onto this sector, or press "Send". The network grows from the next month, and clicking this sector then shows your intel cards.')));
      const idle = I.agents.filter((x) => x.st !== 'op');
      for (const x of idle) {
        const ag = h('div', 'ag'), av = h('div', 'av pic'), t = h('div', 'tx'); av.style.backgroundImage = agentPic(x); t.append(h('b', '', x.name), skills(x));
        if (x.at !== null) t.append(h('small', '', L(`지금: ${x.atName} (옮기면 그곳 잠입이 끝남)`, `Now at ${x.atName} (moving ends that posting)`)));
        const b = h('button', 'pri', x.at !== null ? L('이리 옮기기', 'Move here') : L('보내기', 'Send')); b.type = 'button'; b.onclick = () => act({ a: 'post', agent: x.id, target: n.id });
        ag.append(av, t, b); c.append(ag);
      }
      if (!idle.length) { const b = h('button', 'pri', L('공작원 탭에서 영입하기', 'Recruit in the Operatives tab')); b.type = 'button'; b.onclick = () => { tab = 'agents'; renderSide(); }; c.append(h('div', 'nexth', L('보낼 수 있는 공작원이 없습니다.', 'No operative is free.')), b); }
      box.append(c); return;
    }
    const ag = h('div', 'ag'), av = h('div', 'av pic'), t = h('div', 'tx'); av.style.backgroundImage = agentPic(a); t.append(h('b', '', `${a.name} · ${ST(a.st)}`), skills(a)); ag.append(av, t);
    if (!a.op) { const back = h('button', '', L('철수', 'Withdraw')); back.type = 'button'; back.onclick = () => act({ a: 'post', agent: a.id, target: null }); ag.append(back); }
    c.append(ag);
    if (a.op) c.append(h('div', 'nexth', L(`「${a.op.name}」 진행 중 — 약 ${a.op.left}달 남음. 끝나면 다음 카드를 낼 수 있습니다.`, `"${a.op.name}" under way — about ${a.op.left} month(s) left. You can play the next card when it ends.`)));
    // 카드 내기: 고른 카드가 있으면 크게, 없으면 낼 수 있는 카드를 작은 카드로
    const playBox = h('div', 'in-play'), sel = I.deck && I.deck.hand.find((x) => x.id === selCard), pl = sel ? (a.plays || []).find((p) => p.card === sel.id) : null;
    if (sel && pl && !a.op) {
      playBox.append(cardEl(sel, true));
      if (pl.chance !== undefined) { const nums = h('div', 'n'); const s1 = h('span'); s1.append(L('성공 ', 'Success '), h('b', '', pl.chance + '%')); const s2 = h('span', 'r'); s2.append(L('발각 ', 'Detection '), h('b', '', pl.risk + '%')); nums.append(s1, s2, h('span', '', L(`약 ${Math.round(pl.days / 30)}달`, `~${Math.round(pl.days / 30)} mo`))); playBox.append(nums); }
      let pick = null, sup = null;
      if (pl.with && pl.with.length) { pick = h('select'); for (const w of pl.with) { const op = h('option', '', w.name); op.value = String(w.id); pick.append(op); } const row = h('div', ''); row.append(h('small', '', pl.withLabel || L('상대: ', 'Against: ')), pick); playBox.append(row); }
      const sups = pl.chance !== undefined ? I.deck.hand.filter((x) => x.type === 'support') : [];
      if (sups.length) { sup = h('select'); const none = h('option', '', L('보조 카드 없음', 'No support card')); none.value = ''; sup.append(none); for (const x of sups) { const op = h('option', '', `${x.name} (${x.cost}) — ${x.desc}`); op.value = String(x.id); sup.append(op); } const row = h('div', ''); row.append(h('small', '', L('함께 낼 보조 카드: ', 'Support card: ')), sup); playBox.append(row); }
      playBox.append(h('small', '', L(`첩보력 ${pl.cost}`, `Intel ${pl.cost}`) + (pl.energy ? L(` · 에너지 ${pl.energy}`, ` · ${pl.energy} energy`) : '') + L(` (지금 ${I.deck.ip})`, ` (you have ${I.deck.ip})`)));
      if (pl.why) playBox.append(h('div', 'in-why', pl.whyText));
      const b = h('button', 'pri', L('이 카드 내기', 'Play this card')); b.type = 'button'; b.disabled = !!pl.why || busy || (!!pl.energy && !I.live);
      b.onclick = () => act({ a: 'play', card: sel.id, agent: a.id, ...(pick ? { with: Number(pick.value) } : {}), ...(sup && sup.value ? { support: Number(sup.value) } : {}) });
      const cancel = h('button', '', L('다른 카드', 'Other card')); cancel.type = 'button'; cancel.onclick = () => { selCard = null; renderHand(); renderSide(); };
      const bt = h('div', ''); bt.append(b, document.createTextNode(' '), cancel); playBox.append(bt);
    } else if (!a.op) {
      playBox.append(h('small', '', ok.length ? L('여기에 낼 수 있는 카드 — 누르면 자세히 보고 낼 수 있습니다(손패에서 끌어다 놓아도 됩니다).', 'Cards you can play here — click one to inspect and play (or drag it from your hand).') : L('지금 이 섹터에 낼 수 있는 카드가 없습니다. 손패 카드 아래에 이유가 나옵니다.', 'No card in hand can be played here right now. The reason shows under each card in your hand.')));
      const minis = h('div', 'minis');
      for (const p of ok) { const x = I.deck.hand.find((y) => y.id === p.card); if (!x) continue; const el = cardEl(x, false); el.onclick = () => { SFX.card(); selCard = x.id; renderHand(); renderSide(); }; minis.append(el); }
      if (ok.length) playBox.append(minis);
    }
    c.append(playBox);
    box.append(c);
  }
  function agentsTab(box) {
    for (const a of I.agents) {
      const c = h('div', 'in-card'); c.append(h('h4', '', a.name), skills(a));
      c.append(h('div', '', `${ST(a.st)}${a.at !== null ? ' · ' + a.atName : ''}${a.op ? ' · ' + a.op.name : ''}`));
      if (a.at !== null) { const go = h('button', '', L('지도에서 보기', 'Show on map')); go.type = 'button'; go.onclick = () => { const sc = secOfNoble(a.at); if (sc && API) { tab = 'sector'; API.select(sc.i, true); } }; c.append(go, document.createTextNode(' ')); }
      if (a.st !== 'op') { const d = h('button', '', L('내보내기', 'Dismiss')); d.type = 'button'; d.onclick = async () => { if (await sllmAsk(L(`${a.name}을(를) 내보낼까요?`, `Dismiss ${a.name}?`))) act({ a: 'dismiss', agent: a.id }); }; c.append(d); }
      box.append(c);
    }
    const hire = h('button', '', L(`공작원 영입 (에너지 ${I.hireCost})`, `Recruit an operative (${I.hireCost} energy)`)); hire.type = 'button';
    hire.disabled = I.agents.length >= I.maxAgents || !I.live; hire.onclick = () => act({ a: 'hire' }); box.append(hire);
    if (I.lost.length) { box.append(h('h3', '', L('연락이 끊긴 공작원', 'Lost operatives'))); for (const x of I.lost) box.append(h('div', 'in-rep bad', x.name)); }
    forgeCard(box);
  }
  // 위조 문서 공방(2026-11-08 사용자: 「위조계획 제조하는 것도 만들자」) — 누가 → 누구를: 무엇을. 만든 문서는 접견에서 꺼내 건넨다(들킬 수 있다).
  const fg = { kind: 'plan', from: 'a', intent: 'atk', a: '', b: '', bk: 'back', n: '' };
  function forgeCard(box) {
    const F = I.forge; if (!F) return;
    const c = h('div', 'in-card'); c.append(h('h4', '', L(`위조 문서 공방 (${F.held.length}/${F.max})`, `Forgery workshop (${F.held.length}/${F.max})`)));
    c.append(h('div', 'nexth', L('가짜 기밀 문서를 만들어 접견에서 진짜처럼 건넵니다. 그 나라 중앙 정보망·그 귀족의 정보망이 높을수록 솜씨가 좋아 덜 들킵니다. 문서에 적힌 당사자에게 건네면 반드시 들킵니다.',
      'Craft fake secret documents and hand them over in audiences as if real. The stronger our network in that government or around that noble, the better the craft and the lower the risk. Handing one to the very person it names always fails.')));
    for (const x of F.held) {
      const r = h('div', 'in-rep'); r.append(h('span', '', `${x.label} · ` + L(`솜씨 ${x.q} · 들킬 확률 ${x.caught}%`, `craft ${x.q} · ${x.caught}% exposure`)));
      const bn = h('button', '', L('태우기', 'Burn')); bn.type = 'button'; bn.onclick = async () => { if (await sllmAsk(L('이 위조 문서를 태울까요?', 'Burn this forged document?'))) act({ a: 'burn', card: x.id }); };
      r.append(document.createTextNode(' '), bn); c.append(r);
    }
    const sel = (opts, key) => { const e = h('select'); for (const [v, t] of opts) { const o = h('option', '', t); o.value = v; e.append(o); } if (!opts.some(([v]) => v === fg[key]) && opts.length) fg[key] = opts[0][0]; e.value = fg[key]; e.onchange = () => { fg[key] = e.value; renderSide(); }; return e; };
    const nob = F.nobles.map((n) => [String(n.id), `${n.name} (${n.sideName})`]);
    const row = h('div', 'in-forge'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0';
    row.append(sel([['plan', L('전쟁 계획', 'War plans')], ['tie', L('숨은 인연', 'Hidden tie')], ['loy', L('딴마음', 'Disloyalty')]], 'kind'));
    let q = F.base, ok = true;
    const qOf = (net) => Math.round(Math.max(0, Math.min(100, F.base + net * F.netW)));
    const netOf = (id) => { const n = F.nobles.find((x) => String(x.id) === id); return n ? n.net : 0; };
    if (fg.kind === 'plan') {
      const sides = [['a', F.sides.a], ['b', F.sides.b]];
      row.append(sel(sides, 'from'), h('span', '', '→'), h('span', '', fg.from === 'a' ? F.sides.b : F.sides.a), h('span', '', ':'), sel([['atk', L('공격 준비', 'preparing to attack')], ['def', L('방어 태세', 'bracing for defence')], ['wait', L('관망', 'waiting it out')]], 'intent'));
      q = qOf(F.cnet[fg.from] || 0);
    } else if (fg.kind === 'tie') {
      if (nob.length < 2) ok = false;
      row.append(sel(nob, 'a'), h('span', '', '→'), sel(nob, 'b'), h('span', '', ':'), sel([['back', L('비밀 회선(내통)', 'secret back channel')], ['accord', L('밀약', 'secret accord')], ['oath', L('비밀 서약', 'secret oath')]], 'bk'));
      if (fg.a === fg.b) ok = false;
      q = Math.round(Math.max(0, Math.min(100, F.base + (netOf(fg.a) + netOf(fg.b)) / 2 * F.netW)));
    } else {
      if (!nob.length) ok = false;
      row.append(sel(nob, 'n'), h('span', '', '→'), h('span', '', L('자기 군주', 'their own sovereign')), h('span', '', L(': 배신을 꾀함', ': plotting betrayal')));
      q = qOf(netOf(fg.n));
    }
    c.append(row);
    if (!ok) c.append(h('div', 'nexth', fg.kind === 'tie' && nob.length >= 2 ? L('서로 다른 두 귀족을 고르세요.', 'Choose two different nobles.') : L('먼저 정찰로 귀족의 정체를 알아내야 합니다.', 'Identify nobles through reconnaissance first.')));
    const caught = Math.round(Math.max(F.catchMin, Math.min(F.catchTop, F.catchTop - q * F.catchW)));
    c.append(h('div', '', L(`예상 솜씨 ${q} · 들킬 확률 ${caught}%`, `Expected craft ${q} · ${caught}% chance of exposure`)));
    const cost = F.cost[fg.kind];
    const mk = h('button', 'pri', L(`위조하기 (에너지 ${cost})`, `Forge it (${cost} energy)`)); mk.type = 'button';
    mk.disabled = !ok || !I.live || F.held.length >= F.max;
    mk.onclick = () => act(fg.kind === 'plan' ? { a: 'forge', kind: 'plan', from: fg.from, intent: fg.intent } : fg.kind === 'tie' ? { a: 'forge', kind: 'tie', from: Number(fg.a), to: Number(fg.b), bk: fg.bk } : { a: 'forge', kind: 'loy', from: Number(fg.n) });
    c.append(mk); box.append(c);
  }
  function deckTab(box) {
    const D = I.deck; if (!D) return;
    const top = h('div', 'in-card'); top.append(h('h4', '', L('연례 정보 회의', 'Yearly intelligence meeting')));
    top.append(h('div', '', D.meet ? L(`${D.meet}년 회의를 마쳤습니다. 다음 회의는 ${D.next}년 1월입니다.`, `The ${D.meet} meeting is done. The next one is in January ${D.next}.`) : L('첫 회의는 다음 섹터 보고 때 열립니다.', 'The first meeting opens with the next sector report.')));
    top.append(h('div', '', L(`첩보력 ${D.ip} · 다음 회의 충전 약 +${D.gain} · 덱 ${D.size}장(${D.min}~${D.max})`, `Intel ${D.ip} · next refill about +${D.gain} · deck ${D.size} cards (${D.min}-${D.max})`)));
    box.append(top);
    if (I.year) { const y = h('div', 'in-card'); y.append(h('h4', '', L('연말 보고서', 'Year-end report')), h('div', 'in-yr', I.year.text)); box.append(y); }
    if (D.offer.length) {
      const c = h('div', 'in-card'); c.append(h('h4', '', L(`보상 고르기 (남은 보상 ${D.rewards})`, `Choose a reward (${D.rewards} left)`)));
      const row = h('div', 'in-deck'); D.offer.forEach((o, n) => { const el = cardEl(o, false); el.onclick = () => act({ a: 'take', n }); row.append(el); }); c.append(row);
      const skip = h('button', '', L('이번 보상은 건너뛰기', 'Skip this reward')); skip.type = 'button'; skip.onclick = () => act({ a: 'take', n: -1 }); c.append(skip); box.append(c);
    }
    const curses = D.hand.filter((x) => x.type === 'curse');
    if (curses.length) { const c = h('div', 'in-card'); c.append(h('h4', '', L('손에 든 나쁜 카드', 'Bad cards in hand'))); for (const x of curses) { const li = h('div', 'in-li'); li.append(h('span', '', `${x.name} — ${x.desc}`)); const b = h('button', '', L(`내서 지우기 (${x.cost})`, `Play to remove (${x.cost})`)); b.type = 'button'; b.disabled = D.ip < x.cost; b.onclick = () => act({ a: 'play', card: x.id }); li.append(b); c.append(li); } box.append(c); }
    if (D.market) { // 합친 첩보 상점(2026-11-08): 공작 카드 + 방첩 대전 카드 한 풀, 6칸 무작위 진열
      const M = D.market, shop = h('div', 'in-card in-mkt'); shop.append(h('h4', '', L('첩보 상점 — 오늘의 진열', 'Intel market — today\'s stock')));
      shop.append(h('small', '', L('공작 카드와 방첩 대전 카드가 섞여 나옵니다. 1월·7월과 방첩 대전이 끝날 때 새 물건이 들어옵니다.', 'Intel and duel cards come mixed. New stock arrives in January, July and after each counter-intel duel.')));
      const row = h('div', 'mk');
      for (const x of M.items) {
        const cell = h('div', 'mki' + (x.sold ? ' sold' : '')), el = cardEl(x.card, false); el.title = `${x.card.name} — ${x.card.desc || x.card.short || ''}`;
        const tag = h('div', 'mkt ' + x.pool, x.pool === 'duel' ? L('방첩 대전', 'Duel') : L('공작', 'Intel'));
        const b = h('button', x.sale ? 'sale' : '', x.sold ? L('팔림', 'Sold') : (x.sale ? L(`할인 ${x.price}`, `Sale ${x.price}`) : String(x.price))); b.type = 'button';
        b.disabled = !!x.sold || !I.live || x.full; if (x.full && !x.sold) b.title = L('덱이 가득 찼습니다.', 'That deck is full.');
        b.onclick = () => act({ a: 'sbuy', n: x.n });
        cell.append(tag, el, b); row.append(cell);
      }
      shop.append(row);
      const rr = h('button', '', L(`진열 다시 깔기 (에너지 ${M.reroll})`, `Restock (${M.reroll} energy)`)); rr.type = 'button'; rr.disabled = !I.live; rr.title = L('다시 깔수록 비싸집니다. 새 물건이 들어오면 값이 처음으로 돌아갑니다.', 'Each restock costs more. The price resets when new stock arrives.');
      rr.onclick = () => act({ a: 'reroll' }); shop.append(rr); box.append(shop);
    }
    if (D.upgrade.length) { const up = h('div', 'in-card'); up.append(h('h4', '', L('강화 (같은 카드 두 장 → + 카드 한 장)', 'Upgrade (two copies → one + card)'))); for (const x of D.upgrade) { const b = h('button', '', `${x.name} → ${x.name}+`); b.type = 'button'; b.onclick = () => act({ a: 'upgrade', kind: x.k }); up.append(b, document.createTextNode(' ')); } box.append(up); }
    if (I.ddeck) { // 방첩 대전 덱(2026-11-08): 목록 · 강화 · 상점 · 지우기
      const S = I.dshop || { cards: [], upgrade: [], max: 30, min: 10, remove: 400 };
      const dk = h('div', 'in-card'); dk.append(h('h4', '', L(`방첩 대전 덱 (${I.ddeck.length}장, ${S.min}~${S.max}) — 첩보부장 ${I.chief ? I.chief.w : 0}승`, `Counter-intel duel deck (${I.ddeck.length}, ${S.min}-${S.max}) — spymaster ${I.chief ? I.chief.w : 0} wins`)));
      const row = h('div', 'minis'); for (const c of I.ddeck) { const el = cardEl(c, false); el.title = `${c.name} — ${c.desc}\n` + L(`눌러서 지우기(에너지 ${S.remove})`, `Click to remove (${S.remove} energy)`); el.onclick = async () => { if (await sllmAsk(L(`「${c.name}」을(를) 방첩 덱에서 지울까요? 에너지 ${S.remove}`, `Remove "${c.name}" from the counter-intel deck? ${S.remove} energy`))) act({ a: 'dRemove', card: c.id }); }; row.append(el); }
      dk.append(row);
      if (S.upgrade.length) { dk.append(h('div', 'in-li', L('강화 — 같은 카드 두 장 → + 카드 한 장(숫자 +1)', 'Upgrade — two copies → one + card (+1)'))); for (const u of S.upgrade) { const li = h('div', 'in-li'); li.append(h('span', '', u.name)); const b = h('button', '', L('강화', 'Upgrade')); b.type = 'button'; b.onclick = () => act({ a: 'dUpgrade', kind: u.k }); li.append(b); dk.append(li); } }
      box.append(dk);
    }
    const list = h('div', 'in-card'); list.append(h('h4', '', L(`내 덱 (${D.size}장) — 지우기 ${D.removeCost}`, `My deck (${D.size}) — remove for ${D.removeCost}`)));
    for (const x of D.list) { const li = h('div', 'in-li'); li.append(h('span', '', `${x.name}`)); if (x.type !== 'weak') { const b = h('button', '', L('지우기', 'Remove')); b.type = 'button'; b.disabled = !I.live || D.size <= D.min; b.onclick = async () => { if (await sllmAsk(L(`${x.name}을(를) 덱에서 지울까요?`, `Remove ${x.name} from the deck?`))) act({ a: 'remove', card: x.id }); }; li.append(b); } list.append(li); }
    box.append(list);
  }
  // ---- 위협 탭(2026-11-08): 다가오는 위협을 급한 순으로 ----
  function threatTab(box) {
    const T = I.threats || [];
    if (!T.length) { box.append(h('div', 'in-card', L('지금 다가오는 위협이 없습니다. 조용할 때 덱과 정보망을 다져 두세요.', 'No threats incoming. Use the calm to build your deck and networks.'))); return; }
    for (const t of T) {
      const c = h('div', 'in-thr lv' + t.lvl), hd = h('div', 'th');
      hd.append(h('span', 'ic', t.icon), h('b', '', t.title)); if (t.days !== undefined) hd.append(h('span', 'dd', L(`${t.days}일`, `${t.days}d`)));
      c.append(hd, h('div', 'tx', t.text));
      if (t.act === 'duel') { const b = h('button', '', L('대전판 열기', 'Open the duel')); b.type = 'button'; b.onclick = () => { duelOpen = true; renderDuel(); }; c.append(b); }
      box.append(c);
    }
  }
  function reportsTab(box) {
    if (I.cards && I.cards.length) { const c = h('div', 'in-card'); c.append(h('h4', '', L('약점 카드', 'Weakness cards'))); for (const k of I.cards) c.append(h('div', 'in-rep', `${k.name} — ${k.what}`)); box.append(c); }
    if (!I.reports.length) { box.append(h('div', 'in-card', L('아직 보고서가 없습니다. 작전이 끝나면 여기에 쌓입니다.', 'No reports yet. They arrive here when missions end.'))); return; }
    for (const r of I.reports) { const d = h('div', 'in-rep' + (r.kind === 'year' ? ' yr' : r.ok ? '' : ' bad')); d.append(h('small', '', r.d), document.createTextNode(r.text)); box.append(d); }
  }
  function renderSide() {
    const box = $('side'); if (!box || !I) return; box.textContent = ''; SFX.type(10);
    head(box);
    if (tab === 'sector') sectorTab(box); else if (tab === 'agents') agentsTab(box); else if (tab === 'deck') deckTab(box); else if (tab === 'threat') threatTab(box); else reportsTab(box);
  }

  // ---- 포커스(2026-11-08): 섹터를 고르면 주변을 어둡게, 다른 섹터는 흐리게 ----
  function focus() {
    const sm = $('sm'); if (!sm) return;
    let f = $('inFocus'); if (!f) { f = h('div'); f.id = 'inFocus'; const cards = $('cards'); if (cards) sm.insertBefore(f, cards); else sm.append(f); }
    const el = document.querySelector('#cards .gv.sel');
    if (!cur || !el || el.style.display === 'none') { sm.classList.remove('in-focus'); return; }
    const ps = parseFloat(getComputedStyle(el).getPropertyValue('--ps')) || 40;
    f.style.setProperty('--fx', el.style.left); f.style.setProperty('--fy', el.style.top); f.style.setProperty('--fr', Math.round(ps * 1.9) + 'px');
    sm.classList.add('in-focus');
  }
  window.SCNMAP_HOOK = {
    side: true,
    title: () => L('회랑 정보국 — 첩보 지도', 'Corridor Intelligence — Espionage Map'),
    loaded: (D, api) => { API = api; css(); powerOn(); void load(); },
    card,
    select: (sc) => { cur = sc; if (sc) { tab = 'sector'; SFX.select(); } focus(); renderSide(); renderHand(); },
    placed: () => focus(), // 지도를 옮기거나 확대할 때마다 어두운 테두리의 가운데를 고른 섹터에 맞춘다
  };
  document.addEventListener('sllm-language', () => { renderSide(); renderHand(); renderFoe(); });
})();
