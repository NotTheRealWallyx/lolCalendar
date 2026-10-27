# LoL Esports Calendar

Subscribable calendars for League of Legends esports, one per league, built from the [lolesports.com](https://lolesports.com/en-GB) schedule. Placeholder matches ("TBD vs TBD") are included and fill in with the real teams once they are decided. Rescheduled matches move in your calendar automatically.

**Site:** <https://nottherealwallyx.github.io/lolCalendar/>

## Subscribing

Open the site and press **Subscribe** on each league you follow. Each league is a separate calendar, so you can give it its own colour or hide it.

- **Apple Calendar (Mac, iPhone, iPad):** Subscribe opens Calendar. Confirm, pick **iCloud** as the location so it syncs to all your devices, and set *Auto-refresh* to *Every hour*. Or use *File → New Calendar Subscription…* with the link from **Copy link**.
- **Google Calendar:** press **Copy link**, then in Google Calendar go to *Other calendars → + → From URL* and paste it. Google refreshes subscriptions on its own schedule, which can take several hours.

If you used an earlier version of this project that imported a downloaded `.ics` or subscribed to `localhost`, delete those events or that subscription so matches don't show up twice.

## How it works

- A GitHub Action runs every hour (and on every push to `main`). It fetches the schedule for every league from the lolesports API, generates `feeds/<league>.ics` plus the data for the page, and deploys everything to GitHub Pages.
- Each event's UID comes from the lolesports match id. When a placeholder gets its teams, or a match moves, calendars update the existing event instead of adding a new one.
- Finished matches are kept for 6 months. Each run downloads the history it published last time (`data/matches.json`) and merges the new schedule into it, so no commits are needed. If anything fails (lolesports down, the history can't be read), the run stops without deploying and the published feeds stay as they were. They are never emptied.

## Setup (one time)

1. Push the repo to GitHub.
2. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
3. *Actions → Deploy to GitHub Pages → Run workflow* for the first deploy (or push to `main`).
4. Require CI before merging: *Settings → Rules → Rulesets → New branch ruleset*, target `main`, enable **Require status checks to pass** and add **Typecheck, lint, test, build**. The check only appears in the list after CI has run once.

To refresh the feeds right away, run the **Deploy to GitHub Pages** workflow manually.

GitHub pauses scheduled workflows in public repos after 60 days without repository activity. If the site stops updating, re-enable the workflow in the Actions tab or push a commit.

## Development

```bash
npm install
npm run dev
```

`npm run dev` fetches live data into `.site-data/` and starts Vite on <http://localhost:5173>. To check the production build:

```bash
npm run build && npm run preview
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Fetch live data into `.site-data/` and start the Vite dev server |
| `npm run build` | Build the page and generate feeds + data into `dist/` |
| `npm run build:web` | Build the page only (no network), used by CI |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

Locally there is no published history, so `SITE_URL` is unset and the build starts from an empty history. In the Action, `SITE_URL` is the Pages URL.

### Layout

- `lib/`: lolesports API client, normalisation, history merge, ICS generation and site files
- `scripts/build-feeds.ts`: fetches the data and writes `feeds/` and `data/` into the output folder
- `web/`: the static page
- `test/`: Vitest suites with recorded API fixtures
- `.github/workflows/`: `ci.yml` (checks on PRs and `main`) and `pages.yml` (hourly build + deploy)

## License

[MIT](LICENSE). Not affiliated with or endorsed by Riot Games. Schedule data and logos belong to their respective owners.
