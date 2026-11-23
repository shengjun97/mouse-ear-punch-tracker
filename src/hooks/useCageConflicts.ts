import { useMemo } from 'react';
import { cageConflicts, type CageConflict } from '../domain/animals';
import type { Animal, Experiment, Pattern } from '../domain/models';

/**
 * Animals in the same cage that cannot be told apart by ear marks.
 * In group mode, animals of the same group share a pattern by design, so only
 * animals from different groups with identical/confusable patterns are flagged.
 */
export function useCageConflicts(experiment: Experiment | undefined, animals: Animal[], patterns: Pattern[]): CageConflict[] {
  return useMemo(() => {
    if (!experiment) return [];
    const all = cageConflicts(animals, patterns, experiment.similarityThreshold);
    if (experiment.patternMode === 'individual') return all;
    return all.filter((c) => c.a.groupId !== c.b.groupId);
  }, [experiment, animals, patterns]);
}

export function describeCageConflict(c: CageConflict): string {
  const what =
    c.kind === 'same-pattern' ? 'have the same pattern' : c.kind === 'identical' ? 'have identical marks' : 'have very similar marks';
  return `${c.a.animalCode} and ${c.b.animalCode} ${what}`;
}
