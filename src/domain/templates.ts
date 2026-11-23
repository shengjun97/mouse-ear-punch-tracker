import type { ExperimentBundle } from './clone';
import type { PatternTemplate } from './models';
import { marksForNumber, type NumberingScheme } from './numbering';
import type { MarkSpec } from './types';

const stripIds = (marks: readonly { ear: MarkSpec['ear']; type: MarkSpec['type']; u: number; v: number }[]): MarkSpec[] =>
  marks.map(({ ear, type, u, v }) => ({ ear, type, u, v }));

/** Snapshot of an experiment's groups and patterns as a reusable template. */
export function templateFromExperiment(b: ExperimentBundle, id: string, name: string, now: number): PatternTemplate {
  return {
    id,
    name,
    description: `${b.groups.length} groups, ${b.patterns.length} patterns, from "${b.experiment.name}"`,
    createdAt: now,
    groups: b.groups.map((g) => ({
      name: g.name,
      color: g.color,
      notes: g.notes,
      patterns: b.patterns
        .filter((p) => p.groupId === g.id)
        .map((p) => ({ label: p.label, color: p.color, notes: p.notes, marks: stripIds(p.marks) })),
    })),
  };
}

export interface NumberedPlan {
  ok: { n: number; label: string; marks: MarkSpec[] }[];
  unsupported: { n: number; reason: string }[];
}

/** Patterns for numbers from..to under a scheme; reports numbers it can't make. */
export function planNumbered(s: NumberingScheme, from: number, to: number, prefix = ''): NumberedPlan {
  const plan: NumberedPlan = { ok: [], unsupported: [] };
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return plan;
  for (let n = from; n <= to; n++) {
    const r = marksForNumber(s, n);
    if (r.ok) plan.ok.push({ n, label: `${prefix}${n}`, marks: r.marks });
    else plan.unsupported.push({ n, reason: r.reason });
  }
  return plan;
}

/** Hard cap so a typo can't create thousands of patterns. */
export const MAX_NUMBERED = 400;
