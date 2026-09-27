import { ShareBar } from "@clickfolio/ui";

const props = {
  url: "https://clickfolio.me/@janedoe",
  handle: "janedoe",
  title: "Jane Doe - Senior Product Designer",
  name: "Jane Doe",
};

export const MinimalistEditorial = () => (
  <div className="p-6 bg-background">
    <ShareBar {...props} variant="minimalist-editorial" />
  </div>
);

export const NeoBrutalist = () => (
  <div className="p-6" style={{ background: "#FFF4D6" }}>
    <ShareBar {...props} variant="neo-brutalist" />
  </div>
);

export const Midnight = () => (
  <div className="p-6" style={{ background: "#0B1026" }}>
    <ShareBar {...props} variant="midnight" />
  </div>
);

export const DevTerminal = () => (
  <div className="p-6" style={{ background: "#22272e" }}>
    <ShareBar {...props} variant="dev-terminal" />
  </div>
);
