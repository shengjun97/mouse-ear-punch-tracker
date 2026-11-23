import { describe, expect, it } from 'vitest';
import { classifySimilarity, comparePatterns, findConflicts, optimalAssignment, optimalPairs } from './matching';
import type { MarkSpec } from './types';
import { zonePosition } from './zones';

const at = (ear: 'L' | 'R', type: 'hole' | 'notch', zone: Parameters<typeof zonePosition>[0], du = 0, dv = 0): MarkSpec => {
  const p = zonePosition(zone, type);
  return { ear, type, u: p.u + du, v: p.v + dv };
};

describe('optimalPairs', () => {
  it('finds the globally best assignment, not the greedy one', () => {
    const a: MarkSpec[] = [
      { ear: 'R', type: 'hole', u: 0.5, v: 0.5 },
      { ear: 'R', type: 'hole', u: 0.6, v: 0.5 },
    ];
    const b: MarkSpec[] = [
      { ear: 'R', type: 'hole', u: 0.55, v: 0.5 },
      { ear: 'R', type: 'hole', u: 0.4, v: 0.5 },
    ];
    // Greedy pairs (0.5->0.55, 0.6->0.4) = 0.25; optimal (0.5->0.4, 0.6->0.55) = 0.15.
    const total = optimalPairs(a, b).reduce((s, x) => s + x, 0);
    expect(total).toBeCloseTo(0.15);
  });
});

describe('optimalAssignment', () => {
  it('returns indices into the original sets, whichever is larger', () => {
    const a: MarkSpec[] = [{ ear: 'R', type: 'hole', u: 0.5, v: 0.5 }];
    const b: MarkSpec[] = [
      { ear: 'R', type: 'hole', u: 0.9, v: 0.5 },
      { ear: 'R', type: 'hole', u: 0.52, v: 0.5 },
    ];
    expect(optimalAssignment(a, b).map(({ ai, bi }) => [ai, bi])).toEqual([[0, 1]]);
    expect(optimalAssignment(b, a).map(({ ai, bi }) => [ai, bi])).toEqual([[1, 0]]);
  });
});

describe('classifySimilarity', () => {
  it('treats two empty patterns as identical', () => {
    expect(classifySimilarity([], [])).toBe('identical');
  });

  it('detects identical patterns regardless of mark order', () => {
    const a = [at('L', 'notch', 'top'), at('R', 'hole', 'center')];
    expect(classifySimilarity(a, [...a].reverse())).toBe('identical');
  });

  it('flags marks within the threshold as confusable', () => {
    const a = [at('R', 'hole', 'center')];
    const b = [at('R', 'hole', 'center', 0.08, 0)];
    expect(classifySimilarity(a, b, 0.15)).toBe('confusable');
    expect(classifySimilarity(a, b, 0.05)).toBe('distinct');
  });

  it('never confuses a hole with a notch', () => {
    const a = [at('R', 'notch', 'outer')];
    const b = [{ ...a[0], type: 'hole' as const }];
    expect(classifySimilarity(a, b)).toBe('distinct');
  });

  it('never confuses the left ear with the right ear', () => {
    expect(classifySimilarity([at('L', 'hole', 'center')], [at('R', 'hole', 'center')])).toBe('distinct');
  });

  it('distinguishes single and double notches', () => {
    const single = [at('R', 'notch', 'top')];
    const double = [at('R', 'notch', 'top', -0.08), at('R', 'notch', 'top', 0.08)];
    expect(classifySimilarity(single, double)).toBe('distinct');
  });

  it('charges unmatched marks in the comparison cost', () => {
    const c = comparePatterns([at('R', 'hole', 'center')], []);
    expect(c.sameCounts).toBe(false);
    expect(c.cost).toBe(1);
  });
});

describe('findConflicts', () => {
  it('reports each conflicting pair once', () => {
    const p = [
      { id: 'a', marks: [at('R', 'hole', 'center')] },
      { id: 'b', marks: [at('R', 'hole', 'center', 0.05)] },
      { id: 'c', marks: [at('L', 'notch', 'top')] },
      { id: 'd', marks: [] },
    ];
    const conflicts = findConflicts(p);
    expect(conflicts).toHaveLength(1);
    expect([conflicts[0].a.id, conflicts[0].b.id]).toEqual(['a', 'b']);
    expect(conflicts[0].kind).toBe('confusable');
  });
});
