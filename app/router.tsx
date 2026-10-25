import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "@/components/errors/ErrorPage";
import { NotFoundPage } from "@/components/errors/NotFoundPage";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Keeps `/api/foo/` distinct from `/api/foo` instead of redirecting one to the other.
    trailingSlash: "preserve",
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    // An unmatched path renders the root 404. The default ("fuzzy") runs the loader of the
    // deepest partial match, so `/for/x` reached the bare-handle redirect.
    notFoundMode: "root",
  });
}
