// A-00b 5번: 언론(앱 쪽) — 은하 뉴스 저장소·새해 신문 만들기, 소문 만들기, 신문 창, 언론사 설정 IPC.
// 2026-10-15 main.ts에서 옮김(동작 변경 없음). 서신·소문을 번갈아 돌리는 자동 작업 타이머(aiTick)는 main.ts에 남아 있다(서신과 함께 옮길 예정).
import { glassWin } from '../office';
import { crisisNewsWrap, crisisMarkIssue, crisisIsSpecial, setCrisisExtra, setCrisisSpecial } from './crisis-app';
import { pick } from './settings-ui';
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logDiagnostic } from '../diagnostics';
import { IssueStore, LiveStore, liveKey, sectionKey, PAPERS, Issue, collectFacts, newsMessages, parseIssue, paperLines, pickPaper, MIN_FACTS, EXTRA_KINDS, extraMessages, parseExtra, sectionMessages, parseSection } from '../galnews';
import { pickPair, pairKey, gossipMessages, parseGossip, Gossip, gossipDue, GOSSIP_MAX_TOKENS, NEWS_MAX_TOKENS } from '../gossip';
import { MEDIA_FAMILIES, sanitizeMedia, effectivePaper, mediaView, storeBrand, resetBrand, cleanFont } from '../media-custom';
import { isDefaultPersona } from '../media-prefs';
import { cmpDate, addYears } from '../mail';
import { RADIO_IDX } from '../chronicle';
import { settings, settingsPath, saveSettings } from '../app/settings';
import { radio, pushRadioState } from './radio-app';
import { ctx } from '../app/ctx';
import { BoundsStore, restoreRect } from '../window-bounds';
import { moodPromptNow } from './mood-app'; // 민심이 신문 논조에(2026-10-20 알파 10)
import { warFrontInfo } from '../app/war-front'; // 우리 전쟁의 전선(2026-10-26) — frontier-app 이 등록(가져오기 고리 방지)
import { civicHooks } from './civic-hooks'; // 여론조사 한 줄(civic-app 이 꽂는다, 가져오기 순환 방지)
import { photoMenu, photoPromptLines, pickPhoto, pickAd, scenesOf, seeded, tabOf, shipKeyOf, NEWS_TABS, TAB_NAMES, type NewsTab, type PhotoEntry, type EmpireLook } from '../newsphoto'; // 사진 먼저(2026-11-10)
import { classKey, seatMix } from '../speciesClass';

export const media = {
  paperWin: null as BrowserWindow | null,
  paperMode: 'paper' as 'paper' | 'office' | 'display', // display: 집무실 「크게 보기」로 따로 연 큰 디스플레이 지면(2026-10-18) // 2026-10-18: 오버레이 신문 아이콘 = 종이 지면만, 집무실 = 디스플레이 지면만(지면 바꾸기 단추 없음)
  /** 언론사 설정이 바뀔 때마다 올라간다(라디오 대화 기록을 버릴지 판단) */
  revision: 0,
  /** 최근 소문(최대 30) */
  gossips: [] as Gossip[],
};
let issueStore: IssueStore | null = null;
/** 창 크기·위치 기억(집무실·큰 신문 창, 2026-10-18). office-app 도 같이 쓴다. */
export const winBounds = new BoundsStore(() => path.join(app.getPath('userData'), 'sllm_window_bounds.json'), (error) => logDiagnostic('warn', 'storage.write_failed', { store: 'window_bounds', error }));
/** 새 호 표시(집무실 책상 신문, 2026-10-18): 세이브별로 신문을 연 순간의 호 수를 기억하고, 그보다 많으면 새 호. */
export const paperHooks = { changed: (): void => {} };
let seenData: Record<string, number> | null = null;
const seenFile = () => path.join(app.getPath('userData'), 'sllm_paper_seen.json');
function seenAll(): Record<string, number> { if (seenData) return seenData; try { const j = JSON.parse(fs.readFileSync(seenFile(), 'utf8')); seenData = j && typeof j === 'object' ? j : {}; } catch { seenData = {}; } return seenData!; }
const ownIssueCount = (sid: string): number => ctx.govMem().split(sid, issues().list(sid)).own.length;
export function paperUnseen(): boolean { const sid = ctx.curSaveId; if (!sid) return false; try { return ownIssueCount(sid) > (seenAll()[sid] ?? 0); } catch { return false; } }
export function markPaperSeen(): void {
  const sid = ctx.curSaveId; if (!sid) return;
  try { const n = ownIssueCount(sid); if (seenAll()[sid] === n) return; seenAll()[sid] = n; fs.writeFileSync(seenFile(), JSON.stringify(seenAll()), 'utf8'); } catch (e) { logDiagnostic('warn', 'storage.write_failed', { store: 'paper_seen', error: e }); }
  paperHooks.changed();
}
let liveStoreObj: LiveStore | null = null;
export function liveStore(): LiveStore { return (liveStoreObj ??= new LiveStore(path.join(app.getPath('userData'), 'sllm_news_live.json'), (sid) => ctx.govMem().currentBranch(sid))); }
export function issues(): IssueStore { return (issueStore ??= new IssueStore(path.join(app.getPath('userData'), 'sllm_galnews.json'), (sid) => ctx.govMem().currentBranch(sid))); }

export function closePaper() { if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.close(); media.paperWin = null; }
/** 신문은 본 창과 따로, 게임 화면 대부분을 덮는 큰 창으로 연다. */
export function openPaper(glass = false, opt: { display?: boolean; unfold?: boolean } = {}) {
  const area = ctx.gameDip ?? screen.getPrimaryDisplay().workArea;
  const sz = { width: Math.min(1320, area.width), height: Math.min(1000, Math.round(area.height * 0.92)) };
  let x = Math.round(area.x + (area.width - sz.width) / 2), y = Math.round(area.y + (area.height - sz.height) / 2);
  // glass: 집무실 화면에 붙는 디스플레이 지면. display: 집무실 「크게 보기」로 따로 연 큰 디스플레이 지면. 그 밖: 종이 지면(오버레이 아이콘·집무실 책상 신문)
  const mode = glass ? 'office' : opt.display ? 'display' : 'paper';
  markPaperSeen();
  if (media.paperWin && !media.paperWin.isDestroyed()) {
    if (media.paperMode === mode) { media.paperWin.show(); media.paperWin.focus(); media.paperWin.webContents.send('paperInit'); return; }
    media.paperWin.close(); // 다른 지면으로 열려 있으면 닫고 새로(집무실에 붙어 있던 신문이면 집무실은 바탕화면으로 돌아간다)
  }
  media.paperMode = mode;
  if (!glass) { // 큰 창은 지난번 높이·위치를 기억한다(폭은 지면 폭으로 고정)
    const saved = restoreRect(winBounds.get('paper'), screen.getAllDisplays().map((d) => d.workArea), { width: sz.width, height: 560 });
    if (saved) { x = saved.x; y = saved.y; sz.height = saved.height; }
  }
  const w = media.paperWin = new BrowserWindow({ ...sz, x, y, minWidth: sz.width, maxWidth: sz.width, minHeight: 560, maximizable: false, frame: false, show: false, backgroundColor: '#0a0d12', ...glassWin(glass), alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.js') } });
  media.paperWin.setAlwaysOnTop(true, 'screen-saver', 1);
  media.paperWin.loadFile(path.join(__dirname, '..', '..', 'ui', 'paper.html'), { query: { mode, ...(opt.unfold ? { unfold: '1' } : {}) } });
  if (!glass) { const keep = () => (w.isDestroyed() ? null : w.getBounds()); w.on('move', () => winBounds.later('paper', keep)); w.on('resize', () => winBounds.later('paper', keep)); w.on('close', () => { const b = keep(); if (b) winBounds.set('paper', b); }); }
  media.paperWin.once('ready-to-show', () => { if (!w.isDestroyed()) w.show(); });
  media.paperWin.on('closed', () => { if (media.paperWin === w) media.paperWin = null; }); // 닫히는 옛 창이 새 창을 지우지 않게
}

// ---- 신문 사진(2026-11-10 사용자: 「사진을 먼저 게시하고 그 사진과 정보로 LLM 이 글을 쓴다」). 그림: ui/news/photos(index.json).
let photoIndex: PhotoEntry[] | null = null;
function photos(): PhotoEntry[] {
  if (photoIndex) return photoIndex;
  try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ui', 'news', 'photos', 'index.json'), 'utf8')); photoIndex = Array.isArray(j) ? j.filter((x: any) => x && typeof x.file === 'string' && /^[a-z0-9_]+\.webp$/.test(x.file)) : []; }
  catch (error) { photoIndex = []; logDiagnostic('warn', 'storage.read_failed', { store: 'news_photos', error }); }
  return photoIndex!;
}
/** 우리 제국: 주 종족·게슈탈트·세이브의 종족 인구 비율(민간 사건 사진을 비율대로). */
function playerLook(): EmpireLook {
  const pr = ctx.profiles.get(ctx.playerIdx), cls = classKey(pr?.cls);
  let mix: { k: string; s: number }[] | undefined; try { mix = seatMix(ctx.flagProv.portraitInfoFor(ctx.playerIdx), cls ?? 'human'); } catch { mix = undefined; }
  return { cls, gest: pr?.gest ?? 0, mix };
}
/** 사실 한 줄의 제국: 연대기 묶음 이름이 우리면 우리, 아니면 글에 나온 아는 제국(긴 이름 먼저). 모르면 null(인간 사진). */
function factLook(f: { who: string; text: string }): EmpireLook | null {
  const me = ctx.playerName || '';
  const known = [...ctx.mailCountries.values()].filter((c) => c.name && c.profile).sort((a, b) => b.name.length - a.name.length);
  const other = known.find((c) => c.name === f.who) ?? known.find((c) => f.text.includes(c.name));
  // 고유 함선 세력(몰락 제국·은하 위기, 2026-11-10): 통신 목록의 게임 나라 종류로, 모르면 이름으로. 위기 세력은 프로필이 없어 known 에 없을 수 있음
  const tcs = [...ctx.terminal.all].filter((c) => c.name).sort((a, b) => b.name.length - a.name.length);
  const tc = (other && tcs.find((c) => c.idx === other.idx)) || tcs.find((c) => c.name === f.who) || (!other ? tcs.find((c) => f.text.includes(c.name)) : undefined);
  if ((me && (f.who === me || (!other && !tc && f.text.includes(me)))) || (!other && !tc && !f.who)) return playerLook();
  const ship = shipKeyOf(tc?.type, tc?.gest, other?.name ?? tc?.name ?? f.who);
  if (other) return { cls: classKey(other.profile.cls), gest: other.profile.gest ?? 0, ...(ship ? { ship } : {}) };
  return tc ? { gest: tc.gest ?? 0, ...(ship ? { ship } : {}) } : null;
}
/** 최근 세 호에 실린 사진(되도록 다시 쓰지 않는다). */
function recentPhotos(sid: string): Set<string> {
  const out = new Set<string>(); for (const it of issues().list(sid).slice(-3)) { for (const a of it.articles) if (a.photo) out.add(a.photo); if (it.ad) out.add(it.ad); } return out;
}

export function announceMedia() {
  const state = mediaView(settings.mediaPrefs);
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('mediaChanged', state);
  pushRadioState();
}

/** 가장 최근 은하 뉴스(2년 안)를 프롬프트 줄로. 이 제국들도 읽은 것으로 친다. */
export function currentPaper(): string[] {
  if (!ctx.curSaveId) return [];
  const own = ctx.govMem().split(ctx.curSaveId, issues().list(ctx.curSaveId)).own; const last = own[own.length - 1];
  if (!last || (ctx.gameDate && cmpDate(last.date, addYears(ctx.gameDate, -2)) < 0)) return [];
  return paperLines(last);
}
/** 사실에 나온 제국들의 종족·성향 한 줄 요약(신문사의 논조 판단 재료). 아는 제국만. */
/** 신문 프롬프트 자료: 등장 제국 정보 + 우리 제국 민심 한 줄(2026-10-20). */
export function empireInfo(facts: Array<{ who: string; text: string }>): string[] { const mood = moodPromptNow(); return [...empireInfoOnly(facts), ...(mood ? ['- ' + mood] : [])]; }
function empireInfoOnly(facts: Array<{ who: string; text: string }>): string[] {
  const out: string[] = []; const seen = new Set<string>();
  for (const c of ctx.mailCountries.values()) {
    if (seen.has(c.name) || !c.name || !c.profile) continue;
    if (!facts.some((f) => f.who === c.name || f.text.includes(c.name))) continue;
    seen.add(c.name); const ties = Object.entries(c.profile.flags || {}).filter(([, v]) => v).map(([k]) => k).join(', '); out.push(`- ${c.name}: species ${c.profile.species || 'unknown'}, personality ${c.profile.personality || 'unknown'}, ${c.profile.gov || ''}; attitude toward us ${c.op}${ties ? ` (${ties})` : ''}`.trim()); // 남의 전쟁 논조는 우리와의 관계를 따른다(2026-10-28) // 프롬프트 자료(영어, 2026-10-19)
  }
  return out.slice(0, 12);
}
/** 새해가 되면 지난 한 해의 연대기로 은하 뉴스 한 호를 낸다. 사실이 MIN_FACTS 건보다 적으면 내지 않는다. */
const sectionBusy = new Set<string>(); // 같은 분야 탭을 두 번 눌러도 한 번만 만든다
const publishing = new Set<string>(); // 같은 날짜 신호가 두 번 와도(재연결 때 로그 다시 읽기 등) 한 호만 만든다(2026-10-18)
export async function publishNews(date: string) {
  if (!ctx.curSaveId || !date || issues().has(ctx.curSaveId, date)) return;
  const sid = ctx.curSaveId, pk = sid + '|' + date;
  if (publishing.has(pk)) return;
  publishing.add(pk);
  try { await publishNewsNow(sid, date); } finally { publishing.delete(pk); }
}
/** 신문에 쓰는 연대기 묶음(라디오 전용·사망 줄·이름 못 푼 줄 제외). 정기호와 홈페이지 분야 탭이 같이 쓴다. */
function paperGroups(sid: string) {
  return ctx.chron().groups(sid, (all) => ctx.govMem().split(sid, all).own).filter((g) => g.idx !== RADIO_IDX).map((g) => ({ ...g, items: g.items.filter((e) => !e.text.startsWith('지도자 사망:') && !/(^|\s)NAME_[A-Za-z0-9_]+/.test(e.text)) })).filter((g) => g.items.length);
}
async function publishNewsNow(sid: string, date: string) {
  const groups = paperGroups(sid);
  const facts = collectFacts(groups, addYears(date, -1), 40, date);
  if (facts.length < MIN_FACTS) return;
  try {
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = pickPaper(lastIssue?.paper, Math.random, settings.papersOn);
    if (pi < 0) return; // 켜진 신문사가 없으면 신문을 내지 않는다
    const paper = effectivePaper(settings.mediaPrefs, pi);
    const fronts = await warFrontInfo().catch(() => [] as string[]); // 우리 전쟁의 전선(2026-10-26)
    const poll = civicHooks.pollLine(pi, date); // 이 신문사의 최근 여론조사(2026-11-03 시민 정치)
    const recent = recentPhotos(sid), menu = photoMenu(photos(), facts, (i) => factLook(facts[i]), sid + '|' + date, recent); // 사진 먼저: 사실마다 그 제국 종족의 사진 후보
    const raw = await ctx.ai.chat(newsMessages(ctx.playerName || 'the player empire', date, facts, paper, [...empireInfo(facts), ...fronts.map((l) => '- ' + l), ...(poll ? ['- ' + poll] : [])], photoPromptLines(menu, facts)), { purpose: 'newspaper', maxTokens: NEWS_MAX_TOKENS, json: true });
    const body: (ReturnType<typeof parseIssue> & { ad?: string }) | null = parseIssue(raw);
    if (body) { // 사진 번호 → 파일(후보에 없는 번호·두 번 쓴 사진은 뺀다), 광고는 우리 종족 비율로
      const used = new Set<string>();
      for (const a of body.articles) { const m = menu.find((x) => x.id === a.photo); if (m && !used.has(m.file)) { used.add(m.file); a.photo = m.file; } else { delete a.photo; delete a.caption; } }
      const ad = pickAd(photos(), playerLook(), seeded(sid + '|' + date + '|ad')); if (ad) body.ad = ad.file;
    } if (!body) {logDiagnostic('warn','ai.response.invalid',{feature:'newspaper',chars:raw.length});return;}if(ctx.curSaveId!==sid){logDiagnostic('info','ai.response.discarded',{feature:'newspaper',reason:'save_changed'});return;}
    const it = issues().add(sid, date, body, pi);
    ctx.toUi('galnews', { ...it, paperInfo: paper });
    if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
    paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
    ctx.notify({ kind: 'news', title: effectivePaper(settings.mediaPrefs, pi).name, body: it.headline });
  } catch (e) { ctx.mailNote(pick('은하 뉴스 만들기 실패: ', 'Failed to make the Galactic News: ') + (e as Error).message); }
}
/** 호외 후보: 세이브마다 이번 달 가장 큰 사건 하나. 달이 지나면(다음 월 신호) 낸다. 앱을 껐다 켜면 사라진다. */
const pendingExtra = new Map<string, { date: string; kind: string; text: string; pri: number }>();
export function noteExtra(kind: string, date: string, text: string) {
  const sid = ctx.curSaveId; const pri = EXTRA_KINDS[kind];
  if (!sid || !date || !pri || !settings.extraOn) return;
  const cur = pendingExtra.get(sid);
  if (cur && cur.date.slice(0, 7) === date.slice(0, 7) && cur.pri >= pri) return;
  pendingExtra.set(sid, { date, kind, text, pri });
}
/** 달이 바뀌었을 때 지난 달의 큰 사건이 있고 그해 호외 상한 안이면 호외 한 장을 낸다. 사건이 없으면 AI 를 부르지 않는다. */
export async function publishExtra(nowDate: string) {
  const sid = ctx.curSaveId; const p = sid ? pendingExtra.get(sid) : undefined;
  if (!sid || !p || !nowDate || p.date.slice(0, 7) === nowDate.slice(0, 7)) return;
  pendingExtra.delete(sid);
  const specials = issues().list(sid).filter((i) => i.extra && i.date.slice(0, 4) === p.date.slice(0, 4) && crisisIsSpecial(i.id)).length; // 위기 특별판은 호외 연 상한에 넣지 않는다
  if (!settings.extraOn || issues().extraCount(sid, p.date.slice(0, 4)) - specials >= settings.extraMax) return;
  try {
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = pickPaper(lastIssue?.paper, Math.random, settings.papersOn);
    if (pi < 0) return;
    const paper = effectivePaper(settings.mediaPrefs, pi);
    const fronts = await warFrontInfo().catch(() => [] as string[]); // 우리 전쟁의 전선(2026-10-26)
    const ph = pickPhoto(photos(), scenesOf(p.text), factLook({ who: '', text: p.text }), seeded(sid + '|' + p.date + '|x'), recentPhotos(sid)); // 사진 먼저(2026-11-10)
    const raw = await ctx.ai.chat(extraMessages(ctx.playerName || 'the player empire', nowDate, p.text, paper, [...empireInfo([{ who: '', text: p.text }]), ...fronts.map((l) => '- ' + l)], ph?.desc ?? ''), { purpose: 'newspaper', maxTokens: 2000, json: true });
    const body = parseExtra(raw);
    if (body && ph && body.articles[0]) body.articles[0].photo = ph.file; if (!body) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'newspaper_extra', chars: raw.length }); return; }
    if (ctx.curSaveId !== sid) { logDiagnostic('info', 'ai.response.discarded', { feature: 'newspaper_extra', reason: 'save_changed' }); return; }
    const it = issues().add(sid, nowDate, body, pi, true);
    ctx.toUi('galnews', { ...it, paperInfo: paper });
    if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
    paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
    ctx.notify({ kind: 'news', title: pick('[호외] ', '[Extra] ') + paper.name, body: it.headline });
  } catch (e) { ctx.mailNote(pick('호외 만들기 실패: ', 'Failed to make the extra edition: ') + (e as Error).message); }
}
let gossipSeq = 0, lastPair = '', lastGossipKey = '';
export async function makeGossip() {
  const sid = ctx.curSaveId, date = ctx.gameDate;
  if (!gossipDue(lastGossipKey, sid, date)) { logDiagnostic('info', 'gossip.skip', { reason: 'same_game_date', date }); return; }
  const pr = pickPair([...ctx.mailCountries.values()], ctx.news, ctx.playerIdx, lastPair);
  if (!pr) return;
  lastGossipKey = sid + '|' + date; // 실패해도 같은 날짜에는 다시 부르지 않는다
  const [a, b] = pr; lastPair = pairKey(a, b);
  const raw = await ctx.ai.chat(gossipMessages(ctx.playerName || 'the player empire', date, a, b, ctx.news, currentPaper()), { purpose: 'gossip', maxTokens: GOSSIP_MAX_TOKENS, json: true });
  const lines = parseGossip(raw, a.name, b.name);
  if (!lines) {logDiagnostic('warn','ai.response.invalid',{feature:'gossip',chars:raw.length});return;}
  const g: Gossip = { id: ++gossipSeq, date: ctx.gameDate, a: a.name, b: b.name, lines };
  media.gossips.push(g); while (media.gossips.length > 30) media.gossips.shift();
  ctx.toUi('gossip', g);
  ctx.notify({ kind: 'info', title: pick('엿들은 소문', 'Overheard rumor'), body: pick(`${a.name}와(과) ${b.name}의 비공개 대화를 엿들었습니다.`, `Overheard a private conversation between ${a.name} and ${b.name}.`) });
}

export function registerMedia(): void {
  ipcMain.handle('mediaGet', async () => mediaView(settings.mediaPrefs));
  ipcMain.handle('mediaSave', async (_e, id: unknown, value: unknown) => {
    try {
      const index = MEDIA_FAMILIES.findIndex((f) => f.id === id);
      if (index < 0) throw new Error(pick('알 수 없는 언론사입니다.', 'Unknown media outlet.'));
      const v = value as { persona?: unknown; comments?: unknown; paperName?: unknown; radioName?: unknown; font?: unknown } | null;
      if (v !== null && (typeof v?.persona !== 'string' || !v.persona.trim() || v.persona.length > 4000 || typeof v.comments !== 'boolean')) throw new Error(pick('페르소나를 1~4000자로 입력하세요.', 'Enter a persona of 1–4000 characters.'));
      if (v !== null && [v.paperName, v.radioName].some((name) => typeof name !== 'string' || !name.trim() || name.trim().length > 40)) throw new Error(pick('신문사·방송사 이름을 각각 1~40자로 입력하세요.', 'Enter newspaper and station names of 1–40 characters each.'));
      const next = settings.mediaPrefs.slice();
      next[index] = v === null ? { ...sanitizeMedia(null)[index], paperName: next[index].paperName, radioName: next[index].radioName, font: next[index].font } : { paperName: (v.paperName as string).trim(), radioName: (v.radioName as string).trim(), persona: isDefaultPersona(index, v.persona as string) ? '' : (v.persona as string).trim(), comments: v.comments as boolean, font: v.font === undefined ? next[index].font : cleanFont(v.font) };
      fs.writeFileSync(settingsPath(), JSON.stringify({ ...settings, mediaPrefs: next }, null, 2), 'utf8');
      settings.mediaPrefs = next; media.revision++; radio.history.delete(MEDIA_FAMILIES[index].id); radio.history.delete(MEDIA_FAMILIES[index].id + ':daily'); announceMedia();
      return { ok: true, state: mediaView(settings.mediaPrefs) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  ipcMain.handle('mediaBrand', async (_e, id: string, kind: string, reset: boolean) => {
    try {
      if (!MEDIA_FAMILIES.some((f) => f.id === id) || !['paper', 'radio', 'web'].includes(kind)) throw new Error(pick('알 수 없는 브랜드입니다.', 'Unknown brand.'));
      if (reset === true) resetBrand(id, kind);
      else {
        const owner = ctx.setWin && !ctx.setWin.isDestroyed() ? ctx.setWin : ctx.win!;
        const result = await dialog.showOpenDialog(owner, { title: pick('브랜드 그림 고르기 (8MB 이하)', 'Choose a brand image (8 MB or less)'), properties: ['openFile'], filters: [{ name: pick('그림', 'Images'), extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
        if (result.canceled || !result.filePaths[0]) return { ok: true, cancelled: true };
        storeBrand(id, kind, result.filePaths[0]);
      }
      announceMedia(); return { ok: true, state: mediaView(settings.mediaPrefs) };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  });
  // 홈페이지 실시간 소식(2026-11-10): 지난 1년 연대기 줄을 그대로(LLM 없음) 보여 주고, 독자가 누른 사건만 기사로 쓴다. 쓴 기사는 저장.
  const paperTabs = () => PAPERS.map((_, i) => { const p = effectivePaper(settings.mediaPrefs, i); return { name: p.name, sub: p.sub, accent: p.accent, briefsFact: p.briefsFact, on: settings.papersOn?.[i] !== false }; }); // 홈페이지 신문사 탭(꺼 둔 신문사는 탭 없음)
  const liveFacts = (sid: string) => { const until = ctx.gameDate || ''; const since = until ? addYears(until, -1) : ''; return collectFacts(paperGroups(sid), since, 40, until).slice().reverse(); };
  ipcMain.handle('newsLive', async () => {
    const sid = ctx.curSaveId; if (!sid) return { facts: [], stories: [] };
    const stories = liveStore().list(sid);
    return { facts: liveFacts(sid).slice(0, 14).map((f) => ({ key: liveKey(f), date: f.date, text: f.text, readBy: stories.filter((s) => s.key === liveKey(f)).map((s) => s.paper ?? 0) })), stories, papers: paperTabs(), subPicked: settings.newsSubPicked };
  });
  // 2026-11-10 사용자: 신문사 홈페이지 3곳을 탭으로 오가고, 실시간 기사는 지금 보는 신문사가 그 논조로 쓴다(같은 사건도 신문사마다 따로)
  const okPaper = (p: unknown): p is number => typeof p === 'number' && Number.isInteger(p) && p >= 0 && p < PAPERS.length;
  const subscribed = (i: number) => settings.papersOn?.[i] !== false;
  // 2026-11-10 사용자: LLM 을 아끼려고 신문 구독제(무료). 구독 = 설정의 「신문사 켜기」. 구독한 신문사만 정기호·분야·실시간 기사를 쓴다. 마지막 하나는 홈페이지에서 해지하지 않는다
  ipcMain.handle('newsSubscribe', async (_e, i: number, on: boolean, only?: boolean) => {
    if (!okPaper(i) || typeof on !== 'boolean') return { ok: false };
    const next = only === true ? PAPERS.map((_, k) => k === i) : PAPERS.map((_, k) => (k === i ? on : subscribed(k)));
    if (!next.some(Boolean)) return { ok: false, last: true };
    settings.papersOn = next; settings.newsSubPicked = true; saveSettings();
    return { ok: true, papers: paperTabs(), subPicked: true };
  });
  ipcMain.handle('newsLiveWrite', async (_e, key: string, want?: number) => {
    const sid = ctx.curSaveId; if (!sid || typeof key !== 'string') return { ok: false };
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = okPaper(want) ? want : lastIssue?.paper ?? 0, paper = effectivePaper(settings.mediaPrefs, pi);
    const had = liveStore().get(sid, key, pi); if (had) return { ok: true, story: had };
    if (!subscribed(pi)) return { ok: false, unsub: true }; // 구독하지 않은 신문사는 새 기사를 쓰지 않는다
    const f = liveFacts(sid).find((x) => liveKey(x) === key); if (!f) return { ok: false };
    const bk = sid + '|live|' + pi + '|' + key; if (sectionBusy.has(bk)) return { ok: false, busy: true }; sectionBusy.add(bk);
    try {
      const ph = pickPhoto(photos(), scenesOf(f.text), factLook(f), seeded(sid + '|' + key), recentPhotos(sid)); // 사진 먼저
      const raw = await ctx.ai.chat(extraMessages(ctx.playerName || 'the player empire', f.date, f.text, paper, empireInfo([f]), ph?.desc ?? ''), { purpose: 'newspaper', maxTokens: 2000, json: true });
      const body = parseExtra(raw); if (!body || !body.articles[0]) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'newspaper_live', chars: raw.length }); return { ok: false }; }
      const article = body.articles[0]; if (ph) article.photo = ph.file; else delete article.caption;
      if (ctx.curSaveId !== sid) return { ok: false };
      return { ok: true, story: liveStore().add({ sid, key, date: f.date, fact: f.text, article, paper: pi }) };
    } catch (e) { return { ok: false, error: (e as Error).message }; } finally { sectionBusy.delete(bk); }
  });
  // 홈페이지 분야 탭(2026-11-10): 그해 그 분야 사실로만 기사 많아야 3건. 한 번 만들면 그 호에 저장. 사실이 없으면 빈 칸(지어내지 않는다).
  ipcMain.handle('newsSection', async (_e, id: number, tab: string, want?: number) => {
    const sid = ctx.curSaveId;
    if (!sid || !(NEWS_TABS as readonly string[]).includes(tab)) return { ok: false };
    const it = issues().list(sid).find((i) => i.id === id); if (!it) return { ok: false };
    const pi = okPaper(want) ? want : it.paper ?? 0, sk = sectionKey(tab, pi, it.paper); // 다른 신문사 홈페이지면 그 신문사 논조로 따로 쓴다
    if (it.sections && Array.isArray(it.sections[sk])) return { ok: true, articles: it.sections[sk] };
    if (!subscribed(pi)) return { ok: false, unsub: true };
    const key = sid + '|' + id + '|' + sk; if (sectionBusy.has(key)) return { ok: false, busy: true }; sectionBusy.add(key);
    try {
      const facts = collectFacts(paperGroups(sid), addYears(it.date, -1), 160, it.date).filter((f) => tabOf(f.text) === tab).slice(-12);
      if (!facts.length) { issues().setSection(id, sk, []); return { ok: true, articles: [] }; }
      const paper = effectivePaper(settings.mediaPrefs, pi);
      const used = recentPhotos(sid); for (const a of it.articles) if (a.photo) used.add(a.photo); for (const v of Object.values(it.sections || {})) for (const a of v) if (a.photo) used.add(a.photo);
      const menu = photoMenu(photos(), facts, (i) => factLook(facts[i]), sid + '|' + it.date + '|' + tab, used, 4);
      const raw = await ctx.ai.chat(sectionMessages(ctx.playerName || 'the player empire', it.date, TAB_NAMES[tab as NewsTab], facts, it.articles.map((a) => a.title), paper, empireInfo(facts), photoPromptLines(menu, facts)), { purpose: 'newspaper', maxTokens: NEWS_MAX_TOKENS, json: true });
      const arts = parseSection(raw); if (!arts) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'newspaper_section', chars: raw.length }); return { ok: false }; }
      const taken = new Set<string>(); for (const a of arts) { const m = menu.find((x) => x.id === a.photo); if (m && !taken.has(m.file)) { taken.add(m.file); a.photo = m.file; } else { delete a.photo; delete a.caption; } }
      if (ctx.curSaveId !== sid) return { ok: false };
      const saved = issues().setSection(id, sk, arts); return { ok: true, articles: saved?.sections?.[sk] ?? arts };
    } catch (e) { return { ok: false, error: (e as Error).message }; } finally { sectionBusy.delete(key); }
  });
  ipcMain.handle('newsList', async () => (ctx.curSaveId ? ctx.govMem().split(ctx.curSaveId, issues().list(ctx.curSaveId)).own.slice().reverse().map((i: Issue) => ({ ...i, paperInfo: effectivePaper(settings.mediaPrefs, i.paper ?? 0) })) : []));
  ipcMain.handle('gossipList', async () => media.gossips.slice());
  ipcMain.handle('paperOpen', async () => { openPaper(); return true; });
  ipcMain.handle('paperDesk', async () => { openPaper(false, { unfold: true }); return true; }); // 집무실 책상 위 신문: 종이 지면 큰 창 + 펼치는 효과(2026-10-18)
  ipcMain.handle('paperBig', async () => { openPaper(false, { display: true }); return true; }); // 집무실 신문 「크게 보기」: 디스플레이 지면 큰 창
  ipcMain.handle('paperClose', async () => { closePaper(); return true; });
}
/** 은하 위기 특별판(2026-10-17): 위기가 새로 나타난 달에 바로 한 장. 호외 모양 + 특별판 지면, 호외 연 상한과 별개. 정기호·일반 호외는 평소대로. */
export async function publishCrisisSpecial(date: string, fact: string, label: { ko: string; en: string }) {
  const sid = ctx.curSaveId; if (!sid || !date) return;
  try {
    const lastIssue = ctx.govMem().split(sid, issues().list(sid)).own.slice(-1)[0];
    const pi = pickPaper(lastIssue?.paper, Math.random, settings.papersOn);
    if (pi < 0) return;
    const paper = effectivePaper(settings.mediaPrefs, pi);
    const raw = await ctx.ai.chat(crisisNewsWrap(extraMessages(ctx.playerName || 'the player empire', date, fact, paper, empireInfo([{ who: '', text: fact }]))), { purpose: 'newspaper', maxTokens: 2000, json: true });
    const body = parseExtra(raw); if (!body) { logDiagnostic('warn', 'ai.response.invalid', { feature: 'newspaper_crisis', chars: raw.length }); return; }
    if (ctx.curSaveId !== sid) { logDiagnostic('info', 'ai.response.discarded', { feature: 'newspaper_crisis', reason: 'save_changed' }); return; }
    const it = issues().add(sid, date, body, pi, true); crisisMarkIssue(it.id, label);
    ctx.toUi('galnews', { ...it, paperInfo: paper });
    if (media.paperWin && !media.paperWin.isDestroyed()) media.paperWin.webContents.send('galnews', { ...it, paperInfo: paper });
    paperHooks.changed(); // 집무실 책상 신문의 새 호 표시
    ctx.notify({ kind: 'news', title: pick('[위기 특별판]', '[Crisis special edition]') + ' ' + paper.name, body: it.headline });
  } catch (e) { ctx.mailNote(pick('위기 특별판 만들기 실패: ', 'Failed to make the crisis special edition: ') + (e as Error).message); }
}
setCrisisExtra(noteExtra); // 은하 위기가 끝날 때 일반 호외 예약 — 2026-10-17
setCrisisSpecial(publishCrisisSpecial); // 위기가 나타날 때 특별판 발행
