const fs = require("fs");

async function run() {
  const res = await fetch("https://sakuramangas.org");
  const data = await res.text();
  fs.writeFileSync("sakura.html", data);
}

run();
