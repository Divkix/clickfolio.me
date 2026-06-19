import { Badge } from "@/components/ui/badge";

type Status = "live" | "processing" | "no_resume" | "failed";

interface UserStatusBadgeProps {
  status: Status;
}

type BadgeVariant = "success" | "warning" | "destructive" | "default";

const STATUS_CONFIG: Record<Status, { label: string; variant: BadgeVariant }> = {
  live: { label: "Live", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  no_resume: { label: "No Resume", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
