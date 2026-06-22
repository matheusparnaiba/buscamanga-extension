const fs = require('fs');

async function check() {
  const res = await fetch("https://hipertoon.com/assets/index-Q7Kr0JtS.js");
  const js = await res.text();
  
  const idx = js.indexOf("Capítulo sem páginas");
  if (idx !== -1) {
    console.log(js.substring(idx - 200, idx + 200));
  } else {
    console.log("Not found.");
  }
}
check();
