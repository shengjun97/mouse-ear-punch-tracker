import { useCallback, useReducer } from 'react';

/**
 * Undo/redo history with support for transient previews (e.g. while dragging):
 * begin() remembers the current value, preview() updates it without creating
 * history entries, and commit() records a single undo step.
 */
interface State<T> {
  past: T[];
  present: T;
  future: T[];
  base: T | null;
}

type Action<T> =
  | { type: 'set'; value: T }
  | { type: 'begin' }
  | { type: 'preview'; value: T }
  | { type: 'commit' }
  | { type: 'cancel' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T };

const LIMIT = 200;

function reducer<T>(s: State<T>, a: Action<T>): State<T> {
  switch (a.type) {
    case 'set':
      if (a.value === s.present) return s;
      return { past: [...s.past, s.present].slice(-LIMIT), present: a.value, future: [], base: null };
    case 'begin':
      return { ...s, base: s.present };
    case 'preview':
      return { ...s, present: a.value };
    case 'commit':
      if (s.base === null || s.base === s.present) return { ...s, base: null };
      return { past: [...s.past, s.base].slice(-LIMIT), present: s.present, future: [], base: null };
    case 'cancel':
      return s.base === null ? s : { ...s, present: s.base, base: null };
    case 'undo': {
      if (s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present: prev, future: [s.present, ...s.future], base: null };
    }
    case 'redo': {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return { past: [...s.past, s.present], present: next, future: rest, base: null };
    }
    case 'reset':
      return { past: [], present: a.value, future: [], base: null };
  }
}

export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [], base: null });
  return {
    value: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    set: useCallback((value: T) => dispatch({ type: 'set', value }), []),
    begin: useCallback(() => dispatch({ type: 'begin' }), []),
    preview: useCallback((value: T) => dispatch({ type: 'preview', value }), []),
    commit: useCallback(() => dispatch({ type: 'commit' }), []),
    cancel: useCallback(() => dispatch({ type: 'cancel' }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    reset: useCallback((value: T) => dispatch({ type: 'reset', value }), []),
  };
}
