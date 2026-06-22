const fs = require("fs");
const cheerio = require("cheerio");
const $ = cheerio.load(fs.readFileSync("sakura.html", "utf8"));
console.log($("title").text());
console.log($("meta").length);
