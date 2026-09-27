import { useEffect } from "react";
import { CreateYoursCTA } from "@clickfolio/ui";

// CreateYoursCTA only appears after 3s or 30% scroll. Fake a deep scroll on mount
// (child effects register the listener before this parent effect runs).
function useRevealCta() {
  useEffect(() => {
    const body = document.body;
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => 5000 });
    Object.defineProperty(body, "scrollHeight", { configurable: true, get: () => 10000 });
    window.dispatchEvent(new Event("scroll"));
    delete (window as unknown as Record<string, unknown>).scrollY;
    delete (body as unknown as Record<string, unknown>).scrollHeight;
  }, []);
}

const Cta = (props: React.ComponentProps<typeof CreateYoursCTA>) => {
  useRevealCta();
  return (
    <div className="p-6">
      <div style={{ display: "inline-block" }}>
        <CreateYoursCTA {...props} />
      </div>
    </div>
  );
};

export const MinimalistEditorial = () => <Cta handle="janedoe" variant="minimalist_editorial" />;
export const NeoBrutalist = () => <Cta handle="marcuschen" variant="neo_brutalist" />;
export const Midnight = () => <Cta handle="priyapatel" variant="midnight" />;
export const RetroOS = () => <Cta handle="samrivera" variant="retro_os" />;
