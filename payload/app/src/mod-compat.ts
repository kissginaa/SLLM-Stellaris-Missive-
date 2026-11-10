import * as fs from 'fs';
import * as path from 'path';
import { ModResources, ResourceFile } from './mod-resources';
import { parsePdx, scanLoc, PdxEntry } from './lore';
import type { SllmMessage } from './protocol';
import type { RadioEvent } from './radio';
import { L } from './i18n-pick';

export interface EthicInfo { id: string; name: string; description: string; behavior: string; source: string }
interface CountryRule { contact: boolean; actions: boolean; description: string }
interface CompatPack { version: number; id: string; name?: string; matchModIds?: string[]; ethics?: Record<string, { name?: string; description?: string; behavior?: string }>; countryTypes?: Record<string, { contact: boolean; actions?: boolean; description?: string }>; empires?: Record<string, { lore?: string; flag?: string }>; events?: Record<string, { title: string; description?: string }> }
const key = (s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9_.-]{1,120}$/.test(s);
const plain = (s: unknown, max = 400) => typeof s === 'string' ? s.replace(/§[A-Za-z!]/g, '').replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,max) : '';
const value = (entries: PdxEntry[], k: string) => { const v = entries.find(x => x[0] === k)?.[1]; return typeof v === 'string' ? v : ''; };

/** Data-only compatibility packs. No scripts or commands from these JSON files are executed. */
/** 바닐라 나라 종류 중 외교 통신이 닿으면 안 되는 것(2026-10-19 사용자: 공허충·광물 추출 사업부 같은 것). 게임 common/country_types 4.x 기준.
 *  허용(대화 전용): enclave·mindwarden_enclave·caravaneer_home·enclave_mercenary(2026-10-25 알파 11)·약탈자 3종·은하 위기(프레소린·불청객 3종·컨틴전시·세타나, 2026-10-25 알파 11 사용자: 게임 안에서도 통신 가능). 일반·몰락·각성 제국은 basic. 모드 특수 제국은 여기 없으면 대화 전용. */
export const VANILLA_NO_CONTACT = new Set(['vanilla_other', 'primitive', 'global_event', 'faction', 'asteroid_faction', 'nice_faction', 'origin_dragon', 'dragon_dummy', 'clutch_of_whelps', 'adversary', 'neutral_faction', 'nomad', 'pirate', 'primal_mind', 'rebel', 'ambient', 'shroud', 'shroud_spirits', 'gdf', 'cybrex_empire', 'sentinels', 'gate_builders', 'gray', 'synth_queen_storm', 'synth_queen_convoys', 'synth_queen_outposts', 'the_reckoning', 'tiyanki', 'tiyanki_garrison', 'amoeba', 'amoeba_borderless', 'amoeba_garrison', 'amoeba_faction', 'crystal', 'crystal_faction', 'drone', 'drone_faction', 'cloud', 'portal_holder', 'feral_prethoryn', 'feral_prethoryn_infighting', 'marauder_raiders', 'vol', 'ratlings', 'enigmatic_cache', 'gray_goo', 'mechanocalibrator', 'vluur', 'slavers_dummy', 'debt_collectors', 'jaunting_traveler_dummy', 'no_contact_neutral_faction', 'abandoned_hatchery', 'behemoth_hatchling', 'voidspawn_boss', 'champions_forge_contestant', 'dummy_miners', 'guardian', 'guardian_dragon', 'guardian_toxic_god', 'guardian_stellarite', 'guardian_wraith', 'guardian_hiver', 'guardian_horror', 'guardian_fortress', 'guardian_dreadnought', 'guardian_sphere', 'guardian_scavenger_bot', 'guardian_elderly_tiyanki', 'ldragon_country', 'guardian_hatchling', 'caravaneer_fleet', 'paragon_event_country', 'formless', 'formless_event_aberrant_country', 'grave_guardian', 'mirrored_country', 'voidworms', 'voidworms_crisis', 'voidworms_treasure_hunters', 'cutholoids', 'frenzied_voidworms', 'lured_fauna_faction', 'guardian_opus_sentinel', 'exiled']);
/** civic_fanatic_purifiers → Fanatic Purifiers (번역이 없을 때). */
export const prettyKey = (id: string): string => String(id).replace(/^(civic|origin|trait|auth)_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
export class ModCompatibility {
  ethics = new Map<string, EthicInfo>();
  private installedEthics = new Set<string>();
  private lores = new Map<string, { text: string; source: string }>();
  private localizedText = new Map<string,string>();
  private countries = new Map<string, CountryRule>();
  private empires = new Map<string, { lore: string; flag?: string; base: string }>();
  private events = new Map<string, { title: string; description: string; pack: string }>();
  private loaded: string[] = [];
  private warnings: string[] = [];
  private sig = '';
  private lang = '';
  private lastEvents: string[] = [];
  private seenEvents = new Set<string>();
  private live = new Map<number, { sid: string; ids: string[]; date: string }>();
  private pending = new Map<number, { sid: string; idx: number; ids: string[]; date: string }>();
  constructor(readonly resources: ModResources, private folder: () => string, private language: () => string, private addons: () => { sig: string; packs: Array<{ pack: unknown; source: string; base: string }> } = () => ({ sig: '', packs: [] })) {}
  invalidate(): void { this.sig = ''; this.resources.invalidate(); }
  clearLive(): void { this.live.clear(); this.pending.clear(); }
  refresh(): void {
    this.resources.refresh();
    const dir = this.folder(); let local: string[] = [];
    try { local = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => path.join(dir,f)); } catch { /* no local packs yet */ }
    const addon = this.addons();
    const sig = this.resources.revision + '|' + this.language() + '|' + addon.sig + '|' + local.map(f => { try { return f + ':' + fs.statSync(f).mtimeMs; } catch { return f + ':gone'; } }).join(';'); // F-17: 목록을 읽은 뒤 파일이 지워져도 멈추지 않게
    if (sig === this.sig) return; this.sig = sig; this.lang = this.language();
    this.ethics.clear(); this.installedEthics.clear(); this.lores.clear(); this.localizedText.clear(); this.countries.clear(); this.empires.clear(); this.events.clear(); this.loaded = []; this.warnings = [];
    const definitions = new Map<string, ResourceFile>();
    for (const f of this.resources.files('common/ethics', '.txt')) try { for (const [id, block] of parsePdx(this.resources.read(f).toString('utf8'))) if (key(id) && !id.startsWith('@') && Array.isArray(block) && block.some(([k,v])=>['category','cost'].includes(k)&&typeof v==='string')) definitions.set(id,f); } catch (e) { this.warnings.push(f.source + ': ' + (e as Error).message); }
    this.installedEthics = new Set(definitions.keys());
    const empireKeys = new Map<string, { bio: string; source: string }>();
    for (const f of this.resources.files('prescripted_countries','.txt')) try { for (const [,block] of parsePdx(this.resources.read(f).toString('utf8'))) if (Array.isArray(block)) { const name=value(block,'name'), species=block.find(x=>x[0]==='species')?.[1]; if (name) empireKeys.set(name,{bio:value(block,'species_bio') || (Array.isArray(species)?value(species,'species_bio'):'') || name+'_desc',source:f.root.name}); } } catch (e) { this.warnings.push(f.source+': '+(e as Error).message); }
    const extra = new Set([...empireKeys.keys(),...Array.from(empireKeys.values(),e=>e.bio)]);
    const wanted = (id: string) => extra.has(id) || id.startsWith('EMPIRE_DESIGN_') || definitions.has(id) || id.endsWith('_desc') && definitions.has(id.slice(0,-5)) || /^(civic_|origin_|trait_|auth_)/.test(id) && !id.endsWith('_desc'); // 국시·기원·특성·권위 이름(2026-11-03)
    const pref: Record<string,string> = {}, en: Record<string,string> = {};
    for (const f of this.resources.files('localisation', '.yml')) try {
      const t = this.resources.read(f).toString('utf8'), { lang, map } = scanLoc(t, wanted);
      if (lang === (this.lang === 'en' ? 'english' : this.lang === 'ko' ? 'korean' : this.lang)) Object.assign(pref,map); // 2026-10-18: 언어 팩이면 번역 폴더 이름(simp_chinese 등)을 바로 받는다 else if (lang === 'english') Object.assign(en,map);
    } catch (e) { this.warnings.push(f.source + ': ' + (e as Error).message); }
    const loc = (id: string, depth = 0): string => { const text = pref[id] ?? en[id] ?? id; return depth >= 3 ? text : text.replace(/\$([A-Za-z0-9_.-]+)\$/g, (_, k) => k === id ? k : loc(k, depth+1)); };
    for(const id of new Set([...Object.keys(pref),...Object.keys(en)])) this.localizedText.set(id,plain(loc(id),600));
    for (const [id,e] of empireKeys) { const bio=pref[e.bio]||en[e.bio] ? loc(e.bio) : e.bio===id+'_desc' ? '' : e.bio; if (bio) this.lores.set(loc(id).trim(),{text:plain(bio,600),source:e.source}); }
    for (const id of new Set([...Object.keys(pref),...Object.keys(en)])) if (id.startsWith('EMPIRE_DESIGN_')&&!id.endsWith('_desc')&&(pref[id+'_desc']||en[id+'_desc'])) this.lores.set(loc(id).trim(),{text:plain(loc(id+'_desc'),600),source:'localisation'});
    for (const [id,f] of definitions) this.ethics.set(id,{ id, name: plain(loc(id),100), description: plain(pref[id+'_desc'] || en[id+'_desc'] ? loc(id+'_desc') : ''), behavior:'', source:f.root.name });
    const builtin=path.join(__dirname,'..','ui','compatibility-gigastructures.json');
    try { this.loadPack(JSON.parse(fs.readFileSync(builtin,'utf8')),builtin,path.dirname(builtin),true); } catch (e) { this.warnings.push(L('내장 호환 파일: ','Built-in compatibility file: ')+(e as Error).message); }
    for (const f of this.resources.files('sllm/compatibility', '.json')) try { this.loadPack(JSON.parse(this.resources.read(f).toString('utf8')), f.source, f.root.dir || '', true); } catch (e) { this.warnings.push(f.source + ': ' + (e as Error).message); }
    // 애드온의 호환 해석(2026-10-16): 모드 안 호환 파일 다음, 사용자 호환 폴더 앞. 애드온끼리는 목록 위쪽이 나중에 들어가 이긴다.
    for (const a of addon.packs) try { this.loadPack(a.pack as CompatPack, a.source, a.base, true); } catch (e) { this.warnings.push(a.source + ': ' + (e as Error).message); }
    for (const f of local) try { this.loadPack(JSON.parse(fs.readFileSync(f,'utf8')),f,path.dirname(f),false); } catch (e) { this.warnings.push(f + ': ' + (e as Error).message); }
  }
  private loadPack(p: CompatPack, source: string, base: string, fromMod: boolean): void {
    if (!p || p.version !== 1 || !key(p.id)) throw Error('compatibility pack requires version=1 and a valid id');
    if (p.matchModIds !== undefined && (!Array.isArray(p.matchModIds) || p.matchModIds.some(x => typeof x !== 'string'))) throw Error('Invalid matchModIds');
    if (p.matchModIds?.length && !p.matchModIds.some(id => this.resources.roots.some(r => r.id === id))) { if (!fromMod) this.warnings.push(p.id + L(': 대상 모드가 비활성이라 건너뜀', ': skipped because the target mod is inactive')); return; }
    this.loaded.push((p.name || p.id) + ' — ' + source);
    for (const [id,e] of Object.entries(p.ethics || {})) if (key(id) && e && typeof e === 'object') { const old = this.ethics.get(id); this.ethics.set(id,{ id, name:plain(e.name,100)||old?.name||id, description:plain(e.description)||old?.description||'', behavior:plain(e.behavior,240), source:p.id }); }
    for (const [id,r] of Object.entries(p.countryTypes || {})) { if (!key(id)) continue; if (r && typeof r.contact === 'boolean') this.countries.set(id,{ contact:r.contact, actions:r.contact && r.actions === true, description:plain(r.description) }); else this.countries.set(id,{ contact:false, actions:false, description:'' }); } // 잘못 적은 규칙은 닫는다
    for (const [name,e] of Object.entries(p.empires || {})) if (name.trim() && e && typeof e === 'object') {
      let flag: string | undefined;
      if (base && typeof e.flag === 'string' && !path.isAbsolute(e.flag)) { const target = path.resolve(base,e.flag), rel = path.relative(base,target); if (rel && !rel.startsWith('..') && !path.isAbsolute(rel) && /\.(png|jpg|jpeg)$/i.test(rel)) flag=target; }
      this.empires.set(name.trim(),{ lore:plain(e.lore,600), flag, base });
    }
    for (const [id,e] of Object.entries(p.events || {})) if (key(id) && e && plain(e.title,120)) this.events.set(p.id+':'+id,{ title:plain(e.title,120), description:plain(e.description,240), pack:p.id });
  }
  policy(type: string): CountryRule {
    this.refresh(); const basic=['default','fallen_empire','awakened_fallen_empire'].includes(type);
    // 알파 8(2026-10-19): 규칙이 없는 특수 나라(모드 특수 제국 등)도 통신이 닿으면 「대화 전용」 — 게임 행동은 보내지 않는다.
    return this.countries.get(type) ?? { contact:basic || (!!type && !VANILLA_NO_CONTACT.has(type)), actions:basic, description:'' };
  }
  empire(name: string) { this.refresh(); return this.empires.get(name.trim()); }
  lore(name: string) { this.refresh(); const e=this.empires.get(name.trim()); return e?.lore ? {text:e.lore,source:'compatibility override'} : this.lores.get(name.trim()) ?? null; }
  /** 게임 키(civic_·origin_·trait_·auth_)의 화면 언어 이름. 번역이 없으면 키를 읽기 좋게(2026-11-03). */
  nameOf(id: string): string { this.refresh(); const t = this.localizedText.get(id); return t && t.trim() ? t.trim() : prettyKey(id); }
  biography(text: string): string { this.refresh(); return this.localizedText.get(text.trim()) || text; }
  flagOverride(name: string): string | null {
    const file = this.empire(name)?.flag; if (!file) return null;
    try { if (fs.statSync(file).size > 5*1024*1024) return null; const b=fs.readFileSync(file), png=b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), jpg=b.length>3&&b[0]===255&&b[1]===216&&b[2]===255; return png||jpg ? 'data:image/'+(png?'png':'jpeg')+';base64,'+b.toString('base64') : null; } catch { return null; }
  }
  describe(ids: string[]): EthicInfo[] { this.refresh(); return [...new Set(ids)].slice(0,24).map(id=>this.ethics.get(id) ?? { id,name:id,description:'설명 미확인',behavior:'',source:'unknown' }); }
  text(ids: string[]): string { return this.describe(ids).map(e => e.name+' ['+e.id+']: '+[e.description,e.behavior].filter(Boolean).join(' ')).join('\n').slice(0,2400); }
  liveFor(sid: string, idx: number): { ids: string[]; date: string } | null { const p=this.live.get(idx); return p?.sid===sid ? p : null; }
  feed(m: SllmMessage, sid: string): void {
    const k=m.kv, req=Number(k.req), idx=Number(k.idx); if (!Number.isSafeInteger(req)||req<=0||k.sid!==sid||!sid) return;
    if (m.kind==='ETHIC_BEGIN' && Number.isSafeInteger(idx)&&idx>0) this.pending.set(req,{sid,idx,ids:[],date:k.date||''});
    const p=this.pending.get(req); if (!p||p.sid!==sid||idx!==p.idx) return;
    if (m.kind==='ETHIC'&&key(k.id)&&!p.ids.includes(k.id)) p.ids.push(k.id);
    if (m.kind==='ETHIC_END') { this.live.set(idx,{sid,ids:p.ids,date:p.date}); this.pending.delete(req); }
  }
  /** Only identifiers from installed definitions/validated packs enter script syntax. */
  queryBody(idx: number, req: number): string {
    this.refresh(); if (!Number.isSafeInteger(idx)||idx<=0||!Number.isSafeInteger(req)||req<=0) return '';
    const ids=[...this.installedEthics].filter(key); if (!ids.length) return ''; if (ids.length>256) { const warning=L('가치관 256개 초과: 실시간 조회 대신 세이브 정보 사용','More than 256 ethics: using save data instead of live lookup'); if (!this.warnings.includes(warning)) this.warnings.push(warning); return ''; }
    const fields='sid=\\\\[Prev.sllm_save_id]/;/idx='+idx+'/;/req='+req;
    return 'every_country = { limit = { check_variable = { which = sllm_idx value = '+idx+' } } log = "SLLM:ETHIC_BEGIN/;/'+fields+'/;/date=\\\\[GetDate]" '+ids.map(id=>'if = { limit = { has_ethic = '+id+' } log = "SLLM:ETHIC/;/'+fields+'/;/id='+id+'" }').join(' ')+' log = "SLLM:ETHIC_END/;/'+fields+'" }';
  }
  event(m: SllmMessage, sid: string): RadioEvent | null {
    if (m.kind!=='COMPAT_EVENT') return null; this.refresh(); const k=m.kv, e=this.events.get(k.pack+':'+k.event), n=Number(k.n);
    if (!e||!sid||k.sid!==sid||!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(k.date||'')||!Number.isSafeInteger(n)||n<=0) { this.lastEvents.push(L('거부: ','Rejected: ')+plain(k.pack,80)+':'+plain(k.event,80)+L(' (호환 파일·세이브·날짜·번호 확인 필요)',' (check the compatibility file, save, date and number)')); this.lastEvents=this.lastEvents.slice(-12); return null; }
    if (k.phase && !['complete','occurred'].includes(k.phase)) return null;
    const uid=[sid,k.pack,k.event,k.date,n].join('|'); if (this.seenEvents.has(uid)) return null; this.seenEvents.add(uid); if (this.seenEvents.size>5000) this.seenEvents.delete(this.seenEvents.values().next().value!);
    const text=[e.title,e.description,plain(k.who,80),plain(k.where,80)].filter(Boolean).join(' · ');
    this.lastEvents.push(L('수신: ','Received: ')+k.pack+':'+k.event+' '+k.date); this.lastEvents=this.lastEvents.slice(-12);
    return {kind:'compat:'+k.pack+':'+k.event,date:k.date,text,n};
  }
  diagnostics() { this.refresh(); return { roots:this.resources.roots.map(r=>({name:r.name,id:r.id,path:r.dir||r.archive,replace:r.replace})), packs:this.loaded, ethics:[...this.ethics.values()].map(e=>({id:e.id,name:e.name,source:e.source})), countryRules:[...this.countries].map(([type,rule])=>({type,...rule})), warnings:[...new Set([...this.resources.warnings,...this.warnings])].slice(0,100), events:this.lastEvents, liveEthics:[...this.live].map(([idx,e])=>({idx,...e})), folder:this.folder() }; }
}
