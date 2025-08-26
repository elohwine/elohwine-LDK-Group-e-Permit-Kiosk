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
  ];

  for (const t of targets) {
    const out = path.join(outDir, t.name);
    await sharp(src)
      .resize(t.size, t.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }})
      .png()
      .toFile(out);
    console.log(`Generated ${out}`);
  }
  console.log('Done. Update public/manifest.json if needed to point to /icons/icon-192.png and /icons/icon-512.png');
}

main().catch(err=>{ console.error(err); process.exit(1); });
