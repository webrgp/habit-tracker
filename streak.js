// Pure, clock-free date and streak math.
//
// Dates are `YYYY-MM-DD` local calendar keys, not Date objects. Only dateKey()
// touches a Date, so everything else compares and sorts as a plain string and
// no timezone offset can leak into the arithmetic.

export function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Shifting the day component rather than adding milliseconds is what keeps this
// correct across a 23- or 25-hour DST day.
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

// Consecutive days ending at the most recent day that could count. Today is
// still in progress, so an unlogged today starts the walk at yesterday instead
// of reading zero.
export function dailyStreak(doneSet, today, createdAt) {
  let day = doneSet.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (day >= createdAt && doneSet.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}
