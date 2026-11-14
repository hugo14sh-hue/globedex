// Skapar appikoner i public/ från docs/logo. Kör: npm run icons
// Loggan ritas aldrig om här, filerna kopieras eller renderas som de är.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const SRC = 'docs/logo';
const OUT = 'public';
mkdirSync(`${OUT}/logo`, { recursive: true });

const copy = [
  'globedex-symbol.svg',
  'globedex-symbol-mork.svg',
  'globedex-symbol-liten.svg',
  'globedex-symbol-liten-mork.svg',
  'globedex-favicon.svg',
  'globedex-favicon-mork.svg',
  'globedex-ikon.svg',
];
for (const f of copy) copyFileSync(`${SRC}/${f}`, `${OUT}/logo/${f}`);

const png = [
  ['globedex-ikon.svg', 192, 'pwa-192.png'],
  ['globedex-ikon.svg', 512, 'pwa-512.png'],
  ['globedex-ikon-maskable.svg', 512, 'pwa-maskable-512.png'],
  ['globedex-ikon-maskable.svg', 192, 'pwa-maskable-192.png'],
  ['globedex-ikon-maskable.svg', 180, 'apple-touch-icon.png'],
  // 16 till 32 px: bara globen (globedex-favicon.svg).
  ['globedex-favicon.svg', 32, 'favicon-32.png'],
  ['globedex-favicon.svg', 16, 'favicon-16.png'],
];
for (const [file, size, out] of png) {
  const svg = readFileSync(`${SRC}/${file}`, 'utf8');
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  writeFileSync(`${OUT}/${out}`, img.asPng());
}
console.log('Ikoner skapade i public/');
