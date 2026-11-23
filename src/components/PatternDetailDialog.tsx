import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { LegendEntry } from '../domain/legend';
import { EarDiagram } from './ear/EarDiagram';

interface Props {
  entry: LegendEntry | null;
  position?: { index: number; total: number };
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onEdit?: (patternId: string) => void;
}

/** Large view of one pattern, for reading at arm's length in the facility. */
export function PatternDetailDialog({ entry, position, onClose, onPrev, onNext, onEdit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (entry && !d.open) d.showModal();
    if (!entry && d.open) d.close();
  }, [entry]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && onPrev) {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'ArrowRight' && onNext) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      aria-labelledby="detail-title"
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        // Click on the backdrop closes.
        if (e.target === ref.current) onClose();
      }}
    >
      {entry && (
        <div className="detail-body" style={{ borderTopColor: entry.pattern.color }}>
          <div className="detail-head">
            <span className="detail-swatch" style={{ background: entry.pattern.color }} aria-hidden="true" />
            <h2 id="detail-title">{entry.pattern.label}</h2>
            {position && (
              <span className="hint">
                {position.index + 1} of {position.total}
              </span>
            )}
          </div>
          {entry.group && entry.group.name !== entry.pattern.label && <p className="detail-group">Group: {entry.group.name}</p>}
          <EarDiagram marks={entry.pattern.marks} label={entry.pattern.label} />
          <p className="detail-desc">{entry.description}</p>
          {entry.pattern.notes && <p className="detail-notes">{entry.pattern.notes}</p>}
          <div className="detail-actions">
            <button type="button" onClick={onPrev} aria-disabled={!onPrev} aria-label="Previous pattern">
              ‹ Prev
            </button>
            <button type="button" onClick={onNext} aria-disabled={!onNext} aria-label="Next pattern">
              Next ›
            </button>
            <span className="spacer" />
            {onEdit && (
              <button type="button" onClick={() => onEdit(entry.pattern.id)}>
                Edit
              </button>
            )}
            <button type="button" className="primary" onClick={onClose} autoFocus>
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
