// 규탄 성명(2026-10-20 알파 10): 우리가 전쟁을 열면(또는 열렸으면) 다른 제국·은하 공동체가 입장을 낸다. 순수 규칙: 기본 입장 계산·AI 문장 요청·저장 모양.
// 창·IPC·호감 적용은 features/condemn-app.ts. 입장은 규칙이 정하고 AI 는 그 입장에 맞는 문장만 쓴다(결과가 들쭉날쭉하지 않게, 테스트 가능하게).
import type { ChatMessage } from './player2';
import type { WarInfo } from './warinfo';
import { warAggression, describeWar, GOAL_INFO } from './warinfo';
import { cleanTitle } from './music';

export type Stance = 'condemn' | 'concern' | 'silent' | 'support';
export const STANCE_KO: Record<Stance, string> = { condemn: '규탄', concern: '우려 표명', silent: '침묵', support: '지지' };
export const STANCE_EN: Record<Stance, string> = { condemn: 'Condemnation', concern: 'Expression of concern', silent: 'Silence', support: 'Support' };
/** 입장을 낼 제국 한 명분의 재료(앱이 모은다). ethics 는 게임 키(ethic_militarist 등)나 이름(militarist). */
export interface Voice { idx: number; name: string; opinion: number; ethics: string[]; flags: { ally?: boolean; rival?: boolean; war?: boolean; fed?: boolean; subject?: boolean; overlord?: boolean; enemyAlly?: boolean; enemyFed?: boolean; enemySubject?: boolean; enemyRival?: boolean; galcom?: boolean; /** 이 제국의 전쟁에 우리가 예전에 낸 성명(되갚음) */ weCondemned?: boolean; weSupported?: boolean } }
export interface Reaction { idx: number; name: string; stance: Stance; score: number; text: string }
export interface Verdict { war: string; date: string; side: 'att' | 'def'; aggression: 0 | 1 | 2 | 3; galcom: { stance: Stance; score: number; text: string } | null; reactions: Reaction[]; counts: Record<Stance, number> }
const has = (ethics: string[], k: string) => ethics.some((e) => e.toLowerCase().replace(/^ethic_/, '').replace(/^fanatic_/, '') === k);
const fanatic = (ethics: string[], k: string) => ethics.some((e) => /fanatic_/i.test(e) && e.toLowerCase().replace(/^ethic_/, '').replace(/^fanatic_/, '') === k);
/** 한 제국의 점수: 양수 = 지지 쪽, 음수 = 규탄 쪽. 우리가 공격 측일 때 기준(방어 측이면 부호를 뒤집고 침략성은 상대 것). */
export function voiceScore(v: Voice, w: WarInfo, ourSideIsAttacker: boolean): number {
  const ag = warAggression(w), e = v.ethics; let s = 0;
  // 관계가 가장 크다
  if (v.flags.subject) s += 40; if (v.flags.overlord) s += 25; if (v.flags.fed) s += 35; if (v.flags.ally) s += 25;
  if (v.flags.enemySubject) s -= 40; if (v.flags.enemyFed) s -= 35; if (v.flags.enemyAlly) s -= 25;
  if (v.flags.rival) s -= 20; if (v.flags.enemyRival) s += 15; if (v.flags.war) s -= 30;
  if (v.flags.weCondemned) s -= 12; if (v.flags.weSupported) s += 12; // 되갚음: 예전에 우리가 낸 성명을 기억한다
  // 호감(-1000..1000 → -20..20)
  s += Math.max(-20, Math.min(20, v.opinion / 50));
  // 가치관 × 명분
  const inv = ourSideIsAttacker ? 1 : -1; // 방어 측이면 침략자는 상대 → 침략성이 높을수록 우리 지지
  const agg = ag * (ourSideIsAttacker ? -1 : 1) * 8; // 공격자 기준: 정복 -16, 정화 -24; 방어자 기준: +
  s += agg;
  if (GOAL_INFO[w.attGoal]?.kind === 'purge') s += ourSideIsAttacker ? -12 : 12; // 잔혹 행위(정화·동화·흡수·콜로서스)는 동맹도 감싸기 어렵다
  if (has(e, 'pacifist')) s += (ourSideIsAttacker ? -1 : 0.5) * (fanatic(e, 'pacifist') ? 22 : 14);
  if (has(e, 'militarist')) s += ourSideIsAttacker ? (fanatic(e, 'militarist') ? 8 : 5) : 0;
  if (has(e, 'egalitarian') && w.attGoal === 'wg_independence') s += 18 * (w.side === 'att' ? 1 : -1) * inv; // 독립 전쟁: 평등주의는 독립 쪽
  if (has(e, 'authoritarian') && (w.rel === 1 || w.rel === 2)) s += 18 * (w.rel === 1 ? 1 : -1) * (w.side === 'att' ? 1 : -1); // 권위주의는 종주국 쪽
  if (has(e, 'egalitarian') && w.attGoal === 'wg_force_ideology' && ourSideIsAttacker) s += 10; // 해방전은 평등주의가 호의적
  if (has(e, 'xenophobe')) s *= 0.4; // 외계인 혐오: 남의 일에 덜 관여(점수 줄여 침묵 쪽으로)
  if (has(e, 'spiritualist') && ['wg_cleansing', 'wg_colossus', 'wg_blaze'].includes(w.attGoal)) s += ourSideIsAttacker ? -12 : 12;
  if (has(e, 'xenophile') && ag >= 3) s += ourSideIsAttacker ? -12 : 12;
  return Math.round(s);
}
export function stanceOf(score: number): Stance { return score <= -22 ? 'condemn' : score <= -8 ? 'concern' : score >= 18 ? 'support' : 'silent'; }
/** 은하 공동체 입장: 회원국 점수 평균(비회원 제외). 회원이 3개 미만이면 없음. 우리가 회원이 아니어도 낸다. */
export function galcomStance(voices: Voice[], w: WarInfo, ourSideIsAttacker: boolean): { stance: Stance; score: number } | null {
  const m = voices.filter((v) => v.flags.galcom); if (m.length < 3) return null;
  const avg = m.reduce((a, v) => a + voiceScore(v, w, ourSideIsAttacker), 0) / m.length;
  return { stance: stanceOf(avg - (ourSideIsAttacker ? 6 : 0)), score: Math.round(avg) }; // 공동체는 침략에 조금 더 엄격
}
/** 성명을 낼 제국 고르기: 점수 절댓값이 큰 순으로 최대 max 개(침묵은 뺀다). 나머지는 숫자로만 집계. */
export function pickSpeakers(voices: Voice[], w: WarInfo, ourSideIsAttacker: boolean, max = 4): Array<{ v: Voice; score: number; stance: Stance }> {
  return voices.map((v) => { const score = voiceScore(v, w, ourSideIsAttacker); return { v, score, stance: stanceOf(score) }; })
    .filter((x) => x.stance !== 'silent').sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, max);
}
export function countStances(voices: Voice[], w: WarInfo, ourSideIsAttacker: boolean): Record<Stance, number> {
  const c: Record<Stance, number> = { condemn: 0, concern: 0, silent: 0, support: 0 };
  for (const v of voices) c[stanceOf(voiceScore(v, w, ourSideIsAttacker))]++;
  return c;
}
/** AI 요청: 여러 제국의 성명을 한 번에(JSON 배열). 각 제국은 정해진 입장에 맞는 1~2문장만. */
export function reactionMessages(player: string, w: WarInfo, speakers: Array<{ name: string; stance: Stance; ethics: string[]; memory?: string; geo?: string }>, galcom: Stance | null, declaration: string): ChatMessage[] { // geo: 그 나라와 플레이어의 국경·영유권 사이(2026-10-26, frontier.ts frontierBrief)
  const sys = 'You write short diplomatic statements issued by space empires in the game Stellaris in reaction to a war. '
    + 'Each statement is 1-2 sentences in the voice of that empire\'s government, matching the STANCE given for it exactly (condemn = sharp denunciation; concern = measured worry, calls for restraint; support = approval or solidarity). '
    + 'If an empire "remembers" something the player did, it may throw it back at the player in its statement. Refer to the actual cause of the war. ORIGINAL text only, never quote real-world statements. Output ONLY JSON: {"galcom":"statement or empty string","items":[{"name":"empire name","text":"statement"}]}.';
  const lines = [`Player empire: ${player.slice(0, 80)}`, `War: ${w.war.slice(0, 120)} — attacker ${w.attacker.slice(0, 80)}, defender ${w.defender.slice(0, 80)}; the player is the ${w.side === 'att' ? 'attacker' : 'defender'}.`, 'Cause: ' + describeWar(w, 'en').slice(0, 400)];
  if (declaration) lines.push('Excerpt of the player\'s declaration: "' + declaration.replace(/\s+/g, ' ').slice(0, 300) + '"');
  if (galcom) lines.push(`Galactic Community statement — STANCE: ${galcom}`);
  for (const s of speakers) lines.push(`${s.name.slice(0, 80)} — STANCE: ${s.stance}${s.ethics.length ? ' — ethics: ' + s.ethics.slice(0, 4).join(', ') : ''}${s.memory ? ' — remembers: ' + s.memory.slice(0, 200) : ''}${s.geo ? ' — relation to the player: ' + s.geo.slice(0, 200) : ''}`);
  return [{ role: 'system', content: sys }, { role: 'user', content: lines.join('\n') }];
}
export function parseReactions(raw: unknown): { galcom: string; items: Array<{ name: string; text: string }> } | null {
  const s = typeof raw === 'string' ? raw : ''; const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(s.slice(a, b + 1)) as Record<string, unknown>;
    const items = Array.isArray(j.items) ? (j.items as unknown[]).map((x) => { const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>; return { name: cleanTitle(o.name), text: typeof o.text === 'string' ? o.text.replace(/\s+/g, ' ').trim().slice(0, 400) : '' }; }).filter((x) => x.name && x.text) : [];
    return { galcom: typeof j.galcom === 'string' ? j.galcom.replace(/\s+/g, ' ').trim().slice(0, 400) : '', items };
  } catch { return null; }
}
/** 호감 적용 단계(모드 sllm_probe_opinion_shift STEP: 1 warm small · 2 warm large · 3 cold small · 4 cold large). 침묵·우려는 적용 없음. */
export function stanceStep(st: Stance): 0 | 1 | 2 | 3 | 4 { return st === 'condemn' ? 3 : st === 'support' ? 1 : 0; }
export interface CondemnStore { /** 규탄·지지를 게임 호감도에 작게 반영(기본 켬) */ applyOpinion: boolean; /** 남의 전쟁 알림(기본 켬) */ foreignNotify: boolean; saves: Record<string, Verdict[]>; /** 남의 전쟁에 우리가 낸 성명(세이브별, 최근 40개) */ ours: Record<string, OurStatement[]> }
export interface OurStatement { war: string; date: string; attacker: string; defender: string; ai: number; di: number; goal: string; stance: Stance; text: string }
export function sanitizeCondemn(v: unknown): CondemnStore {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, saves: CondemnStore['saves'] = {};
  const st = (x: unknown): Stance => (x === 'condemn' || x === 'concern' || x === 'support' ? x : 'silent');
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) for (const [sid, list] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
    if (!Array.isArray(list)) continue; const out: Verdict[] = [];
    for (const d of list.slice(-30)) {
      if (!d || typeof d !== 'object') continue; const x = d as Record<string, unknown>; if (typeof x.war !== 'string' || !x.war) continue;
      const g = x.galcom && typeof x.galcom === 'object' ? x.galcom as Record<string, unknown> : null;
      const ag = Number(x.aggression);
      out.push({ war: x.war.slice(0, 120), date: typeof x.date === 'string' ? x.date.slice(0, 20) : '', side: x.side === 'def' ? 'def' : 'att', aggression: (ag >= 0 && ag <= 3 ? Math.round(ag) : 1) as 0 | 1 | 2 | 3,
        galcom: g ? { stance: st(g.stance), score: Number(g.score) || 0, text: typeof g.text === 'string' ? g.text.slice(0, 400) : '' } : null,
        reactions: Array.isArray(x.reactions) ? (x.reactions as unknown[]).slice(0, 8).map((r) => { const q = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>; return { idx: Number(q.idx) || 0, name: typeof q.name === 'string' ? q.name.slice(0, 80) : '', stance: st(q.stance), score: Number(q.score) || 0, text: typeof q.text === 'string' ? q.text.slice(0, 400) : '' }; }).filter((r) => r.name) : [],
        counts: { condemn: Number((x.counts as Record<string, unknown>)?.condemn) || 0, concern: Number((x.counts as Record<string, unknown>)?.concern) || 0, silent: Number((x.counts as Record<string, unknown>)?.silent) || 0, support: Number((x.counts as Record<string, unknown>)?.support) || 0 } });
    }
    if (out.length) saves[sid.slice(0, 60)] = out;
  }
  const ours: CondemnStore['ours'] = {};
  if (o.ours && typeof o.ours === 'object' && !Array.isArray(o.ours)) for (const [sid, list] of Object.entries(o.ours as Record<string, unknown>).slice(0, 500)) {
    if (!Array.isArray(list)) continue;
    const out = list.slice(-40).map((d) => {
      const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      const t = (k: string, n: number) => (typeof x[k] === 'string' ? (x[k] as string).slice(0, n) : '');
      const n = (k: string) => (Number.isSafeInteger(Number(x[k])) && Number(x[k]) > 0 ? Number(x[k]) : 0);
      return { war: t('war', 120), date: t('date', 20), attacker: t('attacker', 80), defender: t('defender', 80), ai: n('ai'), di: n('di'), goal: t('goal', 60), stance: st(x.stance), text: t('text', 600) };
    }).filter((x) => x.war && x.stance !== 'silent');
    if (out.length) ours[sid.slice(0, 60)] = out;
  }
  return { applyOpinion: typeof o.applyOpinion === 'boolean' ? o.applyOpinion : true, foreignNotify: typeof o.foreignNotify === 'boolean' ? o.foreignNotify : true, saves, ours };
}
/** 알림 한 줄: "규탄 3 · 우려 2 · 지지 1 (침묵 9)". */
/** 모드 WARVOICE 한 줄 → Voice(가치관·호감은 앱이 따로 채운다). */
export function voiceFromKv(kv: Record<string, string | undefined>, attackerIsUs: boolean): Omit<Voice, 'ethics' | 'opinion'> | null {
  const idx = Number(kv.idx); if (!Number.isSafeInteger(idx) || idx <= 0 || !kv.name) return null;
  const b = (k: string) => kv[k] === '1';
  const us = attackerIsUs ? { fed: b('fa'), subject: b('sa'), rival: b('ra'), ally: b('da') } : { fed: b('fd'), subject: b('sd'), rival: b('rd'), ally: b('dd') };
  const them = attackerIsUs ? { fed: b('fd'), subject: b('sd'), rival: b('rd'), ally: b('dd') } : { fed: b('fa'), subject: b('sa'), rival: b('ra'), ally: b('da') };
  return { idx, name: String(kv.name).slice(0, 80), flags: { galcom: b('gc'), fed: us.fed, subject: us.subject, rival: us.rival, ally: us.ally, enemyFed: them.fed, enemySubject: them.subject, enemyRival: them.rival, enemyAlly: them.ally, war: b('w') } };
}
export function countsLine(c: Record<Stance, number>, ko: boolean): string {
  const k = ko ? STANCE_KO : STANCE_EN; const parts = (['condemn', 'concern', 'support'] as Stance[]).filter((s) => c[s]).map((s) => `${k[s]} ${c[s]}`);
  return (parts.length ? parts.join(' · ') : (ko ? '성명 없음' : 'No statements')) + (c.silent ? ` (${k.silent} ${c.silent})` : '');
}

// ── 남의 전쟁(방향 2, 2026-10-20): 우리가 참전하지 않은 전쟁에 우리 정부가 성명을 낸다 ─────────────────────────
export interface ForeignWar extends WarInfo { ai: number; di: number; /** 플레이어와 공격국·방어국의 관계 */ rel2: { fedA: boolean; fedD: boolean; subA: boolean; subD: boolean; rivA: boolean; rivD: boolean; pactA: boolean; pactD: boolean } }
export function parseForeignWar(kv: Record<string, string | undefined>, parse: (kv: Record<string, string | undefined>) => WarInfo | null): ForeignWar | null {
  const w = parse({ ...kv, side: 'att' }); if (!w) return null;
  const n = (k: string) => { const v = Number(kv[k]); return Number.isSafeInteger(v) && v > 0 ? v : 0; }, b = (k: string) => kv[k] === '1';
  return { ...w, ai: n('ai'), di: n('di'), rel2: { fedA: b('pfa'), fedD: b('pfd'), subA: b('psa'), subD: b('psd'), rivA: b('pra'), rivD: b('prd'), pactA: b('pda'), pactD: b('pdd') } };
}
/** 자문관 권고: 우리 가치관·관계로 본 공격국에 대한 자연스러운 입장(voiceScore 를 우리 시점으로). */
export function advisorStance(f: ForeignWar, ourEthics: string[], opinionOfAttacker = 0): { stance: Stance; score: number } {
  const v: Voice = { idx: 0, name: '', opinion: opinionOfAttacker, ethics: ourEthics, flags: { fed: f.rel2.fedA, subject: f.rel2.subA, rival: f.rel2.rivA, ally: f.rel2.pactA, enemyFed: f.rel2.fedD, enemySubject: f.rel2.subD, enemyRival: f.rel2.rivD, enemyAlly: f.rel2.pactD } };
  const score = voiceScore(v, f, true); return { stance: stanceOf(score), score };
}
/** 알림을 띄울 만한 전쟁인가: 침략성 2 이상이거나 우리와 관계가 있는 나라가 낀 전쟁. 나머지는 조용히 연대기에만. */
export function foreignWorthNotice(f: ForeignWar): boolean {
  const r = f.rel2; return warAggression(f) >= 2 || r.fedA || r.fedD || r.subA || r.subD || r.rivA || r.rivD || r.pactA || r.pactD;
}
/** 우리 성명이 두 나라에 주는 호감 단계 [공격국, 방어국]: 규탄 → 공격국 cold small(3)·방어국 warm small(1), 지지 → 반대, 우려·침묵 → 없음. */
export function ourStatementSteps(st: Stance): [0 | 1 | 3, 0 | 1 | 3] { return st === 'condemn' ? [3, 1] : st === 'support' ? [1, 3] : [0, 0]; }
/** 되갚음: 이 제국(idx)이 연 전쟁에 우리가 냈던 성명 중 가장 최근 것. */
export function ourPastStanceOn(list: OurStatement[] | undefined, idx: number): OurStatement | null {
  for (const s of (list ?? []).slice().reverse()) if (s.ai === idx) return s;
  return null;
}
