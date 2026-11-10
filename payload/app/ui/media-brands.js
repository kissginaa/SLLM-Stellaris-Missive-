// 내장 브랜드와 사용자 그림. 열린 신문·라디오에도 변경을 반영한다.
window.MediaBrands = (() => {
 const families = { stn: { paper: '성간일보', radio: '성간방송 STN' }, starcluster: { paper: '별무리 속보', radio: '별무리 라디오' }, void: { paper: '공허 통신', radio: '공허 공영방송' } };
 let prefs = []; const tracked = new Map();
 function draw(img, key, kind) {
   // web = 집무실 홈페이지용 둥근 로고(2026-11-10). 설정 > 언론사의 「홈페이지 로고」로 신문 그림과 따로 바꾼다
   const web = kind === 'web', pref = prefs.find((p) => p.id === key), fallback = 'brands/' + key + '-' + kind + (web ? '.webp' : '.svg'); // 홈페이지 로고 = GPT 법랑 인장(v2)
   const src = pref && pref[kind === 'radio' ? 'radioImage' : kind === 'web' ? 'webImage' : 'paperImage'];
   const next = web ? ['brands/' + key + '-web.svg', 'brands/' + key + '-paper.svg'] : [];
   img.onerror = () => { const n = img.src.indexOf(fallback) < 0 ? fallback : next.shift(); if (n) img.src = n; else img.onerror = null; };
   img.dataset.custom = src ? '1' : '';
   img.src = src || fallback; img.style.objectFit = 'contain';
   const name = (pref && pref[kind === 'radio' ? 'radio' : 'name']) || families[key][kind === 'radio' ? 'radio' : 'paper'];
   img.alt = name + ' 브랜드'; img.title = name;
 }
 function apply(img, family, kind) {
   const key = Object.prototype.hasOwnProperty.call(families, family) ? family : 'stn';
   for (const [old] of tracked) if (!old.isConnected && old !== img) tracked.delete(old);
   tracked.set(img, { key, kind }); draw(img, key, kind);
 }
 function refresh(state) { prefs = state; for (const [img, v] of tracked) { if (img.isConnected) draw(img, v.key, v.kind); else tracked.delete(img); } }
 if (window.sllm?.mediaGet) { window.sllm.mediaGet().then(refresh).catch(() => {}); window.sllm.onMediaChanged(refresh); }
 return {
   paper(img, index) { apply(img, Object.keys(families)[index] || 'stn', 'paper'); },
   web(img, index) { apply(img, Object.keys(families)[index] || 'stn', 'web'); },
   radio(img, id) { apply(img, id, 'radio'); }
 };
})();
