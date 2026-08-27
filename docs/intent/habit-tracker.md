# Habit Tracker — Confirmed Intent

Confirmed 2026-08-27 via interview. This is the intent, not a spec.

## Outcome

An installable PWA habit tracker. Habits are added and deleted in the UI, and
each one is set to either daily or N-times-per-week. Opening the app shows
today's habits, each with a checkbox and a 7-day strip, so you can log today or
backfill any of the last seven days.

## User

Rodrigo, alone. No accounts, no sharing, no multi-user.

## Why now

Not established. It didn't come up in the interview, and nothing in the build
depends on it.

## Streaks

Daily habits count consecutive days. Weekly habits count consecutive weeks that
hit their target, with the week starting Monday. Both show a single number on
the habit card, but the unit differs, so the card labels it. Missing a day, or
falling short in a week, resets the streak to zero. No grace days and no
freezes.

## Data

localStorage, on-device, offline. Nothing leaves the phone.

## Success

Still in use a month from now, with a streak number that's believable.

## Constraints

localStorage is per-device, so a phone and a laptop will hold two unrelated
habit histories. This is a phone app that happens to run in a browser, not a
synced one. Clearing site data or a browser storage eviction wipes everything,
and there is no backup to fall back on.

## Out of scope

Month grid, charts, completion percentages, reminders and push notifications,
export and import, sync, categories or tags, notes on an entry, editing a
habit's cadence after creation (delete and re-add instead), and any backfill
older than 7 days.

## Known trade-offs, accepted

No export means a wiped browser loses the history permanently. No cadence
editing means changing "gym 3x" to "gym 4x" costs the streak. Both were raised
and accepted.
