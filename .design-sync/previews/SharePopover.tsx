import { useEffect, useRef } from "react";
import { SharePopover } from "@clickfolio/ui";

// SharePopover owns its open state (no `open` prop): click the trigger on mount.
// transform makes the wrapper the containing block for the component's `fixed` root.
function OpenOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.click();
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", height: 440, transform: "translateZ(0)" }}>
      {children}
    </div>
  );
}

export const OpenMinimalist = () => (
  <OpenOnMount>
    <SharePopover
      variant="minimalist-editorial"
      url="https://clickfolio.me/@janedoe"
      handle="janedoe"
      title="Jane Doe - Senior Product Designer"
      name="Jane Doe"
    />
  </OpenOnMount>
);

export const OpenNeoBrutalist = () => (
  <OpenOnMount>
    <SharePopover
      variant="neo-brutalist"
      url="https://clickfolio.me/@marcuschen"
      handle="marcuschen"
      title="Marcus Chen - Staff Software Engineer"
      name="Marcus Chen"
    />
  </OpenOnMount>
);

export const Closed = () => (
  <div style={{ position: "relative", height: 440, transform: "translateZ(0)" }}>
    <SharePopover
      variant="midnight"
      url="https://clickfolio.me/@priyapatel"
      handle="priyapatel"
      title="Priya Patel - Data Scientist"
      name="Priya Patel"
    />
  </div>
);
