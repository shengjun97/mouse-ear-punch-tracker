import type { EarMark, MarkSpec } from './types';
import { DEFAULT_CONFUSION_THRESHOLD } from './matching';

/** Whether each pattern stands for a whole group or one animal in a group. */
export type PatternMode = 'group' | 'individual';

export interface Experiment {
  id: string;
  name: string;
  notes: string;
  patternMode: PatternMode;
  /** Normalized distance below which two marks could be confused. */
  similarityThreshold: number;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  experimentId: string;
  name: string;
  color: string;
  notes: string;
  order: number;
}

export interface Pattern {
  id: string;
  experimentId: string;
  groupId: string;
  /** Group name, or the animal's label in individual mode. */
  label: string;
  color: string;
  /** Empty array = "No punch". */
  marks: EarMark[];
  notes: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export type AnimalStatus = 'alive' | 'excluded' | 'endpoint';
export type Sex = 'M' | 'F' | 'unknown';

export interface Animal {
  id: string;
  experimentId: string;
  groupId: string;
  patternId?: string;
  animalCode: string;
  cage: string;
  sex: Sex;
  strain: string;
  genotype: string;
  dob?: string;
  punchDate?: string;
  status: AnimalStatus;
  notes: string;
}

/**
 * Colors chosen to stay distinguishable from each other and readable in
 * both themes. Color is never the only cue: labels are always shown.
 */
export const GROUP_COLORS: readonly { name: string; value: string }[] = [
  { name: 'Blue', value: '#378ADD' },
  { name: 'Coral', value: '#D85A30' },
  { name: 'Teal', value: '#1D9E75' },
  { name: 'Purple', value: '#7F77DD' },
  { name: 'Amber', value: '#BA7517' },
  { name: 'Pink', value: '#D4537E' },
  { name: 'Green', value: '#639922' },
  { name: 'Gray', value: '#5F5E5A' },
  { name: 'Red', value: '#E24B4A' },
  { name: 'Navy', value: '#0C447C' },
];

export function nextColor(used: readonly string[]): string {
  const free = GROUP_COLORS.find((c) => !used.includes(c.value));
  return (free ?? GROUP_COLORS[used.length % GROUP_COLORS.length]).value;
}

export function newExperimentDefaults(): Pick<Experiment, 'notes' | 'patternMode' | 'similarityThreshold'> {
  return { notes: '', patternMode: 'group', similarityThreshold: DEFAULT_CONFUSION_THRESHOLD };
}

/** A reusable set of groups and patterns saved by the user. */
export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  groups: {
    name: string;
    color: string;
    notes: string;
    patterns: { label: string; color: string; notes: string; marks: MarkSpec[] }[];
  }[];
}
