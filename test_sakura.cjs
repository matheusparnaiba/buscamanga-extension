const cheerio = require("cheerio");

async function run() {
  const res = await fetch("https://sakuramangas.org");
  const data = await res.text();
  const $ = cheerio.load(data);

  let populars = $(
    ".popular-statuses .widget-content .popular-item-wrap, .widget-content .popular-item-wrap, .popular-item-wrap, .popular-manga",
  );
  if (populars.length === 0) populars = $(".sidebar .popular-item-wrap");
  if (populars.length === 0) populars = $(".popular-item-wrap");

  console.log("Populars count: ", populars.length);

  const updates = $(".manga-item, .page-item-detail");
  console.log("Updates count: ", updates.length);
}

run();
