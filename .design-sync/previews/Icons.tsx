import { Button, Icons } from "@clickfolio/ui";

const names = Object.keys(Icons).sort() as (keyof typeof Icons)[];

export const Catalog = () => (
  <div className="grid grid-cols-6 gap-2 max-w-3xl">
    {names.map((name) => {
      const Icon = Icons[name] as React.ComponentType<{ className?: string }>;
      return (
        <div
          key={name}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-3"
        >
          <Icon className="size-5 text-foreground" />
          <span className="text-[10px] text-muted-foreground truncate max-w-full">{name}</span>
        </div>
      );
    })}
  </div>
);

export const InContext = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button>
      <Icons.Upload /> Upload resume
    </Button>
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icons.MapPin className="size-4" /> Phoenix, AZ
    </span>
    <span className="inline-flex items-center gap-1.5 text-sm text-success">
      <Icons.CheckCircle2 className="size-4" /> Published
    </span>
    <Icons.Sparkles className="size-6 text-brand" />
  </div>
);
