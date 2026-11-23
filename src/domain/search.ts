/**
 * Shared search syntax.
 *  - "cage 10" or "cage:10"  -> cage is exactly 10 (case-insensitive)
 *  - "animal M12", "id M12", "animal:M12" -> animal ID is exactly M12
 *  - any other words must all appear somewhere (substring match)
 */
export interface ParsedQuery {
  cages: string[];
  animals: string[];
  words: string[];
}

export const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKD').trim();

const FIELD_RE = /\b(cage|animal|id)\s*[:\s]\s*([^\s:]+)/gi;

export function parseQuery(q: string): ParsedQuery {
  const cages: string[] = [];
  const animals: string[] = [];
  const rest = q.replace(FIELD_RE, (_m, field: string, value: string) => {
    (field.toLowerCase() === 'cage' ? cages : animals).push(norm(value));
    return ' ';
  });
  return { cages, animals, words: norm(rest).split(/\s+/).filter(Boolean) };
}

export const isEmptyQuery = (p: ParsedQuery) => !p.cages.length && !p.animals.length && !p.words.length;

/** Every free word appears in `text` (already normalized). */
export const wordsMatch = (p: ParsedQuery, text: string) => p.words.every((w) => text.includes(w));

/** Field filters match this animal (exact, case-insensitive). */
export const fieldsMatch = (p: ParsedQuery, a: { cage: string; animalCode: string }) =>
  p.cages.every((c) => norm(a.cage) === c) && p.animals.every((x) => norm(a.animalCode) === x);
