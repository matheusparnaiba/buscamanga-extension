const cheerio = require('cheerio');
fetch('https://mangalivre.to', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(t => {
    const $ = cheerio.load(t);
    $('.manga-item').slice(0, 3).each((_, el) => {
      const title = $(el).find(".manga-title, h3, .post-title").text().trim();
      const href = $(el).find("a").first().attr("href");
      const img = $(el).find("img").attr("src");
      console.log(`Title: ${title}, href: ${href}`);
    });
  });
