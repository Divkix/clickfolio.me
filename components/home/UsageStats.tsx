export function UsageStats() {
  const stats = [
    {
      stat: "95%+",
      label: "Accuracy",
      desc: "AI parsing accuracy across 10,000+ resumes",
      color: "bg-mint",
    },
    {
      stat: "30s",
      label: "Seconds",
      desc: "Average time from upload to live portfolio",
      color: "bg-amber",
    },
    {
      stat: "10",
      label: "Templates",
      desc: "Professionally designed, mobile-responsive themes",
      color: "bg-coral",
    },
    {
      stat: "Free",
      label: "Forever",
      desc: "No trials, no credit card, no time limits",
      color: "bg-lavender",
    },
  ];

  return (
    <section className="mt-16 lg:mt-20">
      <div className="flex items-center gap-4 mb-8">
        <h2 className="font-black text-2xl sm:text-3xl text-ink">By the numbers</h2>
        <div className="flex-1 h-1 bg-ink" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((item, index) => (
          <div
            key={item.label}
            className={`
              ${item.color}
              border-3
              border-ink
              p-6
              shadow-brutal-md
              hover-brutal-shift
              animate-fade-in-up
            `}
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <div className="font-black text-3xl sm:text-4xl text-ink mb-1">{item.stat}</div>
            <div className="font-mono text-xs text-ink/80 uppercase tracking-wide mb-2">
              {item.label}
            </div>
            <p className="text-sm text-ink/70 leading-snug">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
