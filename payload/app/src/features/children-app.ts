// 통치자의 아이(육아, 2026-10-27 사용자 확정 — docs/CHILDREN_DESIGN_KO.md). 규칙: src/children.ts, 화면: ui/nursery.js(개인실의 아기 소품 → 아기방).
// 저장: userData/children/<세이브>.json. 판정·성장은 매달 월간 상황(onGameSnapshot)에서 앱이 계산하고, 게임 명령은 성인식(create_leader)·후계자(set_heir)뿐이다.
// AI 호출: 배우자 대화는 늘지 않는다(persona-app 이 같은 답의 intimate 칸만 넘김). 청소년 대화만 새 호출. 사건은 모두 틀 문장.
import { dayMoodEvent } from '../app/daymood-hooks'; // 동적 일상 분위기: 탄생 = 경사, 가족의 죽음 = 애도(2026-10-28)
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { ctx } from '../app/ctx';
import { link } from '../app/game-link';
import { LogRouter, SLOT } from '../app/log-router';
import { setChildrenHooks } from '../app/children-hooks';
import { courtLink, type KidInfo } from '../app/court-hooks'; // 가문·정략결혼(2026-10-28 정치)
import type { SllmMessage } from '../protocol';
import { logDiagnostic } from '../diagnostics';
import { redactKey } from '../aiclient';
import { pick as L, selectedLanguage } from './settings-ui';
import { terminalRequest, terminalReplies } from './terminal';
import { onGameSnapshot, gameState } from './gamestate-app';
import { office } from './office-app';
import { peopleOf } from './people-app';
import { relBookOf, onRelationDeath } from './relations-app';
import { chronNote } from './chronicle-app';
import { gameName } from './namegen-app';
import { personaJson, setPersonBio, personaNote } from './persona-app';
import { cleanLine } from '../persona';
import { gameClassKey } from '../speciesClass';
import {
  type Child, type ChildrenBook, type Spouse, CHILDREN, childLimit, AXES, emptyBook, yearOf, ageOf, stageOf, rollYear, markIntimate, monthTick, answerEvent,
  eventDef, fill, adultPlan, childAdultCommand, childHeirCommand, teenTalkMessages, teenSummaryMessages, childBio, gameNameText,
  canTalk, type GriefMark, FAMILY_GRIEF_TRAIT, GRIEF_YEARS, familyTraitCommand, familyOf, familyLine, bondOf, bondName, receiveGift,
} from '../children';
import { addYears, cmpDate } from '../gamedate';
import {
  type Wish, type JobKey, type CivKind, WISHES, WISH_NAME, JOBS, jobOf, jobsFor, birthWish, wishFallback, defaultJob, fitsWish, wishPrefersLeader,
  CIV, kindRoll, pickCiv, goodKind, smallKind, badKind, civText, civDies, isBig, isSmall, shouldNotify, heirReturnLine, quietSince, type FamilyNotify,
} from '../children-civ';
import { gov } from './gov';
import { moodNudge } from './mood-app';
import { imageUrl, imagesDir, applyImageFile } from './images';
import { settings } from '../app/settings';
/** 플레이어가 고른 아이 초상화(2026-10-27): 기존 지도자 개인 초상화와 같은 저장소(설정 images), 키는 person:<세이브>:n:child-<아이>. 성인이 되면 그 지도자 키로 옮겨 쓴다. */
const faceKey = (sid: string, c: Child): string => `person:${sid}:n:child-${c.id}`;
function faceUrl(sid: string, c: Child): string { const f = settings.images[faceKey(sid, c)]; try { return f && fs.existsSync(path.join(imagesDir(), f)) ? imageUrl(f) : ''; } catch { return ''; } }

const dir = () => path.join(app.getPath('userData'), 'children');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, ChildrenBook>();
export function sanitizeChildrenBook(x: unknown, sid: string): ChildrenBook {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<ChildrenBook>;
  const b = emptyBook(sid);
  b.rolled = Number.isInteger(o.rolled) ? o.rolled! : 0;
  if (o.intimate && typeof o.intimate === 'object') for (const [k, v] of Object.entries(o.intimate)) if (Number.isInteger(v)) b.intimate[k] = v as number;
  b.children = (Array.isArray(o.children) ? o.children : []).filter((c): c is Child => !!c && typeof c === 'object' && typeof c.id === 'string' && typeof c.ruler === 'string' && typeof c.parent === 'string' && typeof c.due === 'string')
    .slice(0, 64).map((c) => ({ ...c, score: { official: Number(c.score?.official) || 0, scientist: Number(c.score?.scientist) || 0, commander: Number(c.score?.commander) || 0 },
      tags: Array.isArray(c.tags) ? c.tags.slice(-40) : [], done: Array.isArray(c.done) ? c.done : [], log: Array.isArray(c.log) ? c.log.slice(-60) : [],
      ...(c.adult && c.adult.state === 'pending' ? {} : {}) }));
  b.civYear = Number.isInteger(o.civYear) ? o.civYear : 0;
  b.griefs = (Array.isArray(o.griefs) ? o.griefs : []).filter((g): g is GriefMark => !!g && typeof g === 'object' && Number.isInteger(g.lid) && typeof g.id === 'string').slice(-80);
  return b;
}
function bookOf(sid: string): ChildrenBook {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeChildrenBook(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'children', error: e }); b = emptyBook(sid); }
  books.set(sid, b); return b;
}
/** 인터넷(트윙클)에 글을 쓰는 통치자 자녀: 태어난 지 13년 넘고 살아 있는 아이(2026-10-28). 손이 많아도 인터넷 쪽이 돌아가며 최대 3명만 쓴다. */
export function childrenOnline(sid: string): Array<{ name: string; handle: string }> {
  if (!sid) return []; const now = ctx.gameDate || '';
  const b = bookOf(sid);
  const out = b.children.filter((c) => c.born && !c.dead && now && cmpDate(addYears(c.born, 13), now) <= 0)
    .map((c) => {
      // 민간인 자녀의 작은 근황(2026-10-28): 한 번 쓰면 지운다. 인터넷 쪽이 돌아가며 최대 3명만 고르므로 고르지 않은 아이의 근황은 남는다.
      const n = c.civ && !c.adult && c.civ.news ? c.civ.news : null;
      return { name: c.name, handle: (c.name.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '').toLowerCase().slice(0, 10) || 'heir') + '_' + c.id.replace(/[^a-z0-9]/gi, '').slice(-3), ...(n ? { line: L(n.ko, n.en), take: () => { if (c.civ) { c.civ.news = null; save(sid); } } } : {}) };
    });
  return out;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); }
  catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'children', error: e }); }
}

const live = (sid: string) => peopleOf(sid).filter((p) => !p.gone);
const rulerOf = (sid: string) => live(sid).find((p) => p.ruler);
const lidOf = (pid: string): number => { const m = /^p:(\d+)$/.exec(pid); return m ? Number(m[1]) : 0; };
const nameOf = (sid: string, pid: string): string => peopleOf(sid).find((p) => `p:${p.lid}` === pid)?.name ?? '';
/** 지금 통치자의 배우자(혼인 중·살아 있는 우리 지도자, 비서 제외 ★). */
function spousesOf(sid: string): Spouse[] {
  const r = rulerOf(sid); if (!r) return []; const rp = `p:${r.lid}`, out: Spouse[] = [];
  for (const pr of Object.values(relBookOf(sid).ledger.pairs)) {
    if (pr.romance !== 'married' || (pr.a !== rp && pr.b !== rp)) continue;
    const o = pr.a === rp ? pr.b : pr.a; if (!/^p:\d+$/.test(o)) continue; // 'sec'(비서)·타국 인물은 아이 없음
    const p = live(sid).find((x) => `p:${x.lid}` === o); if (p) out.push({ pid: o, name: p.name });
  }
  return out;
}
const enabled = () => { childLimit.off = settings.childLimitOff === true; return !gameState.last?.gestalt; }; // 군체·기계 제국: 기능 없음
const isKo = () => selectedLanguage() === 'ko'; // i18n-data: 인물 전기·청소년 대화 답의 언어 고르기(자료)
function toastNursery(title: string, body: string): void {
  (office as { toastGo: string }).toastGo = 'nursery';
  ctx.notify({ kind: 'office', title, body, action: L('아기방으로 가기', 'Go to the nursery') });
}
function chron(text: string): void { try { chronNote(ctx.playerIdx, (ctx.gameDate ? ctx.gameDate + ' ' : '') + text); } catch { /* 연대기 없음 */ } }
function childName(sid: string, c: Child): string {
  const base = gameName(c.gender) ?? '';
  const first = base.split(/\s+/)[0] || (c.gender === 'f' ? L('아이', 'Child') : L('아이', 'Child'));
  const last = peopleOf(sid).find((p) => `p:${p.lid}` === c.ruler)?.last ?? '';
  return gameNameText(last && last !== first ? `${first} ${last}` : first);
}
/** 아이 그림 계열(speciesClass: human·mammalian…). 모르면 '' → 선 그림. */
const artOf = (): string => { try { const i = ctx.flagProv.portraitInfoFor(ctx.playerIdx); return gameClassKey(i?.founder?.cls) ?? ''; } catch { return ''; } };

// ---- 월간
let ticking = false;
async function onMonth(sid: string): Promise<void> {
  if (ticking || !enabled()) return; ticking = true;
  try {
    const b = bookOf(sid), today = ctx.gameDate || '', y = yearOf(today); if (!Number.isFinite(y)) return;
    let ch = false;
    const r = rulerOf(sid);
    if (!b.rolled) { b.rolled = y; ch = true; } // 처음 보는 세이브: 지나간 해는 판정하지 않는다
    else if (y > b.rolled && r) {
      const year = y - 1;
      const made = rollYear(b, year, today, { pid: `p:${r.lid}`, name: r.name }, spousesOf(sid), Math.random, () => randomUUID().replace(/-/g, '').slice(0, 16));
      for (const c of made) {
        c.art = artOf();
        c.log.push({ date: today, ko: `${c.parentName}이(가) 아이를 가졌다`, en: `${c.parentName} is expecting` });
        toastNursery(L('아이 소식', 'A child on the way'), L(`통치자 ${r.name}와(과) ${c.parentName} 사이에 아이가 생겼습니다. ${CHILDREN.pregnancyMonths}달 뒤 태어납니다.`, `The ruler ${r.name} and ${c.parentName} are expecting a child, due in ${CHILDREN.pregnancyMonths} months.`));
      }
      ch = true;
    } else if (y > b.rolled) { b.rolled = y; ch = true; }
    const alive = (pid: string) => live(sid).some((p) => `p:${p.lid}` === pid);
    for (const t of monthTick(b, today, alive)) {
      ch = true; const c = t.child;
      if (t.kind === 'born') {
        if (!c.name) c.name = childName(sid, c);
        try { courtLink.onBirth(sid, c.id, c.ruler); } catch { /* 궁정 없음 */ } // 가문 특성 물려받기(2026-10-28)
        if (!c.wish) c.wish = birthWish(Math.random, [clsOf(sid, c.ruler), clsOf(sid, c.parent)]); // 아이의 희망(2026-10-28): 무작위, 부모 직업을 조금 닮음
        chron(L(`통치자 ${c.rulerName}와(과) ${c.parentName}의 아이 ${c.name}이(가) 태어났다`, `${c.name}, child of the ruler ${c.rulerName} and ${c.parentName}, was born`));
        dayMoodEvent('joy', L('통치자의 아이 탄생', 'Birth of the ruler\'s child'));
        toastNursery(L('아이가 태어났습니다', 'A child is born'), L(`${c.name}이(가) 태어났습니다. 아기방에서 볼 수 있습니다.`, `${c.name} was born. You can find them in the nursery.`));
      } else if (t.kind === 'event' && t.event) {
        toastNursery(L(`${c.name} — ${t.event.titleKo}`, `${c.name} — ${t.event.titleEn}`), L('아기방에서 어떻게 할지 골라 주세요(1년 안에).', 'Choose what to do in the nursery (within a year).'));
      } else if (t.kind === 'cross') {
        toastNursery(L(`${c.name}이(가) 성인이 되었습니다`, `${c.name} has come of age`), L(`${c.name}이(가) 18세가 되었습니다. 아기방에서 지도자로 임명할지, 민간인으로 살게 할지 정해 주세요.`, `${c.name} has turned 18. In the nursery, decide whether they become a leader or live as a civilian.`));
      } else if (t.kind === 'adult') {
        c.adult = { ...c.adult!, ...adultPlan(c) };
        toastNursery(L(`${c.name}의 성인식`, `${c.name} comes of age`), L(`${c.name}이(가) 18세가 되었습니다. 게임이 켜져 있으면 우리 지도자로 합류합니다.`, `${c.name} has turned 18 and will join our leaders while the game is running.`));
      }
    }
    if (y > (b.civYear ?? 0)) { if (b.civYear) civYear(sid, b, today); b.civYear = y; ch = true; } // 민간인 삶 사건(해가 바뀔 때 한 번)
    if (ch) save(sid);
    await sendAdults(sid);
    await sendGriefs(sid);
  } catch (e) { logDiagnostic('warn', 'children.month_failed', { error: e }); }
  finally { ticking = false; }
}
/** 성인식 명령(게임). 실패하면 다음 달 다시. 중복 회신이면(앞서 만들었지만 회신을 놓침) 명단에서 같은 이름으로 잇는다. */
async function sendAdults(sid: string): Promise<void> {
  if (!ctx.gameRunning || !link.sessionReady || ctx.curSaveId !== sid || !/^\d+$/.test(sid)) return;
  const b = bookOf(sid);
  for (const c of b.children.filter((x) => x.adult?.state === 'pending')) {
    const plan = c.adult!.cls && c.adult!.traits ? { cls: c.adult!.cls, traits: c.adult!.traits, side: c.adult!.side ?? adultPlan(c).side } : adultPlan(c);
    const req = ++link.reqCounter;
    try {
      const kv = (await terminalRequest(childAdultCommand(req, sid, c, [lidOf(c.parent), lidOf(c.ruler)], plan), 'CHILDADULT', req)).kv;
      if (ctx.curSaveId !== sid) return;
      if (kv.status === 'applied' || kv.status === 'duplicate') {
        const lid = Number(kv.lid);
        c.adult = { ...c.adult!, state: 'applied', ...(Number.isInteger(lid) && lid > 0 ? { lid } : {}) };
        c.log.push({ date: ctx.gameDate || '', ko: '성인이 되어 우리 지도자가 되었다', en: 'Came of age and joined our leaders' });
        if (c.adult.lid) linkAdult(sid, c);
        if (c.civ) chron(L(`민간인으로 살던 통치자의 자녀 ${c.name}이(가) 지도자로 부름을 받았다`, `${c.name}, the ruler’s child who had lived as a civilian, was called up as a leader`));
        else chron(L(`통치자의 아이 ${c.name}이(가) 성인이 되어 지도자로 나섰다`, `${c.name}, the ruler’s child, came of age and became a leader`));
        save(sid);
        if (c.adult.heirWanted && c.adult.lid && !c.adult.heir) await makeHeir(sid, c).catch((e) => logDiagnostic('warn', 'children.heir_failed', { error: (e as Error).message }));
      }
    } catch (e) { logDiagnostic('warn', 'children.adult_failed', { error: (e as Error).message }); return; }
  }
}
// ---- 가족의 죽음(2026-10-27 사용자 확정): 성인이 된 아이가 죽으면 살아 있는 부모에게, 부모가 죽으면 성인이 된 아이에게 「가족을 잃은 슬픔」(3년).
function onFamilyDeath(sid: string, dead: string, date: string): void {
  if (!enabled() || ctx.curSaveId !== sid) return;
  const b = bookOf(sid); const today = date || ctx.gameDate || ''; let ch = false;
  const grieve = (pid: string, lost: string, kind: GriefMark['kind']) => {
    const p = live(sid).find((x) => `p:${x.lid}` === pid); if (!p || !AXES.includes(p.cls as never)) return;
    const id = `${p.lid}_${kind}_${today.replace(/\D/g, '')}`; if (b.griefs.some((g) => g.id === id)) return;
    b.griefs.push({ id, lid: p.lid, cls: p.cls as GriefMark['cls'], lost, kind, on: today, until: addYears(today, GRIEF_YEARS), state: 'pending' }); ch = true;
    personaNote(sid, pid, L(`${lost}을(를) 잃고 깊이 슬퍼했다`, `Grieved deeply after losing ${lost}`));
  };
  for (const c of b.children) {
    if (c.adult?.lid && `p:${c.adult.lid}` === dead && !c.dead) { // 성인이 된 아이의 죽음 → 부모
      c.dead = today; c.log.push({ date: today, ko: '세상을 떠났다', en: 'Passed away' }); ch = true;
      for (const par of [c.ruler, c.parent]) grieve(par, c.name, 'child');
      chron(L(`통치자의 아이 ${c.name}이(가) 세상을 떠났다`, `${c.name}, the ruler’s child, has died`));
    }
    if ((c.ruler === dead || c.parent === dead) && c.adult?.lid && !c.dead) grieve(`p:${c.adult.lid}`, c.ruler === dead ? c.rulerName : c.parentName, 'parent'); // 부모의 죽음 → 성인이 된 아이
  }
  if (ch) { save(sid); void sendGriefs(sid); dayMoodEvent('grief', L('통치자 가족의 죽음', 'A death in the ruler\'s family')); }
}
/** 슬픔 특성: 붙일 차례(pending)를 보내고, 기한이 지난 것은 뗀다. */
async function sendGriefs(sid: string): Promise<void> {
  if (!ctx.gameRunning || !link.sessionReady || ctx.curSaveId !== sid || !/^\d+$/.test(sid)) return;
  const b = bookOf(sid), today = ctx.gameDate || '';
  for (const g of b.griefs) {
    const removing = g.state === 'applied' && cmpDate(today, g.until) >= 0;
    if (g.state !== 'pending' && !removing) continue;
    const t = FAMILY_GRIEF_TRAIT[g.cls], req = ++link.reqCounter;
    try {
      const kv = (await terminalRequest(familyTraitCommand(req, sid, g.lid, removing ? [] : [t], removing ? [t] : [], `${g.id}_${removing ? 'off' : 'on'}`.slice(0, 40)), 'CHILDTRAIT', req)).kv;
      if (ctx.curSaveId !== sid) return;
      if (kv.status === 'applied' || kv.status === 'duplicate' || kv.status === 'no_target') { g.state = removing || kv.status === 'no_target' ? 'done' : 'applied'; save(sid); }
    } catch (e) { logDiagnostic('warn', 'children.grief_failed', { error: (e as Error).message }); return; }
  }
}
function familyView(sid: string, key: string) {
  const f = familyOf(bookOf(sid), key, ctx.gameDate || '', (pid) => live(sid).some((p) => `p:${p.lid}` === pid));
  if (!f) return null;
  const st = (p: { stage?: string; age?: number; gone?: boolean; half?: boolean }) => [p.gone ? L('고인', 'deceased') : p.stage && p.stage !== 'adult' && p.stage !== 'expecting' ? `${({ baby: L('영유아', 'infant'), child: L('어린이', 'child'), teen: L('청소년', 'teen') } as Record<string, string>)[p.stage]} ${L(p.age + '세', p.age + ' y')}` : p.stage === 'adult' ? L('성인', 'adult') : '', p.half ? L('이복', 'half') : ''].filter(Boolean).join(' · ');
  const fmt = (xs: { name: string }[]) => xs.map((x) => { const t = st(x as never); return t ? `${x.name} (${t})` : x.name; });
  return { parents: fmt(f.parents), children: fmt(f.children), siblings: fmt(f.siblings) };
}
/** 성인이 된 지도자에게 어린 시절을 잇는다: 인물 전기 + 기억 한 줄(1:1 통신 말투의 재료). */
function linkAdult(sid: string, c: Child): void {
  const key = `p:${c.adult!.lid}`;
  try { const f = settings.images[faceKey(sid, c)], adultKey = `person:${sid}:${c.adult!.lid}`; if (f && !settings.images[adultKey]) applyImageFile(path.join(imagesDir(), f), { kind: 'portrait', key: adultKey, label: c.name }); } catch (e) { logDiagnostic('warn', 'children.face_copy_failed', { error: e }); } // 아이 때 고른 초상화를 지도자 초상화로
  try { setPersonBio(sid, key, childBio(c, isKo() ? 'ko' : 'en')); personaNote(sid, key, L(`아기방에서 자라 오늘 성인이 되었다. 부모: ${c.rulerName}, ${c.parentName}`, `Grew up in the nursery and came of age today. Parents: ${c.rulerName}, ${c.parentName}`)); }
  catch (e) { logDiagnostic('warn', 'children.link_failed', { error: e }); }
}
/** 회신을 놓친 성인식: 명단에 같은 이름의 새 지도자가 나오면 잇는다. */
function linkLate(sid: string): void {
  let ch = false;
  for (const c of bookOf(sid).children) {
    if (c.adult?.state !== 'applied' || c.adult.lid || !c.name) continue;
    const p = live(sid).find((x) => x.name === c.name); if (p) { c.adult.lid = p.lid; linkAdult(sid, c); ch = true; }
  }
  if (ch) save(sid);
}

// ---- 화면 자료
function view(sid: string, c: Child) {
  const today = ctx.gameDate || '', st = stageOf(c, today), d = c.pending ? eventDef(c.pending.id) : null;
  const lost = c.pending?.id === 'loss' ? nameOf(sid, c.lossQueue?.[0] ?? '') : '';
  const vars = { child: c.name || L('아이', 'the child'), parent: c.parentName, ruler: c.rulerName, lost: lost || L('부모', 'a parent') };
  return {
    id: c.id, name: c.name, gender: c.gender, stage: st, age: ageOf(c, today), parent: c.parentName, parentPid: c.parent, ruler: c.rulerName, due: c.due, born: c.born ?? '',
    score: c.score, art: c.art ?? '', log: c.log.slice().reverse().map((l) => ({ date: l.date, text: L(l.ko, l.en) })),
    event: d && c.pending ? { title: L(d.titleKo, d.titleEn), text: fill(L(d.ko, d.en), vars), until: c.pending.until, choices: d.choices.map((x) => L(x.ko, x.en)) } : null,
    canTalk: st === 'teen' || st === 'child', // 대화 횟수 제한 없음(2026-10-27 사용자)
    study: c.study ?? '', canStudy: !c.adult && (st === 'child' || st === 'teen'),
    face: faceUrl(sid, c), faceKey: faceKey(sid, c),
    adult: c.adult ? { state: c.adult.state, on: c.adult.on, lid: c.adult.lid ?? 0, cls: c.adult.cls ?? '', heir: !!c.adult.heir, heirWanted: !!c.adult.heirWanted } : null,
    // 민간인 경로(2026-10-28)
    wish: wishOf(c), wishText: L(WISH_NAME[wishOf(c)].ko, WISH_NAME[wishOf(c)].en), wishLeader: wishPrefersLeader(wishOf(c)), star: !!c.star, upset: c.upset ?? 0,
    cross: c.cross && !c.adult && !c.civ ? { on: c.cross.on, jobs: jobsView(wishOf(c)), job: defaultJob(c.id, wishOf(c)), lead: leadFor(wishOf(c)) } : null,
    civ: c.civ && !c.adult ? { job: c.civ.job, jobName: jobName(c.civ.job), on: c.civ.on, married: c.civ.married ?? '', lead: jobOf(c.civ.job)?.lead ?? 'official', dead: !!c.dead } : null,
    houseTraits: courtLink.kidTraits(sid, c.id), wed: c.wed ?? '', // 가문 특성·정략결혼(2026-10-28)
    bond: c.born ? bondOf(c) : null, bondName: c.born ? L(...bondName(bondOf(c))) : '', // 부모와의 정(2026-10-30, 선물)
  };
}
// ---- 자식에게 선물(2026-10-30 사용자: 선물하면 관계가 조금 더 돈독해짐) — 백화점에서 사서 궁으로 보냄. 게임 효과 없음(정 → 대화 말투·서운함 풀기).
/** 선물을 받을 수 있는 아이: 태어났고 살아 있는 지금 통치자의 아이(성인·민간인 포함). */
export function giftableChildren(sid: string): Array<{ id: string; name: string; age: number; stage: string; bond: number; bondName: string }> {
  if (!sid || !enabled()) return []; const today = ctx.gameDate || '', r = rulerOf(sid), rp = r ? `p:${r.lid}` : '';
  return bookOf(sid).children.filter((c) => c.born && !c.dead && (!rp || c.ruler === rp)).map((c) => ({ id: c.id, name: c.name || L('아이', 'Child'), age: ageOf(c, today), stage: stageOf(c, today), bond: bondOf(c), bondName: L(...bondName(bondOf(c))) }));
}
/** 같은 날 같은 물건을 이미 줬는지(호감 반). */
export function childGiftedToday(sid: string, id: string, giftId: string): boolean { const c = bookOf(sid).children.find((x) => x.id === id); const t = ctx.gameDate || ''; return !!c?.gifts?.some((g) => g.id === giftId && g.on === t); }
export function giftToChild(sid: string, id: string, giftId: string, delta: number, ko: string, en: string): { ok: boolean; error?: string; name?: string; bond?: number; eased?: boolean } {
  if (!giftableChildren(sid).some((x) => x.id === id)) return { ok: false, error: L('선물을 받을 수 있는 아이가 아닙니다.', 'That child cannot receive gifts.') };
  const c = bookOf(sid).children.find((x) => x.id === id)!; if (delta === 0 && !ko) return { ok: true, name: c.name, bond: bondOf(c) }; // 미리 확인만
  const r = receiveGift(c, giftId, delta, ctx.gameDate || '', ko, en); save(sid); return { ok: true, name: c.name, bond: r.bond, eased: r.eased };
}
function listView() {
  const sid = ctx.curSaveId || '';
  if (!sid) return { ok: false, error: L('세이브를 불러온 뒤에 볼 수 있습니다.', 'Load a save first.') };
  if (!enabled()) return { ok: true, off: true, children: [], grown: [], cap: { used: 0, total: CHILDREN.total } };
  const b = bookOf(sid), r = rulerOf(sid), rp = r ? `p:${r.lid}` : '';
  const all = b.children.map((c) => view(sid, c));
  return {
    ok: true, today: ctx.gameDate || '', heirOk: gameState.last?.authority === 4, running: ctx.gameRunning,
    children: all.filter((c) => !c.adult && !c.civ), grown: all.filter((c) => c.adult || c.civ), notify: settings.familyNotify ?? 'all',
    cap: { used: b.children.filter((c) => c.ruler === rp).length, total: CHILDREN.total, perSpouse: CHILDREN.perSpouse, unlimited: settings.childLimitOff === true },
    spouses: spousesOf(sid).map((s) => s.name),
  };
}

// ---- 민간인 경로(2026-10-28 사용자 확정 — 육아_민간인경로_설계.md). LLM 없음, 게임 효과 없음(신문 한 줄·민심 아주 조금만).
const clsOf = (sid: string, pid: string): string => String(peopleOf(sid).find((p) => `p:${p.lid}` === pid)?.cls ?? '');
const wishOf = (c: Child): Wish => (c.wish && WISHES.includes(c.wish) ? c.wish : wishFallback(c.id));
const leadFor = (w: Wish): 'official' | 'scientist' | 'commander' => (w === 'adventure' ? 'commander' : w === 'science' ? 'scientist' : 'official');
const jobName = (k: JobKey): string => { const j = jobOf(k); return j ? L(j.ko, j.en) : ''; };
const jobsView = (w: Wish) => [...jobsFor(w), ...JOBS.filter((j) => j.wish !== w)].map((j) => ({ key: j.key, name: L(j.ko, j.en), fits: j.wish === w }));
const isCivAlive = (c: Child): boolean => !!c.civ && !c.adult && !c.dead;
/** 희망을 거스름: 이야기 효과만(서운함 한 줄 → 나중 대화의 재료). */
function hurt(sid: string, c: Child, wanted: string): void {
  c.upset = (c.upset ?? 0) + 1;
  c.log.push({ date: ctx.gameDate || '', ko: `원하던 길(${WISH_NAME[wishOf(c)].ko})이 아니라 서운해했다`, en: `Was hurt not to follow the path they wanted (${WISH_NAME[wishOf(c)].en})` });
  void wanted; void sid;
}
/** 지도자로 세우기(갈림길 · 민간인 불러들이기 · 후계자). 게임에는 sendAdults 가 다음에 보낸다. */
function recall(sid: string, c: Child, cls: 'official' | 'scientist' | 'commander', heir: boolean): void {
  const today = ctx.gameDate || ''; const w = wishOf(c);
  c.study = cls; const plan = adultPlan(c);
  c.adult = { state: 'pending', on: today, ...plan, ...(heir ? { heirWanted: true } : {}) };
  if (c.civ) { c.civ.recalled = true; c.log.push({ date: today, ko: `민간인의 삶을 접고 지도자로 부름을 받았다`, en: 'Left civilian life when called up as a leader' }); }
  else c.log.push({ date: today, ko: '지도자의 길을 가기로 했다', en: 'Chose the path of a leader' });
  if (!fitsWish(w, { leader: cls })) hurt(sid, c, L(WISH_NAME[w].ko, WISH_NAME[w].en));
}
async function makeHeir(sid: string, c: Child): Promise<boolean> {
  if (!c.adult?.lid || !ctx.gameRunning) return false;
  const req = ++link.reqCounter; const kv = (await terminalRequest(childHeirCommand(req, sid, c.adult.lid), 'CHILDHEIR', req)).kv;
  if (kv.status !== 'applied') return false;
  c.adult.heir = true; c.adult.heirWanted = false; c.log.push({ date: ctx.gameDate || '', ko: '후계자로 세워졌다', en: 'Named heir' }); save(sid);
  chron(L(`${c.name}이(가) 후계자로 세워졌다`, `${c.name} was named heir`)); return true;
}
const planetPick = (sid: string, r: () => number): string => { const ps = gov.planetList && gov.planetList.sid === sid ? gov.planetList.planets.map((p) => p.name) : []; return ps.length ? ps[Math.floor(r() * ps.length) % ps.length] : ''; };
/** 한 해의 민간인 삶: 늙음 → 큰 사건(상한·확률·밀린 차례·별표) → 작은 근황(인터넷 글감). 일어난 건수를 돌려준다. */
function civRoll(sid: string, b: ChildrenBook, today: string, force = false): number {
  const r = Math.random; let n = 0;
  const L2 = (t: { ko: string; en: string }) => L(t.ko, t.en);
  // 늙음(종족 수명은 모르므로 이야기 수명): 세상을 떠나면 부모 지도자에게 슬픔 특성(기존 규칙)
  for (const c of b.children.filter(isCivAlive)) if (civDies(ageOf(c, today), r)) {
    c.dead = today; c.log.push({ date: today, ko: '세상을 떠났다', en: 'Passed away' });
    chron(L(`민간인으로 살던 통치자의 자녀 ${c.name}이(가) 세상을 떠났다`, `${c.name}, the ruler’s child who lived as a civilian, has died`));
    griefFor(sid, b, c, today);
  }
  const civs = b.children.filter(isCivAlive); if (!civs.length) return 0;
  const cap = CIV.capFor(civs.length), p = CIV.chanceFor(civs.length), hit = new Set<string>();
  for (let i = 0; i < cap; i++) {
    if (!force && r() >= p) continue; force = false;
    const id = pickCiv(civs.filter((c) => !hit.has(c.id)).map((c) => ({ id: c.id, star: !!c.star, yearsQuiet: quietSince(c.civ!, today) })), r); if (!id) break;
    const c = civs.find((x) => x.id === id)!; hit.add(id);
    const roll = kindRoll(r, c.talkN ?? 0);
    const kind: CivKind = roll === 'good' ? goodKind(r, !!c.civ!.married) : roll === 'bad' ? badKind(r) : smallKind(r);
    civEvent(sid, c, kind, today, r); n++;
  }
  // 작은 근황: 상한과 따로, 인터넷(트윙클) 자녀 글로만
  for (const c of civs) if (!hit.has(c.id) && r() < CIV.smallChance) { const t = civText(smallKind(r), jobOf(c.civ!.job)!, { name: c.name, planet: planetPick(sid, r) }, r); c.civ!.news = { ...t, date: today }; }
  void L2; return n;
}
function civYear(sid: string, b: ChildrenBook, today: string): void { try { civRoll(sid, b, today); } catch (e) { logDiagnostic('warn', 'children.civ_failed', { error: e }); } }
function civEvent(sid: string, c: Child, kind: CivKind, today: string, r: () => number): void {
  const job = jobOf(c.civ!.job)!; const spouse = kind === 'marriage' ? (gameName(c.gender === 'f' ? 'm' : 'f') ?? '').split(/\s+/)[0] || L('연인', 'their partner') : '';
  const t = civText(kind, job, { name: c.name, planet: planetPick(sid, r), spouse }, r);
  if (kind === 'marriage') c.civ!.married = spouse;
  if (isSmall(kind)) { c.civ!.news = { ...t, date: today }; c.log.push({ date: today, ko: t.ko, en: t.en }); return; } // 평범한 일은 근황(인터넷)으로
  c.civ!.last = today; c.log.push({ date: today, ko: t.ko, en: t.en });
  chron(L(t.ko, t.en)); // 신문 한 줄(연대기 → 신문 재료)
  if (kind === 'setback' || kind === 'gossip') moodNudge(-1, L(t.ko, t.en)); // 나쁜 일: 민심 아주 조금
  if (shouldNotify(settings.familyNotify as FamilyNotify | undefined, kind)) toastNursery(L(`가족 소식 — ${c.name}`, `Family news — ${c.name}`), L(t.ko, t.en));
  void isBig;
}
/** 민간인 자녀의 죽음 → 살아 있는 부모 지도자에게 「가족을 잃은 슬픔」(onFamilyDeath 와 같은 규칙). */
function griefFor(sid: string, b: ChildrenBook, c: Child, today: string): void {
  for (const pid of [c.ruler, c.parent]) {
    const p = live(sid).find((x) => `p:${x.lid}` === pid); if (!p || !AXES.includes(p.cls as never)) continue;
    const id = `${p.lid}_child_${today.replace(/\D/g, '')}`; if (b.griefs.some((g) => g.id === id)) continue;
    b.griefs.push({ id, lid: p.lid, cls: p.cls as GriefMark['cls'], lost: c.name, kind: 'child', on: today, until: addYears(today, GRIEF_YEARS), state: 'pending' });
    personaNote(sid, pid, L(`${c.name}을(를) 잃고 깊이 슬퍼했다`, `Grieved deeply after losing ${c.name}`));
  }
}

// ---- 청소년 대화
const talks = new Map<string, { lines: { who: 'me' | 'them'; text: string }[] }>();
let busy = false;
const lang = () => (isKo() ? 'ko' : 'en') as 'ko' | 'en';
function teen(sid: string, id: unknown): Child | null { const c = bookOf(sid).children.find((x) => x.id === id); return c && canTalk(c, ctx.gameDate || '') ? c : null; }

export function registerChildren(router: LogRouter): void {
  setChildrenHooks({
    isSpouse: (sid, key) => enabled() && spousesOf(sid).some((s) => s.pid === key),
    familyLine: (sid, key) => (enabled() ? [familyLine(familyOf(bookOf(sid), key, ctx.gameDate || '', (pid) => live(sid).some((p) => `p:${p.lid}` === pid))), courtLink.houseLine(sid, key)].filter(Boolean).join(' ') : ''),
    intimate: (sid, key) => { if (!enabled() || !spousesOf(sid).some((s) => s.pid === key)) return; if (markIntimate(bookOf(sid), key, yearOf(ctx.gameDate || ''))) save(sid); },
  });
  // 가문·가계도·정략결혼(2026-10-28 정치): court-app 이 아기방 장부를 읽고, 혼인을 아이 기록에 남긴다.
  courtLink.kids = (sid) => (enabled() ? bookOf(sid).children.map((c): KidInfo => ({
    id: c.id, name: c.name, gender: c.gender, ruler: c.ruler, rulerName: c.rulerName, parent: c.parent, parentName: c.parentName,
    ...(c.born ? { born: c.born } : {}), ...(c.dead ? { dead: c.dead } : {}), ...(c.adult?.lid ? { adultLid: c.adult.lid } : {}),
    leader: c.adult?.state === 'applied', civ: !!c.civ && !c.adult, ...(c.civ && !c.adult ? { job: jobName(c.civ.job) } : {}), heir: !!c.adult?.heir,
    ...(c.wed || c.civ?.married ? { married: c.wed || c.civ?.married } : {}), adult: (c.adult?.state === 'applied') || (!!c.civ && !c.adult), stage: stageOf(c, ctx.gameDate || ''),
  })) : []);
  courtLink.markWed = (sid, cid, t) => {
    const c = bookOf(sid).children.find((x) => x.id === cid); if (!c) return;
    if (t.spouse) { c.wed = t.spouse; if (c.civ && !c.adult) c.civ.married = t.spouse; }
    c.log.push({ date: ctx.gameDate || '', ko: t.ko, en: t.en }); save(sid);
  };
  router.on(SLOT.CHILDREN, 'children', (m: SllmMessage) => { if (m.kind === 'CHILDADULT' || m.kind === 'CHILDHEIR' || m.kind === 'CHILDTRAIT') terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); });
  onGameSnapshot((snap) => { if (snap.sid && snap.sid === ctx.curSaveId) { void onMonth(snap.sid).then(() => linkLate(snap.sid)); } });

  onRelationDeath((sid, dead, date) => onFamilyDeath(sid, dead, date));
  ipcMain.handle('childList', () => listView());
  ipcMain.handle('familyInfo', (_e, key: unknown) => { const sid = ctx.curSaveId || ''; const k = String(key ?? ''); return sid && /^p:\d+$/.test(k) && enabled() ? familyView(sid, k) : null; });
  // 개발자 도구(설정 → 개발자 도구): 게임에서 육아를 빨리 시험한다. 확률·기다림만 건너뛰고 나머지 규칙은 그대로.
  ipcMain.handle('devChildMake', () => {
    const sid = ctx.curSaveId || '', r = rulerOf(sid), sp = spousesOf(sid)[0];
    if (!sid || !r || !sp) return { ok: false, error: '통치자와 혼인 중인 배우자(비서 제외)가 있어야 합니다.' };
    const b = bookOf(sid); if (!canHaveMoreDev(b, `p:${r.lid}`, sp.pid)) return { ok: false, error: '상한(배우자마다 2명·모두 8명)에 걸렸습니다.' };
    const today = ctx.gameDate || ''; const c: Child = { id: randomUUID().replace(/-/g, '').slice(0, 16), name: '', gender: Math.random() < 0.5 ? 'm' : 'f', ruler: `p:${r.lid}`, rulerName: r.name, parent: sp.pid, parentName: sp.name, conceived: today, due: today, born: today, score: { official: 0, scientist: 0, commander: 0 }, tags: [], done: [], pending: null, log: [{ date: today, ko: '태어났다(개발자 시험)', en: 'Was born (developer test)' }], art: artOf() };
    c.name = childName(sid, c); b.children.push(c); save(sid); return { ok: true, message: `${c.name} — ${sp.name}와(과)의 아이를 오늘 태어난 것으로 만들었습니다.` };
  });
  ipcMain.handle('devChildAge', async (_e, years: unknown) => {
    const sid = ctx.curSaveId || '', n = Math.max(1, Math.min(18, Number(years) || 1)); const b = bookOf(sid); const kids = b.children.filter((c) => !c.adult);
    if (!kids.length) return { ok: false, error: '아기방에 아이가 없습니다.' };
    for (const c of kids) { c.conceived = addYears(c.conceived, -n); c.due = addYears(c.due, -n); if (c.born) c.born = addYears(c.born, -n); }
    save(sid); await onMonth(sid); return { ok: true, message: `아이 ${kids.length}명을 ${n}년 키웠습니다(이번 달 판정까지 실행).` };
  });

  ipcMain.handle('childAnswer', (_e, id: unknown, choice: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id);
    if (!c || !c.pending) return { ok: false, error: L('지금 고를 일이 없습니다.', 'Nothing to decide right now.') };
    const lost = c.pending.id === 'loss' ? nameOf(sid, c.lossQueue?.[0] ?? '') : '';
    const r = answerEvent(c, Number(choice), ctx.gameDate || '', lost); if (!r.ok) return { ok: false, error: L('선택지를 읽지 못했습니다.', 'Could not read that choice.') };
    save(sid); return listView();
  });
  // 공부 고르기(2026-10-27 사용자): 어린이·청소년, 성인식 전까지 언제든 바꿀 수 있다. '' = 고르지 않음(양육 사건 점수로 자동).
  ipcMain.handle('childStudy', (_e, id: unknown, axis: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id); const a = String(axis ?? '');
    const st = c ? stageOf(c, ctx.gameDate || '') : 'expecting';
    if (!c || c.adult || (st !== 'child' && st !== 'teen')) return { ok: false, error: L('어린이·청소년만 공부를 고를 수 있습니다.', 'Only children and teens can choose a course of study.') };
    if (a && !AXES.includes(a as never)) return { ok: false, error: L('공부를 읽지 못했습니다.', 'Unknown course of study.') };
    if (a) c.study = a as Child['study']; else delete c.study; save(sid); return listView();
  });
  ipcMain.handle('childRename', (_e, id: unknown, name: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id); const n = gameNameText(String(name ?? ''));
    if (!c || c.adult || !n) return { ok: false, error: L('이름을 바꿀 수 없습니다.', 'Cannot rename.') };
    c.name = n; save(sid); return listView();
  });
  ipcMain.handle('childHeir', async (_e, id: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id);
    if (gameState.last?.authority !== 4) return { ok: false, error: L('세습(제정) 정부에서만 후계자를 세울 수 있습니다.', 'Only an imperial (hereditary) government has an heir.') };
    // 민간인 자녀도 후계자 자격(2026-10-28): 정하는 순간 지도자로 불러들이고, 게임에서 지도자가 되면 후계자로 세운다.
    if (c?.civ && !c.adult && !c.dead) {
      const j = jobOf(c.civ.job); recall(sid, c, j?.lead ?? 'official', true);
      const line = heirReturnLine(c.name, c.gender, j); chron(L(line.ko, line.en)); c.log.push({ date: ctx.gameDate || '', ko: line.ko, en: line.en }); save(sid);
      void sendAdults(sid); return listView();
    }
    if (!c?.adult?.lid) return { ok: false, error: L('아직 게임의 지도자로 확인되지 않았습니다.', 'Not confirmed as a game leader yet.') };
    if (!ctx.gameRunning) return { ok: false, error: L('게임이 켜져 있어야 합니다.', 'The game must be running.') };
    try { const ok = await makeHeir(sid, c); return ok ? listView() : { ok: false, error: L('게임에서 그 지도자를 찾지 못했습니다.', 'The game could not find that leader.') }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  // ---- 성인 갈림길·민간인(2026-10-28 사용자 확정)
  ipcMain.handle('childCross', (_e, id: unknown, choice: unknown, arg: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id);
    if (!c || !c.cross || c.adult || c.civ) return { ok: false, error: L('지금 정할 진로가 없습니다.', 'There is no path to decide right now.') };
    const today = ctx.gameDate || '', w = wishOf(c);
    if (choice === 'leader') {
      const cls = AXES.includes(arg as never) ? (arg as Child['study']) : (c.study ?? leadFor(w));
      recall(sid, c, cls!, false); c.cross = null;
    } else if (choice === 'civ') {
      const job = jobOf(arg) ? (arg as JobKey) : defaultJob(c.id, w);
      c.civ = { job, on: today }; c.cross = null;
      c.log.push({ date: today, ko: `민간인으로 살기로 했다 — ${jobOf(job)!.ko}`, en: `Chose a civilian life — ${jobOf(job)!.en}` });
      if (!fitsWish(w, { job })) hurt(sid, c, L(WISH_NAME[w].ko, WISH_NAME[w].en));
      chron(L(`통치자의 자녀 ${c.name}이(가) 민간인 ${jobOf(job)!.ko}(으)로 살기로 했다`, `${c.name}, the ruler’s child, chose a civilian life as a ${jobOf(job)!.en}`));
    } else return { ok: false, error: L('진로를 읽지 못했습니다.', 'Unknown path.') };
    save(sid); void sendAdults(sid); return listView();
  });
  ipcMain.handle('childRecall', (_e, id: unknown, cls: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id);
    if (!c?.civ || c.adult || c.dead) return { ok: false, error: L('민간인으로 사는 자녀만 불러들일 수 있습니다.', 'Only a child living as a civilian can be called up.') };
    const a = AXES.includes(cls as never) ? (cls as Child['study'])! : (jobOf(c.civ.job)?.lead ?? 'official');
    recall(sid, c, a, false); save(sid); void sendAdults(sid); return listView();
  });
  ipcMain.handle('childStar', (_e, id: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id);
    if (!c) return { ok: false, error: L('아이를 찾지 못했습니다.', 'Child not found.') };
    c.star = !c.star; save(sid); return listView();
  });
  ipcMain.handle('devChildCivYear', () => { // 개발자 도구: 민간인 삶 사건 한 해를 바로 굴린다
    const sid = ctx.curSaveId || ''; const b = bookOf(sid); const n = civRoll(sid, b, ctx.gameDate || '', true); save(sid);
    return { ok: true, message: `민간인 자녀 ${b.children.filter(isCivAlive).length}명 · 사건 ${n}건` };
  });
  ipcMain.handle('childTalkOpen', async (_e, id: unknown) => {
    const sid = ctx.curSaveId || ''; const c = teen(sid, id);
    if (!c) return { ok: false, error: L('아직 말을 하지 못하는 아이입니다. 어린이(3세)부터 대화할 수 있습니다.', 'This child cannot talk yet. Talks open from age 3.') };
    if (busy) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    const t = { lines: [] as { who: 'me' | 'them'; text: string }[] }; talks.set(sid + '|' + c.id, t);
    busy = true;
    try {
      const j = await personaJson(teenTalkMessages(c, ageOf(c, ctx.gameDate || ''), [], '[The ruler comes into the nursery. Greet them briefly first.]', ctx.gameDate || '', lang()), 1200, 'reply');
      const g = cleanLine(j?.reply); if (g) t.lines.push({ who: 'them', text: g });
      return { ok: true, lines: t.lines.slice() };
    } catch (e) { return { ok: true, lines: [], error: redactKey((e as Error).message) }; }
    finally { busy = false; }
  });
  ipcMain.handle('childTalkSay', async (_e, id: unknown, text: unknown) => {
    const sid = ctx.curSaveId || ''; const c = teen(sid, id), t = c ? talks.get(sid + '|' + c.id) : null, s = cleanLine(text, 500);
    if (!c || !t) return { ok: false, error: L('대화가 끊겼습니다. 다시 열어 주세요.', 'The talk ended. Open it again.') };
    if (!s) return { ok: false, error: L('할 말을 입력하세요.', 'Type something to say.') };
    if (busy) return { ok: false, error: L('이미 응답을 기다리는 중입니다.', 'Already waiting for a reply.') };
    if (t.lines.length >= 40) return { ok: false, error: L('대화가 길어졌습니다. 마치고 다시 열어 주세요.', 'This talk is long. End it and open a new one.') };
    busy = true;
    try {
      const j = await personaJson(teenTalkMessages(c, ageOf(c, ctx.gameDate || ''), t.lines, s, ctx.gameDate || '', lang()), 1200, 'reply'); const reply = cleanLine(j?.reply);
      if (!reply) return { ok: false, error: L('답을 읽지 못했습니다. 다시 말해 보세요.', 'Could not read the reply. Try again.') };
      t.lines.push({ who: 'me', text: s }, { who: 'them', text: reply }); return { ok: true, reply };
    } catch (e) { return { ok: false, error: redactKey((e as Error).message) }; }
    finally { busy = false; }
  });
  ipcMain.handle('childTalkEnd', async (_e, id: unknown) => {
    const sid = ctx.curSaveId || ''; const c = bookOf(sid).children.find((x) => x.id === id); const k = sid + '|' + String(id); const t = talks.get(k); talks.delete(k);
    if (!c || !t || !t.lines.some((l) => l.who === 'me')) return listView();
    if (!c.wish) c.wish = wishOf(c);
    try {
      const j = await personaJson(teenSummaryMessages(c, t.lines, lang()), 800, 'memory');
      const memo = cleanLine(j?.memory, 160); // 대화는 성향에 넣지 않는다(2026-10-27 사용자)
      if (memo) c.log.push({ date: ctx.gameDate || '', ko: memo, en: memo });
      c.talkN = (c.talkN ?? 0) + 1; // 민간인 사건 좋은 일 보너스(대화 5회마다)
      const w = String(j?.wish ?? '') as Wish; // 같은 호출의 「지금 희망」 꼬리표(LLM 호출 추가 없음, 2026-10-28)
      if (!c.civ && WISHES.includes(w) && w !== wishOf(c)) { c.wish = w; c.log.push({ date: ctx.gameDate || '', ko: `꿈이 바뀌었다: ${WISH_NAME[w].ko}`, en: `Now dreams of becoming ${WISH_NAME[w].en}` }); }
      save(sid);
    } catch (e) { logDiagnostic('warn', 'children.summary_failed', { error: (e as Error).message }); }
    return listView();
  });
}
export const _childrenAxes = AXES;
const canHaveMoreDev = (b: ChildrenBook, ruler: string, sp: string) => settings.childLimitOff === true || b.children.filter((c) => c.ruler === ruler).length < CHILDREN.total && b.children.filter((c) => c.ruler === ruler && c.parent === sp).length < CHILDREN.perSpouse;
