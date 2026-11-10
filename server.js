'use strict';
// Nightwatch — lightweight shared-pins backend.
// Node.js + Express + SQLite (built-in `node:sqlite`, zero native deps).
// Serves the static site (index.html / map.html / css / js / assets) AND a
// small pins API so every visitor sees the same pins. Data lives in nightwatch-web.db (repo root; created on first boot, git-ignored).
//
//   GET    /api/pins       -> list all pins
//   POST   /api/pins       -> add a pin  { lat, lng, size, color, sex?, collar?, notes?, seen_at? }
//   PUT    /api/pins/:id   -> update a pin's NOTES ONLY (everything else is frozen once logged)
//   DELETE /api/pins/:id   -> delete one pin
//   GET    /api/health     -> { ok, pins }
//
// Security: size/color/sex/collar are validated against canonical enums (stored-XSS safe),
// hex is derived server-side from color, CORS is restricted to this site + localhost,
// and mutating requests are rate-limited per IP (429 when exceeded).

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_PATH = path.join(ROOT, 'nightwatch-web.db');

// --- database -------------------------------------------------------------

// If the database file is missing (fresh clone / first boot), opening it
// creates an empty one - make that explicit and log it so a clean start is obvious.
const isNewDb = !fs.existsSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);
if (isNewDb) console.log('[nightwatch] created new database at ' + DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS pins (
    id      TEXT PRIMARY KEY,
    lat     REAL NOT NULL,
    lng     REAL NOT NULL,
    size    TEXT NOT NULL,
    color   TEXT NOT NULL,
    hex     TEXT NOT NULL DEFAULT '',
    sex     TEXT NOT NULL DEFAULT 'unknown',
    collar  TEXT,
    notes   TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL,
    seen_at INTEGER
  );
`);
// Migration: databases created before newer columns existed — add them.
{
  const cols = db.prepare('PRAGMA table_info(pins)').all().map(r => r.name);
  if (!cols.includes('seen_at')) db.exec('ALTER TABLE pins ADD COLUMN seen_at INTEGER');
  if (!cols.includes('collar')) db.exec('ALTER TABLE pins ADD COLUMN collar TEXT');
}
const q = {
  all: db.prepare('SELECT * FROM pins ORDER BY created ASC'),
  insert: db.prepare('INSERT INTO pins (id, lat, lng, size, color, hex, sex, collar, notes, created, seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
  update: db.prepare('UPDATE pins SET notes=? WHERE id=?'), // notes is the ONLY updatable field — the sighting (lat/lng/size/color/sex/collar/seen_at) is frozen once logged
  remove: db.prepare('DELETE FROM pins WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) AS n FROM pins'),
};

// --- helpers --------------------------------------------------------------
function toPin(r) {
  return { id: r.id, lat: r.lat, lng: r.lng, size: r.size, color: r.color, hex: r.hex || '', sex: r.sex || 'unknown', collar: r.collar || null, notes: r.notes || '', created: r.created, seen_at: r.seen_at ?? null };
}
// "seen at" — when the dog was actually seen. Epoch-ms (local-time instant) from the
// client; accept numbers, numeric strings, or ISO strings; anything else -> NULL.
function toSeenAt(v) {
  if (v === null || v === undefined || v === '') return null;
  let ms = (typeof v === 'number') ? v : Date.parse(v);
  if (!Number.isFinite(ms)) ms = Number(v);
  if (!Number.isFinite(ms) || ms <= 0 || ms > 4102444800000) return null; // beyond year 2100
  return Math.floor(ms);
}
// Canonical pin values — single source of truth, mirrors the form in public/map.html.
// size/color/sex are validated against these so no untrusted text (HTML, quotes, ...)
// can ever be stored and later rendered unescaped in client-side HTML (stored-XSS safe).
const CANON = {
  size:  ['Small', 'Medium', 'Large'],
  color: ['Black', 'Brown', 'White', 'Gray', 'Tan', 'Red'],
  sex:   ['Male', 'Female', 'Unknown'],
  collar: ['Yes', 'No', 'Unknown'],
};
const COLOR_HEX = { Black: '#111318', Brown: '#6b4423', White: '#e9ecef', Gray: '#8a94a3', Tan: '#c9a06b', Red: '#c0392b' };
// Case-insensitive match against a canonical list -> canonical value, or null.
function canon(v, list) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  for (const a of list) if (a.toLowerCase() === s) return a;
  return null;
}
function cleanPin(b) {
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const size = canon(b.size, CANON.size);
  const color = canon(b.color, CANON.color);
  if (!size || !color) return null;
  const sex = canon(b.sex, CANON.sex) || 'Unknown';
  const collar = canon(b.collar, CANON.collar); // optional — null when not reported
  return { lat, lng, size, color, hex: COLOR_HEX[color], sex, collar, notes: String(b.notes || '').slice(0, 2000), seen_at: toSeenAt(b.seen_at) };
}
function jerr(res, code, msg) { return res.status(code).json({ error: msg }); }

// --- app ------------------------------------------------------------------
const app = express();
app.use(express.json());
// CORS: only this site (and local dev) may call the API cross-origin.
// Same-origin requests (the map is served from this same host) need no CORS at all.
const ALLOWED_ORIGINS = new Set(['https://nightwatchaviation.com', 'http://nightwatchaviation.com', 'http://localhost:3000', 'http://127.0.0.1:3000']);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Caddy (local) front-proxies all traffic, so trust loopback proxies for req.ip
// to resolve to the real client IP (X-Forwarded-For) instead of 127.0.0.1.
app.set('trust proxy', 'loopback');

// Rate limit mutating requests per IP — the shared map has no auth, so this is
// the guardrail against spam/abuse. In-memory; resets on restart (fine at this scale).
const MUT_RATE = { windowMs: 10 * 60 * 1000, max: { POST: 20, PUT: 20, DELETE: 5 } };
const mutHits = new Map();
function rateLimitMutations(req, res, next) {
  const limit = MUT_RATE.max[req.method];
  if (!limit) return next();
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  // Per-IP AND per-method buckets: exhausting the PUT quota must not lock out DELETEs.
  const key = ip + ':' + req.method;
  let hits = (mutHits.get(key) || []).filter(t => now - t < MUT_RATE.windowMs);
  if (hits.length >= limit) {
    res.setHeader('Retry-After', String(Math.ceil((MUT_RATE.windowMs - (now - hits[0])) / 1000)));
    return res.status(429).json({ error: 'too many changes - try again in a few minutes' });
  }
  hits.push(now);
  mutHits.set(key, hits);
  if (mutHits.size > 10000) for (const [k, v] of mutHits) if (!v.some(t => now - t < MUT_RATE.windowMs)) mutHits.delete(k);
  next();
}
app.use('/api/pins', (req, res, next) => rateLimitMutations(req, res, next));

app.get('/api/health', (req, res) => res.json({ ok: true, pins: q.count.get().n }));

app.get('/api/pins', (req, res) => {
  try { res.json(q.all.all().map(toPin)); }
  catch (e) { jerr(res, 500, 'db read failed'); }
});

app.post('/api/pins', (req, res) => {
  const p = cleanPin(req.body || {});
  if (!p) return jerr(res, 400, 'invalid pin: need numeric lat/lng, size (Small/Medium/Large), color (Black/Brown/White/Gray/Tan/Red)');
  p.id = crypto.randomUUID();
  p.created = Date.now();
  try {
    q.insert.run(p.id, p.lat, p.lng, p.size, p.color, p.hex, p.sex, p.collar, p.notes, p.created, p.seen_at);
    res.status(201).json({ id: p.id, created: p.created });
  } catch (e) { jerr(res, 500, 'db write failed'); }
});

app.put('/api/pins/:id', (req, res) => {
  const b = req.body || {};
  // Once a sighting is logged it is frozen: lat/lng/size/color/sex/collar/seen_at all
  // stay exactly as reported (anything in the request for them is ignored). The only
  // field editable afterwards is `notes` — delete the pin to change the sighting itself.
  const notes = String(b.notes || '').slice(0, 2000);
  try {
    const n = q.update.run(notes, req.params.id).changes;
    if (!n) return jerr(res, 404, 'pin not found');
    res.json({ ok: true, id: req.params.id });
  } catch (e) { jerr(res, 500, 'db update failed'); }
});

app.delete('/api/pins/:id', (req, res) => {
  try {
    const n = q.remove.run(req.params.id).changes;
    if (!n) return jerr(res, 404, 'pin not found');
    res.json({ ok: true, removed: n });
  } catch (e) { jerr(res, 500, 'db delete failed'); }
});

// serve the PUBLIC site only (public/index.html, public/map.html, css, js, assets)
// — nightwatch-web.db, server.js, node_modules, package*.json all stay OUT of the web root
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

const server = app.listen(PORT, HOST, () => {
  console.log(`[nightwatch] map + shared pins API -> http://localhost:${PORT}  (db: ${DB_PATH})`);
});

// Graceful shutdown — lets `./stop.sh` (SIGTERM) and Ctrl+C (SIGINT) drain
// open connections instead of hard-killing mid-request.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[nightwatch] ${signal} received, draining connections and closing...`);
  server.close(() => {
    try { db.close(); } catch (_) {}
    console.log('[nightwatch] closed cleanly. bye.');
    process.exit(0);
  });
  // safety net: force-exit if connections refuse to drain
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
