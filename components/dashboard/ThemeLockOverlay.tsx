import { Lock } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export function ThemeLockOverlay({
  requiredReferrals,
  className,
}: {
  requiredReferrals: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 bg-foreground/40 flex flex-col items-center justify-center",
        className,
      )}
    >
      <Lock className="w-5 h-5 text-background mb-1" aria-hidden="true" />
      <span className="text-[10px] text-background font-semibold">
        {requiredReferrals} referrals
      </span>
    </div>
  );
}
