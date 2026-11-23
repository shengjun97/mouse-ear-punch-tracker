import { describe, expect, it } from 'vitest';
import { describePattern } from './describe';
import { ellipticalRadius } from './geometry';
import { findConflicts } from './matching';
import { BUILT_IN_SCHEMES, blankScheme, copyScheme, marksForNumber, maxContiguous } from './numbering';

const [jax, jaxZero, u399] = BUILT_IN_SCHEMES;
const desc = (s = jax, n: number) => {
  const r = marksForNumber(s, n);
  if (!r.ok) throw new Error(r.reason);
  return describePattern(r.marks);
};

describe('built-in JAX 1–99 scheme', () => {
  it('puts units on the right ear and tens on the left', () => {
    expect(desc(jax, 1)).toBe('L: none; R: top hole');
    expect(desc(jax, 10)).toBe('L: top hole; R: none');
  });

  it('uses holes for 1–3, notches for 4–6 and double notches for 7–9', () => {
    expect(desc(jax, 2)).toBe('L: none; R: outer hole');
    expect(desc(jax, 3)).toBe('L: none; R: bottom hole');
    expect(desc(jax, 4)).toBe('L: none; R: top notch');
    expect(desc(jax, 6)).toBe('L: none; R: bottom notch');
    expect(desc(jax, 7)).toBe('L: none; R: 2 top notches');
    expect(desc(jax, 8)).toBe('L: none; R: 2 outer notches');
  });

  it('combines both ears for two-digit numbers', () => {
    expect(desc(jax, 94)).toBe('L: 2 bottom notches; R: top notch');
    expect(desc(jax, 19)).toBe('L: top hole; R: 2 bottom notches');
  });

  it('keeps notches on the edge and holes inside', () => {
    for (let n = 1; n <= 99; n++) {
      const r = marksForNumber(jax, n);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      for (const m of r.marks) {
        if (m.type === 'notch') expect(ellipticalRadius(m)).toBeCloseTo(1, 3);
        else expect(ellipticalRadius(m)).toBeLessThan(0.8);
      }
    }
  });

  it('covers 1–99 and nothing above', () => {
    expect(maxContiguous(jax)).toBe(99);
    expect(marksForNumber(jax, 100).ok).toBe(false);
    expect(marksForNumber(jax, 0).ok).toBe(false);
  });

  it('gives 99 patterns that are all distinguishable at the default threshold', () => {
    const patterns = Array.from({ length: 99 }, (_, i) => {
      const r = marksForNumber(jax, i + 1);
      return { n: i + 1, marks: r.ok ? r.marks : [] };
    });
    expect(findConflicts(patterns, 0.15)).toEqual([]);
  });
});

describe('center-hole zero variant', () => {
  it('marks a zero digit with a center hole so both ears are punched', () => {
    expect(desc(jaxZero, 7)).toBe('L: center hole; R: 2 top notches');
    expect(desc(jaxZero, 70)).toBe('L: 2 top notches; R: center hole');
    expect(maxContiguous(jaxZero)).toBe(99);
  });
});

describe('universal 1–399', () => {
  it('adds center holes for hundreds', () => {
    expect(desc(u399, 100)).toBe('L: none; R: center hole');
    expect(desc(u399, 200)).toBe('L: center hole; R: none');
    expect(desc(u399, 345)).toBe('L: top notch, center hole; R: outer notch, center hole');
    expect(maxContiguous(u399)).toBe(399);
    expect(marksForNumber(u399, 400).ok).toBe(false);
  });
});

describe('custom schemes', () => {
  it('copies a built-in scheme as an independent editable scheme', () => {
    const c = copyScheme(jax, 'c1', 'Lab scheme', 1);
    expect(c.builtIn).toBe(false);
    c.places[0].digits[1] = [];
    expect(jax.places[0].digits[1]).toHaveLength(1);
  });

  it('reports numbers that use an undefined digit', () => {
    const b = blankScheme('b', 1);
    b.places[0].digits[1] = [{ ear: 'R', type: 'hole', u: 0.5, v: 0.5 }];
    expect(marksForNumber(b, 1).ok).toBe(true);
    const r = marksForNumber(b, 2);
    expect(r.ok).toBe(false);
    expect(maxContiguous(b)).toBe(1);
  });
});
