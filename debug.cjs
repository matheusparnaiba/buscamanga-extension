const cheerio = require("cheerio");
const BASE_URL = "https://mangalivre.to";

function getImageSrc($img) {
  let src = $img.attr("data-src") || 
            $img.attr("data-lazy-src") || 
            $img.attr("srcset")?.split(" ")[0] || 
            $img.attr("src") || 
            $img.attr("data-cfsrc") || "";
  src = src.trim().replace(/-\d+x\d+/g, "");
  return src.startsWith("/") ? BASE_URL + src : src;
}

async function run() {
  const res = await fetch("https://mangalivre.to/");
  const html = await res.text();
  const $ = cheerio.load(html);
  
  console.log("== UPDATES ==");
  $(".manga-item, .page-item-detail").first().each((_, el) => {
    const img = getImageSrc($(el).find("img"));
    console.log(`Img: "${img}"`);
  });
}
run();
