import { CONCHA, EAR_BOX, HEAD_PATH, HOLE_R, NOTCH_R, VIEW } from '../components/ear/layout';
import { toDrawing } from '../domain/geometry';
import { EAR_SIDES, type MarkSpec } from '../domain/types';

/**
 * Standalone SVG (no CSS) for exports: PNG/SVG legend files for notebooks and
 * slides. Black-and-white friendly: marks are real cut-outs with black outlines.
 */

export const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export interface EarSvgOptions {
  x?: number;
  y?: number;
  width?: number;
  /** Unique prefix for mask ids when several diagrams share one document. */
  idPrefix?: string;
  /** Pure black and white (no pink ear fill). */
  mono?: boolean;
}

/** One dorsal, nose-up head as an <svg> element string. */
export function earSvg(marks: readonly MarkSpec[], o: EarSvgOptions = {}): string {
  const { x = 0, y = 0, width = VIEW.w, idPrefix = 'e', mono = false } = o;
  const height = (width * VIEW.h) / VIEW.w;
  const earFill = mono ? '#ffffff' : '#fbeaf0';
  const earStroke = mono ? '#000000' : '#72243e';
  const concha = mono ? '#d9d9d9' : '#ed93b1';
  const parts: string[] = [];
  parts.push(`<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${VIEW.w} ${VIEW.h}">`);
  parts.push('<defs>');
  for (const ear of EAR_SIDES) {
    const b = EAR_BOX[ear];
    parts.push(`<mask id="${idPrefix}-m${ear}" maskUnits="userSpaceOnUse" x="0" y="0" width="${VIEW.w}" height="${VIEW.h}">`);
    parts.push(`<rect x="0" y="0" width="${VIEW.w}" height="${VIEW.h}" fill="#fff"/>`);
    for (const m of marks.filter((k) => k.ear === ear)) {
      const p = toDrawing(ear, b, m);
      parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${m.type === 'hole' ? HOLE_R : NOTCH_R}" fill="#000"/>`);
    }
    parts.push('</mask>');
    parts.push(`<clipPath id="${idPrefix}-c${ear}"><ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w / 2}" ry="${b.h / 2}"/></clipPath>`);
  }
  parts.push('</defs>');
  parts.push(`<text x="300" y="24" text-anchor="middle" font-family="${FONT}" font-size="18" fill="#444">Dorsal view, nose up</text>`);
  parts.push(`<path d="${HEAD_PATH}" fill="${mono ? '#ffffff' : '#f1efe8'}" stroke="#333" stroke-width="2"/>`);
  parts.push('<circle cx="300" cy="74" r="5" fill="#333"/><circle cx="272" cy="170" r="5" fill="#111"/><circle cx="328" cy="170" r="5" fill="#111"/>');
  for (const ear of EAR_SIDES) {
    const b = EAR_BOX[ear];
    const c = toDrawing(ear, b, CONCHA);
    parts.push(`<g mask="url(#${idPrefix}-m${ear})">`);
    parts.push(`<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w / 2}" ry="${b.h / 2}" fill="${earFill}" stroke="${earStroke}" stroke-width="2.5"/>`);
    parts.push(`<ellipse cx="${c.x}" cy="${c.y}" rx="${CONCHA.ru * b.w}" ry="${CONCHA.rv * b.h}" fill="${concha}" opacity="0.35"/>`);
    parts.push('</g>');
    for (const m of marks.filter((k) => k.ear === ear)) {
      const p = toDrawing(ear, b, m);
      const clip = m.type === 'notch' ? ` clip-path="url(#${idPrefix}-c${ear})"` : '';
      parts.push(
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${m.type === 'hole' ? HOLE_R : NOTCH_R}" fill="none" stroke="#000" stroke-width="3"${clip}/>`,
      );
    }
    parts.push(
      `<text x="${b.x + b.w / 2}" y="412" text-anchor="middle" font-family="${FONT}" font-size="44" font-weight="700" fill="#000">${ear}</text>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

export interface LegendItem {
  label: string;
  group?: string;
  color: string;
  description: string;
  marks: readonly MarkSpec[];
}

export interface LegendSvgOptions {
  title: string;
  subtitle?: string;
  columns?: number;
  cellWidth?: number;
  mono?: boolean;
}

/** Wrap text to a rough character budget (SVG has no automatic wrapping). */
export function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

/** A grid of all patterns with labels and text descriptions, as one SVG document. */
export function legendSvg(items: readonly LegendItem[], o: LegendSvgOptions): { svg: string; width: number; height: number } {
  const cols = Math.max(1, o.columns ?? 4);
  const cw = o.cellWidth ?? 260;
  const pad = 24;
  const diagramH = (cw - 20) * (VIEW.h / VIEW.w);
  const textLines = (it: LegendItem) => wrap(it.description, Math.floor(cw / 7.2));
  const cellH = (it: LegendItem) => 10 + diagramH + 28 + (it.group && it.group !== it.label ? 20 : 0) + textLines(it).length * 18 + 14;
  const headerH = o.subtitle ? 76 : 56;
  const rows: LegendItem[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  const rowH = rows.map((r) => Math.max(...r.map(cellH)));
  const width = pad * 2 + cols * cw;
  const height = headerH + rowH.reduce((s, h) => s + h, 0) + pad;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.ceil(height)}" viewBox="0 0 ${width} ${Math.ceil(height)}">`);
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  parts.push(`<text x="${pad}" y="36" font-family="${FONT}" font-size="22" font-weight="700" fill="#000">${escapeXml(o.title)}</text>`);
  if (o.subtitle) parts.push(`<text x="${pad}" y="60" font-family="${FONT}" font-size="14" fill="#444">${escapeXml(o.subtitle)}</text>`);

  let y = headerH;
  rows.forEach((row, ri) => {
    row.forEach((it, ci) => {
      const x = pad + ci * cw;
      const idx = ri * cols + ci;
      parts.push(`<rect x="${x + 4}" y="${y + 2}" width="${cw - 8}" height="${rowH[ri] - 6}" rx="8" fill="none" stroke="#bbb"/>`);
      if (!o.mono) parts.push(`<rect x="${x + 4}" y="${y + 2}" width="${cw - 8}" height="6" fill="${escapeXml(it.color)}"/>`);
      parts.push(earSvg(it.marks, { x: x + 10, y: y + 10, width: cw - 20, idPrefix: `c${idx}`, mono: o.mono }));
      let ty = y + 10 + diagramH + 22;
      // Color swatch next to the label; the label itself carries the meaning.
      parts.push(`<rect x="${x + 12}" y="${ty - 13}" width="14" height="14" fill="${o.mono ? '#fff' : escapeXml(it.color)}" stroke="#000"/>`);
      parts.push(`<text x="${x + 32}" y="${ty}" font-family="${FONT}" font-size="16" font-weight="700" fill="#000">${escapeXml(it.label)}</text>`);
      if (it.group && it.group !== it.label) {
        ty += 20;
        parts.push(`<text x="${x + 12}" y="${ty}" font-family="${FONT}" font-size="13" fill="#444">${escapeXml(it.group)}</text>`);
      }
      for (const line of textLines(it)) {
        ty += 18;
        parts.push(`<text x="${x + 12}" y="${ty}" font-family="${FONT}" font-size="14" fill="#000">${escapeXml(line)}</text>`);
      }
    });
    y += rowH[ri];
  });
  parts.push('</svg>');
  return { svg: parts.join(''), width, height: Math.ceil(height) };
}
