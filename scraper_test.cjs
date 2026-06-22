const cheerio = require('cheerio');
fetch('https://hipertoon.com', {headers: {'User-Agent': 'Mozilla/5.0'}})
  .then(r => r.text())
  .then(t => {
    const $ = cheerio.load(t);
    console.log('HTML FETCHED, extracting first post container...');
    const match = t.match(/class="([^"]*post[^"]*|[^"]*item[^"]*|[^"]*card[^"]*)"/g);
    if (match) console.log(match.slice(0, 20));
    
    console.log('Title text check:', $('title').text());
  });
