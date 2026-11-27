export function legacyGameUrl(href) {
  const previous = new URL(href);
  const isChallenge = /^#v[12]=/.test(previous.hash);
  const isOldReload = /^[1-9]\d*$/.test(previous.searchParams.get('v') ?? '');
  if (!isChallenge && !isOldReload) return null;

  const game = new URL('./games/rulereaper/', previous);
  game.search = previous.search;
  game.hash = previous.hash;
  return game.href;
}

if (typeof location !== 'undefined') {
  const target = legacyGameUrl(location.href);
  if (target) location.replace(target);
}
