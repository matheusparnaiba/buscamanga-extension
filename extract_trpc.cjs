const fs = require('fs');

async function extractTRPC() {
  const res = await fetch("https://hipertoon.com/assets/index-Q7Kr0JtS.js");
  const js = await res.text();
  
  // Look for strings like "manga.getLatest", "chapter.get"
  const strings = js.match(/(["'])([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\1/g);
  if (strings) {
    const unique = [...new Set(strings)];
    console.log("Possible tRPC procedures:");
    unique.forEach(s => console.log(s));
  } else {
    console.log("No tRPC procedures found with string match.");
  }
}
extractTRPC();
