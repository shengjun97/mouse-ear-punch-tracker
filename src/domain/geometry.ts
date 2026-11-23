import type { EarSide, MarkType } from './types';

/** Ear bounding box in some drawing coordinate system (e.g. SVG user units). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface UV {
  u: number;
  v: number;
}

/** Elliptical radius above which a new mark snaps to the edge as a notch. */
export const EDGE_SNAP_RADIUS = 0.8;
/** Taps up to this elliptical radius outside the ear still count (gloves). */
export const MAX_REACH_RADIUS = 1.3;
/** Holes are kept at or inside this radius so they never touch the edge. */
export const HOLE_MAX_RADIUS = 0.78;
/** Holes closer to the centre than this have no direction when made notches. */
export const CENTER_DIRECTIONLESS_RADIUS = 0.35;
/** Where a notch converted to a hole is placed (same direction). */
export const HOLE_FROM_NOTCH_RADIUS = 0.6;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Drawing point -> normalized ear coordinates.
 * The left ear is mirrored: its medial side (u = 0) is on the right of the box.
 * Values are not clamped, so callers can tell when a point lies outside.
 */
export function toNormalized(ear: EarSide, box: Box, p: Point): UV {
  const fx = (p.x - box.x) / box.w;
  const fy = (p.y - box.y) / box.h;
  return { u: ear === 'L' ? 1 - fx : fx, v: fy };
}

/** Normalized ear coordinates -> drawing point (inverse of toNormalized). */
export function toDrawing(ear: EarSide, box: Box, uv: UV): Point {
  const fx = ear === 'L' ? 1 - uv.u : uv.u;
  return { x: box.x + fx * box.w, y: box.y + uv.v * box.h };
}

/** Offsets from the ear centre scaled so the outline is the unit circle. */
export function centered(uv: UV): { du: number; dv: number } {
  return { du: (uv.u - 0.5) / 0.5, dv: (uv.v - 0.5) / 0.5 };
}

export function fromCentered(du: number, dv: number): UV {
  return { u: 0.5 + du * 0.5, v: 0.5 + dv * 0.5 };
}

/** 0 at the ear centre, 1 on the outline, > 1 outside. */
export function ellipticalRadius(uv: UV): number {
  const { du, dv } = centered(uv);
  return Math.hypot(du, dv);
}

/** Move a point along its ray from the centre to the given elliptical radius. */
export function atRadius(uv: UV, r: number): UV {
  const { du, dv } = centered(uv);
  const len = Math.hypot(du, dv);
  if (len < 1e-9) {
    // Centre has no direction; use the top (anterior) edge.
    return fromCentered(0, -r);
  }
  return fromCentered((du / len) * r, (dv / len) * r);
}

export function projectToEdge(uv: UV): UV {
  return atRadius(uv, 1);
}

/** Keep a hole inside the ear, away from the edge. */
export function clampHole(uv: UV): UV {
  return ellipticalRadius(uv) > HOLE_MAX_RADIUS ? atRadius(uv, HOLE_MAX_RADIUS) : uv;
}

/** Constrain a point to be valid for its mark type. */
export function constrain(uv: UV, type: MarkType): UV {
  return type === 'notch' ? projectToEdge(uv) : clampHole(uv);
}

/**
 * Decide what a tap at `uv` should create.
 * Returns null when the tap is too far outside the ear.
 * Near the edge -> notch on the edge; otherwise -> hole.
 */
export function classifyPlacement(uv: UV): { type: MarkType; uv: UV } | null {
  const r = ellipticalRadius(uv);
  if (!Number.isFinite(r) || r > MAX_REACH_RADIUS) return null;
  if (r >= EDGE_SNAP_RADIUS) return { type: 'notch', uv: projectToEdge(uv) };
  return { type: 'hole', uv: clampHole(uv) };
}

/** Re-place a mark when its type is toggled. */
export function convertType(uv: UV, to: MarkType): UV {
  if (to === 'notch') {
    // A hole near the centre has no meaningful direction: use the top edge.
    return ellipticalRadius(uv) < CENTER_DIRECTIONLESS_RADIUS ? fromCentered(0, -1) : projectToEdge(uv);
  }
  const r = ellipticalRadius(uv);
  return r > HOLE_MAX_RADIUS ? atRadius(uv, HOLE_FROM_NOTCH_RADIUS) : uv;
}

export function distance(a: UV, b: UV): number {
  return Math.hypot(a.u - b.u, a.v - b.v);
}

/** Round to a stable precision for storage (avoids float noise in exports). */
export function roundUV(uv: UV, digits = 4): UV {
  const f = 10 ** digits;
  return { u: Math.round(clamp01(uv.u) * f) / f, v: Math.round(clamp01(uv.v) * f) / f };
}
