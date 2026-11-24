// Set this to async ({ signal }) => detector when the model connection is ready.
// A detector exposes async detect(video, { signal }) => boolean and optional dispose().
// true means a face is present in the current frame.
export const createFaceDetector = null;
