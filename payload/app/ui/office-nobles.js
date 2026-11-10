// 제국 세력도(옛 귀족 연감, 2026-11-07 사용자: 「귀족연감을 제국세력도로 — 첫 화면은 제국 세력지도, 명부는 지우고, 오디세이 같은 세력판은 두 번째」).
//   제국 세력지도: 앱 섹터(귀족 거점 59 + 수도 둘 — 게임 섹터와 상관없는 귀족의 실질 지배 범위)를 지도로. 열어 둔 동안 15초마다 다시 읽어 섹터 변화를 실시간으로 표시(바뀐 성계 반짝임 + 관측 기록).
// 귀족 연감(시나리오 전용, 2026-11-06 사용자: 「이 시나리오팩은 개인일지가 집무실에 있어 바로 볼 수 있게」) — 집무실 바탕화면 맨 앞 칸 「회랑의 삼파전」 + 연감 창.
// 시나리오 세이브가 아니면(scnNobles().on = false) 아무것도 그리지 않는다. 앱: src/features/scenario-nobles-app.ts(플레이어가 아는 만큼만 넘어옴). 문구는 L(한, 영)만 — 언어 팩 호환.
// 모양: 홀로그램 판(CSS, 2026-11-06 — 펼친 책 그림은 쓰지 않기로). 「접견」·「군주 접견」은 전체 화면 1:1 비밀회담(ui/audience.html, 2026-11-06).
// 「인물 관계도」(삼국지13식): 고른 인물을 가운데, 자기 군주·나·알려진 인연을 둘레에, 그 인연의 인연을 바깥에 흐리게. 다른 인물을 누르면 그 인물로 옮겨 가며 움직인다.
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
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const STAGE_COL = ['#7fd88f', '#c9d27a', '#e0c48a', '#ff9a6a', '#ff5a5a'];
  const SPEC = () => ({ forge: L('합금 주조', 'Alloy foundry'), research: L('연구', 'Research'), factory: L('소비재', 'Consumer goods'), refinery: L('전략 자원', 'Strategic resources'), fortress: L('요새', 'Fortress'), trade: L('교역', 'Trade'), energy: L('에너지', 'Energy'), minerals: L('광물', 'Minerals'), food: L('식량', 'Food') });
  const TRAITS = () => [[L('명예', 'Honor'), L('교활', 'Devious')], [L('자비', 'Mercy'), L('잔혹', 'Cruel')], [L('관대', 'Generous'), L('인색', 'Closefisted')], [L('용맹', 'Daring'), L('신중', 'Cautious')], [L('계산', 'Calculating'), L('충동', 'Impulsive')]];
  const SIDE = () => ({ a: L('은하 얼라이언스', 'Galactic Alliance'), b: L('인류 제국', 'Human Empire') });
  const RULER = () => ({ a: { name: L('엘라나 오시아', 'Elana Ossia'), title: L('대통령', 'President') }, b: { name: L('콘스탄틴 볼크', 'Konstantin Volk'), title: L('총통', 'Supreme Leader') } }); // 두 통치자(시나리오 모드 prescripted 와 같게)

  const css = () => { if ($('nbCss')) return; const st = h('style'); st.id = 'nbCss'; st.textContent =
    '#nbWin{position:fixed;inset:0;z-index:9000;background:#02070c;display:flex;align-items:center;justify-content:center}'
    // 홀로그램 판(2026-11-06 사용자: 「책은 너무 짜치네 — 호로그램 보드 같은 걸로」). 그림 없이 CSS 로만: 푸른 빛 판 · 주사선 · 모서리 괄호 · 아주 약한 깜빡임
    + '#nbWin .nb-book{position:relative;width:100vw;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:16px 22px;color:#d6f3ff;font-size:13px;line-height:1.45;'
    + 'background:radial-gradient(ellipse at 50% 0%,#1d6f9a33,transparent 60%),radial-gradient(ellipse at 50% 100%,#0e3b5a40,transparent 65%),linear-gradient(180deg,#04121cf2,#061a28ee);'
    + 'border:1px solid #5fd4ff88;box-shadow:0 0 0 1px #5fd4ff22 inset,0 0 38px #2bb8ff44,0 10px 50px #000d}'
    + '#nbWin .nb-book::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,#9fe6ff0a 0 1px,transparent 1px 3px);mix-blend-mode:screen}'
    + '#nbWin .nb-book::after{content:"";position:absolute;inset:-1px;pointer-events:none;background:linear-gradient(#7fe0ff,#7fe0ff) 0 0/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 0 0/2px 26px,linear-gradient(#7fe0ff,#7fe0ff) 100% 0/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 100% 0/2px 26px,linear-gradient(#7fe0ff,#7fe0ff) 0 100%/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 0 100%/2px 26px,linear-gradient(#7fe0ff,#7fe0ff) 100% 100%/26px 2px,linear-gradient(#7fe0ff,#7fe0ff) 100% 100%/2px 26px;background-repeat:no-repeat}'
    + '@keyframes nbHolo{0%,100%{box-shadow:0 0 0 1px #5fd4ff22 inset,0 0 38px #2bb8ff44,0 10px 50px #000d}50%{box-shadow:0 0 0 1px #5fd4ff33 inset,0 0 48px #2bb8ff5a,0 10px 50px #000d}}'
    + '@media (prefers-reduced-motion: reduce){#nbWin .nb-book{animation:none}}'
    + '#nbWin .nb-top{display:flex;align-items:center;gap:12px}#nbWin h3{margin:0;font-size:18px;color:#8fe4ff;letter-spacing:.08em;text-shadow:0 0 10px #39c4ff88}#nbWin .nb-top small{opacity:.7}#nbWin .nb-top .sp{flex:1}'
    + '#nbWin button{padding:4px 10px;cursor:pointer;font-size:12.5px;background:#3fbfff14;color:#d6f3ff;border:1px solid #5fd4ff77}#nbWin button:hover{background:#3fbfff26}#nbWin button.on{background:#3fbfff44;border-color:#9fe6ff;box-shadow:0 0 8px #39c4ff55}#nbWin button:disabled{opacity:.45;cursor:default}'
    + '#nbWin .nb-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#nbWin select{background:#04121c;color:#d6f3ff;border:1px solid #5fd4ff88;font-size:12.5px}#nbWin label{font-size:12.5px;opacity:.9}'
    + '#nbWin .nb-pages{flex:1;min-height:0;display:grid;grid-template-columns:1.55fr 1fr;gap:18px}'
    + '#nbWin .nb-page{position:relative;z-index:1;min-height:0;overflow:auto;background:#03101a99;border:1px solid #5fd4ff33;padding:8px 10px}'
    + '#nbWin table{width:100%;border-collapse:collapse}#nbWin th{position:sticky;top:0;background:#062234;text-align:left;font-weight:600;color:#8fe4ff;font-size:12px;padding:5px 6px;border-bottom:1px solid #5fd4ff66}'
    + '#nbWin td{padding:4px 6px;border-bottom:1px solid #5fd4ff1c;vertical-align:middle;font-size:12.5px}#nbWin tr.row{cursor:pointer}#nbWin tr.row:hover td{background:#3fbfff14}#nbWin tr.sel td{background:#3fbfff2e}'
    + '#nbWin tr.gone td{opacity:.45;text-decoration:line-through}#nbWin td.pic img{width:30px;height:34px;object-fit:cover;border:1px solid #5fd4ff66;display:block;filter:saturate(.9) brightness(1.05)}'
    + '#nbWin .chip{display:inline-block;padding:0 6px;border-radius:8px;font-size:11.5px;color:#111;font-weight:600}#nbWin .flag{color:#e0a060;margin-left:4px}'
    + '#nbWin .nb-det .head{display:flex;gap:12px}#nbWin .nb-det .head img{width:120px;height:135px;object-fit:cover;border:1px solid #5fd4ff;box-shadow:0 0 14px #39c4ff55}#nbWin .nb-det h4{margin:10px 0 4px;color:#8fe4ff;font-size:13.5px;border-bottom:1px solid #5fd4ff44;letter-spacing:.04em}'
    + '#nbWin .tr{display:grid;grid-template-columns:70px 1fr 70px;gap:6px;align-items:center;font-size:12px;margin:2px 0}#nbWin .tr .track{position:relative;height:8px;background:#5fd4ff1c}#nbWin .tr .track i{position:absolute;top:0;bottom:0;background:#5fd4ff;box-shadow:0 0 6px #39c4ff}#nbWin .tr .track b{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#fff6}#nbWin .tr span:last-child{text-align:right}'
    + '#nbWin ul{margin:2px 0;padding-left:18px}#nbWin .none{opacity:.6}#nbWin .acts{display:flex;gap:8px;margin-top:10px}'
    // 인물 관계도(삼국지13식 — 고른 인물을 가운데, 인연을 둘레에. 누르면 그 인물로 옮겨 가며 움직임)
    + '#nbWin .nb-graph{position:relative;overflow:hidden;padding:0}#nbWin .nb-graph svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}'
    + '#nbWin .gn{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;transition:left .5s ease,top .5s ease,opacity .4s ease,transform .5s ease;z-index:2}'
    + '#nbWin .gn .ph{width:58px;height:66px;border:2px solid #5fd4ff;background:#222 center/cover no-repeat;box-shadow:0 0 10px #000a}'
    + '#nbWin .gn.c .ph{width:104px;height:118px;border-width:3px;box-shadow:0 0 22px #39c4ffaa}#nbWin .gn.r2 .ph{width:40px;height:46px;opacity:.85}#nbWin .gn.r2 span{font-size:10.5px}'
    + '#nbWin .gn span{font-size:11.5px;background:#000b;padding:0 4px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}#nbWin .gn.c span{font-size:13px;color:#8fe4ff}'
    + '#nbWin .gn.gone .ph{filter:grayscale(1);opacity:.5}#nbWin .gn.ruler .ph{border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;color:#8fe4ff;background:#062234}'
    + '#nbWin .gn:hover{z-index:5}#nbWin .gn:hover .ph{border-color:#fff}#nbWin .gn.out{opacity:0}'
    + '#nbWin .glab{font-size:10.5px;fill:#e8e4d8;paint-order:stroke;stroke:#000;stroke-width:3px}'
    // 세력판(2026-11-06 사용자: 「섀도우스·오디세이 판처럼 — 전체 화면으로」): 군주(큰 원) → 갈래 수장(틀 씌운 중간 카드) → 구성원. 처음엔 수장만 크게, 갈래를 누르면 카메라가 날아가 구성원이 펼쳐진다. 모르는 귀족은 실루엣
    + '#nbWin .nb-book.full-web{padding:0}#nbWin .nb-book.full-web .nb-top,#nbWin .nb-book.full-web .nb-bar{position:relative;z-index:8;margin:0 22px}#nbWin .nb-book.full-web .nb-top{margin-top:16px}'
    + '#nbWin .nb-book.full-web::before{z-index:9}#nbWin .nb-book.full-web .nb-pages.web{position:absolute;inset:0;display:block}'
    + '#nbWin .nb-pages.web>.nb-web{position:absolute;inset:0;border:none;padding:0}#nbWin .nb-pages.web>.nb-det{position:absolute;right:22px;top:110px;bottom:64px;width:min(420px,32vw);z-index:7;background:#03101af0;border:1px solid #5fd4ff55;box-shadow:0 0 30px #000c;transition:transform .35s ease,opacity .35s ease}'
    + '#nbWin .nb-pages.web>.nb-det.hide{transform:translateX(30px);opacity:0;pointer-events:none}#nbWin .nb-det .x{position:absolute;right:8px;top:6px;z-index:2}'
    + '#nbWin .nb-web{position:relative;overflow:hidden;padding:0;cursor:grab;background:#02070c}#nbWin .nb-web.drag{cursor:grabbing}'
    + '#nbWin .web-bg{position:absolute;inset:-20px;background:center/cover no-repeat;filter:blur(3px) brightness(.26) saturate(.85);transform:scale(1.03)}'
    + '#nbWin .web-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 35%,#000c 100%)}'
    + '#nbWin .web-dots{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(#9fe6ff1c 1px,transparent 1.5px);background-size:44px 44px}'
    + '#nbWin .web-stage{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0}#nbWin .web-stage.fly{transition:transform .85s cubic-bezier(.2,.8,.2,1)}'
    + '#nbWin .web-stage svg{position:absolute;left:-4000px;top:-4000px;width:8000px;height:8000px;overflow:visible;pointer-events:none}'
    + '#nbWin .wn{position:absolute;left:0;top:0;transition:transform .8s cubic-bezier(.2,.8,.2,1),opacity .5s ease}'
    + '#nbWin .wn.sov{width:240px;margin:-120px 0 0 -120px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;z-index:3}'
    + '#nbWin .wn.sov .disc img{width:100%;height:100%;object-fit:cover;object-position:50% 12%;border-radius:50%}#nbWin .wn.sov .disc{overflow:hidden;width:240px;height:240px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:110px;color:#bff0ff;background:radial-gradient(circle at 50% 38%,#16597c,#04121c 72%);border:3px solid #9fe6ff;box-shadow:0 0 0 10px #5fd4ff12,0 0 0 22px #5fd4ff08,0 0 80px #39c4ffaa;animation:nbSov 5s ease-in-out infinite}'
    + '#nbWin .wn.sov.b .disc{color:#ffd9a8;border-color:#ffb877;background:radial-gradient(circle at 50% 38%,#64301a,#1a0a06 72%);box-shadow:0 0 0 10px #ffb87712,0 0 0 22px #ffb87708,0 0 80px #ff8a3aaa}'
    + '#nbWin .wn.sov b{font-size:24px;letter-spacing:.14em;color:#dff7ff;text-shadow:0 0 16px #39c4ff;white-space:nowrap}#nbWin .wn.sov.b b{color:#ffe6c6;text-shadow:0 0 16px #ff8a3a}#nbWin .wn.sov small{opacity:.7;white-space:nowrap;font-size:12px}'
    + '@keyframes nbSov{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}@media (prefers-reduced-motion: reduce){#nbWin .wn.sov .disc{animation:none}}'
    + '#nbWin .wn.me{width:140px;margin:-70px 0 0 -70px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:3}#nbWin .wn.me .disc{width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:52px;color:#c9ffe6;border:2px solid #7fffc4;background:radial-gradient(#0f3a2c,#04120c 70%);box-shadow:0 0 40px #3fffb088}#nbWin .wn.me b{color:#c9ffe6;font-size:15px;white-space:nowrap}'
    + '#nbWin .wn.btitle{transform-origin:50% 50%;margin:0;z-index:2;pointer-events:none;text-align:center;white-space:nowrap;background:radial-gradient(ellipse,#02070cd9 55%,transparent 75%);padding:6px 0}#nbWin .wn.btitle b{display:block;font-size:17px;letter-spacing:.1em;color:#bff0ff;text-shadow:0 0 12px #39c4ff,0 0 3px #000}#nbWin .wn.btitle.b b{color:#ffe1bd;text-shadow:0 0 12px #ff8a3a,0 0 3px #000}#nbWin .wn.btitle span{font-size:11.5px;opacity:.7}#nbWin .btitle .fmood{font-size:11.5px;margin-top:3px}#nbWin .btitle .fmood i{font-style:normal;color:#111;font-weight:700;padding:0 6px;border-radius:8px;margin:0 2px}#nbWin .btitle .fag{font-size:11.5px;color:#cfe9f5;opacity:.85;margin-top:2px;white-space:normal}#nbWin .card.head .lead{position:absolute;left:50%;top:-24px;transform:translateX(-50%);font-size:10.5px;letter-spacing:.12em;padding:1px 8px;background:#02070ce6;border:1px solid currentColor;color:#9fe6ff;white-space:nowrap;z-index:3}#nbWin .card.head.b .lead{color:#ffcf99}'
    + '#nbWin .wn.card{width:84px;margin:-40px 0 0 -42px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font-size:11.5px;text-align:center;z-index:2}'
    + '#nbWin .card .ph{position:relative;width:70px;height:80px;border:1px solid #5fd4ffaa;background:#062234 center/cover no-repeat;box-shadow:0 0 10px #000c;transition:transform .2s}#nbWin .card.b .ph{border-color:#ffb877aa}'
    + '#nbWin .card:hover .ph{transform:scale(1.1);border-color:#fff}#nbWin .card .nm{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#02070ccc;padding:0 5px}#nbWin .card .sub{opacity:.6;font-size:10.5px}'
    + '#nbWin .wn.card.head{width:150px;margin:-92px 0 0 -75px;z-index:3}#nbWin .card.head .ph{width:132px;height:152px;border:none;box-shadow:0 0 26px #39c4ff55}#nbWin .card.head.b .ph{box-shadow:0 0 26px #ff8a3a55}'
    + '#nbWin .card.head .frame{position:absolute;left:-11px;top:-11px;width:154px;height:174px;pointer-events:none}#nbWin .card.head .nm{margin-top:14px;font-size:14px;color:#e6f9ff;max-width:150px}#nbWin .card.head.b .nm{color:#ffeedd}'
    + '#nbWin .card .lo{position:absolute;right:-5px;top:-5px;z-index:2;min-width:17px;height:17px;border-radius:9px;font-size:10.5px;line-height:17px;color:#111;font-weight:700;padding:0 3px;box-shadow:0 0 4px #000}#nbWin .card .fl{position:absolute;left:-3px;top:-6px;z-index:2;color:#ffb070;font-size:13px;text-shadow:0 0 3px #000}'
    + '#nbWin .card.love:not(.gone) .ph::before{content:"♥";position:absolute;right:3px;bottom:3px;width:16px;height:16px;border-radius:50%;background:#e0577f;color:#fff;font-size:10px;line-height:16px;text-align:center;z-index:2}' // 연애 중(2026-11-08) — 깜빡임 없음
    + '#nbWin .card.ch .ph{outline:2px solid #7fffc4;box-shadow:0 0 18px #3fffb0cc}#nbWin .card.sus .ph::after{content:"!";position:absolute;left:3px;bottom:3px;width:16px;height:16px;border-radius:50%;background:#ff5a5a;color:#fff;font-weight:700;font-size:11px;line-height:16px;text-align:center;z-index:2}'
    + '#nbWin .card.gone .ph{filter:grayscale(1) brightness(.55)}#nbWin .card.gone .ph::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(45deg,transparent 45%,#ff3a3a 45% 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#ff3a3a 45% 55%,transparent 55%)}'
    + '#nbWin .card.unk .ph{background:#071722;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}#nbWin .card.unk .ph svg{width:80%;height:85%;fill:#1f5675;opacity:.85}#nbWin .card.unk .ph i{position:absolute;top:30%;left:0;right:0;font-style:normal;font-size:26px;color:#5fd4ff88;font-weight:700}#nbWin .card.unk .nm{color:#7fa8bb}'
    + '#nbWin .card.sel .ph{outline:2px solid #fff;outline-offset:3px;box-shadow:0 0 26px #fff9}#nbWin .wn.dim{opacity:.16}#nbWin .wn.fold{pointer-events:none;opacity:.55}#nbWin .wn.fold .nm,#nbWin .wn.fold .sub,#nbWin .wn.fold .lo,#nbWin .wn.fold .fl{visibility:hidden}'
    + '#nbWin .web-ui{position:absolute;left:22px;bottom:16px;z-index:8;display:flex;gap:10px;align-items:center;font-size:11.5px;background:#02070cd9;padding:6px 12px;border:1px solid #5fd4ff33}'
    + '#nbWin .web-zoom{position:absolute;right:22px;bottom:16px;z-index:8;display:flex;gap:4px}#nbWin .web-zoom button{min-width:30px;padding:3px 6px}'
    + '#nbWin .web-hint{position:absolute;left:50%;top:100px;transform:translateX(-50%);z-index:8;font-size:12px;opacity:.75;background:#02070cb0;padding:3px 12px;pointer-events:none}'
    // 제국 세력지도(2026-11-07)
    + '#nbWin .nb-map{position:absolute;inset:0;overflow:hidden;background:#02070c;cursor:grab}#nbWin .nb-map.drag{cursor:grabbing}#nbWin .nb-map canvas{position:absolute;inset:0;width:100%;height:100%}'
    + '#nbWin .nb-map{position:absolute;inset:0;overflow:hidden;background:#010409;cursor:grab}'
    + '#nbWin .mk{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;cursor:pointer;z-index:3;transition:opacity .3s}'
    + '#nbWin .mk .hx{width:var(--ms,34px);height:calc(var(--ms,34px) * .9);padding:1.5px;background:var(--mc,#5fd4ff);clip-path:polygon(25% 2%,75% 2%,100% 50%,75% 98%,25% 98%,0 50%)}#nbWin .mk .ph{width:100%;height:100%;background:#041a2b center 15%/cover no-repeat;clip-path:polygon(25% 2%,75% 2%,100% 50%,75% 98%,25% 98%,0 50%)}'
    + '#nbWin .mk.unk .ph{display:flex;align-items:center;justify-content:center;font-weight:700;color:#7fd3ffbb;font-size:15px;font-family:monospace}#nbWin .mk.gone .ph{filter:grayscale(1) brightness(.5)}#nbWin .mk.core .hx{--ms:50px;padding:2.5px}'
    + '#nbWin .mk b{margin-top:3px;font-size:10.5px;font-weight:600;letter-spacing:.04em;color:#e2f5ff;white-space:nowrap;background:linear-gradient(90deg,#0a2c44ee,#02080fbb);border-left:2px solid var(--mc);padding:0 6px 0 5px;max-width:130px;overflow:hidden;text-overflow:ellipsis}#nbWin .mk small{font-size:9px;letter-spacing:.08em;color:#8fcbe8;white-space:nowrap;padding:0 3px;text-shadow:0 0 3px #000}'
    + '#nbWin .mk:hover{z-index:6}#nbWin .mk:hover .hx{background:#fff}#nbWin .mk.small b,#nbWin .mk.small small{display:none}#nbWin .mk.dimmed{opacity:.35}#nbWin .mk.sel .hx{background:#fff}#nbWin .mk.core small{color:#ffc27a}'
    + '#nbWin .mk.chg .hx{animation:nbChg 1.4s ease-out 3}@keyframes nbChg{50%{background:#ff9d3b}}'
    + '#nbWin .mk.rebel{--mc:#d46bff}#nbWin .mk.rebel b{color:#f2c8ff}#nbWin .mk.rebel small{color:#d9a8f0}'
    + '#nbWin .mk.cnk{--mc:#f0c25a}#nbWin .mk.cnk b{color:#ffe2a0}#nbWin .mk.cnk small{color:#e8cf98}#nbWin .mk.cnk .ph{display:flex;align-items:center;justify-content:center;color:#ffe2a0;font-size:18px}#nbWin .mk.hubk{--mc:#e8b860}#nbWin .mk.hubk .ph{font-size:20px}#nbWin .mk.pupk{--mc:#5fd6c0}#nbWin .mk.pupk b{color:#bff3e8}#nbWin .mk.pupk small{color:#9fdccf}#nbWin .mk.pupk .ph{color:#bff3e8}' // 회랑의 귀족(2026-11-08)
    // 분쟁 성계 표지(2026-11-08 사용자: 「분쟁 중인 행성이 너무 가시성 없어 — 그 행성을 눌러도 전투 상황판」): 진척 고리 + 칼 표시, 누르면 쟁탈 현황판
    + '#nbWin .ft{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;cursor:pointer;pointer-events:auto;z-index:6;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px #000a,0 0 10px #000c}'
    + '#nbWin .ft i{width:18px;height:18px;border-radius:50%;background:#06121ced;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;line-height:1;color:#ffe2c4}'
    + '#nbWin .ft.hot{box-shadow:0 0 0 2px #ff9d3b,0 0 14px #ff9d3bcc}#nbWin .ft:hover{transform:scale(1.35);z-index:7}#nbWin .ft.sm{width:18px;height:18px;margin:-9px 0 0 -9px}#nbWin .ft.sm i{width:12px;height:12px;font-size:8px}'
    + '#nbWin .ft.gk{box-shadow:0 0 0 2px #ff6b9a,0 0 12px #ff6b9acc}'
    + '#nbWin .map-feed{position:absolute;left:22px;bottom:16px;z-index:8;width:min(420px,40vw);max-height:30vh;overflow:auto;font-size:11.5px;background:linear-gradient(180deg,#05192aee,#02080fe8);border:1px solid #5fd4ff40;border-top:2px solid #5fd4ff;padding:6px 10px}#nbWin .map-feed .hd{font-family:monospace;letter-spacing:.08em;color:#7fd3ff}#nbWin .map-feed b{color:#e2f5ff}#nbWin .map-feed div{padding:1px 0;border-bottom:1px solid #5fd4ff14}#nbWin .map-feed .new{color:#ffc27a}'
    + '#nbWin .map-title{position:absolute;left:26px;top:100px;z-index:4;pointer-events:none;border-left:3px solid #5fd4ff;padding:2px 0 2px 12px;transition:opacity 1.2s}#nbWin .map-title i{display:block;font-style:normal;font-family:monospace;font-size:10px;letter-spacing:.18em;color:#5fd4ff}#nbWin .map-title b{display:block;font-size:22px;letter-spacing:.28em;color:#eaf8ff;text-shadow:0 0 14px #39c4ff88;font-weight:600}#nbWin .map-title span{font-size:11px;letter-spacing:.12em;color:#9fd6f0;opacity:.75}'
    + '#nbWin .nb-map.intro .map-title{animation:nbTitle 2.6s ease-out}@keyframes nbTitle{0%{opacity:0;transform:translateX(-14px)}10%{opacity:.6}14%{opacity:.1}22%{opacity:1}100%{opacity:1;transform:none}}'
    + '#nbWin .nb-map.intro .mk{animation:nbPop .5s ease-out both}@keyframes nbPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}40%{opacity:.8}55%{opacity:.2}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}'
    + '#nbWin .map-hud{position:absolute;right:22px;bottom:58px;z-index:5;pointer-events:none;font-family:monospace;font-size:10.5px;color:#7fd3ff;text-align:right;border-right:2px solid #5fd4ff;padding-right:9px}#nbWin .map-hud div{display:flex;gap:12px;justify-content:flex-end}#nbWin .map-hud span{opacity:.6;letter-spacing:.1em}#nbWin .map-hud b{color:#e2f5ff;font-weight:400;min-width:76px}'
    + '#nbWin .map-frame{position:absolute;inset:94px 12px 10px 12px;pointer-events:none;z-index:2}#nbWin .map-frame i{position:absolute;width:26px;height:26px;border:solid #5fd4ff88}#nbWin .map-frame i:nth-child(1){left:0;top:0;border-width:2px 0 0 2px}#nbWin .map-frame i:nth-child(2){right:0;top:0;border-width:2px 2px 0 0}#nbWin .map-frame i:nth-child(3){left:0;bottom:0;border-width:0 0 2px 2px}#nbWin .map-frame i:nth-child(4){right:0;bottom:0;border-width:0 2px 2px 0}'
    + '#nbWin .nb-pages.web>.nb-det.dossier{width:min(780px,50vw);top:100px;bottom:14px;right:14px;padding:0;background:transparent;border:none;box-shadow:none;overflow:visible}'
    + '#nbWin .dos{position:absolute;inset:0;display:flex;flex-direction:column;background:linear-gradient(180deg,#061a2bf2,#020a12f4);border:1px solid #5fd4ff55;clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,26px 100%,0 calc(100% - 26px));box-shadow:inset 0 0 60px #0a3c5c55}'
    + '#nbWin .dos::before{content:"";position:absolute;left:0;top:0;right:26px;height:3px;background:linear-gradient(90deg,#5fd4ff,#5fd4ff00)}#nbWin .dos-x{position:absolute;right:30px;top:8px;z-index:3;font-family:monospace}'
    + '#nbWin .dos-head{display:flex;gap:18px;padding:18px 22px 12px}#nbWin .dos-head.b .dos-kick{color:#ffb877}#nbWin .dos-head.b .dos-pic{border-color:#ffb877}'
    + '#nbWin .dos-pic{flex:0 0 150px;height:180px;background:#041a2b center 15%/cover no-repeat;border:2px solid #5fd4ff;clip-path:polygon(0 0,100% 0,100% calc(100% - 18px),calc(100% - 18px) 100%,0 100%);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -40px 40px #000a}#nbWin .dos-pic i{font-style:normal;font-size:54px;color:#5fd4ff88;font-family:monospace}#nbWin .dos-pic.gone{filter:grayscale(1) brightness(.55)}'
    + '#nbWin .dos-id{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}#nbWin .dos-kick{font-family:monospace;font-size:10.5px;letter-spacing:.16em;color:#5fd4ff}#nbWin .dos-name{font-size:28px;font-weight:700;letter-spacing:.04em;color:#f0faff;text-shadow:0 0 14px #39c4ff66;line-height:1.15}'
    + '#nbWin .dos-sub{font-size:12.5px;color:#9fd6f0}#nbWin .dos-loyal{display:flex;align-items:center;gap:10px;margin-top:8px}#nbWin .dos-loyal span{font-family:monospace;font-size:10.5px;letter-spacing:.14em;color:#7fd3ff}#nbWin .dos-loyal .bar{flex:1;height:10px;background:#0b2537;border:1px solid #5fd4ff44;position:relative;overflow:hidden}#nbWin .dos-loyal .bar i{position:absolute;left:0;top:0;bottom:0;box-shadow:0 0 10px currentColor}#nbWin .dos-loyal b{font-size:13px;min-width:90px;text-align:right}'
    + '#nbWin .dos-note{font-size:11px;color:#8fb8cc;opacity:.8}#nbWin .dos-empty{padding:14px 4px;color:#8fb8cc;font-size:12.5px;line-height:1.6}'
    + '#nbWin .dos-tiles{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:0 22px 12px}#nbWin .dos-tiles .tile{background:#0a2538cc;border:1px solid #5fd4ff33;border-top:2px solid #5fd4ff88;padding:6px 8px;min-width:0}#nbWin .dos-tiles .tile span{display:block;font-family:monospace;font-size:9.5px;letter-spacing:.1em;color:#7fd3ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#nbWin .dos-tiles .tile b{display:block;font-size:15px;color:#eaf8ff;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#nbWin .dos-tiles .tile.warn{border-top-color:#ff9d3b}#nbWin .dos-tiles .tile.warn b{color:#ffc27a}'
    + '#nbWin .dos-tabs{display:flex;gap:2px;padding:0 22px;border-bottom:1px solid #5fd4ff44}#nbWin .dos-tabs button{border:none;border-bottom:2px solid transparent;background:transparent;padding:8px 18px;font-family:monospace;letter-spacing:.14em;font-size:12px;color:#7fb5cc}#nbWin .dos-tabs button.on{color:#eaf8ff;border-bottom-color:#5fd4ff;background:linear-gradient(0deg,#5fd4ff22,transparent)}#nbWin .dos-tabs button:hover{color:#eaf8ff}'
    + '#nbWin .dos-body{flex:1;overflow:auto;padding:12px 22px;font-size:13px}#nbWin .dos-body h4,#nbWin .dos-sec h5{margin:12px 0 6px;font-family:monospace;font-size:11px;letter-spacing:.16em;color:#5fd4ff;border-bottom:1px solid #5fd4ff33;padding-bottom:3px;font-weight:600}#nbWin .dos-body ul{margin:4px 0;padding-left:16px}#nbWin .dos-body li{margin:3px 0}'
    + '#nbWin .dos .trait{display:grid;grid-template-columns:80px 1fr 80px;align-items:center;gap:10px;margin:5px 0}#nbWin .dos .trait span{font-size:12px;color:#8fb8cc}#nbWin .dos .trait span:last-child{text-align:right}#nbWin .dos .trait span.on{color:#eaf8ff;font-weight:600}#nbWin .dos .trait .track{height:8px;background:#0b2537;position:relative}#nbWin .dos .trait .track b{position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:#5fd4ff88}#nbWin .dos .trait .track i{position:absolute;top:0;bottom:0;background:#5fd4ff;box-shadow:0 0 8px #5fd4ff}'
    + '#nbWin .dos .rel{display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #5fd4ff14}#nbWin .dos .rel em{font-style:normal;font-size:11px;border:1px solid;padding:1px 7px;min-width:62px;text-align:center}#nbWin .dos .rel span{flex:1}#nbWin .dos .rel small{color:#8fb8cc}'
    + '#nbWin .dos .logrow{display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #5fd4ff14}#nbWin .dos .logrow span{font-family:monospace;color:#7fd3ff;font-size:11.5px;min-width:86px}#nbWin .dos .logrow b{font-weight:400}'
    + '#nbWin .dos-acts{display:flex;gap:8px;padding:12px 22px 16px;border-top:1px solid #5fd4ff33;background:linear-gradient(0deg,#5fd4ff10,transparent)}#nbWin .dos-acts button{flex:1;padding:10px 6px;font-family:monospace;letter-spacing:.12em;font-size:12px;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);background:#0b2a40;border:1px solid #5fd4ff77;color:#eaf8ff}#nbWin .dos-acts button:hover:not(:disabled){background:#145073}#nbWin .dos-acts button:disabled{opacity:.4}'
    + '#nbWin .dos-body button{font-size:11.5px;padding:2px 10px;margin-left:6px}'
    + '#nbWin .mk.pet .hx::after{content:""}#nbWin .mk.pet::before{content:"!";position:absolute;top:-6px;right:-8px;width:16px;height:16px;border-radius:50%;background:#e8c872;color:#1a1408;font:700 11px/16px sans-serif;text-align:center;z-index:2}'
    + '#nbWin .map-tip{position:absolute;z-index:9;pointer-events:none;min-width:230px;padding:7px 10px;background:#04121fee;border:1px solid #5fd4ff66;border-top:2px solid #ff9d3b;font-size:11.5px}#nbWin .map-tip b{display:block;color:#eaf8ff;margin-bottom:3px}#nbWin .map-tip .nm2{color:#9fd6f0;margin-bottom:4px}#nbWin .map-tip .sm{color:#8fb8cc;margin-top:4px;font-size:10.5px}'
    + '#nbWin .tug{position:relative;height:8px;overflow:hidden;border:1px solid #ffffff22}#nbWin .tug i{position:absolute;left:0;top:0;bottom:0}'
    + '#nbWin .frow{display:grid;grid-template-columns:18px 1fr 120px 42px 46px;align-items:center;gap:8px;padding:4px 6px;margin:2px 0;background:#0a253880;cursor:pointer;font-size:12px}#nbWin .frow:hover{background:#145073aa}#nbWin .frow .fn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#nbWin .frow small.up{color:#7fd88f}#nbWin .frow small.dn{color:#ff7a5a}'
    + '#nbWin .fb{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9600;width:min(820px,92vw);background:linear-gradient(180deg,#071c2ef8,#030b14f8);border:1px solid #5fd4ff66;box-shadow:0 0 60px #000c;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px));padding-bottom:14px}'
    + '#nbWin .fb-ban{background-size:cover,cover,cover,cover;background-position:center;min-height:200px}#nbWin .fb-head{display:flex;align-items:baseline;gap:12px;padding:12px 18px;border-bottom:1px solid #5fd4ff44;background:linear-gradient(90deg,#ff9d3b22,transparent 40%,transparent 60%,#5fd4ff22)}#nbWin .fb-head span{font-family:monospace;font-size:10.5px;letter-spacing:.16em;color:#5fd4ff}#nbWin .fb-head b{font-size:19px;letter-spacing:.06em;color:#f0faff}#nbWin .fb-x{margin-left:auto}'
    + '#nbWin .fb-top{display:grid;grid-template-columns:1fr 90px 1fr;align-items:center;padding:14px 18px 6px}#nbWin .fb-side{display:flex;gap:12px;align-items:center}#nbWin .fb-side.r{flex-direction:row-reverse;text-align:right}'
    + '#nbWin .fb-pic{width:92px;height:110px;border:2px solid;background:#041a2b center 15%/cover no-repeat;display:flex;align-items:center;justify-content:center}#nbWin .fb-pic i{font-style:normal;font-size:34px;color:#5fd4ff88;font-family:monospace}'
    + '#nbWin .fb-who small{display:block;font-family:monospace;font-size:10px;letter-spacing:.14em;color:#8fb8cc}#nbWin .fb-who b{display:block;font-size:16px;color:#eaf8ff;margin:2px 0}#nbWin .fb-who em{font-style:normal;font-size:12px}'
    + '#nbWin .fb-mid{text-align:center}#nbWin .fb-vs{font:700 26px monospace;color:#eaf8ff;text-shadow:0 0 12px #ff9d3b}#nbWin .fb-since{font-size:10.5px;color:#8fb8cc}'
    + '#nbWin .fb-tugw{padding:6px 18px}#nbWin .fb-nums{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;color:#8fb8cc}#nbWin .fb-nums b{font:700 18px monospace;color:#eaf8ff}'
    + '#nbWin .fb-tug{position:relative;height:22px;border:1px solid #ffffff33;overflow:hidden;margin-top:4px;box-shadow:inset 0 0 12px #000a}#nbWin .fb-tug i.a{position:absolute;left:0;top:0;bottom:0;transition:width .6s}'
    + '#nbWin .fb-chev{position:absolute;top:0;bottom:0;width:120px;background:repeating-linear-gradient(90deg,transparent 0 10px,#ffffff55 10px 14px,transparent 14px 22px);clip-path:polygon(0 0,100% 0,100% 100%,0 100%);opacity:.0}#nbWin .fb-chev.fwd{opacity:.7;animation:fbFwd 1.6s linear infinite}#nbWin .fb-chev.back{opacity:.7;animation:fbBack 1.6s linear infinite}@keyframes fbFwd{from{background-position:0 0}to{background-position:22px 0}}@keyframes fbBack{from{background-position:22px 0}to{background-position:0 0}}'
    + '#nbWin .fb-sub{padding:4px 18px 8px;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;align-items:center}#nbWin .fb-mom{font-size:13px;color:#ffc27a}#nbWin .fb-infl{font-size:11.5px;color:#9fd6f0;text-align:right}#nbWin .fb-inf{grid-column:1/3;position:relative;height:6px;overflow:hidden}#nbWin .fb-inf i{position:absolute;left:0;top:0;bottom:0}'
    + '#nbWin .fb-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:4px 18px}#nbWin .fb-list h6{margin:6px 0;font-family:monospace;font-size:10.5px;letter-spacing:.14em;color:#5fd4ff;font-weight:600}#nbWin .fb-row{display:flex;justify-content:space-between;padding:5px 8px;margin:3px 0;background:#0a2538cc;border-left:3px solid;font-size:12px}#nbWin .fb-row b{font-family:monospace;color:#eaf8ff}'
    + '#nbWin .fb-acts{display:flex;gap:8px;padding:10px 18px 0}#nbWin .fb-acts button{flex:1;padding:8px;font-family:monospace;font-size:11.5px;letter-spacing:.08em}'
    + '#nbWin .map-sfx{position:absolute;right:22px;bottom:16px;z-index:8;min-width:34px}'
    + '#nbWin .map-live{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;opacity:.85}#nbWin .map-live i{width:8px;height:8px;border-radius:50%;background:#7fd88f;box-shadow:0 0 6px #7fd88f;animation:nbLive 1.6s infinite}@keyframes nbLive{50%{opacity:.3}}'
    + '#nbWin .legend{position:absolute;left:8px;bottom:6px;display:flex;gap:10px;font-size:11px;z-index:3;background:#000a;padding:3px 8px}#nbWin .legend i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:4px}';
    document.head.append(st); };

  // 영구 사망(2026-11-08): 몰락(영지만 잃음)과 사망(처형·암살·반란 실패·정복·거점 함락)을 나눠 보인다 — 앱이 dom.dead 에 까닭을 준다
  const markDead = (x) => { try { const dd = x && x.dom && x.dom.dead; if (dd) for (const n of x.nobles || []) if (dd[n.id]) { n.fate = '\u2020 ' + dd[n.id]; n.dead = true; n.gone = true; } } catch (e) { /* 덤 */ } return x; };
  let D = null, side = 'a', sel = null, sortBy = 'loyal', onlyBorder = false, onlyTies = false, mode = 'map'; // 첫 화면 = 제국 세력지도(2026-11-07)
  const KIND_COL = { oath: '#e0c48a', union: '#ff8fb8', accord: '#7fd88f', rival: '#ff5a5a', back: '#9ab0ff' };
  const PACT_COL = { nap: '#b8c2cc', ally: '#6fd3ff', feud: '#ff4f4f' }; // 귀족 협약(2026-11-07)
  const PACT_NAME = () => ({ nap: L('불가침', 'Non-aggression'), ally: L('동맹', 'Alliance'), feud: L('원한', 'Feud') });
  const opName = (v) => (v >= 60 ? L('각별함', 'Devoted') : v >= 20 ? L('우호', 'Friendly') : v > -20 ? L('무덤덤', 'Indifferent') : v > -50 ? L('불편함', 'Strained') : L('적대', 'Hostile'));
  const stageChip = (n) => { const c = h('span', 'chip', n.stageName + (n.loyal !== undefined ? ` ${n.loyal}` : '')); c.style.background = STAGE_COL[n.stage] || '#aaa'; return c; };
  const tiesOf = (id) => (D.bonds || []).filter((b) => b.a === id || b.b === id);
  const byId = (id) => D.nobles.find((n) => n.id === id);
  const topTraits = (n) => n.tr.map((v, i) => ({ v, i })).filter((x) => x.v).sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, 2).map((x) => TRAITS()[x.i][x.v > 0 ? 0 : 1]).join(', ') || L('무난함', 'Balanced');

  function table(box) {
    const t = h('table'), hr = h('tr');
    for (const c of ['', L('귀족', 'Noble'), L('섹터', 'Sector'), L('성격', 'Personality'), L('충성', 'Loyalty'), L('자기 군주와', 'To own ruler'), L('나와', 'To me'), L('알려진 인연', 'Known ties')]) hr.append(h('th', '', c));
    t.append(hr);
    let list = D.nobles.filter((n) => n.side === side && (!onlyBorder || n.border) && (!onlyTies || tiesOf(n.id).length));
    if (sortBy === 'loyal') list.sort((x, y) => (y.stage - x.stage) || ((x.loyal ?? 101) - (y.loyal ?? 101)) || (x.id - y.id));
    else if (sortBy === 'name') list.sort((x, y) => x.name.localeCompare(y.name));
    else list.sort((x, y) => x.id - y.id);
    for (const n of list) {
      const tr = h('tr', 'row' + (n.id === sel ? ' sel' : '') + (n.gone ? ' gone' : ''));
      const pic = h('td', 'pic'), img = h('img'); img.src = n.pic; img.alt = ''; img.onerror = () => { img.remove(); }; pic.append(img);
      const nm = h('td', '', n.name); if (n.border) nm.append(h('span', 'flag', '⚑'));
      const lo = h('td'); if (n.fate) lo.append(h('span', '', n.fate)); else lo.append(stageChip(n));
      const ties = tiesOf(n.id).map((b) => `${b.name}: ${byId(b.a === n.id ? b.b : b.a)?.name ?? '?'}`);
      tr.append(pic, nm, h('td', '', `${n.id} · ${SPEC()[n.spec] || n.spec}`), h('td', '', topTraits(n)), lo, h('td', '', n.ruler), h('td', '', n.me), h('td', '', ties.join(' · ') || '—'));
      tr.onclick = () => { sel = n.id; render(); };
      t.append(tr);
    }
    if (!list.length) { const r = h('tr'), c = h('td', 'none', L('조건에 맞는 귀족이 없습니다.', 'No nobles match.')); c.colSpan = 8; r.append(c); t.append(r); }
    box.append(t);
  }

  // ---- 세력판(전체 화면 지도판) ----
  // 2026-11-06 사용자: 「섀도우스·오디세이 판처럼, 전체 화면으로」 — 군주(큰 원) → 갈래 수장(틀 씌운 카드) → 구성원(작은 카드).
  // 처음엔 군주와 수장만 또렷하고 구성원은 수장 곁에 접혀 있다. 수장을 누르면 카메라가 그 갈래로 날아가 구성원이 펼쳐진다.
  let group = 'region', view = 'one', focus = null; // 갈래: region 지역 · spec 특화 · bond 인연 무리 / 보기: one · both / focus: 펼친 갈래 키
  const ART = 'assets/scenario/corridor/';
  const regionOf = (n) => n.fac || (n.border ? 'border' : (n.t || 2) <= 1 ? 'core' : 'inner');
  const facOf = (sd, k) => (D.factions || []).find((f) => f.side === sd && f.key === k) || null; // 대세력(2026-11-06): 앱이 이름·대표·분위기·영향력·요구를 준다
  const REGION_NAME = (sd) => (sd === 'b'
    ? { core: L('옥좌의 측근', 'The Throne’s Inner Circle'), inner: L('제국 심장부의 영주들', 'Lords of the Imperial Heart'), border: L('철문 변경백', 'Margraves of the Iron Gate') }
    : { core: L('성좌 원로회', 'Council of the Constellation'), inner: L('중원 가문', 'Houses of the Midlands'), border: L('변경 수호가', 'Wardens of the Marches') });
  const REGION_SUB = () => ({ core: L('수도권', 'Capital'), inner: L('내지', 'Heartland'), border: L('국경', 'Frontier') });
  /** 갈래 나누기: [{ key, name, sub, list, head }] — 수장은 군주와 가장 가까운(친밀도 높은) 남아 있는 귀족. */
  function groupsOf(sd) {
    const mine = D.nobles.filter((n) => n.side === sd), out = new Map();
    const add = (k, n) => { if (!out.has(k)) out.set(k, { key: k, list: [] }); out.get(k).list.push(n); };
    if (group === 'region') { for (const k of ['core', 'inner', 'border']) out.set(k, { key: k, list: [] }); for (const n of mine) out.get(regionOf(n)).list.push(n); }
    else if (group === 'spec') { for (const n of mine) add(n.spec, n); }
    else {
      const par = new Map(mine.map((n) => [n.id, n.id])), find = (x) => { while (par.get(x) !== x) x = par.get(x); return x; };
      for (const b of D.bonds || []) if (['oath', 'union', 'accord'].includes(b.kind) && par.has(b.a) && par.has(b.b)) par.set(find(b.a), find(b.b));
      const comp = new Map(); for (const n of mine) { const r = find(n.id); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(n); }
      let i = 0; for (const list of [...comp.values()].sort((x, y) => y.length - x.length)) { if (list.length > 1) { i++; for (const n of list) add('g' + i, n); } else add('solo', list[0]); }
    }
    const gs = [...out.values()].filter((g) => g.list.length);
    for (const g of gs) {
      g.list.sort((x, y) => (Number(!!x.gone) - Number(!!y.gone)) || ((y.rr ?? 0) - (x.rr ?? 0)) || (x.id - y.id));
      const fac = group === 'region' ? facOf(sd, g.key) : null;
      if (fac && fac.leader !== null) { const i = g.list.findIndex((n) => n.id === fac.leader); if (i > 0) g.list.unshift(g.list.splice(i, 1)[0]); } // 대세력은 정해진 대표가 수장
      g.fac = fac; g.head = g.list[0];
      const sp = SPEC()[g.key] || g.key, hn = g.head.name;
      if (group === 'region') { g.name = fac ? fac.name : REGION_NAME(sd)[g.key]; g.sub = fac ? `${fac.stance} · ${fac.region}` : REGION_SUB()[g.key]; }
      else if (group === 'spec') { g.name = sd === 'b' ? L(`${sp} 장원`, `The ${sp} Demesne`) : L(`${sp} 연합`, `The ${sp} Union`); g.sub = sp; }
      else if (g.key === 'solo') { g.name = L('홀로 선 가문', 'Unaligned Houses'); g.sub = L('알려진 인연 없음', 'No known ties'); }
      else { g.name = L(`${hn} 가문 무리`, `Circle of ${hn}`); g.sub = L('서약·혼약·협약으로 이어짐', 'Bound by oath, union or accord'); }
      g.fk = sd + ':' + g.key;
    }
    return gs;
  }
  /** 자리: 군주를 가운데, 수장을 둘레(원)에, 구성원은 수장 바깥쪽으로 고리 지어 펼친다. 접힌 자리는 수장 곁으로 오므린 자리. */
  function webLayout(sd, cx, cy, spread) {
    const gs = groupsOf(sd), pos = new Map(), hubs = [];
    const R1 = 520 + gs.length * 30;
    gs.forEach((g, gi) => {
      const a0 = spread[0] + (spread[1] - spread[0]) * ((gi + 0.5) / gs.length), hx = cx + Math.cos(a0) * R1, hy = cy + Math.sin(a0) * R1;
      const tx = hx - Math.cos(a0) * 190, ty = hy - Math.sin(a0) * 190; // 갈래 이름은 수장과 군주 사이
      hubs.push({ g, sd, x: hx, y: hy, tx, ty, a0 });
      const rest = g.list.slice(1); let i = 0, ring = 0;
      while (i < rest.length) {
        const rad = 230 + ring * 160, fanMax = Math.PI * 1.15, cap = Math.max(1, Math.floor((fanMax * rad) / 135)), cnt = Math.min(cap, rest.length - i);
        const fan = cnt === 1 ? 0 : Math.min(fanMax, ((cnt - 1) * 135) / rad);
        for (let k = 0; k < cnt; k++, i++) {
          const a = a0 + (cnt === 1 ? 0 : -fan / 2 + fan * (k / (cnt - 1))), x = hx + Math.cos(a) * rad, y = hy + Math.sin(a) * rad;
          pos.set(rest[i].id, { x, y, fx: hx + Math.cos(a) * (118 + ring * 16), fy: hy + Math.sin(a) * (118 + ring * 16), fk: g.fk, hub: hubs[hubs.length - 1] });
        }
        ring++;
      }
    });
    return { pos, hubs };
  }
  let DRAG = null, dragHooked = false;
  let W = null; // { box, stage, svg, els, at, tx, ty, k, hubs, pos, key, moved }
  let DET = null; // 세력판일 때 오른쪽 상세 패널
  function svgEl(tag, attrs) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; }
  const isOpen = (fk) => focus === fk;
  function drawLines(hoverId) {
    if (!W) return; const g = W.svg; g.textContent = ''; const O = 4000;
    const p = (key) => W.at.get(key);
    for (const hb of W.hubs) {
      const s0 = p('sov-' + hb.sd), hk = p('n' + hb.g.head.id); if (!s0 || !hk) continue;
      const col = hb.sd === 'b' ? '#ffb877' : '#5fd4ff', open = isOpen(hb.g.fk), dimmed = focus && !open;
      g.append(svgEl('line', { x1: s0.x + O, y1: s0.y + O, x2: hk.x + O, y2: hk.y + O, stroke: col, 'stroke-width': open ? '3' : '2', 'stroke-opacity': dimmed ? '.18' : '.6' }));
      if (open) for (const m of hb.g.list.slice(1)) { const q = p('n' + m.id); if (q) g.append(svgEl('line', { x1: hk.x + O, y1: hk.y + O, x2: q.x + O, y2: q.y + O, stroke: col, 'stroke-width': '1.2', 'stroke-opacity': m.gone ? '.15' : '.4' })); }
    }
    // 진영을 넘는 비밀 회선은 양쪽 보기에서 늘 보이고, 마우스를 올리면 그 귀족의 알려진 인연이 보인다
    const ties = (D.bonds || []).filter((b) => hoverId !== null ? (b.a === hoverId || b.b === hoverId) : (view === 'both' && b.kind === 'back'));
    for (const b of ties) {
      const x = p('n' + b.a), y = p('n' + b.b); if (!x || !y) continue;
      const mx = (x.x + y.x) / 2, my = (x.y + y.y) / 2 - (b.kind === 'back' ? 140 : 30);
      g.append(svgEl('path', { d: `M${x.x + O},${x.y + O} Q${mx + O},${my + O} ${y.x + O},${y.y + O}`, fill: 'none', stroke: KIND_COL[b.kind] || '#9fe6ff', 'stroke-width': hoverId !== null ? '3' : '2', 'stroke-dasharray': b.kind === 'rival' ? '7 5' : b.kind === 'back' ? '2 5' : '', 'stroke-opacity': '.95' }));
    }
    // 귀족 협약(영역다툼·귀족 외교, 2026-11-07): 불가침 회색 실선 · 동맹 하늘색 굵은 선 · 원한 붉은 점선. 마우스를 올린 귀족, 또는 펼친 갈래 귀족의 것만.
    const open = focus ? W.hubs.find((hb) => isOpen(hb.g.fk)) : null, inOpen = open ? new Set(open.g.list.map((m) => m.id)) : null;
    // 드러난 반란 밀약(2단계): 약속한 귀족 → 주모자, 주황 점선
    for (const pl of (D.dom && D.dom.plots) || []) for (const q of pl.pledges) {
      if (hoverId !== null ? !(q.who === hoverId || pl.lead === hoverId) : !(inOpen && (inOpen.has(q.who) || inOpen.has(pl.lead)))) continue;
      const x = p('n' + q.who), y = p('n' + pl.lead); if (!x || !y) continue;
      g.append(svgEl('line', { x1: x.x + O, y1: x.y + O, x2: y.x + O, y2: y.y + O, stroke: '#ff9d3b', 'stroke-width': '2.5', 'stroke-dasharray': '8 5', 'stroke-opacity': '.95' }));
    }
    for (const pc of (D.dom && D.dom.pacts) || []) {
      if (hoverId !== null ? !(pc.a === hoverId || pc.b === hoverId) : !(inOpen && (inOpen.has(pc.a) || inOpen.has(pc.b)))) continue;
      const x = p('n' + pc.a), y = p('n' + pc.b); if (!x || !y) continue;
      const mx = (x.x + y.x) / 2, my = (x.y + y.y) / 2 + 40;
      g.append(svgEl('path', { d: `M${x.x + O},${x.y + O} Q${mx + O},${my + O} ${y.x + O},${y.y + O}`, fill: 'none', stroke: PACT_COL[pc.k] || '#ccc', 'stroke-width': pc.k === 'ally' ? '3.5' : '2', 'stroke-dasharray': pc.k === 'feud' ? '3 5' : '', 'stroke-opacity': '.85' }));
    }
  }
  function applyView(fly) {
    if (!W) return; const st = W.stage;
    if (fly) { st.classList.add('fly'); clearTimeout(W.flyT); W.flyT = setTimeout(() => st.classList.remove('fly'), 900); }
    st.style.transform = `translate(${W.tx}px,${W.ty}px) scale(${W.k})`;
  }
  /** 화면에 맞추기: 펼친 갈래가 있으면 그 갈래(군주 쪽 포함 안 함)에, 없으면 전체에. */
  function fit(fly) {
    if (!W) return; const r = W.box.getBoundingClientRect(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const inc = (v, pad) => { x0 = Math.min(x0, v.x - pad); y0 = Math.min(y0, v.y - pad); x1 = Math.max(x1, v.x + pad); y1 = Math.max(y1, v.y + pad); };
    if (focus) {
      const hb = W.hubs.find((x) => x.g.fk === focus);
      if (hb) { inc({ x: hb.x, y: hb.y }, 120); inc({ x: hb.tx, y: hb.ty }, 120); for (const m of hb.g.list.slice(1)) { const q = W.pos.get(m.id); if (q) inc(q, 80); } }
    } else for (const [key, v] of W.target) { if (key.startsWith('fold')) inc(v, 50); else if (key.startsWith('sov')) inc({ x: v.x, y: v.y + 40 }, 170); else if (key.startsWith('n')) inc({ x: v.x, y: v.y + 25 }, 125); else inc(v, 90); }
    const detW = sel !== null ? Math.min(440, r.width * 0.33) : 0, topH = 110, botH = 60, aw = r.width - detW - 40, ah = r.height - topH - botH;
    const k = Math.min(focus ? 1.25 : 1, Math.max(0.2, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
    W.k = k; W.tx = 20 + aw / 2 - ((x0 + x1) / 2) * k; W.ty = topH + ah / 2 - ((y0 + y1) / 2) * k; applyView(fly);
  }
  /** 펼침·접힘에 맞춰 카드 자리와 모양을 바꾼다(다시 만들지 않음). */
  function arrange(fly) {
    if (!W) return;
    for (const hb of W.hubs) {
      const open = isOpen(hb.g.fk), dimmed = !!focus && !open;
      const he = W.els.get('n' + hb.g.head.id); if (he) he.classList.toggle('dim', dimmed);
      const te = W.els.get('t-' + hb.g.fk); if (te) te.classList.toggle('dim', dimmed);
      for (const m of hb.g.list.slice(1)) {
        const el = W.els.get('n' + m.id), q = W.pos.get(m.id); if (!el || !q) continue;
        const x = open ? q.x : q.fx, y = open ? q.y : q.fy, sc = open ? 1 : 0.42;
        el.style.transform = `translate(${x}px,${y}px) scale(${sc})`; el.classList.toggle('fold', !open); el.classList.toggle('dim', dimmed);
        W.at.set('n' + m.id, { x, y });
      }
    }
    for (const [key, el] of W.els) if (key.startsWith('sov-') || key === 'me') el.classList.toggle('dim', !!focus);
    drawLines(null);
    const hint = W.box.querySelector('.web-hint');
    if (hint) hint.textContent = focus ? L('빈 곳을 누르거나 Esc — 전체 보기 · 카드를 누르면 자세히', 'Click empty space or press Esc for the overview · click a card for details') : L('갈래 수장을 누르면 그 갈래로 들어갑니다 · 끌어서 이동, 휠로 확대', 'Click a branch head to zoom in · drag to pan, wheel to zoom');
    fit(fly);
  }
  function setFocus(fk) { focus = fk; arrange(true); }
  function hover(id, on) {
    if (!W) return; const keep = new Set();
    if (on) { keep.add('n' + id); for (const b of tiesOf(id)) keep.add('n' + (b.a === id ? b.b : b.a)); }
    for (const [key, el] of W.els) if (key.startsWith('n')) el.style.opacity = on && !keep.has(key) && !el.classList.contains('fold') ? '.25' : '';
    drawLines(on ? id : null);
  }
  const SIL = '<svg viewBox="0 0 60 70"><circle cx="30" cy="22" r="13"/><path d="M4 70c2-18 12-27 26-27s24 9 26 27z"/></svg>';
  function webCard(n, head) {
    const unk = !head && !n.seen && !n.gone;
    const c = h('div', 'wn card ' + n.side + (head ? ' head' : '') + (n.id === sel ? ' sel' : '') + (n.ch ? ' ch' : '') + (n.sus ? ' sus' : '') + (n.love ? ' love' : '') + (n.gone ? ' gone' : '') + (unk ? ' unk' : ''));
    const ph = h('div', 'ph');
    if (unk) { ph.innerHTML = SIL; ph.append(h('i', '', '?')); }
    else {
      ph.style.backgroundImage = `url("${n.pic}")`;
      if (!n.gone && !n.fate) { const lo = h('span', 'lo', n.loyal !== undefined ? String(n.loyal) : '?'); lo.style.background = STAGE_COL[n.stage] || '#aaa'; ph.append(lo); }
      if (n.border) ph.append(h('span', 'fl', '⚑'));
    }
    if (head && n.lead) { const f0 = (D.factions || []).find((f) => f.leader === n.id); ph.append(h('span', 'lead', f0 && f0.acting ? L('대표 대행', 'ACTING LEADER') : L('세력 대표', 'FACTION LEADER'))); }
    if (head) { const f = h('img', 'frame'); f.src = ART + (n.side === 'b' ? 'frame_b.png' : 'frame_a.png'); f.alt = ''; f.onerror = () => f.remove(); ph.append(f); }
    c.append(ph, h('div', 'nm', unk ? '???' : n.name), h('div', 'sub', unk ? L('정체 미상', 'Unknown') : n.fate ? n.fate : `${n.id} · ${SPEC()[n.spec] || n.spec}`));
    c.title = unk ? L('아직 모르는 귀족 — 접견에서의 소개·첩보·인연으로 드러납니다', 'Not yet known — revealed through introductions, espionage or ties') : [n.name, n.stageName, n.ch ? L('밀사 통로 열림', 'Envoy channel open') : '', n.sus ? L('군주의 의심을 받는 중', 'Under suspicion') : '', n.love ? L('통치자와 연애 중', 'In a romance with you') : ''].filter(Boolean).join(' · ');
    c.addEventListener('click', (e) => {
      if (W && W.moved) return; e.stopPropagation();
      const fk = c.dataset.fk;
      if (head && fk && !isOpen(fk)) { setFocus(fk); return; }
      pick(n.id);
    });
    c.onmouseenter = () => { if (!unk) hover(n.id, true); }; c.onmouseleave = () => hover(n.id, false);
    return c;
  }
  /** 세력판에서 귀족 고르기: 판은 그대로 두고 카드 표시와 상세 패널만 바꾼다. */
  function pick(id) {
    sel = id;
    if (mode === 'map' && MAP && DET) { DET.textContent = ''; DET.classList.toggle('hide', id === null); detail(DET); MAP.mark(); if (MAP.focus) MAP.focus(id); return; }
    if (mode !== 'board' || !W || !DET) { render(); return; }
    for (const [key, el] of W.els) if (key.startsWith('n')) el.classList.toggle('sel', key === 'n' + id);
    const was = DET.classList.contains('hide'); DET.textContent = ''; DET.classList.toggle('hide', id === null); detail(DET);
    if (was !== (id === null)) fit(true); // 상세 패널이 열리고 닫힐 때 판이 가려지지 않게 다시 맞춘다
  }
  // ---- 제국 세력지도(2026-11-07) ----
  // 자료: window.sllm.scnMap()(src/features/scenario-map-app.ts — 처음 배치 + 세이브의 땅 주인, 섹터 = 앱 섹터). 귀족 얼굴·안개·충성은 D(scnNobles)에서.
  let MAP = null, mapColor = 'domain';
  const SIDE_HUE = { a: 215, b: 2, p: 42 };
  function mapBar() {
    const out = [];
    for (const [k, t] of [['domain', L('영지별', 'By domain')], ['loyal', L('충성도', 'Loyalty')], ['fac', L('세력 갈래', 'Faction')], ['bloc', L('동맹 블록', 'Alliance blocs')]]) { const b = h('button', mapColor === k ? 'on' : '', t); b.onclick = () => { mapColor = k; if (MAP) { MAP.recolor(); for (const x of b.parentNode.querySelectorAll('.mc')) x.classList.toggle('on', x === b); } }; b.classList.add('mc'); out.push(b); }
    const live = h('span', 'map-live'); live.append(h('i'), document.createTextNode(L('실시간 관측', 'Live watch'))); live.title = L('열어 둔 동안 15초마다 다시 읽습니다. 땅 주인은 게임이 저장(자동 저장)할 때마다 바뀝니다.', 'Re-reads every 15 seconds while open. Ownership updates whenever the game saves (autosave).'); out.push(live);
    return out;
  }
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
  const ATLAS_SFX = UISND('sllmAtlasSfx'); // 세력지도: 열기·마우스 올림·고르기·변화 경보(배경음 없음)

  function mapView(box) {
    hookEsc();
    box.classList.add('nb-map'); box.textContent = '';
    const cv = h('canvas'), layer = h('div'), feed = h('div', 'map-feed'), title = h('div', 'map-title'), hud = h('div', 'map-hud'), frameEl = h('div', 'map-frame'), sfx = h('button', 'map-sfx', ATLAS_SFX.on ? '\u{1F50A}' : '\u{1F507}');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    title.append(h('i', '', '// IMPERIAL ATLAS'), h('b', '', L('제국 세력지도', 'MAP OF IMPERIAL POWER')), h('span', '', L('보이지 않는 선 — 귀족들이 실제로 쥔 땅', 'The invisible lines — the land the nobles truly hold')));
    for (let i = 0; i < 4; i++) frameEl.append(h('i'));
    sfx.title = L('소리 켜기/끄기', 'Sound on/off'); sfx.onclick = (e) => { e.stopPropagation(); sfx.textContent = ATLAS_SFX.toggle() ? '\u{1F50A}' : '\u{1F507}'; };
    box.append(cv, frameEl, layer, title, hud, feed, sfx);
    const M = { data: null, view: { cx: 0, cy: 0, k: 1 }, els: new Map(), prev: null, log: [], flash: new Map(), timer: 0, alive: true, stat: null, statKey: '', intro: 0, hover: null, cur: null };
    MAP = M;
    const ART_SPAN = 1137.8; // 은하 빛 그림: 지도 0,0 중심, 한 변 1137.8 단위
    let artT = null; const art = new Image(); art.src = 'assets/scenario/corridor/atlas_glow.jpg';
    art.onload = () => { // 홀로그램처럼 푸르게 물들인 사본을 한 번만 만든다(옛 붉은/푸른 빛은 살짝 남김)
      const c = document.createElement('canvas'); c.width = art.naturalWidth; c.height = art.naturalHeight; const g = c.getContext('2d'); g.drawImage(art, 0, 0); g.globalCompositeOperation = 'color'; g.fillStyle = 'rgba(70,170,255,.55)'; g.fillRect(0, 0, c.width, c.height); artT = c; M.statKey = '';
    };
    const W = (s) => ({ x: -s.x, y: s.y });
    const nobleOf = (sc) => (sc.nb !== undefined ? byId(sc.nb) : null);
    const secHue = (sc) => (SIDE_HUE[sc.side] ?? 190) + ((sc.i * 37) % 50) - 25;
    // 우리 나라 부르는 이름(2026-11-08 사용자: 「OO 직할」·「OO의 귀족」) — 지도 자료의 realm, 없으면 「회랑」
    const RW = (k) => { const r = (M.data && M.data.realm) || (CN_REALM || null); return (r && r[k]) || ({ name: L('회랑', 'the Corridor'), rule: L('회랑 직할', 'Corridor rule'), nobles: L('회랑의 귀족', 'Corridor nobles'), noble: L('회랑의 귀족', 'Corridor noble'), subject: L('회랑의 속국', 'Corridor subject') })[k] || ''; };
    const secColor = (sc, a = 1) => {
      if (sc.pup) return `hsla(168, 58%, 54%, ${a})`; // 회랑의 괴뢰국(2026-11-08): 청록
      if (sc.rebel) return `hsla(292, 72%, 62%, ${a})`; // 반란국 땅(2026-11-08): 어느 색 기준이든 보랏빛 제3세력
      const n = nobleOf(sc);
      if (mapColor === 'loyal' && n) { const c = STAGE_COL[n.fate ? 4 : n.stage] || '#aaa'; return a === 1 ? c : c + Math.round(a * 255).toString(16).padStart(2, '0'); }
      if (mapColor === 'bloc' && n) { // 동맹으로 이어진 귀족은 같은 색, 혼자인 귀족은 흐린 회색(2026-11-07)
        const bl = M.data && M.data.dom && M.data.dom.blocs ? M.data.dom.blocs[n.id] : undefined;
        if (bl === undefined) return `hsla(${SIDE_HUE[sc.side] ?? 190}, 12%, 52%, ${a})`;
        return `hsla(${(bl * 47) % 360}, 72%, 60%, ${a})`;
      }
      if (mapColor === 'fac' && n && n.fac) { const fh = { core: 0, inner: 1, border: 2 }[n.fac] ?? 0; return `hsla(${(SIDE_HUE[sc.side] ?? 190) + (fh - 1) * 38}, 70%, ${55 - fh * 5}%, ${a})`; }
      return `hsla(${secHue(sc)}, ${sc.core ? 75 : 55}%, ${sc.core ? 64 : 58}%, ${a})`;
    };
    const rect = () => box.getBoundingClientRect();
    const toScr = (p, r) => ({ x: (p.x - M.view.cx) * M.view.k + r.width / 2, y: (p.y - M.view.cy) * M.view.k + r.height / 2 });
    function fitView() {
      const S = M.data.systems, r = rect();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const s of S) { const p = W(s); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 + 12, k: Math.min((r.width - 120) / (x1 - x0 || 1), (r.height - 240) / (y1 - y0 || 1)) * 0.95 };
    }
    /** 스텔라리스식 영역(2026-11-07 사용자: 「스텔라리스 영역 그리는 느낌으로」):
     *  성계마다 반지름 TR 안의 칸을 가장 가까운 성계의 영지로 칠하고(보로노이), 모서리를 다듬은 뒤
     *  경계 칸은 밝은 선, 안쪽은 경계에서 멀어질수록 옅어지는 색으로 한 장의 그림을 만든다. 자료·색 기준·선택이 바뀔 때만 다시 만든다. */
    const TR = 30, CELL = 0.6;
    const rgbOf = (() => { const c = document.createElement('canvas').getContext('2d'); return (css) => { c.fillStyle = '#000'; c.fillStyle = css; const v = c.fillStyle; if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; }; })();
    function terrain() {
      const t0 = performance.now();
      const key = `${M.ver}|${mapColor}|${sel}|${mapColor === 'bloc' && M.data.dom ? JSON.stringify(M.data.dom.blocs) : ''}`; if (M.terr && M.terrKey === key) return M.terr; M.terrKey = key;
      const D2 = M.data, secs = D2.sectors, idx = new Map(secs.map((sc, k) => [sc.i, k]));
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const s of D2.systems) { const p = W(s); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      x0 -= TR + 2; y0 -= TR + 2; x1 += TR + 2; y1 += TR + 2;
      const nx = Math.ceil((x1 - x0) / CELL), ny = Math.ceil((y1 - y0) / CELL), N = nx * ny;
      // 밀도장(성계마다 가우스 얼룩을 더함) → 문턱을 넘는 칸만 영지 안. 덕분에 바깥 경계가 둥글고 매끈하며 안쪽 구멍이 메워진다.
      // 칸의 주인은 가장 가까운 영지 성계(그래서 영지끼리의 경계는 곧은 선).
      let lab = new Int16Array(N).fill(-1); const best = new Float32Array(N).fill(1e9), den = new Float32Array(N), rc = Math.ceil(TR / CELL), S2 = 2 * (TR / 2.6) ** 2;
      for (const s of D2.systems) {
        if (!(s.s >= 0 && idx.has(s.s))) continue; const p = W(s), L0 = idx.get(s.s);
        const cx = Math.floor((p.x - x0) / CELL), cy = Math.floor((p.y - y0) / CELL);
        for (let j = Math.max(0, cy - rc); j <= Math.min(ny - 1, cy + rc); j++) for (let i = Math.max(0, cx - rc); i <= Math.min(nx - 1, cx + rc); i++) {
          const dx = x0 + (i + 0.5) * CELL - p.x, dy = y0 + (j + 0.5) * CELL - p.y, d = dx * dx + dy * dy; if (d > TR * TR) continue; const k = j * nx + i; den[k] += Math.exp(-d / S2); if (d < best[k]) { best[k] = d; lab[k] = L0; }
        }
      }
      for (let k = 0; k < N; k++) if (den[k] < 0.42) lab[k] = -1;
      // 경계 칸 찾기 + 경계에서의 거리
      const dist = new Uint8Array(N).fill(255), edge = new Uint8Array(N), q = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, v = lab[k]; if (v < 0) continue; let e = 0;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; const u = x < 0 || y < 0 || x >= nx || y >= ny ? -1 : lab[y * nx + x]; if (u !== v) { e = u < 0 ? 2 : Math.max(e, 1); if (u < 0) break; } }
        if (e) { edge[k] = e; dist[k] = 0; q.push(k); }
      }
      for (let h0 = 0; h0 < q.length; h0++) { const k = q[h0], i = k % nx, j = (k - i) / nx, d = dist[k]; if (d >= 14) continue; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= nx || y >= ny) continue; const m = y * nx + x; if (lab[m] !== lab[k] || dist[m] <= d + 1) continue; dist[m] = d + 1; q.push(m); } }
      const selK = sel !== null ? secs.findIndex((x) => x.nb === sel) : -1;
      const cols = secs.map((sc) => rgbOf(secColor(sc, 1)));
      const cv2 = document.createElement('canvas'); cv2.width = nx; cv2.height = ny; const g2 = cv2.getContext('2d'), im = g2.createImageData(nx, ny), px = im.data;
      for (let k = 0; k < N; k++) {
        const v = lab[k]; if (v < 0) continue; const [r0, g0, b0] = cols[v]; let a, w = 0;
        if (edge[k] === 2) { a = 240; w = 0.45; } else if (edge[k] === 1) { a = 200; w = 0.2; } else { const d = dist[k]; a = d === 1 ? 130 : 26 + 80 * Math.max(0, 1 - d / 14); }
        if (selK >= 0) a = v === selK ? Math.min(255, a * 1.35 + 20) : a * 0.32;
        px[k * 4] = r0 + (255 - r0) * w; px[k * 4 + 1] = g0 + (255 - g0) * w; px[k * 4 + 2] = b0 + (255 - b0) * w; px[k * 4 + 3] = a;
      }
      g2.putImageData(im, 0, 0);
      M.terr = { cv: cv2, x0, y0, w: nx * CELL, h: ny * CELL }; M.terrMs = Math.round(performance.now() - t0);
      return M.terr;
    }
    const RINGS = [120, 240, 360, 480, 600];
    /** 시점이 바뀔 때만 다시 그리는 겹: 은하 빛 · 거리 고리 · 영지 빛 · 항로 · 영지 경계 · 성계 점 · 지역 이름 */
    function drawStatic(r, dpr) {
      const key = `${r.width}x${r.height}|${M.view.cx.toFixed(2)},${M.view.cy.toFixed(2)},${M.view.k.toFixed(4)}|${mapColor}|${sel}`;
      if (M.stat && M.statKey === key) return; M.statKey = key;
      const oc = M.stat || document.createElement('canvas'); M.stat = oc; oc.width = Math.round(r.width * dpr); oc.height = Math.round(r.height * dpr);
      const g = oc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
      const D2 = M.data, byIdS = new Map(D2.systems.map((s) => [s.id, s])), secByI = new Map(D2.sectors.map((sc) => [sc.i, sc]));
      if (artT) { const a = toScr({ x: -ART_SPAN / 2, y: -ART_SPAN / 2 }, r), sz = ART_SPAN * M.view.k; g.globalAlpha = 0.75; g.drawImage(artT, a.x, a.y, sz, sz); g.globalAlpha = 1; }
      // 거리 고리 · 방위선(홀로그램 탁자)
      const c0 = toScr({ x: 0, y: 0 }, r);
      g.strokeStyle = 'rgba(110,200,255,.09)'; g.lineWidth = 1;
      for (const R0 of RINGS) { g.beginPath(); g.arc(c0.x, c0.y, R0 * M.view.k, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); for (let a = 0; a < 12; a++) { const an = a * Math.PI / 6, r0 = RINGS[0] * M.view.k * 0.4, r1 = RINGS[4] * M.view.k * 1.06; g.moveTo(c0.x + Math.cos(an) * r0, c0.y + Math.sin(an) * r0); g.lineTo(c0.x + Math.cos(an) * r1, c0.y + Math.sin(an) * r1); } g.stroke();
      g.fillStyle = 'rgba(140,215,255,.28)'; g.font = '9px monospace'; g.textAlign = 'left';
      for (const R0 of RINGS) { const y = c0.y - R0 * M.view.k; g.fillRect(c0.x - 4, y, 8, 1); g.fillText(`${R0} LY`, c0.x + 6, y - 3); }
      for (let a = 0; a < 360; a += 5) { const an = a * Math.PI / 180, R1 = RINGS[4] * M.view.k, L1 = a % 30 ? 4 : 10; g.fillRect(c0.x + Math.cos(an) * R1, c0.y + Math.sin(an) * R1, 1, 1); g.beginPath(); g.moveTo(c0.x + Math.cos(an) * R1, c0.y + Math.sin(an) * R1); g.lineTo(c0.x + Math.cos(an) * (R1 + L1), c0.y + Math.sin(an) * (R1 + L1)); g.stroke(); }
      { const T = terrain(), p = toScr({ x: T.x0, y: T.y0 }, r); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(T.cv, p.x, p.y, T.w * M.view.k, T.h * M.view.k); }
      g.strokeStyle = 'rgba(190,230,255,.18)'; g.lineWidth = 1; g.beginPath();
      for (const [a, b] of D2.lanes) { const A = byIdS.get(a), B = byIdS.get(b); if (!A || !B) continue; const p = toScr(W(A), r), q = toScr(W(B), r); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); } g.stroke();
      const dot = Math.max(1.3, Math.min(3, M.view.k * 2));
      for (const s of D2.systems) { const p = toScr(W(s), r); if (p.x < -6 || p.y < -6 || p.x > r.width + 6 || p.y > r.height + 6) continue; const own = s.o >= 0 ? D2.countries[String(s.o)] : null; g.fillStyle = own ? own.color : 'rgba(200,225,240,.45)'; g.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot); }
      // 지역 이름: 띄어 쓴 대문자 + 아래 가는 줄
      g.save(); g.textAlign = 'center';
      for (const [txt, x, y] of [[L('오리온 변경', 'ORION REACH'), -300, 292], [L('백조자리 변경령', 'CYGNUS MARCHES'), 300, 292], [L('세렌 회랑', 'SEREN CORRIDOR'), -20, 262], [L('바스틸 회랑', 'BASTILLE CORRIDOR'), -20, -190]]) {
        const p = toScr({ x, y }, r), fs = Math.max(11, 17 * M.view.k), t = txt.toUpperCase().split('').join(' ');
        g.font = `600 ${fs}px sans-serif`; g.fillStyle = 'rgba(205,235,255,.3)'; g.fillText(t, p.x, p.y); const w = g.measureText(t).width;
        g.fillStyle = 'rgba(120,205,255,.3)'; g.fillRect(p.x - w / 2, p.y + 6, w, 1); g.fillRect(p.x - w / 2, p.y + 4, 14, 3);
      }
      g.restore();
    }
    /** 고른 영지·마우스 올린 영지 둘레의 조준선(두 호가 반대로 돈다) */
    function reticle(g, p, rad, col, now, big) {
      const a = now / 1400; g.save(); g.strokeStyle = col; g.lineWidth = big ? 1.6 : 1.1; g.shadowColor = col; g.shadowBlur = 8;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(p.x, p.y, rad, a + i * 2.094, a + i * 2.094 + 1.2); g.stroke(); }
      if (big) { for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(p.x, p.y, rad + 7, -a * 0.7 + i * Math.PI, -a * 0.7 + i * Math.PI + 0.7); g.stroke(); } for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; g.beginPath(); g.moveTo(p.x + Math.cos(an) * (rad + 12), p.y + Math.sin(an) * (rad + 12)); g.lineTo(p.x + Math.cos(an) * (rad + 20), p.y + Math.sin(an) * (rad + 20)); g.stroke(); } }
      g.restore();
    }
    /** 매 프레임: 정적 겹 · 도는 고리 호 · 훑는 띠 · 수도 맥동 · 조준선 · 바뀐 성계 반짝임 · 켜짐 연출 */
    function frame() {
      if (!M.alive) return; M.raf = requestAnimationFrame(frame);
      if (!M.data) return; const r = rect(), dpr = window.devicePixelRatio || 1;
      // 렉 줄이기(2026-11-08 사용자: 「너무 렉걸리던데 … 차라리 gif를 빼자」): 늘 도는 움직임(도는 고리·훑는 띠·수도 맥동·깜빡임)을 없애고,
      // 화면이 실제로 바뀔 때만(이동·확대·고르기·마우스 올림·자료) 다시 그린다. 켜짐 연출·날아가기·바뀐 성계 반짝임 동안만 계속 그린다.
      const busy = !!(M.intro || M.anim || M.flash.size);
      const dk = `${r.width}x${r.height}|${dpr}|${M.view.cx.toFixed(3)},${M.view.cy.toFixed(3)},${M.view.k.toFixed(5)}|${mapColor}|${sel}|${M.hover}|${M.hoverFront ? M.hoverFront[0] : ''}|${M.ver}|${M.statKey === '' ? Math.random() : ''}|${artT ? 1 : 0}`;
      if (!busy && M.drawKey === dk) return; M.drawKey = dk;
      const now = 0, nowT = performance.now();
      if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); M.statKey = ''; }
      // 켜짐 연출(2.2초): 고리가 펼쳐지고, 홀로그램이 깜빡이며 들어오고, 살짝 다가선다
      let it = 1; if (M.intro) { it = Math.min(1, (nowT - M.intro) / 2200); const e = 1 - Math.pow(1 - it, 3), F = M.fitTo; M.view.k = F.k * (0.8 + 0.2 * e); M.view.cx = F.cx; M.view.cy = F.cy; if (it >= 1) { M.intro = 0; place(); } else placeSoon(); }
      if (M.anim) { const t = Math.min(1, (nowT - M.anim.t0) / M.anim.dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, A = M.anim.from, B = M.anim.to, lk = Math.log(A.k) + (Math.log(B.k) - Math.log(A.k)) * e; M.view = { k: Math.exp(lk), cx: A.cx + (B.cx - A.cx) * e, cy: A.cy + (B.cy - A.cy) * e }; placeSoon(); if (t >= 1) M.anim = null; }
      drawStatic(r, dpr);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = g.createRadialGradient(r.width / 2, r.height / 2, 0, r.width / 2, r.height / 2, Math.max(r.width, r.height) * 0.7); bg.addColorStop(0, '#04172a'); bg.addColorStop(1, '#010409'); g.fillStyle = bg; g.fillRect(0, 0, r.width, r.height);
      g.globalAlpha = it < 1 ? Math.min(1, it * 1.6) : 1;
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(M.stat, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1;
      const c0 = toScr({ x: 0, y: 0 }, r), e0 = it < 1 ? 1 - Math.pow(1 - it, 2) : 1;
      // 도는 고리 호
      g.save(); g.strokeStyle = 'rgba(120,210,255,.28)'; g.lineWidth = 2;
      [[1, 0.00011, 3], [3, -0.00007, 2], [4, 0.00005, 4]].forEach(([ri, sp, n]) => { const R0 = RINGS[ri] * M.view.k * e0, a0 = now * sp; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(c0.x, c0.y, R0, a0 + i * (Math.PI * 2 / n), a0 + i * (Math.PI * 2 / n) + 0.35); g.stroke(); } });
      g.restore();
      // (훑는 홀로그램 띠는 뺐다 — 2026-11-08 렉)
      const D2 = M.data, byIdS = new Map(D2.systems.map((s) => [s.id, s]));
      for (const sc of D2.sectors) { if (!sc.core) continue; const s = byIdS.get(sc.sys); if (!s) continue; const p = toScr(W(s), r), ph = 0.35; g.strokeStyle = `rgba(170,225,255,${0.45 * (1 - ph)})`; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, 30 + ph * 50 * Math.max(0.6, M.view.k), 0, Math.PI * 2); g.stroke(); }
      const selSec = sel !== null ? D2.sectors.find((x) => x.nb === sel) : null;
      if (selSec) { const s = byIdS.get(selSec.sys); if (s) reticle(g, toScr(W(s), r), selSec.core ? 34 : 26, '#ffffffcc', now, true); }
      if (M.hover !== null && (!selSec || selSec.i !== M.hover)) { const sc = D2.sectors.find((x) => x.i === M.hover), s = sc && byIdS.get(sc.sys); if (s) reticle(g, toScr(W(s), r), sc.core ? 32 : 24, 'rgba(140,220,255,.8)', now, false); }
      // 분쟁 성계(영역다툼, 2026-11-07): 주인 색과 미는 귀족 색이 번갈아 깜빡이는 겹 고리 · 넘어가기 직전이면 주황 점선 고리가 더해진다
      if (D2.dom && D2.dom.contested && D2.dom.contested.length) {
        const secOfNb = new Map(); for (const sc of D2.sectors) if (sc.nb !== undefined) secOfNb.set(sc.nb, sc);
        const blink = 1, rr = Math.max(4, 6 * Math.min(2, M.view.k));
        for (const [sysId, own, by, prog] of D2.dom.contested) {
          const s = byIdS.get(sysId); if (!s) continue; const p = toScr(W(s), r); if (p.x < -20 || p.y < -20 || p.x > r.width + 20 || p.y > r.height + 20) continue;
          const so = secOfNb.get(own), sb = secOfNb.get(by), hot = M.hoverFront && M.hoverFront[0] === sysId;
          // 바깥 고리 = 지키는 쪽 색, 그 위로 도전자 색 호가 장악 진척도만큼(줄다리기)
          g.lineWidth = hot ? 3 : 2; g.strokeStyle = (so && secColor(so, 0.85)) || '#fff'; g.beginPath(); g.arc(p.x, p.y, rr + 3, 0, Math.PI * 2); g.stroke();
          if (prog > 0) { g.strokeStyle = (sb && secColor(sb, 1)) || '#ff9d3b'; g.lineWidth = hot ? 4 : 3; g.beginPath(); g.arc(p.x, p.y, rr + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog / 100)); g.stroke(); }
          if (prog >= 75) { g.strokeStyle = `rgba(255,157,59,${blink ? 0.9 : 0.4})`; g.lineWidth = 1.2; g.beginPath(); g.arc(p.x, p.y, rr + 8, 0, Math.PI * 2); g.stroke(); } // 곧 넘어감
        }
      }
      for (const [id, t0] of M.flash) { const t = (nowT - t0) / 6000; if (t > 1) { M.flash.delete(id); continue; } const s = byIdS.get(id); if (!s) continue; const p = toScr(W(s), r); g.strokeStyle = `rgba(255,157,59,${1 - t})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 6 + ((t * 3) % 1) * 22, 0, Math.PI * 2); g.stroke(); }
    }
    function hudText() {
      const D2 = M.data; if (!D2) return; const c = M.cur;
      hud.textContent = '';
      for (const [k, v] of [[L('관측 시각', 'STARDATE'), D2.date || '—'], [L('영지', 'DOMAINS'), String(D2.sectors.length)], [L('성계', 'SYSTEMS'), String(D2.systems.length)], [L('분쟁 성계', 'CONTESTED'), String(D2.dom && D2.dom.contested ? D2.dom.contested.length : 0)], [L('배율', 'ZOOM'), M.view.k.toFixed(2) + 'x'], [L('좌표', 'COORD'), c ? `${(-c.x).toFixed(0)} / ${c.y.toFixed(0)}` : '—']]) { const d = h('div'); d.append(h('span', '', k), h('b', '', v)); hud.append(d); }
    }
    let placeT = 0; const placeSoon = () => { if (!placeT) placeT = requestAnimationFrame(() => { placeT = 0; place(); }); };
    function place() {
      const r = rect(), D2 = M.data, byIdS = new Map(D2.systems.map((s) => [s.id, s])), small = M.view.k < 1.2;
      for (const sc of D2.sectors) {
        let el = M.els.get(sc.i); const s = byIdS.get(sc.sys); if (!s) continue;
        if (!el) { el = mkEl(sc); M.els.set(sc.i, el); layer.append(el); }
        const p = toScr(W(s), r); el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.classList.toggle('small', small && !sc.core);
        el.style.display = p.x < -60 || p.y < -60 || p.x > r.width + 60 || p.y > r.height + 60 ? 'none' : '';
      }
      // 분쟁 성계 표지
      const ct = (D2.dom && D2.dom.contested) || [], live = new Set(); M.fels = M.fels || new Map();
      const secOfNb = new Map(); for (const sc of D2.sectors) if (sc.nb !== undefined) secOfNb.set(sc.nb, sc);
      for (const c of ct) {
        const [sysId, own, by, prog, mom] = c, s = byIdS.get(sysId); if (!s) continue; live.add(sysId);
        let el = M.fels.get(sysId);
        if (!el) { el = h('div', 'ft'); el.append(h('i', '', '\u2694')); el.onmousedown = (e) => e.stopPropagation(); el.onclick = (e) => { e.stopPropagation(); ATLAS_SFX.select(); void openFront(el.dataset.m ? Number(el.dataset.m) : c[6]); }; el.onmouseenter = () => { M.hoverFront = el._c; ATLAS_SFX.hover(); }; el.onmouseleave = () => { if (M.hoverFront === el._c) M.hoverFront = null; }; M.fels.set(sysId, el); layer.append(el); }
        el._c = c; el.dataset.m = String(c[6]);
        const so = secOfNb.get(own), sb = secOfNb.get(by), ca = (sb && secColor(sb, 1)) || '#ff9d3b', cd = (so && secColor(so, 0.9)) || '#4fb8ff', pc = Math.max(0, Math.min(100, prog));
        el.style.background = `conic-gradient(${ca} 0 ${pc}%, ${cd} ${pc}% 100%)`;
        el.classList.toggle('hot', prog >= 75); el.classList.toggle('sm', small);
        const A = byId(by), B = byId(own), nm = (o) => (o ? (o.seen || o.gone ? o.name : '???') : '?');
        el.title = L(`${s.n || ''} 쟁탈전 — ${nm(A)} 가가 ${nm(B)} 가의 성계를 ${Math.round(prog)}% 장악(${mom > 0 ? '기세 ▲' : mom < 0 ? '밀리는 중 ▼' : '멈춤'})\n누르면 쟁탈 현황판`, `Struggle for ${s.n || ''} — House ${nm(A)} holds ${Math.round(prog)}% against House ${nm(B)} (${mom > 0 ? 'gaining ▲' : mom < 0 ? 'losing ▼' : 'stalled'})\nClick for the battle board`);
        const p = toScr(W(s), r); el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
        el.style.display = p.x < -30 || p.y < -30 || p.x > r.width + 30 || p.y > r.height + 30 ? 'none' : '';
      }
      for (const [k, el] of M.fels) if (!live.has(k)) { el.remove(); M.fels.delete(k); }
      hudText();
    }
    function mkEl(sc) {
      const n = nobleOf(sc), el = h('div', 'mk' + (sc.core ? ' core' : '')), ph = h('div', 'ph'), hx = h('div', 'hx'); hx.append(ph); el.style.pointerEvents = 'auto'; el.style.setProperty('--mc', secColor(sc)); el.style.animationDelay = (M.intro ? 1.0 + Math.random() * 1.0 : 0) + 's';
      if (sc.core) { if (sc.pic) ph.style.backgroundImage = `url("${sc.pic}")`; else if (sc.side === 'p') ph.textContent = '\u265B'; el.append(hx, h('b', '', sc.name), h('small', '', L('군주 직할', 'CROWN DOMAIN'))); el.title = sc.name + ((sc.side === 'a' || sc.side === 'b') && window.sllm.auOpen ? '\n' + L('누르면 군주 접견', 'Click for an audience with the sovereign') : ''); }
      else if (sc.cn) { // 회랑의 정복지 · 우리 귀족(2026-11-08)
        if (sc.hub) { el.classList.add('cnk', 'hubk'); ph.textContent = '\u25C9'; // 회랑 섹터(2026-11-08): 미리 정한 거점 행성을 차지한 회랑 섹터
          el.append(hx, h('b', '', sc.name), h('small', '', `${sc.role} · ${sc.gov} · ${sc.size}`));
          el.title = `${sc.name}\n${sc.gov}\n${L(`거점 행성을 차지해 ${RW('name')}의 섹터가 되었습니다.`, `Holding its key world, this is now a sector of ${RW('name')}.`)}`;
          el.onmouseenter = () => { M.hover = sc.i; ATLAS_SFX.hover(); }; el.onmouseleave = () => { if (M.hover === sc.i) M.hover = null; };
          return el; }
        if (sc.pup) { el.classList.add('cnk', 'pupk'); if (sc.pic) ph.style.backgroundImage = `url("${sc.pic}")`; else ph.textContent = '\u2756';
          el.append(hx, h('b', '', sc.name), h('small', '', `${sc.gov} · ${RW('subject').toUpperCase()} · ${sc.size}`));
          el.title = `${sc.name}\n${sc.gov}\n${L(`${RW('name')}이(가) 세운 괴뢰국 — ${RW('subject')}입니다.`, `A puppet state raised by ${RW('name')} — a ${RW('subject')}.`)}\n${L(`누르면 「${RW('nobles')}」을(를) 엽니다.`, `Click to open ${RW('nobles')}.`)}`;
          el.onclick = (e) => { e.stopPropagation(); ATLAS_SFX.select(); if (CN_SEAT) { mode = 'cn'; render(); } };
          el.onmouseenter = () => { M.hover = sc.i; ATLAS_SFX.hover(); }; el.onmouseleave = () => { if (M.hover === sc.i) M.hover = null; };
          return el; }
        el.classList.add('cnk'); if (sc.pic) ph.style.backgroundImage = `url("${sc.pic}")`; else ph.textContent = sc.lid !== undefined ? '\u2726' : '?';
        el.append(hx, h('b', '', sc.lid !== undefined ? sc.gov : sc.name), h('small', '', sc.lid !== undefined ? `${RW('noble').toUpperCase()} · ${sc.name} · ${sc.size}` : `${sc.gov} · ${sc.size}`));
        el.title = `${sc.name}\n${sc.lid !== undefined ? L(`${RW('noble')} ${sc.gov}이(가) 다스리는 정복지`, `Conquered land ruled by ${RW('noble')} ${sc.gov}`) : sc.gov}\n${L(`누르면 「${RW('nobles')}」을(를) 엽니다.`, `Click to open ${RW('nobles')}.`)}`;
        el.onclick = (e) => { e.stopPropagation(); ATLAS_SFX.select(); if (CN_SEAT) { mode = 'cn'; render(); } };
        el.onmouseenter = () => { M.hover = sc.i; ATLAS_SFX.hover(); }; el.onmouseleave = () => { if (M.hover === sc.i) M.hover = null; };
        return el;
      }
      else if (sc.rebel && n) { ph.style.backgroundImage = `url("${n.pic}")`; el.classList.add('rebel'); el.append(hx, h('b', '', sc.name), h('small', '', `${L('반란 군주', 'REBEL LORD')} ${n.name} · ${sc.size}`)); el.title = `${sc.name}\n${L('반란으로 떨어져 나간 땅 — 이제 어느 강대국의 것도 아닙니다.', 'Land that broke away in revolt — it belongs to neither great power now.')}`; }
      else if (n && (n.seen || n.gone)) { ph.style.backgroundImage = `url("${n.pic}")`; if (n.gone) el.classList.add('gone'); el.append(hx, h('b', '', n.name), h('small', '', `${sc.name} · ${sc.size}`)); el.title = `${n.name} — ${sc.name}\n${L('영지 성계', 'Systems held')}: ${sc.size}\n${L('충성', 'Loyalty')}: ${n.fate || n.stageName}`; }
      else { el.classList.add('unk'); ph.textContent = '?'; el.append(hx, h('b', '', '???'), h('small', '', `${sc.name} · ${sc.size}`)); el.title = L('정체 미상의 귀족 영지', 'Domain of an unidentified noble'); }
      el.onclick = (e) => { e.stopPropagation(); if (sc.core && (sc.side === 'a' || sc.side === 'b')) { if (window.sllm.auOpen) { ATLAS_SFX.select(); void meet({ kind: 'ruler', side: sc.side }); } return; } if (n) { ATLAS_SFX.select(); pick(n.id); } }; // 군주 직할을 누르면 군주 접견(2026-11-08 사용자)
      el.onmouseenter = () => { M.hover = sc.i; ATLAS_SFX.hover(); };
      el.onmouseleave = () => { if (M.hover === sc.i) M.hover = null; };
      return el;
    }
    M.mark = () => { M.statKey = ''; const petIds = new Set(((D.dom && D.dom.pets) || []).map((q) => q.id)); for (const [i, el] of M.els) { const sc = M.data.sectors.find((x) => x.i === i); el.classList.toggle('pet', !!sc && petIds.has(sc.nb)); el.classList.toggle('sel', !!sc && sc.nb !== undefined && sc.nb === sel); el.classList.toggle('dimmed', sel !== null && !(sc && sc.nb === sel)); } };
    M.recolor = () => { for (const el of M.els.values()) el.remove(); M.els.clear(); M.statKey = ''; M.terrKey = ''; place(); M.mark(); };
    M.stop = () => { M.alive = false; clearInterval(M.timer); cancelAnimationFrame(M.raf); };
    M.reload = () => { void refresh(false); };
    /** 영지를 고르면 그 영지로 날아가 확대(오른쪽 신상 파일에 가리지 않게 왼쪽 빈 곳 가운데로). 고르기를 풀면 전체로. */
    M.focus = (id) => {
      if (!M.data || M.intro) return; const r = rect();
      let to = M.fitTo || fitView();
      if (id !== null && id !== undefined) {
        const sc = M.data.sectors.find((x) => x.nb === id);
        if (sc) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (const s of M.data.systems) if (s.s === sc.i) { const p = W(s); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
          if (x0 < Infinity) {
            const pw = Math.min(780, r.width * 0.5) + 30, aw = r.width - pw - 80, ah = r.height - 260;
            const k = Math.max(1.6, Math.min(4.5, Math.min(aw / Math.max(40, x1 - x0 + 60), ah / Math.max(40, y1 - y0 + 60))));
            to = { k, cx: (x0 + x1) / 2 + (pw / 2) / k, cy: (y0 + y1) / 2 + 20 / k };
          }
        }
      }
      M.anim = { from: { ...M.view }, to, t0: performance.now(), dur: 900 };
    };
    function logFeed() {
      feed.textContent = ''; const hd = h('div', 'hd'); hd.append(h('b', '', L('관측 기록', 'WATCH LOG')), document.createTextNode(` // ${M.data.date || ''}`)); feed.append(hd);
      if (!M.log.length) feed.append(h('div', 'none', L('아직 영지 변화가 없습니다. 전쟁·반란·정복으로 성계 주인이 바뀌면 여기에 바로 남습니다.', 'No domain changes yet. When war, rebellion or conquest moves a system, it appears here.')));
      for (const x of M.log.slice(-12).reverse()) feed.append(h('div', x.t > Date.now() - 20000 ? 'new' : '', `${x.d} · ${x.text}`));
    }
    /** 새 자료와 앞 자료를 비교: 섹터(영지)가 바뀐 성계·주인이 바뀐 성계 → 반짝임 + 기록 + 경보 소리 */
    function diff(next) {
      const prev = M.prev; M.prev = new Map(next.systems.map((s) => [s.id, { s: s.s, o: s.o, n: s.n }]));
      if (!prev) return 0;
      const secName = (D2, i) => { const sc = D2.sectors.find((x) => x.i === i); if (!sc) return L('주인 없는 땅', 'unclaimed space'); const n = nobleOf(sc); return sc.core ? sc.name : n && (n.seen || n.gone) ? n.name : '???'; };
      const nbOf = (D2, i) => { const sc = D2.sectors.find((x) => x.i === i); return sc ? (sc.nb ?? `c${sc.side}`) : null; };
      let count = 0;
      for (const s of next.systems) {
        const p = prev.get(s.id); if (!p) continue;
        const ownCh = p.o !== s.o, secCh = String(nbOf(M.data, p.s)) !== String(nbOf(next, s.s));
        if (!ownCh && !secCh) continue;
        count++; M.flash.set(s.id, performance.now());
        const from = secName(M.data, p.s), to = secName(next, s.s), own = s.o >= 0 ? next.countries[String(s.o)] : null;
        M.log.push({ t: Date.now(), d: next.date || '', text: ownCh ? L(`${s.n || s.id}: ${own ? own.name : '주인 없음'}의 손에 넘어감 (${from} → ${to})`, `${s.n || s.id}: passed to ${own ? own.name : 'no one'} (${from} → ${to})`) : L(`${s.n || s.id}: ${from}의 영지에서 ${to}의 영지로`, `${s.n || s.id}: from ${from}'s domain to ${to}'s`) });
      }
      if (M.log.length > 80) M.log.splice(0, M.log.length - 80);
      return count;
    }
    async function refresh(first) {
      let r = null; try { r = await window.sllm.scnMap(false); } catch (e) { r = null; }
      if (!M.alive) return;
      if (!r || !r.ok || !r.on) { if (first) { feed.textContent = ''; feed.append(h('div', 'none', (r && r.error) || L('지도를 읽지 못했습니다.', 'Could not read the map.'))); } return; }
      try { const nb = await window.sllm.scnNobles(); if (nb && nb.ok && nb.on) D = markDead(nb); } catch (e) { /* 귀족 자료는 덤 */ }
      const changed = diff(r); if (changed) ATLAS_SFX.alert();
      const sizeCh = M.data ? r.sectors.some((sc) => { const o = M.data.sectors.find((x) => x.i === sc.i); return !o || o.size !== sc.size || o.nb !== sc.nb || !!o.rebel !== !!sc.rebel; }) : false;
      M.data = r; M.statKey = ''; if (first || sizeCh || changed) M.ver = (M.ver || 0) + 1; // 영지 그림은 무거우니(약 0.2초) 바뀐 게 있을 때만 다시
      if (first) { M.fitTo = fitView(); M.view = { ...M.fitTo }; M.intro = performance.now(); box.classList.add('intro'); setTimeout(() => box.classList.remove('intro'), 3200); ATLAS_SFX.open(); }
      if (first || sizeCh) { for (const el of M.els.values()) el.remove(); M.els.clear(); }
      place(); M.mark(); logFeed();
    }
    // 끌어서 옮기기 · 휠로 확대 · 커서 좌표
    let drag = null;
    box.onmousedown = (e) => { if (e.target.closest('.mk') || e.target.closest('.map-feed') || e.target.closest('.map-sfx')) return; M.anim = null; drag = { x: e.clientX, y: e.clientY, cx: M.view.cx, cy: M.view.cy, moved: false }; box.classList.add('drag'); };
    const tip = h('div', 'map-tip'); tip.style.display = 'none'; box.append(tip);
    const frontAt = (mx, my) => { const D2 = M.data; if (!D2 || !D2.dom || !D2.dom.contested) return null; const r = rect(), byIdS = new Map(D2.systems.map((q) => [q.id, q])); let best = null, bd = 16 * 16; for (const c of D2.dom.contested) { const s = byIdS.get(c[0]); if (!s) continue; const p = toScr(W(s), r), d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = c; } } return best; };
    box.addEventListener('mousemove', (e) => {
      if (drag) { tip.style.display = 'none'; return; }
      const r = rect(), c = frontAt(e.clientX - r.left, e.clientY - r.top); M.hoverFront = c;
      if (!c || e.target.closest('.mk') || e.target.closest('.nb-det')) { tip.style.display = 'none'; box.style.cursor = ''; return; }
      const so = M.data.sectors.find((x) => x.nb === c[1]), sb = M.data.sectors.find((x) => x.nb === c[2]), A = byId(c[2]), O = byId(c[1]), sy = M.data.systems.find((q) => q.id === c[0]);
      tip.textContent = ''; tip.append(h('b', '', `⚔ ${sy ? sy.n : ''}`));
      const bar = h('div', 'tug'), fa = h('i'); fa.style.width = c[3] + '%'; fa.style.background = '#ff8a3d'; bar.style.background = '#4fb8ff'; bar.append(fa);
      tip.append(h('div', 'nm2', `${A ? (A.seen || A.gone ? A.name : '???') : '?'} ▶ ${O ? (O.seen || O.gone ? O.name : '???') : '?'}`), bar, h('div', 'sm', L(`장악 ${c[3]}% · 달마다 ${c[4] > 0 ? '+' : ''}${c[4]}% · 영향력 ${c[5]}:${100 - c[5]} — 눌러서 현황판`, `Control ${c[3]}% · ${c[4] > 0 ? '+' : ''}${c[4]}%/month · influence ${c[5]}:${100 - c[5]} — click for the battle board`)));
      tip.style.display = ''; tip.style.left = (e.clientX - r.left + 16) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; box.style.cursor = 'pointer';
    });
    box.addEventListener('mouseup', (e) => { if (drag && drag.moved) return; const r = rect(), c = frontAt(e.clientX - r.left, e.clientY - r.top); if (c && !e.target.closest('.mk') && !e.target.closest('.nb-det') && !e.target.closest('.fb')) { e.stopPropagation(); ATLAS_SFX.select(); void openFront(c[6]); } }, true);
    box.onmousemove = (e) => { const r = rect(); M.cur = { x: (e.clientX - r.left - r.width / 2) / M.view.k + M.view.cx, y: (e.clientY - r.top - r.height / 2) / M.view.k + M.view.cy }; if (!drag) hudText(); };
    window.addEventListener('mousemove', (e) => { if (!drag || !M.alive) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; M.view.cx = drag.cx - dx / M.view.k; M.view.cy = drag.cy - dy / M.view.k; clampView(); placeSoon(); });
    window.addEventListener('mouseup', (e) => { if (drag && !drag.moved && sel !== null && !M.hoverFront) pick(null); drag = null; box.classList.remove('drag'); });
    box.onwheel = (e) => { e.preventDefault(); if (M.intro) return; M.anim = null; const r = rect(), mx = e.clientX - r.left, my = e.clientY - r.top, wx = (mx - r.width / 2) / M.view.k + M.view.cx, wy = (my - r.height / 2) / M.view.k + M.view.cy; M.view.k = Math.max(minK(), Math.min(14, M.view.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); M.view.cx = wx - (mx - r.width / 2) / M.view.k; M.view.cy = wy - (my - r.height / 2) / M.view.k; clampView(); placeSoon(); };
    // 축소·이동 한계(2026-11-08 사용자: 「축소가 이렇게까지 뒤로 되는데?」): 전체 보기보다 조금만 더 작게, 지도 밖으로는 반 화면까지만
    function minK() { return M.fitTo ? M.fitTo.k * 0.85 : 0.3; }
    function clampView() { const F = M.fitTo; if (!F) return; const r = rect(), hw = r.width / 2 / F.k, hh = r.height / 2 / F.k; M.view.cx = Math.max(F.cx - hw, Math.min(F.cx + hw, M.view.cx)); M.view.cy = Math.max(F.cy - hh, Math.min(F.cy + hh, M.view.cy)); }
    M.raf = requestAnimationFrame(frame);
    M.timer = setInterval(() => { if (!box.isConnected) { M.stop(); return; } void refresh(false); }, 15000);
    window.addEventListener('resize', () => { if (!M.alive || !M.data) return; if (sel === null && !M.anim) { M.fitTo = fitView(); if (!M.intro) M.view = { ...M.fitTo }; } M.statKey = ''; placeSoon(); }); // 전체 화면으로 바뀌면 다시 맞춘다
    void refresh(true);
  }

  function board(box) {
    box.classList.add('nb-web'); box.textContent = '';
    const keepView = W ? { tx: W.tx, ty: W.ty, k: W.k, key: W.key } : null;
    const bg = h('div', 'web-bg'); bg.style.backgroundImage = `url("${ART}${view === 'both' ? 'cover.webp' : 'audience_' + side + '.webp'}")`;
    box.append(bg, h('div', 'web-dots'), h('div', 'web-vig'));
    const stage = h('div', 'web-stage'), svg = svgEl('svg', {}); stage.append(svg); box.append(stage);
    W = { box, stage, svg, els: new Map(), at: new Map(), target: new Map(), pos: new Map(), tx: 0, ty: 0, k: 1, hubs: [], key: `${view}|${side}|${group}` };
    const fresh = !keepView || keepView.key !== W.key;
    const put = (key, el, x, y, ox, oy) => { W.els.set(key, el); W.at.set(key, { x, y }); W.target.set(key, { x, y }); el.style.transform = `translate(${fresh ? ox : x}px,${fresh ? oy : y}px)${key.startsWith('n') && fresh ? ' scale(.3)' : ''}`; if (fresh) el.style.opacity = '0'; stage.append(el); };
    const sides = view === 'both' ? ['a', 'b'] : [side];
    for (const sd of sides) {
      const cx = view === 'both' ? (sd === 'a' ? -820 : 820) : 0, spread = view === 'both' ? (sd === 'a' ? [Math.PI * 0.55, Math.PI * 1.45] : [-Math.PI * 0.45, Math.PI * 0.45]) : [-Math.PI / 2, Math.PI * 1.5];
      // 군주 원판: 통치자 초상(2026-11-07 GPT 그림)·이름·직함. 그림이 없으면 왕관
      const sov = h('div', 'wn sov ' + sd), disc = h('div', 'disc'), R = RULER()[sd];
      const im = h('img'); im.src = `assets/scenario/corridor/ruler/ruler_${sd}.png`; im.alt = ''; im.onerror = () => { im.remove(); disc.textContent = '♛'; }; disc.append(im);
      sov.append(disc, h('b', '', R.name), h('small', '', `${SIDE()[sd]} · ${R.title} — ${L('눌러서 접견', 'click for an audience')}`));
      if (window.sllm.auOpen) sov.addEventListener('click', (e) => { if (W && W.moved) return; e.stopPropagation(); void meet({ kind: 'ruler', side: sd }); });
      put('sov-' + sd, sov, cx, 0, cx, 0);
      const lay = webLayout(sd, cx, 0, spread);
      for (const [id, q] of lay.pos) W.pos.set(id, q);
      for (const hb of lay.hubs) {
        W.hubs.push(hb);
        const t = h('div', 'wn btitle ' + sd); t.append(h('b', '', hb.g.name), h('span', '', `${hb.g.sub} · ${hb.g.list.length}${L('가문', ' houses')}`));
        const f = hb.g.fac;
        if (f) {
          const mood = h('div', 'fmood'), chip = h('i', '', f.stageName); chip.style.background = STAGE_COL[f.stage] || '#aaa';
          mood.append(document.createTextNode(L('분위기 ', 'Mood ')), chip, document.createTextNode(` · ${L('영향력', 'Influence')} ${f.inf}`));
          t.append(mood, h('div', 'fag', `${L('요구', 'Agenda')}: ${f.agenda}`));
        }
        t.style.width = '360px'; t.style.marginLeft = '-180px'; t.style.marginTop = f ? '-40px' : '-22px';
        put('t-' + hb.g.fk, t, hb.tx, hb.ty, cx, 0);
        const hc = webCard(hb.g.head, true); hc.dataset.fk = hb.g.fk; put('n' + hb.g.head.id, hc, hb.x, hb.y, cx, 0);
        for (const m of hb.g.list.slice(1)) { const q = lay.pos.get(m.id); const el = webCard(m, false); el.dataset.fk = hb.g.fk; put('n' + m.id, el, q.fx, q.fy, cx, 0); W.target.set('fold' + m.id, { x: q.fx, y: q.fy }); W.target.delete('n' + m.id); }
      }
    }
    if (view === 'both') { const me = h('div', 'wn me'); me.append(h('div', 'disc', '★'), h('b', '', L('회랑 — 우리', 'The Corridor — us'))); put('me', me, 0, 0, 0, 0); }
    if (focus && !W.hubs.some((x) => x.g.fk === focus)) focus = null;
    // 끌기·휠 확대 · 빈 곳 누르기 = 상세 닫기 → 전체 보기
    box.onmousedown = (e) => { if (e.button !== 0) return; DRAG = { x: e.clientX, y: e.clientY, tx: W.tx, ty: W.ty }; W.moved = false; box.classList.add('drag'); };
    box.onclick = () => { if (W && W.moved) return; if (sel !== null) pick(null); else if (focus) setFocus(null); };
    if (!dragHooked) { // 창 전체 이벤트는 한 번만 건다(다른 집무실 스크립트의 처리를 덮어쓰지 않게)
      dragHooked = true;
      window.addEventListener('mousemove', (e) => { if (!DRAG || !W) return; const dx = e.clientX - DRAG.x, dy = e.clientY - DRAG.y; if (Math.abs(dx) + Math.abs(dy) > 4) W.moved = true; W.tx = DRAG.tx + dx; W.ty = DRAG.ty + dy; applyView(false); });
      window.addEventListener('mouseup', () => { if (!DRAG) return; DRAG = null; if (W) W.box.classList.remove('drag'); setTimeout(() => { if (W) W.moved = false; }, 0); });
      window.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || !$('nbWin')) return; if ($('nbWin').querySelector('.fb')) { $('nbWin').querySelector('.fb').remove(); return; } if (mode === 'map' && sel !== null) { pick(null); return; } if (mode === 'board' && W && W.box.isConnected) { if (sel !== null) pick(null); else if (focus) setFocus(null); else $('nbWin').remove(); } else $('nbWin').remove(); });
    }
    box.onwheel = (e) => { e.preventDefault(); const r = box.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k2 = Math.max(0.2, Math.min(2.2, W.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); W.tx = mx - (mx - W.tx) * (k2 / W.k); W.ty = my - (my - W.ty) * (k2 / W.k); W.k = k2; applyView(false); };
    // 아래 왼쪽: 갈래·보기 거르기 / 아래 오른쪽: 확대·전체 보기
    const ui = h('div', 'web-ui'); ui.append(h('span', '', L('갈래', 'Branches')));
    for (const [k, t] of [['region', L('대세력', 'Factions')], ['spec', L('특화', 'Specialty')], ['bond', L('인연 무리', 'House circles')]]) { const b = h('button', group === k ? 'on' : '', t); b.onclick = (e) => { e.stopPropagation(); regroup(k); }; ui.append(b); }
    ui.append(h('span', '', '│'), h('span', '', L('보기', 'View')));
    for (const [k, t] of [['one', L('한 세력', 'One power')], ['both', L('양쪽', 'Both powers')]]) { const b = h('button', view === k ? 'on' : '', t); b.onclick = (e) => { e.stopPropagation(); view = k; focus = null; render(); }; ui.append(b); }
    ui.append(h('span', '', '│'), h('span', '', L('⚑ 국경 · 초록 = 밀사 통로 · ! = 의심 · X = 떠남 · ? = 정체 미상 · 협약(마우스): 하늘색 동맹 · 회색 불가침 · 붉은 점선 원한 · 주황 점선 반란 밀약', '⚑ frontier · green = envoy channel · ! = suspected · X = gone · ? = unknown · pacts (hover): blue alliance · grey non-aggression · red dotted feud · orange dashed conspiracy')));
    ui.onmousedown = (e) => e.stopPropagation(); ui.onclick = (e) => e.stopPropagation();
    const zm = h('div', 'web-zoom');
    for (const [t, f] of [['+', 1.2], ['−', 1 / 1.2]]) { const b = h('button', '', t); b.onclick = (e) => { e.stopPropagation(); const r = box.getBoundingClientRect(), mx = r.width / 2, my = r.height / 2, k2 = Math.max(0.2, Math.min(2.2, W.k * f)); W.tx = mx - (mx - W.tx) * (k2 / W.k); W.ty = my - (my - W.ty) * (k2 / W.k); W.k = k2; applyView(true); }; zm.append(b); }
    const all = h('button', '', L('⤢ 전체 보기', '⤢ Overview')); all.onclick = (e) => { e.stopPropagation(); if (focus) setFocus(null); else fit(true); }; zm.append(all);
    zm.onmousedown = (e) => e.stopPropagation(); zm.onclick = (e) => e.stopPropagation();
    box.append(ui, zm, h('div', 'web-hint'));
    requestAnimationFrame(() => {
      if (!W || W.box !== box) return;
      if (!fresh) { W.tx = keepView.tx; W.ty = keepView.ty; W.k = keepView.k; applyView(false); }
      // 처음 열 때: 군주 자리에서 카드들이 제 자리로 날아 나간다
      requestAnimationFrame(() => { for (const [key, el] of W.els) { const q = W.target.get(key); if (q) el.style.transform = `translate(${q.x}px,${q.y}px)`; el.style.opacity = ''; } arrange(fresh); });
    });
  }
  /** 갈래를 바꾸면 수장이 바뀌므로 판을 새로 짠다(카드는 군주 자리에서 다시 날아 나간다). */
  function regroup(k) { group = k; focus = null; render(); }

  // ---- 성계 쟁탈 현황판(2026-11-07 사용자: 「하츠 오브 아이언 전투 현황판처럼 — 양옆 두 진영, 가운데 줄다리기」) ----
  const FR_LABEL = () => ({ power: L('가문의 힘', 'House strength'), ambition: L('올해 기세', 'This year’s drive'), distance: L('거점에서의 거리', 'Distance from seat'), feud: L('원한', 'Feud'), nap: L('불가침(덜 밂)', 'Non-aggression (holds back)'), home: L('지키는 쪽 이점', 'Defender’s advantage'),
    op_bribe: L('공작: 관리 매수', 'Op: bribe officials'), op_agitate: L('공작: 민심 선동', 'Op: stir the populace'), op_settle: L('공작: 이주민 정착', 'Op: settle colonists'), op_force: L('공작: 무력 시위', 'Op: show of force'), op_garrison: L('공작: 치안 강화', 'Op: tighten security'), op_appease: L('공작: 회유', 'Op: win hearts'), corridor: L('회랑의 뒷돈', 'Corridor money'), garrison: L('영지 수비대', 'Domain garrison'), gek_a: L('하극상: 도전자 편의 세', 'Usurpation: the challenger’s camp'), gek_d: L('하극상: 대표 편의 세', 'Usurpation: the leader’s camp'), order: L('대표가 다툼을 누름', 'The faction leader keeps order') });
  let escHooked = false;
  function hookEsc() { // 세력지도에서도 Esc: 현황판 → 신상 파일 → 창 순서로 닫는다(세력판을 안 열어 봤어도)
    if (escHooked) return; escHooked = true;
    window.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || !$('nbWin') || mode !== 'map' || dragHooked) return; const fb = $('nbWin').querySelector('.fb'); if (fb) { fb.remove(); return; } if (sel !== null) { pick(null); return; } $('nbWin').remove(); });
  }
  async function openFront(sysM) {
    const host = $('nbWin'); if (!host) return;
    let r = null; try { r = await window.sllm.scnDomainFront(sysM); } catch (e) { r = null; }
    (host.querySelector('.fb') || { remove() {} }).remove();
    if (!r || !r.ok) return;
    const A = byId(r.by), O = byId(r.owner), so = MAP && MAP.data ? MAP.data.sectors.find((x) => x.nb === r.owner) : null, sb = MAP && MAP.data ? MAP.data.sectors.find((x) => x.nb === r.by) : null;
    const colA = '#ff8a3d', colD = '#4fb8ff'; void so; void sb; // 공격은 주황, 수비는 하늘색(같은 나라 귀족끼리도 한눈에 갈리게)
    const nmOf = (n) => (n ? (n.seen || n.gone ? n.name : '???') : '?');
    const fb = h('div', 'fb'); fb.onmousedown = (e) => e.stopPropagation(); fb.onclick = (e) => e.stopPropagation(); fb.onwheel = (e) => e.stopPropagation();
    const head = h('div', 'fb-head'); head.append(h('span', '', '// SYSTEM CONTEST'), h('b', '', L(`${r.name} 쟁탈전`, `Struggle for ${r.name}`)));
    if (r.gekName) { const gt = h('small', '', r.gekName); gt.style.cssText = 'color:#ff8fb4;font-family:monospace;font-size:11px;letter-spacing:.06em;border:1px solid #ff6b9a88;padding:2px 6px;background:#2a061699'; head.append(gt); } // 하극상 전선
    const x = h('button', 'fb-x', '✕'); x.onclick = () => fb.remove(); head.append(x);
    // 양옆 진영
    const sideBox = (n, col, role, op, pic) => { const d = h('div', 'fb-side'); const ph = h('div', 'fb-pic'); ph.style.borderColor = col; if (n && (n.seen || n.gone)) ph.style.backgroundImage = `url("${pic}")`; else ph.append(h('i', '', '?')); d.append(ph); const t = h('div', 'fb-who'); t.append(h('small', '', role), h('b', '', nmOf(n)), h('em', '', op)); t.querySelector('em').style.color = col; d.append(t); return d; };
    const LB = FR_LABEL();
    const top = h('div', 'fb-top');
    top.append(sideBox(A, colA, L('공격 · 도전하는 가문', 'ATTACKER'), LB['op_' + r.aOp], r.aPic));
    const mid = h('div', 'fb-mid'); mid.append(h('div', 'fb-vs', 'VS'), h('div', 'fb-since', L(`${r.since}부터`, `since ${r.since}`)));
    top.append(mid);
    const rs = sideBox(O, colD, L('수비 · 지금 주인', 'DEFENDER'), LB['op_' + r.dOp], r.dPic); rs.classList.add('r'); top.append(rs);
    // 가운데 줄다리기: 장악 진척도
    const tugW = h('div', 'fb-tugw'), tug = h('div', 'fb-tug'), fa = h('i', 'a'), chev = h('div', 'fb-chev' + (r.mom > 0 ? ' fwd' : r.mom < 0 ? ' back' : ''));
    tug.style.background = colD; fa.style.width = r.p + '%'; fa.style.background = colA; chev.style.left = `calc(${r.p}% - 60px)`; tug.append(fa, chev);
    const nums = h('div', 'fb-nums'); nums.append(h('b', '', `${r.p}%`), h('span', '', L('장악 진척도 — 100%가 되면 성계가 넘어갑니다', 'Control — at 100% the system changes hands')), h('b', '', `${100 - r.p}%`));
    tugW.append(nums, tug);
    const sub = h('div', 'fb-sub');
    const momT = r.locked ? L('군주가 이 국경을 지키고 있어 움직이지 않습니다', 'The sovereign is guarding this border — no movement') : r.mom > 0 ? L(`달마다 +${r.mom}% · 약 ${r.eta}개월 뒤 넘어감`, `+${r.mom}% a month · falls in about ${r.eta} months`) : r.mom < 0 ? L(`달마다 ${r.mom}% · 지키는 쪽이 밀어내는 중`, `${r.mom}% a month · the defender is pushing back`) : L('팽팽함', 'Deadlocked');
    const inf = h('div', 'fb-inf'), ia = h('i'); ia.style.width = r.share + '%'; ia.style.background = colA; inf.style.background = colD; inf.append(ia);
    sub.append(h('div', 'fb-mom', momT), h('div', 'fb-infl', L(`영향력  ${r.A} : ${r.D}  (${r.share}% : ${100 - r.share}%)`, `Influence  ${r.A} : ${r.D}  (${r.share}% : ${100 - r.share}%)`)), inf);
    // 요인 목록(부대 목록처럼)
    const cols = h('div', 'fb-cols');
    const list = (rows, col, title) => { const c = h('div', 'fb-list'); c.append(h('h6', '', title)); for (const q of rows) { const row = h('div', 'fb-row'); row.style.borderLeftColor = col; row.append(h('span', '', LB[q.k] || q.k), h('b', '', q.kind === 'mul' ? `×${q.v}` : q.kind === 'add' ? (q.k.startsWith('op_') && rows === r.d ? `−${q.v}%/${L('월', 'mo')}` : `+${q.v}%/${L('월', 'mo')}`) : String(q.v))); c.append(row); } return c; };
    cols.append(list(r.a, colA, L('공격 쪽 요인', 'Attacker factors')), list(r.d, colD, L('수비 쪽 요인', 'Defender factors')));
    // 위쪽 배경 띠(2026-11-07 GPT 의뢰 — 공작 종류별 그림, 없으면 기본 그림, 그것도 없으면 어두운 바탕만)
    const ban = h('div', 'fb-ban'), FB = 'assets/scenario/corridor/front/';
    ban.style.backgroundImage = `linear-gradient(180deg, rgba(3,11,20,.45), rgba(3,11,20,.15) 38%, rgba(3,11,20,.9)), linear-gradient(90deg, rgba(255,138,61,.22), transparent 32%, transparent 68%, rgba(79,184,255,.22)), url("${FB}front_bg_${r.aOp}.jpg"), url("${FB}front_bg_default.jpg")`;
    ban.append(head, top);
    fb.append(ban, tugW, sub, cols);
    // 회랑의 끼어들기(외국 귀족끼리의 다툼)
    if (r.foreign) {
      const acts = h('div', 'fb-acts');
      const mk = (sd, txt, done) => { const b = h('button', '', txt); b.disabled = done || !r.ready; b.title = r.ready ? L(`에너지 ${r.cost} — 1년 동안 그쪽이 달마다 3%씩 유리해지고, 그 가문이 회랑을 좋게 봅니다(+10).`, `${r.cost} energy — for a year that side gains 3% a month, and the house warms to the Corridor (+10).`) : L('게임이 연결돼 있어야 합니다.', 'The game must be connected.'); b.onclick = async () => { await domAct({ a: 'frontAid', sys: sysM, side: sd }); void openFront(sysM); }; acts.append(b); };
      mk('a', r.aidA ? L('공격 쪽을 돕는 중', 'Backing the attacker') : L(`공격 쪽 몰래 돕기 (에너지 ${r.cost})`, `Secretly back the attacker (${r.cost})`), r.aidA);
      mk('d', r.aidD ? L('수비 쪽을 돕는 중', 'Backing the defender') : L(`수비 쪽 몰래 돕기 (에너지 ${r.cost})`, `Secretly back the defender (${r.cost})`), r.aidD);
      fb.append(acts);
    }
    host.append(fb);
  }

  // ---- 세력지도의 귀족 신상 파일(2026-11-07 사용자: 「너무 컴팩트 — 섹터를 누르면 확대되고, 오른쪽 창은 더 넓고 게임 인터페이스스럽게」) ----
  let dosTab = 'over';
  const LOYAL_W = (n) => (n.loyal !== undefined ? n.loyal : [85, 55, 32, 17, 5][n.stage] || 50);
  const opCol = (v) => (v >= 20 ? '#6fd3ff' : v > -20 ? '#b8c2cc' : v > -50 ? '#ffb15a' : '#ff4f4f');
  function dossier(box) {
    box.textContent = '';
    const n = sel !== null ? byId(sel) : null; if (!n) return;
    const dm = D.dom || {}, unk = !n.seen && !n.gone;
    const shell = h('div', 'dos'), x = h('button', 'dos-x', '✕'); x.title = L('닫기 (Esc)', 'Close (Esc)'); x.onclick = (e) => { e.stopPropagation(); pick(null); };
    // 머리: 큰 초상 · 이름 · 소속 · 충성 막대
    const head = h('div', 'dos-head ' + n.side), pic = h('div', 'dos-pic');
    if (unk) pic.append(h('i', '', '?')); else pic.style.backgroundImage = `url("${n.pic}")`;
    if (n.gone) pic.classList.add('gone');
    const id = h('div', 'dos-id');
    id.append(h('div', 'dos-kick', `// ${n.side === 'a' ? 'ALLIANCE' : 'IMPERIAL'} HOUSE DOSSIER · ${String(n.id).padStart(3, '0')}`), h('div', 'dos-name', unk ? '???' : n.name));
    const fac = n.fac ? facOf(n.side, n.fac) : null;
    id.append(h('div', 'dos-sub', unk ? `${SIDE()[n.side]} · ${L('정체 미상', 'Unknown')}` : `${SIDE()[n.side]} · ${SPEC()[n.spec] || n.spec}${n.border ? ' · ⚑ ' + L('국경', 'Border') : ''}${fac ? ' · ' + fac.name : ''}${fac && fac.leader === n.id ? ' (' + (fac.acting ? L('대표 대행', 'Acting leader') : L('대표', 'Leader')) + ')' : ''}`));
    if (!unk) {
      const lo = h('div', 'dos-loyal'), bar = h('div', 'bar'), fill = h('i'), col = n.fate ? '#777' : STAGE_COL[n.stage] || '#aaa';
      fill.style.width = (n.fate ? 100 : LOYAL_W(n)) + '%'; fill.style.background = col; bar.append(fill);
      lo.append(h('span', '', L('충성', 'LOYALTY')), bar, h('b', '', n.fate ? n.fate : `${n.stageName}${n.loyal !== undefined ? ' ' + n.loyal : ''}`)); lo.querySelector('b').style.color = col;
      id.append(lo);
      if (n.loyal === undefined && !n.fate) id.append(h('div', 'dos-note', L('막대는 단계만 보여 줍니다 — 정확한 값은 첩보나 접견으로.', 'The bar shows the stage only — learn the exact figure through espionage or an audience.')));
    }
    head.append(pic, id);
    // 숫자 칸
    const tiles = h('div', 'dos-tiles');
    const tile = (k, v, warn) => { const t = h('div', 'tile' + (warn ? ' warn' : '')); t.append(h('span', '', k), h('b', '', v)); tiles.append(t); };
    const sz = dm.sizes ? dm.sizes[n.id] : undefined, ini = dm.init ? dm.init[n.id] : undefined;
    tile(L('영지 성계', 'SYSTEMS'), sz !== undefined ? `${sz}${ini ? ` / ${ini}` : ''}` : '—');
    tile(L('밀리는 국경', 'UNDER PRESSURE'), String((dm.pressed && dm.pressed[n.id]) || 0), !!(dm.pressed && dm.pressed[n.id]));
    tile(L('미는 국경', 'PRESSING'), String((dm.pressing && dm.pressing[n.id]) || 0));
    tile(L('자기 군주와', 'TO SOVEREIGN'), unk ? '—' : n.ruler);
    tile(L('우리와', 'TO US'), unk ? '—' : n.me);
    const pacts = (dm.pacts || []).filter((p) => p.a === n.id || p.b === n.id);
    tile(L('협약', 'PACTS'), String(pacts.length));
    { const g = dm.gar && dm.gar[n.id]; // 영지 수비대(2026-11-07): 거점의 방어 플랫폼 · 민병대. 충성이 바닥이면 손을 놓는다
      const t = h('div', 'tile' + (g && g.passive ? ' warn' : '')); t.title = L('영지 수비대 — 거점 성계를 지키는 방어 플랫폼과 거점 행성의 민병대. 해마다 영지 크기에 맞춰 다시 짜이고, 반란이 나면 반란국으로 넘어갑니다. 충성이 「모반의 기미」 아래면 손을 놓습니다.', 'Domain garrison — defense platforms guarding the seat system and militia on the seat world. Resized each year to the domain; goes over to the rebels in a revolt. Stands down when loyalty falls to "Signs of treason" or below.');
      t.append(h('span', '', L('수비대', 'GARRISON')), h('b', '', unk || !g ? '—' : `${g.p}${L('기', '')} · ${L('민병', 'MIL')} ${g.c}${g.passive ? L(' · 손 놓음', ' · STOOD DOWN') : ''}`)); tiles.append(t); }
    { const hr = dm.health && dm.health[n.id]; // 건강(2026-11-08): 소문 → 운전수 매수면 관찰 → 주치의 매수면 진료 기록
      const lvl = hr ? hr.lvl || 0 : 0, t = h('div', 'tile' + (hr && hr.warn ? ' warn' : ''));
      t.title = [L('건강(소문) — 공개 석상에서 보이는 모습과 떠도는 말뿐입니다. 아파도 건재한 척하는 귀족이 있고, 헛소문도 섞입니다.', 'Health (rumor) — only what is seen in public and what people say. Some nobles feign good health, and false rumors mix in.'), L('건강(관찰) — 매수한 운전수가 본 일상입니다. 소문보다 정확합니다.', 'Health (observed) — the daily life our chauffeur sees. Sharper than rumor.'), L('건강(진료 기록) — 매수한 주치의의 기록입니다. 진짜 수치·지병·쌓인 독까지.', 'Health (medical record) — from our bought physician: the true figure, illness and accumulated poison.')][lvl];
      t.append(h('span', '', [L('건강(소문)', 'HEALTH (RUMOR)'), L('건강(관찰)', 'HEALTH (OBSERVED)'), L('건강(진료)', 'HEALTH (RECORD)')][lvl]), h('b', '', unk || !hr || n.dead ? '—' : hr.name)); tiles.append(t);
      if (hr && !n.dead && (hr.ins || hr.food)) id.append(h('div', 'dos-note', [hr.ins ? L(`우리 내부자: ${hr.ins.join(' · ')}`, `Our insiders: ${hr.ins.join(' · ')}`) : '', hr.food ? L(`좋아하는 음식: ${hr.food}`, `Favorite dish: ${hr.food}`) : ''].filter(Boolean).join('   ')));
    }
    // 탭
    const tabs = h('div', 'dos-tabs'), body = h('div', 'dos-body');
    const TABS = [['over', L('개요', 'OVERVIEW')], ['dip', L('영지 외교', 'DIPLOMACY')], ['log', L('기록', 'RECORD')]];
    for (const [k, t] of TABS) { const b = h('button', dosTab === k ? 'on' : '', t); b.onclick = (e) => { e.stopPropagation(); dosTab = k; dossier(box); }; tabs.append(b); }
    if (unk) {
      body.append(h('div', 'dos-empty', L('아직 이 귀족이 누구인지 모릅니다. 국경 귀족·수도권 귀족은 처음부터 알려져 있고, 나머지는 접견에서 받는 소개, 충성도 첩보, 인연, 밀사 통로로 드러납니다.', 'We do not yet know who this noble is. Frontier and capital nobles are known from the start; others are revealed through introductions at audiences, loyalty espionage, ties or envoy channels.')));
    } else if (dosTab === 'over') {
      const sec = (t) => { const d = h('div', 'dos-sec'); d.append(h('h5', '', t)); body.append(d); return d; };
      const pr = sec(L('성격', 'PERSONALITY'));
      TRAITS().forEach(([pos, neg], i) => { const v = n.tr[i] || 0, row = h('div', 'trait'), track = h('div', 'track'), fill = h('i'), w = Math.abs(v) * 25; fill.style.width = w + '%'; fill.style.left = v >= 0 ? '50%' : (50 - w) + '%'; track.append(h('b'), fill); row.append(h('span', v < 0 ? 'on' : '', neg), track, h('span', v > 0 ? 'on' : '', pos)); pr.append(row); });
      const tr = sec(L('알려진 인연', 'KNOWN TIES')), ties = tiesOf(n.id);
      if (!ties.length) tr.append(h('div', 'dos-empty', L('알려진 인연이 없습니다.', 'No known ties.')));
      for (const b of ties) { const o = byId(b.a === n.id ? b.b : b.a), row = h('div', 'rel'), chip = h('em', '', b.name); chip.style.borderColor = KIND_COL[b.kind] || '#9fe6ff'; chip.style.color = KIND_COL[b.kind] || '#9fe6ff'; row.append(chip, h('span', '', o ? (o.seen || o.gone ? o.name : '???') : '?'), h('small', '', b.stage)); tr.append(row); }
      if (n.intro) tr.append(h('div', 'dos-note', L(`이 사람은 우리가 아직 모르는 귀족 ${n.intro}명을 압니다 — 접견에서 소개를 청해 보세요.`, `Knows ${n.intro} noble(s) we have not met — ask for an introduction at an audience.`)));
    } else if (dosTab === 'dip') {
      domainBlock(body, n);
      if (!body.childNodes.length) body.append(h('div', 'dos-empty', L('영지 외교 정보가 없습니다.', 'No domain diplomacy data.')));
    } else {
      const mine = (D.notes || []).filter((q) => q.id === n.id);
      if (!mine.length) body.append(h('div', 'dos-empty', L('이 가문에 대한 기록이 아직 없습니다.', 'No records on this house yet.')));
      for (const q of mine) { const row = h('div', 'logrow'); row.append(h('span', '', q.d), h('b', '', q.text)); body.append(row); }
    }
    // 아래 명령 줄
    const acts = h('div', 'dos-acts');
    const btn = (t, f, dis, tip) => { const b = h('button', '', t); b.disabled = !!dis; if (tip) b.title = tip; b.onclick = (e) => { e.stopPropagation(); f(); }; acts.append(b); return b; };
    btn(L('접견', 'AUDIENCE'), () => { void meet({ kind: 'noble', id: n.id }); }, unk || !window.sllm.auOpen || (n.fate && !(D.dom && D.dom.rebels && D.dom.rebels[n.id])), unk ? L('누구인지 알아야 접견을 청할 수 있습니다', 'You must know who they are to request an audience') : '');
    btn(L('인물 관계도', 'RELATIONS CHART'), () => { mode = 'graph'; render(); }, unk);
    btn(L('영지 외교', 'DIPLOMACY'), () => { dosTab = 'dip'; dossier(box); }, unk || dosTab === 'dip');
    shell.append(x, head, tiles, tabs, body, acts); box.append(shell);
  }
  /** 상세 패널의 「영지 외교」(귀족 영역다툼 1단계, 2026-11-07): 영지 크기 · 협약 · 이웃 호감 · 중재 · 군주 하사. */
  function domainBlock(box, n) {
    const dm = D.dom; if (!dm) return;
    // 반란국(2026-11-08): 반란을 이끈 귀족의 나라가 아직 서 있으면 — 독립 전쟁 중, 접견·함대 이양
    const rv = dm.rebels && dm.rebels[n.id];
    if (rv) {
      box.append(h('h4', '', L('반란국', 'Rebel realm')));
      const rb = h('div', 'petbox'); rb.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #d46bff66;border-left:3px solid #d46bff;background:#1e0a2aaa';
      const WHY = { grant: L('군주의 허락을 받아 평화롭게 떨어져 나왔습니다', 'parted peacefully with the sovereign’s consent'), incite: L('회랑이 부추겨 일어났습니다', 'rose at the Corridor’s urging'), patron: L('회랑의 후원 약속을 믿고 일어났습니다', 'rose trusting the Corridor’s promise of backing'), plot: L('스스로 밀약을 모아 일어났습니다', 'rose on its own conspiracy') };
      rb.append(h('b', '', rv.why === 'grant' ? L(`${n.name} 가의 독립국`, `Independent realm of House ${n.name}`) : L(`${n.name} 가의 반란국 — 독립 전쟁 중`, `Rebel realm of House ${n.name} — at war for independence`)),
        h('div', '', L(`${rv.since >= 0 ? rv.since + '년에 ' : ''}${WHY[rv.why] || WHY.plot}. 성계 ${rv.n}곳. 회랑이 넘겨준 함대 ${rv.gifts}개.`, `${rv.since >= 0 ? 'In ' + rv.since + ', it ' : 'It '}${WHY[rv.why] || WHY.plot}. ${rv.n} systems. Fleets handed over by the Corridor: ${rv.gifts}.`)));
      if (dm.seat === 'p') {
        const row = h('div'); row.style.marginTop = '6px';
        const gb = h('button', '', L('함대 이양', 'Hand over a fleet')); gb.title = L('우리 군 함대 하나를 이 반란국에 넘깁니다. 반란국은 우리를 크게 고마워하지만, 넷 중 하나는 옛 주인 나라에 새어 나가 의심을 삽니다.', 'Hand one of our warfleets to this rebel realm. They will be deeply grateful, but one time in four word reaches their former sovereign and draws suspicion.');
        const list = h('div'); list.style.cssText = 'margin-top:6px;display:none;max-height:220px;overflow:auto';
        gb.onclick = async (e) => {
          e.stopPropagation(); list.style.display = ''; list.textContent = ''; list.append(h('div', 'none', L('세이브에서 우리 함대를 읽는 중…', 'Reading our fleets from the save…')));
          let r = null; try { r = await window.sllm.scnDomainAct({ a: 'fleets', to: n.id }); } catch (er) { r = { ok: false, error: String(er) }; }
          list.textContent = '';
          if (!r || !r.ok) { list.append(h('div', 'none', (r && r.error) || L('함대 목록을 읽지 못했습니다.', 'Could not read the fleet list.'))); return; }
          if (!r.fleets.length) { list.append(h('div', 'none', L('넘겨줄 군 함대가 없습니다.', 'There are no warfleets to hand over.'))); return; }
          list.append(h('div', 'none', L(`세이브 기준(${r.date}) — 그 뒤에 움직였으면 다를 수 있습니다.`, `As of the save (${r.date}) — it may differ if fleets have moved since.`)));
          for (const f of r.fleets) {
            const it = h('div'); it.style.cssText = 'display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid #ffffff12';
            it.append(h('span', '', `${f.name}`), h('small', '', L(`전력 ${f.power} · ${f.ships}척 · ${f.at}`, `power ${f.power} · ${f.ships} ships · ${f.at}`)));
            const go = h('button', '', L('넘기기', 'Hand over')); go.style.marginLeft = 'auto';
            go.onclick = (ev) => { ev.stopPropagation(); if (!go.dataset.sure) { go.dataset.sure = '1'; go.textContent = L('정말 넘기기(되돌릴 수 없음)', 'Confirm — cannot be undone'); go.style.borderColor = '#ff8a3d'; return; } go.disabled = true; void domAct({ a: 'gift', to: n.id, x: f.id }); }; // 두 번 눌러 확정
            it.append(go); list.append(it);
          }
        };
        row.append(gb); rb.append(row, list);
      }
      box.append(rb);
      return;
    }
    if (n.gone) return;
    // 평화로운 독립 요구(2026-11-08)
    { const q = (dm.inds || []).find((x) => x.id === n.id);
      if (q) {
        const ib = h('div', 'petbox'); ib.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #9fffd466;border-left:3px solid #6fe8b4;background:#06261caa';
        ib.append(h('b', '', L('독립 요구', 'Plea for independence')), h('div', '', L(`${q.y}년, ${n.name} 가가 군주에게 제 영지를 놓아 달라며 정식으로 독립을 청했습니다.${q.mine ? ` 남은 기한 ${q.left}년 — 답하지 않으면 거절로 여겨집니다.` : ' 군주는 다음 연례 판단 때 답합니다.'}${q.back ? ' 회랑이 뒤에서 힘을 실어 주었습니다.' : ''}`, `In ${q.y}, House ${n.name} formally asked its sovereign to let its domain go free.${q.mine ? ` ${q.left} year(s) left — no answer counts as a refusal.` : ' The sovereign answers at the next yearly pass.'}${q.back ? ' The Corridor has quietly lent it weight.' : ''}`)));
        const row = h('div'); row.style.marginTop = '6px';
        if (q.mine) {
          const g = h('button', '', L('허락 — 평화로운 독립', 'Grant — peaceful independence')); g.title = L('그 영지가 전쟁 없이 떨어져 나가 새 나라가 됩니다. 되돌릴 수 없습니다.', 'The domain departs without war as a new nation. Cannot be undone.');
          g.onclick = (e) => { e.stopPropagation(); if (!g.dataset.sure) { g.dataset.sure = '1'; g.textContent = L('정말 허락(되돌릴 수 없음)', 'Confirm — cannot be undone'); return; } g.disabled = true; void domAct({ a: 'indAnswer', to: n.id, x: 1 }); };
          const f = h('button', '', L('거절', 'Refuse')); f.title = L(`그 귀족 충성 −15, 군주와의 사이도 나빠집니다. 반란 밀약으로 기울기 쉽습니다.`, 'That noble loses 15 loyalty and grows cold toward you. It may turn to conspiracy.');
          f.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'indAnswer', to: n.id, x: 0 }); };
          row.append(g, f);
        } else if (dm.seat === 'p') {
          const b = h('button', '', L(`뒤에서 밀어 주기 (에너지 ${dm.costs ? dm.costs.egg : 300})`, `Quietly back the plea (${dm.costs ? dm.costs.egg : 300} energy)`)); b.disabled = !!q.back;
          b.title = L('군주가 허락할 가능성이 크게 오릅니다. 그 가문이 회랑을 좋게 보지만, 다섯 중 하나는 그 나라에 새어 나갑니다.', 'Makes the sovereign far likelier to grant it. The house warms to the Corridor, but one time in five word reaches the realm.');
          b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'indBack', to: n.id }); }; row.append(b);
        }
        ib.append(row); box.append(ib);
      }
    }
    box.append(h('h4', '', L('영지 외교', 'Domain diplomacy')));
    const sz = dm.sizes ? dm.sizes[n.id] : undefined, ini = dm.init ? dm.init[n.id] : undefined;
    if (sz !== undefined) box.append(h('div', '', `${L('영지 성계', 'Systems held')}: ${sz}${ini ? ` (${L('처음', 'at start')} ${ini})` : ''}${dm.pressed && dm.pressed[n.id] ? ` · ${L('밀리는 국경', 'Border under pressure')} ${dm.pressed[n.id]}` : ''}${dm.pressing && dm.pressing[n.id] ? ` · ${L('미는 국경', 'Pressing')} ${dm.pressing[n.id]}` : ''}`));
    const fr = (dm.fronts || []).filter((f) => f.o === n.id || f.b === n.id);
    if (fr.length) {
      box.append(h('div', 'none', L('전선 — 누르면 쟁탈 현황판', 'Fronts — click for the battle board')));
      for (const f of fr.sort((a, b) => b.p - a.p)) {
        const atk = f.b === n.id, other = byId(atk ? f.o : f.b), row = h('div', 'frow'), bar = h('div', 'tug'), fa = h('i');
        fa.style.width = f.p + '%'; fa.style.background = atk ? '#ff9d3b' : '#ff5a5a'; bar.style.background = '#1b3a52'; bar.append(fa);
        row.append(h('span', 'fk', atk ? '⚔' : '🛡'), h('span', 'fn', `${f.name} — ${other ? (other.seen || other.gone ? other.name : '???') : '?'}`), bar, h('b', '', `${f.p}%`), h('small', f.mom > 0 ? (atk ? 'up' : 'dn') : f.mom < 0 ? (atk ? 'dn' : 'up') : '', `${f.mom > 0 ? '▲' : f.mom < 0 ? '▼' : '■'}${Math.abs(f.mom)}`));
        row.title = atk ? L('이 가문이 빼앗으려는 성계', 'A system this house is trying to take') : L('이 가문이 지키는 성계', 'A system this house is defending');
        row.onclick = (e) => { e.stopPropagation(); void openFront(f.sys); };
        box.append(row);
      }
    }
    const pacts = (dm.pacts || []).filter((p) => p.a === n.id || p.b === n.id);
    if (pacts.length) { const ul = h('ul'); for (const p of pacts) { const o = byId(p.a === n.id ? p.b : p.a), li = h('li'), chip = h('span', 'chip', PACT_NAME()[p.k]); chip.style.background = PACT_COL[p.k]; chip.style.color = '#021'; li.append(chip, document.createTextNode(` ${o ? (o.seen || o.gone ? o.name : '???') : '?'} · ${p.since}${L('년부터', '')}`)); ul.append(li); } box.append(ul); }
    else box.append(h('div', 'none', L('맺은 협약이 없습니다.', 'No pacts.')));
    const nb = (dm.nbrs && dm.nbrs[n.id]) || [];
    if (nb.length) {
      box.append(h('div', 'none', L('맞닿은 가문과의 사이', 'Relations with neighbouring houses')));
      const ul = h('ul');
      for (const x of nb.slice(0, 8)) {
        const o = byId(x.id); if (!o) continue; const li = h('li'); li.append(document.createTextNode(`${o.seen || o.gone ? o.name : '???'} — ${opName(x.op)} (${x.op}) `));
        if (x.op < 0 && !o.gone) { const b = h('button', '', n.side !== dm.seat ? L('외교 중재', 'Diplomatic mediation') : L('중재', 'Mediate')); b.disabled = !!dm.medUsed; b.title = dm.medUsed ? L('중재는 1년에 한 번입니다.', 'You can mediate once a year.') : L('두 가문의 감정을 누그러뜨립니다(+20). 원한이 풀릴 수도 있습니다. 대신 두 귀족 모두 자기 군주에 대한 충성이 조금 떨어집니다.', 'Soothe the two houses (+20). May end a feud. Both nobles lose a little loyalty to their sovereign.'); b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'mediate', x: n.id, y: o.id }); }; li.append(b); }
        ul.append(li);
      }
      box.append(ul);
    }
    // 2단계: 충성 서약 · 드러난 반란 밀약
    if (dm.canGrant && n.side === dm.seat) {
      const sw = dm.oaths && dm.oaths[n.id] !== undefined;
      const row = h('div'); row.append(document.createTextNode(sw ? `${L('충성 서약', 'Oath of loyalty')}: ${dm.oaths[n.id]}${L('년에 서약함', '')} ` : `${L('충성 서약', 'Oath of loyalty')}: ${L('아직 없음', 'none yet')} `));
      if (!sw) { const b = h('button', '', L('서약 받기', 'Take the oath')); b.disabled = !dm.oathLeft; b.title = dm.oathLeft ? L(`서약한 귀족은 반란 밀약에 잘 끼지 않고, 끼더라도 마지막에 따라나서지 않을 때가 많습니다. 충성 「평온」 이상만 응합니다. 올해 남은 횟수 ${dm.oathLeft}.`, `A sworn noble rarely joins a conspiracy and often stays home when it rises. Only nobles at “Content” loyalty or better agree. ${dm.oathLeft} left this year.`) : L('올해는 더 받을 수 없습니다.', 'No more oaths this year.'); b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'oath', to: n.id }); }; row.append(b); }
      box.append(row);
    }
    const plotLines = [];
    const PRICE = (q) => (q.k === 'land' ? L(`땅(${q.sys || '?'})`, `land (${q.sys || '?'})`) : q.k === 'rank' ? L('새 나라의 2인자', 'second in the new realm') : (() => { const t = byId(q.tgt); return L(`함께 ${t ? t.name : '?'} 가를 침`, `strike House ${t ? t.name : '?'} together`); })());
    for (const pl of dm.plots || []) {
      const ld = byId(pl.lead);
      if (pl.lead === n.id) { plotLines.push(L('반란 밀약의 주모자로 드러났습니다', 'Exposed as the ringleader of a conspiracy') + (pl.hidden ? L(' (아직 모르는 약속이 더 있음)', ' (more pledges remain hidden)') : '')); for (const q of pl.pledges) { const w = byId(q.who); plotLines.push(`  ↳ ${w ? w.name : '?'} — ${L('대가', 'price')}: ${PRICE(q)}`); } }
      for (const q of pl.pledges) if (q.who === n.id) plotLines.push(L(`${ld ? ld.name : '?'} 가에게 반란을 약속함 — 대가: `, `Pledged to rise with House ${ld ? ld.name : '?'} — price: `) + PRICE(q));
    }
    // 위계 · 하극상(2026-11-07 사용자: 「대표보다 강력해지면 도전」)
    { const ldId = dm.leads ? dm.leads[n.id] : -1, ldN = ldId >= 0 ? byId(ldId) : null;
      if (ldId === n.id) box.append(h('div', 'none', L('세력 대표 — 같은 세력 소가문들은 이 가문의 땅을 넘보지 않고, 이 가문도 그들의 땅을 거두지 않습니다. 대표가 건재하면 소가문끼리의 다툼도 느려집니다.', 'Faction leader — the lesser houses of its faction do not encroach on its land, nor does it take theirs. While it stands firm, quarrels among them slow down.')));
      else if (ldN) box.append(h('div', 'none', L(`세력 대표: ${ldN.seen || ldN.gone ? ldN.name : '???'} — 대표의 땅은 넘보지 않습니다(하극상을 일으키지 않는 한).`, `Faction leader: ${ldN.seen || ldN.gone ? ldN.name : '???'} — its land is not touched, short of an open usurpation.`)));
      const g = (dm.geks || []).find((x) => x.by === n.id || x.vs === n.id || x.backA.includes(n.id) || x.backD.includes(n.id));
      if (g) {
        const A = byId(g.by), B = byId(g.vs), nmOf = (o) => (o ? (o.seen || o.gone ? o.name : '???') : '?');
        const gb = h('div', 'petbox'); gb.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #ff6b9a66;border-left:3px solid #ff6b9a;background:#2a0616aa';
        gb.append(h('b', '', L('하극상', 'Usurpation')), h('div', '', L(`${nmOf(A)} 가가 세력 대표 ${nmOf(B)} 가에게 도전했습니다(${g.since}년부터, 남은 기한 ${g.left}년). 도전자 편 ${g.backA.length}가문 · 대표 편 ${g.backD.length}가문. 대표에게서 빼앗은 성계 ${g.took}곳.`, `House ${nmOf(A)} has challenged its faction leader, House ${nmOf(B)} (since ${g.since}, ${g.left} year(s) left). ${g.backA.length} house(s) with the challenger, ${g.backD.length} with the leader. Systems taken from the leader: ${g.took}.`)));
        // 세 줄다리기(도전자 왼쪽 주황, 대표 오른쪽 파랑) + 판세
        const bar = h('div', 'tug'), fa = h('i'); bar.style.cssText = 'position:relative;height:10px;margin:6px 0 2px;background:#4fb8ff;border-radius:2px;overflow:hidden'; fa.style.cssText = `display:block;height:100%;width:${g.share}%;background:#ff8a3d`; bar.append(fa); gb.append(bar);
        gb.append(h('div', 'none', L(`세 ${g.share}% 대 ${100 - g.share}% · 판세 ${g.sc > 15 ? '도전자 우세' : g.sc < -15 ? '대표 우세' : '팽팽'} (${g.sc})${g.aid ? ' · 회랑의 돈이 흐름' : ''}${g.crown ? ' · 군주가 대표 편' : ''}`, `Strength ${g.share}% vs ${100 - g.share}% · ${g.sc > 15 ? 'challenger ahead' : g.sc < -15 ? 'leader ahead' : 'even'} (${g.sc})${g.aid ? ' · Corridor money flowing' : ''}${g.crown ? ' · sovereign backs the leader' : ''}`)));
        if (g.backA.includes(n.id)) gb.append(h('div', 'none', L('이 가문은 도전자 편입니다.', 'This house sides with the challenger.')));
        if (g.backD.includes(n.id)) gb.append(h('div', 'none', L('이 가문은 대표 편입니다.', 'This house sides with the leader.')));
        const row = h('div'); row.style.marginTop = '6px';
        if (g.side !== dm.seat) { const b = h('button', '', L(`도전자에게 몰래 돈 대기 (에너지 ${dm.costs ? dm.costs.egg : 300})`, `Secretly fund the challenger (${dm.costs ? dm.costs.egg : 300} energy)`)); b.disabled = !!g.aid; b.title = L('도전자의 세 ×1.15, 그 가문이 회랑을 좋게 봅니다(대표는 나쁘게). 한 세력을 쪼갤 수 있지만 들키면 그 나라가 의심합니다.', "Challenger's strength ×1.15; that house warms to the Corridor (the leader cools). It can split a faction, but the realm grows suspicious if it leaks."); b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'gekAid', to: g.by }); }; row.append(b); }
        else { const b = h('button', '', L('군주로서 대표 편에 서기', 'Back the leader as sovereign')); b.disabled = !!g.crown; b.title = L('대표의 세 ×1.2, 대표 충성 +4, 도전자 충성 −6, 도전자 편 가문 충성 −2.', "Leader's strength ×1.2, leader loyalty +4, challenger −6, the challenger's backers −2."); b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'gekCrown', to: g.by }); }; row.append(b); }
        gb.append(row); box.append(gb);
      }
    }
    // 국경 분쟁 청원(이 귀족이 군주에게 호소 중) · 주모자 체포(2026-11-07)
    const pet = (dm.pets || []).find((q) => q.id === n.id), petVs = (dm.pets || []).find((q) => q.vs === n.id && !q.mine);
    const foreign = n.side !== dm.seat;
    if (foreign && (pet || petVs)) { // 회랑(외부 세력)의 끼어들기
      const q = pet || petVs, A = byId(q.id), B = byId(q.vs), cb = h('div', 'petbox'); cb.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #9fe6ff55;border-left:3px solid #9fe6ff;background:#06223aaa';
      cb.append(h('b', '', L('남의 나라 국경 분쟁', 'A foreign border dispute')), h('div', '', L(`${A ? A.name : '?'} 가가 ${B ? B.name : '?'} 가에게 국경을 밀린다며 자기 군주에게 청원했습니다. 군주는 다음 연례 회의 때 답합니다. 그 사이 회랑이 끼어들 수 있습니다.`, `House ${A ? A.name : '?'} has petitioned its sovereign against House ${B ? B.name : '?'}. The sovereign will answer at the next yearly meeting — until then the Corridor can meddle.`)));
      const row = h('div'); row.style.marginTop = '6px';
      const ba = h('button', '', L(`${A ? A.name : '?'} 몰래 돕기 (에너지 ${dm.costs ? dm.costs.aid : 400})`, `Secretly aid ${A ? A.name : '?'} (${dm.costs ? dm.costs.aid : 400} energy)`)); ba.disabled = !!q.aided; ba.title = L('그 가문이 회랑을 좋게 보고(+15), 자기 군주에겐 더 서운해합니다(충성 −4). 내년에 더 세게 버팁니다.', 'The house warms to the Corridor (+15) and cools to its sovereign (loyalty −4). It will hold harder next year.'); ba.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'aid', to: q.id }); };
      const be = h('button', '', L(`${B ? B.name : '?'} 부추기기 (에너지 ${dm.costs ? dm.costs.egg : 300})`, `Egg on ${B ? B.name : '?'} (${dm.costs ? dm.costs.egg : 300} energy)`)); be.disabled = !!q.egged; be.title = L('미는 쪽이 회랑을 좋게 보고(+10) 내년에 더 세게 밀어붙입니다. 두 가문 사이는 더 나빠집니다.', 'The pressing house warms to the Corridor (+10) and pushes harder next year. The two houses grow further apart.'); be.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'egg', to: q.id }); };
      row.append(ba, be); cb.append(row); box.append(cb);
    }
    if (pet && !foreign) {
      const vs = byId(pet.vs), pb = h('div', 'petbox'); pb.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #e8c87266;border-left:3px solid #e8c872;background:#2a2206aa';
      pb.append(h('b', '', L('국경 분쟁 청원', 'Border dispute petition')), h('div', '', L(`${vs ? vs.name : '?'} 가가 우리 국경을 밀고 있습니다(분쟁 성계 ${pet.n}곳). 군주께서 도와주십시오.`, `House ${vs ? vs.name : '?'} is pressing our borders (${pet.n} contested systems). We beg the sovereign's help.`)));
      const row = h('div'); row.style.marginTop = '6px';
      for (const [ch, t, tip] of [['back', L('편들어 주기', 'Take their side'), L('그 국경 성계를 1년 동안 지켜 줍니다. 청원한 귀족 충성 +6, 상대 귀족 충성 −3, 두 가문 사이는 더 나빠짐.', 'Protects those border systems for a year. Petitioner loyalty +6, the other noble −3, the houses grow further apart.')], ['mediate', L('중재 명령', 'Order mediation'), L('두 가문의 감정을 누그러뜨리고(+15) 넘어가려던 성계를 되돌립니다. 청원한 귀족 충성 +1.', 'Soothes both houses (+15) and cancels pending transfers. Petitioner loyalty +1.')], ['ignore', L('외면', 'Ignore'), L('아무것도 하지 않습니다. 청원한 귀족 충성 −6.', 'Do nothing. Petitioner loyalty −6.')]]) { const b = h('button', '', t); b.title = tip; b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'petition', to: n.id, choice: ch }); }; row.append(b); }
      pb.append(row); box.append(pb);
    }
    const myPlot = (dm.plots || []).find((p) => p.lead === n.id);
    if (foreign && myPlot && !n.gone) {
      const row = h('div'); row.style.cssText = 'margin:6px 0;display:flex;flex-wrap:wrap;gap:6px';
      const mk = (a, t, tip, dis, ask) => { const b = h('button', '', t); b.title = tip; b.disabled = !!dis; b.onclick = async (e) => { e.stopPropagation(); if (ask && !await sllmAsk(ask)) return; await domAct({ a, to: n.id }); }; row.append(b); };
      mk('sell', L('밀약을 그 나라 군주에게 알리기', 'Tell their sovereign'), L('그 나라의 회랑 의심도 −10. 군주가 곧바로 체포를 시도합니다 — 실패하면 그 자리에서 반란. 주모자는 회랑을 원망합니다.', 'That realm’s suspicion of us −10. The sovereign attempts an arrest at once — if it fails, they rise on the spot. The ringleader will hate us.'), false, L('정말 그 나라 군주에게 밀약을 알리겠습니까?', 'Really tell their sovereign?'));
      mk('warn', L('주모자에게 귀띔하기', 'Warn the ringleader'), L('「들켰다」고 알려 서둘러 들고일어나게 합니다(약속한 귀족 중 일부는 안 따를 수 있음). 주모자는 회랑을 고마워합니다. 20% 확률로 귀띔이 새어 나가 의심도 +10.', 'Tell them they are discovered so they rise now (some pledges may not follow). The ringleader will be grateful. 20% chance the warning leaks: suspicion +10.'), false, L('정말 귀띔해서 지금 반란을 일으키게 하겠습니까?', 'Really warn them and set off the revolt now?'));
      mk('patron', myPlot.patron ? L('뒷배 약속함', 'Backing promised') : L(`반란 후원 약속 (에너지 ${dm.costs ? dm.costs.patron : 800})`, `Promise to back them (${dm.costs ? dm.costs.patron : 800} energy)`), L('밀약이 힘을 얻습니다(들고일어날 문턱이 낮아지고 따라나설 확률 +10%). 주모자 호감 +15. 들키면 그 나라 의심도 +15.', 'The conspiracy gains strength (lower threshold, +10% follow chance). Ringleader +15 toward us. If exposed: suspicion +15.'), !!myPlot.patron);
      box.append(row);
    }
    if (dm.arrestChance && dm.arrestChance[n.id] !== undefined) {
      const row = h('div'); row.style.cssText = 'margin:6px 0';
      const b = h('button', '', L(`체포 후 유배 (성공 ${dm.arrestChance[n.id]}%)`, `Arrest and exile (${dm.arrestChance[n.id]}% success)`)); b.disabled = !!dm.arrestUsed;
      b.title = dm.arrestUsed ? L('올해는 이미 체포를 시도했습니다.', 'An arrest has already been attempted this year.') : L('성공하면 영지가 군주 직할이 되고 가문은 몰락, 밀약은 깨집니다. 실패하면 그 자리에서 반란이 일어납니다(약속한 귀족들도 따라나설 수 있음).', 'Success: the domain passes to the crown, the house falls and the plot collapses. Failure: they rise on the spot (pledged nobles may follow).');
      b.onclick = async (e) => { e.stopPropagation(); if (!await sllmAsk(L('정말 체포를 명하시겠습니까? 실패하면 바로 반란이 일어납니다.', 'Order the arrest? If it fails, they will rise in revolt at once.'))) return; await domAct({ a: 'arrest', to: n.id, x: 0 }); };
      // 2026-11-08 사용자(영구 사망): 체포한 주모자를 처형 — 영구히 죽고, 같은 진영 귀족들이 공포에 떤다(충성 −4, 약속했던 가문 −10)
      const bx = h('button', '', L(`체포 후 처형 (성공 ${dm.arrestChance[n.id]}%)`, `Arrest and execute (${dm.arrestChance[n.id]}% success)`)); bx.disabled = !!dm.arrestUsed; bx.style.marginLeft = '6px'; bx.style.borderColor = '#ff6b6b';
      bx.title = L('성공하면 주모자를 처형합니다(영구 사망). 영지는 군주 직할, 같은 진영 귀족 충성 −4, 밀약에 약속했던 가문은 −10. 실패하면 그 자리에서 반란이 일어납니다.', 'On success the ringleader is executed (permanent death). The domain passes to the crown; loyalty of the realm\'s nobles −4, pledged houses −10. On failure they rise in revolt at once.');
      bx.onclick = async (e) => { e.stopPropagation(); if (!await sllmAsk(L('체포해서 처형하시겠습니까? 되돌릴 수 없습니다. 실패하면 바로 반란이 일어납니다.', 'Arrest and execute? This cannot be undone. If it fails, they will rise in revolt at once.'))) return; await domAct({ a: 'arrest', to: n.id, x: 1 }); };
      row.append(b, bx); box.append(row);
    }
    if (plotLines.length) { const hh = h('div', 'plot'); hh.style.cssText = 'margin:6px 0;padding:6px 8px;border-left:3px solid #ff9d3b;background:#2a1606aa;white-space:pre-wrap'; hh.textContent = plotLines.join('\n'); box.append(hh); }
    const cand = dm.canGrant && dm.cand ? dm.cand[n.id] : null;
    if (cand && cand.length) {
      box.append(h('div', 'none', dm.grantUsed ? L('올해 군주 하사를 이미 썼습니다.', 'The royal grant has been used this year.') : L('군주 하사(1년 1번): 맞닿은 성계 하나를 이 귀족에게 줍니다. 받은 귀족 충성 +8, 빼앗긴 귀족 충성 −10.', 'Royal grant (once a year): give this noble one bordering system. Recipient loyalty +8, the one deprived −10.')));
      const ul = h('ul');
      for (const c of cand) { const f = byId(c.from), li = h('li'), b = h('button', '', L('하사', 'Grant')); b.disabled = !!dm.grantUsed; b.onclick = (e) => { e.stopPropagation(); void domAct({ a: 'grant', sys: c.sys, to: n.id }); }; li.append(document.createTextNode(`${c.hot ? '⚔ ' : ''}${c.name} ← ${f ? (f.seen ? f.name : '???') : '?'} `), b); ul.append(li); }
      box.append(ul);
    }
  }
  async function domAct(req) {
    let r = null; try { r = await window.sllm.scnDomainAct(req); } catch (e) { r = { ok: false, error: String(e) }; }
    if (!r || !r.ok) { const m = h('div', 'nb-warn', (r && r.error) || L('지금은 할 수 없습니다.', 'Not possible right now.')); m.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);padding:8px 14px;background:#3a1010;border:1px solid #ff5a5a;z-index:20'; $('nbWin')?.append(m); setTimeout(() => m.remove(), 3500); return; }
    if (r.message) { const m = h('div', 'nb-warn', r.message); m.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);max-width:60vw;padding:8px 14px;background:#06283c;border:1px solid #5fd4ff;z-index:20'; $('nbWin')?.append(m); setTimeout(() => m.remove(), 6000); }
    try { const nb = await window.sllm.scnNobles(); if (nb && nb.ok && nb.on) D = markDead(nb); } catch (e) { /* 다음 갱신 때 */ }
    if (MAP && MAP.reload) MAP.reload();
    if (DET) { DET.textContent = ''; detail(DET); }
  }
  function detail(box) {
    if (mode === 'map') { dossier(box); return; } // 세력지도: 넓은 게임식 신상 파일(2026-11-07)
    const n = sel !== null ? byId(sel) : null;
    if (mode === 'board' || mode === 'map') { const x = h('button', 'x', '×'); x.title = L('닫기 (Esc)', 'Close (Esc)'); x.onclick = (e) => { e.stopPropagation(); pick(null); }; box.append(x); }
    if (n && (mode === 'board' || mode === 'map') && !n.seen && !n.gone && !(mode === 'board' && W && W.hubs.some((hb) => hb.g.head.id === n.id))) {
      box.append(h('h3', '', '???'), h('div', '', `${SIDE()[n.side]} · ${L('정체 미상', 'Unknown')}`));
      box.append(h('div', 'none', L('아직 이 귀족이 누구인지 모릅니다. 국경 귀족·수도권 귀족은 처음부터 알려져 있고, 나머지는 접견에서 받는 소개(가까운 사이나 세력 대표), 충성도 첩보, 인연, 밀사 통로, 의심 소문 등으로 드러납니다.', 'You do not yet know who this noble is. Frontier and capital nobles are known from the start; the rest are revealed through introductions at audiences (from close acquaintances or faction leaders), loyalty intelligence, ties, envoy channels or rumours of suspicion.')));
      const acts = h('div', 'acts'), aud = h('button', '', L('접견', 'Audience')); aud.disabled = true; aud.title = L('누구인지 알아야 접견을 청할 수 있습니다', 'You must know who they are to request an audience'); acts.append(aud); box.append(acts);
      return;
    }
    if (!n) {
      box.append(h('h4', '', L('최근 소식', 'Recent news')));
      if (!D.notes || !D.notes.length) box.append(h('div', 'none', L('아직 기록이 없습니다. 분기(게임 90일)마다 귀족들의 마음이 정리됩니다.', 'Nothing yet. Nobles’ sentiments are tallied each quarter (90 game days).')));
      else { const ul = h('ul'); for (const x of D.notes) ul.append(h('li', '', `${x.d} · ${x.text}`)); box.append(ul); }
      box.append(h('div', 'none', L('귀족을 누르면 자세히 봅니다.', 'Pick a noble for details.')));
      return;
    }
    const head = h('div', 'head'), img = h('img'); img.src = n.pic; img.alt = ''; img.onerror = () => img.remove();
    const info = h('div'); info.append(h('h3', '', n.name));
    info.append(h('div', '', `${SIDE()[n.side]} · ${L('거점', 'Hub')} ${n.id} · ${SPEC()[n.spec] || n.spec}${n.border ? ' · ⚑ ' + L('국경', 'Border') : ''}`));
    const fac = n.fac ? facOf(n.side, n.fac) : null;
    if (fac) info.append(h('div', '', `${L('소속', 'Faction')}: ${fac.name}${fac.leader === n.id ? (fac.acting ? ' · ' + L('대표 대행', 'Acting leader') : ' · ' + L('대표', 'Leader')) : ''}`));
    const lo = h('div'); lo.append(document.createTextNode(L('충성: ', 'Loyalty: '))); if (n.fate) lo.append(h('b', '', n.fate)); else lo.append(stageChip(n)); info.append(lo);
    if (n.loyal === undefined && !n.fate) info.append(h('small', 'none', L('정확한 충성도는 첩보나 접견으로 알아내야 합니다.', 'The exact figure must be learned through espionage or an audience.')));
    head.append(img, info); box.append(head);
    box.append(h('h4', '', L('성격', 'Personality')));
    TRAITS().forEach(([pos, neg], i) => {
      const v = n.tr[i] || 0, row = h('div', 'tr'), track = h('div', 'track'), fill = h('i');
      const w = Math.abs(v) * 25; fill.style.width = w + '%'; fill.style.left = v >= 0 ? '50%' : (50 - w) + '%'; track.append(h('b'), fill);
      row.append(h('span', '', neg), track, h('span', '', pos)); box.append(row);
    });
    box.append(h('h4', '', L('관계', 'Relations')));
    box.append(h('div', '', `${L('자기 군주와', 'To own ruler')}: ${n.ruler} · ${L('나와', 'To me')}: ${n.me}`));
    if (n.intro) box.append(h('div', 'none', L(`이 사람은 우리가 아직 모르는 귀족 ${n.intro}명을 압니다 — 접견에서 소개를 청해 보세요.`, `Knows ${n.intro} noble(s) we have not met — ask for an introduction at an audience.`)));
    const ties = tiesOf(n.id); const ul = h('ul');
    for (const b of ties) { const o = byId(b.a === n.id ? b.b : b.a); ul.append(h('li', '', `${b.name} — ${o ? o.name : '?'} (${L('친밀도', 'Intimacy')}: ${b.stage})`)); }
    if (ties.length) box.append(ul); else box.append(h('div', 'none', L('알려진 인연이 없습니다.', 'No known ties.')));
    domainBlock(box, n);
    const mine = (D.notes || []).filter((x) => x.id === n.id);
    if (mine.length) { box.append(h('h4', '', L('기록', 'Record'))); const ul2 = h('ul'); for (const x of mine) ul2.append(h('li', '', `${x.d} · ${x.text}`)); box.append(ul2); }
    const acts = h('div', 'acts');
    const rel = h('button', '', mode === 'graph' ? L('세력판으로', 'Back to the board') : L('인물 관계도', 'Relationship chart')), aud = h('button', '', L('접견', 'Audience'));
    rel.onclick = (e) => { e.stopPropagation(); mode = mode === 'graph' ? 'board' : 'graph'; if (mode === 'board') focus = null; render(); };
    if (!window.sllm.auOpen || (n.fate && !(D.dom && D.dom.rebels && D.dom.rebels[n.id]))) aud.disabled = true; // 반란국 군주는 반란 뒤에도 만난다
    aud.onclick = () => { void meet({ kind: 'noble', id: n.id }); };
    acts.append(rel, aud); box.append(acts);
  }

  // ---- 인물 관계도 ----
  const NS = 'http://www.w3.org/2000/svg';
  let G = null; // { box, svg, nodes: Map<key, el>, anim }
  const relCol = (v) => (/^(서약|협약|신뢰|우호|Oathbound|Accord|Trusted|Cordial)/.test(v) ? '#8fc6ff' : /^(냉담|Cold)/.test(v) ? '#9aa0aa' : /^(경쟁자|숙적|Rival|Nemesis)/.test(v) ? '#ff5a5a' : '#c9c9c9');
  function graphModel(cid) {
    const c = byId(cid); if (!c) return null;
    const nodes = [{ key: 'n' + c.id, n: c, ring: 0 }], edges = [];
    const add = (key, extra) => { if (!nodes.some((x) => x.key === key)) nodes.push({ key, ...extra }); };
    // 둘레 1: 자기 군주 · 나(플레이어) · 알려진 인연
    add('r' + c.side, { ruler: c.side, ring: 1 }); edges.push({ a: 'n' + c.id, b: 'r' + c.side, col: relCol(c.ruler), label: c.ruler, dash: false });
    add('me', { me: true, ring: 1 }); edges.push({ a: 'n' + c.id, b: 'me', col: relCol(c.me), label: c.me, dash: false });
    const first = tiesOf(c.id);
    for (const t of first) { const o = byId(t.a === c.id ? t.b : t.a); if (!o) continue; add('n' + o.id, { n: o, ring: 1 }); edges.push({ a: 'n' + c.id, b: 'n' + o.id, col: KIND_COL[t.kind], label: t.name, dash: t.kind === 'back', w: 3 }); }
    // 둘레 2: 그 사람들의 알려진 인연(흐리게)
    for (const t of first) {
      const oid = t.a === c.id ? t.b : t.a;
      for (const u of tiesOf(oid)) { const x = u.a === oid ? u.b : u.a; if (x === c.id) continue; const o2 = byId(x); if (!o2) continue; add('n' + x, { n: o2, ring: 2 }); edges.push({ a: 'n' + oid, b: 'n' + x, col: KIND_COL[u.kind], label: '', dash: u.kind === 'back', w: 1.5, faint: true }); }
    }
    return { nodes, edges };
  }
  function layout(model, W, H) {
    const pos = new Map(), cx = W / 2, cy = H / 2, R1 = Math.min(W, H) * 0.30, R2 = Math.min(W, H) * 0.45;
    pos.set(model.nodes[0].key, [cx, cy]);
    const r1 = model.nodes.filter((x) => x.ring === 1), r2 = model.nodes.filter((x) => x.ring === 2);
    r1.forEach((x, i) => { const a = -Math.PI / 2 + (i / r1.length) * Math.PI * 2; pos.set(x.key, [cx + Math.cos(a) * R1 * 1.25, cy + Math.sin(a) * R1]); });
    // 둘레 2는 자기와 이어진 둘레 1 사람 바깥쪽에
    const parentOf = (k) => { const e = model.edges.find((e) => e.faint && e.b === k); return e ? e.a : null; };
    const cnt = new Map();
    for (const x of r2) {
      const p = parentOf(x.key), pp = p && pos.get(p); const i = (cnt.get(p) || 0); cnt.set(p, i + 1);
      const base = pp ? Math.atan2(pp[1] - cy, pp[0] - cx) : 0, a = base + (i - 0.5) * 0.35;
      pos.set(x.key, [cx + Math.cos(a) * R2 * 1.25, cy + Math.sin(a) * R2]);
    }
    for (const [k, [x, y]] of pos) pos.set(k, [Math.max(50, Math.min(W - 50, x)), Math.max(45, Math.min(H - 45, y))]);
    return pos;
  }
  function nodeEl(x) {
    const el = h('div', 'gn out'); const ph = h('div', 'ph');
    if (x.n) { ph.style.backgroundImage = `url("${x.n.pic}")`; el.append(ph, h('span', '', x.n.name + (x.n.border ? ' ⚑' : ''))); if (x.n.gone) el.classList.add('gone'); el.title = `${x.n.name} · ${x.n.fate || x.n.stageName}`; el.onclick = () => { sel = x.n.id; side = x.n.side; render(); }; }
    else if (x.me) { el.classList.add('ruler'); ph.textContent = '★'; el.append(ph, h('span', '', L('나(우리 통치자)', 'Me (our ruler)'))); }
    else { el.classList.add('ruler'); const R = RULER()[x.ruler]; const im = h('img'); im.src = `assets/scenario/corridor/ruler/ruler_${x.ruler}.png`; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:50% 12%;border-radius:50%'; im.onerror = () => { im.remove(); ph.textContent = '♛'; }; ph.append(im); el.append(ph, h('span', '', R.name)); if (window.sllm.auOpen) { el.style.cursor = 'pointer'; el.title = L('누르면 군주 접견', 'Click for an audience with the sovereign'); el.onclick = () => { void meet({ kind: 'ruler', side: x.ruler }); }; } }
    return el;
  }
  function graph(box) {
    box.classList.add('nb-graph');
    const cid = sel ?? (D.nobles.find((n) => n.side === side) || {}).id; if (cid === undefined) return;
    sel = cid;
    const model = graphModel(cid); if (!model) return;
    const svg = document.createElementNS(NS, 'svg'); box.append(svg);
    const leg = h('div', 'legend'); const KN = { oath: L('서약', 'Oathbound'), union: L('혼약', 'Union'), accord: L('협약', 'Accord'), rival: L('경쟁자', 'Rival'), back: L('비밀 회선', 'Back Channel') };
    for (const k of ['oath', 'union', 'accord', 'rival', 'back']) { const b = KN[k]; const s2 = h('span'); const i = h('i'); i.style.background = KIND_COL[k]; s2.append(i, document.createTextNode(b)); leg.append(s2); } box.append(leg);
    const prev = G && G.nodes ? G.nodes : new Map();
    const nodes = new Map();
    requestAnimationFrame(() => {
      const W = box.clientWidth, H = box.clientHeight, pos = layout(model, W, H);
      for (const x of model.nodes) {
        const el = nodeEl(x); el.classList.toggle('c', x.ring === 0); el.classList.toggle('r2', x.ring === 2);
        const old = prev.get(x.key); const start = old ? [old.x, old.y] : [W / 2, H / 2];
        el.style.left = start[0] + 'px'; el.style.top = start[1] + 'px'; box.append(el);
        const [tx, ty] = pos.get(x.key); nodes.set(x.key, { el, x: tx, y: ty });
        requestAnimationFrame(() => { el.classList.remove('out'); el.style.left = tx + 'px'; el.style.top = ty + 'px'; });
      }
      G = { nodes };
      const t0 = performance.now();
      const draw = () => { // 움직이는 동안 선을 따라 그린다
        svg.textContent = '';
        const br = box.getBoundingClientRect();
        const at = (k) => { const n = nodes.get(k); if (!n) return null; const r = n.el.getBoundingClientRect(); return [r.left - br.left + r.width / 2, r.top - br.top + r.height / 2 - 8]; };
        for (const e of model.edges) {
          const p = at(e.a), q = at(e.b); if (!p || !q) continue;
          const ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', p[0]); ln.setAttribute('y1', p[1]); ln.setAttribute('x2', q[0]); ln.setAttribute('y2', q[1]);
          ln.setAttribute('stroke', e.col); ln.setAttribute('stroke-width', e.w || 2); ln.setAttribute('opacity', e.faint ? 0.45 : 0.9); if (e.dash) ln.setAttribute('stroke-dasharray', '6 5');
          svg.append(ln);
          if (e.label) { const tx = document.createElementNS(NS, 'text'); tx.setAttribute('class', 'glab'); tx.setAttribute('x', (p[0] + q[0]) / 2); tx.setAttribute('y', (p[1] + q[1]) / 2); tx.setAttribute('text-anchor', 'middle'); tx.textContent = e.label; svg.append(tx); }
        }
        if (performance.now() - t0 < 650 && box.isConnected) requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });
  }

  function render() {
    const ov = $('nbWin'); if (!ov || !D) return; const book = ov.querySelector('.nb-book'); book.textContent = '';
    const top = h('div', 'nb-top'); const close = h('button', '', L('닫기', 'Close')); close.onclick = () => ov.remove();
    top.append(h('h3', '', L('제국 세력도', 'Atlas of Imperial Power')), h('small', '', D.date ? L('마지막 정리: ', 'Last tallied: ') + D.date : L('아직 정리 전', 'Not tallied yet')), h('span', 'sp'), close);
    const bar = h('div', 'nb-bar');
    for (const [m, t] of [['map', L('제국 세력지도', 'Map of power')], ['board', L('세력판', 'Power board')], ['graph', L('인물 관계도', 'Relationship chart')], ...(CN_SEAT ? [['cn', RWo('nobles')]] : [])]) { const b = h('button', mode === m ? 'on' : '', t); b.onclick = () => { mode = m; sel = mode === 'graph' ? sel : null; render(); }; bar.append(b); } // 명부는 지움(2026-11-07)
    bar.append(h('span', '', '│'));
    for (const s of ['a', 'b']) { const b = h('button', side === s && !(mode === 'board' && view === 'both') ? 'on' : '', SIDE()[s]); b.onclick = () => { side = s; sel = null; focus = null; if (view === 'both') view = 'one'; render(); }; bar.append(b); }
    if (window.sllm.auOpen) { const rb = h('button', '', L('군주 접견', 'Audience with the sovereign')); rb.title = L('지금 보고 있는 세력의 군주와 비밀회담', 'A private meeting with the sovereign of the power you are viewing'); rb.onclick = () => { void meet({ kind: 'ruler', side }); }; bar.append(rb); }
    const so = h('select'); [['loyal', L('충성 낮은 순', 'Least loyal first')], ['id', L('거점 번호 순', 'By hub number')], ['name', L('이름 순', 'By name')]].forEach(([v, t]) => { const o = h('option', '', t); o.value = v; if (v === sortBy) o.selected = true; so.append(o); });
    so.onchange = () => { sortBy = so.value; render(); };
    const cb = (txt, val, set) => { const l = h('label'), c = h('input'); c.type = 'checkbox'; c.checked = val; c.onchange = () => { set(c.checked); render(); }; l.append(c, document.createTextNode(' ' + txt)); return l; };
    if (mode === 'map') bar.append(h('span', '', '│'), ...mapBar());
    const pages = h('div', 'nb-pages'), left = h('div', 'nb-page'), right = h('div', 'nb-page nb-det');
    if (mode !== 'board') W = null; if (mode !== 'board' && mode !== 'map') DET = null; if (mode !== 'map' && MAP) { MAP.stop(); MAP = null; }
    book.classList.toggle('full-web', mode === 'board' || mode === 'map');
    if (mode === 'board' || mode === 'map') { pages.classList.add('web'); DET = right; right.classList.toggle('dossier', mode === 'map'); right.classList.toggle('hide', sel === null); right.onclick = (e) => e.stopPropagation(); right.onmousedown = (e) => e.stopPropagation(); }
    book.append(top, bar, pages); // 세력판은 크기를 재야 하므로 먼저 붙인다
    if (mode === 'cn') { G = null; pages.classList.add('cn-pages'); pages.append(left, right); void cnDraw(left, right); return; } // 회랑의 귀족(2026-11-08)
    if (mode === 'graph') graph(left); else if (mode === 'board') { G = null; board(left); } else if (mode === 'map') { G = null; mapView(left); } else { G = null; table(left); } detail(right); pages.append(left, right);
  }
  // ---- 회랑의 귀족(2026-11-08, 회랑 자리 판에서만): 화면은 ui/office-cnobles.js(처음 열 때 불러온다) ----
  let CN_SEAT = false;
  let CN_REALM = null; // 우리 나라 부르는 이름 묶음(scnCn 의 realm, 2026-11-08)
  const RWo = (k) => (CN_REALM && CN_REALM[k]) || ({ nobles: L('회랑의 귀족', 'Corridor nobles') })[k] || '';
  const cnScript = () => new Promise((res) => { if (window.SLLMCn) { res(true); return; } const sc = document.createElement('script'); sc.src = 'office-cnobles.js'; sc.onload = () => res(!!window.SLLMCn); sc.onerror = () => res(false); document.head.append(sc); });
  async function cnDraw(left, right) {
    if (!(await cnScript())) { left.append(h('div', 'none', L('화면을 불러오지 못했습니다.', 'Could not load the view.'))); return; }
    if (mode !== 'cn' || !left.isConnected) return;
    await window.SLLMCn.draw(left, right, { meet: (t) => { void meet(t); }, redraw: () => { if (mode === 'cn' && $('nbWin')) render(); } });
  }

  // 접견 장소 고르기(2026-11-08 사용자: 「접견도 장소가 더 다양했으면 — 고위식당, 정원, 고위 리무진(비행), 저택」). 군주는 늘 궁정.
  const VENUES = () => [
    ['room', L('응접실', 'Reception room'), L('늘 쓰던 자리입니다.', 'The usual room.'), 0],
    ['dining', L('상층 고급 식당', 'Sky-tier restaurant'), L('대접 — 요리사를 사 뒀다면 좋아하는 음식으로 크게 기뻐합니다. 남의 눈이 있어 밀사 이야기는 들키기 쉽습니다.', 'Hosting — if we bought the cook, their favorite dish delights them. Other diners make envoy talk easier to expose.'), 100],
    ['garden', L('정원', 'Garden'), L('조용히 걷는 자리 — 속마음과 숨은 인연을 흘리기도 합니다.', 'A quiet stroll — they may let slip feelings and hidden ties.'), 0],
    ['limo', L('비행 리무진', 'Flying limousine'), L('둘만의 밀폐된 자리 — 밀사 이야기가 거의 새지 않습니다. 상대 운전수를 사 둬야 합니다(우리 귀족은 언제나).', 'Sealed and private — envoy talk rarely leaks. Needs their chauffeur bought (always open for our own nobles).'), 0],
    ['manor', L('저택', 'Manor'), L('격식 있는 자리 — 집사를 사 뒀다면 서재의 서류를 엿봅니다.', 'A formal audience — with the butler bought, we peek at the papers in the study.'), 500],
  ];
  // 2026-11-08: 장소·차림표 덮개에 'fb'(가운데 정렬 transform·폭 820px·잘린 모서리) 클래스를 쓰면 화면 왼쪽 위로 밀려 잘렸다 → 따로 둔다.
  function pickVenue(t) {
    return new Promise((res) => {
      const ov = $('nbWin'); if (!ov) { res('room'); return; }
      const box = h('div', 'nb-pick'); box.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#000b;display:flex;align-items:center;justify-content:center'; // 화면 전체에(2026-11-08: 회랑의 귀족 칸에서 열면 잘려 보였다)
      const pane = h('div'); pane.style.cssText = 'width:min(620px,90vw);background:#04121c;border:1px solid #5fd4ff88;box-shadow:0 0 30px #2bb8ff44;padding:16px 18px;display:flex;flex-direction:column;gap:8px';
      pane.append(h('h3', '', L('어디에서 만날까요?', 'Where shall we meet?')));
      for (const [k, name, desc, cost] of VENUES()) {
        const b = h('button'); b.style.cssText = 'text-align:left;padding:8px 12px;display:flex;flex-direction:column;gap:2px';
        const top = h('b', '', name + (cost ? L(` · 에너지 ${cost}`, ` · ${cost} energy`) : '')); b.append(top, h('small', '', desc));
        b.onclick = (e) => { e.stopPropagation(); box.remove(); res(k); }; pane.append(b);
      }
      const x = h('button', '', L('그만두기', 'Cancel')); x.onclick = (e) => { e.stopPropagation(); box.remove(); res(null); }; pane.append(x);
      box.onclick = (e) => { if (e.target === box) { box.remove(); res(null); } };
      box.append(pane); ov.append(box);
    });
  }
  // 만찬 차림표(2026-11-08 사용자: 「음식을 모르는 상태에서도 음식을 대접해줘야」) — 귀족을 식당에서 만날 때 음식을 고른다
  async function pickDish(t) {
    let r = null; try { r = window.sllm.auMenu ? await window.sllm.auMenu({ id: t.id }) : null; } catch (e) { r = null; }
    if (!r || !r.ok || !r.dishes) return '';
    // 진짜 레스토랑 메뉴판(2026-11-08 사용자: 「진짜 음식 메뉴판처럼 — 이런 느낌으로」 사진: 링 바인더 · 세로 칸 제목 · 접시 그림 + 이름 + [영문] + 원산지 줄)
    // 칸(메인·수프와 식사·별미·디저트·음료)마다 한 쪽, 오른쪽 색인 탭으로 넘긴다. 음식 그림 칸은 그림이 오기 전까지 빈칸(food/dish_<id>.png).
    if (!$('nbMenuCss')) { const st = h('style'); st.id = 'nbMenuCss'; st.textContent =
      '#nbWin .mn-ov{position:fixed;inset:0;z-index:2147483000;background:radial-gradient(ellipse at 50% 40%,#1a120ccc,#000e);display:flex;align-items:center;justify-content:center}'
      + '#nbWin .mn-bind{position:relative;display:flex;height:min(92vh,980px);aspect-ratio:.86;max-width:94vw}'
      + '#nbWin .mn-cover{position:absolute;inset:-14px -40px -14px -18px;background:linear-gradient(135deg,#6f7a72,#4b554f);border-radius:6px;box-shadow:0 30px 80px #000,inset 0 0 0 2px #ffffff14;background-image:repeating-linear-gradient(45deg,#ffffff05 0 2px,transparent 2px 5px),linear-gradient(135deg,#6f7a72,#4b554f)}'
      + '#nbWin .mn-page{position:relative;flex:1;background:url(assets/scenario/corridor/food/menu_board.png) center/100% 100% no-repeat,#fbfaf6;box-shadow:inset 18px 0 24px -18px #0004,0 2px 8px #0006;padding:54px 46px 70px 74px;color:#2b2420;font-family:"Noto Sans KR","Malgun Gothic",sans-serif;display:flex;flex-direction:column;overflow:hidden}'
      + '#nbWin .mn-ring{position:absolute;left:-14px;width:46px;height:22px;border:5px solid #2a2a2a;border-left:none;border-radius:0 14px 14px 0;box-shadow:2px 2px 3px #0008}'
      + '#nbWin .mn-hole{position:absolute;left:18px;width:12px;height:12px;border-radius:50%;background:#d9d5cb;box-shadow:inset 1px 1px 2px #0006}'
      + '#nbWin .mn-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}'
      + '#nbWin .mn-vt{writing-mode:vertical-rl;text-orientation:upright;font-family:"Nanum Myeongjo","Batang",serif;font-size:22px;letter-spacing:.35em;color:#2b2420;line-height:1}'
      + '#nbWin .mn-en{border-left:2px solid #2b2420;padding-left:8px;margin-top:22px;font-size:14px;line-height:1.35;color:#2b2420}#nbWin .mn-en small{display:block;font-size:12px;color:#6a5f55}'
      + '#nbWin .mn-dots{flex:1;border-bottom:1px dotted #8a8075;margin-top:58px}'
      + '#nbWin .mn-grid{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:minmax(0,1fr);gap:14px 26px;align-content:start}'
      + '#nbWin .mn-it{position:relative;display:flex;align-items:center;gap:12px;min-height:118px;padding:6px 8px;cursor:pointer;background:transparent;border:1px solid transparent;border-radius:4px;color:inherit;font:inherit;text-align:left}'
      + '#nbWin .mn-it:hover{background:#efe9dc}#nbWin .mn-it.sel{background:#f3e6c9;border-color:#b98a3a;box-shadow:0 0 0 2px #b98a3a33}'
      + '#nbWin .mn-pic{position:relative;width:108px;height:92px;flex:none}#nbWin .mn-pic .pl{position:absolute;left:4px;top:4px;width:96px;height:80px;border-radius:50%;border:1.5px dashed #c9c0b2;background:#f4f1ea}'
      + '#nbWin .mn-pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 6px #0003)}'
      + '#nbWin .mn-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}'
      + '#nbWin .mn-nm{font-weight:700;font-size:15.5px;border-bottom:1px solid #b9b0a3;padding-bottom:3px;position:relative}#nbWin .mn-nm::before{content:"";position:absolute;left:-12px;bottom:-1px;width:12px;border-bottom:1px solid #b9b0a3;transform:rotate(-35deg);transform-origin:right}'
      + '#nbWin .mn-eng{font-size:11px;letter-spacing:.04em;color:#5a5048}'
      + '#nbWin .mn-mk{font-size:13px;font-weight:700;margin-top:4px}#nbWin .mn-mk.fav{color:#b06f10}#nbWin .mn-mk.hate{color:#a33a24}'
      + '#nbWin .mn-orig{margin-top:auto;text-align:right;font-size:11.5px;color:#3a322c}#nbWin .mn-orig b{font-weight:600}'
      + '#nbWin .mn-tabs{position:absolute;right:-36px;top:70px;display:flex;flex-direction:column;gap:6px;z-index:2}'
      + '#nbWin .mn-tab{width:36px;padding:12px 0;writing-mode:vertical-rl;font-size:12.5px;letter-spacing:.15em;border:none;border-radius:0 6px 6px 0;cursor:pointer;color:#2b2420;background:#d8cfbd;box-shadow:2px 2px 4px #0005;font-family:inherit}'
      + '#nbWin .mn-tab.on{background:#fbfaf6;font-weight:700}#nbWin .mn-tab:nth-child(1){background-color:#e9c9a8}#nbWin .mn-tab:nth-child(2){background-color:#d9d0a0}#nbWin .mn-tab:nth-child(3){background-color:#b9cfb0}#nbWin .mn-tab:nth-child(4){background-color:#e6b8bd}#nbWin .mn-tab:nth-child(5){background-color:#b8c8dc}#nbWin .mn-tab.on{filter:brightness(1.12)}'
      + '#nbWin .mn-foot{position:absolute;left:74px;right:46px;bottom:18px;display:flex;align-items:center;gap:12px;border-top:1px solid #d6cfc3;padding-top:10px;font-size:13px;color:#4a4038}'
      + '#nbWin .mn-foot .sp{flex:1}#nbWin .mn-foot button{font-family:inherit;font-size:13.5px;padding:7px 18px;background:#2b2420;color:#fbfaf6;border:1px solid #2b2420;cursor:pointer}#nbWin .mn-foot button.ghost{background:transparent;color:#2b2420}#nbWin .mn-foot button:disabled{opacity:.35;cursor:default}'
      + '#nbWin .mn-note{font-size:11.5px;color:#7a6f64;margin:-12px 0 12px}';
      document.head.append(st); }
    return new Promise((res) => {
      const ov = $('nbWin'); if (!ov) { res(''); return; }
      const box = h('div', 'mn-ov'), bind = h('div', 'mn-bind'), page = h('div', 'mn-page'), tabs = h('div', 'mn-tabs');
      bind.append(h('div', 'mn-cover'), page, tabs);
      let cat = (r.cats && r.cats[0] && r.cats[0].k) || 'main', pick = '';
      const foot = h('div', 'mn-foot'), chosen = h('span', '', L('아직 고르지 않았습니다', 'Nothing chosen yet')), sp = h('span', 'sp');
      const x = h('button', 'ghost', L('그만두기', 'Cancel')), order = h('button', '', L('주문하고 손님 맞기', 'Order and receive the guest')); order.disabled = true;
      foot.append(chosen, sp, x, order);
      const draw = () => {
        page.textContent = '';
        for (const y of [0.12, 0.5, 0.88]) { const rg = h('div', 'mn-ring'); rg.style.top = `calc(${y * 100}% - 11px)`; const ho = h('div', 'mn-hole'); ho.style.top = `calc(${y * 100}% - 6px)`; page.append(ho, rg); }
        const c = (r.cats || []).find((z) => z.k === cat) || { name: cat, en: cat };
        const head = h('div', 'mn-head'), en = h('div', 'mn-en'); en.append(document.createTextNode(c.en)); en.append(h('small', '', L('귀빈 만찬 · 1인 차림', 'Guest dinner · one setting')));
        head.append(h('div', 'mn-vt', String(c.name).replace(/\s+/g, '')), en, h('div', 'mn-dots')); page.append(head);
        if (cat === (r.cats && r.cats[0] && r.cats[0].k)) page.append(h('div', 'mn-note', r.cook ? L('★ 좋아하는 음식 · ✕ 싫어하는 음식 — 매수한 요리사의 귀띔', '★ favorite · ✕ disliked — whispered by our bought cook') : L('손님의 입맛은 모릅니다. 그 종족이 즐기는 음식이면 대개 맞습니다 — 차림표 어딘가에 손님이 싫어하는 음식도 하나 있습니다.', 'We do not know the guest\'s taste. Food their species enjoys usually suits them — and somewhere on this menu is a dish they dislike.')));
        const grid = h('div', 'mn-grid');
        for (const d of r.dishes.filter((z) => z.cat === cat)) {
          const it = h('button', 'mn-it' + (pick === d.key ? ' sel' : '')); it.type = 'button';
          const pic = h('div', 'mn-pic'); pic.append(h('div', 'pl')); if (d.pic) { const im = h('img'); im.alt = ''; im.onerror = () => im.remove(); im.src = d.pic; pic.append(im); } // 그림 칸 — 그림이 오기 전까지 빈 접시 자리
          const tx = h('div', 'mn-tx'); tx.append(h('div', 'mn-nm', L(d.name, d.en)), h('div', 'mn-eng', `[${String(d.en).toUpperCase()}]`));
          if (d.fav) tx.append(h('div', 'mn-mk fav', L('★ 좋아하는 음식', '★ Favorite'))); else if (d.hate) tx.append(h('div', 'mn-mk hate', L('✕ 싫어하는 음식', '✕ Disliked')));
          const og = h('div', 'mn-orig'); og.append(h('b', '', L('즐기는 종족: ', 'Enjoyed by: ')), document.createTextNode(d.likes)); tx.append(og);
          it.append(pic, tx);
          it.onclick = (e) => { e.stopPropagation(); pick = d.key; chosen.textContent = L(`주문: ${d.name}`, `Order: ${d.en}`); order.disabled = false; draw(); };
          grid.append(it);
        }
        page.append(grid, foot);
        tabs.textContent = '';
        for (const z of r.cats || []) { const b = h('button', 'mn-tab' + (z.k === cat ? ' on' : ''), z.name); b.type = 'button'; b.onclick = (e) => { e.stopPropagation(); cat = z.k; draw(); }; tabs.append(b); }
      };
      order.onclick = (e) => { e.stopPropagation(); if (!pick) return; box.remove(); res(pick); };
      x.onclick = (e) => { e.stopPropagation(); box.remove(); res(null); };
      box.onclick = (e) => { if (e.target === box) { box.remove(); res(null); } };
      draw(); box.append(bind); box.style.position = 'fixed'; box.style.zIndex = '2147483000';
      ov.append(box);
    });
  }
  async function meet(t) {
    if (t && t.kind !== 'ruler' && !t.venue) { const v = await pickVenue(t); if (!v) return; t = { ...t, venue: v }; }
    if (t && t.kind === 'noble' && t.venue === 'dining' && t.dish === undefined) { const d = await pickDish(t); if (d === null) return; t = { ...t, dish: d }; }
    let r = null; try { r = await window.sllm.auOpen(t); } catch (e) { r = { ok: false, error: String(e) }; }
    if (!r || !r.ok) { const ov = $('nbWin'); const m = h('div', 'nb-warn', (r && r.error) || L('지금은 만날 수 없습니다.', 'Cannot meet right now.')); m.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);padding:8px 14px;background:#2a1a12;border:1px solid #ff9a6a;color:#ffd6c2;z-index:2'; if (ov) { ov.querySelector('.nb-book').style.position = 'relative'; ov.querySelector('.nb-book').append(m); setTimeout(() => m.remove(), 3500); } }
  }

  async function openBook() {
    let r = null; try { r = await window.sllm.scnNobles(); } catch (e) { r = null; }
    if (!r || !r.ok || !r.on) return;
    D = markDead(r); css(); $('nbWin')?.remove();
    CN_SEAT = false; if (window.sllm.scnCn) { try { const c = await window.sllm.scnCn(); CN_SEAT = !!(c && c.ok && c.seat); CN_REALM = c && c.realm ? c.realm : null; if (CN_SEAT && window.SLLMCn) window.SLLMCn.reset(); if (!CN_SEAT && mode === 'cn') mode = 'map'; } catch (e) { CN_SEAT = false; } }
    const ov = h('div'); ov.id = 'nbWin'; ov.setAttribute('data-i18n-skip', ''); const book = h('div', 'nb-book'); ov.append(book);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    document.body.append(ov); render();
    // 전체 화면(2026-11-07 사용자: 「제국 지도도 전체화면으로」) — 닫으면 원래대로
    let fsMine = false; try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().then(() => { fsMine = true; }).catch(() => {}); } } catch (e) { /* 안 되면 창 크기 그대로 */ }
    new MutationObserver((m, o) => { if (!document.body.contains(ov)) { if (MAP) { MAP.stop(); MAP = null; } if (fsMine && document.fullscreenElement) document.exitFullscreen().catch(() => {}); o.disconnect(); } }).observe(document.body, { childList: true }); // 창을 닫으면 지도 다시 읽기를 멈춘다
  }

  async function sync() {
    if (!window.sllm || !window.sllm.scnNobles) return;
    let on = false; try { const r = await window.sllm.scnNobles(); on = !!(r && r.ok && r.on); } catch (e) { on = false; }
    const g = $('nbGrp');
    if (!on) { if (g) g.remove(); return; }
    if (g) return;
    const icons = $('icons'); if (!icons) return;
    const grp = h('div', 'grp'); grp.id = 'nbGrp'; const title = h('h2', '', L('회랑의 삼파전', 'The Corridor Triangle')); title.setAttribute('data-i18n-skip', ''); const row = h('div', 'row'); grp.append(title, row);
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'nbCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10c6-2 11-1 16 3 5-4 10-5 16-3v28c-6-2-11-1-16 3-5-4-10-5-16-3z"/><path d="M24 13v28"/><circle cx="16" cy="21" r="3"/><path d="M12 30c1-3 2.5-4 4-4s3 1 4 4"/><path d="M28 20h8M28 25h8M28 30h6"/></svg>';
    b.append(h('span', '', L('제국 세력도', 'Power Atlas')));
    b.onclick = () => { void openBook(); };
    row.append(b); icons.prepend(grp);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { void sync(); }, 450);
    setInterval(() => { void sync(); }, 30000); // 세이브를 불러오거나 바꾸면 칸이 생기거나 사라진다
    document.addEventListener('sllm-language', () => {
      const g = $('nbGrp'); if (g) { g.querySelector('h2').textContent = L('회랑의 삼파전', 'The Corridor Triangle'); const s = g.querySelector('#nbCall span'); if (s) s.textContent = L('제국 세력도', 'Power Atlas'); }
      if ($('nbWin')) render();
    });
  });
})();
