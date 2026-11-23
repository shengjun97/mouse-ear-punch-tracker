import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { EarDiagram } from '../components/ear/EarDiagram';
import { EarEditor } from '../components/ear/EarEditor';
import { ExperimentTabs } from '../components/ExperimentTabs';
import { PatternDetailDialog } from '../components/PatternDetailDialog';
import { describePattern } from '../domain/describe';
import type { LegendEntry } from '../domain/legend';
import { DEFAULT_LOOKUP_TOLERANCE, describeDifference, lookup, type LookupHit } from '../domain/lookup';
import type { Group, Pattern } from '../domain/models';
import type { EarMark } from '../domain/types';
import { useLocalPref } from '../hooks/useLocalPref';
import { animalsByPattern } from '../domain/animals';
import type { Animal } from '../domain/models';

const MAX_CLOSEST = 5;

export function LookupPage() {
  const { experimentId = '' } = useParams();
  const navigate = useNavigate();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);

  const [observed, setObserved] = useState<EarMark[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [tolerance, setTolerance] = useLocalPref('lookup.tolerance', DEFAULT_LOOKUP_TOLERANCE);
  const [openId, setOpenId] = useState<string | null>(null);

  const candidates = useMemo(
    () => (bundle ? bundle.patterns.filter((p) => groupIds.length === 0 || groupIds.includes(p.groupId)) : []),
    [bundle, groupIds],
  );
  const hits = useMemo(() => lookup(observed, candidates, tolerance), [observed, candidates, tolerance]);
  const byPattern = useMemo(() => animalsByPattern(bundle?.animals ?? []), [bundle]);

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups, patterns } = bundle;
  const groupOf = (p: Pattern) => groups.find((g) => g.id === p.groupId);
  const matches = hits.filter((h) => h.kind === 'match');
  const closest = hits.filter((h) => h.kind !== 'match').slice(0, MAX_CLOSEST);
  const clear = () => {
    setObserved([]);
    setResetKey((k) => k + 1);
  };
  const toggleGroup = (id: string) =>
    setGroupIds(groupIds.includes(id) ? groupIds.filter((x) => x !== id) : [...groupIds, id]);

  const shown = [...matches, ...closest];
  const openIndex = shown.findIndex((h) => h.item.id === openId);
  const openEntry: LegendEntry | null =
    openIndex >= 0
      ? { pattern: shown[openIndex].item, group: groupOf(shown[openIndex].item), description: describePattern(shown[openIndex].item.marks) }
      : null;

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>{exp.name}</span>
      </nav>
      <ExperimentTabs experimentId={exp.id} />

      {patterns.length === 0 ? (
        <section className="panel">
          <p>
            No patterns to look up yet. <Link to={`/e/${exp.id}`}>Add groups and patterns</Link> first.
          </p>
        </section>
      ) : (
        <div className="lookup-layout">
          <section className="panel stack" aria-labelledby="lookup-input-h">
            <div className="lookup-input-head">
              <h2 id="lookup-input-h">Tap the marks you see</h2>
              <button type="button" className="primary" onClick={clear}>
                Clear marks
              </button>
            </div>
            <EarEditor key={resetKey} onChange={setObserved} label="Observed marks" />
            {groups.length > 1 && (
              <div className="stack">
                <span className="hint">Only look in these groups (optional)</span>
                <div className="chips" role="group" aria-label="Limit lookup to groups">
                  {groups.map((g) => (
                    <button key={g.id} type="button" className="chip" aria-pressed={groupIds.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                      <span className="pc-swatch" style={{ background: g.color }} aria-hidden="true" />
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <details className="settings">
              <summary>Tap tolerance</summary>
              <div className="field">
                <label htmlFor="tolerance">
                  Count a mark as matching when it is within {Math.round(tolerance * 100)}% of the ear size
                </label>
                <input
                  id="tolerance"
                  type="range"
                  min="0.1"
                  max="0.4"
                  step="0.01"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                />
                <p className="hint">Holes and notches, and left and right ears, always have to match exactly.</p>
              </div>
            </details>
          </section>

          <div className="lookup-sticky" aria-hidden="true">
            <span className="lookup-sticky-text">
              {matches.length === 1 ? (
                <>
                  <span className="pc-swatch" style={{ background: matches[0].item.color }} />
                  <strong>Match: {matches[0].item.label}</strong>
                  {groupOf(matches[0].item) && groupOf(matches[0].item)!.name !== matches[0].item.label && (
                    <span className="hint"> · {groupOf(matches[0].item)!.name}</span>
                  )}
                </>
              ) : matches.length > 1 ? (
                <strong>{matches.length} patterns match</strong>
              ) : (
                <strong>No exact match</strong>
              )}
            </span>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => document.getElementById('lookup-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Details
            </button>
          </div>

          <section id="lookup-results" className="panel stack lookup-results" aria-labelledby="lookup-results-h" aria-live="polite">
            <h2 id="lookup-results-h" className="sr-only">
              Results
            </h2>
            <ResultSummary matches={matches} groupOf={groupOf} onOpen={setOpenId} searched={candidates.length} byPattern={byPattern} />
            {closest.length > 0 && (
              <>
                <h3 className="results-sub">{matches.length > 0 ? 'Next closest' : 'Closest patterns'}</h3>
                <ul className="hit-list">
                  {closest.map((h) => (
                    <HitRow key={h.item.id} hit={h} group={groupOf(h.item)} animals={byPattern.get(h.item.id)} onOpen={() => setOpenId(h.item.id)} />
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}

      <PatternDetailDialog
        entry={openEntry}
        position={openEntry ? { index: openIndex, total: shown.length } : undefined}
        onClose={() => setOpenId(null)}
        onPrev={openIndex > 0 ? () => setOpenId(shown[openIndex - 1].item.id) : undefined}
        onNext={openIndex >= 0 && openIndex < shown.length - 1 ? () => setOpenId(shown[openIndex + 1].item.id) : undefined}
        onEdit={(id) => navigate(`/e/${exp.id}/p/${id}`)}
      />
    </div>
  );
}

function ResultSummary({
  matches,
  groupOf,
  onOpen,
  searched,
  byPattern,
}: {
  matches: LookupHit<Pattern>[];
  groupOf: (p: Pattern) => Group | undefined;
  onOpen: (id: string) => void;
  searched: number;
  byPattern: Map<string, Animal[]>;
}) {
  if (matches.length === 0)
    return (
      <div className="result-banner none">
        <strong>No exact match</strong>
        <span>
          None of the {searched} patterns has exactly these marks. Check the ears again, or see the closest patterns below.
        </span>
      </div>
    );
  if (matches.length > 1)
    return (
      <div className="stack">
        <div className="result-banner ambiguous">
          <strong>{matches.length} patterns match</strong>
          <span>These patterns are too similar to tell apart from these marks.</span>
        </div>
        <ul className="hit-list">
          {matches.map((h) => (
            <HitRow key={h.item.id} hit={h} group={groupOf(h.item)} animals={byPattern.get(h.item.id)} onOpen={() => onOpen(h.item.id)} />
          ))}
        </ul>
      </div>
    );
  const p = matches[0].item;
  const g = groupOf(p);
  return (
    <button type="button" className="match-card" style={{ borderColor: p.color }} onClick={() => onOpen(p.id)}>
      <span className="match-kicker">Match</span>
      <span className="match-title">
        <span className="detail-swatch" style={{ background: p.color }} aria-hidden="true" />
        {p.label}
      </span>
      {g && g.name !== p.label && <span className="match-group">Group: {g.name}</span>}
      <EarDiagram marks={p.marks} label={p.label} compact />
      <span className="match-desc">{describePattern(p.marks)}</span>
      <AnimalList animals={byPattern.get(p.id)} big />
    </button>
  );
}

/** Animals carrying a pattern, alive ones first; inactive ones marked. */
function AnimalList({ animals, big }: { animals?: Animal[]; big?: boolean }) {
  if (!animals?.length) return null;
  const sorted = [...animals].sort((a, b) => Number(a.status !== 'alive') - Number(b.status !== 'alive'));
  return (
    <span className={big ? 'match-animals' : 'hit-diff'}>
      {'Animals: '}
      {sorted
        .map((a) => `${a.animalCode}${a.cage ? ` (cage ${a.cage})` : ''}${a.status !== 'alive' ? ` [${a.status}]` : ''}`)
        .join(', ')}
    </span>
  );
}

function HitRow({ hit, group, animals, onOpen }: { hit: LookupHit<Pattern>; group: Group | undefined; animals?: Animal[]; onOpen: () => void }) {
  const p = hit.item;
  const tag = hit.kind === 'match' ? 'Match' : hit.kind === 'same-marks' ? 'Same marks, different spot' : 'Different marks';
  return (
    <li>
      <button type="button" className="hit-row" onClick={onOpen}>
        <span className="hit-thumb">
          <EarDiagram marks={p.marks} label={p.label} compact />
        </span>
        <span className="hit-text">
          <span className="hit-title">
            <span className="pc-swatch" style={{ background: p.color }} aria-hidden="true" />
            {p.label}
            {group && group.name !== p.label && <span className="hint"> · {group.name}</span>}
          </span>
          <span className={`hit-tag ${hit.kind}`}>{tag}</span>
          <span className="hit-desc">{describePattern(p.marks)}</span>
          {hit.differences.length > 0 && (
            <span className="hit-diff">Differs: {hit.differences.map(describeDifference).join('; ')}</span>
          )}
          <AnimalList animals={animals} />
        </span>
      </button>
    </li>
  );
}
