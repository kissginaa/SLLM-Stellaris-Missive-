import {app,ipcMain} from 'electron';
import * as path from 'path';
import {HolidayStore,holidayCommand} from '../official-holidays';
import {nationalDate} from '../national-events';
import {ctx} from '../app/ctx';
import {link} from '../app/game-link';
import {LogRouter,SLOT} from '../app/log-router';
import {office} from './office-app';
import {onGameSnapshot} from './gamestate-app';
import {terminalRequest,terminalReplies} from './terminal';
import {pick as L} from './settings-ui';
let storage:HolidayStore;const store=()=>storage??=new HolidayStore(path.join(app.getPath('userData'),'official-holidays'));
const session=()=>`${ctx.curSaveId}:${link.epoch}`;
const busy=new Set<string>(),results=new Map<string,string>();let observed='',autoBlocked='';
function context(){const d=nationalDate(ctx.gameDate);if(!link.sessionReady||!/^\d+$/.test(ctx.curSaveId)||!d)throw Error('HOLIDAY_SESSION');return {...d,sid:ctx.curSaveId,token:session()};}
function authorize(e:Electron.IpcMainInvokeEvent,token?:string){if(!office.win||office.win.isDestroyed()||e.sender!==office.win.webContents||e.senderFrame!==e.sender.mainFrame)throw Error('HOLIDAY_SESSION');const c=context();if(token!==undefined&&token!==c.token)throw Error('HOLIDAY_SESSION');return c;}
function error(e:unknown){const code=(e as Error).message;const map:Record<string,string>={HOLIDAY_SESSION:L('세이브를 확인하고 달력을 다시 열어 주세요.','Check the save and reopen the calendar.'),HOLIDAY_INPUT:L('기념일 이름·월·내용을 확인해 주세요.','Check the holiday name, month and text.'),HOLIDAY_MONTH:L('그 달에는 이미 기념일이 있습니다. 중지하거나 올해 취소해도 월은 유지됩니다.','That month already has a holiday. Pausing or cancelling this year does not free the month.'),HOLIDAY_CONFLICT:L('기념일이 변경되었습니다. 다시 열어 주세요.','Holidays changed. Reopen the calendar.'),HOLIDAY_STORE:L('기념일 기록을 읽지 못했습니다. 원본을 보존합니다.','Could not read holiday records. The original is preserved.'),HOLIDAY_BUSY:L('처리 중입니다. 잠시 후 다시 확인해 주세요.','An operation is in progress. Check again shortly.'),HOLIDAY_DUE:L('활성 기념일의 행사 월에만 준비할 수 있습니다.','Preparation is available only during an active holiday’s eligible month.')};return map[code]||code;}
function view(){const c=context(),s=store().read(c.sid);return {...s,reserved:reservedMonths(c.sid),session:c.token,date:ctx.gameDate,year:c.year,month:c.month,statuses:Object.fromEntries(s.items.map(h=>[h.id,results.get(`${c.token}:${c.year}:${h.month}`)||'unknown']))};}
async function processHoliday(id:string,mode:'prepare'|'query'|'cancel'){
 const c=context(),h=store().read(c.sid).items.find(h=>h.id===id);if(!h||h.month!==c.month||h.firstYear>c.year||(mode==='prepare'&&!h.enabled))throw Error('HOLIDAY_DUE');
 const key=`${c.token}:${c.year}:${c.month}`;if(busy.has(key))throw Error('HOLIDAY_BUSY');busy.add(key);
 try{const req=++link.reqCounter;results.set(key,'pending');const r=await terminalRequest(holidayCommand(req,c.sid,ctx.playerIdx,c.year,c.month,mode),'HOLIDAYPAY',req);
  if(session()!==c.token||ctx.gameDate.split('.').slice(0,2).map(Number).join('.')!==`${c.year}.${c.month}`||r.kv.sid!==c.sid||Number(r.kv.year)!==c.year||Number(r.kv.month)!==c.month)throw Error('HOLIDAY_SESSION');
  if(!['paid','short','cancelled','unprepared','stale'].includes(r.kv.status))throw Error('HOLIDAY_SESSION');
  results.set(key,r.kv.status);store().record(c.sid,ctx.gameDate,h.id,c.year,r.kv.status);return view();
 }catch(e){if(session()===c.token)results.set(key,'pending');throw e;}finally{busy.delete(key);}
}
/** 다른 기능이 예약한 달(사교회 29: 국가기념일과 같은 달에 두지 않는다). relations-app 가 등록한다(가져오기 순환 없이). */
const reserved:((sid:string)=>{month:number;name:string}[])[]=[];
export function addReservedMonths(fn:(sid:string)=>{month:number;name:string}[]){reserved.push(fn);}
export function reservedMonths(sid:string){return reserved.flatMap(f=>{try{return f(sid);}catch{return [];}});}
/** 국가기념일이 차지한 달(사교회 월 변경 검사용). */
export function officialHolidayMonths(sid:string):number[]{try{return store().read(sid).items.map(h=>h.month);}catch{return [];}}
export function registerOfficialHolidays(router:LogRouter){
 router.on(SLOT.OFFICIAL_HOLIDAYS,'national:holidays',m=>{if(m.kind==='HOLIDAYPAY')terminalReplies.get(m.kind+':'+m.kv.req)?.(m);});
 ipcMain.handle('holidayState',e=>{try{authorize(e);return {ok:true,state:view()};}catch(e){return {ok:false,error:error(e)};}});
 ipcMain.handle('holidayChange',(e,token,revision,action,input)=>{try{const c=authorize(e,token);if(busy.has(`${c.token}:${c.year}:${c.month}`))throw Error('HOLIDAY_BUSY');if(action==='save'&&reservedMonths(c.sid).some(r=>r.month===Number(input?.month)))throw Error('HOLIDAY_MONTH');store().change(c.sid,revision,ctx.gameDate,action,input);autoBlocked=`${c.token}:${c.year}:${c.month}`;return {ok:true,state:view()};}catch(e){return {ok:false,error:error(e)};}});
 ipcMain.handle('holidayPrepare',async(e,token,id,mode)=>{try{authorize(e,token);if(!['prepare','query','cancel'].includes(mode))throw Error('HOLIDAY_INPUT');return {ok:true,state:await processHoliday(id,mode)};}catch(e){return {ok:false,error:error(e)};}});
 onGameSnapshot(snapshot=>{try{if(snapshot.sid!==ctx.curSaveId)return;const c=context(),key=`${c.token}:${c.year}:${c.month}`;if(key===observed)return;const previous=observed;observed=key;results.clear();if(!previous||!previous.startsWith(c.token+':')||key===autoBlocked)return;const priorDate=previous.split(':').slice(-2).map(Number);if(c.year*12+c.month<=priorDate[0]*12+priorDate[1])return;const s=store().read(c.sid);if(!s.autoSpend)return;const h=s.items.find(h=>h.enabled&&h.month===c.month&&h.firstYear<=c.year);if(h)void processHoliday(h.id,'prepare').catch(()=>{});}catch{/* Keep game observations running when holiday storage is unavailable. */}});
}
