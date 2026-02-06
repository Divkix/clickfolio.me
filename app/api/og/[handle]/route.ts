import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteData, user } from "@/lib/db/schema";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderFallbackSvg(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1a1a2e"/>
  <text x="600" y="280" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="800">
    <tspan fill="#FFF8F0">clickfolio</tspan><tspan fill="#D94E4E">.me</tspan>
  </text>
  <text x="600" y="360" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="500" fill="#F5C542">
    Portfolio not found
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * GET /api/og/[handle]
 * Dynamic profile OG image — shows name, headline, top skills.
 * 1200x630 SVG, cached for 1 hour with 24h stale-while-revalidate.
 *
 * Returns SVG (no WASM deps needed, works on Cloudflare Workers + Turbopack).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;

  // Decode URL-encoded handle and strip @ prefix
  const handle = decodeURIComponent(rawHandle).replace(/^@/, "");

  if (!handle) {
    return renderFallbackSvg();
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);

    // Lightweight query: only preview columns needed for OG card
    const rows = await db
      .select({
        name: user.name,
        handle: user.handle,
        previewName: siteData.previewName,
        previewHeadline: siteData.previewHeadline,
        previewSkills: siteData.previewSkills,
      })
      .from(user)
      .leftJoin(siteData, eq(user.id, siteData.userId))
      .where(eq(user.handle, handle))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return renderFallbackSvg();
    }

    const displayName = escapeXml(row.previewName || row.name || handle);
    const headline = row.previewHeadline ? escapeXml(row.previewHeadline) : "";

    // Parse skills JSON — previewSkills is a JSON string array or null
    let skills: string[] = [];
    if (row.previewSkills) {
      try {
        const parsed = JSON.parse(row.previewSkills);
        if (Array.isArray(parsed)) {
          skills = parsed.slice(0, 4).map((s: unknown) => escapeXml(String(s)));
        }
      } catch {
        // Ignore malformed JSON
      }
    }

    // Build skill pills as SVG elements
    let skillsSvg = "";
    if (skills.length > 0) {
      const startX = 60;
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
      ? `<text x="60" y="320" font-family="system-ui,sans-serif" font-size="30" font-weight="500" fill="#F5C542">${headline}</text>`
      : "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1a1a2e"/>
  <text x="60" y="260" font-family="system-ui,sans-serif" font-size="52" font-weight="800" fill="#FFF8F0">${displayName}</text>
  ${headlineSvg}
  ${skillsSvg}
  <text x="60" y="590" font-family="system-ui,sans-serif" font-size="28" font-weight="700">
    <tspan fill="#FFF8F0">clickfolio</tspan><tspan fill="#D94E4E">.me</tspan><tspan fill="#FFF8F0" opacity="0.6" font-size="22" font-weight="400"> /${escapeXml(handle)}</tspan>
  </text>
</svg>`;

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("OG image generation error:", error);
    return renderFallbackSvg();
  }
}
