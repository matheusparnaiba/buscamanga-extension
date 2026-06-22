const cheerio = require("cheerio");
const fs = require("fs");
const html = fs.readFileSync("C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\20a4a1ca-f3a7-4459-9648-99099ebe99bf\\.system_generated\\steps\\1756\\content.md", "utf8");

// Actually, content.md is markdown. I need the raw HTML.
// I'll fetch it again.
async function run() {
  const res = await fetch("https://mangalivre.blog/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  const rawHtml = await res.text();
  const $ = cheerio.load(rawHtml);
  
  console.log("== Discover Sections ==");
  
  // Find carousels or lists
  const sections = $('.manga-carousel, .sidebar-popular-manga, .popular-manga, .latest-updates, .content-sidebar-wrap');
  console.log("Found sections:", sections.length);

  $('.manga-item, .post-item, .item, article').first().each((_, el) => {
    console.log("Class:", $(el).attr("class"));
    console.log("Title:", $(el).find('h2, h3, a[title], .title').text().trim());
    console.log("Link:", $(el).find('a').attr('href'));
  });
  
  fs.writeFileSync('mangalivreblog.html', rawHtml);
  console.log("Saved mangalivreblog.html");
}
run();
