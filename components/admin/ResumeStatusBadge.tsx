import { Badge } from "@/components/ui/badge";

type Status = string;

interface ResumeStatusBadgeProps {
  status: Status;
}

type BadgeVariant = "success" | "warning" | "info" | "destructive" | "default";

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  completed: { label: "Completed", variant: "success" },
  waiting_for_cache: { label: "Completed", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  queued: { label: "Queued", variant: "info" },
  pending_claim: { label: "Pending", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function ResumeStatusBadge({ status }: ResumeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, variant: "default" };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
