// LLM 응답(JSON)을 해석하고 검증한다. 형식이 틀리면 말로만 처리하고 행동은 버린다.
import { L } from './i18n-pick';
import { plainPunct } from './game-text';
import { redirectCost } from './marauder-deals';
export const MAX_ENERGY = 300;

export type ActionType = 'demand_rename' | 'give_energy' | 'take_energy' | 'open_borders' | 'make_peace' | 'declare_war' | 'defer' | 'crisis_pact' | 'marauder_withdraw' | 'marauder_redirect' | 'marauder_hire' | 'merc_discount'; // marauder_hire: 습격 의뢰(건의 ①, 2026-10-26). crisis_pact: 공동 대응 협약(알파 11), marauder_*·merc_discount: 약탈자 대응(2026-10-26)
// 선전포고 사유. kind 는 게임의 sllm_probe_diplo KIND 번호.
export const WAR_REASONS: Record<string, { kind: 3 | 4 | 5; ko: string; en: string }> = {
  humiliation: { kind: 3, ko: '굴욕감 주기', en: 'humiliation' },
  tribute: { kind: 4, ko: '공물 요구', en: 'demand tribute' },
  revenge: { kind: 5, ko: '복수', en: 'revenge' },
};
export interface Action { type: ActionType; amount?: number; reason?: string; topic?: string; target?: number; pct?: number; what?: 'cap' | 'sys'; name?: string } // what·name: 개명 요구(2026-11-04)
export interface Parsed { say: string; action: Action | null; mood: number; note?: string }

// mood: 0 변화 없음, 1 조금 오름, 2 많이 오름, 3 조금 내림, 4 많이 내림(게임의 STEP 번호와 같다)
const MOODS: Record<string, number> = { none: 0, warmer_small: 1, warmer_large: 2, colder_small: 3, colder_large: 4 };
export function moodText(step: number): string {
  return [['', ''], ['조금 올랐습니다', 'rose a little'], ['많이 올랐습니다', 'rose a lot'], ['조금 내렸습니다', 'fell a little'], ['많이 내렸습니다', 'fell a lot']].map(([k, e]) => L(k, e))[step] ?? '';
}

// 호감 변화 단계(1~4)가 주는 수치. 게임의 수정자 값(+5/+15/-5/-15)과 같다.
export function moodDelta(step: number): number {
  return ({ 1: 5, 2: 15, 3: -5, 4: -15 } as Record<number, number>)[step] ?? 0;
}
// 대화 중 쌓인 변화를 합산해 필요한 단계만 남긴다(서로 상쇄되면 빈 배열).
export function netSteps(steps: number[]): number[] {
  let d = steps.reduce((a, s) => a + moodDelta(s), 0);
  const out: number[] = [];
  const sign = d < 0 ? -1 : 1;
  d = Math.abs(d);
  while (d >= 15) { out.push(sign > 0 ? 2 : 4); d -= 15; }
  while (d >= 5) { out.push(sign > 0 ? 1 : 3); d -= 5; }
  return out;
}

export function extractJson(text: string): any | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* 앞뒤에 말이 붙은 경우를 위해 첫 {…} 를 찾는다 */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* 아래에서 처리 */ }
  }
  return null;
}

export function parseReply(raw: string): Parsed {
  const j = extractJson(raw);
  if (!j || typeof j !== 'object' || typeof j.say !== 'string') {
    return { say: raw.trim(), action: null, mood: 0, note: L('JSON 형식이 아니어서 말만 표시했습니다.', 'The reply was not JSON, so only the words were shown.') };
  }
  const say = j.say.trim();
  const mood = typeof j.mood === 'string' && j.mood in MOODS ? MOODS[j.mood] : 0;
  const a = j.action;
  if (!a || a.type === 'none' || a.type === undefined) return { say, action: null, mood };
  switch (a.type) {
    case 'give_energy':
    case 'take_energy': {
      const amt = Number(a.amount);
      if (!Number.isInteger(amt) || amt < 1) return { say, action: null, mood, note: L('금액이 올바르지 않아 행동을 무시했습니다.', 'The amount was invalid, so the action was ignored.') };
      if (amt > MAX_ENERGY) return { say, action: { type: a.type, amount: MAX_ENERGY }, mood, note: L(`금액을 상한 ${MAX_ENERGY}으로 줄였습니다.`, `Reduced the amount to the cap of ${MAX_ENERGY}.`) };
      return { say, action: { type: a.type, amount: amt }, mood };
    }
    case 'open_borders':
    case 'make_peace':
    case 'crisis_pact':
    case 'marauder_withdraw':
      return { say, action: { type: a.type }, mood };
    case 'marauder_redirect': // 약탈자 습격 돌리기(2026-10-26): 대상 번호 + 가격 조정 -15~15%
    case 'marauder_hire': { // 습격 의뢰(건의 ①): 돌리기와 같은 모양
      const target = Number(a.target), pct = Math.max(-15, Math.min(15, Math.round(Number(a.price_pct ?? a.pct) || 0)));
      if (!Number.isSafeInteger(target) || target < 1) return { say, action: null, mood, note: L('습격 대상이 올바르지 않아 행동을 무시했습니다.', 'The raid target was invalid, so the action was ignored.') };
      return { say, action: { type: a.type, target, pct }, mood };
    }
    case 'merc_discount': { // 용병 흥정(2026-10-26): 할인만 1~15%
      const pct = Math.round(Number(a.percent ?? a.pct));
      if (!Number.isFinite(pct) || pct < 1) return { say, action: null, mood, note: L('할인율이 올바르지 않아 행동을 무시했습니다.', 'The discount was invalid, so the action was ignored.') };
      return { say, action: { type: 'merc_discount', pct: Math.min(15, pct) }, mood, ...(pct > 15 ? { note: L('할인율을 상한 15%로 줄였습니다.', 'Reduced the discount to the 15% cap.') } : {}) };
    }
    case 'defer': {
      // 조약은 앱이 맺을 수 없다. "의원들과 논의한 뒤 서신으로 알린다"는 약속만 남긴다.
      const topic = typeof a.topic === 'string' ? a.topic.replace(/\s+/g, ' ').trim().slice(0, 30) : '';
      return { say, action: { type: 'defer', topic: topic || '조약 제안' }, mood };
    }
    case 'demand_rename': { // 패전 직전의 굴욕 조항(2026-11-04): 우리 수도 행성·성계 이름을 그들이 정한 이름으로 + 종전
      const what = a.what === 'sys' ? 'sys' : 'cap', name = typeof a.name === 'string' ? a.name.replace(/[\r\n\t]+/g, ' ').replace(/["\\§£$\[\]{}<>|/;=#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim() : '';
      if (!name) return { say, action: null, mood, note: L('새 이름이 없어 행동을 무시했습니다.', 'No new name was given, so the action was ignored.') };
      return { say, action: { type: 'demand_rename', what, name }, mood };
    }
    case 'declare_war': {
      const reason = typeof a.reason === 'string' && a.reason in WAR_REASONS ? a.reason : 'humiliation';
      return { say, action: { type: 'declare_war', reason }, mood };
    }
    default:
      return { say, action: null, mood, note: L('알 수 없는 행동이라 무시했습니다: ', 'Unknown action, ignored: ') + String(a.type) };
  }
}

// 플레이어에게 보여 줄 제안 문구. give = AI 가 플레이어에게 준다, take = 플레이어가 AI 에게 준다.
export function describe(a: Action, aiName: string): string {
  switch (a.type) {
    case 'give_energy': return L(`${aiName}이(가) 에너지 ${a.amount}을(를) 제공하겠다고 합니다.`, `${aiName} offers ${a.amount} energy.`);
    case 'take_energy': return L(`${aiName}이(가) 에너지 ${a.amount}을(를) 받기를 요청합니다(내 에너지가 줄어듭니다).`, `${aiName} asks to receive ${a.amount} energy (your energy will go down).`);
    case 'open_borders': return L(`${aiName}이(가) 국경 제한을 풀겠다고 합니다.`, `${aiName} offers to open borders.`);
    case 'make_peace': return L(`${aiName}이(가) 전쟁을 끝내자고 합니다(실험 기능).`, `${aiName} proposes to end the war (experimental).`);
    case 'demand_rename': return L(`${aiName}이(가) 종전 조건으로 우리 ${a.what === 'sys' ? '수도 성계' : '수도 행성'}의 이름을 「${a.name}」(으)로 바꾸라고 요구합니다. 수락하면 이름이 바뀌고 종전을 시도합니다(치욕의 조약 — 신문에 실림).`, `${aiName} demands, as a condition of peace, that we rename our capital ${a.what === 'sys' ? 'system' : 'world'} "${a.name}". Accepting renames it and attempts peace (a treaty of shame — it will be in the papers).`);
    case 'crisis_pact': return L(`${aiName}이(가) 은하 위기에 맞선 공동 대응 협약을 제안합니다. 위기가 끝날 때까지 서로의 호감 +30, 양쪽 함선 화력 +5%. 협약 중 전쟁이 벌어지면 배신으로 남습니다.`, `${aiName} proposes a joint crisis response pact: +30 mutual opinion and +5% ship fire rate for both until the crisis ends. War during the pact counts as betrayal.`);
    case 'marauder_withdraw': return L(`${aiName}이(가) 위협에 물러나 습격을 거두겠다고 합니다. 수락하면 습격 함대가 돌아가고 이 약탈자는 한동안 습격하지 않습니다.`, `${aiName} backs down from your threat and offers to call off the raid. Accepting sends the raiders home, and this clan will not raid for a while.`);
    case 'marauder_redirect': return L(`${aiName}이(가) 에너지 ${redirectCost(a.pct)}(우리 경쟁국이 아니면 1.5배)을(를) 받고 습격을 다른 제국(${a.target}번)으로 돌리겠다고 합니다(내 에너지가 줄어듭니다).`, `${aiName} offers to send the raid against another empire (#${a.target}) for ${redirectCost(a.pct)} energy (1.5x if not your rival) (your energy will go down).`);
    case 'marauder_hire': return L(`${aiName}이(가) 에너지 ${redirectCost(a.pct)}(우리 경쟁국이 아니면 1.5배)을(를) 받고 다른 제국(${a.target}번)을 습격하겠다고 합니다(내 에너지가 줄어듭니다).`, `${aiName} offers to raid another empire (#${a.target}) for ${redirectCost(a.pct)} energy (1.5x if not your rival) (your energy will go down).`);
    case 'merc_discount': return L(`${aiName}이(가) 용병 고용 비용을 ${a.pct}% 깎아 주겠다고 합니다. 1년 안에 이 약탈자의 용병을 게임의 「용병 고용」으로 처음 고용하면 깎은 만큼 에너지로 돌려받습니다.`, `${aiName} offers ${a.pct}% off hiring their mercenaries. If you hire one of this clan's fleets through the game's Hire Mercenaries menu within a year, the discount comes back to you as energy.`);
    case 'defer': return L(`${aiName}이(가) "${a.topic ?? '조약'}" 건을 논의한 뒤 서신으로 알리겠다고 합니다.`, `${aiName} will discuss "${a.topic ?? 'the treaty'}" and reply by letter.`);
    case 'declare_war': { const r = WAR_REASONS[a.reason ?? 'humiliation'] ?? WAR_REASONS.humiliation; return L(`${aiName}이(가) 당신에게 선전포고하려 합니다(사유: ${r.ko})(실험 기능). 수락하면 전쟁이 시작됩니다.`, `${aiName} intends to declare war on you (reason: ${r.en}) (experimental). Accepting starts the war.`); }
  }
}

// 게임의 ACK 줄을 결과로 바꾼다.
export type Outcome = 'ok' | 'fail' | 'stale' | 'dup';
export function outcomeOf(fields: string[], kv: Record<string, string>): Outcome {
  if (fields.includes('stale')) return 'stale';
  if (fields.includes('dup')) return 'dup';
  if (kv.result === '1' || fields.includes('ok')) return 'ok';
  return 'fail';
}

// 지역화 파일에 쓸 수 있게 문장을 정리한다. 따옴표와 줄바꿈을 바꾸고, 게임이 ?로 깨뜨리는 특수 따옴표·줄임표도 바꾼다.
export function locSafe(t: string): string {
  return plainPunct(t) // 특수 공백·폭 없는 문자·그 밖의 문장부호도(2026-10-29, game-text.ts)
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"').replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u2026]/g, '...').replace(/[\u2013\u2014]/g, '-')
    .replace(/\\/g, '/').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\$/g, '');
}
