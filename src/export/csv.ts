import { naturalCompare } from '../domain/animals';
import { describePattern } from '../domain/describe';
import type { Animal, Group, Pattern } from '../domain/models';

/**
 * RFC 4180 field: quote when needed, double inner quotes. Neutralizes values a
 * spreadsheet would run as a formula (=..., @..., +A1, -SUM(...)) while leaving
 * genotypes such as "+/-" or "-/-" untouched.
 */
export function csvField(v: string | number | undefined | null): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^(=|@|\t|\r|[+-](?=[A-Za-z(]))/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const ANIMAL_CSV_COLUMNS = [
  'animal_id',
  'cage',
  'group',
  'pattern',
  'ear_marks',
  'sex',
  'strain',
  'genotype',
  'date_of_birth',
  'punch_date',
  'status',
  'notes',
] as const;

export function animalsCsv(animals: readonly Animal[], groups: readonly Group[], patterns: readonly Pattern[]): string {
  const g = new Map(groups.map((x) => [x.id, x]));
  const p = new Map(patterns.map((x) => [x.id, x]));
  const rows = [...animals]
    .sort((a, b) => naturalCompare(a.cage, b.cage) || naturalCompare(a.animalCode, b.animalCode))
    .map((a) => {
      const pat = a.patternId ? p.get(a.patternId) : undefined;
      return [
        a.animalCode,
        a.cage,
        g.get(a.groupId)?.name ?? '',
        pat?.label ?? '',
        pat ? describePattern(pat.marks) : '',
        a.sex,
        a.strain,
        a.genotype,
        a.dob ?? '',
        a.punchDate ?? '',
        a.status,
        a.notes,
      ];
    });
  return [ANIMAL_CSV_COLUMNS as readonly string[], ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}
