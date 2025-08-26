#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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
    { size: 192, name: 'icon-192-maskable.png', maskable: true },
    { size: 512, name: 'icon-512-maskable.png', maskable: true },
  ];

  for (const t of targets) {
    const out = path.join(outDir, t.name);
    let img = sharp(src).resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }});
    // For maskable icons, paint a full-bleed rounded-rect background so the OS mask never crops the logo out.
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
      img = sharp({ create: { width: t.size, height: t.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([bg])
        .composite([{ input: await img.png().toBuffer(), gravity: 'centre' }]);
    }
    await img.png().toFile(out);
    console.log(`Generated ${out}`);
  }
  console.log('Done. Update public/manifest.json if needed to point to /icons/icon-192.png and /icons/icon-512.png');
}

main().catch(err=>{ console.error(err); process.exit(1); });
