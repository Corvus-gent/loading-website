// Browser hints are approximate; never present this as a hardware diagnosis.
export function limitedDevice(nav) {
  return (Number.isFinite(nav.deviceMemory) && nav.deviceMemory > 0 && nav.deviceMemory <= 4)
    || (Number.isFinite(nav.hardwareConcurrency) && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4);
}
export const INITIAL_TRACKS = 25;
export const TRACK_BATCH = 50;
