const cheerio = require('cheerio');
fetch('https://mangalivre.to', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(t => {
    const $ = cheerio.load(t);
    const el = $('.manga-item').first();
    console.log('Title:', el.find('h3 a').text().trim() || el.find('.post-title a').text().trim());
    console.log('Link:', el.find('h3 a').attr('href') || el.find('.post-title a').attr('href'));
    console.log('Image:', el.find('img').attr('src'));
    
    console.log('Search test:');
    const searchUrl = 'https://mangalivre.to/page/1/?s=solo&post_type=wp-manga';
    return fetch(searchUrl, {headers: {'User-Agent': 'Mozilla/5.0'}});
  })
  .then(r => r.text())
  .then(t => {
    const $ = cheerio.load(t);
    console.log("Search elements (.c-tabs-item__content):", $('.c-tabs-item__content').length);
    console.log("Search elements (.manga-item):", $('.manga-item').length);
  });
