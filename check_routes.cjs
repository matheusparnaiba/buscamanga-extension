const fs = require('fs');

async function check() {
  const res = await fetch("https://hipertoon.com/assets/index-Q7Kr0JtS.js");
  const js = await res.text();
  
  const matches = [...js.matchAll(/path\s*:\s*["']\/([^"']+)["']/g)];
  for (const match of matches) {
    console.log(match[1]);
  }
}
check();
