import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { repo } from '../db/repo';
import { AutosaveField } from '../components/common/AutosaveField';
import { SchemeChart } from '../components/SchemeChart';
import { newId } from '../domain/ids';
import { BUILT_IN_SCHEMES, blankScheme, copyScheme, maxContiguous, type NumberingScheme } from '../domain/numbering';

export function TemplatesPage() {
  const navigate = useNavigate();
  const custom = useLiveQuery(() => repo.listSchemes(), [], []);
  const templates = useLiveQuery(() => repo.listTemplates(), [], []);
  const [openChart, setOpenChart] = useState<string | null>(null);

  const makeCopy = async (s: NumberingScheme) => {
    const c = copyScheme(s, newId(), `${s.name} (my copy)`, Date.now());
    await repo.saveScheme(c);
    navigate(`/templates/scheme/${c.id}`);
  };

  const schemeCard = (s: NumberingScheme) => {
    const max = maxContiguous(s);
    return (
      <li key={s.id} className="panel stack scheme-card">
        <div className="lookup-input-head">
          <div>
            <h3 style={{ margin: 0 }}>
              {s.name} {s.builtIn && <span className="badge builtin-badge">Built-in</span>}
            </h3>
            <span className="hint">{max > 0 ? `Numbers 1–${max}` : 'No numbers available yet'}</span>
          </div>
          <div className="row-actions">
            <button type="button" aria-expanded={openChart === s.id} onClick={() => setOpenChart(openChart === s.id ? null : s.id)}>
              {openChart === s.id ? 'Hide chart' : 'View chart'}
            </button>
            {s.builtIn ? (
              <button type="button" onClick={() => void makeCopy(s)}>
                Make an editable copy
              </button>
            ) : (
              <>
                <Link className="button-link" to={`/templates/scheme/${s.id}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`Delete numbering scheme "${s.name}"? Patterns already created from it are kept.`)) void repo.deleteScheme(s.id);
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        {s.description && <p style={{ margin: 0 }}>{s.description}</p>}
        {s.source && <p className="hint" style={{ margin: 0 }}>Source: {s.source}</p>}
        {openChart === s.id && <SchemeChart scheme={s} />}
      </li>
    );
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Experiments</Link> <span aria-hidden="true">›</span> <span>Templates</span>
      </nav>

      <section className="panel stack">
        <div className="lookup-input-head">
          <h2>Numbering schemes</h2>
          <button
            type="button"
            onClick={async () => {
              const b = blankScheme(newId(), Date.now());
              await repo.saveScheme(b);
              navigate(`/templates/scheme/${b.id}`);
            }}
          >
            New blank scheme
          </button>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          A numbering scheme turns numbers into ear marks. Use one from an experiment's Patterns page with "Add numbered patterns". Built-in schemes
          can't be changed; make a copy to adjust positions for your lab.
        </p>
      </section>
      <ul className="row-list stack">{[...BUILT_IN_SCHEMES, ...custom].map(schemeCard)}</ul>

      <section className="panel stack">
        <h2>Saved pattern sets</h2>
        {templates.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            None yet. Save an experiment's groups and patterns from its Export tab, then add them to a new experiment from its Patterns page.
          </p>
        ) : (
          <ul className="row-list">
            {templates.map((t) => (
              <li key={t.id} className="row">
                <div className="row-main">
                  <AutosaveField label="Template name" hideLabel value={t.name} required onSave={(name) => repo.renameTemplate(t.id, name)} />
                  <span className="row-sub">
                    {t.description} · saved {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      if (window.confirm(`Delete template "${t.name}"? Experiments made from it are not affected.`)) void repo.deleteTemplate(t.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
