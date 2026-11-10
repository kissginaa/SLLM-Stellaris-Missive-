import { app, ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import {parseRoomImport} from '../room-import';
import {radio,radioState,setRadio} from './radio-app';
import {RoomTrophies,trophyPaymentCommand,type TrophyRecipient,type DeliveryCheck} from '../room-trophies';
import {LogRouter,SLOT} from '../app/log-router';
import {terminalRequest,terminalReplies,terminalView} from './terminal';
import {chronPut} from './chronicle-app';
import {onGameSnapshot} from './gamestate-app';
import {RoomMusic} from '../room-music';
import * as path from 'path';
import { randomUUID, createHash } from 'crypto';
import { RoomActivities } from '../room-activity';
import { ctx } from '../app/ctx';
import { office } from './office-app';
import { peopleOf } from './people-app';
import { link } from '../app/game-link';
import { RoomRecords, type RoomActor } from '../room-records';
import { pick as L } from './settings-ui';
import { secretaryRoomState, secretaryRoomReply } from './secretary-app';
import { personaNote } from './persona-app';
import { officeView } from './office-app';
import { partyPhotoNote } from './party-app'; // 일지에 붙인 사진은 비서에게 글로(2026-11-03)

let store:RoomRecords;
let activityStore:RoomActivities;
const activities=()=>activityStore??=new RoomActivities(path.join(app.getPath('userData'),'private-room-activity'));
const records=()=>store??=(new RoomRecords(path.join(app.getPath('userData'),'private-room-records')));
const companions=new Map<number,{token:string;pose:'standing'|'seated'}>();
const sessions=new Map<number,{token:string;identity:string}>();
function actor():RoomActor {
 const sid=ctx.curSaveId,r=peopleOf(sid).find(p=>p.ruler&&!p.gone);
 if(!link.sessionReady || !sid || !r || !r.name || !ctx.gameDate)throw Error(L('게임과 현재 통치자를 먼저 확인해 주세요.','Load a game and wait for the current ruler to be identified.'));
 return {sid,rulerId:'p:'+r.lid,rulerName:r.name,date:ctx.gameDate};
}
function identity(a:RoomActor){return JSON.stringify([a.sid,a.rulerId,link.epoch]);}
function sender(e:Electron.IpcMainInvokeEvent){if(!office.win || office.win.isDestroyed() || e.sender!==office.win.webContents || e.senderFrame!==e.sender.mainFrame)throw Error('UNAUTHORIZED_ROOM');}
function session(e:Electron.IpcMainInvokeEvent,token:unknown){sender(e);const a=actor();if(sessions.get(e.sender.id)?.token!==token || sessions.get(e.sender.id)?.identity!==identity(a))throw Error(L('세이브나 통치자가 바뀌었습니다. 방을 다시 열어 주세요.','The save or ruler changed. Reopen the room.'));return a;}
const errorText=(e:unknown)=>{
 const code=(e as Error).message;
 const map:Record<string,string>={IMPORT_SIZE:L('4MB 이하 파일을 선택해 주세요.','Choose a file no larger than 4 MB.'),IMPORT_FORMAT:L('이 목록에 맞는 SLLM JSON 또는 TXT·MD 파일을 선택해 주세요.','Choose a matching SLLM JSON export, TXT or MD file.'),TROPHY_STORE_BUSY:L('다른 작업이 트로피를 저장 중입니다. 계속 발생하면 저장소 잠금 파일을 확인해 주세요.','Another operation is saving trophies. If this persists, check the store lock file.'),TROPHY_IN_TRANSIT:L('서신으로 전달 중인 트로피입니다. 전달을 취소하거나 도착을 기다려 주세요.','This trophy is in transit by letter. Cancel the delivery or wait for it to arrive.'),INVALID_RECIPIENT:L('현재 연락처에서 선물할 수 있는 제국을 찾지 못했습니다. 연락처를 갱신해 주세요.','That empire is not a giftable contact in the current save. Refresh contacts.'),PAYMENT_NOT_MISSING:L('게임에서 결제 표시를 찾았거나 확인하지 못해 요청을 취소하지 않았습니다.','The request was not cancelled: the game found a payment marker or could not confirm.'),INVALID_TROPHY:L('트로피 이름·설명·모양을 확인해 주세요.','Check the trophy name, description and design.'),INVALID_TROPHY_STORE:L('트로피 기록을 읽지 못했습니다. 원본을 보존합니다.','Could not read trophy records. The original is preserved.'),PAYMENT_PENDING:L('확인 중인 제작비가 있습니다. 결제 확인은 재차감하지 않습니다.','A payment is awaiting confirmation. Checking it will not charge again.'),UNKNOWN_TROPHY:L('트로피를 찾을 수 없습니다.','Trophy not found.'),TROPHY_OWNERSHIP:L('현재 소유자는 이 변경을 허용하지 않습니다.','The current ownership does not permit this change.'),TROPHY_SLOT:L('이미 사용 중인 전시 칸입니다.','That display slot is occupied.'),SECRETARY_UNAVAILABLE:L('비서가 준비되지 않았습니다.','Your secretary is not available.'),TROPHY_CAPACITY:L('비서는 트로피를 최대 6개까지 보관합니다.','Your secretary can hold up to six trophies.'),INVALID_CHAT:L('대화 요청을 확인해 주세요.','Check the conversation request.'),INVALID_PAGE:L('선택한 페이지가 바뀌었습니다. 다시 열어 주세요.','The selected page changed. Reopen it.'),INVALID_ROOM:L('이 기록은 해당 방에서 공유할 수 없습니다.','This record cannot be shared in this room.'),INVALID_ACTIVITY_STORE:L('대화 기록을 읽지 못했습니다. 원본은 보존됩니다.','Conversation history could not be read. The original is preserved.'),INVALID_MUSIC_STORE:L('음악 목록을 읽지 못했습니다. 원본은 보존됩니다.','The music list could not be read. The original is preserved.'),UNKNOWN_TRACK:L('이 음악은 목록에 없습니다.','This track is no longer in the list.'),MUSIC_FULL:L('음악은 최대 20곡까지 보관할 수 있습니다.','You can keep up to 20 tracks.'),INVALID_AUDIO:L('50MB 이하의 지원되는 음악 파일을 선택해 주세요.','Choose a supported audio file no larger than 50 MB.'),CONFLICT:L('다른 곳에서 수정된 기록입니다. 다시 열어 주세요.','This record changed elsewhere. Reopen it.'),INVALID_RECORD:L('제목과 본문 길이를 확인해 주세요.','Check the title and text length.'),FULL:L('보관 가능한 기록 수에 도달했습니다.','The record limit has been reached.'),INVALID_STORE:L('기록 파일을 읽지 못했습니다. 원본은 보존됩니다.','The record file could not be read. The original is preserved.')};
 return map[code]||code;
};
let musicStore:RoomMusic;
const music=()=>musicStore??=new RoomMusic(path.join(app.getPath('userData'),'private-room-music'));
type RoomBroadcast={id:string;station:string;date:string;lines:string[]};
let broadcastIdentity='',broadcasts:RoomBroadcast[]=[];
function currentBroadcasts(){const id=JSON.stringify([ctx.curSaveId,link.epoch]);if(id!==broadcastIdentity){broadcastIdentity=id;broadcasts=[];}return broadcasts;}
let trophyStore:RoomTrophies;const trophies=()=>trophyStore??=new RoomTrophies(path.join(app.getPath('userData'),'private-room-trophies'));
const paying=new Set<string>();
/** Gift letters go to regular contacts of the current save (no talk-only special empires, never the player) or to our own leaders (not the ruler). */
function empireTargets():TrophyRecipient[]{const v=terminalView();if(!ctx.curSaveId||v.sid!==ctx.curSaveId)return [];return v.items.filter(c=>!c.talkOnly&&c.idx!==ctx.playerIdx).map(c=>({kind:'empire',idx:c.idx,name:c.name,ruler:ctx.profiles.get(c.idx)?.ruler||''}));}
function ourPeople():Array<{key:string;name:string;role:string}>{try{return ((officeView().people||[]) as Array<{key:string;name:string;role:string}>).filter(p=>p&&typeof p.key==='string'&&p.role!=='ruler'&&p.name);}catch{return [];}}
function personTargets():TrophyRecipient[]{return ourPeople().map(p=>({kind:'person',key:p.key,name:p.name,role:p.role}));}
const personPresent=(key:string)=>ourPeople().some(p=>p.key===key);
function deliveryCheck(to:TrophyRecipient):DeliveryCheck{
 if(to.kind==='person'){const people=ourPeople();if(!people.length)return 'unknown';return people.some(p=>p.key===to.key)?'ok':'gone';}
 const v=terminalView();if(!ctx.curSaveId||v.sid!==ctx.curSaveId)return 'unknown';return v.items.some(c=>c.idx===to.idx&&!c.talkOnly)?'ok':'gone';}
/** Deliver due letters for the current save and record each receipt in that empire's relationship chronicle (its leader remembers the gift). */
function settleTrophies(sid:string){
 if(!sid||sid!==ctx.curSaveId||!ctx.gameDate||!link.sessionReady)return;
 const r=trophies().settle(sid,ctx.gameDate,deliveryCheck);
 for(const t of r.delivered){
  if(t.recipient?.kind==='person'){const title=t.details.title;try{personaNote(sid,t.recipient.key!,L(`통치자에게서 트로피 「${title}」을(를) 서신으로 선물받았다`,`Received the trophy "${title}" from the ruler by letter`));}catch{/* Person memory is best effort; ownership is already recorded. */}continue;}
  const to=t.recipient!,title=t.details.title,who=to.ruler||L('상대 지도자','their leader'),memo=t.details.event?L(` — 기념: ${t.details.event.slice(0,120)}`,` — commemorating: ${t.details.event.slice(0,120)}`):'';
  chronPut(to.idx!,to.date,L(`외교 서신으로 트로피 「${title}」을(를) 선물했고 ${who}이(가) 받았다${memo}`,`Sent the trophy "${title}" as a gift by diplomatic letter; ${who} received it${memo}`),true,{ruler:to.ruler||undefined,name:to.name});}
}
export function registerPrivateRooms(router:LogRouter){
 onGameSnapshot(snap=>{try{if(snap.sid===ctx.curSaveId)settleTrophies(snap.sid);}catch{/* Busy or unreadable store: letters stay in transit and settle on the next look. */}});
 router.on(SLOT.ROOM_TROPHIES,'rooms:trophy-payment',m=>{if(m.kind==='TROPHYPAY')terminalReplies.get(m.kind+':'+m.kv.req)?.(m);});
 ipcMain.handle('roomsTrophies',async(e,token)=>{try{const a=session(e,token);try{settleTrophies(a.sid);}catch{/* Reading must still work while another writer holds the store. */}return {ok:true,state:trophies().read(a.sid)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsTrophyTargets',async(e,token,refresh)=>{try{
  session(e,token);
  if(refresh===true){if(!ctx.gameRunning)throw Error(L('게임이 켜져 있어야 연락처를 갱신할 수 있습니다.','The game must be running to refresh contacts.'));const req=++link.reqCounter;await terminalRequest('effect every_playable_country = { limit = { is_ai = no } sllm_probe_contacts = { REQ = '+req+' } }','CONTACT_END',req);session(e,token);}
  return {ok:true,targets:empireTargets(),people:personTargets(),contactsDate:terminalView().sid===ctx.curSaveId?terminalView().date:''};
 }catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsTrophySend',async(e,token,revision,id,idx,note)=>{try{const a=session(e,token);const to=typeof idx==='string'&&/^(p|adm|gov):/.test(idx)?personTargets().find(x=>x.key===idx):empireTargets().find(x=>x.idx===Number(idx));if(!to)throw Error('INVALID_RECIPIENT');return {ok:true,state:trophies().send(a,revision,id,to,note)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsTrophyCancelLetter',async(e,token,revision,id)=>{try{const a=session(e,token);return {ok:true,state:trophies().cancelDelivery(a,revision,id)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsTrophyExport',async(e,token)=>{try{
  const a=session(e,token),s=trophies().read(a.sid);
  const content=JSON.stringify({format:'sllm-trophy-ledger',version:1,campaignId:a.sid,exportedAt:a.date,items:s.items,requests:s.requests,history:s.history},null,2);
  const result=await dialog.showSaveDialog(office.win!,{defaultPath:'SLLM-trophies.json',filters:[{name:L('트로피 원장 JSON','Trophy ledger JSON'),extensions:['json']}]});
  session(e,token);if(result.canceled||!result.filePath)return {ok:true,cancelled:true};
  const temp=result.filePath+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,content,{encoding:'utf8',flag:'wx'});fs.renameSync(temp,result.filePath);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return {ok:true};
 }catch(e){return {ok:false,error:errorText(e)};}});
 // recover modes for an unconfirmed request: 'check' (default) only reads the game flag; 'retry' re-sends the same request id (the game skips the charge if its flag already exists); 'cancel' re-checks and cancels only when the game confirms no payment happened.
 ipcMain.handle('roomsTrophyCreate',async(e,token,revision,input,recoverId,mode)=>{let sid='',acquired=false;try{
  const a=session(e,token);sid=a.sid;if(paying.has(sid))throw Error('PAYMENT_PENDING');paying.add(sid);acquired=true;
  if(recoverId&&mode!==undefined&&!['check','retry','cancel'].includes(mode))throw Error('INVALID_TROPHY');
  const prepared=recoverId?trophies().read(sid).requests.find(x=>x.id===recoverId&&x.status==='pending'):trophies().prepare(a,revision,input).request;
  if(!prepared)throw Error('INVALID_TROPHY');
  const req=++link.reqCounter,epoch=link.epoch,idx=ctx.playerIdx;
  const result=await terminalRequest(trophyPaymentCommand(req,sid,idx,prepared.id,!recoverId||mode==='retry'),'TROPHYPAY',req);
  if(epoch!==link.epoch||sid!==ctx.curSaveId||result.kv.sid!==sid||result.kv.id!==prepared.id)throw Error('PAYMENT_PENDING');
  if(recoverId&&mode==='cancel'){if(result.kv.status!=='missing')throw Error('PAYMENT_NOT_MISSING');const state=trophies().cancelUnpaid(a,prepared.id);return {ok:true,state,pending:state.requests.some(x=>x.status==='pending'),status:'cancelled'};}
  const state=trophies().receipt(sid,prepared.id,result.kv.status);
  return {ok:true,state,pending:state.requests.some(x=>x.status==='pending'),status:result.kv.status};
 }catch(e){let state;try{if(sid)state=trophies().read(sid);}catch{/* Preserve the original failure and never replace unreadable records. */}return {ok:false,error:errorText(e),state};}finally{if(acquired)paying.delete(sid);}});
 ipcMain.handle('roomsTrophyChange',async(e,token,revision,id,action,input)=>{try{const a=session(e,token);const before=trophies().read(a.sid).items.find(x=>x.id===id&&!x.deleted);
  const state=trophies().change(a,revision,id,action,input,secretaryRoomState().ready,personPresent);
  if(action==='reclaim'&&before?.owner==='person'&&before.recipient?.key){const title=before.details.title;try{personaNote(a.sid,before.recipient.key,L(`통치자가 선물했던 트로피 「${title}」을(를) 회수했다`,`The ruler took back the trophy "${title}" they had given`));}catch{/* best effort */}}
  return {ok:true,state};}catch(e){return {ok:false,error:errorText(e)};}});

 ipcMain.handle('roomsCompanion',async(e,token,action)=>{try{
  session(e,token);const sec=secretaryRoomState();
  if(!['call','sit','leave','get'].includes(action))throw Error('INVALID_ROOM');
  if(action==='leave'){companions.delete(e.sender.id);return {ok:true,pose:'alone'};}
  if(!sec.ready||!((sec.aff??-1)>=20)){companions.delete(e.sender.id);if(action==='get')return {ok:true,pose:'alone'};throw Error(L('현재 통치자와의 호감도가 20 이상이어야 합니다.','The current ruler needs at least 20 affinity.'));}
  const prior=companions.get(e.sender.id);
  if(action==='call')companions.set(e.sender.id,{token,pose:'standing'});
  if(action==='sit'){if(!prior||prior.token!==token||prior.pose!=='standing')throw Error(L('먼저 비서를 불러 주세요.','Call your secretary first.'));companions.set(e.sender.id,{token,pose:'seated'});}
  const current=companions.get(e.sender.id);return {ok:true,pose:current&&current.token===token?current.pose:'alone'};
 }catch(e){return {ok:false,error:errorText(e)};}});

 ipcMain.handle('roomsRadioPublish',async(e,b)=>{
  if(!radio.win||radio.win.isDestroyed()||e.sender!==radio.win.webContents||e.senderFrame!==e.sender.mainFrame||!link.sessionReady||!radio.on)return false;
  if(!b||!Array.isArray(b.lines)||b.lines.length>40)return false;
  const lines=b.lines.filter((x:any)=>x&&typeof x.text==='string').map((x:any)=>String(b.names?.[x.who]||x.who||'')+': '+x.text.slice(0,3000));
  if(!lines.length)return false;
  const list=currentBroadcasts();list.push({id:randomUUID(),station:String(b.station||'').slice(0,200),date:String(b.date||'').slice(0,60),lines});if(list.length>12)list.shift();return true;
 });
 ipcMain.handle('roomsRadio',async(e,token,action)=>{try{session(e,token);if(action!==undefined&&!['play','stop'].includes(action))throw Error('INVALID_ROOM');if(action==='play')setRadio(true);if(action==='stop')setRadio(false);const list=currentBroadcasts();return {ok:true,state:radioState(),broadcast:list.at(-1)||null};}catch(e){return {ok:false,error:errorText(e)};}});

 ipcMain.handle('roomsMusicConfigure',async(e,token,input)=>{try{const a=session(e,token);return {ok:true,prefs:music().configure(a.sid,input),tracks:music().list(a.sid)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsShare',async(e,token,req)=>{try{
  const a=session(e,token),sec=secretaryRoomState();
  if(!req||typeof req.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(req.requestId))throw Error('INVALID_CHAT');
  const r=records().read(a.sid).records.find(x=>x.id===req.recordId&&!x.deleted);
  if(!r||r.revision!==req.revision||!Number.isInteger(req.page)||req.page<0||req.page*640>=Array.from(r.text).length)throw Error('INVALID_PAGE');
  if((r.kind==='journal'&&req.room!=='private')||(r.kind==='book'&&req.room!=='reading'))throw Error('INVALID_ROOM');
  if(!sec.ready||!((sec.aff??-1)>=(r.kind==='journal'?20:10)))throw Error(L('현재 통치자와의 관계 조건을 충족해야 합니다.','The current ruler must meet the relationship requirement.'));
  const fingerprint=createHash('sha256').update(JSON.stringify(['shared-reading',a.rulerId,r.id,r.revision,req.page])).digest('hex');
  const prior=activities().read(a.sid).find(x=>x.id===req.requestId);if(prior&&prior.fingerprint!==fingerprint)throw Error('CONFLICT');
  activities().append({id:req.requestId,fingerprint,kind:'shared-reading',author:r.author,authorshipUnverified:!!r.imported,actor:a,secretaryId:'primary',room:req.room,subjectId:r.id,subjectTitle:r.title,question:'',reply:'',pose:'idle',name:sec.name});
  return {ok:true};
 }catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsMusic',async(e,token)=>{try{const a=session(e,token);return {ok:true,tracks:music().list(a.sid),prefs:music().prefs(a.sid)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsMusicAdd',async(e,token)=>{try{const a=session(e,token),result=await dialog.showOpenDialog(office.win!,{properties:['openFile'],filters:[{name:L('음악','Music'),extensions:['mp3','wav','ogg','m4a','flac','aac','webm']}]});session(e,token);if(result.canceled)return {ok:true,tracks:music().list(a.sid),prefs:music().prefs(a.sid)};return {ok:true,tracks:music().add(a.sid,result.filePaths[0]),prefs:music().prefs(a.sid)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsMusicDelete',async(e,token,id)=>{try{const a=session(e,token);return {ok:true,tracks:music().remove(a.sid,id),prefs:music().prefs(a.sid)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsState',async e=>{try{sender(e);const a=actor(),id=identity(a);let s=sessions.get(e.sender.id);if(!s||s.identity!==id){s={token:randomUUID(),identity:id};sessions.set(e.sender.id,s);e.sender.once('destroyed',()=>{sessions.delete(e.sender.id);companions.delete(e.sender.id);});}return {ok:true,token:s.token,actor:a,secretary:secretaryRoomState(),records:records().read(a.sid).records.filter(r=>!r.deleted)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsSave',async(e,token,input)=>{try{const a=session(e,token);return {ok:true,record:records().save(a,input)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsImport',async(e,token,kind)=>{try{
  const a=session(e,token);if(kind!=='book'&&kind!=='journal')throw Error('INVALID_RECORD');
  const selected=await dialog.showOpenDialog(office.win!,{properties:['openFile'],filters:[{name:L('기록 파일','Writing files'),extensions:['json','txt','md']}]});session(e,token);
  if(selected.canceled||!selected.filePaths[0])return {ok:true,cancelled:true};
  const file=selected.filePaths[0],fileName=path.basename(file),fd=fs.openSync(file,'r');let content:string;
  try{if(!fs.fstatSync(fd).isFile()||fs.fstatSync(fd).size>4*1024*1024)throw Error('IMPORT_SIZE');const bytes=Buffer.alloc(4*1024*1024+1);const n=fs.readSync(fd,bytes,0,bytes.length,0);if(n>4*1024*1024)throw Error('IMPORT_SIZE');content=bytes.subarray(0,n).toString('utf8');}finally{fs.closeSync(fd);}
  const copies=parseRoomImport(content,fileName,kind),revision=records().read(a.sid).revision;
  const count=copies.length,archived=copies.filter(x=>x.deleted).length;
  const confirm=await dialog.showMessageBox(office.win!,{type:'question',buttons:[L('취소','Cancel'),L('사본 추가','Add copies')],defaultId:0,cancelId:0,message:L(`${count}개 기록을 새 사본으로 추가할까요?`, `Add ${count} records as new copies?`),detail:L(`삭제 보관 기록 ${archived}개 포함. 기존 기록은 유지됩니다. 파일 속 저자는 외부 자료에 적힌 정보로 보관하며, 가져온 통치자와 구분합니다.`, `Includes ${archived} archived records. Existing records are preserved. Authorship from the file is stored as external information, separately from the importing ruler.`)});
  session(e,token);if(confirm.response!==1)return {ok:true,cancelled:true};
  const added=records().importCopies(a,revision,kind,content,fileName);return {ok:true,count:added.length};
 }catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsArchive',async(e,token)=>{try{const a=session(e,token);return {ok:true,records:records().read(a.sid).records};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsRestore',async(e,token,id,revision)=>{try{const a=session(e,token);return {ok:true,record:records().restore(a,id,revision)};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsExport',async(e,token,kind,includeArchived)=>{try{
  const a=session(e,token);if(typeof includeArchived!=='boolean')throw Error('INVALID_RECORD');
  const content=records().export(a.sid,kind,includeArchived);
  const result=await dialog.showSaveDialog(office.win!,{defaultPath:`SLLM-${kind}.json`,filters:[{name:L('기록 JSON','Records JSON'),extensions:['json']}]});
  session(e,token);if(result.canceled||!result.filePath)return {ok:true,cancelled:true};
  const temp=result.filePath+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,content,{encoding:'utf8',flag:'wx'});fs.renameSync(temp,result.filePath);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return {ok:true};
 }catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsDelete',async(e,token,id,revision)=>{try{const a=session(e,token);records().remove(a.sid,id,revision);return {ok:true};}catch(e){return {ok:false,error:errorText(e)};}});
 ipcMain.handle('roomsChat',async(e,token,req)=>{try{
  const a=session(e,token);if(!req||!['private','reading','exhibition','secretary'].includes(req.room)||typeof req.text!=='string'||!req.text.trim()||req.text.length>1200)throw Error('INVALID_CHAT');
  if(typeof req.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(req.requestId))throw Error('INVALID_CHAT');
  const fingerprint=createHash('sha256').update(JSON.stringify([a.rulerId,req.room,req.text,req.recordId,req.revision,req.page,req.broadcastId])).digest('hex');
  const cached=activities().read(a.sid).find(x=>x.id===req.requestId);
  if(cached){if(cached.fingerprint!==fingerprint)throw Error('CONFLICT');return {ok:true,reply:cached.reply,pose:cached.pose,name:cached.name};}
  let reference='',subjectTitle='';
  if(req.recordId){const r=records().read(a.sid).records.find(x=>x.id===req.recordId&&!x.deleted);if(!r||r.revision!==req.revision||!Number.isInteger(req.page)||req.page<0)throw Error('CONFLICT');
   if((r.kind==='journal'&&req.room!=='private')||(r.kind==='book'&&req.room!=='reading'))throw Error('INVALID_ROOM');
   const pages=Array.from(r.text);if(req.page*640>=pages.length)throw Error('INVALID_PAGE');
   subjectTitle=r.title;
   reference=JSON.stringify({title:r.title,author:r.author,authorship:r.imported?"unverified external attribution":"recorded in this campaign",currentReader:a,visiblePages:pages.slice(req.page*640,req.page*640+640).join('').replace(/\[\[📷:(\d{10,16})\]\]/g,(m,id)=>partyPhotoNote(a.sid,id)??L('[사진]','[Photo]'))});
  }
  if(req.broadcastId){
   if(req.recordId||!['private','secretary'].includes(req.room))throw Error('INVALID_ROOM');
   const b=currentBroadcasts().find(x=>x.id===req.broadcastId);if(!b)throw Error(L('이 방송은 현재 세션에 없습니다. TV에서 다시 선택해 주세요.','This broadcast is no longer available in this session. Select it again on the TV.'));
   reference=JSON.stringify({type:'quoted-radio-broadcast',broadcast:b});subjectTitle=b.station+' '+b.date;
  }
  const companion=companions.get(e.sender.id);if(req.room==='private'&&companion&&companion.token===token){reference+='\n'+JSON.stringify({scene:'watching TV together in the private room',secretaryPose:companion.pose});}
  const subjectId=req.recordId||(req.broadcastId?'radio:'+req.broadcastId:'');
  const memory:any[]=activities().relevant(a,req.room,subjectId);
  if(!subjectId){for(const h of trophies().read(a.sid).history.filter(h=>h.action==='gift'||h.action==='reclaim').slice(-4)){memory.push({actor:h.actor,relation:h.actor.rulerId===a.rulerId?'current-ruler':'other-ruler',kind:'trophy-'+h.action,creation:h.item?.creation,summary:JSON.stringify({title:h.item?.details.title,description:h.item?.details.body,owner:h.item?.owner}).slice(0,600)});}if(memory.length>4)memory.splice(0,memory.length-4);}
  const reply=await secretaryRoomReply(a,req.room,req.text,reference,JSON.stringify(memory));
  session(e,token);
  let warning='';
  try{activities().append({id:req.requestId,fingerprint,actor:a,secretaryId:'primary',room:req.room,subjectId,subjectTitle,question:req.text,reply:reply.reply,pose:reply.pose,name:reply.name});}
  catch{warning=L('답변은 받았지만 대화 기록을 저장하지 못했습니다.','The reply arrived, but the conversation record could not be saved.');}
  return {ok:true,...reply,warning};
 }catch(e){return {ok:false,error:errorText(e)};}});
}
