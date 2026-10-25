import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { saveDesiredHandle } from "@/lib/utils/desired-handle";
import { trackEvent, type CheckedHandleStatus } from "@/lib/telemetry/browser";
import { handleSchema } from "@/lib/schemas/profile";
import { previewSrcSet } from "@/lib/templates/theme-ids";
import { UploadCTA } from "./UploadCTA";

interface PreviewTheme {
  id: string;
  name: string;
  preview: string;
  person: string;
  handle: string;
}

const CYCLE_MS = 3200;

type HandleStatus = "idle" | "invalid" | "checking" | CheckedHandleStatus;

function useHandleStatus(handle: string): HandleStatus {
  const [checked, setChecked] = useState<{ handle: string; status: HandleStatus } | null>(null);
  const valid = handle !== "" && handleSchema.safeParse(handle).success;

  useEffect(() => {
    if (!valid) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      let status: CheckedHandleStatus = "unknown";

      try {
        const response = await fetch(`/api/handle/check?handle=${encodeURIComponent(handle)}`, {
          signal: controller.signal,
        });

        if (response.ok) {
          // SAFETY: 2xx bodies from /api/handle/check are `{available, reason?}` (see its route).
          const data = (await response.json()) as { available: boolean };
          status = data.available ? "available" : "taken";
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      if (controller.signal.aborted) return;

      setChecked({ handle, status });
      trackEvent("landing_handle_checked", { status });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [handle, valid]);

  if (!handle) return "idle";

  if (!valid) return "invalid";

  return checked?.handle === handle ? checked.status : "checking";
}

export function HandlePreview({ themes }: { themes: PreviewTheme[] }) {
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const [handle, setHandle] = useState("");
  const status = useHandleStatus(handle);
  const selected = themes[index];

  useEffect(() => {
    if (touched || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % themes.length),
      CYCLE_MS,
    );

    return () => window.clearInterval(timer);
  }, [touched, themes.length]);

  return (
    <div onPointerEnter={() => setTouched(true)} onFocusCapture={() => setTouched(true)}>
      <figure className="overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-[0_40px_90px_-35px_rgba(42,63,209,0.45)]">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
          </span>
          <label className="flex min-w-0 flex-1 items-center rounded-md bg-surface-2 px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand">
            <span className="text-muted-foreground">clickfolio.me/@</span>
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/\s/g, ""))}
              placeholder={selected.handle}
              aria-label="Try your handle"
              aria-describedby="studio-handle-status"
              maxLength={30}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full min-w-0 bg-transparent font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <span aria-hidden="true">
              {status === "checking" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {status === "available" && <Check className="size-4 text-success" />}
              {(status === "taken" || status === "invalid") && (
                <X className="size-4 text-destructive" />
              )}
            </span>
          </label>
        </div>
        <img
          src={selected.preview}
          srcSet={previewSrcSet(selected.preview)}
          sizes="(min-width: 1280px) 692px, (min-width: 1024px) 54vw, 100vw"
          alt={`${selected.person}'s site in the ${selected.name} design`}
          fetchPriority="high"
          className="aspect-16/10 w-full object-cover object-top"
        />
      </figure>

      <div className="mt-4 flex min-h-6 items-center justify-between gap-4 text-sm">
        <p id="studio-handle-status" aria-live="polite">
          {status === "checking" && <span className="text-muted-foreground">Checking…</span>}
          {status === "available" && (
            <span className="font-medium text-success">
              @{handle} is free.{" "}
              <UploadCTA
                location="hero_claim"
                onBeforeOpen={() => saveDesiredHandle(handle)}
                className="font-semibold text-brand underline underline-offset-4"
              >
                Claim it
              </UploadCTA>
            </span>
          )}
          {status === "taken" && (
            <span className="text-destructive">Already taken. Try another.</span>
          )}
          {status === "invalid" && (
            <span className="text-destructive">
              {handleSchema.safeParse(handle).error?.issues[0]?.message}
            </span>
          )}
          {status === "unknown" && (
            <span className="text-muted-foreground">You’ll confirm it after upload.</span>
          )}
        </p>
        <div className="flex shrink-0">
          {themes.map((theme, i) => (
            <button
              key={theme.id}
              type="button"
              aria-label={`Show the ${theme.name} design`}
              aria-pressed={i === index}
              onClick={() => {
                setTouched(true);
                setIndex(i);
              }}
              className="group flex size-6 items-center justify-center"
            >
              <span
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-foreground"
                    : "w-1.5 bg-border-strong group-hover:bg-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
