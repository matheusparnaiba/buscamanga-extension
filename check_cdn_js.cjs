const fs = require('fs');

async function check() {
  const res = await fetch("https://hipertoon.com/assets/index-Q7Kr0JtS.js");
  const js = await res.text();
  
  const matches = [...js.matchAll(/cdn\.hipertoon/g)];
  for (const match of matches) {
    const idx = match.index;
    console.log(js.substring(idx - 100, idx + 200));
    console.log("-----------------------");
  }
}
check();
