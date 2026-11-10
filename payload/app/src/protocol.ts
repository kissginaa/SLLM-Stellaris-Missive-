// game.log 의 SLLM 줄을 파싱한다. 형식: ...SLLM:KIND/;/field/;/field...
export interface SllmMessage {
  kind: string;
  fields: string[];
  kv: Record<string, string>;
  raw: string;
}

// A-00d: 제국·지도자 이름 안에 구분자 "/;/"가 들어 있으면 줄이 잘못 쪼개진다(게임 스크립트는 값을 이스케이프할 수 없다).
// 모드가 찍는 칸은 모두 "영문 소문자 키=값" 또는 영문 소문자 단어(ok·dup·apply…)라서, 그 모양이 아닌 조각은
// 앞 칸 값(이름)의 일부로 보고 다시 붙인다. 정상 줄은 결과가 바뀌지 않는다. 남는 한계: 이름 안의 "/;/" 바로 뒤가
// 영문 소문자 단어이거나 "소문자키=…" 모양이면 구분할 수 없다. 이름 안의 "="는 원래부터 첫 "="에서만 자르므로 괜찮다.
const FIELD_LIKE = /^\\*(?:[a-z][a-z0-9_]*=|[a-z0-9_]*$)/;
export function joinNameFragments(parts: string[]): string[] {
  const out: string[] = [];
  for (let k = 0; k < parts.length; k++) {
    const f = parts[k];
    if (k >= 2 && !FIELD_LIKE.test(f.trimStart())) out[out.length - 1] += '/;/' + f; // 0 은 종류, 1 은 첫 칸이라 붙일 앞 칸이 없다
    else out.push(f);
  }
  return out;
}

export function parseLogLine(line: string): SllmMessage | null {
  const i = line.indexOf('SLLM:');
  if (i < 0) return null;
  const parts = joinNameFragments(line.slice(i + 5).replace(/\r?\n$/, '').split('/;/'));
  const kind = parts[0].trim();
  if (!kind) return null;
  // 직접 효과(버튼/이벤트)의 값 앞에 붙는 '\' 를 제거한다.
  const fields = parts.slice(1).map((f) => f.replace(/^\\+/, '').trim());
  const kv: Record<string, string> = {};
  for (const f of fields) {
    const eq = f.indexOf('=');
    if (eq > 0) kv[f.slice(0, eq)] = f.slice(eq + 1).replace(/^\\+/, '');
    else { const m = /^req(\d+)\$?$/.exec(f); if (m && kv.req === undefined) kv.req = m[1]; } // 2026-10-22 실제 로그: 게임이 "req=$REQ$" 를 "req9$" 로 찍은 적이 있다(구판 비서 조회 모드)
  }
  return { kind, fields, kv, raw: line };
}

// 콘솔로 보낼 효과 한 줄. 선택된 객체가 있어도 항상 플레이어 국가에서 실행된다.
export function wrapForPlayer(effectBody: string): string {
  return `effect every_playable_country = { limit = { is_ai = no } ${effectBody} }`;
}

export function applyEffect(req: number, tid: number, amt: number): string {
  return wrapForPlayer(`sllm_probe_apply = { REQ = ${req} TID = ${tid} AMT = ${amt} }`);
}

// 게임이 로그로 알려 주는 마지막 요청 번호(req=, last=)를 모은다. 새 요청 번호는 항상 이보다 커야 한다.
export function reqSeenIn(m: SllmMessage): number {
  let n = 0;
  for (const k of ['req', 'last']) {
    const v = Number(m.kv[k]);
    if (Number.isFinite(v) && v > n) n = v;
  }
  return n;
}

// dir 1 = AI 가 플레이어에게 에너지를 준다, dir 2 = 플레이어가 AI 에게 준다.
export function transferEffect(req: number, tid: number, amt: number, dir: 1 | 2): string {
  return wrapForPlayer(`sllm_probe_transfer = { REQ = ${req} TID = ${tid} AMT = ${amt} DIR = ${dir} }`);
}

// step 1 조금 호의, 2 매우 호의, 3 조금 불쾌, 4 매우 불쾌
export function opinionShiftEffect(req: number, tid: number, step: number): string {
  return wrapForPlayer(`sllm_probe_opinion_shift = { REQ = ${req} TID = ${tid} STEP = ${step} }`);
}

// 같은 상대에게 호감 변화 여러 개를 한 줄(= 콘솔을 한 번만 열기)로 보낸다. reqs[i] 는 steps[i] 의 요청 번호.
export function opinionShiftEffects(reqs: number[], tid: number, steps: number[]): string {
  return wrapForPlayer(steps.map((s, i) => `sllm_probe_opinion_shift = { REQ = ${reqs[i]} TID = ${tid} STEP = ${s} }`).join(' '));
}

// kind 1 = AI 가 국경 제한을 푼다, kind 2 = 플레이어와 AI 둘만의 전쟁을 끝낸다(실험), kind 3/4/5 = AI 가 플레이어에게 선전포고한다(3 굴욕감 주기, 4 공물 요구, 5 복수)(실험)
export function diploEffect(req: number, tid: number, kind: 1 | 2 | 3 | 4 | 5): string {
  return wrapForPlayer(`sllm_probe_diplo = { REQ = ${req} TID = ${tid} KIND = ${kind} }`);
}

// 은하 의회: 표결 중인 안건에 대한 모든 회원국의 입장(지지/반대/기권)을 로그로 남기게 한다(실험).
export function gcPositionsEffect(): string {
  return wrapForPlayer('sllm_probe_gc_positions = yes');
}

// 은하 의회: 모든 AI 회원국의 프로필(성향·정부·태도 등)을 로그로 남기게 한다(실험).
export function gcProfilesEffect(): string {
  return wrapForPlayer('sllm_probe_gc_profiles = yes'); // F-13: 다른 명령과 같이 플레이어 국가 범위에서
}
// A-01 2단계: 플레이어 연방의 이름·종류·단계·응집력·회원·켜진 법을 로그로(SLLM:FED·FEDMEMBER·FEDLAW·FEDEND). 읽기만 한다.
export function fedReadEffect(req = 0): string {
  if (!Number.isSafeInteger(req) || req < 0) throw new Error('Invalid federation request');
  return wrapForPlayer(`set_variable = { which = sllm_fed_read_req value = ${req} } sllm_probe_fed_read = yes`);
}
// 은하 의회 소집: 회원국 명단·외교 가중치·프로필·입장을 한 번의 명령으로 지금 시점 값으로 다시 읽는다.
export function gcLiveEffect(): string {
  return wrapForPlayer('sllm_probe_gc_members = yes sllm_probe_gc_profiles = yes sllm_probe_gc_positions = yes');
}
// 은하 의회: 표결 중인 안건을 강제로 통과(pass)·취소(cancel)한다. 모드가 '아직 그 안건을 표결 중인지' 먼저 확인하고, 결과를 GCFORCE 줄로 돌려준다.
// 안건 코드는 영문·숫자·밑줄만, 요청 번호 REQ 는 줄마다 달라야 한다(같은 로그 줄은 게임이 버린다).
export function forceResolutionEffect(key: string, pass: boolean, req: number): string | null {
  if (!/^resolution_[a-z0-9_]{1,80}$/.test(key) || !Number.isInteger(req) || req < 1) return null;
  return wrapForPlayer(`${pass ? 'sllm_probe_gc_force_pass' : 'sllm_probe_gc_force_cancel'} = { REQ = ${req} KEY = ${key} }`);
}
// 은하 의회: 지금도 그 안건을 표결 중인지만 읽는다(GCSTATE 줄). 응답이 없을 때 재전송하기 전에 상태부터 확인하는 데 쓴다.
export function gcStatusEffect(key: string, req: number): string | null {
  if (!/^resolution_[a-z0-9_]{1,80}$/.test(key) || !Number.isInteger(req) || req < 1) return null;
  return wrapForPlayer(`sllm_probe_gc_status = { REQ = ${req} KEY = ${key} }`);
}

/** Result identity comes from the unique request and save; string parameter echoes are optional. */
export function councilReceiptMatches(m: SllmMessage, expected: { sid: string; req: number; key: string; kind: 'GCFORCE' | 'GCSTATE'; mode: 'pass' | 'cancel' }): boolean {
  if (!expected.sid || m.kv.sid !== expected.sid || m.kind !== expected.kind || Number(m.kv.req) !== expected.req) return false;
  if (m.kv.key !== undefined && m.kv.key !== expected.key) return false;
  return m.kind === 'GCSTATE' ? ['0', '1'].includes(m.kv.voting) : m.kv.mode === expected.mode && ['done', 'stale', 'unconfirmed'].includes(m.kv.state);
}

// 총독 대화: 플레이어가 가진 행성들과 총독을 로그로 남기게 한다(실험).
export function planetsEffect(): string {
  return wrapForPlayer('sllm_probe_log_planets = yes');
}

// 게임 안 외교 창(실험): 상대 제국 TID 가 플레이어에게 대화 창을 연다. 문장은 지역화 파일 SLLM_CHAT_DESC 에서 읽는다.
export function openChatEffect(tid: number): string {
  return wrapForPlayer(`sllm_probe_open_chat = { TID = ${tid} }`);
}
/** 게임 안 키보드 창(실험)을 대상 AI 의 통신으로 연다. 새 대화면 입력 칸을 비운다(CLEAR=1). */
export function openKbEffect(tid: number, clear: boolean): string {
  return wrapForPlayer(`sllm_probe_open_kb = { TID = ${tid} CLEAR = ${clear ? 1 : 0} }`);
}

// 게임이 일시정지 중인지 로그(SLLM:PSTATE)로 알려 달라고 한다.
export function pauseStateEffect(): string {
  return wrapForPlayer('sllm_probe_pause_state = yes');
}

/** 앱이 맞는 모드 연결 규격(모드 sllm_probe_connection.txt 의 HELLO protocol=). 앱·모드 함께 바뀌는 변경이 있을 때 올린다. */
export const MOD_PROTOCOL = 6; // 2026-10-24: 총독회의·기념일·시위·결혼 수정자, 임시회의·타국 만찬 조회가 모드에 더해짐(낡은 모드 경고)
export type ModProtocolState = 'ok' | 'old' | 'new';
/** HELLO 가 알려 준 규격 번호 → 맞음 / 모드가 낡음(번호 없음·0 포함) / 앱이 낡음. */
export function modProtocolState(p: number): ModProtocolState {
  const n = Number.isFinite(p) ? p : 0;
  return n === MOD_PROTOCOL ? 'ok' : n < MOD_PROTOCOL ? 'old' : 'new';
}
export const MOD_PROTOCOL_NOTICE = {
  old: '게임에 적용된 SLLM 모드가 이 앱보다 낡았습니다. 창작마당에서 SLLM 모드를 최신으로 업데이트한 뒤 게임을 다시 시작해 주세요. 새 기능 일부가 동작하지 않을 수 있습니다.',
  new: '이 앱이 게임에 적용된 SLLM 모드보다 낡았습니다. SLLM 앱을 최신으로 업데이트해 주세요. 일부 기능이 동작하지 않을 수 있습니다.',
} as const;
