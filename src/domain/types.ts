/**
 * Core domain types.
 *
 * Ear coordinates are normalized to each ear's bounding box and expressed in
 * anatomical terms so that both ears share one frame:
 *   u: 0 = medial (inner, toward the head) -> 1 = lateral (outer)
 *   v: 0 = anterior (top, toward the nose)  -> 1 = posterior (bottom)
 * The ear outline is the ellipse inscribed in that unit box. The left ear is
 * mirrored horizontally when drawn in the dorsal, nose-up view.
 */

export type EarSide = 'L' | 'R';
export type MarkType = 'hole' | 'notch';

export interface EarMark {
  id: string;
  ear: EarSide;
  type: MarkType;
  u: number;
  v: number;
}

/** A mark without identity, used in templates, comparisons, and tests. */
export type MarkSpec = Omit<EarMark, 'id'>;

export const EAR_SIDES: readonly EarSide[] = ['L', 'R'];
