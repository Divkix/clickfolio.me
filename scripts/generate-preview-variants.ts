import { readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { PREVIEW_WIDTHS } from "../lib/templates/theme-ids";

const PREVIEWS = join(import.meta.dirname, "..", "public", "previews");

// Rewrites every downscaled copy from its 2560w original, same encoding as the originals.
for (const file of await readdir(PREVIEWS)) {
  if (!file.endsWith(".webp") || /-\d+w\.webp$/.test(file)) continue;

  for (const width of PREVIEW_WIDTHS) {
    await sharp(join(PREVIEWS, file))
      .resize({ width })
      .webp({ quality: 82 })
      .toFile(join(PREVIEWS, file.replace(/\.webp$/, `-${width}w.webp`)));
  }
}
