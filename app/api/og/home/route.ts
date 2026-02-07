/**
 * GET /api/og/home
 * Homepage OG image — branded SVG card with browser mockup and template preview.
 * 1200x630, cached for 1 week.
 *
 * NOTE: PNG conversion via workers-og failed due to Turbopack incompatibility
 * with WASM modules. SVG OG images are supported by Facebook, LinkedIn, and most
 * crawlers. Twitter/X has limited SVG support but falls back to meta description.
 */
export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4ECDC4"/>
      <stop offset="100%" stop-color="#44B09E"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.04" stroke="#FFF8F0" stroke-width="0.5">
    <line x1="0" y1="0" x2="1200" y2="630"/>
    <line x1="400" y1="0" x2="400" y2="630"/>
    <line x1="800" y1="0" x2="800" y2="630"/>
    <line x1="0" y1="210" x2="1200" y2="210"/>
    <line x1="0" y1="420" x2="1200" y2="420"/>
  </g>

  <!-- Left side: Brand + tagline -->
  <text x="80" y="220" font-family="system-ui,sans-serif" font-size="64" font-weight="800">
    <tspan fill="#FFF8F0">clickfolio</tspan><tspan fill="#D94E4E">.me</tspan>
  </text>
  <text x="80" y="280" font-family="system-ui,sans-serif" font-size="32" font-weight="500" fill="#F5C542">
    Turn your resume into a website
  </text>

  <!-- Steps -->
  <g font-family="system-ui,sans-serif">
    <rect x="80" y="320" width="140" height="40" rx="20" fill="url(#accentGrad)" opacity="0.9"/>
    <text x="150" y="346" text-anchor="middle" font-size="17" font-weight="600" fill="#1a1a2e">Upload PDF</text>

    <text x="232" y="346" font-size="20" fill="#FFF8F0" opacity="0.4">&#x2192;</text>

    <rect x="256" y="320" width="120" height="40" rx="20" fill="url(#accentGrad)" opacity="0.9"/>
    <text x="316" y="346" text-anchor="middle" font-size="17" font-weight="600" fill="#1a1a2e">AI Parse</text>

    <text x="388" y="346" font-size="20" fill="#FFF8F0" opacity="0.4">&#x2192;</text>

    <rect x="412" y="320" width="120" height="40" rx="20" fill="url(#accentGrad)" opacity="0.9"/>
    <text x="472" y="346" text-anchor="middle" font-size="17" font-weight="600" fill="#1a1a2e">Publish</text>
  </g>

  <!-- Right side: Browser mockup -->
  <g transform="translate(660, 80)">
    <!-- Browser frame shadow -->
    <rect x="4" y="4" width="460" height="460" rx="12" fill="#000" opacity="0.3"/>
    <!-- Browser frame -->
    <rect width="460" height="460" rx="12" fill="#2a2a4a" stroke="#3a3a5e" stroke-width="1"/>

    <!-- Browser chrome bar -->
    <rect width="460" height="40" rx="12" fill="#2a2a4a"/>
    <rect y="28" width="460" height="12" fill="#2a2a4a"/>
    <line x1="0" y1="40" x2="460" y2="40" stroke="#3a3a5e" stroke-width="1"/>

    <!-- Traffic light dots -->
    <circle cx="24" cy="20" r="6" fill="#FF5F56"/>
    <circle cx="44" cy="20" r="6" fill="#FFBD2E"/>
    <circle cx="64" cy="20" r="6" fill="#27C93F"/>

    <!-- URL bar -->
    <rect x="90" y="10" width="280" height="20" rx="4" fill="#1a1a2e"/>
    <text x="100" y="24" font-family="system-ui,sans-serif" font-size="11" fill="#FFF8F0" opacity="0.5">clickfolio.me/@janedoe</text>

    <!-- Template preview content -->
    <rect x="24" y="56" width="412" height="388" rx="4" fill="#1a1a2e"/>

    <!-- Profile header mockup -->
    <circle cx="68" cy="100" r="28" fill="#3a3a5e"/>
    <rect x="110" y="82" width="180" height="14" rx="2" fill="#FFF8F0" opacity="0.8"/>
    <rect x="110" y="102" width="120" height="10" rx="2" fill="#F5C542" opacity="0.6"/>

    <!-- Skill pills mockup -->
    <rect x="42" y="140" width="70" height="22" rx="11" fill="#4ECDC4" opacity="0.7"/>
    <rect x="120" y="140" width="90" height="22" rx="11" fill="#4ECDC4" opacity="0.7"/>
    <rect x="218" y="140" width="60" height="22" rx="11" fill="#4ECDC4" opacity="0.7"/>

    <!-- Content lines mockup -->
    <rect x="42" y="180" width="360" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
    <rect x="42" y="196" width="300" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
    <rect x="42" y="212" width="340" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>

    <!-- Experience section mockup -->
    <rect x="42" y="244" width="140" height="10" rx="2" fill="#FFF8F0" opacity="0.3"/>
    <rect x="42" y="264" width="360" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
    <rect x="42" y="280" width="320" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
    <rect x="42" y="296" width="350" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>

    <!-- Second experience block -->
    <rect x="42" y="324" width="160" height="10" rx="2" fill="#FFF8F0" opacity="0.3"/>
    <rect x="42" y="344" width="340" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
    <rect x="42" y="360" width="300" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
    <rect x="42" y="376" width="360" height="8" rx="2" fill="#FFF8F0" opacity="0.12"/>
  </g>

  <!-- Bottom bar -->
  <rect x="0" y="606" width="1200" height="24" fill="#D94E4E" opacity="0.15"/>

  <!-- Bottom branding -->
  <text x="80" y="560" font-family="system-ui,sans-serif" font-size="18" fill="#FFF8F0" opacity="0.4">
    Free &#xB7; No sign-up to upload &#xB7; AI-powered
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
