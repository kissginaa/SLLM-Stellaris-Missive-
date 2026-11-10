// 일정표(2026-11-04 사용자: 「Alarm Clock」에서 채용) — 집무실 「비서 호출」 옆 「일정표」 아이콘 → 남은 날 목록. 앱: src/features/alarm-app.ts · 규칙: src/alarm.ts
// 게임이 숨겨 둔 재사용 대기 + 우리 기능 대기. 매달 자동으로 읽고, 「지금 읽기」로 바로 읽을 수도 있다. 항목마다 알림 끄기. 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const show = (id) => { if (!$(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const css = () => { if ($('alCss')) return; const st = h('style'); st.id = 'alCss'; st.textContent = [
    '#alRoot{display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding:12px 16px}',
    '#alRoot .al-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;opacity:.85}',
    '#alRoot .al-top .sp{flex:1}',
    '#alRoot button.al-b{border:1px solid var(--hi);background:color-mix(in srgb,var(--hi) 12%,transparent);color:var(--text);border-radius:5px;padding:4px 10px;cursor:pointer;font-size:12px}',
    '#alRoot button.al-b:disabled{opacity:.45;cursor:default}',
    '#alRoot h4{margin:6px 0 2px;font-size:13px;opacity:.8}',
    '#alRoot .al-row{display:grid;grid-template-columns:1fr 150px 72px 28px;gap:8px;align-items:center;padding:6px 8px;border-radius:6px;background:color-mix(in srgb,var(--hi) 5%,transparent);font-size:12.5px}',
    '#alRoot .al-row.off{opacity:.45}',
    '#alRoot .al-bar{height:6px;border-radius:3px;background:color-mix(in srgb,var(--hi) 15%,transparent);overflow:hidden}',
    '#alRoot .al-bar i{display:block;height:100%;background:var(--hi)}',
    '#alRoot .al-row small{opacity:.65;font-size:11px;text-align:right}',
    '#alRoot .al-row button{background:none;border:0;color:var(--text);cursor:pointer;opacity:.7;font-size:14px}',
    '#alRoot .al-ring{padding:8px 10px;border:1px solid #ffd36b88;border-radius:6px;background:#ffd36b14;font-size:12.5px}',
    '#alRoot .al-note{font-size:11.5px;opacity:.65;line-height:1.6}',
  ].join(''); document.head.append(st); };
  const CAT = { psi: ['사이오닉', 'Psionics'], shadow: ['그림자', 'Shadows'], spy: ['첩보', 'Espionage'], enclave: ['고립 거주지', 'Enclaves'], relic: ['유물·발견', 'Relics & discoveries'], leader: ['지도자', 'Leaders'], planet: ['행성', 'Planets'], misc: ['기타', 'Other'], sit: ['상황 대응', 'Situation approaches'], app: ['우리 앱', 'App features'] };

  function view(holo) {
    if ($('alarmView')) return;
    const sec = h('section', 'view app'); sec.id = 'alarmView'; sec.setAttribute('aria-label', L('일정표', 'Schedule'));
    const hd = h('div', 'apph'); const back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => show('desktop');
    hd.append(back, h('h3', '', L('일정표', 'Schedule'))); const body = h('div', 'appb'); body.id = 'alRoot'; body.setAttribute('data-i18n-skip', '');
    sec.append(hd, body); holo.append(sec);
  }
  async function mount(root, S) {
    css(); root.textContent = '';
    if (!S) { try { S = await window.sllm.alarmState(); } catch (e) { S = null; } }
    if (!S || !S.ok) { root.append(h('p', 'al-note', L('세이브를 불러오면 일정표를 볼 수 있습니다.', 'Load a save to see the schedule.'))); return; }
    const top = h('div', 'al-top'), scan = h('button', 'al-b', L('지금 읽기', 'Read now')); scan.type = 'button'; scan.disabled = !S.running;
    scan.onclick = async () => { scan.disabled = true; scan.textContent = L('읽는 중…', 'Reading…'); let r; try { r = await window.sllm.alarmScan(); } catch (e) { r = null; } void mount(root, r && r.view); };
    top.append(h('span', 'sp', L(`게임 날짜 ${S.date || '?'} · 마지막으로 읽은 달 ${S.scanned || '—'} · 지켜보는 항목 ${S.tracked}가지`, `Game date ${S.date || '?'} · last read ${S.scanned || '—'} · ${S.tracked} kinds tracked`)), scan);
    root.append(top);
    if (S.ring.length) { const r = h('div', 'al-ring'); r.append(h('b', '', L('최근 다시 할 수 있게 된 것', 'Recently available again'))); const ul = h('ul'); for (const x of S.ring.slice(0, 6)) ul.append(h('li', '', `${x.due} · ${L(x.label[0], x.label[1])}`)); r.append(ul); root.append(r); }
    if (!S.list.length) root.append(h('p', 'al-note', L('지금 기다리는 재사용 대기가 없습니다.', 'Nothing is on cooldown right now.')));
    const groups = {};
    for (const a of S.list) (groups[a.cat] ??= []).push(a);
    for (const [cat, rows] of Object.entries(groups)) {
      root.append(h('h4', '', L(...(CAT[cat] || [cat, cat]))));
      for (const a of rows) {
        const r = h('div', 'al-row' + (a.off ? ' off' : '')), bar = h('div', 'al-bar'), fill = h('i'); fill.style.width = `${Math.round(100 * (1 - (a.total ? a.left / a.total : 0)))}%`; bar.append(fill);
        const mute = h('button', '', a.off ? '🔕' : '🔔'); mute.type = 'button'; mute.title = a.off ? L('알림 켜기', 'Turn reminder on') : L('알림 끄기', 'Turn reminder off');
        mute.onclick = async () => { let v; try { v = await window.sllm.alarmMute(a.key, !a.off); } catch (e) { v = null; } void mount(root, v); };
        r.append(h('span', '', L(a.label[0], a.label[1])), bar, h('small', '', a.left >= 360 ? L(`${(a.left / 360).toFixed(1)}년`, `${(a.left / 360).toFixed(1)} yr`) : L(`${a.left}일`, `${a.left} d`)), mute);
        r.title = L(`다시 되는 날: ${a.due}`, `Due: ${a.due}`); root.append(r);
      }
    }
    root.append(h('p', 'al-note', L('게임이 숨겨 둔 재사용 대기(첩보 작전·유물·고립 거주지 등)와 우리 기능의 대기를 매달 한 번 읽습니다. 날이 되면 집무실 알림이 뜨고 비서가 보고합니다. 동화 정책·기술 원조는 게임 「상황」 화면에도 막대로 보입니다.', 'Hidden game cooldowns (espionage, relics, enclaves…) and our own features are read once a month. When one comes due you get an office alert and your secretary mentions it. Assimilation and tech aid also show as bars in the game\'s Situations screen.')));
  }
  function open() { const holo = $('policy') && $('policy').parentElement; if (!holo) return; view(holo); show('alarmView'); void mount($('alRoot')); }
  function icon() {
    if ($('alCall')) return; const sec = $('secCall'); if (!sec) return;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'alCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="26" r="14"/><path d="M24 18v8l6 4"/><path d="M10 12l6-5M38 12l-6-5"/></svg>';
    b.append(h('span', '', L('일정표', 'Schedule'))); b.title = L('재사용 대기·다시 되는 날', 'Cooldowns and when they come back'); b.onclick = open; sec.after(b);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.alarmState) return;
    setTimeout(icon, 600);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'alarm') open(); });
    document.addEventListener('sllm-language', () => { const b = $('alCall'); if (b) b.querySelector('span').textContent = L('일정표', 'Schedule'); });
  });
})();
