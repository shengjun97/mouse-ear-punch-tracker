import { describe, expect, it } from 'vitest';
import {
  classifyPlacement,
  constrain,
  convertType,
  ellipticalRadius,
  HOLE_MAX_RADIUS,
  roundUV,
  toDrawing,
  toNormalized,
  type Box,
} from './geometry';
import { snapToZone, zoneOf, zonePosition } from './zones';

const box: Box = { x: 50, y: 138, w: 200, h: 224 };

describe('coordinate normalization', () => {
  it('maps the right ear box corners without mirroring', () => {
    expect(toNormalized('R', box, { x: 50, y: 138 })).toEqual({ u: 0, v: 0 });
    expect(toNormalized('R', box, { x: 250, y: 362 })).toEqual({ u: 1, v: 1 });
  });

  it('mirrors the left ear so u = 0 is the medial side (screen right)', () => {
    expect(toNormalized('L', box, { x: 250, y: 138 })).toEqual({ u: 0, v: 0 });
    expect(toNormalized('L', box, { x: 50, y: 362 })).toEqual({ u: 1, v: 1 });
  });

  it('round-trips drawing <-> normalized for both ears', () => {
    for (const ear of ['L', 'R'] as const) {
      const uv = { u: 0.23, v: 0.71 };
      const back = toNormalized(ear, box, toDrawing(ear, box, uv));
      expect(back.u).toBeCloseTo(uv.u, 10);
      expect(back.v).toBeCloseTo(uv.v, 10);
    }
  });

  it('is independent of rendering size', () => {
    const big: Box = { x: 0, y: 0, w: 1000, h: 1120 };
    const uv = { u: 0.8, v: 0.3 };
    const p1 = toNormalized('R', box, toDrawing('R', box, uv));
    const p2 = toNormalized('R', big, toDrawing('R', big, uv));
    expect(p1.u).toBeCloseTo(p2.u, 10);
    expect(p1.v).toBeCloseTo(p2.v, 10);
  });

  it('gives elliptical radius 0 at centre and 1 on the outline', () => {
    expect(ellipticalRadius({ u: 0.5, v: 0.5 })).toBe(0);
    expect(ellipticalRadius({ u: 1, v: 0.5 })).toBeCloseTo(1);
    expect(ellipticalRadius({ u: 0.5, v: 0 })).toBeCloseTo(1);
  });

  it('rounds stored coordinates and clamps to the unit box', () => {
    expect(roundUV({ u: 0.123456, v: 1.0000001 })).toEqual({ u: 0.1235, v: 1 });
  });
});

describe('placement', () => {
  it('creates a hole well inside the ear', () => {
    expect(classifyPlacement({ u: 0.5, v: 0.5 })).toEqual({ type: 'hole', uv: { u: 0.5, v: 0.5 } });
  });

  it('snaps a tap near the edge onto the edge as a notch', () => {
    const r = classifyPlacement({ u: 0.5, v: 0.06 });
    expect(r?.type).toBe('notch');
    expect(ellipticalRadius(r!.uv)).toBeCloseTo(1);
  });

  it('accepts taps slightly outside the ear and ignores far ones', () => {
    expect(classifyPlacement({ u: 1.05, v: 0.5 })?.type).toBe('notch');
    expect(classifyPlacement({ u: 2, v: 0.5 })).toBeNull();
  });

  it('keeps holes away from the edge and notches on it', () => {
    expect(ellipticalRadius(constrain({ u: 0.98, v: 0.5 }, 'hole'))).toBeCloseTo(HOLE_MAX_RADIUS);
    expect(ellipticalRadius(constrain({ u: 0.6, v: 0.5 }, 'notch'))).toBeCloseTo(1);
  });

  it('sends a centre hole to the top edge when it becomes a notch', () => {
    expect(convertType({ u: 0.52, v: 0.56 }, 'notch')).toEqual({ u: 0.5, v: 0 });
  });

  it('moves a notch inward when converted to a hole and back out again', () => {
    const hole = convertType({ u: 1, v: 0.5 }, 'hole');
    expect(ellipticalRadius(hole)).toBeLessThan(HOLE_MAX_RADIUS + 1e-9);
    expect(ellipticalRadius(convertType(hole, 'notch'))).toBeCloseTo(1);
  });
});

describe('zones', () => {
  it('names directions anatomically (top = toward the nose)', () => {
    expect(zoneOf({ u: 0.5, v: 0 }, 'notch')).toBe('top');
    expect(zoneOf({ u: 1, v: 0.5 }, 'notch')).toBe('outer');
    expect(zoneOf({ u: 0, v: 0.5 }, 'notch')).toBe('inner');
    expect(zoneOf({ u: 0.5, v: 1 }, 'notch')).toBe('bottom');
    expect(zoneOf({ u: 0.52, v: 0.5 }, 'hole')).toBe('center');
  });

  it('never calls a notch "center"', () => {
    expect(zoneOf({ u: 0.5, v: 0.5 }, 'notch')).not.toBe('center');
  });

  it('snaps to canonical zone positions', () => {
    expect(snapToZone({ u: 0.93, v: 0.45 }, 'notch')).toEqual(zonePosition('outer', 'notch'));
    expect(snapToZone({ u: 0.55, v: 0.47 }, 'hole')).toEqual({ u: 0.5, v: 0.5 });
  });
});
