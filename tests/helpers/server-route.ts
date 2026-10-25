import type { AnyRoute } from "@tanstack/react-router";
import type { RouteMethodHandlerCtx } from "@tanstack/react-start";

type HandlerContext = RouteMethodHandlerCtx<
  {},
  AnyRoute,
  string,
  Record<string, string>,
  undefined,
  undefined
>;

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export function serverHandler(route: AnyRoute, method: Method) {
  return async (request: Request, params: Record<string, string> = {}): Promise<Response> => {
    // SAFETY: These tests exercise function handlers without route middleware; the adapter supplies the complete server context.
    const handler = route.options.server?.handlers?.[method] as
      | ((context: HandlerContext) => Response | undefined | Promise<Response | undefined>)
      | undefined;

    if (!handler) throw new Error(`Missing ${method} server handler`);

    const result = await handler({
      request,
      params,
      pathname: new URL(request.url).pathname,
      context: undefined,
      next: () => {
        throw new Error("Route handlers under test never call next()");
      },
    });

    if (!result) throw new Error(`${method} handler did not return a Response`);

    return result;
  };
}
