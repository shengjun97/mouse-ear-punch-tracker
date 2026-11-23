import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { describePattern } from '../../domain/describe';
import {
  classifyPlacement,
  constrain,
  convertType,
  ellipticalRadius,
  roundUV,
  toNormalized,
  type UV,
} from '../../domain/geometry';
import { newId } from '../../domain/ids';
import { EAR_SIDES, type EarMark, type EarSide, type MarkType } from '../../domain/types';
import { snapToZone, zonePosition, type ZoneId } from '../../domain/zones';
import { useHistory } from '../../hooks/useHistory';
import { EarDiagram, markLabel } from './EarDiagram';
import { EAR_BOX } from './layout';

export interface EarEditorProps {
  initialMarks?: EarMark[];
  /** Called after every committed change (add, move, delete, undo, redo). */
  onChange?: (marks: EarMark[]) => void;
  label?: string;
}

interface Drag {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

/** Spatial layout of the zone buttons as seen on screen for the right ear. */
const ZONE_GRID_R: (ZoneId | null)[] = [
  'upper-inner', 'top', 'upper-outer',
  'inner', 'center', 'outer',
  'lower-inner', 'bottom', 'lower-outer',
];
/** Left ear is mirrored: outer is on the left of the screen. */
const ZONE_GRID_L: (ZoneId | null)[] = [
  'upper-outer', 'top', 'upper-inner',
  'outer', 'center', 'inner',
  'lower-outer', 'bottom', 'lower-inner',
];
const ZONE_SHORT: Record<ZoneId, string> = {
  top: 'Top',
  'upper-outer': 'Upper outer',
  outer: 'Outer',
  'lower-outer': 'Lower outer',
  bottom: 'Bottom',
  'lower-inner': 'Lower inner',
  inner: 'Inner',
  'upper-inner': 'Upper inner',
  center: 'Center',
};

const DRAG_SLOP = 6; // screen px before a press becomes a drag

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function finish(uv: UV, type: MarkType, snap: boolean): UV {
  return roundUV(snap ? snapToZone(constrain(uv, type), type) : constrain(uv, type));
}

export function EarEditor({ initialMarks = [], onChange, label }: EarEditorProps) {
  const history = useHistory<EarMark[]>(initialMarks);
  const marks = history.value;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState(false);
  const [addEar, setAddEar] = useState<EarSide>('R');
  const [addType, setAddType] = useState<MarkType>('hole');
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragging = useRef(false);

  const selected = marks.find((m) => m.id === selectedId) ?? null;

  // Report committed changes only (not drag previews).
  const lastReported = useRef(marks);
  useEffect(() => {
    if (dragging.current || marks === lastReported.current) return;
    lastReported.current = marks;
    onChange?.(marks);
  }, [marks, onChange]);

  useEffect(() => {
    if (selectedId && !marks.some((m) => m.id === selectedId)) setSelectedId(null);
  }, [marks, selectedId]);

  // After a tap selects or creates a mark, move keyboard focus to it so the
  // keyboard shortcuts (Delete, arrows, H/N/T, undo) act on it.
  const focusPending = useRef<string | null>(null);
  useEffect(() => {
    const id = focusPending.current;
    if (!id) return;
    const el = svgRef.current?.querySelector<SVGElement>(`[data-mark-id="${CSS.escape(id)}"]`);
    if (el) {
      focusPending.current = null;
      el.focus({ preventScroll: true });
    }
  });
  const selectAndFocus = (id: string | null) => {
    focusPending.current = id;
    setSelectedId(id);
  };

  const update = (id: string, patch: (m: EarMark) => EarMark) =>
    history.set(marks.map((m) => (m.id === id ? patch(m) : m)));

  const addMark = (ear: EarSide, type: MarkType, uv: UV) => {
    const m: EarMark = { id: newId(), ear, type, ...roundUV(uv) };
    history.set([...marks, m]);
    selectAndFocus(m.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    history.set(marks.filter((m) => m.id !== selected.id));
    setSelectedId(null);
    // The deleted mark had focus; keep focus inside the editor.
    rootRef.current?.focus({ preventScroll: true });
  };

  const setType = (type: MarkType) => {
    if (!selected || selected.type === type) return;
    update(selected.id, (m) => ({ ...m, type, ...finish(convertType(m, type), type, snap) }));
  };

  const moveSelected = (du: number, dv: number) => {
    if (!selected) return;
    // Screen-left on the left ear is lateral, so mirror the horizontal step.
    const sx = selected.ear === 'L' ? -du : du;
    update(selected.id, (m) => ({ ...m, ...roundUV(constrain({ u: m.u + sx, v: m.v + dv }, m.type)) }));
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const hit = (e.target as Element).closest('[data-mark-id]');
    if (hit) {
      const id = hit.getAttribute('data-mark-id')!;
      selectAndFocus(id);
      drag.current = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const p = svgPoint(svg, e.clientX, e.clientY);
    if (!p) return;
    // Pick the ear the tap is closest to (in each ear's own normalized frame).
    const candidates = EAR_SIDES.map((ear) => {
      const uv = toNormalized(ear, EAR_BOX[ear], p);
      return { ear, uv, r: ellipticalRadius(uv) };
    }).sort((a, b) => a.r - b.r);
    const best = candidates[0];
    const placed = classifyPlacement(best.uv);
    if (!placed) {
      setSelectedId(null);
      return;
    }
    addMark(best.ear, placed.type, finish(placed.uv, placed.type, snap));
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg || d.pointerId !== e.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_SLOP) return;
      d.moved = true;
      dragging.current = true;
      history.begin();
    }
    const m = marks.find((x) => x.id === d.id);
    const p = svgPoint(svg, e.clientX, e.clientY);
    if (!m || !p) return;
    const uv = constrain(toNormalized(m.ear, EAR_BOX[m.ear], p), m.type);
    history.preview(marks.map((x) => (x.id === d.id ? { ...x, ...uv } : x)));
  };

  const endDrag = (e: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d.moved) return;
    if (cancelled) {
      history.cancel();
    } else {
      const m = marks.find((x) => x.id === d.id);
      if (m) history.preview(marks.map((x) => (x.id === d.id ? { ...x, ...finish(x, x.type, snap) } : x)));
      history.commit();
    }
    dragging.current = false;
  };

  // Undo/redo shortcuts work anywhere on the page except inside text fields.
  const { undo, redo } = history;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!selected || mod) return;
    const step = e.shiftKey ? 0.08 : 0.02;
    const handled = (() => {
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          deleteSelected();
          return true;
        case 'ArrowLeft':
          moveSelected(-step, 0);
          return true;
        case 'ArrowRight':
          moveSelected(step, 0);
          return true;
        case 'ArrowUp':
          moveSelected(0, -step);
          return true;
        case 'ArrowDown':
          moveSelected(0, step);
          return true;
        case 'Escape':
          setSelectedId(null);
          return true;
        case 'h':
          setType('hole');
          return true;
        case 'n':
          setType('notch');
          return true;
        case 't':
          setType(selected.type === 'hole' ? 'notch' : 'hole');
          return true;
      }
      return false;
    })();
    if (handled) e.preventDefault();
  };

  const grid = addEar === 'L' ? ZONE_GRID_L : ZONE_GRID_R;
  const description = describePattern(marks);

  return (
    <div className="ear-editor" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="ee-canvas">
        <EarDiagram
          svgRef={svgRef}
          marks={marks}
          label={label}
          selectedId={selectedId}
          zoneGuides={snap ? (selected?.type ?? 'hole') : null}
          interactive
          onMarkFocus={setSelectedId}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)}
          onPointerCancel={(e) => endDrag(e, true)}
        />
      </div>

      <p className="ee-description" aria-live="polite">
        {description}
      </p>

      <div className="toolbar" role="toolbar" aria-label="Edit marks">
        <button type="button" onClick={history.undo} aria-disabled={!history.canUndo} title="Undo (Ctrl/Cmd+Z)">
          Undo
        </button>
        <button type="button" onClick={history.redo} aria-disabled={!history.canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">
          Redo
        </button>
        <label className="switch">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          <span>Snap to zones</span>
        </label>
      </div>

      <div className="selection-bar" aria-live="polite">
        {selected ? (
          <>
            <span className="sel-name">{markLabel(selected)}</span>
            <div className="segmented" role="group" aria-label="Mark type">
              {(['hole', 'notch'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={selected.type === t} onClick={() => setType(t)}>
                  {t === 'hole' ? 'Hole' : 'Notch'}
                </button>
              ))}
            </div>
            <button type="button" className="danger" onClick={deleteSelected}>
              Delete mark
            </button>
          </>
        ) : (
          <span className="hint">
            Tap an ear to add a mark. Tap a mark to select it, drag to move it.
          </span>
        )}
      </div>

      <details className="add-by-zone">
        <summary>Add by position</summary>
        <div className="abz-row">
          <div className="segmented" role="group" aria-label="Ear">
            {EAR_SIDES.map((ear) => (
              <button key={ear} type="button" aria-pressed={addEar === ear} onClick={() => setAddEar(ear)}>
                {ear === 'L' ? 'Left ear (L)' : 'Right ear (R)'}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Mark type to add">
            {(['hole', 'notch'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={addType === t} onClick={() => setAddType(t)}>
                {t === 'hole' ? 'Hole' : 'Notch'}
              </button>
            ))}
          </div>
        </div>
        <div className="zone-grid" role="group" aria-label={`Positions on the ${addEar === 'L' ? 'left' : 'right'} ear`}>
          {grid.map((z, i) =>
            z === null || (z === 'center' && addType === 'notch') ? (
              <span key={i} className="zone-empty" />
            ) : (
              <button key={z} type="button" onClick={() => addMark(addEar, addType, zonePosition(z, addType))}>
                {ZONE_SHORT[z]}
              </button>
            ),
          )}
        </div>
        <p className="hint">Laid out as seen on screen: on the left ear, outer is on the left.</p>
      </details>
    </div>
  );
}
