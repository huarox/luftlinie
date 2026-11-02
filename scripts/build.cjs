const fs = require('node:fs');
fs.mkdirSync('dist', {recursive:true});
for (const file of ['index.html','styles.css','app.js','core.js','logo.svg','manifest.webmanifest','sw.js','_headers']) {
  fs.copyFileSync(file, `dist/${file}`);
}
console.log('Built Luftlinie in dist/');
