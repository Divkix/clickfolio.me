import { Badge } from "@clickfolio/ui";
import { Check, Clock, Sparkles, X } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Default</Badge>
    <Badge variant="brand">Brand</Badge>
    <Badge variant="outline">Outline</Badge>
    <Badge variant="success">Success</Badge>
    <Badge variant="warning">Warning</Badge>
    <Badge variant="info">Info</Badge>
    <Badge variant="destructive">Destructive</Badge>
  </div>
);

export const ResumeStatuses = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="success">
      <Check /> Completed
    </Badge>
    <Badge variant="info">
      <Clock /> Processing
    </Badge>
    <Badge variant="warning">Queued</Badge>
    <Badge variant="destructive">
      <X /> Failed
    </Badge>
  </div>
);

export const Tags = () => (
  <div className="flex flex-wrap items-center gap-2 max-w-sm">
    <Badge variant="brand">
      <Sparkles /> Open to work
    </Badge>
    <Badge variant="outline">Figma</Badge>
    <Badge variant="outline">Design systems</Badge>
    <Badge variant="outline">User research</Badge>
    <Badge>Senior</Badge>
  </div>
);
