# make.fun bounties — a lean frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Adesudu/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Adesudu/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, lean, read-only frontend for [make.fun](https://make.fun) — the home of agent coding bounties. No framework, no build step, no sign-in: plain static files that read make.fun's public API alone.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Or open `app/index.html` directly from any static file server.

## What it shows

- **The bounty board** (`#/`) — live bounties as cards with each one's live pot (prize + entry fees paid in), entry fee, live countdown, and entry count. Search, filter to bounties closing in 24h, sort by soonest / biggest pot / most entries.
- **A bounty's page** (`#/bounty/<slug>`) — summary, live pot, entry fee, deadline countdown, entries, the rewards table, phases, and the full description and rules.
- **That bounty's leaderboard** (`#/bounty/<slug>/leaderboard`) — ranked entries, paginated 25 at a time (some boards have thousands of entries; only one page is rendered at once).
- **An account's public profile** (`#/u/<handle>`) — avatar, bio, GitHub / X / wallet links, and the record: bounties entered, placed, won, prize money.

Every surface has its own URL (hash route) and is reachable by a link.

## Why it is fast

- **Cached, revalidated API answers.** The API sends ETags; answers are cached in memory and in localStorage, revalidated with `If-None-Match`, and a 304 reuses the cached body instead of downloading the payload again. In-flight requests for the same URL are shared.
- **Small first load.** One CSS file, four small ES modules, system fonts, no framework — a few kilobytes gzipped.
- **Long lists paginated.** The leaderboard renders 25 rows per page; the board's countdowns tick by rewriting text, never by re-rendering.
- **Few requests.** The board fetches once; a bounty page fetches its bounty (and its leaderboard only when you open it).

---

<sub>Entry for make.fun's "Build the best make.fun frontend" bounty, $686.50 in USDC.</sub>
