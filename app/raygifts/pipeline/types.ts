// Shared types for the on-device Ray scan pipeline. Nothing here leaves the device.
export interface ScanFrame {
  /** Frame pixels, captured locally from the live video or the uploaded photo. */
  image: ImageData;
  /** Milliseconds since the scan started. */
  t: number;
  source: 'camera' | 'photo';
}

export interface Metric {
  /** Normalised 0–1 value. */
  value: number;
  /** 0–1 confidence; below ~0.5 the UI must not show the metric. */
  confidence: number;
}

export interface ScanResult {
  quality: Metric | null;
  heartRate: Metric | null;
  tiredness: Metric | null;
  skin: Metric | null;
  score: Metric | null;
  /** True while every analyzer is still a stub: the UI shows a preview, never numbers. */
  preview: boolean;
}

export type Analyzer = (frames: ScanFrame[]) => Promise<Metric | null>;
