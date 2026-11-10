(() => {
 const L=(k,e)=>window.SLLMI18n?.pick?window.SLLMI18n.pick(k,e):k;
 const h=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
 let state=null,panel=null,busy=false,month=1;const drafts=new Map();
 const button=(text,fn)=>{const b=h('button',text);b.type='button';b.onclick=fn;return b;};
 async function refresh(){try{state=await window.sllm.nationalState();draw()}catch(e){if(panel)panel.querySelector('.ne-error').textContent=String(e.message||e)}}
 async function action(e,mode,text=''){if(busy)return;busy=true;try{const r=await window.sllm.nationalAction(state.session,e.id,mode,text);if(!r?.ok)throw Error(r?.error||L('행사를 진행하지 못했습니다.','Could not proceed with the event.'));await refresh()}catch(err){panel.querySelector('.ne-error').textContent=String(err.message||err)}finally{busy=false}}
 function draw(){if(!panel||!state)return;panel.replaceChildren();
  const head=h('header');head.append(h('h2',L('국가 행사날','National Events')),button(L('닫기','Close'),()=>{panel.remove();panel=null}));panel.append(head,h('p',state.date||L('게임 세이브를 먼저 불러와 주세요.','Load a game save first.')),h('p','', 'ne-error'));
  if(!state.date)return;
  if(window.mountOfficialHolidays)void window.mountOfficialHolidays(panel);
  panel.append(h('p',state.month?L('건국기념일은 통치자가 바뀌어도 유지됩니다. 해당 월에 행사를 열 수 있습니다.','Your anniversary persists across rulers. Hold the ceremony during its month.'):L('건국기념일을 지정하시겠습니까?','Would you like to set your founding anniversary?')));
  const controls=h('div',undefined,'ne-controls'),mo=h('select'),day=h('select');
  for(let n=1;n<=12;n++){const o=h('option',String(n));o.value=n;mo.append(o)}for(let n=1;n<=30;n++){const o=h('option',String(n));o.value=n;day.append(o)}
  mo.value=state.month||1;day.value=state.day||1;mo.setAttribute('aria-label',L('월','Month'));day.setAttribute('aria-label',L('일','Day'));
  controls.append(h('span',L('건국기념일','Founding anniversary')),mo,h('span',L('월','Month')),day,h('span',L('일','Day')),button(L('날짜 저장','Save date'),async()=>{try{const r=await window.sllm.nationalSet(state.session,Number(mo.value),Number(day.value));if(!r?.ok)throw Error(L('날짜를 저장하지 못했습니다.','Could not save the date.'));month=Number(mo.value);await refresh()}catch(e){panel.querySelector('.ne-error').textContent=String(e.message||e)}}));panel.append(controls);
  const nav=h('div',undefined,'ne-controls');nav.append(button('‹',()=>{month=month===1?12:month-1;draw()}),h('b',L(`${month}월 달력`, `Month ${month}`)),button('›',()=>{month=month===12?1:month+1;draw()}));panel.append(nav);
  const grid=h('div',undefined,'ne-calendar');grid.dataset.month=String(month);for(let d=1;d<=30;d++){const cell=h('div',String(d),'ne-day');if(state.month===month&&state.day===d){cell.classList.add('ne-founding');cell.append(h('small',L('건국기념일','Founding Day')))}const year=Number(state.date.split('.')[0]);for(const e of state.events||[]){const p=e.date.split('.').map(Number);if(e.kind!=='founding'&&p[0]===year&&p[1]===month&&p[2]===d)cell.append(h('small',e.title))}grid.append(cell)}panel.append(grid);
  panel.append(h('p',L('경례와 연설의 보상은 같습니다. 건국기념식을 완료하면 연 1회, 6개월간 제국 전체 행성 안정도 +10%. 중도 종료·생략에는 보상이 없습니다.','Salute and speech grant the same reward. Complete the founding ceremony once per year for +10% stability on all empire planets for 6 months. Closing early or skipping gives no reward.')));
  const events=(state.events||[]).slice().reverse();if(!events.length)panel.append(h('p',L('예정된 행사가 없습니다. 취임·승리 신호를 받으면 여기에 표시됩니다.','No events yet. Inaugurations and confirmed victories will appear here.')));
  for(const e of events){const card=h('section',undefined,'ne-event');card.append(h('h3',e.title+' · '+e.name),h('small',e.date));
   if(e.available){const speech=h('textarea');speech.maxLength=16000;speech.rows=e.kind==='founding'?5:10;const draftKey=state.session+':'+e.id;speech.value=drafts.get(draftKey)??e.text??'';speech.oninput=()=>drafts.set(draftKey,speech.value);speech.placeholder=L('행사에서 표시할 글을 작성하거나 검토해 주세요.','Write or review the text for this ceremony.');speech.setAttribute('aria-label',L('기념 연설문','Ceremonial address'));const row=h('div',undefined,'ne-controls');
    if(e.kind==='founding')row.append(button(L('국민들과 함께 말없이 경례한다','Salute silently with the people'),()=>action(e,'salute')));
    else{if(e.kind==='inauguration')card.append(h('p',L('취임식을 진행하시겠습니까? 전임 통치자의 기록을 돌아보며 새 통치를 시작합니다.','Would you like to hold an inauguration? Reflect on the previous reign and welcome the new ruler.')));
     row.append(button(L('AI 내레이션 준비','Prepare AI narration'),async()=>{if(busy)return;busy=true;const token=state.session;panel.querySelector('.ne-error').textContent=L('기록을 바탕으로 내레이션을 작성하고 있습니다…','Preparing narration from the records…');try{const r=await window.sllm.nationalDraft(token,e.id);if(!r?.ok)throw Error(r?.error||L('글을 준비하지 못했습니다.','Could not prepare the narration.'));speech.value=r.text;drafts.set(draftKey,r.text);if(!panel)return;panel.querySelector('.ne-error').textContent='';}catch(err){if(panel)panel.querySelector('.ne-error').textContent=String(err.message||err)}finally{busy=false}}));}
    row.append(button(e.kind==='founding'?L('연설문 크레딧으로 진행','Present address as credits'):L('행사 시작','Begin ceremony'),()=>action(e,'speech',speech.value)),button(L('이번 행사는 생략한다','Skip this event'),()=>action(e,'skip')));card.append(speech,row)}
   else card.append(h('p',e.status==='done'?L('완료','Completed'):e.status==='skipped'?L('생략','Skipped'):L('행사 월을 기다리고 있습니다.','Waiting for the event month.')));
   if(e.reward==='pending')card.append(button(L('보너스 적용 다시 확인','Retry bonus confirmation'),()=>action(e,'retry')));
   if(e.reward==='applied')card.append(h('p',L('보너스 적용 확인됨','Bonus confirmed')));panel.append(card);
  }
 }
 async function open(){if(panel){await refresh();return}panel=h('section',undefined,'ne-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-label',L('국가 행사날','National Events'));document.body.append(panel);panel.append(h('p','', 'ne-error'));await refresh();month=Number(state?.date?.split('.')[1])||1;draw()}
 function build(){const after=document.getElementById('musicCall')||document.getElementById('spyCall');if(!after)return false;if(document.getElementById('nationalCall'))return true;const b=button('',open);b.className='ic';b.id='nationalCall';b.innerHTML='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="10" width="34" height="31" rx="3"/><path d="M7 20h34M16 6v9M32 6v9M15 27h5m8 0h5m-18 7h5m8 0h5"/></svg>';b.append(h('span',L('국가 행사날','National Events')));after.after(b);return true}
 document.addEventListener('DOMContentLoaded',()=>{let n=0;const timer=setInterval(()=>{if(build()||++n>30)clearInterval(timer)},100);setInterval(()=>{if(panel&&!busy&&!panel.contains(document.activeElement))refresh()},15000)});
 document.addEventListener('sllm-language',()=>{const b=document.querySelector('#nationalCall span');if(b)b.textContent=L('국가 행사날','National Events');if(panel)refresh()});
})();
