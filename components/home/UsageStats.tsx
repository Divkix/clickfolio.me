export function UsageStats() {
  const stats = [
    { stat: "~30s", label: "Setup", desc: "Average time from upload to live portfolio" },
    { stat: "10", label: "Templates", desc: "Professionally designed, mobile-responsive themes" },
    { stat: "$0", label: "Forever", desc: "No trials, no credit card, no time limits" },
    { stat: "MIT", label: "Open source", desc: "Transparent code you can inspect on GitHub" },
  ];

  return (
    <section className="mt-20 lg:mt-28">
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">By the numbers</h2>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="font-display text-3xl font-bold tracking-tight text-brand sm:text-4xl">
              {item.stat}
            </div>
            <div className="mt-1 text-sm font-medium">{item.label}</div>
            <p className="mt-2 text-sm leading-snug text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
