import { UserStatusBadge } from "@clickfolio/ui";

export const AllStatuses = () => (
  <div className="flex items-center gap-3">
    <UserStatusBadge status="live" />
    <UserStatusBadge status="processing" />
    <UserStatusBadge status="no_resume" />
    <UserStatusBadge status="failed" />
  </div>
);

export const InUserRow = () => (
  <div
    className="bg-card rounded-xl border border-border shadow-sm divide-y divide-border"
    style={{ width: 480 }}
  >
    {(
      [
        ["Jane Doe", "@janedoe", "live"],
        ["Marcus Chen", "@marcuschen", "processing"],
        ["Priya Raman", "@priyaraman", "no_resume"],
        ["Tom Alvarez", "@tomalvarez", "failed"],
      ] as const
    ).map(([name, handle, status]) => (
      <div key={handle} className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{handle}</p>
        </div>
        <UserStatusBadge status={status} />
      </div>
    ))}
  </div>
);
