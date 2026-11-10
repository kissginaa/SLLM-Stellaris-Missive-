// 세이브 읽기 메모리 검사(2026-10-27, 「앱을 켜자 메모리가 치솟는다」 제보). selftest.ts 에서 runSaveMemChecks() 로 부른다.
// 구역을 찾을 때 「그 구역부터 파일 끝까지」를 통째로 줄로 쪼개던 것이 원인이었다 → 최상위 구역 하나만 잘라 쪼갠다(sectionLines).
import * as fs from 'fs';
import * as path from 'path';
import { sectionLines, parseFlags, parseRulers, parsePortraitInfo, parseSaveCountryMetadata, parseSpeciesBios } from './savereader';

export function runSaveMemChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'save-mem: ' + name); if (!ok) process.exitCode = 1; };
  const gs = ['version="x"', 'species_db=', '{', '\t1=', '\t{', '\t\tportrait="hum"', '\t\tclass="HUM"', '\t\tspecies_bio="Bio"', '\t}', '}', 'planets=', '{', '\t\t\tbig=1', '}',
    'country=', '{', '\t0=', '\t{', '\t\truler=5', '\t\tfounder_species_ref=1', '\t\ttype="default"', '\t\tvariables=', '\t\t{', '\t\t\tsllm_idx=3', '\t\t}', '\t}', '}',
    'leaders=', '{', '\t5=', '\t{', '\t\tportrait="hum_r"', '\t\tgender="female"', '\t\tclass="official"', '\t\tspecies=1', '\t}', '}', 'ships=', '{', '\t\t\tbig=2', '}', ''].join('\r\n');
  const c = sectionLines(gs, 'country');
  check(c.length > 0 && c[0].replace(/\r$/, '') === 'country=' && c[c.length - 1].replace(/\r$/, '') === '}' && !c.some((l) => l.includes('leaders=') || l.includes('big=')), 'sectionLines cuts only that top-level block (CRLF)');
  check(sectionLines(gs, 'nope').length === 0 && sectionLines('a=\n{\n\tx=1', 'a').length === 3, 'missing section → [], unterminated → to the end');
  check(parseRulers(gs)['3']?.portrait === 'hum_r' && parseRulers(gs)['3']?.gender === 'f', 'rulers still read from the cut sections');
  check(parseSaveCountryMetadata(gs).typesByIdx['3'] === 'default' && parseSpeciesBios(gs)['1'] === 'Bio' && parseFlags(gs).bioByIdx['3'] === 'Bio', 'country metadata and bios still read');
  check(parsePortraitInfo(gs)['3']?.founder?.portrait === 'hum', 'portrait info still read');
  let src = ''; try { src = fs.readFileSync(path.join(__dirname, 'savereader.ts'), 'utf8'); } catch { src = fs.readFileSync(path.join(__dirname, '..', 'src', 'savereader.ts'), 'utf8'); }
  check(!/\.slice\(start\)\.split\(|gs\.split\('\\n'\)|text\.slice\(start\)/.test(src), 'no whole-remainder split left in savereader');
  check(/secMemo = null/.test(src), 'readSaveFlags lets go of the cut sections');
  // 작업 스레드(2026-10-27): 자동 저장 때 앱이 1~2초 멈추지 않게, 읽기는 따로 띄운 스레드에서.
  const rd = (f: string) => { for (const d of [__dirname, path.join(__dirname, '..', 'src')]) { try { return fs.readFileSync(path.join(d, f), 'utf8'); } catch { /* 다음 */ } } return ''; };
  const fl = rd('flags.ts'), wk = rd('savereader-worker.ts'), mn = rd('main.ts');
  check(/import \{ Worker \} from 'worker_threads'/.test(fl) && /savereader-worker\.js/.test(fl) && /SLLM_SAVE_SYNC/.test(fl), 'flags reads saves in a worker (sync fallback for tests)');
  check(/if \(this\.reading\) return;/.test(fl) && /gen !== this\.gen/.test(fl) && /this\.gen\+\+/.test(fl), 'one read at a time, stale results after reconfigure are dropped');
  check(/parentPort\?\.postMessage\(\{ ok: true, data \}\)/.test(wk) && !/from 'electron'/.test(wk), 'worker posts the result and does not load electron');
  check(/flagProv\.onUpdate\(/.test(mn), 'main redraws talk/contacts when a new save has been read');
}
