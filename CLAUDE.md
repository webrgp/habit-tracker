# CLAUDE.md

A single-screen installable PWA habit tracker: daily and N-times-per-week habits,
derived streaks, a seven-day strip for logging and backfill, and localStorage on
the device. Vanilla HTML, CSS, and ES modules, served as static files from the
repo root. No framework, no bundler, no build step, no `package.json`, and zero
dependencies.

## Project map

- `index.html`, `style.css` — the one screen.
- `app.js` — render and event wiring.
- `streak.js` — pure, clock-free date and streak math. The tested core.
- `store.js` — the only code that touches localStorage.
- `sw.js`, `manifest.webmanifest`, `icons/` — the installable offline shell.
- `test/streak.test.js`, `test/store.test.js` — the `node --test` suites.
- `scripts/serve.py`, `scripts/make-icons.mjs` — dev server, icon generator.

Dependencies run one direction: `app.js` imports `streak.js` and `store.js`, and
neither of those imports anything at all.

Three documents carry the context this file deliberately does not duplicate:

- `SPEC.md` — data model, streak rules, screens and states, boundaries.
- `tasks/plan.md` — the task breakdown and the current status of each task,
  including what is still open.
- `docs/intent/habit-tracker.md` — the confirmed product decisions and the
  trade-offs already accepted. Non-goals live here and in `SPEC.md`; check both
  before adding a feature.

<important if="you need to run the app, the tests, or any script in this repo">

```
Dev:         python3 scripts/serve.py                 # http://localhost:8000
Test:        TZ=America/New_York node --test
One file:    TZ=America/New_York node --test test/streak.test.js
One case:    TZ=America/New_York node --test --test-name-pattern='weekStart returns a Monday'
Icons:       node scripts/make-icons.mjs
Build:       none
Lint:        none configured
Deploy:      git push origin main                     # GitHub Pages, repo root
```

The `TZ` prefix is mandatory, not decorative. The suite exists to catch
local-versus-UTC date bugs, and a run under UTC hides the exact class of bug it
was written for. `--test-name-pattern` matches by substring, so a short pattern
can select more than one case.

Use `scripts/serve.py` rather than `python3 -m http.server`. The stdlib server
answers with 304s, so an edited module keeps running the old code until a hard
reload.

`localhost` counts as a secure context, so service worker registration and the
install prompt both work in development without TLS.
</important>

<important if="you are touching dates, day keys, week boundaries, streaks, or weekly progress">

**Dates are local `YYYY-MM-DD` strings, not `Date` objects.** Only `dateKey()`
touches a `Date`. Never `toISOString()`, which converts to UTC and shifts the
date for anyone west of Greenwich after their afternoon. `addDays()` shifts the
day component rather than adding milliseconds, which is what keeps it correct
across a 23- or 25-hour DST day.

**Streaks are derived on every render and never stored.** There is no streak
field in the data model. An unlogged today is not a miss, because the day is
still in progress, and the same applies to a weekly target in the current week.

`streak.js` stays pure and clock-free: it takes `today` as a parameter instead of
reading a clock, which is what lets the suite cover year boundaries, DST days,
and mid-week creation without mocking anything.
</important>

<important if="you are reading or writing persisted state">

`store.js` owns the single localStorage key `habit-tracker:v1` and writes the
whole state blob on every change. Every read and write is wrapped in try/catch,
and `load()` validates the parsed shape rather than trusting it, because `null`,
`[]`, and `{"habits":5}` all parse cleanly.

It reads `globalThis.localStorage` inside each function, never at module level.
Node has no `localStorage` without an experimental flag, so a top-level read
throws on import and the test file never runs.
</important>

<important if="you are changing render, event handlers, or how habit text reaches the DOM">

`render()` reads the clock itself, so re-running it is the entire midnight
rollover, which is why `visibilitychange` just calls it again. List clicks are
delegated, so a re-render never reattaches handlers. Habit names go into the DOM
through `textContent`, never `innerHTML`.
</important>

<important if="you are adding, renaming, or removing any file the browser loads, or you are deploying">

**Every deploy after the first bumps `CACHE` in `sw.js`, and any new file joins
`SHELL` in the same edit.** An installed app serves the old cache until `CACHE`
changes, and a new module missing from `SHELL` breaks the cold offline launch.

`sw.js` is cache-first over the explicit `SHELL` list, with runtime fill for
anything outside it. The list is not redundant: the worker only claims the page
after its HTML, CSS, and modules have been fetched, so on a first visit none of
them pass through the fetch handler and a cold offline launch would render
nothing.
</important>

<important if="you are adding a network request, analytics, telemetry, or an export path">

**Nothing leaves the device.** No network requests after the shell is cached, no
analytics, no telemetry, no export path.
</important>

<important if="you are considering a dependency, a build step, a `package.json`, a localStorage schema or key change, a second screen, or a different hosting target">

Ask before doing any of these.

If a `package.json` is ever added, set `"type": "module"` in it. The `.js`
modules currently load as ES modules through Node's syntax detection, which warns
on every run and reparses each file once a `package.json` exists without that
field.
</important>

<important if="you are writing or running tests, or a test is failing">

Tests cover `streak.js` and `store.js`, which is where a bug produces a wrong
number the user would believe. Everything else is DOM wiring, verified by hand in
the browser and on a phone. Run the suite before committing, and don't delete or
skip a failing test to get it green.
</important>

<important if="you are adding a new function, module, or abstraction">

Plain functions and direct DOM calls: no classes, no state library, and no
abstraction introduced ahead of its second caller. Named exports only. Comments
explain why, not what.
</important>

<important if="you are taking a deliberate shortcut">

Mark it with a `ponytail:` comment naming its ceiling and the upgrade path.
</important>

<important if="you are creating a tracked file or writing a filesystem path into one">

The repo is public so GitHub Pages stays free, which is why `.gitignore` excludes
`.claude/`, `.agents/`, and `skills-lock.json`. Keep machine-local paths and
anything private out of tracked files.
</important>
