// 은하 의회 안건 정보를 다루는 순수 함수들.
/** 안건 코드(예: resolution_xxx_yyy)를 알아보기 쉬운 이름으로. 번역 파일을 읽을 수 있게 되면 그 이름으로 바꾼다. */
export function agendaTitle(key: string): string {
  const k = (key || '').replace(/^resolution_/i, '').replace(/_+/g, ' ').trim();
  return k || '안건';
}

const CRISIS_NAMES: Record<string, string> = { prethoryn: '프레소린 스컬지', unbidden: '언비든', contingency: '컨틴전시', greatkhan: '그레이트 칸', nanites: '나노 군체' };
/**
 * 의회 안건이 은하 위기를 알리는 것이면 연대기용 한 문장을, 아니면 null.
 * - resolution_galactic_focus_crisis_<종류>: 위기가 이미 나타나 공동체가 대응에 나선다
 * - resolution_declare_crisis(_empire): 어느 제국을 위기(공동의 적)로 선언하자는 안건
 */
export function crisisAgendaText(key: string, target = ''): string | null {
  const k = (key || '').toLowerCase();
  const f = /^resolution_galactic_focus_crisis_([a-z0-9]+)$/.exec(k);
  if (f) return `은하 위기 "${CRISIS_NAMES[f[1]] ?? f[1]}"에 맞서 의회가 공동 대응 안건을 올렸다`;
  if (k === 'resolution_declare_crisis' || k === 'resolution_declare_crisis_empire') return target ? `의회에서 ${target}을(를) 은하 위기로 선언하자는 안건이 올라왔다` : '의회에서 어느 제국을 은하 위기로 선언하자는 안건이 올라왔다';
  return null;
}
