const https = require("https");

async function checkUrl(url) {
  const res = await fetch(url, {
    headers: { Referer: "https://mangaonline.blue/", "User-Agent": "Mozilla/5.0" },
  });
  console.log(`URL: ${url}`);
  console.log(`Status: ${res.status}`);
}

checkUrl(
  "https://mangaonline.blue/wp-content/uploads/2026/03/2025-07-25-11-28-16-1753442896758.jpg",
);
checkUrl(
  "https://mangaonline.blue/wp-content/uploads/2026/03/evolucao-infinita-comecando-do-zero-new.webp",
);
checkUrl(
  "https://mangaonline.blue/wp-content/uploads/2025/11/95d6c603-5993-42b0-9347-960f79d33f1a.jpg.512.jpg",
);
