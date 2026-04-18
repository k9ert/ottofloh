# AGENTS.md

Operational notes for the Ottobrunner Hofflohmarkt site. Read this before touching anything — the repo has several non-obvious traps.

## Repo layout

Two branches, both load-bearing, **both hand-edited in different ways**:

- `master` — source of truth for the PDF generator (`src/`), the GH Actions workflow, the Cloudflare Worker (`worker/`), and the dependencies (`requirements.txt`). Never contains `index.html` or any site assets.
- `gh-pages` — the live website. Contains `index.html`, registration/Nostr/payment JS, CSS, photos, and `assets/Ottobrunner Hofflohmarkt <year>.pdf`. **`index.html` is hand-edited on this branch** — it is not generated from `master`. The workflow pushes only into `assets/`; everything else is manually maintained.

Consequence: to change a date or wording on the site, edit `index.html` on `gh-pages` directly. To change the PDF generator, edit `src/` on `master`.

## Live components

### 1. Registration flow (Airtable)

```
index.html form  →  registration.js  →  https://ottofloh-api.kneunert.workers.dev
                                              │
                                              ├──→  Airtable base appbtLFYW5FJqeDj2 / table "Registrations"
                                              │        │
                                              │        └─ Airtable automation sends confirmation email
                                              │           (link → ottofloh.de/confirm.html?token=…)
                                              │
                                              └──→  ntfy.sh topic "ottofloh_alerts" (push notification)

user clicks email link
  → ottofloh.de/confirm.html?token=…   (on gh-pages)
  → JS extracts token, calls GET /confirm?token=…
  → worker flips Airtable Status: new → confirmed
```

- Cloudflare Worker in `worker/` (on `master`). Added in commit `5ae5863` to move the Airtable API key out of the browser.
- Endpoints: `POST /register` (create row, Status=`new`), `GET /confirm?token=…` (flip to Status=`confirmed`).
- `Registrations` table primary field is `Name` and **cannot be hidden** in Airtable — relevant when exporting CSV (see below).
- Sensitive fields: `ConfirmationToken`. Never export it to anything external (Google My Maps, pastebins, etc.).

#### Worker — wrangler setup

- `worker/wrangler.toml` holds only **public vars** (base ID, table name, `ALLOWED_ORIGIN`). These are visible in the repo — no secrets here.
- **Secrets live in Cloudflare**, set via `wrangler secret put`:
  - `AIRTABLE_API_KEY` — Airtable PAT with scope on the Registrations base
  - (future: `ANTHROPIC_API_KEY` for the flyer feature — see issue #3)
- **Deploy**: pushes to `master` touching `worker/**` auto-deploy via `.github/workflows/deploy-worker.yml` (uses `cloudflare/wrangler-action@v3` with `CLOUDFLARE_API_TOKEN` repo secret). Manual deploy is `cd worker && wrangler deploy` (requires local `wrangler login`).
- **Live URL**: `https://ottofloh-api.kneunert.workers.dev` (default `*.workers.dev` subdomain, no custom domain yet — planned in issue #2).
- The `worker/registration.js.new` file is a *template* of the frontend JS that lives on `gh-pages` as `registration.js`. It's kept on `master` for reference; the actual live file is hand-edited on `gh-pages` with the real API URL substituted for `<YOUR_CF_SUBDOMAIN>`.

#### Email sending — Airtable automation (NOT the worker)

The worker **does not send email**. The confirmation email is sent by an **Airtable automation** inside the Registrations base:

- Trigger: a new record is created (or a record's `Status` becomes `new` with a populated `ConfirmationToken`).
- Action: Airtable sends an email to the record's `Email` with a link of the form
  `https://ottofloh.de/confirm.html?token={ConfirmationToken}`.
- The email body/subject/sender is configured in the Airtable automation UI, not in this repo — edit it there.
- Consequence: if confirmation emails stop arriving, check the Airtable automation run history **first** (most common cause: automation paused, or Airtable workspace hit its monthly automation-run quota). The worker having returned 200 only proves the *row* was created.

#### ntfy push notifications

- On every successful `POST /register`, the worker fires a ntfy push to `https://ntfy.sh/ottofloh_alerts` (title "Neue Anmeldung (unbestätigt)", body = name + address + email).
- Topic is **public and unauthenticated** — anyone who knows `ottofloh_alerts` can read it. This is intentional (it's a low-value alert stream, not PII-critical beyond the registrant's own data), but keep it out of public docs/screenshots.
- Subscribe from the ntfy iOS/Android app or `curl -s https://ntfy.sh/ottofloh_alerts/json`.
- Failure to push is swallowed (`ctx.waitUntil(...catch...)`) — never blocks the registration response.

### 2. Map + PDF flow (Google My Maps → GH Actions → gh-pages)

```
Google My Map (mid=1PSpm0UQdwph3UkQLM-Xzd2mVhQetLUE, owned by user kim/al-munazzim)
    │
    │ KML export: https://www.google.com/maps/d/u/0/kml?mid=…&forcekml=1
    ▼
GH Actions workflow (.github/workflows/deploy.yml, cron every 6h + push to master)
    │ python src/main.py  →  build/Ottobrunner Hofflohmarkt <year>.pdf
    ▼
gh-pages branch, assets/ folder  (JamesIves/github-pages-deploy-action, clean: false)
```

- The Google My Map is **not** auto-populated from Airtable. It is always hand-curated. See *Annual rebuild procedure* below for the CSV-import ritual that links the two.
- `clean: false` on the deploy action is deliberate — it prevents `index.html` (hand-edited on `gh-pages`) from being wiped by deploys that only write `assets/`.
- `src/kmzparser.py` now has a **Google Geocoding API fallback** (`_geocode`): when a Placemark has `<address>` but no `<coordinates>` (always the case for CSV-imported My Maps layers), it geocodes on the fly using the `GOOGLE_MAPS_API_KEY` secret. The fallback is keyed by the `<address>` text and cached in-process for the run's duration.

## GitHub secrets (on `k9ert/ottofloh` repo)

- `GOOGLE_MAPS_API_KEY` — must have **both** APIs enabled on the owning GCP project:
  - **Maps Static API** (for the map image in the PDF)
  - **Geocoding API** (for the fallback in `kmzparser.py`)
  If only one is on, the build either renders a blank map (Geocoding off) or never gets to rendering (Static off). `REQUEST_DENIED` errors in the run log mean one of these is missing on the *correct* project — Cloud Console project selector gotcha.
- `GITHUB_TOKEN` — standard, for the deploy action push to `gh-pages`.
- `CLOUDFLARE_API_TOKEN` — used by `.github/workflows/deploy-worker.yml` to deploy the worker on `worker/**` pushes. Scope: Edit workers on the account owning `ottofloh-api`.

## Annual rebuild procedure (the ritual)

Every year the event date, title, and registration roster change. There are three touchpoints; all three must be updated.

### Step 1 — bump year/date on `master`

Edit `src/main.py`:
- `:73` event date string (`"Samstag, DD. Month YYYY, HH:MM - HH:MM Uhr"`)
- `:106` title (`"Ottobrunner Hofflohmarkt YYYY"`)

Edit `.github/workflows/deploy.yml`:
- `:25` `KMZ_URL` — replace `mid=…` with the new Google My Map ID for the new year (each year gets its own My Map, don't reuse).

Commit + push to `master`. Workflow will trigger automatically.

### Step 2 — bump year/date on `gh-pages` (`index.html`)

There are ~10 places in `index.html` that need updating for a new year. Grep for the old year first:

```
git checkout gh-pages
grep -n "2025\|Mai\|April" index.html
```

Touchpoints (line numbers drift — re-grep):
- `<title>`
- `<h1>` and `<h2>` (title + date)
- "Rückblick YYYY" section (stats for the previous year)
- Stats block (`Garagen im Jahr …`, the count badge)
- Chart.js `years` array in the inline script
- Map link button (`<a href="https://bit.ly/…">`) — each year gets a new short link pointing at the new My Map
- PDF download link (`<a href="assets/Ottobrunner Hofflohmarkt YYYY.pdf">`)

Commit directly on `gh-pages`. No workflow runs for this branch — your commit *is* the deploy.

### Step 3 — populate the new Google My Map from Airtable

**3a. Automated export (download + normalize)**

```bash
AIRTABLE_API_KEY=pat… python scripts/airtable_export.py
```

Or put `airtable_api_key: pat…` in `secrets.yaml`. The script:
- Fetches all records where `Status = confirmed` via the Airtable API
- Writes raw data to `build/airtable_raw.csv`
- Produces `build/airtable_export.csv` — cleaned, deduped, with columns `Address` and `Name`
  - `Address`: normalized to end with `, 85521 Ottobrunn`
  - `Name`: mapped from the Airtable `Notes` field (becomes the pin description in My Maps)
  - Original `Name` column is dropped to prevent `kmzparser.py` from reading it as the street

The normalizer is now `scripts/airtable_export.py` — it handles both the Airtable download and the CSV cleanup in one step. See *Step 3 — automated export* below.

**3c. Import into the new Google My Map**

1. Create a new Google My Map (new `mid`, don't reuse previous year's). Owner: the Google account that can reach `https://www.google.com/maps/d/u/1/…` — may not be your default account.
2. **Delete the default "Untitled layer"** (or any stale layer). Never import into an existing layer — the wizard won't overwrite, you'll get duplicates.
3. *Add layer → Import → drop `Registrations-export-fixed.csv`*.
4. First wizard step, *"Choose columns to position your placemarks"*: tick **`Address`** only.
5. Second wizard step, *"Choose a column to title your markers"*: pick **`Address`** (not `Name`, not any other column — the PDF's address list shows whatever you pick here, and it must be the street).
6. After import, verify in the data table that all rows are green (not red). Red = geocoding failed; fix the CSV and re-import.
7. Rename the layer to `teilnehmende Garagen` (cosmetic, nothing depends on it — `kmzparser.py` uses a global xpath).
8. Create a new bit.ly short link pointing at the My Map's viewer URL and put it in `index.html`.

**3d. Trigger the workflow**

```
gh workflow run deploy.yml
gh run watch $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

Verify no `Warning: Skipping placemark` lines in the log. PDF should land in `assets/` on `gh-pages`.

## Known bugs / gotchas

### 1. `kmz.hash` never updates on `gh-pages`

The workflow's `Generate PDF` step does `echo "$NEW_HASH" > kmz.hash` at the repo root, but the deploy action only syncs `assets/` to `gh-pages`. Result: `kmz.hash` on `gh-pages` has been `a14e3a0f598b2cd340fbfc29b06b27e3` since August 2025, the hash check always reads that stale value, and **every workflow run rebuilds and redeploys** regardless of whether the KMZ actually changed.

This is load-bearing accidentally — it means the Geocoding API gets hit every run (18 calls ≈ $0.09 every 6h ≈ $11/month). If you fix the hash persistence, add a short-circuit that also skips geocoding when unchanged.

### 2. Google My Maps KML for CSV-imported layers omits `<coordinates>`

Placemarks imported from a CSV look like:

```xml
<Placemark>
  <name>Rubensstraße 6, 85521 Ottobrunn</name>
  <address>Rubensstraße 6, 85521 Ottobrunn</address>
  <styleUrl>#icon-1899-0288D1-nodesc</styleUrl>
</Placemark>
```

No `<Point><coordinates>`. All three export URL variants behave this way (`forcekml=1`, default, `lid=0`) — it's Google's behavior for CSV layers, not an export flag.

Fix: `_geocode()` in `src/kmzparser.py` hits `maps.googleapis.com/maps/api/geocode/json` for every such placemark. The old (2025 and earlier) maps worked without this because pins were hand-clicked, which writes `<coordinates>` inline — the fallback code path stays dormant for those, so it remains backward-compatible.

### 3. `kmzparser.py` walks every Placemark in the document

`parse_kml_coordinates()` and `parse_kml_addresses()` use xpath `.//kml:Placemark` with no filter. If the My Map has multiple layers, the PDF will contain pins from **all** of them. During the 2026 rebuild we saw duplicate pins (~37) because a stale `Registrations-export-fixed.csv` layer from a previous import was never deleted. Always audit layers in the My Maps UI before triggering a build.

### 4. SSH remote may not work from Claude Code sessions

`git@github.com` fetch/push fails with "Permission denied (publickey)" in Claude Code sandboxes. Workaround: prefix git commands with the HTTPS insteadOf override, which works because `gh` is authenticated:

```
git -c url."https://github.com/".insteadOf=git@github.com: fetch origin
git -c url."https://github.com/".insteadOf=git@github.com: push origin master
```

Don't change the repo's configured remote — just use the per-command override.

### 5. `gh-pages` can fall **hundreds** of commits behind origin

The cron runs every 6h and pushes a new commit each time (see bug #1). A week unattended = ~28 commits. A year = ~1400. We saw 994 at one point. Always `git fetch origin gh-pages && git merge --ff-only origin/gh-pages` before editing `index.html`.

## Commands

```bash
# Local dev venv (lives in .venv/, already gitignored globally)
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Fetch current KMZ for inspection
curl -sL "https://www.google.com/maps/d/u/0/kml?mid=<MID>&forcekml=1" -o /tmp/map.kmz
python3 -c "import xml.etree.ElementTree as ET; ns={'k':'http://www.opengis.net/kml/2.2'}; \
  [print(p.find('k:name',ns).text) for p in ET.parse('/tmp/map.kmz').getroot().findall('.//k:Placemark',ns)]"

# Trigger the deploy workflow
gh workflow run deploy.yml
gh run watch $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')

# Tail the latest run's PDF-generation output
gh run view $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId') --log \
  | grep -E "Warning|Geocoding|PDF created|Map image"
```

## File reference

- `src/main.py` — PDF renderer. Hardcoded title + date at `:73` and `:106`. Uses reportlab + Pillow.
- `src/kmzparser.py` — KML parser + Geocoding API fallback. Note the module-level `init()` call on import: reading the KMZ happens as a side effect of `from kmzparser import …`, so it must run in a cwd where `data.kmz` exists.
- `src/config.py` — reads `api_key` from `secrets.yaml` (created fresh per workflow run from GH secret, gitignored locally).
- `.github/workflows/deploy.yml` — the PDF/map workflow. Cron (every 6h) + push to `master` + manual.
- `.github/workflows/deploy-worker.yml` — auto-deploys the Cloudflare Worker on pushes to `worker/**`. Uses `cloudflare/wrangler-action@v3` + `CLOUDFLARE_API_TOKEN` repo secret.
- `scripts/airtable_export.py` — downloads confirmed registrations from Airtable, normalizes addresses, outputs `build/airtable_raw.csv` + `build/airtable_export.csv`.
- `worker/index.js` — Cloudflare Worker proxying Airtable + ntfy alerts. Auto-deployed by `deploy-worker.yml` on push.
- `worker/wrangler.toml` — public vars only (base ID, table name, allowed origin). Secrets set out-of-band via `wrangler secret put`.
- `worker/registration.js.new` — template of the gh-pages `registration.js` (reference only; live file is hand-edited on `gh-pages`).
- `index.html` (on `gh-pages` only) — the site. Hand-edited.
- `kmz.hash` (on `gh-pages`) — see bug #1, currently stuck.
