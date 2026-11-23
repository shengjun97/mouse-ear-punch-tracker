import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { repo } from '../db/repo';
import type { PatternMode } from '../domain/models';
import { BackupPanel } from '../components/BackupPanel';
import { requestPersistentStorage } from '../components/AppStatus';

const fmtDate = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ExperimentListPage() {
  const navigate = useNavigate();
  const experiments = useLiveQuery(() => repo.listExperiments(), []);
  const counts = useLiveQuery(async () => {
    const [groups, patterns, animals] = await Promise.all([db.groups.toArray(), db.patterns.toArray(), db.animals.toArray()]);
    const c = new Map<string, { groups: number; patterns: number; animals: number }>();
    const get = (id: string) => c.get(id) ?? { groups: 0, patterns: 0, animals: 0 };
    for (const g of groups) c.set(g.experimentId, { ...get(g.experimentId), groups: get(g.experimentId).groups + 1 });
    for (const p of patterns) c.set(p.experimentId, { ...get(p.experimentId), patterns: get(p.experimentId).patterns + 1 });
    for (const a of animals) c.set(a.experimentId, { ...get(a.experimentId), animals: get(a.experimentId).animals + 1 });
    return c;
  }, []);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<PatternMode>('group');
  const [error, setError] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name for the experiment.');
      return;
    }
    const exp = await repo.createExperiment(name.trim(), mode);
    void requestPersistentStorage();
    setName('');
    navigate(`/e/${exp.id}`);
  };

  return (
    <div className="page">
      <section className="panel">
        <h2>New experiment</h2>
        <form className="stack" onSubmit={create} noValidate>
          <div className="field">
            <label htmlFor="new-exp-name">Name</label>
            <input
              id="new-exp-name"
              value={name}
              placeholder="Cohort 3 treatment study"
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'new-exp-error' : undefined}
            />
            {error && (
              <p id="new-exp-error" className="error">
                {error}
              </p>
            )}
          </div>
          <fieldset className="radio-row">
            <legend>Each pattern stands for</legend>
            <label>
              <input type="radio" name="mode" checked={mode === 'group'} onChange={() => setMode('group')} />
              A whole group
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === 'individual'} onChange={() => setMode('individual')} />
              One animal in a group
            </label>
          </fieldset>
          <div>
            <button type="submit" className="primary">
              Create experiment
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Your experiments</h2>
        {experiments === undefined ? (
          <p className="hint">Loading…</p>
        ) : experiments.length === 0 ? (
          <p className="hint">No experiments yet. Create one above to start defining ear punch patterns.</p>
        ) : (
          <ul className="row-list">
            {experiments.map((x) => {
              const c = counts?.get(x.id) ?? { groups: 0, patterns: 0, animals: 0 };
              return (
                <li key={x.id} className="row">
                  <Link to={`/e/${x.id}`} className="row-main">
                    <span className="row-title">{x.name}</span>
                    <span className="row-sub">
                      {c.groups} groups · {c.patterns} patterns · {c.animals} animals · {x.patternMode === 'group' ? 'group patterns' : 'per-animal patterns'} · updated {fmtDate(x.updatedAt)}
                    </span>
                  </Link>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={async () => {
                        const copy = await repo.duplicateExperiment(x.id);
                        if (copy) navigate(`/e/${copy.id}`);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (window.confirm(`Delete "${x.name}" with its ${c.groups} groups, ${c.patterns} patterns and ${c.animals} animal records? This can't be undone.`))
                          void repo.deleteExperiment(x.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BackupPanel />
    </div>
  );
}
