// Copies the explicit list of public files into dist/. Functions in ./functions are bundled by Wrangler at deploy time.
// Asset links in index.html get a content hash (?v=…). The custom domain can apply a long browser cache to
// static files; without the hash, a returning visitor got the new page with the previous app.js for hours.
const fs = require('node:fs');
const crypto = require('node:crypto');
const files = ['index.html','styles.css','app.js','core.js','logo.svg','manifest.webmanifest','sw.js','_headers'];
fs.rmSync('dist', {recursive:true, force:true});
fs.mkdirSync('dist', {recursive:true});
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
const versions = Object.fromEntries(['styles.css','app.js','core.js','logo.svg','manifest.webmanifest'].map(f => [f, hash(f)]));
for (const file of files) {
  let body = fs.readFileSync(file, 'utf8');
  if (file === 'index.html') {
    for (const [name, v] of Object.entries(versions)) {
      body = body.split(`"${name}"`).join(`"${name}?v=${v}"`);
    }
  }
  if (file === 'sw.js') {
    // A new cache name per build, so the service worker drops the previous version's files.
    body = body.replace(/const CACHE='[^']*';/, `const CACHE='luftlinie-${hash('app.js')}${hash('styles.css').slice(0,4)}';`);
  }
  fs.writeFileSync(`dist/${file}`, body);
}
console.log('Built Luftlinie in dist/ with versioned assets:', versions);
