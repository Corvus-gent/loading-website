export function nextRealmReset(now = new Date()) {
  const reset = new Date(now);
  reset.setHours(4, 2, 0, 0);
  if (reset <= now) reset.setDate(reset.getDate() + 1);
  return reset;
}
