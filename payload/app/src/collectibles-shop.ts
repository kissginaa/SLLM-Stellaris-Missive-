// 상인 수집품 구매·골동품 진열장(알파 11, 2026-10-25). 순수 규칙. 앱: src/features/collectibles-app.ts.
// 사용자 결정: 엄선 30점, 한 점씩만 있는 진품(팔리면 매진) · 값 100~10,000 에너지 · 전시실 전용 진열장(5×3=15칸).
// 결제: 게임 명령 하나로 잔액 확인 + 차감 + 표시(같은 물건은 두 번 차감되지 않음, wedding.ts 납부와 같은 틀).
import { COLLECTIBLES, type Collectible, type CollectibleMerchant } from './collectibles-data';

export const SHOWCASE_SLOTS = 15;
export interface Owned { date: string; price: number; docId?: string; slot: number | null }
export interface ShopBook { owned: Record<string, Owned>; pending?: { id: string; req: number; date: string } }
export const emptyShop = (): ShopBook => ({ owned: {} });
export const SHOP_MERCHANTS: readonly CollectibleMerchant[] = ['xura', 'riggan', 'muutagan'];
export const isShopMerchant = (s: unknown): s is CollectibleMerchant => SHOP_MERCHANTS.includes(s as CollectibleMerchant);

/** 그 상인이 아직 파는 물건(산 것은 매진). 값 순. */
export const forSale = (b: ShopBook, m: CollectibleMerchant): Collectible[] => COLLECTIBLES.filter((c) => c.m === m && !b.owned[c.id]).sort((x, y) => x.price - y.price);
export const soldOut = (b: ShopBook, m: CollectibleMerchant): Collectible[] => COLLECTIBLES.filter((c) => c.m === m && !!b.owned[c.id]);

/** 결제 명령. 회신 SLLM:COLPAY status=paid|short|duplicate. */
export function colPayCommand(req: number, sid: string, id: string): string {
  const c = COLLECTIBLES.find((x) => x.id === id);
  if (!c || !Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !/^[a-z0-9_]{1,40}$/.test(id)) throw new Error('INVALID_COLLECTIBLE');
  const mark = `sllm_col_${id}`, log = (s: string) => `log = "SLLM:COLPAY/;/req=${req}/;/sid=${sid}/;/id=${id}/;/status=${s}"`;
  return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } if = { limit = { is_variable_set = ${mark} } ${log('duplicate')} } else_if = { limit = { resource_stockpile_compare = { resource = energy value < ${c.price} } } ${log('short')} } else = { add_resource = { energy = -${c.price} } set_variable = { which = ${mark} value = 1 } ${log('paid')} } }`;
}
/** 결제 확인 뒤 기록. 이미 있으면 그대로(false). */
export function recordPurchase(b: ShopBook, id: string, date: string, docId?: string): boolean {
  const c = COLLECTIBLES.find((x) => x.id === id); if (!c || b.owned[id]) return false;
  b.owned[id] = { date, price: c.price, ...(docId ? { docId } : {}), slot: firstFreeSlot(b) };
  if (b.pending?.id === id) delete b.pending;
  return true;
}
export function firstFreeSlot(b: ShopBook): number | null {
  const used = new Set(Object.values(b.owned).map((o) => o.slot).filter((s): s is number => s !== null));
  for (let i = 0; i < SHOWCASE_SLOTS; i++) if (!used.has(i)) return i;
  return null;
}
/** 진열 칸 옮기기: slot 이 차 있으면 두 물건 자리를 바꾼다. null 이면 보관함으로. */
export function placeItem(b: ShopBook, id: string, slot: number | null): boolean {
  const o = b.owned[id]; if (!o) return false;
  if (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= SHOWCASE_SLOTS)) return false;
  if (slot !== null) { const other = Object.entries(b.owned).find(([k, x]) => k !== id && x.slot === slot); if (other) other[1].slot = o.slot; }
  o.slot = slot; return true;
}
export function sanitizeShop(v: unknown): ShopBook {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, any>, b = emptyShop(), seen = new Set<number>();
  if (o.owned && typeof o.owned === 'object') for (const [id, x] of Object.entries(o.owned as Record<string, any>)) {
    if (!COLLECTIBLES.some((c) => c.id === id) || !x || typeof x.date !== 'string') continue;
    let slot: number | null = Number.isInteger(x.slot) && x.slot >= 0 && x.slot < SHOWCASE_SLOTS && !seen.has(x.slot) ? x.slot : null; if (slot !== null) seen.add(slot);
    b.owned[id] = { date: x.date.slice(0, 12), price: Number.isSafeInteger(x.price) ? x.price : 0, ...(typeof x.docId === 'string' ? { docId: x.docId.slice(0, 80) } : {}), slot };
  }
  if (o.pending && typeof o.pending.id === 'string' && Number.isSafeInteger(o.pending.req) && COLLECTIBLES.some((c) => c.id === o.pending.id) && !b.owned[o.pending.id]) b.pending = { id: o.pending.id, req: o.pending.req, date: String(o.pending.date ?? '').slice(0, 12) };
  return b;
}
