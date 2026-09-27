import { Button, DribbbleIcon } from "@clickfolio/ui";

export const Sizes = () => (
  <div className="flex items-end gap-6 text-foreground">
    <DribbbleIcon size={16} />
    <DribbbleIcon size={24} />
    <DribbbleIcon size={32} />
    <DribbbleIcon size={48} />
  </div>
);

export const Tinted = () => (
  <div className="flex items-end gap-6">
    <span className="text-brand"><DribbbleIcon size={32} /></span>
    <span className="text-muted-foreground"><DribbbleIcon size={32} /></span>
    <span className="rounded-lg bg-foreground p-2 text-background"><DribbbleIcon size={32} /></span>
  </div>
);

export const SocialLink = () => (
  <div className="flex items-center gap-2 text-foreground">
    <Button variant="ghost" size="icon" aria-label="Jane Doe on Dribbble">
      <DribbbleIcon size={20} />
    </Button>
    <Button variant="outline">
      <DribbbleIcon size={16} /> Dribbble
    </Button>
  </div>
);
