import { Input, Label, Switch } from "@clickfolio/ui";

export const WithInput = () => (
  <div className="flex flex-col gap-2 max-w-sm">
    <Label htmlFor="location">Location</Label>
    <Input id="location" defaultValue="Brooklyn, NY" />
  </div>
);

export const WithSwitch = () => (
  <div className="flex flex-col gap-4 max-w-sm">
    <div className="flex items-center gap-3">
      <Switch id="show-phone" defaultChecked />
      <Label htmlFor="show-phone">Show phone number</Label>
    </div>
    <div className="flex items-center gap-3">
      <Switch id="show-address" disabled />
      <Label htmlFor="show-address">Show full address (disabled)</Label>
    </div>
  </div>
);
