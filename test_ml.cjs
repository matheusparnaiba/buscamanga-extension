const fs = require('fs');
const cheerio = require('cheerio');

async function check() {
  const res = await fetch("https://mangalivre.to/");
  const html = await res.text();
  const $ = cheerio.load(html);
  
  let populars = $('.popular-statuses .widget-content .popular-item-wrap, .widget-content .popular-item-wrap, .popular-item-wrap, .popular-manga');
  console.log("Populars found:", populars.length);
  
  populars.each((_, el) => {
    const title = $(el).find(".widget-title a, h5 a, .post-title a").text().trim();
    const href = $(el).find(".widget-title a, h5 a, .post-title a").attr("href");
    console.log("Title:", title, "| Href:", href);
  });
}
check();
