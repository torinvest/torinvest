/**
 * Cache mémoire TTL simple pour Macro Edge.
 */
"use strict";

const store = new Map();

function get(key) {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    store.delete(key);
    return null;
  }
  return row.value;
}

function set(key, value, ttlMs) {
  const ttl = Math.max(1000, Number(ttlMs) || 60000);
  store.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

function getOrSet(key, ttlMs, factory) {
  const hit = get(key);
  if (hit !== null && hit !== undefined) return Promise.resolve(hit);
  return Promise.resolve()
    .then(() => factory())
    .then((value) => set(key, value, ttlMs));
}

function clear(prefix) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (String(k).startsWith(prefix)) store.delete(k);
  }
}

module.exports = { get, set, getOrSet, clear };
