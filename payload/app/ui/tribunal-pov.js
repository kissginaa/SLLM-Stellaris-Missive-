// 은하재판소 1인칭 법정(2026-10-27 사용자: 「너무 게임 같다」 → 1인칭·전체 화면, 그림은 ChatGPT 로 따로 만든다).
// 대면 심리(route==='face') 동안만 이 무대를 덮어 보여 준다. 기자회견 화면은 그대로.
// 상태와 동작은 espionage.html 의 것을 그대로 쓴다: 입력칸(#text)·보내기(#say)·변호사(#lawyers)·결과(#result)·오류(#error)를 심리 동안만 무대로 옮겼다가 돌려 놓는다.
// 그림 칸(POV_ART, 2026-10-27 ChatGPT 그림을 WebP 로 줄임: 10MB → 0.7MB): 앞 파일이 없으면 다음 파일, 둘 다 없으면 CSS 로만 그린다. 새 그림은 assets/rooms/ 에 아래 이름으로 넣으면 된다.
const POV_ART={
 hall:['assets/rooms/tribunal-pov-hall-v1.webp','assets/rooms/tribunal-hall-v1.png'], // 1인칭 법정 배경(재판석·고발국 단상 자리·방청석 포함, 사람 없음)
 stand:['assets/rooms/tribunal-pov-stand-v1.webp','assets/rooms/tribunal-bench-v1.png'], // 고발국 단상 앞판(투명). 초상화 앞에 겹친다
 desk:['assets/rooms/tribunal-pov-desk-v1.webp'], // 내 변론대 앞쪽 가장자리(투명). 없으면 CSS 변론대
 bench:['assets/rooms/tribunal-bench-v1.png'], // 옛 배경일 때만 쓰는 재판석 그림
};
(()=>{
 const B=(ko,en)=>(typeof bi==='function'?bi(ko,en):ko);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const loadArt=(img,list,onDone)=>{let i=0;const next=()=>{if(i>=list.length){img.removeAttribute('src');onDone&&onDone(false);return;}const url=list[i++];img.onerror=next;img.onload=()=>{img.onerror=null;onDone&&onDone(url===list[0]);};img.src=url;};next();};
 let root,ui={},board=null,held=false,seen=null,caseKey='',queue=[],playing=false,skipTyping=null,verdictOpen=false,lawyerDismissed=false,homes=new Map(),lastView=null;
 const JUDGE='은하재판소',SELF='플레이어',REACT='국내외 반응';
 const isLawyer=(w)=>/변호사$/.test(w);
 function build(){
  root=el('div');root.id='fp';root.setAttribute('data-i18n-skip','');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  const bg=el('img','fp-bg');bg.alt='';loadArt(bg,POV_ART.hall,(pov)=>root.classList.toggle('has-pov',pov));
  const judge=el('div','fp-judge');const seats=el('div','fp-seats');seats.append(el('i'),el('i'),el('i'));
  const bench=el('img','fp-judge-bench');bench.alt='';loadArt(bench,POV_ART.bench);
  ui.judgeName=el('div','fp-judge-name');ui.judgeSub=el('div','fp-judge-sub');judge.append(ui.judgeName,ui.judgeSub,seats,bench);
  const acc=el('div','fp-accuser');ui.portrait=el('img','fp-portrait');ui.portrait.alt='';const stand=el('img','fp-stand');stand.alt='';loadArt(stand,POV_ART.stand);
  const plate=el('div','fp-plate');ui.accRole=el('small');ui.accName=el('b');plate.append(ui.accRole,ui.accName);acc.append(ui.portrait,stand,plate);
  ui.chips=el('div','fp-chips');
  ui.exhibit=el('div','fp-exhibit');ui.exNo=el('small');ui.exTitle=el('b');ui.exClaim=el('p');ui.exhibit.append(ui.exNo,ui.exTitle,ui.exClaim);
  ui.gallery=el('div','fp-gallery');
  const desk=el('div','fp-desk');const deskImg=el('img','fp-desk-img');deskImg.alt='';loadArt(deskImg,POV_ART.desk,(ok)=>root.classList.toggle('has-desk',ok));
  ui.controls=el('div','fp-controls');ui.turns=el('div','fp-turns');ui.turnLabel=el('span');ui.turnPips=el('span');ui.turns.append(ui.turnLabel,ui.turnPips);
  desk.append(deskImg,ui.controls);
  ui.dialogue=el('div','fp-dialogue');ui.who=el('div','who');ui.line=el('div','line');ui.more=el('div','more','▼');ui.more.hidden=true;ui.dialogue.append(ui.who,ui.line,ui.more);
  ui.dialogue.onclick=()=>{if(skipTyping){skipTyping();return;}if(!ui.more.hidden){ui.more.hidden=true;playing=false;playNext();}};
  ui.case=el('div','fp-case');
  const tools=el('div','fp-tools');ui.btnLog=el('button');ui.btnStakes=el('button');ui.btnExit=el('button','exit');[ui.btnLog,ui.btnStakes,ui.btnExit].forEach(b=>b.type='button');tools.append(ui.btnLog,ui.btnStakes,ui.btnExit);
  ui.btnLog.onclick=()=>toggleDrawer('log');ui.btnStakes.onclick=()=>toggleDrawer('stakes');ui.btnExit.onclick=exit;
  ui.drawer=el('aside','fp-drawer');ui.drawer.hidden=true;
  ui.lawyerWrap=el('div','fp-lawyer-wrap');ui.lawyerSkip=el('button','fp-lawyer-skip');ui.lawyerSkip.type='button';ui.lawyerSkip.onclick=()=>{lawyerDismissed=true;render(lastView);};
  ui.verdict=el('div','fp-verdict');ui.verdict.hidden=true;
  ui.end=el('div','fp-end');ui.end.hidden=true;const endCard=el('div','card');ui.endTitle=el('h2');ui.endSlot=el('div');const endBtns=el('div');ui.endLog=el('button','ghost');ui.endClose=el('button');[ui.endLog,ui.endClose].forEach(b=>b.type='button');
  ui.endLog.onclick=()=>toggleDrawer('log');ui.endClose.onclick=()=>window.sllm.espionageClose();endBtns.append(ui.endLog,ui.endClose);endCard.append(ui.endTitle,ui.endSlot,endBtns);ui.end.append(endCard);
  root.append(bg,el('div','fp-vignette'),judge,acc,ui.chips,ui.exhibit,ui.gallery,desk,ui.dialogue,ui.case,tools,ui.lawyerWrap,ui.drawer,ui.verdict,ui.end);
  ui.judge=judge;ui.acc=acc;ui.desk=desk;
  document.body.append(root);
  document.addEventListener('keydown',(e)=>{if(!document.body.classList.contains('in-hearing'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!ui.drawer.hidden){ui.drawer.hidden=true;return;}if(verdictOpen){closeVerdict();return;}exit();}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&document.activeElement?.id==='text'){e.preventDefault();document.getElementById('say')?.click();}},true);
 }
 // 기존 칸을 무대로 옮기고(심리 중) 돌려 놓는다(그 밖).
 function adopt(id,parent){const n=document.getElementById(id);if(!n)return;if(!homes.has(id)){const mark=document.createComment('fp:'+id);n.parentNode.insertBefore(mark,n);homes.set(id,mark);}if(n.parentNode!==parent)parent.append(n);}
 function release(){for(const [id,mark] of homes){const n=document.getElementById(id);if(n&&mark.parentNode&&n.previousSibling!==mark)mark.parentNode.insertBefore(n,mark.nextSibling);}}
 function exit(){const s=lastView?.state;if(s&&s.phase!=='finished'){const note=document.querySelector('.exit-note')?.textContent||'';if(!confirm(B('지금 퇴장하면 심리를 포기한 것으로 보고 최대 불이익을 받습니다. 퇴장할까요?','Leaving now forfeits the hearing with the maximum penalty. Leave anyway?')+(note?'\n\n'+note:'')))return;}window.sllm.espionageClose();}
 function speakerOf(w,s){if(w===JUDGE)return 'judge';if(w===SELF||isLawyer(w))return 'self';if(w===REACT)return 'react';if(w===s.incident.opponent)return 'accuser';return 'other';}
 function whoLabel(w){return typeof whoName==='function'?whoName(w):w;}
 function light(kind){ui.judge.classList.toggle('lit',kind==='judge');ui.acc.classList.toggle('lit',kind==='accuser');ui.desk.classList.toggle('lit',kind==='self');}
 function type(text,done){const full=String(text);ui.line.textContent='';ui.line.classList.add('caret');let i=0,timer=0;const fin=()=>{clearInterval(timer);ui.line.textContent=full;ui.line.classList.remove('caret');skipTyping=null;done();};
  const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce||full.length>900){fin();return;}
  skipTyping=fin;timer=setInterval(()=>{i+=2;ui.line.textContent=full.slice(0,i);ui.line.scrollTop=ui.line.scrollHeight;if(i>=full.length)fin();},22);}
 function show(entry,s,instant){const kind=speakerOf(entry.who,s);light(kind);ui.who.className='who '+kind;ui.who.textContent=whoLabel(entry.who);
  if(instant){ui.line.textContent=entry.text;ui.line.classList.remove('caret');ui.more.hidden=true;playing=false;return;}
  type(entry.text,()=>{ui.more.hidden=queue.length===0;if(queue.length===0){playing=false;release_hold();refreshEnd();}});}
 function murmur(text){for(const [n,part] of String(text).split('\n').filter(Boolean).slice(0,3).entries()){const m=el('div','fp-murmur',part);m.style.top=(n*30)+'%';m.style.animationDelay=(n*0.9)+'s';ui.gallery.append(m);setTimeout(()=>m.remove(),9000+n*900);}}
 function openVerdict(entry,s){const first=String(entry.text).split('\n')[0];const won=/플레이어 제국|Player empire/.test(first);const reason=String(entry.text).split('\n').slice(1).join('\n').trim();
  const ev=s.evidence.slice().reverse().find(e=>e.closed)||s.evidence[Math.max(0,s.current-1)];const idx=s.evidence.indexOf(ev);
  ui.verdict.replaceChildren();const card=el('div','card');card.append(el('div','strike'),el('div','gavel',B('판 결','RULING')),el('h2','',won?B('플레이어 제국 승','The player empire prevails'):B(`${s.incident.opponent} 승`,`${s.incident.opponent} prevails`)),
   el('div','ex',ev?B(`증거 ${idx+1}호 「${ev.title}」`,`Exhibit ${idx+1}: “${ev.title}”`):''),el('div','stamp '+(won?'won':'lost'),won?B('기 각','REJECTED'):B('채 택','ADMITTED')),el('div','reason',reason),el('div','hint',B('눌러서 계속','Click to continue')));
  ui.verdict.append(card);ui.verdict.hidden=false;verdictOpen=true;root.classList.add('dim');light('judge');ui.verdict.onclick=closeVerdict;}
 function closeVerdict(){ui.verdict.hidden=true;verdictOpen=false;root.classList.remove('dim');playing=false;playNext();}
 function playNext(){if(playing||verdictOpen)return;const s=lastView?.state;if(!s)return;const e=queue.shift();if(!e){release_hold();refreshEnd();return;}playing=true;
  if(e.who===REACT){murmur(e.text);playing=false;playNext();return;}
  if(e.who===JUDGE&&/^(승리|Winner):/.test(String(e.text))){playing=false;openVerdict(e,s);return;}
  show(e,s,false);}

 function renderBoard(){const s=board;if(!s)return;const key=s.incident.id;const cur=s.evidence[Math.min(s.current,s.evidence.length-1)];
  if(ui.exhibit.dataset.key!==key+'|'+s.current){ui.exhibit.dataset.key=key+'|'+s.current;ui.exhibit.classList.remove('enter');void ui.exhibit.offsetWidth;ui.exhibit.classList.add('enter');}
  ui.exhibit.hidden=s.phase==='finished';ui.exNo.textContent=B(`증거 ${s.current+1}호`,`EXHIBIT ${s.current+1}`);ui.exTitle.textContent=cur?.title||'';ui.exClaim.textContent=cur?.claim||'';
  ui.chips.replaceChildren(...s.evidence.map((e,i)=>el('span',e.closed?(e.rebutted?'won':'lost'):i===s.current?'cur':'',e.closed?(e.rebutted?B(`${i+1}호 기각`,`#${i+1} rejected`):B(`${i+1}호 채택`,`#${i+1} admitted`)):i===s.current?B(`${i+1}호 심리 중`,`#${i+1} in session`):B(`${i+1}호 대기`,`#${i+1} pending`))));
  const left=cur&&!cur.closed&&s.phase!=='finished'?3-cur.turns:0;ui.turnLabel.textContent=s.phase==='finished'?'':B('남은 발언','Statements left');ui.turnPips.replaceChildren(...[0,1,2].map(i=>el('i',i<left?'':'off')));ui.turnPips.hidden=s.phase==='finished';}
 function release_hold(){if(!held)return;held=false;board=lastView?.state||board;renderBoard();}
 function refreshEnd(){const s=lastView?.state;ui.end.hidden=!(s&&s.phase==='finished'&&!playing&&!verdictOpen&&queue.length===0);}
 function toggleDrawer(kind){if(!ui.drawer.hidden&&ui.drawer.dataset.kind===kind){ui.drawer.hidden=true;return;}ui.drawer.dataset.kind=kind;fillDrawer();ui.drawer.hidden=false;}
 function fillDrawer(){const v=lastView;if(!v||ui.drawer.hidden&&!ui.drawer.dataset.kind)return;const s=v.state,kind=ui.drawer.dataset.kind;ui.drawer.replaceChildren();const x=el('button','x','✕');x.type='button';x.onclick=()=>{ui.drawer.hidden=true;};ui.drawer.append(x);
  if(kind==='log'){ui.drawer.append(el('h3','',B('속기록','Transcript')));for(const l of s.log){const a=el('article',speakerOf(l.who,s));a.append(el('b','',whoLabel(l.who)),document.createTextNode(l.text));ui.drawer.append(a);}requestAnimationFrame(()=>{ui.drawer.scrollTop=ui.drawer.scrollHeight;});}
  else{ui.drawer.append(el('h3','',B('이 재판에 걸린 것','What is at stake')));const p=document.getElementById('progress')?.textContent||'';const h=document.getElementById('hint')?.textContent||'';const n=document.getElementById('notice')?.textContent||'';const ex=document.querySelector('.exit-note')?.textContent||'';for(const t of [p,h,n,ex])if(t)ui.drawer.append(el('p','',t));}}
 function render(v){if(!v?.state)return;lastView=v;if(!root)build();const s=v.state,on=s.route==='face'&&s.evidence.length>0;
  if(!on){release();return;}
  // 고정 문구(언어가 바뀌면 다시 씀)
  ui.judgeName.textContent=B('은 하 재 판 소','GALACTIC TRIBUNAL');ui.judgeSub.textContent=B('독립 심판 · 증거 심리','Independent bench · evidentiary hearing');
  ui.accRole.textContent=B('고발국','ACCUSER');ui.accName.textContent=s.incident.opponent;
  ui.btnLog.textContent=B('속기록','Transcript');ui.btnStakes.textContent=B('걸린 것','Stakes');ui.btnExit.textContent=B('퇴장','Leave');
  ui.endTitle.textContent=B('심 리 종 료','HEARING CONCLUDED');ui.endLog.textContent=B('속기록 보기','View transcript');ui.endClose.textContent=B('법정을 나선다','Leave the courtroom');
  ui.lawyerSkip.textContent=B('직접 변론하겠습니다','I will argue it myself');
  ui.case.replaceChildren(el('b','',s.incident.operation),document.createTextNode(B(`고발국 ${s.incident.opponent} · 증거는 각색 자료입니다`,`Accuser: ${s.incident.opponent} · the evidence is dramatized`)));
  if(typeof spyPortrait==='function')spyPortrait(ui.portrait,'arthropoid',s.incident.opponent);
  // 증거·남은 발언: 새 대사를 재생하는 동안에는 그 전 상태를 그대로 둔다(판결 전에 결과가 먼저 보이지 않게)
  const key=s.incident.id,cur=s.evidence[Math.min(s.current,s.evidence.length-1)];
  if(caseKey!==key){held=false;board=null;}
  if(caseKey===s.incident.id&&seen!==null&&s.log.length>seen&&board&&(board.current!==s.current||board.phase!==s.phase))held=true;
  if(!held)board=s;renderBoard();
  // 내 변론대: 입력칸·버튼·오류를 무대로
  adopt('text',ui.controls);adopt('say',ui.controls);ui.controls.append(ui.turns);adopt('busy',ui.turns);adopt('error',ui.controls);
  const t=document.getElementById('text');if(t)t.placeholder=B('반론을 적으세요. 그럴듯한 다른 설명이나 증거의 허점을 짚으면 됩니다. (Ctrl+Enter로 제출)','State your rebuttal: offer a plausible alternative or point out a gap in the evidence. (Ctrl+Enter to submit)');
  const say=document.getElementById('say');if(say)say.textContent=B('반론 제기','Rebut');
  // 변호사: 첫 발언 전에만
  adopt('lawyers',ui.lawyerWrap);if(!ui.lawyerSkip.parentNode)ui.lawyerWrap.append(ui.lawyerSkip);const law=document.getElementById('lawyers');ui.lawyerWrap.hidden=!law||law.hidden||lawyerDismissed;
  // 결과
  adopt('result',ui.endSlot);
  // 대사: 새로 생긴 기록만 차례로 재생. 처음 들어오면 마지막 대사만 바로 보여 준다.
  if(caseKey!==key){caseKey=key;seen=null;queue=[];playing=false;lawyerDismissed=false;}
  if(seen===null){seen=s.log.length;const lastSpeech=[...s.log].reverse().find(l=>l.who!==REACT)||s.log[0];show(lastSpeech,s,true);}
  else if(s.log.length>seen){queue.push(...s.log.slice(seen));seen=s.log.length;playNext();}
  else if(s.log.length<seen){seen=s.log.length;}
  // 기다리는 중
  ui.acc.classList.toggle('thinking',!!v.busy);if(v.busy&&!playing&&!verdictOpen){light('accuser');ui.who.className='who accuser';ui.who.textContent=s.incident.opponent;ui.line.textContent=(cur&&cur.turns===2)?B('고발국이 마지막 반론을 준비하고 있습니다. 이어서 재판부가 판결합니다…','The accuser is preparing a final reply. The bench will rule next…'):B('고발국 대표가 반론을 준비하고 있습니다…','The accuser’s delegate is preparing a reply…');ui.line.classList.add('caret');ui.more.hidden=true;}
  if(!ui.drawer.hidden)fillDrawer();
  refreshEnd();
 }
 // espionage.html 의 render() 끝에서 부르는 renderSpyScene 뒤에 이어 붙인다.
 const base=window.renderSpyScene;window.renderSpyScene=function(v){if(typeof base==='function')base(v);try{render(v);}catch(e){console.error('tribunal-pov',e);}};
 window.SLLMTribunalPov={render:(v)=>render(v),art:POV_ART};
})();
