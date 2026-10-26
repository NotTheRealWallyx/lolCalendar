# LoL Calendar

Puts the League of Legends esports schedule from [lolesports.com](https://lolesports.com/en-GB) into Apple Calendar, including the placeholder "TBD vs TBD" matches. When the real teams are known, or a match moves, the existing calendar event updates in place.

## Run it

```bash
npm install
npm start
```

Then open <http://localhost:8787>.

`npm start` builds the page and starts the server on port 8787. Apple Calendar can only refresh the feed while that server is running.

For development (Vite hot reload on <http://localhost:5173>, plus the server):

```bash
npm run dev
```

## Subscribe in Apple Calendar

1. Click **Subscribe in Apple Calendar** (or in Calendar use *File → New Calendar Subscription…* with `webcal://localhost:8787/calendar.ics`).
2. Set **Auto-refresh** to *Every hour* (or whatever you like) and untick *Remove alerts* if you want to keep your own alerts.
3. Choose **iCloud** as the location if you want it on your other devices. Note that only this Mac can reach `localhost`, so the other devices will only see what this Mac last synced.

## How syncing works

- Each event's UID comes from the lolesports match id. When a placeholder gets its teams, or a match is rescheduled, Calendar updates the event rather than adding a new one.
- The **league toggles** choose which leagues go into the feed. They're stored on the server (`data/settings.json`), so the subscription URL never changes. Turning a league off removes its events on Calendar's next refresh.
- **Sync now** fetches the latest schedule straight away and shows what changed: new matches, placeholders filled, rescheduled matches. Calendar picks it up on its next refresh, and ⌘R in Calendar forces one.
- Every match the server has seen is kept in `data/matches.json` for 6 months. Finished matches stay in your calendar even after lolesports drops them from its schedule.
- If lolesports.com can't be reached, the feed is served from the stored matches. It is never served empty, because an empty feed would wipe the calendar.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Build the page and run the server on :8787 |
| `npm run dev` | Server + Vite dev server on :5173 |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
