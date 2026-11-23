import { describe, expect, it } from 'vitest';
import { describePattern, diagramAltText } from './describe';
import type { MarkSpec } from './types';
import { zonePosition } from './zones';

const mark = (ear: 'L' | 'R', type: 'hole' | 'notch', zone: Parameters<typeof zonePosition>[0]): MarkSpec => ({
  ear,
  type,
  ...zonePosition(zone, type),
});

describe('describePattern', () => {
  it('describes an empty pattern as "No punch"', () => {
    expect(describePattern([])).toBe('No punch');
  });

  it('matches the example format', () => {
    expect(describePattern([mark('L', 'notch', 'top'), mark('R', 'hole', 'center')])).toBe(
      'L: top notch; R: center hole',
    );
  });

  it('says "none" for an ear without marks', () => {
    expect(describePattern([mark('R', 'hole', 'outer')])).toBe('L: none; R: outer hole');
  });

  it('counts repeated marks in the same zone (double notch)', () => {
    const top = zonePosition('top', 'notch');
    const marks: MarkSpec[] = [
      { ear: 'R', type: 'notch', u: top.u - 0.08, v: top.v + 0.02 },
      { ear: 'R', type: 'notch', u: top.u + 0.08, v: top.v + 0.02 },
    ];
    expect(describePattern(marks)).toBe('L: none; R: 2 top notches');
  });

  it('lists marks in a fixed zone order regardless of input order', () => {
    const a = [mark('L', 'hole', 'center'), mark('L', 'notch', 'top'), mark('L', 'notch', 'outer')];
    const b = [...a].reverse();
    expect(describePattern(a)).toBe('L: top notch, outer notch, center hole; R: none');
    expect(describePattern(b)).toBe(describePattern(a));
  });

  it('keeps holes and notches in the same zone apart', () => {
    expect(describePattern([mark('R', 'notch', 'outer'), mark('R', 'hole', 'outer')])).toBe(
      'L: none; R: outer notch, outer hole',
    );
  });

  it('builds an alt text with orientation', () => {
    expect(diagramAltText([], 'Control')).toBe('Control. Ear punch diagram, dorsal view, nose up. No punch.');
  });
});
