const html = require('fs').readFileSync('hipertoon_rendered.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);
const text = $('body').text().replace(/\s+/g, ' ');
console.log(text.substring(0, 1000));
