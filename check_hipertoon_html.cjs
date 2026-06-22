const cheerio = require("cheerio");
const fs = require("fs");

async function check() {
  try {
    const res = await fetch("https://hipertoon.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log("Status:", res.status);
    console.log("Is Madara?", $('.manga-title, .post-title, .chapter-list, script[src*="madara"]').length > 0);
    console.log("Has .manga-title:", $('.manga-title').length > 0);
    console.log("Has .post-title:", $('.post-title').length > 0);
    console.log("Has .chapter-list:", $('.chapter-list').length > 0);
    
    fs.writeFileSync("hipertoon.html", html);
  } catch (err) {
    console.log("Error:", err.message);
  }
}
check();
