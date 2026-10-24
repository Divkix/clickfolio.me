import { log } from "@/lib/utils/log";
import { errorFields } from "@/lib/utils/error-fields";
import { env } from "cloudflare:workers";
import { Resvg } from "@cf-wasm/resvg/workerd";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import type { PgQueryable } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";
import { Db } from "@/lib/effect/db";
import { runRoute } from "@/lib/effect/edges";
import { retryLater, retryLaterResponse } from "@/lib/effect/retry-later";
import { normalizePreviewSkills } from "@/lib/utils/preview-skills";
import { escapeXml } from "@/lib/utils/xml";

// Social crawlers re-request an image that answered 5xx; a cached wrong card would stay for good.
const OG_RETRY_AFTER_SECONDS = 60;

const RESVG_OPTIONS = {
  fitTo: { mode: "width" as const, value: 1200 },
};

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <text x="600" y="280" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="800">
    <tspan fill="#FFF8F0">clickfolio</tspan><tspan fill="#D94E4E">.me</tspan>
  </text>
  <text x="600" y="360" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="500" fill="#F5C542">
    Portfolio not found
  </text>
</svg>`;

function renderLastResort(): Response {
  return new Response(FALLBACK_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}

type CardRow = Awaited<ReturnType<typeof loadCardRow>>[number];

function loadCardRow(db: PgQueryable, handle: string) {
  return db
    .select({
      name: user.name,
      handle: user.handle,
      previewName: siteData.previewName,
      previewHeadline: siteData.previewHeadline,
      previewSkills: siteData.previewSkills,
    })
    .from(user)
    .innerJoin(siteData, eq(user.id, siteData.userId))
    .where(eq(user.handle, handle))
    .limit(1);
}

/** Draws the card. A render fault propagates: `cardProgram` logs it and answers the 503. */
async function renderCard(row: CardRow, handle: string): Promise<Response> {
  const displayName = escapeXml(row.previewName || row.name || handle);
  const headline = row.previewHeadline ? escapeXml(row.previewHeadline) : "";

  const skills = normalizePreviewSkills(row.previewSkills)
    .slice(0, 4)
    .map((skill) => escapeXml(skill));

  let skillsSvg = "";

  if (skills.length > 0) {
    const startX = 80;
    let currentX = startX;
    const skillY = headline ? 380 : 340;
    const pillParts: string[] = [];

    for (const skill of skills) {
      const textWidth = skill.length * 13 + 32;
      pillParts.push(
        `<rect x="${currentX}" y="${skillY}" width="${textWidth}" height="36" rx="18" fill="#4ECDC4"/>`,
        `<text x="${currentX + textWidth / 2}" y="${skillY + 24}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#1a1a2e">${skill}</text>`,
      );
      currentX += textWidth + 12;
    }

    skillsSvg = pillParts.join("\n  ");
  }

  const headlineSvg = headline
    ? `<text x="80" y="320" font-family="system-ui,sans-serif" font-size="30" font-weight="500" fill="#F5C542">${headline}</text>`
    : "";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="avatarGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4ECDC4"/>
      <stop offset="100%" stop-color="#44B09E"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>

  <!-- Subtle accent line at top -->
  <rect x="0" y="0" width="1200" height="4" fill="#D94E4E"/>

  <!-- Avatar circle with initials -->
  <circle cx="130" cy="190" r="50" fill="url(#avatarGrad)"/>
  <text x="130" y="204" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">${escapeXml(initials)}</text>

  <!-- Name -->
  <text x="200" y="180" font-family="system-ui,sans-serif" font-size="48" font-weight="800" fill="#FFF8F0">${displayName}</text>

  <!-- Handle -->
  <text x="200" y="216" font-family="system-ui,sans-serif" font-size="22" fill="#FFF8F0" opacity="0.5">@${escapeXml(handle)}</text>

  <!-- Headline -->
  ${headlineSvg}

  <!-- Skills -->
  ${skillsSvg}

  <!-- Decorative line separator -->
  <rect x="80" y="520" width="1040" height="1" fill="#FFF8F0" opacity="0.1"/>

  <!-- Bottom branding -->
  <text x="80" y="570" font-family="system-ui,sans-serif" font-size="28" font-weight="700">
    <tspan fill="#FFF8F0">clickfolio</tspan><tspan fill="#D94E4E">.me</tspan>
  </text>
  <text x="1120" y="570" text-anchor="end" font-family="system-ui,sans-serif" font-size="18" fill="#FFF8F0" opacity="0.4">
    AI-powered portfolio
  </text>
</svg>`;

  const resvg = await Resvg.async(svg, RESVG_OPTIONS);
  const png = resvg.render();

  return new Response(new Uint8Array(png.asPng()), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

function cardProgram(handle: string, path: string) {
  const unavailable = retryLater(path, "Image temporarily unavailable", OG_RETRY_AFTER_SECONDS);

  return Db.use((service) => service.query("og.profile", (db) => loadCardRow(db, handle))).pipe(
    Effect.flatMap(([row]) => {
      // An unknown handle has no profile to render, so its fallback card is the right answer.
      if (!row) return Effect.succeed(renderLastResort());

      return Effect.promise(() => renderCard(row, handle)).pipe(
        // The profile exists: a cached "not found" card would outlive the render fault.
        Effect.catchDefect((defect) => {
          log("error", "OG image generation error:", { ...errorFields(defect) });

          return Effect.succeed(
            retryLaterResponse("Image temporarily unavailable", OG_RETRY_AFTER_SECONDS),
          );
        }),
      );
    }),
    Effect.catchTags({ DbFailed: unavailable, DbConflict: unavailable }),
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;

  let handle = "";

  try {
    handle = decodeURIComponent(rawHandle).replace(/^@/, "");
  } catch {
    handle = "";
  }

  if (!handle) {
    return renderLastResort();
  }

  return runRoute(
    request,
    cardProgram(handle, new URL(request.url).pathname),
    Db.layer(env.HYPERDRIVE),
  );
}
