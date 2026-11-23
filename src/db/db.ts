import Dexie, { type EntityTable } from 'dexie';
import type { Animal, Experiment, Group, Pattern, PatternTemplate } from '../domain/models';
import type { NumberingScheme } from '../domain/numbering';

/** All data lives in this browser's IndexedDB. Nothing is sent anywhere. */
export class EarPunchDB extends Dexie {
  experiments!: EntityTable<Experiment, 'id'>;
  groups!: EntityTable<Group, 'id'>;
  patterns!: EntityTable<Pattern, 'id'>;
  animals!: EntityTable<Animal, 'id'>;
  templates!: EntityTable<PatternTemplate, 'id'>;
  schemes!: EntityTable<NumberingScheme, 'id'>;

  constructor(name = 'ear-punch-tracker') {
    super(name);
    this.version(1).stores({
      experiments: 'id, updatedAt',
      groups: 'id, experimentId',
      patterns: 'id, experimentId, groupId',
      animals: 'id, experimentId, groupId, patternId, cage, animalCode',
    });
    // v2: saved pattern-set templates and custom numbering schemes.
    this.version(2).stores({
      templates: 'id, name',
      schemes: 'id, name',
    });
  }
}

export const db = new EarPunchDB();
