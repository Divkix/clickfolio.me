import { Input, Label } from "@clickfolio/ui";

export const Labelled = () => (
  <div className="flex flex-col gap-4 max-w-sm">
    <div className="flex flex-col gap-2">
      <Label htmlFor="name">Full name</Label>
      <Input id="name" defaultValue="Jane Doe" />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="headline">Headline</Label>
      <Input id="headline" placeholder="Senior Product Designer" />
    </div>
  </div>
);

export const States = () => (
  <div className="flex flex-col gap-4 max-w-sm">
    <div className="flex flex-col gap-2">
      <Label htmlFor="handle-bad">Handle</Label>
      <Input id="handle-bad" defaultValue="admin" aria-invalid />
      <p className="text-xs text-destructive">This handle is reserved.</p>
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" defaultValue="jane@janedoe.design" disabled />
    </div>
  </div>
);
