import { useEffect, useRef } from "react";
import { LinkedInExportHelp } from "@clickfolio/ui";

// LinkedInExportHelp owns its Dialog state (no open prop): click the trigger on mount.
export const Open = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.click();
  }, []);
  return (
    <div ref={ref} className="p-6">
      <LinkedInExportHelp />
    </div>
  );
};

export const Trigger = () => (
  <div className="p-6">
    <LinkedInExportHelp />
  </div>
);
