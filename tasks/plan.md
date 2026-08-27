# Implementation Plan: Habit Tracker

Implements `SPEC.md`, which implements `docs/intent/habit-tracker.md`. Read the
spec's Data Model and Streak Rules sections before starting any task; this plan
does not repeat them.

**Task list target:** this file. You asked for tasks in `tasks/plan.md`, so
there is no `tasks/todo.md`. Anything downstream that expects one (the `/build`
command, for instance) should read the Task List below instead.

## Overview

Thirteen tasks in six phases, building a single-screen PWA with no dependencies
and no build step. The pure streak core gets real tests; the DOM wiring gets a
manual checklist. Roughly two focused sessions of work if nothing surprises us.

## Architecture Decisions

**Deploy an empty shell first, before writing any app code.** Phone install over
HTTPS is the one thing that cannot be tested on the laptop, and it is the only
part of this build that could fail for a reason none of us predicted. Tasks 1
and 2 push a placeholder page to GitHub Pages and confirm it installs, so a
hosting or manifest problem surfaces while there is nothing to throw away.

**The service worker caches at runtime, not from a precache list.** A hardcoded
list of files to cache would need editing every time a task adds a file, and
that is exactly the kind of bookkeeping that rots. Instead the worker serves
cache-first and fills the cache from whatever the page actually fetches. The
trade-off is that a deploy does not reach an installed app until the cache name
changes, so `CACHE` is a version constant and bumping it is part of deploying.

**Pure core, then persistence, then UI, then stats.** The streak functions take
`today` as a parameter and touch neither storage nor the DOM, so they can be
written and fully tested before anything renders. Tasks 3 through 5 have no
dependency on tasks 6 through 8, and either pair can go first.

**Tests run under a fixed timezone.** `TZ=America/New_York node --test` is the
real command. The local-date rule in the spec exists because `toISOString()`
shifts the date for negative UTC offsets, and a suite that runs in UTC cannot
catch the bug it was written for.

**Vertical slices from task 7 onward.** Adding a habit means form, store write,
persistence, and render in one task, not four. Each task from there leaves an
app you can open and use.

## Definition of Done

The standing bar every task clears, on top of its own acceptance criteria:

- `TZ=America/New_York node --test` passes.
- The app still loads and works with the network off.
- No new dependency, no build step, no framework.
- No request leaves the device, and no habit data is sent anywhere.
- Any deliberate shortcut carries a `ponytail:` comment naming its ceiling.

## Dependency Graph

```
T1 repo + Pages
 └── T2 PWA install
      │
      ├── T3 date helpers ──┬── T4 daily streak ──┐
      │                     └── T5 weekly streak ─┤
      │                                           │
      └── T6 store.js ── T7 add habit ── T8 delete habit
                              │                   │
                              └── T9 strip + toggle ── T10 stats display
                                                        │
                                                        ├── T11 edge states
                                                        ├── T12 rollover
                                                        └── T13 device pass
```

T3 through T5 and T6 through T8 are independent of each other. T4 and T5 are
independent of each other.

---

## Task List

### Phase 1: Foundation and install (fail fast)

- [ ] **Task 1: Git repo on GitHub Pages serving a placeholder**

  Turn this directory into a git repository, push it to a new public GitHub
  repo, and enable Pages on `main` at the repo root. `index.html` is a
  placeholder that says the app's name and nothing else. Add an empty
  `.nojekyll` so Pages publishes files as they are. Gitignore `.claude/`,
  `.agents/`, and `skills-lock.json`, which are local agent tooling and do not
  belong in a public repo.

  **Status: partial.** The local repo and `.gitignore` landed alongside T4, so
  the streak work had somewhere to commit. The GitHub remote, the placeholder
  `index.html`, `.nojekyll`, and enabling Pages are still open, and creating the
  public repo needs Rodrigo's go.

  - Acceptance: the Pages URL loads the placeholder over HTTPS from a phone on
    cellular, not just from the laptop.
  - Acceptance: `git status` is clean, and `.claude/`, `.agents/`, and
    `skills-lock.json` are untracked.
  - Verify: open the `github.io` URL on the phone with wifi off.
  - Dependencies: none.
  - Files: `index.html`, `.nojekyll`, `.gitignore`.
  - Scope: XS.

- [x] **Task 2: Installable PWA shell**

  Add `manifest.webmanifest` (name, short name, `display: standalone`, theme and
  background colors, both icon sizes), plus an `apple-touch-icon` link in
  `index.html`, because Safari ignores manifest icons for the home screen and
  falls back to a screenshot of the page without it. Generate the two
  placeholder icons with a throwaway script, and add `sw.js` doing cache-first
  with runtime fill behind a `CACHE` version constant. Register the worker from
  `index.html`.

  - Acceptance: the app installs to the home screen, via the Android install
    prompt or iOS Add to Home Screen, and launches without browser chrome.
  - Acceptance: after one online visit, a cold launch in airplane mode renders
    the page rather than an error.
  - Acceptance: bumping `CACHE` and redeploying serves the new page on next
    launch.

  **Note.** The worker precaches an explicit shell list rather than relying on
  runtime fill alone. Runtime fill misses the page's own CSS and modules on a
  first visit, because the worker only claims the page after those have already
  been fetched, so a cold offline launch rendered nothing. Runtime fill still
  catches everything outside the list. Verified on the desktop by stopping the
  server and reloading; the phone install still needs the deploy.

  - Verify: install on the phone, enable airplane mode, force-quit, relaunch.
  - Dependencies: T1.
  - Files: `manifest.webmanifest`, `sw.js`, `index.html`, `icons/`.
  - Scope: S.

### Checkpoint: Install works

- [ ] The app is installed on the phone and cold-launches offline.
- [ ] A redeploy with a bumped cache version reaches the installed app.
- [ ] Stop here and confirm before writing app code. Everything after this
      assumes hosting and install are solved.

---

### Phase 2: The tested core

- [x] **Task 3: Date helpers**

  Write `streak.js` with `dateKey(date)`, `addDays(key, n)`, `weekStart(key)`
  returning the Monday, and `countInWeek(doneSet, weekStartKey)` counting
  distinct done days in that Monday-to-Sunday window. All pure, all clock-free.
  Dates travel as `YYYY-MM-DD` keys; only `dateKey` reads a `Date`. Update the
  Test command in `SPEC.md` to include the `TZ` prefix.

  **Status: done.** `dateKey` and `addDays` shipped with T4, along with the
  `SPEC.md` command update. `weekStart` and `countInWeek` shipped with T5, where
  they got their first caller.

  - Acceptance: `dateKey` returns the local calendar date, including at 8pm in a
    negative-offset zone where `toISOString()` would return tomorrow.
  - Acceptance: `weekStart` returns the correct Monday for all seven weekdays,
    Sunday included, and across a month boundary.
  - Acceptance: `addDays` handles month, year, and DST boundaries.
  - Verify: `TZ=America/New_York node --test`.
  - Dependencies: none.
  - Files: `streak.js`, `test/streak.test.js`, `SPEC.md`.
  - Scope: S.

- [x] **Task 4: Daily streak**

  Add `dailyStreak(doneSet, today, createdAt)` following the spec's pseudocode.
  The rule that matters: an unlogged today is not a miss, so the walk starts
  from yesterday when today is unlogged.

  - Acceptance: three consecutive days viewed on the fourth, unlogged, reads 3;
    logging that day reads 4; viewing on the fifth with the fourth unlogged
    reads 0.
  - Acceptance: created today and checked reads 1; created today and unchecked
    reads 0; the walk never counts days before `createdAt`.
  - Acceptance: streaks spanning a month boundary and a year boundary count
    correctly.
  - Verify: `TZ=America/New_York node --test`.
  - Dependencies: T3.
  - Files: `streak.js`, `test/streak.test.js`.
  - Scope: S.

- [x] **Task 5: Weekly streak**

  Add `weekStart(key)` and `countInWeek(doneSet, weekStartKey)` (moved from T3),
  then `weeklyStreak(doneSet, today, createdAt, target)`. The current week is in
  progress: it counts once it hits the target and is ignored before that, never
  treated as a miss. The walk stops at the creation week.

  - Acceptance: a 3x habit at 2 of 3 this week keeps last week's streak and does
    not break it; hitting the third day increments it.
  - Acceptance: a completed week below target resets to 0, and consecutive
    qualifying weeks accumulate.
  - Acceptance: a habit created on a Wednesday that falls short of target that
    week still reads 0 rather than breaking, and reads 1 if it hits target.
  - Verify: `TZ=America/New_York node --test`.
  - Dependencies: T3.
  - Files: `streak.js`, `test/streak.test.js`.
  - Scope: S.

### Checkpoint: Core is correct

- [ ] Every test case listed in the spec's Testing Strategy exists and passes.
- [ ] `streak.js` imports nothing, reads no clock, and touches no DOM.
- [ ] Backfilling a day inside the window is covered by a test that proves the
      streak comes back.

---

### Phase 3: Persistence and habits

- [x] **Task 6: Storage layer**

  Write `store.js` owning the `habit-tracker:v1` key: `load()` returning the
  parsed state or a fresh empty one, and `save(state)` writing the whole blob.
  Both wrapped in try/catch, because private browsing and quota exhaustion throw
  and a failed write must not take the render down. Expose whether storage is
  usable so the UI can say so. Read `globalThis.localStorage` inside the
  functions, never at module top level: Node 22 has no `localStorage` without
  an experimental flag, so a top-level read throws on import and the test file
  never gets to run.

  - Acceptance: a corrupt or absent value yields a valid empty state rather than
    an exception.
  - Acceptance: with `localStorage.setItem` stubbed to throw, `save()` returns a
    failure signal and does not propagate.
  - Acceptance: a round trip through `save()` and `load()` preserves habits and
    entries exactly.
  - Verify: `TZ=America/New_York node --test` for the parse and fallback paths;
    in the browser console, confirm the round trip and the throwing-stub case.
  - Dependencies: none.
  - Files: `store.js`, `test/store.test.js`.
  - Scope: S.

- [x] **Task 7: Add a habit**

  Build the real `index.html` structure, `app.js` with a render function, and
  the add form: name, cadence (daily or weekly), and a target from 1 to 6 shown
  only when weekly is selected. Submitting appends a habit with a
  `crypto.randomUUID()` id and a local `createdAt`, saves, clears the form, and
  re-renders. Each card shows name and cadence label for now.

  - Acceptance: adding a habit renders it immediately and it survives a full
    reload.
  - Acceptance: an empty or whitespace-only name is rejected without adding
    anything.
  - Acceptance: the target input appears only for weekly and the stored record
    matches the spec's shape exactly.
  - Verify: add one daily and one weekly habit, reload, inspect the stored JSON
    in devtools.
  - Dependencies: T6.
  - Files: `index.html`, `app.js`, `store.js`, `style.css`.
  - Scope: M.

- [x] **Task 8: Delete a habit**

  Add a delete button per card, guarded by a native `confirm()`. Deleting
  removes both the record in `habits` and its key in `entries`, then saves and
  re-renders.

  - Acceptance: cancelling the confirm changes nothing.
  - Acceptance: confirming removes the card, and the stored JSON has no orphan
    entries key left behind.
  - Verify: add a habit, mark a day, delete it, and check the stored JSON for
    leftovers.
  - Dependencies: T7.
  - Files: `app.js`, `store.js`.
  - Scope: XS.

### Checkpoint: Habits persist

- [ ] Add, delete, and reload all behave, on the phone and not only the laptop.
- [ ] The stored JSON matches the spec's Data Model field for field.

---

### Phase 4: Logging

- [x] **Task 9: Seven-day strip and toggle**

  Render seven cells per card, oldest left and today rightmost, each labeled
  with a weekday initial and day number, filled when done. Tapping a cell
  toggles that date in `entries`, saves, and re-renders. Today has no separate
  checkbox; the rightmost cell is it.

  - Acceptance: tapping today's cell marks it done, and tapping again clears it.
  - Acceptance: tapping an older cell backfills that date, and the change
    survives a reload.
  - Acceptance: exactly seven cells render, and no date outside that window is
    reachable from the UI.
  - Verify: toggle today and two older days, reload, confirm the strip matches
    the stored JSON.
  - Dependencies: T7.
  - Files: `app.js`, `streak.js` (adds a `lastNDays` helper), `style.css`.
  - Scope: M.

### Phase 5: Stats

- [x] **Task 10: Streak badge and weekly progress**

  Wire `dailyStreak` and `weeklyStreak` into the card. The badge names its unit,
  since a daily 5 and a weekly 5 are different claims: "5 days", "5 weeks", or
  "no streak" at zero. Weekly cards also show progress against this week's
  target, as "2 of 3 this week".

  - Acceptance: a daily habit with a three-day history reads "3 days" before
    today is logged and "4 days" after.
  - Acceptance: a 3x weekly habit reads "no streak" at 2 of 3 and "1 week" at 3
    of 3.
  - Acceptance: backfilling a missed day inside the window restores the streak
    without a reload.
  - Verify: seed a history in devtools, reload, and check each number by hand
    against the spec's rules.
  - Dependencies: T4, T5, T9.
  - Files: `app.js`, `style.css`.
  - Scope: S.

### Checkpoint: The app is usable

- [ ] Every numbered condition in the spec's Success Criteria passes except the
      offline and install ones already checked in Phase 1.
- [ ] The whole flow works on the phone, installed, not in a desktop browser.

---

### Phase 6: Edges and release

- [x] **Task 11: Empty and storage-unavailable states**

  Render a prompt instead of the list when no habits exist. When storage is
  unusable, show a banner explaining that nothing will be saved and disable the
  add form.

  - Acceptance: a fresh install shows the empty state, not a blank screen.
  - Acceptance: in a private window, or with `setItem` stubbed to throw, the
    banner appears and the form is disabled rather than silently losing data.
  - Verify: clear site data and reload; then repeat in a private window.
  - Dependencies: T7.
  - Files: `app.js`, `style.css`.
  - Scope: XS.

- [ ] **Task 12: Midnight rollover**

  Recompute today and re-render on `visibilitychange`, so an app left open
  overnight does not keep pointing the strip at yesterday.

  - Acceptance: with the app backgrounded across midnight (or with the device
    clock moved forward), returning to it shows the new day as the rightmost
    cell.
  - Acceptance: yesterday's completion still reads as done in its new position.
  - Verify: move the device clock forward a day, background and reopen the app.
  - Dependencies: T9.
  - Files: `app.js`.
  - Scope: XS.

- [ ] **Task 13: Release pass**

  Bump `CACHE`, deploy, and walk the spec's Success Criteria end to end on the
  installed phone app. Fix whatever fails, or record it as accepted.

  - Acceptance: all eight Success Criteria in `SPEC.md` pass on the phone.
  - Acceptance: devtools shows no network request after the shell is cached.
  - Acceptance: `SPEC.md` matches what actually shipped, or the difference is
    written down.
  - Verify: the full manual checklist from the spec's Testing Strategy.
  - Dependencies: all.
  - Files: `sw.js`, `SPEC.md`.
  - Scope: XS.

### Checkpoint: Complete

- [ ] All thirteen tasks checked off.
- [ ] `TZ=America/New_York node --test` passes.
- [ ] The app is installed, offline-capable, and holding real habits.

---

## Parallelization

T3 through T5 (pure core) and T6 through T8 (storage and habits) touch different
files and share no state, so a second session can take either branch. T4 and T5
are independent of each other once T3 lands. Everything from T9 onward is
sequential, because it all edits `app.js`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Phone install fails for an unforeseen reason (manifest, Pages, iOS quirk) | High | T1 and T2 prove install with a placeholder, before any app code exists to waste |
| A date bug shifts entries by a day for anyone west of UTC | High | Local date keys are a spec rule, and the suite runs under `TZ=America/New_York` so a UTC-only run cannot hide it |
| Streak logic looks right and quietly lies | High | Pure functions taking `today` as a parameter, with the spec's worked examples as test cases |
| An installed app serves a stale version forever | Medium | `CACHE` is a version constant, and bumping it is part of the deploy step and of T13 |
| localStorage is evicted and the history is gone | Medium | Accepted in the intent doc. No backup exists by design. The banner in T11 at least makes an unusable store visible |
| Agent tooling leaks into a public repo | Low | T1 gitignores `.claude/`, `.agents/`, and `skills-lock.json` |

## Open Questions

None. The spec's two open questions (hosting and icons) were resolved before
this plan was written.
