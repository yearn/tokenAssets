import imageSize from 'image-size';

export function dimensionsOfPng(buf: Buffer): { width: number; height: number } | null {
  try {
    const d = imageSize(buf);
    if (!d || d.type !== 'png' || !d.width || !d.height) return null;
    return { width: d.width, height: d.height };
  } catch {
    return null;
  }
}

