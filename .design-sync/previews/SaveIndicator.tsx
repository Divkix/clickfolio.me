import { SaveIndicator } from "@clickfolio/ui";

export const Statuses = () => (
  <div className="flex flex-col gap-3">
    <SaveIndicator status="saving" />
    <SaveIndicator status="saved" lastSaved={new Date()} />
    <SaveIndicator status="saved" lastSaved={new Date(Date.now() - 5 * 60 * 1000)} />
    <SaveIndicator status="unsaved" />
    <SaveIndicator status="error" />
  </div>
);

export const InEditorBar = () => (
  <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 max-w-lg">
    <span className="text-sm font-medium">Editing clickfolio.me/@janedoe</span>
    <SaveIndicator status="saved" lastSaved={new Date(Date.now() - 2 * 60 * 1000)} />
  </div>
);
