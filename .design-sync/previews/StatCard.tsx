import { StatCard } from "@clickfolio/ui";
import { CheckCircle2, Clock, Eye, FileText, Loader2, Users, XCircle } from "lucide-react";

export const AdminOverview = () => (
  <div className="grid grid-cols-2 gap-4" style={{ width: 560 }}>
    <StatCard
      title="Total Users"
      value={12847}
      icon={Users}
      iconColorClass="text-brand"
      iconBgClass="bg-brand-subtle"
      change={12}
    />
    <StatCard
      title="Published Resumes"
      value={9312}
      icon={FileText}
      iconColorClass="text-muted-foreground"
      iconBgClass="bg-surface-2"
    />
    <StatCard
      title="Processing"
      value={14}
      icon={Loader2}
      iconColorClass="text-warning"
      iconBgClass="bg-warning/10"
      href="/admin/resumes?status=processing"
    />
    <StatCard
      title="Views Today"
      value={3406}
      icon={Eye}
      iconColorClass="text-muted-foreground"
      iconBgClass="bg-surface-2"
      change={-4}
    />
  </div>
);

export const ResumeStatuses = () => (
  <div className="grid grid-cols-4 gap-4" style={{ width: 820 }}>
    <StatCard
      title="Completed"
      value={9312}
      icon={CheckCircle2}
      iconColorClass="text-success"
      iconBgClass="bg-success/10"
    />
    <StatCard
      title="Processing"
      value={14}
      icon={Loader2}
      iconColorClass="text-warning"
      iconBgClass="bg-warning/10"
    />
    <StatCard
      title="Queued"
      value={6}
      icon={Clock}
      iconColorClass="text-info"
      iconBgClass="bg-info/10"
    />
    <StatCard
      title="Failed"
      value={41}
      icon={XCircle}
      iconColorClass="text-destructive"
      iconBgClass="bg-destructive/10"
    />
  </div>
);

export const WithPositiveChange = () => (
  <div style={{ width: 280 }}>
    <StatCard
      title="New Signups (7d)"
      value="1,204"
      icon={Users}
      iconColorClass="text-brand"
      iconBgClass="bg-brand-subtle"
      change={23}
    />
  </div>
);
