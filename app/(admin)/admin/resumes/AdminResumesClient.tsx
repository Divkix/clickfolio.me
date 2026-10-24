"use client";

import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/admin/Pagination";
import { ResumeStatusBadge } from "@/components/admin/ResumeStatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { formatRelativeTime } from "@/lib/utils/format";
import { RETRY_LIMITS } from "@/lib/resume/lifecycle";

import type { AdminResumesData, AdminResumeStatus } from "@/lib/data/admin-resumes";

type StatusFilter = AdminResumeStatus;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
];

export default function AdminResumesClient({
  data,
  statusFilter,
}: {
  data: AdminResumesData;
  statusFilter: StatusFilter;
}) {
  const router = useRouter();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const page = data.page;

  const updateParams = (updates: { status?: StatusFilter; page?: number }) => {
    const params = new URLSearchParams({ status: statusFilter, page: page.toString() });

    if (updates.status !== undefined) {
      params.set("status", updates.status);
      params.set("page", "1");
    }

    if (updates.page !== undefined) {
      params.set("page", updates.page.toString());
    }

    router.push(`/admin/resumes?${params}`);
  };

  const handleDismiss = async (id: string) => {
    if (dismissingId) return;
    setDismissingId(id);

    try {
      const res = await fetch(`/api/admin/resumes/${id}`, { method: "DELETE" });

      if (!res.ok) throw new Error(await res.text());
      router.refresh();
      toast.success("Failed resume dismissed");
    } catch (error) {
      log("error", "Failed to dismiss resume:", { ...errorFields(error) });
      toast.error("Failed to dismiss resume. Please try again.");
    } finally {
      setDismissingId(null);
    }
  };

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => updateParams({ status: "completed" })}
          className="text-left"
        >
          <StatCard
            title="Completed"
            value={data.stats.completed}
            icon={CheckCircle2}
            iconColorClass="text-success"
            iconBgClass="bg-success/10"
          />
        </button>
        <button
          type="button"
          onClick={() => updateParams({ status: "processing" })}
          className="text-left"
        >
          <StatCard
            title="Processing"
            value={data.stats.processing}
            icon={Loader2}
            iconColorClass="text-warning"
            iconBgClass="bg-warning/10"
          />
        </button>
        <button
          type="button"
          onClick={() => updateParams({ status: "queued" })}
          className="text-left"
        >
          <StatCard
            title="Queued"
            value={data.stats.queued}
            icon={Clock}
            iconColorClass="text-info"
            iconBgClass="bg-info/10"
          />
        </button>
        <button
          type="button"
          onClick={() => updateParams({ status: "failed" })}
          className="text-left"
        >
          <StatCard
            title="Failed"
            value={data.stats.failed}
            icon={AlertTriangle}
            iconColorClass="text-destructive"
            iconBgClass="bg-destructive/10"
          />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        <select
          value={statusFilter}
          onChange={(e) => {
            // SAFETY: e.target.value is validated against STATUS_OPTIONS; cast narrows to StatusFilter.
            updateParams({ status: e.target.value as StatusFilter });
          }}
          className="text-sm bg-card text-foreground border border-border-strong rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{data.total.toLocaleString()} resumes</span>
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
                  Status
                </th>
                <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Attempts
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Error
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  Updated
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.resumes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No resumes found
                  </td>
                </tr>
              ) : (
                data.resumes.map((resume) => (
                  <Fragment key={resume.id}>
                    <tr
                      key={resume.id}
                      className={`hover:bg-muted/50 transition-colors ${
                        resume.status === "failed" ? "bg-destructive/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-foreground">{resume.userEmail}</td>
                      <td className="px-4 py-3">
                        <ResumeStatusBadge status={resume.status} />
                      </td>
                      <td
                        className="px-4 py-3 text-center text-sm text-muted-foreground"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {resume.retryCount}/{RETRY_LIMITS.MANUAL_MAX_RETRIES}
                      </td>
                      <td className="px-4 py-3">
                        {resume.lastAttemptError ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRow(expandedRow === resume.id ? null : resume.id)
                            }
                            className="text-sm text-destructive hover:underline truncate max-w-[200px] block text-left"
                            title="Click to expand"
                          >
                            {resume.lastAttemptError.slice(0, 50)}
                            {resume.lastAttemptError.length > 50 ? "..." : ""}
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground/70">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {formatRelativeTime(resume.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {resume.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => void handleDismiss(resume.id)}
                            disabled={dismissingId === resume.id}
                            aria-label="Dismiss failed resume"
                            title="Dismiss failed resume"
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === resume.id && resume.lastAttemptError && (
                      // eslint-disable-next-line jsx-a11y/control-has-associated-label -- false positive: <tr> is not an interactive control
                      <tr key={`${resume.id}-error`}>
                        <td colSpan={6} className="px-4 py-3 bg-destructive/10">
                          <pre className="text-xs text-destructive font-mono whitespace-pre-wrap wrap-break-word">
                            {resume.lastAttemptError}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3">
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
