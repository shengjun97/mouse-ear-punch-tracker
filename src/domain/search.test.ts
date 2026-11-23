import { describe, expect, it } from 'vitest';
import { fieldsMatch, parseQuery } from './search';

describe('parseQuery', () => {
  it('extracts cage and animal filters and leaves other words', () => {
    expect(parseQuery('cage 10 Vehicle')).toEqual({ cages: ['10'], animals: [], words: ['vehicle'] });
    expect(parseQuery('Cage:C2 id M12')).toEqual({ cages: ['c2'], animals: ['m12'], words: [] });
    expect(parseQuery('animal M3')).toEqual({ cages: [], animals: ['m3'], words: [] });
    expect(parseQuery('  top notch ')).toEqual({ cages: [], animals: [], words: ['top', 'notch'] });
  });

  it('matches field filters exactly, ignoring case', () => {
    const q = parseQuery('cage c2');
    expect(fieldsMatch(q, { cage: 'C2', animalCode: 'x' })).toBe(true);
    expect(fieldsMatch(q, { cage: 'C20', animalCode: 'x' })).toBe(false);
  });
});
