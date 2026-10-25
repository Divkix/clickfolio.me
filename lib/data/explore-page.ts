import { notFound } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getDirectoryPage, toDirectoryUser } from "@/lib/data/indexable-profiles";
import type { ExploreSearch } from "@/lib/data/explore-search";
import { Db } from "@/lib/effect/db";
import { runPage } from "@/lib/effect/edges";
import { appLayer } from "@/lib/effect/layers";

const ITEMS_PER_PAGE = 12;

export async function explorePageData(search: ExploreSearch) {
  const { page: currentPage, role: roleFilter } = search;

  const { users, totalCount } = await runPage(
    Db.use((service) =>
      service.query("explore.page", (db) =>
        getDirectoryPage(db, { roleFilter, page: currentPage, pageSize: ITEMS_PER_PAGE }),
      ),
    ),
    appLayer(env),
  );

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (currentPage > 1 && currentPage > totalPages) throw notFound();

  return {
    currentPage,
    roleFilter,
    directoryUsers: users.map(toDirectoryUser),
    totalCount,
    totalPages,
  };
}
