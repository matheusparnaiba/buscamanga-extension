const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('mobile.html', 'utf8');
const $ = cheerio.load(html);
console.log($('.popular-item-wrap').first().html());
