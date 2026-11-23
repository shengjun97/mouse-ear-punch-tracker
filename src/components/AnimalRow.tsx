import { SEX_LABEL, STATUS_LABEL } from '../domain/animals';
import { describePattern } from '../domain/describe';
import type { Animal, Group, Pattern } from '../domain/models';
import { EarDiagram } from './ear/EarDiagram';

interface Props {
  animal: Animal;
  group?: Group;
  pattern?: Pattern;
  showCage?: boolean;
  onOpen?: () => void;
  warn?: boolean;
}

/** One animal with its ear diagram, for lists and cage cards. */
export function AnimalRow({ animal: a, group, pattern, showCage = true, onOpen, warn }: Props) {
  const inactive = a.status !== 'alive';
  const desc = pattern ? describePattern(pattern.marks) : 'No pattern assigned';
  return (
    <button
      type="button"
      className={`animal-row${inactive ? ' inactive' : ''}`}
      onClick={onOpen}
      aria-label={`${a.animalCode}${showCage && a.cage ? `, cage ${a.cage}` : ''}, ${group?.name ?? 'no group'}, ${STATUS_LABEL[a.status]}. ${desc}`}
    >
      <span className="hit-thumb">
        {pattern ? <EarDiagram marks={pattern.marks} label={pattern.label} compact /> : <span className="no-pattern">No pattern</span>}
      </span>
      <span className="hit-text">
        <span className="hit-title">
          <span className="animal-code">{a.animalCode}</span>
          {showCage && a.cage && <span className="hint">Cage {a.cage}</span>}
          {warn && <span className="badge warn-badge">Check</span>}
        </span>
        <span className="animal-meta">
          {group && (
            <span className="animal-group">
              <span className="pc-swatch" style={{ background: group.color }} aria-hidden="true" />
              {group.name}
            </span>
          )}
          {pattern && pattern.label !== group?.name && pattern.label !== a.animalCode && <span>· {pattern.label}</span>}
          <span>· {a.sex === 'unknown' ? 'Sex unknown' : SEX_LABEL[a.sex]}</span>
          {a.genotype && <span>· {a.genotype}</span>}
        </span>
        <span className="hit-desc">{desc}</span>
        {inactive && <span className={`status-tag ${a.status}`}>{STATUS_LABEL[a.status]}</span>}
      </span>
    </button>
  );
}
