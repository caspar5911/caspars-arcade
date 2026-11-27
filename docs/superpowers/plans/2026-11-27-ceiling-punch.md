# Ceiling Punch Implementation Plan

> **For agentic workers:** Use Superpowers subagent-driven development for the engine task and verify the combined change before merging. Check off steps as they pass.

**Goal** — Publish a six-floor one-tap arcade prototype in Caspar’s Arcade. A player can smash one ceiling safely or risk a double smash, then retry immediately after a miss.

**Architecture** — A deterministic engine moves the robot and resolves taps. The browser handles input, Canvas rendering and a local best floor. The existing Arcade builder publishes the game from `games/ceiling-punch/public/`.

**Tech stack** — Static HTML, CSS, JavaScript modules, Canvas and Node 24 built-in tests. Use the existing GitHub Pages workflow.

## Game rules

The robot makes one pass under each ceiling. It runs at 152 units per second from x=32 to x=384 across a 416-unit board. Even-numbered starting floors run right and odd-numbered starting floors run left. Passing the end without punching ends the run. A tap immediately punches at the current x. A cracked span on the next ceiling clears one floor. A crack at the same x in the ceiling above clears two floors. Solid concrete ends the run and leaves a visible impact mark. The next tap restarts the run.

Floors start at 0 and finish at 6. The first few cracks teach the action, and tighter or drifting cracks are candidates for later playtesting. The six-floor prototype uses fixed cracks so timing remains readable and retrying teaches a repeatable shot.

| Ceiling | Crack spans in screen coordinates |
| --- | --- |
| 1 | 96–157, 244–302 |
| 2 | 262–322, 180–213 |
| 3 | 161–220, 324–354 |
| 4 | 315–372, 123–151 |
| 5 | 112–167, 275–312 |
| 6 | 286–344, 75–104 |

## 1. Deterministic engine

- [x] Add `tests/ceiling-punch.test.mjs` and confirm it fails before implementing the engine.
- [x] Add `games/ceiling-punch/public/engine.mjs` with the contract below.
- [x] Verify a complete single-floor route, every available double-smash overlap, the final floor cap, a miss on either side of a crack, pass expiry, rapid taps during the smash, and immediate retry from a terminal state.

The engine exports `WIDTH = 416`, `EDGE = 32`, `SPEED = 152`, `TICK = 1/120`, `TOP_FLOOR = 6`, `SMASH_SECONDS = .22`, and `CEILINGS`. The ceiling array contains the six rows above with sorted inclusive `[left, right]` pairs. `doubleWindows(floor)` returns intersections of the upcoming two rows, or an empty array when only one ceiling remains.

`createRun()` returns `{phase:'ready', floor:0, x:32, direction:1, elapsed:0, impact:null}`. `tap(run)` and `step(run)` mutate the run. `tap` returns whether the input was accepted. A tap from ready, lost or won starts floor zero. A tap from running resolves the punch. A tap during a smash is ignored. `step` advances one fixed tick. During a smash, `floor` already holds the new score and `x` holds the strike position. At the end of the smash, the robot enters the next floor from its starting edge or enters the won state.

Phases are ready, running, smash, lost and won. An impact is `{x, from, cleared, reason}`. Successful strikes have `cleared` equal to 1 or 2 and `reason:null`. Misses have `cleared:0` and a reason of early, late or passed. Judge an early or late miss against the nearest crack boundary along the direction of travel.

## 2. Browser game and catalog

- [x] Scaffold `games/ceiling-punch/` in the existing repository.
- [x] Build `index.html`, `style.css`, `app.mjs` and `render.mjs`. Show both ceilings, highlight genuine double-smash spans, show the robot’s punch or impact, and update the floor count and local personal best.
- [x] Wire one touch, mouse click or Space press to cover start, punch and retry. A held key must produce one punch.
- [x] Set the game manifest to playable prototype. Use a gameplay screenshot for the hub card and link the game and plan in the README.

## 3. Verify and publish

- [x] Run `node --test` and build the Pages artifact. Check that the hub and all three game URLs work and that the artifact includes the new game files.
- [x] In a browser, verify the first hit, double smash, early or late miss, impact mark, a one-tap retry, saved best, touch input, clearing floor six and returning to the arcade. Check a narrow mobile viewport.
- [ ] Review, open a feature PR, wait for checks, merge and verify the public game URL.

A playtest with new players is the next measure of replay appeal. The release check covers controls, progression and deployment.

## Endless, continuous version (2026-11-27)

Playtest feedback: stopping after every floor and restarting each pass from the wall felt like separate little rounds, not one flowing run. The game is now continuous, like Flappy Bird.

**Rules**
- The robot never stops. It bounces off the walls instead of losing when it passes the last crack.
- A punch through a crack climbs a floor. The robot keeps running the same way through the smash, and the camera follows it up.
- Ceilings are endless. They're generated from a seed, so the same seed makes the same tower, and each new run makes a new one.
- It gets harder as you climb. Cracks narrow from about 58 to 26 units by ceiling 45, and the robot speeds up from 150 to 265 units per second.
- Gold spots are placed on purpose on about half the floors and are never thinner than 14 units. There are no accidental slivers.
- A gold punch breaks two ceilings and sends the flood back to its furthest gap.
- A flood rises from below at all times. It starts 2 floors down at 0.45 floors per second and speeds up to 1.4 floors per second. It is never more than 2.4 floors behind the robot.
- Solid concrete still ends the run (too early or too late). The flood reaching the robot's floor also ends it.

**Tuning evidence** comes from a simulation of 1,500 runs per player type, with human timing error and a 0.25 s reaction after landing:

| player | median floor | 90th percentile | median run |
|---|---|---|---|
| new (90 ms off) | 11 | 21 | 11 s |
| casual (60 ms) | 23 | 33 | 21 s |
| casual, going for gold | 21 | 32 | 19 s |
| good (35 ms) | 39 | 51 | 34 s |
| good, going for gold | 37 | 49 | 32 s |
| expert (20 ms), going for gold | 56 | 79 | 47 s |

Going for gold is a fair gamble, not a trap. Experts are mostly stopped by the flood, and everyone else by their timing.

**Verified**
- `node --test` passes.
- In headless Chromium:
  - the start screen and a phone-width viewport render correctly;
  - random taps lose to early or late punches;
  - waiting is ended by the flood;
  - a scripted player climbed 17 floors with 7 double smashes;
  - there were no console errors.

**Remaining risk** is the real feel on a phone (tap latency, how hard the flood feels), which needs a playtest with people.
