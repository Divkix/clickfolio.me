import { Badge } from "@/components/ui/badge";

type Status = string;

interface ResumeStatusBadgeProps {
  status: Status;
}

type BadgeVariant = "success" | "warning" | "info" | "destructive" | "default";

const STATUS_CONFIG = {
  completed: { label: "Completed", variant: "success" },
  waiting_for_cache: { label: "Completed", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  queued: { label: "Queued", variant: "info" },
  pending_claim: { label: "Pending", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
} as const satisfies Record<string, { label: string; variant: BadgeVariant }>;

export function ResumeStatusBadge({ status }: ResumeStatusBadgeProps) {
  // SAFETY: status is a resume status string; STATUS_CONFIG covers known statuses with fallback to default.
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || {
    label: status,
    variant: "default" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
