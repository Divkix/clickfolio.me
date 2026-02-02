"use client";

import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/admin/Pagination";
import { ResumeStatusBadge } from "@/components/admin/ResumeStatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ResumeData {
  id: string;
  userEmail: string;
  status: string;
  retryCount: number;
  totalAttempts: number;
  lastAttemptError: string | null;
  updatedAt: string;
}

interface ResumesResponse {
  stats: {
    completed: number;
    processing: number;
    queued: number;
    failed: number;
  };
  resumes: ResumeData[];
  total: number;
  page: number;
  pageSize: number;
}

type StatusFilter = "all" | "completed" | "processing" | "queued" | "failed";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
];

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function AdminResumesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ResumesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const statusFilter = (searchParams.get("status") as StatusFilter) || "all";
  const page = Number.parseInt(searchParams.get("page") || "1", 10);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
      });
      const res = await fetch(`/api/admin/resumes?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: ResumesResponse = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch resumes:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const updateParams = (updates: { status?: StatusFilter; page?: number }) => {
    const params = new URLSearchParams(searchParams);
    if (updates.status !== undefined) {
      params.set("status", updates.status);
      params.set("page", "1"); // Reset page on filter change
    }
    if (updates.page !== undefined) {
      params.set("page", updates.page.toString());
    }
    router.push(`/admin/resumes?${params}`);
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => updateParams({ status: "completed" })}
          className="text-left"
        >
          <StatCard
            title="Completed"
            value={data?.stats.completed ?? 0}
            icon={CheckCircle2}
            iconColorClass="text-emerald-600"
            iconBgClass="bg-gradient-to-r from-emerald-100 to-teal-100"
          />
        </button>
        <button
          type="button"
          onClick={() => updateParams({ status: "processing" })}
          className="text-left"
        >
          <StatCard
            title="Processing"
            value={data?.stats.processing ?? 0}
            icon={Loader2}
            iconColorClass="text-amber-600"
            iconBgClass="bg-gradient-to-r from-amber-100 to-orange-100"
          />
        </button>
        <button
          type="button"
          onClick={() => updateParams({ status: "queued" })}
          className="text-left"
        >
          <StatCard
            title="Queued"
            value={data?.stats.queued ?? 0}
            icon={Clock}
            iconColorClass="text-blue-600"
            iconBgClass="bg-gradient-to-r from-blue-100 to-indigo-100"
          />
        </button>
        <button
          type="button"
          onClick={() => updateParams({ status: "failed" })}
          className="text-left"
        >
          <StatCard
            title="Failed"
            value={data?.stats.failed ?? 0}
            icon={AlertTriangle}
            iconColorClass="text-red-600"
            iconBgClass="bg-gradient-to-r from-red-100 to-pink-100"
          />
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <FileText className="w-5 h-5 text-slate-400" aria-hidden="true" />
        <select
          value={statusFilter}
          onChange={(e) => updateParams({ status: e.target.value as StatusFilter })}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{data?.total.toLocaleString() ?? 0} resumes</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-depth-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  User
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Attempts
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Error
                </th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-40" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-12 mx-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : !data || data.resumes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No resumes found
                  </td>
                </tr>
              ) : (
                data.resumes.map((resume) => (
                  <>
                    <tr
                      key={resume.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        resume.status === "failed" ? "bg-red-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-slate-900">{resume.userEmail}</td>
                      <td className="px-4 py-3">
                        <ResumeStatusBadge status={resume.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-center text-sm text-slate-600"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {resume.retryCount}/3
                      </td>
                      <td className="px-4 py-3">
                        {resume.lastAttemptError ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRow(expandedRow === resume.id ? null : resume.id)
                            }
                            className="text-sm text-red-600 hover:text-red-800 truncate max-w-[200px] block text-left"
                            title="Click to expand"
                          >
                            {resume.lastAttemptError.slice(0, 50)}
                            {resume.lastAttemptError.length > 50 ? "..." : ""}
                          </button>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500">
                        {formatRelativeTime(resume.updatedAt)}
                      </td>
                    </tr>
                    {expandedRow === resume.id && resume.lastAttemptError && (
                      <tr key={`${resume.id}-error`}>
                        <td colSpan={5} className="px-4 py-3 bg-red-50/50">
                          <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap break-words">
                            {resume.lastAttemptError}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200/60 px-4 py-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => updateParams({ page: p })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
