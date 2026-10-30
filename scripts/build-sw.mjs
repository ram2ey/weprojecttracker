import { build } from "esbuild";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await build({
  entryPoints: ["src/pwa/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  minify: true,
  target: "es2022",
  format: "iife",
  define: { "process.env.NODE_ENV": '"production"' },
});
await mkdir("public/icons", { recursive: true });
for (const size of [180, 192, 512]) {
  const logo = await sharp("public/brand/wassa-east-logo.png")
    .resize(Math.round(size * 0.78), Math.round(size * 0.78), { fit: "inside" })
    .flatten({ background: "#ffffff" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
