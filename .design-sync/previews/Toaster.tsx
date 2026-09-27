import { useEffect, useRef } from "react";
import { CopyLinkButton, Toaster } from "@clickfolio/ui";

// A preview-level `import { toast } from "sonner"` gets its own sonner copy (separate
// toast store from the one bundled in @clickfolio/ui), so toasts never reach <Toaster />.
// Fire real toasts through a bundled component instead: CopyLinkButton -> useCopyToClipboard.
function stubClipboard(ok: boolean) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => (ok ? Promise.resolve() : Promise.reject(new Error("denied"))) },
  });
}

function ToastFrom({ ok }: { ok: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stubClipboard(ok);
    ref.current?.querySelector("button")?.click();
  }, [ok]);
  return (
    <div className="p-6">
      {/* Hidden trigger: HTMLElement.click() still fires on display:none elements. */}
      <div ref={ref} style={{ display: "none" }}>
        <CopyLinkButton handle="janedoe" />
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

export const Success = () => <ToastFrom ok />;
export const ErrorToast = () => <ToastFrom ok={false} />;
