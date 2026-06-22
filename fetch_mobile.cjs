const fs = require('fs');
async function run() {
  const res = await fetch("https://mangalivre.to/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    }
  });
  const html = await res.text();
  fs.writeFileSync('mobile.html', html);
  console.log("Saved mobile.html");
}
run();
