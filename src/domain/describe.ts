import type { EarSide, MarkSpec, MarkType } from './types';
import { ZONE_BY_ID, ZONE_ORDER, zoneOf, type ZoneId } from './zones';

const TYPE_ORDER: readonly MarkType[] = ['notch', 'hole'];

function plural(type: MarkType, n: number): string {
  if (n === 1) return type;
  return type === 'notch' ? 'notches' : 'holes';
}

/** Describe the marks on one ear, e.g. "top notch, 2 outer holes". */
export function describeEar(marks: readonly MarkSpec[], ear: EarSide): string {
  const counts = new Map<string, number>();
  for (const m of marks) {
    if (m.ear !== ear) continue;
    const key = `${zoneOf(m, m.type)}|${m.type}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return 'none';
  const parts: string[] = [];
  for (const zone of ZONE_ORDER) {
    for (const type of TYPE_ORDER) {
      const n = counts.get(`${zone}|${type}`);
      if (!n) continue;
      const label = ZONE_BY_ID[zone as ZoneId].label;
      parts.push(n === 1 ? `${label} ${type}` : `${n} ${label} ${plural(type, n)}`);
    }
  }
  return parts.join(', ');
}

/**
 * Short text description of a whole pattern, e.g.
 * "L: top notch; R: center hole" or "No punch".
 */
export function describePattern(marks: readonly MarkSpec[]): string {
  if (marks.length === 0) return 'No punch';
  return `L: ${describeEar(marks, 'L')}; R: ${describeEar(marks, 'R')}`;
}

/** Text alternative for a diagram (screen readers, alt text). */
export function diagramAltText(marks: readonly MarkSpec[], label?: string): string {
  const prefix = label ? `${label}. ` : '';
  return `${prefix}Ear punch diagram, dorsal view, nose up. ${describePattern(marks)}.`;
}
