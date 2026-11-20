export const FPS = 30;
export const DURATIONS = [15, 30, 60];

export function timeline(seconds) {
  return {
    cannon: 0.78,
    board: seconds * .2,
    sonar: seconds * .4,
    consent: seconds * .54,
    mutual: seconds * .63,
    end: seconds * .8,
    total: seconds
  };
}
