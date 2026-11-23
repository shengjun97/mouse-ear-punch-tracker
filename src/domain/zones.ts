import { centered, ellipticalRadius, fromCentered, type UV } from './geometry';
import type { MarkType } from './types';

/**
 * Named positions on an ear. Directions are anatomical:
 * top = anterior (toward the nose), outer = lateral, inner = medial.
 */
export type ZoneId =
  | 'top'
  | 'upper-outer'
  | 'outer'
  | 'lower-outer'
  | 'bottom'
  | 'lower-inner'
  | 'inner'
  | 'upper-inner'
  | 'center';

export interface Zone {
  id: ZoneId;
  label: string;
  /** Direction angle in degrees: 0 = top, 90 = outer, 180 = bottom, -90 = inner. */
  angle: number | null;
}

export const ZONES: readonly Zone[] = [
  { id: 'top', label: 'top', angle: 0 },
  { id: 'upper-outer', label: 'upper outer', angle: 45 },
  { id: 'outer', label: 'outer', angle: 90 },
  { id: 'lower-outer', label: 'lower outer', angle: 135 },
  { id: 'bottom', label: 'bottom', angle: 180 },
  { id: 'lower-inner', label: 'lower inner', angle: -135 },
  { id: 'inner', label: 'inner', angle: -90 },
  { id: 'upper-inner', label: 'upper inner', angle: -45 },
  { id: 'center', label: 'center', angle: null },
];

export const ZONE_BY_ID: Record<ZoneId, Zone> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
) as Record<ZoneId, Zone>;

/** Display/description order. */
export const ZONE_ORDER: readonly ZoneId[] = ZONES.map((z) => z.id);

/** Holes closer to the centre than this radius are described as "center". */
export const CENTER_RADIUS = 0.35;
/** Radius used for hole snap positions that are not the centre. */
export const HOLE_RING_RADIUS = 0.6;

export function angleOf(uv: UV): number {
  const { du, dv } = centered(uv);
  return (Math.atan2(du, -dv) * 180) / Math.PI;
}

function directionZone(uv: UV): ZoneId {
  const a = angleOf(uv);
  let best: Zone = ZONES[0];
  let bestDiff = Infinity;
  for (const z of ZONES) {
    if (z.angle === null) continue;
    let d = Math.abs(a - z.angle) % 360;
    if (d > 180) d = 360 - d;
    if (d < bestDiff) {
      bestDiff = d;
      best = z;
    }
  }
  return best.id;
}

/** Which named zone a mark falls in. Notches are never "center". */
export function zoneOf(uv: UV, type: MarkType): ZoneId {
  if (type === 'hole' && ellipticalRadius(uv) < CENTER_RADIUS) return 'center';
  return directionZone(uv);
}

/** Canonical coordinates of a zone for a mark type. */
export function zonePosition(zone: ZoneId, type: MarkType): UV {
  const z = ZONE_BY_ID[zone];
  if (z.angle === null) {
    // A notch cannot sit in the centre; fall back to the top edge.
    return type === 'hole' ? { u: 0.5, v: 0.5 } : fromCentered(0, -1);
  }
  const r = type === 'notch' ? 1 : HOLE_RING_RADIUS;
  const rad = (z.angle * Math.PI) / 180;
  return fromCentered(Math.sin(rad) * r, -Math.cos(rad) * r);
}

/** Zones a given mark type can snap to. */
export function zonesFor(type: MarkType): ZoneId[] {
  return ZONE_ORDER.filter((id) => !(type === 'notch' && id === 'center'));
}

/** Snap to the nearest zone position for this mark type. */
export function snapToZone(uv: UV, type: MarkType): UV {
  return zonePosition(zoneOf(uv, type), type);
}
