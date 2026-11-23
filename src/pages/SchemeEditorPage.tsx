import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { repo } from '../db/repo';
import { AutosaveField } from '../components/common/AutosaveField';
import { DigitEditorDialog, SchemeChart, type DigitKey } from '../components/SchemeChart';
import { findConflicts } from '../domain/matching';
import { marksForNumber, maxContiguous, type NumberingScheme } from '../domain/numbering';
import type { MarkSpec } from '../domain/types';

const CHECK_LIMIT = 399;

export function SchemeEditorPage() {
  const { schemeId = '' } = useParams();
  const scheme = useLiveQuery(() => db.schemes.get(schemeId), [schemeId], null);
  const [editing, setEditing] = useState<{ key: DigitKey; title: string; marks: MarkSpec[] | undefined } | null>(null);

  const check = useMemo(() => {
    if (!scheme) return null;
    const max = maxContiguous(scheme, CHECK_LIMIT);
    const nums = Array.from({ length: max }, (_, i) => {
      const r = marksForNumber(scheme, i + 1);
      return { n: i + 1, marks: r.ok ? r.marks : [] };
    });
    return { max, conflicts: findConflicts(nums, 0.15) };
  }, [scheme]);

  if (scheme === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (!scheme)
    return (
      <div className="page">
        <p>This numbering scheme doesn't exist on this device.</p>
        <Link to="/templates">Back to templates</Link>
      </div>
    );

  const save = (next: NumberingScheme) => repo.saveScheme(next);
  const saveDigit = (key: DigitKey, marks: MarkSpec[] | undefined) => {
    const next: NumberingScheme = structuredClone(scheme);
    const place = next.places.find((p) => p.value === key.place);
    if (!place) return;
    if (key.digit === 'zero') place.zero = marks;
    else if (marks) place.digits[key.digit] = marks;
    else delete place.digits[key.digit];
    void save(next);
  };
  const hasHundreds = scheme.places.some((p) => p.value === 100);

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <Link to="/templates">Templates</Link>{' '}
        <span aria-hidden="true">›</span> <span>{scheme.name}</span>
      </nav>

      <section className="panel stack">
        <AutosaveField label="Scheme name" className="title-field" value={scheme.name} required onSave={(name) => save({ ...scheme, name })} />
        <AutosaveField label="Description" multiline value={scheme.description} onSave={(description) => save({ ...scheme, description })} />
        {scheme.source && <p className="hint" style={{ margin: 0 }}>{scheme.source}</p>}
      </section>

      {check && (
        <section className={`panel stack${check.conflicts.length ? ' warn' : ''}`} aria-live="polite">
          <strong>{check.max > 0 ? `Numbers 1–${check.max} can be made.` : 'No numbers can be made yet: define the digit 1 first.'}</strong>
          {check.conflicts.length > 0 ? (
            <>
              <span>
                {check.conflicts.length} pairs of numbers look the same or very similar, for example{' '}
                {check.conflicts
                  .slice(0, 6)
                  .map((c) => `${c.a.n} and ${c.b.n}`)
                  .join('; ')}
                . Move or change marks so every number is distinct.
              </span>
            </>
          ) : (
            check.max > 0 && <span className="hint">Every number in that range has a distinct pattern.</span>
          )}
        </section>
      )}

      <section className="panel stack">
        <div className="lookup-input-head">
          <h2>Digits</h2>
          <button
            type="button"
            onClick={() =>
              save({
                ...scheme,
                places: hasHundreds ? scheme.places.filter((p) => p.value !== 100) : [...scheme.places, { value: 100, digits: {} }],
              })
            }
          >
            {hasHundreds ? 'Remove hundreds' : 'Add hundreds'}
          </button>
        </div>
        <p className="hint" style={{ margin: 0 }}>Tap a digit to place its marks. A number such as 47 combines the marks for 40 and 7.</p>
        <SchemeChart
          scheme={scheme}
          onEdit={(key, marks) =>
            setEditing({ key, marks, title: key.digit === 'zero' ? `zero (${key.place === 1 ? 'units' : key.place === 10 ? 'tens' : 'hundreds'})` : String(key.digit * key.place) })
          }
        />
      </section>

      <DigitEditorDialog target={editing} onClose={() => setEditing(null)} onSave={(marks) => editing && saveDigit(editing.key, marks)} />
    </div>
  );
}
