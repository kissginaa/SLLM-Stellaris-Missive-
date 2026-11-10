import {app,BrowserWindow,ipcMain} from 'electron';
import { conversationOf } from '../aiclient';
import * as path from 'path';
import * as fs from 'fs';
import {ctx} from '../app/ctx';
import {settings} from '../app/settings';
import {safeSend} from '../safe-send';
import {logDiagnostic} from '../diagnostics';
import {randomUUID,createHash} from 'crypto';
import {spyPressResult} from '../espionage';
import {SpyState,newSpy,spyFixture,spyChoose,spyConsequences,spyMessages,parseSpyEvidence,parseSpyVerdict,advanceSpy,scriptedEvidence,withdrawSpy,SPY_TURNS_PER_EVIDENCE,spyPenaltyPlan,spyApplyCommand,spyLawyerFee,isSpyLawyer,spyCanHireLawyer,spyHireLawyer,spyLawyerCommand} from '../espionage';
import {link} from '../app/game-link';
import {LogRouter,SLOT} from '../app/log-router';
import {terminalRequest,terminalReplies,terminal} from './terminal';
import {chronNote} from './chronicle-app';
import { pick } from './settings-ui';
import { openScandalPress } from './press-app'; // 국내 기자회견 = 실제 인터뷰 화면(2026-10-20)
import { moodNudge } from './mood-app';
import { scenarioLocked } from './scenario-locks-app'; // 시나리오에서는 은하재판소를 치운다(2026-11-06)
const L = pick; // 한국어·영어·언어 팩(2026-10-19 영어 화면 점검)
export const espionage={win:null as BrowserWindow|null,state:null as SpyState|null,busy:false};
const view=()=>({state:espionage.state,busy:espionage.busy,effects:espionage.state?spyConsequences(espionage.state):null});
// 대면 심리(1인칭 법정, 2026-10-27 사용자)는 전체 화면. 기자회견·처음 안내는 창 그대로. 심리가 끝나도 창을 닫을 때까지 전체 화면을 유지한다.
export const spyWantsFullScreen=(s:SpyState|null):boolean=>!!s&&s.route==='face'&&s.evidence.length>0;
function syncFullScreen(){const w=espionage.win;if(!w||w.isDestroyed())return;const want=spyWantsFullScreen(espionage.state);if(w.isFullScreen()!==want)w.setFullScreen(want);}
const push=()=>{syncFullScreen();safeSend(espionage.win,'espionageState',view());};
const file=()=>path.join(app.getPath('userData'),'sllm_espionage_preview.json');
function commit(s:SpyState){const tmp=file()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({version:1,state:s},null,2),'utf8');fs.renameSync(tmp,file());espionage.state=s;}
function show(){if(espionage.win&&!espionage.win.isDestroyed()){espionage.win.show();espionage.win.focus();push();return;}
 const w=new BrowserWindow({width:1220,height:850,minWidth:850,minHeight:620,frame:false,backgroundColor:'#0c1622',webPreferences:{preload:path.join(__dirname,'..','preload.js')}});espionage.win=w;
 void w.loadFile(path.join(__dirname,'..','..','ui','espionage.html'));w.webContents.once('did-finish-load',push);w.on('close',()=>{if(espionage.state&&espionage.state.phase!=='finished'&&!espionage.state.pressing){commit(withdrawSpy(espionage.state));void applySpy();}});w.on('closed',()=>{if(espionage.win===w)espionage.win=null;});}
/** 끝난 심리의 제재를 게임에 건다. 실제 상대가 없는 시험 사건은 기록만. 한 사건에 한 번(cid), 응답이 없어도 다시 보내지 않는다. */
export async function applySpy():Promise<void>{
 const s=espionage.state;if(!s||s.phase!=='finished'||s.applied)return;
 const plan=spyPenaltyPlan(s),idx=s.incident.opponentIdx,sid=s.incident.sid;
 const set=(a:NonNullable<SpyState['applied']>,applied=s.gameApplied)=>{const cur=espionage.state;if(!cur||cur.incident.id!==s.incident.id)return;const n=structuredClone(cur);n.applied=a;n.gameApplied=applied;commit(n);push();};
 if(plan.output+plan.opinion===0){set({status:'none',message:L('게임에 걸 제재가 없습니다.', 'There is no sanction to apply in the game.'),output:0,opinion:0});return;}
 if(!idx||!sid){set({status:'not_game',message:L('시험 사건이라 게임에 적용하지 않았습니다.', 'Test incident, so nothing was applied to the game.'),...plan});return;}
 if(sid!==ctx.curSaveId||!ctx.gameRunning){set({status:'no_target',message:L('게임이 꺼져 있거나 세이브가 바뀌어 적용하지 않았습니다.', 'Not applied: the game is off or the save changed.'),...plan});return;}
 const cid=randomUUID().replace(/-/g,''),req=++link.reqCounter;
 // 보내기 전에 '보냄'으로 고정: 응답이 없어도 같은 제재를 두 번 걸지 않는다.
 set({status:'pending',message:L('게임 적용 요청을 보냈습니다.', 'Sent the request to the game.'),cid,...plan},true);
 try{
  const m=await terminalRequest(spyApplyCommand(req,sid,cid,idx,plan.output,plan.opinion),'SPYAPPLY',req);
  if(m.kv.cid!==cid||m.kv.sid!==sid)throw new Error(L('응답의 사건 번호가 다릅니다.', 'The reply\'s incident number does not match.'));
  const before=Number(m.kv.before),after=Number(m.kv.after),outOk=m.kv.out==='1';
  if(m.kv.status==='applied'){
   const parts=[plan.output?(outOk?L(`생산 −${9*plan.output}% (2년) 적용 확인`, `Output −${9*plan.output}% (2 years) confirmed`):L('생산 제재 부착 확인 실패', 'Could not confirm the output sanction')):'',plan.opinion?(Number.isFinite(before)&&Number.isFinite(after)?L(`상대 관계 ${before} → ${after} (−${100*plan.opinion}, 약 2년에 걸쳐 회복)`, `Their opinion ${before} → ${after} (−${100*plan.opinion}, recovers over about 2 years)`):L(`상대 관계 −${100*plan.opinion} 적용(수치 확인 못 함)`, `Their opinion −${100*plan.opinion} applied (value not confirmed)`)):''].filter(Boolean);
   const full=(!plan.output||outOk)&&(!plan.opinion||(Number.isFinite(after)&&after<before));
   set({status:full?'applied':'partial',message:L('게임 적용: ', 'Applied in game: ')+parts.join(' · '),cid,...plan,before,after},true);
   chronNote(idx,L(`첩보 공작 의혹 청문회 결과로 관계가 나빠졌다(관계 −${100*plan.opinion}${plan.output?`, 우리 생산 −${9*plan.output}%`:''})`,`Relations worsened after the hearing on suspected espionage (opinion −${100*plan.opinion}${plan.output?`, our output −${9*plan.output}%`:''})`));
  }else if(m.kv.status==='duplicate')set({status:'duplicate',message:L('이미 적용한 사건입니다. 다시 걸지 않았습니다.', 'This incident was already applied. Not applied again.'),cid,...plan},true);
  else if(m.kv.status==='no_target')set({status:'no_target',message:L('통신 가능한 상대를 찾지 못해 적용하지 않았습니다.', 'Not applied: no reachable counterpart found.'),cid,...plan},false);
  else set({status:'uncertain',message:L('적용 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다.', 'Could not confirm the result. It will not be resent automatically.'),cid,...plan},true);
  logDiagnostic('info','espionage.apply',{status:m.kv.status,idx,output:plan.output,opinion:plan.opinion});
 }catch(e){set({status:'uncertain',message:L('적용 결과를 확인하지 못했습니다. 자동 재전송하지 않습니다. (', 'Could not confirm the result. It will not be resent automatically. (')+String(e)+')',cid,...plan},true);logDiagnostic('warn','espionage.apply.failed',{error:String(e)});}
}
/** 실제 게임 사건으로 청문회 열기(2026-10-20 알파 9): 우리 비방 공작 의혹 보도(scandal-app), 공작원 연락 두절(agents-app).
 * 상대 제국이 해명을 요구한다 — 알림을 누르면 창이 열린다. 진행 중인 청문회가 있으면 새로 열지 않는다. 끝나면 기존 제재가 게임에 적용된다(applySpy). */
export function openGameHearing(o:{opponent:string;operation:string;facts:string[];key:string;idx?:number}):boolean{
 const sid=ctx.curSaveId;if(!sid||!o.opponent)return false;
 if(scenarioLocked('galcourt')){logDiagnostic('info','espionage.game_skip',{reason:'scenario'});return false;} // 회랑의 삼파전: 은하재판소 없음
 const cur=espionage.state;if(cur&&cur.phase!=='finished'){logDiagnostic('info','espionage.game_skip',{reason:'busy'});return false;}
 const id='game-'+o.key.slice(0,120);if(cur&&cur.incident.id===id)return false;
 const c=terminal.items.find(x=>x.name===o.opponent&&x.type==='default'),idx=o.idx||c?.idx||[...ctx.mailCountries].find(([,m])=>m.name===o.opponent)?.[0]||0;
 if(!idx){logDiagnostic('info','espionage.game_skip',{reason:'no_idx'});return false;}
 commit(newSpy({id,source:'game',detected:true,failed:false,attributed:true,opponent:o.opponent,operation:o.operation,facts:o.facts.slice(0,4),opponentIdx:idx,sid},'ai'));push();
 ctx.notify({kind:'hearing',title:L(`${o.opponent}이(가) 해명을 요구합니다 — ${o.operation}`,`${o.opponent} demands an explanation — ${o.operation}`),body:L('은하재판소 청문회에서 증거를 반박하거나, 국내 기자회견으로 넘기고 관계 하락을 받아들일 수 있습니다. 창을 닫으면 퇴장으로 간주됩니다.','Rebut the evidence before the Galactic Tribunal, or answer at home and accept the drop in relations. Closing the window counts as walking out.'),action:L('청문회 열기','Open the hearing')});
 logDiagnostic('info','espionage.game_open',{op:o.operation});return true;
}
/** 알림에서 청문회 창 열기 */
export function showHearing():void{if(espionage.state&&espionage.state.phase!=='finished')show();}
export function registerEspionage(router:LogRouter){
 router.on(SLOT.SPY_APPLY,'espionage:apply',m=>{if(m.kind==='SPYAPPLY'||m.kind==='SPYLAWYER')terminalReplies.get(m.kind+':'+m.kv.req)?.(m);});
 ipcMain.handle('devEspionage',async(_e,mode:unknown,tid:unknown)=>{try{if(!settings.devMode||!['scripted','ai'].includes(String(mode))||espionage.busy)throw new Error(L('개발자 모드와 진행 상태를 확인하세요.', 'Check developer mode and the current progress.'));
  const idx=Number(tid)||0;let incident=spyFixture();
  if(idx){const c=terminal.items.find(c=>c.idx===idx&&c.type==='default');if(!ctx.gameRunning||terminal.sid!==ctx.curSaveId||!c)throw new Error(L('게임을 켜고 연락처를 갱신한 뒤, 대상 번호에 통신 가능한 제국 번호를 넣으세요.', 'Start the game and refresh contacts, then enter a reachable empire number as the target.'));incident={...incident,id:'spy-game-test-'+Date.now(),opponent:c.name,opponentIdx:idx,sid:ctx.curSaveId,facts:['시험 사건(작전 내용은 가상) · 상대 제국은 실제 게임 제국입니다. 심리가 끝나면 제재가 게임에 적용됩니다.']};}
  commit(newSpy(incident,mode as 'scripted'|'ai'));show();return {ok:true,message:idx?L(`${incident.opponent} 상대로 청문회를 열었습니다. 끝나면 게임에 제재가 적용됩니다.`, `Opened a hearing against ${incident.opponent}. Sanctions are applied to the game when it ends.`):L('가상 발각 사건을 열었습니다. 실제 AI 모드는 API를 사용합니다.', 'Opened a test exposure incident. Real AI mode uses the API.')};}catch(e){return {ok:false,error:String(e)};}});
 ipcMain.handle('espionageState',()=>view());
 ipcMain.handle('espionageClose',(event)=>{if(event.sender!==espionage.win?.webContents)return false;espionage.win?.close();return true;});
 ipcMain.handle('espionageAction',async(event,action:unknown,input:unknown)=>{
  const s=espionage.state;
  if(event.sender!==espionage.win?.webContents||!s||espionage.busy||!(s.incident.source==='game'||(settings.devMode&&s.incident.source==='fixture')))return {ok:false,error:L('진행 가능한 사건이 없습니다.', 'No incident in progress.')}; // 실제 게임 사건은 개발자 모드 없이(2026-10-20)
  espionage.busy=true;push();
  try{
   let next:SpyState;
   if(action==='press'&&s.incident.source==='game'){ // 실제 사건의 국내 기자회견 = 언론사 인터뷰 화면(추문 한 주제와 같은 방식)
    if(s.phase!=='demand'||s.pressing)throw new Error(L('대응 방식을 이미 선택했습니다.', 'A response has already been chosen.'));
    const id=s.incident.id,inc=s.incident;
    const err=openScandalPress({sid:inc.sid||ctx.curSaveId||'',id,suspect:inc.opponent,date:ctx.gameDate,kind:'hearing',
     topic:{title:L(`${inc.operation} 의혹`,`The ${inc.operation} affair`),question:L(`${inc.opponent}이(가) 우리 정부의 ${inc.operation} 개입을 문제 삼고 있습니다. ${inc.facts[0]||''} 국민에게 어떻게 해명하시겠습니까?`,`${inc.opponent} accuses our government of involvement in ${inc.operation}. ${inc.facts[0]||''} How will you explain this to the public?`),source:L(`${inc.opponent}의 해명 요구`,`Demand from ${inc.opponent}`)},
     done:(good)=>{const cur=espionage.state;if(!cur||cur.incident.id!==id||cur.phase==='finished')return;commit(spyPressResult(cur,good));push();if(!good)moodNudge(-4,L('첩보 의혹 기자회견 실패','Espionage press conference fell flat'));void applySpy();}});
    if(err)throw new Error(err);
    next={...s,pressing:true,log:[...s.log,{who:'국내 기자회견',text:L('언론사 인터뷰 화면에서 국내 기자회견을 진행합니다. 끝나면 결과가 여기에 기록됩니다.','The domestic press conference is held in the press interview room. The result will be recorded here.')}]};
   }else if(action==='press'||action==='face'){
    if(s.phase!=='demand')throw new Error(L('대응 방식을 이미 선택했습니다.', 'A response has already been chosen.'));
    const evidence=action==='face'?(s.mode==='ai'?parseSpyEvidence(await ctx.ai.chat(spyMessages(s,'evidence'),{purpose:'espionage-evidence',json:true,maxTokens:1700,conversationId:conversationOf(s)})):scriptedEvidence()):[];
    next=spyChoose(s,action,evidence);
   }else if(action==='lawyer'){ // 은하 변호사(2026-10-27): 재판 시작 때 한 번, 비용은 실제 게임 사건이면 게임에서 낸다
    if(!isSpyLawyer(input))throw new Error(L('변호사를 골라 주세요.','Choose a lawyer.'));
    if(!spyCanHireLawyer(s))throw new Error(L('변호사는 재판을 시작할 때(첫 발언 전)만 선임할 수 있습니다.','A lawyer can only be hired at the start of the hearing (before the first statement).'));
    const lw=spyLawyerFee(input,s.evidence.filter(e=>!e.closed).length);
    if(lw.energy+lw.influence>0&&s.incident.source==='game'){
     const sid=s.incident.sid||'';if(!sid||sid!==ctx.curSaveId||!ctx.gameRunning)throw new Error(L('게임이 켜져 있어야 변호사 비용을 낼 수 있습니다.','The game must be running to pay the lawyer.'));
     const req=++link.reqCounter,mark=createHash('sha256').update(s.incident.id).digest('hex').slice(0,24);
     const st=(await terminalRequest(spyLawyerCommand(req,sid,mark,input,s.evidence.filter(e=>!e.closed).length),'SPYLAWYER',req)).kv.status;
     if(st==='short')throw new Error(L(`자원이 모자랍니다(에너지 ${lw.energy} · 영향력 ${lw.influence} 필요).`,`Not enough resources (needs ${lw.energy} energy and ${lw.influence} influence).`));
     if(st!=='applied'&&st!=='duplicate')throw new Error(L('비용 결과를 확인하지 못했습니다.','Could not confirm the payment.'));
    }
    next=spyHireLawyer(s,input);
   }else if(action==='say'){
    const text=typeof input==='string'?input.trim():'';
    if(s.phase!=='hearing'||!text||text.length>1600)throw new Error(L('해명을 1~1600자로 입력하세요.', 'Enter an explanation of 1–1600 characters.'));
    const response=s.mode==='ai'?await ctx.ai.chat(spyMessages(s,'opponent',text),{purpose:'espionage-opponent',maxTokens:1400,conversationId:conversationOf(s)}):L('그 설명만으로는 의심이 해소되지 않았습니다. 증거의 신뢰성에 대해 답해 주십시오.', 'That explanation alone does not clear our suspicion. Please address the reliability of the evidence.');
    if(!response.trim()||response.length>6000)throw new Error(L('상대 응답 형식이 올바르지 않습니다.', 'The other side\'s reply is malformed.'));
    const finalTurn=(s.evidence[s.current]?.turns??0)+1===SPY_TURNS_PER_EVIDENCE;
    const verdict=!finalTurn?undefined:s.mode==='ai'?parseSpyVerdict(await ctx.ai.chat(spyMessages(s,'court',text,response),{purpose:'espionage-court',json:true,maxTokens:1800,conversationId:conversationOf(s)})):{rebutted:[...s.log.filter(l=>l.who==='플레이어').slice(-2).map(l=>l.text),text].some(t=>t.includes('[논파]')),reason:L('시험 판정: 세 차례의 공방을 종합하여 판정했습니다.', 'Test verdict: decided on the three exchanges as a whole.'),domestic:L('시험용 국내 반응: 판정 결과를 주시합니다.', 'Test domestic reaction: watching the verdict.'),foreign:L('시험용 대외 반응: 판정에 따른 대응을 준비합니다.', 'Test foreign reaction: preparing a response to the verdict.')};
    next=advanceSpy(s,text,response,verdict);
   }else throw new Error(L('알 수 없는 선택입니다.', 'Unknown choice.'));
   if(espionage.state!==s||(s.incident.source==='fixture'&&!settings.devMode))throw new Error(L('진행 상태가 바뀌어 응답을 반영하지 않았습니다.', 'The progress changed, so the reply was not applied.'));
   commit(next);logDiagnostic('info','espionage.preview',{phase:next.phase,failures:next.failures,mode:next.mode});if(next.phase==='finished')void applySpy();return {ok:true};
  }catch(e){logDiagnostic('warn','espionage.preview.failed',{error:String(e)});return {ok:false,error:String(e)};}finally{espionage.busy=false;push();}
 });
}
