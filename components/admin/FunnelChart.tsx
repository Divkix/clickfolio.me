interface FunnelStep {
  label: string;
  value: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

export function FunnelChart({ steps }: FunnelChartProps) {
  if (steps.length === 0) return null;

  const maxValue = Math.max(...steps.map((s) => s.value));

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const width = maxValue > 0 ? (step.value / maxValue) * 100 : 0;

        return (
          <div key={step.label} className="flex items-center gap-4">
            <span className="text-sm text-slate-600 w-20">{step.label}</span>
            <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF6B6B] rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                style={{ width: `${Math.max(width, 5)}%` }}
              >
                <span
                  className="text-sm font-medium text-white"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {step.value.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
