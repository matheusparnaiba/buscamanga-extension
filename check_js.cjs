const fs = require("fs");

async function check() {
  try {
    const res = await fetch("https://hipertoon.com/assets/index-Q7Kr0JtS.js", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    const js = await res.text();
    
    const apiUrls = js.match(/https?:\/\/[\w\.\/:-]*api[\w\.\/:-]*/g);
    const endpoints = js.match(/["']\/api\/[^"']*["']/g);
    
    console.log("API URLs:", [...new Set(apiUrls)]);
    console.log("Endpoints:", [...new Set(endpoints)]);
  } catch (err) {
    console.log("Error:", err.message);
  }
}
check();
