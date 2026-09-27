import { Label, Textarea } from "@clickfolio/ui";

export const Labelled = () => (
  <div className="flex flex-col gap-2 max-w-md">
    <Label htmlFor="summary">Summary</Label>
    <Textarea
      id="summary"
      rows={4}
      defaultValue="Product designer with 8 years of experience building design systems and shipping B2B tools at Linear and Stripe."
    />
  </div>
);

export const States = () => (
  <div className="flex flex-col gap-4 max-w-md">
    <div className="flex flex-col gap-2">
      <Label htmlFor="bio">Bio</Label>
      <Textarea id="bio" placeholder="Tell visitors what you do and what you're looking for." />
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="desc">Role description</Label>
      <Textarea id="desc" aria-invalid defaultValue="" placeholder="Describe your impact" />
      <p className="text-xs text-destructive">Description is required.</p>
    </div>
    <div className="flex flex-col gap-2">
      <Label htmlFor="locked">Imported summary</Label>
      <Textarea id="locked" disabled defaultValue="Imported from LinkedIn." />
    </div>
  </div>
);
