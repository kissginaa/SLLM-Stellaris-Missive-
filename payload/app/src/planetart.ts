// 게임 폴더의 행성 그림(gfx/event_pictures/*.dds)을 총독 배경으로 쓴다. 읽기 전용, 게임 파일은 복사하지 않고 실행 중에만 읽는다.
import * as fs from 'fs';
import * as path from 'path';
import { decodeDds, encodePng, shrink } from './flagrender';
import { imageJob } from './image-pool';

/** 행성 종류 번호(sllm_pl_pc) -> 게임 그림 파일 이름. */
export const PLANET_PIC: Record<number, string> = {
  1: 'desert_planet', 2: 'savannah', 3: 'continental_planet', 4: 'tropical_planet', 5: 'ocean_planet', 6: 'arctic_planet', 7: 'alpine',
  8: 'cold_barren_planet', 9: 'nuclear_explosion', 10: 'molten_planet', 11: 'toxic_planet', 12: 'gas_giant', 13: 'asteroid_field',
  14: 'city_planet', 15: 'ringworld', 16: 'habitat', 17: 'shrouded_planet', 18: 'hive', 19: 'arid_planet', 20: 'gaia_planet', 21: 'tundra_planet',
};

const cache = new Map<string, string | null>();

export function planetPicUrl(gameDir: string | null, pc: number): string | null {
  const name = PLANET_PIC[pc];
  if (!gameDir || !name) return null;
  const key = gameDir + '|' + pc;
  if (cache.has(key)) return cache.get(key) ?? null;
  let url: string | null = null;
  try {
    const img = decodeDds(fs.readFileSync(path.join(gameDir, 'gfx', 'event_pictures', name + '.dds')));
    if (img) url = 'data:image/png;base64,' + encodePng(shrink(img, 450)).toString('base64');
  } catch { /* 없으면 그림으로 대신한다 */ }
  cache.set(key, url);
  return url;
}
export function clearPlanetPicCache(): void { cache.clear(); }
/** 같은 그림을 작업 스레드에서(2026-10-27 최적화, 총독 화면 IPC 용). 파일만 여기서 읽는다. */
export async function planetPicUrlAsync(gameDir: string | null, pc: number): Promise<string | null> {
  const name = PLANET_PIC[pc];
  if (!gameDir || !name) return null;
  const key = gameDir + '|' + pc;
  if (cache.has(key)) return cache.get(key) ?? null;
  let bytes: Buffer | null = null;
  try { bytes = fs.readFileSync(path.join(gameDir, 'gfx', 'event_pictures', name + '.dds')); } catch { /* 없으면 그림으로 대신한다 */ }
  const url = bytes ? (await imageJob({ op: 'planet', bytes, maxW: 450 })).url : null;
  cache.set(key, url);
  return url;
}
