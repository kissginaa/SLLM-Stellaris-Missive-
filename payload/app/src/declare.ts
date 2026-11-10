// 전쟁 선언문(2026-10-20 알파 10): 전쟁이 시작되면 통치자가 선언문을 쓰고(또는 AI 초안), 원하면 AI 음성으로 낭독해 긴급 방송처럼 내보낸다.
// 순수 규칙만: 저장 모양·AI 요청·답 읽기·전쟁 편 가리기. 창·IPC 는 features/declare-app.ts, 화면은 ui/declare.html.
import type { ChatMessage } from './player2';
import type { StateWar } from './gamestate';
import { cleanLyrics, cleanTitle } from './music';

export type WarSide = 'att' | 'def' | '';
export interface Declaration { date: string; war: string; enemy: string; side: WarSide; /** 공격 측 전쟁 목표 키(모드 WARINFO). 모르면 빈 글 */ goal: string; title: string; text: string; /** 줄별 낭독 mp3(앱 데이터 안). 낭독하지 않았으면 빈 배열 */ audio: string[]; createdAt: number }
export interface DeclStore { saves: Record<string, Declaration[]> }
export const DECL_MAX_LINES = 24, DECL_MAX_CHARS = 2400, DECL_KEEP = 40;
const sideOk = (v: unknown): v is WarSide => v === 'att' || v === 'def' || v === '';
const str = (v: unknown, n: number): string => (typeof v === 'string' ? v.slice(0, n) : '');
export function sanitizeDecl(v: unknown): DeclStore {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, saves: DeclStore['saves'] = {};
  if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) {
    for (const [sid, list] of Object.entries(o.saves as Record<string, unknown>).slice(0, 500)) {
      if (!Array.isArray(list)) continue; const out: Declaration[] = [];
      for (const d of list.slice(-DECL_KEEP)) {
        if (!d || typeof d !== 'object') continue; const x = d as Record<string, unknown>;
        const text = cleanDeclText(x.text); if (!text) continue;
        out.push({ date: str(x.date, 20), war: str(x.war, 120), enemy: str(x.enemy, 120), side: sideOk(x.side) ? x.side : '', goal: str(x.goal, 60), title: cleanTitle(x.title), text, audio: Array.isArray(x.audio) ? x.audio.filter((a): a is string => typeof a === 'string' && a.length < 600).slice(0, DECL_MAX_LINES) : [], createdAt: typeof x.createdAt === 'number' && Number.isFinite(x.createdAt) ? x.createdAt : 0 });
      }
      if (out.length) saves[sid.slice(0, 60)] = out;
    }
  }
  return { saves };
}
/** 선언문 본문 정리: 줄 단위, 24줄·2400자. */
export function cleanDeclText(v: unknown): string {
  return cleanLyrics(v).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, DECL_MAX_LINES).join('\n').slice(0, DECL_MAX_CHARS).trim();
}
/** 이 전쟁에서 우리 편: 월간 상황의 전쟁 목록에서 이름이 같은 전쟁을 찾는다(없으면 ''). */
export function warSide(wars: StateWar[] | undefined, warName: string): { side: WarSide; enemy: string } {
  const w = (wars ?? []).find((x) => x.name === warName) ?? (wars ?? []).slice(-1)[0];
  if (!w) return { side: '', enemy: '' };
  return { side: w.side, enemy: (w.side === 'att' ? w.defender : w.attacker) ?? '' };
}
export const declTitle = (side: WarSide, ko: boolean): string => (side === 'def' ? (ko ? '항전 선언문' : 'Declaration of Resistance') : side === 'att' ? (ko ? '전쟁 선언문' : 'Declaration of War') : (ko ? '전쟁 선언문' : 'War declaration'));
/** AI 초안 요청: 통치자가 국민과 군에게 읽는 선언문. 실제 역사 연설을 베끼지 않게 한다. */
export function declMessages(empire: string, war: string, enemy: string, side: WarSide, ethics: string[], gestalt: boolean, date: string, warInfo = '', front: string[] = []): ChatMessage[] { // front: 적과의 국경·영유권·점령(2026-10-26, frontier.ts frontierFactsUs)
  const sys = 'You write the address a head of state delivers to the nation and its armed forces at the outbreak of a war, in the game Stellaris. '
    + 'ORIGINAL text only: never copy or closely paraphrase any real-world speech. 8 to 14 short lines, one sentence per line, no numbering, no markdown, suitable to be read aloud over a broadcast. '
    + (side === 'def' ? 'We were attacked: a declaration of resistance — resolve, unity, the defense of home. ' : side === 'att' ? 'We opened the war: a declaration of war — the cause, the resolve, the call to arms. ' : '')
    + 'Ground the speech in the actual cause of the war given below (the casus belli and the relationship between the sides): a conquest speaks of claims and destiny, a liberation addresses the enemy\'s own people, a war of independence denounces the overlord, a defense speaks of home and resolve, a war against a galactic threat speaks for all. '
    + 'Reflect the empire\'s character. Output ONLY JSON: {"title":"short title","text":"line1\\nline2\\n..."}.';
  const traits = [ethics.length ? 'ethics: ' + ethics.join(', ') : '', gestalt ? 'a gestalt consciousness; speak as one collective' : ''].filter(Boolean).join('; ');
  const usr = `Empire: ${String(empire || 'the empire').slice(0, 80)}${war ? '\nWar: ' + war.slice(0, 120) : ''}${enemy ? '\nEnemy: ' + enemy.slice(0, 120) : ''}${warInfo ? '\nCause of the war: ' + warInfo.slice(0, 400) : ''}${front.length ? '\nBorders, claims and front with the enemy (facts; name only these systems): ' + front.join(' ').slice(0, 700) : ''}${traits ? '\nCharacter — ' + traits : ''}${date ? '\nGame date: ' + date : ''}\nWrite the declaration.`;
  return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
export function parseDecl(raw: unknown): { title: string; text: string } | null {
  const s = typeof raw === 'string' ? raw : ''; let title = '', text = '';
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { const j = JSON.parse(s.slice(a, b + 1)) as Record<string, unknown>; title = cleanTitle(j.title); const t = j.text ?? j.lines; text = Array.isArray(t) ? t.filter((x) => typeof x === 'string').join('\n') : typeof t === 'string' ? t : ''; } catch { /* 평문 */ } }
  if (!text && !(a >= 0 && b > a)) text = s;
  text = cleanDeclText(text.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')).join('\n'));
  return text.length >= 20 ? { title, text } : null;
}
export const DECL_VOICE_INSTRUCT = 'Deliver this as a head of state addressing the nation over an emergency broadcast: grave, steady, resolute. No pause at the end.';
