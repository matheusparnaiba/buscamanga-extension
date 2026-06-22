const fs = require('fs');
const cheerio = require('cheerio');
const path = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\20a4a1ca-f3a7-4459-9648-99099ebe99bf\\.system_generated\\steps\\1756\\content.md';
const html = fs.readFileSync('mobile.html', 'utf8');
const $ = cheerio.load(html);
console.log('Contains slimeread?', html.includes('slimeread'));
console.log($('.manga-card').length, $('.card').length, $('.book').length);
