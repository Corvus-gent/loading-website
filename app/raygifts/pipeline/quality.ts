import type { Analyzer } from './types';

// TODO: MediaPipe FaceLandmarker (@mediapipe/tasks-vision, lazy-loaded WASM + .task model)
// for face presence, pose, lighting and motion checks that gate every other analyzer.
export const quality: Analyzer = async () => null;
