/* eslint-disable @typescript-eslint/no-require-imports */
// Generate 6 test fixture JPEGs at different sizes/aspect ratios.
// Run from project root: node test/fixtures/generate.js

const sharp = require("sharp");
const path = require("path");

const fixtures = [
  { name: "landscape-4000x3000.jpg", w: 4000, h: 3000, color: { r: 180, g: 120, b: 80 } },
  { name: "portrait-3000x4000.jpg",  w: 3000, h: 4000, color: { r: 70,  g: 110, b: 160 } },
  { name: "square-3000x3000.jpg",    w: 3000, h: 3000, color: { r: 120, g: 160, b: 100 } },
  { name: "small-800x600.jpg",       w: 800,  h: 600,  color: { r: 200, g: 200, b: 220 } },
  { name: "panoramic-6000x2000.jpg", w: 6000, h: 2000, color: { r: 200, g: 140, b: 60  } },
  { name: "large-8000x5000.jpg",     w: 8000, h: 5000, color: { r: 60,  g: 70,  b: 100 } },
];

async function run() {
  for (const f of fixtures) {
    const out = path.join(__dirname, f.name);
    // Create a colored rectangle with a gradient-like pattern using overlay
    const buffer = await sharp({
      create: {
        width: f.w,
        height: f.h,
        channels: 3,
        background: f.color,
      },
    })
      .jpeg({ quality: 92 })
      .toBuffer();

    await sharp(buffer).toFile(out);
    const stat = require("fs").statSync(out);
    console.log(`${f.name}  ${f.w}x${f.h}  ${(stat.size / 1024).toFixed(1)} KB`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
