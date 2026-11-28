# Will It Fit?

First playable prototype, 28 November 2026.

The player packs everyday objects into twelve suitcases, rotates and rearranges them, then closes the lid. The daily bag uses a Singapore calendar date and shared links preserve that date. Artwork and sound are generated in the browser. Progress stays in local storage.

## Verification

- Full arcade Node suite passed 91 tests.
- Arcade build completed with versioned Will It Fit? assets.
- Independent review found no remaining important defects after fixes.
- Edge browser testing completed all twelve solutions through keyboard controls.
- Phone emulation tested real touch dragging, tap placement, rotation, overlap rejection, hints, undo/reset, lid completion, sharing, next bag, historical daily links and storage denied.
- At 320 × 568 and 375 × 667, later bags use a scrollable layout. Touch scrolling and carrying an item across the viewport edge were verified. Horizontal overflow is zero.

Browser verification used Edge emulation. Physical phones and screen readers have not been tested. Revenue and player retention have not been measured.

## Delivery

Prepared on branch `codex/will-it-fit`. Publishing follows the repository's owner-approval rule.
