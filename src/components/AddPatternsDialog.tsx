import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { repo } from '../db/repo';
import { newId } from '../domain/ids';
import { classifySimilarity } from '../domain/matching';
import type { Experiment, Group, Pattern } from '../domain/models';
import { BUILT_IN_SCHEMES, maxContiguous } from '../domain/numbering';
import { MAX_NUMBERED, planNumbered } from '../domain/templates';
import { EarDiagram } from './ear/EarDiagram';

export type AddPatternsMode = 'numbered' | 'template' | null;

interface Props {
  mode: AddPatternsMode;
  experiment: Experiment;
  groups: Group[];
  patterns: Pattern[];
  onClose: () => void;
}

const NEW_GROUP = '__new__';

/** Add many patterns at once: numbers from a numbering scheme, or a saved pattern set. */
export function AddPatternsDialog({ mode, experiment, groups, patterns, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const custom = useLiveQuery(() => repo.listSchemes(), [], []);
  const templates = useLiveQuery(() => repo.listTemplates(), [], []);
  const schemes = useMemo(() => [...BUILT_IN_SCHEMES, ...custom], [custom]);

  const [schemeId, setSchemeId] = useState(BUILT_IN_SCHEMES[0].id);
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [prefix, setPrefix] = useState('');
  const [groupId, setGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mode) {
      setError('');
      setGroupId(groups[0]?.id ?? NEW_GROUP);
      setNewGroupName(experiment.patternMode === 'individual' ? 'Cohort' : 'Numbered');
      setTemplateId('');
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
    // Reset only when the dialog opens.
  }, [mode]);

  const scheme = schemes.find((s) => s.id === schemeId) ?? schemes[0];
  const nFrom = Number(from);
  const nTo = Number(to);
  const rangeError =
    !Number.isInteger(nFrom) || !Number.isInteger(nTo) || nFrom < 1
      ? 'Enter whole numbers, starting at 1 or more.'
      : nTo < nFrom
        ? '"To" must be at least "From".'
        : nTo - nFrom + 1 > MAX_NUMBERED
          ? `At most ${MAX_NUMBERED} patterns at a time.`
          : '';
  const plan = useMemo(() => (rangeError ? null : planNumbered(scheme, nFrom, nTo, prefix)), [scheme, nFrom, nTo, prefix, rangeError]);
  const clashes = useMemo(() => {
    if (!plan) return [];
    return plan.ok
      .filter((it) => patterns.some((p) => classifySimilarity(it.marks, p.marks, experiment.similarityThreshold) !== 'distinct'))
      .map((it) => it.n);
  }, [plan, patterns, experiment.similarityThreshold]);
  const template = templates.find((t) => t.id === templateId);

  const createNumbered = async () => {
    if (!plan || plan.ok.length === 0) return;
    if (groupId === NEW_GROUP && !newGroupName.trim()) {
      setError('Enter a name for the new group.');
      return;
    }
    setBusy(true);
    try {
      const gid = groupId === NEW_GROUP ? (await repo.addGroup(experiment.id, newGroupName.trim())).id : groupId;
      await repo.addPatternsToGroup(experiment.id, gid, plan.ok);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="detail-dialog form-dialog" aria-labelledby="add-patterns-title" onClose={onClose}>
      {mode === 'numbered' && (
        <form
          className="detail-body stack"
          onSubmit={(e) => {
            e.preventDefault();
            void createNumbered();
          }}
          noValidate
        >
          <h2 id="add-patterns-title">Add numbered patterns</h2>
          <div className="field">
            <label htmlFor="np-scheme">Numbering scheme</label>
            <select id="np-scheme" value={scheme.id} onChange={(e) => setSchemeId(e.target.value)}>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {maxContiguous(s) ? `(1–${maxContiguous(s)})` : '(no numbers yet)'}
                </option>
              ))}
            </select>
            <p className="hint" style={{ margin: 0 }}>
              {scheme.description} <Link to="/templates">View or customize schemes</Link>
            </p>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="np-from">From</label>
              <input id="np-from" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="np-to">To</label>
              <input id="np-to" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="np-group">Add to group</label>
              <select id="np-group" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value={NEW_GROUP}>+ New group</option>
              </select>
            </div>
            {groupId === NEW_GROUP ? (
              <div className="field">
                <label htmlFor="np-newgroup">New group name</label>
                <input id="np-newgroup" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="np-prefix">Label prefix (optional)</label>
                <input id="np-prefix" value={prefix} placeholder="M" onChange={(e) => setPrefix(e.target.value)} />
              </div>
            )}
          </div>
          {groupId === NEW_GROUP && (
            <div className="field">
              <label htmlFor="np-prefix2">Label prefix (optional)</label>
              <input id="np-prefix2" value={prefix} placeholder="M" onChange={(e) => setPrefix(e.target.value)} />
            </div>
          )}

          {rangeError ? (
            <p className="error">{rangeError}</p>
          ) : (
            plan && (
              <div className="stack">
                <strong>
                  {plan.ok.length} patterns: {plan.ok[0]?.label ?? '–'} to {plan.ok[plan.ok.length - 1]?.label ?? '–'}
                </strong>
                {plan.unsupported.length > 0 && (
                  <p className="error" style={{ margin: 0 }}>
                    {plan.unsupported.length} numbers can't be made with this scheme and will be skipped (
                    {plan.unsupported
                      .slice(0, 5)
                      .map((u) => u.n)
                      .join(', ')}
                    {plan.unsupported.length > 5 ? ', …' : ''}).
                  </p>
                )}
                {clashes.length > 0 && (
                  <p className="error" style={{ margin: 0 }}>
                    {clashes.length} of these look the same as patterns already in this experiment ({clashes.slice(0, 5).join(', ')}
                    {clashes.length > 5 ? ', …' : ''}). You'll see them in the similarity warnings.
                  </p>
                )}
                <div className="np-preview">
                  {plan.ok.slice(0, 6).map((it) => (
                    <figure key={it.n} className="np-preview-item">
                      <EarDiagram marks={it.marks.map((m) => ({ ...m, id: newId() }))} label={it.label} compact />
                      <figcaption>{it.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )
          )}
          {error && <p className="error">{error}</p>}
          <div className="detail-actions">
            <span className="spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy || !plan || plan.ok.length === 0}>
              Add {plan?.ok.length ?? 0} patterns
            </button>
          </div>
        </form>
      )}

      {mode === 'template' && (
        <div className="detail-body stack">
          <h2 id="add-patterns-title">Add from a saved template</h2>
          {templates.length === 0 ? (
            <p>
              No saved templates yet. Open any experiment's Export tab and use "Save as template". <Link to="/templates">Templates</Link>
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="tpl-pick">Template</label>
                <select id="tpl-pick" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Choose a template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {template && (
                <p style={{ margin: 0 }}>
                  Adds {template.groups.length} groups ({template.groups.map((g) => `${g.name}: ${g.patterns.length}`).join(', ')}) to this
                  experiment. Existing groups and patterns are kept.
                </p>
              )}
            </>
          )}
          {error && <p className="error">{error}</p>}
          <div className="detail-actions">
            <span className="spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={!template || busy}
              onClick={async () => {
                if (!template) return;
                setBusy(true);
                try {
                  await repo.applyTemplate(experiment.id, template.id);
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Add template
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
