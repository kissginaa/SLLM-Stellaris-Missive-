import * as fs from 'fs';
import * as path from 'path';
import {createHash,randomUUID} from 'crypto';
import {nationalDate} from './national-events';
export type Holiday={id:string;name:string;month:number;text:string;art:'festival'|'mourning'|'annual';enabled:boolean;firstYear:number;created:string};
export type Holidays={version:1;sid:string;revision:number;autoSpend:boolean;items:Holiday[];history:{date:string;action:string;id?:string;year?:number;status?:string}[]};
export class HolidayStore{
 constructor(private dir:string){}
 private file(sid:string){if(!/^\d+$/.test(sid))throw Error('HOLIDAY_SESSION');return path.join(this.dir,createHash('sha256').update(sid).digest('hex')+'.json');}
 read(sid:string):Holidays{try{const s=JSON.parse(fs.readFileSync(this.file(sid),'utf8'));if(s?.version!==1||s.sid!==sid||!Number.isSafeInteger(s.revision)||!Array.isArray(s.items)||!Array.isArray(s.history))throw Error('HOLIDAY_STORE');return s;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,sid,revision:0,autoSpend:false,items:[],history:[]};throw e;}}
 private commit(s:Holidays){fs.mkdirSync(this.dir,{recursive:true});const file=this.file(s.sid),lock=file+'.lock',tmp=file+'.'+randomUUID()+'.tmp';let fd:number;try{fd=fs.openSync(lock,'wx');}catch{throw Error('HOLIDAY_BUSY');}try{if(this.read(s.sid).revision!==s.revision)throw Error('HOLIDAY_CONFLICT');s.revision++;fs.writeFileSync(tmp,JSON.stringify(s));fs.renameSync(tmp,file);return s;}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);fs.closeSync(fd);fs.unlinkSync(lock);}}
 change(sid:string,revision:number,date:string,action:string,input:any){const d=nationalDate(date);if(!d)throw Error('HOLIDAY_SESSION');const s=this.read(sid);if(s.revision!==revision)throw Error('HOLIDAY_CONFLICT');let id=input?.id;
  if(action==='auto'){if(typeof input!=='boolean')throw Error('HOLIDAY_INPUT');s.autoSpend=input;}
  else if(action==='delete'){if(!s.items.some(h=>h.id===id))throw Error('HOLIDAY_INPUT');s.items=s.items.filter(h=>h.id!==id);}
  else if(action==='save'){
   if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>120||typeof input.text!=='string'||input.text.length>5000||!Number.isInteger(input.month)||input.month<1||input.month>12||!['festival','mourning','annual'].includes(input.art)||typeof input.enabled!=='boolean')throw Error('HOLIDAY_INPUT');
   const prior=id?s.items.find(h=>h.id===id):undefined;if(id&&!prior)throw Error('HOLIDAY_INPUT');
   if(s.items.some(h=>h.id!==id&&h.month===input.month))throw Error('HOLIDAY_MONTH');
   const firstYear=prior&&prior.month===input.month?prior.firstYear:d.year+(input.month<=d.month?1:0);
   const h:Holiday={id:prior?.id||randomUUID(),name:input.name.trim(),month:input.month,text:input.text,art:input.art,enabled:input.enabled,firstYear,created:prior?.created||date};id=h.id;if(prior)s.items[s.items.indexOf(prior)]=h;else s.items.push(h);
  }else throw Error('HOLIDAY_INPUT');
  s.history.push({date,action,id});return this.commit(s);
 }
 record(sid:string,date:string,id:string,year:number,status:string){const s=this.read(sid);s.history.push({date,action:'preparation',id,year,status});return this.commit(s);}
}
// Flags are month/year scoped, preventing abolition and recreation from charging the same month twice.
// The save's flags, never the app history, are authoritative for payment and cancellation.
export function holidayCommand(req:number,sid:string,idx:number,year:number,month:number,mode:'prepare'|'query'|'cancel'){
 if(![req,idx,year,month].every(Number.isSafeInteger)||req<1||idx<0||year<1||month<1||month>12||!/^\d+$/.test(sid)||!['prepare','query','cancel'].includes(mode))throw Error('HOLIDAY_INPUT');
 const key=`sllm_holiday_${year}_${month}`,log=(status:string)=>`log = "SLLM:HOLIDAYPAY/;/req=${req}/;/sid=[This.sllm_save_id]/;/year=${year}/;/month=${month}/;/status=${status}"`;
 const pay=`if = { limit = { has_resource = { type = energy amount >= 150 } has_resource = { type = minerals amount >= 100 } has_resource = { type = food amount >= 300 } } add_resource = { energy = -150 minerals = -100 food = -300 } set_country_flag = ${key}_paid ${log('paid')} } else = { set_country_flag = ${key}_short ${log('short')} }`;
 const status=`if = { limit = { has_country_flag = ${key}_cancel } ${log('cancelled')} } else_if = { limit = { has_country_flag = ${key}_paid } ${log('paid')} } else_if = { limit = { has_country_flag = ${key}_short } ${log('short')} } else = { ${mode==='prepare'?pay:log('unprepared')} }`;
 // 2026-10-23: current_date 는 스텔라리스 트리거가 아니다(설치된 게임 script_documentation/triggers.log·1.0~4.5 목록 어디에도 없음) → 게임이 명령을 거부할 수 있어 뺐다.
 // 달 확인은 앱이 보내기 전(h.month===c.month)과 회신 뒤(게임 날짜가 같은 달인지) 두 번 한다. 깃발 키에 연·월이 들어 있어 같은 달 중복 차감도 없다.
 return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_idx value = ${idx} } check_variable = { which = sllm_save_id value = ${sid} } } ${mode==='cancel'?`set_country_flag = ${key}_cancel ${log('cancelled')}`:status} }`;
}
