const cheerio = require('cheerio');
fetch('https://mangaonline.blue', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(t => {
    const $ = cheerio.load(t);
    $('.es-upd-card').slice(0, 5).each((_, el) => {
      const imgTag = $(el).find(".es-upd-cover img");
      console.log('img attrs:', imgTag.attr());
    });
  });
