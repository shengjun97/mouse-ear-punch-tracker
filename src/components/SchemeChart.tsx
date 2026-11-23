import { useEffect, useRef, useState } from 'react';
import { describePattern } from '../domain/describe';
import { newId } from '../domain/ids';
import { PLACE_LABEL, type NumberingScheme, type PlaceValue } from '../domain/numbering';
import type { EarMark, MarkSpec } from '../domain/types';
import { EarDiagram } from './ear/EarDiagram';
import { EarEditor } from './ear/EarEditor';

const withIds = (marks: readonly MarkSpec[]): EarMark[] => marks.map((m) => ({ ...m, id: newId() }));
const stripIds = (marks: readonly EarMark[]): MarkSpec[] => marks.map(({ ear, type, u, v }) => ({ ear, type, u, v }));

export type DigitKey = { place: PlaceValue; digit: number | 'zero' };

interface Props {
  scheme: NumberingScheme;
  /** When set, cells are buttons that open the digit editor. */
  onEdit?: (key: DigitKey, marks: MarkSpec[] | undefined) => void;
}

/** Grid of every digit's marks, per place (units, tens, hundreds). */
export function SchemeChart({ scheme, onEdit }: Props) {
  return (
    <div className="stack">
      {[...scheme.places]
        .sort((a, b) => a.value - b.value)
        .map((p) => {
          const cells: { key: DigitKey; title: string; marks: MarkSpec[] | undefined }[] = [];
          for (let d = 1; d <= 9; d++) cells.push({ key: { place: p.value, digit: d }, title: String(d * p.value), marks: p.digits[d] });
          if (onEdit || p.zero) cells.push({ key: { place: p.value, digit: 'zero' }, title: `0 (${PLACE_LABEL[p.value].split(' ')[0].toLowerCase()})`, marks: p.zero });
          return (
            <div key={p.value} className="stack">
              <h3 className="results-sub">{PLACE_LABEL[p.value]}</h3>
              <div className="scheme-grid">
                {cells.map((c) => {
                  const empty = !c.marks || c.marks.length === 0;
                  const body = (
                    <>
                      <span className="scheme-num">{c.title}</span>
                      {empty ? (
                        <span className="no-pattern">{c.key.digit === 'zero' ? 'Not used' : 'Not defined'}</span>
                      ) : (
                        <EarDiagram marks={withIds(c.marks!)} label={c.title} compact />
                      )}
                      <span className="scheme-desc">{empty ? '' : describePattern(c.marks!)}</span>
                    </>
                  );
                  return onEdit ? (
                    <button key={c.title} type="button" className="scheme-cell" onClick={() => onEdit(c.key, c.marks)} aria-label={`Edit ${c.title}`}>
                      {body}
                    </button>
                  ) : (
                    <div key={c.title} className="scheme-cell">
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}

/** Edit the marks for one digit. */
export function DigitEditorDialog({
  target,
  onSave,
  onClose,
}: {
  target: { key: DigitKey; title: string; marks: MarkSpec[] | undefined } | null;
  onSave: (marks: MarkSpec[] | undefined) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [marks, setMarks] = useState<EarMark[]>([]);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target) {
      setMarks(withIds(target.marks ?? []));
      setEditorKey((k) => k + 1);
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [target]);

  return (
    <dialog ref={ref} className="detail-dialog form-dialog" aria-labelledby="digit-title" onClose={onClose}>
      {target && (
        <div className="detail-body stack">
          <h2 id="digit-title">Marks for {target.title}</h2>
          <p className="hint" style={{ margin: 0 }}>
            Place the marks that stand for this digit. A number combines the marks of its digits.
          </p>
          <EarEditor key={editorKey} initialMarks={marks} onChange={setMarks} label={target.title} />
          <div className="detail-actions">
            <button
              type="button"
              className="danger"
              onClick={() => {
                onSave(undefined);
                onClose();
              }}
            >
              {target.key.digit === 'zero' ? 'Don’t use a zero mark' : 'Clear this digit'}
            </button>
            <span className="spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onSave(marks.length ? stripIds(marks) : undefined);
                onClose();
              }}
            >
              Save digit
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
