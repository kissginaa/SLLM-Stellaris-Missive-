// 집무실 「사교회」 화면(2026-10-23 초안). 앱: src/features/relations-app.ts, 규칙: src/social-event.ts.
// 해마다 한 번(기본 2월, 식량 20) 지도자들이 모인다. 참석하면 연회장 창(ui/social-hall.html)에서 모임에 끼어 실제로 대화하거나 두 사람을 소개하고, 불참하면 배경 만남만 판정하고 끝난다.
// 결과(가까워짐·변화 없음·마찰)는 앱이 확률표로 정한다(대화 분위기가 확률을 기울인다). office.html 은 이 파일·css 만 더한다. 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const RES = { good: ['가까워짐', 'Grew closer'], none: ['변화 없음', 'No change'], friction: ['마찰', 'Friction'] };
  const CLS = { commander: ['지휘관', 'Commander'], official: ['관료', 'Official'], scientist: ['과학자', 'Scientist'] };
  let S = null, err = '', busy = '', lastLines = null;
  const show = (id) => { for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  function badge() { const n = $('nSocial'); if (!n) return; const on = !!(S && S.season && S.season.rulerAttends === null); n.textContent = on ? '!' : ''; n.classList.toggle('show', on); }
  async function load() { try { S = await window.sllm.socialState(); } catch (e) { S = null; } badge(); draw(); }
  async function run(key, fn) { if (busy) return; busy = key; err = ''; draw(); try { const r = await fn(); if (r && r.state) S = r.state; if (r && !r.ok) err = r.error || ''; if (r && r.lines) lastLines = r.lines; } catch (e) { err = String(e); } busy = ''; badge(); draw(); }
  function draw() {
    const root = $('socRoot'); if (!root || !$('social').classList.contains('on')) return; root.textContent = ''; root.dataset.i18nSkip = '';
    const wrap = h('div', 'soc-main'); root.append(wrap);
    if (!S || !S.sid) { wrap.append(h('p', 'soc-empty', L('세이브를 불러오면 사교회 소식이 이곳에 옵니다.', 'Load a save and news of the social gathering will arrive here.'))); return; }
    if (err) wrap.append(h('div', 'soc-err', err));
    const s = S.season;
    if (!s) {
      wrap.append(h('p', 'soc-empty', L(`사교회는 해마다 ${S.month}월에 열립니다(식량 ${S.food}). 지도자들이 모여 친분을 쌓거나 부딪히고, 때로는 인연이 생깁니다. 비서는 오지 않습니다.`, `The social gathering is held every year in month ${S.month} (food ${S.food}). Leaders mingle, grow closer or clash, and sometimes fall for each other. The secretary does not attend.`)));
    } else {
      const hd = h('div', 'soc-hd'); hd.append(h('b', '', L(`${s.year}년 사교회`, `${s.year} social gathering`)), h('span', 'soc-tag', L(`손님 ${s.guests.length}명`, `${s.guests.length} guests`)));
      if (s.quality === 'poor') hd.append(h('span', 'soc-tag warn', L('식량 부족 — 대접이 소박함', 'Food short — modest hospitality')));
      wrap.append(hd);
      if (s.rulerAttends === null) {
        wrap.append(h('p', 'soc-note', L('이번 달 안에 참석 여부를 정해 주세요. 정하지 않으면 다음 달 통치자 없이 끝난 것으로 처리합니다.', 'Decide this month whether to attend. If you don\'t, next month it ends as if the ruler stayed away.')));
        const row = h('div', 'soc-row');
        row.append(btn('soc-btn', L('참석하기', 'Attend'), () => run('attend', () => window.sllm.socialAttend(true))), btn('soc-btn soft', L('불참 (배경 만남만 판정)', 'Skip (background only)'), () => run('skip', () => window.sllm.socialAttend(false))));
        for (const b of row.children) b.disabled = !!busy; wrap.append(row);
      } else if (s.rulerAttends) {
        // 연회장(별도 창, AI 배경 그림)에서 모임에 끼어 실제로 대화한다(2026-10-23 사용자 요청). 횟수 제한 없음(29 자유 이동), 결과는 자리를 뜰 때 한 번.
        wrap.append(h('p', 'soc-note', L('연회장에 들어가 모여 있는 사람들에게 말을 걸어 보세요. 실제로 대화를 나누고, 자리를 뜰 때 대화가 어땠는지에 따라 관계가 정해집니다. 두 사람을 서로 소개할 수도 있습니다.', 'Enter the hall and talk with the circles of guests. You actually converse with them, and how it went is settled when you step away. You can also introduce two guests to each other.')));
        const er = h('div', 'soc-row'); const eb = btn('soc-btn', '🥂 ' + L('연회장으로 들어가기', 'Enter the hall'), () => run('hall', () => window.sllm.socialHallOpen())); eb.disabled = !!busy; er.append(eb); wrap.append(er);
        const grid = h('div', 'soc-guests');
        for (const g of s.guests) { const c = h('div', 'soc-guest'); c.append(h('b', '', g.name), h('small', '', L(...(CLS[g.cls] || ['지도자', 'Leader'])) + (g.council ? ' · ' + L('평의회', 'Council') : '') + (g.retired ? ' · ' + L('은퇴', 'Retired') : '') + (g.talked ? ' · ' + L('이야기함', 'Talked') : ''))); grid.append(c); }
        wrap.append(grid);
        const outs = (s.groups || []).flatMap((g) => g.outcome || []);
        if (outs.length || s.turns.length) {
          const lg = h('div', 'soc-log');
          for (const o of outs) { const d = h('div', 'soc-turn ' + o.result); d.append(h('small', '', `${o.name} · ${L(...RES[o.result])}`)); lg.append(d); }
          for (const t of s.turns) { const d = h('div', 'soc-turn ' + t.result); d.append(h('small', '', `${t.who} · ${L(...RES[t.result])}`), h('p', '', t.text)); lg.append(d); }
          wrap.append(lg);
        }
        const fr = h('div', 'soc-row'); const fb = btn('soc-btn', busy === 'finish' ? L('마무리 중…', 'Closing…') : L('행사 마치기', 'Close the gathering'), () => run('finish', () => window.sllm.socialFinish())); fb.disabled = !!busy; fr.append(fb); wrap.append(fr);
      }
    }
    const lines = lastLines || (S.last && S.last.summary) || null;
    if (lines) { wrap.append(h('h5', 'soc-hh', S.last ? L(`${S.last.year}년 사교회 결과`, `${S.last.year} gathering — results`) : L('결과', 'Results'))); const ul = h('ul', 'soc-sum'); if (!lines.length) ul.append(h('li', '', L('눈에 띄는 일은 없었습니다.', 'Nothing noteworthy happened.'))); for (const l of lines) ul.append(h('li', '', l)); wrap.append(ul); }
  }
  function build() {
    const after = $('iscCall') || $('emCall') || $('prtCall') || $('petCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('social')) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'socCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8l-2 12a6 6 0 0 0 12 0L24 8z"/><path d="M20 26v12M14 40h12"/><path d="M34 14l-2 8a4 4 0 0 0 8 0l-2-8z"/><path d="M36 26v10M32 38h8"/></svg>';
    b.append(h('span', '', L('사교회', 'Social gathering')), Object.assign(h('b', 'n'), { id: 'nSocial' }));
    b.onclick = () => { show('social'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'social'; sec.setAttribute('aria-label', L('사교회', 'Social gathering'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('사교회', 'Social gathering'))); const body = h('div', 'appb'); body.id = 'socRoot';
    sec.append(hd, body); holo.append(sec);
  }
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { build(); load(); }, 60); // 성간 임시회의 아이콘(40ms) 뒤
    if (window.sllm.onSocialUpdate) window.sllm.onSocialUpdate((v) => { S = v; badge(); draw(); });
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'social') { build(); show('social'); load(); } });
    document.addEventListener('sllm-language', () => { const b = $('socCall'); if (b) b.querySelector('span').textContent = L('사교회', 'Social gathering'); draw(); });
  });
  window.SLLMSocial = { load };
})();
