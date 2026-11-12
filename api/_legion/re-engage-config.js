// Sending AND visit recording are off unless explicitly enabled in production.
export const RE_ENGAGE_ENABLED = false;
export const enabled = () => process.env.VERCEL_ENV === 'production' &&
  (process.env.RE_ENGAGE_ENABLED === undefined ? RE_ENGAGE_ENABLED : process.env.RE_ENGAGE_ENABLED === 'true');
export const DAY = 86400000;
export const INTERVAL = 14 * DAY;
export const ORIGIN = 'https://corvus.gent';
// Only public, existing pages. IDs stay stable if their titles change.
export const destinations = [
  {id:'ledger', path:'/build/'},
  {id:'sf-field-notes', path:'/sf/larp/'},
  {id:'compound-impact', path:'/compound/impact/'}
];
export const templates = [
  {days:7, subject:'a light under the door', text:'the lantern flickered.\nsomething stirred behind a door you haven’t opened.'},
  {days:14, subject:'the crow left a mark', text:'a feather on the sill.\na fresh scratch in the margin.\nthere is a corner you haven’t seen.'},
  {days:30, subject:'still a little strange in here', text:'the notebook stayed open.\none page is still waiting for your fingerprints.'}
];
export function mailIdentity() {
  const from = process.env.LEGION_MAIL_FROM || 'Corvus <crow@corvus.gent>';
  const replyTo = process.env.LEGION_MAIL_REPLY_TO || 'gabriel@corvus.gent';
  if ([from, replyTo].some(v => /[\r\n]/.test(v) || !/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(v.match(/<([^<>]+)>$/)?.[1] || v))) throw Error('invalid mail identity');
  return {from, reply_to:replyTo};
}
