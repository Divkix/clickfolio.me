// Stub for next/dist/compiled/@vercel/og — not usable on Cloudflare Workers.
// Aliased in vite.config.ts to eliminate ~2 MB of dead WASM (resvg + yoga).

class ImageResponse extends Response {
  constructor() {
    super("@vercel/og is not supported on Cloudflare Workers", { status: 500 });
  }
}

export { ImageResponse, ImageResponse as experimental_FigmaImageResponse };
