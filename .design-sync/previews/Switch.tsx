import { Label, Switch } from "@clickfolio/ui";

export const PrivacySettings = () => (
  <div className="flex flex-col gap-4 max-w-sm">
    {[
      ["phone", "Show phone number", false],
      ["address", "Show address", false],
      ["directory", "Show in Explore directory", true],
      ["search", "Hide from search engines", false],
    ].map(([id, label, on]) => (
      <div key={id as string} className="flex items-center justify-between gap-4">
        <Label htmlFor={id as string}>{label}</Label>
        <Switch id={id as string} defaultChecked={on as boolean} />
      </div>
    ))}
  </div>
);

export const States = () => (
  <div className="flex items-center gap-4">
    <Switch aria-label="Off" />
    <Switch aria-label="On" defaultChecked />
    <Switch aria-label="Disabled off" disabled />
    <Switch aria-label="Disabled on" disabled defaultChecked />
  </div>
);
