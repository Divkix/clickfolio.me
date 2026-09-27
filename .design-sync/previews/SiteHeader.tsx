import { SiteHeader } from "@clickfolio/ui";

export const SignedOut = () => (
  <div className="bg-background">
    <SiteHeader />
  </div>
);

export const OverPageContent = () => (
  <div className="bg-background">
    <SiteHeader />
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="font-display text-4xl font-bold text-foreground">
        Your resume, now a website
      </h1>
      <p className="mt-4 text-muted-foreground">
        Upload a PDF and get a shareable portfolio at clickfolio.me/@you in under a minute.
      </p>
    </div>
  </div>
);
