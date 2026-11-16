/** Redirect retired 2D ritual routes to the immersive Yuelao hall.
 * Preserve the locale prefix. Do not forward old free-text question (`q`) or
 * category parameters: the 3D hall owns its own fresh ritual session.
 */
export function legacyRitualDestination(url: URL): URL | null {
  const match = /^\/(?:(en|ja|ko|th)\/)?ritual\/?$/.exec(url.pathname);
  if (!match) return null;
  return new URL(`/${match[1] ? `${match[1]}/` : ''}market#yuelao`, url.origin);
}
