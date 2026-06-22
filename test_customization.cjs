const fs = require("fs");
fs.copyFileSync("assets/buscamanga.png", "bundles/logo.png");
fs.copyFileSync("assets/buscamanga.ico", "bundles/buscamanga.ico");
fs.copyFileSync("template.html", "bundles/index.html");
fs.copyFileSync("src/MangaOnline/icon.png", "bundles/MangaOnline/icon.png");
fs.copyFileSync("src/MangaOnline/icon.png", "bundles/MangaOnline/static/icon.png");
if (fs.existsSync("bundles/MangaLivre")) {
  fs.copyFileSync("src/MangaLivre/icon.png", "bundles/MangaLivre/icon.png");
  fs.copyFileSync("src/MangaLivre/icon.png", "bundles/MangaLivre/static/icon.png");
}
let json = fs.readFileSync("bundles/versioning.json", "utf8");
json = json.replace(/buscamanga-extension/g, "BuscaMangá");
fs.writeFileSync("bundles/versioning.json", json);
console.log("Success");
