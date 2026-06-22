const puppeteer = require("puppeteer");
const fs = require("fs");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  console.log("Navigating to hipertoon chapter page...");
  await page.goto("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto/capitulo-21.5", { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  fs.writeFileSync('hipertoon_rendered.html', html);
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
