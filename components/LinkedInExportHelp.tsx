"use client";

import { ExternalLink, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// linkedin.com/in/me redirects a signed-in member to their own profile.
const OWN_PROFILE_URL = "https://www.linkedin.com/in/me/";

const STEPS = [
  "Open your LinkedIn profile on a computer.",
  "Click the “More” (or “Resources”) button under your name.",
  "Choose “Save to PDF”, then drop the downloaded Profile.pdf here.",
];

export function LinkedInExportHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mx-auto flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          No resume? <span className="ml-1 font-medium text-brand">Use your LinkedIn profile</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use your LinkedIn profile</DialogTitle>
          <DialogDescription>
            LinkedIn can export your profile as a PDF. Upload it here and we&apos;ll build your
            portfolio from it.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-active">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <Monitor className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            &ldquo;Save to PDF&rdquo; is only on the desktop site, not the LinkedIn app. LinkedIn
            only exports your top skills and no projects, so you can add those after importing.
          </span>
        </p>

        <Button asChild variant="outline">
          <a href={OWN_PROFILE_URL} target="_blank" rel="noopener noreferrer">
            Open my LinkedIn profile
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
