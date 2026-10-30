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
const icon = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="#214e3b"/><g stroke="#f9f5e9" stroke-width="18" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M134 208L256 140l122 68zM145 366h222M133 390h246M165 238v98m61-98v98m61-98v98m61-98v98"/></g></svg>',
);
for (const size of [180, 192, 512])
  await sharp(icon)
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
