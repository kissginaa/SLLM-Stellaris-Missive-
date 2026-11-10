// 개발자 도구 「AI 제국 실제 상태」(2026-10-29, AiLive aic_truth_ui 참고 — 아이디어만).
// 테스터 QA 용: 각 AI 제국에 대해 앱이 실제로 쥐고 있는 상태(감정·거래·물자 지원·자치도·협약·혼인·규탄 입장·기억의 장)를
// 있는 그대로 보여 준다. 첩보가 아니라 앱 내부의 진실이다. 기록이 없으면 「없음」이라고 적고,
// 이 세이브에서 한 번도 돌지 않은 기능은 맨 아래 따로 모은다(빈 칸도 정보). 읽기만 하고 게임·저장소는 바꾸지 않는다.
import { ctx } from '../app/ctx';
import { terminal } from './terminal';
import { emotionsFor, emotionsDebug } from './emotions-app';
import { dealsFor, dealOwed } from './deals-app';
import { aidViewFor, autonomyFor, foreignCauses } from './hoi-app';
import { pactWith, betrayed } from './crisis-pact-app';
import { marauderDealWith } from './marauder-app';
import { marryView } from './court-app';
import { stanceOfEmpire, warVerdicts } from './condemn-app';
import { warDeclarations } from './declare-app';
import { chaptersFor } from './memory-app';
import { L } from '../i18n-pick';

const safe = <T>(f: () => T, fb: T): T => { try { return f(); } catch { return fb; } };
const EMO_KO: Record<string, string> = { grudge: '원한', gratitude: '고마움', fear: '두려움', ambition: '야망' };

/** 줄 목록(개발자 도구 결과 칸에 그대로). */
export function aiTruthLines(): string[] {
  const sid = ctx.curSaveId; if (!sid) return [L('세이브를 불러온 뒤에 볼 수 있습니다.', 'Load a save first.')];
  const out: string[] = [], ran = { emo: false, deal: false, aid: false, auto: false, pact: false, mrd: false, marry: false, stance: false, chap: false };
  const contacts = safe(() => (terminal.all as Array<{ idx: number; name: string; type: string }>).slice(), []);
  out.push(L(`세이브 ${sid} · 게임 날짜 ${ctx.gameDate || '?'} · 연락처 ${contacts.length}곳`, `Save ${sid} · game date ${ctx.gameDate || '?'} · ${contacts.length} contacts`), '');
  for (const c of contacts) {
    const rows: string[] = [];
    const e = safe(() => emotionsFor(c.idx), undefined);
    if (e && Object.values(e).some((v) => v > 0)) { ran.emo = true; rows.push(L('감정: ', 'Emotions: ') + Object.entries(e).map(([k, v]) => `${L(EMO_KO[k] ?? k, k)} ${Math.round(v)}`).join(' · ')); }
    const deals = safe(() => dealsFor(c.idx), []);
    if (deals.length) { ran.deal = true; rows.push(L(`외교 거래 ${deals.length}건`, `${deals.length} deal(s)`) + ': ' + deals.map((a) => `${a.since}${a.done ? L(' 끝남', ' done') : ''}${a.broken ? L(` 파기(${a.broken})`, ` broken (${a.broken})`) : ''}${a.monthly.length ? L(` 매달 ${a.monthly.length}`, ` monthly ${a.monthly.length}`) : ''}${a.nap.length ? L(' 불가침', ' NAP') : ''}`).join(' / ')); }
    if (safe(() => dealOwed(c.idx), false)) rows.push(L('약속 파기로 상대가 약점을 쥠', 'They hold a hook over us (broken promise)'));
    const aid = safe(() => aidViewFor(c.idx, null)?.active?.text ?? '', '');
    if (aid) { ran.aid = true; rows.push(L('물자 지원: ', 'Lend-lease: ') + aid); }
    const au = safe(() => autonomyFor(c.idx), null);
    if (au) { ran.auto = true; rows.push(L('자치도: ', 'Autonomy: ') + au.text); }
    if (safe(() => pactWith(c.idx), false)) { ran.pact = true; rows.push(L('공동 대응 협약 중', 'Crisis pact active')); }
    if (safe(() => betrayed(c.idx), false)) { ran.pact = true; rows.push(L('협약 배신 기록', 'Pact betrayal on record')); }
    if (safe(() => marauderDealWith(c.idx), false)) { ran.mrd = true; rows.push(L('약탈자 거래 이력', 'Marauder deal on record')); }
    const ms = safe(() => marryView(c.idx)?.marriages ?? [], []);
    if (ms.length) { ran.marry = true; rows.push(L('정략결혼: ', 'Marriages: ') + ms.map((m) => m.text).join(' / ')); }
    const st = safe(() => stanceOfEmpire(c.idx), null);
    if (st) { ran.stance = true; rows.push(L('규탄 입장: ', 'War stance: ') + st.text); }
    const ch = safe(() => chaptersFor(c.idx), []);
    if (ch.length) { ran.chap = true; rows.push(L(`기억의 장 ${ch.length}개`, `${ch.length} memory chapter(s)`)); }
    out.push(`■ ${c.name} (#${c.idx}, ${c.type})`);
    out.push(...(rows.length ? rows.map((r) => '   ' + r) : ['   ' + L('(앱이 쥔 상태 없음)', '(no app state)')]));
  }
  const ed = safe(() => emotionsDebug(), { lastTick: '', lastActs: null as { date: string; n: number; cmds: number } | null });
  const fc = safe(() => foreignCauses(), []), decl = safe(() => warDeclarations().length, 0), ver = safe(() => warVerdicts().length, 0);
  out.push('', L('— 전체 —', '— Overall —'));
  out.push(L(`감정 분기 계산: ${ed.lastTick || '아직 없음'}`, `Emotion quarter tick: ${ed.lastTick || 'never'}`));
  out.push(L(`감정 행동 명령: ${ed.lastActs ? `${ed.lastActs.date} 제국 ${ed.lastActs.n}곳, 명령 ${ed.lastActs.cmds}개` : '앱을 켠 뒤로 보낸 적 없음'}`, `Emotion actions sent: ${ed.lastActs ? `${ed.lastActs.date}, ${ed.lastActs.n} empires, ${ed.lastActs.cmds} commands` : 'none since the app started'}`));
  out.push(L(`우리 파벌을 몰래 돕는 외국: ${fc.length ? fc.map((x) => `${x.by}(${x.eth}${x.revealed ? ', 드러남' : ''}, ~${x.until})`).join(' / ') : '없음'}`, `Foreign backing of our factions: ${fc.length ? fc.map((x) => `${x.by} (${x.eth}${x.revealed ? ', exposed' : ''}, until ${x.until})`).join(' / ') : 'none'}`));
  out.push(L(`전쟁 선언문 ${decl}건 · 남의 전쟁 판정 ${ver}건`, `${decl} war declaration(s) · ${ver} foreign-war verdict(s)`));
  const never = ([['emo', L('감정 기억', 'Emotions')], ['deal', L('외교 거래', 'Deals')], ['aid', L('물자 지원', 'Lend-lease')], ['auto', L('자치도', 'Autonomy')], ['pact', L('공동 대응 협약', 'Crisis pact')], ['mrd', L('약탈자 거래', 'Marauder deals')], ['marry', L('정략결혼', 'Marriages')], ['stance', L('규탄 입장', 'War stances')], ['chap', L('기억의 장', 'Memory chapters')]] as Array<[keyof typeof ran, string]>).filter(([k]) => !ran[k]).map(([, n]) => n);
  if (!ed.lastTick) never.unshift(L('감정 분기 계산', 'Emotion quarter tick'));
  out.push('', L('이 세이브에서 아직 한 번도 기록이 없는 기능: ', 'Features with no record in this save yet: ') + (never.length ? never.join(', ') : L('없음', 'none')));
  return out;
}
