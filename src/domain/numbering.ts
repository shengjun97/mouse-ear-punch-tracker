import { fromCentered, roundUV } from './geometry';
import type { EarSide, MarkSpec } from './types';
import { ZONE_BY_ID, zonePosition, type ZoneId } from './zones';

/**
 * Ear punch numbering schemes: each decimal place (units, tens, hundreds)
 * maps digits to a set of marks; a number is the union of its digits' marks.
 */
export type PlaceValue = 1 | 10 | 100;

export interface NumberingPlace {
  value: PlaceValue;
  /** Marks for digits 1..9 (missing = digit not available). */
  digits: Partial<Record<number, MarkSpec[]>>;
  /** Optional marks used when this digit is 0 (e.g. JAX center hole). */
  zero?: MarkSpec[];
}

export interface NumberingScheme {
  id: string;
  name: string;
  builtIn: boolean;
  description: string;
  source?: string;
  places: NumberingPlace[];
  createdAt?: number;
  updatedAt?: number;
}

export const PLACE_LABEL: Record<PlaceValue, string> = { 1: 'Units (1–9)', 10: 'Tens (10–90)', 100: 'Hundreds' };

// ---- Mark builders used by the built-in schemes --------------------------

const hole = (ear: EarSide, zone: ZoneId): MarkSpec => ({ ear, type: 'hole', ...roundUV(zonePosition(zone, 'hole')) });
const notch = (ear: EarSide, zone: ZoneId): MarkSpec => ({ ear, type: 'notch', ...roundUV(zonePosition(zone, 'notch')) });
/** Point on the ear edge at an angle (0 = top, 90 = outer, 180 = bottom). */
const edgeAt = (ear: EarSide, deg: number): MarkSpec => {
  const r = (deg * Math.PI) / 180;
  return { ear, type: 'notch', ...roundUV(fromCentered(Math.sin(r), -Math.cos(r))) };
};
/** Two notches side by side around a zone (double notch). */
const doubleNotch = (ear: EarSide, zone: ZoneId, spread = 14): MarkSpec[] => {
  const a = ZONE_BY_ID[zone].angle ?? 0;
  return [edgeAt(ear, a - spread), edgeAt(ear, a + spread)];
};

/** 1–9 on one ear, laid out as in JAX Green Book Fig. 3-2 (dorsal view). */
function jaxDigits(ear: EarSide): Partial<Record<number, MarkSpec[]>> {
  return {
    1: [hole(ear, 'top')],
    2: [hole(ear, 'outer')],
    3: [hole(ear, 'bottom')],
    4: [notch(ear, 'top')],
    5: [notch(ear, 'outer')],
    6: [notch(ear, 'bottom')],
    7: doubleNotch(ear, 'top'),
    8: doubleNotch(ear, 'outer'),
    9: doubleNotch(ear, 'bottom'),
  };
}

const JAX_SOURCE =
  'JAX Green Book, chapter 3, Figure 3-2 (informatics.jax.org/greenbook/chapters/chapter3.shtml). Positions approximated from the published diagram.';

export const BUILT_IN_SCHEMES: readonly NumberingScheme[] = [
  {
    id: 'builtin-jax-99',
    name: 'Universal 1–99 (JAX)',
    builtIn: true,
    description:
      'Right ear = units, left ear = tens. Holes 1/2/3 (top/outer/bottom), notches 4/5/6, double notches 7/8/9. Two-digit numbers combine both ears.',
    source: JAX_SOURCE,
    places: [
      { value: 1, digits: jaxDigits('R') },
      { value: 10, digits: jaxDigits('L') },
    ],
  },
  {
    id: 'builtin-jax-99-zero',
    name: 'Universal 1–99 with center-hole zero (JAX)',
    builtIn: true,
    description:
      'As the 1–99 scheme, plus a center hole for a 0 digit, so both ears are always punched (07 vs 70).',
    source: JAX_SOURCE,
    places: [
      { value: 1, digits: jaxDigits('R'), zero: [hole('R', 'center')] },
      { value: 10, digits: jaxDigits('L'), zero: [hole('L', 'center')] },
    ],
  },
  {
    id: 'builtin-universal-399',
    name: 'Universal 1–399 (center holes = hundreds)',
    builtIn: true,
    description:
      'As the 1–99 scheme, plus center holes for hundreds: right = 100, left = 200, both = 300.',
    source:
      "Queen's University UACC SOP 7.13, Ear Notching for Identification in Mice (universal numbering system). Positions approximated from the published diagram.",
    places: [
      { value: 1, digits: jaxDigits('R') },
      { value: 10, digits: jaxDigits('L') },
      { value: 100, digits: { 1: [hole('R', 'center')], 2: [hole('L', 'center')], 3: [hole('R', 'center'), hole('L', 'center')] } },
    ],
  },
];

export type NumberResult = { ok: true; marks: MarkSpec[] } | { ok: false; reason: string };

/** Marks for a whole number under a scheme, or why it can't be represented. */
export function marksForNumber(s: NumberingScheme, n: number): NumberResult {
  if (!Number.isInteger(n) || n < 1) return { ok: false, reason: 'Numbers start at 1.' };
  const places = [...s.places].sort((a, b) => b.value - a.value);
  if (places.length === 0) return { ok: false, reason: 'The scheme has no digits defined.' };
  const marks: MarkSpec[] = [];
  let covered = 0;
  places.forEach((p, i) => {
    // The highest place takes everything above it (to detect overflow).
    const d = i === 0 ? Math.floor(n / p.value) : Math.floor(n / p.value) % 10;
    if (d === 0) {
      if (p.zero) marks.push(...p.zero);
      return;
    }
    const m = p.digits[d];
    if (!m || m.length === 0) {
      covered = NaN;
      return;
    }
    marks.push(...m);
    covered += d * p.value;
  });
  if (Number.isNaN(covered) || covered !== n) return { ok: false, reason: `${n} can't be made with this scheme.` };
  return { ok: true, marks: marks.map((m) => ({ ...m })) };
}

/** Largest n such that every number 1..n can be represented. */
export function maxContiguous(s: NumberingScheme, limit = 9999): number {
  let n = 0;
  while (n < limit && marksForNumber(s, n + 1).ok) n++;
  return n;
}

/** Deep copy as an editable custom scheme. */
export function copyScheme(s: NumberingScheme, id: string, name: string, now: number): NumberingScheme {
  return {
    ...structuredClone(s),
    id,
    name,
    builtIn: false,
    source: s.source ? `Based on: ${s.name}. ${s.source}` : `Based on: ${s.name}.`,
    createdAt: now,
    updatedAt: now,
  };
}

export function blankScheme(id: string, now: number): NumberingScheme {
  return {
    id,
    name: 'My numbering scheme',
    builtIn: false,
    description: '',
    places: [
      { value: 1, digits: {} },
      { value: 10, digits: {} },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
