import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { AnimalFormDialog, type AnimalFormTarget } from '../components/AnimalFormDialog';
import { AnimalRow } from '../components/AnimalRow';
import { ExperimentTabs } from '../components/ExperimentTabs';
import { filterAnimals, groupByCage, NO_CAGE } from '../domain/animals';
import { describeCageConflict, useCageConflicts } from '../hooks/useCageConflicts';
import { useLocalPref } from '../hooks/useLocalPref';

export function CagesPage() {
  const { experimentId = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);
  const [query, setQuery] = useState('');
  const [aliveOnly, setAliveOnly] = useLocalPref('cages.aliveOnly', false);
  const [target, setTarget] = useState<AnimalFormTarget>(null);

  const animals = bundle?.animals ?? [];
  const patterns = bundle?.patterns ?? [];
  const conflicts = useCageConflicts(bundle?.experiment, animals, patterns);
  const cages = useMemo(() => {
    if (!bundle) return [];
    const list = filterAnimals(bundle.animals, bundle.groups, bundle.patterns, {
      query,
      statuses: aliveOnly ? ['alive'] : [],
      groupIds: [],
    });
    return groupByCage(list);
  }, [bundle, query, aliveOnly]);

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups } = bundle;
  const cageCount = new Set(animals.map((a) => a.cage.trim()).filter((c) => c !== NO_CAGE)).size;

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>{exp.name}</span>
      </nav>
      <ExperimentTabs experimentId={exp.id} />

      <section className="panel stack" aria-label="Cage filters">
        <div className="lookup-input-head">
          <h2>Cages</h2>
          {groups.length > 0 && (
            <button type="button" className="primary" onClick={() => setTarget({ mode: 'new' })}>
              Add animal
            </button>
          )}
        </div>
        <div className="field">
          <label htmlFor="cage-search">Search</label>
          <input id="cage-search" type="search" value={query} placeholder="cage 3, M12, or a group" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={aliveOnly} onChange={(e) => setAliveOnly(e.target.checked)} />
          Only animals that are alive
        </label>
        <p className="hint" style={{ margin: 0 }}>
          {cageCount} cages, {animals.length} animals
        </p>
      </section>

      {animals.length === 0 ? (
        <section className="panel">
          <p>
            No animals yet. Add animals with a cage number to see them here
            {groups.length === 0 ? (
              <>
                {' '}
                (first <Link to={`/e/${exp.id}`}>add a group</Link>)
              </>
            ) : null}
            .
          </p>
        </section>
      ) : cages.length === 0 ? (
        <section className="panel">
          <p>No cages match.</p>
        </section>
      ) : (
        <div className="cage-grid">
          {cages.map(({ cage, animals: list }) => {
            const cageConf = conflicts.filter((c) => c.cage === cage);
            const flagged = new Set(cageConf.flatMap((c) => [c.a.id, c.b.id]));
            const groupNames = [...new Set(list.map((a) => groups.find((g) => g.id === a.groupId)?.name).filter(Boolean))];
            return (
              <section key={cage || 'none'} className={`panel cage-card${cageConf.length ? ' warn' : ''}`} aria-label={cage ? `Cage ${cage}` : 'No cage'}>
                <div className="cage-head">
                  <h2>{cage ? `Cage ${cage}` : 'No cage'}</h2>
                  <span className="hint">
                    {list.length} {list.length === 1 ? 'animal' : 'animals'}
                    {groupNames.length ? ` · ${groupNames.join(', ')}` : ''}
                  </span>
                </div>
                {cageConf.length > 0 && (
                  <ul className="warn-list">
                    {cageConf.map((c) => (
                      <li key={`${c.a.id}-${c.b.id}`}>{describeCageConflict(c)}: you can't tell them apart by ear marks.</li>
                    ))}
                  </ul>
                )}
                <ul className="hit-list">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AnimalRow
                        animal={a}
                        showCage={false}
                        group={groups.find((g) => g.id === a.groupId)}
                        pattern={patterns.find((p) => p.id === a.patternId)}
                        warn={flagged.has(a.id)}
                        onOpen={() => setTarget({ mode: 'edit', animal: a })}
                      />
                    </li>
                  ))}
                </ul>
                {cage && (
                  <button type="button" className="link-button" onClick={() => setTarget({ mode: 'new', defaults: { cage } })}>
                    Add animal to cage {cage}
                  </button>
                )}
              </section>
            );
          })}
        </div>
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
