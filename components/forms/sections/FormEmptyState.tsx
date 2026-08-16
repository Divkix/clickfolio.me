import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormEmptyState({
  icon: Icon,
  title,
  description,
  onAdd,
  addLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="text-center py-8 px-4 bg-surface-2 rounded-xl border border-dashed border-border">
      <div className="inline-flex mb-4 bg-brand-subtle p-4 rounded-xl">
        <Icon className="h-8 w-8 text-brand" />
      </div>
      <p className="text-foreground font-medium mb-1">{title}</p>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <Button type="button" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        {addLabel}
      </Button>
    </div>
  );
}
