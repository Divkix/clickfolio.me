import { Separator } from "@clickfolio/ui";

export const Horizontal = () => (
  <div className="max-w-sm">
    <p className="font-display text-lg font-semibold">Jane Doe</p>
    <p className="text-sm text-muted-foreground">Senior Product Designer · Brooklyn, NY</p>
    <Separator className="my-4" />
    <p className="text-sm text-muted-foreground">
      Building design systems at Linear. Previously Stripe and Shopify.
    </p>
  </div>
);

export const Vertical = () => (
  <div className="flex h-5 items-center gap-4 text-sm">
    <span>Portfolio</span>
    <Separator orientation="vertical" />
    <span>Blog</span>
    <Separator orientation="vertical" />
    <span>Contact</span>
  </div>
);
