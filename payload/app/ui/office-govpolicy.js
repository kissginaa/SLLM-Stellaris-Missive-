// 총독에게 행성 맡기기(2026-11-03 사용자) — 집무실 「행성 총독」 칸의 「행성 맡기기」. 앱: src/features/govpolicy-app.ts · 규칙: src/govpolicy.ts
// 화면을 열 때만 행성 목록을 읽는다. 총독 말은 틀 문장(LLM 없음). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const TEMPER = { frugal: ['꼼꼼함', 'Careful'], normal: ['보통', 'Steady'], bold: ['대담함', 'Bold'] };
  const css = () => { if (document.getElementById('gpCss')) return; const st = h('style'); st.id = 'gpCss'; st.textContent = [
    '#gpRoot{display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding:12px 16px}',
    '#gpRoot .gp-note{font-size:12px;opacity:.75;line-height:1.6}',
    '#gpRoot .gp-warn{font-size:12.5px;padding:8px 10px;border:1px solid #ffb35c88;border-radius:6px;background:#ffb35c14}',
    '#gpRoot .gp-list{display:flex;flex-direction:column;gap:6px}',
    '#gpRoot .gp-row{display:grid;grid-template-columns:1.3fr 1.2fr .9fr;gap:8px;align-items:center;text-align:left;padding:8px 10px;border:1px solid color-mix(in srgb,var(--hi) 35%,transparent);border-radius:6px;background:color-mix(in srgb,var(--hi) 6%,transparent);color:var(--text);cursor:pointer}',
    '#gpRoot .gp-row:hover,#gpRoot .gp-row.on{background:color-mix(in srgb,var(--hi) 16%,transparent)}',
    '#gpRoot .gp-row small{display:block;opacity:.65;font-size:11px}',
    '#gpRoot .gp-pol{justify-self:end;font-size:12px;padding:2px 9px;border-radius:10px;border:1px solid color-mix(in srgb,var(--hi) 50%,transparent)}',
    '#gpRoot .gp-pol.off{opacity:.55;border-style:dashed}',
    '#gpRoot .gp-pol.vet{border-color:#ffd36b;color:#ffe9a8}',
    '#gpRoot .gp-buff{font-size:12px;margin:0 0 10px;padding:6px 10px;border-radius:6px;background:color-mix(in srgb,var(--hi) 10%,transparent);line-height:1.6}',
    '#gpRoot .gp-detail{padding:10px 12px;border:1px solid var(--hi);border-radius:8px;background:color-mix(in srgb,var(--hi) 8%,transparent)}',
    '#gpRoot .gp-say{margin:6px 0 10px;padding:8px 12px;border-left:3px solid var(--hi);font-size:13.5px;line-height:1.6}',
    '#gpRoot .gp-say b{display:block;font-size:11.5px;opacity:.7;margin-bottom:2px}',
    '#gpRoot .gp-btns{display:flex;flex-wrap:wrap;gap:6px}',
    '#gpRoot button.gp-b{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 12%,transparent);color:var(--text);border-radius:5px;padding:5px 11px;cursor:pointer;font-size:12.5px}',
    '#gpRoot button.gp-b.rec{box-shadow:0 0 0 1px #ffd36b inset}',
    '#gpRoot button.gp-b.cur{background:color-mix(in srgb,var(--hi) 40%,transparent);font-weight:700}',
    '#gpRoot button.gp-b:disabled{opacity:.45;cursor:default}',
    '#gpRoot .gp-quota{margin-top:12px;padding:8px 10px;border:1px dashed color-mix(in srgb,var(--hi) 55%,transparent);border-radius:6px;font-size:12.5px;line-height:1.6}',
    '#gpRoot .gp-quota b{display:block;margin-bottom:2px}',
    '#gpRoot .gp-qbar{display:flex;gap:3px;margin:6px 0}',
    '#gpRoot .gp-qbar span{flex:1;height:6px;border-radius:3px;background:color-mix(in srgb,var(--hi) 18%,transparent)}',
    '#gpRoot .gp-qbar span.done{background:var(--hi)}',
    '#gpRoot .gp-qbar span.now{background:#ffd36b}',
    '#gpRoot .gp-pol .gp-q{margin-left:4px;color:#ffd36b}',
  ].join(''); document.head.append(st); };

  async function mount(root, live) {
    css(); root.id = 'gpRoot'; root.textContent = ''; root.append(h('div', 'gp-note', L('행성 목록을 읽는 중…', 'Reading the planet list…')));
    let S; try { S = await window.sllm.govPolState(live ? { live: true } : undefined); } catch (e) { S = { ok: false, error: String(e && e.message || e) }; }
    root.textContent = '';
    root.append(h('div', 'gp-note', L('행성을 총독에게 맡기면 총독이 방침대로 지구·구역·건물을 직접 짓습니다(게임의 행성 자동화를 켤 필요 없음). 한 번에 하나씩, 게임과 같은 비용을 국고에서 내고 게임과 비슷한 기간이 걸립니다. 공사 중인 것은 게임 건설 대기열에 보이지 않고 다 지어지면 나타나며, 자리가 없어 못 지으면 비용을 돌려받습니다. 총독 관할 효과(건설 속도·생산 소폭)가 붙고, 1년이 지나면 총독이 손에 익어 효과가 더 붙습니다. 방침을 거두면 짓던 것만 마무리합니다.',
      'Hand a planet to its governor and the governor builds districts, zones and buildings by the mandate (no planet automation needed). One project at a time: it pays the same cost as the game from your stockpile and takes about as long. Projects do not show in the game\'s construction queue and appear when finished; if there is no room, the cost is refunded. A small mandate bonus (build speed, output) applies, and after a year the governor becomes seasoned and the bonus grows. Withdrawing the mandate only finishes the current project.')));
    if (!S || !S.ok) { root.append(h('div', 'gp-warn', (S && S.error) || L('행성 목록을 읽지 못했습니다.', 'Could not read the planet list.'))); return; }
    if (S.source) { // 2026-11-03 세이브 읽기: 어디서 읽었는지 + 게임에 다시 묻기
      const src = h('div', 'gp-note gp-src'); src.append(document.createTextNode(S.source.kind === 'save' ? L(`자동 저장(${S.source.date}) 기준 — 게임에 묻지 않고 읽었습니다. `, `As of the autosave (${S.source.date}) — read without asking the game. `) : L('게임에서 방금 읽었습니다. ', 'Just read from the game. ')));
      if (S.source.kind === 'save') { const re = h('button', 'gp-b', L('게임에서 다시 읽기', 'Read from the game now')); re.type = 'button'; re.onclick = () => mount(root, true); src.append(re); }
      root.append(src);
    }
    if (S.oldMod) { root.append(h('div', 'gp-warn', L('연결 모드가 예전 버전이라 행성 번호를 받지 못했습니다. 창작마당 모드를 업데이트하고 게임을 다시 켜 주세요.', 'The connection mod is out of date, so planets have no ID yet. Update the Workshop mod and restart the game.'))); }
    const pol = (id) => S.policies.find((p) => p.id === id);
    const list = h('div', 'gp-list'), detail = h('div', 'gp-detail'); detail.hidden = true; root.append(list, detail);
    let sel = null;
    const drawList = () => { list.textContent = '';
      for (const p of S.planets) {
        const r = h('button', 'gp-row' + (sel === p ? ' on' : '')); r.type = 'button';
        const a = h('span', '', (p.capital ? '★ ' : '') + p.name); a.append(h('small', '', p.type || ''));
        const b = h('span', '', p.governor); b.append(h('small', '', L(`기질: ${TEMPER[p.temper][0]}`, `Temper: ${TEMPER[p.temper][1]}`)));
        const c = h('span', 'gp-pol' + (p.policy ? '' : ' off') + (p.veteran ? ' vet' : ''), p.policy ? `${pol(p.policy).icon} ${pol(p.policy).name}${p.veteran ? ' · ' + L('숙련', 'Seasoned') : ''}` : L('직접 관리', 'Self-managed'));
        if (p.quota && p.quota.on) c.append(h('span', 'gp-q', '⚒' + (p.quota.ph ? p.quota.ph : ''))); // 행성 할당량(2026-11-05)
        r.append(a, b, c); r.onclick = () => { sel = p; drawList(); drawDetail(); }; list.append(r);
      }
      if (!S.planets.length) list.append(h('div', 'gp-note', L('다스리는 행성이 없습니다.', 'You govern no planets.')));
    };
    const drawDetail = (said) => { const p = sel; if (!p) { detail.hidden = true; return; } detail.hidden = false; detail.textContent = '';
      const say = h('div', 'gp-say'); say.append(h('b', '', `${p.governor} · ${p.name}`), document.createTextNode(said || (p.say + (p.policy ? '' : ' ' + p.temperSay)))); detail.append(say);
      const B = S.buff || {}, buff = h('div', 'gp-buff');
      buff.append(h('b', '', L('총독 관할 효과', 'Mandate effects')), document.createTextNode(' ' + L(`건설 속도 +${B.build}% · 방침 직업 생산 +${B.prod}%`, `Build speed +${B.build}% · mandate jobs output +${B.prod}%`) + (p.temper === 'frugal' ? L(` · 건설비 -${B.frugalCost}%`, ` · building cost -${B.frugalCost}%`) : p.temper === 'bold' ? L(` · 건설 속도 +${B.boldBuild}%`, ` · build speed +${B.boldBuild}%`) : '')
        + ' · ' + (p.veteran ? L(`숙련: 건설 속도 +${B.vetBuild}% · 모든 직업 생산 +${B.vetProd}% (적용 중)`, `Seasoned: build speed +${B.vetBuild}% · all jobs output +${B.vetProd}% (active)`) : p.policy && p.toVeteran !== null ? L(`숙련까지 약 ${p.toVeteran}개월 (1년 맡기면 건설 속도 +${B.vetBuild}% · 모든 직업 생산 +${B.vetProd}%)`, `About ${p.toVeteran} month(s) to seasoned (after a year: build speed +${B.vetBuild}%, all jobs +${B.vetProd}%)`) : L(`1년 맡기면 숙련: 건설 속도 +${B.vetBuild}% · 모든 직업 생산 +${B.vetProd}%. 방침을 바꾸면 처음부터 다시 익힙니다.`, `After a year it becomes seasoned: build speed +${B.vetBuild}%, all jobs +${B.vetProd}%. Changing the mandate starts over.`))));
      detail.append(buff);
      const btns = h('div', 'gp-btns'), msg = h('div', 'gp-note'); detail.append(btns, msg);
      const send = async (policy) => { for (const b of btns.querySelectorAll('button')) b.disabled = true; msg.textContent = L('게임에 전하는 중…', 'Sending to the game…');
        let r; try { r = await window.sllm.govPolSet({ idx: p.idx, policy }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
        if (r && r.ok) { Object.assign(p, r.planet); drawList(); drawDetail(r.say); } else { msg.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); for (const b of btns.querySelectorAll('button')) b.disabled = false; } };
      for (const x of S.policies) {
        const b = h('button', 'gp-b' + (p.rec.includes(x.id) ? ' rec' : '') + (p.policy === x.id ? ' cur' : ''), `${x.icon} ${x.name}${p.rec[0] === x.id && p.policy !== x.id ? ' ★' : ''}`); b.type = 'button';
        b.title = p.rec.includes(x.id) ? L('총독이 권하는 방침', 'Recommended by the governor') : ''; b.disabled = p.policy === x.id || p.idx === null; b.onclick = () => send(x.id); btns.append(b);
      }
      if (p.policy) { const off = h('button', 'gp-b', L('방침 거두기', 'Withdraw mandate')); off.type = 'button'; off.onclick = () => send(null); btns.append(off); }
      if (p.policy) detail.append(quotaBox(p)); // 행성 할당량(2026-11-05)
      msg.textContent = p.idx === null ? L('이 행성은 아직 번호가 없어 맡길 수 없습니다(연결 모드 업데이트 필요).', 'This planet has no ID yet (update the connection mod).') : (p.stock === 0 ? L(`기질 「${TEMPER[p.temper][0]}」: 자원이 모자라도 공사를 쉬지 않습니다.`, `Temper "${TEMPER[p.temper][1]}": keeps building however low the stockpile.`) : L(`기질 「${TEMPER[p.temper][0]}」: 국고 광물이 ${p.stock}보다 적으면 공사를 쉽니다.`, `Temper "${TEMPER[p.temper][1]}": construction pauses below ${p.stock} minerals.`));
    };
    // 행성 할당량(2026-11-05): 방침을 맡긴 행성에만. 준비 → 1·2·3단계 → 마무리 보상. 단계마다 생산 +, 안정도 −.
    const PH = [L('준비', 'Preparation'), L('1단계', 'Phase 1'), L('2단계', 'Phase 2'), L('3단계', 'Phase 3')];
    function quotaBox(p) {
      const Q = S.quota || {}, q = p.quota || {}, box = h('div', 'gp-quota');
      box.append(h('b', '', L('⚒ 행성 할당량', '⚒ Planetary quota')));
      if (q.on) {
        box.append(document.createTextNode(L(`진행 중: ${PH[q.ph]}`, `Underway: ${PH[q.ph]}`) + (q.left !== null && q.left !== undefined ? L(` · 이 단계 약 ${q.left}개월 남음`, ` · about ${q.left} month(s) left in this phase`) : '')));
        const bar = h('div', 'gp-qbar'); for (let i = 0; i < 4; i++) bar.append(h('span', i < q.ph ? 'done' : i === q.ph ? 'now' : '')); box.append(bar);
        box.append(h('div', 'gp-note', L(`지금 효과: 모든 직업 생산 +${Q.prod[q.ph]}% · 안정도 −${Q.stab[q.ph]}. 다 채우면: ${q.reward}`, `Now: all jobs +${Q.prod[q.ph]}%, stability −${Q.stab[q.ph]}. On completion: ${q.reward}`)));
      } else {
        const total = (Q.months || []).reduce((a, b) => a + b, 0);
        box.append(h('div', 'gp-note', L(`총독에게 몇 년짜리 할당량을 매깁니다. 준비 ${Q.months[0]}개월 → 1·2·3단계 각 ${Q.months[1]}개월(약 ${Math.round(total / 12 * 10) / 10}년). 단계마다 모든 직업 생산 +${Q.prod[1]}·${Q.prod[2]}·${Q.prod[3]}%, 안정도 −${Q.stab[1]}·${Q.stab[2]}·${Q.stab[3]}(준비 중 −${Q.stab[0]}). 다 채우면 ${q.reward}과(와) 2년간 안정도 +${Q.done.stab}. 안정도가 ${Q.failBelow} 아래로 ${Q.failMonths}개월 이어지면 무너집니다(보상 없음). 방침을 거두면 할당량도 끝납니다.`,
          `Levy a multi-year quota through the governor. Preparation ${Q.months[0]} months → phases 1–3, ${Q.months[1]} months each (about ${Math.round(total / 12 * 10) / 10} years). All jobs +${Q.prod[1]}/${Q.prod[2]}/${Q.prod[3]}% by phase, stability −${Q.stab[1]}/${Q.stab[2]}/${Q.stab[3]} (−${Q.stab[0]} while preparing). On completion: ${q.reward}, plus stability +${Q.done.stab} for two years. If stability stays below ${Q.failBelow} for ${Q.failMonths} months, it collapses with no reward. Withdrawing the mandate ends the quota.`)));
      }
      const b = h('button', 'gp-b', q.on ? L('할당량 거두기', 'Withdraw quota') : L('할당량 매기기', 'Levy a quota')); b.type = 'button'; b.disabled = p.idx === null;
      const m = h('div', 'gp-note');
      b.onclick = async () => { b.disabled = true; m.textContent = L('게임에 전하는 중…', 'Sending to the game…');
        let r; try { r = await window.sllm.govQuotaSet({ idx: p.idx, on: !q.on }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
        if (r && r.ok) { Object.assign(p, r.planet); drawList(); drawDetail(); } else { m.textContent = (r && r.error) || L('실패했습니다.', 'Failed.'); b.disabled = false; } };
      box.append(b, m); return box;
    }
    drawList();
  }
  window.mountGovPolicy = mount;
})();
