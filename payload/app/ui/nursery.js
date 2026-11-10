/* 아기방(통치자의 아이, 2026-10-27 사용자 확정). 개인실(private-rooms.js)의 아기 소품을 누르면 이 방으로 온다.
   앱: src/features/children-app.ts(childList·childAnswer·childRename·childHeir·childTalkOpen/Say/End). 규칙: src/children.ts.
   그림 ★: 아기방 그림 하나(assets/private-rooms/nursery/nursery.png, 없으면 홀로그램 선 그림). 아이는 실루엣만 — 단계·성별·체격에 맞춘 모양(그림 파일 없음).
   언어 팩 규칙: 문구는 L('한국어','English')로만. */
(() => {
 const L=(k,e)=>window.SLLMI18n?.pick(k,e)||k;
 const base='assets/private-rooms/nursery/';
 const NS='http://www.w3.org/2000/svg';
 const svg=(vb,body,cls)=>{const s=document.createElementNS(NS,'svg');s.setAttribute('viewBox',vb);s.setAttribute('class',cls||'');s.setAttribute('aria-hidden','true');s.innerHTML=body;return s;};
 // 선 그림 소품(홀로그램). 단계마다: 아기 = 요람, 어린이 = 작은 침대·장난감, 청소년 = 책상.
 const PROP={
  expecting:'<path d="M14 66h72"/><circle cx="50" cy="38" r="16" stroke-dasharray="4 4"/><circle cx="50" cy="38" r="7"/><path d="M50 12v6M50 58v6M24 38h6M70 38h6"/>',
  baby:'<path d="M14 66h72"/><path d="M22 40h56l-6 18H28z"/><path d="M22 40c2-12 14-20 28-20"/><path d="M30 58l-6 8M70 58l6 8"/><path d="M50 8v12M42 12h16M44 16l-4 6M56 16l4 6"/><circle cx="40" cy="22" r="2"/><circle cx="60" cy="22" r="2"/>',
  child:'<path d="M10 66h80"/><path d="M16 44h52v14H16z"/><path d="M16 36v30M68 40v26"/><path d="M20 44c0-4 4-6 8-6h10c3 0 5 2 5 6"/><rect x="74" y="52" width="10" height="10"/><path d="M74 52l5-6 5 6"/><circle cx="82" cy="40" r="4"/>',
  teen:'<path d="M10 66h80"/><path d="M14 42h50M18 42v24M60 42v24"/><path d="M24 30h18v12H24z"/><path d="M28 30l2-6h6l2 6"/><path d="M70 66V50h14v16M70 50c0-6 14-6 14 0"/><path d="M48 36l8-8M48 36h8"/>',
 };
 // 아이는 실루엣만(2026-10-27 사용자 확정): 단계(아기·어린이·청소년) × 성별에 맞춘 모양, 체격은 아이마다 조금씩(ID 로 정해 늘 같다).
 const SIL={
  'baby-m':'<circle cx="50" cy="68" r="9.5"/><path d="M37 98c0-12 5-19 13-19s13 7 13 19z"/><rect x="32" y="82" width="7" height="11" rx="3.5"/><rect x="61" y="82" width="7" height="11" rx="3.5"/>',
  'baby-f':'<circle cx="50" cy="68" r="9.5"/><circle cx="50" cy="57" r="3.2"/><path d="M37 98c0-12 5-19 13-19s13 7 13 19z"/><rect x="32" y="82" width="7" height="11" rx="3.5"/><rect x="61" y="82" width="7" height="11" rx="3.5"/>',
  'child-m':'<circle cx="50" cy="42" r="8"/><path d="M42 40c0-7 4-10 8-10s9 3 8 10c-2-3-5-4-8-4s-6 1-8 4z"/><rect x="41" y="51" width="18" height="24" rx="5"/><rect x="34.5" y="53" width="5.5" height="20" rx="2.7"/><rect x="60" y="53" width="5.5" height="20" rx="2.7"/><rect x="43" y="72" width="6" height="26" rx="3"/><rect x="51" y="72" width="6" height="26" rx="3"/>',
  'child-f':'<path d="M41 42c0-8 4-12 9-12s9 4 9 12l1 10H40z"/><circle cx="50" cy="42" r="8"/><path d="M44 51h12l7 29H37z"/><rect x="35" y="53" width="5" height="19" rx="2.5"/><rect x="60" y="53" width="5" height="19" rx="2.5"/><rect x="44" y="78" width="5" height="20" rx="2.5"/><rect x="51" y="78" width="5" height="20" rx="2.5"/>',
  'teen-m':'<circle cx="50" cy="15" r="8"/><path d="M42 13c0-7 4-10 8-10s9 3 8 10c-2-3-5-3-8-3s-6 0-8 3z"/><path d="M36 28q14-5 28 0l-3 33H39z"/><rect x="30" y="29" width="6.5" height="31" rx="3.2"/><rect x="63.5" y="29" width="6.5" height="31" rx="3.2"/><rect x="40.5" y="58" width="8.5" height="40" rx="4"/><rect x="51" y="58" width="8.5" height="40" rx="4"/>',
  'teen-f':'<path d="M41 16c0-9 4-13 9-13s9 4 9 13l2 20H39z"/><circle cx="50" cy="16" r="7.5"/><path d="M41 28q9-4 18 0l-2 22H43z"/><path d="M43 49h14l4 18H39z"/><rect x="35.5" y="29" width="5" height="28" rx="2.5"/><rect x="59.5" y="29" width="5" height="28" rx="2.5"/><rect x="43" y="65" width="6" height="33" rx="3"/><rect x="51" y="65" width="6" height="33" rx="3"/>',
 };
 const hashOf=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h;};
 // 체격 ★(2026-10-27 사용자): 그림을 늘이지 않고 체격마다 따로 그린 실루엣 — 단계(영유아·어린이·청소년) × 성별 × 체격 3(1 가냘픔 · 2 보통 · 3 다부짐).
 // 아이마다 체격은 ID 로 정해 늘 같다. GPT 그림 sil-<단계>-<m|f>-<1|2|3>.webp, 없으면 선 그림(체격만큼 너비를 바꿔 그린다).
 const BUILD_W=[0.88,1,1.12];
 const buildOf=c=>(hashOf(c.id)%3)+1;
 function silhouette(c){
  const st=c.stage==='baby'||c.stage==='child'||c.stage==='teen'?c.stage:'teen',g=c.gender==='f'?'f':'m',n=buildOf(c);
  const line=()=>svg('0 0 100 100',`<g transform="translate(50 100) scale(${BUILD_W[n-1]} 1) translate(-50 -100)">${SIL[st+'-'+g]}</g>`,'nursery-sil');
  const img=el('img','nursery-sil-img');img.alt='';img.draggable=false;img.onerror=()=>img.replaceWith(line());img.src=base+`sil-${st}-${g}-${n}.webp`;
  return img;
 }

 // 플레이어가 고른 초상화(2026-10-27): 있으면 실루엣 대신 그 그림. 고르기는 아이 패널의 「초상화 넣기」(기존 지도자 개인 초상화와 같은 pickImage).
 function faceImg(c){const img=el('img','nursery-face-img');img.alt='';img.draggable=false;img.onerror=()=>img.replaceWith(silhouette(c));img.src=c.face;return img;}
 const STAGE={expecting:()=>L('곧 태어남','On the way'),baby:()=>L('영유아','Infant'),child:()=>L('어린이','Child'),teen:()=>L('청소년','Teen'),adult:()=>L('성인','Adult')};
 const AXIS=[['official',()=>L('관료','Official')],['scientist',()=>L('과학자','Scientist')],['commander',()=>L('사령관','Commander')]];
 let S=null,api=null,ticket=0;
 const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined&&x!==null)e.textContent=x;return e;};
 const btn=(t,fn,parent,cls)=>{const b=el('button',cls||'',t);b.type='button';b.onclick=()=>{Promise.resolve(fn()).catch(e=>api?.message(e.message));};if(parent)parent.append(b);return b;};
 async function load(){const r=await window.sllm.childList();S=r&&r.ok?r:null;if(r&&!r.ok)api?.message(r.error);return S;}
 let sel=null; // 지금 보러 간 아이(2026-10-27: 아기방 그림은 하나, 요람을 누르면 아이 목록부터 → 고른 아이를 보러 간다)
 const kidsOf=()=>(S?.children||[]).slice().sort((x,y)=>(x.parent+'').localeCompare(y.parent+'')||(x.due+'').localeCompare(y.due+''));
 const sub=c=>c.stage==='expecting'?L(`${c.due} 출산 예정`,`Due ${c.due}`):`${STAGE[c.stage]()} · ${L(c.age+'세',c.age+' y')}`;
 /** 「누구를 보러 가시겠습니까?」 — t: { modal, go }. */
 function chooser(t){
  const d=t.modal(L('누구를 보러 가시겠습니까?','Who would you like to see?'));if(!d)return;d.classList.add('nursery-chooser');d.dataset.i18nSkip='';
  const kids=kidsOf();
  if(!kids.length)d.append(el('p','nursery-note',L('지금 아기방에 있는 아이가 없습니다.','No children in the nursery right now.')));
  const ul=el('div','nursery-pick');let last=null;
  for(const c of kids){
   if(c.parent!==last){ul.append(el('h4','',L(`${c.parent}와(과)의 아이`,`With ${c.parent}`)));last=c.parent;}
   const row=el('div','nursery-pick-row');
   const b=el('button','nursery-pick-item'+(c.event||c.cross?' has-event':''));b.type='button';
   const ic=el('span','nursery-pick-ic');ic.append(svg('0 0 100 80',PROP[c.stage]||PROP.baby,'nursery-prop'));
   const tx=el('span','nursery-pick-tx');tx.append(el('b','',(c.star?'★ ':'')+(c.name||L('곧 태어날 아이','The child on the way'))),el('small','',sub(c)));
   b.append(ic,tx);if(c.event)b.append(el('i','nursery-pick-dot',L('고를 일','To decide')));else if(c.cross)b.append(el('i','nursery-pick-dot',L('진로','Path')));
   b.onclick=()=>{sel=c.id;t.go();};row.append(b);
   if(c.canStudy)row.append(studyRow(c,()=>chooser(t)));
   ul.append(row);
  }
  d.append(ul);
  if(S?.grown?.length)btn(L(`다 자란 아이들 · ${S.grown.length}`,`Grown children · ${S.grown.length}`),()=>grownPanel(),d);
 }
 // 「어떤 공부를 시키겠습니까?」(2026-10-27 사용자): 아이마다 직업 아이콘 3개. 고르면 성인식 직업이 그것(다시 누르면 취소 → 양육 사건 점수로 자동).
 const STUDY_ICON={official:'<path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z"/>',scientist:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7.5 15h9"/>',commander:'<path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.3 6.8 19l1-5.8L3.6 9.1l5.8-.8z"/>'};
 function studyRow(c,after){
  const w=el('div','nursery-study');w.append(el('small','',L('어떤 공부를 시키겠습니까?','What should they study?')));
  for(const [k,n] of AXIS){const b=el('button','nursery-study-btn'+(c.study===k?' on':''));b.type='button';b.setAttribute('aria-pressed',String(c.study===k));
   b.title=c.study===k?L(`${n()} 공부 중 — 다시 누르면 취소`,`Studying to be a ${n()} — press again to cancel`):L(`${n()}의 길로 공부시키기`,`Study for the ${n()} path`);
   b.append(svg('0 0 24 24',STUDY_ICON[k],'nursery-study-ic'),el('span','',n()));
   b.onclick=async()=>{const r=await window.sllm.childStudy(c.id,c.study===k?'':k);if(r&&r.ok===false){api?.message(r.error);return;}if(r&&r.ok)S=r;after();};w.append(b);}
  return w;
 }
 /** 개인실에 아기 소품(아이가 하나라도 있으면). 누르면 아이 목록부터. t: { modal, go(아기방으로) } */
 async function babyObject(stage,t){
  let r=null;try{r=await window.sllm.childList();}catch(e){return;}
  if(!r||!r.ok||r.off||!(r.children||[]).length&&!(r.grown||[]).length)return;
  if(!stage.isConnected)return;S=r;
  const b=el('button','rooms-baby');b.type='button';const n=(r.children||[]).length,pend=(r.children||[]).some(c=>c.event);
  b.title=L('아기방','Nursery');b.setAttribute('aria-label',L('아기방 — 누구를 보러 갈지 고르기','Nursery — choose who to see'));
  b.append(svg('0 0 100 80',PROP.baby,'rooms-baby-art'),el('span','rooms-hot-name',L(`아기방 · ${n}명`,`Nursery · ${n}`)));
  if(pend)b.append(el('i','rooms-baby-dot'));
  b.onclick=()=>{api={modal:t.modal};chooser(t);};stage.append(b);
 }
 /** 아기방: 그림 하나(assets/private-rooms/nursery/nursery.png, 없으면 선 그림) 위에 고른 아이 한 명. */
 async function draw(a){
  api=a;const my=++ticket;
  const st=a.stage;st.classList.add('nursery-stage');
  const bg=el('div','nursery-bg');const wall=svg('0 0 1672 941','<path d="M0 760h1672"/><path d="M120 760V180M1552 760V180"/><path d="M640 120c0-60 80-90 196-90s196 30 196 90v300H640z"/><path d="M836 30v390M640 270h392"/><path d="M200 760l-80 181M1472 760l80 181"/><g class="nursery-mobile"><path d="M300 0v90M240 90h120"/><circle cx="240" cy="120" r="14"/><path d="M300 90v40"/><path d="M290 140l10-12 10 12-10 12z"/><circle cx="360" cy="116" r="10"/></g><g class="nursery-stars"><circle cx="700" cy="90" r="3"/><circle cx="760" cy="150" r="2"/><circle cx="900" cy="70" r="3"/><circle cx="980" cy="170" r="2"/><circle cx="820" cy="230" r="2"/></g>','nursery-wall');
  const pic=el('img','nursery-pic');pic.alt='';pic.draggable=false;pic.onload=()=>{bg.classList.add('has-pic');wall.remove();};pic.onerror=()=>{if(pic.dataset.png){pic.remove();return;}pic.dataset.png='1';pic.src=base+'nursery.png';};pic.src=base+'nursery.webp'; // GPT 그림: nursery.webp(없으면 .png, 그것도 없으면 선 그림)
  bg.append(pic,wall);st.append(bg);
  const room=el('div','nursery-one');room.dataset.i18nSkip='';st.append(room);
  await load();if(my!==ticket||!st.isConnected)return;
  if(!S){room.append(el('p','nursery-empty',L('아기방을 불러오지 못했습니다.','Could not load the nursery.')));return;}
  if(S.off){room.append(el('p','nursery-empty',L('이 제국에는 아이 기능이 없습니다.','This empire has no children feature.')));return;}
  const kids=kidsOf();
  let c=kids.find(x=>x.id===sel)||kids.find(x=>x.event)||kids[0];sel=c?.id??null;
  btn(L('다른 아이 보러 가기','See another child'),()=>chooser({modal:a.modal,go:a.redraw}),a.toolbar).disabled=!kids.length;
  btn(L('다 자란 아이들','Grown children')+(S.grown.length?` · ${S.grown.length}`:''),()=>grownPanel(),a.toolbar);
  if(window.SLLMCourt)btn(L('가문·가계도','House & family tree'),()=>{const d=a.modal(L('가문·가계도','House & family tree'));if(!d)return;d.classList.add('nursery-tree');const host=el('div');d.append(host);void window.SLLMCourt.tree(host);},a.toolbar); // 2026-10-28 정치: 가계도
  a.toolbar.append(el('small','nursery-cap',S.cap.unlimited?L(`통치자의 아이 ${S.cap.used}명 · 제한 없음`,`Ruler's children ${S.cap.used} · no limit`):L(`통치자의 아이 ${S.cap.used}/${S.cap.total}명 · 배우자마다 ${S.cap.perSpouse}명까지`,`Ruler's children ${S.cap.used}/${S.cap.total} · up to ${S.cap.perSpouse} per spouse`)));
  if(!c){room.append(el('p','nursery-empty',L('지금 아기방에 있는 아이가 없습니다.','No children in the nursery right now.')));return;}
  const spot=el('button','nursery-spot'+(c.event?' has-event':''));spot.type='button';spot.style.setProperty('--i',0);
  const art=el('span','nursery-art');art.append(svg('0 0 100 80',PROP[c.stage]||PROP.baby,'nursery-prop'));
  if(c.stage!=='expecting'){
   const k=el('span','nursery-kid nursery-kid-'+c.stage);k.append(c.face?faceImg(c):silhouette(c));
   art.append(k);
  }
  spot.append(art);
  const plate=el('span','nursery-plate');plate.append(el('b','',c.name||L('곧 태어날 아이','The child on the way')),el('small','',sub(c)),el('em','',L(`${c.parent}의 아이`,`with ${c.parent}`)));
  spot.append(plate);if(c.event||c.cross)spot.append(el('i','nursery-dot','!'));
  spot.setAttribute('aria-label',(c.name||L('곧 태어날 아이','The child on the way'))+(c.event?L(' — 고를 일이 있습니다',' — something to decide'):''));
  spot.onclick=()=>childPanel(c.id);room.append(spot);
  if(c.event||c.cross)childPanel(c.id); // 고를 일·진로가 있으면 바로 연다
 }
 const cur=id=>S&&S.children.concat(S.grown).find(c=>c.id===id);
 async function refreshAfter(r){if(r&&r.ok===false){api.message(r.error);return false;}if(r&&r.ok)S=r;api.redraw();return true;}
 function childPanel(id){
  const c=cur(id);if(!c)return;const d=api.modal(c.name||L('곧 태어날 아이','The child on the way'));if(!d)return;d.classList.add('nursery-panel');
  const head=el('div','nursery-head');
  head.append(el('p','',[c.stage==='expecting'?L(`${c.due} 출산 예정`,`Due ${c.due}`):`${STAGE[c.stage]()} · ${L(c.age+'세',c.age+(c.age===1?' year old':' years old'))}`,L(`부모: ${c.ruler}, ${c.parent}`,`Parents: ${c.ruler} and ${c.parent}`)].join(' · ')));
  d.append(head);
  if((c.houseTraits&&c.houseTraits.length)||c.wed){const hw=el('p','nursery-note nursery-house');if(c.houseTraits&&c.houseTraits.length)hw.append(el('span','',L(`가문 특성: ${c.houseTraits.join(', ')}`,`House traits: ${c.houseTraits.join(', ')}`)));if(c.wed)hw.append(el('span','',(c.houseTraits&&c.houseTraits.length?' · ':'')+L(`혼인: ${c.wed}`,`Married: ${c.wed}`)));d.append(hw);} // 가문·정략결혼(2026-10-28)
  if(c.stage!=='expecting'&&!c.adult){ // 아이의 희망 · 관심 자녀 별표(2026-10-28)
   const w=el('div','nursery-wish');
   w.append(el('span','',c.civ?L(`어릴 적 꿈: ${c.wishText}`,`Childhood dream: ${c.wishText}`):L(`아이의 희망: ${c.wishText}이(가) 되고 싶어 합니다`,`Their wish: to become ${c.wishText}`)));
   const sb=btn(c.star?L('★ 관심 자녀','★ Favorite'):L('☆ 관심 자녀로','☆ Mark as favorite'),async()=>{const r=await window.sllm.childStar(c.id);if(await refreshAfter(r))childPanel(c.id);},w,'nursery-star'+(c.star?' on':''));
   sb.title=L('별표를 친 아이는 민간인 삶의 사건이 더 자주 찾아옵니다.','Starred children get civilian-life events more often.');sb.setAttribute('aria-pressed',String(!!c.star));
   if(c.upset)w.append(el('small','nursery-note',L(`원하던 길을 가지 못해 서운해한 적이 있습니다(${c.upset}번).`,`Has been hurt about their path (${c.upset}×).`)));
   if(c.bond!=null){const bd=el('small','nursery-note nursery-bond',L(`부모와의 정: ${c.bond} (${c.bondName}) — 백화점에서 선물하면 깊어집니다.`,`Bond with you: ${c.bond} (${c.bondName}) — gifts from the department store deepen it.`));w.append(bd);} // 자식에게 선물(2026-10-30)
   d.append(w);
  }
  if(c.adult&&c.bond!=null)d.append(el('p','nursery-note nursery-bond',L(`부모와의 정: ${c.bond} (${c.bondName})`,`Bond with you: ${c.bond} (${c.bondName})`)));
  if(c.cross)d.append(crossBox(c));
  if(c.civ)d.append(civBox(c));
  if(!c.adult&&!c.civ&&!c.cross&&c.stage!=='expecting'){
   const row=el('div','nursery-rename');const inp=el('input');inp.value=c.name||'';inp.maxLength=60;inp.setAttribute('aria-label',L('이름','Name'));
   row.append(inp);btn(L('이름 바꾸기','Rename'),async()=>{const r=await window.sllm.childRename(c.id,inp.value);if(await refreshAfter(r))childPanel(c.id);},row);d.append(row);
  }
  if(c.event){
   const box=el('section','nursery-event');box.append(el('strong','',c.event.title),el('p','',c.event.text),el('small','',L(`${c.event.until}까지 고르지 않으면 「부모가 바빴다」로 지나갑니다.`,`If nothing is chosen by ${c.event.until}, it passes as “the parents were too busy”.`)));
   const ch=el('div','nursery-choices');c.event.choices.forEach((t,i)=>btn(t,async()=>{const r=await window.sllm.childAnswer(c.id,i);if(await refreshAfter(r))childPanel(c.id);},ch,'rooms-primary'));
   box.append(ch);d.append(box);
  }
  if(c.stage!=='expecting'&&!c.civ){
   const bars=el('div','nursery-bars');const max=Math.max(4,...AXIS.map(([k])=>c.score[k]||0));
   for(const [k,n] of AXIS){const r=el('div','nursery-bar');const fill=el('i');fill.style.width=((c.score[k]||0)/max*100)+'%';r.append(el('span','',n()),el('b','',''),el('small','',String(c.score[k]||0)));r.children[1].append(fill);bars.append(r);}
   d.append(el('h4','',L('성향(양육 사건)','Leaning (from upbringing)')),bars);
   if(c.canStudy){d.append(el('h4','',L('공부','Studies')));d.append(studyRow(c,()=>childPanel(c.id)));d.append(el('small','nursery-note',c.study?L(`성인식 때 ${AXIS.find(a=>a[0]===c.study)[1]()}(으)로 지도자가 됩니다.`,`Becomes a ${AXIS.find(a=>a[0]===c.study)[1]()} at coming of age.`):L('공부를 고르지 않으면 양육 사건의 성향이 가장 높은 직업이 됩니다.','Without a chosen study, the highest upbringing leaning decides the career.')));}
  }
  if(!c.adult&&!c.civ&&c.stage!=='expecting'){ // 초상화 바꾸기(플레이어가 원하는 그림, 성인이 되면 지도자 초상화로 이어짐)
   const fr=el('div','nursery-face-row');if(c.face){const im=el('img');im.src=c.face;im.alt='';fr.append(im);}
   btn(c.face?L('🖼 초상화 바꾸기','🖼 Change portrait'):L('🖼 초상화 넣기','🖼 Set portrait'),async()=>{await window.sllm.pickImage({kind:'portrait',key:c.faceKey,label:c.name}).catch(()=>null);if(await refreshAfter(await window.sllm.childList()))childPanel(c.id);},fr);
   if(c.face)btn(L('기본 실루엣으로','Back to the silhouette'),async()=>{await window.sllm.clearImage({kind:'portrait',key:c.faceKey}).catch(()=>null);if(await refreshAfter(await window.sllm.childList()))childPanel(c.id);},fr);
   fr.append(el('small','',L('이 아이에게만 쓸 그림입니다. 성인이 되면 그 지도자의 초상화로 이어집니다.','Used only for this child; it carries over as the leader’s portrait at coming of age.')));d.append(fr);
  }
  if(c.stage==='teen'||c.stage==='child'||(c.civ&&!c.civ.dead))btn(L('대화하기','Talk'),()=>talk(c.id),d,'rooms-primary'); // 횟수 제한 없음(2026-10-27) · 민간인 자녀도(2026-10-28)
  else if(c.stage==='baby')d.append(el('p','nursery-note',L('아직 말을 하지 못합니다. 세 살(어린이)부터 대화할 수 있습니다.','Too young to talk yet. Talks open at age 3.')));
  if(c.adult){
   const p=el('p','nursery-note',c.adult.state==='applied'?L(`${c.adult.on} 성인이 되어 우리 지도자가 되었습니다. 이제 연락처에서 1:1로 통신할 수 있습니다.`,`Came of age on ${c.adult.on} and joined our leaders. You can now talk one-on-one from the contacts.`):L('성인식을 기다리는 중입니다. 게임이 켜져 있으면 다음 달에 지도자로 합류합니다.','Waiting for the coming of age. They join our leaders next month while the game is running.'));d.append(p);
   if(c.adult.state==='applied'&&S.heirOk&&c.adult.lid&&!c.adult.heir)btn(L('후계자로 세우기','Name as heir'),async()=>{const r=await window.sllm.childHeir(c.id);if(await refreshAfter(r))childPanel(c.id);},d,'rooms-primary');
   if(c.adult.heir)d.append(el('p','nursery-note',L('후계자입니다.','This is the heir.')));
   else if(c.adult.heirWanted)d.append(el('p','nursery-note',L('지도자로 합류하면 바로 후계자로 세웁니다.','Will be named heir as soon as they join our leaders.')));
  }
  d.append(el('h4','',L('자라 온 기록','Growing up')));const ul=el('ul','nursery-log');for(const l of c.log)ul.append(el('li','',`${l.date} · ${l.text}`));if(!c.log.length)ul.append(el('li','',L('아직 기록이 없습니다.','Nothing yet.')));d.append(ul);
 }
 function grownPanel(){
  const d=api.modal(L('다 자란 아이들','Grown children'));if(!d)return;
  if(!S.grown.length){d.append(el('p','nursery-note',L('아직 성인이 된 아이가 없습니다.','No child has come of age yet.')));return;}
  const ul=el('ul','nursery-grown');for(const c of S.grown){const li=el('li');btn((c.star?'★ ':'')+c.name,()=>childPanel(c.id),li);
   if(c.civ)li.append(el('small','',L(` 민간인 ${c.civ.jobName}${c.civ.married?' · 기혼':''}${c.civ.dead?' · 고인':''} · 부모 ${c.ruler}, ${c.parent}`,` civilian ${c.civ.jobName}${c.civ.married?' · married':''}${c.civ.dead?' · deceased':''} · parents ${c.ruler}, ${c.parent}`)));
   else li.append(el('small','',L(` ${c.adult.on} 성인 · 부모 ${c.ruler}, ${c.parent}${c.adult.heir?' · 후계자':''}`,` came of age ${c.adult.on} · parents ${c.ruler}, ${c.parent}${c.adult.heir?' · heir':''}`)));ul.append(li);}d.append(ul);
 }
 // 성인 갈림길(2026-10-28 사용자 확정): 지도자로 임명 / 민간인으로 살게 하기. 최종 결정은 플레이어.
 const axisSel=(def)=>{const sel=el('select','nursery-sel');for(const [k,n] of AXIS){const o=el('option','',n());o.value=k;if(k===def)o.selected=true;sel.append(o);}sel.setAttribute('aria-label',L('지도자 직업','Leader class'));return sel;};
 function crossBox(c){
  const box=el('section','nursery-event nursery-cross');
  box.append(el('strong','',L('성인이 되었습니다 — 어떤 길을 가게 할까요?','Come of age — which path should they take?')));
  box.append(el('p','',L(`${c.name}은(는) ${c.wishText}이(가) 되고 싶어 합니다.`,`${c.name} wants to become ${c.wishText}.`)+' '+(c.wishLeader?L('지도자의 길을 바라는 쪽입니다.','They lean toward a leader’s path.'):L('민간인의 삶을 바라는 쪽입니다.','They lean toward a civilian life.'))));
  const a=el('div','nursery-cross-row');a.append(el('b','',L('지도자로 임명','Appoint as a leader')));const as=axisSel(c.study||c.cross.lead);a.append(as);
  btn(L('지도자로','Make a leader'),async()=>{const r=await window.sllm.childCross(c.id,'leader',as.value);if(await refreshAfter(r))childPanel(c.id);},a,'rooms-primary');
  a.append(el('small','',L('게임의 지도자 수에 잡힙니다(통합력 유지비).','Counts toward the game’s leader cap (unity upkeep).')));
  const v=el('div','nursery-cross-row');v.append(el('b','',L('민간인으로 살게 하기','Let them live as a civilian')));
  const js=el('select','nursery-sel');js.setAttribute('aria-label',L('직업','Job'));for(const j of c.cross.jobs){const o=el('option','',(j.fits?'★ ':'')+j.name);o.value=j.key;if(j.key===c.cross.job)o.selected=true;js.append(o);}v.append(js);
  btn(L('민간인으로','Civilian life'),async()=>{const r=await window.sllm.childCross(c.id,'civ',js.value);if(await refreshAfter(r))childPanel(c.id);},v,'rooms-primary');
  v.append(el('small','',L('지도자 수에 잡히지 않습니다. ★는 아이의 희망에 맞는 직업입니다. 나중에 언제든 지도자로 불러들일 수 있습니다.','Not counted as a leader. ★ marks jobs that fit their wish. You can call them up as a leader at any time.')));
  box.append(a,v,el('small','nursery-note',L('희망과 다른 길을 고르면 아이가 서운해합니다(이야기에만 남습니다).','Choosing against their wish leaves them hurt (story only).')));
  return box;
 }
 function civBox(c){
  const box=el('section','nursery-civ');const v=c.civ;
  box.append(el('strong','',L(`민간인 · ${v.jobName}`,`Civilian · ${v.jobName}`)));
  box.append(el('p','',[L(`${v.on}부터`,`Since ${v.on}`),v.married?L(`배우자 ${v.married}`,`Married to ${v.married}`):'',v.dead?L('고인','Deceased'):''].filter(Boolean).join(' · ')));
  if(!v.dead){
   const row=el('div','nursery-cross-row');const as=axisSel(v.lead);row.append(as);
   btn(L('지도자로 임명','Appoint as a leader'),async()=>{const r=await window.sllm.childRecall(c.id,as.value);if(await refreshAfter(r))childPanel(c.id);},row,'rooms-primary');
   row.append(el('small','',L('추천 직업은 하던 일에 맞춘 것입니다. 이때부터 지도자 수에 잡힙니다.','The suggested class fits their work. From then on they count as a leader.')));
   box.append(row);
   if(S.heirOk)btn(L('후계자로 세우기(궁으로 불러들임)','Name as heir (call back to the palace)'),async()=>{const r=await window.sllm.childHeir(c.id);if(await refreshAfter(r))childPanel(c.id);},box);
  }
  return box;
 }
 async function talk(id){
  const c=cur(id);if(!c)return;const d=api.modal(L(`${c.name} · 대화`,`Talking with ${c.name}`));if(!d)return;d.classList.add('nursery-talk');
  const focus=el('div','nursery-focus-art');focus.setAttribute('aria-hidden','true');
  const portrait=el('img','nursery-focus-portrait');portrait.alt='';portrait.draggable=false;
  const g=c.gender==='f'?'f':'m',st=c.stage==='child'?'child':'teen'; // 대화 그림: 고른 초상화 → talk-<단계> → sil-<단계>
  const tries=[c.face,base+`talk-${st}-${g}-${buildOf(c)}.webp`,base+`sil-${st}-${g}-${buildOf(c)}.webp`].filter(Boolean);let ti=0;
  if(c.face)focus.classList.add('has-face');
  portrait.onerror=()=>{ti++;if(ti<tries.length)portrait.src=tries[ti];else portrait.onerror=null;};
  portrait.src=tries[0];focus.append(portrait);d.append(focus);

  const log=el('div','nursery-lines');const form=el('form','nursery-say');const inp=el('textarea');inp.rows=2;inp.maxLength=500;inp.placeholder=L('할 말','Say something');inp.setAttribute('aria-label',inp.placeholder);
  const send=el('button','rooms-primary',L('말하기','Say'));send.type='submit';form.append(inp,send);
  const end=btn(L('대화 마치기','End the talk'),async()=>{end.disabled=send.disabled=true;const r=await window.sllm.childTalkEnd(id);api.closeDialog(true);await refreshAfter(r);},null);
  const conversation=el('div','nursery-conversation');conversation.append(log,form,end);d.append(conversation);
  const line=(who,t)=>{d.dataset.speaker=who;log.append(el('p',who==='me'?'me':'them',t));log.scrollTop=log.scrollHeight;};
  send.disabled=true;const r=await window.sllm.childTalkOpen(id);if(api.dialog()!==d)return;
  if(!r.ok){line('them',r.error);return;}for(const l of r.lines)line(l.who,l.text);if(r.error)api.message(r.error);send.disabled=false;
  form.onsubmit=async e=>{e.preventDefault();const t=inp.value.trim();if(!t)return;send.disabled=true;line('me',t);inp.value='';const x=await window.sllm.childTalkSay(id,t);if(api.dialog()!==d)return;send.disabled=false;if(x.ok)line('them',x.reply);else api.message(x.error);};
 }
 window.SLLMNursery={draw,babyObject,pick:id=>{sel=id;}};
})();
