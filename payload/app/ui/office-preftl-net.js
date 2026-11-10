// 원시문명 인터넷 염탐(2026-11-04 사용자) — 「원시문명 관측」 상세 화면에 「컴퓨터망 접속」 칸을 덧붙인다. 앱: src/features/preftl-net-app.ts · 규칙: src/preftl-net.ts
// 본문(office-preftl.js)은 건드리지 않는다: #pftlRoot 가 다시 그려질 때마다 상세(.pf-detail)의 문명 이름으로 찾아 칸을 붙인다.
// 원자력 시대 = 녹색 인광 단말기 화면(옛 게임 터미널 느낌, 실제 상표·문구 없음) · 초기 우주 시대 = 2000년대 초 운영체제 창·브라우저·테이블 게시판(2026-11-04 사용자). 문구는 L(한, 영)만 — 언어 팩 호환.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const css = () => { if (document.getElementById('pnCss')) return; const st = h('style'); st.id = 'pnCss'; st.textContent =
    '#pnBox{margin:10px 0 4px}#pnBox .pn-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#pnBox .pn-list{margin:6px 0 0;padding:0;list-style:none}#pnBox .pn-list li{margin:3px 0}#pnBox .pn-list button{background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}'
    // 단말기(원자력 시대)
    + '#pnWin{position:fixed;inset:0;z-index:9000;background:#000c;display:flex;align-items:center;justify-content:center}'
    + '#pnWin .pn-term{position:relative;width:min(760px,94vw);height:min(560px,86vh);padding:22px 26px;box-sizing:border-box;background:radial-gradient(ellipse at center,#062b10 0%,#021407 75%,#010a04 100%);color:#3dff7a;font:15px/1.45 "Consolas","D2Coding","Courier New",monospace;text-shadow:0 0 4px #3dff7a99,0 0 1px #3dff7a;border-radius:18px;box-shadow:inset 0 0 60px #000,0 0 0 10px #1b1d18,0 0 0 12px #333;overflow:hidden;display:flex;flex-direction:column}'
    + '#pnWin .pn-term::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(to bottom,#0000 0,#0000 2px,#0006 3px);animation:pnFlick 4s infinite}'
    + '@keyframes pnFlick{0%,100%{opacity:.85}50%{opacity:1}}'
    + '#pnWin .pn-scr{flex:1;overflow:auto;white-space:pre-wrap;word-break:break-word;scrollbar-width:none}#pnWin .pn-scr::-webkit-scrollbar{display:none}'
    + '#pnWin .pn-term button{background:none;border:0;color:inherit;font:inherit;text-shadow:inherit;cursor:pointer;padding:0;text-align:left}#pnWin .pn-term button:hover,#pnWin .pn-term button:focus{background:#3dff7a;color:#021407;text-shadow:none;outline:0}'
    + '#pnWin .pn-cur{display:inline-block;width:.6em;height:1em;background:#3dff7a;vertical-align:-2px;animation:pnBlink 1s steps(1) infinite}@keyframes pnBlink{50%{opacity:0}}'
    + '#pnWin .pn-dim{opacity:.65}'
    // 현대식 게시판(초기 우주 시대)
    // 2000년대 초 느낌(2026-11-04 사용자): 그 시절 운영체제 창 + 옛 웹 브라우저 + 게시판(테이블·파란 그라데이션 머리줄). 실제 로고·상표는 없음.
    + '#pnWin .pn-xp{width:min(820px,95vw);height:min(620px,90vh);display:flex;flex-direction:column;background:#ece9d8;border:1px solid #0831d9;border-radius:8px 8px 0 0;box-shadow:2px 4px 14px #000a;font:12px Tahoma,Verdana,"Malgun Gothic",sans-serif;color:#000;overflow:hidden}'
    + '#pnWin .xp-t{display:flex;align-items:center;gap:6px;height:28px;padding:0 4px 0 8px;background:linear-gradient(#0a5fe8 0%,#3d8af7 8%,#0a5be3 40%,#0848c8 88%,#0438a8 100%);color:#fff;font-weight:700;font-size:13px;text-shadow:1px 1px #0a1e6a}'
    + '#pnWin .xp-t span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pnWin .xp-t i{display:inline-block;width:16px;height:16px;border-radius:3px;background:radial-gradient(circle at 35% 35%,#fff,#7cc4ff 45%,#1e6fd9)}'
    + '#pnWin .xp-b{width:21px;height:21px;border:1px solid #fff;border-radius:3px;background:linear-gradient(#5a9bff,#2463d8);color:#fff;font:700 12px/18px Tahoma,sans-serif;text-align:center;padding:0;cursor:default}#pnWin .xp-b.x{background:linear-gradient(#e8836b,#c7391b);cursor:pointer}'
    + '#pnWin .xp-m{display:flex;gap:14px;padding:3px 8px;border-bottom:1px solid #c5c2b2}#pnWin .xp-m u{text-decoration:none}'
    + '#pnWin .xp-a{display:flex;align-items:center;gap:6px;padding:3px 6px;border-bottom:1px solid #c5c2b2}#pnWin .xp-a span{color:#555}#pnWin .xp-a div{flex:1;background:#fff;border:1px solid #7f9db9;padding:2px 5px;white-space:nowrap;overflow:hidden}#pnWin .xp-a b{padding:1px 8px;border:1px solid #7f9db9;border-radius:3px;background:linear-gradient(#fff,#d6e6c4);font-weight:400}'
    + '#pnWin .xp-i{padding:4px 8px;background:#ffffe1;border-bottom:1px solid #a9a9a9;font-size:11.5px}'
    + '#pnWin .xp-v{flex:1;overflow:auto;background:#fff;padding:10px 12px;font:12px Verdana,"Malgun Gothic",sans-serif}'
    + '#pnWin .xp-s{display:flex;justify-content:space-between;padding:2px 8px;border-top:1px solid #c5c2b2;font-size:11px}'
    + '#pnWin .bb-logo{font:700 22px Georgia,"Malgun Gothic",serif;color:#105289;margin:0 0 2px}#pnWin .bb-sub{color:#555;margin:0 0 8px;font-size:11px}#pnWin .bb-nav{font-size:11px;margin:0 0 6px}#pnWin .bb-nav a,#pnWin .bb a{color:#105289;cursor:pointer;text-decoration:underline}'
    + '#pnWin table.bb{width:100%;border-collapse:collapse;border:1px solid #a8b8c8;margin:0 0 10px}#pnWin .bb th{background:linear-gradient(#6aa3d6,#2f6ea8);color:#fff;font-size:11px;text-align:left;padding:4px 6px;border:1px solid #2f6ea8}'
    + '#pnWin .bb td{padding:6px;border:1px solid #c8d4e0;vertical-align:top}#pnWin .bb tr:nth-child(odd) td{background:#ecf3f7}#pnWin .bb tr:nth-child(even) td{background:#e1ebf2}#pnWin .bb td.n{text-align:center;width:60px;font-size:11px;white-space:nowrap}#pnWin .bb small{color:#666;font-size:10.5px}'
    + '#pnWin .bb td.u{width:130px;font-size:11px}#pnWin .bb td.u b{color:#105289;font-size:12px}#pnWin .bb td.u .av{width:56px;height:56px;margin:4px 0;border:1px solid #999;display:flex;align-items:center;justify-content:center;color:#fff;font:700 22px Georgia,serif}'
    + '#pnWin .bb .ph{font-size:10.5px;color:#666;border-bottom:1px dotted #aaa;padding-bottom:3px;margin-bottom:5px}#pnWin .bb .msg{white-space:pre-wrap;line-height:1.5}'
    + '#pnWin .pn-term textarea,#pnWin .pn-term input{width:100%;box-sizing:border-box;background:#021407;color:#3dff7a;border:1px solid #3dff7a88;font:inherit;text-shadow:inherit;padding:4px 6px;margin:2px 0}#pnWin .pn-term textarea{min-height:64px}'
    + '#pnWin .bb tr.mine td{background:#fff6d6 !important}#pnWin .bb-form{border:1px solid #a8b8c8;background:#ecf3f7;padding:8px;margin:0 0 10px}#pnWin .bb-form b{display:block;background:linear-gradient(#6aa3d6,#2f6ea8);color:#fff;font-size:11px;margin:-8px -8px 8px;padding:4px 6px}'
    + '#pnWin .bb-form input,#pnWin .bb-form textarea{width:100%;box-sizing:border-box;font:12px Verdana,"Malgun Gothic",sans-serif;border:1px solid #7f9db9;padding:3px;margin:2px 0 6px}#pnWin .bb-form textarea{min-height:70px}#pnWin .bb-form button{font:12px Tahoma,sans-serif;padding:2px 12px}#pnWin .bb-msg{font-size:11px;color:#a00;margin-left:8px}';
    document.head.append(st); };
  let busy = false;
  const RISK = [L('현지인 글처럼 섞여 들어갔습니다.', 'It blended in like a local post.'), L('수상하게 여기는 사람들이 있습니다.', 'Some readers found it suspicious.'), L('게시판이 술렁입니다 — 누군가 밖에 있다는 의심이 커졌습니다.', 'The board is in an uproar — suspicion that someone is out there has grown.')];
  // 글쓰기(2026-11-04 사용자): 이번 달 접속에서만, 접속 한 번에 3개. 위험도만큼 인지도가 오른다.
  async function send(c, v, ti, title, text, handle) {
    let r; try { r = await window.sllm.preftlNetPost({ id: c.id, thread: ti, title, text, handle }); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    if (!r || !r.ok) return { error: (r && r.error) || L('글을 올리지 못했습니다.', 'Could not post.') };
    Object.assign(v, r.visit); const it = r.state && r.state.items && r.state.items.find((x) => x.id === c.id); if (it) Object.assign(c, { postBlock: it.postBlock, myLeft: it.myLeft, visits: it.visits });
    const aw = r.aw ?? r.risk;
    if (r.mode === 'web' && r.risk > 0 && !aw) return { ti: r.ti, line: r.risk > 1 ? L('게시판이 잠깐 술렁였지만 「또 낚시글」로 묻혔습니다. 인지도는 그대로입니다.', 'The board stirred for a moment, then wrote it off as another troll. Awareness unchanged.') : L('수상한 글이었지만 인터넷의 소음에 묻혔습니다. 인지도는 그대로입니다.', 'An odd post, but it sank in the noise of the internet. Awareness unchanged.') };
    return { ti: r.ti, line: RISK[r.risk] + (aw ? (r.applied ? L(` 인지도 +${aw}.`, ` Awareness +${aw}.`) + (r.mode === 'web' ? L(' (드물게 퍼져 나갔습니다!)', ' (Against the odds, it went viral!)') : '') : L(' (게임에 인지도를 반영하지 못했습니다.)', ' (Awareness could not be applied in the game.)')) : '') };
  }
  const canPost = (c, v) => c.visits && c.visits[0] && c.visits[0].date === v.date && c.visits[0].net === v.net && !c.postBlock;
  const close = () => document.getElementById('pnWin')?.remove();

  // ---- 단말기(원자력): 줄 단위로 찍히고, 번호를 눌러 스레드를 연다.
  function term(c, v) {
    close(); const ov = h('div'); ov.id = 'pnWin'; ov.setAttribute('data-i18n-skip', ''); ov.onclick = (e) => { if (e.target === ov) close(); };
    const box = h('div', 'pn-term'), scr = h('div', 'pn-scr'); box.append(scr); ov.append(box); document.body.append(ov);
    let timer = null;
    const type = (lines, after) => { clearInterval(timer); scr.textContent = ''; let i = 0; const cursor = h('span', 'pn-cur');
      timer = setInterval(() => { if (!document.body.contains(scr)) return clearInterval(timer); if (i >= lines.length) { clearInterval(timer); if (after) after(); scr.append(cursor); return; }
        const ln = lines[i++]; const el = typeof ln === 'string' ? h('div', '', ln || ' ') : ln; scr.append(el); scr.scrollTop = scr.scrollHeight; }, 55); };
    const opt = (label, fn) => { const b = h('button', '', label); b.type = 'button'; b.onclick = fn; const d = h('div'); d.append(b); return d; };
    const head = () => [`${v.net.toUpperCase()}`, L('원격 단말 접속 — 회선: 관측소 중계(비인가)', 'REMOTE TERMINAL SESSION — LINE: OBSERVATION POST RELAY (UNAUTHORIZED)'), `${L('날짜', 'DATE')} ${v.date}`, '================================================'];
    const menu = () => type([...head(), L('> 게시판 목록', '> BOARD INDEX'), '', ...v.threads.map((t, i) => opt(`[${i + 1}] ${t.title}`, () => thread(i))), '', ...(canPost(c, v) ? [opt(L(`[ 새 글 쓰기 ] (${c.myLeft}번 남음)`, `[ NEW POST ] (${c.myLeft} LEFT)`), () => write(-1))] : []), opt(L('[ 접속 끊기 ]', '[ DISCONNECT ]'), close), h('div', 'pn-dim', L('※ 그들은 우리가 읽고 있다는 것을 모릅니다.', '* THEY DO NOT KNOW WE ARE READING.'))]);
    const thread = (i) => { const t = v.threads[i]; type([...head(), `> ${t.title}`, '', ...t.posts.flatMap((p, k) => [`#${String(k + 1).padStart(2, '0')} ${p.who}${p.mine ? L('  [우리]', '  [US]') : ''}`, `  ${p.text}`, '']), ...(canPost(c, v) ? [opt(L(`[ 답글 쓰기 ] (${c.myLeft}번 남음)`, `[ WRITE REPLY ] (${c.myLeft} LEFT)`), () => write(i))] : []), opt(L('[ 목록으로 ]', '[ BACK TO INDEX ]'), menu), ...(last ? [h('div', 'pn-dim', '> ' + last)] : [])]); last = ''; };
    let last = '';
    const write = (i) => {
      const t = i >= 0 ? v.threads[i] : null, f = h('div'), hd2 = h('input'), ti2 = h('input'), ta = h('textarea'), msg = h('div', 'pn-dim');
      hd2.placeholder = L('글쓴이 ID (비우면 ', 'USER ID (blank = ') + c.handle + ')'; hd2.maxLength = 24; ti2.placeholder = L('제목', 'SUBJECT'); ti2.maxLength = 70; ta.maxLength = 360; ta.placeholder = L('본문 — 현지인처럼 쓸수록 들키지 않습니다.', 'MESSAGE — the more local you sound, the less you are noticed.');
      f.append(hd2); if (!t) f.append(ti2); f.append(ta);
      const sendB = opt(L('[ 전송 ]', '[ TRANSMIT ]'), async () => { if (!ta.value.trim()) return; sendB.firstChild.disabled = true; msg.textContent = L('전송 중...', 'TRANSMITTING...'); const r = await send(c, v, i, ti2.value, ta.value, hd2.value); if (r.error) { msg.textContent = '> ' + r.error; sendB.firstChild.disabled = false; return; } last = r.line; thread(r.ti); });
      type([...head(), t ? `> ${t.title} — ${L('답글 작성', 'REPLY')}` : L('> 새 글 작성', '> NEW POST'), '', f, sendB, opt(L('[ 취소 ]', '[ CANCEL ]'), () => (t ? thread(i) : menu())), msg], () => setTimeout(() => ta.focus(), 30));
    };
    type([L('회선 연결 중...', 'ESTABLISHING LINK...'), L('반송파 감지', 'CARRIER DETECTED'), L('인증 우회... 완료', 'BYPASSING AUTH... OK'), ''], () => setTimeout(menu, 350));
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  }
  // ---- 2000년대 초 게시판(초기 우주): 옛 운영체제 창 + 브라우저 + 테이블 게시판. 목록 → 글.
  function web(c, v) {
    close(); const ov = h('div'); ov.id = 'pnWin'; ov.setAttribute('data-i18n-skip', ''); ov.onclick = (e) => { if (e.target === ov) close(); };
    const host = 'www.' + (v.net.replace(/[^A-Za-z0-9]+/g, '').toLowerCase() || 'net' + c.id) + '.net';
    const win = h('div', 'pn-xp'), t = h('div', 'xp-t'), x = h('button', 'xp-b x', '×'); x.type = 'button'; x.title = L('닫기', 'Close'); x.onclick = close;
    t.append(h('i'), h('span', '', `${v.net} ${L('게시판', 'Forums')} - ${L('웹 탐색기', 'Web Explorer')}`), h('button', 'xp-b', '_'), h('button', 'xp-b', '□'), x);
    const menu = h('div', 'xp-m'); for (const m of [L('파일', 'File'), L('편집', 'Edit'), L('보기', 'View'), L('즐겨찾기', 'Favorites'), L('도구', 'Tools'), L('도움말', 'Help')]) menu.append(h('u', '', m));
    const addr = h('div', 'xp-a'), url = h('div'); addr.append(h('span', '', L('주소', 'Address')), url, h('b', '', L('이동', 'Go')));
    const view = h('div', 'xp-v'), stat = h('div', 'xp-s'); stat.append(h('span', '', L('완료', 'Done')), h('span', '', L('인터넷', 'Internet')));
    const hue = (s2) => { let n = 0; for (const ch of s2) n = (n * 31 + ch.charCodeAt(0)) % 360; return n; };
    const top = () => { const f = document.createDocumentFragment(); f.append(h('p', 'bb-logo', v.net), h('p', 'bb-sub', L('자유 토론 게시판', 'Open discussion forums') + ' · ' + v.date)); return f; };
    const index = () => {
      url.textContent = `http://${host}/forum/index.php`; view.textContent = ''; view.append(top());
      const tb = h('table', 'bb'), hr = h('tr'); for (const [k, e] of [['주제', 'Topic'], ['답글', 'Replies'], ['글쓴이', 'Author'], ['마지막 글', 'Last post']]) hr.append(h('th', '', L(k, e))); tb.append(hr);
      v.threads.forEach((th, i) => { const r = h('tr'), a = h('a', '', th.title); a.onclick = () => topic(i); const c1 = h('td'); c1.append(a);
        const last = th.posts[th.posts.length - 1]; const c4 = h('td'); c4.append(h('small', '', `${v.date}\n${L('작성자', 'by')} ${last.who}`));
        r.append(c1, h('td', 'n', String(th.posts.length - 1)), h('td', 'n', th.posts[0].who), c4); tb.append(r); });
      view.append(tb); if (canPost(c, v)) view.append(form(-1)); view.append(h('small', '', L('※ 관측소 중계로 몰래 보는 중입니다. 그들은 모릅니다.', '* Viewing covertly through our observation post. They do not know.'))); view.scrollTop = 0;
    };
    let last = '';
    const form = (i) => {
      const f = h('div', 'bb-form'), hd2 = h('input'), ti2 = h('input'), ta = h('textarea'), go = h('button', '', L('글 올리기', 'Submit')), msg = h('span', 'bb-msg', last); last = '';
      f.append(h('b', '', i >= 0 ? L(`빠른 답글 (${c.myLeft}개 남음)`, `Quick reply (${c.myLeft} left)`) : L(`새 글 쓰기 (${c.myLeft}개 남음)`, `Post a new topic (${c.myLeft} left)`)));
      hd2.placeholder = L('닉네임 (비우면 ', 'Nickname (blank = ') + c.handle + ')'; hd2.maxLength = 24; ti2.placeholder = L('제목', 'Subject'); ti2.maxLength = 70; ta.maxLength = 360; ta.placeholder = L('현지인처럼 쓸수록 들키지 않습니다.', 'The more local you sound, the less you are noticed.');
      f.append(hd2); if (i < 0) f.append(ti2); f.append(ta, go, msg); go.type = 'button';
      go.onclick = async () => { if (!ta.value.trim()) return; go.disabled = true; msg.textContent = L('올리는 중…', 'Posting…'); const r = await send(c, v, i, ti2.value, ta.value, hd2.value); if (r.error) { msg.textContent = r.error; go.disabled = false; return; } last = r.line; topic(r.ti); };
      return f;
    };
    const topic = (i) => {
      const th = v.threads[i]; url.textContent = `http://${host}/forum/viewtopic.php?t=${1000 + c.id * 7 + i}`; view.textContent = ''; view.append(top());
      const nav = h('p', 'bb-nav'), back = h('a', '', L('게시판 목록', 'Board index')); back.onclick = index; nav.append(back, document.createTextNode(' » ' + th.title)); view.append(nav);
      const tb = h('table', 'bb'), hr = h('tr'); hr.append(h('th', '', L('글쓴이', 'Author')), h('th', '', L('내용', 'Message'))); tb.append(hr);
      th.posts.forEach((p, k) => { const r = h('tr', p.mine ? 'mine' : ''), u = h('td', 'u'), av = h('div', 'av', (p.who[0] || '?').toUpperCase()); av.style.background = `hsl(${hue(p.who)} 45% 45%)`;
        u.append(h('b', '', p.who), av, h('small', '', p.mine ? L('우리 (몰래)', 'Us (covert)') : L(`회원 · 글 ${(hue(p.who) * 7) % 900 + 12}개`, `Member · Posts: ${(hue(p.who) * 7) % 900 + 12}`)));
        const m = h('td'); m.append(h('div', 'ph', (k ? 'Re: ' : '') + th.title + ' · ' + v.date), h('div', 'msg', p.text)); r.append(u, m); tb.append(r); });
      view.append(tb); if (last) view.append(h('p', 'bb-msg', last)); last = ''; if (canPost(c, v)) view.append(form(i)); view.scrollTop = 0;
    };
    win.append(t, menu, addr, h('div', 'xp-i', L('관측소 중계 회선으로 연결되었습니다. 이 페이지의 글쓴이들은 우리가 읽고 있다는 것을 모릅니다.', 'Connected through the observation-post relay. The people on this page do not know we are reading.')), view, stat);
    ov.append(win); document.body.append(ov); index();
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  }
  const openVisit = (c, v) => (v.mode === 'web' ? web(c, v) : term(c, v));

  async function add() {
    const root = document.getElementById('pftlRoot'); if (!root || busy) return;
    const det = root.querySelector('.pf-detail'); if (!det || det.querySelector('#pnBox')) return;
    const name = (det.querySelector('.pf-dh b') || {}).textContent || ''; if (!name) return;
    busy = true; let S = null; try { S = await window.sllm.preftlNetState(); } catch (e) { S = null; } busy = false;
    if (!S || !S.ok || !det.isConnected || det.querySelector('#pnBox')) return;
    const c = S.items.find((x) => x.name === name); if (!c) return;
    if (!c.show) return; // 아직 컴퓨터망이 없는 시대·군체: 칸을 아예 안 붙임
    css();
    const box = h('div'); box.id = 'pnBox'; box.setAttribute('data-i18n-skip', '');
    const row = h('div', 'pn-row'); row.append(h('p', 'pf-hh', L('컴퓨터망 염탐', 'Network snooping') + ' · ' + (c.mode === 'web' ? L('대중 인터넷', 'public internet') : L('초기 컴퓨터망', 'early computer network'))));
    const go = h('button', 'pf-btn', L('컴퓨터망 접속', 'Tap into their network')); go.type = 'button'; go.disabled = !!c.block;
    const note = h('p', 'pf-note', c.block || '');
    go.onclick = async () => { go.disabled = true; go.textContent = L('접속 중…', 'Connecting…'); let r; try { r = await window.sllm.preftlNetTap(c.id); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (r && r.ok) { openVisit(c, r.visit); box.remove(); void add(); if (r.note) setTimeout(() => { const b = document.getElementById('pnBox'); if (b) b.append(h('p', 'pf-note', r.note)); }, 50); }
      else { go.disabled = false; go.textContent = L('컴퓨터망 접속', 'Tap into their network'); note.textContent = (r && r.error) || L('접속하지 못했습니다.', 'Could not connect.'); } };
    row.append(go); box.append(row, note);
    if (c.visits.length) { const ul = h('ul', 'pn-list'); for (const v of c.visits) { const li = h('li'), b = h('button', '', `${v.date} · ${v.net} — ${v.threads.map((t) => t.title).slice(0, 2).join(' / ')}${v.llm ? ' · AI' : ''}`); b.type = 'button'; b.onclick = () => openVisit(c, v); li.append(b); ul.append(li); } box.append(ul); }
    const logHead = [...det.querySelectorAll('.pf-hh')].find((x) => x.closest('.pf-detail') === det && x.nextElementSibling && x.nextElementSibling.classList.contains('pf-log'));
    if (logHead) det.insertBefore(box, logHead); else det.append(box);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.sllm || !window.sllm.preftlNetState) return;
    const watch = () => { const root = document.getElementById('pftlRoot'); if (!root) return setTimeout(watch, 400); new MutationObserver(() => { void add(); }).observe(root, { childList: true }); void add(); };
    setTimeout(watch, 700); // office-preftl.js 가 화면을 만든 뒤
  });
})();
