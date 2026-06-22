const cheerio = require("cheerio");
const fs = require("fs");
const html = fs.readFileSync("hipertoon.html", "utf8");
const $ = cheerio.load(html);

console.log("Scripts:");
$('script').each((_, el) => {
  const src = $(el).attr('src');
  if (src) console.log(src);
});

console.log("\nLinks:");
$('link').each((_, el) => {
  const href = $(el).attr('href');
  if (href && href.includes('theme') || href.includes('css')) console.log(href);
});

console.log("\nPopulars / Updates:");
console.log("Found .bsx:", $('.bsx').length);
console.log("Found .manga-card:", $('.manga-card').length);
console.log("Found .page-item-detail:", $('.page-item-detail').length);
