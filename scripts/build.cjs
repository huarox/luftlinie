// Copies the explicit list of public files into dist/. Functions in ./functions are bundled by Wrangler at deploy time.
const fs = require('node:fs');
fs.rmSync('dist', {recursive:true, force:true});
fs.mkdirSync('dist', {recursive:true});
for (const file of ['index.html','styles.css','app.js','core.js','logo.svg','manifest.webmanifest','sw.js','_headers']) {
  fs.copyFileSync(file, `dist/${file}`);
}
console.log('Built Luftlinie in dist/ (functions/ deploys alongside via wrangler)');
