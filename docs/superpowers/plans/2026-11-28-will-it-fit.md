# Will It Fit? implementation plan

Build an original, mobile-first packing puzzle in Caspar's Arcade. The player drags everyday objects into a suitcase, rotates them, and closes the lid once everything fits. This first version tests the core puzzle and satisfying finish.

## Scope and architecture

- Buildless HTML, CSS and ES modules, with original canvas artwork.
- Twelve campaign puzzles and a daily puzzle. Every puzzle has a known valid solution.
- A deterministic pure engine owns shape rotation, placement, overlap checks, completion and hints.
- The browser owns pointer and keyboard controls, undo/reset, sound, lid animation and local progress.
- Existing arcade build and manifest registration are the integration points.
- No accounts, external services, purchases or analytics in this prototype.

## Engine task

Create `games/will-it-fit/public/engine.mjs` and meaningful tests. Export `LEVELS`, `dailyPuzzle(date)`, `createGame(puzzle)`, `cellsFor(piece, rotation)`, `canPlace(game,id,x,y,rotation)`, `place(game,id,x,y,rotation)`, `remove(game,id)`, `undo(game)`, `reset(game)`, `isComplete(game)`, and `hint(game)`.

Puzzle shape is `{id,title,cols,rows,blocked:[],pieces:[{id,name,kind,color,cells:[[x,y],...]}],solution:[{id,x,y,rotation}]}`. State is `{puzzle,placements:{[id]:{x,y,rotation}},history:[],moves:0,hints:0}`. All rotated cells are normalized to nonnegative minimum coordinates. `place` returns boolean and atomically moves an existing piece. `remove` returns boolean. Undo restores the previous placements and move count. A hint returns `{id,x,y,rotation}` for a valid next placement, or `null` if the current layout cannot be extended. It never erases the player's work. Daily uses Singapore dates.

Use fixed, reproducible board layouts with increasingly challenging partitioned pieces and everyday item identities. Tests must verify every supplied solution, blocked cells, rotations, overlap, atomic failed moves, undo, reset, hints and deterministic daily selection.

## Browser task

Create the mobile game screen in `index.html`, `style.css`, `app.mjs`, and `draw.mjs`. Show a tactile suitcase, a tray of colourful objects, a selected-item rotate button, compact progress, and a prominent Close it button. Support pointer dragging and tap-to-select then tap-to-place. Keyboard arrows move a placement cursor, R rotates, Enter places, Escape cancels. Wrong placements remain recoverable.

Use warm coral, dark ink, teal, yellow and cool lavender. Give each object original canvas details that match its shape. Show a first-level instruction, lid-closing animation, confetti and next-puzzle action. Include daily mode, best completion records and share text. Respect reduced motion and muted audio.

## Verification and delivery

Run `node --test` and the arcade build. Verify actual browser flows at phone and desktop dimensions, including touch input, rotation, undo, hint, completion, reopening, daily and storage denied. Capture a preview cover from the finished game. Update the manifest, README and a short status note. Commit to the feature branch and open a PR.
