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
    className: "bg-muted text-muted-foreground",
  },
  failed: {
    label: "Failed",
    className: "bg-coral/20 text-coral",
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
