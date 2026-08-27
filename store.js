// The whole app state lives under one key as one JSON blob. There is no
// migration path yet, so the key carries the schema version: a future shape
// change gets a new key rather than a reader that guesses.
export const KEY = 'habit-tracker:v1';

const PROBE = `${KEY}:probe`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function emptyState() {
  return { version: 1, habits: [], entries: {} };
}

// localStorage is read through globalThis inside each function, never at module
// level. Node has no localStorage without an experimental flag, so a top-level
// read throws on import and the test file never gets to run.
function storage() {
  return globalThis.localStorage;
}

// A blob written by an older build of v1 can be missing a field, and a
// hand-edited one can hold anything at all. Every field a render or a streak
// walk depends on is checked here, because the alternative is a throw in the
// middle of render() and a screen with nothing on it.
function validHabit(habit) {
  return !!habit
    && typeof habit === 'object'
    && typeof habit.id === 'string' && habit.id !== ''
    // An id that collides with a name every object already inherits is a
    // prototype-pollution route, not a habit: `entries.__proto__` reads
    // Object.prototype, and `toggle()` would then write a date key onto every
    // object on the page.
    && !Object.hasOwn(Object.prototype, habit.id)
    && typeof habit.name === 'string' && habit.name !== ''
    && (habit.cadence === 'daily' || habit.cadence === 'weekly')
    && Number.isInteger(habit.target) && habit.target >= 1
    && DATE.test(habit.createdAt);
}

// Entries are rebuilt rather than trusted: `toggle()` assigns into the per-habit
// object, so a string or null there throws on the next tap. Rebuilding also
// drops history belonging to habits that did not survive validation.
function cleanEntries(raw, habits) {
  const out = {};
  for (const { id } of habits) {
    const days = raw[id];
    if (!days || typeof days !== 'object' || Array.isArray(days)) {
      out[id] = {};
      continue;
    }
    const kept = {};
    for (const date of Object.keys(days)) {
      if (DATE.test(date) && days[date]) kept[date] = true;
    }
    out[id] = kept;
  }
  return out;
}

// Private browsing and an exhausted quota both throw, and a failed write must
// not take the render down with it.
export function load() {
  let raw;
  try {
    raw = storage()?.getItem(KEY);
  } catch {
    return emptyState();
  }
  if (!raw) return emptyState();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyState();
  }

  // "null", "[]", and {"habits": 5} all parse cleanly, so the shape is checked
  // rather than assumed.
  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || !Array.isArray(parsed.habits)
    || !parsed.entries
    || typeof parsed.entries !== 'object'
    || Array.isArray(parsed.entries)
  ) {
    return emptyState();
  }

  // One bad record loses that habit, not the whole history. localStorage is the
  // only copy of this data, so dropping everything would be the worse failure.
  const habits = parsed.habits.filter(validHabit);
  return { version: 1, habits, entries: cleanEntries(parsed.entries, habits) };
}

export function save(state) {
  try {
    storage().setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable() {
  try {
    storage().setItem(PROBE, '1');
    storage().removeItem(PROBE);
    return true;
  } catch {
    return false;
  }
}
