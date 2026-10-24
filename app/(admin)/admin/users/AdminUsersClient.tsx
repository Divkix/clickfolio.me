"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pagination } from "@/components/admin/Pagination";
import { UserStatusBadge } from "@/components/admin/UserStatusBadge";
import { formatRelativeTime } from "@/lib/utils/format";

import type { AdminUsersData } from "@/lib/data/admin-users";

export default function AdminUsersClient({
  data,
  search,
}: {
  data: AdminUsersData;
  search: string;
}) {
  const router = useRouter();
  const { users, total, page, pageSize } = data;
  const [searchInput, setSearchInput] = useState(search);

  const navigate = (nextPage: number, nextSearch = search) => {
    const params = new URLSearchParams({ page: nextPage.toString() });

    if (nextSearch) params.set("search", nextSearch);
    router.push(`/admin/users?${params}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(1, searchInput.trim());
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">
            {total.toLocaleString()} total users
          </span>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, handle..."
            className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-card text-foreground border border-border-strong rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
            aria-label="Search users"
          />
        </form>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  User
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Handle
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {search ? "No users found matching your search" : "No users yet"}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- false positive: <td> is not an interactive control */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{user.name || "Unnamed"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.handle ? (
                        <Link
                          href={`/@${user.handle}`}
                          target="_blank"
                          className="text-sm font-mono text-brand hover:underline"
                        >
                          @{user.handle}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground/70">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <UserStatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                      {formatRelativeTime(user.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={navigate} />
          </div>
        )}
      </div>
    </div>
  );
}
