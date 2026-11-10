// 관저 파티(2026-11-03 사용자 결정 — 매스 이펙트 3 시타델 DLC 파티처럼, 사교회와 다른 우리 사람들끼리의 사적인 파티). 규칙: src/party.ts, 화면: ui/party.html.
// 개인실의 「관저 파티」 단추로 엶. 손님 고르기 → 세 장면(손님 맞이 · 한창 · 늦은 밤) → 단체 사진으로 마침.
// 손님끼리의 수다·소동은 틀 문장(AI 없음). 통치자가 손님에게 직접 말을 걸 때만 AI(1:1 과 같은 셈법 — sayInPerson).
// 마치면: 손님마다 신뢰 +3과 기억 한 줄, 함께 어울린 지도자끼리 관계 교류(사교회 장부), 통합력 아주 조금(360일), 전쟁·위기 중이면 전투 보정 아주아주 조금(360일). 주기 180일.
import { app, ipcMain, BrowserWindow, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { terminalRequest } from './terminal';
import { officeView } from './office-app';
import { personOf, personaNote, sayInPerson } from './persona-app';
import { outingPartners } from './romance-app';
import { partyExchanges } from './relations-app';
import { imageState } from './images';
import { personImageKey } from '../images';
import { chronNoteWorld } from './chronicle-app';
import { gameState } from './gamestate-app';
import { crisisView } from './crisis-app';
import { foreignContactsOf } from './fbanquet-app';
import { rosterCached } from './isc-app';
import type { Talk, PersonInfo } from '../persona';
import { PARTY, SPOTS, PHASES, type Guest, type Scene, groupOf, planScene, groupNote, pairsOf, daysUntil, partyCommand, hashStr, partyForeignCommand, foreignCount, foreignPartyMessages, partyTone } from '../party';

interface Album { date: string; guests: string[]; resolve: boolean; foreign?: string[]; photo?: string }
interface Store { [sid: string]: { last?: string; album: Album[] } }
const file = () => path.join(app.getPath('userData'), 'sllm_party.json');
let store: Store | null = null;
function load(): Store { if (store) return store; try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); store = j && typeof j === 'object' ? j : {}; } catch { store = {}; } return store!; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(load())); } catch { /* 다음에 다시 */ } }
// 2026-11-03 단체 사진을 그림으로 남김(사진첩에서 다시 보기) — userData/party_photos/<파일>
const photoDir = () => path.join(app.getPath('userData'), 'party_photos');
const photoName = (sid: string) => `${sid.replace(/[^\w-]/g, '_')}_${Date.now()}.jpg`;
/** 사진 번호(파일 이름의 찍은 시각) — 일지에 [[📷:번호]]로 붙인다(2026-11-03 다꾸). */
export const photoId = (file: string): string => (/_(\d{10,16})\.jpg$/.exec(file) ?? [])[1] ?? '';
/** 일지에 붙인 사진 → 짧은 설명(비서에게 일지를 보여 줄 때 그림 대신). 못 찾으면 null. */
export function partyPhotoNote(sid: string, id: string): string | null {
  const a = (load()[sid]?.album ?? []).find((x) => x.photo && photoId(x.photo) === id); return a ? L(`[사진: ${a.date} 관저 파티 단체 사진 — ${a.guests.join(', ')}]`, `[Photo: group photo from the ${a.date} house party — ${a.guests.join(', ')}]`) : null;
}
const slot = (sid: string) => { const s = load(); const v = (s[sid] ??= { album: [] }); v.album ??= []; return v; };

interface Party { sid: string; guests: Guest[]; seed: number; phase: number; scenes: Scene[]; talks: Record<string, Talk>; ftalk: Record<string, Array<{ who: 'me' | 'them'; text: string }>>; chat: Array<{ who: 'me' | 'them' | 'sys'; key?: string; name?: string; text: string }>; over: boolean; resolve: boolean; busy: boolean }
const groupLine = (P: Party): void => { const sc = P.scenes[P.phase], n = sc ? groupNote(sc, P.guests) : null; if (n) P.chat.push({ who: 'sys', text: L(n.ko, n.en) }); if (sc?.incident) P.chat.push({ who: 'sys', text: `${sc.incident.icon ?? '✨'} ${L(sc.incident.ko, sc.incident.en)}` }); }; // 2026-11-03 사교회처럼 모인 무리 + 소동도 대화창에 남김
/** 파티 말투 문단에 넣을 「지금 벌어지는 일」(최근 대화창 몇 줄)과 같은 자리 손님 이름. */
const moodOf = (P: Party, key: string): { others: string[]; happening: string[] } => {
  const sc = P.scenes[P.phase], spot = Object.entries(sc?.seats ?? {}).find(([, ks]) => ks.includes(key))?.[0], near = spot ? (sc?.seats?.[spot] ?? []) : [];
  const nameOf = (k: string) => P.guests.find((g) => g.key === k)?.name ?? '';
  const others = (near.length > 1 ? near : P.guests.map((g) => g.key)).filter((k) => k !== key).map(nameOf).filter(Boolean);
  const happening = P.chat.slice(-8).map((c) => (c.who === 'sys' ? c.text : c.who === 'me' ? `Ruler to ${c.name}: ${c.text}` : `${c.name}: ${c.text}`));
  return { others, happening };
};
let party: Party | null = null;
let win: BrowserWindow | null = null;
const THEMES = ['authoritarian', 'egalitarian', 'xenophile', 'xenophobe', 'militarist', 'pacifist', 'spiritualist', 'materialist'];
let theme = 'authoritarian'; // 개인실 그림과 같은 성향(개인실이 알려 줌)

const lidOf = (key: string): number | null => { const m = /^(?:p|adm):(\d+)$/.exec(key); return m ? Number(m[1]) : null; };
const atWar = (): boolean => gameState.last?.sid === ctx.curSaveId && (gameState.last?.wars?.length ?? 0) > 0;
const inCrisis = (): boolean => { try { return !!crisisView().active; } catch { return false; } };
/** 지금 우리와 전쟁 중인 나라(이름 또는 번호). */
function warFoes(): { names: Set<string>; idx: Set<number> } {
  const names = new Set<string>(), idx = new Set<number>();
  try { if (gameState.last?.sid === ctx.curSaveId) for (const w of gameState.last?.wars ?? []) { const foe = w.side === 'att' ? w.defender : w.attacker; if (foe) names.add(foe.trim()); } } catch { /* 없음 */ }
  try { for (const r of rosterCached()) if (r.atWar) idx.add(r.idx); } catch { /* 없음 */ }
  return { names, idx };
}
/** 타국 손님 후보(2026-11-03 사용자): 사교 만찬에서 연락처를 주고받은 다른 나라 지도자. 통치자·떠난 사람·전쟁 중인 나라는 뺀다. */
function foreignCandidates(): Array<Guest & { img: string | null; kind: string }> {
  const sid = ctx.curSaveId; if (!sid) return []; const foes = warFoes();
  let list: ReturnType<typeof foreignContactsOf> = []; try { list = foreignContactsOf(sid); } catch { list = []; }
  return list.filter((c) => c && c.pid && c.status !== 'gone' && !/ruler/i.test(c.cls || '') && !foes.idx.has(c.empireIdx) && !foes.names.has((c.empireName || '').trim()))
    .map((c) => ({ key: c.pid, name: c.name, role: `${c.cls || 'leader'} · ${c.empireName}`, group: groupOf(c.cls || ''), talk: true, img: null, kind: 'foreign', foreign: { idx: c.empireIdx, empire: c.empireName } }));
}
/** 부를 수 있는 사람: 우리 지도자(통치자 빼고) + 연인·배우자(비서 포함). 초상화는 사용자가 넣은 지도자 그림이 있으면. */
function candidates(sid: string): Array<Guest & { img: string | null; kind: string }> {
  let imgs: Record<string, string> = {}; try { imgs = (imageState() as { images?: Record<string, string> }).images ?? {}; } catch { /* 그림 없음 */ }
  const pic = (key: string, name: string) => { const k = personImageKey(sid, lidOf(key), name); return (k && imgs[k]) || null; };
  const out = new Map<string, Guest & { img: string | null; kind: string }>();
  let people: PersonInfo[] = []; try { people = (officeView().people as PersonInfo[]) ?? []; } catch { people = []; }
  for (const p of people) { if (!p || !p.key || /ruler/i.test(p.role) || p.status === 'dead') continue; out.set(p.key, { key: p.key, name: p.name, role: p.role, group: groupOf(p.role), talk: true, img: pic(p.key, p.name), kind: 'leader' }); }
  try { for (const x of outingPartners(sid)) { const cur = out.get(x.key); if (cur) { cur.group = 'fam'; cur.kind = 'partner'; } else out.set(x.key, { key: x.key, name: x.name, role: 'partner', group: 'fam', talk: !!personOf(x.key), img: pic(x.key, x.name), kind: 'partner' }); } } catch { /* 연인 없음 */ }
  for (const f of foreignCandidates()) if (!out.has(f.key)) out.set(f.key, f);
  return [...out.values()];
}
/** 사진 한가운데 설 통치자(이름·초상화). 못 찾으면 null. */
function hostOf(sid: string): { name: string; img: string | null } | null {
  try { const r = (officeView().people as PersonInfo[]).find((p) => p && /ruler/i.test(p.role)); if (!r) return null;
    let imgs: Record<string, string> = {}; try { imgs = (imageState() as { images?: Record<string, string> }).images ?? {}; } catch { /* 그림 없음 */ }
    const k = personImageKey(sid, lidOf(r.key), r.name); return { name: r.name, img: (k && imgs[k]) || null }; } catch { return null; }
}
export function partyView() {
  const sid = ctx.curSaveId; if (!sid) return { sid: '', ready: false };
  const S = slot(sid), wait = daysUntil(S.last, ctx.gameDate || ''), P = party && party.sid === sid ? party : null;
  return {
    sid, ready: true, wait, date: ctx.gameDate || '', war: atWar(), crisis: inCrisis(), limits: { min: PARTY.minGuests, max: PARTY.maxGuests, foreign: PARTY.maxForeign },
    spots: SPOTS.map((s) => ({ id: s.id, name: L(s.ko, s.en), x: s.x, y: s.y })), phases: PHASES.map((p) => L(...p)),
    candidates: P ? [] : candidates(sid), album: S.album.map((x, n) => ({ ...x, n })).slice(-12).reverse(), host: P && P.over ? hostOf(sid) : null,
    art: (() => { const rel = `party/${theme}-party.webp`; return { bg: fs.existsSync(path.join(__dirname, '..', '..', 'ui', rel)) ? rel : null }; })(), // 19번 의뢰서: 성향별 관저 파티장
    party: P ? { guests: P.guests.map((g) => ({ ...g, img: (candidatesCache.get(g.key) ?? null) })), phase: P.phase, phaseName: P.phase >= 0 ? L(...PHASES[P.phase]) : '', scene: P.scenes[P.phase] ? sceneView(P.scenes[P.phase], P.guests) : null, chat: P.chat.slice(-60), over: P.over, busy: P.busy, last: P.phase >= PARTY.phases - 1 } : null,
  };
}
const candidatesCache = new Map<string, string | null>();
function sceneView(s: Scene, guests: Guest[]) {
  const name = (k: string) => guests.find((g) => g.key === k)?.name ?? '';
  return { seats: s.seats, chats: s.chats.map((c) => ({ a: c.a, b: c.b, who: c.who ?? [c.a, c.b], group: !!c.group, an: name(c.a), bn: name(c.b), lines: L(c.ko.join('\n'), c.en.join('\n')).split('\n') })), incident: s.incident ? { spot: s.incident.spot, who: s.incident.who, icon: s.incident.icon ?? '✨', text: L(s.incident.ko, s.incident.en) } : null };
}
function push(): void { const v = partyView(); for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('partyUpdate', v); }
const need = () => { const sid = ctx.curSaveId; if (!sid) throw new Error(L('세이브를 불러온 뒤에 열 수 있습니다.', 'Load a save first.')); return sid; };
const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, state: partyView(), ...extra });
const err = (e: unknown) => ({ ok: false, error: String((e as Error)?.message || e), state: partyView() });

export function openParty(t?: unknown): { ok: boolean; error?: string } {
  if (typeof t === 'string' && THEMES.includes(t)) theme = t;
  if (!ctx.curSaveId) return { ok: false, error: L('세이브를 불러온 뒤에 열 수 있습니다.', 'Load a save first.') };
  if (win && !win.isDestroyed()) { win.show(); win.focus(); push(); return { ok: true }; }
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea, sz = { width: Math.min(1600, Math.round(area.width * 0.92)), height: Math.min(940, Math.round(area.height * 0.92)) };
  const w = new BrowserWindow({ ...sz, x: Math.round(area.x + (area.width - sz.width) / 2), y: Math.round(area.y + (area.height - sz.height) / 2), minWidth: 980, minHeight: 620, frame: false, show: false, backgroundColor: '#0d0a12', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win = w; w.setAlwaysOnTop(true, 'screen-saver', 1); void w.loadFile(path.join(__dirname, '..', '..', 'ui', 'party.html'));
  w.once('ready-to-show', () => { w.show(); push(); }); w.on('closed', () => { if (win === w) win = null; });
  return { ok: true };
}

/** 효과 보내기(통합력·전투 보정). 게임이 꺼져 있으면 건너뜀(기록만). */
async function sendBuff(sid: string, resolve: boolean): Promise<boolean> {
  if (!ctx.gameRunning || !link.sessionReady) return false;
  try { const req = ++link.reqCounter, m = await terminalRequest(partyCommand(req, sid, resolve), 'PARTYFX', req); return m.kv.status === 'applied'; }
  catch (e) { logDiagnostic('warn', 'party.buff_failed', { error: (e as Error).message }); return false; }
}

/** 타국 손님의 나라에 호감(아주 조금). */
async function sendGoodwill(sid: string, idxs: number[]): Promise<boolean> {
  if (!ctx.gameRunning || !link.sessionReady) return false;
  try { const req = ++link.reqCounter, m = await terminalRequest(partyForeignCommand(req, sid, idxs), 'PARTYFG', req); return m.kv.status === 'applied'; }
  catch (e) { logDiagnostic('warn', 'party.goodwill_failed', { error: (e as Error).message }); return false; }
}
async function foreignTalk(sid: string, P: Party, g: Guest, text: string) {
  if (P.busy) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for a reply.'));
  if (!text) throw new Error(L('할 말을 입력하세요.', 'Type something to say.'));
  const lines = (P.ftalk[g.key] ??= []), sc = P.scenes[P.phase], spot = Object.entries(sc?.seats ?? {}).find(([, ks]) => ks.includes(g.key))?.[0], where = SPOTS.find((s) => s.id === spot);
  const prof = ctx.profileWithEthics(ctx.profiles.get(g.foreign!.idx), g.foreign!.idx) as unknown as Record<string, unknown> | undefined, str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : undefined);
  let ruler = ''; try { ruler = (officeView().people as PersonInfo[]).find((p) => /ruler/i.test(p.role))?.name ?? ''; } catch { /* 없음 */ }
  P.busy = true; P.chat.push({ who: 'me', key: g.key, name: g.name, text }); push();
  try {
    const raw = String(await ctx.ai.chat(foreignPartyMessages({ host: ctx.playerName, ruler, guest: g.name, role: g.role, empire: g.foreign!.empire, phase: PHASES[P.phase][1], spot: where?.en, ...moodOf(P, g.key), ethics: str(prof?.ethicsText), personality: str(prof?.personality) }, lines, text), { maxTokens: 400, purpose: 'party-foreign' }) ?? '').trim();
    if (!raw) throw new Error(L('대답이 오지 않았습니다.', 'No reply came.'));
    const reply = raw.slice(0, 1200); lines.push({ who: 'me', text }, { who: 'them', text: reply }); if (lines.length > 30) lines.splice(0, lines.length - 30);
    P.chat.push({ who: 'them', key: g.key, name: g.name, text: reply }); return ok({ reply });
  } catch (e) { P.chat.push({ who: 'sys', text: String((e as Error)?.message || L('대답을 받지 못했습니다.', 'No reply.')) }); return ok({ reply: null }); }
  finally { P.busy = false; push(); }
}

export function registerParty(): void {
  ipcMain.handle('partyState', () => partyView());
  ipcMain.handle('partyOpen', (_e, t: unknown) => openParty(t));
  ipcMain.handle('partyClose', () => { if (win && !win.isDestroyed()) win.close(); return true; });
  ipcMain.handle('partyStart', (_e, keys: unknown) => { try { const sid = need(), S = slot(sid);
      if (party && party.sid === sid && !party.over) throw new Error(L('이미 파티가 진행 중입니다.', 'A party is already under way.'));
      const wait = daysUntil(S.last, ctx.gameDate || ''); if (wait > 0) throw new Error(L(`지난 파티의 뒷정리가 아직입니다. ${wait}일 뒤에 다시 열 수 있습니다.`, `The last party is still being cleaned up. You can host again in ${wait} days.`));
      const all = candidates(sid), want = Array.isArray(keys) ? keys.map(String) : [], guests = all.filter((g) => want.includes(g.key)).slice(0, PARTY.maxGuests);
      if (foreignCount(guests.map((g) => g.key)) > PARTY.maxForeign) throw new Error(L(`다른 나라 손님은 ${PARTY.maxForeign}명까지 부를 수 있습니다.`, `You can invite up to ${PARTY.maxForeign} guests from other empires.`));
      if (guests.length < PARTY.minGuests) throw new Error(L(`손님을 ${PARTY.minGuests}명 이상 골라 주세요.`, `Invite at least ${PARTY.minGuests} guests.`));
      candidatesCache.clear(); for (const g of guests) candidatesCache.set(g.key, g.img);
      const seed = (hashStr(sid + '|' + (ctx.gameDate || '')) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      party = { sid, guests: guests.map(({ key, name, role, group, talk, foreign }) => ({ key, name, role, group, talk, ...(foreign ? { foreign } : {}) })), seed, phase: 0, scenes: [], talks: {}, ftalk: {}, chat: [], over: false, resolve: atWar() || inCrisis(), busy: false };
      party.scenes.push(planScene(party.guests, 0, seed)); party.chat.push({ who: 'sys', text: L(`손님들이 관저에 도착하기 시작합니다. (${party.guests.length}명)`, `Guests begin arriving at the residence. (${party.guests.length})`) }); groupLine(party);
      push(); return ok(); } catch (e) { return err(e); } });
  ipcMain.handle('partyNext', () => { try { const sid = need(), P = party; if (!P || P.sid !== sid || P.over) throw new Error(L('진행 중인 파티가 없습니다.', 'No party in progress.'));
      if (P.phase >= PARTY.phases - 1) throw new Error(L('마지막 장면입니다. 단체 사진을 찍고 마치세요.', 'This is the last scene. Take the group photo to end the party.'));
      P.phase++; P.scenes.push(planScene(P.guests, P.phase, P.seed)); P.chat.push({ who: 'sys', text: L(`— ${PHASES[P.phase][0]} —`, `— ${PHASES[P.phase][1]} —`) }); groupLine(P); push(); return ok(); } catch (e) { return err(e); } });
  ipcMain.handle('partyTalk', async (_e, a: { key?: unknown; text?: unknown }) => { try { const sid = need(), P = party; if (!P || P.sid !== sid || P.over) throw new Error(L('진행 중인 파티가 없습니다.', 'No party in progress.'));
      const key = String(a?.key ?? ''), g = P.guests.find((x) => x.key === key); if (!g) throw new Error(L('그 손님은 여기 없습니다.', 'That guest is not here.'));
      if (g.foreign) return await foreignTalk(sid, P, g, String(a?.text ?? '').trim());
      if (!g.talk || !personOf(key)) throw new Error(L('이 손님과는 지금 이야기할 수 없습니다.', 'You cannot talk with this guest right now.'));
      if (P.busy) throw new Error(L('대답을 기다리는 중입니다.', 'Waiting for a reply.'));
      const text = String(a?.text ?? '').trim(); if (!text) throw new Error(L('할 말을 입력하세요.', 'Type something to say.'));
      const talk = (P.talks[key] ??= { key, lines: [], moved: 0, opened: ctx.gameDate || '' }), sc = P.scenes[P.phase], spot = Object.entries(sc?.seats ?? {}).find(([, ks]) => ks.includes(key))?.[0], where = SPOTS.find((s) => s.id === spot);
      const scene = `You are a guest at the ruler's private house party in their residence (not a diplomatic event — just friends and colleagues, drinks and music, off the record). It is the "${PHASES[P.phase][1]}" part of the evening${where ? `, and you are by the ${where.en.toLowerCase()}` : ''}. Speak casually, as at a party.\n${partyTone(moodOf(P, key))}`;
      P.busy = true; P.chat.push({ who: 'me', key, name: g.name, text }); push();
      const r = await sayInPerson(sid, key, talk, text, { scene }); P.busy = false;
      if (r && r.ok) P.chat.push({ who: 'them', key, name: g.name, text: String(r.reply ?? '') }); else P.chat.push({ who: 'sys', text: String(r?.error ?? L('대답을 받지 못했습니다.', 'No reply.')) });
      push(); return ok({ reply: r?.reply ?? null }); } catch (e) { if (party) party.busy = false; return err(e); } });
  /** 단체 사진 — 파티를 마치고 효과를 남긴다. */
  ipcMain.handle('partyFinish', async () => { try { const sid = need(), P = party; if (!P || P.sid !== sid || P.over) throw new Error(L('진행 중인 파티가 없습니다.', 'No party in progress.'));
      const date = ctx.gameDate || '', S = slot(sid); P.over = true;
      for (const g of P.guests) if (personOf(g.key)) personaNote(sid, g.key, L(`${date} 통치자의 관저 파티에 초대받아 즐거운 밤을 보냈다`, `${date} Was invited to the ruler's house party and had a great night`), PARTY.trust);
      let rel = 0; try { rel = partyExchanges(sid, pairsOf(P.scenes).map((x) => ({ a: x.a.replace(/^adm:/, 'p:'), b: x.b.replace(/^adm:/, 'p:'), result: x.result })), date); } catch (e) { logDiagnostic('warn', 'party.relations_failed', { error: (e as Error).message }); }
      const applied = await sendBuff(sid, P.resolve);
      const fidx = P.guests.filter((g) => g.foreign).map((g) => g.foreign!.idx), goodwill = fidx.length ? await sendGoodwill(sid, fidx) : false;
      S.last = date; S.album.push({ date, guests: P.guests.map((g) => g.name), resolve: P.resolve, ...(fidx.length ? { foreign: P.guests.filter((g) => g.foreign).map((g) => `${g.name} (${g.foreign!.empire})`) } : {}) }); if (S.album.length > 40) for (const old of S.album.splice(0, S.album.length - 40)) if (old.photo) try { fs.unlinkSync(path.join(photoDir(), path.basename(old.photo))); } catch { /* 이미 없음 */ } save();
      try { chronNoteWorld(L(`${date} 통치자의 관저 파티 — ${P.guests.map((g) => g.name).join(', ')}`, `${date} The ruler's house party — ${P.guests.map((g) => g.name).join(', ')}`), true); } catch { /* 연대기 실패는 무시 */ }
      P.chat.push({ who: 'sys', text: L('찰칵! 모두 한 장에 담겼습니다.', 'Click! Everyone made it into the photo.') });
      push(); return ok({ result: { trust: PARTY.trust, pairs: rel, buff: applied, resolve: P.resolve, guests: P.guests.length, foreign: fidx.length, goodwill } }); } catch (e) { return err(e); } });
  // 단체 사진 저장: 화면의 사진 액자 부분을 찍어 방금 파티의 사진첩 줄에 붙인다(한 번만)
  ipcMain.handle('partySnap', async (_e, r: unknown) => { try { const sid = need(), P = party, S = slot(sid), last = S.album[S.album.length - 1];
      if (!P || P.sid !== sid || !P.over || !last || last.photo || !win || win.isDestroyed()) return { ok: false };
      const q = r as Record<string, unknown>, n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
      const rect = { x: n(q?.x), y: n(q?.y), width: Math.min(2400, n(q?.width)), height: Math.min(1600, n(q?.height)) }; if (rect.width < 50 || rect.height < 50) return { ok: false };
      let img = await win.webContents.capturePage(rect); if (img.getSize().width > 1400) img = img.resize({ width: 1400, quality: 'good' });
      fs.mkdirSync(photoDir(), { recursive: true }); const name = photoName(sid); fs.writeFileSync(path.join(photoDir(), name), img.toJPEG(88)); last.photo = name; save(); return { ok: true };
    } catch (e) { logDiagnostic('warn', 'party.snap_failed', { error: (e as Error).message }); return { ok: false }; } });
  ipcMain.handle('partyPhoto', (_e, i: unknown) => { try { const S = slot(need()), a = typeof i === 'number' ? S.album[i] : undefined; if (!a || !a.photo) return { ok: false };
      return { ok: true, src: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(photoDir(), path.basename(a.photo))).toString('base64'), date: a.date, guests: a.guests }; } catch { return { ok: false }; } });
  // 2026-11-03 개인 일지의 「사진첩」: 이 세이브에서 찍은 단체 사진(새것부터). 그림은 파일 주소로(무거운 base64 안 씀)
  ipcMain.handle('partyAlbum', () => { try { const S = slot(need()); return { ok: true, photos: S.album.map((a, n) => ({ n, a })).filter(({ a }) => a.photo && fs.existsSync(path.join(photoDir(), path.basename(a.photo)))).reverse()
      .map(({ n, a }) => ({ n, id: photoId(a.photo!), kind: 'party', title: L('관저 파티', 'House party'), date: a.date, guests: a.guests, foreign: a.foreign ?? [], resolve: a.resolve, src: pathToFileURL(path.join(photoDir(), path.basename(a.photo!))).href })) }; } catch (e) { return { ok: false, error: String((e as Error)?.message || e), photos: [] }; } });
  ipcMain.handle('partyLeave', () => { if (party && party.over) party = null; push(); return ok(); });
}
export const _partyTest = { candidates, foreignCandidates, warFoes, reset: () => { party = null; store = {}; } };
