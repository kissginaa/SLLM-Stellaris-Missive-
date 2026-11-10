import { logDiagnostic } from './diagnostics';
// 제국 깃발 공급자: 최근 세이브 + 게임 폴더 이미지로 모드 번호(sllm_idx) -> 깃발 PNG 데이터 주소를 만든다.
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { gameLanguage } from './savegame/loc';
import { runtimeUserDir } from './environment-paths';
import { gameCandidates } from './environment-paths';
import { findLatestSave, readSaveFlags, type SaveFlags, type PortraitInfo } from './savereader';
import { ModResources } from './mod-resources';
import { composeFlag, decodeDds, encodePng, parseColors } from './flagrender';
import { L } from './i18n-pick';
import { usage } from './usage-meter'; // 한 달 사용량(세이브 읽기 횟수·시간, 2026-11-09)
import { imageJob, imageThreaded } from './image-pool';
import type { ImageOp, ImageResult } from './image-ops'; // 한/영 문구(2026-10-19 영어 화면 점검)

export function isGameDir(d: string): boolean { try { return fs.existsSync(path.join(d, 'flags', 'colors.txt')); } catch { return false; } }

/** 스팀 라이브러리 목록(libraryfolders.vdf)에서 스텔라리스 설치 폴더를 찾는다. SLLM_GAME_DIR 로 직접 지정할 수도 있다. */
export function findGameDir(): string | null {
  const cand = gameCandidates();
  for (const c of cand) { try { if (fs.existsSync(path.join(c, 'flags', 'colors.txt'))) return c; } catch { /* 건너뜀 */ } }
  return null;
}

/** 작업 스레드 파일(컴파일된 dist 에만 있다). 없거나 SLLM_SAVE_SYNC 가 켜져 있으면 null → 예전처럼 바로 읽는다(자체 검사·개발 실행). */
function saveWorkerScript(): string | null {
  if (process.env.SLLM_SAVE_SYNC) return null;
  const p = path.join(__dirname, 'savereader-worker.js');
  try { return fs.existsSync(p) ? p : null; } catch { return null; }
}
/** 세이브 하나를 작업 스레드에서 읽는다(2026-10-27). 60초 넘게 걸리면 끊는다. */
function readSaveInWorker(script: string, file: string, extra: { gameDir?: string | null; lang?: string } = {}): Promise<SaveFlags | null> {
  return new Promise((resolve, reject) => {
    let done = false;
    const w = new Worker(script, { workerData: { file, gameDir: extra.gameDir ?? null, lang: extra.lang ?? 'english' } });
    const finish = (fn: () => void) => { if (done) return; done = true; clearTimeout(t); fn(); };
    const t = setTimeout(() => finish(() => { void w.terminate(); reject(new Error('save read timed out')); }), 60000);
    w.once('message', (m: { ok?: boolean; data?: SaveFlags | null; error?: string }) => finish(() => (m?.ok ? resolve(m.data ?? null) : reject(new Error(m?.error || 'save worker failed')))));
    w.once('error', (e) => finish(() => reject(e)));
    w.once('exit', (code) => finish(() => reject(new Error('save worker exited ' + code))));
  });
}

export class FlagProvider {
  /** 작업 스레드로 읽는 중인 세이브(2026-10-27). 다 읽을 때까지는 직전 세이브의 정보를 그대로 쓴다. */
  private reading: { file: string; mtime: number } | null = null;
  private gen = 0;
  private updated: Array<() => void> = [];
  /** 새 세이브를 다 읽었을 때(화면을 다시 그리게 할 때) 부른다. */
  onUpdate(fn: () => void): void { this.updated.push(fn); }
  // 그림 변환(2026-10-27): 처음 만드는 깃발·문양은 작업 스레드에서. 그동안은 null(화면은 깃발 없이), 다 되면 onUpdate 로 다시 그리게 한다.
  private pendImg = new Set<string>();
  private notifyT: ReturnType<typeof setTimeout> | null = null;
  private notifySoon(): void { if (this.notifyT) return; this.notifyT = setTimeout(() => { this.notifyT = null; for (const fn of this.updated) { try { fn(); } catch { /* 무시 */ } } }, 150); }
  private makeImage(key: string, job: ImageOp, after?: (r: ImageResult) => void): void {
    if (this.pendImg.has(key)) return;
    this.pendImg.add(key); const gen = this.gen;
    void imageJob(job).then((res) => {
      this.pendImg.delete(key); if (gen !== this.gen) return;
      after?.(res);
      this.cache.set(key, res.url ?? ''); // 실패도 기억(같은 세이브에서 다시 만들지 않음)
      if (res.url) this.notifySoon();
    });
  }
  private resources: ModResources | null = null;
  private resourceRevision = -1;
  private expectedSid = '';
  private report = new Map<number, unknown>();
  useResources(resources: ModResources): void { this.resources=resources; this.cache.clear(); this.colors=null; }
  setExpectedSid(sid: string): void { this.expectedSid=sid; this.cache.clear(); this.report.clear(); this.lastScan = 0; this.missed.clear(); }
  private matchesSave(): boolean { return !this.expectedSid || this.save?.data.sid === this.expectedSid; }
  ethicsFor(idx: number): string[] | null { this.refresh(); this.seen(idx); return this.matchesSave() ? this.save?.data.ethicsByIdx?.[String(idx)] ?? null : null; }
  portraitInfoFor(idx: number): PortraitInfo | null { this.refresh(); this.seen(idx); return this.matchesSave() ? this.save?.data.portraitsByIdx?.[String(idx)] ?? null : null; }
  /** 통치자의 초상화 ID·성별(세이브 기준). 모르면 null. */
  rulerFor(idx: number): import('./savereader').RulerInfo | null { this.refresh(); this.seen(idx); return this.matchesSave() ? this.save?.data.rulerByIdx?.[String(idx)] ?? null : null; }
  /** 정부 형태·국시·기원·건국 종족 특성(게임 키, 2026-11-03). 모르면 null. */
  natureFor(idx: number): import('./savereader').EmpireNature | null { this.refresh(); this.seen(idx); return this.matchesSave() ? this.save?.data.natureByIdx?.[String(idx)] ?? null : null; }
  typeFor(idx: number): string { this.refresh(); return this.matchesSave() ? this.save?.data.typesByIdx?.[String(idx)] || '' : ''; }
  diagnostics() { this.refresh(); return {file:this.save?.file||null,date:this.save?.data.date||'',sid:this.save?.data.sid||'',expectedSid:this.expectedSid,matches:this.matchesSave(),flags:[...this.report].map(([idx,result])=>({idx,result}))}; }
  private gameDir: string | null | undefined;
  private colors: Record<string, [number, number, number]> | null = null;
  private save: { file: string; mtime: number; data: SaveFlags } | null = null;
  /** 읽기에 실패한 세이브(같은 파일·같은 수정 시각이면 다시 풀지 않는다. 게임이 저장을 마치면 시각이 바뀌어 다시 읽는다, 2026-10-18) */
  private failed: { file: string; mtime: number; at: number } | null = null;
  /** 마지막으로 세이브 폴더를 훑은 시각. 깃발·초상화 접근자가 한 화면에서 수십 번 불려도 폴더 전체 stat 은 1.5초에 한 번만(2026-10-18). */
  private lastScan = 0;
  private cache = new Map<string, string>();

  private userSaveDir: string | null = null;
  private userGameDir: string | null = null;
  constructor(private roots?: string[]) {}

  /** 설정에서 직접 고른 폴더(없으면 null = 자동 찾기). */
  configure(o: { saveDir?: string | null; gameDir?: string | null; roots?: string[] }): void {
    if (o.roots) this.roots = o.roots;
    this.userSaveDir = o.saveDir || null; this.userGameDir = o.gameDir || null;
    this.gameDir = undefined; this.colors = null; this.save = null; this.failed = null; this.lastScan = 0; this.gen++; this.reading = null; this.cache.clear(); this.resources?.invalidate(); this.report.clear(); this.needAfter = null; this.missed.clear();
  }
  latestSave(): string | null { return findLatestSave(this.userSaveDir ? [this.userSaveDir] : this.roots); }
  game(): string | null { return this.userGameDir && isGameDir(this.userGameDir) ? this.userGameDir : findGameDir(); }

  // 2026-11-09(회랑 방식 — 「매달 확인이 필요 없는 것은 바뀔 때만」): 자동 저장마다 세이브를 통째로 다시 풀지 않는다.
  // 깃발·윤리·초상화·통치자·국시 같은 값은 거의 바뀌지 않으므로, 들고 있는 것을 그대로 쓰고 아래 때만 새 세이브를 읽는다.
  //   · 처음 · 다른 세이브(세이브 번호가 다름) · 바뀜 신호(markStale: 세이브 불러옴·통치자 교체·첫 접촉·우리 정부 바뀜·12달 지남 — features/save-signal-app.ts)
  //   · 들고 있는 세이브에 없는 제국을 물을 때(새로 만난 제국, 제국마다 한 번)
  //   · 지금 값이 필요한 곳(fresh = 국력·세이브 요약: 대화 보낼 때·총독 화면 열 때처럼 사용자가 누를 때만)
  /** 이 시각(ms) 뒤에 저장된 세이브가 필요하다(null = 지금 것으로 충분). */
  private needAfter: number | null = null;
  /** 들고 있는 세이브에 없어서 한 번 다시 읽어 본 제국 번호(세이브가 바뀌면 비운다). */
  private missed = new Set<string>();
  /** 새 세이브를 읽어야 한다고 표시한다. after = 이 시각보다 뒤에 저장된 세이브가 있어야 풀린다(기본: 지금 — 신호가 온 뒤의 자동 저장). */
  markStale(why: string, after: number = Date.now()): void {
    const was = this.needAfter;
    this.needAfter = was === null ? after : Math.max(was, after);
    if (was === null) logDiagnostic('info', 'save.stale', { why });
  }
  /** 들고 있는 세이브의 게임 날짜(새로 읽지 않는다). 없으면 빈 문자열. */
  heldDate(): string { return this.save?.data.date ?? ''; }
  /** 들고 있는 세이브에 없는 제국이면 한 번만 다시 읽게 한다(새로 만난 제국). */
  private seen(idx: number): void {
    if (!this.save || !this.matchesSave() || !Number.isInteger(idx) || idx < 0) return;
    const k = String(idx); if (this.save.data.byIdx[k] || this.missed.has(k)) return;
    this.missed.add(k); this.markStale('unknown_empire', this.save.mtime);
  }

  /** 가장 최근 세이브를 다시 읽을지 정한다(바뀐 경우만). fresh = 바뀜 신호가 없어도 더 새 세이브가 있으면 읽는다. */
  refresh(fresh = false): void {
    if (this.save && this.matchesSave() && !fresh && this.needAfter === null) return; // 바뀜 신호가 없으면 들고 있는 것을 쓴다
    const now = Date.now();
    if (this.save && now - this.lastScan < 1500) return;
    this.lastScan = now;
    const f = this.latestSave();
    if (!f) return;
    let mt = 0;
    try { mt = fs.statSync(f).mtimeMs; } catch { return; }
    if (this.save && this.save.file === f && this.save.mtime === mt) return;
    if (this.failed && this.failed.file === f && this.failed.mtime === mt && now - this.failed.at < 30000) return; // 일시적 잠금(EBUSY 등)일 수 있어 30초 뒤엔 다시 시도
    const script = saveWorkerScript();
    if (script) { // 작업 스레드(앱이 멈추지 않음). 끝나면 다음 refresh 가 더 새 세이브를 다시 본다.
      if (this.reading) return;
      const gen = this.gen, at = now; this.reading = { file: f, mtime: mt };
      readSaveInWorker(script, f, { gameDir: this.game(), lang: gameLanguage(runtimeUserDir()) }).then((data) => {
        usage.noteSaveRead('flags', Date.now() - at, !!data);
        if (gen !== this.gen) return; this.reading = null;
        if (data) { this.save = { file: f, mtime: mt, data }; this.cache.clear(); this.failed = null; this.loaded(mt); for (const fn of this.updated) { try { fn(); } catch { /* 화면 갱신 실패는 무시 */ } } }
        else this.failed = { file: f, mtime: mt, at };
      }, (error) => { usage.noteSaveRead('flags', 0, false); if (gen !== this.gen) return; this.reading = null; this.failed = { file: f, mtime: mt, at: Date.now() }; logDiagnostic('warn', 'save.read_failed', { file: f, error }); });
      return;
    }
    try {
      const t0 = Date.now(), data = readSaveFlags(f); usage.noteSaveRead('flags', Date.now() - t0, !!data);
      if (data) { this.save = { file: f, mtime: mt, data }; this.cache.clear(); this.failed = null; this.loaded(mt); }
      else this.failed = { file: f, mtime: mt, at: now };
    } catch(error) { this.failed = { file: f, mtime: mt, at: now }; logDiagnostic('warn','save.read_failed',{file:f,error}); }
  }

  /** 새 세이브를 다 읽었다: 신호 뒤에 저장된 것이면 표시를 푼다. */
  private loaded(mt: number): void { if (this.needAfter !== null && mt > this.needAfter) this.needAfter = null; }

  /** 세이브 요약(지도자·행성 등, 2026-11-03): 지금 판의 세이브일 때만. 오래됐는지는 쓰는 쪽이 date 로 판단한다. */
  saveSnap(): import('./savegame/extract').SaveSnap | null { this.refresh(true); return this.matchesSave() ? this.save?.data.snap ?? null : null; }
  /** 가장 최근 세이브의 게임 날짜(없으면 빈 문자열). */
  latestDate(): string { this.refresh(); return this.save?.data.date ?? ''; }

  /** 모드 번호(sllm_idx) 제국의 국력(세이브 기준). 모르면 null. */
  statsFor(idx: number): import('./savereader').CountryStats | null {
    this.refresh(true);
    return this.matchesSave() ? this.save?.data.statsByIdx[String(idx)] ?? null : null;
  }

  /** 모드 번호(sllm_idx) 제국의 전기(세이브의 건국 종족 정보). 커스텀 제국이 아니면 null. */
  bioFor(idx: number): string | null {
    this.refresh();
    return this.matchesSave() ? this.save?.data.bioByIdx[String(idx)] ?? null : null;
  }

  /** Office heraldry: alpha-only emblem, without flag background or empire colors. */
  emblemFor(idx: number): string | null {
    if (!Number.isInteger(idx) || idx < 0) return null;
    this.refresh();
    if (!this.matchesSave()) return null;
    this.resources?.refresh();
    if (this.resources && this.resourceRevision !== this.resources.revision) {
      this.resourceRevision = this.resources.revision; this.colors = null; this.cache.clear();
    }
    const spec = this.save?.data.byIdx[String(idx)];
    if (!spec) return null;
    const key = 'office-emblem:' + JSON.stringify(spec);
    const cached = this.cache.get(key); if (cached !== undefined) return cached || null;
    try {
      let bytes: Buffer;
      if (this.resources) {
        const resource = this.resources.resolve('flags/' + spec.iconCat + '/' + spec.iconFile);
        if (!resource) return null;
        bytes = this.resources.read(resource);
      } else {
        const game = this.game(); if (!game) return null;
        const base = path.resolve(game, 'flags');
        const target = path.resolve(base, spec.iconCat, spec.iconFile);
        if (!target.startsWith(base + path.sep)) return null;
        bytes = fs.readFileSync(target);
      }
      if (imageThreaded()) { this.makeImage(key, { op: 'emblem', bytes }); return null; }
      const image = decodeDds(bytes); if (!image) return null;
      // Preserve original alpha and cutouts; monochrome tint is applied by CSS.
      const px = new Uint8Array(image.px);
      for (let i = 0; i < px.length; i += 4) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
      const url = 'data:image/png;base64,' + encodePng({w: image.w, h: image.h, px}).toString('base64');
      this.cache.set(key, url); return url;
    } catch { return null; }
  }

  /** 모드 번호(sllm_idx)의 깃발. 모르면 null. */
  urlFor(idx: number): string | null {
    this.refresh();
    if (!this.matchesSave()) { this.report.set(idx,{error:L('최근 세이브가 현재 플레이와 다릅니다. 현재 게임을 저장해 주세요.', 'The latest save does not match the current game. Please save the current game.')}); return null; }
    this.resources?.refresh();
    if (this.resources && this.resourceRevision !== this.resources.revision) { this.resourceRevision=this.resources.revision; this.colors=null; this.cache.clear(); }
    const spec = this.save?.data.byIdx[String(idx)];
    if (!spec) this.seen(idx);
    if (!spec) { this.report.set(idx,{error:L('세이브에서 깃발 구성을 찾지 못했습니다.', 'Could not find the flag layout in the save.')}); return null; }
    const key = JSON.stringify(spec);
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit || null;
    if (this.gameDir === undefined) this.gameDir = this.game();
    if (!this.gameDir) return null;
    if (this.resources) {
      if (!this.colors) { this.colors={}; for(const f of this.resources.files('flags','.txt')) { try { Object.assign(this.colors,parseColors(this.resources.read(f).toString('utf8'))); } catch { /* diagnostics below */ } } }
      if (imageThreaded()) { // 파일만 여기서 읽고 풀기·합치기는 작업 스레드에서(2026-10-27)
        const layers: Array<Record<string, unknown>> = [], bytes: Record<'bg' | 'ic', Buffer | null> = { bg: null, ic: null };
        for (const [k, category, file] of [['bg', spec.bgCat || 'backgrounds', spec.bgFile], ['ic', spec.iconCat, spec.iconFile]] as const) {
          const f = this.resources.resolve('flags/' + category + '/' + file);
          if (!f) { layers.push({ category, file, error: L('파일 누락', 'File missing') }); continue; }
          try { bytes[k] = this.resources.read(f); layers.push({ k, category, file, source: f.source, mod: f.root.name }); } catch (e) { layers.push({ category, file, source: f.source, error: (e as Error).message }); }
        }
        const colors = this.colors;
        this.report.set(idx, { spec, layers, missingColors: spec.colors.filter((c) => c !== 'null' && !colors[c]), partial: layers.some((x) => x.error) });
        this.makeImage(key, { op: 'flag', spec, colors, bg: bytes.bg, ic: bytes.ic, size: 96 }, (res) => {
          if (res.bad?.length) { for (const x of layers) if (res.bad.includes(x.k as 'bg' | 'ic')) x.error = L('지원하지 않거나 손상된 DDS', 'Unsupported or corrupted DDS'); this.report.set(idx, { spec, layers, missingColors: spec.colors.filter((c) => c !== 'null' && !colors[c]), partial: true }); }
        });
        return null;
      }
      const layers: unknown[]=[];
      const img=composeFlag(spec,this.gameDir,this.colors,{size:96,load:(category,file)=>{
        const f=this.resources!.resolve('flags/'+category+'/'+file);
        if(!f){layers.push({category,file,error:L('파일 누락', 'File missing')});return null;}
        try { const image=decodeDds(this.resources!.read(f)); layers.push({category,file,source:f.source,mod:f.root.name,...(!image?{error:L('지원하지 않거나 손상된 DDS', 'Unsupported or corrupted DDS')}:{})});return image; }
        catch(e){layers.push({category,file,source:f.source,error:(e as Error).message});return null;}
      }});
      this.report.set(idx,{spec,layers,missingColors:spec.colors.filter(c=>c!=='null'&&!this.colors![c]),partial:layers.some((x:any)=>x.error)});
      if(!img)return null;
      const url='data:image/png;base64,'+encodePng(img).toString('base64');this.cache.set(key,url);return url;
    }
    if (!this.colors) {
      try { this.colors = parseColors(fs.readFileSync(path.join(this.gameDir, 'flags', 'colors.txt'), 'utf8')); } catch { return null; }
    }
    if (imageThreaded()) { // 게임 폴더에서 바로(모드 자원 없이): 파일만 여기서 읽는다
      const rd = (cat: string, file: string) => { try { const base = path.resolve(this.gameDir!, 'flags'), t = path.resolve(base, cat, file); return t.startsWith(base + path.sep) ? fs.readFileSync(t) : null; } catch { return null; } };
      this.makeImage(key, { op: 'flag', spec, colors: this.colors, bg: rd(spec.bgCat || 'backgrounds', spec.bgFile), ic: rd(spec.iconCat, spec.iconFile), size: 96 });
      return null;
    }
    const img = composeFlag(spec, this.gameDir, this.colors, { size: 96 });
    if (!img) return null;
    const url = 'data:image/png;base64,' + encodePng(img).toString('base64');
    this.cache.set(key, url);
    return url;
  }
}
