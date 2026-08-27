import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dateKey,
  addDays,
  weekStart,
  countInWeek,
  lastNDays,
  dailyStreak,
  weeklyStreak,
} from '../streak.js';

test('dateKey returns the local calendar date, not the UTC one', () => {
  // 8pm on the 27th in a negative-offset zone is already the 28th in UTC.
  const evening = new Date(2026, 7, 27, 20, 0, 0);
  assert.equal(evening.toISOString().slice(0, 10), '2026-08-28');
  assert.equal(dateKey(evening), '2026-08-27');
});

test('dateKey zero-pads month and day', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('addDays crosses a month boundary', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
});

test('addDays crosses a year boundary in both directions', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('addDays crosses the fall-back DST boundary', () => {
  // Nov 1 2026 is a 25-hour day in America/New_York. Adding 86400000ms lands
  // back on Nov 1; adding a day component lands on Nov 2.
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
});

test('an unlogged today does not break the streak', () => {
  const done = new Set(['2026-08-24', '2026-08-25', '2026-08-26']);
  assert.equal(dailyStreak(done, '2026-08-27', '2026-08-01'), 3);
});

test('logging today extends the streak', () => {
  const done = new Set(['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27']);
  assert.equal(dailyStreak(done, '2026-08-27', '2026-08-01'), 4);
});

test('a completed day that was missed resets the streak to zero', () => {
  const done = new Set(['2026-08-24', '2026-08-25', '2026-08-26']);
  assert.equal(dailyStreak(done, '2026-08-28', '2026-08-01'), 0);
});

test('an earlier gap bounds the streak', () => {
  const done = new Set(['2026-08-20', '2026-08-21', '2026-08-23', '2026-08-24']);
  assert.equal(dailyStreak(done, '2026-08-24', '2026-08-01'), 2);
});

test('a habit created today reads 1 when checked and 0 when not', () => {
  assert.equal(dailyStreak(new Set(['2026-08-27']), '2026-08-27', '2026-08-27'), 1);
  assert.equal(dailyStreak(new Set(), '2026-08-27', '2026-08-27'), 0);
});

test('the walk stops at createdAt and never counts days before it', () => {
  const done = new Set();
  for (let d = 1; d <= 27; d++) done.add(`2026-08-${String(d).padStart(2, '0')}`);
  assert.equal(dailyStreak(done, '2026-08-27', '2026-08-25'), 3);
});

test('a streak counts across a month boundary', () => {
  const done = new Set(['2026-01-30', '2026-01-31', '2026-02-01']);
  assert.equal(dailyStreak(done, '2026-02-01', '2025-12-01'), 3);
});

test('a streak counts across a year boundary', () => {
  const done = new Set(['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.equal(dailyStreak(done, '2027-01-01', '2026-01-01'), 3);
});

test('backfilling a missed day restores the streak it had broken', () => {
  const done = new Set(['2026-08-24', '2026-08-26']);
  assert.equal(dailyStreak(done, '2026-08-26', '2026-08-01'), 1);
  done.add('2026-08-25');
  assert.equal(dailyStreak(done, '2026-08-26', '2026-08-01'), 3);
});

test('a habit with nothing logged has no streak', () => {
  assert.equal(dailyStreak(new Set(), '2026-08-27', '2026-08-01'), 0);
});

// Weeks start Monday. In 2026, Aug 24 and Aug 31 are Mondays.

test('weekStart maps every day of a week to the same Monday', () => {
  const week = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
                '2026-08-28', '2026-08-29', '2026-08-30'];
  for (const day of week) assert.equal(weekStart(day), '2026-08-24');
});

test('weekStart treats Sunday as the end of the week, not the start', () => {
  assert.equal(weekStart('2026-08-30'), '2026-08-24');
});

test('weekStart returns a Monday unchanged', () => {
  assert.equal(weekStart('2026-08-31'), '2026-08-31');
});

test('weekStart reaches back across a month boundary', () => {
  assert.equal(weekStart('2026-09-01'), '2026-08-31');
});

test('countInWeek counts only the days inside its Monday-to-Sunday window', () => {
  const done = new Set(['2026-08-23', '2026-08-24', '2026-08-25', '2026-08-30',
                        '2026-08-31']);
  assert.equal(countInWeek(done, '2026-08-24'), 3);
});

test('the current week counts as soon as it hits the target', () => {
  const done = new Set(['2026-08-24', '2026-08-25', '2026-08-26']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 3), 1);
});

test('a current week short of target is ignored, not counted as a miss', () => {
  const done = new Set(['2026-08-17', '2026-08-18', '2026-08-19',
                        '2026-08-24', '2026-08-25']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 3), 1);
});

test('a current week short of target with no history reads zero', () => {
  const done = new Set(['2026-08-24', '2026-08-25']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 3), 0);
});

test('hitting the target this week increments the streak', () => {
  const done = new Set(['2026-08-17', '2026-08-18', '2026-08-19',
                        '2026-08-24', '2026-08-25', '2026-08-26']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 3), 2);
});

test('a completed week below target resets the streak', () => {
  const done = new Set(['2026-08-10', '2026-08-11', '2026-08-12',
                        '2026-08-17', '2026-08-18',
                        '2026-08-24', '2026-08-25', '2026-08-26']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 3), 1);
});

test('consecutive qualifying weeks accumulate', () => {
  const done = new Set(['2026-08-10', '2026-08-11', '2026-08-12',
                        '2026-08-17', '2026-08-18', '2026-08-19',
                        '2026-08-24', '2026-08-25', '2026-08-26']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 3), 3);
});

test('a habit created mid-week that falls short reads zero without breaking', () => {
  const done = new Set(['2026-08-26']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-26', 3), 0);
});

test('a habit created mid-week that hits its target reads one week', () => {
  const done = new Set(['2026-08-26', '2026-08-27']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-26', 2), 1);
});

test('the weekly walk never counts weeks before the habit existed', () => {
  const done = new Set();
  for (let d = 10; d <= 27; d++) done.add(`2026-08-${d}`);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-24', 3), 1);
});

test('a once-a-week habit counts a week with a single done day', () => {
  const done = new Set(['2026-08-25']);
  assert.equal(weeklyStreak(done, '2026-08-27', '2026-08-01', 1), 1);
});

test('lastNDays ends at today and runs oldest first', () => {
  assert.deepEqual(lastNDays('2026-08-27', 7), [
    '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24',
    '2026-08-25', '2026-08-26', '2026-08-27',
  ]);
});

test('lastNDays reaches back across a month boundary', () => {
  assert.deepEqual(lastNDays('2026-09-02', 7), [
    '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30',
    '2026-08-31', '2026-09-01', '2026-09-02',
  ]);
});
