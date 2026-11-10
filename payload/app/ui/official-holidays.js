(() => {
 const L=(k,e)=>window.SLLMI18n?.pick?window.SLLMI18n.pick(k,e):k;
 const h=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const labels={unknown:()=>L('아직 확인하지 않음','Not checked'),pending:()=>L('응답 미확인 · 준비 상태 확인을 눌러 주세요','Unconfirmed · check preparation status'),paid:()=>L('준비비 지출 확인됨','Preparation payment confirmed'),short:()=>L('예산 부족 · 올해 행사 취소','Insufficient resources · this year cancelled'),cancelled:()=>L('올해 행사 취소됨 · 환불 없음','This year cancelled · no refund'),unprepared:()=>L('준비 전','Not prepared'),stale:()=>L('게임 날짜가 변경되었습니다','Game date changed')};
 window.mountOfficialHolidays=async host=>{
  let state,busy=false;const root=h('section');root.className='ne-event';host.append(root);
  const btn=(text,fn)=>{const b=h('button',text);b.type='button';b.onclick=fn;return b;};
  const notice=h('p');notice.setAttribute('role','status');
  async function run(fn){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);try{const r=await fn();if(!r?.ok)throw Error(r?.error||L('처리하지 못했습니다.','Could not complete the operation.'));state=r.state;if(root.isConnected)draw();}catch(e){notice.textContent=String(e.message||e);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  function draw(){const grid=host.querySelector('.ne-calendar');if(grid){grid.querySelectorAll('.ne-official-holiday').forEach(x=>x.remove());for(const item of state.items.filter(x=>x.month===Number(grid.dataset.month))){const mark=h('small',L('공인기념일','Official holiday')+' · '+item.name);mark.className='ne-official-holiday';grid.firstElementChild?.append(mark);}for(const r of (state.reserved||[]).filter(x=>x.month===Number(grid.dataset.month))){const mark=h('small',r.name);mark.className='ne-official-holiday';grid.firstElementChild?.append(mark);}}root.replaceChildren(h('h3',L('공인기념일','Official holidays')),notice);notice.textContent='';
   root.append(h('p',L('준비비: 에너지 150 · 광물 100 · 식량 300. 취소해도 환불되지 않습니다. 건국기념식의 안정도 보너스와는 별개입니다.','Preparation: 150 energy · 100 minerals · 300 food. No refund on cancellation. Separate from the founding ceremony stability bonus.')));
   root.append(h('p',L('현재 달 또는 이미 지난 달로 제정·날짜 변경 시 첫 행사는 다음 해부터입니다.','New dates in the current or a past month first take effect next year.')));
   const auto=h('input');auto.type='checkbox';auto.checked=state.autoSpend;auto.onchange=()=>run(()=>window.sllm.holidayChange(state.session,state.revision,'auto',auto.checked));const label=h('label');label.className='ne-toggle';label.append(auto,document.createTextNode(L(' 월이 바뀌면 자동으로 준비비 지출 (설정 변경 시 소급 지출 없음)',' Spend preparation costs automatically when a new month arrives (no retroactive spending)')));const add=btn(L('기념일 제정','Establish holiday'),()=>edit());add.className='ne-primary';root.append(label,add);
   // 사교회(29 확정): 매년 의무 개최 고정 항목. 월만 바꿀 수 있고 삭제·중지 없음. 올해 이미 열렸으면 다음 해부터.
   for(const r of state.reserved||[]){const card=h('section');card.className='ne-holiday ne-fixed';card.append(h('h4',`${r.month} · ${r.name}`),h('p',L('해마다 지도자들이 모이는 의무 행사입니다(식량 20). 삭제하거나 쉴 수 없고 개최 월만 바꿀 수 있습니다. 올해 행사가 이미 열렸으면 바뀐 달은 내년부터입니다.','A mandatory yearly gathering of your leaders (food 20). It cannot be abolished or paused; only the month can change. If this year\'s gathering already opened, the new month applies from next year.')));
    const row=h('div');row.className='ne-controls';const sel=h('select');for(let n=1;n<=12;n++){const o=h('option',String(n));o.value=n;sel.append(o);}sel.value=r.month;sel.setAttribute('aria-label',L('사교회 개최 월','Gathering month'));
    row.append(sel,btn(L('월 바꾸기','Change month'),()=>run(async()=>{const x=await window.sllm.socialSetMonth(Number(sel.value));if(!x?.ok)return x;return window.sllm.holidayState();})));card.append(row);root.append(card);}
   for(const item of [...state.items].sort((a,b)=>a.month-b.month)){
    const card=h('section');card.className='ne-holiday'+(item.enabled?'':' ne-paused');const img=h('img');img.className='ne-holiday-art';img.src=`assets/holidays/${item.art}.webp`;img.alt='';card.append(img,h('h4',`${item.month} · ${item.name}`),h('p',item.text),h('small',L(`첫 행사: ${item.firstYear}년`, `First ceremony: ${item.firstYear}`)));
    card.append(h('p',item.enabled?L('활성','Active'):L('중지 · 월 점유 유지','Paused · month reserved')));
    const row=h('div');row.className='ne-controls';const abolish=btn(L('폐지','Abolish'),()=>{if(confirm(L('기념일을 폐지할까요? 이미 지출한 준비비는 환불되지 않습니다.','Abolish this holiday? Preparation costs will not be refunded.')))run(()=>window.sllm.holidayChange(state.session,state.revision,'delete',{id:item.id}));});abolish.className='ne-danger';row.append(btn(L('수정','Edit'),()=>edit(item)),abolish);
    if(item.month===state.month&&item.firstYear<=state.year){const status=state.statuses[item.id]||'unknown';card.append(h('p',(labels[status]||labels.unknown)()));row.append(btn(L('준비 상태 확인','Check preparation status'),()=>run(()=>window.sllm.holidayPrepare(state.session,item.id,'query'))));if(item.enabled&&['unknown','unprepared'].includes(status))row.append(btn(L('준비비 지출','Pay preparation costs'),()=>{if(confirm(L('에너지 150·광물 100·식량 300을 지출할까요?','Spend 150 energy, 100 minerals and 300 food?')))run(()=>window.sllm.holidayPrepare(state.session,item.id,'prepare'));}));row.append(btn(L('올해 행사 취소','Cancel this year'),()=>{if(confirm(L('올해 행사만 취소할까요? 준비비는 환불되지 않고 기념일은 유지됩니다.','Cancel only this year? Costs are not refunded and the holiday remains.')))run(()=>window.sllm.holidayPrepare(state.session,item.id,'cancel'));}));}card.append(row);root.append(card);
   }
   const history=h('details');history.append(h('summary',L('최근 처리 기록','Recent activity')));for(const x of state.history.slice(-12).reverse())history.append(h('p',`${x.date} · ${state.items.find(y=>y.id===x.id)?.name||L('기념일 관리','Holiday management')} · ${x.status?(labels[x.status]||labels.unknown)():L('설정 변경','Settings changed')}`));root.append(history);
  }
  function edit(item){draw();const form=h('form');form.className='ne-holiday-form';
   const name=h('input');name.maxLength=120;name.value=item?.name||'';name.required=true;
   const month=h('select');for(let n=1;n<=12;n++){const o=h('option',String(n));o.value=n;month.append(o);}month.value=item?.month||state.month;
   const text=h('textarea');text.maxLength=5000;text.rows=4;text.value=item?.text||'';
   const art=h('select');for(const [value,k,en] of [['festival','축제','Festival'],['mourning','엄숙한 애도','Solemn remembrance'],['annual','연례 기념','Annual commemoration']]){const o=h('option',L(k,en));o.value=value;art.append(o);}art.value=item?.art||'festival';
   const enabled=h('input');enabled.type='checkbox';enabled.checked=item?.enabled??true;
   for(const [caption,en,field] of [['이름','Name',name],['월','Month',month],['제정문','Proclamation',text],['그림','Artwork',art],['활성','Active',enabled]]){const lab=h('label',L(caption,en));lab.className='ne-field';lab.append(field);form.append(lab);}
   const save=h('button',L('저장','Save'));save.type='submit';save.className='ne-primary';form.append(save,btn(L('돌아가기','Back'),draw));form.onsubmit=e=>{e.preventDefault();run(()=>window.sllm.holidayChange(state.session,state.revision,'save',{id:item?.id,name:name.value,month:Number(month.value),text:text.value,art:art.value,enabled:enabled.checked}));};root.append(form);name.focus();
  }
  await run(()=>window.sllm.holidayState());
 };
})();
