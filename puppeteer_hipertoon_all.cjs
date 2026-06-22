const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('response', async response => {
    const url = decodeURIComponent(response.url());
    if (url.includes('cdn.hipertoon.com') || url.includes('/api/')) {
      console.log('--- Network Response ---');
      console.log('URL:', url);
    }
  });

  console.log("Navigating to hipertoon chapter page...");
  await page.goto("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto/capitulo-21.5", { waitUntil: 'networkidle0' });
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
