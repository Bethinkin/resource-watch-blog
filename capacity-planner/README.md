# Capacity Planner

Desktop app for engineering capacity planning. Build a picture of a team's
workload capabilities, size work with t-shirts, and lay out initiatives on a
Gantt-style timeline or a Now / Next / Later board. Initiatives can link to
Jira epics (fetched from the REST API) or be created manually.

## Features

- **Engineers** — per-engineer hours/week, focus factor, PTO. Computes
  effective weekly hours and engineer-weeks available across a configurable
  planning horizon. Live rollup of team capacity and planned utilization.
- **T-shirt sizes** — XS/S/M/L/XL defaults mapped to engineer-weeks; fully
  editable. Shows approximate calendar-week duration for the current team
  size.
- **Initiatives** — name, description, size, color (picker), start/end dates,
  now/next/later bucket, optional Jira epic key + URL.
- **Gantt** — weekly-resolution timeline. Each initiative renders as a
  colored bar; click to open its Jira epic (or edit if unlinked).
- **Now / Next / Later** — three-column board with drag-and-drop between
  buckets.
- **Jira integration** — supply base URL, email, and an API token. The main
  process calls the Jira REST API (no browser CORS). One-click "Add as
  initiative" converts an epic into an initiative with the link already
  populated.
- **Local persistence** — state is saved to a JSON file in the Electron
  `userData` directory.

## Running

```bash
cd capacity-planner
npm install
npm start
```

## Sign-in (SSO)

On first launch the login screen offers four options. Manual works out of the
box; the others require a one-time OAuth app registration on the provider side.

Either edit `auth-config.js` directly or set env vars before launching.

### Manual
Email + password. First use of an email address creates the account. The
password is stored as a PBKDF2-SHA256 hash (200k iterations) in
`capacity-planner-users.json` under Electron's `userData` dir.

### Google
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client
   ID → **Desktop app**.
2. Copy the client ID into `auth-config.js` (`google.clientId`) or set
   `CP_GOOGLE_CLIENT_ID`.
3. No client secret is needed — the app uses PKCE with a loopback redirect.

### Atlassian (also unlocks Jira via SSO)
1. <https://developer.atlassian.com/console/myapps/> → Create → OAuth 2.0 (3LO).
2. Add permissions (Jira API: read). Add callback URL
   `http://127.0.0.1/callback` (any loopback port is accepted).
3. Put clientId + clientSecret into `auth-config.js` (or `CP_ATLASSIAN_CLIENT_ID`
   / `CP_ATLASSIAN_CLIENT_SECRET`).
4. After signing in, the app fetches your accessible Jira sites from
   `https://api.atlassian.com/oauth/token/accessible-resources`. The Jira tab
   shows a site picker and uses the OAuth bearer token for epic fetches — the
   manual API-token path becomes optional.

### Apple
1. Apple Developer → Identifiers → **Services ID** (e.g. `com.you.capacityplanner`).
2. Identifiers → **Keys** → create a key with "Sign in with Apple" enabled;
   download the `.p8`.
3. Configure in `auth-config.js`:
   - `serviceId` — the Services ID
   - `teamId` — your 10-char Apple Team ID
   - `keyId` — the Key ID from the key you created
   - `privateKeyPath` — absolute path to the downloaded `.p8` file
4. The app signs an ES256 client-secret JWT at runtime and completes the
   authorization-code flow via a loopback `form_post` callback.

### Session storage
Sessions are written to `capacity-planner-session.bin` under `userData`.
If Electron's `safeStorage` is available (macOS Keychain, Windows DPAPI,
libsecret on Linux) the session is encrypted at rest; otherwise it falls
back to plaintext JSON on that file.

## Jira setup

1. Create an API token at <https://id.atlassian.com/manage-profile/security/api-tokens>.
2. In the app's **Jira** tab fill in:
   - Base URL: `https://your-domain.atlassian.net`
   - Email: your Atlassian account email
   - API token: the token you created
   - JQL (optional): defaults to `issuetype = Epic ORDER BY updated DESC`
3. Click **Fetch epics**. Use **Add as initiative** on any epic to pull it
   into the plan with its Jira link attached.

## Capacity math

For each engineer:

```
effective_hours_per_week = hours_per_week * focus_factor
engineer_weeks           = (horizon_weeks - pto_weeks) * effective_hours_per_week / standard_week
```

Team capacity is the sum across engineers. Planned work is the sum of the
t-shirt sizes (in engineer-weeks) of the initiatives in scope. The engineers
summary shows utilization = planned / capacity.

## File layout

```
capacity-planner/
  main.js          Electron main process (window, IPC, Jira HTTPS, auth)
  preload.js       Context bridge exposing a minimal API to the renderer
  index.html       UI shell (login, tabs, views, modal)
  styles.css       Dark theme + login/user-chip styles
  app.js           Top-level orchestration (state, auth gate, tab routing)
  auth-config.js   OAuth client IDs / secrets for Google, Atlassian, Apple
  auth/
    oauth.js       PKCE + loopback server; Google + Atlassian 3LO flows
    apple.js       Sign in with Apple (ES256 client-secret JWT, form_post)
    manual.js      Local account store (PBKDF2-SHA256)
  src/
    storage.js     Persistence via IPC with localStorage fallback
    auth.js        Renderer login UI + session access
    capacity.js    Capacity math + Engineers table
    tshirt.js      Size defaults + editor
    initiatives.js Card list + edit modal (color picker, Jira link fields)
    gantt.js       Weekly timeline renderer
    nowNextLater.js Drag-and-drop Now/Next/Later board
    jira.js        Settings + site picker + epic list
```
