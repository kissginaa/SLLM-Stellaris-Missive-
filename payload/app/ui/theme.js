// 화면 색 테마(본 창과 아이콘 창이 함께 쓴다). 값은 CSS 변수로 들어간다.
 const THEMES = {
 stellaris: {},  // 기본형: 지금 앱 모양(청록 단말기풍) 그대로. 저장 값 이름은 예전 그대로 stellaris
 terminal: { '--bg':'#0b0e12','--panel':'#10151b','--text':'#e7ebef','--dim':'#8a95a2','--hi':'#dde4ea','--hi-text':'#0b0e12','--ai':'#a9cbe6','--gold':'#e2a95a','--bad':'#d9695d','--good':'#86cdb8','--linec':'#d6e2ee','--shade':'#0a0d11',
   '--bgfx':'#0b0e12','--cardbg':'#10151b','--btnbg':'transparent','--prim':'#dde4ea','--titlefx':'none','--inputbg':'#10151b','--glow':'transparent' },
 starfield: { '--bg':'#e6eaee','--panel':'#f7f9fb','--text':'#14181d','--dim':'#5b6773','--hi':'#1d2b3a','--hi-text':'#f3f6f9','--ai':'#1d5d8c','--gold':'#a85a14','--bad':'#b3392b','--good':'#23775b','--linec':'#1d2b3a','--shade':'#cfd6dd',
   '--bgfx':'#e6eaee','--cardbg':'#f7f9fb','--btnbg':'#f7f9fb','--prim':'#1d2b3a','--titlefx':'#dfe4e9','--inputbg':'#ffffff','--glow':'transparent' },
 // A-22 가치관 테마 10종(2026-10-15). 색은 여기, 서체·모서리 같은 연출은 아래 THEME_FX. 실제 정치 상징은 쓰지 않는다
 egalitarian: { '--bg':'#0a1424','--panel':'#102038','--text':'#e8f0fb','--dim':'#8ea4c2','--hi':'#4f9dff','--hi-text':'#06101e','--ai':'#9cc8ff','--gold':'#f2c94c','--bad':'#ff6b6b','--good':'#4fd1a5','--linec':'#4f9dff','--shade':'#0a1424',
   '--bgfx':'#0a1424','--cardbg':'linear-gradient(160deg,#13284a,#0d1c34)','--btnbg':'linear-gradient(#173361,#112647)','--prim':'#4f9dff','--titlefx':'none','--inputbg':'#0c1a2e' },
 authoritarian: { '--bg':'#140a08','--panel':'#22110d','--text':'#efe4d2','--dim':'#a8907a','--hi':'#dc4436','--hi-text':'#f6ead6','--ai':'#e0b48a','--gold':'#d4a64a','--bad':'#e05a4a','--good':'#9cb46a','--linec':'#b8402e','--shade':'#140a08',
   '--bgfx':'#140a08','--cardbg':'linear-gradient(160deg,#2a1510,#1a0c09)','--btnbg':'linear-gradient(#3a1812,#2a100c)','--prim':'#dc4436','--titlefx':'none','--inputbg':'#1c0e0b' },
 militarist: { '--bg':'#11130c','--panel':'#1b1f13','--text':'#e3e6d4','--dim':'#9aa086','--hi':'#c9b04a','--hi-text':'#14160c','--ai':'#d8d08a','--gold':'#e0b23c','--bad':'#d9573c','--good':'#8fbf5a','--linec':'#8a9a5a','--shade':'#11130c',
   '--bgfx':'#11130c','--cardbg':'linear-gradient(160deg,#222816,#161a0e)','--btnbg':'linear-gradient(#2a3018,#1e2412)','--prim':'#c9b04a','--titlefx':'none','--inputbg':'#151810' },
 pacifist: { '--bg':'#0b1712','--panel':'#12241c','--text':'#eaf5ee','--dim':'#94b3a2','--hi':'#6fd89a','--hi-text':'#07140d','--ai':'#a8ecc4','--gold':'#e8d27a','--bad':'#e07a6a','--good':'#6fd89a','--linec':'#6fd89a','--shade':'#0b1712',
   '--bgfx':'#0b1712','--cardbg':'linear-gradient(160deg,#173326,#0f2219)','--btnbg':'linear-gradient(#1a3a2b,#132b20)','--prim':'#6fd89a','--titlefx':'none','--inputbg':'#0d1d16' },
 materialist: { '--bg':'#061716','--panel':'#0b2423','--text':'#e2f6f4','--dim':'#86b0ab','--hi':'#3fe0cf','--hi-text':'#031413','--ai':'#8ff0e6','--gold':'#e8d572','--bad':'#ef6f6f','--good':'#5fe0a0','--linec':'#3fe0cf','--shade':'#061716',
   '--bgfx':'#061716','--cardbg':'linear-gradient(160deg,#0f3130,#0a2221)','--btnbg':'linear-gradient(#103937,#0b2a28)','--prim':'#3fe0cf','--titlefx':'none','--inputbg':'#081d1c' },
 spiritualist: { '--bg':'#120b1c','--panel':'#1d132c','--text':'#efe6fa','--dim':'#a896c2','--hi':'#b07cff','--hi-text':'#120b1c','--ai':'#d8b8ff','--gold':'#e3b65a','--bad':'#ef6f8f','--good':'#8fd8a8','--linec':'#b07cff','--shade':'#120b1c',
   '--bgfx':'#120b1c','--cardbg':'linear-gradient(160deg,#28193c,#1a1028)','--btnbg':'linear-gradient(#2e1d46,#221535)','--prim':'#b07cff','--titlefx':'none','--inputbg':'#170f24' },
 xenophile: { '--bg':'#141220','--panel':'#1e1b30','--text':'#f2eefa','--dim':'#a9a2c4','--hi':'#ff9a5a','--hi-text':'#1a0f08','--ai':'#ffd08a','--gold':'#ffcf5a','--bad':'#ff6b8a','--good':'#6fe0b0','--linec':'#c48aff','--shade':'#141220',
   '--bgfx':'#141220','--cardbg':'linear-gradient(160deg,#2a2440,#1b182c)','--btnbg':'linear-gradient(#332a4a,#262038)','--prim':'#ff9a5a','--titlefx':'none','--inputbg':'#18162a' },
 xenophobe: { '--bg':'#111013','--panel':'#1b1a1e','--text':'#e6e2e4','--dim':'#9a9499','--hi':'#d4504a','--hi-text':'#f2e8e8','--ai':'#c8a0a0','--gold':'#c8a040','--bad':'#d84a4a','--good':'#8aa07a','--linec':'#6a6670','--shade':'#111013',
   '--bgfx':'#111013','--cardbg':'linear-gradient(160deg,#242228,#18171b)','--btnbg':'linear-gradient(#2a282e,#201f23)','--prim':'#d4504a','--titlefx':'none','--inputbg':'#161518' },
 machine: { '--bg':'#020709','--panel':'#061218','--text':'#c8f6ff','--dim':'#5f9aa8','--hi':'#00e5ff','--hi-text':'#001218','--ai':'#7ff6ff','--gold':'#00ffa3','--bad':'#ff4f6a','--good':'#00ffa3','--linec':'#00e5ff','--shade':'#020709',
   '--bgfx':'#020709','--cardbg':'linear-gradient(160deg,#08202a,#04121a)','--btnbg':'linear-gradient(#0a2630,#061a22)','--prim':'#00e5ff','--titlefx':'none','--inputbg':'#04101a' },
 holo: { '--bg':'#050d12','--panel':'#0a1a22','--text':'#d6ece9','--dim':'#7fa6a2','--hi':'#46d9b8','--hi-text':'#03140f','--ai':'#9ef0dc','--gold':'#f0c75e','--bad':'#e8665a','--good':'#7fe08a','--linec':'#46d9b8','--shade':'#050d12',
   '--bgfx':'#050d12','--cardbg':'linear-gradient(170deg,rgba(18,46,52,.94),rgba(6,20,26,.96))','--btnbg':'linear-gradient(#123a3a,#0a2426)','--prim':'#46d9b8','--titlefx':'none','--inputbg':'#06151b' }, // A-22 바닐라 홀로그램풍
 hive: { '--bg':'#140c08','--panel':'#22140e','--text':'#f6e6da','--dim':'#b8988a','--hi':'#e8a05a','--hi-text':'#1a0d05','--ai':'#f0b8c8','--gold':'#f2c46a','--bad':'#e86a8a','--good':'#b8d86a','--linec':'#e88aa8','--shade':'#140c08',
   '--bgfx':'#140c08','--cardbg':'linear-gradient(160deg,#2e1b12,#1f120c)','--btnbg':'linear-gradient(#3a2216,#2a1810)','--prim':'#e8a05a','--titlefx':'none','--inputbg':'#1a100b' },
};
// A-22 테마별 연출(서체·모서리·장식). 모든 창이 이 파일을 쓰므로 한 곳에서 바꾼다.
const THEME_FX = `
html[data-theme=egalitarian] body{font-family:"Segoe UI","Malgun Gothic",sans-serif}
html[data-theme=egalitarian] button,html[data-theme=egalitarian] .btn,html[data-theme=egalitarian] input,html[data-theme=egalitarian] select,html[data-theme=egalitarian] textarea{border-radius:6px}
html[data-theme=authoritarian] h1,html[data-theme=authoritarian] h2,html[data-theme=authoritarian] h3,html[data-theme=authoritarian] .sec,html[data-theme=authoritarian] #title{font-family:"Noto Serif KR","Batang",serif;letter-spacing:.06em}
html[data-theme=authoritarian] button,html[data-theme=authoritarian] .btn{border-radius:0;letter-spacing:.08em}
html[data-theme=authoritarian] body{box-shadow:inset 0 3px 0 #8c1c1c,inset 0 -3px 0 #8c1c1c}
html[data-theme=militarist] h1,html[data-theme=militarist] h2,html[data-theme=militarist] h3,html[data-theme=militarist] .sec{font-family:var(--mono,Consolas,monospace);letter-spacing:.16em;text-transform:uppercase}
html[data-theme=militarist] button,html[data-theme=militarist] .btn{border-radius:0}
html[data-theme=militarist] body{box-shadow:inset 0 3px 0 #c9b04a}
html[data-theme=pacifist] button,html[data-theme=pacifist] .btn,html[data-theme=pacifist] input,html[data-theme=pacifist] select,html[data-theme=pacifist] textarea{border-radius:12px}
html[data-theme=materialist] h1,html[data-theme=materialist] h2,html[data-theme=materialist] h3,html[data-theme=materialist] .sec{font-family:"Segoe UI","Malgun Gothic",sans-serif;letter-spacing:.03em}
html[data-theme=materialist] body{background-image:linear-gradient(#3fe0cf0a 1px,transparent 1px),linear-gradient(90deg,#3fe0cf0a 1px,transparent 1px);background-size:24px 24px}
html[data-theme=spiritualist] h1,html[data-theme=spiritualist] h2,html[data-theme=spiritualist] h3,html[data-theme=spiritualist] .sec,html[data-theme=spiritualist] #title{font-family:"Noto Serif KR","Batang",serif}
html[data-theme=spiritualist] body{box-shadow:inset 0 0 0 1px #e3b65a33,inset 0 3px 0 #e3b65a66}
html[data-theme=xenophile] body{box-shadow:inset 0 3px 0 0 transparent;border-top:3px solid;border-image:linear-gradient(90deg,#ff6b8a,#ffcf5a,#6fe0b0,#5a9aff,#c48aff) 1}
html[data-theme=xenophile] button,html[data-theme=xenophile] .btn{border-radius:8px}
html[data-theme=xenophobe] button,html[data-theme=xenophobe] .btn{border-radius:0}
html[data-theme=xenophobe] body{background-image:repeating-linear-gradient(135deg,#ffffff04 0 12px,transparent 12px 24px)}
html[data-theme=machine] body,html[data-theme=machine] button,html[data-theme=machine] input,html[data-theme=machine] textarea,html[data-theme=machine] select{font-family:var(--mono,Consolas,monospace)}
html[data-theme=machine] button,html[data-theme=machine] .btn{border-radius:0}
html[data-theme=machine] body{background-image:linear-gradient(#00e5ff08 1px,transparent 1px);background-size:100% 3px}
html[data-theme=hive] button,html[data-theme=hive] .btn,html[data-theme=hive] input,html[data-theme=hive] select,html[data-theme=hive] textarea{border-radius:14px}
html[data-theme=hive] body{background-image:radial-gradient(circle at 20% 30%,#e88aa80c,transparent 40%),radial-gradient(circle at 80% 70%,#e8a05a0c,transparent 40%)}
html[data-theme=holo] body{background-image:radial-gradient(ellipse at 50% -20%,#46d9b81c,transparent 60%),linear-gradient(#46d9b806 1px,transparent 1px);background-size:100% 100%,100% 4px}
html[data-theme=holo] h1,html[data-theme=holo] h2,html[data-theme=holo] h3,html[data-theme=holo] .sec{letter-spacing:.1em;text-shadow:0 0 8px #46d9b866}
html[data-theme=holo] button,html[data-theme=holo] .btn{border-radius:0;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
html[data-theme=holo] input,html[data-theme=holo] textarea,html[data-theme=holo] select{border-radius:0;box-shadow:inset 0 0 10px #46d9b81a}
html[data-theme=holo] #card{clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);box-shadow:inset 0 0 22px #46d9b826}
html[data-theme=authoritarian] #card{border-top:3px solid #8c1c1c}
html[data-theme=militarist] #card{padding-left:17px;background:repeating-linear-gradient(45deg,#c9b04a 0 6px,#1b1f13 6px 12px) left top/5px 100% no-repeat,var(--cardbg)}
html[data-theme=spiritualist] #card{border-color:#e3b65a88;box-shadow:0 0 14px rgba(0,0,0,.55),inset 0 0 18px #b07cff22}
html[data-theme=machine] #card,html[data-theme=machine] #kind{font-family:var(--mono,Consolas,monospace)}
html[data-theme=xenophile] #card{border-radius:8px}
html[data-theme=pacifist] #card,html[data-theme=hive] #card{border-radius:12px}
`;
function themeFx() { if (typeof document.getElementById !== 'function' || typeof document.createElement !== 'function' || document.getElementById('themefx')) return; const s = document.createElement('style'); s.id = 'themefx'; s.textContent = THEME_FX; (document.head || document.documentElement).appendChild(s); }
const CUSTOM_MAP = { bg: '--bg', panel: '--panel', text: '--text', hi: '--hi', gold: '--gold' };
// 「자동 · 우리 제국에 맞춤」(알파 11): 앱에 우리 제국 가치관(기계·군체 포함)에 맞는 테마를 묻는다. 세이브가 바뀌어도 따라가게 가끔 다시 묻는다.
let autoPick = 'stellaris', autoLast = null, autoTimer = null;
async function refreshAutoTheme() {
  if (!autoLast || typeof window === 'undefined' || !window.sllm || !window.sllm.autoTheme) return;
  let t = null; try { t = await window.sllm.autoTheme(); } catch (e) { return; }
  if (t && THEMES[t] && t !== autoPick) { autoPick = t; if (autoLast) applyTheme('auto', autoLast.custom); }
}
function applyTheme(name, custom) {
  if (name === 'auto') { autoLast = { custom }; if (!autoTimer && typeof setInterval === 'function') { autoTimer = setInterval(refreshAutoTheme, 30000); if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('focus', refreshAutoTheme); } refreshAutoTheme(); name = autoPick; }
  else autoLast = null;
  const root = document.documentElement.style;
  themeFx(); if (document.documentElement.dataset) document.documentElement.dataset.theme = THEMES[name] || name === 'custom' ? name : 'stellaris';
  root.colorScheme = name === 'starfield' ? 'light' : 'dark';
  const all = new Set([...Object.keys(THEMES.terminal), ...Object.values(CUSTOM_MAP), '--hi-text', '--linec', '--shade']);
  all.forEach((k) => root.removeProperty(k));
  const base = name === 'custom' ? THEMES.terminal : (THEMES[name] || {});
  for (const [k, v] of Object.entries(base)) root.setProperty(k, v);
  if (name === 'custom') {
    const c = custom || {}; // 예전 코드는 정의되지 않은 curCustom 을 읽어 저장된 테마가 custom 이면 켤 때 오류가 났다
    for (const [k, v] of Object.entries(CUSTOM_MAP)) if (c[k]) root.setProperty(v, c[k]);
    if (c.bg) { root.setProperty('--bgfx', c.bg); root.setProperty('--shade', c.bg); root.setProperty('--inputbg', c.panel || c.bg); }
    if (c.panel) { root.setProperty('--cardbg', c.panel); root.setProperty('--btnbg', c.panel); }
    if (c.hi) { root.setProperty('--prim', c.hi); root.setProperty('--linec', c.hi); root.setProperty('--ai', c.hi); }
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
    if (c.hi) root.setProperty('--hi-text', lum(c.hi) > 0.55 ? '#0b0e12' : '#f3f6f9');
  }
}

