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
  main.js          Electron main process (window, IPC, Jira HTTPS calls)
  preload.js       Context bridge exposing a minimal API to the renderer
  index.html       UI shell (tabs, views, modal)
  styles.css       Dark theme
  app.js           Top-level orchestration (state, tab routing, persistence)
  src/
    storage.js     Persistence via IPC with localStorage fallback
    capacity.js    Capacity math + Engineers table
    tshirt.js      Size defaults + editor
    initiatives.js Card list + edit modal (color picker, Jira link fields)
    gantt.js       Weekly timeline renderer
    nowNextLater.js Drag-and-drop Now/Next/Later board
    jira.js        Settings binding + epic list rendering
```
