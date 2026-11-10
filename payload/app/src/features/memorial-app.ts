// 집무실 4단계: 작별·추모관(앱 쪽, 2026-10-18). 순수 로직은 src/memorial.ts.
// 모드가 지도자 사망·해임 때 SLLM:LEADEROUT(lid·why·date·name)을 남기면(people-app 이 넘겨 줌) 그 순간의 자료로 비석을 세우거나(사망)
// 「떠난 사람들」에 올린다(해임). 명단에서 이유 없이 사라진 인물은 「행방 불명」, 다시 나타나면 지운다.
// 작별 편지는 매달 명단 뒤에 관계 깊은 순으로 FAREWELL_CAP 통(letters-app.addFarewell). 비문은 비석을 처음 볼 때 AI 한 번.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { redactKey } from '../aiclient';
import { office, officeView, setOfficeMemorial, pushOffice } from './office-app';
import { fleetView } from './fleet-app';
import { peopleOf, onPeopleChanged, onLeaderOut, onPeopleMonth } from './people-app';
import { memOf, personaNote, personaJson } from './persona-app';
import { addFarewell, lettersFrom } from './letters-app';
import { gestaltCode } from './gestalt-app';
import { chronNote } from './chronicle-app';
import { pick, selectedLanguage } from './settings-ui';
import { traitLoc, traitLabel } from '../trait-names';
import { parseJson, ROLE_KO } from '../persona';
import { type MemorialSave, type Stone, type OutWhy, emptyMemorial, deathKind, farewellWorthy, bondScore, pickFarewells, colleagues, colleagueMemo, chronLine, deeds, epitaphMessages, cleanEpitaph } from '../memorial';

const L = pick;
const ROLE_EN: Record<string, string> = { ruler: 'Ruler', governor: 'Governor', admiral: 'Admiral', general: 'General', scientist: 'Scientist', commander: 'Commander', official: 'Official' };
const roleName = (r: string) => (r === 'agent' ? L('첩보 공작원', 'Field agent') : L(ROLE_KO[r] ?? '인물', ROLE_EN[r] ?? 'Leader'));
type QItem = MemorialSave['queue'][number] & { lid?: number; name?: string; role?: string; traits?: string[] };
let data: Record<string, MemorialSave> | null = null;
const file = () => path.join(app.getPath('userData'), 'sllm_memorial.json');
function all(): Record<string, MemorialSave> {
  if (data) return data;
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); data = j && typeof j === 'object' ? j : {}; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'memorial', error: e }); data = {}; }
  return data!;
}
function save(): void { try { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(all()), 'utf8'); fs.renameSync(tmp, file()); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'memorial', error: e }); } }
const saveOf = (sid: string): MemorialSave => { const s = (all()[sid] ??= emptyMemorial()); s.stones ??= []; s.departed ??= []; s.queue ??= []; return s; };
const unseen = (): number => (ctx.curSaveId ? saveOf(ctx.curSaveId).stones.filter((x) => !x.seen).length : 0);
const loc = () => traitLoc(ctx.flagProv.game(), selectedLanguage() === 'ko' ? 'ko' : 'en'); // i18n-data: 게임 지역화 폴더 고르기

/** 모드 신호: 사망(death)·해임(fired). 그 순간 아직 명단에 있는 자료로 남긴다. */
/** 처형 사건이 맡은 사망인지(execution-app, 2026-10-23). main.ts 가 꽂는다 — 처형은 추모·작별과 겹치지 않게 한 사건으로(06). */
let execOwns: (sid: string, lid: number) => boolean = () => false;
export function setMemorialExecutionCheck(f: (sid: string, lid: number) => boolean): void { execOwns = f; }
function onOut(kv: Record<string, string>): void {
  const sid = ctx.curSaveId, lid = Number(kv.lid), why0 = kv.why; if (!sid || !Number.isInteger(lid) || lid <= 0 || (why0 !== 'death' && why0 !== 'fired')) return;
  if (why0 === 'death' && execOwns(sid, lid)) return; // 처형된 인물(06)
  const s = saveOf(sid), key = 'p:' + lid, date = String(kv.date || ctx.gameDate || '').trim();
  if (s.stones.some((x) => x.key === key)) return;
  s.departed = s.departed.filter((d) => !(d.key === key && d.why === 'lost')); // 명단이 먼저 와서 행방 불명으로 올렸던 경우
  if (s.departed.some((d) => d.key === key)) return;
  const op = (officeView().people as Array<{ key: string; role: string; planet?: string; fleet?: string; place?: string; council?: boolean; traits?: string[] }>).find((p) => p.key === key);
  const raw = peopleOf(sid).find((p) => p.lid === lid);
  const adm = (fleetView().admirals as Array<{ lid: number; status?: string; battles: Array<{ date?: string }> }>).find((a) => a.lid === lid);
  const name = String(raw?.name || kv.name || '').trim().slice(0, 60); if (!name) return;
  const role = op?.role ?? (raw?.ruler ? 'ruler' : raw?.cls ?? 'official');
  const mem = memOf(sid, key), letters = lettersFrom(sid, key);
  let why: OutWhy = why0;
  if (why0 === 'death') {
    why = deathKind((adm?.battles ?? []).map((b) => b.date ?? ''), date);
    const st: Stone = { key, lid, name, role, why: why as 'death' | 'fallen', first: raw?.first ?? '', gone: date, lv: raw?.lv, ...(raw?.traits?.length ? { traits: raw.traits.slice() } : {}),
      ...(op?.planet ? { planet: op.planet } : {}), ...(op?.fleet || raw?.fleet ? { fleet: op?.fleet ?? raw?.fleet } : {}), ...(raw?.council ? { council: true } : {}),
      ...(adm ? { battles: adm.battles.length, acclaimed: adm.status === 'acclaimed', reprimanded: adm.status === 'reprimanded' } : {}),
      letters, talks: mem.talks, trust: mem.trust, mems: mem.mems.slice(-3).map((m) => m.text), seen: false };
    s.stones.push(st);
    if (ctx.playerIdx > 0) chronNote(ctx.playerIdx, chronLine(st), true);
    const living = (officeView().people as Array<{ key: string; role: string; council?: boolean }>).filter((p) => p.key.startsWith('p:'));
    for (const k of colleagues({ key, role, council: !!raw?.council }, living, (k2) => memOf(sid, k2).talks > 0)) personaNote(sid, k, colleagueMemo(name, st.why));
    office.toastGo = 'memorial';
    ctx.notify({ kind: 'office', title: st.why === 'fallen' ? L(`${roleName(role)} ${name} 전사`, `${roleName(role)} ${name} has fallen`) : L(`${roleName(role)} ${name} 서거`, `${roleName(role)} ${name} has passed away`), body: L('추모관에 이름이 올랐습니다.', 'Their name has been added to the Memorial.'), action: L('추모관', 'Memorial') });
  } else s.departed.push({ key, lid, name, role, why: 'fired', date, first: raw?.first ?? '' });
  if (farewellWorthy(mem, letters)) {
    const l = loc();
    (s.queue as QItem[]).push({ key, why, score: bondScore(mem, letters), date, lid, name, role, traits: (raw?.traits ?? []).filter((t) => !/^subclass_/.test(t)).map((t) => traitLabel(l.names, t)) });
  }
  save(); pushOffice();
  logDiagnostic('info', 'memorial.out', { why, queued: s.queue.length });
}

/** 첩보 공작원 연락 두절(agents-app, 2026-10-20): 세상을 떠났는지 모르므로 추모관이 아니라 「떠난 사람들」(행방 불명). */
export function memorialAgentLost(a: { key: string; name: string; code: string; first: string; date: string }): void {
  const sid = ctx.curSaveId; if (!sid) return; const s = saveOf(sid);
  if (s.departed.some((d) => d.key === a.key)) return;
  s.departed.push({ key: a.key, lid: 0, name: a.name.slice(0, 80), role: 'agent', why: 'lost', date: a.date, first: a.first }); save(); pushOffice();
  office.toastGo = 'memorial';
  ctx.notify({ kind: 'office', title: L(`공작원 「${a.code}」와(과) 연락이 끊겼습니다`, `Contact lost with agent "${a.code}"`), body: L('첩보망이 무너졌습니다. 「떠난 사람들」에 행방 불명으로 올랐습니다. 첩보망을 다시 세우면 새 공작원이 부임합니다.', 'The spy network has collapsed. They are listed as missing among the departed. Rebuild the network and a new agent will be posted.'), action: L('추모관', 'Memorial') });
  logDiagnostic('info', 'memorial.agent_lost', {});
}
/** 매달(명단 뒤): 작별 편지 보내기(관계 깊은 순으로 3통), 이유 없이 사라진 인물은 행방 불명, 돌아온 인물은 지우기. */
function onMonth(): void {
  const sid = ctx.curSaveId; if (!sid) return;
  const s = saveOf(sid), people = peopleOf(sid); let ch = false;
  if (s.queue.length) {
    for (const q of pickFarewells(s.queue as QItem[])) if (q.why !== 'lost' && q.lid && q.name) addFarewell(sid, { key: q.key, lid: q.lid, name: q.name, role: q.role ?? 'official', why: q.why, date: q.date, traits: q.traits });
    s.queue = []; ch = true;
  }
  const roster = people.filter((p) => !p.gone).map((p) => p.last).sort().pop();
  if (roster) for (const p of people) {
    const key = 'p:' + p.lid;
    if (p.gone && p.gone === roster && !execOwns(sid, p.lid) && !s.stones.some((x) => x.key === key) && !s.departed.some((d) => d.key === key)) { s.departed.push({ key, lid: p.lid, name: p.name, role: p.ruler ? 'ruler' : p.cls, why: 'lost', date: p.gone, first: p.first }); ch = true; }
    if (!p.gone && s.departed.some((d) => d.key === key)) { s.departed = s.departed.filter((d) => d.key !== key); ch = true; } // 돌아옴(포로 석방 등)
  }
  if (ch) { save(); pushOffice(); }
}

function stoneView(st: Stone) {
  const l = loc();
  return { ...st, roleName: roleName(st.role), traitNames: (st.traits ?? []).filter((t) => !/^subclass_/.test(t)).map((t) => traitLabel(l.names, t)), deeds: deeds(st) };
}
function listView() {
  const sid = ctx.curSaveId, s = sid ? saveOf(sid) : emptyMemorial();
  return { sid, stones: s.stones.slice().reverse().map(stoneView), departed: s.departed.slice().reverse().map((d) => ({ ...d, roleName: roleName(d.role) })), unseen: s.stones.filter((x) => !x.seen).length };
}
const busy = new Set<string>();

export function registerMemorial(): void {
  setOfficeMemorial(unseen);
  onLeaderOut(onOut);
  onPeopleChanged(onMonth);
  onPeopleMonth(onMonth); // 2026-11-03: 명단이 매달 오지 않으므로 작별 대기열은 달마다 처리
  ipcMain.handle('memorialList', async () => listView());
  ipcMain.handle('memorialSeen', async (_e, key: unknown) => { const sid = ctx.curSaveId; if (!sid) return null; const st = saveOf(sid).stones.find((x) => x.key === String(key)); if (st && !st.seen) { st.seen = true; save(); pushOffice(); } return st ? stoneView(st) : null; });
  /** 비문: 없으면 이때 한 번 AI. */
  ipcMain.handle('memorialEpitaph', async (_e, key: unknown) => {
    const sid = ctx.curSaveId, k = String(key ?? ''); if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 볼 수 있습니다.', 'Load a save first.') };
    const st = saveOf(sid).stones.find((x) => x.key === k); if (!st) return { ok: false, error: L('비석을 찾지 못했습니다.', 'Stone not found.') };
    if (st.epitaph) return { ok: true, stone: stoneView(st) };
    if (busy.has(k)) return { ok: false, error: L('비문을 새기는 중입니다.', 'Still engraving.') };
    busy.add(k);
    try {
      const v = stoneView(st);
      const t = cleanEpitaph((await personaJson(epitaphMessages(st, memOf(sid, k).persona ?? '', v.traitNames, ctx.playerName || '', gestaltCode()), 800, 'epitaph'))?.epitaph);
      if (!t) return { ok: false, stone: v, error: L('비문을 읽지 못했습니다. 직접 새겨 보세요.', 'Could not read the epitaph. Try writing one yourself.') };
      if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
      st.epitaph = t; st.epitaphBy = 'ai'; save();
      return { ok: true, stone: stoneView(st) };
    } catch (e) { return { ok: false, stone: stoneView(st), error: redactKey(L('비문을 새기지 못했습니다: ', 'Could not engrave: ') + (e as Error).message) }; }
    finally { busy.delete(k); }
  });
  ipcMain.handle('memorialSetEpitaph', async (_e, key: unknown, text: unknown) => {
    const sid = ctx.curSaveId; if (!sid) return null; const st = saveOf(sid).stones.find((x) => x.key === String(key)); const t = cleanEpitaph(text);
    if (!st || !t) return null; st.epitaph = t; st.epitaphBy = 'me'; save(); return stoneView(st);
  });
}
