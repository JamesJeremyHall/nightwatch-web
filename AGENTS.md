# AGENTS.md — Nightwatch (build spec)

> Cross-tool context + build-from-scratch spec. **Read this first.**
> **Hard rule:** only state facts the owner confirmed. **Never** invent statistics, years, credentials, affiliations, guarantees, or product capabilities. If it isn't here or owner-provided, it doesn't exist.

## ⚡ LIVE STATE (2026-11-09) — READ THIS FIRST; overrides older sections where they conflict
- **Architecture is now SERVER-BACKED** (supersedes the "Phase 1: static + localStorage" notes in sections 3/5/6 below). `server.js` = **Node.js (>= 22.5) + Express + built-in `node:sqlite`**, serving the site from **`public/`** AND a shared pins API. `map.html` persists via `fetch('/api/pins')`, **not** localStorage.
- **Shared visibility (owner's confirmed requirement) = IMPLEMENTED 2026-11-09.** Pins live in `nightwatch-web.db` (SQLite); every visitor sees the same 3 pins: **Kaia the Nightwatch Husky · Fancy the Collie · Chance (the pup)**.
- **Current layout (2026-11-09):**
  - `public\` — **WEB ROOT** (the only thing the server exposes): `index.html`, `map.html`, `css\`, `js\`, `assets\`
  - `server.js` — Express server (serves `public/` + the `/api/pins` API)
  - `package.json` — deps: `express` (note: `better-sqlite3` is listed but **unused** by the code, which uses the built-in `node:sqlite`)
  - `nightwatch-web.db` — SQLite DB at **repo root** (**NOT** web-served; **tracked in git** for easy restore)
  - `node_modules\`
- **Security (verified 2026-11-09):** web root is **`public/`** only. `nightwatch-web.db`, `server.js`, `node_modules/`, `package*.json`, `*.bak` all **404** over HTTP. Never serve the project root.
- **Run locally:** `npm install` then `node server.js` (or `npm start`) → http://localhost:3000/ · `npm run dev` = `node --watch server.js`.
- **API:** `GET /api/health` · `GET /api/pins` · `POST /api/pins` (add `{lat,lng,size,color,sex?,notes?}`) · `PUT /api/pins/:id` (update) · `DELETE /api/pins/:id` (one) · `DELETE /api/pins` (clear all).
- **Status:** server **stopped** (owner paused for a while). **Next up: deploy to AWS EC2** under a public domain (see section 9) — owner to provide instance/login/domain; owner has OK'd sharing credentials.

## 0. Strategy (the pivot)
- This is a **tech-company** site, **not** a drone-pilot site. **Nightwatch Software is the main focus**; aviation is a real, supporting line.
- **The live map is the hero** — first thing people see.
- **Session 2026-11-08:** the focus was making the **full-screen map (`map.html`) work** for the owner's real use: **tracking dogs** (dogs they've found, and finding one they've lost). It is now working and **locked in** — do not regress it.
- Tone: minimal, verified, no marketing fluff. Use the owner's words, not generated copy.

## 1. Confirmed facts (safe to use)
- Brand: **Nightwatch** (aviation line: "Nightwatch Aviation")
- Map center: **Bucyrus, Ohio — [40.808, -82.975]** (verified via geocoder; the older ~40.553N/-82.717W note here was wrong)
- Phone: **(740) 361-2826**
- Drone fleet: **DJI Mavic 3 Enterprise Thermal** · **DJI Avata 2** · **DJI Avata 360**
- Aviation pricing: real-estate **$500 / $850 / $1,500** · deer recovery **from $150** · search **by mission** · night ops **custom quote**
- Aviation services: real-estate fly-throughs · thermal deer recovery · animal/person search · business aerials · events · night ops
- Videos (channel **@NightwatchAviationLLC**): `D_MhfdmTsPQ` (FPV night run) · `t2eJcLNImnw` (Marion OH listing) · `gN7vexa6H-w` (bear/dog rescue) · `UADR8nIvo_Y` (Bucyrus Taphouse)
- Assets: `assets/logo.png` (transparent owl) + favicon/apple-touch icons

## 2. The live map (core feature)  [WORKING — locked in]
- **Real use (owner's words):** a **dog-tracking map** for "a few dogs that we found" and "to help find one that we've lost." A pin = a dog (size, color, sex, notes).
- **Basemap (IMPORTANT — do NOT "fix" back to OSM):** **Esri World Street Map** (default/street) + **Esri World Imagery** (satellite), via `server.arcgisonline.com` (no API key).
  - **Why not OpenStreetMap:** OSM's *public* tile server soft-blocks/throttles this owner's connection — it returns **blank 1x1 PNG tiles** on the bursts a map makes (a single tile works, a full screen blanks => "every tile 403s"). Confirmed by testing 2026-11-08. **Esri tiles work reliably here with no key.** Do not switch the base layer back to `tile.openstreetmap.org` unless you verify that server returns real tiles for this IP.
- **Impl: `public/map.html`** — self-contained (Leaflet from CDN). **CHANGED 2026-11-09:** pins now persist via the **shared API** (`fetch` to `/api/pins`), **not** localStorage — every visitor sees the same pins (the owner's "shared visibility" requirement, now IMPLEMENTED). Needs internet for tiles + the Leaflet CDN.
- **Features (all built & working this session):**
  - Pick **size** (S/M/L = dot diameter) + **color** (Black/Brown/White/Gray/Tan/Red) + **sex** (Unknown/Male/Female) + optional **notes** -> **click the map to drop a pin**.
  - **City search** (Photon/Komoot primary, Nominatim fallback - no key) + **"Use my location"** (Geolocation API).
  - **List** of pins (size · color · sex · location), **delete one** (x button), **Clear all** (confirm overlay).
  - **Satellite toggle** (street / satellite) + auto-fallback to satellite if the street layer errors.
  - Full-screen map; centered on Bucyrus OH; dark "tactical" UI; reference dot for Bucyrus.
- **Placeholders (owner to confirm real values):** the exact size scale, the color list, and per-pin labels - sensible defaults are in place. The **lost dog's** specifics (breed/color/size/sex/last-seen) are for the owner to provide.

## 3. Tech stack + "run locally"
- **Phase 1 (done, runs today):** pure static - `map.html` + Leaflet + **localStorage**. Zero installs. "Just works on my machine."
- **Phase 2 (multi-user, only if the owner wants shared pins):** **Node.js + Express** (`GET/POST /api/pins`) + local file/in-memory store. **Node.js is NOT installed on this machine yet** - one-time install first. Owner has NOT confirmed multi-user - do not build it unasked.
- **Phase 3 (production):** swap the store for **DynamoDB** behind one `store` module. **Not** for the local demo (needs DynamoDB Local + AWS creds).
- **Rules:** no framework unless asked; vanilla JS; Leaflet; preserve tag balance + CSS class integrity. **No map API keys** (owner has none - Google Maps is out).

## 4. Design system (from `css/styles.css` `:root`)
- bg `#05070d` · panel `#0a111c` · accent `#3b82f6` · accent2 `#78abff` · text `#e9eff8` · dim `#93a4bd` · ok `#34d399` · warn `#fbbf24`
- Fonts: Space Grotesk (display) · Inter (body) · JetBrains Mono (mono)
- Aesthetic: "tactical" - `//` mono eyebrows, uppercase letter-spaced labels, corner ticks, radar/reticle accents.
- Use CSS vars; honor `prefers-reduced-motion`.

## 5. Directory  (the tree below is the pre-2026-11-09 **flat** layout; the current `public/` layout is in the LIVE STATE section at the top)
    C:\projects\nightwatch\
      index.html          (aviation page; hero is an <iframe> -> map.html?v=3 ; software-first restructure is DEFERRED)
      map.html            (WORKING full-screen dog-tracking map - the hero)
      css\styles.css
      js\main.js
      assets\  logo.png, favicon.ico, favicon.png, apple-touch-icon.png
- **Data now lives in the server's DB, not the browser:** pins are in **`nightwatch-web.db`** (SQLite via Node's built-in `node:sqlite`), shared to every visitor via the API. A code change never deletes them.
- **Security (2026-11-09):** the server serves **ONLY `public/`**. `nightwatch-web.db`, `server.js`, `node_modules\`, `package*.json`, `*.bak` are all **404** over HTTP. Do **NOT** point static serving back at the project root.

## 6. NEEDS OWNER (do not fabricate)
- [ ] **Software division** - what it is / does / who it's for (the main focus of the site). Not yet provided; the `index.html` restructure is blocked on this.
- [ ] Map **size scale**, **color list**, **pin label** - confirm the real values (defaults are in place).
- [ ] The **lost dog**'s specifics (breed, color, size, sex, last seen where/when) to mark/prioritize it on the map.
- [x] **Shared visibility (CONFIRMED requirement, 2026-11-08):** owner wants the pins visible to **everyone** who views the map (not just the owner's browser). **IMPLEMENTED 2026-11-09:** Node/Express server + shared pins API (`/api/pins`) backed by SQLite (`nightwatch-web.db`); `map.html` rewired from localStorage to `fetch`. **Remaining:** host at a public URL (owner is deploying to **AWS EC2** — see section 9) and decide who can WRITE (currently anyone with the URL can add/delete).
- [ ] The "20 question session" facts; which aviation claims stay; real backend + deploy target.

## 7. Build-from-scratch recipe (for any AI)
1. Read this file. Use ONLY section 1 (facts) + section 2 (map) + owner-provided text.
2. Stack + map: Node (>= 22.5) + Express + built-in `node:sqlite`; site lives under `public/`; Leaflet, center Bucyrus OH `[40.808,-82.975]`, **Esri World Street Map** base + **Esri World Imagery** satellite (no key), size+color+sex+notes selector, click to pin; persist pins in the **shared SQLite DB via `/api/pins`** (not localStorage).
3. **Do not use OpenStreetMap public tiles** (they 403/blank this connection) - use the Esri URLs above, or a self-hosted OSM set / a keyed provider only if the owner provides one.
4. Layout: map is the hero; software division the primary narrative; aviation a supporting section.
5. Keep it vanilla (no framework). Verify tag balance + CSS classes.
6. Test in a browser: tiles render, selector works, pin drops + persists across reload, list/delete/clear, search, satellite toggle, mobile.

## 8. Session log - 2026-11-08 (locked in; wrapping up for the night)
- **Done:** the full-screen map works for the owner.
- **Map base:** Esri World Street Map (default) + Esri World Imagery (satellite). **Why:** OSM public tiles 403/blank this IP (confirmed); owner has **no map API keys** (Google Maps ruled out); Esri is key-free and reliable here. **This is the locked-in working state - do not regress to OSM public tiles.**
- **Built this session:** sex (Unknown/Male/Female) + notes fields, per-pin delete (x) + Clear all (confirm), city search (Photon -> Nominatim), "Use my location", satellite toggle, auto-fallback, full-screen map.
- **Map center:** Bucyrus OH `[40.808, -82.975]`.
- **Open/deferred:** `index.html` software-first restructure (needs the software-division info, section 6); multi-user/shared pins (needs owner confirmation + a Node install); the lost dog's details (owner to provide).
- **Owner's already-dropped pins:** now in **`nightwatch-web.db`** (server DB) — **Kaia the Nightwatch Husky · Fancy the Collie · Chance (the pup)** (3 pins). (Previously in browser localStorage; now shared.)

## 9. Deployment — AWS EC2 (PENDING, not yet started)
- **Goal:** host Nightwatch on EC2 under a **public domain** so the site + shared map are reachable.
- **Owner has OK'd sharing credentials** (chat is ephemeral). **Needed from owner before starting:**
  1. Instance: existing (public IP or instance ID + region) OR "create new" (region).
  2. Login: username (ubuntu / ec2-user / admin) + auth (**SSH key preferred**, or password).
  3. Domain to point at it (or "no domain yet" → serve on the public IP).
- **Planned steps (CONFIRM with owner before running):** (1) reach the box (SSH key); (2) install **Node >= 22.5** (needs built-in `node:sqlite`); (3) copy repo **without** `node_modules`, **with** `nightwatch-web.db`; (4) `npm install` (just `express`) + run under **systemd / pm2** so it survives reboots; (5) open the port in the EC2 **security group**; (6) point the domain at it (DNS A record) or use the public IP.
- **Hard rule for deploy:** serve **`public/`** as the web root (never the project root) so `nightwatch-web.db`, `server.js`, `node_modules/` stay off the public web.

## 10. Session log
- **2026-11-08:** full-screen dog map built + locked in (Esri basemap; search; satellite toggle; list/delete/clear; "shared visibility" requirement captured, not yet built then).
- **2026-11-09:** added the backend (Express + built-in `node:sqlite` server + shared pins API); rewired `map.html` to the API (localStorage → fetch); moved the web root to **`public/`** (security — verified 200s for the site, 404s for DB/server/node_modules); confirmed **3 pins** (Kaia / Fancy / Chance); **EC2 deployment planned, pending owner credentials.** Server **stopped** for a break — restart with `node server.js` → http://localhost:3000/.
