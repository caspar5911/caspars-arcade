# RuleReaper

**Win the puzzle. Reap a rule. Challenge the next player.**

RuleReaper is an asynchronous competitive puzzle game: every successful player must outlaw a movement pattern they used, provided another legal solution survives. The resulting puzzle becomes the next generation of a shareable challenge.

## Project status

Initial development. A local-first browser prototype is the first milestone; global chains, accounts and payments are not yet production features.

## Agent entry point

Read [AGENTS.md](AGENTS.md) and [the master plan](docs/MASTER_PLAN.md) before starting. The repository is public; never commit secrets or personal data.

## Architecture direction

Static browser client, deterministic puzzle engine, exact bounded solver, and later a transactional PostgreSQL-backed API. No live AI inference during gameplay.

No paid services or deployments are authorized by this repository initialization.
