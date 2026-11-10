// 모드 초상화 그리기 작업 본체(2026-10-27 최적화). 작업 스레드(mod-portraits-worker.ts)와, 스레드 파일이 없을 때(자체 검사·개발 실행)의 본 스레드가 함께 쓴다.
// 켜진 모드 전체를 훑어 초상화 목록을 만들고(buildPortraitIndex) 3D 조각을 그려 PNG 로 쓰는 일이라 앱에서 가장 무거운 계산이다.
// 라이브러리 목록(library.json)은 앱(본 스레드)이 결과를 받아 합친다 — 여기서는 그림 파일만 쓴다. electron 없이 돈다.
import * as fs from 'fs';
import { buildPortraitIndex, PortraitResolver, renderPlan, writeRendered, TextureCache, type ModLibItem, type RenderPlan } from './mod-portraits';

/** DDS 머리글 요약(2026-11-08 테스터 신고 「초상화 29개 중 10개 실패」: 로그에 이유가 없어 원인을 몰랐다).
 *  예: "DXT5 512x512", "DX10/98 2048x2048"(98=BC7), "RGB32 300x400", "not_dds", "missing". 그리기 실패 이유를 로그에 남기는 데만 쓴다. */
export function ddsSummary(file: string): string {
  let b: Buffer;
  try { const fd = fs.openSync(file, 'r'); try { b = Buffer.alloc(148); fs.readSync(fd, b, 0, 148, 0); } finally { fs.closeSync(fd); } } catch { return 'missing'; }
  if (b.toString('latin1', 0, 4) !== 'DDS ') return 'not_dds';
  const h = b.readUInt32LE(12), w = b.readUInt32LE(16), flags = b.readUInt32LE(80), cc = b.toString('latin1', 84, 88).replace(/[^\x20-\x7e]/g, '?');
  const fmt = flags & 0x4 ? (cc === 'DX10' ? 'DX10/' + b.readUInt32LE(128) : cc) : flags & 0x40 ? 'RGB' + b.readUInt32LE(88) : 'flags' + flags.toString(16);
  return `${fmt} ${w}x${h}`;
}
/** 그림이 비었을 때 이유: 읽지 못한 텍스처(파일 이름 + DDS 형식). 다 읽었는데 비었으면 'empty'. */
export function emptyReason(plan: RenderPlan, tc: TextureCache): string {
  const files = plan.texturefile ? [plan.texturefile] : [...plan.parts.map((p) => p.diffuse), ...Object.values(plan.roles).flatMap((r) => [r.clothes, r.hair])];
  for (const f of [...new Set(files.filter(Boolean))]) if (!tc.get(f)) return `texture:${f.replace(/\\/g, '/').split('/').slice(-2).join('/')} (${ddsSummary(f)})`.slice(0, 160);
  return plan.texturefile ? 'empty' : plan.parts.some((p) => p.diffuse) ? 'empty' : 'empty:no_textures';
}

export interface ModPortraitJob {
  /** 게임 폴더 + 모드 폴더(겹침 순서: 꺼진 모드 → 켜진 모드 로드 순) */ roots: string[];
  /** roots[1..] 의 모드 이름(같은 순서) */ modNames: string[];
  keys: string[];
  /** 바닐라 라이브러리에 이미 있는 키(그리지 않음) */ baseKeys: string[];
  /** 이미 그렸거나 실패해 기록이 있는 키(redraw 가 아니면 건너뜀) */ seen: string[];
  redraw: boolean; outDir: string;
}
export interface ModPortraitOutcome { key: string; item?: ModLibItem; error?: string }
export interface ModPortraitResult { groups: Record<string, string[]>; results: ModPortraitOutcome[]; total: number }

export async function runModPortraitJob(job: ModPortraitJob, progress: (done: number, total: number) => void = () => {}, pause: () => Promise<void> = async () => {}): Promise<ModPortraitResult> {
  const r = new PortraitResolver(job.roots, buildPortraitIndex(job.roots));
  const base = new Set(job.baseKeys), seen = new Set(job.seen), want = new Set<string>(), groups: Record<string, string[]> = {};
  for (const k of job.keys) {
    const members = r.memberKeys(k).slice(0, 8);
    if (r.ix.groups[k] && members.length) groups[k] = members;
    for (const m of members) if (!base.has(m) && (job.redraw || !seen.has(m))) want.add(m);
  }
  const results: ModPortraitOutcome[] = [], tc = new TextureCache();
  let done = 0; progress(0, want.size);
  for (const key of want) {
    await pause();
    const plan = r.plan(key);
    if ('error' in plan) results.push({ key, error: plan.error });
    else {
      const modName = plan.root === 0 ? 'Stellaris' : job.modNames[plan.root - 1] ?? 'mod';
      try {
        const out = renderPlan(plan, tc);
        const item = out.empty ? null : writeRendered(job.outDir, key, modName, out, plan.status);
        results.push(item ? { key, item } : { key, error: out.empty ? emptyReason(plan, tc) : 'empty' });
      } catch (e) { results.push({ key, error: 'render:' + String((e as Error)?.message ?? e).slice(0, 80) }); }
    }
    progress(++done, want.size);
  }
  return { groups, results, total: want.size };
}
