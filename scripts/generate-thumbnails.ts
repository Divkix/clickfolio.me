import { chromium } from "playwright";

const TEMPLATES = [
  { id: "bento", file: "bento.png" },
  { id: "bold_corporate", file: "bold-corporate.png" },
  { id: "glass", file: "glass.png" },
  { id: "midnight", file: "midnight.png" },
  { id: "minimalist_editorial", file: "minimalist.png" },
  { id: "neo_brutalist", file: "brutalist.png" },
  { id: "spotlight", file: "spotlight.png" },
];

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function generateThumbnails() {
  console.log("Launching browser...");
  const browser = await chromium.launch();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2, // Retina quality
  });

  const page = await context.newPage();

  for (const template of TEMPLATES) {
    const url = `${BASE_URL}/preview/${template.id}`;
    console.log(`Capturing ${template.id}...`);

    try {
      await page.goto(url, { waitUntil: "networkidle" });

      // Wait for any animations to settle
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `public/previews/${template.file}`,
        type: "png",
      });

      console.log(`  Saved: public/previews/${template.file}`);
    } catch (error) {
      console.error(`  Error capturing ${template.id}:`, error);
    }
  }

  await browser.close();
  console.log("Done!");
}

generateThumbnails().catch(console.error);
