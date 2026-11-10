import sharp from "sharp";

// Reuse the constituency crest from the existing wordmark, with safe padding
// for rounded iPhone icons and Android's circular/adaptive icon masks.
const crest = await sharp("public/brand/wassa-east-logo.png")
  .extract({ left: 0, top: 0, width: 1280, height: 1120 })
  .toBuffer();
for (const [filename, size, inset] of [
  ["icon-192.png", 192, 24],
  ["icon-512.png", 512, 64],
  ["icon-maskable-512.png", 512, 110],
  ["apple-touch-icon.png", 180, 23],
]) {
  const logo = await sharp(crest)
    .resize(size - inset * 2, size - inset * 2, { fit: "inside" })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .flatten({ background: "#ffffff" })
    .png()
    .toFile("public/brand/" + filename);
}
