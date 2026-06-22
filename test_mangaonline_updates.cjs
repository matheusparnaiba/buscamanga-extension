const cheerio = require("cheerio");

const BASE_URL = "https://mangaonline.blue";

function getImageSrc($img) {
  let src =
    $img.attr("data-src") ||
    $img.attr("data-lazy-src") ||
    $img.attr("srcset")?.split(" ")[0] ||
    $img.attr("src") ||
    $img.attr("data-cfsrc") ||
    "";
  src = src.trim().replace(/-\d+x\d+/g, "");
  return src.startsWith("/") ? BASE_URL + src : src;
}

async function run() {
  const res = await fetch(`${BASE_URL}/page/1/`);
  const data = await res.text();
  const $ = cheerio.load(data);
  const items = [];

  $(".es-upd-card").each((_, el) => {
    const title = $(el).find(".es-upd-title").text().trim();
    const href = $(el).find(".es-upd-title").attr("href");
    const img = getImageSrc($(el).find(".es-upd-cover img"));

    if (href) {
      const idMatch = href.match(/\/manga\/([^/]+)/);
      const mangaId = idMatch ? idMatch[1] : href;

      const firstChapterEl = $(el).find(".es-upd-chap").first();
      const chapterUrl = firstChapterEl.attr("href");
      const chapterName = firstChapterEl.find(".es-upd-chap-name").text().trim() || "Cap. ?";

      let chapterId = mangaId;
      if (chapterUrl) {
        const chapMatch = chapterUrl.match(/\/manga\/[^/]+\/([^/]+)/);
        if (chapMatch) chapterId = chapMatch[1];
      }

      items.push({
        mangaId,
        chapterId,
        title,
        subtitle: chapterName,
        imageUrl:
          img ||
          "https://ui-avatars.com/api/?name=" + encodeURIComponent(title) + "&background=random",
        type: "chapterUpdatesCarouselItem",
      });
    }
  });

  console.log(JSON.stringify(items.slice(0, 3), null, 2));
}

run();
