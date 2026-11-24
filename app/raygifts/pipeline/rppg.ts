import type { Analyzer } from './types';

// TODO: own POS (Plane-Orthogonal-to-Skin, Wang et al. 2017) rPPG on forehead/cheek ROIs
// from FaceLandmarker; needs ≥15 s of live camera frames, never a single photo.
export const rppg: Analyzer = async () => null;
