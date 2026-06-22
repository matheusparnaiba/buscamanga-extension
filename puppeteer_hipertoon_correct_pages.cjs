const puppeteer = require("puppeteer");

async function run() {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('api/trpc') || response.url().includes('cdn.hipertoon')) {
      console.log('--- Network Response ---');
      console.log('URL:', decodeURIComponent(response.url()));
    }
  });

  console.log("Navigating to hipertoon correct chapter page...");
  await page.goto("https://hipertoon.com/manga/aniki-no-kanojo-ni-naru-onnanoko-ni-nacchatta-otouto/21.5", { waitUntil: 'networkidle0' });
  
  console.log("Done. Closing browser.");
  await browser.close();
}
run();
