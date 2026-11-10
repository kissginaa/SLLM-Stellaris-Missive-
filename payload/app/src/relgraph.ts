// 인물 관계도(본편, 2026-11-09 사용자: 「회랑의 인물도를 본편용으로 따로 떼서 — 우리 지도자만, 일단은」). 순수 규칙. 앱: features/relations-app.ts(relGraph) · 화면: ui/office-relgraph.js.
// 그림 방식만 회랑(ui/office-nobles.js 「인물 관계도」, 삼국지13식)을 참고했고 코드는 따로다. 회랑 파일은 쓰지 않는다.
// 무엇이 보이나: 인물 카드 「인간관계」와 똑같은 규칙(discontent.ts relationCard) — 통치자와의 관계 · 공개된 관계 · 소개로 알게 된 관계. 카드에 없는 관계는 관계도에도 없다.
// 게임에 묻는 것 없음(앱 장부만 읽는다).
import { relationCard } from './discontent';
import { pairKey, type RelationLedger, type Pid } from './relations';

export interface RelGraphPerson { pid: Pid; name: string; cls: string; ruler: boolean; /** 기술 수준 · 평의회 위원(세력판 상세 칸) */ lv?: number; council?: boolean }
/** 선 하나 = 두 사람. kinds: partner(교제·약혼·배우자) · friend(친한·가까운 사이) · rival(긴장·라이벌) · conflict(풀리지 않은 갈등, 플레이어가 아는 것) · acquaint(아는 사이 — 지인, 2026-11-09). */
export type RelEdgeKind = 'partner' | 'friend' | 'rival' | 'conflict' | 'acquaint';
export interface RelGraphEdge { a: Pid; b: Pid; kinds: RelEdgeKind[]; romance?: string; friend?: string; rival?: string }
export interface RelGraph { nodes: RelGraphPerson[]; edges: RelGraphEdge[] }

const ORDER: RelEdgeKind[] = ['partner', 'rival', 'conflict', 'friend', 'acquaint'];

/** 우리 지도자(살아 있는 사람)만으로 관계도 자료를 만든다. 선은 두 사람 모두 명단에 있을 때만. */
export function buildRelGraph(ledger: RelationLedger, people: RelGraphPerson[], rulerPid: Pid): RelGraph {
  const ids = new Set(people.map((p) => p.pid)), names: Record<Pid, string> = Object.fromEntries(people.map((p) => [p.pid, p.name]));
  const edges = new Map<string, RelGraphEdge>();
  const put = (a: Pid, b: Pid, k: RelEdgeKind) => {
    if (a === b || !ids.has(a) || !ids.has(b)) return;
    const key = pairKey(a, b); let e = edges.get(key);
    if (!e) { const [x, y] = a < b ? [a, b] : [b, a]; e = { a: x, b: y, kinds: [] }; edges.set(key, e); }
    if (!e.kinds.includes(k)) e.kinds.push(k);
  };
  for (const p of people) {
    const c = relationCard(ledger, p.pid, rulerPid, names);
    for (const f of c.friends) put(p.pid, f, 'friend');
    for (const r of c.rivals) put(p.pid, r, 'rival');
    if (c.partner) put(p.pid, c.partner, 'partner');
    for (const x of c.conflicts) put(x.a, x.b, 'conflict');
  }
  // 지인(아는 사이, 2026-11-09 사용자: 「삼국지13처럼 — 아는 사람들끼리도 선」): 인물 카드와 같은 공개 규칙(통치자와의 관계 · 공개 · 플레이어 · 소개로 알게 됨)
  for (const r of Object.values(ledger.pairs)) {
    if (r.friend !== 'acquainted') continue;
    if (r.a === rulerPid || r.b === rulerPid || r.visibility === 'public' || r.visibility === 'player' || ledger.playerKnows.pairs.includes(r.key)) put(r.a, r.b, 'acquaint');
  }
  for (const e of edges.values()) {
    const r = ledger.pairs[pairKey(e.a, e.b)];
    if (r) { if (e.kinds.includes('partner')) e.romance = r.romance; if (e.kinds.includes('friend') || e.kinds.includes('acquaint')) e.friend = r.friend; if (e.kinds.includes('rival')) e.rival = r.rival; }
    e.kinds.sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y));
  }
  const nodes = [...people].sort((x, y) => Number(y.ruler) - Number(x.ruler) || x.name.localeCompare(y.name));
  return { nodes, edges: [...edges.values()].sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b)) };
}

/** 가운데 인물 하나로 둘레를 나눈다: 1 = 가운데와 바로 이어진 사람, 2 = 1 의 사람들과 이어진 사람.
 *  통치자가 어느 둘레에도 없으면 apart(선 없이 따로 — 2026-11-09 사용자: 「안 친한 관계는 선 없이 따로, 그래도 나와야」). 나머지는 그리지 않는다. 화면(ui/office-relgraph.js rings)과 같은 규칙. */
export function ringsOf(g: RelGraph, center: Pid, rulerPid: Pid): { ring1: Pid[]; ring2: Pid[]; apart: Pid[]; edges: RelGraphEdge[] } {
  const near = (p: Pid) => g.edges.filter((e) => e.a === p || e.b === p).map((e) => (e.a === p ? e.b : e.a));
  const r1 = new Set(near(center));
  const r2 = new Set<Pid>(); for (const p of r1) for (const q of near(p)) if (q !== center && !r1.has(q)) r2.add(q);
  const shown = new Set([center, ...r1, ...r2]);
  const edges = g.edges.filter((e) => shown.has(e.a) && shown.has(e.b)); // 나온 사람들끼리의 관계는 모두(바깥 둘레끼리도 — 삼국지13식)
  const apart: Pid[] = []; if (rulerPid && !shown.has(rulerPid) && g.nodes.some((n) => n.pid === rulerPid)) apart.push(rulerPid);
  return { ring1: [...r1], ring2: [...r2], apart, edges };
}
