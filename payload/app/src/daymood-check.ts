// 동적 일상 분위기(2026-10-28) 검사. selftest.ts 에서 runDayMoodChecks() 로 부른다.
import { computeTags, mainTag, toneOf, addFlash, greeting, makeSegment, weatherKind, DAYMOOD, FLASH_MONTHS, _tables, type DayTags, type MainTag, type Tone } from './daymood';

export function runDayMoodChecks(): void {
  const check = (ok: boolean, name: string) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'daymood: ' + name); if (!ok) process.exitCode = 1; };
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const L = (ko: string, _en: string) => ko, E = (_ko: string, en: string) => en;
  const base = { war: false, econ: 'normal' as const, avgStability: 60, protests: 0, crisis: false, flash: null, today: '2300.05.01' };
  check(computeTags(base, cmp).main === 'peace', 'calm → peace');
  check(computeTags({ ...base, war: true }, cmp).main === 'war', 'war');
  check(computeTags({ ...base, avgStability: 35 }, cmp).unrest && computeTags({ ...base, protests: 1 }, cmp).main === 'unrest', 'unrest by stability < 40 or protests');
  check(computeTags({ ...base, war: true, crisis: true }, cmp).main === 'crisis', 'crisis outranks war');
  check(computeTags({ ...base, war: true, flash: { kind: 'grief', until: '2300.08.01', why: '' } }, cmp).main === 'grief', 'mourning outranks war');
  check(computeTags({ ...base, flash: { kind: 'joy', until: '2300.04.01', why: '' } }, cmp).flash === null, 'expired flash ignored');
  check(computeTags({ ...base, econ: 'depression' }, cmp).main === 'slump' && computeTags({ ...base, econ: 'boom' }, cmp).main === 'boom', 'economy');
  check(FLASH_MONTHS.joy === 2 && FLASH_MONTHS.grief === 3 && FLASH_MONTHS.stir === 2 && DAYMOOD.callChance === 0.3 && DAYMOOD.lowStability === 40, 'approved numbers');
  const g = addFlash({ kind: 'grief', until: '2300.08.01', why: 'x' }, 'joy', 'y', '2300.05.01', '2300.07.01', cmp);
  check(g.kind === 'grief' && addFlash({ kind: 'joy', until: '2300.06.01', why: 'x' }, 'grief', 'y', '2300.05.01', '2300.08.01', cmp).kind === 'grief' && addFlash({ kind: 'grief', until: '2300.04.01', why: 'x' }, 'joy', 'y', '2300.05.01', '2300.07.01', cmp).kind === 'joy', 'heavier flash wins until it ends');
  check(toneOf(1) === 'militarist' && toneOf(2 | 128) === 'pacifist' && toneOf(64) === 'materialist' && toneOf(0) === 'plain' && toneOf(undefined) === 'plain', 'tone from ethics bits');
  const mains: MainTag[] = ['crisis', 'grief', 'war', 'stir', 'unrest', 'joy', 'boom', 'slump', 'peace'], tones: Tone[] = ['militarist', 'pacifist', 'spiritualist', 'materialist', 'authoritarian', 'egalitarian', 'plain'];
  check(mains.every((m) => _tables.GREET[m].length && _tables.LIFE[m].length && (['prog', 'cons', 'neu'] as const).every((l) => _tables.CALL_SAY[m][l].length)), 'greeting/life/call text for every tag');
  check(tones.every((t) => _tables.AD[t].length) && Object.values(_tables.WEATHER).every((w) => w.every(([k, e]) => k.includes('{p}') && e.includes('{p}'))), 'ads per tone, weather lines name the planet');
  check([...Object.values(_tables.GREET).flat(), ...Object.values(_tables.LIFE).flat()].every(([k, e]) => !!k && !!e && (k.includes('{cap}') === e.includes('{cap}'))), 'KO/EN pairs keep placeholders');
  const t: DayTags = { ...computeTags({ ...base, war: true, ethBits: 1 }, cmp) };
  let mil = 0; for (let i = 0; i < 200; i++) if (greeting(t, '수도성', Math.random, L).includes('출정식')) mil++;
  check(mil > 60 && greeting(t, 'Capitalis', () => 0.99, E).length > 10 && !greeting(t, '', () => 0, L).includes('{cap}'), 'militarist war greeting, no leftover placeholders');
  let calls = 0; for (let i = 0; i < 2000; i++) if (makeSegment({ tags: t, planets: [{ name: 'Kalis IV', pc: 1 }], callerName: 'Ana', callerLean: 'cons', r: Math.random, L }).kind === 'call') calls++;
  check(Math.abs(calls / 2000 - 0.3) < 0.04, 'about 30% calls');
  const c = makeSegment({ tags: t, planets: [{ name: 'Kalis IV', pc: 1 }], callerName: 'Ana', callerLean: 'cons', r: Math.random, L: E, force: 'call' });
  check(c.lines.length === 3 && c.lines[1].who === 'reporter' && c.lines[0].text.includes('Ana') && c.caller === 'Ana', 'call: host → caller → host');
  const w = makeSegment({ tags: t, planets: [{ name: 'Kalis IV', pc: 1 }], callerName: '', callerLean: 'neu', r: Math.random, L, force: 'weather' });
  check(w.lines.some((l) => l.text.includes('Kalis IV')) && weatherKind(1) === 'desert' && weatherKind(999) === 'continental', 'weather names our planet');
  check(mainTag({ war: false, econ: 'normal', unrest: false, crisis: false, flash: 'stir', tone: 'plain' }) === 'stir', 'stir');
}
