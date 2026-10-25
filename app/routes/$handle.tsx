import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProfileNotFound } from "@/components/errors/ProfileNotFound";
import { bareHandleRedirect } from "@/lib/data/public-resume";

const resolveHandle = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => bareHandleRedirect(data));

export const Route = createFileRoute("/$handle")({
  loader: ({ params }) => resolveHandle({ data: params.handle }),
  notFoundComponent: ProfileNotFound,
});
