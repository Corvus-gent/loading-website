import type { Metric, ScanFrame, ScanResult } from './types';
import { quality } from './quality';
import { rppg } from './rppg';
import { tiredness } from './tiredness';
import { skin } from './skin';

// TODO: weighted wellness score from the confident metrics only; null until real models land.
export function combine(_metrics: Array<Metric | null>): Metric | null {
  return null;
}

export async function analyze(frames: ScanFrame[]): Promise<ScanResult> {
  const live = frames.some(frame => frame.source === 'camera');
  const [q, heartRate, tired, skinMetric] = await Promise.all([
    quality(frames),
    live ? rppg(frames) : Promise.resolve(null),
    tiredness(frames),
    skin(frames),
  ]);
  const score = combine([q, heartRate, tired, skinMetric]);
  const preview = [q, heartRate, tired, skinMetric, score].every(metric => metric === null);
  return { quality: q, heartRate, tiredness: tired, skin: skinMetric, score, preview };
}
