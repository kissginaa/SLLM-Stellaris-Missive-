// 첩보 자산 인물화(2026-10-20 알파 9 ④) — 앱 쪽. 규칙: src/agents.ts.
// 월간 상황(SPYNET 줄)으로 공작원 명부를 맞춘다: 새 첩보망 → 공작원 부임(이름은 상대 제국 종족 이름 표), 두 달 연속 사라지면 연락 두절 → 추모관 「떠난 사람들」.
// 집무실 대사관 화면의 첩보 보고서는 그 나라 공작원이 직접 쓴다(embassy-app).
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { safeKey } from '../music';
import { onGameSnapshot } from './gamestate-app';
import { gameName } from './namegen-app';
import { memorialAgentLost } from './memorial-app';
import { randomName } from '../debate';
import { openGameHearing } from './espionage-app'; // 연락 두절 → 그 나라가 해명 요구(청문회, 2026-10-20)
import { type Agent, newAgent, syncAgents, sanitizeAgents, codename, coverName, mannerName, yearsServed, isVeteran, ASSETS, assetName, unitName, syncContacts, activeContacts, drawAgentLetters, agentLetterMessages, parseAgentLetter, LETTER_KIND_NAME } from '../agents';
import { office } from './office-app'; // 공작원 서신 알림 → 집무실 첩보 화면(2026-10-20)

const file = () => path.join(app.getPath('userData'), 'sllm_agents.json');
let store: ReturnType<typeof sanitizeAgents> | null = null;
function all() { if (store) return store; try { store = sanitizeAgents(JSON.parse(fs.readFileSync(file(), 'utf8'))); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'agents', error: e }); store = sanitizeAgents({}); } return store; }
function save(): void { try { fs.writeFileSync(file(), JSON.stringify(all()), 'utf8'); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'agents', error: e }); } }
const saveOf = (sid: string) => (all().saves[safeKey(sid)] ??= { seq: 0, agents: [] });
const idxOf = (name: string): number => { for (const [i, c] of ctx.mailCountries) if (c.name === name) return i; return 0; };

/** 외교관 위장 공작원이 붙잡혔을 때 대사관 쪽이 할 일(대사 추방) — embassy-app 이 등록한다(가져오기 순환을 피하려고, 2026-10-20). */
export const agentHooks: { dipLost: ((idx: number, host: string, date: string) => void) | null } = { dipLost: null };
/** 그 나라에서 활동 중인 공작원(없으면 null). */
export function agentFor(target: string): Agent | null { const sid = ctx.curSaveId; return sid ? saveOf(sid).agents.find((a) => a.status === 'active' && a.target === target) ?? null : null; }
/** 화면용(한/영 짝으로 — 화면이 L 로 고른다). */
export function agentView(a: Agent, now: string) {
  const sv = ctx.curSaveId ? saveOf(ctx.curSaveId) : null;
  const letters = (sv?.letters ?? []).filter((l) => l.key === a.key).slice(-8).reverse().map((l) => ({ id: l.id, kind: [LETTER_KIND_NAME[l.kind][0], LETTER_KIND_NAME[l.kind][1]], date: l.date, read: l.read, title: l.title ?? '', body: l.body ?? '' }));
  const contacts = activeContacts(a).map((c) => ({ name: c.name, role: [assetName(c.a, true), assetName(c.a, false)], since: c.since, person: !!ASSETS[c.a]?.person }));
  return { name: a.name, code: [codename(a, true), codename(a, false)], cover: [coverName(a, true), coverName(a, false)], manner: [mannerName(a, true), mannerName(a, false)], since: a.since, years: yearsServed(a.since, now), veteran: isVeteran(a, now), dip: !!a.dip, contacts, letters };
}
/** 그 나라 공작원의 안 읽은 서신이 있는지(대상 목록 표시). */
export function agentHasMail(target: string): boolean { const a = agentFor(target), sv = ctx.curSaveId ? saveOf(ctx.curSaveId) : null; return !!a && !!sv?.letters?.some((l) => l.key === a.key && !l.read); }
const opening = new Set<number>();
/** 서신 봉투를 연다: 처음이면 AI 가 본문을 한 번 쓴다(이야기만). */
export async function openAgentLetter(id: number): Promise<{ ok: boolean; error?: string }> {
  const sid = ctx.curSaveId; if (!sid) return { ok: false, error: L('세이브를 불러와 주세요.', 'Load a save first.') };
  const sv = saveOf(sid), l = sv.letters?.find((x) => x.id === id), a = l ? sv.agents.find((x) => x.key === l.key) : undefined;
  if (!l || !a) return { ok: false, error: L('서신을 찾지 못했습니다.', 'Letter not found.') };
  if (l.body) { if (!l.read) { l.read = true; save(); } return { ok: true }; }
  if (opening.has(id)) return { ok: false, error: L('서신을 해독하는 중입니다.', 'Decoding the letter.') };
  opening.add(id);
  try {
    const r = parseAgentLetter(await ctx.ai.chat(agentLetterMessages(a, l, ctx.playerName || 'the player empire', ctx.gameDate || l.date), { purpose: 'agent-letter', json: true, maxTokens: 1400 }));
    if (!r) return { ok: false, error: L('서신을 읽지 못했습니다. 다시 눌러 주세요.', 'Could not read the letter. Please try again.') };
    if (ctx.curSaveId !== sid) return { ok: false, error: L('세이브가 바뀌었습니다.', 'The save changed.') };
    l.title = r.title; l.body = r.body; l.read = true; save(); logDiagnostic('info', 'agents.letter_open', { kind: l.kind });
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  finally { opening.delete(id); }
}
/** 외교관 위장으로 옮기기/되돌리기(대사관이 있을 때만 — 부른 쪽이 확인). */
export function setAgentCover(target: string, on: boolean): boolean {
  const a = agentFor(target); if (!a) return false;
  if (on) a.dip = true; else delete a.dip; save(); logDiagnostic('info', 'agents.cover', { dip: on }); return true;
}
/** 마지막 월간 상황의 첩보망 침투 수준(대상 제국 이름 → 0~100). 대사관 첩보 탭이 게임 정보 값 대신 쓸 수 있게(2026-10-27). */
const spyPow = { sid: '', map: new Map<string, number>() };
export function spyPowerOf(target: string): number { return spyPow.sid && spyPow.sid === ctx.curSaveId ? spyPow.map.get(target) ?? 0 : 0; }
function onSnap(snap: { sid: string; date: string; spynets: Array<{ target: string; power?: number; assets?: string[] }> }): void {
  const sid = ctx.curSaveId; if (!sid || (snap.sid && snap.sid !== sid)) return;
  spyPow.sid = sid; spyPow.map = new Map(snap.spynets.filter((n) => n.target).map((n) => [n.target, Math.max(0, Number(n.power) || 0)] as const));
  const s = saveOf(sid), { born, lost, recalled } = syncAgents(s.agents, snap.spynets, snap.date);
  for (const t of born) {
    const idx = idxOf(t), g: 'm' | 'f' = Math.random() < 0.5 ? 'm' : 'f';
    const name = (idx ? gameName(g, idx) : null) || randomName(); // 위장 신분: 상대 제국 종족 이름
    s.seq += 1; s.agents.push(newAgent(t, idx, snap.date, name, g, s.agents.map((a) => a.code), Math.random, s.seq));
  }
  const ko = L('ko', 'en') === 'ko';
  for (const a of lost) {
    memorialAgentLost({ key: a.key, name: `${a.name} (${L('암호명 ', 'codename ')}${codename(a, ko)})`, first: a.since, date: a.gone || snap.date, code: codename(a, ko) });
    if (a.dip) agentHooks.dipLost?.(a.idx || idxOf(a.target), a.target, a.gone || snap.date); // 대사관 무관이 붙잡혔다 → 대사 추방(embassy-app)
    // 그 나라가 우리 공작원을 붙잡았다며 해명을 요구한다(공작원 이름이 증거로) — 청문회는 한 번에 하나
    openGameHearing({ opponent: a.target, idx: a.idx || undefined, key: a.key, operation: L('첩보망 적발', 'Spy network exposed'), facts: [
      L(`${a.target} 당국은 ${coverName(a, true)}(으)로 위장해 ${a.since || '?'}부터 활동한 외국 공작원 ${a.name}을(를) 적발했다고 주장한다.`, `${a.target} authorities claim to have uncovered a foreign agent, ${a.name}, operating under cover as a ${coverName(a, false)} since ${a.since || '?'}.`),
      L(`우리 첩보망은 ${a.gone || snap.date}에 무너졌고 공작원과는 연락이 끊겼다.`, `Our spy network collapsed on ${a.gone || snap.date} and contact with the agent is lost.`)] });
  }
  // 현지 협력자(게임 첩보 자산): 사람은 상대 제국 종족 이름, 드론·노드는 일련번호
  const nets = new Map(snap.spynets.map((n) => [n.target, n.assets] as const));
  for (const a of s.agents) if (a.status === 'active') syncContacts(a, nets.get(a.target), snap.date, (x) => (ASSETS[x]?.person ? (a.idx ? gameName(Math.random() < 0.5 ? 'm' : 'f', a.idx) : null) || randomName() : unitName(Math.random)));
  // 공작원 서신(2년마다, 이야기만)
  const mail = drawAgentLetters(s, snap.date);
  if (mail.length) {
    (office as { toastGo: string }).toastGo = 'spy';
    const who = s.agents.find((a) => a.key === mail[0].key);
    ctx.notify({ kind: 'office', title: L('공작원 서신이 도착했습니다', 'A dispatch from the field'), body: who ? L(`암호명 ${codename(who, true)}${mail.length > 1 ? ` 외 ${mail.length - 1}통` : ''} — 집무실 「첩보」에서 열어 보세요.`, `Codename ${codename(who, false)}${mail.length > 1 ? ` and ${mail.length - 1} more` : ''} — open it in the office under Espionage.`) : L('집무실 「첩보」에서 열어 보세요.', 'Open it in the office under Espionage.'), action: L('열기', 'Open') });
    logDiagnostic('info', 'agents.letters', { n: mail.length });
  }
  if (s.agents.length > 200) s.agents.splice(0, s.agents.length - 200);
  save(); if (born.length || lost.length || recalled.length) logDiagnostic('info', 'agents.sync', { born: born.length, lost: lost.length, recalled: recalled.length });
}
export function registerAgents(): void { onGameSnapshot((snap) => onSnap(snap)); }
