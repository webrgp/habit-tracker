import test from 'node:test';
import assert from 'node:assert/strict';

import { KEY, load, save, storageAvailable } from '../store.js';

// Node has no localStorage without an experimental flag, so every test installs
// a fake on globalThis and removes it again. store.js reads the global inside
// its functions for exactly this reason.
function withStorage(fake, fn) {
  globalThis.localStorage = fake;
  try {
    return fn();
  } finally {
    delete globalThis.localStorage;
  }
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map),
  };
}

const EMPTY = { version: 1, habits: [], entries: {} };

test('an absent value loads as an empty state', () => {
  withStorage(fakeStorage(), () => assert.deepEqual(load(), EMPTY));
});

test('unparseable JSON loads as an empty state', () => {
  withStorage(fakeStorage({ [KEY]: '{oh no' }), () => assert.deepEqual(load(), EMPTY));
});

test('valid JSON of the wrong shape loads as an empty state', () => {
  // All three parse cleanly, so try/catch alone would let them through.
  for (const stored of ['null', '[]', '{"habits":5}', '{"habits":[],"entries":null}']) {
    withStorage(fakeStorage({ [KEY]: stored }), () => assert.deepEqual(load(), EMPTY));
  }
});

test('a read that throws loads as an empty state', () => {
  const hostile = { getItem: () => { throw new Error('private browsing'); } };
  withStorage(hostile, () => assert.deepEqual(load(), EMPTY));
});

test('no localStorage at all loads as an empty state', () => {
  assert.deepEqual(load(), EMPTY);
});

test('a round trip preserves habits and entries exactly', () => {
  const state = {
    version: 1,
    habits: [
      { id: 'a91b', name: 'Read', cadence: 'daily', target: 1, createdAt: '2026-08-20' },
      { id: '5f8c', name: 'Gym', cadence: 'weekly', target: 3, createdAt: '2026-08-27' },
    ],
    entries: { a91b: { '2026-08-26': true }, '5f8c': { '2026-08-27': true } },
  };
  withStorage(fakeStorage(), () => {
    assert.equal(save(state), true);
    assert.deepEqual(load(), state);
  });
});

test('save reports failure instead of throwing when the write is rejected', () => {
  const full = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  withStorage(full, () => assert.equal(save({ version: 1, habits: [], entries: {} }), false));
});

test('save reports failure when there is no localStorage at all', () => {
  assert.equal(save(EMPTY), false);
});

test('storageAvailable is true for working storage and leaves no probe behind', () => {
  const fake = fakeStorage();
  withStorage(fake, () => {
    assert.equal(storageAvailable(), true);
    assert.deepEqual(fake._dump(), {});
  });
});

test('storageAvailable is false when writing throws', () => {
  const full = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  withStorage(full, () => assert.equal(storageAvailable(), false));
});

test('storageAvailable is false when there is no localStorage at all', () => {
  assert.equal(storageAvailable(), false);
});
