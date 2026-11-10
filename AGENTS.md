# AGENTS.md — Nightwatch

> Read this first. It is the source of truth for anyone (human or AI) touching this repo.

**Hard rule:** only state facts the owner confirmed. Never invent statistics, years, credentials, affiliations, or capabilities. If it isn't here or owner-provided, it doesn't exist.

## What this is

A shared dog-tracking map for Nightwatch (Bucyrus, Ohio). The live map is the hero feature: a full-screen Leaflet map where the owner drops pins for dogs they've found, and can search for one they've lost. **Every visitor sees the same pins** — they're stored server-side in SQLite, not in browser localStorage.

- **Live:** https://nightwatchaviation.com/ (and `www.`)
- **Stack:** Node.js ≥ 22.5 + Express + built-in `node:sqlite` (zero native deps). Vanilla JS, no frontend framework.

## Running it locally

```
npm install
npm start          # -> http://localhost:3000/
npm run dev        # same, with auto-reload
```

Requires Node ≥ 22.5 (the `node:sqlite` module; `.nvmrc` pins 22). `PORT` / `HOST` env vars override the defaults (3000 / 0.0.0.0).

Helpers (Linux/macOS/WSL): `./setup.sh` (one-time install + smoke test), `./start.sh`, `./stop.sh`, `./status.sh`, `./restart.sh`. All local scripts are gitignored-safe and idempotent.

## Repo layout

| Path | What it is |
|---|---|
| `public/` | **Web root — the only thing served.** `index.html`, `map.html`, `css/`, `js/`, `assets/` |
| `server.js` | Express server: serves `public/` + the pins API |
| `nightwatch-web.db` | SQLite DB (created on first boot, **git-ignored** — data lives on each machine/server) |
| `ec2-login.ps1` / `ec2-login.sh` | One-command SSH into the production server |
| `setup.sh` … `restart.sh` | Local start/stop helpers |

**Security rule:** only ever serve `public/`. The DB, `server.js`, and `node_modules/` must never be web-accessible.

## The API

All JSON. Served by `server.js`.

| Method & path | Action |
|---|---|
| `GET /api/health` | `{ ok, pins }` — liveness + pin count |
| `GET /api/pins` | list all pins |
| `POST /api/pins` | add a pin `{ lat, lng, size, color, hex?, sex?, notes? }` |
| `PUT /api/pins/:id` | update a pin (same fields) |
| `DELETE /api/pins/:id` | delete one pin |
| `DELETE /api/pins` | clear all pins |

Pin shape: `id, lat, lng, size (S/M/L text), color (name), hex, sex (male/female/unknown), notes, created (ms epoch)`.

## How work ships (full-stack loop)

The agent is **full-stack end to end**: the owner types an idea → the agent builds it, tests it, commits, pushes, deploys to EC2, and verifies it live. The owner does not run commands; nothing is "just a PR". Every change lands on production the same session.

**Standard loop for any change:**

1. **Read before editing.** Re-read the relevant file (`public/index.html`, `public/map.html`, `server.js`) — prior agent sessions' state is in the file, not in memory.
2. **Edit.** Copy and interaction details are owner-confirmed (see "Copy & social metadata" below).
3. **Test locally (no browser available — use the toolbelt):**
   - JS syntax: extract the `<script>` block to a temp file, `node --check` it (see command quirk below).
   - HTML sanity: confirm tag balance and that edited selectors/classes exist (grep).
   - API: `npm start` → `curl` the endpoints on `http://localhost:3000` (`/api/health`, pin CRUD round-trip). `DELETE /api/pins` clears the **local** dev DB — production data is a separate file on the box and is never touched by local runs.
4. **Commit + push.** One focused commit per change, clear message, `git push origin main`.
5. **Deploy** (one command, from the repo dir on Windows — see quirk #1 for the PATH prefix):

   ```powershell
   $k='C:\projects\keys\NightwatchAvationEC2.pem'
   ssh -o BatchMode=yes -i $k ubuntu@18.221.91.41 'cd /opt/nightwatch-web; git pull origin main 2>/dev/null; git log --oneline -1; curl -fsS http://localhost/api/health; true'
   ```

   Add `npm ci --no-audit --no-fund` + `sudo systemctl restart nightwatch` **only** when `package*.json` or `server.js` changed. Static `public/` changes need no restart (files are read per request; the DB file is untouched by `git pull`).
6. **Verify live.** `curl -sk https://nightwatchaviation.com/<file>` and grep for the change (single-word patterns only — see quirk #4). Report the live commit hash back to the owner.

## Windows shell quirks (learned the hard way)

1. **PATH resets between commands.** Prefix every command that needs node/git/ssh:
   `$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'); …`
2. **JS syntax check without a browser** (works from any Windows shell):
   ```powershell
   $html=[IO.File]::ReadAllText('<repo>\public\map.html')
   $m=[regex]::Match($html,'(?s)<script>(.*)</script>')
   [IO.File]::WriteAllText("$env:TEMP\check.js",$m.Groups[1].Value)
   node --check "$env:TEMP\check.js"
   ```
3. **Backticks and `$` inside command strings can be mangled** by the command runner. Prefer single-quoted PowerShell strings, `\u0026` for literal `&` in Select-String patterns, or write a `.ps1`/`.sh` and run it.
4. **Remote SSH one-liners:** multi-word `grep "a b c"` gets word-split by the remote shell (quotes are lost in transit). Grep single words. Pipe `; true` at the end of the remote command so non-zero grep exits don't fail the SSH call.
5. `Set-Content`/`Expand-Archive` via this runner have bitten us before — prefer `cmd /c` or plain file writes when in doubt.
6. **SSH key:** `C:\projects\keys\NightwatchAvationEC2.pem` (never in git). Use `-o BatchMode=yes` for non-interactive agent use.

## The map (locked-in spec — do not regress)

- **Basemaps:** Esri World Imagery (satellite) + Esri World Street Map (streets), both via Esri ArcGIS tile service. **Why:** OpenStreetMap public tiles 403/blank from this network, and the owner has no map API keys. Esri needs no key.
- **Default basemap is context-aware** (one `map.html` serves both modes, `embedded = window.self !== window.top`): **embedded on the main page → Satellite by default**; **full-screen map.html → Street by default**. A layer control offers both in either context, and if the default's tiles fail (e.g. 403), it auto-swaps to the other basemap with a status message.
- **Center:** Bucyrus, Ohio `[40.808, -82.975]`
- **Copy (owner-locked):** heading/lead "The live map."; hint "Click the map to report a lost dog sighting. A pop-up asks for size, color, sex and notes. Scroll through and tap on the reported sightings below to zoom in on the location."; status "Synced: N shared sightings"; header counter "lost dog sightings: N" (green, **right-justified** in the header, left of the ☰ button).
- **Delete flow (owner-locked):** red **Delete** button inside the pin's popup. Clicking it swaps the popup row to an inline confirmation ("Delete this sighting?" / "Yes, delete" / "No") — **never a browser `confirm()` dialog** (it breaks the embed on the main page). New, unsaved pins show no Delete button. All popup button handlers call `stopPropagation()` so map clicks don't fire underneath.
- **Pin hover tooltip:** `Size · Color · Sex` label with the **notes** shown below it (escaped, wrapped, max 230px); pins without notes show label only.
- **Features (all built and working):** size + color + sex + notes selector, click-to-pin, pin list with zoom-on-tap, inline delete, city search (Photon → Nominatim fallback), "use my location", basemap toggle, auto-fallback basemap, full-screen mode, live shared-pin polling.
- Keep it vanilla JS. Verify tag balance + CSS classes when editing `public/`.

## Copy & social metadata (owner-locked)

- All `<title>` and `og:` tags are unified to **"Nightwatch Software Division"** across `index.html` and `map.html`. Do not revert to "Aviation" titles.
- `og:image` must be an **absolute URL** with a **cache-busting query string** (e.g. `?v=…`) — relative paths break Facebook share cards.
- After changing `og:` tags, Facebook/Looker keeps cached scrapes: the owner clears them via the [Facebook Debugger](https://developers.facebook.com/tools/debug/) — that step is manual, human-only.
- Copy strings the owner writes here are to be used **exactly** (punctuation, capitalization, phrasing) — no "improvements".

## Deployment (LIVE)

```
Browser ──HTTPS──▶ Caddy (80/443, auto-TLS via Let's Encrypt, gzip, http→https redirect)
                        │
                        ▼  reverse_proxy 127.0.0.1:3000
                   Node app (systemd unit: nightwatch, PORT=3000)
                        │
                        ▼
                   /opt/nightwatch-web/nightwatch-web.db   (SQLite, local to the box)
```

- **Server:** AWS EC2, Ubuntu 24.04, us-east-2, `ubuntu@nightwatchaviation.com` (IP 18.221.91.41)
- **App code:** `/opt/nightwatch-web` (this repo, branch `main`)
- **TLS:** Let's Encrypt, issued + auto-renewed by Caddy — no manual work, ever
- **DNS:** GoDaddy — A records `@` and `www` → 18.221.91.41 (TTL 1 Hour; allow up to an hour for changes to propagate)
- **Firewall (EC2 security group):** 80, 443, 22 open. Port 3000 can be closed (app is only reached through Caddy).

### Getting on the box

```
.\ec2-login.ps1                  # Windows — interactive shell
./ec2-login.sh                   # macOS/Linux — interactive, lands in /opt/nightwatch-web
.\ec2-login.ps1 "sudo systemctl status nightwatch"   # run one command
```

The scripts look for the SSH key in this order: `EC2_SSH_KEY` → `~/.ssh/nightwatch-ec2.pem` → `C:\projects\keys\NightwatchAvationEC2.pem` (Windows, both Git Bash and WSL path forms). The key file is **never** in this repo.

### Deploying a change

```
git push
# then on the box:
git -C /opt/nightwatch-web pull
npm ci --no-audit --no-fund        # only if package*.json changed
sudo systemctl restart nightwatch
curl -fsS https://nightwatchaviation.com/api/health
```

On a fresh box: install Node ≥ 22.5, clone the repo to `/opt/nightwatch-web`, `npm ci`, then install Caddy and create the `nightwatch` + `caddy` systemd units (Caddyfile: `reverse_proxy 127.0.0.1:3000` for the domain, `encode gzip`).

## Confirmed facts (safe to use in copy)

- Brand: **Nightwatch** (aviation line: "Nightwatch Aviation") — a tech-company site; aviation is a real supporting line
- Phone: **(740) 361-2826**
- Base: **Bucyrus, Ohio**
- Drone fleet: DJI Mavic 3 Enterprise Thermal · DJI Avata 2 · DJI Avata 360
- Aviation pricing: real-estate **$500 / $850 / $1,500** · deer recovery **from $150** · search **by mission** · night ops **custom quote**
- Services: real-estate fly-throughs · thermal deer recovery · animal/person search · business aerials · events · night ops
- Videos (channel **@NightwatchAviationLLC**): `D_MhfdmTsPQ` · `t2eJcLNImnw` · `gN7vexa6H-w` · `UADR8nIvo_Y`


## Never commit

- SSH keys (`.pem`) — stay in `C:\projects\keys/` (or `~/.ssh/`), never in git
- `nightwatch-web.db` + its `-wal`/`-shm`/`-journal` files (already git-ignored)
- `node_modules/`, `*.log`, `*.bak` (already git-ignored)
