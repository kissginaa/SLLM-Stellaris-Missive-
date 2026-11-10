(() => {
 if(window.SLLM_FB)return; // 타국 만찬은 banquet-foreign.js 가 같은 화면을 쓴다(2026-10-23)
 const get=id=>document.getElementById(id);let busy=false,ended=false,last=null,ME='';
 // 플레이어 통치자 이름(2026-10-18: 「나」 대신)
 if(window.sllm.playerRuler)window.sllm.playerRuler().then(n=>{ME=n||'';if(last)render(last);},()=>{});
 // 만찬 자원 선물(알파 6): 대화에서 뽑은 제안 → 확인 카드(자원·양 수정 가능) → 게임 창고 확인 → [보내기]를 눌러야 적용
 const RES={energy:'에너지',minerals:'광물',food:'식량',alloys:'합금',consumer_goods:'소비재'};
 const ST={sent:'전달 확인',short:'창고 부족',uncertain:'확인 안 됨',no_target:'상대 없음',duplicate:'중복',demo:'시연'};
 const HINT={ok:'상대가 부족한 자원 · 호의 +1',small:'100 미만은 호의 없이 감사 인사만',not_short:'상대가 부족하지 않은 자원 · 감사 인사만',already:'이 만찬의 선물 호의는 이미 받았습니다',full:'이 만찬의 호의 상한(5)에 닿았습니다'};
 const RAR={exceptional:'탁월',epic:'에픽',rare:'희귀',common:'일반'};
 const SST={sent:'전달 확인',give_failed:'전달 거부',not_owned:'보유 안 함',cant_receive:'받을 수 없음',no_target:'상대 없음',duplicate:'중복',uncertain:'확인 안 됨'};
 const isEn=()=>!!(window.SLLMI18n&&window.SLLMI18n.language&&window.SLLMI18n.language()==='en'); // i18n-data: 표본 이름은 한/영 자료 중 고름
 const PK=(k,e)=>(window.SLLMI18n&&window.SLLMI18n.pick?window.SLLMI18n.pick(k,e):k); // 한/영(언어 팩 호환, 2026-10-19 영어 검수)
 const span=(t,c)=>{const s=document.createElement('span');if(c)s.className=c;s.textContent=t;return s;};
 function renderGift(g){
  const card=get('giftCard');if(!card||!g)return;
  const o=g.offer;card.hidden=!o;get('giftOpen').hidden=!!o;
  if(!o)return;
  const resEl=get('giftRes'),amtEl=get('giftAmt'),sh=g.short||[];
  if(document.activeElement!==resEl)resEl.value=o.res;
  if(document.activeElement!==amtEl)amtEl.value=String(o.amt);
  [...resEl.options].forEach(op=>{op.className=sh.includes(op.value)?'short':'';});
  const hint=get('giftHint');hint.textContent=g.hint&&HINT[g.hint]?HINT[g.hint]:'';hint.className=g.hint==='ok'?'good':'';
  const c=g.check,match=c&&c.res===o.res&&c.amt===o.amt,note=get('giftNote');
  note.textContent=match?c.note:(g.demo?'':'창고 확인 중…');note.className=match&&c.ok===false?'bad':'';
  get('giftSend').disabled=busy||g.busy||!(g.demo||(match&&c.ok===true));get('giftCancel').disabled=!!g.busy;
 }
 // 표본 선물 카드(수집품 2단계): 희귀도 보상 안내 → 게임 확인 → [보내기]
 let specSent=0;
 function renderSpec(p){
  const card=get('specCard');if(!card||!p)return;const o=p.offer;card.hidden=!o;if(!o)return;
  get('specName').textContent=isEn()?o.en:o.ko;const r=get('specRar');r.textContent=RAR[o.rarity]||o.rarity;r.className='rar r-'+o.rarity;
  const h=get('specHint');h.replaceChildren();h.className=o.favor>0?'good':'';
  if(o.asked)h.append(span('요구받은 표본 · 보상 한 단계 상승 · '));
  if(o.favor>0)h.append(span(PK('호의 +','Favor +')+o.favor));else h.append(span('만찬 호의 상한(5)에 닿아 호의 없음'));
  if(o.opinion)h.append(span(' · '),span(o.opinion==='large'?'관계 크게 상승':'관계 소폭 상승'));
  const c=p.check,match=c&&c.key===o.key,n=get('specNote');n.textContent=match?c.note:(p.demo?'':'게임에서 확인 중…');n.className=match&&c.ok===false?'bad':'';
  get('specSend').disabled=p.busy||!(p.demo||(match&&c.ok===true));get('specCancel').disabled=!!p.busy;
 }
 // 지도자 역요구 카드(수집품 3단계): 지도자가 먼저 달라고 한 표본 → [주기](표본 확인 카드로) / [거절]
 function renderAsk(p){
  const card=get('askCard');if(!card)return;const a=p&&p.ask,off=p&&p.offer;const show=!!a&&a.status==='pending'&&!(off&&off.key===a.key);card.hidden=!show;if(!show)return;
  get('askName').textContent=isEn()?a.en:a.ko;const r=get('askRar');r.textContent=RAR[a.rarity]||a.rarity;r.className='rar r-'+a.rarity;
  const h=get('askHint');h.replaceChildren(span('지도자가 먼저 요구한 표본 · 보상이 한 단계 올라갑니다'));h.className='good';
  get('askGive').disabled=!!p.busy;get('askRefuse').disabled=!!p.busy;
 }
 function render(s){last=s;busy=!!s.busy;ended=!!s.ended;get('chatTitle').textContent=(s.guest?.ruler||s.guest?.name||PK('초청 지도자','Invited leader'))+PK(` · 발언 ${s.turns||0}/${s.limit||10} · 호의 적립 ${s.favors||0}/5`,` · Remarks ${s.turns||0}/${s.limit||10} · Favor earned ${s.favors||0}/5`);const log=get('chatLog');log.replaceChildren();
  if(!s.lines.length){const p=document.createElement('p');p.className='muted';p.textContent='첫 발언으로 대화를 시작하세요.';log.append(p);}
  for(const line of s.lines){const card=document.createElement('article');card.className='banquet-message '+line.who;const who=document.createElement('b');who.textContent=line.who==='player'?(ME||s.host?.ruler||'나'):s.guest?.ruler||s.guest?.name||'초청 지도자';if(line.who==='player'&&ME)who.setAttribute('data-i18n-skip','');const text=document.createElement('div');text.textContent=line.text;card.append(who,text);log.append(card);}
  for(const g of (s.gift&&s.gift.sent)||[]){const r=document.createElement('div');r.className='gift-receipt '+g.status;r.append(span('🎁'),span(RES[g.res]||g.res),span(String(g.amt),'n'),span(ST[g.status]||g.status,'st'));if(g.favor)r.append(span('호의 +1','fv'));log.append(r);}
  for(const g of (s.spec&&s.spec.sent)||[]){const r=document.createElement('div');r.className='gift-receipt spec '+(g.status==='sent'?'sent':g.status);const nm=span(isEn()?g.en:g.ko,'n');nm.setAttribute('data-i18n-skip','');r.append(span('🏛'),span(RAR[g.rarity]||g.rarity,'rar r-'+g.rarity),nm,span(SST[g.status]||g.status,'st'));if(g.favor)r.append(span(PK('호의 +','Favor +')+g.favor,'fv'));if(g.opinion)r.append(span(g.opinion==='large'?'관계 크게 상승':'관계 소폭 상승','fv'));log.append(r);}
  {const k=s.spec&&s.spec.ask;if(k&&k.status==='refused'){const r=document.createElement('div');r.className='gift-receipt spec refused';const nm=span(isEn()?k.en:k.ko,'n');nm.setAttribute('data-i18n-skip','');r.append(span('🏛'),span(RAR[k.rarity]||k.rarity,'rar r-'+k.rarity),nm,span('요구 거절','st'),span(k.trust==='cut'?'신뢰 −30':k.trust==='none'?'손해 없음':'신뢰 변화 확인 못함','fv'));log.append(r);}}
  const ns=((s.spec&&s.spec.sent)||[]).length;if(ns!==specSent){specSent=ns;if(window.SLLMArchive)window.SLLMArchive.refresh();}
  get('chatBusy').textContent=busy?'초청 지도자가 답변을 준비하고 있습니다…':ended?s.favorNote||'10회 만찬 대화를 마쳤습니다.':'';get('chatSend').disabled=busy||ended||!!s.locked;get('chatInput').disabled=busy||ended;
  renderGift(s.gift);renderSpec(s.spec);renderAsk(s.spec);requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight;});
 }
 async function send(){if(busy||ended)return;const input=get('chatInput'),text=input.value.trim();if(!text)return;busy=true;get('chatSend').disabled=true;get('chatError').textContent='';try{const r=await window.sllm.banquetSay(text);if(!r.ok)get('chatError').textContent=r.error;else input.value='';}catch(e){get('chatError').textContent=String(e);}finally{busy=false;get('chatSend').disabled=ended||!!last?.locked;}}
 async function setGift(){get('chatError').textContent='';try{const r=await window.sllm.banquetGiftSet(get('giftRes').value,get('giftAmt').value);if(r&&r.error)get('chatError').textContent=r.error;}catch(e){get('chatError').textContent=String(e);}}
 get('chatSend').onclick=send;get('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey&&!e.isComposing){e.preventDefault();void send();}});
 if(get('giftCard')){
  get('giftOpen').onclick=()=>{const sh=(last&&last.gift&&last.gift.short)||[];get('giftRes').value=sh[0]||'energy';get('giftAmt').value='100';void setGift();};
  get('giftRes').onchange=setGift;get('giftAmt').addEventListener('change',setGift);get('giftAmt').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();get('giftAmt').blur();}});
  get('giftCancel').onclick=()=>{void window.sllm.banquetGiftCancel();};
  get('giftSend').onclick=async()=>{get('giftSend').disabled=true;get('chatError').textContent='';const m=get('giftMsg');m.textContent='';
   try{const r=await window.sllm.banquetGiftSend();const ms=(r&&r.messages)||[];m.replaceChildren(...ms.map(t=>span(t)));if(r&&!r.ok&&r.error&&!ms.includes(r.error))get('chatError').textContent=r.error;}catch(e){get('chatError').textContent=String(e);}};
 }
 if(get('askCard')){
  get('askGive').onclick=async()=>{get('chatError').textContent='';try{const k=last&&last.spec&&last.spec.ask&&last.spec.ask.key;if(!k)return;const r=await window.sllm.banquetSpecSet(k);if(r&&r.error)get('chatError').textContent=r.error;}catch(e){get('chatError').textContent=String(e);}};
  get('askRefuse').onclick=async()=>{get('askRefuse').disabled=true;get('chatError').textContent='';const m=get('giftMsg');m.textContent='';try{const r=await window.sllm.banquetSpecRefuse();const ms=(r&&r.messages)||[];m.replaceChildren(...ms.map(x=>span(x)));if(r&&!r.ok&&r.error&&!ms.includes(r.error))get('chatError').textContent=r.error;}catch(e){get('chatError').textContent=String(e);}};
 }
 if(get('specCard')){
  get('specCancel').onclick=()=>{void window.sllm.banquetSpecCancel();};
  get('specSend').onclick=async()=>{get('specSend').disabled=true;get('chatError').textContent='';const m=get('giftMsg');m.textContent='';
   try{const r=await window.sllm.banquetSpecSend();const ms=(r&&r.messages)||[];m.replaceChildren(...ms.map(t=>span(t)));if(r&&!r.ok&&r.error&&!ms.includes(r.error))get('chatError').textContent=r.error;}catch(e){get('chatError').textContent=String(e);}};
 }
 document.addEventListener('sllm-language',()=>{if(last)render(last);}); // 언어가 정해지면 표본 이름(한/영)을 다시 그린다
 window.sllm.onBanquetChat(render);window.sllm.banquetChatState().then(render).catch(e=>{get('chatError').textContent=String(e);});
})();
