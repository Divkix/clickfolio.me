import { Button, GitHubIcon } from "@clickfolio/ui";

export const Sizes = () => (
  <div className="flex items-end gap-6">
    <GitHubIcon size={16} title="GitHub" />
    <GitHubIcon size={24} title="GitHub" />
    <GitHubIcon size={32} title="GitHub" />
    <GitHubIcon size={48} title="GitHub" />
  </div>
);

export const WhiteVariant = () => (
  <div className="flex items-end gap-6 rounded-xl bg-foreground p-6">
    <GitHubIcon variant="white" size={24} title="GitHub" />
    <GitHubIcon variant="white" size={32} title="GitHub" />
    <GitHubIcon variant="white" size={48} title="GitHub" />
  </div>
);

export const SocialLink = () => (
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="icon" aria-label="Jane Doe on GitHub">
      <GitHubIcon size={20} />
    </Button>
    <Button variant="outline">
      <GitHubIcon size={16} /> Connect on GitHub
    </Button>
  </div>
);
