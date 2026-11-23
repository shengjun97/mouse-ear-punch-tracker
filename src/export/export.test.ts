import { describe, expect, it } from 'vitest';
import { emptyAnimal } from '../domain/animals';
import type { Animal, Group, Pattern } from '../domain/models';
import { zonePosition } from '../domain/zones';
import { backupSummary, makeBackup, parseBackup, planMerge, type BackupData } from './backup';
import { animalsCsv, csvField } from './csv';
import { earSvg, escapeXml, legendSvg, wrap } from './svg';

const group: Group = { id: 'g1', experimentId: 'e1', name: 'Vehicle', color: '#378ADD', notes: '', order: 0 };
const pattern: Pattern = {
  id: 'p1', experimentId: 'e1', groupId: 'g1', label: 'Vehicle', color: '#378ADD', notes: '', order: 0, createdAt: 0, updatedAt: 0,
  marks: [{ id: 'm1', ear: 'L', type: 'notch', ...zonePosition('top', 'notch') }],
};
const animal: Animal = { ...emptyAnimal('g1'), id: 'a1', experimentId: 'e1', animalCode: 'M1', cage: '3', patternId: 'p1', genotype: '+/-' };
const data: BackupData = {
  experiments: [{ id: 'e1', name: 'Exp', notes: '', patternMode: 'group', similarityThreshold: 0.15, createdAt: 0, updatedAt: 0 }],
  groups: [group],
  patterns: [pattern],
  animals: [animal],
  templates: [],
  schemes: [],
};

describe('backup', () => {
  it('round-trips through JSON', () => {
    const b = makeBackup(data, new Date('2026-11-13T00:00:00Z'));
    const back = parseBackup(JSON.stringify(b));
    expect(back.patterns[0].marks[0].type).toBe('notch');
    expect(back.exportedAt).toBe('2026-11-13T00:00:00.000Z');
    expect(backupSummary(back)).toContain('1 experiments');
  });

  it('rejects files that are not backups, with readable messages', () => {
    expect(() => parseBackup('not json')).toThrow("isn't valid JSON");
    expect(() => parseBackup('{"a":1}')).toThrow("isn't an Ear Punch Tracker backup");
    expect(() => parseBackup(JSON.stringify({ ...makeBackup(data), format: 9 }))).toThrow('Unsupported backup format');
  });

  it('rejects broken references and invalid marks', () => {
    const orphan = makeBackup({ ...data, groups: [] });
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow('missing group');
    const badMark = makeBackup({ ...data, patterns: [{ ...pattern, marks: [{ ...pattern.marks[0], type: 'slit' as never }] }] });
    expect(() => parseBackup(JSON.stringify(badMark))).toThrow('mark 1 is not valid');
    const badAnimal = makeBackup({ ...data, animals: [{ ...animal, patternId: 'nope' }] });
    expect(() => parseBackup(JSON.stringify(badAnimal))).toThrow('missing pattern');
  });

  it('validates templates and numbering schemes too', () => {
    const badScheme = makeBackup({ ...data, schemes: [{ id: 's', name: 'S', builtIn: false, description: '', places: [{ value: 7 as never, digits: {} }] }] });
    expect(() => parseBackup(JSON.stringify(badScheme))).toThrow('invalid digit place');
  });

  it('merges only records not already present', () => {
    const empty = new Set<string>();
    const plan = planMerge(data, {
      experiments: new Set(['e1']),
      groups: empty,
      patterns: empty,
      animals: empty,
      templates: empty,
      schemes: empty,
    });
    expect(plan.skipped).toBe(1);
    expect(plan.add.experiments).toEqual([]);
    expect(plan.add.patterns).toHaveLength(1);
  });
});

describe('CSV', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes formulas but keeps genotypes like +/- and -/-', () => {
    expect(csvField('=1+1')).toBe("'=1+1");
    expect(csvField('-SUM(A1)')).toBe("'-SUM(A1)");
    expect(csvField('+/-')).toBe('+/-');
    expect(csvField('-/-')).toBe('-/-');
  });

  it('exports animals with group, pattern and text description', () => {
    const csv = animalsCsv([animal], [group], [pattern]);
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toBe('animal_id,cage,group,pattern,ear_marks,sex,strain,genotype,date_of_birth,punch_date,status,notes');
    expect(row).toBe('M1,3,Vehicle,Vehicle,L: top notch; R: none,unknown,,+/-,,,alive,');
  });
});

describe('SVG export', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
  });

  it('draws one cut-out per mark and both ear labels', () => {
    const s = earSvg(pattern.marks, { idPrefix: 'x' });
    expect(s.match(/fill="#000"\/>/g)).toHaveLength(1);
    expect(s).toContain('>L</text>');
    expect(s).toContain('>R</text>');
    expect(s).toContain('Dorsal view, nose up');
  });

  it('builds a legend grid with labels and descriptions, unique mask ids', () => {
    const items = [1, 2, 3, 4, 5].map((i) => ({ label: `P${i} <x>`, color: '#000', description: 'L: top notch; R: none', marks: pattern.marks }));
    const { svg, width } = legendSvg(items, { title: 'Exp & co', columns: 4 });
    expect(width).toBe(24 * 2 + 4 * 260);
    expect(svg).toContain('Exp &amp; co');
    expect(svg).toContain('P5 &lt;x&gt;');
    const ids = [...svg.matchAll(/<mask id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('wraps long descriptions', () => {
    expect(wrap('L: top notch, outer notch, center hole; R: 2 bottom notches', 24)).toEqual([
      'L: top notch, outer',
      'notch, center hole; R: 2',
      'bottom notches',
    ]);
  });
});
