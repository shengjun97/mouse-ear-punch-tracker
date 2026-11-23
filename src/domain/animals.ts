import { classifySimilarity, comparePatterns } from './matching';
import type { Animal, AnimalStatus, Group, Pattern, Sex } from './models';
import { fieldsMatch, norm, parseQuery, wordsMatch } from './search';

export const STATUS_LABEL: Record<AnimalStatus, string> = { alive: 'Alive', excluded: 'Excluded', endpoint: 'Endpoint' };
export const SEX_LABEL: Record<Sex, string> = { M: 'Male', F: 'Female', unknown: 'Unknown' };
export const NO_CAGE = '';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
/** "C2" before "C10", case-insensitive. */
export const naturalCompare = (a: string, b: string) => collator.compare(a, b);

export type AnimalDraft = Omit<Animal, 'id' | 'experimentId'>;

export function emptyAnimal(groupId = ''): AnimalDraft {
  return { groupId, patternId: undefined, animalCode: '', cage: '', sex: 'unknown', strain: '', genotype: '', dob: undefined, punchDate: undefined, status: 'alive', notes: '' };
}

export interface Validation {
  errors: Partial<Record<'animalCode' | 'groupId', string>>;
  warnings: string[];
}

/** Checks before saving an animal. `others` are the experiment's other animals. */
export function validateAnimal(a: AnimalDraft, others: readonly Pick<Animal, 'animalCode'>[]): Validation {
  const errors: Validation['errors'] = {};
  const warnings: string[] = [];
  const code = a.animalCode.trim();
  if (!code) errors.animalCode = 'Enter an animal ID.';
  else if (others.some((o) => o.animalCode.trim().toLocaleLowerCase() === code.toLocaleLowerCase()))
    errors.animalCode = `${code} is already used in this experiment.`;
  if (!a.groupId) errors.groupId = 'Choose a group.';
  if (a.dob && a.punchDate && a.punchDate < a.dob) warnings.push('Punch date is before the date of birth.');
  const today = new Date().toISOString().slice(0, 10);
  if (a.dob && a.dob > today) warnings.push('Date of birth is in the future.');
  return { errors, warnings };
}

export interface AnimalFilter {
  query: string;
  statuses: readonly AnimalStatus[];
  groupIds: readonly string[];
}

/** Text an animal can be found by: ID, cage, group, pattern, genotype, strain, notes. */
export function animalSearchText(a: Animal, group?: Group, pattern?: Pattern): string {
  return norm(
    [`animal ${a.animalCode}`, `cage ${a.cage}`, group?.name ?? '', pattern?.label ?? '', a.genotype, a.strain, a.notes, STATUS_LABEL[a.status], SEX_LABEL[a.sex]].join(
      ' \u0001 ',
    ),
  );
}

export function filterAnimals(
  animals: readonly Animal[],
  groups: readonly Group[],
  patterns: readonly Pattern[],
  f: AnimalFilter,
): Animal[] {
  const g = new Map(groups.map((x) => [x.id, x]));
  const p = new Map(patterns.map((x) => [x.id, x]));
  const q = parseQuery(f.query);
  return animals
    .filter((a) => f.statuses.length === 0 || f.statuses.includes(a.status))
    .filter((a) => f.groupIds.length === 0 || f.groupIds.includes(a.groupId))
    .filter((a) => fieldsMatch(q, a))
    .filter((a) => !q.words.length || wordsMatch(q, animalSearchText(a, g.get(a.groupId), a.patternId ? p.get(a.patternId) : undefined)))
    .sort((a, b) => naturalCompare(a.cage, b.cage) || naturalCompare(a.animalCode, b.animalCode));
}

export interface CageGroup {
  cage: string;
  animals: Animal[];
}

/** Animals by cage, cages in natural order, animals without a cage last. */
export function groupByCage(animals: readonly Animal[]): CageGroup[] {
  const m = new Map<string, Animal[]>();
  for (const a of animals) {
    const k = a.cage.trim();
    m.set(k, [...(m.get(k) ?? []), a]);
  }
  return [...m.entries()]
    .sort(([a], [b]) => (a === NO_CAGE ? 1 : b === NO_CAGE ? -1 : naturalCompare(a, b)))
    .map(([cage, list]) => ({ cage, animals: list.sort((x, y) => naturalCompare(x.animalCode, y.animalCode)) }));
}

export interface CageConflict {
  cage: string;
  a: Animal;
  b: Animal;
  kind: 'same-pattern' | 'identical' | 'confusable';
  maxPairDistance: number;
}

/**
 * Pairs of live animals in the same cage that cannot be told apart by their
 * ear marks: they share a pattern, or their patterns are identical/confusable.
 * Only meaningful when each pattern identifies one animal.
 */
export function cageConflicts(animals: readonly Animal[], patterns: readonly Pattern[], threshold: number): CageConflict[] {
  const p = new Map(patterns.map((x) => [x.id, x]));
  const out: CageConflict[] = [];
  for (const { cage, animals: list } of groupByCage(animals.filter((a) => a.status === 'alive'))) {
    if (cage === NO_CAGE) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.patternId || !b.patternId) continue;
        if (a.patternId === b.patternId) {
          out.push({ cage, a, b, kind: 'same-pattern', maxPairDistance: 0 });
          continue;
        }
        const pa = p.get(a.patternId);
        const pb = p.get(b.patternId);
        if (!pa || !pb) continue;
        const kind = classifySimilarity(pa.marks, pb.marks, threshold);
        if (kind !== 'distinct')
          out.push({ cage, a, b, kind, maxPairDistance: comparePatterns(pa.marks, pb.marks).maxPairDistance });
      }
    }
  }
  return out;
}

/** Animals per pattern id (for "used by" lists). */
export function animalsByPattern(animals: readonly Animal[]): Map<string, Animal[]> {
  const m = new Map<string, Animal[]>();
  for (const a of animals) {
    if (!a.patternId) continue;
    m.set(a.patternId, [...(m.get(a.patternId) ?? []), a]);
  }
  for (const list of m.values()) list.sort((x, y) => naturalCompare(x.animalCode, y.animalCode));
  return m;
}
