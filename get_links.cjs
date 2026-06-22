const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  console.log("Navigating to hipertoon...");
  await page.goto("https://hipertoon.com/", { waitUntil: 'networkidle0' });
  
  const hrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('/capitulo'));
  });
  
  console.log("Chapter links:");
  console.log([...new Set(hrefs)].slice(0, 5));
  
  await browser.close();
}
run();
