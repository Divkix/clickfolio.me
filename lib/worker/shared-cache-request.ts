/**
 * Public profile pages (`/@handle`, its `.md` twin and RSC payloads) are served
 * from the shared Workers Cache, so every visitor must get the same render.
 *
 * Their server render never reads the session (the owner UI is client-side),
 * and vinext keeps any render that reads cookies or headers out of the shared
 * cache. Dropping credentials before the app sees the request makes that hold
 * by construction: a signed-in request renders exactly what an anonymous one
 * does, so whatever it stores is safe to serve to anyone.
 */

const PUBLIC_PROFILE_PATH = /^\/(?:@|%40)/i;

const ENCODED_PROFILE_PATH = /^\/%40/i;

const CREDENTIAL_HEADERS = ["cookie", "authorization"] as const;

export function isPublicProfilePath(pathname: string): boolean {
  return PUBLIC_PROFILE_PATH.test(pathname);
}

/**
 * `/%40alice` renders the same page as `/@alice` but would be cached under its
 * own key and Cache-Tag, out of reach of `revalidatePath("/@alice")`. Send it
 * to the one URL that purges reach.
 */
export function encodedProfileRedirect(url: URL): Response | null {
  if (!ENCODED_PROFILE_PATH.test(url.pathname)) return null;

  const target = new URL(url);
  target.pathname = url.pathname.replace(ENCODED_PROFILE_PATH, "/@");

  return Response.redirect(target.toString(), 308);
}

/** The request without cookies or Authorization when it reads a public profile page. */
export function withoutProfileCredentials(request: Request, pathname: string): Request {
  if (request.method !== "GET" && request.method !== "HEAD") return request;

  if (!isPublicProfilePath(pathname)) return request;

  if (!CREDENTIAL_HEADERS.some((name) => request.headers.has(name))) return request;

  const headers = new Headers(request.headers);

  for (const name of CREDENTIAL_HEADERS) headers.delete(name);

  return new Request(request, { headers });
}
