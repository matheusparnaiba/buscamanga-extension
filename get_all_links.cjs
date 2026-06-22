const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  await page.goto("https://hipertoon.com/", { waitUntil: 'networkidle0' });
  
  const hrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href);
  });
  
  console.log("Links:");
  console.log([...new Set(hrefs)].filter(h => h && h !== "https://hipertoon.com/").slice(0, 10));
  
  await browser.close();
}
run();
