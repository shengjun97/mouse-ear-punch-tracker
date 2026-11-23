import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyAnimal } from '../domain/animals';
import { newId } from '../domain/ids';
import { EarPunchDB } from './db';
import { createRepo } from './repo';
import { BUILT_IN_SCHEMES, copyScheme } from '../domain/numbering';
import { planNumbered } from '../domain/templates';
import { makeBackup, parseBackup } from '../export/backup';

let db: EarPunchDB;
let repo: ReturnType<typeof createRepo>;
let t = 1000;

beforeEach(async () => {
  db = new EarPunchDB(`test-${newId()}`);
  t = 1000;
  repo = createRepo(db, () => ++t);
});

const mark = (ear: 'L' | 'R', type: 'hole' | 'notch', u: number, v: number) => ({ id: newId(), ear, type, u, v });

describe('repository', () => {
  it('creates groups with distinct default colors and increasing order', async () => {
    const e = await repo.createExperiment('Exp A');
    const g1 = await repo.addGroup(e.id);
    const g2 = await repo.addGroup(e.id);
    expect(g1.name).toBe('Group 1');
    expect(g2.order).toBeGreaterThan(g1.order);
    expect(g1.color).not.toBe(g2.color);
  });

  it('labels new patterns by group (group mode) or numbered (individual mode)', async () => {
    const e = await repo.createExperiment('Group mode');
    const g = await repo.addGroup(e.id, 'Vehicle');
    expect((await repo.addPattern(e.id, g.id)).label).toBe('Vehicle');

    const e2 = await repo.createExperiment('Individual mode', 'individual');
    const g2 = await repo.addGroup(e2.id, 'Drug');
    expect((await repo.addPattern(e2.id, g2.id)).label).toBe('Drug #1');
    expect((await repo.addPattern(e2.id, g2.id)).label).toBe('Drug #2');
  });

  it('stores "No punch" (empty marks) as a valid pattern', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id);
    const p = await repo.addPattern(e.id, g.id);
    expect((await db.patterns.get(p.id))?.marks).toEqual([]);
  });

  it('renaming or recoloring a group updates patterns that still follow it', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id, 'Old');
    const follows = await repo.addPattern(e.id, g.id);
    const custom = await repo.addPattern(e.id, g.id, { label: 'Custom', color: '#000000' });
    await repo.updateGroup(g.id, { name: 'New', color: '#123456' });
    expect(await db.patterns.get(follows.id)).toMatchObject({ label: 'New', color: '#123456' });
    expect(await db.patterns.get(custom.id)).toMatchObject({ label: 'Custom', color: '#000000' });
  });

  it('duplicates a pattern with new ids for the pattern and its marks', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id);
    const p = await repo.addPattern(e.id, g.id, { marks: [mark('L', 'notch', 0.5, 0)] });
    const c = (await repo.duplicatePattern(p.id))!;
    expect(c.id).not.toBe(p.id);
    expect(c.label).toBe(`${p.label} (copy)`);
    expect(c.marks[0].id).not.toBe(p.marks[0].id);
    expect(c.marks.map(({ id: _i, ...m }) => m)).toEqual(p.marks.map(({ id: _i, ...m }) => m));
  });

  it('duplicates a whole experiment and remaps group references', async () => {
    const e = await repo.createExperiment('Original');
    const g1 = await repo.addGroup(e.id, 'A');
    const g2 = await repo.addGroup(e.id, 'B');
    await repo.addPattern(e.id, g1.id, { marks: [mark('R', 'hole', 0.5, 0.5)] });
    await repo.addPattern(e.id, g2.id);
    const copy = (await repo.duplicateExperiment(e.id))!;
    expect(copy.name).toBe('Original (copy)');

    const b = (await repo.getBundle(copy.id))!;
    expect(b.groups.map((g) => g.name)).toEqual(['A', 'B']);
    expect(b.patterns).toHaveLength(2);
    const groupIds = new Set(b.groups.map((g) => g.id));
    for (const p of b.patterns) {
      expect(p.experimentId).toBe(copy.id);
      expect(groupIds.has(p.groupId)).toBe(true);
    }
    // Original is untouched.
    expect((await repo.getBundle(e.id))!.patterns).toHaveLength(2);
  });

  it('deleting an experiment removes its groups and patterns only', async () => {
    const keep = await repo.createExperiment('Keep');
    const kg = await repo.addGroup(keep.id);
    await repo.addPattern(keep.id, kg.id);
    const drop = await repo.createExperiment('Drop');
    const dg = await repo.addGroup(drop.id);
    await repo.addPattern(drop.id, dg.id);

    await repo.deleteExperiment(drop.id);
    expect(await repo.getBundle(drop.id)).toBeUndefined();
    expect(await db.patterns.where('experimentId').equals(drop.id).count()).toBe(0);
    expect((await repo.getBundle(keep.id))!.patterns).toHaveLength(1);
  });

  it('adds, updates and deletes animals, trimming text and empty dates', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id);
    const a = await repo.addAnimal(e.id, { ...emptyAnimal(g.id), animalCode: ' M1 ', cage: ' 3 ', dob: '' });
    expect(a).toMatchObject({ animalCode: 'M1', cage: '3', dob: undefined });
    await repo.updateAnimal(a.id, { status: 'endpoint' });
    expect((await db.animals.get(a.id))?.status).toBe('endpoint');
    expect((await repo.getBundle(e.id))!.animals).toHaveLength(1);
    await repo.deleteAnimal(a.id);
    expect(await db.animals.count()).toBe(0);
  });

  it('moving a pattern to another group moves its animals too', async () => {
    const e = await repo.createExperiment('Exp');
    const g1 = await repo.addGroup(e.id);
    const g2 = await repo.addGroup(e.id);
    const p = await repo.addPattern(e.id, g1.id);
    const a = await repo.addAnimal(e.id, { ...emptyAnimal(g1.id), animalCode: 'M1', patternId: p.id });
    await repo.updatePattern(p.id, { groupId: g2.id });
    expect((await db.animals.get(a.id))?.groupId).toBe(g2.id);
  });

  it('deleting a pattern unlinks its animals but keeps them', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id);
    const p = await repo.addPattern(e.id, g.id);
    const a = await repo.addAnimal(e.id, { ...emptyAnimal(g.id), animalCode: 'M1', patternId: p.id });
    await repo.deletePattern(p.id);
    expect((await db.animals.get(a.id))?.patternId).toBeUndefined();
  });

  it('duplicating an experiment does not copy animals', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id);
    await repo.addAnimal(e.id, { ...emptyAnimal(g.id), animalCode: 'M1' });
    const copy = (await repo.duplicateExperiment(e.id))!;
    expect((await repo.getBundle(copy.id))!.animals).toEqual([]);
  });

  it('deleting a group removes its patterns and animals', async () => {
    const e = await repo.createExperiment('Exp');
    const g1 = await repo.addGroup(e.id);
    const g2 = await repo.addGroup(e.id);
    await repo.addPattern(e.id, g1.id);
    await repo.addPattern(e.id, g2.id);
    await repo.addAnimal(e.id, { ...emptyAnimal(g1.id), animalCode: 'M1' });
    await repo.addAnimal(e.id, { ...emptyAnimal(g2.id), animalCode: 'M2' });
    await repo.deleteGroup(g1.id);
    const b = (await repo.getBundle(e.id))!;
    expect(b.animals.map((a) => a.animalCode)).toEqual(['M2']);
    expect(b.groups.map((g) => g.id)).toEqual([g2.id]);
    expect(b.patterns.every((p) => p.groupId === g2.id)).toBe(true);
  });

  it('lists experiments by most recent activity', async () => {
    const a = await repo.createExperiment('A');
    await repo.createExperiment('B');
    await repo.addGroup(a.id);
    expect((await repo.listExperiments()).map((e) => e.name)).toEqual(['A', 'B']);
  });

  it('saves an experiment as a template and applies it to another experiment', async () => {
    const e = await repo.createExperiment('Source');
    const g = await repo.addGroup(e.id, 'A');
    await repo.addPattern(e.id, g.id, { marks: [mark('R', 'hole', 0.5, 0.5)] });
    const t = (await repo.saveExperimentAsTemplate(e.id, 'My set'))!;
    expect(t.groups[0].patterns[0].marks[0]).not.toHaveProperty('id');

    const target = await repo.createExperiment('Target');
    expect(await repo.applyTemplate(target.id, t.id)).toEqual({ groups: 1, patterns: 1 });
    const b = (await repo.getBundle(target.id))!;
    expect(b.groups[0].name).toBe('A');
    expect(b.patterns[0].marks[0].id).toBeTruthy();
    expect(b.patterns[0].groupId).toBe(b.groups[0].id);
  });

  it('adds numbered patterns from a numbering scheme', async () => {
    const e = await repo.createExperiment('Numbers', 'individual');
    const g = await repo.addGroup(e.id, 'Cohort');
    const plan = planNumbered(BUILT_IN_SCHEMES[0], 1, 12, '#');
    await repo.addPatternsToGroup(e.id, g.id, plan.ok);
    const b = (await repo.getBundle(e.id))!;
    expect(b.patterns.map((p) => p.label)).toEqual(Array.from({ length: 12 }, (_, i) => `#${i + 1}`));
    expect(b.patterns.every((p) => p.color === g.color)).toBe(true);
  });

  it('stores custom numbering schemes', async () => {
    await repo.saveScheme(copyScheme(BUILT_IN_SCHEMES[0], 's1', 'Lab', 1));
    expect((await repo.listSchemes()).map((x) => x.name)).toEqual(['Lab']);
    await repo.deleteScheme('s1');
    expect(await repo.listSchemes()).toEqual([]);
  });

  it('backs up and restores by merge (skipping existing) or replace', async () => {
    const e = await repo.createExperiment('Exp');
    const g = await repo.addGroup(e.id);
    const p = await repo.addPattern(e.id, g.id);
    await repo.addAnimal(e.id, { ...emptyAnimal(g.id), animalCode: 'M1', patternId: p.id });
    const backup = parseBackup(JSON.stringify(makeBackup(await repo.exportAll())));

    expect(await repo.importBackup(backup, 'merge')).toEqual({ added: 0, skipped: 4 });

    await repo.createExperiment('Extra');
    expect(await repo.importBackup(backup, 'replace')).toEqual({ added: 4, skipped: 0 });
    expect((await repo.listExperiments()).map((x) => x.name)).toEqual(['Exp']);

    const other = new EarPunchDB(`test-${newId()}`);
    const repo2 = createRepo(other, () => 1);
    expect(await repo2.importBackup(backup, 'merge')).toEqual({ added: 4, skipped: 0 });
    expect((await repo2.getBundle(e.id))!.animals[0].animalCode).toBe('M1');
  });

  it('exports a single experiment', async () => {
    const a = await repo.createExperiment('A');
    await repo.createExperiment('B');
    const d = (await repo.exportExperiment(a.id))!;
    expect(d.experiments.map((x) => x.name)).toEqual(['A']);
  });
});
