// 시나리오 잠금표(순수, 2026-11-06 사용자: 「원본 앱 기능을 꽤 많이 잠가야 — 잠긴 기능은 아이콘이 아예 사라지게」).
// 앱 연결: src/features/scenario-locks-app.ts · 화면: ui/scenario-locks-ui.js(집무실 아이콘을 숨긴다 — 나중에 생기는 아이콘도 따라가며).
// 국내 정치 묶음은 시나리오를 처음 알아볼 때 한 번 고른다(기본·권장 = 아니오, 판 도중 변경 불가).
export type LockKey =
  | 'terminal' | 'deals' | 'isc' | 'govcouncil' | 'gforum' | 'internet' | 'galcouncil' | 'galcourt'
  | 'poll' | 'amnesty' | 'parliament' | 'lobby' | 'petition' | 'protest' | 'emergencyPowers' | 'court' | 'referendum' | 'debate' | 'faction'
  | 'schedule' | 'policy' | 'embassy' | 'spy' | 'preftl' | 'anthem' | 'social' | 'retired' | 'invite' | 'library' | 'docs' | 'vassal' | 'temper'
  | 'planetHoliday' | 'govpolicy' | 'mood' | 'budget' | 'press' | 'speech' | 'national';

/** 집무실 화면에서 숨길 것(아이콘·탭·칸). 아이콘은 여러 스크립트가 늦게 만들기 때문에 화면 쪽이 계속 지켜본다. */
export const LOCK_SELECTORS: Record<LockKey, string[]> = {
  terminal: ['[data-open="terminal"]'],
  deals: ['#dealCall'],
  isc: ['#iscCall'],
  govcouncil: ['#gcCall'],
  gforum: ['#gfTab'],
  internet: ['#netCall'],
  galcouncil: [],                  // 은하 의회(안건 알림·회의 창) — 아이콘이 없다. 앱이 안건 알림을 버린다(council.ts). 게임은 은하 공동체 설립 자체를 막는다
  galcourt: [],                    // 은하재판소 청문회(공작 발각 시) — 아이콘이 없다. 앱이 청문회를 열지 않는다(espionage-app.ts)
  poll: ['#pollCall'],
  amnesty: ['#amnCall'],
  parliament: ['#auditCall'],     // 의회: 의석·여야·영수회담·원내 공방·국정감사·불신임
  lobby: ['#lobbyCall'],
  petition: ['#petCall'],
  protest: ['#prtCall'],
  emergencyPowers: ['#empCall'],
  court: ['#courtCall'],           // 궁정(음모·반대파·망명·장군 배신·통치 가문)
  referendum: [],                  // 정책 화면 안 국민투표(다음 단계에서 가림)
  debate: [],                      // 라디오 찬반 논평(다음 단계)
  faction: [],                     // 파벌 회의(다음 단계)
  // (2026-11-06 사용자: 집무실에서 추가로 뺄 것) 시나리오에서는 늘 숨긴다
  schedule: ['#alCall'],           // 일정표
  policy: ['[data-app="policy"]'], // 정책
  embassy: ['#embCall'],           // 대사관
  spy: ['#spyCall'],               // 첩보
  preftl: ['#pftlCall'],           // 원시문명 관측
  anthem: ['#musicCall'],          // 국가·군가
  social: ['#socCall'],            // 사교회
  retired: ['#retCall'],           // 은퇴 인물
  invite: ['#fbCall'],             // 초대장
  library: ['#loreCall'],          // 서재
  docs: ['#docsCall'],             // 국가 문서함
  vassal: ['[data-open="vassal"]'],// 종속국 채널
  temper: ['#temperCall'],         // 외교 노선
  // (2026-11-08 사용자: 「회랑 시나리오에서는 행성 총독 칸 기능 다 빼고, 민심도 빼 — 국내 정치를 껐을 때」) — 총독회의(govcouncil)·시위(protest)·청원(petition)과 함께 칸이 통째로 빈다
  planetHoliday: ['#phCall'],      // 행성 기념일(AI 로 기념일을 지어 내는 것까지 멈춘다)
  govpolicy: ['#gpCall'],          // 행성 맡기기
  mood: ['#moodChip', '#moodPop'], // 민심 칩(머리말)
  // (2026-11-08 사용자: 「언론사 인터뷰·연설·국가 행사날·예산 회의도 — 국내 정치를 켜면 돌아오게」)
  budget: ['#budgetCall'],         // 예산 회의
  press: ['[data-open="press"]'],  // 언론사 인터뷰
  speech: ['[data-open="speech"]'],// 연설
  national: ['#nationalCall'],     // 국가 행사날
};

/** 시나리오마다 늘 잠그는 것 */
export const ALWAYS_LOCKED: Record<string, LockKey[]> = {
  corridor: ['terminal', 'deals', 'isc', 'gforum', 'galcouncil', 'galcourt', // 올림픽·월즈는 보류(화합의 도구로 쓸 수도, 2026-11-06)
    'schedule', 'policy', 'embassy', 'spy', 'preftl', 'anthem', 'social', 'retired', 'invite', 'library', 'docs', 'vassal', 'temper'], // 2026-11-06 사용자 추가
};
/** 「국내 정치를 켤까요?」에 아니오(기본)면 잠그는 것 — 켜면 모두 돌아온다(2026-11-08 사용자: 「행성 총독 칸·의회·로비·특별사면·언론사 인터뷰·연설·국가 행사날 전부, 국내 정치 켜면 켜지게」) */
export const POLITICS_KEYS: LockKey[] = ['poll', 'amnesty', 'parliament', 'lobby', 'petition', 'protest', 'emergencyPowers', 'court', 'referendum', 'debate', 'faction',
  'govcouncil', 'planetHoliday', 'govpolicy', 'mood', 'budget', 'press', 'speech', 'national'];

export interface LockState { scenario: string; seat: string; politics: boolean | null }
/** 지금 잠긴 것. politics 가 아직 정해지지 않았으면(null) 잠근 쪽(기본 = 아니오)으로 본다. */
export function lockedKeys(s: LockState): LockKey[] {
  const out = new Set<LockKey>(ALWAYS_LOCKED[s.scenario] ?? []);
  if (!ALWAYS_LOCKED[s.scenario]) return [];
  if (s.politics !== true) for (const k of POLITICS_KEYS) out.add(k);
  if (s.scenario === 'corridor' && s.seat === 'b') out.add('internet'); // 인류 제국은 인터넷이 없다(2026-11-05 결정)
  return [...out];
}
export function selectorsFor(keys: LockKey[]): string[] { const out: string[] = []; for (const k of keys) out.push(...LOCK_SELECTORS[k]); return out; }
