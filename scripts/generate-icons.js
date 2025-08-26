#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Disable sharp's cache to prevent stale assets during generation
sharp.cache(false);

const root = process.cwd();
const src = path.join(root, 'public', 'img', 'logo.png');
const outDir = path.join(root, 'public', 'icons');

async function main(){
  if (!fs.existsSync(src)) {
    console.error(`Source logo not found at ${src}. Place your logo PNG there (ideally 1024x1024).`);
    process.exit(1);
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const targets = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  { size: 96, name: 'shortcut-96.png' },
  { size: 96, name: 'shortcut-96-mono.png', monochrome: true },
    { size: 192, name: 'icon-192-maskable.png', maskable: true },
    { size: 512, name: 'icon-512-maskable.png', maskable: true },
  ];

  for (const t of targets) {
    const out = path.join(outDir, t.name);
    try {
      let img = sharp(src)
        .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
      if (t.monochrome) {
        const logo = await img.png().toBuffer();
        // Create grayscale monochrome icon on white background
        await sharp(logo)
          .flatten({ background: { r:255, g:255, b:255, alpha:1 }})
          .grayscale()
          .resize(t.size, t.size, { fit: 'contain', background: { r:255, g:255, b:255, alpha:1 }})
          .png({ compressionLevel: 9 })
          .toFile(out);
        console.log(`Generated ${out}`);
        continue;
      }
      if (t.maskable) {
        const bg = {
          input: Buffer.from(
            `<svg width="${t.size}" height="${t.size}" viewBox="0 0 ${t.size} ${t.size}" xmlns="http://www.w3.org/2000/svg">
               <rect width="100%" height="100%" rx="${Math.round(t.size*0.18)}" ry="${Math.round(t.size*0.18)}" fill="#1374bc"/>
             </svg>`
          ),
          top: 0,
          left: 0
        };
        const logoBuf = await img.png().toBuffer();
        img = sharp({ create: { width: t.size, height: t.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([bg, { input: logoBuf, gravity: 'center' }]);
      }
      await img.png({ compressionLevel: 9 }).toFile(out);
      console.log(`Generated ${out}`);
    } catch (e) {
      console.warn(`Icon generation failed for ${t.name}: ${e?.message || e}. Falling back.`);
      try {
        // Fallback: write non-maskable resized icon even for maskable target so the path exists.
        await sharp(src)
          .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ compressionLevel: 9 })
          .toFile(out);
        console.log(`Fallback generated ${out}`);
      } catch (e2) {
        console.error(`Fallback failed for ${t.name}: ${e2?.message || e2}`);
      }
    }
  }
  console.log('Done. Update public/manifest.json if needed to point to /icons/icon-192.png and /icons/icon-512.png');
}

main().catch(err=>{ console.error(err); process.exit(1); });
