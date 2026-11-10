/* Real campaign host: no preview saves, demo affinity or automatic AI requests. */
(() => {
 const L=(k,e)=>window.SLLMI18n?.pick(k,e)||k;
 const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
 const themes=['authoritarian','egalitarian','xenophile','xenophobe','militarist','pacifist','spiritualist','materialist'];
 let opening=false,tvTimer=null,tvSnapshot=null;
 function stopTV(){clearTimeout(tvTimer);tvTimer=null;tvSnapshot=null;}
 let root,stage,toolbar,title,status,state,style,room='',view='room',corridor,seq=0,dialog,dirty=false,chatPanel;
 const base='assets/private-rooms/';
 const musicAudio=new Audio();musicAudio.volume=.4;let musicWanted=false,musicData={tracks:[],prefs:{volume:.4,loop:false,autoplay:false,selectedId:''}};
 musicAudio.onended=()=>{if(!musicAudio.loop)musicWanted=false;};
 function stopMusic(){musicAudio.pause();musicAudio.currentTime=0;musicWanted=false;}
 function applyMusic(r){if(!r.ok)throw Error(r.error);musicData=r;musicAudio.volume=r.prefs.volume;musicAudio.loop=r.prefs.loop;const t=r.tracks.find(t=>t.id===r.prefs.selectedId);if(!t){stopMusic();musicAudio.removeAttribute('src');}else if(musicAudio.src!==t.url){musicAudio.pause();musicAudio.src=t.url;}return t;}
 async function configureMusic(p){const r=await window.sllm.roomsMusicConfigure(state.token,p);applyMusic(r);return r;}
 async function playMusic(){if(!musicAudio.src||room!=='private'||view==='sofa')return;musicWanted=true;try{await musicAudio.play();}catch(e){musicWanted=false;message(L('음악을 재생하지 못했습니다.','Could not play the audio.'));}}
 musicAudio.onerror=()=>{musicWanted=false;message(L('음악을 재생하지 못했습니다.','Could not play the audio.'));};
 const labels={private:()=>L('통치자 개인실','Private room'),reading:()=>L('독서실','Library'),exhibition:()=>L('트로피룸','Trophy room'),secretary:()=>L('비서실','Secretary’s office'),nursery:()=>L('아기방','Nursery')};
 const button=(text,fn,parent=toolbar)=>{const b=el('button','',text);b.type='button';b.onclick=()=>{try{Promise.resolve(fn()).catch(e=>message(e.message));}catch(e){message(e.message);}};parent.append(b);return b;};
 function message(t){status.textContent=t||'';}
 const role=(b,r)=>{b.classList.add('rooms-'+r);return b;}; // hologram button roles: primary · danger · tab
 function closeDialog(){if(dirty&&!confirm(L('저장하지 않은 변경을 버릴까요?','Discard unsaved changes?')))return false;dialog?.remove();dialog=null;dirty=false;return true;}
 function close(){if(!closeDialog())return;void window.sllm.roomsCompanion(state.token,'leave').catch(()=>{});stopTV();stopMusic();seq++;corridor?.destroy();corridor=null;root?.remove();root=null;chatPanel=null;document.getElementById('roomsCall')?.focus();}
 async function refresh(){const r=await window.sllm.roomsState();if(!r.ok)throw Error(r.error);if(state&&r.token!==state.token)throw Error(L('세이브나 통치자가 바뀌었습니다. 방을 다시 열어 주세요.','The save or ruler changed. Reopen the room.'));state=r;drawShelves();return r;}
 function asset(src,cls='rooms-background'){const img=el('img',cls);img.src=base+src;img.alt='';stage.append(img);return img;}
 function theme(){return themes.includes(style?.applied)?style.applied:'authoritarian';}
 // Objects in the painting behave like desktop icons: transparent until pointed at, then the object itself lights up
 // (a brighter copy of the same painting, feathered to the object's area) with a theme-coloured glow and a glowing name.
 function hot(label,rect,fn){const b=button('',fn,stage);b.className='rooms-hot';const [x,y,w,h]=rect;b.style.cssText=`--x:${x};--y:${y};--w:${w};--h:${h}`;b.title=label;b.setAttribute('aria-label',label);
  const glow=el('i','rooms-hot-glow'),lit=el('img');lit.alt='';lit.draggable=false;lit.src=stage.querySelector('.rooms-background')?.src||'';glow.append(lit);b.append(glow,el('span','rooms-hot-name',label));return b;}
 const shelfSpecs=[['lore',3.3,16.5],['species',23.6,16],['history',43.1,13.6],['writing',60,10.8]],shelfPages={lore:0,species:0,history:0,writing:0};
 // Library shelves: every saved (non-deleted) book stands as a spine on its category shelf, 12 per shelf page (2 rows × 6).
 function drawShelves(){
  if(!root||!stage||room!=='reading'||view!=='room')return;stage.querySelector('.rooms-shelves')?.remove();
  const layer=el('div','rooms-shelves');layer.dataset.i18nSkip='';stage.append(layer);
  const books=(state.records||[]).filter(r=>r.kind==='book'&&!r.deleted);
  for(const [key,left,width] of shelfSpecs){
   const name=recordCategories().find(x=>x[0]===key)[1],list=books.filter(b=>b.category===key),count=Math.max(1,Math.ceil(list.length/12)),n=list.length;
   shelfPages[key]=Math.max(0,Math.min(shelfPages[key],count-1));const at=shelfPages[key];
   const bar=el('div','rooms-shelf-controls');bar.style.left=left+'%';bar.style.width=width+'%';layer.append(bar);
   button(name+' · '+L(`${n}권`,`${n} books`),()=>recordList('book',key),bar);
   if(count>1){
    const prev=button('‹',()=>{shelfPages[key]--;drawShelves();},bar);prev.disabled=at===0;prev.setAttribute('aria-label',L(`${name} 이전 서가`,`Previous ${name} shelf`));
    bar.append(el('small','',`${at+1}/${count}`));
    const next=button('›',()=>{shelfPages[key]++;drawShelves();},bar);next.disabled=at===count-1;next.setAttribute('aria-label',L(`${name} 다음 서가`,`Next ${name} shelf`));
   }
   list.slice(at*12,at*12+12).forEach((book,index)=>{
    const b=el('button','rooms-spine');b.type='button';const step=(width-.8)/6;b.style.left=(left+.4+(index%6)*step)+'%';b.style.width=(step*.92)+'%';b.style.bottom=(100-(index<6?25.3:47.8))+'%';
    let hash=0;for(const c of book.id)hash=(hash*31+c.charCodeAt(0))>>>0;b.style.height=(15+(hash%25)/10)+'%';b.style.setProperty('--spine-hue',((hash>>>5)%40-20)+'deg');
    const art=el('span','rooms-spine-art'),img=el('img');img.src=base+'library/book-spine-v2.webp';img.alt='';img.draggable=false;art.append(img);
    b.append(art,el('span','rooms-spine-title',book.title));b.setAttribute('aria-label',L(`「${book.title}」 읽기`,`Read “${book.title}”`));
    b.onclick=()=>read(book,0);layer.append(b);
   });
  }
 }
 async function go(next,sub='room'){
  if(!closeDialog())return;void window.sllm.roomsCompanion(state.token,'leave').catch(()=>{});stopTV();seq++;corridor?.destroy();corridor=null;chatPanel?.remove();chatPanel=null;
  const entering=next==='private'&&room!=='private';
  if(next!=='private')stopMusic();else if(sub==='sofa')musicAudio.pause();
  room=next;view=sub;
  if(entering){const ticket=seq;const data=await window.sllm.roomsMusic(state.token);if(!root||seq!==ticket)return;applyMusic(data);musicWanted=!!musicData.prefs.autoplay&&!!musicAudio.src;}
  if(next==='private'&&sub!=='sofa'&&musicWanted)await playMusic();stage.replaceChildren();stage.classList.remove('nursery-stage');toolbar.replaceChildren();message('');title.textContent=labels[room]();
  if(next==='nursery'){ // 아기방(통치자의 아이, 2026-10-27): 개인실의 아기 소품에서 온다. ui/nursery.js
   button(L('‹ 개인실','‹ Private room'),()=>go('private'));
   await window.SLLMNursery?.draw({stage,toolbar,message,modal,closeDialog,dialog:()=>dialog,redraw:()=>go('nursery')});return;
  }
  // 복도는 없앴다(2026-11-07 사용자): 방마다 바탕화면 아이콘으로 바로 들어오고, 나가면 집무실로. 독서실은 개인실에서 간다.
  button(L('‹ 집무실','‹ Office'),close);
  if(next==='reading')button(L('개인실로','To private room'),()=>go('private'));
  if(next==='private'){
   if(sub==='sofa'){showSecretaryTV(true);return;}
   asset('private/'+theme()+'-'+sub+'.webp');
   if(sub==='room'){
    // 2026-10-22: measured on all 8 room paintings (same composition): gramophone on the desk, leather journal, armchair by the window, sofa on the right.
    hot(L('축음기','Gramophone'),[20,23,15,29],()=>musicPanel());
    hot(L('개인 일지','Personal journal'),[9,53,17,10],()=>recordList('journal'));
    hot(L('창가에 앉기','Sit by the window'),[42,22,14,21],()=>go('private','window'));
    hot(L('소파에 앉기','Sit on the sofa'),[76,22,23,30],()=>go('private','sofa'));
    bedroomKey(); // 침실 열쇠(2026-10-30): 책상 위 빈 자리(일지 오른쪽) — 누르면 침실 창(src/features/bedroom-app.ts)
    void window.SLLMNursery?.babyObject(stage,{modal,go:()=>go('nursery')}); // 누르면 「누구를 보러 가시겠습니까?」 아이 목록부터 // 첫 아이가 생기면(임신 소식부터) 바닥 양탄자 위에 홀로그램 요람 — 2026-10-27
   }else button(L('일어나기','Stand up'),()=>go('private'));
   button(L('개인 일지','Personal journal'),()=>recordList('journal'));
   button(L('축음기','Gramophone'),()=>musicPanel());
   button(L('독서실','Library'),()=>go('reading'));
   if(window.sllm.partyOpen)button(L('🎉 관저 파티','🎉 House party'),async()=>{message(L('관저를 파티장으로 꾸밉니다…','Turning the residence into a party venue…'));const r=await window.sllm.partyOpen(theme());if(r&&!r.ok&&r.error)message(r.error);}); // 관저 파티(2026-11-03, src/features/party-app.ts)
  }else if(next==='reading'){
   asset('library/reading-room-empty-v2.webp');
   hot(L('새 글 쓰기','Write a book'),[76,63,22,10],()=>edit(null,'book'));
   drawShelves();
   button(L('책장 열기','Browse books'),()=>recordList('book'));
   button(L('새 글 쓰기','Write a book'),()=>edit(null,'book'));
  }else if(next==='exhibition'){
   if(sub==='showcase'){showShowcase();return;} // 골동품 진열장(2026-10-25 알파 11)
   asset('gallery/gallery-wall.webp');
   button(L('트로피 보관함','Trophy collection'),()=>trophyPanel());
   button(L('골동품 진열장','Antiques showcase'),()=>go('exhibition','showcase'));
   drawTrophies();
  }else if(next==='secretary'){
   if(sub==='tv'){showSecretaryTV();return;}
   asset('secretary/room-'+theme()+'.webp');
   hot(L('TV 시청','Watch TV'),[38,19,17,22],()=>go('secretary','tv')); // the wall TV in all 8 secretary-room paintings
   button(L('TV 시청','Watch TV'),()=>go('secretary','tv'));
   button(L('선물한 트로피','Gifted trophies'),()=>trophyPanel('secretary'));
   stage.style.setProperty('--room-brightness',({authoritarian:.86,egalitarian:1.04,xenophile:1,xenophobe:.76,militarist:.86,pacifist:1.03,spiritualist:.84,materialist:.96})[theme()]);
   if(state.secretary.ready){asset('secretary/secretary-seated.webp','rooms-secretary');asset('secretary/room-'+theme()+'.webp','rooms-desk');asset('secretary/work-hologram.webp','rooms-hologram');}
  }
  const min=next==='private'?20:next==='secretary'?0:10;
  const b=button(L('비서와 이야기하기','Talk with your secretary'),()=>chat());
  b.disabled=!state.secretary.ready||(min>0&&!(state.secretary.aff>=min));
  if(b.disabled)b.title=L('현재 통치자와의 관계 조건을 충족해야 합니다.','The current ruler must meet the relationship requirement.');
 }
 // 침실 열쇠: 그림(assets/private-rooms/private/bedroom-key.png)이 있으면 그것, 없으면 선 그림 열쇠. 8장 개인실 그림의 책상 같은 자리.
 function bedroomKey(){if(!window.sllm.bedroomOpen)return;const b=el('button','rooms-key');b.type='button';b.title=L('침실 열쇠','Bedroom key');b.setAttribute('aria-label',L('침실 열쇠 — 침실로 가기','Bedroom key — go to the bedchamber'));
  const img=el('img','rooms-key-img');img.alt='';img.draggable=false;img.onerror=()=>{const k=el('span','rooms-key-line');k.innerHTML='<svg viewBox="0 0 80 40"><circle cx="18" cy="20" r="11"/><circle cx="18" cy="20" r="4"/><path d="M29 20h40M58 20v9M66 20v7"/></svg>';img.replaceWith(k.firstChild);};img.src=base+'private/bedroom-key.png';
  b.append(img,el('span','rooms-hot-name',L('침실 열쇠','Bedroom key')));b.onclick=async()=>{message(L('침실 문을 엽니다…','Unlocking the bedchamber…'));const r=await window.sllm.bedroomOpen(theme());if(r&&!r.ok&&r.error)message(r.error);};stage.append(b);}
 function showSecretaryTV(privateSofa=false){
  let companionPose='alone';
  const art=privateSofa?'private/'+theme()+'-sofa.webp':'secretary-tv/tv-'+theme()+'.webp';const backdrop=asset(art);
  const screen=asset('secretary-tv/broadcast.webp','rooms-tv-screen');screen.hidden=true;if(privateSofa)screen.classList.add('rooms-sofa-tv');
  if(!privateSofa&&state.secretary.ready){asset('secretary-tv/secretary-back.webp','rooms-tv-secretary');asset(art,'rooms-tv-chair');asset(art,'rooms-tv-desk');}
  const caption=el('section','rooms-tv-caption');caption.dataset.i18nSkip='';stage.append(caption);
  if(privateSofa){
   button(L('일어나기','Stand up'),()=>go('private'));
   const call=button(L('비서 부르기','Call your secretary'),()=>changeCompanion('call'));
   const sit=button(L('옆에 앉으세요','Please sit beside me'),()=>changeCompanion('sit'));sit.disabled=true;
   const dismiss=button(L('동행 마치기','End company'),()=>changeCompanion('leave'));dismiss.disabled=true;
   call.disabled=!state.secretary.ready||!(state.secretary.aff>=20);
   async function changeCompanion(action){const r=await window.sllm.roomsCompanion(state.token,action);if(!root||seq!==ticket)return;if(!r.ok){message(r.error);return;}companionPose=r.pose;call.disabled=r.pose!=='alone';sit.disabled=r.pose!=='standing';dismiss.disabled=r.pose==='alone';
    stage.querySelectorAll('.rooms-sofa-companion,.rooms-sofa-front').forEach(x=>x.remove());if(r.pose!=='alone'){asset('private-tv/'+r.pose+'-cut.png','rooms-sofa-companion');asset(art,'rooms-sofa-front');}
    screen.classList.toggle('rooms-sofa-tv',true);chatPanel?.remove();chatPanel=null;await update();
   }
  }else button(L('비서실로 돌아가기','Return to secretary’s office'),()=>go('secretary'));
  const play=button(L('라디오 켜기','Turn radio on'),()=>update('play'));
  const stop=button(L('라디오 끄기','Turn radio off'),()=>update('stop'));
  const full=button(L('방송 전문','Broadcast transcript'),()=>{if(!tvSnapshot)return;const d=modal(tvSnapshot.station);if(d)d.append(el('p','rooms-transcript',tvSnapshot.lines.join('\n\n')));});
  const talk=button(L('이 방송에 대해 이야기하기','Discuss this broadcast'),()=>{if(tvSnapshot)chat({broadcastId:tvSnapshot.id});});talk.disabled=true;
  const ticket=seq,token=state.token;
  async function update(action){
   const r=await window.sllm.roomsRadio(token,action);if(!root||seq!==ticket)return;if(!r.ok){message(r.error);return;}
   tvSnapshot=r.broadcast;screen.hidden=!r.state.on;play.disabled=r.state.on;stop.disabled=!r.state.on;full.disabled=!tvSnapshot;talk.disabled=!tvSnapshot||!state.secretary.ready||(privateSofa&&companionPose==='alone');
   caption.replaceChildren(el('strong','',tvSnapshot?.station||L('성간 방송','Interstellar broadcast')),el('p','',tvSnapshot?tvSnapshot.lines.join('\n'):L('아직 수신한 방송이 없습니다. 라디오를 켜면 기존 방송 일정에 따라 수신합니다.','No broadcast received yet. Turning on the radio uses its existing broadcast schedule.')));
   message(r.state.working?L('라디오에서 방송을 준비하고 있습니다.','The radio is preparing a broadcast.'):r.state.on?L('라디오와 같은 방송을 공유합니다. 음성 설정은 라디오 창에서 조절하세요.','Sharing the radio broadcast. Adjust voice settings in the radio window.'):L('라디오가 꺼져 있습니다.','The radio is off.'));
  }
  async function poll(){try{await update();}catch(e){if(seq===ticket)message(e.message);}if(root&&seq===ticket)tvTimer=setTimeout(poll,1500);}
  poll();
 }
 // 골동품 진열장(2026-10-25 알파 11): 상인에게서 산 진품 30점 가운데 소장품을 5×3 유리 진열장에 둔다. 앱: src/features/collectibles-app.ts.
 // 배경 그림(gallery/collectible-showcase.webp)이 아직 없으면 전시실 벽을 어둡게 깔고, 물건 그림이 없으면 실루엣을 쓴다.
 const COL_SIL='<svg viewBox="0 0 48 48" fill="none" stroke="#e0c98e" stroke-width="1.6"><path d="M18 8h12M20 8c0 6-8 8-8 18 0 8 5 14 12 14s12-6 12-14c0-10-8-12-8-18"/><path d="M14 44h20"/></svg>';
 function showShowcase(){
  const bg=asset('gallery/collectible-showcase.webp');bg.onerror=()=>{bg.onerror=null;bg.src=base+'gallery/gallery-wall.webp';bg.classList.add('rooms-showcase-fallback');};
  button(L('‹ 전시실','‹ Gallery'),()=>go('exhibition'));
  button(L('소장품 목록','Collection list'),()=>showcasePanel());
  drawShowcase();
 }
 const colPic=(it,cls)=>{const w=el('span',cls);if(it.img){const i=el('img');i.src=it.img;i.alt='';w.append(i);}else w.innerHTML=COL_SIL;return w;};
 // 골동품 진열장 칸 위치(gallery/collectible-showcase.webp 1672×941 실측, 2026-10-25). 칸 안쪽 왼쪽·너비(px)와 줄의 위·아래(명판 포함).
 const SHOW_COLS=[[183,187],[440,198],[712,238],[1025,213],[1305,188]],SHOW_ROWS=[[108,316],[352,560],[588,757]];
 const SHOW_GEO=(slot)=>{const c=SHOW_COLS[slot%5],r=SHOW_ROWS[Math.floor(slot/5)]||SHOW_ROWS[2],f=(v,d)=>Math.round(v/d*10000)/100;return{l:f(c[0],1672),w:f(c[1],1672),t:f(r[0],941),h:f(r[1]-r[0],941)};};
 async function drawShowcase(){
  const ticket=seq;const r=await window.sllm.colShowcase();if(!root||seq!==ticket||room!=='exhibition'||view!=='showcase')return;if(!r.ok){message(r.error);return;}
  stage.querySelectorAll('.rooms-col-display').forEach(x=>x.remove());
  if(!r.items.length)message(L('아직 소장한 진품이 없습니다. 통신 단말기에서 XuraCorp·Riggan·Muutagan 상인의 「진품 상점」을 열어 보세요.','No antiques yet. Open a merchant\'s “Antiques” shop (XuraCorp, Riggan, Muutagan) from the terminal.'));
  for(const it of r.items.filter(x=>x.slot!==null)){
   const b=button('',()=>colDetail(it,r),stage);b.className='rooms-col-display g'+it.g;b.setAttribute('aria-label',it.name);
   const g=SHOW_GEO(it.slot);b.style.left=g.l+'%';b.style.top=g.t+'%';b.style.width=g.w+'%';b.style.height=g.h+'%'; /* 진열장 그림(1672×941)의 칸 안쪽 + 명판을 실측(2026-10-25) — 칸 너비가 서로 달라 칸마다 따로 */
   b.append(colPic(it,'rooms-col-pic'),el('span','rooms-hot-name',it.name));
  }
 }
 function colDetail(it,r){
  const d=modal(it.name);if(!d)return;const box=el('div','rooms-col-detail');
  box.append(colPic(it,'rooms-col-big'));
  const info=el('div');info.append(el('strong','',it.name),el('small','',it.grade+' · '+it.cls+' · '+it.origin),el('p','',it.desc),el('small','',L(`소장: ${it.date} · ${it.price.toLocaleString('en-US')} EC`,`Acquired ${it.date} · ${it.price.toLocaleString('en-US')} EC`)));
  if(it.onLoan!==null&&it.onLoan!==undefined)info.append(el('small','rooms-col-loan',L(`큐레이터 기사단에 대여 중 · ${it.onLoan}에 돌아옴`,`On loan to the Curator Order · returns ${it.onLoan}`)));
  const nav=el('nav');
  if(it.docId)button(L('정품 보증서','Certificate'),()=>window.SLLMDocs&&window.SLLMDocs.openId(it.docId).catch(e=>message(e.message)),nav);
  if(it.appraisalId)button(L('감정서','Appraisal'),()=>window.SLLMDocs&&window.SLLMDocs.openId(it.appraisalId).catch(e=>message(e.message)),nav);
  const sel=el('select');sel.append(new Option(L('진열에서 내리기(보관)','Take off display (store)'),''));for(let i=0;i<r.slots;i++){const o=r.items.find(x=>x.slot===i);sel.append(new Option(L(`진열장 ${i+1}번`,`Vitrine ${i+1}`)+(o&&o.id!==it.id?' — '+o.name:''),String(i)));}
  sel.value=it.slot===null?'':String(it.slot);
  if((it.onLoan===null||it.onLoan===undefined)&&window.SLLMLoan)button(L(`큐레이터에게 대여 (+${it.bonus}%)`,`Lend to the Curators (+${it.bonus}%)`),()=>{closeDialog();window.SLLMLoan.open({only:it.id});},nav);
  button(L('이 자리로 옮기기','Move here'),async()=>{const v=sel.value===''?null:Number(sel.value);const q=await window.sllm.colPlace(it.id,v);if(!q.ok){message(q.error);return;}closeDialog();drawShowcase();},nav);
  info.append(sel,nav);box.append(info);d.append(box);
 }
 async function showcasePanel(){
  const d=modal(L('소장품 목록','Collection list'));if(!d)return;const r=await window.sllm.colShowcase();if(dialog!==d)return;if(!r.ok){d.append(el('p','rooms-note',r.error));return;}
  const list=el('div','rooms-list');if(!r.items.length)list.append(el('p','rooms-note',L('아직 소장한 진품이 없습니다.','No antiques yet.')));
  for(const it of r.items){const row=el('section','rooms-record rooms-trophy-card');row.append(colPic(it,'rooms-col-thumb'),el('strong','',it.name),el('small','',it.grade+' · '+(it.onLoan?L('큐레이터 기사단에 대여 중','On loan to the Curators'):it.slot===null?L('보관 중','In storage'):L(`진열장 ${it.slot+1}번`,`Vitrine ${it.slot+1}`))));row.onclick=()=>{closeDialog();colDetail(it,r);};list.append(row);}
  d.append(list);
 }
 async function drawTrophies(){
  const ticket=seq;const r=await window.sllm.roomsTrophies(state.token);if(!root||seq!==ticket||room!=='exhibition')return;if(!r.ok){message(r.error);return;}stage.querySelectorAll('.rooms-trophy-display').forEach(x=>x.remove());
  for(const t of r.state.items.filter(x=>!x.deleted&&x.owner==='player'&&x.slot!==null)){const b=button('',()=>trophyPanel(),stage);b.className='rooms-trophy-display';b.setAttribute('aria-label',t.details.title);b.append(el('span','rooms-hot-name',t.details.title));b.style.left=(10.9+(t.slot%6)*13.66)+'%';b.style.top=(t.slot<6?12:46.8)+'%';/* 6 × 2 niches of the gallery painting; the name sits on the brass plaque */const img=el('img');img.src=base+'gallery/'+t.details.trophy+'.webp';img.alt='';b.prepend(img);}
 }
 async function trophyPanel(owner='player'){
  const d=modal(L('트로피 보관함','Trophy collection'));if(!d)return;let current;const checked=new Map();
  const notice=el('p','rooms-note'),actions=el('nav'),list=el('div','rooms-list');d.append(notice,actions,list);
  const load=async()=>{const r=await window.sllm.roomsTrophies(state.token);if(dialog!==d)return;if(!r.ok){notice.textContent=r.error;return;}current=r.state;draw();};
  const apply=async(t,action,input)=>{const r=await window.sllm.roomsTrophyChange(state.token,current.revision,t.id,action,input);if(!r.ok){notice.textContent=r.error;return;}await load();if(room==='exhibition')drawTrophies();};
  const tabs=[];const tab=(text,id)=>{const b=role(button(text,()=>{owner=id;draw();},actions),'tab');b.dataset.tab=id;tabs.push(b);return b;};
  tab(L('내 보관함','My collection'),'player');tab(L('비서 소유','Secretary’s collection'),'secretary');tab(L('보낸 선물','Given gifts'),'given');tab(L('소유 이력','Ownership history'),'history');
  role(button(L('트로피 제작 · 1,000 EC','Create trophy · 1,000 EC'),()=>editor(),actions),'primary');
  const roleName=r=>({governor:L('행성 총독','Planetary governor'),admiral:L('제독','Admiral'),general:L('장군','General'),scientist:L('과학자','Scientist'),commander:L('지휘관','Commander'),official:L('관료','Official')})[r]||'';
  const who=x=>x?.name?(x.kind==='person'?x.name+(roleName(x.role)?' · '+roleName(x.role):'')+' · '+L('우리 제국','Our empire'):x.name+(x.ruler?' · '+x.ruler:'')):L('미확인 수신자','Unknown recipient');
  const card=t=>{const row=el('section','rooms-record rooms-trophy-card'),img=el('img');img.src=base+'gallery/'+t.details.trophy+'.webp';img.alt='';row.append(img,el('strong','',t.details.title),el('small','',L('제작시기 - ','Crafted - ')+(t.creation?.rulerName?L(`${t.creation.rulerName} 재임, ${t.creation.date}`,`during ${t.creation.rulerName}’s reign, ${t.creation.date}`):L('미확인','Unknown'))),el('p','',t.details.body));return row;};
  const recover=async(q,mode)=>{const r=await window.sllm.roomsTrophyCreate(state.token,current.revision,null,q.id,mode);if(!r.ok){notice.textContent=r.error;await load();return;}checked.set(q.id,r.status);await load();
   notice.textContent=r.status==='paid'?L('결제가 확인되어 트로피를 만들었습니다.','Payment confirmed; the trophy was created.'):r.status==='short'?L('에너지 크레딧이 부족해 제작되지 않았습니다.','Insufficient energy credits. No trophy was created.'):r.status==='cancelled'?L('결제되지 않은 요청을 취소했습니다. 차감된 자원은 없습니다.','Cancelled the unpaid request. Nothing was charged.'):L('현재 세이브에서 결제 표시를 찾지 못했습니다. 다시 차감하지 않았습니다.','No payment marker found in the current save. Nothing was charged again.');};
  const actionName=a=>({'payment-requested':L('제작 결제 요청','Crafting payment requested'),'insufficient-energy':L('에너지 부족','Insufficient energy'),'payment-cancelled':L('미결제 요청 취소','Unpaid request cancelled'),created:L('제작','Crafted'),edit:L('수정','Edited'),delete:L('삭제','Deleted'),display:L('전시 변경','Display changed'),gift:L('비서에게 선물','Given to secretary'),reclaim:L('몰수','Reclaimed'),'letter-sent':L('외교 서신 발송','Gift letter sent'),'letter-cancelled':L('서신 전달 취소','Gift letter cancelled'),delivered:L('수신 확정','Receipt confirmed'),'delivery-failed':L('전달 실패 · 반송','Delivery failed · returned')})[a]||a;
  function draw(){for(const b of tabs)b.setAttribute('aria-pressed',String(b.dataset.tab===owner));list.replaceChildren();list.classList.toggle('rooms-list-rows',owner==='history');if(!current)return;notice.textContent=L('선물·몰수·삭제는 제작비를 환불하지 않습니다.','Gifting, reclaiming and deleting do not refund the crafting cost.');
   for(const q of current.requests.filter(x=>x.status==='pending')){const row=el('div','rooms-record');row.append(el('strong','',q.details.title),el('small','',L('결제 미확인 · 재차감 없이 조회','Unconfirmed payment · check without charging again')));
    button(L('결제 확인','Check payment'),()=>recover(q,'check'),row);
    if(checked.get(q.id)==='missing'){row.append(el('small','',L('게임에 결제 표시가 없습니다. 같은 요청 번호로 다시 보내면 이미 결제된 경우 차감하지 않습니다.','The game has no payment marker. Re-sending the same request never charges twice if it was already paid.')));
     button(L('같은 요청으로 다시 결제','Retry the same request'),async()=>{if(confirm(L('같은 요청 번호로 1,000 EC 결제를 다시 시도할까요?','Retry the 1,000 EC payment with the same request id?')))await recover(q,'retry');},row);
     button(L('요청 취소','Cancel request'),async()=>{if(confirm(L('게임에서 결제 표시가 없음을 다시 확인한 뒤에만 취소합니다. 진행할까요?','The request is cancelled only after the game confirms again that no payment exists. Continue?')))await recover(q,'cancel');},row);}
    list.append(row);}
   if(owner==='history'){
    button(L('원장 JSON 내보내기','Export ledger JSON'),async()=>{const r=await window.sllm.roomsTrophyExport(state.token);if(dialog===d)notice.textContent=r.ok?(r.cancelled?'':L('내보냈습니다.','Exported.')):r.error;},list);
    const rows=current.history.slice().reverse();if(!rows.length)list.append(el('p','',L('기록이 없습니다.','No records yet.')));
    for(const h of rows){const row=el('div','rooms-record rooms-ledger');const item=h.item||h.request;row.append(el('b','',actionName(h.action)+' · '+(item?.details?.title||'')),el('small','',(h.actor?.date||'')+' · '+(h.actor?.rulerName||L('미확인','Unknown'))));
     const to=h.item?.delivery?.to||h.item?.recipient;if(to)row.append(el('small','',L('받는 이: ','To: ')+who(to)));
     if(h.item?.owner)row.append(el('small','',L('소유: ','Owner: ')+({player:L('나','Me'),secretary:L('비서','Secretary'),empire:who(h.item.recipient),person:who(h.item.recipient)})[h.item.owner]));list.append(row);}
    return;}
   const items=current.items.filter(x=>!x.deleted&&(owner==='given'?(x.owner==='empire'||x.owner==='person'):x.owner===owner));
   if(!items.length)list.append(el('p','',owner==='given'?L('서신으로 보낸 트로피가 없습니다.','No trophies have been given by letter.'):L('트로피가 없습니다.','No trophies.')));
   for(const t of items){const row=card(t);
    if(owner==='given'){row.append(el('small','',L('수신 확정 - ','Received - ')+who(t.recipient)+' · '+(t.recipient?.date||'')));if(t.owner==='person')button(L('회수','Take back'),async()=>{if(confirm(L('이 인물에게서 트로피를 회수할까요? 우리 제국에 남아 있는 인물에게서만 회수할 수 있습니다.','Take this trophy back? Only possible while the person still serves our empire.')))await apply(t,'reclaim');},row);}
    else if(owner==='player'&&t.delivery){row.append(el('small','rooms-transit',L(`서신 전달 중 · ${who(t.delivery.to)} · 도착 예정 ${t.delivery.due}`,`In transit by letter · ${who(t.delivery.to)} · arriving ${t.delivery.due}`)));button(L('전달 취소','Cancel delivery'),async()=>{if(!confirm(L('서신 전달을 취소할까요? 트로피는 그대로 내 소유로 남습니다.','Cancel the letter? The trophy stays in your collection.')))return;const r=await window.sllm.roomsTrophyCancelLetter(state.token,current.revision,t.id);if(!r.ok){notice.textContent=r.error;return;}await load();},row);}
    else if(owner==='player'){button(L('수정','Edit'),()=>editor(t),row);button(L('전시','Display'),async()=>{const used=new Set(current.items.filter(x=>!x.deleted&&x.slot!==null).map(x=>x.slot));const slot=Array.from({length:12},(_,i)=>i).find(i=>!used.has(i));if(slot===undefined){notice.textContent=L('전시 칸 12개가 모두 찼습니다.','All 12 display slots are occupied.');return;}await apply(t,'display',slot);},row);if(t.slot!==null)button(L('전시 해제','Remove from display'),()=>apply(t,'display',null),row);
     button(L('비서에게 선물','Give to secretary'),async()=>{if(confirm(L('이 트로피를 비서에게 직접 전달할까요?','Give this trophy directly to your secretary?')))await apply(t,'gift');},row);
     role(button(L('서신으로 선물','Gift by letter'),()=>sendForm(t),row),'primary');
     role(button(L('삭제','Delete'),async()=>{if(confirm(L('트로피를 삭제할까요? 이력은 보존됩니다.','Delete this trophy? Its history will be preserved.')))await apply(t,'delete');},row),'danger');
    }else button(L('몰수','Reclaim'),async()=>{if(confirm(L('이 트로피를 내 보관함으로 회수할까요?','Reclaim this trophy into your collection?')))await apply(t,'reclaim');},row);
    list.append(row);
   }
  }
  async function sendForm(t){list.replaceChildren(card(t));list.classList.add('rooms-list-rows');const pickTo=el('select'),note=el('textarea'),info=el('p','rooms-note');pickTo.setAttribute('aria-label',L('받는 제국','Recipient empire'));note.maxLength=600;note.rows=3;note.placeholder=L('동봉할 짧은 글 (선택)','Short note to enclose (optional)');note.setAttribute('aria-label',note.placeholder);
   const fill=r=>{pickTo.replaceChildren();if(!r.ok){info.textContent=r.error;return;}const group=(label,list,value)=>{if(!list?.length)return;const g=el('optgroup');g.label=label;for(const x of list){const o=el('option','',who(x));o.value=value(x);g.append(o);}pickTo.append(g);};
    group(L('우리 제국 인물','Our empire’s people'),r.people,x=>x.key);group(L('다른 제국 지도자','Other empires’ leaders'),r.targets,x=>String(x.idx));const total=(r.people?.length||0)+r.targets.length;info.textContent=total?L(`도착까지 게임 시간 1개월. 도착할 때 받는 이가 여전히 연락 가능하면(우리 인물은 재직 중이면) 수신이 확정되고 소유권이 넘어갑니다. 다른 제국 연락처 기준일 ${r.contactsDate||'-'}`,`Arrives after one game month. If the recipient is still reachable on arrival (our people: still serving), receipt is confirmed and ownership passes to them. Other empires’ contacts as of ${r.contactsDate||'-'}`):L('선물할 수 있는 연락처가 없습니다. 연락처를 갱신해 주세요.','No giftable contacts. Refresh contacts.');send.disabled=!total;};
   list.append(pickTo,note,info);const nav=el('nav');list.append(nav);
   const send=role(button(L('서신 봉인 · 발송','Seal and send'),async()=>{const idx=/^(p|adm|gov):/.test(pickTo.value)?pickTo.value:Number(pickTo.value);if(!idx)return;if(!confirm(L('이 트로피를 서신으로 보낼까요? 도착 전까지는 취소할 수 있습니다.','Send this trophy by letter? You can cancel until it arrives.')))return;send.disabled=true;try{const r=await window.sllm.roomsTrophySend(state.token,current.revision,t.id,idx,note.value);if(!r.ok){info.textContent=r.error;return;}current=r.state;draw();notice.textContent=L('서신을 보냈습니다.','The letter was sent.');}finally{send.disabled=false;}},nav),'primary');
   button(L('연락처 갱신','Refresh contacts'),async()=>{info.textContent=L('연락처를 갱신하는 중…','Refreshing contacts…');fill(await window.sllm.roomsTrophyTargets(state.token,true));},nav);
   button(L('돌아가기','Back'),draw,nav);
   fill(await window.sllm.roomsTrophyTargets(state.token));
  }
  function editor(t){list.replaceChildren();const title=el('input'),event=el('input'),body=el('textarea'),kind=el('select');for(const [id,k,e] of [['ship','함선','Ship'],['medal','훈장','Medal'],['crystal','수정','Crystal'],['relic','유물','Relic']]){const o=el('option','',L(k,e));o.value=id;kind.append(o);}title.placeholder=L('트로피 이름','Trophy name');event.placeholder=L('기념할 사건','Commemorated event');body.placeholder=L('설명','Description');title.maxLength=120;event.maxLength=300;body.maxLength=5000;title.value=t?.details.title||'';event.value=t?.details.event||'';body.value=t?.details.body||'';kind.value=t?.details.trophy||'ship';for(const x of [title,event,body])x.setAttribute('aria-label',x.placeholder);kind.setAttribute('aria-label',L('모양','Design'));list.append(title,event,body,kind);
   const save=role(button(t?L('저장','Save'):L('1,000 EC로 제작','Craft for 1,000 EC'),async()=>{save.disabled=true;try{const input={title:title.value,event:event.value,body:body.value,trophy:kind.value};if(t){await apply(t,'edit',input);return;}if(!confirm(L('게임에서 에너지 크레딧 1,000을 지불하고 제작할까요?','Pay 1,000 energy credits in the game to craft this trophy?')))return;const r=await window.sllm.roomsTrophyCreate(state.token,current.revision,input);await load();if(!r.ok)notice.textContent=r.error;else if(r.state.requests.at(-1)?.status==='short')notice.textContent=L('에너지 크레딧이 부족합니다. 제작되지 않았습니다.','Insufficient energy credits. No trophy was created.');}finally{save.disabled=false;}},list),'primary');
  }
  await load();
 }
 function modal(label){if(!closeDialog())return null;dialog=el('section','rooms-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',label);dialog.dataset.i18nSkip='';const head=el('header');head.append(el('strong','',label));button('×',closeDialog,head).setAttribute('aria-label',L('닫기','Close'));dialog.append(head);root.append(dialog);return dialog;}
 async function musicPanel(){
  const d=modal(L('축음기','Gramophone'));if(!d)return;
  const note=el('p','rooms-note',L('선택한 음악만 재생합니다. 소파에서는 잠시 멈추고, 개인실을 나가면 정지합니다.','Only your selected music plays. The sofa pauses playback; leaving the room stops it.'));
  const list=el('div','rooms-list'),controls=el('nav');d.append(note,list,controls);
  const draw=r=>{applyMusic(r);list.replaceChildren();for(const t of r.tracks){const row=el('div','rooms-record');row.append(el('span','',t.name));button((r.prefs.selectedId===t.id?'✓ ':'')+L('선택 · 재생','Select · Play'),async()=>{await configureMusic({selectedId:t.id});await playMusic();draw(musicData);},row);button(L('삭제','Delete'),async()=>{if(!confirm(L('보관한 음악을 삭제할까요? 원본 파일은 유지됩니다.','Delete the stored copy? The original file will remain.')))return;draw(await window.sllm.roomsMusicDelete(state.token,t.id));},row);list.append(row);}};
  draw(await window.sllm.roomsMusic(state.token));
  button(L('음악 추가','Add music'),async()=>draw(await window.sllm.roomsMusicAdd(state.token)),controls);
  button(L('재생 / 이어듣기','Play / Resume'),playMusic,controls);
  button(L('일시정지','Pause'),()=>{musicAudio.pause();musicWanted=false;},controls);
  button(L('정지','Stop'),stopMusic,controls);
  for(const [key,label] of [['loop',L('반복','Repeat')],['autoplay',L('입장 시 자동재생','Play on entering')]]){const wrap=el('label','',label),input=el('input');input.type='checkbox';input.checked=musicData.prefs[key];input.onchange=()=>configureMusic({[key]:input.checked}).catch(e=>{input.checked=musicData.prefs[key];note.textContent=e.message;});wrap.prepend(input);controls.append(wrap);}
  const volume=el('input');volume.type='range';volume.min=0;volume.max=1;volume.step=.05;volume.value=musicData.prefs.volume;volume.setAttribute('aria-label',L('음량','Volume'));volume.oninput=()=>musicAudio.volume=Number(volume.value);volume.onchange=()=>configureMusic({volume:Number(volume.value)}).catch(e=>note.textContent=e.message);controls.append(el('label','',L('음량','Volume')),volume);
 }
 const recordCategories=()=>[['all',L('모든 분류','All categories')],['lore',L('세계관','Lore')],['species',L('종족','Species')],['history',L('역사','History')],['writing',L('창작','Writing')]];
 function recordList(kind,preset='all'){
  const d=modal(kind==='journal'?L('개인 일지','Personal journal'):L('독서실 책장','Library shelves'));if(!d)return;
  let items=state.records,archived=false;
  const actions=el('nav'),search=el('input'),category=el('select'),ruler=el('select'),notice=el('p','rooms-note');search.type='search';search.placeholder=L('제목·저자 검색','Search title or author');search.setAttribute('aria-label',search.placeholder);
  category.setAttribute('aria-label',L('분류','Category'));for(const [value,text] of recordCategories()){const o=el('option','',text);o.value=value;category.append(o);}category.value=preset;
  ruler.setAttribute('aria-label',L('원저자','Original author'));
  const authors=()=>{const selected=ruler.value;ruler.replaceChildren();const all=el('option','',L('모든 통치자','All rulers'));all.value='';ruler.append(all);const seen=new Set();for(const r of items.filter(x=>x.kind===kind)){const id=JSON.stringify([r.author?.sid||'?',r.author?.rulerId||'?']);if(seen.has(id))continue;seen.add(id);const o=el('option','',(r.author?.rulerName||L('미확인','Unknown'))+' · '+id);o.value=id;ruler.append(o);}ruler.value=seen.has(selected)?selected:'';};
  actions.append(search,category,ruler);role(button(L('새 글 쓰기','New writing'),()=>edit(null,kind),actions),'primary');
  if(kind==='journal'&&window.sllm.partyAlbum)button(L('📷 사진첩','📷 Photo album'),()=>photoAlbum(),actions); // 2026-11-03 관저 파티 단체 사진 등
  const archive=button(L('삭제된 기록 보기','Show archived records'),async()=>{try{const r=await window.sllm.roomsArchive(state.token);if(!r.ok)throw Error(r.error);if(dialog!==d)return;items=r.records;archived=!archived;archive.textContent=archived?L('현재 기록 보기','Show active records'):L('삭제된 기록 보기','Show archived records');authors();draw();}catch(e){notice.textContent=e.message;}},actions);
  button(L('파일 가져오기','Import file'),async()=>{try{const r=await window.sllm.roomsImport(state.token,kind);if(!r.ok)throw Error(r.error);if(r.cancelled||dialog!==d)return;await refresh();recordList(kind);}catch(e){notice.textContent=e.message;}},actions);
  button(L('JSON 내보내기','Export JSON'),async()=>{try{const r=await window.sllm.roomsExport(state.token,kind,archived);if(dialog!==d)return;notice.textContent=r.ok?(r.cancelled?'':L('내보냈습니다.','Exported.')):r.error;}catch(e){notice.textContent=e.message;}},actions);
  d.append(actions,notice);const list=el('div','rooms-list');d.append(list);
  const draw=()=>{list.replaceChildren();const q=search.value.toLowerCase();for(const r of items.filter(r=>r.kind===kind&&Boolean(r.deleted)===archived&&(category.value==='all'||r.category===category.value)&&(!ruler.value||JSON.stringify([r.author?.sid||'?',r.author?.rulerId||'?'])===ruler.value)&&(r.title+' '+(r.author?.rulerName||'')).toLowerCase().includes(q)).reverse()){
   const item=el('button','rooms-record');item.append(el('b','',r.title),el('small','',(r.author?.rulerName||L('저자 미확인','Unknown author'))+' · '+(r.author?.date||'')+' · '+(recordCategories().find(x=>x[0]===r.category)?.[1]||'')));
   if(r.imported)item.append(el('small','',L('가져온 자료 · 저자 정보 미검증','Imported · authorship unverified')));
   if(archived){item.onclick=()=>{const preview=el('pre','rooms-note',r.text);preview.style.cssText='white-space:pre-wrap;max-height:220px;overflow:auto';item.after(preview);};const row=el('section');row.append(item);button(L('복원','Restore'),async()=>{try{const result=await window.sllm.roomsRestore(state.token,r.id,r.revision);if(!result.ok)throw Error(result.error);await refresh();if(dialog===d)recordList(kind);}catch(e){notice.textContent=e.message;}},row);list.append(row);}else{item.onclick=()=>read(r,0);list.append(item);}
  }if(!list.children.length)list.append(el('p','',L('조건에 맞는 기록이 없습니다.','No matching records.')));};search.oninput=category.onchange=ruler.onchange=draw;authors();draw();search.focus();
 }
 // 사진첩(2026-11-03): 개인 일지 안. 지금은 관저 파티 단체 사진 — 누르면 크게, 「‹ 사진첩」으로 돌아옴
 async function photoAlbum(){
  const d=modal(L('사진첩','Photo album'));if(!d)return;const notice=el('p','rooms-note',L('불러오는 중…','Loading…'));d.append(notice);
  let r;try{r=await window.sllm.partyAlbum();}catch(e){r={ok:false,error:e.message,photos:[]};}if(dialog!==d)return;
  const photos=(r&&r.photos)||[];notice.textContent=!r||!r.ok?(r&&r.error)||'':photos.length?L(`사진 ${photos.length}장`,`${photos.length} photo(s)`):L('아직 사진이 없습니다. 관저 파티를 열고 마지막에 단체 사진을 찍으면 여기에 모입니다.','No photos yet. Hold a house party and take the group photo at the end — it will appear here.');
  const grid=el('div','rooms-album');d.append(grid);
  const cap=p=>`${p.date} · ${p.title} — ${p.guests.join(', ')}${p.resolve?' ⚔':''}${p.foreign&&p.foreign.length?' 🌐':''}`;
  const big=p=>{grid.hidden=true;notice.hidden=true;const v=el('figure','rooms-photo-big'),im=el('img');im.src=p.src;im.alt=L('단체 사진','Group photo');v.append(im,el('figcaption','',cap(p)));const back=el('nav');button(L('‹ 사진첩','‹ Photo album'),()=>{v.remove();grid.hidden=false;notice.hidden=false;},back);v.append(back);d.append(v);};
  for(const p of photos){const f=el('button','rooms-photo');f.type='button';const im=el('img');im.src=p.src;im.alt='';im.loading='lazy';f.append(im,el('b','',p.date),el('small','',p.guests.join(', ')));f.title=cap(p);f.onclick=()=>big(p);grid.append(f);}
 }
 function edit(record,kind){
  const d=modal(kind==='journal'?L('일지 쓰기','Write a journal entry'):L('책 쓰기','Write a book'));if(!d)return;
  const name=el('input'),body=el('textarea'),notice=el('p','rooms-note');name.maxLength=160;name.placeholder=L('제목','Title');name.setAttribute('aria-label',name.placeholder);name.value=record?.title||'';body.maxLength=kind==='book'?50000:20000;body.placeholder=L('본문','Text');body.setAttribute('aria-label',body.placeholder);body.value=record?.text||'';
  const category=el('select');category.setAttribute('aria-label',L('분류','Category'));for(const [value,text] of recordCategories().slice(1)){const o=el('option','',text);o.value=value;category.append(o);}category.value=record?.category||'writing';
  let summary=null;
  if(kind==='book'){summary=el('textarea','rooms-summary-input');summary.maxLength=1500;summary.rows=3;summary.placeholder=L('짧은 요약문 (선택 · 최대 1,500자)','Short summary (optional · up to 1,500 characters)');summary.setAttribute('aria-label',summary.placeholder);summary.value=record?.aiSummary||'';summary.oninput=()=>{dirty=true;count();};}
  const counter=el('small','rooms-note');const count=()=>{if(summary)counter.textContent=`${Array.from(summary.value).length} / 1500`;};count();
  name.oninput=body.oninput=category.onchange=()=>dirty=true;
  const controls=el('nav');d.append(name,category,body);
  if(kind==='journal'&&window.sllm.partyAlbum){const tray=el('div','rooms-snap-tray');tray.hidden=true;d.append(tray); // 다꾸: 사진첩에서 골라 커서 자리에 붙이기
   button(L('📷 사진 붙이기','📷 Add a photo'),async()=>{if(!tray.hidden){tray.hidden=true;return;}tray.replaceChildren();const m=await photoMap();if(dialog!==d)return;
    if(!m.size)tray.append(el('p','rooms-note',L('사진첩에 사진이 없습니다. 관저 파티에서 단체 사진을 찍으면 붙일 수 있습니다.','The photo album is empty. Take a group photo at a house party to add one.')));
    for(const p of m.values()){const b=el('button','rooms-photo');b.type='button';const im=el('img');im.src=p.src;im.alt='';b.append(im,el('b','',p.date));b.onclick=()=>{const t=`\n[[📷:${p.id}]]\n`,at=body.selectionStart??body.value.length;body.value=body.value.slice(0,at)+t+body.value.slice(body.selectionEnd??at);body.selectionStart=body.selectionEnd=at+t.length;dirty=true;tray.hidden=true;body.focus();};tray.append(b);}
    tray.hidden=false;},d).classList.add('rooms-snap-add');
   d.append(el('small','rooms-note',L('사진은 본문에 [[📷:번호]]로 들어가고, 읽을 때 사진으로 보입니다.','Photos go into the text as [[📷:number]] and show as pictures when reading.')));}if(summary)d.append(el('small','rooms-note',L('요약문은 책 정보로만 보관됩니다. 자동으로 AI에게 보내지 않습니다.','The summary is kept as book information only. It is not sent to the AI automatically.')),summary,counter);d.append(notice,controls);
  role(button(L('저장','Save'),async()=>{
   const token=state.token;const r=await window.sllm.roomsSave(token,{...record,kind,title:name.value,text:body.value,category:category.value,...(summary?{aiSummary:summary.value}:{})});
   if(!root||dialog!==d)return;if(!r.ok){notice.textContent=r.error;return;}dirty=false;
   try{await refresh();read(r.record,0);}catch(e){notice.textContent=e.message;}
  },controls),'primary');
  if(record)role(button(L('삭제','Delete'),async()=>{if(!confirm(L('목록에서 삭제할까요? 보관 사본은 남습니다.','Remove from the list? An archived copy will remain.')))return;const r=await window.sllm.roomsDelete(state.token,record.id,record.revision);if(!r.ok){notice.textContent=r.error;return;}dirty=false;await refresh();recordList(kind);},controls),'danger');
  name.focus();
 }
 // 다꾸(2026-11-03): 일지 본문의 [[📷:번호]] = 사진첩 사진. 쪽 나눔(글자 640/320)은 그대로, 사진 표시가 쪽 경계에 걸리면 시작한 쪽으로 통째로.
 const PHOTO_RE=/\[\[📷:(\d{10,16})\]\]/g;let photoCache=null;
 async function photoMap(){if(photoCache)return photoCache;const m=new Map();try{const r=await window.sllm.partyAlbum?.();for(const p of (r&&r.photos)||[])if(p.id)m.set(p.id,p);}catch{}photoCache=m;setTimeout(()=>{photoCache=null;},60000);return m;}
 function pageSlice(chars,s,e){const text=chars.join('');const spans=[];let m;PHOTO_RE.lastIndex=0;while((m=PHOTO_RE.exec(text))){const a=Array.from(text.slice(0,m.index)).length;spans.push([a,a+Array.from(m[0]).length]);}
  for(const [a,b] of spans){if(a<s&&b>s)s=b;if(a<e&&b>e)e=b;}return chars.slice(s,Math.max(s,e)).join('');}
 function fillPage(art,str,photos){art.replaceChildren();let last=0,m;PHOTO_RE.lastIndex=0;
  while((m=PHOTO_RE.exec(str))){if(m.index>last)art.append(document.createTextNode(str.slice(last,m.index)));const p=photos&&photos.get(m[1]);const f=el('figure','rooms-snap');let h=0;for(const c of m[1])h=(h*31+c.charCodeAt(0))%997;f.style.setProperty('--rot',((h%9)-4)*0.8+'deg');f.style.setProperty('--tape',['#f7c9d6cc','#bfe3f2cc','#f6e3a1cc','#cdeac0cc'][h%4]);
   if(p){const im=el('img');im.src=p.src;im.alt=L('단체 사진','Group photo');f.append(im,el('figcaption','',p.date+' · '+p.title));f.title=p.guests.join(', ');}else f.append(el('figcaption','',L('(사진을 찾을 수 없습니다)','(Photo not found)')));art.append(f);last=PHOTO_RE.lastIndex;}
  if(last<str.length)art.append(document.createTextNode(str.slice(last)));}
 function read(record,page){
  const d=modal(record.title);if(!d)return;const chars=Array.from(record.text),pages=Math.max(1,Math.ceil(chars.length/640));page=Math.max(0,Math.min(page,pages-1));
  d.classList.add('rooms-reader');const label=el('small','rooms-reading-label',L('함께 읽는 시간','A MOMENT TO READ'));d.querySelector('header strong').prepend(label);const book=el('div','rooms-book'),parts=[];for(let n=0;n<2;n++){const art=el('article','',pageSlice(chars,page*640+n*320,page*640+(n+1)*320));parts.push(art);book.append(art);}
  if(record.kind==='journal'&&PHOTO_RE.test(record.text)){PHOTO_RE.lastIndex=0;photoMap().then(m=>{if(dialog!==d)return;for(const art of parts)fillPage(art,art.textContent,m);});}
  const provenance=record.imported?L(' · 가져온 자료(저자 정보 미검증)',' · Imported (authorship unverified)'):'';
  const author=el('p','rooms-note',L('저자: ','Author: ')+(record.author?.rulerName||L('미확인','Unknown'))+' · '+(record.author?.date||'')+provenance);
  const controls=el('nav');d.append(book,author,controls);
  if(record.kind==='book'&&record.aiSummary){const box=el('details','rooms-summary');box.append(el('summary','',L('요약문','Summary')),el('p','',record.aiSummary));d.append(box);}
  button('‹',()=>read(record,page-1),controls).disabled=page===0;controls.append(el('span','',`${page+1} / ${pages}`));button('›',()=>read(record,page+1),controls).disabled=page===pages-1;
  button(L('수정','Edit'),()=>edit(record,record.kind),controls);
  const share=button(L('이 페이지를 비서에게 보여주기','Share these pages with your secretary'),async()=>{share.disabled=true;const ref={recordId:record.id,revision:record.revision,page};try{const r=await window.sllm.roomsShare(state.token,{...ref,room,requestId:crypto.randomUUID()});if(!r.ok)throw Error(r.error);if(dialog===d){book.classList.add('shared');chat(ref,d);}}finally{share.disabled=false;}},controls);
  share.disabled=!state.secretary.ready || !(state.secretary.aff>=(record.kind==='journal'?20:10));
 }
 function chat(reference={},parent=root){
  chatPanel?.remove();const panel=chatPanel=el('section','rooms-chat');parent.append(panel);panel.dataset.i18nSkip='';
  const portrait=el('div','rooms-portrait'),face=el('img','rooms-face');portrait.append(face);face.src=base+'library/face-idle.webp';face.alt=state.secretary.name;
  const name=el('strong','',state.secretary.name),log=el('div','rooms-chat-log'),input=el('textarea');input.maxLength=1200;input.placeholder=L('비서에게 이야기하세요.','Talk to your secretary.');input.setAttribute('aria-label',input.placeholder);log.dataset.empty=L('마음에 남는 구절을 비서와 나눠 보세요.','Share a passage or a thought with your secretary.');const actions=el('nav');panel.append(portrait,name,log,input,actions);
  button(L('대화 마치기','End conversation'),()=>{parent.querySelector('.rooms-book')?.classList.remove('shared');panel.remove();if(chatPanel===panel)chatPanel=null;},actions);
  const send=role(button(L('보내기','Send'),async()=>{
   const text=input.value.trim();if(!text)return;send.disabled=true;const ticket=seq,token=state.token;
   try{const r=await window.sllm.roomsChat(token,{room,text,requestId:crypto.randomUUID(),...reference});if(!root||ticket!==seq||!panel.isConnected)return;
    if(!r.ok){log.append(el('p','rooms-error',r.error));return;}
    log.append(el('p','rooms-user-line',state.actor.rulerName+' · '+text),el('p','rooms-them-line',r.name+' · '+r.reply));if(r.warning)log.append(el('p','rooms-error',r.warning));input.value='';log.scrollTop=log.scrollHeight;
    face.src=base+'library/face-'+(['smile','think'].includes(r.pose)?r.pose:'idle')+'.webp';
   }catch(e){if(panel.isConnected)log.append(el('p','rooms-error',e.message));}finally{send.disabled=false;}
  },actions),'primary');input.focus();
 }
 async function open(at){
  if(root){if(at&&at!==room)go(at);return;}if(opening)return;opening=true;state=null;
  try{await window.sllm.officeBack();await refresh();style=await window.sllm.officeStyle();}catch(e){alert(e.message);return;}finally{opening=false;}
  room='';root=el('section','private-rooms');root.dataset.i18nSkip='';root.setAttribute('role','dialog');root.setAttribute('aria-label',L('집무실 공간','Office rooms'));
  const header=el('header','rooms-hud'),plate=el('div','rooms-hud-title');title=el('strong');plate.append(el('small','',L('집무실 구역','OFFICE WING')),title);header.append(plate);const x=button('×',close,header);x.classList.add('rooms-hud-close');x.setAttribute('aria-label',L('집무실로 돌아가기','Return to office'));
  const frame=el('main','rooms-frame');stage=el('div','rooms-stage');frame.append(stage);const dock=el('div','rooms-dock');toolbar=el('nav','rooms-toolbar');status=el('p','rooms-status');status.setAttribute('role','status');dock.append(status,toolbar);root.append(frame,header,dock);document.body.append(root);go(at||'private');
 }
 // 바탕화면 아이콘(2026-11-07 사용자: 「복도 기능을 없애고 비서실·개인실·트로피룸 아이콘을 따로」). 비서실은 비서를 불러 만든 뒤에만 켜진다.
 const ICONS=[
  ['secRoomCall','secretary',()=>L('비서실','Secretary’s office'),'<path d="M6 40h36M10 40V24h28v16"/><rect x="15" y="8" width="18" height="12" rx="1"/><path d="M24 20v4M19 32h10"/>'],
  ['roomsCall','private',()=>L('개인실','Private room'),'<path d="M10 40V26a4 4 0 0 1 8 0v4h12v-4a4 4 0 0 1 8 0v14"/><path d="M14 22v-8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8M10 40h28"/>'],
  ['trophyCall','exhibition',()=>L('트로피룸','Trophy room'),'<path d="M16 8h16v10a8 8 0 0 1-16 0z"/><path d="M16 11h-5a5 5 0 0 0 5 7M32 11h5a5 5 0 0 1-5 7M24 26v7M17 40h14l-2-7H19z"/>'],
 ];
 let secReady=false;
 async function checkSecretary(){try{const r=await window.sllm.roomsState();secReady=!!(r&&r.ok&&r.secretary&&r.secretary.ready);}catch(e){secReady=false;}const b=document.getElementById('secRoomCall');if(b)b.style.display=secReady?'':'none';}
 document.addEventListener('DOMContentLoaded',()=>{
  const anchor=document.getElementById('secCall');if(!anchor)return;
  let after=anchor;
  for(const [id,at,name,svg] of ICONS){const b=el('button','ic');b.id=id;b.type='button';b.innerHTML='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+svg+'</svg>';b.append(el('span','',name()));b.onclick=()=>open(at);after.after(b);after=b;}
  document.getElementById('secRoomCall').style.display='none';void checkSecretary();
  anchor.addEventListener('click',()=>{setTimeout(checkSecretary,4000);setTimeout(checkSecretary,15000);}); // 비서를 처음 불러 만들면 비서실이 켜진다
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void checkSecretary();});setInterval(()=>{if(!document.hidden)void checkSecretary();},30000);
  window.addEventListener('keydown',e=>{if(root&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(dialog)closeDialog();else if(room==='nursery'||room==='reading')go('private');else close();}},true);
  window.sllm.onOfficeState?.(s=>{void checkSecretary();if(root&&s.sid!==state?.actor.sid){stopTV();seq++;chatPanel?.remove();chatPanel=null;stage.querySelectorAll('.rooms-sofa-companion,.rooms-sofa-front').forEach(x=>x.remove());void window.sllm.roomsCompanion(state.token,'leave').catch(()=>{});musicAudio.pause();musicWanted=false;message(L('세이브가 바뀌었습니다. 작성 중인 내용은 복사한 뒤 방을 다시 열어 주세요.','The save changed. Copy any unsaved writing, then reopen the room.'));}});
  window.sllm.onOfficeGo?.(v=>{if(v==='nursery')void open('nursery');}); // 아이 소식 알림 → 「아기방으로 가기」
  document.addEventListener('sllm-language',()=>{for(const [id,,name] of ICONS){const b=document.getElementById(id);if(b)b.querySelector('span').textContent=name();}if(root&&!dirty)close();});
 });
 window.SLLMPrivateRooms={open,close};
})();
