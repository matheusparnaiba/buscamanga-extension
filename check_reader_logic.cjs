const fs = require('fs');

async function check() {
  const res = await fetch("https://hipertoon.com/assets/index-Q7Kr0JtS.js");
  const js = await res.text();
  
  const idx = js.indexOf("Capítulo sem páginas");
  console.log(js.substring(idx - 1500, idx + 500));
}
check();
