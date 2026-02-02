type Status = string;

interface ResumeStatusBadgeProps {
  status: Status;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700",
  },
  waiting_for_cache: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-700",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-100 text-amber-700",
  },
  queued: {
    label: "Queued",
    className: "bg-blue-100 text-blue-700",
  },
  pending_claim: {
    label: "Pending",
    className: "bg-slate-100 text-slate-600",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
  },
};

export function ResumeStatusBadge({ status }: ResumeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
