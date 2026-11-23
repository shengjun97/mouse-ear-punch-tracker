import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { EarDiagram } from '../components/ear/EarDiagram';
import { animalsByPattern, groupByCage, SEX_LABEL, STATUS_LABEL } from '../domain/animals';
import { describePattern } from '../domain/describe';
import { buildLegend } from '../domain/legend';
import type { Animal, Group, Pattern } from '../domain/models';
import { useLocalPref } from '../hooks/useLocalPref';

export type PrintKind = 'legend' | 'cages' | 'patterns';
const TITLES: Record<PrintKind, string> = { legend: 'Legend sheet', cages: 'Cage cards', patterns: 'Pattern cards' };

/**
 * Printer-friendly A4 views. Color is never the only cue: every diagram has
 * its label and text description, and marks are black outlines.
 */
export function PrintPage({ kind }: { kind: PrintKind }) {
  const { experimentId = '' } = useParams();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);
  const [mono, setMono] = useLocalPref('print.mono', true);
  const [columns, setColumns] = useLocalPref('print.columns', 3);
  const [includeInactive, setIncludeInactive] = useLocalPref('print.includeInactive', false);
  const byPattern = useMemo(() => animalsByPattern(bundle?.animals ?? []), [bundle]);

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups, patterns, animals } = bundle;
  const printed = new Date().toLocaleDateString(undefined, { dateStyle: 'long' });
  const groupOf = (id: string) => groups.find((g) => g.id === id);
  const patternOf = (id?: string) => (id ? patterns.find((p) => p.id === id) : undefined);
  const visibleAnimals = includeInactive ? animals : animals.filter((a) => a.status === 'alive');

  return (
    <div className="page print-page">
      <div className="no-print panel stack">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <Link to={`/e/${exp.id}/export`}>{exp.name}: print and export</Link>{' '}
          <span aria-hidden="true">›</span> <span>{TITLES[kind]}</span>
        </nav>
        <div className="legend-view-opts">
          <button type="button" className="primary" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <label className="check">
            <input type="checkbox" checked={mono} onChange={(e) => setMono(e.target.checked)} />
            Black and white
          </label>
          {kind === 'legend' && (
            <>
              <span className="hint">Columns</span>
              <div className="segmented" role="group" aria-label="Columns">
                {[2, 3, 4].map((n) => (
                  <button key={n} type="button" aria-pressed={columns === n} onClick={() => setColumns(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
          {kind === 'cages' && (
            <label className="check">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              Include excluded and endpoint animals
            </label>
          )}
        </div>
        <p className="hint" style={{ margin: 0 }}>
          A4 portrait. To get a PDF, choose "Save as PDF" as the printer.
        </p>
      </div>

      <div className={`print-sheet${mono ? ' mono' : ''}`}>
        {kind === 'legend' && (
          <LegendSheet
            title={exp.name}
            printed={printed}
            columns={columns}
            entries={buildLegend(patterns, groups, { query: '', groupIds: [] })}
            animalsFor={(id) => byPattern.get(id) ?? []}
          />
        )}
        {kind === 'cages' &&
          (visibleAnimals.length === 0 ? (
            <p className="no-print">No animals to print. Add animals with cage numbers, or print pattern cards instead.</p>
          ) : (
            <div className="card-sheet">
              {groupByCage(visibleAnimals).map(({ cage, animals: list }) => (
                <CageCard key={cage || 'none'} cage={cage} animals={list} experiment={exp.name} groupOf={groupOf} patternOf={patternOf} />
              ))}
            </div>
          ))}
        {kind === 'patterns' && (
          <div className="card-sheet">
            {buildLegend(patterns, groups, { query: '', groupIds: [] }).map((e) => (
              <article key={e.pattern.id} className="print-card">
                <div className="print-card-head">
                  <span className="print-swatch" style={{ background: e.pattern.color }} aria-hidden="true" />
                  <strong className="print-card-title">{e.pattern.label}</strong>
                </div>
                {e.group && e.group.name !== e.pattern.label && <div className="print-sub">Group: {e.group.name}</div>}
                <EarDiagram marks={e.pattern.marks} label={e.pattern.label} />
                <div className="print-desc">{e.description}</div>
                {e.pattern.notes && <div className="print-notes">{e.pattern.notes}</div>}
                <div className="print-foot">{exp.name}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MarkKey() {
  return (
    <p className="print-key">
      Dorsal view, nose up: the mouse's left ear (L) is on the left.{' '}
      <span className="nowrap">
        <strong>○ Hole</strong> = punched through the ear.
      </span>{' '}
      <span className="nowrap">
        <strong>◡ Notch</strong> = cut into the ear edge.
      </span>
    </p>
  );
}

function LegendSheet({
  title,
  printed,
  columns,
  entries,
  animalsFor,
}: {
  title: string;
  printed: string;
  columns: number;
  entries: ReturnType<typeof buildLegend>;
  animalsFor: (patternId: string) => Animal[];
}) {
  return (
    <>
      <header className="print-header">
        <h1>{title}: ear punch legend</h1>
        <p>
          {entries.length} patterns · printed {printed}
        </p>
        <MarkKey />
      </header>
      <div className="print-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {entries.map((e) => {
          const animals = animalsFor(e.pattern.id);
          return (
            <article key={e.pattern.id} className="print-cell">
              <EarDiagram marks={e.pattern.marks} label={e.pattern.label} compact />
              <div className="print-cell-title">
                <span className="print-swatch" style={{ background: e.pattern.color }} aria-hidden="true" />
                <strong>{e.pattern.label}</strong>
              </div>
              {e.group && e.group.name !== e.pattern.label && <div className="print-sub">{e.group.name}</div>}
              <div className="print-desc">{e.description}</div>
              {animals.length > 0 && <div className="print-sub">Animals: {animals.map((a) => a.animalCode).join(', ')}</div>}
            </article>
          );
        })}
      </div>
    </>
  );
}

function CageCard({
  cage,
  animals,
  experiment,
  groupOf,
  patternOf,
}: {
  cage: string;
  animals: Animal[];
  experiment: string;
  groupOf: (id: string) => Group | undefined;
  patternOf: (id?: string) => Pattern | undefined;
}) {
  const groupNames = [...new Set(animals.map((a) => groupOf(a.groupId)?.name).filter(Boolean))];
  return (
    <article className="print-card cage-print">
      <div className="print-card-head">
        <strong className="print-card-title">{cage ? `Cage ${cage}` : 'No cage'}</strong>
        <span className="print-sub">{groupNames.join(', ')}</span>
      </div>
      <ul className="cage-print-list">
        {animals.map((a) => {
          const p = patternOf(a.patternId);
          const g = groupOf(a.groupId);
          return (
            <li key={a.id}>
              <div className="cage-print-diagram">
                {p ? <EarDiagram marks={p.marks} label={p.label} compact /> : <span className="no-pattern">No pattern</span>}
              </div>
              <div className="cage-print-text">
                <strong>{a.animalCode}</strong>
                <span>
                  {g?.name}
                  {p && p.label !== g?.name && p.label !== a.animalCode ? ` · ${p.label}` : ''}
                </span>
                <span className="print-desc">{p ? describePattern(p.marks) : 'No pattern assigned'}</span>
                <span className="print-sub">
                  {a.sex !== 'unknown' ? SEX_LABEL[a.sex] : ''}
                  {a.dob ? ` · DOB ${a.dob}` : ''}
                  {a.genotype ? ` · ${a.genotype}` : ''}
                  {a.status !== 'alive' ? ` · ${STATUS_LABEL[a.status].toUpperCase()}` : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="print-foot">{experiment}</div>
    </article>
  );
}
