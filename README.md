# RuleReaper

**Win the puzzle. Reap a rule. Challenge the next player.**

RuleReaper is an asynchronous competitive puzzle game: every successful player must outlaw a movement pattern they used, provided another legal solution survives. The resulting puzzle becomes the next generation of a shareable challenge.

## Project status

The [P0 browser demo](https://caspar5911.github.io/RuleReaper/) includes a tutorial rematch and three mazes. Challenge links include the maze and its rules. Global chains, accounts, payments and analytics are not implemented.

## Agent entry point

Read [AGENTS.md](AGENTS.md) and [the master plan](docs/MASTER_PLAN.md) before starting. The repository is public; never commit secrets or personal data.

## Architecture direction

Static browser client, deterministic puzzle engine, exact bounded solver, and later a transactional PostgreSQL-backed API. No live AI inference during gameplay.

The GitHub Pages demo publishes from main after tests pass. The game offers a tap-to-reload button when it detects a newer release.

## Run locally

Requires Node 24 (tests) and Python 3 (static server).

```sh
node --test
python3 -m http.server 8080
```

Open http://localhost:8080. Use arrows or tap cells. Win, choose a verified restriction, then copy the next challenge link. No npm install required. See [master plan](docs/MASTER_PLAN.md) for viral growth, profitability and production gates.
