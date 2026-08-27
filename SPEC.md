# Spec: Habit Tracker

Derived from `docs/intent/habit-tracker.md` (confirmed 2026-08-27). The intent
doc is the source of truth for product decisions; this spec is the source of
truth for how they get built.

## Assumptions

These were not covered in the interview. Correct them now or the build proceeds
on them.

1. Vanilla HTML, CSS, and ES modules. No framework, no bundler, no build step.
2. Zero runtime dependencies, and zero dev dependencies beyond Node itself.
3. Tests run on `TZ=America/New_York node --test` (Node 22, already
   installed), covering the pure streak and date functions only.
4. Modern mobile Safari and Chrome only. No legacy browser support.
5. The app is a single screen. No router, no navigation.

## Objective

Rodrigo, alone, wants to log a small set of personal habits from his phone and
see a streak number he believes. Opening the app shows today's habits, each with
a checkbox, a streak, and a 7-day strip for backfilling anything missed in the
last week. Habits are added and deleted in the app itself, and each one is
either daily or N times per week.

Everything lives in localStorage on the device. There is no server, no account,
and no sync, so nothing the app stores ever leaves the phone.

Success means the app is still in daily use a month after install, and the
streak numbers it shows match what actually happened.

## Tech Stack

- HTML, CSS, and JavaScript ES modules, served as static files.
- Web App Manifest plus a service worker for install and offline.
- `crypto.randomUUID()` for habit ids, `localStorage` for storage, and
  `confirm()` for delete confirmation. All native, no libraries.
- Node 22 with the built-in `node:test` runner and `node:assert`.

## Commands

```
Dev:    python3 -m http.server 8000     # then open http://localhost:8000
Test:   TZ=America/New_York node --test   # fixed zone; UTC hides date bugs
Build:  none (static files, no build step)
Lint:   none configured
Deploy: git push origin main   # GitHub Pages serves the repo root
```

`localhost` is a secure context, so service worker registration and install
prompts work in development without TLS.

## Project Structure

```
index.html              → The single screen, markup only
app.js                  → Render and event wiring
store.js                → localStorage read/write, habit CRUD, entry toggle
streak.js               → Pure date and streak functions (the tested core)
style.css               → Styles
sw.js                   → Service worker, caches the app shell
manifest.webmanifest    → Install metadata
icons/                  → icon-192.png, icon-512.png
.nojekyll               → Empty; tells GitHub Pages to skip Jekyll
test/streak.test.js     → node:test suite for streak.js
SPEC.md                 → This file
docs/intent/            → Confirmed intent
```

`sw.js` and `manifest.webmanifest` sit at the root so the service worker's scope
covers the whole app.

## Data Model

One localStorage key, `habit-tracker:v1`, holding the entire state as JSON. The
app reads it on load and writes the whole blob on every change. A year of ten
habits is roughly 40KB, which is far under any quota, so partial writes would be
complexity without a payoff.

```json
{
  "version": 1,
  "habits": [
    {
      "id": "5f8c...",
      "name": "Gym",
      "cadence": "weekly",
      "target": 3,
      "createdAt": "2026-08-27"
    },
    {
      "id": "a91b...",
      "name": "Read",
      "cadence": "daily",
      "target": 1,
      "createdAt": "2026-08-20"
    }
  ],
  "entries": {
    "5f8c...": { "2026-08-25": true, "2026-08-27": true },
    "a91b...": { "2026-08-26": true, "2026-08-27": true }
  }
}
```

Field rules:

- `id` comes from `crypto.randomUUID()` and never changes.
- `cadence` is either `"daily"` or `"weekly"`. Neither `cadence` nor `target` is
  editable after creation; changing a habit means deleting it and adding a new
  one, which is a deliberate trade-off recorded in the intent doc.
- `target` is the number of distinct days per week for weekly habits, and is
  always `1` for daily habits.
- `createdAt` is a date key, and it bounds every streak walk (see below).
- `entries` maps a habit id to a set of date keys, with `true` as the value. A
  habit is either done on a day or it isn't, so a habit can be completed at most
  once per day. That is what makes a weekly target mean N distinct days rather
  than N repetitions.
- Deleting a habit removes both its entry in `habits` and its key in `entries`.

**Date keys are local `YYYY-MM-DD` strings, built from `getFullYear()`,
`getMonth()`, and `getDate()`.** Never `toISOString()`, which converts to UTC
and silently shifts the date for anyone west of Greenwich after their
afternoon. This rule applies everywhere a date is written or compared.

**Streaks are derived, never stored.** There is no streak field anywhere in the
model. Every streak is recomputed from `entries` on render. One consequence is
worth stating: backfilling inside the 7-day window can revive a streak that
looked broken an hour ago. That is correct by construction, because the streak
describes what happened, not what was logged on time.

`version` exists so a future migration can recognize old data. There is no
migration code today.

## Streak Rules

All streak functions are pure and take `today` as a parameter rather than
reading the clock. That is what lets the test suite cover year boundaries, leap
days, and mid-week creation without mocking anything.

### Daily habits

Count consecutive days ending at the most recent day that could count, walking
backward until a gap or the creation date.

```
dailyStreak(doneSet, today, createdAt):
    day = done(today) ? today : yesterday
    n = 0
    while day >= createdAt and done(day):
        n += 1
        day -= 1 day
    return n
```

An unlogged today is not a miss. The day is still in progress, so the walk
starts from yesterday instead of returning zero. This is the single most
important rule in the spec: without it, every streak reads zero from midnight
until the user checks in, and the number stops being believable.

Worked example. A habit done on the 24th, 25th, and 26th, viewed on the 27th
before checking in, shows a streak of 3. Checking in on the 27th makes it 4.
Viewed on the 28th with the 27th still unlogged, it shows 0, because the 27th is
now a completed day that was missed.

### Weekly habits

Weeks start Monday. A week counts when the habit was done on at least `target`
distinct days inside it.

```
weeklyStreak(doneSet, today, createdAt, target):
    week = weekStart(today)
    if countInWeek(week) < target:
        week -= 7 days
    n = 0
    while week >= weekStart(createdAt) and countInWeek(week) >= target:
        n += 1
        week -= 7 days
    return n
```

The current week is in progress. It counts as soon as it hits the target, and
until then it is ignored rather than treated as a miss.

### Shared rules

- Both walks stop at `createdAt`. Days and weeks before a habit existed are
  absent, not missed, so they never break a streak.
- A weekly habit created mid-week gets the same treatment. The creation week
  counts if it hits the target, and if it falls short the walk simply stops
  there without a break. Creating a habit on a Wednesday costs nothing.
- Missing a day, or falling short in a week, resets the streak to zero. There
  are no grace days and no freezes.
- The card labels the unit, because a daily 5 and a weekly 5 are different
  claims. Daily habits read "5 days", weekly habits read "5 weeks", and zero
  reads "no streak".

## Screens and States

One screen, Today. No navigation.

**Header** shows the current date in long form, for example "Thursday, Aug 27".

**Add habit form** takes a name, a cadence (Daily, or N times per week), and,
when weekly is selected, a target from 1 to 6. Submitting appends the habit
and clears the form. An empty name is rejected.

**Habit list** renders one card per habit, in creation order. Each card carries:

- The habit name and its cadence label.
- The streak badge, with its unit.
- For weekly habits only, progress against this week's target ("2 of 3 this
  week").
- A 7-day strip of seven cells, oldest on the left and today on the right, each
  labeled with a weekday initial and day number. A filled cell means done.
  Tapping any cell toggles that day, which is how both today's check-in and
  backfill work. Today has no separate checkbox; the rightmost cell is it. The
  strip is the entire backfill window, so backfill reaches today plus the six
  days before it, and anything older is unreachable by design.
- A delete button, guarded by a native `confirm()`.

**Empty state** replaces the list when no habits exist, prompting the user to
add their first one.

**Storage unavailable state** shows a banner and disables the form. Every
localStorage read and write is wrapped in try/catch, because private browsing
and quota exhaustion both throw, and a thrown write must not take the render
down with it.

**Offline** needs no state of its own. The service worker caches the app shell
on install, so a cold offline launch works, and there are no network requests
after that.

**Midnight rollover** is handled by recomputing the date and re-rendering on
`visibilitychange`. Leaving the app open overnight would otherwise leave the
strip pointing at yesterday.

## Code Style

Plain functions and direct DOM calls. No classes, no state library, no
abstractions added ahead of a second caller.

```js
// streak.js — pure, clock-free, testable.
export function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Shifting the day component, not milliseconds, survives a 23- or 25-hour day.
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}
```

Dates travel as `YYYY-MM-DD` local calendar keys, not `Date` objects. Only
`dateKey` reads a `Date`, so everything downstream compares and sorts as a plain
string and no timezone offset can leak into the arithmetic.

Conventions: `camelCase` for functions and variables, named exports only, single
quotes, semicolons, two-space indent. Comments explain why, not what. A
deliberate shortcut gets a `ponytail:` comment naming its ceiling.

## Testing Strategy

`TZ=America/New_York node --test` runs `test/streak.test.js` against
`streak.js`. The streak and date functions are the only place a bug produces a
wrong number the user would believe, and they are pure, so they get real tests.
Everything else is DOM wiring, verified by hand.

Cases the suite must cover:

- `dateKey` returns the local date, including for a time late in the evening in
  a negative-offset timezone, where `toISOString()` would return tomorrow.
- `weekStart` returns Monday for every day of the week, including Sunday.
- Daily streak: unlogged today does not break the streak; a missed completed day
  does; a gap resets to zero; a habit created today and checked today reads 1; a
  habit created today and unchecked reads 0.
- Daily streak across a month boundary and across a year boundary.
- Weekly streak: current week counts once the target is hit and is ignored
  before that; a short week resets to zero; consecutive qualifying weeks
  accumulate.
- Weekly streak for a habit created mid-week, both when the creation week hits
  the target and when it falls short.
- Backfilling a day inside the window restores the streak that day had broken.

Verified manually, on a phone: install to the home screen, cold launch in
airplane mode, add and delete a habit, toggle today, backfill a day, and confirm
the state survives a full app restart.

## Boundaries

**Always:** run `TZ=America/New_York node --test` before committing; keep all
streak logic pure and clock-free; build date keys from local components; wrap
localStorage access in try/catch; keep the whole app working offline.

**Ask first:** adding any dependency; adding a build step; changing the
localStorage schema or its key; adding a second screen; changing the
hosting target.

**Never:** send data anywhere off the device; add analytics or telemetry; persist
a computed streak; commit secrets; delete or skip a failing test to make the
suite pass.

## Success Criteria

1. `TZ=America/New_York node --test` passes, and the suite covers every case
   listed above.
2. The app installs to a phone home screen and cold launches offline.
3. Adding, deleting, checking, and backfilling all survive a full app restart.
4. A daily habit with a three-day history shows "3 days" before today is logged,
   and "4 days" after.
5. A 3x weekly habit shows "no streak" at 2 of 3, and "1 week" at 3 of 3.
6. Backfilling a missed day inside the window restores the streak.
7. The strip exposes exactly seven days, and nothing older is reachable.
8. No network request leaves the device after the shell is cached.

## Non-Goals

Confirmed out of scope in the interview:

- Month grid, charts, and completion percentages.
- Reminders and push notifications.
- Export, import, and backup of any kind.
- Sync, accounts, sharing, and multi-user.
- Categories, tags, and notes on an entry.
- Editing a habit's cadence or target after creation.
- Backfill beyond the strip (today plus the six days before it), and any other
  editing of history.
- Grace days, streak freezes, and partial credit.

Added by this spec, not discussed in the interview:

- Editing a habit name after creation. The interview only settled cadence.
- Undo, and a delete that can be reversed.

Two accepted consequences, restated so nobody relitigates them later. No export
means a cleared browser or an eviction destroys the history permanently, with
nothing to restore from. No cadence editing means moving "gym 3x" to "gym 4x"
costs the streak.

## Deployment

GitHub Pages, serving the repo root off `main`. This directory is not a git
repository yet, so the first implementation task is `git init`, a first commit,
a push to a new GitHub remote, and enabling Pages in the repo settings. Pages
gives HTTPS on a `github.io` subdomain, which is what the phone needs before it
will offer to install anything.

A public repo keeps Pages free, and it publishes the source, not the data. The
habit history lives in localStorage on the phone and is never uploaded, so the
privacy constraint holds regardless of who can read the code.

Icons are a generated placeholder: a single glyph on a solid background,
rendered to `icons/icon-192.png` and `icons/icon-512.png` by a throwaway script,
committed, and swapped for a real design later if it ever matters. Nothing in
the app references the icons except `manifest.webmanifest`, so replacing them
is a file swap.

An empty `.nojekyll` at the repo root turns off Jekyll, so Pages publishes the
files as they are.

## Open Questions

None outstanding.
