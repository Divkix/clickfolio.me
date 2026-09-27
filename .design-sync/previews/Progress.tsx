import { Progress } from "@clickfolio/ui";

export const Values = () => (
  <div className="flex flex-col gap-4 max-w-md">
    {[
      ["Claiming upload", 15],
      ["Queued", 25],
      ["Parsing resume", 50],
      ["Done", 100],
    ].map(([label, value]) => (
      <div key={label as string} className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span className="text-muted-foreground">{value}%</span>
        </div>
        <Progress value={value as number} />
      </div>
    ))}
  </div>
);

export const Parsing = () => (
  <div className="flex flex-col gap-2 max-w-md">
    <p className="text-sm font-medium">Reading jane-doe-resume.pdf…</p>
    <Progress value={50} />
    <p className="text-xs text-muted-foreground">This usually takes under 60 seconds.</p>
  </div>
);
