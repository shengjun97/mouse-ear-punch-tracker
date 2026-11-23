import { describe, expect, it } from 'vitest';
import { buildLegend, groupEntries } from './legend';
import type { Group, Pattern } from './models';
import { zonePosition } from './zones';

const group = (id: string, name: string, order: number): Group => ({ id, experimentId: 'e', name, color: '#000', notes: '', order });
const pattern = (id: string, groupId: string, label: string, order: number, extra: Partial<Pattern> = {}): Pattern => ({
  id,
  experimentId: 'e',
  groupId,
  label,
  color: '#000',
  marks: [],
  notes: '',
  order,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const groups = [group('g2', 'Treatment', 1), group('g1', 'Vehicle', 0)];
const patterns = [
  pattern('p3', 'g2', 'Treatment B', 1),
  pattern('p1', 'g1', 'Vehicle', 0),
  pattern('p2', 'g2', 'Treatment A', 0, {
    marks: [{ id: 'm', ear: 'L', type: 'notch', ...zonePosition('top', 'notch') }],
    notes: 'High dose',
  }),
];
const none = { query: '', groupIds: [] };

describe('buildLegend', () => {
  it('orders by group order, then pattern order', () => {
    expect(buildLegend(patterns, groups, none).map((e) => e.pattern.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('includes the text description', () => {
    const e = buildLegend(patterns, groups, none);
    expect(e[0].description).toBe('No punch');
    expect(e[1].description).toBe('L: top notch; R: none');
  });

  it('filters by group', () => {
    expect(buildLegend(patterns, groups, { query: '', groupIds: ['g2'] }).map((e) => e.pattern.id)).toEqual(['p2', 'p3']);
  });

  it('searches label, group name, description and notes, case-insensitively', () => {
    const ids = (q: string) => buildLegend(patterns, groups, { query: q, groupIds: [] }).map((e) => e.pattern.id);
    expect(ids('vehicle')).toEqual(['p1']);
    expect(ids('TREATMENT')).toEqual(['p2', 'p3']);
    expect(ids('top notch')).toEqual(['p2']);
    expect(ids('high dose')).toEqual(['p2']);
    expect(ids('no punch')).toEqual(['p1', 'p3']);
  });

  it('requires every word to match', () => {
    expect(buildLegend(patterns, groups, { query: 'treatment b', groupIds: [] }).map((e) => e.pattern.id)).toEqual(['p3']);
    expect(buildLegend(patterns, groups, { query: 'vehicle notch', groupIds: [] })).toEqual([]);
  });

  it('combines group filter and search', () => {
    expect(buildLegend(patterns, groups, { query: 'vehicle', groupIds: ['g2'] })).toEqual([]);
  });
});

describe('buildLegend with animals', () => {
  const animals = new Map([
    ['p1', [{ id: 'a', experimentId: 'e', groupId: 'g1', patternId: 'p1', animalCode: 'M12', cage: '3', sex: 'M' as const, strain: '', genotype: '', status: 'alive' as const, notes: '' }]],
  ]);
  const ids = (q: string) => buildLegend(patterns, groups, { query: q, groupIds: [] }, animals).map((e) => e.pattern.id);

  it('finds patterns by animal ID or cage', () => {
    expect(ids('m12')).toEqual(['p1']);
    expect(ids('cage 3')).toEqual(['p1']);
    expect(ids('cage 30')).toEqual([]);
    expect(ids('animal M1')).toEqual([]);
  });
});

describe('groupEntries', () => {
  it('splits into runs per group in order', () => {
    const runs = groupEntries(buildLegend(patterns, groups, none));
    expect(runs.map((r) => [r.group?.name, r.entries.length])).toEqual([
      ['Vehicle', 1],
      ['Treatment', 2],
    ]);
  });
});
