(() => {
  const catalog = window.SLLMCatalog || {};
  let lang = /^ko(?:-|$)/i.test(navigator.language) ? 'ko' : 'en'; // 기본 언어(ko·en). 언어 팩이면 'en'(빠진 문구는 영어)
  let dialect = null; // 단일 의식 말투(알파 11): [[RegExp, 글]] — 번역 뒤에 한 번 더 바꾼다(기계·군체 제국의 창). 같은 말에 두 번 들어가도 같은 결과가 나오게 짠다
  const dia = (s) => { if (!dialect) return s; let t = String(s); for (const [re, to] of dialect) t = t.replace(re, to); return t; };
  let code = lang, pack = null; // code = 실제 화면 언어(언어 팩 코드 포함), pack = {strings, patterns:[[RegExp, 글]]}(2026-10-18)
  const originals = new WeakMap(), attributes = new WeakMap();
  const protectedContent = 'script,style,textarea,input,[data-i18n-skip],#log,#gvLog,#hist,.mail-body,#chronBox,#gossipBox,#sheet,#subtitle,#rx,.tm-name,#nm,#sub,#curWho,#mediaPaperName,#mediaRadioName';
  function packText(s, key) {
    const en = catalog[key], hit = pack.strings[key] ?? (en ? pack.strings[en] : undefined);
    if (hit) return s.replace(s.trim(), hit);
    for (const [pattern, replacement] of pack.patterns) if (pattern.test(key)) return key.replace(pattern, replacement);
    return null;
  }
  function text(value) { return dia(textBase(value)); }
  function textBase(value) {
    if (lang !== 'en') return value;
    const s = String(value), key = s.trim().replace(/\s+/g,' ');
    if (pack) { const p = packText(s, key); if (p !== null) return p; }
    if (catalog[key]) return s.replace(s.trim(), catalog[key]);
    // Only UI phrases with bounded numeric placeholders, never arbitrary text replacement.
    const patterns = [
      [/^수신함 (\d+)$/, 'Inbox $1'], [/^수신 (\d+)채널$/, 'Receiving $1 channels'],
      [/^관계 (-?[\d.]+)$/, 'Relations $1'], [/^기억 \((\d+)\)$/, 'Memories ($1)'],
      [/^남은 발언 (\d+) \/ (\d+)$/, 'Turns remaining $1 / $2'], [/^(\d+) \/ (\d+)자$/, '$1 / $2 characters'],
      [/^다음 방송까지 (\d+)초$/, 'Next broadcast in $1 s'], [/^게임 날짜 ([\d.]+)$/, 'Game date $1'],
    ];
    for(const [pattern,replacement] of patterns)if(pattern.test(key))return key.replace(pattern,replacement);
    for(const [source,replacement] of (window.SLLMPatterns||[])){const pattern=new RegExp(source);if(pattern.test(key))return key.replace(pattern,replacement);}
    return s;
  }
  function localize(root) {
    if(root.nodeType===Node.TEXT_NODE){
      if(!root.parentElement || root.parentElement.closest(protectedContent))return;
      const old=originals.get(root), value=root.data;
      const original=old && value===old.rendered ? old.original : value;
      const rendered=text(original); originals.set(root,{original,rendered}); if(value!==rendered)root.data=rendered;
      return;
    }
    if(root.nodeType!==Node.ELEMENT_NODE && root.nodeType!==Node.DOCUMENT_NODE)return;
    if(root.nodeType===Node.ELEMENT_NODE){
      if(root.matches('script,style'))return;
      if(!root.closest('[data-i18n-skip]'))for(const name of ['title','placeholder','aria-label','alt']){
        const value=root.getAttribute(name); if(value===null)continue;
        const state=attributes.get(root)||{},old=state[name],original=old&&value===old.rendered?old.original:value,rendered=text(original);
        state[name]={original,rendered};attributes.set(root,state);if(value!==rendered)root.setAttribute(name,rendered);
      }
      if(root.matches('textarea'))return; // 입력 내용은 번역하지 않는다(placeholder·title 만)
    }
    for(const child of [...root.childNodes])localize(child);
  }
  let scheduled=false;
  let titleOrig=null,titleShown=null; // 창 제목(작업 표시줄·Alt+Tab)도 번역(2026-10-19). 창이 제목을 바꾸면 그 글을 새 원문으로 본다
  function localizeTitle(){const cur=document.title;if(cur!==titleShown)titleOrig=cur;const t=text(titleOrig||'');titleShown=t;if(cur!==t)document.title=t;}
  function refresh(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;localize(document.body);localizeTitle();document.documentElement.lang=code;});}
  // language() 는 예전처럼 'ko'|'en'(언어 팩이면 'en'). code() 가 실제 언어. pick(ko,en) 은 언어 팩 표까지 본다.
  const norm=(x)=>String(x).trim().replace(/\s+/g,' ');
  const pick=(ko,en)=>dia(pickBase(ko,en));
  const pickBase=(ko,en)=>{if(lang!=='en')return ko;if(pack){const k=norm(ko),p=pack.strings[k]??pack.strings[norm(en)];if(p)return p;for(const [re,to] of pack.patterns)if(re.test(k))return k.replace(re,to);}return en;};
  const setDialect=(rules)=>{const next=Array.isArray(rules)&&rules.length?rules:null;if(JSON.stringify(next&&next.map(([r,t])=>[String(r),t]))===JSON.stringify(dialect&&dialect.map(([r,t])=>[String(r),t])))return;dialect=next;refresh();document.dispatchEvent(new Event('sllm-language'));}; // 바뀔 때만 다시 그린다
  window.SLLMI18n={t:text,language:()=>lang,code:()=>code,pick,refresh,setDialect};
  function compile(p){
    if(!p||!p.strings)return null;
    const patterns=[];for(const [a,b] of (p.patterns||[])){try{patterns.push([new RegExp(a),b]);}catch(e){/* 메인에서 이미 검사함 */}}
    return {strings:p.strings,patterns};
  }
  function options(el,s){ // 언어 팩 선택지(켜진 애드온의 언어)를 고정 선택지(자동·한국어·English) 뒤에 붙인다
    for(const o of [...el.querySelectorAll('option[data-pack]')])o.remove();
    const list=[...(s.languages||[])];
    if(s.language&&!['auto','ko','en'].includes(s.language)&&!list.some(x=>x.code===s.language))list.push({code:s.language,name:s.language+' (—)'});
    for(const x of list){const o=document.createElement('option');o.value=x.code;o.textContent=x.name;o.dataset.pack='1';o.setAttribute('data-i18n-skip','');el.appendChild(o);}
  }
  const set=(s)=>{
    code=s.effectiveLanguage||(s.language==='ko'||s.language==='en'?s.language:code);
    lang=s.baseLanguage||(code==='ko'?'ko':'en');
    pack=code!=='ko'&&code!=='en'&&s.languagePack&&s.languagePack.code===code?compile(s.languagePack):null;
    refresh();document.dispatchEvent(new Event('sllm-language'));
    const el=document.getElementById('language');if(el){options(el,s);el.value=s.language||'auto';}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label','alt']});
    window.sllm.getSettings().then(set);window.sllm.onLanguageChanged(set);
    const el=document.getElementById('language');if(el)el.onchange=()=>window.sllm.setLanguage(el.value).then(set);
    refresh();
  });
})();
