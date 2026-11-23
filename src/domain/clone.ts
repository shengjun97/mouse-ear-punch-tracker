import { newId } from './ids';
import type { Experiment, Group, Pattern } from './models';
import type { EarMark } from './types';

export const cloneMarks = (marks: readonly EarMark[]): EarMark[] => marks.map((m) => ({ ...m, id: newId() }));

/** Copy of a pattern with fresh ids, placed in the same group by default. */
export function clonePattern(p: Pattern, now: number, overrides: Partial<Pattern> = {}): Pattern {
  return {
    ...p,
    id: newId(),
    label: `${p.label} (copy)`,
    marks: cloneMarks(p.marks),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export interface ExperimentBundle {
  experiment: Experiment;
  groups: Group[];
  patterns: Pattern[];
}

/**
 * Deep copy of an experiment's groups and patterns with fresh ids and the
 * references between them remapped. Animals are not copied: a duplicated
 * experiment is a starting point with the same pattern set.
 */
export function cloneExperiment(src: ExperimentBundle, name: string, now: number): ExperimentBundle {
  const experiment: Experiment = { ...src.experiment, id: newId(), name, createdAt: now, updatedAt: now };
  const groupIds = new Map<string, string>();
  const groups = src.groups.map((g) => {
    const id = newId();
    groupIds.set(g.id, id);
    return { ...g, id, experimentId: experiment.id };
  });
  const patterns = src.patterns
    .filter((p) => groupIds.has(p.groupId))
    .map((p) => ({
      ...p,
      id: newId(),
      experimentId: experiment.id,
      groupId: groupIds.get(p.groupId)!,
      marks: cloneMarks(p.marks),
      createdAt: now,
      updatedAt: now,
    }));
  return { experiment, groups, patterns };
}
