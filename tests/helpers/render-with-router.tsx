import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Server-renders `element` inside a bare router, so each `<Link>` renders its real href. */
export function renderWithRouter(element: ReactElement): string {
  const router = createRouter({ routeTree: createRootRoute(), history: createMemoryHistory() });

  return renderToStaticMarkup(
    <RouterContextProvider router={router}>{element}</RouterContextProvider>,
  );
}
