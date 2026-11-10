// 정치적 지위 장부(16·17, 2026-10-23 집 PC 초안). 규칙: src/standing.ts(주민 지지도·정치적 지위, 같은 성과 묶음은 수치마다 한 번).
// 지금 들어오는 사건: 시위 총독 입장(사용자 확정) — 시민 편 = 그 행성 민심 +10·통치자 신뢰 −5 / 강경 = 민심 −5·신뢰 +5 / 중재 = 없음.
// 신뢰는 집무실 인물 카드에 보이는 그 신뢰(persona-app, −100~100)에 더한다 — 따로 두 번째 신뢰 수치를 만들지 않는다.
// 다른 사건(청원 해결·약속 이행 등)은 각 기능이 recordStanding 을 부르면 같은 장부에 쌓인다. 앱 기록이며 게임 수치를 바꾸지 않는다.
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ctx } from '../app/ctx';
import { logDiagnostic } from '../diagnostics';
import { L } from '../i18n-pick';
import { type StandingLedger, type StandingEvent, type StandingChange, emptyStanding, applyStandingEvent, REASON_TEXT, PROTEST_DELTA, STANDING_RULES_VERSION } from '../standing';
import type { Pid } from '../relations';

const dir = () => path.join(app.getPath('userData'), 'politics');
const fileOf = (sid: string) => path.join(dir(), createHash('sha256').update(sid).digest('hex').slice(0, 32) + '.json');
const books = new Map<string, StandingLedger>();
/** 저장 정리: 숫자가 아닌 값·망가진 변화 기록은 버린다. 변화 기록은 최근 400개. */
export function sanitizeStanding(x: unknown, sid: string): StandingLedger {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<StandingLedger>, led = emptyStanding(sid);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : undefined);
  for (const [k, v] of Object.entries(o.support ?? {})) { const n = num(v); if (n !== undefined) led.support[k] = n; }
  for (const [k, v] of Object.entries(o.standing ?? {})) { const n = num(v); if (n !== undefined) led.standing[k] = n; }
  led.changes = (Array.isArray(o.changes) ? o.changes : []).filter((c): c is StandingChange => !!c && typeof c === 'object' && typeof (c as StandingChange).pid === 'string' && typeof (c as StandingChange).causeGroup === 'string' && Object.hasOwn(REASON_TEXT, (c as StandingChange).reason) && ((c as StandingChange).metric === 'support' || (c as StandingChange).metric === 'standing')).slice(-400);
  return led;
}
export function standingOf(sid: string): StandingLedger {
  let b = books.get(sid); if (b) return b;
  try { b = sanitizeStanding(JSON.parse(fs.readFileSync(fileOf(sid), 'utf8')), sid); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') logDiagnostic('warn', 'storage.read_failed', { store: 'politics', error: e }); b = emptyStanding(sid); }
  books.set(sid, b); return b;
}
function save(sid: string): void {
  const b = books.get(sid); if (!b) return;
  if (b.changes.length > 400) b.changes = b.changes.slice(-400);
  try { fs.mkdirSync(dir(), { recursive: true }); const f = fileOf(sid), tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(b), 'utf8'); fs.renameSync(tmp, f); } catch (e) { logDiagnostic('error', 'storage.write_failed', { store: 'politics', error: e }); }
}

/** 인물 신뢰(persona-app). main.ts 가 꽂는다(가져오기 고리를 만들지 않으려고). */
export interface PoliticsPersona { note(sid: string, key: string, text: string, delta?: number): void }
let persona: PoliticsPersona | null = null;
export function setPoliticsPersona(p: PoliticsPersona): void { persona = p; }

/** 사건 하나를 장부에 넣는다. 돌려주는 값은 새로 적용된 변화(같은 묶음이면 빈 배열). */
export function recordStanding(sid: string, ev: StandingEvent): StandingChange[] {
  if (!sid) return [];
  const out = applyStandingEvent(standingOf(sid), ev);
  if (out.length) { save(sid); logDiagnostic('info', 'politics.standing', { kind: ev.kind, changes: out.map((c) => `${c.metric}${c.delta > 0 ? '+' : ''}${c.delta}`) }); }
  return out;
}
/** 시위 총독 입장 → 지역 민심(장부) + 통치자 신뢰(인물 카드). 시위마다 한 번: 장부가 새 변화를 받아들일 때만 신뢰도 움직인다. */
export function recordProtestStance(sid: string, a: { protestId: string; governor: Pid; stance: 'advocate' | 'hardline'; planet: string; date: string }): { changes: StandingChange[]; trustDelta: number } {
  const kind = a.stance === 'advocate' ? 'protest_advocate' as const : 'protest_hardline' as const;
  const changes = recordStanding(sid, { id: `protest-stance:${a.protestId}`, kind, pid: a.governor, planet: a.planet, date: a.date, causeGroup: `protest:${a.protestId}` });
  if (!changes.length) return { changes, trustDelta: 0 };
  const trustDelta = a.stance === 'advocate' ? -PROTEST_DELTA.trust : +PROTEST_DELTA.trust;
  persona?.note(sid, a.governor, a.stance === 'advocate' ? L(`「${a.planet}」 시위에서 시민 편에 섰다`, `Sided with the protesters on "${a.planet}"`) : L(`「${a.planet}」 시위에 강경 대응을 주장했다`, `Called for a crackdown on the protesters on "${a.planet}"`), trustDelta);
  return { changes, trustDelta };
}

/** 집무실 인물 카드용: 지위·행성별 민심·최근 변화. 기록이 없으면 has=false(화면은 「미확인」). */
export function standingInfo(sid: string, key: string, planet?: string) {
  const led = standingOf(sid), mine = led.changes.filter((c) => c.pid === key);
  const planets = [...new Set([...(planet ? [planet] : []), ...Object.keys(led.support).filter((k) => k.startsWith(key + '|')).map((k) => k.slice(key.length + 1))])];
  return {
    has: mine.length > 0 || led.standing[key] !== undefined,
    standing: led.standing[key] ?? null,
    support: planets.map((p) => ({ planet: p, value: led.support[`${key}|${p}`] ?? null })),
    recent: mine.slice(-5).reverse().map((c) => ({ date: c.date, text: L(REASON_TEXT[c.reason].ko, REASON_TEXT[c.reason].en), metric: c.metric, planet: c.planet ?? '', delta: c.delta })),
    rules: STANDING_RULES_VERSION,
  };
}

export function registerPolitics(): void {
  ipcMain.handle('standingInfo', (_e, key: unknown, planet: unknown) => {
    const sid = ctx.curSaveId; if (!sid || typeof key !== 'string' || !key.startsWith('p:')) return null;
    return standingInfo(sid, key.slice(0, 40), typeof planet === 'string' ? planet.slice(0, 120) : undefined);
  });
}
