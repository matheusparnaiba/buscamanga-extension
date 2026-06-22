const cheerio = require('cheerio');
fetch('https://mangalivre.to/manga/chainsaw-man-pt-br/capitulo-232/', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(t => {
    const $ = cheerio.load(t);
    console.log('Chapter Images (.page-break img):', $('.page-break img, .reading-content img').length);
    console.log('First Image:', $('.page-break img, .reading-content img').first().attr('src'));
  });
