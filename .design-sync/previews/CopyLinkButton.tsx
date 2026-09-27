import { useEffect, useRef } from "react";
import { Card, CardContent, CopyLinkButton } from "@clickfolio/ui";

export const Default = () => (
  <div className="p-6">
    <CopyLinkButton handle="janedoe" />
  </div>
);

export const InDashboardCard = () => (
  <div className="p-6 max-w-md">
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Your portfolio is live</p>
          <p className="text-sm text-muted-foreground font-mono">clickfolio.me/@janedoe</p>
        </div>
        <CopyLinkButton handle="janedoe" />
      </CardContent>
    </Card>
  </div>
);

// Copied state: click once on mount.
export const Copied = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Headless clipboard is denied; stub it so the real success path runs.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    ref.current?.querySelector("button")?.click();
  }, []);
  return (
    <div ref={ref} className="p-6">
      <CopyLinkButton handle="janedoe" />
    </div>
  );
};
