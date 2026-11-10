// 에너지 크레딧 지불 확인(2026-11-08 사용자: 「에너지 크레딧이 없을 땐 소비 안 되게 — 에너지 크레딧을 지불하는 모든 행위가 그걸 인식해야」).
// 게임으로 가는 모든 콘솔 명령은 game-link 의 sendConsole 을 지난다. 거기서 이 파일로 「플레이어 국고에서 빠지는 에너지」를 읽고,
// 있으면 먼저 국고를 묻는다(ENCHK 줄). 모자라면 명령을 보내지 않고 오류로 돌려준다 → 부른 기능은 원래 「보내지 못했습니다」 길로 빠진다(값도 안 치르고 효과도 없음).
// 순수 로직(전자 앱을 가져오지 않음) — 자체 시험에서 바로 부를 수 있다.

/** 플레이어 범위로 보는 블록 이름. 이 밖의 범위(event_target:…·every_country·from·owner 등 다른 나라로 바뀌는 것)에서 빠지는 에너지는 플레이어 지불이 아니다(예: 조공을 받는 쪽). */
const PLAYER_KEYS = new Set(['effect', 'if', 'else', 'else_if', 'hidden_effect', 'add_resource', 'every_playable_country', 'random_playable_country', 'while', 'random_list', 'random']);

/** 명령에서 플레이어 국고에서 빠질 에너지(가장 큰 한 번, 정수). 없으면 0.
 *  if/else 의 갈래마다 같은 지불이 되풀이될 수 있으니 합이 아니라 가장 큰 값을 쓴다(금고 넣기처럼 이미 국고를 확인하는 명령도 잘못 막지 않게). */
export function energyNeed(cmd: string): number {
  if (!cmd || !/energy\s*=\s*-/.test(cmd)) return 0;
  const playersOnly = /is_ai\s*=\s*no/.test(cmd);
  let best = 0;
  const stack: string[] = [];
  const tok = /([\w:@.$|-]+)\s*=\s*\{|\{|\}|energy\s*=\s*-\s*(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = tok.exec(cmd))) {
    const t = m[0];
    if (m[2] !== undefined) {
      const n = Number(m[2]);
      if (!(n > 0) || stack[stack.length - 1] !== 'add_resource') continue;
      const ok = stack.every((k) => {
        if (k === '' || /^\d+$/.test(k)) return true; // 맨 괄호 · random_list 의 무게
        if (k === 'limit') return false;            // 조건 블록 안은 지불이 아니다
        if (k === 'every_playable_country' || k === 'random_playable_country') return playersOnly;
        return PLAYER_KEYS.has(k);
      });
      if (ok) best = Math.max(best, Math.ceil(n));
    } else if (t === '}') stack.pop();
    else if (t === '{') stack.push('');
    else stack.push(m[1]);
  }
  return best;
}

/** 국고 확인 명령. 회신: SLLM:ENCHK/;/req=<번호>/;/ok=1|0 */
export function energyCheckCommand(req: number, need: number): string {
  if (!Number.isSafeInteger(req) || req < 1 || !Number.isSafeInteger(need) || need < 1) throw new Error('INVALID_ENCHK');
  const log = (ok: 0 | 1) => `log = "SLLM:ENCHK/;/req=${req}/;/ok=${ok}/;/need=${need}"`;
  return `effect every_playable_country = { limit = { is_ai = no } if = { limit = { resource_stockpile_compare = { resource = energy value >= ${need} } } ${log(1)} } else = { ${log(0)} } }`;
}
