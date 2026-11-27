export function availableBuild(current, manifest) {
  const loaded = Number(current);
  const published = manifest?.build;
  return Number.isSafeInteger(loaded) && loaded > 0 &&
    Number.isSafeInteger(published) && published > loaded ? published : null;
}

export function reloadUrl(current, build) {
  const target = new URL(current);
  target.searchParams.set('v', String(build));
  return target.href;
}

export function watchForUpdates(button) {
  const current = document.querySelector('meta[name="rulereaper-build"]').content;
  if (!Number.isSafeInteger(Number(current)) || Number(current) <= 0) return;
  let newest = Number(current);
  let checking = false;

  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const url = new URL('./version.json', location.href);
      url.searchParams.set('check', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const build = availableBuild(newest, await response.json());
      if (build === null) return;
      newest = build;
      button.hidden = false;
    } catch {
      // Keep the current game playable when the update check is unavailable.
    } finally {
      checking = false;
    }
  }

  button.addEventListener('click', () => location.assign(reloadUrl(location.href, newest)));
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  setInterval(check, 30000);
  void check();
}
