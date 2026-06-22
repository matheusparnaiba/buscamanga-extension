const puppeteer = require("puppeteer");
const fs = require("fs");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  );
  await page.goto("https://sakuramangas.org/", { waitUntil: "networkidle2" });

  const content = await page.content();
  fs.writeFileSync("sakura_real.html", content);
  console.log("Saved sakura_real.html");
  await browser.close();
}
run();
