import type { ScanFrame } from './types';

export type CameraError = 'denied' | 'missing' | 'busy' | 'unsupported' | 'unknown';

export function cameraError(error: unknown): CameraError {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'unknown';
}

export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
}

export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach(track => track.stop());
}

/** Grab one frame into an offscreen canvas. Pixels stay in memory on this device. */
export function grabFrame(source: HTMLVideoElement | HTMLImageElement, t: number, kind: ScanFrame['source']): ScanFrame | null {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = Math.round(160 * height / width);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { image: context.getImageData(0, 0, canvas.width, canvas.height), t, source: kind };
}
