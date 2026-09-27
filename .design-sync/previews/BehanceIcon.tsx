import { Button, BehanceIcon } from "@clickfolio/ui";

export const Sizes = () => (
  <div className="flex items-end gap-6 text-foreground">
    <BehanceIcon size={16} />
    <BehanceIcon size={24} />
    <BehanceIcon size={32} />
    <BehanceIcon size={48} />
  </div>
);

export const Tinted = () => (
  <div className="flex items-end gap-6">
    <span className="text-brand"><BehanceIcon size={32} /></span>
    <span className="text-muted-foreground"><BehanceIcon size={32} /></span>
    <span className="rounded-lg bg-foreground p-2 text-background"><BehanceIcon size={32} /></span>
  </div>
);

export const SocialLink = () => (
  <div className="flex items-center gap-2 text-foreground">
    <Button variant="ghost" size="icon" aria-label="Jane Doe on Behance">
      <BehanceIcon size={20} />
    </Button>
    <Button variant="outline">
      <BehanceIcon size={16} /> Behance
    </Button>
  </div>
);
