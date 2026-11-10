// 스텔라체스 화면(2026-10-31) — 카지노 정거장 안의 함대 오토배틀러. 규칙·저장은 앱(src/features/stellachess-app.ts), 여기는 그리기와 전투 재생만.
// 쓰는 쪽: casino.html 의 view 'stellachess' → window.SLLMStellaChess.draw(main, env). 문구는 L(한, 영)만(언어 팩 호환). CSS 는 스스로 붙인다. 그림 없이 SVG 함선.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  // 하드 모드 보스별 예외(2026-11-03: 그레이트 칸만 ×2) — cat.rules.hard.bossStats { 라운드: 배수 }
  const khanX = (lang) => { const k = cat && cat.rules && cat.rules.hard && cat.rules.hard.bossStats && cat.rules.hard.bossStats[5]; return k ? (lang === 'ko' ? L(` (그레이트 칸 ×${k})`, ` (Great Khan ×${k})`) : ` (Great Khan ×${k})`) : ''; };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
  const FAM = { kinetic: '#ffb347', energy: '#5fd0ff', explosive: '#ff6b6b', strike: '#b48cff' };
  const TIER = ['#000', '#9aa3b2', '#4cc38a', '#4a8cff', '#b06cff', '#f2c86b'];
  let chaosPick = false, hardPick = false, st = null, cat = null, sel = null, itemSel = null, env = null, anim = null, buyIn = 1000, busy = false;

  function css() {
    if (document.getElementById('scCss')) return; const s = h('style'); s.id = 'scCss'; s.textContent = `
.sc{display:grid;grid-template-columns:220px 1fr 260px;gap:12px;width:min(1400px,100%);margin:0 auto;color:#e9e4f5;font-size:13px}
.sc .spn{background:#0c0a18e6;border:1px solid #f2c86b44;border-radius:12px;padding:10px 12px}
.sc h3{margin:0 0 6px;font-size:13px;color:#f2c86b;letter-spacing:.04em}
.sc .stop{grid-column:1/-1;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.sc .sstat{display:flex;gap:6px;align-items:center} .sc .sstat b{font-size:16px;color:#fff}
.sc .sbar{height:8px;width:120px;border-radius:5px;background:#ffffff18;overflow:hidden} .sc .sbar i{display:block;height:100%;background:linear-gradient(90deg,#4cc38a,#9be37a)}
.sc .sbar.sxp i{background:linear-gradient(90deg,#4a8cff,#8ab4ff)}
.sc .ssp{flex:1} .sc button{font:inherit;color:inherit;background:#1a1530;border:1px solid #5a4a8a;border-radius:7px;padding:6px 11px;cursor:pointer} .sc button:hover:not(:disabled){border-color:#f2c86b;color:#f2c86b} .sc button:disabled{opacity:.4;cursor:default}
.sc button.smain{background:linear-gradient(#6a5218,#3a2c0e);border-color:#f2c86b;color:#ffe2a0;font-weight:700} .sc button.swarn{border-color:#ff8a8a88}
.sc .sgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px} .sc .srow8{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.sc .scell{position:relative;min-height:92px;border-radius:9px;border:1px dashed #ffffff22;background:#ffffff06;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:4px 2px}
.sc .scell.full{border-style:solid;background:#141026} .sc .scell.sel{outline:2px solid #f2c86b;outline-offset:1px} .sc .scell.drop{background:#f2c86b14}
.sc .scell .snm{font-size:11px;text-align:center;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc .scell .sstr{position:absolute;top:3px;left:5px;color:#f2c86b;font-size:11px;letter-spacing:-1px} .sc .scell .sit{position:absolute;bottom:3px;right:4px;display:flex;gap:2px}
.sc img.sicon{width:20px;height:20px;vertical-align:middle;margin-right:4px;border-radius:4px} .sc .scell .sit i{background-size:cover} .sc .sdrag{opacity:.45} .sc .sover{outline:2px dashed #f2c86b;outline-offset:2px} .sc .scell .sit i{width:9px;height:9px;border-radius:2px;display:block} .sc .scell .sit i.sfull{width:12px;height:12px;border:1px solid #f2c86b;box-shadow:0 0 4px #f2c86b88} .sc .slbl{font-size:11px;color:#a89cc8;margin:6px 0 3px}
.sc .sship{width:54px;height:36px} .sc img.sship.simg{width:76px;height:42px;filter:drop-shadow(0 2px 4px #000c)} .sc .senemy .scell{min-height:64px;cursor:default} .sc .senemy .sship{width:40px;height:26px} .sc .senemy img.sship.simg{width:58px;height:32px}
.sc .sshop{display:grid;grid-template-columns:repeat(5,1fr);gap:6px} .sc .scard{border-radius:9px;padding:6px;background:#141026;border:2px solid;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:96px}
.sc .scard.empty{border-style:dashed;opacity:.35;cursor:default} .sc .scard .scost{font-weight:700} .sc .stags{font-size:10.5px;color:#b9b0d8;text-align:center}
.sc .ssyn div{display:flex;justify-content:space-between;padding:3px 6px;border-radius:6px;margin-bottom:3px;background:#ffffff08;color:#8d84ab} .sc .ssyn div.on{background:#f2c86b1e;color:#ffe2a0}
.sc .ssyn small{display:block;font-size:10.5px;color:#9a90bb;margin:-2px 0 6px 6px}
.sc .sitems{display:flex;gap:5px;flex-wrap:wrap} .sc .sitems button{padding:3px 8px;font-size:12px} .sc .sitems button.on{border-color:#f2c86b;color:#f2c86b}
.sc .snote{color:#a89cc8;font-size:12px;line-height:1.5} .sc .sodds{display:flex;gap:4px;font-size:11px} .sc .sodds span{padding:1px 5px;border-radius:5px;background:#ffffff0c}
.sc .sdrop{display:flex;align-items:center;justify-content:center;gap:8px;margin:6px auto;padding:6px 12px;border-radius:10px;background:#5fd3ff1a;border:1px solid #5fd3ff55;color:#cfefff;font-size:13px;animation:sdrop .5s ease-out} .sc .sdrop img{width:30px;height:30px;border-radius:6px} .sc .sdrop .sdot{width:18px;height:18px;border-radius:50%} @keyframes sdrop{from{transform:translateY(8px) scale(.9);opacity:0}} @media (prefers-reduced-motion:reduce){.sc .sdrop{animation:none}} .sc .sintro{grid-column:1/-1;max-width:760px;margin:0 auto} .sc table{border-collapse:collapse;width:100%;font-size:12.5px} .sc td,.sc th{border-top:1px solid #ffffff14;padding:4px 6px;text-align:left}
.sc .smodal{position:fixed;inset:0;background:#000a;display:flex;align-items:center;justify-content:center;z-index:30} .sc .smodal .spn{min-width:380px;max-width:92vw}
.sc .sarena{position:fixed;inset:0;z-index:40;gap:10px !important;background:radial-gradient(ellipse at center,#141032,#05040c 75%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.sc .sarena .sside{display:grid;grid-template-columns:repeat(4,110px);gap:8px} .sc .sarena .sfg{position:relative;height:84px;border-radius:10px;background:#120e24;border:1px solid #ffffff1c;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .3s}
.sc .sarena .sfg.dead{opacity:.18} .sc .sarena .sfg.boss{border-color:#ff6b6b} .sc .sarena .sfg .sbars{position:absolute;bottom:4px;left:6px;right:6px;display:flex;flex-direction:column;gap:2px}
.sc .sarena .sfg .sbars i{display:block;height:3px;border-radius:2px} .sc .sarena .sfg.hit{animation:schit .25s} @keyframes schit{0%{transform:translateX(0)}30%{transform:translateX(-3px)}60%{transform:translateX(3px)}100%{transform:none}}
.sc .sarena .sfg .spop{position:absolute;top:-6px;right:4px;font-size:12px;font-weight:700;color:#fff;text-shadow:0 0 4px #000;pointer-events:none;animation:scpop .7s forwards} @keyframes scpop{to{transform:translateY(-16px);opacity:0}}
.sc .sarena svg.sfx{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}
  .sc .sarena .scv{border-radius:12px;border:1px solid #ffffff1c;box-shadow:0 0 40px #000} .sc .sarena .shud{display:flex;gap:18px;align-items:center;font-size:12.5px;color:#d8d0f0} .sc .sarena .shud .shs{display:flex;flex-direction:column;gap:3px} .sc .sarena .shud b{font-size:16px;color:#f2c86b}
.sc .sarena .sttl{font-size:18px;color:#f2c86b;font-weight:700;letter-spacing:.06em} .sc .sarena .sres{font-size:15px;text-align:center;min-height:44px}
@media (max-width:1100px){.sc{grid-template-columns:1fr}.sc .sarena .sside{grid-template-columns:repeat(4,80px)}}`; document.head.append(s);
  }
  /** 그림 없는 함선: 가격(크기)과 계열 색으로 실루엣 */
  function shipSvg(id, cls) {
    const im0 = cat && cat.art && cat.art.ships[id]; if (im0) { const i = h('img'); i.src = im0; i.alt = ''; i.className = (cls || 'sship') + ' simg'; i.style.objectFit = 'cover'; return i; } // 그림이 있으면 그림(18번 의뢰서)
    if (id === 'shroud_avatar') { const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 60 40'); s.setAttribute('class', cls || 'sship'); s.innerHTML = '<circle cx="30" cy="20" r="13" fill="#b48cff" opacity=".35"/><circle cx="30" cy="20" r="8" fill="#e0ccff"/><path d="M14 20 Q30 0 46 20 Q30 40 14 20" fill="none" stroke="#b48cff" stroke-width="1.5"/>'; return s; } // 사이오닉 소환체
    const d = cat && cat.ships.find((x) => x.id === id); const c = d ? FAM[d.fam] : '#aaa', n = d ? d.cost : 1, ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 60 40'); s.setAttribute('class', cls || 'sship');
    const len = 20 + n * 7, x0 = 30 - len / 2, x1 = 30 + len / 2, w = 4 + n * 2.2, role = d ? d.role : 'line';
    let body = `<polygon points="${x1},20 ${x1 - 8},${20 - w} ${x0 + 4},${20 - w * 0.8} ${x0},20 ${x0 + 4},${20 + w * 0.8} ${x1 - 8},${20 + w}" fill="${c}" opacity=".85"/>`;
    if (role === 'carrier') body += `<rect x="${x0 + 6}" y="${20 - w - 3}" width="${len - 14}" height="3" fill="${c}"/><rect x="${x0 + 6}" y="${20 + w}" width="${len - 14}" height="3" fill="${c}"/>`;
    if (role === 'artillery') body += `<rect x="${x1 - 2}" y="18.5" width="${8 + n}" height="3" fill="#fff" opacity=".8"/>`;
    if (role === 'picket') body += `<circle cx="30" cy="20" r="${w + 4}" fill="none" stroke="${c}" stroke-width="1.2" opacity=".6"/>`;
    if (role === 'raider') body += `<polygon points="${x0},20 ${x0 - 7},${20 - w} ${x0 - 4},20 ${x0 - 7},${20 + w}" fill="#fff" opacity=".5"/>`;
    s.innerHTML = body + `<circle cx="${x0 + 3}" cy="20" r="2" fill="#fff" opacity=".9"/>`; return s;
  }
  const stars = (n) => '★'.repeat(n);
  const ITC = { armor: '#c0a070', shield: '#5fd0ff', computer: '#ff8a8a', thruster: '#9be37a', reactor: '#ffb347', sensor: '#f2f27a', ecm: '#b48cff', nanite: '#7fe0c0' };
  /** 아이템 색: 부품은 제 색, 완성 아이템은 부품 두 색을 반씩(2026-11-03 부품 8 · 완성 36). */
  const itImg = (k) => (cat && cat.art && cat.art.items && cat.art.items[k]) || null; // 22번 의뢰서: 아이템 아이콘
  const itBg = (k) => { const it = cat && cat.items[k]; return it && it.parts ? `linear-gradient(135deg, ${ITC[it.parts[0]]} 50%, ${ITC[it.parts[1]]} 50%)` : ITC[k] || '#888'; };
  async function call(p) { if (busy) return {}; busy = true; try { const r = await p; if (r && r.state) st = r.state; if (r && !r.ok && r.error) env.say(r.error); return r || {}; } finally { busy = false; } }
  const act = (o) => call(window.sllm.scAct(o)).then((r) => { if (r && r.made) env.say(L(`합쳐졌습니다 — 「${r.made}」`, `Combined — "${r.made}"`)); paint(); });
  let book = false; // 아이템 조합표
  // 끌어다 놓기(2026-11-03 사용자: 롤토체스처럼 아이템을 함선에 끌어다 넣기) — 아이템 → 함선 = 장착, 함선 → 칸 = 자리 옮기기, 함선 → 조선소 = 팔기. 누르기로도 그대로 됨.
  const DT = 'application/x-sllm-sc';
  const dragOf = (e) => { try { return JSON.parse(e.dataTransfer.getData(DT) || 'null'); } catch { return null; } };
  const dragSet = (el, data) => { el.draggable = true; el.addEventListener('dragstart', (e) => { e.dataTransfer.setData(DT, JSON.stringify(data)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('sdrag'); }); el.addEventListener('dragend', () => el.classList.remove('sdrag')); };
  const dropOn = (el, fn) => { el.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types || []).includes(DT)) { e.preventDefault(); el.classList.add('sover'); } }); el.addEventListener('dragleave', () => el.classList.remove('sover')); el.addEventListener('drop', (e) => { el.classList.remove('sover'); const d = dragOf(e); if (d) { e.preventDefault(); sel = null; itemSel = null; fn(d); } }); };
  let host = null;
  function paint() { if (host) draw(host, env); }

  function unitCell(u, where, i, enemy) {
    const c = h('div', 'scell' + (u ? ' full' : '')); if (u) { c.style.borderColor = TIER[u.cost] + '99'; c.append(shipSvg(u.id), h('div', 'snm', u.name), h('div', 'sstr', stars(u.star))); if (u.items && u.items.length) { const it = h('div', 'sit'); for (const k of u.items) { const b = h('i'); const im = itImg(k); b.style.background = im ? `center / cover url(${im})` : itBg(k); if (cat.items[k] && cat.items[k].parts) b.className = 'sfull'; b.title = cat.items[k].name + ' · ' + cat.items[k].text; it.append(b); } c.append(it); } c.title = `${u.name} · ${(u.orig || []).map((o) => cat.origins[o]).join('·')}${u.orig && u.orig.length ? ' · ' : ''}${cat.fams[u.wpn || u.fam]} · ${cat.roles[u.role]}${u.sell ? ' · ' + L(`판매 ${u.sell}`, `sells for ${u.sell}`) : ''}`; }
    if (enemy) return c;
    if (u) dragSet(c, { t: 'unit', where, i });
    dropOn(c, (d) => { if (d.t === 'item') { if (u) act({ op: 'equip', item: d.k, to: { where, i } }); } else if (d.t === 'unit' && !(d.where === where && d.i === i)) act({ op: 'move', from: { where: d.where, i: d.i }, to: { where, i } }); });
    if (sel && sel.where === where && sel.i === i) c.classList.add('sel'); else if (sel || itemSel !== null) c.classList.add('drop');
    c.onclick = () => {
      if (itemSel !== null) { if (!u) return; const k = itemSel; itemSel = null; act({ op: 'equip', item: k, to: { where, i } }); return; }
      if (!sel) { if (u) { sel = { where, i }; paint(); } return; }
      if (sel.where === where && sel.i === i) { sel = null; paint(); return; }
      const from = sel; sel = null; act({ op: 'move', from, to: { where, i } });
    };
    return c;
  }

  function drawIntro(m, s) {
    const box = h('div', 'spn sintro'); box.append(h('h3', '', '♟ ' + L('스텔라체스 — 함대 오토배틀러', 'Stellachess — Fleet Auto-Battler')));
    box.append(h('div', 'snote', L(`자재로 함선을 사서 함대를 짜면 전투는 저절로 벌어집니다. 같은 함선 3척은 ★2, ★2 3척은 ★3. 종족(인간형·포유류·파충류·조류·절지류·연체류·균류·식물·암석·기계 — 종족마다 5척), 무기 계열(키네틱·에너지·폭발·함재기), 역할(경계·전열·포격·기습·항모)이 같은 함선을 모으면 시너지가 켜집니다. 혼자서 세상과 맞서는 ${cat.rules.rounds}라운드 시험이고, ${cat.rules.bosses.join('·')}라운드는 보스입니다(그레이트 칸의 무리 → 차원의 공포 → 에테르 드레이크 → 언비든 → 세타나 → 후반 렉의 화신). 목숨은 ${cat.rules.lives}개 — 한 번 질 때마다 하나씩 잃고 다 잃으면 끝납니다. 시간 제한은 없고, 준비가 끝나면 직접 출격합니다. 이길 때마다 점수가 쌓입니다(라운드·살아남은 함선·무손실·보스).`, `Buy ships with materials and battles play out on their own. Three of the same ship make ★2, three ★2 make ★3. Collect ships sharing a species (Humanoid, Mammalian, Reptilian, Avian, Arthropoid, Molluscoid, Fungoid, Plantoid, Lithoid, Machine — five ships each), weapon family (kinetic, energy, explosive, strike craft) or role (picket, line, artillery, raider, carrier) to unlock synergies. A ${cat.rules.rounds}-round solo trial against the galaxy; rounds ${cat.rules.bosses.join(', ')} are bosses (the Great Khan's Horde → the Dimensional Horror → the Ether Drake → the Unbidden → Cetana → the Avatar of Late-Game Lag). You have ${cat.rules.lives} lives — each loss costs one and losing them all ends the run. There is no timer; engage when you are ready. Every win adds to your score (round, surviving ships, flawless wins, bosses).`)));
    const t = h('table'), hd = h('tr'); hd.append(h('th', '', L('이긴 마지막 보스', 'Last boss beaten')), h('th', '', L('철수·완주 배당', 'Retreat / finish')), h('th', '', L('패배·포기 때', 'If defeated'))); t.append(hd);
    const PT = hardPick ? cat.rules.payoutHard : cat.rules.payout; for (const b of cat.rules.bosses) { const tr = h('tr'); tr.append(h('td', '', `${b} · ${cat.bossNames[b]}`), h('td', '', `× ${PT[b]}`), h('td', '', `× ${Math.round(PT[b] * cat.rules.deathShare * 100) / 100}`)); t.append(tr); }
    box.append(h('div', 'slbl', hardPick ? L('배당(바이인의 배수) — 하드 모드', 'Payout (× buy-in) — hard mode') : L('배당(바이인의 배수)', 'Payout (× buy-in)')), t, h('div', 'snote', L('보스를 하나 이상 이긴 뒤에는 라운드 사이에 언제든 「철수」해서 그 배당을 받을 수 있습니다. 보스를 하나도 못 이기면 바이인은 돌아오지 않습니다. 진행 중인 판은 저장되어 앱을 껐다 켜도 이어 합니다.', 'After beating at least one boss you can Retreat between rounds to take that payout. Beat no boss and the buy-in is lost. A run in progress is saved and continues after restarting the app.')));
    if (s.rec && s.rec.runs) box.append(h('div', 'slbl', L(`기록: ${s.rec.runs}판 · 최고 점수 ${fmt(s.rec.hi || 0)}${s.rec.hiChaos ? ' · 혼돈 최고 ' + fmt(s.rec.hiChaos) : ''}${s.rec.hiHard ? ' · 하드 최고 ' + fmt(s.rec.hiHard) : ''} · 최고 보스 ${s.rec.best || '-'} · 완주 ${s.rec.won}${s.rec.wonChaos ? ' · 혼돈 완주 ' + s.rec.wonChaos : ''} · 손익 ${s.rec.net >= 0 ? '+' : ''}${fmt(s.rec.net)}`, `Record: ${s.rec.runs} runs · high score ${fmt(s.rec.hi || 0)}${s.rec.hiChaos ? ' · chaos best ' + fmt(s.rec.hiChaos) : ''}${s.rec.hiHard ? ' · hard best ' + fmt(s.rec.hiHard) : ''} · best boss ${s.rec.best || '-'} · finished ${s.rec.won}${s.rec.wonChaos ? ' · chaos finished ' + s.rec.wonChaos : ''} · net ${s.rec.net >= 0 ? '+' : ''}${fmt(s.rec.net)}`)));
    const canChaos = !!(s.rec && s.rec.won > 0), mode = h('div', 'stop'); mode.style.marginTop = '8px';
    const b1 = h('button', chaosPick ? '' : 'smain', L('일반 모드', 'Normal mode')); b1.type = 'button'; b1.onclick = () => { chaosPick = false; paint(); };
    const b2 = h('button', chaosPick ? 'smain' : '', (canChaos ? '' : '🔒 ') + L('혼돈 모드', 'Chaos mode')); b2.type = 'button'; b2.disabled = !canChaos; b2.title = canChaos ? '' : L('일반 모드를 한 번 완주하면 열립니다.', 'Unlocks after finishing normal mode once.'); b2.onclick = () => { chaosPick = true; paint(); };
    mode.append(b1, b2, h('span', 'snote', chaosPick ? L(`라운드마다 예측할 수 없는 이변이 벌어집니다(다음 이변은 미리 보임). 배당·점수 × ${cat.rules.chaosPay}.`, `Every round brings an unpredictable twist (the next one is shown in advance). Payout and score × ${cat.rules.chaosPay}.`) : L('일반 규칙.', 'Standard rules.')));
    const hm = h('div', 'stop'); const b3 = h('button', hardPick ? 'smain' : '', (hardPick ? '☑ ' : '☐ ') + L('하드 모드', 'Hard mode')); b3.type = 'button'; b3.onclick = () => { hardPick = !hardPick; paint(); };
    hm.append(b3, h('span', 'snote', L(`적 함선의 선체·실드·장갑 — 보스 ×${cat.rules.hard.stats}${khanX('ko')}, 일반 적 ×${cat.rules.hard.normalStats} · 피해 ×${cat.rules.hard.dmg} · 후반 배당이 더 큼 · 점수 ×${cat.rules.hardScore}. 혼돈 모드와 함께 켤 수 있습니다.`, `Enemy hull, shields and armor — bosses ×${cat.rules.hard.stats}${khanX('en')}, regular foes ×${cat.rules.hard.normalStats} · damage ×${cat.rules.hard.dmg} · bigger late payouts · score ×${cat.rules.hardScore}. Can be combined with chaos mode.`)));
    box.append(mode, hm);
    const row = h('div', 'stop'); row.style.marginTop = '10px'; const inp = h('input'); inp.type = 'number'; inp.min = cat.rules.minBuyIn; inp.max = cat.rules.maxBuyIn; inp.step = 100; inp.value = buyIn; inp.style.cssText = 'width:110px;padding:6px;border-radius:6px;border:1px solid #5a4a8a;background:#120e24;color:inherit;font:inherit'; inp.oninput = () => { buyIn = Number(inp.value) || 0; };
    row.append(h('span', '', L('바이인', 'Buy-in')), inp); for (const v of [200, 1000, 5000]) { const b = h('button', '', fmt(v)); b.type = 'button'; b.onclick = () => { buyIn = v; inp.value = v; }; row.append(b); }
    const go = h('button', 'smain', L('함대 편성 시작', 'Assemble the fleet')); go.type = 'button'; go.onclick = () => call(window.sllm.scStart(buyIn, chaosPick, hardPick)).then(paint); row.append(h('span', 'ssp'), go);
    box.append(row, h('div', 'snote', L(`바이인은 ${fmt(cat.rules.minBuyIn)}~${fmt(cat.rules.maxBuyIn)}, 통치자 개인 금고에서 나갑니다. 지금 금고 ${fmt(s.balance)}.`, `Buy-in ${fmt(cat.rules.minBuyIn)}–${fmt(cat.rules.maxBuyIn)}, paid from the ruler's private vault. Vault now: ${fmt(s.balance)}.`)));
    m.append(box);
  }

  function drawOver(m, r) {
    const box = h('div', 'spn sintro'); const head = r.won ? L(`🏆 ${cat.bossNames[cat.rules.rounds]}까지 격파! 시험을 통과했습니다.`, `🏆 You broke ${cat.bossNames[cat.rules.rounds]} — trial complete!`) : r.retreated ? L('함대를 철수시켰습니다.', 'You withdrew the fleet.') : L('함대가 무너졌습니다.', 'Your fleet has fallen.');
    box.append(h('h3', '', head), h('div', 'slbl', L(`${r.hard ? '하드 모드 · ' : ''}${r.chaos ? '혼돈 모드 · ' : ''}최종 점수 ${fmt(r.score)}`, `${r.hard ? 'Hard mode · ' : ''}${r.chaos ? 'Chaos mode · ' : ''}Final score ${fmt(r.score)}`)), h('div', 'snote', L(`${r.round}라운드 · 이긴 마지막 보스 ${r.bossBeaten || '없음'} · 바이인 ${fmt(r.buyIn)}`, `Round ${r.round} · last boss beaten ${r.bossBeaten || 'none'} · buy-in ${fmt(r.buyIn)}`)));
    const pay = r.retreated || r.won ? r.payNow : r.payDeath; box.append(h('div', 'slbl', L(`배당 ${fmt(pay)} 크레딧이 금고로 들어갔습니다.`, `${fmt(pay)} credits were paid into the vault.`)));
    const b = h('button', 'smain', L('확인', 'OK')); b.type = 'button'; b.onclick = () => call(window.sllm.scClear()).then(paint); box.append(b); m.append(box);
  }

  function drawRun(m, s) {
    const r = s.run, w = h('div', 'sc');
    // 위 줄
    const top = h('div', 'spn stop');
    const xpb = h('div', 'sbar sxp'), xpi = h('i'); xpi.style.width = r.xpNext ? Math.min(100, (r.xp - (0)) / r.xpNext * 100) + '%' : '100%'; xpb.append(xpi);
    const stat = (a, b, extra) => { const e = h('div', 'sstat'); e.append(h('span', '', a), h('b', '', b)); if (extra) e.append(extra); return e; };
    top.append(stat(L('라운드', 'Round'), `${r.round}/${cat.rules.rounds}${r.next.boss ? ' ☠' : ''}`), stat(L('목숨', 'Lives'), '❤'.repeat(r.lives) + '♡'.repeat(Math.max(0, r.maxLives - r.lives))), stat(L('점수', 'Score'), fmt(r.score)), stat(L('자재', 'Materials'), `⬡ ${r.gold}`), stat(L('함대 규모', 'Fleet size'), `${r.level} (${r.onBoard}/${r.cap})`, xpb));
    if (r.hard) { const hc = stat('🔥', L('하드', 'Hard')); hc.title = L(`적 능력치 — 보스 ×${cat.rules.hard.stats}${khanX('ko')}, 일반 적 ×${cat.rules.hard.normalStats} · 피해 ×${cat.rules.hard.dmg}`, `Enemy stats — bosses ×${cat.rules.hard.stats}${khanX('en')}, regular foes ×${cat.rules.hard.normalStats} · damage ×${cat.rules.hard.dmg}`); hc.style.color = '#ff8a5c'; top.append(hc); }
    if (r.chaos) { const c = stat('🌀', r.chaosNow ? r.chaosNow.name : L('혼돈', 'Chaos')); if (r.chaosNow) c.title = r.chaosNow.text; c.style.color = '#ff9ad5'; top.append(c); }
    if (r.spores) top.append(stat('🍄', `${r.spores}/6`)); if (r.plunder) top.append(stat('💰', `${r.plunder}/10`));
    top.append(stat(L('지금 철수하면', 'Retreat now'), r.bossBeaten ? `${fmt(r.payNow)}` : '—'), h('span', 'ssp'));
    const rt = h('button', '', L(`철수(${fmt(r.payNow)})`, `Retreat (${fmt(r.payNow)})`)); rt.type = 'button'; rt.disabled = !r.bossBeaten; rt.title = L('이긴 보스 단계의 배당을 받고 끝냅니다.', 'Take the payout for the bosses beaten and end the run.'); rt.onclick = () => call(window.sllm.scRetreat()).then(paint);
    const ff = h('button', 'swarn', L('포기', 'Forfeit')); ff.type = 'button'; ff.title = L(`패배와 같습니다(배당 ${fmt(r.payDeath)}).`, `Same as a defeat (payout ${fmt(r.payDeath)}).`); ff.onclick = () => { if (ff.dataset.sure) call(window.sllm.scForfeit()).then(paint); else { ff.dataset.sure = '1'; ff.textContent = L('정말 포기?', 'Really forfeit?'); } };
    top.append(rt, ff); w.append(top);
    // 왼쪽: 시너지·확률
    const left = h('div', 'spn'); left.append(h('h3', '', L('시너지', 'Synergies'))); const sy = h('div', 'ssyn');
    if (!r.syn.length) sy.append(h('div', 'snote', L('배치한 함선이 없습니다.', 'No ships deployed.')));
    for (const x of r.syn) { const d = h('div', x.tier ? 'on' : ''); d.append(h('span', '', (cat.origins[x.key] ? '🧬 ' + cat.origins[x.key] : cat.fams[x.key] ? '⚙ ' + cat.fams[x.key] : '◆ ' + cat.roles[x.key])), h('span', '', `${x.n} / ${x.at.join('·')}`)); sy.append(d, h('small', '', cat.syn[x.key].text)); }
    left.append(sy, h('h3', '', L('상점 확률', 'Shop odds'))); const od = h('div', 'sodds'); r.odds.forEach((p, i) => { const e = h('span', '', `${i + 1}: ${p}%`); e.style.color = TIER[i + 1]; od.append(e); }); left.append(od);
    left.append(h('div', 'snote', L('함선을 눌러 고른 뒤 다른 칸을 누르면 옮기거나 맞바꿉니다. 앞줄이 먼저 맞고, 기습은 뒷줄을 노리고, 항모·함재기는 아무나 노립니다. 키네틱은 실드에, 에너지는 장갑에 강하고, 폭발은 실드를 무시합니다.', 'Click a ship, then another slot to move or swap. The front row is hit first; raiders target the back row and carriers hit anyone. Kinetic beats shields, energy beats armor, explosives ignore shields.')));
    w.append(left);
    // 가운데: 적 미리보기 · 내 함대 · 대기열
    const mid = h('div', 'spn'); mid.append(h('h3', '', L(`다음 상대: ${r.next.name}`, `Next: ${r.next.name}`) + (r.next.boss ? ' ☠' : '')));
    if (r.chaosNow) { const cz = h('div', 'snote', `🌀 ${L('이번 라운드 이변', 'This round\'s twist')}: ${r.chaosNow.name} — ${r.chaosNow.text}`); cz.style.color = '#ff9ad5'; mid.append(cz); }
    const en = h('div', 'sgrid senemy'); const eu = r.next.units; for (const row of [[4, 5, 6, 7], [0, 1, 2, 3]]) for (const i of row) { const u = eu[i]; en.append(unitCell(u ? { ...u, cost: (cat.ships.find((x) => x.id === u.id) || {}).cost || 1, items: [] } : null, 'enemy', i, true)); } mid.append(en);
    mid.append(h('div', 'slbl', L('내 함대 — 앞줄', 'My fleet — front row'))); const fr = h('div', 'sgrid'); for (let i = 0; i < 4; i++) fr.append(unitCell(r.board[i], 'board', i)); mid.append(fr);
    mid.append(h('div', 'slbl', L('뒷줄', 'Back row'))); const bk = h('div', 'sgrid'); for (let i = 4; i < 8; i++) bk.append(unitCell(r.board[i], 'board', i)); mid.append(bk);
    mid.append(h('div', 'slbl', L('대기열', 'Reserve'))); const bn = h('div', 'srow8'); for (let i = 0; i < 8; i++) bn.append(unitCell(r.bench[i], 'bench', i)); mid.append(bn);
    const ctl = h('div', 'stop'); ctl.style.marginTop = '8px';
    if (sel) { const cur = (sel.where === 'board' ? r.board : r.bench)[sel.i]; if (cur) { const sb = h('button', 'swarn', L(`${cur.name} 팔기 (+${cur.sell})`, `Sell ${cur.name} (+${cur.sell})`)); sb.type = 'button'; sb.onclick = () => { const from = sel; sel = null; act({ op: 'sell', from }); }; ctl.append(sb); } }
    if (r.items.length) { const it = h('div', 'sitems'); it.append(h('span', 'snote', L('아이템:', 'Items:'))); r.items.forEach((k, i) => { const b = h('button', itemSel === i ? 'on' : '', (cat.items[k].parts ? '★ ' : '') + cat.items[k].name); b.type = 'button'; const ii = itImg(k); if (ii) { const im = h('img'); im.src = ii; im.alt = ''; im.className = 'sicon'; b.prepend(im); } b.style.borderImage = itBg(k) + ' 1'; b.style.borderColor = ITC[k] || '#f2c86b'; b.title = cat.items[k].text + ' · ' + L('함선으로 끌어다 놓거나, 누른 뒤 함선을 누르면 장착 — 부품 하나만 단 함선에 부품을 주면 둘이 합쳐져 완성 아이템이 됩니다', 'drag onto a ship, or click then click a ship, to equip — giving a component to a ship that holds a single component combines them into a finished item'); dragSet(b, { t: 'item', k: i }); b.onclick = () => { itemSel = itemSel === i ? null : i; sel = null; paint(); }; it.append(b); }); ctl.append(it); }
    ctl.append(h('span', 'ssp')); const go = h('button', 'smain', r.next.boss ? L('☠ 보스전 출격', '☠ Engage the boss') : L('⚔ 출격', '⚔ Engage')); go.type = 'button'; go.disabled = !r.onBoard || !!r.itemOffer; go.onclick = fightNow; ctl.append(go);
    mid.append(ctl); w.append(mid);
    // 오른쪽: 상점
    const right = h('div', 'spn'); right.title = L('함선을 여기로 끌어다 놓으면 팝니다', 'Drop a ship here to sell it'); dropOn(right, (d) => { if (d.t === 'unit') act({ op: 'sell', from: { where: d.where, i: d.i } }); }); right.append(h('h3', '', L('조선소', 'Shipyard'))); const sh = h('div', 'sshop'); sh.style.gridTemplateColumns = '1fr';
    r.shop.forEach((c, i) => { const k = h('div', 'scard' + (c ? '' : ' empty')); if (c) { k.style.borderColor = TIER[c.cost]; k.style.flexDirection = 'row'; k.style.minHeight = '58px'; const tx = h('div'); tx.style.flex = '1'; tx.append(h('div', '', c.name), h('div', 'stags', `${(c.orig || []).map((o) => cat.origins[o]).join('·')} | ${cat.fams[c.wpn || c.fam]} · ${cat.roles[c.role]}`)); k.append(shipSvg(c.id), tx, h('div', 'scost', `⬡${c.cost}`)); k.title = L('눌러서 구입', 'Click to buy'); k.onclick = () => act({ op: 'buy', i }); if (c.cost > r.gold) k.style.opacity = '.5'; } sh.append(k); });
    right.append(sh); const rb = h('div', 'stop'); rb.style.marginTop = '8px';
    const b1 = h('button', '', L(`새로 고침 ⬡${cat.rules.reroll}`, `Reroll ⬡${cat.rules.reroll}`)); b1.type = 'button'; b1.disabled = r.gold < cat.rules.reroll; b1.onclick = () => act({ op: 'reroll' });
    const b2 = h('button', '', L(`규모 경험 +${cat.rules.xpBuy} ⬡${cat.rules.xpCost}`, `Fleet XP +${cat.rules.xpBuy} ⬡${cat.rules.xpCost}`)); b2.type = 'button'; b2.disabled = r.gold < cat.rules.xpCost || !r.xpNext; b2.onclick = () => act({ op: 'xp' });
    const b3 = h('button', r.locked ? 'smain' : '', r.locked ? L('🔒 고정됨', '🔒 Locked') : L('🔓 상점 고정', '🔓 Lock shop')); b3.type = 'button'; b3.onclick = () => act({ op: 'lock' });
    const b4 = h('button', '', L('📖 아이템 조합표', '📖 Item recipes')); b4.type = 'button'; b4.onclick = () => { book = true; paint(); };
    rb.append(b1, b2, b3, b4); right.append(rb, h('div', 'snote', L(`경험 ${r.xp}${r.xpNext ? ' / ' + r.xpNext : ''} · 라운드마다 +2 · 이자: 자재 10당 +1(최대 5)`, `XP ${r.xp}${r.xpNext ? ' / ' + r.xpNext : ''} · +2 per round · interest: +1 per 10 materials (max 5)`)));
    w.append(right);
    if (book) { const md = h('div', 'smodal'), p = h('div', 'spn'); p.style.maxHeight = '86vh'; p.style.overflow = 'auto'; p.append(h('h3', '', L('아이템 조합표 — 부품 둘 = 완성 아이템 하나', 'Item recipes — two components make one finished item')));
      const comps = Object.keys(cat.items).filter((k) => !cat.items[k].parts), t = h('table'); t.style.fontSize = '11px'; t.style.borderCollapse = 'collapse';
      const hd = h('tr'); hd.append(h('th')); for (const b of comps) { const th = h('th', '', cat.items[b].name); th.style.color = ITC[b]; if (itImg(b)) { const im = h('img'); im.src = itImg(b); im.alt = ''; im.className = 'sicon'; th.prepend(im); } th.style.padding = '3px'; hd.append(th); } t.append(hd);
      for (const a of comps) { const tr = h('tr'), th = h('th', '', cat.items[a].name); th.style.color = ITC[a]; th.style.textAlign = 'left'; th.style.padding = '3px'; tr.append(th);
        for (const b of comps) { const k = Object.keys(cat.items).find((x) => { const pp = cat.items[x].parts; return pp && ((pp[0] === a && pp[1] === b) || (pp[0] === b && pp[1] === a)); }), td = h('td', '', k ? cat.items[k].name : ''); td.title = k ? cat.items[k].text : ''; if (k && itImg(k)) { const im = h('img'); im.src = itImg(k); im.alt = ''; im.className = 'sicon'; td.prepend(im); } td.style.border = '1px solid #ffffff14'; td.style.padding = '3px'; td.style.cursor = 'help'; tr.append(td); } t.append(tr); }
      const legend = h('div', 'snote', comps.map((k) => `${cat.items[k].name}: ${cat.items[k].text}`).join(' · '));
      const cl = h('button', 'smain', L('닫기', 'Close')); cl.type = 'button'; cl.onclick = () => { book = false; paint(); }; p.append(legend, t, h('div', 'snote', L('칸에 마우스를 올리면 효과가 보입니다. 완성 아이템은 부품 둘의 능력을 그대로 갖고 고유 효과가 하나 더 붙습니다.', 'Hover a cell to see its effect. A finished item keeps both components\' bonuses and adds a unique effect.')), cl); md.append(p); md.onclick = (e) => { if (e.target === md) { book = false; paint(); } }; w.append(md); }
    if (r.itemOffer) { const md = h('div', 'smodal'), p = h('div', 'spn'); const full = r.itemOffer.some((k) => cat.items[k] && cat.items[k].parts); p.append(h('h3', '', full ? L('보스 전리품 — 완성 아이템 하나를 고르세요', 'Boss spoils — pick one finished item') : L('보급선 도착 — 부품 하나를 고르세요', 'Supply ship — pick one component'))); const row = h('div', 'stop'); r.itemOffer.forEach((k, i) => { const b = h('button', 'smain', `${cat.items[k].name} · ${cat.items[k].text}`); b.type = 'button'; b.onclick = () => act({ op: 'take', i }); row.append(b); }); p.append(row); md.append(p); w.append(md); }
    m.append(w);
  }

  async function fightNow() {
    sel = null; itemSel = null; const r = await call(window.sllm.scFight()); if (!r.ok || !r.fight) { paint(); return; } await playBattle(r.fight); paint();
  }
  // 실시간 전투 재생(2026-11-03 사용자: 림토체스처럼 싸움 보는 맛). 앱이 계산한 위치 기록(0.2초마다)·사격·명중을 캔버스에 그린다. 결과는 바뀌지 않는다.
  function playBattle(F) {
    return new Promise((resolve) => {
      const B = F.battle, FD = 0.2, W = 1000, H = 600, wrap = h('div', 'sc'), ar = h('div', 'sarena'); wrap.append(ar); document.body.append(wrap);
      const ttl = h('div', 'sttl', L(`${F.round}라운드 — ${F.enemy}`, `Round ${F.round} — ${F.enemy}`) + (F.boss ? ' ☠' : '')), hud = h('div', 'shud');
      const cv = h('canvas'); cv.className = 'scv'; const res = h('div', 'sres'), ctl = h('div', 'stop'); ctl.style.justifyContent = 'center'; ar.append(ttl, hud, cv, res, ctl);
      const fit = () => { const sc = Math.min((innerWidth - 40) / W, (innerHeight - 270) / H); cv.style.width = W * sc + 'px'; cv.style.height = H * sc + 'px'; const dpr = window.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr; }; fit(); addEventListener('resize', fit);
      const c = cv.getContext('2d'); const fs = B.fighters.map((f) => ({ ...f, dead: -1, face: f.side === 0 ? 0 : Math.PI, flash: 0 })), N = fs.length;
      const defOf = (id) => cat.ships.find((x) => x.id === id), sizeOf = (f) => (f.id === 'shroud_avatar' ? 22 : 9 + ((defOf(f.id) || {}).cost || 1) * 3.2) * (1 + (f.star - 1) * 0.12) * (((defOf(f.id) || {}).big) || 1);
      const stars = Array.from({ length: 160 }, (_, i) => [((i * 7919) % 1000), ((i * 104729) % 600), (i % 3) * 0.4 + 0.3]);
      const pos = (i, t) => { const k = Math.max(0, Math.min(B.frames.length - 1, t / FD)), k0 = Math.floor(k), k1 = Math.min(B.frames.length - 1, k0 + 1), u = k - k0, a0 = B.frames[k0], a1 = B.frames[k1]; return [a0[i * 2] + (a1[i * 2] - a0[i * 2]) * u, a0[i * 2 + 1] + (a1[i * 2 + 1] - a0[i * 2 + 1]) * u]; };
      const parts = [], pops = []; let ei = 0, si = 0, t = 0, speed = 1, done = false, last = performance.now(), stall = 0; const live = [];
      const spark = (x, y, col, n, sp, life) => { for (let k = 0; k < n; k++) { const an = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, life, max: life, col, r: 1 + Math.random() * 2 }); } };
      const apply = (e) => { const d = fs[e.d]; if (!d) return; if (e.kind === 'freeze') { d.frozenTo = e.t + 1.6; const p = pos(e.d, e.t); pops.push({ x: p[0], y: p[1] - 22, txt: '⏳', col: '#d8d8e8', life: 1.2 }); if (stall <= 0 && speed <= 2) stall = 0.35; return; } if (e.kind === 'repair') { const k = e.l || 'hp'; d[k] = (k === 'hp' ? Math.min(d.maxHp, d.hp - e.dmg) : d[k] - e.dmg); const p = pos(e.d, e.t); pops.push({ x: p[0], y: p[1] - 20, txt: '+' + (-e.dmg), col: k === 'sh' ? '#7fd8ff' : k === 'ar' ? '#e0c890' : '#9be37a', life: 1 }); return; }
        const p = pos(e.d, e.t); if (e.kind === 'dodge') { pops.push({ x: p[0], y: p[1] - 18, txt: L('회피', 'Miss'), col: '#bbb', life: 0.8 }); return; }
        let left = e.dmg; for (const k of ['sh', 'ar', 'hp']) { const take = Math.min(Math.max(0, d[k]), left); d[k] -= take; left -= take; if (left <= 0) break; } d.flash = 0.15;
        spark(p[0], p[1], e.kind === 'burst' ? '#ffd27a' : d.sh > 0 ? '#7fd8ff' : '#ffb070', e.kind === 'burst' ? 14 : 6, 90, 0.4);
        if (e.dmg) pops.push({ x: p[0] + (Math.random() * 16 - 8), y: p[1] - 16, txt: e.kind === 'crit' ? e.dmg + '!' : String(e.dmg), col: e.kind === 'crit' ? '#ffe14d' : e.kind === 'reflect' ? '#c9f27a' : e.kind === 'burst' ? '#ffd27a' : d.side === 0 ? '#ff9a9a' : '#fff', life: 0.8 });
        if (e.kind === 'burst') live.push({ kind: 'arc', a: e.a, d: e.d, t0: e.t, life: 0.25 });
        if (e.kill) { d.hp = 0; d.dead = e.t; spark(p[0], p[1], '#ffcf7a', 34, 160, 0.9); spark(p[0], p[1], '#ff6b3d', 20, 90, 1.1); live.push({ kind: 'boom', x: p[0], y: p[1], t0: e.t, life: 0.7, r: sizeOf(d) }); } };
      const IMG = {}; if (cat.art) for (const [id, src] of Object.entries(cat.art.ships)) if (src) { const im = new Image(); im.src = src; IMG[id] = im; } let ARENA_IMG = null; if (cat.art && cat.art.arena) { ARENA_IMG = new Image(); ARENA_IMG.src = cat.art.arena; }
      const ship = (f, x, y) => { const r = sizeOf(f), col = f.id === 'shroud_avatar' ? '#b48cff' : FAM[f.fam] || '#ccc', team = f.side === 0 ? '#5fd0ff' : '#ff6b6b';
        c.save(); c.translate(x, y); if (f.dead >= 0) c.globalAlpha = Math.max(0.12, 1 - (t - f.dead) * 1.5); if (f.frozenTo && t < f.frozenTo && f.dead < 0) c.filter = 'grayscale(1) brightness(.75)';
        const im = IMG[f.id]; if (im && im.complete && im.naturalWidth) { const team = f.side === 0 ? 'rgba(95,208,255,.55)' : 'rgba(255,107,107,.55)'; c.fillStyle = team; c.beginPath(); c.ellipse(0, 0, r * 1.5, r * 1.0, f.face, 0, 7); c.globalAlpha *= 0.35; c.fill(); c.globalAlpha = f.dead >= 0 ? Math.max(0.12, 1 - (t - f.dead) * 1.5) : 1; c.rotate(f.face); if (f.flash > 0) { c.shadowColor = '#fff'; c.shadowBlur = 16; } const S2 = r * 3.3; c.drawImage(im, -S2 / 2, -S2 / 2, S2, S2); }
        else if (f.id === 'shroud_avatar') { const g = c.createRadialGradient(0, 0, 2, 0, 0, r); g.addColorStop(0, '#f3e8ff'); g.addColorStop(1, 'rgba(180,140,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
        else { c.rotate(f.face); c.shadowColor = team; c.shadowBlur = f.flash > 0 ? 18 : 8; c.fillStyle = f.flash > 0 ? '#fff' : col; c.beginPath(); c.moveTo(r, 0); c.lineTo(-r * 0.7, -r * 0.55); c.lineTo(-r * 0.4, 0); c.lineTo(-r * 0.7, r * 0.55); c.closePath(); c.fill();
          c.shadowBlur = 0; c.strokeStyle = team; c.lineWidth = 1.5; c.stroke(); if (f.role === 'carrier') { c.fillStyle = team; c.fillRect(-r * 0.5, -r * 0.75, r * 0.9, 2); c.fillRect(-r * 0.5, r * 0.75 - 2, r * 0.9, 2); }
          if (f.dead < 0) { c.fillStyle = 'rgba(255,190,110,.85)'; c.beginPath(); c.arc(-r * 0.75, 0, 2 + Math.random() * 1.5, 0, 7); c.fill(); } }
        c.restore(); if (f.dead >= 0) return;
        const bw = Math.max(26, r * 2.2), bx = x - bw / 2, by = y - r - 12, bar = (yy, v, max, colr) => { if (!max) return; c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(bx, yy, bw, 3); c.fillStyle = colr; c.fillRect(bx, yy, bw * Math.max(0, v) / max, 3); };
        bar(by, f.sh, f.maxSh, '#5fd0ff'); bar(by + 4, f.ar, f.maxAr, '#c0a070'); bar(by + 8, f.hp, f.maxHp, f.side === 0 ? '#4cc38a' : '#ff6b6b');
        if (f.star > 1) { c.fillStyle = '#f2c86b'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('★'.repeat(f.star), x, y + r + 12); } };
      function frame(now) {
        if (done) return; const real = Math.min(0.1, (now - last) / 1000); last = now;
        if (stall > 0) { stall -= real; render(0); c.fillStyle = 'rgba(200,200,210,.28)'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText(L('(응답 없음)', '(Not Responding)'), W / 2, H / 2); c.textAlign = 'start'; requestAnimationFrame(frame); return; } // 후반 렉의 화신: 화면이 잠깐 멈춤
        const dt = real * speed; t += dt; render(dt);
        if (t >= B.ticks + 1.2) { finish(); return; } requestAnimationFrame(frame);
      }
      function render(dt) {
        while (ei < B.events.length && B.events[ei].t <= t) apply(B.events[ei++]);
        while (si < B.shots.length && B.shots[si].t <= t) { const s0 = B.shots[si++]; live.push({ kind: s0.kind, a: s0.a, d: s0.d, t0: s0.t, life: Math.max(0.14, s0.travel), wob: Math.random() * 6.28 }); const p = pos(s0.a, s0.t); spark(p[0], p[1], FAM[fs[s0.a].fam] || '#fff', 2, 40, 0.15); }
        for (let i = 0; i < N; i++) { const p0 = pos(i, t - 0.15), p1 = pos(i, t), dx = p1[0] - p0[0], dy = p1[1] - p0[1]; if (Math.hypot(dx, dy) > 0.6) fs[i].face = Math.atan2(dy, dx); fs[i].flash = Math.max(0, fs[i].flash - dt); }
        const dpr = window.devicePixelRatio || 1; c.setTransform(dpr, 0, 0, dpr, 0, 0); const bg = c.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, '#071425'); bg.addColorStop(0.5, '#0b0820'); bg.addColorStop(1, '#1a0712'); c.fillStyle = bg; c.fillRect(0, 0, W, H); if (ARENA_IMG && ARENA_IMG.complete && ARENA_IMG.naturalWidth) { c.globalAlpha = 0.85; c.drawImage(ARENA_IMG, 0, 0, W, H); c.globalAlpha = 1; }
        for (const [x, y, a] of stars) { c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect((x - t * 4 * a + 2000) % W, y, 1.5, 1.5); }
        c.strokeStyle = 'rgba(255,255,255,.05)'; c.setLineDash([4, 8]); c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke(); c.setLineDash([]);
        for (let k = live.length - 1; k >= 0; k--) { const L0 = live[k], u = (t - L0.t0) / L0.life; if (u >= 1) { live.splice(k, 1); continue; }
          if (L0.kind === 'boom') { c.strokeStyle = `rgba(255,200,120,${1 - u})`; c.lineWidth = 3; c.beginPath(); c.arc(L0.x, L0.y, L0.r * (1 + u * 3), 0, 7); c.stroke(); continue; }
          const A = pos(L0.a, L0.t0), D = pos(L0.d, Math.min(t, L0.t0 + L0.life)), col = FAM[fs[L0.a].fam] || '#fff';
          if (L0.kind === 'beam' || L0.kind === 'arc') { c.strokeStyle = L0.kind === 'arc' ? `rgba(255,220,120,${1 - u})` : col; c.globalAlpha = 1 - u; c.lineWidth = L0.kind === 'arc' ? 2 : 3; c.shadowColor = col; c.shadowBlur = 12; c.beginPath(); c.moveTo(A[0], A[1]);
            if (L0.kind === 'arc') { for (let q = 1; q < 6; q++) c.lineTo(A[0] + (D[0] - A[0]) * q / 6 + (Math.random() * 14 - 7), A[1] + (D[1] - A[1]) * q / 6 + (Math.random() * 14 - 7)); } c.lineTo(D[0], D[1]); c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1; continue; }
          const curve = L0.kind === 'missile' ? Math.sin(u * Math.PI) * 30 * Math.sin(L0.wob) : 0, x = A[0] + (D[0] - A[0]) * u, y = A[1] + (D[1] - A[1]) * u + curve;
          if (L0.kind === 'shell') { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x - (D[0] - A[0]) * 0.04, y - (D[1] - A[1]) * 0.04); c.lineTo(x, y); c.stroke(); }
          else if (L0.kind === 'missile') { c.fillStyle = '#ffd0d0'; c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); if (Math.random() < 0.6) parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, col: 'rgba(200,200,200,.5)', r: 2 }); }
          else { for (let q = 0; q < 3; q++) { const ox = Math.cos(L0.wob + q * 2.1) * 8, oy = Math.sin(L0.wob + q * 2.1) * 8; c.fillStyle = col; c.beginPath(); c.moveTo(x + ox + 4, y + oy); c.lineTo(x + ox - 3, y + oy - 3); c.lineTo(x + ox - 3, y + oy + 3); c.fill(); } } }
        for (let i = 0; i < N; i++) { const p = pos(i, t); ship(fs[i], p[0], p[1]); }
        for (let k = parts.length - 1; k >= 0; k--) { const q = parts[k]; q.life -= dt; if (q.life <= 0) { parts.splice(k, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; c.globalAlpha = q.life / q.max; c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.r, 0, 7); c.fill(); } c.globalAlpha = 1;
        c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; for (let k = pops.length - 1; k >= 0; k--) { const q = pops[k]; q.life -= dt; q.y -= 22 * dt; if (q.life <= 0) { pops.splice(k, 1); continue; } c.globalAlpha = Math.min(1, q.life * 2); c.fillStyle = q.col; c.fillText(q.txt, q.x, q.y); } c.globalAlpha = 1;
        const side = (sd) => fs.filter((f) => f.side === sd), hpOf = (L0) => L0.reduce((a, f) => a + Math.max(0, f.hp) + Math.max(0, f.ar) + Math.max(0, f.sh), 0), maxOf = (L0) => L0.reduce((a, f) => a + f.maxHp + f.maxAr + f.maxSh, 0);
        hud.textContent = ''; for (const sd of [0, 1]) { const L0 = side(sd), e = h('div', 'shs'), bar = h('i'); bar.style.width = (hpOf(L0) / Math.max(1, maxOf(L0)) * 100) + '%'; bar.style.background = sd ? '#ff6b6b' : '#4cc38a'; const bb = h('div', 'sbar'); bb.style.width = '200px'; bb.append(bar); e.append(h('span', '', (sd ? F.enemy : L('우리 함대', 'Our fleet')) + ` ${L0.filter((f) => f.hp > 0).length}/${L0.length}`), bb); hud.append(e); if (!sd) hud.append(h('b', '', `${Math.floor(t)}s`)); }
      }
      const sp = h('button', '', L('속도 ×1', 'Speed ×1')); sp.type = 'button'; sp.onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; sp.textContent = L(`속도 ×${speed}`, `Speed ×${speed}`); };
      const skip = h('button', '', L('결과 보기', 'Skip')); skip.type = 'button'; skip.onclick = () => finish(); ctl.append(sp, skip);
      function finish() { if (done) return; done = true; t = B.ticks + 0.8; while (ei < B.events.length) apply(B.events[ei++]); si = B.shots.length; pops.length = 0; parts.length = 0; live.length = 0; render(0); // 건너뛰면 남은 명중만 반영하고 효과는 지움
        res.innerHTML = ''; res.append(h('div', '', F.won ? L('승리!', 'Victory!') : L('패배', 'Defeat')), h('div', 'snote', F.won ? L(`자재 +${F.gold}`, `Materials +${F.gold}`) + (F.boss ? L(' · 보스 격파!', ' · Boss defeated!') : '') : L(`목숨 −1 · 자재 +${F.gold}`, `Lost a life · materials +${F.gold}`)));
        if (F.bonus && F.bonus.score) res.append(h('div', 'snote', L(`점수 +${F.bonus.score}`, `Score +${F.bonus.score}`)));
        const Bo = F.bonus || {}, bn = [];
        if (Bo.drop) { const dr = h('div', 'sdrop'), ic = itImg(Bo.drop); if (ic) { const im = h('img'); im.src = ic; im.alt = ''; dr.append(im); } else { const sw = h('span', 'sdot'); sw.style.background = itBg(Bo.drop); dr.append(sw); } dr.append(h('span', '', L(`💠 적 잔해에서 부품을 건졌습니다 — 「${Bo.dropName || Bo.drop}」`, `💠 Salvaged a component from the wreckage — "${Bo.dropName || Bo.drop}"`))); res.append(dr); } // 랜덤 드랍(20%)
        if (Bo.sporeItem) bn.push(L(`🍄 포자 6개 → 부품 「${Bo.sporeItemName}」`, `🍄 6 spores → component "${Bo.sporeItemName}"`)); else if (Bo.spores !== undefined) bn.push(L(`🍄 포자 ${Bo.spores}/6`, `🍄 Spores ${Bo.spores}/6`));
        if (Bo.plunderGold) bn.push(L(`💰 전리품 → 자재 +${Bo.plunderGold}`, `💰 Plunder → materials +${Bo.plunderGold}`)); else if (Bo.plunder !== undefined) bn.push(L(`💰 전리품 ${Bo.plunder}/10`, `💰 Plunder ${Bo.plunder}/10`));
        if (Bo.forged) bn.push(L(`🌱 식물 함선 ${Bo.forged}척이 자랐습니다`, `🌱 ${Bo.forged} Plantoid ship(s) grew`));
        if (bn.length) res.append(h('div', 'snote', bn.join(' · ')));
        if (F.payout !== null) res.append(h('div', 'snote', L(`판이 끝났습니다. 배당 ${fmt(F.payout)}`, `Run over. Payout ${fmt(F.payout)}`)));
        ctl.innerHTML = ''; const ok = h('button', 'smain', L('계속', 'Continue')); ok.type = 'button'; ok.onclick = close; ctl.append(ok); ok.focus(); }
      function close() { removeEventListener('resize', fit); document.removeEventListener('keydown', esc, true); wrap.remove(); resolve(); }
      const esc = (ev) => { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); if (!done) finish(); else close(); } }; document.addEventListener('keydown', esc, true);
      requestAnimationFrame((n) => { last = n; frame(n); });
    });
  }
  async function draw(m, e) {
    css(); env = e; host = m; try { const s = await window.sllm.scState(); cat = s.catalog; st = s; } catch { if (!st) return; } // 세이브가 바뀌었을 수 있어 그릴 때마다 새로 읽음(가벼움)
    m.textContent = ''; const wrap = h('div', 'sc'); wrap.style.display = 'block'; m.append(wrap);
    if (!st.sid) { wrap.append(h('div', 'spn sintro', L('세이브를 불러온 뒤에 쓸 수 있습니다.', 'Load a save first.'))); return; }
    if (!st.run) drawIntro(wrap, st); else if (st.run.over) drawOver(wrap, st.run); else { wrap.style.display = ''; wrap.className = ''; drawRun(wrap, st); }
  }
  async function refresh() { const s = await window.sllm.scState(); cat = s.catalog; st = s; }
  window.SLLMStellaChess = { draw, refresh, busy: () => busy || !!document.querySelector('') };
})();
