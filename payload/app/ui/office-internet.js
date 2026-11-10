// 집무실 「인터넷」(2026-10-28). 앱: src/features/internet-app.ts(internetState·Open·Refresh·Post·Write·Reply·Nick·Follow·Influencer·Promo), 규칙: src/internet.ts.
// 사이트 3곳: 트윙클(트위터식) · DS인사이드(디시식) · 레드시프트(레딧식). 광고 = ui/internet-data.js(광고주 80곳) + ui/assets/internet/.
// office.html 은 이 파일·css·internet-data.js 만 더하고, 아이콘(「제국 안의 사람들」 끝)·빈 칸(#net)·그리기는 모두 여기서 한다.
// 기계 지성·군체는 아이콘째 숨긴다(office-internet.css 의 body[data-gestalt] 규칙 + 앱도 hidden 으로 답함).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만. 시민 글·광고 문구는 생성 데이터라 data-i18n-skip.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const isKo = () => L('ko', 'en') === 'ko';
  const tx = (o) => (o && typeof o === 'object' ? (isKo() ? o.ko : o.en) || o.en || o.ko || '' : String(o ?? ''));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const show = (id) => { if (!document.getElementById(id)) return; for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); }; // 없는 화면으로 가면 모든 화면이 꺼져 빈 홀로그램만 남는다(2026-10-29 테스터)
  const A = 'assets/internet/';
  const fmtN = (n) => (n >= 10000 ? (isKo() ? (n / 10000).toFixed(1).replace(/\.0$/, '') + '만' : (n / 1000).toFixed(0) + 'K') : String(n));
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const FIELD = { travel: ['여행', 'Travel'], food: ['요리', 'Food'], fitness: ['운동', 'Fitness'], pets: ['반려 생물', 'Pets'], fashion: ['패션', 'Fashion'] };
  const ETH = { xenophile: ['외계인친화', 'Xenophile'], xenophobe: ['외계인혐오', 'Xenophobe'], militarist: ['군국주의', 'Militarist'], pacifist: ['평화주의', 'Pacifist'], authoritarian: ['권위주의', 'Authoritarian'], egalitarian: ['평등주의', 'Egalitarian'], spiritualist: ['정신주의', 'Spiritualist'], materialist: ['물질주의', 'Materialist'] };
  const LBL = (a) => L(a[0], a[1]);

  let S = null, site = 'tw', post = null, twOpen = {}, prof = null, edit = false, promoOpen = false, nickOpen = false, busy = '', note = '', fresh = 0, dsTab = 'all', dsWrite = false, adv = null, root = null, view = null, addr = null, toastEl = null, toastT = 0;
  const posts = () => (S && S.posts && S.posts[site]) || [];
  const findPost = (id) => posts().find((p) => p.id === id);
  function toast(m) { if (!toastEl) return; toastEl.textContent = m || ''; clearTimeout(toastT); if (m) toastT = setTimeout(() => (toastEl.textContent = ''), 3500); }
  function merge(r, s = site) { if (!r) return; if (r.hidden) { S = { hidden: true }; return; } if (!r.ok) { toast(r.error || L('실패했습니다.', 'Failed.')); if (r.needNick) nickOpen = true; return; } const keep = S && S.posts ? S.posts : { tw: [], ds: [], rs: [] }; S = { ...r, posts: { ...keep, ...(r.posts || {}) } }; if (s && r.posts && r.posts[s]) for (const p of keep[s] || []) if (p.comments) { const q = S.posts[s].find((x) => x.id === p.id); if (q && !q.comments) q.comments = p.comments; } }
  async function call(kind, fn) { if (busy) return null; busy = kind; draw(); try { return await fn(); } catch (e) { toast(String((e && e.message) || e)); return null; } finally { busy = ''; draw(); } }

  // ── 광고: 공통 + 우리 제국 윤리 묶음에서. 같은 새로고침 안에서는 같은 광고(씨앗) ──
  function adPool() { const ads = window.SLLMNetAds || [], g = new Set(['common', ...((S && S.ethics) || [])]); return ads.filter((a) => g.has(a.group)); }
  function adPick(slot) { const pool = adPool(); if (!pool.length) return null; const n = posts().length, h = hash(site + ':' + slot + ':' + (S && S.date) + ':' + n); const a = pool[h % pool.length]; return { a, img: a.ads[(h >>> 8) % a.ads.length] }; }
  function adBox(w, hgt, slot, cls) { const p = adPick(slot); if (!p) return ''; return `<img class="net-adimg ${cls || ''}" src="${A}ads/ad_${esc(p.img)}.webp" style="width:${w}px;height:${hgt}px" alt="" title="${esc(L('광고주 홈페이지 열기', 'Open advertiser page'))}" data-act="adv" data-id="${esc(p.a.id)}">`; }
  const adOf = (slot) => adPick(slot);

  // ── 공통 조각 ──
  function avatar(p, big) {
    const cls = 'net-av' + (big ? ' big' : '');
    if (p.by && p.by.kind === 'me') return p.by.off ? `<img class="${cls} img" src="${A}logos/logo_${site === 'rs' ? 'redshift' : 'twinkle'}_a_64.webp" alt="">` : `<img class="${cls} img" src="${A}avatars/avatar_player_civ_a.webp" alt="">`;
    if (p.by && p.by.kind === 'inf') { const x = S.infs.find((i) => i.id === p.by.id); return `<img class="${cls} img" src="${x && x.avatar ? x.avatar : A + 'avatars/avatar_' + esc(p.by.id) + '.webp'}" alt="">`; }
    const nm = String((p.by && p.by.name) || '?').replace(/^u\//, ''); return `<div class="${cls}${p.by && p.by.kind === 'child' ? ' heir' : ''}">${esc(nm.slice(0, 1))}</div>`;
  }
  function infAv(x, cls) { return `<img class="net-av ${cls || ''} img" src="${x.avatar ? x.avatar : A + 'avatars/avatar_' + esc(x.id) + '.webp'}" alt="">`; }
  const ip = (v) => (v ? `<span class="net-ip">(${esc(v)})</span>` : '');
  function acctSel(id) {
    const n = (S && S.nick) || {};
    if (site === 'ds') return `<select id="${id}" class="net-acct"><option value="anon">${esc(L('ㅇㅇ (유동)', 'anon (guest)'))}</option>${n.ds ? `<option value="civ">${esc(n.ds)}</option>` : ''}</select>`;
    const civ = site === 'rs' ? 'u/' + (n.rs || L('(닉네임 없음)', '(no nickname)')) : '@' + (n.tw || L('(닉네임 없음)', '(no nickname)'));
    return `<select id="${id}" class="net-acct"><option value="off">${esc(L('공식 계정', 'Official'))} ✔</option><option value="civ">${esc(L('민간 계정', 'Personal'))} (${esc(civ)})</option></select>`;
  }
  const waitNote = () => (busy === 'write' || busy === 'reply' ? `<div class="net-wait">${esc(L('시민들이 글을 읽고 있습니다…', 'Citizens are reading…'))}</div>` : '');
  const cmWait = (p) => (p && !p.comments && p.ccount > 0 ? `<div class="net-wait">${esc(L('댓글을 불러오는 중…', 'Loading comments…'))}</div>` : '');
  const feedWait = () => (busy === 'open' || busy === 'refresh' ? `<div class="net-wait">${esc(L('새 글을 불러오는 중…', 'Loading new posts…'))}</div>` : '');
  const vote = (n) => (n < 0 ? `▼ ${-n}` : `▲ ${n}`);
  function cmtTree(c, depth, extra) {
    const nm = site === 'rs' ? esc(c.name) : esc(c.name) + ip(c.ip);
    return `<div class="net-c${c.mine ? ' mine' : ''}" style="margin-left:${depth * 14}px"><b>${nm}</b>${site === 'rs' ? ` <small class="${c.up < 0 ? 'neg' : ''}">${vote(c.up)}</small>` : ''} <span>${esc(c.text)}</span>${extra || ''}${(c.replies || []).map((r) => cmtTree(r, depth + 1)).join('')}</div>`;
  }

  // ── 트윙클 ──
  function twPostHtml(p) {
    const inf = p.by.kind === 'inf' ? S.infs.find((x) => x.id === p.by.id) : null, k = isKo();
    const name = inf ? `<span class="nm link" data-act="prof" data-id="${esc(inf.id)}">${esc(tx(inf.name))}</span> <span class="net-star">✦</span>` : `<span class="nm">${esc(p.by.name)}</span>${p.by.off ? ' <span class="net-ver">✔</span>' : ''}${p.by.kind === 'child' ? ` <span class="net-heir">${esc(L('통치자 자녀', "Ruler's child"))}</span>` : ''}`;
    const media = p.promo ? `<img class="net-promo" src="${A}promo/${esc(p.promo.img)}.webp" alt=""><div class="net-promotag">✦ ${esc(L('행성 홍보', 'Planet promo'))} · ${esc(p.promo.planet)}</div>` : p.photo ? `<div class="net-pcard">📷 ${esc(k ? '사진 ' + p.photo.n + '장' : p.photo.n + ' photos')} · ${esc(p.photo.desc)}<div class="pnote">${esc(L('저대역 모드: 이미지 대신 설명만 수신됨', 'Low-bandwidth mode: description only'))}</div></div>` : '';
    const open = twOpen[p.id], cm = p.comments || [];
    const rep = open ? `<div class="net-replies"><div class="net-rbox">${acctSel('twRA_' + p.id)}<input id="twR_${esc(p.id)}" maxlength="400" placeholder="${esc(L('답글 달기', 'Reply'))}"><button type="button" data-act="reply" data-id="${esc(p.id)}" ${busy ? 'disabled' : ''}>${esc(L('올리기', 'Post'))}</button></div>${cm.length && p.ccount > cm.length ? `<div class="lbl">${esc(L('인기 답글', 'Top replies'))}</div>` : ''}${cmWait(p)}${cm.map((c, i) => cmtTree(c, 0, `<span class="net-to link" data-act="replyto" data-id="${esc(p.id)}" data-i="${i}">${esc(L('답글', 'reply'))}</span>`)).join('')}${waitNote()}</div>` : '';
    return `<div class="net-tw-post">${avatar(p)}<div class="b"><div>${name} <span class="h">${esc(p.by.handle || '')}</span> <span class="h">· ${esc(p.date)}</span></div><div class="t">${esc(p.body)}${(p.tags || []).map((t) => ` <span class="net-tag">${esc(t)}</span>`).join('')}</div>${media}
      <div class="acts"><span class="link" data-act="twopen" data-id="${esc(p.id)}">${esc(L('답글', 'Replies'))} ${fmtN(p.ccount)}</span><span>${esc(L('다시 반짝', 'Retwinkle'))} ${fmtN(p.shares)}</span><span>${esc(L('공감', 'Like'))} ${fmtN(p.likes)}</span></div>${rep}</div></div>`;
  }
  function twSponsor() { const p = adOf('twsp'); if (!p) return ''; return `<div class="net-tw-post spon"><div class="net-av">★</div><div class="b"><div><span class="nm">${esc(tx(p.a.name))}</span> <span class="h">${esc(L('후원', 'Sponsored'))}</span></div><div class="t">${esc(tx(p.a.tag))}</div><div style="margin-top:8px">${adBox(480, 320, 'twsp')}</div></div></div>`; }
  function twProfile() {
    const x = S.infs.find((i) => i.id === prof); if (!x) { prof = null; return ''; }
    const k = isKo(), mine = posts().filter((p) => p.by.kind === 'inf' && p.by.id === x.id), following = (S.follow || []).includes(x.id);
    const active = (S.promo || []).filter((pr) => pr.inf === x.id && pr.until >= S.date);
    const ed = edit ? `<div class="net-pedit">
      <label>${esc(L('이름', 'Name'))} <input id="peN" maxlength="30" value="${esc(tx(x.name))}"></label><label>@ <input id="peH" maxlength="20" value="${esc(x.handle)}"></label>
      <label>${esc(L('분야', 'Field'))} <select id="peF">${Object.keys(FIELD).map((f) => `<option value="${f}"${f === x.field ? ' selected' : ''}>${esc(LBL(FIELD[f]))}</option>`).join('')}</select></label>
      <label>${esc(L('성향', 'Leaning'))} <select id="peE">${Object.keys(ETH).map((e) => `<option value="${e}"${e === x.ethic ? ' selected' : ''}>${esc(LBL(ETH[e]))}</option>`).join('')}</select></label>
      <label class="w">${esc(L('소개', 'Bio'))} <input id="peB" maxlength="160" value="${esc(tx(x.bio))}"></label><label class="w">${esc(L('입버릇', 'Catchphrase'))} <input id="peC" maxlength="60" value="${esc(tx(x.catch))}"></label>
      <label class="w">${esc(L('프로필 사진', 'Profile photo'))} <input type="file" id="peP" accept="image/*"> <button type="button" data-act="avreset">${esc(L('기본 사진으로', 'Reset to default'))}</button></label>
      <button type="button" data-act="profsave">${esc(L('저장', 'Save'))}</button><span class="hint">${esc(L('이 세이브에만 저장됩니다. 이름·소개는 지금 화면 언어 쪽만 바뀝니다.', 'Saved to this save only. Name and bio change for the current language only.'))}</span></div>` : '';
    const pr = promoOpen ? `<div class="net-pedit"><b>${esc(L('행성 홍보 의뢰', 'Planet promotion'))}</b><span class="hint">${esc(L(`의뢰하는 즉시 에너지 ${S.promoCost.energy} · 소비재 ${S.promoCost.goods}이(가) 빠져나가고, 2년 동안 그 행성으로 오려는 이주민이 늘어납니다. ${x.name.ko}의 팔로워가 많을수록 효과가 큽니다.`, `On commission ${S.promoCost.energy} energy and ${S.promoCost.goods} consumer goods are paid at once; for two years more migrants want to move to that planet. More followers, bigger effect.`))}</span>
      <label class="w">${esc(L('행성', 'Planet'))} <select id="prP">${(S.planets || []).map((p) => `<option>${esc(p)}</option>`).join('')}</select></label><button type="button" data-act="promogo" ${busy || !(S.planets || []).length ? 'disabled' : ''}>${esc(busy === 'promo' ? L('의뢰 중…', 'Sending…') : L('의뢰하기', 'Commission'))}</button>${(S.planets || []).length ? '' : `<span class="hint">${esc(L('행성 목록이 아직 없습니다(게임이 켜져 있어야 합니다).', 'No planet list yet (the game must be running).'))}</span>`}</div>` : '';
    return `<div class="net-prof"><span class="back link" data-act="profclose">${esc(L('← 타임라인', '← Timeline'))}</span><div class="pban"></div>
      <div class="phead">${infAv(x, 'big')}<div style="flex:1"><div class="pname">${esc(tx(x.name))} <span class="net-star">✦</span></div><div class="h">@${esc(x.handle)} · ${esc(LBL(FIELD[x.field] || FIELD.travel))} · ${esc(LBL(ETH[x.ethic] || ['', '']))}</div></div>
      <button type="button" class="pbtn" data-act="follow" data-id="${esc(x.id)}">${esc(following ? L('팔로잉', 'Following') : L('팔로우', 'Follow'))}</button><button type="button" class="pbtn" data-act="promo">${esc(L('행성 홍보 의뢰', 'Request planet promo'))}</button><button type="button" class="pbtn" data-act="edit" title="${esc(L('프로필 편집', 'Edit profile'))}">⚙</button></div>
      <div class="pbio">${esc(tx(x.bio))}</div><div class="h">“${esc(tx(x.catch))}” · ${esc(L('팔로워', 'Followers'))} <b>${fmtN(x.followers + (following ? 1 : 0))}</b>${active.length ? ' · ' + esc(L('홍보 중: ', 'Promoting: ')) + active.map((a) => esc(a.planet) + ' (~' + esc(a.until) + ')').join(', ') : ''}</div>
      ${ed}${pr}<div class="ptitle">${esc(L('최근 트윙클', 'Recent twinkles'))}</div>${mine.length ? mine.map(twPostHtml).join('') : `<p class="net-empty">${esc(L('아직 이 사람의 글이 없습니다. ⟳ 새로고침을 눌러 보세요.', 'No posts from them yet. Try ⟳ refresh.'))}</p>`}</div>`;
  }
  function twView() {
    const list = posts(), tags = {}; for (const p of list) for (const t of p.tags || []) tags[t] = (tags[t] || 0) + 1;
    const trend = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const comp = `${feedWait()}<div class="net-compose">${acctSel('twAcct')}<textarea id="twTxt" maxlength="1200" placeholder="${esc(L('무슨 일이 있나요?', "What's happening?"))}"></textarea><button type="button" data-act="write" ${busy ? 'disabled' : ''}>${esc(L('올리기', 'Post'))}</button>${busy === 'write' ? waitNote() : ''}</div>`;
    let feed = ''; list.forEach((p, i) => { feed += twPostHtml(p); if (i === 2) feed += twSponsor(); });
    const center = prof ? twProfile() : comp + (fresh ? `<div class="net-newbar">${esc(L(`새 트윙클 ${fresh}개`, `${fresh} new twinkles`))}</div>` : '') + (feed || `<p class="net-empty">${esc(L('아직 글이 없습니다.', 'No posts yet.'))}</p>`);
    const sp = adOf('twside');
    return `<div class="net-tw"><div class="nav"><div class="logo"><img class="lg" src="${A}logos/logo_twinkle_a_64.webp" alt="">Twinkle</div>${[L('홈', 'Home'), L('탐색', 'Explore'), L('알림', 'Alerts'), L('메시지', 'Messages'), L('북마크', 'Bookmarks')].map((x) => `<div>${esc(x)}</div>`).join('')}</div>
      <div class="feed">${center}</div>
      <div class="side"><div class="box"><h4>${esc(L('지금 뜨는 태그', 'Trending now'))}</h4>${trend.length ? trend.map(([t, n]) => `<div class="trend">${esc(t)}<small>${n * 37 + 120} twinkles</small></div>`).join('') : `<div class="trend"><small>${esc(L('조용한 하루', 'A quiet day'))}</small></div>`}</div>
      <div class="box"><h4>${esc(L('인기 인플루언서', 'Top creators'))}</h4>${S.infs.map((x) => `<div class="irow">${infAv(x, 'mini')}<span class="nm link" data-act="prof" data-id="${esc(x.id)}">${esc(tx(x.name))}</span> <span class="net-star">✦</span><small>${esc(LBL(FIELD[x.field] || FIELD.travel))} · ${fmtN(x.followers + ((S.follow || []).includes(x.id) ? 1 : 0))}</small></div>`).join('')}</div>
      ${sp ? `<div class="box"><h4>${esc(L('추천 계정', 'Who to follow'))}</h4><div class="who">${adBox(48, 48, 'twside')}<div style="flex:1">${esc(tx(sp.a.name))}<div class="h">${esc(L('후원', 'Sponsored'))}</div></div></div></div>` : ''}</div></div>`;
  }

  // ── DS인사이드 ──
  function dsView() {
    let inner; const k = isKo();
    const p = post ? findPost(post) : null;
    if (!p) {
      const list = posts().filter((x) => (dsTab === 'star' ? x.star : true));
      const ban = adOf('dsban');
      inner = `<div class="sub">${[['all', L('전체글', 'All')], ['star', L('개념성', 'Hall of Stars')]].map(([id, t]) => `<span class="${dsTab === id ? 'on' : ''}" data-act="dstab" data-id="${id}">${esc(t)}</span>`).join('')}<span style="margin-left:auto" data-act="dswrite">${esc(L('글쓰기', 'Write'))}</span></div>
        ${dsWrite ? `<div class="net-compose">${acctSel('dsAcct')}<input id="dsTi" maxlength="80" placeholder="${esc(L('제목', 'Title'))}"><textarea id="dsBo" maxlength="1200" placeholder="${esc(L('내용', 'Body'))}"></textarea><button type="button" data-act="write" ${busy ? 'disabled' : ''}>${esc(L('올리기', 'Post'))}</button>${busy === 'write' ? waitNote() : ''}</div>` : ''}
        <table><tr>${[L('말머리', 'Tag'), L('제목', 'Title'), L('글쓴이', 'Author'), L('작성일', 'Date'), L('조회', 'Views'), L('추천', 'Up')].map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
        ${list.map((x, i) => `<tr><td class="head">${esc(x.head || L('잡담', 'Chat'))}</td><td class="t" data-act="open" data-id="${esc(x.id)}">${x.star ? '★ ' : ''}${esc(x.title || x.body.slice(0, 40))} <span class="cm">[${fmtN(x.ccount)}]</span></td><td>${esc(x.by.name)}${ip(x.by.ip)}</td><td>${esc(String(x.date).slice(5))}</td><td>${fmtN(x.views)}</td><td>${fmtN(x.likes)}</td></tr>${i === 2 && ban ? `<tr><td colspan="6" style="padding:0"><div class="banner">${adBox(100, 100, 'dsban')}<div class="txt">${esc(tx(ban.a.tag))}</div><span class="tag">${esc(L('광고', 'AD'))}</span></div></td></tr>` : ''}`).join('')}</table>${list.length ? '' : `<p class="net-empty">${esc(L('아직 글이 없습니다.', 'No posts yet.'))}</p>`}`;
    } else {
      const cm = p.comments || [];
      inner = `<div class="postv"><span class="back link" data-act="close">${esc(L('← 목록으로', '← Back to list'))}</span><h3>[${esc(p.head || L('잡담', 'Chat'))}] ${esc(p.title || '')}</h3>
        <div class="meta">${esc(p.by.name)}${ip(p.by.ip)} | ${esc(p.date)} | ${esc(L('조회', 'Views'))} ${fmtN(p.views)} | ${esc(L('추천', 'Up'))} ${fmtN(p.likes)}</div><div class="body">${esc(p.body).replace(/\n/g, '<br>')}</div>
        <div class="rec"><span>${esc(L('개념 추천', 'Upvote'))} ${fmtN(p.likes)}</span><span>${esc(L('비추', 'Down'))} ${Math.round(p.likes / 9)}</span></div>
        <div class="cmts">${p.ccount > cm.length && cm.length ? `<div class="best">${esc(L('베스트 댓글', 'Best comments'))}</div>` : ''}<div class="net-rbox">${acctSel('dsRA')}<input id="dsR" maxlength="400" placeholder="${esc(L('댓글', 'Comment'))}"><button type="button" data-act="reply" data-id="${esc(p.id)}" ${busy ? 'disabled' : ''}>${esc(L('올리기', 'Post'))}</button></div>${waitNote()}${cmWait(p)}${cm.map((c, i) => cmtTree(c, 0, `<span class="net-to link" data-act="replyto" data-id="${esc(p.id)}" data-i="${i}">${esc(L('답글', 'reply'))}</span>`)).join('')}</div></div>`;
    }
    const side = (slot) => { const a = adOf(slot); return a ? `<div>${adBox(160, 240, slot)}<div class="sidead">${esc(tx(a.a.tag))}</div></div>` : '<div></div>'; };
    const top = adOf('dstop');
    const gal = (S.planets && S.planets[0]) ? (k ? `${S.planets[0]} 갤럭시` : `${S.planets[0]} Galaxy`) : L('제국 갤럭시', 'Empire Galaxy');
    return `<div class="net-ds">${side('dsl')}<div class="main"><div class="top"><img class="lg" src="${A}logos/logo_dsinside_a_64.webp" alt=""><b>DS Inside</b><span>${esc(L('은하 최대 커뮤니티', "The galaxy's largest community"))}</span></div>
      ${top ? `<div class="banner" style="margin:8px">${adBox(90, 90, 'dstop')}<div class="txt">${esc(tx(top.a.tag))}</div><span class="tag">${esc(L('광고', 'AD'))}</span></div>` : ''}<div class="gal">${esc(gal)}</div>${feedWait()}${inner}</div>${side('dsr')}</div>`;
  }

  // ── 레드시프트 ──
  function rsView() {
    let main; const p = post ? findPost(post) : null;
    if (!p) {
      const sp = adOf('rssp'); let cards = '';
      posts().forEach((x, i) => {
        if (i === 1 && sp) cards += `<div class="card"><div class="vote"><span class="up">▲</span><span class="dn">▼</span></div><div class="cb"><div class="meta"><b class="pr">${esc(L('홍보', 'Promoted'))}</b> · ${esc(tx(sp.a.name))}</div><div class="title" data-act="adv" data-id="${esc(sp.a.id)}">${esc(tx(sp.a.tag))}</div><div class="prev">${esc(tx(sp.a.about))}</div><div style="margin-top:8px">${adBox(480, 320, 'rssp')}</div></div></div>`;
        const pv = String(x.body).split('\n')[0];
        cards += `<div class="card"><div class="vote"><span class="up">▲</span>${fmtN(x.likes)}<span class="dn">▼</span></div><div class="cb"><div class="meta">${esc(x.by.name)}${x.by.off ? ' <span class="net-ver">✔</span>' : ''} · ${esc(x.date)}</div><div class="title" data-act="open" data-id="${esc(x.id)}">${esc(x.title || '')}</div><div class="prev">${esc(pv)}</div><div class="foot">${fmtN(x.ccount)}${esc(L('개 댓글', ' comments'))} · ${esc(L('공유', 'Share'))}</div></div></div>`;
      });
      main = `${feedWait()}<div class="net-compose rs-c">${acctSel('rsAcct')}<label class="net-ama" title="${esc(L('공식 계정으로만: 시민들이 질문을 달고, 골라서 답할 수 있어요', 'Official account only: citizens post questions and you pick which to answer'))}"><input type="checkbox" id="rsAma"> AMA</label><input id="rsTi" maxlength="80" placeholder="${esc(L('제목', 'Title'))}"><textarea id="rsBo" maxlength="1200" placeholder="${esc(L('본문', 'Body'))}"></textarea><button type="button" data-act="write" ${busy ? 'disabled' : ''}>${esc(L('올리기', 'Post'))}</button>${busy === 'write' ? waitNote() : ''}</div>${cards || `<p class="net-empty">${esc(L('아직 글이 없습니다.', 'No posts yet.'))}</p>`}`;
    } else {
      const cm = p.comments || [];
      main = `<div class="card"><div class="vote"><span class="up">▲</span>${fmtN(p.likes)}<span class="dn">▼</span></div><div class="cb"><span class="back link" data-act="close">${esc(L('← 피드로', '← Back to feed'))}</span>
        <div class="meta">${esc(p.by.name)}${p.by.off ? ' <span class="net-ver">✔</span>' : ''} · ${esc(p.date)}</div><div class="title">${esc(p.title || '')}</div><div class="full">${String(p.body).split('\n').map((x) => `<p>${esc(x)}</p>`).join('')}</div>
        <div class="foot">${fmtN(p.ccount)}${esc(L('개 댓글', ' comments'))}</div><div class="net-rbox">${acctSel('rsRA')}<input id="rsR" maxlength="400" placeholder="${esc(L('댓글 달기', 'Add a comment'))}"><button type="button" data-act="reply" data-id="${esc(p.id)}" ${busy ? 'disabled' : ''}>${esc(L('올리기', 'Post'))}</button></div>${waitNote()}
        ${cmWait(p)}${p.ccount > cm.length && cm.length ? `<div class="lbl">${esc(p.ama ? L('질문', 'Questions') : L('추천순 상위 댓글', 'Top comments'))}</div>` : ''}${cm.map((c, i) => cmtTree(c, 0, `<span class="net-to link" data-act="replyto" data-id="${esc(p.id)}" data-i="${i}">${esc(L('답글', 'reply'))}</span>`)).join('')}</div></div>`;
    }
    const sb = adOf('rsside');
    return `<div class="net-rs"><div class="hdr"><img class="lg" src="${A}logos/logo_redshift_a_64.webp" alt=""><b>Redshift</b><span>${esc(L('s/은하정치', 's/GalacticPolitics'))}</span><span style="margin-left:auto" class="h">▲ ${esc(L('청색편이', 'Blueshift'))} / ▼ ${esc(L('적색편이', 'Redshift'))}</span></div>
      <div>${main}</div><div><div class="sb"><b>${esc(L('s/은하정치', 's/GalacticPolitics'))}</b><p>${esc(L('은하 정치에 대한 토론 게시판. 예의를 지킵시다.', 'Discussion board for galactic politics. Be civil.'))}</p><div class="h">${esc(L('구성원 21.4만', '214k members'))}</div></div>
      ${sb ? `<div class="sb"><div class="h">${esc(L('광고', 'AD'))}</div>${adBox(300, 300, 'rsside')}<div style="margin-top:6px">${esc(tx(sb.a.name))}</div></div>` : ''}
      <div class="sb prem"><b>${esc(L('레드시프트 프리미엄', 'Redshift Premium'))}</b><div>${esc(L('광고 없이, 질량 보너스까지. 지금 가입하세요.', 'No ads, plus bonus mass. Join today.'))}</div><button type="button">${esc(L('가입', 'Join'))}</button></div></div></div>`;
  }

  // ── 광고주 홈페이지(80곳, 앱 안 페이지) ──
  const LINK = { merchant: ['상인 수집품 판매 창 열기', 'Open the Merchant collectibles window'], artists: ['순회 공연 의뢰 열기', 'Open the touring request'], curators: ['큐레이터 대여 의뢰 열기', 'Open the curator loan request'], relics: ['골동품 진열장 가기', 'Go to the Antiques showcase'] };
  function advView() {
    const a = (window.SLLMNetAds || []).find((x) => x.id === adv); if (!a) { adv = null; return ''; }
    const k = isKo(), y = String((S && S.date) || '').slice(0, 4);
    const spec = a.tpl === 'estate' ? `<div class="spec"><span>${esc(L('위치', 'Location'))}</span><span>${esc(L('링월드 3구역', 'Ringworld Sector 3'))}</span><span>${esc(L('면적', 'Area'))}</span><span>84–240 m²</span><span>${esc(L('입주', 'Move-in'))}</span><span>${esc(L(`${Number(y) + 1 || ''}년 봄`, `Spring ${Number(y) + 1 || ''}`))}</span></div>` : '';
    const feat = a.link ? `<button type="button" class="feat" data-act="advlink" data-id="${esc(a.link)}">${esc(LBL(LINK[a.link]))}</button>` : '';
    const ask = a.tpl === 'enclave' ? `<button type="button" class="ask" data-act="advask" data-id="${esc(a.link || '')}">${esc(L('1:1 문의', '1:1 Inquiry'))}</button>` : '';
    const foot = a.tpl === 'shady' ? L('※ 본 광고는 은하 광고심의위원회 심의를 받지 않았습니다', '※ This ad was not reviewed by the Galactic Advertising Board') : (k ? `© ${y} ${tx(a.name)} · 은하망 광고주 등록 ${(hash(a.id) % 9000) + 1000}호` : `© ${y} ${tx(a.name)} · GalNet advertiser no. ${(hash(a.id) % 9000) + 1000}`);
    return `<div class="net-advwrap"><span class="back link" data-act="advclose">${esc(L('← 돌아가기', '← Back'))}</span><div class="pg t-${esc(a.tpl)}"><div class="ph"><div class="mark">${esc(tx(a.name).replace(/^\[[^\]]*\]\s*/, '').slice(0, 1))}</div><div class="pn">${esc(tx(a.name))}</div><div class="pnav">${[L('소개', 'About'), L('소식', 'News'), L('고객센터', 'Support')].map((n) => `<span>${esc(n)}</span>`).join('')}</div></div>
      <div class="hero"><img src="${A}ads/ad_${esc(a.ads[0])}.webp" alt=""><div><div class="tag">${esc(tx(a.tag))}</div><div class="about">${esc(tx(a.about))}</div>${spec}<button type="button" class="cta" data-act="advcta">${esc(tx(a.cta))}</button>${ask}${feat}</div></div>
      <div class="camp"><h3>${esc(L('진행 중인 광고', 'Current campaigns'))} · ${a.ads.length}</h3><div class="cg">${a.ads.map((i) => `<img src="${A}ads/ad_${esc(i)}.webp" alt="">`).join('')}</div></div><div class="pf">${esc(foot)}</div></div></div>`;
  }
  function enclaveFor(link) { const e = (S && S.enclaves) || [], m = window.SLLMShop ? window.SLLMShop.merchants : ['xura', 'riggan', 'muutagan']; return link === 'merchant' ? e.find((x) => m.includes(x.sub)) : link === 'artists' ? e.find((x) => x.sub === 'artist') : link === 'curators' ? e.find((x) => x.sub === 'curator') : null; }
  function advLink(link) {
    if (link === 'relics') { if (window.SLLMPrivateRooms) window.SLLMPrivateRooms.open('exhibition'); return; }
    const c = enclaveFor(link); if (!c) { toast(L('아직 연락이 닿은 엔클레이브가 아닙니다. 외교 단말기 연락처에 있어야 열립니다.', 'We are not in contact with this enclave yet. It must be in the terminal contacts.')); return; }
    if (link === 'merchant' && window.SLLMShop) window.SLLMShop.open(c.sub, c.name); else if (link === 'artists' && window.SLLMTour) window.SLLMTour.open(); else if (link === 'curators' && window.SLLMLoan) window.SLLMLoan.open();
  }
  function advAsk(link) {
    const c = enclaveFor(link); if (!c && link !== 'relics') { toast(L('아직 연락이 닿은 엔클레이브가 아닙니다.', 'We are not in contact with this enclave yet.')); return; }
    window.sllm.officeOpen('terminal'); toast(L(`외교 단말기에서 「${c ? c.name : ''}」을(를) 골라 흥정해 보세요.`, `Pick "${c ? c.name : ''}" in the diplomatic terminal and haggle.`));
  }

  // ── 그리기 ──
  function draw() {
    if (!view) return;
    const tabs = root.querySelectorAll('.net-tab'); tabs.forEach((t) => t.classList.toggle('on', t.dataset.s === site));
    root.querySelector('.net-rf').disabled = !!busy;
    if (!S || S.hidden) { view.innerHTML = `<p class="net-empty">${esc(S && S.hidden ? L('이 제국에는 인터넷 문화가 없습니다.', 'This empire has no internet culture.') : L('세이브를 불러오면 인터넷에 접속할 수 있습니다.', 'Load a save to go online.'))}</p>`; addr.textContent = 'galnet://'; return; }
    const ad = { tw: 'galnet://twinkle.gal/home', ds: 'galnet://dsinside.gal/galaxy', rs: 'galnet://redshift.gal/s/galacticpolitics' };
    addr.textContent = adv ? `galnet://${adv.replace(/_/g, '-')}.gal` : ad[site] + (post ? '/' + post : '') + (prof ? '/@' + prof : '');
    $('netNick').innerHTML = nickOpen ? nickPanel() : '';
    view.innerHTML = adv ? advView() : site === 'tw' ? twView() : site === 'ds' ? dsView() : rsView();
    const f = $('peP'); if (f) f.onchange = avatarPick;
  }
  function nickPanel() {
    const n = S.nick || {};
    return `<div class="net-nickp"><b>${esc(L('민간 계정 닉네임', 'Personal account nicknames'))}</b><label>Twinkle @<input id="nkTw" maxlength="16" value="${esc(n.tw)}"></label><label>DS Inside <input id="nkDs" maxlength="16" value="${esc(n.ds)}" placeholder="${esc(L('비우면 ㅇㅇ(유동)', 'blank = anon'))}"></label><label>Redshift u/<input id="nkRs" maxlength="16" value="${esc(n.rs)}"></label>
      <button type="button" data-act="nicksave">${esc(L('저장', 'Save'))}</button><span class="hint">${esc(L('2~16자. 민간 계정은 통치자인 걸 아무도 모릅니다 — 아주 드물게 들통날 수 있어요.', '2–16 chars. Nobody knows a personal account is the ruler — though very rarely it may be found out.'))}</span></div>`;
  }
  function avatarPick(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = async () => { const c = document.createElement('canvas'), s = 256; c.width = c.height = s; const g = c.getContext('2d'), m = Math.min(img.width, img.height); g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); URL.revokeObjectURL(url); const data = c.toDataURL('image/webp', 0.85); const r = await window.sllm.internetInfluencer(prof, { avatar: data }); merge(r); draw(); toast(L('프로필 사진을 바꿨어요', 'Profile photo updated')); };
    img.onerror = () => toast(L('그림을 읽지 못했습니다.', 'Could not read the image.')); img.src = url;
  }

  // ── 동작 ──
  async function openSite(s) { site = s; post = null; prof = null; adv = null; edit = promoOpen = false; twOpen = {}; draw(); const r = await call('open', () => window.sllm.internetOpen(s)); if (r) { merge(r, s); fresh = r.made || 0; } draw(); }
  async function refresh() { post = null; adv = null; const r = await call('refresh', () => window.sllm.internetRefresh(site)); if (r) { merge(r, site); fresh = r.made || 0; toast(r.ok ? (fresh ? L(`새 글 ${fresh}개`, `${fresh} new posts`) : L('아직 새 소식이 없습니다 (게임 시간이 더 흘러야 해요)', 'Nothing new yet (let more game time pass)')) : ''); } }
  async function loadPost(id) { const r = await window.sllm.internetPost(site, id).catch(() => null); if (r && r.ok && r.post) { const i = posts().findIndex((p) => p.id === id); if (i >= 0) S.posts[site][i] = r.post; } }
  const val = (id) => { const e = $(id); return e ? e.value.trim() : ''; };
  async function write() {
    const acct = val(site + 'Acct') || (site === 'ds' ? 'anon' : 'off');
    const title = site === 'tw' ? '' : val(site + 'Ti'), body = site === 'tw' ? val('twTxt') : val(site + 'Bo') || title;
    if (!body) return toast(L('내용을 써 주세요.', 'Write something first.'));
    if (acct === 'civ' && !((S.nick || {})[site])) { nickOpen = true; draw(); return toast(L('먼저 닉네임을 정해 주세요.', 'Set a nickname first.')); }
    const ama = site === 'rs' && acct === 'off' && !!($('rsAma') && $('rsAma').checked);
    const r = await call('write', () => window.sllm.internetWrite(site, acct, title, body, ama));
    if (r && r.ok && r.post) { S.posts[site] = [r.post, ...posts()]; dsWrite = false; if (site === 'tw') twOpen[r.post.id] = true; else post = r.post.id; afterPost(r); }
    else if (r && !r.ok) { toast(r.error); if (r.needNick) nickOpen = true; }
    draw();
  }
  let replyTo = -1;
  async function reply(id) {
    const acctId = site === 'tw' ? 'twRA_' + id : site + 'RA', inId = site === 'tw' ? 'twR_' + id : site + 'R';
    const acct = val(acctId) || (site === 'ds' ? 'anon' : 'off'), text = val(inId); if (!text) return;
    if (acct === 'civ' && !((S.nick || {})[site])) { nickOpen = true; draw(); return toast(L('먼저 닉네임을 정해 주세요.', 'Set a nickname first.')); }
    const to = replyTo; replyTo = -1;
    const r = await call('reply', () => window.sllm.internetReply(site, id, acct, text, to));
    if (r && r.ok) { const p = findPost(id); if (p) { p.comments = r.comments; p.ccount += 1; } afterPost(r); } else if (r) toast(r.error);
    draw();
  }
  function afterPost(r) { if (r.exposed) toast(L('⚠ 네티즌들이 글쓴이가 통치자라는 걸 알아냈습니다!', '⚠ Netizens worked out the poster is the ruler!')); else if (r.aiFailed) toast(L('시민 반응을 받지 못했습니다(AI 연결 확인). 글은 올라갔습니다.', 'No citizen reactions (check the AI connection). Your post is up.')); }
  async function onClick(e) {
    const t = e.target.closest('[data-act]'); if (!t || !root.contains(t)) return;
    const act = t.dataset.act, id = t.dataset.id;
    if (act === 'adv') { adv = id; draw(); view.scrollTop = 0; return; }
    if (act === 'advclose') { adv = null; return draw(); }
    if (act === 'advlink') return advLink(id);
    if (act === 'advask') return advAsk(id);
    if (act === 'advcta') return toast(L('이 버튼은 광고주 페이지의 장식입니다.', 'This button is part of the advertiser page.'));
    if (act === 'open') { post = id; draw(); await loadPost(id); draw(); view.scrollTop = 0; return; }
    if (act === 'close') { post = null; return draw(); }
    if (act === 'twopen') { twOpen[id] = !twOpen[id]; draw(); if (twOpen[id] && !(findPost(id) || {}).comments) { await loadPost(id); draw(); } return; }
    if (act === 'replyto') { replyTo = Number(t.dataset.i); const p = findPost(id), c = p && p.comments && p.comments[replyTo]; const inp = $(site === 'tw' ? 'twR_' + id : site + 'R'); if (inp && c) { inp.placeholder = L(`${c.name}에게 답글`, `Reply to ${c.name}`); inp.focus(); } return; }
    if (act === 'write') return write();
    if (act === 'reply') return reply(id);
    if (act === 'dstab') { dsTab = id; return draw(); }
    if (act === 'dswrite') { dsWrite = !dsWrite; return draw(); }
    if (act === 'prof') { prof = id; edit = promoOpen = false; draw(); view.scrollTop = 0; return; }
    if (act === 'profclose') { prof = null; return draw(); }
    if (act === 'edit') { edit = !edit; return draw(); }
    if (act === 'promo') { promoOpen = !promoOpen; return draw(); }
    if (act === 'follow') { const on = !(S.follow || []).includes(id); const r = await window.sllm.internetFollow(id, on).catch(() => null); merge(r); return draw(); }
    if (act === 'avreset') { const r = await window.sllm.internetInfluencer(prof, { avatar: null }).catch(() => null); merge(r); return draw(); }
    if (act === 'profsave') {
      const x = S.infs.find((i) => i.id === prof); if (!x) return; const lg = isKo() ? 'ko' : 'en';
      const patch = { name: { ...x.name, [lg]: val('peN') || tx(x.name) }, handle: val('peH').replace(/[^A-Za-z0-9_]/g, '') || x.handle, field: val('peF'), ethic: val('peE'), bio: { ...x.bio, [lg]: val('peB') }, catch: { ...x.catch, [lg]: val('peC') } };
      const r = await window.sllm.internetInfluencer(prof, patch).catch(() => null); merge(r); edit = false; draw(); return toast(L('프로필을 저장했어요', 'Profile saved'));
    }
    if (act === 'promogo') { const planet = val('prP'); if (!planet) return; const r = await call('promo', () => window.sllm.internetPromo(prof, planet)); if (r && r.ok) { toast(r.text); promoOpen = false; const s = await window.sllm.internetState().catch(() => null); merge(s); } else if (r) toast(r.error); return draw(); }
    if (act === 'nicksave') {
      for (const [s, idn] of [['tw', 'nkTw'], ['ds', 'nkDs'], ['rs', 'nkRs']]) { const v = val(idn); if (v === ((S.nick || {})[s] || '')) continue; if (s !== 'ds' && !v) continue; const r = await window.sllm.internetNick(s, v).catch(() => null); if (r && !r.ok) return toast(r.error); merge(r); }
      nickOpen = false; draw(); return toast(L('닉네임을 저장했어요', 'Nicknames saved'));
    }
  }

  function build() {
    const after = document.querySelector('#holo .ic[data-app="memorial"]'), holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('net')) return false;
    const b = document.createElement('button'); b.className = 'ic'; b.type = 'button'; b.id = 'netCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="10" width="36" height="28" rx="3"/><path d="M6 17h36"/><path d="M10 13.5h3M15 13.5h3"/><path d="M17 29a9 9 0 0114 0"/><path d="M20.5 32.5a4 4 0 017 0"/><circle cx="24" cy="35" r=".8"/></svg>';
    const sp = document.createElement('span'); sp.textContent = L('인터넷', 'Internet'); b.append(sp);
    b.onclick = () => { show('net'); void openSite(site); };
    after.after(b);
    const sec = document.createElement('section'); sec.className = 'view app'; sec.id = 'net'; sec.setAttribute('aria-label', L('인터넷', 'Internet')); sec.setAttribute('data-i18n-skip', '');
    sec.innerHTML = `<div class="apph net-h"><button class="back" type="button" id="netBack"></button><h3 id="netTitle"></h3><div class="net-tabs">${[['tw', 'twinkle', 'Twinkle'], ['ds', 'dsinside', 'DS Inside'], ['rs', 'redshift', 'Redshift']].map(([s, f, n]) => `<button type="button" class="net-tab" data-s="${s}"><img src="${A}logos/logo_${f}_a_64.webp" alt="">${n}</button>`).join('')}</div>
      <button type="button" class="net-rf" title="">⟳</button><span class="net-addr" id="netAddr"></span><span class="net-toast" id="netToast"></span><button type="button" class="net-nickb" id="netNickB"></button></div><div id="netNick"></div><div class="appb net-view" id="netView"></div>`;
    holo.append(sec);
    root = sec; view = $('netView'); addr = $('netAddr'); toastEl = $('netToast');
    $('netBack').onclick = () => show('desktop');
    sec.querySelectorAll('.net-tab').forEach((t) => (t.onclick = () => openSite(t.dataset.s)));
    sec.querySelector('.net-rf').onclick = () => refresh();
    $('netNickB').onclick = () => { nickOpen = !nickOpen; draw(); };
    sec.addEventListener('click', (e) => { void onClick(e); });
    relabel();
    return true;
  }
  function relabel() {
    const b = $('netCall'); if (b) b.querySelector('span').textContent = L('인터넷', 'Internet');
    if (!root) return; $('netBack').textContent = '‹ ' + L('바탕화면', 'Desktop'); $('netTitle').textContent = L('인터넷', 'Internet'); $('netNickB').textContent = L('닉네임', 'Nickname'); root.querySelector('.net-rf').title = L('새로고침', 'Refresh');
  }
  document.addEventListener('DOMContentLoaded', () => {
    let tries = 0; const t = setInterval(() => { if (build() || ++tries > 30) clearInterval(t); }, 100);
    if (window.sllm.onOfficeGo) window.sllm.onOfficeGo((v) => { if (v === 'internet' && $('net')) { show('net'); void openSite(site); } });
    if (window.sllm.onOfficeState) window.sllm.onOfficeState((s) => { if (S && s && s.sid && S.sid && s.sid !== S.sid) { S = null; post = prof = adv = null; draw(); } });
    document.addEventListener('sllm-language', () => { relabel(); draw(); });
  });
  window.SLLMOfficeInternet = { open: () => { show('net'); return openSite(site); } };
})();
