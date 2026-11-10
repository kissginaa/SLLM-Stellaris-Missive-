/**
 * 「회랑의 삼파전」 방첩 대전 — 하수인 없는 하스스톤(2026-11-08 사용자: 「하스스톤처럼 턴제 대전 — 상대의 첩보 공격을 완전히 끊어내야 한다 ·
 * 2~3년 주기 · 이길 때마다 첩보부장 경험치, 4판부터 자동(80%)… 최대 95% · 공격/방어 카드 15장씩 · 체력은 하나로 · 무승부 넣자 ·
 * 그냥 하수인 없는 하스스톤 — 화면+규칙 모두」).
 * 순수 계산만(electron·게임 없음). 화면·저장·결과 반영은 features/scenario-intel-app.ts.
 *
 * 양쪽 다 「영웅」 하나: 우리 = 보안망(체력, 판이 끝나도 이어짐) · 상대 = 공작선. 마나 수정은 턴마다 1개씩 늘어 10개까지.
 * 손패는 남고 매 턴 1장 뽑는다(덱이 비면 탈진 피해). 상대가 먼저(그쪽이 걸어 온 공작). 우리는 5장 + 「공작 자금」(동전)으로 시작.
 * 공작선 0 = 승리(공격을 끊어냄) · 보안망 0 = 패배(침투 임무 성공) · 우리 10턴이 끝나도 둘 다 서 있으면 무승부(상대 철수).
 */
export type DCard =
  | 'probe' | 'brute' | 'phish' | 'fund' | 'rehack' | 'backdoor' | 'chain' | 'ddos' | 'expose' | 'exfil' | 'spread' | 'jamsig' | 'zeroday' | 'offensive' | 'execute'
  | 'firewall' | 'encrypt' | 'patch' | 'lowkey' | 'decoy' | 'drone' | 'redund' | 'trace' | 'honeypot' | 'disinfo' | 'command' | 'isolate' | 'thorns' | 'lockdown' | 'backup' | 'rumor';
export interface DC { id: number; k: DCard; plus?: true }
export type DRar = 'c' | 'u' | 'r';
/** side: atk 공격 · def 방어. power: 상시 효과 · secret: 비밀(엎어 두고 조건이 되면 발동) */
/** buf: 상대 공작 노드의 방어 버퍼에 넣는 카드(그 노드만 막음, 2026-11-08 사용자: 「노드·방어 버퍼 인터페이스에 하스스톤 방식」) */
export const DCARDS: Record<DCard, { side: 'atk' | 'def'; cost: number; rar: DRar; power?: true; secret?: true; junk?: true; buf?: true }> = {
  probe: { side: 'atk', cost: 0, rar: 'c' }, brute: { side: 'atk', cost: 1, rar: 'c' }, phish: { side: 'atk', cost: 2, rar: 'c' }, fund: { side: 'atk', cost: 0, rar: 'c' },
  rehack: { side: 'atk', cost: 4, rar: 'c' }, backdoor: { side: 'atk', cost: 2, rar: 'c' },
  chain: { side: 'atk', cost: 2, rar: 'u' }, ddos: { side: 'atk', cost: 3, rar: 'u' }, expose: { side: 'atk', cost: 2, rar: 'u' }, exfil: { side: 'atk', cost: 3, rar: 'u' },
  spread: { side: 'atk', cost: 3, rar: 'u' }, jamsig: { side: 'atk', cost: 3, rar: 'u' },
  zeroday: { side: 'atk', cost: 8, rar: 'r' }, offensive: { side: 'atk', cost: 5, rar: 'r', power: true }, execute: { side: 'atk', cost: 6, rar: 'r' },
  firewall: { side: 'def', cost: 1, rar: 'c', buf: true }, encrypt: { side: 'def', cost: 1, rar: 'c', buf: true }, patch: { side: 'def', cost: 2, rar: 'c' }, lowkey: { side: 'def', cost: 2, rar: 'c', buf: true },
  decoy: { side: 'def', cost: 4, rar: 'c', buf: true }, drone: { side: 'def', cost: 3, rar: 'c', power: true },
  redund: { side: 'def', cost: 3, rar: 'u', buf: true }, trace: { side: 'def', cost: 2, rar: 'u', buf: true }, honeypot: { side: 'def', cost: 3, rar: 'u', buf: true }, disinfo: { side: 'def', cost: 2, rar: 'u' },
  command: { side: 'def', cost: 3, rar: 'u' }, isolate: { side: 'def', cost: 4, rar: 'u' }, thorns: { side: 'def', cost: 4, rar: 'u', power: true },
  lockdown: { side: 'def', cost: 5, rar: 'r', secret: true }, backup: { side: 'def', cost: 7, rar: 'r' },
  rumor: { side: 'def', cost: 2, rar: 'c', junk: true },   // 역정보가 상대 손패에 섞는 쓸모없는 카드
};
export const DCARD_KEYS = (Object.keys(DCARDS) as DCard[]).filter((k) => !DCARDS[k].junk);
/** 카드 숫자(강화 +1) */
export const DN: Partial<Record<DCard, number>> = {
  probe: 1, brute: 3, phish: 3, rehack: 6, backdoor: 2, chain: 2, ddos: 1, expose: 2, exfil: 2, zeroday: 10, execute: 4,
  firewall: 4, encrypt: 2, patch: 5, lowkey: 3, decoy: 9, redund: 5, backup: 10,
};
export const dn = (c: DC): number => (DN[c.k] ?? 0) + (c.plus && DN[c.k] !== undefined ? 1 : 0);
export const D = {
  hpMax: 30, regen: 2, turns: 10, manaMax: 10, hand: 10, field: 7,   // 하스스톤처럼 필드는 한쪽에 7칸(상대 노드 7 · 우리 방어 버퍼 7, 2026-11-08)
  eHp: [24, 40] as [number, number],             // 상대 공작선(의심+긴장 0~200 에 따라)
  start: [['brute', 4], ['probe', 2], ['phish', 2], ['rehack', 2], ['backdoor', 2], ['exfil', 1], ['firewall', 3], ['encrypt', 2], ['patch', 1], ['decoy', 1]] as Array<[DCard, number]>,
  deckMax: 30, lossHp: 10, execAt: 12,
  chief: { unlock: 4, base: 80, step: 3, max: 95, early: 30, earlyStep: 10, earlyMax: 70 },
};
/** 상대 덱(나라마다 20장): 얼라이언스 = 해킹(잔타·백도어) · 제국 = 한 방(역해킹·제로데이)과 방벽 */
const FOE_DECK: Record<'a' | 'b', Array<[DCard, number]>> = {
  a: [['brute', 3], ['probe', 2], ['phish', 2], ['backdoor', 2], ['chain', 2], ['ddos', 2], ['exfil', 2], ['jamsig', 1], ['spread', 1], ['firewall', 2], ['encrypt', 1]],
  b: [['brute', 3], ['rehack', 3], ['expose', 2], ['phish', 2], ['ddos', 1], ['zeroday', 1], ['execute', 1], ['offensive', 1], ['firewall', 1], ['decoy', 1], ['patch', 1], ['backup', 1], ['fund', 2]],
};
/** 첩보부장 자동 대응 승률(4승부터 80%, 1승마다 +3, 최대 95). 4승 전에는 null(직접 해야 함). */
export const chiefChance = (wins: number): number | null => (wins >= D.chief.unlock ? Math.min(D.chief.max, D.chief.base + (wins - D.chief.unlock) * D.chief.step) : null);
/** 방치(기한까지 안 함)했을 때 첩보부장이 대신 맡는 승률 */
export const chiefFallback = (wins: number): number => chiefChance(wins) ?? Math.min(D.chief.earlyMax, D.chief.early + wins * D.chief.earlyStep);

export interface DSide {
  hp: number; max: number; armor: number; mana: number; maxMana: number; overload: number; power: number; drone: number; thorns: number;
  poison: number; poisonT: number; vuln: boolean; secrets: DCard[]; extraDraw: number; redund: number; fatigue: number; played: number;
  deck: DC[]; hand: DC[];
}
/** 상대가 깔아 둔 공작 노드(공격 카드) — 우리 턴이 끝나면 왼쪽부터 터진다. buf = 우리가 그 노드에 넣은 방어 카드 */
export interface DNode { card: DC; buf: DC[] }
export interface DRes { k: DCard; dmg: number; how: 'hit' | 'block' | 'null' | 'trace' }
/** 우리가 이번 턴에 낸 카드(2026-11-08 사용자: 「내가 뭘 냈는지 모르겠다」) — dmg: 공작선에 준 피해 · node: 넣은 노드(방어 버퍼) */
export interface DMine { c: DC; dmg: number; node?: number }
export interface Duel {
  turn: number; me: DSide; foe: DSide; foePlayed: DC[]; nodes: DNode[]; lastRes: DRes[]; mine?: DMine[]; mineLast?: DMine[]; over?: 'win' | 'lose' | 'draw'; log: Array<[string, string]>; nextId: number; side: 'a' | 'b';
}
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function shuffle<T>(a: T[], rnd: () => number): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** 카드 이름(화면 쪽이 넣어 줌 — 순수 계산 파일에 문구를 두지 않으려고) */
let nameOf: (k: DCard) => [string, string] = (k) => [k, k];
export function setDuelNames(fn: (k: DCard) => [string, string]): void { nameOf = fn; }
const log = (d: Duel, ko: string, en: string) => { d.log.push([ko, en]); if (d.log.length > 40) d.log.splice(0, d.log.length - 40); };
const newSide = (hp: number, max: number, deck: DC[]): DSide => ({ hp, max, armor: 0, mana: 0, maxMana: 0, overload: 0, power: 0, drone: 0, thorns: 0, poison: 0, poisonT: 0, vuln: false, secrets: [], extraDraw: 0, redund: 0, fatigue: 0, played: 0, deck, hand: [] });

function draw(d: Duel, s: DSide, n: number): void {
  for (let i = 0; i < n; i++) {
    const c = s.deck.pop();
    if (!c) { s.fatigue++; s.hp = Math.max(0, s.hp - s.fatigue); log(d, s === d.me ? `덱이 비어 탈진 — 보안망 −${s.fatigue}.` : `상대 덱이 비어 탈진 — 공작선 −${s.fatigue}.`, s === d.me ? `Deck empty: fatigue −${s.fatigue}.` : `Enemy deck empty: fatigue −${s.fatigue}.`); continue; }
    if (s.hand.length < D.hand) s.hand.push(c);
  }
}
/** 피해 한 번(src → dst). pierce = 방벽 무시. 반격 태세·봉쇄 처리. 실제로 깎인 체력을 돌려준다. */
function dmg(d: Duel, src: DSide, dst: DSide, base: number, pierce = false): number {
  let v = Math.max(0, base + src.power); if (dst.vuln) v = Math.floor(v * 1.5);
  if (!pierce) { const a = Math.min(dst.armor, v); dst.armor -= a; v -= a; }
  if (v > 0 && v >= dst.hp && dst.secrets.includes('lockdown')) { dst.secrets.splice(dst.secrets.indexOf('lockdown'), 1); v = dst.hp - 1; log(d, dst === d.me ? '봉쇄 발동 — 보안망이 1에서 버텼습니다.' : '상대의 봉쇄가 발동했습니다.', dst === d.me ? 'Lockdown — our grid held at 1.' : 'Their lockdown triggered.'); }
  dst.hp = Math.max(0, dst.hp - v);
  if (v > 0 && dst.thorns) src.hp = Math.max(0, src.hp - dst.thorns);
  return v;
}
const otherOf = (d: Duel, s: DSide): DSide => (s === d.me ? d.foe : d.me);
/** 카드 효과(누가 냈든 같은 규칙). 허니팟이면 무효. */
function apply(d: Duel, s: DSide, c: DC, rnd: () => number): void {
  const o = otherOf(d, s), n = dn(c), def = DCARDS[c.k];
  if (o.secrets.includes('honeypot')) { o.secrets.splice(o.secrets.indexOf('honeypot'), 1); log(d, s === d.me ? `상대의 허니팟에 「${nameOf(c.k)[0]}」이(가) 걸렸습니다.` : '허니팟 발동 — 상대 카드를 무효로 했습니다.', s === d.me ? 'Their honeypot swallowed our card.' : "Honeypot — their card was nullified."); return; }
  let dealt = 0;
  switch (c.k) {
    case 'probe': dealt += dmg(d, s, o, n); draw(d, s, 1); break;
    case 'brute': case 'rehack': dealt += dmg(d, s, o, n); break;
    case 'phish': dealt += dmg(d, s, o, n); if (o.hand.length) o.hand.splice(Math.floor(rnd() * o.hand.length), 1); break;
    case 'fund': s.mana += c.plus ? 2 : 1; break;
    case 'backdoor': o.poison = Math.max(o.poison, n); o.poisonT += 3; break;
    case 'chain': dealt += dmg(d, s, o, n + s.played); break;
    case 'ddos': for (let i = 0; i < 5; i++) dealt += dmg(d, s, o, n); break;
    case 'expose': dealt += dmg(d, s, o, n); o.vuln = true; break;
    case 'exfil': dealt += dmg(d, s, o, n); draw(d, s, 2); break;
    case 'spread': if (o.poisonT) { o.poisonT *= 2; dealt += dmg(d, s, o, o.poison, true); } else { o.poison = Math.max(o.poison, 1); o.poisonT += 2; } break;
    case 'jamsig': o.overload += c.plus ? 3 : 2; break;
    case 'zeroday': dealt += dmg(d, s, o, n, true); break;
    case 'offensive': s.power += c.plus ? 2 : 1; break;
    case 'execute': if (o.hp <= D.execAt + (c.plus ? 3 : 0)) { o.hp = 0; } else dealt += dmg(d, s, o, n); break;
    case 'firewall': case 'decoy': s.armor += n; break;
    case 'encrypt': s.armor += n; draw(d, s, 1); break;
    case 'patch': s.hp = Math.min(s.max, s.hp + n); break;
    case 'lowkey': s.armor += n; s.extraDraw += 1; break;
    case 'drone': s.drone += c.plus ? 2 : 1; break;
    case 'redund': s.armor += n; s.redund += n; break;
    case 'trace': case 'honeypot': case 'lockdown': if (!s.secrets.includes(c.k)) s.secrets.push(c.k); break;
    case 'disinfo': if (o.hand.length) { const i = Math.floor(rnd() * o.hand.length); o.hand[i] = { id: d.nextId++, k: 'rumor' }; } if (c.plus && o.hand.length > 1) { const i = Math.floor(rnd() * o.hand.length); o.hand[i] = { id: d.nextId++, k: 'rumor' }; } break;
    case 'command': s.armor *= 2; break;
    case 'isolate': o.poison = 0; o.poisonT = 0; o.power = 0; o.drone = 0; o.thorns = 0; s.armor += c.plus ? 5 : 3; break;
    case 'thorns': s.thorns += c.plus ? 2 : 1; break;
    case 'backup': s.hp = Math.min(s.max, s.hp + n); s.armor += c.plus ? 6 : 5; break;
    case 'rumor': break;
  }
  // 역추적(비밀): 공격 카드로 피해를 받으면 그만큼 되돌린다
  if (dealt > 0 && def.side === 'atk' && o.secrets.includes('trace')) { o.secrets.splice(o.secrets.indexOf('trace'), 1); s.hp = Math.max(0, s.hp - dealt); log(d, s === d.me ? `상대의 역추적 — 우리 보안망 −${dealt}.` : `역추적 발동 — 공작선 −${dealt}.`, s === d.me ? `Their traceback — our grid −${dealt}.` : `Traceback — their line −${dealt}.`); }
  s.played++;
}
function checkOver(d: Duel): boolean {
  if (d.foe.hp <= 0) { d.over = 'win'; log(d, '공작선이 끊어졌습니다.', 'Their operation line is cut.'); return true; }
  if (d.me.hp <= 0) { d.over = 'lose'; log(d, '보안망이 무너졌습니다.', 'Our security grid has fallen.'); return true; }
  return false;
}
function startTurn(d: Duel, s: DSide): void {
  s.maxMana = Math.min(D.manaMax, s.maxMana + 1); s.mana = Math.max(0, s.maxMana - s.overload); s.overload = 0; s.played = 0;
  if (s.redund) { s.armor += s.redund; s.redund = 0; }
  if (s.drone) s.armor += s.drone;
  if (s.poisonT > 0) { const v = dmg(d, otherOf(d, s), s, s.poison - otherOf(d, s).power, true); s.poisonT--; if (!s.poisonT) s.poison = 0; log(d, s === d.me ? `백도어 — 보안망 −${v}.` : `백도어가 공작선을 갉아먹었습니다(−${v}).`, s === d.me ? `Backdoor — our grid −${v}.` : `The backdoor gnawed at their line (−${v}).`); }
  draw(d, s, 1 + s.extraDraw); s.extraDraw = 0;
}
/** 상대 차례(간단한 AI): 체력이 낮으면 회복·방벽 먼저, 아니면 비싼 공격부터 마나가 남는 대로 */
function foeTurn(d: Duel, rnd: () => number): void {
  const s = d.foe; startTurn(d, s); d.foePlayed = []; d.nodes = [];
  if (checkOver(d)) return;
  for (let guard = 0; guard < 12; guard++) {
    const full = d.nodes.length >= D.field, can = s.hand.filter((c) => DCARDS[c.k].cost <= s.mana && !DCARDS[c.k].junk && !(full && DCARDS[c.k].side === 'atk' && c.k !== 'fund' && c.k !== 'offensive'));
    if (!can.length) break;
    const low = s.hp <= s.max * 0.4, sc = (c: DC) => DCARDS[c.k].cost * 10 + (DCARDS[c.k].side === (low ? 'def' : 'atk') ? 100 : 0) + (c.k === 'execute' && d.me.hp <= D.execAt ? 500 : 0) + (c.k === 'fund' ? -200 : 0);
    const c = can.sort((x, y) => sc(y) - sc(x))[0];
    s.mana -= DCARDS[c.k].cost; s.hand = s.hand.filter((x) => x.id !== c.id);
    if (DCARDS[c.k].side === 'atk' && c.k !== 'fund' && c.k !== 'offensive') { d.nodes.push({ card: c, buf: [] }); log(d, `상대가 공작 노드를 깔았습니다: 「${nameOf(c.k)[0]}」.`, `The enemy laid an operation node: "${nameOf(c.k)[1]}".`); continue; } // 공격은 노드로 — 우리 턴이 끝나면 터진다
    d.foePlayed.push(c); apply(d, s, c, rnd);
    log(d, `상대: 「${nameOf(c.k)[0]}」.`, `Enemy: "${nameOf(c.k)[1]}".`);
    if (checkOver(d)) return;
  }
  s.hand = s.hand.filter((c) => !DCARDS[c.k].junk || rnd() < 0.5); // 헛소문은 반쯤 버린다
  d.me.vuln = false;
}
export function newDuel(deck: DC[], hp: number, side: 'a' | 'b', press: number, rnd: () => number): Duel {
  const max = Math.round(D.eHp[0] + (D.eHp[1] - D.eHp[0]) * clampN(press, 0, 200) / 200);
  let nid = 100000; const fd: DC[] = []; for (const [k, n] of FOE_DECK[side]) for (let i = 0; i < n; i++) fd.push({ id: nid++, k });
  const d: Duel = { turn: 0, me: newSide(clampN(hp, 1, D.hpMax), D.hpMax, shuffle(deck.map((c) => ({ ...c })), rnd)), foe: newSide(max, max, shuffle(fd, rnd)), foePlayed: [], nodes: [], lastRes: [], log: [], nextId: nid, side };
  d.foe.power = Math.floor(press / 100);
  draw(d, d.foe, 3); draw(d, d.me, 5); d.me.hand.push({ id: d.nextId++, k: 'fund' });   // 나중에 두는 쪽: 5장 + 동전
  foeTurn(d, rnd); if (!d.over) { d.turn = 1; startTurn(d, d.me); checkOver(d); }
  return d;
}
export type PlayWhyD = '' | 'over' | 'nocard' | 'mana' | 'node' | 'nobuf' | 'full';
export function canPlayD(d: Duel, id: number): PlayWhyD {
  if (d.over) return 'over'; const c = d.me.hand.find((x) => x.id === id); if (!c) return 'nocard';
  return DCARDS[c.k].cost > d.me.mana ? 'mana' : '';
}
/** 우리 카드 한 장 */
export function playD(d: Duel, id: number, rnd: () => number): PlayWhyD {
  const why = canPlayD(d, id); if (why) return why;
  const c = d.me.hand.find((x) => x.id === id)!;
  if (DCARDS[c.k].buf) return 'node';                      // 방어 버퍼 카드는 노드에 넣어야 한다(injectD)
  d.me.mana -= DCARDS[c.k].cost; d.me.hand = d.me.hand.filter((x) => x.id !== id);
  const before = d.foe.hp; apply(d, d.me, c, rnd); (d.mine ??= []).push({ c, dmg: Math.max(0, before - d.foe.hp) });
  log(d, `우리: 「${nameOf(c.k)[0]}」${d.foe.hp < before ? ` — 공작선 −${before - d.foe.hp}` : ''}`, `Us: "${nameOf(c.k)[1]}"${d.foe.hp < before ? ` — their line −${before - d.foe.hp}` : ''}`);
  checkOver(d); return '';
}
/** 방어 버퍼: 상대 노드 하나에 방어 카드를 넣는다(그 노드가 터질 때만 막음). 암호화·잠적의 뽑기는 바로. */
export function injectD(d: Duel, id: number, node: number): PlayWhyD {
  const why = canPlayD(d, id); if (why) return why;
  const c = d.me.hand.find((x) => x.id === id)!, t = d.nodes[node]; if (!DCARDS[c.k].buf) return 'nobuf'; if (!t) return 'node';
  if (bufCount(d) >= D.field) return 'full';
  d.me.mana -= DCARDS[c.k].cost; d.me.hand = d.me.hand.filter((x) => x.id !== id); t.buf.push(c); d.me.played++; (d.mine ??= []).push({ c, dmg: 0, node });
  if (c.k === 'encrypt') draw(d, d.me, 1); if (c.k === 'lowkey') d.me.extraDraw += 1; if (c.k === 'redund') d.me.redund += dn(c);
  log(d, `「${nameOf(c.k)[0]}」을(를) 노드 ${node + 1}의 방어 버퍼에 넣었습니다.`, `Injected "${nameOf(c.k)[1]}" into node ${node + 1}'s buffer.`); return '';
}
/** 우리 필드(방어 버퍼)에 놓인 카드 수 */
export const bufCount = (d: Duel): number => d.nodes.reduce((a, t) => a + t.buf.length, 0);
/** 노드 하나가 막을 양(허니팟이면 통째로) */
const bufShield = (t: DNode): number => t.buf.reduce((a, c) => a + (['firewall', 'encrypt', 'lowkey', 'decoy', 'redund'].includes(c.k) ? dn(c) : 0), 0);
/** 화면용: 이 노드가 지금 그대로 터지면 보안망이 얼마나 깎이나(대략) */
export function nodeEst(d: Duel, t: DNode): { dmg: number; pierce: boolean; nul: boolean; lethal: boolean; note: '' | 'poison' | 'jam' | 'draw' } {
  const c = t.card, p = d.foe.power, n = dn(c), vul = (v: number) => v;
  if (t.buf.some((b) => b.k === 'honeypot')) return { dmg: 0, pierce: false, nul: true, lethal: false, note: '' };
  let raw = 0, pierce = false, note: '' | 'poison' | 'jam' | 'draw' = '';
  switch (c.k) { case 'ddos': raw = (n + p) * 5; break; case 'chain': raw = n + p + 1; break; case 'zeroday': raw = n + p; pierce = true; break; case 'backdoor': note = 'poison'; break; case 'spread': note = 'poison'; break; case 'jamsig': note = 'jam'; break;
    case 'execute': if (d.me.hp <= D.execAt + (c.plus ? 3 : 0)) return { dmg: d.me.hp, pierce: true, nul: false, lethal: true, note: '' }; raw = n + p; break;
    default: raw = DN[c.k] !== undefined ? n + p : 0; if (c.k === 'exfil' || c.k === 'probe') note = 'draw'; }
  const dmgv = pierce ? vul(raw) : Math.max(0, vul(raw) - bufShield(t));
  return { dmg: dmgv, pierce, nul: false, lethal: false, note };
}
/** 우리 턴이 끝나면 노드가 왼쪽부터 터진다 */
function resolveNodes(d: Duel, rnd: () => number): void {
  d.lastRes = [];
  for (const t of d.nodes) {
    if (d.over) break;
    if (t.buf.some((b) => b.k === 'honeypot')) { d.lastRes.push({ k: t.card.k, dmg: 0, how: 'null' }); log(d, `허니팟 — 「${nameOf(t.card.k)[0]}」 노드가 헛돌았습니다.`, `Honeypot — the "${nameOf(t.card.k)[1]}" node whiffed.`); continue; }
    const shield = bufShield(t), a0 = d.me.armor, h0 = d.me.hp; d.me.armor += shield;
    apply(d, d.foe, t.card, rnd);
    const used = a0 + shield - d.me.armor; d.me.armor = Math.max(0, a0 - Math.max(0, used - shield));
    const dealt = h0 - d.me.hp, tr = dealt > 0 && t.buf.some((b) => b.k === 'trace');
    if (tr) d.foe.hp = Math.max(0, d.foe.hp - dealt);
    d.lastRes.push({ k: t.card.k, dmg: dealt, how: tr ? 'trace' : dealt > 0 ? 'hit' : 'block' });
    log(d, dealt > 0 ? `노드 「${nameOf(t.card.k)[0]}」 — 보안망 −${dealt}${tr ? `, 역추적으로 공작선 −${dealt}` : ''}.` : `노드 「${nameOf(t.card.k)[0]}」를 막았습니다.`, dealt > 0 ? `Node "${nameOf(t.card.k)[1]}" — grid −${dealt}${tr ? `; traceback hit their line −${dealt}` : ''}.` : `Blocked the "${nameOf(t.card.k)[1]}" node.`);
    if (checkOver(d)) break;
  }
  d.nodes = []; d.me.vuln = false;
}
/** 턴 종료 → 상대 차례 → (10턴이 끝났으면 무승부) → 우리 차례 */
export function endTurnD(d: Duel, rnd: () => number): void {
  if (d.over) return;
  d.foe.vuln = false;
  resolveNodes(d, rnd); if (d.over) return;
  if (d.turn >= D.turns) { d.over = 'draw'; log(d, `${D.turns}턴을 버텼습니다. 상대가 물러났습니다.`, `We held for ${D.turns} turns. The enemy withdrew.`); return; }
  foeTurn(d, rnd); if (d.over) return;
  d.mineLast = d.mine ?? []; d.mine = [];
  d.turn++; startTurn(d, d.me); checkOver(d);
}
// ---- 방첩 덱 관리(2026-11-08): 상점(에너지) · 지우기 · 강화(같은 카드 두 장 → + 한 장) ----
export const DSHOP = { price: { c: 300, u: 700, r: 1500 } as Record<DRar, number>, remove: 400, min: 10 };
export const dPrice = (k: DCard): number => DSHOP.price[DCARDS[k].rar];
export type DDeckWhy = '' | 'max' | 'min' | 'nocard' | 'pair';
export function dAdd(deck: DC[], k: DCard, nextId: () => number): DDeckWhy { if (deck.length >= D.deckMax) return 'max'; if (!DCARD_KEYS.includes(k)) return 'nocard'; deck.push({ id: nextId(), k }); return ''; }
export function dRemove(deck: DC[], id: number): DDeckWhy { if (deck.length <= DSHOP.min) return 'min'; const i = deck.findIndex((c) => c.id === id); if (i < 0) return 'nocard'; deck.splice(i, 1); return ''; }
export function dUpgrade(deck: DC[], k: DCard, nextId: () => number): DDeckWhy {
  const two = deck.filter((c) => c.k === k && !c.plus).slice(0, 2); if (two.length < 2) return 'pair';
  for (const c of two) deck.splice(deck.indexOf(c), 1); deck.push({ id: nextId(), k, plus: true }); return '';
}
/** 강화할 수 있는 카드(같은 카드 + 아닌 것 두 장 이상) */
export const dUpgradable = (deck: DC[]): DCard[] => [...new Set(deck.filter((c) => !c.plus).map((c) => c.k))].filter((k) => deck.filter((c) => c.k === k && !c.plus).length >= 2);
/** 승리 보상 3장(일반 60 · 고급 30 · 희귀 10) */
export function rewardOffer(rnd: () => number): DCard[] {
  const out: DCard[] = [];
  while (out.length < 3) { const r = rnd(), rar: DRar = r < 0.6 ? 'c' : r < 0.9 ? 'u' : 'r'; const pool = DCARD_KEYS.filter((k) => DCARDS[k].rar === rar && !out.includes(k)); if (pool.length) out.push(pool[Math.floor(rnd() * pool.length)]); }
  return out;
}
/** 저장된 대전을 고쳐 읽기(깨졌으면 null — 옛 슬레이 더 스파이어식 대전도 null) */
export function fixDuel(o: unknown): Duel | null {
  const x = o as Duel; if (!x || typeof x !== 'object' || !x.me || !x.foe || !Array.isArray(x.me.hand)) return null;
  const cards = (a: unknown): DC[] => (Array.isArray(a) ? (a as DC[]).filter((c) => c && c.k in DCARDS).map((c) => ({ id: Number(c.id) || 0, k: c.k, ...(c.plus ? { plus: true as const } : {}) })) : []);
  const n = (v: unknown, lo: number, hi: number, df: number) => { const q = Number(v); return Number.isFinite(q) ? clampN(q, lo, hi) : df; };
  const side = (s: DSide): DSide => ({ hp: n(s.hp, 0, 999, 30), max: n(s.max, 1, 999, 30), armor: n(s.armor, 0, 999, 0), mana: n(s.mana, 0, 20, 0), maxMana: n(s.maxMana, 0, 10, 0), overload: n(s.overload, 0, 10, 0), power: n(s.power, 0, 10, 0),
    drone: n(s.drone, 0, 10, 0), thorns: n(s.thorns, 0, 10, 0), poison: n(s.poison, 0, 20, 0), poisonT: n(s.poisonT, 0, 30, 0), vuln: !!s.vuln, secrets: Array.isArray(s.secrets) ? s.secrets.filter((k) => k in DCARDS) : [],
    extraDraw: n(s.extraDraw, 0, 5, 0), redund: n(s.redund, 0, 99, 0), fatigue: n(s.fatigue, 0, 50, 0), played: n(s.played, 0, 50, 0), deck: cards(s.deck), hand: cards(s.hand) });
  const nodes = Array.isArray(x.nodes) ? x.nodes.filter((t) => t && t.card && t.card.k in DCARDS).slice(0, 10).map((t) => ({ card: cards([t.card])[0], buf: cards(t.buf) })) : [];
  const lastRes = Array.isArray(x.lastRes) ? x.lastRes.filter((r) => r && r.k in DCARDS).slice(0, 10).map((r) => ({ k: r.k, dmg: n(r.dmg, 0, 999, 0), how: (['hit', 'block', 'null', 'trace'] as const).includes(r.how) ? r.how : 'hit' })) : [];
  const mines = (a: unknown): DMine[] => (Array.isArray(a) ? (a as DMine[]).filter((m) => m && m.c && m.c.k in DCARDS).slice(0, 20).map((m) => ({ c: cards([m.c])[0], dmg: n(m.dmg, 0, 999, 0), ...(Number.isInteger(m.node) ? { node: Number(m.node) } : {}) })) : []);
  return { turn: n(x.turn, 0, 99, 1), me: side(x.me), foe: side(x.foe), foePlayed: cards(x.foePlayed), nodes, lastRes, mine: mines(x.mine), mineLast: mines(x.mineLast), ...(x.over === 'win' || x.over === 'lose' || x.over === 'draw' ? { over: x.over } : {}),
    log: Array.isArray(x.log) ? x.log.filter((l) => Array.isArray(l) && l.length === 2).slice(-40) as Array<[string, string]> : [], nextId: n(x.nextId, 1, 1e7, 200000), side: x.side === 'b' ? 'b' : 'a' };
}
