const cheerio = require("cheerio");

async function checkSite(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const isMadara = $('script[src*="madara"]').length > 0 || $('.c-tabs-item').length > 0 || $('.manga-title').length > 0 || $('.post-title').length > 0;
    
    console.log(`[${url}]`);
    console.log(`Status: ${res.status}`);
    console.log(`Is Madara? ${isMadara}`);
    
    // sample elements
    console.log(`Has .manga-title: ${$('.manga-title').length > 0}`);
    console.log(`Has .post-title: ${$('.post-title').length > 0}`);
    console.log(`Has .chapter-list: ${$('.chapter-list').length > 0}`);
    console.log(`Has .wp-manga-chapter: ${$('.wp-manga-chapter').length > 0}`);
    console.log("-------------------");
  } catch (err) {
    console.log(`Error checking ${url}:`, err.message);
  }
}

checkSite("https://mangalivre.blog/");
checkSite("https://sakuramangas.org/");
