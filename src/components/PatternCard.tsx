import type { ReactNode } from 'react';
import { describePattern } from '../domain/describe';
import type { Pattern } from '../domain/models';
import { EarDiagram } from './ear/EarDiagram';

interface Props {
  pattern: Pick<Pattern, 'label' | 'color' | 'marks'>;
  subtitle?: string;
  notes?: string;
  /** Animal IDs carrying this pattern. */
  animals?: string[];
  badge?: ReactNode;
  actions?: ReactNode;
  onOpen?: () => void;
  /** Verb for the screen-reader label of the open action. */
  openLabel?: string;
}

/** Small diagram with label, color, and text description. */
export function PatternCard({ pattern, subtitle, notes, animals, badge, actions, onOpen, openLabel = 'Edit' }: Props) {
  const description = describePattern(pattern.marks);
  const body = (
    <>
      <EarDiagram marks={pattern.marks} label={pattern.label} compact />
      <div className="pc-text">
        <div className="pc-title">
          <span className="pc-swatch" style={{ background: pattern.color }} aria-hidden="true" />
          <span className="pc-label">{pattern.label}</span>
          {badge}
        </div>
        {subtitle && <div className="pc-sub">{subtitle}</div>}
        <div className="pc-desc">{description}</div>
        {animals && animals.length > 0 && <div className="pc-sub">Animals: {animals.join(', ')}</div>}
        {notes && <div className="pc-notes">{notes}</div>}
      </div>
    </>
  );
  return (
    <article className="pattern-card" style={{ borderTopColor: pattern.color }}>
      {onOpen ? (
        <button type="button" className="pc-open" onClick={onOpen} aria-label={`${openLabel} ${pattern.label}: ${description}`}>
          {body}
        </button>
      ) : (
        <div className="pc-open">{body}</div>
      )}
      {actions && <div className="pc-actions">{actions}</div>}
    </article>
  );
}
