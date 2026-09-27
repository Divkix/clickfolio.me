import { Button, WhatsAppIcon } from "@clickfolio/ui";

export const Sizes = () => (
  <div className="flex items-end gap-6 text-foreground">
    <WhatsAppIcon className="size-4" />
    <WhatsAppIcon className="size-6" />
    <WhatsAppIcon className="size-8" />
    <WhatsAppIcon className="size-12" />
  </div>
);

export const Tinted = () => (
  <div className="flex items-end gap-6">
    <span className="text-brand"><WhatsAppIcon className="size-8" /></span>
    <span className="text-muted-foreground"><WhatsAppIcon className="size-8" /></span>
    <span className="rounded-lg bg-foreground p-2 text-background"><WhatsAppIcon className="size-8" /></span>
  </div>
);

export const SocialLink = () => (
  <div className="flex items-center gap-2 text-foreground">
    <Button variant="ghost" size="icon" aria-label="Jane Doe on WhatsApp">
      <WhatsAppIcon className="size-5" />
    </Button>
    <Button variant="outline">
      <WhatsAppIcon className="size-4" /> WhatsApp
    </Button>
  </div>
);
