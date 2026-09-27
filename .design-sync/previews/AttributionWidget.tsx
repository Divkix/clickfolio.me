import { AttributionWidget } from "@clickfolio/ui";

// The widget is `fixed` bottom-right; transform makes each frame its containing block.
const Frame = ({ theme, bg }: { theme: string; bg: string }) => (
  <div
    style={{ position: "relative", height: 120, transform: "translateZ(0)", background: bg }}
    className="rounded-lg border border-border"
  >
    <AttributionWidget theme={theme} />
  </div>
);

export const Themes = () => (
  <div className="grid grid-cols-2 gap-4 p-4">
    <Frame theme="minimalist_editorial" bg="#FAFAF9" />
    <Frame theme="neo_brutalist" bg="#FFF4D6" />
    <Frame theme="midnight" bg="#0B1026" />
    <Frame theme="dev_terminal" bg="#22272e" />
  </div>
);

export const MinimalistEditorial = () => <Frame theme="minimalist_editorial" bg="#FAFAF9" />;

export const Glass = () => <Frame theme="glass" bg="#1E2A4A" />;
