import { Logo } from "@clickfolio/ui";

export const Sizes = () => (
  <div className="flex flex-wrap items-end gap-8">
    <Logo size="xs" />
    <Logo size="sm" />
    <Logo size="md" />
  </div>
);

export const OnDark = () => (
  <div className="dark rounded-xl bg-background p-6 text-foreground">
    <Logo size="md" />
  </div>
);

export const InHeaderBar = () => (
  <div className="flex max-w-2xl items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
    <Logo size="sm" />
    <span className="text-sm text-muted-foreground">clickfolio.me/@janedoe</span>
  </div>
);
