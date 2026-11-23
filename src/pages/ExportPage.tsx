import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { repo } from '../db/repo';
import { ExperimentTabs } from '../components/ExperimentTabs';
import { buildLegend } from '../domain/legend';
import { makeBackup } from '../export/backup';
import { animalsCsv } from '../export/csv';
import { downloadBlob, downloadText, fileSafe, svgToPng, today } from '../export/download';
import { legendSvg } from '../export/svg';
import { useLocalPref } from '../hooks/useLocalPref';

export function ExportPage() {
  const { experimentId = '' } = useParams();
  const bundle = useLiveQuery(() => repo.getBundle(experimentId), [experimentId], null);
  const [mono, setMono] = useLocalPref('export.mono', false);
  const [columns, setColumns] = useLocalPref('export.columns', 4);
  const [templateName, setTemplateName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  if (bundle === null) return <div className="page"><p className="hint">Loading…</p></div>;
  if (bundle === undefined)
    return (
      <div className="page">
        <p>This experiment doesn't exist on this device.</p>
        <Link to="/">Back to experiments</Link>
      </div>
    );

  const { experiment: exp, groups, patterns, animals } = bundle;
  const base = `${fileSafe(exp.name)}_${today()}`;
  const say = (msg: string) => {
    setError('');
    setStatus(msg);
  };

  const legendDoc = () => {
    const entries = buildLegend(patterns, groups, { query: '', groupIds: [] });
    return legendSvg(
      entries.map((e) => ({ label: e.pattern.label, group: e.group?.name, color: e.pattern.color, description: e.description, marks: e.pattern.marks })),
      {
        title: `${exp.name}: ear punch legend`,
        subtitle: `Dorsal view, nose up. ${entries.length} patterns. Exported ${today()}.`,
        columns,
        mono,
      },
    );
  };

  const run = async (fn: () => Promise<void> | void) => {
    try {
      await fn();
    } catch (e) {
      setStatus('');
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>{exp.name}</span>
      </nav>
      <ExperimentTabs experimentId={exp.id} />

      <section className="panel stack">
        <h2>Print</h2>
        <p className="hint" style={{ margin: 0 }}>
          A4, black-and-white safe: every diagram has its label and a text description. Use "Save as PDF" in the print dialog to get a PDF.
        </p>
        <div className="row-actions">
          <Link className="button-link" to={`/e/${exp.id}/print/legend`}>
            Legend sheet
          </Link>
          <Link className="button-link" to={`/e/${exp.id}/print/cages`}>
            Cage cards ({new Set(animals.map((a) => a.cage)).size} cages)
          </Link>
          <Link className="button-link" to={`/e/${exp.id}/print/patterns`}>
            Pattern cards ({patterns.length})
          </Link>
        </div>
      </section>

      <section className="panel stack">
        <h2>Legend image</h2>
        <p className="hint" style={{ margin: 0 }}>
          For lab notebooks and slides. PNG is a picture; SVG stays sharp at any size.
        </p>
        <div className="legend-view-opts">
          <span className="hint">Columns</span>
          <div className="segmented" role="group" aria-label="Columns">
            {[2, 3, 4, 6].map((n) => (
              <button key={n} type="button" aria-pressed={columns === n} onClick={() => setColumns(n)}>
                {n}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={mono} onChange={(e) => setMono(e.target.checked)} />
            Black and white
          </label>
        </div>
        <div className="row-actions">
          <button
            type="button"
            disabled={patterns.length === 0}
            onClick={() =>
              run(async () => {
                const d = legendDoc();
                downloadBlob(await svgToPng(d.svg, d.width, d.height, 2), `${base}_legend.png`);
                say('Legend PNG saved to your downloads.');
              })
            }
          >
            Download PNG
          </button>
          <button
            type="button"
            disabled={patterns.length === 0}
            onClick={() =>
              run(() => {
                downloadText(legendDoc().svg, `${base}_legend.svg`, 'image/svg+xml');
                say('Legend SVG saved to your downloads.');
              })
            }
          >
            Download SVG
          </button>
        </div>
      </section>

      <section className="panel stack">
        <h2>Data files</h2>
        <div className="row-actions">
          <button
            type="button"
            onClick={() =>
              run(() => {
                // BOM so Excel reads non-English text correctly.
                downloadText('﻿' + animalsCsv(animals, groups, patterns), `${base}_animals.csv`, 'text/csv;charset=utf-8');
                say(`Animal list (${animals.length} animals) saved as CSV.`);
              })
            }
          >
            Animal list (CSV)
          </button>
          <button
            type="button"
            onClick={() =>
              run(async () => {
                const d = await repo.exportExperiment(exp.id);
                if (!d) throw new Error('Experiment not found.');
                downloadText(JSON.stringify(makeBackup(d), null, 1), `${base}_experiment.json`, 'application/json');
                say('This experiment saved as JSON. Restore it from the home page on any device.');
              })
            }
          >
            This experiment (JSON)
          </button>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          For a full backup of everything on this device, use Backup on the <Link to="/">home page</Link>.
        </p>
      </section>

      <section className="panel stack">
        <h2>Save as template</h2>
        <p className="hint" style={{ margin: 0 }}>
          Save these {groups.length} groups and {patterns.length} patterns to reuse in a new experiment. Animals are not included.
        </p>
        <form
          className="abz-row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const name = templateName.trim() || exp.name;
              await repo.saveExperimentAsTemplate(exp.id, name);
              setTemplateName('');
              say(`Saved template "${name}". Find it under Templates.`);
            });
          }}
        >
          <div className="field" style={{ flex: '1 1 240px' }}>
            <label htmlFor="tpl-name">Template name</label>
            <input id="tpl-name" value={templateName} placeholder={exp.name} onChange={(e) => setTemplateName(e.target.value)} />
          </div>
          <button type="submit" className="primary" style={{ alignSelf: 'flex-end' }}>
            Save template
          </button>
        </form>
      </section>

      {(status || error) && (
        <p className={error ? 'error toast' : 'saved-note toast'} role="status">
          {error || status}
        </p>
      )}
    </div>
  );
}
