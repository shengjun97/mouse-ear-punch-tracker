import type { Animal, Experiment, Group, Pattern, PatternTemplate } from '../domain/models';
import type { NumberingScheme } from '../domain/numbering';

/** Full or per-experiment backup file. Everything needed to restore on another device. */
export interface Backup {
  app: 'ear-punch-tracker';
  format: 1;
  exportedAt: string;
  experiments: Experiment[];
  groups: Group[];
  patterns: Pattern[];
  animals: Animal[];
  templates: PatternTemplate[];
  schemes: NumberingScheme[];
}

export type BackupData = Omit<Backup, 'app' | 'format' | 'exportedAt'>;

export function makeBackup(data: BackupData, now = new Date()): Backup {
  return { app: 'ear-punch-tracker', format: 1, exportedAt: now.toISOString(), ...data };
}

export class BackupError extends Error {}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (o: Record<string, unknown>, k: string) => typeof o[k] === 'string';
const num = (o: Record<string, unknown>, k: string) => typeof o[k] === 'number' && Number.isFinite(o[k]);

function checkMarks(marks: unknown, where: string) {
  if (!Array.isArray(marks)) throw new BackupError(`${where}: marks must be a list.`);
  marks.forEach((m, i) => {
    if (!isObj(m) || (m.ear !== 'L' && m.ear !== 'R') || (m.type !== 'hole' && m.type !== 'notch') || !num(m, 'u') || !num(m, 'v'))
      throw new BackupError(`${where}: mark ${i + 1} is not valid.`);
  });
}

function list(o: Record<string, unknown>, key: string, optional = false): Record<string, unknown>[] {
  const v = o[key];
  if (v === undefined && optional) return [];
  if (!Array.isArray(v)) throw new BackupError(`The file has no "${key}" list.`);
  v.forEach((x, i) => {
    if (!isObj(x) || !str(x, 'id')) throw new BackupError(`${key} entry ${i + 1} has no id.`);
  });
  return v as Record<string, unknown>[];
}

/**
 * Parse and check a backup file. Throws BackupError with a readable message.
 * References between records are checked so a restore can't leave orphans.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't valid JSON.");
  }
  if (!isObj(raw) || raw.app !== 'ear-punch-tracker') throw new BackupError("This file isn't an Ear Punch Tracker backup.");
  if (raw.format !== 1) throw new BackupError(`Unsupported backup format: ${String(raw.format)}.`);

  const experiments = list(raw, 'experiments');
  const groups = list(raw, 'groups');
  const patterns = list(raw, 'patterns');
  const animals = list(raw, 'animals', true);
  const templates = list(raw, 'templates', true);
  const schemes = list(raw, 'schemes', true);

  const expIds = new Set(experiments.map((e) => e.id as string));
  const groupIds = new Set(groups.map((g) => g.id as string));
  const patternIds = new Set(patterns.map((p) => p.id as string));

  for (const e of experiments) if (!str(e, 'name')) throw new BackupError(`Experiment ${String(e.id)} has no name.`);
  for (const g of groups) {
    if (!expIds.has(g.experimentId as string)) throw new BackupError(`Group "${String(g.name)}" belongs to a missing experiment.`);
  }
  for (const p of patterns) {
    if (!groupIds.has(p.groupId as string) || !expIds.has(p.experimentId as string))
      throw new BackupError(`Pattern "${String(p.label)}" belongs to a missing group or experiment.`);
    checkMarks(p.marks, `Pattern "${String(p.label)}"`);
  }
  for (const a of animals) {
    if (!expIds.has(a.experimentId as string)) throw new BackupError(`Animal ${String(a.animalCode)} belongs to a missing experiment.`);
    if (a.patternId !== undefined && a.patternId !== null && !patternIds.has(a.patternId as string))
      throw new BackupError(`Animal ${String(a.animalCode)} points to a missing pattern.`);
  }
  for (const t of templates) {
    if (!str(t, 'name') || !Array.isArray(t.groups)) throw new BackupError(`Template ${String(t.id)} is not valid.`);
    for (const g of t.groups as unknown[]) {
      if (!isObj(g) || !Array.isArray(g.patterns)) throw new BackupError(`Template "${String(t.name)}" has an invalid group.`);
      for (const p of g.patterns as unknown[]) {
        if (!isObj(p)) throw new BackupError(`Template "${String(t.name)}" has an invalid pattern.`);
        checkMarks(p.marks, `Template "${String(t.name)}"`);
      }
    }
  }
  for (const sc of schemes) {
    if (!str(sc, 'name') || !Array.isArray(sc.places)) throw new BackupError(`Numbering scheme ${String(sc.id)} is not valid.`);
    for (const pl of sc.places as unknown[]) {
      if (!isObj(pl) || ![1, 10, 100].includes(pl.value as number) || !isObj(pl.digits))
        throw new BackupError(`Numbering scheme "${String(sc.name)}" has an invalid digit place.`);
      for (const marks of Object.values(pl.digits)) checkMarks(marks, `Numbering scheme "${String(sc.name)}"`);
      if (pl.zero !== undefined) checkMarks(pl.zero, `Numbering scheme "${String(sc.name)}"`);
    }
  }
  return raw as unknown as Backup;
}

export interface MergePlan {
  add: BackupData;
  skipped: number;
}

/** Records in the backup whose ids are not already on this device. */
export function planMerge(backup: BackupData, existing: Record<keyof BackupData, ReadonlySet<string>>): MergePlan {
  let skipped = 0;
  const pick = <T extends { id: string }>(xs: T[], have: ReadonlySet<string>) =>
    xs.filter((x) => {
      if (have.has(x.id)) {
        skipped++;
        return false;
      }
      return true;
    });
  return {
    add: {
      experiments: pick(backup.experiments, existing.experiments),
      groups: pick(backup.groups, existing.groups),
      patterns: pick(backup.patterns, existing.patterns),
      animals: pick(backup.animals, existing.animals),
      templates: pick(backup.templates, existing.templates),
      schemes: pick(backup.schemes, existing.schemes),
    },
    skipped,
  };
}

export function backupSummary(d: BackupData): string {
  return `${d.experiments.length} experiments, ${d.groups.length} groups, ${d.patterns.length} patterns, ${d.animals.length} animals, ${d.templates.length} templates, ${d.schemes.length} numbering schemes`;
}
