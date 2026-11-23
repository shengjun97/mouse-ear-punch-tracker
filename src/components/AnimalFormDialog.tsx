import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { repo } from '../db/repo';
import { emptyAnimal, SEX_LABEL, STATUS_LABEL, validateAnimal, type AnimalDraft, type Validation } from '../domain/animals';
import { describePattern } from '../domain/describe';
import type { Animal, AnimalStatus, Experiment, Group, Pattern, Sex } from '../domain/models';
import { EarDiagram } from './ear/EarDiagram';

const NEW_PATTERN = '__new__';

export type AnimalFormTarget = { mode: 'new'; defaults?: Partial<AnimalDraft> } | { mode: 'edit'; animal: Animal } | null;

interface Props {
  target: AnimalFormTarget;
  experiment: Experiment;
  groups: Group[];
  patterns: Pattern[];
  animals: Animal[];
  onClose: () => void;
  onEditPattern?: (patternId: string) => void;
}

function initialDraft(target: AnimalFormTarget, groups: Group[], patterns: Pattern[]): AnimalDraft {
  if (target?.mode === 'edit') {
    const { id: _i, experimentId: _e, ...rest } = target.animal;
    return rest;
  }
  const d = { ...emptyAnimal(groups[0]?.id ?? ''), ...target?.defaults };
  // A group with exactly one pattern (group mode): link it by default.
  const inGroup = patterns.filter((p) => p.groupId === d.groupId);
  if (d.patternId === undefined && inGroup.length === 1) d.patternId = inGroup[0].id;
  return d;
}

/** Add or edit one animal record. */
export function AnimalFormDialog({ target, experiment, groups, patterns, animals, onClose, onEditPattern }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [draft, setDraft] = useState<AnimalDraft>(() => initialDraft(target, groups, patterns));
  const [patternChoice, setPatternChoice] = useState<string>('');
  const [check, setCheck] = useState<Validation>({ errors: {}, warnings: [] });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target) {
      const init = initialDraft(target, groups, patterns);
      setDraft(init);
      setPatternChoice(init.patternId ?? '');
      setCheck({ errors: {}, warnings: [] });
      setSaved('');
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
    // Reset only when a different record is opened.
  }, [target]);

  const editing = target?.mode === 'edit' ? target.animal : null;
  const others = animals.filter((a) => a.id !== editing?.id);
  const groupPatterns = patterns.filter((p) => p.groupId === draft.groupId);
  const usedBy = (pid: string) =>
    others.filter((a) => a.patternId === pid && a.status === 'alive').map((a) => a.animalCode);
  const individual = experiment.patternMode === 'individual';
  const selectedPattern = patterns.find((p) => p.id === patternChoice);

  const set = <K extends keyof AnimalDraft>(k: K, v: AnimalDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (k === 'animalCode' || k === 'groupId') setCheck((c) => ({ ...c, errors: { ...c.errors, [k]: undefined } }));
  };

  const changeGroup = (groupId: string) => {
    set('groupId', groupId);
    const inGroup = patterns.filter((p) => p.groupId === groupId);
    setPatternChoice(inGroup.length === 1 && !individual ? inGroup[0].id : '');
  };

  const save = async (addAnother: boolean) => {
    const v = validateAnimal(draft, others);
    setCheck(v);
    if (Object.values(v.errors).some(Boolean)) return;
    let patternId: string | undefined = patternChoice || undefined;
    if (patternChoice === NEW_PATTERN) {
      const p = await repo.addPattern(experiment.id, draft.groupId, { label: draft.animalCode.trim() });
      patternId = p.id;
    }
    const record = { ...draft, patternId };
    if (editing) await repo.updateAnimal(editing.id, record);
    else await repo.addAnimal(experiment.id, record);

    if (addAnother && !editing) {
      // Keep cage, group, strain, genotype, dates and sex for the next animal.
      setSaved(`Saved ${draft.animalCode.trim()}.`);
      setDraft({ ...record, animalCode: '', notes: '', patternId: undefined, status: 'alive' });
      setPatternChoice(!individual && groupPatterns.length === 1 ? groupPatterns[0].id : '');
      setCheck({ errors: {}, warnings: [] });
      document.getElementById(`${uid}-code`)?.focus();
      return;
    }
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(false);
  };

  const err = check.errors;
  // Warnings never block saving, so show them while typing.
  const liveWarnings = target ? validateAnimal(draft, others).warnings : [];

  return (
    <dialog
      ref={ref}
      className="detail-dialog form-dialog"
      aria-labelledby={`${uid}-title`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {target && (
        <form className="detail-body stack" onSubmit={submit} noValidate>
          <h2 id={`${uid}-title`}>{editing ? `Edit ${editing.animalCode}` : 'Add animal'}</h2>
          {saved && (
            <p className="saved-note" role="status">
              {saved}
            </p>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor={`${uid}-code`}>Animal ID</label>
              <input
                id={`${uid}-code`}
                value={draft.animalCode}
                placeholder="M12"
                autoFocus
                onChange={(e) => set('animalCode', e.target.value)}
                aria-invalid={!!err.animalCode}
                aria-describedby={err.animalCode ? `${uid}-code-err` : undefined}
              />
              {err.animalCode && (
                <p id={`${uid}-code-err`} className="error">
                  {err.animalCode}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${uid}-cage`}>Cage</label>
              <input id={`${uid}-cage`} value={draft.cage} placeholder="3" onChange={(e) => set('cage', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-group`}>Group</label>
              <select
                id={`${uid}-group`}
                value={draft.groupId}
                onChange={(e) => changeGroup(e.target.value)}
                aria-invalid={!!err.groupId}
              >
                {!draft.groupId && <option value="">Choose a group</option>}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {err.groupId && <p className="error">{err.groupId}</p>}
            </div>
            <div className="field">
              <label htmlFor={`${uid}-pattern`}>Ear punch pattern</label>
              <select id={`${uid}-pattern`} value={patternChoice} onChange={(e) => setPatternChoice(e.target.value)}>
                <option value="">Not assigned yet</option>
                {groupPatterns.map((p) => {
                  const used = individual ? usedBy(p.id) : [];
                  return (
                    <option key={p.id} value={p.id}>
                      {p.label} — {describePattern(p.marks)}
                      {used.length ? ` (used by ${used.join(', ')})` : ''}
                    </option>
                  );
                })}
                {individual && draft.groupId && <option value={NEW_PATTERN}>+ New pattern named after this animal</option>}
              </select>
            </div>
          </div>

          {selectedPattern && (
            <div className="form-pattern-preview">
              <EarDiagram marks={selectedPattern.marks} label={selectedPattern.label} compact />
              <div className="stack">
                <span>
                  <strong>{selectedPattern.label}</strong>: {describePattern(selectedPattern.marks)}
                </span>
                {individual && usedBy(selectedPattern.id).length > 0 && (
                  <span className="error">Already used by {usedBy(selectedPattern.id).join(', ')}. Each animal should have its own pattern.</span>
                )}
                {onEditPattern && (
                  <button type="button" className="link-button" onClick={() => onEditPattern(selectedPattern.id)}>
                    Edit ear marks
                  </button>
                )}
              </div>
            </div>
          )}
          {patternChoice === NEW_PATTERN && (
            <p className="hint">A new, empty pattern will be created in this group. Add its ear marks afterwards in the pattern editor.</p>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor={`${uid}-sex`}>Sex</label>
              <select id={`${uid}-sex`} value={draft.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
                {(Object.keys(SEX_LABEL) as Sex[]).map((s) => (
                  <option key={s} value={s}>
                    {SEX_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-status`}>Status</label>
              <select id={`${uid}-status`} value={draft.status} onChange={(e) => set('status', e.target.value as AnimalStatus)}>
                {(Object.keys(STATUS_LABEL) as AnimalStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-strain`}>Strain</label>
              <input id={`${uid}-strain`} value={draft.strain} placeholder="C57BL/6J" onChange={(e) => set('strain', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-geno`}>Genotype</label>
              <input id={`${uid}-geno`} value={draft.genotype} placeholder="fl/fl; Cre+" onChange={(e) => set('genotype', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-dob`}>Date of birth</label>
              <input id={`${uid}-dob`} type="date" value={draft.dob ?? ''} onChange={(e) => set('dob', e.target.value || undefined)} />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-punch`}>Punch date</label>
              <input
                id={`${uid}-punch`}
                type="date"
                value={draft.punchDate ?? ''}
                onChange={(e) => set('punchDate', e.target.value || undefined)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-notes`}>Notes</label>
            <textarea id={`${uid}-notes`} rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {liveWarnings.length > 0 && (
            <ul className="warn-list" role="status">
              {liveWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <div className="detail-actions">
            {editing && (
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  if (!window.confirm(`Delete animal ${editing.animalCode}? This can't be undone.`)) return;
                  await repo.deleteAnimal(editing.id);
                  onClose();
                }}
              >
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            {!editing && (
              <button type="button" onClick={() => void save(true)}>
                Save and add another
              </button>
            )}
            <button type="submit" className="primary">
              Save
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
