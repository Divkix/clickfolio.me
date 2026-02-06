/**
 * GET /api/og/home
 * Static homepage OG image — branded SVG card with tagline.
 * 1200x630, cached for 1 week.
 *
 * Returns SVG (no WASM deps needed, works on Cloudflare Workers + Turbopack).
 */
export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1a1a2e"/>
  <text x="600" y="260" text-anchor="middle" font-family="system-ui,sans-serif" font-size="72" font-weight="800">
    <tspan fill="#FFF8F0">clickfolio</tspan><tspan fill="#D94E4E">.me</tspan>
  </text>
  <text x="600" y="340" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="500" fill="#F5C542">
    Turn your resume into a website
  </text>
  <text x="600" y="410" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" fill="#4ECDC4" opacity="0.8">
    Upload PDF · AI Parse · Publish
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
