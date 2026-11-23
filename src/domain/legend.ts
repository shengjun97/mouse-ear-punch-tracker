import { describePattern } from './describe';
import type { Animal, Group, Pattern } from './models';
import { fieldsMatch, isEmptyQuery, norm, parseQuery, wordsMatch } from './search';

export interface LegendFilter {
  /** Free text; every word must match somewhere. */
  query: string;
  /** Empty = all groups. */
  groupIds: readonly string[];
}

export interface LegendEntry {
  pattern: Pattern;
  group: Group | undefined;
  description: string;
}

/** Text a legend entry can be found by, including the IDs and cages of its animals. */
export function searchableText(e: LegendEntry, animals: readonly Animal[] = []): string {
  return norm(
    [e.pattern.label, e.group?.name ?? '', e.description, e.pattern.notes, ...animals.map((a) => `animal ${a.animalCode} cage ${a.cage}`)].join(
      ' \u0001 ',
    ),
  );
}

/**
 * Legend entries in display order (group order, then pattern order),
 * filtered by group and by a free-text query.
 */
export function buildLegend(
  patterns: readonly Pattern[],
  groups: readonly Group[],
  filter: LegendFilter,
  animalsByPattern: ReadonlyMap<string, readonly Animal[]> = new Map(),
): LegendEntry[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const groupOrder = (p: Pattern) => byId.get(p.groupId)?.order ?? Number.MAX_SAFE_INTEGER;
  const q = parseQuery(filter.query);
  const groupSet = new Set(filter.groupIds);

  return [...patterns]
    .sort((a, b) => groupOrder(a) - groupOrder(b) || a.order - b.order)
    .map((pattern) => ({ pattern, group: byId.get(pattern.groupId), description: describePattern(pattern.marks) }))
    .filter((e) => groupSet.size === 0 || groupSet.has(e.pattern.groupId))
    .filter((e) => {
      if (isEmptyQuery(q)) return true;
      const animals = animalsByPattern.get(e.pattern.id) ?? [];
      // Cage/animal filters: at least one of the pattern's animals must match.
      if ((q.cages.length || q.animals.length) && !animals.some((a) => fieldsMatch(q, a))) return false;
      return wordsMatch(q, searchableText(e, animals));
    });
}

/** Split entries into consecutive runs per group, keeping order. */
export function groupEntries(entries: readonly LegendEntry[]): { group: Group | undefined; entries: LegendEntry[] }[] {
  const out: { group: Group | undefined; entries: LegendEntry[] }[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && last.group?.id === e.group?.id) last.entries.push(e);
    else out.push({ group: e.group, entries: [e] });
  }
  return out;
}
