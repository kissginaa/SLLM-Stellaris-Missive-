// 해외발 여론 공작 현황(2026-11-04 사용자) — 집무실 「첩보 보고」 화면 왼쪽 위에 작은 칸. 앱: src/features/cyber-app.ts(cyberState)
// 본문(office-embassy.js)은 건드리지 않는다: #embRoot 가 다시 그려질 때마다 첩보 탭이면 칸을 덧붙인다. 문구는 L(한, 영)만 — 언어 팩 호환.
// 역제소(2026-11-04 사용자): 칸의 「은하재판소에 제소」 → 재판 창(증거물·발언 최대 3번·판결). 증거가 없어도 걸 수 있지만 거의 진다.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = () => { if (document.getElementById('cyCss')) return; const st = h('style'); st.id = 'cyCss'; st.textContent =
    '#cyBox{margin:0 0 8px;padding:8px 10px;border:1px solid #c0392b88;background:#c0392b14;font-size:12.5px;line-height:1.45}'
    + '#cyBox b{display:block;font-weight:600;margin-bottom:3px}#cyBox .cy-bar{display:flex;gap:3px;margin:5px 0}#cyBox .cy-bar i{flex:1;height:6px;background:#8884}#cyBox .cy-bar i.on{background:#e74c3c}'
    + '#cyBox small{display:block;opacity:.75}#cyBox ul{margin:4px 0 0;padding-left:16px;opacity:.8}#cyBox.calm{border-color:#8885;background:none}#cyBox button{margin-top:6px;font-size:12px;padding:3px 8px;cursor:pointer}'
    + '#cyTrial{position:fixed;inset:0;z-index:9000;background:#000a;display:flex;align-items:center;justify-content:center}'
    + '#cyTrial .ct-box{width:min(640px,92vw);max-height:86vh;display:flex;flex-direction:column;gap:8px;padding:16px 18px;background:#14161c;color:#e8e4d8;border:1px solid #b8975a;font-size:13px;line-height:1.5}'
    + '#cyTrial h3{margin:0;font-size:16px;color:#e0c48a}#cyTrial .ct-ex{margin:0;padding-left:18px;opacity:.85}#cyTrial .ct-none{color:#e07a6a}'
    + '#cyTrial .ct-log{flex:1;overflow:auto;min-height:120px;border-top:1px solid #b8975a55;border-bottom:1px solid #b8975a55;padding:6px 0}'
    + '#cyTrial .ct-log p{margin:4px 0}#cyTrial .ct-log .us b{color:#8fc9ff}#cyTrial .ct-log .def b{color:#ff9d8a}#cyTrial .ct-log .judge{font-style:italic;color:#e0c48a}'
    + '#cyTrial textarea{width:100%;box-sizing:border-box;min-height:58px;background:#0d0f13;color:inherit;border:1px solid #555;padding:6px;font:inherit}'
    + '#cyTrial .ct-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#cyTrial .ct-row .sp{flex:1}#cyTrial button{padding:5px 12px;cursor:pointer}#cyTrial .ct-msg{min-height:1em;opacity:.85}'
    + '#cyTrial .ct-ruling{padding:8px 10px;border:1px solid #b8975a;background:#b8975a1a}#cyTrial .ct-ruling.won b{color:#7fd88f}#cyTrial .ct-ruling.lost b{color:#ff8a7a}';
    document.head.append(st); };
  const STAGE = [L('수상한 게시물', 'Suspicious posts'), L('확산', 'Spreading'), L('여론 포위', 'Under siege')];
  const RES = { 0: L('알 수 없음', 'Unknown'), 1: L('격퇴', 'Repelled'), 2: L('장악당함', 'Lost') };
  const odds = (p) => (p < 0.2 ? L('거의 질 것', 'almost certainly lose') : p < 0.4 ? L('불리함', 'unlikely') : p < 0.6 ? L('반반', 'even') : p < 0.75 ? L('유리함', 'likely') : L('매우 유리함', 'very likely'));
  let busy = false;

  function trialWin(S) {
    document.getElementById('cyTrial')?.remove(); const c = S && S.cur, t = c && c.trial; if (!t) return;
    const ov = h('div'); ov.id = 'cyTrial'; ov.setAttribute('data-i18n-skip', ''); const box = h('div', 'ct-box'); ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    box.append(h('h3', '', L(`은하재판소 — ${c.name}의 여론 공작 사건`, `Galactic Tribunal — the ${c.name} disinformation case`)));
    box.append(h('small', '', L('원고: 우리 제국 · 피고: ', 'Plaintiff: our empire · Defendant: ') + c.name + L(' 대사', '\'s ambassador')));
    if (t.exhibits.length) { box.append(h('b', '', L(`제출한 증거물 ${t.exhibits.length}개`, `${t.exhibits.length} exhibits filed`))); const ul = h('ul', 'ct-ex'); for (const e of t.exhibits) ul.append(h('li', '', L(e[0], e[1]))); box.append(ul); }
    else box.append(h('div', 'ct-none', L('제출한 증거가 없습니다. 의심만으로 맞서야 합니다.', 'No evidence filed. You face the court on suspicion alone.')));
    const log = h('div', 'ct-log');
    for (const x of t.log) { const p = h('p', x.who); if (x.who !== 'judge') p.append(h('b', '', x.who === 'us' ? L('원고: ', 'Plaintiff: ') : L('피고: ', 'Defendant: '))); p.append(document.createTextNode(x.who === 'judge' ? L('재판장: ', 'Judge: ') + x.text : x.text)); log.append(p); }
    if (!t.log.length) log.append(h('p', 'judge', L('재판장: 원고는 진술하십시오.', 'Judge: The plaintiff may begin.')));
    box.append(log);
    const msg = h('div', 'ct-msg');
    if (t.state === 'open') {
      const left = S.says - t.says, ta = h('textarea'); ta.maxLength = 500; ta.placeholder = left > 0 ? L('증거를 들어 공작을 입증하세요.', 'Make your case — cite the evidence.') : L('발언 기회를 다 썼습니다.', 'No statements left.'); ta.disabled = left <= 0;
      const say = h('button', '', L(`발언 (${left}번 남음)`, `Speak (${left} left)`)), ver = h('button', '', L('판결 받기', 'Hear the verdict'));
      say.disabled = left <= 0;
      const lock = (on) => { say.disabled = on || left <= 0; ver.disabled = on; ta.disabled = on || left <= 0; };
      say.onclick = async () => { const v = ta.value.trim(); if (!v) return; lock(true); msg.textContent = L('피고 측이 반박을 준비합니다…', 'The defence is preparing a rebuttal…'); let r; try { r = await window.sllm.cyberTrialSay(v); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } if (r && r.ok) { trialWin(r.view); refresh(); } else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); lock(false); } };
      ver.onclick = async () => { lock(true); msg.textContent = L('재판관들이 합의 중입니다…', 'The judges are deliberating…'); let r; try { r = await window.sllm.cyberTrialVerdict(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } if (r && r.ok) { trialWin(r.view); refresh(); } else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); lock(false); } };
      const row = h('div', 'ct-row'); row.append(h('small', 'sp', L('지금 판세: ', 'Current outlook: ') + odds(t.p)), say, ver);
      box.append(ta, row, h('small', '', L(`제소 비용 영향력 ${S.fee}. 지면 영향력 ${S.loseFee}을 더 잃고 공작이 탄력을 받습니다. 이기면 공작이 빠르게 걷히고 다른 제국들이 ${c.name}을(를) 싫어하게 됩니다.`, `Filing costs ${S.fee} influence. Losing costs ${S.loseFee} more and the campaign gains momentum. Winning drives the campaign back fast and turns other empires against ${c.name}.`)));
    } else {
      const r = h('div', 'ct-ruling ' + t.state); r.append(h('b', '', t.state === 'won' ? L('유죄 판결', 'Guilty') : L('기각', 'Dismissed')), h('div', '', t.ruling || '')); box.append(r);
    }
    const close = h('button', '', L('닫기', 'Close')); close.onclick = () => ov.remove(); const row2 = h('div', 'ct-row'); row2.append(msg); row2.firstChild.classList.add('sp'); row2.append(close); box.append(row2);
    document.body.append(ov); log.scrollTop = log.scrollHeight;
  }
  function refresh() { document.getElementById('cyBox')?.remove(); void add(); }

  async function add() {
    const root = document.getElementById('embRoot'), tt = document.getElementById('embTitle');
    if (busy || !root || !tt || tt.textContent !== L('첩보 보고', 'Espionage Reports')) return;
    const side = root.querySelector('.emb-side'); if (!side || document.getElementById('cyBox')) return;
    busy = true; let S = null; try { S = await window.sllm.cyberState(); } catch (e) { S = null; } busy = false;
    if (!S || !S.ok || (!S.cur && !S.past.length) || document.getElementById('cyBox') || !side.isConnected) return;
    css();
    const box = h('div', S.cur ? '' : 'calm'); box.id = 'cyBox'; box.setAttribute('data-i18n-skip', '');
    if (S.cur) {
      const c = S.cur; box.append(h('b', '', L('⚠ 해외발 여론 공작 진행 중', '⚠ Foreign disinformation campaign')), h('span', '', L(`배후 의심: ${c.name}`, `Suspected: ${c.name}`)));
      const bar = h('div', 'cy-bar'); for (let i = 1; i <= 3; i++) bar.append(h('i', i <= c.stage ? 'on' : '')); box.append(bar);
      box.append(h('small', '', L('단계: ', 'Stage: ') + (STAGE[c.stage - 1] || STAGE[0]) + ' · ' + L('대응: ', 'Response: ') + L(c.apName[0], c.apName[1])), h('small', '', L(`${c.start} 시작 · 대응은 게임의 「상황」 화면에서 바꿉니다.`, `Since ${c.start} · Change the response in the game's Situations screen.`)));
      if (!c.trial) {
        box.append(h('small', '', L(`모은 증거 ${c.evNow}개 · 제소하면 ${odds(c.chance)}`, `Evidence: ${c.evNow} · In court you would ${odds(c.chance)}`)));
        const b = h('button', '', L('은하재판소에 제소', 'Take them to the Galactic Tribunal')); b.type = 'button'; b.disabled = !S.running; if (!S.running) b.title = L('게임이 켜져 있어야 합니다.', 'The game must be running.');
        b.onclick = async () => { b.disabled = true; let r; try { r = await window.sllm.cyberTrialStart(); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; } if (r && r.ok) { trialWin(r.view); refresh(); } else { b.disabled = false; b.title = (r && r.error) || ''; alertLine(box, (r && r.error) || L('실패했습니다.', 'Failed.')); } };
        box.append(b);
      } else {
        const b = h('button', '', c.trial.state === 'open' ? L('재판 계속하기', 'Continue the hearing') : c.trial.state === 'won' ? L('판결: 유죄 — 다시 보기', 'Verdict: guilty — view') : L('판결: 기각 — 다시 보기', 'Verdict: dismissed — view')); b.type = 'button'; b.onclick = () => trialWin(S); box.append(b);
      }
    } else box.append(h('b', '', L('지난 여론 공작', 'Past disinformation campaigns')));
    if (S.past.length) { const ul = h('ul'); for (const p of S.past.slice(0, 3)) ul.append(h('li', '', `${p.end || p.start} · ${p.name} — ${RES[p.res] || RES[0]}${p.trial && p.trial.state !== 'open' ? (p.trial.state === 'won' ? L(' · 재판 승소', ' · won in court') : L(' · 재판 패소', ' · lost in court')) : ''}`)); box.append(ul); }
    side.prepend(box);
  }
  const alertLine = (box, text) => { let m = box.querySelector('.cy-err'); if (!m) { m = h('small', 'cy-err'); box.append(m); } m.textContent = text; };
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.cyberState) return;
    const watch = () => { const root = document.getElementById('embRoot'); if (!root) return setTimeout(watch, 300); new MutationObserver(() => { void add(); }).observe(root, { childList: true }); void add(); };
    watch();
  });
})();
