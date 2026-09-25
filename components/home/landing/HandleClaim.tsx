"use client";

import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isAnalyticsInitialized, trackAnalyticsEvent } from "@/lib/analytics/client";
import { saveDesiredHandle } from "@/lib/experiments/desired-handle";
import type { LandingVariant } from "@/lib/experiments/landing";
import { handleSchema } from "@/lib/schemas/profile";
import { UploadCTA } from "./UploadCTA";

type CheckStatus = "available" | "taken" | "reserved" | "unknown";

type Status = "idle" | "invalid" | "checking" | CheckStatus;

interface HandleCheckResponse {
  available: boolean;
  reason?: string;
}

const CHECK_DEBOUNCE_MS = 350;

function useHandleStatus(handle: string, variant: LandingVariant) {
  const [result, setResult] = useState<{ handle: string; status: CheckStatus } | null>(null);
  const parsed = handle ? handleSchema.safeParse(handle) : null;
  const valid = parsed?.success === true;

  useEffect(() => {
    if (!valid) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      let status: CheckStatus = "unknown";

      try {
        const response = await fetch(`/api/handle/check?handle=${encodeURIComponent(handle)}`, {
          signal: controller.signal,
        });

        if (response.ok) {
          // SAFETY: 2xx bodies from /api/handle/check are `{available, reason?}` (see its route).
          const data = (await response.json()) as HandleCheckResponse;

          if (data.available) status = "available";
          else status = data.reason === "reserved" ? "reserved" : "taken";
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      setResult({ handle, status });

      if (isAnalyticsInitialized()) {
        trackAnalyticsEvent("landing_handle_checked", { landing_variant: variant, status });
      }
    }, CHECK_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [handle, valid, variant]);

  let status: Status = "checking";

  if (!handle) status = "idle";
  else if (!valid) status = "invalid";
  else if (result?.handle === handle) status = result.status;

  const message = parsed && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  return { status, message };
}

export function HandleClaim({ variant }: { variant: LandingVariant }) {
  const [handle, setHandle] = useState("");
  const { status, message } = useHandleStatus(handle, variant);
  const canClaim = status === "available" || status === "unknown";
  const isError = status === "taken" || status === "reserved" || status === "invalid";

  let borderClass = "border-white/15 focus-within:border-brand/70";

  if (status === "available")
    borderClass = "border-success/60 shadow-[0_0_40px_-10px_var(--success)]";
  else if (isError) borderClass = "border-destructive/60";

  return (
    <div className="w-full max-w-2xl">
      <div
        className={`flex flex-col gap-2 rounded-2xl border bg-white/[0.04] p-2 backdrop-blur transition sm:flex-row sm:items-center ${borderClass}`}
      >
        <label className="flex flex-1 items-center pl-3 font-mono text-lg sm:text-xl">
          <span className="text-white/45">clickfolio.me/@</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="yourname"
            aria-label="Choose your handle"
            aria-describedby="handle-claim-status"
            maxLength={30}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent py-3 text-white outline-none placeholder:text-white/25"
          />
          <span className="pr-2" aria-hidden="true">
            {status === "checking" && <Loader2 className="size-5 animate-spin text-white/50" />}
            {status === "available" && <Check className="size-5 text-success" />}
            {isError && <X className="size-5 text-destructive" />}
          </span>
        </label>
        <UploadCTA
          variant={variant}
          location={canClaim ? "hero_claim" : "hero_get_started"}
          onBeforeOpen={() => {
            if (canClaim) saveDesiredHandle(handle);
          }}
          className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 font-semibold transition ${
            canClaim
              ? "bg-brand text-brand-foreground hover:bg-brand-hover"
              : "bg-white text-black hover:bg-white/90"
          }`}
        >
          {canClaim ? "Claim it" : "Get started"} <ArrowRight className="size-4" />
        </UploadCTA>
      </div>
      <p id="handle-claim-status" className="mt-3 min-h-5 pl-2 text-sm" aria-live="polite">
        {status === "idle" && (
          <span className="text-white/50">Good handles go fast. Check yours.</span>
        )}
        {status === "available" && (
          <span className="text-success">
            @{handle} is available — upload your resume to claim it.
          </span>
        )}
        {status === "taken" && (
          <span className="text-destructive">Already taken. Try another.</span>
        )}
        {status === "reserved" && <span className="text-destructive">That one’s reserved.</span>}
        {status === "invalid" && <span className="text-destructive">{message}</span>}
        {status === "unknown" && (
          <span className="text-white/50">
            Couldn’t check right now — you’ll confirm it after upload.
          </span>
        )}
      </p>
    </div>
  );
}
