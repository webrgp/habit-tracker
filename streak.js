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

// Weeks start Monday. getDay() is Sunday-first, so (day + 6) % 7 rotates it to
// a Monday-first index that doubles as the offset back to that Monday.
export function weekStart(key) {
  const [y, m, d] = key.split('-').map(Number);
  return addDays(key, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

export function countInWeek(doneSet, weekStartKey) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (doneSet.has(addDays(weekStartKey, i))) n += 1;
  return n;
}

// Consecutive weeks that hit their target. The current week is still in
// progress: it counts once it reaches the target, and before that it is skipped
// rather than treated as a miss.
export function weeklyStreak(doneSet, today, createdAt, target) {
  let week = weekStart(today);
  if (countInWeek(doneSet, week) < target) week = addDays(week, -7);
  const firstWeek = weekStart(createdAt);
  let n = 0;
  while (week >= firstWeek && countInWeek(doneSet, week) >= target) {
    n += 1;
    week = addDays(week, -7);
  }
  return n;
}
