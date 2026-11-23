import { distance } from './geometry';
import type { EarSide, MarkSpec, MarkType } from './types';

/**
 * Pattern comparison. Holes and notches are different kinds of mark and are
 * never matched to each other; marks are only compared within the same ear
 * and the same type.
 */

/** Cost charged for each mark that has no counterpart in the other pattern. */
export const UNMATCHED_COST = 1;
/** Matched pairs closer than this are treated as the same position. */
export const IDENTICAL_DISTANCE = 0.03;
/** Default distance below which marks could be confused on a real ear. */
export const DEFAULT_CONFUSION_THRESHOLD = 0.15;

export const MARK_GROUPS: ReadonlyArray<[EarSide, MarkType]> = [
  ['L', 'notch'],
  ['L', 'hole'],
  ['R', 'notch'],
  ['R', 'hole'],
];

export interface GroupMatch {
  ear: EarSide;
  type: MarkType;
  countA: number;
  countB: number;
  /** Distances of optimally matched pairs. */
  pairDistances: number[];
}

export interface PatternComparison {
  groups: GroupMatch[];
  /** Every ear/type group has the same number of marks in both patterns. */
  sameCounts: boolean;
  /** Largest matched distance (0 when there are no marks). */
  maxPairDistance: number;
  /** Sum of matched distances plus UNMATCHED_COST per unmatched mark. */
  cost: number;
}

export interface Pair {
  /** Index into the first set. */
  ai: number;
  /** Index into the second set. */
  bi: number;
  d: number;
}

/**
 * Minimum-cost matching between two small point sets. Each point of the
 * smaller set is paired with a distinct point of the larger one. Exhaustive
 * search is exact; sets above `exactLimit` fall back to a greedy match.
 */
export function optimalAssignment(a: readonly MarkSpec[], b: readonly MarkSpec[], exactLimit = 8): Pair[] {
  const swap = a.length > b.length;
  const [small, large] = swap ? [b, a] : [a, b];
  if (small.length === 0) return [];
  const d = small.map((p) => large.map((q) => distance(p, q)));
  const toPair = (i: number, j: number): Pair => (swap ? { ai: j, bi: i, d: d[i][j] } : { ai: i, bi: j, d: d[i][j] });

  if (large.length > exactLimit) {
    const used = new Set<number>();
    return d.map((row, i) => {
      let bj = -1;
      for (let j = 0; j < row.length; j++) if (!used.has(j) && (bj < 0 || row[j] < row[bj])) bj = j;
      used.add(bj);
      return toPair(i, bj);
    });
  }

  let best = Infinity;
  let bestPicks: number[] = [];
  const picks: number[] = [];
  const used = new Array<boolean>(large.length).fill(false);
  const search = (i: number, acc: number) => {
    if (acc >= best) return;
    if (i === small.length) {
      best = acc;
      bestPicks = picks.slice();
      return;
    }
    for (let j = 0; j < large.length; j++) {
      if (used[j]) continue;
      used[j] = true;
      picks.push(j);
      search(i + 1, acc + d[i][j]);
      picks.pop();
      used[j] = false;
    }
  };
  search(0, 0);
  return bestPicks.map((j, i) => toPair(i, j));
}

/** Distances of the optimal pairs (see optimalAssignment). */
export function optimalPairs(a: readonly MarkSpec[], b: readonly MarkSpec[], exactLimit = 8): number[] {
  return optimalAssignment(a, b, exactLimit).map((p) => p.d);
}

export function comparePatterns(a: readonly MarkSpec[], b: readonly MarkSpec[]): PatternComparison {
  const groups: GroupMatch[] = [];
  let sameCounts = true;
  let maxPairDistance = 0;
  let cost = 0;
  for (const [ear, type] of MARK_GROUPS) {
    const ga = a.filter((m) => m.ear === ear && m.type === type);
    const gb = b.filter((m) => m.ear === ear && m.type === type);
    const pairDistances = optimalPairs(ga, gb);
    if (ga.length !== gb.length) sameCounts = false;
    for (const pd of pairDistances) maxPairDistance = Math.max(maxPairDistance, pd);
    cost += pairDistances.reduce((s, x) => s + x, 0) + Math.abs(ga.length - gb.length) * UNMATCHED_COST;
    groups.push({ ear, type, countA: ga.length, countB: gb.length, pairDistances });
  }
  return { groups, sameCounts, maxPairDistance, cost };
}

export type Similarity = 'identical' | 'confusable' | 'distinct';

/**
 * Classify how easily two patterns could be mistaken for each other.
 * Patterns are only identical/confusable when every ear has the same number
 * of holes and the same number of notches and every matched pair is close.
 */
export function classifySimilarity(
  a: readonly MarkSpec[],
  b: readonly MarkSpec[],
  threshold = DEFAULT_CONFUSION_THRESHOLD,
): Similarity {
  const c = comparePatterns(a, b);
  if (!c.sameCounts) return 'distinct';
  if (c.maxPairDistance <= IDENTICAL_DISTANCE) return 'identical';
  if (c.maxPairDistance <= threshold) return 'confusable';
  return 'distinct';
}

export interface ConflictPair<T> {
  a: T;
  b: T;
  kind: Exclude<Similarity, 'distinct'>;
  maxPairDistance: number;
}

/** All pairs of patterns in a set that are identical or confusable. */
export function findConflicts<T extends { marks: readonly MarkSpec[] }>(
  patterns: readonly T[],
  threshold = DEFAULT_CONFUSION_THRESHOLD,
): ConflictPair<T>[] {
  const out: ConflictPair<T>[] = [];
  for (let i = 0; i < patterns.length; i++) {
    for (let j = i + 1; j < patterns.length; j++) {
      const kind = classifySimilarity(patterns[i].marks, patterns[j].marks, threshold);
      if (kind === 'distinct') continue;
      out.push({
        a: patterns[i],
        b: patterns[j],
        kind,
        maxPairDistance: comparePatterns(patterns[i].marks, patterns[j].marks).maxPairDistance,
      });
    }
  }
  return out;
}
