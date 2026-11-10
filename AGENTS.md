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

## The map (locked-in spec — do not regress)

- **Basemaps:** Esri World Street Map (default) + Esri World Imagery (satellite toggle). **Why:** OpenStreetMap public tiles 403/blank from this network, and the owner has no map API keys. Esri needs no key.
- **Center:** Bucyrus, Ohio `[40.808, -82.975]`
- **Features (all built and working):** size + color + sex + notes selector, click-to-pin, pin list with per-pin delete + Clear-all (confirm), city search (Photon → Nominatim fallback), "use my location", satellite toggle, auto-fallback basemap, full-screen mode.
- Keep it vanilla JS. Verify tag balance + CSS classes when editing `public/`.

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
- The dogs: **Kaia** the Nightwatch Husky · **Fancy** the Collie · **Chance** (the pup) — the owner's map pins

## Never commit

- SSH keys (`.pem`) — stay in `C:\projects\keys/` (or `~/.ssh/`), never in git
- `nightwatch-web.db` + its `-wal`/`-shm`/`-journal` files (already git-ignored)
- `node_modules/`, `*.log`, `*.bak` (already git-ignored)
