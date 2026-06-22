const cheerio = require("cheerio");
const fs = require("fs");
const html = fs.readFileSync("mangalivreblog.html", "utf8");
const $ = cheerio.load(html);

console.log("== Discover Sections ==");

// popular
const populars = $('.popular-manga-widget .manga-item');
console.log("Populars:", populars.length);

const cards = $('.manga-card-modern');
console.log("Cards:", cards.length);

cards.first().each((_, el) => {
  console.log("Title:", $(el).find('.manga-title-modern, .manga-title').text().trim());
  console.log("Href:", $(el).find('a').attr('href'));
  console.log("Img:", $(el).find('img').attr('src'));
  console.log("Chapter:", $(el).find('.chapter-item-modern a').first().text().trim());
});

console.log("\n== HTML of first card ==");
console.log(cards.first().html());
