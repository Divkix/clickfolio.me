import { Button, LinkedInIcon } from "@clickfolio/ui";

export const Sizes = () => (
  <div className="flex items-end gap-6">
    <LinkedInIcon size={16} title="LinkedIn" />
    <LinkedInIcon size={24} title="LinkedIn" />
    <LinkedInIcon size={32} title="LinkedIn" />
    <LinkedInIcon size={48} title="LinkedIn" />
  </div>
);

export const WhiteVariant = () => (
  <div className="flex items-end gap-6 rounded-xl bg-foreground p-6">
    <LinkedInIcon variant="white" size={24} title="LinkedIn" />
    <LinkedInIcon variant="white" size={32} title="LinkedIn" />
    <LinkedInIcon variant="white" size={48} title="LinkedIn" />
  </div>
);

export const SocialLink = () => (
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon" aria-label="Jane Doe on LinkedIn">
      <LinkedInIcon size={20} />
    </Button>
    <Button variant="outline">
      <LinkedInIcon size={16} /> Connect on LinkedIn
    </Button>
  </div>
);
