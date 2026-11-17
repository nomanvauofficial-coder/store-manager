// Runs after "next build". Lists every app file so the phone can save ALL of them the first time the app is opened,
// which is what makes the app (and the barcode scanner, PDF, Excel…) work with no internet.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const OUT = 'out';
const walk = dir => readdirSync(dir).flatMap(n => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const extra = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']
  .map(f => join(OUT, f)).filter(existsSync);
const files = [...walk(join(OUT, '_next', 'static')), ...extra]
  .map(p => relative(OUT, p).split('\\').join('/'))
  .sort();

// the version changes whenever any app file or the start page changes -> phones fetch the new version
const hash = createHash('sha1');
files.forEach(f => hash.update(f));
hash.update(readFileSync(join(OUT, 'index.html')));
const version = hash.digest('hex').slice(0, 10);

writeFileSync(join(OUT, 'precache.json'), JSON.stringify({ version, files }));

const swPath = join(OUT, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', version));

const kb = Math.round(files.reduce((a, f) => a + statSync(join(OUT, f)).size, 0) / 1024);
console.log(`precache: ${files.length} files, ${kb} KB, version ${version}`);
