// 설정 → 애드온 탭의 「창작마당 애드온」 칸(2026-10-23 초안). 앱: src/features/workshop-app.ts, 규칙: src/workshop-addons.ts.
// 구독한 창작마당 항목 중 sllm/addon/addon.json 이 있는 것을 보여 준다. 구독 폴더는 읽기만 하고, 「설치」하면 앱 애드온 폴더로 복사해 꺼진 채로 목록에 넣는다(켜기는 위 목록에서).
// 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const skip = (e) => { e.setAttribute('data-i18n-skip', ''); return e; };
  let S = null, busy = false, msg = '';
  const css = '#wsBox{margin-top:14px;border-top:1px solid var(--line,#333);padding-top:10px}#wsBox h3{margin:0 0 4px;font-size:14px}.ws-it{display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:6px 8px;border:1px solid var(--line,#333);border-radius:4px;margin:4px 0}.ws-it small{display:block;opacity:.7;font-size:11.5px}.ws-it .ws-st{font-size:11.5px;padding:1px 6px;border-radius:8px;border:1px solid currentColor;opacity:.85;margin-left:6px}.ws-it .ws-bt{display:flex;gap:4px;align-items:center}.ws-err{color:#ffb4a8;font-size:12px;grid-column:1/-1;white-space:pre-wrap}';
  const stName = (it) => it.update ? L('업데이트 있음', 'Update available') : ({ found: L('새로 찾음', 'New'), installed: L('설치됨', 'Installed'), ignored: L('무시함', 'Ignored'), gone: L('구독 해제됨', 'Unsubscribed'), invalid: L('읽을 수 없음', 'Unreadable') })[it.status] || it.status;
  async function refreshAddonList() { const b = $('addonReload'); if (b) b.click(); }
  async function act(fn) { if (busy) return; busy = true; msg = ''; draw(); try { const r = await fn(); if (r && r.state) S = r.state; if (r && r.ok === false) msg = r.error || L('실패했습니다.', 'Failed.'); else if (r && r.msg) msg = r.msg; } catch (e) { msg = String(e); } busy = false; draw(); }
  function draw() {
    const box = $('wsBox'); if (!box) return; box.textContent = '';
    if (!document.getElementById('wsCss')) { const s = h('style'); s.id = 'wsCss'; s.textContent = css; document.head.append(s); }
    box.append(h('h3', '', L('창작마당 애드온', 'Workshop add-ons')), h('div', 'hint', L('구독한 창작마당 항목 중 SLLM 애드온(sllm/addon/addon.json)을 찾습니다. 구독 폴더는 바꾸지 않고, 「설치」하면 앱 애드온 폴더로 복사해 꺼진 채로 위 목록에 넣습니다. 그림·소리·글 파일만 복사하며 실행 파일이 든 항목은 설치하지 않습니다. 게임에서 모드로 켠 항목은 이미 위 목록에 있어 따로 설치할 필요가 없습니다.', 'Finds SLLM add-ons (sllm/addon/addon.json) among your Workshop subscriptions. The subscription folder is never changed; "Install" copies it into the app add-on folder and adds it to the list above, turned off. Only image, sound and text files are copied, and items containing executables are not installed. Items enabled as mods in the game are already in the list above.')));
    const row = h('div', 'row'); row.style.cssText = 'gap:6px;margin:6px 0;align-items:center';
    const scan = h('button', '', busy ? L('찾는 중…', 'Scanning…') : L('창작마당 다시 찾기', 'Scan Workshop again')); scan.type = 'button'; scan.disabled = busy;
    scan.onclick = () => act(async () => { const r = await window.sllm.wsScan(); if (r.ok) r.msg = L(`찾았습니다. 게임에서 이미 켠 항목 ${r.inGame}개는 제외했습니다.`, `Scan complete. ${r.inGame} item(s) already enabled in the game were skipped.`); return r; });
    row.append(scan); if (S && S.lastScan) row.append(skip(h('span', 'hint', L(`마지막 확인: ${S.lastScan}`, `Last scan: ${S.lastScan}`)))); box.append(row);
    if (msg) box.append(h('div', 'hint', msg));
    if (!S || !S.items.length) { box.append(h('div', 'hint', L('찾은 창작마당 애드온이 없습니다.', 'No Workshop add-ons found.'))); return; }
    for (const it of S.items) {
      const d = h('div', 'ws-it'), nm = h('div'); const b = skip(h('b', '', it.name)); nm.append(b, h('span', 'ws-st', stName(it)));
      nm.append(skip(h('small', '', [it.version && 'v' + it.version, it.author, L('창작마당 ', 'Workshop ') + it.itemId].filter(Boolean).join(' · '))));
      if (it.update) nm.append(skip(h('small', '', L(`설치한 판 v${it.installedVersion} → 새 판 v${it.version}. 업데이트해도 켜고 끈 상태는 그대로입니다.`, `Installed v${it.installedVersion} → new v${it.version}. Updating keeps it on or off as it is.`))));
      if (it.status === 'gone') nm.append(h('small', '', L('구독을 해제해도 설치한 사본은 남아 있습니다. 필요 없으면 애드온 폴더에서 지우세요.', 'The installed copy stays after unsubscribing. Delete it from the add-on folder if you no longer need it.')));
      const bt = h('div', 'ws-bt'), btn = (t, fn) => { const x = h('button', '', t); x.type = 'button'; x.disabled = busy; x.onclick = () => act(async () => { const r = await fn(); if (r && r.ok && fn !== ign) await refreshAddonList(); return r; }); bt.append(x); };
      const ins = () => window.sllm.wsInstall(it.itemId), ign = () => window.sllm.wsIgnore(it.itemId);
      if (it.status === 'found') { btn(L('설치', 'Install'), ins); btn(L('무시', 'Ignore'), ign); }
      else if (it.status === 'ignored') btn(L('그래도 설치', 'Install anyway'), ins);
      else if (it.update) btn(L('업데이트', 'Update'), ins);
      d.append(nm, bt);
      if (it.errors && it.errors.length) d.append(skip(h('div', 'ws-err', it.errors.join('\n'))));
      box.append(d);
    }
  }
  async function load() { try { S = await window.sllm.wsState(); } catch { S = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    const list = $('addonList'); if (!list || !window.sllm || !window.sllm.wsState) return;
    const box = h('div'); box.id = 'wsBox'; list.after(box); load();
    const tab = $('settings-tab-addons'); if (tab) tab.addEventListener('click', () => load());
    document.addEventListener('sllm-language', draw);
  });
})();
