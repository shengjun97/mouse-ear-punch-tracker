import type { Box } from '../../domain/geometry';
import type { EarSide } from '../../domain/types';

/** Fixed drawing frame for the dorsal, nose-up head. Everything scales from it. */
export const VIEW = { w: 600, h: 440 } as const;
export const VIEW_COMPACT = { w: 600, h: 420 } as const;

export const EAR_BOX: Record<EarSide, Box> = {
  L: { x: 50, y: 138, w: 200, h: 224 },
  R: { x: 350, y: 138, w: 200, h: 224 },
};

/** Head outline, nose at the top. */
export const HEAD_PATH =
  'M300,70 C332,70 352,130 370,200 C390,275 380,345 300,372 C220,345 210,275 230,200 C248,130 268,70 300,70 Z';

export const HOLE_R = 13;
export const NOTCH_R = 15;
/** Invisible hit radius around a mark (large for gloved fingers). */
export const HIT_R = 34;

/** Inner ear (concha) shading, in normalized ear coordinates. */
export const CONCHA = { u: 0.44, v: 0.53, ru: 0.3, rv: 0.33 } as const;
