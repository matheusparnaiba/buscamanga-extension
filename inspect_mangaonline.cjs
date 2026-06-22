const cheerio = require("cheerio");

async function run() {
  const res = await fetch("https://mangaonline.blue/");
  const html = await res.text();
  const $ = cheerio.load(html);

  const updates = [];
  $(".es-upd-card")
    .slice(0, 3)
    .each((_, el) => {
      const title = $(el).find(".es-upd-title").text().trim();
      const href = $(el).find(".es-upd-title").attr("href");
      const imgHtml = $(el).find(".es-upd-cover").html();
      const chapterHtml = $(el).find(".es-upd-chapters").html();
      updates.push({ title, href, imgHtml, chapterHtml });
    });

  console.log(JSON.stringify(updates, null, 2));
}
run();
