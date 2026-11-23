import { MARK_GROUPS, optimalAssignment, UNMATCHED_COST } from './matching';
import type { EarSide, MarkSpec, MarkType } from './types';
import { ZONE_BY_ID, zoneOf, type ZoneId } from './zones';

/**
 * Lookup: rank the patterns of an experiment against the marks seen on an
 * animal, and explain how each candidate differs from what was entered.
 * Holes and notches, and left and right ears, are never matched to each other.
 */

/** Default tolerance for imprecise taps (normalized ear units). */
export const DEFAULT_LOOKUP_TOLERANCE = 0.25;

export type LookupKind =
  /** Same marks, every one within the tolerance. */
  | 'match'
  /** Same number of holes and notches per ear, but some in a different spot. */
  | 'same-marks'
  /** Different number of holes or notches. */
  | 'partial';

export type Difference =
  /** The pattern has this mark but it was not entered. */
  | { kind: 'missing'; ear: EarSide; type: MarkType; zone: ZoneId }
  /** Entered, but the pattern has no such mark. */
  | { kind: 'extra'; ear: EarSide; type: MarkType; zone: ZoneId }
  /** Both have the mark, but it is further away than the tolerance. */
  | { kind: 'moved'; ear: EarSide; type: MarkType; zone: ZoneId; observedZone: ZoneId; distance: number };

export interface LookupHit<T> {
  item: T;
  kind: LookupKind;
  cost: number;
  differences: Difference[];
}

const KIND_RANK: Record<LookupKind, number> = { match: 0, 'same-marks': 1, partial: 2 };

export function compareForLookup(observed: readonly MarkSpec[], pattern: readonly MarkSpec[], tolerance: number) {
  const differences: Difference[] = [];
  let cost = 0;
  let sameCounts = true;
  for (const [ear, type] of MARK_GROUPS) {
    const o = observed.filter((m) => m.ear === ear && m.type === type);
    const p = pattern.filter((m) => m.ear === ear && m.type === type);
    if (o.length !== p.length) sameCounts = false;
    const pairs = optimalAssignment(o, p);
    const usedO = new Set(pairs.map((x) => x.ai));
    const usedP = new Set(pairs.map((x) => x.bi));
    for (const x of pairs) {
      cost += x.d;
      if (x.d > tolerance)
        differences.push({
          kind: 'moved',
          ear,
          type,
          zone: zoneOf(p[x.bi], type),
          observedZone: zoneOf(o[x.ai], type),
          distance: x.d,
        });
    }
    p.forEach((m, i) => {
      if (usedP.has(i)) return;
      cost += UNMATCHED_COST;
      differences.push({ kind: 'missing', ear, type, zone: zoneOf(m, type) });
    });
    o.forEach((m, i) => {
      if (usedO.has(i)) return;
      cost += UNMATCHED_COST;
      differences.push({ kind: 'extra', ear, type, zone: zoneOf(m, type) });
    });
  }
  const kind: LookupKind = !sameCounts ? 'partial' : differences.length === 0 ? 'match' : 'same-marks';
  return { kind, cost, differences };
}

/** Candidates best-first: matches, then same marks elsewhere, then partial; ties by cost. */
export function lookup<T extends { marks: readonly MarkSpec[] }>(
  observed: readonly MarkSpec[],
  candidates: readonly T[],
  tolerance = DEFAULT_LOOKUP_TOLERANCE,
): LookupHit<T>[] {
  return candidates
    .map((item) => ({ item, ...compareForLookup(observed, item.marks, tolerance) }))
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.cost - b.cost);
}

const markName = (ear: EarSide, type: MarkType, zone: ZoneId) => `${ear} ${ZONE_BY_ID[zone].label} ${type}`;

/** Short readable explanation, e.g. "missing R top notch". */
export function describeDifference(d: Difference): string {
  switch (d.kind) {
    case 'missing':
      return `also has ${markName(d.ear, d.type, d.zone)}`;
    case 'extra':
      return `has no ${markName(d.ear, d.type, d.zone)}`;
    case 'moved':
      return d.zone === d.observedZone
        ? `${markName(d.ear, d.type, d.zone)} in a slightly different spot`
        : `${markName(d.ear, d.type, d.zone)}, not ${ZONE_BY_ID[d.observedZone].label}`;
  }
}
