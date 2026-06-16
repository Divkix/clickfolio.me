import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const PUBLIC = join(ROOT, "public");
const ICON_SVG = join(PUBLIC, "icon.svg");

interface FaviconConfig {
  name: string;
  size: number;
}

const PNG_CONFIGS: FaviconConfig[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "mstile-150x150.png", size: 150 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

async function generatePng(svg: Buffer, size: number): Promise<Buffer> {
  return sharp(svg).resize(size, size).png().toBuffer();
}

async function main() {
  console.log("Reading icon.svg...");
  const svg = await readFile(ICON_SVG);

  // Generate PNGs
  const pngBuffers: Map<number, Buffer> = new Map();

  for (const config of PNG_CONFIGS) {
    console.log(`Generating ${config.name} (${config.size}x${config.size})...`);
    const png = await generatePng(svg, config.size);
    pngBuffers.set(config.size, png);
    await writeFile(join(PUBLIC, config.name), png);
  }

  // Generate favicon.ico (multi-size: 16 + 32)
  console.log("Generating favicon.ico (16x16 + 32x32)...");
  const ico16 = pngBuffers.get(16)!;
  const ico32 = pngBuffers.get(32)!;
  const ico = await pngToIco([ico16, ico32]);
  await writeFile(join(PUBLIC, "favicon.ico"), ico);

  console.log("Done! Generated:");
  for (const config of PNG_CONFIGS) {
    console.log(`  - ${config.name}`);
  }
  console.log("  - favicon.ico");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
