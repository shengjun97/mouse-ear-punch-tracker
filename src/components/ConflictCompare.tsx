import { describePattern } from '../domain/describe';
import type { Pattern } from '../domain/models';
import { EarDiagram } from './ear/EarDiagram';

type Side = Pick<Pattern, 'label' | 'color' | 'marks'> & { id: string };

interface Props {
  a: Side;
  b: Side;
  kind: 'identical' | 'confusable';
  maxPairDistance: number;
  threshold: number;
  onOpen?: (id: string) => void;
}

/** Two patterns side by side with an explanation of why they may be confused. */
export function ConflictCompare({ a, b, kind, maxPairDistance, threshold, onOpen }: Props) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <div className={`conflict conflict-${kind}`}>
      <p className="conflict-why">
        {kind === 'identical'
          ? 'Identical: the same marks in the same places.'
          : `Could be confused on a real ear: every mark is within ${pct(maxPairDistance)} of the ear size of its counterpart (warning threshold ${pct(threshold)}).`}
      </p>
      <div className="conflict-pair">
        {[a, b].map((p) => (
          <figure key={p.id} className="conflict-side">
            <EarDiagram marks={p.marks} label={p.label} compact />
            <figcaption>
              <span className="pc-swatch" style={{ background: p.color }} aria-hidden="true" />
              <strong>{p.label}</strong>
              <span className="pc-desc">{describePattern(p.marks)}</span>
              {onOpen && (
                <button type="button" onClick={() => onOpen(p.id)}>
                  Edit
                </button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
