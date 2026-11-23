import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  label: string;
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  required?: boolean;
}

/**
 * Text field that saves as you type (debounced) and on blur. External
 * changes are picked up when the field is not being edited.
 */
export function AutosaveField({ label, value, onSave, multiline, placeholder, className, hideLabel, required }: Props) {
  const id = useId();
  const [text, setText] = useState(value);
  const editing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);

  const flush = () => {
    window.clearTimeout(timer.current);
    if (pending.current !== null) {
      const v = pending.current;
      pending.current = null;
      if (!(required && v.trim() === '')) saveRef.current(v);
    }
  };

  useEffect(() => flush, []);

  const change = (v: string) => {
    setText(v);
    pending.current = v;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 400);
  };

  const common = {
    id,
    value: text,
    placeholder,
    onFocus: () => (editing.current = true),
    onBlur: () => {
      editing.current = false;
      flush();
      if (required && text.trim() === '') setText(value);
    },
  };

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => change(e.target.value)} />
      ) : (
        <input {...common} type="text" onChange={(e) => change(e.target.value)} />
      )}
    </div>
  );
}
