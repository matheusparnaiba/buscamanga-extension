import * as cheerio from "cheerio";

async function fetchHTML() {
  try {
    const res = await fetch("https://mangaonline.blue/manga/solo-leveling/capitulo-200-pt-br/");
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log("=== CHAPTER PAGES ===");
    $(".reading-content img").each((i, el) => {
      if(i < 5) console.log($(el).attr("src"));
    });

  } catch(e) {
    console.error("Error:", e);
  }
}
fetchHTML();
