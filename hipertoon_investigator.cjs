const fs = require('fs');

fetch('https://hipertoon.com/assets/index-Q7Kr0JtS.js')
  .then(res => res.text())
  .then(text => {
    console.log("Searching for /api/ routes...");
    const regex = /"(\/api\/[^"]+)"/gi;
    const matches = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    
    console.log('Possible routes:', Array.from(matches).slice(0, 50));
  });
