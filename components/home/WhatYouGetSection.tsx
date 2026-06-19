import { Code2, Layout, Link2, Lock, Share2, Sparkles } from "lucide-react";

/**
 * "What you get" feature grid. Server component — no client interactivity needed.
 */
export function WhatYouGetSection() {
  const features = [
    { icon: Link2, title: "Custom URL", desc: "Your own clickfolio.me/@handle" },
    { icon: Layout, title: "10 themes", desc: "From minimal to bold, all responsive" },
    { icon: Lock, title: "Privacy controls", desc: "Hide phone, email, or address" },
    { icon: Share2, title: "Share anywhere", desc: "One link for LinkedIn, X, or email" },
    { icon: Code2, title: "Open source", desc: "Transparent code, no lock-in" },
    { icon: Sparkles, title: "Free forever", desc: "No trials, no credit card" },
  ];

  return (
    <section className="mt-20 lg:mt-28">
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">What you get</h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Everything you need to turn a PDF into a portfolio that feels like yours.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border-strong"
          >
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand">
              <Icon className="size-5" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
