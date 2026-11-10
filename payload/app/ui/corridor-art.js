/* Artwork-only renderer. Feed the same {applied, emblemUrl} used by office-style.js.
 * Does not read saves, invoke AI, change game state or invent an empire emblem.
 */
(() => {
  const themes = [
    ['authoritarian','권위주의','Authoritarian',[[19.5,12,2.2,8,12],[29.5,24,1.1,6,8],[34.7,27,2.1,8,0],[65,27,2.1,8,0],[70.4,24,1.1,6,-8],[80.5,12,2.2,8,-12]]],
    ['egalitarian','평등주의','Egalitarian',[[19.5,21,1.8,8,12],[80.5,21,1.8,8,-12]]],
    ['xenophile','외계종 선호','Xenophile',[]],
    ['xenophobe','외계종 혐오','Xenophobe',[[22.1,10,1.5,7,12],[30.4,23,1,6,8],[34.7,27,1.8,8,0],[64.8,27,1.8,8,0],[69,23,1,6,-8],[78.3,10,1.5,7,-12]]],
    ['militarist','군국주의','Militarist',[[34.6,23,1.8,7,0],[65,23,1.8,7,0]]],
    ['pacifist','평화주의','Pacifist',[]],
    ['spiritualist','정신주의','Spiritualist',[[18.5,15,1.8,7,12],[32,27,.8,5,8],[38,28,1.5,7,0],[62,28,1.5,7,0],[68,27,.8,5,-8],[81.5,15,1.8,7,-12]]],
    ['materialist','물질주의','Materialist',[]],
  ];
  // Conservative data-image allowlist. Host should use its trusted local asset protocol.
  function safeImage(url) {
    if (typeof url !== 'string' || url.length > 12000000 || /["'\\\n\r<>]/.test(url)) return false;
    if (/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)) return true;
    if (/^blob:/.test(url)) return true;
    if (/^(file:|sllm-asset:|app:)/.test(url)) return true;
    return /^[a-zA-Z0-9_./-]+\.(png|webp|jpg|jpeg)$/.test(url) && !url.includes('..');
  }
  function mount(root, { assetBase = 'assets', pick = (ko) => ko, onRoom = () => {} } = {}) {
    root.classList.add('corridor-scene');
    const art = document.createElement('img'); art.className = 'corridor-background'; art.alt = '';
    const emblems = document.createElement('div'); emblems.className = 'corridor-emblems'; emblems.setAttribute('aria-hidden','true');
    const rooms = [['exhibition','전시실','Exhibition room'],['private','통치자 개인실','Ruler’s private room'],['office','집무실','Executive office'],['secretary','비서실','Secretary’s office'],['reading','독서실','Reading room']];
    const buttons = rooms.map(([id,ko,en],i) => {
      const b = document.createElement('button'); b.type='button'; b.className='corridor-door door-'+i;
      b.setAttribute('aria-label',pick(ko,en)+' · '+pick('열기','Open'));
      const tip=document.createElement('span'),name=document.createElement('b'),hint=document.createElement('small');
      name.textContent=pick(ko,en); hint.textContent=pick('열기','OPEN')+' ▸'; tip.append(name,hint);
      const glow=document.createElement('i'), cut=document.createElement('i'), lit=document.createElement('img'); glow.className='corridor-glow'; cut.className='corridor-cut'; lit.alt=''; lit.draggable=false; cut.append(lit); glow.append(cut); b.append(glow,tip);
      b.onclick=()=>enter(b,id); return b;
    });
    // Short walk toward the door before the room loads; instant when reduced motion is requested.
    let entering=false;
    function enter(door,id){
      if(entering) return; entering=true;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){ Promise.resolve(onRoom(id)).catch(()=>{}).finally(()=>{ entering=false; }); return; }
      const r=root.getBoundingClientRect(), d=door.getBoundingClientRect();
      root.style.transformOrigin=`${((d.left+d.width/2-r.left)/r.width*100).toFixed(1)}% ${((d.top+d.height/2-r.top)/r.height*100).toFixed(1)}%`;
      door.classList.add('is-opening'); root.classList.add('corridor-entering');
      setTimeout(()=>{
        if(!alive) return;
        // If the room did not open (e.g. an unsaved dialog kept us here), step back into the corridor.
        Promise.resolve(onRoom(id)).catch(()=>{}).finally(()=>{ if(alive){ entering=false; root.classList.remove('corridor-entering'); door.classList.remove('is-opening'); } });
      },300);
    }
    root.replaceChildren(art,emblems,...buttons);
    let alive=true, seq=0;
    async function update(state) {
      const theme=themes.find(t=>t[0]===state?.applied) || themes[0];
      const ticket=++seq, url=state?.emblemUrl;
      root.dataset.style=theme[0]; art.src=assetBase+'/corridor-'+theme[0]+'.webp';
      for(const b of buttons) b.querySelector('.corridor-glow img').src=art.src;
      emblems.replaceChildren();
      if(!safeImage(url)) return;
      const probe=new Image(); probe.src=url;
      try { await probe.decode(); } catch { return; }
      if(!alive || ticket!==seq || !probe.naturalWidth) return;
      for(const [x,y,w,h,skew] of theme[3]) {
        const mark=document.createElement('i'); mark.className='corridor-emblem';
        Object.assign(mark.style,{left:x+'%',top:y+'%',width:w+'%',height:h+'%',transform:`translateX(-50%) skewY(${skew}deg)`});
        mark.style.setProperty('--emblem',`url("${url}")`); emblems.append(mark);
      }
    }
    return {update, destroy(){alive=false;seq++;root.replaceChildren();root.classList.remove('corridor-scene','corridor-entering');root.style.transformOrigin='';delete root.dataset.style;}};
  }
  window.SLLMCorridorArt={mount,themes};
})();
