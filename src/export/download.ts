/** Save a file to the user's device. Nothing is uploaded anywhere. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (text: string, filename: string, type: string) => downloadBlob(new Blob([text], { type }), filename);

/** Safe file name from an experiment name (keeps non-Latin letters). */
export function fileSafe(name: string): string {
  const s = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_').slice(0, 80);
  return s || 'experiment';
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Rasterize an SVG document to PNG at `scale`x. */
export async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the legend image.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the PNG.'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
