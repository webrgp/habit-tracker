// The whole app state lives under one key as one JSON blob. There is no
// migration path yet, so the key carries the schema version: a future shape
// change gets a new key rather than a reader that guesses.
export const KEY = 'habit-tracker:v1';

const PROBE = `${KEY}:probe`;

function emptyState() {
  return { version: 1, habits: [], entries: {} };
}

// localStorage is read through globalThis inside each function, never at module
// level. Node has no localStorage without an experimental flag, so a top-level
// read throws on import and the test file never gets to run.
function storage() {
  return globalThis.localStorage;
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

  return { version: 1, habits: parsed.habits, entries: parsed.entries };
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
