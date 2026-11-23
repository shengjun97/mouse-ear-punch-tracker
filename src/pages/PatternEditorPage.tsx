import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { AutosaveField } from '../components/common/AutosaveField';
import { ColorPicker } from '../components/common/ColorPicker';
import { ConflictCompare } from '../components/ConflictCompare';
import { EarEditor } from '../components/ear/EarEditor';
import { classifySimilarity, comparePatterns } from '../domain/matching';
import type { EarMark } from '../domain/types';

export function PatternEditorPage() {
  const { experimentId = '', patternId = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);
  const pattern = bundle?.patterns.find((p) => p.id === patternId);

  // Marks as currently edited (saved on every committed change).
  const [liveMarks, setLiveMarks] = useState<EarMark[] | null>(null);
  useEffect(() => {
    setLiveMarks(null);
  }, [patternId]);
  const marks = liveMarks ?? pattern?.marks ?? [];

  const saveMarks = useCallback(
    (m: EarMark[]) => {
      setLiveMarks(m);
      void repo.updatePattern(patternId, { marks: m });
    },
    [patternId],
  );

  const conflicts = useMemo(() => {
    if (!bundle || !pattern) return [];
    const t = bundle.experiment.similarityThreshold;
    return bundle.patterns
      .filter((o) => o.id !== pattern.id)
      .map((o) => ({ other: o, kind: classifySimilarity(marks, o.marks, t) }))
      .filter((x) => x.kind !== 'distinct')
      .map((x) => ({ ...x, maxPairDistance: comparePatterns(marks, x.other.marks).maxPairDistance }));
  }, [bundle, pattern, marks]);

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (!bundle || !pattern)
    return (
      <div className="page">
        <p>This pattern doesn't exist on this device.</p>
        <Link to={bundle ? `/e/${experimentId}` : '/'}>Back</Link>
      </div>
    );

  const { experiment: exp, groups } = bundle;
  const group = groups.find((g) => g.id === pattern.groupId);
  const backTo = `/e/${exp.id}`;

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <Link to={backTo}>{exp.name}</Link>{' '}
        <span aria-hidden="true">›</span> <span>{pattern.label}</span>
      </nav>

      <section className="panel stack">
        <div className="editor-meta">
          <AutosaveField
            label={exp.patternMode === 'individual' ? 'Animal label' : 'Label'}
            className="title-field"
            value={pattern.label}
            required
            onSave={(label) => repo.updatePattern(pattern.id, { label })}
          />
          <div className="field">
            <label htmlFor="pattern-group">Group</label>
            <select
              id="pattern-group"
              value={pattern.groupId}
              onChange={(e) => {
                const to = groups.find((g) => g.id === e.target.value);
                if (!to) return;
                // Label and color follow the new group unless they were customized.
                void repo.updatePattern(pattern.id, {
                  groupId: to.id,
                  ...(group && pattern.label === group.name ? { label: to.name } : {}),
                  ...(group && pattern.color === group.color ? { color: to.color } : {}),
                });
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <EarEditor key={pattern.id} initialMarks={pattern.marks} onChange={saveMarks} label={pattern.label} />
        <p className="saved-note">Changes save automatically on this device.</p>
        {(() => {
          const users = bundle.animals.filter((a) => a.patternId === pattern.id);
          if (!users.length) return null;
          return (
            <p className="hint" style={{ margin: 0 }}>
              Used by{' '}
              {users
                .map((a) => `${a.animalCode}${a.cage ? ` (cage ${a.cage})` : ''}${a.status !== 'alive' ? ` [${a.status}]` : ''}`)
                .join(', ')}
              . <Link to={`/e/${exp.id}/animals`}>Animals</Link>
            </p>
          );
        })()}
      </section>

      {conflicts.length > 0 && (
        <section className="panel warn" aria-live="polite" aria-labelledby="pe-conflicts">
          <h2 id="pe-conflicts">
            {conflicts.some((c) => c.kind === 'identical') ? 'Same as another pattern' : 'Similar to another pattern'}
          </h2>
          {conflicts.map((c) => (
            <ConflictCompare
              key={c.other.id}
              a={{ ...pattern, marks }}
              b={c.other}
              kind={c.kind as 'identical' | 'confusable'}
              maxPairDistance={c.maxPairDistance}
              threshold={exp.similarityThreshold}
              onOpen={(id) => id !== pattern.id && navigate(`/e/${exp.id}/p/${id}`)}
            />
          ))}
        </section>
      )}

      <section className="panel stack">
        <ColorPicker label="Color" value={pattern.color} onChange={(color) => repo.updatePattern(pattern.id, { color })} />
        {group && pattern.color !== group.color && (
          <div>
            <button type="button" className="link-button" onClick={() => repo.updatePattern(pattern.id, { color: group.color })}>
              Use group color
            </button>
          </div>
        )}
        <AutosaveField label="Notes" multiline value={pattern.notes} onSave={(notes) => repo.updatePattern(pattern.id, { notes })} />
      </section>

      <div className="row-actions">
        <button type="button" onClick={() => navigate(backTo)}>
          Done
        </button>
        <button
          type="button"
          onClick={async () => {
            const c = await repo.duplicatePattern(pattern.id);
            if (c) navigate(`/e/${exp.id}/p/${c.id}`);
          }}
        >
          Duplicate pattern
        </button>
        <button
          type="button"
          className="danger"
          onClick={async () => {
            if (!window.confirm(`Delete pattern "${pattern.label}"? This can't be undone.`)) return;
            await repo.deletePattern(pattern.id);
            navigate(backTo);
          }}
        >
          Delete pattern
        </button>
      </div>
    </div>
  );
}
