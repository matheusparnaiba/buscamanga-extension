const cheerio = require("cheerio");

async function checkTheme() {
  try {
    const res = await fetch("https://mangalivre.blog/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log("Scripts:");
    $('script').each((_, el) => {
      const src = $(el).attr('src');
      if (src) console.log(src);
    });

    console.log("\nLinks:");
    $('link').each((_, el) => {
      const href = $(el).attr('href');
      if (href) console.log(href);
    });
  } catch (err) {
    console.log("Error:", err.message);
  }
}
checkTheme();
