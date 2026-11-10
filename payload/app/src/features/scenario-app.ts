// SLLM 시나리오 알아보기(2026-11-05 사용자: 「앱이랑 연계」 1·2단계) — 앱 쪽. 규칙·문구: src/scenario.ts · 화면: ui/office-tension.js
// 로그 자리 SCENARIO(189): SCN · SCNN · SCNSEAT(시나리오 모드 scenario-mods/sllm_scenario_corridor 가 찍음, 줄마다 sid = SLLM 세이브 번호)
// 하는 일: ① 세이브가 시나리오인지 기억(sllm_scenario.json) ② 처음 알아보면 연대기에 지난 역사(세계 소식 + 플레이어와 각 나라 사이의 일)
//          ③ AI 프롬프트에 시나리오 배경 + 대립 긴장도 한 줄(setPromptAugment 에 서재와 나란히) ④ 휴전 기념일 선택을 연대기에
// 런처에서 시나리오 모드가 켜져 있으면 세이브를 불러오자마자 게임에 한 번 물어 바로 알아본다(sllm_cr_hello, 아래 「빨리 알아보기」).
// sid 가 0 이거나 없는 줄(본편 없이 시나리오만 켠 판)은 무시한다. 연대기는 지금 불러온 세이브(ctx.curSaveId)가 그 sid 일 때만 쓴다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ctx } from '../app/ctx';
import { SLOT, type LogRouter } from '../app/log-router';
import type { SllmMessage } from '../protocol';
import { L } from '../i18n-pick';
import { logDiagnostic } from '../diagnostics';
import { link, enqueue, sendConsole } from '../app/game-link';
import { cleanSaveId } from '../images';
import { chronPut, idxNames, WORLD_IDX } from './chronicle-app';
import { office } from './office-app';
import { tensionNow, tensionPrompt } from './tension-app';
import { type ScnSave, type Side, fixScn, applyScn, worldSeed, sideSeed, truceLine, scenarioPrompt, SCN_TITLE, SIDE_ROLE, LVL_NAME } from '../scenario';

const file = () => path.join(app.getPath('userData'), 'sllm_scenario.json');
let all: Record<string, ScnSave> | null = null;
const books = (): Record<string, ScnSave> => {
  if (all) return all; all = {};
  try { const j = JSON.parse(fs.readFileSync(file(), 'utf8')); if (j && typeof j.saves === 'object' && j.saves) for (const [k, v] of Object.entries(j.saves)) { const s = fixScn(v); if (s && cleanSaveId(k)) all[k] = s; } }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'scenario', error: (e as Error).message }); }
  return all;
};
let dirty: ReturnType<typeof setTimeout> | null = null;
const save = () => { if (dirty) return; dirty = setTimeout(() => { dirty = null; try { const t = file() + '.tmp'; fs.writeFileSync(t, JSON.stringify({ saves: books() })); fs.renameSync(t, file()); } catch (e) { logDiagnostic('warn', 'scenario.save_failed', { error: (e as Error).message }); } }, 1000); };

/** 지금 세이브의 시나리오(아니면 null). */
export function scenarioNow(): ScnSave | null { const sid = ctx.curSaveId; return sid ? books()[sid] ?? null : null; }

/** 그 나라의 SLLM 제국 번호: 시나리오 줄 → 연대기 이름표(IDX 신호) → 긴장도 이름 줄 순. 모르면 0. */
function idxOf(s: ScnSave, x: Side): number {
  if (s.idx[x]) return s.idx[x]!;
  const nm = s.names[x]; if (!nm) return 0;
  for (const [i, n] of idxNames) if (n === nm && i > 0 && i < 9000) return i;
  const t = tensionNow(); for (const sd of [t?.a, t?.b]) if (sd && sd.name === nm && sd.idx > 0) return sd.idx;
  return 0;
}

/** 지난 역사 넣기. 세이브가 지금 불러온 것이고 이름을 알 때만, 한 번씩. */
function seed(sid: string, s: ScnSave): void {
  if (ctx.curSaveId !== sid || !s.names.a || !s.names.b) return;
  let wrote = false;
  if (!s.seeded.world) {
    idxNames.set(WORLD_IDX, '세계 소식');
    for (const l of worldSeed(s)) chronPut(WORLD_IDX, l.d, L(l.ko, l.en), true, { name: '세계 소식', world: true });
    s.seeded.world = true; wrote = true;
  }
  if (s.seat) for (const x of ['a', 'b', 'p'] as Side[]) {
    if (s.seeded[x] || x === s.seat) continue;
    const lines = sideSeed(s, x); if (!lines.length) { s.seeded[x] = true; continue; }
    const i = idxOf(s, x); if (!i) continue; // 번호를 알게 되면 다음에
    for (const l of lines) chronPut(i, l.d, L(l.ko, l.en), true, { name: s.names[x] });
    s.seeded[x] = true; wrote = true;
  }
  if (wrote) save();
  if (s.seeded.world && !s.told) {
    s.told = true; save();
    (office as { toastGo: string }).toastGo = 'embassy';
    const t = SCN_TITLE[s.id] || ['시나리오', 'Scenario'];
    const seat = s.seat && s.seat !== 'x' ? SIDE_ROLE[s.seat] : null;
    ctx.notify({ kind: 'office', title: L(`시나리오: ${t[0]}`, `Scenario: ${t[1]}`),
      body: L(`이 세이브를 「${t[0]}」 시나리오로 알아봤습니다.${seat ? ` 우리는 ${seat[0]}에 있습니다.` : ''} 연대기에 두 나라의 지난 역사를 넣었고, AI 대화에 시나리오 배경을 알려 줍니다.`,
        `This save is the "${t[1]}" scenario.${seat ? ` We hold ${seat[1]}.` : ''} The two powers' past has been added to the chronicle, and AI conversations now know the scenario background.`),
      action: L('대립 긴장도', 'Rivalry Tension') });
  }
}

function onLine(m: SllmMessage): void {
  if (m.kind !== 'SCN' && m.kind !== 'SCNN' && m.kind !== 'SCNSEAT') return;
  const sid = cleanSaveId(String(m.kv.sid ?? '').replace(/^\\+/, '').replace(/,/g, '').replace(/\.0+$/, ''));
  if (!sid || sid === '0') return; // 본편 세이브 번호를 모르는 줄(시작 첫날 등) — 사흘 뒤 알림 줄을 기다린다
  const b = books(), r = applyScn(b[sid] ?? null, m.kind, m.kv as Record<string, string>); if (!r) return;
  b[sid] = r.s; save();
  if (r.e.kind === 'truce' && ctx.curSaveId === sid) {
    const [ko, en] = truceLine(r.s, r.e.opt || 2);
    for (const x of ['a', 'b'] as Side[]) { if (x === r.s.seat) continue; const i = idxOf(r.s, x); if (i) chronPut(i, r.s.date || ctx.gameDate, L(ko, en), true, { name: r.s.names[x] }); }
  }
  if (r.e.kind === 'year' || r.e.kind === 'seat' || r.e.kind === 'name') seed(sid, r.s);
}

/** AI 시스템 프롬프트에 붙일 시나리오 배경(서재 세계관과 나란히). 번역·채점 같은 일에는 붙이지 않는다. */
const NO_SCN = new Set(['press-topics', 'policy-recommend', 'fleet-verdict', 'press-verdict', 'press-gov-verdict', 'espionage-evidence', 'vassal-decision', 'translate', 'unspecified']);
export function scenarioForPrompt(purpose: string | undefined): string {
  try { if (!purpose || NO_SCN.has(purpose)) return ''; return scenarioPrompt(scenarioNow(), tensionPrompt()); } catch { return ''; }
}

function view() {
  const s = scenarioNow(); if (!s) return { ok: true, on: false };
  const t = SCN_TITLE[s.id] || ['시나리오', 'Scenario'];
  return { ok: true, on: true, id: s.id, title: t, seat: s.seat, seatRole: s.seat && s.seat !== 'x' ? SIDE_ROLE[s.seat] : null, names: s.names, lvl: s.lvl, lvlName: LVL_NAME[s.lvl] || LVL_NAME[0],
    truce: s.truce.slice(-10).map((x) => ({ d: x.d, line: truceLine(s, x.opt) })), seeded: !!s.seeded.world };
}

// ---- 빨리 알아보기(2026-11-08 사용자: 「창작마당에 그 모드가 켜져 있으면 거기서부터 자동 인식」) ----
// 런처가 켠 모드 목록(dlc_load.json)에 시나리오 모드가 있고, 지금 세이브를 아직 모르면 게임에 한 번 묻는다(콘솔 `effect sllm_cr_hello = yes`).
// 모드 쪽 sllm_cr_hello 는 시나리오 판(전역 깃발 sllm_scn_corridor)일 때만 보고 줄을 찍으므로, 모드만 켜고 다른 은하로 시작한 판은 그대로 「시나리오 아님」.
// 매달 보내지 않는다: 세이브(sid)마다 많아야 3번(1분 간격), 답이 오면 끝.
const stellarisDir = (): string => { let d = ''; try { d = app.getPath('documents'); } catch { /* 검사 */ } return path.join(d || path.join(os.homedir(), 'Documents'), 'Paradox Interactive', 'Stellaris'); };
const SCN_MOD = /sllm_scenario_corridor|Corridor Triangle|회랑의 삼파전/i;
let modSeen = { at: 0, on: false };
/** 런처에서 회랑 시나리오 모드가 켜져 있나(로컬 모드든 창작마당 모드든). 30초마다 한 번만 다시 읽는다. */
export function scenarioModOn(): boolean {
  const now = Date.now(); if (now - modSeen.at < 30000) return modSeen.on;
  let on = false;
  try {
    const dir = stellarisDir(), j = JSON.parse(fs.readFileSync(path.join(dir, 'dlc_load.json'), 'utf8')) as { enabled_mods?: unknown };
    for (const m of Array.isArray(j.enabled_mods) ? j.enabled_mods : []) {
      if (typeof m !== 'string') continue;
      if (SCN_MOD.test(m)) { on = true; break; }
      let t = ''; try { t = fs.readFileSync(path.join(dir, m), 'utf8'); } catch { continue; }
      const name = /^\s*name\s*=\s*"([^"]*)"/m.exec(t)?.[1] ?? '', pth = /^\s*(?:path|archive)\s*=\s*"([^"]*)"/m.exec(t)?.[1] ?? '';
      if (SCN_MOD.test(name) || SCN_MOD.test(pth) || (pth && fs.existsSync(path.join(pth, 'events', 'sllm_cr_events.txt')))) { on = true; break; }
    }
  } catch { /* 런처 파일이 없으면 꺼진 것으로 */ }
  modSeen = { at: now, on }; return on;
}
const asked = new Map<string, { n: number; at: number }>();
function hello(): void {
  const sid = ctx.curSaveId; if (!sid || books()[sid] || !ctx.gameRunning || !link.sessionReady) return;
  const a = asked.get(sid) ?? { n: 0, at: 0 }, now = Date.now(); if (a.n >= 3 || now - a.at < 60000) return;
  if (!scenarioModOn()) return;
  asked.set(sid, { n: a.n + 1, at: now });
  void enqueue(() => sendConsole('effect sllm_cr_hello = yes')).catch((e) => logDiagnostic('warn', 'scenario.hello_failed', { error: (e as Error).message }));
}

export function registerScenario(router: LogRouter): void {
  router.on(SLOT.SCENARIO, 'scenario', onLine);
  setInterval(() => { try { hello(); } catch { /* 다음에 */ } }, 5000); // 세이브를 불러오거나 나라를 바꿔 번호가 새로 생기면 몇 초 안에
  // 번호를 늦게 안 나라·세이브를 나중에 불러온 경우: 30초마다 넣지 못한 역사를 다시 시도
  setInterval(() => { try { const sid = ctx.curSaveId, s = sid ? books()[sid] : null; if (sid && s && (!s.seeded.world || (['a', 'b', 'p'] as Side[]).some((x) => x !== s.seat && !s.seeded[x]))) seed(sid, s); } catch { /* 다음에 */ } }, 30000);
  ipcMain.handle('scnState', () => view());
}
// 순수 함수 검사용
export const scnTest = { onLine, books: () => books(), reset: () => { all = {}; }, hello, modOn: scenarioModOn, asked };
