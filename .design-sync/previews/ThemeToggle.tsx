import { Logo, ThemeToggle } from "@clickfolio/ui";

export const Default = () => <ThemeToggle />;

export const InHeader = () => (
  <div className="flex max-w-2xl items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
    <Logo size="sm" />
    <ThemeToggle />
  </div>
);

export const OnDarkSurface = () => (
  <div className="dark flex items-center gap-4 rounded-xl bg-background p-6 text-foreground">
    <span className="text-sm text-muted-foreground">Appearance</span>
    <ThemeToggle />
  </div>
);
