const cheerio = require("cheerio");

async function check() {
  const res = await fetch("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto/capitulo-21.5", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const scripts = $('script').map((i, el) => $(el).html()).get();
  
  const cdnLinks = html.match(/https?:\/\/cdn\.hipertoon\.com[\w\.\/:-]*/g) || [];
  console.log("Found CDN links:", [...new Set(cdnLinks)].slice(0, 5));
  
  console.log("Looking for window.__TRPC__ or window.__NEXT_DATA__");
  const nextData = scripts.find(s => s.includes('__NEXT_DATA__') || s.includes('__TRPC__') || s.includes('static/pages'));
  if (nextData) console.log("Found embedded data length:", nextData.length);
  else {
    const readerData = scripts.find(s => s.includes('pages') && s.includes('cdn'));
    if (readerData) console.log("Found embedded reader data length:", readerData.length);
  }
}
check();
