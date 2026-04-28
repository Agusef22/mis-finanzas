#!/usr/bin/env node
// ============================================================
// Generate PWA icons from the brand SVG
// ============================================================
// Run: cd app && node ../scripts/generate-pwa-icons.mjs
// (Tiene que correrse desde app/ porque sharp está instalado ahí.)
//
// Outputs to app/public/:
//   - icon-192.png            (Android home, manifest)
//   - icon-512.png            (Splash, manifest, share)
//   - icon-maskable-512.png   (Android adaptive, with safe zone)
//   - apple-touch-icon.png    (180×180, iOS home)
// ============================================================

import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// PUBLIC apunta a app/public sin importar desde dónde se corre
const PUBLIC = resolve(__dirname, '..', 'app', 'public')
void __dirname

// SVG normal: cuadrado azul con $ blanco. Usa todo el viewBox (sin padding).
const baseSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#2563eb"/>
  <text x="${size / 2}" y="${size * 0.7}"
        text-anchor="middle" fill="#ffffff"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${size * 0.6}" font-weight="700">$</text>
</svg>
`

// Maskable: el sistema corta los bordes (círculo, squircle, etc.).
// Necesitamos "safe zone" = todo el contenido en el 80% central, y padding
// del color de fondo afuera. Así Android puede aplicar cualquier máscara
// sin cortar el símbolo.
const maskableSvg = (size) => {
  const inner = size * 0.8
  const offset = size * 0.1
  const radius = Math.round(inner * 0.22)
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect x="0" y="0" width="${size}" height="${size}" fill="#2563eb"/>
  <rect x="${offset}" y="${offset}" width="${inner}" height="${inner}"
        rx="${radius}" fill="#2563eb"/>
  <text x="${size / 2}" y="${size * 0.66}"
        text-anchor="middle" fill="#ffffff"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${inner * 0.6}" font-weight="700">$</text>
</svg>
`
}

async function svgToPng(svg, size, outName) {
  const out = resolve(PUBLIC, outName)
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`✓ ${outName}  (${size}×${size})`)
}

async function main() {
  await svgToPng(baseSvg(192),     192, 'icon-192.png')
  await svgToPng(baseSvg(512),     512, 'icon-512.png')
  await svgToPng(maskableSvg(512), 512, 'icon-maskable-512.png')
  await svgToPng(baseSvg(180),     180, 'apple-touch-icon.png')
}

main().catch((e) => { console.error(e); process.exit(1) })
