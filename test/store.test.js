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

test('a habit record missing or corrupting a field is dropped, the rest survive', () => {
  const good = { id: 'a91b', name: 'Read', cadence: 'daily', target: 1, createdAt: '2026-08-20' };
  const bad = [
    5,
    null,
    { ...good, id: '' },
    { ...good, name: 42 },
    { ...good, cadence: 'monthly' },
    { ...good, target: 0 },
    { ...good, target: 2.5 },
    { ...good, createdAt: '8/20/2026' },
    { id: 'x', name: 'No cadence' },
  ];
  const stored = JSON.stringify({ version: 1, habits: [...bad, good], entries: {} });
  withStorage(fakeStorage({ [KEY]: stored }), () => {
    assert.deepEqual(load(), { version: 1, habits: [good], entries: { a91b: {} } });
  });
});

test('a habit id that collides with an inherited property name is dropped', () => {
  // `state.entries.__proto__` reads Object.prototype rather than a day map, so
  // the next toggle would write its date key onto every object on the page.
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const stored = JSON.stringify({
      version: 1,
      habits: [{ id, name: 'Polluter', cadence: 'daily', target: 1, createdAt: '2026-08-20' }],
      entries: {},
    });
    withStorage(fakeStorage({ [KEY]: stored }), () => assert.deepEqual(load(), EMPTY));
  }
  assert.equal({}['2026-08-27'], undefined);
});

test('entries are rebuilt, so a bad day map cannot throw on the next tap', () => {
  const good = { id: 'a91b', name: 'Read', cadence: 'daily', target: 1, createdAt: '2026-08-20' };
  const stored = JSON.stringify({
    version: 1,
    habits: [good],
    // A string here would throw on `days[date] = true`; the junk keys and the
    // orphan habit are what an older build or a hand edit leaves behind.
    entries: { a91b: { '2026-08-26': true, '2026-08-27': false, nonsense: true }, ghost: 'oops' },
  });
  withStorage(fakeStorage({ [KEY]: stored }), () => {
    assert.deepEqual(load(), {
      version: 1,
      habits: [good],
      entries: { a91b: { '2026-08-26': true } },
    });
  });
});

test('a habit whose entries value is not an object still loads with an empty map', () => {
  const good = { id: 'a91b', name: 'Read', cadence: 'daily', target: 1, createdAt: '2026-08-20' };
  const stored = JSON.stringify({ version: 1, habits: [good], entries: { a91b: ['2026-08-26'] } });
  withStorage(fakeStorage({ [KEY]: stored }), () => {
    assert.deepEqual(load(), { version: 1, habits: [good], entries: { a91b: {} } });
  });
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
