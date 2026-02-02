type Status = "live" | "processing" | "no_resume" | "failed";

interface UserStatusBadgeProps {
  status: Status;
}

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "bg-emerald-100 text-emerald-700",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-100 text-amber-700",
  },
  no_resume: {
    label: "No Resume",
    className: "bg-slate-100 text-slate-600",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700",
  },
};

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
