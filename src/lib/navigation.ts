export function privateRoutePath(id: string): string {
  return `/r/${encodeURIComponent(id)}`;
}

export function routeIdFromUrl(url: URL): string | null {
  const match = /^\/r\/([^/]+)\/?$/.exec(url.pathname);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  return url.pathname === "/workspace" ? url.searchParams.get("route") : null;
}
