// 🔄 A phone keeps its saved copy of the page for a while (and an installed home-screen app longer still), so after a
// release it may show the old game. Every release publishes version.json beside the page; when it names a newer build,
// the game reloads itself onto it, but only when nothing is lost: on the home page, never mid-shift or in a co-op stall.
export function newerBuild(current, manifest) {
  const loaded = Number(current);
  const published = manifest?.build;
  return Number.isSafeInteger(loaded) && loaded > 0 && Number.isSafeInteger(published) && published > loaded ? published : null;
}

export function updateUrl(current, build) {
  const target = new URL(current);
  target.searchParams.set('v', String(build)); // (a new address: no saved copy of it anywhere)
  return target.href;
}

/** Checks now, when the game comes back into view, and every few minutes; `safe()` says whether reloading loses nothing. */
export function keepUpdated(safe) {
  const current = document.querySelector('meta[name="hawker-rush-build"]')?.content;
  if (!Number.isSafeInteger(Number(current)) || Number(current) <= 0) return () => {}; // (a local copy: nothing to check)
  let waiting = null;
  let checking = false;

  function apply() {
    if (waiting === null || !safe()) return;
    try {
      if (sessionStorage.getItem('hawker-rush-updating') === String(waiting)) return; // (tried already: never loop)
      sessionStorage.setItem('hawker-rush-updating', String(waiting));
    } catch {
      return; // (no way to guard against a loop: leave it to the next visit)
    }
    location.replace(updateUrl(location.href, waiting));
  }

  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const url = new URL('./version.json', location.href);
      url.searchParams.set('check', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (response.ok) waiting = newerBuild(current, await response.json()) ?? waiting;
    } catch {
      // (offline or slow: keep playing this copy)
    } finally {
      checking = false;
    }
    apply();
  }

  document.addEventListener('visibilitychange', check);
  setInterval(check, 5 * 60 * 1000);
  void check();
  return apply; // (call when the player gets back to a safe place, e.g. the home page)
}
