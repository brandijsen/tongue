/**
 * Rebuild favicons from `brand/tongue-favicon-mark.png`:
 * the export is RGB without alpha, with a halftone / very light low-chroma background.
 * We convert to RGBA here by removing that “paper” (white+grey) without editing files under brand.
 *
 * Usage: from `web/`: `npm run favicon`
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");
const sourcePath = path.join(repoRoot, "brand", "tongue-favicon-mark.png");
const appDir = path.join(__dirname, "..", "src", "app");

/** More pixels => sharper when the browser scales the asset. */
const ICON_SIZE = 512;
const APPLE_SIZE = 512;

/**
 * After trim, we crop the **center** (side fraction) and scale it to fill
 * the same output: same tab rectangle, but T + star “folded” larger.
 * Lower value = more aggressive zoom (e.g. 0.78 ≈ +28% side vs using the full rectangle).
 */
const CENTER_CROP_FRACTION = 0.78;

/**
 * Relative SRL, max–min spread: the background is near grey/white, low saturation;
 * black (T) and orange (star) have either low luminance or high spread.
 */
function perceivedLum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function paperToAlpha(rgb, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3;
      const r = rgb[s];
      const g = rgb[s + 1];
      const b = rgb[s + 2];
      const M = Math.max(r, g, b);
      const m = Math.min(r, g, b);
      const spread = M - m;
      const Lp = perceivedLum(r, g, b);
      let a;
      if (spread < 40 && Lp > 200) {
        a = 0;
      } else if (spread < 40 && Lp > 178 && Lp <= 200) {
        a = Math.min(255, Math.max(0, Math.round((255 * (200 - Lp)) / 22)));
      } else {
        a = 255;
      }
      const t = (y * width + x) * 4;
      out[t] = r;
      out[t + 1] = g;
      out[t + 2] = b;
      out[t + 3] = a;
    }
  }
  return out;
}

function postHardenFringe(rgba, width, height) {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 20) rgba[i] = 0;
  }
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file missing: ${sourcePath}`);
  }
  const { data, info } = await sharp(sourcePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) {
    throw new Error(`Expected RGB (3 channels), found ${info.channels}.`);
  }
  const { width, height } = info;
  const rgba = paperToAlpha(data, width, height);
  postHardenFringe(rgba, width, height);

  let mark = await sharp(rgba, {
    raw: { width, height, channels: 4 },
  })
    .trim()
    .png()
    .toBuffer();

  const meta = await sharp(mark).metadata();
  if (!meta.hasAlpha) {
    throw new Error("Intermediate PNG should have an alpha channel.");
  }
  if (!meta.width || !meta.height) {
    throw new Error("Mark dimensions missing.");
  }

  const ew = Math.max(1, Math.floor(meta.width * CENTER_CROP_FRACTION));
  const eh = Math.max(1, Math.floor(meta.height * CENTER_CROP_FRACTION));
  const left = Math.floor((meta.width - ew) / 2);
  const top = Math.floor((meta.height - eh) / 2);
  const zoomed = await sharp(mark)
    .extract({ left, top, width: ew, height: eh })
    .png()
    .toBuffer();

  /**
   * `cover` fills the square; after the center crop the artwork uses the 16px tab size better.
   */
  const iconPath = path.join(appDir, "icon.png");
  const applePath = path.join(appDir, "apple-icon.png");

  await sharp(zoomed)
    .resize(ICON_SIZE, ICON_SIZE, { fit: "cover", position: "centre" })
    .png()
    .toFile(iconPath);
  await sharp(zoomed)
    .resize(APPLE_SIZE, APPLE_SIZE, { fit: "cover", position: "centre" })
    .png()
    .toFile(applePath);

  const outIcon = await sharp(iconPath).metadata();
  const outApp = await sharp(applePath).metadata();
  if (!outIcon.hasAlpha || !outApp.hasAlpha) {
    throw new Error("Final outputs must include an alpha channel.");
  }

  console.log(
    `Favicon from brand/tongue-favicon-mark.png (paper+halftone removal) → ` +
      `icon.png ${ICON_SIZE}×${ICON_SIZE}, apple-icon.png ${APPLE_SIZE}×${APPLE_SIZE} (alpha: yes)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
