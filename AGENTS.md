# AGENTS.md
Read README.md for the arcade layout and game setup. Read docs/MASTER_PLAN.md before changing RuleReaper gameplay.
- Work from current main; use separate feature branches and PRs. One owner per file group; communicate contracts and avoid overlapping edits. Never force push or rewrite history.
- Hub files live in hub/. Game manifests and browser assets live in games/<slug>/game.json and games/<slug>/public/. RuleReaper engine and UI live in games/rulereaper/public/. QA: independent tests and browser verification. Backend and growth agents may design P1/P2 contracts but must not provision services.
- Keep deterministic rules, exact bounded solver and fail-closed validation. No runtime AI, no personal GPU exposure. Do not trust client paths, scores, or challenge provenance in production.
- Run node --test before PR; report commands, results, failures, actual browser coverage and remaining risks. Never report unrun tests as passed.
- No secrets, tokens, personal data, production deployment, analytics tracking, payments or paid resources without owner approval. Public repo. Do not change license without owner.
- Make small reviewable commits; update docs/status with evidence. Keep prototype share format backward compatible or version it. If a prerequisite is missing, document blocker and proceed with independent tasks.
