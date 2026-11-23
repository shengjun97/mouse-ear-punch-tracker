import { describe, expect, it } from 'vitest';
import { compareForLookup, describeDifference, lookup } from './lookup';
import type { MarkSpec } from './types';
import { zonePosition, type ZoneId } from './zones';

const at = (ear: 'L' | 'R', type: 'hole' | 'notch', zone: ZoneId, du = 0, dv = 0): MarkSpec => {
  const p = zonePosition(zone, type);
  return { ear, type, u: p.u + du, v: p.v + dv };
};

const patterns = [
  { id: 'none', marks: [] as MarkSpec[] },
  { id: 'R1', marks: [at('R', 'hole', 'top')] },
  { id: 'R4', marks: [at('R', 'notch', 'top')] },
  { id: 'R7', marks: [at('R', 'notch', 'top', -0.08), at('R', 'notch', 'top', 0.08)] },
  { id: 'L10+R4', marks: [at('L', 'hole', 'top'), at('R', 'notch', 'top')] },
];

const ids = (observed: MarkSpec[], tol?: number) => lookup(observed, patterns, tol).map((h) => `${h.item.id}:${h.kind}`);

describe('lookup', () => {
  it('finds the exact pattern first, tolerating imprecise taps', () => {
    const r = lookup([at('R', 'notch', 'top', 0.1, 0.03)], patterns);
    expect(r[0].item.id).toBe('R4');
    expect(r[0].kind).toBe('match');
    expect(r.filter((h) => h.kind === 'match')).toHaveLength(1);
  });

  it('matches "No punch" when nothing is entered', () => {
    expect(ids([])[0]).toBe('none:match');
  });

  it('never matches a notch to a hole in the same place', () => {
    const r = lookup([at('R', 'notch', 'top')], [{ id: 'R1', marks: [at('R', 'hole', 'top')] }]);
    expect(r[0].kind).toBe('partial');
    expect(r[0].differences.map((d) => d.kind).sort()).toEqual(['extra', 'missing']);
  });

  it('never matches the left ear to the right ear', () => {
    const r = lookup([at('L', 'notch', 'top')], [{ id: 'R4', marks: [at('R', 'notch', 'top')] }]);
    expect(r[0].kind).toBe('partial');
  });

  it('tells single from double notches', () => {
    const single = ids([at('R', 'notch', 'top')]);
    expect(single[0]).toBe('R4:match');
    expect(single).not.toContain('R7:match');
    const double = ids([at('R', 'notch', 'top', -0.07), at('R', 'notch', 'top', 0.09)]);
    expect(double[0]).toBe('R7:match');
  });

  it('ranks same marks in a different spot above patterns with different marks', () => {
    const observed = [at('R', 'hole', 'outer')];
    const r = lookup(observed, patterns);
    expect(r[0].item.id).toBe('R1');
    expect(r[0].kind).toBe('same-marks');
  });

  it('reports several matches when patterns are too similar to tell apart', () => {
    const twins = [
      { id: 'a', marks: [at('R', 'hole', 'center')] },
      { id: 'b', marks: [at('R', 'hole', 'center', 0.1)] },
    ];
    const r = lookup([at('R', 'hole', 'center', 0.05)], twins);
    expect(r.filter((h) => h.kind === 'match')).toHaveLength(2);
  });

  it('uses the tolerance to decide match vs moved', () => {
    const observed = [at('R', 'hole', 'center', 0.2)];
    const target = [{ id: 'c', marks: [at('R', 'hole', 'center')] }];
    expect(lookup(observed, target, 0.25)[0].kind).toBe('match');
    expect(lookup(observed, target, 0.1)[0].kind).toBe('same-marks');
  });
});

describe('difference explanations', () => {
  it('names missing, extra and moved marks', () => {
    const c = compareForLookup([at('L', 'hole', 'center')], [at('R', 'notch', 'top')], 0.25);
    expect(c.differences.map(describeDifference).sort()).toEqual(['also has R top notch', 'has no L center hole']);

    const moved = compareForLookup([at('R', 'hole', 'outer')], [at('R', 'hole', 'top')], 0.25);
    expect(moved.differences.map(describeDifference)).toEqual(['R top hole, not outer']);
  });
});
