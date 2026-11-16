// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Performance: every answer is cached and revalidated. The API sends an ETag;
// we store (etag, body) in memory and in localStorage, send If-None-Match on
// the next fetch, and take the cached body on a 304 instead of downloading the
// payload again. In-flight requests for the same URL are shared, so a view
// that asks twice only fetches once.

const API = 'https://make.fun/api';
const LS_PREFIX = 'mf-cache-v1:';
const inflight = new Map();
const memory = new Map();

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: memory cache still holds it
  }
}

function cacheGet(key) {
  if (memory.has(key)) return memory.get(key);
  const stored = lsGet(key);
  if (stored) memory.set(key, stored);
  return stored;
}

function cacheSet(key, value) {
  memory.set(key, value);
  lsSet(key, value);
}

/** GET a JSON path, cached + revalidated with ETag. Returns parsed JSON. */
export async function get(path) {
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    const cached = cacheGet(path);
    const headers = {};
    if (cached && cached.etag) headers['If-None-Match'] = cached.etag;
    let res;
    try {
      res = await fetch(API + path, { headers });
    } catch (err) {
      if (cached) return cached.body; // offline: serve the last good answer
      throw err;
    }
    if (res.status === 304 && cached) return cached.body;
    const body = await res.json();
    const etag = res.headers.get('etag');
    if (etag) cacheSet(path, { etag, body, at: Date.now() });
    return body;
  })();
  inflight.set(path, p);
  try {
    return await p;
  } finally {
    inflight.delete(path);
  }
}

/** The open bounties, with live pots and times. */
export const getBounties = (status = 'open') =>
  get(`/competitions?status=${encodeURIComponent(status)}&activity=times`);

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard (full list; the view paginates it client-side). */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
