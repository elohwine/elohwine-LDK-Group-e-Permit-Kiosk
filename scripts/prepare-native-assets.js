#!/usr/bin/env node
/*
  Prepares Capacitor native assets from public/img/logo_light.png
  - Generates resources/android/icon-foreground.png (1024x1024, transparent bg)
  - Generates resources/android/icon-background.png (1024x1024, brand color)
  - Generates resources/icon.png (composited fallback)
  - Generates resources/splash.png (large brand bg with centered logo)
*/
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

sharp.cache(false);

const root = process.cwd();
const srcLogo = path.join(root, 'public', 'img', 'logo_light.png');
const resourcesDir = path.join(root, 'resources');
const androidDir = path.join(resourcesDir, 'android');

const BRAND_BG = '#1374bc';

async function ensureDirs() {
  if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });
  if (!fs.existsSync(androidDir)) fs.mkdirSync(androidDir, { recursive: true });
}

async function generateIconForeground() {
  const out = path.join(androidDir, 'icon-foreground.png');
  const size = 1024;
  await sharp(srcLogo)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('Wrote', path.relative(root, out));
}

async function generateIconBackground() {
  const out = path.join(androidDir, 'icon-background.png');
  const size = 1024;
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('Wrote', path.relative(root, out));
}

async function generateFallbackIcon() {
  // Compose foreground over background for legacy icon consumers
  const out = path.join(resourcesDir, 'icon.png');
  const size = 1024;
  const bg = await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .png()
    .toBuffer();
  const fg = await sharp(srcLogo)
    .resize(Math.round(size * 0.8), Math.round(size * 0.8), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(bg)
    .composite([{ input: fg, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('Wrote', path.relative(root, out));
}

async function generateSplash() {
  // A large square splash that @capacitor/assets will downscale appropriately
  const out = path.join(resourcesDir, 'splash.png');
  const size = 2732; // recommended max canvas
  const logoSize = 1024; // keep logo crisp
  const bg = await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG } })
    .png()
    .toBuffer();
  const fg = await sharp(srcLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(bg)
    .composite([{ input: fg, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('Wrote', path.relative(root, out));
}

async function main() {
  if (!fs.existsSync(srcLogo)) {
    console.error(`Source logo not found at ${srcLogo}. Place logo_light.png there (ideally 1024x1024).`);
    process.exit(1);
  }
  await ensureDirs();
  await generateIconBackground();
  await generateIconForeground();
  await generateFallbackIcon();
  await generateSplash();
  console.log('Native assets prepared in resources/. Proceed to run @capacitor/assets generate.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
