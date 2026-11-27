# Caspar’s Arcade

[Open the arcade](https://caspar5911.github.io/RuleReaper/). GitHub Pages builds the hub and its games from this repository after tests pass on main.

[Play Snap Ruler](https://caspar5911.github.io/RuleReaper/games/snap-ruler/), a ten-floor arcade prototype with a bend-and-release marble launcher. Personal bests stay in the browser.

[Play RuleReaper](https://caspar5911.github.io/RuleReaper/games/rulereaper/), a shelved prototype about escaping a maze and banning a move. Earlier challenge links still open the correct maze and rules. See its [master plan](docs/MASTER_PLAN.md) for the original design.

## Start another game

Use Node 24 from the repository root.

```sh
node scripts/new-game.mjs my-game "My Game"
```

The command creates `games/my-game/game.json` and `games/my-game/public/index.html`. Put the browser-ready game and its relative assets in `public/`. You can preview a draft with `python3 -m http.server 8081 --directory games/my-game/public`.

When the game is ready for the hub, add a short summary in `game.json` and change its status from `draft` to `prototype` or `playable`. Add `public/cover.png` if you have a screenshot. Open a PR in this repo. Drafts stay out of the Pages artifact. The `archived` status keeps shelved prototypes playable and lists them after active games.

## Preview the hub

```sh
node --test
node scripts/build-pages.mjs 1
python3 -m http.server 8080 --directory _site
```

Open http://localhost:8080. Builds publish only the hub and the registered games’ public files. Keep credentials and private data outside the repository and out of every game’s public directory. See [AGENTS.md](AGENTS.md) for the PR and publishing workflow.
