import { useId, type ReactNode, type Ref, type SVGProps } from 'react';
import { diagramAltText } from '../../domain/describe';
import { toDrawing } from '../../domain/geometry';
import { EAR_SIDES, type EarMark, type EarSide, type MarkType } from '../../domain/types';
import { ZONE_BY_ID, zoneOf, zonePosition, zonesFor } from '../../domain/zones';
import { CONCHA, EAR_BOX, HEAD_PATH, HIT_R, HOLE_R, NOTCH_R, VIEW } from './layout';

export interface EarDiagramProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  marks: readonly EarMark[];
  /** Pattern label used in the text alternative. */
  label?: string;
  selectedId?: string | null;
  /** Show snap-zone guides for this mark type. */
  zoneGuides?: MarkType | null;
  /** Small rendering for legends and cards: hides the ear sub-captions. */
  compact?: boolean;
  /** Render focusable hit targets for each mark (editor mode). */
  interactive?: boolean;
  onMarkFocus?: (id: string) => void;
  svgRef?: Ref<SVGSVGElement>;
  children?: ReactNode;
}

const earCenter = (ear: EarSide) => {
  const b = EAR_BOX[ear];
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2 };
};

/** Spoken name of a single mark, e.g. "Left ear top notch". */
export function markLabel(m: EarMark): string {
  return `${m.ear === 'L' ? 'Left' : 'Right'} ear ${ZONE_BY_ID[zoneOf(m, m.type)].label} ${m.type}`;
}

export function EarDiagram({
  marks,
  label,
  selectedId,
  zoneGuides,
  compact,
  interactive,
  onMarkFocus,
  svgRef,
  children,
  className,
  ...rest
}: EarDiagramProps) {
  const uid = useId().replace(/:/g, '');
  const alt = diagramAltText(marks, label);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-label={alt}
      className={['ear-diagram', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <title>{alt}</title>
      <defs>
        {EAR_SIDES.map((ear) => {
          const c = earCenter(ear);
          return (
            <g key={ear}>
              <mask id={`m-${uid}-${ear}`} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW.w} height={VIEW.h}>
                <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="#fff" />
                {marks
                  .filter((m) => m.ear === ear)
                  .map((m) => {
                    const p = toDrawing(ear, EAR_BOX[ear], m);
                    return <circle key={m.id} cx={p.x} cy={p.y} r={m.type === 'hole' ? HOLE_R : NOTCH_R} fill="#000" />;
                  })}
              </mask>
              <clipPath id={`c-${uid}-${ear}`}>
                <ellipse cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} />
              </clipPath>
            </g>
          );
        })}
      </defs>

      <text className="ed-caption" x={VIEW.w / 2} y="24" textAnchor="middle">
        Dorsal view, nose up
      </text>
      <path className="ed-arrow" d="M294 50 L300 38 L306 50" />

      <path className="ed-head" d={HEAD_PATH} />
      <circle className="ed-nose" cx="300" cy="74" r="5" />
      <circle className="ed-eye" cx="272" cy="170" r="5" />
      <circle className="ed-eye" cx="328" cy="170" r="5" />

      {EAR_SIDES.map((ear) => {
        const c = earCenter(ear);
        const concha = toDrawing(ear, EAR_BOX[ear], CONCHA);
        const earMarks = marks.filter((m) => m.ear === ear);
        return (
          <g key={ear} className={`ed-ear ed-ear-${ear}`}>
            <g mask={`url(#m-${uid}-${ear})`}>
              <ellipse className="ed-pinna" cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} />
              <ellipse
                className="ed-concha"
                cx={concha.x}
                cy={concha.y}
                rx={CONCHA.ru * EAR_BOX[ear].w}
                ry={CONCHA.rv * EAR_BOX[ear].h}
              />
            </g>

            {zoneGuides &&
              zonesFor(zoneGuides).map((z) => {
                const p = toDrawing(ear, EAR_BOX[ear], zonePosition(z, zoneGuides));
                return <circle key={z} className="ed-zone" cx={p.x} cy={p.y} r="8" />;
              })}

            {earMarks.map((m) => {
              const p = toDrawing(ear, EAR_BOX[ear], m);
              return m.type === 'hole' ? (
                <circle key={m.id} className="ed-mark" cx={p.x} cy={p.y} r={HOLE_R} />
              ) : (
                <circle
                  key={m.id}
                  className="ed-mark"
                  cx={p.x}
                  cy={p.y}
                  r={NOTCH_R}
                  clipPath={`url(#c-${uid}-${ear})`}
                />
              );
            })}

            {earMarks.map((m) => {
              if (m.id !== selectedId) return null;
              const p = toDrawing(ear, EAR_BOX[ear], m);
              return <circle key={`sel-${m.id}`} className="ed-selected" cx={p.x} cy={p.y} r={NOTCH_R + 9} />;
            })}

            {interactive &&
              earMarks.map((m) => {
                const p = toDrawing(ear, EAR_BOX[ear], m);
                return (
                  <circle
                    key={`hit-${m.id}`}
                    className="ed-hit"
                    data-mark-id={m.id}
                    cx={p.x}
                    cy={p.y}
                    r={HIT_R}
                    tabIndex={0}
                    role="button"
                    aria-pressed={m.id === selectedId}
                    aria-label={markLabel(m)}
                    onFocus={() => onMarkFocus?.(m.id)}
                  />
                );
              })}

            <text className="ed-side" x={c.cx} y="408" textAnchor="middle">
              {ear}
            </text>
            {!compact && (
              <text className="ed-sub" x={c.cx} y="430" textAnchor="middle">
                {ear === 'L' ? "mouse's left ear" : "mouse's right ear"}
              </text>
            )}
          </g>
        );
      })}
      {children}
    </svg>
  );
}
