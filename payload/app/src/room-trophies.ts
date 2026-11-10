import * as fs from 'fs';
import * as path from 'path';
import {createHash,randomUUID} from 'crypto';
import type {RoomActor} from './room-records';
import {addMonths,dayNo} from './gamedate';
export type TrophyDetails={title:string;event:string;body:string;trophy:string};
/** A foreign empire leader reached through a diplomatic letter (empire number is per save, never the display name). */
/** kind 'empire': a foreign empire leader (empire number per save). kind 'person': one of our own leaders (office person key, e.g. p:12). Old records without kind are empires. */
export type TrophyRecipient={kind?:'empire'|'person';idx?:number;key?:string;name:string;ruler?:string;role?:string};
/** Letter in transit: ownership stays with the player until the game date reaches `due` and the recipient is confirmed. */
export type TrophyDelivery={id:string;to:TrophyRecipient;note:string;sent:RoomActor;due:string};
export type Trophy={id:string;details:TrophyDetails;creation:RoomActor;owner:'player'|'secretary'|'empire'|'person';slot:number|null;deleted?:boolean;delivery?:TrophyDelivery;recipient?:TrophyRecipient&{date:string;deliveryId:string}};
type Request={id:string;details:TrophyDetails;creation:RoomActor;status:'pending'|'confirmed'|'short'|'cancelled'};
/** Game months a diplomatic gift letter takes to arrive. */
export const TROPHY_LETTER_MONTHS=1;
export type DeliveryCheck='ok'|'gone'|'unknown';
export type TrophyState={version:1;sid:string;revision:number;items:Trophy[];requests:Request[];history:{action:string;actor:RoomActor;item?:Trophy;request?:Request}[]};
export function trophyDetails(v:any):TrophyDetails{
 if(!v||!['ship','medal','crystal','relic'].includes(v.trophy))throw Error('INVALID_TROPHY');
 const d={} as TrophyDetails;for(const [k,max] of [['title',120],['event',300],['body',5000]] as const){if(typeof v[k]!=='string'||v[k].length>max)throw Error('INVALID_TROPHY');d[k]=v[k].trim();}
 if(!d.title||!d.body)throw Error('INVALID_TROPHY');d.trophy=v.trophy;return d;
}
export function trophyPaymentCommand(req:number,sid:string,idx:number,id:string,charge:boolean){
 if(!Number.isSafeInteger(req)||req<1||!Number.isSafeInteger(idx)||idx<0||!/^\d+$/.test(sid)||!/^[a-f0-9-]{36}$/.test(id))throw Error('INVALID_TROPHY');
 const flag='sllm_trophy_paid_'+id.replace(/-/g,'');
 const log=(status:string)=>`log = "SLLM:TROPHYPAY/;/req=${req}/;/sid=[This.sllm_save_id]/;/id=${id}/;/status=${status}"`;
 const pay=`if = { limit = { has_resource = { type = energy amount >= 1000 } } add_resource = { energy = -1000 } set_country_flag = ${flag} ${log('paid')} } else = { ${log('short')} }`;
 return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_idx value = ${idx} } check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { has_country_flag = ${flag} } ${log('paid')} } else = { ${charge?pay:log('missing')} } }`;
}
export class RoomTrophies {
 constructor(private directory:string){}
 private file(sid:string){if(!sid||sid.length>200)throw Error('INVALID_TROPHY');return path.join(this.directory,createHash('sha256').update(sid).digest('hex')+'.json');}
 read(sid:string):TrophyState{try{const s=JSON.parse(fs.readFileSync(this.file(sid),'utf8'));if(s?.version!==1||s.sid!==sid||!Number.isSafeInteger(s.revision)||!Array.isArray(s.items)||!Array.isArray(s.requests)||!Array.isArray(s.history))throw Error('INVALID_TROPHY_STORE');return s;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,sid,revision:0,items:[],requests:[],history:[]};throw e;}}
 private commit(s:TrophyState){
  fs.mkdirSync(this.directory,{recursive:true});const f=this.file(s.sid),lock=f+'.lock';let fd:number;
  try{fd=fs.openSync(lock,'wx');}catch{if(!this.clearStaleLock(lock))throw Error('TROPHY_STORE_BUSY');try{fd=fs.openSync(lock,'wx');}catch{throw Error('TROPHY_STORE_BUSY');}}
  try{fs.writeSync(fd,JSON.stringify({pid:process.pid,at:Date.now()}));}catch{/* An empty lock still blocks other writers. */}
  const tmp=f+'.'+randomUUID()+'.tmp';
  try{const old=this.read(s.sid);if(old.revision!==s.revision)throw Error('CONFLICT');s.revision++;fs.writeFileSync(tmp,JSON.stringify(s));fs.renameSync(tmp,f);return s;}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);fs.closeSync(fd);fs.unlinkSync(lock);}
 }
 /** A lock left by a crashed app (its process no longer runs) is removed; a live or unreadable owner keeps the lock. Commits are synchronous, so a lock never outlives its writer otherwise. */
 private clearStaleLock(lock:string):boolean{
  try{const owner=JSON.parse(fs.readFileSync(lock,'utf8'));if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0||owner.pid===process.pid)return false;
   try{process.kill(owner.pid,0);return false;}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')return false;}
   fs.unlinkSync(lock);return true;}catch{return false;}
 }
 /** First empty wall niche (12 = 6 × 2 in the gallery painting), or null when the wall is full. */
 private freeSlot(s:TrophyState){const used=new Set(s.items.filter(x=>!x.deleted&&x.slot!==null).map(x=>x.slot));for(let i=0;i<12;i++)if(!used.has(i))return i;return null;}
 prepare(actor:RoomActor,revision:number,input:unknown){const s=this.read(actor.sid);if(s.revision!==revision)throw Error('CONFLICT');if(s.requests.some(x=>x.status==='pending'))throw Error('PAYMENT_PENDING');if(!actor.rulerId||!actor.rulerName||!actor.date)throw Error('INVALID_TROPHY');const r:Request={id:randomUUID(),details:trophyDetails(input),creation:{...actor},status:'pending'};s.requests.push(r);s.history.push({action:'payment-requested',actor:{...actor},request:structuredClone(r)});return {state:this.commit(s),request:r};}
 receipt(sid:string,id:string,status:string){const s=this.read(sid),r=s.requests.find(x=>x.id===id);if(!r)throw Error('INVALID_TROPHY');if(r.status!=='pending')return s;if(status!=='paid'&&status!=='short')return s;
  r.status=status==='paid'?'confirmed':'short';if(status==='paid'&&!s.items.some(x=>x.id===id)){const item:Trophy={id,details:structuredClone(r.details),creation:{...r.creation},owner:'player',slot:this.freeSlot(s)};s.items.push(item);s.history.push({action:'created',actor:{...r.creation},item:structuredClone(item)});}else s.history.push({action:'insufficient-energy',actor:{...r.creation},request:structuredClone(r)});return this.commit(s);
 }
 /** Only after the game confirmed that this request was never paid (no payment flag in the current save). Nothing is refunded or charged. */
 cancelUnpaid(actor:RoomActor,id:string){const s=this.read(actor.sid),r=s.requests.find(x=>x.id===id);if(!r||r.status!=='pending')throw Error('INVALID_TROPHY');r.status='cancelled';s.history.push({action:'payment-cancelled',actor:{...actor},request:structuredClone(r)});return this.commit(s);}
 /** Seal a diplomatic gift letter. The trophy stays the player's (and keeps its display slot) while in transit; it is locked against edits. */
 send(actor:RoomActor,revision:number,id:string,to:TrophyRecipient,note:unknown){
  const s=this.read(actor.sid);if(s.revision!==revision)throw Error('CONFLICT');const t=s.items.find(x=>x.id===id&&!x.deleted);if(!t)throw Error('UNKNOWN_TROPHY');
  if(t.owner!=='player')throw Error('TROPHY_OWNERSHIP');if(t.delivery)throw Error('TROPHY_IN_TRANSIT');
  const person=to?.kind==='person';
  if(typeof to?.name!=='string'||!to.name.trim()||to.name.length>100)throw Error('INVALID_RECIPIENT');
  if(person?(typeof to.key!=='string'||!/^(p|adm|gov):[^\r\n]{1,100}$/.test(to.key)||(to.role!==undefined&&(typeof to.role!=='string'||to.role.length>40))):(!Number.isSafeInteger(to.idx)||to.idx!<=0||typeof to.ruler!=='string'||to.ruler.length>100))throw Error('INVALID_RECIPIENT');
  if(note!==undefined&&(typeof note!=='string'||note.length>600))throw Error('INVALID_TROPHY');
  if(dayNo(actor.date)===null)throw Error('INVALID_TROPHY');
  const target:TrophyRecipient=person?{kind:'person',key:to.key,name:to.name.trim(),role:to.role||''}:{kind:'empire',idx:to.idx,name:to.name.trim(),ruler:(to.ruler||'').trim()};
  t.delivery={id:randomUUID(),to:target,note:typeof note==='string'?note.trim():'',sent:{...actor},due:addMonths(actor.date,TROPHY_LETTER_MONTHS)};
  s.history.push({action:'letter-sent',actor:{...actor},item:structuredClone(t)});return this.commit(s);
 }
 cancelDelivery(actor:RoomActor,revision:number,id:string){
  const s=this.read(actor.sid);if(s.revision!==revision)throw Error('CONFLICT');const t=s.items.find(x=>x.id===id&&!x.deleted);if(!t?.delivery)throw Error('UNKNOWN_TROPHY');
  const item=structuredClone(t);delete t.delivery;s.history.push({action:'letter-cancelled',actor:{...actor},item});return this.commit(s);
 }
 /** Deliver letters whose arrival date has passed. check() says whether the recipient is still a reachable diplomatic contact; 'unknown' keeps the letter waiting. Idempotent: a delivered letter is removed in the same commit. */
 settle(sid:string,now:string,check:(to:TrophyRecipient)=>DeliveryCheck){
  const today=dayNo(now);if(today===null)return {state:this.read(sid),delivered:[] as Trophy[],failed:[] as Trophy[]};
  const s=this.read(sid),delivered:Trophy[]=[],failed:Trophy[]=[];
  for(const t of s.items){const d=t.delivery;if(!d||t.deleted)continue;const due=dayNo(d.due);if(due===null||today<due)continue;
   const result=check(d.to);if(result==='unknown')continue;const by={...d.sent,date:d.due};
   if(result==='ok'){t.owner=d.to.kind==='person'?'person':'empire';t.slot=null;t.recipient={...d.to,date:d.due,deliveryId:d.id};delete t.delivery;delivered.push(structuredClone(t));s.history.push({action:'delivered',actor:by,item:structuredClone(t)});}
   else{const item=structuredClone(t);delete t.delivery;failed.push(item);s.history.push({action:'delivery-failed',actor:by,item});}
  }
  return {state:delivered.length||failed.length?this.commit(s):s,delivered,failed};
 }
 /** Trophies a given foreign empire received, for its leader's diplomatic memory. */
 receivedBy(sid:string,idx:number){return this.read(sid).items.filter(t=>!t.deleted&&t.owner==='empire'&&t.recipient?.idx===idx);}
 change(actor:RoomActor,revision:number,id:string,action:string,input:any,secretaryReady:boolean,personPresent:(key:string)=>boolean=()=>false){const s=this.read(actor.sid);if(s.revision!==revision)throw Error('CONFLICT');const t=s.items.find(x=>x.id===id&&!x.deleted);if(!t)throw Error('UNKNOWN_TROPHY');if(t.delivery)throw Error('TROPHY_IN_TRANSIT');if(action!=='reclaim'&&t.owner!=='player')throw Error('TROPHY_OWNERSHIP');
  switch(action){
   case 'edit':t.details=trophyDetails(input);break;
   case 'delete':t.deleted=true;t.slot=null;break;
   case 'display':if(input!==null&&(!Number.isInteger(input)||input<0||input>=12))throw Error('INVALID_TROPHY');if(input!==null&&s.items.some(x=>!x.deleted&&x.id!==id&&x.slot===input))throw Error('TROPHY_SLOT');t.slot=input;break;
   case 'gift':if(!secretaryReady)throw Error('SECRETARY_UNAVAILABLE');if(s.items.filter(x=>!x.deleted&&x.owner==='secretary').length>=6)throw Error('TROPHY_CAPACITY');t.owner='secretary';t.slot=null;break;
   case 'reclaim':if(!(t.owner==='secretary'&&secretaryReady)&&!(t.owner==='person'&&t.recipient?.key&&personPresent(t.recipient.key)))throw Error('TROPHY_OWNERSHIP');t.owner='player';t.slot=this.freeSlot(s);break;
   default:throw Error('INVALID_TROPHY');
  }s.history.push({action,actor:{...actor},item:structuredClone(t)});return this.commit(s);
 }
}
