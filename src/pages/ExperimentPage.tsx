import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { AutosaveField } from '../components/common/AutosaveField';
import { ColorPicker } from '../components/common/ColorPicker';
import { ConflictCompare } from '../components/ConflictCompare';
import { ExperimentTabs } from '../components/ExperimentTabs';
import { AddPatternsDialog, type AddPatternsMode } from '../components/AddPatternsDialog';
import { PatternCard } from '../components/PatternCard';
import { findConflicts } from '../domain/matching';
import type { Group, Pattern } from '../domain/models';

export function ExperimentPage() {
  const { experimentId = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);
  const [openConflict, setOpenConflict] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<AddPatternsMode>(null);

  const conflicts = useMemo(
    () => (bundle ? findConflicts(bundle.patterns, bundle.experiment.similarityThreshold) : []),
    [bundle],
  );
  const conflicted = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.a.id);
      s.add(c.b.id);
    }
    return s;
  }, [conflicts]);

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups, patterns } = bundle;
  const openPattern = (id: string) => navigate(`/e/${exp.id}/p/${id}`);
  const isIndividual = exp.patternMode === 'individual';

  const addPattern = async (g: Group) => {
    const p = await repo.addPattern(exp.id, g.id);
    openPattern(p.id);
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>{exp.name}</span>
      </nav>
      <ExperimentTabs experimentId={exp.id} />

      <section className="panel stack">
        <AutosaveField
          label="Experiment name"
          className="title-field"
          value={exp.name}
          required
          onSave={(name) => repo.updateExperiment(exp.id, { name })}
        />
        <details className="settings">
          <summary>Experiment settings</summary>
          <div className="stack">
            <fieldset className="radio-row">
              <legend>Each pattern stands for</legend>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={!isIndividual}
                  onChange={() => repo.updateExperiment(exp.id, { patternMode: 'group' })}
                />
                A whole group
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={isIndividual}
                  onChange={() => repo.updateExperiment(exp.id, { patternMode: 'individual' })}
                />
                One animal in a group
              </label>
            </fieldset>
            <div className="field">
              <label htmlFor="threshold">
                Warn when marks are closer than {Math.round(exp.similarityThreshold * 100)}% of the ear size
              </label>
              <input
                id="threshold"
                type="range"
                min="0.05"
                max="0.3"
                step="0.01"
                value={exp.similarityThreshold}
                onChange={(e) => repo.updateExperiment(exp.id, { similarityThreshold: Number(e.target.value) })}
              />
              <p className="hint">Holes and notches are never treated as similar to each other.</p>
            </div>
            <AutosaveField label="Notes" multiline value={exp.notes} onSave={(notes) => repo.updateExperiment(exp.id, { notes })} />
          </div>
        </details>
      </section>

      {conflicts.length > 0 && (
        <section className="panel warn" aria-labelledby="conflicts-h">
          <h2 id="conflicts-h">
            {conflicts.length === 1 ? '1 pair of patterns' : `${conflicts.length} pairs of patterns`} could be confused
          </h2>
          <ul className="row-list">
            {conflicts.map((c, i) => (
              <li key={`${c.a.id}-${c.b.id}`} className="conflict-row">
                <div className="row">
                  <span className="row-main">
                    <span className="row-title">
                      {c.a.label} and {c.b.label}
                    </span>
                    <span className="row-sub">{c.kind === 'identical' ? 'Identical' : 'Very similar'}</span>
                  </span>
                  <div className="row-actions">
                    <button type="button" aria-expanded={openConflict === i} onClick={() => setOpenConflict(openConflict === i ? null : i)}>
                      {openConflict === i ? 'Hide' : 'Compare'}
                    </button>
                  </div>
                </div>
                {openConflict === i && (
                  <ConflictCompare
                    a={c.a}
                    b={c.b}
                    kind={c.kind}
                    maxPairDistance={c.maxPairDistance}
                    threshold={exp.similarityThreshold}
                    onOpen={openPattern}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length === 0 && (
        <section className="panel">
          <h2>Add your first group</h2>
          <p className="hint">
            Groups hold the patterns. {isIndividual ? 'Each pattern will identify one animal in its group.' : 'Each group usually has one pattern.'}
          </p>
        </section>
      )}

      {groups.map((g) => (
        <GroupSection
          key={g.id}
          group={g}
          patterns={patterns.filter((p) => p.groupId === g.id)}
          individual={isIndividual}
          conflicted={conflicted}
          onAddPattern={() => addPattern(g)}
          onOpenPattern={openPattern}
          animalCount={bundle.animals.filter((a) => a.groupId === g.id).length}
        />
      ))}

      <div className="row-actions">
        <button type="button" className="primary" onClick={() => repo.addGroup(exp.id)}>
          Add group
        </button>
        <button type="button" onClick={() => setAddMode('numbered')}>
          Add numbered patterns…
        </button>
        <button type="button" onClick={() => setAddMode('template')}>
          Add from template…
        </button>
      </div>

      <AddPatternsDialog mode={addMode} experiment={exp} groups={groups} patterns={patterns} onClose={() => setAddMode(null)} />
    </div>
  );
}

interface GroupSectionProps {
  group: Group;
  patterns: Pattern[];
  individual: boolean;
  conflicted: Set<string>;
  onAddPattern: () => void;
  onOpenPattern: (id: string) => void;
  animalCount: number;
}

function GroupSection({ group, patterns, individual, conflicted, onAddPattern, onOpenPattern, animalCount }: GroupSectionProps) {
  return (
    <section className="panel group" style={{ borderLeftColor: group.color }} aria-label={`Group ${group.name}`}>
      <div className="group-head">
        <AutosaveField
          label="Group name"
          className="group-name"
          value={group.name}
          required
          onSave={(name) => repo.updateGroup(group.id, { name })}
        />
        <div className="row-actions">
          <button
            type="button"
            className="danger"
            onClick={() => {
              const n = patterns.length;
              const parts = [
                n ? `${n} pattern${n > 1 ? 's' : ''}` : '',
                animalCount ? `${animalCount} animal record${animalCount > 1 ? 's' : ''}` : '',
              ].filter(Boolean);
              if (window.confirm(`Delete group "${group.name}"${parts.length ? ` and its ${parts.join(' and ')}` : ''}? This can't be undone.`))
                void repo.deleteGroup(group.id);
            }}
          >
            Delete group
          </button>
        </div>
      </div>
      <details className="settings">
        <summary>Group color and notes</summary>
        <div className="stack">
          <ColorPicker label="Group color" value={group.color} onChange={(color) => repo.updateGroup(group.id, { color })} />
          <AutosaveField label="Group notes" multiline value={group.notes} onSave={(notes) => repo.updateGroup(group.id, { notes })} />
        </div>
      </details>

      {patterns.length === 0 ? (
        <p className="hint">No pattern yet. "No punch" counts as a pattern too: add one and leave the ears empty.</p>
      ) : (
        <div className="card-grid">
          {patterns.map((p) => (
            <PatternCard
              key={p.id}
              pattern={p}
              onOpen={() => onOpenPattern(p.id)}
              badge={conflicted.has(p.id) ? <span className="badge warn-badge">Similar</span> : undefined}
              actions={
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const c = await repo.duplicatePattern(p.id);
                      if (c) onOpenPattern(c.id);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (window.confirm(`Delete pattern "${p.label}"? This can't be undone.`)) void repo.deletePattern(p.id);
                    }}
                  >
                    Delete
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
      {(individual || patterns.length === 0) && (
        <div>
          <button type="button" onClick={onAddPattern}>
            {individual ? 'Add animal pattern' : 'Add pattern'}
          </button>
        </div>
      )}
      {!individual && patterns.length > 0 && (
        <button type="button" className="link-button" onClick={onAddPattern}>
          Add another pattern to this group
        </button>
      )}
    </section>
  );
}
