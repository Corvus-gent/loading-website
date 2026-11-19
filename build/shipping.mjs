export const shippingTimezone = 'Europe/Brussels';
export const rippleTrackingStarted = '2026-11-19';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: shippingTimezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function shippingDay(date) {
  return dayFormat.format(new Date(date));
}

export function shiftDay(day, offset) {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function shippingDays(snapshot) {
  const latest = shippingDay(snapshot.updated);
  const days = new Map();
  function row(date) {
    if (!days.has(date)) {
      days.set(date, {
        date, added: 0, removed: 0, commits: 0,
        ripples: date >= rippleTrackingStarted && Array.isArray(snapshot.ripples) ? [] : null
      });
    }
    return days.get(date);
  }
  row(latest);
  for (const commit of snapshot.commits) {
    const date = shippingDay(commit.date);
    if (date > latest) continue;
    const day = row(date);
    day.added += commit.added;
    day.removed += commit.removed;
    day.commits++;
  }
  for (const ripple of snapshot.ripples ?? []) {
    if (ripple.date >= rippleTrackingStarted && ripple.date <= latest) {
      row(ripple.date).ripples.push(ripple);
    }
  }
  const earliest = [...days.keys()].sort()[0];
  for (let date = latest; date > earliest; date = shiftDay(date, -1)) row(date);
  return [...days.values()].sort((left, right) => right.date.localeCompare(left.date));
}

export function shippingPeriods(days, period) {
  const groups = new Map();
  for (const day of days) {
    let start = day.date;
    if (period === 'month') start = day.date.slice(0, 7) + '-01';
    if (period === 'week') {
      const weekday = new Date(day.date + 'T12:00:00Z').getUTCDay();
      start = shiftDay(day.date, -((weekday + 6) % 7));
    }
    if (!groups.has(start)) groups.set(start, { start, days: [] });
    groups.get(start).days.push(day);
  }
  return [...groups.values()];
}
