import { ResumeStatusBadge } from "@clickfolio/ui";

const STATUSES = [
  "pending_claim",
  "queued",
  "processing",
  "waiting_for_cache",
  "completed",
  "failed",
];

export const AllStatuses = () => (
  <div className="grid grid-cols-2 gap-3" style={{ width: 360 }}>
    {STATUSES.map((s) => (
      <div key={s} className="flex items-center justify-between gap-4">
        <code className="font-mono text-xs text-muted-foreground">{s}</code>
        <ResumeStatusBadge status={s} />
      </div>
    ))}
  </div>
);

export const Completed = () => <ResumeStatusBadge status="completed" />;

export const Processing = () => <ResumeStatusBadge status="processing" />;

export const Failed = () => <ResumeStatusBadge status="failed" />;
