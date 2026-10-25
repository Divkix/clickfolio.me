import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Server-renders `element` inside a bare router, so each `<Link>` renders its real href.
 * `trailingSlash` matches app/router.tsx: hrefs keep a `to` string's trailing slash.
 */
export function renderWithRouter(element: ReactElement): string {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
    trailingSlash: "preserve",
  });

  return renderToStaticMarkup(
    <RouterContextProvider router={router}>{element}</RouterContextProvider>,
  );
}
