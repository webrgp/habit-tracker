import test from 'node:test';
import assert from 'node:assert/strict';

import { dateKey, addDays, dailyStreak } from '../streak.js';

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
