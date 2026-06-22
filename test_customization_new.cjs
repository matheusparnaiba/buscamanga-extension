const fs = require('fs');
fs.copyFileSync('assets/buscamanga.png', 'bundles/logo.png');
fs.copyFileSync('assets/buscamanga.ico', 'bundles/buscamanga.ico');
fs.copyFileSync('template.html', 'bundles/index.html');
const folders = fs.readdirSync('src', { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
for (const folder of folders) {
  if (fs.existsSync(`bundles/${folder}`)) {
    if (fs.existsSync(`src/${folder}/icon.png`)) {
      fs.copyFileSync(`src/${folder}/icon.png`, `bundles/${folder}/icon.png`);
      fs.copyFileSync(`src/${folder}/icon.png`, `bundles/${folder}/static/icon.png`);
    }
  }
}
let json = fs.readFileSync('bundles/versioning.json', 'utf8');
json = json.replace(/buscamanga-extension/g, 'BuscaMangá');
fs.writeFileSync('bundles/versioning.json', json);
console.log("Success");
