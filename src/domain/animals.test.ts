import { describe, expect, it } from 'vitest';
import { animalsByPattern, cageConflicts, emptyAnimal, filterAnimals, groupByCage, naturalCompare, validateAnimal } from './animals';
import type { Animal, Group, Pattern } from './models';
import { zonePosition } from './zones';

const animal = (id: string, code: string, cage: string, extra: Partial<Animal> = {}): Animal => ({
  ...emptyAnimal('g1'),
  id,
  experimentId: 'e',
  animalCode: code,
  cage,
  ...extra,
});
const groups: Group[] = [
  { id: 'g1', experimentId: 'e', name: 'Vehicle', color: '#000', notes: '', order: 0 },
  { id: 'g2', experimentId: 'e', name: 'Drug', color: '#000', notes: '', order: 1 },
];
const pat = (id: string, marks: Pattern['marks']): Pattern => ({
  id, experimentId: 'e', groupId: 'g1', label: id, color: '#000', marks, notes: '', order: 0, createdAt: 0, updatedAt: 0,
});
const hole = (du = 0) => ({ id: `h${du}`, ear: 'R' as const, type: 'hole' as const, ...zonePosition('center', 'hole'), u: 0.5 + du });
const patterns = [pat('p1', [hole()]), pat('p2', [hole(0.05)]), pat('p3', [{ id: 'n', ear: 'L', type: 'notch', ...zonePosition('top', 'notch') }])];

describe('naturalCompare', () => {
  it('sorts numbers inside strings numerically', () => {
    expect(['C10', 'C2', 'c1', '3'].sort(naturalCompare)).toEqual(['3', 'c1', 'C2', 'C10']);
  });
});

describe('validateAnimal', () => {
  it('requires an ID and a group', () => {
    const v = validateAnimal({ ...emptyAnimal(''), animalCode: ' ' }, []);
    expect(v.errors.animalCode).toBeTruthy();
    expect(v.errors.groupId).toBeTruthy();
  });

  it('rejects duplicate IDs regardless of case and spaces', () => {
    const v = validateAnimal({ ...emptyAnimal('g1'), animalCode: ' m12 ' }, [{ animalCode: 'M12' }]);
    expect(v.errors.animalCode).toContain('already used');
  });

  it('warns when the punch date is before birth', () => {
    const v = validateAnimal({ ...emptyAnimal('g1'), animalCode: 'M1', dob: '2026-05-10', punchDate: '2026-05-01' }, []);
    expect(v.errors).toEqual({});
    expect(v.warnings).toEqual(['Punch date is before the date of birth.']);
  });
});

describe('filterAnimals', () => {
  const animals = [
    animal('a1', 'M10', '2', { genotype: 'Antxr1 fl/fl' }),
    animal('a2', 'M2', '2', { status: 'endpoint' }),
    animal('a3', 'F1', '10', { groupId: 'g2', patternId: 'p3' }),
  ];
  const run = (query = '', statuses: Animal['status'][] = [], groupIds: string[] = []) =>
    filterAnimals(animals, groups, patterns, { query, statuses, groupIds }).map((a) => a.animalCode);

  it('sorts by cage then ID, naturally', () => {
    expect(run()).toEqual(['M2', 'M10', 'F1']);
  });

  it('finds by animal ID, cage, group, pattern and genotype', () => {
    expect(run('m10')).toEqual(['M10']);
    expect(run('cage 10')).toEqual(['F1']);
    expect(run('cage:2')).toEqual(['M2', 'M10']);
    expect(run('animal m2')).toEqual(['M2']);
    expect(run('10')).toEqual(['M10', 'F1']);
    expect(run('drug')).toEqual(['F1']);
    expect(run('p3')).toEqual(['F1']);
    expect(run('fl/fl')).toEqual(['M10']);
  });

  it('filters by status and group', () => {
    expect(run('', ['endpoint'])).toEqual(['M2']);
    expect(run('', [], ['g2'])).toEqual(['F1']);
  });
});

describe('groupByCage', () => {
  it('orders cages naturally and puts animals without a cage last', () => {
    const r = groupByCage([animal('a', 'B', '10'), animal('b', 'A', ''), animal('c', 'C', '2'), animal('d', 'A', '2')]);
    expect(r.map((c) => [c.cage, c.animals.map((a) => a.animalCode)])).toEqual([
      ['2', ['A', 'C']],
      ['10', ['B']],
      ['', ['A']],
    ]);
  });
});

describe('cageConflicts', () => {
  it('flags live animals in one cage sharing a pattern or with confusable patterns', () => {
    const animals = [
      animal('a', 'M1', '1', { patternId: 'p1' }),
      animal('b', 'M2', '1', { patternId: 'p1' }),
      animal('c', 'M3', '1', { patternId: 'p2' }),
      animal('d', 'M4', '1', { patternId: 'p3' }),
    ];
    const kinds = cageConflicts(animals, patterns, 0.15).map((c) => `${c.a.animalCode}-${c.b.animalCode}:${c.kind}`);
    expect(kinds).toEqual(['M1-M2:same-pattern', 'M1-M3:confusable', 'M2-M3:confusable']);
  });

  it('ignores different cages, animals without a cage, and animals no longer alive', () => {
    const animals = [
      animal('a', 'M1', '1', { patternId: 'p1' }),
      animal('b', 'M2', '2', { patternId: 'p1' }),
      animal('c', 'M3', '', { patternId: 'p1' }),
      animal('d', 'M4', '1', { patternId: 'p1', status: 'endpoint' }),
    ];
    expect(cageConflicts(animals, patterns, 0.15)).toEqual([]);
  });
});

describe('animalsByPattern', () => {
  it('lists animals per pattern sorted by ID', () => {
    const m = animalsByPattern([animal('a', 'M10', '1', { patternId: 'p1' }), animal('b', 'M2', '1', { patternId: 'p1' }), animal('c', 'X', '1')]);
    expect(m.get('p1')?.map((a) => a.animalCode)).toEqual(['M2', 'M10']);
    expect(m.size).toBe(1);
  });
});
