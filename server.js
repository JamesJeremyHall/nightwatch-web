'use strict';
// Nightwatch — lightweight shared-pins backend.
// Node.js + Express + SQLite (built-in `node:sqlite`, zero native deps).
// Serves the static site (index.html / map.html / css / js / assets) AND a
// small pins API so every visitor sees the same pins. Data lives in nightwatch-web.db (repo root; created on first boot, git-ignored).
//
//   GET    /api/pins       -> list all pins
//   POST   /api/pins       -> add a pin  { lat, lng, size, color, sex?, notes? }
//   DELETE /api/pins       -> clear all pins
//   DELETE /api/pins/:id   -> delete one pin
//   GET    /api/health     -> { ok, pins }

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
    notes   TEXT NOT NULL DEFAULT '',
    created INTEGER NOT NULL
  );
`);
const q = {
  all: db.prepare('SELECT * FROM pins ORDER BY created ASC'),
  insert: db.prepare('INSERT INTO pins (id, lat, lng, size, color, hex, sex, notes, created) VALUES (?,?,?,?,?,?,?,?,?)'),
  update: db.prepare('UPDATE pins SET lat=?, lng=?, size=?, color=?, hex=?, sex=?, notes=? WHERE id=?'),
  remove: db.prepare('DELETE FROM pins WHERE id = ?'),
  clear: db.prepare('DELETE FROM pins'),
  count: db.prepare('SELECT COUNT(*) AS n FROM pins'),
};

// --- helpers --------------------------------------------------------------
function toPin(r) {
  return { id: r.id, lat: r.lat, lng: r.lng, size: r.size, color: r.color, hex: r.hex || '', sex: r.sex || 'unknown', notes: r.notes || '', created: r.created };
}
function cleanPin(b) {
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const size = String(b.size || '').slice(0, 16);
  const color = String(b.color || '').slice(0, 32);
  if (!size || !color) return null;
  const hex = String(b.hex || '').slice(0, 16);
  const sex = String(b.sex || 'unknown').slice(0, 16);
  return { lat, lng, size, color, hex, sex, notes: String(b.notes || '').slice(0, 2000) };
}
function jerr(res, code, msg) { return res.status(code).json({ error: msg }); }

// --- app ------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, pins: q.count.get().n }));

app.get('/api/pins', (req, res) => {
  try { res.json(q.all.all().map(toPin)); }
  catch (e) { jerr(res, 500, 'db read failed'); }
});

app.post('/api/pins', (req, res) => {
  const p = cleanPin(req.body || {});
  if (!p) return jerr(res, 400, 'invalid pin: need numeric lat/lng, size, color');
  p.id = crypto.randomUUID();
  p.created = Date.now();
  try {
    q.insert.run(p.id, p.lat, p.lng, p.size, p.color, p.hex, p.sex, p.notes, p.created);
    res.status(201).json({ id: p.id, created: p.created });
  } catch (e) { jerr(res, 500, 'db write failed'); }
});

app.put('/api/pins/:id', (req, res) => {
  const b = req.body || {};
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return jerr(res, 400, 'invalid lat/lng');
  const size = String(b.size || '').slice(0, 16);
  const color = String(b.color || '').slice(0, 32);
  const hex = String(b.hex || '').slice(0, 16);
  if (!size || !color) return jerr(res, 400, 'size and color are required');
  const sex = String(b.sex || 'unknown').slice(0, 16);
  const notes = String(b.notes || '').slice(0, 2000);
  try {
    const n = q.update.run(lat, lng, size, color, hex, sex, notes, req.params.id).changes;
    if (!n) return jerr(res, 404, 'pin not found');
    res.json({ ok: true, id: req.params.id });
  } catch (e) { jerr(res, 500, 'db update failed'); }
});

app.delete('/api/pins', (req, res) => {
  try { res.json({ ok: true, removed: q.clear.run().changes }); }
  catch (e) { jerr(res, 500, 'db clear failed'); }
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
