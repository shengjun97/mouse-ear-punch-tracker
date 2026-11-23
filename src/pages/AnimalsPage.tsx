import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { AnimalFormDialog, type AnimalFormTarget } from '../components/AnimalFormDialog';
import { AnimalRow } from '../components/AnimalRow';
import { ExperimentTabs } from '../components/ExperimentTabs';
import { filterAnimals, STATUS_LABEL } from '../domain/animals';
import type { AnimalStatus } from '../domain/models';
import { describeCageConflict, useCageConflicts } from '../hooks/useCageConflicts';

export function AnimalsPage() {
  const { experimentId = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<AnimalStatus[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [target, setTarget] = useState<AnimalFormTarget>(null);

  const animals = bundle?.animals ?? [];
  const patterns = bundle?.patterns ?? [];
  const conflicts = useCageConflicts(bundle?.experiment, animals, patterns);
  const flagged = useMemo(() => new Set(conflicts.flatMap((c) => [c.a.id, c.b.id])), [conflicts]);
  const list = useMemo(
    () => (bundle ? filterAnimals(bundle.animals, bundle.groups, bundle.patterns, { query, statuses, groupIds }) : []),
    [bundle, query, statuses, groupIds],
  );

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups } = bundle;
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const alive = animals.filter((a) => a.status === 'alive').length;
  const filtered = query.trim() !== '' || statuses.length > 0 || groupIds.length > 0;

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>{exp.name}</span>
      </nav>
      <ExperimentTabs experimentId={exp.id} />

      {groups.length === 0 ? (
        <section className="panel">
          <p>
            Add a group first: every animal belongs to a group. <Link to={`/e/${exp.id}`}>Go to patterns</Link>
          </p>
        </section>
      ) : (
        <>
          <section className="panel stack" aria-label="Animal filters">
            <div className="lookup-input-head">
              <h2>Animals</h2>
              <button type="button" className="primary" onClick={() => setTarget({ mode: 'new' })}>
                Add animal
              </button>
            </div>
            <div className="field">
              <label htmlFor="animal-search">Search</label>
              <input
                id="animal-search"
                type="search"
                value={query}
                placeholder="M12, cage 3, a group, or a genotype"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="chips" role="group" aria-label="Status">
              {(Object.keys(STATUS_LABEL) as AnimalStatus[]).map((s) => (
                <button key={s} type="button" className="chip" aria-pressed={statuses.includes(s)} onClick={() => setStatuses(toggle(statuses, s))}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {groups.length > 1 && (
              <div className="chips" role="group" aria-label="Groups">
                {groups.map((g) => (
                  <button key={g.id} type="button" className="chip" aria-pressed={groupIds.includes(g.id)} onClick={() => setGroupIds(toggle(groupIds, g.id))}>
                    <span className="pc-swatch" style={{ background: g.color }} aria-hidden="true" />
                    {g.name}
                  </button>
                ))}
              </div>
            )}
            <p className="hint" aria-live="polite" style={{ margin: 0 }}>
              {filtered ? `${list.length} of ${animals.length} animals` : `${animals.length} animals, ${alive} alive`}
            </p>
          </section>

          {conflicts.length > 0 && (
            <section className="panel warn">
              <h2>Animals in the same cage can't be told apart</h2>
              <ul>
                {conflicts.map((c) => (
                  <li key={`${c.a.id}-${c.b.id}`}>
                    Cage {c.cage}: {describeCageConflict(c)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {animals.length === 0 ? (
            <section className="panel">
              <p>No animals yet. Animal records are optional: add them if you want to track IDs, cages and status.</p>
            </section>
          ) : list.length === 0 ? (
            <section className="panel">
              <p>No animals match. Try a different search or clear the filters.</p>
            </section>
          ) : (
            <ul className="hit-list">
              {list.map((a) => (
                <li key={a.id}>
                  <AnimalRow
                    animal={a}
                    group={groups.find((g) => g.id === a.groupId)}
                    pattern={patterns.find((p) => p.id === a.patternId)}
                    warn={flagged.has(a.id)}
                    onOpen={() => setTarget({ mode: 'edit', animal: a })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AnimalFormDialog
        target={target}
        experiment={exp}
        groups={groups}
        patterns={patterns}
        animals={animals}
        onClose={() => setTarget(null)}
        onEditPattern={(id) => navigate(`/e/${exp.id}/p/${id}`)}
      />
    </div>
  );
}
