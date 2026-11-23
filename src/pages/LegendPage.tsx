import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { ExperimentTabs } from '../components/ExperimentTabs';
import { PatternCard } from '../components/PatternCard';
import { PatternDetailDialog } from '../components/PatternDetailDialog';
import { buildLegend, groupEntries, type LegendEntry } from '../domain/legend';
import { findConflicts } from '../domain/matching';
import { animalsByPattern } from '../domain/animals';
import { useLocalPref } from '../hooks/useLocalPref';

type CardSize = 'S' | 'M' | 'L';
const SIZE_LABEL: Record<CardSize, string> = { S: 'Small', M: 'Medium', L: 'Large' };

export function LegendPage() {
  const { experimentId = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);

  const [query, setQuery] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [size, setSize] = useLocalPref<CardSize>('legend.size', 'M');
  const [byGroup, setByGroup] = useLocalPref('legend.byGroup', true);
  const [showNotes, setShowNotes] = useLocalPref('legend.showNotes', false);
  const [openId, setOpenId] = useState<string | null>(null);

  const byPattern = useMemo(() => animalsByPattern(bundle?.animals ?? []), [bundle]);
  const entries = useMemo(
    () => (bundle ? buildLegend(bundle.patterns, bundle.groups, { query, groupIds }, byPattern) : []),
    [bundle, query, groupIds, byPattern],
  );
  const conflicted = useMemo(() => {
    const s = new Set<string>();
    if (bundle) for (const c of findConflicts(bundle.patterns, bundle.experiment.similarityThreshold)) s.add(c.a.id).add(c.b.id);
    return s;
  }, [bundle]);

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups, patterns } = bundle;
  const openIndex = entries.findIndex((e) => e.pattern.id === openId);
  const openEntry = openIndex >= 0 ? entries[openIndex] : null;
  const toggleGroup = (id: string) =>
    setGroupIds(groupIds.includes(id) ? groupIds.filter((x) => x !== id) : [...groupIds, id]);
  const filtered = query.trim() !== '' || groupIds.length > 0;

  const card = (e: LegendEntry, showGroup: boolean) => (
    <PatternCard
      key={e.pattern.id}
      pattern={e.pattern}
      subtitle={showGroup && e.group && e.group.name !== e.pattern.label ? e.group.name : undefined}
      notes={showNotes ? e.pattern.notes : undefined}
      animals={byPattern.get(e.pattern.id)?.map((a) => (a.cage ? `${a.animalCode} (cage ${a.cage})` : a.animalCode))}
      badge={conflicted.has(e.pattern.id) ? <span className="badge warn-badge">Similar</span> : undefined}
      openLabel="Enlarge"
      onOpen={() => setOpenId(e.pattern.id)}
    />
  );

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>{exp.name}</span>
      </nav>
      <ExperimentTabs experimentId={exp.id} />

      <section className="panel stack legend-controls" aria-label="Legend filters">
        <div className="field">
          <label htmlFor="legend-search">Search</label>
          <input
            id="legend-search"
            type="search"
            value={query}
            placeholder="Group, mark, note, M12, or cage 3"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {groups.length > 1 && (
          <div className="chips" role="group" aria-label="Show groups">
            {groups.map((g) => (
              <button key={g.id} type="button" className="chip" aria-pressed={groupIds.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                <span className="pc-swatch" style={{ background: g.color }} aria-hidden="true" />
                {g.name}
              </button>
            ))}
          </div>
        )}
        <div className="legend-view-opts">
          <div className="segmented" role="group" aria-label="Card size">
            {(['S', 'M', 'L'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)}>
                {SIZE_LABEL[s]}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={byGroup} onChange={(e) => setByGroup(e.target.checked)} />
            Group headings
          </label>
          <label className="check">
            <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} />
            Show notes
          </label>
          {filtered && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setQuery('');
                setGroupIds([]);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="hint" aria-live="polite">
          {filtered ? `${entries.length} of ${patterns.length} patterns` : `${patterns.length} patterns`}
        </p>
      </section>

      {patterns.length === 0 ? (
        <section className="panel">
          <p>
            No patterns yet. <Link to={`/e/${exp.id}`}>Add groups and patterns</Link> to build the legend.
          </p>
        </section>
      ) : entries.length === 0 ? (
        <section className="panel">
          <p>No patterns match. Try a different search or clear the filters.</p>
        </section>
      ) : byGroup ? (
        groupEntries(entries).map((run) => (
          <section key={run.group?.id ?? 'none'} className="legend-group" aria-label={run.group?.name ?? 'No group'}>
            <h2 className="legend-group-head">
              <span className="pc-swatch" style={{ background: run.group?.color }} aria-hidden="true" />
              {run.group?.name ?? 'No group'}
              <span className="hint">{run.entries.length}</span>
            </h2>
            <div className={`card-grid size-${size}`}>{run.entries.map((e) => card(e, false))}</div>
          </section>
        ))
      ) : (
        <div className={`card-grid size-${size}`}>{entries.map((e) => card(e, true))}</div>
      )}

      <PatternDetailDialog
        entry={openEntry}
        position={openEntry ? { index: openIndex, total: entries.length } : undefined}
        onClose={() => setOpenId(null)}
        onPrev={openIndex > 0 ? () => setOpenId(entries[openIndex - 1].pattern.id) : undefined}
        onNext={openIndex >= 0 && openIndex < entries.length - 1 ? () => setOpenId(entries[openIndex + 1].pattern.id) : undefined}
        onEdit={(id) => navigate(`/e/${exp.id}/p/${id}`)}
      />
    </div>
  );
}
