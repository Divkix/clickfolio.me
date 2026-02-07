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
    className: "bg-coral/20 text-coral",
  },
  pending_claim: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
  failed: {
    label: "Failed",
    className: "bg-coral/20 text-coral",
  },
};

export function ResumeStatusBadge({ status }: ResumeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
