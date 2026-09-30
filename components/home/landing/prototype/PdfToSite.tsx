// PROTOTYPE (throwaway): drop_first's before→after proof, rebuilt on theme tokens
// so each variant recolours it. The flow bar is the one looping animation.

import { FileText } from "lucide-react";

export function PdfToSite({ label = "AI reads it in about 30 seconds" }: { label?: string }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1.6fr]">
      <div
        aria-hidden="true"
        className="mx-auto w-full max-w-xs -rotate-3 rounded-md border border-border bg-card p-5 shadow-md"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-4" /> sarah_chen_resume_FINAL_v3.pdf
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-2/3 rounded-sm bg-foreground/80" />
          <div className="h-2 w-1/2 rounded-sm bg-muted-foreground/40" />
          {[92, 70, 85, 64, 97, 76, 88, 61, 80].map((width) => (
            <div
              key={width}
              className="h-1.5 rounded-sm bg-muted-foreground/20"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Attached. Downloaded. Forgotten.</p>
      </div>

      <div className="flex flex-col items-center gap-2 text-brand" aria-hidden="true">
        <div className="relative h-1 w-24 overflow-hidden rounded-full bg-brand/20 max-lg:rotate-90 max-lg:my-8">
          <div className="animate-landing-flow absolute inset-y-0 w-1/2 rounded-full bg-brand" />
        </div>
        <span className="text-xs font-semibold whitespace-nowrap">{label}</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="ml-3 flex-1 truncate rounded-sm bg-background px-3 py-1 text-xs text-muted-foreground">
            clickfolio.me/<span className="text-foreground">@sarahchen</span>
          </span>
        </div>
        <img
          src="/previews/minimalist.webp"
          alt="Sarah Chen's portfolio in the Minimalist Editorial design"
          className="aspect-16/10 w-full object-cover object-top"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}
