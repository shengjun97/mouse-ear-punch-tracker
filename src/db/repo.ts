import { cloneExperiment, clonePattern } from '../domain/clone';
import { newId } from '../domain/ids';
import type { AnimalDraft } from '../domain/animals';
import type { NumberingScheme } from '../domain/numbering';
import { templateFromExperiment } from '../domain/templates';
import type { MarkSpec } from '../domain/types';
import { planMerge, type Backup, type BackupData } from '../export/backup';
import {
  newExperimentDefaults,
  type Animal,
  type PatternTemplate,
  nextColor,
  type Experiment,
  type Group,
  type Pattern,
  type PatternMode,
} from '../domain/models';
import { db as defaultDb, type EarPunchDB } from './db';

/**
 * Data access. Every write also bumps the experiment's updatedAt so the
 * experiment list can sort by recent activity.
 */
/** Trim text fields and drop empty optional dates. */
function clean<T extends Partial<AnimalDraft>>(a: T): T {
  const out = { ...a };
  for (const k of ['animalCode', 'cage', 'strain', 'genotype'] as const) if (typeof out[k] === 'string') out[k] = out[k]!.trim() as never;
  if (out.dob === '') out.dob = undefined;
  if (out.punchDate === '') out.punchDate = undefined;
  if (out.patternId === '') out.patternId = undefined;
  return out;
}

export function createRepo(db: EarPunchDB = defaultDb, clock: () => number = Date.now) {
  const touch = (experimentId: string) => db.experiments.update(experimentId, { updatedAt: clock() });

  const sortByOrder = <T extends { order: number }>(xs: T[]) => xs.sort((a, b) => a.order - b.order);

  const repo = {
    async listExperiments(): Promise<Experiment[]> {
      return (await db.experiments.toArray()).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getBundle(experimentId: string) {
      const [experiment, groups, patterns, animals] = await Promise.all([
        db.experiments.get(experimentId),
        db.groups.where('experimentId').equals(experimentId).toArray(),
        db.patterns.where('experimentId').equals(experimentId).toArray(),
        db.animals.where('experimentId').equals(experimentId).toArray(),
      ]);
      if (!experiment) return undefined;
      return { experiment, groups: sortByOrder(groups), patterns: sortByOrder(patterns), animals };
    },

    async createExperiment(name: string, patternMode: PatternMode = 'group'): Promise<Experiment> {
      const now = clock();
      const e: Experiment = { ...newExperimentDefaults(), id: newId(), name, patternMode, createdAt: now, updatedAt: now };
      await db.experiments.add(e);
      return e;
    },

    async updateExperiment(id: string, patch: Partial<Omit<Experiment, 'id' | 'createdAt'>>) {
      await db.experiments.update(id, { ...patch, updatedAt: clock() });
    },

    /** Deletes the experiment and everything in it. */
    async deleteExperiment(id: string) {
      await db.transaction('rw', [db.experiments, db.groups, db.patterns, db.animals], async () => {
        await db.groups.where('experimentId').equals(id).delete();
        await db.patterns.where('experimentId').equals(id).delete();
        await db.animals.where('experimentId').equals(id).delete();
        await db.experiments.delete(id);
      });
    },

    async duplicateExperiment(id: string, name?: string): Promise<Experiment | undefined> {
      const src = await repo.getBundle(id);
      if (!src) return undefined;
      const copy = cloneExperiment(src, name ?? `${src.experiment.name} (copy)`, clock());
      await db.transaction('rw', [db.experiments, db.groups, db.patterns], async () => {
        await db.experiments.add(copy.experiment);
        await db.groups.bulkAdd(copy.groups);
        await db.patterns.bulkAdd(copy.patterns);
      });
      return copy.experiment;
    },

    async addGroup(experimentId: string, name?: string): Promise<Group> {
      const groups = await db.groups.where('experimentId').equals(experimentId).toArray();
      const g: Group = {
        id: newId(),
        experimentId,
        name: name ?? `Group ${groups.length + 1}`,
        color: nextColor(groups.map((x) => x.color)),
        notes: '',
        order: groups.reduce((m, x) => Math.max(m, x.order), -1) + 1,
      };
      await db.groups.add(g);
      await touch(experimentId);
      return g;
    },

    async updateGroup(id: string, patch: Partial<Omit<Group, 'id' | 'experimentId'>>) {
      const g = await db.groups.get(id);
      if (!g) return;
      await db.transaction('rw', [db.groups, db.patterns, db.experiments], async () => {
        await db.groups.update(id, patch);
        // Patterns that still use the group's old name/color follow the group.
        const patterns = await db.patterns.where('groupId').equals(id).toArray();
        for (const p of patterns) {
          const pp: Partial<Pattern> = {};
          if (patch.name !== undefined && p.label === g.name) pp.label = patch.name;
          if (patch.color !== undefined && p.color === g.color) pp.color = patch.color;
          if (Object.keys(pp).length) await db.patterns.update(p.id, { ...pp, updatedAt: clock() });
        }
        await touch(g.experimentId);
      });
    },

    /** Deletes the group with its patterns and animal records (the UI states the counts first). */
    async deleteGroup(id: string) {
      const g = await db.groups.get(id);
      if (!g) return;
      await db.transaction('rw', [db.groups, db.patterns, db.animals, db.experiments], async () => {
        await db.patterns.where('groupId').equals(id).delete();
        await db.animals.where('groupId').equals(id).delete();
        await db.groups.delete(id);
        await touch(g.experimentId);
      });
    },

    async addPattern(experimentId: string, groupId: string, init: Partial<Pattern> = {}): Promise<Pattern> {
      const [group, experiment, siblings] = await Promise.all([
        db.groups.get(groupId),
        db.experiments.get(experimentId),
        db.patterns.where('groupId').equals(groupId).toArray(),
      ]);
      if (!group || !experiment) throw new Error('Group or experiment not found');
      const now = clock();
      const label =
        experiment.patternMode === 'individual' ? `${group.name} #${siblings.length + 1}` : group.name;
      const p: Pattern = {
        id: newId(),
        experimentId,
        groupId,
        label,
        color: group.color,
        marks: [],
        notes: '',
        order: siblings.reduce((m, x) => Math.max(m, x.order), -1) + 1,
        createdAt: now,
        updatedAt: now,
        ...init,
      };
      await db.patterns.add(p);
      await touch(experimentId);
      return p;
    },

    async updatePattern(id: string, patch: Partial<Omit<Pattern, 'id' | 'experimentId' | 'createdAt'>>) {
      const p = await db.patterns.get(id);
      if (!p) return;
      await db.transaction('rw', [db.patterns, db.animals, db.experiments], async () => {
        await db.patterns.update(id, { ...patch, updatedAt: clock() });
        // Animals carrying this pattern move with it to its new group.
        if (patch.groupId && patch.groupId !== p.groupId)
          await db.animals.where('patternId').equals(id).modify({ groupId: patch.groupId });
        await touch(p.experimentId);
      });
    },

    async deletePattern(id: string) {
      const p = await db.patterns.get(id);
      if (!p) return;
      await db.transaction('rw', [db.patterns, db.animals, db.experiments], async () => {
        await db.animals.where('patternId').equals(id).modify({ patternId: undefined });
        await db.patterns.delete(id);
        await touch(p.experimentId);
      });
    },

    async addAnimal(experimentId: string, draft: AnimalDraft): Promise<Animal> {
      const a: Animal = { ...clean(draft), id: newId(), experimentId };
      await db.animals.add(a);
      await touch(experimentId);
      return a;
    },

    async updateAnimal(id: string, patch: Partial<AnimalDraft>) {
      const a = await db.animals.get(id);
      if (!a) return;
      await db.animals.update(id, clean({ ...a, ...patch }));
      await touch(a.experimentId);
    },

    async deleteAnimal(id: string) {
      const a = await db.animals.get(id);
      if (!a) return;
      await db.animals.delete(id);
      await touch(a.experimentId);
    },

    // ---- Templates, numbering schemes, numbered patterns ----

    async listTemplates(): Promise<PatternTemplate[]> {
      return (await db.templates.toArray()).sort((a, b) => b.createdAt - a.createdAt);
    },

    async saveExperimentAsTemplate(experimentId: string, name: string): Promise<PatternTemplate | undefined> {
      const b = await repo.getBundle(experimentId);
      if (!b) return undefined;
      const t = templateFromExperiment(b, newId(), name, clock());
      await db.templates.add(t);
      return t;
    },

    async renameTemplate(id: string, name: string) {
      await db.templates.update(id, { name });
    },

    async deleteTemplate(id: string) {
      await db.templates.delete(id);
    },

    /** Adds the template's groups and patterns to an experiment (existing ones are kept). */
    async applyTemplate(experimentId: string, templateId: string): Promise<{ groups: number; patterns: number }> {
      const t = await db.templates.get(templateId);
      if (!t) return { groups: 0, patterns: 0 };
      let groups = 0;
      let patterns = 0;
      await db.transaction('rw', [db.groups, db.patterns, db.experiments], async () => {
        const existing = await db.groups.where('experimentId').equals(experimentId).toArray();
        let order = existing.reduce((m, g) => Math.max(m, g.order), -1) + 1;
        for (const tg of t.groups) {
          const g: Group = { id: newId(), experimentId, name: tg.name, color: tg.color, notes: tg.notes, order: order++ };
          await db.groups.add(g);
          groups++;
          const now = clock();
          await db.patterns.bulkAdd(
            tg.patterns.map((tp, i) => ({
              id: newId(),
              experimentId,
              groupId: g.id,
              label: tp.label,
              color: tp.color,
              notes: tp.notes,
              marks: tp.marks.map((m) => ({ ...m, id: newId() })),
              order: i,
              createdAt: now,
              updatedAt: now,
            })),
          );
          patterns += tg.patterns.length;
        }
        await touch(experimentId);
      });
      return { groups, patterns };
    },

    /** Adds many patterns at once to a group (e.g. numbers from a numbering scheme). */
    async addPatternsToGroup(experimentId: string, groupId: string, items: { label: string; marks: MarkSpec[] }[]) {
      const g = await db.groups.get(groupId);
      if (!g) throw new Error('Group not found');
      await db.transaction('rw', [db.patterns, db.experiments], async () => {
        const siblings = await db.patterns.where('groupId').equals(groupId).toArray();
        let order = siblings.reduce((m, x) => Math.max(m, x.order), -1) + 1;
        const now = clock();
        await db.patterns.bulkAdd(
          items.map((it) => ({
            id: newId(),
            experimentId,
            groupId,
            label: it.label,
            color: g.color,
            notes: '',
            marks: it.marks.map((m) => ({ ...m, id: newId() })),
            order: order++,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await touch(experimentId);
      });
    },

    async listSchemes(): Promise<NumberingScheme[]> {
      return (await db.schemes.toArray()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },

    async saveScheme(s: NumberingScheme) {
      await db.schemes.put({ ...s, builtIn: false, updatedAt: clock() });
    },

    async deleteScheme(id: string) {
      await db.schemes.delete(id);
    },

    // ---- Backup ----

    async exportAll(): Promise<BackupData> {
      const [experiments, groups, patterns, animals, templates, schemes] = await Promise.all([
        db.experiments.toArray(),
        db.groups.toArray(),
        db.patterns.toArray(),
        db.animals.toArray(),
        db.templates.toArray(),
        db.schemes.toArray(),
      ]);
      return { experiments, groups, patterns, animals, templates, schemes };
    },

    async exportExperiment(experimentId: string): Promise<BackupData | undefined> {
      const b = await repo.getBundle(experimentId);
      if (!b) return undefined;
      return { experiments: [b.experiment], groups: b.groups, patterns: b.patterns, animals: b.animals, templates: [], schemes: [] };
    },

    /**
     * Restore a parsed backup. "merge" adds records whose ids are not on this
     * device; "replace" deletes all data on this device first.
     */
    async importBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<{ added: number; skipped: number }> {
      const tables = [db.experiments, db.groups, db.patterns, db.animals, db.templates, db.schemes];
      let result = { added: 0, skipped: 0 };
      await db.transaction('rw', tables, async () => {
        if (mode === 'replace') await Promise.all(tables.map((t) => t.clear()));
        const ids = async (t: { toCollection: () => { primaryKeys: () => Promise<string[]> } }) =>
          new Set(await t.toCollection().primaryKeys());
        const plan = planMerge(backup, {
          experiments: await ids(db.experiments),
          groups: await ids(db.groups),
          patterns: await ids(db.patterns),
          animals: await ids(db.animals),
          templates: await ids(db.templates),
          schemes: await ids(db.schemes),
        });
        await db.experiments.bulkAdd(plan.add.experiments);
        await db.groups.bulkAdd(plan.add.groups);
        await db.patterns.bulkAdd(plan.add.patterns);
        await db.animals.bulkAdd(plan.add.animals);
        await db.templates.bulkAdd(plan.add.templates);
        await db.schemes.bulkAdd(plan.add.schemes.map((x) => ({ ...x, builtIn: false })));
        const added = Object.values(plan.add).reduce((n, xs) => n + xs.length, 0);
        result = { added, skipped: plan.skipped };
      });
      return result;
    },

    async duplicatePattern(id: string): Promise<Pattern | undefined> {
      const p = await db.patterns.get(id);
      if (!p) return undefined;
      const siblings = await db.patterns.where('groupId').equals(p.groupId).toArray();
      const copy = clonePattern(p, clock(), { order: siblings.reduce((m, x) => Math.max(m, x.order), -1) + 1 });
      await db.patterns.add(copy);
      await touch(p.experimentId);
      return copy;
    },
  };
  return repo;
}

export const repo = createRepo();
