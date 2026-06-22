const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  await page.goto("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto", { waitUntil: 'networkidle0' });
  
  const hrefs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('aniki-no-kanojo-ni-naru'));
  });
  
  console.log("Chapter Links:");
  console.log([...new Set(hrefs)].slice(0, 10));
  
  await browser.close();
}
run();
